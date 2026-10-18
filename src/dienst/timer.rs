use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Person, Zeiteintrag};
use crate::uhr;

impl Kanban {
    /// Startet den Timer der Person: eine laufende Zeile (Ende `...`) im Block `kanbanD-time`.
    pub fn timer_starten(&self, wer: &Person, nr: u32) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| {
            if a.zeiten.iter().any(|z| z.wer == wer.kuerzel && z.ende.is_none()) {
                return Err(Fehler::Konflikt(format!("Der Timer von {} läuft an #{nr} bereits", wer.name)));
            }
            a.zeiten.push(Zeiteintrag { wer: wer.kuerzel.clone(), beginn: uhr::jetzt(), ende: None });
            Ok(Some(format!("#{nr} Timer von {} gestartet", wer.name)))
        })
    }

    /// Stoppt den laufenden Timer von `fuer` (ohne Angabe: von `wer`); `wer` ist Autor des Commits.
    pub fn timer_stoppen(&self, wer: &Person, nr: u32, fuer: Option<&str>) -> Result<Aufgabe, Fehler> {
        let kuerzel = fuer.unwrap_or(&wer.kuerzel).to_string();
        let name = self.ordner().einstellungen()?.and_then(|e| e.person(&kuerzel).map(|p| p.name.clone())).unwrap_or_else(|| kuerzel.clone());
        self.aufgabe_schreiben(wer, nr, |a| {
            let z = a
                .zeiten
                .iter_mut()
                .find(|z| z.wer == kuerzel && z.ende.is_none())
                .ok_or_else(|| Fehler::Konflikt(format!("An #{nr} läuft kein Timer von {name}")))?;
            let ende = uhr::jetzt();
            let minuten = uhr::minuten(&z.beginn, &ende).unwrap_or(0);
            z.ende = Some(ende);
            Ok(Some(format!("#{nr} Timer von {name} gestoppt ({})", uhr::hm(minuten))))
        })
    }
}
