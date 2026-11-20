// R00206 AK 16 (b, c), ADR-0032 N4.3, N4.7: die Befehlszeilen von `diff-tree`, wie Git sie sieht (`GIT_TRACE` des
// eigenen Testprozesses) — Form und Inhalt nennt das Modul selbst. Eigene Testdatei, weil die Umgebungsvariable für den
// ganzen Prozess gilt. Tötet die gleichwertigen Mutanten „-M50% weg“, „-l1000 weg“, „--ignore-submodules=none weg“
// und „kein `--` ohne Pfade“ (Security S1, #214: eine Datei mit dem Namen einer Revision macht sie sonst mehrdeutig).
use kanband::git::arbeitsrepo::{self, Diffart, Vergleich};
use std::path::Path;
use std::process::Command;
use std::time::{Duration, Instant};

fn git(pfad: &Path, args: &[&str]) -> String {
    let a = Command::new("git").arg("-C").arg(pfad).args(["-c", "user.name=A", "-c", "user.email=a@a"]).args(args).output().unwrap();
    String::from_utf8_lossy(&a.stdout).trim().to_string()
}

#[test]
fn befehlszeilen_von_diff_tree() {
    let tmp = tempfile::tempdir().unwrap();
    let r = tmp.path().canonicalize().unwrap().join("R");
    std::fs::create_dir_all(&r).unwrap();
    git(&r, &["init", "-q", "-b", "main"]);
    std::fs::write(r.join("a.txt"), "a\n").unwrap();
    git(&r, &["add", "-A"]);
    git(&r, &["commit", "-q", "-m", "K1"]);
    let k1 = git(&r, &["rev-parse", "HEAD"]);
    std::fs::write(r.join("a.txt"), "b\n").unwrap();
    git(&r, &["commit", "-q", "-am", "K2"]);
    let k2 = git(&r, &["rev-parse", "HEAD"]);
    let spur = tmp.path().join("spur");
    // SAFETY: der einzige Test dieser Datei, kein anderer Thread liest die Umgebung gleichzeitig
    unsafe { std::env::set_var("GIT_TRACE", &spur) };
    let frist = Instant::now() + Duration::from_secs(10);
    let mit = Vergleich { eltern: Some(&k1), commit: &k2 };
    let wurzel = Vergleich { eltern: None, commit: &k1 };
    arbeitsrepo::diff_tree(&r, mit, Diffart::Roh, &[], 1 << 20, frist).unwrap();
    arbeitsrepo::diff_tree(&r, mit, Diffart::Zahlen, &[], 1 << 20, frist).unwrap();
    arbeitsrepo::diff_tree(&r, mit, Diffart::Patch, &[b"a.txt"], 1 << 20, frist).unwrap();
    arbeitsrepo::diff_tree(&r, wurzel, Diffart::Patch, &[], 1 << 20, frist).unwrap();
    let text = std::fs::read_to_string(&spur).unwrap();
    let zeilen: Vec<&str> = text.lines().filter(|z| z.contains("trace: built-in: git diff-tree")).map(|z| z.split("trace: built-in: ").nth(1).unwrap()).collect();
    let schalter = "git diff-tree --no-ext-diff --no-textconv --no-color -r '-M50%' -l1000 --ignore-submodules=none";
    assert_eq!(zeilen, [
        format!("{schalter} --raw -z --end-of-options {k1} {k2} --"),
        format!("{schalter} --numstat -z --end-of-options {k1} {k2} --"),
        format!("{schalter} -p --full-index --submodule=short --end-of-options {k1} {k2} -- a.txt"),
        format!("{schalter} -p --full-index --submodule=short --root --no-commit-id --end-of-options {k1} --"),
    ]);
}
