use super::Kanban;
use crate::fehler::Fehler;
use crate::herkunft::{anforderungsname, wbs_knoten};
use crate::modell::{Anwendung, Anwendungen, Aufloesung, Herkunftsschluessel};
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct Quelle {
    pub datei: String,
    pub zeile: usize,
    pub name: String,
    pub status: Option<String>,
    /// qualifiziert wie `schluessel`
    pub braucht: Vec<String>,
    /// Kürzel der Anwendung; `None` bei der Standardanwendung aus `sources.wbs`/`sources.requirements`
    pub anwendung: Option<String>,
    /// die eine qualifizierte Schreibweise (`kd:I0007`, bei der Standardanwendung `I0007`) — „wartet auf“ vergleicht sie
    pub schluessel: String,
}

/// Absolut bleibt absolut; relativ gilt zum kanbanD-Ordner.
pub(super) fn absolut(wurzel: &Path, pfad: &str) -> PathBuf {
    let p = wurzel.join(pfad);
    p.canonicalize().unwrap_or(p)
}

/// Das Kürzel, bei der Standardanwendung keines.
fn kuerzel_der(anwendung: &Anwendung) -> Option<String> {
    Some(anwendung.kuerzel.clone()).filter(|k| !k.is_empty())
}

/// Je ID der Anwendung die Schreibweisen, unter denen Aufgaben sie nennen.
type Gesucht = BTreeMap<String, Vec<String>>;

fn gesucht_in(anwendungen: &Anwendungen, anwendung: &Anwendung, herkuenfte: &[String]) -> Gesucht {
    let mut gesucht = Gesucht::new();
    for h in herkuenfte {
        if let Aufloesung::Eindeutig(a, id) = anwendungen.aufloesen(h)
            && a.kuerzel == anwendung.kuerzel
        {
            gesucht.entry(id).or_default().push(h.clone());
        }
    }
    gesucht
}

fn wbs_quellen(wurzel: &Path, anwendung: &Anwendung, gesucht: &mut Gesucht, quellen: &mut BTreeMap<String, Quelle>) {
    if anwendung.wbs.is_empty() {
        return;
    }
    let wbs = absolut(wurzel, &anwendung.wbs);
    let Ok(text) = std::fs::read_to_string(&wbs) else { return };
    let q = |id: &str| Herkunftsschluessel::qualifiziert(&anwendung.kuerzel, id);
    let knoten = wbs_knoten(&text);
    // Auch Knoten, die nur über „Braucht“ erreicht werden, für die Anzeige auflösen.
    let ueber_braucht: Vec<String> = knoten.iter().filter(|k| gesucht.contains_key(&k.id)).flat_map(|k| k.braucht.clone()).collect();
    for b in ueber_braucht {
        gesucht.entry(b.clone()).or_insert_with(|| vec![q(&b)]);
    }
    for k in knoten {
        let Some(schreibweisen) = gesucht.get(&k.id) else { continue };
        let quelle = Quelle { datei: wbs.to_string_lossy().into(), zeile: k.zeile, name: k.name, status: Some(k.status), braucht: k.braucht.iter().map(|b| q(b)).collect(), anwendung: kuerzel_der(anwendung), schluessel: q(&k.id) };
        for s in schreibweisen {
            quellen.insert(s.clone(), quelle.clone());
        }
    }
}

fn anforderungs_quellen(wurzel: &Path, anwendung: &Anwendung, gesucht: &Gesucht, quellen: &mut BTreeMap<String, Quelle>) {
    if anwendung.anforderungen.is_empty() {
        return;
    }
    let Ok(eintraege) = std::fs::read_dir(absolut(wurzel, &anwendung.anforderungen)) else { return };
    for d in eintraege.flatten() {
        let name = d.file_name().to_string_lossy().to_string();
        let Some(id) = name.split(['-', '.']).next().filter(|id| id.starts_with('R')) else { continue };
        let Some(schreibweisen) = gesucht.get(id) else { continue };
        let text = std::fs::read_to_string(d.path()).unwrap_or_default();
        let quelle = Quelle { datei: d.path().to_string_lossy().into(), zeile: 1, name: anforderungsname(&text), status: None, braucht: vec![], anwendung: kuerzel_der(anwendung), schluessel: Herkunftsschluessel::qualifiziert(&anwendung.kuerzel, id) };
        for s in schreibweisen {
            quellen.insert(s.clone(), quelle.clone());
        }
    }
}

impl Kanban {
    /// Für jede in Aufgaben verwendete Herkunft die Quelle, unter der Schreibweise der Aufgabe —
    /// soweit WBS und Anforderungen auffindbar sind. Mehrdeutige Herkunft fehlt.
    pub fn herkunft(&self) -> Result<BTreeMap<String, Quelle>, Fehler> {
        // Lesend: eine defekte kanbanD.md heißt nur „keine Quellpfade“.
        let e = self.ordner().einstellungen().ok().flatten().unwrap_or_default();
        let anwendungen = Anwendungen::aus(&e.quellen);
        let (aufgaben, _) = self.ordner().aufgaben()?;
        let herkuenfte: Vec<String> = aufgaben.iter().flat_map(|a| a.herkunft.iter().cloned()).collect();
        let wurzel = self.ordner().wurzel();
        let mut quellen = BTreeMap::new();
        for anwendung in anwendungen.alle() {
            let mut gesucht = gesucht_in(&anwendungen, anwendung, &herkuenfte);
            wbs_quellen(wurzel, anwendung, &mut gesucht, &mut quellen);
            anforderungs_quellen(wurzel, anwendung, &gesucht, &mut quellen);
        }
        Ok(quellen)
    }
}
