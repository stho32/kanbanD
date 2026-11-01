// R00102 Spalteneinstellungen ändern nur Menschen: ein Agent ändert über PUT …/spalten weder Grenze noch Eigentümer
mod gemeinsam;

use gemeinsam::{git, lies};
use serde_json::{Value, json};
use std::path::Path;

const BOARD: &str = "boards/entwicklung.md";
const PERSONEN: &str = "---\npeople:\n  st: {name: Stefan, kind: human}\n  bot: {name: Bot, kind: agent}\nclasses: {}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n---\n";

/// Ausgangsboard der Anforderung: Eingang (human), In Arbeit (Grenze 2, leer), Erledigt; `st` Mensch, `bot` Agent.
/// `vorspann` ersetzt das Frontmatter, `eingang` die Karten im Eingang.
fn ausgang_mit(pfad: &Path, vorspann: &str, eingang: &[u32]) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), PERSONEN).unwrap();
    for nr in eingang {
        std::fs::write(pfad.join(format!("aufgaben/{nr:04}-k.md")), format!("---\nid: {nr}\ntitle: k{nr}\n---\n")).unwrap();
    }
    let karten: String = eingang.iter().map(|nr| format!("- #{nr}\n\n")).collect();
    std::fs::write(pfad.join(BOARD), format!("{vorspann}\n# Entwicklung\n\n## Eingang\n\n{karten}## In Arbeit\n\n## Erledigt\n")).unwrap();
    git(pfad, &["init", "-q"]);
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgang"]);
}

const VORSPANN: &str = "---\nlimits:\n  In Arbeit: 2\ncolumn-owner:\n  Eingang: human\n---\n";

/// Was ein Aufruf bewirkt hat: Status, Rumpf wie gesendet (Feldreihenfolge sichtbar), Board-Datei und Zahl neuer Commits.
struct Wirkung {
    status: u16,
    roh: String,
    board: String,
    neue_commits: usize,
}

impl Wirkung {
    fn rumpf(&self) -> Value {
        serde_json::from_str(&self.roh).unwrap_or(Value::Null)
    }
}

fn commits(pfad: &Path) -> usize {
    git(pfad, &["rev-list", "--count", "HEAD"]).trim().parse().unwrap()
}

/// Frischer Ordner nach `ausgang_mit`, ein `PUT …/spalten` als `wer`.
async fn setzen_mit(vorspann: &str, eingang: &[u32], wer: &str, spalten: Value) -> Wirkung {
    let tmp = tempfile::tempdir().unwrap();
    ausgang_mit(tmp.path(), vorspann, eingang);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());
    let r = reqwest::Client::new().put(format!("{}api/boards/entwicklung/spalten", lauf.adresse)).header("X-KanbanD-Wer", wer).json(&spalten).send().await.unwrap();
    let status = r.status().as_u16();
    let roh = r.text().await.unwrap();
    Wirkung { status, roh, board: lies(tmp.path(), BOARD), neue_commits: commits(tmp.path()) - vorher }
}

async fn setzen(wer: &str, spalten: Value) -> Wirkung {
    setzen_mit(VORSPANN, &[], wer, spalten).await
}

/// Die Board-Datei des Ausgangs, wie `ausgang_mit` sie schreibt.
fn ausgangsdatei() -> String {
    let tmp = tempfile::tempdir().unwrap();
    ausgang_mit(tmp.path(), VORSPANN, &[]);
    lies(tmp.path(), BOARD)
}

/// Abgewiesen: 403 mit genau diesem Rumpf, Board-Datei unverändert, kein Commit.
fn abgewiesen(w: &Wirkung, spalte: &str, einstellung: &str, fall: &str) {
    assert_eq!(w.status, 403, "{fall}: {}", w.roh);
    let was = if einstellung == "grenze" { "Grenze" } else { "Eigentümer" };
    let erwartet = format!(r#"{{"fehler":"{was} der Spalte „{spalte}“ ändern nur Menschen","spalte":"{spalte}","einstellung":"{einstellung}"}}"#);
    assert_eq!(w.roh, erwartet, "{fall}: Rumpf, fehler zuerst");
    assert_eq!(w.board, ausgangsdatei(), "{fall}: Board-Datei unverändert");
    assert_eq!(w.neue_commits, 0, "{fall}: kein Commit");
}

/// Die drei Spalten des Ausgangs mit `alt` = Name und unveränderten Werten; `aendern` passt eine an.
fn alle(aendern: impl Fn(&str, &mut Value)) -> Value {
    let mut spalten = vec![json!({"name": "Eingang", "alt": "Eingang"}), json!({"name": "In Arbeit", "alt": "In Arbeit", "grenze": 2}), json!({"name": "Erledigt", "alt": "Erledigt"})];
    for s in &mut spalten {
        let name = s["name"].as_str().unwrap().to_string();
        aendern(&name, s);
    }
    Value::Array(spalten)
}

fn grenze_von(spalte: &'static str, grenze: Value) -> impl Fn(&str, &mut Value) {
    move |name, s| {
        if name == spalte {
            s["grenze"] = grenze.clone();
        }
    }
}

/// Die abgewiesenen Fälle aus „Grenze“: (Fall, Anfrage, Spalte der Abweisung, Grenzen-Block der Datei nach `st`).
fn grenzfaelle() -> Vec<(&'static str, Value, &'static str, &'static str)> {
    let mit_review = {
        let mut s = alle(|_, _| {});
        s.as_array_mut().unwrap().insert(2, json!({"name": "Review", "grenze": 1}));
        s
    };
    vec![
        ("In Arbeit 2 → 3", alle(grenze_von("In Arbeit", json!(3))), "In Arbeit", "limits:\n  In Arbeit: 3\n"),
        ("In Arbeit → null", alle(grenze_von("In Arbeit", Value::Null)), "In Arbeit", ""),
        ("In Arbeit → 0", alle(grenze_von("In Arbeit", json!(0))), "In Arbeit", ""),
        ("Erledigt → 4", alle(grenze_von("Erledigt", json!(4))), "Erledigt", "limits:\n  In Arbeit: 2\n  Erledigt: 4\n"),
        ("neue Review mit 1", mit_review, "Review", "limits:\n  In Arbeit: 2\n  Review: 1\n"),
        ("In Arbeit entfernt", json!([{"name": "Eingang", "alt": "Eingang"}, {"name": "Erledigt", "alt": "Erledigt"}]), "In Arbeit", ""),
    ]
}

// ---- F0017 Grenze (B0302)

#[tokio::test]
async fn agent_aendert_keine_grenze() {
    for (fall, anfrage, spalte, _) in grenzfaelle() {
        let w = setzen("bot", anfrage).await;
        abgewiesen(&w, spalte, "grenze", fall);
    }
}

#[tokio::test]
async fn mensch_aendert_jede_grenze() {
    for (fall, anfrage, _, limits) in grenzfaelle() {
        let w = setzen("st", anfrage).await;
        assert_eq!((w.status, w.neue_commits), (200, 1), "{fall}: {}", w.roh);
        assert!(w.board.starts_with(&format!("---\n{limits}column-owner:\n  Eingang: human\n---\n")), "{fall}: {}", w.board);
    }
}

#[tokio::test]
async fn enthaelt_aufgaben_geht_vor_der_einstellungsregel() {
    let anfrage = json!([{"name": "In Arbeit", "alt": "In Arbeit", "grenze": 3}, {"name": "Erledigt", "alt": "Erledigt"}]);
    let w = setzen_mit(VORSPANN, &[1], "bot", anfrage).await;
    assert_eq!(w.status, 409, "{}", w.roh);
    assert_eq!(w.rumpf(), json!({"fehler": "Spalte „Eingang“ enthält 1 Aufgaben — erst leeren"}));
    assert_eq!(w.neue_commits, 0);
}
