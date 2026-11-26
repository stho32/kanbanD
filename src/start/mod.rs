//! Start der Anwendung: Aufruf lesen, Ordner vorbereiten, Server binden, Browser öffnen.

pub mod browser;
pub mod ordner;
pub mod server;

use std::path::PathBuf;

pub const AUFRUF: &str = "Aufruf: kanbanD [<ordner>] [--port <n>] [--host <adresse>] [--kein-browser] [--log debug|info|warn|error] [--log-ordner <pfad>]";
pub const STANDARD_PORT: u16 = 7420;

/// Was der Aufruf verlangt: welcher Ordner, wo gelauscht wird, ob ein Browser aufgeht, welche Stufe und wohin das
/// Protokoll schreibt (ADR-0001 N1.2 Regeln 1 und 4).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Startauftrag {
    pub ordner: PathBuf,
    pub host: String,
    pub port: u16,
    pub browser_oeffnen: bool,
    /// Mindeststufe des Protokolls; Standard `INFO`.
    pub log_stufe: crate::protokoll::Stufe,
    /// Ziel des Protokolls aus `--log-ordner` bzw. `KANBAND_LOG_ORDNER` (Flag vor Variable); `None` ⇒ Pfad nach XDG.
    pub log_ordner: Option<PathBuf>,
}

/// Die Umgebungswerte, die den Start mitbestimmen — als Eingabe, damit Tests sie nicht in den Prozess setzen müssen.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Umgebung {
    pub log: Option<String>,
    pub log_ordner: Option<String>,
    pub xdg_state_home: Option<String>,
    pub home: Option<String>,
}

impl Umgebung {
    pub fn aus_prozess() -> Umgebung {
        let lesen = |name: &str| std::env::var(name).ok().filter(|w| !w.is_empty());
        Umgebung { log: lesen("KANBAND_LOG"), log_ordner: lesen("KANBAND_LOG_ORDNER"), xdg_state_home: lesen("XDG_STATE_HOME"), home: lesen("HOME") }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum Aufruffehler {
    HilfeGewuenscht,
    Unbekannt(String),
    WertFehlt(String),
    PortUngueltig(String),
    /// `--log`/`KANBAND_LOG` nennt keine bekannte Stufe (AK 19).
    StufeUngueltig(String),
}

impl std::fmt::Display for Aufruffehler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Aufruffehler::HilfeGewuenscht => write!(f, "{AUFRUF}"),
            Aufruffehler::Unbekannt(a) => write!(f, "{AUFRUF}\nUnbekanntes Argument: {a}"),
            Aufruffehler::WertFehlt(a) => write!(f, "{AUFRUF}\n{a} braucht einen Wert"),
            Aufruffehler::PortUngueltig(w) => write!(f, "{AUFRUF}\nKein gültiger Port: {w}"),
            Aufruffehler::StufeUngueltig(w) => write!(f, "{AUFRUF}\nKeine gültige Stufe: {w} — erlaubt: debug, info, warn, error"),
        }
    }
}

impl Startauftrag {
    /// Liest die Argumente ohne den Programmnamen; ohne Ordner gilt das aktuelle Verzeichnis. Umgebungsvariablen
    /// kommen aus dem Prozess (für den echten Start).
    pub fn aus_argumenten<I: IntoIterator<Item = String>>(args: I) -> Result<Startauftrag, Aufruffehler> {
        Startauftrag::aus_argumenten_mit(args, &Umgebung::aus_prozess())
    }

    /// Wie [`Startauftrag::aus_argumenten`], mit übergebener Umgebung (Test). Ein Flag geht der Variable vor (AK 14, 18).
    pub fn aus_argumenten_mit<I: IntoIterator<Item = String>>(args: I, umgebung: &Umgebung) -> Result<Startauftrag, Aufruffehler> {
        let mut auftrag = Startauftrag { ordner: PathBuf::from("."), host: "0.0.0.0".into(), port: STANDARD_PORT, browser_oeffnen: true, log_stufe: crate::protokoll::Stufe::Info, log_ordner: None };
        // Variable zuerst, das Flag überschreibt sie später
        if let Some(wert) = umgebung.log.as_deref() {
            auftrag.log_stufe = crate::protokoll::Stufe::lesen(wert).ok_or_else(|| Aufruffehler::StufeUngueltig(wert.to_string()))?;
        }
        auftrag.log_ordner = umgebung.log_ordner.as_deref().map(PathBuf::from);
        let mut ordner_gesetzt = false;
        let mut args = args.into_iter();
        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--hilfe" | "-h" | "--help" => return Err(Aufruffehler::HilfeGewuenscht),
                "--kein-browser" => auftrag.browser_oeffnen = false,
                "--host" => auftrag.host = args.next().ok_or(Aufruffehler::WertFehlt(arg))?,
                "--log" => {
                    let wert = args.next().ok_or_else(|| Aufruffehler::WertFehlt(arg.clone()))?;
                    auftrag.log_stufe = crate::protokoll::Stufe::lesen(&wert).ok_or(Aufruffehler::StufeUngueltig(wert))?;
                }
                "--log-ordner" => auftrag.log_ordner = Some(PathBuf::from(args.next().ok_or_else(|| Aufruffehler::WertFehlt(arg.clone()))?)),
                "--port" => {
                    let wert = args.next().ok_or_else(|| Aufruffehler::WertFehlt(arg.clone()))?;
                    auftrag.port = wert.parse().map_err(|_| Aufruffehler::PortUngueltig(wert))?;
                }
                _ if arg.starts_with('-') || ordner_gesetzt => return Err(Aufruffehler::Unbekannt(arg)),
                _ => {
                    auftrag.ordner = PathBuf::from(arg);
                    ordner_gesetzt = true;
                }
            }
        }
        Ok(auftrag)
    }

    /// Wohin das Protokoll schreibt (FA 2): `--log-ordner`/`KANBAND_LOG_ORDNER` sonst
    /// `$XDG_STATE_HOME/kanbanD/<ordnername>` bzw. `$HOME/.local/state/kanbanD/<ordnername>`.
    pub fn log_ordner(&self, ordner: &std::path::Path, umgebung: &Umgebung) -> PathBuf {
        if let Some(pfad) = &self.log_ordner {
            return pfad.clone();
        }
        let name = ordner.canonicalize().unwrap_or_else(|_| ordner.to_path_buf());
        let name = name.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "kanbanD".to_string());
        match umgebung.xdg_state_home.as_deref().filter(|w| !w.is_empty()) {
            Some(basis) => PathBuf::from(basis).join("kanbanD").join(name),
            None => PathBuf::from(umgebung.home.as_deref().unwrap_or("")).join(".local/state/kanbanD").join(name),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lies(a: &[&str]) -> Result<Startauftrag, Aufruffehler> {
        Startauftrag::aus_argumenten(a.iter().map(|s| s.to_string()))
    }

    #[test]
    fn ohne_argumente_gilt_aktuelles_verzeichnis_mit_standardport() {
        let a = lies(&[]).unwrap();
        assert_eq!(a.ordner, PathBuf::from("."));
        assert_eq!(a.port, 7420);
        assert_eq!(a.host, "0.0.0.0");
        assert!(a.browser_oeffnen);
    }

    #[test]
    fn ordner_port_host_und_browser_werden_gelesen() {
        let a = lies(&["/tmp/x", "--port", "8000", "--host", "127.0.0.1", "--kein-browser"]).unwrap();
        assert_eq!(a.ordner, PathBuf::from("/tmp/x"));
        assert_eq!(a.port, 8000);
        assert_eq!(a.host, "127.0.0.1");
        assert!(!a.browser_oeffnen);
    }

    #[test]
    fn unbekanntes_argument_und_zweiter_ordner_sind_fehler() {
        assert_eq!(lies(&["--gibtsnicht"]), Err(Aufruffehler::Unbekannt("--gibtsnicht".into())));
        assert_eq!(lies(&["a", "b"]), Err(Aufruffehler::Unbekannt("b".into())));
    }

    #[test]
    fn fehlender_oder_falscher_wert_wird_gemeldet() {
        assert_eq!(lies(&["--port"]), Err(Aufruffehler::WertFehlt("--port".into())));
        assert_eq!(lies(&["--host"]), Err(Aufruffehler::WertFehlt("--host".into())));
        assert_eq!(lies(&["--port", "x"]), Err(Aufruffehler::PortUngueltig("x".into())));
    }

    #[test]
    fn hilfe_und_fehlertexte_beginnen_mit_der_aufrufzeile() {
        assert_eq!(lies(&["--hilfe"]), Err(Aufruffehler::HilfeGewuenscht));
        for f in [Aufruffehler::HilfeGewuenscht, Aufruffehler::Unbekannt("x".into()), Aufruffehler::WertFehlt("--port".into()), Aufruffehler::PortUngueltig("y".into()), Aufruffehler::StufeUngueltig("laut".into())] {
            assert!(f.to_string().starts_with("Aufruf: kanbanD"));
        }
    }

    // AK 18/19: Stufen-Schalter, Flag vor Variable, unbekannte Stufe ist ein Aufruffehler
    #[test]
    fn stufe_kommt_aus_flag_oder_variable_und_flag_geht_vor() {
        use crate::protokoll::Stufe;
        let um = |log: Option<&str>| Umgebung { log: log.map(String::from), ..Umgebung::default() };
        let lies_mit = |args: &[&str], u: &Umgebung| Startauftrag::aus_argumenten_mit(args.iter().map(|s| s.to_string()), u);
        assert_eq!(lies_mit(&[], &Umgebung::default()).unwrap().log_stufe, Stufe::Info, "Standard");
        assert_eq!(lies_mit(&["--log", "warn"], &Umgebung::default()).unwrap().log_stufe, Stufe::Warn);
        assert_eq!(lies_mit(&[], &um(Some("debug"))).unwrap().log_stufe, Stufe::Debug);
        assert_eq!(lies_mit(&["--log", "error"], &um(Some("debug"))).unwrap().log_stufe, Stufe::Error, "Flag vor Variable");
        assert_eq!(lies_mit(&["--log", "laut"], &Umgebung::default()), Err(Aufruffehler::StufeUngueltig("laut".into())));
        assert_eq!(lies_mit(&[], &um(Some("laut"))), Err(Aufruffehler::StufeUngueltig("laut".into())));
        assert_eq!(lies_mit(&["--log"], &Umgebung::default()), Err(Aufruffehler::WertFehlt("--log".into())));
    }

    // AK 14: Ziel des Protokolls — Flag vor Variable, sonst XDG bzw. HOME
    #[test]
    fn log_ordner_kommt_aus_flag_variable_oder_xdg() {
        let lies_mit = |args: &[&str], u: &Umgebung| Startauftrag::aus_argumenten_mit(args.iter().map(|s| s.to_string()), u);
        let xdg = Umgebung { xdg_state_home: Some("/S".into()), log_ordner: Some("/B".into()), ..Umgebung::default() };
        assert_eq!(lies_mit(&["--log-ordner", "/A"], &xdg).unwrap().log_ordner, Some(PathBuf::from("/A")), "Flag vor Variable");
        assert_eq!(lies_mit(&[], &xdg).unwrap().log_ordner, Some(PathBuf::from("/B")), "nur Variable");
        let board = std::path::Path::new("/boards/mein-board");
        assert_eq!(lies_mit(&[], &Umgebung { xdg_state_home: Some("/S".into()), ..Umgebung::default() }).unwrap().log_ordner(board, &Umgebung { xdg_state_home: Some("/S".into()), ..Umgebung::default() }), PathBuf::from("/S/kanbanD/mein-board"));
        assert_eq!(lies_mit(&[], &Umgebung { home: Some("/H".into()), ..Umgebung::default() }).unwrap().log_ordner(board, &Umgebung { home: Some("/H".into()), ..Umgebung::default() }), PathBuf::from("/H/.local/state/kanbanD/mein-board"));
        let a = lies_mit(&["--log-ordner", "/A"], &xdg).unwrap();
        assert_eq!(a.log_ordner(board, &xdg), PathBuf::from("/A"), "Flag schlägt XDG");
    }
}
