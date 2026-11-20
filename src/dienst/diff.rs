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
