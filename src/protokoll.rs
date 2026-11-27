//! Das Protokoll je Instanz (ADR-0001 N1, R00258): Zeilenformat, Stufen und Senken.
//!
//! Kein globaler Zustand: jede Instanz hat ihren eigenen `Protokoll`-Wert (N1.7 Regel 1). Die Senke ist ein
//! Provider — Datei und stderr im Betrieb, ein Sammler im Test. Geschrieben wird synchron, bevor die Antwort den
//! Server verlässt (N1.7 Regel 2), deshalb braucht kein Test zu warten. Die Datei-Senke mit Rotation folgt in B1375.

use crate::uhr::{Ortsuhr, Uhr};
use chrono::{DateTime, FixedOffset, NaiveDate};
use std::io::Write as _;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Der Name der laufenden Protokolldatei; rotierte tragen das Datum dahinter (N1.2 Regel 2).
pub const DATEINAME: &str = "kanbanD.log";

/// So lange bleiben rotierte Dateien liegen (N1.2 Regel 2, R00258 AK 16).
pub const AUFBEWAHRUNG_TAGE: i64 = 14;

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

/// Wohin die Zeilen gehen.
enum Senke {
    /// sammelt nur im Speicher (Test)
    Sammler(Sammler),
    /// Datei und stderr (Betrieb, N1.2 Regel 1)
    Betrieb(Mutex<Dateisenke>),
    /// nichts (`Kanban::neu` in Tests, die kein Protokoll brauchen)
    Stumm,
}

/// Das Protokoll einer Instanz: Stufe, Senke und Uhr. Klonbar — alle Klone teilen die Senke.
#[derive(Clone)]
pub struct Protokoll {
    stufe: Stufe,
    senke: Arc<Senke>,
    uhr: Arc<dyn Uhr>,
}

impl Protokoll {
    /// Ein Protokoll ohne Ausgabe; für Werte, die nur der Vollständigkeit wegen eines tragen.
    pub fn stumm() -> Protokoll {
        Protokoll { stufe: Stufe::Info, senke: Arc::new(Senke::Stumm), uhr: Arc::new(Ortsuhr) }
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
        (Protokoll { stufe, senke: Arc::new(Senke::Sammler(sammler.clone())), uhr }, sammler)
    }

    /// Der Betriebsfall: Datei im `log_ordner` und stderr (N1.2 Regel 1). Der Ordner entsteht beim ersten Schreiben.
    pub fn betrieb(stufe: Stufe, log_ordner: impl Into<PathBuf>) -> Protokoll {
        Protokoll::betrieb_mit_uhr(stufe, log_ordner, Arc::new(Ortsuhr))
    }

    /// Wie [`Protokoll::betrieb`], mit fester Uhr (Test, N1.7 Regel 5).
    pub fn betrieb_mit_uhr(stufe: Stufe, log_ordner: impl Into<PathBuf>, uhr: Arc<dyn Uhr>) -> Protokoll {
        let senke = Dateisenke::neu(log_ordner.into());
        Protokoll { stufe, senke: Arc::new(Senke::Betrieb(Mutex::new(senke))), uhr }
    }

    pub fn stufe(&self) -> Stufe {
        self.stufe
    }

    pub fn uhr(&self) -> &Arc<dyn Uhr> {
        &self.uhr
    }

    /// Der Pfad der laufenden Datei, wenn es eine Datei-Senke ist (FA 6, `log=`).
    pub fn log_pfad(&self) -> Option<PathBuf> {
        match &*self.senke {
            Senke::Betrieb(s) => Some(s.lock().unwrap_or_else(|e| e.into_inner()).pfad.clone()),
            _ => None,
        }
    }

    /// Schreibt eine Zeile, wenn die Stufe sie zulässt (N1.3). Ein Fehler der Datei-Senke stoppt nie (N1.2 Regel 3).
    pub fn schreiben(&self, stufe: Stufe, ereignis: Ereignis, felder: &[(&str, String)]) {
        if stufe < self.stufe {
            return;
        }
        let text = zeile(self.uhr.jetzt(), stufe, ereignis, felder);
        match &*self.senke {
            Senke::Sammler(sammler) => sammler.lock().unwrap_or_else(|e| e.into_inner()).push(text),
            Senke::Betrieb(senke) => {
                // stderr läuft weiter, auch wenn die Datei ruht (N1.2 Regel 3)
                eprintln!("{text}");
                senke.lock().unwrap_or_else(|e| e.into_inner()).schreiben(self.uhr.heute(), &text);
            }
            Senke::Stumm => {}
        }
    }

    /// Setzt den Panik-Hook dieser Instanz (N1.2 Regel 4); nur `main` ruft ihn auf.
    pub fn panik_hook_installieren(&self) {
        panik_hook(self.clone());
    }
}

/// Setzt den Panik-Hook, der genau eine `EXCEPTION Panik`-Zeile mit dem Ort schreibt (N1.2 Regel 4, AK 21).
/// Der Text der Panik steht nie darin (er kann Inhalt tragen).
pub fn panik_hook(protokoll: Protokoll) {
    let vorher = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let ort = info.location().map(|l| format!("{}:{}", l.file(), l.line())).unwrap_or_else(|| "-".to_string());
        protokoll.schreiben(Stufe::Exception, Ereignis::Panik, &[("ort", ort)]);
        vorher(info);
    }));
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

/// Die Datei-Senke: Ziel, tägliche Rotation und Aufbewahrung. Ruht nach einem Fehler bis zur nächsten Rotation.
struct Dateisenke {
    ordner: PathBuf,
    pfad: PathBuf,
    datei: Option<std::fs::File>,
    tag: Option<NaiveDate>,
    ruht: bool,
}

impl Dateisenke {
    fn neu(ordner: PathBuf) -> Dateisenke {
        Dateisenke { pfad: ordner.join(DATEINAME), ordner, datei: None, tag: None, ruht: false }
    }

    fn schreiben(&mut self, heute: NaiveDate, text: &str) {
        if self.ruht {
            return;
        }
        if self.tag != Some(heute) {
            if let Err(e) = self.wechseln(heute) {
                eprintln!("Protokoll: Log-Ordner {} ist nicht schreibbar ({e}) — bis zur nächsten Rotation ruht die Datei-Senke", self.ordner.display());
                self.ruht = true;
                return;
            }
        }
        let ergebnis = match self.datei.as_mut() {
            Some(datei) => datei.write_all(text.as_bytes()).and_then(|()| datei.write_all(b"\n")).and_then(|()| datei.flush()),
            None => return,
        };
        if let Err(e) = ergebnis {
            eprintln!("Protokoll: Log-Ordner {} ist nicht schreibbar ({e}) — bis zur nächsten Rotation ruht die Datei-Senke", self.ordner.display());
            self.ruht = true;
        }
    }

    /// Ein neuer Tag: die alte Datei bekommt das Datum ihres letzten Tages, alte rotierte werden gelöscht,
    /// `kanbanD.log` wird neu geöffnet (N1.2 Regel 2).
    fn wechseln(&mut self, heute: NaiveDate) -> std::io::Result<()> {
        let alt = match self.tag.or_else(|| self.vorhandenes_datum()) {
            Some(alt) if alt != heute => Some(alt),
            _ => None,
        };
        if let Some(alt) = alt {
            self.datei = None;
            std::fs::rename(&self.pfad, self.ordner.join(format!("{DATEINAME}.{alt}")))?;
        }
        std::fs::create_dir_all(&self.ordner)?;
        self.aufraeumen(heute);
        self.datei = Some(std::fs::OpenOptions::new().create(true).append(true).open(&self.pfad)?);
        self.tag = Some(heute);
        Ok(())
    }

    /// Das Datum, an dem die vorhandene `kanbanD.log` zuletzt geschrieben wurde — beim Start statt der Rotation.
    fn vorhandenes_datum(&self) -> Option<NaiveDate> {
        let geaendert = std::fs::metadata(&self.pfad).ok()?.modified().ok()?;
        Some(DateTime::<chrono::Local>::from(geaendert).date_naive())
    }

    /// Löscht `kanbanD.log.<Datum>`, deren Datum mehr als [`AUFBEWAHRUNG_TAGE`] Tage zurückliegt; andere Dateien nie.
    fn aufraeumen(&self, heute: NaiveDate) {
        let Ok(eintraege) = std::fs::read_dir(&self.ordner) else { return };
        for eintrag in eintraege.flatten() {
            let name = eintrag.file_name();
            let Some(name) = name.to_str() else { continue };
            let Some(datum) = name.strip_prefix(&format!("{DATEINAME}.")).and_then(|rest| NaiveDate::parse_from_str(rest, "%Y-%m-%d").ok()) else { continue };
            if (heute - datum).num_days() > AUFBEWAHRUNG_TAGE {
                let _ = std::fs::remove_file(eintrag.path());
            }
        }
    }
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

    // AK 15/16: Rotation und Aufbewahrung mit fester Uhr
    #[test]
    fn rotation_legt_die_alte_datei_ab_und_haelt_vierzehn_tage() {
        let tmp = tempfile::tempdir().unwrap();
        let ordner = tmp.path().join("log");
        std::fs::create_dir_all(&ordner).unwrap();
        std::fs::write(ordner.join("kanbanD.log.2026-11-12"), "alt\n").unwrap();
        std::fs::write(ordner.join("kanbanD.log.2026-11-13"), "gerade noch\n").unwrap();
        std::fs::write(ordner.join("x.txt"), "fremd\n").unwrap();
        let uhr = Arc::new(FesteUhr::aus_rfc3339("2026-11-26T09:00:00+01:00"));
        let protokoll = Protokoll::betrieb_mit_uhr(Stufe::Info, &ordner, uhr.clone());
        protokoll.schreiben(Stufe::Info, Ereignis::Gestartet, &[]);
        assert!(ordner.join("kanbanD.log").exists());
        uhr.stellen(FesteUhr::aus_rfc3339("2026-11-27T09:00:00+01:00").jetzt());
        protokoll.schreiben(Stufe::Info, Ereignis::Commit, &[]);
        let alt = std::fs::read_to_string(ordner.join("kanbanD.log.2026-11-26")).unwrap();
        assert!(alt.contains(" INFO gestartet") && alt.contains("2026-11-26T09:00"), "{alt}");
        let neu = std::fs::read_to_string(ordner.join("kanbanD.log")).unwrap();
        assert!(neu.contains(" INFO commit") && !neu.contains("gestartet"), "{neu}");
        assert!(neu.contains("2026-11-27T09:00"), "{neu}");
        assert!(!ordner.join("kanbanD.log.2026-11-12").exists(), "vor 15 Tagen gelöscht");
        assert!(ordner.join("kanbanD.log.2026-11-13").exists(), "vor 14 Tagen bleibt");
        assert!(ordner.join("x.txt").exists(), "fremde Datei bleibt");
    }

    /// AK 16: die Grenze sitzt genau zwischen „vor 15 Tagen“ (löschen) und „vor 14 Tagen“ (behalten) —
    /// tötet die Mutanten `>=` statt `>` und „15 statt 14“.
    #[test]
    fn aufbewahrung_grenzt_genau_bei_vierzehn_tagen() {
        let tmp = tempfile::tempdir().unwrap();
        let ordner = tmp.path().join("log");
        std::fs::create_dir_all(&ordner).unwrap();
        assert_eq!(AUFBEWAHRUNG_TAGE, 14);
        std::fs::write(ordner.join("kanbanD.log.2026-11-12"), "alt\n").unwrap();
        std::fs::write(ordner.join("kanbanD.log.2026-11-13"), "gerade noch\n").unwrap();
        // Start am 27.: Aufräumen läuft beim ersten Schreiben, die Uhr steht fest
        let protokoll = Protokoll::betrieb_mit_uhr(Stufe::Info, &ordner, Arc::new(FesteUhr::aus_rfc3339("2026-11-27T09:00:00+01:00")));
        protokoll.schreiben(Stufe::Info, Ereignis::Gestartet, &[("ordner", "/b".into())]);
        assert!(!ordner.join("kanbanD.log.2026-11-12").exists(), "27 − 12 = 15 Tage → weg");
        assert!(ordner.join("kanbanD.log.2026-11-13").exists(), "27 − 13 = 14 Tage → bleibt");
    }

    // AK 21: der Panik-Hook schreibt genau eine Zeile mit dem Ort, ohne den Text der Panik
    #[test]
    fn der_panik_hook_schreibt_ort_ohne_text() {
        let (protokoll, sammler) = Protokoll::sammler();
        let stumm = std::panic::take_hook();
        std::panic::set_hook(Box::new(|_| {}));
        panik_hook(protokoll);
        let _ = std::panic::catch_unwind(|| panic!("GEHEIM-PANIK-239"));
        std::panic::set_hook(stumm);
        let zeilen = sammler.lock().unwrap();
        assert_eq!(zeilen.len(), 1, "{zeilen:?}");
        assert!(zeilen[0].contains(" EXCEPTION Panik "), "{}", zeilen[0]);
        assert!(zeilen[0].contains("ort="), "{}", zeilen[0]);
        assert!(!zeilen[0].contains("GEHEIM-PANIK-239"), "{}", zeilen[0]);
    }

    // AK 17: ein nicht schreibbarer Log-Ordner stoppt nichts und nennt den Ordner
    #[test]
    fn ein_nicht_schreibbarer_ordner_stoppt_das_protokoll_nicht() {
        use std::os::unix::fs::PermissionsExt;
        let tmp = tempfile::tempdir().unwrap();
        let ordner = tmp.path().join("log");
        std::fs::create_dir_all(&ordner).unwrap();
        let mut rechte = std::fs::metadata(&ordner).unwrap().permissions();
        rechte.set_mode(0o555);
        std::fs::set_permissions(&ordner, rechte).unwrap();
        let protokoll = Protokoll::betrieb_mit_uhr(Stufe::Info, &ordner, Arc::new(FesteUhr::aus_rfc3339("2026-11-27T09:00:00+01:00")));
        protokoll.schreiben(Stufe::Info, Ereignis::Gestartet, &[]);
        protokoll.schreiben(Stufe::Warn, Ereignis::Abgewiesen, &[]);
        assert!(!ordner.join("kanbanD.log").exists(), "kein Schreiben möglich");
        let mut rechte = std::fs::metadata(&ordner).unwrap().permissions();
        rechte.set_mode(0o755);
        std::fs::set_permissions(&ordner, rechte).unwrap();
    }
}
