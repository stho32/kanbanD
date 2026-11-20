//! Die Anwendungsfälle: prüfen, Dateien schreiben, committen — unter einer Schreibsperre.

mod anhaenge;
mod anwendungen;
mod archiv;
mod aufgabenfilter;
mod berichtsfilter;
mod braucht;
mod bestand;
mod aufgabe_aendern;
mod aufgabe_anlegen;
mod bewegen;
mod bindung;
mod commits;
mod commits_lesen;
pub use commits_lesen::GESAMTGRENZE;
pub mod antwortbudget;
pub mod diff;
mod gesamt_diff;
pub use gesamt_diff::Gesamtdiff;
mod zweigcache;
mod lesegrenze;
mod board_anlegen;
mod board_verwalten;
mod durchlaeufe;
mod einrichten;
mod einstellungen;
mod erledigen;
mod fieber;
mod klassen;
mod kommentare;
mod kosteneintraege;
mod phasen;
mod reservierung;
mod signale;
mod spalten;
mod teilaufgaben;
mod termine;
mod timer;
mod verlauf;
mod wbs;
mod wirkungen;
mod zeiten;
mod zugregeln;
mod zuordnung;

pub use anhaenge::{Anhang, anhangname_bereinigen, freier_name};
pub use anwendungen::{Einstellungsantwort, Erreichbar, Quellenantwort, Registereintrag, RepositoryErreichbar};
pub use aufgabenfilter::{Archivierte, Aufgabenfilter};
pub use durchlaeufe::NeuerDurchlauf;
pub use reservierung::{Gezogen, Zug, erste_freie, instanz_pruefen};
pub use aufgabe_anlegen::{Angelegt, NeueAufgabe, NeueAufgaben, Zielort};
pub use bewegen::{Bewegt, Bewegung};
pub use phasen::{BoardMitPhasen, Phasenstand};
pub use teilaufgaben::Teilaufgabenaenderung;
pub use wbs::{WbsGeaendert, WbsNeu, WbsSicht, WbsZeile};
pub use wirkungen::{WirkungEingabe, Wirkungsstand};
pub use zeiten::{Zeitkorrektur, Zeitnachtrag};
pub use commits::{Commitangaben, Ersetzungsangaben, Ersetzungspaar, Ersetzungsplan, HOECHSTZAHL_COMMITS};
pub use kosteneintraege::{HOECHSTZAHL_KOSTENEINTRAEGE, Kosteneintragsangaben};
pub use board_anlegen::{NeuesBoard, STANDARDSPALTEN};
pub use board_verwalten::BoardVerwalten;
pub use einrichten::{Einrichtung, NeuePerson};
pub use erledigen::{Erledigt, Erledigung, Erledigungsergebnis};
pub use einstellungen::{PALETTE, PersonAenderung, Personenangabe, farbe_gueltig};

use crate::ablage::{DefekteDatei, Ordner};
use crate::fehler::Fehler;
use crate::git;
use crate::waechter::Eigene;
use crate::format::board;
use crate::modell::{Aufgabe, Board, Einstellungen, Person};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub struct Kanban {
    ordner: Ordner,
    sperre: Mutex<()>,
    /// je WBS-Datei im Arbeits-Repository eine eigene Sperre — getrennt von der des Ordners
    wbs_sperren: Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>,
    eigene: Eigene,
    /// Startsekunde je laufendem Timer (Aufgabe, Kürzel) — die Datei kennt nur Minuten (R00068)
    timer_beginn: Mutex<HashMap<(u32, String), std::time::Instant>>,
    /// flüchtiger Cache der Zweiglisten je Arbeits-Repository (R00204, ADR-0032 N1.3); nie während eines Git-Prozesses gesperrt
    zweigcache: Mutex<zweigcache::Zweigcache>,
    /// höchstens 4 Lesevorgänge in Arbeits-Repositories gleichzeitig (Nacharbeit #211, Security Muss 3)
    lesegrenze: lesegrenze::Lesegrenze,
    /// Platz aller Antworten 200 von `GET …/diff`, bis der Client sie gelesen hat (ADR-0032 N5.1)
    antwortbudget: antwortbudget::Antwortbudget,
    /// Bytegrenze des Namenslaufs im Gesamt-Diff (R00208, ADR-0032 N6.8); Tests verkleinern sie (AK 4)
    grenze_namen: usize,
    /// Testnaht (R00206 B1015): läuft einmal direkt nach dem Belegen des Antwortbudgets, mit der Zahl belegter Plätze der
    /// Lesegrenze
    #[cfg(test)]
    nach_dem_belegen: Mutex<Option<Box<dyn FnOnce(usize) + Send>>>,
    /// Testnaht (R00204 B1001): läuft einmal zwischen Zweigliste und zweiter Fingerabdruck-Probe
    #[cfg(test)]
    vor_der_probe: Mutex<Option<Box<dyn FnOnce() + Send>>>,
    /// Testnaht (R00098 B0319): läuft beim Anlegen einmal zwischen Suche und Schreiben, unter der Sperre
    #[cfg(test)]
    zwischen_suche_und_schreiben: Mutex<Option<Box<dyn FnOnce() + Send>>>,
    /// Testnaht (R00118 B0538): läuft beim Ziehen einmal zwischen Grenzprüfung und `aktion()`, unter der Sperre
    #[cfg(test)]
    zwischen_grenzpruefung_und_aktion: Mutex<Option<Box<dyn FnOnce() + Send>>>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct BoardKopf {
    pub slug: String,
    pub titel: String,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct Zustand {
    pub ordner: String,
    pub eingerichtet: bool,
    pub einstellungen: Option<Einstellungen>,
    pub boards: Vec<BoardKopf>,
    pub defekte: Vec<DefekteDatei>,
    /// R00098: Schlüssel, die mehrere Karten tragen — wie doppelte Nummern unter `defekte`
    pub dubletten: Vec<crate::modell::Dublette>,
}

/// Ein Schritt einer [`Kanban::aktion`] (R00141, ADR-0024): eine Datei **schreiben** oder **entfernen**. Der Entfernen-
/// Schritt ersetzt den bisher eigenen Löschweg `entfernen()` — **ein** Weg, **ein** Commit (ADR-0005).
pub(crate) enum Schritt {
    Schreiben { pfad: String, text: String },
    Entfernen { pfad: String },
}

impl Schritt {
    /// Eine Datei mit `text` schreiben.
    pub(crate) fn schreiben(pfad: impl Into<String>, text: impl Into<String>) -> Schritt {
        Schritt::Schreiben { pfad: pfad.into(), text: text.into() }
    }

    /// Eine Datei entfernen; ein fehlender Pfad zählt in `aktion` nicht.
    pub(crate) fn entfernen(pfad: impl Into<String>) -> Schritt {
        Schritt::Entfernen { pfad: pfad.into() }
    }

    fn pfad(&self) -> &str {
        match self {
            Schritt::Schreiben { pfad, .. } | Schritt::Entfernen { pfad } => pfad,
        }
    }
}

impl Kanban {
    pub fn neu(wurzel: PathBuf) -> Kanban {
        Kanban { ordner: Ordner::neu(wurzel), sperre: Mutex::new(()), wbs_sperren: Mutex::default(), eigene: Eigene::default(), timer_beginn: Mutex::default(), zweigcache: Mutex::default(), lesegrenze: lesegrenze::Lesegrenze::default(), antwortbudget: antwortbudget::Antwortbudget::default(), grenze_namen: crate::modell::GRENZE_NAMEN,
            #[cfg(test)]
            nach_dem_belegen: Mutex::default(),
            #[cfg(test)]
            vor_der_probe: Mutex::default(),
            #[cfg(test)]
            zwischen_suche_und_schreiben: Mutex::default(),
            #[cfg(test)]
            zwischen_grenzpruefung_und_aktion: Mutex::default(),
        }
    }

    pub fn ordner(&self) -> &Ordner {
        &self.ordner
    }

    /// Was kanbanD selbst geschrieben hat — der Wächter unterscheidet so eigene von externen Änderungen.
    pub fn eigene(&self) -> Eigene {
        self.eigene.clone()
    }

    pub fn zustand(&self) -> Result<Zustand, Fehler> {
        let mut defekte = vec![];
        let einstellungen = match self.ordner.einstellungen() {
            // die Antwortform des Registers: `repository` als Startordner (ADR-0034 N2 Regel 2) — gelesen, nicht geschrieben
            Ok(e) => e.map(|mut e| {
                e.repository_ergaenzen();
                e
            }),
            Err(Fehler::Defekt(f)) => {
                defekte.push(DefekteDatei::neu(crate::format::einstellungen::DATEI, f));
                None
            }
            Err(f) => return Err(f),
        };
        let (boards, defekte_boards) = self.ordner.boards()?;
        defekte.extend(defekte_boards);
        let (aufgaben, defekte_aufgaben) = self.ordner.aufgaben()?;
        defekte.extend(defekte_aufgaben);
        Ok(Zustand {
            ordner: self.ordner.wurzel().to_string_lossy().into(),
            eingerichtet: self.ordner.existiert(crate::format::einstellungen::DATEI),
            einstellungen,
            boards: boards.into_iter().filter(|b| b.archiviert.is_none()).map(|b| BoardKopf { slug: b.slug, titel: b.titel }).collect(),
            defekte,
            dubletten: crate::modell::doppelte_schluessel(&aufgaben),
        })
    }

    /// Die handelnde Person zum Kürzel aus `X-KanbanD-Wer`: eingetragen und aktiv.
    pub fn handelnder(&self, kuerzel: Option<&str>) -> Result<Person, Fehler> {
        let kuerzel = kuerzel.map(str::trim).filter(|k| !k.is_empty()).ok_or_else(|| Fehler::Ungueltig("Wer handelt? Header X-KanbanD-Wer fehlt".into()))?;
        let e = self.ordner.einstellungen()?.ok_or_else(|| Fehler::Konflikt("Der Ordner ist noch nicht eingerichtet".into()))?;
        let p = e.person(kuerzel).ok_or_else(|| Fehler::Ungueltig(format!("Person „{kuerzel}“ steht nicht in kanbanD.md")))?;
        if !p.aktiv {
            return Err(Fehler::Ungueltig(format!("Person „{kuerzel}“ ist stillgelegt")));
        }
        Ok(p.clone())
    }

    pub(crate) fn eigene_merken(&self, rel: &str) {
        self.eigene.merken(rel);
    }

    pub(crate) fn committen(&self, wer: &Person, nachricht: &str, pfade: &[String]) -> Result<(), Fehler> {
        git::committen(self.ordner.wurzel(), pfade, wer, nachricht)?;
        Ok(())
    }

    /// Führt die Schritte einer Aktion aus und committet sie als **eine** Aktion (ADR-0005, ADR-0024). Jeder Schritt
    /// **schreibt** oder **entfernt** eine Datei; vor dem ersten Schritt prüft sie alle Pfade beider Arten (ADR-0008,
    /// zweite Linie): ein Pfad außerhalb des Ordners oder doppelt ⇒ `Fehler::Intern`, ohne dass etwas geschrieben oder
    /// entfernt ist. Ein Entfernen-Schritt auf einen fehlenden Pfad zählt nicht. Ändert sich nichts, entsteht kein Commit.
    fn aktion(&self, autor: &Person, nachricht: &str, schritte: &[Schritt]) -> Result<(), Fehler> {
        let alle: Vec<&str> = schritte.iter().map(Schritt::pfad).collect();
        crate::ablage::pfade_pruefen(&alle).map_err(|grund| Fehler::Intern(format!("Programmfehler, nichts geschrieben oder entfernt: {grund}")))?;
        let mut geaendert = vec![];
        for schritt in schritte {
            match schritt {
                Schritt::Schreiben { pfad, text } => {
                    self.eigene.merken(pfad);
                    self.ordner.schreib(pfad, text)?;
                    geaendert.push(pfad.clone());
                }
                Schritt::Entfernen { pfad } => {
                    if self.ordner().existiert(pfad) {
                        self.eigene_merken(pfad);
                        std::fs::remove_file(self.ordner().wurzel().join(pfad))?;
                        geaendert.push(pfad.clone());
                    }
                }
            }
        }
        git::committen(self.ordner.wurzel(), &geaendert, autor, nachricht)?;
        Ok(())
    }

    /// Text der Board-Datei; die Links zeigen auf die Dateinamen der Aufgaben (`neu` ist noch nicht auf der Platte).
    fn board_text(&self, b: &Board, neu: Option<&Aufgabe>) -> Result<String, Fehler> {
        let (aufgaben, _) = self.ordner.aufgaben()?;
        Ok(board::schreiben(b, |nr| {
            neu.filter(|a| a.nummer == nr).or_else(|| aufgaben.iter().find(|a| a.nummer == nr)).map(|a| a.datei.clone())
        }))
    }

    fn gesperrt(&self) -> std::sync::MutexGuard<'_, ()> {
        self.sperre.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// Eingangstür der Sammel-Wege (B0344): eine Nummer zweimal in einer Anfrage ist ungültige Eingabe (400) —
/// geprüft, bevor gelesen oder geschrieben wird, damit sie nie die zweite Linie in `aktion` erreicht.
pub(crate) fn ohne_doppelte(nummern: impl IntoIterator<Item = u32>) -> Result<(), Fehler> {
    let mut gesehen = std::collections::HashSet::new();
    match nummern.into_iter().find(|n| !gesehen.insert(*n)) {
        Some(n) => Err(Fehler::Ungueltig(format!("#{n} doppelt in der Anfrage — jede Aufgabe höchstens einmal"))),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::{Kanban, Schritt};
    use crate::fehler::Fehler;
    use std::path::Path;
    use std::process::Command;

    fn git(pfad: &Path, args: &[&str]) -> String {
        let aus = Command::new("git").args(args).current_dir(pfad).output().unwrap();
        String::from_utf8_lossy(&aus.stdout).trim().to_string()
    }

    // B0342/B0635: aktion() prüft alle Pfade **beider Arten** (Schreiben und Entfernen) vor dem ersten Schritt (ADR-0008 Option D)
    #[test]
    fn aktion_bricht_vor_dem_ersten_schreiben_ab() {
        let eltern = tempfile::tempdir().unwrap();
        let w = eltern.path().join("w");
        std::fs::create_dir_all(w.join("aufgaben/0001-a")).unwrap();
        std::fs::write(w.join("kanbanD.md"), "---\npeople:\n  cl: {name: Claude, kind: agent}\n---\n").unwrap();
        std::fs::write(w.join("aufgaben/0001-a.md"), "---\nid: 1\ntitle: a\n---\n").unwrap();
        std::fs::write(w.join("aufgaben/0001-a/bild.png"), "png").unwrap();
        git(&w, &["init", "-q"]);
        git(&w, &["add", "-A"]);
        git(&w, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "a"]);
        let k = Kanban::neu(w.clone());
        let cl = k.handelnder(Some("cl")).unwrap();
        let vorher = (git(&w, &["rev-list", "--count", "HEAD"]), std::fs::read(w.join("aufgaben/0001-a.md")).unwrap());
        let absolut = eltern.path().join("abs.md").to_string_lossy().into_owned();
        for zweiter in ["../x.md", absolut.as_str(), "aufgaben/x\0.md", "aufgaben/0001-a.md"] {
            // Schreiben: eine Datei überschreiben, dazu ein ungültiger Pfad — nichts wird geschrieben
            let schreiben = [Schritt::schreiben("aufgaben/0001-a.md", "überschrieben"), Schritt::schreiben(zweiter, "x")];
            let e = k.aktion(&cl, "Probe", &schreiben);
            assert!(matches!(e, Err(Fehler::Intern(_))), "Schreiben {zweiter:?}: {e:?}");
            assert_eq!((git(&w, &["rev-list", "--count", "HEAD"]), std::fs::read(w.join("aufgaben/0001-a.md")).unwrap()), vorher, "Schreiben {zweiter:?}: nichts geschrieben, kein Commit");
            // Entfernen: eine Datei entfernen, dazu ein ungültiger Pfad — nichts wird entfernt
            let entfernen = [Schritt::entfernen("aufgaben/0001-a.md"), Schritt::entfernen(zweiter)];
            let e = k.aktion(&cl, "Probe", &entfernen);
            assert!(matches!(e, Err(Fehler::Intern(_))), "Entfernen {zweiter:?}: {e:?}");
            assert!(w.join("aufgaben/0001-a.md").exists(), "Entfernen {zweiter:?}: die Datei ist noch da");
            assert_eq!(git(&w, &["rev-list", "--count", "HEAD"]), vorher.0.to_string(), "Entfernen {zweiter:?}: kein Commit");
        }
        assert!(!eltern.path().join("x.md").exists() && !eltern.path().join("abs.md").exists(), "nichts neben dem Ordner");
        assert!(w.join("aufgaben/0001-a/bild.png").exists(), "der Anhang bleibt");
        assert_eq!(git(&w, &["status", "--porcelain"]), "");
    }

    #[test]
    fn ohne_doppelte_nennt_die_erste_doppelte_nummer() {
        assert!(super::ohne_doppelte([1, 2, 3]).is_ok());
        let e = super::ohne_doppelte([1, 2, 1, 2]).unwrap_err();
        assert!(matches!(&e, Fehler::Ungueltig(m) if m.contains("#1 doppelt")), "{e:?}");
    }
}
