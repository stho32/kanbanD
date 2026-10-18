use super::Kanban;
use super::herkunft::absolut;
use crate::modell::Board;
use crate::phasen::{Phasenfolge, gebundene_anwendungen};
use serde::Serialize;

/// Die Phasen eines Boards: die Folge der ersten gebundenen Anwendung mit erreichbarer WBS und was am Board nicht stimmt.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Phasenstand {
    /// Kürzel der Anwendung, deren Folge gilt
    pub anwendung: String,
    pub folge: Phasenfolge,
    pub hinweise: Vec<String>,
}

impl Kanban {
    /// `None`, wenn das Board an keine Anwendung mit erreichbarer WBS gebunden ist — dann ist es reines Kanban.
    /// Ohne Phasen-Datei neben der WBS gilt das Standardmodell.
    pub fn phasenstand(&self, board: &Board) -> Option<Phasenstand> {
        let e = self.ordner().einstellungen().ok().flatten().unwrap_or_default();
        let wurzel = self.ordner().wurzel();
        let mut folgen = gebundene_anwendungen(board, &e.quellen.anwendungen).into_iter().filter_map(|a| {
            let wbs = absolut(wurzel, &a.wbs);
            wbs.is_file().then(|| (a, std::fs::read_to_string(Phasenfolge::pfad_neben(&wbs)).map(|t| Phasenfolge::lesen(&t)).unwrap_or_else(|_| Phasenfolge::standard())))
        });
        let (erste, folge) = folgen.next()?;
        let mut hinweise: Vec<String> = folgen
            .filter(|(_, f)| f.namen() != folge.namen())
            .map(|(a, f)| format!("„{}“ hat die Phasenfolge {} — es gilt die von „{}“: {}", a.name, f.namen().join(" → "), erste.name, folge.namen().join(" → ")))
            .collect();
        hinweise.extend(folge.reihenfolge_hinweise(board));
        Some(Phasenstand { anwendung: erste.kuerzel.clone(), folge, hinweise })
    }
}
