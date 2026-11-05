//! Treiber: der einzige Ort, der Protokoll und Ablage kennt — legt den Ordner an, startet das echte Programm, spricht HTTP.
use crate::gemeinsam::{self, Laufendes, git, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

pub struct Treiber {
    _ordner: tempfile::TempDir,
    lauf: Laufendes,
}

pub struct Antwort {
    pub status: u16,
    pub rumpf: Value,
}

impl Treiber {
    /// Legt `kanbanD.md`, ein Board und die Aufgabendateien an, committet und startet das Programm auf freiem Port.
    pub fn starten(einstellungen: &str, board: &str, aufgaben: &[(String, String)]) -> Treiber {
        let ordner = tempfile::tempdir().unwrap();
        let p = ordner.path();
        std::fs::create_dir_all(p.join("boards")).unwrap();
        std::fs::create_dir_all(p.join("aufgaben")).unwrap();
        std::fs::write(p.join("kanbanD.md"), einstellungen).unwrap();
        std::fs::write(p.join("boards/fabrik.md"), board).unwrap();
        for (datei, text) in aufgaben {
            std::fs::write(p.join("aufgaben").join(datei), text).unwrap();
        }
        git(p, &["init", "-q"]);
        git(p, &["add", "-A"]);
        git(p, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
        let lauf = gemeinsam::starten(p, &["--port", "0"]);
        Treiber { _ordner: ordner, lauf }
    }

    fn pfad(&self) -> &Path {
        self._ordner.path()
    }

    pub async fn reservieren(&self, nr: u32, wer: &str) {
        let r = reqwest::Client::new().post(format!("{}api/aufgaben/{nr}/reservierung", self.lauf.adresse)).header("X-KanbanD-Wer", wer).header("X-KanbanD-Instanz", "akzeptanz").send().await.unwrap();
        assert_eq!(r.status().as_u16(), 200, "Reservierung von #{nr}");
    }

    pub async fn erledigen(&self, wer: &str, key: &str, text: &str, signal: &str) -> Antwort {
        let (status, rumpf) = senden(Method::POST, &self.lauf.adresse, "api/aufgaben/erledigen", wer, json!({"key": key, "board": "fabrik", "text": text, "signal": signal})).await;
        Antwort { status, rumpf }
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

    pub fn commits(&self) -> usize {
        git(self.pfad(), &["rev-list", "--count", "HEAD"]).parse().unwrap()
    }
}
