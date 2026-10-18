mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn umbenennen_neue_spalte_und_grenze_in_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let neu = json!([
        {"name": "Offen", "alt": "Zu erledigen"},
        {"name": "Review"},
        {"name": "Erledigt", "alt": "Erledigt", "grenze": 2}
    ]);
    let (s, r) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/spalten", "st", neu.clone()).await;
    assert_eq!((s, r["geaendert"].as_bool()), (200, Some(true)));
    assert_eq!(
        lies(tmp.path(), "boards/entwicklung.md"),
        "---\nlimits:\n  Erledigt: 2\n---\n\n# Entwicklung\n\n## Offen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## Review\n\n## Erledigt\n"
    );
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "Spalten von „Entwicklung“ geändert");
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    let gleich = json!([{"name": "Offen", "alt": "Offen"}, {"name": "Review", "alt": "Review"}, {"name": "Erledigt", "alt": "Erledigt", "grenze": 2}]);
    let (_, r) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/spalten", "st", gleich).await;
    assert_eq!(r["geaendert"], false);
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!(b["spalten"][2]["grenze"], 2);
}

#[tokio::test]
async fn volle_spalte_fehlt_ist_konflikt_und_fehler_sind_400() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, f) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/spalten", "st", json!([{"name": "Erledigt", "alt": "Erledigt"}])).await;
    assert_eq!(s, 409);
    assert!(f["fehler"].as_str().unwrap().contains("enthält 3 Aufgaben"));
    for neu in [
        json!([{"name": "", "alt": "Zu erledigen"}]),
        json!([{"name": "A", "alt": "Zu erledigen"}, {"name": "A"}]),
        json!([{"name": "A", "alt": "Gibtsnicht"}]),
        json!([{"name": "A", "alt": "Zu erledigen"}, {"name": "B", "alt": "Zu erledigen"}]),
    ] {
        assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/spalten", "st", neu).await.0, 400);
    }
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/spalten", "st", json!([{"name": "Alles", "alt": "Zu erledigen"}])).await;
    assert_eq!(s, 200, "leere Spalten dürfen fehlen");
}
