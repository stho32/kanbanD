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
