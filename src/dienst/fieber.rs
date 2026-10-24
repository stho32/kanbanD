//! Projekt-Fever-Chart (R00078): Projektstart und Einstellungen am Board, Cache der Tage in `berichte/<slug>-fieber.md`.

use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::fieber::{self, Fieberabschnitt, Fiebertag};
use crate::modell::{Art, Fieber, Person, ist_datum};

/// Der Cache ist kein Werk einer Person: er wird unter diesem Autor committet, ohne Identität.
fn kanband() -> Person {
    Person { kuerzel: "kanbanD".into(), name: "kanbanD".into(), art: Art::Agent, aktiv: true }
}

fn tt_mm_jjjj(datum: &str) -> String {
    let t: Vec<&str> = datum.split('-').collect();
    format!("{}.{}.{}", t[2], t[1], t[0])
}

impl Kanban {
    /// Setzt oder entfernt den Projektstart; ohne Änderung kein Commit.
    pub fn start_setzen(&self, wer: &Person, slug: &str, start: Option<String>) -> Result<bool, Fehler> {
        let start = start.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        if let Some(s) = start.as_deref().filter(|s| !ist_datum(s)) {
            return Err(Fehler::Ungueltig(format!("Projektstart „{s}“ ist nicht JJJJ-MM-TT")));
        }
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        if b.start == start {
            return Ok(false);
        }
        let text = match &start {
            Some(s) => format!("Projektstart von „{}“: {}", b.titel, tt_mm_jjjj(s)),
            None => format!("Projektstart von „{}“ entfernt", b.titel),
        };
        b.start = start;
        self.aktion(wer, &text, &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok(true)
    }

    /// Ersetzt die Einstellungen des Fever Charts; ohne Änderung kein Commit.
    pub fn fieber_setzen(&self, wer: &Person, slug: &str, neu: Fieber) -> Result<bool, Fehler> {
        neu.pruefen().map_err(Fehler::Ungueltig)?;
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        if b.fieber == neu {
            return Ok(false);
        }
        let einheit = if neu.woche == 5 { "Arbeitstage" } else { "Kalendertage" };
        let puffer = neu.puffer.map(|p| format!("Puffer {p} {einheit}")).unwrap_or_else(|| "ohne Puffer".into());
        let text = format!("Fever Chart von „{}“ eingestellt: {puffer}, P{}", b.titel, neu.perzentil);
        b.fieber = neu;
        self.aktion(wer, &text, &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok(true)
    }

    /// Alle Abschnitte des Caches; ohne Datei keiner.
    pub fn fieber_cache(&self, slug: &str) -> Result<Vec<Fieberabschnitt>, Fehler> {
        self.ordner().board(slug)?;
        let rel = fieber::pfad(slug);
        match self.ordner().lies(&rel)? {
            None => Ok(vec![]),
            Some(t) => fieber::lesen(&t).map_err(|e| Fehler::Defekt(format!("{rel}: {e} — „Cache verwerfen“ legt ihn neu an"))),
        }
    }

    /// Ergänzt die Tage vor `heute`, die im Abschnitt fehlen; vorhandene bleiben. Liefert die Zahl der neuen Tage.
    pub fn fieber_ergaenzen(&self, slug: &str, schluessel: &str, tage: Vec<Fiebertag>, heute: &str) -> Result<usize, Fehler> {
        fieber::schluessel_pruefen(schluessel).map_err(Fehler::Ungueltig)?;
        for t in &tage {
            t.pruefen().map_err(Fehler::Ungueltig)?;
            if t.datum.as_str() >= heute {
                return Err(Fehler::Ungueltig(format!("{}: nur Tage vor heute kommen in den Cache — der heutige ändert sich noch", t.datum)));
            }
        }
        let _sperre = self.gesperrt();
        let b = self.ordner().board(slug)?;
        let mut abschnitte = self.fieber_cache(slug)?;
        let i = match abschnitte.iter().position(|a| a.schluessel == schluessel) {
            Some(i) => i,
            None => {
                abschnitte.push(Fieberabschnitt { schluessel: schluessel.trim().to_string(), tage: vec![] });
                abschnitte.len() - 1
            }
        };
        let a = &mut abschnitte[i];
        let mut neu = 0;
        for t in tage {
            if !a.tage.iter().any(|x| x.datum == t.datum) {
                a.tage.push(t);
                neu += 1;
            }
        }
        if neu == 0 {
            return Ok(0);
        }
        a.tage.sort_by(|x, y| x.datum.cmp(&y.datum));
        let text = format!("Fever Chart „{}“: {neu} {} ergänzt", b.titel, if neu == 1 { "Tag" } else { "Tage" });
        self.aktion(&kanband(), &text, &[(fieber::pfad(slug), fieber::schreiben(&b.titel, &abschnitte))])?;
        Ok(neu)
    }

    /// Verwirft den ganzen Cache; ohne Datei kein Commit.
    pub fn fieber_verwerfen(&self, slug: &str) -> Result<bool, Fehler> {
        let _sperre = self.gesperrt();
        let b = self.ordner().board(slug)?;
        let rel = fieber::pfad(slug);
        if !self.ordner().existiert(&rel) {
            return Ok(false);
        }
        self.eigene_merken(&rel);
        std::fs::remove_file(self.ordner().wurzel().join(&rel))?;
        self.committen(&kanband(), &format!("Fever Chart „{}“: Cache verworfen", b.titel), &[rel])?;
        Ok(true)
    }
}
