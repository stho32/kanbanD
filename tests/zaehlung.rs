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
