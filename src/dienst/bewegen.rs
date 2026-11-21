use super::{Kanban, Schritt};
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::{Bewegfehler, Person};
use crate::warnung::Warnung;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, utoipa::ToSchema)]
pub struct Bewegung {
    pub nummer: u32,
    pub spalte: String,
    pub index: Option<usize>,
}

/// Antwort von `POST …/bewegen`: ob sich etwas geändert hat und welche Grenze ein Mensch überschritten hat (R00096).
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct Bewegt {
    pub bewegt: bool,
    pub warnungen: Vec<Warnung>,
}

impl Kanban {
    /// Ändert nur die Board-Datei. Ohne Änderung kein Commit.
    pub fn bewegen(&self, wer: &Person, slug: &str, bw: &Bewegung) -> Result<Bewegt, Fehler> {
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        let von = b.spalte_von(bw.nummer).map(|s| s.name.clone());
        let vorher = b.clone();
        let geaendert = b.bewegen(bw.nummer, &bw.spalte, bw.index).map_err(|f| match f {
            Bewegfehler::NichtAufDemBoard => Fehler::NichtGefunden(format!("#{} liegt nicht auf „{}“", bw.nummer, b.titel)),
            Bewegfehler::SpalteUnbekannt | Bewegfehler::SchonAufDemBoard => Fehler::Ungueltig(format!("Spalte „{}“ gibt es auf „{}“ nicht", bw.spalte, b.titel)),
        })?;
        if !geaendert {
            return Ok(Bewegt { bewegt: false, warnungen: vec![] });
        }
        let grenzwarnungen = self.entnahme_und_grenzen_pruefen(wer, &vorher, &b, &[bw.nummer])?;
        let nachricht = if von.as_deref() == Some(bw.spalte.as_str()) {
            format!("#{} in „{}“ umsortiert ({})", bw.nummer, crate::nachricht::wert(&bw.spalte), crate::nachricht::wert(&b.titel))
        } else {
            format!("#{} nach „{}“ ({})", bw.nummer, crate::nachricht::wert(&bw.spalte), crate::nachricht::wert(&b.titel))
        };
        self.aktion(wer, &nachricht, &[Schritt::schreiben(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok(Bewegt { bewegt: true, warnungen: grenzwarnungen })
    }

    /// Mehrere Karten in einem Commit (R00065): alle heraus, dann der Reihe nach an ihren Platz.
    pub fn mehrere_bewegen(&self, wer: &Person, slug: &str, ziele: &[Bewegung]) -> Result<Bewegt, Fehler> {
        if ziele.is_empty() {
            return Err(Fehler::Ungueltig("Keine Aufgabe angegeben".into()));
        }
        super::ohne_doppelte(ziele.iter().map(|z| z.nummer))?;
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        let liste: Vec<(u32, &str, Option<usize>)> = ziele.iter().map(|z| (z.nummer, z.spalte.as_str(), z.index)).collect();
        let vorher = b.clone();
        let geaendert = b.mehrere_bewegen(&liste).map_err(|f| match f {
            Bewegfehler::NichtAufDemBoard => Fehler::NichtGefunden(format!("Nicht alle Aufgaben liegen auf „{}“", b.titel)),
            _ => Fehler::Ungueltig(format!("Eine Zielspalte gibt es auf „{}“ nicht", b.titel)),
        })?;
        if !geaendert {
            return Ok(Bewegt { bewegt: false, warnungen: vec![] });
        }
        let entnommen: Vec<u32> = ziele.iter().map(|z| z.nummer).collect();
        let grenzwarnungen = self.entnahme_und_grenzen_pruefen(wer, &vorher, &b, &entnommen)?;
        let nummern = ziele.iter().map(|z| format!("#{}", z.nummer)).collect::<Vec<_>>().join(", ");
        let wohin = match ziele.iter().all(|z| z.spalte == ziele[0].spalte) {
            true => format!("nach „{}“", crate::nachricht::wert(&ziele[0].spalte)),
            false => "bewegt".to_string(),
        };
        self.aktion(wer, &format!("{nummern} {wohin} ({} Aufgaben, {})", ziele.len(), crate::nachricht::wert(&b.titel)), &[Schritt::schreiben(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok(Bewegt { bewegt: true, warnungen: grenzwarnungen })
    }
}
