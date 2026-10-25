//! Reservierungen (R00087): eine Instanz hält eine Karte für sich, andere lassen sie beim Reservieren und Ziehen aus.

use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Art, Aufgabe, Person, Reservierung, instanz_gueltig};
use crate::uhr;

/// Die Kennung einer Instanz aus Header oder Feld; Reservieren und Ziehen verlangen sie.
pub fn instanz_pruefen(instanz: Option<&str>) -> Result<String, Fehler> {
    let i = instanz.map(str::trim).filter(|i| !i.is_empty()).ok_or_else(|| Fehler::Ungueltig("Welche Instanz? Header X-KanbanD-Instanz oder Feld instanz fehlt".into()))?;
    if !instanz_gueltig(i) {
        return Err(Fehler::Ungueltig(format!("Instanz „{i}“: 1–64 Zeichen aus A–Z, a–z, 0–9, . _ -")));
    }
    Ok(i.to_string())
}

impl Kanban {
    fn personenname(&self, kuerzel: &str) -> String {
        self.ordner().einstellungen().ok().flatten().and_then(|e| e.person(kuerzel).map(|p| p.name.clone())).unwrap_or_else(|| kuerzel.into())
    }

    /// „Claude · Instanz A“
    pub(crate) fn inhaber(&self, r: &Reservierung) -> String {
        format!("{} · Instanz {}", self.personenname(&r.wer), r.instanz)
    }

    /// Frei oder abgelaufen → reserviert; eigene Instanz → verlängert; fremde gültige → 409 mit Inhaber.
    pub fn reservieren(&self, wer: &Person, instanz: &str, nr: u32) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| {
            if let Some(r) = a.reservierung.as_ref().filter(|r| !r.gehoert(instanz)) {
                let noch = uhr::hm(crate::modell::RESERVIERUNG_MINUTEN - uhr::minuten(&r.seit, &uhr::jetzt()).unwrap_or(0));
                return Err(Fehler::Konflikt(format!("#{nr} ist reserviert von {} · noch {noch}", self.inhaber(r))));
            }
            let verlaengert = a.reservierung.is_some();
            let neu = Reservierung { wer: wer.kuerzel.clone(), instanz: instanz.to_string(), seit: uhr::jetzt() };
            let nachricht = match verlaengert {
                true => format!("#{nr} Reservierung verlängert ({})", self.inhaber(&neu)),
                false => format!("#{nr} reserviert ({})", self.inhaber(&neu)),
            };
            a.reservierung = Some(neu);
            Ok(Some(nachricht))
        })
    }

    /// Die eigene Instanz gibt frei, ein Mensch jede; die fremde Instanz eines Agenten nicht (409).
    pub fn freigeben(&self, wer: &Person, instanz: Option<&str>, nr: u32) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| {
            let r = a.reservierung.take().ok_or_else(|| Fehler::NichtGefunden(format!("#{nr} ist nicht reserviert")))?;
            let darf = wer.art == Art::Mensch || instanz.is_some_and(|i| r.gehoert(i));
            if !darf {
                return Err(Fehler::Konflikt(format!("#{nr} ist reserviert von {} — freigeben darf nur diese Instanz oder ein Mensch", self.inhaber(&r))));
            }
            Ok(Some(format!("#{nr} freigegeben (war {})", self.inhaber(&r))))
        })
    }
}
