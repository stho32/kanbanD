//! Zugregeln (R00096, ADR-0002): ein Zug, der eine Spalte über ihre WIP-Grenze bringt, wird für Agenten abgewiesen
//! und Menschen gemeldet. Gezählt wird im Modell (`Belegung`), entschieden hier — unter der Sperre, vor `aktion()`.
//! Dazu die Entnahmeregel (R00097): ein Agent nimmt keine Karte aus einer Spalte, die dem Menschen gehört — sie läuft
//! vor der Grenzprüfung, also 403 vor 409.

use crate::fehler::Fehler;
use crate::modell::{Art, Aufgabe, Board, Einstellungsaenderungen, Entnahmesperre, Grenzverletzungen, Person};
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

/// Meldung der board-weiten fail-safe Sperre (R00120, PO Z. 187): der `human` meinende Eintrag hängt an keiner
/// Spalte, deshalb nennt die 403 keine.
const BOARD_WEIT: &str = "Ein Eintrag unter `column-owner` gehört dem Menschen, ist aber keiner Spalte zuzuordnen — Agenten sind auf dem ganzen Board gesperrt";

/// Agent: die erste Karte in Anfragereihenfolge, die in einer Menschen-Spalte von `vorher` liegt, als `Verboten`;
/// bei einem board-weiten fail-safe-Eintrag nennt die Meldung keine Spalte (R00120, PO Z. 187). Mensch: nie gesperrt.
pub(crate) fn entnahme_pruefen(art: Art, vorher: &Board, entnommen: &[u32]) -> Result<(), Fehler> {
    match entnommen.iter().find_map(|n| vorher.entnahme_erlaubt(art, *n).err()) {
        Some(sperre) => Err(verboten(sperre)),
        None => Ok(()),
    }
}

/// Die 403 aus einer Entnahmesperre (ADR-0003): eine Menschen-Spalte nennt ihren Namen; ein unbekannter Wert, der den
/// Menschen meint (`Human`), nennt Spalte und Rohwert, ohne Eigentum zu behaupten; der board-weite Fall nennt die
/// Spalte, in der der Eintrag bekannt ist (`Eingang: [human]`), sonst keine (Karte #142/B3).
fn verboten(sperre: Entnahmesperre) -> Fehler {
    match sperre {
        Entnahmesperre::Spalte { spalte, nummer, unbekannt } => {
            let meldung = match unbekannt {
                Some(wert) => format!("Spalte „{spalte}“ ist für Agenten gesperrt: der unbekannte Eigentümer „{wert}“ meint den Menschen (fail-safe)"),
                None => format!("Spalte „{spalte}“ gehört dem Menschen"),
            };
            Fehler::Verboten { meldung, spalte, nummer }
        }
        Entnahmesperre::Board { nummer, spalte } => {
            let (meldung, spalte) = match spalte {
                Some(s) => (format!("Spalte „{s}“: ein Eintrag unter `column-owner` meint den Menschen, ist aber kein lesbarer Eigentümer — Agenten sind auf dem ganzen Board gesperrt"), s),
                None => (BOARD_WEIT.to_string(), String::new()),
            };
            Fehler::Verboten { meldung, spalte, nummer }
        }
    }
}

/// Steht einem Agenten das **ganze** Board im Weg (Archivieren/Löschen, R00128)? Geprüft werden alle Karten des Boards in
/// Spaltenreihenfolge (die erste Sperre nennt ihre Spalte und Nummer); ein `human` meinender, ungebundener Eintrag sperrt
/// das Board auch ohne Karte (fail-safe, R00120 PO Z. 187) — dann ist die Spalte leer, die Nummer 0. Mensch nie gesperrt.
pub(crate) fn board_entnahme_pruefen(art: Art, board: &Board) -> Result<(), Fehler> {
    if art != Art::Agent {
        return Ok(());
    }
    let nummern: Vec<u32> = board.spalten.iter().flat_map(|s| s.aufgaben.iter().copied()).collect();
    if let Some(sperre) = nummern.iter().find_map(|n| board.entnahme_erlaubt(art, *n).err()) {
        return Err(verboten(sperre));
    }
    if board.eigentuemer_roh.iter().any(|e| e.meint_human()) {
        return Err(verboten(Entnahmesperre::Board { nummer: 0, spalte: board.roh_human_spalte() }));
    }
    Ok(())
}

/// Erst die Entnahmeregel, dann die Grenzen (ADR-0002) — für Züge, die Karten aus ihrer Spalte nehmen.
pub(crate) fn entnahme_und_zug_pruefen(art: Art, vorher: &Board, nachher: &Board, entnommen: &[u32], archiviert: &BTreeSet<u32>) -> Result<Vec<Warnung>, Fehler> {
    entnahme_pruefen(art, vorher, entnommen)?;
    zug_pruefen(art, vorher, nachher, archiviert)
}

impl super::Kanban {
    /// `entnahme_und_zug_pruefen` mit den Archivierten des Ordners — ein gemeinsamer Kern (R00120, Aufräumen).
    pub(super) fn entnahme_und_grenzen_pruefen(&self, wer: &Person, vorher: &Board, nachher: &Board, entnommen: &[u32]) -> Result<Vec<Warnung>, Fehler> {
        let (aufgaben, _) = self.ordner().aufgaben()?;
        entnahme_und_zug_pruefen(wer.art, vorher, nachher, entnommen, &archivierte(&aufgaben))
    }

    /// `zug_pruefen` mit den Archivierten des Ordners; für Schreibwege, die die Aufgaben nicht ohnehin lesen.
    pub(super) fn grenzen_pruefen(&self, wer: &Person, vorher: &Board, nachher: &Board) -> Result<Vec<Warnung>, Fehler> {
        let (aufgaben, _) = self.ordner().aufgaben()?;
        zug_pruefen(wer.art, vorher, nachher, &archivierte(&aufgaben))
    }

    /// Archivieren nimmt die Karten von jedem Board, auf dem sie liegen (R00097): geprüft je Board in der Reihenfolge
    /// der Boardliste, darin die Nummern in Anfragereihenfolge — die Abweisung nennt die erste Sperre. Mensch nie gesperrt.
    /// Ist eine Board-Datei des Ordners unlesbar, ist die Lage der Karte nicht bestimmbar: ein Agent bekommt 423 statt
    /// der stillen Umgehung (R00120, PO Z. 188) — und zwar **vor** jeder Sperre der lesbaren Boards (403): solange der
    /// Ordner nicht ganz lesbar ist, ist auch die Aussage über die lesbaren Boards unsicher (R00159, ADR-0003 N2).
    pub(super) fn archivieren_pruefen(&self, wer: &Person, nummern: &[u32]) -> Result<(), Fehler> {
        if wer.art == Art::Mensch {
            return Ok(());
        }
        let (boards, defekt) = self.ordner().boards()?;
        if let Some(d) = defekt.first() {
            return Err(Fehler::Defekt(format!("{}: {} — nur lesbar, bis die Datei repariert ist", d.pfad, d.fehler)));
        }
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

/// Agent: die erste Person, deren `art` sich ändert, die als Mensch neu dazukommt oder deren `aktiv` sich bei einem
/// Menschen ändert — als `PersonenartVerboten` (Karte #127) bzw. mit dem Zustand-Wortlaut (Karte #137). `art` und
/// `aktiv` entscheiden, wer handeln darf: ein Agent, der sich zum Menschen macht, hebt die Spalten-Sperre (R00097)
/// dauerhaft auf; einer, der einen Menschen stilllegt, nimmt ihm die Handlungsfähigkeit. Eine unveränderte Angabe ist
/// keine Änderung (wie R00102), einen Agenten anzulegen oder stillzulegen bleibt frei. Mensch: nie gesperrt.
pub(crate) fn personen_pruefen(art: Art, alt: &[Person], neu: &[Person]) -> Result<(), Fehler> {
    if art == Art::Mensch {
        return Ok(());
    }
    for p in neu {
        let bisher = alt.iter().find(|a| a.kuerzel == p.kuerzel);
        let erlaubt = match bisher {
            Some(a) => a.art == p.art,
            None => p.art == Art::Agent,
        };
        if !erlaubt {
            return Err(Fehler::personenart_verboten(&p.kuerzel, bisher.is_none()));
        }
        if let Some(a) = bisher.filter(|a| a.art == Art::Mensch && a.aktiv != p.aktiv) {
            return Err(Fehler::personenstatus_verboten(&a.kuerzel));
        }
    }
    Ok(())
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
        let spalte = |name: &str, eigner, grenze, aufgaben: Vec<u32>| crate::modell::Spalte { notiz: None, farbe: None, eigentuemer: eigner, eigentuemer_unbekannt: None, name: name.into(), grenze, aufgaben, phase: None, pruefungen: vec![], datums_trenner: None };
        Board {
            slug: "b".into(),
            titel: "B".into(),
            spalten: vec![spalte("Eingang", Some(Eigentuemer::Human), None, vec![1, 2]), spalte("In Arbeit", None, None, vec![9]), spalte("Voll", None, Some(1), vec![5])],
            termine: vec![],
            anwendungen: None, klassen: None,
            start: None,
            fieber: Default::default(),
            berichtsfilter: Default::default(), bestand: None,
            eigentuemer_roh: vec![],
            archiviert: None,
            transkripte_erfassen: None,
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

    // R00128 B0599: Archivieren/Löschen sperrt einen Agenten board-weit — die erste Karte einer Menschen-Spalte; ohne
    // Karte sperrt ein ungebundener human-Eintrag trotzdem (fail-safe, PO Z. 187); der Mensch ist frei.
    #[test]
    fn board_entnahme_sperrt_agenten_board_weit() {
        let b = board_mit_eingang();
        assert_eq!(board_entnahme_pruefen(Art::Agent, &b), Err(Fehler::Verboten { meldung: "Spalte „Eingang“ gehört dem Menschen".into(), spalte: "Eingang".into(), nummer: 1 }));
        assert_eq!(board_entnahme_pruefen(Art::Mensch, &b), Ok(()));
        let mut leer = b.clone();
        leer.spalten.iter_mut().for_each(|s| s.aufgaben.clear());
        assert_eq!(board_entnahme_pruefen(Art::Agent, &leer), Ok(()), "ohne Karte und ohne fail-safe-Eintrag frei");
        leer.eigentuemer_roh.push(crate::modell::ColumnOwnerEintrag { schluessel: None, wert: "human".into() });
        assert!(matches!(board_entnahme_pruefen(Art::Agent, &leer), Err(Fehler::Verboten { spalte, nummer: 0, .. }) if spalte.is_empty()), "fail-safe auch ohne Karte");
    }

    // Karte #142 Nacharbeit B3: der 403-Rumpf nennt die Spalte, wo sie bekannt ist (`Eingang: [human]`), und
    // behauptet kein Eigentum, wo der Wert unbekannt ist (`Eingang: Human`).
    #[test]
    fn verboten_nennt_die_bekannte_spalte_und_kein_falsches_eigentum() {
        let mut b = board_mit_eingang();
        b.eigentuemer_roh.push(crate::modell::ColumnOwnerEintrag { schluessel: Some("Eingang".into()), wert: serde_yaml::from_str("[human]").unwrap() });
        match entnahme_pruefen(Art::Agent, &b, &[9]) {
            Err(Fehler::Verboten { meldung, spalte, nummer }) => {
                assert_eq!((spalte.as_str(), nummer), ("Eingang", 9), "die bekannte Spalte steht im Rumpf");
                assert!(meldung.contains("Spalte „Eingang“"), "{meldung}");
                assert!(!meldung.contains("keiner Spalte zuzuordnen"), "{meldung}");
            }
            other => panic!("{other:?}"),
        }
        let mut b = board_mit_eingang();
        b.spalten[0].eigentuemer = None;
        b.spalten[0].eigentuemer_unbekannt = Some("Human".into());
        match entnahme_pruefen(Art::Agent, &b, &[1]) {
            Err(Fehler::Verboten { meldung, spalte, nummer }) => {
                assert_eq!((spalte.as_str(), nummer), ("Eingang", 1));
                assert!(meldung.contains("unbekannte Eigentümer „Human“"), "{meldung}");
                assert!(!meldung.contains("gehört dem Menschen"), "der Wert ist unbekannt, kein Eigentum: {meldung}");
            }
            other => panic!("{other:?}"),
        }
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

    // Karte #127/#137: die Art und den Zustand (`aktiv`) einer Person setzen nur Menschen — ein Agent macht sich nicht zum
    // Menschen, legt keinen an, stuft keinen Menschen zurück und legt keinen Menschen still; eine unveränderte Angabe ist
    // keine Änderung, der Mensch darf alles.
    #[test]
    fn die_art_und_den_zustand_einer_person_setzen_nur_menschen() {
        let person = |kuerzel: &str, art, aktiv| Person { kuerzel: kuerzel.into(), name: kuerzel.into(), art, aktiv };
        let alt = vec![person("st", Art::Mensch, true), person("ab", Art::Mensch, false), person("cl", Art::Agent, true)];
        let mit = |aenderung: Person| {
            let mut neu = alt.clone();
            if let Some(p) = neu.iter_mut().find(|p| p.kuerzel == aenderung.kuerzel) {
                *p = aenderung.clone();
            } else {
                neu.push(aenderung.clone());
            }
            neu
        };
        let selbst_mensch = mit(person("cl", Art::Mensch, true));
        assert_eq!(personen_pruefen(Art::Agent, &alt, &selbst_mensch), Err(Fehler::personenart_verboten("cl", false)));
        let mensch_zurueck = mit(person("st", Art::Agent, true));
        assert_eq!(personen_pruefen(Art::Agent, &alt, &mensch_zurueck), Err(Fehler::personenart_verboten("st", false)), "auch das Zurückstufen");
        let neuer_mensch = mit(person("mi", Art::Mensch, true));
        assert_eq!(personen_pruefen(Art::Agent, &alt, &neuer_mensch), Err(Fehler::personenart_verboten("mi", true)));
        assert_eq!(personen_pruefen(Art::Agent, &alt, &mit(person("ag2", Art::Agent, true))), Ok(()), "einen Agenten anlegen bleibt frei");
        assert_eq!(personen_pruefen(Art::Agent, &alt, &mit(person("cl", Art::Agent, true))), Ok(()), "gleiche Art ist keine Änderung");
        assert_eq!(personen_pruefen(Art::Agent, &alt, &alt), Ok(()), "unverändert frei");
        assert_eq!(personen_pruefen(Art::Mensch, &alt, &selbst_mensch), Ok(()), "Mensch nie gesperrt");
        // Karte #137: `aktiv` eines Menschen — stilllegen und reaktivieren, auch das eigene.
        assert_eq!(personen_pruefen(Art::Agent, &alt, &mit(person("st", Art::Mensch, false))), Err(Fehler::personenstatus_verboten("st")));
        assert_eq!(personen_pruefen(Art::Agent, &alt, &mit(person("ab", Art::Mensch, true))), Err(Fehler::personenstatus_verboten("ab")), "auch reaktivieren");
        assert_eq!(personen_pruefen(Art::Agent, &alt, &mit(person("ab", Art::Mensch, false))), Ok(()), "unverändert stillgelegt");
        assert_eq!(personen_pruefen(Art::Agent, &alt, &mit(person("cl", Art::Agent, false))), Ok(()), "einen Agenten stilllegen bleibt frei");
        assert_eq!(personen_pruefen(Art::Agent, &alt, &mit(person("ag2", Art::Agent, false))), Ok(()), "einen stillgelegten Agenten anlegen bleibt frei");
        assert_eq!(personen_pruefen(Art::Mensch, &alt, &mit(person("st", Art::Mensch, false))), Ok(()), "der Mensch stilllegt sich selbst");
    }

    #[test]
    fn ohne_verletzung_darf_jeder_ziehen() {
        for art in [Art::Agent, Art::Mensch] {
            assert_eq!(zugregeln(art, &Grenzverletzungen::default()).map(|w| w.len()), Ok(0), "{art:?}");
        }
    }
}
