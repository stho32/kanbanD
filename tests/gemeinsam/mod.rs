//! Startet das echte Programm gegen einen Ordner und liefert seine Adresse.
#![allow(dead_code)]

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

pub struct Laufendes {
    pub kind: Child,
    pub adresse: String,
    /// stderr der Instanz, wenn `beobachtet_starten` es mitschneidet; erscheint beim Beenden in der Testausgabe.
    mitschnitt: Option<tempfile::NamedTempFile>,
    /// Der Log-Ordner dieser Wegwerf-Instanz (`--log-ordner`): er bleibt außerhalb des Board-Ordners und außerhalb
    /// von `~/.local/state/kanbanD` (R00258, ADR-0001 N1.2 Regel 1).
    _log: Option<tempfile::TempDir>,
}

impl Drop for Laufendes {
    fn drop(&mut self) {
        geordnet_beenden(&mut self.kind);
        if let Some(mitschnitt) = &self.mitschnitt {
            eprint!("{}", std::fs::read_to_string(mitschnitt.path()).unwrap_or_default());
        }
    }
}

impl Laufendes {
    /// Der Log-Ordner dieser Wegwerf-Instanz (`--log-ordner`) — R00269 AK 8 liest daraus die letzte Zeile nach SIGTERM.
    pub fn log_ordner(&self) -> Option<&Path> {
        self._log.as_ref().map(|t| t.path())
    }
}

/// SIGTERM, damit das Programm geordnet endet (und seine Coverage schreibt); notfalls hart.
pub fn geordnet_beenden(kind: &mut Child) {
    let _ = Command::new("kill").args(["-TERM", &kind.id().to_string()]).status();
    for _ in 0..100 {
        if let Ok(Some(_)) = kind.try_wait() {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    let _ = kind.kill();
    let _ = kind.wait();
}

pub fn starten(ordner: &Path, zusatz: &[&str]) -> Laufendes {
    starten_mit(ordner, zusatz, &[])
}

/// Wie `starten`, mit fester Zone Europe/Berlin — für Erwartungen an den Versatz (R00084).
pub fn starten_in_berlin(ordner: &Path, zusatz: &[&str]) -> Laufendes {
    starten_mit(ordner, zusatz, &[("TZ", "Europe/Berlin")])
}

pub fn starten_mit(ordner: &Path, zusatz: &[&str], umgebung: &[(&str, &str)]) -> Laufendes {
    gestartet(ordner, zusatz, umgebung, Stdio::inherit())
}

/// Obergrenze für das Warten auf einen beobachtenden Wächter, ab dem ersten Startversuch (ADR-0026, Regel 7).
pub const WAECHTER_OBERGRENZE: Duration = Duration::from_secs(30);

/// Wie `starten`, für Tests, die ein Live-Ereignis erwarten: liefert die Instanz erst, wenn ihr Wächter beobachtet.
/// Bereitzeichen: nach der ersten HTTP-Antwort (Router und Wächter sind dann gebaut) steht auf ihrem stderr keine
/// Zeile „… nicht beobachtet“. Sonst wird sie beendet und neu gestartet, siehe `bis_beobachtet`.
pub fn beobachtet_starten(ordner: &Path, zusatz: &[&str]) -> Laufendes {
    bis_beobachtet(WAECHTER_OBERGRENZE, || {
        let mitschnitt = tempfile::NamedTempFile::new().unwrap();
        let mut lauf = gestartet(ordner, zusatz, &[], Stdio::from(mitschnitt.reopen().unwrap()));
        erste_antwort_abwarten(&lauf.adresse);
        let stderr = std::fs::read_to_string(mitschnitt.path()).unwrap_or_default();
        if stderr.contains("nicht beobachtet") {
            return Err(stderr.trim().to_string());
        }
        lauf.mitschnitt = Some(mitschnitt);
        Ok(lauf)
    })
}

/// Wiederholt `versuch`, bis er einen beobachtenden Wächter liefert. inotify-Instanzen sind je Benutzer über alle
/// Prozesse begrenzt (`max_user_instances`); sind sie belegt, startet kein Wächter, und kein Ereignis käme je an.
/// Nach `obergrenze` scheitert der Test deshalb mit dieser Ursache statt später mit „kein passendes Ereignis“.
pub fn bis_beobachtet<T, E: std::fmt::Display>(obergrenze: Duration, mut versuch: impl FnMut() -> Result<T, E>) -> T {
    let ende = Instant::now() + obergrenze;
    loop {
        match versuch() {
            Ok(wert) => return wert,
            Err(grund) if Instant::now() >= ende => panic!("inotify-Grenze der Umgebung: nach {obergrenze:?} kein beobachtender Wächter ({grund})"),
            Err(_) => std::thread::sleep(Duration::from_millis(250)),
        }
    }
}

fn erste_antwort_abwarten(adresse: &str) {
    use std::io::{Read, Write};
    let ziel = adresse.trim_start_matches("http://").trim_end_matches('/');
    let mut leitung = std::net::TcpStream::connect(ziel).expect("Instanz nimmt Verbindungen an");
    leitung.set_read_timeout(Some(Duration::from_secs(10))).unwrap();
    leitung.write_all(b"GET / HTTP/1.0\r\n\r\n").unwrap();
    leitung.read_exact(&mut [0u8; 1]).expect("erste HTTP-Antwort der Instanz");
}

/// Wie `starten`, aber aus `arbeitsordner` heraus mit `ordner` als Argument — für `kanbanD .` (R00183).
pub fn starten_aus(arbeitsordner: &Path, ordner: &Path, zusatz: &[&str]) -> Laufendes {
    let mut befehl = Command::new(env!("CARGO_BIN_EXE_kanbanD"));
    befehl.current_dir(arbeitsordner);
    aus_befehl(befehl, ordner, zusatz, Stdio::inherit())
}

fn gestartet(ordner: &Path, zusatz: &[&str], umgebung: &[(&str, &str)], stderr: Stdio) -> Laufendes {
    let mut befehl = Command::new(env!("CARGO_BIN_EXE_kanbanD"));
    befehl.envs(umgebung.iter().copied());
    aus_befehl(befehl, ordner, zusatz, stderr)
}

fn aus_befehl(mut befehl: Command, ordner: &Path, zusatz: &[&str], stderr: Stdio) -> Laufendes {
    // Jede Wegwerf-Instanz bekommt einen eigenen Log-Ordner im Wegwerf-Bereich — nie im Board-Ordner, nie im
    // Zustandsordner des Benutzers (R00258 FA 2).
    let log = tempfile::tempdir().expect("Log-Ordner der Wegwerf-Instanz");
    let mut kind = befehl
        .arg(ordner)
        .args(["--kein-browser", "--host", "127.0.0.1", "--log-ordner"])
        .arg(log.path())
        .args(zusatz)
        .stdout(Stdio::piped())
        .stderr(stderr)
        .spawn()
        .expect("kanbanD startet");
    let mut zeile = String::new();
    BufReader::new(kind.stdout.take().unwrap()).read_line(&mut zeile).unwrap();
    let adresse = zeile.split_whitespace().last().expect("Adresse in der Startzeile").to_string();
    Laufendes { kind, adresse, mitschnitt: None, _log: Some(log) }
}

/// R00215: Die Verzögerung je Aufruf für [`langsames_git`], gemessen in B1091: eine Einzelanfrage über `gross1.txt`
/// braucht damit 1,5–3 s.
pub const LANGSAM_D: &str = "0.15";

/// R00215: ein `git` vorn im `PATH` des Servers, das jeden Aufruf im Arbeits-Repository `r` um `d` Sekunden verzögert
/// und dann das echte Git ausführt — so dauert eine Anfrage länger, ohne Rechenzeit zu kosten. Liefert den Wert für `PATH`.
/// Nur Unix: Shell-Skript mit `sh`, Ausführungsrecht über `PermissionsExt`, Trenner `:` im `PATH`.
pub fn langsames_git(r: &Path, d: &str) -> String {
    let echt = String::from_utf8(Command::new("sh").args(["-c", "command -v git"]).output().unwrap().stdout).unwrap().trim().to_string();
    let ordner = r.parent().unwrap().join("bin-langsam");
    std::fs::create_dir_all(&ordner).unwrap();
    let skript = format!("#!/bin/sh\ncase \"$*\" in *\"{r}\"*) sleep {d} ;; esac\nexec {echt} \"$@\"\n", r = r.display());
    std::fs::write(ordner.join("git"), skript).unwrap();
    std::fs::set_permissions(ordner.join("git"), std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    format!("{}:{}", ordner.display(), std::env::var("PATH").unwrap())
}

// ---- R00215: viele Verbindungen, die nach der Statuszeile nichts mehr lesen (R00206 AK 20 b, R00208 AK 8) ------------

// Nur Unix: `setsockopt` der libc auf dem rohen Dateideskriptor des Sockets.
unsafe extern "C" {
    fn setsockopt(fd: i32, ebene: i32, name: i32, wert: *const std::ffi::c_void, laenge: u32) -> i32;
}

/// So viele Anfragen sind höchstens zugleich unterwegs — wie die Plätze der Lesegrenze des Programms
/// (`LESEN_HOECHSTENS`): dann wartet keine Anfrage auf einen Platz, und die Frist misst nur ihren eigenen Lauf.
/// Bewusst doppelt: `dienst::lesegrenze` ist privat, und R00215 lässt `src/` unverändert — ändert sich
/// `LESEN_HOECHSTENS`, hier mitziehen.
pub const UNTERWEGS_HOECHSTENS: usize = 4;

/// N Verbindungen, deren Statuszeile gelesen ist; alle noch offen, nach der Statuszeile ungelesen.
pub struct Gestaffelt {
    pub verbindungen: Vec<(std::net::TcpStream, u16)>,
    /// Die größte Zahl Anfragen, die zugleich unterwegs waren (Platz genommen, Statuszeile noch nicht da).
    pub hoechstens_unterwegs: usize,
}

impl Gestaffelt {
    /// Wie viele Verbindungen noch offen sind und ungelesene Bytes der Antwort vor sich haben.
    pub fn offen_und_ungelesen(&self) -> usize {
        self.verbindungen.iter().filter(|(s, _)| wartet_auf_leser(s)).count()
    }
}

/// Öffnet `n` Verbindungen auf `pfad`, höchstens [`UNTERWEGS_HOECHSTENS`] zugleich unterwegs: Platz nehmen vor dem
/// Verbinden, freigeben nach dem Eingang der Statuszeile. Gelesen wird je Verbindung nur die Statuszeile.
pub fn gestaffelt(adresse: &str, pfad: &str, n: usize) -> Gestaffelt {
    let plaetze = Plaetze::default();
    let verbindungen = std::thread::scope(|s| {
        let faeden: Vec<_> = (0..n).map(|_| s.spawn(|| {
            let _platz = plaetze.nehmen();
            nur_statuszeile(adresse, pfad)
        })).collect();
        faeden.into_iter().map(|t| t.join().unwrap()).collect()
    });
    Gestaffelt { verbindungen, hoechstens_unterwegs: plaetze.zustand.lock().unwrap().1 }
}

/// Zähler der Anfragen unterwegs und ihr Höchststand.
#[derive(Default)]
struct Plaetze {
    zustand: std::sync::Mutex<(usize, usize)>,
    frei: std::sync::Condvar,
}

struct Platz<'a>(&'a Plaetze);

impl Plaetze {
    fn nehmen(&self) -> Platz<'_> {
        let mut z = self.frei.wait_while(self.zustand.lock().unwrap(), |z| z.0 >= UNTERWEGS_HOECHSTENS).unwrap();
        z.0 += 1;
        z.1 = z.1.max(z.0);
        Platz(self)
    }
}

impl Drop for Platz<'_> {
    fn drop(&mut self) {
        self.0.zustand.lock().unwrap().0 -= 1;
        self.0.frei.notify_one();
    }
}

/// Eine Verbindung mit kleinem Empfangspuffer (`SO_RCVBUF` 4096), die die Anfrage sendet und nur die Statuszeile liest.
fn nur_statuszeile(adresse: &str, pfad: &str) -> (std::net::TcpStream, u16) {
    use std::io::{Read, Write};
    use std::os::fd::AsRawFd;
    let ziel = adresse.trim_start_matches("http://").trim_end_matches('/');
    let mut s = std::net::TcpStream::connect(ziel).unwrap();
    let klein: i32 = 4096;
    assert_eq!(unsafe { setsockopt(s.as_raw_fd(), 1, 8, (&raw const klein).cast(), 4) }, 0, "SO_RCVBUF");
    s.write_all(format!("GET /{pfad} HTTP/1.1\r\nHost: {ziel}\r\n\r\n").as_bytes()).unwrap();
    let mut zeile = vec![];
    let mut b = [0u8; 1];
    while !zeile.ends_with(b"\r\n") {
        s.read_exact(&mut b).unwrap();
        zeile.push(b[0]);
    }
    let status = String::from_utf8(zeile).unwrap().split_whitespace().nth(1).unwrap().parse().unwrap();
    (s, status)
}

/// Offen und mit ungelesenen Bytes: ein Blick ohne Lesen findet Daten (kein Ende der Verbindung).
fn wartet_auf_leser(s: &std::net::TcpStream) -> bool {
    s.set_nonblocking(true).unwrap();
    let blick = s.peek(&mut [0u8; 1]);
    s.set_nonblocking(false).unwrap();
    matches!(blick, Ok(1))
}

/// Der Rest einer kleinen Antwort mit `Content-Length` (die Statuszeile ist schon gelesen): der Rumpf als Text.
pub fn rest_lesen(s: &mut std::net::TcpStream) -> String {
    use std::io::Read;
    let mut kopf = vec![];
    let mut b = [0u8; 1];
    while !kopf.ends_with(b"\r\n\r\n") {
        s.read_exact(&mut b).unwrap();
        kopf.push(b[0]);
    }
    let kopf = String::from_utf8(kopf).unwrap().to_ascii_lowercase();
    let laenge: usize = kopf.lines().find_map(|z| z.strip_prefix("content-length:")).unwrap().trim().parse().unwrap();
    let mut rumpf = vec![0u8; laenge];
    s.read_exact(&mut rumpf).unwrap();
    String::from_utf8(rumpf).unwrap()
}

pub fn git(pfad: &Path, args: &[&str]) -> String {
    let a = Command::new("git").arg("-C").arg(pfad).args(args).output().unwrap();
    String::from_utf8_lossy(&a.stdout).trim().to_string()
}

pub const EINSTELLUNGEN: &str = "---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\n  ab: {name: Anna, kind: human, active: false}\nclasses:\n  bug: {label: Fehler, color: red}\nsources:\n  wbs: plan/wbs.md\n  requirements: anf/\n---\n";

/// Ein eingerichteter Ordner: Stefan (Mensch), Claude (Agent), Anna (stillgelegt), Board „Entwicklung“.
pub fn eingerichtet(pfad: &Path) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), EINSTELLUNGEN).unwrap();
    std::fs::write(pfad.join("boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n").unwrap();
    git(pfad, &["init", "-q"]);
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
}

pub fn eingerichtet_starten(pfad: &Path) -> Laufendes {
    eingerichtet(pfad);
    starten(pfad, &["--port", "0"])
}

pub fn eingerichtet_beobachtet_starten(pfad: &Path) -> Laufendes {
    eingerichtet(pfad);
    beobachtet_starten(pfad, &["--port", "0"])
}

/// Schreibender Aufruf als Person.
pub async fn senden(methode: reqwest::Method, adresse: &str, pfad: &str, wer: &str, daten: serde_json::Value) -> (u16, serde_json::Value) {
    let r = reqwest::Client::new().request(methode, format!("{adresse}{pfad}")).header("X-KanbanD-Wer", wer).json(&daten).send().await.unwrap();
    let status = r.status().as_u16();
    let text = r.text().await.unwrap();
    (status, serde_json::from_str(&text).unwrap_or(serde_json::Value::Null))
}

pub fn lies(pfad: &Path, rel: &str) -> String {
    std::fs::read_to_string(pfad.join(rel)).unwrap_or_default()
}

/// Wie `eingerichtet`, dazu Aufgaben 1, 2, 3 in „Zu erledigen“.
pub fn mit_drei_aufgaben(pfad: &Path) {
    eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    for (n, t) in [(1, "eins"), (2, "zwei"), (3, "drei")] {
        std::fs::write(pfad.join(format!("aufgaben/000{n}-{t}.md")), format!("---\nid: {n}\ntitle: {t}\n---\n")).unwrap();
    }
    std::fs::write(pfad.join("boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## In Arbeit\n\n## Erledigt\n").unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "drei Aufgaben"]);
}

/// Liest SSE-Zeilen `data: …` vom Ereignisstrom, bis `bedingung` erfüllt ist (höchstens 3 s).
pub async fn ereignis_abwarten(adresse: &str, ausloesen: impl FnOnce(), bedingung: impl Fn(&serde_json::Value) -> bool) -> serde_json::Value {
    use futures_util::StreamExt;
    let antwort = reqwest::get(format!("{adresse}api/ereignisse")).await.unwrap();
    assert_eq!(antwort.headers()["content-type"], "text/event-stream");
    let mut strom = antwort.bytes_stream();
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    ausloesen();
    let mut puffer = String::new();
    let ende = tokio::time::Instant::now() + std::time::Duration::from_secs(3);
    while let Ok(Some(Ok(teil))) = tokio::time::timeout_at(ende, strom.next()).await {
        puffer.push_str(&String::from_utf8_lossy(&teil));
        for zeile in puffer.lines() {
            if let Some(json) = zeile.strip_prefix("data: ") {
                let v: serde_json::Value = serde_json::from_str(json).unwrap();
                if bedingung(&v) {
                    return v;
                }
            }
        }
    }
    panic!("kein passendes Ereignis in: {puffer}");
}

/// Ein Arbeits-Repository getrennt vom kanbanD-Ordner, `text` als `Dokumentation/Planung/kasse.md` committet.
pub fn arbeits_repository(text: &str) -> (tempfile::TempDir, std::path::PathBuf) {
    let t = tempfile::tempdir().unwrap();
    let wurzel = t.path().canonicalize().unwrap();
    std::fs::create_dir_all(wurzel.join("Dokumentation/Planung")).unwrap();
    std::fs::write(wurzel.join("Dokumentation/Planung/kasse.md"), text).unwrap();
    git(&wurzel, &["init", "-q"]);
    git(&wurzel, &["add", "-A"]);
    git(&wurzel, &["-c", "user.name=KI", "-c", "user.email=k@k", "commit", "-q", "-m", "WBS"]);
    (t, wurzel)
}

/// Eingerichteter kanbanD-Ordner mit Stefan, Claude und der Anwendung `kc`, deren WBS im Arbeits-Repository `arbeit` liegt.
pub fn mit_register(ordner: &Path, arbeit: &Path) {
    eingerichtet(ordner);
    let kanban = format!("---\npeople:\n  st: {{name: Stefan, kind: human}}\n  cl: {{name: Claude, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kc: {{name: Kasse, wbs: {}/Dokumentation/Planung/kasse.md, requirements: \"\"}}\n---\n", arbeit.display());
    std::fs::write(ordner.join("kanbanD.md"), kanban).unwrap();
    git(ordner, &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-am", "Register"]);
}

/// Antwort eines rohen Aufrufs: Status, `Content-Type` und Rumpf, wie sie über die Leitung kamen.
pub struct Antwort {
    pub status: u16,
    pub art: String,
    pub text: String,
}

impl Antwort {
    /// Der Rumpf als JSON; `Null`, wenn er keines ist.
    pub fn json(&self) -> serde_json::Value {
        serde_json::from_str(&self.text).unwrap_or(serde_json::Value::Null)
    }
}

/// Schreibender Aufruf mit rohem Rumpf; `art` ist der `Content-Type` der Anfrage, `None` sendet keinen (R00153).
pub async fn senden_roh(methode: reqwest::Method, adresse: &str, pfad: &str, wer: &str, art: Option<&str>, rumpf: impl Into<reqwest::Body>) -> Antwort {
    let mut anfrage = reqwest::Client::new().request(methode, format!("{adresse}{pfad}")).header("X-KanbanD-Wer", wer).body(rumpf);
    if let Some(art) = art {
        anfrage = anfrage.header("Content-Type", art);
    }
    let r = anfrage.send().await.unwrap();
    let status = r.status().as_u16();
    let art = r.headers().get("content-type").and_then(|w| w.to_str().ok()).unwrap_or_default().to_string();
    Antwort { status, art, text: r.text().await.unwrap() }
}

fn git_als_a(pfad: &Path, args: &[&str]) -> String {
    let a = Command::new("git").arg("-C").arg(pfad).args(["-c", "user.name=A", "-c", "user.email=a@a"]).args(args).output().unwrap();
    assert!(a.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&a.stderr));
    String::from_utf8_lossy(&a.stdout).trim().to_string()
}

/// R00202: Das Arbeits-Repository R aus R00202 „Ausgangslage“: K1, K2 auf main, W1 auf karte/1 im Worktree, V1 auf losgelöstem
/// HEAD (danach zurück auf main), der Blob von K1:a.txt — dazu zwei Commit-Objekte mit demselben 7er-Präfix `7f62b7e`
/// (Inhalt fest, Präfix offline gesucht) und ein Zweig, der wie ein Kurz-Hash heißt.
pub struct Repo {
    pub _tmp: tempfile::TempDir,
    pub r: PathBuf,
    pub k1: String,
    pub k2: String,
    pub w1: String,
    pub v1: String,
    pub blob: String,
}

pub fn repo() -> Repo {
    let tmp = tempfile::tempdir().unwrap();
    let basis = tmp.path().canonicalize().unwrap();
    let r = basis.join("R");
    std::fs::create_dir_all(r.join("Dokumentation/Planung")).unwrap();
    std::fs::write(r.join("Dokumentation/Planung/app.md"), "# App\n").unwrap();
    git_als_a(&r, &["init", "-q", "-b", "main"]);
    std::fs::write(r.join("a.txt"), "a\n").unwrap();
    git_als_a(&r, &["add", "-A"]);
    git_als_a(&r, &["commit", "-qm", "a.txt anlegen"]);
    let k1 = git_als_a(&r, &["rev-parse", "HEAD"]);
    std::fs::write(r.join("a.txt"), "b\n").unwrap();
    git_als_a(&r, &["commit", "-qam", "a.txt ändern"]);
    let k2 = git_als_a(&r, &["rev-parse", "HEAD"]);
    let wt = basis.join("R-karte-1");
    git_als_a(&r, &["worktree", "add", "-q", "-b", "karte/1", wt.to_str().unwrap()]);
    std::fs::write(wt.join("b.txt"), "b\n").unwrap();
    git_als_a(&wt, &["add", "b.txt"]);
    git_als_a(&wt, &["commit", "-qm", "b.txt anlegen"]);
    let w1 = git_als_a(&wt, &["rev-parse", "HEAD"]);
    git_als_a(&r, &["checkout", "-q", "--detach"]);
    git_als_a(&r, &["commit", "-q", "--allow-empty", "-m", "verwaist"]);
    let v1 = git_als_a(&r, &["rev-parse", "HEAD"]);
    git_als_a(&r, &["checkout", "-q", "main"]);
    let blob = git_als_a(&r, &["rev-parse", &format!("{k1}:a.txt")]);
    git_als_a(&r, &["hash-object", "-w", "-t", "tree", "/dev/null"]);
    for n in [18876, 29727] {
        let inhalt = format!("tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904\nauthor A <a@a> 0 +0000\ncommitter A <a@a> 0 +0000\n\n{n}\n");
        let pfad = basis.join("objekt");
        std::fs::write(&pfad, inhalt).unwrap();
        assert!(git_als_a(&r, &["hash-object", "-w", "-t", "commit", pfad.to_str().unwrap()]).starts_with("7f62b7e"));
    }
    git_als_a(&r, &["branch", "abcdef0", &k2]);
    Repo { _tmp: tmp, r, k1, k2, w1, v1, blob }
}

impl Repo {
    /// Arbeitsbaum und Objektzahl — „nur lesend“ heißt: beides unverändert.
    pub fn stand(&self) -> (String, String) {
        (git_als_a(&self.r, &["status", "--porcelain"]), git_als_a(&self.r, &["count-objects", "-v"]))
    }
}

/// Die beiden Commit-Objekte mit demselben 7er-Präfix in [`repo`].
pub const PRAEFIX_ZWEIER: &str = "7f62b7e";
pub const ZWEIER: [&str; 2] = ["7f62b7e8c4aeab77b053e03929734afdc3d9bdc4", "7f62b7e8c5daa353f97b7f84b0b410b9501a4e46"];

/// R00203: [`Repo`] mit den zwei Commits **K3** („c.txt anlegen“) und **K4** („d.txt anlegen“) auf `main` hinter K2 — der
/// Worktree `R-karte-1` steht mit W1 noch auf K2, ein `git rebase main` dort macht aus W1 den Commit W1'.
pub struct RepoMitRebase {
    pub basis: Repo,
    pub k3: String,
    pub k4: String,
}

pub fn repo_mit_k3_k4() -> RepoMitRebase {
    let basis = repo();
    let mut hashes = vec![];
    for datei in ["c.txt", "d.txt"] {
        std::fs::write(basis.r.join(datei), "x\n").unwrap();
        git_als_a(&basis.r, &["add", datei]);
        git_als_a(&basis.r, &["commit", "-qm", &format!("{datei} anlegen")]);
        hashes.push(git_als_a(&basis.r, &["rev-parse", "HEAD"]));
    }
    RepoMitRebase { k4: hashes.pop().unwrap(), k3: hashes.pop().unwrap(), basis }
}

impl RepoMitRebase {
    pub fn worktree(&self) -> PathBuf {
        self.basis.r.with_file_name("R-karte-1")
    }

    /// `git rebase main` im Worktree; liefert den Hash, den W1 danach trägt.
    pub fn rebase(&self) -> String {
        git_als_a(&self.worktree(), &["rebase", "-q", "main"]);
        git_als_a(&self.worktree(), &["rev-parse", "HEAD"])
    }

    /// Ein zweiter Commit auf losgelöstem `HEAD`, den kein Zweig erreicht (V2); danach zurück auf `main`.
    pub fn zweiter_verwaister(&self) -> String {
        let r = &self.basis.r;
        git_als_a(r, &["checkout", "-q", "--detach"]);
        git_als_a(r, &["commit", "-q", "--allow-empty", "-m", "verwaist 2"]);
        let v2 = git_als_a(r, &["rev-parse", "HEAD"]);
        git_als_a(r, &["checkout", "-q", "main"]);
        v2
    }

    /// Was kein Zweig erreicht, endgültig aus R entfernen (`reflog expire`, `gc --prune=now`).
    pub fn aufraeumen(&self) {
        git_als_a(&self.basis.r, &["reflog", "expire", "--expire=now", "--all"]);
        git_als_a(&self.basis.r, &["gc", "-q", "--prune=now"]);
    }
}

/// R00204 AK 10: ein großes Wegwerf-Repository für die Lastprobe, erzeugt mit `git fast-import` — `main` linear mit
/// 16.000 Commits, 29 weitere lokale Zweige `b01`–`b29` und 20 entfernte `o/r01`–`o/r20` mit je 81 Commits (abgezweigt
/// zwischen Commit 1.000 und 15.700 von `main`), dazu fünf verwaiste Commits; ohne `commit-graph`.
pub struct Grosses {
    pub _tmp: tempfile::TempDir,
    pub r: PathBuf,
    /// 30 Verweise: zehn auf Spitzen, zehn tief in der Geschichte, fünf auf mehreren Zweigen, fünf verwaist.
    pub verweise: Vec<String>,
    /// Zahl der Commit-Objekte im Repository.
    pub commits: usize,
}

const GROSS_MAIN: usize = 16_000;
const GROSS_ZWEIGE: usize = 49;
const GROSS_JE_ZWEIG: usize = 81;

pub fn grosses_repository() -> Grosses {
    use std::fmt::Write as _;
    use std::io::Write as _;
    let tmp = tempfile::tempdir().unwrap();
    let r = tmp.path().canonicalize().unwrap().join("R");
    std::fs::create_dir_all(r.join("Dokumentation/Planung")).unwrap();
    git_als_a(&r, &["init", "-q", "-b", "main"]);
    for (k, v) in [("gc.auto", "0"), ("gc.writeCommitGraph", "false"), ("fetch.writeCommitGraph", "false")] {
        git_als_a(&r, &["config", k, v]);
    }
    let mut strom = String::new();
    let mut marke = 0usize;
    let mut commit = |strom: &mut String, referenz: &str, von: Option<usize>, inhalt: &str| -> usize {
        marke += 1;
        let zeit = 1_700_000_000 + marke * 60;
        let nachricht = format!("Commit {marke}");
        let _ = write!(strom, "commit {referenz}\nmark :{marke}\nauthor A <a@a> {zeit} +0000\ncommitter A <a@a> {zeit} +0000\ndata {}\n{nachricht}\n", nachricht.len());
        if let Some(v) = von {
            let _ = writeln!(strom, "from :{v}");
        }
        let datei = format!("{inhalt}{marke}\n");
        let _ = write!(strom, "M 644 inline f{}.txt\ndata {}\n{datei}\n", marke % 64, datei.len());
        marke
    };
    let mut letzte = None;
    for _ in 0..GROSS_MAIN {
        letzte = Some(commit(&mut strom, "refs/heads/main", letzte, "main "));
    }
    let mut spitzen = vec![];
    for z in 0..GROSS_ZWEIGE {
        let referenz = if z < 29 { format!("refs/heads/b{:02}", z + 1) } else { format!("refs/remotes/o/r{:02}", z - 28) };
        let mut von = Some(1_000 + z * 300);
        for _ in 0..GROSS_JE_ZWEIG {
            von = Some(commit(&mut strom, &referenz, von, "zweig "));
        }
        spitzen.push(von.unwrap());
    }
    let mut verwaist = vec![];
    for v in 0..5 {
        verwaist.push(commit(&mut strom, &format!("refs/verwaist/v{v}"), Some(2_000 + v * 1_000), "verwaist "));
    }
    let _ = writeln!(strom, "progress fertig");
    for m in 1..=marke {
        let _ = writeln!(strom, "get-mark :{m}");
    }
    let mut kind = Command::new("git").arg("-C").arg(&r).args(["fast-import", "--quiet"]).stdin(Stdio::piped()).stdout(Stdio::piped()).spawn().unwrap();
    let mut eingabe = kind.stdin.take().unwrap();
    let schreiber = std::thread::spawn(move || eingabe.write_all(strom.as_bytes()));
    let aus = kind.wait_with_output().unwrap();
    schreiber.join().unwrap().unwrap();
    assert!(aus.status.success(), "fast-import");
    let hashes: Vec<String> = String::from_utf8_lossy(&aus.stdout).lines().filter(|z| z.len() == 40).map(String::from).collect();
    assert_eq!(hashes.len(), marke, "eine Zeile je Marke");
    let hash = |m: usize| hashes[m - 1].clone();
    for v in 0..5 {
        git_als_a(&r, &["update-ref", "-d", &format!("refs/verwaist/v{v}")]);
    }
    git_als_a(&r, &["checkout", "-q", "main"]);
    assert!(!r.join(".git/objects/info/commit-graph").exists(), "ohne commit-graph");
    let mut verweise: Vec<String> = spitzen.iter().take(5).chain(spitzen.iter().skip(29).take(5)).map(|&m| hash(m)).collect();
    verweise.extend((0..10).map(|i| hash(100 + i * 200)));
    verweise.extend((0..5).map(|i| hash(15_000 + i * 100)));
    verweise.extend(verwaist.iter().map(|&m| hash(m)));
    Grosses { _tmp: tmp, r, verweise, commits: marke }
}

/// Der Hash, den `git hash-object` einem Blob mit diesem Inhalt gäbe — ohne Git (SHA-1 über „blob <n>\0<inhalt>“), für
/// die Suche nach gleichen Präfixen.
pub fn git_hash_blob(inhalt: &str) -> String {
    let mut daten = format!("blob {}\0", inhalt.len()).into_bytes();
    daten.extend_from_slice(inhalt.as_bytes());
    sha1_hex(&daten)
}

fn sha1_hex(daten: &[u8]) -> String {
    let mut h: [u32; 5] = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    let mut nachricht = daten.to_vec();
    let bits = (daten.len() as u64) * 8;
    nachricht.push(0x80);
    while nachricht.len() % 64 != 56 {
        nachricht.push(0);
    }
    nachricht.extend_from_slice(&bits.to_be_bytes());
    for block in nachricht.chunks(64) {
        let mut w = [0u32; 80];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([block[4 * i], block[4 * i + 1], block[4 * i + 2], block[4 * i + 3]]);
        }
        for i in 16..80 {
            w[i] = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]).rotate_left(1);
        }
        let [mut a, mut b, mut c, mut d, mut e] = h;
        for (i, wi) in w.iter().enumerate() {
            let (f, k) = match i {
                0..=19 => ((b & c) | (!b & d), 0x5A827999),
                20..=39 => (b ^ c ^ d, 0x6ED9EBA1),
                40..=59 => ((b & c) | (b & d) | (c & d), 0x8F1BBCDC),
                _ => (b ^ c ^ d, 0xCA62C1D6),
            };
            let t = a.rotate_left(5).wrapping_add(f).wrapping_add(e).wrapping_add(k).wrapping_add(*wi);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = t;
        }
        for (x, y) in h.iter_mut().zip([a, b, c, d, e]) {
            *x = x.wrapping_add(y);
        }
    }
    h.iter().map(|x| format!("{x:08x}")).collect()
}

/// R00204 „Ausgangslage“: Arbeits-Repository R mit K1–K4 auf `main`, Worktree `R-karte-1` auf `karte/1` (ab K2) mit W1,
/// V1 auf losgelöstem HEAD mit Tag `v1`, `o/main` = K4 und `o/HEAD` → `o/main`, R1 nur auf `refs/remotes/o/x`, V2 auf
/// losgelöstem HEAD (entfernt erst mit [`R204::v2_entfernen`]); Board-Ordner „fabrik“ mit #1 „Commit-Liste“ und #2 in
/// „Entwicklung“, Mensch `sh`, Agent `entw1`, Anwendung `kd` ohne Standardanwendung.
pub struct R204 {
    pub _tmp: tempfile::TempDir,
    pub basis: PathBuf,
    pub r: PathBuf,
    pub wt: PathBuf,
    pub board: PathBuf,
    pub k1: String,
    pub k2: String,
    pub k3: String,
    pub k4: String,
    pub w1: String,
    pub v1: String,
    pub r1: String,
    pub v2: String,
}

/// Git als `name` mit festem Autor- und Commit-Datum.
pub fn git_am(r: &Path, name: &str, datum: &str, args: &[&str]) -> String {
    let a = Command::new("git").arg("-C").arg(r).args(["-c", &format!("user.name={name}"), "-c", "user.email=autor@example.org"]).args(args).env("GIT_AUTHOR_DATE", datum).env("GIT_COMMITTER_DATE", datum).output().unwrap();
    assert!(a.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&a.stderr));
    String::from_utf8_lossy(&a.stdout).trim().to_string()
}

const ADA: &str = "Ada Autorin";

/// Legt `datei` mit `zeilen` Zeilen an (oder überschreibt sie) und committet mit `nachricht`; liefert den Hash.
pub fn datei_commit(r: &Path, name: &str, datum: &str, datei: &str, zeilen: usize, nachricht: &str) -> String {
    std::fs::write(r.join(datei), (1..=zeilen).map(|i| format!("{datei} {i}\n")).collect::<String>()).unwrap();
    git_am(r, name, datum, &["add", "-A"]);
    git_am(r, name, datum, &["commit", "-q", "-m", nachricht]);
    git_am(r, name, datum, &["rev-parse", "HEAD"])
}

pub fn ausgangslage_r00204() -> R204 {
    let tmp = tempfile::tempdir().unwrap();
    let basis = tmp.path().canonicalize().unwrap();
    let (r, wt, board) = (basis.join("R"), basis.join("R-karte-1"), basis.join("board"));
    std::fs::create_dir_all(r.join("Dokumentation/Planung")).unwrap();
    std::fs::write(r.join("Dokumentation/Planung/app.md"), "# App\n").unwrap();
    git_am(&r, ADA, "2026-02-01T09:00:00+00:00", &["init", "-q", "-b", "main"]);
    let k1 = datei_commit(&r, ADA, "2026-02-01T09:00:00+00:00", "a.txt", 2, "a.txt anlegen");
    let k2 = datei_commit(&r, ADA, "2026-02-02T09:00:00+00:00", "a.txt", 3, "a.txt ändern");
    let k3 = datei_commit(&r, ADA, "2026-03-01T10:00:00+01:00", "c.txt", 3, "c.txt anlegen");
    let k4 = datei_commit(&r, ADA, "2026-02-20T09:00:00+00:00", "d.txt", 1, "d.txt anlegen");
    git_am(&r, ADA, "2026-02-02T09:00:00+00:00", &["worktree", "add", "-q", "-b", "karte/1", wt.to_str().unwrap(), &k2]);
    let w1 = datei_commit(&wt, "Bernd Beispiel", "2026-03-02T09:00:00+00:00", "b.txt", 1, "b.txt anlegen");
    git_am(&r, ADA, "2026-03-03T09:00:00+00:00", &["checkout", "-q", "--detach"]);
    let v1 = datei_commit(&r, ADA, "2026-03-03T09:00:00+00:00", "v.txt", 1, "v.txt anlegen");
    git_am(&r, ADA, "2026-03-03T09:00:00+00:00", &["tag", "v1"]);
    // R1 ab K2: nur o/x erreicht ihn, und o/x erreicht K3 nicht
    git_am(&r, ADA, "2026-03-04T09:00:00+00:00", &["checkout", "-q", "--detach", &k2]);
    let r1 = datei_commit(&r, ADA, "2026-03-04T09:00:00+00:00", "r.txt", 1, "r.txt anlegen");
    git_am(&r, ADA, "2026-03-04T09:00:00+00:00", &["update-ref", "refs/remotes/o/x", &r1]);
    git_am(&r, ADA, "2026-03-05T09:00:00+00:00", &["checkout", "-q", "--detach", "main"]);
    let v2 = datei_commit(&r, ADA, "2026-03-05T09:00:00+00:00", "w.txt", 1, "w.txt anlegen");
    git_am(&r, ADA, "2026-03-05T09:00:00+00:00", &["checkout", "-q", "main"]);
    git_am(&r, ADA, "2026-03-05T09:00:00+00:00", &["update-ref", "refs/remotes/o/main", &k4]);
    git_am(&r, ADA, "2026-03-05T09:00:00+00:00", &["symbolic-ref", "refs/remotes/o/HEAD", "refs/remotes/o/main"]);
    std::fs::create_dir_all(board.join("aufgaben")).unwrap();
    std::fs::create_dir_all(board.join("boards")).unwrap();
    std::fs::write(board.join("kanbanD.md"), format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\n  entw1: {{name: Entwickler, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Dokumentation/Planung/app.md, requirements: \"\"}}\n---\n", r.display())).unwrap();
    std::fs::write(board.join("aufgaben/0001-commit-liste.md"), "---\nid: 1\ntitle: Commit-Liste\n---\n").unwrap();
    std::fs::write(board.join("aufgaben/0002-leer.md"), "---\nid: 2\ntitle: leer\n---\n").unwrap();
    std::fs::write(board.join("boards/fabrik.md"), "# fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-commit-liste.md)\n- [#2](../aufgaben/0002-leer.md)\n").unwrap();
    git(&board, &["init", "-q"]);
    git(&board, &["add", "-A"]);
    git(&board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "fabrik"]);
    R204 { _tmp: tmp, basis, r, wt, board, k1, k2, k3, k4, w1, v1, r1, v2 }
}

impl R204 {
    /// V2 nach dem Hinterlegen aus R entfernen (Reflogs leeren, unerreichbare Objekte löschen).
    pub fn v2_entfernen(&self) {
        git_am(&self.r, ADA, "2026-03-06T09:00:00+00:00", &["reflog", "expire", "--expire=now", "--all"]);
        git_am(&self.r, ADA, "2026-03-06T09:00:00+00:00", &["gc", "-q", "--prune=now"]);
        let a = Command::new("git").arg("-C").arg(&self.r).args(["cat-file", "-e", &self.v2]).status().unwrap();
        assert!(!a.success(), "V2 ist noch da");
    }

    /// Die Verweise der Ausgangslage in der Reihenfolge der Datei: K3, W1, V1, V2, R1.
    pub fn verweise(&self) -> Vec<String> {
        [&self.k3, &self.w1, &self.v1, &self.v2, &self.r1].iter().map(|h| format!("kd:{h}")).collect()
    }

    /// Schreibt die Verweise von Hand in die Datei von #1 (ohne kanbanD) und committet sie.
    pub fn von_hand(&self, verweise: &[String]) {
        let liste: String = verweise.iter().map(|v| format!("  - {}\n", serde_json::to_string(v).unwrap())).collect();
        std::fs::write(self.board.join("aufgaben/0001-commit-liste.md"), format!("---\nid: 1\ntitle: Commit-Liste\ncommits:\n{liste}---\n")).unwrap();
        git(&self.board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-am", "von Hand"]);
    }

    pub fn commit_zahl(&self) -> String {
        git(&self.board, &["rev-list", "--count", "HEAD"])
    }
}

/// R00218 „Ausgangslage“: Arbeits-Repository R mit M0 „Grundstand“ (`a.txt`, `b.txt`, `bild.png`) und M1 „Drittes
/// anlegen“ auf `main`; K auf `karte/1`, gerebased (K' auf `main`, `karte/1` gelöscht); G auf `fremd` (dieselbe Datei
/// wie K, anderer Inhalt); C auf losgelöstem HEAD, per Cherry-pick auf `x` (C1, später) und `y` (C2, früher); S1–S3 auf
/// `karte/3`, als Squash S auf `main`; Mg (Merge, Zweig gelöscht); E leer; B „Bild tauschen“ auf losgelöstem HEAD, B2
/// auf `z` (gleiche Datei, anderer Inhalt), B3 = B per Cherry-pick auf `w`. Board-Ordner mit #1 `kd:K`, `kd:M1` · #2
/// `kd:C` · #3 `kd:K`, `kd:K'` · #4 `kd:S1`, `kd:Mg`, `kd:E`, `kd:B`; Mensch `sh`, Agent `entw1`.
pub struct R218 {
    pub _tmp: tempfile::TempDir,
    pub r: PathBuf,
    pub board: PathBuf,
    pub m0: String,
    pub m1: String,
    pub k: String,
    pub k2: String,
    pub g: String,
    pub c: String,
    pub c1: String,
    pub c2: String,
    pub s1: String,
    pub mg: String,
    pub e: String,
    pub b: String,
    pub b2: String,
    pub b3: String,
}

/// Git in R mit festem Commit-Datum; das Autordatum bleibt bei Rebase und Cherry-pick das des Originals.
fn git_um(r: &Path, datum: &str, args: &[&str]) -> String {
    let a = Command::new("git").arg("-C").arg(r).args(["-c", "user.name=Ada Autorin", "-c", "user.email=ada@example.org"]).args(args).env("GIT_COMMITTER_DATE", datum).output().unwrap();
    assert!(a.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&a.stderr));
    String::from_utf8_lossy(&a.stdout).trim().to_string()
}

pub fn ausgangslage_r00218() -> R218 {
    let tmp = tempfile::tempdir().unwrap();
    let basis = tmp.path().canonicalize().unwrap();
    let (r, board) = (basis.join("R"), basis.join("board"));
    std::fs::create_dir_all(r.join("Dokumentation/Planung")).unwrap();
    std::fs::write(r.join("Dokumentation/Planung/app.md"), "# App\n").unwrap();
    let schreiben = |datei: &str, inhalt: &[u8]| std::fs::write(r.join(datei), inhalt).unwrap();
    let commit = |datum: &str, nachricht: &str| {
        git_am(&r, ADA, datum, &["add", "-A"]);
        git_am(&r, ADA, datum, &["commit", "-q", "--allow-empty", "-m", nachricht]);
        git_am(&r, ADA, datum, &["rev-parse", "HEAD"])
    };
    git_am(&r, ADA, "2026-05-01T09:00:00+00:00", &["init", "-q", "-b", "main"]);
    schreiben("a.txt", b"eins\nzwei\ndrei\n");
    schreiben("b.txt", b"Hallo\n");
    schreiben("bild.png", b"\x89PNG\0alt\0");
    let m0 = commit("2026-05-01T09:00:00+00:00", "Grundstand");
    git_am(&r, ADA, "2026-05-02T09:00:00+00:00", &["checkout", "-q", "-b", "karte/1"]);
    schreiben("a.txt", b"eins\nZWEI\ndrei\n");
    let k = commit("2026-05-02T09:00:00+00:00", "Zeile zwei ändern");
    git_am(&r, ADA, "2026-05-03T09:00:00+00:00", &["checkout", "-q", "main"]);
    schreiben("c.txt", b"drei\n");
    let m1 = commit("2026-05-03T09:00:00+00:00", "Drittes anlegen");
    git_am(&r, ADA, "2026-05-04T09:00:00+00:00", &["checkout", "-q", "karte/1"]);
    git_um(&r, "2026-05-04T09:00:00+00:00", &["rebase", "-q", "main"]);
    let k2 = git(&r, &["rev-parse", "HEAD"]);
    git(&r, &["checkout", "-q", "main"]);
    git(&r, &["merge", "-q", "--ff-only", "karte/1"]);
    git(&r, &["branch", "-q", "-D", "karte/1"]);
    git(&r, &["checkout", "-q", "-b", "fremd", &m1]);
    schreiben("a.txt", b"eins\nzwei anders\ndrei\n");
    let g = commit("2026-05-05T09:00:00+00:00", "Zeile zwei anders ändern");
    git(&r, &["checkout", "-q", "--detach", &m1]);
    schreiben("b.txt", b"Servus\n");
    let c = commit("2026-05-06T09:00:00+00:00", "Gruß ändern");
    git(&r, &["checkout", "-q", "-b", "x", &m1]);
    git_um(&r, "2026-05-08T09:00:00+00:00", &["cherry-pick", &c]);
    let c1 = git(&r, &["rev-parse", "HEAD"]);
    git(&r, &["checkout", "-q", "-b", "y", &m0]);
    git_um(&r, "2026-05-07T09:00:00+00:00", &["cherry-pick", &c]);
    let c2 = git(&r, &["rev-parse", "HEAD"]);
    git(&r, &["checkout", "-q", "-b", "karte/3", "main"]);
    let mut s = vec![];
    for (i, inhalt) in ["eins\n", "eins\nzwei\n", "eins\nzwei\ndrei\n"].iter().enumerate() {
        schreiben("s.txt", inhalt.as_bytes());
        s.push(commit(&format!("2026-05-09T09:0{i}:00+00:00"), &format!("Schritt {}", i + 1)));
    }
    git(&r, &["checkout", "-q", "main"]);
    git_am(&r, ADA, "2026-05-10T09:00:00+00:00", &["merge", "-q", "--squash", "karte/3"]);
    commit("2026-05-10T09:00:00+00:00", "Schritte zusammen");
    git(&r, &["branch", "-q", "-D", "karte/3"]);
    git(&r, &["checkout", "-q", "-b", "seite", "main"]);
    schreiben("d.txt", b"d\n");
    commit("2026-05-11T09:00:00+00:00", "Seitenarbeit");
    git(&r, &["checkout", "-q", "-b", "karte/4", "main"]);
    git_am(&r, ADA, "2026-05-11T10:00:00+00:00", &["merge", "-q", "--no-ff", "-m", "Seitenarbeit zusammenführen", "seite"]);
    let mg = git(&r, &["rev-parse", "HEAD"]);
    git(&r, &["checkout", "-q", "--detach", "main"]);
    git(&r, &["branch", "-q", "-D", "karte/4", "seite"]);
    let e = commit("2026-05-12T09:00:00+00:00", "Nichts ändern");
    git(&r, &["checkout", "-q", "--detach", &m0]);
    schreiben("bild.png", b"\x89PNG\0X\0");
    let b = commit("2026-05-13T09:00:00+00:00", "Bild tauschen");
    git(&r, &["checkout", "-q", "-b", "z", &m0]);
    schreiben("bild.png", b"\x89PNG\0Y\0");
    let b2 = commit("2026-05-14T09:00:00+00:00", "Bild anders tauschen");
    git(&r, &["checkout", "-q", "-b", "w", &m1]);
    git_um(&r, "2026-05-15T09:00:00+00:00", &["cherry-pick", &b]);
    let b3 = git(&r, &["rev-parse", "HEAD"]);
    git(&r, &["checkout", "-q", "main"]);
    std::fs::create_dir_all(board.join("aufgaben")).unwrap();
    std::fs::create_dir_all(board.join("boards")).unwrap();
    std::fs::write(board.join("kanbanD.md"), format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\n  entw1: {{name: Entwickler, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Dokumentation/Planung/app.md, requirements: \"\"}}\n---\n", r.display())).unwrap();
    let karten = [(1, vec![&k, &m1]), (2, vec![&c]), (3, vec![&k, &k2]), (4, vec![&s[0], &mg, &e, &b])];
    let mut liste = String::new();
    for (nr, verweise) in &karten {
        let commits: String = verweise.iter().map(|h| format!("  - kd:{h}\n")).collect();
        std::fs::write(board.join(format!("aufgaben/000{nr}-karte.md")), format!("---\nid: {nr}\ntitle: Karte {nr}\ncommits:\n{commits}---\n")).unwrap();
        liste.push_str(&format!("- [#{nr}](../aufgaben/000{nr}-karte.md)\n"));
    }
    std::fs::write(board.join("boards/fabrik.md"), format!("# fabrik\n\n## Entwicklung\n\n{liste}")).unwrap();
    git(&board, &["init", "-q"]);
    git(&board, &["add", "-A"]);
    git(&board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "fabrik"]);
    let s1 = s[0].clone();
    R218 { _tmp: tmp, r, board, m0, m1, k, k2, g, c, c1, c2, s1, mg, e, b, b2, b3 }
}

impl R218 {
    /// Commit-Zahl des Board-Ordners und `git status --porcelain` in R und im Board-Ordner — bleibt bei jeder Suche gleich.
    pub fn stand(&self) -> (String, String, String) {
        (git(&self.board, &["rev-list", "--count", "HEAD"]), git(&self.r, &["status", "--porcelain"]), git(&self.board, &["status", "--porcelain"]))
    }

    /// C per Cherry-pick auf `n` weitere Zweige `c03`… übertragen, je mit eigenem, späterem Commit-Datum.
    pub fn c_auf_weitere_zweige(&self, von: usize, bis: usize) {
        for i in von..=bis {
            git(&self.r, &["checkout", "-q", "-b", &format!("c{i:02}"), &self.m0]);
            git_um(&self.r, &format!("2026-06-{i:02}T09:00:00+00:00"), &["cherry-pick", &self.c]);
        }
        git(&self.r, &["checkout", "-q", "main"]);
    }
}
