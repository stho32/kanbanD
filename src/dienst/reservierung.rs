//! Reservierungen (R00087): eine Instanz hält eine Karte für sich, andere lassen sie beim Reservieren und Ziehen aus.

use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::{Art, Aufgabe, Person, Reservierung, instanz_gueltig};
use crate::pruefungen::Warnung;
use crate::uhr;
use serde::{Deserialize, Serialize};

/// Rumpf von `POST …/ziehen`.
#[derive(Debug, Clone, Deserialize, utoipa::ToSchema)]
pub struct Zug {
    pub von: String,
    pub nach: Option<String>,
}

/// Antwort von `POST …/ziehen`: die gezogene Aufgabe, woher, wohin und was die Prüfungen melden.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct Gezogen {
    pub aufgabe: Aufgabe,
    pub von: String,
    pub nach: String,
    pub warnungen: Vec<Warnung>,
}

/// Die oberste Karte der Reihe, die nicht archiviert ist und keine fremde Reservierung trägt; die eigene zählt als frei.
/// `aufgaben` kennt nur gültige Reservierungen — abgelaufene hat das Lesen schon entfernt.
pub fn erste_freie(reihe: &[u32], aufgaben: &[Aufgabe], instanz: &str) -> Option<u32> {
    reihe.iter().copied().find(|nr| {
        aufgaben.iter().find(|a| a.nummer == *nr).is_some_and(|a| a.archiviert.is_none() && a.reservierung.as_ref().is_none_or(|r| r.gehoert(instanz)))
    })
}

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

    /// Unter der Sperre in einem Commit: oberste freie Karte aus `von` nehmen, für Wer und Instanz reservieren,
    /// Wer zuständig machen und nach `nach` (ohne: die Spalte rechts) oben einsortieren (R00087).
    pub fn ziehen(&self, wer: &Person, instanz: &str, slug: &str, zug: &Zug) -> Result<Gezogen, Fehler> {
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        let reihe = b.spalten.iter().find(|s| s.name == zug.von).map(|s| s.aufgaben.clone()).ok_or_else(|| Fehler::Ungueltig(format!("Spalte „{}“ gibt es auf „{}“ nicht", zug.von, b.titel)))?;
        let nach = match &zug.nach {
            Some(n) if b.spalten.iter().any(|s| &s.name == n) => n.clone(),
            Some(n) => return Err(Fehler::Ungueltig(format!("Spalte „{n}“ gibt es auf „{}“ nicht", b.titel))),
            None => b.folgespalte(&zug.von).map(str::to_string).ok_or_else(|| Fehler::Ungueltig(format!("„{}“ ist die letzte Spalte — nach angeben", zug.von)))?,
        };
        let (aufgaben, _) = self.ordner().aufgaben()?;
        let nr = erste_freie(&reihe, &aufgaben, instanz).ok_or_else(|| Fehler::NichtGefunden("nichts zu ziehen".into()))?;
        let mut a = self.ordner().aufgabe(nr)?;
        a.reservierung = Some(Reservierung { wer: wer.kuerzel.clone(), instanz: instanz.to_string(), seit: uhr::jetzt() });
        if !a.zustaendige.contains(&wer.kuerzel) {
            a.zustaendige.push(wer.kuerzel.clone());
        }
        b.bewegen(nr, &nach, Some(0)).map_err(|_| Fehler::Intern(format!("#{nr} ließ sich nicht nach „{nach}“ bewegen")))?;
        let nachricht = format!("#{nr} gezogen: „{}“ → „{nach}“ ({}, {})", zug.von, self.inhaber(a.reservierung.as_ref().expect("gesetzt")), b.titel);
        let dateien = [(format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(&a)), (board_pfad(&b.slug), self.board_text(&b, None)?)];
        self.aktion(wer, &nachricht, &dateien)?;
        let warnungen = self.warnungen(&b, nr, &zug.von, &nach);
        Ok(Gezogen { aufgabe: a, von: zug.von.clone(), nach, warnungen })
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

#[cfg(test)]
mod tests {
    use super::*;

    fn aufgabe(nr: u32, instanz: Option<&str>, archiviert: bool) -> Aufgabe {
        let mut a = Aufgabe::neu(nr, format!("{nr:04}-x.md"), "x".into());
        a.reservierung = instanz.map(|i| Reservierung { wer: "cl".into(), instanz: i.into(), seit: "2026-10-25 08:00+01:00".into() });
        a.archiviert = archiviert.then(|| "2026-10-01".into());
        a
    }

    #[test]
    fn erste_freie_in_board_reihenfolge() {
        let alle = [aufgabe(7, Some("B"), false), aufgabe(8, None, false), aufgabe(9, Some("A"), false), aufgabe(5, None, true)];
        assert_eq!(erste_freie(&[7, 8, 9], &alle, "A"), Some(8));
        assert_eq!(erste_freie(&[9, 8], &alle, "A"), Some(9), "die eigene zählt als frei");
        assert_eq!(erste_freie(&[5, 7], &alle, "A"), None, "archiviert und fremd");
        assert_eq!(erste_freie(&[42, 8], &alle, "A"), Some(8), "eine fehlende Datei wird übergangen");
        assert_eq!(erste_freie(&[], &alle, "A"), None);
    }
}
