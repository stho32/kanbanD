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

#[derive(Debug, Clone, Deserialize)]
pub struct NeueAufgaben {
    pub titel: Vec<String>,
    pub board: Option<String>,
    pub spalte: Option<String>,
}

impl Kanban {
    /// Legt die Aufgabendatei an und hängt sie, wenn verlangt, unten an eine Spalte — ein Commit.
    pub fn aufgabe_anlegen(&self, wer: &Person, neu: &NeueAufgabe) -> Result<Aufgabe, Fehler> {
        let mehrere = NeueAufgaben { titel: vec![neu.titel.clone()], board: neu.board.clone(), spalte: neu.spalte.clone() };
        Ok(self.aufgaben_anlegen(wer, &mehrere)?.remove(0))
    }

    /// Mehrere Aufgaben mit fortlaufenden Nummern in der Reihenfolge der Liste — ein Commit für alle.
    pub fn aufgaben_anlegen(&self, wer: &Person, neu: &NeueAufgaben) -> Result<Vec<Aufgabe>, Fehler> {
        let titel: Vec<&str> = neu.titel.iter().map(|t| t.trim()).collect();
        if titel.is_empty() || titel.iter().any(|t| t.is_empty()) {
            return Err(Fehler::Ungueltig("Jede Aufgabe braucht einen Titel".into()));
        }
        let _sperre = self.gesperrt();
        let erste = self.ordner().naechste_nummer()?;
        let aufgaben: Vec<Aufgabe> = titel
            .iter()
            .enumerate()
            .map(|(i, t)| {
                let nummer = erste + i as u32;
                let mut a = Aufgabe::neu(nummer, aufgabe::dateiname(nummer, t), t.to_string());
                if wer.art == Art::Mensch {
                    a.zustaendige.push(wer.kuerzel.clone());
                }
                a
            })
            .collect();
        let mut dateien: Vec<(String, String)> = aufgaben.iter().map(|a| (format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(a))).collect();
        let mut nachricht = match aufgaben.as_slice() {
            [a] => format!("#{} „{}“ angelegt", a.nummer, a.titel),
            alle => format!("#{}–#{} angelegt ({} Aufgaben)", erste, erste + alle.len() as u32 - 1, alle.len()),
        };
        if let Some(slug) = &neu.board {
            let mut b = self.ordner().board(slug)?;
            let spaltenname = match &neu.spalte {
                Some(s) => s.clone(),
                None => b.spalten.first().map(|s| s.name.clone()).ok_or_else(|| Fehler::Ungueltig(format!("Board „{}“ hat keine Spalte", b.titel)))?,
            };
            let spalte = b.spalte_mut(&spaltenname).ok_or_else(|| Fehler::Ungueltig(format!("Spalte „{spaltenname}“ gibt es auf „{slug}“ nicht")))?;
            spalte.aufgaben.extend(aufgaben.iter().map(|a| a.nummer));
            nachricht.push_str(&format!(" in „{spaltenname}“ ({})", b.titel));
            let (vorhanden, _) = self.ordner().aufgaben()?;
            let text = crate::format::board::schreiben(&b, |nr| aufgaben.iter().chain(vorhanden.iter()).find(|a| a.nummer == nr).map(|a| a.datei.clone()));
            dateien.push((board_pfad(&b.slug), text));
        }
        self.aktion(wer, &nachricht, &dateien)?;
        Ok(aufgaben)
    }
}
