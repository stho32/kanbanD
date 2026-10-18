//! Die WBS-Datei als Text ändern — byte-treu: was nicht geändert werden soll, bleibt Byte für Byte stehen. Rein, ohne Dateizugriff.

use crate::fehler::Fehler;
use crate::herkunft::wbs_tabelle;
use crate::wbs::{WbsKnoten, WbsTabelle};
use serde::Deserialize;
use std::ops::Range;

/// Byte-Bereiche der Zellen einer Tabellenzeile, ohne die Striche; `\|` ist ein Strich im Text, kein Trenner.
/// Nach dem letzten Strich zählt Text bis zum Zeilenende als Zelle.
pub fn zellgrenzen(zeile: &str) -> Vec<Range<usize>> {
    let b = zeile.as_bytes();
    let mut striche = vec![];
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'\\' if b.get(i + 1) == Some(&b'|') => i += 2,
            b'|' => {
                striche.push(i);
                i += 1
            }
            _ => i += 1,
        }
    }
    let ende = zeile.trim_end_matches(['\n', '\r']).len();
    let mut zellen: Vec<Range<usize>> = striche.windows(2).map(|w| w[0] + 1..w[1]).collect();
    if let Some(&letzter) = striche.last()
        && !zeile[letzter + 1..ende].trim().is_empty()
    {
        zellen.push(letzter + 1..ende);
    }
    zellen
}

/// Ein Wert, wie er in einer Zelle steht: Striche maskiert, Zeilenumbrüche als Leerzeichen.
pub fn maskiert(wert: &str) -> String {
    wert.trim().replace(['\r', '\n'], " ").replace('|', "\\|")
}

/// Die Zeile mit neuem Inhalt in Zelle `spalte` (0-basiert); die Leerzeichen um den Inhalt bleiben, eine leere Zelle wird ` wert `.
/// Ohne diese Zelle: `None`.
pub fn zelle_ersetzen(zeile: &str, spalte: usize, wert: &str) -> Option<String> {
    let r = zellgrenzen(zeile).get(spalte)?.clone();
    let roh = &zeile[r.clone()];
    let wert = maskiert(wert);
    let innen = if roh.trim().is_empty() {
        format!(" {wert} ")
    } else {
        let vorn = roh.len() - roh.trim_start().len();
        let hinten = roh.len() - roh.trim_end().len();
        format!("{}{wert}{}", &roh[..vorn], &roh[roh.len() - hinten..])
    };
    Some(format!("{}{innen}{}", &zeile[..r.start], &zeile[r.end..]))
}

/// `zuletzt: <heute>` im Frontmatter — ersetzt oder vor dem schließenden `---` ergänzt; ohne Frontmatter bleibt der Text, wie er ist.
pub fn zuletzt_setzen(text: &str, heute: &str) -> String {
    let zeilen: Vec<&str> = text.split_inclusive('\n').collect();
    let strich = |z: &str| z.trim_end_matches(['\n', '\r']) == "---";
    if !zeilen.first().is_some_and(|z| strich(z)) {
        return text.to_string();
    }
    let Some(ende) = zeilen.iter().skip(1).position(|z| strich(z)).map(|p| p + 1) else { return text.to_string() };
    let umbruch = if zeilen[0].ends_with("\r\n") { "\r\n" } else { "\n" };
    let mut neu: Vec<String> = zeilen.iter().map(|z| z.to_string()).collect();
    match (1..ende).find(|&i| zeilen[i].starts_with("zuletzt:")) {
        Some(i) => {
            let eigener = &zeilen[i][zeilen[i].trim_end_matches(['\n', '\r']).len()..];
            neu[i] = format!("zuletzt: {heute}{eigener}");
        }
        None => neu.insert(ende, format!("zuletzt: {heute}{umbruch}")),
    }
    neu.concat()
}

/// Zellinhalte einer Zeile, getrimmt und mit `\\|` als Strich.
pub(crate) fn inhalte(zeile: &str) -> Vec<String> {
    zellgrenzen(zeile).into_iter().map(|r| zeile[r].trim().replace("\\|", "|")).collect()
}

/// Ist das die Kopfzeile einer Knotentabelle (erste Zelle `ID`)?
fn ist_kopf(zeile: &str) -> bool {
    zeile.trim_start().starts_with('|') && inhalte(zeile).first().is_some_and(|z| z == "ID")
}

/// Darf kanbanD in diese WBS-Datei schreiben? Nicht bei Konfliktmarkern und nicht ohne Knotentabelle mit Spalte `Status` — 409.
pub fn schreibbar(text: &str) -> Result<(), Fehler> {
    if let Some(n) = text.lines().position(|z| z.starts_with("<<<<<<<") || z.starts_with(">>>>>>>")) {
        return Err(Fehler::Konflikt(format!("WBS-Datei defekt: Konfliktmarker in Zeile {}", n + 1)));
    }
    if !text.lines().any(|z| ist_kopf(z) && inhalte(z).iter().any(|h| h == "Status")) {
        return Err(Fehler::Konflikt("WBS-Datei defekt: keine Knotentabelle mit Spalte Status".into()));
    }
    Ok(())
}

/// Setzt Zellen nach Zeilennummer (1-basiert) und Spaltenname der Kopfzeile, die über der Zeile steht; alle anderen Bytes bleiben.
pub fn zellen_schreiben(text: &str, aenderungen: &[(usize, &str, String)]) -> String {
    let mut kopf: Vec<String> = vec![];
    let mut aus = String::with_capacity(text.len() + 64);
    for (i, zeile) in text.split_inclusive('\n').enumerate() {
        if ist_kopf(zeile) {
            kopf = inhalte(zeile);
        }
        let mut z = zeile.to_string();
        for (_, spalte, wert) in aenderungen.iter().filter(|(nr, _, _)| *nr == i + 1) {
            if let Some(neu) = kopf.iter().position(|h| h == spalte).and_then(|p| zelle_ersetzen(&z, p, wert)) {
                z = neu;
            }
        }
        aus.push_str(&z);
    }
    aus
}

/// Status, die ein Mensch oder die KI an einem Blatt setzt; alles andere ist Planung.
const SETZBAR: [&str; 3] = ["rot", "gelb", "gruen"];

fn setzbarer_status(status: &str) -> Result<(), Fehler> {
    match status {
        s if SETZBAR.contains(&s) => Ok(()),
        "option" | "ausbau" | "verworfen" | "bestehend" => Err(Fehler::Ungueltig(format!("Status „{status}“ ist hier nicht setzbar — nur rot, gelb, gruen"))),
        _ => Err(Fehler::Ungueltig(format!("Unbekannter Status „{status}“ — erlaubt sind rot, gelb, gruen"))),
    }
}

/// Die Vorfahren von `id` mit dem Status, den sie in `t` aus ihren Kindern bekommen, soweit er von der Datei abweicht.
/// Vorfahren mit `option`, `ausbau`, `verworfen` oder `bestehend` behalten ihren Status — er ist Planung, nicht Rechnung.
pub fn vorfahren_neu(t: &WbsTabelle, id: &str) -> Vec<(String, String)> {
    let mut pfad = t.pfad(id);
    pfad.pop();
    pfad.iter()
        .rev()
        .filter_map(|v| t.knoten(v))
        .filter(|v| SETZBAR.contains(&v.status.as_str()))
        .map(|v| (v.id.clone(), t.gerechneter_status(&v.id)))
        .filter(|(v, neu)| t.knoten(v).is_some_and(|k| &k.status != neu))
        .collect()
}

/// Ergebnis einer Änderung an der WBS-Datei: neuer Text und die Knoten, deren Status sich geändert hat.
#[derive(Debug, PartialEq, Eq)]
pub struct Geschrieben {
    pub text: String,
    pub geaendert: Vec<String>,
}

/// Setzt den Status eines Blatts, rechnet die Vorfahren neu und setzt `zuletzt` — nur diese Zellen ändern sich.
/// Gleicher Status: Text unverändert, nichts geändert.
pub fn status_setzen(text: &str, id: &str, status: &str, heute: &str) -> Result<Geschrieben, Fehler> {
    schreibbar(text)?;
    setzbarer_status(status)?;
    let t = wbs_tabelle(text);
    let k = t.knoten(id).ok_or_else(|| Fehler::NichtGefunden(format!("Knoten „{id}“ steht nicht in der WBS")))?;
    if !t.kinder(id).is_empty() {
        return Err(Fehler::Konflikt(format!("Status wird gerechnet — {id} hat Kinder, gesetzt werden nur Blätter")));
    }
    if !SETZBAR.contains(&k.status.as_str()) {
        return Err(Fehler::Konflikt(format!("{id} ist „{}“ — der Status wird hier nicht geändert", k.status)));
    }
    if k.status == status {
        return Ok(Geschrieben { text: text.to_string(), geaendert: vec![] });
    }
    let neu = WbsTabelle::aus(t.alle().iter().map(|x| if x.id == id { WbsKnoten { status: status.into(), ..x.clone() } } else { x.clone() }).collect());
    let mut status_neu = vec![(id.to_string(), status.to_string())];
    status_neu.extend(vorfahren_neu(&neu, id));
    Ok(statuszellen_schreiben(text, &t, &status_neu, heute))
}

/// Schreibt neue Status nach ID in die Zellen `Status` und setzt `zuletzt`.
fn statuszellen_schreiben(text: &str, t: &WbsTabelle, status_neu: &[(String, String)], heute: &str) -> Geschrieben {
    let aenderungen: Vec<(usize, &str, String)> = status_neu.iter().filter_map(|(id, s)| Some((t.knoten(id)?.zeile, "Status", s.clone()))).collect();
    Geschrieben { text: zuletzt_setzen(&zellen_schreiben(text, &aenderungen), heute), geaendert: status_neu.iter().map(|(id, _)| id.clone()).collect() }
}

/// Nächste ID eines Präfixes: die höchste aus allen Ständen der Datei plus 1 — eine ID wird nie wiederverwendet, auch keine gelöschte.
pub fn naechste_id(praefix: char, staende: &[String]) -> String {
    let nummer = |id: &str| id.strip_prefix(praefix)?.parse::<u32>().ok();
    let hoechste = staende.iter().flat_map(|s| wbs_tabelle(s).alle().iter().filter_map(|k| nummer(&k.id)).max()).max().unwrap_or(0);
    format!("{praefix}{:04}", hoechste + 1)
}

/// `POST /api/wbs/{kürzel}/knoten` — fehlende Felder sind leer, damit die Prüfung sie mit 400 und klarer Meldung ablehnt.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
#[serde(default)]
pub struct NeuerKnoten {
    pub ebene: String,
    pub eltern: String,
    pub name: String,
    pub fertig_kriterium: String,
    pub eingabe_ausgabe: String,
    pub aufwand: String,
    pub ausbaustufe: String,
    pub braucht: Vec<String>,
    pub requirement: String,
    pub notiz: String,
}

/// Untergrenze je Bubble in Stunden (Skill `work-breakdown-structure`, „Schätzen durch Zählen“).
const UNTERGRENZE_H: f64 = 0.4;

/// Präfix der ID und die Ebenen, unter denen eine Ebene hängen darf (Feature darf übersprungen werden).
fn ebene_regel(ebene: &str) -> Option<(char, &'static [&'static str])> {
    match ebene {
        "Dialog" => Some(('D', &["Application"])),
        "Interaction" => Some(('I', &["Dialog"])),
        "Feature" => Some(('F', &["Interaction"])),
        "Bubble" => Some(('B', &["Feature", "Interaction"])),
        _ => None,
    }
}

/// `0,5-1`, `1`, `0.5–1h` → die Stunden der Spanne; unlesbar: `None`.
fn aufwand_lesen(aufwand: &str) -> Option<Vec<f64>> {
    let a = aufwand.trim().trim_end_matches('h');
    a.split(['-', '–']).map(|w| w.trim().replace(',', ".").parse::<f64>().ok()).collect()
}

/// Prüft einen neuen Knoten gegen die Regeln von `/planung` und liefert das Präfix seiner ID.
pub fn neuen_knoten_pruefen(t: &WbsTabelle, neu: &NeuerKnoten) -> Result<char, Fehler> {
    let ungueltig = |m: String| Err(Fehler::Ungueltig(m));
    if neu.ebene == "Application" {
        return ungueltig("Eine Application legt man nicht an — die WBS-Datei ist die Application".into());
    }
    let Some((praefix, eltern_ebenen)) = ebene_regel(&neu.ebene) else { return ungueltig(format!("Unbekannte Ebene „{}“ — erlaubt sind Dialog, Interaction, Feature, Bubble", neu.ebene)) };
    if neu.name.trim().is_empty() {
        return ungueltig("Der Knoten braucht einen Namen".into());
    }
    if neu.fertig_kriterium.trim().is_empty() {
        return ungueltig("Fertig-Kriterium fehlt — ein Knoten, ein Fertig-Kriterium".into());
    }
    let Some(eltern) = t.knoten(neu.eltern.trim()) else { return ungueltig(format!("Eltern „{}“ steht nicht in der WBS", neu.eltern)) };
    if !eltern_ebenen.contains(&eltern.ebene.as_str()) {
        return ungueltig(format!("Eine {} hängt an {}, nicht an {} ({})", neu.ebene, eltern_ebenen.join(" oder "), eltern.ebene, eltern.id));
    }
    if eltern.status == "verworfen" {
        return Err(Fehler::Konflikt(format!("{} ist verworfen — darunter entsteht kein Knoten", eltern.id)));
    }
    if !neu.aufwand.trim().is_empty() {
        if neu.ebene != "Bubble" {
            return ungueltig("Aufwand gibt es nur bei Bubbles".into());
        }
        let Some(stunden) = aufwand_lesen(&neu.aufwand) else { return ungueltig(format!("Aufwand „{}“ ist nicht lesbar — etwa 0,5-1", neu.aufwand)) };
        if stunden.iter().any(|h| *h < UNTERGRENZE_H) {
            return ungueltig(format!("Aufwand „{}“ liegt unter der Untergrenze von 0,4h je Bubble", neu.aufwand));
        }
    }
    if let Some(b) = neu.braucht.iter().find(|b| !crate::modell::id_gueltig(b.trim())) {
        return ungueltig(format!("Braucht „{b}“ ist keine Knoten-ID"));
    }
    Ok(praefix)
}

/// Der Wert einer Spalte der Knotentabelle für einen neuen Knoten; unbekannte Spalten bleiben leer.
fn neuer_wert(spalte: &str, id: &str, neu: &NeuerKnoten) -> String {
    match spalte {
        "ID" => id.into(),
        "Ebene" => neu.ebene.clone(),
        "Eltern" => neu.eltern.trim().into(),
        "Name" => neu.name.clone(),
        "Status" => "rot".into(),
        "Fertig-Kriterium" => neu.fertig_kriterium.clone(),
        "Eingabe → Ausgabe" => neu.eingabe_ausgabe.clone(),
        "Aufwand" => neu.aufwand.trim().trim_end_matches('h').into(),
        "Ausbaustufe" => neu.ausbaustufe.clone(),
        "Braucht" => neu.braucht.iter().map(|b| b.trim()).collect::<Vec<_>>().join(", "),
        "Requirement" => neu.requirement.clone(),
        "Notiz" => neu.notiz.clone(),
        _ => String::new(),
    }
}

/// Die Kopfzeile, die über Zeile `nr` (1-basiert) gilt.
fn kopf_ueber(zeilen: &[&str], nr: usize) -> Vec<String> {
    zeilen[..nr].iter().rev().find(|z| ist_kopf(z)).map(|z| inhalte(z)).unwrap_or_default()
}

/// Legt einen Knoten mit `id` an: neue Zeile `rot` direkt nach dem letzten Nachfahren seiner Eltern,
/// Vorfahren neu gerechnet, `zuletzt` gesetzt — alle anderen Bytes bleiben.
pub fn knoten_anlegen(text: &str, neu: &NeuerKnoten, id: &str, heute: &str) -> Result<Geschrieben, Fehler> {
    schreibbar(text)?;
    let t = wbs_tabelle(text);
    neuen_knoten_pruefen(&t, neu)?;
    if t.knoten(id).is_some() {
        return Err(Fehler::Konflikt(format!("{id} steht schon in der WBS")));
    }
    let eltern = neu.eltern.trim();
    let nach = t.alle().iter().filter(|k| t.pfad(&k.id).iter().any(|p| p == eltern)).map(|k| k.zeile).max().expect("die Eltern selbst");
    let zeilen: Vec<&str> = text.split_inclusive('\n').collect();
    let umbruch = if zeilen[nach - 1].ends_with("\r\n") { "\r\n" } else { "\n" };
    let zellen: Vec<String> = kopf_ueber(&zeilen, nach).iter().map(|h| maskiert(&neuer_wert(h, id, neu))).collect();
    let zeile = format!("| {} |{umbruch}", zellen.join(" | "));
    let mut mit_neuem = t.alle().to_vec();
    mit_neuem.push(WbsKnoten { id: id.into(), ebene: neu.ebene.clone(), eltern: eltern.into(), status: "rot".into(), ..t.alle()[0].clone() });
    let vorfahren = vorfahren_neu(&WbsTabelle::aus(mit_neuem), id);
    let aenderungen: Vec<(usize, &str, String)> = vorfahren.iter().filter_map(|(v, s)| Some((t.knoten(v)?.zeile, "Status", s.clone()))).collect();
    let geschrieben = zellen_schreiben(text, &aenderungen);
    let mut teile: Vec<String> = geschrieben.split_inclusive('\n').map(String::from).collect();
    if !teile[nach - 1].ends_with('\n') {
        teile[nach - 1].push_str(umbruch);
    }
    teile.insert(nach, zeile);
    let mut geaendert = vec![id.to_string()];
    geaendert.extend(vorfahren.into_iter().map(|(v, _)| v));
    Ok(Geschrieben { text: zuletzt_setzen(&teile.concat(), heute), geaendert })
}

/// Verwirft einen Knoten und alle zählenden Nachfahren (`verworfen`, keine Zeile entfernt); der Grund kommt in die Notiz
/// des Knotens, die Vorfahren werden neu gerechnet. Die Application und schon Verworfenes: 409.
pub fn verwerfen(text: &str, id: &str, grund: &str, heute: &str) -> Result<Geschrieben, Fehler> {
    schreibbar(text)?;
    let t = wbs_tabelle(text);
    let k = t.knoten(id).ok_or_else(|| Fehler::NichtGefunden(format!("Knoten „{id}“ steht nicht in der WBS")))?;
    if k.ebene == "Application" || id.starts_with('A') {
        return Err(Fehler::Konflikt(format!("{id} ist die Application — sie wird nicht verworfen")));
    }
    if k.status == "verworfen" {
        return Err(Fehler::Konflikt(format!("{id} ist schon verworfen")));
    }
    let weg: Vec<&WbsKnoten> = t.alle().iter().filter(|x| x.id == id || (x.zaehlt() && t.pfad(&x.id).iter().any(|p| p == id))).collect();
    let neu = WbsTabelle::aus(t.alle().iter().map(|x| if weg.iter().any(|w| w.id == x.id) { WbsKnoten { status: "verworfen".into(), ..x.clone() } } else { x.clone() }).collect());
    let vorfahren = vorfahren_neu(&neu, id);
    let mut aenderungen: Vec<(usize, &str, String)> = weg.iter().map(|w| (w.zeile, "Status", "verworfen".to_string())).collect();
    aenderungen.extend(vorfahren.iter().filter_map(|(v, s)| Some((t.knoten(v)?.zeile, "Status", s.clone()))));
    let grund = grund.trim();
    if !grund.is_empty() {
        let notiz = if k.notiz.is_empty() { format!("verworfen: {grund}") } else { format!("{}; verworfen: {grund}", k.notiz) };
        aenderungen.push((k.zeile, "Notiz", notiz));
    }
    let mut geaendert: Vec<String> = weg.iter().map(|w| w.id.clone()).collect();
    geaendert.extend(vorfahren.into_iter().map(|(v, _)| v));
    Ok(Geschrieben { text: zuletzt_setzen(&zellen_schreiben(text, &aenderungen), heute), geaendert })
}

/// Setzt einen Knoten zur Überarbeitung zurück: alle zählenden Blätter seines Teilbaums (ein Blatt: er selbst) auf `rot`,
/// die oberen Knoten des Teilbaums und die Vorfahren neu gerechnet, `zuletzt` gesetzt — in einem Schreibvorgang (R00057).
/// Blätter mit `bestehend` bleiben; ein Knoten mit `option`, `ausbau`, `verworfen` oder `bestehend` selbst: 409. Schon rot: nichts geändert.
pub fn teilbaum_auf_rot(text: &str, id: &str, heute: &str) -> Result<Geschrieben, Fehler> {
    schreibbar(text)?;
    let t = wbs_tabelle(text);
    let k = t.knoten(id).ok_or_else(|| Fehler::NichtGefunden(format!("Knoten „{id}“ steht nicht in der WBS")))?;
    if !SETZBAR.contains(&k.status.as_str()) {
        return Err(Fehler::Konflikt(format!("{id} ist „{}“ — er wird nicht überarbeitet", k.status)));
    }
    let teilbaum: Vec<&WbsKnoten> = t.alle().iter().filter(|x| x.id == id || (x.zaehlt() && t.pfad(&x.id).iter().any(|p| p == id))).filter(|x| SETZBAR.contains(&x.status.as_str())).collect();
    let blatt = |x: &WbsKnoten| t.kinder(&x.id).is_empty();
    let mit_roten = WbsTabelle::aus(t.alle().iter().map(|x| if teilbaum.iter().any(|b| b.id == x.id && blatt(b)) { WbsKnoten { status: "rot".into(), ..x.clone() } } else { x.clone() }).collect());
    let teilbaum_neu: Vec<(String, String)> = teilbaum.iter().map(|x| (x.id.clone(), if blatt(x) { "rot".to_string() } else { mit_roten.gerechneter_status(&x.id) })).collect();
    let gerechnet = WbsTabelle::aus(t.alle().iter().map(|x| match teilbaum_neu.iter().find(|(i, _)| *i == x.id) {
        Some((_, s)) => WbsKnoten { status: s.clone(), ..x.clone() },
        None => x.clone(),
    }).collect());
    let mut status_neu: Vec<(String, String)> = teilbaum_neu.into_iter().filter(|(i, s)| t.knoten(i).is_some_and(|x| &x.status != s)).collect();
    status_neu.extend(vorfahren_neu(&gerechnet, id));
    if status_neu.is_empty() {
        return Ok(Geschrieben { text: text.to_string(), geaendert: vec![] });
    }
    Ok(statuszellen_schreiben(text, &t, &status_neu, heute))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nur_die_zelle_aendert_sich() {
        let z = "| B0002 | Bubble | I0002 | Summe  |   rot | Test gruen |\n";
        assert_eq!(zelle_ersetzen(z, 4, "gruen").unwrap(), "| B0002 | Bubble | I0002 | Summe  |   gruen | Test gruen |\n");
        assert_eq!(zelle_ersetzen("| a |  | c |", 1, "b").unwrap(), "| a | b | c |", "leere Zelle");
        assert_eq!(zelle_ersetzen("| a | b |", 2, "x"), None, "die Zelle gibt es nicht");
    }

    #[test]
    fn maskierter_strich_ist_kein_trenner() {
        let z = "| B0001 | Spalte \\| Archiv → x | rot | n |\r\n";
        assert_eq!(zelle_ersetzen(z, 2, "gelb").unwrap(), "| B0001 | Spalte \\| Archiv → x | gelb | n |\r\n");
        assert_eq!(zelle_ersetzen(z, 3, "a | b\nc").unwrap(), "| B0001 | Spalte \\| Archiv → x | rot | a \\| b c |\r\n", "Strich im Wert maskiert, Umbruch als Leerzeichen");
        assert_eq!(zellgrenzen("| a \\| b | c \\|").len(), 2, "Text nach dem letzten Strich ist eine Zelle");
    }

    #[test]
    fn zuletzt_ersetzt_oder_ergaenzt() {
        assert_eq!(zuletzt_setzen("---\napplication: k\nzuletzt: 2026-01-01\n---\n\n| x |\n", "2026-10-18"), "---\napplication: k\nzuletzt: 2026-10-18\n---\n\n| x |\n");
        assert_eq!(zuletzt_setzen("---\r\napplication: k\r\n---\r\nzuletzt: alt\r\n", "2026-10-18"), "---\r\napplication: k\r\nzuletzt: 2026-10-18\r\n---\r\nzuletzt: alt\r\n", "ergänzt im Frontmatter, nicht im Text darunter");
        assert_eq!(zuletzt_setzen("# WBS\nzuletzt: alt\n", "2026-10-18"), "# WBS\nzuletzt: alt\n", "ohne Frontmatter unverändert");
        assert_eq!(zuletzt_setzen("---\nx: 1\n", "2026-10-18"), "---\nx: 1\n", "ohne schließenden Strich unverändert");
    }

    #[test]
    fn defekt_bei_konfliktmarker_oder_ohne_knotentabelle() {
        let gut = "---\nx: 1\n---\n\n| ID | Ebene | Status |\n|---|---|---|\n| B0001 | Bubble | rot |\n";
        assert_eq!(schreibbar(gut), Ok(()));
        let konflikt = gut.replace("| B0001 | Bubble | rot |\n", "<<<<<<< HEAD\n| B0001 | Bubble | rot |\n=======\n| B0001 | Bubble | gruen |\n>>>>>>> x\n");
        assert_eq!(schreibbar(&konflikt), Err(Fehler::Konflikt("WBS-Datei defekt: Konfliktmarker in Zeile 7".into())));
        assert!(matches!(schreibbar("# WBS\n\nnoch keine Tabelle\n"), Err(Fehler::Konflikt(m)) if m.contains("keine Knotentabelle")));
        assert!(schreibbar("| ID | Name |\n|---|---|\n| B0001 | x |\n").is_err(), "ohne Spalte Status");
        assert_eq!(schreibbar("Titel\n=======\n\n| ID | Status |\n"), Ok(()), "Unterstreichung einer Überschrift ist kein Konfliktmarker");
    }

    const KOPF: &str = "---\napplication: Kasse\nzuletzt: 2026-01-01\n---\n\n| ID | Ebene | Eltern | Name | Status | Eingabe → Ausgabe | Notiz | Phase |\n|---|---|---|---|---|---|---|---|\n";

    fn wbs(zeilen: &[(&str, &str, &str, &str)]) -> String {
        KOPF.to_string() + &zeilen.iter().map(|(id, ebene, eltern, status)| format!("| {id} | {ebene} | {eltern} | Name {id} | {status} | a \\| b → c |  | Abnahme |\n")).collect::<String>()
    }

    /// Die Zeilen, in denen sich zwei Texte unterscheiden (gleiche Zeilenzahl vorausgesetzt).
    fn andere_zeilen(a: &str, b: &str) -> Vec<(String, String)> {
        assert_eq!(a.lines().count(), b.lines().count());
        a.lines().zip(b.lines()).filter(|(x, y)| x != y).map(|(x, y)| (x.to_string(), y.to_string())).collect()
    }

    fn drei_ebenen(b0002: &str, i0001: &str) -> String {
        wbs(&[("A0001", "Application", "—", "gelb"), ("D0001", "Dialog", "A0001", "gelb"), ("I0001", "Interaction", "D0001", i0001), ("I0002", "Interaction", "D0001", "gelb"), ("B0001", "Bubble", "I0002", "gruen"), ("B0002", "Bubble", "I0002", b0002), ("B0003", "Bubble", "I0002", "verworfen")])
    }

    #[test]
    fn letzte_bubble_gruen_macht_vorfahren_ueber_drei_ebenen_gruen_und_sonst_nichts() {
        let vorher = drei_ebenen("rot", "gruen");
        let g = status_setzen(&vorher, "B0002", "gruen", "2026-10-18").unwrap();
        assert_eq!(g.geaendert, ["B0002", "I0002", "D0001", "A0001"]);
        assert_eq!(g.text, drei_ebenen("gruen", "gruen").replace("| gelb |", "| gruen |").replace("zuletzt: 2026-01-01", "zuletzt: 2026-10-18"));
        let diff = andere_zeilen(&vorher, &g.text);
        assert_eq!(diff.len(), 5, "vier Status-Zellen und zuletzt: {diff:?}");
        assert!(diff.iter().all(|(a, b)| a.replace("rot", "gruen").replace("gelb", "gruen").replace("2026-01-01", "2026-10-18") == *b));
    }

    #[test]
    fn gemischte_geschwister_lassen_vorfahren_gelb() {
        let g = status_setzen(&drei_ebenen("rot", "rot"), "B0002", "gruen", "2026-10-18").unwrap();
        assert_eq!(g.geaendert, ["B0002", "I0002"], "D0001 bleibt gelb (I0001 rot, I0002 gruen), A0001 ebenso");
        let g = status_setzen(&drei_ebenen("gruen", "gruen"), "B0002", "rot", "2026-10-18").unwrap();
        assert_eq!(g.geaendert, ["B0002"], "I0002 gerechnet gelb wie in der Datei, D0001 und A0001 ebenso");
    }

    #[test]
    fn ablehnungen() {
        let t = drei_ebenen("rot", "gruen");
        assert!(matches!(status_setzen(&t, "I0002", "rot", "h"), Err(Fehler::Konflikt(m)) if m.starts_with("Status wird gerechnet")));
        assert!(matches!(status_setzen(&t, "B0002", "option", "h"), Err(Fehler::Ungueltig(m)) if m.contains("nicht setzbar")));
        for s in ["ausbau", "verworfen", "bestehend", "blau", ""] {
            assert!(matches!(status_setzen(&t, "B0002", s, "h"), Err(Fehler::Ungueltig(_))), "{s}");
        }
        assert!(matches!(status_setzen(&t, "B0099", "rot", "h"), Err(Fehler::NichtGefunden(_))));
        assert!(matches!(status_setzen(&t, "B0003", "rot", "h"), Err(Fehler::Konflikt(m)) if m.contains("verworfen")));
        assert!(matches!(status_setzen("# ohne Tabelle\n", "B0002", "rot", "h"), Err(Fehler::Konflikt(_))));
        assert_eq!(status_setzen(&t, "B0002", "rot", "h").unwrap(), Geschrieben { text: t.clone(), geaendert: vec![] }, "gleicher Status ändert nichts, auch nicht zuletzt");
    }

    #[test]
    fn vorfahr_mit_planungsstatus_bleibt() {
        let t = wbs(&[("I0001", "Interaction", "—", "option"), ("B0001", "Bubble", "I0001", "rot")]);
        assert_eq!(status_setzen(&t, "B0001", "gruen", "h").unwrap().geaendert, ["B0001"]);
    }

    #[test]
    fn interaction_ohne_zaehlende_kinder_ist_ein_blatt() {
        let t = wbs(&[("D0001", "Dialog", "—", "rot"), ("I0001", "Interaction", "D0001", "rot"), ("F0001", "Feature", "I0001", "option"), ("I0002", "Interaction", "D0001", "rot")]);
        let g = status_setzen(&t, "I0001", "gruen", "h").unwrap();
        assert_eq!(g.geaendert, ["I0001", "D0001"], "nur eine Option darunter — I0001 trägt den Status selbst, D0001 gemischt gelb");
        assert!(g.text.contains("| D0001 | Dialog | — | Name D0001 | gelb |"));
    }

    #[test]
    fn naechste_id_auch_ueber_geloeschte_zeilen_der_historie() {
        let ids = |n: std::ops::RangeInclusive<u32>| n.map(|i| (format!("B{i:04}"), "Bubble", "I0001", "rot")).collect::<Vec<_>>();
        let als = |v: &[(String, &str, &str, &str)]| wbs(&v.iter().map(|(a, b, c, d)| (a.as_str(), *b, *c, *d)).collect::<Vec<_>>());
        let datei = als(&ids(1..=116));
        let mit_b0117 = als(&ids(1..=117));
        assert_eq!(naechste_id('B', &[datei.clone(), mit_b0117]), "B0118", "B0117 gab es in einem früheren Stand");
        assert_eq!(naechste_id('B', std::slice::from_ref(&datei)), "B0117");
        assert_eq!(naechste_id('I', &[datei]), "I0001", "Präfix ohne Knoten beginnt bei 1");
        assert_eq!(naechste_id('F', &[]), "F0001");
        assert_eq!(naechste_id('B', &[wbs(&[("B0003", "Bubble", "", "rot"), ("B0001", "Bubble", "", "rot")])]), "B0004", "Lücken werden nicht gefüllt");
    }

    fn knoten(ebene: &str, eltern: &str) -> NeuerKnoten {
        NeuerKnoten { ebene: ebene.into(), eltern: eltern.into(), name: "X".into(), fertig_kriterium: "US-1".into(), ..Default::default() }
    }

    fn fehler(r: Result<char, Fehler>) -> String {
        match r {
            Err(Fehler::Ungueltig(m)) => m,
            anders => panic!("400 erwartet: {anders:?}"),
        }
    }

    #[test]
    fn neuer_knoten_nach_den_regeln_von_planung() {
        let t = wbs_tabelle(&wbs(&[("A0001", "Application", "—", "gelb"), ("D0002", "Dialog", "A0001", "gruen"), ("I0007", "Interaction", "D0002", "gruen"), ("F0001", "Feature", "I0007", "gruen"), ("I0009", "Interaction", "D0002", "verworfen")]));
        assert_eq!(neuen_knoten_pruefen(&t, &knoten("Interaction", "D0002")), Ok('I'));
        assert_eq!(neuen_knoten_pruefen(&t, &knoten("Dialog", "A0001")), Ok('D'));
        assert_eq!(neuen_knoten_pruefen(&t, &knoten("Bubble", "F0001")), Ok('B'));
        assert_eq!(neuen_knoten_pruefen(&t, &knoten("Bubble", "I0007")), Ok('B'), "Feature übersprungen");
        assert_eq!(neuen_knoten_pruefen(&t, &knoten("Feature", "I0007")), Ok('F'));
        assert!(fehler(neuen_knoten_pruefen(&t, &NeuerKnoten { fertig_kriterium: " ".into(), ..knoten("Interaction", "D0002") })).starts_with("Fertig-Kriterium fehlt"));
        assert!(fehler(neuen_knoten_pruefen(&t, &NeuerKnoten { name: String::new(), ..knoten("Interaction", "D0002") })).contains("Namen"));
        assert_eq!(fehler(neuen_knoten_pruefen(&t, &knoten("Bubble", "D0002"))), "Eine Bubble hängt an Feature oder Interaction, nicht an Dialog (D0002)");
        assert!(fehler(neuen_knoten_pruefen(&t, &knoten("Interaction", "A0001"))).contains("nicht an Application"));
        assert!(fehler(neuen_knoten_pruefen(&t, &knoten("Application", ""))).contains("Application"));
        assert!(fehler(neuen_knoten_pruefen(&t, &knoten("Slice", "D0002"))).starts_with("Unbekannte Ebene"));
        assert!(fehler(neuen_knoten_pruefen(&t, &knoten("Interaction", "D0099"))).contains("D0099"));
        assert!(matches!(neuen_knoten_pruefen(&t, &knoten("Feature", "I0009")), Err(Fehler::Konflikt(_))), "unter einem verworfenen Knoten");
    }

    #[test]
    fn aufwand_nur_bei_bubbles_und_nie_unter_der_untergrenze() {
        let t = wbs_tabelle(&wbs(&[("D0001", "Dialog", "—", "rot"), ("I0001", "Interaction", "D0001", "rot")]));
        let mit = |ebene: &str, a: &str| neuen_knoten_pruefen(&t, &NeuerKnoten { aufwand: a.into(), ..knoten(ebene, if ebene == "Bubble" { "I0001" } else { "D0001" }) });
        for gut in ["0,5-1", "1", "0.4-2h", "1–2", " 2 "] {
            assert_eq!(mit("Bubble", gut), Ok('B'), "{gut}");
        }
        assert!(fehler(mit("Bubble", "0,25-1")).contains("Untergrenze"));
        assert!(fehler(mit("Bubble", "0,3")).contains("Untergrenze"));
        assert!(fehler(mit("Bubble", "viel")).contains("nicht lesbar"));
        assert!(fehler(mit("Interaction", "1-2")).contains("nur bei Bubbles"));
        assert!(fehler(neuen_knoten_pruefen(&t, &NeuerKnoten { braucht: vec!["I0001".into(), "x".into()], ..knoten("Interaction", "D0001") })).contains("„x“"));
    }

    /// D0002 gruen mit I0007 (zwei Bubbles) und I0008, danach D0003.
    fn mit_d0002() -> String {
        wbs(&[("A0001", "Application", "—", "gelb"), ("D0002", "Dialog", "A0001", "gruen"), ("I0007", "Interaction", "D0002", "gruen"), ("B0001", "Bubble", "I0007", "gruen"), ("I0008", "Interaction", "D0002", "gruen"), ("B0002", "Bubble", "I0008", "gruen"), ("D0003", "Dialog", "A0001", "rot"), ("I0009", "Interaction", "D0003", "rot")])
    }

    #[test]
    fn neue_interaction_steht_nach_dem_letzten_nachfahren_ihres_dialogs_und_der_dialog_ist_nicht_mehr_gruen() {
        let vorher = mit_d0002();
        let g = knoten_anlegen(&vorher, &NeuerKnoten { name: "X | Y".into(), ..knoten("Interaction", "D0002") }, "I0048", "2026-10-18").unwrap();
        assert_eq!(g.geaendert, ["I0048", "D0002"], "A0001 bleibt gelb (D0003 rot)");
        let zeilen: Vec<&str> = g.text.lines().collect();
        let neu = zeilen.iter().position(|z| z.starts_with("| I0048 |")).unwrap();
        assert!(zeilen[neu - 1].starts_with("| B0002 |") && zeilen[neu + 1].starts_with("| D0003 |"), "nach dem letzten Nachfahren von D0002");
        assert_eq!(zeilen[neu], "| I0048 | Interaction | D0002 | X \\| Y | rot |  |  |  |", "Spalten der Kopfzeile, Strich maskiert, unbekannte Spalte Phase leer");
        assert!(g.text.contains("| D0002 | Dialog | A0001 | Name D0002 | gelb |"));
        assert_eq!(g.text.lines().count(), vorher.lines().count() + 1);
        let wieder = wbs_tabelle(&g.text);
        assert_eq!(wieder.knoten("I0048").map(|k| (k.name.as_str(), k.status.as_str(), k.eltern.as_str())), Some(("X | Y", "rot", "D0002")));
        assert_eq!(knoten_anlegen(&vorher, &knoten("Interaction", "D0002"), "I0007", "h").unwrap_err(), Fehler::Konflikt("I0007 steht schon in der WBS".into()));
    }

    #[test]
    fn bubble_mit_allen_feldern_auch_am_dateiende_ohne_umbruch() {
        let vorher = mit_d0002().trim_end().to_string();
        let neu = NeuerKnoten { eingabe_ausgabe: "a → b".into(), aufwand: "0,5-1h".into(), braucht: vec!["B0001".into(), " I0007".into()], requirement: "R00056".into(), notiz: "n".into(), ..knoten("Bubble", "I0009") };
        let g = knoten_anlegen(&vorher, &neu, "B0003", "h").unwrap();
        assert!(g.text.ends_with("| I0009 | Interaction | D0003 | Name I0009 | rot | a \\| b → c |  | Abnahme |\n| B0003 | Bubble | I0009 | X | rot | a → b | n |  |\n"), "{}", g.text);
        assert_eq!(g.geaendert, ["B0003"], "I0009 rot bleibt rot");
        let k = wbs_tabelle(&g.text).knoten("B0003").cloned().unwrap();
        assert_eq!(k.notiz, "n");
        let voll = "| ID | Ebene | Eltern | Name | Status | Fertig-Kriterium | Eingabe → Ausgabe | Aufwand | Ausbaustufe | Braucht | Requirement | Notiz |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n| I0001 | Interaction | — | I | rot |  |  |  |  |  |  |  |\n";
        let g = knoten_anlegen(voll, &NeuerKnoten { ausbaustufe: "2".into(), eltern: "I0001".into(), ..neu }, "B0001", "h").unwrap();
        assert!(g.text.ends_with("| B0001 | Bubble | I0001 | X | rot | US-1 | a → b | 0,5-1 | 2 | B0001, I0007 | R00056 | n |\n"), "alle Spalten von /planung: {}", g.text);
    }

    #[test]
    fn ueberarbeiten_setzt_den_gruenen_dialog_samt_zaehlender_nachfahren_rot_in_einem_schreibvorgang() {
        let vorher = wbs(&[("A0001", "Application", "—", "gruen"), ("D0001", "Dialog", "A0001", "gruen"), ("I0001", "Interaction", "D0001", "gruen"), ("D0002", "Dialog", "A0001", "gruen"), ("I0007", "Interaction", "D0002", "gruen"), ("B0001", "Bubble", "I0007", "gruen"), ("B0002", "Bubble", "I0007", "gruen"), ("F0001", "Feature", "I0007", "option"), ("B0003", "Bubble", "F0001", "gruen"), ("I0008", "Interaction", "D0002", "gruen"), ("B0004", "Bubble", "I0008", "bestehend"), ("B0005", "Bubble", "I0008", "gruen"), ("I0009", "Interaction", "D0002", "verworfen")]);
        let g = teilbaum_auf_rot(&vorher, "D0002", "2026-10-18").unwrap();
        assert_eq!(g.geaendert, ["D0002", "I0007", "B0001", "B0002", "B0003", "I0008", "B0005", "A0001"], "Teilbaum in Dateireihenfolge, dann die Vorfahren");
        let t = wbs_tabelle(&g.text);
        let status = |id: &str| t.knoten(id).unwrap().status.clone();
        assert_eq!(["D0002", "I0007", "B0001", "B0002", "F0001", "B0003", "I0008", "B0004", "B0005", "I0009", "D0001", "I0001", "A0001"].map(status), ["rot", "rot", "rot", "rot", "option", "rot", "rot", "bestehend", "rot", "verworfen", "gruen", "gruen", "gelb"]);
        assert_eq!(andere_zeilen(&vorher, &g.text).len(), 9, "acht Status-Zellen und zuletzt");
        assert!(g.text.contains("zuletzt: 2026-10-18"));
        assert_eq!(teilbaum_auf_rot(&g.text, "D0002", "h").unwrap(), Geschrieben { text: g.text.clone(), geaendert: vec![] }, "schon rot ändert nichts, auch nicht zuletzt");
    }

    #[test]
    fn ueberarbeiten_eines_blatts_setzt_es_rot_und_rechnet_die_vorfahren() {
        let g = teilbaum_auf_rot(&drei_ebenen("gruen", "gruen"), "B0002", "h").unwrap();
        assert_eq!(g.geaendert, ["B0002"], "I0002 gemischt gelb wie in der Datei, darüber ebenso");
        assert_eq!(g.text, status_setzen(&drei_ebenen("gruen", "gruen"), "B0002", "rot", "h").unwrap().text, "wie das Setzen des Blatts");
        assert!(matches!(teilbaum_auf_rot(&g.text, "B0003", "h"), Err(Fehler::Konflikt(m)) if m.contains("verworfen")));
        assert!(matches!(teilbaum_auf_rot(&g.text, "B0099", "h"), Err(Fehler::NichtGefunden(_))));
        assert!(matches!(teilbaum_auf_rot("# ohne Tabelle\n", "B0002", "h"), Err(Fehler::Konflikt(_))));
    }

    #[test]
    fn verwerfen_markiert_knoten_und_zaehlende_nachfahren_und_loescht_nichts() {
        let vorher = wbs(&[("A0001", "Application", "—", "gelb"), ("D0001", "Dialog", "A0001", "gelb"), ("I0006", "Interaction", "D0001", "gruen"), ("I0007", "Interaction", "D0001", "rot"), ("B0001", "Bubble", "I0007", "gruen"), ("B0002", "Bubble", "I0007", "rot"), ("F0001", "Feature", "I0007", "option"), ("B0003", "Bubble", "F0001", "rot")]);
        let g = verwerfen(&vorher, "I0007", "doch | anders", "2026-10-18").unwrap();
        assert_eq!(g.geaendert, ["I0007", "B0001", "B0002", "B0003", "D0001", "A0001"], "die Option bleibt Option, ihre Bubble zählt und wird verworfen; D0001 und A0001 nur noch I0006 → gruen");
        assert_eq!(g.text.lines().count(), vorher.lines().count(), "keine Zeile entfernt");
        let t = wbs_tabelle(&g.text);
        let status = |id: &str| t.knoten(id).unwrap().status.clone();
        assert_eq!(["I0007", "B0001", "B0002", "F0001", "B0003", "D0001", "I0006"].map(status), ["verworfen", "verworfen", "verworfen", "option", "verworfen", "gruen", "gruen"]);
        assert_eq!(t.knoten("I0007").unwrap().notiz, "verworfen: doch | anders");
        assert!(g.text.contains("| verworfen | a \\| b → c | verworfen: doch \\| anders | Abnahme |"));
        assert_eq!(crate::wbs::stand(&t).slices, 1, "der Slice-Stand zählt sie nicht mehr");
        assert_eq!(verwerfen(&g.text, "I0007", "", "h").unwrap_err(), Fehler::Konflikt("I0007 ist schon verworfen".into()));
        assert!(matches!(verwerfen(&vorher, "A0001", "", "h"), Err(Fehler::Konflikt(m)) if m.contains("Application")));
        assert!(matches!(verwerfen(&vorher, "B0099", "", "h"), Err(Fehler::NichtGefunden(_))));
        let ohne_grund = verwerfen(&vorher, "B0002", "", "h").unwrap();
        assert_eq!(wbs_tabelle(&ohne_grund.text).knoten("B0002").unwrap().notiz, "", "ohne Grund bleibt die Notiz");
        assert_eq!(ohne_grund.geaendert, ["B0002", "I0007", "D0001", "A0001"], "I0007 zählt nur noch B0001 (gruen), B0003 hängt an der Option — damit wird alles darüber gruen");
    }
}
