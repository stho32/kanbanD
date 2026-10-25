//! Plausibilitätsprüfungen je Spalte (`column-checks`, R00059) — rein, ohne Dateizugriff. Sie warnen, sie sperren nicht.

use crate::modell::{Aktion, Aufgabe, Board};
use crate::phasen::Phasenfolge;
use serde::Serialize;
use std::collections::BTreeMap;

/// Der Katalog: jede Prüfung hat einen Namen, unter dem sie im Board-Frontmatter steht.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pruefung {
    /// `wbs-effects-green`: jeder Knoten, den die Aufgabe anlegt oder überarbeitet, ist grün
    WbsWirkungenGruen,
}

impl Pruefung {
    pub const ALLE: [Pruefung; 1] = [Pruefung::WbsWirkungenGruen];

    pub fn name(self) -> &'static str {
        match self {
            Pruefung::WbsWirkungenGruen => "wbs-effects-green",
        }
    }

    pub fn aus(name: &str) -> Option<Pruefung> {
        Pruefung::ALLE.into_iter().find(|p| p.name() == name)
    }

    pub fn text(self) -> &'static str {
        match self {
            Pruefung::WbsWirkungenGruen => "Achtung! Es sind nicht alle abhängigen WBS-Einträge grün.",
        }
    }
}

/// Je Spalte und unbekanntem Prüfungsnamen ein Hinweis; die Datei bleibt lesbar und schreibbar.
pub fn unbekannte(board: &Board) -> Vec<String> {
    board
        .spalten
        .iter()
        .flat_map(|s| s.pruefungen.iter().filter(|n| Pruefung::aus(n).is_none()).map(move |n| format!("Spalte „{}“: unbekannte Prüfung „{n}“ — bekannt sind {}", s.name, Pruefung::ALLE.map(Pruefung::name).join(", "))))
        .collect()
}

/// Rang einer Spalte für „nach rechts“: mit Phasen wie `phasenRang` in `web/berichte.js` (Abschlussspalte hinter allen
/// Phasen, gebundene Spalte an der Stelle ihrer Phase, ungebundene −1), ohne Phasen der Spaltenindex.
pub fn rang(board: &Board, folge: Option<&Phasenfolge>, spalte: &str) -> i64 {
    let index = board.spalten.iter().position(|s| s.name == spalte);
    let Some(folge) = folge else { return index.map_or(-1, |i| i as i64) };
    if index.is_some() && index == board.spalten.len().checked_sub(1) {
        return folge.alle().len() as i64;
    }
    let phase = board.spalten.iter().find(|s| s.name == spalte).and_then(|s| s.phase.as_deref());
    phase.and_then(|p| folge.alle().iter().position(|q| q.name == p)).map_or(-1, |k| k as i64)
}

/// Die Prüfungen, die ein Zug auslöst: die der Spalte davor, wenn die Spalte danach weiter rechts liegt; nach links nie.
pub fn ausgeloest(board: &Board, folge: Option<&Phasenfolge>, von: &str, nach: &str) -> Vec<Pruefung> {
    if rang(board, folge, nach) <= rang(board, folge, von) {
        return vec![];
    }
    board.spalten.iter().find(|s| s.name == von).map(|s| s.pruefungen.iter().filter_map(|n| Pruefung::aus(n)).collect()).unwrap_or_default()
}

/// Die Prüfungen aller Spalten links der Spalte, in der eine Karte liegt — sie bestimmen das Ausrufezeichen.
pub fn links_von(board: &Board, folge: Option<&Phasenfolge>, spalte: &str) -> Vec<Pruefung> {
    let r = rang(board, folge, spalte);
    let mut alle: Vec<Pruefung> = vec![];
    for p in board.spalten.iter().filter(|s| rang(board, folge, &s.name) < r).flat_map(|s| s.pruefungen.iter().filter_map(|n| Pruefung::aus(n))) {
        if !alle.contains(&p) {
            alle.push(p);
        }
    }
    alle
}

/// Wie die Prüfung einen Knoten sieht.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Knotenstand {
    /// gerechneter Status aus der WBS (`gruen`, `gelb`, `rot`, `verworfen`)
    Status(String),
    /// die WBS ist lesbar, der Knoten steht nicht (mehr) darin
    Fehlt,
    /// die WBS der Anwendung ist nicht erreichbar oder die Anwendung nicht registriert
    NichtErreichbar,
}

/// Stand je qualifiziertem Knoten (`kd:I0048`); ein nicht genannter Knoten gilt als fehlend.
pub type Knotenstaende = BTreeMap<String, Knotenstand>;

/// Eine nicht erfüllte Prüfung, wie die Antwort des Bewegens sie nennt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Warnung {
    pub pruefung: String,
    pub text: String,
    /// die Knoten, die die Prüfung nicht erfüllen, qualifiziert
    pub knoten: Vec<String>,
    /// je Knoten, warum: `kd:I0048 rot`, `kd:I0099 Knoten fehlt`, `kd:I0001 WBS nicht erreichbar`
    pub details: Vec<String>,
}

/// Die Knoten, auf die eine Prüfung schaut: Anwendung, Knoten-ID und Schlüssel jeder `create`- und `rework`-Wirkung.
pub fn gepruefte_knoten(aufgabe: &Aufgabe) -> Vec<(String, String, String)> {
    let mut knoten: Vec<(String, String, String)> = vec![];
    for w in aufgabe.wirkungen.iter().filter(|w| matches!(w.aktion, Aktion::Anlegen | Aktion::Ueberarbeiten)) {
        if let (Some(id), Some(s)) = (w.knoten.clone(), w.schluessel())
            && !knoten.iter().any(|(_, _, k)| *k == s)
        {
            knoten.push((w.anwendung.clone(), id, s));
        }
    }
    knoten
}

/// `None` heißt erfüllt. Ohne Wirkungen ist die Prüfung erfüllt; `remove` zählt nicht.
pub fn pruefen(p: Pruefung, aufgabe: &Aufgabe, staende: &Knotenstaende) -> Option<Warnung> {
    match p {
        Pruefung::WbsWirkungenGruen => {
            let offen: Vec<(String, String)> = gepruefte_knoten(aufgabe)
                .into_iter()
                .filter_map(|(_, _, s)| match staende.get(&s).unwrap_or(&Knotenstand::Fehlt) {
                    Knotenstand::Status(st) if st == "gruen" => None,
                    Knotenstand::Status(st) => Some((s.clone(), format!("{s} {st}"))),
                    Knotenstand::Fehlt => Some((s.clone(), format!("{s} Knoten fehlt"))),
                    Knotenstand::NichtErreichbar => Some((s.clone(), format!("{s} WBS nicht erreichbar"))),
                })
                .collect();
            (!offen.is_empty()).then(|| Warnung { pruefung: p.name().into(), text: p.text().into(), knoten: offen.iter().map(|(k, _)| k.clone()).collect(), details: offen.into_iter().map(|(_, d)| d).collect() })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::{Spalte, Wirkung};

    fn wirkung(aktion: Aktion, knoten: Option<&str>) -> Wirkung {
        Wirkung { anwendung: "kd".into(), aktion, ausgefuehrt: Default::default(), knoten: knoten.map(Into::into), eltern: None, ebene: None, name: None, fertig_kriterium: None, weitere: vec![] }
    }

    fn aufgabe(wirkungen: Vec<Wirkung>) -> Aufgabe {
        let mut a = Aufgabe::neu(7, "0007-x.md".into(), "X".into());
        a.wirkungen = wirkungen;
        a
    }

    fn staende(liste: &[(&str, Knotenstand)]) -> Knotenstaende {
        liste.iter().map(|(k, s)| (k.to_string(), s.clone())).collect()
    }

    const P: Pruefung = Pruefung::WbsWirkungenGruen;

    #[test]
    fn katalog_kennt_wbs_effects_green() {
        assert_eq!(Pruefung::aus("wbs-effects-green"), Some(P));
        assert_eq!(Pruefung::aus("xyz"), None);
        assert_eq!(P.text(), "Achtung! Es sind nicht alle abhängigen WBS-Einträge grün.");
    }

    #[test]
    fn create_und_rework_auf_nicht_gruenen_knoten_warnen() {
        let a = aufgabe(vec![wirkung(Aktion::Anlegen, Some("I0048")), wirkung(Aktion::Ueberarbeiten, Some("I0012")), wirkung(Aktion::Ueberarbeiten, Some("I0013"))]);
        let s = staende(&[("kd:I0048", Knotenstand::Status("rot".into())), ("kd:I0012", Knotenstand::Status("gruen".into())), ("kd:I0013", Knotenstand::Status("gelb".into()))]);
        let w = pruefen(P, &a, &s).unwrap();
        assert_eq!((w.pruefung.as_str(), w.knoten.clone(), w.details.clone()), ("wbs-effects-green", vec!["kd:I0048".to_string(), "kd:I0013".into()], vec!["kd:I0048 rot".to_string(), "kd:I0013 gelb".into()]));
    }

    #[test]
    fn alle_gruen_remove_und_ohne_wirkungen_sind_erfuellt() {
        let gruen = staende(&[("kd:I0048", Knotenstand::Status("gruen".into()))]);
        assert_eq!(pruefen(P, &aufgabe(vec![wirkung(Aktion::Anlegen, Some("I0048"))]), &gruen), None);
        assert_eq!(pruefen(P, &aufgabe(vec![wirkung(Aktion::Verwerfen, Some("I0049"))]), &Knotenstaende::new()), None, "remove zählt nicht");
        assert_eq!(pruefen(P, &aufgabe(vec![]), &Knotenstaende::new()), None);
        assert_eq!(pruefen(P, &aufgabe(vec![wirkung(Aktion::Anlegen, None)]), &Knotenstaende::new()), None, "ein create ohne Knoten hat noch nichts angelegt");
    }

    #[test]
    fn fehlender_knoten_und_unerreichbare_wbs_sind_nicht_erfuellt_mit_eigenem_text() {
        let a = aufgabe(vec![wirkung(Aktion::Anlegen, Some("I0099")), wirkung(Aktion::Ueberarbeiten, Some("I0001")), wirkung(Aktion::Ueberarbeiten, Some("I0099"))]);
        let s = staende(&[("kd:I0001", Knotenstand::NichtErreichbar)]);
        assert_eq!(pruefen(P, &a, &s).unwrap().details, ["kd:I0099 Knoten fehlt", "kd:I0001 WBS nicht erreichbar"], "doppelt genannter Knoten einmal");
    }

    fn brett(spalten: &[(&str, Option<&str>, &[&str])]) -> Board {
        let spalten = spalten.iter().map(|(n, ph, p)| Spalte { notiz: None, farbe: None, name: n.to_string(), grenze: None, aufgaben: vec![], phase: ph.map(String::from), pruefungen: p.iter().map(|x| x.to_string()).collect() }).collect();
        Board { slug: "b".into(), titel: "B".into(), spalten, termine: vec![], anwendungen: None, start: None, fieber: Default::default(), berichtsfilter: Default::default() }
    }
    const G: &[&str] = &["wbs-effects-green"];

    #[test]
    fn ohne_phasen_nach_rechts_nach_spaltenindex() {
        let b = brett(&[("Zu erledigen", None, &[]), ("Entwicklung", None, G), ("Entwicklertest", None, &["xyz"]), ("Erledigt", None, &[])]);
        assert_eq!(ausgeloest(&b, None, "Entwicklung", "Entwicklertest"), [P]);
        assert_eq!(ausgeloest(&b, None, "Entwicklung", "Erledigt"), [P]);
        assert!(ausgeloest(&b, None, "Entwicklertest", "Entwicklung").is_empty(), "nach links nie");
        assert!(ausgeloest(&b, None, "Entwicklung", "Entwicklung").is_empty(), "umsortieren nie");
        assert!(ausgeloest(&b, None, "Entwicklertest", "Erledigt").is_empty(), "unbekannte Prüfung prüft nichts");
        assert_eq!((links_von(&b, None, "Entwicklertest"), links_von(&b, None, "Entwicklung")), (vec![P], vec![]));
    }

    #[test]
    fn mit_phasen_nach_dem_rang_der_phase() {
        let b = brett(&[("Backlog", None, &[]), ("Entwicklung", Some("Entwicklung"), G), ("Abnahme Stefan", Some("Abnahme"), G), ("Frei", None, &[]), ("Abnahme Mia", Some("Abnahme"), &[]), ("Entwicklertest", Some("Entwicklertest"), &[]), ("Erledigt", None, &[])]);
        let f = Phasenfolge::standard();
        assert_eq!(ausgeloest(&b, Some(&f), "Entwicklung", "Entwicklertest"), [P], "Entwicklertest steht rechts im Rang, auch wenn die Spalte weiter rechts liegt");
        assert!(ausgeloest(&b, Some(&f), "Abnahme Stefan", "Abnahme Mia").is_empty(), "zwei Spalten derselben Phase sind gleich weit");
        assert!(ausgeloest(&b, Some(&f), "Abnahme Stefan", "Entwicklertest").is_empty(), "eine frühere Phase ist links");
        assert_eq!(ausgeloest(&b, Some(&f), "Abnahme Stefan", "Erledigt"), [P]);
        assert!(ausgeloest(&b, Some(&f), "Entwicklung", "Frei").is_empty(), "eine freie Spalte ist in keiner Phase");
        assert_eq!((rang(&b, Some(&f), "Backlog"), rang(&b, Some(&f), "Erledigt"), rang(&b, Some(&f), "Gibt es nicht")), (-1, 3, -1));
        assert_eq!(links_von(&b, Some(&f), "Abnahme Mia"), [P]);
        assert!(links_von(&b, Some(&f), "Backlog").is_empty());
    }

    #[test]
    fn unbekannte_pruefungen_werden_je_spalte_genannt() {
        let spalte = |name: &str, p: &[&str]| Spalte { notiz: None, farbe: None, name: name.into(), grenze: None, aufgaben: vec![], phase: None, pruefungen: p.iter().map(|x| x.to_string()).collect() };
        let b = Board { slug: "b".into(), titel: "B".into(), spalten: vec![spalte("Entwicklung", &["wbs-effects-green", "xyz"]), spalte("Erledigt", &[])], termine: vec![], anwendungen: None, start: None, fieber: Default::default(), berichtsfilter: Default::default() };
        assert_eq!(unbekannte(&b), ["Spalte „Entwicklung“: unbekannte Prüfung „xyz“ — bekannt sind wbs-effects-green"]);
    }
}
