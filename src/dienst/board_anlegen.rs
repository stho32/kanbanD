use super::Kanban;
use super::einrichten::{boardname_pruefen, spalten_pruefen};
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::board;
use crate::modell::{Board, Person, Spalte, slug};
use serde::Deserialize;

pub const STANDARDSPALTEN: [&str; 3] = ["Zu erledigen", "In Arbeit", "Erledigt"];

#[derive(Debug, Clone, Deserialize)]
pub struct NeuesBoard {
    pub titel: String,
    pub spalten: Option<Vec<String>>,
}

impl Kanban {
    pub fn board_anlegen(&self, wer: &Person, neu: &NeuesBoard) -> Result<String, Fehler> {
        boardname_pruefen(&neu.titel)?;
        let spalten = neu.spalten.clone().unwrap_or_else(|| STANDARDSPALTEN.iter().map(|s| s.to_string()).collect());
        spalten_pruefen(&spalten)?;
        let _sperre = self.gesperrt();
        let b = Board {
            slug: slug(&neu.titel),
            titel: neu.titel.trim().into(),
            spalten: spalten.iter().map(|s| Spalte { name: s.trim().into(), grenze: None, aufgaben: vec![], phase: None, pruefungen: vec![] }).collect(),
            termine: vec![],
            anwendungen: None,
        };
        if self.ordner().existiert(&board_pfad(&b.slug)) {
            return Err(Fehler::Konflikt(format!("Es gibt schon ein Board unter boards/{}.md", b.slug)));
        }
        self.aktion(wer, &format!("Board „{}“ angelegt", b.titel), &[(board_pfad(&b.slug), board::schreiben(&b, |_| None))])?;
        Ok(b.slug)
    }
}
