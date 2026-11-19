// R00202 B0991 (ADR-0032 Punkte 2 und 3): das Modul Arbeits-Repository gegen ein echtes Wegwerf-Repository samt Worktree
mod gemeinsam;

use gemeinsam::{Repo, repo};
use kanband::git::arbeitsrepo::{self, Arbeitsrepofehler};
use kanband::modell::Anwendung;
use std::path::Path;
use std::process::Command;
use std::time::{Duration, Instant};

fn anwendung(wbs: &str, anforderungen: &str) -> Anwendung {
    Anwendung { kuerzel: "kd".into(), name: "KD".into(), wbs: wbs.into(), anforderungen: anforderungen.into() }
}

fn stand(r: &Repo) -> (String, String) {
    r.stand()
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
    let vorher = stand(&r);
    for hash in ["0000000".to_string(), format!("{}0", r.k1), r.blob.clone(), r.blob[..7].to_string(), "7f62b7e".into(), "abcdef0".into(), "a".repeat(64)] {
        assert_eq!(arbeitsrepo::commit_aufloesen(&r.r, &hash), Err(Arbeitsrepofehler::KeinCommit), "{hash}");
    }
    assert_eq!(arbeitsrepo::commit_aufloesen(&r.r, "7f62b7e8c4"), Ok("7f62b7e8c4aeab77b053e03929734afdc3d9bdc4".into()), "länger ist eindeutig");
    assert_eq!(stand(&r), vorher, "nur lesend: Arbeitsbaum und Objekte unverändert");
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

/// Lebt der Prozess `pid` noch (und ist kein Zombie)? Wartet bis zu 2 s darauf, dass er verschwindet.
fn lebt_nach_2_s(pid: &str) -> bool {
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

// R00204 AK 14 (c), ADR-0032 N2.3: bei Zeitüberschreitung stirbt die ganze Prozessgruppe — das Skript und sein Kind
// (heute rot: `kind.kill()` beendet nur das Skript, `sleep 300` lebt weiter)
#[test]
fn zeitgrenze_beendet_die_prozessgruppe() {
    let tmp = tempfile::tempdir().unwrap();
    let pids = tmp.path().join("pids");
    let skript = tmp.path().join("skript.sh");
    std::fs::write(&skript, format!("#!/bin/sh\nsleep 300 &\necho \"$$ $!\" > {}\nwait\n", pids.display())).unwrap();
    std::fs::set_permissions(&skript, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    // über `sh` statt direkt: ein paralleler Test, der gerade forkt, hielte die frisch geschriebene Datei offen
    // („Text file busy“)
    let mut c = Command::new("sh");
    c.arg(&skript);
    let start = Instant::now();
    assert_eq!(arbeitsrepo::laufen(c, Duration::from_secs(1)).map(|_| ()), Err(Arbeitsrepofehler::Zeitgrenze));
    assert!(start.elapsed() < Duration::from_secs(3), "{:?}", start.elapsed());
    let text = std::fs::read_to_string(&pids).unwrap();
    let (skript_pid, kind_pid) = text.trim().split_once(' ').unwrap();
    assert!(!lebt_nach_2_s(skript_pid), "das Skript lebt");
    assert!(!lebt_nach_2_s(kind_pid), "das Kind des Skripts lebt");
}
