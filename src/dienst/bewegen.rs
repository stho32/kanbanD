use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::{Bewegfehler, Board, Person};
use crate::pruefungen::{Knotenstaende, Knotenstand, Warnung, ausgeloest, gepruefte_knoten, pruefen};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Deserialize, utoipa::ToSchema)]
pub struct Bewegung {
    pub nummer: u32,
    pub spalte: String,
    pub index: Option<usize>,
}

/// Antwort von `POST …/bewegen`: ob sich etwas geändert hat und was die Prüfungen der verlassenen Spalte melden.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct Bewegt {
    pub bewegt: bool,
    pub warnungen: Vec<Warnung>,
}

impl Kanban {
    /// Ändert nur die Board-Datei. Ohne Änderung kein Commit. Ein Zug nach rechts aus einer Spalte mit Prüfungen
    /// wird trotzdem ausgeführt; nicht erfüllte Prüfungen stehen als Warnung in der Antwort (R00059).
    pub fn bewegen(&self, wer: &Person, slug: &str, bw: &Bewegung) -> Result<Bewegt, Fehler> {
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        let von = b.spalte_von(bw.nummer).map(|s| s.name.clone());
        let geaendert = b.bewegen(bw.nummer, &bw.spalte, bw.index).map_err(|f| match f {
            Bewegfehler::NichtAufDemBoard => Fehler::NichtGefunden(format!("#{} liegt nicht auf „{}“", bw.nummer, b.titel)),
            Bewegfehler::SpalteUnbekannt | Bewegfehler::SchonAufDemBoard => Fehler::Ungueltig(format!("Spalte „{}“ gibt es auf „{}“ nicht", bw.spalte, b.titel)),
        })?;
        if !geaendert {
            return Ok(Bewegt { bewegt: false, warnungen: vec![] });
        }
        let nachricht = if von.as_deref() == Some(bw.spalte.as_str()) {
            format!("#{} in „{}“ umsortiert ({})", bw.nummer, bw.spalte, b.titel)
        } else {
            format!("#{} nach „{}“ ({})", bw.nummer, bw.spalte, b.titel)
        };
        self.aktion(wer, &nachricht, &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        let warnungen = von.map(|v| self.warnungen(&b, bw.nummer, &v, &bw.spalte)).unwrap_or_default();
        Ok(Bewegt { bewegt: true, warnungen })
    }

    /// Mehrere Karten in einem Commit (R00065): alle heraus, dann der Reihe nach an ihren Platz.
    /// Warnungen sammeln die Prüfungen jeder verlassenen Spalte.
    pub fn mehrere_bewegen(&self, wer: &Person, slug: &str, ziele: &[Bewegung]) -> Result<Bewegt, Fehler> {
        if ziele.is_empty() {
            return Err(Fehler::Ungueltig("Keine Aufgabe angegeben".into()));
        }
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        let von: Vec<Option<String>> = ziele.iter().map(|z| b.spalte_von(z.nummer).map(|s| s.name.clone())).collect();
        let liste: Vec<(u32, &str, Option<usize>)> = ziele.iter().map(|z| (z.nummer, z.spalte.as_str(), z.index)).collect();
        let geaendert = b.mehrere_bewegen(&liste).map_err(|f| match f {
            Bewegfehler::NichtAufDemBoard => Fehler::NichtGefunden(format!("Nicht alle Aufgaben liegen auf „{}“", b.titel)),
            _ => Fehler::Ungueltig(format!("Eine Zielspalte gibt es auf „{}“ nicht", b.titel)),
        })?;
        if !geaendert {
            return Ok(Bewegt { bewegt: false, warnungen: vec![] });
        }
        let nummern = ziele.iter().map(|z| format!("#{}", z.nummer)).collect::<Vec<_>>().join(", ");
        let wohin = match ziele.iter().all(|z| z.spalte == ziele[0].spalte) {
            true => format!("nach „{}“", ziele[0].spalte),
            false => "bewegt".to_string(),
        };
        self.aktion(wer, &format!("{nummern} {wohin} ({} Aufgaben, {})", ziele.len(), b.titel), &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        let warnungen = ziele.iter().zip(von).filter_map(|(z, v)| v.map(|v| self.warnungen(&b, z.nummer, &v, &z.spalte))).flatten().collect();
        Ok(Bewegt { bewegt: true, warnungen })
    }

    /// Prüft, was der Zug `von` → `nach` auslöst; eine unlesbare Aufgabe prüft nichts.
    pub(super) fn warnungen(&self, b: &Board, nummer: u32, von: &str, nach: &str) -> Vec<Warnung> {
        let folge = self.phasenstand(b).map(|s| s.folge);
        let pruefungen = ausgeloest(b, folge.as_ref(), von, nach);
        let Some(aufgabe) = (!pruefungen.is_empty()).then(|| self.ordner().aufgabe(nummer).ok()).flatten() else { return vec![] };
        let staende = self.knotenstaende(&gepruefte_knoten(&aufgabe));
        pruefungen.into_iter().filter_map(|p| pruefen(p, &aufgabe, &staende)).collect()
    }

    /// Gerechneter Status je Knoten; jede Anwendung wird einmal gelesen.
    fn knotenstaende(&self, knoten: &[(String, String, String)]) -> Knotenstaende {
        let mut sichten = BTreeMap::new();
        knoten
            .iter()
            .map(|(anwendung, id, schluessel)| {
                let sicht = sichten.entry(anwendung.clone()).or_insert_with(|| self.wbs(anwendung).ok());
                let stand = match sicht {
                    None => Knotenstand::NichtErreichbar,
                    Some(s) => s.knoten.iter().find(|z| &z.knoten.id == id).map_or(Knotenstand::Fehlt, |z| Knotenstand::Status(z.gerechnet.clone())),
                };
                (schluessel.clone(), stand)
            })
            .collect()
    }
}
