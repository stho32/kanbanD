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

// R00091: lesen in der Form, die PUT annimmt — zurückgeschrieben ändert sich nichts
#[tokio::test]
async fn einstellungen_lesen_und_unveraendert_zurueck() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let (s, e) = senden(Method::GET, &lauf.adresse, "api/einstellungen", "st", json!(null)).await;
    assert_eq!(s, 200);
    assert_eq!(e, einstellungen(&lauf.adresse).await);
    assert!(e["personen"].is_array() && e["klassen"].is_array() && e["signale"].is_array() && e["quellen"].is_object());
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    let (s, r) = senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", e).await;
    assert_eq!((s, r["geaendert"].as_bool()), (200, Some(false)));
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
}

// R00091: eine Person anlegen, ändern und stilllegen, ohne Klassen, Signale oder andere Personen zu berühren
#[tokio::test]
async fn personen_einzeln_pflegen() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let a = &lauf.adresse;
    let vorher = einstellungen(a).await;
    let (s, p) = senden(Method::POST, a, "api/personen", "st", json!({"kuerzel": "crev", "name": "Code-Reviewer", "art": "agent"})).await;
    assert_eq!(s, 201, "{p}");
    assert_eq!(p, json!({"kuerzel": "crev", "name": "Code-Reviewer", "art": "agent", "aktiv": true}));
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=%an|%s", "HEAD"]), "Stefan|Person „Code-Reviewer“ (crev) angelegt\n\nkanbanD.md");
    assert_eq!(senden(Method::POST, a, "api/personen", "st", json!({"kuerzel": "crev", "name": "Noch einer", "art": "agent"})).await.0, 409);
    assert_eq!(senden(Method::POST, a, "api/personen", "st", json!({"kuerzel": "Crev!", "name": "X", "art": "agent"})).await.0, 400);
    assert_eq!(senden(Method::POST, a, "api/personen", "st", json!({"kuerzel": "leer", "name": " ", "art": "agent"})).await.0, 400);
    let (s, p) = senden(Method::PATCH, a, "api/personen/crev", "st", json!({"name": "Reviewer"})).await;
    assert_eq!((s, p["name"].as_str()), (200, Some("Reviewer")));
    let nachher = einstellungen(a).await;
    assert_eq!((&nachher["klassen"], &nachher["signale"], &nachher["quellen"]), (&vorher["klassen"], &vorher["signale"], &vorher["quellen"]));
    assert_eq!(nachher["personen"].as_array().unwrap().len(), vorher["personen"].as_array().unwrap().len() + 1);
    assert!(vorher["personen"].as_array().unwrap().iter().all(|p| nachher["personen"].as_array().unwrap().contains(p)), "andere Personen unverändert");
    let stand = git(tmp.path(), &["rev-parse", "HEAD"]);
    senden(Method::PATCH, a, "api/personen/crev", "st", json!({"name": "Reviewer"})).await;
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), stand, "ohne Änderung kein Commit");
    let (s, p) = senden(Method::DELETE, a, "api/personen/crev", "st", json!(null)).await;
    assert_eq!((s, p["aktiv"].as_bool()), (200, Some(false)));
    let (_, liste) = senden(Method::GET, a, "api/personen", "st", json!(null)).await;
    assert!(liste["personen"].as_array().unwrap().iter().any(|p| p["kuerzel"] == "crev" && p["aktiv"] == false), "bleibt in der Liste");
    assert_eq!(senden(Method::PATCH, a, "api/personen/xyz", "st", json!({"name": "X"})).await.0, 404);
    assert_eq!(senden(Method::DELETE, a, "api/personen/xyz", "st", json!(null)).await.0, 404);
}
