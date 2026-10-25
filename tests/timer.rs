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
    // nach weniger als 20 Sekunden bleibt kein Zeitblock (R00068)
    assert_eq!(r["zeiten"].as_array().unwrap().len(), 1, "Claudes kurzer Lauf ist verworfen");
    assert!(r["zeiten"][0]["ende"].is_null(), "Stefans Timer läuft weiter");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#1 Timer von Claude verworfen (unter 20 s)");
    assert_eq!(senden(Method::POST, a, "api/aufgaben/1/timer/stop", "cl", json!(null)).await.0, 409);
    let (s, _) = senden(Method::POST, a, "api/aufgaben/1/timer/stop", "st", json!(null)).await;
    assert_eq!(s, 200, "ohne Angabe stoppt die handelnde Person ihren Timer");
    assert!(!lies(tmp.path(), "aufgaben/0001-eins.md").contains("..."));
}

// R00068: ohne bekannte Startsekunde (Timer stand schon in der Datei) wird der Lauf festgehalten
#[tokio::test]
async fn timer_aus_der_datei_wird_festgehalten() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::write(tmp.path().join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\n---\n```kanbanD-time\n2026-10-19 09:00 · ... · st\n```\n").unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/aufgaben/1/timer/stop", "st", json!(null)).await;
    assert_eq!(s, 200);
    assert!(r["zeiten"][0]["ende"].is_string(), "{r}");
    assert!(git(tmp.path(), &["log", "-1", "--format=%s"]).starts_with("#1 Timer von Stefan gestoppt ("));
}

// R00084: ein neuer Timer schreibt den Beginn mit dem Versatz der Ortszeit
#[tokio::test]
async fn timer_start_schreibt_versatz() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/aufgaben/1/timer/start", "st", json!(null)).await;
    assert_eq!(s, 200);
    let beginn = r["zeiten"][0]["beginn"].as_str().unwrap();
    assert!(beginn.ends_with("+01:00") || beginn.ends_with("+02:00"), "{beginn}");
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").contains(&format!("{beginn} · ... · st")));
}
