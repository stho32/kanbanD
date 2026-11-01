/// Was ein Anwendungsfall melden kann; jede Art hat ihren HTTP-Status.
#[derive(Debug, PartialEq, Eq)]
pub enum Fehler {
    /// Die Eingabe ist unvollständig oder falsch (400).
    Ungueltig(String),
    /// Das Ziel gibt es nicht (404).
    NichtGefunden(String),
    /// Der Zustand erlaubt die Aktion nicht (409).
    Konflikt(String),
    /// Die Datei ist defekt und nur lesbar (423).
    Defekt(String),
    /// Dateisystem oder Git versagen (500).
    Intern(String),
    /// Ein Zug brächte die Spalte über ihre Grenze (409, ADR-0003); `anzahl` ist die Belegung vor dem Zug.
    GrenzeErreicht { spalte: String, grenze: u32, anzahl: u32 },
    /// Ein Agent nähme eine Karte aus einer Spalte, die dem Menschen gehört (403, R00097, ADR-0003).
    Verboten { meldung: String, spalte: String, nummer: u32 },
}

impl Fehler {
    pub fn meldung(&self) -> &str {
        match self {
            Fehler::Ungueltig(m) | Fehler::NichtGefunden(m) | Fehler::Konflikt(m) | Fehler::Defekt(m) | Fehler::Intern(m) => m,
            Fehler::GrenzeErreicht { .. } => "Grenze erreicht",
            Fehler::Verboten { meldung, .. } => meldung,
        }
    }
}

impl From<std::io::Error> for Fehler {
    fn from(e: std::io::Error) -> Self {
        Fehler::Intern(format!("Dateizugriff: {e}"))
    }
}

impl std::fmt::Display for Fehler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.meldung())
    }
}
