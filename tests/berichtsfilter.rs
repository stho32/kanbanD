//! R00081: Berichtsfilter im Frontmatter des Boards, ein Commit der Person je Änderung.
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

#[tokio::test]
async fn filter_setzen_lesen_und_ohne_aenderung_kein_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let f = json!({"zeitraum": "30", "von": "2026-01-01", "ohneFarben": ["bug", "", "bug"], "ohneSpalten": ["Erledigt"], "personen": ["st"], "labels": []});
    let (s, v) = senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/berichtsfilter", "st", f.clone()).await;
    assert_eq!((s, v["geaendert"].as_bool()), (200, Some(true)));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|Berichtsfilter von „Entwicklung“ geändert");
    let text = lies(tmp.path(), "boards/entwicklung.md");
    assert!(text.contains("report-filter: {period: \"30\", exclude-classes: [bug, \"\"], exclude-columns: [Erledigt], people: [st]}\n"), "von nur bei eigen, Doppelte weg: {text}");
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!(b["berichtsfilter"], json!({"zeitraum": "30", "von": "", "bis": "", "ohneFarben": ["bug", ""], "ohneSpalten": ["Erledigt"], "personen": ["st"], "labels": []}));
    let vorher = git(tmp.path(), &["rev-list", "--count", "HEAD"]);
    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/berichtsfilter", "st", f).await;
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]), vorher, "gleicher Filter: kein Commit");
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/berichtsfilter", "st", json!({"zeitraum": "eigen", "von": "1.1.2026"})).await.0, 400);
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/berichtsfilter", "st", json!({"zeitraum": "gibts"})).await.0, 400);
    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/berichtsfilter", "st", json!({})).await;
    assert!(!lies(tmp.path(), "boards/entwicklung.md").contains("report-filter"), "leerer Filter: Schlüssel weg");
}
