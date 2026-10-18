//! Verlauf eines Boards aus seinen Ständen — rein, ohne Git.

use crate::modell::Board;
use chrono::{NaiveDate, NaiveDateTime};
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Tag {
    pub datum: String,
    pub offen: usize,
    pub umfang: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Durchlauf {
    pub nummer: u32,
    pub eintritt: String,
    pub abschluss: String,
    pub tage: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Verlauf {
    pub tage: Vec<Tag>,
    pub durchlauf: Vec<Durchlauf>,
    pub mittel: Option<f64>,
    pub median: Option<f64>,
}

/// Ein Spaltenwechsel; `spalte: None` heißt vom Board genommen.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Wechsel {
    pub zeitpunkt: String,
    pub spalte: Option<String>,
}

/// Je Aufgabe die Wechsel; dazu, was die Rechnung je Phase braucht: Labels (`im-pair` für „Eingebettet in“) und `phases.skipped`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Bewegung {
    pub nummer: u32,
    pub wechsel: Vec<Wechsel>,
    pub labels: Vec<String>,
    pub uebersprungen: Vec<String>,
}

/// Welche Phasen ein gebundenes Board hat und welche Spalte welche darstellt (`column-phases`, N:1).
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Phasenkarte {
    pub anwendung: String,
    pub folge: crate::phasen::Phasenfolge,
    pub spaltenphasen: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Bewegungen {
    pub spalten: Vec<String>,
    pub jetzt: String,
    pub aufgaben: Vec<Bewegung>,
    /// `None` bei einem reinen Kanban — dann rechnen die Berichte je Spalte
    pub phasen: Option<Phasenkarte>,
}

/// Je Aufgabe die Wechsel zwischen aufeinanderfolgenden Ständen; `staende` in zeitlicher Folge.
pub fn bewegungen(staende: &[(NaiveDateTime, Board)], spalten: Vec<String>, jetzt: NaiveDateTime) -> Bewegungen {
    let fmt = |z: &NaiveDateTime| z.format(crate::format::aufgabe::ZEITFORMAT).to_string();
    let mut vorher: BTreeMap<u32, String> = BTreeMap::new();
    let mut je: BTreeMap<u32, Vec<Wechsel>> = BTreeMap::new();
    for (zp, b) in staende {
        let mut jetzt_da: BTreeMap<u32, String> = BTreeMap::new();
        for s in &b.spalten {
            for n in &s.aufgaben {
                jetzt_da.entry(*n).or_insert_with(|| s.name.clone());
            }
        }
        for (n, sp) in &jetzt_da {
            if vorher.get(n) != Some(sp) {
                je.entry(*n).or_default().push(Wechsel { zeitpunkt: fmt(zp), spalte: Some(sp.clone()) });
            }
        }
        for n in vorher.keys().filter(|n| !jetzt_da.contains_key(n)) {
            je.entry(*n).or_default().push(Wechsel { zeitpunkt: fmt(zp), spalte: None });
        }
        vorher = jetzt_da;
    }
    let aufgaben = je.into_iter().map(|(nummer, wechsel)| Bewegung { nummer, wechsel, labels: vec![], uebersprungen: vec![] }).collect();
    Bewegungen { spalten, jetzt: fmt(&jetzt), aufgaben, phasen: None }
}

fn zaehlen(b: &Board) -> (usize, usize) {
    let umfang: usize = b.spalten.iter().map(|s| s.aufgaben.len()).sum();
    let fertig = b.abschlussspalte().map(|s| s.aufgaben.len()).unwrap_or(0);
    (umfang - fertig, umfang)
}

fn runden(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

/// `staende` in zeitlicher Folge. Je Tag gilt der letzte Stand bis Tagesende, Tage ohne Stand übernehmen den Vortag.
pub fn verlauf(staende: &[(NaiveDateTime, Board)], heute: NaiveDate) -> Verlauf {
    let mut je_tag: BTreeMap<NaiveDate, &Board> = BTreeMap::new();
    let mut eintritt: BTreeMap<u32, NaiveDateTime> = BTreeMap::new();
    let mut abschluss: BTreeMap<u32, NaiveDateTime> = BTreeMap::new();
    for (zp, b) in staende {
        je_tag.insert(zp.date(), b);
        let fertig = b.abschlussspalte().map(|s| s.aufgaben.clone()).unwrap_or_default();
        for s in &b.spalten {
            for n in &s.aufgaben {
                eintritt.entry(*n).or_insert(*zp);
                if fertig.contains(n) {
                    abschluss.entry(*n).or_insert(*zp);
                }
            }
        }
    }
    let mut tage = vec![];
    if let Some((&erster, _)) = je_tag.iter().next() {
        let mut stand = None;
        let mut d = erster;
        while d <= heute.max(erster) {
            if let Some(b) = je_tag.get(&d) {
                stand = Some(*b);
            }
            let (offen, umfang) = stand.map(zaehlen).unwrap_or((0, 0));
            tage.push(Tag { datum: d.format("%Y-%m-%d").to_string(), offen, umfang });
            d = d.succ_opt().expect("Datum im Bereich");
        }
    }
    let fmt = |z: &NaiveDateTime| z.format(crate::format::aufgabe::ZEITFORMAT).to_string();
    let mut durchlauf: Vec<Durchlauf> = abschluss
        .iter()
        .map(|(n, a)| {
            let e = eintritt[n];
            Durchlauf { nummer: *n, eintritt: fmt(&e), abschluss: fmt(a), tage: runden((*a - e).num_minutes() as f64 / 1440.0) }
        })
        .collect();
    durchlauf.sort_by(|a, b| b.abschluss.cmp(&a.abschluss).then(a.nummer.cmp(&b.nummer)));
    let mut werte: Vec<f64> = durchlauf.iter().map(|d| d.tage).collect();
    werte.sort_by(|a, b| a.partial_cmp(b).expect("keine NaN"));
    let mittel = (!werte.is_empty()).then(|| runden(werte.iter().sum::<f64>() / werte.len() as f64));
    let median = (!werte.is_empty()).then(|| {
        let m = werte.len() / 2;
        runden(if werte.len().is_multiple_of(2) { (werte[m - 1] + werte[m]) / 2.0 } else { werte[m] })
    });
    Verlauf { tage, durchlauf, mittel, median }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::Spalte;

    fn b(a: &[u32], z: &[u32]) -> Board {
        Board { slug: "b".into(), titel: "B".into(), spalten: vec![Spalte { name: "A".into(), grenze: None, aufgaben: a.to_vec(), phase: None, pruefungen: vec![] }, Spalte { name: "Z".into(), grenze: None, aufgaben: z.to_vec(), phase: None, pruefungen: vec![] }], termine: vec![], anwendungen: vec![] }
    }

    fn zp(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M").unwrap()
    }

    #[test]
    fn offen_umfang_und_durchlauf() {
        let staende = vec![(zp("2026-10-01 09:00"), b(&[1, 2], &[])), (zp("2026-10-02 09:00"), b(&[2], &[1])), (zp("2026-10-04 09:00"), b(&[], &[1, 2]))];
        let v = verlauf(&staende, NaiveDate::from_ymd_opt(2026, 10, 4).unwrap());
        assert_eq!(v.tage.iter().map(|t| t.offen).collect::<Vec<_>>(), vec![2, 1, 1, 0]);
        assert_eq!(v.tage.iter().map(|t| t.umfang).collect::<Vec<_>>(), vec![2, 2, 2, 2]);
        assert_eq!(v.tage[2].datum, "2026-10-03");
        assert_eq!(v.durchlauf.iter().map(|d| (d.nummer, d.tage)).collect::<Vec<_>>(), vec![(2, 3.0), (1, 1.0)]);
        assert_eq!((v.mittel, v.median), (Some(2.0), Some(2.0)));
    }

    #[test]
    fn rueckkehr_aendert_die_erste_abschlusszeit_nicht_und_mehrere_staende_am_tag() {
        let staende = vec![
            (zp("2026-10-01 09:00"), b(&[1], &[])),
            (zp("2026-10-02 09:00"), b(&[], &[1])),
            (zp("2026-10-03 09:00"), b(&[1], &[])),
            (zp("2026-10-03 17:00"), b(&[], &[1])),
        ];
        let v = verlauf(&staende, NaiveDate::from_ymd_opt(2026, 10, 5).unwrap());
        assert_eq!(v.durchlauf[0].tage, 1.0);
        assert_eq!(v.tage.iter().map(|t| t.offen).collect::<Vec<_>>(), vec![1, 0, 0, 0, 0]);
        assert_eq!((v.mittel, v.median), (Some(1.0), Some(1.0)));
    }

    #[test]
    fn wechsel_je_aufgabe_mit_abnehmen() {
        let staende = vec![(zp("2026-10-01 09:00"), b(&[1, 2], &[])), (zp("2026-10-01 10:00"), b(&[1, 2], &[])), (zp("2026-10-02 09:00"), b(&[2], &[1])), (zp("2026-10-04 09:00"), b(&[], &[2]))];
        let w = bewegungen(&staende, vec!["A".into(), "Z".into()], zp("2026-10-05 08:00"));
        let kurz = |i: usize| w.aufgaben[i].wechsel.iter().map(|x| (x.zeitpunkt.as_str(), x.spalte.as_deref())).collect::<Vec<_>>();
        assert_eq!(w.aufgaben[0].nummer, 1);
        assert_eq!(kurz(0), vec![("2026-10-01 09:00", Some("A")), ("2026-10-02 09:00", Some("Z")), ("2026-10-04 09:00", None)]);
        assert_eq!(kurz(1), vec![("2026-10-01 09:00", Some("A")), ("2026-10-04 09:00", Some("Z"))]);
        assert_eq!((w.spalten.len(), w.jetzt.as_str()), (2, "2026-10-05 08:00"));
    }

    #[test]
    fn ohne_staende_und_gerader_median() {
        let v = verlauf(&[], NaiveDate::from_ymd_opt(2026, 10, 5).unwrap());
        assert!(v.tage.is_empty() && v.mittel.is_none() && v.median.is_none());
        let staende = vec![(zp("2026-10-01 00:00"), b(&[1, 2, 3, 4], &[])), (zp("2026-10-02 00:00"), b(&[3, 4], &[1, 2])), (zp("2026-10-05 00:00"), b(&[], &[1, 2, 3, 4]))];
        let v = verlauf(&staende, NaiveDate::from_ymd_opt(2026, 10, 5).unwrap());
        assert_eq!(v.median, Some(2.5));
        assert_eq!(v.mittel, Some(2.5));
    }
}
