//! Zeitpunkte für Zeiteinträge und Kommentare, in der Form der Dateien (R00084).
//!
//! Neu geschrieben wird `JJJJ-MM-TT HH:MM±HH:MM` mit dem Versatz der Ortszeit; Altbestand ohne Versatz
//! gilt als Ortszeit. Gerechnet wird über den Moment in UTC, nie über den Text.

use crate::format::aufgabe::ZEITFORMAT;
use chrono::{DateTime, Duration, FixedOffset, Local, LocalResult, NaiveDateTime, Offset, TimeZone, Timelike, Utc};

/// Ein Zeitpunkt, wie er in einer Datei steht: Wanduhr und — wenn angegeben — ihr Versatz zu UTC.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Zeitpunkt {
    wanduhr: NaiveDateTime,
    versatz: Option<FixedOffset>,
}

impl Zeitpunkt {
    /// `JJJJ-MM-TT HH:MM` mit optionalen Sekunden, `T` statt Leerzeichen, und optional `Z` oder `±HH:MM`.
    pub fn lesen(s: &str) -> Option<Zeitpunkt> {
        let s = s.trim();
        let (wanduhr, versatz) = match s.get(11..).and_then(|zeit| zeit.find(['Z', '+', '-'])) {
            Some(i) => (&s[..11 + i], Some(versatz_lesen(&s[11 + i..])?)),
            None => (s, None),
        };
        let wanduhr = wanduhr.replacen('T', " ", 1);
        let wanduhr = NaiveDateTime::parse_from_str(&wanduhr, ZEITFORMAT).or_else(|_| NaiveDateTime::parse_from_str(&wanduhr, "%Y-%m-%d %H:%M:%S")).ok()?;
        Some(Zeitpunkt { wanduhr: wanduhr.with_second(0)?, versatz })
    }

    fn aus(moment: DateTime<FixedOffset>) -> Zeitpunkt {
        Zeitpunkt { wanduhr: moment.naive_local().with_second(0).expect("Sekunde 0 gibt es immer"), versatz: Some(*moment.offset()) }
    }

    /// Der eindeutige Moment; ohne Versatz gedeutet als Ortszeit.
    pub fn moment(&self) -> DateTime<FixedOffset> {
        match self.versatz {
            Some(v) => v.from_local_datetime(&self.wanduhr).single().expect("fester Versatz ist eindeutig"),
            None => ortszeit_deuten(self.wanduhr),
        }
    }

    pub fn utc(&self) -> DateTime<Utc> {
        self.moment().with_timezone(&Utc)
    }

    /// Derselbe Moment in Ortszeit, mit deren Versatz — die Form für neu geschriebene Zeitpunkte.
    pub fn in_ortszeit(&self) -> Zeitpunkt {
        Zeitpunkt::aus(self.moment().with_timezone(&Local).fixed_offset())
    }

    /// ISO-Form mit Versatz, `2026-10-25T05:57+01:00`; ohne Versatz der der Ortszeit-Deutung (R00090).
    pub fn iso(&self) -> String {
        self.moment().format("%Y-%m-%dT%H:%M%:z").to_string()
    }

    /// Dateiform: mit Versatz, wenn er gelesen oder gesetzt wurde, sonst wie der Altbestand ohne.
    pub fn datei(&self) -> String {
        let wanduhr = self.wanduhr.format(ZEITFORMAT);
        match self.versatz {
            Some(v) => format!("{wanduhr}{v}"),
            None => wanduhr.to_string(),
        }
    }
}

/// `Z`, `+01:00`, `-03:30` — Stunden unter 24, Minuten unter 60.
fn versatz_lesen(s: &str) -> Option<FixedOffset> {
    if s == "Z" {
        return FixedOffset::east_opt(0);
    }
    let vorzeichen = match s.get(..1)? {
        "+" => 1,
        "-" => -1,
        _ => return None,
    };
    let (h, m) = s.get(1..)?.split_once(':')?;
    if h.len() != 2 || m.len() != 2 {
        return None;
    }
    let (h, m): (i32, i32) = (h.parse().ok()?, m.parse().ok()?);
    if h > 23 || m > 59 {
        return None;
    }
    FixedOffset::east_opt(vorzeichen * (h * 3600 + m * 60))
}

/// Zweideutige Ortszeit (Umstellung im Herbst) ist die frühere, fehlende (im Frühjahr) die spätere Deutung.
fn ortszeit_deuten(wanduhr: NaiveDateTime) -> DateTime<FixedOffset> {
    match Local.from_local_datetime(&wanduhr) {
        LocalResult::Single(d) => d.fixed_offset(),
        // chrono liefert die beiden Deutungen nicht zeitlich sortiert
        LocalResult::Ambiguous(a, b) => a.min(b).fixed_offset(),
        LocalResult::None => {
            let versatz_vor_der_luecke = Local.from_local_datetime(&(wanduhr - Duration::hours(3))).earliest().map_or(Utc.fix(), |d| d.offset().fix());
            let moment = versatz_vor_der_luecke.from_local_datetime(&wanduhr).single().expect("fester Versatz ist eindeutig");
            moment.with_timezone(&Local).fixed_offset()
        }
    }
}

/// Jetzt in Ortszeit als `JJJJ-MM-TT HH:MM±HH:MM`.
pub fn jetzt() -> String {
    Zeitpunkt::aus(Local::now().fixed_offset()).datei()
}

/// Heute in Ortszeit als `JJJJ-MM-TT`.
pub fn heute() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

/// Minuten zwischen zwei Zeitpunkten, gerechnet über UTC (nie negativ).
pub fn minuten(beginn: &str, ende: &str) -> Option<i64> {
    let (b, e) = (Zeitpunkt::lesen(beginn)?, Zeitpunkt::lesen(ende)?);
    Some((e.utc() - b.utc()).num_minutes().max(0))
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

/// Zeitpunkt um `minuten` verschoben (negativ = früher); mit Versatz im Versatz des neuen Moments.
pub fn verschieben(zeitpunkt: &str, minuten: i64) -> Option<String> {
    let z = Zeitpunkt::lesen(zeitpunkt)?;
    let d = Duration::minutes(minuten);
    let verschoben = match z.versatz {
        Some(_) => Zeitpunkt::aus(z.moment() + d).in_ortszeit(),
        None => Zeitpunkt { wanduhr: z.wanduhr + d, versatz: None },
    };
    Some(verschoben.datei())
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
    }

    #[test]
    fn zeitpunkte_aller_formen_in_dateiform() {
        for (e, d) in [
            ("2026-10-25 07:41+01:00", "2026-10-25 07:41+01:00"),
            ("2026-10-25T07:41+01:00", "2026-10-25 07:41+01:00"),
            ("2026-10-25T06:41Z", "2026-10-25 06:41+00:00"),
            ("2026-10-25 07:41:30-03:30", "2026-10-25 07:41-03:30"),
            (" 2026-10-25 07:41 ", "2026-10-25 07:41"),
            ("2026-10-25 07:41:59", "2026-10-25 07:41"),
            ("2026-10-25T07:41", "2026-10-25 07:41"),
        ] {
            assert_eq!(Zeitpunkt::lesen(e).map(|z| z.datei()), Some(d.to_string()), "{e}");
        }
        for e in ["", "x", "2026-13-01 00:00", "2026-10-25 07:41+1", "2026-10-25 07:41+25:00", "2026-10-25 07:41 Uhr", "2026-10-25"] {
            assert_eq!(Zeitpunkt::lesen(e), None, "{e}");
        }
    }

    #[test]
    fn rechnen_ueber_utc() {
        assert_eq!(minuten("2026-10-25 02:33+02:00", "2026-10-25 02:10+01:00"), Some(37), "über die Umstellung");
        assert_eq!(minuten("2026-10-25 08:00+01:00", "2026-10-25T07:30Z"), Some(30), "zwei Zonen");
        let utc = Zeitpunkt::lesen("2026-10-25 02:33+02:00").unwrap().utc();
        assert_eq!(utc.to_rfc3339(), "2026-10-25T00:33:00+00:00");
    }

    #[test]
    fn jetzt_endet_auf_einen_versatz() {
        let j = jetzt();
        assert_eq!(j.len(), 22, "{j}");
        assert!(matches!(&j[16..17], "+" | "-"), "{j}");
        let z = Zeitpunkt::lesen(&j).unwrap();
        assert_eq!(z.datei(), j, "verlustfrei");
    }

    #[test]
    fn mit_versatz_bleibt_er_beim_verschieben_ohne_bleibt_es_ohne() {
        assert!(verschieben("2026-10-18 09:00+02:00", 30).unwrap().ends_with(":00"), "mit Versatz");
        assert_eq!(verschieben("2026-10-18 09:00", 30), Some("2026-10-18 09:30".into()));
    }
}
