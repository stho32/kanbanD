//! `boards/<slug>.md` — Titel, Spalten als Überschriften, je Aufgabe eine Zeile.

use super::{Formatfehler, frontmatter, yaml};
use crate::modell::{Board, Spalte};

pub const ORDNER: &str = "boards";

/// Liest eine Board-Datei. Aufgabenzeilen sind Listenpunkte mit `#<nr>`; alles andere wird übergangen.
pub fn lesen(slug: &str, text: &str) -> Result<Board, Formatfehler> {
    let (y, koerper) = frontmatter::trennen(text)?;
    let m = yaml::lesen(y)?;
    let grenzen = yaml::zuordnung(&m, "limits");
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
    Ok(Board { slug: slug.to_string(), titel: titel.unwrap_or_else(|| slug.to_string()), spalten })
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
    if !grenzen.is_empty() {
        s.push_str("---\nlimits:\n");
        for sp in grenzen {
            s.push_str(&format!("  {}: {}\n", yaml::skalar(&sp.name), sp.grenze.unwrap_or_default()));
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
    fn aufgabe_vor_der_ersten_spalte_und_doppelte_spalte_sind_fehler() {
        assert!(lesen("x", "# X\n- #1\n## A\n").unwrap_err().0.contains("vor der ersten Spalte"));
        assert!(lesen("x", "## A\n## A\n").unwrap_err().0.contains("doppelt"));
    }
}
