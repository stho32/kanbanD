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

fn nummern(r: &Value) -> Vec<u64> {
    let mut n: Vec<u64> = r["aufgaben"].as_array().unwrap_or_else(|| panic!("keine Liste: {r}")).iter().map(|a| a["nummer"].as_u64().unwrap()).collect();
    n.sort();
    n
}

async fn getroffen(adresse: &str, abfrage: &str) -> Vec<u64> {
    let (s, r) = lesen(adresse, &format!("api/aufgaben?{abfrage}")).await;
    assert_eq!(s, 200, "{abfrage}: {r}");
    nummern(&r)
}

/// #1 `[nc:304, repo:shop]` (nc:304 über PATCH), #2 `[nc:305]` (beim Anlegen), #3 ohne Labels.
#[tokio::test]
async fn rundreise_ueber_neustart_und_archiv() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let a = &lauf.adresse;
    let (s, eins) = senden(Method::POST, a, "api/aufgaben", "st", json!({"titel": "eins", "labels": ["repo:shop"]})).await;
    assert_eq!(s, 201, "{eins}");
    let (s, zwei) = senden(Method::POST, a, "api/aufgaben", "st", json!({"titel": "zwei", "labels": ["nc:305"]})).await;
    assert_eq!(s, 201, "{zwei}");
    let (s, drei) = senden(Method::POST, a, "api/aufgaben", "st", json!({"titel": "drei"})).await;
    assert_eq!(s, 201, "{drei}");
    assert_eq!([&eins, &zwei, &drei].map(|x| x["nummer"].as_u64().unwrap()), [1, 2, 3]);
    let (s, r) = senden(Method::PATCH, a, "api/aufgaben/1", "st", json!({"labels": ["nc:304", "repo:shop"]})).await;
    assert_eq!(s, 200, "{r}");
    drop(lauf);

    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    assert_eq!(lesen(a, "api/aufgaben/1").await.1["labels"], json!(["nc:304", "repo:shop"]), "nach dem Neustart unverändert");
    assert_eq!(getroffen(a, "label=nc:304").await, vec![1]);
    assert_eq!(getroffen(a, "label=nc:304&label=nc:305").await, vec![1, 2]);
    assert_eq!(getroffen(a, "label=nc:304&label=repo:shop").await, vec![1]);
    assert_eq!(getroffen(a, "label=NC:304").await, vec![1]);
    assert_eq!(getroffen(a, "label=nc:*").await, vec![1, 2]);
    assert_eq!(getroffen(a, "label=repo:*").await, vec![1]);
    assert_eq!(getroffen(a, "label=*").await, vec![1, 2], "nicht die ohne Label");
    assert_eq!(getroffen(a, "label=").await, Vec::<u64>::new(), "leerer Wert trifft nichts, kein 400");

    let (s, r) = senden(Method::POST, a, "api/aufgaben/1/archivieren", "st", json!(null)).await;
    assert_eq!(s, 200, "{r}");
    assert_eq!(getroffen(a, "label=nc:304").await, Vec::<u64>::new());
    assert_eq!(getroffen(a, "label=nc:304&archivierte=ja").await, vec![1]);
}
