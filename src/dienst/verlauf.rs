use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::board;
use crate::git;
use crate::verlauf::{Verlauf, verlauf};

impl Kanban {
    /// Verlauf eines Boards aus den committeten Ständen seiner Datei, dazu der aktuelle Stand, falls er abweicht.
    pub fn verlauf(&self, slug: &str) -> Result<Verlauf, Fehler> {
        let aktuell = self.ordner().board(slug)?;
        let rel = board_pfad(slug);
        let mut staende: Vec<_> = git::staende(self.ordner().wurzel(), &rel)?.into_iter().filter_map(|(zp, text)| board::lesen(slug, &text).ok().map(|b| (zp, b))).collect();
        let jetzt = chrono::Local::now().naive_local();
        if staende.last().map(|(_, b)| b != &aktuell).unwrap_or(true) {
            staende.push((jetzt, aktuell));
        }
        Ok(verlauf(&staende, jetzt.date()))
    }
}
