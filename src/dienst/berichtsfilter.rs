//! Berichtsfilter am Board (R00081): für alle Berichte und alle, die das Board ansehen.

use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::{Berichtsfilter, Person};

impl Kanban {
    /// Ersetzt den Berichtsfilter; Listen ohne Doppelte. Ohne Änderung kein Commit.
    pub fn berichtsfilter_setzen(&self, wer: &Person, slug: &str, mut neu: Berichtsfilter) -> Result<bool, Fehler> {
        neu.pruefen().map_err(Fehler::Ungueltig)?;
        for l in [&mut neu.ohne_farben, &mut neu.ohne_spalten, &mut neu.personen, &mut neu.labels] {
            let mut gesehen = std::collections::HashSet::new();
            l.retain(|x| gesehen.insert(x.clone()));
        }
        if neu.zeitraum != "eigen" {
            neu.von.clear();
            neu.bis.clear();
        }
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        if b.berichtsfilter == neu {
            return Ok(false);
        }
        let text = format!("Berichtsfilter von „{}“ geändert", b.titel);
        b.berichtsfilter = neu;
        self.aktion(wer, &text, &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok(true)
    }
}
