use super::Kanban;
use crate::fehler::Fehler;
use crate::format::aufgabe::zeitpunkt;
use crate::modell::{Aufgabe, Person, Zeiteintrag};
use crate::uhr;
use serde::Deserialize;

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Zeitkorrektur {
    pub beginn: Option<String>,
    pub ende: Option<String>,
}

fn name(k: &Kanban, kuerzel: &str) -> String {
    k.ordner().einstellungen().ok().flatten().and_then(|e| e.person(kuerzel).map(|p| p.name.clone())).unwrap_or_else(|| kuerzel.into())
}

fn eintrag(a: &mut Aufgabe, i: usize) -> Result<&mut Zeiteintrag, Fehler> {
    let nr = a.nummer;
    a.zeiten.get_mut(i).ok_or_else(|| Fehler::NichtGefunden(format!("#{nr} hat keinen Zeiteintrag an Position {i}")))
}

impl Kanban {
    /// Ein Eintrag der handelnden Person, der jetzt endet und um die Dauer früher beginnt.
    pub fn zeit_nachtragen(&self, wer: &Person, nr: u32, dauer: &str) -> Result<Aufgabe, Fehler> {
        let minuten = uhr::dauer_lesen(dauer).ok_or_else(|| Fehler::Ungueltig(format!("Dauer „{dauer}“: z. B. 0:45, 1,5 oder 90 min")))?;
        let ende = uhr::jetzt();
        let beginn = uhr::verschieben(&ende, -minuten).expect("jetzt ist lesbar");
        self.aufgabe_schreiben(wer, nr, |a| {
            a.zeiten.push(Zeiteintrag { wer: wer.kuerzel.clone(), beginn, ende: Some(ende) });
            Ok(Some(format!("#{nr} Zeit nachgetragen: {} ({})", uhr::hm(minuten), wer.name)))
        })
    }

    pub fn zeit_korrigieren(&self, wer: &Person, nr: u32, i: usize, k: &Zeitkorrektur) -> Result<Aufgabe, Fehler> {
        let lesen = |z: &Option<String>| -> Result<Option<String>, Fehler> {
            z.as_deref().map(|s| zeitpunkt(s).ok_or_else(|| Fehler::Ungueltig(format!("Zeitpunkt „{s}“: erwartet JJJJ-MM-TT HH:MM")))).transpose()
        };
        let (beginn, ende) = (lesen(&k.beginn)?, lesen(&k.ende)?);
        self.aufgabe_schreiben(wer, nr, |a| {
            let z = eintrag(a, i)?;
            if ende.is_some() && z.ende.is_none() {
                return Err(Fehler::Ungueltig("Ein laufender Eintrag bekommt sein Ende beim Stoppen".into()));
            }
            let vorher = z.clone();
            if let Some(b) = beginn {
                z.beginn = b;
            }
            if let Some(e) = ende {
                z.ende = Some(e);
            }
            if let Some(e) = &z.ende
                && e < &z.beginn
            {
                return Err(Fehler::Ungueltig("Das Ende liegt vor dem Beginn".into()));
            }
            Ok((*z != vorher).then(|| format!("#{nr} Zeit korrigiert ({})", name(self, &z.wer))))
        })
    }

    pub fn zeit_loeschen(&self, wer: &Person, nr: u32, i: usize) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| {
            let z = eintrag(a, i)?.clone();
            let Some(ende) = &z.ende else {
                return Err(Fehler::Konflikt("Der Eintrag läuft noch — erst stoppen".into()));
            };
            a.zeiten.remove(i);
            Ok(Some(format!("#{nr} Zeit gelöscht ({}, {})", name(self, &z.wer), uhr::hm(uhr::minuten(&z.beginn, ende).unwrap_or(0)))))
        })
    }
}
