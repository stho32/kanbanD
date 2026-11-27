//! Erzeugt `web/LIZENZEN.md` aus `Cargo.lock` (R00263, ADR-0045).
//!
//! Aufruf: `cargo run --features lizenzen --example lizenzen`
//! Die Datei entsteht im Wurzelverzeichnis des Repositorys und wird committet.
//!
//! Das Beispiel ist absichtlich kein installiertes Kommando: `cargo install --path`
//! und ein Release-Bau ohne das Feature `lizenzen` sehen es nicht.

use kanband::lizenzen::{ausnahmen, auswahl, enthaltene, formatiere, lesen, pruefen, Metadaten};
use std::path::PathBuf;
use std::process::Command;

/// Die Release-Ziele, für die die Hinweise gelten (ADR-0045).
const ZIELE: &[&str] = &["x86_64-unknown-linux-gnu", "x86_64-pc-windows-msvc"];

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let wurzel = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());
    let nur_pruefen = std::env::args().any(|a| a == "--pruefen");

    let komplett = metadaten(&cargo, &[])?;
    let mut plattformen = Vec::new();
    for ziel in ZIELE {
        plattformen.push(metadaten(&cargo, &["--filter-platform", ziel])?);
    }

    let auswahl = auswahl(&komplett, &plattformen.iter().collect::<Vec<_>>());
    let pakete = enthaltene(&komplett, &auswahl)?;
    let ausnahmen = ausnahmen(&komplett, &auswahl);
    let inhalt = formatiere(&pakete, &ausnahmen);

    let ziel = wurzel.join("web").join("LIZENZEN.md");
    if nur_pruefen {
        let datei = std::fs::read_to_string(&ziel)
            .map_err(|e| format!("{} nicht lesbar: {e}", ziel.display()))?;
        if let Err(namen) = pruefen(&datei, &inhalt) {
            eprintln!("web/LIZENZEN.md ist veraltet — neu erzeugen mit");
            eprintln!("  cargo run --features lizenzen --example lizenzen");
            for name in namen {
                eprintln!("  {name}");
            }
            std::process::exit(1);
        }
        eprintln!("web/LIZENZEN.md ist aktuell ({}).", umfang(pakete.len(), ausnahmen.len()));
        return Ok(());
    }

    std::fs::write(&ziel, inhalt)?;
    eprintln!("{} → {}", umfang(pakete.len(), ausnahmen.len()), ziel.display());
    Ok(())
}

/// „97 Pakete, 64 Ausnahmen“ — mit richtiger Einzahl, falls es einmal nur eines ist.
fn umfang(pakete: usize, ausnahmen: usize) -> String {
    format!("{}, {}", anzahl(pakete, "Paket", "Pakete"), anzahl(ausnahmen, "Ausnahme", "Ausnahmen"))
}

fn anzahl(n: usize, einzahl: &str, mehrzahl: &str) -> String {
    if n == 1 {
        format!("1 {einzahl}")
    } else {
        format!("{n} {mehrzahl}")
    }
}

fn metadaten(cargo: &str, zusatz: &[&str]) -> Result<Metadaten, Box<dyn std::error::Error>> {
    let ausgabe = Command::new(cargo).args(["metadata", "--format-version", "1"]).args(zusatz).output()?;
    if !ausgabe.status.success() {
        return Err(format!("cargo metadata fehlgeschlagen: {}", String::from_utf8_lossy(&ausgabe.stderr)).into());
    }
    Ok(lesen(std::str::from_utf8(&ausgabe.stdout)?)?)
}
