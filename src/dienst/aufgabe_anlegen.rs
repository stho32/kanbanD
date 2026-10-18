use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::{Art, Aufgabe, Person};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct NeueAufgabe {
    pub titel: String,
    pub board: Option<String>,
    pub spalte: Option<String>,
}

impl Kanban {
    /// Legt die Aufgabendatei an und hängt sie, wenn verlangt, unten an eine Spalte — ein Commit.
    pub fn aufgabe_anlegen(&self, wer: &Person, neu: &NeueAufgabe) -> Result<Aufgabe, Fehler> {
        let titel = neu.titel.trim();
        if titel.is_empty() {
            return Err(Fehler::Ungueltig("Die Aufgabe braucht einen Titel".into()));
        }
        let _sperre = self.gesperrt();
        let nummer = self.ordner().naechste_nummer()?;
        let mut a = Aufgabe::neu(nummer, aufgabe::dateiname(nummer, titel), titel.to_string());
        if wer.art == Art::Mensch {
            a.zustaendige.push(wer.kuerzel.clone());
        }
        let mut dateien = vec![(format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(&a))];
        let mut nachricht = format!("#{nummer} „{titel}“ angelegt");
        if let Some(slug) = &neu.board {
            let mut b = self.ordner().board(slug)?;
            let spaltenname = match &neu.spalte {
                Some(s) => s.clone(),
                None => b.spalten.first().map(|s| s.name.clone()).ok_or_else(|| Fehler::Ungueltig(format!("Board „{}“ hat keine Spalte", b.titel)))?,
            };
            let spalte = b.spalte_mut(&spaltenname).ok_or_else(|| Fehler::Ungueltig(format!("Spalte „{spaltenname}“ gibt es auf „{slug}“ nicht")))?;
            spalte.aufgaben.push(nummer);
            nachricht.push_str(&format!(" in „{spaltenname}“ ({})", b.titel));
            dateien.push((board_pfad(&b.slug), self.board_text(&b, Some(&a))?));
        }
        self.aktion(wer, &nachricht, &dateien)?;
        Ok(a)
    }
}
