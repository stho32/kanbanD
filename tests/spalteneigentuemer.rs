mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

// R00097 B0287: eigentuemer je Spalte in GET Board und Boardliste; ein unbekannter Wert gilt nicht und steht als Hinweis da
#[tokio::test]
async fn eigentuemer_und_hinweis_im_board() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let b = lies(tmp.path(), "boards/entwicklung.md").replace("## Zu erledigen", "## Eingang");
    std::fs::write(tmp.path().join("boards/entwicklung.md"), format!("---\ncolumn-owner:\n  Eingang: chef\n  In Arbeit: agent\n---\n\n{b}")).unwrap();
    git(tmp.path(), &["commit", "-qam", "Eigentümer"]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, r) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!(s, 200);
    let eigentuemer: Vec<_> = r["spalten"].as_array().unwrap().iter().map(|s| s["eigentuemer"].clone()).collect();
    assert_eq!(eigentuemer, [json!(null), json!("agent"), json!(null)]);
    // B0296: der Rohwert kommt für „Spalten einrichten“ mit, nur wo es ihn gibt
    let roh: Vec<_> = r["spalten"].as_array().unwrap().iter().map(|s| s.get("eigentuemer_unbekannt").cloned()).collect();
    assert_eq!(roh, [Some(json!("chef")), None, None]);
    let hinweise = r["hinweise"].as_array().unwrap();
    assert!(hinweise.iter().any(|h| h == "Spalte „Eingang“: unbekannter Eigentümer „chef“"), "{hinweise:?}");
    let (s, l) = senden(Method::GET, &lauf.adresse, "api/boards", "st", json!(null)).await;
    assert_eq!(s, 200);
    let board = l.as_array().unwrap().iter().find(|x| x["slug"] == "entwicklung").expect("Board in der Liste");
    assert_eq!(board["spalten"][1]["eigentuemer"], "agent");
    assert_eq!(board["spalten"][0]["eigentuemer"], json!(null));
}
