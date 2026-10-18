use super::Kanban;
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::{Aufgabe, Aufgabenaenderung, Person};

impl Kanban {
    /// Liest die Aufgabe, wendet `veraendern` an und committet, wenn sich etwas geändert hat.
    /// `veraendern` liefert die Commit-Nachricht oder `None` für „nichts geändert“.
    pub(crate) fn aufgabe_schreiben(&self, wer: &Person, nummer: u32, veraendern: impl FnOnce(&mut Aufgabe) -> Result<Option<String>, Fehler>) -> Result<Aufgabe, Fehler> {
        let _sperre = self.gesperrt();
        let mut a = self.ordner().aufgabe(nummer)?;
        if let Some(nachricht) = veraendern(&mut a)? {
            self.aktion(wer, &nachricht, &[(format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(&a))])?;
        }
        Ok(a)
    }

    pub fn aufgabe_aendern(&self, wer: &Person, nummer: u32, aenderung: &Aufgabenaenderung) -> Result<Aufgabe, Fehler> {
        let e = self.ordner().einstellungen()?.unwrap_or_default();
        self.aufgabe_schreiben(wer, nummer, |a| {
            let felder = a.aendern(aenderung, &e).map_err(Fehler::Ungueltig)?;
            Ok((!felder.is_empty()).then(|| format!("#{nummer} geändert: {}", felder.join(", "))))
        })
    }
}
