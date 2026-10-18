//! Lesen und Schreiben der Markdown-Dateien. Rein: Text hinein, Daten heraus und umgekehrt.


pub mod board;
pub mod einstellungen;
pub mod frontmatter;
pub mod yaml;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Formatfehler(pub String);

impl std::fmt::Display for Formatfehler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}
