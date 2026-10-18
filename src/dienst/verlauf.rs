use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::board;
use crate::git;
use crate::modell::Board;
use crate::verlauf::{Bewegungen, Verlauf, bewegungen, verlauf};

impl Kanban {
    /// Verlauf eines Boards aus den committeten Ständen seiner Datei, dazu der aktuelle Stand, falls er abweicht.
    pub fn verlauf(&self, slug: &str) -> Result<Verlauf, Fehler> {
        let (staende, jetzt) = self.staende(slug)?;
        Ok(verlauf(&staende, jetzt.date()))
    }

    /// Spaltenwechsel je Aufgabe aus denselben Ständen; Spalten in heutiger Reihenfolge.
    pub fn bewegungen(&self, slug: &str) -> Result<Bewegungen, Fehler> {
        let (staende, jetzt) = self.staende(slug)?;
        let spalten = staende.last().map(|(_, b)| b.spalten.iter().map(|s| s.name.clone()).collect()).unwrap_or_default();
        Ok(bewegungen(&staende, spalten, jetzt))
    }

    fn staende(&self, slug: &str) -> Result<(Vec<(chrono::NaiveDateTime, Board)>, chrono::NaiveDateTime), Fehler> {
        let aktuell = self.ordner().board(slug)?;
        let rel = board_pfad(slug);
        let mut staende: Vec<_> = git::staende(self.ordner().wurzel(), &rel)?.into_iter().filter_map(|(zp, text)| board::lesen(slug, &text).ok().map(|b| (zp, b))).collect();
        // Nach Zeitpunkt ordnen: die Commit-Folge muss nicht der Datumsfolge entsprechen (Rebase, gesetzte Daten).
        staende.sort_by_key(|(zp, _)| *zp);
        let jetzt = chrono::Local::now().naive_local();
        if staende.last().map(|(_, b)| b != &aktuell).unwrap_or(true) {
            staende.push((jetzt, aktuell));
        }
        Ok((staende, jetzt))
    }
}
