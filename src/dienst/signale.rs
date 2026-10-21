//! Signale an einer Aufgabe setzen und zurücknehmen (R00076).

use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Person, signal_unbekannt};

impl Kanban {
    /// Setzt (`an`) oder nimmt ein Signal zurück; nichts zu tun heißt kein Commit. Setzen geht nur mit einem in `kanbanD.md`
    /// eingerichteten Signal, zurücknehmen auch mit einem, das dort nicht mehr steht.
    pub fn signal_schalten(&self, wer: &Person, nummer: u32, schluessel: &str, an: bool) -> Result<Aufgabe, Fehler> {
        let e = self.ordner().einstellungen()?.unwrap_or_default();
        let signal = e.signal(schluessel);
        if an && signal.is_none() {
            return Err(Fehler::Ungueltig(signal_unbekannt(schluessel)));
        }
        let name = signal.map_or(schluessel, |s| s.bezeichnung.as_str()).to_string();
        self.aufgabe_schreiben(wer, nummer, |a| {
            let hat = a.signale.iter().any(|s| s == schluessel);
            if hat == an {
                return Ok(None);
            }
            if an {
                a.signale.push(schluessel.to_string());
            } else {
                a.signale.retain(|s| s != schluessel);
            }
            Ok(Some(format!("#{nummer} Signal „{name}“ {}", if an { "gesetzt" } else { "zurückgenommen" })))
        })
    }
}
