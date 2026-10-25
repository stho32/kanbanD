use super::Kanban;
use super::herkunft::absolut;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::{Art, Board, Person};
use crate::phasen::{Phasenfolge, gebundene_anwendungen};
use crate::pruefungen::unbekannte;
use serde::Serialize;

/// Die Phasen eines Boards: die Folge der ersten gebundenen Anwendung mit erreichbarer WBS und was am Board nicht stimmt.
#[derive(Debug, Clone, PartialEq, Serialize, utoipa::ToSchema)]
pub struct Phasenstand {
    /// Kürzel der Anwendung, deren Folge gilt
    pub anwendung: String,
    pub folge: Phasenfolge,
    pub hinweise: Vec<String>,
}

/// Ein Board, wie `GET /api/boards/{slug}` es zeigt: die Board-Datei und, wenn es gebunden ist, seine Phasen.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct BoardMitPhasen {
    #[serde(flatten)]
    pub board: Board,
    pub phasen: Option<Phasenstand>,
    /// was am Board nicht stimmt, ohne es unlesbar zu machen (unbekannte Prüfungen in `column-checks`)
    pub hinweise: Vec<String>,
}

/// Wer committet, was kanbanD von sich aus tut (kein Mensch hat gehandelt, nur gelesen).
fn kanband_selbst() -> Person {
    Person { kuerzel: "kanbanD".into(), name: "kanbanD".into(), art: Art::Agent, aktiv: true }
}

impl Kanban {
    /// Liest das Board und gibt jeder Phase der gebundenen Anwendung eine Spalte — fehlt eine, ist das eine eigene Aktion
    /// mit einem Commit „Phasen-Spalten von „<Board>“ ergänzt: …“. Danach wird nichts umgeordnet.
    pub fn board_mit_phasen(&self, slug: &str) -> Result<BoardMitPhasen, Fehler> {
        let _sperre = self.gesperrt();
        let mut board = self.ordner().board(slug)?;
        let hinweise = unbekannte(&board);
        let Some(stand) = self.phasenstand(&board) else { return Ok(BoardMitPhasen { board, phasen: None, hinweise }) };
        let ergaenzt = stand.folge.nachtragen(&mut board);
        if ergaenzt.is_empty() {
            return Ok(BoardMitPhasen { board, phasen: Some(stand), hinweise });
        }
        self.aktion(&kanband_selbst(), &format!("Phasen-Spalten von „{}“ ergänzt: {}", board.titel, ergaenzt.join(", ")), &[(board_pfad(&board.slug), self.board_text(&board, None)?)])?;
        let phasen = self.phasenstand(&board);
        Ok(BoardMitPhasen { board, phasen, hinweise })
    }

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
