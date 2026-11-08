mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn auf_board_legen_und_abnehmen() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::write(tmp.path().join("boards/test.md"), "# Test\n\n## Bereit\n\n## Geprüft\n").unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let aufgabe = lies(tmp.path(), "aufgaben/0003-drei.md");
    let (s, r) = senden(Method::POST, a, "api/boards/test/aufgaben", "st", json!({"nummer": 3})).await;
    assert_eq!((s, r["spalte"].as_str()), (201, Some("Bereit")));
    assert_eq!(lies(tmp.path(), "boards/test.md"), "# Test\n\n## Bereit\n\n- [#3](../aufgaben/0003-drei.md)\n\n## Geprüft\n");
    assert_eq!(lies(tmp.path(), "aufgaben/0003-drei.md"), aufgabe);
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=%an|%s", "HEAD"]), "Stefan|#3 auf „Test“ gelegt (Bereit)\n\nboards/test.md");
    assert_eq!(senden(Method::POST, a, "api/boards/test/aufgaben", "st", json!({"nummer": 3, "spalte": "Geprüft"})).await.0, 409);
    assert_eq!(senden(Method::POST, a, "api/boards/test/aufgaben", "st", json!({"nummer": 2, "spalte": "Nirgends"})).await.0, 400);
    assert_eq!(senden(Method::POST, a, "api/boards/test/aufgaben", "st", json!({"nummer": 99})).await.0, 404);
    assert_eq!(senden(Method::DELETE, a, "api/boards/entwicklung/aufgaben/3", "st", json!(null)).await.0, 200);
    assert!(!lies(tmp.path(), "boards/entwicklung.md").contains("#3"));
    assert!(tmp.path().join("aufgaben/0003-drei.md").exists());
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#3 von „Entwicklung“ genommen");
    assert_eq!(senden(Method::DELETE, a, "api/boards/entwicklung/aufgaben/3", "st", json!(null)).await.0, 404);
}

fn zu_erledigen(pfad: &std::path::Path) -> Vec<String> {
    let text = lies(pfad, "boards/entwicklung.md");
    let abschnitt = text.split("## ").find(|t| t.starts_with("Zu erledigen\n")).unwrap_or_default().to_string();
    abschnitt.lines().filter_map(|z| z.strip_prefix("- [")).map(|z| z.split(']').next().unwrap_or_default().to_string()).collect()
}

fn commits(pfad: &std::path::Path) -> usize {
    git(pfad, &["rev-list", "--count", "HEAD"]).trim().parse().unwrap()
}

// R00112 AK 10, ADR-0017 Regel 4: index legt an eine Stelle, fehlend oder zu groß unten, ungültig 400 (nie 422)
#[tokio::test]
async fn auf_board_legen_an_einer_stelle() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let abnehmen = || senden(Method::DELETE, a, "api/boards/entwicklung/aufgaben/2", "st", json!(null));
    assert_eq!(abnehmen().await.0, 200);
    assert_eq!(zu_erledigen(tmp.path()), ["#1", "#3"]);

    let vorher = commits(tmp.path());
    let (s, r) = senden(Method::POST, a, "api/boards/entwicklung/aufgaben", "st", json!({"nummer": 2, "spalte": "Zu erledigen", "index": 1})).await;
    assert_eq!((s, r["spalte"].as_str()), (201, Some("Zu erledigen")));
    assert_eq!(zu_erledigen(tmp.path()), ["#1", "#2", "#3"]);
    assert_eq!(commits(tmp.path()), vorher + 1);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#2 auf „Entwicklung“ gelegt (Zu erledigen)");

    for (index, erwartet) in [(json!(null), ["#1", "#3", "#2"]), (json!(99), ["#1", "#3", "#2"]), (json!(0), ["#2", "#1", "#3"])] {
        assert_eq!(abnehmen().await.0, 200);
        let mut daten = json!({"nummer": 2});
        if !index.is_null() {
            daten["index"] = index.clone();
        }
        assert_eq!(senden(Method::POST, a, "api/boards/entwicklung/aufgaben", "st", daten).await.0, 201, "index {index}");
        assert_eq!(zu_erledigen(tmp.path()), erwartet, "index {index}");
    }

    assert_eq!(abnehmen().await.0, 200);
    let datei = lies(tmp.path(), "boards/entwicklung.md");
    let vorher = commits(tmp.path());
    for falsch in [json!(-1), json!(1.5), json!("eins"), json!(true)] {
        let (s, r) = senden(Method::POST, a, "api/boards/entwicklung/aufgaben", "st", json!({"nummer": 2, "index": falsch})).await;
        assert_eq!(s, 400, "index {falsch}: {r}");
        assert!(r["fehler"].as_str().unwrap_or_default().contains("index"), "index {falsch}: {r}");
    }
    assert_eq!(lies(tmp.path(), "boards/entwicklung.md"), datei);
    assert_eq!(commits(tmp.path()), vorher);

    assert_eq!(senden(Method::POST, a, "api/boards/entwicklung/aufgaben", "st", json!({"nummer": 1, "index": 0})).await.0, 409);
}
