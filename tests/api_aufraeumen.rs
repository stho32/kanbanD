// R00092 API aufräumen: Antwortform, archivierte Karten, Filter
mod gemeinsam;

use gemeinsam::senden;
use reqwest::Method;
use serde_json::{Value, json};

async fn lesen(adresse: &str, pfad: &str) -> (u16, Value) {
    senden(Method::GET, adresse, pfad, "st", json!(null)).await
}

#[tokio::test]
async fn karte_direkt_mit_pfad_und_text() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, a) = lesen(&lauf.adresse, "api/aufgaben/2").await;
    assert_eq!(s, 200);
    assert_eq!((a["nummer"].as_u64(), a["titel"].as_str(), a["pfad"].as_str()), (Some(2), Some("zwei"), Some("aufgaben/0002-zwei.md")));
    assert_eq!(a["text"], "---\nid: 2\ntitle: zwei\n---\n");
    assert!(a.get("aufgabe").is_none(), "keine Hülle mehr");
    std::fs::write(tmp.path().join("aufgaben/0003-drei.md"), "---\nid: 3\ntitle: [kaputt\n---\n").unwrap();
    let (s, d) = lesen(&lauf.adresse, "api/aufgaben/3").await;
    assert_eq!(s, 423);
    assert!(d["fehler"].is_string() && d["pfad"] == "aufgaben/0003-drei.md" && d["text"].as_str().unwrap().contains("[kaputt"));
}

/// Board „x“ mit Backlog [89, 90, 91]; #89 und #91 archiviert.
fn mit_backlog(pfad: &std::path::Path) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    for (nr, mehr) in [(89, "archived: 2026-10-01\n"), (90, "class: bug\n"), (91, "archived: 2026-10-02\nclass: bug\n"), (93, "")] {
        std::fs::write(pfad.join(format!("aufgaben/{nr:04}-k.md")), format!("---\nid: {nr}\ntitle: k{nr}\n{mehr}---\n")).unwrap();
    }
    std::fs::write(pfad.join("boards/x.md"), "# X\n\n## Backlog\n\n- #89\n- #90\n- #91\n- #93\n\n## Fertig\n").unwrap();
    gemeinsam::git(pfad, &["add", "-A"]);
    gemeinsam::git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "x"]);
}

fn backlog(b: &Value) -> Value {
    b["spalten"].as_array().unwrap().iter().find(|s| s["name"] == "Backlog").unwrap()["aufgaben"].clone()
}

#[tokio::test]
async fn board_antworten_ohne_archivierte() {
    let tmp = tempfile::tempdir().unwrap();
    mit_backlog(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    assert_eq!(backlog(&lesen(a, "api/boards/x").await.1), json!([90, 93]));
    assert_eq!(backlog(&lesen(a, "api/boards/x?archivierte=ja").await.1), json!([89, 90, 91, 93]));
    let (_, alle) = lesen(a, "api/boards").await;
    let x = alle.as_array().unwrap().iter().find(|b| b["slug"] == "x").unwrap();
    assert_eq!(backlog(x), json!([90, 93]));
    let (_, alle) = lesen(a, "api/boards?archivierte=ja").await;
    assert_eq!(backlog(alle.as_array().unwrap().iter().find(|b| b["slug"] == "x").unwrap()), json!([89, 90, 91, 93]));
    assert!(gemeinsam::lies(tmp.path(), "boards/x.md").contains("- #89\n"), "die Board-Datei behält den Platz");
    senden(Method::POST, a, "api/aufgaben/89/zurueckholen", "st", json!(null)).await;
    assert_eq!(backlog(&lesen(a, "api/boards/x").await.1), json!([89, 90, 93]), "zurückgeholt steht sie wieder an ihrem Platz");
}

fn nummern(r: &Value) -> Vec<u64> {
    let mut n: Vec<u64> = r["aufgaben"].as_array().unwrap().iter().map(|a| a["nummer"].as_u64().unwrap()).collect();
    n.sort();
    n
}

#[tokio::test]
async fn aufgaben_filtern() {
    let tmp = tempfile::tempdir().unwrap();
    mit_backlog(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    assert_eq!(nummern(&lesen(a, "api/aufgaben").await.1), vec![89, 90, 91, 93], "ohne Parameter alles wie bisher");
    let (s, r) = lesen(a, "api/aufgaben?board=x&spalte=Backlog&klasse=bug").await;
    assert_eq!((s, nummern(&r)), (200, vec![90]), "nicht archivierte Fehler in Backlog");
    assert!(r["defekte"].is_array());
    assert_eq!(nummern(&lesen(a, "api/aufgaben?klasse=bug&archivierte=ja").await.1), vec![90, 91]);
    assert_eq!(nummern(&lesen(a, "api/aufgaben?archivierte=nur").await.1), vec![89, 91]);
    std::fs::write(tmp.path().join("aufgaben/0093-k.md"), "---\nid: 93\ntitle: k93\nclass: doku\n---\n").unwrap();
    assert_eq!(nummern(&lesen(a, "api/aufgaben?klasse=bug&klasse=doku").await.1), vec![90, 93], "derselbe Parameter mehrfach: oder");
    assert_eq!(lesen(a, "api/aufgaben?spalte=Backlog").await.0, 400, "spalte ohne board");
    assert_eq!(lesen(a, "api/aufgaben?board=x&spalte=Gibtsnicht").await.0, 400);
    assert_eq!(lesen(a, "api/aufgaben?farbe=rot").await.0, 400);
    assert_eq!(lesen(a, "api/aufgaben?board=gibtsnicht").await.0, 404);
}
