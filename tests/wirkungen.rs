//! R00057, R00071: Aufgaben vermerken Wirkungen auf die WBS; der Eintritt wird geschaltet — erst die WBS im Arbeits-Repository
//! (ohne Commit), dann die Aufgabe im Board-Repository.
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
    fn schalten(&self, i: usize, an: bool) -> Result<kanband::modell::Aufgabe, Fehler> {
        let wer = self.kanban.handelnder(Some("st")).unwrap();
        self.kanban.wirkung_eintritt(&wer, 7, i, an)
    }
    fn eingetreten(&self) -> Vec<Option<bool>> {
        self.kanban.wirkungen_stand(7).unwrap().iter().map(|s| s.eingetreten).collect()
    }
    fn plan(&self) -> String {
        gemeinsam::lies(&self.arbeit, "Dokumentation/Planung/kasse.md")
    }
    fn aufgabe(&self) -> String {
        gemeinsam::lies(self.board.path(), "aufgaben/0007-dialog-export-bauen.md")
    }
    fn commits(&self, repo: &Path) -> u32 {
        git(repo, &["rev-list", "--count", "HEAD"]).parse().unwrap()
    }
    fn letzter(&self) -> String {
        git(self.board.path(), &["log", "-1", "--format=%an|%s"])
    }
    fn status(&self, id: &str) -> String {
        kanband::herkunft::wbs_tabelle(&self.plan()).knoten(id).map(|k| k.status.clone()).unwrap_or_default()
    }
}

const EXPORT: &str = r#"{"application": "kc", "action": "create", "parent": "D0002", "level": "Interaction", "name": "Export", "done_criterion": "US-1"}"#;

fn json(s: &str) -> serde_json::Value {
    serde_json::from_str(s).unwrap()
}

#[test]
fn vermerken_aendert_die_wbs_nicht_und_traegt_executed_false() {
    let l = lage();
    let (plan, arbeit_vorher) = (l.plan(), l.commits(&l.arbeit));
    l.setzen(json(EXPORT)).unwrap();
    assert_eq!(l.letzter(), "Claude|#7 Wirkung auf kc (create „Export“) vermerkt");
    l.setzen(serde_json::json!({"application": "kc", "action": "rework", "node": "D0002"})).unwrap();
    assert_eq!(l.letzter(), "Claude|#7 Wirkung auf kc:D0002 (rework) vermerkt");
    l.setzen(serde_json::json!({"application": "kc", "action": "remove", "node": "I0014"})).unwrap();
    assert_eq!(l.plan(), plan, "die WBS bleibt, wie sie ist");
    assert_eq!(l.commits(&l.arbeit), arbeit_vorher);
    assert!(l.aufgabe().contains("wbs-effects:\n  - {application: kc, action: create, parent: D0002, level: Interaction, name: Export, done-criterion: US-1, executed: false}\n  - {application: kc, action: rework, node: D0002, executed: false}\n  - {application: kc, action: remove, node: I0014, executed: false}\n"), "{}", l.aufgabe());
    assert_eq!(l.eingetreten(), [Some(false), Some(false), Some(false)]);
    let vorher = l.commits(l.board.path());
    let a = l.setzen(serde_json::json!({"application": "kc", "action": "rework", "node": "D0002"})).unwrap();
    assert_eq!((a.wirkungen.len(), l.commits(l.board.path())), (3, vorher), "dieselbe Wirkung ein zweites Mal: keine zweite Zeile, kein Commit");
    assert_eq!(l.setzen(json(EXPORT)).unwrap().wirkungen.len(), 4, "ein zweites create ist ein weiterer neuer Knoten");
}

#[test]
fn create_eintreten_legt_den_knoten_an_ausschalten_verwirft_ihn() {
    let l = lage();
    l.setzen(json(EXPORT)).unwrap();
    let (board_vorher, arbeit_vorher) = (l.commits(l.board.path()), l.commits(&l.arbeit));
    let a = l.schalten(0, true).unwrap();
    assert_eq!(a.wirkungen[0].knoten.as_deref(), Some("I0048"), "nächste freie Interaction");
    let k = kanband::herkunft::wbs_tabelle(&l.plan()).knoten("I0048").cloned().unwrap();
    assert_eq!((k.status.as_str(), k.eltern.as_str(), k.name.as_str(), k.fertig_kriterium.as_str()), ("rot", "D0002", "Export", "US-1"));
    let heute = chrono::Local::now().format("%Y-%m-%d").to_string();
    assert!(l.aufgabe().contains(&format!("  - {{application: kc, action: create, node: I0048, parent: D0002, level: Interaction, name: Export, done-criterion: US-1, executed: {heute}}}\n")), "{}", l.aufgabe());
    assert_eq!(l.letzter(), "Stefan|#7 Wirkung auf kc:I0048 (create) eingetreten");
    assert_eq!((l.commits(l.board.path()), l.commits(&l.arbeit)), (board_vorher + 1, arbeit_vorher), "ein Commit nur im Board-Repository");
    assert_eq!(git(&l.arbeit, &["status", "--porcelain"]), "M Dokumentation/Planung/kasse.md");
    assert_eq!(l.eingetreten(), [Some(true)]);
    l.schalten(0, false).unwrap();
    assert_eq!(l.status("I0048"), "verworfen");
    assert!(l.plan().contains("verworfen: #7 Dialog Export bauen zurückgenommen"));
    assert_eq!((l.eingetreten(), l.letzter()), (vec![Some(false)], "Stefan|#7 Wirkung auf kc:I0048 (create) zurückgenommen".to_string()));
}

#[test]
fn rework_eintreten_setzt_den_teilbaum_rot_ausschalten_nimmt_nur_den_vermerk_zurueck() {
    let l = lage();
    l.setzen(serde_json::json!({"application": "kc", "action": "rework", "node": "D0002"})).unwrap();
    l.schalten(0, true).unwrap();
    let rot = ["rot", "rot", "rot", "rot", "rot", "gruen", "gruen", "gelb"];
    assert_eq!(["D0002", "I0014", "B0001", "I0047", "B0002", "D0001", "I0001", "A0001"].map(|id| l.status(id)), rot);
    assert_eq!(l.eingetreten(), [Some(true)]);
    l.schalten(0, false).unwrap();
    assert_eq!(["D0002", "I0014", "B0001", "I0047", "B0002", "D0001", "I0001", "A0001"].map(|id| l.status(id)), rot, "die Status bleiben");
    assert!(l.aufgabe().contains("{application: kc, action: rework, node: D0002, executed: false}"));
    assert_eq!(l.eingetreten(), [Some(false)]);
}

#[test]
fn remove_eintreten_verwirft_ausschalten_hebt_das_verwerfen_auf() {
    let l = lage();
    l.setzen(serde_json::json!({"application": "kc", "action": "remove", "node": "I0014"})).unwrap();
    l.schalten(0, true).unwrap();
    assert_eq!(["I0014", "B0001", "I0047"].map(|id| l.status(id)), ["verworfen", "verworfen", "gruen"]);
    assert!(l.plan().contains("| verworfen: #7 Dialog Export bauen |"));
    assert_eq!(l.eingetreten(), [Some(true)]);
    l.schalten(0, false).unwrap();
    assert_eq!(["I0014", "B0001", "D0002"].map(|id| l.status(id)), ["rot", "rot", "gelb"], "Blätter rot, darüber gerechnet");
    assert!(!l.plan().contains("verworfen: #7"), "der Grund ist aus der Notiz");
    assert_eq!(l.eingetreten(), [Some(false)]);
}

#[test]
fn der_eintritt_folgt_der_wbs_auch_nach_einer_aenderung_von_hand() {
    let l = lage();
    l.setzen(serde_json::json!({"application": "kc", "action": "remove", "node": "I0014"})).unwrap();
    l.kanban.wbs_verwerfen("kc", "I0014", "von Hand").unwrap();
    assert_eq!(l.eingetreten(), [Some(true)], "verworfen, gleich von wem");
    let vorher = l.commits(l.board.path());
    l.schalten(0, true).unwrap();
    assert_eq!(l.commits(l.board.path()), vorher, "schon eingetreten: nichts geändert");
    std::fs::remove_file(l.arbeit.join("Dokumentation/Planung/kasse.md")).unwrap();
    assert_eq!(l.eingetreten(), [None], "WBS nicht lesbar");
    assert!(matches!(l.schalten(0, false), Err(Fehler::Konflikt(m)) if m.contains("nicht erreichbar")));
}

#[test]
fn wirkungen_aus_der_zeit_vor_r00071_gelten_als_eingetreten() {
    let l = lage();
    std::fs::write(l.board.path().join("aufgaben/0007-dialog-export-bauen.md"), "---\nid: 7\ntitle: Dialog Export bauen\nwbs-effects:\n  - {application: kc, action: rework, node: D0002}\n---\n").unwrap();
    assert_eq!(l.eingetreten(), [Some(true)]);
    let vorher = l.plan();
    l.schalten(0, false).unwrap();
    assert_eq!(l.plan(), vorher);
    assert!(l.aufgabe().contains("{application: kc, action: rework, node: D0002, executed: false}"));
}

#[test]
fn vermerken_prueft_gegen_die_wbs_und_aendert_bei_fehlern_nichts() {
    let l = lage();
    let (aufgabe_vorher, commits_vorher) = (l.aufgabe(), l.commits(l.board.path()));
    let f = l.setzen(serde_json::json!({"application": "kc", "action": "rework", "node": "D0099"})).unwrap_err();
    assert_eq!(f, Fehler::Konflikt("Knoten „D0099“ steht nicht in der WBS".into()));
    for json in [serde_json::json!({"action": "rework", "node": "D0002"}), serde_json::json!({"application": "kc", "action": "create", "parent": "D0002", "level": "Interaction", "name": "X"}), serde_json::json!({"application": "kc", "action": "create", "parent": "D0002", "level": "Bubble", "name": "X", "done_criterion": "Test gruen"})] {
        assert!(matches!(l.setzen(json.clone()), Err(Fehler::Ungueltig(_))), "{json}");
    }
    let wer = l.kanban.handelnder(Some("st")).unwrap();
    assert!(matches!(l.kanban.wirkung_setzen(&wer, 99, &serde_json::from_value(serde_json::json!({"application": "kc", "action": "rework", "node": "D0002"})).unwrap()), Err(Fehler::NichtGefunden(_))), "unbekannte Aufgabe");
    std::fs::write(l.arbeit.join("Dokumentation/Planung/kasse.md"), "# kaputt\n").unwrap();
    assert!(matches!(l.setzen(serde_json::json!({"application": "kc", "action": "remove", "node": "I0014"})), Err(Fehler::Konflikt(m)) if m.contains("defekt")));
    std::fs::remove_file(l.arbeit.join("Dokumentation/Planung/kasse.md")).unwrap();
    assert!(matches!(l.setzen(serde_json::json!({"application": "kc", "action": "rework", "node": "D0002"})), Err(Fehler::Konflikt(m)) if m.contains("nicht erreichbar")));
    assert_eq!((l.aufgabe(), l.commits(l.board.path())), (aufgabe_vorher, commits_vorher), "Aufgabendatei unverändert, kein Commit");
}

#[tokio::test]
async fn ueber_die_api_vermerken_stand_lesen_schalten_entfernen() {
    let l = lage();
    let lauf = gemeinsam::starten(l.board.path(), &["--port", "0"]);
    let pfad = "api/aufgaben/7/wbs-effects";
    let (s, a) = gemeinsam::senden(reqwest::Method::PATCH, &lauf.adresse, pfad, "st", json(EXPORT)).await;
    assert_eq!((s, a["wirkungen"].clone()), (200, serde_json::json!([{"application": "kc", "action": "create", "parent": "D0002", "level": "Interaction", "name": "Export", "done_criterion": "US-1", "executed": false}])));
    let (s, stand) = gemeinsam::senden(reqwest::Method::GET, &lauf.adresse, pfad, "st", serde_json::Value::Null).await;
    assert_eq!((s, stand[0]["i"].clone(), stand[0]["eingetreten"].clone()), (200, serde_json::json!(0), serde_json::json!(false)));
    let (s, a) = gemeinsam::senden(reqwest::Method::POST, &lauf.adresse, "api/aufgaben/7/wbs-effects/0/eintritt", "st", serde_json::json!({"an": true})).await;
    assert_eq!((s, a["wirkungen"][0]["node"].as_str()), (200, Some("I0048")));
    let (_, stand) = gemeinsam::senden(reqwest::Method::GET, &lauf.adresse, pfad, "st", serde_json::Value::Null).await;
    assert_eq!(stand[0]["eingetreten"], true);
    let (s, r) = gemeinsam::senden(reqwest::Method::POST, &lauf.adresse, "api/aufgaben/7/wbs-effects/5/eintritt", "st", serde_json::json!({"an": true})).await;
    assert_eq!(s, 404, "{r}");
    let (s, r) = gemeinsam::senden(reqwest::Method::PATCH, &lauf.adresse, pfad, "st", serde_json::json!({"application": "kc", "action": "rework", "node": "D0099"})).await;
    assert_eq!((s, r["fehler"].as_str()), (409, Some("Knoten „D0099“ steht nicht in der WBS")));
    let ohne = reqwest::Client::new().post(format!("{}api/aufgaben/7/wbs-effects/0/eintritt", lauf.adresse)).json(&serde_json::json!({"an": false})).send().await.unwrap();
    assert_eq!(ohne.status().as_u16(), 400, "Identität Pflicht");
    let plan_vorher = l.plan();
    let (s, a) = gemeinsam::senden(reqwest::Method::DELETE, &lauf.adresse, "api/aufgaben/7/wbs-effects/0", "st", serde_json::Value::Null).await;
    assert_eq!((s, a["wirkungen"].clone()), (200, serde_json::json!([])));
    assert_eq!(l.plan(), plan_vorher, "I0048 bleibt in der WBS");
    assert_eq!(git(l.board.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#7 Wirkung auf kc:I0048 (create) entfernt");
}

#[test]
fn gleichzeitige_eintritte_gehen_nacheinander_ohne_verklemmung_mit_direkten_wbs_schreibzugriffen() {
    let l = std::sync::Arc::new(lage());
    for n in [0, 2, 4] {
        l.setzen(serde_json::json!({"application": "kc", "action": "create", "parent": "D0001", "level": "Interaction", "name": format!("N{n}"), "done_criterion": "US-1"})).unwrap();
    }
    let faeden: Vec<_> = (0..6)
        .map(|n| {
            let l = l.clone();
            std::thread::spawn(move || {
                if n % 2 == 0 {
                    l.schalten(n / 2, true).map(|_| ()).unwrap();
                } else {
                    l.kanban.wbs_status_setzen("kc", "B0002", if n == 1 { "gelb" } else { "gruen" }).map(|_| ()).unwrap();
                }
            })
        })
        .collect();
    for f in faeden {
        f.join().unwrap();
    }
    let a = kanband::format::aufgabe::lesen("0007-dialog-export-bauen.md", &l.aufgabe()).unwrap();
    let mut ids: Vec<String> = a.wirkungen.iter().filter_map(|w| w.knoten.clone()).collect();
    ids.sort();
    assert_eq!(ids, ["I0048", "I0049", "I0050"], "jede Wirkung mit eigener ID, keine verloren");
    assert_eq!(ids.iter().filter(|id| l.status(id) == "rot").count(), 3);
}

#[test]
fn defekte_aufgabe_ist_423_und_die_wbs_bleibt_unberuehrt() {
    let l = lage();
    std::fs::write(l.board.path().join("aufgaben/0007-dialog-export-bauen.md"), "---\nid: 7\ntitle: X\nwbs-effects: [{action: grow}]\n---\n").unwrap();
    let vorher = l.plan();
    assert!(matches!(l.setzen(serde_json::json!({"application": "kc", "action": "rework", "node": "D0002"})), Err(Fehler::Defekt(m)) if m.contains("wbs-effects[0]")));
    assert_eq!(l.plan(), vorher);
}
