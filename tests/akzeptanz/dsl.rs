//! DSL der Wartungsfabrik: Board „fabrik“, Eingang gehört dem Menschen, Sensor ist der Agent `bot`, Mensch `st`.
//! Kennt Karten, Spalten und Begründungen — kein HTTP, keine Dateien.
use super::treiber::{Antwort, Treiber};

pub const EINGANG: &str = "Eingang";
pub const IN_ARBEIT: &str = "In Arbeit";
pub const FERTIG: &str = "Fertig";
pub const SENSOR: &str = "bot";
pub const MENSCH: &str = "st";
const SPALTEN: [&str; 3] = [EINGANG, IN_ARBEIT, FERTIG];
const SIGNAL: &str = "behoben";

#[derive(Default)]
pub struct Fabrik {
    karten: Vec<(u32, String, &'static str)>,
    reserviert: Vec<u32>,
    grenze_fertig: Option<u32>,
}

impl Fabrik {
    pub fn karte(mut self, nr: u32, schluessel: &str, spalte: &'static str) -> Self {
        self.karten.push((nr, schluessel.into(), spalte));
        self
    }

    pub fn reserviert(mut self, nr: u32) -> Self {
        self.reserviert.push(nr);
        self
    }

    pub fn fertig_hat_grenze(mut self, grenze: u32) -> Self {
        self.grenze_fertig = Some(grenze);
        self
    }

    pub async fn oeffnen(self) -> Lage {
        let einstellungen = format!("---\npeople:\n  {MENSCH}: {{name: Stefan, kind: human}}\n  {SENSOR}: {{name: Sensor, kind: agent}}\nsignals:\n  {SIGNAL}: {{label: Befund nicht mehr gefunden, color: green}}\n---\n");
        let grenze = self.grenze_fertig.map(|g| format!("limits:\n  {FERTIG}: {g}\n")).unwrap_or_default();
        let mut board = format!("---\ncolumn-owner:\n  {EINGANG}: human\n{grenze}---\n\n# fabrik\n");
        for s in SPALTEN {
            board.push_str(&format!("\n## {s}\n\n"));
            for (nr, _, _) in self.karten.iter().filter(|k| k.2 == s) {
                board.push_str(&format!("- [#{nr}](../aufgaben/{nr:04}-befund.md)\n"));
            }
        }
        let aufgaben: Vec<(String, String)> = self.karten.iter().map(|(nr, key, _)| (format!("{nr:04}-befund.md"), format!("---\nid: {nr}\ntitle: Befund {nr}\nkey: \"{key}\"\n---\n"))).collect();
        let treiber = Treiber::starten(&einstellungen, &board, &aufgaben);
        for nr in &self.reserviert {
            treiber.reservieren(*nr, SENSOR).await;
        }
        let vorher = treiber.commits();
        Lage { treiber, vorher }
    }
}

pub struct Lage {
    treiber: Treiber,
    vorher: usize,
}

pub struct Ausgang {
    pub status: u16,
    pub ergebnis: String,
    pub fehler: String,
    pub warnungen: Vec<String>,
}

impl From<Antwort> for Ausgang {
    fn from(a: Antwort) -> Self {
        let text = |v: &serde_json::Value| v.as_str().unwrap_or_default().to_string();
        let warnungen = a.rumpf["warnungen"].as_array().map(|w| w.iter().map(|w| text(&w["text"])).collect()).unwrap_or_default();
        Ausgang { status: a.status, ergebnis: text(&a.rumpf["ergebnis"]), fehler: text(&a.rumpf["fehler"]), warnungen }
    }
}

impl Lage {
    pub async fn erledigt(&self, wer: &str, schluessel: &str, begruendung: &str) -> Ausgang {
        self.treiber.erledigen(wer, schluessel, begruendung, SIGNAL).await.into()
    }

    pub async fn erledigt_mit_signal(&self, wer: &str, schluessel: &str, begruendung: &str, signal: &str) -> Ausgang {
        self.treiber.erledigen(wer, schluessel, begruendung, signal).await.into()
    }

    pub async fn spalte(&self, spalte: &str) -> Vec<u32> {
        self.treiber.spalte(spalte).await
    }

    /// Die Kommentare der Karte als „wer · Text“.
    pub async fn kommentare(&self, nr: u32) -> Vec<String> {
        let a = self.treiber.aufgabe(nr).await;
        a["kommentare"].as_array().unwrap().iter().map(|k| format!("{} · {}", k["wer"].as_str().unwrap(), k["text"].as_str().unwrap())).collect()
    }

    pub async fn traegt_signal(&self, nr: u32) -> bool {
        self.treiber.aufgabe(nr).await["signale"].as_array().unwrap().iter().any(|s| s == SIGNAL)
    }

    pub async fn ist_reserviert(&self, nr: u32) -> bool {
        !self.treiber.aufgabe(nr).await["reservierung"].is_null()
    }

    /// Commits seit dem Öffnen der Lage.
    pub fn neue_commits(&self) -> usize {
        self.treiber.commits() - self.vorher
    }
}
