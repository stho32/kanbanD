use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::{Person, SpaltenAenderung, Spaltenfehler};

impl Kanban {
    /// Schreibt die neue Spaltenfolge in die Board-Datei; ohne Änderung kein Commit.
    pub fn spalten_setzen(&self, wer: &Person, slug: &str, neu: &[SpaltenAenderung]) -> Result<bool, Fehler> {
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        let geaendert = b.spalten_setzen(neu).map_err(|f| match f {
            Spaltenfehler::NameLeer => Fehler::Ungueltig("Eine Spalte braucht einen Namen".into()),
            Spaltenfehler::NameDoppelt(n) => Fehler::Ungueltig(format!("Spalte „{n}“ ist doppelt")),
            Spaltenfehler::AltUnbekannt(n) => Fehler::Ungueltig(format!("Spalte „{n}“ gibt es nicht")),
            Spaltenfehler::AltDoppelt(n) => Fehler::Ungueltig(format!("Spalte „{n}“ wird zweimal übernommen")),
            Spaltenfehler::EnthaeltAufgaben(n, z) => Fehler::Konflikt(format!("Spalte „{n}“ enthält {z} Aufgaben — erst leeren")),
        })?;
        if geaendert {
            self.aktion(wer, &format!("Spalten von „{}“ geändert", b.titel), &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        }
        Ok(geaendert)
    }
}
