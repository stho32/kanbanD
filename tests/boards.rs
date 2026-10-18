mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn board_mit_standardspalten_in_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/boards", "st", json!({"titel": "Test & Abnahme"})).await;
    assert_eq!((s, r["board"].as_str()), (201, Some("test-abnahme")));
    assert_eq!(lies(tmp.path(), "boards/test-abnahme.md"), "# Test & Abnahme\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=%an|%s", "HEAD"]), "Stefan|Board „Test & Abnahme“ angelegt\n\nboards/test-abnahme.md");
    let (_, z) = senden(Method::GET, &lauf.adresse, "api/zustand", "st", json!(null)).await;
    let titel: Vec<&str> = z["boards"].as_array().unwrap().iter().map(|b| b["titel"].as_str().unwrap()).collect();
    assert_eq!(titel, vec!["Entwicklung", "Test & Abnahme"]);
}

#[tokio::test]
async fn eigene_spalten_konflikt_und_fehler() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let (s, _) = senden(Method::POST, &lauf.adresse, "api/boards", "st", json!({"titel": "Release", "spalten": ["Offen", "Fertig"]})).await;
    assert_eq!(s, 201);
    assert!(lies(tmp.path(), "boards/release.md").ends_with("## Offen\n\n## Fertig\n"));
    for (daten, status) in [
        (json!({"titel": "Release"}), 409),
        (json!({"titel": "  "}), 400),
        (json!({"titel": "X", "spalten": ["A", "A"]}), 400),
        (json!({"titel": "Y", "spalten": []}), 400),
    ] {
        assert_eq!(senden(Method::POST, &lauf.adresse, "api/boards", "st", daten).await.0, status);
    }
    assert!(!tmp.path().join("boards/x.md").exists());
}
