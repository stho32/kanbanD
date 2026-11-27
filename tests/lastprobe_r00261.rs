// R00123 AK `< 200 ms` (R00261 AK 8, B1414): die Rechnung von `kartenverlauf` über 100 Einträge in 5 Boards. Die
// Lastprobe stand zuerst als `#[ignore]`-Unit-Test in `src/verlauf.rs`; die #239-Zusicherung („keine Ausgabe am
// Protokoll vorbei“, `tests/akzeptanz_r00258_probe.rs`, AK 22) lässt aber kein `eprintln!` in `src/` zu — die Werte
// nennen kann nur ein Test unter `tests/`. Läuft nur ausdrücklich und bei ruhiger Maschine (Last < 2 aus
// `/proc/loadavg`):
//   cargo test --release --test lastprobe_r00261 -- --ignored --nocapture
use chrono::NaiveDateTime;
use kanband::git::Autor;
use kanband::modell::{Board, Spalte};
use kanband::verlauf::{Aufgabenstand, kartenverlauf};
use std::time::Instant;

/// Die 1-Minuten-Last der Maschine aus `/proc/loadavg`.
fn last() -> f64 {
    std::fs::read_to_string("/proc/loadavg").unwrap_or_default().split(' ').next().unwrap_or_default().parse().unwrap_or(f64::MAX)
}

fn zp(s: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M").unwrap()
}

fn autor(wer: &str) -> Autor {
    Autor { name: format!("Name {wer}"), email: format!("{wer}@kanbanD") }
}

/// Ein Board mit den drei Spalten Eingang/In Arbeit/Fertig.
fn board3(e: &[u32], a: &[u32], f: &[u32]) -> Board {
    let s = |name: &str, aufgaben: &[u32]| Spalte { name: name.into(), aufgaben: aufgaben.to_vec(), ..Default::default() };
    Board {
        slug: "fabrik".into(),
        titel: "fabrik".into(),
        spalten: vec![s("Eingang", e), s("In Arbeit", a), s("Fertig", f)],
        termine: vec![],
        anwendungen: None,
        klassen: None,
        start: None,
        fieber: Default::default(),
        berichtsfilter: Default::default(),
        bestand: None,
        eigentuemer_roh: vec![],
        archiviert: None,
        transkripte_erfassen: None,
    }
}

fn auf(zp_str: &str, archiviert: Option<&str>, wer: &str) -> Aufgabenstand {
    Aufgabenstand { zeitpunkt: zp(zp_str), archiviert: archiviert.map(Into::into), autor: autor(wer) }
}

/// Ein Board-Stand im Verlauf: Zeitpunkt, Board, Autor.
type Stand = (NaiveDateTime, Board, Autor);

#[test]
#[ignore = "Lastprobe: nur ausdrücklich, mit --release"]
fn r00123_lastprobe_kartenverlauf_100_eintraege() {
    let l = last();
    eprintln!("R00123 Lastprobe: Last unter 2 nötig (Last jetzt {l:.2})");
    if l >= 2.0 {
        eprintln!("R00123 keine Messung: Last < 2 nötig (Last {l:.2}) — kein Wert gilt als bestanden");
        return;
    }
    let mut boards: Vec<(String, Vec<Stand>)> = vec![];
    for b in 0..5 {
        let staende: Vec<Stand> = (0..20)
            .map(|k| {
                let board = if k % 2 == 0 { board3(&[1], &[], &[]) } else { board3(&[], &[1], &[]) };
                (zp(&format!("2026-10-{:02} 09:00", 1 + k)), board, autor("sh"))
            })
            .collect();
        boards.push((format!("b{b}"), staende));
    }
    let aufgabe = [auf("2026-10-01 09:00", None, "sh")];
    let start = Instant::now();
    let v = kartenverlauf(1, &aufgabe, &boards, None, vec![]);
    let dauer = start.elapsed();
    eprintln!("R00123 Lastprobe: {} Einträge in {} ms, Last {:.2}", v.eintraege.len(), dauer.as_millis(), last());
    assert!(v.eintraege.len() >= 100, "{} Einträge", v.eintraege.len());
    assert!(dauer.as_millis() < 200, "{dauer:?}");
}
