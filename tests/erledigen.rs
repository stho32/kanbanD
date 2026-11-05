// R00099 Befund erledigt sich: POST /api/aufgaben/erledigen {key, board, text, signal} — erledigen oder melden, ein Commit
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

const EINSTELLUNGEN: &str = "---\npeople:\n  st: {name: Stefan, kind: human}\n  bot: {name: Sensor, kind: agent}\nclasses: {}\nsignals:\n  behoben: {label: Befund nicht mehr gefunden, color: green}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n---\n";
const SPALTEN: [&str; 5] = ["Eingang", "Freigegeben", "In Arbeit", "Verstehen & Freigabe", "Fertig"];

/// Board „fabrik“ mit fünf Spalten, Eingang gehört dem Menschen; `kopf` ergänzt das Frontmatter des Boards.
/// `karten`: (Nummer, Schlüssel, Spalte oder leer für „nicht auf dem Board“, Zusatz im Frontmatter der Aufgabe).
fn fabrik(pfad: &Path, kopf: &str, karten: &[(u32, &str, &str, &str)]) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), EINSTELLUNGEN).unwrap();
    let mut board = format!("---\ncolumn-owner:\n  Eingang: human\n{kopf}---\n\n# fabrik\n");
    for s in SPALTEN {
        board.push_str(&format!("\n## {s}\n\n"));
        for (nr, _, _, _) in karten.iter().filter(|k| k.2 == s) {
            board.push_str(&format!("- [#{nr}](../aufgaben/{nr:04}-befund.md)\n"));
        }
    }
    std::fs::write(pfad.join("boards/fabrik.md"), board).unwrap();
    for (nr, key, _, zusatz) in karten {
        std::fs::write(pfad.join(format!("aufgaben/{nr:04}-befund.md")), format!("---\nid: {nr}\ntitle: Befund {nr}\nkey: {key}\n{zusatz}---\n")).unwrap();
    }
    git(pfad, &["init", "-q"]);
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
}

fn commits(pfad: &Path) -> usize {
    git(pfad, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

async fn erledigen(adresse: &str, wer: &str, daten: Value) -> (u16, Value) {
    senden(Method::POST, adresse, "api/aufgaben/erledigen", wer, daten).await
}

fn eingespielt(key: &str) -> Value {
    json!({"key": key, "board": "fabrik", "text": "lodash 4.17.21 ist eingespielt", "signal": "behoben"})
}

async fn reservieren(adresse: &str, nr: u32, wer: &str, instanz: &str) {
    let r = reqwest::Client::new().post(format!("{adresse}api/aufgaben/{nr}/reservierung")).header("X-KanbanD-Wer", wer).header("X-KanbanD-Instanz", instanz).send().await.unwrap();
    assert_eq!(r.status().as_u16(), 200);
}

/// Die Nummern einer Spalte aus der Board-Datei, in Reihenfolge.
fn spalte(pfad: &Path, name: &str) -> Vec<u32> {
    let board = lies(pfad, "boards/fabrik.md");
    let rest = board.split(&format!("## {name}\n")).nth(1).unwrap_or_default();
    rest.split("\n## ").next().unwrap().lines().filter_map(|z| z.strip_prefix("- [#")).map(|z| z.split(']').next().unwrap().parse().unwrap()).collect()
}

// AK Erledigen 1, US-1 (B0333)
#[tokio::test]
async fn reservierte_karte_wird_in_einem_commit_erledigt() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), "", &[(3, "k3", "Fertig", ""), (7, "k1", "In Arbeit", "")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    reservieren(&lauf.adresse, 7, "bot", "A").await;
    let vorher = commits(tmp.path());

    let (s, r) = erledigen(&lauf.adresse, "bot", eingespielt("k1")).await;
    assert_eq!((s, &r["ergebnis"], &r["warnungen"], &r["aufgabe"]["nummer"]), (200, &json!("erledigt"), &json!([]), &json!(7)), "{r}");
    assert_eq!(r.as_object().unwrap().keys().collect::<Vec<_>>(), ["aufgabe", "ergebnis", "warnungen"]);
    assert_eq!((spalte(tmp.path(), "Fertig"), spalte(tmp.path(), "In Arbeit")), (vec![7, 3], vec![]));
    let datei = lies(tmp.path(), "aufgaben/0007-befund.md");
    assert!(datei.contains(" · bot · Befund nicht mehr gefunden: lodash 4.17.21 ist eingespielt\n"), "{datei}");
    assert!(!datei.contains("reservation"), "Reservierung entfernt: {datei}");
    assert!(r["aufgabe"]["reservierung"].is_null(), "{r}");
    assert_eq!(commits(tmp.path()), vorher + 1);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#7 erledigt sich: „In Arbeit“ → „Fertig“ (fabrik)");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=", "HEAD"]), "aufgaben/0007-befund.md\nboards/fabrik.md");
}

// AK Gegenbeispiel Spaltenprüfung (B0333): column-checks laufen beim Erledigen nicht
#[tokio::test]
async fn spaltenpruefungen_laufen_beim_erledigen_nicht() {
    let tmp = tempfile::tempdir().unwrap();
    let wirkung = "wbs-effects:\n  - {application: kd, action: create, node: I0048}\n";
    fabrik(tmp.path(), "column-checks:\n  In Arbeit: [wbs-effects-green]\n", &[(7, "k1", "In Arbeit", wirkung)]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());
    let (s, r) = erledigen(&lauf.adresse, "bot", eingespielt("k1")).await;
    assert_eq!((s, &r["ergebnis"], &r["warnungen"]), (200, &json!("erledigt"), &json!([])), "{r}");
    assert_eq!(commits(tmp.path()), vorher + 1);
    assert!(lies(tmp.path(), "boards/fabrik.md").contains("column-checks:\n  In Arbeit: [wbs-effects-green]\n"), "Board-Kopf bleibt");
}
