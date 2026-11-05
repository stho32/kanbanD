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
