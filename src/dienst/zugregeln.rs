//! Zugregeln (R00096, ADR-0002): ein Zug, der eine Spalte über ihre WIP-Grenze bringt, wird für Agenten abgewiesen
//! und Menschen gemeldet. Gezählt wird im Modell (`Belegung`), entschieden hier — unter der Sperre, vor `aktion()`.

use crate::fehler::Fehler;
use crate::modell::{Art, Aufgabe, Board, Grenzverletzungen};
use crate::pruefungen::Warnung;
use std::collections::BTreeSet;

/// Die Nummern der archivierten Aufgaben — sie stehen weiter in der Board-Datei, zählen aber nicht.
pub(crate) fn archivierte(aufgaben: &[Aufgabe]) -> BTreeSet<u32> {
    aufgaben.iter().filter(|a| a.archiviert.is_some()).map(|a| a.nummer).collect()
}

/// Ein Zug auf einem Board: `vorher` und `nachher` im Speicher, dieselben Archivierten.
pub(crate) fn zug_pruefen(art: Art, vorher: &Board, nachher: &Board, archiviert: &BTreeSet<u32>) -> Result<Vec<Warnung>, Fehler> {
    zugregeln(art, &nachher.belegung(archiviert).grenzverletzungen(&vorher.belegung(archiviert)))
}

impl super::Kanban {
    /// `zug_pruefen` mit den Archivierten des Ordners; für Schreibwege, die die Aufgaben nicht ohnehin lesen.
    pub(super) fn grenzen_pruefen(&self, wer: &crate::modell::Person, vorher: &Board, nachher: &Board) -> Result<Vec<Warnung>, Fehler> {
        let (aufgaben, _) = self.ordner().aufgaben()?;
        zug_pruefen(wer.art, vorher, nachher, &archivierte(&aufgaben))
    }
}

/// Agent: die erste Verletzung von links als `GrenzeErreicht` mit der Belegung vor dem Zug.
/// Mensch: je Verletzung eine Warnung `grenze`; der Text nennt die Anzahl nach dem Zug.
pub(crate) fn zugregeln(art: Art, verletzungen: &Grenzverletzungen) -> Result<Vec<Warnung>, Fehler> {
    if let (Art::Agent, Some(erste)) = (art, verletzungen.0.first()) {
        return Err(Fehler::GrenzeErreicht { spalte: erste.spalte.clone(), grenze: erste.grenze, anzahl: erste.vorher });
    }
    Ok(verletzungen.0.iter().map(grenzwarnung).collect())
}

fn grenzwarnung(v: &crate::modell::Grenzverletzung) -> Warnung {
    Warnung {
        pruefung: "grenze".into(),
        text: format!("Grenze erreicht: „{}“ hat {} von {}", v.spalte, v.nachher, v.grenze),
        knoten: Vec::new(),
        details: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::Grenzverletzung;

    fn verletzungen() -> Grenzverletzungen {
        Grenzverletzungen(vec![
            Grenzverletzung { spalte: "Bereit".into(), grenze: 1, vorher: 1, nachher: 2 },
            Grenzverletzung { spalte: "In Arbeit".into(), grenze: 2, vorher: 2, nachher: 3 },
        ])
    }

    #[test]
    fn agent_wird_mit_der_ersten_verletzung_abgewiesen() {
        let mut v = verletzungen();
        v.0.reverse();
        assert_eq!(
            zugregeln(Art::Agent, &v),
            Err(Fehler::GrenzeErreicht { spalte: "In Arbeit".into(), grenze: 2, anzahl: 2 }),
            "anzahl ist die Belegung vor dem Zug"
        );
    }

    #[test]
    fn mensch_bekommt_je_verletzung_eine_warnung() {
        let warnungen = zugregeln(Art::Mensch, &verletzungen()).unwrap();
        let gemeldet: Vec<(&str, &str, usize, usize)> =
            warnungen.iter().map(|w| (w.pruefung.as_str(), w.text.as_str(), w.knoten.len(), w.details.len())).collect();
        assert_eq!(
            gemeldet,
            [("grenze", "Grenze erreicht: „Bereit“ hat 2 von 1", 0, 0), ("grenze", "Grenze erreicht: „In Arbeit“ hat 3 von 2", 0, 0)]
        );
    }

    #[test]
    fn ohne_verletzung_darf_jeder_ziehen() {
        for art in [Art::Agent, Art::Mensch] {
            assert_eq!(zugregeln(art, &Grenzverletzungen::default()).map(|w| w.len()), Ok(0), "{art:?}");
        }
    }
}
