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

    /// Mehrere Aufgaben in einem Commit (R00065); ein ungültiges Feld bricht ab, bevor etwas geschrieben ist.
    pub fn mehrere_aendern(&self, wer: &Person, aenderungen: &[(u32, Aufgabenaenderung)]) -> Result<Vec<Aufgabe>, Fehler> {
        if aenderungen.is_empty() {
            return Err(Fehler::Ungueltig("Keine Aufgabe angegeben".into()));
        }
        let e = self.ordner().einstellungen()?.unwrap_or_default();
        let _sperre = self.gesperrt();
        let mut ergebnis = vec![];
        let mut geaendert = vec![];
        let mut felder_alle: Vec<&str> = vec![];
        let mut dateien = vec![];
        for (nummer, aenderung) in aenderungen {
            let mut a = self.ordner().aufgabe(*nummer)?;
            let felder = a.aendern(aenderung, &e).map_err(|f| Fehler::Ungueltig(format!("#{nummer}: {f}")))?;
            if !felder.is_empty() {
                geaendert.push(format!("#{nummer}"));
                for f in felder {
                    if !felder_alle.contains(&f) {
                        felder_alle.push(f);
                    }
                }
                dateien.push((format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(&a)));
            }
            ergebnis.push(a);
        }
        if !dateien.is_empty() {
            let anzahl = match geaendert.len() {
                1 => String::new(),
                n => format!(" ({n} Aufgaben)"),
            };
            self.aktion(wer, &format!("{} geändert: {}{anzahl}", geaendert.join(", "), felder_alle.join(", ")), &dateien)?;
        }
        Ok(ergebnis)
    }
}
