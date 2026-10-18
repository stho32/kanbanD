use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Art {
    #[serde(rename = "human")]
    Mensch,
    #[serde(rename = "agent")]
    Agent,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Person {
    pub kuerzel: String,
    pub name: String,
    pub art: Art,
    pub aktiv: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Klasse {
    pub schluessel: String,
    pub bezeichnung: String,
    pub farbe: String,
}

/// Eine registrierte Anwendung: ihr Arbeits-Repository mit WBS und Anforderungen, angesprochen über das Kürzel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Anwendung {
    pub kuerzel: String,
    pub name: String,
    pub wbs: String,
    pub anforderungen: String,
}

/// `sources`: `wbs`/`requirements` sind die Standardanwendung ohne Kürzel, `applications` das Register.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Quellen {
    pub wbs: String,
    pub anforderungen: String,
    #[serde(default)]
    pub anwendungen: Vec<Anwendung>,
}

/// Inhalt von `kanbanD.md`: gilt für den ganzen Ordner.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Einstellungen {
    pub personen: Vec<Person>,
    pub klassen: Vec<Klasse>,
    pub quellen: Quellen,
}

impl Einstellungen {
    pub fn person(&self, kuerzel: &str) -> Option<&Person> {
        self.personen.iter().find(|p| p.kuerzel == kuerzel)
    }

    pub fn klasse(&self, schluessel: &str) -> Option<&Klasse> {
        self.klassen.iter().find(|k| k.schluessel == schluessel)
    }
}

/// Kürzel aus 1–8 Kleinbuchstaben oder Ziffern.
pub fn kuerzel_gueltig(k: &str) -> bool {
    (1..=8).contains(&k.len()) && k.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
}
