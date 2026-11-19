// R00202 B0992: die Zwischenstufen des Hinterlegens in-process — Prüfen (ohne Sperre, mit Git) und Eintragen (unter der
// Sperre, ohne Git) einzeln aufgerufen, dazu der Zähler der Git-Aufrufe des Moduls Arbeits-Repository (AK 6, AK 10).
mod gemeinsam;

use gemeinsam::{git, lies, repo};
use kanband::dienst::Kanban;
use kanband::fehler::Fehler;
use kanband::git::arbeitsrepo;
use serde_json::json;
use std::path::Path;

/// Board-Ordner mit `entwickler` (Agent), Register `kd` auf das Arbeits-Repository `r`, #1 ohne Verweise.
fn ordner(board: &Path, r: &Path) -> Kanban {
    std::fs::create_dir_all(board.join("aufgaben")).unwrap();
    std::fs::create_dir_all(board.join("boards")).unwrap();
    std::fs::write(board.join("kanbanD.md"), format!("---\npeople:\n  entwickler: {{name: Entwickler, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Dokumentation/Planung/app.md, requirements: \"\"}}\n---\n", r.display())).unwrap();
    std::fs::write(board.join("aufgaben/0001-a.md"), "---\nid: 1\ntitle: a\n---\n").unwrap();
    std::fs::write(board.join("boards/fabrik.md"), "# Fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-a.md)\n").unwrap();
    git(board, &["init", "-q"]);
    git(board, &["add", "-A"]);
    git(board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
    Kanban::neu(board.to_path_buf())
}

fn commit_zahl(board: &Path) -> u32 {
    git(board, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

// Prüfen-dann-Handeln deterministisch: zwei Läufe prüfen denselben Verweis vor der Sperre, dann tragen beide ein — der
// zweite findet ihn in der frisch gelesenen Datei und schreibt nichts (ein Eintrag, ein Commit)
#[test]
fn zwei_gepruefte_laeufe_desselben_verweises_ergeben_einen_eintrag() {
    let r = repo();
    let tmp = tempfile::tempdir().unwrap();
    let k = ordner(tmp.path(), &r.r);
    let wer = k.handelnder(Some("entwickler")).unwrap();
    let rumpf = json!({"commits": [format!("kd:{}", &r.k1[..7])]});
    let erster = k.commits_pruefen(1, &rumpf).unwrap();
    let zweiter = k.commits_pruefen(1, &rumpf).unwrap();
    assert_eq!(erster, [format!("kd:{}", r.k1)]);
    let n = commit_zahl(tmp.path());

    k.commits_eintragen(&wer, 1, &erster).unwrap();
    let a = k.commits_eintragen(&wer, 1, &zweiter).unwrap();
    assert_eq!(a.commits, [format!("kd:{}", r.k1)]);
    assert_eq!(commit_zahl(tmp.path()), n + 1);
    assert_eq!(lies(tmp.path(), "aufgaben/0001-a.md").matches(&r.k1).count(), 1);
}

// Prüfen-dann-Handeln für die Höchstzahl: zwischen Prüfung und Eintragen füllt ein anderer Lauf die Aufgabe auf 500 —
// das Eintragen sieht es unter der Sperre und schreibt nichts
#[test]
fn hoechstzahl_wird_unter_der_sperre_erneut_geprueft() {
    let r = repo();
    let tmp = tempfile::tempdir().unwrap();
    let k = ordner(tmp.path(), &r.r);
    let wer = k.handelnder(Some("entwickler")).unwrap();
    let geprueft = k.commits_pruefen(1, &json!({"commits": [format!("kd:{}", r.k1)]})).unwrap();
    let fremde: String = (0..500).map(|i| format!("  - kd:{i:040x}\n")).collect();
    std::fs::write(tmp.path().join("aufgaben/0001-a.md"), format!("---\nid: 1\ntitle: a\ncommits:\n{fremde}---\n")).unwrap();
    let vorher = lies(tmp.path(), "aufgaben/0001-a.md");

    assert!(matches!(k.commits_eintragen(&wer, 1, &geprueft), Err(Fehler::Konflikt(_))));
    assert_eq!(lies(tmp.path(), "aufgaben/0001-a.md"), vorher);
}

// AK 6: was die Form verletzt, startet keinen Git-Prozess — auch hinter einem gültigen Verweis in derselben Liste
#[test]
fn formfehler_starten_kein_git() {
    let r = repo();
    let tmp = tempfile::tempdir().unwrap();
    let k = ordner(tmp.path(), &r.r);
    for boese in ["kd:--output=x", "kd:../x", "kd:3f2a9c1;rm -rf x", "kd:3f2a9c1 --all", "kd:3f2a 9c1", "kd:$(touch x)", "kd:3f2a9c1^{tree}", "xy:3f2a9c1"] {
        let vorher = arbeitsrepo::aufrufe();
        let f = k.commits_pruefen(1, &json!({"commits": [format!("kd:{}", r.k1), boese]})).unwrap_err();
        assert!(matches!(&f, Fehler::Verweis { verweis, fehlt: false, .. } if verweis == boese), "{boese}: {f:?}");
        assert_eq!(arbeitsrepo::aufrufe(), vorher, "{boese}: Git gestartet");
    }
}

// AK 10: Lesen der Aufgabe und des Zustands startet keinen Git-Prozess im Arbeits-Repository
#[test]
fn lesen_startet_kein_git_im_arbeits_repository() {
    let r = repo();
    let tmp = tempfile::tempdir().unwrap();
    let k = ordner(tmp.path(), &r.r);
    let wer = k.handelnder(Some("entwickler")).unwrap();
    k.commits_hinterlegen(&wer, 1, &json!({"commits": [format!("kd:{}", r.k1)]})).unwrap();
    let vorher = arbeitsrepo::aufrufe();
    assert_eq!(k.ordner().aufgabe(1).unwrap().commits, [format!("kd:{}", r.k1)]);
    k.zustand().unwrap();
    assert_eq!(arbeitsrepo::aufrufe(), vorher);
}
