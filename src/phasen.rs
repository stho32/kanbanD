//! Phasen einer Anwendung (Phasen-Datei neben ihrer WBS) und ihre Spalten auf einem Board — rein, ohne Dateizugriff.

use serde::Serialize;
use std::path::{Path, PathBuf};

/// Eine Phase der Hauptspur: Name, „Eingebettet in“ (z. B. `im-pair`) und „Gleich wie“ (Name einer früheren Phase); leer heißt nicht gesetzt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Phase {
    pub nr: u32,
    pub name: String,
    pub eingebettet: String,
    pub gleich: String,
}

/// Die Phasen der Hauptspur in der Reihenfolge der Spalte `Nr`; die erste ist die Entwicklung.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Phasenfolge(Vec<Phase>);

/// Spalten der Tabelle `## Phasen` ohne Kopfzeile — Datenmodell der Phasen-Datei (`/planung`).
const STANDARD_KOPF: [&str; 9] = ["Nr", "Phase", "Abschließt", "Nachweis", "Eingebettet in", "Gleich wie", "Spur", "Braucht", "Status"];

fn phase(nr: u32, name: &str) -> Phase {
    Phase { nr, name: name.into(), eingebettet: String::new(), gleich: String::new() }
}

impl Phasenfolge {
    /// Das Standardmodell, wenn eine Anwendung keine Phasen-Datei hat.
    pub fn standard() -> Phasenfolge {
        Phasenfolge(vec![phase(1, "Entwicklung"), phase(2, "Entwicklertest"), phase(3, "Abnahme")])
    }

    /// `Dokumentation/Planung/kanbanD.md` → `Dokumentation/Planung/kanbanD-phasen.md`
    pub fn pfad_neben(wbs: &Path) -> PathBuf {
        let stamm = wbs.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        wbs.with_file_name(format!("{stamm}-phasen.md"))
    }

    /// Liest die Tabelle `## Phasen`: Spalten über die Kopfzeile, nur Hauptspur (Spur leer), ohne `verworfen`, nach `Nr`.
    /// Ohne lesbare Phase gilt das Standardmodell.
    pub fn lesen(text: &str) -> Phasenfolge {
        let mut abschnitt = "";
        let mut kopf: Vec<String> = STANDARD_KOPF.iter().map(|s| s.to_string()).collect();
        let mut phasen = vec![];
        for zeile in text.lines().map(str::trim) {
            if let Some(titel) = zeile.strip_prefix("## ") {
                abschnitt = titel.trim();
                continue;
            }
            if abschnitt != "Phasen" || !zeile.starts_with('|') {
                continue;
            }
            let zellen: Vec<String> = zeile.trim_matches('|').split('|').map(|z| z.trim().to_string()).collect();
            if zellen.first().is_some_and(|z| z == "Nr") {
                kopf = zellen;
                continue;
            }
            let wert = |titel: &str| kopf.iter().position(|k| k == titel).and_then(|i| zellen.get(i)).map(String::as_str).unwrap_or("");
            let Ok(nr) = wert("Nr").parse::<u32>() else { continue };
            if !wert("Spur").is_empty() || wert("Status").eq_ignore_ascii_case("verworfen") || wert("Phase").is_empty() {
                continue;
            }
            phasen.push(Phase { nr, name: wert("Phase").into(), eingebettet: wert("Eingebettet in").into(), gleich: wert("Gleich wie").into() });
        }
        phasen.sort_by_key(|p| p.nr);
        if phasen.is_empty() { Phasenfolge::standard() } else { Phasenfolge(phasen) }
    }

    pub fn alle(&self) -> &[Phase] {
        &self.0
    }

    pub fn namen(&self) -> Vec<&str> {
        self.0.iter().map(|p| p.name.as_str()).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DATEI: &str = "---\napplication: X\n---\n\n# Phasen — X\n\n## Phasen\n\n| Nr | Phase | Abschließt | Nachweis | Eingebettet in | Gleich wie | Spur | Braucht | Status |\n|---|---|---|---|---|---|---|---|---|\n| 1 | Entwicklung | Subagent | — | | | | | |\n| 3 | Abnahme | Auftraggeber | akzeptanzkriterien | | Entwicklertest | | | |\n| 2 | Entwicklertest | Entwickler | user-story | im-pair | | | | |\n| 4 | Beta | Kunde | frei | | | | | verworfen |\n| 5 | Code-Review | Entwickler | review-im-pair | | | technik | | |\n\n## Durchläufe\n\n| Arbeitspaket | Phase | Datum | Ergebnis | Wer | Beleg |\n|---|---|---|---|---|---|\n| 3 | Abnahme | 2026-01-01 | bestanden | S | x |\n";

    #[test]
    fn hauptspur_nach_nr_ohne_verworfene_und_nebenspuren() {
        let f = Phasenfolge::lesen(DATEI);
        assert_eq!(f.namen(), ["Entwicklung", "Entwicklertest", "Abnahme"]);
        assert_eq!((f.alle()[1].eingebettet.as_str(), f.alle()[2].gleich.as_str()), ("im-pair", "Entwicklertest"));
        assert_eq!(f.alle()[0].eingebettet, "", "leere Zellen bleiben leer");
    }

    #[test]
    fn spalten_ueber_die_kopfzeile_zugeordnet() {
        let t = "## Phasen\n\n| Nr | Status | Gleich wie | Phase |\n|---|---|---|---|\n| 1 | | | Entwicklung |\n| 2 | verworfen | | Alt |\n| 3 | | Entwicklung | Review |\n";
        let f = Phasenfolge::lesen(t);
        assert_eq!(f.namen(), ["Entwicklung", "Review"]);
        assert_eq!(f.alle()[1].gleich, "Entwicklung");
        assert_eq!(f.alle()[1].eingebettet, "", "fehlende Spalte heißt leer");
    }

    #[test]
    fn ohne_kopfzeile_gilt_die_reihenfolge_des_datenmodells() {
        let f = Phasenfolge::lesen("## Phasen\n| 1 | Entwicklung | x | — | | | | | |\n| 2 | Test | x | frei | im-pair | | | | |\n");
        assert_eq!(f.namen(), ["Entwicklung", "Test"]);
        assert_eq!(f.alle()[1].eingebettet, "im-pair");
    }

    #[test]
    fn ohne_lesbare_phase_das_standardmodell() {
        assert_eq!(Phasenfolge::lesen(""), Phasenfolge::standard());
        assert_eq!(Phasenfolge::lesen("## Durchläufe\n| 1 | Entwicklung |\n"), Phasenfolge::standard(), "Tabelle in einem anderen Abschnitt");
        assert_eq!(Phasenfolge::standard().namen(), ["Entwicklung", "Entwicklertest", "Abnahme"]);
    }

    #[test]
    fn pfad_der_phasen_datei_neben_der_wbs() {
        assert_eq!(Phasenfolge::pfad_neben(Path::new("/a/Planung/kanbanD.md")), PathBuf::from("/a/Planung/kanbanD-phasen.md"));
    }
}
