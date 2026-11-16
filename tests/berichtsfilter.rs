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
    assert_eq!(b["berichtsfilter"], json!({"zeitraum": "30", "von": "", "bis": "", "ohneFarben": ["bug", ""], "ohneSpalten": ["Erledigt"], "personen": ["st"], "labels": [], "messbasisTage": 90}));
    let vorher = git(tmp.path(), &["rev-list", "--count", "HEAD"]);
    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/berichtsfilter", "st", f).await;
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]), vorher, "gleicher Filter: kein Commit");
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/berichtsfilter", "st", json!({"zeitraum": "eigen", "von": "1.1.2026"})).await.0, 400);
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/berichtsfilter", "st", json!({"zeitraum": "gibts"})).await.0, 400);
    // R00083: Messbasis der letzten N Tage
    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/berichtsfilter", "st", json!({"messbasisTage": 30})).await;
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("report-filter: {window-days: 30}\n"));
    assert_eq!(senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/berichtsfilter", "st", json!({"messbasisTage": 0})).await.0, 400);
    senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/berichtsfilter", "st", json!({})).await;
    assert!(!lies(tmp.path(), "boards/entwicklung.md").contains("report-filter"), "leerer Filter: Schlüssel weg");
}

/// R00171 B0837 (AK 5, AK 6, Schaden e): der Spaltenabschnitt des Kostenberichts über die Route — gespeichert neben dem
/// Zeitraum, zurückgegeben, ohne Wahl nicht geschrieben; geprüft wird nur die Form.
#[tokio::test]
async fn kostenabschnitt_setzen_lesen_und_aufheben() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let setzen = |koerper: serde_json::Value| senden(Method::PUT, &lauf.adresse, "api/boards/entwicklung/berichtsfilter", "st", koerper);
    let filter = || async { senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await.1["berichtsfilter"].clone() };

    let wahl = json!({"zeitraum": "eigen", "von": "2026-11-12", "bis": "2026-11-13", "ohneSpalten": ["Erledigt"], "kostenVonSpalte": "In Arbeit", "kostenBisSpalte": "Erledigt"});
    assert_eq!(setzen(wahl.clone()).await.0, 200);
    let text = lies(tmp.path(), "boards/entwicklung.md");
    assert!(text.contains("report-filter: {period: eigen, from: 2026-11-12, to: 2026-11-13, exclude-columns: [Erledigt], cost-from-column: In Arbeit, cost-to-column: Erledigt}\n"), "{text}");
    let gelesen = filter().await;
    assert_eq!((gelesen["kostenVonSpalte"].as_str(), gelesen["kostenBisSpalte"].as_str()), (Some("In Arbeit"), Some("Erledigt")));
    assert_eq!((gelesen["zeitraum"].as_str(), gelesen["ohneSpalten"].clone()), (Some("eigen"), json!(["Erledigt"])));

    // nur der Abschnitt fällt weg: der Zeitraum und die übrigen Filter bleiben
    assert_eq!(setzen(json!({"zeitraum": "eigen", "von": "2026-11-12", "bis": "2026-11-13", "ohneSpalten": ["Erledigt"], "kostenVonSpalte": "", "kostenBisSpalte": ""})).await.0, 200);
    let text = lies(tmp.path(), "boards/entwicklung.md");
    assert!(text.contains("report-filter: {period: eigen, from: 2026-11-12, to: 2026-11-13, exclude-columns: [Erledigt]}\n"), "{text}");
    let gelesen = filter().await;
    assert!(gelesen.get("kostenVonSpalte").is_none() && gelesen.get("kostenBisSpalte").is_none(), "ohne Wahl trägt die Antwort die Felder nicht: {gelesen}");

    // nur der Zeitraum fällt weg: der Abschnitt bleibt; eine Spalte, die das Board nicht führt, wird angenommen
    assert_eq!(setzen(json!({"kostenBisSpalte": "Abnahme: \"extern\""})).await.0, 200);
    let text = lies(tmp.path(), "boards/entwicklung.md");
    assert!(text.contains("report-filter: {cost-to-column: \"Abnahme: \\\"extern\\\"\"}\n"), "{text}");
    assert_eq!(filter().await["kostenBisSpalte"].as_str(), Some("Abnahme: \"extern\""));

    let vorher = lies(tmp.path(), "boards/entwicklung.md");
    assert_eq!(setzen(json!({"kostenVonSpalte": "zwei\nZeilen"})).await.0, 400);
    assert_eq!(setzen(json!({"kostenBisSpalte": 3})).await.0, 400);
    assert_eq!(lies(tmp.path(), "boards/entwicklung.md"), vorher, "eine abgewiesene Wahl ändert die Datei nicht");

    assert_eq!(setzen(json!({})).await.0, 200);
    assert!(!lies(tmp.path(), "boards/entwicklung.md").contains("report-filter"), "alles aufgehoben: Schlüssel weg");
}
