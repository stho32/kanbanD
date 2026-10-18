use super::Kanban;
use super::herkunft::absolut;
use crate::fehler::Fehler;
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct Erreichbar {
    pub wbs: bool,
    pub anforderungen: bool,
}

/// Eine registrierte Anwendung, wie `GET /api/anwendungen` sie zeigt.
#[derive(Debug, Serialize)]
pub struct Registereintrag {
    pub name: String,
    pub wbs: String,
    pub anforderungen: String,
    pub erreichbar: Erreichbar,
}

impl Kanban {
    /// Das Register mit Erreichbarkeit je Pfad; ein fehlender Pfad ist ein Zustand, kein Fehler.
    pub fn anwendungen(&self) -> Result<BTreeMap<String, Registereintrag>, Fehler> {
        let e = self.ordner().einstellungen().ok().flatten().unwrap_or_default();
        let wurzel = self.ordner().wurzel();
        let da = |pfad: &str| !pfad.is_empty() && absolut(wurzel, pfad).exists();
        Ok(e.quellen
            .anwendungen
            .into_iter()
            .map(|a| {
                let erreichbar = Erreichbar { wbs: da(&a.wbs), anforderungen: da(&a.anforderungen) };
                (a.kuerzel, Registereintrag { name: a.name, wbs: a.wbs, anforderungen: a.anforderungen, erreichbar })
            })
            .collect())
    }
}
