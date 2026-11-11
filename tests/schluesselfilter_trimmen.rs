// R00132 Der key-Filter trimmt beim Lesen wie das Anlegen (R00098), sonst unverändert.
mod gemeinsam;

use gemeinsam::{git, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

/// Ordner „Entwicklung“ mit #7 `key: k1` und #9 `key: k9`, beide offen in „Zu erledigen“.
fn ordner(pfad: &Path) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("aufgaben/0007-fund.md"), "---\nid: 7\ntitle: Fund\nkey: k1\n---\n").unwrap();
    std::fs::write(pfad.join("aufgaben/0009-neun.md"), "---\nid: 9\ntitle: Neun\nkey: k9\n---\n").unwrap();
    std::fs::write(pfad.join("boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n- [#7](../aufgaben/0007-fund.md)\n- [#9](../aufgaben/0009-neun.md)\n\n## In Arbeit\n\n## Erledigt\n").unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Karten"]);
}

async fn getroffen(adresse: &str, abfrage: &str) -> (u16, Vec<u64>) {
    let (s, r) = senden(Method::GET, adresse, &format!("api/aufgaben?{abfrage}"), "st", Value::Null).await;
    let mut n: Vec<u64> = r["aufgaben"].as_array().map(|l| l.iter().map(|a| a["nummer"].as_u64().unwrap()).collect()).unwrap_or_default();
    n.sort();
    (s, n)
}

// AK Trimmen wie beim Anlegen, Grenzen (B0614)
#[tokio::test]
async fn key_trimmt_beim_lesen_wie_beim_anlegen() {
    let tmp = tempfile::tempdir().unwrap();
    ordner(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    assert_eq!(getroffen(a, "key=%20k1%20").await, (200, vec![7]), "Leerraum davor und dahinter");
    assert_eq!(getroffen(a, "key=%09k1%0A").await, (200, vec![7]), "Tabulator davor, Umbruch dahinter");
    assert_eq!(getroffen(a, "key=k1").await, (200, vec![7]), "unverändert");
    assert_eq!(getroffen(a, "key=%20%20").await, (200, vec![]), "nur Leerraum trifft nichts, kein 400");
    assert_eq!(getroffen(a, "key=%20K1%20").await, (200, vec![]), "nach dem Trimmen zählt Groß/Klein weiter");
    assert_eq!(getroffen(a, "key=%20k1%20&key=k9").await, (200, vec![7, 9]), "mehrere key: ODER wie heute");
    assert_eq!(getroffen(a, "key=k").await, (200, vec![]), "kein Teilstück");
    assert_eq!(getroffen(a, "key=").await, (200, vec![]), "leer trifft nichts, kein 400");
}

// AK Archivregel unverändert (B0614)
#[tokio::test]
async fn key_trimmt_und_die_archivregel_bleibt() {
    let tmp = tempfile::tempdir().unwrap();
    ordner(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (s, r) = senden(Method::POST, a, "api/aufgaben/7/archivieren", "st", json!(null)).await;
    assert_eq!(s, 200, "{r}");
    assert_eq!(getroffen(a, "key=%20k1%20").await, (200, vec![]), "archiviert bleibt ausgeblendet");
    assert_eq!(getroffen(a, "key=%20k1%20&archivierte=ja").await, (200, vec![7]), "archivierte=ja zeigt sie");
}
