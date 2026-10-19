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

    /// Legt mehrere Aufgaben in einem Commit auf ein Board; schon liegende bleiben unberührt (R00065).
    pub fn mehrere_auf_board_legen(&self, wer: &Person, slug: &str, nummern: &[u32], spalte: Option<&str>) -> Result<Vec<u32>, Fehler> {
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        if let Some(s) = spalte.filter(|s| !b.spalten.iter().any(|x| x.name == *s)) {
            return Err(Fehler::Ungueltig(format!("Spalte „{s}“ gibt es auf „{}“ nicht", b.titel)));
        }
        let mut gelegt = vec![];
        let mut name = String::new();
        for nr in nummern {
            self.ordner().aufgabe(*nr)?;
            match b.aufnehmen(*nr, spalte) {
                Ok(n) => {
                    name = n;
                    gelegt.push(*nr);
                }
                Err(Bewegfehler::SchonAufDemBoard) => {}
                Err(_) => return Err(Fehler::Ungueltig(format!("Spalte „{}“ gibt es auf „{}“ nicht", spalte.unwrap_or("—"), b.titel))),
            }
        }
        if !gelegt.is_empty() {
            let liste = gelegt.iter().map(|n| format!("#{n}")).collect::<Vec<_>>().join(", ");
            self.aktion(wer, &format!("{liste} auf „{}“ gelegt ({name})", b.titel), &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        }
        Ok(gelegt)
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
