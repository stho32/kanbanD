//! Board umbenennen, archivieren und löschen (R00128, ADR-0022): nur die Überschrift bzw. das `archived`-Frontmatter
//! ändern — der Slug bleibt Dateiname, Adresse und Berichte-Cache-Schlüssel; Löschen entfernt die Board-Datei samt Cache
//! in einem Commit (Git ist der Papierkorb).

use super::Kanban;
use super::einrichten::boardname_pruefen;
use super::zugregeln::board_entnahme_pruefen;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::{Board, Person};
use serde::Deserialize;

/// Rumpf von `PATCH /api/boards/{slug}` (R00128): `None` heißt „nicht ändern“ — die Unterscheidung zu `false` zählt.
#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize, utoipa::ToSchema)]
pub struct BoardVerwalten {
    pub titel: Option<String>,
    pub archiviert: Option<bool>,
}

impl Kanban {
    /// Umbenennen und/oder Archivieren (R00128, ADR-0022). Erst die Eingangstür (`Ordner::board`: Form 400, Datei 404,
    /// defekt 423), dann die Werte (Titel mit Buchstaben oder Ziffern, sonst 400). Archivieren prüft die
    /// Eigentümer-Sperre board-weit (R00097/R00120, 403); Umbenennen bewegt keine Karte und ist frei. Ohne tatsächliche
    /// Änderung kein Commit.
    pub fn board_aendern(&self, wer: &Person, slug: &str, neu: &BoardVerwalten) -> Result<Board, Fehler> {
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        let mut nachricht: Option<String> = None;
        if let Some(titel) = &neu.titel {
            let titel = titel.trim().to_string();
            boardname_pruefen(&titel)?;
            if titel != b.titel {
                b.titel = titel.clone();
                nachricht = Some(format!("Board „{titel}“ umbenannt"));
            }
        }
        if let Some(archivieren) = neu.archiviert {
            let ziel = archivieren.then(crate::uhr::heute);
            if b.archiviert != ziel {
                board_entnahme_pruefen(wer.art, &b)?;
                nachricht = Some(if archivieren {
                    format!("Board „{}“ archiviert", b.titel)
                } else {
                    format!("Board „{}“ wieder geöffnet", b.titel)
                });
                b.archiviert = ziel;
            }
        }
        if let Some(text) = nachricht {
            self.aktion(wer, &text, &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        }
        Ok(b)
    }

    /// Löschen (R00128, ADR-0022): Board-Datei und der verwaiste Berichte-Cache `berichte/<slug>-fieber.md` in genau
    /// einem Commit. Eigentümer-Sperre board-weit wie beim Archivieren (R00097/R00120); unbekannt 404, defekt 423.
    pub fn board_loeschen(&self, wer: &Person, slug: &str) -> Result<(), Fehler> {
        let _sperre = self.gesperrt();
        let b = self.ordner().board(slug)?;
        board_entnahme_pruefen(wer.art, &b)?;
        let mut pfade = vec![board_pfad(&b.slug)];
        let cache = crate::format::fieber::pfad(&b.slug);
        if self.ordner().existiert(&cache) {
            pfade.push(cache);
        }
        self.entfernen(wer, &format!("Board „{}“ endgültig gelöscht", b.titel), &pfade)
    }
}

#[cfg(test)]
mod tests {
    use super::BoardVerwalten;

    // B0597: `None` heißt „nicht ändern“ — die Unterscheidung zu `false` zählt (nur die abwesenden Felder fehlen).
    #[test]
    fn leeres_patch_aendert_nichts() {
        let neu: BoardVerwalten = serde_json::from_str("{}").unwrap();
        assert_eq!(neu, BoardVerwalten::default());
        let nur_archiv: BoardVerwalten = serde_json::from_str("{\"archiviert\": false}").unwrap();
        assert_eq!((nur_archiv.titel, nur_archiv.archiviert), (None, Some(false)));
    }
}
