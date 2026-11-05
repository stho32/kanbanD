//! Befund erledigt sich (R00099, ADR-0005): ein Sensor meldet über seinen Schlüssel, dass er einen Befund nicht mehr
//! findet. Suche, Prüfung und Schreiben laufen unter einer Sperre und enden in höchstens einem Commit.

use crate::fehler::Fehler;
use crate::modell::{Einstellungen, Fremdschluessel, signal_unbekannt};

/// Eingabe von `POST /api/aufgaben/erledigen`; fehlende Felder gelten als leer und werden abgewiesen.
#[derive(Debug, Clone, Default, serde::Deserialize, utoipa::ToSchema)]
pub struct Erledigung {
    /// Schlüssel des Befunds (1–200 Zeichen, ohne Zeilenumbruch), nur gelesen
    #[serde(default)]
    pub key: String,
    /// Slug des Boards, auf dem die Karte liegt
    #[serde(default)]
    pub board: String,
    /// Begründung, 1–2000 Zeichen nach dem Trimmen, Zeilenumbruch erlaubt
    #[serde(default)]
    pub text: String,
    /// Schlüssel eines in kanbanD.md eingerichteten Signals — immer geprüft, gesetzt nur beim Melden
    #[serde(default)]
    pub signal: String,
}

/// Eine Erledigung, deren Eingaben Schritt 0 bestanden haben.
#[derive(Debug, PartialEq, Eq)]
pub(super) struct GepruefteErledigung {
    pub schluessel: Fremdschluessel,
    pub board: String,
    pub text: String,
    pub signal: String,
}

const TEXT_HOECHSTENS: usize = 2000;

impl Erledigung {
    /// Schritt 0: alle Eingaben vor jeder Suche (400 vor 404 und 409).
    pub(super) fn pruefen(&self, e: &Einstellungen) -> Result<GepruefteErledigung, Fehler> {
        let schluessel = Fremdschluessel::pruefen(&self.key).map_err(Fehler::Ungueltig)?;
        let text = self.text.trim().replace("\r\n", "\n");
        if !(1..=TEXT_HOECHSTENS).contains(&text.chars().count()) {
            return Err(Fehler::Ungueltig(format!("Text: 1–{TEXT_HOECHSTENS} Zeichen")));
        }
        if e.signal(&self.signal).is_none() {
            return Err(Fehler::Ungueltig(signal_unbekannt(&self.signal)));
        }
        let board = self.board.trim();
        if board.is_empty() {
            return Err(Fehler::Ungueltig("Board fehlt".into()));
        }
        Ok(GepruefteErledigung { schluessel, board: board.to_string(), text, signal: self.signal.clone() })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::Signal;

    fn einstellungen() -> Einstellungen {
        let mut e = Einstellungen::default();
        e.signale.push(Signal { schluessel: "behoben".into(), bezeichnung: "Befund nicht mehr gefunden".into(), farbe: "green".into() });
        e
    }

    fn erledigung(text: &str) -> Erledigung {
        Erledigung { key: "k1".into(), board: "fabrik".into(), text: text.into(), signal: "behoben".into() }
    }

    fn ungueltig(r: Result<GepruefteErledigung, Fehler>) -> String {
        match r {
            Err(Fehler::Ungueltig(m)) => m,
            anders => panic!("400 erwartet, war {anders:?}"),
        }
    }

    // R00099 B0331: Text 1–2000 Zeichen nach dem Trimmen, Zeilenumbruch erlaubt
    #[test]
    fn text_grenzwerte() {
        let g = erledigung(&"x".repeat(2000)).pruefen(&einstellungen()).unwrap();
        assert_eq!(g.text.chars().count(), 2000);
        assert_eq!(ungueltig(erledigung(&"x".repeat(2001)).pruefen(&einstellungen())), "Text: 1–2000 Zeichen");
        for leer in ["", "   ", "\n\t "] {
            assert_eq!(ungueltig(erledigung(leer).pruefen(&einstellungen())), "Text: 1–2000 Zeichen", "{leer:?}");
        }
        let g = erledigung("  zwei\r\nZeilen ").pruefen(&einstellungen()).unwrap();
        assert_eq!(g.text, "zwei\nZeilen");
        assert_eq!(erledigung(&format!(" {} ", "ä".repeat(2000))).pruefen(&einstellungen()).unwrap().text.chars().count(), 2000, "Zeichen, nicht Bytes");
    }

    // R00099 B0331: Signal muss eingerichtet sein, auch wenn es nicht gesetzt würde
    #[test]
    fn signal_eingerichtet() {
        let mut e = erledigung("weg");
        assert_eq!(e.pruefen(&einstellungen()).unwrap().signal, "behoben");
        e.signal = "gibtsnicht".into();
        assert_eq!(ungueltig(e.pruefen(&einstellungen())), "Signal „gibtsnicht“ steht nicht in kanbanD.md");
        e.signal = String::new();
        assert!(matches!(e.pruefen(&einstellungen()), Err(Fehler::Ungueltig(_))));
    }

    // R00099 B0331: key über Fremdschluessel::pruefen, board nicht leer; fehlende Felder sind leer
    #[test]
    fn schluessel_und_board() {
        let g = Erledigung { key: "  k1 ".into(), ..erledigung("weg") }.pruefen(&einstellungen()).unwrap();
        assert_eq!((g.schluessel.text(), g.board.as_str()), ("k1", "fabrik"));
        for key in ["", "   ", "a\nb"] {
            assert_eq!(ungueltig(Erledigung { key: key.into(), ..erledigung("weg") }.pruefen(&einstellungen())), "Schlüssel: 1–200 Zeichen ohne Zeilenumbruch");
        }
        for board in ["", "  "] {
            assert_eq!(ungueltig(Erledigung { board: board.into(), ..erledigung("weg") }.pruefen(&einstellungen())), "Board fehlt");
        }
        let fehlend: Erledigung = serde_json::from_str(r#"{"key": "k1", "text": "weg", "signal": "behoben"}"#).unwrap();
        assert_eq!(ungueltig(fehlend.pruefen(&einstellungen())), "Board fehlt");
    }
}
