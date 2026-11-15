// R00161 Nicht-UTF-8-Datei in `aufgaben/` wird als defekt geführt statt 500 (Karte #171):
// eine fremd gespeicherte Datei sperrt nicht mehr den ganzen Ordner — und bleibt selbst unberührt.
mod gemeinsam;

use gemeinsam::{git, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

const DATEI: &str = "aufgaben/0007-kaputt.md";
const KAPUTT: &[u8] = &[0xFF, 0xFE, 0x00];
const GRUND: &str = "Datei ist kein gültiges UTF-8 — als UTF-8 speichern";

/// Grundbestand: Board „fabrik“ mit „Eingang“ (dort `karten`) und „Fertig“, `cl` Agent; dazu von Hand angelegt und
/// committet die genannten Aufgabendateien — kanbanD selbst schreibt keine defekte Datei.
fn bestand(pfad: &Path, karten: &str, dateien: &[(&str, &[u8])]) {
    gemeinsam::eingerichtet(pfad);
    std::fs::write(pfad.join("boards/fabrik.md"), format!("# Fabrik\n\n## Eingang\n\n{karten}## Fertig\n")).unwrap();
    for (rel, bytes) in dateien {
        std::fs::create_dir_all(pfad.join(rel).parent().unwrap()).unwrap();
        std::fs::write(pfad.join(rel), bytes).unwrap();
    }
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "von Hand"]);
}

async fn holen(adresse: &str, pfad: &str) -> (u16, Value) {
    let r = reqwest::get(format!("{adresse}{pfad}")).await.unwrap();
    (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
}

/// Dateien unter `aufgaben/`, HEAD und `git status --porcelain`.
fn stand(pfad: &Path) -> (Vec<String>, String, String) {
    let mut dateien: Vec<String> = std::fs::read_dir(pfad.join("aufgaben")).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
    dateien.sort();
    (dateien, git(pfad, &["rev-parse", "HEAD"]), git(pfad, &["status", "--porcelain"]))
}

// AK 1 und AK 2, US-1 und US-2: die Abnahme-Probe der Karte — Zustand 200 mit Pfad und Grund, Anlegen mit und ohne
// Schlüssel 201 als #8 und #9; die Datei bleibt bytegleich, und kein Commit berührt sie
#[tokio::test]
async fn nicht_utf8_datei_wird_als_defekt_gefuehrt_und_bleibt_unberuehrt() {
    let tmp = tempfile::tempdir().unwrap();
    bestand(tmp.path(), "", &[(DATEI, KAPUTT)]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let (status, zustand) = holen(&lauf.adresse, "api/zustand").await;
    assert_eq!((status, &zustand["defekte"]), (200, &json!([{"pfad": DATEI, "fehler": GRUND}])), "{zustand}");

    for (daten, nummer, datei) in [(json!({"titel": "A", "key": "k1"}), 8, "0008-a.md"), (json!({"titel": "B"}), 9, "0009-b.md")] {
        let (status, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "cl", daten).await;
        assert_eq!((status, &a["nummer"], &a["datei"]), (201, &json!(nummer), &json!(datei)), "{a}");
    }

    assert_eq!(std::fs::read(tmp.path().join(DATEI)).unwrap(), KAPUTT, "bytegleich");
    assert_eq!(git(tmp.path(), &["log", "--format=%s", "--", DATEI]).trim(), "von Hand", "kein Commit berührt die Datei");
    let (dateien, _, offen) = stand(tmp.path());
    assert_eq!((dateien, offen.trim()), (vec!["0007-kaputt.md".to_string(), "0008-a.md".to_string(), "0009-b.md".to_string()], ""));
}

// AK 3, US-3: ein lesbarer Schlüssel im Kopf zählt weiter — 423 wie bei jeder defekten Datei mit Schlüssel (R00157)
#[tokio::test]
async fn lesbarer_schluessel_der_nicht_utf8_datei_haelt_das_anlegen_an() {
    let tmp = tempfile::tempdir().unwrap();
    bestand(tmp.path(), "", &[(DATEI, b"---\nid: 7\ntitle: Fund\nkey: abc\n---\nText \xFF\n")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = stand(tmp.path());

    let (status, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "cl", json!({"titel": "Fund", "key": "abc"})).await;

    let meldung = format!("{DATEI}: {GRUND} — nur lesbar, bis die Datei repariert ist; sie trägt den Schlüssel „abc“, angelegt wurde nichts");
    assert_eq!((status, &a), (423, &json!({"fehler": meldung})));
    assert_eq!(stand(tmp.path()), vorher, "keine zweite Karte, kein Commit");
}

// AK 4: der Rest des Ordners bleibt bedienbar — Liste und Zug einer lesbaren Karte; die defekte Datei ist keine Karte
#[tokio::test]
async fn lesbare_karten_bleiben_neben_der_nicht_utf8_datei_bedienbar() {
    let tmp = tempfile::tempdir().unwrap();
    bestand(tmp.path(), "- #1\n\n", &[(DATEI, KAPUTT), ("aufgaben/0001-eins.md", b"---\nid: 1\ntitle: eins\n---\n")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let (status, liste) = holen(&lauf.adresse, "api/aufgaben").await;
    let nummern: Vec<u64> = liste["aufgaben"].as_array().unwrap().iter().map(|a| a["nummer"].as_u64().unwrap()).collect();
    assert_eq!((status, nummern, &liste["defekte"]), (200, vec![1], &json!([{"pfad": DATEI, "fehler": GRUND}])));

    let (status, r) = senden(Method::POST, &lauf.adresse, "api/boards/fabrik/bewegen", "cl", json!({"nummer": 1, "spalte": "Fertig"})).await;
    assert_eq!(status, 200, "{r}");
    let board = gemeinsam::lies(tmp.path(), "boards/fabrik.md");
    let (eingang, fertig) = board.split_once("## Fertig").unwrap();
    assert!(!eingang.contains("#1") && fertig.contains("#1"), "der Zug steht in der Board-Datei: {board}");
    assert_eq!(std::fs::read(tmp.path().join(DATEI)).unwrap(), KAPUTT, "bytegleich");
}

// AK 5, Gegenprobe: ein echter Zugriffsfehler (kein Leserecht) bleibt 500 „Dateizugriff: …“
#[cfg(unix)]
#[tokio::test]
async fn datei_ohne_leserecht_bleibt_ein_zugriffsfehler() {
    use std::os::unix::fs::PermissionsExt;
    let tmp = tempfile::tempdir().unwrap();
    bestand(tmp.path(), "", &[(DATEI, b"---\nid: 7\ntitle: Fund\n---\n")]);
    let datei = tmp.path().join(DATEI);
    std::fs::set_permissions(&datei, std::fs::Permissions::from_mode(0o000)).unwrap();
    if std::fs::read(&datei).is_ok() {
        eprintln!("übersprungen: als root greift chmod 000 nicht");
        return;
    }
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let (status, r) = holen(&lauf.adresse, "api/zustand").await;

    assert_eq!(status, 500, "{r}");
    assert!(r["fehler"].as_str().unwrap().starts_with("Dateizugriff: "), "{r}");
}
