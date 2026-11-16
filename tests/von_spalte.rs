//! R00167: Von-Spalte des Durchsatzes — `fever: {from-column: …}` in der Board-Datei (ADR-0027 N3).
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

const BOARD: &str = "boards/entwicklung.md";
const RUMPF: &str = "# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## In Arbeit\n\n## Erledigt\n";

/// Drei Aufgaben in „Zu erledigen“, die Board-Datei mit diesem von Hand geschriebenen Kopf.
fn starten_mit_kopf(tmp: &tempfile::TempDir, kopf: &str) -> gemeinsam::Laufendes {
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::write(tmp.path().join(BOARD), format!("{kopf}{RUMPF}")).unwrap();
    git(tmp.path(), &["add", "-A"]);
    git(tmp.path(), &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "Kopf von Hand"]);
    gemeinsam::starten(tmp.path(), &["--port", "0"])
}

fn kopf(tmp: &tempfile::TempDir) -> String {
    let text = lies(tmp.path(), BOARD);
    let ende = text.find("# Entwicklung").expect("Titel in der Board-Datei");
    text[..ende].to_string()
}

fn commits(tmp: &tempfile::TempDir) -> u32 {
    git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

async fn ziehen(adresse: &str, nummer: u32, spalte: &str) {
    let (s, _) = senden(Method::POST, adresse, "api/boards/entwicklung/bewegen", "st", json!({"nummer": nummer, "spalte": spalte})).await;
    assert_eq!(s, 200, "#{nummer} nach {spalte}");
}

/// Das Fever-Objekt des Boards, wie es die Oberfläche liest, mit einem geänderten Feld zurückgeschrieben.
async fn fieber_aendern(adresse: &str, feld: &str, wert: serde_json::Value) -> u16 {
    let (_, b) = senden(Method::GET, adresse, "api/boards/entwicklung", "st", json!(null)).await;
    let mut f = b["fieber"].clone();
    f[feld] = wert;
    senden(Method::PUT, adresse, "api/boards/entwicklung/fieber", "st", f).await.0
}

/// B0812 — Probe am Stand vor der Karte (main `1f9f9c4`), gemessen: die Datei ist lesbar (GET 200); der Kartenzug schreibt den
/// Kopf ohne `fever` (das Frontmatter entfällt ganz), der Fever-PUT mit geänderter Auflösung schreibt `fever: {resolution: week}` —
/// beide lassen den von Hand gesetzten Schlüssel fallen. B0813 macht daraus die Zusage „der neue Stand verliert ihn nicht“.
#[tokio::test]
#[ignore = "rot am Stand vor der Karte — B0813 macht ihn grün"]
async fn von_hand_gesetztes_from_column_uebersteht_kartenzug_und_fever_put() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten_mit_kopf(&tmp, "---\nfever: {from-column: In Arbeit}\n---\n\n");
    let (s, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!((s, b["spalten"].as_array().map(Vec::len)), (200, Some(3)), "die Datei ist lesbar");
    ziehen(&lauf.adresse, 1, "In Arbeit").await;
    assert_eq!(kopf(&tmp), "---\nfever: {from-column: In Arbeit}\n---\n\n", "nach dem Kartenzug");
    assert_eq!(fieber_aendern(&lauf.adresse, "aufloesung", json!(7)).await, 200);
    assert_eq!(kopf(&tmp), "---\nfever: {resolution: week, from-column: In Arbeit}\n---\n\n", "nach dem Fever-PUT mit geänderter Auflösung");
}
