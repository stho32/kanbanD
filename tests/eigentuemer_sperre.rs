// R00097 Spalten mit Eigentümer: ein Agent nimmt keine Karte aus einer Spalte, die dem Menschen gehört
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

/// Board „Fluss“: „Eingang“ (human) [1, 2], „In Arbeit“ [9], „Bereit“, „Freigegeben“, „Verstehen & Freigabe“ (human),
/// „Voll“ mit Grenze 1 und [5]. `cl` ist Agent, `st` Mensch (gemeinsam::eingerichtet).
fn fluss(pfad: &Path) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    for nr in [1, 2, 5, 9] {
        std::fs::write(pfad.join(format!("aufgaben/{nr:04}-k.md")), format!("---\nid: {nr}\ntitle: k{nr}\n---\n")).unwrap();
    }
    let board = "---\nlimits:\n  Voll: 1\ncolumn-owner:\n  Eingang: human\n  Verstehen & Freigabe: human\n---\n\n# Fluss\n\n## Eingang\n\n- #1\n- #2\n\n## In Arbeit\n\n- #9\n\n## Bereit\n\n## Freigegeben\n\n## Verstehen & Freigabe\n\n## Voll\n\n- #5\n";
    std::fs::write(pfad.join("boards/fluss.md"), board).unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fluss"]);
}

pub(crate) fn verboten(nummer: u32) -> Value {
    json!({"fehler": "Spalte „Eingang“ gehört dem Menschen", "spalte": "Eingang", "nummer": nummer})
}

/// HEAD und alle Dateien unter boards/ und aufgaben/.
fn stand(pfad: &Path) -> (String, Vec<(String, String)>) {
    let mut dateien: Vec<(String, String)> = ["boards", "aufgaben"]
        .iter()
        .flat_map(|o| std::fs::read_dir(pfad.join(o)).unwrap().map(|e| e.unwrap().path()))
        .map(|p| (p.display().to_string(), std::fs::read_to_string(&p).unwrap()))
        .collect();
    dateien.sort();
    (git(pfad, &["rev-parse", "HEAD"]), dateien)
}

fn commits(pfad: &Path) -> usize {
    git(pfad, &["rev-list", "--count", "HEAD"]).trim().parse().unwrap()
}

// ---- bewegen, bewegen-mehrere (B0291)

#[tokio::test]
async fn agent_bewegt_und_sortiert_nicht_aus_der_menschen_spalte() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = stand(tmp.path());
    let (s, r) = senden(Method::POST, a, "api/boards/fluss/bewegen", "cl", json!({"nummer": 1, "spalte": "Freigegeben"})).await;
    assert_eq!((s, r), (403, verboten(1)));
    let (s, r) = senden(Method::POST, a, "api/boards/fluss/bewegen", "cl", json!({"nummer": 2, "spalte": "Eingang", "index": 0})).await;
    assert_eq!((s, r), (403, verboten(2)), "auch Umsortieren in derselben Spalte");
    let (s, r) = senden(Method::POST, a, "api/boards/fluss/bewegen", "cl", json!({"nummer": 1, "spalte": "Voll"})).await;
    assert_eq!((s, r), (403, verboten(1)), "403 vor 409");
    assert_eq!(stand(tmp.path()), vorher, "kein Commit, keine Datei geändert");
}

#[tokio::test]
async fn agent_bewegt_mehrere_nicht_wenn_eine_aus_der_menschen_spalte_kommt() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = stand(tmp.path());
    let ziele = json!({"ziele": [{"nummer": 9, "spalte": "Bereit"}, {"nummer": 2, "spalte": "Freigegeben"}, {"nummer": 1, "spalte": "Freigegeben"}]});
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/boards/fluss/bewegen-mehrere", "cl", ziele).await;
    assert_eq!((s, r), (403, verboten(2)), "die erste Sperre in Anfragereihenfolge");
    assert_eq!(stand(tmp.path()), vorher, "#9 nicht bewegt, kein Commit");
}

#[tokio::test]
async fn agent_legt_in_die_menschen_spalte_ab_und_mensch_bewegt_frei() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (s, _) = senden(Method::POST, a, "api/boards/fluss/bewegen", "cl", json!({"nummer": 9, "spalte": "Verstehen & Freigabe"})).await;
    assert_eq!(s, 200, "hineinlegen bleibt erlaubt");
    let n = commits(tmp.path());
    let (s, _) = senden(Method::POST, a, "api/boards/fluss/bewegen", "st", json!({"nummer": 1, "spalte": "Freigegeben"})).await;
    assert_eq!(s, 200);
    assert_eq!(commits(tmp.path()), n + 1, "ein Commit");
    let (s, _) = senden(Method::POST, a, "api/boards/fluss/bewegen-mehrere", "st", json!({"ziele": [{"nummer": 2, "spalte": "Bereit"}]})).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "boards/fluss.md").contains("## Eingang\n\n## In Arbeit"), "Eingang ist leer");
}
