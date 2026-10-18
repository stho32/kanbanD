mod gemeinsam;

use kanband::waechter::{Eigene, Ereignis, starten};
use std::sync::mpsc;
use std::time::Duration;

fn beobachten(pfad: &std::path::Path) -> (notify::RecommendedWatcher, mpsc::Receiver<Ereignis>, Eigene) {
    let (tx, rx) = mpsc::channel();
    let eigene = Eigene::default();
    let w = starten(pfad.canonicalize().unwrap(), eigene.clone(), move |e| {
        let _ = tx.send(e);
    })
    .unwrap();
    std::thread::sleep(Duration::from_millis(100));
    (w, rx, eigene)
}

#[test]
fn editor_aenderung_ist_extern_und_gebuendelt() {
    let tmp = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(tmp.path().join("aufgaben")).unwrap();
    let (_w, rx, _) = beobachten(tmp.path());
    std::fs::write(tmp.path().join("aufgaben/0001-x.md"), "a").unwrap();
    std::fs::write(tmp.path().join("aufgaben/0001-x.md"), "b").unwrap();
    let e = rx.recv_timeout(Duration::from_secs(2)).unwrap();
    assert_eq!(e.pfade, vec!["aufgaben/0001-x.md"]);
    assert!(e.von_aussen);
}

#[test]
fn eigene_aenderung_ist_nicht_extern() {
    let tmp = tempfile::tempdir().unwrap();
    let (_w, rx, eigene) = beobachten(tmp.path());
    eigene.merken("boards/b.md");
    std::fs::create_dir_all(tmp.path().join("boards")).unwrap();
    std::fs::write(tmp.path().join("boards/b.md"), "x").unwrap();
    let mut alle = vec![];
    while let Ok(e) = rx.recv_timeout(Duration::from_millis(800)) {
        alle.push(e);
    }
    let e = alle.iter().find(|e| e.pfade.contains(&"boards/b.md".to_string())).expect("Ereignis zu boards/b.md");
    assert_eq!(e.pfade, vec!["boards/b.md"]);
    assert!(!e.von_aussen);
}

#[test]
fn git_und_zwischendateien_erzeugen_kein_ereignis() {
    let tmp = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(tmp.path().join(".git")).unwrap();
    let (_w, rx, _) = beobachten(tmp.path());
    std::fs::write(tmp.path().join(".git/index"), "x").unwrap();
    std::fs::write(tmp.path().join("a.kanbanD-tmp"), "x").unwrap();
    assert!(rx.recv_timeout(Duration::from_millis(600)).is_err());
}

/// Liest SSE-Zeilen `data: …` vom Ereignisstrom, bis `bedingung` erfüllt ist (höchstens 3 s).
async fn ereignis_abwarten(adresse: &str, ausloesen: impl FnOnce(), bedingung: impl Fn(&serde_json::Value) -> bool) -> serde_json::Value {
    use futures_util::StreamExt;
    let antwort = reqwest::get(format!("{adresse}api/ereignisse")).await.unwrap();
    assert_eq!(antwort.headers()["content-type"], "text/event-stream");
    let mut strom = antwort.bytes_stream();
    tokio::time::sleep(Duration::from_millis(100)).await;
    ausloesen();
    let mut puffer = String::new();
    let ende = tokio::time::Instant::now() + Duration::from_secs(3);
    while let Ok(Some(Ok(teil))) = tokio::time::timeout_at(ende, strom.next()).await {
        puffer.push_str(&String::from_utf8_lossy(&teil));
        for zeile in puffer.lines() {
            if let Some(json) = zeile.strip_prefix("data: ") {
                let v: serde_json::Value = serde_json::from_str(json).unwrap();
                if bedingung(&v) {
                    return v;
                }
            }
        }
    }
    panic!("kein passendes Ereignis in: {puffer}");
}

#[tokio::test]
async fn ereignisstrom_meldet_editor_aenderung_als_extern() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let pfad = tmp.path().join("boards/entwicklung.md");
    let e = ereignis_abwarten(&lauf.adresse, || std::fs::write(&pfad, "# Entwicklung\n\n## A\n").unwrap(), |v| v["pfade"][0] == "boards/entwicklung.md").await;
    assert_eq!(e["extern"], true);
}

#[tokio::test]
async fn ereignisstrom_meldet_eigenes_anlegen_nicht_als_extern() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let adresse = lauf.adresse.clone();
    let e = ereignis_abwarten(
        &lauf.adresse,
        move || {
            tokio::spawn(async move { gemeinsam::senden(reqwest::Method::POST, &adresse, "api/aufgaben", "st", serde_json::json!({"titel": "x", "board": "entwicklung"})).await });
        },
        |v| v["pfade"].as_array().unwrap().iter().any(|p| p == "aufgaben/0001-x.md"),
    )
    .await;
    assert_eq!(e["extern"], false);
}

#[tokio::test]
async fn offener_ereignisstrom_haelt_das_beenden_nicht_auf() {
    let tmp = tempfile::tempdir().unwrap();
    let mut lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let antwort = reqwest::get(format!("{}api/ereignisse", lauf.adresse)).await.unwrap();
    assert_eq!(antwort.status(), 200);
    let start = std::time::Instant::now();
    std::process::Command::new("kill").args(["-TERM", &lauf.kind.id().to_string()]).status().unwrap();
    let mut beendet = None;
    for _ in 0..50 {
        if let Ok(Some(s)) = lauf.kind.try_wait() {
            beendet = Some(s);
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    assert!(beendet.is_some_and(|s| s.success()), "nach {:?} noch nicht beendet", start.elapsed());
    drop(antwort);
}
