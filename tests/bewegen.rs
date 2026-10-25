mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

fn starten(tmp: &tempfile::TempDir) -> gemeinsam::Laufendes {
    gemeinsam::mit_drei_aufgaben(tmp.path());
    gemeinsam::starten(tmp.path(), &["--port", "0"])
}

#[tokio::test]
async fn in_andere_spalte_aendert_nur_die_board_datei() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let aufgabe_vorher = lies(tmp.path(), "aufgaben/0002-zwei.md");
    let (s, r) = senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen", "cl", json!({"nummer": 2, "spalte": "Erledigt"})).await;
    assert_eq!((s, r["bewegt"].as_bool()), (200, Some(true)));
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## In Arbeit\n\n## Erledigt\n\n- [#2](../aufgaben/0002-zwei.md)\n"));
    assert_eq!(lies(tmp.path(), "aufgaben/0002-zwei.md"), aufgabe_vorher);
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=%an|%s", "HEAD"]), "Claude|#2 nach „Erledigt“ (Entwicklung)\n\nboards/entwicklung.md");
}

#[tokio::test]
async fn umsortieren_und_gleiche_stelle() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen", "st", json!({"nummer": 3, "spalte": "Zu erledigen", "index": 0})).await;
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("- [#3](../aufgaben/0003-drei.md)\n- [#1](../aufgaben/0001-eins.md)\n- [#2]"));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#3 in „Zu erledigen“ umsortiert (Entwicklung)");
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    let (_, r) = senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen", "st", json!({"nummer": 3, "spalte": "Zu erledigen", "index": 0})).await;
    assert_eq!(r["bewegt"], false);
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
}

#[tokio::test]
async fn fehlerfaelle() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen", "st", json!({"nummer": 9, "spalte": "Erledigt"})).await.0, 404);
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen", "st", json!({"nummer": 1, "spalte": "Nirgends"})).await.0, 400);
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/boards/gibtsnicht/bewegen", "st", json!({"nummer": 1, "spalte": "A"})).await.0, 404);
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen", "", json!({"nummer": 1, "spalte": "Erledigt"})).await.0, 400);
}

// R00086: ohne Index oben, mit Index wie angegeben (zu groß → ans Ende); mehrere in Anfragereihenfolge
#[tokio::test]
async fn ohne_index_oben_mit_index_wie_angegeben() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = starten(&tmp);
    let a = &lauf.adresse;
    senden(Method::POST, a, "api/boards/entwicklung/bewegen", "cl", json!({"nummer": 1, "spalte": "Erledigt"})).await;
    senden(Method::POST, a, "api/boards/entwicklung/bewegen", "cl", json!({"nummer": 2, "spalte": "Erledigt"})).await;
    let spalte = |b: &str| b.split("## Erledigt\n\n").nth(1).unwrap().lines().filter_map(|z| z.strip_prefix("- [#")).map(|z| z[..1].to_string()).collect::<Vec<_>>().join(",");
    assert_eq!(spalte(&lies(tmp.path(), "boards/entwicklung.md")), "2,1");
    senden(Method::POST, a, "api/boards/entwicklung/bewegen", "cl", json!({"nummer": 3, "spalte": "Erledigt", "index": 99})).await;
    assert_eq!(spalte(&lies(tmp.path(), "boards/entwicklung.md")), "2,1,3");
    let (s, _) = senden(Method::POST, a, "api/boards/entwicklung/bewegen-mehrere", "cl", json!({"ziele": [{"nummer": 3, "spalte": "Erledigt"}, {"nummer": 1, "spalte": "Erledigt"}]})).await;
    assert_eq!(s, 200);
    assert_eq!(spalte(&lies(tmp.path(), "boards/entwicklung.md")), "3,1,2");
}
