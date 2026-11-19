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
}

impl Drop for Laufendes {
    fn drop(&mut self) {
        geordnet_beenden(&mut self.kind);
        if let Some(mitschnitt) = &self.mitschnitt {
            eprint!("{}", std::fs::read_to_string(mitschnitt.path()).unwrap_or_default());
        }
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
    let mut kind = befehl
        .arg(ordner)
        .args(["--kein-browser", "--host", "127.0.0.1"])
        .args(zusatz)
        .stdout(Stdio::piped())
        .stderr(stderr)
        .spawn()
        .expect("kanbanD startet");
    let mut zeile = String::new();
    BufReader::new(kind.stdout.take().unwrap()).read_line(&mut zeile).unwrap();
    let adresse = zeile.split_whitespace().last().expect("Adresse in der Startzeile").to_string();
    Laufendes { kind, adresse, mitschnitt: None }
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
