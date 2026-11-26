// R00203 B0995: Ersetzen in-process — Prüfen (ohne Sperre, mit Git für `neu`) und Eintragen (unter der Sperre, ohne Git)
// einzeln aufgerufen: Prüfen-dann-Handeln deterministisch (AK 11), der mehrdeutige Präfix von `alt` (AK 8), der Zähler der
// Git-Aufrufe des Moduls Arbeits-Repository (AK 7, AK 9, AK 10).
mod gemeinsam;

use gemeinsam::{ZWEIER, git, lies, repo_mit_k3_k4};
use kanband::dienst::Kanban;
use kanband::fehler::{Fehler, Ursache};
use kanband::git::arbeitsrepo;
use serde_json::{Value, json};
use std::path::Path;

const DATEI: &str = "aufgaben/0001-a.md";

/// Board-Ordner mit `entw1` (Agent), Register `kd` auf das Arbeits-Repository `r`; #1 trägt `commits` wörtlich.
fn ordner(board: &Path, r: &Path, commits: &[String]) -> Kanban {
    std::fs::create_dir_all(board.join("aufgaben")).unwrap();
    std::fs::create_dir_all(board.join("boards")).unwrap();
    std::fs::write(board.join("kanbanD.md"), format!("---\npeople:\n  entw1: {{name: Entwickler 1, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Dokumentation/Planung/app.md, requirements: \"\"}}\n---\n", r.display())).unwrap();
    datei_schreiben(board, commits);
    std::fs::write(board.join("boards/fabrik.md"), "# Fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-a.md)\n").unwrap();
    git(board, &["init", "-q"]);
    git(board, &["add", "-A"]);
    git(board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
    Kanban::neu(board.to_path_buf())
}

fn datei_schreiben(board: &Path, commits: &[String]) {
    let liste: String = commits.iter().map(|c| format!("  - {c}\n")).collect();
    std::fs::write(board.join(DATEI), format!("---\nid: 1\ntitle: a\ncommits:\n{liste}---\n")).unwrap();
}

fn commit_zahl(board: &Path) -> u32 {
    git(board, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

fn kd(h: &str) -> String {
    format!("kd:{h}")
}

fn rumpf(paare: &[(&str, &str)]) -> Value {
    json!({"ersetzungen": paare.iter().map(|(a, n)| json!({"alt": a, "neu": n})).collect::<Vec<_>>()})
}

// AK 11 (a): zwei Läufe prüfen dasselbe Paar vor der Sperre, dann tragen beide ein — der zweite findet `alt` nicht mehr und
// `neu` schon da: erledigt, ein Eintrag, genau ein Commit
#[test]
fn zwei_gepruefte_laeufe_desselben_paares_ergeben_einen_eintrag() {
    let r = repo_mit_k3_k4();
    let tmp = tempfile::tempdir().unwrap();
    let k = ordner(tmp.path(), &r.basis.r, &[kd(&r.basis.k1), kd(&r.basis.w1)]);
    let wer = k.handelnder(Some("entw1")).unwrap();
    let aufruf = rumpf(&[(&kd(&r.basis.k1[..7]), &kd(&r.k3[..7]))]);
    let erster = k.commits_ersetzen_pruefen(1, &aufruf).unwrap();
    let zweiter = k.commits_ersetzen_pruefen(1, &aufruf).unwrap();
    let n = commit_zahl(tmp.path());

    k.commits_ersetzen_eintragen(&wer, 1, &erster).unwrap();
    let a = k.commits_ersetzen_eintragen(&wer, 1, &zweiter).unwrap();

    assert_eq!(a.commits, [kd(&r.k3), kd(&r.basis.w1)]);
    assert_eq!(commit_zahl(tmp.path()), n + 1);
    assert_eq!(lies(tmp.path(), DATEI).matches(&r.k3).count(), 1);
}

// AK 11 (b): zwischen Prüfung und Sperre hat ein anderer Lauf `K1 → K4` geschrieben — `K1 → K3` ist unter der Sperre ein
// 404 ohne Commit, die Karte trägt K4 an Platz 1, nicht K3
#[test]
fn zwischen_pruefung_und_sperre_geaendert_ergibt_404_unter_der_sperre() {
    let r = repo_mit_k3_k4();
    let tmp = tempfile::tempdir().unwrap();
    let k = ordner(tmp.path(), &r.basis.r, &[kd(&r.basis.k1), kd(&r.basis.w1)]);
    let wer = k.handelnder(Some("entw1")).unwrap();
    let geprueft = k.commits_ersetzen_pruefen(1, &rumpf(&[(&kd(&r.basis.k1), &kd(&r.k3))])).unwrap();
    k.commits_ersetzen(&wer, 1, &rumpf(&[(&kd(&r.basis.k1), &kd(&r.k4))])).unwrap();
    let (n, vorher) = (commit_zahl(tmp.path()), lies(tmp.path(), DATEI));

    let f = k.commits_ersetzen_eintragen(&wer, 1, &geprueft).unwrap_err();

    assert!(matches!(&f, Fehler::Verweis { verweis, fehlt: true, .. } | Fehler::Inhalt { verweis: Some(verweis), ursache: Ursache::Fehlt, .. } if *verweis == kd(&r.basis.k1)), "{f:?}");
    assert_eq!((commit_zahl(tmp.path()), lies(tmp.path(), DATEI)), (n, vorher));
    assert_eq!(k.ordner().aufgabe(1).unwrap().commits, [kd(&r.k4), kd(&r.basis.w1)]);
}

// AK 11 (c): schreibt ein anderer Lauf zwischen Prüfung und Sperre `neu` selbst an die Karte, ist das unter der Sperre ein 409
#[test]
fn zwischen_pruefung_und_sperre_neu_angekommen_ergibt_409_unter_der_sperre() {
    let r = repo_mit_k3_k4();
    let tmp = tempfile::tempdir().unwrap();
    let k = ordner(tmp.path(), &r.basis.r, &[kd(&r.basis.k1)]);
    let wer = k.handelnder(Some("entw1")).unwrap();
    let geprueft = k.commits_ersetzen_pruefen(1, &rumpf(&[(&kd(&r.basis.k1), &kd(&r.k3))])).unwrap();
    k.commits_hinterlegen(&wer, 1, &json!({"commits": [kd(&r.k3)]})).unwrap();
    let (n, vorher) = (commit_zahl(tmp.path()), lies(tmp.path(), DATEI));

    let f = k.commits_ersetzen_eintragen(&wer, 1, &geprueft).unwrap_err();

    assert!(matches!(&f, Fehler::VerweisKonflikt { verweis, .. } | Fehler::Inhalt { verweis: Some(verweis), ursache: Ursache::Konflikt, .. } if *verweis == kd(&r.basis.k1)), "{f:?}");
    assert_eq!((commit_zahl(tmp.path()), lies(tmp.path(), DATEI)), (n, vorher));
}

// AK 8: ein Präfix von `alt`, der an der Karte zu zwei Verweisen passt (zwei Commits mit demselben 7er-Anfang) → 400
#[test]
fn mehrdeutiger_praefix_von_alt_ist_400_ohne_git() {
    let r = repo_mit_k3_k4();
    let tmp = tempfile::tempdir().unwrap();
    let k = ordner(tmp.path(), &r.basis.r, &[kd(ZWEIER[0]), kd(ZWEIER[1]), kd(&r.basis.k1)]);
    let (n, vorher, git_vorher) = (commit_zahl(tmp.path()), lies(tmp.path(), DATEI), arbeitsrepo::aufrufe());

    let f = k.commits_ersetzen_pruefen(1, &rumpf(&[(&kd(&ZWEIER[0][..7]), &kd(&r.k3))])).unwrap_err();
    assert!(matches!(&f, Fehler::Verweis { verweis, fehlt: false, .. } | Fehler::Inhalt { verweis: Some(verweis), ursache: Ursache::Eingabe, .. } if *verweis == kd(&ZWEIER[0][..7])), "{f:?}");
    // ein längerer Präfix unterscheidet sie
    let plan = k.commits_ersetzen_pruefen(1, &rumpf(&[(&kd(&ZWEIER[0][..10]), &kd(&r.k3))]));
    assert!(plan.is_ok(), "{plan:?}");
    assert_eq!((commit_zahl(tmp.path()), lies(tmp.path(), DATEI)), (n, vorher));
    assert_eq!(arbeitsrepo::aufrufe(), git_vorher + 2, "nur der zweite Aufruf fragte Git (Wurzel und ein rev-parse)");
}

// Lastprofil (AK 7, 9, 10): Git fragt nur `neu` der offenen Paare — nie `alt`, nie ein erledigtes Paar, nie bei Fehlern
// der Form, der Zahl oder der Karte
#[test]
fn git_wird_nur_fuer_neu_der_offenen_paare_gefragt() {
    let r = repo_mit_k3_k4();
    let tmp = tempfile::tempdir().unwrap();
    let k = ordner(tmp.path(), &r.basis.r, &[kd(&r.basis.k1), kd(&r.basis.w1), kd(&r.k3)]);
    let (k1, w1, k2, k3, k4) = (kd(&r.basis.k1), kd(&r.basis.w1), kd(&r.basis.k2), kd(&r.k3), kd(&r.k4));
    let git_zaehler = arbeitsrepo::aufrufe;
    let vorher = git_zaehler();

    // erledigtes Paar (alt fehlt, neu da) neben einem offenen: Wurzel einmal, ein rev-parse für das offene
    k.commits_ersetzen_pruefen(1, &rumpf(&[(&k2, &k3), (&w1, &k4)])).unwrap();
    assert_eq!(git_zaehler(), vorher + 2);

    // nur erledigte Paare: gar kein Git
    k.commits_ersetzen_pruefen(1, &rumpf(&[(&k2, &k3)])).unwrap();
    assert_eq!(git_zaehler(), vorher + 2);

    // Fehler der Form, der Karte (404, 409), der Zahl: kein Git, auch wenn ein anderes Paar gültig wäre
    for paare in [vec![(w1.as_str(), k4.as_str()), (k1.as_str(), "kd:main")], vec![(w1.as_str(), k4.as_str()), (k2.as_str(), k4.as_str())], vec![(w1.as_str(), k4.as_str()), (k1.as_str(), k3.as_str())], vec![(w1.as_str(), k1.as_str())]] {
        k.commits_ersetzen_pruefen(1, &rumpf(&paare)).unwrap_err();
        assert_eq!(git_zaehler(), vorher + 2, "{paare:?}");
    }
    let viele: Vec<(String, String)> = (0..501).map(|i| (format!("kd:{i:040x}"), format!("kd:{:040x}", i + 10_000))).collect();
    let borgt: Vec<(&str, &str)> = viele.iter().map(|(a, n)| (a.as_str(), n.as_str())).collect();
    k.commits_ersetzen_pruefen(1, &rumpf(&borgt)).unwrap_err();
    assert_eq!(git_zaehler(), vorher + 2, "501 Paare");
}

// AK 4: ein erledigtes Paar fragt R nie — auch nicht, wenn R fehlt; ein offenes Paar nennt das fehlende Repository
#[test]
fn erledigt_ohne_repository_offen_mit_400() {
    let r = repo_mit_k3_k4();
    let tmp = tempfile::tempdir().unwrap();
    let k = ordner(tmp.path(), &r.basis.r, &[kd(&r.k3), kd(&r.basis.w1)]);
    let wer = k.handelnder(Some("entw1")).unwrap();
    std::fs::rename(&r.basis.r, r.basis.r.with_file_name("R-weg")).unwrap();
    let n = commit_zahl(tmp.path());

    let a = k.commits_ersetzen(&wer, 1, &rumpf(&[(&kd(&r.basis.k1), &kd(&r.k3))])).unwrap();
    assert_eq!((a.commits, commit_zahl(tmp.path())), (vec![kd(&r.k3), kd(&r.basis.w1)], n));

    let f = k.commits_ersetzen(&wer, 1, &rumpf(&[(&kd(&r.basis.w1), &kd(&r.k4))])).unwrap_err();
    assert!(matches!(&f, Fehler::Verweis { meldung, verweis, fehlt: false } if meldung.contains("fehlt") && *verweis == kd(&r.k4)), "{f:?}");
}
