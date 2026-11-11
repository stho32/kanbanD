use super::{Kanban, Schritt, zugregeln};
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::board;
use crate::modell::{Board, Einstellungsaenderungen, Person, SpaltenAenderung, Spaltenfehler};

impl Kanban {
    /// Schreibt die neue Spaltenfolge in die Board-Datei; ohne Änderung kein Commit. Formfehler (400) und „enthält
    /// Aufgaben“ (409) gehen vor; ein Agent, der Grenze oder Eigentümer ändert, bekommt 403 (R00102).
    pub fn spalten_setzen(&self, wer: &Person, slug: &str, neu: &[SpaltenAenderung]) -> Result<bool, Fehler> {
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        let vorher = b.clone();
        let geaendert = b.spalten_setzen(neu).map_err(|f| match f {
            Spaltenfehler::NameLeer => Fehler::Ungueltig("Eine Spalte braucht einen Namen".into()),
            Spaltenfehler::NameUngueltig(n) => Fehler::Ungueltig(format!("Spalte „{n}“ braucht 1–200 Zeichen ohne Zeilenumbruch")),
            Spaltenfehler::NameDoppelt(n) => Fehler::Ungueltig(format!("Spalte „{n}“ ist doppelt")),
            Spaltenfehler::AltUnbekannt(n) => Fehler::Ungueltig(format!("Spalte „{n}“ gibt es nicht")),
            Spaltenfehler::AltDoppelt(n) => Fehler::Ungueltig(format!("Spalte „{n}“ wird zweimal übernommen")),
            Spaltenfehler::EnthaeltAufgaben(n, z) => Fehler::Konflikt(format!("Spalte „{n}“ enthält {} — erst leeren", aufgaben_anzahl(z))),
            Spaltenfehler::FarbeUngueltig(f) => Fehler::Ungueltig(format!("Farbe „{f}“ ist kein #rrggbb")),
            Spaltenfehler::EigentuemerUngueltig(e) => Fehler::Ungueltig(format!("Eigentümer „{e}“ ist nicht human, agent oder null")),
        })?;
        let text = self.board_text(&b, None)?;
        zugregeln::einstellungen_pruefen(wer.art, &einstellungsaenderungen(&vorher, &b, &text, neu))?;
        if geaendert {
            self.aktion(wer, &format!("Spalten von „{}“ geändert", b.titel), &[Schritt::schreiben(board_pfad(&b.slug), text)])?;
        }
        Ok(geaendert)
    }
}

/// „1 Aufgabe“ bei genau einer, sonst „n Aufgaben“ (R00009, Karte #22).
fn aufgaben_anzahl(z: usize) -> String {
    if z == 1 {
        "1 Aufgabe".into()
    } else {
        format!("{z} Aufgaben")
    }
}

/// Verglichen wird, was aus dem zu schreibenden `text` zurückgelesen wird, nicht das Board im Speicher: geht beim
/// Schreiben eine Grenze oder ein Eigentümer verloren (ein Name, den `limits`/`column-owner` nicht wiederfinden), ist das
/// eine Änderung. Liest sich der Text nicht zurück, gilt jede bisherige Einstellung als entfernt.
fn einstellungsaenderungen(vorher: &Board, nachher: &Board, text: &str, neu: &[SpaltenAenderung]) -> Einstellungsaenderungen {
    let gelesen = board::lesen(&nachher.slug, text).unwrap_or_else(|_| Board { spalten: vec![], ..nachher.clone() });
    vorher.einstellungsaenderungen(&gelesen, neu)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::Einstellung;

    const AUSGANG: &str = "---\nlimits:\n  In Arbeit: 2\ncolumn-owner:\n  Eingang: human\n---\n\n# Entwicklung\n\n## Eingang\n\n## In Arbeit\n\n## Erledigt\n";

    fn aend(name: &str, alt: &str) -> SpaltenAenderung {
        SpaltenAenderung { name: name.into(), alt: Some(alt.into()), grenze: None, pruefungen: None, notiz: None, farbe: None, eigentuemer: None }
    }

    fn geaendert(text: &str, neu: &[SpaltenAenderung]) -> Vec<(String, Einstellung)> {
        let vorher = board::lesen("entwicklung", AUSGANG).unwrap();
        let mut nachher = vorher.clone();
        nachher.spalten_setzen(neu).unwrap();
        einstellungsaenderungen(&vorher, &nachher, text, neu).0.into_iter().map(|a| (a.spalte, a.einstellung)).collect()
    }

    fn drei() -> [SpaltenAenderung; 3] {
        [aend("Eingang", "Eingang"), aend("In Arbeit", "In Arbeit"), aend("Erledigt", "Erledigt")]
    }

    #[test]
    fn verglichen_wird_was_zurueckgelesen_wird() {
        assert_eq!(geaendert(AUSGANG, &drei()), [], "Rundlauf stabil: nichts geändert");
        let ohne_limits = AUSGANG.replace("limits:\n  In Arbeit: 2\n", "");
        assert_eq!(geaendert(&ohne_limits, &drei()), [("In Arbeit".into(), Einstellung::Grenze)], "Grenze beim Schreiben verloren");
    }

    #[test]
    fn namen_ohne_rundlauf_sind_nie_still_ohne_aenderung() {
        let vorher = board::lesen("entwicklung", AUSGANG).unwrap();
        // R00128 N2: ein Name mit Zeilenumbruch wird jetzt schon von `spalten_setzen` abgewiesen
        // (`Spaltenfehler::NameUngueltig`, Integrationstest tests/spalten.rs) — hier bleiben die Namen,
        // die die Prüfung passieren, im Rundlauf aber nicht wieder ankommen.
        for name in ["0x10", "0o17", "0b101"] {
            for (i, spalte) in [(1, "In Arbeit"), (0, "Eingang")] {
                let mut neu = drei().to_vec();
                neu[i] = aend(name, spalte);
                let mut nachher = vorher.clone();
                nachher.spalten_setzen(&neu).unwrap();
                let text = board::schreiben(&nachher, |_| None);
                assert!(!einstellungsaenderungen(&vorher, &nachher, &text, &neu).0.is_empty(), "{spalte} → {name:?}");
            }
        }
    }

    #[test]
    fn nicht_lesbar_gilt_als_entfernt_und_was_nur_die_datei_kennt_zaehlt_mit() {
        let entfernt = [("Eingang".to_string(), Einstellung::Eigentuemer), ("In Arbeit".to_string(), Einstellung::Grenze)];
        assert_eq!(geaendert("---\nlimits: [\n---\n", &drei()), entfernt, "nicht lesbar");
        let untergeschoben = AUSGANG.replace("limits:\n", "limits:\n  Neu: 3\n").replace("## Erledigt\n", "## Erledigt\n\n## Neu\n");
        assert_eq!(geaendert(&untergeschoben, &drei()), [("Neu".to_string(), Einstellung::Grenze)], "Spalte nur in der Datei");
    }
}
