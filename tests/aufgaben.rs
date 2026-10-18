mod gemeinsam;

use serde_json::Value;

#[tokio::test]
async fn aufgaben_werden_gelesen_doppelte_und_defekte_gemeldet() {
    let tmp = tempfile::tempdir().unwrap();
    let a = tmp.path().join("aufgaben");
    std::fs::create_dir_all(&a).unwrap();
    std::fs::write(a.join("0001-erste.md"), "---\nid: 1\ntitle: Erste\nassignees: [st]\n---\n- [x] a\n- [ ] b\n").unwrap();
    std::fs::write(a.join("0002-zweite.md"), "---\ntitle: Zweite\n---\n").unwrap();
    std::fs::write(a.join("0003-doppelt.md"), "---\nid: 1\ntitle: Auch eins\n---\n").unwrap();
    std::fs::write(a.join("0004-kaputt.md"), "---\nid: 4\ntitle: [\n---\n").unwrap();
    std::fs::write(a.join("notiz.txt"), "keine Aufgabe").unwrap();
    std::fs::create_dir_all(a.join("0001-erste")).unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let r: Value = reqwest::get(format!("{}api/aufgaben", lauf.adresse)).await.unwrap().json().await.unwrap();
    let nummern: Vec<u64> = r["aufgaben"].as_array().unwrap().iter().map(|a| a["nummer"].as_u64().unwrap()).collect();
    assert_eq!(nummern, vec![1, 2]);
    assert_eq!(r["aufgaben"][0]["datei"], "0001-erste.md");
    assert_eq!(r["aufgaben"][0]["teilaufgaben"][0]["erledigt"], true);
    assert_eq!(r["aufgaben"][1]["titel"], "Zweite");
    let defekte = r["defekte"].as_array().unwrap();
    assert_eq!(defekte.len(), 2);
    assert_eq!(defekte[0]["pfad"], "aufgaben/0003-doppelt.md");
    assert!(defekte[0]["fehler"].as_str().unwrap().contains("#1 doppelt"));
    assert_eq!(defekte[1]["pfad"], "aufgaben/0004-kaputt.md");
    let z: Value = reqwest::get(format!("{}api/zustand", lauf.adresse)).await.unwrap().json().await.unwrap();
    assert_eq!(z["defekte"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn ordner_ohne_aufgaben_liefert_leere_liste() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let r: Value = reqwest::get(format!("{}api/aufgaben", lauf.adresse)).await.unwrap().json().await.unwrap();
    assert_eq!(r["aufgaben"].as_array().unwrap().len(), 0);
}

#[test]
fn naechste_nummer_zaehlt_alle_dateinamen_auch_defekte() {
    let tmp = tempfile::tempdir().unwrap();
    let o = kanband::ablage::Ordner::neu(tmp.path().to_path_buf());
    assert_eq!(o.naechste_nummer().unwrap(), 1);
    let a = tmp.path().join("aufgaben");
    std::fs::create_dir_all(&a).unwrap();
    std::fs::write(a.join("0001-a.md"), "---\nid: 1\ntitle: a\n---\n").unwrap();
    std::fs::write(a.join("0007-b.md"), "kaputt ---\n```kanbanD-time\n").unwrap();
    std::fs::write(a.join("liesmich.md"), "").unwrap();
    assert_eq!(o.naechste_nummer().unwrap(), 8);
}

#[tokio::test]
async fn defekte_einstellungen_lassen_lesen_zu_und_sperren_schreiben() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::write(tmp.path().join("kanbanD.md"), "---\npeople: [\n---\n").unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    for pfad in ["api/herkunft", "api/berichte/zeiten.csv", "api/aufgaben", "api/boards", "api/zustand"] {
        assert_eq!(reqwest::get(format!("{}{pfad}", lauf.adresse)).await.unwrap().status(), 200, "{pfad}");
    }
    let (s, f) = gemeinsam::senden(reqwest::Method::POST, &lauf.adresse, "api/aufgaben", "st", serde_json::json!({"titel": "x"})).await;
    assert_eq!(s, 423);
    assert!(f["fehler"].as_str().unwrap().contains("kanbanD.md"));
}
