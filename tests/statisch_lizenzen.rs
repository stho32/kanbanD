//! R00227 AK 1 und AK 2 (B1183): Die Lizenz der eingebetteten Schriften wird ausgeliefert,
//! und jede Datei unter `web/fonts/` und `web/vendor/` ist im Programm eingebettet.

mod gemeinsam;

use gemeinsam::{mit_drei_aufgaben, senden_roh};
use reqwest::Method;
use std::path::Path;

async fn holen(adresse: &str, pfad: &str) -> (u16, String, String) {
    let a = senden_roh(Method::GET, adresse, pfad, "st", None, "").await;
    (a.status, a.art, a.text)
}

fn typ_nach_endung(datei: &Path) -> Option<&'static str> {
    match datei.extension()?.to_str()? {
        "woff2" => Some("font/woff2"),
        "js" => Some("text/javascript; charset=utf-8"),
        "txt" => Some("text/plain; charset=utf-8"),
        _ => None,
    }
}

#[tokio::test]
async fn ofl_lizenz_wird_ausgeliefert() {
    let tmp = tempfile::tempdir().unwrap();
    mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let (status, art, text) = holen(&lauf.adresse, "web/fonts/LICENSE-OFL.txt").await;
    assert_eq!((status, art.as_str()), (200, "text/plain; charset=utf-8"));
    assert!(text.starts_with("Copyright 2019 IBM Corp."), "Anfang des Lizenztextes: {}", &text[..text.len().min(60)]);
    assert!(text.contains("SIL OPEN FONT LICENSE Version 1.1"), "Lizenzname im Text");
}

#[tokio::test]
async fn prism_lizenz_bleibt_unveraendert() {
    let tmp = tempfile::tempdir().unwrap();
    mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let (status, art, text) = holen(&lauf.adresse, "web/vendor/LICENSE-prism.txt").await;
    assert_eq!((status, art.as_str()), (200, "text/plain; charset=utf-8"));
    assert!(text.starts_with("MIT LICENSE"), "Anfang des Prism-Lizenztextes");
}

#[tokio::test]
async fn jede_datei_unter_fonts_und_vendor_ist_eingebettet() {
    let tmp = tempfile::tempdir().unwrap();
    mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let mut gefunden = 0;
    let mut fehler: Vec<String> = Vec::new();
    for ordner in ["fonts", "vendor"] {
        let pfad = Path::new(env!("CARGO_MANIFEST_DIR")).join("web").join(ordner);
        for eintrag in std::fs::read_dir(&pfad).unwrap_or_else(|e| panic!("{} nicht lesbar: {e}", pfad.display())) {
            let datei = eintrag.unwrap().path();
            let name = datei.file_name().unwrap().to_str().unwrap().to_string();
            let rel = format!("{ordner}/{name}");
            if datei.is_dir() {
                fehler.push(format!("{rel}: Unterordner, nicht geprüft"));
                continue;
            }
            gefunden += 1;
            let Some(erwartet) = typ_nach_endung(&datei) else {
                fehler.push(format!("{rel}: Endung ohne bekannten Typ"));
                continue;
            };
            let (status, art, _) = holen(&lauf.adresse, &format!("web/{rel}")).await;
            if (status, art.as_str()) != (200, erwartet) {
                fehler.push(format!("{rel}: erwartet 200 {erwartet}, bekommen {status} {art}"));
            }
        }
    }
    assert!(gefunden >= 8, "mindestens 8 Dateien unter web/fonts und web/vendor erwartet, gefunden {gefunden}");
    assert!(fehler.is_empty(), "nicht eingebettet oder falscher Typ:\n{}", fehler.join("\n"));
}
