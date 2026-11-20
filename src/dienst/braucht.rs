//! `Braucht` zwischen Karten (R00214, ADR-0035): das abgeleitete Lesefeld `braucht` an den Lesewegen der API.

use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Board, abhaengigkeiten, braucht_nummern};
use std::collections::BTreeMap;

impl Kanban {
    /// `braucht` für eine einzelne Aufgabe (`GET /api/aufgaben/{nr}`): liest nur die Boards und die gebrauchten
    /// Aufgaben, nicht den ganzen Ordner; ohne Abhängigkeit liest es nichts.
    pub fn braucht_eintragen(&self, a: &mut Aufgabe) -> Result<(), Fehler> {
        let nummern = braucht_nummern(&a.labels);
        if nummern.is_empty() {
            a.braucht = Some(vec![]);
            return Ok(());
        }
        let mut gebraucht: BTreeMap<u32, Aufgabe> = BTreeMap::new();
        for n in nummern {
            if let Some(g) = self.lesbare_aufgabe(n)? {
                gebraucht.insert(n, g);
            }
        }
        a.braucht = Some(abhaengigkeiten(&a.labels, |n| gebraucht.get(&n), &self.lesbare_boards()?));
        Ok(())
    }

    /// `braucht` für jede Aufgabe einer Liste, die alle Aufgaben des Ordners enthält (`GET /api/aufgaben` vor dem Filter).
    pub fn braucht_eintragen_alle(&self, alle: &mut [Aufgabe]) -> Result<(), Fehler> {
        let boards = self.lesbare_boards()?;
        let je_nummer: BTreeMap<u32, &Aufgabe> = alle.iter().map(|a| (a.nummer, a)).collect();
        let felder: Vec<_> = alle.iter().map(|a| abhaengigkeiten(&a.labels, |n| je_nummer.get(&n).copied(), &boards)).collect();
        for (a, braucht) in alle.iter_mut().zip(felder) {
            a.braucht = Some(braucht);
        }
        Ok(())
    }

    /// Die Aufgabe zur Nummer, wenn es eine lesbare Datei gibt; fehlt sie oder ist sie defekt, `None` (titel null).
    fn lesbare_aufgabe(&self, nummer: u32) -> Result<Option<Aufgabe>, Fehler> {
        match self.ordner().aufgabe(nummer) {
            Ok(a) => Ok(Some(a)),
            Err(Fehler::NichtGefunden(_) | Fehler::Defekt(_)) => Ok(None),
            Err(f) => Err(f),
        }
    }

    /// Die lesbaren Boards des Ordners; eine defekte Board-Datei trägt nichts zu „erledigt“ bei.
    fn lesbare_boards(&self) -> Result<Vec<Board>, Fehler> {
        Ok(self.ordner().boards()?.0)
    }
}
