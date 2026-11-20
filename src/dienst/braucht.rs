//! `Braucht` zwischen Karten (R00214, ADR-0035): das abgeleitete Lesefeld `braucht` an den Lesewegen der API und die
//! Prüfung neuer `braucht:`-Labels an der Tür der Schreibwege.

use super::Kanban;
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::{Aufgabe, Board, abhaengigkeiten, an_der_tuer, braucht_nummern, kreis_meldung, kreis_suchen, neue_braucht_labels};
use std::collections::{BTreeMap, BTreeSet};

/// Setzt einer 400 den Vorsatz des Aufrufers voran (`#7: `, `„Titel“: `) — andere Fehler bleiben, wie sie sind.
pub(super) fn vorsatz(f: Fehler, vor: &str) -> Fehler {
    match f {
        Fehler::Ungueltig(m) => Fehler::Ungueltig(format!("{vor}{m}")),
        anders => anders,
    }
}

/// Die Tür eines Schreibaufrufs für neue `braucht:`-Labels (ADR-0035 Punkt 2), unter der Sperre des Aufrufers.
/// Den Ordner liest sie erst beim ersten neuen `braucht:`-Label; ohne ein solches bleibt der Weg ohne Zusatzzugriff.
pub(super) struct Tuer<'k> {
    kanban: &'k Kanban,
    /// Nummern mit Aufgabendatei im Ordner (lesbar, archiviert oder defekt), gelesen beim ersten neuen Label
    vorhanden: Option<BTreeSet<u32>>,
    /// gedeutete Nummern je lesbarer Aufgabe vor dem Aufruf — der Bestand für die Kreisprüfung
    kanten: BTreeMap<u32, Vec<u32>>,
    /// Labels nach dem Schreiben je geprüfter Aufgabe — auch neu angelegter, die es danach gibt
    nachher: BTreeMap<u32, Vec<String>>,
    /// neue Kanten `a → b` in Prüfreihenfolge
    neue: Vec<(u32, u32)>,
}

impl<'k> Tuer<'k> {
    pub(super) fn neu(kanban: &'k Kanban) -> Tuer<'k> {
        Tuer { kanban, vorhanden: None, kanten: BTreeMap::new(), nachher: BTreeMap::new(), neue: vec![] }
    }

    /// Prüft die Labels der Aufgabe `nummer` nach ihrer Änderung: nur neu hinzukommende `braucht:`-Labels, der Reihe nach
    /// Form, Selbstbezug, unbekannte Nummer (400 ohne Vorsatz; den setzt der Aufrufer wie bei seinen übrigen Meldungen).
    pub(super) fn pruefen(&mut self, nummer: u32, vorher: &[String], nachher: &[String]) -> Result<(), Fehler> {
        self.nachher.insert(nummer, nachher.to_vec());
        let neue = neue_braucht_labels(vorher, nachher);
        if neue.is_empty() {
            return Ok(());
        }
        self.ordner_lesen()?;
        let vorhanden = self.vorhanden.as_ref().expect("eben gelesen");
        let ziele = an_der_tuer(nummer, &neue, |n| vorhanden.contains(&n) || self.nachher.contains_key(&n)).map_err(Fehler::Ungueltig)?;
        self.neue.extend(ziele.into_iter().map(|z| (nummer, z)));
        Ok(())
    }

    /// Der erste Kreis, den eine neue Kante im Stand nach allen geprüften Änderungen schließt: die Aufgabe, deren Label
    /// ihn ergäbe, und die Meldung (400 ohne Vorsatz). Kreise im Bestand ohne neue Kante stören nicht.
    pub(super) fn kreis(&self) -> Option<(u32, String)> {
        if self.neue.is_empty() {
            return None;
        }
        let mut kanten = self.kanten.clone();
        kanten.extend(self.nachher.iter().map(|(n, labels)| (*n, braucht_nummern(labels))));
        kreis_suchen(&kanten, &self.neue).map(|(a, b, kreis)| (a, kreis_meldung(b, &kreis)))
    }

    fn ordner_lesen(&mut self) -> Result<(), Fehler> {
        if self.vorhanden.is_none() {
            let (gut, defekt) = self.kanban.ordner().aufgaben()?;
            let defekte = defekt.iter().filter_map(|d| d.pfad.rsplit('/').next().and_then(aufgabe::nummer_aus_dateiname));
            self.vorhanden = Some(gut.iter().map(|a| a.nummer).chain(defekte).collect());
            self.kanten = gut.iter().map(|a| (a.nummer, braucht_nummern(&a.labels))).collect();
        }
        Ok(())
    }
}

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
