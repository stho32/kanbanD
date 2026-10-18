//! R00062: ein Board über die API an Anwendungen binden oder davon lösen.
mod gemeinsam;

use gemeinsam::{arbeits_repository, git, lies, mit_register, senden};
use reqwest::Method;
use serde_json::json;

const WBS: &str = "---\napplication: Kasse\n---\n\n| ID | Ebene | Eltern | Name | Status |\n|---|---|---|---|---|\n| A0001 | Application | — | Kasse | rot |\n";

fn commits(ordner: &std::path::Path) -> u32 {
    git(ordner, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

#[tokio::test]
async fn leere_liste_loest_die_bindung_mit_einem_commit() {
    let (_arbeit_tmp, arbeit) = arbeits_repository(WBS);
    let board = tempfile::tempdir().unwrap();
    mit_register(board.path(), &arbeit);
    let lauf = gemeinsam::starten(board.path(), &["--port", "0"]);
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!(b["phasen"]["anwendung"], "kc", "ohne applications: die einzige registrierte");
    let vorher = commits(board.path());

    let (s, v) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/anwendungen", "st", json!([])).await;
    assert_eq!((s, v["geaendert"].as_bool()), (200, Some(true)));
    assert_eq!(commits(board.path()), vorher + 1);
    assert_eq!(git(board.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|Anwendungen von „Entwicklung“: keine");
    assert!(lies(board.path(), "boards/entwicklung.md").starts_with("---\napplications: []\n"));

    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!(b["phasen"], json!(null));
    assert_eq!(b["anwendungen"], json!([]));
    assert!(b["spalten"].as_array().unwrap().iter().any(|s| s["name"] == "Entwicklertest"), "nachgetragene Phasen-Spalten bleiben stehen");
    assert_eq!(commits(board.path()), vorher + 1, "kein Commit beim Lesen");

    let (_, v) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/anwendungen", "st", json!([])).await;
    assert_eq!(v["geaendert"], false, "unverändert: kein Commit");
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/anwendungen", "st", json!(["xx"])).await;
    assert_eq!(s, 400, "unbekanntes Kürzel");
    assert_eq!(commits(board.path()), vorher + 1);

    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/anwendungen", "st", json!(["kc"])).await;
    assert_eq!(git(board.path(), &["log", "-1", "--format=%s"]), "Anwendungen von „Entwicklung“: kc");
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!(b["phasen"]["anwendung"], "kc");
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/gibtsnicht/anwendungen", "st", json!([])).await.0, 404);
}

#[tokio::test]
async fn applications_leer_bleibt_beim_bewegen_spalten_und_termine_setzen() {
    let (_arbeit_tmp, arbeit) = arbeits_repository(WBS);
    let board = tempfile::tempdir().unwrap();
    mit_register(board.path(), &arbeit);
    let lauf = gemeinsam::starten(board.path(), &["--port", "0"]);
    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/anwendungen", "st", json!([])).await;
    let (s, _) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "x", "board": "entwicklung"})).await;
    assert_eq!(s, 201);
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    let ziel = b["spalten"][1]["name"].as_str().unwrap().to_string();
    let (s, _) = senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen", "st", json!({"nummer": 1, "spalte": ziel})).await;
    assert_eq!(s, 200);
    let spalten: Vec<serde_json::Value> = b["spalten"].as_array().unwrap().iter().map(|s| json!({"name": s["name"], "alt": s["name"]})).collect();
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/spalten", "st", json!(spalten)).await;
    assert_eq!(s, 200);
    let (s, _) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/termine", "st", json!([{"name": "D", "datum": "2027-10-31", "farbe": "red"}])).await;
    assert_eq!(s, 200);
    assert!(lies(board.path(), "boards/entwicklung.md").starts_with("---\napplications: []\n"), "{}", lies(board.path(), "boards/entwicklung.md"));
}

#[test]
fn kuerzel_werden_getrimmt_und_einmal_genommen() {
    let (_arbeit_tmp, arbeit) = arbeits_repository(WBS);
    let board = tempfile::tempdir().unwrap();
    mit_register(board.path(), &arbeit);
    let kanban = kanband::dienst::Kanban::neu(board.path().to_path_buf());
    let st = kanban.handelnder(Some("st")).unwrap();
    assert!(kanban.bindung_setzen(&st, "entwicklung", &[" kc ".into(), "kc".into()]).unwrap());
    assert!(lies(board.path(), "boards/entwicklung.md").starts_with("---\napplications: [kc]\n"));
    assert!(!kanban.bindung_setzen(&st, "entwicklung", &["kc".into()]).unwrap(), "dieselbe Bindung: kein Commit");
}
