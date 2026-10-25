// R00087 Reservierungen und Ziehen
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};

/// Aufruf als Person und Instanz (Header `X-KanbanD-Instanz`); ohne Instanz kein Header.
async fn als(methode: Method, adresse: &str, pfad: &str, wer: &str, instanz: Option<&str>, daten: Value) -> (u16, Value) {
    let mut r = reqwest::Client::new().request(methode, format!("{adresse}{pfad}")).header("X-KanbanD-Wer", wer).json(&daten);
    if let Some(i) = instanz {
        r = r.header("X-KanbanD-Instanz", i);
    }
    let r = r.send().await.unwrap();
    let status = r.status().as_u16();
    (status, serde_json::from_str(&r.text().await.unwrap()).unwrap_or(Value::Null))
}

fn starten(tmp: &tempfile::TempDir) -> gemeinsam::Laufendes {
    gemeinsam::mit_drei_aufgaben(tmp.path());
    gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"])
}

#[tokio::test]
async fn reservieren_verlaengern_und_fremde_abweisen() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let a = &lauf.adresse;
    let (s, r) = als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("A"), json!(null)).await;
    assert_eq!(s, 200);
    assert_eq!((r["reservierung"]["wer"].as_str(), r["reservierung"]["instanz"].as_str()), (Some("cl"), Some("A")));
    let datei = lies(tmp.path(), "aufgaben/0001-eins.md");
    assert!(datei.contains("reservation: {who: cl, instance: A, since: \""), "{datei}");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Claude|#1 reserviert (Claude · Instanz A)");
    let (s, f) = als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("B"), json!(null)).await;
    assert_eq!(s, 409);
    assert!(f["fehler"].as_str().unwrap().contains("Instanz A"), "{f}");
    // eine Stunde zurückgedreht: dieselbe Instanz verlängert auf jetzt
    std::fs::write(tmp.path().join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\nreservation: {who: cl, instance: A, since: \"2026-01-01 08:00+01:00\"}\n---\n").unwrap();
    let (s, r) = als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("B"), json!(null)).await;
    assert_eq!((s, r["reservierung"]["instanz"].as_str()), (200, Some("B")), "nach 24 h darf eine andere Instanz");
    let seit = r["reservierung"]["seit"].as_str().unwrap().to_string();
    let (s, r) = als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("B"), json!(null)).await;
    assert_eq!(s, 200);
    assert!(r["reservierung"]["seit"].as_str().unwrap() >= seit.as_str(), "verlängert");
}

#[tokio::test]
async fn freigeben_eigene_mensch_ja_fremder_agent_nein() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let a = &lauf.adresse;
    als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("A"), json!(null)).await;
    assert_eq!(als(Method::DELETE, a, "api/aufgaben/1/reservierung", "cl", Some("B"), json!(null)).await.0, 409);
    let (s, r) = als(Method::DELETE, a, "api/aufgaben/1/reservierung", "st", None, json!(null)).await;
    assert_eq!((s, r["reservierung"].is_null()), (200, true), "ein Mensch gibt jede frei");
    assert!(!lies(tmp.path(), "aufgaben/0001-eins.md").contains("reservation"));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#1 freigegeben (war Claude · Instanz A)");
    assert_eq!(als(Method::DELETE, a, "api/aufgaben/1/reservierung", "st", None, json!(null)).await.0, 404);
    als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("A"), json!(null)).await;
    assert_eq!(als(Method::DELETE, a, "api/aufgaben/1/reservierung", "cl", Some("A"), json!(null)).await.0, 200, "die eigene Instanz");
}

#[tokio::test]
async fn instanz_ist_pflicht_und_geprueft_auch_als_feld() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let a = &lauf.adresse;
    assert_eq!(als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", None, json!(null)).await.0, 400);
    assert_eq!(als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("mit leer"), json!(null)).await.0, 400);
    let (s, r) = als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", None, json!({"instanz": "F-1"})).await;
    assert_eq!((s, r["reservierung"]["instanz"].as_str()), (200, Some("F-1")));
}

#[tokio::test]
async fn fremde_reservierung_sperrt_nur_reservieren_und_archiv_entfernt_sie() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let a = &lauf.adresse;
    als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("A"), json!(null)).await;
    assert_eq!(als(Method::POST, a, "api/aufgaben/1/kommentare", "cl", Some("B"), json!({"text": "Hallo"})).await.0, 200);
    assert_eq!(als(Method::POST, a, "api/aufgaben/1/zeiten", "cl", Some("B"), json!({"dauer": "0:30"})).await.0, 200);
    assert_eq!(als(Method::POST, a, "api/boards/entwicklung/bewegen", "cl", Some("B"), json!({"nummer": 1, "spalte": "In Arbeit"})).await.0, 200);
    let (s, r) = senden(Method::POST, a, "api/aufgaben/1/archivieren", "st", json!(null)).await;
    assert_eq!((s, r["reservierung"].is_null()), (200, true));
    assert!(!lies(tmp.path(), "aufgaben/0001-eins.md").contains("reservation"));
}
