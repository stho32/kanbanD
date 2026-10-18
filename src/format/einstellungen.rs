//! `kanbanD.md` — Personen, Klassen und Quellpfade des Ordners.

use super::{Formatfehler, frontmatter, yaml};
use crate::modell::{Art, Einstellungen, Klasse, Person, Quellen};

pub const DATEI: &str = "kanbanD.md";

pub fn lesen(text: &str) -> Result<Einstellungen, Formatfehler> {
    let (y, _) = frontmatter::trennen(text)?;
    let m = yaml::lesen(y)?;
    let mut e = Einstellungen::default();
    if let Some(people) = yaml::zuordnung(&m, "people") {
        for (k, v) in people {
            let kuerzel = yaml::wert_als_text(k).ok_or_else(|| Formatfehler("Kürzel unter people ist kein Text".into()))?;
            let p = v.as_mapping().ok_or_else(|| Formatfehler(format!("people.{kuerzel} ist keine Zuordnung")))?;
            let art = match yaml::text(p, "kind").as_deref() {
                Some("agent") => Art::Agent,
                Some("human") | None => Art::Mensch,
                Some(x) => return Err(Formatfehler(format!("people.{kuerzel}.kind „{x}“ ist weder human noch agent"))),
            };
            let aktiv = !matches!(p.get("active"), Some(serde_yaml::Value::Bool(false)));
            e.personen.push(Person { name: yaml::text(p, "name").unwrap_or_else(|| kuerzel.clone()), kuerzel, art, aktiv });
        }
    }
    if let Some(classes) = yaml::zuordnung(&m, "classes") {
        for (k, v) in classes {
            let schluessel = yaml::wert_als_text(k).ok_or_else(|| Formatfehler("Schlüssel unter classes ist kein Text".into()))?;
            let c = v.as_mapping().ok_or_else(|| Formatfehler(format!("classes.{schluessel} ist keine Zuordnung")))?;
            e.klassen.push(Klasse {
                bezeichnung: yaml::text(c, "label").unwrap_or_else(|| schluessel.clone()),
                farbe: yaml::text(c, "color").unwrap_or_else(|| "grey".into()),
                schluessel,
            });
        }
    }
    if let Some(s) = yaml::zuordnung(&m, "sources") {
        e.quellen = Quellen { wbs: yaml::text(s, "wbs").unwrap_or_default(), anforderungen: yaml::text(s, "requirements").unwrap_or_default() };
    }
    Ok(e)
}

pub fn schreiben(e: &Einstellungen) -> String {
    let mut s = String::from("---\npeople:");
    if e.personen.is_empty() {
        s.push_str(" {}");
    }
    for p in &e.personen {
        let art = if p.art == Art::Agent { "agent" } else { "human" };
        let aktiv = if p.aktiv { "" } else { ", active: false" };
        s.push_str(&format!("\n  {}: {{name: {}, kind: {art}{aktiv}}}", yaml::skalar(&p.kuerzel), yaml::skalar(&p.name)));
    }
    s.push_str("\nclasses:");
    if e.klassen.is_empty() {
        s.push_str(" {}");
    }
    for k in &e.klassen {
        s.push_str(&format!("\n  {}: {{label: {}, color: {}}}", yaml::skalar(&k.schluessel), yaml::skalar(&k.bezeichnung), yaml::skalar(&k.farbe)));
    }
    s.push_str(&format!(
        "\nsources:\n  wbs: {}\n  requirements: {}\n---\n\n# kanbanD\n\nEinstellungen dieses Ordners: Personen (`people`), Klassen (`classes`) und Quellpfade (`sources`).\nPersonen werden stillgelegt (`active: false`), nicht entfernt.\n",
        yaml::skalar(&e.quellen.wbs),
        yaml::skalar(&e.quellen.anforderungen)
    ));
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn beispiel() -> Einstellungen {
        Einstellungen {
            personen: vec![
                Person { kuerzel: "st".into(), name: "Stefan Hoffmann".into(), art: Art::Mensch, aktiv: true },
                Person { kuerzel: "cl".into(), name: "Claude".into(), art: Art::Agent, aktiv: true },
                Person { kuerzel: "ab".into(), name: "Anna: Gast".into(), art: Art::Mensch, aktiv: false },
            ],
            klassen: vec![Klasse { schluessel: "bug".into(), bezeichnung: "Fehler".into(), farbe: "#b04a8c".into() }],
            quellen: Quellen { wbs: "Dokumentation/Planung/kanbanD.md".into(), anforderungen: "".into() },
        }
    }

    #[test]
    fn rundlauf_objekt_text_objekt() {
        let e = beispiel();
        assert_eq!(lesen(&schreiben(&e)).unwrap(), e);
    }

    #[test]
    fn rundlauf_text_objekt_text_ist_stabil() {
        let t = schreiben(&beispiel());
        assert_eq!(schreiben(&lesen(&t).unwrap()), t);
        assert!(t.contains("  st: {name: Stefan Hoffmann, kind: human}\n  cl: {name: Claude, kind: agent}\n"));
        assert!(t.contains("ab: {name: \"Anna: Gast\", kind: human, active: false}"));
    }

    #[test]
    fn leere_einstellungen_und_fehlende_felder() {
        let leer = Einstellungen::default();
        assert_eq!(lesen(&schreiben(&leer)).unwrap(), leer);
        let e = lesen("---\npeople:\n  x: {}\nclasses:\n  c: {}\n---\n").unwrap();
        assert_eq!(e.personen[0].name, "x");
        assert_eq!(e.personen[0].art, Art::Mensch);
        assert_eq!(e.klassen[0].farbe, "grey");
        assert_eq!(lesen("# nur Text").unwrap(), Einstellungen::default());
    }

    #[test]
    fn falsche_art_und_falsche_struktur_sind_fehler() {
        assert!(lesen("---\npeople:\n  x: {kind: robot}\n---\n").unwrap_err().0.contains("robot"));
        assert!(lesen("---\npeople:\n  x: 5\n---\n").is_err());
        assert!(lesen("---\nclasses:\n  c: 5\n---\n").is_err());
        assert!(lesen("---\npeople:\n  [a]: {}\n---\n").is_err());
        assert!(lesen("---\nclasses:\n  [a]: {}\n---\n").is_err());
    }
}
