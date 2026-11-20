mod gemeinsam;

use gemeinsam::{lies, senden};
use reqwest::Method;
use serde_json::json;

/// R00212: die Herkunft wird geschrieben und geprüft, nicht aufgelöst — `GET /api/herkunft` gibt es nicht mehr.
#[tokio::test]
async fn herkunft_wird_geschrieben_und_geprueft_aber_nicht_aufgeloest() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (s, _) = senden(Method::PATCH, a, "api/aufgaben/2", "st", json!({"herkunft": ["i0007", "R00014"]})).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "aufgaben/0002-zwei.md").contains("origins: [I0007, R00014]"));
    assert_eq!(senden(Method::PATCH, a, "api/aufgaben/2", "st", json!({"herkunft": ["X1"]})).await.0, 400);
    assert_eq!(reqwest::get(format!("{a}api/herkunft")).await.unwrap().status(), 404);
}
