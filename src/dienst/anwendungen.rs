use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Einstellungen, Klasse, Person, Quellen, Signal};
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// Absolut bleibt absolut; relativ gilt zum kanbanD-Ordner.
pub(super) fn absolut(wurzel: &Path, pfad: &str) -> PathBuf {
    let p = wurzel.join(pfad);
    p.canonicalize().unwrap_or(p)
}

#[derive(Debug, Serialize, PartialEq, Eq, utoipa::ToSchema)]
pub struct Erreichbar {
    /// der Ordner ist vorhanden (ohne Git-Aufruf, R00209)
    pub repository: bool,
    pub wbs: bool,
    pub anforderungen: bool,
}

/// Eine registrierte Anwendung, wie `GET /api/anwendungen` sie zeigt: `repository` gespeichert oder als Startordner, `wbs`
/// und `anforderungen` wie gespeichert — alle drei immer vorhanden, leer als `""` (ADR-0034 N2 Regel 2).
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct Registereintrag {
    pub name: String,
    pub repository: String,
    pub wbs: String,
    pub anforderungen: String,
    pub erreichbar: Erreichbar,
}

/// Erreichbarkeit des Repositorys der Standardanwendung in `GET /api/einstellungen` (R00209 AK 10).
#[derive(Debug, Serialize, PartialEq, Eq, utoipa::ToSchema)]
pub struct RepositoryErreichbar {
    pub repository: bool,
}

/// `quellen` in `GET /api/einstellungen`: die Quellen in der Form, die `PUT` annimmt, dazu `erreichbar` (PUT überliest es).
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct Quellenantwort {
    #[serde(flatten)]
    pub quellen: Quellen,
    pub erreichbar: RepositoryErreichbar,
}

/// `GET /api/einstellungen` (R00091, R00209): Personen, Klassen, Signale und Quellen in der Form, die `PUT` annimmt;
/// `repository` als Startordner, dazu die Erreichbarkeit des Repositorys der Standardanwendung.
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct Einstellungsantwort {
    pub personen: Vec<Person>,
    pub klassen: Vec<Klasse>,
    pub signale: Vec<Signal>,
    pub quellen: Quellenantwort,
}

/// Ein gesetzter Pfad, der als Ordner bzw. Datei vorhanden ist; relativ gilt zum kanbanD-Ordner.
fn da(wurzel: &Path, pfad: &str) -> bool {
    !pfad.is_empty() && absolut(wurzel, pfad).exists()
}

fn ordner_da(wurzel: &Path, pfad: &str) -> bool {
    !pfad.is_empty() && absolut(wurzel, pfad).is_dir()
}

impl Kanban {
    /// Das Register mit Erreichbarkeit je Pfad; ein fehlender Pfad ist ein Zustand, kein Fehler.
    pub fn anwendungen(&self) -> Result<BTreeMap<String, Registereintrag>, Fehler> {
        let mut e = self.ordner().einstellungen().ok().flatten().unwrap_or_default();
        e.repository_ergaenzen();
        let wurzel = self.ordner().wurzel();
        Ok(e.quellen
            .anwendungen
            .into_iter()
            .map(|a| {
                let erreichbar = Erreichbar { repository: ordner_da(wurzel, &a.repository), wbs: da(wurzel, &a.wbs), anforderungen: da(wurzel, &a.anforderungen) };
                (a.kuerzel, Registereintrag { name: a.name, repository: a.repository, wbs: a.wbs, anforderungen: a.anforderungen, erreichbar })
            })
            .collect())
    }

    /// Die Einstellungen für `GET /api/einstellungen`.
    pub fn einstellungen_antwort(&self) -> Result<Einstellungsantwort, Fehler> {
        let mut e: Einstellungen = self.ordner().einstellungen()?.ok_or_else(|| Fehler::Konflikt("Der Ordner ist noch nicht eingerichtet".into()))?;
        e.repository_ergaenzen();
        let erreichbar = RepositoryErreichbar { repository: ordner_da(self.ordner().wurzel(), &e.quellen.repository) };
        Ok(Einstellungsantwort { personen: e.personen, klassen: e.klassen, signale: e.signale, quellen: Quellenantwort { quellen: e.quellen, erreichbar } })
    }
}
