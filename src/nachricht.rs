//! Commit-Nachrichten sind abgeleiteter Text (ADR-0005 N1).
//!
//! Die Fachdaten tragen, was YAML schreiben kann; Git nicht: ein NUL-Byte lässt `git commit` scheitern
//! („nul byte found in provided data"), ein übergroßer Wert sprengt die Argumentgrenze. Diese Stelle macht
//! aus Fachdaten eine Zeile — Steuerzeichen und Zeilentrenner werden zu einem Leerzeichen, die Länge ist
//! begrenzt. Die Datei behält den rohen Wert; nur die Nachricht ist abgeleitet.

/// Höchstzahl Zeichen eines Werts in einer Nachricht: genug für die Aussage, kurz genug für eine Zeile.
const WERTLAENGE: usize = 60;

/// Höchstzahl Zeichen der ganzen Nachricht. Wer mehr baut, hat einen Wert nicht durch [`wert`] geschickt;
/// `committen` kürzt ihn trotzdem, statt den Commit an der Argumentgrenze scheitern zu lassen.
const NACHRICHTLAENGE: usize = 120;

/// Ein Feldwert, wie er in eine Commit-Nachricht darf: eine Zeile ohne Steuerzeichen, außen getrimmt,
/// auf [`WERTLAENGE`] Zeichen gekürzt (Rest `…`).
pub fn wert(text: &str) -> String {
    kuerzen(&eine_zeile(text), WERTLAENGE)
}

/// Die fertige Nachricht, ein letztes Mal abgeleitet: eine Zeile ohne Steuerzeichen, begrenzt auf
/// [`NACHRICHTLAENGE`]. So bleibt auch ein Schreibweg ohne [`wert`] ein sauberer Commit.
pub fn fertig(text: &str) -> String {
    kuerzen(&eine_zeile(text), NACHRICHTLAENGE)
}

/// Steuerzeichen (NUL, Umbruch, Tabulator, C1) und Unicode-Zeilentrenner werden zu einem Leerzeichen.
fn eine_zeile(text: &str) -> String {
    text.chars()
        .map(|c| {
            if c.is_control() || matches!(c, '\u{2028}' | '\u{2029}') {
                ' '
            } else {
                c
            }
        })
        .collect::<String>()
        .trim()
        .to_string()
}

fn kuerzen(text: &str, grenze: usize) -> String {
    if text.chars().count() <= grenze {
        return text.to_string();
    }
    let mut kurz: String = text.chars().take(grenze).collect();
    kurz.push('…');
    kurz
}

#[cfg(test)]
mod tests {
    use super::{fertig, wert};

    #[test]
    fn steuerzeichen_werden_zu_leerzeichen() {
        assert_eq!(wert("a\u{0}b"), "a b");
        assert_eq!(wert("zwei\nZeilen"), "zwei Zeilen");
        assert_eq!(wert("Tab\tund\r\nUmbruch"), "Tab und  Umbruch");
        assert_eq!(wert("  außen  "), "außen");
    }

    #[test]
    fn lange_werte_werden_gekuerzt_und_kurze_bleiben() {
        assert_eq!(
            wert(&"x".repeat(60)),
            "x".repeat(60),
            "genau die Grenze bleibt ganz"
        );
        let lang = wert(&"x".repeat(61));
        assert_eq!(
            lang.chars().count(),
            61,
            "60 Zeichen und das Auslassungszeichen"
        );
        assert!(lang.ends_with('…'), "{lang:?}");
    }

    #[test]
    fn die_ganze_nachricht_bleibt_eine_kurze_zeile() {
        let nachricht = fertig(&format!("#1 „{}“ angelegt", "x".repeat(200)));
        assert_eq!(
            nachricht.chars().count(),
            121,
            "120 Zeichen und das Auslassungszeichen"
        );
        assert!(!nachricht.chars().any(char::is_control));
        assert!(nachricht.starts_with("#1 „xxx"), "{nachricht:?}");
    }
}
