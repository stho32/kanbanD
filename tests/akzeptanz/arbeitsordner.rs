//! DSL des Arbeitsordners mit Nachbar (R00104): Board „fabrik“ mit „In Arbeit“ und „Fertig“, Aufgabe #12 `aufgaben/0012-x.md`,
//! fremde Datei `fremd/boards/b.md` neben dem Ordner. Kennt Board-Namen, Karten und „nichts geändert“ — kein HTTP, keine Pfade.
use super::treiber::Treiber;

pub const IN_ARBEIT: &str = "In Arbeit";
pub const FERTIG: &str = "Fertig";
pub const AGENT: &str = "bot";
pub const MENSCH: &str = "st";
/// Zweite Aufgabe (`mit_zweiter_aufgabe`), auf keinem Board.
pub const ZWEITE: u32 = 14;
/// Steht nur in der fremden Datei; taucht er in einer Antwort auf, hat kanbanD sie gelesen.
pub const FREMDES_MERKMAL: &str = "FREMD-GEHEIM";
const FREMD: &str = "fremd/boards/b.md";
const AUFGABE_12: &str = "aufgaben/0012-x.md";
const SIGNAL: &str = "behoben";
/// Die Beschreibung sieht aus wie ein Board mit #12 — so wird `../aufgaben/0012-x` als Board lesbar (Reproduktion #48).
const AUFGABE_12_TEXT: &str = "---\nid: 12\ntitle: x\nkey: k12\n---\n\n## In Arbeit\n\n- [#12](0012-x.md)\n\n## Fertig\n";

/// Die Fehlfälle F der Anforderung — keiner hat die Form, die kanbanD selbst erzeugt.
pub fn fehlfaelle() -> Vec<String> {
    let mut f: Vec<String> = ["../../fremd/boards/b", "../aufgaben/0012-x", "..", ".", "a/b", "./fabrik", "fabrik\0"].map(String::from).to_vec();
    f.push("a".repeat(41));
    f.push("Fabrik".into());
    f
}

/// Dieselben Fehlfälle, wie sie in einer URL stehen.
pub fn fehlfaelle_kodiert() -> Vec<String> {
    let mut f: Vec<String> = ["..%2F..%2Ffremd%2Fboards%2Fb", "..%2Faufgaben%2F0012-x", "%2E%2E", "%2E", "a%2Fb", ".%2Ffabrik", "fabrik%00"].map(String::from).to_vec();
    f.push("a".repeat(41));
    f.push("Fabrik".into());
    f
}

/// Gültige Form, aber kein solches Board.
pub fn vierzig_a() -> String {
    "a".repeat(40)
}

#[derive(Default)]
pub struct Arbeitsordner {
    handbenannt: Option<&'static str>,
    zweite: bool,
}

impl Arbeitsordner {
    /// Dazu eine von Hand angelegte Board-Datei mit gültigem Inhalt unter `boards/<name>.md`.
    pub fn mit_handbenanntem_board(mut self, name: &'static str) -> Self {
        self.handbenannt = Some(name);
        self
    }

    /// Dazu Aufgabe #14 `aufgaben/0014-y.md`, auf keinem Board.
    pub fn mit_zweiter_aufgabe(mut self) -> Self {
        self.zweite = true;
        self
    }

    pub async fn oeffnen(self) -> Ordnerlage {
        let einstellungen = format!("---\npeople:\n  {AGENT}: {{name: Sensor, kind: agent}}\n  {MENSCH}: {{name: Stefan, kind: human}}\nsignals:\n  {SIGNAL}: {{label: Befund nicht mehr gefunden, color: green}}\n---\n");
        let board = format!("# fabrik\n\n## {IN_ARBEIT}\n\n- [#12](../aufgaben/0012-x.md)\n\n## {FERTIG}\n");
        let mut dateien = vec![("boards/fabrik.md".to_string(), board), (AUFGABE_12.to_string(), AUFGABE_12_TEXT.to_string())];
        if self.zweite {
            dateien.push((format!("aufgaben/00{ZWEITE}-y.md"), format!("---\nid: {ZWEITE}\ntitle: y\nkey: k{ZWEITE}\n---\n")));
        }
        if let Some(name) = self.handbenannt {
            dateien.push((format!("boards/{name}.md"), "# Alt\n\n## Offen\n".to_string()));
        }
        // Beide Ziele führen #12 in „In Arbeit“, damit ein Durchrutschen bis zum Schreiben kommt statt an „liegt nicht auf“ zu enden.
        let fremd = format!("# {FREMDES_MERKMAL}\n\n## {IN_ARBEIT}\n\n- [#12](x.md)\n\n## {FERTIG}\n");
        let treiber = Treiber::starten_mit(&einstellungen, &dateien, &[(FREMD.to_string(), fremd)]);
        let start = Stand::von(&treiber);
        Ordnerlage { treiber, start }
    }
}

/// Was „nichts geändert“ vergleicht: Commits, Arbeitsbaum, fremde Datei, Aufgabe #12, Aufgabendateien.
#[derive(PartialEq)]
pub struct Stand {
    commits: usize,
    arbeitsbaum: String,
    fremd: Option<Vec<u8>>,
    aufgabe_12: Option<Vec<u8>>,
    aufgaben: Vec<String>,
}

impl Stand {
    fn von(t: &Treiber) -> Stand {
        Stand { commits: t.commits(), arbeitsbaum: t.arbeitsbaum(), fremd: t.nachbar(FREMD), aufgabe_12: t.datei(AUFGABE_12), aufgaben: t.dateien("aufgaben") }
    }
}

/// Die Wege, die eine Liste von Karten aus dem Rumpf nehmen.
#[derive(Clone, Copy, Debug)]
pub enum Sammelweg {
    Legen,
    Bewegen,
    Aendern,
    Archivieren,
    Zurueckholen,
}

pub struct Ausgang {
    pub status: u16,
    pub fehler: String,
    pub ergebnis: String,
    /// Bei Lesefällen der Rumpf, sonst leer.
    pub rumpf: String,
}

pub struct Ordnerlage {
    treiber: Treiber,
    start: Stand,
}

impl Ordnerlage {
    pub fn stand(&self) -> Stand {
        Stand::von(&self.treiber)
    }

    /// Was sich gegenüber `vorher` geändert hat, in Worten; leer heißt „nichts geändert“.
    pub fn aenderungen(&self, vorher: &Stand) -> Vec<String> {
        let jetzt = self.stand();
        let mut a = vec![];
        if jetzt.commits != vorher.commits {
            a.push(format!("{} neue Commits", jetzt.commits as i64 - vorher.commits as i64));
        }
        if !jetzt.arbeitsbaum.is_empty() {
            a.push(format!("Arbeitsbaum nicht sauber: {}", jetzt.arbeitsbaum.replace('\n', ", ")));
        }
        if jetzt.fremd != vorher.fremd {
            a.push("fremde Datei umgeschrieben".into());
        }
        if jetzt.aufgabe_12 != vorher.aufgabe_12 {
            a.push(format!("Aufgabe #12 verändert: {:?}", String::from_utf8_lossy(&jetzt.aufgabe_12.clone().unwrap_or_default())));
        }
        if jetzt.aufgaben != vorher.aufgaben {
            a.push(format!("Aufgabendateien: {:?}", jetzt.aufgaben));
        }
        a
    }

    /// Änderungen seit dem Öffnen der Lage.
    pub fn aenderungen_seit_start(&self) -> Vec<String> {
        self.aenderungen(&self.start)
    }

    pub fn neue_commits(&self) -> usize {
        self.treiber.commits() - self.start.commits
    }

    pub async fn erledigt(&self, board: &str) -> Ausgang {
        let a = self.treiber.erledigen_auf(AGENT, "k12", board, "behoben", SIGNAL).await;
        Ausgang { status: a.status, fehler: text(&a.rumpf["fehler"]), ergebnis: text(&a.rumpf["ergebnis"]), rumpf: String::new() }
    }

    pub async fn legt_an(&self, titel: &str, board: &str) -> Ausgang {
        let a = self.treiber.anlegen(AGENT, titel, board).await;
        Ausgang { status: a.status, fehler: text(&a.rumpf["fehler"]), ergebnis: String::new(), rumpf: a.rumpf.to_string() }
    }

    /// Das Board über seinen Namen abrufen; `kodiert` steht so in der URL.
    pub fn board_abrufen(&self, kodiert: &str) -> Ausgang {
        lesefall(self.treiber.roh_lesen(&format!("api/boards/{kodiert}")))
    }

    /// Die Aufgaben nach Board filtern; `kodiert` steht so in der URL.
    pub fn aufgaben_filtern(&self, kodiert: &str) -> Ausgang {
        lesefall(self.treiber.roh_lesen(&format!("api/aufgaben?board={kodiert}")))
    }

    /// Ein Sammel-Weg mit einer Liste von Karten; `nummern` in Anfragereihenfolge, auch doppelt.
    pub async fn sammelt(&self, wer: &str, weg: Sammelweg, nummern: &[u32]) -> Ausgang {
        use serde_json::json;
        let (methode, pfad, daten) = match weg {
            Sammelweg::Legen => (reqwest::Method::POST, "api/boards/fabrik/aufgaben/mehrere", json!({"nummern": nummern})),
            Sammelweg::Bewegen => (reqwest::Method::POST, "api/boards/fabrik/bewegen-mehrere", json!({"ziele": nummern.iter().map(|n| json!({"nummer": n, "spalte": FERTIG})).collect::<Vec<_>>()})),
            Sammelweg::Aendern => (reqwest::Method::PATCH, "api/aufgaben/mehrere", json!({"aenderungen": nummern.iter().enumerate().map(|(i, n)| json!({"nummer": n, "titel": format!("t{i}")})).collect::<Vec<_>>()})),
            Sammelweg::Archivieren => (reqwest::Method::POST, "api/aufgaben/archivieren", json!({"nummern": nummern})),
            Sammelweg::Zurueckholen => (reqwest::Method::POST, "api/aufgaben/zurueckholen", json!({"nummern": nummern})),
        };
        let a = self.treiber.rufen(methode, pfad, wer, daten).await;
        Ausgang { status: a.status, fehler: text(&a.rumpf["fehler"]), ergebnis: a.rumpf.to_string(), rumpf: String::new() }
    }

    /// Bericht aus der Git-Geschichte des Boards (`verlauf` oder `bewegungen`); `kodiert` steht so in der URL.
    pub fn bericht_abrufen(&self, bericht: &str, kodiert: &str) -> Ausgang {
        lesefall(self.treiber.roh_lesen(&format!("api/berichte/{bericht}?board={kodiert}")))
    }

    pub async fn spalte(&self, name: &str) -> Vec<u32> {
        self.treiber.spalte(name).await
    }

    pub async fn titel(&self, nr: u32) -> String {
        text(&self.treiber.aufgabe(nr).await["titel"])
    }

    /// Die Board-Namen der Liste `GET /api/boards`.
    pub async fn boards(&self) -> Vec<String> {
        self.treiber.lesen("api/boards").await.as_array().unwrap().iter().map(|b| text(&b["slug"])).collect()
    }

    /// Die defekten Dateien des Ordnerzustands als „Pfad: Fehler“.
    pub async fn defekte(&self) -> Vec<String> {
        self.treiber.lesen("api/zustand").await["defekte"].as_array().unwrap().iter().map(|d| format!("{}: {}", text(&d["pfad"]), text(&d["fehler"]))).collect()
    }

    /// Die Board-Namen des Ordnerzustands.
    pub async fn boards_im_zustand(&self) -> Vec<String> {
        self.treiber.lesen("api/zustand").await["boards"].as_array().unwrap().iter().map(|b| text(&b["slug"])).collect()
    }

    pub fn board_datei(&self, name: &str) -> Option<Vec<u8>> {
        self.treiber.datei(&format!("boards/{name}.md"))
    }
}

fn text(v: &serde_json::Value) -> String {
    v.as_str().unwrap_or_default().to_string()
}

fn lesefall((status, rumpf): (u16, String)) -> Ausgang {
    let fehler = serde_json::from_str::<serde_json::Value>(rumpf.trim()).map(|v| text(&v["fehler"])).unwrap_or_default();
    Ausgang { status, fehler, ergebnis: String::new(), rumpf }
}

/// Eine Zeile der Matrix: erwarteter Status und „nichts geändert“; Abweichung als Text.
pub fn abweichung(weg: &str, wert: &str, aus: &Ausgang, erwartet: u16, aenderungen: Vec<String>) -> Option<String> {
    let mut gruende = aenderungen;
    if aus.status != erwartet {
        gruende.insert(0, format!("{} statt {erwartet} ({})", aus.status, aus.fehler));
    }
    if aus.rumpf.contains(FREMDES_MERKMAL) {
        gruende.push("Antwort enthält die fremde Datei".into());
    }
    (!gruende.is_empty()).then(|| format!("{weg} {wert:?}: {}", gruende.join("; ")))
}
