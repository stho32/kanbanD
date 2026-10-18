//! Jede Aktion ein Commit: nur die Pfade der Aktion, Autor ist die handelnde Person.

use crate::fehler::Fehler;
use crate::modell::Person;
use std::path::Path;
use std::process::Command;

fn git(wurzel: &Path, autor: &Person) -> Command {
    let mut c = Command::new("git");
    let email = format!("{}@kanbanD", autor.kuerzel);
    c.arg("-C")
        .arg(wurzel)
        .env("GIT_AUTHOR_NAME", &autor.name)
        .env("GIT_AUTHOR_EMAIL", &email)
        .env("GIT_COMMITTER_NAME", &autor.name)
        .env("GIT_COMMITTER_EMAIL", &email);
    c
}

fn ausfuehren(mut c: Command, was: &str) -> Result<std::process::Output, Fehler> {
    let a = c.output().map_err(|e| Fehler::Intern(format!("git {was}: {e}")))?;
    if a.status.success() {
        Ok(a)
    } else {
        Err(Fehler::Intern(format!("git {was}: {}", String::from_utf8_lossy(&a.stderr).trim())))
    }
}

/// Committet genau die genannten Pfade (relativ zur Wurzel, auch gelöschte). Andere Änderungen im
/// Arbeitsbaum oder im Index bleiben unberührt. Ändert sich nichts, entsteht kein Commit.
pub fn committen(wurzel: &Path, pfade: &[String], autor: &Person, nachricht: &str) -> Result<bool, Fehler> {
    let pfade = &relevante_pfade(wurzel, pfade, autor)?;
    if pfade.is_empty() {
        return Ok(false);
    }
    let mut add = git(wurzel, autor);
    add.args(["add", "-A", "--"]).args(pfade);
    ausfuehren(add, "add")?;
    let mut diff = git(wurzel, autor);
    diff.args(["diff", "--cached", "--quiet", "--"]).args(pfade);
    if diff.status().map_err(|e| Fehler::Intern(format!("git diff: {e}")))?.success() {
        return Ok(false);
    }
    let mut commit = git(wurzel, autor);
    commit.args(["commit", "-q", "-m", nachricht, "--"]).args(pfade);
    ausfuehren(commit, "commit")?;
    Ok(true)
}

/// Pfade, die Git kennt oder die es auf der Platte gibt — nur über diese spricht ein Commit.
fn relevante_pfade(wurzel: &Path, pfade: &[String], autor: &Person) -> Result<Vec<String>, Fehler> {
    let mut ls = git(wurzel, autor);
    ls.args(["ls-files", "-z", "--"]).args(pfade);
    let bekannt = ausfuehren(ls, "ls-files")?.stdout;
    let bekannt: Vec<&[u8]> = bekannt.split(|b| *b == 0).collect();
    Ok(pfade.iter().filter(|p| wurzel.join(p).exists() || bekannt.contains(&p.as_bytes())).cloned().collect())
}
