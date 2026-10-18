mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn agent_kommentiert_zweizeilig() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = kanband::uhr::jetzt();
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben/2/kommentare", "cl", json!({"text": " Zwei\nZeilen "})).await;
    let nachher = kanband::uhr::jetzt();
    assert_eq!(s, 200);
    assert_eq!(a["kommentare"][0]["text"], "Zwei\nZeilen");
    let zp = a["kommentare"][0]["zeitpunkt"].as_str().unwrap().to_string();
    assert!(zp == vorher || zp == nachher, "{zp}");
    assert!(lies(tmp.path(), "aufgaben/0002-zwei.md").ends_with(&format!("```kanbanD-comments\n{zp} · cl · Zwei\\nZeilen\n```\n")));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Claude|#2 kommentiert: Zwei Zeilen");
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/aufgaben/2/kommentare", "cl", json!({"text": "  "})).await.0, 400);
}
