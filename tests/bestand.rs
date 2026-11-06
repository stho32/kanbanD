//! R00100 B0350: Achsen des Berichts „Bestand nach Labels“ im Frontmatter des Boards, ein Commit je Änderung.
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

const BOARD: &str = "boards/entwicklung.md";
const PFAD: &str = "api/boards/entwicklung/bestand";

fn commits(pfad: &std::path::Path) -> String {
    git(pfad, &["rev-list", "--count", "HEAD"])
}

#[tokio::test]
async fn rundreise_get_put_get_mit_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!(b["bestand"], json!(null), "ohne report-labels");
    let vorher: u32 = commits(tmp.path()).parse().unwrap();
    let (s, v) = senden(Method::PUT, &lauf.adresse, PFAD, "st", json!({"zeilen": "nc", "spalten": "repo"})).await;
    assert_eq!((s, v["geaendert"].as_bool()), (200, Some(true)), "{v}");
    assert_eq!(commits(tmp.path()).parse::<u32>().unwrap(), vorher + 1, "genau ein Commit");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|Achsen des Bestands von „Entwicklung“: nc × repo");
    assert!(lies(tmp.path(), BOARD).contains("\nreport-labels: {rows: nc, columns: repo}\n"), "{}", lies(tmp.path(), BOARD));
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!(b["bestand"], json!({"zeilen": "nc", "spalten": "repo"}));
    let (s, v) = senden(Method::PUT, &lauf.adresse, PFAD, "st", json!({"zeilen": "nc", "spalten": "repo"})).await;
    assert_eq!((s, v["geaendert"].as_bool()), (200, Some(false)), "gleiche Achsen");
    assert_eq!(commits(tmp.path()).parse::<u32>().unwrap(), vorher + 1, "gleiche Achsen: kein Commit");
    senden(Method::PUT, &lauf.adresse, PFAD, "st", json!({"zeilen": "repo", "spalten": "nc"})).await;
    assert_eq!(commits(tmp.path()).parse::<u32>().unwrap(), vorher + 2, "Tausch: ein Commit");
    assert!(lies(tmp.path(), BOARD).contains("\nreport-labels: {rows: repo, columns: nc}\n"));
}

#[tokio::test]
async fn fehlfaelle_ohne_commit_und_ohne_aenderung_der_datei() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    senden(Method::PUT, &lauf.adresse, PFAD, "st", json!({"zeilen": "repo", "spalten": "nc"})).await;
    let (datei, anzahl) = (lies(tmp.path(), BOARD), commits(tmp.path()));
    for (koerper, grund) in [
        (json!({"zeilen": "nc", "spalten": "nc"}), "gleiche Präfixe"),
        (json!({"zeilen": "nc", "spalten": "NC"}), "gleich ohne Groß/Klein"),
        (json!({"zeilen": "", "spalten": "nc"}), "leerer Präfix"),
        (json!({"zeilen": "nc", "spalten": "  "}), "nur Leerzeichen"),
        (json!({"zeilen": "repo:x", "spalten": "nc"}), "Doppelpunkt im Präfix"),
        (json!({"zeilen": "repo", "spalten": "nc:"}), "Doppelpunkt am Ende"),
    ] {
        let (s, v) = senden(Method::PUT, &lauf.adresse, PFAD, "st", koerper).await;
        assert_eq!(s, 400, "{grund}: {v}");
        assert_eq!((lies(tmp.path(), BOARD), commits(tmp.path())), (datei.clone(), anzahl.clone()), "{grund}");
    }
    let (s, v) = senden(Method::PUT, &lauf.adresse, "api/boards/gibtsnicht/bestand", "st", json!({"zeilen": "nc", "spalten": "repo"})).await;
    assert_eq!(s, 404, "{v}");
    assert!(v["fehler"].as_str().unwrap_or_default().contains("gibtsnicht"), "{v}");
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/boards/..%2Fkanband/bestand", "st", json!({"zeilen": "nc", "spalten": "repo"})).await;
    assert_eq!(s, 400, "Board-Name aus Ordner::board geprüft");
    assert_eq!(commits(tmp.path()), anzahl, "404 und 400: kein Commit");
    assert_eq!(lies(tmp.path(), BOARD), datei);
}
