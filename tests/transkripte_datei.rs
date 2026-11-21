// R00216 (I0206, ADR-0036 Regel 3, 4, 10 und „Durchsetzung“): `transcripts` an der Aufgabe und `record-transcripts` in
// Board-Datei und `kanbanD.md` — Rundlauf, echter Altbestand, Vorversion. B1097 ist die Probe am Stand vor dem Bau.
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{json, Value};
use std::path::Path;

const KOSTEN: &str = "cost-entries:\n  - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, amount: 3.46, currency: USD, tokens: 81234}\n";
const COMMITS: &str = "commits:\n  - kd:3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e\n";
const EIN: &str = "  - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, bytes: 281234}\n";
const ZWEI: &str = "  - {at: 2026-11-13 11:02+01:00, role: code-reviewer, column: Entwicklung, bytes: 1024}\n";
const FORMWIDRIG: &str = "  - {at: gestern, role: x}\n";
const UNBEKANNT: &str = "  - {at: 2026-11-13 12:00+01:00, role: architekt, column: Entwicklung, bytes: 77, model: opus}\n";

/// Board „fabrik“ (Eingang, Entwicklung, Fertig) mit #1 in Entwicklung; `kopf` ins Frontmatter von #1, `board` und
/// `vorgabe` als Frontmatter-Zeilen der Board-Datei bzw. zusätzlich in `kanbanD.md`.
fn fabrik(pfad: &Path, kopf: &str, board: &str, vorgabe: &str) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("aufgaben/0001-a1.md"), format!("---\nid: 1\ntitle: a1\n{kopf}---\n")).unwrap();
    let kopf_board = if board.is_empty() { String::new() } else { format!("---\n{board}---\n\n") };
    std::fs::write(pfad.join("boards/fabrik.md"), format!("{kopf_board}# Fabrik\n\n## Eingang\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-a1.md)\n\n## Fertig\n")).unwrap();
    if !vorgabe.is_empty() {
        let e = gemeinsam::EINSTELLUNGEN.replacen("---\npeople:", &format!("---\n{vorgabe}people:"), 1);
        std::fs::write(pfad.join("kanbanD.md"), e).unwrap();
    }
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
}

async fn holen(adresse: &str, pfad: &str) -> (u16, Value) {
    let r = reqwest::get(format!("{adresse}{pfad}")).await.unwrap();
    (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
}

// B1097 · AK 14a · ADR-0036 „Durchsetzung“ (Format-Test): eine von kanbanD geschriebene Datei mit `cost-entries`,
// `commits` und `transcripts` — 0, 1, 2 Einträge, ein formwidriger, einer mit unbekanntem Schlüssel — übersteht eine
// Titeländerung zeichengleich bis auf den Titel, die Aufgabe ist nicht defekt.
#[tokio::test]
async fn ak14a_datei_mit_transcripts_uebersteht_eine_titelaenderung_zeichengleich() {
    let varianten = [
        ("0 Einträge", String::new()),
        ("1 Eintrag", format!("transcripts:\n{EIN}")),
        ("2 Einträge", format!("transcripts:\n{EIN}{ZWEI}")),
        ("formwidrig", format!("transcripts:\n{EIN}{FORMWIDRIG}")),
        ("unbekannter Schlüssel", format!("transcripts:\n{UNBEKANNT}")),
    ];
    for (name, transkripte) in varianten {
        let tmp = tempfile::tempdir().unwrap();
        let kopf = format!("{KOSTEN}{COMMITS}{transkripte}");
        fabrik(tmp.path(), &kopf, "", "");
        let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
        assert_eq!(holen(&lauf.adresse, "api/aufgaben/1").await.0, 200, "{name}: lesbar, nicht defekt");
        let (s, a) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/1", "st", json!({ "titel": "umbenannt" })).await;
        assert_eq!(s, 200, "{name}: {a}");
        assert_eq!(lies(tmp.path(), "aufgaben/0001-a1.md"), format!("---\nid: 1\ntitle: umbenannt\n{kopf}---\n"), "{name}");
        assert_eq!(holen(&lauf.adresse, "api/aufgaben/1").await.0, 200, "{name}: auch nach dem Schreiben nicht defekt");
    }
}

// B1097 · AK 5 erster Satz · ADR-0036 Regel 4: Board und `kanbanD.md` mit `record-transcripts` überstehen Karte ziehen und
// `PUT /api/einstellungen` mit unverändertem Wert.
#[tokio::test]
async fn ak05_schalter_uebersteht_ziehen_und_einstellungen_speichern() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), "", "record-transcripts: true\n", "record-transcripts: false\n");
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let (s, b) = senden(Method::POST, &lauf.adresse, "api/boards/fabrik/bewegen", "st", json!({ "nummer": 1, "spalte": "Fertig" })).await;
    assert_eq!((s, &b["bewegt"]), (200, &json!(true)), "{b}");
    let (s, mut e) = holen(&lauf.adresse, "api/einstellungen").await;
    assert_eq!(s, 200, "{e}");
    e["personen"].as_array_mut().unwrap().push(json!({ "kuerzel": "neu", "name": "Neue", "art": "agent", "aktiv": true }));
    let (s, a) = senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", e).await;
    assert_eq!(s, 200, "{a}");

    let board = lies(tmp.path(), "boards/fabrik.md");
    assert!(board.starts_with("---\nrecord-transcripts: true\n---\n"), "{board}");
    let vorgabe = lies(tmp.path(), "kanbanD.md");
    assert!(vorgabe.contains("\nneu: {name: Neue, kind: agent}") || vorgabe.contains("  neu: {name: Neue, kind: agent}"), "Person ergänzt: {vorgabe}");
    assert!(vorgabe.contains("\nrecord-transcripts: false\n"), "{vorgabe}");
}

/// Ausschnitt des echten Board-Ordners der Factory vom 2026-11-21: drei Aufgabendateien (#207 mit Preisetikett und
/// Kommentaren, #208, #228), das Board gekürzt auf diese drei und `kanbanD.md` — Kopien, nie die Originale.
const ALTBESTAND: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/altbestaende/kanbanD-board-2026-11-21");

fn altbestand_kopieren(ziel: &Path) {
    for teil in ["boards", "aufgaben"] {
        std::fs::create_dir_all(ziel.join(teil)).unwrap();
        for d in std::fs::read_dir(Path::new(ALTBESTAND).join(teil)).unwrap() {
            let d = d.unwrap();
            std::fs::copy(d.path(), ziel.join(teil).join(d.file_name())).unwrap();
        }
    }
    std::fs::copy(Path::new(ALTBESTAND).join("kanbanD.md"), ziel.join("kanbanD.md")).unwrap();
    git(ziel, &["init", "-q"]);
    git(ziel, &["add", "-A"]);
    git(ziel, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Altbestand"]);
}

fn dateien(ordner: &Path, teil: &str) -> Vec<(String, String)> {
    let mut d: Vec<(String, String)> = std::fs::read_dir(ordner.join(teil)).unwrap().map(|e| e.unwrap()).map(|e| (e.file_name().to_string_lossy().into_owned(), std::fs::read_to_string(e.path()).unwrap())).collect();
    d.sort();
    d
}

// B1097 · AK 14b: der echte Altbestand übersteht Titeländerung und Ziehen zeichengleich bis auf die Änderung; es entsteht
// weder `transcripts` noch `record-transcripts`.
#[tokio::test]
async fn ak14b_echter_altbestand_bleibt_zeichengleich_bis_auf_die_aenderung() {
    let tmp = tempfile::tempdir().unwrap();
    altbestand_kopieren(tmp.path());
    let (aufgaben_vorher, board_vorher) = (dateien(tmp.path(), "aufgaben"), lies(tmp.path(), "boards/entwicklung.md"));
    let vorgabe_vorher = lies(tmp.path(), "kanbanD.md");
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    for nr in [207, 208, 228] {
        let (s, a) = holen(&lauf.adresse, &format!("api/aufgaben/{nr}")).await;
        assert_eq!(s, 200, "#{nr}: {a}");
        let titel = a["titel"].as_str().unwrap().to_string();
        let (s, a) = senden(Method::PATCH, &lauf.adresse, &format!("api/aufgaben/{nr}"), "sh", json!({ "titel": format!("{titel} (geprobt)") })).await;
        assert_eq!(s, 200, "#{nr}: {a}");
    }
    let (s, b) = senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen", "sh", json!({ "nummer": 208, "spalte": "Nacharbeit" })).await;
    assert_eq!((s, &b["bewegt"]), (200, &json!(true)), "{b}");

    for ((name, vorher), (name_nach, nachher)) in aufgaben_vorher.iter().zip(dateien(tmp.path(), "aufgaben")) {
        assert_eq!(name, &name_nach, "der Dateiname bleibt (der Slug folgt dem Titel nicht)");
        let titelzeile = vorher.lines().find(|z| z.starts_with("title: ")).unwrap();
        let erwartet = vorher.replacen(titelzeile, &format!("{titelzeile} (geprobt)"), 1);
        assert_eq!(nachher, erwartet, "{name}: zeichengleich bis auf den Titel");
        assert!(!nachher.contains("\ntranscripts:"), "{name}");
    }
    let zeile = "- [#208](../aufgaben/0208-transkripte-der-agenten-laeufe-an-der-ka.md)\n";
    let erwartet = board_vorher.replacen(&format!("## Entwicklung\n\n{zeile}\n"), "## Entwicklung\n\n", 1).replacen("## Nacharbeit\n\n", &format!("## Nacharbeit\n\n{zeile}\n"), 1);
    assert_eq!(lies(tmp.path(), "boards/entwicklung.md"), erwartet, "Board zeichengleich bis auf den Zug");
    assert!(!lies(tmp.path(), "boards/entwicklung.md").contains("record-transcripts"));
    assert_eq!(lies(tmp.path(), "kanbanD.md"), vorgabe_vorher);
}

// B1097 · AK 14b, AK 7 der API (FA 7): am Altbestand liefert `GET` die leeren Felder `transkripte` und `transkripte_erfassen`.
#[tokio::test]
async fn ak14b_altbestand_liefert_leere_transkripte_und_keinen_schalter() {
    let tmp = tempfile::tempdir().unwrap();
    altbestand_kopieren(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    for nr in [207, 208, 228] {
        let (s, a) = holen(&lauf.adresse, &format!("api/aufgaben/{nr}")).await;
        assert_eq!((s, &a["transkripte"]), (200, &json!([])), "#{nr}");
    }
    let (s, b) = holen(&lauf.adresse, "api/boards/entwicklung").await;
    assert_eq!(s, 200, "{b}");
    assert!(b.as_object().unwrap().contains_key("transkripte_erfassen"), "Feld vorhanden: {b}");
    assert_eq!(b["transkripte_erfassen"], Value::Null);
}

// B1097 · AK 14c: die Vorversion (main 673ac073) schreibt `transcripts` als unbekannten Schlüssel in Blockform zurück — eine
// Datei mit genau einem Eintrag, wie sie sie nach einer Titeländerung hinterlässt, liegt als Beleg unter
// tests/altbestaende/main-673ac073/. Diese Version liest sie, die Aufgabe ist nicht defekt, der Eintrag ist da; das nächste
// Schreiben macht die Flusszeile daraus.
#[tokio::test]
async fn ak14c_beleg_der_vorversion_wird_gelesen_und_beim_schreiben_zur_flusszeile() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), "", "", "");
    let alt = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/altbestaende/main-673ac073/transcripts-ein-eintrag.md")).unwrap();
    std::fs::write(tmp.path().join("aufgaben/0001-a1.md"), alt).unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let (s, a) = holen(&lauf.adresse, "api/aufgaben/1").await;
    assert_eq!(s, 200, "{a}");
    assert_eq!(a["transkripte"], json!([{ "kennung": "entwickler@2026-11-13T10:34+01:00", "at": "2026-11-13 10:34+01:00", "role": "entwickler", "column": "Entwicklung", "bytes": 55 }]));
    let (s, a) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/1", "st", json!({ "titel": "umbenannt" })).await;
    assert_eq!(s, 200, "{a}");
    assert_eq!(lies(tmp.path(), "aufgaben/0001-a1.md"), "---\nid: 1\ntitle: umbenannt\ntranscripts:\n  - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, bytes: 55}\n---\n");
}

// B1098 · FA 7, AK 10 (formwidrig), AK 15: `GET /api/aufgaben/{nr}` und die Liste liefern die gespeicherten lesbaren
// Einträge in der Reihenfolge der Datei, mit Kennung; ein formwidriger Eintrag macht die Aufgabe nicht defekt.
#[tokio::test]
async fn b1098_get_liefert_die_gespeicherten_eintraege() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), &format!("transcripts:\n{EIN}{FORMWIDRIG}{ZWEI}"), "", "");
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let erwartet = json!([
        { "kennung": "entwickler@2026-11-13T10:34+01:00", "at": "2026-11-13 10:34+01:00", "role": "entwickler", "column": "Entwicklung", "bytes": 281234 },
        { "kennung": "code-reviewer@2026-11-13T11:02+01:00", "at": "2026-11-13 11:02+01:00", "role": "code-reviewer", "column": "Entwicklung", "bytes": 1024 },
    ]);
    let (s, a) = holen(&lauf.adresse, "api/aufgaben/1").await;
    assert_eq!((s, &a["transkripte"]), (200, &erwartet), "{a}");
    let (s, liste) = holen(&lauf.adresse, "api/aufgaben").await;
    assert_eq!(s, 200, "{liste}");
    let eins = liste["aufgaben"].as_array().or(liste.as_array()).unwrap().iter().find(|a| a["nummer"] == 1).unwrap().clone();
    assert_eq!(eins["transkripte"], erwartet);
    let (s, z) = holen(&lauf.adresse, "api/zustand").await;
    assert_eq!((s, &z["defekte"]), (200, &json!([])), "{z}");
}

// B1098 · AK 13d: Duplizieren nimmt `transcripts` nicht mit; die Quelle bleibt.
#[tokio::test]
async fn ak13d_duplizieren_nimmt_transcripts_nicht_mit() {
    let tmp = tempfile::tempdir().unwrap();
    let kopf = format!("transcripts:\n{EIN}");
    fabrik(tmp.path(), &kopf, "", "");
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let (s, kopie) = senden(Method::POST, &lauf.adresse, "api/aufgaben/1/duplizieren", "st", json!({})).await;
    assert_eq!(s, 201, "{kopie}");
    let nr = kopie["nummer"].as_u64().unwrap();
    assert_eq!(holen(&lauf.adresse, &format!("api/aufgaben/{nr}")).await.1["transkripte"], json!([]));
    let text = std::fs::read_dir(tmp.path().join("aufgaben")).unwrap().map(|e| e.unwrap().path()).find(|p| p.file_name().unwrap().to_string_lossy().starts_with(&format!("{nr:04}-"))).map(|p| std::fs::read_to_string(p).unwrap()).unwrap();
    assert!(!text.contains("transcripts"), "{text}");
    assert_eq!(lies(tmp.path(), "aufgaben/0001-a1.md"), format!("---\nid: 1\ntitle: a1\n{kopf}---\n"), "die Quelle bleibt");
}
