// R00204 AK 10 (ADR-0032 N3.4): liefert `rev-list` mehr als 3.000.000 Zeilen, bricht die Zweigliste ab — nie eine
// gekürzte Liste. Eigene Testdatei, weil `PATH` für den ganzen Prozess gilt: ein `git` im PATH, das für `rev-list`
// endlos Zeilen schreibt und sonst das echte Git startet.
mod gemeinsam;

use kanband::git::arbeitsrepo::{self, Arbeitsrepofehler};
use std::time::{Duration, Instant};

#[test]
fn zweigliste_ueber_3_millionen_zeilen_bricht_ab() {
    let r = gemeinsam::repo();
    let echtes = String::from_utf8(std::process::Command::new("sh").args(["-c", "command -v git"]).output().unwrap().stdout).unwrap().trim().to_string();
    let tmp = tempfile::tempdir().unwrap();
    let skript = tmp.path().join("git");
    std::fs::write(&skript, format!("#!/bin/sh\ncase \"$*\" in *rev-list*) exec yes {};; esac\nexec {echtes} \"$@\"\n", r.k1)).unwrap();
    std::fs::set_permissions(&skript, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    let frist = Instant::now() + Duration::from_secs(10);
    let fingerabdruck = arbeitsrepo::fingerabdruck(&r.r, frist).unwrap();
    // SAFETY: der einzige Test dieser Datei, kein anderer Thread liest die Umgebung gleichzeitig
    unsafe { std::env::set_var("PATH", format!("{}:{}", tmp.path().display(), std::env::var("PATH").unwrap())) };
    let start = Instant::now();
    assert_eq!(arbeitsrepo::erreichbar(&r.r, &fingerabdruck, &[&r.k1], frist).map(|_| ()), Err(Arbeitsrepofehler::ZuvielAusgabe(arbeitsrepo::HOECHSTZEILEN_ZWEIGLISTE)));
    assert!(start.elapsed() < Duration::from_secs(10), "{:?}", start.elapsed());
}
