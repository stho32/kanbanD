mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn mehrere_timer_und_fremder_stopp() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (s, r) = senden(Method::POST, a, "api/aufgaben/1/timer/start", "st", json!(null)).await;
    assert_eq!(s, 200);
    let beginn = r["zeiten"][0]["beginn"].as_str().unwrap().to_string();
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").contains(&format!("```kanbanD-time\n{beginn} · ... · st\n```")));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#1 Timer von Stefan gestartet");
    assert_eq!(senden(Method::POST, a, "api/aufgaben/1/timer/start", "st", json!(null)).await.0, 409);
    assert_eq!(senden(Method::POST, a, "api/aufgaben/1/timer/start", "cl", json!(null)).await.0, 200);
    assert_eq!(senden(Method::POST, a, "api/aufgaben/2/timer/start", "st", json!(null)).await.0, 200, "dieselbe Person an zwei Aufgaben");
    let (s, r) = senden(Method::POST, a, "api/aufgaben/1/timer/stop", "st", json!({"wer": "cl"})).await;
    assert_eq!(s, 200);
    assert!(r["zeiten"][1]["ende"].is_string());
    assert!(r["zeiten"][0]["ende"].is_null(), "Stefans Timer läuft weiter");
    assert!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]).starts_with("Stefan|#1 Timer von Claude gestoppt (0:0"));
    assert_eq!(senden(Method::POST, a, "api/aufgaben/1/timer/stop", "cl", json!(null)).await.0, 409);
    let (s, _) = senden(Method::POST, a, "api/aufgaben/1/timer/stop", "st", json!(null)).await;
    assert_eq!(s, 200, "ohne Angabe stoppt die handelnde Person ihren Timer");
    assert!(!lies(tmp.path(), "aufgaben/0001-eins.md").contains("..."));
}
