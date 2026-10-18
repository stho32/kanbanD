mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn mehrere_aufgaben_in_einem_commit_in_reihenfolge() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let vorher: u32 = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "st", json!({"titel": ["Login", "Logout", "Passwort vergessen"], "board": "entwicklung"})).await;
    assert_eq!(s, 201);
    assert_eq!(a.as_array().unwrap().iter().map(|x| x["nummer"].as_u64().unwrap()).collect::<Vec<_>>(), vec![1, 2, 3]);
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap(), vorher + 1);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1–#3 angelegt (3 Aufgaben) in „Zu erledigen“ (Entwicklung)");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=", "HEAD"]).lines().count(), 4);
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("- [#1](../aufgaben/0001-login.md)\n- [#2](../aufgaben/0002-logout.md)\n- [#3](../aufgaben/0003-passwort-vergessen.md)\n"));
    for daten in [json!({"titel": []}), json!({"titel": ["a", " "]})] {
        assert_eq!(senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "st", daten).await.0, 400);
    }
    assert!(!tmp.path().join("aufgaben/0004-a.md").exists());
}

#[tokio::test]
async fn mehrere_teilaufgaben_in_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben/1/teilaufgaben/mehrere", "st", json!({"texte": ["a", "b", "c"]})).await;
    assert_eq!((s, a["teilaufgaben"].as_array().unwrap().len()), (200, 3));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1 3 Teilaufgaben ergänzt");
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/aufgaben/1/teilaufgaben/mehrere", "st", json!({"texte": []})).await.0, 400);
}

#[tokio::test]
async fn angaben_beim_anlegen_werden_geprueft_und_gesetzt() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "Login", "board": "entwicklung", "klasse": "bug", "zustaendige": ["cl"], "labels": ["ui"], "faellig": "2026-10-19", "herkunft": ["I0007"]})).await;
    assert_eq!(s, 201, "{a}");
    assert_eq!(lies(tmp.path(), "aufgaben/0001-login.md"), "---\nid: 1\ntitle: Login\nclass: bug\nassignees: [cl]\nlabels: [ui]\ndue: 2026-10-19\norigins: [I0007]\n---\n");
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "st", json!({"titel": ["nur Titel", {"titel": "Tests", "zustaendige": ["st"]}]})).await;
    assert_eq!(s, 201);
    assert_eq!(a[1]["zustaendige"], json!(["st"]));
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    let (s, f) = senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "st", json!({"titel": ["gut", {"titel": "schlecht", "klasse": "gibtsnicht"}]})).await;
    assert_eq!(s, 400);
    assert!(f["fehler"].as_str().unwrap().contains("„schlecht“"));
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
    assert!(!tmp.path().join("aufgaben/0004-gut.md").exists());
}
