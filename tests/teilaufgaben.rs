mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn anlegen_abhaken_aendern_entfernen() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    senden(Method::POST, a, "api/aufgaben/1/teilaufgaben", "st", json!({"text": "a"})).await;
    senden(Method::POST, a, "api/aufgaben/1/teilaufgaben", "st", json!({"text": "b"})).await;
    let (s, r) = senden(Method::PATCH, a, "api/aufgaben/1/teilaufgaben/0", "st", json!({"erledigt": true})).await;
    assert_eq!((s, r["teilaufgaben"][0]["erledigt"].as_bool()), (200, Some(true)));
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").ends_with("---\n\n- [x] a\n- [ ] b\n"));
    assert_eq!(git(tmp.path(), &["log", "-3", "--format=%s"]), "#1 Teilaufgabe „a“ erledigt\n#1 Teilaufgabe „b“ ergänzt\n#1 Teilaufgabe „a“ ergänzt");
    senden(Method::PATCH, a, "api/aufgaben/1/teilaufgaben/0", "st", json!({"erledigt": false})).await;
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1 Teilaufgabe „a“ wieder offen");
    senden(Method::PATCH, a, "api/aufgaben/1/teilaufgaben/0", "st", json!({"text": "A"})).await;
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1 Teilaufgabe „A“ geändert");
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    senden(Method::PATCH, a, "api/aufgaben/1/teilaufgaben/0", "st", json!({})).await;
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
    senden(Method::DELETE, a, "api/aufgaben/1/teilaufgaben/1", "st", json!(null)).await;
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").ends_with("- [ ] A\n"));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1 Teilaufgabe „b“ entfernt");
}

#[tokio::test]
async fn fehlerfaelle() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    assert_eq!(senden(Method::POST, a, "api/aufgaben/1/teilaufgaben", "st", json!({"text": " "})).await.0, 400);
    assert_eq!(senden(Method::PATCH, a, "api/aufgaben/1/teilaufgaben/5", "st", json!({"erledigt": true})).await.0, 404);
    assert_eq!(senden(Method::DELETE, a, "api/aufgaben/1/teilaufgaben/0", "st", json!(null)).await.0, 404);
    assert_eq!(senden(Method::PATCH, a, "api/aufgaben/1/teilaufgaben/0", "st", json!({"text": ""})).await.0, 400);
    assert_eq!(senden(Method::POST, a, "api/aufgaben/9/teilaufgaben", "st", json!({"text": "x"})).await.0, 404);
}

// R00067 Reihenfolge per Position
#[tokio::test]
async fn an_eine_position_verschieben() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    senden(Method::POST, a, "api/aufgaben/1/teilaufgaben/mehrere", "st", json!({"texte": ["a", "b", "c"]})).await;
    senden(Method::PATCH, a, "api/aufgaben/1/teilaufgaben/2", "st", json!({"erledigt": true})).await;
    let (s, _) = senden(Method::PATCH, a, "api/aufgaben/1/teilaufgaben/2", "st", json!({"position": 0})).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").ends_with("- [x] c\n- [ ] a\n- [ ] b\n"));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1 Teilaufgabe „c“ an Position 1 verschoben");
    senden(Method::PATCH, a, "api/aufgaben/1/teilaufgaben/0", "st", json!({"position": 99})).await;
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").ends_with("- [ ] a\n- [ ] b\n- [x] c\n"));
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    senden(Method::PATCH, a, "api/aufgaben/1/teilaufgaben/1", "st", json!({"position": 1})).await;
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
}

// R00112 Rückgängig: eine entfernte Teilaufgabe kommt an ihre Stelle und mit ihrem Haken zurück
#[tokio::test]
async fn an_einer_stelle_anlegen() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    senden(Method::POST, a, "api/aufgaben/1/teilaufgaben/mehrere", "st", json!({"texte": ["a", "c"]})).await;
    let vorher: u32 = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();
    let (s, r) = senden(Method::POST, a, "api/aufgaben/1/teilaufgaben", "st", json!({"text": "b", "position": 1, "erledigt": true})).await;
    assert_eq!((s, r["teilaufgaben"][1]["text"].as_str(), r["teilaufgaben"][1]["erledigt"].as_bool()), (200, Some("b"), Some(true)));
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").ends_with("- [ ] a\n- [x] b\n- [ ] c\n"));
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap(), vorher + 1);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1 Teilaufgabe „b“ ergänzt");
    senden(Method::POST, a, "api/aufgaben/1/teilaufgaben", "st", json!({"text": "z", "position": 99})).await;
    senden(Method::POST, a, "api/aufgaben/1/teilaufgaben", "st", json!({"text": "y", "position": null, "erledigt": null})).await;
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").ends_with("- [ ] a\n- [x] b\n- [ ] c\n- [ ] z\n- [ ] y\n"));
}

#[tokio::test]
async fn an_einer_stelle_anlegen_lehnt_ab() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    for (rumpf, teil) in [
        (json!({"text": "b", "position": -1}), "position"),
        (json!({"text": "b", "position": 1.5}), "position"),
        (json!({"text": "b", "position": "1"}), "position"),
        (json!({"text": "b", "erledigt": "ja"}), "erledigt"),
        (json!({"text": "b", "erledigt": 1}), "erledigt"),
        (json!({"text": " ", "position": 0}), "Text"),
    ] {
        let (s, r) = senden(Method::POST, a, "api/aufgaben/1/teilaufgaben", "st", rumpf.clone()).await;
        assert_eq!(s, 400, "{rumpf}");
        assert!(r["fehler"].as_str().unwrap_or_default().contains(teil), "{rumpf}: {r}");
    }
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
}
