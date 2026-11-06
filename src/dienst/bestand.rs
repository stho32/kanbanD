//! Achsen des Berichts „Bestand nach Labels“ am Board (R00100): für alle, die das Board ansehen.

use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::{Bestandseinstellung, Person};

impl Kanban {
    /// Ersetzt die Achsen; Präfixe ohne Rand-Leerzeichen. Ohne Änderung kein Commit.
    pub fn bestand_setzen(&self, wer: &Person, slug: &str, neu: Bestandseinstellung) -> Result<bool, Fehler> {
        let neu = Bestandseinstellung { zeilen: neu.zeilen.trim().to_string(), spalten: neu.spalten.trim().to_string() };
        pruefen(&neu).map_err(Fehler::Ungueltig)?;
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        if b.bestand.as_ref() == Some(&neu) {
            return Ok(false);
        }
        let text = format!("Achsen des Bestands von „{}“: {} × {}", b.titel, neu.zeilen, neu.spalten);
        b.bestand = Some(neu);
        self.aktion(wer, &text, &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok(true)
    }
}

/// Ein Präfix ist nicht leer und ohne Doppelpunkt; Zeilen und Spalten sind auch ohne Groß/Klein verschieden.
fn pruefen(e: &Bestandseinstellung) -> Result<(), String> {
    for (achse, praefix) in [("zeilen", &e.zeilen), ("spalten", &e.spalten)] {
        if praefix.is_empty() {
            return Err(format!("{achse}: Präfix fehlt"));
        }
        if praefix.contains(':') {
            return Err(format!("{achse}: Präfix „{praefix}“ enthält einen Doppelpunkt"));
        }
    }
    if e.zeilen.to_lowercase() == e.spalten.to_lowercase() {
        return Err(format!("Zeilen und Spalten haben denselben Präfix „{}“", e.zeilen));
    }
    Ok(())
}
