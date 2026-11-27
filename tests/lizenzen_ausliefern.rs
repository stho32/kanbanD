//! R00263 AK 3 (B1433, Probe P1): `GET /web/LIZENZEN.md` wird als eingebettete
//! Textdatei ausgeliefert und ist bytegleich zur committeten `web/LIZENZEN.md`.

mod gemeinsam;

use gemeinsam::{mit_drei_aufgaben, senden_roh};
use reqwest::Method;
use std::path::Path;

#[tokio::test]
async fn lizenzhinweise_werden_ausgeliefert() {
    let tmp = tempfile::tempdir().unwrap();
    mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let antwort = senden_roh(Method::GET, &lauf.adresse, "web/LIZENZEN.md", "st", None, "").await;
    assert_eq!(antwort.status, 200, "Status");
    assert_eq!(antwort.art, "text/plain; charset=utf-8", "Content-Type");

    let datei =
        std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("web/LIZENZEN.md")).unwrap();
    assert_eq!(antwort.text, datei, "der Rumpf ist die committete Datei");
    assert!(antwort.text.contains("## Enthaltene Pakete"), "Abschnitt der enthaltenen Pakete");
    assert!(antwort.text.contains("### tower 0.5.3"), "ein enthaltenes Paket mit den vier Feldern");
    assert!(antwort.text.contains("Lizenz:"), "Lizenzfeld");
    assert!(antwort.text.contains("Urhebertext:"), "Urhebertextfeld");
}
