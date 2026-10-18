//! `aufgaben/<nr>-<slug>.md` — Frontmatter, Beschreibung, Teilaufgaben, Zeiten, Kommentare.

use super::{Formatfehler, frontmatter, yaml};
use crate::modell::{Aufgabe, Kommentar, Teilaufgabe, Zeiteintrag, slug};
use chrono::NaiveDateTime;

pub const ORDNER: &str = "aufgaben";
pub const ZEITEN: &str = "kanbanD-time";
pub const KOMMENTARE: &str = "kanbanD-comments";
const BEKANNT: [&str; 8] = ["id", "title", "class", "assignees", "labels", "due", "origins", "archived"];
const TRENNER: &str = " · ";
pub const ZEITFORMAT: &str = "%Y-%m-%d %H:%M";

pub fn dateiname(nummer: u32, titel: &str) -> String {
    let s = slug(titel);
    format!("{nummer:04}-{}.md", if s.is_empty() { "aufgabe" } else { &s })
}

/// Nummer aus dem Dateinamen: `0012-…` → 12.
pub fn nummer_aus_dateiname(datei: &str) -> Option<u32> {
    datei.split(['-', '.']).next()?.parse().ok()
}

/// Prüft einen Zeitpunkt `JJJJ-MM-TT HH:MM` (Sekunden erlaubt) und liefert ihn in Normalform.
pub fn zeitpunkt(s: &str) -> Option<String> {
    let s = s.trim();
    NaiveDateTime::parse_from_str(s, ZEITFORMAT)
        .or_else(|_| NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S"))
        .ok()
        .map(|d| d.format(ZEITFORMAT).to_string())
}

pub fn lesen(datei: &str, text: &str) -> Result<Aufgabe, Formatfehler> {
    let (y, koerper) = frontmatter::trennen(text)?;
    let m = yaml::lesen(y)?;
    let nummer = match m.get("id") {
        Some(v) => v.as_u64().map(|n| n as u32).ok_or_else(|| Formatfehler("id ist keine Zahl".into()))?,
        None => nummer_aus_dateiname(datei).ok_or_else(|| Formatfehler("weder id noch Nummer im Dateinamen".into()))?,
    };
    let mut a = Aufgabe::neu(nummer, datei.to_string(), yaml::text(&m, "title").unwrap_or_default());
    a.klasse = yaml::text(&m, "class").filter(|k| !k.is_empty());
    a.zustaendige = yaml::textliste(&m, "assignees");
    a.labels = yaml::textliste(&m, "labels");
    a.faellig = yaml::text(&m, "due").filter(|d| !d.is_empty());
    a.herkunft = yaml::textliste(&m, "origins");
    a.archiviert = yaml::text(&m, "archived").filter(|d| !d.is_empty());
    for (k, v) in &m {
        if let Some(k) = k.as_str().filter(|k| !BEKANNT.contains(k)) {
            a.weitere.push((k.to_string(), v.clone()));
        }
    }
    koerper_lesen(&mut a, koerper)?;
    Ok(a)
}

fn koerper_lesen(a: &mut Aufgabe, koerper: &str) -> Result<(), Formatfehler> {
    let mut beschreibung: Vec<&str> = vec![];
    let mut block: Option<(&str, Vec<&str>)> = None;
    for zeile in koerper.lines() {
        if let Some((art, zeilen)) = block.as_mut() {
            if zeile.trim_end() == "```" {
                match *art {
                    ZEITEN => a.zeiten = zeilen.iter().map(|z| zeit_lesen(z)).collect::<Result<_, _>>()?,
                    KOMMENTARE => a.kommentare = zeilen.iter().map(|z| kommentar_lesen(z)).collect::<Result<_, _>>()?,
                    _ => {
                        beschreibung.push(art);
                        beschreibung.extend(zeilen.iter());
                        beschreibung.push(zeile);
                    }
                }
                block = None;
            } else if !zeile.trim().is_empty() || !matches!(*art, ZEITEN | KOMMENTARE) {
                zeilen.push(zeile);
            }
            continue;
        }
        let t = zeile.trim_end();
        if t == format!("```{ZEITEN}") {
            block = Some((ZEITEN, vec![]));
        } else if t == format!("```{KOMMENTARE}") {
            block = Some((KOMMENTARE, vec![]));
        } else if t.starts_with("```") {
            block = Some((zeile, vec![]));
        } else if let Some(ta) = teilaufgabe_lesen(t) {
            a.teilaufgaben.push(ta);
        } else {
            beschreibung.push(zeile);
        }
    }
    if let Some((art, zeilen)) = block {
        if matches!(art, ZEITEN | KOMMENTARE) {
            return Err(Formatfehler(format!("Codeblock {art} ist nicht geschlossen")));
        }
        beschreibung.push(art);
        beschreibung.extend(zeilen);
    }
    a.beschreibung = beschreibung.join("\n").trim().to_string();
    Ok(())
}

fn teilaufgabe_lesen(z: &str) -> Option<Teilaufgabe> {
    let rest = z.strip_prefix("- [").or_else(|| z.strip_prefix("* ["))?;
    let (marke, text) = (rest.chars().next()?, rest.get(1..)?.strip_prefix("] ")?);
    match marke {
        ' ' => Some(Teilaufgabe { text: text.trim().into(), erledigt: false }),
        'x' | 'X' => Some(Teilaufgabe { text: text.trim().into(), erledigt: true }),
        _ => None,
    }
}

fn zeit_lesen(z: &str) -> Result<Zeiteintrag, Formatfehler> {
    let teile: Vec<&str> = z.split('·').map(str::trim).collect();
    let falsch = || Formatfehler(format!("{ZEITEN}: Zeile „{}“ — erwartet „Beginn · Ende · wer“", z.trim()));
    let [beginn, ende, wer] = teile[..] else { return Err(falsch()) };
    let beginn = zeitpunkt(beginn).ok_or_else(falsch)?;
    let ende = match ende {
        "..." | "…" => None,
        e => Some(zeitpunkt(e).ok_or_else(falsch)?),
    };
    if wer.is_empty() {
        return Err(falsch());
    }
    Ok(Zeiteintrag { wer: wer.into(), beginn, ende })
}

fn kommentar_lesen(z: &str) -> Result<Kommentar, Formatfehler> {
    let falsch = || Formatfehler(format!("{KOMMENTARE}: Zeile „{}“ — erwartet „Zeitpunkt · wer · Text“", z.trim()));
    let mut teile = z.splitn(3, TRENNER);
    let (Some(zp), Some(wer), Some(text)) = (teile.next(), teile.next(), teile.next()) else { return Err(falsch()) };
    let zeitpunkt = zeitpunkt(zp).ok_or_else(falsch)?;
    Ok(Kommentar { wer: wer.trim().into(), zeitpunkt, text: entschluesseln(text.trim_end()) })
}

fn verschluesseln(t: &str) -> String {
    t.replace('\\', "\\\\").replace("\r\n", "\n").replace('\n', "\\n")
}

fn entschluesseln(t: &str) -> String {
    let mut s = String::new();
    let mut zeichen = t.chars();
    while let Some(c) = zeichen.next() {
        match (c, c == '\\') {
            (_, true) => match zeichen.next() {
                Some('n') => s.push('\n'),
                Some(x) => s.push(x),
                None => s.push('\\'),
            },
            (c, false) => s.push(c),
        }
    }
    s
}

pub fn schreiben(a: &Aufgabe) -> String {
    let mut s = format!("---\nid: {}\ntitle: {}\n", a.nummer, yaml::skalar(&a.titel));
    if let Some(k) = &a.klasse {
        s.push_str(&format!("class: {}\n", yaml::skalar(k)));
    }
    for (schluessel, liste) in [("assignees", &a.zustaendige), ("labels", &a.labels)] {
        if !liste.is_empty() {
            s.push_str(&format!("{schluessel}: {}\n", yaml::liste(liste)));
        }
    }
    if let Some(d) = &a.faellig {
        s.push_str(&format!("due: {}\n", yaml::skalar(d)));
    }
    if !a.herkunft.is_empty() {
        s.push_str(&format!("origins: {}\n", yaml::liste(&a.herkunft)));
    }
    if let Some(d) = &a.archiviert {
        s.push_str(&format!("archived: {}\n", yaml::skalar(d)));
    }
    for (k, v) in &a.weitere {
        let wert = serde_yaml::to_string(v).unwrap_or_default();
        let wert = wert.trim_end();
        if wert.contains('\n') {
            s.push_str(&format!("{k}:\n{}\n", wert.lines().map(|z| format!("  {z}")).collect::<Vec<_>>().join("\n")));
        } else {
            s.push_str(&format!("{k}: {wert}\n"));
        }
    }
    s.push_str("---\n");
    let mut teile: Vec<String> = vec![];
    if !a.beschreibung.trim().is_empty() {
        teile.push(a.beschreibung.trim().to_string());
    }
    if !a.teilaufgaben.is_empty() {
        teile.push(a.teilaufgaben.iter().map(|t| format!("- [{}] {}", if t.erledigt { 'x' } else { ' ' }, t.text)).collect::<Vec<_>>().join("\n"));
    }
    if !a.zeiten.is_empty() {
        let zeilen = a.zeiten.iter().map(|z| format!("{}{TRENNER}{}{TRENNER}{}", z.beginn, z.ende.as_deref().unwrap_or("..."), z.wer));
        teile.push(format!("```{ZEITEN}\n{}\n```", zeilen.collect::<Vec<_>>().join("\n")));
    }
    if !a.kommentare.is_empty() {
        let zeilen = a.kommentare.iter().map(|k| format!("{}{TRENNER}{}{TRENNER}{}", k.zeitpunkt, k.wer, verschluesseln(&k.text)));
        teile.push(format!("```{KOMMENTARE}\n{}\n```", zeilen.collect::<Vec<_>>().join("\n")));
    }
    for t in teile {
        s.push('\n');
        s.push_str(&t);
        s.push('\n');
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn voll() -> Aufgabe {
        let mut a = Aufgabe::neu(12, "0012-kopfzeile-verdichten.md".into(), "Kopfzeile: verdichten".into());
        a.klasse = Some("feature".into());
        a.zustaendige = vec!["cl".into(), "st".into()];
        a.labels = vec!["ui".into()];
        a.faellig = Some("2026-10-20".into());
        a.herkunft = vec!["I0027".into(), "R00004".into()];
        a.beschreibung = "Filter in die Kopfzeile.\n\n```rust\nfn x() {}\n```".into();
        a.teilaufgaben = vec![Teilaufgabe { text: "Höhe 40 px".into(), erledigt: true }, Teilaufgabe { text: "Filter".into(), erledigt: false }];
        a.zeiten = vec![
            Zeiteintrag { wer: "cl".into(), beginn: "2026-10-18 09:00".into(), ende: Some("2026-10-18 10:30".into()) },
            Zeiteintrag { wer: "st".into(), beginn: "2026-10-18 11:00".into(), ende: None },
        ];
        a.kommentare = vec![Kommentar { wer: "st".into(), zeitpunkt: "2026-10-18 10:31".into(), text: "Zwei\nZeilen · mit \\ Strich".into() }];
        a
    }

    #[test]
    fn rundlauf_ist_zeichengleich() {
        let t = schreiben(&voll());
        let a = lesen("0012-kopfzeile-verdichten.md", &t).unwrap();
        assert_eq!(a, voll());
        assert_eq!(schreiben(&a), t);
        assert!(t.contains("```kanbanD-time\n2026-10-18 09:00 · 2026-10-18 10:30 · cl\n2026-10-18 11:00 · ... · st\n```"));
        assert!(t.contains("2026-10-18 10:31 · st · Zwei\\nZeilen · mit \\\\ Strich"));
        assert!(t.starts_with("---\nid: 12\ntitle: \"Kopfzeile: verdichten\"\nclass: feature\nassignees: [cl, st]\nlabels: [ui]\ndue: 2026-10-20\norigins: [I0027, R00004]\n---\n"));
    }

    #[test]
    fn minimale_aufgabe_hat_nur_id_und_titel() {
        let a = Aufgabe::neu(3, "0003-x.md".into(), "X".into());
        assert_eq!(schreiben(&a), "---\nid: 3\ntitle: X\n---\n");
        assert_eq!(lesen("0003-x.md", &schreiben(&a)).unwrap(), a);
    }

    #[test]
    fn handgeschriebene_datei_ohne_id_mit_sekunden_und_unbekanntem_schluessel() {
        let t = "---\ntitle: Hand\nestimate: 3\nnotes:\n  - a\n  - b\n---\nText\n- [X] fertig\n* [ ] offen\n\n```kanbanD-time\n\n2026-10-18 09:00:59 · … · mi\n```\n";
        let a = lesen("0042-hand.md", t).unwrap();
        assert_eq!(a.nummer, 42);
        assert_eq!(a.zeiten[0].beginn, "2026-10-18 09:00");
        assert!(a.zeiten[0].ende.is_none());
        assert_eq!(a.teilaufgaben.len(), 2);
        assert!(a.teilaufgaben[0].erledigt);
        assert_eq!(a.beschreibung, "Text");
        let neu = schreiben(&a);
        assert!(neu.contains("estimate: 3\nnotes:\n  - a\n  - b\n---"), "{neu}");
        assert_eq!(lesen("0042-hand.md", &neu).unwrap().weitere.len(), 2);
    }

    #[test]
    fn falsche_zeilen_und_offene_bloecke_sind_fehler() {
        assert!(lesen("0001-x.md", "---\nid: x\n---\n").unwrap_err().0.contains("id"));
        assert!(lesen("x.md", "---\ntitle: a\n---\n").is_err());
        assert!(lesen("0001-x.md", "```kanbanD-time\n2026-10-18 · st\n```\n").unwrap_err().0.contains("Beginn"));
        assert!(lesen("0001-x.md", "```kanbanD-time\nmorgen · ... · st\n```\n").is_err());
        assert!(lesen("0001-x.md", "```kanbanD-time\n2026-10-18 09:00 · gestern · st\n```\n").is_err());
        assert!(lesen("0001-x.md", "```kanbanD-time\n2026-10-18 09:00 · ... · \n```\n").is_err());
        assert!(lesen("0001-x.md", "```kanbanD-comments\nnur text\n```\n").is_err());
        assert!(lesen("0001-x.md", "```kanbanD-comments\nx · st · t\n```\n").is_err());
        assert!(lesen("0001-x.md", "```kanbanD-time\n").unwrap_err().0.contains("nicht geschlossen"));
        let a = lesen("0001-x.md", "```js\nlet a;\n").unwrap();
        assert_eq!(a.beschreibung, "```js\nlet a;");
    }

    #[test]
    fn dateiname_und_nummer() {
        assert_eq!(dateiname(7, "Größe ändern"), "0007-groesse-aendern.md");
        assert_eq!(dateiname(12345, "!!"), "12345-aufgabe.md");
        assert_eq!(nummer_aus_dateiname("0012-x.md"), Some(12));
        assert_eq!(nummer_aus_dateiname("abc.md"), None);
        assert_eq!(zeitpunkt(" 2026-01-02 03:04 "), Some("2026-01-02 03:04".into()));
        assert_eq!(zeitpunkt("2026-13-02 03:04"), None);
        assert_eq!(entschluesseln("a\\"), "a\\");
    }
}
