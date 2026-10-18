use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Kommentar, Person};
use crate::uhr;

impl Kanban {
    pub fn kommentieren(&self, wer: &Person, nr: u32, text: &str) -> Result<Aufgabe, Fehler> {
        let text = text.trim().replace("\r\n", "\n");
        if text.is_empty() {
            return Err(Fehler::Ungueltig("Der Kommentar ist leer".into()));
        }
        let kurz: String = text.replace('\n', " ").chars().take(50).collect();
        self.aufgabe_schreiben(wer, nr, |a| {
            a.kommentare.push(Kommentar { wer: wer.kuerzel.clone(), zeitpunkt: uhr::jetzt(), text: text.clone() });
            Ok(Some(format!("#{nr} kommentiert: {kurz}")))
        })
    }
}
