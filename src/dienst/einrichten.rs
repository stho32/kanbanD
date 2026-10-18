use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::{board, einstellungen};
use crate::modell::{Art, Board, Einstellungen, Person, Quellen, Spalte, kuerzel_gueltig, slug};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct NeuePerson {
    pub kuerzel: String,
    pub name: String,
}

/// Was die Einrichtungsseite schickt.
#[derive(Debug, Clone, Deserialize)]
pub struct Einrichtung {
    pub ich: NeuePerson,
    #[serde(default)]
    pub agenten: Vec<NeuePerson>,
    pub board: String,
    pub spalten: Vec<String>,
    #[serde(default)]
    pub quellen: Quellen,
}

impl Einrichtung {
    pub fn pruefen(&self) -> Result<(), Fehler> {
        let mut kuerzel = vec![];
        for p in std::iter::once(&self.ich).chain(&self.agenten) {
            if !kuerzel_gueltig(&p.kuerzel) {
                return Err(Fehler::Ungueltig(format!("Kürzel „{}“: 1–8 Kleinbuchstaben oder Ziffern", p.kuerzel)));
            }
            if p.name.trim().is_empty() {
                return Err(Fehler::Ungueltig(format!("Für „{}“ fehlt der Name", p.kuerzel)));
            }
            if kuerzel.contains(&p.kuerzel) {
                return Err(Fehler::Ungueltig(format!("Kürzel „{}“ ist doppelt", p.kuerzel)));
            }
            kuerzel.push(p.kuerzel.clone());
        }
        boardname_pruefen(&self.board)?;
        spalten_pruefen(&self.spalten)
    }

    fn ich(&self) -> Person {
        Person { kuerzel: self.ich.kuerzel.clone(), name: self.ich.name.trim().into(), art: Art::Mensch, aktiv: true }
    }

    fn einstellungen(&self) -> Einstellungen {
        let agenten = self.agenten.iter().map(|a| Person { kuerzel: a.kuerzel.clone(), name: a.name.trim().into(), art: Art::Agent, aktiv: true });
        Einstellungen {
            personen: std::iter::once(self.ich()).chain(agenten).collect(),
            klassen: vec![],
            quellen: Quellen { wbs: self.quellen.wbs.trim().into(), anforderungen: self.quellen.anforderungen.trim().into(), anwendungen: vec![] },
        }
    }

    fn board(&self) -> Board {
        Board {
            slug: slug(&self.board),
            titel: self.board.trim().into(),
            spalten: self.spalten.iter().map(|s| Spalte { name: s.trim().into(), grenze: None, aufgaben: vec![], phase: None, pruefungen: vec![] }).collect(),
            termine: vec![],
            anwendungen: None,
        }
    }
}

pub(crate) fn boardname_pruefen(titel: &str) -> Result<(), Fehler> {
    if slug(titel).is_empty() {
        return Err(Fehler::Ungueltig("Das Board braucht einen Namen aus Buchstaben oder Ziffern".into()));
    }
    Ok(())
}

pub(crate) fn spalten_pruefen(spalten: &[String]) -> Result<(), Fehler> {
    let spalten: Vec<&str> = spalten.iter().map(|s| s.trim()).collect();
    if spalten.is_empty() || spalten.iter().any(|s| s.is_empty()) {
        return Err(Fehler::Ungueltig("Mindestens eine Spalte, keine ohne Namen".into()));
    }
    if let Some(d) = spalten.iter().enumerate().find(|(i, s)| spalten[..*i].contains(s)) {
        return Err(Fehler::Ungueltig(format!("Spalte „{}“ ist doppelt", d.1)));
    }
    Ok(())
}

impl Kanban {
    /// Legt `kanbanD.md` und das erste Board an — ein Commit unter dem Namen von „ich“.
    pub fn einrichten(&self, e: &Einrichtung) -> Result<String, Fehler> {
        e.pruefen()?;
        let _sperre = self.gesperrt();
        if self.ordner().existiert(einstellungen::DATEI) {
            return Err(Fehler::Konflikt("Der Ordner ist bereits eingerichtet".into()));
        }
        let b = e.board();
        let dateien = vec![
            (einstellungen::DATEI.to_string(), einstellungen::schreiben(&e.einstellungen())),
            (board_pfad(&b.slug), board::schreiben(&b, |_| None)),
        ];
        self.aktion(&e.ich(), &format!("kanbanD eingerichtet: Board „{}“", b.titel), &dateien)?;
        Ok(b.slug)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gut() -> Einrichtung {
        Einrichtung {
            ich: NeuePerson { kuerzel: "st".into(), name: "Stefan".into() },
            agenten: vec![NeuePerson { kuerzel: "cl".into(), name: "Claude".into() }],
            board: "Entwicklung".into(),
            spalten: vec!["Zu erledigen".into(), "In Arbeit".into(), "Erledigt".into()],
            quellen: Quellen::default(),
        }
    }

    #[test]
    fn gueltige_einrichtung_ergibt_einstellungen_und_board() {
        let e = gut();
        assert!(e.pruefen().is_ok());
        let s = e.einstellungen();
        assert_eq!(s.personen.len(), 2);
        assert_eq!(s.personen[1].art, Art::Agent);
        assert_eq!(e.board().slug, "entwicklung");
        assert_eq!(e.board().spalten.len(), 3);
    }

    #[test]
    fn falsche_angaben_werden_benannt() {
        let mut e = gut();
        e.ich.kuerzel = "St!".into();
        assert!(e.pruefen().unwrap_err().meldung().contains("St!"));
        let mut e = gut();
        e.ich.name = " ".into();
        assert!(e.pruefen().unwrap_err().meldung().contains("Name"));
        let mut e = gut();
        e.agenten[0].kuerzel = "st".into();
        assert!(e.pruefen().unwrap_err().meldung().contains("doppelt"));
        let mut e = gut();
        e.spalten = vec![];
        assert!(e.pruefen().is_err());
        let mut e = gut();
        e.spalten.push("In Arbeit ".into());
        assert!(e.pruefen().unwrap_err().meldung().contains("In Arbeit"));
        let mut e = gut();
        e.board = "!!".into();
        assert!(e.pruefen().is_err());
    }
}
