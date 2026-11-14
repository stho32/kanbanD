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
///
/// Eine Aktion ist ganz oder gar nicht (ADR-0005 N1): scheitert das Committen, nimmt diese Funktion ihre
/// Pfade wieder zurück — neue Dateien verschwinden, geänderte und gelöschte stehen wieder auf HEAD, der
/// Index ist so wie vorher. Danach ist der Ordner in dem Zustand, in dem die Aktion ihn vorfand.
///
/// Die Nachricht ist abgeleiteter Text: [`crate::nachricht::fertig`] entfernt Steuerzeichen und begrenzt die
/// Länge, bevor Git sie als Argument sieht — kein Schreibweg kann einen Commit an einem NUL-Byte oder einer
/// übergroßen Nachricht scheitern lassen.
///
/// Die zweite Linie aus ADR-0008 gilt auch hier (ADR-0005 N2): die Pfade werden **vor** `git add` und vor jedem
/// Zugriff der Rücknahme geprüft, weil die direkten Aufrufer (`anhaenge`, `fieber`) nicht durch `aktion()` gehen.
/// Ein Verstoß endet intern; Index und Arbeitsbaum bleiben unberührt.
pub fn committen(wurzel: &Path, pfade: &[String], autor: &Person, nachricht: &str) -> Result<bool, Fehler> {
    crate::ablage::pfade_pruefen(&pfade.iter().map(String::as_str).collect::<Vec<_>>())
        .map_err(|grund| Fehler::Intern(format!("Programmfehler, nichts committet: {grund}")))?;
    let pfade = &relevante_pfade(wurzel, pfade, autor)?;
    if pfade.is_empty() {
        return Ok(false);
    }
    let bekannt = in_head(wurzel, pfade, autor)?;
    match committen_und_pruefen(wurzel, pfade, autor, &crate::nachricht::fertig(nachricht)) {
        Ok(committet) => Ok(committet),
        Err(fehler) => match zuruecknehmen(wurzel, pfade, &bekannt, autor) {
            Ok(()) => Err(Fehler::Intern(format!("{}; zurückgenommen: {}", fehler.meldung(), pfade.join(", ")))),
            Err(grund) => Err(Fehler::Intern(format!("{}; Rücknahme unvollständig: {grund}", fehler.meldung()))),
        },
    }
}

fn committen_und_pruefen(wurzel: &Path, pfade: &[String], autor: &Person, nachricht: &str) -> Result<bool, Fehler> {
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

/// Die Pfade, die HEAD kennt — nur für sie gibt es einen Stand, den eine Rücknahme wiederherstellen kann.
/// Ohne HEAD (ein Ordner ohne ersten Commit) kennt es keinen.
fn in_head(wurzel: &Path, pfade: &[String], autor: &Person) -> Result<std::collections::HashSet<String>, Fehler> {
    let mut ls = git(wurzel, autor);
    ls.args(["ls-tree", "-r", "--name-only", "-z", "HEAD", "--"]).args(pfade);
    let Ok(a) = ls.output() else { return Ok(Default::default()) };
    if !a.status.success() {
        return Ok(Default::default());
    }
    Ok(a.stdout.split(|b| *b == 0).filter(|p| !p.is_empty()).map(|p| String::from_utf8_lossy(p).into_owned()).collect())
}

/// Rücknahme (ADR-0005 N1): unsere Pfade aus dem Index zurück auf HEAD, geänderte und gelöschte aus HEAD
/// wiederherstellen, was HEAD nicht kennt, hat die Aktion angelegt und verschwindet. Fremde Pfade bleiben
/// unberührt.
///
/// Was sich nicht zurücknehmen ließ, kommt als `Err` zurück (ADR-0005 N2 Punkt 4) — der Aufrufer trägt es in
/// die Meldung, statt „zurückgenommen“ zu behaupten. Ein Pfad, der schon fehlt, ist kein Fehlschlag.
fn zuruecknehmen(wurzel: &Path, pfade: &[String], bekannt: &std::collections::HashSet<String>, autor: &Person) -> Result<(), String> {
    let mut fehler = vec![];
    let mut reset = git(wurzel, autor);
    reset.args(["reset", "-q", "--"]).args(pfade);
    match reset.output() {
        Ok(a) if a.status.success() => {}
        Ok(a) => fehler.push(format!("Index nicht zurückgesetzt: {}", String::from_utf8_lossy(&a.stderr).trim())),
        Err(e) => fehler.push(format!("Index nicht zurückgesetzt: {e}")),
    }
    for pfad in pfade {
        if bekannt.contains(pfad) {
            let mut her = git(wurzel, autor);
            her.args(["checkout", "-q", "HEAD", "--"]).arg(pfad);
            match her.output() {
                Ok(a) if a.status.success() => {}
                Ok(a) => fehler.push(format!("{pfad} ließ sich nicht wiederherstellen: {}", String::from_utf8_lossy(&a.stderr).trim())),
                Err(e) => fehler.push(format!("{pfad} ließ sich nicht wiederherstellen: {e}")),
            }
        } else {
            match std::fs::remove_file(wurzel.join(pfad)) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => fehler.push(format!("{pfad} ließ sich nicht entfernen: {e}")),
            }
        }
    }
    if fehler.is_empty() {
        Ok(())
    } else {
        Err(fehler.join("; "))
    }
}

/// Pfade, die Git kennt oder die es auf der Platte gibt — nur über diese spricht ein Commit.
fn relevante_pfade(wurzel: &Path, pfade: &[String], autor: &Person) -> Result<Vec<String>, Fehler> {
    let mut ls = git(wurzel, autor);
    ls.args(["ls-files", "-z", "--"]).args(pfade);
    let bekannt = ausfuehren(ls, "ls-files")?.stdout;
    let bekannt: Vec<&[u8]> = bekannt.split(|b| *b == 0).collect();
    Ok(pfade.iter().filter(|p| wurzel.join(p).exists() || bekannt.contains(&p.as_bytes())).cloned().collect())
}

/// Der Autor eines Commits, wie Git ihn festhält (R00123/B0571).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Autor {
    pub name: String,
    pub email: String,
}

impl Autor {
    /// Das Kürzel einer kanbanD-Person (`<kürzel>@kanbanD`) oder der Git-Name eines fremden Autors (R00123).
    pub fn wer(&self) -> String {
        self.email.strip_suffix("@kanbanD").map(str::to_string).unwrap_or_else(|| self.name.clone())
    }
}

/// Ein committeter Stand einer Datei (R00123/B0571): Zeitpunkt in Ortszeit, Inhalt und Autor des Commits.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Stand {
    pub zeitpunkt: chrono::NaiveDateTime,
    pub inhalt: String,
    pub autor: Autor,
}

/// Ein Commit je Zeile: Hash, Autor und Zeitpunkt. Die Felder trennt `\x1f` (Autor-Namen dürfen Leerzeichen tragen).
const LOG_FORMAT: &str = "%H%x1f%an%x1f%ae%x1f%at";

fn autor_zeit_zeile(z: &str) -> Option<(String, Autor, i64)> {
    let mut t = z.split('\u{1f}');
    let hash = t.next()?.to_string();
    let autor = Autor { name: t.next()?.to_string(), email: t.next()?.to_string() };
    let zeit: i64 = t.next()?.parse().ok()?;
    Some((hash, autor, zeit))
}

/// Alle committeten Stände einer Datei (relativ zur Wurzel) in zeitlicher Folge, mit Autor-Zeitpunkt in Ortszeit.
/// Commits, in denen die Datei gelöscht ist, fehlen.
pub fn staende(wurzel: &Path, rel: &str) -> Result<Vec<Stand>, Fehler> {
    let lesen = |args: &[&str]| -> Result<String, Fehler> {
        let a = Command::new("git").arg("-C").arg(wurzel).args(args).output().map_err(|e| Fehler::Intern(format!("git: {e}")))?;
        Ok(String::from_utf8_lossy(&a.stdout).into_owned())
    };
    let praefix = lesen(&["rev-parse", "--show-prefix"])?.trim().to_string();
    let format = format!("--format={LOG_FORMAT}");
    let log = lesen(&["log", "--reverse", &format, "--", rel])?;
    let commits: Vec<(String, Autor, i64)> = log.lines().filter_map(autor_zeit_zeile).collect();
    let anfragen: Vec<String> = commits.iter().map(|(h, _, _)| format!("{h}:{praefix}{rel}")).collect();
    Ok(staende_aus(&commits, blob_inhalte(wurzel, &anfragen)?))
}

/// Je Datei alle committeten Stände in Commit-Folge — ein `git log --name-only` für alle Pfade und ein
/// `cat-file --batch` für alle Blobs (#131). Was davon den Verlauf einer Karte betrifft, wählt `verlauf` aus.
pub fn staende_mehrerer(wurzel: &Path, rels: &[String]) -> Result<Vec<Vec<Stand>>, Fehler> {
    if rels.is_empty() {
        return Ok(vec![]);
    }
    let lesen = |args: &[&str]| -> Result<String, Fehler> {
        let a = Command::new("git").arg("-C").arg(wurzel).args(args).output().map_err(|e| Fehler::Intern(format!("git: {e}")))?;
        Ok(String::from_utf8_lossy(&a.stdout).into_owned())
    };
    let praefix = lesen(&["rev-parse", "--show-prefix"])?.trim().to_string();
    // `-z` hält Pfade unverändert; der Commit-Kopf trägt `\x1f` als Trenner.
    let format = format!("--format={LOG_FORMAT}");
    let mut args: Vec<&str> = vec!["log", "--reverse", "-z", "--name-only", &format, "--"];
    args.extend(rels.iter().map(String::as_str));
    let log = lesen(&args)?;
    let index: std::collections::HashMap<String, usize> = rels.iter().enumerate().map(|(i, rel)| (format!("{praefix}{rel}"), i)).collect();
    let mut anfragen: Vec<(usize, String, Autor, i64)> = vec![];
    let mut kopf: Option<(String, Autor, i64)> = None;
    for stueck in log.split('\0') {
        let stueck = stueck.trim_start_matches('\n');
        if stueck.is_empty() {
            continue;
        }
        if let Some((hash, autor, zeit)) = autor_zeit_zeile(stueck) {
            kopf = Some((hash, autor, zeit));
            continue;
        }
        let Some((hash, autor, zeit)) = &kopf else { continue };
        // Eine Datei des Commits, die nicht zu `rels` gehört (ein Commit berührt mehrere Dateien), bleibt außen vor.
        if let Some(&i) = index.get(stueck) {
            anfragen.push((i, format!("{hash}:{stueck}"), autor.clone(), *zeit));
        }
    }
    let inhalte = blob_inhalte(wurzel, &anfragen.iter().map(|(_, a, _, _)| a.clone()).collect::<Vec<_>>())?;
    let mut je: Vec<Vec<Stand>> = vec![vec![]; rels.len()];
    for ((i, _, autor, zeit), inhalt) in anfragen.into_iter().zip(inhalte) {
        if let (Some(inhalt), Some(zp)) = (inhalt, chrono::DateTime::from_timestamp(zeit, 0)) {
            je[i].push(Stand { zeitpunkt: zp.with_timezone(&chrono::Local).naive_local(), inhalt, autor });
        }
    }
    Ok(je)
}

/// Commits und ihre Blob-Inhalte zu Ständen zusammensetzen; `inhalte` in der Reihenfolge von `commits`.
fn staende_aus(commits: &[(String, Autor, i64)], inhalte: Vec<Option<String>>) -> Vec<Stand> {
    let mut staende = vec![];
    for ((_, autor, zeit), inhalt) in commits.iter().zip(inhalte) {
        if let (Some(inhalt), Some(zp)) = (inhalt, chrono::DateTime::from_timestamp(*zeit, 0)) {
            staende.push(Stand { zeitpunkt: zp.with_timezone(&chrono::Local).naive_local(), inhalt, autor: autor.clone() });
        }
    }
    staende
}

/// Die Inhalte zu Anfragen `<hash>:<pfad>` in derselben Reihenfolge; `None`, wo es keinen Blob gibt (etwa in einem
/// Commit, der die Datei löscht). Ein `cat-file --batch` für alle — der Grund, warum die Historie je Datei billig ist.
fn blob_inhalte(wurzel: &Path, anfragen: &[String]) -> Result<Vec<Option<String>>, Fehler> {
    if anfragen.is_empty() {
        return Ok(vec![]);
    }
    let mut kind = Command::new("git").arg("-C").arg(wurzel).args(["cat-file", "--batch"]).stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::piped()).spawn().map_err(|e| Fehler::Intern(format!("git cat-file: {e}")))?;
    let anfrage: String = anfragen.iter().map(|a| format!("{a}\n")).collect();
    let mut eingabe = kind.stdin.take().expect("stdin");
    let schreiber = std::thread::spawn(move || std::io::Write::write_all(&mut eingabe, anfrage.as_bytes()));
    let ausgabe = kind.wait_with_output().map_err(|e| Fehler::Intern(format!("git cat-file: {e}")))?.stdout;
    let _ = schreiber.join();
    let mut inhalte: Vec<Option<String>> = Vec::with_capacity(anfragen.len());
    let mut pos = 0;
    for _ in anfragen {
        let Some(ende) = ausgabe[pos..].iter().position(|b| *b == b'\n') else { break };
        let kopf = String::from_utf8_lossy(&ausgabe[pos..pos + ende]).into_owned();
        pos += ende + 1;
        let teile: Vec<&str> = kopf.split(' ').collect();
        if teile.len() == 3 && teile[1] == "blob" {
            let groesse: usize = teile[2].parse().unwrap_or(0);
            let inhalt = String::from_utf8_lossy(&ausgabe[pos..pos + groesse]).into_owned();
            pos += groesse + 1;
            inhalte.push(Some(inhalt));
        } else {
            inhalte.push(None);
        }
    }
    inhalte.resize(anfragen.len(), None);
    Ok(inhalte)
}

/// Der jüngste Commit, der `rel` gelöscht hat, samt Zeitpunkt und Autor — oder keiner (R00123/B0573).
pub fn loeschung(wurzel: &Path, rel: &str) -> Result<Option<Stand>, Fehler> {
    let format = format!("--format={LOG_FORMAT}");
    let a = Command::new("git").arg("-C").arg(wurzel).args(["log", "--diff-filter=D", &format, "--", rel]).output().map_err(|e| Fehler::Intern(format!("git: {e}")))?;
    let text = String::from_utf8_lossy(&a.stdout);
    let Some(zeile) = text.lines().find(|z| !z.trim().is_empty()) else { return Ok(None) };
    let mut t = zeile.split('\u{1f}');
    let _hash = t.next();
    let autor = Autor { name: t.next().unwrap_or_default().to_string(), email: t.next().unwrap_or_default().to_string() };
    let zeit: i64 = t.next().and_then(|s| s.parse().ok()).ok_or_else(|| Fehler::Intern("git log: Zeitpunkt fehlt".into()))?;
    let zeitpunkt = chrono::DateTime::from_timestamp(zeit, 0).ok_or_else(|| Fehler::Intern("git log: Zeitpunkt unlesbar".into()))?.with_timezone(&chrono::Local).naive_local();
    Ok(Some(Stand { zeitpunkt, inhalt: String::new(), autor }))
}

/// Der jüngste Pfad unter `ordner/`, den Git als gelöscht führt und dessen Dateiname die Nummer `NNNN-` trägt (R00123).
/// Findet eine gelöschte Aufgabendatei, deren Nummer noch über die Git-Geschichte identifiziert.
pub fn pfad_zu_nummer(wurzel: &Path, ordner: &str, nummer: u32) -> Result<Option<String>, Fehler> {
    let praefix = format!("{nummer:04}-");
    let a = Command::new("git").arg("-C").arg(wurzel).args(["log", "--all", "--diff-filter=D", "--pretty=format:", "--name-only", "--", &format!("{ordner}/")]).output().map_err(|e| Fehler::Intern(format!("git: {e}")))?;
    let text = String::from_utf8_lossy(&a.stdout);
    Ok(text
        .lines()
        .map(str::trim)
        .filter(|z| !z.is_empty())
        .find(|pfad| pfad.rsplit('/').next().is_some_and(|n| n.starts_with(&praefix) && n.ends_with(".md")))
        .map(str::to_string))
}

/// Alle committeten Stände einer Datei mit vollem Pfad, auch in einem fremden Repository (dem Arbeits-Repository einer Anwendung);
/// liegt sie in keinem Repository, gibt es keine.
pub fn staende_der_datei(datei: &Path) -> Vec<String> {
    let (Some(ordner), Some(name)) = (datei.parent(), datei.file_name()) else { return vec![] };
    if git_verzeichnis(ordner).is_none() {
        return vec![];
    }
    staende(ordner, &name.to_string_lossy()).map(|s| s.into_iter().map(|stand| stand.inhalt).collect()).unwrap_or_default()
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

/// Das Git-Verzeichnis des Repositorys, in dem `ordner` liegt — absolut; ohne Repository keines.
pub fn git_verzeichnis(ordner: &Path) -> Option<std::path::PathBuf> {
    let a = Command::new("git").arg("-C").arg(ordner).args(["rev-parse", "--absolute-git-dir"]).output().ok().filter(|a| a.status.success())?;
    let pfad = std::path::PathBuf::from(String::from_utf8_lossy(&a.stdout).trim());
    Some(pfad.canonicalize().unwrap_or(pfad))
}
