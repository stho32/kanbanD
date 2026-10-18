//! Die WBS einer Anwendung als Daten und ihre Rechnungen nach Skill `work-breakdown-structure` — rein, ohne Dateizugriff.

use serde::Serialize;

/// Eine Zeile der Knotentabelle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WbsKnoten {
    pub id: String,
    pub ebene: String,
    /// leer bei der Application (`—`)
    pub eltern: String,
    pub name: String,
    /// wie in der Datei gesetzt
    pub status: String,
    pub fertig_kriterium: String,
    pub eingabe_ausgabe: String,
    pub aufwand: String,
    pub ausbaustufe: String,
    pub braucht: Vec<String>,
    pub requirement: String,
    pub notiz: String,
    /// 1-basiert, für den Editor-Link
    pub zeile: usize,
    /// Spalten, die `/planung` nicht kennt (z. B. `Phase`), in Dateireihenfolge — erhalten, nicht gedeutet
    #[serde(skip)]
    pub weitere: Vec<(String, String)>,
}

/// Alle Knoten einer WBS-Datei in Dateireihenfolge.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct WbsTabelle(Vec<WbsKnoten>);

impl WbsTabelle {
    pub fn aus(knoten: Vec<WbsKnoten>) -> WbsTabelle {
        WbsTabelle(knoten)
    }

    pub fn alle(&self) -> &[WbsKnoten] {
        &self.0
    }

    pub fn knoten(&self, id: &str) -> Option<&WbsKnoten> {
        self.0.iter().find(|k| k.id == id)
    }
}
