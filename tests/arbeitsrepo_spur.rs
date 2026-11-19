// R00202 B0991 (ADR-0032 Punkt 3): die Befehlszeile, wie Git sie sieht — `GIT_TRACE` des eigenen Testprozesses. Eigene
// Testdatei, weil die Umgebungsvariable für den ganzen Prozess gilt.
use kanband::git::arbeitsrepo;
use std::path::Path;
use std::process::Command;

fn git(pfad: &Path, args: &[&str]) -> String {
    let a = Command::new("git").arg("-C").arg(pfad).args(["-c", "user.name=A", "-c", "user.email=a@a"]).args(args).output().unwrap();
    String::from_utf8_lossy(&a.stdout).trim().to_string()
}

// --end-of-options steht vor dem Verweis, ^{commit} hängt an ihm, die Umgebung leert das Modul nicht (GIT_TRACE wirkt)
#[test]
fn befehlszeile_mit_end_of_options_vor_dem_verweis() {
    let tmp = tempfile::tempdir().unwrap();
    let r = tmp.path().canonicalize().unwrap().join("R");
    std::fs::create_dir_all(&r).unwrap();
    git(&r, &["init", "-q", "-b", "main"]);
    git(&r, &["commit", "-q", "--allow-empty", "-m", "K1"]);
    let k1 = git(&r, &["rev-parse", "HEAD"]);
    let spur = tmp.path().join("spur");
    // SAFETY: der einzige Test dieser Datei, kein anderer Thread liest die Umgebung gleichzeitig
    unsafe { std::env::set_var("GIT_TRACE", &spur) };

    assert_eq!(arbeitsrepo::commit_aufloesen(&r, &k1[..7]).as_deref(), Ok(k1.as_str()));
    let text = std::fs::read_to_string(&spur).unwrap();
    let zeilen: Vec<&str> = text.lines().filter(|z| z.contains("rev-parse")).collect();
    assert_eq!(zeilen.len(), 1, "{text}");
    assert!(zeilen[0].ends_with(&format!("git rev-parse --verify --quiet --end-of-options '{}^{{commit}}'", &k1[..7])), "{}", zeilen[0]);
}
