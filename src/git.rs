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

/// Alle committeten Stände einer Datei (relativ zur Wurzel) in zeitlicher Folge, mit Autor-Zeitpunkt in Ortszeit.
/// Commits, in denen die Datei gelöscht ist, fehlen.
pub fn staende(wurzel: &Path, rel: &str) -> Result<Vec<(chrono::NaiveDateTime, String)>, Fehler> {
    let lesen = |args: &[&str]| -> Result<String, Fehler> {
        let a = Command::new("git").arg("-C").arg(wurzel).args(args).output().map_err(|e| Fehler::Intern(format!("git: {e}")))?;
        Ok(String::from_utf8_lossy(&a.stdout).into_owned())
    };
    let praefix = lesen(&["rev-parse", "--show-prefix"])?.trim().to_string();
    let log = lesen(&["log", "--reverse", "--format=%H %at", "--", rel])?;
    let commits: Vec<(&str, i64)> = log.lines().filter_map(|z| z.split_once(' ')).filter_map(|(h, t)| Some((h, t.parse().ok()?))).collect();
    if commits.is_empty() {
        return Ok(vec![]);
    }
    let mut kind = Command::new("git")
        .arg("-C")
        .arg(wurzel)
        .args(["cat-file", "--batch"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| Fehler::Intern(format!("git cat-file: {e}")))?;
    let anfrage: String = commits.iter().map(|(h, _)| format!("{h}:{praefix}{rel}\n")).collect();
    let mut eingabe = kind.stdin.take().expect("stdin");
    let schreiber = std::thread::spawn(move || std::io::Write::write_all(&mut eingabe, anfrage.as_bytes()));
    let ausgabe = kind.wait_with_output().map_err(|e| Fehler::Intern(format!("git cat-file: {e}")))?.stdout;
    let _ = schreiber.join();
    let mut staende = vec![];
    let mut pos = 0;
    for (_, zeit) in &commits {
        let Some(ende) = ausgabe[pos..].iter().position(|b| *b == b'\n') else { break };
        let kopf = String::from_utf8_lossy(&ausgabe[pos..pos + ende]).into_owned();
        pos += ende + 1;
        let teile: Vec<&str> = kopf.split(' ').collect();
        if teile.len() == 3 && teile[1] == "blob" {
            let groesse: usize = teile[2].parse().unwrap_or(0);
            let inhalt = String::from_utf8_lossy(&ausgabe[pos..pos + groesse]).into_owned();
            pos += groesse + 1;
            if let Some(zp) = chrono::DateTime::from_timestamp(*zeit, 0) {
                staende.push((zp.with_timezone(&chrono::Local).naive_local(), inhalt));
            }
        }
    }
    Ok(staende)
}

/// Hat die Datei Änderungen, die nicht committet sind (ungestagt, gestagt oder unversioniert)?
/// Liegt sie in keinem Repository oder fehlt Git, gilt sie als unverändert. Liest nur: der Index wird
/// nicht nebenbei aufgefrischt (`GIT_OPTIONAL_LOCKS=0`), sonst löste jede Abfrage beim Dateiwächter
/// eine neue Änderung im Repository aus.
pub fn geaendert(datei: &Path) -> bool {
    let (Some(ordner), Some(name)) = (datei.parent(), datei.file_name()) else { return false };
    let Ok(a) = Command::new("git").arg("-C").arg(ordner).env("GIT_OPTIONAL_LOCKS", "0").args(["status", "--porcelain", "--"]).arg(name).output() else { return false };
    a.status.success() && !a.stdout.is_empty()
}
