//! Transkripte der Agentenläufe ablegen, lesen und löschen (R00216, ADR-0036). Die gz-Datei liegt unversioniert unter
//! `transkripte/<nr>/` (darin `transkripte/.gitignore` = `*`), versioniert wird nur der Eintrag `transcripts` an der Karte.
//!
//! **Pfadschutz (Regel 7):** Ein Pfad unter `transkripte/` entsteht nur in [`datei`] — aus der Nummer der Route und dem
//! Namen, den [`Transkripteintrag::dateiname`] aus der geprüften Kennung faltet. Vor jedem Öffnen, Umbenennen und Löschen
//! prüft sie den Namen gegen das Muster und weist Symlinks auf `transkripte/`, `transkripte/<nr>/` und die Datei ab.

use crate::modell::Transkripteintrag;
use std::path::{Path, PathBuf};

/// Ordner der Transkripte im Board-Ordner (ADR-0036 Regel 1).
pub const ORDNER: &str = "transkripte";
/// Inhalt von `transkripte/.gitignore`: der Ordner ignoriert sich selbst, die `.gitignore` des Menschen bleibt unberührt.
const GITIGNORE: &str = "*\n";

/// Warum zu einem Eintrag kein sicherer Pfad entsteht. Für die Liste heißt jeder Fall `unlesbar`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Pfadfehler {
    /// Der gefaltete Name passt nicht auf das Muster — darf nicht vorkommen, ist die zweite Linie.
    Muster(String),
    /// `transkripte/`, `transkripte/<nr>/` oder die Datei ist ein Symlink oder hat die falsche Art.
    Unsicher(String),
}

impl Pfadfehler {
    pub(crate) fn meldung(&self) -> &str {
        match self {
            Pfadfehler::Muster(m) | Pfadfehler::Unsicher(m) => m,
        }
    }
}

/// Der eine Ort, an dem ein Pfad unter `transkripte/` entsteht (ADR-0036 Regel 7): `<wurzel>/transkripte/<nr4>/<name>`.
/// Prüft den Namen gegen `^[a-z0-9-]{1,60}@\d{4}-\d{2}-\d{2}T\d{4}[+-]\d{4}\.jsonl\.gz$` und dass `transkripte/` und
/// `transkripte/<nr4>/` keine Symlinks und, wenn vorhanden, Ordner sind und die Datei, wenn vorhanden, kein Symlink ist.
/// Was fehlt, ist kein Fehler — ob die Datei da ist, entscheidet der Aufrufer.
pub(crate) fn datei(wurzel: &Path, nr: u32, eintrag: &Transkripteintrag) -> Result<PathBuf, Pfadfehler> {
    let name = eintrag.dateiname();
    if !name_passt(&name) {
        return Err(Pfadfehler::Muster(format!("Programmfehler: Dateiname „{name}“ passt nicht auf das Muster der Transkripte")));
    }
    let ordner = aufgabenordner(wurzel, nr)?;
    let pfad = ordner.join(&name);
    if std::fs::symlink_metadata(&pfad).is_ok_and(|m| !m.is_file()) {
        return Err(Pfadfehler::Unsicher(format!("{ORDNER}/{nr:04}/{name} ist keine gewöhnliche Datei")));
    }
    Ok(pfad)
}

/// `<wurzel>/transkripte/<nr4>` nach der Prüfung beider Ebenen; fehlt eine, ist das kein Fehler.
pub(crate) fn aufgabenordner(wurzel: &Path, nr: u32) -> Result<PathBuf, Pfadfehler> {
    let oben = wurzel.join(ORDNER);
    ordner_pruefen(&oben, ORDNER)?;
    let ordner = oben.join(format!("{nr:04}"));
    ordner_pruefen(&ordner, &format!("{ORDNER}/{nr:04}"))?;
    Ok(ordner)
}

/// Legt `transkripte/` mit seiner `.gitignore` und `transkripte/<nr4>/` an, wo sie fehlen — eine vorhandene `.gitignore`
/// bleibt, wie sie ist (Regel 1). Danach dieselbe Prüfung wie [`aufgabenordner`].
pub(crate) fn ordner_anlegen(wurzel: &Path, nr: u32) -> Result<PathBuf, Pfadfehler> {
    let unsicher = |e: std::io::Error| Pfadfehler::Unsicher(format!("{ORDNER}/ lässt sich nicht anlegen: {e}"));
    let oben = wurzel.join(ORDNER);
    ordner_pruefen(&oben, ORDNER)?;
    match std::fs::create_dir(&oben) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(e) => return Err(unsicher(e)),
    }
    ordner_pruefen(&oben, ORDNER)?;
    let ignorieren = oben.join(".gitignore");
    if std::fs::symlink_metadata(&ignorieren).is_err() {
        use std::io::Write;
        match std::fs::OpenOptions::new().write(true).create_new(true).open(&ignorieren) {
            Ok(mut f) => f.write_all(GITIGNORE.as_bytes()).map_err(unsicher)?,
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(e) => return Err(unsicher(e)),
        }
    }
    let ordner = oben.join(format!("{nr:04}"));
    match std::fs::create_dir(&ordner) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(e) => return Err(unsicher(e)),
    }
    aufgabenordner(wurzel, nr)
}

/// Ein vorhandener Pfad muss ein echter Ordner sein (kein Symlink); ein fehlender ist in Ordnung.
fn ordner_pruefen(pfad: &Path, anzeige: &str) -> Result<(), Pfadfehler> {
    match std::fs::symlink_metadata(pfad) {
        Ok(m) if m.file_type().is_symlink() => Err(Pfadfehler::Unsicher(format!("{anzeige} ist ein Symlink — kanbanD folgt ihm nicht"))),
        Ok(m) if !m.is_dir() => Err(Pfadfehler::Unsicher(format!("{anzeige} ist kein Ordner"))),
        _ => Ok(()),
    }
}

/// `^[a-z0-9-]{1,60}@\d{4}-\d{2}-\d{2}T\d{4}[+-]\d{4}\.jsonl\.gz$` ohne Regex-Bibliothek.
fn name_passt(name: &str) -> bool {
    let Some((rolle, rest)) = name.split_once('@') else { return false };
    let rolle_passt = (1..=60).contains(&rolle.len()) && rolle.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    let Some(zeit) = rest.strip_suffix(".jsonl.gz") else { return false };
    let z = zeit.as_bytes();
    let ziffern = |von: usize, bis: usize| z[von..bis].iter().all(u8::is_ascii_digit);
    rolle_passt && z.len() == 20 && ziffern(0, 4) && z[4] == b'-' && ziffern(5, 7) && z[7] == b'-' && ziffern(8, 10) && z[10] == b'T' && ziffern(11, 15) && (z[15] == b'+' || z[15] == b'-') && ziffern(16, 20)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn eintrag(rolle: &str) -> Transkripteintrag {
        Transkripteintrag::neu("t", Some("2026-11-13 10:34+01:00"), Some(rolle), Some("E"), 1).unwrap()
    }

    #[test]
    fn muster_der_dateinamen() {
        for gut in ["entwickler@2026-11-13T1034+0100.jsonl.gz", "a@0000-00-00T0000-9999.jsonl.gz", &format!("{}@2026-11-13T1034+0100.jsonl.gz", "a".repeat(60))] {
            assert!(name_passt(gut), "{gut}");
        }
        for schlecht in ["", "@2026-11-13T1034+0100.jsonl.gz", "../x@2026-11-13T1034+0100.jsonl.gz", "a/b@2026-11-13T1034+0100.jsonl.gz", "A@2026-11-13T1034+0100.jsonl.gz", &format!("{}@2026-11-13T1034+0100.jsonl.gz", "a".repeat(61)), "a@2026-11-13T10:34+01:00.jsonl.gz", "a@2026-11-13T1034+0100.jsonl", "a@2026-11-13T1034+0100.jsonl.gz/", "a@b@2026-11-13T1034+0100.jsonl.gz", "a@2026-11-13T1034 0100.jsonl.gz"] {
            assert!(!name_passt(schlecht), "{schlecht}");
        }
    }

    #[test]
    fn pfad_unter_dem_ordner_der_aufgabe() {
        let w = tempfile::tempdir().unwrap();
        assert_eq!(datei(w.path(), 1, &eintrag("../../x")).unwrap(), w.path().join("transkripte/0001/x@2026-11-13T1034+0100.jsonl.gz"));
        assert!(!w.path().join("transkripte").exists(), "nur rechnen, nichts anlegen");
        assert_eq!(datei(w.path(), 208, &eintrag("Code Reviewer")).unwrap(), w.path().join("transkripte/0208/code-reviewer@2026-11-13T1034+0100.jsonl.gz"));
    }

    // R00216 AK 2, ADR-0036 Regel 1: `.gitignore` anlegen, wenn sie fehlt; eine vorhandene bleibt byte-gleich
    #[test]
    fn ordner_anlegen_schreibt_die_gitignore_nur_einmal() {
        let w = tempfile::tempdir().unwrap();
        assert_eq!(ordner_anlegen(w.path(), 1).unwrap(), w.path().join("transkripte/0001"));
        assert_eq!(std::fs::read_to_string(w.path().join("transkripte/.gitignore")).unwrap(), "*\n");
        std::fs::write(w.path().join("transkripte/.gitignore"), "# von Hand\n*\n").unwrap();
        ordner_anlegen(w.path(), 2).unwrap();
        assert_eq!(std::fs::read_to_string(w.path().join("transkripte/.gitignore")).unwrap(), "# von Hand\n*\n");
        assert!(w.path().join("transkripte/0002").is_dir());
    }

    // R00216 AK 9c/9d, ADR-0036 Regel 7: ein Symlink auf jeder Ebene wird abgewiesen, ohne ihm zu folgen
    #[cfg(unix)]
    #[test]
    fn symlinks_auf_jeder_ebene_werden_abgewiesen() {
        use std::os::unix::fs::symlink;
        let aussen = tempfile::tempdir().unwrap();
        let unsicher = |r: Result<PathBuf, Pfadfehler>| matches!(r, Err(Pfadfehler::Unsicher(_)));

        let w = tempfile::tempdir().unwrap();
        std::fs::create_dir(w.path().join("transkripte")).unwrap();
        symlink(aussen.path(), w.path().join("transkripte/0001")).unwrap();
        assert!(unsicher(datei(w.path(), 1, &eintrag("x"))), "transkripte/<nr> ist ein Symlink");
        assert!(unsicher(ordner_anlegen(w.path(), 1)));

        let w = tempfile::tempdir().unwrap();
        symlink(aussen.path(), w.path().join("transkripte")).unwrap();
        assert!(unsicher(datei(w.path(), 1, &eintrag("x"))), "transkripte/ ist ein Symlink");
        assert!(unsicher(ordner_anlegen(w.path(), 1)));
        assert_eq!(std::fs::read_dir(aussen.path()).unwrap().count(), 0, "außen nichts angelegt");

        let w = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(w.path().join("transkripte/0001")).unwrap();
        std::fs::write(aussen.path().join("ziel"), "fremd").unwrap();
        symlink(aussen.path().join("ziel"), w.path().join("transkripte/0001/x@2026-11-13T1034+0100.jsonl.gz")).unwrap();
        assert!(unsicher(datei(w.path(), 1, &eintrag("x"))), "die Datei ist ein Symlink");

        let w = tempfile::tempdir().unwrap();
        std::fs::write(w.path().join("transkripte"), "keine Mappe").unwrap();
        assert!(unsicher(datei(w.path(), 1, &eintrag("x"))), "transkripte ist eine Datei");
    }
}
