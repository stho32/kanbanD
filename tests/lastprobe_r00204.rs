// R00204 B0998 (ADR-0032 N3.4): Sondierung der Zweigliste vor dem Bau — beide Wege Z1 (`for-each-ref --contains` je
// Commit, 4 gleichzeitig) und Z5 (ein Lauf `rev-list --parents --branches --remotes`, Erreichbarkeit im Speicher) gegen
// das große Wegwerf-Repository, je 20 kalte Läufe über die ganze Folge (Wurzel, `cat-file`, `log`, Fingerabdruck,
// Zweiglisten, zweite Fingerabdruck-Probe). Läuft nicht in jeder Suite:
// `cargo test --release --test lastprobe_r00204 -- --ignored --nocapture`
mod gemeinsam;

use std::collections::HashMap;
use std::io::Write;
use std::path::Path;
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

const SCHWELLE: Duration = Duration::from_millis(200);

/// Wie der Startort des Moduls: Sperren vor dem Befehl, keine System- und Benutzerkonfiguration.
fn git(r: &Path, args: &[&str], eingabe: Option<&str>) -> Output {
    let mut c = Command::new("git");
    c.arg("-C").arg(r).args(["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "core.commitGraph=false"]).args(args);
    c.env("GIT_CONFIG_NOSYSTEM", "1").env("GIT_CONFIG_GLOBAL", "/dev/null").env("GIT_OPTIONAL_LOCKS", "0");
    c.stdin(if eingabe.is_some() { Stdio::piped() } else { Stdio::null() }).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut kind = c.spawn().unwrap();
    if let Some(text) = eingabe {
        kind.stdin.take().unwrap().write_all(text.as_bytes()).unwrap();
    }
    let aus = kind.wait_with_output().unwrap();
    assert!(aus.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&aus.stderr));
    aus
}

const SPITZEN: [&str; 4] = ["for-each-ref", "--format=%(objectname) %(refname)", "refs/heads", "refs/remotes"];

/// Alles vor den Zweiglisten: Wurzel, Objektprüfung, Metadaten, Fingerabdruck.
fn vorlauf(r: &Path, verweise: &[String]) -> String {
    git(r, &["rev-parse", "--show-toplevel"], None);
    git(r, &["cat-file", "--batch-check"], Some(&(verweise.join("\n") + "\n")));
    let mut log = vec!["log", "--no-walk=unsorted", "-z", "--root", "-M", "--diff-merges=first-parent", "--no-ext-diff", "--no-textconv", "--no-color", "--format=%H%x00%an%x00%cI%x00%B%x00", "--numstat", "--end-of-options"];
    log.extend(verweise.iter().map(String::as_str));
    git(r, &log, None);
    String::from_utf8(git(r, &SPITZEN, None).stdout).unwrap()
}

/// Z1: je Commit ein `for-each-ref --contains`, höchstens 4 gleichzeitig.
fn z1(r: &Path, verweise: &[String]) -> HashMap<String, Vec<String>> {
    let naechster = std::sync::Mutex::new(0usize);
    let ergebnis = std::sync::Mutex::new(HashMap::new());
    std::thread::scope(|s| {
        for _ in 0..4 {
            s.spawn(|| {
                loop {
                    let i = {
                        let mut n = naechster.lock().unwrap();
                        *n += 1;
                        *n - 1
                    };
                    let Some(h) = verweise.get(i) else { break };
                    let aus = git(r, &["for-each-ref", "--format=%(refname)", "--contains", h, "refs/heads", "refs/remotes"], None);
                    let zweige: Vec<String> = String::from_utf8_lossy(&aus.stdout).lines().filter(|z| !z.ends_with("/HEAD")).map(String::from).collect();
                    ergebnis.lock().unwrap().insert(h.clone(), zweige);
                }
            });
        }
    });
    ergebnis.into_inner().unwrap()
}

/// Z5: ein Lauf über alle Kanten, Erreichbarkeit je Spitze im Speicher.
fn z5(r: &Path, verweise: &[String], fingerabdruck: &str) -> HashMap<String, Vec<String>> {
    let aus = git(r, &["rev-list", "--parents", "--branches", "--remotes"], None);
    let text = String::from_utf8(aus.stdout).unwrap();
    let mut index: HashMap<&str, u32> = HashMap::new();
    let zeilen: Vec<Vec<&str>> = text.lines().map(|z| z.split(' ').collect()).collect();
    for (i, z) in zeilen.iter().enumerate() {
        index.insert(z[0], i as u32);
    }
    let eltern: Vec<Vec<u32>> = zeilen.iter().map(|z| z[1..].iter().filter_map(|p| index.get(p).copied()).collect()).collect();
    let ziele: HashMap<u32, &String> = verweise.iter().filter_map(|h| index.get(h.as_str()).map(|&i| (i, h))).collect();
    let mut ergebnis: HashMap<String, Vec<String>> = verweise.iter().map(|h| (h.clone(), vec![])).collect();
    let mut besucht = vec![u32::MAX; zeilen.len()];
    for (n, zeile) in fingerabdruck.lines().enumerate() {
        let Some((spitze, name)) = zeile.split_once(' ') else { continue };
        let Some(&start) = index.get(spitze) else { continue };
        if name.ends_with("/HEAD") {
            continue;
        }
        let mut stapel = vec![start];
        while let Some(k) = stapel.pop() {
            if besucht[k as usize] == n as u32 {
                continue;
            }
            besucht[k as usize] = n as u32;
            if let Some(h) = ziele.get(&k) {
                ergebnis.get_mut(*h).unwrap().push(name.to_string());
            }
            stapel.extend(&eltern[k as usize]);
        }
    }
    ergebnis
}

fn p95(mut werte: Vec<Duration>) -> Duration {
    werte.sort();
    werte[18]
}

fn last() -> String {
    std::fs::read_to_string("/proc/loadavg").unwrap_or_default().split(' ').next().unwrap_or_default().to_string()
}

#[test]
#[ignore = "Lastprobe: nur ausdrücklich, mit --release"]
fn b0998_z1_und_z5_messen() {
    let g = gemeinsam::grosses_repository();
    let r = &g.r;
    let main = gemeinsam::git(r, &["rev-parse", "main~1"]);
    let main_jetzt = gemeinsam::git(r, &["rev-parse", "main"]);
    let (mut zeiten1, mut zeiten5, mut lasten) = (vec![], vec![], vec![]);
    let mut gleich = true;
    for lauf in 0..20 {
        // kalt: vor jedem Lauf bewegt sich ein Zweig, der Fingerabdruck ist neu
        gemeinsam::git(r, &["update-ref", "refs/heads/b29", if lauf % 2 == 0 { &main } else { &main_jetzt }]);
        lasten.push(last());
        let start = Instant::now();
        let f = vorlauf(r, &g.verweise);
        let a = z1(r, &g.verweise);
        git(r, &SPITZEN, None);
        zeiten1.push(start.elapsed());
        let start = Instant::now();
        let f5 = vorlauf(r, &g.verweise);
        let b = z5(r, &g.verweise, &f5);
        git(r, &SPITZEN, None);
        zeiten5.push(start.elapsed());
        let sortiert = |m: HashMap<String, Vec<String>>| m.into_iter().map(|(k, mut v)| (k, { v.sort(); v })).collect::<std::collections::BTreeMap<_, _>>();
        gleich &= f == f5 && sortiert(a) == sortiert(b);
    }
    let (p1, p5) = (p95(zeiten1.clone()), p95(zeiten5.clone()));
    eprintln!("Repository: {} Commits, 50 Zweige (30 lokal, 20 entfernt), ohne commit-graph, 30 Verweise", g.commits);
    eprintln!("Last je Lauf: {}", lasten.join(" "));
    eprintln!("Z1 ms: {:?}", zeiten1.iter().map(Duration::as_millis).collect::<Vec<_>>());
    eprintln!("Z5 ms: {:?}", zeiten5.iter().map(Duration::as_millis).collect::<Vec<_>>());
    eprintln!("p95 Z1 {} ms, Z5 {} ms; gleiche Listen: {gleich}", p1.as_millis(), p5.as_millis());
    assert!(gleich, "Z1 und Z5 liefern verschiedene Listen");
    assert!(p1 < SCHWELLE || p5 < SCHWELLE, "beide Wege reißen die Schwelle: anforderung_falsch");
}
