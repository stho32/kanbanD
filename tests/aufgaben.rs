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
