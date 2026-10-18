use super::Kanban;
use crate::fehler::Fehler;
use crate::herkunft::{anforderungsname, wbs_knoten};
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct Quelle {
    pub datei: String,
    pub zeile: usize,
    pub name: String,
    pub status: Option<String>,
    pub braucht: Vec<String>,
}

fn absolut(wurzel: &Path, rel: &str) -> PathBuf {
    let p = wurzel.join(rel);
    p.canonicalize().unwrap_or(p)
}

impl Kanban {
    /// Für jede in Aufgaben verwendete Herkunft die Quelle — soweit WBS und Anforderungen auffindbar sind.
    pub fn herkunft(&self) -> Result<BTreeMap<String, Quelle>, Fehler> {
        // Lesend: eine defekte kanbanD.md heißt nur „keine Quellpfade“.
        let e = self.ordner().einstellungen().ok().flatten().unwrap_or_default();
        let (aufgaben, _) = self.ordner().aufgaben()?;
        let mut gesucht: Vec<String> = aufgaben.iter().flat_map(|a| a.herkunft.iter().cloned()).collect();
        let wurzel = self.ordner().wurzel();
        let mut quellen = BTreeMap::new();
        if !e.quellen.wbs.is_empty() {
            let wbs = absolut(wurzel, &e.quellen.wbs);
            if let Ok(text) = std::fs::read_to_string(&wbs) {
                let knoten = wbs_knoten(&text);
                // Auch Knoten, die nur über „Braucht“ erreicht werden, für die Anzeige auflösen.
                gesucht.extend(knoten.iter().filter(|k| gesucht.contains(&k.id)).flat_map(|k| k.braucht.clone()).collect::<Vec<_>>());
                for k in knoten.into_iter().filter(|k| gesucht.contains(&k.id)) {
                    let q = Quelle { datei: wbs.to_string_lossy().into(), zeile: k.zeile, name: k.name, status: Some(k.status), braucht: k.braucht };
                    quellen.insert(k.id, q);
                }
            }
        }
        if !e.quellen.anforderungen.is_empty() {
            let dir = absolut(wurzel, &e.quellen.anforderungen);
            if let Ok(eintraege) = std::fs::read_dir(&dir) {
                for d in eintraege.flatten() {
                    let name = d.file_name().to_string_lossy().to_string();
                    let Some(id) = name.split(['-', '.']).next().filter(|id| id.starts_with('R') && gesucht.iter().any(|g| g == id)) else { continue };
                    let text = std::fs::read_to_string(d.path()).unwrap_or_default();
                    quellen.insert(id.to_string(), Quelle { datei: d.path().to_string_lossy().into(), zeile: 1, name: anforderungsname(&text), status: None, braucht: vec![] });
                }
            }
        }
        Ok(quellen)
    }
}
