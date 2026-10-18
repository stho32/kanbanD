//! Beobachtet den Ordner und bündelt Änderungen zu Ereignissen — egal, wer geändert hat.

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const BUENDELN: Duration = Duration::from_millis(150);
const EIGEN_GILT: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Ereignis {
    pub pfade: Vec<String>,
    #[serde(rename = "extern")]
    pub von_aussen: bool,
}

/// Pfade, die kanbanD gerade selbst geschrieben hat — deren Änderung ist nicht „extern“.
#[derive(Clone, Default)]
pub struct Eigene(Arc<Mutex<HashMap<String, Instant>>>);

impl Eigene {
    pub fn merken(&self, rel: &str) {
        let mut m = self.0.lock().unwrap_or_else(|e| e.into_inner());
        m.retain(|_, t| t.elapsed() < EIGEN_GILT);
        m.insert(rel.to_string(), Instant::now());
    }

    pub fn alle_eigen(&self, pfade: &[String]) -> bool {
        let m = self.0.lock().unwrap_or_else(|e| e.into_inner());
        pfade.iter().all(|p| m.get(p).is_some_and(|t| t.elapsed() < EIGEN_GILT))
    }
}

/// Zählt eine Änderung an diesem Pfad (relativ zum Ordner)?
pub fn relevant(rel: &str) -> bool {
    !rel.is_empty() && rel != ".git" && !rel.starts_with(".git/") && !rel.ends_with(".kanbanD-tmp")
}

pub fn relativ(wurzel: &Path, pfad: &Path) -> Option<String> {
    let rel = pfad.strip_prefix(wurzel).ok()?.to_string_lossy().replace('\\', "/");
    relevant(&rel).then_some(rel)
}

/// Eine Datei zählt mit ihrem Pfad; ein Verzeichnis mit allen Dateien darin — ein neu angelegtes
/// Verzeichnis wird erst beobachtet, nachdem darin vielleicht schon geschrieben wurde.
fn dateien_aufnehmen(wurzel: &Path, pfad: &Path, pfade: &mut BTreeSet<String>) {
    if pfad.is_dir() {
        if relativ(wurzel, pfad).is_some()
            && let Ok(eintraege) = std::fs::read_dir(pfad)
        {
            for e in eintraege.flatten() {
                dateien_aufnehmen(wurzel, &e.path(), pfade);
            }
        }
    } else {
        pfade.extend(relativ(wurzel, pfad));
    }
}

/// Startet die Beobachtung; der zurückgegebene Watcher muss leben, solange beobachtet wird.
pub fn starten(wurzel: PathBuf, eigene: Eigene, senden: impl Fn(Ereignis) + Send + 'static) -> notify::Result<RecommendedWatcher> {
    let (tx, rx) = mpsc::channel::<PathBuf>();
    let mut w = notify::recommended_watcher(move |ergebnis: notify::Result<notify::Event>| {
        // Nur Änderungen zählen; Lesezugriffe (auch die eigenen beim Auflösen von Verzeichnissen) nicht.
        if let Some(ev) = ergebnis.ok().filter(|ev| !matches!(ev.kind, notify::EventKind::Access(_))) {
            for p in ev.paths {
                let _ = tx.send(p);
            }
        }
    })?;
    w.watch(&wurzel, RecursiveMode::Recursive)?;
    std::thread::spawn(move || {
        while let Ok(erster) = rx.recv() {
            let mut pfade = BTreeSet::new();
            dateien_aufnehmen(&wurzel, &erster, &mut pfade);
            while let Ok(p) = rx.recv_timeout(BUENDELN) {
                dateien_aufnehmen(&wurzel, &p, &mut pfade);
            }
            if pfade.is_empty() {
                continue;
            }
            let pfade: Vec<String> = pfade.into_iter().collect();
            let von_aussen = !eigene.alle_eigen(&pfade);
            senden(Ereignis { pfade, von_aussen });
        }
    });
    Ok(w)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn git_und_zwischendateien_zaehlen_nicht() {
        assert!(relevant("aufgaben/0001-x.md"));
        assert!(relevant("boards/b.md"));
        assert!(!relevant(".git"));
        assert!(!relevant(".git/index"));
        assert!(!relevant("aufgaben/0001-x.kanbanD-tmp"));
        assert!(!relevant(""));
        assert_eq!(relativ(Path::new("/a/b"), Path::new("/a/b/boards/x.md")), Some("boards/x.md".into()));
        assert_eq!(relativ(Path::new("/a/b"), Path::new("/c/x.md")), None);
    }

    #[test]
    fn eigen_nur_wenn_alle_pfade_eben_selbst_geschrieben() {
        let e = Eigene::default();
        e.merken("a.md");
        assert!(e.alle_eigen(&["a.md".into()]));
        assert!(!e.alle_eigen(&["a.md".into(), "b.md".into()]));
        assert!(!Eigene::default().alle_eigen(&["a.md".into()]));
    }
}
