mod gemeinsam;

#[tokio::test]
async fn csv_endpunkt_liefert_alle_zeiteintraege() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::write(tmp.path().join("aufgaben/0002-zwei.md"), "---\nid: 2\ntitle: zwei\narchived: 2026-10-01\n---\n```kanbanD-time\n2026-10-17 09:00 · 2026-10-17 10:00 · cl\n```\n").unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let r = reqwest::get(format!("{}api/berichte/zeiten.csv", lauf.adresse)).await.unwrap();
    assert_eq!(r.headers()["content-type"], "text/csv; charset=utf-8");
    assert!(r.headers()["content-disposition"].to_str().unwrap().contains("kanbanD-zeiten.csv"));
    let text = r.text().await.unwrap();
    assert_eq!(text.lines().nth(1), Some("2;zwei;cl;agent;2026-10-17 09:00;2026-10-17 10:00;60;thin air"));
}
