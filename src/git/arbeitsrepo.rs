//! Der einzige Ort, der Git in **Arbeits-Repositories** des Registers startet (R00202, ADR-0032 Punkt 3) — getrennt von
//! [`crate::git::committen`], das nur das Board-Repository kennt.
//!
//! - **Nur lesend**, aus einer abschließenden Liste ([`Befehl`]); kein `add`, `commit`, `checkout`, `fetch`, `gc`.
//! - **Argumentliste ohne Shell**, `--end-of-options` vor jedem Verweis; die Form des Verweises prüft der Aufrufer vorher
//!   ([`crate::modell::Verweisform`]) — dieses Modul ist die zweite Linie, nicht die erste.
//! - Umgebung `GIT_OPTIONAL_LOCKS=0` (kein Auffrischen des Index), `GIT_TERMINAL_PROMPT=0` (nie fragen); Variablen, die
//!   Git auf ein anderes Repository umlenken (`GIT_DIR` …) oder fremde Programme und Konfiguration einschleusen
//!   (`GIT_CONFIG_*`, `GIT_EXTERNAL_DIFF`, Pager, `GIT_EXEC_PATH`, `GIT_ASKPASS`, `GIT_SSH_COMMAND`), werden entfernt, die
//!   System- und die Benutzerkonfiguration abgeschaltet, vor jedem Befehl `core.fsmonitor` und `core.hooksPath` gesperrt.
//!   Sonst bleibt die Umgebung, auch `GIT_TRACE`.
//! - **Zeitgrenze** je Prozess ([`ZEITGRENZE`]), danach wird er beendet.
//! - Läuft **ohne** die Sperre des Board-Ordners — der Aufrufer ruft es vor `aufgabe_schreiben` (ADR-0032 Punkt 4).

use crate::modell::Anwendung;
use std::cell::Cell;
use std::ffi::OsString;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

/// Zeitgrenze je Git-Prozess (ADR-0032 Punkt 3).
pub const ZEITGRENZE: Duration = Duration::from_secs(10);

/// Variablen, die Git ein anderes Repository, einen anderen Index oder andere Objekte unterschieben.
const UMLENKUNGEN: [&str; 6] = ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES"];

/// Variablen, über die die Umgebung der Instanz Git ein Programm oder eine Konfiguration unterschiebt; alle mit dem
/// Präfix [`KONFIGURATION`] fallen ebenfalls weg.
const PROGRAMME: [&str; 6] = ["GIT_EXTERNAL_DIFF", "GIT_PAGER", "PAGER", "GIT_EXEC_PATH", "GIT_ASKPASS", "GIT_SSH_COMMAND"];
const KONFIGURATION: &str = "GIT_CONFIG_";

/// Vor jedem Befehl: kein Dateisystem-Monitor und keine Hooks aus der Konfiguration des Arbeits-Repositorys oder der Umgebung.
const SPERREN: [&str; 4] = ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null"];

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
    let c = kommando(ordner, befehl.name(), args, std::env::vars_os().map(|(name, _)| name));
    AUFRUFE.with(|n| n.set(n.get() + 1));
    laufen(c, ZEITGRENZE)
}

/// Die Befehlszeile und die gehärtete Umgebung; `vorhandene` sind die Namen der Umgebungsvariablen der Instanz.
fn kommando(ordner: &Path, befehl: &str, args: &[&str], vorhandene: impl Iterator<Item = OsString>) -> Command {
    let mut c = Command::new("git");
    c.arg("-C").arg(ordner).args(SPERREN).arg(befehl).args(args).env("GIT_OPTIONAL_LOCKS", "0").env("GIT_TERMINAL_PROMPT", "0");
    for v in UMLENKUNGEN.into_iter().chain(PROGRAMME) {
        c.env_remove(v);
    }
    for name in vorhandene.filter(|n| n.to_string_lossy().starts_with(KONFIGURATION)) {
        c.env_remove(name);
    }
    c.env("GIT_CONFIG_NOSYSTEM", "1").env("GIT_CONFIG_GLOBAL", "/dev/null");
    c
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsStr;

    fn umgebung(c: &Command) -> Vec<(String, Option<String>)> {
        c.get_envs().map(|(k, v)| (k.to_string_lossy().into(), v.map(|v| v.to_string_lossy().into()))).collect()
    }

    // Sicherheits-Befund Sollte 1 (Karte #207): was der eine Startort entfernt, setzt und jedem Befehl voranstellt
    #[test]
    fn umgebung_und_sperren_des_startorts() {
        let vorhanden = ["GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_SYSTEM", "GIT_TRACE", "HOME"].map(OsString::from);
        let c = kommando(Path::new("/r"), "rev-parse", &["--show-toplevel"], vorhanden.into_iter());
        let args: Vec<&OsStr> = c.get_args().collect();
        assert_eq!(args, ["-C", "/r", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "rev-parse", "--show-toplevel"]);
        let env = umgebung(&c);
        let entfernt = |n: &str| env.contains(&(n.to_string(), None));
        for n in ["GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_SYSTEM", "GIT_EXTERNAL_DIFF", "GIT_PAGER", "PAGER", "GIT_EXEC_PATH", "GIT_ASKPASS", "GIT_SSH_COMMAND", "GIT_DIR", "GIT_WORK_TREE"] {
            assert!(entfernt(n), "{n} bleibt: {env:?}");
        }
        assert!(!entfernt("GIT_TRACE") && !entfernt("HOME"), "sonst bleibt die Umgebung: {env:?}");
        for gesetzt in [("GIT_CONFIG_NOSYSTEM", "1"), ("GIT_CONFIG_GLOBAL", "/dev/null"), ("GIT_OPTIONAL_LOCKS", "0"), ("GIT_TERMINAL_PROMPT", "0")] {
            assert!(env.contains(&(gesetzt.0.to_string(), Some(gesetzt.1.to_string()))), "{gesetzt:?} fehlt: {env:?}");
        }
    }

    // Die Sperren wirken wirklich: ein Repository, dessen eigene Konfiguration einen Fsmonitor und Hooks setzt, führt beim
    // gehärteten Befehl nichts aus — und ohne die Härtung doch (Gegenprobe). Ein Befehl, der den Index liest (`status`),
    // zeigt das; `rev-parse` startet Git-Versionen nach 2.48 keinen Fsmonitor.
    #[test]
    fn repository_konfiguration_fuehrt_nichts_aus() {
        let tmp = tempfile::tempdir().unwrap();
        let r = tmp.path().canonicalize().unwrap().join("R");
        std::fs::create_dir_all(r.join("hooks")).unwrap();
        let git = |args: &[&str]| assert!(Command::new("git").arg("-C").arg(&r).args(["-c", "user.name=A", "-c", "user.email=a@a"]).args(args).status().unwrap().success(), "{args:?}");
        git(&["init", "-q", "-b", "main"]);
        std::fs::write(r.join("a.txt"), "a\n").unwrap();
        git(&["add", "a.txt"]);
        let marke = tmp.path().join("marke");
        let skript = tmp.path().join("skript.sh");
        std::fs::write(&skript, format!("#!/bin/sh\necho \"$0 $@\" >> {}\n", marke.display())).unwrap();
        std::fs::set_permissions(&skript, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
        std::fs::copy(&skript, r.join("hooks/post-commit")).unwrap();
        git(&["config", "core.fsmonitor", skript.to_str().unwrap()]);
        git(&["config", "core.hooksPath", r.join("hooks").to_str().unwrap()]);

        let ungehaertet = |args: &[&str]| Command::new("git").arg("-C").arg(&r).args(["-c", "user.name=A", "-c", "user.email=a@a"]).args(args).output().unwrap();
        ungehaertet(&["status"]);
        assert!(marke.exists(), "Gegenprobe: der Fsmonitor aus der Konfiguration läuft");
        std::fs::remove_file(&marke).unwrap();

        let gehaertet = |befehl: &str, args: &[&str]| {
            let mut c = kommando(&r, befehl, args, std::iter::empty());
            c.envs([("GIT_AUTHOR_NAME", "A"), ("GIT_AUTHOR_EMAIL", "a@a"), ("GIT_COMMITTER_NAME", "A"), ("GIT_COMMITTER_EMAIL", "a@a")]);
            c.output().unwrap()
        };
        gehaertet("status", &["--porcelain"]);
        assert!(!marke.exists(), "Fsmonitor lief trotz Sperre");
        // der Commit ist nur Mittel, einen Hook auszulösen — das Modul selbst committet nie
        let a = gehaertet("commit", &["-q", "--allow-empty", "-m", "x"]);
        assert!(a.status.success(), "{}", String::from_utf8_lossy(&a.stderr));
        assert!(!marke.exists(), "Hook lief trotz Sperre");
        ungehaertet(&["commit", "-q", "--allow-empty", "-m", "x"]);
        assert!(marke.exists(), "Gegenprobe: der Hook aus der Konfiguration läuft");
    }
}
