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

#[tokio::test]
async fn alle_boards_mit_struktur() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::write(tmp.path().join("boards/test.md"), "# Test\n\n## Bereit\n\n- #2\n").unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, b) = senden(Method::GET, &lauf.adresse, "api/boards", "st", json!(null)).await;
    assert_eq!(s, 200);
    assert_eq!(b[0]["slug"], "entwicklung");
    assert_eq!(b[0]["spalten"][0]["aufgaben"], json!([1, 2, 3]));
    assert_eq!(b[1]["spalten"][0]["aufgaben"], json!([2]));
}

// ── R00128: Board umbenennen, archivieren, löschen ──────────────────────────────────────────────────────────────

/// Grundbestand (R00128 AK): Boards „Entwicklung“ und „Test“; „Test“ hat #7 in der Menschen-Spalte „Prüfen“.
fn grundbestand(pfad: &std::path::Path) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("aufgaben/0007-sieben.md"), "---\nid: 7\ntitle: sieben\n---\n").unwrap();
    std::fs::write(pfad.join("boards/test.md"), "---\ncolumn-owner:\n  Prüfen: human\n---\n\n# Test\n\n## Bereit\n\n## Prüfen\n\n- [#7](../aufgaben/0007-sieben.md)\n").unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "grundbestand"]);
}

fn kopf(pfad: &std::path::Path) -> String {
    git(pfad, &["rev-parse", "HEAD"])
}

// AK 1 + US-1: Umbenennen ändert nur die Überschrift; Slug, Adresse und Berichte-Cache bleiben
#[tokio::test]
async fn umbenennen_aendert_nur_den_titel_der_slug_bleibt() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path());
    std::fs::create_dir_all(tmp.path().join("berichte")).unwrap();
    let cache = "# Cache\n\n| Tag |\n|---|\n";
    std::fs::write(tmp.path().join("berichte/entwicklung-fieber.md"), cache).unwrap();
    git(tmp.path(), &["add", "-A"]);
    git(tmp.path(), &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "cache"]);
    let vorher = kopf(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, b) = senden(Method::PATCH, &lauf.adresse, "api/boards/entwicklung", "st", json!({"titel": "Entwicklung 2026"})).await;
    assert_eq!(s, 200);
    assert_eq!((b["titel"].as_str(), b["slug"].as_str()), (Some("Entwicklung 2026"), Some("entwicklung")));
    assert!(tmp.path().join("boards/entwicklung.md").exists(), "die Datei heißt weiter entwicklung.md");
    assert!(!tmp.path().join("boards/entwicklung-2026.md").exists(), "kein neuer Dateiname");
    assert_ne!(kopf(tmp.path()), vorher);
    assert_eq!(git(tmp.path(), &["show", "-s", "--format=%an|%s", "HEAD"]), "Stefan|Board „Entwicklung 2026“ umbenannt");
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<usize>().unwrap(), git(tmp.path(), &["rev-list", "--count", &vorher]).parse::<usize>().unwrap() + 1, "genau ein Commit");
    assert_eq!(lies(tmp.path(), "berichte/entwicklung-fieber.md"), cache, "Cache byte-gleich");
    assert!(lies(tmp.path(), "boards/entwicklung.md").starts_with("# Entwicklung 2026\n"));
    let (_, g) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!((g["titel"].as_str(), g["slug"].as_str()), (Some("Entwicklung 2026"), Some("entwicklung")));
    let (_, boards) = senden(Method::GET, &lauf.adresse, "api/boards", "st", json!(null)).await;
    assert!(boards.as_array().unwrap().iter().any(|x| x["slug"] == "entwicklung" && x["titel"] == "Entwicklung 2026"));
}

// AK 2/3 + US-2/US-3: Archivieren setzt `archived: <heute>`, nimmt aus der Liste; `?archivierte=ja` und Reaktivieren
#[tokio::test]
async fn archivieren_und_reaktivieren() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path());
    let vorher = kopf(tmp.path());
    let heute = kanband::uhr::heute();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (s, b) = senden(Method::PATCH, a, "api/boards/test", "st", json!({"archiviert": true})).await;
    assert_eq!(s, 200);
    assert_eq!(b["archiviert"].as_str(), Some(heute.as_str()));
    assert!(lies(tmp.path(), "boards/test.md").contains(&format!("archived: {heute}\n")), "die Datei bleibt liegen");
    assert_ne!(kopf(tmp.path()), vorher);
    assert_eq!(git(tmp.path(), &["show", "-s", "--format=%s", "HEAD"]), "Board „Test“ archiviert");
    // aus der offenen Liste und dem Umschalter heraus
    let (_, boards) = senden(Method::GET, a, "api/boards", "st", json!(null)).await;
    assert!(!boards.as_array().unwrap().iter().any(|x| x["slug"] == "test"), "Test fehlt in GET /api/boards");
    let (_, z) = senden(Method::GET, a, "api/zustand", "st", json!(null)).await;
    assert!(!z["boards"].as_array().unwrap().iter().any(|x| x["slug"] == "test"), "Test fehlt im Umschalter");
    // ?archivierte=ja und das einzelne Board nehmen es auf
    let (_, alle) = senden(Method::GET, a, "api/boards?archivierte=ja", "st", json!(null)).await;
    let t = alle.as_array().unwrap().iter().find(|x| x["slug"] == "test").expect("mit ?archivierte=ja dabei");
    assert_eq!(t["archiviert"].as_str(), Some(heute.as_str()));
    let (_, einzeln) = senden(Method::GET, a, "api/boards/test", "st", json!(null)).await;
    assert_eq!(einzeln["archiviert"].as_str(), Some(heute.as_str()));
    // ohne Änderung kein Commit
    let vorher2 = kopf(tmp.path());
    assert_eq!(senden(Method::PATCH, a, "api/boards/test", "st", json!({"archiviert": true})).await.0, 200);
    assert_eq!(kopf(tmp.path()), vorher2, "zweites Archivieren am selben Tag ändert nichts");
    // reaktivieren
    let (s, b) = senden(Method::PATCH, a, "api/boards/test", "st", json!({"archiviert": false})).await;
    assert_eq!(s, 200);
    assert_eq!(b["archiviert"], serde_json::Value::Null);
    assert!(!lies(tmp.path(), "boards/test.md").contains("archived"));
    assert_eq!(git(tmp.path(), &["show", "-s", "--format=%s", "HEAD"]), "Board „Test“ wieder geöffnet");
    let (_, boards) = senden(Method::GET, a, "api/boards", "st", json!(null)).await;
    assert!(boards.as_array().unwrap().iter().any(|x| x["slug"] == "test"), "Test wieder in der Liste");
    let (_, einzeln) = senden(Method::GET, a, "api/boards/test", "st", json!(null)).await;
    assert_eq!(einzeln["archiviert"], serde_json::Value::Null);
}

// AK 4 + US-4: Löschen entfernt Board-Datei und Cache in einem Commit; die Karten bleiben
#[tokio::test]
async fn loeschen_entfernt_datei_und_cache_die_karten_bleiben() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path());
    std::fs::create_dir_all(tmp.path().join("berichte")).unwrap();
    std::fs::write(tmp.path().join("berichte/test-fieber.md"), "# Cache\n").unwrap();
    git(tmp.path(), &["add", "-A"]);
    git(tmp.path(), &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "cache"]);
    let vorher = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<usize>().unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, _) = senden(Method::DELETE, &lauf.adresse, "api/boards/test", "st", json!(null)).await;
    assert_eq!(s, 200);
    assert!(!tmp.path().join("boards/test.md").exists(), "Board-Datei weg");
    assert!(!tmp.path().join("berichte/test-fieber.md").exists(), "Cache weg");
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<usize>().unwrap(), vorher + 1, "genau ein Commit");
    assert_eq!(git(tmp.path(), &["show", "-s", "--format=%s", "HEAD"]), "Board „Test“ endgültig gelöscht");
    assert!(git(tmp.path(), &["show", "--name-only", "--format=", "HEAD"]).lines().any(|z| z == "boards/test.md"));
    assert!(git(tmp.path(), &["show", "--name-only", "--format=", "HEAD"]).lines().any(|z| z == "berichte/test-fieber.md"));
    let (_, aufgaben) = senden(Method::GET, &lauf.adresse, "api/aufgaben", "st", json!(null)).await;
    assert!(aufgaben["aufgaben"].as_array().unwrap().iter().any(|x| x["nummer"] == 7), "Karte #7 bleibt erhalten");
    let (_, boards) = senden(Method::GET, &lauf.adresse, "api/boards", "st", json!(null)).await;
    assert!(!boards.as_array().unwrap().iter().any(|x| x["slug"] == "test"), "Test fehlt in der Liste");
}

// AK 5 + US-5: Agent gesperrt (Archivieren und Löschen), Mensch frei, Umbenennen frei
#[tokio::test]
async fn agent_gesperrt_mensch_frei_umbenennen_frei() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = kopf(tmp.path());
    for (was, methode, daten) in [("archivieren", Method::PATCH, json!({"archiviert": true})), ("löschen", Method::DELETE, json!(null))] {
        let (s, r) = senden(methode.clone(), a, "api/boards/test", "cl", daten).await;
        assert_eq!(s, 403, "Agent darf „Test“ nicht {was}");
        assert_eq!(r, json!({"fehler": "Spalte „Prüfen“ gehört dem Menschen", "spalte": "Prüfen", "nummer": 7}), "{was}");
        assert_eq!(kopf(tmp.path()), vorher, "{was}: nichts geschrieben, kein Commit");
        assert!(tmp.path().join("boards/test.md").exists(), "{was}: Datei unverändert");
    }
    // Umbenennen bewegt keine Karte → frei
    assert_eq!(senden(Method::PATCH, a, "api/boards/test", "cl", json!({"titel": "Test 2026"})).await.0, 200);
    assert!(lies(tmp.path(), "boards/test.md").contains("# Test 2026\n"));
    // der Mensch darf
    assert_eq!(senden(Method::PATCH, a, "api/boards/test", "st", json!({"archiviert": true})).await.0, 200);
    assert_eq!(senden(Method::PATCH, a, "api/boards/test", "st", json!({"archiviert": false})).await.0, 200);
    assert_eq!(senden(Method::DELETE, a, "api/boards/test", "st", json!(null)).await.0, 200);
    assert!(!tmp.path().join("boards/test.md").exists());
}

// AK 6 + US-6: leerer Titel 400 (Datei byte-gleich), unbekannt 404, PATCH ohne Änderung kein Commit
#[tokio::test]
async fn fehlerfaelle_kein_leerer_commit() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let datei = lies(tmp.path(), "boards/entwicklung.md");
    let vorher = kopf(tmp.path());
    for leer in [json!({"titel": ""}), json!({"titel": "   "}), json!({"titel": "!!!"})] {
        assert_eq!(senden(Method::PATCH, a, "api/boards/entwicklung", "st", leer.clone()).await.0, 400, "{leer}");
        assert_eq!(lies(tmp.path(), "boards/entwicklung.md"), datei, "{leer}: Datei byte-gleich");
        assert_eq!(kopf(tmp.path()), vorher, "{leer}: kein Commit");
    }
    assert_eq!(senden(Method::PATCH, a, "api/boards/gibtsnicht", "st", json!({"titel": "X"})).await.0, 404);
    assert_eq!(senden(Method::PATCH, a, "api/boards/Entwicklung", "st", json!({"titel": "X"})).await.0, 400, "ungültige Slug-Form");
    assert_eq!(senden(Method::DELETE, a, "api/boards/gibtsnicht", "st", json!(null)).await.0, 404);
    // PATCH ohne tatsächliche Änderung
    assert_eq!(senden(Method::PATCH, a, "api/boards/entwicklung", "st", json!({"titel": "Entwicklung"})).await.0, 200);
    assert_eq!(kopf(tmp.path()), vorher, "ohne Änderung kein Commit");
}

// M1 (security, Befund): ein Board-Titel mit Zeilenumbruch oder über 200 Zeichen ergibt 400 —
// Datei byte-gleich, kein Commit; die Klasse gilt für PATCH und POST (R00128, Regel wie Fremdschluessel).
#[tokio::test]
async fn titel_mit_umbruch_oder_zu_lang_400() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let datei = lies(tmp.path(), "boards/entwicklung.md");
    let vorher = kopf(tmp.path());
    let zu_lang = "A".repeat(201);
    let varianten = vec![
        "X\n## Prüfen".to_string(),
        "X\r## Prüfen".to_string(),
        "X\r\n## Prüfen".to_string(),
        "X\u{2028}## Prüfen".to_string(),
        "\n".to_string(),
        zu_lang.clone(),
    ];
    for titel in &varianten {
        let (s, _) = senden(Method::PATCH, a, "api/boards/entwicklung", "st", json!({ "titel": titel })).await;
        assert_eq!(s, 400, "PATCH {titel:?} muss 400 sein");
        assert_eq!(lies(tmp.path(), "boards/entwicklung.md"), datei, "PATCH {titel:?}: Datei byte-gleich");
        assert_eq!(kopf(tmp.path()), vorher, "PATCH {titel:?}: kein Commit");
    }
    for titel in ["X\n## Prüfen".to_string(), zu_lang.clone()] {
        let (s, _) = senden(Method::POST, a, "api/boards", "st", json!({ "titel": titel })).await;
        assert_eq!(s, 400, "POST {titel:?} muss 400 sein");
    }
    assert_eq!(kopf(tmp.path()), vorher, "POST: kein Commit");
    // Grenze: 200 Zeichen ohne Umbruch sind erlaubt (Triangulation — die Probe prüft die Spanne, nicht nur die Obergrenze)
    let rand = "B".repeat(200);
    let (s, b) = senden(Method::PATCH, a, "api/boards/entwicklung", "st", json!({ "titel": rand })).await;
    assert_eq!(s, 200, "200 Zeichen sind erlaubt");
    assert_eq!(b["titel"].as_str(), Some("B".repeat(200).as_str()));
    assert!(lies(tmp.path(), "boards/entwicklung.md").starts_with(&format!("# {}\n", "B".repeat(200))));
    // ein Umbruch nur am Rand wird getrimmt und ist gültig (Regel wie Fremdschluessel; file bleibt lesbar)
    let (s, b) = senden(Method::PATCH, a, "api/boards/entwicklung", "st", json!({ "titel": "Sommer\n" })).await;
    assert_eq!(s, 200, "ein Umbruch nur am Rand wird getrimmt");
    assert_eq!(b["titel"].as_str(), Some("Sommer"));
    assert!(lies(tmp.path(), "boards/entwicklung.md").starts_with("# Sommer\n"));
}

// AK 14/S4: ein defektes Board bleibt schreibgeschützt — 423 für Umbenennen, Archivieren, Löschen
#[tokio::test]
async fn defektes_board_423() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path());
    std::fs::write(tmp.path().join("boards/kaputt.md"), "# Kaputt\n- #1\n## A\n").unwrap();
    git(tmp.path(), &["add", "-A"]);
    git(tmp.path(), &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "kaputt"]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    assert_eq!(senden(Method::PATCH, a, "api/boards/kaputt", "st", json!({"titel": "Neu"})).await.0, 423);
    assert_eq!(senden(Method::PATCH, a, "api/boards/kaputt", "st", json!({"archiviert": true})).await.0, 423);
    assert_eq!(senden(Method::DELETE, a, "api/boards/kaputt", "st", json!(null)).await.0, 423);
    assert!(tmp.path().join("boards/kaputt.md").exists(), "nichts gelöscht");
}

// AK 9: POST /api/boards und sein 409 bleiben unberührt
#[tokio::test]
async fn anlegen_bleibt_mit_409() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/boards", "st", json!({"titel": "Test"})).await.0, 409);
}

