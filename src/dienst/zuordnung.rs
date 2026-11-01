use super::Kanban;
use super::zugregeln::entnahme_pruefen;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::{Bewegfehler, Person};

impl Kanban {
    /// Legt eine vorhandene Aufgabe unten in eine Spalte des Boards; die Aufgabe selbst bleibt unberührt.
    /// Agent über der Grenze → 409; ein Mensch wird durchgelassen, ohne Warnung (R00096).
    pub fn auf_board_legen(&self, wer: &Person, slug: &str, nummer: u32, spalte: Option<&str>) -> Result<String, Fehler> {
        let _sperre = self.gesperrt();
        let a = self.ordner().aufgabe(nummer)?;
        let mut b = self.ordner().board(slug)?;
        let vorher = b.clone();
        let name = b.aufnehmen(nummer, spalte).map_err(|f| match f {
            Bewegfehler::SchonAufDemBoard => Fehler::Konflikt(format!("#{nummer} liegt schon auf „{}“", b.titel)),
            _ => Fehler::Ungueltig(format!("Spalte „{}“ gibt es auf „{}“ nicht", spalte.unwrap_or("—"), b.titel)),
        })?;
        self.grenzen_pruefen(wer, &vorher, &b)?;
        self.aktion(wer, &format!("#{nummer} auf „{}“ gelegt ({name})", b.titel), &[(board_pfad(&b.slug), self.board_text(&b, Some(&a))?)])?;
        Ok(name)
    }

    /// Legt mehrere Aufgaben in einem Commit auf ein Board; schon liegende bleiben unberührt (R00065).
    /// Die Grenze zählt nach allen gelegten; ein Agent darüber legt keine (R00096).
    pub fn mehrere_auf_board_legen(&self, wer: &Person, slug: &str, nummern: &[u32], spalte: Option<&str>) -> Result<Vec<u32>, Fehler> {
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        if let Some(s) = spalte.filter(|s| !b.spalten.iter().any(|x| x.name == *s)) {
            return Err(Fehler::Ungueltig(format!("Spalte „{s}“ gibt es auf „{}“ nicht", b.titel)));
        }
        let vorher = b.clone();
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
            self.grenzen_pruefen(wer, &vorher, &b)?;
            let liste = gelegt.iter().map(|n| format!("#{n}")).collect::<Vec<_>>().join(", ");
            self.aktion(wer, &format!("{liste} auf „{}“ gelegt ({name})", b.titel), &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        }
        Ok(gelegt)
    }

    /// Nimmt die Karte vom Board; ein Agent nicht aus einer Spalte, die dem Menschen gehört (403, R00097).
    pub fn von_board_nehmen(&self, wer: &Person, slug: &str, nummer: u32) -> Result<(), Fehler> {
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        entnahme_pruefen(wer.art, &b, &[nummer])?;
        if !b.abnehmen(nummer) {
            return Err(Fehler::NichtGefunden(format!("#{nummer} liegt nicht auf „{}“", b.titel)));
        }
        self.aktion(wer, &format!("#{nummer} von „{}“ genommen", b.titel), &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok(())
    }
}
