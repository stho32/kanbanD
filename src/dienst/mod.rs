//! Die Anwendungsfälle: prüfen, Dateien schreiben, committen — unter einer Schreibsperre.

mod aufgabe_aendern;
mod aufgabe_anlegen;
mod bewegen;
mod board_anlegen;
mod einrichten;
mod einstellungen;
mod kommentare;
mod spalten;
mod teilaufgaben;
mod timer;
mod zeiten;

pub use aufgabe_anlegen::NeueAufgabe;
pub use bewegen::Bewegung;
pub use teilaufgaben::Teilaufgabenaenderung;
pub use zeiten::Zeitkorrektur;
pub use board_anlegen::{NeuesBoard, STANDARDSPALTEN};
pub use einrichten::{Einrichtung, NeuePerson};
pub use einstellungen::{PALETTE, farbe_gueltig};

use crate::ablage::{DefekteDatei, Ordner};
use crate::fehler::Fehler;
use crate::git;
use crate::waechter::Eigene;
use crate::format::board;
use crate::modell::{Aufgabe, Board, Einstellungen, Person};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Kanban {
    ordner: Ordner,
    sperre: Mutex<()>,
    eigene: Eigene,
}

#[derive(Debug, Serialize)]
pub struct BoardKopf {
    pub slug: String,
    pub titel: String,
}

#[derive(Debug, Serialize)]
pub struct Zustand {
    pub ordner: String,
    pub eingerichtet: bool,
    pub einstellungen: Option<Einstellungen>,
    pub boards: Vec<BoardKopf>,
    pub defekte: Vec<DefekteDatei>,
}

impl Kanban {
    pub fn neu(wurzel: PathBuf) -> Kanban {
        Kanban { ordner: Ordner::neu(wurzel), sperre: Mutex::new(()), eigene: Eigene::default() }
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
            Ok(e) => e,
            Err(Fehler::Defekt(f)) => {
                defekte.push(DefekteDatei { pfad: crate::format::einstellungen::DATEI.into(), fehler: f });
                None
            }
            Err(f) => return Err(f),
        };
        let (boards, defekte_boards) = self.ordner.boards()?;
        defekte.extend(defekte_boards);
        defekte.extend(self.ordner.aufgaben()?.1);
        Ok(Zustand {
            ordner: self.ordner.wurzel().to_string_lossy().into(),
            eingerichtet: self.ordner.existiert(crate::format::einstellungen::DATEI),
            einstellungen,
            boards: boards.into_iter().map(|b| BoardKopf { slug: b.slug, titel: b.titel }).collect(),
            defekte,
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

    /// Schreibt Dateien und committet sie als eine Aktion. Scheitert der Commit, bleibt der
    /// geschriebene Stand stehen und der Fehler wird gemeldet.
    fn aktion(&self, autor: &Person, nachricht: &str, dateien: &[(String, String)]) -> Result<(), Fehler> {
        for (rel, text) in dateien {
            self.eigene.merken(rel);
            self.ordner.schreib(rel, text)?;
        }
        let pfade: Vec<String> = dateien.iter().map(|(p, _)| p.clone()).collect();
        git::committen(self.ordner.wurzel(), &pfade, autor, nachricht)?;
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
