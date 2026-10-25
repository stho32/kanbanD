// R00094 Durchläufe als Daten
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn durchlauf_eintragen_schreibt_block_und_kommentar_in_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher: u32 = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();
    let (s, r) = senden(Method::POST, a, "api/aufgaben/2/durchlaeufe", "st", json!({"phase": "Entwicklung", "ergebnis": "bestanden", "dauer": "1:43", "text": "Gate grün", "wer": "cl"})).await;
    assert_eq!(s, 200, "{r}");
    let d = &r["durchlaeufe"][0];
    assert_eq!((d["phase"].as_str(), d["ergebnis"].as_str(), d["wer"].as_str(), d["dauer_minuten"].as_i64(), d["text"].as_str()), (Some("Entwicklung"), Some("bestanden"), Some("cl"), Some(103), Some("Gate grün")));
    assert!(d["zeitpunkt"].as_str().unwrap().ends_with(":00") && d["zeitpunkt"].as_str().unwrap().contains('+'), "mit Versatz");
    let datei = lies(tmp.path(), "aufgaben/0002-zwei.md");
    assert!(datei.contains(" · Entwicklung · bestanden · cl · 1:43 · Gate grün\n```"), "{datei}");
    assert_eq!(r["kommentare"][0]["text"], "Entwicklung bestanden (cl, 1:43): Gate grün");
    assert_eq!(r["kommentare"][0]["wer"], "st", "der Kommentar ist von der handelnden Person");
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap(), vorher + 1, "ein Commit");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#2 Durchlauf: Entwicklung bestanden (Claude)");
    // ohne Dauer, ohne Text, ohne wer; Zeilenumbruch und Trenner im Text
    let (_, r) = senden(Method::POST, a, "api/aufgaben/2/durchlaeufe", "st", json!({"phase": "Code-Review", "ergebnis": "befund", "text": "zwei · Punkte\nund mehr"})).await;
    assert_eq!((r["durchlaeufe"][1]["wer"].as_str(), r["durchlaeufe"][1]["text"].as_str(), r["durchlaeufe"][1]["dauer_minuten"].is_null()), (Some("st"), Some("zwei · Punkte und mehr"), true));
    assert_eq!(r["kommentare"][1]["text"], "Code-Review befund (st): zwei · Punkte und mehr");
    let (_, wieder) = senden(Method::GET, a, "api/aufgaben/2", "st", json!(null)).await;
    assert_eq!(wieder["durchlaeufe"], r["durchlaeufe"], "Rundlauf über die Datei");
}

#[tokio::test]
async fn durchlauf_regeln() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let post = |d: serde_json::Value| senden(Method::POST, a, "api/aufgaben/1/durchlaeufe", "st", d);
    let (s, f) = post(json!({"phase": "Entwicklung", "ergebnis": "ok"})).await;
    assert_eq!(s, 400);
    assert!(f["fehler"].as_str().unwrap().contains("bestanden, befund oder entfaellt"), "{f}");
    assert_eq!(post(json!({"phase": " ", "ergebnis": "befund"})).await.0, 400);
    assert_eq!(post(json!({"phase": "x".repeat(41), "ergebnis": "befund"})).await.0, 400);
    assert_eq!(post(json!({"phase": "E", "ergebnis": "befund", "dauer": "x"})).await.0, 400);
    assert_eq!(post(json!({"phase": "E", "ergebnis": "befund", "wer": "xyz"})).await.0, 400);
    assert_eq!(post(json!({"phase": "E · F", "ergebnis": "befund"})).await.0, 400, "der Trenner gehört nicht in die Phase");
    assert_eq!(post(json!({"phase": "E", "ergebnis": "entfaellt"})).await.0, 200);
}
