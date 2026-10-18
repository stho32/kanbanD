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

/// Dauer-Eingabe in Minuten: `0:45`, `1,5` / `1.5` (Stunden), `90 min`, `45min`, `20m`. Null zählt nicht.
pub fn dauer_lesen(eingabe: &str) -> Option<i64> {
    let e = eingabe.trim().to_lowercase().replace(',', ".");
    let minuten = if let Some((h, m)) = e.split_once(':') {
        let (h, m): (i64, i64) = (h.trim().parse().ok()?, m.trim().parse().ok()?);
        if !(0..60).contains(&m) {
            return None;
        }
        h * 60 + m
    } else if let Some(m) = e.strip_suffix("min").or_else(|| e.strip_suffix('m')) {
        m.trim().parse().ok()?
    } else {
        let stunden: f64 = e.parse().ok()?;
        (stunden * 60.0).round() as i64
    };
    (minuten > 0).then_some(minuten)
}

/// Zeitpunkt um `minuten` verschoben (negativ = früher).
pub fn verschieben(zeitpunkt: &str, minuten: i64) -> Option<String> {
    let z = chrono::NaiveDateTime::parse_from_str(zeitpunkt, ZEITFORMAT).ok()?;
    Some((z + chrono::Duration::minutes(minuten)).format(ZEITFORMAT).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dauer_formen() {
        for (e, m) in [("0:45", Some(45)), ("1:30", Some(90)), ("1,5", Some(90)), ("1.5", Some(90)), ("90 min", Some(90)), ("45min", Some(45)), ("20m", Some(20)), (" 2 ", Some(120))] {
            assert_eq!(dauer_lesen(e), m, "{e}");
        }
        for e in ["x", "0", "0:00", "1:75", "-5m", "", "a:b"] {
            assert_eq!(dauer_lesen(e), None, "{e}");
        }
    }

    #[test]
    fn verschieben_ueber_tagesgrenze() {
        assert_eq!(verschieben("2026-10-18 00:30", -45), Some("2026-10-17 23:45".into()));
        assert_eq!(verschieben("kaputt", 5), None);
    }

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
