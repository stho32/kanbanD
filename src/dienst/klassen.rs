use super::einstellungen::klassen_pruefen;
use super::{Kanban, Schritt};
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::{Klasse, Person};

impl Kanban {
    /// Setzt den eigenen Klassensatz des Boards (`classes:` der Board-Datei, R00195, ADR-0031 Regel 7): `None` kehrt zur
    /// Vorgabe des Ordners zurück, `Some([])` heißt „dieses Board führt keine Klassen“. Geprüft wird wie für die
    /// Klassen des Ordners; keine Aufgabe wird angefasst. Ungültig → 400, ohne Änderung kein Commit.
    pub fn board_klassen_setzen(&self, wer: &Person, slug: &str, neu: Option<Vec<Klasse>>) -> Result<bool, Fehler> {
        if let Some(klassen) = &neu {
            klassen_pruefen(klassen)?;
        }
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        if b.klassen == neu {
            return Ok(false);
        }
        let satz = match &neu {
            None => "Vorgabe des Ordners".to_string(),
            Some(klassen) if klassen.is_empty() => "keine".to_string(),
            Some(klassen) => klassen.iter().map(|k| k.schluessel.as_str()).collect::<Vec<_>>().join(", "),
        };
        let text = format!("Klassen von „{}“: {}", crate::nachricht::wert(&b.titel), crate::nachricht::wert(&satz));
        b.klassen = neu;
        self.aktion(wer, &text, &[Schritt::schreiben(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok(true)
    }
}
