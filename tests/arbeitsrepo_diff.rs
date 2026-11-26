// R00206 B1011 (ADR-0032 N4.3, N4.6): die Dateiliste eines Commits aus zwei Läufen `diff-tree` gegen ein echtes
// Wegwerf-Repository — erster Elternteil, Wurzel, leerer Commit, Merkmale, Pfade, Kappe, wörtliche Pfadangabe.
mod gemeinsam;

use gemeinsam::git_am;
use kanband::git::arbeitsrepo::{self, Diffart, Teil, Umbenennungssuche, Vergleich};
use kanband::modell::{Diffdatei, GRENZE_DATEILISTE, KAPPE_DATEIEN, dateiliste};
use std::os::unix::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

const ADA: &str = "Ada Autorin";
const DATUM: &str = "2026-03-05T09:00:00+00:00";

fn frist() -> Instant {
    Instant::now() + Duration::from_secs(10)
}

fn neues_repo() -> (tempfile::TempDir, PathBuf) {
    let tmp = tempfile::tempdir().unwrap();
    let r = tmp.path().canonicalize().unwrap().join("R");
    std::fs::create_dir_all(&r).unwrap();
    git_am(&r, ADA, DATUM, &["init", "-q", "-b", "main"]);
    (tmp, r)
}

fn commit(r: &Path, nachricht: &str) -> String {
    git_am(r, ADA, DATUM, &["add", "-A"]);
    git_am(r, ADA, DATUM, &["commit", "-q", "--allow-empty", "-m", nachricht]);
    git_am(r, ADA, DATUM, &["rev-parse", "HEAD"])
}

fn schreiben(r: &Path, pfad: impl AsRef<Path>, inhalt: impl AsRef<[u8]>) {
    let p = r.join(pfad);
    std::fs::create_dir_all(p.parent().unwrap()).unwrap();
    std::fs::write(p, inhalt).unwrap();
}

fn zeilen(n: usize) -> String {
    (1..=n).map(|i| format!("z{i}\n")).collect()
}

/// Die beiden Läufe der Dateiliste und die verbundene Liste, mit dem ersten Elternteil aus den Metadaten.
fn liste_mit(r: &Path, h: &str, pfade: &[&[u8]]) -> (Teil, Teil, Vec<Diffdatei>, u64) {
    let m = arbeitsrepo::metadaten(r, &[h], frist()).unwrap().remove(h).unwrap();
    let v = Vergleich { eltern: m.erster_elternteil.as_deref(), commit: h };
    let roh = arbeitsrepo::diff_tree(r, v, Diffart::Roh, Umbenennungssuche::Voll, pfade, GRENZE_DATEILISTE, frist()).unwrap();
    let zahlen = arbeitsrepo::diff_tree(r, v, Diffart::Zahlen, Umbenennungssuche::Voll, pfade, GRENZE_DATEILISTE, frist()).unwrap();
    let liste = dateiliste(&roh.ausgabe, roh.abgeschnitten, &zahlen.ausgabe, zahlen.abgeschnitten).unwrap();
    (roh, zahlen, liste, m.dateien)
}

fn liste(r: &Path, h: &str) -> Vec<Diffdatei> {
    liste_mit(r, h, &[]).2
}

fn kurz(d: &Diffdatei) -> (Option<&str>, Option<&str>, &str, u64, u64, bool) {
    (d.alt.as_deref(), d.neu.as_deref(), d.status.as_str(), d.plus, d.minus, d.binaer)
}

// R00206 AK 1, AK 4: Text, Binär, Umbenennung; Summen gleich den Metadaten der Liste; der Wurzel-Commit gegen den leeren
// Baum; ein leerer Commit ohne Dateien
#[test]
fn x1_wurzel_und_leerer_commit() {
    let (_tmp, r) = neues_repo();
    schreiben(&r, "a.txt", "eins\nzwei\n");
    let k1 = commit(&r, "K1");
    schreiben(&r, "c.txt", "c\n");
    commit(&r, "c");
    schreiben(&r, "a.txt", "eins\nZwei\n");
    schreiben(&r, "bild.bin", [0u8, 1, 2, 3]);
    git_am(&r, ADA, DATUM, &["mv", "c.txt", "c2.txt"]);
    let x1 = commit(&r, "X1");
    let l = liste(&r, &x1);
    assert_eq!(l.iter().map(kurz).collect::<Vec<_>>(), [(Some("a.txt"), Some("a.txt"), "M", 1, 1, false), (None, Some("bild.bin"), "A", 0, 0, true), (Some("c.txt"), Some("c2.txt"), "R", 0, 0, false)]);
    assert_eq!(l[2].aehnlichkeit, Some(100));
    let wurzel = liste(&r, &k1);
    assert_eq!(wurzel.iter().map(kurz).collect::<Vec<_>>(), [(None, Some("a.txt"), "A", 2, 0, false)]);
    let leer = commit(&r, "leer");
    let (_, _, l, dateien) = liste_mit(&r, &leer, &[]);
    assert_eq!((l.len(), dateien), (0, 0));
}

// R00206 AK 4: drei Dateien, Summen gleich `commits[0]`; ein Merge-Commit gegen den ersten Elternteil
#[test]
fn summen_und_merge_gegen_den_ersten_elternteil() {
    let (_tmp, r) = neues_repo();
    schreiben(&r, "a.txt", zeilen(4));
    schreiben(&r, "x.bin", [0u8, 9]);
    commit(&r, "K1");
    schreiben(&r, "a.txt", "z1\nneu1\nneu2\nneu3\nz3\nz4\n");
    schreiben(&r, "b.txt", zeilen(2));
    schreiben(&r, "x.bin", [0u8, 8]);
    let z1 = commit(&r, "Z1");
    let (_, _, l, dateien) = liste_mit(&r, &z1, &[]);
    let m = arbeitsrepo::metadaten(&r, &[&z1], frist()).unwrap().remove(&z1).unwrap();
    assert_eq!(l.iter().map(|d| (d.plus, d.minus)).collect::<Vec<_>>(), [(3, 1), (2, 0), (0, 0)]);
    assert_eq!((l.iter().map(|d| d.plus).sum::<u64>(), l.iter().map(|d| d.minus).sum::<u64>(), l.len() as u64), (m.plus, m.minus, dateien));
    git_am(&r, ADA, DATUM, &["checkout", "-q", "-b", "seite"]);
    schreiben(&r, "d.txt", zeilen(4));
    commit(&r, "d");
    git_am(&r, ADA, DATUM, &["checkout", "-q", "main"]);
    schreiben(&r, "e.txt", "e\n");
    commit(&r, "e");
    git_am(&r, ADA, DATUM, &["merge", "-q", "--no-ff", "-m", "Merge", "seite"]);
    let merge = git_am(&r, ADA, DATUM, &["rev-parse", "HEAD"]);
    assert_eq!(liste(&r, &merge).iter().map(kurz).collect::<Vec<_>>(), [(None, Some("d.txt"), "A", 4, 0, false)]);
}

// R00206 AK 5: gelöscht, umbenannt und geändert, Modus, Typwechsel, Symlink, Submodul, leere Datei, NUL-Byte
#[test]
fn merkmale_je_datei() {
    let (_tmp, r) = neues_repo();
    schreiben(&r, "weg.txt", zeilen(2));
    schreiben(&r, "alt8.txt", zeilen(8));
    schreiben(&r, "m.sh", "m\n");
    schreiben(&r, "t.txt", "x\n");
    let sub = commit(&r, "K1");
    schreiben(&r, "alt8.txt", zeilen(8).replace("z4\n", "vier\n"));
    git_am(&r, ADA, DATUM, &["mv", "alt8.txt", "neu8.txt"]);
    std::fs::remove_file(r.join("weg.txt")).unwrap();
    std::fs::set_permissions(r.join("m.sh"), std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    std::fs::remove_file(r.join("t.txt")).unwrap();
    std::os::unix::fs::symlink("ziel", r.join("t.txt")).unwrap();
    std::os::unix::fs::symlink("ziel2", r.join("link")).unwrap();
    schreiben(&r, "leer.txt", "");
    schreiben(&r, "nul.dat", b"a\0b\n");
    git_am(&r, ADA, DATUM, &["add", "-A"]);
    // ein Submodul als Eintrag `160000` im Index (ohne Ordner: es wird nie betreten)
    git_am(&r, ADA, DATUM, &["update-index", "--add", "--cacheinfo", &format!("160000,{sub},sub")]);
    git_am(&r, ADA, DATUM, &["config", "diff.submodule", "log"]);
    git_am(&r, ADA, DATUM, &["commit", "-q", "-m", "Merkmale"]);
    let h = git_am(&r, ADA, DATUM, &["rev-parse", "HEAD"]);
    let l = liste(&r, &h);
    let d = |name: &str| l.iter().find(|d| d.name() == name).unwrap_or_else(|| panic!("{name}: {l:?}"));
    assert_eq!((d("weg.txt").status.as_str(), d("weg.txt").neu.as_deref(), d("weg.txt").minus), ("D", None, 2));
    let rn = d("neu8.txt");
    assert_eq!((rn.status.as_str(), rn.alt.as_deref(), rn.plus, rn.minus), ("R", Some("alt8.txt"), 1, 1));
    let roh = gemeinsam::git(&r, &["diff-tree", "-r", "-M50%", "--raw", &format!("{h}^"), &h]);
    let zahl = roh.lines().find(|z| z.contains("alt8.txt")).unwrap().split('\t').next().unwrap().rsplit(' ').next().unwrap()[1..].parse::<u32>().unwrap();
    assert_eq!(rn.aehnlichkeit, Some(zahl), "die Zahl, die git diff-tree -r -M50% --raw nennt");
    let m = d("m.sh");
    assert_eq!((m.status.as_str(), m.modus_alt.as_deref(), m.modus_neu.as_deref(), m.plus, m.minus), ("M", Some("100644"), Some("100755"), 0, 0));
    let t = d("t.txt");
    assert_eq!((t.status.as_str(), t.modus_alt.as_deref(), t.modus_neu.as_deref()), ("T", Some("100644"), Some("120000")));
    assert_eq!((d("link").status.as_str(), d("link").modus_neu.as_deref()), ("A", Some("120000")));
    assert_eq!((d("sub").status.as_str(), d("sub").modus_neu.as_deref()), ("A", Some("160000")));
    let leer = d("leer.txt");
    assert_eq!((leer.status.as_str(), leer.plus, leer.minus, leer.binaer), ("A", 0, 0, false));
    let nul = d("nul.dat");
    assert_eq!((nul.binaer, nul.plus, nul.minus), (true, 0, 0));
}

// R00206 AK 6, FA 10: Namen mit Umlauten, Leerzeichen, Bindestrich, Anführungszeichen, Backslash, Tabulator,
// Zeilenumbruch samt falscher Kopfzeile, ESC, HTML, Bidi — zeichengleich; Latin-1-Bytes mit Ersatzzeichen
#[test]
fn pfade_zeichengleich_und_nicht_utf8() {
    let (_tmp, r) = neues_repo();
    commit(&r, "K1");
    let namen = ["ä ö.txt", "mit Leerzeichen.txt", "-x.txt", "a\"b.txt", "a\\b.txt", "t\tb.txt", "n\ndiff --git a/y b/y.txt", "esc\u{1b}.txt", "<script>alert(1)</script>.txt", "bidi\u{202e}.txt"];
    for n in namen {
        schreiben(&r, n, "inhalt\n");
    }
    for roh in [&b"a\xe4.txt"[..], b"a\xf6.txt"] {
        std::fs::write(r.join(std::ffi::OsStr::from_bytes(roh)), b"latin\n").unwrap();
    }
    let h = commit(&r, "Namen");
    let l = liste(&r, &h);
    let mut erwartet: Vec<String> = namen.iter().map(|n| n.to_string()).collect();
    erwartet.extend(["a\u{fffd}.txt".to_string(), "a\u{fffd}.txt".to_string()]);
    let mut gefunden: Vec<String> = l.iter().map(|d| d.neu.clone().unwrap()).collect();
    erwartet.sort();
    gefunden.sort();
    assert_eq!(gefunden, erwartet);
    assert_eq!(l.iter().filter(|d| d.nicht_utf8).count(), 2);
    assert!(l.iter().all(|d| d.plus == 1));
}

// R00206 AK 10, ADR-0032 N4.3: 2.000 Dateien ganz, 2.001 gekappt auf die ersten 2.000 in der Reihenfolge von Git,
// `gesamt` aus den Metadaten; beide Läufe ganz gelesen, keine gezeigte Datei ohne Zähler
#[test]
fn kappe_bei_2000_dateien() {
    let (_tmp, r) = neues_repo();
    commit(&r, "K1");
    for i in 0..KAPPE_DATEIEN {
        schreiben(&r, format!("d/f{i:05}.txt"), format!("d{i}\n"));
    }
    let genau = commit(&r, "2000");
    let (roh, zahlen, l, dateien) = liste_mit(&r, &genau, &[]);
    assert_eq!((l.len(), dateien, roh.abgeschnitten, zahlen.abgeschnitten), (2000, 2000, false, false));
    for i in 0..=KAPPE_DATEIEN {
        schreiben(&r, format!("e/f{i:05}.txt"), format!("e{i}\n"));
    }
    let mehr = commit(&r, "2001");
    let (roh, zahlen, l, dateien) = liste_mit(&r, &mehr, &[]);
    assert_eq!((l.len(), dateien, roh.abgeschnitten, zahlen.abgeschnitten), (2000, 2001, false, false));
    assert_eq!((l[0].name(), l[1999].name()), ("e/f00000.txt", "e/f01999.txt"), "die ersten in der Reihenfolge von Git");
    assert!(l.iter().all(|d| (d.plus, d.minus) == (1, 0)), "keine gezeigte Datei ohne Zähler");
}

// R00206 AK 11, ADR-0032 N4.7: die Pfadangabe ist wörtlich (`a*b.txt` trifft nicht `axb.txt`), eine Umbenennung bleibt
// `R`, wenn beide Pfade genannt sind
#[test]
fn woertliche_pfadangabe() {
    let (_tmp, r) = neues_repo();
    schreiben(&r, "alt.txt", zeilen(8));
    commit(&r, "K1");
    schreiben(&r, "a*b.txt", "s\n");
    schreiben(&r, "axb.txt", "x\n");
    git_am(&r, ADA, DATUM, &["mv", "alt.txt", "neu.txt"]);
    let h = commit(&r, "Stern");
    let (_, _, l, _) = liste_mit(&r, &h, &[b"a*b.txt"]);
    assert_eq!(l.iter().map(|d| d.name()).collect::<Vec<_>>(), ["a*b.txt"]);
    let (_, _, l, _) = liste_mit(&r, &h, &[b"alt.txt", b"neu.txt"]);
    assert_eq!(l.iter().map(kurz).collect::<Vec<_>>(), [(Some("alt.txt"), Some("neu.txt"), "R", 0, 0, false)]);
    let (_, _, l, _) = liste_mit(&r, &h, &[b"*"]);
    assert!(l.is_empty(), "* ist kein Muster: {l:?}");
}
