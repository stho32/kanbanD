// Karte #127: Die Art einer Person (`art`) ändern nur Menschen — ein Agent macht sich nicht zum Menschen und legt keinen
// an; sonst fiele für ihn dauerhaft die Spalten-Sperre R00097. Geprüft über den echten Einstieg an allen drei Wegen,
// die `art` setzt: `PATCH /api/personen/{kürzel}`, `POST /api/personen` und `PUT /api/einstellungen`.
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

const PERSONEN: &str = "kanbanD.md";
/// `Zu erledigen` gehört dem Menschen (#1 liegt darin) — die Sperre, die ein Agent über `art: human` aufheben würde.
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

/// Die Zeile der Person in `kanbanD.md` — die Datei ist die Wahrheit über ihre Art.
fn personenzeile(pfad: &Path, kuerzel: &str) -> String {
    lies(pfad, PERSONEN)
        .lines()
        .find(|z| z.trim_start().starts_with(&format!("{kuerzel}:")))
        .unwrap_or_else(|| panic!("Person „{kuerzel}“ steht nicht in kanbanD.md"))
        .to_string()
}

/// 403 mit strukturiertem Rumpf `{fehler, kuerzel}`, `fehler` zuerst, Datei byte-gleich, kein Commit.
async fn abgewiesen(pfad: &Path, adresse: &str, methode: Method, weg: &str, wer: &str, daten: Value, kuerzel: &str, datei_vorher: &str, vorher: &str) {
    let r = reqwest::Client::new().request(methode, format!("{adresse}{weg}")).header("X-KanbanD-Wer", wer).json(&daten).send().await.unwrap();
    let status = r.status().as_u16();
    let roh = r.text().await.unwrap();
    assert_eq!(status, 403, "{weg}: {roh}");
    let rumpf: Value = serde_json::from_str(&roh).unwrap();
    assert_eq!(rumpf["kuerzel"], json!(kuerzel), "{weg}: {roh}");
    assert!(rumpf["fehler"].as_str().unwrap().contains("nur Menschen"), "{weg}: {roh}");
    assert!(roh.starts_with(r#"{"fehler":"#), "{weg}: `fehler` ist das erste Feld: {roh}");
    assert_eq!(lies(pfad, PERSONEN), datei_vorher, "{weg}: Datei byte-gleich");
    assert_eq!(stand(pfad), vorher, "{weg}: kein Commit");
}

#[tokio::test]
async fn agent_macht_sich_nicht_zum_menschen() {
    let tmp = tempfile::tempdir().unwrap();
    ausgang(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let datei = lies(tmp.path(), PERSONEN);
    let vorher = stand(tmp.path());
    abgewiesen(tmp.path(), a, Method::PATCH, "api/personen/cl", "cl", json!({"art": "human"}), "cl", &datei, &vorher).await;
    // Auch eine fremde Person macht ein Agent nicht zum Agenten: die Art ändert niemand außer Menschen.
    abgewiesen(tmp.path(), a, Method::PATCH, "api/personen/st", "cl", json!({"art": "agent"}), "st", &datei, &vorher).await;
    // Die Sperre, um die es geht, hält: `cl` bleibt Agent und nimmt nichts aus der Menschen-Spalte.
    assert!(personenzeile(tmp.path(), "cl").contains("kind: agent"), "cl bleibt Agent");
    assert_eq!(senden(Method::DELETE, a, "api/aufgaben/1", "cl", json!(null)).await.0, 403, "Menschen-Spalte bleibt gesperrt");
}

#[tokio::test]
async fn agent_laesst_die_art_unveraendert_und_pflegt_andere_felder() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let a = &lauf.adresse;
    let vorher = stand(tmp.path());
    let (s, p) = senden(Method::PATCH, a, "api/personen/cl", "cl", json!({"art": "agent"})).await;
    assert_eq!((s, p["art"].as_str()), (200, Some("agent")), "gleiche Art ist keine Änderung: {p}");
    assert_eq!(stand(tmp.path()), vorher, "ohne Änderung kein Commit");
    let (s, p) = senden(Method::PATCH, a, "api/personen/cl", "cl", json!({"name": "Claude K.", "art": "agent"})).await;
    assert_eq!((s, p["name"].as_str(), p["art"].as_str()), (200, Some("Claude K."), Some("agent")), "Name bleibt erlaubt: {p}");
    assert_eq!(git(tmp.path(), &["show", "--format=%s", "--name-only", "HEAD"]), "Person „Claude K.“ (cl) geändert\n\nkanbanD.md");
}

#[tokio::test]
async fn mensch_aendert_die_art_weiter() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let a = &lauf.adresse;
    let vorher = stand(tmp.path());
    let (s, p) = senden(Method::PATCH, a, "api/personen/cl", "st", json!({"art": "human"})).await;
    assert_eq!((s, p["art"].as_str()), (200, Some("human")));
    assert_ne!(stand(tmp.path()), vorher, "ein Commit");
    assert!(personenzeile(tmp.path(), "cl").contains("kind: human"), "die Datei trägt die neue Art");
}

#[tokio::test]
async fn agent_legt_keinen_menschen_an_und_weiterhin_agenten() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let a = &lauf.adresse;
    let datei = lies(tmp.path(), PERSONEN);
    let vorher = stand(tmp.path());
    abgewiesen(tmp.path(), a, Method::POST, "api/personen", "cl", json!({"kuerzel": "mi", "name": "Mia", "art": "human"}), "mi", &datei, &vorher).await;
    let (s, p) = senden(Method::POST, a, "api/personen", "cl", json!({"kuerzel": "ag2", "name": "Zweiter Agent", "art": "agent"})).await;
    assert_eq!((s, p["art"].as_str()), (201, Some("agent")), "einen Agenten anzulegen bleibt erlaubt: {p}");
    // Der Mensch legt weiterhin einen Menschen an (Kontrollpaar).
    let (s, p) = senden(Method::POST, a, "api/personen", "st", json!({"kuerzel": "mi", "name": "Mia", "art": "human"})).await;
    assert_eq!((s, p["art"].as_str()), (201, Some("human")));
    assert!(personenzeile(tmp.path(), "mi").contains("kind: human"));
}

#[tokio::test]
async fn agent_ersetzt_die_einstellungen_nicht_mit_sich_als_menschen() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let a = &lauf.adresse;
    let (_, e) = senden(Method::GET, a, "api/einstellungen", "cl", json!(null)).await;
    let datei = lies(tmp.path(), PERSONEN);
    let vorher = stand(tmp.path());
    let mut selbst = e.clone();
    selbst["personen"][1]["art"] = json!("human");
    abgewiesen(tmp.path(), a, Method::PUT, "api/einstellungen", "cl", selbst, "cl", &datei, &vorher).await;
    let mut neuer = e.clone();
    neuer["personen"].as_array_mut().unwrap().push(json!({"kuerzel": "mi", "name": "Mia", "art": "human", "aktiv": true}));
    abgewiesen(tmp.path(), a, Method::PUT, "api/einstellungen", "cl", neuer, "mi", &datei, &vorher).await;
    // Ein reiner Namenswechsel über denselben Weg bleibt erlaubt; der Mensch ändert die Art weiterhin.
    let mut name = e.clone();
    name["personen"][1]["name"] = json!("Claude K.");
    assert_eq!(senden(Method::PUT, a, "api/einstellungen", "cl", name).await.0, 200, "Name ändern bleibt erlaubt");
    let mut mensch = e;
    mensch["personen"][1]["art"] = json!("human");
    assert_eq!(senden(Method::PUT, a, "api/einstellungen", "st", mensch).await.0, 200, "der Mensch darf");
}
