//! `boards/<slug>.md` — Titel, Spalten als Überschriften, je Aufgabe eine Zeile.

use super::{Formatfehler, frontmatter, yaml};
use crate::modell::{Berichtsfilter, Bestandseinstellung, Board, ColumnOwnerEintrag, Eigentuemer, FIEBER_AUFLOESUNGEN, Fieber, Linie, Spalte, Staerke, Termin, ist_datum, ist_hexfarbe};
use serde_yaml::Value;

pub const ORDNER: &str = "boards";
/// Schalter „Transkripte erfassen“ (R00216, ADR-0036 Regel 4) — in der Board-Datei und als Vorgabe in `kanbanD.md`
pub const SCHALTER: &str = "record-transcripts";

/// Liest eine Board-Datei. Aufgabenzeilen sind Listenpunkte mit `#<nr>`; alles andere wird übergangen.
pub fn lesen(slug: &str, text: &str) -> Result<Board, Formatfehler> {
    let (y, koerper) = frontmatter::trennen(text)?;
    let m = yaml::lesen(y)?;
    let grenzen = yaml::zuordnung(&m, "limits");
    let notizen = yaml::zuordnung(&m, "column-notes");
    let farben = yaml::zuordnung(&m, "column-colors");
    let eigentuemer = yaml::zuordnung(&m, "column-owner");
    let datums = yaml::zuordnung(&m, "column-dates");
    // Rohfassung jedes `column-owner`-Eintrags (R00120): verwaiste Schlüssel bleiben so erhalten; ein Eintrag zu einer
    // vorhandenen Spalte fällt unten heraus, ein Nicht-Text-Wert wird dort als ungültig vermerkt.
    let mut eigentuemer_roh: Vec<ColumnOwnerEintrag> = match m.get("column-owner") {
        None => vec![],
        Some(v) => match v.as_mapping() {
            Some(map) => map.iter().map(|(k, w)| ColumnOwnerEintrag { schluessel: Some(schluessel_text(k)).filter(|k| !k.is_empty()), wert: w.clone() }).collect(),
            None => vec![ColumnOwnerEintrag { schluessel: None, wert: v.clone() }],
        },
    };
    let mut roh_ungueltig: Vec<ColumnOwnerEintrag> = vec![];
    let termine = termine_lesen(m.get("milestones"))?;
    let start = match yaml::text(&m, "start") {
        Some(d) if !ist_datum(&d) => return Err(Formatfehler(format!("start „{d}“ ist nicht JJJJ-MM-TT"))),
        d => d,
    };
    let archiviert = match yaml::text(&m, "archived") {
        Some(d) if !ist_datum(&d) => return Err(Formatfehler(format!("archived „{d}“ ist nicht JJJJ-MM-TT"))),
        d => d,
    };
    let fieber = fieber_lesen(m.get("fever"))?;
    let berichtsfilter = berichtsfilter_lesen(m.get("report-filter"))?;
    let bestand = bestand_lesen(m.get("report-labels"))?;
    let anwendungen = m.get("applications").filter(|v| !v.is_null()).map(|_| yaml::textliste(&m, "applications"));
    let klassen = super::einstellungen::klassen_lesen(&m)?;
    let transkripte_erfassen = schalter_lesen(&m)?;
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
            let notiz = notizen.and_then(|p| p.get(name.as_str())).and_then(yaml::wert_als_text).map(|t| t.trim().to_string()).filter(|t| !t.is_empty());
            let farbe = farben.and_then(|p| p.get(name.as_str())).and_then(yaml::wert_als_text).map(|t| t.trim().to_string()).filter(|f| ist_hexfarbe(f));
            let (eigentuemer, eigentuemer_unbekannt) = match eigentuemer.and_then(|e| e.get(name.as_str())) {
                Some(v) => match yaml::wert_als_text(v).map(|t| t.trim().to_string()).filter(|t| !t.is_empty()) {
                    Some(t) => match Eigentuemer::aus(&t) {
                        Some(e) => (Some(e), None),
                        None => (None, Some(t)),
                    },
                    None => {
                        roh_ungueltig.push(ColumnOwnerEintrag { schluessel: Some(name.clone()), wert: v.clone() });
                        (None, None)
                    }
                },
                None => (None, None),
            };
            let trenner = datums.and_then(|t| t.get(name.as_str())).and_then(Value::as_bool);
            spalten.push(Spalte { name, grenze, aufgaben: vec![], notiz, farbe, eigentuemer, eigentuemer_unbekannt, datums_trenner: trenner });
        } else if let Some(nr) = aufgabennummer(z) {
            let Some(spalte) = spalten.last_mut() else {
                return Err(Formatfehler(format!("Aufgabe #{nr} steht vor der ersten Spalte")));
            };
            spalte.aufgaben.push(nr);
        }
    }
    // Nur Einträge ohne eigene Spalte bleiben roh; die ungültigen Nicht-Text-Werte treten dazu (R00120).
    eigentuemer_roh.retain(|e| e.schluessel.as_ref().is_none_or(|k| !spalten.iter().any(|s| &s.name == k)));
    eigentuemer_roh.extend(roh_ungueltig);
    Ok(Board { slug: slug.to_string(), titel: titel.unwrap_or_else(|| slug.to_string()), spalten, termine, anwendungen, klassen, start, fieber, berichtsfilter, bestand, eigentuemer_roh, archiviert, transkripte_erfassen })
}

/// `record-transcripts` (R00216, ADR-0036 Regel 4) der Board-Datei oder von `kanbanD.md`: `true`/`false`; fehlt er oder ist
/// er `null`, `None`. Ein anderer Wert ist ein Formatfehler — still „aus“ zu lesen und beim Schreiben zu verlieren wäre
/// ein Verlust, still „an“ ein Einschalten, das niemand gewollt hat.
pub(crate) fn schalter_lesen(m: &serde_yaml::Mapping) -> Result<Option<bool>, Formatfehler> {
    match m.get(SCHALTER) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Bool(b)) => Ok(Some(*b)),
        Some(v) => Err(Formatfehler(format!("{SCHALTER} „{}“ ist weder true noch false", yaml::anzeige(v)))),
    }
}

/// Setzt `record-transcripts` im Text einer Datei mit Frontmatter und lässt alles andere zeichengleich (R00220 FA 4,
/// Nacharbeit 1): der einzeilige Abschnitt über `frontmatter::abschnitt_im_text` (ADR-0043 Regel 1, R00250 B1316).
/// Ob danach wirklich der Wert gilt, prüft der Aufrufer beim Lesen.
pub fn schalter_im_text(text: &str, wert: Option<bool>) -> String {
    let zeile = wert.map(|b| format!("{SCHALTER}: {b}"));
    frontmatter::abschnitt_im_text(text, SCHALTER, zeile.as_deref())
}

/// Der Schalter als Zeile mit Zeilenende, oder nichts.
pub(crate) fn schalter_zeile(schalter: Option<bool>) -> String {
    schalter.map(|b| format!("{SCHALTER}: {b}\n")).unwrap_or_default()
}

/// Ein Schlüssel unter `column-owner` als Text: ein Skalar roh, ein Nicht-Text-Schlüssel (`[a, b]: human`) in
/// YAML-Flussform, damit der Eintrag als verwaister Schlüssel gemeldet und erhalten bleibt (R00120).
fn schluessel_text(v: &Value) -> String {
    yaml::wert_als_text(v).unwrap_or_else(|| yaml::anzeige(v))
}

/// Den schlüssellosen `column-owner`-Wert im Ersatzschlüssel-Slot merken (B1/B2): der erste bleibt, ein human-Wert
/// verdrängt einen anderen (fail-safe, PO Z. 187), damit ein Board seine Sperre beim Schreiben nicht verliert.
fn merke_schluessellos(slot: &mut Option<(String, bool)>, eintrag: &ColumnOwnerEintrag) {
    let meint_human = eintrag.meint_human();
    if slot.is_none() || (meint_human && !slot.as_ref().is_some_and(|(_, human)| *human)) {
        *slot = Some((yaml::wert(&eintrag.wert), meint_human));
    }
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
            let ziel = match m.get("target") {
                None => false,
                Some(Value::Bool(b)) => *b,
                Some(_) => return Err(Formatfehler("milestones: target ist nicht true oder false".into())),
            };
            let t = Termin { name: wahl("name").unwrap_or_default(), datum: wahl("date").unwrap_or_default(), farbe: wahl("color").unwrap_or_else(|| "red".into()), linie, staerke, ziel };
            t.pruefen().map_err(|f| Formatfehler(format!("milestones: {f}")))?;
            Ok(t)
        })
        .collect::<Result<Vec<Termin>, Formatfehler>>()
        .and_then(|termine| match termine.iter().filter(|t| t.ziel).count() {
            0 | 1 => Ok(termine),
            _ => Err(Formatfehler("milestones: mehr als ein Zieltermin (target: true)".into())),
        })
}

/// `fever:` — `{buffer, percentile, week, yellow: [bei 0 %, bei 100 %], red: […], resolution, target-column, from-column, self-labels}`; fehlende Werte
/// sind der Standard (R00078); unbekannte Schlüssel sind kein Fehler.
fn fieber_lesen(v: Option<&Value>) -> Result<Fieber, Formatfehler> {
    let mut f = Fieber::default();
    let Some(v) = v.filter(|v| !v.is_null()) else { return Ok(f) };
    let m = v.as_mapping().ok_or_else(|| Formatfehler("fever ist keine Zuordnung".into()))?;
    let zahl = |schluessel: &str| -> Result<Option<u32>, Formatfehler> {
        match m.get(schluessel) {
            None => Ok(None),
            Some(w) => w.as_u64().and_then(|z| u32::try_from(z).ok()).map(Some).ok_or_else(|| Formatfehler(format!("fever: {schluessel} ist keine ganze Zahl"))),
        }
    };
    let paar = |schluessel: &str| -> Result<Option<[u32; 2]>, Formatfehler> {
        let Some(w) = m.get(schluessel) else { return Ok(None) };
        let zahlen: Option<Vec<u32>> = w.as_sequence().map(|l| l.iter().filter_map(|z| z.as_u64().and_then(|z| u32::try_from(z).ok())).collect());
        match zahlen.as_deref() {
            Some([a, b]) if w.as_sequence().map(Vec::len) == Some(2) => Ok(Some([*a, *b])),
            _ => Err(Formatfehler(format!("fever: {schluessel} ist nicht [bei 0 %, bei 100 %]"))),
        }
    };
    f.puffer = zahl("buffer")?;
    if let Some(p) = zahl("percentile")? {
        f.perzentil = p;
    }
    if let Some(w) = zahl("week")? {
        f.woche = w;
    }
    if let Some(g) = paar("yellow")? {
        f.gelb = g;
    }
    if let Some(r) = paar("red")? {
        f.rot = r;
    }
    f.zielspalte = yaml::text(m, "target-column");
    f.vonspalte = yaml::text(m, "from-column");
    f.selbstlabels = yaml::textliste(m, "self-labels");
    if let Some(a) = yaml::text(m, "resolution") {
        f.aufloesung = FIEBER_AUFLOESUNGEN.iter().find(|(_, n)| *n == a).map(|(t, _)| *t).ok_or_else(|| Formatfehler(format!("fever: resolution „{a}“ ist nicht day, week oder month")))?;
    }
    f.pruefen().map_err(|e| Formatfehler(format!("fever: {e}")))?;
    Ok(f)
}

/// `report-filter:` — `{period, from, to, exclude-classes, exclude-columns, people, labels, window-days}` (R00081), seit
/// R00171 dazu `cost-from-column` und `cost-to-column`, der Spaltenabschnitt des Berichts „Kosten“.
fn berichtsfilter_lesen(v: Option<&Value>) -> Result<Berichtsfilter, Formatfehler> {
    let mut f = Berichtsfilter::default();
    let Some(v) = v.filter(|v| !v.is_null()) else { return Ok(f) };
    let m = v.as_mapping().ok_or_else(|| Formatfehler("report-filter ist keine Zuordnung".into()))?;
    if let Some(z) = yaml::text(m, "period") {
        f.zeitraum = z;
    }
    f.von = yaml::text(m, "from").unwrap_or_default();
    f.bis = yaml::text(m, "to").unwrap_or_default();
    f.ohne_farben = yaml::textliste(m, "exclude-classes");
    f.ohne_spalten = yaml::textliste(m, "exclude-columns");
    f.personen = yaml::textliste(m, "people");
    f.labels = yaml::textliste(m, "labels");
    if let Some(n) = m.get("window-days") {
        f.messbasis_tage = n.as_u64().and_then(|n| u32::try_from(n).ok()).ok_or_else(|| Formatfehler("report-filter: window-days ist keine ganze Zahl".into()))?;
    }
    f.kosten_von_spalte = yaml::text(m, "cost-from-column").unwrap_or_default();
    f.kosten_bis_spalte = yaml::text(m, "cost-to-column").unwrap_or_default();
    f.pruefen().map_err(|e| Formatfehler(format!("report-filter: {e}")))?;
    Ok(f)
}

/// `report-labels:` — `{rows, columns}`, die Achsen des Berichts „Bestand nach Labels“ (R00100); beide Präfixe als Text.
fn bestand_lesen(v: Option<&Value>) -> Result<Option<Bestandseinstellung>, Formatfehler> {
    let Some(v) = v.filter(|v| !v.is_null()) else { return Ok(None) };
    let m = v.as_mapping().ok_or_else(|| Formatfehler("report-labels ist keine Zuordnung".into()))?;
    let praefix = |schluessel: &str| yaml::text(m, schluessel).ok_or_else(|| Formatfehler(format!("report-labels: {schluessel} fehlt oder ist kein Text")));
    Ok(Some(Bestandseinstellung { zeilen: praefix("rows")?, spalten: praefix("columns")? }))
}

fn bestand_zeile(b: &Option<Bestandseinstellung>) -> Option<String> {
    b.as_ref().map(|b| format!("report-labels: {{rows: {}, columns: {}}}\n", yaml::skalar(&b.zeilen), yaml::skalar(&b.spalten)))
}

fn berichtsfilter_zeile(f: &Berichtsfilter) -> Option<String> {
    let mut teile = vec![];
    if f.zeitraum != Berichtsfilter::default().zeitraum {
        teile.push(format!("period: {}", yaml::skalar(&f.zeitraum)));
    }
    for (schluessel, d) in [("from", &f.von), ("to", &f.bis)] {
        if !d.is_empty() {
            teile.push(format!("{schluessel}: {d}"));
        }
    }
    for (schluessel, l) in [("exclude-classes", &f.ohne_farben), ("exclude-columns", &f.ohne_spalten), ("people", &f.personen), ("labels", &f.labels)] {
        if !l.is_empty() {
            teile.push(format!("{schluessel}: {}", yaml::liste(l)));
        }
    }
    if f.messbasis_tage != Berichtsfilter::messbasis_standard() {
        teile.push(format!("window-days: {}", f.messbasis_tage));
    }
    for (schluessel, spalte) in [("cost-from-column", &f.kosten_von_spalte), ("cost-to-column", &f.kosten_bis_spalte)] {
        if !spalte.is_empty() {
            teile.push(format!("{schluessel}: {}", yaml::skalar(spalte)));
        }
    }
    (!teile.is_empty()).then(|| format!("report-filter: {{{}}}\n", teile.join(", ")))
}

/// Nur was gesetzt bzw. vom Standard verschieden ist; `None`, wenn alles Standard ist.
fn fieber_zeile(f: &Fieber) -> Option<String> {
    let s = Fieber::default();
    let mut teile = vec![];
    if let Some(p) = f.puffer {
        teile.push(format!("buffer: {p}"));
    }
    if f.perzentil != s.perzentil {
        teile.push(format!("percentile: {}", f.perzentil));
    }
    if f.woche != s.woche {
        teile.push(format!("week: {}", f.woche));
    }
    if f.gelb != s.gelb {
        teile.push(format!("yellow: [{}, {}]", f.gelb[0], f.gelb[1]));
    }
    if f.rot != s.rot {
        teile.push(format!("red: [{}, {}]", f.rot[0], f.rot[1]));
    }
    if f.aufloesung != s.aufloesung
        && let Some((_, name)) = FIEBER_AUFLOESUNGEN.iter().find(|(t, _)| *t == f.aufloesung)
    {
        teile.push(format!("resolution: {name}"));
    }
    if let Some(z) = &f.zielspalte {
        teile.push(format!("target-column: {}", yaml::skalar(z)));
    }
    if let Some(v) = &f.vonspalte {
        teile.push(format!("from-column: {}", yaml::skalar(v)));
    }
    if !f.selbstlabels.is_empty() {
        teile.push(format!("self-labels: {}", yaml::liste(&f.selbstlabels)));
    }
    (!teile.is_empty()).then(|| format!("fever: {{{}}}\n", teile.join(", ")))
}

fn termin_zeile(t: &Termin) -> String {
    let linie = LINIEN.iter().find(|(_, x)| *x == t.linie).map(|(k, _)| *k).unwrap_or("solid");
    let staerke = STAERKEN.iter().find(|(_, x)| *x == t.staerke).map(|(k, _)| *k).unwrap_or("normal");
    let ziel = if t.ziel { ", target: true" } else { "" };
    format!("  - {{name: {}, date: {}, color: {}, line: {linie}, width: {staerke}{ziel}}}\n", yaml::skalar(&t.name), t.datum, yaml::skalar(&t.farbe))
}

/// `- [#12](…)`, `- #12 Text`, `* #12` → 12
pub(crate) fn aufgabennummer(zeile: &str) -> Option<u32> {
    let rest = zeile.trim_start().strip_prefix("- ").or_else(|| zeile.trim_start().strip_prefix("* "))?;
    let rest = rest.trim_start().strip_prefix('[').unwrap_or(rest.trim_start());
    let ziffern: String = rest.strip_prefix('#')?.chars().take_while(char::is_ascii_digit).collect();
    ziffern.parse().ok()
}

/// Schreibt die Board-Datei. `datei` nennt je Nummer den Dateinamen der Aufgabe (ohne Ordner), falls bekannt.
pub fn schreiben(b: &Board, datei: impl Fn(u32) -> Option<String>) -> String {
    let mut s = String::new();
    let grenzen: Vec<&Spalte> = b.spalten.iter().filter(|sp| sp.grenze.is_some()).collect();
    let notizen: Vec<(&str, &str)> = b.spalten.iter().filter_map(|sp| sp.notiz.as_deref().map(|n| (sp.name.as_str(), n))).collect();
    let farben: Vec<(&str, &str)> = b.spalten.iter().filter_map(|sp| sp.farbe.as_deref().map(|f| (sp.name.as_str(), f))).collect();
    let daten: Vec<(&str, bool)> = b.spalten.iter().filter_map(|sp| sp.datums_trenner.map(|t| (sp.name.as_str(), t))).collect();
    // `column-owner` (R00097, R00120/B1/B2): Spalten mit gültigem oder unbekanntem Eigentümer in Reihenfolge, dann die
    // rohen Einträge. Ein Rohschlüssel, der auf eine Spalte trifft, erzeugt keinen doppelten YAML-Schlüssel — er löst
    // sich schlüssellos auf. `schluessellos` ist der Wert, der unter dem Ersatzschlüssel `""` steht: ein `column-owner`
    // ohne Zuordnung (`None`) wandert dorthin, sobald eine Zuordnung daneben steht (der Skalar kann sie sonst nicht
    // tragen, B1); ein human-Wert hat dabei Vorrang (fail-safe, PO Z. 187).
    let mut besitzer: Vec<(String, String)> = b.spalten.iter().filter_map(|sp| sp.eigentuemer.map(Eigentuemer::name).or(sp.eigentuemer_unbekannt.as_deref()).map(|e| (sp.name.clone(), yaml::skalar(e)))).collect();
    let mut schluessellos: Option<(String, bool)> = None;
    for e in &b.eigentuemer_roh {
        match &e.schluessel {
            None => merke_schluessellos(&mut schluessellos, e),
            Some(k) if besitzer.iter().any(|(n, _)| n == k) => merke_schluessellos(&mut schluessellos, e),
            Some(k) => besitzer.push((k.clone(), yaml::wert(&e.wert))),
        }
    }
    let fieber = fieber_zeile(&b.fieber);
    let berichtsfilter = berichtsfilter_zeile(&b.berichtsfilter);
    let bestand = bestand_zeile(&b.bestand);
    if !grenzen.is_empty() || !notizen.is_empty() || !farben.is_empty() || !daten.is_empty() || !besitzer.is_empty() || schluessellos.is_some() || !b.termine.is_empty() || b.anwendungen.is_some() || b.klassen.is_some() || b.start.is_some() || b.archiviert.is_some() || fieber.is_some() || berichtsfilter.is_some() || bestand.is_some() || b.transkripte_erfassen.is_some() {
        s.push_str("---\n");
        if let Some(klassen) = &b.klassen {
            s.push_str(&super::einstellungen::klassen_schreiben(klassen));
            s.push('\n');
        }
        if let Some(anwendungen) = &b.anwendungen {
            s.push_str(&format!("applications: {}\n", yaml::liste(anwendungen)));
        }
        if !grenzen.is_empty() {
            s.push_str("limits:\n");
            for sp in grenzen {
                s.push_str(&format!("  {}: {}\n", yaml::skalar(&sp.name), sp.grenze.unwrap_or_default()));
            }
        }
        for (schluessel, eintraege) in [("column-notes", &notizen), ("column-colors", &farben)] {
            if !eintraege.is_empty() {
                s.push_str(&format!("{schluessel}:\n"));
                for (spalte, wert) in eintraege.iter() {
                    s.push_str(&format!("  {}: {}\n", yaml::skalar(spalte), yaml::skalar(wert)));
                }
            }
        }
        if !daten.is_empty() {
            s.push_str("column-dates:\n");
            for (spalte, wert) in daten {
                s.push_str(&format!("  {}: {wert}\n", yaml::skalar(spalte)));
            }
        }
        // Ohne jede Zuordnung bleibt der rohe `column-owner`-Wert ein Skalar (keine Zuordnung, unverändert); sobald eine
        // Zuordnung daneben steht, wandert der schlüssellose Wert unter den Ersatzschlüssel `""` (kein Doppelschlüssel,
        // B1/B2). Der Ersatzschlüssel liest sich als „keine Zuordnung“ zurück.
        if besitzer.is_empty() && let Some((wert, _)) = &schluessellos {
            s.push_str(&format!("column-owner: {wert}\n"));
        } else if !besitzer.is_empty() || schluessellos.is_some() {
            s.push_str("column-owner:\n");
            for (spalte, wert) in &besitzer {
                s.push_str(&format!("  {}: {wert}\n", yaml::skalar(spalte)));
            }
            if let Some((wert, _)) = &schluessellos {
                s.push_str(&format!("  {}: {wert}\n", yaml::skalar("")));
            }
        }
        if !b.termine.is_empty() {
            s.push_str("milestones:\n");
            for t in &b.termine {
                s.push_str(&termin_zeile(t));
            }
        }
        if let Some(start) = &b.start {
            s.push_str(&format!("start: {start}\n"));
        }
        if let Some(datum) = &b.archiviert {
            s.push_str(&format!("archived: {datum}\n"));
        }
        if let Some(f) = fieber {
            s.push_str(&f);
        }
        if let Some(f) = berichtsfilter {
            s.push_str(&f);
        }
        if let Some(z) = bestand {
            s.push_str(&z);
        }
        s.push_str(&schalter_zeile(b.transkripte_erfassen));
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
                Spalte { name: "Zu erledigen".into(), grenze: None, aufgaben: vec![1, 2], ..Default::default() },
                Spalte { name: "In Arbeit".into(), grenze: Some(3), aufgaben: vec![3], ..Default::default() },
                Spalte { name: "Erledigt".into(), grenze: None, aufgaben: vec![], ..Default::default() },
            ],
            termine: vec![],
            anwendungen: None, klassen: None,
            start: None,
            fieber: Default::default(), berichtsfilter: Default::default(), bestand: None,
            eigentuemer_roh: vec![],
            archiviert: None,
            transkripte_erfassen: None,
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
            Termin { name: "Deadline".into(), datum: "2027-10-31".into(), farbe: "red".into(), linie: Linie::Durchgehend, staerke: Staerke::Fett, ziel: false },
            Termin { name: "Review: Kunde".into(), datum: "2026-11-15".into(), farbe: "#2a78d6".into(), linie: Linie::Gestrichelt, staerke: Staerke::Fein, ziel: false },
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
    fn gebundene_anwendungen_rundlauf() {
        let mut b = beispiel();
        b.anwendungen = Some(vec!["kd".into(), "kc".into()]);
        let t = schreiben(&b, datei);
        assert!(t.starts_with("---\napplications: [kd, kc]\nlimits:\n"), "{t}");
        assert_eq!(lesen("entwicklung", &t).unwrap(), b);
        assert_eq!(schreiben(&lesen("entwicklung", &t).unwrap(), datei), t);
        assert!(!schreiben(&beispiel(), datei).contains("applications"));
    }

    #[test]
    fn fehlende_und_leere_anwendungsliste_sind_verschieden() {
        assert_eq!(lesen("b", "## A\n").unwrap().anwendungen, None, "fehlender Schlüssel = Standard");
        assert_eq!(lesen("b", "---\nlimits: {A: 2}\n---\n## A\n").unwrap().anwendungen, None);
        assert_eq!(lesen("b", "---\napplications: []\n---\n## A\n").unwrap().anwendungen, Some(vec![]), "[] = ausdrücklich keine");
        let mut b = beispiel();
        b.anwendungen = Some(vec![]);
        let t = schreiben(&b, datei);
        assert!(t.starts_with("---\napplications: []\nlimits:\n"), "{t}");
        assert_eq!(lesen("entwicklung", &t).unwrap(), b);
        b.spalten[1].grenze = None;
        assert!(schreiben(&b, datei).starts_with("---\napplications: []\n---\n"), "auch ohne andere Schlüssel");
    }

    /// R00195 AK 1, 2 (ADR-0031 Regel 1, 4): `classes` der Board-Datei — ohne, mit mehreren, mit `{}` zeichengleich.
    #[test]
    fn klassen_des_boards_rundlauf_zeichengleich() {
        let mehrere = "---\nclasses:\n  etappe1: {label: Etappe 1, color: green}\n  eol: {label: Altlast, color: \"#885500\"}\nlimits:\n  In Arbeit: 3\n---\n\n# Umzug\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n";
        let leer = "---\nclasses: {}\n---\n\n# Umzug\n\n## Zu erledigen\n";
        let ohne = "---\nlimits:\n  In Arbeit: 3\n---\n\n# Umzug\n\n## Zu erledigen\n\n## In Arbeit\n";
        let ganz_ohne = "# Umzug\n\n## Zu erledigen\n";
        for text in [mehrere, leer, ohne, ganz_ohne] {
            assert_eq!(schreiben(&lesen("umzug", text).unwrap(), |_| None), text);
        }
        let satz = lesen("umzug", mehrere).unwrap().klassen.expect("eigener Satz");
        assert_eq!(satz.iter().map(|k| (k.schluessel.as_str(), k.bezeichnung.as_str(), k.farbe.as_str())).collect::<Vec<_>>(), vec![("etappe1", "Etappe 1", "green"), ("eol", "Altlast", "#885500")], "Dateireihenfolge");
        assert_eq!(lesen("umzug", leer).unwrap().klassen, Some(vec![]), "classes: {{}} = ausdrücklich keine");
        assert_eq!(lesen("umzug", ohne).unwrap().klassen, None, "fehlender Schlüssel = Vorgabe des Ordners");
        assert_eq!(lesen("umzug", ganz_ohne).unwrap().klassen, None);
        assert!(lesen("umzug", "---\nclasses:\n  x: 5\n---\n## A\n").is_err(), "kein stiller Verlust einer unlesbaren Klasse");
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

    // ADR-0034 Regel 2, N4 Regel 3 (R00223): `column-phases` ist ein unbekannter Schlüssel des Boards — überlesen, und beim
    // nächsten Schreiben fehlt er; auch eine Form, die keine Zuordnung ist, ist kein Fehler.
    #[test]
    fn alter_spaltenschluessel_wird_ueberlesen_und_fehlt_beim_schreiben() {
        const ALT: &str = "column-phases"; // der Schlüssel aus R00058, seit ADR-0034 N4 unbekannt
        let eintraege = "  In Arbeit: Entwicklung\n  \"Abnahme: Mia\": Abnahme\n";
        let mit = format!("---\nlimits:\n  In Arbeit: 3\n{ALT}:\n{eintraege}---\n\n# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Abnahme: Mia\n");
        let ohne = mit.replace(&format!("{ALT}:\n{eintraege}"), "");
        let g = lesen("entwicklung", &mit).unwrap();
        assert_eq!(g, lesen("entwicklung", &ohne).unwrap(), "gelesen wie ohne den Schlüssel");
        let t = schreiben(&g, datei);
        assert!(!t.contains(ALT) && t.starts_with("---\nlimits:\n  In Arbeit: 3\n---\n"), "{t}");
        assert!(lesen("b", &format!("---\n{ALT}: [Abnahme]\n---\n## A\n")).is_ok());
    }

    // R00222 (ADR-0034 Regel 2): `column-checks` wird überlesen und fällt beim nächsten Schreiben des Boards weg.
    #[test]
    fn column_checks_wird_ueberlesen_und_nicht_geschrieben() {
        let t = "---\nlimits:\n  A: 2\ncolumn-checks:\n  A: [wbs-effects-green]\n---\n\n# B\n\n## A\n\n## B\n";
        let b = lesen("b", t).unwrap();
        assert_eq!(b.spalten.iter().map(|s| (s.name.as_str(), s.grenze)).collect::<Vec<_>>(), [("A", Some(2)), ("B", None)]);
        let neu = schreiben(&b, datei);
        assert!(!neu.contains("column-checks") && !neu.contains("wbs-effects-green"), "{neu}");
        assert!(neu.starts_with("---\nlimits:\n  A: 2\n---\n"), "{neu}");
    }

    #[test]
    fn spaltenkommentar_und_farbe_im_frontmatter_rundlauf() {
        let mut b = beispiel();
        b.spalten[1].notiz = Some("höchstens zwei: gleichzeitig".into());
        b.spalten[1].farbe = Some("#ffe8b0".into());
        let t = schreiben(&b, datei);
        assert!(t.contains("column-notes:\n  In Arbeit: \"höchstens zwei: gleichzeitig\"\ncolumn-colors:\n  In Arbeit: \"#ffe8b0\"\n---\n"), "{t}");
        assert_eq!(lesen("entwicklung", &t).unwrap(), b);
        let g = lesen("b", "---\ncolumn-notes: {A: \"  \"}\ncolumn-colors: {A: rot, B: \"#00ff00\"}\n---\n## A\n## B\n").unwrap();
        assert_eq!(g.spalten.iter().map(|s| (s.notiz.clone(), s.farbe.clone())).collect::<Vec<_>>(), [(None, None), (None, Some("#00ff00".to_string()))], "leerer Kommentar und ungültige Farbe fallen weg");
    }

    // R00124 B0579: `column-dates` im Frontmatter (Muster column-checks); fehlender Schlüssel heißt „Standard“ (None)
    #[test]
    fn datums_trenner_im_frontmatter_rundlauf() {
        let mut b = beispiel();
        b.spalten[0].datums_trenner = Some(true);
        b.spalten[1].datums_trenner = Some(false);
        let t = schreiben(&b, datei);
        assert!(t.contains("column-dates:\n  Zu erledigen: true\n  In Arbeit: false\n---\n"), "in Spaltenreihenfolge: {t}");
        assert_eq!(lesen("entwicklung", &t).unwrap(), b, "Rundlauf verlustfrei");
        assert!(!schreiben(&beispiel(), datei).contains("column-dates"), "ohne Eintrag kein Schlüssel");
        let g = lesen("b", "---\ncolumn-dates: {A: true, B: nein}\n---\n## A\n## B\n").unwrap();
        assert_eq!(g.spalten.iter().map(|s| s.datums_trenner).collect::<Vec<_>>(), [Some(true), None], "nur ein Wahrheitswert gilt");
    }

    #[test]
    fn spalteneigentuemer_im_frontmatter_rundlauf() {
        let mut b = beispiel();
        b.spalten[0].eigentuemer = Some(Eigentuemer::Human);
        b.spalten[1].eigentuemer = Some(Eigentuemer::Agent);
        let t = schreiben(&b, datei);
        assert!(t.contains("column-owner:\n  Zu erledigen: human\n  In Arbeit: agent\n---\n"), "in Spaltenreihenfolge: {t}");
        assert_eq!(lesen("entwicklung", &t).unwrap(), b);
        assert_eq!(schreiben(&lesen("entwicklung", &t).unwrap(), datei), t);
        assert!(!schreiben(&beispiel(), datei).contains("column-owner"), "ohne Eintrag kein Schlüssel");
    }

    #[test]
    fn unbekannter_eigentuemer_gilt_nicht_und_bleibt_in_der_datei() {
        let g = lesen("b", "---\ncolumn-owner: {Eingang: chef, B: agent, Fehlt: human}\n---\n## Eingang\n## B\n").unwrap();
        let gelesen: Vec<(Option<Eigentuemer>, Option<&str>)> = g.spalten.iter().map(|s| (s.eigentuemer, s.eigentuemer_unbekannt.as_deref())).collect();
        assert_eq!(gelesen, [(None, Some("chef")), (Some(Eigentuemer::Agent), None)], "chef ist kein Eigentümer, agent gilt");
        assert!(schreiben(&g, |_| None).contains("column-owner:\n  Eingang: chef\n  B: agent\n  Fehlt: human\n"), "die Datei verliert nichts: {}", schreiben(&g, |_| None));
        assert_eq!(g.eigentuemer_roh, [ColumnOwnerEintrag { schluessel: Some("Fehlt".into()), wert: "human".into() }], "der verwaiste Schlüssel bleibt roh erhalten");
    }

    // R00120 AK 1–3: verwaister Schlüssel, Nicht-Text-Wert und `column-owner` ohne Zuordnung bleiben roh erhalten
    #[test]
    fn verwaiste_und_ungueltige_column_owner_bleiben_im_rundlauf() {
        for (name, text, erwartet_roh, erwartet_datei) in [
            ("verwaister Schlüssel", "---\ncolumn-owner:\n  eingang: human\n---\n", ("eingang", "human"), "column-owner:\n  eingang: human\n"),
            ("Nicht-Text-Wert", "---\ncolumn-owner:\n  Eingang: [human]\n---\n", ("Eingang", "[human]"), "column-owner:\n  Eingang: [human]\n"),
            ("keine Zuordnung", "---\ncolumn-owner: human\n---\n", ("", "human"), "column-owner: human\n"),
        ] {
            let g = lesen("b", text).unwrap();
            assert!(g.spalten.iter().all(|s| s.eigentuemer.is_none()), "{name}: kein gültiger Eigentümer");
            let roh = &g.eigentuemer_roh;
            assert_eq!(roh.len(), 1, "{name}: {roh:?}");
            let (schluessel, wert) = erwartet_roh;
            assert_eq!((roh[0].schluessel.as_deref().unwrap_or(""), yaml::anzeige(&roh[0].wert).as_str()), (schluessel, wert), "{name}");
            assert!(roh[0].meint_human(), "{name}: meint den Menschen, sperrt fail-safe");
            let t = schreiben(&g, |_| None);
            assert!(t.contains(erwartet_datei), "{name}: {t}");
            assert_eq!(lesen("b", &t).unwrap().eigentuemer_roh, g.eigentuemer_roh, "{name}: Rundlauf");
        }
    }

    // R00120: ein `agent`- oder unbekannter Rohwert verwaist bleibt erhalten, sperrt aber nicht.
    #[test]
    fn verwaister_agent_und_unbekannter_wert_sperren_nicht() {
        for (text, wert) in [("---\ncolumn-owner: {eingang: agent}\n---\n", "agent"), ("---\ncolumn-owner: {Fehlt: chef}\n---\n", "chef")] {
            let g = lesen("b", text).unwrap();
            assert_eq!(g.eigentuemer_roh.len(), 1, "{text}");
            assert_eq!(g.eigentuemer_roh[0].wert, wert);
            assert!(!g.eigentuemer_roh[0].meint_human(), "{wert} sperrt nicht");
        }
    }

    // Karte #142: ein handgeschriebener `column-owner`-Rohwert mit YAML-Sonderzeichen bricht die Board-Datei beim
    // Schreiben nicht und bleibt zeichengleich erhalten (A00005, verlustfrei) — vorher wurde `[a] #human]` roh
    // ausgegeben und las sich danach als `[a]`, der Wert war verfälscht und die Sperre fiel.
    #[test]
    fn kaputte_column_owner_rohwerte_bleiben_heil() {
        for wert in ["[\"a] #human\"]", "[\"#human\"]", "\"a\\n---\\nb\"", "\"human\"", "human-owner", "\"human #x\""] {
            let text = format!("---\ncolumn-owner:\n  Eingang: {wert}\n---\n\n# B\n\n## Eingang\n\n- #1\n");
            let gelesen = lesen("b", &text).unwrap_or_else(|e| panic!("{wert}: nicht lesbar: {e:?}"));
            let geschrieben = schreiben(&gelesen, |_| None);
            let wieder = lesen("b", &geschrieben).unwrap_or_else(|e| panic!("{wert}: Datei nach dem Schreiben defekt: {e:?}\n{geschrieben}"));
            assert_eq!(wieder, gelesen, "{wert}: der Rundlauf verliert den Wert:\n{geschrieben}");
            assert_eq!(schreiben(&wieder, |_| None), geschrieben, "{wert}: der Rundlauf ist nicht stabil");
        }
    }

    // Karte #142 Nacharbeit B1: der namenlose Tag `!` bleibt beim Schreiben lesbar (`! human`, nicht `!! human`) —
    // sonst ist die Board-Datei nach jedem Schreibweg defekt (423). Vier Formen: gebunden, Liste, Zuordnung, ungebunden.
    #[test]
    fn namenloser_tag_bleibt_lesbar() {
        for (name, text) in [
            ("gebunden", "---\ncolumn-owner:\n  Eingang: ! human\n---\n\n# B\n\n## Eingang\n\n- #1\n"),
            ("Liste", "---\ncolumn-owner:\n  Eingang: [! human]\n---\n\n# B\n\n## Eingang\n\n- #1\n"),
            ("Zuordnung", "---\ncolumn-owner:\n  Eingang: {a: ! human}\n---\n\n# B\n\n## Eingang\n\n- #1\n"),
            ("ungebunden", "---\ncolumn-owner: ! human\n---\n\n# B\n\n## Eingang\n\n- #1\n"),
        ] {
            let gelesen = lesen("b", text).unwrap_or_else(|e| panic!("{name}: nicht lesbar: {e:?}"));
            assert!(gelesen.eigentuemer_roh.iter().any(|e| e.meint_human()), "{name}: der Tag meint den Menschen");
            let geschrieben = schreiben(&gelesen, |_| None);
            assert!(geschrieben.contains("! human") && !geschrieben.contains("!! human"), "{name}: Tag verfälscht:\n{geschrieben}");
            let wieder = lesen("b", &geschrieben).unwrap_or_else(|e| panic!("{name}: Datei nach dem Schreiben defekt: {e:?}\n{geschrieben}"));
            assert_eq!(wieder, gelesen, "{name}: der Rundlauf verliert den Wert:\n{geschrieben}");
            assert_eq!(schreiben(&wieder, |_| None), geschrieben, "{name}: der Rundlauf ist nicht stabil");
        }
    }

    // B1 (Code-Review #26): der schlüssellose `column-owner: human` (das ganze Board meinend) bleibt erhalten,
    // auch wenn eine Spalte zugleich einen gültigen Eigentümer bekommt — er wandert schlüssellos in die Zuordnung,
    // die fail-sichere Sperre steht.
    #[test]
    fn schluesselloser_human_bleibt_neben_einem_gueltigen_eigentuemer() {
        let mut b = lesen("b", "---\ncolumn-owner: human\n---\n## Eingang\n## Erledigt\n").unwrap();
        b.spalten[1].eigentuemer = Some(Eigentuemer::Agent);
        let t = schreiben(&b, |_| None);
        assert!(t.contains("Erledigt: agent"), "{t}");
        let g = lesen("b", &t).unwrap();
        assert_eq!(g.spalten[1].eigentuemer, Some(Eigentuemer::Agent), "{t}");
        assert!(g.eigentuemer_roh.iter().any(|e| e.meint_human()), "der human-Wert bleibt und sperrt: {t}");
    }

    // B2 (Code-Review #26): ein Rohschlüssel, der nach einem Umbenennen auf eine Spalte trifft, erzeugt keinen
    // doppelten YAML-Schlüssel — das Board bleibt lesbar.
    #[test]
    fn rohschluessel_trifft_spalte_ohne_doppelschluessel() {
        let mut b = lesen("b", "---\ncolumn-owner:\n  A: chef\n  B: human\n---\n## A\n## Z\n").unwrap();
        // A heißt jetzt B (der verwaiste Rohschlüssel B trifft die Spalte)
        b.spalten[0].name = "B".into();
        let t = schreiben(&b, |_| None);
        let g = lesen("b", &t).unwrap_or_else(|e| panic!("Doppelschlüssel: {e:?}\n{t}"));
        assert_eq!(g.spalten[0].eigentuemer_unbekannt.as_deref(), Some("chef"), "{t}");
        assert!(g.eigentuemer_roh.iter().any(|e| e.meint_human()), "der verwaiste human bleibt: {t}");
    }

    #[test]
    fn aufgabe_vor_der_ersten_spalte_und_doppelte_spalte_sind_fehler() {
        assert!(lesen("x", "# X\n- #1\n## A\n").unwrap_err().0.contains("vor der ersten Spalte"));
        assert!(lesen("x", "## A\n## A\n").unwrap_err().0.contains("doppelt"));
    }

    // R00128 B0595: `archived` im Rundlauf (Board-Frontmatter); ohne Schlüssel kein `archived`; ungültiges Datum ist ein Formatfehler
    #[test]
    fn archiviert_im_frontmatter_rundlauf() {
        let ohne = schreiben(&beispiel(), datei);
        assert!(!ohne.contains("archived"), "{ohne}");
        assert_eq!(lesen("entwicklung", &ohne).unwrap().archiviert, None);
        let mut b = beispiel();
        b.archiviert = Some("2026-11-11".into());
        let t = schreiben(&b, datei);
        assert!(t.contains("\narchived: 2026-11-11\n"), "{t}");
        assert_eq!(lesen("entwicklung", &t).unwrap(), b);
        assert_eq!(schreiben(&lesen("entwicklung", &t).unwrap(), datei), t);
        let mut nur_archiv = beispiel();
        nur_archiv.spalten[1].grenze = None;
        nur_archiv.archiviert = Some("2026-11-11".into());
        assert!(schreiben(&nur_archiv, datei).starts_with("---\narchived: 2026-11-11\n---\n\n# Entwicklung\n"), "der Block erscheint auch, wenn nur archived gesetzt ist");
        for zeile in ["archived: 11.11.2026", "archived: 2026-13-01", "archived: heute"] {
            let e = lesen("b", &format!("---\n{zeile}\n---\n## A\n")).unwrap_err();
            assert!(e.0.contains("archived"), "{zeile}: {e:?}");
        }
    }

    #[test]
    fn start_fieber_und_zieltermin_rundlauf() {
        let mut b = beispiel();
        b.start = Some("2026-09-01".into());
        b.fieber = Fieber { puffer: Some(20), perzentil: 50, woche: 7, gelb: [10, 67], rot: [20, 95], zielspalte: Some("In Arbeit".into()), vonspalte: None, selbstlabels: vec![], aufloesung: 30 };
        b.termine = vec![Termin { name: "Deadline".into(), datum: "2027-10-31".into(), farbe: "red".into(), linie: Linie::Durchgehend, staerke: Staerke::Fett, ziel: true }];
        let t = schreiben(&b, datei);
        assert!(t.contains("width: bold, target: true}\nstart: 2026-09-01\nfever: {buffer: 20, percentile: 50, week: 7, yellow: [10, 67], red: [20, 95], resolution: month, target-column: In Arbeit}\n---\n"), "{t}");
        assert_eq!(lesen("entwicklung", &t).unwrap(), b);
        assert_eq!(schreiben(&lesen("entwicklung", &t).unwrap(), datei), t);
        let ohne = lesen("b", "## A\n").unwrap();
        assert_eq!((ohne.start, ohne.fieber), (None, Fieber::default()));
        assert!(!schreiben(&beispiel(), datei).contains("fever"), "Standard wird nicht geschrieben");
    }

    /// R00167 AK 3a und ADR-0027 N3 Punkt 6: ohne `from-column` zeichengleich, mit ihm ein Rundlauf hinter `target-column`.
    #[test]
    fn von_spalte_rundlauf_ohne_und_mit_from_column() {
        let ohne = "---\nfever: {buffer: 20, target-column: In Arbeit}\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n";
        let gelesen = lesen("entwicklung", ohne).unwrap();
        assert_eq!(gelesen.fieber.vonspalte, None);
        assert_eq!(schreiben(&gelesen, datei), ohne, "ohne Wahl kein neuer Schlüssel");
        let mit = ohne.replace("target-column: In Arbeit}", "target-column: In Arbeit, from-column: Zu erledigen}");
        let gelesen = lesen("entwicklung", &mit).unwrap();
        assert_eq!(gelesen.fieber.vonspalte.as_deref(), Some("Zu erledigen"));
        assert_eq!(schreiben(&gelesen, datei), mit);
        let nur_von = lesen("entwicklung", "---\nfever: {from-column: \"Abnahme: extern\"}\n---\n## A\n").unwrap();
        assert_eq!(nur_von.fieber.vonspalte.as_deref(), Some("Abnahme: extern"));
        assert!(schreiben(&nur_von, datei).starts_with("---\nfever: {from-column: \"Abnahme: extern\"}\n---\n"), "ein Name mit Doppelpunkt bleibt ein Skalar");
        assert!(lesen("b", "---\nfever: {from-column: \" \"}\n---\n## A\n").unwrap_err().0.contains("Von-Spalte"));
    }

    /// R00194 AK 1 und ADR-0027 N6: ohne `self-labels` zeichengleich, mit ihnen ein Rundlauf hinter `from-column`.
    #[test]
    fn selbst_labels_rundlauf_ohne_und_mit_self_labels() {
        let ohne = "---\nfever: {buffer: 20, target-column: In Arbeit, from-column: Zu erledigen}\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n";
        let gelesen = lesen("entwicklung", ohne).unwrap();
        assert!(gelesen.fieber.selbstlabels.is_empty());
        assert_eq!(schreiben(&gelesen, datei), ohne, "ohne Wahl kein neuer Schlüssel");
        let mit = ohne.replace("from-column: Zu erledigen}", "from-column: Zu erledigen, self-labels: [befund, härtung, \"typ: bug\"]}");
        let gelesen = lesen("entwicklung", &mit).unwrap();
        assert_eq!(gelesen.fieber.selbstlabels, ["befund", "härtung", "typ: bug"]);
        assert_eq!(schreiben(&gelesen, datei), mit);
        assert!(lesen("b", "---\nfever: {self-labels: [befund, \" \"]}\n---\n## A\n").unwrap_err().0.contains("Selbsterzeugt"));
    }

    #[test]
    fn unlesbare_fieberangaben_sind_fehler() {
        let mit = |zeilen: &str| lesen("b", &format!("---\n{zeilen}\n---\n## A\n"));
        assert!(mit("start: 1.9.2026").unwrap_err().0.contains("start"));
        assert!(mit("fever: 3").unwrap_err().0.contains("keine Zuordnung"));
        assert!(mit("fever: {buffer: viel}").unwrap_err().0.contains("buffer"));
        assert!(mit("fever: {yellow: [10]}").unwrap_err().0.contains("yellow"));
        assert!(mit("fever: {percentile: 60}").unwrap_err().0.contains("Perzentil"));
        assert!(mit("fever: {resolution: hourly}").unwrap_err().0.contains("hourly"));
        assert!(mit("milestones:\n  - {name: A, date: 2027-01-01, target: true}\n  - {name: B, date: 2027-02-01, target: true}").unwrap_err().0.contains("mehr als ein Zieltermin"));
        assert!(mit("milestones:\n  - {name: A, date: 2027-01-01, target: ja}").unwrap_err().0.contains("target"));
    }

    #[test]
    fn berichtsfilter_rundlauf_und_fehler() {
        let mut b = beispiel();
        b.berichtsfilter = Berichtsfilter { zeitraum: "eigen".into(), von: "2026-10-01".into(), bis: "2026-10-20".into(), ohne_farben: vec!["bug".into(), "".into()], ohne_spalten: vec!["Zu erledigen".into()], personen: vec!["st".into()], labels: vec!["ui".into()], messbasis_tage: 30, ..Default::default() };
        let t = schreiben(&b, datei);
        assert!(t.contains("\nreport-filter: {period: eigen, from: 2026-10-01, to: 2026-10-20, exclude-classes: [bug, \"\"], exclude-columns: [Zu erledigen], people: [st], labels: [ui], window-days: 30}\n"), "{t}");
        assert_eq!(lesen("entwicklung", &t).unwrap(), b);
        assert_eq!(schreiben(&lesen("entwicklung", &t).unwrap(), datei), t);
        b.berichtsfilter = Berichtsfilter { zeitraum: "30".into(), ..Default::default() };
        let t = schreiben(&b, datei);
        assert!(t.contains("report-filter: {period: \"30\"}\n"), "{t}");
        assert_eq!(lesen("entwicklung", &t).unwrap(), b);
        assert!(!schreiben(&beispiel(), datei).contains("report-filter"));
        let mit = |zeile: &str| lesen("b", &format!("---\n{zeile}\n---\n## A\n"));
        assert!(mit("report-filter: {period: gibts}").unwrap_err().0.contains("gibts"));
        assert!(mit("report-filter: {from: 1.10.2026}").unwrap_err().0.contains("1.10.2026"));
        assert!(mit("report-filter: 3").unwrap_err().0.contains("keine Zuordnung"));
        assert!(mit("report-filter: {window-days: 0}").unwrap_err().0.contains("Messbasis"));
        assert!(mit("report-filter: {window-days: viele}").unwrap_err().0.contains("window-days"));
    }

    /// R00171 AK 10 und ADR-0028 N1 Punkte 3 und 6: ohne `cost-from-column`/`cost-to-column` zeichengleich wie vor der
    /// Karte, mit ihnen ein Rundlauf hinter den übrigen Schlüsseln von `report-filter` — jeder für sich, beide, und neben
    /// allen anderen.
    #[test]
    fn kostenabschnitt_rundlauf_ohne_und_mit_den_spalten() {
        let rundlauf = |text: &str| schreiben(&lesen("entwicklung", text).unwrap(), datei);
        let mit_filter = |zeile: &str| format!("---\n{zeile}\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n");
        const VOR_DER_KARTE: &str = "report-filter: {period: eigen, from: 2026-11-12, to: 2026-11-13, exclude-classes: [bug, \"\"], exclude-columns: [Zu erledigen], people: [st], labels: [ui], window-days: 30}";
        let ohne = mit_filter(VOR_DER_KARTE);
        assert_eq!(rundlauf(&ohne), ohne, "ohne die neuen Schlüssel zeichengleich");
        let ganz_ohne = "# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n";
        assert_eq!(rundlauf(ganz_ohne), ganz_ohne, "ohne report-filter entsteht keiner");

        let beide = mit_filter(&VOR_DER_KARTE.replace("window-days: 30}", "window-days: 30, cost-from-column: Entwicklung, cost-to-column: Abnahme}"));
        assert_eq!(rundlauf(&beide), beide, "beide Spalten neben allen übrigen Schlüsseln");
        for zeile in ["report-filter: {cost-from-column: Entwicklung}", "report-filter: {cost-to-column: Abnahme}", "report-filter: {period: vorwoche, cost-to-column: Abnahme}"] {
            assert_eq!(rundlauf(&mit_filter(zeile)), mit_filter(zeile), "{zeile}");
        }
    }

    /// R00171 B0837 (Schaden e, f): die Spalten kommen als Text im Modell an; Namen mit Sonderzeichen überstehen den
    /// Rundlauf, weil der Schreibweg jeden Wert als YAML-Skalar schützt; geprüft wird nur die Form.
    #[test]
    fn kostenabschnitt_liest_die_spalten_und_schuetzt_fremde_namen() {
        let mit = |zeile: &str| lesen("b", &format!("---\n{zeile}\n---\n## A\n"));
        let f = mit("report-filter: {cost-from-column: Entwicklung, cost-to-column: Abnahme}").unwrap().berichtsfilter;
        assert_eq!((f.kosten_von_spalte.as_str(), f.kosten_bis_spalte.as_str()), ("Entwicklung", "Abnahme"));
        assert_eq!(f.zeitraum, "alles", "die übrigen Felder bleiben Standard");
        let f = mit("report-filter: {period: vorwoche}").unwrap().berichtsfilter;
        assert_eq!((f.kosten_von_spalte.as_str(), f.kosten_bis_spalte.as_str()), ("", ""), "ohne Schlüssel leer = alle");

        for name in ["Abnahme: extern", "\"Fertig\"", "<b>Test</b>", "  eingerückt", "a, b]", "#1", "true", "42", "- x", "Ende "] {
            let mut b = beispiel();
            b.berichtsfilter = Berichtsfilter { kosten_von_spalte: name.into(), kosten_bis_spalte: name.into(), ..Default::default() };
            let text = schreiben(&b, datei);
            let gelesen = lesen("entwicklung", &text).unwrap_or_else(|e| panic!("„{name}“ macht die Datei unlesbar: {} in {text}", e.0));
            assert_eq!(gelesen.berichtsfilter, b.berichtsfilter, "„{name}“ in {text}");
            assert_eq!(schreiben(&gelesen, datei), text, "„{name}“ bleibt beim zweiten Schreiben gleich");
        }
        assert!(mit("report-filter: {cost-to-column: \"zwei\\nZeilen\"}").unwrap_err().0.contains("einzeiliger Text"));
        assert!(mit("report-filter: {cost-to-column: Gibtsnicht}").is_ok(), "eine Spalte, die das Board nicht führt, ist kein Fehler");
    }

    // R00100 B0349: report-labels im Rundlauf, auch mit Werten, die YAML sonst als Zahl, Wahrheitswert oder gar nicht liest
    #[test]
    fn bestand_rundlauf_und_fehler() {
        let ohne = schreiben(&beispiel(), datei);
        assert!(!ohne.contains("report-labels"), "{ohne}");
        assert_eq!(lesen("entwicklung", &ohne).unwrap().bestand, None);
        assert_eq!(schreiben(&lesen("entwicklung", &ohne).unwrap(), datei), ohne, "ohne Eintrag byte-gleich");
        let mut b = beispiel();
        b.bestand = Some(Bestandseinstellung { zeilen: "nc".into(), spalten: "repo".into() });
        let t = schreiben(&b, datei);
        assert!(t.contains("\nreport-labels: {rows: nc, columns: repo}\n"), "{t}");
        assert_eq!(lesen("entwicklung", &t).unwrap(), b);
        assert_eq!(schreiben(&lesen("entwicklung", &t).unwrap(), datei), t);
        for (zeilen, spalten) in [("0x11", "true"), ("304", "null"), ("a\u{7f}b", "x\u{2028}y"), ("a, b", "{c}"), ("Größe", "kd:I0007")] {
            b.bestand = Some(Bestandseinstellung { zeilen: zeilen.into(), spalten: spalten.into() });
            let t = schreiben(&b, datei);
            assert_eq!(lesen("entwicklung", &t).unwrap_or_else(|e| panic!("{zeilen:?}/{spalten:?}: {e:?}\n{t}")).bestand, b.bestand, "{t}");
        }
        let mit = |zeile: &str| lesen("b", &format!("---\n{zeile}\n---\n## A\n"));
        assert!(mit("report-labels: 3").unwrap_err().0.contains("report-labels ist keine Zuordnung"));
        assert!(mit("report-labels: {rows: nc}").unwrap_err().0.contains("columns"));
        assert!(mit("report-labels: {columns: [a]}").unwrap_err().0.contains("rows"));
        assert_eq!(mit("report-labels: {rows: 304, columns: true}").unwrap().bestand, Some(Bestandseinstellung { zeilen: "304".into(), spalten: "true".into() }), "von Hand ohne Anführungszeichen: als Text");
        assert_eq!(mit("report-labels: ~").unwrap().bestand, None);
    }

    // R00128 B0596: das Board-JSON trägt `archiviert: <JJJJ-MM-TT> | null`
    #[test]
    fn archiviert_im_json_des_boards() {
        let mut b = beispiel();
        assert_eq!(serde_json::to_value(&b).unwrap()["archiviert"], serde_json::Value::Null);
        b.archiviert = Some("2026-11-11".into());
        assert_eq!(serde_json::to_value(&b).unwrap()["archiviert"], serde_json::json!("2026-11-11"));
    }

    #[test]
    fn bestand_im_json_des_boards() {
        let mut b = beispiel();
        assert_eq!(serde_json::to_value(&b).unwrap()["bestand"], serde_json::Value::Null);
        b.bestand = Some(Bestandseinstellung { zeilen: "nc".into(), spalten: "repo".into() });
        assert_eq!(serde_json::to_value(&b).unwrap()["bestand"], serde_json::json!({"zeilen": "nc", "spalten": "repo"}));
    }
}

#[cfg(test)]
mod tests_schalter_im_text {
    use super::schalter_im_text;

    #[test]
    fn haengt_an_ersetzt_und_entfernt_nur_die_eine_zeile() {
        let alt = "---\n# Kommentar\nzzz: 1\n---\n\nText\n";
        assert_eq!(schalter_im_text(alt, Some(true)), "---\n# Kommentar\nzzz: 1\nrecord-transcripts: true\n---\n\nText\n");
        let mit = "---\nrecord-transcripts:\n  true\nzzz: 1\n---\nText\n";
        assert_eq!(schalter_im_text(mit, Some(false)), "---\nrecord-transcripts: false\nzzz: 1\n---\nText\n", "eingerückte Folgezeile gehört dazu");
        assert_eq!(schalter_im_text(mit, None), "---\nzzz: 1\n---\nText\n");
        assert_eq!(schalter_im_text(alt, None), alt, "ohne Schlüssel und ohne Wert zeichengleich");
    }

    #[test]
    fn aehnliche_schluessel_text_und_ohne_frontmatter() {
        let alt = "---\nrecord-transcripts-alt: x\n---\nrecord-transcripts: im Text\n";
        assert_eq!(schalter_im_text(alt, Some(true)), "---\nrecord-transcripts-alt: x\nrecord-transcripts: true\n---\nrecord-transcripts: im Text\n");
        assert_eq!(schalter_im_text("# zweit\n\n## A\n", Some(true)), "---\nrecord-transcripts: true\n---\n\n# zweit\n\n## A\n");
        assert_eq!(schalter_im_text("# zweit\n", None), "# zweit\n");
        assert_eq!(schalter_im_text("\u{feff}---\na: 1\n---\n", Some(false)), "\u{feff}---\na: 1\nrecord-transcripts: false\n---\n");
    }
}
