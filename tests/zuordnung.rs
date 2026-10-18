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
