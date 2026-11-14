//! Reservierungen (R00087): eine Instanz hält eine Karte für sich, andere lassen sie beim Reservieren und Ziehen aus.

use super::{Kanban, Schritt};
use super::zugregeln::{archivierte, entnahme_und_zug_pruefen};
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
                true => format!("#{nr} Reservierung verlängert ({})", crate::nachricht::wert(&self.inhaber(&neu))),
                false => format!("#{nr} reserviert ({})", crate::nachricht::wert(&self.inhaber(&neu))),
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
        let vorher = b.clone();
        b.bewegen(nr, &nach, Some(0)).map_err(|_| Fehler::Intern(format!("#{nr} ließ sich nicht nach „{nach}“ bewegen")))?;
        let grenzwarnungen = entnahme_und_zug_pruefen(wer.art, &vorher, &b, &[nr], &archivierte(&aufgaben))?;
        #[cfg(test)]
        {
            let haken = self.zwischen_grenzpruefung_und_aktion.lock().unwrap().take();
            if let Some(haken) = haken {
                haken();
            }
        }
        let nachricht = format!("#{nr} gezogen: „{}“ → „{}“ ({}, {})", crate::nachricht::wert(&zug.von), crate::nachricht::wert(&nach), crate::nachricht::wert(&self.inhaber(a.reservierung.as_ref().expect("gesetzt"))), crate::nachricht::wert(&b.titel));
        let dateien = [Schritt::schreiben(format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(&a)), Schritt::schreiben(board_pfad(&b.slug), self.board_text(&b, None)?)];
        self.aktion(wer, &nachricht, &dateien)?;
        let warnungen = [grenzwarnungen, self.warnungen(&b, nr, &zug.von, &nach)].concat();
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
            Ok(Some(format!("#{nr} freigegeben (war {})", crate::nachricht::wert(&self.inhaber(&r)))))
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

    fn git(pfad: &std::path::Path, args: &[&str]) -> String {
        let aus = std::process::Command::new("git").args(args).current_dir(pfad).output().unwrap();
        String::from_utf8_lossy(&aus.stdout).trim().to_string()
    }

    /// Board „Fluss“: „Bereit“ = [7, 8], „In Arbeit“ Grenze 3 mit [5, 6], „Fertig“ leer; je Nummer eine Aufgabe.
    fn fluss(pfad: &std::path::Path) {
        std::fs::create_dir_all(pfad.join("boards")).unwrap();
        std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
        std::fs::write(pfad.join("kanbanD.md"), "---\npeople:\n  cl: {name: Claude, kind: agent}\n---\n").unwrap();
        std::fs::write(pfad.join("boards/fluss.md"), "---\nlimits:\n  In Arbeit: 3\n---\n\n# Fluss\n\n## Bereit\n\n- #7\n- #8\n\n## In Arbeit\n\n- #5\n- #6\n\n## Fertig\n").unwrap();
        for nr in [5, 6, 7, 8] {
            std::fs::write(pfad.join(format!("aufgaben/{nr:04}-k.md")), format!("---\nid: {nr}\ntitle: k{nr}\n---\n")).unwrap();
        }
        git(pfad, &["init", "-q"]);
        git(pfad, &["add", "-A"]);
        git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fluss"]);
    }

    // R00118 B0538: der Halter zwischen Grenzprüfung und aktion() — die Sperre steht dort, der zweite Zug läuft erst
    // nach dem ersten und sieht die volle Spalte. Ohne die Sperre könnte er die Belegung vor dem ersten Zug lesen.
    #[test]
    fn ziehen_haelt_die_sperre_zwischen_pruefung_und_aktion() {
        use std::sync::{Arc, mpsc};
        use std::time::Duration;
        let tmp = tempfile::tempdir().unwrap();
        fluss(tmp.path());
        let k = Arc::new(Kanban::neu(tmp.path().to_path_buf()));
        let cl = k.handelnder(Some("cl")).unwrap();
        let zug = Zug { von: "Bereit".into(), nach: None };

        let (zweiter_tx, zweiter_rx) = mpsc::channel();
        let (k2, cl2, zug2) = (Arc::clone(&k), cl.clone(), zug.clone());
        *k.zwischen_grenzpruefung_und_aktion.lock().unwrap() = Some(Box::new(move || {
            let gehalten = matches!(k2.sperre.try_lock(), Err(std::sync::TryLockError::WouldBlock));
            let (fertig_tx, fertig_rx) = mpsc::channel();
            let k3 = Arc::clone(&k2);
            let lauf = std::thread::spawn(move || {
                let r = k3.ziehen(&cl2, "B", "fluss", &zug2);
                fertig_tx.send(()).ok();
                r
            });
            let durchgelaufen = fertig_rx.recv_timeout(Duration::from_secs(2)).is_ok();
            zweiter_tx.send((gehalten, durchgelaufen, lauf)).unwrap();
        }));
        let vorher: usize = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();

        let erster = k.ziehen(&cl, "A", "fluss", &zug);
        let (gehalten, durchgelaufen, lauf) = zweiter_rx.recv().unwrap();

        assert!(gehalten, "die Sperre ist zwischen Grenzprüfung und aktion() gehalten");
        assert!(!durchgelaufen, "der zweite Zug kam durch, während der erste zwischen Prüfung und Handlung stand");
        assert_eq!(erster.map(|g| g.aufgabe.nummer), Ok(7), "der erste Zug zieht #7");
        assert_eq!(
            lauf.join().unwrap().err(),
            Some(Fehler::GrenzeErreicht { spalte: "In Arbeit".into(), grenze: 3, anzahl: 3 }),
            "der zweite sieht die volle Spalte nach dem ersten"
        );
        assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<usize>().unwrap(), vorher + 1, "nur der erste committet");
    }
}
