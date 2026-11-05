//! Treiber: der einzige Ort, der Protokoll und Ablage kennt — legt den Ordner an, startet das echte Programm, spricht HTTP.
use crate::gemeinsam::{self, Laufendes, git, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

/// Der Arbeitsordner liegt als `w/` in einem Elternordner, damit Nachbardateien außerhalb des Repositorys möglich sind.
pub struct Treiber {
    _eltern: tempfile::TempDir,
    w: PathBuf,
    lauf: Laufendes,
}

pub struct Antwort {
    pub status: u16,
    pub rumpf: Value,
}

impl Treiber {
    /// Legt `kanbanD.md`, ein Board und die Aufgabendateien an, committet und startet das Programm auf freiem Port.
    pub fn starten(einstellungen: &str, board: &str, aufgaben: &[(String, String)]) -> Treiber {
        let mut dateien = vec![("boards/fabrik.md".to_string(), board.to_string())];
        dateien.extend(aufgaben.iter().map(|(datei, text)| (format!("aufgaben/{datei}"), text.clone())));
        Treiber::starten_mit(einstellungen, &dateien, &[])
    }

    /// Wie `starten`, mit beliebigen Dateien im Arbeitsordner (`dateien`, committet) und daneben (`nachbarn`, relativ zum Elternordner).
    pub fn starten_mit(einstellungen: &str, dateien: &[(String, String)], nachbarn: &[(String, String)]) -> Treiber {
        let eltern = tempfile::tempdir().unwrap();
        let w = eltern.path().join("w");
        std::fs::create_dir_all(w.join("boards")).unwrap();
        std::fs::create_dir_all(w.join("aufgaben")).unwrap();
        std::fs::write(w.join("kanbanD.md"), einstellungen).unwrap();
        for (rel, text) in dateien {
            std::fs::write(w.join(rel), text).unwrap();
        }
        for (rel, text) in nachbarn {
            let ziel = eltern.path().join(rel);
            std::fs::create_dir_all(ziel.parent().unwrap()).unwrap();
            std::fs::write(ziel, text).unwrap();
        }
        git(&w, &["init", "-q"]);
        git(&w, &["add", "-A"]);
        git(&w, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
        let lauf = gemeinsam::starten(&w, &["--port", "0"]);
        Treiber { _eltern: eltern, w, lauf }
    }

    fn pfad(&self) -> &Path {
        &self.w
    }

    pub async fn reservieren(&self, nr: u32, wer: &str) {
        let r = reqwest::Client::new().post(format!("{}api/aufgaben/{nr}/reservierung", self.lauf.adresse)).header("X-KanbanD-Wer", wer).header("X-KanbanD-Instanz", "akzeptanz").send().await.unwrap();
        assert_eq!(r.status().as_u16(), 200, "Reservierung von #{nr}");
    }

    pub async fn erledigen(&self, wer: &str, key: &str, text: &str, signal: &str) -> Antwort {
        self.erledigen_auf(wer, key, "fabrik", text, signal).await
    }

    pub async fn erledigen_auf(&self, wer: &str, key: &str, board: &str, text: &str, signal: &str) -> Antwort {
        let (status, rumpf) = senden(Method::POST, &self.lauf.adresse, "api/aufgaben/erledigen", wer, json!({"key": key, "board": board, "text": text, "signal": signal})).await;
        Antwort { status, rumpf }
    }

    pub async fn anlegen(&self, wer: &str, titel: &str, board: &str) -> Antwort {
        let (status, rumpf) = senden(Method::POST, &self.lauf.adresse, "api/aufgaben", wer, json!({"titel": titel, "board": board})).await;
        Antwort { status, rumpf }
    }

    /// GET mit dem Pfad genau so, wie er dasteht (`%2E%2E` bleibt kodiert) — reqwest würde Punkt-Segmente auflösen.
    pub fn roh_lesen(&self, pfad_und_query: &str) -> (u16, String) {
        let adresse = self.lauf.adresse.trim_start_matches("http://").trim_end_matches('/');
        let mut s = std::net::TcpStream::connect(adresse).unwrap();
        write!(s, "GET /{pfad_und_query} HTTP/1.1\r\nHost: {adresse}\r\nConnection: close\r\n\r\n").unwrap();
        let mut antwort = String::new();
        s.read_to_string(&mut antwort).unwrap();
        let status = antwort.split_whitespace().nth(1).and_then(|c| c.parse().ok()).unwrap_or(0);
        let rumpf = antwort.split_once("\r\n\r\n").map(|(_, r)| r.to_string()).unwrap_or_default();
        (status, rumpf)
    }

    pub async fn lesen(&self, pfad: &str) -> Value {
        reqwest::get(format!("{}{pfad}", self.lauf.adresse)).await.unwrap().json().await.unwrap()
    }

    /// Die Nummern der Spalte, oben zuerst, wie das Board sie ausliefert.
    pub async fn spalte(&self, name: &str) -> Vec<u32> {
        let b: Value = reqwest::get(format!("{}api/boards/fabrik", self.lauf.adresse)).await.unwrap().json().await.unwrap();
        let s = b["spalten"].as_array().unwrap().iter().find(|s| s["name"] == name).unwrap_or_else(|| panic!("Spalte {name}: {b}"));
        s["aufgaben"].as_array().unwrap().iter().map(|n| n.as_u64().unwrap() as u32).collect()
    }

    pub async fn aufgabe(&self, nr: u32) -> Value {
        reqwest::get(format!("{}api/aufgaben/{nr}", self.lauf.adresse)).await.unwrap().json().await.unwrap()
    }

    pub fn arbeitsbaum(&self) -> String {
        git(self.pfad(), &["status", "--porcelain"])
    }

    /// Bytes einer Datei im Arbeitsordner (`w/<rel>`); fehlt sie, `None`.
    pub fn datei(&self, rel: &str) -> Option<Vec<u8>> {
        std::fs::read(self.w.join(rel)).ok()
    }

    /// Bytes einer Datei neben dem Arbeitsordner (relativ zum Elternordner).
    pub fn nachbar(&self, rel: &str) -> Option<Vec<u8>> {
        std::fs::read(self._eltern.path().join(rel)).ok()
    }

    /// Dateinamen in `w/<ordner>`, sortiert.
    pub fn dateien(&self, ordner: &str) -> Vec<String> {
        let mut namen: Vec<String> = std::fs::read_dir(self.w.join(ordner)).map(|d| d.map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect()).unwrap_or_default();
        namen.sort();
        namen
    }

    pub fn commits(&self) -> usize {
        git(self.pfad(), &["rev-list", "--count", "HEAD"]).parse().unwrap()
    }
}
