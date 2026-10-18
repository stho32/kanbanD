//! Start der Anwendung: Aufruf lesen, Ordner vorbereiten, Server binden, Browser öffnen.

pub mod browser;
pub mod ordner;
pub mod server;

use std::path::PathBuf;

pub const AUFRUF: &str = "Aufruf: kanbanD [<ordner>] [--port <n>] [--host <adresse>] [--kein-browser]";
pub const STANDARD_PORT: u16 = 7420;

/// Was der Aufruf verlangt: welcher Ordner, wo gelauscht wird, ob ein Browser aufgeht.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Startauftrag {
    pub ordner: PathBuf,
    pub host: String,
    pub port: u16,
    pub browser_oeffnen: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Aufruffehler {
    HilfeGewuenscht,
    Unbekannt(String),
    WertFehlt(String),
    PortUngueltig(String),
}

impl std::fmt::Display for Aufruffehler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Aufruffehler::HilfeGewuenscht => write!(f, "{AUFRUF}"),
            Aufruffehler::Unbekannt(a) => write!(f, "{AUFRUF}\nUnbekanntes Argument: {a}"),
            Aufruffehler::WertFehlt(a) => write!(f, "{AUFRUF}\n{a} braucht einen Wert"),
            Aufruffehler::PortUngueltig(w) => write!(f, "{AUFRUF}\nKein gültiger Port: {w}"),
        }
    }
}

impl Startauftrag {
    /// Liest die Argumente ohne den Programmnamen. Ohne Ordner gilt das aktuelle Verzeichnis.
    pub fn aus_argumenten<I: IntoIterator<Item = String>>(args: I) -> Result<Startauftrag, Aufruffehler> {
        let mut auftrag = Startauftrag {
            ordner: PathBuf::from("."),
            host: "0.0.0.0".into(),
            port: STANDARD_PORT,
            browser_oeffnen: true,
        };
        let mut ordner_gesetzt = false;
        let mut args = args.into_iter();
        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--hilfe" | "-h" | "--help" => return Err(Aufruffehler::HilfeGewuenscht),
                "--kein-browser" => auftrag.browser_oeffnen = false,
                "--host" => auftrag.host = args.next().ok_or(Aufruffehler::WertFehlt(arg))?,
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
        for f in [Aufruffehler::HilfeGewuenscht, Aufruffehler::Unbekannt("x".into()), Aufruffehler::WertFehlt("--port".into()), Aufruffehler::PortUngueltig("y".into())] {
            assert!(f.to_string().starts_with("Aufruf: kanbanD"));
        }
    }
}
