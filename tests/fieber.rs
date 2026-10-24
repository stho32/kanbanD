//! R00078: Projekt-Fever-Chart — Projektstart, Einstellungen und Zieltermin am Board, Cache unter „kanbanD“.
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

/// Ohne X-KanbanD-Wer — der Cache braucht keine Identität.
async fn anonym(methode: Method, adresse: &str, pfad: &str, daten: serde_json::Value) -> (u16, serde_json::Value) {
    let r = reqwest::Client::new().request(methode, format!("{adresse}{pfad}")).json(&daten).send().await.unwrap();
    let s = r.status().as_u16();
    (s, r.json().await.unwrap_or(serde_json::Value::Null))
}

fn tag(datum: &str, ende: Option<&str>) -> serde_json::Value {
    json!({"datum": datum, "erledigt": 1, "umfang": 4, "ende7": [ende, ende, ende, ende], "ende5": [ende, ende, ende, ende]})
}

fn commits(tmp: &tempfile::TempDir) -> u32 {
    git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

#[tokio::test]
async fn start_und_einstellungen_im_frontmatter_je_ein_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let (s, v) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/start", "st", json!({"start": "2026-09-01"})).await;
    assert_eq!((s, v["geaendert"].as_bool()), (200, Some(true)));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|Projektstart von „Entwicklung“: 01.09.2026");
    let f = json!({"puffer": 20, "perzentil": 95, "woche": 5, "gelb": [10, 70], "rot": [20, 95]});
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/fieber", "st", f.clone()).await;
    assert_eq!(s, 200);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "Fever Chart von „Entwicklung“ eingestellt: Puffer 20 Arbeitstage, P95");
    let text = lies(tmp.path(), "boards/entwicklung.md");
    assert!(text.starts_with("---\nstart: 2026-09-01\nfever: {buffer: 20, red: [20, 95]}\n---\n"), "nur Abweichendes vom Standard: {text}");
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!(b["start"], json!("2026-09-01"));
    assert_eq!(b["fieber"], json!({"puffer": 20, "perzentil": 95, "woche": 5, "gelb": [10, 70], "rot": [20, 95], "zielspalte": null, "aufloesung": 1}));
    let vorher = commits(&tmp);
    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/fieber", "st", f).await;
    assert_eq!(commits(&tmp), vorher, "unverändert: kein Commit");
    for falsch in [json!({"puffer": 0}), json!({"perzentil": 60}), json!({"woche": 6}), json!({"gelb": [40, 70], "rot": [30, 100]})] {
        assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/fieber", "st", falsch.clone()).await.0, 400, "{falsch}");
    }
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/start", "st", json!({"start": "1.9.2026"})).await.0, 400);
    // R00079: Zielspalte
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/fieber", "st", json!({"puffer": 20, "rot": [20, 95], "zielspalte": " In Arbeit "})).await;
    assert_eq!(s, 200);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "Fever Chart von „Entwicklung“ eingestellt: Puffer 20 Arbeitstage, P95, erledigt heißt „In Arbeit“");
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("fever: {buffer: 20, red: [20, 95], target-column: In Arbeit}\n"));
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/fieber", "st", json!({"zielspalte": " "})).await.0, 400);
    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/fieber", "st", json!({"puffer": 20, "rot": [20, 95], "zielspalte": null})).await;
    // R00080: Auflösung
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/fieber", "st", json!({"puffer": 20, "rot": [20, 95], "aufloesung": 7})).await.0, 200);
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("fever: {buffer: 20, red: [20, 95], resolution: week}\n"));
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/fieber", "st", json!({"aufloesung": 5})).await.0, 400);
    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/fieber", "st", json!({"puffer": 20, "rot": [20, 95]})).await;
    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/start", "st", json!({"start": null})).await;
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "Projektstart von „Entwicklung“ entfernt");
    assert!(!lies(tmp.path(), "boards/entwicklung.md").contains("start:"));
    let (s, _) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "x", "board": "entwicklung"})).await;
    assert_eq!(s, 201);
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("fever: {buffer: 20, red: [20, 95]}"), "Anlegen erhält die Einstellungen");
}

#[tokio::test]
async fn hoechstens_ein_zieltermin() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let t = |name: &str, ziel: bool| json!({"name": name, "datum": "2027-10-31", "farbe": "red", "ziel": ziel});
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/termine", "st", json!([t("Deadline", false), t("Review", false)])).await;
    assert_eq!(s, 200);
    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/termine", "st", json!([t("Deadline", true), t("Review", false)])).await;
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "Zieltermin von „Entwicklung“: „Deadline“ (31.10.2027)");
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("  - {name: Deadline, date: 2027-10-31, color: red, line: solid, width: normal, target: true}\n"));
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!((b["termine"][0]["ziel"].clone(), b["termine"][1]["ziel"].clone()), (json!(true), json!(false)));
    let (s, f) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/termine", "st", json!([t("Deadline", true), t("Review", true)])).await;
    assert_eq!(s, 400, "{f}");
}

#[tokio::test]
async fn cache_ergaenzen_ohne_identitaet_nur_vor_heute_und_verwerfen() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let (s, v) = anonym(Method::GET, &lauf.adresse, "api/boards/entwicklung/fieber/cache", json!(null)).await;
    assert_eq!((s, v), (200, json!({"abschnitte": []})));
    let schluessel = r#"{"start":"2026-09-01","filter":{}}"#;
    let (s, v) = anonym(Method::POST, &lauf.adresse, "api/boards/entwicklung/fieber/cache", json!({"schluessel": schluessel, "tage": [tag("2026-09-02", Some("2026-10-01")), tag("2026-09-01", None)]})).await;
    assert_eq!((s, v["neu"].clone()), (200, json!(2)));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "kanbanD|Fever Chart „Entwicklung“: 2 Tage ergänzt");
    let text = lies(tmp.path(), "berichte/entwicklung-fieber.md");
    assert!(text.contains(&format!("\n## {schluessel}\n\n| Tag |")), "{text}");
    assert!(text.find("| 2026-09-01 | 1 | 4 | — |").unwrap() < text.find("| 2026-09-02 | 1 | 4 | 2026-10-01 |").unwrap(), "nach Datum sortiert: {text}");
    let vorher = commits(&tmp);
    let (_, v) = anonym(Method::POST, &lauf.adresse, "api/boards/entwicklung/fieber/cache", json!({"schluessel": schluessel, "tage": [tag("2026-09-02", Some("2027-01-01"))]})).await;
    assert_eq!((v["neu"].clone(), commits(&tmp)), (json!(0), vorher), "vorhandene Tage bleiben, kein Commit");
    assert!(lies(tmp.path(), "berichte/entwicklung-fieber.md").contains("| 2026-09-02 | 1 | 4 | 2026-10-01 |"));
    let heute = chrono::Local::now().format("%Y-%m-%d").to_string();
    let (s, f) = anonym(Method::POST, &lauf.adresse, "api/boards/entwicklung/fieber/cache", json!({"schluessel": schluessel, "tage": [tag(&heute, None)]})).await;
    assert_eq!(s, 400, "der heutige Tag kommt nie in den Cache: {f}");
    assert_eq!(anonym(Method::POST, &lauf.adresse, "api/boards/entwicklung/fieber/cache", json!({"schluessel": "a\nb", "tage": []})).await.0, 400);
    let (_, v) = anonym(Method::GET, &lauf.adresse, "api/boards/entwicklung/fieber/cache", json!(null)).await;
    assert_eq!(v["abschnitte"][0]["tage"][1]["ende7"][0], "2026-10-01");
    let (s, v) = anonym(Method::DELETE, &lauf.adresse, "api/boards/entwicklung/fieber/cache", json!(null)).await;
    assert_eq!((s, v["verworfen"].clone()), (200, json!(true)));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "kanbanD|Fever Chart „Entwicklung“: Cache verworfen");
    assert!(!tmp.path().join("berichte/entwicklung-fieber.md").exists());
    let (_, v) = anonym(Method::GET, &lauf.adresse, "api/boards/entwicklung/fieber/cache", json!(null)).await;
    assert_eq!(v, json!({"abschnitte": []}));
    assert_eq!(anonym(Method::GET, &lauf.adresse, "api/boards/gibtsnicht/fieber/cache", json!(null)).await.0, 404);
}
