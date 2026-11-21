//! Befund erledigt sich (R00099, ADR-0005): ein Sensor meldet über seinen Schlüssel, dass er einen Befund nicht mehr
//! findet. Suche, Prüfung und Schreiben laufen unter einer Sperre und enden in höchstens einem Commit.

use super::{Kanban, Schritt};
use super::aufgabe_anlegen::nummernliste;
use super::kommentare::kommentiert;
use super::signale::signal_geschaltet;
use super::zugregeln::{archivierte, zug_pruefen};
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::{Art, Aufgabe, Board, Einstellungen, Fremdschluessel, Person, Schluesseltreffer, in_letzter_spalte, ist_erledigt, signal_unbekannt};
use crate::pruefungen::Warnung;
use serde::Serialize;

/// Eingabe von `POST /api/aufgaben/erledigen`; fehlende Felder gelten als leer und werden abgewiesen.
#[derive(Debug, Clone, Default, serde::Deserialize, utoipa::ToSchema)]
pub struct Erledigung {
    /// Schlüssel des Befunds (1–200 Zeichen, ohne Zeilenumbruch), nur gelesen
    #[serde(default)]
    pub key: String,
    /// Slug des Boards, auf dem die Karte liegt
    #[serde(default)]
    pub board: String,
    /// Begründung, 1–2000 Zeichen nach dem Trimmen, Zeilenumbruch erlaubt
    #[serde(default)]
    pub text: String,
    /// Schlüssel eines in kanbanD.md eingerichteten Signals — immer geprüft, gesetzt nur beim Melden
    #[serde(default)]
    pub signal: String,
}

/// Eine Erledigung, deren Eingaben Schritt 0 bestanden haben.
#[derive(Debug, PartialEq, Eq)]
pub(super) struct GepruefteErledigung {
    pub schluessel: Fremdschluessel,
    pub board: String,
    pub text: String,
    pub signal: String,
}

const TEXT_HOECHSTENS: usize = 2000;

impl Erledigung {
    /// Schritt 0: alle Eingaben vor jeder Suche (400 vor 404 und 409).
    pub(super) fn pruefen(&self, e: &Einstellungen) -> Result<GepruefteErledigung, Fehler> {
        let schluessel = Fremdschluessel::pruefen(&self.key).map_err(Fehler::Ungueltig)?;
        let text = self.text.trim().replace("\r\n", "\n");
        if !(1..=TEXT_HOECHSTENS).contains(&text.chars().count()) {
            return Err(Fehler::Ungueltig(format!("Text: 1–{TEXT_HOECHSTENS} Zeichen")));
        }
        if e.signal(&self.signal).is_none() {
            return Err(Fehler::Ungueltig(signal_unbekannt(&self.signal)));
        }
        let board = self.board.trim();
        if board.is_empty() {
            return Err(Fehler::Ungueltig("Board fehlt".into()));
        }
        Ok(GepruefteErledigung { schluessel, board: board.to_string(), text, signal: self.signal.clone() })
    }
}

/// Was die Erledigung bewirkt hat.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub enum Erledigungsergebnis {
    #[serde(rename = "erledigt")]
    Erledigt,
    #[serde(rename = "schon erledigt")]
    SchonErledigt,
    #[serde(rename = "gemeldet")]
    Gemeldet,
    #[serde(rename = "schon gemeldet")]
    SchonGemeldet,
}

/// Antwort von `POST /api/aufgaben/erledigen` — jede 200 hat diese Form, `warnungen` wie bei `Gezogen`.
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct Erledigt {
    pub aufgabe: Aufgabe,
    pub ergebnis: Erledigungsergebnis,
    pub warnungen: Vec<Warnung>,
}

impl Kanban {
    /// Befund erledigt sich (R00099): Suche, Lage und Schreiben unter einer Sperre, höchstens ein Commit.
    pub fn erledigen(&self, wer: &Person, e: &Erledigung) -> Result<Erledigt, Fehler> {
        let _sperre = self.gesperrt();
        let g = e.pruefen(&self.ordner().einstellungen()?.unwrap_or_default())?;
        let mut b = self.ordner().board(&g.board)?;
        let (aufgaben, _) = self.ordner().aufgaben()?;
        let nr = match Schluesseltreffer::suchen(&aufgaben, &g.schluessel) {
            Schluesseltreffer::Keiner => return Err(Fehler::NichtGefunden(format!("Schlüssel „{}“ gibt es nicht", g.schluessel.text()))),
            Schluesseltreffer::Mehrfach(nummern) => return Err(Fehler::Konflikt(format!("Schlüssel „{}“ mehrfach vergeben: {}", g.schluessel.text(), nummernliste(nummern.into_iter())))),
            Schluesseltreffer::Offen(nr) | Schluesseltreffer::Archiviert(nr) => nr,
        };
        let archiviert = archivierte(&aufgaben);
        let mut a = aufgaben.into_iter().find(|a| a.nummer == nr).expect("Treffer stammt aus der Liste");
        #[cfg(test)]
        {
            let haken = self.zwischen_suche_und_schreiben.lock().unwrap().take();
            if let Some(haken) = haken {
                haken();
            }
        }
        let fertig = |a: Aufgabe, ergebnis| Ok(Erledigt { aufgabe: a, ergebnis, warnungen: vec![] });
        match lage(&a, &b, wer.art, &g.signal) {
            Erledigungslage::SchonErledigt => fertig(a, Erledigungsergebnis::SchonErledigt),
            Erledigungslage::NichtAufBoard => Err(Fehler::NichtGefunden(format!("#{nr} liegt nicht auf „{}“", b.titel))),
            Erledigungslage::SchonGemeldet => fertig(a, Erledigungsergebnis::SchonGemeldet),
            Erledigungslage::Melden => {
                kommentiert(&mut a, wer, &befund_weg(&g.text));
                signal_geschaltet(&mut a, &g.signal, true);
                let dateien = [Schritt::schreiben(format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(&a))];
                self.aktion(wer, &format!("#{nr} Befund nicht mehr gefunden — gemeldet ({})", crate::nachricht::wert(&b.titel)), &dateien)?;
                fertig(a, Erledigungsergebnis::Gemeldet)
            }
            Erledigungslage::Erledigen { von, nach } => {
                let vorher = b.clone();
                b.oben_einordnen(nr, Some(&nach)).map_err(|_| Fehler::Intern(format!("#{nr} ließ sich nicht nach „{nach}“ legen")))?;
                let warnungen = zug_pruefen(wer.art, &vorher, &b, &archiviert)?;
                kommentiert(&mut a, wer, &befund_weg(&g.text));
                a.reservierung = None;
                let dateien = [Schritt::schreiben(format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(&a)), Schritt::schreiben(board_pfad(&b.slug), self.board_text(&b, None)?)];
                self.aktion(wer, &format!("#{nr} erledigt sich: „{}“ → „{}“ ({})", crate::nachricht::wert(&von), crate::nachricht::wert(&nach), crate::nachricht::wert(&b.titel)), &dateien)?;
                Ok(Erledigt { aufgabe: a, ergebnis: Erledigungsergebnis::Erledigt, warnungen })
            }
        }
    }
}

fn befund_weg(text: &str) -> String {
    format!("Befund nicht mehr gefunden: {text}")
}

/// Was eine Erledigung mit der gefundenen Karte tut (R00099 Ablauf 2–5).
#[derive(Debug, PartialEq, Eq)]
pub(super) enum Erledigungslage {
    SchonErledigt,
    NichtAufBoard,
    SchonGemeldet,
    Melden,
    Erledigen { von: String, nach: String },
}

/// Reine Entscheidung in der Reihenfolge des Ablaufs: archiviert oder in der Abschlussspalte, nicht auf dem Board,
/// Agent in einer Menschen-Spalte (melden statt bewegen), sonst erledigen.
/// „Erledigt“ entscheidet `ist_erledigt` — dieselbe Funktion deutet `braucht:` (R00214, ADR-0035 Pre-Mortem c).
pub(super) fn lage(a: &Aufgabe, b: &Board, art: Art, signal: &str) -> Erledigungslage {
    if ist_erledigt(a, &in_letzter_spalte([b])) {
        return Erledigungslage::SchonErledigt;
    }
    let Some(von) = b.spalte_von(a.nummer).map(|s| s.name.clone()) else {
        return Erledigungslage::NichtAufBoard;
    };
    let abschluss = b.abschlussspalte().map(|s| s.name.as_str());
    if b.entnahme_erlaubt(art, a.nummer).is_err() {
        return if a.signale.iter().any(|s| s == signal) { Erledigungslage::SchonGemeldet } else { Erledigungslage::Melden };
    }
    Erledigungslage::Erledigen { von, nach: abschluss.unwrap_or_default().to_string() }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::Signal;

    fn einstellungen() -> Einstellungen {
        let mut e = Einstellungen::default();
        e.signale.push(Signal { schluessel: "behoben".into(), bezeichnung: "Befund nicht mehr gefunden".into(), farbe: "green".into() });
        e
    }

    fn erledigung(text: &str) -> Erledigung {
        Erledigung { key: "k1".into(), board: "fabrik".into(), text: text.into(), signal: "behoben".into() }
    }

    fn ungueltig(r: Result<GepruefteErledigung, Fehler>) -> String {
        match r {
            Err(Fehler::Ungueltig(m)) => m,
            anders => panic!("400 erwartet, war {anders:?}"),
        }
    }

    // R00099 B0331: Text 1–2000 Zeichen nach dem Trimmen, Zeilenumbruch erlaubt
    #[test]
    fn text_grenzwerte() {
        let g = erledigung(&"x".repeat(2000)).pruefen(&einstellungen()).unwrap();
        assert_eq!(g.text.chars().count(), 2000);
        assert_eq!(ungueltig(erledigung(&"x".repeat(2001)).pruefen(&einstellungen())), "Text: 1–2000 Zeichen");
        for leer in ["", "   ", "\n\t "] {
            assert_eq!(ungueltig(erledigung(leer).pruefen(&einstellungen())), "Text: 1–2000 Zeichen", "{leer:?}");
        }
        let g = erledigung("  zwei\r\nZeilen ").pruefen(&einstellungen()).unwrap();
        assert_eq!(g.text, "zwei\nZeilen");
        assert_eq!(erledigung(&format!(" {} ", "ä".repeat(2000))).pruefen(&einstellungen()).unwrap().text.chars().count(), 2000, "Zeichen, nicht Bytes");
    }

    // R00099 B0331: Signal muss eingerichtet sein, auch wenn es nicht gesetzt würde
    #[test]
    fn signal_eingerichtet() {
        let mut e = erledigung("weg");
        assert_eq!(e.pruefen(&einstellungen()).unwrap().signal, "behoben");
        e.signal = "gibtsnicht".into();
        assert_eq!(ungueltig(e.pruefen(&einstellungen())), "Signal „gibtsnicht“ steht nicht in kanbanD.md");
        e.signal = String::new();
        assert!(matches!(e.pruefen(&einstellungen()), Err(Fehler::Ungueltig(_))));
    }

    // R00099 B0331: key über Fremdschluessel::pruefen, board nicht leer; fehlende Felder sind leer
    #[test]
    fn schluessel_und_board() {
        let g = Erledigung { key: "  k1 ".into(), ..erledigung("weg") }.pruefen(&einstellungen()).unwrap();
        assert_eq!((g.schluessel.text(), g.board.as_str()), ("k1", "fabrik"));
        for key in ["", "   ", "a\nb"] {
            assert_eq!(ungueltig(Erledigung { key: key.into(), ..erledigung("weg") }.pruefen(&einstellungen())), "Schlüssel: 1–200 Zeichen ohne Zeilenumbruch");
        }
        for board in ["", "  "] {
            assert_eq!(ungueltig(Erledigung { board: board.into(), ..erledigung("weg") }.pruefen(&einstellungen())), "Board fehlt");
        }
        let fehlend: Erledigung = serde_json::from_str(r#"{"key": "k1", "text": "weg", "signal": "behoben"}"#).unwrap();
        assert_eq!(ungueltig(fehlend.pruefen(&einstellungen())), "Board fehlt");
    }

    fn fabrik() -> Board {
        crate::format::board::lesen("fabrik", "---\ncolumn-owner:\n  Eingang: human\n---\n\n# Fabrik\n\n## Eingang\n\n- #8\n\n## In Arbeit\n\n- #7\n\n## Fertig\n\n- #3\n").unwrap()
    }

    fn karte(nr: u32) -> Aufgabe {
        Aufgabe::neu(nr, format!("000{nr}-x.md"), "x".into())
    }

    fn erledigen(von: &str) -> Erledigungslage {
        Erledigungslage::Erledigen { von: von.into(), nach: "Fertig".into() }
    }

    // R00099 B0332: Lage je Fall × Mensch/Agent, Reihenfolge wie Ablauf 2–5
    #[test]
    fn lage_je_fall() {
        let b = fabrik();
        let mut archiviert = karte(7);
        archiviert.archiviert = Some("2026-11-05".into());
        let mut nirgends_archiviert = karte(9);
        nirgends_archiviert.archiviert = Some("2026-11-05".into());
        let mut gemeldet = karte(8);
        gemeldet.signale.push("behoben".into());
        for art in [Art::Agent, Art::Mensch] {
            assert_eq!(lage(&archiviert, &b, art, "behoben"), Erledigungslage::SchonErledigt, "{art:?} archiviert");
            assert_eq!(lage(&nirgends_archiviert, &b, art, "behoben"), Erledigungslage::SchonErledigt, "{art:?} archiviert, nicht auf dem Board");
            assert_eq!(lage(&karte(3), &b, art, "behoben"), Erledigungslage::SchonErledigt, "{art:?} in der letzten Spalte");
            assert_eq!(lage(&karte(9), &b, art, "behoben"), Erledigungslage::NichtAufBoard, "{art:?}");
            assert_eq!(lage(&karte(7), &b, art, "behoben"), erledigen("In Arbeit"), "{art:?}");
        }
        assert_eq!(lage(&karte(8), &b, Art::Agent, "behoben"), Erledigungslage::Melden);
        assert_eq!(lage(&gemeldet, &b, Art::Agent, "behoben"), Erledigungslage::SchonGemeldet);
        assert_eq!(lage(&gemeldet, &b, Art::Agent, "anderes"), Erledigungslage::Melden, "nur das genannte Signal zählt");
        assert_eq!(lage(&karte(8), &b, Art::Mensch, "behoben"), erledigen("Eingang"), "Menschen-Spalten sperren nur Agenten");
        assert_eq!(lage(&gemeldet, &b, Art::Mensch, "behoben"), erledigen("Eingang"));
    }

    // R00214 B1084 (ADR-0035 Pre-Mortem c): `erledigen` und das Lesefeld `braucht` teilen „erledigt“ — für jede Karte
    // des Boards und jede, die nicht darauf liegt, archiviert oder nicht, sagen beide dasselbe
    #[test]
    fn lage_und_braucht_teilen_erledigt() {
        let b = fabrik();
        for nr in [3, 7, 8, 9] {
            for archiviert in [false, true] {
                let mut a = karte(nr);
                a.archiviert = archiviert.then(|| "2026-11-01".into());
                let schon = lage(&a, &b, Art::Mensch, "behoben") == Erledigungslage::SchonErledigt;
                assert_eq!(schon, ist_erledigt(&a, &in_letzter_spalte([&b])), "#{nr} archiviert={archiviert}");
            }
        }
    }

    fn git(pfad: &std::path::Path, args: &[&str]) -> String {
        let aus = std::process::Command::new("git").args(args).current_dir(pfad).output().unwrap();
        String::from_utf8_lossy(&aus.stdout).trim().to_string()
    }

    // R00099 B0334 Nebenläufigkeit: zwei Aufrufe gegen dieselbe Karte — die Sperre steht zwischen Suche und Schreiben,
    // der zweite startet genau dort und sieht danach die erledigte Karte; genau ein Commit, ein Kommentar
    #[test]
    fn gleichzeitig_genau_ein_commit() {
        use std::sync::{Arc, mpsc};
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("boards")).unwrap();
        std::fs::create_dir_all(tmp.path().join("aufgaben")).unwrap();
        std::fs::write(tmp.path().join("kanbanD.md"), "---\npeople:\n  bot: {name: Sensor, kind: agent}\nsignals:\n  behoben: {label: weg, color: green}\n---\n").unwrap();
        std::fs::write(tmp.path().join("boards/fabrik.md"), "# fabrik\n\n## In Arbeit\n\n- #7\n\n## Fertig\n").unwrap();
        std::fs::write(tmp.path().join("aufgaben/0007-x.md"), "---\nid: 7\ntitle: x\nkey: k1\n---\n").unwrap();
        git(tmp.path(), &["init", "-q"]);
        git(tmp.path(), &["add", "-A"]);
        git(tmp.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
        let k = Arc::new(Kanban::neu(tmp.path().to_path_buf()));
        let bot = k.handelnder(Some("bot")).unwrap();
        let e = Erledigung { key: "k1".into(), board: "fabrik".into(), text: "weg".into(), signal: "behoben".into() };

        let (zweiter_tx, zweiter_rx) = mpsc::channel();
        let (k2, bot2, e2) = (Arc::clone(&k), bot.clone(), e.clone());
        *k.zwischen_suche_und_schreiben.lock().unwrap() = Some(Box::new(move || {
            let gehalten = matches!(k2.sperre.try_lock(), Err(std::sync::TryLockError::WouldBlock));
            let k3 = Arc::clone(&k2);
            zweiter_tx.send((gehalten, std::thread::spawn(move || k3.erledigen(&bot2, &e2)))).unwrap();
        }));
        let vorher: usize = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();

        let erster = k.erledigen(&bot, &e).unwrap();
        let (gehalten, lauf) = zweiter_rx.recv().unwrap();
        let zweiter = lauf.join().unwrap().unwrap();

        assert!(gehalten, "zwischen Suche und Schreiben ist die Sperre frei");
        assert_eq!((erster.ergebnis, zweiter.ergebnis), (Erledigungsergebnis::Erledigt, Erledigungsergebnis::SchonErledigt));
        assert_eq!(zweiter.aufgabe.kommentare.len(), 1, "ein Kommentar");
        assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<usize>().unwrap(), vorher + 1, "ein Commit");
    }
}
