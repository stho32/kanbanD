//! Das Protokoll je Instanz (ADR-0001 N1, R00258) — Grundgerüst: Stufe, Ereignis, Senke als Provider.
//!
//! Kein globaler Zustand: jede Instanz hat ihren eigenen `Protokoll`-Wert (N1.7 Regel 1). Die Senke ist ein
//! Provider — Datei und stderr im Betrieb, ein Sammler im Test. Das Zeilenformat und die Datei-Senke folgen in
//! B1374/B1375; bis dahin sammelt die Testsenke, und der Betrieb schreibt nichts.

use crate::uhr::{Ortsuhr, Uhr};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

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

    /// Schreibt eine Zeile, wenn die Stufe sie zulässt (N1.3) — noch ohne Format und Datei (B1374/B1375).
    pub fn schreiben(&self, stufe: Stufe, _ereignis: Ereignis, _felder: &[(&str, String)]) {
        let _ = stufe;
    }
}
