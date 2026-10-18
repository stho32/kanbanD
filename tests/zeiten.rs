mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

fn mit_zeiten(pfad: &std::path::Path) {
    gemeinsam::mit_drei_aufgaben(pfad);
    std::fs::write(pfad.join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\n---\n```kanbanD-time\n2026-10-17 09:00 · 2026-10-17 11:00 · cl\n2026-10-18 08:00 · ... · st\n```\n").unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "zeiten"]);
}

#[tokio::test]
async fn nachtragen_endet_jetzt() {
    let tmp = tempfile::tempdir().unwrap();
    mit_zeiten(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben/1/zeiten", "st", json!({"dauer": "1:30"})).await;
    assert_eq!(s, 200);
    let z = &a["zeiten"][2];
    let (b, e) = (z["beginn"].as_str().unwrap(), z["ende"].as_str().unwrap());
    assert_eq!(kanband::uhr::minuten(b, e), Some(90));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#1 Zeit nachgetragen: 1:30 (Stefan)");
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/aufgaben/1/zeiten", "st", json!({"dauer": "x"})).await.0, 400);
}

#[tokio::test]
async fn korrigieren_und_regeln() {
    let tmp = tempfile::tempdir().unwrap();
    mit_zeiten(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (s, _) = senden(Method::PATCH, a, "api/aufgaben/1/zeiten/0", "st", json!({"ende": "2026-10-17 10:00"})).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").contains("2026-10-17 09:00 · 2026-10-17 10:00 · cl"));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#1 Zeit korrigiert (Claude)");
    assert_eq!(senden(Method::PATCH, a, "api/aufgaben/1/zeiten/0", "st", json!({"ende": "2026-10-17 08:00"})).await.0, 400);
    assert_eq!(senden(Method::PATCH, a, "api/aufgaben/1/zeiten/0", "st", json!({"beginn": "gestern"})).await.0, 400);
    assert_eq!(senden(Method::PATCH, a, "api/aufgaben/1/zeiten/1", "st", json!({"ende": "2026-10-18 09:00"})).await.0, 400);
    assert_eq!(senden(Method::PATCH, a, "api/aufgaben/1/zeiten/1", "st", json!({"beginn": "2026-10-18 07:30"})).await.0, 200);
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").contains("2026-10-18 07:30 · ... · st"));
    assert_eq!(senden(Method::PATCH, a, "api/aufgaben/1/zeiten/9", "st", json!({})).await.0, 404);
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    senden(Method::PATCH, a, "api/aufgaben/1/zeiten/0", "st", json!({})).await;
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
}

#[tokio::test]
async fn loeschen_nur_beendete() {
    let tmp = tempfile::tempdir().unwrap();
    mit_zeiten(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    assert_eq!(senden(Method::DELETE, &lauf.adresse, "api/aufgaben/1/zeiten/1", "st", json!(null)).await.0, 409);
    assert_eq!(senden(Method::DELETE, &lauf.adresse, "api/aufgaben/1/zeiten/0", "st", json!(null)).await.0, 200);
    assert!(!lies(tmp.path(), "aufgaben/0001-eins.md").contains("· cl"));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1 Zeit gelöscht (Claude, 2:00)");
}
