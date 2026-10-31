// R00095 Label-Filter in der API
mod gemeinsam;

use gemeinsam::senden;
use reqwest::Method;
use serde_json::{Value, json};

const HINWEIS_STERN: &str = "Ein Label, das auf * endet, wird über sein Präfix gefunden und trifft dann auch längere Labels.";

async fn lesen(adresse: &str, pfad: &str) -> (u16, Value) {
    senden(Method::GET, adresse, pfad, "st", json!(null)).await
}

#[tokio::test]
async fn beschreibung_nennt_label() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let a = &lauf.adresse;

    let (s, f) = lesen(a, "api/aufgaben?farbe=x").await;
    assert_eq!(s, 400);
    assert!(f["fehler"].as_str().unwrap().contains("label"), "{f}");

    let (_, d) = lesen(a, "api/openapi.json").await;
    let parameter = d["paths"]["/api/aufgaben"]["get"]["parameters"].as_array().unwrap();
    let label = parameter.iter().find(|p| p["name"] == "label").unwrap_or_else(|| panic!("Query-Parameter label fehlt: {parameter:?}"));
    assert_eq!(label["in"], "query");
    assert!(label["description"].as_str().unwrap().contains(HINWEIS_STERN), "{label}");
    assert!(d["paths"]["/api/aufgaben"]["get"]["description"].as_str().unwrap().contains("label"));

    let (_, liste) = lesen(a, "api/endpunkte").await;
    let eintrag = liste.as_array().unwrap().iter().find(|e| e["methode"] == "GET" && e["pfad"] == "/api/aufgaben").unwrap();
    let zweck = eintrag["zweck"].as_str().unwrap();
    assert!(zweck.contains("label=") && zweck.contains(HINWEIS_STERN), "{zweck}");
}
