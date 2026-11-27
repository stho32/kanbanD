//! Episoden der Kapazitätsgrenzen (ADR-0001 N1.4 Regel 5/6, R00269): ein Sturm von 503-Antworten wird je Ursache
//! als **eine** Episode gelesen. Die erste Abweisung schreibt `episode=beginn` samt Messwert, jede weitere derselben
//! Ursache wird nur gezählt, und nach [`RUHE_MS`] ohne Abweisung derselben Ursache folgt eine `INFO Episode beendet`-
//! Zeile mit `abweisungen`, `dauer_ms` und (nur bei der Lesegrenze) `belegt_max`.
//!
//! Die Logik ist deterministisch und bekommt den Zeitpunkt übergeben — keine Uhr, kein `Instant::now` (FA 4). Der
//! Zustand gehört der Instanz (FA 4, N1.7 Regel 1), nie global.

use crate::fehler::Ursache;
use chrono::{DateTime, FixedOffset};

/// So lange ohne Abweisung derselben Ursache, dann endet die Episode (ADR-0001 N1.4 Regel 5, R00269 FA 2).
pub const RUHE_MS: i64 = 10_000;

/// Eine Zeile, die die Episodenlogik auslöst. Ein `Beginn` ist **keine** eigene Zeile — er ergänzt die Basiszeile
/// der Abweisung um `episode=beginn` und den Messwert; ein `Ende` ist eine eigene `INFO Episode beendet`-Zeile.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Zeile {
    /// Die Episode dieser Ursache beginnt mit der Abweisung. `belegt` (belegte Plätze) gilt für die Lesegrenze,
    /// `frei_kb` (freie KB) für das Antwortbudget; das jeweils andere Feld ist `None`.
    Beginn { ursache: Ursache, belegt: Option<usize>, frei_kb: Option<usize> },
    /// Die Episode dieser Ursache endet. `dauer_ms` ist von der ersten bis zur letzten Abweisung; `belegt_max` trägt
    /// nur die Lesegrenze.
    Ende { ursache: Ursache, abweisungen: u64, dauer_ms: i64, belegt_max: Option<usize> },
}

impl Zeile {
    /// Schreibt ein `Ende` als `INFO Episode beendet` ins Protokoll (N1.3). Ein `Beginn` schreibt nichts — er ist
    /// nur die Ergänzung der Basiszeile, die die Middleware selbst schreibt.
    pub fn schreiben(&self, protokoll: &crate::protokoll::Protokoll) {
        let Zeile::Ende { ursache, abweisungen, dauer_ms, belegt_max } = self else { return };
        let mut felder: Vec<(&'static str, String)> =
            vec![("ursache", ursache.text().to_string()), ("abweisungen", abweisungen.to_string()), ("dauer_ms", dauer_ms.to_string())];
        if let Some(belegt_max) = belegt_max {
            felder.push(("belegt_max", belegt_max.to_string()));
        }
        protokoll.schreiben(crate::protokoll::Stufe::Info, crate::protokoll::Ereignis::EpisodeBeendet, &felder);
    }
}

/// Eine offene Episode einer Ursache.
#[derive(Debug, Clone)]
struct Episode {
    erste: DateTime<FixedOffset>,
    letzte: DateTime<FixedOffset>,
    abweisungen: u64,
    /// größte beobachtete Belegung der Episode (nur Lesegrenze, R00269 FA 2)
    belegt_max: usize,
}

impl Episode {
    /// Die Ende-Zeile dieser Episode; `belegt_max` trägt nur die Lesegrenze (R00269 FA 2).
    fn ende(&self, ursache: Ursache) -> Zeile {
        Zeile::Ende {
            ursache,
            abweisungen: self.abweisungen,
            dauer_ms: (self.letzte - self.erste).num_milliseconds(),
            belegt_max: matches!(ursache, Ursache::Lesegrenze).then_some(self.belegt_max),
        }
    }
}

/// Die Episoden der beiden Kapazitätsgrenzen, je Instanz (FA 4, N1.7 Regel 1). Eine Episode gehört genau einer
/// Ursache; die beiden Episoden sind voneinander unabhängig (R00269 FA 1).
#[derive(Debug, Default)]
pub struct Episoden {
    lesegrenze: Option<Episode>,
    antwortbudget: Option<Episode>,
}

impl Episoden {
    fn feld(&mut self, ursache: Ursache) -> &mut Option<Episode> {
        match ursache {
            Ursache::Lesegrenze => &mut self.lesegrenze,
            _ => &mut self.antwortbudget,
        }
    }

    /// Eine Abweisung der Ursache zum Zeitpunkt `jetzt`; `belegt` (Lesegrenze) bzw. `frei_kb` (Antwortbudget) ist der
    /// aktuelle Messwert. Die erste Abweisung einer Episode liefert `Beginn`; jede weitere derselben Ursache zählt
    /// nur. Kam die letzte Abweisung dieser Ursache [`RUHE_MS`] her, endet zuerst die alte Episode (`Ende`) und
    /// beginnt dann die neue.
    pub fn beobachten(&mut self, ursache: Ursache, jetzt: DateTime<FixedOffset>, belegt: Option<usize>, frei_kb: Option<usize>) -> Vec<Zeile> {
        let mut zeilen = vec![];
        let neu = {
            let feld = self.feld(ursache);
            match feld {
                Some(episode) if (jetzt - episode.letzte).num_milliseconds() >= RUHE_MS => {
                    zeilen.push(episode.ende(ursache));
                    true
                }
                Some(episode) => {
                    episode.letzte = jetzt;
                    episode.abweisungen += 1;
                    if let Some(belegt) = belegt {
                        episode.belegt_max = episode.belegt_max.max(belegt);
                    }
                    false
                }
                None => true,
            }
        };
        if neu {
            *self.feld(ursache) = Some(Episode { erste: jetzt, letzte: jetzt, abweisungen: 1, belegt_max: belegt.unwrap_or(0) });
            zeilen.push(Zeile::Beginn { ursache, belegt, frei_kb });
        }
        zeilen
    }

    /// Prüft die Ruhe aller offenen Episoden zum Zeitpunkt `jetzt` (bei jeder Anfrage, R00269 FA 3): jede Episode,
    /// deren letzte Abweisung [`RUHE_MS`] her ist, endet. Ist keine abgelaufen, kommt keine Zeile.
    pub fn ruhe(&mut self, jetzt: DateTime<FixedOffset>) -> Vec<Zeile> {
        let mut zeilen = vec![];
        for (ursache, feld) in [(Ursache::Lesegrenze, &mut self.lesegrenze), (Ursache::Antwortbudget, &mut self.antwortbudget)] {
            if let Some(episode) = feld.as_ref() {
                if (jetzt - episode.letzte).num_milliseconds() >= RUHE_MS {
                    zeilen.push(episode.ende(ursache));
                    *feld = None;
                }
            }
        }
        zeilen
    }

    /// Beendet alle offenen Episoden (geordnetes Beenden, R00269 FA 3/AK 8): eine `Ende`-Zeile je offener Episode.
    /// Ein zweiter Aufruf und ein Aufruf ohne offene Episode schreiben nichts.
    pub fn beenden(&mut self) -> Vec<Zeile> {
        let mut zeilen = vec![];
        for (ursache, feld) in [(Ursache::Lesegrenze, &mut self.lesegrenze), (Ursache::Antwortbudget, &mut self.antwortbudget)] {
            if let Some(episode) = feld.take() {
                zeilen.push(episode.ende(ursache));
            }
        }
        zeilen
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Der feste Startpunkt plus `ms` Millisekunden.
    fn t(ms: i64) -> DateTime<FixedOffset> {
        DateTime::parse_from_rfc3339("2026-11-27T10:00:00+01:00").unwrap() + chrono::Duration::milliseconds(ms)
    }

    // R00269 AK 2: drei Abweisungen zu t0, t0+1 s und t0+2 s mit größter Belegung 4 → bei t0+9 s nichts (7 s Ruhe),
    // bei t_letzte+10 s − 1 ms nichts, bei t_letzte+10 s genau 1 Ende mit abweisungen=3, belegt_max=4, dauer_ms=2000;
    // ein weiterer Aufruf bei t_letzte+11 s schreibt keine zweite.
    #[test]
    fn ak2_ende_nach_zehn_sekunden_ruhe() {
        let mut e = Episoden::default();
        assert_eq!(
            e.beobachten(Ursache::Lesegrenze, t(0), Some(2), None),
            vec![Zeile::Beginn { ursache: Ursache::Lesegrenze, belegt: Some(2), frei_kb: None }],
            "die erste Abweisung beginnt die Episode"
        );
        assert!(e.beobachten(Ursache::Lesegrenze, t(1000), Some(3), None).is_empty(), "nur gezählt");
        assert!(e.beobachten(Ursache::Lesegrenze, t(2000), Some(4), None).is_empty(), "nur gezählt");
        assert!(e.ruhe(t(9000)).is_empty(), "7 s Ruhe nach der letzten Abweisung");
        assert!(e.ruhe(t(2000 + RUHE_MS - 1)).is_empty(), "10 s − 1 ms");
        assert_eq!(
            e.ruhe(t(2000 + RUHE_MS)),
            vec![Zeile::Ende { ursache: Ursache::Lesegrenze, abweisungen: 3, dauer_ms: 2000, belegt_max: Some(4) }]
        );
        assert!(e.ruhe(t(2000 + 11_000)).is_empty(), "keine zweite Ende-Zeile");
    }

    // R00269 AK 6: nach dem Ende beginnt eine neue Episode (Zähler neu); kommt die Abweisung genau bei t_letzte+10 s,
    // steht zuerst die Ende-Zeile der alten, dann die Beginn-Zeile der neuen Episode.
    #[test]
    fn ak6_nach_dem_ende_beginnt_eine_neue_episode() {
        let mut e = Episoden::default();
        e.beobachten(Ursache::Lesegrenze, t(0), Some(4), None);
        e.beobachten(Ursache::Lesegrenze, t(1000), Some(4), None);
        e.beobachten(Ursache::Lesegrenze, t(2000), Some(4), None);
        assert_eq!(e.ruhe(t(12_000)), vec![Zeile::Ende { ursache: Ursache::Lesegrenze, abweisungen: 3, dauer_ms: 2000, belegt_max: Some(4) }]);
        // eine weitere Abweisung bei t_letzte+30 s beginnt eine neue Episode; ihr Ende meldet abweisungen=1
        assert_eq!(
            e.beobachten(Ursache::Lesegrenze, t(32_000), Some(4), None),
            vec![Zeile::Beginn { ursache: Ursache::Lesegrenze, belegt: Some(4), frei_kb: None }]
        );
        assert_eq!(e.beenden(), vec![Zeile::Ende { ursache: Ursache::Lesegrenze, abweisungen: 1, dauer_ms: 0, belegt_max: Some(4) }]);
        // genau bei t_letzte+10 s: erst Ende der alten, dann Beginn der neuen Episode
        let mut e = Episoden::default();
        e.beobachten(Ursache::Lesegrenze, t(0), Some(4), None);
        assert_eq!(
            e.beobachten(Ursache::Lesegrenze, t(10_000), Some(4), None),
            vec![
                Zeile::Ende { ursache: Ursache::Lesegrenze, abweisungen: 1, dauer_ms: 0, belegt_max: Some(4) },
                Zeile::Beginn { ursache: Ursache::Lesegrenze, belegt: Some(4), frei_kb: None },
            ],
            "zuerst das Ende der alten, dann der Beginn der neuen Episode"
        );
    }

    // R00269 AK 5: die Ursachen sind unabhängig — eine Abweisung der zweiten Ursache beginnt ihre eigene Episode,
    // das Ende der einen lässt die andere offen.
    #[test]
    fn ak5_die_ursachen_sind_getrennt() {
        let mut e = Episoden::default();
        assert_eq!(
            e.beobachten(Ursache::Lesegrenze, t(0), Some(1), None),
            vec![Zeile::Beginn { ursache: Ursache::Lesegrenze, belegt: Some(1), frei_kb: None }]
        );
        assert_eq!(
            e.beobachten(Ursache::Antwortbudget, t(5000), None, Some(7)),
            vec![Zeile::Beginn { ursache: Ursache::Antwortbudget, belegt: None, frei_kb: Some(7) }]
        );
        // t0+10 s: die Lesegrenze-Episode ist 10 s ruhig, die Antwortbudget-Episode erst 5 s
        assert_eq!(
            e.ruhe(t(10_000)),
            vec![Zeile::Ende { ursache: Ursache::Lesegrenze, abweisungen: 1, dauer_ms: 0, belegt_max: Some(1) }],
            "nur die Lesegrenze endet"
        );
        assert_eq!(
            e.ruhe(t(15_000)),
            vec![Zeile::Ende { ursache: Ursache::Antwortbudget, abweisungen: 1, dauer_ms: 0, belegt_max: None }],
            "die andere Episode bleibt offen bis zu ihrer eigenen Ruhe"
        );
        // nichts ist mehr offen: ein weiterer Aufruf schreibt nichts
        assert!(e.beenden().is_empty());
    }
}
