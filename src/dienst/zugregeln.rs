//! Zugregeln (R00096, ADR-0002): ein Zug, der eine Spalte über ihre WIP-Grenze bringt, wird für Agenten abgewiesen
//! und Menschen gemeldet. Gezählt wird im Modell (`Belegung`), entschieden hier — unter der Sperre, vor `aktion()`.
//! Dazu die Entnahmeregel (R00097): ein Agent nimmt keine Karte aus einer Spalte, die dem Menschen gehört — sie läuft
//! vor der Grenzprüfung, also 403 vor 409.

use crate::fehler::Fehler;
use crate::modell::{Art, Aufgabe, Board, Einstellungsaenderungen, Grenzverletzungen, Person};
use crate::pruefungen::Warnung;
use std::collections::BTreeSet;

/// Die Nummern der archivierten Aufgaben — sie stehen weiter in der Board-Datei, zählen aber nicht.
pub(crate) fn archivierte(aufgaben: &[Aufgabe]) -> BTreeSet<u32> {
    aufgaben.iter().filter(|a| a.archiviert.is_some()).map(|a| a.nummer).collect()
}

/// Ein Zug auf einem Board: `vorher` und `nachher` im Speicher, dieselben Archivierten.
pub(crate) fn zug_pruefen(art: Art, vorher: &Board, nachher: &Board, archiviert: &BTreeSet<u32>) -> Result<Vec<Warnung>, Fehler> {
    zug_mit_rueckkehr_pruefen(art, vorher, nachher, archiviert, archiviert)
}

/// Ein Zug, der zugleich archivierte Karten wieder zählen lässt (Wiederöffnen, R00098): `vorher` mit den Archivierten
/// vor dem Zug gezählt, `nachher` mit denen danach.
pub(crate) fn zug_mit_rueckkehr_pruefen(art: Art, vorher: &Board, nachher: &Board, archiviert_vorher: &BTreeSet<u32>, archiviert_nachher: &BTreeSet<u32>) -> Result<Vec<Warnung>, Fehler> {
    zugregeln(art, &nachher.belegung(archiviert_nachher).grenzverletzungen(&vorher.belegung(archiviert_vorher)))
}

/// Agent: die erste Karte in Anfragereihenfolge, die in einer Menschen-Spalte von `vorher` liegt, als `Verboten`.
/// Mensch: nie gesperrt.
pub(crate) fn entnahme_pruefen(art: Art, vorher: &Board, entnommen: &[u32]) -> Result<(), Fehler> {
    match entnommen.iter().find_map(|n| vorher.entnahme_erlaubt(art, *n).err()) {
        Some(sperre) => Err(Fehler::Verboten { meldung: format!("Spalte „{}“ gehört dem Menschen", sperre.spalte), spalte: sperre.spalte, nummer: sperre.nummer }),
        None => Ok(()),
    }
}

/// Erst die Entnahmeregel, dann die Grenzen (ADR-0002) — für Züge, die Karten aus ihrer Spalte nehmen.
pub(crate) fn entnahme_und_zug_pruefen(art: Art, vorher: &Board, nachher: &Board, entnommen: &[u32], archiviert: &BTreeSet<u32>) -> Result<Vec<Warnung>, Fehler> {
    entnahme_pruefen(art, vorher, entnommen)?;
    zug_pruefen(art, vorher, nachher, archiviert)
}

impl super::Kanban {
    /// `entnahme_und_zug_pruefen` mit den Archivierten des Ordners.
    pub(super) fn entnahme_und_grenzen_pruefen(&self, wer: &Person, vorher: &Board, nachher: &Board, entnommen: &[u32]) -> Result<Vec<Warnung>, Fehler> {
        entnahme_pruefen(wer.art, vorher, entnommen)?;
        self.grenzen_pruefen(wer, vorher, nachher)
    }

    /// `zug_pruefen` mit den Archivierten des Ordners; für Schreibwege, die die Aufgaben nicht ohnehin lesen.
    pub(super) fn grenzen_pruefen(&self, wer: &Person, vorher: &Board, nachher: &Board) -> Result<Vec<Warnung>, Fehler> {
        let (aufgaben, _) = self.ordner().aufgaben()?;
        zug_pruefen(wer.art, vorher, nachher, &archivierte(&aufgaben))
    }

    /// Archivieren nimmt die Karten von jedem Board, auf dem sie liegen (R00097): geprüft je Board in der Reihenfolge
    /// der Boardliste, darin die Nummern in Anfragereihenfolge — die Abweisung nennt die erste Sperre. Mensch nie gesperrt.
    pub(super) fn archivieren_pruefen(&self, wer: &Person, nummern: &[u32]) -> Result<(), Fehler> {
        if wer.art == Art::Mensch {
            return Ok(());
        }
        let (boards, _) = self.ordner().boards()?;
        boards.iter().try_for_each(|b| entnahme_pruefen(wer.art, b, nummern))
    }

    /// Zurückholen ändert kein Board, lässt die Karten aber auf jedem Board, auf dem sie liegen, wieder zählen:
    /// geprüft je Board in der Reihenfolge der Boardliste, also nennt die Abweisung das erste. Mensch ohne Warnung.
    pub(super) fn zurueckholen_pruefen(&self, wer: &Person, nummern: &[u32]) -> Result<(), Fehler> {
        let (aufgaben, _) = self.ordner().aufgaben()?;
        let vorher = archivierte(&aufgaben);
        let nachher: BTreeSet<u32> = vorher.iter().copied().filter(|n| !nummern.contains(n)).collect();
        let (boards, _) = self.ordner().boards()?;
        for b in boards.iter().filter(|b| nummern.iter().any(|n| b.spalte_von(*n).is_some())) {
            zugregeln(wer.art, &b.belegung(&nachher).grenzverletzungen(&b.belegung(&vorher)))?;
        }
        Ok(())
    }
}

/// Agent: die erste geänderte Einstellung als `EinstellungVerboten` (R00102). Mensch: nie gesperrt.
pub(crate) fn einstellungen_pruefen(art: Art, aenderungen: &Einstellungsaenderungen) -> Result<(), Fehler> {
    match (art, aenderungen.erste()) {
        (Art::Agent, Some(a)) => Err(Fehler::einstellung_verboten(&a.spalte, a.einstellung)),
        _ => Ok(()),
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
    use crate::modell::{Eigentuemer, Grenzverletzung};

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

    fn board_mit_eingang() -> Board {
        let spalte = |name: &str, eigner, grenze, aufgaben: Vec<u32>| crate::modell::Spalte { notiz: None, farbe: None, eigentuemer: eigner, eigentuemer_unbekannt: None, name: name.into(), grenze, aufgaben, phase: None, pruefungen: vec![] };
        Board {
            slug: "b".into(),
            titel: "B".into(),
            spalten: vec![spalte("Eingang", Some(Eigentuemer::Human), None, vec![1, 2]), spalte("In Arbeit", None, None, vec![9]), spalte("Voll", None, Some(1), vec![5])],
            termine: vec![],
            anwendungen: None,
            start: None,
            fieber: Default::default(),
            berichtsfilter: Default::default(), bestand: None,
        }
    }

    // R00097: die erste Sperre in Anfragereihenfolge (po-entscheidungen Z. 47), Mensch nie gesperrt
    #[test]
    fn entnahme_nennt_die_erste_sperre_in_anfragereihenfolge() {
        let b = board_mit_eingang();
        let verboten = |nummer| Err(Fehler::Verboten { meldung: "Spalte „Eingang“ gehört dem Menschen".into(), spalte: "Eingang".into(), nummer });
        assert_eq!(entnahme_pruefen(Art::Agent, &b, &[9, 2, 1]), verboten(2));
        assert_eq!(entnahme_pruefen(Art::Agent, &b, &[1, 2]), verboten(1));
        assert_eq!(entnahme_pruefen(Art::Agent, &b, &[9, 5]), Ok(()));
        assert_eq!(entnahme_pruefen(Art::Mensch, &b, &[1, 2]), Ok(()));
    }

    // ADR-0002: die Entnahmeregel läuft vor der Grenzprüfung — 403 vor 409
    #[test]
    fn verboten_kommt_vor_grenze_erreicht() {
        let vorher = board_mit_eingang();
        let mut nachher = vorher.clone();
        nachher.bewegen(1, "Voll", None).unwrap();
        let keine = BTreeSet::new();
        assert!(matches!(entnahme_und_zug_pruefen(Art::Agent, &vorher, &nachher, &[1], &keine), Err(Fehler::Verboten { nummer: 1, .. })));
        assert!(matches!(entnahme_und_zug_pruefen(Art::Agent, &vorher, &nachher, &[], &keine), Err(Fehler::GrenzeErreicht { .. })), "ohne Entnahme gilt die Grenze");
        assert_eq!(entnahme_und_zug_pruefen(Art::Mensch, &vorher, &nachher, &[1], &keine).map(|w| w.len()), Ok(1), "Mensch: nur die Grenzwarnung");
    }

    // R00102: Grenze und Eigentümer ändern nur Menschen — der Agent bekommt die erste Änderung, der Mensch nie eine
    #[test]
    fn einstellungen_aendert_nur_der_mensch() {
        use crate::modell::{Einstellung, Einstellungsaenderung, Einstellungsaenderungen};
        let aenderung = |spalte: &str, einstellung| Einstellungsaenderung { spalte: spalte.into(), einstellung };
        let zwei = Einstellungsaenderungen(vec![aenderung("Eingang", Einstellung::Eigentuemer), aenderung("In Arbeit", Einstellung::Grenze)]);
        assert_eq!(einstellungen_pruefen(Art::Agent, &zwei), Err(Fehler::einstellung_verboten("Eingang", Einstellung::Eigentuemer)), "die erste");
        let eine = Einstellungsaenderungen(vec![aenderung("In Arbeit", Einstellung::Grenze)]);
        assert_eq!(einstellungen_pruefen(Art::Agent, &eine), Err(Fehler::einstellung_verboten("In Arbeit", Einstellung::Grenze)));
        assert_eq!(einstellungen_pruefen(Art::Mensch, &zwei), Ok(()), "Mensch nie gesperrt");
        assert_eq!(einstellungen_pruefen(Art::Agent, &Einstellungsaenderungen::default()), Ok(()), "ohne Änderung frei");
    }

    #[test]
    fn ohne_verletzung_darf_jeder_ziehen() {
        for art in [Art::Agent, Art::Mensch] {
            assert_eq!(zugregeln(art, &Grenzverletzungen::default()).map(|w| w.len()), Ok(0), "{art:?}");
        }
    }
}
