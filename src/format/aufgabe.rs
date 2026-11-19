//! `aufgaben/<nr>-<slug>.md` — Frontmatter, Beschreibung, Teilaufgaben, Zeiten, Kommentare.

use super::{Formatfehler, frontmatter, yaml};
use crate::modell::{Aktion, Aufgabe, Ausfuehrung, Berichtszaehlung, Durchlauf, Ergebnis, Fremdschluessel, Gesamt, Kommentar, Kosten, Kosteneintrag, Phasenangaben, Position, Wert, Reservierung, Teilaufgabe, Wirkung, Zeiteintrag, geschaetzte_minuten_pruefen, slug};
use serde_yaml::Value;

pub const ORDNER: &str = "aufgaben";
pub const ZEITEN: &str = "kanbanD-time";
pub const KOMMENTARE: &str = "kanbanD-comments";
pub const DURCHLAEUFE: &str = "kanbanD-runs";
const BEKANNT: [&str; 17] = ["id", "title", SCHLUESSEL, "class", "assignees", "labels", "due", "origins", SIGNALE, WIRKUNGEN, PHASEN, BERICHTE, KOSTEN, KOSTENEINTRAEGE, GESCHAETZT, "archived", RESERVIERUNG];
/// Gesetzte Signale (R00076).
pub const SIGNALE: &str = "signals";
pub const RESERVIERUNG: &str = "reservation";
/// Schlüssel eines fremden Systems (R00098)
pub const SCHLUESSEL: &str = "key";
pub const WIRKUNGEN: &str = "wbs-effects";
pub const PHASEN: &str = "phases";
pub const BERICHTE: &str = "reporting";
/// Preisetikett (R00105, ADR-0009)
pub const KOSTEN: &str = "cost";
/// Kosteneinträge je Rollenlauf (R00165, ADR-0028) — eigener Schlüssel neben `cost`
pub const KOSTENEINTRAEGE: &str = "cost-entries";
/// Commit-Verweise der Aufgabe (R00202, ADR-0032 Punkt 1) — Blockliste hinter `cost-entries`
pub const COMMITS: &str = "commits";
/// Geschätzte Zeit in ganzen Minuten (R00129, ADR-0023)
pub const GESCHAETZT: &str = "estimate";
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
    let m = yaml::lesen(y).or_else(|fehler| yaml_heilen(y).and_then(|heil| yaml::lesen(&heil).ok()).ok_or(fehler))?;
    let nummer = match m.get("id") {
        Some(v) => v.as_u64().map(|n| n as u32).ok_or_else(|| Formatfehler("id ist keine Zahl".into()))?,
        None => nummer_aus_dateiname(datei).ok_or_else(|| Formatfehler("weder id noch Nummer im Dateinamen".into()))?,
    };
    let mut a = Aufgabe::neu(nummer, datei.to_string(), yaml::text(&m, "title").unwrap_or_default());
    if let Some(k) = m.get(SCHLUESSEL) {
        let text = yaml::wert_als_text(k).unwrap_or_default();
        a.schluessel = Some(Fremdschluessel::pruefen(&text).map_err(|f| Formatfehler(format!("{SCHLUESSEL}: {f}")))?);
    }
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
    if let Some(k) = m.get(KOSTEN).filter(|k| !k.is_null()) {
        a.kosten = Some(Kosten::lesen(k).map_err(Formatfehler)?);
    }
    if let Some(e) = m.get(KOSTENEINTRAEGE) {
        a.kosteneintraege = kosteneintraege_lesen(e)?;
    }
    // Was keine Liste von Texten ist, bleibt als unbekannter Schlüssel wörtlich stehen — nie defekt (ADR-0032 Punkt 1)
    let commits = m.get(COMMITS).and_then(commits_lesen);
    let commits_bekannt = commits.is_some();
    a.commits = commits.unwrap_or_default();
    if let Some(e) = m.get(GESCHAETZT) {
        a.geschaetzte_minuten = geschaetzte_minuten_pruefen(Some(e)).map_err(Formatfehler)?;
    }
    if let Some(r) = m.get(RESERVIERUNG) {
        a.reservierung = reservierung_lesen(r)?;
    }
    for (k, v) in &m {
        if let Some(k) = k.as_str().filter(|k| !(BEKANNT.contains(k) || (commits_bekannt && *k == COMMITS))) {
            a.weitere.push((k.to_string(), v.clone()));
        }
    }
    koerper_lesen(&mut a, koerper)?;
    Ok(a)
}

/// Der nachsichtige Leser für den Schaden der Vorversion (Legacy-Befund, Karte #207): sie schrieb eine Liste oder Zuordnung
/// mit genau einem Eintrag in die Schlüsselzeile — `commits: - kd:3f2a…`, `fremd: a: b` —, und das Frontmatter war
/// unlesbar. Läuft nur, wenn das Lesen gescheitert ist, und fasst nur Zeilen am Zeilenanfang an, deren Schlüssel **nicht**
/// bekannt ist (`commits` zählt als unbekannt): ein defekter `title: - x` bleibt defekt, statt still etwas anderes zu
/// bedeuten. Der Rest der Zeile muss für sich genau eine Liste mit einem Eintrag oder eine Zuordnung mit einem einfachen
/// Schlüssel und einem Eintrag sein (kein Fluss, keine Anführungszeichen) — sonst ist es nicht eindeutig und bleibt defekt.
/// Liefert das Frontmatter mit dem Eintrag im Block darunter, oder `None`, wenn nichts zu heilen war.
fn yaml_heilen(y: &str) -> Option<String> {
    let einfach = |k: &str| !k.is_empty() && k.chars().all(|c| c.is_ascii_alphanumeric() || "_.-".contains(c));
    let mut geheilt = false;
    let zeilen: Vec<String> = y
        .lines()
        .map(|zeile| {
            let Some((k, rest)) = zeile.split_once(": ").filter(|(k, _)| einfach(k) && !BEKANNT.contains(k)) else { return zeile.to_string() };
            let rest = rest.trim();
            let eindeutig = match serde_yaml::from_str::<Value>(rest) {
                Ok(Value::Sequence(l)) => rest.starts_with("- ") && l.len() == 1,
                Ok(Value::Mapping(m)) => !rest.starts_with(['{', '[', '"', '\'']) && m.len() == 1 && m.keys().all(|k| k.as_str().is_some_and(einfach)),
                _ => false,
            };
            if !eindeutig {
                return zeile.to_string();
            }
            geheilt = true;
            format!("{k}:\n  {rest}")
        })
        .collect();
    geheilt.then(|| zeilen.join("\n"))
}

/// `commits` als Liste von Texten, wörtlich; leer heißt keine. `None`, wenn es keine Liste von Texten ist.
fn commits_lesen(v: &Value) -> Option<Vec<String>> {
    match v {
        Value::Null => Some(vec![]),
        Value::Sequence(l) => l.iter().map(|e| e.as_str().map(String::from)).collect(),
        _ => None,
    }
}

/// Ein Eintrag von `commits` in der Schreibweise von serde_yaml — so schreibt ihn auch die Vorversion, die `commits` als
/// unbekannten Schlüssel mitträgt (AK 9c); `kd:3f2a…` ohne Anführungszeichen, ein Ziffern-Hash als `'1234…'`. Nur ein
/// Text über mehrere Zeilen (von Hand) geht in die eine Zeile über [`yaml::skalar`].
fn commit_eintrag(e: &str) -> String {
    let wert = serde_yaml::to_string(&Value::String(e.to_string())).unwrap_or_default();
    let wert = wert.trim_end();
    if wert.contains('\n') || wert.is_empty() { yaml::skalar(e) } else { wert.to_string() }
}

/// Der eine nachsichtige Leser (R00157, ADR-0004 N1): die Schlüssel, die eine **defekte** Aufgabendatei lesbar trägt.
/// Leer heißt „keiner“ — auch für einen `key`, der kein gültiger einzeiliger Text ist; mehrere gibt es nur bei
/// Konfliktmarkern mit zwei Seiten. Lässt sich das Frontmatter als YAML lesen, entscheidet der Wert, sonst die
/// Zeilen `key:` am Zeilenanfang bis zum Ende des Frontmatters.
pub fn schluessel_nachsichtig(text: &str) -> Vec<Fremdschluessel> {
    let gueltig = |v: &Value| yaml::wert_als_text(v).and_then(|t| Fremdschluessel::pruefen(&t).ok());
    if let Ok(m) = frontmatter::trennen(text).and_then(|(y, _)| yaml::lesen(y)) {
        return m.get(SCHLUESSEL).and_then(gueltig).into_iter().collect();
    }
    let text = text.strip_prefix('\u{feff}').unwrap_or(text);
    let mut zeilen = text.lines();
    if zeilen.next().map(str::trim_end) != Some("---") {
        return vec![];
    }
    let mut gefunden: Vec<Fremdschluessel> = vec![];
    for wert in zeilen.take_while(|z| z.trim_end() != "---").filter_map(|z| z.strip_prefix("key:")) {
        let schluessel = serde_yaml::from_str::<Value>(wert).ok().as_ref().and_then(gueltig);
        gefunden.extend(schluessel.filter(|k| !gefunden.contains(k)));
    }
    gefunden
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

/// `cost:` als Block: currency, amount oder min + max, basis, items (je Position eine Flusszuordnung), dann Unbekanntes.
fn kosten_schreiben(k: &Kosten) -> String {
    let mut s = format!("{KOSTEN}:\n  currency: {}\n", yaml::skalar(&k.waehrung));
    match &k.wert {
        Gesamt::Betrag(c) => s.push_str(&format!("  amount: {}\n", geld(*c))),
        Gesamt::Spanne { min, max } => s.push_str(&format!("  min: {}\n  max: {}\n", geld(*min), geld(*max))),
        Gesamt::Positionen(_) => {}
    }
    if let Some(b) = &k.basis {
        s.push_str(&format!("  basis: {}\n", yaml::skalar(b)));
    }
    if let Gesamt::Positionen(p) = &k.wert {
        s.push_str("  items:\n");
        s.extend(p.iter().map(|p| format!("    - {{{}}}\n", position_schreiben(p))));
    }
    s.extend(k.weitere.iter().map(|(k, v)| format!("  {}: {}\n", yaml::skalar(k), flusswert(v))));
    s
}

fn position_schreiben(p: &Position) -> String {
    let mut teile = vec![format!("text: {}", yaml::skalar(&p.text))];
    match p.wert {
        Wert::Betrag(c) => teile.push(format!("amount: {}", geld(c))),
        Wert::Spanne { min, max } => teile.extend([format!("min: {}", geld(min)), format!("max: {}", geld(max))]),
    }
    teile.extend(p.tokens.map(|t| format!("tokens: {t}")));
    teile.extend(p.weitere.iter().map(|(k, v)| format!("{}: {}", yaml::skalar(k), flusswert(v))));
    teile.join(", ")
}

/// `cost-entries` als Liste; leer heißt keine. Ein formwidriger Eintrag ist ein Formatfehler mit Stelle und Feld — die
/// Datei gilt dann als defekt und bleibt, wie sie ist; stillschweigend ausgelassen wird nie ein Eintrag. Die Spalte
/// wird hier nicht geprüft (R00165 AK 8).
fn kosteneintraege_lesen(v: &Value) -> Result<Vec<Kosteneintrag>, Formatfehler> {
    match v {
        Value::Null => Ok(vec![]),
        Value::Sequence(s) => s.iter().enumerate().map(|(i, e)| Kosteneintrag::lesen(&format!("{KOSTENEINTRAEGE}[{i}]"), e).map_err(Formatfehler)).collect(),
        _ => Err(Formatfehler(format!("{KOSTENEINTRAEGE} ist keine Liste"))),
    }
}

/// `  - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, amount: 3.46, currency: USD, tokens: 81234}`
/// — eine Zeile je Eintrag in fester Schlüsselfolge, dann Unbekanntes. Der Zeitpunkt steht in Dateiform ohne Anführungszeichen.
fn kosteneintrag_schreiben(e: &Kosteneintrag) -> String {
    let mut teile = vec![
        format!("at: {}", e.zeitpunkt),
        format!("role: {}", yaml::skalar(&e.rolle)),
        format!("column: {}", yaml::skalar(&e.spalte)),
        format!("amount: {}", geld(e.cent)),
        format!("currency: {}", yaml::skalar(&e.waehrung)),
    ];
    teile.extend(e.tokens.map(|t| format!("tokens: {t}")));
    teile.extend(e.weitere.iter().map(|(k, v)| format!("{}: {}", yaml::skalar(k), flusswert(v))));
    format!("  - {{{}}}\n", teile.join(", "))
}

/// Geldwert in Dollar mit genau zwei Nachkommastellen, ohne Anführungszeichen: `0.60`, `17.00`.
fn geld(cent: u64) -> String {
    format!("{}.{:02}", cent / 100, cent % 100)
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
    if let Some(k) = &a.schluessel {
        s.push_str(&format!("{SCHLUESSEL}: {}\n", yaml::skalar(k.text())));
    }
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
    if let Some(m) = &a.geschaetzte_minuten {
        s.push_str(&format!("{GESCHAETZT}: {m}\n"));
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
    if let Some(k) = &a.kosten {
        s.push_str(&kosten_schreiben(k));
    }
    if !a.kosteneintraege.is_empty() {
        s.push_str(&format!("{KOSTENEINTRAEGE}:\n{}", a.kosteneintraege.iter().map(kosteneintrag_schreiben).collect::<String>()));
    }
    if !a.commits.is_empty() {
        s.push_str(&format!("{COMMITS}:\n{}", a.commits.iter().map(|c| format!("  - {}\n", commit_eintrag(c))).collect::<String>()));
    }
    if let Some(d) = &a.archiviert {
        s.push_str(&format!("archived: {}\n", yaml::skalar(d)));
    }
    if let Some(r) = &a.reservierung {
        s.push_str(&format!("{RESERVIERUNG}: {{who: {}, instance: {}, since: {}}}\n", yaml::skalar(&r.wer), yaml::skalar(&r.instanz), yaml::skalar(&r.seit)));
    }
    for (k, v) in &a.weitere {
        let wert = serde_yaml::to_string(v).unwrap_or_default();
        let wert = wert.trim_end();
        // Eine Liste oder Zuordnung steht immer im Block darunter, auch mit einem Eintrag: `k: - x` wäre unlesbar
        let block = matches!(v, Value::Sequence(l) if !l.is_empty()) || matches!(v, Value::Mapping(m) if !m.is_empty());
        if block || wert.contains('\n') {
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
    use crate::modell::{Gesamt, HOECHSTWERT_CENT, Kosten, Position, Wert};

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

    // R00098 B0316: key im Rundlauf, auch mit Doppelpunkt und Schrägstrichen; ohne key keine Zeile; ungültig → Formatfehler
    #[test]
    fn schluessel_im_rundlauf() {
        for (zeile, text) in [("key: \"a: b\"\n", "a: b"), ("key: shop/nc-304/lodash\n", "shop/nc-304/lodash"), ("key: \"304\"\n", "304")] {
            let t = format!("---\nid: 7\ntitle: S\n{zeile}---\n");
            let a = lesen("0007-s.md", &t).unwrap();
            assert_eq!(a.schluessel.as_ref().map(|k| k.text()), Some(text), "{zeile}");
            assert!(a.weitere.is_empty(), "key ist bekannt, nicht weitere");
            assert_eq!(schreiben(&a), t, "zeichengleich");
        }
        let ohne = "---\nid: 7\ntitle: S\n---\n";
        let a = lesen("0007-s.md", ohne).unwrap();
        assert_eq!((a.schluessel.is_none(), schreiben(&a).as_str()), (true, ohne), "ohne key keine Zeile");
        for falsch in ["key: \"\"\n", "key: \"a\\nb\"\n", "key: [a, b]\n"] {
            let fehler = lesen("0007-s.md", &format!("---\nid: 7\ntitle: S\n{falsch}---\n")).unwrap_err();
            assert!(fehler.0.contains("Schlüssel"), "{falsch}: {}", fehler.0);
        }
    }

    // R00157 B0741: der Schlüssel einer defekten Datei, nachsichtig gelesen (Tabelle aus ADR-0004 N1 „Durchsetzung“)
    #[test]
    fn schluessel_einer_defekten_datei_nachsichtig() {
        let lang = "x".repeat(201);
        let grenze = "x".repeat(200);
        let tabelle: Vec<(String, Vec<&str>)> = vec![
            ("---\nid: 7\ntitle: Fund\nkey: k1\nestimate: abc\n---\n".into(), vec!["k1"]),
            ("---\nid: 7\ntitle: Fund\nestimate: abc\n---\n".into(), vec![]),
            ("---\nid: 7\nkey: \"\"\nestimate: abc\n---\n".into(), vec![]),
            ("---\nid: 7\nkey: [a, b]\n---\n".into(), vec![]),
            ("---\nid: 7\nkey:\n---\n".into(), vec![]),
            ("---\nid: 7\nkey: {a: b}\n---\n".into(), vec![]),
            ("---\nid: 7\nkey: \"a\\nb\"\n---\n".into(), vec![]),
            (format!("---\nid: 7\nkey: {lang}\n---\n"), vec![]),
            (format!("---\nid: 7\nkey: {grenze}\nestimate: abc\n---\n"), vec![grenze.as_str()]),
            // Konfliktmarker: das Frontmatter ist kein YAML mehr, es entscheiden die Zeilen `key:` am Zeilenanfang
            ("---\nid: 7\ntitle: Fund\nkey: k1\n<<<<<<< HEAD\nclass: eilig\n=======\nclass: normal\n>>>>>>> sensor\n---\n".into(), vec!["k1"]),
            ("---\nid: 7\n<<<<<<< HEAD\nkey: k1\n=======\nkey: k2\n>>>>>>> sensor\n---\n".into(), vec!["k1", "k2"]),
            ("---\nid: 7\n<<<<<<< HEAD\nkey: k1\n=======\nkey: k1\nclass: x\n>>>>>>> sensor\n---\n".into(), vec!["k1"]),
            ("---\nid: 7\n<<<<<<< HEAD\nclass: eilig\n=======\nclass: normal\n>>>>>>> sensor\n---\n".into(), vec![]),
            ("---\nid: 7\n<<<<<<< HEAD\nkey: \"\"\n=======\nkey: [a, b]\n>>>>>>> sensor\n---\n".into(), vec![]),
            // unlesbares Frontmatter: Anführungszeichen und Leerraum wie YAML, `key:` im Körper zählt nicht
            ("---\nid: [\nkey: \"a: b\"\n---\n".into(), vec!["a: b"]),
            ("---\nid: [\nkey:   k1  \n---\n".into(), vec!["k1"]),
            ("---\nid: [\nkey: \"offen\n---\n".into(), vec![]),
            ("---\nid: [\n  key: k1\n---\n".into(), vec![]),
            ("---\nid: [\n---\nkey: k1\n".into(), vec![]),
            ("---\nid: 7\nkey: k1\n".into(), vec!["k1"]),
            ("key: k1\n<<<<<<< HEAD\n".into(), vec![]),
        ];
        for (text, erwartet) in &tabelle {
            let gelesen = schluessel_nachsichtig(text);
            assert_eq!(gelesen.iter().map(|k| k.text()).collect::<Vec<_>>(), *erwartet, "{text}");
        }
    }

    // R00157 B0741: Gleichlauf — für jede Datei, die `lesen` annimmt, liefert der nachsichtige Leser denselben Schlüssel
    #[test]
    fn nachsichtig_laeuft_mit_dem_strengen_lesen_gleich() {
        for zeile in ["key: \"a: b\"\n", "key: shop/nc-304/lodash\n", "key: \"304\"\n", "key: 304\n", "key:  k1 \n", ""] {
            let t = format!("---\nid: 7\ntitle: S\n{zeile}---\n\nkey: koerper\n");
            let streng = lesen("0007-s.md", &t).unwrap().schluessel;
            assert_eq!(schluessel_nachsichtig(&t), streng.into_iter().collect::<Vec<_>>(), "{zeile}");
        }
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
        // `estimate` ist seit R00129 ein bekannter Schlüssel; der unbekannte ist hier jetzt `schaetzung`.
        let t = "---\ntitle: Hand\nschaetzung: 3\nnotes:\n  - a\n  - b\n---\nText\n- [X] fertig\n* [ ] offen\n\n```kanbanD-time\n\n2026-10-18 09:00:59 · … · mi\n```\n";
        let a = lesen("0042-hand.md", t).unwrap();
        assert_eq!(a.nummer, 42);
        assert_eq!(a.zeiten[0].beginn, "2026-10-18 09:00");
        assert!(a.zeiten[0].ende.is_none());
        assert_eq!(a.teilaufgaben.len(), 2);
        assert!(a.teilaufgaben[0].erledigt);
        assert_eq!(a.beschreibung, "Text");
        let neu = schreiben(&a);
        assert!(neu.contains("schaetzung: 3\nnotes:\n  - a\n  - b\n---"), "{neu}");
        assert_eq!(lesen("0042-hand.md", &neu).unwrap().weitere.len(), 2);
    }

    // R00129 B0608: `estimate` in BEKANNT und in der Schreibreihenfolge; ganze Minuten 1..=100.000 zeichengleich,
    // ein von Hand geschriebenes `estimate: 3` gilt als drei Minuten, formwidrige Werte machen die Aufgabe defekt.
    #[test]
    fn geschaetzte_zeit_im_rundlauf() {
        let mit = |kopf: &str| lesen("0001-x.md", &format!("---\nid: 1\ntitle: X\n{kopf}---\n"));
        for m in [1_u32, 3, 150, 100_000] {
            let a = mit(&format!("estimate: {m}\n")).unwrap();
            assert_eq!(a.geschaetzte_minuten, Some(m), "{m}");
            assert!(a.weitere.is_empty(), "estimate ist kein unbekannter Schlüssel mehr: {m}");
            assert_eq!(schreiben(&a), format!("---\nid: 1\ntitle: X\nestimate: {m}\n---\n"), "{m}");
        }
        assert!(!schreiben(&Aufgabe::neu(1, "0001-x.md".into(), "X".into())).contains("estimate"), "ohne Schätzung keine Zeile");
        // unbekannte Schlüssel daneben bleiben (Rundlauf)
        assert_eq!(schreiben(&mit("estimate: 3\nnote: n\n").unwrap()), "---\nid: 1\ntitle: X\nestimate: 3\nnote: n\n---\n");
        for falsch in ["2:30", "\"150\"", "150.0", "2.5", "0", "-1", "100001", ".inf", ".nan", "true"] {
            assert_eq!(mit(&format!("estimate: {falsch}\n")).unwrap_err().0, crate::modell::GESCHAETZT_MELDUNG, "{falsch}");
        }
        assert_eq!(mit("estimate:\n").unwrap().geschaetzte_minuten, None, "leer heißt keine Schätzung");
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

    fn mit_kosten(k: Kosten) -> Aufgabe {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "X".into());
        a.kosten = Some(k);
        a
    }

    fn kosten(wert: Gesamt) -> Kosten {
        Kosten { waehrung: "USD".into(), basis: None, wert, weitere: vec![] }
    }

    fn kosten_aus(cost: &str) -> Result<Aufgabe, Formatfehler> {
        lesen("0001-x.md", &format!("---\nid: 1\ntitle: X\ncost: {cost}\n---\n"))
    }

    // R00105: Abschnitt cost in fester Reihenfolge, Geldwerte mit genau zwei Nachkommastellen
    #[test]
    fn kosten_schreiben_in_fester_reihenfolge() {
        let mut k = kosten(Gesamt::Spanne { min: 60, max: 160 });
        k.basis = Some("Schätzung planer".into());
        let t = schreiben(&mit_kosten(k.clone()));
        assert_eq!(t, "---\nid: 1\ntitle: X\ncost:\n  currency: USD\n  min: 0.60\n  max: 1.60\n  basis: Schätzung planer\n---\n");
        assert_eq!(lesen("0001-x.md", &t).unwrap().kosten, Some(k));
        assert!(schreiben(&mit_kosten(kosten(Gesamt::Betrag(110)))).contains("cost:\n  currency: USD\n  amount: 1.10\n---"));
        let p = vec![
            Position { text: "architekt".into(), wert: Wert::Spanne { min: 4, max: 10 }, tokens: Some(67924), weitere: vec![] },
            Position { text: "Gemeinkostenanteil".into(), wert: Wert::Betrag(30), tokens: None, weitere: vec![] },
        ];
        let mut k = kosten(Gesamt::Positionen(p));
        k.basis = Some("Token-Messung je Rolle, Opus 5.5, Preisstand 2026-10-06".into());
        let t = schreiben(&mit_kosten(k.clone()));
        assert!(
            t.contains("cost:\n  currency: USD\n  basis: \"Token-Messung je Rolle, Opus 5.5, Preisstand 2026-10-06\"\n  items:\n    - {text: architekt, min: 0.04, max: 0.10, tokens: 67924}\n    - {text: Gemeinkostenanteil, amount: 0.30}\n---"),
            "{t}"
        );
        assert_eq!(lesen("0001-x.md", &t).unwrap().kosten, Some(k));
        assert!(!schreiben(&Aufgabe::neu(1, "0001-x.md".into(), "X".into())).contains("cost"), "ohne Kosten kein Abschnitt");
    }

    // ADR-0009 Durchsetzung: jeder Cent-Wert liest sich als derselbe zurück, die Datei zeichengleich
    #[test]
    fn jeder_centwert_im_rundlauf_zeichengleich() {
        for c in (0..=100_000).chain([999_999, 99_999_999, HOECHSTWERT_CENT]) {
            let a = mit_kosten(kosten(Gesamt::Betrag(c)));
            let t = schreiben(&a);
            let zurueck = lesen("0001-x.md", &t).unwrap_or_else(|e| panic!("{c}: {e:?}"));
            assert_eq!(zurueck, a, "{c}");
            assert_eq!(schreiben(&zurueck), t, "{c}");
        }
    }

    #[test]
    fn jeder_text_als_basis_und_positionstext_im_rundlauf() {
        for s in yaml::tests::RUNDLAUF_TEXTE.iter().filter(|s| !s.trim().is_empty()) {
            let p = Position { text: s.to_string(), wert: Wert::Betrag(1), tokens: None, weitere: vec![] };
            let mut k = kosten(Gesamt::Positionen(vec![p]));
            k.basis = Some(s.to_string());
            let a = mit_kosten(k);
            let t = schreiben(&a);
            let zurueck = lesen("0001-x.md", &t).unwrap_or_else(|e| panic!("{s:?} → {t:?}: {e:?}"));
            assert_eq!(zurueck, a, "{s:?} → {t:?}");
            assert_eq!(schreiben(&zurueck), t);
        }
    }

    #[test]
    fn formwidrige_kosten_machen_die_aufgabe_defekt() {
        let fall = |cost: &str| kosten_aus(cost).map(|_| ()).unwrap_err().0;
        assert_eq!(fall("{amount: 1.63}"), "cost: currency fehlt");
        assert_eq!(fall("{currency: USD, amount: \"1.63\"}"), "cost.amount: keine Zahl");
        assert_eq!(lesen("0001-x.md", "---\nid: 1\ntitle: X\ncost:\n  currency: USD\n  amount: 1,63\n---\n").unwrap_err().0, "cost.amount: keine Zahl");
        for zahl in ["1.005", "-1", ".inf", ".nan"] {
            assert_eq!(fall(&format!("{{currency: USD, amount: {zahl}}}")), "cost.amount: Zahl ≥ 0 mit höchstens zwei Nachkommastellen erwartet", "{zahl}");
        }
        assert_eq!(fall("{currency: USD, items: [{text: a, amount: 1}, {text: b, min: 2, max: 1}]}"), "cost.items[1]: min > max");
        assert_eq!(fall("[USD]"), "cost: keine Zuordnung");
        assert_eq!(lesen("0001-x.md", "---\nid: 1\ntitle: X\ncost:\n---\n").unwrap().kosten, None, "leer heißt keine Kosten");
    }

    #[test]
    fn zahlen_in_anderer_schreibweise_gelten_und_werden_normal_geschrieben() {
        let a = kosten_aus("{currency: USD, min: 0x11, max: 1e2}").unwrap();
        assert_eq!(a.kosten.as_ref().map(|k| &k.wert), Some(&Gesamt::Spanne { min: 1700, max: 10000 }));
        assert!(schreiben(&a).contains("  min: 17.00\n  max: 100.00\n"));
    }

    #[test]
    fn unbekannte_schluessel_in_kosten_bleiben_erhalten() {
        let a = kosten_aus("{currency: USD, amount: 1.00, note: x}").unwrap();
        let mut b = a.clone();
        b.titel = "Y".into();
        let t = schreiben(&b);
        assert!(t.contains("cost:\n  currency: USD\n  amount: 1.00\n  note: x\n"), "{t}");
        assert_eq!(lesen("0001-x.md", &t).unwrap(), b);
        let a = kosten_aus("{currency: USD, items: [{text: a, amount: 1, quelle: log, n: [1, 2]}]}").unwrap();
        let t = schreiben(&a);
        assert!(t.contains("    - {text: a, amount: 1.00, quelle: log, n: [1,2]}\n"), "{t}");
        assert_eq!(lesen("0001-x.md", &t).unwrap(), a);
        assert!(a.weitere.is_empty(), "cost ist ein bekannter Schlüssel");
    }

    const ALTE_POSTEN: &str = "cost:\n  currency: USD\n  items:\n    - {text: Planung, min: 0.10, max: 0.20}\n    - {text: Bau, amount: 0.30}\n";
    const EINTRAEGE: &str = "cost-entries:\n  - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, amount: 3.46, currency: USD}\n  - {at: 2026-11-13 09:02+01:00, role: code reviewer, column: Gibtsnichtmehr, amount: 1.20, currency: EUR, tokens: 81234}\n";

    fn mit_kopf(kopf: &str) -> String {
        format!("---\nid: 1\ntitle: X\n{kopf}---\n")
    }

    fn eintraege_aus(liste: &str) -> Result<Aufgabe, Formatfehler> {
        lesen("0001-x.md", &mit_kopf(&format!("cost-entries: {liste}\n")))
    }

    // R00165 AK 6, ADR-0028 „Durchsetzung“: alte Posten und Einträge überstehen Lesen und Schreiben zeichengleich
    #[test]
    fn alte_posten_und_kosteneintraege_im_rundlauf_zeichengleich() {
        let t = mit_kopf(&format!("{ALTE_POSTEN}{EINTRAEGE}archived: 2026-11-14\n"));
        let a = lesen("0001-x.md", &t).unwrap();
        assert_eq!(schreiben(&a), t);
        let nur_eintraege = mit_kopf(EINTRAEGE);
        assert_eq!(schreiben(&lesen("0001-x.md", &nur_eintraege).unwrap()), nur_eintraege, "auch ohne Preisetikett");
    }

    // ADR-0028 Punkt 1: Reihenfolge der Datei (nicht nach Zeit sortiert), je Eintrag eine Flusszeile in fester Schlüsselfolge
    #[test]
    fn kosteneintraege_in_dateireihenfolge_und_fester_schluesselfolge() {
        let a = lesen("0001-x.md", &mit_kopf(EINTRAEGE)).unwrap();
        let kennungen: Vec<String> = a.kosteneintraege.iter().map(|e| e.kennung()).collect();
        assert_eq!(kennungen, ["entwickler@2026-11-13T10:34+01:00", "code reviewer@2026-11-13T09:02+01:00"]);
        assert!(a.weitere.is_empty(), "cost-entries ist ein bekannter Schlüssel");
        let block = eintraege_aus("\n  - tokens: 5\n    currency: USD\n    amount: 1.2\n    column: \"Bau, Test\"\n    role: planer\n    at: 2026-11-13T10:34:20+01:00").unwrap();
        assert_eq!(schreiben(&block), mit_kopf("cost-entries:\n  - {at: 2026-11-13 10:34+01:00, role: planer, column: \"Bau, Test\", amount: 1.20, currency: USD, tokens: 5}\n"));
        assert!(!schreiben(&eintraege_aus("").unwrap()).contains("cost-entries"), "leer heißt keine Einträge");
        assert!(!schreiben(&eintraege_aus("[]").unwrap()).contains("cost-entries"));
    }

    #[test]
    fn unbekannte_schluessel_eines_kosteneintrags_bleiben_erhalten() {
        let zeile = "  - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, amount: 3.46, currency: USD, lauf: 166-entwickler-1, n: [1,2]}\n";
        let t = mit_kopf(&format!("cost-entries:\n{zeile}"));
        let mut a = lesen("0001-x.md", &t).unwrap();
        a.titel = "Y".into();
        assert!(schreiben(&a).contains(zeile), "{}", schreiben(&a));
    }

    // Ein ungültiger Eintrag wirft nichts weg: die Datei ist defekt (nur lesbar, bis repariert), der Grund nennt Stelle und Feld
    #[test]
    fn formwidrige_kosteneintraege_machen_die_aufgabe_defekt() {
        let fall = |liste: &str| eintraege_aus(liste).map(|_| ()).unwrap_err().0;
        let gut = "{at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, amount: 3.46, currency: USD}";
        assert_eq!(fall(&format!("[{gut}, {}]", gut.replace("3.46", "abc"))), "cost-entries[1].amount: keine Zahl");
        assert_eq!(fall(&format!("[{}]", gut.replace("role: entwickler, ", ""))), "cost-entries[0]: role fehlt");
        assert_eq!(fall("[nix]"), "cost-entries[0]: keine Zuordnung");
        assert_eq!(fall(gut), "cost-entries ist keine Liste");
    }

    // jeder Text als Rolle und Spalte liest sich aus der Flusszeile als derselbe zurück
    #[test]
    fn jeder_text_als_rolle_und_spalte_im_rundlauf() {
        for s in yaml::tests::RUNDLAUF_TEXTE.iter().filter(|s| !s.trim().is_empty()) {
            let rolle: String = s.trim().chars().filter(|c| *c != '@' && !c.is_control()).take(60).collect();
            if rolle.trim().is_empty() {
                continue;
            }
            let mut a = lesen("0001-x.md", &mit_kopf(EINTRAEGE)).unwrap();
            a.kosteneintraege[0].rolle = rolle.trim().to_string();
            a.kosteneintraege[0].spalte = s.to_string();
            let t = schreiben(&a);
            let zurueck = lesen("0001-x.md", &t).unwrap_or_else(|e| panic!("{s:?} → {t:?}: {e:?}"));
            assert_eq!(zurueck, a, "{s:?} → {t:?}");
            assert_eq!(schreiben(&zurueck), t);
        }
    }

    // Ein unbekannter Schlüssel mit genau einem Listeneintrag oder einer Zuordnung aus einem Paar schrieb serde_yaml in
    // eine Zeile (`k: - x`, `k: a: b`) — die Datei war danach defekt (gefunden an R00202: ein Commit-Verweis in der Vorversion)
    #[test]
    fn unbekannter_schluessel_mit_einem_eintrag_bleibt_lesbar() {
        for kopf in ["fremd:\n  - x\n", "fremd:\n  a: b\n", "fremd:\n  - 1234567\n", "fremd:\n  - {a: b}\n", "fremd: [x]\n", "fremd: {a: b}\n"] {
            let a = lesen("0001-x.md", &mit_kopf(kopf)).unwrap();
            let text = schreiben(&a);
            assert_eq!(lesen("0001-x.md", &text).unwrap_or_else(|e| panic!("{kopf:?} → {text:?}: {e:?}")), a);
        }
    }

    const COMMITS: &str = "commits:\n  - kd:3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e\n  - 9c6b91f5d0e3a2b1c4d5e6f7a8b9c0d1e2f3a4b5\n  - kd:zz\n  - '1234567890123456789012345678901234567890'\n";

    // R00202 B0989, ADR-0032 Punkt 1: `commits` ist ein bekannter Schlüssel — wörtlich in Dateireihenfolge, der Ziffern-Hash als Text
    #[test]
    fn commits_wortlich_in_dateireihenfolge() {
        let a = lesen("0001-x.md", &mit_kopf(COMMITS)).unwrap();
        assert_eq!(a.commits, ["kd:3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e", "9c6b91f5d0e3a2b1c4d5e6f7a8b9c0d1e2f3a4b5", "kd:zz", "1234567890123456789012345678901234567890"]);
        assert!(a.weitere.is_empty(), "commits ist ein bekannter Schlüssel");
        assert_eq!(schreiben(&a), mit_kopf(COMMITS), "zeichengleich");
    }

    // ADR-0032 Punkt 1: Blockliste hinter cost-entries; dieselbe Schreibweise wie die Vorversion (serde_yaml) — so übersteht
    // die Datei auch den Rundlauf dort (AK 9c)
    #[test]
    fn commits_hinter_cost_entries_in_der_schreibweise_der_vorversion() {
        let t = mit_kopf(&format!("{EINTRAEGE}{COMMITS}archived: 2026-11-14\n"));
        assert_eq!(schreiben(&lesen("0001-x.md", &t).unwrap()), t);
        let mut a = lesen("0001-x.md", &mit_kopf("")).unwrap();
        a.commits = ["kd:abc1234", "1234567", "1e10", "true", "kd:a b", "x # y", "zeile\nzwei", "'", "-", "null", "kd:3F2A9C1"].map(String::from).to_vec();
        let text = schreiben(&a);
        let zurueck = lesen("0001-x.md", &text).unwrap_or_else(|e| panic!("{text}: {e:?}"));
        assert_eq!(zurueck.commits, a.commits, "{text}");
        let wie_vorher = serde_yaml::to_string(&serde_yaml::Value::Sequence(a.commits.iter().filter(|c| !c.contains('\n')).map(|c| serde_yaml::Value::String(c.clone())).collect())).unwrap();
        for zeile in wie_vorher.lines() {
            assert!(text.contains(&format!("\n  {zeile}\n")), "{zeile:?} wie serde_yaml in:\n{text}");
        }
        assert!(!schreiben(&lesen("0001-x.md", &mit_kopf("commits: []\n")).unwrap()).contains("commits"), "leer heißt kein Schlüssel");
    }

    // ADR-0032 Punkt 1: was keine Liste von Texten ist, macht die Aufgabe nicht defekt und bleibt wörtlich — als unbekannter Schlüssel
    #[test]
    fn commits_ohne_liste_von_texten_bleibt_als_unbekannter_schluessel() {
        for kopf in ["commits: kd:abc1234\n", "commits:\n  - 1234567\n", "commits:\n  - {a: b}\n"] {
            let t = mit_kopf(kopf);
            let a = lesen("0001-x.md", &t).unwrap_or_else(|e| panic!("{kopf}: {e:?}"));
            assert!(a.commits.is_empty(), "{kopf}");
            assert_eq!(a.weitere.iter().map(|(k, _)| k.as_str()).collect::<Vec<_>>(), ["commits"], "{kopf}");
            assert_eq!(lesen("0001-x.md", &schreiben(&a)).unwrap(), a, "{kopf}");
        }
    }

    // Legacy-Befund (Karte #207): die Vorversion schrieb Liste oder Zuordnung mit einem Eintrag in die Schlüsselzeile
    // (`k: - x`, `k: a: b`). Der Leser liest das wie den Block darunter — für `commits` und unbekannte Schlüssel
    #[test]
    fn schluesselzeile_mit_einem_eintrag_der_vorversion_wird_wie_der_block_gelesen() {
        let heil = lesen("0001-x.md", &mit_kopf("commits:\n  - kd:abc1234\n")).unwrap();
        let a = lesen("0001-x.md", &mit_kopf("commits: - kd:abc1234\n")).unwrap();
        assert_eq!(a, heil);
        assert_eq!(schreiben(&a), mit_kopf("commits:\n  - kd:abc1234\n"), "beim Schreiben die Blockform");

        let fremd = lesen("0001-x.md", &mit_kopf("fremd: - eins\nandere: a: b\n")).unwrap();
        assert_eq!(fremd, lesen("0001-x.md", &mit_kopf("fremd:\n  - eins\nandere:\n  a: b\n")).unwrap());
        assert_eq!(schreiben(&fremd), mit_kopf("fremd:\n  - eins\nandere:\n  a: b\n"));
    }

    // Ein Wert, der nur so aussieht, wird nicht umgedeutet: bekannte Schlüssel bleiben defekt wie bisher (kein stilles
    // Umdeuten eines Titels), angeführte Werte sind gültiges YAML und bleiben Text, Mehrdeutiges bleibt defekt
    #[test]
    fn werte_die_nur_so_aussehen_werden_nicht_umgedeutet() {
        assert!(lesen("0001-x.md", &mit_kopf("title: - x\n")).is_err(), "bekannter Schlüssel: defekt wie bisher");
        assert!(lesen("0001-x.md", &mit_kopf("title: a: b\n")).is_err());
        let a = lesen("0001-x.md", &"---\nid: 1\ntitle: \"- x\"\nfremd: \"- y\"\n---\n".to_string()).unwrap();
        assert_eq!(a.titel, "- x");
        assert_eq!(a.weitere, [("fremd".to_string(), serde_yaml::Value::String("- y".into()))]);
        for kopf in ["fremd: Achtung: wichtig: sehr\n", "fremd: - [a\n", "fremd: {a: b\n", "fremd: a b: c\n"] {
            assert!(lesen("0001-x.md", &mit_kopf(kopf)).is_err(), "{kopf:?} bleibt defekt");
        }
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
