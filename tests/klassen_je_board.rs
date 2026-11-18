//! R00195 (ADR-0031): Klassen und Farben je Board, sonst die Vorgabe des Ordners — Datei und API (AK 1–4, US-4, US-5).
mod gemeinsam;

use gemeinsam::{Laufendes, git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

const VORGABE: &str = "---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses:\n  sicherheit: {label: Sicherheit, color: red}\n  eol: {label: EOL, color: amber}\nsources:\n  wbs: plan/wbs.md\n  requirements: anf/\n---\n";
const SPALTEN: &str = "\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n";

/// Die Ausgangslage von R00195: Vorgabe `sicherheit`, `eol`; Boards Wartung und Umzug ohne eigene Klassen;
/// #1 `sicherheit` auf Wartung; #2 `sicherheit`, #3 `eol` und #4 ohne Klasse auf Umzug.
async fn ausgangslage(pfad: &Path) -> Laufendes {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), VORGABE).unwrap();
    std::fs::write(pfad.join("boards/wartung.md"), format!("# Wartung\n{SPALTEN}")).unwrap();
    std::fs::write(pfad.join("boards/umzug.md"), format!("# Umzug\n{SPALTEN}")).unwrap();
    git(pfad, &["init", "-q"]);
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
    let lauf = gemeinsam::starten(pfad, &["--port", "0"]);
    for (titel, board, klasse) in [("Eins", "wartung", Some("sicherheit")), ("Zwei", "umzug", Some("sicherheit")), ("Drei", "umzug", Some("eol")), ("Vier", "umzug", None)] {
        let (s, _) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": titel, "board": board, "klasse": klasse})).await;
        assert_eq!(s, 201, "{titel}");
    }
    lauf
}

fn eigener_satz() -> Value {
    json!({"klassen": [{"schluessel": "phase1", "bezeichnung": "Phase 1", "farbe": "green"}, {"schluessel": "eol", "bezeichnung": "Altlast", "farbe": "#885500"}]})
}

fn commits(ordner: &Path) -> u32 {
    git(ordner, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

/// Alle Dateien des Ordners außer der genannten, als ein Text — „unverändert“ heißt zeichengleich.
fn uebrige_dateien(ordner: &Path, ausser: &str) -> String {
    let namen = git(ordner, &["ls-files"]);
    namen.lines().filter(|n| *n != ausser).map(|n| format!("== {n}\n{}", lies(ordner, n))).collect()
}

async fn klassen_setzen(lauf: &Laufendes, slug: &str, rumpf: Value) -> (u16, Value) {
    senden(Method::PUT, &lauf.adresse, &format!("api/boards/{slug}/klassen"), "st", rumpf).await
}

/// AK 1 / US-5: der Bestand bleibt — kein Commit beim Start, keine Zeile `classes` nach einem Kartenzug, `klassen: null`.
#[tokio::test]
async fn ak1_bestand_ohne_classes_bleibt_zeichengleich() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = ausgangslage(tmp.path()).await;
    drop(lauf);
    let (kopf, umzug_vorher) = (git(tmp.path(), &["rev-parse", "HEAD"]), lies(tmp.path(), "boards/umzug.md"));

    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, b) = senden(Method::GET, &lauf.adresse, "api/boards/umzug", "st", json!(null)).await;
    assert_eq!((s, &b["klassen"]), (200, &json!(null)));
    let (_, alle) = senden(Method::GET, &lauf.adresse, "api/boards", "st", json!(null)).await;
    assert!(alle.as_array().unwrap().iter().all(|b| b["klassen"].is_null()), "{alle}");
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), kopf, "der Start schreibt keinen Commit");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "", "keine Datei ändert sich");

    let (s, _) = senden(Method::POST, &lauf.adresse, "api/boards/umzug/bewegen", "st", json!({"nummer": 3, "spalte": "In Arbeit"})).await;
    assert_eq!(s, 200);
    let umzug = lies(tmp.path(), "boards/umzug.md");
    assert!(!umzug.contains("classes"), "{umzug}");
    let ohne_karte = |text: &str| text.lines().filter(|z| !z.is_empty() && *z != "- [#3](../aufgaben/0003-drei.md)").map(str::to_string).collect::<Vec<_>>();
    assert_eq!(ohne_karte(&umzug), ohne_karte(&umzug_vorher), "nur die Kartenzeile wandert");
    assert!(umzug.contains("## In Arbeit\n\n- [#3](../aufgaben/0003-drei.md)\n"), "{umzug}");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=", "HEAD"]), "boards/umzug.md");
}

/// AK 2 / US-4: der eigene Satz steht in der Board-Datei, in einem Commit, und übersteht Kartenzug und `PUT …/spalten`.
#[tokio::test]
async fn ak2_eigener_satz_steht_in_der_board_datei() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = ausgangslage(tmp.path()).await;
    let (vorher, rest_vorher) = (commits(tmp.path()), uebrige_dateien(tmp.path(), "boards/umzug.md"));

    let (s, r) = klassen_setzen(&lauf, "umzug", eigener_satz()).await;
    assert_eq!((s, r["geaendert"].as_bool()), (200, Some(true)), "{r}");
    let umzug = lies(tmp.path(), "boards/umzug.md");
    assert!(umzug.starts_with("---\nclasses:\n  phase1: {label: Phase 1, color: green}\n  eol: {label: Altlast, color: \"#885500\"}\n---\n\n# Umzug\n"), "{umzug}");
    assert_eq!(commits(tmp.path()), vorher + 1, "genau ein Commit");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=%an|%s", "HEAD"]), "Stefan|Klassen von „Umzug“: phase1, eol\n\nboards/umzug.md");
    assert_eq!(uebrige_dateien(tmp.path(), "boards/umzug.md"), rest_vorher, "kanbanD.md, Wartung und alle Aufgaben unverändert");
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/umzug", "st", json!(null)).await;
    assert_eq!(b["klassen"], eigener_satz()["klassen"]);
    let (_, alle) = senden(Method::GET, &lauf.adresse, "api/boards", "st", json!(null)).await;
    let je_slug = |slug: &str| alle.as_array().unwrap().iter().find(|b| b["slug"] == slug).unwrap()["klassen"].clone();
    assert_eq!((je_slug("umzug"), je_slug("wartung")), (eigener_satz()["klassen"].clone(), json!(null)));

    let (_, r) = klassen_setzen(&lauf, "umzug", eigener_satz()).await;
    assert_eq!(r["geaendert"], false, "derselbe Satz: kein Commit");
    assert_eq!(commits(tmp.path()), vorher + 1);

    let (s, _) = senden(Method::POST, &lauf.adresse, "api/boards/umzug/bewegen", "st", json!({"nummer": 3, "spalte": "In Arbeit"})).await;
    assert_eq!(s, 200);
    let spalten = json!([{"name": "Zu erledigen", "alt": "Zu erledigen"}, {"name": "In Arbeit", "alt": "In Arbeit", "grenze": 2}, {"name": "Erledigt", "alt": "Erledigt"}]);
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/boards/umzug/spalten", "st", spalten).await;
    assert_eq!(s, 200);
    let umzug = lies(tmp.path(), "boards/umzug.md");
    assert!(umzug.starts_with("---\nclasses:\n  phase1: {label: Phase 1, color: green}\n  eol: {label: Altlast, color: \"#885500\"}\nlimits:\n"), "Kartenzug und Spalten erhalten classes: {umzug}");

    let (s, _) = klassen_setzen(&lauf, "umzug", json!({"klassen": []})).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "boards/umzug.md").starts_with("---\nclasses: {}\nlimits:\n"), "[] = ausdrücklich keine Klassen");
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/umzug", "st", json!(null)).await;
    assert_eq!(b["klassen"], json!([]));
}

/// AK 2: `{klassen: null}` nimmt die Zeile heraus — die Datei ist zeichengleich zur Ausgangslage.
#[tokio::test]
async fn ak2_null_kehrt_zeichengleich_zur_vorgabe_zurueck() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = ausgangslage(tmp.path()).await;
    let (vorher, umzug_vorher) = (commits(tmp.path()), lies(tmp.path(), "boards/umzug.md"));
    assert_eq!(klassen_setzen(&lauf, "umzug", json!({"klassen": null})).await.1["geaendert"], false, "schon Vorgabe: kein Commit");
    assert_eq!(klassen_setzen(&lauf, "umzug", eigener_satz()).await.0, 200);
    assert_ne!(lies(tmp.path(), "boards/umzug.md"), umzug_vorher);

    let (s, r) = klassen_setzen(&lauf, "umzug", json!({"klassen": null})).await;
    assert_eq!((s, r["geaendert"].as_bool()), (200, Some(true)));
    assert_eq!(lies(tmp.path(), "boards/umzug.md"), umzug_vorher);
    assert_eq!(commits(tmp.path()), vorher + 2);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "Klassen von „Umzug“: Vorgabe des Ordners");
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/umzug", "st", json!(null)).await;
    assert_eq!(b["klassen"], json!(null));
}

/// AK 3 / US-4: ein ungültiger Satz wird abgewiesen, bevor etwas geschrieben ist; unbekanntes Board 404.
#[tokio::test]
async fn ak3_ungueltiger_satz_400_ohne_commit_unbekanntes_board_404() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = ausgangslage(tmp.path()).await;
    assert_eq!(klassen_setzen(&lauf, "umzug", eigener_satz()).await.0, 200);
    let (vorher, umzug_vorher) = (git(tmp.path(), &["rev-parse", "HEAD"]), lies(tmp.path(), "boards/umzug.md"));
    let k = |s: &str, b: &str, f: &str| json!({"schluessel": s, "bezeichnung": b, "farbe": f});
    let faelle = [
        ("doppelter Schlüssel", json!({"klassen": [k("eol", "EOL", "amber"), k("eol", "Altlast", "red")]}), "doppelt"),
        ("leere Bezeichnung", json!({"klassen": [k("eol", "", "amber")]}), "Bezeichnung"),
        ("Bezeichnung aus Leerzeichen", json!({"klassen": [k("eol", "   ", "amber")]}), "Bezeichnung"),
        ("Farbe lila", json!({"klassen": [k("phase1", "Phase 1", "green"), k("eol", "Altlast", "lila")]}), "lila"),
        ("Schlüssel mit Leerzeichen", json!({"klassen": [k("Phase 1", "Phase 1", "green")]}), "Klassenschlüssel"),
    ];
    for (fall, rumpf, wort) in faelle {
        let (s, f) = klassen_setzen(&lauf, "umzug", rumpf).await;
        assert_eq!(s, 400, "{fall}");
        assert!(f["fehler"].as_str().unwrap_or_default().contains(wort), "{fall}: {f}");
    }
    for (fall, rumpf) in [("ohne klassen", json!({})), ("Text statt Liste", json!({"klassen": "phase1"})), ("Liste statt Objekt", json!([]))] {
        assert_eq!(klassen_setzen(&lauf, "umzug", rumpf).await.0, 400, "{fall}: ein fehlender Schlüssel ist kein „zurück zur Vorgabe“");
    }
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher, "kein Commit");
    assert_eq!(lies(tmp.path(), "boards/umzug.md"), umzug_vorher, "Datei unverändert");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "");
    assert_eq!(klassen_setzen(&lauf, "gibtsnicht", eigener_satz()).await.0, 404);

    // dieselbe Prüfung wie für die Klassen in PUT /api/einstellungen
    let (_, z) = senden(Method::GET, &lauf.adresse, "api/zustand", "st", json!(null)).await;
    let mut e = z["einstellungen"].clone();
    e["klassen"] = json!([k("eol", "EOL", "lila")]);
    let (s, ordner) = senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", e).await;
    let (_, board) = klassen_setzen(&lauf, "umzug", json!({"klassen": [k("eol", "EOL", "lila")]})).await;
    assert_eq!((s, &ordner["fehler"]), (400, &board["fehler"]));
}

async fn anlegen(lauf: &Laufendes, rumpf: Value) -> (u16, String) {
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", rumpf).await;
    (s, r["fehler"].as_str().unwrap_or_default().to_string())
}

async fn aendern(lauf: &Laufendes, nr: u32, rumpf: Value) -> (u16, Value) {
    senden(Method::PATCH, &lauf.adresse, &format!("api/aufgaben/{nr}"), "st", rumpf).await
}

/// AK 4 / US-4: gültig ist, was ein Board der Aufgabe führt; die Abweisung nennt Board und Schlüssel.
#[tokio::test]
async fn ak4_gueltig_ist_was_ein_board_der_aufgabe_fuehrt() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = ausgangslage(tmp.path()).await;
    assert_eq!(klassen_setzen(&lauf, "umzug", eigener_satz()).await.0, 200);
    let vorher = commits(tmp.path());

    assert_eq!(anlegen(&lauf, json!({"titel": "Fünf", "board": "umzug", "klasse": "phase1"})).await.0, 201);
    let (s, f) = anlegen(&lauf, json!({"titel": "Sechs", "board": "umzug", "klasse": "sicherheit"})).await;
    assert!(s == 400 && f.contains("umzug") && f.contains("sicherheit"), "{s} {f}");
    assert_eq!(anlegen(&lauf, json!({"titel": "Sechs", "board": "wartung", "klasse": "sicherheit"})).await.0, 201);
    let (s, f) = anlegen(&lauf, json!({"titel": "Sieben", "board": "wartung", "klasse": "phase1"})).await;
    assert!(s == 400 && f.contains("wartung") && f.contains("phase1"), "{s} {f}");
    assert_eq!(commits(tmp.path()), vorher + 2, "die zwei Abweisungen schreiben nichts");
    assert!(!std::fs::read_dir(tmp.path().join("aufgaben")).unwrap().any(|d| d.unwrap().file_name().to_string_lossy().contains("sieben")));

    // #2 trägt die auf Umzug fremde Klasse `sicherheit`: unverändert mitgeschickt wird sie nicht geprüft
    let (s, a) = aendern(&lauf, 2, json!({"titel": "neu", "klasse": "sicherheit"})).await;
    assert_eq!((s, a["titel"].as_str(), a["klasse"].as_str()), (200, Some("neu"), Some("sicherheit")), "{a}");
    assert!(lies(tmp.path(), "aufgaben/0002-zwei.md").contains("\nclass: sicherheit\n"));
    let (s, a) = aendern(&lauf, 2, json!({"klasse": "eol"})).await;
    assert_eq!((s, a["klasse"].as_str()), (200, Some("eol")));
    let (s, f) = aendern(&lauf, 2, json!({"klasse": "sicherheit"})).await;
    assert!(s == 400 && f["fehler"].as_str().unwrap().contains("umzug") && f["fehler"].as_str().unwrap().contains("sicherheit"), "einmal verlassen, ist die fremde Klasse nicht wieder setzbar: {s} {f}");

    // #3 liegt zusätzlich auf Wartung: die Vorräte beider Boards gelten
    let (s, _) = senden(Method::POST, &lauf.adresse, "api/boards/wartung/aufgaben", "st", json!({"nummer": 3})).await;
    assert_eq!(s, 201);
    assert_eq!(aendern(&lauf, 3, json!({"klasse": "sicherheit"})).await.0, 200);
    assert_eq!(aendern(&lauf, 3, json!({"klasse": "phase1"})).await.0, 200);
    let (s, f) = aendern(&lauf, 3, json!({"klasse": "lila"})).await;
    let f = f["fehler"].as_str().unwrap_or_default().to_string();
    assert!(s == 400 && f.contains("lila") && f.contains("wartung") && f.contains("umzug"), "{s} {f}");

    // auf keinem Board: nur die Vorgabe
    assert_eq!(anlegen(&lauf, json!({"titel": "Ohne Board", "klasse": "eol"})).await.0, 201);
    let (s, f) = anlegen(&lauf, json!({"titel": "Ohne Board 2", "klasse": "phase1"})).await;
    assert!(s == 400 && f.contains("phase1") && f.contains("kanbanD.md"), "{s} {f}");
    let (_, alle) = senden(Method::GET, &lauf.adresse, "api/aufgaben", "st", json!(null)).await;
    let ohne_board = alle["aufgaben"].as_array().unwrap().iter().find(|a| a["titel"] == "Ohne Board").unwrap()["nummer"].as_u64().unwrap() as u32;
    assert_eq!(aendern(&lauf, ohne_board, json!({"klasse": "sicherheit"})).await.0, 200);
    assert_eq!(aendern(&lauf, ohne_board, json!({"klasse": "phase1"})).await.0, 400);
}

/// AK 4: Mehrfach-Ändern und Mehrfach-Anlegen prüfen je Aufgabe gegen ihre Boards; eine Kopie behält die Klasse der Quelle.
#[tokio::test]
async fn ak4_sammelwege_und_kopie_folgen_derselben_regel() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = ausgangslage(tmp.path()).await;
    assert_eq!(klassen_setzen(&lauf, "umzug", eigener_satz()).await.0, 200);
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);

    let mehrere = |klasse_1: &str, klasse_4: &str| json!({"aenderungen": [{"nummer": 1, "klasse": klasse_1}, {"nummer": 4, "klasse": klasse_4}]});
    let (s, f) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", mehrere("eol", "sicherheit")).await;
    let f = f["fehler"].as_str().unwrap_or_default().to_string();
    assert!(s == 400 && f.contains("#4") && f.contains("umzug") && f.contains("sicherheit"), "{s} {f}");
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher, "ein ungültiges Feld bricht ab, bevor etwas geschrieben ist");
    let (s, _) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", mehrere("eol", "phase1")).await;
    assert_eq!(s, 200);

    let (s, f) = senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "st", json!({"titel": [{"titel": "A", "klasse": "phase1"}, {"titel": "B", "klasse": "sicherheit"}], "board": "umzug"})).await;
    assert!(s == 400 && f["fehler"].as_str().unwrap_or_default().contains("umzug"), "{s} {f}");

    // #2 (`sicherheit`, auf Umzug fremd) kopiert auf Umzug: die Kopie trägt dieselbe Klasse, die Quelle bleibt
    let (s, kopie) = senden(Method::POST, &lauf.adresse, "api/aufgaben/2/duplizieren", "st", json!({"board": "umzug"})).await;
    assert_eq!((s, kopie["klasse"].as_str()), (201, Some("sicherheit")), "{kopie}");
    assert!(lies(tmp.path(), "aufgaben/0002-zwei.md").contains("\nclass: sicherheit\n"));
}
