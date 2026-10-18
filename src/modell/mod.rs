//! Die Begriffe von kanbanD als Daten — ohne Dateien, ohne HTTP.

mod aufgabe;
mod board;
mod einstellungen;

pub use aufgabe::{Aufgabe, Kommentar, Teilaufgabe, Zeiteintrag};
pub use board::{Bewegfehler, Board, Spalte};
pub use einstellungen::{Art, Einstellungen, Klasse, Person, Quellen, kuerzel_gueltig};

/// Dateiname aus einem Titel: Kleinbuchstaben, Umlaute als ae/oe/ue/ss, sonst Bindestriche; höchstens 40 Zeichen.
pub fn slug(titel: &str) -> String {
    let mut s = String::new();
    for c in titel.to_lowercase().chars() {
        match c {
            'ä' => s.push_str("ae"),
            'ö' => s.push_str("oe"),
            'ü' => s.push_str("ue"),
            'ß' => s.push_str("ss"),
            c if c.is_ascii_alphanumeric() => s.push(c),
            _ if !s.ends_with('-') => s.push('-'),
            _ => {}
        }
    }
    let s = s.trim_matches('-');
    let gekuerzt: String = s.chars().take(40).collect();
    gekuerzt.trim_end_matches('-').to_string()
}

#[cfg(test)]
mod tests {
    use super::slug;

    #[test]
    fn slug_ersetzt_umlaute_und_sonderzeichen() {
        assert_eq!(slug("Größe ändern: Übersicht!"), "groesse-aendern-uebersicht");
        assert_eq!(slug("  --A  B--  "), "a-b");
        assert_eq!(slug("!!!"), "");
    }

    #[test]
    fn slug_wird_auf_40_zeichen_gekuerzt_ohne_endstrich() {
        let s = slug(&"wort ".repeat(20));
        assert!(s.len() <= 40);
        assert!(!s.ends_with('-'));
    }
}
