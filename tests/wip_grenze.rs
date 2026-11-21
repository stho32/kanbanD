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
    // US-2: eine Karte verlässt „In Arbeit“, der Behandler zieht erneut und bekommt #7; „In Arbeit“ hat wieder 2 von 2
    assert_eq!(bewegen(&lauf.adresse, "st", 5, "Fertig", None).await.0, 200);
    let (s, r) = als(Method::POST, &lauf.adresse, "api/boards/fluss/ziehen", "cl", Some("A"), json!({"von": "Bereit"})).await;
    assert_eq!((s, r["aufgabe"]["nummer"].as_u64()), (200, Some(7)), "{r}");
    assert_eq!(spalte(&lies(tmp.path(), "boards/fluss.md"), "In Arbeit"), vec![7, 6]);
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
    assert_eq!(r["warnungen"], json!([{"pruefung": "grenze", "text": "Grenze erreicht: „In Arbeit“ hat 3 von 2"}]));
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap(), commits + 1, "ein Commit");
    assert_eq!(spalte(&lies(tmp.path(), "boards/fluss.md"), "In Arbeit"), vec![7, 5, 6]);
}

#[tokio::test]
async fn zwei_gleichzeitige_ziehen_um_den_letzten_platz() {
    // Das Ergebnis (genau ein 200, ein 409) prüft diese Integration; die Sperre selbst belegt deterministisch
    // `src/dienst/reservierung.rs::ziehen_haelt_die_sperre_zwischen_pruefung_und_aktion` (Halter zwischen Prüfung
    // und Handlung, R00118 B0538) — zwei Threads treffen die Lücke nur zufällig.
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

// R00118 B0542 (Anmerkung 9): der 409 von `bewegen-mehrere` nennt die Belegung **vor** dem Zug (`anzahl`), nicht den
// Stand nach allen Zügen. Ein Agent sieht damit nicht, um wie viel er überzieht; die Anforderung belässt es so, der
// Test hält den Vertrag fest (R00118 AK 9: anzahl vor dem Zug).
#[tokio::test]
async fn bewegen_mehrere_nennt_die_anzahl_vor_dem_zug() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 3, &[7, 8], &[5, 6]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let vorher = stand(tmp.path());
    let (s, r) = mehrere(&lauf.adresse, "cl", &[(7, "In Arbeit"), (8, "In Arbeit")]).await;
    assert_eq!(s, 409, "{r}");
    assert_eq!(r["anzahl"].as_u64(), Some(2), "anzahl ist die Belegung vor dem Zug, nicht der Stand danach (4): {r}");
    assert_eq!(r["spalte"], "In Arbeit");
    assert_eq!(r["grenze"].as_u64(), Some(3));
    unveraendert(tmp.path(), &vorher, "keine der beiden bewegt");
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
    let warnung = json!([{"pruefung": "grenze", "text": "Grenze erreicht: „In Arbeit“ hat 3 von 2"}]);
    let commits = || git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap();
    let vorher = commits();
    let (s, r) = bewegen(a, "st", 7, "In Arbeit", None).await;
    assert_eq!((s, &r["warnungen"]), (200, &warnung), "{r}");
    assert_eq!(commits(), vorher + 1, "ein Commit");
    let (s, r) = mehrere(a, "st", &[(8, "In Arbeit")]).await;
    assert_eq!((s, &r["warnungen"]), (200, &json!([{"pruefung": "grenze", "text": "Grenze erreicht: „In Arbeit“ hat 4 von 2"}])), "{r}");
    assert_eq!(commits(), vorher + 2);
}

// ---- Anlegen mit Board (B0281)

fn anzahl_dateien(pfad: &Path) -> usize {
    std::fs::read_dir(pfad.join("aufgaben")).unwrap().count()
}

#[tokio::test]
async fn agent_legt_nicht_in_der_vollen_spalte_an() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7], &[5, 6]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = stand(tmp.path());
    let (s, r) = als(Method::POST, a, "api/aufgaben", "cl", None, json!({"titel": "neu", "board": "fluss", "spalte": "In Arbeit"})).await;
    assert_eq!((s, r), (409, grenze_erreicht("In Arbeit", 2, 2)));
    unveraendert(tmp.path(), &vorher, "Anlegen");
    let (s, r) = als(Method::POST, a, "api/aufgaben/mehrere", "cl", None, json!({"titel": ["x", "y"], "board": "fluss", "spalte": "In Arbeit"})).await;
    assert_eq!((s, r), (409, grenze_erreicht("In Arbeit", 2, 2)));
    unveraendert(tmp.path(), &vorher, "mehrere anlegen");
    let (s, _) = als(Method::POST, a, "api/aufgaben", "cl", None, json!({"titel": "ohne Board"})).await;
    assert_eq!(s, 201, "ohne Board gibt es keine Spalte");
}

#[tokio::test]
async fn mehrere_anlegen_zaehlt_alle_neuen() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7], &[5]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let vorher = stand(tmp.path());
    let (s, r) = als(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "cl", None, json!({"titel": ["x", "y"], "board": "fluss", "spalte": "In Arbeit"})).await;
    assert_eq!((s, r), (409, grenze_erreicht("In Arbeit", 2, 1)), "ein freier Platz, zwei neue");
    unveraendert(tmp.path(), &vorher, "keine Datei");
    assert_eq!(anzahl_dateien(tmp.path()), 2);
}

#[tokio::test]
async fn anlegen_ohne_spalte_prueft_die_erste_spalte() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7], &[]);
    std::fs::write(tmp.path().join("boards/fluss.md"), "---\nlimits:\n  Bereit: 1\n---\n\n# Fluss\n\n## Bereit\n\n- #7\n\n## In Arbeit\n\n## Fertig\n").unwrap();
    git(tmp.path(), &["commit", "-q", "-a", "-m", "Grenze an Bereit"]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let vorher = stand(tmp.path());
    let (s, r) = als(Method::POST, &lauf.adresse, "api/aufgaben", "cl", None, json!({"titel": "neu", "board": "fluss"})).await;
    assert_eq!((s, r), (409, grenze_erreicht("Bereit", 1, 1)));
    unveraendert(tmp.path(), &vorher, "Anlegen in die erste Spalte");
}

#[tokio::test]
async fn mensch_legt_in_der_vollen_spalte_an_ohne_warnung() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7], &[5, 6]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let (s, r) = als(Method::POST, &lauf.adresse, "api/aufgaben", "st", None, json!({"titel": "neu", "board": "fluss", "spalte": "In Arbeit"})).await;
    assert_eq!((s, r["nummer"].as_u64(), r.get("warnungen")), (201, Some(8), None), "Antwortform unverändert: {r}");
    let (s, r) = als(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "st", None, json!({"titel": ["x"], "board": "fluss", "spalte": "In Arbeit"})).await;
    assert_eq!((s, r.as_array().map(Vec::len)), (201, Some(1)), "{r}");
    assert_eq!(spalte(&lies(tmp.path(), "boards/fluss.md"), "In Arbeit"), vec![5, 6, 8, 9]);
}

// ---- Auf das Board legen (B0282)

/// Aufgaben, die auf keinem Board liegen.
fn lose(pfad: &Path, nummern: &[u32]) {
    for nr in nummern {
        std::fs::write(pfad.join(format!("aufgaben/{nr:04}-k.md")), format!("---\nid: {nr}\ntitle: k{nr}\n---\n")).unwrap();
    }
    git(pfad, &["add", "-A"]);
    git(pfad, &["commit", "-q", "-m", "lose"]);
}

#[tokio::test]
async fn agent_legt_nicht_in_die_volle_spalte() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7], &[5, 6]);
    lose(tmp.path(), &[10, 11]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = stand(tmp.path());
    let (s, r) = als(Method::POST, a, "api/boards/fluss/aufgaben", "cl", None, json!({"nummer": 10, "spalte": "In Arbeit"})).await;
    assert_eq!((s, r), (409, grenze_erreicht("In Arbeit", 2, 2)));
    unveraendert(tmp.path(), &vorher, "auflegen");
    let (s, r) = als(Method::POST, a, "api/boards/fluss/aufgaben/mehrere", "cl", None, json!({"nummern": [10, 11], "spalte": "In Arbeit"})).await;
    assert_eq!((s, r), (409, grenze_erreicht("In Arbeit", 2, 2)));
    unveraendert(tmp.path(), &vorher, "mehrere auflegen");
}

#[tokio::test]
async fn schon_liegende_karte_ist_kein_zugang_beim_auflegen() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7], &[5]);
    lose(tmp.path(), &[10, 11]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = stand(tmp.path());
    let (s, r) = als(Method::POST, a, "api/boards/fluss/aufgaben/mehrere", "cl", None, json!({"nummern": [10, 11], "spalte": "In Arbeit"})).await;
    assert_eq!((s, r), (409, grenze_erreicht("In Arbeit", 2, 1)), "ein Platz, zwei neue");
    unveraendert(tmp.path(), &vorher, "keine gelegt");
    let (s, r) = als(Method::POST, a, "api/boards/fluss/aufgaben/mehrere", "cl", None, json!({"nummern": [5, 7, 10], "spalte": "In Arbeit"})).await;
    assert_eq!((s, r), (200, json!([10])), "#5 und #7 liegen schon: nur #10 kommt hinzu");
    assert_eq!(spalte(&lies(tmp.path(), "boards/fluss.md"), "In Arbeit"), vec![5, 10]);
}

#[tokio::test]
async fn mensch_legt_in_die_volle_spalte_ohne_warnung() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7], &[5, 6]);
    lose(tmp.path(), &[10, 11]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (s, r) = als(Method::POST, a, "api/boards/fluss/aufgaben", "st", None, json!({"nummer": 10, "spalte": "In Arbeit"})).await;
    assert_eq!((s, r), (201, json!({"spalte": "In Arbeit"})), "Antwortform unverändert");
    let (s, r) = als(Method::POST, a, "api/boards/fluss/aufgaben/mehrere", "st", None, json!({"nummern": [11], "spalte": "In Arbeit"})).await;
    assert_eq!((s, r), (200, json!([11])), "Antwortform unverändert");
    assert_eq!(spalte(&lies(tmp.path(), "boards/fluss.md"), "In Arbeit"), vec![5, 6, 10, 11]);
}

// ---- Zurückholen (B0283)

/// „Fluss“ mit „In Arbeit“ = [5, 6, 8] bei Grenze 2, #6 archiviert — die Spalte zählt 2 und ist voll.
fn voll_mit_archivierter(pfad: &Path) {
    fluss(pfad, 2, &[7], &[5, 6, 8]);
    archivieren(pfad, 6);
}

/// Zweites Board „Zweit“ (in der Boardliste nach „Fluss“) mit „Doing“ = `doing` bei Grenze 1.
fn zweites_board(pfad: &Path, doing: &[u32]) {
    let zeilen: String = doing.iter().map(|nr| format!("- #{nr}\n")).collect();
    std::fs::write(pfad.join("boards/zweit.md"), format!("---\nlimits:\n  Doing: 1\n---\n\n# Zweit\n\n## Doing\n\n{zeilen}\n## Done\n")).unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["commit", "-q", "-m", "zweit"]);
}

#[tokio::test]
async fn agent_holt_nicht_in_die_volle_spalte_zurueck() {
    let tmp = tempfile::tempdir().unwrap();
    voll_mit_archivierter(tmp.path());
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = stand(tmp.path());
    let (s, r) = als(Method::POST, a, "api/aufgaben/6/zurueckholen", "cl", None, json!(null)).await;
    assert_eq!((s, r), (409, grenze_erreicht("In Arbeit", 2, 2)));
    unveraendert(tmp.path(), &vorher, "zurückholen");
    assert!(lies(tmp.path(), "aufgaben/0006-k.md").contains("archived:"), "#6 bleibt archiviert");
    let (s, r) = als(Method::POST, a, "api/aufgaben/zurueckholen", "cl", None, json!({"nummern": [6]})).await;
    assert_eq!((s, r), (409, grenze_erreicht("In Arbeit", 2, 2)));
    unveraendert(tmp.path(), &vorher, "mehrere zurückholen");
}

#[tokio::test]
async fn zurueckholen_ohne_board_und_auf_jedem_board() {
    let tmp = tempfile::tempdir().unwrap();
    voll_mit_archivierter(tmp.path());
    lose(tmp.path(), &[20]);
    archivieren(tmp.path(), 20);
    zweites_board(tmp.path(), &[6, 9]);
    lose(tmp.path(), &[9, 10]);
    archivieren(tmp.path(), 10);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (s, r) = als(Method::POST, a, "api/aufgaben/20/zurueckholen", "cl", None, json!(null)).await;
    assert_eq!((s, r["archiviert"].is_null()), (200, true), "Karte auf keinem Board: {r}");
    let (s, r) = als(Method::POST, a, "api/aufgaben/zurueckholen", "cl", None, json!({"nummern": [6]})).await;
    assert_eq!((s, r), (409, grenze_erreicht("In Arbeit", 2, 2)), "beide Boards voll: das erste der Boardliste");
    std::fs::write(tmp.path().join("boards/zweit.md"), "---\nlimits:\n  Doing: 1\n---\n\n# Zweit\n\n## Doing\n\n- #10\n- #9\n\n## Done\n").unwrap();
    git(tmp.path(), &["commit", "-q", "-a", "-m", "#10 auf Zweit"]);
    let vorher = stand(tmp.path());
    let (s, r) = als(Method::POST, a, "api/aufgaben/10/zurueckholen", "cl", None, json!(null)).await;
    assert_eq!((s, r), (409, grenze_erreicht("Doing", 1, 1)), "nur das zweite Board voll");
    unveraendert(tmp.path(), &vorher, "zurückholen auf dem zweiten Board");
}

// R00118 B0537: `Zurückholen` liest die lesbaren Board-Dateien (`ordner().boards()?`) und verwirft die Defekte-Liste.
// Eine defekte Board-Datei wird deshalb übersprungen: die Karte gilt dort als auf keinem Board, der Weg läuft durch
// (X00001, Abweichungen). Der Test hält diese bewusst hingenommene Grenze fest.
#[tokio::test]
async fn zurueckholen_ueberspringt_defekte_board_dateien() {
    let tmp = tempfile::tempdir().unwrap();
    fluss(tmp.path(), 2, &[7], &[5, 6]);
    lose(tmp.path(), &[10]);
    // Defekte Board-Datei: dieselbe Spalte zweimal — `boards()` verwirft sie als defekt (Formatfehler).
    std::fs::write(tmp.path().join("boards/kaputt.md"), "---\nlimits:\n  Doing: 1\n---\n\n# Kaputt\n\n## Doing\n\n- #10\n\n## Doing\n\n").unwrap();
    git(tmp.path(), &["add", "-A"]);
    git(tmp.path(), &["commit", "-q", "-m", "defektes Board"]);
    archivieren(tmp.path(), 10);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let zustand: Value = reqwest::get(&format!("{}api/zustand", lauf.adresse)).await.unwrap().json().await.unwrap();
    assert!(zustand["defekte"].as_array().unwrap().iter().any(|d| d["pfad"] == "boards/kaputt.md"), "der Ordner meldet die defekte Datei: {zustand}");
    let (s, r) = als(Method::POST, &lauf.adresse, "api/aufgaben/10/zurueckholen", "cl", None, json!(null)).await;
    assert_eq!((s, r["nummer"].as_u64()), (200, Some(10)), "die defekte Board-Datei ist übersprungen: {r}");
    assert!(!lies(tmp.path(), "aufgaben/0010-k.md").contains("archived:"), "#10 ist wieder geöffnet");
}

#[tokio::test]
async fn mensch_holt_in_die_volle_spalte_zurueck_ohne_warnung() {
    let tmp = tempfile::tempdir().unwrap();
    voll_mit_archivierter(tmp.path());
    lose(tmp.path(), &[11]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let (s, r) = als(Method::POST, &lauf.adresse, "api/aufgaben/6/zurueckholen", "st", None, json!(null)).await;
    assert_eq!((s, r["nummer"].as_u64(), r["archiviert"].is_null(), r.get("warnungen")), (200, Some(6), true, None), "Antwortform unverändert: {r}");
    archivieren(tmp.path(), 6);
    let (s, r) = als(Method::POST, &lauf.adresse, "api/aufgaben/zurueckholen", "st", None, json!({"nummern": [6]})).await;
    assert_eq!((s, r), (200, json!([6])));
}
