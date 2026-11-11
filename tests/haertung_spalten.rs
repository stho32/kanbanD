// R00120 Härtung Spalten mit Eigentümer: Angriffsmatrix (Abnahme). Ein Agent darf über keinen Karten
// entfernenden Weg an einer Menschen-Spalte vorbei; ein verwaister/ungültiger `human`-Eintrag sperrt das ganze
// Board (403, PO Z. 187), ein defektes Board ergibt einheitlich 423 (PO Z. 188). Vorbild: tests/eigentuemer_sperre.rs.
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

/// kanbanD.md mit Signal „behoben“ (für den Erledigen-Weg W5); `cl` Agent, `st` Mensch.
fn einstellungen() -> String {
    gemeinsam::EINSTELLUNGEN.replace("sources:", "signals:\n  behoben: {label: Behoben, color: green}\nsources:")
}

/// Wegwerf-Ordner: kanbanD.md, Aufgabe #1 mit Schlüssel k1, und die genannten Boards (Slug → Inhalt).
fn ordner(pfad: &Path, boards: &[(&str, &str)]) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), einstellungen()).unwrap();
    std::fs::write(pfad.join("aufgaben/0001-k.md"), "---\nid: 1\ntitle: k1\nkey: k1\n---\n").unwrap();
    for (slug, inhalt) in boards {
        std::fs::write(pfad.join(format!("boards/{slug}.md")), inhalt).unwrap();
    }
    git(pfad, &["init", "-q"]);
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgang"]);
}

/// „Fabrik“ mit #1 in Eingang; `vorspann` ersetzt das Frontmatter.
fn fabrik_mit(vorspann: &str) -> String {
    format!("{vorspann}\n# Fabrik\n\n## Eingang\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n")
}

/// HEAD und der Inhalt von boards/fabrik.md.
fn stand(pfad: &Path) -> (String, String) {
    (git(pfad, &["rev-parse", "HEAD"]), lies(pfad, "boards/fabrik.md"))
}

async fn mit_instanz(adresse: &str, pfad: &str, wer: &str, instanz: &str, daten: Value) -> (u16, Value) {
    let r = reqwest::Client::new().post(format!("{adresse}{pfad}")).header("X-KanbanD-Wer", wer).header("X-KanbanD-Instanz", instanz).json(&daten).send().await.unwrap();
    (r.status().as_u16(), serde_json::from_str(&r.text().await.unwrap()).unwrap_or(Value::Null))
}

/// Die fünf Karten entfernenden/bewegenden Wege als Agent `cl` auf Board `slug`.
async fn weg(nummer: usize, adresse: &str, slug: &str) -> (u16, Value) {
    match nummer {
        0 => senden(Method::POST, adresse, "api/aufgaben/1/archivieren", "cl", json!(null)).await,
        1 => senden(Method::DELETE, adresse, &format!("api/boards/{slug}/aufgaben/1"), "cl", json!(null)).await,
        2 => senden(Method::POST, adresse, &format!("api/boards/{slug}/bewegen"), "cl", json!({"nummer": 1, "spalte": "In Arbeit"})).await,
        3 => mit_instanz(adresse, &format!("api/boards/{slug}/ziehen"), "cl", "A", json!({"von": "Eingang", "nach": "In Arbeit"})).await,
        _ => senden(Method::POST, adresse, "api/aufgaben/erledigen", "cl", json!({"key": "k1", "board": slug, "text": "weg", "signal": "behoben"})).await,
    }
}

/// Ein Variantenfall: Name, Board-Frontmatter, erwarteter Status je Weg W1..W5, erwartetes Ergebnis bei W5.
struct Fall {
    name: &'static str,
    vorspann: &'static str,
    status: [u16; 5],
}

/// Die Varianten der Angriffsmatrix (ohne P5, das ein defektes Board braucht).
fn faelle() -> Vec<Fall> {
    vec![
        Fall { name: "K Menschen-Spalte", vorspann: "---\ncolumn-owner:\n  Eingang: human\n---\n", status: [403, 403, 403, 403, 200] },
        Fall { name: "P0 kein Eigentümer", vorspann: "", status: [200, 200, 200, 200, 200] },
        Fall { name: "P1 verwaister Schlüssel", vorspann: "---\ncolumn-owner:\n  eingang: human\n---\n", status: [403, 403, 403, 403, 200] },
        Fall { name: "P2 Nicht-Text-Wert", vorspann: "---\ncolumn-owner:\n  Eingang: [human]\n---\n", status: [403, 403, 403, 403, 200] },
        Fall { name: "P2b keine Zuordnung", vorspann: "---\ncolumn-owner: human\n---\n", status: [403, 403, 403, 403, 200] },
        Fall { name: "P3 unbekannter Wert", vorspann: "---\ncolumn-owner:\n  Eingang: chef\n---\n", status: [200, 200, 200, 200, 200] },
        Fall { name: "P4 doppelte Nummer", vorspann: "---\ncolumn-owner:\n  In Arbeit: human\n---\n\n# Fabrik\n\n## Eingang\n\n- #1\n\n## In Arbeit\n\n- #1\n\n## Erledigt\n", status: [403, 403, 403, 403, 200] },
        Fall { name: "P6 gesund + defektes Board", vorspann: "---\ncolumn-owner:\n  Eingang: human\n---\n", status: [403, 403, 403, 403, 200] },
    ]
}

fn vorspann_datei(f: &Fall) -> String {
    if f.name.starts_with("P4") {
        f.vorspann.to_string()
    } else {
        fabrik_mit(f.vorspann)
    }
}

#[tokio::test]
async fn angriffsmatrix_agent_je_variante_je_weg() {
    for f in faelle() {
        for (i, &erwartet) in f.status.iter().enumerate() {
            let tmp = tempfile::tempdir().unwrap();
            let boards: Vec<(&str, String)> = match f.name {
                "P6 gesund + defektes Board" => vec![("fabrik", vorspann_datei(&f)), ("kaputt", "---\nstart: kaputt\n---\n\n# Kaputt\n\n## Eingang\n".into())],
                _ => vec![("fabrik", vorspann_datei(&f))],
            };
            ordner(tmp.path(), &boards.iter().map(|(s, t)| (*s, t.as_str())).collect::<Vec<_>>());
            let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
            let vorher = stand(tmp.path());
            let (s, r) = weg(i, &lauf.adresse, "fabrik").await;
            let wozu = format!("{} / W{}", f.name, i + 1);
            assert_eq!(s, erwartet, "{wozu}: {r}");
            if i < 4 && erwartet == 403 {
                assert_eq!(stand(tmp.path()), vorher, "{wozu}: kein Commit, Board unverändert");
            }
            if i == 4 {
                let erwartetes_ergebnis = if f.name.starts_with("P0") || f.name.starts_with("P3") { "erledigt" } else { "gemeldet" };
                assert_eq!(r["ergebnis"], erwartetes_ergebnis, "{wozu}: {r}");
            }
        }
    }
}

/// P5: ein defektes Board liefert dem Agenten auf allen Wegen 423 (PO Z. 188); W1 heute bereits abweichend.
#[tokio::test]
async fn p5_defektes_board_auf_allen_wegen_423() {
    let kaputt = "---\nstart: kaputt\n---\n\n# Kaputt\n\n## Eingang\n\n- #1\n\n## In Arbeit\n";
    for slug in ["kaputt"] {
        let tmp = tempfile::tempdir().unwrap();
        ordner(tmp.path(), &[("fabrik", "# Fabrik\n\n## Eingang\n\n## In Arbeit\n"), (slug, kaputt)]);
        let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
        let vorher = stand(tmp.path());
        let (s, r) = senden(Method::POST, &lauf.adresse, "api/aufgaben/1/archivieren", "cl", json!(null)).await;
        assert_eq!(s, 423, "W1 auf defektem Board: {r}");
        assert!(r["fehler"].as_str().unwrap().contains("boards/kaputt.md"), "Meldung nennt das erste defekte Board: {r}");
        assert!(r["fehler"].as_str().unwrap().contains("nur lesbar, bis die Datei repariert ist"), "{r}");
        assert_eq!(stand(tmp.path()), vorher, "W1: nichts geschrieben");
        for (i, name) in [(1usize, "W2"), (2, "W3"), (3, "W4")] {
            let (s, _) = weg(i, &lauf.adresse, slug).await;
            assert_eq!(s, 423, "{name} auf dem defekten Board");
            let (s, _) = weg(i, &lauf.adresse, "fabrik").await;
            assert_eq!(s, 404, "{name} auf fabrik: Karte liegt dort nicht");
        }
        let (s, _) = senden(Method::POST, &lauf.adresse, "api/aufgaben/erledigen", "cl", json!({"key": "k1", "board": slug, "text": "weg", "signal": "behoben"})).await;
        assert_eq!(s, 423, "W5 auf dem defekten Board");
        let (s, _) = senden(Method::POST, &lauf.adresse, "api/aufgaben/erledigen", "cl", json!({"key": "k1", "board": "fabrik", "text": "weg", "signal": "behoben"})).await;
        assert_eq!(s, 404, "W5 auf fabrik: Karte liegt dort nicht");
    }
}

/// P6: eine Sperre des gesunden Boards verdeckt das defekte Board nicht (403, nicht 423), auch auf W1.
#[tokio::test]
async fn p6_gesundes_board_sperrt_vor_dem_defekten() {
    let tmp = tempfile::tempdir().unwrap();
    ordner(tmp.path(), &[("fabrik", &fabrik_mit("---\ncolumn-owner:\n  Eingang: human\n---\n")), ("kaputt", "---\nstart: kaputt\n---\n\n# Kaputt\n\n## Eingang\n")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = stand(tmp.path());
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/aufgaben/1/archivieren", "cl", json!(null)).await;
    assert_eq!((s, r), (403, verboten(1)), "die Menschen-Spalte des gesunden Boards sperrt");
    assert_eq!(stand(tmp.path()), vorher);
}

fn verboten(nummer: u32) -> Value {
    json!({"fehler": "Spalte „Eingang“ gehört dem Menschen", "spalte": "Eingang", "nummer": nummer})
}

/// Kontrollpaar: der Mensch kommt auf jedem Weg durch; P0 als Agent ebenso (die Probe misst).
#[tokio::test]
async fn mensch_und_kein_eigentuemer_kommen_durch() {
    for wer in ["st", "cl"] {
        for i in 0..5 {
            let tmp = tempfile::tempdir().unwrap();
            let vorspann = if wer == "st" { "---\ncolumn-owner:\n  Eingang: human\n---\n" } else { "" };
            ordner(tmp.path(), &[("fabrik", &fabrik_mit(vorspann))]);
            let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
            let (s, r) = weg_als(i, &lauf.adresse, "fabrik", wer).await;
            assert_eq!(s, 200, "{wer} / W{}: {r}", i + 1);
        }
    }
}

async fn weg_als(nummer: usize, adresse: &str, slug: &str, wer: &str) -> (u16, Value) {
    match nummer {
        0 => senden(Method::POST, adresse, "api/aufgaben/1/archivieren", wer, json!(null)).await,
        1 => senden(Method::DELETE, adresse, &format!("api/boards/{slug}/aufgaben/1"), wer, json!(null)).await,
        2 => senden(Method::POST, adresse, &format!("api/boards/{slug}/bewegen"), wer, json!({"nummer": 1, "spalte": "In Arbeit"})).await,
        3 => mit_instanz(adresse, &format!("api/boards/{slug}/ziehen"), wer, "A", json!({"von": "Eingang", "nach": "In Arbeit"})).await,
        _ => senden(Method::POST, adresse, "api/aufgaben/erledigen", wer, json!({"key": "k1", "board": slug, "text": "weg", "signal": "behoben"})).await,
    }
}

/// AK 8 (Leerzug): ein Zug an dieselbe Stelle (`bewegt: false`) wird auch in einer Menschen-Spalte ausgeführt
/// (200, die Karte wird nicht entnommen) — gewählte Fassung der Offenen Frage R00120 Punkt 9, in der Beschreibung präzisiert.
#[tokio::test]
async fn leerzug_in_menschen_spalte_ist_kein_entnehmen() {
    let tmp = tempfile::tempdir().unwrap();
    ordner(tmp.path(), &[("fabrik", &fabrik_mit("---\ncolumn-owner:\n  Eingang: human\n---\n"))]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = stand(tmp.path());
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/boards/fabrik/bewegen", "cl", json!({"nummer": 1, "spalte": "Eingang", "index": 0})).await;
    assert_eq!((s, r["bewegt"].as_bool()), (200, Some(false)), "Leerzug in der Menschen-Spalte: {r}");
    assert_eq!(stand(tmp.path()), vorher, "#1 bleibt in Eingang, kein Commit");
}

#[tokio::test]
async fn rohwert_bleibt_beim_spalten_speichern() {
    let faelle = [
        ("P1 verwaister Schlüssel", "---\ncolumn-owner:\n  eingang: human\n---\n", "  eingang: human\n"),
        ("P2 Nicht-Text-Wert", "---\ncolumn-owner:\n  Eingang: [human]\n---\n", "  Eingang: [human]\n"),
        ("P2b keine Zuordnung", "---\ncolumn-owner: human\n---\n", "column-owner: human\n"),
    ];
    for (name, vorspann, erwartet) in faelle {
        let tmp = tempfile::tempdir().unwrap();
        ordner(tmp.path(), &[("fabrik", &fabrik_mit(vorspann))]);
        let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
        let (s, r) = senden(Method::GET, &lauf.adresse, "api/boards/fabrik", "st", json!(null)).await;
        assert_eq!(s, 200, "{name}: {r}");
        assert!(r["hinweise"].as_array().unwrap().iter().any(|h| h.as_str().unwrap().contains("column-owner")), "{name}: Hinweis fehlt: {r}");
        // Eine echte Änderung (Notiz an „Erledigt"), damit die Probe den schreibenden Weg wirklich prüft.
        let neu = json!([
            {"name": "Eingang", "alt": "Eingang"},
            {"name": "In Arbeit", "alt": "In Arbeit"},
            {"name": "Erledigt", "alt": "Erledigt", "notiz": "geprüft"}
        ]);
        let (s, r) = senden(Method::PUT, &lauf.adresse, "api/boards/fabrik/spalten", "st", neu).await;
        assert_eq!(s, 200, "{name}: {r}");
        assert_eq!(r["geaendert"], json!(true), "{name}: die Probe schreibt wirklich: {r}");
        assert!(lies(tmp.path(), "boards/fabrik.md").contains(erwartet), "{name}: Rohwert verloren:\n{}", lies(tmp.path(), "boards/fabrik.md"));
    }
}

/// B1 (Code-Review #26, Abnahme-Probe): der skalare `column-owner: human` (das ganze Board meinend) darf nicht
/// verschwinden, wenn dieselbe `PUT …/spalten` einen gültigen Eigentümer an eine Spalte setzt — der Hinweis bleibt,
/// und ein Agent bleibt gesperrt (fail-safe, PO Z. 187).
#[tokio::test]
async fn skalarer_human_bleibt_bei_einem_gueltigen_eigentuemer() {
    let tmp = tempfile::tempdir().unwrap();
    ordner(tmp.path(), &[("fabrik", &fabrik_mit("---\ncolumn-owner: human\n---\n"))]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let neu = json!([
        {"name": "Eingang", "alt": "Eingang"},
        {"name": "In Arbeit", "alt": "In Arbeit"},
        {"name": "Erledigt", "alt": "Erledigt", "eigentuemer": "agent"}
    ]);
    let (s, r) = senden(Method::PUT, &lauf.adresse, "api/boards/fabrik/spalten", "st", neu).await;
    assert_eq!(s, 200, "{r}");
    let (s, r) = senden(Method::GET, &lauf.adresse, "api/boards/fabrik", "st", json!(null)).await;
    assert_eq!(s, 200, "Board bleibt lesbar: {r}");
    assert_eq!(r["spalten"][2]["eigentuemer"], json!("agent"), "der gültige Eigentümer steht: {r}");
    assert!(r["hinweise"].as_array().unwrap().iter().any(|h| h.as_str().unwrap().contains("human")), "der Hinweis für den human-Rohwert bleibt: {r}");
    let vorher = stand(tmp.path());
    let (s, r) = weg(1, &lauf.adresse, "fabrik").await; // vom Board nehmen
    assert_eq!(s, 403, "der Agent bleibt gesperrt: {r}");
    assert_eq!(stand(tmp.path()), vorher, "kein Commit");
}

/// B2 (Code-Review #26, Abnahme-Probe): eine Spalte auf den Namen eines verwaisten `column-owner`-Schlüssels
/// umbenennen darf keinen doppelten YAML-Schlüssel erzeugen — das Board bleibt lesbar (GET 200).
#[tokio::test]
async fn umbenennen_auf_verwaisten_rohschluessel_bleibt_lesbar() {
    let tmp = tempfile::tempdir().unwrap();
    let vorspann = "---\ncolumn-owner:\n  A: chef\n  B: human\n---\n";
    ordner(tmp.path(), &[("fabrik", &format!("{vorspann}\n# Fabrik\n\n## A\n\n## Z\n"))]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let neu = json!([{"name": "B", "alt": "A"}, {"name": "Z", "alt": "Z"}]);
    let (s, r) = senden(Method::PUT, &lauf.adresse, "api/boards/fabrik/spalten", "st", neu).await;
    assert_eq!(s, 200, "{r}");
    let (s, r) = senden(Method::GET, &lauf.adresse, "api/boards/fabrik", "st", json!(null)).await;
    assert_eq!(s, 200, "kein Doppelschlüssel: {r}");
    let datei = lies(tmp.path(), "boards/fabrik.md");
    assert_eq!(datei.matches("\n  B:").count(), 1, "der Schlüssel B steht einmal:\n{datei}");
    assert!(r["hinweise"].as_array().unwrap().iter().any(|h| h.as_str().unwrap().contains("human")), "der verwaiste human bleibt gemeldet: {r}");
}
