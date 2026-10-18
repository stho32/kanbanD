mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};

async fn einstellungen(adresse: &str) -> Value {
    senden(Method::GET, adresse, "api/zustand", "st", json!(null)).await.1["einstellungen"].clone()
}

#[tokio::test]
async fn person_und_klasse_hinzufuegen_in_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let mut e = einstellungen(&lauf.adresse).await;
    e["personen"].as_array_mut().unwrap().push(json!({"kuerzel": "mi", "name": "Mia", "art": "human", "aktiv": true}));
    e["klassen"].as_array_mut().unwrap().push(json!({"schluessel": "doku", "bezeichnung": "Doku", "farbe": "teal"}));
    let (s, r) = senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", e.clone()).await;
    assert_eq!((s, r["geaendert"].as_bool()), (200, Some(true)));
    let datei = lies(tmp.path(), "kanbanD.md");
    assert!(datei.contains("  mi: {name: Mia, kind: human}\n"));
    assert!(datei.contains("  doku: {label: Doku, color: teal}\n"));
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=%an|%s", "HEAD"]), "Stefan|Einstellungen geändert\n\nkanbanD.md");
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    let (_, r) = senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", e).await;
    assert_eq!(r["geaendert"], false);
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
}

#[tokio::test]
async fn entfernen_ist_konflikt_falsches_ist_400() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let e = einstellungen(&lauf.adresse).await;
    let mut ohne = e.clone();
    ohne["personen"].as_array_mut().unwrap().retain(|p| p["kuerzel"] != "cl");
    let (s, f) = senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", ohne).await;
    assert_eq!(s, 409);
    assert!(f["fehler"].as_str().unwrap().contains("stillgelegt"));
    let mut farbe = e.clone();
    farbe["klassen"][0]["farbe"] = json!("lila");
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", farbe).await.0, 400);
    let mut kuerzel = e;
    kuerzel["personen"].as_array_mut().unwrap().push(json!({"kuerzel": "M!", "name": "x", "art": "human", "aktiv": true}));
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", kuerzel).await.0, 400);
}

#[tokio::test]
async fn stilllegen_sperrt_die_person_fuer_schreibende_aufrufe() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let mut e = einstellungen(&lauf.adresse).await;
    e["personen"][1]["aktiv"] = json!(false);
    senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", e).await;
    assert!(lies(tmp.path(), "kanbanD.md").contains("cl: {name: Claude, kind: agent, active: false}"));
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/aufgaben", "cl", json!({"titel": "x"})).await.0, 400);
}
