//! Das Protokoll je Instanz (ADR-0001 N1, R00258): Zeilenformat, Stufen und Senken.
//!
//! Kein globaler Zustand: jede Instanz hat ihren eigenen `Protokoll`-Wert (N1.7 Regel 1). Die Senke ist ein
//! Provider — Datei und stderr im Betrieb, ein Sammler im Test. Geschrieben wird synchron, bevor die Antwort den
//! Server verlässt (N1.7 Regel 2), deshalb braucht kein Test zu warten. Die Datei-Senke mit Rotation folgt in B1375.

use crate::uhr::{Ortsuhr, Uhr};
use chrono::{DateTime, FixedOffset};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Ein Wert im Protokoll ist höchstens so lang, dann `…` (N1.3, AK 12).
pub const WERT_HOECHSTENS: usize = 200;

/// Ein Kopfwert (`X-KanbanD-Wer`, `X-KanbanD-Instanz`) ist höchstens so lang, dann `…` (N1.3, AK 12).
pub const KOPF_HOECHSTENS: usize = 32;

/// Die Stufen aus N1.2 Regel 4, geordnet: ein Protokoll zeigt nur, was seine Stufe erreicht.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Stufe {
    Debug,
    Info,
    Warn,
    Error,
    Exception,
}

impl Stufe {
    /// Die Stufen, die `--log`/`KANBAND_LOG` annehmen; unbekannt ⇒ `None` (Aufruffehler, AK 19).
    pub fn lesen(wert: &str) -> Option<Stufe> {
        Some(match wert.trim().to_ascii_lowercase().as_str() {
            "debug" => Stufe::Debug,
            "info" => Stufe::Info,
            "warn" => Stufe::Warn,
            "error" => Stufe::Error,
            _ => return None,
        })
    }

    pub fn text(self) -> &'static str {
        match self {
            Stufe::Debug => "DEBUG",
            Stufe::Info => "INFO",
            Stufe::Warn => "WARN",
            Stufe::Error => "ERROR",
            Stufe::Exception => "EXCEPTION",
        }
    }
}

/// Das Ereignis einer Zeile — ein fester Text aus geschlossener Liste, er enthält nie `=` (N1.3).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ereignis {
    Gestartet,
    Commit,
    Abgewiesen,
    Fehlgeschlagen,
    Panik,
    BrowserNichtGeoeffnet,
    OrdnerNichtBeobachtet,
    ResteNachLoeschen,
}

impl Ereignis {
    pub fn text(self) -> &'static str {
        match self {
            Ereignis::Gestartet => "gestartet",
            Ereignis::Commit => "commit",
            Ereignis::Abgewiesen => "abgewiesen",
            Ereignis::Fehlgeschlagen => "fehlgeschlagen",
            Ereignis::Panik => "Panik",
            Ereignis::BrowserNichtGeoeffnet => "Browser nicht geöffnet",
            Ereignis::OrdnerNichtBeobachtet => "Ordner nicht beobachtet",
            Ereignis::ResteNachLoeschen => "Reste nach dem Löschen",
        }
    }
}

/// Die gesammelten Zeilen einer Testsenke (N1.7 Regel 1).
pub type Sammler = Arc<Mutex<Vec<String>>>;

/// Das Protokoll einer Instanz. Klonbar — alle Klone teilen die Senke.
#[derive(Clone)]
pub struct Protokoll {
    stufe: Stufe,
    sammler: Option<Sammler>,
    uhr: Arc<dyn Uhr>,
}

impl Protokoll {
    /// Ein Protokoll ohne Ausgabe; für Werte, die nur der Vollständigkeit wegen eines tragen.
    pub fn stumm() -> Protokoll {
        Protokoll { stufe: Stufe::Info, sammler: None, uhr: Arc::new(Ortsuhr) }
    }

    /// Eine Testsenke: liefert das Protokoll und den Sammler (N1.7 Regel 1).
    pub fn sammler() -> (Protokoll, Sammler) {
        Protokoll::sammler_mit_uhr(Arc::new(Ortsuhr))
    }

    /// Wie [`Protokoll::sammler`], mit fester Uhr — für Zeilen mit Zeitstempel.
    pub fn sammler_mit_uhr(uhr: Arc<dyn Uhr>) -> (Protokoll, Sammler) {
        Protokoll::sammler_mit_stufe_und_uhr(Stufe::Info, uhr)
    }

    /// Eine Testsenke mit gewählter Stufe (AK 18).
    pub fn sammler_mit_stufe(stufe: Stufe) -> (Protokoll, Sammler) {
        Protokoll::sammler_mit_stufe_und_uhr(stufe, Arc::new(Ortsuhr))
    }

    fn sammler_mit_stufe_und_uhr(stufe: Stufe, uhr: Arc<dyn Uhr>) -> (Protokoll, Sammler) {
        let sammler: Sammler = Arc::new(Mutex::new(vec![]));
        (Protokoll { stufe, sammler: Some(sammler.clone()), uhr }, sammler)
    }

    /// Der Betriebsfall: Datei im `log_ordner` und stderr (N1.2 Regel 1). Baut die Datei-Senke noch nicht (B1375).
    pub fn betrieb(stufe: Stufe, _log_ordner: impl Into<PathBuf>) -> Protokoll {
        Protokoll { stufe, sammler: None, uhr: Arc::new(Ortsuhr) }
    }

    pub fn stufe(&self) -> Stufe {
        self.stufe
    }

    pub fn uhr(&self) -> &Arc<dyn Uhr> {
        &self.uhr
    }

    /// Der Pfad der laufenden Datei, wenn es eine Datei-Senke ist (FA 6, `log=`).
    pub fn log_pfad(&self) -> Option<PathBuf> {
        None
    }

    /// Schreibt eine Zeile, wenn die Stufe sie zulässt (N1.3). Ein Fehler der Datei-Senke stoppt nie (N1.2 Regel 3).
    pub fn schreiben(&self, stufe: Stufe, ereignis: Ereignis, felder: &[(&str, String)]) {
        if stufe < self.stufe {
            return;
        }
        let text = zeile(self.uhr.jetzt(), stufe, ereignis, felder);
        if let Some(sammler) = &self.sammler {
            sammler.lock().unwrap_or_else(|e| e.into_inner()).push(text);
        }
    }
}

/// Eine Protokollzeile als Text (reine Funktion, N1.3): Zeitstempel, Stufe, Ereignis, Felder.
pub fn zeile(zeitpunkt: DateTime<FixedOffset>, stufe: Stufe, ereignis: Ereignis, felder: &[(&str, String)]) -> String {
    let mut s = format!("{} {} {}", zeitpunkt.format("%Y-%m-%dT%H:%M:%S%.3f%:z"), stufe.text(), ereignis.text());
    for (name, wert) in felder {
        s.push(' ');
        s.push_str(name);
        s.push('=');
        s.push_str(&im_format(wert));
    }
    s
}

/// Einen Wert für die Zeile: höchstens [`WERT_HOECHSTENS`], gekürzt mit `…`; Sonderzeichen escaped (N1.3, AK 12/13).
pub fn im_format(wert: &str) -> String {
    let roh = kuerzen(wert, WERT_HOECHSTENS);
    if !roh.chars().any(muss_escaped_werden) {
        return roh;
    }
    let mut s = String::with_capacity(roh.len() + 2);
    s.push('"');
    for c in roh.chars() {
        match c {
            '"' => s.push_str("\\\""),
            '\\' => s.push_str("\\\\"),
            '\n' => s.push_str("\\n"),
            '\r' => s.push_str("\\u{d}"),
            '\t' => s.push_str("\\u{9}"),
            c if c.is_control() => s.push_str(&format!("\\u{{{:x}}}", c as u32)),
            c => s.push(c),
        }
    }
    s.push('"');
    s
}

/// Muss dieser Wert in Anführungszeichen und escaped werden? Leerzeichen (auch geschützte), Steuerzeichen, `"` und `\`.
fn muss_escaped_werden(c: char) -> bool {
    c.is_whitespace() || c.is_control() || c == '"' || c == '\\'
}

/// `…` auf höchstens `grenze` Zeichen; ein Wert an der Grenze bleibt unverändert.
pub fn kuerzen(wert: &str, grenze: usize) -> String {
    let mut s: String = wert.chars().take(grenze).collect();
    if wert.chars().count() > grenze {
        s.push('…');
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::uhr::FesteUhr;

    fn zeitpunkt(text: &str) -> DateTime<FixedOffset> {
        FesteUhr::aus_rfc3339(text).jetzt()
    }

    // AK 13: Zeilenformat und Escaping als Tabelle
    #[test]
    fn zeile_hat_zeitpunkt_stufe_ereignis_und_felder() {
        let z = zeile(zeitpunkt("2026-11-23T14:19:05.123+01:00"), Stufe::Warn, Ereignis::Abgewiesen, &[("status", "400".into()), ("wer", "cl".into())]);
        assert_eq!(z, "2026-11-23T14:19:05.123+01:00 WARN abgewiesen status=400 wer=cl");
    }

    #[test]
    fn werte_werden_nach_der_tabelle_escaped() {
        for (eingabe, erwartet) in [
            ("a", "a"),
            ("a b", "\"a b\""),
            ("a\"b", "\"a\\\"b\""),
            ("a\\b", "\"a\\\\b\""),
            ("a\nb", "\"a\\nb\""),
            ("a\rb", "\"a\\u{d}b\""),
            ("a\tb", "\"a\\u{9}b\""),
            ("a\u{1b}b", "\"a\\u{1b}b\""),
        ] {
            assert_eq!(im_format(eingabe), erwartet, "{eingabe:?}");
        }
    }

    // AK 12: Kürzen, U auch für Kopfwerte
    #[test]
    fn werte_werden_auf_die_grenze_gekuerzt() {
        let lang: String = "a".repeat(250);
        let gekuerzt = im_format(&lang);
        assert_eq!(gekuerzt.chars().count(), 201, "{gekuerzt}");
        assert_eq!(&gekuerzt[..200], "a".repeat(200));
        assert!(gekuerzt.ends_with('…'));
        assert_eq!(kuerzen(&"a".repeat(40), KOPF_HOECHSTENS), format!("{}…", "a".repeat(32)));
        assert_eq!(kuerzen("cl", KOPF_HOECHSTENS), "cl");
    }

    // AK 19 (U): Stufen lesen, unbekannt ⇒ None
    #[test]
    fn stufen_werden_gelesen_und_unbekanntes_abgewiesen() {
        for (text, stufe) in [("debug", Stufe::Debug), ("INFO", Stufe::Info), (" warn ", Stufe::Warn), ("error", Stufe::Error)] {
            assert_eq!(Stufe::lesen(text), Some(stufe), "{text}");
        }
        for text in ["laut", "", "warning", "exception", "info2"] {
            assert_eq!(Stufe::lesen(text), None, "{text}");
        }
    }

    // AK 18 (U): die Stufe filtert
    #[test]
    fn die_stufe_filtert_zeilen() {
        let (warn, sammler) = Protokoll::sammler_mit_stufe(Stufe::Warn);
        warn.schreiben(Stufe::Info, Ereignis::Gestartet, &[]);
        warn.schreiben(Stufe::Warn, Ereignis::Abgewiesen, &[]);
        warn.schreiben(Stufe::Error, Ereignis::Fehlgeschlagen, &[]);
        warn.schreiben(Stufe::Exception, Ereignis::Panik, &[]);
        let zeilen = sammler.lock().unwrap();
        assert_eq!(zeilen.iter().filter(|z| z.contains(" INFO ")).count(), 0);
        assert_eq!(zeilen.iter().filter(|z| z.contains(" WARN ")).count(), 1);
        assert_eq!(zeilen.iter().filter(|z| z.contains(" ERROR ")).count(), 1);
        assert_eq!(zeilen.iter().filter(|z| z.contains(" EXCEPTION ")).count(), 1, "Exception bleibt bei Stufe error");
    }
}
