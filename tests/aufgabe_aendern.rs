mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn felder_aendern_ein_commit_mit_feldnamen() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, a) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/1", "st", json!({"titel": "Neu", "klasse": "bug", "labels": ["ui", "daten"], "faellig": "2026-12-24"})).await;
    assert_eq!(s, 200);
    assert_eq!(a["titel"], "Neu");
    assert_eq!(lies(tmp.path(), "aufgaben/0001-eins.md"), "---\nid: 1\ntitle: Neu\nclass: bug\nlabels: [ui, daten]\ndue: 2026-12-24\n---\n");
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=%an|%s", "HEAD"]), "Stefan|#1 geändert: Titel, Klasse, Labels, Fälligkeit\n\naufgaben/0001-eins.md");
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    senden(Method::PATCH, &lauf.adresse, "api/aufgaben/1", "st", json!({"titel": "Neu"})).await;
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
    senden(Method::PATCH, &lauf.adresse, "api/aufgaben/1", "st", json!({"klasse": null})).await;
    assert!(!lies(tmp.path(), "aufgaben/0001-eins.md").contains("class:"));
    let (s, g) = senden(Method::GET, &lauf.adresse, "api/aufgaben/1", "st", json!(null)).await;
    assert_eq!((s, g["pfad"].as_str()), (200, Some("aufgaben/0001-eins.md")));
    assert!(g["text"].as_str().unwrap().starts_with("---\nid: 1\ntitle: Neu\n"));
}

#[tokio::test]
async fn fehler_400_404_und_defekt_423() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::write(tmp.path().join("aufgaben/0004-kaputt.md"), "---\nid: 4\ntitle: [\n---\n").unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    for j in [json!({"klasse": "gibtsnicht"}), json!({"faellig": "24.12."}), json!({"titel": ""}), json!({"zustaendige": ["zz"]})] {
        assert_eq!(senden(Method::PATCH, &lauf.adresse, "api/aufgaben/1", "st", j).await.0, 400);
    }
    assert_eq!(senden(Method::PATCH, &lauf.adresse, "api/aufgaben/99", "st", json!({"titel": "x"})).await.0, 404);
    assert_eq!(senden(Method::GET, &lauf.adresse, "api/aufgaben/99", "st", json!(null)).await.0, 404);
    let (s, g) = senden(Method::GET, &lauf.adresse, "api/aufgaben/4", "st", json!(null)).await;
    assert_eq!(s, 423);
    assert!(g["fehler"].as_str().unwrap().contains("nur lesbar"));
    assert!(g["text"].as_str().unwrap().contains("title: ["));
    assert_eq!(senden(Method::PATCH, &lauf.adresse, "api/aufgaben/4", "st", json!({"titel": "x"})).await.0, 423);
}
