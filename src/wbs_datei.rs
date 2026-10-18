//! Die WBS-Datei als Text ändern — byte-treu: was nicht geändert werden soll, bleibt Byte für Byte stehen. Rein, ohne Dateizugriff.

use crate::fehler::Fehler;
use crate::herkunft::wbs_tabelle;
use crate::wbs::{WbsKnoten, WbsTabelle};
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
}
