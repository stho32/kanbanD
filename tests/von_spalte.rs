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

/// B0812/B0813 — am Stand vor der Karte (main `1f9f9c4`) gemessen: die Datei ist lesbar (GET 200), aber der Kartenzug schreibt den
/// Kopf ohne `fever` und der Fever-PUT `fever: {resolution: week}` — beide ließen den Schlüssel fallen. Der neue Stand verliert ihn nicht.
#[tokio::test]
async fn von_hand_gesetztes_from_column_uebersteht_kartenzug_und_fever_put() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten_mit_kopf(&tmp, "---\nfever: {from-column: In Arbeit}\n---\n\n");
    let (s, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!((s, b["spalten"].as_array().map(Vec::len)), (200, Some(3)), "die Datei ist lesbar");
    assert_eq!(b["fieber"]["vonspalte"], json!("In Arbeit"));
    ziehen(&lauf.adresse, 1, "In Arbeit").await;
    assert_eq!(kopf(&tmp), "---\nfever: {from-column: In Arbeit}\n---\n\n", "nach dem Kartenzug");
    assert_eq!(fieber_aendern(&lauf.adresse, "aufloesung", json!(7)).await, 200);
    assert_eq!(kopf(&tmp), "---\nfever: {resolution: week, from-column: In Arbeit}\n---\n\n", "nach dem Fever-PUT mit geänderter Auflösung");
}

/// AK 3a: ohne den Schlüssel bleibt die Board-Datei zeichengleich — kein neuer Schlüssel, auch nicht nach Hin- und Rückzug.
#[tokio::test]
async fn ohne_from_column_bleibt_die_board_datei_zeichengleich() {
    for vorher in ["", "---\nfever: {buffer: 20, red: [20, 95], resolution: week, target-column: In Arbeit}\n---\n\n"] {
        let tmp = tempfile::tempdir().unwrap();
        let lauf = starten_mit_kopf(&tmp, vorher);
        let datei = lies(tmp.path(), BOARD);
        let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
        assert_eq!(b["fieber"]["vonspalte"], json!(null), "ohne Schlüssel keine Wahl");
        ziehen(&lauf.adresse, 1, "In Arbeit").await;
        assert_eq!(kopf(&tmp), vorher, "nach dem Kartenzug");
        let (s, _) = senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen", "st", json!({"nummer": 1, "spalte": "Zu erledigen", "index": 0})).await;
        assert_eq!(s, 200);
        assert_eq!(lies(tmp.path(), BOARD), datei, "nach Hin- und Rückzug zeichengleich");
        assert_eq!(fieber_aendern(&lauf.adresse, "perzentil", json!(85)).await, 200);
        assert!(!lies(tmp.path(), BOARD).contains("from-column"), "eine Fever-Einstellung bringt keinen neuen Schlüssel");
    }
}

/// AK 2 (Server): die Wahl wird getrimmt, mit genau einem Commit geschrieben, der sie nennt; ein leerer Name ist ungültig, `null` entfernt den Schlüssel.
#[tokio::test]
async fn put_fieber_speichert_die_von_spalte_getrimmt_in_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten_mit_kopf(&tmp, "");
    let vorher = commits(&tmp);
    assert_eq!(fieber_aendern(&lauf.adresse, "vonspalte", json!(" In Arbeit ")).await, 200);
    assert_eq!(kopf(&tmp), "---\nfever: {from-column: In Arbeit}\n---\n\n");
    assert_eq!(commits(&tmp), vorher + 1, "genau ein Commit");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=%an|%s", "HEAD"]), "Stefan|Fever Chart von „Entwicklung“ eingestellt: ohne Puffer, P95, Zugang ab „In Arbeit“\n\nboards/entwicklung.md");
    assert_eq!(fieber_aendern(&lauf.adresse, "vonspalte", json!("In Arbeit")).await, 200);
    assert_eq!(commits(&tmp), vorher + 1, "unverändert: kein Commit");
    for leer in ["", " "] {
        assert_eq!(fieber_aendern(&lauf.adresse, "vonspalte", json!(leer)).await, 400, "leerer Name „{leer}“");
    }
    assert_eq!(kopf(&tmp), "---\nfever: {from-column: In Arbeit}\n---\n\n", "eine abgewiesene Eingabe ändert nichts");
    assert_eq!(fieber_aendern(&lauf.adresse, "vonspalte", json!(null)).await, 200);
    assert_eq!(kopf(&tmp), "", "Standard gewählt: kein Schlüssel in der Datei");
    assert_eq!(fieber_aendern(&lauf.adresse, "vonspalte", json!("Gibt es nicht")).await, 200, "der Server prüft nur die Form (ADR-0027 N3 Punkt 3)");
}

/// AK 9: das Ändern von „Zugang ab“ erhält `target-column` und alle übrigen Werte unter `fever` — und umgekehrt.
#[tokio::test]
async fn von_spalte_und_die_uebrigen_fever_werte_stoeren_einander_nicht() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten_mit_kopf(&tmp, "---\nstart: 2026-09-01\nfever: {buffer: 20, percentile: 50, week: 7, yellow: [10, 67], red: [20, 95], resolution: month, target-column: In Arbeit}\n---\n\n");
    assert_eq!(fieber_aendern(&lauf.adresse, "vonspalte", json!("Zu erledigen")).await, 200);
    let mit_von = "---\nstart: 2026-09-01\nfever: {buffer: 20, percentile: 50, week: 7, yellow: [10, 67], red: [20, 95], resolution: month, target-column: In Arbeit, from-column: Zu erledigen}\n---\n\n";
    assert_eq!(kopf(&tmp), mit_von, "nur der neue Schlüssel kommt dazu");
    let betreff = git(tmp.path(), &["log", "-1", "--format=%s"]);
    assert!(betreff.starts_with("Fever Chart von „Entwicklung“ eingestellt: Puffer 20 Kalendertage, P50, erledigt heißt „In Arbeit“, Zugang ab „Zu erledi"), "der Betreff nennt beide Wahlen (gekürzt nach der Längenregel): {betreff}");
    assert_eq!(fieber_aendern(&lauf.adresse, "zielspalte", json!("Erledigt")).await, 200);
    assert_eq!(kopf(&tmp), mit_von.replace("target-column: In Arbeit", "target-column: Erledigt"), "Zielspalte ändern erhält from-column");
    assert_eq!(fieber_aendern(&lauf.adresse, "zielspalte", json!(null)).await, 200);
    assert_eq!(kopf(&tmp), mit_von.replace("target-column: In Arbeit, ", ""), "Zielspalte entfernen erhält from-column");
    assert_eq!(fieber_aendern(&lauf.adresse, "puffer", json!(30)).await, 200);
    assert_eq!(kopf(&tmp), mit_von.replace("target-column: In Arbeit, ", "").replace("buffer: 20", "buffer: 30"));
}

/// AK 9: keine eigene Aktion des neuen Standes verliert `from-column` oder einen anderen Wert unter `fever`.
#[tokio::test]
async fn keine_eigene_aktion_verliert_from_column() {
    let tmp = tempfile::tempdir().unwrap();
    let fever = "fever: {buffer: 20, target-column: Erledigt, from-column: In Arbeit}\n";
    let lauf = starten_mit_kopf(&tmp, &format!("---\n{fever}---\n\n"));
    let a = &lauf.adresse;
    let erhalten = |anlass: &str| assert!(lies(tmp.path(), BOARD).contains(fever), "{anlass}: {}", kopf(&tmp));
    ziehen(a, 2, "Erledigt").await;
    erhalten("Kartenzug");
    let (s, _) = senden(Method::POST, a, "api/aufgaben", "st", json!({"titel": "vier", "board": "entwicklung"})).await;
    assert_eq!(s, 201);
    erhalten("Aufgabe anlegen");
    let spalten = json!([{"name": "Zu erledigen", "alt": "Zu erledigen"}, {"name": "In Arbeit", "alt": "In Arbeit", "grenze": 3}, {"name": "Prüfung"}, {"name": "Erledigt", "alt": "Erledigt"}]);
    assert_eq!(senden(Method::PUT, a, "api/boards/entwicklung/spalten", "st", spalten).await.0, 200);
    assert!(lies(tmp.path(), BOARD).contains("## Prüfung"), "die Spalten sind geändert");
    erhalten("Spalten ändern");
    assert_eq!(senden(Method::PUT, a, "api/boards/entwicklung/start", "st", json!({"start": "2026-09-01"})).await.0, 200);
    erhalten("Rechnen ab setzen");
    assert_eq!(senden(Method::PUT, a, "api/boards/entwicklung/berichtsfilter", "st", json!({"zeitraum": "30"})).await.0, 200);
    erhalten("Berichtsfilter setzen");
    assert_eq!(senden(Method::PATCH, a, "api/boards/entwicklung", "st", json!({"titel": "Entwicklung 2026"})).await.0, 200);
    assert!(lies(tmp.path(), BOARD).contains("# Entwicklung 2026"), "das Board ist umbenannt");
    erhalten("Board umbenennen");
}
