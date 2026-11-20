//! Diff eines Commits lesen (R00206, ADR-0032 Punkt 6 mit N4) — Dateiliste, Zeilengrenze vor dem Patch-Lauf, ein
//! Patch-Lauf mit Bytegrenze, einzeln nachladen; live aus dem Arbeits-Repository, nur lesend, ohne die Sperre.

use crate::git::arbeitsrepo::{self, Arbeitsrepofehler, Diffart, Vergleich};
use crate::modell::{Diffdatei, GRENZE_DATEILISTE, GRENZE_EINZELN, GRENZE_PATCH_LAUF, Hinweis, Verteilung, dateiliste, diffdatei, patches_zuordnen, roh_lesen, zahlen_lesen};
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
pub fn inhalt_lesen(wurzel: &Path, vergleich: Vergleich, gesamt: u64, auswahl: Auswahl, frist: Instant) -> Result<Diffinhalt, Inhaltsfehler> {
    match auswahl {
        Auswahl::Liste => liste_lesen(wurzel, vergleich, gesamt, frist),
        Auswahl::Datei(name) => datei_lesen(wurzel, vergleich, name, frist),
    }
}

/// Die Liste: zwei Läufe der Dateiliste (je 1 MB), Kappe, Zeilengrenze, dann ein Patch-Lauf (4 MB) für die übrigen
/// Dateien — die großen erreichen ihn nie (ADR-0032 N4.3).
fn liste_lesen(wurzel: &Path, vergleich: Vergleich, gesamt: u64, frist: Instant) -> Result<Diffinhalt, Inhaltsfehler> {
    let roh = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Roh, &[], GRENZE_DATEILISTE, frist)?;
    let zahlen = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Zahlen, &[], GRENZE_DATEILISTE, frist)?;
    let mut dateien = dateiliste(&roh.ausgabe, roh.abgeschnitten, &zahlen.ausgabe, zahlen.abgeschnitten).ok_or_else(|| Inhaltsfehler::Form("Dateiliste von diff-tree unlesbar".into()))?;
    let mut hinweise = vec![];
    if (dateien.len() as u64) < gesamt {
        hinweise.push(Hinweis::DateienGekappt { gezeigt: dateien.len(), gesamt });
    }
    for d in dateien.iter_mut().filter(|d| d.zu_viele_zeilen()) {
        d.gross = true;
    }
    let im_lauf: Vec<usize> = (0..dateien.len()).filter(|i| !dateien[*i].gross).collect();
    if !im_lauf.is_empty() {
        // alle gezeigten Dateien im Lauf: ohne Pfadangabe — sonst wörtlich die Pfade der Dateien im Lauf
        let alle = im_lauf.len() as u64 == gesamt;
        let pfade: Vec<&[u8]> = if alle { vec![] } else { im_lauf.iter().flat_map(|i| dateien[*i].pfade_roh.iter().map(Vec::as_slice)).collect() };
        let patch = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Patch, &pfade, GRENZE_PATCH_LAUF, frist)?;
        patches_zuordnen(&mut dateien, &im_lauf, &patch.ausgabe, patch.abgeschnitten, Verteilung::Liste).map_err(Inhaltsfehler::Form)?;
    }
    Ok(Diffinhalt { dateien, hinweise })
}

/// Eine Datei: die Dateiliste ungekappt bis 20 MB (nur `--raw -z`), der Name gegen `neu` (bei gelöschten `alt`) —
/// nur Pfade aus dieser Liste erreichen Git, wörtlich; dann Zähler und Patch bis 20 MB für genau diese Pfade.
fn datei_lesen(wurzel: &Path, vergleich: Vergleich, name: &str, frist: Instant) -> Result<Diffinhalt, Inhaltsfehler> {
    let roh = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Roh, &[], GRENZE_EINZELN, frist)?;
    let liste = roh_lesen(&roh.ausgabe).ok_or_else(|| Inhaltsfehler::Form("Dateiliste von diff-tree unlesbar".into()))?;
    let treffer: Vec<_> = liste.into_iter().map(|r| diffdatei(r, None)).filter(|d| d.name() == name).collect();
    if treffer.is_empty() {
        return Err(Inhaltsfehler::DateiFehlt { liste_abgeschnitten: roh.abgeschnitten });
    }
    let pfade: Vec<Vec<u8>> = treffer.iter().flat_map(|d| d.pfade_roh.clone()).collect();
    let pfade: Vec<&[u8]> = pfade.iter().map(Vec::as_slice).collect();
    let zahlen = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Zahlen, &pfade, GRENZE_DATEILISTE, frist)?;
    let zahlen = zahlen_lesen(&zahlen.ausgabe).filter(|z| z.len() == treffer.len()).ok_or_else(|| Inhaltsfehler::Form("Zähler passen nicht zur Datei".into()))?;
    let mut dateien: Vec<Diffdatei> = treffer.into_iter().zip(zahlen).map(|(d, z)| Diffdatei { plus: z.map_or(0, |z| z.0), minus: z.map_or(0, |z| z.1), binaer: z.is_none(), ..d }).collect();
    let patch = arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Patch, &pfade, GRENZE_EINZELN, frist)?;
    let alle: Vec<usize> = (0..dateien.len()).collect();
    patches_zuordnen(&mut dateien, &alle, &patch.ausgabe, patch.abgeschnitten, Verteilung::Einzeln).map_err(Inhaltsfehler::Form)?;
    let hinweise = dateien.iter().filter(|d| d.gross).map(|d| Hinweis::ZuGrossZumAnzeigen { datei: d.name().to_string() }).collect();
    Ok(Diffinhalt { dateien, hinweise })
}

// ---- Dienst: Zulassung, ETag, Gesamtgrenze ---------------------------------------------------------------------------

use super::Kanban;
use super::commits_lesen::GESAMTGRENZE;
use crate::fehler::Fehler;
use crate::git::arbeitsrepo::Objekt;
use crate::modell::{Anwendungen, Commitzustand, GRENZEN_VERSION, HASH_MAX, Verweisform, patch_text, titel_kuerzen, verweis_lesen};
use serde::Serialize;

/// Längster Pfad, den `datei=` nennen darf (Byte, wie `PATH_MAX`).
pub const DATEI_HOECHSTENS: usize = 4096;

/// Wie die Antwort aussieht: JSON (Form F2) oder Text (`format=patch`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Diffformat {
    Json,
    Patch,
}

/// Die Anfrage `GET …/diff` nach dem Lesen der Abfrage; `bekannt` ist der Wert von `If-None-Match`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Diffanfrage {
    pub commit: String,
    pub datei: Option<String>,
    pub format: Diffformat,
    pub bekannt: Option<String>,
}

impl Diffanfrage {
    /// Die Abfrage `commit`, `datei`, `format` — ohne Git: `commit` fehlt, `format` unbekannt, `datei` leer, mit NUL oder
    /// länger als [`DATEI_HOECHSTENS`] → 400.
    pub fn aus_paaren(paare: &[(String, String)], bekannt: Option<String>) -> Result<Diffanfrage, Fehler> {
        let wert = |name: &str| paare.iter().find(|(k, _)| k == name).map(|(_, w)| w.clone());
        let commit = wert("commit").ok_or_else(|| Fehler::Ungueltig("commit fehlt — GET …/diff?commit=<verweis> nennt einen Commit-Verweis der Karte".into()))?;
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
        Ok(Diffanfrage { commit, datei, format, bekannt })
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

/// Was der Dienst liefert: 304 ohne Rumpf oder den Diff, je mit `ETag`, wenn der Verweis einen vollen Hash trägt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Diffantwort {
    Unveraendert(String),
    Json { etag: Option<String>, diff: Diff },
    Text { etag: Option<String>, text: String },
}

impl Kanban {
    /// `GET /api/aufgaben/{nr}/diff` — liest die Aufgabe ohne Sperre und schreibt nie. Alles, was ohne Git geht (Form,
    /// Verweis an der Karte, Register, `ETag`), kommt vor dem ersten Git-Aufruf; Git läuft nur bis `frist` (Eintritt in
    /// den Handler + [`GESAMTGRENZE`]), danach 503 — nie eine Teilantwort.
    pub fn diff_lesen(&self, nr: u32, anfrage: &Diffanfrage, frist: Instant) -> Result<Diffantwort, Fehler> {
        let aufgabe = self.ordner().aufgabe(nr)?;
        let form = Verweisform::lesen(&anfrage.commit).map_err(|f| Fehler::Verweis { meldung: f.meldung, verweis: f.verweis, fehlt: false })?;
        let treffer: Vec<&String> = aufgabe.commits.iter().filter(|c| super::commits::passt(c, &form)).collect();
        let gespeichert = match treffer.as_slice() {
            [v] => v.as_str(),
            [] => return Err(Fehler::Verweis { meldung: format!("#{nr} hat keinen Commit-Verweis „{}“", crate::nachricht::wert(&anfrage.commit)), verweis: anfrage.commit.clone(), fehlt: true }),
            mehrere => return Err(Fehler::Verweis { meldung: format!("„{}“ passt zu {} Commit-Verweisen an #{nr} — längeren Hash nennen", crate::nachricht::wert(&anfrage.commit), mehrere.len()), verweis: anfrage.commit.clone(), fehlt: false }),
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
        let inhalt = inhalt_lesen(&wurzel, vergleich, m.dateien, auswahl, frist).map_err(|f| inhaltsfehler(f, nr))?;
        let commit = Diffcommit { verweis: gespeichert.to_string(), anwendung: anwendung.kuerzel.clone(), hash: voll.clone(), titel: titel_kuerzen(&m.titel), autor: m.autor, datum: m.datum, plus: m.plus, minus: m.minus, dateien: m.dateien };
        Ok(match anfrage.format {
            Diffformat::Json => Diffantwort::Json { etag, diff: Diff { anwendung: anwendung.kuerzel.clone(), commits: vec![commit], dateien: inhalt.dateien, hinweise: inhalt.hinweise } },
            Diffformat::Patch => Diffantwort::Text { etag, text: patch_text(&inhalt.dateien) },
        })
    }
}

/// 404 mit dem Zustand des Verweises, wie die Liste ihn nennt (ADR-0032 N4.2).
fn zustand(zustand: Commitzustand, grund: Option<String>) -> Fehler {
    Fehler::Commitzustand { meldung: "kein Diff zu diesem Verweis — der Zustand sagt warum".into(), zustand, grund }
}

/// Repository fehlt oder verweigert → 404 `repository_fehlt` mit Grund; Zeitgrenze → 503; sonst 500.
fn repo_fehler(f: Arbeitsrepofehler) -> Fehler {
    match f {
        Arbeitsrepofehler::RepositoryFehlt(grund) => zustand(Commitzustand::RepositoryFehlt, Some(grund)),
        anders => abbruch(anders),
    }
}

/// Zeitgrenze → 503 ohne Teilantwort; alles andere ist ein Fehler des Programms.
fn abbruch(f: Arbeitsrepofehler) -> Fehler {
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
        Inhaltsfehler::DateiFehlt { liste_abgeschnitten: true } => Fehler::NichtGefunden(format!("Dateiliste zu groß: die Datei steht nicht in den ersten {} MB der Dateiliste des Commits an #{nr}", crate::modell::GRENZE_EINZELN >> 20)),
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
