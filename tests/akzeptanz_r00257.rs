// R00257 (I0247, Karte #241): Sammelwege lesen den Aufgabenordner einmal je Anfrage, höchstens 5000 Einträge.
// Schichten: Testfall (je AK) → Testsprache (`lage_pfadregel`, `stand`, `rumpf`) → Treiber (`senden`: URL, Methode,
// Status) → Programm. Die Listing-Probe (AK 1) und die Lebensdauer (AK 3) stehen als Modultests in `src/dienst/mod.rs`,
// weil der Listing-Zähler nur unter `cfg(test)` übersetzt ist (ADR-0044 Prüfliste 1).
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{json, Value};
use std::path::Path;

/// Der Wortlaut der 400 an allen sieben Sammelwegen (PO Z. 670, R00257 AK 4) — ohne Tausendertrenner.
fn grenzmeldung(n: usize) -> String {
    format!("Zu viele Einträge in einer Sammelanfrage: {n}, höchstens 5000 sind erlaubt. Bitte in Teilen senden.")
}

/// Die sieben Sammelwege der ADR-0044 E2 in der Reihenfolge der Anforderung.
const WEGE: [&str; 7] = ["patch", "archivieren", "zurueckholen", "anlegen", "auf-board", "bewegen", "teilaufgaben"];

fn methode(weg: &str) -> Method {
    if weg == "patch" { Method::PATCH } else { Method::POST }
}

fn pfad(weg: &str) -> &'static str {
    match weg {
        "patch" | "anlegen" => "api/aufgaben/mehrere",
        "archivieren" => "api/aufgaben/archivieren",
        "zurueckholen" => "api/aufgaben/zurueckholen",
        "auf-board" => "api/boards/entwicklung/aufgaben/mehrere",
        "bewegen" => "api/boards/entwicklung/bewegen-mehrere",
        "teilaufgaben" => "api/aufgaben/1/teilaufgaben/mehrere",
        anders => panic!("kein Sammelweg {anders}"),
    }
}

/// Der Rumpf je Weg mit `n` Einträgen — jeweils die Liste, die der Weg zählt (R00257 AK 4).
fn rumpf(weg: &str, n: usize) -> Value {
    let nummern = || json!((0..n).map(|i| 100_000 + i as u64).collect::<Vec<_>>());
    match weg {
        "patch" => json!({"aenderungen": (0..n).map(|i| json!({"nummer": 100_000 + i as u64, "titel": "x"})).collect::<Vec<_>>()}),
        "archivieren" | "zurueckholen" | "auf-board" => json!({"nummern": nummern()}),
        "anlegen" => json!({"titel": (0..n).map(|i| format!("t{i}")).collect::<Vec<_>>()}),
        "bewegen" => json!({"ziele": (0..n).map(|i| json!({"nummer": 100_000 + i as u64, "spalte": "Zu erledigen"})).collect::<Vec<_>>()}),
        "teilaufgaben" => json!({"texte": (0..n).map(|i| format!("t{i}")).collect::<Vec<_>>()}),
        anders => panic!("kein Sammelweg {anders}"),
    }
}

/// Ausgangslage der Pfadregel-Proben (R00257 AK 2): #7 in `0007-sieben.md`, eine defekte `0008-kaputt.md` (unlesbares
/// `estimate`), #9 in der von Hand benannten `von-hand.md`, keine Datei für #99.
fn lage_pfadregel(ordner: &Path) {
    std::fs::create_dir_all(ordner.join("boards")).unwrap();
    std::fs::create_dir_all(ordner.join("aufgaben")).unwrap();
    std::fs::write(ordner.join("kanbanD.md"), gemeinsam::EINSTELLUNGEN).unwrap();
    std::fs::write(ordner.join("boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n## Erledigt\n").unwrap();
    std::fs::write(ordner.join("aufgaben/0007-sieben.md"), "---\nid: 7\ntitle: sieben\n---\n").unwrap();
    std::fs::write(ordner.join("aufgaben/0008-kaputt.md"), "---\nid: 8\ntitle: kaputt\nestimate: abc\n---\n").unwrap();
    std::fs::write(ordner.join("aufgaben/von-hand.md"), "---\nid: 9\ntitle: neun\n---\n").unwrap();
    git(ordner, &["init", "-q"]);
    git(ordner, &["add", "-A"]);
    git(ordner, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgangslage"]);
}

/// Der beobachtbare Stand des Ordners: Zahl der Commits und der Arbeitsbaum — beide bleiben bei einer abgewiesenen
/// Anfrage gleich (kein Schreiben, kein Commit).
fn stand(ordner: &Path) -> (String, String) {
    (git(ordner, &["rev-list", "--count", "HEAD"]), git(ordner, &["status", "--porcelain"]))
}

// ---- AK 2: Pfadregel im Sammelweg gleich dem Einzelweg (US-2) ---------------------------------------------------------

#[tokio::test]
async fn ak2_sammelweg_und_einzelweg_finden_dieselbe_datei() {
    let tmp = tempfile::tempdir().unwrap();
    lage_pfadregel(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let eine = |nummer: u32, titel: &str| json!({"aenderungen": [{"nummer": nummer, "titel": titel}]});
    // 7 → ändert `0007-sieben.md`
    assert_eq!(senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", eine(7, "sieben neu")).await.0, 200);
    assert!(lies(tmp.path(), "aufgaben/0007-sieben.md").contains("title: sieben neu"));
    // 8 → 423 wie der Einzelweg (die defekte Datei bleibt über den Dateinamen auffindbar)
    assert_eq!(senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", eine(8, "acht")).await.0, 423);
    assert_eq!(senden(Method::PATCH, &lauf.adresse, "api/aufgaben/8", "st", json!({"titel": "acht"})).await.0, 423);
    // 9 → ändert `von-hand.md` (der Inhalt entscheidet)
    assert_eq!(senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", eine(9, "neun neu")).await.0, 200);
    assert!(lies(tmp.path(), "aufgaben/von-hand.md").contains("title: neun neu"));
    // 99 → 404 wie der Einzelweg
    assert_eq!(senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", eine(99, "x")).await.0, 404);
    assert_eq!(senden(Method::PATCH, &lauf.adresse, "api/aufgaben/99", "st", json!({"titel": "x"})).await.0, 404);
    // 7 und 99 zusammen → 404, `0007-sieben.md` zeichengleich, kein Commit
    let (vorher, commits) = (lies(tmp.path(), "aufgaben/0007-sieben.md"), git(tmp.path(), &["rev-list", "--count", "HEAD"]));
    assert_eq!(senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", json!({"aenderungen": [{"nummer": 7, "titel": "anders"}, {"nummer": 99, "titel": "x"}]})).await.0, 404);
    assert_eq!(lies(tmp.path(), "aufgaben/0007-sieben.md"), vorher, "zeichengleich");
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]), commits, "kein Commit");
    // dieselben Nummern über Archivieren und Auf-Board-Legen
    for (nummer, erwartet) in [(7u32, 200u16), (8, 423), (9, 200), (99, 404)] {
        let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben/archivieren", "st", json!({"nummern": [nummer]})).await;
        assert_eq!(s, erwartet, "archivieren #{nummer}: {a}");
    }
    for (nummer, erwartet) in [(7u32, 200u16), (8, 423), (9, 200), (99, 404)] {
        let (s, a) = senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/aufgaben/mehrere", "st", json!({"nummern": [nummer]})).await;
        assert_eq!(s, erwartet, "auf Board legen #{nummer}: {a}");
    }
}

// ---- AK 4: die Grenze an allen sieben Wegen, vor der Sperre (US-3) ---------------------------------------------------

#[tokio::test]
async fn ak4_grenze_an_allen_sieben_wegen_vor_der_sperre() {
    let tmp = tempfile::tempdir().unwrap();
    lage_pfadregel(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    // 5001 Einträge → 400 mit dem Wortlaut, Ordner zeichengleich, kein Commit
    for weg in WEGE {
        let vorher = stand(tmp.path());
        let (s, a) = senden(methode(weg), &lauf.adresse, pfad(weg), "st", rumpf(weg, 5001)).await;
        assert_eq!(s, 400, "{weg}: {a}");
        assert_eq!(a["fehler"], json!(grenzmeldung(5001)), "{weg}");
        assert_eq!(stand(tmp.path()), vorher, "{weg}: nichts geschrieben, kein Commit");
    }
    // 12000 Einträge → die Zahl steht in der Meldung (ohne Tausendertrenner)
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben/archivieren", "st", rumpf("archivieren", 12_000)).await;
    assert_eq!((s, a["fehler"].as_str().unwrap_or_default()), (400, grenzmeldung(12_000).as_str()));
    // 5001 Einträge, darunter #100000 doppelt → die Grenzmeldung, nicht „#… doppelt in der Anfrage“
    let mut doppelt = rumpf("archivieren", 5001);
    doppelt["nummern"][1] = json!(100_000);
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben/archivieren", "st", doppelt).await;
    assert_eq!((s, a["fehler"].as_str().unwrap_or_default()), (400, grenzmeldung(5001).as_str()));
    // 5000 Einträge kommen nicht an die Grenze: der Weg läuft weiter (5000 unbekannte Nummern → 404)
    for weg in ["archivieren", "zurueckholen", "auf-board", "bewegen"] {
        let (s, a) = senden(methode(weg), &lauf.adresse, pfad(weg), "st", rumpf(weg, 5000)).await;
        assert_eq!(s, 404, "{weg}: {a}");
        assert_ne!(a["fehler"], json!(grenzmeldung(5000)), "{weg}: nicht die Grenzmeldung");
    }
    // 5000 Titel → 201 (angelegt); 5000 unbekannte Änderungen → 404; 5000 Teilaufgaben → 200
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/aufgaben/mehrere", "st", rumpf("anlegen", 5000)).await.0, 201);
    assert_eq!(senden(Method::PATCH, &lauf.adresse, "api/aufgaben/mehrere", "st", rumpf("patch", 5000)).await.0, 404);
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/aufgaben/1/teilaufgaben/mehrere", "st", rumpf("teilaufgaben", 5000)).await.0, 200);
    // eine leere Liste behält ihre heutige Antwort (nicht die Grenzmeldung)
    for weg in WEGE {
        let (s, a) = senden(methode(weg), &lauf.adresse, pfad(weg), "st", rumpf(weg, 0)).await;
        assert_ne!(a["fehler"], json!(grenzmeldung(0)), "{weg}: leere Liste ist keine Grenzverletzung ({s})");
    }
}

// ---- AK 6: doppelte Nummern und Board-Datei unverändert (E3) --------------------------------------------------------

#[tokio::test]
async fn ak6_doppelte_nummern_und_board_datei_unveraendert() {
    let tmp = tempfile::tempdir().unwrap();
    lage_pfadregel(tmp.path());
    for (datei, titel) in [("0005-a.md", "a"), ("0005-b.md", "b"), ("0005-c.md", "c")] {
        std::fs::write(tmp.path().join("aufgaben").join(datei), format!("---\nid: 5\ntitle: {titel}\n---\n")).unwrap();
    }
    git(tmp.path(), &["add", "-A"]);
    git(tmp.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "drei Dateien derselben Nummer"]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let zustand: Value = reqwest::get(format!("{}api/aufgaben", lauf.adresse)).await.unwrap().json().await.unwrap();
    let gut: Vec<u64> = zustand["aufgaben"].as_array().unwrap().iter().map(|a| a["nummer"].as_u64().unwrap()).collect();
    assert!(gut.contains(&5), "0005-a.md ist die Aufgabe: {zustand}");
    let defekte: Vec<&str> = zustand["defekte"].as_array().unwrap().iter().map(|d| d["pfad"].as_str().unwrap()).collect();
    assert_eq!(defekte.iter().filter(|p| p.starts_with("aufgaben/0005-")).count(), 2, "b und c sind defekt: {zustand}");
    for d in zustand["defekte"].as_array().unwrap() {
        if d["pfad"].as_str().unwrap_or_default().starts_with("aufgaben/0005-") {
            assert_eq!(d["fehler"], json!("Nummer #5 doppelt — auch in aufgaben/0005-a.md"), "{d}");
        }
    }
    // Board mit zwei Aufgaben, eine von Hand benannt: eine Sammelaktion schreibt die Board-Datei, jede Zeile nennt dieselbe Datei
    std::fs::write(tmp.path().join("aufgaben/0003-drei.md"), "---\nid: 3\ntitle: drei\n---\n").unwrap();
    std::fs::write(
        tmp.path().join("boards/entwicklung.md"),
        "# Entwicklung\n\n## Zu erledigen\n\n- [#7](../aufgaben/0007-sieben.md)\n- [#9](../aufgaben/von-hand.md)\n\n## Erledigt\n",
    )
    .unwrap();
    git(tmp.path(), &["add", "-A"]);
    git(tmp.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Board"]);
    let vorher = lies(tmp.path(), "boards/entwicklung.md");
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/aufgaben/mehrere", "st", json!({"nummern": [3]})).await;
    assert_eq!(s, 200, "{a}");
    let nachher = lies(tmp.path(), "boards/entwicklung.md");
    for zeile in vorher.lines() {
        if zeile.contains("aufgaben/") {
            assert!(nachher.contains(zeile), "die Zeile {zeile:?} nennt dieselbe Datei wie vorher:\n{nachher}");
        }
    }
    assert!(nachher.contains("aufgaben/0003-drei.md"), "die neue Zeile zeigt auf 0003-drei.md:\n{nachher}");
}
