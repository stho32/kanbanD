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

// R00009 (Karte #22): ohne `alt` übernimmt eine Zeile mit dem Namen einer vorhandenen Spalte diese samt Aufgaben und
// Einstellungen; eine wirklich neue Spalte bleibt leer; Umbenennen ohne `alt` bleibt 409, unbekanntes `alt` 400.
#[tokio::test]
async fn ohne_alt_haelt_aufgaben_und_einstellungen() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let pfad = "api/boards/entwicklung/spalten";
    let (s, _) = senden(Method::PUT, a, pfad, "st", json!([
        {"name": "Zu erledigen", "alt": "Zu erledigen", "grenze": 5, "pruefungen": ["wbs-effects-green"], "notiz": "höchstens zwei", "farbe": "#ffe8b0", "eigentuemer": "human"},
        {"name": "In Arbeit", "alt": "In Arbeit", "grenze": 2},
        {"name": "Erledigt", "alt": "Erledigt"}
    ])).await;
    assert_eq!(s, 200);
    let vorher = lies(tmp.path(), "boards/entwicklung.md");
    // ohne alt, Name gleich → Aufgaben und Einstellungen bleiben; Review ist neu und leer
    let (s, r) = senden(Method::PUT, a, pfad, "st", json!([
        {"name": "Zu erledigen"},
        {"name": "Review"},
        {"name": "In Arbeit"},
        {"name": "Erledigt"}
    ])).await;
    assert_eq!((s, r["geaendert"].as_bool()), (200, Some(true)), "{r}");
    let t = lies(tmp.path(), "boards/entwicklung.md");
    assert_eq!(
        t,
        "---\nlimits:\n  Zu erledigen: 5\n  In Arbeit: 2\ncolumn-checks:\n  Zu erledigen: [wbs-effects-green]\ncolumn-notes:\n  Zu erledigen: höchstens zwei\ncolumn-colors:\n  Zu erledigen: \"#ffe8b0\"\ncolumn-owner:\n  Zu erledigen: human\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## Review\n\n## In Arbeit\n\n## Erledigt\n",
        "Aufgaben und Einstellungen bleiben, Review ist neu"
    );
    assert!(vorher.contains("Zu erledigen: 5"), "Vorbedingung: Einstellungen standen vorher in der Datei");
    // Umbenennen ohne alt (A nicht übernommen) → 409
    let (s, f) = senden(Method::PUT, a, pfad, "st", json!([{"name": "Posteingang"}, {"name": "In Arbeit"}, {"name": "Erledigt"}])).await;
    assert_eq!(s, 409);
    assert!(f["fehler"].as_str().unwrap().contains("Zu erledigen"), "{f}");
    // unbekanntes alt → 400
    let (s, _) = senden(Method::PUT, a, pfad, "st", json!([{"name": "Zu erledigen", "alt": "Gibtsnicht"}])).await;
    assert_eq!(s, 400, "unbekanntes alt bleibt 400");
}

// R00009 (Karte #22) Randfall: beansprucht das `alt` einer anderen Zeile den Namen, entfällt der Rückfall — keine
// Aufgabe wird doppelt übernommen, Umbenennen-und-neu-Anlegen bleibt möglich.
#[tokio::test]
async fn ohne_alt_randfall_bei_beanspruchtem_namen() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/spalten", "st", json!([
        {"name": "Posteingang", "alt": "Zu erledigen"},
        {"name": "Zu erledigen"},
        {"name": "In Arbeit", "alt": "In Arbeit"},
        {"name": "Erledigt", "alt": "Erledigt"}
    ])).await;
    assert_eq!(s, 200);
    assert_eq!(
        lies(tmp.path(), "boards/entwicklung.md"),
        "# Entwicklung\n\n## Posteingang\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n",
        "Posteingang übernimmt die Aufgaben, die neue Zu erledigen bleibt leer"
    );
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

// R00128 N2 (security, Befund): ein Spaltenname wird als `## `-Überschrift der Board-Datei geschrieben — ein
// Zeilenumbruch oder ein Name über 200 Zeichen ergibt 400; die Datei bleibt byte-gleich, kein Commit. Dieselbe
// Regel wie beim Board-Titel gilt für alle drei Wege: PUT …/spalten, POST /api/boards und POST /api/einrichten.
#[tokio::test]
async fn spaltenname_mit_umbruch_oder_zu_lang_400() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let datei = lies(tmp.path(), "boards/entwicklung.md");
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    let zu_lang = "A".repeat(201);
    let ungueltig: [&str; 12] = [
        "X\n## Prüfen",
        "X\r## Prüfen",
        "X\r\n## Prüfen",
        "X\u{2028}## Prüfen",
        "X\u{0B}## Prüfen",
        "X\u{85}## Prüfen",
        // #131 (Optional 2): Steuerzeichen der Kategorie Cc ohne Umbruch — NUL, ESC, DEL, Tabulator mitten im Namen
        "X\u{0}## Prüfen",
        "X\u{1B}## Prüfen",
        "X\u{7F}## Prüfen",
        "X\t## Prüfen",
        "\n",
        zu_lang.as_str(),
    ];
    // Weg 1: PUT /api/boards/{slug}/spalten — die neue Zeile trägt den Namen
    for name in ungueltig {
        let neu = json!([
            {"name": "Zu erledigen", "alt": "Zu erledigen"},
            {"name": name, "alt": "In Arbeit"},
            {"name": "Erledigt", "alt": "Erledigt"}
        ]);
        let (s, f) = senden(Method::PUT, a, "api/boards/entwicklung/spalten", "st", neu).await;
        assert_eq!(s, 400, "PUT {name:?} muss 400 sein: {f}");
        assert_eq!(lies(tmp.path(), "boards/entwicklung.md"), datei, "PUT {name:?}: Datei byte-gleich");
        assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher, "PUT {name:?}: kein Commit");
    }
    // Weg 2: POST /api/boards mit eigener Spaltenliste
    for name in ungueltig {
        let (s, _) = senden(Method::POST, a, "api/boards", "st", json!({"titel": "Neu", "spalten": [name]})).await;
        assert_eq!(s, 400, "POST /api/boards {name:?} muss 400 sein");
    }
    assert!(!tmp.path().join("boards/neu.md").exists(), "kein Board angelegt");
    // Weg 3: POST /api/einrichten
    for name in ungueltig {
        let e = json!({
            "ich": {"kuerzel": "st", "name": "Stefan"},
            "agenten": [],
            "board": "Zweites",
            "spalten": [name],
            "quellen": {"wbs": "", "anforderungen": ""}
        });
        let (s, _) = senden(Method::POST, a, "api/einrichten", "st", e).await;
        assert_eq!(s, 400, "POST /api/einrichten {name:?} muss 400 sein");
    }
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher, "nach allen Varianten kein Commit");
    // ein Umbruch nur am Rand wird getrimmt und ist gültig (Regel wie Board-Titel)
    let (s, _) = senden(Method::PUT, a, "api/boards/entwicklung/spalten", "st", json!([
        {"name": "Zu erledigen", "alt": "Zu erledigen"},
        {"name": "Sommer\n", "alt": "In Arbeit"},
        {"name": "Erledigt", "alt": "Erledigt"}
    ])).await;
    assert_eq!(s, 200, "ein Umbruch nur am Rand wird getrimmt");
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("\n## Sommer\n"));
    // dasselbe für den Tabulator: am Rand getrimmt (#131), im Namen abgewiesen (oben)
    let (s, _) = senden(Method::PUT, a, "api/boards/entwicklung/spalten", "st", json!([
        {"name": "Zu erledigen", "alt": "Zu erledigen"},
        {"name": "Sommer\t", "alt": "Sommer"},
        {"name": "Erledigt", "alt": "Erledigt"}
    ])).await;
    assert_eq!(s, 200, "ein Tabulator nur am Rand wird getrimmt");
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("\n## Sommer\n"));
    // Grenze (Triangulation): 200 Zeichen sind erlaubt
    let rand = "B".repeat(200);
    let neu = json!([
        {"name": "Zu erledigen", "alt": "Zu erledigen"},
        {"name": rand, "alt": "Sommer"},
        {"name": "Erledigt", "alt": "Erledigt"}
    ]);
    let (s, r) = senden(Method::PUT, a, "api/boards/entwicklung/spalten", "st", neu).await;
    assert_eq!((s, r["geaendert"].as_bool()), (200, Some(true)), "200 Zeichen sind erlaubt: {r}");
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains(&format!("\n## {}\n", "B".repeat(200))));
}
