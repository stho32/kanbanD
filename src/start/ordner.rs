use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Legt den Ordner bei Bedarf an und sorgt dafür, dass er in einem Git-Repository liegt.
/// Liefert den absoluten Pfad.
pub fn ordner_vorbereiten(pfad: &Path) -> io::Result<PathBuf> {
    std::fs::create_dir_all(pfad)?;
    let absolut = pfad.canonicalize()?;
    if !liegt_in_git_repository(&absolut) {
        let ausgabe = Command::new("git").arg("-C").arg(&absolut).args(["init", "-q"]).output()?;
        if !ausgabe.status.success() {
            return Err(io::Error::other(format!("git init fehlgeschlagen: {}", String::from_utf8_lossy(&ausgabe.stderr))));
        }
    }
    Ok(absolut)
}

pub fn liegt_in_git_repository(pfad: &Path) -> bool {
    Command::new("git")
        .arg("-C")
        .arg(pfad)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output()
        .map(|a| a.status.success())
        .unwrap_or(false)
}
