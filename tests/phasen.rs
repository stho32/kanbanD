//! R00058: Phasen einer gebundenen Anwendung als Spalten des Boards.
mod gemeinsam;

use gemeinsam::{arbeits_repository, git, mit_register};
use kanband::dienst::Kanban;

const WBS: &str = "---\napplication: Kasse\n---\n\n| ID | Ebene | Eltern | Name | Status |\n|---|---|---|---|---|\n| A0001 | Application | — | Kasse | rot |\n";
const PHASEN: &str = "## Phasen\n\n| Nr | Phase | Abschließt | Nachweis | Eingebettet in | Gleich wie | Spur | Braucht | Status |\n|---|---|---|---|---|---|---|---|---|\n| 1 | Entwicklung | KI | — | | | | | |\n| 2 | Review | Entwickler | frei | im-pair | | | | |\n| 3 | Abnahme | Kunde | frei | | Review | | | |\n";

struct Lage {
    _arbeit_tmp: tempfile::TempDir,
    arbeit: std::path::PathBuf,
    board: tempfile::TempDir,
    kanban: Kanban,
}

fn lage() -> Lage {
    let (_arbeit_tmp, arbeit) = arbeits_repository(WBS);
    let board = tempfile::tempdir().unwrap();
    mit_register(board.path(), &arbeit);
    let kanban = Kanban::neu(board.path().to_path_buf());
    Lage { _arbeit_tmp, arbeit, board, kanban }
}

impl Lage {
    fn board(&self) -> kanband::modell::Board {
        self.kanban.ordner().board("entwicklung").unwrap()
    }
}

#[test]
fn ohne_phasen_datei_das_standardmodell_der_einzigen_registrierten_anwendung() {
    let l = lage();
    let s = l.kanban.phasenstand(&l.board()).unwrap();
    assert_eq!((s.anwendung.as_str(), s.folge.namen()), ("kc", vec!["Entwicklung", "Entwicklertest", "Abnahme"]));
    assert!(s.hinweise.is_empty());
}

#[test]
fn die_phasen_datei_neben_der_wbs_gilt() {
    let l = lage();
    std::fs::write(l.arbeit.join("Dokumentation/Planung/kasse-phasen.md"), PHASEN).unwrap();
    let s = l.kanban.phasenstand(&l.board()).unwrap();
    assert_eq!(s.folge.namen(), ["Entwicklung", "Review", "Abnahme"]);
    assert_eq!(s.folge.alle()[1].eingebettet, "im-pair");
}

#[test]
fn ohne_erreichbare_wbs_oder_ohne_bindung_keine_phasen() {
    let l = lage();
    std::fs::remove_file(l.arbeit.join("Dokumentation/Planung/kasse.md")).unwrap();
    assert_eq!(l.kanban.phasenstand(&l.board()), None);
    let mut fremd = l.board();
    fremd.anwendungen = Some(vec!["xx".into()]);
    assert_eq!(l.kanban.phasenstand(&fremd), None, "genannt, aber nicht registriert");
}

#[test]
fn ausdruecklich_leere_anwendungsliste_liest_ohne_phasen_und_ohne_commit() {
    let l = lage();
    std::fs::write(l.board.path().join("boards/entwicklung.md"), "---\napplications: []\n---\n\n# Entwicklung\n\n## Backlog\n\n## Erledigt\n").unwrap();
    git(l.board.path(), &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-am", "gelöst"]);
    let vorher = git(l.board.path(), &["rev-list", "--count", "HEAD"]);
    let b = l.kanban.board_mit_phasen("entwicklung").unwrap();
    assert_eq!(b.phasen, None);
    assert_eq!(b.board.spalten.iter().map(|s| s.name.as_str()).collect::<Vec<_>>(), ["Backlog", "Erledigt"]);
    assert_eq!(git(l.board.path(), &["rev-list", "--count", "HEAD"]), vorher, "kein Commit beim Lesen");
}

#[test]
fn zwei_gebundene_anwendungen_mit_verschiedenen_folgen_die_erste_gilt_mit_hinweis() {
    let l = lage();
    let (_zweite_tmp, zweite) = arbeits_repository(WBS);
    std::fs::write(zweite.join("Dokumentation/Planung/kasse-phasen.md"), PHASEN).unwrap();
    let kanban = format!("---\npeople:\n  st: {{name: Stefan, kind: human}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kc: {{name: Kasse, wbs: {}/Dokumentation/Planung/kasse.md, requirements: \"\"}}\n    kl: {{name: Lager, wbs: {}/Dokumentation/Planung/kasse.md, requirements: \"\"}}\n---\n", l.arbeit.display(), zweite.display());
    std::fs::write(l.board.path().join("kanbanD.md"), kanban).unwrap();
    git(l.board.path(), &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-am", "zwei"]);
    let mut b = l.board();
    b.anwendungen = Some(vec!["kc".into(), "kl".into()]);
    let s = l.kanban.phasenstand(&b).unwrap();
    assert_eq!(s.anwendung, "kc");
    assert_eq!(s.hinweise, ["„Lager“ hat die Phasenfolge Entwicklung → Review → Abnahme — es gilt die von „Kasse“: Entwicklung → Entwicklertest → Abnahme"]);
}

#[test]
fn lesen_traegt_fehlende_phasen_spalten_in_einem_commit_nach_danach_nichts() {
    let l = lage();
    std::fs::write(l.board.path().join("boards/entwicklung.md"), "# Entwicklung\n\n## Backlog\n\n## Nächste Aufgaben\n\n## Entwicklung\n\n## Erledigt\n").unwrap();
    git(l.board.path(), &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-am", "Board"]);
    let vorher = git(l.board.path(), &["rev-list", "--count", "HEAD"]);
    let b = l.kanban.board_mit_phasen("entwicklung").unwrap();
    assert_eq!(b.board.spalten.iter().map(|s| s.name.as_str()).collect::<Vec<_>>(), ["Backlog", "Nächste Aufgaben", "Entwicklung", "Entwicklertest", "Abnahme", "Erledigt"]);
    assert_eq!(b.phasen.as_ref().unwrap().folge.namen().len(), 3);
    let text = gemeinsam::lies(l.board.path(), "boards/entwicklung.md");
    assert!(text.starts_with("---\ncolumn-phases:\n  Entwicklung: Entwicklung\n  Entwicklertest: Entwicklertest\n  Abnahme: Abnahme\n---\n"), "{text}");
    assert_eq!(git(l.board.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap(), vorher.parse::<u32>().unwrap() + 1);
    assert_eq!(git(l.board.path(), &["log", "-1", "--format=%an|%s"]), "kanbanD|Phasen-Spalten von „Entwicklung“ ergänzt: Entwicklung (zugeordnet), Entwicklertest, Abnahme");
    l.kanban.board_mit_phasen("entwicklung").unwrap();
    assert_eq!(git(l.board.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap(), vorher.parse::<u32>().unwrap() + 1, "kein zweiter Commit");
}

#[test]
fn ein_reines_kanban_bleibt_unberuehrt() {
    let board = tempfile::tempdir().unwrap();
    gemeinsam::eingerichtet(board.path());
    let kanban = Kanban::neu(board.path().to_path_buf());
    let b = kanban.board_mit_phasen("entwicklung").unwrap();
    assert!(b.phasen.is_none());
    assert_eq!(b.board.spalten.len(), 3);
    assert_eq!(git(board.path(), &["rev-list", "--count", "HEAD"]), "1");
}

#[tokio::test]
async fn get_board_liefert_spalten_mit_phase_und_die_phasen() {
    let l = lage();
    let lauf = gemeinsam::starten(l.board.path(), &["--port", "0"]);
    let b: serde_json::Value = reqwest::get(format!("{}api/boards/entwicklung", lauf.adresse)).await.unwrap().json().await.unwrap();
    let spalten: Vec<(String, serde_json::Value)> = b["spalten"].as_array().unwrap().iter().map(|s| (s["name"].as_str().unwrap().to_string(), s["phase"].clone())).collect();
    assert_eq!(spalten.iter().map(|(n, _)| n.as_str()).collect::<Vec<_>>(), ["Zu erledigen", "In Arbeit", "Entwicklung", "Entwicklertest", "Abnahme", "Erledigt"]);
    assert_eq!(spalten[2].1, "Entwicklung");
    assert_eq!(spalten[0].1, serde_json::Value::Null);
    assert_eq!(b["phasen"]["anwendung"], "kc");
    assert_eq!(b["phasen"]["folge"][1]["name"], "Entwicklertest");
    assert_eq!(b["phasen"]["hinweise"], serde_json::json!([]));
}

#[test]
fn entfallende_phasen_ueber_die_aenderung_der_aufgabe_ein_commit() {
    let l = lage();
    std::fs::create_dir_all(l.board.path().join("aufgaben")).unwrap();
    std::fs::write(l.board.path().join("aufgaben/0003-drei.md"), "---\nid: 3\ntitle: drei\nphases: {note: x}\n---\n").unwrap();
    git(l.board.path(), &["add", "-A"]);
    git(l.board.path(), &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-m", "#3"]);
    let wer = l.kanban.handelnder(Some("st")).unwrap();
    let aenderung = serde_json::from_value(serde_json::json!({"phasen": {"skipped": ["Entwicklertest"]}})).unwrap();
    let a = l.kanban.aufgabe_aendern(&wer, 3, &aenderung).unwrap();
    assert_eq!(a.phasen.uebersprungen, ["Entwicklertest"]);
    assert_eq!(gemeinsam::lies(l.board.path(), "aufgaben/0003-drei.md"), "---\nid: 3\ntitle: drei\nphases:\n  skipped: [Entwicklertest]\n  note: x\n---\n");
    assert_eq!(git(l.board.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#3 geändert: Phasen");
}

#[test]
fn bewegungen_nennen_phasenfolge_spaltenphasen_und_je_aufgabe_labels_und_entfallende_phasen() {
    let l = lage();
    std::fs::create_dir_all(l.board.path().join("aufgaben")).unwrap();
    std::fs::write(l.board.path().join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\nlabels: [im-pair]\nphases:\n  skipped: [Abnahme]\n---\n").unwrap();
    std::fs::write(l.board.path().join("boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## Erledigt\n").unwrap();
    git(l.board.path(), &["add", "-A"]);
    git(l.board.path(), &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-m", "Board"]);
    l.kanban.board_mit_phasen("entwicklung").unwrap();
    let v = serde_json::to_value(l.kanban.bewegungen("entwicklung").unwrap()).unwrap();
    assert_eq!(v["spalten"], serde_json::json!(["Zu erledigen", "Entwicklung", "Entwicklertest", "Abnahme", "Erledigt"]));
    assert_eq!(v["phasen"]["anwendung"], "kc");
    assert_eq!(v["phasen"]["folge"].as_array().unwrap().iter().map(|p| p["name"].as_str().unwrap()).collect::<Vec<_>>(), ["Entwicklung", "Entwicklertest", "Abnahme"]);
    assert_eq!(v["phasen"]["folge"][0], serde_json::json!({"nr": 1, "name": "Entwicklung", "eingebettet": "", "gleich": ""}));
    assert_eq!(v["phasen"]["spaltenphasen"], serde_json::json!({"Entwicklung": "Entwicklung", "Entwicklertest": "Entwicklertest", "Abnahme": "Abnahme"}));
    assert_eq!((v["aufgaben"][0]["labels"].clone(), v["aufgaben"][0]["uebersprungen"].clone()), (serde_json::json!(["im-pair"]), serde_json::json!(["Abnahme"])));
    assert_eq!((v["aufgaben"][1]["labels"].clone(), v["aufgaben"][1]["uebersprungen"].clone()), (serde_json::json!([]), serde_json::json!([])), "ohne Aufgabendatei leer");
}

#[test]
fn bewegungen_eines_reinen_kanbans_ohne_phasen() {
    let board = tempfile::tempdir().unwrap();
    gemeinsam::eingerichtet(board.path());
    let v = serde_json::to_value(Kanban::neu(board.path().to_path_buf()).bewegungen("entwicklung").unwrap()).unwrap();
    assert_eq!(v["phasen"], serde_json::Value::Null);
}

#[test]
fn gleichzeitiges_lesen_traegt_nur_einmal_nach() {
    let l = lage();
    let vorher: u32 = git(l.board.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();
    let kanban = std::sync::Arc::new(Kanban::neu(l.board.path().to_path_buf()));
    let faeden: Vec<_> = (0..4).map(|_| { let k = kanban.clone(); std::thread::spawn(move || k.board_mit_phasen("entwicklung").unwrap().board.spalten.len()) }).collect();
    assert!(faeden.into_iter().all(|f| f.join().unwrap() == 6), "jeder Leser sieht die ergänzten Spalten");
    assert_eq!(git(l.board.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap(), vorher + 1);
}

#[test]
fn spalten_setzen_behaelt_die_phase_einer_umbenannten_spalte() {
    let l = lage();
    l.kanban.board_mit_phasen("entwicklung").unwrap();
    let wer = l.kanban.handelnder(Some("st")).unwrap();
    let neu: Vec<kanband::modell::SpaltenAenderung> = serde_json::from_value(serde_json::json!([
        {"name": "Zu erledigen", "alt": "Zu erledigen"}, {"name": "In Arbeit", "alt": "In Arbeit"}, {"name": "Bau", "alt": "Entwicklung"},
        {"name": "Entwicklertest", "alt": "Entwicklertest"}, {"name": "Abnahme", "alt": "Abnahme"}, {"name": "Erledigt", "alt": "Erledigt"}
    ])).unwrap();
    assert!(l.kanban.spalten_setzen(&wer, "entwicklung", &neu).unwrap());
    let b = l.kanban.board_mit_phasen("entwicklung").unwrap();
    assert_eq!(b.board.spalten[2].phase.as_deref(), Some("Entwicklung"), "die umbenannte Spalte stellt weiter die Entwicklung dar");
    assert_eq!(b.board.spalten.len(), 6, "nichts nachgetragen");
}
