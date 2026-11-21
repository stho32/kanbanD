// R00219 AK 1, Teil Server (B1125, ADR-0039 Punkt 7): eine Aufgabe mit 1.000 Transkripten (Dateien vorhanden, je 2–4 KB)
// und 1.000 Kosteneinträgen gleicher Kennungen, Release-Build. Nach 5 Aufrufen zum Anwärmen 20 gemessene
// `GET …/transkripte`, gemessen am Client bis zum letzten Byte: p95 (der 19. von 20 sortierten Werten) < 200 ms und die
// Antwort < 250.000 Byte. Tag-Kriterium: nur tagsüber (8–21 Uhr) bei 1-Minuten-Last ≤ 6 beim Start; Lastbeobachtung,
// kein Zeittest im Gate. Läuft nur ausdrücklich:
// `cargo test --release --test lastprobe_r00219 -- --ignored --nocapture`
mod gemeinsam;

use std::fmt::Write as _;
use std::time::{Duration, Instant};

const SCHWELLE: Duration = Duration::from_millis(200);
const GROESSE: usize = 250_000;
const ANZAHL: usize = 1000;

fn p95(mut werte: Vec<Duration>) -> Duration {
    werte.sort();
    werte[18]
}

fn last() -> String {
    std::fs::read_to_string("/proc/loadavg").unwrap_or_default().split(' ').next().unwrap_or_default().to_string()
}

/// Kennung, Zeitpunkt der Datei und Dateiname des Laufs `i`: je Tag 60 Läufe zu Viertelstunden ab 06:00.
fn lauf(i: usize) -> (String, String, String) {
    let (tag, stunde, minute) = (1 + i / 60, 6 + (i % 60) / 4, (i % 4) * 15);
    let rolle = format!("lauf-{i:04}");
    let at = format!("2026-11-{tag:02} {stunde:02}:{minute:02}+01:00");
    let name = format!("{rolle}@2026-11-{tag:02}T{stunde:02}{minute:02}+0100.jsonl.gz");
    (format!("{rolle}@2026-11-{tag:02}T{stunde:02}:{minute:02}+01:00"), at, name)
}

/// Wegwerf-Board mit #1 und 1.000 + 1.000 Einträgen; die Dateien unter `transkripte/0001/` sind 2–4 KB groß und beginnen mit
/// den gzip-Kennbytes (der Server entpackt nicht).
fn board_mit_tausend(ordner: &std::path::Path) {
    for d in ["boards", "aufgaben", "transkripte/0001"] {
        std::fs::create_dir_all(ordner.join(d)).unwrap();
    }
    std::fs::write(ordner.join("kanbanD.md"), "---\nrecord-transcripts: true\npeople:\n  entw1: {name: E, kind: agent}\nclasses: {}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n---\n").unwrap();
    let (mut transkripte, mut kosten) = (String::new(), String::new());
    for i in 0..ANZAHL {
        let (_, at, name) = lauf(i);
        let bytes = 2048 + (i * 7) % 2049;
        let _ = writeln!(transkripte, "  - {{at: {at}, role: lauf-{i:04}, column: Entwicklung, bytes: {bytes}}}");
        let _ = writeln!(kosten, "  - {{at: {at}, role: lauf-{i:04}, column: Entwicklung, amount: 0.42, currency: USD, tokens: 81234}}");
        let mut daten = vec![0x5a; bytes];
        daten[..3].copy_from_slice(&[0x1f, 0x8b, 0x08]);
        std::fs::write(ordner.join("transkripte/0001").join(name), daten).unwrap();
    }
    std::fs::write(ordner.join("transkripte/.gitignore"), "*\n").unwrap();
    std::fs::write(ordner.join("aufgaben/0001-tausend.md"), format!("---\nid: 1\ntitle: Tausend Läufe\ntranscripts:\n{transkripte}cost-entries:\n{kosten}---\n")).unwrap();
    std::fs::write(ordner.join("boards/fabrik.md"), "# fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-tausend.md)\n").unwrap();
    gemeinsam::git(ordner, &["init", "-q"]);
    gemeinsam::git(ordner, &["add", "-A"]);
    gemeinsam::git(ordner, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "tausend"]);
}

#[tokio::test]
#[ignore = "Lastprobe: nur ausdrücklich, mit --release, tagsüber"]
async fn b1125_transkripte_lesen_bei_tausend() {
    let start_last = last();
    let tmp = tempfile::tempdir().unwrap();
    let ordner = tmp.path().join("ordner");
    board_mit_tausend(&ordner);
    let lauf_ = gemeinsam::starten(&ordner, &["--port", "0", "--host", "127.0.0.1"]);
    let client = reqwest::Client::new();
    let url = format!("{}api/aufgaben/1/transkripte", lauf_.adresse);
    let mut groesse = 0;
    for _ in 0..5 {
        let text = client.get(&url).send().await.unwrap().text().await.unwrap();
        groesse = text.len();
    }
    let (mut zeiten, mut lasten) = (vec![], vec![]);
    for _ in 0..20 {
        lasten.push(last());
        let beginn = Instant::now();
        let antwort = client.get(&url).send().await.unwrap();
        let status = antwort.status().as_u16();
        let text = antwort.text().await.unwrap();
        zeiten.push(beginn.elapsed());
        assert_eq!(status, 200, "{text}");
        let v: serde_json::Value = serde_json::from_str(&text).unwrap();
        let eintraege = v["transkripte"].as_array().unwrap();
        assert_eq!(eintraege.len(), ANZAHL);
        assert!(eintraege.iter().all(|e| e["zustand"] == "vorhanden"), "alle Dateien vorhanden");
        assert_eq!(eintraege[0]["kennung"], serde_json::json!(lauf(0).0));
        groesse = text.len();
    }
    let p = p95(zeiten.clone());
    eprintln!("B1125: Last beim Start {start_last}; je Lauf: {}", lasten.join(" "));
    eprintln!("B1125 ms: {:?}", zeiten.iter().map(|d| d.as_micros() as f64 / 1000.0).collect::<Vec<_>>());
    eprintln!("B1125 p95 {:.1} ms, Antwort {groesse} Byte", p.as_micros() as f64 / 1000.0);
    assert!(p < SCHWELLE, "p95 {} ms ≥ 200 ms — Frage an den architekt (ADR-0039 Punkt 7)", p.as_millis());
    assert!(groesse < GROESSE, "Antwort {groesse} Byte ≥ 250.000 — Frage an den architekt (ADR-0039 Punkt 7)");
}
