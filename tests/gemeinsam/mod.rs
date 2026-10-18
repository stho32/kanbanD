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
        let _ = self.kind.kill();
        let _ = self.kind.wait();
    }
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
