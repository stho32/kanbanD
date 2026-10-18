mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn archivieren_stoppt_timer_und_zurueckholen() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    senden(Method::POST, a, "api/aufgaben/1/timer/start", "cl", json!(null)).await;
    let (s, r) = senden(Method::POST, a, "api/aufgaben/1/archivieren", "st", json!(null)).await;
    assert_eq!(s, 200);
    assert_eq!(r["archiviert"], kanband::uhr::heute());
    assert!(r["zeiten"][0]["ende"].is_string());
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").contains(&format!("archived: {}\n", kanband::uhr::heute())));
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("[#1]"), "die Board-Zeile bleibt");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#1 archiviert, 1 Timer gestoppt");
    assert_eq!(senden(Method::POST, a, "api/aufgaben/1/archivieren", "st", json!(null)).await.0, 409);
    assert_eq!(senden(Method::POST, a, "api/aufgaben/1/zurueckholen", "st", json!(null)).await.0, 200);
    assert!(!lies(tmp.path(), "aufgaben/0001-eins.md").contains("archived"));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1 zurückgeholt");
    assert_eq!(senden(Method::POST, a, "api/aufgaben/1/zurueckholen", "st", json!(null)).await.0, 409);
    senden(Method::POST, a, "api/aufgaben/2/archivieren", "st", json!(null)).await;
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#2 archiviert");
}

#[tokio::test]
async fn mehrere_in_einem_commit_und_unbekannte_aendert_nichts() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    assert_eq!(senden(Method::POST, a, "api/aufgaben/archivieren", "st", json!({"nummern": [1, 99]})).await.0, 404);
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
    assert_eq!(senden(Method::POST, a, "api/aufgaben/archivieren", "st", json!({"nummern": []})).await.0, 400);
    senden(Method::POST, a, "api/aufgaben/2/timer/start", "cl", json!(null)).await;
    let (s, r) = senden(Method::POST, a, "api/aufgaben/archivieren", "st", json!({"nummern": [1, 2, 3]})).await;
    assert_eq!((s, r), (200, json!([1, 2, 3])));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1, #2, #3 archiviert (3 Aufgaben)");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=", "HEAD"]).lines().count(), 3);
    assert!(!lies(tmp.path(), "aufgaben/0002-zwei.md").contains("..."), "laufender Timer gestoppt");
    let (_, r) = senden(Method::POST, a, "api/aufgaben/zurueckholen", "st", json!({"nummern": [1, 2]})).await;
    assert_eq!(r, json!([1, 2]));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1, #2 zurückgeholt (2 Aufgaben)");
    assert!(!lies(tmp.path(), "aufgaben/0001-eins.md").contains("archived"));
}
