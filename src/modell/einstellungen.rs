use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Art {
    #[serde(rename = "human")]
    Mensch,
    #[serde(rename = "agent")]
    Agent,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Person {
    pub kuerzel: String,
    pub name: String,
    pub art: Art,
    pub aktiv: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Klasse {
    pub schluessel: String,
    pub bezeichnung: String,
    pub farbe: String,
}

/// Ein Signal (R00076): hebt eine Aufgabe hervor; `bezeichnung` ist seine Bedeutung („Neue E-Mail“).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Signal {
    pub schluessel: String,
    pub bezeichnung: String,
    pub farbe: String,
}

/// Der Schlüssel des gerechneten Standardsignals „fällig“ — nicht einrichtbar, nicht setzbar.
pub const SIGNAL_FAELLIG: &str = "due";

/// Eine registrierte Anwendung: ihr Arbeits-Repository mit WBS und Anforderungen, angesprochen über das Kürzel.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Anwendung {
    pub kuerzel: String,
    pub name: String,
    pub wbs: String,
    pub anforderungen: String,
}

/// `sources`: `wbs`/`requirements` sind die Standardanwendung ohne Kürzel, `applications` das Register.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Quellen {
    pub wbs: String,
    pub anforderungen: String,
    #[serde(default)]
    pub anwendungen: Vec<Anwendung>,
}

/// Inhalt von `kanbanD.md`: gilt für den ganzen Ordner.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Einstellungen {
    pub personen: Vec<Person>,
    pub klassen: Vec<Klasse>,
    #[serde(default)]
    pub signale: Vec<Signal>,
    pub quellen: Quellen,
}

impl Einstellungen {
    pub fn person(&self, kuerzel: &str) -> Option<&Person> {
        self.personen.iter().find(|p| p.kuerzel == kuerzel)
    }

    pub fn signal(&self, schluessel: &str) -> Option<&Signal> {
        self.signale.iter().find(|s| s.schluessel == schluessel)
    }
}

/// Der Startordner einer Anwendung (ADR-0034 Regel 1, N1): `repository`, wenn es nach dem Trimmen nicht leer ist; sonst der
/// Ordner von `wbs` (ohne Ordneranteil `.`), sonst `requirements`, sonst keiner. Nur Text — kein Dateizugriff, und ein gesetztes,
/// aber unerreichbares `repository` fällt nie zurück.
pub fn startordner(repository: &str, wbs: &str, anforderungen: &str) -> Option<String> {
    let [repository, wbs, anforderungen] = [repository.trim(), wbs.trim(), anforderungen.trim()];
    if !repository.is_empty() {
        return Some(repository.into());
    }
    if !wbs.is_empty() {
        return Some(ordner_von(wbs).into());
    }
    (!anforderungen.is_empty()).then(|| anforderungen.into())
}

/// Der Ordneranteil eines Dateipfads als Text, für beide Trennzeichen: `a/b/c.md` → `a/b`, `/c.md` → `/`, `c.md` → `.`.
/// Dieselbe Regel rechnet die Vorschau der Einstellungsseite (`web/register.js`), damit sie zeigt, was in der Datei steht.
fn ordner_von(datei: &str) -> &str {
    let trenner = |c: char| c == '/' || c == '\\';
    match datei.trim_end_matches(trenner).rfind(trenner) {
        None => ".",
        Some(i) => match datei[..i].trim_end_matches(trenner) {
            "" => &datei[..1],
            ordner => ordner,
        },
    }
}

/// Kürzel aus 1–8 Kleinbuchstaben oder Ziffern.
pub fn kuerzel_gueltig(k: &str) -> bool {
    (1..=8).contains(&k.len()) && k.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// R00209 AK 1: je Zeile der Tabelle `(repository, wbs, requirements)` → Startordner.
    #[test]
    fn startordner_nach_der_tabelle_aus_ak_1() {
        let wbs = "/p/app/Dokumentation/Planung/app.md";
        let zeilen: [(&str, &str, &str, Option<&str>); 12] = [
            ("/p/app", wbs, "/p/app/Anforderungen", Some("/p/app")),
            ("", wbs, "/p/app/Anforderungen", Some("/p/app/Dokumentation/Planung")),
            ("", "", "/p/app/Anforderungen", Some("/p/app/Anforderungen")),
            ("  ", "Dokumentation/Planung/app.md", "", Some("Dokumentation/Planung")),
            ("", "app.md", "", Some(".")),
            ("/p/fehlt", wbs, "", Some("/p/fehlt")),
            ("", "", "", None),
            (" /p/rand ", "", "", Some("/p/rand")),
            ("", "  ", " /p/anf ", Some("/p/anf")),
            ("", "/app.md", "", Some("/")),
            ("", "a//b/c.md", "", Some("a//b")),
            ("", "C:\\p\\plan.md", "", Some("C:\\p")),
        ];
        for (repository, w, anforderungen, erwartet) in zeilen {
            assert_eq!(startordner(repository, w, anforderungen).as_deref(), erwartet, "{repository:?} {w:?} {anforderungen:?}");
        }
    }
}
