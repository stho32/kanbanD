use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Teilaufgabe {
    pub text: String,
    pub erledigt: bool,
}

/// Eine Zeile im Block `kanbanD-time`. Zeitpunkte als `JJJJ-MM-TT HH:MM` in Ortszeit; ohne Ende läuft sie.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Zeiteintrag {
    pub wer: String,
    pub beginn: String,
    pub ende: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Kommentar {
    pub wer: String,
    pub zeitpunkt: String,
    pub text: String,
}

/// Eine Aufgabe: unabhängige Datei, weiß nichts von Boards.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Aufgabe {
    pub nummer: u32,
    /// Dateiname unter `aufgaben/`, z. B. `0012-kopfzeile.md`.
    pub datei: String,
    pub titel: String,
    pub klasse: Option<String>,
    pub zustaendige: Vec<String>,
    pub labels: Vec<String>,
    pub faellig: Option<String>,
    pub herkunft: Vec<String>,
    pub archiviert: Option<String>,
    pub beschreibung: String,
    pub teilaufgaben: Vec<Teilaufgabe>,
    pub zeiten: Vec<Zeiteintrag>,
    pub kommentare: Vec<Kommentar>,
    /// Frontmatter-Schlüssel, die kanbanD nicht kennt — bleiben beim Schreiben erhalten.
    #[serde(skip)]
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

impl Aufgabe {
    pub fn neu(nummer: u32, datei: String, titel: String) -> Aufgabe {
        Aufgabe {
            nummer,
            datei,
            titel,
            klasse: None,
            zustaendige: vec![],
            labels: vec![],
            faellig: None,
            herkunft: vec![],
            archiviert: None,
            beschreibung: String::new(),
            teilaufgaben: vec![],
            zeiten: vec![],
            kommentare: vec![],
            weitere: vec![],
        }
    }

    /// Der Ordner der Anhänge: Dateiname ohne `.md`.
    pub fn anhangordner(&self) -> &str {
        self.datei.strip_suffix(".md").unwrap_or(&self.datei)
    }
}
