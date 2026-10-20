use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Person, Zeiteintrag};
use crate::uhr;
use std::time::{Duration, Instant};

/// Kürzere Läufe sind Fehlklicks und werden beim Stoppen nicht als Zeitblock festgehalten (R00068).
const MINDESTLAUF: Duration = Duration::from_secs(20);

/// Unbekannte Laufzeit (Start nicht über diesen Server) gilt nie als zu kurz.
fn zu_kurz(gelaufen: Option<Duration>) -> bool {
    gelaufen.is_some_and(|d| d < MINDESTLAUF)
}

impl Kanban {
    /// Startet den Timer der Person: eine laufende Zeile (Ende `...`) im Block `kanbanD-time`.
    pub fn timer_starten(&self, wer: &Person, nr: u32) -> Result<Aufgabe, Fehler> {
        let beginn = Instant::now();
        let a = self.aufgabe_schreiben(wer, nr, |a| {
            if a.zeiten.iter().any(|z| z.wer == wer.kuerzel && z.ende.is_none()) {
                return Err(Fehler::Konflikt(format!("Der Timer von {} läuft an #{nr} bereits", wer.name)));
            }
            a.zeiten.push(Zeiteintrag { wer: wer.kuerzel.clone(), beginn: uhr::jetzt(), ende: None });
            Ok(Some(format!("#{nr} Timer von {} gestartet", wer.name)))
        })?;
        self.timer_beginn.lock().unwrap_or_else(|e| e.into_inner()).insert((nr, wer.kuerzel.clone()), beginn);
        Ok(a)
    }

    /// Stoppt den laufenden Timer von `fuer` (ohne Angabe: von `wer`); `wer` ist Autor des Commits.
    pub fn timer_stoppen(&self, wer: &Person, nr: u32, fuer: Option<&str>) -> Result<Aufgabe, Fehler> {
        let kuerzel = fuer.unwrap_or(&wer.kuerzel).to_string();
        let name = self.ordner().einstellungen()?.and_then(|e| e.person(&kuerzel).map(|p| p.name.clone())).unwrap_or_else(|| kuerzel.clone());
        let gelaufen = self.timer_beginn.lock().unwrap_or_else(|e| e.into_inner()).remove(&(nr, kuerzel.clone())).map(|b| b.elapsed());
        self.aufgabe_schreiben(wer, nr, |a| {
            let i = a
                .zeiten
                .iter()
                .position(|z| z.wer == kuerzel && z.ende.is_none())
                .ok_or_else(|| Fehler::Konflikt(format!("An #{nr} läuft kein Timer von {name}")))?;
            if zu_kurz(gelaufen) {
                a.zeiten.remove(i);
                return Ok(Some(format!("#{nr} Timer von {name} verworfen (unter 20 s)")));
            }
            let z = &mut a.zeiten[i];
            let ende = uhr::jetzt();
            let minuten = uhr::minuten(&z.beginn, &ende).unwrap_or(0);
            z.ende = Some(ende);
            Ok(Some(format!("#{nr} Timer von {name} gestoppt ({})", uhr::hm(minuten))))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unter_zwanzig_sekunden_ist_zu_kurz() {
        assert!(zu_kurz(Some(Duration::from_secs(19))));
        assert!(!zu_kurz(Some(Duration::from_secs(20))));
        assert!(!zu_kurz(None), "unbekannte Laufzeit wird festgehalten");
    }
}
