mod gemeinsam;

use gemeinsam::git;
use serde_json::{Value, json};

fn einrichtung() -> Value {
    json!({
        "ich": {"kuerzel": "st", "name": "Stefan"},
        "agenten": [{"kuerzel": "cl", "name": "Claude"}],
        "board": "Entwicklung",
        "spalten": ["Zu erledigen", "In Arbeit", "Erledigt"],
        "quellen": {"wbs": "Dokumentation/Planung/kanbanD.md", "anforderungen": "Anforderungen/"}
    })
}

#[tokio::test]
async fn einrichten_legt_beide_dateien_in_einem_commit_von_ich_an() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let c = reqwest::Client::new();
    let r = c.post(format!("{}api/einrichten", lauf.adresse)).json(&einrichtung()).send().await.unwrap();
    assert_eq!(r.status(), 201);
    assert_eq!(r.json::<Value>().await.unwrap()["board"], "entwicklung");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an"]), "Stefan");
    let im_commit = git(tmp.path(), &["show", "--name-only", "--format=", "HEAD"]);
    assert_eq!(im_commit.lines().collect::<Vec<_>>(), vec!["boards/entwicklung.md", "kanbanD.md"]);
    let board = std::fs::read_to_string(tmp.path().join("boards/entwicklung.md")).unwrap();
    assert_eq!(board, "# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n");
    let z: Value = c.get(format!("{}api/zustand", lauf.adresse)).send().await.unwrap().json().await.unwrap();
    assert_eq!(z["eingerichtet"], true);
    assert_eq!(z["boards"][0]["titel"], "Entwicklung");
    assert_eq!(z["einstellungen"]["personen"][1]["art"], "agent");
    assert_eq!(z["einstellungen"]["quellen"]["wbs"], "Dokumentation/Planung/kanbanD.md");
}

#[tokio::test]
async fn zweites_einrichten_ist_ein_konflikt_und_aendert_nichts() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let c = reqwest::Client::new();
    c.post(format!("{}api/einrichten", lauf.adresse)).json(&einrichtung()).send().await.unwrap();
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    let r = c.post(format!("{}api/einrichten", lauf.adresse)).json(&einrichtung()).send().await.unwrap();
    assert_eq!(r.status(), 409);
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
}

#[tokio::test]
async fn ungueltige_angaben_antworten_400_mit_meldung_und_legen_nichts_an() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let c = reqwest::Client::new();
    for (feld, wert) in [("ich", json!({"kuerzel": "St!", "name": "S"})), ("spalten", json!([])), ("spalten", json!(["A", "A"]))] {
        let mut e = einrichtung();
        e[feld] = wert;
        let r = c.post(format!("{}api/einrichten", lauf.adresse)).json(&e).send().await.unwrap();
        assert_eq!(r.status(), 400);
        assert!(r.json::<Value>().await.unwrap()["fehler"].as_str().unwrap().len() > 5);
    }
    assert!(!tmp.path().join("kanbanD.md").exists());
}

#[tokio::test]
async fn defekte_einstellungen_und_boards_werden_im_zustand_gemeldet() {
    let tmp = tempfile::tempdir().unwrap();
    std::fs::write(tmp.path().join("kanbanD.md"), "---\npeople: [\n---\n").unwrap();
    std::fs::create_dir_all(tmp.path().join("boards")).unwrap();
    std::fs::write(tmp.path().join("boards/kaputt.md"), "- #1\n## A\n").unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let z: Value = reqwest::get(format!("{}api/zustand", lauf.adresse)).await.unwrap().json().await.unwrap();
    let pfade: Vec<&str> = z["defekte"].as_array().unwrap().iter().map(|d| d["pfad"].as_str().unwrap()).collect();
    assert_eq!(pfade, vec!["kanbanD.md", "boards/kaputt.md"]);
    assert_eq!(z["eingerichtet"], true);
    assert!(z["einstellungen"].is_null());
}
