use kanband::start::ordner::{liegt_in_git_repository, ordner_vorbereiten};
use std::process::Command;

fn git(pfad: &std::path::Path, args: &[&str]) -> String {
    let a = Command::new("git").arg("-C").arg(pfad).args(args).output().unwrap();
    String::from_utf8_lossy(&a.stdout).trim().to_string()
}

#[test]
fn neuer_ordner_wird_angelegt_und_git_initialisiert() {
    let tmp = tempfile::tempdir().unwrap();
    let pfad = tmp.path().join("neu/tief");
    assert!(!pfad.exists());
    let absolut = ordner_vorbereiten(&pfad).unwrap();
    assert!(absolut.is_absolute());
    assert!(absolut.is_dir());
    assert!(liegt_in_git_repository(&absolut));
    assert_eq!(git(&absolut, &["rev-parse", "--show-toplevel"]), absolut.to_string_lossy());
}

#[test]
fn bestehendes_repository_behaelt_seine_commits() {
    let tmp = tempfile::tempdir().unwrap();
    let repo = tmp.path();
    git(repo, &["init", "-q"]);
    std::fs::write(repo.join("a.txt"), "a").unwrap();
    git(repo, &["add", "a.txt"]);
    git(repo, &["-c", "user.name=T", "-c", "user.email=t@t", "commit", "-q", "-m", "erster"]);
    let vorher = git(repo, &["rev-parse", "HEAD"]);
    let unterordner = repo.join("kanban");
    ordner_vorbereiten(&unterordner).unwrap();
    assert_eq!(git(repo, &["rev-parse", "HEAD"]), vorher);
    assert!(!unterordner.join(".git").exists(), "Unterordner eines Repos bekommt kein eigenes Repo");
}

#[test]
fn ordner_ausserhalb_von_git_wird_nicht_als_repository_erkannt() {
    let tmp = tempfile::tempdir().unwrap();
    assert!(!liegt_in_git_repository(tmp.path()));
}
