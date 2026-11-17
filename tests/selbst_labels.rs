//! R00194: „Selbsterzeugt =“ des Burndowns — `fever: {self-labels: […]}` in der Board-Datei (ADR-0027 N6).
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

const BOARD: &str = "boards/entwicklung.md";
const RUMPF: &str = "# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## In Arbeit\n\n## Erledigt\n";

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

/// B0951 — am Stand vor der Karte (main `d1fbe72`) rot: der Kartenzug schrieb den Kopf ohne `self-labels`, die API kannte das Feld nicht.
#[tokio::test]
async fn von_hand_gesetzte_self_labels_ueberstehen_kartenzug_und_fever_put() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten_mit_kopf(&tmp, "---\nfever: {target-column: Erledigt, from-column: In Arbeit, self-labels: [befund, härtung]}\n---\n\n");
    let (s, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!(s, 200);
    assert_eq!(b["fieber"]["selbstlabels"], json!(["befund", "härtung"]));
    ziehen(&lauf.adresse, 1, "In Arbeit").await;
    assert_eq!(kopf(&tmp), "---\nfever: {target-column: Erledigt, from-column: In Arbeit, self-labels: [befund, härtung]}\n---\n\n", "nach dem Kartenzug");
    assert_eq!(fieber_aendern(&lauf.adresse, "aufloesung", json!(7)).await, 200);
    assert_eq!(kopf(&tmp), "---\nfever: {resolution: week, target-column: Erledigt, from-column: In Arbeit, self-labels: [befund, härtung]}\n---\n\n", "nach dem Fever-PUT mit geänderter Auflösung");
}

/// R00194 AK 1: ohne Wahl bleibt die Board-Datei zeichengleich; die API nennt eine leere Liste.
#[tokio::test]
async fn ohne_self_labels_bleibt_die_board_datei_zeichengleich() {
    for vorher in ["", "---\nfever: {buffer: 20, target-column: In Arbeit, from-column: Zu erledigen}\n---\n\n"] {
        let tmp = tempfile::tempdir().unwrap();
        let lauf = starten_mit_kopf(&tmp, vorher);
        let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
        assert_eq!(b["fieber"]["selbstlabels"], json!([]), "ohne Schlüssel keine Wahl");
        ziehen(&lauf.adresse, 1, "In Arbeit").await;
        assert_eq!(kopf(&tmp), vorher, "nach dem Kartenzug");
        assert_eq!(fieber_aendern(&lauf.adresse, "perzentil", json!(85)).await, 200);
        assert!(!lies(tmp.path(), BOARD).contains("self-labels"), "eine Fever-Einstellung bringt keinen neuen Schlüssel");
    }
}

/// R00194 AK 1 und 6 (Server): die Wahl wird getrimmt mit genau einem Commit geschrieben, `target-column` und `from-column` bleiben;
/// ein leerer Name ist ungültig, die leere Liste entfernt den Schlüssel.
#[tokio::test]
async fn put_fieber_speichert_die_selbst_labels_in_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let mit_spalten = "---\nfever: {target-column: Erledigt, from-column: In Arbeit}\n---\n\n";
    let lauf = starten_mit_kopf(&tmp, mit_spalten);
    let vorher = commits(&tmp);
    assert_eq!(fieber_aendern(&lauf.adresse, "selbstlabels", json!([" befund "])).await, 200);
    assert_eq!(kopf(&tmp), "---\nfever: {target-column: Erledigt, from-column: In Arbeit, self-labels: [befund]}\n---\n\n");
    assert_eq!(commits(&tmp), vorher + 1, "genau ein Commit");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=%s", "HEAD"]).lines().last(), Some("boards/entwicklung.md"));
    assert_eq!(fieber_aendern(&lauf.adresse, "selbstlabels", json!(["befund"])).await, 200);
    assert_eq!(commits(&tmp), vorher + 1, "unverändert: kein Commit");
    for leer in [json!([""]), json!(["befund", " "])] {
        assert_eq!(fieber_aendern(&lauf.adresse, "selbstlabels", leer.clone()).await, 400, "leerer Name in {leer}");
    }
    assert_eq!(fieber_aendern(&lauf.adresse, "zielspalte", json!("In Arbeit")).await, 200);
    assert_eq!(kopf(&tmp), "---\nfever: {target-column: In Arbeit, from-column: In Arbeit, self-labels: [befund]}\n---\n\n", "Zielspalte ändern erhält self-labels");
    assert_eq!(fieber_aendern(&lauf.adresse, "selbstlabels", json!(["befund", "härtung"])).await, 200);
    assert_eq!(kopf(&tmp), "---\nfever: {target-column: In Arbeit, from-column: In Arbeit, self-labels: [befund, härtung]}\n---\n\n");
    assert_eq!(fieber_aendern(&lauf.adresse, "selbstlabels", json!([])).await, 200);
    assert_eq!(kopf(&tmp), "---\nfever: {target-column: In Arbeit, from-column: In Arbeit}\n---\n\n", "keine Wahl: kein Schlüssel");
    assert_eq!(fieber_aendern(&lauf.adresse, "zielspalte", json!(null)).await, 200);
    assert_eq!(fieber_aendern(&lauf.adresse, "vonspalte", json!(null)).await, 200);
    assert_eq!(fieber_aendern(&lauf.adresse, "selbstlabels", json!(["befund", "härtung"])).await, 200);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "Fever Chart von „Entwicklung“ eingestellt: ohne Puffer, P95, selbsterzeugt „befund“, „härtung“", "der Betreff nennt die Wahl");
}
