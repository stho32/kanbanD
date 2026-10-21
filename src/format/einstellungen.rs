//! `kanbanD.md` — Personen, Klassen und Quellpfade des Ordners.

use super::{Formatfehler, frontmatter, yaml};
use crate::modell::{Anwendung, Art, Einstellungen, Klasse, Person, Quellen, Signal};

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
    if let Some(signals) = yaml::zuordnung(&m, "signals") {
        for (k, v) in signals {
            let schluessel = yaml::wert_als_text(k).ok_or_else(|| Formatfehler("Schlüssel unter signals ist kein Text".into()))?;
            let c = v.as_mapping().ok_or_else(|| Formatfehler(format!("signals.{schluessel} ist keine Zuordnung")))?;
            e.signale.push(Signal { bezeichnung: yaml::text(c, "label").unwrap_or_else(|| schluessel.clone()), farbe: yaml::text(c, "color").unwrap_or_else(|| "grey".into()), schluessel });
        }
    }
    if let Some(s) = yaml::zuordnung(&m, "sources") {
        e.quellen = Quellen { wbs: yaml::text(s, "wbs").unwrap_or_default(), anforderungen: yaml::text(s, "requirements").unwrap_or_default(), anwendungen: anwendungen_lesen(s)? };
    }
    Ok(e)
}

/// `sources.applications` — je Kürzel `{name, wbs, requirements}`, nach Kürzel sortiert. Pfade werden nicht geprüft:
/// ein fehlender Pfad macht die Anwendung unerreichbar, nicht die Datei defekt.
fn anwendungen_lesen(quellen: &serde_yaml::Mapping) -> Result<Vec<Anwendung>, Formatfehler> {
    let Some(register) = yaml::zuordnung(quellen, "applications") else { return Ok(vec![]) };
    let mut anwendungen = register
        .iter()
        .map(|(k, v)| {
            let kuerzel = yaml::wert_als_text(k).ok_or_else(|| Formatfehler("Kürzel unter sources.applications ist kein Text".into()))?;
            let a = v.as_mapping().ok_or_else(|| Formatfehler(format!("sources.applications.{kuerzel} ist keine Zuordnung")))?;
            Ok(Anwendung { name: yaml::text(a, "name").unwrap_or_else(|| kuerzel.clone()), wbs: yaml::text(a, "wbs").unwrap_or_default(), anforderungen: yaml::text(a, "requirements").unwrap_or_default(), kuerzel })
        })
        .collect::<Result<Vec<_>, Formatfehler>>()?;
    anwendungen.sort_by(|a, b| a.kuerzel.cmp(&b.kuerzel));
    Ok(anwendungen)
}

fn anwendungen_schreiben(anwendungen: &[Anwendung]) -> String {
    if anwendungen.is_empty() {
        return String::new();
    }
    let mut sortiert: Vec<&Anwendung> = anwendungen.iter().collect();
    sortiert.sort_by(|a, b| a.kuerzel.cmp(&b.kuerzel));
    let mut s = String::from("\n  applications:");
    for a in sortiert {
        s.push_str(&format!("\n    {}: {{name: {}, wbs: {}, requirements: {}}}", yaml::skalar(&a.kuerzel), yaml::skalar(&a.name), yaml::skalar(&a.wbs), yaml::skalar(&a.anforderungen)));
    }
    s
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
    if !e.signale.is_empty() {
        s.push_str("\nsignals:");
    }
    for g in &e.signale {
        s.push_str(&format!("\n  {}: {{label: {}, color: {}}}", yaml::skalar(&g.schluessel), yaml::skalar(&g.bezeichnung), yaml::skalar(&g.farbe)));
    }
    s.push_str(&format!(
        "\nsources:\n  wbs: {}\n  requirements: {}{}\n---\n\n# kanbanD\n\nEinstellungen dieses Ordners: Personen (`people`), Klassen (`classes`), Signale (`signals`) und Quellpfade (`sources`).\nPersonen werden stillgelegt (`active: false`), nicht entfernt.\n",
        yaml::skalar(&e.quellen.wbs),
        yaml::skalar(&e.quellen.anforderungen),
        anwendungen_schreiben(&e.quellen.anwendungen)
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
            signale: vec![Signal { schluessel: "mail".into(), bezeichnung: "Neue E-Mail".into(), farbe: "blue".into() }],
            quellen: Quellen { wbs: "Dokumentation/Planung/kanbanD.md".into(), anforderungen: "".into(), anwendungen: vec![] },
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

    fn anwendung(k: &str, wbs: &str) -> Anwendung {
        Anwendung { kuerzel: k.into(), name: format!("App {k}"), wbs: wbs.into(), anforderungen: format!("/r/{k}") }
    }

    #[test]
    fn register_der_anwendungen_rundlauf_stabil_sortiert() {
        let mut e = beispiel();
        e.quellen.anwendungen = vec![anwendung("kd", "/home/x/kanbanD/plan.md"), anwendung("kc", "C:/y: z.md")];
        let t = schreiben(&e);
        assert!(t.contains("\n  applications:\n    kc: {name: App kc, wbs: \"C:/y: z.md\", requirements: /r/kc}\n    kd: {name: App kd, wbs: /home/x/kanbanD/plan.md, requirements: /r/kd}\n---"), "{t}");
        let gelesen = lesen(&t).unwrap();
        assert_eq!(gelesen.quellen.anwendungen.iter().map(|a| a.kuerzel.as_str()).collect::<Vec<_>>(), vec!["kc", "kd"]);
        assert_eq!(gelesen.quellen.wbs, "Dokumentation/Planung/kanbanD.md", "Standardanwendung bleibt, wie sie war");
        assert_eq!(schreiben(&gelesen), t);
        let knapp = lesen("---\nsources:\n  applications:\n    kd: {}\n---\n").unwrap();
        assert_eq!(knapp.quellen.anwendungen, vec![Anwendung { kuerzel: "kd".into(), name: "kd".into(), wbs: "".into(), anforderungen: "".into() }]);
        assert!(lesen("---\nsources:\n  applications:\n    kd: 5\n---\n").is_err());
        assert!(!schreiben(&beispiel()).contains("applications"), "ohne Register keine leere Zeile");
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
