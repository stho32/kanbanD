// R00208 AK 10 (B1029, Hypothese aus ADR-0032 N6.2 und N6.8): 20 kalte Läufe des Gesamt-Diffs gegen das echte Programm
// und das große Wegwerf-Repository (Erzeuger aus B0998, gut 20.000 Commits) — eine Karte mit 30 Kartencommits, gestreut
// zwischen 1.000 fremden (S3 aus ADR-0032 N6 „Belegt“: je Kartencommit eine eigene Datei, die ein fremder Commit danach
// berührt → Folge, jede dritte und die des letzten nur der Karte → netto). Gemessen am Client bis zum letzten Byte, vor jedem
// Lauf bewegt sich ein Zweig. p95 = der 19. von 20 sortierten Werten, Schwelle 500 ms. Dazu die Bytes des Namenslaufs
// für die Spanne mit genau 1.000 fremden Commits gegen `GRENZE_NAMEN`.
// Läuft nur ausdrücklich, mit --release und ruhiger Maschine (Last unter 2):
// `cargo test --release --test lastprobe_r00208 -- --ignored --nocapture`
mod gemeinsam;

use std::fmt::Write as _;
use std::io::Write as _;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const SCHWELLE: Duration = Duration::from_millis(500);

fn p95(mut werte: Vec<Duration>) -> Duration {
    werte.sort();
    werte[18]
}

fn last() -> String {
    std::fs::read_to_string("/proc/loadavg").unwrap_or_default().split(' ').next().unwrap_or_default().to_string()
}

/// Hängt an `main` 30 Kartencommits, gestreut zwischen 1.000 fremden, über `fast-import` an; liefert die Hashes der
/// Kartencommits und aller Commits der Spanne (ältester zuerst) mit ihrem Elternteil.
fn karte_gestreut(r: &std::path::Path) -> (Vec<String>, Vec<(String, String)>) {
    let tip = gemeinsam::git(r, &["rev-parse", "main"]);
    let mut strom = format!("reset refs/heads/main\nfrom {tip}\n");
    let mut marke = 0usize;
    let mut karte = vec![];
    let mut datei = |strom: &mut String, name: &str, inhalt: &str, wer: &str| {
        marke += 1;
        let zeit = 1_800_000_000 + marke * 60;
        let _ = write!(strom, "commit refs/heads/main\nmark :{marke}\ncommitter {wer} <x@x> {zeit} +0000\ndata 1\nx\nM 644 inline {name}\ndata {}\n{inhalt}\n", inhalt.len());
        marke
    };
    let mut fremd = 0;
    for i in 0..30 {
        karte.push(datei(&mut strom, &format!("karte/g{i:02}.txt"), &format!("Karte {i}\n"), "Karte"));
        // jede zehnte Kartendatei bleibt unberührt (netto), die übrigen berührt der nächste fremde Commit (Folge)
        // die 1.000 fremden liegen alle in der Spanne: nach K28 der Rest, nach K29 (dem letzten) keiner
        let anzahl = match i {
            29 => 0,
            28 => 1000 - fremd,
            _ => 1000 / 29,
        };
        for j in 0..anzahl {
            let name = if j == 0 && i % 3 != 0 { format!("karte/g{i:02}.txt") } else { format!("fremd/f{}.txt", fremd % 200) };
            datei(&mut strom, &name, &format!("FREMD {fremd}\n"), "Fremd");
            fremd += 1;
        }
    }
    assert_eq!(fremd, 1000);
    for m in 1..=marke {
        let _ = writeln!(strom, "get-mark :{m}");
    }
    let mut kind = Command::new("git").arg("-C").arg(r).args(["fast-import", "--quiet"]).stdin(Stdio::piped()).stdout(Stdio::piped()).spawn().unwrap();
    let mut eingabe = kind.stdin.take().unwrap();
    let schreiber = std::thread::spawn(move || eingabe.write_all(strom.as_bytes()));
    let aus = kind.wait_with_output().unwrap();
    schreiber.join().unwrap().unwrap();
    assert!(aus.status.success());
    let hashes: Vec<String> = String::from_utf8_lossy(&aus.stdout).lines().map(String::from).collect();
    gemeinsam::git(r, &["reset", "-q", "--hard", "main"]);
    let mut spanne = vec![];
    let mut eltern = tip;
    for h in &hashes {
        spanne.push((h.clone(), eltern.clone()));
        eltern = h.clone();
    }
    (karte.iter().map(|m| hashes[m - 1].clone()).collect(), spanne)
}

#[tokio::test]
#[ignore = "Lastprobe: nur ausdrücklich, mit --release"]
async fn ak10_lastprobe_kalt_ueber_die_api() {
    let g = gemeinsam::grosses_repository();
    let r = &g.r;
    std::fs::write(r.join("Dokumentation/Planung/app.md"), "# App\n").unwrap();
    gemeinsam::git(r, &["-c", "user.name=A", "-c", "user.email=a@a", "add", "-A"]);
    gemeinsam::git(r, &["-c", "user.name=A", "-c", "user.email=a@a", "commit", "-q", "-m", "App"]);
    let (karte, spanne) = karte_gestreut(r);
    // Bytes des Namenslaufs über die Spanne (genau 1.000 fremde) — derselbe Befehl wie im Startort
    let eingabe: String = spanne.iter().map(|(c, e)| format!("{c} {e}\n")).collect();
    let mut kind = Command::new("git").arg("-C").arg(r).args(["diff-tree", "--stdin", "--root", "-r", "--ignore-submodules=none", "-M50%", "-l1000", "--raw", "-z"]).stdin(Stdio::piped()).stdout(Stdio::piped()).spawn().unwrap();
    let mut ziel = kind.stdin.take().unwrap();
    let schreiber = std::thread::spawn(move || ziel.write_all(eingabe.as_bytes()));
    let namen = kind.wait_with_output().unwrap().stdout.len();
    schreiber.join().unwrap().unwrap();
    eprintln!("AK 10 Namenslauf: {namen} Byte für {} Commits (1.000 fremde), GRENZE_NAMEN {}", spanne.len(), kanband::modell::GRENZE_NAMEN);
    assert!(namen < kanband::modell::GRENZE_NAMEN, "fremd_zu_gross griffe vor fremd_zu_viele");

    let tmp = tempfile::tempdir().unwrap();
    let board = tmp.path().canonicalize().unwrap();
    std::fs::create_dir_all(board.join("aufgaben")).unwrap();
    std::fs::create_dir_all(board.join("boards")).unwrap();
    std::fs::write(board.join("kanbanD.md"), format!("---\npeople:\n  entw1: {{name: E, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Dokumentation/Planung/app.md, requirements: \"\"}}\n---\n", r.display())).unwrap();
    let verweise: String = karte.iter().map(|h| format!("  - kd:{h}\n")).collect();
    std::fs::write(board.join("aufgaben/0001-last.md"), format!("---\nid: 1\ntitle: Last\ncommits:\n{verweise}---\n")).unwrap();
    std::fs::write(board.join("boards/fabrik.md"), "# fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-last.md)\n").unwrap();
    gemeinsam::git(&board, &["init", "-q"]);
    gemeinsam::git(&board, &["add", "-A"]);
    gemeinsam::git(&board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "fabrik"]);
    let lauf = gemeinsam::starten(&board, &["--port", "0", "--host", "127.0.0.1"]);
    let client = reqwest::Client::new();
    let spitzen: Vec<String> = (1..=20).map(|i| gemeinsam::git(r, &["rev-parse", &format!("main~{i}")])).collect();
    let (mut zeiten, mut lasten) = (vec![], vec![]);
    for spitze in &spitzen {
        gemeinsam::git(r, &["update-ref", "refs/heads/b29", spitze]);
        lasten.push(last());
        let start = Instant::now();
        let antwort = client.get(format!("{}api/aufgaben/1/diff", lauf.adresse)).send().await.unwrap();
        let status = antwort.status().as_u16();
        let text = antwort.text().await.unwrap();
        zeiten.push(start.elapsed());
        assert_eq!(status, 200, "{text}");
        let v: serde_json::Value = serde_json::from_str(&text).unwrap();
        let dateien = v["dateien"].as_array().unwrap();
        let folge = dateien.iter().filter(|d| d["schritte"].is_array()).count();
        assert_eq!((dateien.len(), folge, v["commits"].as_array().unwrap().len()), (30, 19, 30), "11 netto (jede dritte und die letzte), 19 Folge");
        assert_eq!(v["hinweise"][0], serde_json::json!({"art": "fremd_dazwischen", "commits": 1000, "dateien": 19}));
        assert!(!text.contains("\"+FREMD") && !text.contains("\\n+FREMD"), "nie fremd");
    }
    let p = p95(zeiten.clone());
    eprintln!("AK 10: {} Commits im Repository; Last je Lauf: {}", g.commits + 1 + spanne.len(), lasten.join(" "));
    eprintln!("AK 10 ms: {:?}", zeiten.iter().map(Duration::as_millis).collect::<Vec<_>>());
    eprintln!("AK 10 p95 {} ms", p.as_millis());
    assert!(p < SCHWELLE, "p95 {} ms — anforderung_falsch", p.as_millis());
}
