//! Phasen einer Anwendung (Phasen-Datei neben ihrer WBS) und ihre Spalten auf einem Board — rein, ohne Dateizugriff.

use crate::modell::{Anwendung, Board, Spalte};
use serde::Serialize;
use std::path::{Path, PathBuf};

/// Eine Phase der Hauptspur: Name, „Eingebettet in“ (z. B. `im-pair`) und „Gleich wie“ (Name einer früheren Phase); leer heißt nicht gesetzt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Phase {
    pub nr: u32,
    pub name: String,
    pub eingebettet: String,
    pub gleich: String,
}

/// Die Phasen der Hauptspur in der Reihenfolge der Spalte `Nr`; die erste ist die Entwicklung.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Phasenfolge(Vec<Phase>);

/// Spalten der Tabelle `## Phasen` ohne Kopfzeile — Datenmodell der Phasen-Datei (`/planung`).
const STANDARD_KOPF: [&str; 9] = ["Nr", "Phase", "Abschließt", "Nachweis", "Eingebettet in", "Gleich wie", "Spur", "Braucht", "Status"];

fn phase(nr: u32, name: &str) -> Phase {
    Phase { nr, name: name.into(), eingebettet: String::new(), gleich: String::new() }
}

impl Phasenfolge {
    /// Das Standardmodell, wenn eine Anwendung keine Phasen-Datei hat.
    pub fn standard() -> Phasenfolge {
        Phasenfolge(vec![phase(1, "Entwicklung"), phase(2, "Entwicklertest"), phase(3, "Abnahme")])
    }

    /// `Dokumentation/Planung/kanbanD.md` → `Dokumentation/Planung/kanbanD-phasen.md`
    pub fn pfad_neben(wbs: &Path) -> PathBuf {
        let stamm = wbs.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        wbs.with_file_name(format!("{stamm}-phasen.md"))
    }

    /// Liest die Tabelle `## Phasen`: Spalten über die Kopfzeile, nur Hauptspur (Spur leer), ohne `verworfen`, nach `Nr`.
    /// Ohne lesbare Phase gilt das Standardmodell.
    pub fn lesen(text: &str) -> Phasenfolge {
        let mut abschnitt = "";
        let mut kopf: Vec<String> = STANDARD_KOPF.iter().map(|s| s.to_string()).collect();
        let mut phasen = vec![];
        for zeile in text.lines().map(str::trim) {
            if let Some(titel) = zeile.strip_prefix("## ") {
                abschnitt = titel.trim();
                continue;
            }
            if abschnitt != "Phasen" || !zeile.starts_with('|') {
                continue;
            }
            let zellen: Vec<String> = zeile.trim_matches('|').split('|').map(|z| z.trim().to_string()).collect();
            if zellen.first().is_some_and(|z| z == "Nr") {
                kopf = zellen;
                continue;
            }
            let wert = |titel: &str| kopf.iter().position(|k| k == titel).and_then(|i| zellen.get(i)).map(String::as_str).unwrap_or("");
            let Ok(nr) = wert("Nr").parse::<u32>() else { continue };
            if !wert("Spur").is_empty() || wert("Status").eq_ignore_ascii_case("verworfen") || wert("Phase").is_empty() {
                continue;
            }
            phasen.push(Phase { nr, name: wert("Phase").into(), eingebettet: wert("Eingebettet in").into(), gleich: wert("Gleich wie").into() });
        }
        phasen.sort_by_key(|p| p.nr);
        if phasen.is_empty() { Phasenfolge::standard() } else { Phasenfolge(phasen) }
    }

    pub fn alle(&self) -> &[Phase] {
        &self.0
    }

    pub fn namen(&self) -> Vec<&str> {
        self.0.iter().map(|p| p.name.as_str()).collect()
    }

    /// Die Phasen, die eine eigene Spalte brauchen: alle außer „Gleich wie“ einer früheren Phase.
    fn mit_spalte(&self) -> impl Iterator<Item = (usize, &Phase)> {
        self.0.iter().enumerate().filter(|(k, p)| p.gleich.is_empty() || !self.0[..*k].iter().any(|q| q.name == p.gleich))
    }

    /// Gibt jeder Phase ohne Spalte eine: eine freie Spalte gleichen Namens wird ihr zugeordnet, sonst entsteht eine neue
    /// nach der rechtesten Spalte einer früheren Phase (ohne solche vor der Abschlussspalte). Liefert, was ergänzt wurde.
    pub fn nachtragen(&self, board: &mut Board) -> Vec<String> {
        let mut ergaenzt = vec![];
        let abschluss = board.abschlussspalte().map(|s| s.name.clone());
        for (k, p) in self.mit_spalte() {
            if board.spalten.iter().any(|s| s.phase.as_deref() == Some(p.name.as_str())) {
                continue;
            }
            if let Some(frei) = board.spalten.iter_mut().find(|s| s.name == p.name) {
                if frei.phase.is_none() {
                    frei.phase = Some(p.name.clone());
                    ergaenzt.push(format!("{} (zugeordnet)", p.name));
                }
                continue;
            }
            let frueher = |s: &Spalte| s.phase.as_deref().is_some_and(|ph| self.0[..k].iter().any(|q| q.name == ph));
            let vor_abschluss = board.spalten.iter().position(|s| Some(&s.name) == abschluss.as_ref()).unwrap_or(board.spalten.len());
            let stelle = board.spalten.iter().rposition(frueher).map_or(vor_abschluss, |i| (i + 1).min(vor_abschluss));
            board.spalten.insert(stelle, Spalte { name: p.name.clone(), grenze: None, aufgaben: vec![], phase: Some(p.name.clone()) });
            ergaenzt.push(p.name.clone());
        }
        ergaenzt
    }

    fn stelle(&self, phase: &str) -> Option<usize> {
        self.0.iter().position(|p| p.name == phase)
    }

    /// Je Spalte einer späteren Phase, die links einer Spalte einer früheren steht, ein Hinweis; Spalten unbekannter Phasen dazu.
    pub fn reihenfolge_hinweise(&self, board: &Board) -> Vec<String> {
        let mut hinweise = vec![];
        let gebunden: Vec<(&str, Option<usize>)> = board.spalten.iter().filter_map(|s| s.phase.as_deref().map(|p| (s.name.as_str(), self.stelle(p)))).collect();
        for (i, (spalte, stelle)) in gebunden.iter().enumerate() {
            let Some(stelle) = stelle else {
                hinweise.push(format!("Spalte „{spalte}“ nennt eine Phase, die es in der Phasenfolge nicht gibt"));
                continue;
            };
            if let Some((frueher, _)) = gebunden[i + 1..].iter().find(|(_, s)| s.is_some_and(|s| s < *stelle)) {
                hinweise.push(format!("„{spalte}“ ({}) steht links von „{frueher}“ — die Phasenfolge ist {}", self.0[*stelle].name, self.namen().join(" → ")));
            }
        }
        hinweise
    }
}

/// Die Anwendungen, an die ein Board gebunden ist: die genannten, soweit registriert; nennt es keine, gilt bei genau einer
/// registrierten Anwendung diese (R00054, wie `gebundeneAnwendungen` in `web/wbs.js`).
pub fn gebundene_anwendungen<'a>(board: &Board, register: &'a [Anwendung]) -> Vec<&'a Anwendung> {
    if board.anwendungen.is_empty() {
        return if let [einzige] = register { vec![einzige] } else { vec![] };
    }
    board.anwendungen.iter().filter_map(|k| register.iter().find(|a| &a.kuerzel == k)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn board(spalten: &[(&str, Option<&str>)]) -> Board {
        let spalten = spalten.iter().map(|(n, p)| Spalte { name: n.to_string(), grenze: None, aufgaben: vec![], phase: p.map(String::from) }).collect();
        Board { slug: "e".into(), titel: "Entwicklung".into(), spalten, termine: vec![], anwendungen: vec!["kd".into()] }
    }

    fn spalten(b: &Board) -> Vec<(String, Option<String>)> {
        b.spalten.iter().map(|s| (s.name.clone(), s.phase.clone())).collect()
    }

    fn sp(n: &str, p: Option<&str>) -> (String, Option<String>) {
        (n.into(), p.map(String::from))
    }

    #[test]
    fn fehlende_phasen_nach_der_vorphase_vor_der_abschlussspalte() {
        let mut b = board(&[("Backlog", None), ("Nächste Aufgaben", None), ("Entwicklung", None), ("Erledigt", None)]);
        let ergaenzt = Phasenfolge::standard().nachtragen(&mut b);
        assert_eq!(ergaenzt, ["Entwicklung (zugeordnet)", "Entwicklertest", "Abnahme"]);
        assert_eq!(spalten(&b), [sp("Backlog", None), sp("Nächste Aufgaben", None), sp("Entwicklung", Some("Entwicklung")), sp("Entwicklertest", Some("Entwicklertest")), sp("Abnahme", Some("Abnahme")), sp("Erledigt", None)]);
        assert!(Phasenfolge::standard().nachtragen(&mut b).is_empty(), "ein zweites Mal ändert nichts");
    }

    #[test]
    fn gleich_wie_bekommt_keine_spalte() {
        let mut b = board(&[("Entwicklung", Some("Entwicklung")), ("Erledigt", None)]);
        let f = Phasenfolge::lesen("## Phasen\n| Nr | Phase | Gleich wie |\n|---|---|---|\n| 1 | Entwicklung | |\n| 2 | Entwicklertest | |\n| 3 | Abnahme | Entwicklertest |\n");
        assert_eq!(f.nachtragen(&mut b), ["Entwicklertest"]);
        assert!(!b.spalten.iter().any(|s| s.name == "Abnahme"));
    }

    #[test]
    fn zwei_spalten_derselben_phase_genuegen_und_rechts_davon_kommt_die_naechste() {
        let mut b = board(&[("Entwicklung", None), ("Abnahme Stefan", Some("Abnahme")), ("Abnahme Mia", Some("Abnahme")), ("Erledigt", None)]);
        let f = Phasenfolge::lesen("## Phasen\n| Nr | Phase |\n|---|---|\n| 1 | Entwicklung |\n| 2 | Abnahme |\n| 3 | Beta |\n");
        assert_eq!(f.nachtragen(&mut b), ["Entwicklung (zugeordnet)", "Beta"]);
        assert_eq!(b.spalten.iter().map(|s| s.name.as_str()).collect::<Vec<_>>(), ["Entwicklung", "Abnahme Stefan", "Abnahme Mia", "Beta", "Erledigt"]);
    }

    #[test]
    fn ohne_spalte_einer_vorphase_vor_der_abschlussspalte_und_belegte_namen_bleiben_frei() {
        let mut b = board(&[("Zu erledigen", None), ("In Arbeit", None), ("Erledigt", None)]);
        Phasenfolge::standard().nachtragen(&mut b);
        assert_eq!(b.spalten.iter().map(|s| s.name.as_str()).collect::<Vec<_>>(), ["Zu erledigen", "In Arbeit", "Entwicklung", "Entwicklertest", "Abnahme", "Erledigt"]);
        let mut leer = board(&[]);
        Phasenfolge::standard().nachtragen(&mut leer);
        assert_eq!(leer.spalten.iter().map(|s| s.name.as_str()).collect::<Vec<_>>(), ["Entwicklung", "Entwicklertest", "Abnahme"], "ohne Spalten keine Abschlussspalte");
        let mut belegt = board(&[("Abnahme", Some("Entwicklung")), ("Erledigt", None)]);
        assert_eq!(Phasenfolge::standard().nachtragen(&mut belegt), ["Entwicklertest"], "der Name Abnahme ist schon eine Spalte einer anderen Phase");
    }

    const DATEI: &str = "---\napplication: X\n---\n\n# Phasen — X\n\n## Phasen\n\n| Nr | Phase | Abschließt | Nachweis | Eingebettet in | Gleich wie | Spur | Braucht | Status |\n|---|---|---|---|---|---|---|---|---|\n| 1 | Entwicklung | Subagent | — | | | | | |\n| 3 | Abnahme | Auftraggeber | akzeptanzkriterien | | Entwicklertest | | | |\n| 2 | Entwicklertest | Entwickler | user-story | im-pair | | | | |\n| 4 | Beta | Kunde | frei | | | | | verworfen |\n| 5 | Code-Review | Entwickler | review-im-pair | | | technik | | |\n\n## Durchläufe\n\n| Arbeitspaket | Phase | Datum | Ergebnis | Wer | Beleg |\n|---|---|---|---|---|---|\n| 3 | Abnahme | 2026-01-01 | bestanden | S | x |\n";

    #[test]
    fn hauptspur_nach_nr_ohne_verworfene_und_nebenspuren() {
        let f = Phasenfolge::lesen(DATEI);
        assert_eq!(f.namen(), ["Entwicklung", "Entwicklertest", "Abnahme"]);
        assert_eq!((f.alle()[1].eingebettet.as_str(), f.alle()[2].gleich.as_str()), ("im-pair", "Entwicklertest"));
        assert_eq!(f.alle()[0].eingebettet, "", "leere Zellen bleiben leer");
    }

    #[test]
    fn spalten_ueber_die_kopfzeile_zugeordnet() {
        let t = "## Phasen\n\n| Nr | Status | Gleich wie | Phase |\n|---|---|---|---|\n| 1 | | | Entwicklung |\n| 2 | verworfen | | Alt |\n| 3 | | Entwicklung | Review |\n";
        let f = Phasenfolge::lesen(t);
        assert_eq!(f.namen(), ["Entwicklung", "Review"]);
        assert_eq!(f.alle()[1].gleich, "Entwicklung");
        assert_eq!(f.alle()[1].eingebettet, "", "fehlende Spalte heißt leer");
    }

    #[test]
    fn ohne_kopfzeile_gilt_die_reihenfolge_des_datenmodells() {
        let f = Phasenfolge::lesen("## Phasen\n| 1 | Entwicklung | x | — | | | | | |\n| 2 | Test | x | frei | im-pair | | | | |\n");
        assert_eq!(f.namen(), ["Entwicklung", "Test"]);
        assert_eq!(f.alle()[1].eingebettet, "im-pair");
    }

    #[test]
    fn ohne_lesbare_phase_das_standardmodell() {
        assert_eq!(Phasenfolge::lesen(""), Phasenfolge::standard());
        assert_eq!(Phasenfolge::lesen("## Durchläufe\n| 1 | Entwicklung |\n"), Phasenfolge::standard(), "Tabelle in einem anderen Abschnitt");
        assert_eq!(Phasenfolge::standard().namen(), ["Entwicklung", "Entwicklertest", "Abnahme"]);
    }

    #[test]
    fn spalte_einer_spaeteren_phase_links_einer_frueheren_gibt_einen_hinweis() {
        let f = Phasenfolge::standard();
        assert!(f.reihenfolge_hinweise(&board(&[("E", Some("Entwicklung")), ("T", Some("Entwicklertest")), ("A1", Some("Abnahme")), ("A2", Some("Abnahme")), ("Frei", None)])).is_empty());
        let falsch = f.reihenfolge_hinweise(&board(&[("Abnahme", Some("Abnahme")), ("E", Some("Entwicklung")), ("T", Some("Entwicklertest"))]));
        assert_eq!(falsch, ["„Abnahme“ (Abnahme) steht links von „E“ — die Phasenfolge ist Entwicklung → Entwicklertest → Abnahme"]);
        assert_eq!(f.reihenfolge_hinweise(&board(&[("X", Some("Beta"))])), ["Spalte „X“ nennt eine Phase, die es in der Phasenfolge nicht gibt"]);
    }

    #[test]
    fn gebunden_sind_die_genannten_registrierten_oder_die_einzige() {
        let a = |k: &str| Anwendung { kuerzel: k.into(), name: k.into(), wbs: String::new(), anforderungen: String::new() };
        let register = [a("kc"), a("kd")];
        let mut b = board(&[]);
        b.anwendungen = vec!["kd".into(), "xx".into()];
        assert_eq!(gebundene_anwendungen(&b, &register).iter().map(|a| a.kuerzel.as_str()).collect::<Vec<_>>(), ["kd"]);
        b.anwendungen = vec![];
        assert!(gebundene_anwendungen(&b, &register).is_empty(), "zwei registriert, keine genannt");
        assert_eq!(gebundene_anwendungen(&b, &register[..1])[0].kuerzel, "kc");
    }

    #[test]
    fn pfad_der_phasen_datei_neben_der_wbs() {
        assert_eq!(Phasenfolge::pfad_neben(Path::new("/a/Planung/kanbanD.md")), PathBuf::from("/a/Planung/kanbanD-phasen.md"));
    }
}
