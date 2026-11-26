use super::braucht::{Tuer, vorsatz};
use super::{Kanban, Schritt};
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::{Aufgabe, Aufgabenaenderung, Board, Einstellungen, Klassengeltung, Person};

/// Gültig ist, was ein Board der Aufgabe führt; auf keinem Board die Vorgabe des Ordners.
fn klassengeltung(boards: &[Board], nummer: u32, e: &Einstellungen) -> Klassengeltung {
    Klassengeltung::neu(boards.iter().filter(|b| b.spalte_von(nummer).is_some()), e)
}

impl Kanban {
    /// Liest die Aufgabe, wendet `veraendern` an und committet, wenn sich etwas geändert hat.
    /// `veraendern` liefert die Commit-Nachricht oder `None` für „nichts geändert“.
    pub(crate) fn aufgabe_schreiben(&self, wer: &Person, nummer: u32, veraendern: impl FnOnce(&mut Aufgabe) -> Result<Option<String>, Fehler>) -> Result<Aufgabe, Fehler> {
        let _sperre = self.gesperrt();
        let mut a = self.ordner().aufgabe(nummer)?;
        if let Some(nachricht) = veraendern(&mut a)? {
            self.aktion(wer, &nachricht, &[Schritt::schreiben(format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(&a))])?;
        }
        Ok(a)
    }

    /// Die offenen Boards des Ordners in der Reihenfolge der Boardliste — gelesen nur, wenn eine Änderung eine Klasse
    /// setzt (ADR-0031 Regel 6); sonst bleibt der Weg ohne Zugriff auf die Board-Dateien.
    fn boards_fuer_klassen<'a>(&self, aenderungen: impl IntoIterator<Item = &'a Aufgabenaenderung>) -> Result<Vec<Board>, Fehler> {
        if !aenderungen.into_iter().any(|a| matches!(&a.klasse, Some(Some(k)) if !k.trim().is_empty())) {
            return Ok(vec![]);
        }
        let (boards, _) = self.ordner().boards()?;
        Ok(boards.into_iter().filter(|b| b.archiviert.is_none()).collect())
    }

    pub fn aufgabe_aendern(&self, wer: &Person, nummer: u32, aenderung: &Aufgabenaenderung) -> Result<Aufgabe, Fehler> {
        let e = self.ordner().einstellungen()?.unwrap_or_default();
        self.aufgabe_schreiben(wer, nummer, |a| {
            let boards = self.boards_fuer_klassen(std::slice::from_ref(aenderung))?;
            let vorher = a.labels.clone();
            let felder = a.aendern(aenderung, &e, &klassengeltung(&boards, nummer, &e)).map_err(Fehler::Ungueltig)?;
            let mut tuer = Tuer::neu(self);
            tuer.pruefen(nummer, &vorher, &a.labels)?;
            if let Some((_, meldung)) = tuer.kreis() {
                return Err(Fehler::Ungueltig(meldung));
            }
            Ok((!felder.is_empty()).then(|| format!("#{nummer} geändert: {}", felder.join(", "))))
        })
    }

    /// Mehrere Aufgaben in einem Commit (R00065); ein ungültiges Feld bricht ab, bevor etwas geschrieben ist.
    pub fn mehrere_aendern(&self, wer: &Person, aenderungen: &[(u32, Aufgabenaenderung)]) -> Result<Vec<Aufgabe>, Fehler> {
        super::sammelgrenze_pruefen(aenderungen.len())?;
        if aenderungen.is_empty() {
            return Err(Fehler::Ungueltig("Keine Aufgabe angegeben".into()));
        }
        super::ohne_doppelte(aenderungen.iter().map(|(n, _)| *n))?;
        let e = self.ordner().einstellungen()?.unwrap_or_default();
        let _sperre = self.gesperrt();
        // Die Momentaufnahme entsteht **nach** `gesperrt()` und lebt nur hier (ADR-0044 E1): ein Listing für alle
        // Einträge statt eines je Eintrag, damit die Sperrdauer linear mit n wächst statt mit n × m.
        let mut verzeichnis = self.ordner().verzeichnis()?;
        let boards = self.boards_fuer_klassen(aenderungen.iter().map(|(_, a)| a))?;
        let mut ergebnis = vec![];
        let mut geaendert = vec![];
        let mut felder_alle: Vec<&str> = vec![];
        let mut dateien = vec![];
        let mut tuer = Tuer::neu(self);
        for (nummer, aenderung) in aenderungen {
            let mut a = verzeichnis.aufgabe(*nummer)?;
            let vorher = a.labels.clone();
            let felder = a.aendern(aenderung, &e, &klassengeltung(&boards, *nummer, &e)).map_err(|f| Fehler::Ungueltig(format!("#{nummer}: {f}")))?;
            tuer.pruefen(*nummer, &vorher, &a.labels).map_err(|f| vorsatz(f, &format!("#{nummer}: ")))?;
            if !felder.is_empty() {
                geaendert.push(format!("#{nummer}"));
                for f in felder {
                    if !felder_alle.contains(&f) {
                        felder_alle.push(f);
                    }
                }
                dateien.push(Schritt::schreiben(format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(&a)));
            }
            ergebnis.push(a);
        }
        // Kreisprüfung gegen den Stand nach allen Änderungen des Aufrufs (R00214), bevor etwas geschrieben ist.
        if let Some((nummer, meldung)) = tuer.kreis() {
            return Err(Fehler::Ungueltig(format!("#{nummer}: {meldung}")));
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
