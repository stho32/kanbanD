// R00096 WIP-Grenze für Agenten durchsetzen: jeder Schreibweg, der eine Karte in eine Spalte bringt
mod gemeinsam;

use gemeinsam::{git, lies};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

/// Aufruf als Person, optional mit Instanz (Header `X-KanbanD-Instanz`).
async fn als(methode: Method, adresse: &str, pfad: &str, wer: &str, instanz: Option<&str>, daten: Value) -> (u16, Value) {
    let mut r = reqwest::Client::new().request(methode, format!("{adresse}{pfad}")).header("X-KanbanD-Wer", wer).json(&daten);
    if let Some(i) = instanz {
        r = r.header("X-KanbanD-Instanz", i);
    }
    let r = r.send().await.unwrap();
    let status = r.status().as_u16();
    (status, serde_json::from_str(&r.text().await.unwrap()).unwrap_or(Value::Null))
}

/// Board „Fluss“: „Bereit“ ohne Grenze, „In Arbeit“ mit `grenze`, „Fertig“ leer; je Nummer eine Aufgabe.
/// `cl` ist Agent, `st` Mensch (gemeinsam::eingerichtet).
fn fluss(pfad: &Path, grenze: u32, bereit: &[u32], in_arbeit: &[u32]) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    for nr in bereit.iter().chain(in_arbeit) {
        std::fs::write(pfad.join(format!("aufgaben/{nr:04}-k.md")), format!("---\nid: {nr}\ntitle: k{nr}\n---\n")).unwrap();
    }
    let zeilen = |n: &[u32]| n.iter().map(|nr| format!("- #{nr}\n")).collect::<String>();
    let board = format!("---\nlimits:\n  In Arbeit: {grenze}\n---\n\n# Fluss\n\n## Bereit\n\n{}\n## In Arbeit\n\n{}\n## Fertig\n", zeilen(bereit), zeilen(in_arbeit));
    std::fs::write(pfad.join("boards/fluss.md"), board).unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fluss"]);
}

fn archivieren(pfad: &Path, nr: u32) {
    std::fs::write(pfad.join(format!("aufgaben/{nr:04}-k.md")), format!("---\nid: {nr}\ntitle: k{nr}\narchived: 2026-10-01\n---\n")).unwrap();
    git(pfad, &["commit", "-q", "-a", "-m", "archiviert"]);
}

fn spalte(board: &str, name: &str) -> Vec<u32> {
    board.split(&format!("## {name}\n\n")).nth(1).unwrap_or("").lines().take_while(|z| !z.starts_with("## ")).filter_map(|z| z.split('#').nth(1)?.split(|c: char| !c.is_ascii_digit()).next()?.parse().ok()).collect()
}

/// Was ein abgewiesener Zug nicht verändert haben darf: HEAD, Board-Datei und die Aufgabendateien.
struct Stand {
    kopf: String,
    dateien: Vec<(String, String)>,
}

fn stand(pfad: &Path) -> Stand {
    let mut dateien: Vec<(String, String)> = ["boards", "aufgaben"]
        .iter()
        .flat_map(|o| std::fs::read_dir(pfad.join(o)).unwrap().map(|e| e.unwrap().path()))
        .map(|p| (p.display().to_string(), std::fs::read_to_string(&p).unwrap()))
        .collect();
    dateien.sort();
    Stand { kopf: git(pfad, &["rev-parse", "HEAD"]), dateien }
}

fn unveraendert(pfad: &Path, vorher: &Stand, wozu: &str) {
    let nachher = stand(pfad);
    assert_eq!(nachher.kopf, vorher.kopf, "{wozu}: kein neuer Commit");
    assert_eq!(nachher.dateien, vorher.dateien, "{wozu}: keine Datei geändert oder angelegt");
}

fn grenze_erreicht(spalte: &str, grenze: u32, anzahl: u32) -> Value {
    json!({"fehler": "Grenze erreicht", "spalte": spalte, "grenze": grenze, "anzahl": anzahl})
}

// ---- ziehen (B0278)

#[tokio::test]
async fn agent_zieht_nicht_in_die_volle_spalte() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7], &[5, 6]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let vorher = stand(tmp.path());
    let (s, r) = als(Method::POST, &lauf.adresse, "api/boards/fluss/ziehen", "cl", Some("A"), json!({"von": "Bereit"})).await;
    assert_eq!((s, r), (409, grenze_erreicht("In Arbeit", 2, 2)));
    unveraendert(tmp.path(), &vorher, "abgewiesenes Ziehen");
    let karte = lies(tmp.path(), "aufgaben/0007-k.md");
    assert!(!karte.contains("reservation") && !karte.contains("cl"), "#7 weder reserviert noch zugewiesen: {karte}");
}

#[tokio::test]
async fn archivierte_zaehlen_nicht_beim_ziehen() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7], &[5, 6]);
    archivieren(tmp.path(), 6);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let (s, r) = als(Method::POST, &lauf.adresse, "api/boards/fluss/ziehen", "cl", Some("A"), json!({"von": "Bereit"})).await;
    assert_eq!((s, r["aufgabe"]["nummer"].as_u64()), (200, Some(7)), "{r}");
    assert_eq!(spalte(&lies(tmp.path(), "boards/fluss.md"), "In Arbeit"), vec![7, 5, 6]);
}

#[tokio::test]
async fn mensch_zieht_in_die_volle_spalte_mit_warnung() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7], &[5, 6]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let commits: u32 = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();
    let (s, r) = als(Method::POST, &lauf.adresse, "api/boards/fluss/ziehen", "st", Some("M"), json!({"von": "Bereit"})).await;
    assert_eq!(s, 200, "{r}");
    assert_eq!(r["warnungen"], json!([{"pruefung": "grenze", "text": "Grenze erreicht: „In Arbeit“ hat 3 von 2", "knoten": [], "details": []}]));
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap(), commits + 1, "ein Commit");
    assert_eq!(spalte(&lies(tmp.path(), "boards/fluss.md"), "In Arbeit"), vec![7, 5, 6]);
}

#[tokio::test]
async fn zwei_gleichzeitige_ziehen_um_den_letzten_platz() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 3, &[7, 8], &[5, 6]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let aufrufe: Vec<_> = ["A", "B"]
        .into_iter()
        .map(|i| {
            let a = lauf.adresse.clone();
            tokio::spawn(async move { als(Method::POST, &a, "api/boards/fluss/ziehen", "cl", Some(i), json!({"von": "Bereit"})).await })
        })
        .collect();
    let mut status = vec![];
    for t in aufrufe {
        let (s, r) = t.await.unwrap();
        if s == 409 {
            assert_eq!(r, grenze_erreicht("In Arbeit", 3, 3), "der zweite sieht den ersten");
        }
        status.push(s);
    }
    status.sort();
    assert_eq!(status, [200, 409]);
    assert_eq!(spalte(&lies(tmp.path(), "boards/fluss.md"), "In Arbeit").len(), 3);
}

// ---- bewegen und bewegen-mehrere (B0279)

async fn bewegen(adresse: &str, wer: &str, nummer: u32, spalte: &str, index: Option<usize>) -> (u16, Value) {
    als(Method::POST, adresse, "api/boards/fluss/bewegen", wer, None, json!({"nummer": nummer, "spalte": spalte, "index": index})).await
}

async fn mehrere(adresse: &str, wer: &str, ziele: &[(u32, &str)]) -> (u16, Value) {
    let ziele: Vec<Value> = ziele.iter().map(|(n, s)| json!({"nummer": n, "spalte": s})).collect();
    als(Method::POST, adresse, "api/boards/fluss/bewegen-mehrere", wer, None, json!({"ziele": ziele})).await
}

#[tokio::test]
async fn agent_bewegt_nicht_in_die_volle_spalte() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7, 8], &[5, 6]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = stand(tmp.path());
    assert_eq!(bewegen(a, "cl", 7, "In Arbeit", None).await, (409, grenze_erreicht("In Arbeit", 2, 2)));
    unveraendert(tmp.path(), &vorher, "bewegen");
    assert_eq!(mehrere(a, "cl", &[(7, "In Arbeit")]).await, (409, grenze_erreicht("In Arbeit", 2, 2)));
    unveraendert(tmp.path(), &vorher, "bewegen-mehrere");
    let (s, r) = bewegen(a, "cl", 6, "In Arbeit", Some(0)).await;
    assert_eq!((s, &r["bewegt"]), (200, &json!(true)), "Umsortieren in voller Spalte: {r}");
    assert_eq!(spalte(&lies(tmp.path(), "boards/fluss.md"), "In Arbeit"), vec![6, 5]);
}

#[tokio::test]
async fn mehrere_bewegen_zaehlt_den_stand_nach_allen_zuegen() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7, 8], &[5]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = stand(tmp.path());
    assert_eq!(mehrere(a, "cl", &[(7, "In Arbeit"), (8, "In Arbeit")]).await, (409, grenze_erreicht("In Arbeit", 2, 1)), "es wären 3 von 2");
    unveraendert(tmp.path(), &vorher, "keine der beiden bewegt");
    let (s, r) = mehrere(a, "cl", &[(7, "In Arbeit"), (5, "Fertig")]).await;
    assert_eq!(s, 200, "eine hinein, eine heraus: {r}");
    assert_eq!(spalte(&lies(tmp.path(), "boards/fluss.md"), "In Arbeit"), vec![7]);
}

#[tokio::test]
async fn ohne_grenze_bewegt_ein_agent_beliebig_viele() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 1, &[], &[5, 6, 7, 8]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let (s, r) = mehrere(&lauf.adresse, "cl", &[(5, "Bereit"), (6, "Bereit"), (7, "Bereit")]).await;
    assert_eq!(s, 200, "„Bereit“ hat keinen limits-Eintrag: {r}");
    assert_eq!(bewegen(&lauf.adresse, "cl", 8, "Fertig", None).await.0, 200);
    assert_eq!(spalte(&lies(tmp.path(), "boards/fluss.md"), "Bereit").len(), 3);
}

#[tokio::test]
async fn mensch_bewegt_in_die_volle_spalte_mit_warnung() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7, 8], &[5, 6]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let warnung = json!([{"pruefung": "grenze", "text": "Grenze erreicht: „In Arbeit“ hat 3 von 2", "knoten": [], "details": []}]);
    let commits = || git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap();
    let vorher = commits();
    let (s, r) = bewegen(a, "st", 7, "In Arbeit", None).await;
    assert_eq!((s, &r["warnungen"]), (200, &warnung), "{r}");
    assert_eq!(commits(), vorher + 1, "ein Commit");
    let (s, r) = mehrere(a, "st", &[(8, "In Arbeit")]).await;
    assert_eq!((s, &r["warnungen"]), (200, &json!([{"pruefung": "grenze", "text": "Grenze erreicht: „In Arbeit“ hat 4 von 2", "knoten": [], "details": []}])), "{r}");
    assert_eq!(commits(), vorher + 2);
}
