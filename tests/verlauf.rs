mod gemeinsam;

use gemeinsam::senden;
use reqwest::Method;
use serde_json::json;
use std::process::Command;

fn commit_am(pfad: &std::path::Path, datum: &str, board: &str) {
    std::fs::write(pfad.join("boards/entwicklung.md"), board).unwrap();
    let st = Command::new("git")
        .arg("-C")
        .arg(pfad)
        .args(["-c", "user.name=T", "-c", "user.email=t@t", "commit", "-q", "-am", "stand"])
        .env("GIT_AUTHOR_DATE", datum)
        .env("GIT_COMMITTER_DATE", datum)
        .status()
        .unwrap();
    assert!(st.success());
}

#[tokio::test]
async fn verlauf_aus_echten_commits() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::eingerichtet(tmp.path());
    let kopf = "# Entwicklung\n\n## Zu erledigen\n\n";
    commit_am(tmp.path(), "2026-10-01T09:00:00", &format!("{kopf}- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n"));
    commit_am(tmp.path(), "2026-10-02T09:00:00", &format!("{kopf}- #2\n\n## In Arbeit\n\n## Erledigt\n\n- #1\n"));
    commit_am(tmp.path(), "2026-10-04T09:00:00", &format!("{kopf}## In Arbeit\n\n## Erledigt\n\n- #1\n- #2\n"));
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, v) = senden(Method::GET, &lauf.adresse, "api/berichte/verlauf?board=entwicklung", "st", json!(null)).await;
    assert_eq!(s, 200);
    let offen: Vec<u64> = v["tage"].as_array().unwrap().iter().take(4).map(|t| t["offen"].as_u64().unwrap()).collect();
    assert_eq!(offen, vec![2, 1, 1, 0]);
    assert_eq!(v["tage"][0]["datum"], "2026-10-01");
    assert_eq!(v["durchlauf"][0]["nummer"], 2);
    assert_eq!(v["durchlauf"][0]["tage"], 3.0);
    assert_eq!(v["mittel"], 2.0);
    assert_eq!(senden(Method::GET, &lauf.adresse, "api/berichte/verlauf?board=gibtsnicht", "st", json!(null)).await.0, 404);
}

#[tokio::test]
async fn unterordner_und_nicht_committetes_board() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::git(tmp.path(), &["init", "-q"]);
    let k = tmp.path().join("kanban");
    std::fs::create_dir_all(k.join("boards")).unwrap();
    std::fs::write(k.join("kanbanD.md"), gemeinsam::EINSTELLUNGEN).unwrap();
    std::fs::write(k.join("boards/neu.md"), "# Neu\n\n## A\n\n- #1\n\n## Z\n").unwrap();
    let lauf = gemeinsam::starten(&k, &["--port", "0"]);
    let (_, v) = senden(Method::GET, &lauf.adresse, "api/berichte/verlauf?board=neu", "st", json!(null)).await;
    assert_eq!(v["tage"].as_array().unwrap().len(), 1);
    assert_eq!(v["tage"][0]["offen"], 1);
    gemeinsam::git(tmp.path(), &["add", "-A"]);
    gemeinsam::git(tmp.path(), &["-c", "user.name=T", "-c", "user.email=t@t", "commit", "-q", "-m", "x"]);
    let (_, v) = senden(Method::GET, &lauf.adresse, "api/berichte/verlauf?board=neu", "st", json!(null)).await;
    assert_eq!(v["tage"][0]["umfang"], 1, "Stand aus dem Unterordner des Repositories gelesen");
}

#[tokio::test]
async fn staende_werden_nach_zeitpunkt_geordnet() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::git(tmp.path(), &["init", "-q"]);
    std::fs::create_dir_all(tmp.path().join("boards")).unwrap();
    std::fs::write(tmp.path().join("kanbanD.md"), gemeinsam::EINSTELLUNGEN).unwrap();
    gemeinsam::git(tmp.path(), &["add", "-A"]);
    let kopf = "# Entwicklung\n\n## Zu erledigen\n\n";
    std::fs::write(tmp.path().join("boards/entwicklung.md"), format!("{kopf}- #1\n\n## Erledigt\n")).unwrap();
    gemeinsam::git(tmp.path(), &["add", "-A"]);
    commit_am(tmp.path(), "2026-10-05T09:00:00", &format!("{kopf}## Erledigt\n\n- #1\n"));
    commit_am(tmp.path(), "2026-10-03T09:00:00", &format!("{kopf}- #1\n\n## Erledigt\n"));
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (_, v) = senden(Method::GET, &lauf.adresse, "api/berichte/verlauf?board=entwicklung", "st", json!(null)).await;
    assert_eq!(v["tage"][0]["datum"], "2026-10-03");
    assert_eq!(v["tage"][2]["offen"], 0, "am 05.10. erledigt, obwohl der Commit davor liegt");
}

#[tokio::test]
async fn bewegungen_aus_echten_commits() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::eingerichtet(tmp.path());
    let kopf = "# Entwicklung\n\n## Zu erledigen\n\n";
    commit_am(tmp.path(), "2026-10-01T09:00:00", &format!("{kopf}- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n"));
    commit_am(tmp.path(), "2026-10-02T09:00:00", &format!("{kopf}- #2\n\n## In Arbeit\n\n## Erledigt\n\n- #1\n"));
    commit_am(tmp.path(), "2026-10-04T09:00:00", &format!("{kopf}## In Arbeit\n\n## Erledigt\n\n- #2\n"));
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, v) = senden(Method::GET, &lauf.adresse, "api/berichte/bewegungen?board=entwicklung", "st", json!(null)).await;
    assert_eq!(s, 200);
    assert_eq!(v["spalten"], json!(["Zu erledigen", "In Arbeit", "Erledigt"]));
    assert_eq!(v["aufgaben"][0]["nummer"], 1);
    assert_eq!(
        v["aufgaben"][0]["wechsel"],
        json!([{"zeitpunkt": "2026-10-01 09:00", "spalte": "Zu erledigen"}, {"zeitpunkt": "2026-10-02 09:00", "spalte": "Erledigt"}, {"zeitpunkt": "2026-10-04 09:00", "spalte": null}])
    );
    assert_eq!(v["aufgaben"][1]["wechsel"][1]["spalte"], "Erledigt");
    assert_eq!(senden(Method::GET, &lauf.adresse, "api/berichte/bewegungen?board=gibtsnicht", "st", json!(null)).await.0, 404);
}

/* R00123 Karten-Verlauf: der Endpunkt gegen einen echten Ordner mit Git (B0572–B0574). */

/// Eine Dateiänderung als ein Commit mit festem Autor und fester Zeit (ADR-0021: ein Commit je Aktion).
fn verfassen(pfad: &std::path::Path, datum: &str, wer: &str, nachricht: &str) {
    let email = if wer.contains('@') { wer.to_string() } else { format!("{wer}@kanbanD") };
    let name = if wer.contains('@') { "Extern".to_string() } else { format!("Name {wer}") };
    gemeinsam::git(pfad, &["add", "-A"]);
    let st = Command::new("git")
        .arg("-C")
        .arg(pfad)
        .args(["commit", "-q", "-m", nachricht])
        .env("GIT_AUTHOR_NAME", &name)
        .env("GIT_AUTHOR_EMAIL", &email)
        .env("GIT_COMMITTER_NAME", &name)
        .env("GIT_COMMITTER_EMAIL", &email)
        .env("GIT_AUTHOR_DATE", datum)
        .env("GIT_COMMITTER_DATE", datum)
        .status()
        .unwrap();
    assert!(st.success(), "Commit {nachricht} scheiterte");
}

const BOARD_KOPF: &str = "# fabrik\n\n## Eingang\n\n";

fn grundbestand(pfad: &std::path::Path) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), gemeinsam::EINSTELLUNGEN).unwrap();
    std::fs::write(pfad.join("boards/fabrik.md"), "# fabrik\n\n## Eingang\n\n## In Arbeit\n\n## Fertig\n").unwrap();
    gemeinsam::git(pfad, &["init", "-q"]);
    gemeinsam::git(pfad, &["add", "-A"]);
    gemeinsam::git(pfad, &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
    // 01.10. angelegt und in „Eingang“ gelegt — ein Commit, zwei Dateien
    std::fs::write(pfad.join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\n---\n").unwrap();
    std::fs::write(pfad.join("boards/fabrik.md"), format!("{BOARD_KOPF}- #1\n\n## In Arbeit\n\n## Fertig\n")).unwrap();
    verfassen(pfad, "2026-10-01T09:00:00", "sh", "#1 angelegt");
    // 02.10. nach „In Arbeit“
    std::fs::write(pfad.join("boards/fabrik.md"), format!("{BOARD_KOPF}## In Arbeit\n\n- #1\n\n## Fertig\n")).unwrap();
    verfassen(pfad, "2026-10-02T09:00:00", "cl", "#1 bewegt");
    // 03.10. nach „Fertig“
    std::fs::write(pfad.join("boards/fabrik.md"), format!("{BOARD_KOPF}## In Arbeit\n\n## Fertig\n\n- #1\n")).unwrap();
    verfassen(pfad, "2026-10-03T09:00:00", "cl", "#1 bewegt");
    // 04.10. archiviert
    std::fs::write(pfad.join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\narchived: 2026-10-04\n---\n").unwrap();
    verfassen(pfad, "2026-10-04T09:00:00", "sh", "#1 archiviert");
    // 05.10. zurückgeholt
    std::fs::write(pfad.join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\n---\n").unwrap();
    verfassen(pfad, "2026-10-05T09:00:00", "sh", "#1 zurückgeholt");
    // 06.10. vom Board genommen
    std::fs::write(pfad.join("boards/fabrik.md"), format!("{BOARD_KOPF}## In Arbeit\n\n## Fertig\n")).unwrap();
    verfassen(pfad, "2026-10-06T09:00:00", "sh", "#1 vom Board genommen");
}

#[tokio::test]
async fn karten_verlauf_liest_die_git_geschichte() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = (gemeinsam::git(tmp.path(), &["log", "--oneline"]), gemeinsam::lies(tmp.path(), "aufgaben/0001-eins.md"), gemeinsam::lies(tmp.path(), "boards/fabrik.md"));
    let (s, v) = senden(Method::GET, &lauf.adresse, "api/aufgaben/1/verlauf", "st", json!(null)).await;
    assert_eq!(s, 200);
    let e = v["eintraege"].as_array().unwrap();
    assert_eq!(e.len(), 6, "sechs Einträge, neueste zuerst: {v}");
    let kurz: Vec<(&str, &str, Option<&str>, Option<&str>, Option<&str>, &str)> = e.iter().map(|x| (x["zeitpunkt"].as_str().unwrap(), x["art"].as_str().unwrap(), x["board"].as_str(), x["von"].as_str(), x["nach"].as_str(), x["wer"].as_str().unwrap())).collect();
    assert_eq!(
        kurz,
        vec![
            ("2026-10-06 09:00", "bewegt", Some("fabrik"), Some("Fertig"), None, "sh"),
            ("2026-10-05 09:00", "zurueckgeholt", None, None, None, "sh"),
            ("2026-10-04 09:00", "archiviert", None, None, None, "sh"),
            ("2026-10-03 09:00", "bewegt", Some("fabrik"), Some("In Arbeit"), Some("Fertig"), "cl"),
            ("2026-10-02 09:00", "bewegt", Some("fabrik"), Some("Eingang"), Some("In Arbeit"), "cl"),
            ("2026-10-01 09:00", "erstellt", Some("fabrik"), None, Some("Eingang"), "sh"),
        ],
        "{v}"
    );
    // nur gelesen: Dateien und Git-Geschichte unverändert
    assert_eq!((gemeinsam::git(tmp.path(), &["log", "--oneline"]), gemeinsam::lies(tmp.path(), "aufgaben/0001-eins.md"), gemeinsam::lies(tmp.path(), "boards/fabrik.md")), vorher, "das Lesen ändert nichts");
    // unbekannte Nummer
    assert_eq!(senden(Method::GET, &lauf.adresse, "api/aufgaben/99/verlauf", "st", json!(null)).await.0, 404);
    // Register: /api/endpunkte nennt den Pfad
    let (_, endpunkte) = senden(Method::GET, &lauf.adresse, "api/endpunkte", "st", json!(null)).await;
    assert!(endpunkte.as_array().unwrap().iter().any(|x| x["pfad"] == "/api/aufgaben/{nr}/verlauf"), "{endpunkte}");
}

#[tokio::test]
async fn karten_verlauf_zeigt_geloeschte_datei_und_fremden_autor() {
    let tmp = tempfile::tempdir().unwrap();
    grundbestand(tmp.path());
    // fremder Autor bewegt die Board-Zeile am 07.10. von Hand
    std::fs::write(tmp.path().join("boards/fabrik.md"), format!("{BOARD_KOPF}- #1\n\n## In Arbeit\n\n## Fertig\n")).unwrap();
    verfassen(tmp.path(), "2026-10-07T09:00:00", "extern@example.org", "extern bewegt");
    // die Aufgabendatei am 09.10. entfernt
    std::fs::remove_file(tmp.path().join("aufgaben/0001-eins.md")).unwrap();
    verfassen(tmp.path(), "2026-10-09T09:00:00", "sh", "#1 gelöscht");
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, v) = senden(Method::GET, &lauf.adresse, "api/aufgaben/1/verlauf", "st", json!(null)).await;
    assert_eq!(s, 200, "{v}");
    let e = v["eintraege"].as_array().unwrap();
    assert_eq!(e[0]["art"], "geloescht");
    assert_eq!(e[0]["zeitpunkt"], "2026-10-09 09:00");
    assert_eq!(e[0]["wer"], "sh");
    assert!(e.iter().any(|x| x["wer"] == "Extern" && x["art"] == "bewegt"), "fremder Autor unverändert: {v}");
    assert!(e.len() >= 7, "frühere Einträge bleiben: {v}");
}
