//! Die WBS-Datei als Text ändern — byte-treu: was nicht geändert werden soll, bleibt Byte für Byte stehen. Rein, ohne Dateizugriff.

use crate::fehler::Fehler;
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
}
