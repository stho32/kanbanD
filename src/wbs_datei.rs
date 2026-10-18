//! Die WBS-Datei als Text ändern — byte-treu: was nicht geändert werden soll, bleibt Byte für Byte stehen. Rein, ohne Dateizugriff.

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
}
