//! Der einzige Ort, der Git in **Arbeits-Repositories** des Registers startet (R00202, ADR-0032 Punkt 3) — getrennt von
//! [`crate::git::committen`], das nur das Board-Repository kennt.
//!
//! - **Nur lesend**, aus einer abschließenden Liste ([`Befehl`]); kein `add`, `commit`, `checkout`, `fetch`, `gc`.
//! - **Argumentliste ohne Shell**, `--end-of-options` vor jedem Verweis; die Form des Verweises prüft der Aufrufer vorher
//!   ([`crate::modell::Verweisform`]) — dieses Modul ist die zweite Linie, nicht die erste.
//! - Umgebung `GIT_OPTIONAL_LOCKS=0` (kein Auffrischen des Index), `GIT_TERMINAL_PROMPT=0` (nie fragen); Variablen, die
//!   Git auf ein anderes Repository umlenken (`GIT_DIR` …), werden entfernt. Sonst bleibt die Umgebung, auch `GIT_TRACE`.
//! - **Zeitgrenze** je Prozess ([`ZEITGRENZE`]), danach wird er beendet.
//! - Läuft **ohne** die Sperre des Board-Ordners — der Aufrufer ruft es vor `aufgabe_schreiben` (ADR-0032 Punkt 4).

use crate::modell::Anwendung;
use std::cell::Cell;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

/// Zeitgrenze je Git-Prozess (ADR-0032 Punkt 3).
pub const ZEITGRENZE: Duration = Duration::from_secs(10);

/// Variablen, die Git ein anderes Repository, einen anderen Index oder andere Objekte unterschieben.
const UMLENKUNGEN: [&str; 6] = ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES"];

/// Die abschließende Liste der Git-Befehle dieses Moduls (ADR-0032 Punkt 3 nennt dazu `cat-file`, `log`, `rev-list`,
/// `diff`, `diff-tree`, `merge-base`, `for-each-ref` — sie kommen mit den Scheiben, die sie brauchen).
#[derive(Debug, Clone, Copy)]
enum Befehl {
    RevParse,
}

impl Befehl {
    fn name(self) -> &'static str {
        match self {
            Befehl::RevParse => "rev-parse",
        }
    }
}

/// Was beim Lesen im Arbeits-Repository scheitern kann.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Arbeitsrepofehler {
    /// Ordner fehlt, ist kein Repository oder Git verweigert ihn — mit Grund.
    RepositoryFehlt(String),
    /// Kein Commit zu diesem Hash: nicht vorhanden, mehrdeutig oder ein anderes Objekt.
    KeinCommit,
    /// Git lief länger als die Zeitgrenze und wurde beendet.
    Zeitgrenze,
    /// Git ließ sich nicht starten.
    Start(String),
}

thread_local! {
    static AUFRUFE: Cell<usize> = const { Cell::new(0) };
}

/// Wie viele Git-Prozesse dieses Modul im laufenden Thread gestartet hat — die Probe „Lesen startet kein Git“ (AK 10)
/// und „diese Eingabe erreicht Git nie“ (AK 6).
pub fn aufrufe() -> usize {
    AUFRUFE.with(Cell::get)
}

/// Die Wurzel des Arbeits-Repositorys einer Anwendung (ADR-0032 Punkt 2): Startordner ist der Ordner der WBS-Datei, ohne
/// WBS der Anforderungsordner; relative Pfade gelten ab dem Board-Ordner. Je Aufruf neu ermittelt, kein Zwischenspeicher.
pub fn wurzel(board_ordner: &Path, anwendung: &Anwendung) -> Result<PathBuf, Arbeitsrepofehler> {
    let start = match (anwendung.wbs.as_str(), anwendung.anforderungen.as_str()) {
        ("", "") => return Err(Arbeitsrepofehler::RepositoryFehlt("weder WBS noch Anforderungsordner im Register".into())),
        ("", anforderungen) => board_ordner.join(anforderungen),
        (wbs, _) => board_ordner.join(wbs).parent().map(Path::to_path_buf).unwrap_or_default(),
    };
    if !start.is_dir() {
        return Err(Arbeitsrepofehler::RepositoryFehlt(format!("Ordner fehlt: {}", start.display())));
    }
    let aus = git(&start, Befehl::RevParse, &["--show-toplevel"])?;
    if !aus.status.success() {
        let grund = String::from_utf8_lossy(&aus.stderr).lines().next().unwrap_or_default().trim().to_string();
        return Err(Arbeitsrepofehler::RepositoryFehlt(format!("kein Git-Repository: {} ({grund})", start.display())));
    }
    Ok(PathBuf::from(String::from_utf8_lossy(&aus.stdout).trim_end_matches('\n')))
}

/// Der volle Hash des Commits zu `hash` (7–64 Zeichen 0-9a-f, kleingeschrieben) — gleich, auf welchem Zweig er liegt
/// (ADR-0032 N1.1). Nicht vorhanden, mehrdeutig, ein anderes Objekt oder ein Ref, der wie ein Kurz-Hash heißt → `KeinCommit`.
pub fn commit_aufloesen(wurzel: &Path, hash: &str) -> Result<String, Arbeitsrepofehler> {
    let aus = git(wurzel, Befehl::RevParse, &["--verify", "--quiet", "--end-of-options", &format!("{hash}^{{commit}}")])?;
    let voll = String::from_utf8_lossy(&aus.stdout).trim().to_string();
    // Ein Zweig namens `abcdef0` ginge vor dem Kurz-Hash — der Commit muss mit dem genannten Hash beginnen
    if !aus.status.success() || !voll.starts_with(hash) {
        return Err(Arbeitsrepofehler::KeinCommit);
    }
    Ok(voll)
}

/// Der eine Startort für Git in einem Arbeits-Repository: fester Befehl, Argumentliste, Umgebung, Zeitgrenze, Zähler.
fn git(ordner: &Path, befehl: Befehl, args: &[&str]) -> Result<Output, Arbeitsrepofehler> {
    let mut c = Command::new("git");
    c.arg("-C").arg(ordner).arg(befehl.name()).args(args).env("GIT_OPTIONAL_LOCKS", "0").env("GIT_TERMINAL_PROMPT", "0");
    for v in UMLENKUNGEN {
        c.env_remove(v);
    }
    AUFRUFE.with(|n| n.set(n.get() + 1));
    laufen(c, ZEITGRENZE)
}

/// Startet `c` ohne Eingabe und wartet höchstens `zeitgrenze`; danach wird der Prozess beendet → `Zeitgrenze`.
pub fn laufen(mut c: Command, zeitgrenze: Duration) -> Result<Output, Arbeitsrepofehler> {
    let mut kind = c.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().map_err(|e| Arbeitsrepofehler::Start(e.to_string()))?;
    let stdout = mitlesen(kind.stdout.take());
    let stderr = mitlesen(kind.stderr.take());
    let ende = Instant::now() + zeitgrenze;
    let mut pause = Duration::from_millis(1);
    let status = loop {
        match kind.try_wait().map_err(|e| Arbeitsrepofehler::Start(e.to_string()))? {
            Some(status) => break status,
            None if Instant::now() >= ende => {
                let _ = kind.kill();
                let _ = kind.wait();
                return Err(Arbeitsrepofehler::Zeitgrenze);
            }
            None => {
                std::thread::sleep(pause);
                pause = (pause * 2).min(Duration::from_millis(20));
            }
        }
    };
    Ok(Output { status, stdout: stdout.join().unwrap_or_default(), stderr: stderr.join().unwrap_or_default() })
}

/// Liest einen Ausgabestrom in einem eigenen Thread leer, damit ein voller Puffer den Prozess nicht anhält.
fn mitlesen(strom: Option<impl Read + Send + 'static>) -> std::thread::JoinHandle<Vec<u8>> {
    std::thread::spawn(move || {
        let mut puffer = vec![];
        if let Some(mut s) = strom {
            let _ = s.read_to_end(&mut puffer);
        }
        puffer
    })
}
