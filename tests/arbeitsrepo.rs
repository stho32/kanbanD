// R00202 B0991 (ADR-0032 Punkte 2 und 3): das Modul Arbeits-Repository gegen ein echtes Wegwerf-Repository samt Worktree
use kanband::git::arbeitsrepo::{self, Arbeitsrepofehler};
use kanband::modell::Anwendung;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

fn git(pfad: &Path, args: &[&str]) -> String {
    let a = Command::new("git").arg("-C").arg(pfad).args(["-c", "user.name=A", "-c", "user.email=a@a"]).args(args).output().unwrap();
    assert!(a.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&a.stderr));
    String::from_utf8_lossy(&a.stdout).trim().to_string()
}

/// Das Arbeits-Repository R aus R00202 „Ausgangslage“: K1, K2 auf main, W1 auf karte/1 im Worktree, V1 auf losgelöstem
/// HEAD (danach zurück auf main), der Blob von K1:a.txt — dazu zwei Commit-Objekte mit demselben 7er-Präfix `7f62b7e`
/// (Inhalt fest, Präfix offline gesucht) und ein Zweig, der wie ein Kurz-Hash heißt.
struct Repo {
    _tmp: tempfile::TempDir,
    r: PathBuf,
    k1: String,
    k2: String,
    w1: String,
    v1: String,
    blob: String,
}

fn repo() -> Repo {
    let tmp = tempfile::tempdir().unwrap();
    let basis = tmp.path().canonicalize().unwrap();
    let r = basis.join("R");
    std::fs::create_dir_all(r.join("Dokumentation/Planung")).unwrap();
    std::fs::write(r.join("Dokumentation/Planung/app.md"), "# App\n").unwrap();
    git(&r, &["init", "-q", "-b", "main"]);
    std::fs::write(r.join("a.txt"), "a\n").unwrap();
    git(&r, &["add", "-A"]);
    git(&r, &["commit", "-qm", "a.txt anlegen"]);
    let k1 = git(&r, &["rev-parse", "HEAD"]);
    std::fs::write(r.join("a.txt"), "b\n").unwrap();
    git(&r, &["commit", "-qam", "a.txt ändern"]);
    let k2 = git(&r, &["rev-parse", "HEAD"]);
    let wt = basis.join("R-karte-1");
    git(&r, &["worktree", "add", "-q", "-b", "karte/1", wt.to_str().unwrap()]);
    std::fs::write(wt.join("b.txt"), "b\n").unwrap();
    git(&wt, &["add", "b.txt"]);
    git(&wt, &["commit", "-qm", "b.txt anlegen"]);
    let w1 = git(&wt, &["rev-parse", "HEAD"]);
    git(&r, &["checkout", "-q", "--detach"]);
    git(&r, &["commit", "-q", "--allow-empty", "-m", "verwaist"]);
    let v1 = git(&r, &["rev-parse", "HEAD"]);
    git(&r, &["checkout", "-q", "main"]);
    let blob = git(&r, &["rev-parse", &format!("{k1}:a.txt")]);
    git(&r, &["hash-object", "-w", "-t", "tree", "/dev/null"]);
    for n in [18876, 29727] {
        let inhalt = format!("tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904\nauthor A <a@a> 0 +0000\ncommitter A <a@a> 0 +0000\n\n{n}\n");
        let pfad = basis.join("objekt");
        std::fs::write(&pfad, inhalt).unwrap();
        assert!(git(&r, &["hash-object", "-w", "-t", "commit", pfad.to_str().unwrap()]).starts_with("7f62b7e"));
    }
    git(&r, &["branch", "abcdef0", &k2]);
    Repo { _tmp: tmp, r, k1, k2, w1, v1, blob }
}

fn anwendung(wbs: &str, anforderungen: &str) -> Anwendung {
    Anwendung { kuerzel: "kd".into(), name: "KD".into(), wbs: wbs.into(), anforderungen: anforderungen.into() }
}

fn stand(r: &Path) -> (String, String) {
    (git(r, &["status", "--porcelain"]), git(r, &["count-objects", "-v"]))
}

// ADR-0032 Punkt 2: Startordner ist der Ordner der WBS, ohne WBS der Anforderungsordner; Wurzel über --show-toplevel
#[test]
fn wurzel_aus_dem_ordner_der_wbs_oder_der_anforderungen() {
    let r = repo();
    let wbs = r.r.join("Dokumentation/Planung/app.md");
    assert_eq!(arbeitsrepo::wurzel(Path::new("/"), &anwendung(wbs.to_str().unwrap(), "")), Ok(r.r.clone()));
    assert_eq!(arbeitsrepo::wurzel(Path::new("/"), &anwendung("", r.r.join("Dokumentation").to_str().unwrap())), Ok(r.r.clone()));
    assert_eq!(arbeitsrepo::wurzel(&r.r, &anwendung("Dokumentation/Planung/app.md", "")), Ok(r.r.clone()), "relativ zum Board-Ordner");
}

// ADR-0032 Punkt 2: fehlt der Ordner oder ist er kein Repository, heißt das repository_fehlt mit Grund
#[test]
fn wurzel_fehlt_mit_grund() {
    let tmp = tempfile::tempdir().unwrap();
    let kein_repo = tmp.path().canonicalize().unwrap();
    std::fs::create_dir_all(kein_repo.join("Planung")).unwrap();
    for (a, ort) in [(anwendung("/gibt/es/nicht/app.md", ""), "/gibt/es/nicht"), (anwendung(kein_repo.join("Planung/app.md").to_str().unwrap(), ""), "Planung"), (anwendung("", ""), "")] {
        match arbeitsrepo::wurzel(Path::new("/"), &a) {
            Err(Arbeitsrepofehler::RepositoryFehlt(grund)) => assert!(!grund.is_empty() && grund.contains(ort), "{grund}"),
            anders => panic!("{a:?}: {anders:?}"),
        }
    }
}

// AK 1, AK 2: ein Kurz-Hash wird zum vollen Hash — auch vom Zweig eines Worktrees und für einen verwaisten Commit
#[test]
fn commit_aufloesen_kurz_voll_worktree_verwaist() {
    let r = repo();
    for voll in [&r.k1, &r.k2, &r.w1, &r.v1] {
        assert_eq!(arbeitsrepo::commit_aufloesen(&r.r, &voll[..7]).as_ref(), Ok(voll), "kurz");
        assert_eq!(arbeitsrepo::commit_aufloesen(&r.r, voll).as_ref(), Ok(voll), "voll");
    }
}

// AK 4, AK 5: nicht vorhanden, 41 Zeichen, Blob, mehrdeutiger Kurz-Hash und ein Zweig, der wie ein Kurz-Hash heißt → kein Commit
#[test]
fn kein_commit() {
    let r = repo();
    let vorher = stand(&r.r);
    for hash in ["0000000".to_string(), format!("{}0", r.k1), r.blob.clone(), r.blob[..7].to_string(), "7f62b7e".into(), "abcdef0".into(), "a".repeat(64)] {
        assert_eq!(arbeitsrepo::commit_aufloesen(&r.r, &hash), Err(Arbeitsrepofehler::KeinCommit), "{hash}");
    }
    assert_eq!(arbeitsrepo::commit_aufloesen(&r.r, "7f62b7e8c4"), Ok("7f62b7e8c4aeab77b053e03929734afdc3d9bdc4".into()), "länger ist eindeutig");
    assert_eq!(stand(&r.r), vorher, "nur lesend: Arbeitsbaum und Objekte unverändert");
}

// AK 6, AK 10: der Zähler zählt jeden Git-Aufruf des Moduls in diesem Thread
#[test]
fn zaehler_je_aufruf() {
    let r = repo();
    let vorher = arbeitsrepo::aufrufe();
    arbeitsrepo::wurzel(Path::new("/"), &anwendung(r.r.join("Dokumentation/Planung/app.md").to_str().unwrap(), "")).unwrap();
    let _ = arbeitsrepo::commit_aufloesen(&r.r, &r.k1[..7]);
    let _ = arbeitsrepo::commit_aufloesen(&r.r, "0000000");
    assert_eq!(arbeitsrepo::aufrufe() - vorher, 3);
    let _ = arbeitsrepo::wurzel(Path::new("/"), &anwendung("/gibt/es/nicht/app.md", ""));
    assert_eq!(arbeitsrepo::aufrufe() - vorher, 3, "ein fehlender Ordner startet kein Git");
}

// ADR-0032 Punkt 3: ein Prozess über der Zeitgrenze wird beendet → Zeitgrenze
#[test]
fn zeitgrenze_beendet_den_prozess() {
    let mut c = Command::new("sleep");
    c.arg("5");
    let start = Instant::now();
    assert_eq!(arbeitsrepo::laufen(c, Duration::from_millis(200)).map(|_| ()), Err(Arbeitsrepofehler::Zeitgrenze));
    assert!(start.elapsed() < Duration::from_secs(3), "{:?}", start.elapsed());
    let mut c = Command::new("true");
    c.arg("x");
    assert!(arbeitsrepo::laufen(c, Duration::from_secs(5)).unwrap().status.success(), "unter der Grenze läuft er durch");
}
