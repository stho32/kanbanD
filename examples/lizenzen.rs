//! Erzeugt `web/LIZENZEN.md` aus `Cargo.lock` (R00263, ADR-0045).
//!
//! Aufruf: `cargo run --features lizenzen --example lizenzen`
//! Die Datei entsteht im Wurzelverzeichnis des Repositorys und wird committet.
//!
//! Das Beispiel ist absichtlich kein installiertes Kommando: `cargo install --path`
//! und ein Release-Bau ohne das Feature `lizenzen` sehen es nicht.

use kanband::lizenzen::{ausnahmen, auswahl, enthaltene, formatiere, lesen, Metadaten};
use std::path::PathBuf;
use std::process::Command;

/// Die Release-Ziele, für die die Hinweise gelten (ADR-0045).
const ZIELE: &[&str] = &["x86_64-unknown-linux-gnu", "x86_64-pc-windows-msvc"];

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let wurzel = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());

    let komplett = metadaten(&cargo, &[])?;
    let mut plattformen = Vec::new();
    for ziel in ZIELE {
        plattformen.push(metadaten(&cargo, &["--filter-platform", ziel])?);
    }

    let auswahl = auswahl(&komplett, &plattformen.iter().collect::<Vec<_>>());
    let pakete = enthaltene(&komplett, &auswahl)?;
    let ausnahmen = ausnahmen(&komplett, &auswahl);

    let ziel = wurzel.join("web").join("LIZENZEN.md");
    std::fs::write(&ziel, formatiere(&pakete, &ausnahmen))?;
    eprintln!("{} Pakete, {} Ausnahmen → {}", pakete.len(), ausnahmen.len(), ziel.display());
    Ok(())
}

fn metadaten(cargo: &str, zusatz: &[&str]) -> Result<Metadaten, Box<dyn std::error::Error>> {
    let ausgabe = Command::new(cargo).args(["metadata", "--format-version", "1"]).args(zusatz).output()?;
    if !ausgabe.status.success() {
        return Err(format!("cargo metadata fehlgeschlagen: {}", String::from_utf8_lossy(&ausgabe.stderr)).into());
    }
    Ok(lesen(std::str::from_utf8(&ausgabe.stdout)?)?)
}
