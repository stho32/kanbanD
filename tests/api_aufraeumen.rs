// R00092 API aufräumen: Antwortform, archivierte Karten, Filter
mod gemeinsam;

use gemeinsam::senden;
use reqwest::Method;
use serde_json::{Value, json};

async fn lesen(adresse: &str, pfad: &str) -> (u16, Value) {
    senden(Method::GET, adresse, pfad, "st", json!(null)).await
}

#[tokio::test]
async fn karte_direkt_mit_pfad_und_text() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, a) = lesen(&lauf.adresse, "api/aufgaben/2").await;
    assert_eq!(s, 200);
    assert_eq!((a["nummer"].as_u64(), a["titel"].as_str(), a["pfad"].as_str()), (Some(2), Some("zwei"), Some("aufgaben/0002-zwei.md")));
    assert_eq!(a["text"], "---\nid: 2\ntitle: zwei\n---\n");
    assert!(a.get("aufgabe").is_none(), "keine Hülle mehr");
    std::fs::write(tmp.path().join("aufgaben/0003-drei.md"), "---\nid: 3\ntitle: [kaputt\n---\n").unwrap();
    let (s, d) = lesen(&lauf.adresse, "api/aufgaben/3").await;
    assert_eq!(s, 423);
    assert!(d["fehler"].is_string() && d["pfad"] == "aufgaben/0003-drei.md" && d["text"].as_str().unwrap().contains("[kaputt"));
}
