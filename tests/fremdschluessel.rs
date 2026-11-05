// R00098 Idempotentes Anlegen über einen Fremdschlüssel: key beim Anlegen, 201 neu gegen 200 vorhanden
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

const UNGUELTIG: &str = "Schlüssel: 1–200 Zeichen ohne Zeilenumbruch";

/// Board „Fabrik“ mit „Eingang“ und „Fertig“; `cl` ist Agent (der Sensor), `st` Mensch.
fn fabrik(pfad: &Path) {
    gemeinsam::eingerichtet(pfad);
    std::fs::write(pfad.join("boards/fabrik.md"), "# Fabrik\n\n## Eingang\n\n## Fertig\n").unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
}

fn commits(pfad: &Path) -> usize {
    git(pfad, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

fn aufgabendateien(pfad: &Path) -> Vec<String> {
    let mut d: Vec<String> = std::fs::read_dir(pfad.join("aufgaben")).map(|r| r.map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect()).unwrap_or_default();
    d.sort();
    d
}

async fn anlegen(adresse: &str, daten: Value) -> (u16, Value) {
    senden(Method::POST, adresse, "api/aufgaben", "cl", daten).await
}

// US-1, US-2 (B0318)
#[tokio::test]
async fn erster_fund_legt_an_derselbe_fund_liefert_dieselbe_karte() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());
    let (s, a) = anlegen(&lauf.adresse, json!({"titel": "Abhängigkeit veraltet", "key": "shop/nc-304/lodash", "board": "fabrik", "spalte": "Eingang"})).await;
    assert_eq!((s, &a["nummer"], &a["neu"], &a["key"]), (201, &json!(1), &json!(true), &json!("shop/nc-304/lodash")));
    assert_eq!(lies(tmp.path(), "aufgaben/0001-abhaengigkeit-veraltet.md"), "---\nid: 1\ntitle: Abhängigkeit veraltet\nkey: shop/nc-304/lodash\n---\n");
    assert_eq!(commits(tmp.path()), vorher + 1);

    let (s, b) = anlegen(&lauf.adresse, json!({"titel": "anders", "key": "shop/nc-304/lodash", "board": "fabrik", "spalte": "Eingang"})).await;
    assert_eq!((s, &b["nummer"], &b["neu"], &b["titel"]), (200, &json!(1), &json!(false), &json!("Abhängigkeit veraltet")));
    assert_eq!(commits(tmp.path()), vorher + 1, "kein neuer Commit");
    assert_eq!(aufgabendateien(tmp.path()), ["0001-abhaengigkeit-veraltet.md"]);
    assert!(lies(tmp.path(), "aufgaben/0001-abhaengigkeit-veraltet.md").contains("title: Abhängigkeit veraltet\n"), "Titel unverändert");
    assert_eq!(lies(tmp.path(), "boards/fabrik.md"), "# Fabrik\n\n## Eingang\n\n- [#1](../aufgaben/0001-abhaengigkeit-veraltet.md)\n\n## Fertig\n", "nicht ein zweites Mal einsortiert");
}

// AK Groß/Klein, Trimmen, Grenzwerte (B0318)
#[tokio::test]
async fn schluessel_genau_getrimmt_und_bis_200_zeichen() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    assert_eq!(anlegen(&lauf.adresse, json!({"titel": "a", "key": "k4"})).await.0, 201);
    let (s, gross) = anlegen(&lauf.adresse, json!({"titel": "b", "key": "K4"})).await;
    assert_eq!((s, &gross["nummer"], &gross["neu"]), (201, &json!(2), &json!(true)), "K4 trifft k4 nicht");
    let (s, getrimmt) = anlegen(&lauf.adresse, json!({"titel": "c", "key": "  k1  "})).await;
    assert_eq!((s, &getrimmt["key"]), (201, &json!("k1")));
    assert!(lies(tmp.path(), "aufgaben/0003-c.md").contains("\nkey: k1\n"));
    let (s, wieder) = anlegen(&lauf.adresse, json!({"titel": "d", "key": "k1"})).await;
    assert_eq!((s, &wieder["nummer"]), (200, &json!(3)));
    let lang = "x".repeat(200);
    let (s, a) = anlegen(&lauf.adresse, json!({"titel": "e", "key": lang})).await;
    assert_eq!((s, &a["key"]), (201, &json!(lang)));
    assert_eq!(anlegen(&lauf.adresse, json!({"titel": "f", "key": "z"})).await.0, 201, "ein Zeichen");
}

// US-5, AK Fehlfall (B0318)
#[tokio::test]
async fn ungueltiger_schluessel_legt_nichts_an() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let kopf = git(tmp.path(), &["rev-parse", "HEAD"]);
    for key in [json!(""), json!("   "), json!("x".repeat(201)), json!("shop/nc-304\nlodash"), json!("a\r\nb")] {
        let (s, f) = anlegen(&lauf.adresse, json!({"titel": "x", "key": key, "board": "fabrik"})).await;
        assert_eq!((s, f["fehler"].as_str().unwrap_or("")), (400, UNGUELTIG), "{key}");
        let (s, f) = senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "cl", json!({"titel": [{"titel": "gut", "key": "k9"}, {"titel": "x", "key": key}], "board": "fabrik"})).await;
        assert_eq!((s, f["fehler"].as_str().unwrap_or("")), (400, UNGUELTIG), "mehrere: {key}");
    }
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), kopf, "kein Commit");
    assert!(aufgabendateien(tmp.path()).is_empty(), "keine Datei");
    assert_eq!(lies(tmp.path(), "boards/fabrik.md"), "# Fabrik\n\n## Eingang\n\n## Fertig\n");
}

// AK mehrere (B0318)
#[tokio::test]
async fn mehrere_fuehrt_gleiche_schluessel_der_anfrage_zusammen() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "cl", json!({"titel": [{"titel": "a", "key": "k3"}, {"titel": "b", "key": "k3"}, {"titel": "c"}], "board": "fabrik"})).await;
    assert_eq!(s, 201);
    let paare: Vec<(Value, Value)> = r.as_array().unwrap().iter().map(|a| (a["nummer"].clone(), a["neu"].clone())).collect();
    assert_eq!(paare, [(json!(1), json!(true)), (json!(1), json!(false)), (json!(2), json!(true))]);
    assert_eq!(aufgabendateien(tmp.path()), ["0001-a.md", "0002-c.md"]);
    assert!(lies(tmp.path(), "aufgaben/0001-a.md").contains("title: a\nkey: k3\n"), "Titel des ersten Eintrags");
    assert_eq!(commits(tmp.path()), vorher + 1, "ein Commit");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1–#2 angelegt (2 Aufgaben) in „Eingang“ (Fabrik)");
    assert_eq!(lies(tmp.path(), "boards/fabrik.md"), "# Fabrik\n\n## Eingang\n\n- [#1](../aufgaben/0001-a.md)\n- [#2](../aufgaben/0002-c.md)\n\n## Fertig\n");

    let (s, r) = senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "cl", json!({"titel": [{"titel": "x", "key": "k3"}], "board": "fabrik"})).await;
    assert_eq!((s, &r[0]["nummer"], &r[0]["neu"]), (200, &json!(1), &json!(false)), "nichts neu → 200");
    assert_eq!(commits(tmp.path()), vorher + 1, "kein Commit ohne neue Datei");
}

// AK Leerfall (B0318)
#[tokio::test]
async fn ohne_schluessel_wie_bisher() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    for _ in 0..2 {
        let (s, a) = anlegen(&lauf.adresse, json!({"titel": "Lose"})).await;
        assert_eq!((s, &a["neu"], &a["key"]), (201, &json!(true), &Value::Null));
    }
    assert_eq!(aufgabendateien(tmp.path()), ["0001-lose.md", "0002-lose.md"], "ohne key keine Zusammenführung");
    assert_eq!(lies(tmp.path(), "aufgaben/0001-lose.md"), "---\nid: 1\ntitle: Lose\n---\n", "keine Zeile key");
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "cl", json!({"titel": ["p", "q"]})).await;
    assert_eq!((s, r.as_array().unwrap().iter().all(|a| a["neu"] == json!(true))), (201, true));
}

/// Zwei Dateien mit demselben Schlüssel, von Hand angelegt und committet.
fn dublette(pfad: &Path, key: &str) {
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    for nr in [8, 9] {
        std::fs::write(pfad.join(format!("aufgaben/000{nr}-fund.md")), format!("---\nid: {nr}\ntitle: Fund\nkey: {key}\n---\n")).unwrap();
    }
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Dublette"]);
}

// AK Dublette (B0320)
#[tokio::test]
async fn dublette_weist_ab() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    dublette(tmp.path(), "k5");
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let kopf = git(tmp.path(), &["rev-parse", "HEAD"]);
    let (s, f) = anlegen(&lauf.adresse, json!({"titel": "Fund", "key": "k5", "board": "fabrik"})).await;
    assert_eq!((s, f["fehler"].as_str().unwrap_or("")), (409, "Schlüssel „k5“ mehrfach vergeben: #8, #9"));
    let (s, f) = senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "cl", json!({"titel": [{"titel": "neu", "key": "k6"}, {"titel": "Fund", "key": "k5"}], "board": "fabrik"})).await;
    assert_eq!((s, f["fehler"].as_str().unwrap_or("")), (409, "Schlüssel „k5“ mehrfach vergeben: #8, #9"), "ganze Anfrage abgewiesen");
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), kopf, "kein Commit");
    assert_eq!(aufgabendateien(tmp.path()), ["0008-fund.md", "0009-fund.md"], "keine Datei");
    assert_eq!(lies(tmp.path(), "boards/fabrik.md"), "# Fabrik\n\n## Eingang\n\n## Fertig\n");
}

const ZEIT: &str = "2026-10-20 09:00 · 2026-10-20 10:00 · st";
const ALT: &str = "2026-10-20 10:05 · st · behoben";

/// #3 offen in „Eingang“, #7 mit k4 behoben und archiviert in „Fertig“, mit früherer Zeit und früherem Kommentar.
fn behoben(pfad: &Path) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("aufgaben/0003-offen.md"), "---\nid: 3\ntitle: offen\n---\n").unwrap();
    std::fs::write(pfad.join("aufgaben/0007-fund.md"), format!("---\nid: 7\ntitle: Fund\nkey: k4\narchived: 2026-10-21\n---\n```kanbanD-time\n{ZEIT}\n```\n\n```kanbanD-comments\n{ALT}\n```\n")).unwrap();
    std::fs::write(pfad.join("boards/fabrik.md"), "# Fabrik\n\n## Eingang\n\n- [#3](../aufgaben/0003-offen.md)\n\n## In Arbeit\n\n## Fertig\n\n- [#7](../aufgaben/0007-fund.md)\n").unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "behoben"]);
}

fn spalte(pfad: &Path, name: &str) -> Vec<u32> {
    let text = lies(pfad, "boards/fabrik.md");
    let teil = text.split(&format!("## {name}\n")).nth(1).unwrap_or("");
    let teil = teil.split("\n## ").next().unwrap();
    teil.lines().filter_map(|z| z.strip_prefix("- [#")?.split(']').next()?.parse().ok()).collect()
}

fn wieder_offen_mit_geschichte(pfad: &Path) {
    let t = lies(pfad, "aufgaben/0007-fund.md");
    assert!(!t.contains("archived:"), "nicht mehr archiviert: {t}");
    assert!(t.contains("\nkey: k4\n") && t.contains("title: Fund\n"), "{t}");
    assert!(t.contains(&format!("{ZEIT}\n")) && t.contains(&format!("{ALT}\n")), "frühere Zeiten und Kommentare: {t}");
    assert!(t.contains(" · cl · Erneut gefunden (Schlüssel „k4“)\n"), "Kommentar von cl: {t}");
    assert_eq!(t.matches("Erneut gefunden").count(), 1, "genau ein neuer Kommentar");
}

// US-3, AK Wiederöffnen (B0323)
#[tokio::test]
async fn befund_kehrt_zurueck_in_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    behoben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());
    let (s, a) = anlegen(&lauf.adresse, json!({"titel": "x", "key": "k4", "board": "fabrik", "spalte": "Eingang"})).await;
    assert_eq!((s, &a["nummer"], &a["neu"], &a["titel"]), (200, &json!(7), &json!(false), &json!("Fund")));
    assert_eq!(a["archiviert"], Value::Null);
    wieder_offen_mit_geschichte(tmp.path());
    assert_eq!((spalte(tmp.path(), "Eingang"), spalte(tmp.path(), "Fertig")), (vec![7, 3], vec![]), "oben in Eingang, raus aus Fertig");
    assert_eq!(commits(tmp.path()), vorher + 1);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#7 erneut gefunden: wieder geöffnet");
    assert_eq!(aufgabendateien(tmp.path()), ["0003-offen.md", "0007-fund.md"], "keine neue Datei");

    let (s, b) = anlegen(&lauf.adresse, json!({"titel": "x", "key": "k4", "board": "fabrik", "spalte": "Eingang"})).await;
    assert_eq!((s, &b["nummer"], &b["neu"]), (200, &json!(7), &json!(false)), "jetzt offen: unverändert");
    assert_eq!(commits(tmp.path()), vorher + 1);
}

// AK Wiederöffnen ohne spalte / ohne board (B0323)
#[tokio::test]
async fn wiederoeffnen_ohne_spalte_erste_ohne_board_alte_spalte() {
    let tmp = tempfile::tempdir().unwrap();
    behoben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    assert_eq!(anlegen(&lauf.adresse, json!({"titel": "x", "key": "k4", "board": "fabrik"})).await.0, 200);
    assert_eq!((spalte(tmp.path(), "Eingang"), spalte(tmp.path(), "Fertig")), (vec![7, 3], vec![]), "ohne spalte: erste Spalte");

    let tmp = tempfile::tempdir().unwrap();
    behoben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    assert_eq!(anlegen(&lauf.adresse, json!({"titel": "x", "key": "k4"})).await.0, 200);
    wieder_offen_mit_geschichte(tmp.path());
    assert_eq!((spalte(tmp.path(), "Eingang"), spalte(tmp.path(), "Fertig")), (vec![3], vec![7]), "ohne board: bleibt in Fertig");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#7 erneut gefunden: wieder geöffnet");
}

// AK Wiederöffnen über …/mehrere (B0323)
#[tokio::test]
async fn mehrere_mit_archiviertem_und_neuem_in_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    behoben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "cl", json!({"titel": [{"titel": "x", "key": "k4"}, {"titel": "Neu", "key": "k8"}, {"titel": "y", "key": "k4"}], "board": "fabrik"})).await;
    assert_eq!(s, 201);
    let paare: Vec<(Value, Value)> = r.as_array().unwrap().iter().map(|a| (a["nummer"].clone(), a["neu"].clone())).collect();
    assert_eq!(paare, [(json!(7), json!(false)), (json!(8), json!(true)), (json!(7), json!(false))]);
    wieder_offen_mit_geschichte(tmp.path());
    assert_eq!(commits(tmp.path()), vorher + 1, "ein Commit");
    assert_eq!(aufgabendateien(tmp.path()), ["0003-offen.md", "0007-fund.md", "0008-neu.md"]);
    assert_eq!(spalte(tmp.path(), "Eingang"), vec![7, 3, 8]);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#8 „Neu“ angelegt in „Eingang“ (Fabrik); #7 erneut gefunden: wieder geöffnet");
}

/// Wie `behoben`, aber „fabrik“ mit Grenzen (`limits:`-Zeilen) und offenen Karten in „Eingang“ und „Fertig“ (#7 bleibt in „Fertig“).
fn voll(pfad: &Path, limits: &str, eingang: &[u32], fertig: &[u32]) {
    behoben(pfad);
    for nr in eingang.iter().chain(fertig) {
        std::fs::write(pfad.join(format!("aufgaben/{nr:04}-k.md")), format!("---\nid: {nr}\ntitle: k{nr}\n---\n")).unwrap();
    }
    let zeilen = |n: &[u32]| n.iter().map(|nr| format!("- #{nr}\n")).collect::<String>();
    let board = format!("---\nlimits:\n{limits}---\n\n# Fabrik\n\n## Eingang\n\n{}\n## In Arbeit\n\n## Fertig\n\n{}- #7\n", zeilen(eingang), zeilen(fertig));
    std::fs::write(pfad.join("boards/fabrik.md"), board).unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "voll"]);
}

/// HEAD und alle Dateien — was eine Abweisung nicht verändern darf.
fn alles(pfad: &Path) -> (String, Vec<(String, String)>) {
    let mut d: Vec<(String, String)> = ["boards", "aufgaben"].iter().flat_map(|o| std::fs::read_dir(pfad.join(o)).unwrap().map(|e| e.unwrap().path())).map(|p| (p.display().to_string(), std::fs::read_to_string(&p).unwrap())).collect();
    d.sort();
    (git(pfad, &["rev-parse", "HEAD"]), d)
}

// AK Fehlfall Grenze (B0324)
#[tokio::test]
async fn grenze_beim_wiederoeffnen() {
    let tmp = tempfile::tempdir().unwrap();
    voll(tmp.path(), "  Eingang: 2\n", &[5, 6], &[]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = alles(tmp.path());
    let (s, f) = anlegen(&lauf.adresse, json!({"titel": "x", "key": "k4", "board": "fabrik"})).await;
    assert_eq!((s, f), (409, json!({"fehler": "Grenze erreicht", "spalte": "Eingang", "grenze": 2, "anzahl": 2})));
    assert_eq!(alles(tmp.path()), vorher, "#7 bleibt archiviert, kein Commit");

    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "x", "key": "k4", "board": "fabrik"})).await;
    assert_eq!((s, &a["nummer"], &a["neu"], a.get("warnungen")), (200, &json!(7), &json!(false), None), "Mensch: ohne Warnung");
    assert!(!lies(tmp.path(), "aufgaben/0007-fund.md").contains("archived:"));
}

// AK Grenze: ohne board zählt die Karte wieder in ihrer alten Spalte (B0324)
#[tokio::test]
async fn grenze_der_alten_spalte_ohne_board() {
    let tmp = tempfile::tempdir().unwrap();
    voll(tmp.path(), "  Fertig: 1\n", &[], &[9]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = alles(tmp.path());
    let (s, f) = anlegen(&lauf.adresse, json!({"titel": "x", "key": "k4"})).await;
    assert_eq!((s, f), (409, json!({"fehler": "Grenze erreicht", "spalte": "Fertig", "grenze": 1, "anzahl": 1})));
    assert_eq!(alles(tmp.path()), vorher);
}

// AK Grenze in …/mehrere nach dem Stand aller Einträge (B0324)
#[tokio::test]
async fn grenze_in_mehrere_nach_allen_eintraegen() {
    let tmp = tempfile::tempdir().unwrap();
    voll(tmp.path(), "  Eingang: 3\n", &[5, 6], &[]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = alles(tmp.path());
    let (s, f) = senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "cl", json!({"titel": [{"titel": "x", "key": "k4"}, {"titel": "neu"}], "board": "fabrik"})).await;
    assert_eq!((s, f), (409, json!({"fehler": "Grenze erreicht", "spalte": "Eingang", "grenze": 3, "anzahl": 2})));
    assert_eq!(alles(tmp.path()), vorher);
    let (s, _) = senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "cl", json!({"titel": [{"titel": "x", "key": "k4"}], "board": "fabrik"})).await;
    assert_eq!(s, 200, "allein passt das Wiederöffnen unter die Grenze");
}

/// Wie `behoben`, „fabrik“ mit Menschen-Spalten nach `besitz` (`column-owner`-Zeilen).
fn menschenspalten(pfad: &Path, besitz: &str) {
    behoben(pfad);
    std::fs::write(pfad.join("boards/fabrik.md"), format!("---\ncolumn-owner:\n{besitz}---\n\n# Fabrik\n\n## Eingang\n\n- #3\n\n## In Arbeit\n\n## Fertig\n\n- #7\n")).unwrap();
    git(pfad, &["commit", "-q", "-a", "-m", "Eigentümer"]);
}

// AK Eigentümer: Wiederöffnen ist kein Herausnehmen nach R00097 (PO-Zeilen 67–68, B0325)
#[tokio::test]
async fn agent_oeffnet_aus_menschenspalte() {
    for besitz in ["  Fertig: human\n", "  Eingang: human\n  Fertig: human\n"] {
        let tmp = tempfile::tempdir().unwrap();
        menschenspalten(tmp.path(), besitz);
        let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
        let vorher = commits(tmp.path());
        let (s, a) = anlegen(&lauf.adresse, json!({"titel": "x", "key": "k4", "board": "fabrik", "spalte": "Eingang"})).await;
        assert_eq!((s, &a["nummer"], &a["neu"]), (200, &json!(7), &json!(false)), "{besitz}: {a}");
        assert_eq!((spalte(tmp.path(), "Eingang"), spalte(tmp.path(), "Fertig")), (vec![7, 3], vec![]), "{besitz}");
        assert_eq!(commits(tmp.path()), vorher + 1, "{besitz}");
        assert!(lies(tmp.path(), "boards/fabrik.md").starts_with(&format!("---\ncolumn-owner:\n{besitz}---\n")), "Eigentümer bleiben");
        wieder_offen_mit_geschichte(tmp.path());
    }
}

// AK PATCH mit key, einzeln und über …/mehrere (B0326)
#[tokio::test]
async fn schluessel_ist_nicht_aenderbar() {
    let tmp = tempfile::tempdir().unwrap();
    behoben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = alles(tmp.path());
    for wert in [json!("x"), json!("k4"), Value::Null, json!(5)] {
        let (s, f) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/7", "cl", json!({"key": wert, "titel": "anders"})).await;
        assert_eq!((s, &f["fehler"]), (400, &json!("Schlüssel ist nicht änderbar")), "{wert}");
        let (s, f) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", json!({"aenderungen": [{"nummer": 3, "titel": "y"}, {"nummer": 7, "key": wert}]})).await;
        assert_eq!(s, 400, "{wert}");
        assert!(f["fehler"].as_str().unwrap().ends_with("Schlüssel ist nicht änderbar"), "{f}");
        assert_eq!(alles(tmp.path()), vorher, "{wert}: Dateien byte-gleich, kein Commit");
    }
    let (s, _) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/7", "cl", json!({"titel": "anders"})).await;
    assert_eq!(s, 200, "ohne key wie bisher");
}

async fn gefiltert(adresse: &str, abfrage: &str) -> Vec<u64> {
    let (s, r) = senden(Method::GET, adresse, &format!("api/aufgaben?{abfrage}"), "cl", Value::Null).await;
    assert_eq!(s, 200, "{abfrage}: {r}");
    r["aufgaben"].as_array().unwrap().iter().map(|a| a["nummer"].as_u64().unwrap()).collect()
}

// AK Filter (B0328)
#[tokio::test]
async fn filter_key() {
    let tmp = tempfile::tempdir().unwrap();
    behoben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    assert_eq!(gefiltert(&lauf.adresse, "key=k4").await, Vec::<u64>::new(), "#7 archiviert");
    assert_eq!(gefiltert(&lauf.adresse, "key=k4&archivierte=ja").await, [7]);
    assert_eq!(anlegen(&lauf.adresse, json!({"titel": "x", "key": "k4"})).await.0, 200);
    assert_eq!(gefiltert(&lauf.adresse, "key=k4").await, [7], "wieder offen");
    assert_eq!(gefiltert(&lauf.adresse, "key=K4").await, Vec::<u64>::new());
    assert_eq!(gefiltert(&lauf.adresse, "key=").await, Vec::<u64>::new(), "leer trifft nichts, kein 400");
    assert_eq!(anlegen(&lauf.adresse, json!({"titel": "y", "key": "k9"})).await.0, 201);
    assert_eq!(gefiltert(&lauf.adresse, "key=k4&key=k9").await, [7, 8]);
}

// AK Fehlfall Dublette: der Filter liefert beide (B0328)
#[tokio::test]
async fn filter_key_liefert_dublette() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    dublette(tmp.path(), "k5");
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    assert_eq!(gefiltert(&lauf.adresse, "key=k5").await, [8, 9]);
}

// AK Fehlfall Dublette: der Zustand meldet sie (B0329)
#[tokio::test]
async fn zustand_meldet_dublette() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (_, z) = senden(Method::GET, &lauf.adresse, "api/zustand", "st", Value::Null).await;
    assert_eq!(z["dubletten"], json!([]), "ohne Dublette leere Liste");
    dublette(tmp.path(), "k5");
    let (_, z) = senden(Method::GET, &lauf.adresse, "api/zustand", "st", Value::Null).await;
    assert_eq!(z["dubletten"], json!([{"key": "k5", "nummern": [8, 9]}]));
}
