use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Person, Zeiteintrag};
use crate::uhr::{self, Zeitpunkt};
use serde::Deserialize;

/// Rumpf von `POST …/zeiten` (R00090): entweder `dauer` (endet jetzt) oder `beginn` und `ende`; `wer` bucht für eine andere Person.
#[derive(Debug, Clone, Default, Deserialize, utoipa::ToSchema)]
pub struct Zeitnachtrag {
    /// Dauer, z. B. 0:45, 1,5 (Stunden) oder 90 min — der Eintrag endet jetzt
    pub dauer: Option<String>,
    /// Zeitpunkt JJJJ-MM-TT HH:MM, optional mit ±HH:MM oder Z, auch ISO mit T; ohne Versatz Ortszeit
    pub beginn: Option<String>,
    /// wie beginn; nach dem Beginn, nicht in der Zukunft
    pub ende: Option<String>,
    /// Kürzel der Person, für die gebucht wird; ohne: die handelnde
    pub wer: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, utoipa::ToSchema)]
pub struct Zeitkorrektur {
    /// Zeitpunkt JJJJ-MM-TT HH:MM, optional mit ±HH:MM oder Z, auch ISO mit T; gespeichert in Ortszeit mit Versatz
    pub beginn: Option<String>,
    /// wie beginn; nur für einen beendeten Eintrag
    pub ende: Option<String>,
}

fn name(k: &Kanban, kuerzel: &str) -> String {
    k.ordner().einstellungen().ok().flatten().and_then(|e| e.person(kuerzel).map(|p| p.name.clone())).unwrap_or_else(|| kuerzel.into())
}

/// Der Eintrag zur Kennung `wer@beginn` (R00090) — unabhängig davon, wo er im Block steht.
fn eintrag<'a>(a: &'a mut Aufgabe, kennung: &str) -> Result<&'a mut Zeiteintrag, Fehler> {
    let nr = a.nummer;
    a.zeiten.iter_mut().find(|z| z.hat_kennung(kennung)).ok_or_else(|| Fehler::NichtGefunden(format!("#{nr} hat keinen Zeiteintrag {kennung}")))
}

impl Kanban {
    /// Ein abgeschlossener Eintrag: mit `dauer` endet er jetzt und beginnt um die Dauer früher, mit `beginn` und `ende`
    /// liegt er, wo angegeben (R00090). Gebucht für `n.wer` oder die handelnde Person; Autor des Commits bleibt sie.
    pub fn zeit_nachtragen(&self, wer: &Person, nr: u32, n: &Zeitnachtrag) -> Result<Aufgabe, Fehler> {
        let fuer = match n.wer.as_deref() {
            Some(k) => self.ordner().einstellungen()?.and_then(|e| e.person(k).cloned()).ok_or_else(|| Fehler::Ungueltig(format!("Person „{k}“ steht nicht in kanbanD.md")))?,
            None => wer.clone(),
        };
        let (beginn, ende) = match (&n.dauer, &n.beginn, &n.ende) {
            (Some(dauer), None, None) => {
                let minuten = uhr::dauer_lesen(dauer).ok_or_else(|| Fehler::Ungueltig(format!("Dauer „{dauer}“: z. B. 0:45, 1,5 oder 90 min")))?;
                let ende = uhr::jetzt();
                (uhr::verschieben(&ende, -minuten).expect("jetzt ist lesbar"), ende)
            }
            (None, Some(b), Some(e)) => block_lesen(b, e)?,
            _ => return Err(Fehler::Ungueltig("Entweder {dauer} oder {beginn, ende} angeben".into())),
        };
        let minuten = uhr::minuten(&beginn, &ende).unwrap_or(0);
        self.aufgabe_schreiben(wer, nr, |a| {
            let neu = Zeiteintrag { wer: fuer.kuerzel.clone(), beginn, ende: Some(ende) };
            if a.zeiten.iter().any(|z| z.kennung() == neu.kennung()) {
                return Err(Fehler::Konflikt(format!("#{nr} hat schon einen Eintrag {}", neu.kennung())));
            }
            a.zeiten.push(neu);
            Ok(Some(format!("#{nr} Zeit nachgetragen: {} ({})", uhr::hm(minuten), fuer.name)))
        })
    }

    pub fn zeit_korrigieren(&self, wer: &Person, nr: u32, kennung: &str, k: &Zeitkorrektur) -> Result<Aufgabe, Fehler> {
        // gespeichert wird in Ortszeit mit Versatz, gleich in welcher Form die Eingabe kam (R00084)
        let lesen = |z: &Option<String>| -> Result<Option<String>, Fehler> {
            z.as_deref()
                .map(|s| Zeitpunkt::lesen(s).map(|z| z.in_ortszeit().datei()).ok_or_else(|| Fehler::Ungueltig(format!("Zeitpunkt „{s}“: erwartet JJJJ-MM-TT HH:MM, optional mit Versatz ±HH:MM oder Z"))))
                .transpose()
        };
        let (beginn, ende) = (lesen(&k.beginn)?, lesen(&k.ende)?);
        self.aufgabe_schreiben(wer, nr, |a| {
            let z = eintrag(a, kennung)?;
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
                && Zeitpunkt::lesen(e).zip(Zeitpunkt::lesen(&z.beginn)).is_some_and(|(e, b)| e.utc() < b.utc())
            {
                return Err(Fehler::Ungueltig("Das Ende liegt vor dem Beginn".into()));
            }
            Ok((*z != vorher).then(|| format!("#{nr} Zeit korrigiert ({})", name(self, &z.wer))))
        })
    }

    pub fn zeit_loeschen(&self, wer: &Person, nr: u32, kennung: &str) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| {
            let z = eintrag(a, kennung)?.clone();
            let Some(ende) = &z.ende else {
                return Err(Fehler::Konflikt("Der Eintrag läuft noch — erst stoppen".into()));
            };
            a.zeiten.retain(|x| x != &z);
            Ok(Some(format!("#{nr} Zeit gelöscht ({}, {})", name(self, &z.wer), uhr::hm(uhr::minuten(&z.beginn, ende).unwrap_or(0)))))
        })
    }
}

/// Beginn und Ende eines Nachtrags in Ortszeit mit Versatz; das Ende liegt nach dem Beginn und nicht in der Zukunft.
fn block_lesen(beginn: &str, ende: &str) -> Result<(String, String), Fehler> {
    let lesen = |s: &str| Zeitpunkt::lesen(s).map(|z| z.in_ortszeit()).ok_or_else(|| Fehler::Ungueltig(format!("Zeitpunkt „{s}“: erwartet JJJJ-MM-TT HH:MM, optional mit Versatz ±HH:MM oder Z")));
    let (b, e) = (lesen(beginn)?, lesen(ende)?);
    if e.utc() <= b.utc() {
        return Err(Fehler::Ungueltig("Das Ende liegt nicht nach dem Beginn".into()));
    }
    if e.utc() > chrono::Utc::now() {
        return Err(Fehler::Ungueltig("Das Ende liegt in der Zukunft".into()));
    }
    Ok((b.datei(), e.datei()))
}
