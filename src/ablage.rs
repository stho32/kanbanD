//! Der Ordner auf der Platte: Dateien lesen und schreiben, sonst nichts.

use crate::fehler::Fehler;
use crate::format::{self, aufgabe, board, einstellungen};
use crate::modell::{Aufgabe, Board, Einstellungen};
use serde::Serialize;
use std::io;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DefekteDatei {
    pub pfad: String,
    pub fehler: String,
}

#[derive(Debug, Clone)]
pub struct Ordner {
    wurzel: PathBuf,
}

impl Ordner {
    pub fn neu(wurzel: PathBuf) -> Ordner {
        Ordner { wurzel }
    }

    pub fn wurzel(&self) -> &Path {
        &self.wurzel
    }

    pub fn lies(&self, rel: &str) -> io::Result<Option<String>> {
        match std::fs::read_to_string(self.wurzel.join(rel)) {
            Ok(t) => Ok(Some(t)),
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Schreibt über eine Nachbardatei und Umbenennen, damit kein Leser eine halbe Datei sieht.
    pub fn schreib(&self, rel: &str, text: &str) -> io::Result<()> {
        let ziel = self.wurzel.join(rel);
        if let Some(eltern) = ziel.parent() {
            std::fs::create_dir_all(eltern)?;
        }
        let tmp = ziel.with_extension("kanbanD-tmp");
        std::fs::write(&tmp, text)?;
        std::fs::rename(&tmp, &ziel)
    }

    pub fn existiert(&self, rel: &str) -> bool {
        self.wurzel.join(rel).exists()
    }

    pub fn einstellungen(&self) -> Result<Option<Einstellungen>, Fehler> {
        match self.lies(einstellungen::DATEI)? {
            None => Ok(None),
            Some(t) => einstellungen::lesen(&t).map(Some).map_err(|e| Fehler::Defekt(format!("{}: {e}", einstellungen::DATEI))),
        }
    }

    /// Alle Board-Dateien, nach Dateiname sortiert; unlesbare kommen als defekt zurück.
    pub fn boards(&self) -> Result<(Vec<Board>, Vec<DefekteDatei>), Fehler> {
        let mut gut = vec![];
        let mut defekt = vec![];
        for (slug, rel) in self.markdown_dateien(board::ORDNER)? {
            let text = self.lies(&rel)?.unwrap_or_default();
            match board::lesen(&slug, &text) {
                Ok(b) => gut.push(b),
                Err(e) => defekt.push(DefekteDatei { pfad: rel, fehler: e.to_string() }),
            }
        }
        Ok((gut, defekt))
    }

    /// Alle Aufgaben, nach Dateiname sortiert. Unlesbare und doppelt nummerierte kommen als defekt zurück.
    pub fn aufgaben(&self) -> Result<(Vec<Aufgabe>, Vec<DefekteDatei>), Fehler> {
        let mut gut: Vec<Aufgabe> = vec![];
        let mut defekt = vec![];
        for (stamm, rel) in self.markdown_dateien(aufgabe::ORDNER)? {
            let text = self.lies(&rel)?.unwrap_or_default();
            match aufgabe::lesen(&format!("{stamm}.md"), &text) {
                Ok(a) => match gut.iter().find(|g| g.nummer == a.nummer) {
                    Some(erste) => defekt.push(DefekteDatei { pfad: rel, fehler: format!("Nummer #{} doppelt — auch in aufgaben/{}", a.nummer, erste.datei) }),
                    None => gut.push(a),
                },
                Err(e) => defekt.push(DefekteDatei { pfad: rel, fehler: e.to_string() }),
            }
        }
        Ok((gut, defekt))
    }

    pub fn board(&self, slug: &str) -> Result<Board, Fehler> {
        let rel = board_pfad(slug);
        let text = self.lies(&rel)?.ok_or_else(|| Fehler::NichtGefunden(format!("Board „{slug}“ gibt es nicht")))?;
        board::lesen(slug, &text).map_err(|e| Fehler::Defekt(format!("{rel}: {e}")))
    }

    /// (Dateistamm, relativer Pfad) aller `.md` in einem Unterordner, sortiert.
    pub fn markdown_dateien(&self, unterordner: &str) -> io::Result<Vec<(String, String)>> {
        let dir = self.wurzel.join(unterordner);
        let mut liste = vec![];
        match std::fs::read_dir(&dir) {
            Ok(eintraege) => {
                for e in eintraege {
                    let e = e?;
                    let name = e.file_name().to_string_lossy().to_string();
                    if let Some(stamm) = name.strip_suffix(".md")
                        && e.file_type()?.is_file()
                    {
                        liste.push((stamm.to_string(), format!("{unterordner}/{name}")));
                    }
                }
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }
        liste.sort();
        Ok(liste)
    }
}

pub fn board_pfad(slug: &str) -> String {
    format!("{}/{slug}.md", board::ORDNER)
}

impl From<format::Formatfehler> for Fehler {
    fn from(e: format::Formatfehler) -> Self {
        Fehler::Defekt(e.0)
    }
}
