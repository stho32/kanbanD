// R00099 Befund erledigt sich: POST /api/aufgaben/erledigen {key, board, text, signal} — erledigen oder melden, ein Commit
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

const EINSTELLUNGEN: &str = "---\npeople:\n  st: {name: Stefan, kind: human}\n  bot: {name: Sensor, kind: agent}\nclasses: {}\nsignals:\n  behoben: {label: Befund nicht mehr gefunden, color: green}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n---\n";
const SPALTEN: [&str; 5] = ["Eingang", "Freigegeben", "In Arbeit", "Verstehen & Freigabe", "Fertig"];

/// Board „fabrik“ mit fünf Spalten, Eingang gehört dem Menschen; `kopf` ergänzt das Frontmatter des Boards.
/// `karten`: (Nummer, Schlüssel, Spalte oder leer für „nicht auf dem Board“, Zusatz im Frontmatter der Aufgabe).
fn fabrik(pfad: &Path, kopf: &str, karten: &[(u32, &str, &str, &str)]) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), EINSTELLUNGEN).unwrap();
    let mut board = format!("---\ncolumn-owner:\n  Eingang: human\n{kopf}---\n\n# fabrik\n");
    for s in SPALTEN {
        board.push_str(&format!("\n## {s}\n\n"));
        for (nr, _, _, _) in karten.iter().filter(|k| k.2 == s) {
            board.push_str(&format!("- [#{nr}](../aufgaben/{nr:04}-befund.md)\n"));
        }
    }
    std::fs::write(pfad.join("boards/fabrik.md"), board).unwrap();
    for (nr, key, _, zusatz) in karten {
        std::fs::write(pfad.join(format!("aufgaben/{nr:04}-befund.md")), format!("---\nid: {nr}\ntitle: Befund {nr}\nkey: {key}\n{zusatz}---\n")).unwrap();
    }
    git(pfad, &["init", "-q"]);
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
}

fn commits(pfad: &Path) -> usize {
    git(pfad, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

async fn erledigen(adresse: &str, wer: &str, daten: Value) -> (u16, Value) {
    senden(Method::POST, adresse, "api/aufgaben/erledigen", wer, daten).await
}

fn eingespielt(key: &str) -> Value {
    json!({"key": key, "board": "fabrik", "text": "lodash 4.17.21 ist eingespielt", "signal": "behoben"})
}

async fn reservieren(adresse: &str, nr: u32, wer: &str, instanz: &str) {
    let r = reqwest::Client::new().post(format!("{adresse}api/aufgaben/{nr}/reservierung")).header("X-KanbanD-Wer", wer).header("X-KanbanD-Instanz", instanz).send().await.unwrap();
    assert_eq!(r.status().as_u16(), 200);
}

/// Die Nummern einer Spalte aus der Board-Datei, in Reihenfolge.
fn spalte(pfad: &Path, name: &str) -> Vec<u32> {
    let board = lies(pfad, "boards/fabrik.md");
    let rest = board.split(&format!("## {name}\n")).nth(1).unwrap_or_default();
    rest.split("\n## ").next().unwrap().lines().filter_map(|z| z.strip_prefix("- [#")).map(|z| z.split(']').next().unwrap().parse().unwrap()).collect()
}

// AK Erledigen 1, US-1 (B0333)
#[tokio::test]
async fn reservierte_karte_wird_in_einem_commit_erledigt() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), "", &[(3, "k3", "Fertig", ""), (7, "k1", "In Arbeit", "")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    reservieren(&lauf.adresse, 7, "bot", "A").await;
    let vorher = commits(tmp.path());

    let (s, r) = erledigen(&lauf.adresse, "bot", eingespielt("k1")).await;
    assert_eq!((s, &r["ergebnis"], &r["warnungen"], &r["aufgabe"]["nummer"]), (200, &json!("erledigt"), &json!([]), &json!(7)), "{r}");
    assert_eq!(r.as_object().unwrap().keys().collect::<Vec<_>>(), ["aufgabe", "ergebnis", "warnungen"]);
    assert_eq!((spalte(tmp.path(), "Fertig"), spalte(tmp.path(), "In Arbeit")), (vec![7, 3], vec![]));
    let datei = lies(tmp.path(), "aufgaben/0007-befund.md");
    assert!(datei.contains(" · bot · Befund nicht mehr gefunden: lodash 4.17.21 ist eingespielt\n"), "{datei}");
    assert!(!datei.contains("reservation"), "Reservierung entfernt: {datei}");
    assert!(r["aufgabe"]["reservierung"].is_null(), "{r}");
    assert_eq!(commits(tmp.path()), vorher + 1);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#7 erledigt sich: „In Arbeit“ → „Fertig“ (fabrik)");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=", "HEAD"]), "aufgaben/0007-befund.md\nboards/fabrik.md");
}

// AK Gegenbeispiel Spaltenprüfung (B0333): column-checks laufen beim Erledigen nicht
#[tokio::test]
async fn spaltenpruefungen_laufen_beim_erledigen_nicht() {
    let tmp = tempfile::tempdir().unwrap();
    let wirkung = "wbs-effects:\n  - {application: kd, action: create, node: I0048}\n";
    fabrik(tmp.path(), "column-checks:\n  In Arbeit: [wbs-effects-green]\n", &[(7, "k1", "In Arbeit", wirkung)]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());
    let (s, r) = erledigen(&lauf.adresse, "bot", eingespielt("k1")).await;
    assert_eq!((s, &r["ergebnis"], &r["warnungen"]), (200, &json!("erledigt"), &json!([])), "{r}");
    assert_eq!(commits(tmp.path()), vorher + 1);
    assert!(lies(tmp.path(), "boards/fabrik.md").contains("column-checks:\n  In Arbeit: [wbs-effects-green]\n"), "Board-Kopf bleibt");
}

/// Zustand, an dem „nichts geschrieben“ abzulesen ist: Kopf-Commit und alle Dateien.
fn stand(pfad: &Path) -> (String, String) {
    (git(pfad, &["rev-parse", "HEAD"]), git(pfad, &["status", "--porcelain"]))
}

// AK Idempotenz, US-3 (B0334): zweiter Aufruf, archivierte Karte — schon erledigt, kein Commit, kein Kommentar
#[tokio::test]
async fn wiederholung_und_archivierte_sind_schon_erledigt() {
    let tmp = tempfile::tempdir().unwrap();
    let archiviert = "archived: 2026-11-01\n";
    fabrik(tmp.path(), "", &[(7, "k1", "In Arbeit", ""), (2, "k2", "Fertig", archiviert), (4, "k4", "", archiviert)]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    assert_eq!(erledigen(&lauf.adresse, "bot", eingespielt("k1")).await.0, 200);
    let vorher = stand(tmp.path());
    let datei = lies(tmp.path(), "aufgaben/0007-befund.md");
    for (wer, key, nr) in [("bot", "k1", 7), ("st", "k1", 7), ("bot", "k2", 2), ("bot", "k4", 4), ("st", "k4", 4)] {
        let (s, r) = erledigen(&lauf.adresse, wer, eingespielt(key)).await;
        assert_eq!((s, &r["ergebnis"], &r["warnungen"], &r["aufgabe"]["nummer"]), (200, &json!("schon erledigt"), &json!([]), &json!(nr)), "{wer} {key}: {r}");
        assert_eq!(stand(tmp.path()), vorher, "{wer} {key}: kein Commit");
    }
    assert_eq!(lies(tmp.path(), "aufgaben/0007-befund.md"), datei, "kein zweiter Kommentar");
}

// AK Leerfall, Fehlfall, Fehlfall Dublette, US-5 (B0334): 404, 409, 400 — jeweils nichts geschrieben
#[tokio::test]
async fn fehler_schreiben_nichts() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), "", &[(7, "k1", "", ""), (6, "k6", "In Arbeit", ""), (8, "k5", "Eingang", ""), (9, "k5", "In Arbeit", "")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = stand(tmp.path());
    let mit = |feld: &str, wert: Value, key: &str| {
        let mut d = eingespielt(key);
        d[feld] = wert;
        d
    };
    let faelle = [
        ("Karte nicht auf dem Board", eingespielt("k1"), 404, None),
        ("unbekannter Schlüssel", eingespielt("gibtsnicht"), 404, None),
        ("unbekanntes Board", mit("board", json!("gibtsnicht"), "k6"), 404, None),
        ("Dublette", eingespielt("k5"), 409, Some("Schlüssel „k5“ mehrfach vergeben: #8, #9")),
        ("Signal nicht eingerichtet", mit("signal", json!("gibtsnicht"), "k6"), 400, Some("Signal „gibtsnicht“ steht nicht in kanbanD.md")),
        ("Text leer", mit("text", json!(""), "k6"), 400, Some("Text: 1–2000 Zeichen")),
        ("Text nur Leerzeichen", mit("text", json!("   "), "k6"), 400, Some("Text: 1–2000 Zeichen")),
        ("Text 2001 Zeichen", mit("text", json!("x".repeat(2001)), "k6"), 400, Some("Text: 1–2000 Zeichen")),
        ("Text fehlt", json!({"key": "k6", "board": "fabrik", "signal": "behoben"}), 400, Some("Text: 1–2000 Zeichen")),
        ("Schlüssel leer", mit("key", json!("  "), "k6"), 400, Some("Schlüssel: 1–200 Zeichen ohne Zeilenumbruch")),
        ("Board fehlt", json!({"key": "k6", "text": "weg", "signal": "behoben"}), 400, Some("Board fehlt")),
    ];
    for (fall, daten, status, meldung) in faelle {
        let (s, r) = erledigen(&lauf.adresse, "bot", daten).await;
        assert_eq!(s, status, "{fall}: {r}");
        if let Some(m) = meldung {
            assert_eq!(r["fehler"], json!(m), "{fall}");
        }
        assert_eq!(stand(tmp.path()), vorher, "{fall}: nichts geschrieben");
    }
}

// AK Fehlfall „Eingaben vor der Suche“ (B0334): ein ungültiger Text gewinnt gegen 404 und 409
#[tokio::test]
async fn eingaben_werden_vor_der_suche_geprueft() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), "", &[(7, "k1", "", ""), (8, "k5", "Eingang", ""), (9, "k5", "In Arbeit", "")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = stand(tmp.path());
    for (fall, key, board) in [("unbekannter Schlüssel", "gibtsnicht", "fabrik"), ("Dublette", "k5", "fabrik"), ("nicht auf dem Board", "k1", "fabrik"), ("unbekanntes Board", "k1", "gibtsnicht")] {
        let (s, r) = erledigen(&lauf.adresse, "bot", json!({"key": key, "board": board, "text": "   ", "signal": "behoben"})).await;
        assert_eq!((s, &r["fehler"]), (400, &json!("Text: 1–2000 Zeichen")), "{fall}");
        let (s, _) = erledigen(&lauf.adresse, "bot", json!({"key": key, "board": board, "text": "weg", "signal": "gibtsnicht"})).await;
        assert_eq!(s, 400, "{fall}: Signal vor der Suche");
    }
    assert_eq!(stand(tmp.path()), vorher);
}

// AK Grenzwert (B0334): 2000 Zeichen werden angenommen
#[tokio::test]
async fn text_mit_2000_zeichen_wird_erledigt() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), "", &[(7, "k1", "In Arbeit", "")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());
    let text = "ä".repeat(2000);
    let (s, r) = erledigen(&lauf.adresse, "bot", json!({"key": "k1", "board": "fabrik", "text": text, "signal": "behoben"})).await;
    assert_eq!((s, &r["ergebnis"]), (200, &json!("erledigt")), "{r}");
    assert_eq!(commits(tmp.path()), vorher + 1);
    assert_eq!(r["aufgabe"]["kommentare"][0]["text"], json!(format!("Befund nicht mehr gefunden: {text}")));
}

// AK Menschen-Spalte 1–3, US-2, US-3, US-4 (B0336): Agent meldet, statt die Karte herauszunehmen; ein Mensch erledigt
#[tokio::test]
async fn in_der_menschen_spalte_meldet_der_agent() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), "", &[(8, "k2", "Eingang", "")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    reservieren(&lauf.adresse, 8, "bot", "A").await;
    let reservierung = lies(tmp.path(), "aufgaben/0008-befund.md").lines().find(|z| z.starts_with("reservation:")).unwrap().to_string();
    let board = lies(tmp.path(), "boards/fabrik.md");
    let vorher = commits(tmp.path());
    let daten = json!({"key": "k2", "board": "fabrik", "text": "nicht mehr gefunden", "signal": "behoben"});

    let (s, r) = erledigen(&lauf.adresse, "bot", daten.clone()).await;
    assert_eq!((s, &r["ergebnis"], &r["warnungen"], &r["aufgabe"]["signale"]), (200, &json!("gemeldet"), &json!([]), &json!(["behoben"])), "{r}");
    let datei = lies(tmp.path(), "aufgaben/0008-befund.md");
    assert!(datei.contains("\nsignals: [behoben]\n") && datei.contains(&format!("\n{reservierung}\n")), "Signal gesetzt, Reservierung unverändert: {datei}");
    assert_eq!(datei.matches(" · bot · Befund nicht mehr gefunden: nicht mehr gefunden\n").count(), 1, "{datei}");
    assert_eq!(lies(tmp.path(), "boards/fabrik.md"), board, "Karte bleibt im Eingang");
    assert_eq!(commits(tmp.path()), vorher + 1);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#8 Befund nicht mehr gefunden — gemeldet (fabrik)");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=", "HEAD"]), "aufgaben/0008-befund.md");

    let (s, r) = erledigen(&lauf.adresse, "bot", daten.clone()).await;
    assert_eq!((s, &r["ergebnis"], &r["warnungen"]), (200, &json!("schon gemeldet"), &json!([])), "{r}");
    assert_eq!((commits(tmp.path()), lies(tmp.path(), "aufgaben/0008-befund.md")), (vorher + 1, datei), "kein Commit, kein zweiter Kommentar");

    let (s, r) = erledigen(&lauf.adresse, "st", daten).await;
    assert_eq!((s, &r["ergebnis"], &r["warnungen"]), (200, &json!("erledigt"), &json!([])), "{r}");
    assert_eq!((spalte(tmp.path(), "Fertig"), spalte(tmp.path(), "Eingang")), (vec![8], vec![]));
    assert_eq!(commits(tmp.path()), vorher + 2);
}

const GRENZE: &str = "limits:\n  Fertig: 1\n";

// AK Fehlfall Grenze, US-6 (B0337): ein Agent bekommt 409, nichts wird geschrieben; archivierte zählen nicht
#[tokio::test]
async fn agent_ueber_der_grenze_der_abschlussspalte() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), GRENZE, &[(3, "k3", "Fertig", ""), (7, "k1", "In Arbeit", "")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    reservieren(&lauf.adresse, 7, "bot", "A").await;
    let vorher = stand(tmp.path());
    let (s, r) = erledigen(&lauf.adresse, "bot", eingespielt("k1")).await;
    assert_eq!((s, r), (409, json!({"fehler": "Grenze erreicht", "spalte": "Fertig", "grenze": 1, "anzahl": 1})));
    assert_eq!(stand(tmp.path()), vorher, "kein Kommentar, kein Commit");
    assert!(lies(tmp.path(), "aufgaben/0007-befund.md").contains("\nreservation: "), "Reservierung bleibt");
    assert_eq!(spalte(tmp.path(), "In Arbeit"), [7]);

    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), GRENZE, &[(2, "k2", "Fertig", "archived: 2026-11-01\n"), (7, "k1", "In Arbeit", "")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, r) = erledigen(&lauf.adresse, "bot", eingespielt("k1")).await;
    assert_eq!((s, &r["ergebnis"], &r["warnungen"]), (200, &json!("erledigt"), &json!([])), "archivierte zählen nicht: {r}");
}

// AK Grenze, Mensch, US-7 (B0337): der Zug läuft, die Antwort trägt genau eine Warnung grenze mit der Anzahl danach
#[tokio::test]
async fn mensch_ueber_der_grenze_wird_gewarnt() {
    for (fall, mehr) in [("ohne Archivierte", vec![]), ("mit #2 archiviert", vec![(2, "k2", "Fertig", "archived: 2026-11-01\n")])] {
        let tmp = tempfile::tempdir().unwrap();
        let karten = [vec![(3, "k3", "Fertig", ""), (7, "k1", "In Arbeit", "")], mehr].concat();
        fabrik(tmp.path(), GRENZE, &karten);
        let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
        reservieren(&lauf.adresse, 7, "bot", "A").await;
        let vorher = commits(tmp.path());
        let (s, r) = erledigen(&lauf.adresse, "st", eingespielt("k1")).await;
        assert_eq!((s, &r["ergebnis"]), (200, &json!("erledigt")), "{fall}: {r}");
        let w = r["warnungen"].as_array().unwrap();
        assert_eq!(w.len(), 1, "{fall}: {r}");
        assert_eq!((&w[0]["pruefung"], &w[0]["text"]), (&json!("grenze"), &json!("Grenze erreicht: „Fertig“ hat 2 von 1")), "{fall}");
        assert_eq!(spalte(tmp.path(), "Fertig")[..2], [7, 3], "{fall}");
        let datei = lies(tmp.path(), "aufgaben/0007-befund.md");
        assert!(datei.contains(" · st · Befund nicht mehr gefunden: lodash 4.17.21 ist eingespielt\n") && !datei.contains("reservation"), "{fall}: {datei}");
        assert_eq!(commits(tmp.path()), vorher + 1, "{fall}");
        assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#7 erledigt sich: „In Arbeit“ → „Fertig“ (fabrik)");
    }
}

// AK Gegenbeispiel Grenze (B0337): in der Menschen-Spalte meldet der Agent vor der Grenze — 200 gemeldet, kein 409
#[tokio::test]
async fn melden_prueft_keine_grenze() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), GRENZE, &[(3, "k3", "Fertig", ""), (8, "k2", "Eingang", "")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());
    let (s, r) = erledigen(&lauf.adresse, "bot", json!({"key": "k2", "board": "fabrik", "text": "weg", "signal": "behoben"})).await;
    assert_eq!((s, &r["ergebnis"], &r["warnungen"]), (200, &json!("gemeldet"), &json!([])), "{r}");
    assert_eq!((spalte(tmp.path(), "Eingang"), commits(tmp.path())), (vec![8], vorher + 1));
}

// Prüfpunkt Rücklesen (B0334): key wird nur gelesen — nach dem Neuschreiben der Aufgabendatei liest er sich als derselbe
// Text zurück (auch rein numerisch); der Text kommt mit Steuerzeichen, Zahlpräfix, Umlaut und Zeilenumbruch unverändert zurück (\r\n wird \n)
#[tokio::test]
async fn schluessel_und_text_lesen_sich_unveraendert_zurueck() {
    for key in ["0815/größe-ü", "0815"] {
        let tmp = tempfile::tempdir().unwrap();
        fabrik(tmp.path(), "", &[(7, &format!("\"{key}\""), "In Arbeit", "")]);
        let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
        let text = "42. Lösung\tmit\u{1}Steuerzeichen\r\nzweite Zeile \\n kein Umbruch";
        let (s, r) = erledigen(&lauf.adresse, "bot", json!({"key": key, "board": "fabrik", "text": text, "signal": "behoben"})).await;
        assert_eq!((s, &r["ergebnis"]), (200, &json!("erledigt")), "{key}: {r}");
        let erwartet = "Befund nicht mehr gefunden: 42. Lösung\tmit\u{1}Steuerzeichen\nzweite Zeile \\n kein Umbruch";
        assert_eq!(r["aufgabe"]["kommentare"][0]["text"], erwartet, "Antwort");
        let gelesen: Value = reqwest::get(format!("{}api/aufgaben/7", lauf.adresse)).await.unwrap().json().await.unwrap();
        assert_eq!((gelesen["key"].as_str(), gelesen["kommentare"][0]["text"].as_str()), (Some(key), Some(erwartet)), "aus der Datei gelesen: {}", lies(tmp.path(), "aufgaben/0007-befund.md"));
        let (s, r) = erledigen(&lauf.adresse, "bot", json!({"key": key, "board": "fabrik", "text": "x", "signal": "behoben"})).await;
        assert_eq!((s, &r["ergebnis"]), (200, &json!("schon erledigt")), "{key}: über den Schlüssel wiedergefunden: {r}");
    }
}
