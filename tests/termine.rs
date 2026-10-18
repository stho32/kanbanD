mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn termine_setzen_entfernen_und_beim_bewegen_erhalten() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let deadline = json!({"name": "Deadline", "datum": "2027-10-31", "farbe": "red", "linie": "durchgehend", "staerke": "fett"});
    let review = json!({"name": " Review ", "datum": "2026-11-15", "farbe": "#2a78d6", "linie": "gestrichelt"});
    let (s, v) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/termine", "st", json!([deadline, review])).await;
    assert_eq!((s, v["geaendert"].as_bool()), (200, Some(true)));
    let text = lies(tmp.path(), "boards/entwicklung.md");
    assert!(text.starts_with("---\nmilestones:\n  - {name: Review, date: 2026-11-15, color: \"#2a78d6\", line: dashed, width: normal}\n  - {name: Deadline, date: 2027-10-31, color: red, line: solid, width: bold}\n---\n"), "{text}");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "Termine von „Entwicklung“ geändert");
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!(b["termine"][0]["name"], "Review");
    assert_eq!(b["termine"][1]["staerke"], "fett");
    let (_, v) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/termine", "st", json!([deadline, review])).await;
    assert_eq!(v["geaendert"], false, "gleiche Termine in anderer Reihenfolge: kein Commit");
    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/termine", "st", json!([deadline])).await;
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "Termin „Review“ (15.11.2026) entfernt aus „Entwicklung“");
    let (s, _) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "x", "board": "entwicklung"})).await;
    assert_eq!(s, 201);
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("milestones:\n  - {name: Deadline"), "Anlegen schreibt das Board neu und erhält die Termine");
    for falsch in [json!([{"name": " ", "datum": "2027-10-31", "farbe": "red"}]), json!([{"name": "X", "datum": "31.10.2027", "farbe": "red"}]), json!([{"name": "X", "datum": "2027-10-31", "farbe": "Rot!"}])] {
        assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/termine", "st", falsch).await.0, 400);
    }
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/termine", "st", json!([{"name": "X", "datum": "2027-10-31", "farbe": "red", "linie": "wellig"}])).await.0, 422);
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/gibtsnicht/termine", "st", json!([])).await.0, 404);
}
