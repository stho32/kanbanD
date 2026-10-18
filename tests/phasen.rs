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
    fremd.anwendungen = vec!["xx".into()];
    assert_eq!(l.kanban.phasenstand(&fremd), None, "genannt, aber nicht registriert");
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
    b.anwendungen = vec!["kc".into(), "kl".into()];
    let s = l.kanban.phasenstand(&b).unwrap();
    assert_eq!(s.anwendung, "kc");
    assert_eq!(s.hinweise, ["„Lager“ hat die Phasenfolge Entwicklung → Review → Abnahme — es gilt die von „Kasse“: Entwicklung → Entwicklertest → Abnahme"]);
}
