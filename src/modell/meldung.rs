//! Eine Modell-Abweisung mit zwei Fassungen (R00258 FA 13, ADR-0001 N1.8 Regel 1): der Antwortrumpf nennt den
//! Inhalt im Wortlaut, das Protokoll an seiner Stelle nur seine Länge `<n Zeichen>`.
//!
//! Reine Daten, ohne Bezug auf [`crate::fehler::Fehler`] — die Abhängigkeit `modell → fehler` wäre sonst ein Kreis
//! (`fehler` liest `modell::Einstellung`). Die Umhüllung in eine Fehlerart mit Status und Ursache macht die
//! Dienstschicht (`Fehler::ungueltig_mit_inhalt` und Verwandte).

use std::fmt;
use std::ops::Deref;

/// Die Länge eines Inhalts fürs Protokoll: `<n Zeichen>` (R00258 FA 13, ADR-0001 N1.8 Regel 1).
pub fn inhalt_laenge(inhalt: &str) -> String {
    format!("<{} Zeichen>", inhalt.chars().count())
}

/// Eine Meldung mit getrennten Fassungen für den Antwortrumpf (`meldung`) und das Protokoll (`grund`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Meldung {
    /// Die Meldung, wie sie der Client sieht (Inhalt im Wortlaut).
    pub meldung: String,
    /// Die Fassung fürs Protokoll (Inhalt nur als `<n Zeichen>`).
    pub grund: String,
}

impl Meldung {
    /// Eine Meldung ohne Inhalt — Rumpf und Protokoll sind gleich.
    pub fn ohne(text: impl Into<String>) -> Meldung {
        let text = text.into();
        Meldung { grund: text.clone(), meldung: text }
    }

    /// Eine Meldung, deren Rumpf Inhalt einsetzt; `grund` ist die inhaltsfreie Fassung.
    pub fn mit(meldung: impl Into<String>, grund: impl Into<String>) -> Meldung {
        Meldung { meldung: meldung.into(), grund: grund.into() }
    }
}

impl From<String> for Meldung {
    fn from(text: String) -> Meldung {
        Meldung::ohne(text)
    }
}

impl From<&str> for Meldung {
    fn from(text: &str) -> Meldung {
        Meldung::ohne(text)
    }
}

impl fmt::Display for Meldung {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.meldung)
    }
}

/// `Meldung` liest sich wie ihr Rumpftext: `contains`, `starts_with`, `chars()` und Vergleiche mit `&str` wirken auf
/// `meldung`. So bleiben die Tests des Modells bei ihrer Aussage über den Rumpf, ohne `meldung` auszuschreiben.
impl Deref for Meldung {
    type Target = str;
    fn deref(&self) -> &str {
        &self.meldung
    }
}

impl PartialEq<&str> for Meldung {
    fn eq(&self, other: &&str) -> bool {
        self.meldung == *other
    }
}

impl PartialEq<str> for Meldung {
    fn eq(&self, other: &str) -> bool {
        self.meldung == other
    }
}

impl PartialEq<String> for Meldung {
    fn eq(&self, other: &String) -> bool {
        &self.meldung == other
    }
}

impl PartialEq<Meldung> for &str {
    fn eq(&self, other: &Meldung) -> bool {
        *self == other.meldung
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ohne_hat_gleiche_fassungen() {
        let m = Meldung::ohne("Etwas fehlt");
        assert_eq!(m.meldung, "Etwas fehlt");
        assert_eq!(m.grund, "Etwas fehlt");
        assert_eq!(m, "Etwas fehlt", "der Vergleich mit &str liest den Rumpf");
    }

    #[test]
    fn mit_trennt_rumpf_und_grund() {
        let inhalt = "GEHEIM-239";
        let m = Meldung::mit(format!("Person „{inhalt}“ steht nicht in kanbanD.md"), format!("Person „{}“ steht nicht in kanbanD.md", inhalt_laenge(inhalt)));
        assert!(m.contains(inhalt), "der Rumpf nennt den Inhalt: {m}");
        assert_eq!(m.grund, "Person „<10 Zeichen>“ steht nicht in kanbanD.md");
        assert!(!m.grund.contains(inhalt));
    }

    #[test]
    fn laenge_zaehlt_zeichen_nicht_bytes() {
        assert_eq!(inhalt_laenge(""), "<0 Zeichen>");
        assert_eq!(inhalt_laenge("äöü"), "<3 Zeichen>");
    }
}
