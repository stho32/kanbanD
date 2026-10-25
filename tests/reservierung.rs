// R00087 Reservierungen und Ziehen
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};

/// Aufruf als Person und Instanz (Header `X-KanbanD-Instanz`); ohne Instanz kein Header.
async fn als(methode: Method, adresse: &str, pfad: &str, wer: &str, instanz: Option<&str>, daten: Value) -> (u16, Value) {
    let mut r = reqwest::Client::new().request(methode, format!("{adresse}{pfad}")).header("X-KanbanD-Wer", wer).json(&daten);
    if let Some(i) = instanz {
        r = r.header("X-KanbanD-Instanz", i);
    }
    let r = r.send().await.unwrap();
    let status = r.status().as_u16();
    (status, serde_json::from_str(&r.text().await.unwrap()).unwrap_or(Value::Null))
}

fn starten(tmp: &tempfile::TempDir) -> gemeinsam::Laufendes {
    gemeinsam::mit_drei_aufgaben(tmp.path());
    gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"])
}

#[tokio::test]
async fn reservieren_verlaengern_und_fremde_abweisen() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let a = &lauf.adresse;
    let (s, r) = als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("A"), json!(null)).await;
    assert_eq!(s, 200);
    assert_eq!((r["reservierung"]["wer"].as_str(), r["reservierung"]["instanz"].as_str()), (Some("cl"), Some("A")));
    let datei = lies(tmp.path(), "aufgaben/0001-eins.md");
    assert!(datei.contains("reservation: {who: cl, instance: A, since: \""), "{datei}");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Claude|#1 reserviert (Claude · Instanz A)");
    let (s, f) = als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("B"), json!(null)).await;
    assert_eq!(s, 409);
    assert!(f["fehler"].as_str().unwrap().contains("Instanz A"), "{f}");
    // eine Stunde zurückgedreht: dieselbe Instanz verlängert auf jetzt
    std::fs::write(tmp.path().join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\nreservation: {who: cl, instance: A, since: \"2026-01-01 08:00+01:00\"}\n---\n").unwrap();
    let (s, r) = als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("B"), json!(null)).await;
    assert_eq!((s, r["reservierung"]["instanz"].as_str()), (200, Some("B")), "nach 24 h darf eine andere Instanz");
    let seit = r["reservierung"]["seit"].as_str().unwrap().to_string();
    let (s, r) = als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("B"), json!(null)).await;
    assert_eq!(s, 200);
    assert!(r["reservierung"]["seit"].as_str().unwrap() >= seit.as_str(), "verlängert");
}

#[tokio::test]
async fn freigeben_eigene_mensch_ja_fremder_agent_nein() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let a = &lauf.adresse;
    als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("A"), json!(null)).await;
    assert_eq!(als(Method::DELETE, a, "api/aufgaben/1/reservierung", "cl", Some("B"), json!(null)).await.0, 409);
    let (s, r) = als(Method::DELETE, a, "api/aufgaben/1/reservierung", "st", None, json!(null)).await;
    assert_eq!((s, r["reservierung"].is_null()), (200, true), "ein Mensch gibt jede frei");
    assert!(!lies(tmp.path(), "aufgaben/0001-eins.md").contains("reservation"));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#1 freigegeben (war Claude · Instanz A)");
    assert_eq!(als(Method::DELETE, a, "api/aufgaben/1/reservierung", "st", None, json!(null)).await.0, 404);
    als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("A"), json!(null)).await;
    assert_eq!(als(Method::DELETE, a, "api/aufgaben/1/reservierung", "cl", Some("A"), json!(null)).await.0, 200, "die eigene Instanz");
}

#[tokio::test]
async fn instanz_ist_pflicht_und_geprueft_auch_als_feld() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let a = &lauf.adresse;
    assert_eq!(als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", None, json!(null)).await.0, 400);
    assert_eq!(als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("mit leer"), json!(null)).await.0, 400);
    let (s, r) = als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", None, json!({"instanz": "F-1"})).await;
    assert_eq!((s, r["reservierung"]["instanz"].as_str()), (200, Some("F-1")));
}

#[tokio::test]
async fn fremde_reservierung_sperrt_nur_reservieren_und_archiv_entfernt_sie() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let a = &lauf.adresse;
    als(Method::POST, a, "api/aufgaben/1/reservierung", "cl", Some("A"), json!(null)).await;
    assert_eq!(als(Method::POST, a, "api/aufgaben/1/kommentare", "cl", Some("B"), json!({"text": "Hallo"})).await.0, 200);
    assert_eq!(als(Method::POST, a, "api/aufgaben/1/zeiten", "cl", Some("B"), json!({"dauer": "0:30"})).await.0, 200);
    assert_eq!(als(Method::POST, a, "api/boards/entwicklung/bewegen", "cl", Some("B"), json!({"nummer": 1, "spalte": "In Arbeit"})).await.0, 200);
    let (s, r) = senden(Method::POST, a, "api/aufgaben/1/archivieren", "st", json!(null)).await;
    assert_eq!((s, r["reservierung"].is_null()), (200, true));
    assert!(!lies(tmp.path(), "aufgaben/0001-eins.md").contains("reservation"));
}

/// Board „Fluss“ mit „Bereit“ = 7, 8, 9 (n Karten ab 7), „In Arbeit“, „Fertig“.
fn mit_bereit(pfad: &std::path::Path, n: u32) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    let mut zeilen = String::new();
    for nr in 7..7 + n {
        std::fs::write(pfad.join(format!("aufgaben/{nr:04}-k.md")), format!("---\nid: {nr}\ntitle: k{nr}\n---\n")).unwrap();
        zeilen.push_str(&format!("- #{nr}\n"));
    }
    std::fs::write(pfad.join("boards/fluss.md"), format!("# Fluss\n\n## Bereit\n\n{zeilen}\n## In Arbeit\n\n- #99\n\n## Fertig\n")).unwrap();
    std::fs::write(pfad.join("aufgaben/0099-alt.md"), "---\nid: 99\ntitle: alt\n---\n").unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fluss"]);
}

fn spalte(board: &str, name: &str) -> Vec<u32> {
    board.split(&format!("## {name}\n\n")).nth(1).unwrap_or("").lines().take_while(|z| !z.starts_with("## ")).filter_map(|z| z.split('#').nth(1)?.split(|c: char| !c.is_ascii_digit()).next()?.parse().ok()).collect()
}

#[tokio::test]
async fn ziehen_nimmt_die_oberste_freie_karte() {
    let tmp = tempfile::tempdir().unwrap();
    mit_bereit(tmp.path(), 3);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    als(Method::POST, a, "api/aufgaben/7/reservierung", "cl", Some("B"), json!(null)).await;
    let vorher: u32 = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();
    let (s, r) = als(Method::POST, a, "api/boards/fluss/ziehen", "cl", Some("A"), json!({"von": "Bereit"})).await;
    assert_eq!(s, 200, "{r}");
    assert_eq!((r["aufgabe"]["nummer"].as_u64(), r["von"].as_str(), r["nach"].as_str()), (Some(8), Some("Bereit"), Some("In Arbeit")));
    assert_eq!(r["aufgabe"]["reservierung"]["instanz"], "A");
    assert_eq!(r["aufgabe"]["zustaendige"], json!(["cl"]));
    assert!(r["warnungen"].is_array());
    let board = lies(tmp.path(), "boards/fluss.md");
    assert_eq!((spalte(&board, "Bereit"), spalte(&board, "In Arbeit")), (vec![7, 9], vec![8, 99]), "oben in der Folgespalte");
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap(), vorher + 1, "ein Commit");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=%an|%s", "HEAD"]), "Claude|#8 gezogen: „Bereit“ → „In Arbeit“ (Claude · Instanz A, Fluss)\n\naufgaben/0008-k.md\nboards/fluss.md");
    // die eigene Reservierung zählt als frei; mit nach in eine beliebige Spalte
    let (s, r) = als(Method::POST, a, "api/boards/fluss/ziehen", "cl", Some("B"), json!({"von": "Bereit", "nach": "Fertig"})).await;
    assert_eq!((s, r["aufgabe"]["nummer"].as_u64()), (200, Some(7)));
    assert_eq!(spalte(&lies(tmp.path(), "boards/fluss.md"), "Fertig"), vec![7]);
}

#[tokio::test]
async fn ziehen_ohne_freie_karte_ohne_folgespalte_ohne_instanz() {
    let tmp = tempfile::tempdir().unwrap();
    mit_bereit(tmp.path(), 1);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    als(Method::POST, a, "api/aufgaben/7/reservierung", "cl", Some("B"), json!(null)).await;
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    let (s, r) = als(Method::POST, a, "api/boards/fluss/ziehen", "cl", Some("A"), json!({"von": "Bereit"})).await;
    assert_eq!((s, r["fehler"].as_str()), (404, Some("nichts zu ziehen")));
    assert_eq!(als(Method::POST, a, "api/boards/fluss/ziehen", "cl", Some("A"), json!({"von": "Fertig", "nach": "Bereit"})).await.0, 404, "leer");
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher, "nichts bewegt");
    std::fs::write(tmp.path().join("boards/fluss.md"), "# Fluss\n\n## Bereit\n\n## In Arbeit\n\n## Fertig\n\n- #99\n").unwrap();
    assert_eq!(als(Method::POST, a, "api/boards/fluss/ziehen", "cl", Some("A"), json!({"von": "Fertig"})).await.0, 400, "letzte Spalte ohne nach");
    assert_eq!(als(Method::POST, a, "api/boards/fluss/ziehen", "cl", None, json!({"von": "Bereit"})).await.0, 400, "ohne Instanz");
    assert_eq!(als(Method::POST, a, "api/boards/fluss/ziehen", "cl", Some("A"), json!({"von": "Gibtsnicht"})).await.0, 400);
    std::fs::write(tmp.path().join("aufgaben/0099-alt.md"), "---\nid: 99\ntitle: alt\narchived: 2026-10-01\n---\n").unwrap();
    assert_eq!(als(Method::POST, a, "api/boards/fluss/ziehen", "cl", Some("A"), json!({"von": "Fertig", "nach": "Bereit"})).await.0, 404, "archivierte zählen nicht");
}

#[tokio::test]
async fn zehn_parallele_ziehen_bekommen_zehn_verschiedene_karten() {
    let tmp = tempfile::tempdir().unwrap();
    mit_bereit(tmp.path(), 10);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let aufrufe = (0..10).map(|i| {
        let a = lauf.adresse.clone();
        tokio::spawn(async move { als(Method::POST, &a, "api/boards/fluss/ziehen", "cl", Some(&format!("I{i}")), json!({"von": "Bereit"})).await })
    });
    let mut nummern = vec![];
    for t in aufrufe {
        let (s, r) = t.await.unwrap();
        assert_eq!(s, 200, "{r}");
        nummern.push(r["aufgabe"]["nummer"].as_u64().unwrap());
    }
    nummern.sort();
    assert_eq!(nummern, (7..17).collect::<Vec<_>>());
    assert!(spalte(&lies(tmp.path(), "boards/fluss.md"), "Bereit").is_empty());
}
