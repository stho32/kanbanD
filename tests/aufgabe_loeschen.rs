// R00141 Aufgabe endgültig löschen (I0129, #36, ADR-0024): Aufgabendatei, ihre Zeile aus **allen** Board-Dateien und
// ihr Anhangsordner verschwinden in **einem** Commit; ein Agent wird aus einer Menschen-Spalte 403 abgewiesen, ein
// defektes Board 423. Muster tests/archiv.rs (Aufbau über die API) und tests/eigentuemer_sperre.rs (Spalten-Sperre).
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

/// Drei Boards (alpha, beta, gamma): #1 liegt auf alpha **und** beta, gamma kennt sie nicht; #1 hat zwei Anhänge.
fn drei_boards(pfad: &Path) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben/0001-eins")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), gemeinsam::EINSTELLUNGEN).unwrap();
    std::fs::write(pfad.join("boards/alpha.md"), "# Alpha\n\n## Bereit\n\n- [#1](../aufgaben/0001-eins.md)\n\n## Fertig\n").unwrap();
    std::fs::write(pfad.join("boards/beta.md"), "# Beta\n\n## Offen\n\n- [#1](../aufgaben/0001-eins.md)\n\n## Erledigt\n").unwrap();
    std::fs::write(pfad.join("boards/gamma.md"), "# Gamma\n\n## Egal\n").unwrap();
    std::fs::write(pfad.join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\n---\n").unwrap();
    std::fs::write(pfad.join("aufgaben/0001-eins/a.txt"), "a").unwrap();
    std::fs::write(pfad.join("aufgaben/0001-eins/b.txt"), "b").unwrap();
    git(pfad, &["init", "-q"]);
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgang"]);
}

fn commits(pfad: &Path) -> usize {
    git(pfad, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

/// Eine Reservierung für `cl`/Instanz `A` auf `nr` (Header statt Feld, wie ein Agent es tut).
async fn reservieren(adresse: &str, nr: u32) -> u16 {
    let r = reqwest::Client::new()
        .post(format!("{adresse}api/aufgaben/{nr}/reservierung"))
        .header("X-KanbanD-Wer", "cl")
        .header("X-KanbanD-Instanz", "A")
        .send()
        .await
        .unwrap();
    r.status().as_u16()
}

fn verboten(spalte: &str, nummer: u32) -> Value {
    json!({"fehler": format!("Spalte „{spalte}“ gehört dem Menschen"), "spalte": spalte, "nummer": nummer})
}

#[tokio::test]
async fn ak1_weg_und_genau_ein_commit() {
    let tmp = tempfile::tempdir().unwrap();
    drei_boards(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    assert_eq!(senden(Method::POST, a, "api/aufgaben/1/timer/start", "cl", json!(null)).await.0, 200, "laufender Timer");
    assert_eq!(reservieren(a, 1).await, 200, "Reservierung");
    let vorher = commits(tmp.path());

    let (s, r) = senden(Method::DELETE, a, "api/aufgaben/1", "st", json!(null)).await;
    assert_eq!((s, r), (200, json!({"nummer": 1})));
    assert!(!tmp.path().join("aufgaben/0001-eins.md").exists(), "die Aufgabendatei ist weg");
    assert!(!lies(tmp.path(), "boards/alpha.md").contains("#1"), "alpha ohne die Zeile: {}", lies(tmp.path(), "boards/alpha.md"));
    assert!(!lies(tmp.path(), "boards/beta.md").contains("#1"), "beta ohne die Zeile: {}", lies(tmp.path(), "boards/beta.md"));
    assert_eq!(lies(tmp.path(), "boards/gamma.md"), "# Gamma\n\n## Egal\n", "das dritte Board ist unverändert");
    assert!(!tmp.path().join("aufgaben/0001-eins").exists(), "der Anhangsordner ist weg");
    assert_eq!(commits(tmp.path()), vorher + 1, "genau ein Commit");
    assert!(git(tmp.path(), &["show", "--name-only", "--format=", "HEAD"]).contains("aufgaben/0001-eins.md"), "git show zeigt die Löschung");
    assert!(!git(tmp.path(), &["log", "--oneline", "--", "aufgaben/0001-eins.md"]).is_empty(), "die Historie der Datei bleibt");
    assert_eq!(git(tmp.path(), &["status", "--short"]), "", "Arbeitsbaum sauber");
}

#[tokio::test]
async fn ak2_unbekannte_nummer_404_nichts_geaendert() {
    let tmp = tempfile::tempdir().unwrap();
    drei_boards(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = commits(tmp.path());
    assert_eq!(senden(Method::DELETE, a, "api/aufgaben/99", "st", json!(null)).await.0, 404);
    assert_eq!(commits(tmp.path()), vorher, "kein Commit");
    assert!(tmp.path().join("aufgaben/0001-eins.md").exists(), "nichts entfernt");
    assert_eq!(git(tmp.path(), &["status", "--short"]), "");
}

#[tokio::test]
async fn ak3_defekte_aufgabendatei_laesst_sich_loeschen() {
    let tmp = tempfile::tempdir().unwrap();
    drei_boards(tmp.path());
    std::fs::remove_file(tmp.path().join("aufgaben/0001-eins.md")).unwrap();
    std::fs::write(tmp.path().join("aufgaben/0001-kaputt.md"), "kaputt und ohne Frontmatter\n").unwrap();
    git(tmp.path(), &["add", "-A"]);
    git(tmp.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "kaputte Datei"]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = commits(tmp.path());
    assert_eq!(senden(Method::DELETE, a, "api/aufgaben/1", "st", json!(null)).await.0, 200, "eine defekte Datei lässt sich löschen");
    assert!(!tmp.path().join("aufgaben/0001-kaputt.md").exists(), "die defekte Datei ist weg");
    assert!(!lies(tmp.path(), "boards/alpha.md").contains("#1"), "die Board-Zeile ist weg");
    assert_eq!(commits(tmp.path()), vorher + 1, "ein Commit");
}

#[tokio::test]
async fn ak4_nachricht_und_nebenwirkungen() {
    let tmp = tempfile::tempdir().unwrap();
    drei_boards(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    assert_eq!(senden(Method::POST, a, "api/aufgaben/1/timer/start", "cl", json!(null)).await.0, 200);
    assert_eq!(reservieren(a, 1).await, 200);
    assert_eq!(senden(Method::DELETE, a, "api/aufgaben/1", "st", json!(null)).await.0, 200);
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#1 gelöscht, 2 Anhänge (2 Boards)", "Nachricht und Autor");
    let (s, r) = senden(Method::GET, a, "api/aufgaben/1", "st", json!(null)).await;
    assert_eq!(s, 404, "die Aufgabe samt laufendem Timer und Reservierung ist weg: {r}");
    let (_, liste) = senden(Method::GET, a, "api/aufgaben", "st", json!(null)).await;
    assert!(liste["aufgaben"].as_array().unwrap().iter().all(|x| x["nummer"] != 1), "keine Karte #1 mehr");
}

#[tokio::test]
async fn ak5_agent_aus_menschen_spalte_403_mensch_frei() {
    let tmp = tempfile::tempdir().unwrap();
    drei_boards(tmp.path());
    // „Bereit“ auf alpha gehört dem Menschen; #1 liegt dort.
    std::fs::write(tmp.path().join("boards/alpha.md"), "---\ncolumn-owner:\n  Bereit: human\n---\n\n# Alpha\n\n## Bereit\n\n- [#1](../aufgaben/0001-eins.md)\n\n## Fertig\n").unwrap();
    git(tmp.path(), &["add", "-A"]);
    git(tmp.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Menschen-Spalte"]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = commits(tmp.path());
    let (s, r) = senden(Method::DELETE, a, "api/aufgaben/1", "cl", json!(null)).await;
    assert_eq!((s, r), (403, verboten("Bereit", 1)), "der Agent wird abgewiesen");
    assert_eq!(commits(tmp.path()), vorher, "kein Commit");
    assert!(tmp.path().join("aufgaben/0001-eins.md").exists(), "nichts geändert");
    assert_eq!(senden(Method::DELETE, a, "api/aufgaben/1", "st", json!(null)).await.0, 200, "ein Mensch darf löschen");
}

#[tokio::test]
async fn ak6_defektes_board_423() {
    let tmp = tempfile::tempdir().unwrap();
    drei_boards(tmp.path());
    std::fs::write(tmp.path().join("boards/kaputt.md"), "---\nstart: kaputt\n---\n\n# Kaputt\n\n## Eingang\n").unwrap();
    git(tmp.path(), &["add", "-A"]);
    git(tmp.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "defektes Board"]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = commits(tmp.path());
    let (s, r) = senden(Method::DELETE, a, "api/aufgaben/1", "cl", json!(null)).await;
    assert_eq!(s, 423, "der Agent wird mit 423 abgewiesen: {r}");
    assert_eq!(commits(tmp.path()), vorher, "kein Commit");
    assert!(tmp.path().join("aufgaben/0001-eins.md").exists(), "nichts geändert");
}
