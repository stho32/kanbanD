use super::{Kanban, Schritt};
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::{board, einstellungen};
use crate::modell::{Art, Person};
use serde::Serialize;

/// Antwort eines Umschaltens (R00220 FA 4): `erfassen` wie gespeichert (am Board `None` = wie Vorgabe), `wirksam` der
/// Wert, der danach gilt.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Schalterantwort {
    pub erfassen: Option<bool>,
    pub wirksam: bool,
}

/// „Transkripte erfassen“ stellen nur Menschen um (R00220 FA 3, ADR-0036 Nachtrag „Umschalten“ Punkt 3) — immer, auch
/// wenn sich nichts ändern würde. Die Routen rufen sie vor dem Rumpf, die Dienste noch einmal vor der Sperre.
pub fn nur_menschen_schalten(wer: &Person) -> Result<(), Fehler> {
    if wer.art == Art::Agent {
        return Err(Fehler::schalter_verboten());
    }
    Ok(())
}

/// Der Wert im Wortlaut der Commit-Nachricht.
fn wort(wert: Option<bool>) -> &'static str {
    match wert {
        Some(true) => "an",
        Some(false) => "aus",
        None => "wie Vorgabe",
    }
}

impl Kanban {
    /// Setzt `record-transcripts` der Board-Datei (R00220 FA 1): `None` entfernt den Schlüssel, dann gilt die Vorgabe des
    /// Ordners. Unter der Sperre frisch gelesen; ein Commit nur an der Board-Datei, ohne Änderung keiner.
    pub fn board_transkripte_setzen(&self, wer: &Person, slug: &str, neu: Option<bool>) -> Result<(bool, Schalterantwort), Fehler> {
        nur_menschen_schalten(wer)?;
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        let vorgabe = self.ordner().einstellungen()?.and_then(|e| e.transkripte_erfassen);
        let ergebnis = Schalterantwort { erfassen: neu, wirksam: neu.or(vorgabe).unwrap_or(false) };
        if b.transkripte_erfassen == neu {
            return Ok((false, ergebnis));
        }
        let text = format!("Transkripte auf „{}“: {}", crate::nachricht::wert(&b.titel), wort(neu));
        b.transkripte_erfassen = neu;
        self.aktion(wer, &text, &[Schritt::schreiben(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok((true, ergebnis))
    }

    /// Setzt `record-transcripts` in `kanbanD.md` (R00220 FA 2). Verglichen wird der wirksame Wert: fehlt der Schlüssel,
    /// ist „aus“ schon wirksam und ändert nichts; sonst wird der Wert ausdrücklich geschrieben. Geschrieben wird nur die eine
    /// Zeile im Text der Datei (`schalter_im_text`), nicht die ganze Datei neu: alles andere bleibt zeichengleich.
    pub fn vorgabe_transkripte_setzen(&self, wer: &Person, neu: bool) -> Result<(bool, Schalterantwort), Fehler> {
        nur_menschen_schalten(wer)?;
        let _sperre = self.gesperrt();
        let e = self.ordner().einstellungen()?.ok_or_else(|| Fehler::Konflikt("Der Ordner ist noch nicht eingerichtet".into()))?;
        let ergebnis = Schalterantwort { erfassen: Some(neu), wirksam: neu };
        if e.transkripte_erfassen.unwrap_or(false) == neu {
            return Ok((false, ergebnis));
        }
        // nur die eine Zeile: Kommentare, unbekannte Schlüssel, Reihenfolge und Text der Datei bleiben (Nacharbeit 1)
        let alt = self.ordner().lies(einstellungen::DATEI)?.unwrap_or_default();
        let datei = board::schalter_im_text(&alt, Some(neu));
        let gelesen = einstellungen::lesen(&datei).map_err(|f| Fehler::Intern(format!("{}: Schalter nicht setzbar: {f}", einstellungen::DATEI)))?;
        if gelesen.transkripte_erfassen != Some(neu) {
            return Err(Fehler::Intern(format!("{}: der Schalter liest sich nach dem Setzen anders", einstellungen::DATEI)));
        }
        let text = format!("Transkripte, Vorgabe des Ordners: {}", wort(Some(neu)));
        self.aktion(wer, &text, &[Schritt::schreiben(einstellungen::DATEI, datei)])?;
        Ok((true, ergebnis))
    }
}
