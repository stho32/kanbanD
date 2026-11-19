// R00204 B1000: Objekte prüfen (`cat-file --batch-check`) und Metadaten lesen (`log --no-walk`) im Arbeits-Repository —
// gegen echte Wegwerf-Repositories (AK 5, 6, 13, 17).
mod gemeinsam;

use kanband::git::arbeitsrepo::{self, Arbeitsrepofehler, Metadaten, Objekt};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

fn frist() -> Instant {
    Instant::now() + Duration::from_secs(10)
}

/// Git als Ada Autorin mit festem Datum (Autor- und Commit-Datum gleich).
fn git_am(r: &Path, datum: &str, args: &[&str]) -> String {
    let a = Command::new("git").arg("-C").arg(r).args(["-c", "user.name=Ada Autorin", "-c", "user.email=ada@example.org"]).args(args).env("GIT_AUTHOR_DATE", datum).env("GIT_COMMITTER_DATE", datum).output().unwrap();
    assert!(a.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&a.stderr));
    String::from_utf8_lossy(&a.stdout).trim().to_string()
}

const DATUM: &str = "2026-03-01T10:00:00+01:00";

fn leeres_repo() -> (tempfile::TempDir, PathBuf) {
    let tmp = tempfile::tempdir().unwrap();
    let r = tmp.path().canonicalize().unwrap().join("R");
    std::fs::create_dir_all(&r).unwrap();
    git_am(&r, DATUM, &["init", "-q", "-b", "main"]);
    (tmp, r)
}

fn commit(r: &Path, nachricht: &str) -> String {
    git_am(r, DATUM, &["add", "-A"]);
    git_am(r, DATUM, &["commit", "-q", "--allow-empty", "-m", nachricht]);
    git_am(r, DATUM, &["rev-parse", "HEAD"])
}

fn metadaten(r: &Path, h: &str) -> Metadaten {
    let mut m = arbeitsrepo::metadaten(r, &[h], frist()).unwrap();
    m.remove(h).unwrap_or_else(|| panic!("keine Metadaten zu {h}"))
}

fn zahlen(m: &Metadaten) -> (u64, u64, u64) {
    (m.plus, m.minus, m.dateien)
}

// AK 5, ADR-0032 N3.3: nur der Typ `commit` zählt; Blob, Baum und Tag-Objekt sind `fehlt` (nicht aufgelöst), ein
// mehrdeutiger Kurz-Hash ist mehrdeutig — auch Commit gegen Blob —, ein Kurz-Hash ohne Treffer fehlt
#[test]
fn objekte_nach_typ() {
    let r = gemeinsam::repo();
    let baum = gemeinsam::git(&r.r, &["rev-parse", &format!("{}^{{tree}}", r.k1)]);
    gemeinsam::git(&r.r, &["-c", "user.name=A", "-c", "user.email=a@a", "tag", "-a", "-m", "t1", "t1", &r.k2]);
    let tag = gemeinsam::git(&r.r, &["rev-parse", "t1"]);
    let vorher = r.stand();
    let k1_41 = format!("{}0", r.k1);
    let eingaben = [r.k1.as_str(), &r.k2[..7], &r.v1[..9], &r.blob, &baum, &tag, &k1_41, gemeinsam::PRAEFIX_ZWEIER, "0000000", &r.k1];
    let ergebnis = arbeitsrepo::objekte_pruefen(&r.r, &eingaben, frist()).unwrap();
    assert_eq!(ergebnis, [Objekt::Commit(r.k1.clone()), Objekt::Commit(r.k2.clone()), Objekt::Commit(r.v1.clone()), Objekt::Fehlt, Objekt::Fehlt, Objekt::Fehlt, Objekt::Fehlt, Objekt::Mehrdeutig, Objekt::Fehlt, Objekt::Commit(r.k1.clone())]);
    assert_eq!(r.stand(), vorher, "nur lesend");
}

// AK 5: mehrdeutig auch dann, wenn die Treffer ein Commit und ein Blob sind
#[test]
fn mehrdeutig_commit_gegen_blob() {
    let (_tmp, r) = leeres_repo();
    let k = commit(&r, "k");
    let praefix = &k[..4];
    // ein Blob, dessen Hash mit denselben 4 Zeichen beginnt — offline gesucht
    let blob = (0..200_000).find_map(|i| {
        let inhalt = format!("{i}\n");
        let h = gemeinsam::git_hash_blob(&inhalt);
        (h.starts_with(praefix)).then_some((inhalt, h))
    });
    let (inhalt, h) = blob.expect("ein Blob mit gleichem Präfix");
    let pfad = r.join("../blob");
    std::fs::write(&pfad, inhalt).unwrap();
    assert_eq!(gemeinsam::git(&r, &["hash-object", "-w", pfad.to_str().unwrap()]), h);
    // 4 Zeichen: Git verlangt mindestens 4 — der Verweis selbst hat mindestens 7, das Modul nimmt, was es bekommt
    assert_eq!(arbeitsrepo::objekte_pruefen(&r, &[praefix], frist()).unwrap(), [Objekt::Mehrdeutig]);
}

// AK 5, AK 3: ein Zweig, der wie der Kurz-Hash heißt, geht bei Git vor dem Objekt — das Modul nennt das, statt den Zweig
// für den Commit zu halten
#[test]
fn zweig_mit_dem_namen_des_kurz_hashes() {
    let r = gemeinsam::repo();
    assert_eq!(arbeitsrepo::objekte_pruefen(&r.r, &["abcdef0"], frist()).unwrap(), [Objekt::NameEinesRefs]);
    gemeinsam::git(&r.r, &["branch", &r.k1[..7], &r.k2]);
    assert_eq!(arbeitsrepo::objekte_pruefen(&r.r, &[&r.k1[..7], &r.k1], frist()).unwrap(), [Objekt::NameEinesRefs, Objekt::Commit(r.k1.clone())]);
}

// AK 6: Zahlen gegen den ersten Elternteil, Binärdatei als Datei, Umbenennung, leerer Commit, Wurzel-Commit, Merge
#[test]
fn zahlen_datum_autor() {
    let (_tmp, r) = leeres_repo();
    std::fs::write(r.join("a.txt"), "1\n2\n").unwrap();
    std::fs::write(r.join("c.txt"), "c\n").unwrap();
    std::fs::write(r.join("x.bin"), [0u8, 1, 2, 3]).unwrap();
    let k1 = commit(&r, "Wurzel");
    assert_eq!(zahlen(&metadaten(&r, &k1)), (3, 0, 3), "Wurzel gegen den leeren Baum: a.txt 2, c.txt 1, x.bin 0 Zeilen");
    std::fs::write(r.join("a.txt"), "1\nA\nB\nC\n").unwrap();
    std::fs::write(r.join("b.txt"), "b\nb\n").unwrap();
    std::fs::write(r.join("x.bin"), [0u8, 9, 9]).unwrap();
    let z1 = commit(&r, "Z1");
    assert_eq!(zahlen(&metadaten(&r, &z1)), (5, 1, 3));
    git_am(&r, DATUM, &["mv", "c.txt", "c2.txt"]);
    let umbenannt = commit(&r, "umbenannt");
    assert_eq!(zahlen(&metadaten(&r, &umbenannt)), (0, 0, 1));
    let leer = commit(&r, "leer");
    assert_eq!(zahlen(&metadaten(&r, &leer)), (0, 0, 0));
    git_am(&r, DATUM, &["checkout", "-q", "-b", "seite"]);
    std::fs::write(r.join("d.txt"), "1\n2\n3\n4\n").unwrap();
    commit(&r, "d.txt");
    git_am(&r, DATUM, &["checkout", "-q", "main"]);
    std::fs::write(r.join("e.txt"), "e\n").unwrap();
    commit(&r, "e.txt auf main");
    git_am(&r, "2026-03-01T23:30:00-05:00", &["merge", "-q", "--no-ff", "-m", "Merge seite", "seite"]);
    let merge = git_am(&r, DATUM, &["rev-parse", "HEAD"]);
    let m = metadaten(&r, &merge);
    assert_eq!(zahlen(&m), (4, 0, 1), "gegen den ersten Elternteil");
    assert_eq!(m.datum, "2026-03-01T23:30:00-05:00", "Commit-Datum mit der Zeitzone des Commits");
    assert_eq!(m.autor, "Ada Autorin", "nur der Name");
    assert_eq!(m.titel, "Merge seite");
    let alle = arbeitsrepo::metadaten(&r, &[&k1, &z1, &leer, &merge], frist()).unwrap();
    assert_eq!(alle.len(), 4, "ein Aufruf für alle");
    assert_eq!(zahlen(&alle[&leer]), (0, 0, 0), "der leere Commit verschiebt nichts");
    assert_eq!(zahlen(&alle[&merge]), (4, 0, 1));
}

// AK 13, AK 17: feindlicher Titel und Autor zeichengleich; Steuerzeichen bleiben und verschieben nichts; nur die erste
// Zeile; latin1 wird UTF-8
#[test]
fn feindlicher_inhalt() {
    let (_tmp, r) = leeres_repo();
    let titel = "<script>alert(1)</script> \"x\" \\ y";
    let a = Command::new("git").arg("-C").arg(&r).args(["-c", "user.email=m@m", "commit", "-q", "--allow-empty", "-m", titel]).env("GIT_AUTHOR_NAME", "Mallory <img src=x>").env("GIT_COMMITTER_NAME", "C").output().unwrap();
    assert!(a.status.success());
    let boese = gemeinsam::git(&r, &["rev-parse", "HEAD"]);
    let steuer = "T\u{1f}i\u{1e}t\te\rl";
    let a = Command::new("git").arg("-C").arg(&r).args(["-c", "user.email=s@s", "commit", "-q", "--allow-empty", "-m", &format!("{steuer}\nzweite Zeile\n1\t2\tx.txt")]).env("GIT_AUTHOR_NAME", "A\u{1f}u\u{1e}t\to\rr").env("GIT_COMMITTER_NAME", "C").output().unwrap();
    assert!(a.status.success());
    let mit_steuer = gemeinsam::git(&r, &["rev-parse", "HEAD"]);
    let a = Command::new("git").arg("-C").arg(&r).args(["-c", "user.name=L", "-c", "user.email=l@l", "-c", "i18n.commitEncoding=latin1", "commit", "-q", "--allow-empty", "-F", "-"]).stdin(std::process::Stdio::piped()).spawn().and_then(|mut k| {
        use std::io::Write;
        k.stdin.take().unwrap().write_all(b"Gr\xe4te\n")?;
        k.wait_with_output()
    }).unwrap();
    assert!(a.status.success());
    let latin1 = gemeinsam::git(&r, &["rev-parse", "HEAD"]);
    let m = arbeitsrepo::metadaten(&r, &[&boese, &mit_steuer, &latin1], frist()).unwrap();
    assert_eq!(m[&boese].titel, titel);
    let gespeichert = gemeinsam::git(&r, &["log", "-1", "--format=%an", &boese]);
    assert_eq!(m[&boese].autor, gespeichert, "der Name, wie Git ihn speichert");
    assert!(!m[&boese].autor.contains("m@m"));
    assert_eq!(m[&mit_steuer].titel, steuer, "Steuerzeichen bleiben, nur die erste Zeile");
    assert_eq!(m[&mit_steuer].autor, "A\u{1f}u\u{1e}t\to\rr");
    assert_eq!((m[&mit_steuer].plus, m[&mit_steuer].dateien), (0, 0), "die Zeile 1\\t2\\tx.txt der Nachricht ist keine Statistik");
    assert_eq!(m[&latin1].titel, "Gräte");
}

// AK 13: ein Commit, dessen Nachricht kein gültiges UTF-8 ist und dessen Kodierung Git nicht kennt, ergibt Ersatzzeichen
#[test]
fn ungueltige_kodierung_wird_ersetzt() {
    let (_tmp, r) = leeres_repo();
    let baum = gemeinsam::git(&r, &["hash-object", "-w", "-t", "tree", "/dev/null"]);
    let pfad = r.join("../objekt");
    std::fs::write(&pfad, [format!("tree {baum}\nauthor A <a@a> 0 +0000\ncommitter A <a@a> 0 +0000\nencoding gibt-es-nicht\n\n").as_bytes(), b"X\xff\xfeY\n"].concat()).unwrap();
    let h = gemeinsam::git(&r, &["hash-object", "-w", "-t", "commit", pfad.to_str().unwrap()]);
    let m = metadaten(&r, &h);
    assert!(m.titel.starts_with('X') && m.titel.ends_with('Y') && m.titel.contains('\u{fffd}'), "{:?}", m.titel);
}

// Gesamtgrenze (ADR-0032 N3.1): ist die Frist vorbei, startet kein Prozess mehr
#[test]
fn abgelaufene_frist_startet_nichts() {
    let r = gemeinsam::repo();
    let vorher = arbeitsrepo::aufrufe();
    assert_eq!(arbeitsrepo::objekte_pruefen(&r.r, &[&r.k1], Instant::now()), Err(Arbeitsrepofehler::Zeitgrenze));
    assert_eq!(arbeitsrepo::metadaten(&r.r, &[&r.k1], Instant::now()).map(|_| ()), Err(Arbeitsrepofehler::Zeitgrenze));
    assert_eq!(arbeitsrepo::aufrufe(), vorher);
}
