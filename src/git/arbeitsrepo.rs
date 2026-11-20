//! Der einzige Ort, der Git in **Arbeits-Repositories** des Registers startet (R00202, ADR-0032 Punkt 3) — getrennt von
//! [`crate::git::committen`], das nur das Board-Repository kennt.
//!
//! - **Nur lesend**, aus einer abschließenden Liste ([`Befehl`]); kein `add`, `commit`, `checkout`, `fetch`, `gc`.
//! - **Argumentliste ohne Shell**, `--end-of-options` vor jedem Verweis; die Form des Verweises prüft der Aufrufer vorher
//!   ([`crate::modell::Verweisform`]) — dieses Modul ist die zweite Linie, nicht die erste.
//! - Umgebung `GIT_OPTIONAL_LOCKS=0` (kein Auffrischen des Index), `GIT_TERMINAL_PROMPT=0` (nie fragen),
//!   `GIT_NO_LAZY_FETCH=1` (ein Teilklon holt fehlende Objekte nie nach, startet also kein Programm aus der Konfiguration); Variablen, die
//!   Git auf ein anderes Repository umlenken (`GIT_DIR` …) oder fremde Programme und Konfiguration einschleusen
//!   (`GIT_CONFIG_*`, `GIT_EXTERNAL_DIFF`, Pager, `GIT_EXEC_PATH`, `GIT_ASKPASS`, `GIT_SSH_COMMAND`), werden entfernt, die
//!   System- und die Benutzerkonfiguration abgeschaltet, vor jedem Befehl `core.fsmonitor` und `core.hooksPath` gesperrt.
//!   Sonst bleibt die Umgebung, auch `GIT_TRACE`.
//! - **Schalter aus dem Befehl** (ADR-0032 N2.3, N4.7): wer Diffs erzeugen kann (`log`, `diff-tree`), bekommt seine
//!   Schalter aus [`Befehl::schalter`] — `-c core.quotepath=off` (bei `diff-tree` dazu `--literal-pathspecs`) vor und
//!   `--no-ext-diff --no-textconv --no-color` (bei `log` dazu `--no-show-signature`) nach dem Befehl; der Aufrufer nennt
//!   sie nicht und kann sie nicht abschalten.
//! - **Zeitgrenze** je Prozess ([`ZEITGRENZE`]), danach wird seine **Prozessgruppe** beendet — Git samt Kindern.
//! - **Teil nur an der Bytegrenze** (ADR-0032 N4.4): [`git`] liefert die ganze Ausgabe oder einen Fehler, nie einen Teil;
//!   nur [`git_teil`] (und nur für Befehle mit [`Befehl::liefert_teil`]) liefert bei Erreichen der Bytegrenze die ersten
//!   Bytes als [`Teil`] — die Prozessgruppe stirbt dann wie bei der Zeitgrenze.
//! - Läuft **ohne** die Sperre des Board-Ordners — der Aufrufer ruft es vor `aufgabe_schreiben` (ADR-0032 Punkt 4).

use crate::modell::Anwendung;
use std::cell::Cell;
use std::collections::HashMap;
use std::ffi::OsString;
use std::io::{Read, Write};
use std::os::unix::ffi::OsStrExt;
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::Arc;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::atomic::{AtomicBool, Ordering};
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

/// Die abschließende Liste der Git-Befehle dieses Moduls (ADR-0032 Punkt 3 nennt dazu `diff` und `merge-base` — sie
/// kommen mit den Scheiben, die sie brauchen). Ein neuer Befehl braucht eine Zuordnung in [`Befehl::erzeugt_diffs`],
/// [`Befehl::schalter`] und [`Befehl::liefert_teil`], sonst baut das Programm nicht.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Befehl {
    RevParse,
    CatFile,
    Log,
    ForEachRef,
    RevList,
    DiffTree,
}

/// Die Schalter, die der Startort aus dem Befehl setzt (ADR-0032 N4.7): vor dem Befehl, nach dem Befehl, und was der
/// Aufrufer nie nennen darf, weil es einen davon aufhöbe.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Schalter {
    pub vor: &'static [&'static str],
    pub nach: &'static [&'static str],
    pub verboten: &'static [&'static str],
}

const OHNE_SCHALTER: Schalter = Schalter { vor: &[], nach: &[], verboten: &[] };

impl Befehl {
    fn name(self) -> &'static str {
        match self {
            Befehl::RevParse => "rev-parse",
            Befehl::CatFile => "cat-file",
            Befehl::Log => "log",
            Befehl::ForEachRef => "for-each-ref",
            Befehl::RevList => "rev-list",
            Befehl::DiffTree => "diff-tree",
        }
    }

    /// Kann der Befehl Diffs erzeugen (und damit Diff-Treiber, textconv oder Signaturprogramme starten)?
    fn erzeugt_diffs(self) -> bool {
        match self {
            Befehl::Log | Befehl::DiffTree => true,
            Befehl::RevParse | Befehl::CatFile | Befehl::ForEachRef | Befehl::RevList => false,
        }
    }

    /// Tabelle ADR-0032 N4.7: `log` und `diff-tree` maskieren keine Pfade und starten weder externe Diffs noch textconv
    /// noch Farben; `log` prüft zudem keine Signaturen (`log.showSignature` startete sonst `gpg.program`), `diff-tree`
    /// liest jede Pfadangabe wörtlich.
    fn schalter(self) -> Schalter {
        match self {
            Befehl::Log => Schalter { vor: &["-c", "core.quotepath=off"], nach: &["--no-ext-diff", "--no-textconv", "--no-color", "--no-show-signature"], verboten: &["--ext-diff", "--textconv", "--color", "--show-signature"] },
            Befehl::DiffTree => Schalter { vor: &["-c", "core.quotepath=off", "--literal-pathspecs"], nach: &["--no-ext-diff", "--no-textconv", "--no-color"], verboten: &["--ext-diff", "--textconv", "--color"] },
            Befehl::RevParse | Befehl::CatFile | Befehl::ForEachRef | Befehl::RevList => OHNE_SCHALTER,
        }
    }

    /// Darf ein Lauf dieses Befehls an der Bytegrenze einen Teil liefern ([`git_teil`], ADR-0032 N4.4)? Nur der Befehl,
    /// dessen Aufrufer einen Teil als unvollständig behandelt; jeder andere Lauf ist ganz oder ein Fehler.
    pub(crate) fn liefert_teil(self) -> bool {
        match self {
            Befehl::DiffTree => true,
            Befehl::RevParse | Befehl::CatFile | Befehl::Log | Befehl::ForEachRef | Befehl::RevList => false,
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
    /// Git ließ sich nicht starten oder lieferte etwas Unerwartetes.
    Start(String),
    /// Die Ausgabe überschritt die Zeilengrenze; der Prozess wurde beendet (ADR-0032 N3.4).
    ZuvielAusgabe(usize),
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
    wurzel_bis(board_ordner, anwendung, Instant::now() + ZEITGRENZE)
}

/// Wie [`wurzel`], mit der Gesamtgrenze des Lesens: der Prozess bekommt `min(10 s, Rest bis frist)`.
pub fn wurzel_bis(board_ordner: &Path, anwendung: &Anwendung, frist: Instant) -> Result<PathBuf, Arbeitsrepofehler> {
    let start = match (anwendung.wbs.as_str(), anwendung.anforderungen.as_str()) {
        ("", "") => return Err(Arbeitsrepofehler::RepositoryFehlt("weder WBS noch Anforderungsordner im Register".into())),
        ("", anforderungen) => board_ordner.join(anforderungen),
        (wbs, _) => board_ordner.join(wbs).parent().map(Path::to_path_buf).unwrap_or_default(),
    };
    if !start.is_dir() {
        return Err(Arbeitsrepofehler::RepositoryFehlt(format!("Ordner fehlt: {}", start.display())));
    }
    let aus = git(&start, Befehl::RevParse, &["--show-toplevel"], Lauf::mit(grenze_bis(frist)?))?;
    if !aus.status.success() {
        let grund = String::from_utf8_lossy(&aus.stderr).lines().next().unwrap_or_default().trim().to_string();
        return Err(Arbeitsrepofehler::RepositoryFehlt(format!("kein Git-Repository: {} ({grund})", start.display())));
    }
    Ok(PathBuf::from(String::from_utf8_lossy(&aus.stdout).trim_end_matches('\n')))
}

/// Der volle Hash des Commits zu `hash` (7–64 Zeichen 0-9a-f, kleingeschrieben) — gleich, auf welchem Zweig er liegt
/// (ADR-0032 N1.1). Nicht vorhanden, mehrdeutig, ein anderes Objekt oder ein Ref, der wie ein Kurz-Hash heißt → `KeinCommit`.
pub fn commit_aufloesen(wurzel: &Path, hash: &str) -> Result<String, Arbeitsrepofehler> {
    let aus = git(wurzel, Befehl::RevParse, &["--verify", "--quiet", "--end-of-options", &format!("{hash}^{{commit}}")], Lauf::mit(ZEITGRENZE))?;
    let voll = String::from_utf8_lossy(&aus.stdout).trim().to_string();
    // Ein Zweig namens `abcdef0` ginge vor dem Kurz-Hash — der Commit muss mit dem genannten Hash beginnen
    if !aus.status.success() || !voll.starts_with(hash) {
        return Err(Arbeitsrepofehler::KeinCommit);
    }
    Ok(voll)
}

/// Was `cat-file --batch-check` zu einem Namen weiß (ADR-0032 N3.3).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Objekt {
    /// ein Commit-Objekt, mit vollem Hash
    Commit(String),
    /// kein Objekt, oder eines, das kein Commit ist (Blob, Baum, Tag-Objekt — nie aufgelöst)
    Fehlt,
    /// der Kurz-Hash passt zu mehreren Objekten, gleich welchen Typs
    Mehrdeutig,
    /// ein Zweig oder Tag heißt wie der Kurz-Hash und ginge bei Git vor dem Objekt — was gemeint ist, bleibt offen
    NameEinesRefs,
}

/// Titel (erste Zeile, ungekürzt), Autor (nur der Name), Commit-Datum (ISO 8601 mit Zeitzone des Commits) und Zeilen gegen
/// den ersten Elternteil, beim Wurzel-Commit gegen den leeren Baum; dazu der erste Elternteil (ohne beim Wurzel-Commit).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Metadaten {
    pub erster_elternteil: Option<String>,
    pub titel: String,
    pub autor: String,
    pub datum: String,
    pub plus: u64,
    pub minus: u64,
    pub dateien: u64,
}

/// Die Grenze für den nächsten Prozess: `min(ZEITGRENZE, Rest bis zur Frist)`; ist die Frist vorbei, startet keiner mehr.
fn grenze_bis(frist: Instant) -> Result<Duration, Arbeitsrepofehler> {
    match frist.checked_duration_since(Instant::now()) {
        Some(rest) if !rest.is_zero() => Ok(rest.min(ZEITGRENZE)),
        _ => Err(Arbeitsrepofehler::Zeitgrenze),
    }
}

/// Ein lesender Aufruf mit Frist; ein Ausstiegscode ≠ 0 heißt: Git verweigert das Repository.
fn lesen(wurzel: &Path, befehl: Befehl, args: &[&str], eingabe: Option<&[u8]>, frist: Instant) -> Result<Vec<u8>, Arbeitsrepofehler> {
    let aus = git(wurzel, befehl, args, Lauf { eingabe, ..Lauf::mit(grenze_bis(frist)?) })?;
    if !aus.status.success() {
        let grund = String::from_utf8_lossy(&aus.stderr).lines().next().unwrap_or_default().trim().to_string();
        return Err(Arbeitsrepofehler::RepositoryFehlt(format!("Git verweigert {}: {grund}", wurzel.display())));
    }
    Ok(aus.stdout)
}

/// Je Name (7–64 Zeichen 0-9a-f, kleingeschrieben) das Objekt dahinter, in einem Aufruf; die Namen gehen über `stdin`.
pub fn objekte_pruefen(wurzel: &Path, namen: &[&str], frist: Instant) -> Result<Vec<Objekt>, Arbeitsrepofehler> {
    let eingabe: String = namen.iter().map(|n| format!("{n}\n")).collect();
    let aus = lesen(wurzel, Befehl::CatFile, &["--batch-check"], Some(eingabe.as_bytes()), frist)?;
    let text = String::from_utf8_lossy(&aus);
    let zeilen: Vec<&str> = text.lines().collect();
    if zeilen.len() != namen.len() {
        return Err(Arbeitsrepofehler::Start(format!("cat-file lieferte {} Zeilen für {} Namen", zeilen.len(), namen.len())));
    }
    Ok(namen.iter().zip(zeilen).map(|(name, zeile)| objekt(name, zeile)).collect())
}

/// Eine Zeile von `cat-file --batch-check`: `<hash> <typ> <größe>`, `<name> missing` oder `<name> ambiguous`.
fn objekt(name: &str, zeile: &str) -> Objekt {
    let teile: Vec<&str> = zeile.split(' ').collect();
    match teile.as_slice() {
        [_, "ambiguous"] => Objekt::Mehrdeutig,
        // länger als der Hash des Repositorys (41 Zeichen bei SHA-1): Git kürzt — es gibt kein solches Objekt
        [hash, _, _] if name.len() > hash.len() => Objekt::Fehlt,
        [hash, _, _] if !hash.starts_with(name) => Objekt::NameEinesRefs,
        [hash, "commit", _] => Objekt::Commit(hash.to_string()),
        _ => Objekt::Fehlt,
    }
}

/// Format je Commit: Hash, Elternteile, Autor, Commit-Datum, Nachricht roh — je mit NUL abgeschlossen (die Nachricht kann
/// kein NUL enthalten, alles andere schon).
const LOG_FORMAT: &str = "--format=%H%x00%P%x00%an%x00%cI%x00%B%x00";

/// Metadaten der Commits (volle Hashes) in einem Aufruf `log --no-walk`.
pub fn metadaten(wurzel: &Path, commits: &[&str], frist: Instant) -> Result<HashMap<String, Metadaten>, Arbeitsrepofehler> {
    // `-M -l1000` wie die Dateiliste des Diffs (ADR-0032 N4.3): `diff.renameLimit` aus dem Repository ändert nichts;
    // `--ignore-submodules=none`: `diff.ignoreSubmodules` ließe `log` Submodule sonst still weglassen (R00206 AK 16 b)
    let mut args = vec!["--no-walk=unsorted", "-z", "--root", "-M", "-l1000", "--ignore-submodules=none", "--diff-merges=first-parent", "--numstat", LOG_FORMAT, "--end-of-options"];
    args.extend_from_slice(commits);
    let aus = lesen(wurzel, Befehl::Log, &args, None, frist)?;
    log_lesen(&aus).ok_or_else(|| Arbeitsrepofehler::Start("Ausgabe von git log unlesbar".into()))
}

/// Liest die Ausgabe von [`metadaten`]: je Commit vier Felder mit NUL, ein NUL, dann bei Änderungen `\n` und
/// `--numstat`-Einträge (`<plus>\t<minus>\t<pfad>\0` oder bei Umbenennung `<plus>\t<minus>\t\0<alt>\0<neu>\0`; Binärdatei `-`).
fn log_lesen(aus: &[u8]) -> Option<HashMap<String, Metadaten>> {
    let mut felder = aus.split(|b| *b == 0).peekable();
    let mut ergebnis = HashMap::new();
    let text = |b: &[u8]| String::from_utf8_lossy(b).into_owned();
    while let Some(hash) = felder.next() {
        if hash.is_empty() && felder.peek().is_none() {
            break;
        }
        let hash = text(hash);
        if !(hash.len() == 40 || hash.len() == 64) || !hash.bytes().all(|b| b.is_ascii_hexdigit()) {
            return None;
        }
        let eltern = text(felder.next()?);
        let autor = text(felder.next()?);
        let datum = text(felder.next()?);
        let nachricht = text(felder.next()?);
        let erster_elternteil = eltern.split(' ').next().filter(|e| !e.is_empty()).map(String::from);
        let mut m = Metadaten { erster_elternteil, titel: nachricht.split('\n').next().unwrap_or_default().to_string(), autor, datum, plus: 0, minus: 0, dateien: 0 };
        if !felder.next()?.is_empty() {
            return None;
        }
        // Statistik: Einträge, bis das nächste Feld ein Hash ist (er enthält keinen Tabulator) oder die Ausgabe endet
        while let Some(feld) = felder.peek() {
            let eintrag = feld.strip_prefix(b"\n").unwrap_or(feld);
            if !eintrag.contains(&b'\t') {
                break;
            }
            felder.next();
            let teile: Vec<&[u8]> = eintrag.splitn(3, |b| *b == b'\t').collect();
            let [plus, minus, pfad] = teile.as_slice() else { return None };
            let zahl = |b: &[u8]| if b == b"-" { Some(0) } else { std::str::from_utf8(b).ok()?.parse::<u64>().ok() };
            m.plus += zahl(plus)?;
            m.minus += zahl(minus)?;
            m.dateien += 1;
            if pfad.is_empty() {
                felder.next()?;
                felder.next()?;
            }
        }
        ergebnis.insert(hash, m);
    }
    Some(ergebnis)
}

/// Was ein Diff vergleicht (ADR-0032 N4.6): den Commit mit seinem ersten Elternteil — ausdrücklich genannt, weil
/// `--first-parent` bei `diff-tree` nicht wirkt —, den Wurzel-Commit mit dem leeren Baum. Beide als volle Hashes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Vergleich<'a> {
    pub eltern: Option<&'a str>,
    pub commit: &'a str,
}

/// Welcher Lauf von `diff-tree`: Dateiliste (`--raw -z`), Zähler (`--numstat -z`) oder Patch (`-p`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Diffart {
    Roh,
    Zahlen,
    Patch,
}

/// Ein Lauf `diff-tree` mit Bytegrenze (ADR-0032 N4.3, N4.4, N4.7): Form und Inhalt bestimmt dieses Modul — `-r`,
/// Umbenennungen mit `-M50% -l1000`, Submodule kurz, im Patch volle Blob-Hashes (`--full-index`, N5.2) —, die Schalter
/// der Befehlszeile der Startort; `pfade` gehen wörtlich nach `--` (bei einer Umbenennung beide Pfade, sonst wird sie
/// zu `A`).
pub fn diff_tree(wurzel: &Path, vergleich: Vergleich, art: Diffart, pfade: &[&[u8]], bytegrenze: usize, frist: Instant) -> Result<Teil, Arbeitsrepofehler> {
    let mut args = vec!["-r", "-M50%", "-l1000", "--ignore-submodules=none"];
    args.extend_from_slice(match art {
        Diffart::Roh => &["--raw", "-z"][..],
        Diffart::Zahlen => &["--numstat", "-z"],
        Diffart::Patch => &["-p", "--full-index", "--submodule=short"],
    });
    match vergleich.eltern {
        Some(eltern) => args.extend(["--end-of-options", eltern, vergleich.commit]),
        None => args.extend(["--root", "--no-commit-id", "--end-of-options", vergleich.commit]),
    }
    git_teil(wurzel, Befehl::DiffTree, &args, pfade, bytegrenze, frist)
}

/// Höchstzahl der Zeilen von `rev-list` (ADR-0032 N3.4); darüber wird der Lauf abgebrochen, nie gekürzt.
pub const HOECHSTZEILEN_ZWEIGLISTE: usize = 3_000_000;

/// Grenze der zweiten Fingerabdruck-Probe am Ende einer Anfrage (ADR-0032 N3.2, Spielraum nach der Gesamtgrenze).
pub const ZEITGRENZE_PROBE: Duration = Duration::from_secs(2);

const SPITZEN: [&str; 3] = ["--format=%(objectname) %(refname)", "refs/heads", "refs/remotes"];

/// Fingerabdruck der Zweigspitzen: je Zeile `<hash> <ref>` aller lokalen und entfernten Zweige, sortiert nach Namen.
/// Bewegt sich ein Zweig, ändert er sich — die genaue Invalidierung des Caches (ADR-0032 N1.3).
pub fn fingerabdruck(wurzel: &Path, frist: Instant) -> Result<String, Arbeitsrepofehler> {
    lesen(wurzel, Befehl::ForEachRef, &SPITZEN, None, frist).map(|aus| String::from_utf8_lossy(&aus).into_owned())
}

/// Die zweite Probe am Ende der Anfrage, mit eigener Grenze von 2 s (ADR-0032 N3.2).
pub fn fingerabdruck_probe(wurzel: &Path) -> Result<String, Arbeitsrepofehler> {
    fingerabdruck(wurzel, Instant::now() + ZEITGRENZE_PROBE)
}

/// Z5 (ADR-0032 N3.4): je Commit die vollen Namen der Zweige aus `fingerabdruck`, die ihn erreichen — ein Lauf
/// `rev-list --parents` ab genau diesen Spitzen (über `stdin`), die Erreichbarkeit im Speicher. Weil nur die Spitzen des
/// Fingerabdrucks zählen, gilt das Ergebnis für ihn, auch wenn sich ein Zweig währenddessen bewegt. Commits, die kein
/// Zweig erreicht, fehlen im Ergebnis.
pub fn erreichbar(wurzel: &Path, fingerabdruck: &str, commits: &[&str], frist: Instant) -> Result<HashMap<String, Vec<String>>, Arbeitsrepofehler> {
    let mut je_spitze: HashMap<&str, Vec<&str>> = HashMap::new();
    // `refs/remotes/<entfernt>/HEAD` zeigt nur auf einen anderen entfernten Zweig; ein lokaler `feature/HEAD` zählt
    let verweis_auf_zweig = |n: &str| n.starts_with("refs/remotes/") && n.ends_with("/HEAD");
    for (spitze, name) in fingerabdruck.lines().filter_map(|z| z.split_once(' ')).filter(|(_, n)| !verweis_auf_zweig(n)) {
        je_spitze.entry(spitze).or_default().push(name);
    }
    if je_spitze.is_empty() || commits.is_empty() {
        return Ok(HashMap::new());
    }
    let eingabe: String = je_spitze.keys().map(|s| format!("{s}\n")).collect();
    let aus = git(wurzel, Befehl::RevList, &["--parents", "--stdin"], Lauf { zeitgrenze: grenze_bis(frist)?, eingabe: Some(eingabe.as_bytes()), hoechstzeilen: Some(HOECHSTZEILEN_ZWEIGLISTE) })?;
    if !aus.status.success() {
        let grund = String::from_utf8_lossy(&aus.stderr).lines().next().unwrap_or_default().trim().to_string();
        return Err(Arbeitsrepofehler::RepositoryFehlt(format!("Git verweigert {}: {grund}", wurzel.display())));
    }
    Graph::aus(&aus.stdout, frist)?.erreichbar(&je_spitze, commits, frist)
}

/// Alle so vielen Schritte prüft die Speicherphase von [`erreichbar`] die Frist — bei Millionen Kanten und Tausenden
/// Spitzen liefe sie sonst weit über die Gesamtgrenze hinaus.
const PRUEFTAKT: usize = 1 << 16;

/// Ist die Frist vorbei → `Zeitgrenze`; geprüft nur bei jedem [`PRUEFTAKT`]-ten Schritt.
fn frist_im_takt(schritt: usize, frist: Instant) -> Result<(), Arbeitsrepofehler> {
    if schritt % PRUEFTAKT == PRUEFTAKT - 1 && Instant::now() >= frist {
        return Err(Arbeitsrepofehler::Zeitgrenze);
    }
    Ok(())
}

/// Die Commits aus `rev-list --parents` (`<hash> <eltern>…` je Zeile) als Index und Elternlisten.
struct Graph<'a> {
    index: HashMap<&'a [u8], u32>,
    eltern: Vec<Vec<u32>>,
}

impl<'a> Graph<'a> {
    fn aus(text: &'a [u8], frist: Instant) -> Result<Graph<'a>, Arbeitsrepofehler> {
        let mut zeilen: Vec<Vec<&[u8]>> = vec![];
        for (i, z) in text.split(|b| *b == b'\n').filter(|z| !z.is_empty()).enumerate() {
            frist_im_takt(i, frist)?;
            zeilen.push(z.split(|b| *b == b' ').collect());
        }
        let index: HashMap<&[u8], u32> = zeilen.iter().enumerate().map(|(i, z)| (z[0], i as u32)).collect();
        let mut eltern = Vec::with_capacity(zeilen.len());
        for (i, z) in zeilen.iter().enumerate() {
            frist_im_takt(i, frist)?;
            eltern.push(z[1..].iter().filter_map(|e| index.get(e).copied()).collect());
        }
        Ok(Graph { index, eltern })
    }

    /// Je Commit die Namen der Spitzen, von denen aus er über Elternkanten erreichbar ist; je Spitze ein Lauf.
    fn erreichbar(&self, je_spitze: &HashMap<&str, Vec<&str>>, commits: &[&str], frist: Instant) -> Result<HashMap<String, Vec<String>>, Arbeitsrepofehler> {
        let ziele: HashMap<u32, &str> = commits.iter().filter_map(|c| self.index.get(c.as_bytes()).map(|&i| (i, *c))).collect();
        let mut ergebnis: HashMap<String, Vec<String>> = HashMap::new();
        let mut besucht = vec![usize::MAX; self.eltern.len()];
        let mut schritt = 0usize;
        for (lauf, (spitze, namen)) in je_spitze.iter().enumerate() {
            let Some(&start) = self.index.get(spitze.as_bytes()) else { continue };
            let mut stapel = vec![start];
            while let Some(k) = stapel.pop() {
                frist_im_takt(schritt, frist)?;
                schritt += 1;
                if std::mem::replace(&mut besucht[k as usize], lauf) == lauf {
                    continue;
                }
                if let Some(c) = ziele.get(&k) {
                    ergebnis.entry(c.to_string()).or_default().extend(namen.iter().map(|n| n.to_string()));
                }
                stapel.extend(&self.eltern[k as usize]);
            }
        }
        Ok(ergebnis)
    }
}

/// Wie ein Prozess läuft: Zeitgrenze, Eingabe auf `stdin`, höchste Zahl der Ausgabezeilen.
#[derive(Debug, Clone, Copy)]
pub(crate) struct Lauf<'a> {
    pub zeitgrenze: Duration,
    pub eingabe: Option<&'a [u8]>,
    pub hoechstzeilen: Option<usize>,
}

impl Lauf<'_> {
    pub fn mit(zeitgrenze: Duration) -> Lauf<'static> {
        Lauf { zeitgrenze, eingabe: None, hoechstzeilen: None }
    }
}

/// Der eine Startort für Git in einem Arbeits-Repository: fester Befehl, Argumentliste, Umgebung, Zeitgrenze, Zähler.
pub(crate) fn git(ordner: &Path, befehl: Befehl, args: &[&str], lauf: Lauf) -> Result<Output, Arbeitsrepofehler> {
    let c = kommando(ordner, befehl, args, std::env::vars_os().map(|(name, _)| name));
    AUFRUFE.with(|n| n.set(n.get() + 1));
    ausfuehren(c, lauf)
}

/// Die Befehlszeile samt den Schaltern, die aus dem Befehl folgen.
fn kommando(ordner: &Path, befehl: Befehl, args: &[&str], vorhandene: impl Iterator<Item = OsString>) -> Command {
    let schalter = befehl.schalter();
    debug_assert_eq!(befehl.erzeugt_diffs(), !schalter.nach.is_empty(), "{}: wer Diffs erzeugt, trägt Schalter", befehl.name());
    let verboten = args.iter().take_while(|a| **a != "--end-of-options" && **a != "--").find(|a| schalter.verboten.iter().any(|v| a.starts_with(v)));
    assert!(verboten.is_none(), "{} darf {verboten:?} nicht nennen — die Schalter setzt der Startort", befehl.name());
    gehaertet(ordner, schalter.vor, befehl.name(), &[schalter.nach, args].concat(), vorhandene)
}

/// Die gehärtete Umgebung um einen Befehl; `vorhandene` sind die Namen der Umgebungsvariablen der Instanz.
fn gehaertet(ordner: &Path, vor: &[&str], befehl: &str, args: &[&str], vorhandene: impl Iterator<Item = OsString>) -> Command {
    let mut c = Command::new("git");
    c.arg("-C").arg(ordner).args(SPERREN).args(vor).arg(befehl).args(args).env("GIT_OPTIONAL_LOCKS", "0").env("GIT_TERMINAL_PROMPT", "0");
    // ein Teilklon (`extensions.partialclone`) holte fehlende Objekte sonst von selbst nach — und startete dabei
    // `uploadpack`, `core.sshCommand` oder `credential.helper` aus der Konfiguration des Repositorys
    c.env("GIT_NO_LAZY_FETCH", "1");
    for v in UMLENKUNGEN.into_iter().chain(PROGRAMME) {
        c.env_remove(v);
    }
    for name in vorhandene.filter(|n| n.to_string_lossy().starts_with(KONFIGURATION)) {
        c.env_remove(name);
    }
    c.env("GIT_CONFIG_NOSYSTEM", "1").env("GIT_CONFIG_GLOBAL", "/dev/null");
    c
}

/// Startet `c` ohne Eingabe und wartet höchstens `zeitgrenze`; danach wird die Prozessgruppe beendet → `Zeitgrenze`.
pub fn laufen(c: Command, zeitgrenze: Duration) -> Result<Output, Arbeitsrepofehler> {
    ausfuehren(c, Lauf::mit(zeitgrenze))
}

/// Startet `c` in einer eigenen Prozessgruppe, schreibt die Eingabe, liest die Ausgaben mit und wartet höchstens bis zur
/// Zeitgrenze — auch auf die Ausgaben, die ein Kind von Git außerhalb der Gruppe noch offen hält. Endet Git, endet seine
/// Gruppe mit ihm; bei Zeitüberschreitung oder zu vielen Zeilen stirbt die ganze Gruppe. Ein abgebrochener Prozess
/// liefert nie eine (Teil-)Ausgabe.
fn ausfuehren(c: Command, lauf: Lauf) -> Result<Output, Arbeitsrepofehler> {
    match lesend_ausfuehren(c, lauf.eingabe, lauf.zeitgrenze, lauf.hoechstzeilen.map(Grenze::Zeilen))? {
        Gelesen::Ganz(aus) => Ok(aus),
        Gelesen::Abgeschnitten(_) => Err(Arbeitsrepofehler::Start("Teil ohne Bytegrenze".into())),
    }
}

/// Was ein Lauf mit Bytegrenze liefert (ADR-0032 N4.4): höchstens so viele Bytes, wie die Grenze erlaubt; `abgeschnitten`
/// heißt, Git hatte mehr — der Aufrufer behandelt die Ausgabe dann als unvollständig und verwirft ihr letztes Stück.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Teil {
    pub ausgabe: Vec<u8>,
    pub abgeschnitten: bool,
}

/// Der Lauf mit Bytegrenze (ADR-0032 N4.4) — nur für Befehle mit [`Befehl::liefert_teil`]; `pfade` gehen wörtlich nach
/// `--` an Git. Höchstens `bytegrenze` Byte; mehr Ausgabe → die ersten `bytegrenze` Byte als abgeschnittener Teil, die
/// Prozessgruppe stirbt, ihr Ausstiegsstatus zählt nicht. Ohne Abbruch heißt ein Status ≠ 0 `Start`. Zeitgrenze und Frist
/// liefern nie einen Teil, auch nicht nach gelesenen Bytes.
pub(crate) fn git_teil(ordner: &Path, befehl: Befehl, args: &[&str], pfade: &[&[u8]], bytegrenze: usize, frist: Instant) -> Result<Teil, Arbeitsrepofehler> {
    assert!(befehl.liefert_teil(), "{} liefert nie einen Teil — git() benutzen", befehl.name());
    let mut c = kommando(ordner, befehl, args, std::env::vars_os().map(|(name, _)| name));
    if !pfade.is_empty() {
        c.arg("--").args(pfade.iter().map(|p| std::ffi::OsStr::from_bytes(p)));
    }
    let zeitgrenze = grenze_bis(frist)?;
    AUFRUFE.with(|n| n.set(n.get() + 1));
    teil_ausfuehren(c, zeitgrenze, bytegrenze)
}

/// Der innere Lauf von [`git_teil`], ohne Befehl und Zähler.
fn teil_ausfuehren(c: Command, zeitgrenze: Duration, bytegrenze: usize) -> Result<Teil, Arbeitsrepofehler> {
    match lesend_ausfuehren(c, None, zeitgrenze, Some(Grenze::Bytes(bytegrenze)))? {
        Gelesen::Abgeschnitten(ausgabe) => Ok(Teil { ausgabe, abgeschnitten: true }),
        Gelesen::Ganz(aus) if aus.status.success() => Ok(Teil { ausgabe: aus.stdout, abgeschnitten: false }),
        Gelesen::Ganz(aus) => Err(Arbeitsrepofehler::Start(String::from_utf8_lossy(&aus.stderr).lines().next().unwrap_or_default().trim().to_string())),
    }
}

/// Wo das Mitlesen von `stdout` aufhört: nach so vielen Zeilen (Fehler) oder so vielen Bytes (Teil).
#[derive(Debug, Clone, Copy)]
enum Grenze {
    Zeilen(usize),
    Bytes(usize),
}

/// Ausgang eines Laufs: ganz, mit Status und beiden Strömen, oder an der Bytegrenze abgeschnitten.
enum Gelesen {
    Ganz(Output),
    Abgeschnitten(Vec<u8>),
}

/// Der gemeinsame innere Teil von [`git`] und [`git_teil`]: starten, schreiben, mitlesen, warten, Gruppe beenden.
fn lesend_ausfuehren(mut c: Command, eingabe: Option<&[u8]>, zeitgrenze: Duration, grenze: Option<Grenze>) -> Result<Gelesen, Arbeitsrepofehler> {
    let art = if eingabe.is_some() { Stdio::piped() } else { Stdio::null() };
    let mut kind = c.stdin(art).stdout(Stdio::piped()).stderr(Stdio::piped()).process_group(0).spawn().map_err(|e| Arbeitsrepofehler::Start(e.to_string()))?;
    let gruppe = kind.id() as i32;
    // nicht abgewartet: hält ein Kind von Git `stdin` offen, ohne zu lesen, hinge sonst die Anfrage
    if let Some(text) = eingabe {
        let mut ziel = kind.stdin.take();
        let text = text.to_vec();
        std::thread::spawn(move || ziel.as_mut().map(|z| z.write_all(&text)));
    }
    let zuviel = Arc::new(AtomicBool::new(false));
    let stdout = mitlesen(kind.stdout.take(), grenze.map(|g| (g, zuviel.clone())));
    let stderr = mitlesen(kind.stderr.take(), None);
    let ende = Instant::now() + zeitgrenze;
    let mut pause = Duration::from_millis(1);
    let status = loop {
        if zuviel.load(Ordering::SeqCst) {
            gruppe_beenden(gruppe, &mut kind);
            return ueber_der_grenze(grenze, bis_zum_ende(&stdout, ende)?);
        }
        match kind.try_wait().map_err(|e| Arbeitsrepofehler::Start(e.to_string()))? {
            Some(status) => break status,
            None if Instant::now() >= ende => {
                gruppe_beenden(gruppe, &mut kind);
                return Err(Arbeitsrepofehler::Zeitgrenze);
            }
            None => {
                std::thread::sleep(pause);
                pause = (pause * 2).min(Duration::from_millis(20));
            }
        }
    };
    // Git ist fertig: was es in seiner Gruppe zurückließ, endet jetzt. Die Gruppe trägt Gits PID; solange ein Mitglied
    // lebt, vergibt der Kern sie nicht neu — lebt keines mehr, trifft das Signal niemanden.
    // SAFETY: `kill` liest nur seine beiden Zahlen
    unsafe { kill(-gruppe, SIGKILL) };
    let aus = bis_zum_ende(&stdout, ende)?;
    if zuviel.load(Ordering::SeqCst) {
        return ueber_der_grenze(grenze, aus);
    }
    let stderr = bis_zum_ende(&stderr, ende)?;
    Ok(Gelesen::Ganz(Output { status, stdout: aus, stderr }))
}

/// Der Lesethread überschritt die Grenze: bei Zeilen ein Fehler, bei Bytes der gelesene Teil.
fn ueber_der_grenze(grenze: Option<Grenze>, aus: Vec<u8>) -> Result<Gelesen, Arbeitsrepofehler> {
    match grenze {
        Some(Grenze::Bytes(_)) => Ok(Gelesen::Abgeschnitten(aus)),
        Some(Grenze::Zeilen(n)) => Err(Arbeitsrepofehler::ZuvielAusgabe(n)),
        None => Err(Arbeitsrepofehler::Start("Grenze ohne Grenze".into())),
    }
}

/// Die ganze Ausgabe eines Lesethreads, wenn sie bis `ende` vollständig ist; sonst hält ein Kind außerhalb der Gruppe den
/// Strom offen → `Zeitgrenze` (der Thread endet mit dem Kind).
fn bis_zum_ende(strom: &Receiver<Vec<u8>>, ende: Instant) -> Result<Vec<u8>, Arbeitsrepofehler> {
    match strom.recv_timeout(ende.saturating_duration_since(Instant::now())) {
        Ok(text) => Ok(text),
        Err(RecvTimeoutError::Timeout) => Err(Arbeitsrepofehler::Zeitgrenze),
        Err(RecvTimeoutError::Disconnected) => Err(Arbeitsrepofehler::Start("Lesethread abgebrochen".into())),
    }
}

unsafe extern "C" {
    /// `kill(2)` der C-Bibliothek, die jedes Rust-Programm unter Unix ohnehin bindet.
    fn kill(pid: i32, signal: i32) -> i32;
}

const SIGKILL: i32 = 9;

/// Beendet die Prozessgruppe `gruppe` (Git und alle seine Kinder) und holt den Prozess ab.
fn gruppe_beenden(gruppe: i32, kind: &mut std::process::Child) {
    // SAFETY: `kill` liest nur seine beiden Zahlen; die Gruppe ist die des eigenen, noch nicht abgeholten Kindes
    unsafe { kill(-gruppe, SIGKILL) };
    let _ = kind.kill();
    let _ = kind.wait();
}

/// Liest einen Ausgabestrom in einem eigenen Thread leer, damit ein voller Puffer den Prozess nicht anhält; am Ende des
/// Stroms kommt alles über den Kanal. Mit `grenze` hört er an ihr auf und meldet es über den Schalter.
fn mitlesen(strom: Option<impl Read + Send + 'static>, grenze: Option<(Grenze, Arc<AtomicBool>)>) -> Receiver<Vec<u8>> {
    let (fertig, ergebnis) = mpsc::channel();
    std::thread::spawn(move || {
        let _ = fertig.send(leeren(strom, grenze));
    });
    ergebnis
}

/// Liest `strom` bis zum Ende; mit einer Zeilengrenze höchstens so viele Zeilen (darüber nichts), mit einer Bytegrenze
/// höchstens so viele Bytes (darüber genau die ersten).
fn leeren(strom: Option<impl Read>, grenze: Option<(Grenze, Arc<AtomicBool>)>) -> Vec<u8> {
    let mut puffer = vec![];
    let Some(mut s) = strom else { return puffer };
    let mut block = [0u8; 64 * 1024];
    let mut zeilen = 0usize;
    while let Ok(n) = s.read(&mut block) {
        if n == 0 {
            break;
        }
        puffer.extend_from_slice(&block[..n]);
        match &grenze {
            Some((Grenze::Zeilen(hoechstens), zuviel)) => {
                zeilen += block[..n].iter().filter(|b| **b == b'\n').count();
                if zeilen > *hoechstens {
                    zuviel.store(true, Ordering::SeqCst);
                    return vec![];
                }
            }
            Some((Grenze::Bytes(hoechstens), zuviel)) if puffer.len() > *hoechstens => {
                puffer.truncate(*hoechstens);
                zuviel.store(true, Ordering::SeqCst);
                return puffer;
            }
            _ => {}
        }
    }
    puffer
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::OsStr;

    /// Alle Befehle der abschließenden Liste — ein neuer gehört hier dazu.
    const ALLE: [Befehl; 6] = [Befehl::RevParse, Befehl::CatFile, Befehl::Log, Befehl::ForEachRef, Befehl::RevList, Befehl::DiffTree];

    fn umgebung(c: &Command) -> Vec<(String, Option<String>)> {
        c.get_envs().map(|(k, v)| (k.to_string_lossy().into(), v.map(|v| v.to_string_lossy().into()))).collect()
    }

    // Sicherheits-Befund Sollte 1 (Karte #207): was der eine Startort entfernt, setzt und jedem Befehl voranstellt
    #[test]
    fn umgebung_und_sperren_des_startorts() {
        let vorhanden = ["GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_SYSTEM", "GIT_TRACE", "HOME"].map(OsString::from);
        let c = kommando(Path::new("/r"), Befehl::RevParse, &["--show-toplevel"], vorhanden.into_iter());
        let args: Vec<&OsStr> = c.get_args().collect();
        assert_eq!(args, ["-C", "/r", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "rev-parse", "--show-toplevel"]);
        let env = umgebung(&c);
        let entfernt = |n: &str| env.contains(&(n.to_string(), None));
        for n in ["GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_SYSTEM", "GIT_EXTERNAL_DIFF", "GIT_PAGER", "PAGER", "GIT_EXEC_PATH", "GIT_ASKPASS", "GIT_SSH_COMMAND", "GIT_DIR", "GIT_WORK_TREE"] {
            assert!(entfernt(n), "{n} bleibt: {env:?}");
        }
        assert!(!entfernt("GIT_TRACE") && !entfernt("HOME"), "sonst bleibt die Umgebung: {env:?}");
        for gesetzt in [("GIT_CONFIG_NOSYSTEM", "1"), ("GIT_CONFIG_GLOBAL", "/dev/null"), ("GIT_OPTIONAL_LOCKS", "0"), ("GIT_TERMINAL_PROMPT", "0"), ("GIT_NO_LAZY_FETCH", "1")] {
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
            let mut c = gehaertet(&r, &[], befehl, args, std::iter::empty());
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

    fn args(c: &Command) -> Vec<String> {
        c.get_args().map(|a| a.to_string_lossy().into_owned()).collect()
    }

    // R00204 AK 14 (b), ADR-0032 N2.3: die Schalter folgen aus dem Befehl — `log` trägt sie, ohne dass der Aufrufer sie nennt;
    // Befehle ohne Diffs tragen sie nicht
    #[test]
    fn schalter_aus_dem_befehl() {
        let c = kommando(Path::new("/r"), Befehl::Log, &["--format=%H", "--end-of-options", "abc1234"], std::iter::empty());
        assert_eq!(args(&c), ["-C", "/r", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "core.quotepath=off", "log", "--no-ext-diff", "--no-textconv", "--no-color", "--no-show-signature", "--format=%H", "--end-of-options", "abc1234"]);
        for (befehl, name) in [(Befehl::RevParse, "rev-parse"), (Befehl::CatFile, "cat-file"), (Befehl::ForEachRef, "for-each-ref"), (Befehl::RevList, "rev-list")] {
            let c = kommando(Path::new("/r"), befehl, &["x"], std::iter::empty());
            assert_eq!(args(&c), ["-C", "/r", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", name, "x"], "{name}");
        }
    }

    // R00206 AK 16 (c), ADR-0032 N4.7: `diff-tree` trägt `-c core.quotepath=off --literal-pathspecs` vor und
    // `--no-ext-diff --no-textconv --no-color` nach dem Befehl, ohne dass der Aufrufer sie nennt — `--no-show-signature`
    // gehört nur zu `log`. Rot unter den Mutanten „--no-ext-diff weg“ und „--no-textconv weg“ (AK 16 d).
    #[test]
    fn schalter_von_diff_tree() {
        let c = kommando(Path::new("/r"), Befehl::DiffTree, &["-r", "-p", "a", "b"], std::iter::empty());
        assert_eq!(args(&c), ["-C", "/r", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "core.quotepath=off", "--literal-pathspecs", "diff-tree", "--no-ext-diff", "--no-textconv", "--no-color", "-r", "-p", "a", "b"]);
        for befehl in ALLE {
            assert_eq!(befehl.erzeugt_diffs(), !befehl.schalter().nach.is_empty(), "{befehl:?}: wer Diffs erzeugt, trägt Schalter");
        }
    }

    // R00206 AK 16 (c): bei `diff-tree` hebt der Aufrufer `--ext-diff`, `--textconv`, `--color…` nicht auf — auch nicht
    // vor `--`; dahinter ist es eine Pfadangabe
    #[test]
    fn schalter_von_diff_tree_lassen_sich_nicht_aufheben() {
        for boese in ["--ext-diff", "--textconv", "--color=always", "--color"] {
            let fehlschlag = std::panic::catch_unwind(|| kommando(Path::new("/r"), Befehl::DiffTree, &["-p", boese], std::iter::empty()));
            assert!(fehlschlag.is_err(), "{boese} angenommen");
        }
        let c = kommando(Path::new("/r"), Befehl::DiffTree, &["-p", "--", "--ext-diff"], std::iter::empty());
        assert_eq!(args(&c).last().map(String::as_str), Some("--ext-diff"), "hinter -- ist es eine Pfadangabe");
    }

    // R00206 AK 16 (c), ADR-0032 N4.7: die Befehlszeile jedes Befehls, der Diffs erzeugt, läuft gegen echtes Git und endet
    // mit Ausstiegscode 0 — ein Schalter, den ein Befehl verwirft, wird hier rot, nicht im Betrieb
    #[test]
    fn befehlszeilen_laufen_gegen_echtes_git() {
        let (_tmp, r, _, _) = feindlich();
        let kopf = String::from_utf8(Command::new("git").arg("-C").arg(&r).args(["rev-parse", "HEAD", "HEAD^"]).output().unwrap().stdout).unwrap();
        let [neu, alt]: [&str; 2] = kopf.split_whitespace().collect::<Vec<_>>().try_into().unwrap();
        let log = git(&r, Befehl::Log, &["--no-walk", "-p", "--format=%H", "--end-of-options", neu], Lauf::mit(ZEITGRENZE)).unwrap();
        assert!(log.status.success(), "log: {}", String::from_utf8_lossy(&log.stderr));
        for args in [&["-r", "-M50%", "-l1000", "--raw", "-z", alt, neu][..], &["-r", "-M50%", "-l1000", "--numstat", "-z", alt, neu], &["-r", "-M50%", "-l1000", "-p", "--full-index", "--submodule=short", alt, neu], &["-r", "--root", "--no-commit-id", "-p", alt]] {
            let teil = git_teil(&r, Befehl::DiffTree, args, &[b"a.txt"], 1 << 20, Instant::now() + ZEITGRENZE).unwrap_or_else(|f| panic!("{args:?}: {f:?}"));
            assert!(!teil.abgeschnitten && !teil.ausgabe.is_empty(), "{args:?}");
        }
    }

    // ADR-0032 N4.4 Regel 4: nur `diff-tree` darf einen Teil liefern; `git_teil` mit einem anderen Befehl bricht ab
    #[test]
    fn nur_diff_tree_liefert_einen_teil() {
        let teil: Vec<Befehl> = ALLE.into_iter().filter(|b| b.liefert_teil()).collect();
        assert_eq!(teil, [Befehl::DiffTree]);
        for befehl in ALLE.into_iter().filter(|b| !b.liefert_teil()) {
            let fehlschlag = std::panic::catch_unwind(|| git_teil(Path::new("/"), befehl, &[], &[], 10, Instant::now() + ZEITGRENZE));
            assert!(fehlschlag.is_err(), "{befehl:?} lieferte einen Teil");
        }
    }

    fn erzeuge(bytes: usize) -> Command {
        let mut c = Command::new("head");
        c.args(["-c", &bytes.to_string(), "/dev/zero"]);
        c
    }

    // R00206 AK 9 (Modul), ADR-0032 N4.4 Regel 1: genau `bytegrenze` Byte sind ganz, ein Byte mehr ist ein Teil mit genau
    // `bytegrenze` Byte — mit der Grenze für einzeln geladene Dateien (20.971.520) und einer kleinen
    #[test]
    fn bytegrenze_genau_und_eins_mehr() {
        for grenze in [20_971_520usize, 1000] {
            let ganz = teil_ausfuehren(erzeuge(grenze), Duration::from_secs(20), grenze).unwrap();
            assert_eq!((ganz.ausgabe.len(), ganz.abgeschnitten), (grenze, false), "genau {grenze}");
            let teil = teil_ausfuehren(erzeuge(grenze + 1), Duration::from_secs(20), grenze).unwrap();
            assert_eq!((teil.ausgabe.len(), teil.abgeschnitten), (grenze, true), "{grenze} + 1");
        }
        let endlos = teil_ausfuehren(Command::new("yes"), Duration::from_secs(20), 4_194_304).unwrap();
        assert_eq!((endlos.ausgabe.len(), endlos.abgeschnitten), (4_194_304, true), "endlose Ausgabe");
        assert!(endlos.ausgabe.starts_with(b"y\ny\n"));
    }

    /// Ein Skript, das `vorher` ausgibt, ein Kind startet (`sleep 300`), beide PIDs in `pids` schreibt und dann `danach` tut.
    fn mit_kind(tmp: &Path, vorher: &str, danach: &str) -> (Command, PathBuf) {
        let pids = tmp.join("pids");
        let skript = tmp.join("skript.sh");
        std::fs::write(&skript, format!("#!/bin/sh\nsleep 300 &\necho \"$$ $!\" > {}\n{vorher}\n{danach}\n", pids.display())).unwrap();
        let mut c = Command::new("sh");
        c.arg(&skript);
        (c, pids)
    }

    fn lebt(pid: &str) -> bool {
        let ende = Instant::now() + Duration::from_secs(2);
        loop {
            let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).unwrap_or_default();
            let lebt = !stat.is_empty() && !stat.rsplit(')').next().unwrap_or_default().trim_start().starts_with('Z');
            if !lebt || Instant::now() >= ende {
                return lebt;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    // ADR-0032 N4.4 Regel 2: an der Bytegrenze stirbt die ganze Prozessgruppe — das Skript und sein Kind
    #[test]
    fn bytegrenze_beendet_die_prozessgruppe() {
        let tmp = tempfile::tempdir().unwrap();
        let (c, pids) = mit_kind(tmp.path(), "", "exec yes");
        let start = Instant::now();
        let teil = teil_ausfuehren(c, Duration::from_secs(20), 1 << 20).unwrap();
        assert!(teil.abgeschnitten && start.elapsed() < Duration::from_secs(10), "{:?}", start.elapsed());
        let text = std::fs::read_to_string(&pids).unwrap();
        let (skript, kind) = text.trim().split_once(' ').unwrap();
        assert!(!lebt(skript), "das Skript lebt");
        assert!(!lebt(kind), "das Kind lebt");
    }

    // ADR-0032 N4.4 Regel 3: die Zeitgrenze liefert nie einen Teil — auch nicht, wenn schon 1 MB gelesen ist; die
    // Gruppe stirbt auch hier
    #[test]
    fn zeitgrenze_liefert_nie_einen_teil() {
        let tmp = tempfile::tempdir().unwrap();
        let (c, pids) = mit_kind(tmp.path(), "head -c 1048576 /dev/zero", "sleep 60");
        let start = Instant::now();
        assert_eq!(teil_ausfuehren(c, Duration::from_secs(1), 4 << 20), Err(Arbeitsrepofehler::Zeitgrenze));
        assert!(start.elapsed() < Duration::from_secs(5), "{:?}", start.elapsed());
        let text = std::fs::read_to_string(&pids).unwrap();
        let (skript, kind) = text.trim().split_once(' ').unwrap();
        assert!(!lebt(skript) && !lebt(kind), "Gruppe lebt");
        // `git()` ebenso: Zeitgrenze ist Err, nie ein Teil
        let (c, _) = mit_kind(tmp.path(), "head -c 1048576 /dev/zero", "sleep 60");
        assert_eq!(ausfuehren(c, Lauf::mit(Duration::from_secs(1))).map(|_| ()), Err(Arbeitsrepofehler::Zeitgrenze));
    }

    // ADR-0032 N4.4: `git()` liefert immer die ganze Ausgabe — mehr als jede Bytegrenze des Diffs —, nie einen Teil
    #[test]
    fn git_liefert_nie_einen_teil() {
        let aus = ausfuehren(erzeuge(25 << 20), Lauf::mit(Duration::from_secs(20))).unwrap();
        assert_eq!(aus.stdout.len(), 25 << 20);
        let aus = ausfuehren(erzeuge(25 << 20), Lauf { hoechstzeilen: Some(3), ..Lauf::mit(Duration::from_secs(20)) }).unwrap();
        assert_eq!(aus.stdout.len(), 25 << 20, "ohne Zeilenumbruch keine Zeilengrenze");
    }

    // R00206 AK 16 (a) am Startort: `diff-tree -p` im feindlichen Repository startet weder `diff.external` noch
    // `diff.x.command`/`diff.x.textconv` (mit `.gitattributes`) noch `GIT_EXTERNAL_DIFF`; Gegenproben: `git diff`,
    // `git diff-tree -p --textconv` und `git diff-tree -p --ext-diff` direkt in R legen die Marke an
    #[test]
    fn diff_tree_im_feindlichen_repository_fuehrt_nichts_aus() {
        let (_tmp, r, marke, s) = feindlich();
        let roh = |args: &[&str]| Command::new("git").arg("-C").arg(&r).args(args).env("GIT_EXTERNAL_DIFF", &s).output().unwrap();
        roh(&["diff", "HEAD^", "HEAD"]);
        assert!(marke.exists(), "Gegenprobe 1: git diff startet das Skript");
        std::fs::remove_file(&marke).unwrap();
        roh(&["diff-tree", "-r", "-p", "--textconv", "HEAD^", "HEAD"]);
        assert!(marke.exists(), "Gegenprobe 2: diff-tree --textconv startet textconv");
        std::fs::remove_file(&marke).unwrap();
        roh(&["-c", "core.fsmonitor=false", "diff-tree", "-r", "-p", "--ext-diff", "HEAD^", "HEAD"]);
        assert!(marke.exists(), "Gegenprobe 3: diff-tree --ext-diff startet diff.x.command aus .gitattributes");
        std::fs::remove_file(&marke).unwrap();
        let kopf = String::from_utf8(roh(&["rev-parse", "HEAD", "HEAD^"]).stdout).unwrap();
        let [neu, alt]: [&str; 2] = kopf.split_whitespace().collect::<Vec<_>>().try_into().unwrap();
        let teil = git_teil(&r, Befehl::DiffTree, &["-r", "-p", alt, neu], &[], 1 << 20, Instant::now() + ZEITGRENZE).unwrap();
        let text = String::from_utf8(teil.ausgabe).unwrap();
        assert!(text.contains("-a\n+b\n"), "{text}");
        assert!(!text.contains('\u{1b}'), "ohne Farben");
        assert!(!marke.exists(), "ein Skript lief: {}", std::fs::read_to_string(&marke).unwrap_or_default());
    }

    // AK 14 (b): der Aufrufer kann die Schalter nicht aufheben — `--ext-diff`, `--textconv`, `--color…`, `--show-signature`
    // vor `--end-of-options` sind eine verletzte Invariante
    #[test]
    fn schalter_lassen_sich_nicht_aufheben() {
        for boese in ["--ext-diff", "--textconv", "--color=always", "--show-signature"] {
            let fehlschlag = std::panic::catch_unwind(|| kommando(Path::new("/r"), Befehl::Log, &[boese], std::iter::empty()));
            assert!(fehlschlag.is_err(), "{boese} angenommen");
        }
        let c = kommando(Path::new("/r"), Befehl::Log, &["--end-of-options", "--ext-diff"], std::iter::empty());
        assert_eq!(args(&c).last().map(String::as_str), Some("--ext-diff"), "hinter --end-of-options ist es ein Verweis, kein Schalter");
    }

    /// Ein Wegwerf-Repository mit einem Skript, das bei jedem Lauf eine Marke anlegt.
    fn feindlich() -> (tempfile::TempDir, PathBuf, PathBuf, String) {
        let tmp = tempfile::tempdir().unwrap();
        let r = tmp.path().canonicalize().unwrap().join("R");
        std::fs::create_dir_all(&r).unwrap();
        let git = |args: &[&str]| assert!(Command::new("git").arg("-C").arg(&r).args(["-c", "user.name=A", "-c", "user.email=a@a"]).args(args).status().unwrap().success(), "{args:?}");
        git(&["init", "-q", "-b", "main"]);
        std::fs::write(r.join("a.txt"), "a\n").unwrap();
        git(&["add", "a.txt"]);
        git(&["commit", "-qm", "a"]);
        std::fs::write(r.join("a.txt"), "b\n").unwrap();
        git(&["commit", "-qam", "b"]);
        let marke = tmp.path().join("marke");
        let skript = tmp.path().join("skript.sh");
        std::fs::write(&skript, format!("#!/bin/sh\necho \"$0 $@\" >> {}\nexit 1\n", marke.display())).unwrap();
        std::fs::set_permissions(&skript, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
        let s = skript.to_str().unwrap().to_string();
        std::fs::write(r.join(".gitattributes"), "* diff=x\n").unwrap();
        for (k, v) in [("diff.external", s.as_str()), ("diff.x.command", s.as_str()), ("diff.x.textconv", s.as_str()), ("log.showSignature", "true"), ("gpg.program", s.as_str()), ("color.ui", "always")] {
            git(&["config", k, v]);
        }
        (tmp, r, marke, s)
    }

    // AK 14 (a) am Startort: `log -p` im feindlichen Repository startet weder Diff-Treiber noch textconv noch gpg — und
    // derselbe Befehl ohne die Schalter aus dem Befehl doch (Gegenprobe)
    #[test]
    fn log_im_feindlichen_repository_fuehrt_nichts_aus() {
        let (_tmp, r, marke, _) = feindlich();
        gehaertet(&r, &[], "log", &["-p", "-1"], std::iter::empty()).output().unwrap();
        assert!(marke.exists(), "Gegenprobe: ohne die Schalter läuft das Skript");
        std::fs::remove_file(&marke).unwrap();
        let aus = git(&r, Befehl::Log, &["-p", "-1"], Lauf::mit(ZEITGRENZE)).unwrap();
        assert!(aus.status.success(), "{}", String::from_utf8_lossy(&aus.stderr));
        assert!(String::from_utf8_lossy(&aus.stdout).contains("+b"), "der Diff steht da");
        assert!(!aus.stdout.contains(&0x1b), "ohne Farben");
        assert!(!marke.exists(), "ein Skript lief: {}", std::fs::read_to_string(&marke).unwrap_or_default());
    }

    // R00204 B0999: `cat-file --batch-check` liest die Namen über stdin, nie als Argument
    #[test]
    fn eingabe_ueber_stdin() {
        let (_tmp, r, _, _) = feindlich();
        let kopf = String::from_utf8(Command::new("git").arg("-C").arg(&r).args(["rev-parse", "HEAD"]).output().unwrap().stdout).unwrap();
        let aus = git(&r, Befehl::CatFile, &["--batch-check"], Lauf { eingabe: Some(format!("{}\n0000000000\n", kopf.trim()).as_bytes()), ..Lauf::mit(ZEITGRENZE) }).unwrap();
        let text = String::from_utf8(aus.stdout).unwrap();
        assert!(text.starts_with(&format!("{} commit ", kopf.trim())), "{text}");
        assert!(text.ends_with("0000000000 missing\n"), "{text}");
    }

    /// `n` Commits in einer Kette, wie `rev-list --parents` sie ausgibt (neuester zuerst).
    fn kette(n: usize) -> String {
        (0..n).rev().map(|i| if i == 0 { format!("c{i}\n") } else { format!("c{i} c{}\n", i - 1) }).collect()
    }

    // Nacharbeit #211 (Code-Review S2, Security Sollte 1): die Speicherphase prüft die Frist im Takt — beim Einlesen und
    // beim Gang über die Kanten; mit offener Frist läuft sie durch
    #[test]
    fn speicherphase_prueft_die_frist() {
        let text = kette(3 * PRUEFTAKT);
        let vorbei = Instant::now();
        assert_eq!(Graph::aus(text.as_bytes(), vorbei).map(|_| ()), Err(Arbeitsrepofehler::Zeitgrenze), "Einlesen");
        let offen = Instant::now() + Duration::from_secs(60);
        let graph = Graph::aus(text.as_bytes(), offen).unwrap();
        let spitze = format!("c{}", 3 * PRUEFTAKT - 1);
        let je_spitze: HashMap<&str, Vec<&str>> = [(spitze.as_str(), vec!["refs/heads/main"])].into();
        assert_eq!(graph.erreichbar(&je_spitze, &["c0"], vorbei), Err(Arbeitsrepofehler::Zeitgrenze), "Gang über die Kanten");
        assert_eq!(graph.erreichbar(&je_spitze, &["c0"], offen).unwrap()["c0"], ["refs/heads/main"]);
        // unter einem Takt fragt niemand die Uhr — kurze Läufe zahlen nichts
        let kurz = kette(PRUEFTAKT - 1);
        assert!(Graph::aus(kurz.as_bytes(), vorbei).is_ok());
    }

    // ADR-0032 N3.4: mehr Zeilen als erlaubt → der Prozess wird beendet, keine gekürzte Ausgabe; bis zur Grenze läuft er durch
    #[test]
    fn zeilengrenze_beendet_den_prozess() {
        let mut c = Command::new("yes");
        c.arg("0123456789abcdef");
        let start = Instant::now();
        assert_eq!(ausfuehren(c, Lauf { hoechstzeilen: Some(3_000_000), ..Lauf::mit(Duration::from_secs(20)) }).map(|_| ()), Err(Arbeitsrepofehler::ZuvielAusgabe(3_000_000)));
        assert!(start.elapsed() < Duration::from_secs(10), "{:?}", start.elapsed());
        let mut c = Command::new("seq");
        c.arg("3000000");
        let aus = ausfuehren(c, Lauf { hoechstzeilen: Some(3_000_000), ..Lauf::mit(Duration::from_secs(20)) }).unwrap();
        assert_eq!(aus.stdout.iter().filter(|b| **b == b'\n').count(), 3_000_000);
    }
}
