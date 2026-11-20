// R00206 B1012 (ADR-0032 Punkt 8, N4.3, N4.4): Patch holen, zuordnen und begrenzen, einzeln nachladen — der Inhalt
// eines Diffs gegen ein echtes Wegwerf-Repository.
mod gemeinsam;

use gemeinsam::git_am;
use kanband::dienst::diff::{Auswahl, Diffinhalt, Inhaltsfehler, inhalt_lesen};
use kanband::git::arbeitsrepo::{self, Vergleich};
use kanband::modell::{Diffdatei, Hinweis, patch_text};
use std::os::unix::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

const ADA: &str = "Ada Autorin";
const DATUM: &str = "2026-03-05T09:00:00+00:00";

fn neues_repo() -> (tempfile::TempDir, PathBuf) {
    let tmp = tempfile::tempdir().unwrap();
    let r = tmp.path().canonicalize().unwrap().join("R");
    std::fs::create_dir_all(&r).unwrap();
    git_am(&r, ADA, DATUM, &["init", "-q", "-b", "main"]);
    std::fs::write(r.join("basis.txt"), "b\n").unwrap();
    commit(&r, "K1");
    (tmp, r)
}

fn commit(r: &Path, nachricht: &str) -> String {
    git_am(r, ADA, DATUM, &["add", "-A"]);
    git_am(r, ADA, DATUM, &["commit", "-q", "--allow-empty", "-m", nachricht]);
    git_am(r, ADA, DATUM, &["rev-parse", "HEAD"])
}

fn lesen(r: &Path, h: &str, auswahl: Auswahl) -> Result<Diffinhalt, Inhaltsfehler> {
    let frist = Instant::now() + Duration::from_secs(10);
    let m = arbeitsrepo::metadaten(r, &[h], frist).unwrap().remove(h).unwrap();
    inhalt_lesen(r, Vergleich { eltern: m.erster_elternteil.as_deref(), commit: h }, m.dateien, auswahl, frist)
}

fn liste(r: &Path, h: &str) -> Diffinhalt {
    lesen(r, h, Auswahl::Liste).unwrap()
}

fn einzeln(r: &Path, h: &str, name: &str) -> Diffinhalt {
    lesen(r, h, Auswahl::Datei(name)).unwrap_or_else(|f| panic!("{name}: {f:?}"))
}

fn datei<'a>(i: &'a Diffinhalt, name: &str) -> &'a Diffdatei {
    i.dateien.iter().find(|d| d.name() == name).unwrap_or_else(|| panic!("{name} fehlt"))
}

fn merkmale(d: &Diffdatei) -> (bool, bool, bool) {
    (d.gross, d.nachladen, d.patch.is_some())
}

// R00206 AK 7: Grenze je Datei — 262.144 Byte Patch-Text ab `@@` sind nicht groß, 262.145 schon; eine Zeile aus 300.000
// `a` ist groß; 3.000 Zeilen nicht, 3.001 schon; eine umbenannte und geänderte große Datei bleibt `R`
#[test]
fn ak07_grenze_je_datei() {
    let (_tmp, r) = neues_repo();
    let zeilen = |n: usize| (1..=n).map(|i| format!("zeile {i:04} xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\n")).collect::<String>();
    std::fs::write(r.join("alt-gross.txt"), zeilen(8000)).unwrap();
    commit(&r, "alt");
    std::fs::write(r.join("genau.txt"), format!("{}\n", "a".repeat(262_128))).unwrap();
    std::fs::write(r.join("eins-mehr.txt"), format!("{}\n", "a".repeat(262_129))).unwrap();
    std::fs::write(r.join("lang.txt"), format!("{}\n", "a".repeat(300_000))).unwrap();
    std::fs::write(r.join("z3000.txt"), "x\n".repeat(3000)).unwrap();
    std::fs::write(r.join("z3001.txt"), "x\n".repeat(3001)).unwrap();
    // 1.600 von 8.000 Zeilen geändert: Ähnlichkeit um 80 %, aber 3.200 Zeilen über der Grenze
    let geaendert: String = zeilen(8000).lines().enumerate().map(|(i, z)| if i % 5 == 0 { format!("{z} neu\n") } else { format!("{z}\n") }).collect();
    std::fs::write(r.join("alt-gross.txt"), geaendert).unwrap();
    git_am(&r, ADA, DATUM, &["mv", "alt-gross.txt", "neu-gross.txt"]);
    let h = commit(&r, "Grenzen");
    let i = liste(&r, &h);
    let genau = datei(&i, "genau.txt");
    assert_eq!(merkmale(genau), (false, false, true));
    assert_eq!(genau.patch.as_ref().unwrap().len(), 262_144, "14 + 1 + 262.128 + 1");
    assert_eq!(merkmale(datei(&i, "eins-mehr.txt")), (true, false, false));
    assert_eq!(datei(&i, "eins-mehr.txt").plus, 1);
    assert_eq!(merkmale(datei(&i, "lang.txt")), (true, false, false), "eine Zeile, aber 300.000 Byte");
    assert_eq!(merkmale(datei(&i, "z3000.txt")), (false, false, true));
    let z = datei(&i, "z3001.txt");
    assert_eq!((merkmale(z), z.plus), ((true, false, false), 3001));
    let g = datei(&i, "neu-gross.txt");
    assert_eq!((g.status.as_str(), g.alt.as_deref(), g.aehnlichkeit.is_some(), g.gross), ("R", Some("alt-gross.txt"), true, true));
    assert!(i.hinweise.is_empty(), "gross ist ein Merkmal, kein Hinweis: {:?}", i.hinweise);
}

// R00206 AK 8: 25 Dateien zu 202.019 Byte Patch-Text — die ersten 20 mit Patch (4.040.380 Byte samt Kopfzeilen unter
// 4.194.304), 21 bis 25 `nachladen`; die Liste ist vollständig, jede der fünf einzeln ladbar
#[test]
fn ak08_summe_der_antwort() {
    let (_tmp, r) = neues_repo();
    let inhalt = format!("{}\n", "a".repeat(99)).repeat(2000);
    for i in 1..=25 {
        std::fs::write(r.join(format!("f{i:02}.txt")), &inhalt).unwrap();
    }
    let h = commit(&r, "25 Dateien");
    let i = liste(&r, &h);
    assert_eq!(i.dateien.len(), 25);
    assert!(i.dateien.iter().all(|d| (d.plus, d.minus) == (2000, 0)));
    let mit: Vec<bool> = i.dateien.iter().map(|d| d.patch.is_some()).collect();
    assert_eq!(mit, [vec![true; 20], vec![false; 5]].concat());
    assert!(i.dateien[..20].iter().all(|d| d.patch.as_ref().unwrap().len() == 202_019 && !d.nachladen));
    assert!(i.dateien[20..].iter().all(|d| d.nachladen && !d.gross));
    for n in 21..=25 {
        let e = einzeln(&r, &h, &format!("f{n:02}.txt"));
        assert_eq!(e.dateien.len(), 1);
        assert_eq!((e.dateien[0].patch.as_ref().map(String::len), e.dateien[0].nachladen), (Some(202_019), false));
    }
    let text = patch_text(&i.dateien);
    for n in 21..=25 {
        assert!(text.contains(&format!("diff --git a/f{n:02}.txt b/f{n:02}.txt\n# kanbanD: Patch fehlt (nachladen), laden mit &datei=f{n:02}.txt\n")), "f{n}");
    }
}

// R00206 AK 11: einzeln laden — groß nach der Zeilengrenze mit Patch, gelöscht über `alt`, wörtlich (`a*b.txt`), nicht
// in der Liste → fehlt; Latin-1-Namen liefern beide
#[test]
fn ak11_einzeln_laden() {
    let (_tmp, r) = neues_repo();
    std::fs::write(r.join("weg.txt"), "weg eins\nweg zwei\n").unwrap();
    commit(&r, "weg anlegen");
    std::fs::write(r.join("gross.txt"), format!("{}\n", "x".repeat(50)).repeat(3001)).unwrap();
    std::fs::write(r.join("klein.txt"), "k\n").unwrap();
    std::fs::write(r.join("a*b.txt"), "s\n").unwrap();
    std::fs::write(r.join("axb.txt"), "x\n").unwrap();
    std::fs::remove_file(r.join("weg.txt")).unwrap();
    for roh in [&b"a\xe4.txt"[..], b"a\xf6.txt"] {
        std::fs::write(r.join(std::ffi::OsStr::from_bytes(roh)), b"latin\n").unwrap();
    }
    let g1 = commit(&r, "G1");
    let i = liste(&r, &g1);
    assert_eq!(merkmale(datei(&i, "gross.txt")), (true, false, false));
    assert_eq!(merkmale(datei(&i, "klein.txt")), (false, false, true));
    let e = einzeln(&r, &g1, "gross.txt");
    assert_eq!((e.dateien.len(), merkmale(&e.dateien[0]), e.dateien[0].plus), (1, (false, false, true), 3001));
    assert!(e.hinweise.is_empty());
    let e = einzeln(&r, &g1, "weg.txt");
    assert_eq!((e.dateien[0].status.as_str(), e.dateien[0].patch.as_deref()), ("D", Some("@@ -1,2 +0,0 @@\n-weg eins\n-weg zwei\n")));
    let e = einzeln(&r, &g1, "a*b.txt");
    assert_eq!(e.dateien.iter().map(|d| d.name()).collect::<Vec<_>>(), ["a*b.txt"]);
    let e = einzeln(&r, &g1, "a\u{fffd}.txt");
    assert_eq!(e.dateien.len(), 2, "beide Latin-1-Namen");
    assert!(e.dateien.iter().all(|d| d.nicht_utf8 && d.patch.as_deref() == Some("@@ -0,0 +1 @@\n+latin\n")));
    for fremd in ["*", ":(top)klein.txt", "../klein.txt", "-x", "fehlt.txt", "a.txt"] {
        assert_eq!(lesen(&r, &g1, Auswahl::Datei(fremd)), Err(Inhaltsfehler::DateiFehlt { liste_abgeschnitten: false }), "{fremd}");
    }
}

// R00206 AK 10, AK 11: 3.000 Dateien — die Liste zeigt 2.000 mit Hinweis, die Datei Nr. 2.500 ist einzeln ladbar
#[test]
fn ak10_ak11_kappe_und_datei_jenseits() {
    let (_tmp, r) = neues_repo();
    for i in 1..=3000 {
        std::fs::write(r.join(format!("f{i:04}.txt")), format!("{i}\n")).unwrap();
    }
    let h = commit(&r, "3000");
    let i = liste(&r, &h);
    assert_eq!(i.dateien.len(), 2000);
    assert_eq!(i.hinweise, [Hinweis::DateienGekappt { gezeigt: 2000, gesamt: 3000 }]);
    assert!(i.dateien.iter().all(|d| d.patch.is_some()), "die gezeigten haben ihren Patch");
    assert_eq!(i.dateien[1999].patch.as_deref(), Some("@@ -0,0 +1 @@\n+2000\n"), "Zuordnung über die Pfadangabe stimmt bis zur letzten");
    let e = einzeln(&r, &h, "f2500.txt");
    assert_eq!((e.dateien.len(), e.dateien[0].plus, e.dateien[0].patch.as_deref()), (1, 1, Some("@@ -0,0 +1 @@\n+2500\n")));
}

// R00206 AK 5: Patches der Merkmale — Typwechsel zeigt das Ziel des Symlinks als Text, ohne Zeilenumbruch am Ende,
// Submodul aus zwei Zeilen `Subproject commit`, auch mit `diff.submodule=log`
#[test]
fn ak05_patches_der_merkmale() {
    let (_tmp, r) = neues_repo();
    std::fs::write(r.join("t.txt"), "x\n").unwrap();
    std::fs::write(r.join("ohne.txt"), "a\n").unwrap();
    let k = commit(&r, "vorher");
    std::fs::remove_file(r.join("t.txt")).unwrap();
    std::os::unix::fs::symlink("ziel", r.join("t.txt")).unwrap();
    std::fs::write(r.join("ohne.txt"), "a\nb").unwrap();
    git_am(&r, ADA, DATUM, &["add", "-A"]);
    git_am(&r, ADA, DATUM, &["update-index", "--add", "--cacheinfo", &format!("160000,{k},sub")]);
    git_am(&r, ADA, DATUM, &["commit", "-q", "-m", "Merkmale"]);
    let h = git_am(&r, ADA, DATUM, &["rev-parse", "HEAD"]);
    let ohne_log = liste(&r, &h);
    git_am(&r, ADA, DATUM, &["config", "diff.submodule", "log"]);
    let i = liste(&r, &h);
    assert_eq!(i, ohne_log, "diff.submodule=log ändert nichts");
    assert_eq!(datei(&i, "t.txt").patch.as_deref(), Some("@@ -1 +0,0 @@\n-x\n@@ -0,0 +1 @@\n+ziel\n\\ No newline at end of file\n"));
    assert!(datei(&i, "ohne.txt").patch.as_deref().unwrap().ends_with("+b\n\\ No newline at end of file\n"));
    assert_eq!(datei(&i, "sub").patch.as_deref(), Some(format!("@@ -0,0 +1 @@\n+Subproject commit {k}\n").as_str()));
}
