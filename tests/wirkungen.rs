//! R00057: Aufgaben wirken auf die WBS — erst die WBS im Arbeits-Repository (ohne Commit), dann die Aufgabe im Board-Repository.
mod gemeinsam;

use gemeinsam::{arbeits_repository, git, mit_register};
use kanband::dienst::{Kanban, WirkungEingabe};
use kanband::fehler::Fehler;
use std::path::Path;

const KOPF: &str = "---\napplication: Kasse\nzuletzt: 2026-01-01\n---\n\n| ID | Ebene | Eltern | Name | Status | Fertig-Kriterium | Eingabe → Ausgabe | Aufwand | Ausbaustufe | Braucht | Requirement | Notiz |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n";

/// D0002 grün mit I0047 (eine Bubble) und I0014, I0001 bis I0013 nur als Historie der Nummern weggelassen.
fn wbs() -> String {
    let zeilen = [("A0001", "Application", "—"), ("D0001", "Dialog", "A0001"), ("I0001", "Interaction", "D0001"), ("D0002", "Dialog", "A0001"), ("I0014", "Interaction", "D0002"), ("B0001", "Bubble", "I0014"), ("I0047", "Interaction", "D0002"), ("B0002", "Bubble", "I0047")];
    KOPF.to_string() + &zeilen.iter().map(|(id, e, p)| format!("| {id} | {e} | {p} | Name {id} | gruen | US-1 |  |  |  |  |  |  |\n")).collect::<String>()
}

struct Lage {
    _arbeit_tmp: tempfile::TempDir,
    arbeit: std::path::PathBuf,
    board: tempfile::TempDir,
    kanban: Kanban,
}

/// Board-Repository mit Aufgabe #7 „Dialog Export bauen“, Arbeits-Repository mit der WBS der Anwendung `kc`.
fn lage() -> Lage {
    let (_arbeit_tmp, arbeit) = arbeits_repository(&wbs());
    let board = tempfile::tempdir().unwrap();
    mit_register(board.path(), &arbeit);
    std::fs::create_dir_all(board.path().join("aufgaben")).unwrap();
    std::fs::write(board.path().join("aufgaben/0007-dialog-export-bauen.md"), "---\nid: 7\ntitle: Dialog Export bauen\norigins: [kc:I0047]\n---\n").unwrap();
    git(board.path(), &["add", "-A"]);
    git(board.path(), &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-m", "#7"]);
    let kanban = Kanban::neu(board.path().to_path_buf());
    Lage { _arbeit_tmp, arbeit, board, kanban }
}

impl Lage {
    fn setzen(&self, json: serde_json::Value) -> Result<kanband::modell::Aufgabe, Fehler> {
        let wer = self.kanban.handelnder(Some("cl")).unwrap();
        self.kanban.wirkung_setzen(&wer, 7, &serde_json::from_value::<WirkungEingabe>(json).unwrap())
    }
    fn plan(&self) -> String {
        gemeinsam::lies(&self.arbeit, "Dokumentation/Planung/kasse.md")
    }
    fn aufgabe(&self) -> String {
        gemeinsam::lies(self.board.path(), "aufgaben/0007-dialog-export-bauen.md")
    }
    fn commits(&self, repo: &Path) -> String {
        git(repo, &["rev-list", "--count", "HEAD"])
    }
    fn status(&self, id: &str) -> String {
        kanband::herkunft::wbs_tabelle(&self.plan()).knoten(id).map(|k| k.status.clone()).unwrap_or_default()
    }
}

#[test]
fn create_legt_den_knoten_rot_an_die_aufgabe_traegt_seine_id_ein_commit_nur_im_board_repository() {
    let l = lage();
    let (board_vorher, arbeit_vorher) = (l.commits(l.board.path()), l.commits(&l.arbeit));
    let a = l.setzen(serde_json::json!({"application": "kc", "action": "create", "parent": "D0002", "level": "Interaction", "name": "Export", "done_criterion": "US-1"})).unwrap();
    assert_eq!(a.wirkungen[0].knoten.as_deref(), Some("I0048"), "nächste freie Interaction");
    let k = kanband::herkunft::wbs_tabelle(&l.plan()).knoten("I0048").cloned().unwrap();
    assert_eq!((k.status.as_str(), k.eltern.as_str(), k.name.as_str(), k.fertig_kriterium.as_str()), ("rot", "D0002", "Export", "US-1"));
    assert!(l.aufgabe().contains("wbs-effects:\n  - {application: kc, action: create, node: I0048, parent: D0002, level: Interaction, name: Export, done-criterion: US-1}\n"), "{}", l.aufgabe());
    assert_eq!(l.commits(l.board.path()), (board_vorher.parse::<u32>().unwrap() + 1).to_string(), "ein Commit im Board-Repository");
    assert_eq!(git(l.board.path(), &["log", "-1", "--format=%an|%s"]), "Claude|#7 wirkt auf kc:I0048 (create)");
    assert_eq!(l.commits(&l.arbeit), arbeit_vorher, "keiner im Arbeits-Repository");
    assert_eq!(git(&l.arbeit, &["status", "--porcelain"]), "M Dokumentation/Planung/kasse.md");
    assert_eq!(git(l.board.path(), &["status", "--porcelain"]), "");
}

#[test]
fn rework_setzt_den_gruenen_dialog_und_seine_nachfahren_rot() {
    let l = lage();
    l.setzen(serde_json::json!({"application": "kc", "action": "rework", "node": "D0002"})).unwrap();
    assert_eq!(["D0002", "I0014", "B0001", "I0047", "B0002", "D0001", "I0001", "A0001"].map(|id| l.status(id)), ["rot", "rot", "rot", "rot", "rot", "gruen", "gruen", "gelb"]);
    assert!(l.aufgabe().contains("  - {application: kc, action: rework, node: D0002}\n"));
    let vorher = l.commits(l.board.path());
    let a = l.setzen(serde_json::json!({"application": "kc", "action": "rework", "node": "D0002"})).unwrap();
    assert_eq!((a.wirkungen.len(), l.commits(l.board.path())), (1, vorher), "dieselbe Wirkung ein zweites Mal: keine zweite Zeile, kein Commit");
}

#[test]
fn remove_verwirft_den_knoten_samt_nachfahren_mit_der_aufgabe_als_grund() {
    let l = lage();
    l.setzen(serde_json::json!({"application": "kc", "action": "remove", "node": "I0014"})).unwrap();
    assert_eq!(["I0014", "B0001", "I0047"].map(|id| l.status(id)), ["verworfen", "verworfen", "gruen"]);
    assert!(l.plan().contains("| verworfen: #7 Dialog Export bauen |"));
    assert_eq!(git(l.board.path(), &["log", "-1", "--format=%s"]), "#7 wirkt auf kc:I0014 (remove)");
}

#[test]
fn scheitert_die_wbs_bleibt_die_aufgabe_unveraendert_409() {
    let l = lage();
    let (aufgabe_vorher, commits_vorher) = (l.aufgabe(), l.commits(l.board.path()));
    let f = l.setzen(serde_json::json!({"application": "kc", "action": "rework", "node": "D0099"})).unwrap_err();
    assert_eq!(f, Fehler::Konflikt("Knoten „D0099“ steht nicht in der WBS".into()));
    std::fs::write(l.arbeit.join("Dokumentation/Planung/kasse.md"), "# kaputt\n").unwrap();
    assert!(matches!(l.setzen(serde_json::json!({"application": "kc", "action": "remove", "node": "I0014"})), Err(Fehler::Konflikt(m)) if m.contains("defekt")));
    std::fs::remove_file(l.arbeit.join("Dokumentation/Planung/kasse.md")).unwrap();
    assert!(matches!(l.setzen(serde_json::json!({"application": "kc", "action": "rework", "node": "D0002"})), Err(Fehler::Konflikt(m)) if m.contains("nicht erreichbar")));
    assert_eq!((l.aufgabe(), l.commits(l.board.path())), (aufgabe_vorher, commits_vorher), "Aufgabendatei unverändert, kein Commit");
}

#[test]
fn falsche_eingaben_sind_400_und_aendern_weder_wbs_noch_aufgabe() {
    let l = lage();
    let vorher = (l.plan(), l.aufgabe());
    for json in [serde_json::json!({"action": "rework", "node": "D0002"}), serde_json::json!({"application": "kc", "action": "create", "parent": "D0002", "level": "Interaction", "name": "X"}), serde_json::json!({"application": "kc", "action": "create", "parent": "D0002", "level": "Bubble", "name": "X", "done_criterion": "Test gruen"})] {
        assert!(matches!(l.setzen(json.clone()), Err(Fehler::Ungueltig(_))), "{json}");
    }
    let wer = l.kanban.handelnder(Some("st")).unwrap();
    assert!(matches!(l.kanban.wirkung_setzen(&wer, 99, &serde_json::from_value(serde_json::json!({"application": "kc", "action": "rework", "node": "D0002"})).unwrap()), Err(Fehler::NichtGefunden(_))), "unbekannte Aufgabe vor der WBS");
    assert_eq!((l.plan(), l.aufgabe()), vorher);
}

#[tokio::test]
async fn ueber_die_api_setzen_und_entfernen_die_wbs_bleibt() {
    let l = lage();
    let lauf = gemeinsam::starten(l.board.path(), &["--port", "0"]);
    let pfad = "api/aufgaben/7/wbs-effects";
    let (s, a) = gemeinsam::senden(reqwest::Method::PATCH, &lauf.adresse, pfad, "st", serde_json::json!({"application": "kc", "action": "create", "parent": "D0002", "level": "Interaction", "name": "Export", "done_criterion": "US-1"})).await;
    assert_eq!((s, a["wirkungen"].clone()), (200, serde_json::json!([{"application": "kc", "action": "create", "node": "I0048", "parent": "D0002", "level": "Interaction", "name": "Export", "done_criterion": "US-1"}])));
    let (s, r) = gemeinsam::senden(reqwest::Method::PATCH, &lauf.adresse, pfad, "st", serde_json::json!({"application": "kc", "action": "rework", "node": "D0099"})).await;
    assert_eq!((s, r["fehler"].as_str()), (409, Some("Knoten „D0099“ steht nicht in der WBS")));
    let (s, r) = gemeinsam::senden(reqwest::Method::PATCH, &lauf.adresse, pfad, "st", serde_json::json!({"action": "rework", "node": "D0002"})).await;
    assert_eq!(s, 400, "{r}");
    let ohne = reqwest::Client::new().patch(format!("{}{pfad}", lauf.adresse)).json(&serde_json::json!({"application": "kc", "action": "rework", "node": "D0002"})).send().await.unwrap();
    assert_eq!(ohne.status().as_u16(), 400, "Identität Pflicht");
    let plan_vorher = l.plan();
    let (s, a) = gemeinsam::senden(reqwest::Method::DELETE, &lauf.adresse, "api/aufgaben/7/wbs-effects/0", "st", serde_json::Value::Null).await;
    assert_eq!((s, a["wirkungen"].clone()), (200, serde_json::json!([])));
    assert_eq!(l.plan(), plan_vorher, "I0048 bleibt in der WBS");
    assert!(!l.aufgabe().contains("wbs-effects"));
    assert_eq!(git(l.board.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#7 Wirkung auf kc:I0048 (create) entfernt");
    let (s, _) = gemeinsam::senden(reqwest::Method::DELETE, &lauf.adresse, "api/aufgaben/7/wbs-effects/0", "st", serde_json::Value::Null).await;
    assert_eq!(s, 404);
}
