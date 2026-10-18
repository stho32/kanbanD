//! Ortszeit für Zeiteinträge und Kommentare, in der Form der Dateien.

use crate::format::aufgabe::ZEITFORMAT;

/// Jetzt in Ortszeit als `JJJJ-MM-TT HH:MM`.
pub fn jetzt() -> String {
    chrono::Local::now().naive_local().format(ZEITFORMAT).to_string()
}

/// Minuten zwischen zwei Zeitpunkten der Form `JJJJ-MM-TT HH:MM` (nie negativ).
pub fn minuten(beginn: &str, ende: &str) -> Option<i64> {
    let b = chrono::NaiveDateTime::parse_from_str(beginn, ZEITFORMAT).ok()?;
    let e = chrono::NaiveDateTime::parse_from_str(ende, ZEITFORMAT).ok()?;
    Some((e - b).num_minutes().max(0))
}

/// `h:mm`
pub fn hm(minuten: i64) -> String {
    format!("{}:{:02}", minuten / 60, minuten % 60)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dauer_in_minuten_und_als_h_mm() {
        assert_eq!(minuten("2026-10-18 09:00", "2026-10-18 10:42"), Some(102));
        assert_eq!(minuten("2026-10-18 23:30", "2026-10-19 00:15"), Some(45));
        assert_eq!(minuten("2026-10-18 10:00", "2026-10-18 09:00"), Some(0));
        assert_eq!(minuten("x", "2026-10-18 09:00"), None);
        assert_eq!(hm(102), "1:42");
        assert_eq!(hm(5), "0:05");
        assert_eq!(jetzt().len(), 16);
    }
}
