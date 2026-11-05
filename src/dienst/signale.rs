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
            if !signal_geschaltet(a, schluessel, an) {
                return Ok(None);
            }
            Ok(Some(format!("#{nummer} Signal „{name}“ {}", if an { "gesetzt" } else { "zurückgenommen" })))
        })
    }
}

/// Signal-Kern (ADR-0005): ohne Sperre und ohne Commit; `schluessel` ist schon geprüft. Liefert, ob sich etwas geändert hat.
pub(super) fn signal_geschaltet(a: &mut Aufgabe, schluessel: &str, an: bool) -> bool {
    let hat = a.signale.iter().any(|s| s == schluessel);
    if hat == an {
        return false;
    }
    if an {
        a.signale.push(schluessel.to_string());
    } else {
        a.signale.retain(|s| s != schluessel);
    }
    true
}

#[cfg(test)]
mod tests {
    use super::signal_geschaltet;
    use crate::modell::Aufgabe;

    // R00099 B0335: Signal-Kern — setzt hinten an, nimmt zurück, meldet „nichts zu tun“
    #[test]
    fn signal_kern() {
        let mut a = Aufgabe::neu(8, "0008-x.md".into(), "x".into());
        a.signale.push("mail".into());
        assert!(signal_geschaltet(&mut a, "behoben", true));
        assert_eq!(a.signale, ["mail", "behoben"]);
        assert!(!signal_geschaltet(&mut a, "behoben", true), "schon gesetzt");
        assert_eq!(a.signale, ["mail", "behoben"]);
        assert!(signal_geschaltet(&mut a, "mail", false));
        assert_eq!(a.signale, ["behoben"]);
        assert!(!signal_geschaltet(&mut a, "mail", false), "nicht gesetzt");
        assert_eq!(a.signale, ["behoben"]);
    }
}
