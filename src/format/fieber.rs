//! `berichte/<slug>-fieber.md` — Cache des Projekt-Fever-Charts (R00078): je Abschnitt ein Schlüssel (Projektstart und
//! Berichtsfilter), je Tabellenzeile ein Tag mit erledigt, Umfang und dem prognostizierten Ende je Perzentil.

use super::Formatfehler;
use crate::modell::ist_datum;
use serde::{Deserialize, Serialize};

pub const ORDNER: &str = "berichte";
const KOPF: &str = "| Tag | erledigt | Umfang | P50 7T | P70 7T | P85 7T | P95 7T | P50 5T | P70 5T | P85 5T | P95 5T |\n|---|---|---|---|---|---|---|---|---|---|---|\n";
const LEER: &str = "—";

/// Ein gerechneter Tag; `ende7`/`ende5` je Perzentil 50, 70, 85, 95 in der 7- bzw. 5-Tage-Woche, `None` = keine Aussage.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Fiebertag {
    pub datum: String,
    pub erledigt: u32,
    pub umfang: u32,
    pub ende7: [Option<String>; 4],
    pub ende5: [Option<String>; 4],
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Fieberabschnitt {
    pub schluessel: String,
    pub tage: Vec<Fiebertag>,
}

pub fn pfad(slug: &str) -> String {
    format!("{ORDNER}/{slug}-fieber.md")
}

impl Fiebertag {
    /// Datum und Enden `JJJJ-MM-TT`, erledigt nicht über dem Umfang.
    pub fn pruefen(&self) -> Result<(), String> {
        if !ist_datum(&self.datum) {
            return Err(format!("Tag „{}“ ist nicht JJJJ-MM-TT", self.datum));
        }
        if self.erledigt > self.umfang {
            return Err(format!("{}: erledigt {} liegt über dem Umfang {}", self.datum, self.erledigt, self.umfang));
        }
        if let Some(e) = self.ende7.iter().chain(&self.ende5).flatten().find(|e| !ist_datum(e)) {
            return Err(format!("{}: Ende „{e}“ ist nicht JJJJ-MM-TT", self.datum));
        }
        Ok(())
    }
}

/// Ein Schlüssel ist eine Zeile Text — er wird Überschrift.
pub fn schluessel_pruefen(s: &str) -> Result<(), String> {
    if s.trim().is_empty() || s.contains(['\n', '\r']) || s.len() > 4000 {
        return Err("Der Schlüssel ist eine nicht leere Zeile bis 4000 Zeichen".into());
    }
    Ok(())
}

pub fn lesen(text: &str) -> Result<Vec<Fieberabschnitt>, Formatfehler> {
    let mut abschnitte: Vec<Fieberabschnitt> = vec![];
    for zeile in text.lines() {
        if let Some(s) = zeile.strip_prefix("## ") {
            abschnitte.push(Fieberabschnitt { schluessel: s.trim().to_string(), tage: vec![] });
            continue;
        }
        let Some(rest) = zeile.strip_prefix("| ") else { continue };
        let zellen: Vec<&str> = rest.trim_end_matches('|').split('|').map(str::trim).collect();
        if zellen.first().is_none_or(|z| !ist_datum(z)) {
            continue; // Kopf und Trennzeile
        }
        let Some(a) = abschnitte.last_mut() else { return Err(Formatfehler("Eine Tageszeile steht vor dem ersten Abschnitt".into())) };
        if zellen.len() != 11 {
            return Err(Formatfehler(format!("{}: {} statt 11 Zellen", zellen[0], zellen.len())));
        }
        let zahl = |z: &str| z.parse::<u32>().map_err(|_| Formatfehler(format!("{}: „{z}“ ist keine Zahl", zellen[0])));
        let ende = |z: &str| (z != LEER).then(|| z.to_string());
        let t = Fiebertag {
            datum: zellen[0].into(),
            erledigt: zahl(zellen[1])?,
            umfang: zahl(zellen[2])?,
            ende7: [ende(zellen[3]), ende(zellen[4]), ende(zellen[5]), ende(zellen[6])],
            ende5: [ende(zellen[7]), ende(zellen[8]), ende(zellen[9]), ende(zellen[10])],
        };
        t.pruefen().map_err(Formatfehler)?;
        a.tage.push(t);
    }
    Ok(abschnitte)
}

pub fn schreiben(titel: &str, abschnitte: &[Fieberabschnitt]) -> String {
    let mut s = format!("# Fever Chart — {titel}\n\nCache des Berichts „Projekt-Fever-Chart“: je Abschnitt ein Schlüssel aus Projektstart und Berichtsfilter, je Zeile ein Tag mit dem prognostizierten Ende je Perzentil (7T Kalendertage, 5T Arbeitstage). kanbanD schreibt die Datei; verworfen wird sie im Bericht.\n");
    for a in abschnitte {
        s.push_str(&format!("\n## {}\n\n{KOPF}", a.schluessel));
        for t in &a.tage {
            let enden: Vec<&str> = t.ende7.iter().chain(&t.ende5).map(|e| e.as_deref().unwrap_or(LEER)).collect();
            s.push_str(&format!("| {} | {} | {} | {} |\n", t.datum, t.erledigt, t.umfang, enden.join(" | ")));
        }
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tag(datum: &str, ende: Option<&str>) -> Fiebertag {
        let e = || ende.map(String::from);
        Fiebertag { datum: datum.into(), erledigt: 2, umfang: 5, ende7: [e(), e(), e(), e()], ende5: [e(), None, e(), e()] }
    }

    #[test]
    fn rundlauf_mit_zwei_abschnitten_und_leeren_enden() {
        let a = vec![
            Fieberabschnitt { schluessel: r#"{"start":"2026-09-01","filter":{"zeitraum":"alles"}}"#.into(), tage: vec![tag("2026-09-01", None), tag("2026-09-02", Some("2026-10-05"))] },
            Fieberabschnitt { schluessel: "anders".into(), tage: vec![] },
        ];
        let t = schreiben("Entwicklung", &a);
        assert!(t.contains("| 2026-09-02 | 2 | 5 | 2026-10-05 | 2026-10-05 | 2026-10-05 | 2026-10-05 | 2026-10-05 | — | 2026-10-05 | 2026-10-05 |\n"), "{t}");
        assert_eq!(lesen(&t).unwrap(), a);
        assert_eq!(schreiben("Entwicklung", &lesen(&t).unwrap()), t);
    }

    #[test]
    fn unlesbares_ist_fehler() {
        assert!(lesen("| 2026-09-01 | 1 | 2 |\n").unwrap_err().0.contains("vor dem ersten Abschnitt"));
        assert!(lesen("## k\n| 2026-09-01 | 1 | 2 |\n").unwrap_err().0.contains("11 Zellen"));
        assert!(lesen("## k\n| 2026-09-01 | x | 2 | — | — | — | — | — | — | — | — |\n").unwrap_err().0.contains("keine Zahl"));
        assert!(lesen("## k\n| 2026-09-01 | 3 | 2 | — | — | — | — | — | — | — | — |\n").unwrap_err().0.contains("über dem Umfang"));
        assert!(lesen("## k\n| 2026-09-01 | 1 | 2 | morgen | — | — | — | — | — | — | — |\n").unwrap_err().0.contains("morgen"));
    }
}
