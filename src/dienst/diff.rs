//! Diff eines Commits lesen (R00206, ADR-0032 Punkt 6 mit N4) — Dateiliste, Zeilengrenze vor dem Patch-Lauf, ein
//! Patch-Lauf mit Bytegrenze, einzeln nachladen; live aus dem Arbeits-Repository, nur lesend, ohne die Sperre.

use crate::git::arbeitsrepo::{self, Arbeitsrepofehler, Diffart, Vergleich};
use crate::modell::{Diffdatei, GRENZE_DATEILISTE, GRENZE_DATEILISTE_EINZELN, GRENZE_EINZELN, GRENZE_PATCH_LAUF, Fassung, Hinweis, Rohdatei, Verteilung, abschliessen, dateiliste, diffdatei, getroffen, lauf_der_liste, patches_zuordnen, patches_zuordnen_im_bezug, roh_lesen, zahlen_im_bezug, zahlen_mit_pfaden};
use std::path::Path;
use std::time::Instant;

/// Was gelesen wird: die ganze Liste des Commits oder eine Datei (`datei=`, `neu`, bei gelöschten `alt`, buchstäblich).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Auswahl<'a> {
    Liste,
    Datei(&'a str),
}

/// Dateien und Hinweise eines Diffs (ohne `commits`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diffinhalt {
    pub dateien: Vec<Diffdatei>,
    pub hinweise: Vec<Hinweis>,
}

/// Was beim Lesen des Inhalts scheitert.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Inhaltsfehler {
    Git(Arbeitsrepofehler),
    /// `datei=` steht nicht in der Dateiliste; `liste_abgeschnitten`: die Liste war bis zur Grenze abgeschnitten
    DateiFehlt { liste_abgeschnitten: bool },
    /// Ausgabe von Git ohne die erwartete Form
    Form(String),
}

impl From<Arbeitsrepofehler> for Inhaltsfehler {
    fn from(f: Arbeitsrepofehler) -> Self {
        Inhaltsfehler::Git(f)
    }
}

/// Der Inhalt des Diffs: `gesamt` ist die wahre Zahl der Dateien (`commits[0].dateien`).
/// `fassung`: für JSON nur `patch`, für `format=patch` nur die Stücke (ADR-0032 N5.1 Regel 7).
pub fn inhalt_lesen(wurzel: &Path, vergleich: Vergleich, gesamt: u64, auswahl: Auswahl, fassung: Fassung, frist: Instant) -> Result<Diffinhalt, Inhaltsfehler> {
    match auswahl {
        Auswahl::Liste => liste_lesen(wurzel, vergleich, gesamt, fassung, frist),
        Auswahl::Datei(name) => datei_lesen(wurzel, vergleich, name, fassung, frist),
    }
}

/// Die Liste: zwei Läufe der Dateiliste (je 1 MB), Kappe, Zeilengrenze und Pfadlänge, dann ein Patch-Lauf (4 MB) für
/// die übrigen Dateien — die großen erreichen ihn nie, die Pfadangabe bleibt unter 1 MB (ADR-0032 N4.3, N5.5 S1).
fn liste_lesen(wurzel: &Path, vergleich: Vergleich, gesamt: u64, fassung: Fassung, frist: Instant) -> Result<Diffinhalt, Inhaltsfehler> {
    let roh = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Roh, &[], GRENZE_DATEILISTE, frist)?;
    let zahlen = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Zahlen, &[], GRENZE_DATEILISTE, frist)?;
    let mut dateien = dateiliste(&roh.ausgabe, roh.abgeschnitten, &zahlen.ausgabe, zahlen.abgeschnitten).ok_or_else(|| Inhaltsfehler::Form("Dateiliste von diff-tree unlesbar".into()))?;
    let mut hinweise = vec![];
    if (dateien.len() as u64) < gesamt {
        hinweise.push(Hinweis::DateienGekappt { gezeigt: dateien.len(), gesamt });
    }
    let (im_lauf, mit_pfadangabe) = lauf_der_liste(&mut dateien, gesamt);
    hinweise.extend(dateien.iter().filter(|d| d.pfad_zu_lang()).map(|d| Hinweis::ZuGrossZumAnzeigen { datei: d.name().to_string() }));
    if im_lauf.is_empty() {
        return Ok(Diffinhalt { dateien, hinweise });
    }
    if mit_pfadangabe {
        // abgeschlossen gegen die gelesene Liste vor der Kappe: der Lauf sieht ganze Einträge, Git paart wie dort (N7.7);
        // die Angabe ist Teil der Liste und bleibt so unter 1 MB (N5.5 S1)
        let bezug: Vec<Diffdatei> = roh_lesen(&roh.ausgabe).ok_or_else(|| Inhaltsfehler::Form("Dateiliste von diff-tree unlesbar".into()))?.into_iter().map(|r| diffdatei(r, None)).collect();
        let pfade_bezug: Vec<&[Vec<u8>]> = bezug.iter().map(|d| d.pfade_roh.as_slice()).collect();
        let angabe = abschliessen(im_lauf.iter().flat_map(|i| dateien[*i].pfade_roh.iter().cloned()), &pfade_bezug);
        let pfade: Vec<&[u8]> = angabe.iter().map(Vec::as_slice).collect();
        let patch = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Patch, &pfade, GRENZE_PATCH_LAUF, frist)?;
        patches_zuordnen_im_bezug(&mut dateien, &im_lauf, &bezug, &angabe, &patch.ausgabe, patch.abgeschnitten, Verteilung::Liste, fassung).map_err(Inhaltsfehler::Form)?;
    } else {
        let patch = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Patch, &[], GRENZE_PATCH_LAUF, frist)?;
        patches_zuordnen(&mut dateien, &im_lauf, &patch.ausgabe, patch.abgeschnitten, Verteilung::Liste, fassung).map_err(Inhaltsfehler::Form)?;
    }
    Ok(Diffinhalt { dateien, hinweise })
}

/// Eine Datei: die Dateiliste ungekappt bis 20 MB (nur `--raw -z`), der Name gegen `neu` (bei gelöschten `alt`) —
/// nur Pfade aus dieser Liste erreichen Git, wörtlich; dann Zähler und Patch bis 8 MB. Die Pfadangabe trifft auch
/// `foo/…` (ADR-0032 N5.2): sie ist gegen die Liste abgeschlossen, und Zähler wie Stücke verbinden sich über alle
/// getroffenen Einträge der Liste, damit Git wie dort paart (N7.7); nur der angefragte Eintrag bleibt.
fn datei_lesen(wurzel: &Path, vergleich: Vergleich, name: &str, fassung: Fassung, frist: Instant) -> Result<Diffinhalt, Inhaltsfehler> {
    let roh = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Roh, &[], GRENZE_DATEILISTE_EINZELN, frist)?;
    let liste_abgeschnitten = roh.abgeschnitten;
    let rohe = roh_lesen(&roh.ausgabe).ok_or_else(|| Inhaltsfehler::Form("Dateiliste von diff-tree unlesbar".into()))?;
    // die Dateiliste ist nur Zwischenstand: frei vor dem Patch-Lauf (ADR-0032 N5.1 Regel 6); es bleiben die getroffenen
    drop(roh);
    let (angabe, mut bezug) = bezug_der_datei(rohe, name);
    if angabe.is_empty() {
        return Err(Inhaltsfehler::DateiFehlt { liste_abgeschnitten });
    }
    let pfade: Vec<&[u8]> = angabe.iter().map(Vec::as_slice).collect();
    let zahlen = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Zahlen, &pfade, GRENZE_DATEILISTE, frist)?;
    let zahlen = zahlen_mit_pfaden(&zahlen.ausgabe).ok_or_else(|| Inhaltsfehler::Form("Zähler von diff-tree unlesbar".into()))?;
    zahlen_im_bezug(&mut bezug, zahlen).map_err(Inhaltsfehler::Form)?;
    let mut dateien: Vec<Diffdatei> = bezug.iter().filter(|d| d.name() == name).cloned().collect();
    let patch = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Patch, &pfade, GRENZE_EINZELN, frist)?;
    let alle: Vec<usize> = (0..dateien.len()).collect();
    patches_zuordnen_im_bezug(&mut dateien, &alle, &bezug, &angabe, &patch.ausgabe, patch.abgeschnitten, Verteilung::Einzeln, fassung).map_err(Inhaltsfehler::Form)?;
    let hinweise = dateien.iter().filter(|d| d.gross).map(|d| Hinweis::ZuGrossZumAnzeigen { datei: d.name().to_string() }).collect();
    Ok(Diffinhalt { dateien, hinweise })
}

/// Die Pfadangabe für `datei=<name>`, abgeschlossen gegen die Dateiliste, und die Einträge der Liste, die sie trifft
/// (in der Reihenfolge der Liste, noch ohne Zähler). Leer, wenn kein Eintrag `name` heißt (`neu`, bei gelöschten `alt`).
fn bezug_der_datei(rohe: Vec<Rohdatei>, name: &str) -> (Vec<Vec<u8>>, Vec<Diffdatei>) {
    let pfade: Vec<&[Vec<u8>]> = rohe.iter().map(|r| r.pfade.as_slice()).collect();
    // der Name wie `Diffdatei::name`: der letzte Pfad, ersatzweise dekodiert
    let gesucht = rohe.iter().filter(|r| r.pfade.last().is_some_and(|p| String::from_utf8_lossy(p) == name)).flat_map(|r| r.pfade.iter().cloned());
    let angabe = abschliessen(gesucht, &pfade);
    let mut drin = vec![false; rohe.len()];
    for j in getroffen(&angabe, &pfade) {
        drin[j] = true;
    }
    drop(pfade);
    let bezug = rohe.into_iter().zip(drin).filter(|(_, d)| *d).map(|(r, _)| diffdatei(r, None)).collect();
    (angabe, bezug)
}

// ---- Dienst: Zulassung, ETag, Gesamtgrenze ---------------------------------------------------------------------------

use super::Kanban;
use super::commits_lesen::GESAMTGRENZE;
use crate::fehler::Fehler;
use super::antwortbudget::Rumpf;
use crate::git::arbeitsrepo::Objekt;
use crate::modell::{Anwendungen, Commitzustand, GRENZEN_VERSION, HASH_MAX, Verweisform, patch_text, titel_kuerzen, verweis_lesen};
use serde::Serialize;

/// Längster Pfad, den `datei=` nennen darf (Byte, wie `PATH_MAX`).
pub const DATEI_HOECHSTENS: usize = crate::modell::PFAD_HOECHSTENS;

/// Wie die Antwort aussieht: JSON (Form F2) oder Text (`format=patch`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Diffformat {
    Json,
    Patch,
}

/// Die Anfrage `GET …/diff` nach dem Lesen der Abfrage; `bekannt` ist der Wert von `If-None-Match`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diffanfrage {
    /// ohne `commit` der Gesamt-Diff der Karte (R00208)
    pub commit: Option<String>,
    /// nur ohne `commit`: die Anwendung des Gesamt-Diffs (leer = Standardanwendung)
    pub anwendung: Option<String>,
    pub datei: Option<String>,
    pub format: Diffformat,
    pub bekannt: Option<String>,
}

impl Diffanfrage {
    /// Die Abfrage `commit`, `anwendung`, `datei`, `format` — ohne Git: `anwendung` zusammen mit `commit`, `format`
    /// unbekannt, `datei` leer, mit NUL oder länger als [`DATEI_HOECHSTENS`] → 400. Ohne `commit` gilt der Gesamt-Diff
    /// der Karte (R00208, ersetzt „ohne commit 400“ aus R00206).
    pub fn aus_paaren(paare: &[(String, String)], bekannt: Option<String>) -> Result<Diffanfrage, Fehler> {
        let wert = |name: &str| paare.iter().find(|(k, _)| k == name).map(|(_, w)| w.clone());
        let commit = wert("commit");
        let anwendung = wert("anwendung");
        if commit.is_some() && anwendung.is_some() {
            return Err(Fehler::Ungueltig("anwendung gilt nur ohne commit — der Verweis trägt sein Kürzel".into()));
        }
        let format = match wert("format").as_deref() {
            None => Diffformat::Json,
            Some("patch") => Diffformat::Patch,
            Some(f) => return Err(Fehler::Ungueltig(format!("format „{}“ gibt es nicht — nur format=patch", crate::nachricht::wert(f)))),
        };
        let datei = wert("datei");
        if let Some(d) = &datei {
            if d.is_empty() || d.contains('\0') || d.len() > DATEI_HOECHSTENS {
                return Err(Fehler::Ungueltig(format!("datei ist leer, enthält NUL oder ist länger als {DATEI_HOECHSTENS} Byte")));
            }
        }
        Ok(Diffanfrage { commit, anwendung, datei, format, bekannt })
    }
}

/// Der eine Eintrag von `commits` (R00206 FA 4): wie in der Liste, ohne Zustand und Zweige.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Diffcommit {
    pub verweis: String,
    pub anwendung: String,
    pub hash: String,
    pub titel: String,
    pub autor: String,
    pub datum: String,
    pub plus: u64,
    pub minus: u64,
    pub dateien: u64,
}

/// Die Antwort von `GET …/diff` (Form F2).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Diff {
    pub anwendung: String,
    pub commits: Vec<Diffcommit>,
    pub dateien: Vec<Diffdatei>,
    pub hinweise: Vec<Hinweis>,
}

/// Was der Dienst liefert: 304 ohne Rumpf oder den fertigen Rumpf (JSON-Bytes bzw. Patch-Text) mit seinem Platz im
/// Antwortbudget, je mit `ETag`, wenn der Verweis einen vollen Hash trägt.
#[derive(Debug)]
pub enum Diffantwort {
    Unveraendert(String),
    Rumpf { etag: Option<String>, format: Diffformat, rumpf: Rumpf },
}

impl Kanban {
    /// `GET /api/aufgaben/{nr}/diff` — liest die Aufgabe ohne Sperre und schreibt nie. Alles, was ohne Git geht (Form,
    /// Verweis an der Karte, Register, `ETag`), kommt vor dem ersten Git-Aufruf; Git läuft nur bis `frist` (Eintritt in
    /// den Handler + [`GESAMTGRENZE`]), danach 503 — nie eine Teilantwort. Der fertige Rumpf belegt noch im Platz der
    /// Lesegrenze seinen Platz im Antwortbudget, ohne Warten; passt er nicht, sofort 503 (ADR-0032 N5.1).
    pub fn diff_lesen(&self, nr: u32, anfrage: &Diffanfrage, frist: Instant) -> Result<Diffantwort, Fehler> {
        let Some(commit) = anfrage.commit.as_deref() else { return self.gesamt_diff_lesen(nr, anfrage, frist) };
        let aufgabe = self.ordner().aufgabe(nr)?;
        let form = Verweisform::lesen(commit).map_err(|f| Fehler::Verweis { meldung: f.meldung, verweis: f.verweis, fehlt: false })?;
        let treffer: Vec<&String> = aufgabe.commits.iter().filter(|c| super::commits::passt(c, &form)).collect();
        let gespeichert = match treffer.as_slice() {
            [v] => v.as_str(),
            [] => return Err(Fehler::Verweis { meldung: format!("#{nr} hat keinen Commit-Verweis „{}“", crate::nachricht::wert(commit)), verweis: commit.to_string(), fehlt: true }),
            mehrere => return Err(Fehler::Verweis { meldung: format!("„{}“ passt zu {} Commit-Verweisen an #{nr} — längeren Hash nennen", crate::nachricht::wert(commit), mehrere.len()), verweis: commit.to_string(), fehlt: false }),
        };
        let quellen = self.ordner().einstellungen()?.unwrap_or_default().quellen;
        let anwendungen = Anwendungen::aus(&quellen);
        Verweisform::lesen(gespeichert).map_err(|f| zustand(Commitzustand::Unlesbar, Some(f.meldung)))?;
        let (anwendung, hash) = verweis_lesen(gespeichert, &anwendungen).map_err(|_| zustand(Commitzustand::AnwendungUnbekannt, None))?;
        let etag = (hash.len() == 40 || hash.len() == HASH_MAX).then(|| etag(gespeichert, anfrage));
        if let (Some(e), Some(b)) = (&etag, &anfrage.bekannt) {
            if b.split(',').any(|w| w.trim() == e) {
                return Ok(Diffantwort::Unveraendert(e.clone()));
            }
        }
        // ab hier startet Git: höchstens 4 Lesevorgänge gleichzeitig, das Warten zählt zur Frist
        let _platz = self.lesegrenze.betreten(frist).ok_or_else(|| abbruch(Arbeitsrepofehler::Zeitgrenze))?;
        let wurzel = arbeitsrepo::wurzel_bis(self.ordner().wurzel(), anwendung, frist).map_err(repo_fehler)?;
        let voll = match arbeitsrepo::objekte_pruefen(&wurzel, &[hash.as_str()], frist).map_err(repo_fehler)?.remove(0) {
            Objekt::Commit(voll) => voll,
            Objekt::Fehlt => return Err(zustand(Commitzustand::Fehlt, None)),
            Objekt::Mehrdeutig => return Err(zustand(Commitzustand::Unlesbar, Some(format!("Kurz-Hash „{}“ passt zu mehreren Objekten — längeren Hash nennen", crate::nachricht::wert(&hash))))),
            Objekt::NameEinesRefs => return Err(zustand(Commitzustand::Unlesbar, Some(format!("„{}“ ist zugleich der Name eines Zweigs oder Tags — vollen Hash nennen", crate::nachricht::wert(&hash))))),
        };
        let m = arbeitsrepo::metadaten(&wurzel, &[voll.as_str()], frist).map_err(repo_fehler)?.remove(&voll).ok_or_else(|| Fehler::Intern(format!("git: keine Metadaten zu {voll}")))?;
        let vergleich = Vergleich { eltern: m.erster_elternteil.as_deref(), commit: &voll };
        let auswahl = anfrage.datei.as_deref().map_or(Auswahl::Liste, Auswahl::Datei);
        let fassung = match anfrage.format {
            Diffformat::Json => Fassung::Patch,
            Diffformat::Patch => Fassung::Stuecke,
        };
        let mut inhalt = inhalt_lesen(&wurzel, vergleich, m.dateien, auswahl, fassung, frist).map_err(|f| inhaltsfehler(f, nr))?;
        let commit = Diffcommit { verweis: gespeichert.to_string(), anwendung: anwendung.kuerzel.clone(), hash: voll.clone(), titel: titel_kuerzen(&m.titel), autor: m.autor, datum: m.datum, plus: m.plus, minus: m.minus, dateien: m.dateien };
        let bytes = match anfrage.format {
            Diffformat::Json => json(&Diff { anwendung: anwendung.kuerzel.clone(), commits: vec![commit], dateien: inhalt.dateien, hinweise: inhalt.hinweise })?,
            Diffformat::Patch => patch_text(&mut inhalt.dateien).into_bytes(),
        };
        let rumpf = self.antwortbudget.belegen(bytes).ok_or_else(|| Fehler::Ausgelastet(format!("Antwortbudget von {} MB belegt — Diff in einigen Sekunden erneut laden", super::antwortbudget::ANTWORTBUDGET >> 20)))?;
        #[cfg(test)]
        if let Some(haken) = self.nach_dem_belegen.lock().unwrap().take() {
            haken(self.lesegrenze.belegt());
        }
        Ok(Diffantwort::Rumpf { etag, format: anfrage.format, rumpf })
    }
}

/// Der Diff als JSON-Bytes (wie `axum::Json`), das Ziel vorab auf die geschätzte Größe reserviert.
fn json(diff: &Diff) -> Result<Vec<u8>, Fehler> {
    let geschaetzt = diff.dateien.iter().map(|d| d.patch.as_ref().map_or(0, |p| p.len() + p.len() / 16) + 512).sum::<usize>() + 4096;
    let mut bytes = Vec::with_capacity(geschaetzt);
    serde_json::to_writer(&mut bytes, diff).map_err(|f| Fehler::Intern(format!("JSON: {f}")))?;
    Ok(bytes)
}

/// 404 mit dem Zustand des Verweises, wie die Liste ihn nennt (ADR-0032 N4.2).
fn zustand(zustand: Commitzustand, grund: Option<String>) -> Fehler {
    Fehler::Commitzustand { meldung: "kein Diff zu diesem Verweis — der Zustand sagt warum".into(), zustand, grund }
}

/// Repository fehlt oder verweigert → 404 `repository_fehlt` mit Grund; Zeitgrenze → 503; sonst 500.
pub(super) fn repo_fehler(f: Arbeitsrepofehler) -> Fehler {
    match f {
        Arbeitsrepofehler::RepositoryFehlt(grund) => zustand(Commitzustand::RepositoryFehlt, Some(grund)),
        anders => abbruch(anders),
    }
}

/// Zeitgrenze → 503 ohne Teilantwort; alles andere ist ein Fehler des Programms.
pub(super) fn abbruch(f: Arbeitsrepofehler) -> Fehler {
    match f {
        Arbeitsrepofehler::Zeitgrenze => Fehler::Zeitgrenze(format!("Git im Arbeits-Repository antwortete nicht innerhalb von {} s — kein Diff", GESAMTGRENZE.as_secs())),
        Arbeitsrepofehler::ZuvielAusgabe(n) => Fehler::Zeitgrenze(format!("Git lieferte mehr als {n} Zeilen — kein Diff")),
        Arbeitsrepofehler::RepositoryFehlt(m) | Arbeitsrepofehler::Start(m) => Fehler::Intern(format!("git: {m}")),
        Arbeitsrepofehler::KeinCommit => Fehler::Intern("git: kein Commit".into()),
    }
}

fn inhaltsfehler(f: Inhaltsfehler, nr: u32) -> Fehler {
    match f {
        Inhaltsfehler::Git(g) => repo_fehler(g),
        Inhaltsfehler::DateiFehlt { liste_abgeschnitten: true } => Fehler::NichtGefunden(format!("Dateiliste zu groß: die Datei steht nicht in den ersten {} MB der Dateiliste des Commits an #{nr}", GRENZE_DATEILISTE_EINZELN >> 20)),
        Inhaltsfehler::DateiFehlt { liste_abgeschnitten: false } => Fehler::NichtGefunden(format!("die Datei steht nicht in der Dateiliste des Commits an #{nr} — datei= nennt neu, bei gelöschten alt, buchstäblich")),
        Inhaltsfehler::Form(m) => Fehler::Intern(format!("git: {m}")),
    }
}

/// `ETag` aus dem Verweis (wörtlich wie in der Datei), `datei`, `format` und der Version der Grenzen — ein Diff zu einem
/// vollen Hash ändert sich nie, solange die Attribut-Dateien des Arbeits-Repositorys gleich bleiben (ADR-0032 N4.6).
fn etag(verweis: &str, anfrage: &Diffanfrage) -> String {
    // FNV-1a 64 Bit: stabil über Programmversionen, ohne Abhängigkeit
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    let format = match anfrage.format {
        Diffformat::Json => "json",
        Diffformat::Patch => "patch",
    };
    let teile = [verweis.as_bytes(), b"\0", anfrage.datei.as_deref().unwrap_or("\u{1}").as_bytes(), b"\0", format.as_bytes(), b"\0", &GRENZEN_VERSION.to_be_bytes()];
    for b in teile.iter().flat_map(|t| t.iter()) {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("\"diff-{h:016x}\"")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::process::Command;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    fn git(r: &Path, args: &[&str]) -> String {
        let a = Command::new("git").arg("-C").arg(r).args(["-c", "user.name=T", "-c", "user.email=t@example.org"]).args(args).output().unwrap();
        assert!(a.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&a.stderr));
        String::from_utf8_lossy(&a.stdout).trim().to_string()
    }

    /// Ein Arbeits-Repository mit einem Commit (`a.txt`, 3 Zeilen), der an #1 hängt.
    fn stand() -> (tempfile::TempDir, Kanban, String) {
        let tmp = tempfile::tempdir().unwrap();
        let basis = tmp.path().canonicalize().unwrap();
        let (r, board): (PathBuf, PathBuf) = (basis.join("R"), basis.join("board"));
        std::fs::create_dir_all(r.join("Planung")).unwrap();
        std::fs::write(r.join("Planung/app.md"), "# App\n").unwrap();
        git(&r, &["init", "-q", "-b", "main"]);
        git(&r, &["add", "-A"]);
        git(&r, &["commit", "-qm", "c0"]);
        std::fs::write(r.join("a.txt"), "1\n2\n3\n").unwrap();
        git(&r, &["add", "-A"]);
        git(&r, &["commit", "-qm", "c1"]);
        let c1 = git(&r, &["rev-parse", "HEAD"]);
        std::fs::create_dir_all(board.join("aufgaben")).unwrap();
        std::fs::create_dir_all(board.join("boards")).unwrap();
        std::fs::write(board.join("kanbanD.md"), format!("---\npeople:\n  entw1: {{name: E, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Planung/app.md, requirements: \"\"}}\n---\n", r.display())).unwrap();
        std::fs::write(board.join("aufgaben/0001-a.md"), format!("---\nid: 1\ntitle: a\ncommits:\n  - kd:{c1}\n---\n")).unwrap();
        std::fs::write(board.join("boards/fabrik.md"), "# Fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-a.md)\n").unwrap();
        git(&board, &["init", "-q"]);
        git(&board, &["add", "-A"]);
        git(&board, &["commit", "-qm", "Fabrik"]);
        (tmp, Kanban::neu(board), c1)
    }

    fn anfrage(c1: &str, format: Diffformat) -> Diffanfrage {
        Diffanfrage { commit: Some(format!("kd:{c1}")), anwendung: None, datei: None, format, bekannt: None }
    }

    // R00206 AK 20 (f), ADR-0032 N5.1 Regel 2: der fertige Rumpf belegt das Budget noch im Platz der Lesegrenze — der
    // Haken direkt nach dem Belegen sieht genau einen belegten Platz (Mutant „Reservieren nach Verlassen des Platzes“)
    #[test]
    fn belegt_im_platz_der_lesegrenze() {
        let (_tmp, k, c1) = stand();
        for format in [Diffformat::Json, Diffformat::Patch] {
            let gesehen = Arc::new(Mutex::new(None));
            let g = gesehen.clone();
            *k.nach_dem_belegen.lock().unwrap() = Some(Box::new(move |belegt| *g.lock().unwrap() = Some(belegt)));
            let frei = k.antwortbudget.frei();
            let antwort = k.diff_lesen(1, &anfrage(&c1, format), Instant::now() + Duration::from_secs(10)).unwrap();
            assert_eq!(*gesehen.lock().unwrap(), Some(1), "{format:?}: belegt, während der Platz gehalten wird");
            let Diffantwort::Rumpf { rumpf, .. } = antwort else { panic!("kein Rumpf") };
            assert_eq!(k.antwortbudget.frei(), frei - rumpf.bytes.len().div_ceil(1024) * 1024, "{format:?}: Budget belegt");
            drop(rumpf);
            assert_eq!(k.antwortbudget.frei(), frei);
        }
    }

    // R00206 AK 20 (b), ADR-0032 N5.1 Regel 3: passt der Rumpf nicht mehr ins Budget, sofort 503 „Antwortbudget …“ —
    // ohne auf frei werdenden Platz zu warten
    #[test]
    fn volles_budget_ist_sofort_503() {
        let (_tmp, k, c1) = stand();
        let alles = k.antwortbudget.belegen(vec![0; k.antwortbudget.frei()]).unwrap();
        let start = Instant::now();
        let f = k.diff_lesen(1, &anfrage(&c1, Diffformat::Json), Instant::now() + Duration::from_secs(10)).unwrap_err();
        assert!(matches!(&f, Fehler::Ausgelastet(m) if m == "Antwortbudget von 64 MB belegt — Diff in einigen Sekunden erneut laden"), "{f:?}");
        assert!(start.elapsed() < Duration::from_secs(2), "ohne Warten: {:?}", start.elapsed());
        drop(alles);
        assert!(k.diff_lesen(1, &anfrage(&c1, Diffformat::Patch), Instant::now() + Duration::from_secs(10)).is_ok());
    }
}
