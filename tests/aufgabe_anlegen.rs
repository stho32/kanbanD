mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn aufgabe_auf_board_ergibt_datei_zeile_und_einen_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "Dateiwächter bauen", "board": "entwicklung", "spalte": "In Arbeit"})).await;
    assert_eq!(s, 201);
    assert_eq!(a["nummer"], 1);
    assert_eq!(a["datei"], "0001-dateiwaechter-bauen.md");
    assert_eq!(lies(tmp.path(), "aufgaben/0001-dateiwaechter-bauen.md"), "---\nid: 1\ntitle: Dateiwächter bauen\nassignees: [st]\n---\n");
    assert_eq!(lies(tmp.path(), "boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n- [#1](../aufgaben/0001-dateiwaechter-bauen.md)\n\n## Erledigt\n");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#1 „Dateiwächter bauen“ angelegt in „In Arbeit“ (Entwicklung)");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=", "HEAD"]), "aufgaben/0001-dateiwaechter-bauen.md\nboards/entwicklung.md");
    let (_, b) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "Zweite", "board": "entwicklung"})).await;
    assert_eq!(b["nummer"], 2);
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("## Zu erledigen\n\n- [#2](../aufgaben/0002-zweite.md)\n"));
}

#[tokio::test]
async fn agent_ohne_board_legt_nur_die_aufgabe_an_ohne_sich_zuzuweisen() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let (s, _) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "cl", json!({"titel": "Lose"})).await;
    assert_eq!(s, 201);
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=%an", "HEAD"]), "Claude\n\naufgaben/0001-lose.md");
    assert!(!lies(tmp.path(), "aufgaben/0001-lose.md").contains("assignees"));
}

#[tokio::test]
async fn falsche_angaben_legen_nichts_an() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    for (daten, status) in [
        (json!({"titel": "  "}), 400),
        (json!({"titel": "x", "board": "gibtsnicht"}), 404),
        (json!({"titel": "x", "board": "entwicklung", "spalte": "Nirgends"}), 400),
    ] {
        assert_eq!(senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", daten).await.0, status);
    }
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/aufgaben", "zz", json!({"titel": "x"})).await.0, 400);
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
    assert!(!tmp.path().join("aufgaben").exists());
}

#[tokio::test]
async fn board_ohne_spalten_ist_ungueltig() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::eingerichtet(tmp.path());
    std::fs::write(tmp.path().join("boards/leer.md"), "# Leer\n").unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, f) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "x", "board": "leer"})).await;
    assert_eq!(s, 400);
    assert!(f["fehler"].as_str().unwrap().contains("keine Spalte"));
}
