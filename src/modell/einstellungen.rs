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

/// Eine registrierte Anwendung, angesprochen über das Kürzel: ihr Repository (ADR-0034 Regel 1), dazu bis S2 die Pfade zu
/// WBS und Anforderungen, die die Factory und die WBS-Funktionen noch lesen (N2). Jeder Pfad darf fehlen (leer).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Anwendung {
    pub kuerzel: String,
    pub name: String,
    /// Ordner im Arbeits-Repository, absolut oder relativ zum kanbanD-Ordner; leer = Rückfall auf `wbs`/`anforderungen`
    #[serde(default)]
    pub repository: String,
    #[serde(default)]
    pub wbs: String,
    #[serde(default)]
    pub anforderungen: String,
}

impl Anwendung {
    /// Der Startordner der Wurzel nach [`startordner`].
    pub fn startordner(&self) -> Option<String> {
        startordner(&self.repository, &self.wbs, &self.anforderungen)
    }
}

/// `sources`: `repository` (bzw. bis S2 `wbs`/`requirements`) ist die Standardanwendung ohne Kürzel, `applications` das Register.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Quellen {
    #[serde(default)]
    pub repository: String,
    #[serde(default)]
    pub wbs: String,
    #[serde(default)]
    pub anforderungen: String,
    #[serde(default)]
    pub anwendungen: Vec<Anwendung>,
}

impl Quellen {
    /// Der Startordner der Standardanwendung nach [`startordner`].
    pub fn startordner(&self) -> Option<String> {
        startordner(&self.repository, &self.wbs, &self.anforderungen)
    }
}

/// Inhalt von `kanbanD.md`: gilt für den ganzen Ordner.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Einstellungen {
    pub personen: Vec<Person>,
    pub klassen: Vec<Klasse>,
    #[serde(default)]
    pub signale: Vec<Signal>,
    pub quellen: Quellen,
    /// `record-transcripts` als Vorgabe des Ordners (R00216, ADR-0036 Regel 4); `None` = kein Schlüssel. Nur von Hand in
    /// der Datei gesetzt: nicht im JSON, `PUT /api/einstellungen` lässt den gespeicherten Wert stehen.
    #[serde(skip)]
    pub transkripte_erfassen: Option<bool>,
}

impl Einstellungen {
    pub fn person(&self, kuerzel: &str) -> Option<&Person> {
        self.personen.iter().find(|p| p.kuerzel == kuerzel)
    }

    pub fn signal(&self, schluessel: &str) -> Option<&Signal> {
        self.signale.iter().find(|s| s.schluessel == schluessel)
    }

    /// Schreibregel und Antwortform des Registers (ADR-0034 N2 Regel 1, 2): `repository` ist je Anwendung und in den
    /// Quellen der Startordner — das gesetzte Repository, sonst der Rückfall auf `wbs`/`anforderungen`, sonst leer.
    pub fn repository_ergaenzen(&mut self) {
        self.quellen.repository = self.quellen.startordner().unwrap_or_default();
        for a in &mut self.quellen.anwendungen {
            a.repository = a.startordner().unwrap_or_default();
        }
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

    /// N2 Regel 1: `repository` wird ergänzt, `wbs`/`anforderungen` bleiben, wie sie sind; ohne Pfad bleibt es leer.
    #[test]
    fn repository_ergaenzen_je_anwendung_und_in_den_quellen() {
        let a = |k: &str, repository: &str, wbs: &str| Anwendung { kuerzel: k.into(), name: k.into(), repository: repository.into(), wbs: wbs.into(), anforderungen: String::new() };
        let quellen = Quellen { repository: String::new(), wbs: "plan/wbs.md".into(), anforderungen: "anf".into(), anwendungen: vec![a("kd", "", "/r/D/P/kd.md"), a("lc", "/r", "/r/D/P/lc.md"), a("xx", " ", "")] };
        let mut e = Einstellungen { quellen, ..Default::default() };
        e.repository_ergaenzen();
        assert_eq!((e.quellen.repository.as_str(), e.quellen.wbs.as_str(), e.quellen.anforderungen.as_str()), ("plan", "plan/wbs.md", "anf"));
        let r: Vec<(&str, &str)> = e.quellen.anwendungen.iter().map(|a| (a.repository.as_str(), a.wbs.as_str())).collect();
        assert_eq!(r, [("/r/D/P", "/r/D/P/kd.md"), ("/r", "/r/D/P/lc.md"), ("", "")]);
    }

    /// Die heutige Factory schickt `{kuerzel, name, wbs, anforderungen}` ohne `repository`, ein neuer Schreiber nur
    /// `{kuerzel, name, repository}` — beide Formen kommen an (N2 Regel 2).
    #[test]
    fn beide_formen_kommen_an() {
        let alt: Quellen = serde_json::from_str(r#"{"wbs": "w", "anforderungen": "a", "anwendungen": [{"kuerzel": "pa", "name": "P", "wbs": "/r/p.md", "anforderungen": "/r/a"}]}"#).unwrap();
        assert_eq!((alt.repository.as_str(), alt.anwendungen[0].repository.as_str(), alt.anwendungen[0].wbs.as_str()), ("", "", "/r/p.md"));
        let neu: Quellen = serde_json::from_str(r#"{"repository": "/r", "anwendungen": [{"kuerzel": "kd", "name": "K", "repository": "/r"}]}"#).unwrap();
        assert_eq!((neu.wbs.as_str(), neu.anwendungen[0].wbs.as_str(), neu.anwendungen[0].anforderungen.as_str()), ("", "", ""));
    }
}
