use super::Einstellungen;
use chrono::NaiveDate;
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

/// Was eine Änderung setzt; `None` heißt „unverändert“, `Some(None)` bei entfernbaren Feldern „entfernen“.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct Aufgabenaenderung {
    pub titel: Option<String>,
    pub beschreibung: Option<String>,
    #[serde(default, deserialize_with = "entfernbar")]
    pub klasse: Option<Option<String>>,
    pub zustaendige: Option<Vec<String>>,
    pub labels: Option<Vec<String>>,
    #[serde(default, deserialize_with = "entfernbar")]
    pub faellig: Option<Option<String>>,
}

fn entfernbar<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Option<Option<String>>, D::Error> {
    Ok(Some(Option::deserialize(d)?))
}

impl Aufgabe {
    /// Wendet die Änderung an und liefert die Namen der Felder, die sich wirklich geändert haben.
    pub fn aendern(&mut self, a: &Aufgabenaenderung, e: &Einstellungen) -> Result<Vec<&'static str>, String> {
        let mut neu = self.clone();
        if let Some(t) = &a.titel {
            if t.trim().is_empty() {
                return Err("Die Aufgabe braucht einen Titel".into());
            }
            neu.titel = t.trim().into();
        }
        if let Some(b) = &a.beschreibung {
            neu.beschreibung = b.trim().into();
        }
        if let Some(k) = &a.klasse {
            let k = k.as_deref().map(str::trim).filter(|k| !k.is_empty());
            if let Some(k) = k
                && e.klasse(k).is_none()
            {
                return Err(format!("Klasse „{k}“ steht nicht in kanbanD.md"));
            }
            neu.klasse = k.map(Into::into);
        }
        if let Some(z) = &a.zustaendige {
            if let Some(f) = z.iter().find(|k| e.person(k).is_none()) {
                return Err(format!("Person „{f}“ steht nicht in kanbanD.md"));
            }
            neu.zustaendige = z.clone();
            neu.zustaendige.dedup();
        }
        if let Some(l) = &a.labels {
            neu.labels = l.iter().map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect();
        }
        if let Some(f) = &a.faellig {
            let f = f.as_deref().map(str::trim).filter(|f| !f.is_empty());
            if let Some(d) = f
                && NaiveDate::parse_from_str(d, "%Y-%m-%d").is_err()
            {
                return Err(format!("Fälligkeit „{d}“: erwartet JJJJ-MM-TT"));
            }
            neu.faellig = f.map(Into::into);
        }
        let mut felder = vec![];
        for (name, geaendert) in [
            ("Titel", neu.titel != self.titel),
            ("Beschreibung", neu.beschreibung != self.beschreibung),
            ("Klasse", neu.klasse != self.klasse),
            ("Zuständige", neu.zustaendige != self.zustaendige),
            ("Labels", neu.labels != self.labels),
            ("Fälligkeit", neu.faellig != self.faellig),
        ] {
            if geaendert {
                felder.push(name);
            }
        }
        *self = neu;
        Ok(felder)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::{Art, Klasse, Person};

    fn e() -> Einstellungen {
        Einstellungen {
            personen: vec![Person { kuerzel: "st".into(), name: "S".into(), art: Art::Mensch, aktiv: true }],
            klassen: vec![Klasse { schluessel: "bug".into(), bezeichnung: "Fehler".into(), farbe: "red".into() }],
            ..Default::default()
        }
    }

    fn aend(json: &str) -> Aufgabenaenderung {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn felder_aendern_und_benennen() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        let f = a.aendern(&aend(r#"{"titel":" Neu ","klasse":"bug","labels":["ui"," ","daten"],"faellig":"2026-12-24","zustaendige":["st"]}"#), &e()).unwrap();
        assert_eq!(f, vec!["Titel", "Klasse", "Zuständige", "Labels", "Fälligkeit"]);
        assert_eq!((a.titel.as_str(), a.klasse.as_deref(), a.labels.clone(), a.faellig.as_deref()), ("Neu", Some("bug"), vec!["ui".to_string(), "daten".into()], Some("2026-12-24")));
        assert_eq!(a.aendern(&aend(r#"{"titel":"Neu"}"#), &e()).unwrap(), Vec::<&str>::new());
        assert_eq!(a.aendern(&aend(r#"{"klasse":null,"faellig":null,"beschreibung":"b"}"#), &e()).unwrap(), vec!["Beschreibung", "Klasse", "Fälligkeit"]);
        assert!(a.klasse.is_none() && a.faellig.is_none());
        assert_eq!(a.datei, "0001-x.md");
    }

    #[test]
    fn regeln_lassen_die_aufgabe_unveraendert() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        for j in [r#"{"titel":" "}"#, r#"{"klasse":"gibtsnicht"}"#, r#"{"faellig":"24.12."}"#, r#"{"zustaendige":["zz"]}"#] {
            assert!(a.aendern(&aend(j), &e()).is_err(), "{j}");
        }
        assert_eq!(a, Aufgabe::neu(1, "0001-x.md".into(), "x".into()));
        assert!(a.aendern(&aend(r#"{"klasse":"  ","faellig":""}"#), &e()).unwrap().is_empty());
    }
}
