//! `aufgaben/<nr>-<slug>.md` — Frontmatter, Beschreibung, Teilaufgaben, Zeiten, Kommentare.

use super::{Formatfehler, frontmatter, yaml};
use crate::modell::{Aktion, Aufgabe, Ausfuehrung, Berichtszaehlung, Durchlauf, Ergebnis, Kommentar, Phasenangaben, Reservierung, Teilaufgabe, Wirkung, Zeiteintrag, slug};
use serde_yaml::Value;

pub const ORDNER: &str = "aufgaben";
pub const ZEITEN: &str = "kanbanD-time";
pub const KOMMENTARE: &str = "kanbanD-comments";
pub const DURCHLAEUFE: &str = "kanbanD-runs";
const BEKANNT: [&str; 13] = ["id", "title", "class", "assignees", "labels", "due", "origins", SIGNALE, WIRKUNGEN, PHASEN, BERICHTE, "archived", RESERVIERUNG];
/// Gesetzte Signale (R00076).
pub const SIGNALE: &str = "signals";
pub const RESERVIERUNG: &str = "reservation";
pub const WIRKUNGEN: &str = "wbs-effects";
pub const PHASEN: &str = "phases";
pub const BERICHTE: &str = "reporting";
/// Die Berichte, für die `reporting` einen Schlüssel kennt.
const BERICHTSSCHLUESSEL: [&str; 2] = ["burndown", "forecast"];
/// Die Schlüssel einer Wirkung, die kanbanD kennt; andere bleiben erhalten.
const WIRKUNG_BEKANNT: [&str; 8] = ["application", "action", "node", "parent", "level", "name", "done-criterion", "executed"];
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

/// Prüft einen Zeitpunkt (mit oder ohne Versatz, siehe `uhr::Zeitpunkt::lesen`) und liefert ihn in Dateiform.
pub fn zeitpunkt(s: &str) -> Option<String> {
    crate::uhr::Zeitpunkt::lesen(s).map(|z| z.datei())
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
    a.signale = yaml::textliste(&m, SIGNALE);
    a.archiviert = yaml::text(&m, "archived").filter(|d| !d.is_empty());
    if let Some(w) = m.get(WIRKUNGEN) {
        a.wirkungen = wirkungen_lesen(w)?;
    }
    if let Some(p) = m.get(PHASEN) {
        a.phasen = phasen_lesen(p)?;
    }
    if let Some(r) = m.get(BERICHTE) {
        a.zaehlung = zaehlung_lesen(r)?;
    }
    if let Some(r) = m.get(RESERVIERUNG) {
        a.reservierung = reservierung_lesen(r)?;
    }
    for (k, v) in &m {
        if let Some(k) = k.as_str().filter(|k| !BEKANNT.contains(k)) {
            a.weitere.push((k.to_string(), v.clone()));
        }
    }
    koerper_lesen(&mut a, koerper)?;
    Ok(a)
}

/// `reservation: {who: cl, instance: agent-1, since: 2026-10-25 07:41+01:00}` (R00087); leer heißt keine.
fn reservierung_lesen(v: &Value) -> Result<Option<Reservierung>, Formatfehler> {
    let falsch = || Formatfehler("reservation braucht who, instance und since (JJJJ-MM-TT HH:MM±HH:MM)".into());
    match v {
        Value::Null => Ok(None),
        Value::Mapping(m) => {
            let feld = |k: &str| m.get(k).and_then(yaml::wert_als_text).filter(|t| !t.trim().is_empty());
            let (wer, instanz, seit) = (feld("who").ok_or_else(falsch)?, feld("instance").ok_or_else(falsch)?, feld("since").ok_or_else(falsch)?);
            Ok(Some(Reservierung { wer, instanz, seit: zeitpunkt(&seit).ok_or_else(falsch)? }))
        }
        _ => Err(falsch()),
    }
}

/// `phases: {skipped: [Abnahme], …}` — `skipped` als Liste oder einzelner Text; andere Schlüssel bleiben erhalten.
fn phasen_lesen(v: &Value) -> Result<Phasenangaben, Formatfehler> {
    match v {
        Value::Null => Ok(Phasenangaben::default()),
        Value::Mapping(m) => Ok(Phasenangaben {
            uebersprungen: yaml::textliste(m, "skipped"),
            weitere: m.iter().filter_map(|(k, w)| k.as_str().filter(|k| *k != "skipped").map(|k| (k.to_string(), w.clone()))).collect(),
        }),
        _ => Err(Formatfehler(format!("{PHASEN} ist keine Zuordnung — erwartet {{skipped: [...]}}"))),
    }
}

fn phasen_schreiben(p: &Phasenangaben) -> String {
    let mut s = String::new();
    if !p.uebersprungen.is_empty() {
        s.push_str(&format!("  skipped: {}\n", yaml::liste(&p.uebersprungen)));
    }
    s.extend(p.weitere.iter().map(|(k, v)| format!("  {}: {}\n", yaml::skalar(k), flusswert(v))));
    if s.is_empty() { s } else { format!("{PHASEN}:\n{s}") }
}

/// `reporting: {burndown: false, forecast: false, …}` — je Bericht true/false; andere Schlüssel bleiben erhalten.
fn zaehlung_lesen(v: &Value) -> Result<Berichtszaehlung, Formatfehler> {
    let m = match v {
        Value::Null => return Ok(Berichtszaehlung::default()),
        Value::Mapping(m) => m,
        _ => return Err(Formatfehler(format!("{BERICHTE} ist keine Zuordnung — erwartet {{burndown: false, forecast: false}}"))),
    };
    let wahr = |k: &str| match m.get(k) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Bool(b)) => Ok(Some(*b)),
        Some(_) => Err(Formatfehler(format!("{BERICHTE}.{k} ist nicht true oder false"))),
    };
    Ok(Berichtszaehlung {
        burndown: wahr("burndown")?,
        forecast: wahr("forecast")?,
        weitere: m.iter().filter_map(|(k, w)| k.as_str().filter(|k| !BERICHTSSCHLUESSEL.contains(k)).map(|k| (k.to_string(), w.clone()))).collect(),
    })
}

fn zaehlung_schreiben(z: &Berichtszaehlung) -> String {
    let mut s = String::new();
    for (k, wert) in [("burndown", z.burndown), ("forecast", z.forecast)] {
        if let Some(b) = wert {
            s.push_str(&format!("  {k}: {b}\n"));
        }
    }
    s.extend(z.weitere.iter().map(|(k, v)| format!("  {}: {}\n", yaml::skalar(k), flusswert(v))));
    if s.is_empty() { s } else { format!("{BERICHTE}:\n{s}") }
}

fn wirkungen_lesen(v: &Value) -> Result<Vec<Wirkung>, Formatfehler> {
    match v {
        Value::Null => Ok(vec![]),
        Value::Sequence(s) => s.iter().enumerate().map(|(i, w)| wirkung_lesen(i, w)).collect(),
        _ => Err(Formatfehler(format!("{WIRKUNGEN} ist keine Liste"))),
    }
}

fn wirkung_lesen(i: usize, v: &Value) -> Result<Wirkung, Formatfehler> {
    let falsch = |was: &str| Formatfehler(format!("{WIRKUNGEN}[{i}]: {was}"));
    let Value::Mapping(m) = v else { return Err(falsch("keine Zuordnung — erwartet {application, action, node?, …}")) };
    let text = |k: &str| yaml::text(m, k).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    let anwendung = text("application").ok_or_else(|| falsch("application fehlt"))?;
    let aktion = text("action").as_deref().and_then(Aktion::aus).ok_or_else(|| falsch("action — erwartet create, rework oder remove"))?;
    let weitere = m.iter().filter_map(|(k, w)| k.as_str().filter(|k| !WIRKUNG_BEKANNT.contains(k)).map(|k| (k.to_string(), w.clone()))).collect();
    let ausgefuehrt = match m.get("executed") {
        None | Some(Value::Null) | Some(Value::Bool(true)) => Ausfuehrung::Frueher,
        Some(Value::Bool(false)) => Ausfuehrung::Offen,
        Some(v) => yaml::wert_als_text(v).map(Ausfuehrung::Am).ok_or_else(|| falsch("executed — erwartet false oder ein Datum"))?,
    };
    Ok(Wirkung { anwendung, aktion, knoten: text("node"), eltern: text("parent"), ebene: text("level"), name: text("name"), fertig_kriterium: text("done-criterion"), ausgefuehrt, weitere })
}

/// Ein Wert in einer Flow-Zuordnung: Texte wie sonst im Frontmatter, alles andere als JSON (gültiges YAML).
fn flusswert(v: &Value) -> String {
    match v {
        Value::String(s) => yaml::skalar(s),
        Value::Number(_) | Value::Bool(_) => yaml::wert_als_text(v).unwrap_or_default(),
        _ => serde_json::to_string(v).unwrap_or_else(|_| "null".into()),
    }
}

/// `  - {application: kd, action: create, node: I0048, …}` — eine Zeile je Wirkung.
fn wirkung_schreiben(w: &Wirkung) -> String {
    let mut teile = vec![format!("application: {}", yaml::skalar(&w.anwendung)), format!("action: {}", w.aktion.schluessel())];
    for (k, wert) in [("node", &w.knoten), ("parent", &w.eltern), ("level", &w.ebene), ("name", &w.name), ("done-criterion", &w.fertig_kriterium)] {
        if let Some(wert) = wert {
            teile.push(format!("{k}: {}", yaml::skalar(wert)));
        }
    }
    match &w.ausgefuehrt {
        Ausfuehrung::Frueher => {}
        Ausfuehrung::Offen => teile.push("executed: false".into()),
        Ausfuehrung::Am(datum) => teile.push(format!("executed: {}", yaml::skalar(datum))),
    }
    teile.extend(w.weitere.iter().map(|(k, v)| format!("{}: {}", yaml::skalar(k), flusswert(v))));
    format!("  - {{{}}}\n", teile.join(", "))
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
                    DURCHLAEUFE => {
                        for (i, z) in zeilen.iter().enumerate() {
                            match durchlauf_lesen(z) {
                                Some(d) => a.durchlaeufe.push(d),
                                None => a.durchlaeufe_fremd.push((i, z.to_string())),
                            }
                        }
                    }
                    _ => {
                        beschreibung.push(art);
                        beschreibung.extend(zeilen.iter());
                        beschreibung.push(zeile);
                    }
                }
                block = None;
            } else if !zeile.trim().is_empty() || !matches!(*art, ZEITEN | KOMMENTARE | DURCHLAEUFE) {
                zeilen.push(zeile);
            }
            continue;
        }
        let t = zeile.trim_end();
        if t == format!("```{ZEITEN}") {
            block = Some((ZEITEN, vec![]));
        } else if t == format!("```{KOMMENTARE}") {
            block = Some((KOMMENTARE, vec![]));
        } else if t == format!("```{DURCHLAEUFE}") {
            block = Some((DURCHLAEUFE, vec![]));
        } else if t.starts_with("```") {
            block = Some((zeile, vec![]));
        } else if let Some(ta) = teilaufgabe_lesen(t) {
            a.teilaufgaben.push(ta);
        } else {
            beschreibung.push(zeile);
        }
    }
    if let Some((art, zeilen)) = block {
        if matches!(art, ZEITEN | KOMMENTARE | DURCHLAEUFE) {
            return Err(Formatfehler(format!("Codeblock {art} ist nicht geschlossen")));
        }
        beschreibung.push(art);
        beschreibung.extend(zeilen);
    }
    a.beschreibung = beschreibung.join("\n").trim().to_string();
    Ok(())
}

/// `Zeitpunkt · Phase · Ergebnis · wer · Dauer h:mm oder - · Text` — der Text ist der Rest und darf ` · ` enthalten;
/// ohne Text endet die Zeile nach der Dauer. Eine Zeile, die so nicht passt, ist kein Durchlauf.
fn durchlauf_lesen(z: &str) -> Option<Durchlauf> {
    let teile: Vec<&str> = z.trim_end().splitn(6, TRENNER).collect();
    let [zp, phase, ergebnis, wer, dauer, ..] = teile[..] else { return None };
    let dauer_minuten = match dauer.trim() {
        "-" => None,
        d => Some(crate::uhr::dauer_lesen(d).filter(|_| d.contains(':'))?),
    };
    Some(Durchlauf {
        zeitpunkt: zeitpunkt(zp)?,
        phase: phase.trim().to_string(),
        ergebnis: Ergebnis::lesen(ergebnis.trim())?,
        wer: wer.trim().to_string(),
        dauer_minuten,
        text: teile.get(5).map(|t| t.to_string()).unwrap_or_default(),
    })
}

fn durchlauf_schreiben(d: &Durchlauf) -> String {
    let dauer = d.dauer_minuten.map(crate::uhr::hm).unwrap_or_else(|| "-".into());
    let kopf = [d.zeitpunkt.as_str(), &d.phase, d.ergebnis.text(), &d.wer, &dauer].join(TRENNER);
    if d.text.is_empty() { kopf } else { format!("{kopf}{TRENNER}{}", d.text) }
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
    if !a.signale.is_empty() {
        s.push_str(&format!("{SIGNALE}: {}\n", yaml::liste(&a.signale)));
    }
    if !a.wirkungen.is_empty() {
        s.push_str(&format!("{WIRKUNGEN}:\n{}", a.wirkungen.iter().map(wirkung_schreiben).collect::<String>()));
    }
    s.push_str(&phasen_schreiben(&a.phasen));
    s.push_str(&zaehlung_schreiben(&a.zaehlung));
    if let Some(d) = &a.archiviert {
        s.push_str(&format!("archived: {}\n", yaml::skalar(d)));
    }
    if let Some(r) = &a.reservierung {
        s.push_str(&format!("{RESERVIERUNG}: {{who: {}, instance: {}, since: {}}}\n", yaml::skalar(&r.wer), yaml::skalar(&r.instanz), yaml::skalar(&r.seit)));
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
    if !a.durchlaeufe.is_empty() || !a.durchlaeufe_fremd.is_empty() {
        // fremde Zeilen zurück an ihre Stelle, die Durchläufe der Reihe nach in die Lücken
        let mut eigene = a.durchlaeufe.iter().map(durchlauf_schreiben);
        let mut zeilen: Vec<String> = vec![];
        let gesamt = a.durchlaeufe.len() + a.durchlaeufe_fremd.len();
        for i in 0..gesamt {
            match a.durchlaeufe_fremd.iter().find(|(stelle, _)| *stelle == i) {
                Some((_, z)) => zeilen.push(z.clone()),
                None => zeilen.extend(eigene.next()),
            }
        }
        teile.push(format!("```{DURCHLAEUFE}\n{}\n```", zeilen.join("\n")));
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

    // R00094: Durchläufe im Rundlauf — Text mit Trenner, ohne Text, ohne Dauer, fremde Zeilen an ihrer Stelle
    #[test]
    fn durchlaeufe_im_rundlauf() {
        let t = "---\nid: 9\ntitle: D\n---\n\n```kanbanD-runs\n2026-10-25 07:41+01:00 · Entwicklung · bestanden · entw · 1:43 · Gate grün · Tests auch\nkeine Durchlaufzeile\n2026-10-25 08:00+01:00 · Code-Review · befund · crev · -\n```\n";
        let a = lesen("0009-d.md", t).unwrap();
        assert_eq!(a.durchlaeufe.len(), 2);
        assert_eq!(a.durchlaeufe[0], Durchlauf { zeitpunkt: "2026-10-25 07:41+01:00".into(), phase: "Entwicklung".into(), ergebnis: Ergebnis::Bestanden, wer: "entw".into(), dauer_minuten: Some(103), text: "Gate grün · Tests auch".into() });
        assert_eq!((a.durchlaeufe[1].dauer_minuten, a.durchlaeufe[1].text.as_str()), (None, ""));
        assert_eq!(schreiben(&a), t, "verlustfrei");
        let mut b = a.clone();
        b.durchlaeufe.push(Durchlauf { zeitpunkt: "2026-10-25 09:00+01:00".into(), phase: "Abnahme".into(), ergebnis: Ergebnis::Entfaellt, wer: "st".into(), dauer_minuten: None, text: "".into() });
        assert!(schreiben(&b).contains("· crev · -\n2026-10-25 09:00+01:00 · Abnahme · entfaellt · st · -\n```"), "neu am Ende");
        assert_eq!(lesen("0009-d.md", &schreiben(&b)).unwrap(), b);
        assert_eq!(durchlauf_lesen("2026-10-25 07:41 · E · ok · x · -"), None, "unbekanntes Ergebnis");
        assert_eq!(durchlauf_lesen("2026-10-25 07:41 · E · befund · x · 90"), None, "Dauer nur als h:mm");
    }

    // R00087: die Reservierung im Rundlauf, auch mit Kennungen, die YAML sonst als Zahl läse
    #[test]
    fn reservierung_im_rundlauf() {
        let t = "---\nid: 7\ntitle: R\nreservation: {who: cl, instance: agent-1, since: \"2026-10-25 07:41+01:00\"}\n---\n";
        let a = lesen("0007-r.md", t).unwrap();
        assert_eq!(a.reservierung, Some(Reservierung { wer: "cl".into(), instanz: "agent-1".into(), seit: "2026-10-25 07:41+01:00".into() }));
        assert_eq!(schreiben(&a), t);
        let mut b = a.clone();
        b.reservierung.as_mut().unwrap().instanz = "123".into();
        assert_eq!(lesen("0007-r.md", &schreiben(&b)).unwrap(), b, "Zahl als Kennung bleibt Text");
        assert!(lesen("0007-r.md", &t.replace("who: cl, ", "")).is_err());
        assert!(lesen("0007-r.md", &t.replace("\"2026-10-25 07:41+01:00\"", "gestern")).is_err());
        assert_eq!(lesen("0007-r.md", &t.replace("{who: cl, instance: agent-1, since: \"2026-10-25 07:41+01:00\"}", "")).unwrap().reservierung, None);
    }

    // R00084: mit Versatz bleibt er erhalten, Altzeilen ohne Versatz bleiben unverändert
    #[test]
    fn zeiten_mit_und_ohne_versatz_im_rundlauf() {
        let t = "---\nid: 5\ntitle: Z\n---\n```kanbanD-time\n2026-10-25 02:33+02:00 · 2026-10-25 02:10+01:00 · st\n2026-10-18 09:00 · 2026-10-18 10:42 · cl\n2026-10-25T06:41Z · ... · st\n```\n\n```kanbanD-comments\n2026-10-25 07:41+01:00 · st · Hallo\n```\n";
        let a = lesen("0005-z.md", t).unwrap();
        assert_eq!(a.zeiten[0].ende.as_deref(), Some("2026-10-25 02:10+01:00"));
        assert_eq!(a.zeiten[2].beginn, "2026-10-25 06:41+00:00", "ISO in Dateiform");
        assert_eq!(a.kommentare[0].zeitpunkt, "2026-10-25 07:41+01:00");
        let neu = schreiben(&a);
        assert!(neu.contains("2026-10-25 02:33+02:00 · 2026-10-25 02:10+01:00 · st\n2026-10-18 09:00 · 2026-10-18 10:42 · cl\n"), "{neu}");
        assert_eq!(schreiben(&lesen("0005-z.md", &neu).unwrap()), neu);
        assert!(lesen("0005-z.md", &t.replace("02:33+02:00", "02:33+2")).is_err());
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

    fn wirkung(aktion: Aktion, knoten: &str) -> Wirkung {
        Wirkung { anwendung: "kd".into(), aktion, ausgefuehrt: Default::default(), knoten: Some(knoten.into()), eltern: None, ebene: None, name: None, fertig_kriterium: None, weitere: vec![] }
    }

    #[test]
    fn wirkungen_im_eigenen_namensraum_rundlauf_zeichengleich() {
        let mut a = Aufgabe::neu(7, "0007-export.md".into(), "Export".into());
        a.herkunft = vec!["kd:I0047".into()];
        a.wirkungen = vec![
            Wirkung { eltern: Some("D0002".into()), ebene: Some("Interaction".into()), name: Some("„Export“, schnell".into()), fertig_kriterium: Some("US-1".into()), ..wirkung(Aktion::Anlegen, "I0048") },
            wirkung(Aktion::Ueberarbeiten, "D0002"),
            wirkung(Aktion::Verwerfen, "I0014"),
        ];
        let t = schreiben(&a);
        assert!(t.contains("origins: [kd:I0047]\nwbs-effects:\n  - {application: kd, action: create, node: I0048, parent: D0002, level: Interaction, name: \"„Export“, schnell\", done-criterion: US-1}\n  - {application: kd, action: rework, node: D0002}\n  - {application: kd, action: remove, node: I0014}\n---\n"), "{t}");
        let wieder = lesen("0007-export.md", &t).unwrap();
        assert_eq!(wieder, a);
        assert_eq!(schreiben(&wieder), t);
        assert_eq!(wieder.wirkungen[0].schluessel().as_deref(), Some("kd:I0048"));
        assert!(wieder.weitere.is_empty(), "wbs-effects ist kein unbekannter Schlüssel");
    }

    #[test]
    fn executed_fehlt_false_oder_datum_rundlauf() {
        let t = "---\nid: 7\ntitle: X\nwbs-effects:\n  - {application: kd, action: rework, node: D0002}\n  - {application: kd, action: remove, node: I0014, executed: false}\n  - {application: kd, action: rework, node: I0001, executed: 2026-10-20}\n---\n";
        let a = lesen("0007-x.md", t).unwrap();
        assert_eq!(a.wirkungen.iter().map(|w| w.ausgefuehrt.clone()).collect::<Vec<_>>(), [Ausfuehrung::Frueher, Ausfuehrung::Offen, Ausfuehrung::Am("2026-10-20".into())]);
        assert!(a.weitere.is_empty() && a.wirkungen.iter().all(|w| w.weitere.is_empty()), "executed ist bekannt");
        assert_eq!(schreiben(&a), t);
        assert!(lesen("0007-x.md", "---\nid: 7\ntitle: X\nwbs-effects:\n  - {application: kd, action: rework, node: D0002, executed: [1]}\n---\n").unwrap_err().0.contains("executed"));
    }

    #[test]
    fn unbekannte_schluessel_einer_wirkung_bleiben_erhalten() {
        let t = "---\nid: 7\ntitle: X\nwbs-effects:\n  - application: kd\n    action: rework\n    node: D0002\n    reason: Kopf neu\n    weight: 2\n    tags: [a, b]\n---\n";
        let a = lesen("0007-x.md", t).unwrap();
        assert_eq!(a.wirkungen[0].weitere.iter().map(|(k, _)| k.as_str()).collect::<Vec<_>>(), ["reason", "weight", "tags"]);
        let neu = schreiben(&a);
        assert!(neu.contains("  - {application: kd, action: rework, node: D0002, reason: Kopf neu, weight: 2, tags: [\"a\",\"b\"]}\n"), "{neu}");
        assert_eq!(lesen("0007-x.md", &neu).unwrap(), a, "der Rundlauf verliert nichts");
    }

    #[test]
    fn falsche_wirkungen_sind_formatfehler() {
        let mit = |w: &str| lesen("0007-x.md", &format!("---\nid: 7\ntitle: X\nwbs-effects: {w}\n---\n"));
        assert!(mit("kd:I0001").unwrap_err().0.contains("keine Liste"));
        assert!(mit("[x]").unwrap_err().0.contains("wbs-effects[0]: keine Zuordnung"));
        assert!(mit("[{action: rework, node: D0002}]").unwrap_err().0.contains("application fehlt"));
        assert!(mit("[{application: kd, action: grow}]").unwrap_err().0.contains("create, rework oder remove"));
        assert!(mit("").unwrap().wirkungen.is_empty(), "leer ist keine Wirkung");
    }

    #[test]
    fn entfallende_phasen_im_namensraum_phases_unbekanntes_bleibt() {
        let mut a = Aufgabe::neu(3, "0003-x.md".into(), "X".into());
        a.phasen.uebersprungen = vec!["Entwicklertest".into(), "Abnahme".into()];
        let t = schreiben(&a);
        assert_eq!(t, "---\nid: 3\ntitle: X\nphases:\n  skipped: [Entwicklertest, Abnahme]\n---\n");
        assert_eq!(lesen("0003-x.md", &t).unwrap(), a);
        let hand = "---\nid: 3\ntitle: X\nphases:\n  skipped: Abnahme\n  reason: kein Kunde\n  owners: [mi]\n---\n";
        let h = lesen("0003-x.md", hand).unwrap();
        assert_eq!((h.phasen.uebersprungen.clone(), h.weitere.len()), (vec!["Abnahme".to_string()], 0));
        let neu = schreiben(&h);
        assert!(neu.contains("phases:\n  skipped: [Abnahme]\n  reason: kein Kunde\n  owners: [\"mi\"]\n"), "{neu}");
        assert_eq!(lesen("0003-x.md", &neu).unwrap(), h, "der Rundlauf verliert nichts");
        let mut nur_fremd = h.clone();
        nur_fremd.phasen.uebersprungen.clear();
        assert!(schreiben(&nur_fremd).contains("phases:\n  reason: kein Kunde\n"), "ohne skipped bleibt der Namensraum mit seinem Rest");
        assert!(lesen("0003-x.md", "---\nid: 3\ntitle: X\nphases: [Abnahme]\n---\n").unwrap_err().0.contains("phases ist keine Zuordnung"));
        assert_eq!(lesen("0003-x.md", "---\nid: 3\ntitle: X\nphases:\n---\n").unwrap(), Aufgabe::neu(3, "0003-x.md".into(), "X".into()));
    }

    #[test]
    fn zaehlen_in_berichten_im_namensraum_reporting_unbekanntes_bleibt() {
        let mut a = Aufgabe::neu(2, "0002-x.md".into(), "X".into());
        a.zaehlung.forecast = Some(false);
        let t = schreiben(&a);
        assert_eq!(t, "---\nid: 2\ntitle: X\nreporting:\n  forecast: false\n---\n");
        assert_eq!(lesen("0002-x.md", &t).unwrap(), a);
        let hand = "---\nid: 2\ntitle: X\nreporting: {forecast: false, cycle-time: true, burndown: true}\n---\n";
        let h = lesen("0002-x.md", hand).unwrap();
        assert_eq!((h.zaehlung.burndown, h.zaehlung.forecast, h.weitere.len()), (Some(true), Some(false), 0));
        let neu = schreiben(&h);
        assert!(neu.contains("reporting:\n  burndown: true\n  forecast: false\n  cycle-time: true\n"), "{neu}");
        assert_eq!(lesen("0002-x.md", &neu).unwrap(), h, "der Rundlauf verliert nichts");
        assert_eq!(lesen("0002-x.md", "---\nid: 2\ntitle: X\nreporting:\n---\n").unwrap(), Aufgabe::neu(2, "0002-x.md".into(), "X".into()), "ohne Schlüssel gilt der Standard");
        assert!(lesen("0002-x.md", "---\nid: 2\ntitle: X\nreporting: [x]\n---\n").unwrap_err().0.contains("reporting ist keine Zuordnung"));
        assert!(lesen("0002-x.md", "---\nid: 2\ntitle: X\nreporting: {forecast: nein}\n---\n").unwrap_err().0.contains("reporting.forecast ist nicht true oder false"));
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
