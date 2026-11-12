mod gemeinsam;

use gemeinsam::senden;
use reqwest::Method;
use serde_json::json;
use std::io::Write;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

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

/* #131 Härtung nach #119: Verlauf-Performance, sichtbare Lücke bei defektem Board. */

const MESS_SPALTEN: [&str; 4] = ["Eingang", "Arbeit", "Prüfen", "Fertig"];
const MESS_JE_BOARD: u32 = 50;
const MESS_COMMITS_JE_BOARD: u32 = 200;

fn mess_board(slug: &str, spalten: &[Vec<u32>; 4]) -> String {
    let mut s = format!("# {slug}\n\n");
    for (name, karten) in MESS_SPALTEN.iter().zip(spalten) {
        s.push_str(&format!("## {name}\n\n"));
        for n in karten {
            s.push_str(&format!("- #{n}\n"));
        }
        s.push('\n');
    }
    s
}

/// Ein Commit des fast-import-Stroms: Nachricht, Zeit in Sekunden, geänderte Dateien.
fn mess_commit(zeit: i64, dateien: &[(&str, String)]) -> String {
    let mut s = format!(
        "commit refs/heads/main\ncommitter messfall <messfall@example.org> {zeit} +0000\ndata 6\nbewegt\n"
    );
    for (pfad, inhalt) in dateien {
        s.push_str(&format!(
            "M 100644 inline {pfad}\ndata {}\n{inhalt}\n",
            inhalt.len()
        ));
    }
    s
}

/// R00131: der Messfall des Security-Reviews — 10 Boards, 500 Aufgaben, 2000 Commits. Über `git fast-import`,
/// damit der Aufbau nicht 2000 Prozesse kostet. Karte #1 liegt auf drei Boards und wird dort bewegt.
fn messfall(pfad: &std::path::Path) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), gemeinsam::EINSTELLUNGEN).unwrap();
    gemeinsam::git(pfad, &["init", "-q", "-b", "main"]);
    let mut belegung: Vec<[Vec<u32>; 4]> =
        (0..10).map(|_| [vec![], vec![], vec![], vec![]]).collect();
    let mut board_namen: Vec<String> = vec![];
    for b in 0..10u32 {
        belegung[b as usize][3] = (b * MESS_JE_BOARD + 1..=(b + 1) * MESS_JE_BOARD).collect();
        board_namen.push(format!("boards/b{b:02}.md"));
    }
    // Aufgaben und Board-Anfang in einem Commit.
    let mut dateien: Vec<(String, String)> =
        vec![("kanbanD.md".into(), gemeinsam::EINSTELLUNGEN.into())];
    for nr in 1..=10 * MESS_JE_BOARD {
        dateien.push((
            format!("aufgaben/{nr:04}-karte.md"),
            format!("---\nid: {nr}\ntitle: Karte {nr}\n---\n"),
        ));
    }
    for (b, name) in board_namen.iter().enumerate() {
        dateien.push((
            name.clone(),
            mess_board(&name[7..name.len() - 3], &belegung[b]),
        ));
    }
    let mut strom = "commit refs/heads/main\ncommitter messfall <messfall@example.org> 1759300000 +0000\ndata 12\neingerichtet\n".to_string();
    for (pfad, inhalt) in &dateien {
        strom.push_str(&format!(
            "M 100644 inline {pfad}\ndata {}\n{inhalt}\n",
            inhalt.len()
        ));
    }
    let mut zeit = 1759300060;
    for k in 0..MESS_COMMITS_JE_BOARD {
        for b in 0..10usize {
            let nummern: Vec<u32> =
                ((b as u32) * MESS_JE_BOARD + 1..=(b as u32 + 1) * MESS_JE_BOARD).collect();
            let nr = nummern[(k as usize * 7 + b) % nummern.len()];
            let jetzt = (0..4).find(|i| belegung[b][*i].contains(&nr)).unwrap();
            let ziel = if jetzt == 0 {
                3
            } else if jetzt == 3 || jetzt == 1 {
                jetzt - 1
            } else {
                jetzt + 1
            };
            belegung[b][jetzt].retain(|n| *n != nr);
            belegung[b][ziel].insert(0, nr);
            let inhalt = mess_board(&board_namen[b][7..board_namen[b].len() - 3], &belegung[b]);
            strom.push_str(&mess_commit(zeit, &[(board_namen[b].as_str(), inhalt)]));
            zeit += 60;
        }
    }
    let mut kind = Command::new("git")
        .arg("-C")
        .arg(pfad)
        .args(["fast-import", "--quiet"])
        .stdin(Stdio::piped())
        .spawn()
        .unwrap();
    kind.stdin
        .take()
        .unwrap()
        .write_all(strom.as_bytes())
        .unwrap();
    assert!(kind.wait().unwrap().success(), "fast-import");
    gemeinsam::git(pfad, &["reset", "-q", "--hard", "HEAD"]);
    assert_eq!(
        gemeinsam::git(pfad, &["rev-list", "--count", "HEAD"]),
        (1 + 10 * MESS_COMMITS_JE_BOARD).to_string()
    );
}

/// R00131 Abnahme-Probe (Sollte 1): 10 Boards × 200 Commits sind in ≤ 200 ms gelesen (vorher rund 390 ms in dieser
/// Umgebung, 2,6 s im Review) und kosten höchstens 8 git-Aufrufe (vorher 33). Gemessen wird der schnellste von drei
/// Aufrufen; der erste Aufruf wärmt nur (Seiten-Cache, Git-Objekte). Das Zeitbudget gilt dem ausgelieferten
/// Release-Build (hier gemessen: rund 120 ms); der Gate-Build ist unoptimiert und braucht fürs Auswerten der Texte
/// rund die Hälfte mehr — die 400 ms dort fangen den alten Zustand (hier 580 ms) weiterhin, ohne bei Fremdlast zu wackeln.
#[tokio::test]
async fn karten_verlauf_leistung_10_boards_2000_commits() {
    use std::os::unix::fs::PermissionsExt;
    let tmp = tempfile::tempdir().unwrap();
    messfall(tmp.path());
    // Ein PATH-Shim zählt die git-Aufrufe der Instanz — die zweite, deterministische Seite der Abnahme (vorher 33).
    let shim = tmp.path().join("shim");
    std::fs::create_dir_all(&shim).unwrap();
    let echt = String::from_utf8_lossy(
        &Command::new("sh")
            .arg("-c")
            .arg("command -v git")
            .output()
            .unwrap()
            .stdout,
    )
    .trim()
    .to_string();
    let spur = tmp.path().join("git-spur.log");
    std::fs::write(
        shim.join("git"),
        format!(
            "#!/bin/sh\necho \"$*\" >> '{}'\nexec '{}' \"$@\"\n",
            spur.display(),
            echt
        ),
    )
    .unwrap();
    std::fs::set_permissions(shim.join("git"), std::fs::Permissions::from_mode(0o755)).unwrap();
    let umgebung = format!("{}:{}", shim.display(), std::env::var("PATH").unwrap());
    let lauf = gemeinsam::starten_mit(tmp.path(), &["--port", "0"], &[("PATH", &umgebung)]);
    let pfad = "api/aufgaben/1/verlauf";
    let (s, v) = senden(Method::GET, &lauf.adresse, pfad, "st", json!(null)).await;
    assert_eq!(s, 200, "{v}");
    assert!(
        !v["eintraege"].as_array().unwrap().is_empty(),
        "Karte #1 hat einen Verlauf: {v}"
    );
    let mut beste = Duration::MAX;
    for _ in 0..3 {
        let start = Instant::now();
        let (s, _) = senden(Method::GET, &lauf.adresse, pfad, "st", json!(null)).await;
        assert_eq!(s, 200);
        beste = beste.min(start.elapsed());
    }
    std::fs::write(&spur, "").unwrap();
    let (s, _) = senden(Method::GET, &lauf.adresse, pfad, "st", json!(null)).await;
    assert_eq!(s, 200);
    let prozesse = std::fs::read_to_string(&spur)
        .unwrap()
        .lines()
        .filter(|z| !z.trim().is_empty())
        .count();
    assert!(
        prozesse <= 8,
        "{prozesse} git-Aufrufe je Verlauf (vorher 33) — die Kosten müssen an der Karte hängen"
    );
    let budget = Duration::from_millis(if cfg!(debug_assertions) { 400 } else { 200 });
    assert!(
        beste < budget,
        "GET {pfad} brauchte {beste:?} (Budget {budget:?})"
    );
}

/// #131: eine umbenannte Spalte ändert die Spalte der Karte, ohne ihre Zeile anzufassen — die gefilterte
/// Git-Abfrage muss die `## `-Überschriften mitlesen, sonst fehlt der Bewegungseintrag.
#[tokio::test]
async fn karten_verlauf_sieht_die_umbenannte_spalte() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::eingerichtet(tmp.path());
    std::fs::create_dir_all(tmp.path().join("aufgaben")).unwrap();
    std::fs::write(
        tmp.path().join("aufgaben/0001-eins.md"),
        "---\nid: 1\ntitle: eins\n---\n",
    )
    .unwrap();
    std::fs::write(
        tmp.path().join("boards/entwicklung.md"),
        "# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n",
    )
    .unwrap();
    verfassen(tmp.path(), "2026-10-01T09:00:00", "sh", "angelegt");
    std::fs::write(
        tmp.path().join("boards/entwicklung.md"),
        "# Entwicklung\n\n## Todo\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n",
    )
    .unwrap();
    verfassen(tmp.path(), "2026-10-02T09:00:00", "sh", "Spalte umbenannt");
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, v) = senden(
        Method::GET,
        &lauf.adresse,
        "api/aufgaben/1/verlauf",
        "st",
        json!(null),
    )
    .await;
    assert_eq!(s, 200, "{v}");
    let bewegt = v["eintraege"]
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["art"] == "bewegt")
        .expect("Bewegung der umbenannten Spalte");
    assert_eq!(
        (bewegt["von"].as_str(), bewegt["nach"].as_str()),
        (Some("Zu erledigen"), Some("Todo")),
        "{v}"
    );
}
