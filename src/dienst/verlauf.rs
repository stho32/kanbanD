use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::board;
use crate::git;
use crate::modell::Board;
use crate::verlauf::{Bewegungen, Phasenkarte, Verlauf, bewegungen, verlauf};

impl Kanban {
    /// Verlauf eines Boards aus den committeten Ständen seiner Datei, dazu der aktuelle Stand, falls er abweicht.
    pub fn verlauf(&self, slug: &str) -> Result<Verlauf, Fehler> {
        let (staende, jetzt) = self.staende(slug)?;
        Ok(verlauf(&staende, jetzt.date()))
    }

    /// Spaltenwechsel je Aufgabe aus denselben Ständen; Spalten in heutiger Reihenfolge. Bei einem gebundenen Board dazu
    /// Phasenfolge und Spaltenphasen von heute und je Aufgabe Labels und entfallende Phasen aus ihrer Datei.
    pub fn bewegungen(&self, slug: &str) -> Result<Bewegungen, Fehler> {
        let (staende, jetzt) = self.staende(slug)?;
        let spalten = staende.last().map(|(_, b)| b.spalten.iter().map(|s| s.name.clone()).collect()).unwrap_or_default();
        let mut bew = bewegungen(&staende, spalten, jetzt);
        let (aufgaben, _) = self.ordner().aufgaben()?;
        for b in &mut bew.aufgaben {
            if let Some(a) = aufgaben.iter().find(|a| a.nummer == b.nummer) {
                b.labels = a.labels.clone();
                b.uebersprungen = a.phasen.uebersprungen.clone();
            }
        }
        if let Some((_, heute)) = staende.last() {
            bew.phasen = self.phasenstand(heute).map(|s| Phasenkarte {
                anwendung: s.anwendung,
                folge: s.folge,
                spaltenphasen: heute.spalten.iter().filter_map(|sp| sp.phase.clone().map(|p| (sp.name.clone(), p))).collect(),
            });
        }
        Ok(bew)
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
