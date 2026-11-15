// R00157 Defekte Aufgabendatei mit Schlüssel erzeugt keine zweite Karte (Karte #44, ADR-0004 N1):
// trägt eine defekte Datei lesbar den Schlüssel der Anfrage, weist das Anlegen mit 423 ab.
mod gemeinsam;

use gemeinsam::{git, lies, senden_roh};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

const FUND: &str = "---\nid: 7\ntitle: Fund\nkey: k1\nestimate: abc\n---\n";
const FOLGE: &str = " — nur lesbar, bis die Datei repariert ist; sie trägt den Schlüssel „k1“, angelegt wurde nichts";

/// Grundbestand: Board „fabrik“ mit „Eingang“ und „Fertig“, `cl` Agent, `st` Mensch; dazu von Hand angelegt und
/// committet die genannten Aufgabendateien — kanbanD selbst schreibt keine defekte Datei.
fn bestand(pfad: &Path, dateien: &[(&str, &str)]) {
    gemeinsam::eingerichtet(pfad);
    std::fs::write(pfad.join("boards/fabrik.md"), "# Fabrik\n\n## Eingang\n\n## Fertig\n").unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    for (name, text) in dateien {
        std::fs::write(pfad.join("aufgaben").join(name), text).unwrap();
    }
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "von Hand"]);
}

fn lesbar(nr: u32) -> String {
    format!("---\nid: {nr}\ntitle: Fund\nkey: k1\n---\n")
}

/// Was „nichts angelegt“ vergleicht: Dateien unter `aufgaben/`, HEAD, `git status --porcelain`, `boards/fabrik.md`.
fn stand(pfad: &Path) -> (Vec<String>, String, String, String) {
    let mut dateien: Vec<String> = std::fs::read_dir(pfad.join("aufgaben")).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
    dateien.sort();
    (dateien, git(pfad, &["rev-parse", "HEAD"]), git(pfad, &["status", "--porcelain"]), lies(pfad, "boards/fabrik.md"))
}

async fn anlegen(adresse: &str, pfad: &str, wer: &str, daten: Value) -> (u16, String, Value) {
    let a = senden_roh(Method::POST, adresse, pfad, wer, Some("application/json"), daten.to_string()).await;
    (a.status, a.art.clone(), a.json())
}

/// 423 in der Form mit genau dieser Meldung, und nichts ist angelegt.
async fn abgewiesen(ordner: &Path, adresse: &str, pfad: &str, wer: &str, daten: Value, meldung: &str) {
    let vorher = stand(ordner);
    let (status, art, rumpf) = anlegen(adresse, pfad, wer, daten).await;
    assert_eq!((status, art.as_str(), &rumpf), (423, "application/json", &json!({"fehler": meldung})));
    assert_eq!(stand(ordner), vorher, "nichts angelegt");
}

// AK 1, US-1: die Abnahme-Probe der Karte — formwidrige Schätzung; Agent wie Mensch
#[tokio::test]
async fn schluessel_einer_defekten_datei_haelt_das_anlegen_an() {
    let tmp = tempfile::tempdir().unwrap();
    bestand(tmp.path(), &[("0007-fund.md", FUND)]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let meldung = format!("aufgaben/0007-fund.md: estimate: ganze Zahl von Minuten ≥ 1 erwartet{FOLGE}");
    for wer in ["cl", "st"] {
        abgewiesen(tmp.path(), &lauf.adresse, "api/aufgaben", wer, json!({"titel": "Fund", "key": "k1", "board": "fabrik"}), &meldung).await;
    }
}

// AK 1, Variante: bei mehreren Treffern nennt die Meldung die erste defekte Datei in der Reihenfolge des Lesens
#[tokio::test]
async fn mehrere_treffer_nennen_die_erste_defekte_datei() {
    let tmp = tempfile::tempdir().unwrap();
    bestand(tmp.path(), &[("0009-fund.md", &FUND.replace("id: 7", "id: 9")), ("0007-fund.md", FUND)]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let meldung = format!("aufgaben/0007-fund.md: estimate: ganze Zahl von Minuten ≥ 1 erwartet{FOLGE}");
    abgewiesen(tmp.path(), &lauf.adresse, "api/aufgaben", "cl", json!({"titel": "Fund", "key": "k1", "board": "fabrik"}), &meldung).await;
}

// AK 2: Merge-Konfliktmarker neben einer Zeile `key: k1`
#[tokio::test]
async fn konfliktmarker_mit_schluessel_haelt_an() {
    let tmp = tempfile::tempdir().unwrap();
    bestand(tmp.path(), &[("0007-fund.md", "---\nid: 7\ntitle: Fund\nkey: k1\n<<<<<<< HEAD\nclass: eilig\n=======\nclass: normal\n>>>>>>> sensor\n---\n")]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let meldung = format!("aufgaben/0007-fund.md: Merge-Konfliktmarker in der Datei{FOLGE}");
    abgewiesen(tmp.path(), &lauf.adresse, "api/aufgaben", "cl", json!({"titel": "Fund", "key": "k1", "board": "fabrik"}), &meldung).await;
}

// AK 3: die zweite Datei mit der Nummer 7 ist defekt und trägt den Schlüssel
#[tokio::test]
async fn doppelte_nummer_mit_schluessel_haelt_an() {
    let tmp = tempfile::tempdir().unwrap();
    bestand(tmp.path(), &[("0007-alt.md", "---\nid: 7\ntitle: Alt\n---\n"), ("0007-fund.md", &lesbar(7))]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let meldung = format!("aufgaben/0007-fund.md: Nummer #7 doppelt — auch in aufgaben/0007-alt.md{FOLGE}");
    abgewiesen(tmp.path(), &lauf.adresse, "api/aufgaben", "cl", json!({"titel": "Fund", "key": "k1", "board": "fabrik"}), &meldung).await;
}

// AK 4, US-2: `…/mehrere` als Ganzes — auch die Aufgabe mit `k9` wird nicht angelegt
#[tokio::test]
async fn mehrere_werden_als_ganzes_abgewiesen() {
    let tmp = tempfile::tempdir().unwrap();
    bestand(tmp.path(), &[("0007-fund.md", FUND)]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let meldung = format!("aufgaben/0007-fund.md: estimate: ganze Zahl von Minuten ≥ 1 erwartet{FOLGE}");
    let daten = json!({"titel": [{"titel": "neu", "key": "k9"}, {"titel": "Fund", "key": "k1"}], "board": "fabrik"});
    abgewiesen(tmp.path(), &lauf.adresse, "api/aufgaben/mehrere", "cl", daten, &meldung).await;
}

// AK 7, US-4: die defekte Datei geht einer lesbaren Karte vor — nicht 200
#[tokio::test]
async fn defekte_datei_geht_einer_lesbaren_karte_vor() {
    let tmp = tempfile::tempdir().unwrap();
    bestand(tmp.path(), &[("0007-fund.md", FUND), ("0008-fund.md", &lesbar(8))]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let meldung = format!("aufgaben/0007-fund.md: estimate: ganze Zahl von Minuten ≥ 1 erwartet{FOLGE}");
    abgewiesen(tmp.path(), &lauf.adresse, "api/aufgaben", "cl", json!({"titel": "Fund", "key": "k1"}), &meldung).await;
}

// AK 7: … und zwei lesbaren Karten mit demselben Schlüssel — nicht 409
#[tokio::test]
async fn defekte_datei_geht_der_dublette_vor() {
    let tmp = tempfile::tempdir().unwrap();
    bestand(tmp.path(), &[("0007-fund.md", FUND), ("0008-fund.md", &lesbar(8)), ("0009-fund.md", &lesbar(9))]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let meldung = format!("aufgaben/0007-fund.md: estimate: ganze Zahl von Minuten ≥ 1 erwartet{FOLGE}");
    abgewiesen(tmp.path(), &lauf.adresse, "api/aufgaben", "cl", json!({"titel": "Fund", "key": "k1"}), &meldung).await;
}

// B0742, ADR-0004 N1 Punkt 6: kein neues Feld in der API — `defekte` trägt je Eintrag genau die Felder von heute
#[tokio::test]
async fn defekte_tragen_in_der_api_kein_neues_feld() {
    let tmp = tempfile::tempdir().unwrap();
    bestand(tmp.path(), &[("0007-fund.md", FUND)]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let eintrag = json!([{"pfad": "aufgaben/0007-fund.md", "fehler": "estimate: ganze Zahl von Minuten ≥ 1 erwartet"}]);
    for pfad in ["api/zustand", "api/aufgaben"] {
        let r: Value = reqwest::get(format!("{}{pfad}", lauf.adresse)).await.unwrap().json().await.unwrap();
        assert_eq!(r["defekte"], eintrag, "{pfad}");
    }
    let d: Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse)).await.unwrap().json().await.unwrap();
    let felder: Vec<&String> = d["components"]["schemas"]["DefekteDatei"]["properties"].as_object().unwrap().keys().collect();
    assert_eq!(felder, ["fehler", "pfad"]);
}
