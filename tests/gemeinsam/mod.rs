//! Startet das echte Programm gegen einen Ordner und liefert seine Adresse.
#![allow(dead_code)]

use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Child, Command, Stdio};

pub struct Laufendes {
    pub kind: Child,
    pub adresse: String,
}

impl Drop for Laufendes {
    fn drop(&mut self) {
        geordnet_beenden(&mut self.kind);
    }
}

/// SIGTERM, damit das Programm geordnet endet (und seine Coverage schreibt); notfalls hart.
pub fn geordnet_beenden(kind: &mut Child) {
    let _ = Command::new("kill").args(["-TERM", &kind.id().to_string()]).status();
    for _ in 0..100 {
        if let Ok(Some(_)) = kind.try_wait() {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(20));
    }
    let _ = kind.kill();
    let _ = kind.wait();
}

pub fn starten(ordner: &Path, zusatz: &[&str]) -> Laufendes {
    let mut kind = Command::new(env!("CARGO_BIN_EXE_kanbanD"))
        .arg(ordner)
        .args(["--kein-browser", "--host", "127.0.0.1"])
        .args(zusatz)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("kanbanD startet");
    let mut zeile = String::new();
    BufReader::new(kind.stdout.take().unwrap()).read_line(&mut zeile).unwrap();
    let adresse = zeile.split_whitespace().last().expect("Adresse in der Startzeile").to_string();
    Laufendes { kind, adresse }
}

pub fn git(pfad: &Path, args: &[&str]) -> String {
    let a = Command::new("git").arg("-C").arg(pfad).args(args).output().unwrap();
    String::from_utf8_lossy(&a.stdout).trim().to_string()
}

pub const EINSTELLUNGEN: &str = "---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\n  ab: {name: Anna, kind: human, active: false}\nclasses:\n  bug: {label: Fehler, color: red}\nsources:\n  wbs: plan/wbs.md\n  requirements: anf/\n---\n";

/// Ein eingerichteter Ordner: Stefan (Mensch), Claude (Agent), Anna (stillgelegt), Board „Entwicklung“.
pub fn eingerichtet(pfad: &Path) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), EINSTELLUNGEN).unwrap();
    std::fs::write(pfad.join("boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n").unwrap();
    git(pfad, &["init", "-q"]);
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
}

pub fn eingerichtet_starten(pfad: &Path) -> Laufendes {
    eingerichtet(pfad);
    starten(pfad, &["--port", "0"])
}

/// Schreibender Aufruf als Person.
pub async fn senden(methode: reqwest::Method, adresse: &str, pfad: &str, wer: &str, daten: serde_json::Value) -> (u16, serde_json::Value) {
    let r = reqwest::Client::new().request(methode, format!("{adresse}{pfad}")).header("X-KanbanD-Wer", wer).json(&daten).send().await.unwrap();
    let status = r.status().as_u16();
    let text = r.text().await.unwrap();
    (status, serde_json::from_str(&text).unwrap_or(serde_json::Value::Null))
}

pub fn lies(pfad: &Path, rel: &str) -> String {
    std::fs::read_to_string(pfad.join(rel)).unwrap_or_default()
}

/// Wie `eingerichtet`, dazu Aufgaben 1, 2, 3 in „Zu erledigen“.
pub fn mit_drei_aufgaben(pfad: &Path) {
    eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    for (n, t) in [(1, "eins"), (2, "zwei"), (3, "drei")] {
        std::fs::write(pfad.join(format!("aufgaben/000{n}-{t}.md")), format!("---\nid: {n}\ntitle: {t}\n---\n")).unwrap();
    }
    std::fs::write(pfad.join("boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## In Arbeit\n\n## Erledigt\n").unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "drei Aufgaben"]);
}
