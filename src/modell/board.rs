use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Spalte {
    pub name: String,
    pub grenze: Option<u32>,
    pub aufgaben: Vec<u32>,
}

/// Inhalt einer Board-Datei: die Struktur und wo jede Aufgabe darin liegt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Board {
    pub slug: String,
    pub titel: String,
    pub spalten: Vec<Spalte>,
}
