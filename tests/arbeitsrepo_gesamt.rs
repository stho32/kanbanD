// R00208 B1026 (ADR-0032 N6.1–N6.5): Spanne und Namenslauf des Gesamt-Diffs gegen ein echtes Wegwerf-Repository —
// K1, fremd F, ein fremder Merge MF mit Seitenzweig, K2.
mod gemeinsam;

use gemeinsam::git_am;
use kanband::git::arbeitsrepo::{self, Vergleich, Vielart};
use kanband::modell::{Einteilung, Grund, namen_lesen, spanne_lesen};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

const DATUM: &str = "2026-05-01T09:00:00+00:00";

fn frist() -> Instant {
    Instant::now() + Duration::from_secs(10)
}

fn commit(r: &Path, datei: &str, inhalt: &str, nachricht: &str) -> String {
    std::fs::write(r.join(datei), inhalt).unwrap();
    git_am(r, "A", DATUM, &["add", "-A"]);
    git_am(r, "A", DATUM, &["commit", "-q", "-m", nachricht]);
    git_am(r, "A", DATUM, &["rev-parse", "HEAD"])
}

struct Lage {
    _tmp: tempfile::TempDir,
    r: PathBuf,
    a0: String,
    k1: String,
    f: String,
    mf: String,
    k2: String,
}

/// A0 (a.txt), K1 (a.txt, k.txt), F (fremd: f.txt), MF (fremder Merge eines Seitenzweigs, der m.txt anlegt), K2 (a.txt).
fn lage() -> Lage {
    let tmp = tempfile::tempdir().unwrap();
    let r = tmp.path().canonicalize().unwrap().join("R");
    std::fs::create_dir_all(&r).unwrap();
    git_am(&r, "A", DATUM, &["init", "-q", "-b", "main"]);
    let a0 = commit(&r, "a.txt", "1\n2\n3\n", "A0");
    std::fs::write(r.join("k.txt"), "k\n").unwrap();
    let k1 = commit(&r, "a.txt", "K1\n2\n3\n", "K1");
    let f = commit(&r, "f.txt", "FREMD\n", "F");
    git_am(&r, "A", DATUM, &["checkout", "-q", "-b", "seite"]);
    commit(&r, "m.txt", "FREMD-M\n", "S");
    git_am(&r, "A", DATUM, &["checkout", "-q", "main"]);
    git_am(&r, "A", DATUM, &["merge", "-q", "--no-ff", "-m", "MF", "seite"]);
    let mf = git_am(&r, "A", DATUM, &["rev-parse", "HEAD"]);
    let k2 = commit(&r, "a.txt", "K1\n2\nK2\n", "K2");
    Lage { _tmp: tmp, r, a0, k1, f, mf, k2 }
}

// ADR-0032 N6.1: die Linie vom letzten Kartencommit bis zum ältesten, Basis = sein erster Elternteil; der fremde Merge
// steht mit seinem ersten Elternteil darin, der Seitenzweig nicht
#[test]
fn spanne_im_echten_repository() {
    let l = lage();
    let karte: HashSet<&str> = [l.k1.as_str(), l.k2.as_str()].into();
    let aus = arbeitsrepo::linie(&l.r, &l.k2, 1000 + 2 + 1, frist()).unwrap();
    let s = spanne_lesen(&aus, &karte, 1003).unwrap();
    assert_eq!(s.basis.as_deref(), Some(l.a0.as_str()));
    assert_eq!(s.linie.iter().map(|p| p.commit.as_str()).collect::<Vec<_>>(), [&l.k1, &l.f, &l.mf, &l.k2].map(String::as_str));
    assert_eq!(s.linie[2].eltern.as_deref(), Some(l.f.as_str()), "erster Elternteil des Merges");
    // ein Kartencommit nicht auf der Linie (auf dem Seitenzweig): nicht linear
    let seite = git_am(&l.r, "A", DATUM, &["rev-parse", "seite"]);
    let karte: HashSet<&str> = [seite.as_str(), l.k2.as_str()].into();
    let aus = arbeitsrepo::linie(&l.r, &l.k2, 1003, frist()).unwrap();
    assert_eq!(spanne_lesen(&aus, &karte, 1003), Err(Grund::NichtLinear));
}

// ADR-0032 N6.3, N6.5: der Namenslauf über alle Commits der Spanne liefert die Pfade je Commit; der fremde Merge mit
// Elternzeile bringt m.txt nach D_fremd, ohne Elternzeile fehlte sie (Gegenprobe zum Mutanten „Merge ohne Elternzeile“)
#[test]
fn namenslauf_mit_merge() {
    let l = lage();
    let punkte = [(&l.k1, &l.a0), (&l.f, &l.k1), (&l.mf, &l.f), (&l.k2, &l.mf)];
    let vergleiche: Vec<Vergleich> = punkte.iter().map(|(c, e)| Vergleich { commit: c, eltern: Some(e) }).collect();
    let koepfe: Vec<&str> = punkte.iter().map(|(c, _)| c.as_str()).collect();
    let teil = arbeitsrepo::diff_tree_viele(&l.r, &vergleiche, Vielart::Namen, &[], 1 << 20, frist()).unwrap();
    let je = namen_lesen(&teil.ausgabe, &koepfe).unwrap();
    let e = Einteilung::aus(&je, &[l.k1.as_str(), l.k2.as_str()].into());
    let pfade = |v: &[&str]| v.iter().map(|p| p.as_bytes().to_vec()).collect::<Vec<_>>();
    assert_eq!(e.karte.iter().cloned().collect::<Vec<_>>(), pfade(&["a.txt", "k.txt"]));
    let mut fremd: Vec<Vec<u8>> = e.fremd.iter().cloned().collect();
    fremd.sort();
    assert_eq!(fremd, pfade(&["f.txt", "m.txt"]));
    // ohne Elternzeile liefert diff-tree für den Merge nichts
    let ohne: Vec<Vergleich> = vergleiche.iter().map(|v| if v.commit == l.mf.as_str() { Vergleich { commit: v.commit, eltern: None } } else { *v }).collect();
    let teil = arbeitsrepo::diff_tree_viele(&l.r, &ohne, Vielart::Namen, &[], 1 << 20, frist()).unwrap();
    let je = namen_lesen(&teil.ausgabe, &koepfe).unwrap();
    assert!(!je.contains_key(&l.mf), "Merge ohne Elternzeile: {je:?}");
}

// ADR-0032 N6.8: der Namenslauf an seiner Bytegrenze ist abgeschnitten
#[test]
fn namenslauf_an_der_grenze() {
    let l = lage();
    let vergleiche = [Vergleich { commit: &l.k1, eltern: Some(&l.a0) }, Vergleich { commit: &l.k2, eltern: Some(&l.mf) }];
    let ganz = arbeitsrepo::diff_tree_viele(&l.r, &vergleiche, Vielart::Namen, &[], 1 << 20, frist()).unwrap();
    assert!(!ganz.abgeschnitten);
    let n = ganz.ausgabe.len();
    assert!(!arbeitsrepo::diff_tree_viele(&l.r, &vergleiche, Vielart::Namen, &[], n, frist()).unwrap().abgeschnitten, "genau n");
    assert!(arbeitsrepo::diff_tree_viele(&l.r, &vergleiche, Vielart::Namen, &[], n - 1, frist()).unwrap().abgeschnitten, "n - 1");
}
