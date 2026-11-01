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

// R00069: Kommentar und Farbe je Spalte — fehlend bleibt, leer entfernt, ungültige Farbe ist 400
#[tokio::test]
async fn kommentar_und_farbe_setzen_behalten_entfernen() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (s, _) = senden(Method::PUT, a, "api/boards/entwicklung/spalten", "st", json!([{"name": "Zu erledigen", "alt": "Zu erledigen", "notiz": "höchstens zwei", "farbe": "#ffe8b0"}, {"name": "Erledigt", "alt": "Erledigt"}])).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "boards/entwicklung.md").starts_with("---\ncolumn-notes:\n  Zu erledigen: höchstens zwei\ncolumn-colors:\n  Zu erledigen: \"#ffe8b0\"\n---\n"));
    let (_, b) = senden(Method::GET, a, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!((b["spalten"][0]["notiz"].as_str(), b["spalten"][0]["farbe"].as_str()), (Some("höchstens zwei"), Some("#ffe8b0")));
    // verschieben ohne die Felder behält sie
    let (_, r) = senden(Method::PUT, a, "api/boards/entwicklung/spalten", "st", json!([{"name": "Zu erledigen", "alt": "Zu erledigen", "grenze": 5}, {"name": "Erledigt", "alt": "Erledigt"}])).await;
    assert_eq!(r["geaendert"], true);
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("column-colors:\n  Zu erledigen: \"#ffe8b0\""));
    let (s, f) = senden(Method::PUT, a, "api/boards/entwicklung/spalten", "st", json!([{"name": "Zu erledigen", "alt": "Zu erledigen", "farbe": "rot"}, {"name": "Erledigt", "alt": "Erledigt"}])).await;
    assert_eq!(s, 400);
    assert!(f["fehler"].as_str().unwrap().contains("#rrggbb"));
    senden(Method::PUT, a, "api/boards/entwicklung/spalten", "st", json!([{"name": "Zu erledigen", "alt": "Zu erledigen", "notiz": "", "farbe": " "}, {"name": "Erledigt", "alt": "Erledigt"}])).await;
    let t = lies(tmp.path(), "boards/entwicklung.md");
    assert!(!t.contains("column-notes") && !t.contains("column-colors"), "{t}");
}

// R00097: Eigentümer je Spalte — fehlend bleibt (auch ein unbekannter Rohwert, auch beim Umbenennen), null entfernt, anderer Wert ist 400
#[tokio::test]
async fn eigentuemer_setzen_behalten_umbenennen_und_ungueltig() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let pfad = "api/boards/entwicklung/spalten";
    let (s, _) = senden(Method::PUT, a, pfad, "st", json!([{"name": "Zu erledigen", "alt": "Zu erledigen", "eigentuemer": "human"}, {"name": "In Arbeit", "alt": "In Arbeit", "eigentuemer": "agent"}, {"name": "Erledigt", "alt": "Erledigt"}])).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "boards/entwicklung.md").starts_with("---\ncolumn-owner:\n  Zu erledigen: human\n  In Arbeit: agent\n---\n"));
    let (s, _) = senden(Method::PUT, a, pfad, "st", json!([{"name": "Eingang", "alt": "Zu erledigen"}, {"name": "In Arbeit", "alt": "In Arbeit", "eigentuemer": null}, {"name": "Erledigt", "alt": "Erledigt"}])).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "boards/entwicklung.md").starts_with("---\ncolumn-owner:\n  Eingang: human\n---\n"), "Umbenennen nimmt mit, null entfernt");
    let vorher = lies(tmp.path(), "boards/entwicklung.md");
    let (s, f) = senden(Method::PUT, a, pfad, "st", json!([{"name": "Eingang", "alt": "Eingang", "eigentuemer": "chef"}, {"name": "In Arbeit", "alt": "In Arbeit"}, {"name": "Erledigt", "alt": "Erledigt"}])).await;
    assert_eq!(s, 400);
    assert!(f["fehler"].as_str().unwrap().contains("chef"));
    assert_eq!(lies(tmp.path(), "boards/entwicklung.md"), vorher, "400 schreibt nichts");
}

// PO-Entscheidung: ein unbekannter Rohwert in column-owner geht durch PUT …/spalten ohne Feld nicht verloren, auch beim Umbenennen nicht
#[tokio::test]
async fn unbekannter_eigentuemer_bleibt_beim_umbenennen_in_der_datei() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let b = lies(tmp.path(), "boards/entwicklung.md");
    std::fs::write(tmp.path().join("boards/entwicklung.md"), format!("---\ncolumn-owner:\n  Zu erledigen: chef\n---\n\n{b}")).unwrap();
    git(tmp.path(), &["commit", "-qam", "chef"]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/spalten", "st", json!([{"name": "Eingang", "alt": "Zu erledigen"}, {"name": "In Arbeit", "alt": "In Arbeit"}, {"name": "Erledigt", "alt": "Erledigt"}])).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "boards/entwicklung.md").starts_with("---\ncolumn-owner:\n  Eingang: chef\n---\n"));
}
