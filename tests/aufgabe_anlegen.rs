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

/// Karte #130 (S3 aus #124): eine Spalte ohne Board ist ungültig — der gemeinsame Anlegeweg antwortet auf allen
/// drei Wegen mit 400 und schreibt nichts; Board und Spalte zusammen bleiben gültig.
#[tokio::test]
async fn spalte_ohne_board_ist_400_und_legt_nichts_an() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    for (pfad, daten) in [
        ("api/aufgaben", json!({"titel": "y", "spalte": "In Arbeit"})),
        ("api/aufgaben/mehrere", json!({"titel": ["y"], "spalte": "In Arbeit"})),
        ("api/aufgaben", json!({"titel": "y", "spalte": "Nirgends"})),
    ] {
        let (s, f) = senden(Method::POST, &lauf.adresse, pfad, "st", daten.clone()).await;
        assert_eq!(s, 400, "{pfad} {daten}: {f}");
        assert!(f["fehler"].as_str().unwrap().contains("Board"), "{pfad} {daten}: {f}");
        assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher, "{pfad} {daten}: kein Commit");
        assert!(!tmp.path().join("aufgaben").exists(), "{pfad} {daten}: keine Datei");
    }
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "mit Board", "board": "entwicklung", "spalte": "In Arbeit"})).await;
    assert_eq!(s, 201, "Board und Spalte zusammen bleiben gültig: {a}");
}

/// Eine Commit-Nachricht ist abgeleiteter Text (ADR-0005 N1): ein Titel mit NUL-Byte bleibt in der Datei,
/// die Nachricht trägt kein Steuerzeichen, und die Karte ist committet — kein halber Zustand.
#[tokio::test]
async fn titel_mit_nul_wird_committet_und_die_nachricht_traegt_kein_steuerzeichen() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let vorher: usize = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "a\u{0}b", "key": "nul-1"})).await;
    assert_eq!(s, 201, "nie 500: {a}");
    assert_eq!(a["neu"], true);
    let datei = format!("aufgaben/{}", a["datei"].as_str().unwrap());
    assert!(tmp.path().join(&datei).exists(), "die Datei bleibt: {datei}");
    assert!(lies(tmp.path(), &datei).contains("title: \"a\\u0000b\""), "die Fachdaten tragen den Titel: {}", lies(tmp.path(), &datei));
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<usize>().unwrap(), vorher + 1, "genau ein Commit");
    let nachricht = git(tmp.path(), &["log", "-1", "--format=%s"]);
    assert_eq!(nachricht.lines().count(), 1, "eine Zeile: {nachricht:?}");
    assert!(!nachricht.chars().any(char::is_control), "kein Steuerzeichen: {nachricht:?}");
    assert!(nachricht.contains("angelegt"), "{nachricht:?}");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "", "kein Git-Rest");
    let (s, b) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "a\u{0}b", "key": "nul-1"})).await;
    assert_eq!((s, &b["neu"], &b["nummer"]), (200, &json!(false), &a["nummer"]), "der Schlüssel findet die committete Karte: {b}");
}

/// Derselbe Weg mit einem Titel über der Argumentgrenze: die Datei trägt ihn ganz, die Nachricht bleibt kurz.
#[tokio::test]
async fn titel_ueber_der_argumentgrenze_wird_committet_und_die_nachricht_bleibt_kurz() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let titel = "x".repeat(1_000_000);
    let vorher: usize = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": titel, "key": "lang-1"})).await;
    assert_eq!(s, 201, "nie 500");
    assert_eq!(a["neu"], true);
    let datei = format!("aufgaben/{}", a["datei"].as_str().unwrap());
    assert!(lies(tmp.path(), &datei).contains(&titel), "die Fachdaten tragen den Titel ganz");
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<usize>().unwrap(), vorher + 1, "genau ein Commit");
    let nachricht = git(tmp.path(), &["log", "-1", "--format=%s"]);
    assert_eq!(nachricht.lines().count(), 1, "eine Zeile");
    assert!(nachricht.chars().count() <= 120, "die Nachricht ist kurz: {} Zeichen", nachricht.chars().count());
    assert!(nachricht.ends_with("angelegt"), "die Nachricht behält ihre Aussage: {nachricht:?}");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "", "kein Git-Rest");
    let (s, b) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": titel, "key": "lang-1"})).await;
    assert_eq!((s, &b["neu"], &b["nummer"]), (200, &json!(false), &a["nummer"]), "der Schlüssel findet die committete Karte: {b}");
}

/// Eine gescheiterte Aktion hinterlässt nichts (ADR-0005 N1): scheitert der Commit, ist die Datei weg und der
/// Index so wie vorher; derselbe Schlüssel legt danach neu an, statt eine nie committete Karte zu melden.
#[tokio::test]
async fn gescheiterter_commit_laesst_keine_datei_und_keinen_git_rest() {
    use std::os::unix::fs::PermissionsExt;
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::eingerichtet(tmp.path());
    let haken = tmp.path().join(".git/hooks/pre-commit");
    std::fs::write(&haken, "#!/bin/sh\nexit 1\n").unwrap();
    std::fs::set_permissions(&haken, std::fs::Permissions::from_mode(0o755)).unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let kopf = git(tmp.path(), &["rev-parse", "HEAD"]);
    let (s, f) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "halb", "key": "halb-1"})).await;
    assert_eq!(s, 500, "{f}");
    assert!(f["fehler"].as_str().unwrap().contains("aufgaben/0001-halb.md"), "die Meldung nennt den Pfad: {f}");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "", "kein Git-Rest");
    assert!(!tmp.path().join("aufgaben/0001-halb.md").exists(), "keine halbe Karte");
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), kopf, "kein Commit");
    std::fs::remove_file(&haken).unwrap();
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "halb", "key": "halb-1"})).await;
    assert_eq!((s, &a["neu"]), (201, &json!(true)), "derselbe Schlüssel legt neu an: {a}");
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

/// R00233 AK 2 (Abnahme-Probe 2 aus N4, Probe der Karte #244): hält jemand außerhalb von kanbanD
/// `.git/index.lock`, scheitert ein `PATCH` mit 500 — nach dem Entfernen der Sperre steht der Ordner auf HEAD.
#[tokio::test]
async fn gehaltene_sperre_laesst_nach_gescheitertem_patch_den_ordner_sauber() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let kopf = git(tmp.path(), &["rev-parse", "HEAD"]);
    let sperre = tmp.path().join(".git/index.lock");
    std::fs::write(&sperre, "").unwrap();
    let (s, f) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/1", "st", json!({"titel": "neu"})).await;
    std::fs::remove_file(&sperre).unwrap();
    assert_eq!(s, 500, "{f}");
    let meldung = f["fehler"].as_str().unwrap();
    assert!(meldung.contains("index.lock") && meldung.contains("zurückgenommen:"), "{meldung}");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "", "Status leer");
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").contains("title: eins"), "die Karte heißt weiter „eins“");
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), kopf, "kein neuer Commit");
}

/// R00233 AK 2, Variante `POST` mit `key` (N1): die neue Datei verschwindet, derselbe Schlüssel legt nach dem
/// Entfernen der Sperre neu an.
#[tokio::test]
async fn gehaltene_sperre_laesst_nach_gescheitertem_anlegen_keine_datei_und_der_schluessel_legt_danach_an() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let kopf = git(tmp.path(), &["rev-parse", "HEAD"]);
    let sperre = tmp.path().join(".git/index.lock");
    std::fs::write(&sperre, "").unwrap();
    let (s, f) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "halb", "key": "halb-1"})).await;
    std::fs::remove_file(&sperre).unwrap();
    assert_eq!(s, 500, "{f}");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "", "Status leer");
    assert!(!tmp.path().join("aufgaben/0001-halb.md").exists(), "keine halbe Karte");
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), kopf, "kein Commit");
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben", "st", json!({"titel": "halb", "key": "halb-1"})).await;
    assert_eq!((s, &a["neu"]), (201, &json!(true)), "derselbe Schlüssel legt neu an: {a}");
}
