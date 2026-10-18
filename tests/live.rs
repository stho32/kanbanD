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

#[tokio::test]
async fn ereignisstrom_meldet_editor_aenderung_als_extern() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let pfad = tmp.path().join("boards/entwicklung.md");
    let e = gemeinsam::ereignis_abwarten(&lauf.adresse, || std::fs::write(&pfad, "# Entwicklung\n\n## A\n").unwrap(), |v| v["pfade"][0] == "boards/entwicklung.md").await;
    assert_eq!(e["extern"], true);
}

#[tokio::test]
async fn ereignisstrom_meldet_eigenes_anlegen_nicht_als_extern() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let adresse = lauf.adresse.clone();
    let e = gemeinsam::ereignis_abwarten(
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

#[test]
fn fremde_wbs_datei_und_commit_melden_ihr_kuerzel() {
    let arbeit = tempfile::tempdir().unwrap();
    let wurzel = arbeit.path().canonicalize().unwrap();
    std::fs::create_dir_all(wurzel.join("plan")).unwrap();
    std::fs::write(wurzel.join("plan/wbs.md"), "a").unwrap();
    gemeinsam::git(&wurzel, &["init", "-q"]);
    let (tx, rx) = mpsc::channel();
    let w = kanband::waechter::fremde_starten(kanband::waechter::Eigene::default(), move |e| {
        let _ = tx.send(e);
    })
    .unwrap();
    let datei = wurzel.join("plan/wbs.md");
    w.setzen(vec![kanband::waechter::FremdeWbs { kuerzel: "kd".into(), datei: datei.clone(), git: Some(wurzel.join(".git")) }]);
    std::thread::sleep(Duration::from_millis(100));
    std::fs::write(wurzel.join("plan/anderes.md"), "x").unwrap();
    std::fs::write(&datei, "b").unwrap();
    let e = rx.recv_timeout(Duration::from_secs(2)).unwrap();
    assert_eq!((e.pfade.clone(), e.wbs.clone(), e.von_aussen), (vec![datei.to_string_lossy().into_owned()], vec!["kd".to_string()], true));
    gemeinsam::git(&wurzel, &["add", "-A"]);
    while rx.recv_timeout(Duration::from_millis(400)).is_ok() {}
    gemeinsam::git(&wurzel, &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-m", "c"]);
    assert_eq!(rx.recv_timeout(Duration::from_secs(2)).unwrap().wbs, ["kd"], "Commit im Arbeits-Repository");
    while rx.recv_timeout(Duration::from_millis(400)).is_ok() {}
    w.setzen(vec![]);
    std::fs::write(&datei, "c").unwrap();
    assert!(rx.recv_timeout(Duration::from_millis(600)).is_err(), "nach dem Entfernen still");
}

#[test]
fn eigener_schreibzugriff_auf_fremde_wbs_ist_nicht_extern() {
    let arbeit = tempfile::tempdir().unwrap();
    let wurzel = arbeit.path().canonicalize().unwrap();
    let datei = wurzel.join("wbs.md");
    std::fs::write(&datei, "a").unwrap();
    let eigene = kanband::waechter::Eigene::default();
    let (tx, rx) = mpsc::channel();
    let w = kanband::waechter::fremde_starten(eigene.clone(), move |e| {
        let _ = tx.send(e);
    })
    .unwrap();
    w.setzen(vec![kanband::waechter::FremdeWbs { kuerzel: "kd".into(), datei: datei.clone(), git: None }]);
    std::thread::sleep(Duration::from_millis(100));
    std::fs::write(&datei, "b").unwrap();
    assert!(rx.recv_timeout(Duration::from_secs(2)).unwrap().von_aussen, "ein Editor schreibt");
    while rx.recv_timeout(Duration::from_millis(400)).is_ok() {}
    eigene.merken(&datei.to_string_lossy());
    std::fs::write(&datei, "c").unwrap();
    let e = rx.recv_timeout(Duration::from_secs(2)).unwrap();
    assert_eq!((e.wbs.clone(), e.von_aussen), (vec!["kd".to_string()], false), "kanbanD schreibt selbst");
}
