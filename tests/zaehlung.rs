//! R00060: Zählen in Berichten je Aufgabe — `reporting.burndown` und `reporting.forecast`.
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

fn starten(tmp: &tempfile::TempDir) -> gemeinsam::Laufendes {
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::write(tmp.path().join("aufgaben/0002-zwei.md"), "---\nid: 2\ntitle: zwei\nreporting: {forecast: false, cycle-time: true}\n---\n").unwrap();
    git(tmp.path(), &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-am", "#2 ausgenommen"]);
    gemeinsam::starten(tmp.path(), &["--port", "0"])
}

#[tokio::test]
async fn patch_setzt_und_entfernt_je_aenderung_ein_commit_unbekanntes_bleibt() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let (s, a) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/2", "st", json!({"reporting": {"forecast": null}})).await;
    assert_eq!((s, a["reporting"].clone()), (200, json!({})));
    assert_eq!(lies(tmp.path(), "aufgaben/0002-zwei.md"), "---\nid: 2\ntitle: zwei\nreporting:\n  cycle-time: true\n---\n");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#2 geändert: Zählen in Berichten");
    let vorher = git(tmp.path(), &["rev-list", "--count", "HEAD"]);
    let (_, a) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/2", "st", json!({"reporting": {"burndown": false}})).await;
    assert_eq!(a["reporting"], json!({"burndown": false}));
    assert!(lies(tmp.path(), "aufgaben/0002-zwei.md").contains("reporting:\n  burndown: false\n  cycle-time: true\n"));
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap(), vorher.parse::<u32>().unwrap() + 1);
    let gleich = git(tmp.path(), &["rev-parse", "HEAD"]);
    senden(Method::PATCH, &lauf.adresse, "api/aufgaben/2", "st", json!({"reporting": {"burndown": false}})).await;
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), gleich, "ohne Änderung kein Commit");
}

#[tokio::test]
async fn bewegungen_nennen_je_aufgabe_reporting() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let v: serde_json::Value = reqwest::get(format!("{}api/berichte/bewegungen?board=entwicklung", lauf.adresse)).await.unwrap().json().await.unwrap();
    let je: Vec<(u64, serde_json::Value)> = v["aufgaben"].as_array().unwrap().iter().map(|a| (a["nummer"].as_u64().unwrap(), a["reporting"].clone())).collect();
    assert_eq!(je, [(1, json!({})), (2, json!({"forecast": false})), (3, json!({}))]);
}

#[tokio::test]
async fn ungueltiger_wert_wird_abgelehnt_die_datei_bleibt() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let vorher = lies(tmp.path(), "aufgaben/0002-zwei.md");
    let (s, _) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/2", "st", json!({"reporting": {"forecast": "nein"}})).await;
    assert!((400..500).contains(&s), "{s}");
    assert_eq!(lies(tmp.path(), "aufgaben/0002-zwei.md"), vorher);
    let (s, a) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/1", "st", json!({"reporting": {"burndown": null}})).await;
    assert_eq!((s, a["reporting"].clone()), (200, json!({})), "entfernen, was fehlt, ändert nichts");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#2 ausgenommen");
}
