use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::Board;
use crate::warnung::unbekannte;
use serde::Serialize;

/// Ein Board, wie `GET /api/boards/{slug}` es zeigt: die Board-Datei und was an ihr nicht stimmt, ohne sie unlesbar zu machen.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct BoardMitHinweisen {
    #[serde(flatten)]
    pub board: Board,
    /// unbekannte Eigentümer in `column-owner` (R00097, R00120)
    pub hinweise: Vec<String>,
}

impl Kanban {
    /// Liest das Board — nur lesend: kein Commit, kein Nachtragen von Spalten (ADR-0034 N4 Regel 3).
    pub fn board_mit_hinweisen(&self, slug: &str) -> Result<BoardMitHinweisen, Fehler> {
        let board = self.ordner().board(slug)?;
        let hinweise = unbekannte(&board);
        Ok(BoardMitHinweisen { board, hinweise })
    }
}
