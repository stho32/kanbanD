use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Person};
use crate::uhr;

impl Kanban {
    /// Setzt `archived` auf heute und beendet laufende Timer; Datei und Board-Zeile bleiben.
    pub fn archivieren(&self, wer: &Person, nr: u32) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| {
            if a.archiviert.is_some() {
                return Err(Fehler::Konflikt(format!("#{nr} ist schon archiviert")));
            }
            let jetzt = uhr::jetzt();
            let mut gestoppt = 0;
            for z in a.zeiten.iter_mut().filter(|z| z.ende.is_none()) {
                z.ende = Some(jetzt.clone());
                gestoppt += 1;
            }
            a.archiviert = Some(uhr::heute());
            Ok(Some(match gestoppt {
                0 => format!("#{nr} archiviert"),
                n => format!("#{nr} archiviert, {n} Timer gestoppt"),
            }))
        })
    }

    pub fn zurueckholen(&self, wer: &Person, nr: u32) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| {
            if a.archiviert.take().is_none() {
                return Err(Fehler::Konflikt(format!("#{nr} ist nicht archiviert")));
            }
            Ok(Some(format!("#{nr} zurückgeholt")))
        })
    }
}

impl Kanban {
    /// Archiviert bzw. holt mehrere Aufgaben in einem Commit zurück; eine unbekannte Nummer ändert nichts.
    pub fn mehrere_archivieren(&self, wer: &Person, nummern: &[u32], archivieren: bool) -> Result<Vec<u32>, Fehler> {
        if nummern.is_empty() {
            return Err(Fehler::Ungueltig("Keine Aufgabe angegeben".into()));
        }
        let _sperre = self.gesperrt();
        let mut geaendert = vec![];
        let mut dateien = vec![];
        let jetzt = uhr::jetzt();
        for nr in nummern {
            let mut a = self.ordner().aufgabe(*nr)?;
            if a.archiviert.is_some() == archivieren {
                continue;
            }
            if archivieren {
                for z in a.zeiten.iter_mut().filter(|z| z.ende.is_none()) {
                    z.ende = Some(jetzt.clone());
                }
                a.archiviert = Some(uhr::heute());
            } else {
                a.archiviert = None;
            }
            geaendert.push(*nr);
            dateien.push((format!("{}/{}", crate::format::aufgabe::ORDNER, a.datei), crate::format::aufgabe::schreiben(&a)));
        }
        if !geaendert.is_empty() {
            let liste = geaendert.iter().map(|n| format!("#{n}")).collect::<Vec<_>>().join(", ");
            let tat = if archivieren { "archiviert" } else { "zurückgeholt" };
            let nachricht = match geaendert.len() {
                1 => format!("{liste} {tat}"),
                n => format!("{liste} {tat} ({n} Aufgaben)"),
            };
            self.aktion(wer, &nachricht, &dateien)?;
        }
        Ok(geaendert)
    }
}
