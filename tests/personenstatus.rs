// Karte #137: `aktiv` (stilllegen/reaktivieren) einer Person der Art `human` ändern nur Menschen — sonst nähme ein Agent
// einem Menschen die Handlungsfähigkeit. Geprüft über den echten Einstieg an allen vier Wegen, die `aktiv` schreiben:
// `DELETE /api/personen/{kürzel}`, `PATCH /api/personen/{kürzel}`, `POST /api/personen` und `PUT /api/einstellungen`.
// Agenten dürfen Agenten stilllegen, Menschen Menschen (auch sich selbst); eine unveränderte Angabe ist keine Änderung.
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

const PERSONEN: &str = "kanbanD.md";
/// `Zu erledigen` gehört dem Menschen (#1 liegt darin) — die Sperre bleibt nach jeder Abweisung in Kraft.
const BOARD: &str = "---\ncolumn-owner:\n  Zu erledigen: human\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n\n## In Arbeit\n\n## Erledigt\n";

/// Eingerichteter Ordner (st Mensch, cl Agent, ab stillgelegter Mensch) mit einer Karte #1 in einer Menschen-Spalte.
fn ausgang(pfad: &Path) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\n---\n").unwrap();
    std::fs::write(pfad.join("boards/entwicklung.md"), BOARD).unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Menschen-Spalte"]);
}

fn stand(pfad: &Path) -> String {
    git(pfad, &["rev-parse", "HEAD"])
}

/// Die Zeile der Person in `kanbanD.md` — die Datei ist die Wahrheit über ihren Zustand.
fn personenzeile(pfad: &Path, kuerzel: &str) -> String {
    lies(pfad, PERSONEN)
        .lines()
        .find(|z| z.trim_start().starts_with(&format!("{kuerzel}:")))
        .unwrap_or_else(|| panic!("Person „{kuerzel}“ steht nicht in kanbanD.md"))
        .to_string()
}

/// 403 mit strukturiertem Rumpf `{fehler, kuerzel}`, `fehler` zuerst, Datei byte-gleich, kein Commit.
async fn abgewiesen(pfad: &Path, adresse: &str, methode: Method, weg: &str, wer: &str, daten: Value, kuerzel: &str, meldung: &str, datei_vorher: &str, vorher: &str) {
    let r = reqwest::Client::new().request(methode, format!("{adresse}{weg}")).header("X-KanbanD-Wer", wer).json(&daten).send().await.unwrap();
    let status = r.status().as_u16();
    let roh = r.text().await.unwrap();
    assert_eq!(status, 403, "{weg}: {roh}");
    let rumpf: Value = serde_json::from_str(&roh).unwrap();
    assert_eq!(rumpf["kuerzel"], json!(kuerzel), "{weg}: {roh}");
    assert_eq!(rumpf["fehler"], json!(meldung), "{weg}: {roh}");
    assert!(roh.starts_with(r#"{"fehler":"#), "{weg}: `fehler` ist das erste Feld: {roh}");
    assert_eq!(lies(pfad, PERSONEN), datei_vorher, "{weg}: Datei byte-gleich");
    assert_eq!(stand(pfad), vorher, "{weg}: kein Commit");
}

/// Die Einstellungen, wie sie in der Datei stehen — Ausgangspunkt für `PUT` und den Gegenproben.
async fn einstellungen(adresse: &str) -> Value {
    senden(Method::GET, adresse, "api/einstellungen", "cl", json!(null)).await.1
}

#[tokio::test]
async fn agent_legt_keinen_menschen_still() {
    let tmp = tempfile::tempdir().unwrap();
    ausgang(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let datei = lies(tmp.path(), PERSONEN);
    let vorher = stand(tmp.path());
    let still = "Den Zustand der Person „st“ ändern nur Menschen";
    // DELETE: der Weg des Befunds.
    abgewiesen(tmp.path(), a, Method::DELETE, "api/personen/st", "cl", json!(null), "st", still, &datei, &vorher).await;
    // PATCH: dasselbe Feld einzeln.
    abgewiesen(tmp.path(), a, Method::PATCH, "api/personen/st", "cl", json!({"aktiv": false}), "st", still, &datei, &vorher).await;
    // PUT /api/einstellungen: der ganze Satz.
    let mut ganz = einstellungen(a).await;
    ganz["personen"][0]["aktiv"] = json!(false);
    abgewiesen(tmp.path(), a, Method::PUT, "api/einstellungen", "cl", ganz, "st", still, &datei, &vorher).await;
    // Auch das Reaktivieren eines stillgelegten Menschen ist eine Änderung an einem Menschen.
    abgewiesen(tmp.path(), a, Method::PATCH, "api/personen/ab", "cl", json!({"aktiv": true}), "ab", "Den Zustand der Person „ab“ ändern nur Menschen", &datei, &vorher).await;
    // POST: einen neuen Menschen stillgelegt anzulegen bleibt verschlossen (Regel aus #127).
    abgewiesen(tmp.path(), a, Method::POST, "api/personen", "cl", json!({"kuerzel": "mi", "name": "Mia", "art": "human", "aktiv": false}), "mi", "Eine neue Person der Art „human“ legen nur Menschen an", &datei, &vorher).await;
    // Wirkungsprobe: `st` ist weiter wach und die Menschen-Spalte für `cl` weiter gesperrt.
    assert!(!personenzeile(tmp.path(), "st").contains("active: false"), "st bleibt aktiv");
    assert_eq!(senden(Method::GET, a, "api/wer", "st", json!(null)).await.0, 200, "st kann weiter handeln");
    assert_eq!(senden(Method::DELETE, a, "api/aufgaben/1", "cl", json!(null)).await.0, 403, "Menschen-Spalte bleibt gesperrt");
}

#[tokio::test]
async fn agent_legt_agenten_still() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let a = &lauf.adresse;
    // Kontrollpaar: ein Agent legt einen Agenten an und stillt ihn wieder.
    let (s, _) = senden(Method::POST, a, "api/personen", "cl", json!({"kuerzel": "ag2", "name": "Zweiter Agent", "art": "agent"})).await;
    assert_eq!(s, 201);
    let (s, p) = senden(Method::DELETE, a, "api/personen/ag2", "cl", json!(null)).await;
    assert_eq!((s, p["kuerzel"].as_str(), p["aktiv"].as_bool()), (200, Some("ag2"), Some(false)), "Agent stilllegt Agenten: {p}");
    // Und sich selbst — der Agent nimmt sich selbst aus dem Verkehr, keinem Menschen etwas.
    let vorher = stand(tmp.path());
    let (s, p) = senden(Method::DELETE, a, "api/personen/cl", "cl", json!(null)).await;
    assert_eq!((s, p["aktiv"].as_bool()), (200, Some(false)), "Agent stilllegt sich selbst: {p}");
    assert_ne!(stand(tmp.path()), vorher, "ein Commit");
    assert!(personenzeile(tmp.path(), "cl").contains("active: false"), "die Datei trägt den Zustand");
    assert_eq!(git(tmp.path(), &["show", "--format=%s", "--no-patch", "HEAD"]), "Person „Claude“ (cl) stillgelegt");
    // Der stillgelegte Agent handelt nicht mehr — die Abweisung greift am Einstieg.
    assert_eq!(senden(Method::GET, a, "api/wer", "cl", json!(null)).await.0, 400, "stillgelegt heißt handlungsunfähig");
}

#[tokio::test]
async fn mensch_legt_menschen_still() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let a = &lauf.adresse;
    // Der Mensch legt einen Menschen an und stillt ihn.
    let (s, _) = senden(Method::POST, a, "api/personen", "st", json!({"kuerzel": "mi", "name": "Mia", "art": "human"})).await;
    assert_eq!(s, 201, "Mensch legt Menschen an");
    let (s, p) = senden(Method::PATCH, a, "api/personen/mi", "st", json!({"aktiv": false})).await;
    assert_eq!((s, p["aktiv"].as_bool()), (200, Some(false)), "Mensch stilllegt Menschen: {p}");
    // Und sich selbst — erlaubt, nur er nimmt sich die Handlungsfähigkeit.
    let vorher = stand(tmp.path());
    let (s, p) = senden(Method::DELETE, a, "api/personen/st", "st", json!(null)).await;
    assert_eq!((s, p["aktiv"].as_bool()), (200, Some(false)), "Mensch stilllegt sich selbst: {p}");
    assert_ne!(stand(tmp.path()), vorher, "ein Commit");
    assert!(personenzeile(tmp.path(), "st").contains("active: false"), "die Datei trägt den Zustand");
    assert_eq!(senden(Method::GET, a, "api/wer", "st", json!(null)).await.0, 400, "der Zustand wirkt");
}

#[tokio::test]
async fn unveraendertes_aktiv_ist_keine_aenderung() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let a = &lauf.adresse;
    let datei = lies(tmp.path(), PERSONEN);
    let vorher = stand(tmp.path());
    // `ab` ist bereits stillgelegt: derselbe Wert ist keine Änderung, auch für einen Agenten.
    let (s, p) = senden(Method::DELETE, a, "api/personen/ab", "cl", json!(null)).await;
    assert_eq!((s, p["aktiv"].as_bool()), (200, Some(false)), "unverändert stillgelegt: {p}");
    assert_eq!((lies(tmp.path(), PERSONEN), stand(tmp.path())), (datei, vorher), "Datei byte-gleich, kein Commit");
    // `st` ist aktiv: `aktiv: true` ist unverändert, andere Felder bleiben erlaubt.
    let (s, p) = senden(Method::PATCH, a, "api/personen/st", "cl", json!({"aktiv": true, "name": "Stefan H."})).await;
    assert_eq!((s, p["aktiv"].as_bool(), p["name"].as_str()), (200, Some(true), Some("Stefan H.")), "nur der Name ändert sich: {p}");
    // Der ganze Satz unverändert über PUT ist keine Änderung.
    let vorher = stand(tmp.path());
    let (s, e) = senden(Method::PUT, a, "api/einstellungen", "cl", einstellungen(a).await).await;
    assert_eq!((s, e["geaendert"].as_bool()), (200, Some(false)), "unveränderte Einstellungen: {e}");
    assert_eq!(stand(tmp.path()), vorher, "kein Commit");
}
