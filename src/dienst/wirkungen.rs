//! Wirkungen von Aufgaben auf die WBS (R00057): prüfen, in der WBS ausführen, an der Aufgabe festhalten.

use super::Kanban;
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::{Aktion, Anwendungen, Aufgabe, Person, Wirkung, id_gueltig};
use crate::wbs_datei::NeuerKnoten;
use serde::Deserialize;

/// `PATCH /api/aufgaben/{nr}/wbs-effects` — fehlende Felder sind leer, damit die Prüfung sie mit 400 und klarer Meldung ablehnt.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct WirkungEingabe {
    pub application: String,
    pub action: String,
    pub node: String,
    pub parent: String,
    pub level: String,
    pub name: String,
    #[serde(alias = "done-criterion")]
    pub done_criterion: String,
}

fn ungueltig<T>(m: String) -> Result<T, Fehler> {
    Err(Fehler::Ungueltig(m))
}

/// Ein Text oder nichts.
fn gesetzt(s: &str) -> Option<String> {
    Some(s.trim().to_string()).filter(|s| !s.is_empty())
}

/// Prüft eine Wirkung gegen das Register: Kürzel registriert (die Standardanwendung ohne Kürzel wirkt nicht), Aktion bekannt,
/// `node` bei rework und remove Pflicht, bei create nicht erlaubt — die ID vergibt kanbanD. Die Angaben zum neuen Knoten
/// prüft das Anlegen selbst (R00056).
pub fn wirkung_pruefen(e: &WirkungEingabe, anwendungen: &Anwendungen) -> Result<Wirkung, Fehler> {
    let kuerzel = e.application.trim().to_lowercase();
    if kuerzel.is_empty() {
        return ungueltig("Eine Wirkung nennt ihre Anwendung (application) — ein Kürzel aus dem Register sources.applications in kanbanD.md".into());
    }
    if !anwendungen.registriert(&kuerzel) {
        return ungueltig(format!("Anwendung „{kuerzel}“ steht nicht im Register sources.applications in kanbanD.md"));
    }
    let Some(aktion) = Aktion::aus(e.action.trim()) else { return ungueltig(format!("Aktion „{}“ — erwartet create, rework oder remove", e.action.trim())) };
    let knoten = gesetzt(&e.node).map(|k| k.to_uppercase());
    let wirkung = Wirkung { anwendung: kuerzel, aktion, knoten: knoten.clone(), eltern: None, ebene: None, name: None, fertig_kriterium: None, weitere: vec![] };
    match (aktion, knoten) {
        (Aktion::Anlegen, Some(k)) => ungueltig(format!("create vergibt die ID selbst — node „{k}“ weglassen")),
        (Aktion::Anlegen, None) => Ok(Wirkung { eltern: gesetzt(&e.parent).map(|p| p.to_uppercase()), ebene: gesetzt(&e.level), name: gesetzt(&e.name), fertig_kriterium: gesetzt(&e.done_criterion), ..wirkung }),
        (_, None) => ungueltig(format!("{} braucht den Knoten (node)", aktion.schluessel())),
        (_, Some(k)) if !id_gueltig(&k) || k.starts_with('R') => ungueltig(format!("„{k}“ ist kein WBS-Knoten — erwartet etwa D0002 oder I0014")),
        _ => Ok(wirkung),
    }
}

/// Der neue Knoten einer Wirkung `create`.
pub fn neuer_knoten(w: &Wirkung) -> NeuerKnoten {
    let text = |s: &Option<String>| s.clone().unwrap_or_default();
    NeuerKnoten { ebene: text(&w.ebene), eltern: text(&w.eltern), name: text(&w.name), fertig_kriterium: text(&w.fertig_kriterium), ..Default::default() }
}

/// Scheitert die WBS am Zustand (Knoten unbekannt, Datei defekt, Anwendung nicht erreichbar), ist das ein Konflikt (409);
/// falsche Angaben zum neuen Knoten bleiben 400.
fn als_konflikt(f: Fehler) -> Fehler {
    match f {
        Fehler::NichtGefunden(m) => Fehler::Konflikt(m),
        f => f,
    }
}

impl Kanban {
    /// Hängt eine Wirkung an die Aufgabe `nr` und führt sie sofort aus: erst die WBS im Arbeits-Repository (ohne Commit),
    /// dann die Aufgabe mit einem Commit im Board-Repository. Scheitert die WBS, bleibt die Aufgabe unverändert.
    /// Die Sperre des Ordners hält die Aufgabe fest, die WBS-Operation nimmt die Sperre ihrer Datei selbst.
    pub fn wirkung_setzen(&self, wer: &Person, nr: u32, eingabe: &WirkungEingabe) -> Result<Aufgabe, Fehler> {
        let e = self.ordner().einstellungen()?.unwrap_or_default();
        let wirkung = wirkung_pruefen(eingabe, &Anwendungen::aus(&e.quellen))?;
        let _sperre = self.gesperrt();
        let mut a = self.ordner().aufgabe(nr)?;
        let wirkung = self.in_der_wbs_ausfuehren(&a, wirkung).map_err(als_konflikt)?;
        let schon_da = a.wirkungen.iter().any(|w| w.aktion == wirkung.aktion && w.schluessel() == wirkung.schluessel());
        if !schon_da {
            let nachricht = format!("#{nr} wirkt auf {} ({})", wirkung.schluessel().unwrap_or_default(), wirkung.aktion.schluessel());
            a.wirkungen.push(wirkung);
            self.aktion(wer, &nachricht, &[(format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(&a))])?;
        }
        Ok(a)
    }

    /// Nimmt die Wirkung an Position `i` aus der Aufgabe; in der WBS wird nichts rückgängig gemacht.
    pub fn wirkung_entfernen(&self, wer: &Person, nr: u32, i: usize) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| {
            if i >= a.wirkungen.len() {
                return Err(Fehler::NichtGefunden(format!("#{nr} hat keine Wirkung an Position {i}")));
            }
            let w = a.wirkungen.remove(i);
            Ok(Some(format!("#{nr} Wirkung auf {} ({}) entfernt", w.schluessel().unwrap_or_else(|| w.anwendung.clone()), w.aktion.schluessel())))
        })
    }

    /// Die Wirkung in der WBS; bei `create` mit der vergebenen ID.
    fn in_der_wbs_ausfuehren(&self, a: &Aufgabe, w: Wirkung) -> Result<Wirkung, Fehler> {
        let knoten = w.knoten.clone().unwrap_or_default();
        match w.aktion {
            Aktion::Anlegen => {
                let neu = self.wbs_knoten_anlegen(&w.anwendung, &neuer_knoten(&w))?;
                Ok(Wirkung { knoten: Some(neu.id), ..w })
            }
            Aktion::Ueberarbeiten => self.wbs_ueberarbeiten(&w.anwendung, &knoten).map(|_| w),
            Aktion::Verwerfen => self.wbs_verwerfen(&w.anwendung, &knoten, &format!("#{} {}", a.nummer, a.titel)).map(|_| w),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::{Anwendung, Quellen};

    fn register() -> Anwendungen {
        Anwendungen::aus(&Quellen { wbs: "plan.md".into(), anforderungen: String::new(), anwendungen: vec![Anwendung { kuerzel: "kd".into(), name: "kanbanD".into(), wbs: "/x/plan.md".into(), anforderungen: String::new() }] })
    }

    fn eingabe(json: &str) -> WirkungEingabe {
        serde_json::from_str(json).unwrap()
    }

    fn fehler(json: &str) -> String {
        match wirkung_pruefen(&eingabe(json), &register()) {
            Err(Fehler::Ungueltig(m)) => m,
            anders => panic!("400 erwartet: {anders:?}"),
        }
    }

    #[test]
    fn create_mit_den_angaben_zum_neuen_knoten() {
        let w = wirkung_pruefen(&eingabe(r#"{"application":" KD ","action":"create","parent":"d0002","level":"Interaction","name":"Export","done_criterion":"US-1"}"#), &register()).unwrap();
        assert_eq!((w.anwendung.as_str(), w.aktion, w.knoten.as_deref(), w.eltern.as_deref()), ("kd", Aktion::Anlegen, None, Some("D0002")));
        let n = neuer_knoten(&w);
        assert_eq!((n.ebene.as_str(), n.eltern.as_str(), n.name.as_str(), n.fertig_kriterium.as_str()), ("Interaction", "D0002", "Export", "US-1"));
        assert_eq!(eingabe(r#"{"done-criterion":"US-2"}"#).done_criterion, "US-2", "auch in der Schreibweise der Datei");
    }

    #[test]
    fn rework_und_remove_brauchen_einen_knoten_und_tragen_sonst_nichts() {
        let w = wirkung_pruefen(&eingabe(r#"{"application":"kd","action":"rework","node":"d0002","name":"egal"}"#), &register()).unwrap();
        assert_eq!((w.aktion, w.knoten.as_deref(), w.name), (Aktion::Ueberarbeiten, Some("D0002"), None));
        assert_eq!(wirkung_pruefen(&eingabe(r#"{"application":"kd","action":"remove","node":"I0014"}"#), &register()).unwrap().aktion, Aktion::Verwerfen);
        assert_eq!(fehler(r#"{"application":"kd","action":"remove"}"#), "remove braucht den Knoten (node)");
        assert!(fehler(r#"{"application":"kd","action":"rework","node":"R00057"}"#).contains("kein WBS-Knoten"));
        assert!(fehler(r#"{"application":"kd","action":"rework","node":"X1"}"#).contains("kein WBS-Knoten"));
    }

    #[test]
    fn ohne_registriertes_kuerzel_unbekannte_aktion_oder_create_mit_knoten_ist_400() {
        assert!(fehler(r#"{"action":"rework","node":"D0002"}"#).contains("Register sources.applications"), "die Standardanwendung ohne Kürzel wirkt nicht");
        assert_eq!(fehler(r#"{"application":"xx","action":"rework","node":"D0002"}"#), "Anwendung „xx“ steht nicht im Register sources.applications in kanbanD.md");
        assert_eq!(fehler(r#"{"application":"kd","action":"grow","node":"D0002"}"#), "Aktion „grow“ — erwartet create, rework oder remove");
        assert!(fehler(r#"{"application":"kd","action":"create","node":"I0048"}"#).starts_with("create vergibt die ID selbst"));
    }
}
