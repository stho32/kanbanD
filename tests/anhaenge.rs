mod gemeinsam;

use gemeinsam::{git, senden};
use reqwest::Method;
use serde_json::{Value, json};

async fn hochladen(adresse: &str, nr: u32, name: &str, inhalt: &[u8]) -> (u16, Value) {
    let teil = reqwest::multipart::Part::bytes(inhalt.to_vec()).file_name(name.to_string());
    let r = reqwest::Client::new()
        .post(format!("{adresse}api/aufgaben/{nr}/anhaenge"))
        .header("X-KanbanD-Wer", "st")
        .multipart(reqwest::multipart::Form::new().part("datei", teil))
        .send()
        .await
        .unwrap();
    (r.status().as_u16(), r.json().await.unwrap())
}

#[tokio::test]
async fn hochladen_ausliefern_entfernen() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let bytes: Vec<u8> = (0..=255u8).collect();
    let (s, a) = hochladen(&lauf.adresse, 1, "bild.png", &bytes).await;
    assert_eq!((s, a["name"].as_str(), a["groesse"].as_u64()), (201, Some("bild.png"), Some(256)));
    assert_eq!(std::fs::read(tmp.path().join("aufgaben/0001-eins/bild.png")).unwrap(), bytes);
    assert_eq!(git(tmp.path(), &["show", "--name-only", "--format=%an|%s", "HEAD"]), "Stefan|#1 Anhang „bild.png“ hinzugefügt\n\naufgaben/0001-eins/bild.png");
    let (_, b) = hochladen(&lauf.adresse, 1, "../bild.png", b"x").await;
    assert_eq!(b["name"], "bild-2.png");
    let (_, liste) = senden(Method::GET, &lauf.adresse, "api/aufgaben/1/anhaenge", "st", json!(null)).await;
    assert_eq!(liste.as_array().unwrap().len(), 2);
    let r = reqwest::get(format!("{}api/aufgaben/1/anhaenge/bild.png", lauf.adresse)).await.unwrap();
    assert_eq!(r.headers()["content-type"], "image/png");
    assert_eq!(r.bytes().await.unwrap().to_vec(), bytes);
    assert_eq!(senden(Method::DELETE, &lauf.adresse, "api/aufgaben/1/anhaenge/bild.png", "st", json!(null)).await.0, 200);
    assert_eq!(senden(Method::DELETE, &lauf.adresse, "api/aufgaben/1/anhaenge/bild-2.png", "st", json!(null)).await.0, 200);
    assert!(!tmp.path().join("aufgaben/0001-eins").exists());
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1 Anhang „bild-2.png“ entfernt");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "");
}

#[tokio::test]
async fn unbekannt_ist_404_und_svg_wird_nicht_eingebettet() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    assert_eq!(reqwest::get(format!("{}api/aufgaben/1/anhaenge/fehlt.txt", lauf.adresse)).await.unwrap().status(), 404);
    assert_eq!(senden(Method::DELETE, &lauf.adresse, "api/aufgaben/1/anhaenge/fehlt.txt", "st", json!(null)).await.0, 404);
    assert_eq!(hochladen(&lauf.adresse, 9, "a.txt", b"x").await.0, 404);
    hochladen(&lauf.adresse, 2, "b.svg", b"<svg/>").await;
    let r = reqwest::get(format!("{}api/aufgaben/2/anhaenge/b.svg", lauf.adresse)).await.unwrap();
    assert!(r.headers()["content-disposition"].to_str().unwrap().starts_with("attachment"));
    hochladen(&lauf.adresse, 2, "notiz äö.txt", b"t").await;
    let r = reqwest::get(format!("{}api/aufgaben/2/anhaenge/notiz%20%C3%A4%C3%B6.txt", lauf.adresse)).await.unwrap();
    assert_eq!(r.headers()["content-type"], "text/plain; charset=utf-8");
    let r = reqwest::Client::new().post(format!("{}api/aufgaben/2/anhaenge", lauf.adresse)).header("X-KanbanD-Wer", "st").multipart(reqwest::multipart::Form::new().text("anderes", "x")).send().await.unwrap();
    assert_eq!(r.status(), 400);
}
