use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::{Bewegfehler, Person};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Bewegung {
    pub nummer: u32,
    pub spalte: String,
    pub index: Option<usize>,
}

impl Kanban {
    /// Ändert nur die Board-Datei. Ohne Änderung kein Commit.
    pub fn bewegen(&self, wer: &Person, slug: &str, bw: &Bewegung) -> Result<bool, Fehler> {
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        let von = b.spalte_von(bw.nummer).map(|s| s.name.clone());
        let geaendert = b.bewegen(bw.nummer, &bw.spalte, bw.index).map_err(|f| match f {
            Bewegfehler::NichtAufDemBoard => Fehler::NichtGefunden(format!("#{} liegt nicht auf „{}“", bw.nummer, b.titel)),
            Bewegfehler::SpalteUnbekannt => Fehler::Ungueltig(format!("Spalte „{}“ gibt es auf „{}“ nicht", bw.spalte, b.titel)),
        })?;
        if !geaendert {
            return Ok(false);
        }
        let nachricht = if von.as_deref() == Some(bw.spalte.as_str()) {
            format!("#{} in „{}“ umsortiert ({})", bw.nummer, bw.spalte, b.titel)
        } else {
            format!("#{} nach „{}“ ({})", bw.nummer, bw.spalte, b.titel)
        };
        self.aktion(wer, &nachricht, &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok(true)
    }
}
