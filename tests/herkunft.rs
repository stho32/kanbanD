mod gemeinsam;

use gemeinsam::{lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn wbs_und_anforderung_werden_aufgeloest() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::create_dir_all(tmp.path().join("plan")).unwrap();
    std::fs::create_dir_all(tmp.path().join("anf")).unwrap();
    let mut wbs = String::from("# WBS\n\n| ID | Ebene | Eltern | Name | Status | Braucht |\n|---|---|---|---|---|---|\n");
    wbs.push_str("| I0005 | Interaction | D0001 | Anlegen | gruen | |\n| I0007 | Interaction | D0001 | Bewegen | rot | I0005 |\n");
    std::fs::write(tmp.path().join("plan/wbs.md"), &wbs).unwrap();
    std::fs::write(tmp.path().join("anf/R00014-timer.md"), "---\nid: R00014\n---\n\n# R00014: Timer\n").unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (s, _) = senden(Method::PATCH, a, "api/aufgaben/2", "st", json!({"herkunft": ["i0007", "R00014"]})).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "aufgaben/0002-zwei.md").contains("origins: [I0007, R00014]"));
    assert_eq!(senden(Method::PATCH, a, "api/aufgaben/2", "st", json!({"herkunft": ["X1"]})).await.0, 400);
    let (_, q) = senden(Method::GET, a, "api/herkunft", "st", json!(null)).await;
    let wurzel = tmp.path().canonicalize().unwrap();
    assert_eq!(q["I0007"]["datei"], wurzel.join("plan/wbs.md").to_string_lossy().as_ref());
    assert_eq!(q["I0007"]["zeile"], 6);
    assert_eq!(q["I0007"]["name"], "Bewegen");
    assert_eq!(q["I0007"]["braucht"], json!(["I0005"]));
    assert_eq!(q["I0005"]["status"], "gruen", "über Braucht erreichte Knoten werden mit aufgelöst");
    assert_eq!(q["R00014"]["name"], "Timer");
    assert_eq!(q["R00014"]["datei"], wurzel.join("anf/R00014-timer.md").to_string_lossy().as_ref());
}

#[tokio::test]
async fn ohne_quellen_ist_die_herkunft_leer() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    senden(Method::PATCH, &lauf.adresse, "api/aufgaben/1", "st", json!({"herkunft": ["I0001"]})).await;
    let (s, q) = senden(Method::GET, &lauf.adresse, "api/herkunft", "st", json!(null)).await;
    assert_eq!((s, q), (200, json!({})));
}
