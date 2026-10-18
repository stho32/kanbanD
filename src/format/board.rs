//! `boards/<slug>.md` — Titel, Spalten als Überschriften, je Aufgabe eine Zeile.

use super::{Formatfehler, frontmatter, yaml};
use crate::modell::{Board, Linie, Spalte, Staerke, Termin};
use serde_yaml::Value;

pub const ORDNER: &str = "boards";

/// Liest eine Board-Datei. Aufgabenzeilen sind Listenpunkte mit `#<nr>`; alles andere wird übergangen.
pub fn lesen(slug: &str, text: &str) -> Result<Board, Formatfehler> {
    let (y, koerper) = frontmatter::trennen(text)?;
    let m = yaml::lesen(y)?;
    let grenzen = yaml::zuordnung(&m, "limits");
    let termine = termine_lesen(m.get("milestones"))?;
    let mut titel = None;
    let mut spalten: Vec<Spalte> = vec![];
    for zeile in koerper.lines() {
        let z = zeile.trim_end();
        if let Some(t) = z.strip_prefix("# ") {
            titel.get_or_insert_with(|| t.trim().to_string());
        } else if let Some(name) = z.strip_prefix("## ") {
            let name = name.trim().to_string();
            if spalten.iter().any(|s| s.name == name) {
                return Err(Formatfehler(format!("Spalte „{name}“ steht doppelt in der Board-Datei")));
            }
            let grenze = grenzen.and_then(|g| g.get(name.as_str())).and_then(|v| v.as_u64()).map(|v| v as u32);
            spalten.push(Spalte { name, grenze, aufgaben: vec![] });
        } else if let Some(nr) = aufgabennummer(z) {
            let Some(spalte) = spalten.last_mut() else {
                return Err(Formatfehler(format!("Aufgabe #{nr} steht vor der ersten Spalte")));
            };
            spalte.aufgaben.push(nr);
        }
    }
    Ok(Board { slug: slug.to_string(), titel: titel.unwrap_or_else(|| slug.to_string()), spalten, termine })
}

const LINIEN: [(&str, Linie); 3] = [("solid", Linie::Durchgehend), ("dashed", Linie::Gestrichelt), ("dotted", Linie::Gepunktet)];
const STAERKEN: [(&str, Staerke); 3] = [("thin", Staerke::Fein), ("normal", Staerke::Normal), ("bold", Staerke::Fett)];

/// `milestones:` — Liste von `{name, date, color, line, width}`; ein unlesbarer Termin ist ein Fehler, kein stiller Verlust.
fn termine_lesen(v: Option<&Value>) -> Result<Vec<Termin>, Formatfehler> {
    let Some(v) = v else { return Ok(vec![]) };
    let Value::Sequence(liste) = v else { return Err(Formatfehler("milestones ist keine Liste".into())) };
    liste
        .iter()
        .map(|e| {
            let m = e.as_mapping().ok_or_else(|| Formatfehler("Ein Eintrag unter milestones ist keine Zuordnung".into()))?;
            let wahl = |schluessel: &str| yaml::text(m, schluessel);
            let linie = match wahl("line") {
                None => Linie::default(),
                Some(l) => LINIEN.iter().find(|(k, _)| *k == l).map(|(_, x)| *x).ok_or_else(|| Formatfehler(format!("milestones: line „{l}“ ist nicht solid, dashed oder dotted")))?,
            };
            let staerke = match wahl("width") {
                None => Staerke::default(),
                Some(w) => STAERKEN.iter().find(|(k, _)| *k == w).map(|(_, x)| *x).ok_or_else(|| Formatfehler(format!("milestones: width „{w}“ ist nicht thin, normal oder bold")))?,
            };
            let t = Termin { name: wahl("name").unwrap_or_default(), datum: wahl("date").unwrap_or_default(), farbe: wahl("color").unwrap_or_else(|| "red".into()), linie, staerke };
            t.pruefen().map_err(|f| Formatfehler(format!("milestones: {f}")))?;
            Ok(t)
        })
        .collect()
}

fn termin_zeile(t: &Termin) -> String {
    let linie = LINIEN.iter().find(|(_, x)| *x == t.linie).map(|(k, _)| *k).unwrap_or("solid");
    let staerke = STAERKEN.iter().find(|(_, x)| *x == t.staerke).map(|(k, _)| *k).unwrap_or("normal");
    format!("  - {{name: {}, date: {}, color: {}, line: {linie}, width: {staerke}}}\n", yaml::skalar(&t.name), t.datum, yaml::skalar(&t.farbe))
}

/// `- [#12](…)`, `- #12 Text`, `* #12` → 12
fn aufgabennummer(zeile: &str) -> Option<u32> {
    let rest = zeile.trim_start().strip_prefix("- ").or_else(|| zeile.trim_start().strip_prefix("* "))?;
    let rest = rest.trim_start().strip_prefix('[').unwrap_or(rest.trim_start());
    let ziffern: String = rest.strip_prefix('#')?.chars().take_while(char::is_ascii_digit).collect();
    ziffern.parse().ok()
}

/// Schreibt die Board-Datei. `datei` nennt je Nummer den Dateinamen der Aufgabe (ohne Ordner), falls bekannt.
pub fn schreiben(b: &Board, datei: impl Fn(u32) -> Option<String>) -> String {
    let mut s = String::new();
    let grenzen: Vec<&Spalte> = b.spalten.iter().filter(|sp| sp.grenze.is_some()).collect();
    if !grenzen.is_empty() || !b.termine.is_empty() {
        s.push_str("---\n");
        if !grenzen.is_empty() {
            s.push_str("limits:\n");
            for sp in grenzen {
                s.push_str(&format!("  {}: {}\n", yaml::skalar(&sp.name), sp.grenze.unwrap_or_default()));
            }
        }
        if !b.termine.is_empty() {
            s.push_str("milestones:\n");
            for t in &b.termine {
                s.push_str(&termin_zeile(t));
            }
        }
        s.push_str("---\n\n");
    }
    s.push_str(&format!("# {}\n", b.titel));
    for sp in &b.spalten {
        s.push_str(&format!("\n## {}\n", sp.name));
        if !sp.aufgaben.is_empty() {
            s.push('\n');
        }
        for nr in &sp.aufgaben {
            match datei(*nr) {
                Some(d) => s.push_str(&format!("- [#{nr}](../aufgaben/{d})\n")),
                None => s.push_str(&format!("- #{nr}\n")),
            }
        }
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn beispiel() -> Board {
        Board {
            slug: "entwicklung".into(),
            titel: "Entwicklung".into(),
            spalten: vec![
                Spalte { name: "Zu erledigen".into(), grenze: None, aufgaben: vec![1, 2] },
                Spalte { name: "In Arbeit".into(), grenze: Some(3), aufgaben: vec![3] },
                Spalte { name: "Erledigt".into(), grenze: None, aufgaben: vec![] },
            ],
            termine: vec![],
        }
    }

    fn datei(nr: u32) -> Option<String> {
        (nr != 2).then(|| format!("{nr:04}-x.md"))
    }

    #[test]
    fn eine_zeile_je_aufgabe_unter_ihrer_spalte() {
        let t = schreiben(&beispiel(), datei);
        assert_eq!(
            t,
            "---\nlimits:\n  In Arbeit: 3\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-x.md)\n- #2\n\n## In Arbeit\n\n- [#3](../aufgaben/0003-x.md)\n\n## Erledigt\n"
        );
        assert_eq!(t.matches("#3").count(), 1);
    }

    #[test]
    fn rundlauf_ist_stabil() {
        let b = beispiel();
        let t = schreiben(&b, datei);
        assert_eq!(lesen("entwicklung", &t).unwrap(), b);
        assert_eq!(schreiben(&lesen("entwicklung", &t).unwrap(), datei), t);
    }

    #[test]
    fn handgeschriebene_zeilen_werden_gelesen_und_fremdes_uebergangen() {
        let b = lesen("x", "# X\n\nText dazwischen\n## A\n- #7 irgendein Text\n* [#8] Titel\n- keine Nummer\n- [ ] #9 Checkbox ist keine Aufgabenzeile\n").unwrap();
        assert_eq!(b.spalten[0].aufgaben, vec![7, 8]);
        assert_eq!(b.titel, "X");
        assert_eq!(lesen("ohne-titel", "## A\n").unwrap().titel, "ohne-titel");
    }

    #[test]
    fn termine_im_frontmatter_rundlauf() {
        let mut b = beispiel();
        b.termine = vec![
            Termin { name: "Deadline".into(), datum: "2027-10-31".into(), farbe: "red".into(), linie: Linie::Durchgehend, staerke: Staerke::Fett },
            Termin { name: "Review: Kunde".into(), datum: "2026-11-15".into(), farbe: "#2a78d6".into(), linie: Linie::Gestrichelt, staerke: Staerke::Fein },
        ];
        let t = schreiben(&b, datei);
        assert!(t.starts_with("---\nlimits:\n  In Arbeit: 3\nmilestones:\n  - {name: Deadline, date: 2027-10-31, color: red, line: solid, width: bold}\n  - {name: \"Review: Kunde\", date: 2026-11-15, color: \"#2a78d6\", line: dashed, width: thin}\n---\n\n# Entwicklung\n"), "{t}");
        assert_eq!(lesen("entwicklung", &t).unwrap(), b);
        assert_eq!(schreiben(&lesen("entwicklung", &t).unwrap(), datei), t);
        let ohne_grenzen = "---\nmilestones:\n  - {name: X, date: 2026-12-01}\n---\n\n# B\n\n## A\n";
        let g = lesen("b", ohne_grenzen).unwrap();
        assert_eq!((g.termine[0].farbe.as_str(), g.termine[0].linie, g.termine[0].staerke), ("red", Linie::Durchgehend, Staerke::Normal));
    }

    #[test]
    fn unlesbare_termine_sind_fehler() {
        let mit = |zeile: &str| lesen("b", &format!("---\nmilestones:\n  - {zeile}\n---\n## A\n"));
        assert!(mit("{name: X, date: 31.10.2027}").unwrap_err().0.contains("JJJJ-MM-TT"));
        assert!(mit("{name: X, date: 2027-10-31, line: wavy}").unwrap_err().0.contains("wavy"));
        assert!(mit("{name: X, date: 2027-10-31, width: fat}").unwrap_err().0.contains("fat"));
        assert!(mit("{date: 2027-10-31}").unwrap_err().0.contains("Namen"));
        assert!(mit("{name: X, date: 2027-10-31, color: \"#xyz\"}").unwrap_err().0.contains("Farbe"));
        assert!(mit("nur Text").unwrap_err().0.contains("keine Zuordnung"));
        assert!(lesen("b", "---\nmilestones: 3\n---\n## A\n").unwrap_err().0.contains("keine Liste"));
    }

    #[test]
    fn aufgabe_vor_der_ersten_spalte_und_doppelte_spalte_sind_fehler() {
        assert!(lesen("x", "# X\n- #1\n## A\n").unwrap_err().0.contains("vor der ersten Spalte"));
        assert!(lesen("x", "## A\n## A\n").unwrap_err().0.contains("doppelt"));
    }
}
