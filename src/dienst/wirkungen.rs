//! Wirkungen von Aufgaben auf die WBS (R00057, R00071): prüfen, an der Aufgabe vermerken, in der WBS eintreten lassen.

use super::Kanban;
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::{Aktion, Anwendungen, Aufgabe, Ausfuehrung, Person, Wirkung, id_gueltig};
use crate::wbs::WbsTabelle;
use crate::wbs_datei::{NeuerKnoten, neuen_knoten_pruefen};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

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
    let wirkung = Wirkung { anwendung: kuerzel, aktion, ausgefuehrt: Default::default(), knoten: knoten.clone(), eltern: None, ebene: None, name: None, fertig_kriterium: None, weitere: vec![] };
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
    /// Vermerkt eine Wirkung an der Aufgabe `nr`, ohne die WBS zu ändern (R00071); geprüft wird gegen die WBS: der Knoten
    /// bei rework und remove muss dort stehen, die Angaben zu einem neuen Knoten müssen gelten. Dieselbe Wirkung auf
    /// denselben Knoten ein zweites Mal: keine zweite Zeile, kein Commit.
    pub fn wirkung_setzen(&self, wer: &Person, nr: u32, eingabe: &WirkungEingabe) -> Result<Aufgabe, Fehler> {
        let e = self.ordner().einstellungen()?.unwrap_or_default();
        let wirkung = Wirkung { ausgefuehrt: Ausfuehrung::Offen, ..wirkung_pruefen(eingabe, &Anwendungen::aus(&e.quellen))? };
        let _sperre = self.gesperrt();
        let mut a = self.ordner().aufgabe(nr)?;
        let tabelle = self.wbs_tabelle_lesen(&wirkung.anwendung).map_err(als_konflikt)?;
        match wirkung.knoten.as_deref() {
            Some(k) if tabelle.knoten(k).is_none() => return Err(Fehler::Konflikt(format!("Knoten „{k}“ steht nicht in der WBS"))),
            Some(_) => {}
            None => {
                neuen_knoten_pruefen(&tabelle, &neuer_knoten(&wirkung))?;
            }
        }
        let schon_da = wirkung.knoten.is_some() && a.wirkungen.iter().any(|w| w.aktion == wirkung.aktion && w.schluessel() == wirkung.schluessel());
        if !schon_da {
            let nachricht = format!("#{nr} Wirkung auf {} vermerkt", beschreibung(&wirkung));
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

    /// Die Wirkungen der Aufgabe `nr` mit ihrem Eintritt (R00071).
    pub fn wirkungen_stand(&self, nr: u32) -> Result<Vec<Wirkungsstand>, Fehler> {
        let a = self.ordner().aufgabe(nr)?;
        let mut tabellen = BTreeMap::new();
        Ok(a.wirkungen.into_iter().enumerate().map(|(i, w)| Wirkungsstand { i, eingetreten: self.eingetreten(&w, &mut tabellen), wirkung: w }).collect())
    }

    /// Schaltet den Eintritt der Wirkung `i`: an führt sie in der WBS aus, aus macht sie rückgängig, wo es eindeutig geht —
    /// create verwirft den angelegten Knoten, remove hebt das Verwerfen auf, rework nimmt nur den Vermerk zurück.
    /// Schon im Zielzustand: nichts geändert. Die WBS ohne Commit, die Aufgabe mit einem Commit im Board-Repository.
    pub fn wirkung_eintritt(&self, wer: &Person, nr: u32, i: usize, an: bool) -> Result<Aufgabe, Fehler> {
        let _sperre = self.gesperrt();
        let mut a = self.ordner().aufgabe(nr)?;
        let w = a.wirkungen.get(i).cloned().ok_or_else(|| Fehler::NichtGefunden(format!("#{nr} hat keine Wirkung an Position {i}")))?;
        let eingetreten = self.eingetreten(&w, &mut BTreeMap::new()).ok_or_else(|| Fehler::Konflikt(format!("WBS von „{}“ nicht erreichbar oder Knoten unbekannt", w.anwendung)))?;
        if eingetreten == an {
            return Ok(a);
        }
        let grund = format!("#{} {}", a.nummer, a.titel);
        let knoten = w.knoten.clone().unwrap_or_default();
        let neu = match (w.aktion, an) {
            (Aktion::Anlegen, true) => Wirkung { knoten: Some(self.wbs_knoten_anlegen(&w.anwendung, &neuer_knoten(&w)).map_err(als_konflikt)?.id), ..w.clone() },
            (Aktion::Ueberarbeiten, true) => self.wbs_ueberarbeiten(&w.anwendung, &knoten).map_err(als_konflikt).map(|_| w.clone())?,
            (Aktion::Verwerfen, true) => self.wbs_verwerfen(&w.anwendung, &knoten, &grund).map_err(als_konflikt).map(|_| w.clone())?,
            (Aktion::Anlegen, false) => self.wbs_verwerfen(&w.anwendung, &knoten, &format!("{grund} zurückgenommen")).map_err(als_konflikt).map(|_| w.clone())?,
            (Aktion::Verwerfen, false) => self.wbs_wiederherstellen(&w.anwendung, &knoten, &grund).map_err(als_konflikt).map(|_| w.clone())?,
            (Aktion::Ueberarbeiten, false) => w.clone(),
        };
        let neu = Wirkung { ausgefuehrt: if an { Ausfuehrung::Am(crate::uhr::heute()) } else { Ausfuehrung::Offen }, ..neu };
        let nachricht = format!("#{nr} Wirkung auf {} {}", beschreibung(&neu), if an { "eingetreten" } else { "zurückgenommen" });
        a.wirkungen[i] = neu;
        self.aktion(wer, &nachricht, &[(format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(&a))])?;
        Ok(a)
    }

    /// Eingetreten: create — der angelegte Knoten steht und zählt; remove — der Knoten ist verworfen oder fehlt;
    /// rework — vermerkt (`executed`). `None`: WBS nicht lesbar.
    fn eingetreten(&self, w: &Wirkung, tabellen: &mut BTreeMap<String, Option<WbsTabelle>>) -> Option<bool> {
        if w.aktion == Aktion::Ueberarbeiten {
            return Some(w.ausgefuehrt.ausgefuehrt());
        }
        let Some(id) = w.knoten.as_deref() else { return Some(false) };
        let tabelle = tabellen.entry(w.anwendung.clone()).or_insert_with(|| self.wbs_tabelle_lesen(&w.anwendung).ok()).as_ref()?;
        let knoten = tabelle.knoten(id);
        Some(match w.aktion {
            Aktion::Anlegen => knoten.is_some_and(|k| k.status != "verworfen"),
            _ => knoten.is_none_or(|k| k.status == "verworfen"),
        })
    }
}

/// `kc:I0014 (remove)`, bei create ohne Knoten `kc (create „Export“)`.
fn beschreibung(w: &Wirkung) -> String {
    match w.schluessel() {
        Some(s) => format!("{s} ({})", w.aktion.schluessel()),
        None => format!("{} ({} „{}“)", w.anwendung, w.aktion.schluessel(), w.name.clone().unwrap_or_default()),
    }
}

/// `GET /api/aufgaben/{nr}/wbs-effects`: eine Wirkung mit Position und Eintritt (`null`: WBS nicht lesbar).
#[derive(Debug, Serialize)]
pub struct Wirkungsstand {
    pub i: usize,
    #[serde(flatten)]
    pub wirkung: Wirkung,
    pub eingetreten: Option<bool>,
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
