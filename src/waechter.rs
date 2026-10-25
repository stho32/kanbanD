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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Ereignis {
    /// relativ zum Ordner; bei fremden WBS-Dateien der volle Pfad
    pub pfade: Vec<String>,
    #[serde(rename = "extern")]
    pub von_aussen: bool,
    /// Kürzel der Anwendungen, deren WBS sich geändert hat (Datei oder Commit im Arbeits-Repository)
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub wbs: Vec<String>,
}

/// Pfade, die kanbanD gerade selbst geschrieben hat — deren Änderung ist nicht „extern“.
#[derive(Clone, Default)]
pub struct Eigene(Arc<Mutex<HashMap<String, Instant>>>);

impl Eigene {
    /// `pfad` relativ zum Ordner, bei fremden WBS-Dateien voll.
    pub fn merken(&self, pfad: &str) {
        let mut m = self.0.lock().unwrap_or_else(|e| e.into_inner());
        m.retain(|_, t| t.elapsed() < EIGEN_GILT);
        m.insert(pfad.to_string(), Instant::now());
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
            senden(Ereignis { pfade, von_aussen, wbs: vec![] });
        }
    });
    Ok(w)
}

/// Eine WBS-Datei außerhalb des Ordners, dazu das Git-Verzeichnis ihres Arbeits-Repositorys.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FremdeWbs {
    pub kuerzel: String,
    pub datei: PathBuf,
    /// ein Commit dort ändert `index` und `HEAD` — dann stimmt „nicht committet“ nicht mehr
    pub git: Option<PathBuf>,
}

impl FremdeWbs {
    /// Betrifft eine Änderung an `pfad` diese WBS?
    fn betrifft(&self, pfad: &Path) -> bool {
        pfad == self.datei || (self.git.as_deref().is_some_and(|g| pfad.parent() == Some(g)) && pfad.file_name().is_some_and(|n| n == "index" || n == "HEAD"))
    }

    fn ordner(&self) -> impl Iterator<Item = &Path> {
        self.datei.parent().into_iter().chain(self.git.as_deref())
    }
}

/// Beobachtet WBS-Dateien außerhalb des Ordners — je Datei ihren Ordner, nicht die Datei selbst:
/// Editoren ersetzen eine Datei beim Speichern oft durch eine neue.
pub struct FremderWaechter {
    watcher: Mutex<RecommendedWatcher>,
    ziele: Arc<Mutex<Vec<FremdeWbs>>>,
    beobachtet: Mutex<BTreeSet<PathBuf>>,
}

/// Startet die Beobachtung ohne Ziele; `setzen` legt sie fest. Was kanbanD selbst geschrieben hat (`eigene`, voller Pfad), ist nicht extern.
pub fn fremde_starten(eigene: Eigene, senden: impl Fn(Ereignis) + Send + 'static) -> notify::Result<FremderWaechter> {
    let ziele: Arc<Mutex<Vec<FremdeWbs>>> = Arc::default();
    let (tx, rx) = mpsc::channel::<(String, String)>();
    let im_callback = ziele.clone();
    let watcher = notify::recommended_watcher(move |ergebnis: notify::Result<notify::Event>| {
        let Some(ev) = ergebnis.ok().filter(|ev| !matches!(ev.kind, notify::EventKind::Access(_))) else { return };
        let ziele = im_callback.lock().unwrap_or_else(|e| e.into_inner());
        for p in &ev.paths {
            for z in ziele.iter().filter(|z| z.betrifft(p)) {
                let _ = tx.send((z.kuerzel.clone(), z.datei.to_string_lossy().into_owned()));
            }
        }
    })?;
    std::thread::spawn(move || {
        while let Ok(erster) = rx.recv() {
            let mut treffer = BTreeSet::from([erster]);
            while let Ok(t) = rx.recv_timeout(BUENDELN) {
                treffer.insert(t);
            }
            let wbs: BTreeSet<String> = treffer.iter().map(|(k, _)| k.clone()).collect();
            let pfade: Vec<String> = treffer.into_iter().map(|(_, d)| d).collect::<BTreeSet<_>>().into_iter().collect();
            let von_aussen = !eigene.alle_eigen(&pfade);
            senden(Ereignis { pfade, von_aussen, wbs: wbs.into_iter().collect() });
        }
    });
    Ok(FremderWaechter { watcher: Mutex::new(watcher), ziele, beobachtet: Mutex::default() })
}

impl FremderWaechter {
    /// Ersetzt die beobachteten WBS-Dateien; ein fehlender Ordner wird übergangen.
    pub fn setzen(&self, neu: Vec<FremdeWbs>) {
        let gebraucht: BTreeSet<PathBuf> = neu.iter().flat_map(|z| z.ordner().map(Path::to_path_buf)).collect();
        let mut w = self.watcher.lock().unwrap_or_else(|e| e.into_inner());
        let mut beobachtet = self.beobachtet.lock().unwrap_or_else(|e| e.into_inner());
        for weg in beobachtet.difference(&gebraucht) {
            let _ = w.unwatch(weg);
        }
        beobachtet.retain(|o| gebraucht.contains(o));
        for o in gebraucht {
            if !beobachtet.contains(&o) && w.watch(&o, RecursiveMode::NonRecursive).is_ok() {
                beobachtet.insert(o);
            }
        }
        *self.ziele.lock().unwrap_or_else(|e| e.into_inner()) = neu;
    }
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
    fn fremde_wbs_betrifft_datei_und_commit_im_arbeits_repository() {
        let z = FremdeWbs { kuerzel: "kd".into(), datei: "/r/plan/wbs.md".into(), git: Some("/r/.git".into()) };
        assert!(z.betrifft(Path::new("/r/plan/wbs.md")));
        assert!(z.betrifft(Path::new("/r/.git/index")) && z.betrifft(Path::new("/r/.git/HEAD")));
        assert!(!z.betrifft(Path::new("/r/.git/index.lock")));
        assert!(!z.betrifft(Path::new("/r/plan/anderes.md")));
        assert!(!z.betrifft(Path::new("/r/.git/refs/heads/HEAD")));
        assert_eq!(z.ordner().collect::<Vec<_>>(), [Path::new("/r/plan"), Path::new("/r/.git")]);
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
