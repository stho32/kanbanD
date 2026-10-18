use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::{Bewegfehler, Person};

impl Kanban {
    /// Legt eine vorhandene Aufgabe unten in eine Spalte des Boards; die Aufgabe selbst bleibt unberührt.
    pub fn auf_board_legen(&self, wer: &Person, slug: &str, nummer: u32, spalte: Option<&str>) -> Result<String, Fehler> {
        let _sperre = self.gesperrt();
        let a = self.ordner().aufgabe(nummer)?;
        let mut b = self.ordner().board(slug)?;
        let name = b.aufnehmen(nummer, spalte).map_err(|f| match f {
            Bewegfehler::SchonAufDemBoard => Fehler::Konflikt(format!("#{nummer} liegt schon auf „{}“", b.titel)),
            _ => Fehler::Ungueltig(format!("Spalte „{}“ gibt es auf „{}“ nicht", spalte.unwrap_or("—"), b.titel)),
        })?;
        self.aktion(wer, &format!("#{nummer} auf „{}“ gelegt ({name})", b.titel), &[(board_pfad(&b.slug), self.board_text(&b, Some(&a))?)])?;
        Ok(name)
    }

    pub fn von_board_nehmen(&self, wer: &Person, slug: &str, nummer: u32) -> Result<(), Fehler> {
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        if !b.abnehmen(nummer) {
            return Err(Fehler::NichtGefunden(format!("#{nummer} liegt nicht auf „{}“", b.titel)));
        }
        self.aktion(wer, &format!("#{nummer} von „{}“ genommen", b.titel), &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok(())
    }
}
