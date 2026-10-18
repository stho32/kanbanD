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
