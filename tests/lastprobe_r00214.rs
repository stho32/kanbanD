// R00214 AK 16 (R00261 AK 5, B1411): die Wanduhr-Zeiten der Schreibsperre-Probe — 20.000 Labels speichern, zwei PATCH
// (verschiedene und gleiche `braucht`), `GET /api/aufgaben` und ein fremder PATCH auf #2, je < 1 s (Grenze aus R00214
// AK 16). Läuft nur ausdrücklich, mit --release und ruhiger Maschine (Last < 2 aus /proc/loadavg); im Gate `ignored`:
//   cargo test --release --test lastprobe_r00214 -- --ignored --nocapture
mod gemeinsam;

use gemeinsam::senden;
use reqwest::Method;
use serde_json::{Value, json};
use std::time::{Duration, Instant};

const VIELE: usize = 20_000;
const SEKUNDE: Duration = Duration::from_secs(1);

/// Die 1-Minuten-Last der Maschine aus `/proc/loadavg`.
fn last() -> f64 {
    std::fs::read_to_string("/proc/loadavg").unwrap_or_default().split(' ').next().unwrap_or_default().parse().unwrap_or(f64::MAX)
}

/// Board „e“ wie die Ausgangslage von R00214: #1 „Gerüst“, #2 „Bau“, #5 „Frei“ offen, #3 „Doku“ in Arbeit.
fn board_anlegen(pfad: &std::path::Path) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), "---\npeople:\n  st: {name: Stefan, kind: human}\n---\n").unwrap();
    std::fs::write(pfad.join("boards/e.md"), "# E\n\n## Offen\n\n- #1\n- #2\n- #5\n\n## In Arbeit\n\n- #3\n\n## Fertig\n").unwrap();
    for (nr, titel, datei) in [(1, "Gerüst", "0001-geruest.md"), (2, "Bau", "0002-bau.md"), (3, "Doku", "0003-doku.md"), (5, "Frei", "0005-frei.md")] {
        std::fs::write(pfad.join(format!("aufgaben/{datei}")), format!("---\nid: {nr}\ntitle: {titel}\n---\n")).unwrap();
    }
    gemeinsam::git(pfad, &["init", "-q"]);
    gemeinsam::git(pfad, &["add", "-A"]);
    gemeinsam::git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "e"]);
}

/// Die Dauer eines Aufrufs.
async fn gemessen<T>(aufruf: impl std::future::Future<Output = T>) -> (T, Duration) {
    let start = Instant::now();
    let ergebnis = aufruf.await;
    (ergebnis, start.elapsed())
}

/// PATCH der Labels von #1 und, 20 ms später, ein PATCH eines anderen Schreibers auf #2; beide Antworten und Zeiten.
async fn mit_fremdem_patch(adresse: &str, labels: Vec<String>) -> (((u16, Value), Duration), ((u16, Value), Duration)) {
    let eigen = gemessen(senden(Method::PATCH, adresse, "api/aufgaben/1", "st", json!({ "labels": labels })));
    let fremd = async {
        tokio::time::sleep(Duration::from_millis(20)).await;
        gemessen(senden(Method::PATCH, adresse, "api/aufgaben/2", "st", json!({ "titel": "Bau, umbenannt" }))).await
    };
    tokio::join!(eigen, fremd)
}

async fn get(adresse: &str, pfad: &str) -> (u16, Value) {
    let r = reqwest::get(format!("{adresse}{pfad}")).await.unwrap();
    let status = r.status().as_u16();
    (status, serde_json::from_str(&r.text().await.unwrap()).unwrap_or(Value::Null))
}

#[tokio::test]
#[ignore = "Lastprobe: nur ausdrücklich, mit --release"]
async fn ak16_lastprobe_zeiten_der_schreibsperre() {
    let l = last();
    eprintln!("AK 16 Lastprobe: Last unter 2 nötig (Last jetzt {l:.2})");
    if l >= 2.0 {
        eprintln!("AK 16 keine Messung: Last < 2 nötig (Last {l:.2}) — kein Wert gilt als bestanden");
        return;
    }
    let tmp = tempfile::tempdir().unwrap();
    let board = tmp.path().canonicalize().unwrap();
    board_anlegen(&board);
    let lauf = gemeinsam::starten(&board, &["--port", "0"]);
    let adresse = lauf.adresse.clone();

    let ((s, a), speichern) = gemessen(senden(Method::PATCH, &adresse, "api/aufgaben/1", "st", json!({ "labels": (0..VIELE).map(|i| format!("q{i}")).collect::<Vec<_>>() }))).await;
    assert_eq!(s, 200, "{a}");

    let verschieden: Vec<String> = (0..VIELE).map(|i| format!("braucht:{}", i + 10)).collect();
    let ((eigen, eigen_dauer), (fremd, fremd_dauer)) = mit_fremdem_patch(&adresse, verschieden).await;
    assert_eq!((eigen.0, fehler(&eigen)), (400, "Aufgabe #10 gibt es nicht (braucht:10)"), "{}", eigen.1);
    assert_eq!(fremd.0, 200, "{}", fremd.1);

    let gleich = vec!["braucht:3".to_string(); VIELE];
    let ((eigen2, eigen2_dauer), (fremd2, fremd2_dauer)) = mit_fremdem_patch(&adresse, gleich).await;
    assert_eq!(eigen2.0, 200, "{}", eigen2.1);
    assert_eq!(fremd2.0, 200, "{}", fremd2.1);

    let ((s, liste), liste_dauer) = gemessen(get(&adresse, "api/aufgaben")).await;
    assert_eq!(s, 200);
    let eins = liste["aufgaben"].as_array().unwrap().iter().find(|a| a["nummer"] == 1).unwrap();
    assert_eq!(eins["braucht"].as_array().unwrap().len(), 1, "nach dem gleichen PATCH genau ein braucht:3");

    let last_nach = last();
    eprintln!("AK 16 Last: beim Start {l:.2}, nach der Messung {last_nach:.2}");
    eprintln!("AK 16 ms: speichern {} | verschieden: eigen {} fremd {} | gleich: eigen {} fremd {} | Liste {}", ms(speichern), ms(eigen_dauer), ms(fremd_dauer), ms(eigen2_dauer), ms(fremd2_dauer), ms(liste_dauer));
    assert!(speichern < SEKUNDE, "{VIELE} Labels q<i> speichern: {speichern:?}");
    assert!(eigen_dauer < SEKUNDE, "{VIELE} verschiedene braucht:<n>: {eigen_dauer:?}");
    assert!(fremd_dauer < SEKUNDE, "fremdes PATCH auf #2 während verschieden: {fremd_dauer:?}");
    assert!(eigen2_dauer < SEKUNDE, "{VIELE}-mal braucht:3: {eigen2_dauer:?}");
    assert!(fremd2_dauer < SEKUNDE, "fremdes PATCH auf #2 während gleich: {fremd2_dauer:?}");
    assert!(liste_dauer < SEKUNDE, "GET /api/aufgaben: {liste_dauer:?}");
}

fn fehler(antwort: &(u16, Value)) -> &str {
    antwort.1["fehler"].as_str().unwrap_or_default()
}

fn ms(d: Duration) -> u128 {
    d.as_millis()
}
