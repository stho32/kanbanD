// R00206 AK 15 (B1014, Hypothese aus ADR-0032 Punkt 9): 20 kalte Läufe von `GET …/diff` gegen das echte Programm und
// das große Wegwerf-Repository (Erzeuger aus B0998, gut 20.000 Commits) — ein Commit mit 10 Dateien zu je rund 100 KB
// Patch (zusammen rund 1 MB) und `datei=` auf eine Datei von 1 MB; gemessen am Client von der Anfrage bis zum letzten
// Byte, vor jedem Lauf bewegt sich ein Zweig. p95 = der 19. von 20 sortierten Werten, Schwelle 500 ms.
// Läuft nur ausdrücklich, mit --release und ruhiger Maschine (Last unter 2):
// `cargo test --release --test lastprobe_r00206 -- --ignored --nocapture`
mod gemeinsam;

use std::time::{Duration, Instant};

const SCHWELLE: Duration = Duration::from_millis(500);

fn p95(mut werte: Vec<Duration>) -> Duration {
    werte.sort();
    werte[18]
}

fn last() -> String {
    std::fs::read_to_string("/proc/loadavg").unwrap_or_default().split(' ').next().unwrap_or_default().to_string()
}

#[tokio::test]
#[ignore = "Lastprobe: nur ausdrücklich, mit --release"]
async fn ak15_lastprobe_kalt_ueber_die_api() {
    let g = gemeinsam::grosses_repository();
    let r = &g.r;
    std::fs::write(r.join("Dokumentation/Planung/app.md"), "# App\n").unwrap();
    // 10 Dateien zu je 1.000 Zeilen aus 99 Zeichen: Patch je Datei rund 101 KB, zusammen rund 1 MB
    for i in 0..10 {
        std::fs::write(r.join(format!("last{i}.txt")), (0..1000).map(|z| format!("{i:02}{z:04}{}\n", "x".repeat(93))).collect::<String>()).unwrap();
    }
    // eine Datei von 1 MB für datei=
    std::fs::write(r.join("eine.txt"), (0..10_000).map(|z| format!("{z:06}{}\n", "y".repeat(93))).collect::<String>()).unwrap();
    gemeinsam::git(r, &["-c", "user.name=A", "-c", "user.email=a@a", "add", "-A"]);
    gemeinsam::git(r, &["-c", "user.name=A", "-c", "user.email=a@a", "commit", "-q", "-m", "Last"]);
    let commit = gemeinsam::git(r, &["rev-parse", "HEAD"]);
    let tmp = tempfile::tempdir().unwrap();
    let board = tmp.path().canonicalize().unwrap();
    std::fs::create_dir_all(board.join("aufgaben")).unwrap();
    std::fs::create_dir_all(board.join("boards")).unwrap();
    std::fs::write(board.join("kanbanD.md"), format!("---\npeople:\n  entw1: {{name: E, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Dokumentation/Planung/app.md, requirements: \"\"}}\n---\n", r.display())).unwrap();
    std::fs::write(board.join("aufgaben/0001-last.md"), format!("---\nid: 1\ntitle: Last\ncommits:\n  - kd:{commit}\n---\n")).unwrap();
    std::fs::write(board.join("boards/fabrik.md"), "# fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-last.md)\n").unwrap();
    gemeinsam::git(&board, &["init", "-q"]);
    gemeinsam::git(&board, &["add", "-A"]);
    gemeinsam::git(&board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "fabrik"]);
    let lauf = gemeinsam::starten(&board, &["--port", "0"]);
    let client = reqwest::Client::new();
    let spitzen: Vec<String> = (1..=20).map(|i| gemeinsam::git(r, &["rev-parse", &format!("main~{i}")])).collect();
    let mut ergebnisse = vec![];
    for (name, abfrage, patchbytes) in [("Liste", format!("commit=kd:{commit}"), (900_000usize, 1_100_000usize)), ("datei=", format!("commit=kd:{commit}&datei=eine.txt"), (1_000_000, 1_100_000))] {
        let (mut zeiten, mut lasten) = (vec![], vec![]);
        for spitze in &spitzen {
            gemeinsam::git(r, &["update-ref", "refs/heads/b29", spitze]);
            lasten.push(last());
            let start = Instant::now();
            let antwort = client.get(format!("{}api/aufgaben/1/diff?{abfrage}", lauf.adresse)).send().await.unwrap();
            let status = antwort.status().as_u16();
            let text = antwort.text().await.unwrap();
            zeiten.push(start.elapsed());
            assert_eq!(status, 200, "{text}");
            let v: serde_json::Value = serde_json::from_str(&text).unwrap();
            let summe: usize = v["dateien"].as_array().unwrap().iter().filter_map(|d| d["patch"].as_str()).map(str::len).sum();
            assert!(summe >= patchbytes.0 && summe <= patchbytes.1, "{name}: {summe} Byte Patch");
            assert!(v["dateien"].as_array().unwrap().iter().all(|d| d["nachladen"] == false), "{name}: alles in einer Antwort");
        }
        let p = p95(zeiten.clone());
        eprintln!("AK 15 {name}: {} Commits; Last je Lauf: {}", g.commits + 1, lasten.join(" "));
        eprintln!("AK 15 {name} ms: {:?}", zeiten.iter().map(Duration::as_millis).collect::<Vec<_>>());
        eprintln!("AK 15 {name} p95 {} ms", p.as_millis());
        ergebnisse.push((name, p));
    }
    for (name, p) in ergebnisse {
        assert!(p < SCHWELLE, "{name}: p95 {} ms — anforderung_falsch", p.as_millis());
    }
}
