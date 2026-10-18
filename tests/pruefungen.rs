//! R00059: Plausibilitätsprüfung je Spalte — der Zug wird immer ausgeführt, die Antwort warnt.
mod gemeinsam;

use gemeinsam::{arbeits_repository, git, lies, senden};
use reqwest::Method;
use serde_json::json;
use std::path::Path;

const KOPF: &str = "---\napplication: Kasse\n---\n\n| ID | Ebene | Eltern | Name | Status |\n|---|---|---|---|---|\n";

fn wbs(i0048: &str) -> String {
    format!("{KOPF}| A0001 | Application | — | Kasse | rot |\n| D0002 | Dialog | A0001 | Board | rot |\n| I0048 | Interaction | D0002 | Export | {i0048} |\n| I0012 | Interaction | D0002 | Import | gruen |\n")
}

const BOARD: &str = "---\ncolumn-phases:\n  Entwicklung: Entwicklung\n  Entwicklertest: Entwicklertest\n  Abnahme: Abnahme\ncolumn-checks:\n  Entwicklung: [wbs-effects-green]\n---\n\n# Entwicklung\n\n## Backlog\n\n## Entwicklung\n\n- [#7](../aufgaben/0007-export.md)\n- [#8](../aufgaben/0008-import.md)\n\n## Entwicklertest\n\n## Abnahme\n\n## Erledigt\n";

struct Lage {
    _arbeit_tmp: tempfile::TempDir,
    arbeit: std::path::PathBuf,
    board: tempfile::TempDir,
}

/// #7 legt I0048 an (Status nach Wahl), #8 überarbeitet I0012 (grün); Entwicklung prüft `wbs-effects-green`.
fn lage(i0048: &str, board: &str) -> Lage {
    let (_arbeit_tmp, arbeit) = arbeits_repository(&wbs(i0048));
    let b = tempfile::tempdir().unwrap();
    gemeinsam::mit_register(b.path(), &arbeit);
    std::fs::create_dir_all(b.path().join("aufgaben")).unwrap();
    std::fs::write(b.path().join("aufgaben/0007-export.md"), "---\nid: 7\ntitle: Export\nwbs-effects:\n  - {application: kc, action: create, node: I0048}\n  - {application: kc, action: remove, node: I0099}\n---\n").unwrap();
    std::fs::write(b.path().join("aufgaben/0008-import.md"), "---\nid: 8\ntitle: Import\nwbs-effects:\n  - {application: kc, action: rework, node: I0012}\n---\n").unwrap();
    std::fs::write(b.path().join("boards/entwicklung.md"), board).unwrap();
    git(b.path(), &["add", "-A"]);
    git(b.path(), &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-m", "Lage"]);
    Lage { _arbeit_tmp, arbeit, board: b }
}

fn commits(repo: &Path) -> String {
    git(repo, &["rev-list", "--count", "HEAD"])
}

async fn ziehen(adresse: &str, nummer: u32, spalte: &str) -> serde_json::Value {
    let (s, r) = senden(Method::POST, adresse, "api/boards/entwicklung/bewegen", "cl", json!({"nummer": nummer, "spalte": spalte})).await;
    assert_eq!(s, 200, "{r}");
    r
}

#[tokio::test]
async fn zug_nach_rechts_mit_rotem_knoten_wird_committet_und_warnt() {
    let l = lage("rot", BOARD);
    let lauf = gemeinsam::starten(l.board.path(), &["--port", "0"]);
    let vorher = commits(l.board.path());
    let r = ziehen(&lauf.adresse, 7, "Entwicklertest").await;
    assert_eq!(r["bewegt"], true);
    assert_eq!(r["warnungen"], json!([{"pruefung": "wbs-effects-green", "text": "Achtung! Es sind nicht alle abhängigen WBS-Einträge grün.", "knoten": ["kc:I0048"], "details": ["kc:I0048 rot"]}]));
    assert_eq!(commits(l.board.path()).parse::<u32>().unwrap(), vorher.parse::<u32>().unwrap() + 1, "ein Commit trotz Warnung");
    assert!(lies(l.board.path(), "boards/entwicklung.md").contains("column-checks:\n  Entwicklung: [wbs-effects-green]\n"), "Bewegen erhält den Schlüssel");
    assert_eq!(git(&l.arbeit, &["status", "--porcelain"]), "", "die WBS bleibt unberührt");
}

#[tokio::test]
async fn gruene_knoten_nach_links_und_ohne_pruefung_warnen_nie() {
    let l = lage("rot", BOARD);
    let lauf = gemeinsam::starten(l.board.path(), &["--port", "0"]);
    assert_eq!(ziehen(&lauf.adresse, 8, "Erledigt").await["warnungen"], json!([]), "rework auf grünem Knoten");
    ziehen(&lauf.adresse, 7, "Entwicklertest").await;
    assert_eq!(ziehen(&lauf.adresse, 7, "Entwicklung").await["warnungen"], json!([]), "nach links");
    assert_eq!(ziehen(&lauf.adresse, 7, "Backlog").await["warnungen"], json!([]));
    let ohne = lage("rot", &BOARD.replace("column-checks:\n  Entwicklung: [wbs-effects-green]\n", ""));
    let lauf = gemeinsam::starten(ohne.board.path(), &["--port", "0"]);
    assert_eq!(ziehen(&lauf.adresse, 7, "Erledigt").await["warnungen"], json!([]), "Board ohne column-checks");
}

#[tokio::test]
async fn unerreichbare_wbs_und_fehlender_knoten_warnen_mit_eigenem_text() {
    let l = lage("rot", BOARD);
    std::fs::write(l.arbeit.join("Dokumentation/Planung/kasse.md"), format!("{KOPF}| A0001 | Application | — | Kasse | rot |\n| I0012 | Interaction | A0001 | Import | gruen |\n")).unwrap();
    let lauf = gemeinsam::starten(l.board.path(), &["--port", "0"]);
    assert_eq!(ziehen(&lauf.adresse, 7, "Entwicklertest").await["warnungen"][0]["details"], json!(["kc:I0048 Knoten fehlt"]));
    std::fs::remove_file(l.arbeit.join("Dokumentation/Planung/kasse.md")).unwrap();
    let r = ziehen(&lauf.adresse, 8, "Erledigt").await;
    assert_eq!((r["bewegt"].clone(), r["warnungen"][0]["details"].clone()), (json!(true), json!(["kc:I0012 WBS nicht erreichbar"])), "ohne WBS ist das Board reines Kanban, gezählt nach Spaltenindex");
}
