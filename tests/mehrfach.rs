// R00065 Massenaktionen: je ein Commit für mehrere Karten
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

fn starten(tmp: &tempfile::TempDir) -> gemeinsam::Laufendes {
    gemeinsam::mit_drei_aufgaben(tmp.path());
    gemeinsam::starten(tmp.path(), &["--port", "0"])
}

fn commits(tmp: &tempfile::TempDir) -> u32 {
    git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

#[tokio::test]
async fn mehrere_bewegen_in_einem_commit_und_zurueck() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let vorher = commits(&tmp);
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen-mehrere", "st", json!({"ziele": [{"nummer": 1, "spalte": "Erledigt", "index": 0}, {"nummer": 3, "spalte": "Erledigt", "index": 1}]})).await;
    assert_eq!((s, r["bewegt"].as_bool()), (200, Some(true)), "{r}");
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("## Zu erledigen\n\n- [#2](../aufgaben/0002-zwei.md)\n\n## In Arbeit\n\n## Erledigt\n\n- [#1](../aufgaben/0001-eins.md)\n- [#3](../aufgaben/0003-drei.md)\n"));
    assert_eq!(commits(&tmp), vorher + 1);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1, #3 nach „Erledigt“ (2 Aufgaben, Entwicklung)");
    // zurück an die alten Plätze: erst alle heraus, dann der Reihe nach einsetzen
    let (s, _) = senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen-mehrere", "st", json!({"ziele": [{"nummer": 1, "spalte": "Zu erledigen", "index": 0}, {"nummer": 3, "spalte": "Zu erledigen", "index": 2}]})).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## In Arbeit\n\n## Erledigt\n"));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1, #3 nach „Zu erledigen“ (2 Aufgaben, Entwicklung)");
    let stand = git(tmp.path(), &["rev-parse", "HEAD"]);
    let (_, r) = senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen-mehrere", "st", json!({"ziele": [{"nummer": 1, "spalte": "Zu erledigen", "index": 0}]})).await;
    assert_eq!(r["bewegt"], false);
    for falsch in [json!({"ziele": []}), json!({"ziele": [{"nummer": 1, "spalte": "Gibtsnicht", "index": 0}]}), json!({"ziele": [{"nummer": 1, "spalte": "Erledigt", "index": 0}, {"nummer": 9, "spalte": "Erledigt", "index": 1}]})] {
        assert!(senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen-mehrere", "st", falsch).await.0 >= 400);
    }
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), stand);
}

#[tokio::test]
async fn mehrere_aendern_in_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let vorher = commits(&tmp);
    let (s, r) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", json!({"aenderungen": [{"nummer": 1, "klasse": "bug", "zustaendige": ["cl"]}, {"nummer": 2, "klasse": "bug"}]})).await;
    assert_eq!(s, 200, "{r}");
    assert_eq!(r.as_array().unwrap().len(), 2);
    assert_eq!(lies(tmp.path(), "aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\nclass: bug\nassignees: [cl]\n---\n");
    assert_eq!(lies(tmp.path(), "aufgaben/0002-zwei.md"), "---\nid: 2\ntitle: zwei\nclass: bug\n---\n");
    assert_eq!(commits(&tmp), vorher + 1);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1, #2 geändert: Klasse, Zuständige (2 Aufgaben)");
    // nichts geändert → kein Commit; ein ungültiges Feld → nichts geschrieben
    let stand = git(tmp.path(), &["rev-parse", "HEAD"]);
    let (s, _) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", json!({"aenderungen": [{"nummer": 2, "klasse": "bug"}]})).await;
    assert_eq!(s, 200);
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), stand);
    let (s, _) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", json!({"aenderungen": [{"nummer": 3, "klasse": "feature"}, {"nummer": 2, "klasse": "gibtsnicht"}]})).await;
    assert_eq!(s, 400);
    assert_eq!(senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", json!({"aenderungen": []})).await.0, 400);
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), stand);
    assert!(!lies(tmp.path(), "aufgaben/0003-drei.md").contains("class"));
}

#[tokio::test]
async fn mehrere_auf_board_legen_in_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    senden(Method::POST, &lauf.adresse, "api/boards", "st", json!({"titel": "Test", "spalten": ["Bereit", "Geprüft"]})).await;
    senden(Method::POST, &lauf.adresse, "api/boards/test/aufgaben", "st", json!({"nummer": 2, "spalte": "Geprüft"})).await;
    let vorher = commits(&tmp);
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/boards/test/aufgaben/mehrere", "st", json!({"nummern": [1, 2, 3], "spalte": "Bereit"})).await;
    assert_eq!((s, r.clone()), (200, json!([1, 3])));
    assert!(lies(tmp.path(), "boards/test.md").contains("## Bereit\n\n- [#1](../aufgaben/0001-eins.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## Geprüft\n\n- [#2](../aufgaben/0002-zwei.md)\n"));
    assert_eq!(commits(&tmp), vorher + 1);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1, #3 auf „Test“ gelegt (Bereit)");
    assert!(senden(Method::POST, &lauf.adresse, "api/boards/test/aufgaben/mehrere", "st", json!({"nummern": [1], "spalte": "Gibtsnicht"})).await.0 >= 400);
    assert_eq!(commits(&tmp), vorher + 1);
}
