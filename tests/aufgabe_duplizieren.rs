// R00142 Karte duplizieren (I0130, F0113): Kopie über POST /api/aufgaben/{nr}/duplizieren
mod gemeinsam;

use gemeinsam::{git, lies};
use serde_json::{Value, json};
use std::path::Path;

const EINSTELLUNGEN: &str = "---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses:\n  feature: {label: Funktion, color: green}\nsignals:\n  warn: {label: Achtung, color: amber}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {name: Kasse, wbs: \"\", requirements: \"\"}\n---\n";

/// #1 „Rechnung prüfen“ mit allen Feldern; #1 liegt in „In Arbeit“.
const QUELLE: &str = "---\nid: 1\ntitle: Rechnung prüfen\nkey: EXT-4711\nclass: feature\nassignees: [st]\nlabels: [doku]\ndue: 2026-11-20\norigins: [kd:I0005]\nsignals: [warn]\nreservation: {who: cl, instance: sensor-1, since: 2026-11-11 08:00+01:00}\ncost:\n  currency: USD\n  amount: 17.00\nestimate: 30\nphases:\n  skipped: [Abnahme]\nreporting:\n  burndown: false\nwbs-effects:\n  - {application: kd, action: create, node: I0048}\n---\nDie Rechnung gegen die Bestellung prüfen.\n- [x] Positionen vergleichen\n- [ ] Summe nachrechnen\n- [x] Lieferdatum prüfen\n\n```kanbanD-time\n2026-11-10 09:00+01:00 · 2026-11-10 10:00+01:00 · st\n2026-11-11 08:30+01:00 · … · cl\n```\n\n```kanbanD-comments\n2026-11-10 10:05+01:00 · st · Bitte heute prüfen\n```\n";

const BOARD: &str = "# Entwicklung\n\n## Eingang\n\n## In Arbeit\n\n- [#1](../aufgaben/0001-rechnung-pruefen.md)\n\n## Fertig\n";

/// Ordner mit Board „entwicklung“, #1 in „In Arbeit“ und seinem Anhangsordner; Kopf des Board-Frontmatter frei.
fn grundbestand(pfad: &Path, frontmatter: &str, board: &str) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben/0001-rechnung-pruefen")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), EINSTELLUNGEN).unwrap();
    std::fs::write(pfad.join("boards/entwicklung.md"), format!("{frontmatter}{board}")).unwrap();
    std::fs::write(pfad.join("aufgaben/0001-rechnung-pruefen.md"), QUELLE).unwrap();
    std::fs::write(pfad.join("aufgaben/0001-rechnung-pruefen/bestellung.txt"), "Bestellung\n").unwrap();
    git(pfad, &["init", "-q"]);
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
}

fn eingerichtet(pfad: &Path) {
    grundbestand(pfad, "", BOARD);
}

/// Aufruf als Person; `daten` fehlt ganz (None) für „ohne Rumpf“.
async fn duplizieren(adresse: &str, wer: &str, nr: u32, daten: Option<Value>) -> (u16, Value) {
    let mut r = reqwest::Client::new().post(format!("{adresse}api/aufgaben/{nr}/duplizieren")).header("X-KanbanD-Wer", wer);
    if let Some(d) = daten {
        r = r.json(&d);
    }
    let r = r.send().await.unwrap();
    let status = r.status().as_u16();
    (status, serde_json::from_str(&r.text().await.unwrap()).unwrap_or(Value::Null))
}

fn commits(pfad: &Path) -> usize {
    git(pfad, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

fn dateien(pfad: &Path) -> Vec<String> {
    let mut alle: Vec<String> = ["aufgaben", "boards"]
        .iter()
        .flat_map(|o| std::fs::read_dir(pfad.join(o)).unwrap())
        .flat_map(|e| {
            let pfad = e.unwrap().path();
            if pfad.is_dir() {
                let mut innen: Vec<String> = std::fs::read_dir(&pfad).unwrap().map(|f| f.unwrap().path().display().to_string()).collect();
                innen.sort();
                innen
            } else {
                vec![pfad.display().to_string()]
            }
        })
        .collect();
    alle.sort();
    alle
}

fn spalte(board: &str, name: &str) -> Vec<u32> {
    board
        .split(&format!("## {name}\n\n"))
        .nth(1)
        .unwrap_or("")
        .lines()
        .take_while(|z| !z.starts_with("## "))
        .filter_map(|z| z.split('#').nth(1)?.split(|c: char| !c.is_ascii_digit()).next()?.parse().ok())
        .collect()
}

#[tokio::test]
async fn kopie_traegt_die_grundfelder_und_nichts_von_der_quelle() {
    let tmp = tempfile::tempdir().unwrap();
    eingerichtet(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());
    let (s, a) = duplizieren(&lauf.adresse, "st", 1, Some(json!({"board": "entwicklung", "spalte": "In Arbeit"}))).await;

    assert_eq!(s, 201, "{a}");
    assert_eq!((a["nummer"].as_u64(), a["datei"].as_str()), (Some(2), Some("0002-rechnung-pruefen-kopie.md")), "{a}");
    assert!(tmp.path().join("aufgaben/0002-rechnung-pruefen-kopie.md").exists(), "Aufgabendatei fehlt");
    // AK 2: was die Kopie trägt
    assert_eq!(a["titel"], "Rechnung prüfen (Kopie)");
    assert_eq!(a["beschreibung"], "Die Rechnung gegen die Bestellung prüfen.");
    let teile: Vec<(String, bool)> = a["teilaufgaben"].as_array().unwrap().iter().map(|t| (t["text"].as_str().unwrap().to_string(), t["erledigt"].as_bool().unwrap())).collect();
    let erwartet: Vec<(String, bool)> = ["Positionen vergleichen", "Summe nachrechnen", "Lieferdatum prüfen"].iter().map(|t| (t.to_string(), false)).collect();
    assert_eq!(teile, erwartet, "alle Teilaufgaben offen");
    assert_eq!(a["klasse"], "feature");
    assert_eq!(a["zustaendige"], json!(["st"]));
    assert_eq!(a["labels"], json!(["doku"]));
    assert_eq!(a["faellig"], "2026-11-20");
    assert_eq!(a["herkunft"], json!(["kd:I0005"]));
    // AK 3: was die Kopie nicht trägt
    assert!(a["key"].is_null(), "key kopiert: {a}");
    assert_eq!(a["zeiten"], json!([]), "Zeiten kopiert");
    assert_eq!(a["kommentare"], json!([]), "Kommentare kopiert");
    assert_eq!(a["durchlaeufe"], json!([]), "Durchläufe kopiert");
    assert!(a["archiviert"].is_null(), "Archivstand kopiert");
    assert!(a["reservierung"].is_null(), "Reservierung kopiert");
    assert!(a["cost"].is_null(), "Preisetikett kopiert");
    assert_eq!(a["signale"], json!([]), "Signale kopiert");
    assert_eq!(a["wirkungen"], json!([]), "WBS-Wirkungen kopiert");
    assert_eq!(a["phasen"]["uebersprungen"], json!([]), "Phasen-Übersprung kopiert");
    assert!(a["reporting"].as_object().unwrap().is_empty(), "Berichts-Zählung kopiert: {}", a["reporting"]);
    assert!(!tmp.path().join("aufgaben/0002-rechnung-pruefen-kopie").exists(), "Anhangsordner kopiert");
    let text = lies(tmp.path(), "aufgaben/0002-rechnung-pruefen-kopie.md");
    for schluessel in ["key:", "signals:", "cost:", "estimate:", "phases:", "reporting:", "wbs-effects:", "reservation:", "archived:"] {
        assert!(!text.contains(schluessel), "„{schluessel}“ steht in der Kopie:\n{text}");
    }
    // AK 1 und 9: unten in derselben Spalte, genau ein Commit, Wortlaut
    assert_eq!(spalte(&lies(tmp.path(), "boards/entwicklung.md"), "In Arbeit"), [1, 2], "Kopie gehört unten in „In Arbeit“");
    assert_eq!(commits(tmp.path()), vorher + 1, "genau ein Commit");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#2 dupliziert (aus #1) in „In Arbeit“ (entwicklung)");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=", "HEAD"]), "aufgaben/0002-rechnung-pruefen-kopie.md\nboards/entwicklung.md");
    assert_eq!(git(tmp.path(), &["status", "--short"]), "", "Arbeitsbaum sauber");
}

#[tokio::test]
async fn zweimal_duplizieren_ergibt_eine_zweite_kopie_und_laesst_die_erste_stehen() {
    let tmp = tempfile::tempdir().unwrap();
    eingerichtet(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, a) = duplizieren(&lauf.adresse, "st", 1, Some(json!({"board": "entwicklung", "spalte": "In Arbeit"}))).await;
    assert_eq!((s, a["nummer"].as_u64()), (201, Some(2)), "{a}");
    let erste = lies(tmp.path(), "aufgaben/0002-rechnung-pruefen-kopie.md");
    let (s, b) = duplizieren(&lauf.adresse, "st", 1, Some(json!({"board": "entwicklung", "spalte": "In Arbeit"}))).await;
    assert_eq!((s, b["nummer"].as_u64(), b["titel"].as_str()), (201, Some(3), Some("Rechnung prüfen (Kopie)")), "{b}");
    assert_eq!(lies(tmp.path(), "aufgaben/0002-rechnung-pruefen-kopie.md"), erste, "#2 blieb unberührt");
    assert_eq!(spalte(&lies(tmp.path(), "boards/entwicklung.md"), "In Arbeit"), [1, 2, 3]);
}

#[tokio::test]
async fn ohne_board_entsteht_nur_die_aufgabendatei() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path(), "", "# Entwicklung\n\n## Eingang\n\n## In Arbeit\n\n## Fertig\n");
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let board = lies(tmp.path(), "boards/entwicklung.md");
    let vorher = commits(tmp.path());
    for (rumpf, nummer) in [(Some(json!({})), 2), (None, 3)] {
        let (s, a) = duplizieren(&lauf.adresse, "st", 1, rumpf).await;
        assert_eq!((s, a["nummer"].as_u64()), (201, Some(nummer)), "{a}");
    }
    assert_eq!(lies(tmp.path(), "boards/entwicklung.md"), board, "keine Board-Zeile");
    assert_eq!(commits(tmp.path()), vorher + 2);
}

#[tokio::test]
async fn wip_grenze_weist_den_agenten_ab_und_laesst_den_menschen_durch() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path(), "---\nlimits:\n  In Arbeit: 1\n---\n\n", BOARD);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = (git(tmp.path(), &["rev-parse", "HEAD"]), dateien(tmp.path()));
    let (s, f) = duplizieren(&lauf.adresse, "cl", 1, Some(json!({"board": "entwicklung", "spalte": "In Arbeit"}))).await;
    assert_eq!(s, 409, "{f}");
    assert_eq!(f, json!({"fehler": "Grenze erreicht", "spalte": "In Arbeit", "grenze": 1, "anzahl": 1}));
    assert_eq!((git(tmp.path(), &["rev-parse", "HEAD"]), dateien(tmp.path())), vorher, "nichts geschrieben");
    let (s, a) = duplizieren(&lauf.adresse, "st", 1, Some(json!({"board": "entwicklung", "spalte": "In Arbeit"}))).await;
    assert_eq!((s, a["nummer"].as_u64()), (201, Some(2)), "der Mensch wird ohne Warnung durchgelassen: {a}");
}

#[tokio::test]
async fn menschen_spalte_sperrt_das_duplizieren_nicht() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path(), "---\ncolumn-owner:\n  In Arbeit: human\n---\n\n", BOARD);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, a) = duplizieren(&lauf.adresse, "cl", 1, Some(json!({"board": "entwicklung", "spalte": "In Arbeit"}))).await;
    assert_eq!((s, a["nummer"].as_u64()), (201, Some(2)), "Hineinlegen ist erlaubt: {a}");
    assert_eq!(spalte(&lies(tmp.path(), "boards/entwicklung.md"), "In Arbeit"), [1, 2]);
}

#[tokio::test]
async fn unbekannt_ist_404_und_defekt_423_und_beides_aendert_nichts() {
    let tmp = tempfile::tempdir().unwrap();
    eingerichtet(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = (git(tmp.path(), &["rev-parse", "HEAD"]), dateien(tmp.path()));
    assert_eq!(duplizieren(&lauf.adresse, "st", 99, None).await.0, 404);
    assert_eq!((git(tmp.path(), &["rev-parse", "HEAD"]), dateien(tmp.path())), vorher, "404 schreibt nichts");
    std::fs::write(tmp.path().join("aufgaben/0001-rechnung-pruefen.md"), "---\nid: [\n---\n").unwrap();
    git(tmp.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-am", "defekt"]);
    let vorher = (git(tmp.path(), &["rev-parse", "HEAD"]), dateien(tmp.path()));
    let (s, f) = duplizieren(&lauf.adresse, "st", 1, None).await;
    assert_eq!(s, 423, "{f}");
    assert_eq!((git(tmp.path(), &["rev-parse", "HEAD"]), dateien(tmp.path())), vorher, "423 schreibt nichts");
}
