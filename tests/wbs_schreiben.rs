//! R00055/R00056: kanbanD schreibt die WBS im Arbeits-Repository einer Anwendung — und committet dort nie.
mod gemeinsam;

use gemeinsam::git;
use kanband::dienst::Kanban;
use std::path::{Path, PathBuf};

const KOPF: &str = "---\napplication: Kasse\nzuletzt: 2026-01-01\n---\n\n# WBS\n\n| ID | Ebene | Eltern | Name | Status | Fertig-Kriterium | Eingabe → Ausgabe | Aufwand | Ausbaustufe | Braucht | Requirement | Notiz | Phase |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n";

/// `(id, ebene, eltern, status)` als Zeilen der Knotentabelle, mit einem maskierten Strich und einer fremden Spalte.
fn wbs(zeilen: &[(&str, &str, &str, &str)]) -> String {
    KOPF.to_string() + &zeilen.iter().map(|(id, ebene, eltern, status)| format!("| {id} | {ebene} | {eltern} | Name {id} | {status} | Test gruen | a \\| b → c | 0,5-1 |  |  |  |  | Abnahme |\n")).collect::<String>()
}

/// Ein Arbeits-Repository getrennt vom kanbanD-Ordner, WBS committet.
fn arbeits_repository(text: &str) -> (tempfile::TempDir, PathBuf) {
    let t = tempfile::tempdir().unwrap();
    let wurzel = t.path().canonicalize().unwrap();
    std::fs::create_dir_all(wurzel.join("Dokumentation/Planung")).unwrap();
    std::fs::write(wurzel.join("Dokumentation/Planung/kasse.md"), text).unwrap();
    git(&wurzel, &["init", "-q"]);
    git(&wurzel, &["add", "-A"]);
    git(&wurzel, &["-c", "user.name=KI", "-c", "user.email=k@k", "commit", "-q", "-m", "WBS"]);
    (t, wurzel)
}

fn mit_register(ordner: &Path, arbeit: &Path) {
    gemeinsam::eingerichtet(ordner);
    let kanban = format!("---\npeople:\n  st: {{name: Stefan, kind: human}}\n  cl: {{name: Claude, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kc: {{name: Kasse, wbs: {}/Dokumentation/Planung/kasse.md, requirements: \"\"}}\n---\n", arbeit.display());
    std::fs::write(ordner.join("kanbanD.md"), kanban).unwrap();
    git(ordner, &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-am", "Register"]);
}

fn plan(arbeit: &Path) -> String {
    gemeinsam::lies(arbeit, "Dokumentation/Planung/kasse.md")
}

/// I0002 mit acht Bubbles, alle rot.
fn acht_bubbles() -> String {
    let mut z = vec![("A0001", "Application", "—", "rot"), ("D0001", "Dialog", "A0001", "rot"), ("I0002", "Interaction", "D0001", "rot")];
    const IDS: [&str; 8] = ["B0001", "B0002", "B0003", "B0004", "B0005", "B0006", "B0007", "B0008"];
    z.extend(IDS.iter().map(|id| (*id, "Bubble", "I0002", "rot")));
    wbs(&z)
}

#[test]
fn gleichzeitige_schreibzugriffe_auf_dieselbe_wbs_gehen_nacheinander_und_nichts_wird_committet() {
    let (_a, arbeit) = arbeits_repository(&acht_bubbles());
    let tmp = tempfile::tempdir().unwrap();
    mit_register(tmp.path(), &arbeit);
    let kanban = std::sync::Arc::new(Kanban::neu(tmp.path().to_path_buf()));
    let commits_arbeit = git(&arbeit, &["rev-list", "--count", "HEAD"]);
    let commits_board = git(tmp.path(), &["rev-list", "--count", "HEAD"]);
    let faeden: Vec<_> = (1..=8)
        .map(|n| {
            let k = kanban.clone();
            std::thread::spawn(move || {
                let st = k.handelnder(Some("st")).unwrap();
                k.wbs_status_setzen(&st, "kc", &format!("B000{n}"), "gruen").unwrap()
            })
        })
        .collect();
    for f in faeden {
        f.join().unwrap();
    }
    let text = plan(&arbeit);
    let heute = kanband::uhr::heute();
    let erwartet = acht_bubbles().replace("| rot |", "| gruen |").replace("zuletzt: 2026-01-01", &format!("zuletzt: {heute}"));
    assert_eq!(text, erwartet, "keine Änderung verloren, I0002, D0001 und A0001 gerechnet gruen, alles andere byte-gleich");
    assert_eq!((git(&arbeit, &["rev-list", "--count", "HEAD"]), git(tmp.path(), &["rev-list", "--count", "HEAD"])), (commits_arbeit, commits_board), "kein Commit, weder im Arbeits- noch im Board-Repository");
    assert_eq!(git(&arbeit, &["status", "--porcelain"]), "M Dokumentation/Planung/kasse.md");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "");
}
