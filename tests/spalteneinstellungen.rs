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
    board_vorher: String,
    board: String,
    neue_commits: usize,
    /// `GET /api/boards/entwicklung` nach dem Aufruf: was kanbanD aus der geschriebenen Datei liest.
    gelesen: Value,
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
    setzen_und_ziehen(vorspann, eingang, wer, spalten, None).await.0
}

/// Wie `setzen_mit`; danach, wenn `folgezug` gegeben, `POST …/bewegen` mit diesen Daten als `bot` — dessen Status.
async fn setzen_und_ziehen(vorspann: &str, eingang: &[u32], wer: &str, spalten: Value, folgezug: Option<Value>) -> (Wirkung, Option<u16>) {
    let tmp = tempfile::tempdir().unwrap();
    ausgang_mit(tmp.path(), vorspann, eingang);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());
    let board_vorher = lies(tmp.path(), BOARD);
    let r = reqwest::Client::new().put(format!("{}api/boards/entwicklung/spalten", lauf.adresse)).header("X-KanbanD-Wer", wer).json(&spalten).send().await.unwrap();
    let status = r.status().as_u16();
    let roh = r.text().await.unwrap();
    let gelesen = reqwest::get(format!("{}api/boards/entwicklung", lauf.adresse)).await.unwrap().json().await.unwrap();
    let wirkung = Wirkung { status, roh, board_vorher, board: lies(tmp.path(), BOARD), neue_commits: commits(tmp.path()) - vorher, gelesen };
    let zug = match folgezug {
        Some(daten) => Some(gemeinsam::senden(reqwest::Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen", "bot", daten).await.0),
        None => None,
    };
    (wirkung, zug)
}

async fn setzen(wer: &str, spalten: Value) -> Wirkung {
    setzen_mit(VORSPANN, &[], wer, spalten).await
}

/// Abgewiesen: 403 mit genau diesem Rumpf, Board-Datei unverändert, kein Commit.
fn abgewiesen(w: &Wirkung, spalte: &str, einstellung: &str, fall: &str) {
    assert_eq!(w.status, 403, "{fall}: {}", w.roh);
    let was = if einstellung == "grenze" { "Grenze" } else { "Eigentümer" };
    let erwartet = format!(r#"{{"fehler":"{was} der Spalte „{spalte}“ ändern nur Menschen","spalte":"{spalte}","einstellung":"{einstellung}"}}"#);
    assert_eq!(w.roh, erwartet, "{fall}: Rumpf, fehler zuerst");
    assert_eq!(w.board, w.board_vorher, "{fall}: Board-Datei unverändert");
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
    let w = setzen_mit(VORSPANN, &[1], "bot", anfrage.clone()).await;
    assert_eq!(w.status, 409, "{}", w.roh);
    assert_eq!(w.rumpf(), json!({"fehler": "Spalte „Eingang“ enthält 1 Aufgabe — erst leeren"}));
    assert_eq!(w.neue_commits, 0);
    let w = setzen_mit(VORSPANN, &[1, 2, 3], "bot", anfrage).await;
    assert_eq!(w.rumpf(), json!({"fehler": "Spalte „Eingang“ enthält 3 Aufgaben — erst leeren"}), "{}", w.roh);
}

// ---- F0018 Eigentümer und Reihenfolge (B0304)

fn eigentuemer_von(spalte: &'static str, eigentuemer: Value) -> impl Fn(&str, &mut Value) {
    move |name, s| {
        if name == spalte {
            s["eigentuemer"] = eigentuemer.clone();
        }
    }
}

/// Die abgewiesenen Fälle aus „Eigentümer“: (Fall, Anfrage, Spalte der Abweisung, column-owner-Block der Datei nach `st`).
fn eigentuemerfaelle() -> Vec<(&'static str, Value, &'static str, &'static str)> {
    vec![
        ("Erledigt → human", alle(eigentuemer_von("Erledigt", json!("human"))), "Erledigt", "column-owner:\n  Eingang: human\n  Erledigt: human\n"),
        ("Eingang → agent", alle(eigentuemer_von("Eingang", json!("agent"))), "Eingang", "column-owner:\n  Eingang: agent\n"),
        ("Eingang → null", alle(eigentuemer_von("Eingang", Value::Null)), "Eingang", ""),
        ("Eingang entfernt", json!([{"name": "In Arbeit", "alt": "In Arbeit", "grenze": 2}, {"name": "Erledigt", "alt": "Erledigt"}]), "Eingang", ""),
    ]
}

#[tokio::test]
async fn agent_aendert_keinen_eigentuemer() {
    for (fall, anfrage, spalte, _) in eigentuemerfaelle() {
        let w = setzen("bot", anfrage).await;
        abgewiesen(&w, spalte, "eigentuemer", fall);
    }
}

#[tokio::test]
async fn agent_entfernt_auch_keinen_unbekannten_eigentuemer() {
    let vorspann = "---\nlimits:\n  In Arbeit: 2\ncolumn-owner:\n  Eingang: human\n  Erledigt: chef\n---\n";
    let w = setzen_mit(vorspann, &[], "bot", alle(eigentuemer_von("Erledigt", Value::Null))).await;
    abgewiesen(&w, "Erledigt", "eigentuemer", "chef → null");
    assert!(w.board.contains("  Erledigt: chef\n"), "chef steht weiter in der Datei");
}

#[tokio::test]
async fn mensch_setzt_und_entfernt_eigentuemer() {
    for (fall, anfrage, _, eigentuemer) in eigentuemerfaelle() {
        let w = setzen("st", anfrage).await;
        assert_eq!((w.status, w.neue_commits), (200, 1), "{fall}: {}", w.roh);
        assert!(w.board.starts_with(&format!("---\nlimits:\n  In Arbeit: 2\n{eigentuemer}---\n")), "{fall}: {}", w.board);
    }
}

#[tokio::test]
async fn die_erste_verletzung_von_links_grenze_vor_eigentuemer_entfernte_zuletzt() {
    let eingang_agent = json!({"name": "Eingang", "alt": "Eingang", "eigentuemer": "agent"});
    let in_arbeit_3 = json!({"name": "In Arbeit", "alt": "In Arbeit", "grenze": 3});
    let eingang = json!({"name": "Eingang", "alt": "Eingang"});
    let erledigt = json!({"name": "Erledigt", "alt": "Erledigt"});
    let faelle = [
        ("Eingang zuerst", json!([eingang_agent, in_arbeit_3, erledigt]), "Eingang", "eigentuemer"),
        ("umsortiert", json!([in_arbeit_3, eingang_agent, erledigt]), "In Arbeit", "grenze"),
        ("beides in einer Spalte", json!([eingang, {"name": "In Arbeit", "alt": "In Arbeit", "grenze": 3, "eigentuemer": "agent"}, erledigt]), "In Arbeit", "grenze"),
        ("entfernte zuletzt", json!([{"name": "Erledigt", "alt": "Erledigt", "eigentuemer": "human"}, {"name": "In Arbeit", "alt": "In Arbeit", "grenze": 2}]), "Erledigt", "eigentuemer"),
    ];
    for (fall, anfrage, spalte, einstellung) in faelle {
        let w = setzen("bot", anfrage).await;
        abgewiesen(&w, spalte, einstellung, fall);
    }
}

// ---- F0019 Fehlendes `grenze` (B0305)

#[tokio::test]
async fn fehlende_grenze_behaelt_null_und_0_entfernen() {
    let ohne = json!([{"name": "Eingang", "alt": "Eingang"}, {"name": "In Arbeit", "alt": "In Arbeit"}, {"name": "Erledigt", "alt": "Erledigt"}]);
    let w = setzen("st", ohne).await;
    assert_eq!((w.status, w.neue_commits), (200, 0), "ohne grenze: nichts geändert — {}", w.roh);
    assert!(w.board.starts_with("---\nlimits:\n  In Arbeit: 2\n"), "{}", w.board);
    for (fall, grenze) in [("null", Value::Null), ("0", json!(0))] {
        let w = setzen("st", alle(grenze_von("In Arbeit", grenze))).await;
        assert_eq!((w.status, w.neue_commits), (200, 1), "{fall}: {}", w.roh);
        assert!(w.board.starts_with("---\ncolumn-owner:\n  Eingang: human\n---\n"), "{fall} entfernt: {}", w.board);
    }
    let umbenannt = json!([{"name": "Eingang", "alt": "Eingang"}, {"name": "Bau", "alt": "In Arbeit"}, {"name": "Erledigt", "alt": "Erledigt"}]);
    let w = setzen("st", umbenannt).await;
    assert_eq!((w.status, w.neue_commits), (200, 1), "{}", w.roh);
    assert!(w.board.starts_with("---\nlimits:\n  Bau: 2\n"), "Umbenennen ohne grenze nimmt sie mit: {}", w.board);
}

// ---- F0020 Erlaubt bleibt (B0306)

#[tokio::test]
async fn agent_richtet_ein_was_keine_regel_traegt() {
    let mit_review = {
        let mut s = alle(|_, _| {});
        s.as_array_mut().unwrap().insert(2, json!({"name": "Review"}));
        s
    };
    let w = setzen("bot", mit_review).await;
    assert_eq!((w.status, w.neue_commits), (200, 1), "neue Spalte: {}", w.roh);
    assert_eq!(w.board, w.board_vorher.replace("## Erledigt\n", "## Review\n\n## Erledigt\n"), "Review ohne Grenze und Eigentümer");

    let w = setzen("bot", umbenannt("Erledigt", "Fertig")).await;
    assert_eq!((w.status, w.neue_commits), (200, 1), "Spalte ohne Einstellung umbenannt: {}", w.roh);
    assert_eq!(w.board, w.board_vorher.replace("## Erledigt\n", "## Fertig\n"), "nur der Name");

    let umsortiert = json!([{"name": "In Arbeit", "alt": "In Arbeit", "grenze": 2}, {"name": "Eingang", "alt": "Eingang"}, {"name": "Erledigt", "alt": "Erledigt"}]);
    let w = setzen("bot", umsortiert).await;
    assert_eq!((w.status, w.neue_commits), (200, 1), "umsortiert: {}", w.roh);
    assert!(w.board.contains("## In Arbeit\n\n## Eingang\n"), "{}", w.board);

    let w = setzen("bot", alle(|name, s| if name == "Eingang" { s["pruefungen"] = json!(["Ziel klar"]); s["notiz"] = json!("nur Neues"); s["farbe"] = json!("#336699"); })).await;
    assert_eq!((w.status, w.neue_commits), (200, 1), "pruefungen, notiz, farbe: {}", w.roh);
    assert!(w.board.contains("column-owner:\n  Eingang: human\n") && w.board.contains("Ziel klar") && w.board.contains("nur Neues") && w.board.contains("#336699"), "{}", w.board);
}

#[tokio::test]
async fn agent_sendet_einstellungen_unveraendert_ohne_commit() {
    let faelle = [
        ("gleiche Werte gesendet", alle(eigentuemer_von("Eingang", json!("human")))),
        ("ohne grenze und eigentuemer", json!([{"name": "Eingang", "alt": "Eingang"}, {"name": "In Arbeit", "alt": "In Arbeit"}, {"name": "Erledigt", "alt": "Erledigt"}])),
        ("0 an Spalte ohne Grenze", alle(grenze_von("Erledigt", json!(0)))),
    ];
    for (fall, anfrage) in faelle {
        let w = setzen("bot", anfrage).await;
        assert_eq!((w.status, w.rumpf(), w.neue_commits), (200, json!({"geaendert": false}), 0), "{fall}");
        assert_eq!(w.board, w.board_vorher, "{fall}: limits In Arbeit 2 und column-owner Eingang human bleiben");
    }
}

// ---- Nacharbeit 1 (Security-Review): die Sperre gilt für das, was zurückgelesen wird, nicht für das Board im Speicher

/// Namen, die beim Schreiben und Zurücklesen nicht dieselben bleiben — Grenze bzw. Eigentümer gingen still verloren.
const NICHT_RUNDLAUFSTABIL: [&str; 4] = ["In Arbeit\nx", "0x10", "0o17", "0b101"];

fn umbenannt(spalte: &'static str, neuer_name: &'static str) -> Value {
    alle(move |name, s| {
        if name == spalte {
            s["name"] = json!(neuer_name);
        }
    })
}

/// Abgewiesen mit 400 oder 403 (Grenze oder Eigentümer, je nachdem welcher Name zuerst abweicht); Datei byte-gleich, kein Commit.
fn nicht_durchgelassen(w: &Wirkung, fall: &str) {
    assert!(w.status == 400 || w.status == 403, "{fall}: {} {}", w.status, w.roh);
    if w.status == 403 {
        assert!(["grenze", "eigentuemer"].contains(&w.rumpf()["einstellung"].as_str().unwrap()), "{fall}: {}", w.roh);
    }
    assert_eq!(w.board, w.board_vorher, "{fall}: Board-Datei byte-gleich");
    assert_eq!(w.neue_commits, 0, "{fall}: kein Commit");
}

#[tokio::test]
async fn agent_entfernt_grenze_und_eigentuemer_nicht_ueber_einen_namen_ohne_rundlauf() {
    for name in NICHT_RUNDLAUFSTABIL {
        for (spalte, feld, wert) in [("In Arbeit", "grenze", json!(2)), ("Eingang", "eigentuemer", json!("human"))] {
            nicht_durchgelassen(&setzen("bot", umbenannt(spalte, name)).await, &format!("{spalte} → {name:?} ohne {feld}"));
            let mit_wert = alle(move |n, s| {
                if n == spalte {
                    s["name"] = json!(name);
                    s[feld] = wert.clone();
                }
            });
            nicht_durchgelassen(&setzen("bot", mit_wert).await, &format!("{spalte} → {name:?} mit {feld}"));
        }
    }
}

// ---- PO-Entscheidung zu Nacharbeit 1: für Agenten zählen limits und column-owner nach Spaltennamen, nicht über `alt`

#[tokio::test]
async fn agent_benennt_und_tauscht_keine_spalte_mit_einstellung() {
    let faelle = [
        ("Eingang → Posteingang", umbenannt("Eingang", "Posteingang"), "Posteingang", "eigentuemer"),
        ("In Arbeit → Bau", umbenannt("In Arbeit", "Bau"), "Bau", "grenze"),
        ("In Arbeit → Bau mit grenze 2", json!([{"name": "Eingang", "alt": "Eingang"}, {"name": "Bau", "alt": "In Arbeit", "grenze": 2}, {"name": "Erledigt", "alt": "Erledigt"}]), "Bau", "grenze"),
        ("beide umbenannt", json!([{"name": "Posteingang", "alt": "Eingang"}, {"name": "Bau", "alt": "In Arbeit", "grenze": 2}, {"name": "Erledigt", "alt": "Erledigt"}]), "Posteingang", "eigentuemer"),
        ("Tausch", json!([{"name": "Eingang", "alt": "In Arbeit"}, {"name": "In Arbeit", "alt": "Eingang"}, {"name": "Erledigt", "alt": "Erledigt"}]), "Eingang", "grenze"),
        (
            "Eingang → „Eingang alt“, neue Eingang ohne Eigentümer",
            json!([{"name": "Eingang alt", "alt": "Eingang"}, {"name": "Eingang"}, {"name": "In Arbeit", "alt": "In Arbeit"}, {"name": "Erledigt", "alt": "Erledigt"}]),
            "Eingang alt",
            "eigentuemer",
        ),
    ];
    for (fall, anfrage, spalte, einstellung) in faelle {
        abgewiesen(&setzen("bot", anfrage).await, spalte, einstellung, fall);
    }
}

#[tokio::test]
async fn beim_menschen_wandern_grenze_und_eigentuemer_mit_alt() {
    let beide = json!([{"name": "Posteingang", "alt": "Eingang"}, {"name": "Bau", "alt": "In Arbeit"}, {"name": "Erledigt", "alt": "Erledigt"}]);
    let w = setzen("st", beide).await;
    assert_eq!((w.status, w.neue_commits), (200, 1), "{}", w.roh);
    assert!(w.board.starts_with("---\nlimits:\n  Bau: 2\ncolumn-owner:\n  Posteingang: human\n---\n"), "{}", w.board);
    let gelesen = |i: usize, feld: &str| (w.gelesen["spalten"][i]["name"].clone(), w.gelesen["spalten"][i][feld].clone());
    assert_eq!((gelesen(0, "eigentuemer"), gelesen(1, "grenze")), ((json!("Posteingang"), json!("human")), (json!("Bau"), json!(2))), "{}", w.gelesen);
}

// ---- Nacharbeit 2 (Security-Wiederholung): Umbenennen oder Tauschen mit passend mitgesendeten Werten. Der Name allein
// reicht nicht — die geschützte Spalte samt Karten wandert über `alt`; beide Identitäten zählen.

/// U5b–U5e der Abnahme-Probe: (Fall, Anfrage, Spalte und Einstellung der 403).
fn umgehungen() -> [(&'static str, Value, &'static str, &'static str); 4] {
    [
        (
            "U5b Eingang → „Eingang alt“ ohne Eigentümer, neue Eingang mit human",
            json!([{"name": "Eingang alt", "alt": "Eingang", "eigentuemer": null}, {"name": "Eingang", "eigentuemer": "human"}, {"name": "In Arbeit", "alt": "In Arbeit"}, {"name": "Erledigt", "alt": "Erledigt"}]),
            "Eingang alt",
            "eigentuemer",
        ),
        (
            "U5c In Arbeit → Bau ohne Grenze, neue In Arbeit mit 2",
            json!([{"name": "Eingang", "alt": "Eingang"}, {"name": "Bau", "alt": "In Arbeit", "grenze": 0}, {"name": "In Arbeit", "grenze": 2}, {"name": "Erledigt", "alt": "Erledigt"}]),
            "Bau",
            "grenze",
        ),
        (
            "U5d Tausch Eingang/In Arbeit mit getauschten Werten",
            json!([{"name": "In Arbeit", "alt": "Eingang", "grenze": 2, "eigentuemer": null}, {"name": "Eingang", "alt": "In Arbeit", "grenze": 0, "eigentuemer": "human"}, {"name": "Erledigt", "alt": "Erledigt"}]),
            "In Arbeit",
            "grenze",
        ),
        (
            "U5e Tausch Eingang/Erledigt mit getauschtem Eigentümer",
            json!([{"name": "Erledigt", "alt": "Eingang", "eigentuemer": null}, {"name": "In Arbeit", "alt": "In Arbeit"}, {"name": "Eingang", "alt": "Erledigt", "eigentuemer": "human"}]),
            "Erledigt",
            "eigentuemer",
        ),
    ]
}

#[tokio::test]
async fn agent_umgeht_die_sperre_nicht_mit_mitgesendeten_werten() {
    let mut durchgelassen = vec![];
    for (fall, anfrage, spalte, einstellung) in umgehungen() {
        let (w, zug) = setzen_und_ziehen(VORSPANN, &[1], "bot", anfrage, Some(json!({"nummer": 1, "spalte": "Erledigt"}))).await;
        if w.status != 403 {
            durchgelassen.push(format!("{fall}: {} {}, Folgezug {zug:?}", w.status, w.roh));
            continue;
        }
        abgewiesen(&w, spalte, einstellung, fall);
        assert_eq!(zug, Some(403), "{fall}: Folgezug #1 aus der Menschen-Spalte bleibt gesperrt");
    }
    assert!(durchgelassen.is_empty(), "durchgelassen:\n{}", durchgelassen.join("\n"));
}

#[tokio::test]
async fn agent_verdoppelt_und_ersetzt_keine_geschuetzte_spalte() {
    let doppelt = json!([{"name": "Eingang", "alt": "Eingang"}, {"name": "Eingang 2", "alt": "Eingang"}, {"name": "In Arbeit", "alt": "In Arbeit"}, {"name": "Erledigt", "alt": "Erledigt"}]);
    nicht_durchgelassen(&setzen("bot", doppelt).await, "zwei Einträge mit alt = Eingang");
    let ersetzt = json!([{"name": "Eingang", "alt": "Eingang"}, {"name": "Bau", "alt": "In Arbeit"}, {"name": "In Arbeit", "grenze": 2}, {"name": "Erledigt", "alt": "Erledigt"}]);
    abgewiesen(&setzen("bot", ersetzt).await, "Bau", "grenze", "In Arbeit → Bau, neue In Arbeit mit grenze 2");
}

#[tokio::test]
async fn agent_schleust_keine_spalte_ueber_einen_zeilenumbruch_ein() {
    let u6a = json!([{"name": "Eingang", "alt": "Eingang"}, {"name": "In Arbeit", "alt": "In Arbeit"}, {"name": "Erledigt", "alt": "Erledigt"}, {"name": "Foo\n## Eingang"}]);
    let w = setzen("bot", u6a).await;
    assert_eq!(w.status, 403, "U6a: {}", w.roh);
    assert_eq!((w.board.as_str(), w.neue_commits), (w.board_vorher.as_str(), 0), "U6a: byte-gleich, kein Commit");
}

#[tokio::test]
async fn mensch_darf_jede_umgehung_ausfuehren() {
    for (fall, anfrage, _, _) in umgehungen() {
        let w = setzen_mit(VORSPANN, &[1], "st", anfrage).await;
        assert_eq!((w.status, w.neue_commits), (200, 1), "{fall}: {}", w.roh);
    }
}
