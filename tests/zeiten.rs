mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::json;

/// Pfad eines Eintrags über seine Kennung, URL-kodiert (R00090).
fn pfad(kennung: &str) -> String {
    format!("api/aufgaben/1/zeiten/{}", kennung.replace('+', "%2B").replace(':', "%3A"))
}

fn mit_zeiten(pfad: &std::path::Path) {
    gemeinsam::mit_drei_aufgaben(pfad);
    std::fs::write(pfad.join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\n---\n```kanbanD-time\n2026-10-17 09:00 · 2026-10-17 11:00 · cl\n2026-10-18 08:00 · ... · st\n```\n").unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "zeiten"]);
}

#[tokio::test]
async fn nachtragen_endet_jetzt() {
    let tmp = tempfile::tempdir().unwrap();
    mit_zeiten(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, a) = senden(Method::POST, &lauf.adresse, "api/aufgaben/1/zeiten", "st", json!({"dauer": "1:30"})).await;
    assert_eq!(s, 200);
    let z = &a["zeiten"][2];
    let (b, e) = (z["beginn"].as_str().unwrap(), z["ende"].as_str().unwrap());
    assert_eq!(kanband::uhr::minuten(b, e), Some(90));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#1 Zeit nachgetragen: 1:30 (Stefan)");
    assert_eq!(senden(Method::POST, &lauf.adresse, "api/aufgaben/1/zeiten", "st", json!({"dauer": "x"})).await.0, 400);
}

#[tokio::test]
async fn korrigieren_und_regeln() {
    let tmp = tempfile::tempdir().unwrap();
    mit_zeiten(tmp.path());
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (k0, k1) = (pfad("cl@2026-10-17T09:00+02:00"), pfad("st@2026-10-18T08:00+02:00"));
    let (s, _) = senden(Method::PATCH, a, &k0, "st", json!({"ende": "2026-10-17 10:00"})).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").contains("2026-10-17 09:00 · 2026-10-17 10:00+02:00 · cl"), "Eingabe ohne Versatz als Ortszeit, Altbeginn bleibt");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#1 Zeit korrigiert (Claude)");
    assert_eq!(senden(Method::PATCH, a, &k0, "st", json!({"ende": "2026-10-17 08:00"})).await.0, 400);
    assert_eq!(senden(Method::PATCH, a, &k0, "st", json!({"beginn": "gestern"})).await.0, 400);
    assert_eq!(senden(Method::PATCH, a, &k1, "st", json!({"ende": "2026-10-18 09:00"})).await.0, 400);
    assert_eq!(senden(Method::PATCH, a, &k1, "st", json!({"beginn": "2026-10-18 07:30"})).await.0, 200);
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").contains("2026-10-18 07:30+02:00 · ... · st"));
    assert_eq!(senden(Method::PATCH, a, &k1, "st", json!({})).await.0, 404, "mit neuem Beginn hat der Eintrag eine neue Kennung");
    assert_eq!(senden(Method::PATCH, a, &pfad("st@2026-10-18T07:30+02:00"), "st", json!({})).await.0, 200, "die neue Kennung trifft");
    assert_eq!(senden(Method::PATCH, a, "api/aufgaben/1/zeiten/xx@2026-01-01T00:00+01:00", "st", json!({})).await.0, 404);
    let vorher = git(tmp.path(), &["rev-parse", "HEAD"]);
    senden(Method::PATCH, a, &k0, "st", json!({})).await;
    assert_eq!(git(tmp.path(), &["rev-parse", "HEAD"]), vorher);
}

#[tokio::test]
async fn loeschen_nur_beendete() {
    let tmp = tempfile::tempdir().unwrap();
    mit_zeiten(tmp.path());
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let (k0, k1) = (pfad("cl@2026-10-17T09:00+02:00"), pfad("st@2026-10-18T08:00+02:00"));
    assert_eq!(senden(Method::DELETE, &lauf.adresse, &k1, "st", json!(null)).await.0, 409);
    assert_eq!(senden(Method::DELETE, &lauf.adresse, &k0, "st", json!(null)).await.0, 200);
    assert!(!lies(tmp.path(), "aufgaben/0001-eins.md").contains("· cl"));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%s"]), "#1 Zeit gelöscht (Claude, 2:00)");
}

// R00084: ISO-Eingabe wird Ortszeit mit Versatz, verglichen wird über UTC statt über den Text
#[tokio::test]
async fn korrektur_mit_versatz_vergleicht_ueber_utc() {
    let tmp = tempfile::tempdir().unwrap();
    mit_zeiten(tmp.path());
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let k0 = pfad("cl@2026-10-17T09:00+02:00");
    let (s, r) = senden(Method::PATCH, a, &k0, "st", json!({"ende": "2026-10-17T08:00Z"})).await;
    assert_eq!(s, 200);
    assert_eq!(r["zeiten"][0]["ende"], "2026-10-17 10:00+02:00");
    // 08:30+01:00 ist 09:30 Berliner Sommerzeit — nach dem Beginn 09:00, als Text aber kleiner
    assert_eq!(senden(Method::PATCH, a, &k0, "st", json!({"ende": "2026-10-17 08:30+01:00"})).await.0, 200);
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").contains("2026-10-17 09:00 · 2026-10-17 09:30+02:00 · cl"));
    // 09:30+03:00 ist 08:30 Berliner Zeit — vor dem Beginn, als Text aber größer
    assert_eq!(senden(Method::PATCH, a, &k0, "st", json!({"ende": "2026-10-17 09:30+03:00"})).await.0, 400);
}

// R00090: ein Block mit Beginn und Ende in einem Aufruf, auch für eine andere Person
#[tokio::test]
async fn nachtragen_mit_beginn_und_ende_fuer_eine_person() {
    let tmp = tempfile::tempdir().unwrap();
    mit_zeiten(tmp.path());
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (s, r) = senden(Method::POST, a, "api/aufgaben/1/zeiten", "st", json!({"beginn": "2026-10-25 05:57+01:00", "ende": "2026-10-25 07:40+01:00", "wer": "cl"})).await;
    assert_eq!(s, 200, "{r}");
    let z = r["zeiten"].as_array().unwrap().iter().find(|z| z["beginn"] == "2026-10-25 05:57+01:00").unwrap().clone();
    assert_eq!((z["wer"].as_str(), z["ende"].as_str()), (Some("cl"), Some("2026-10-25 07:40+01:00")));
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").contains("2026-10-25 05:57+01:00 · 2026-10-25 07:40+01:00 · cl\n"));
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Stefan|#1 Zeit nachgetragen: 1:43 (Claude)");
    // ISO und ohne wer: für die handelnde Person
    let (s, r) = senden(Method::POST, a, "api/aufgaben/1/zeiten", "st", json!({"beginn": "2026-10-24T08:00Z", "ende": "2026-10-24T08:30Z"})).await;
    assert_eq!(s, 200);
    assert!(r["zeiten"].as_array().unwrap().iter().any(|z| z["beginn"] == "2026-10-24 10:00+02:00" && z["wer"] == "st"));
}

#[tokio::test]
async fn nachtragen_regeln() {
    let tmp = tempfile::tempdir().unwrap();
    mit_zeiten(tmp.path());
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let post = |d: serde_json::Value| senden(Method::POST, a, "api/aufgaben/1/zeiten", "st", d);
    assert_eq!(post(json!({"dauer": "0:45", "beginn": "2026-10-24 08:00"})).await.0, 400, "beides");
    assert_eq!(post(json!({})).await.0, 400, "keins");
    assert_eq!(post(json!({"beginn": "2026-10-24 08:00"})).await.0, 400, "ohne Ende");
    assert_eq!(post(json!({"beginn": "2026-10-24 09:00", "ende": "2026-10-24 08:00"})).await.0, 400, "Ende vor Beginn");
    assert_eq!(post(json!({"beginn": "2026-10-24 09:00", "ende": "2099-01-01 08:00"})).await.0, 400, "Ende in der Zukunft");
    assert_eq!(post(json!({"beginn": "2026-10-24 08:00", "ende": "2026-10-24 09:00", "wer": "xyz"})).await.0, 400, "unbekannte Person");
    assert_eq!(post(json!({"beginn": "2026-10-24 08:00", "ende": "2026-10-24 09:00", "wer": "cl"})).await.0, 200);
    assert_eq!(post(json!({"beginn": "2026-10-24 08:00+02:00", "ende": "2026-10-24 08:10+02:00", "wer": "cl"})).await.0, 409, "derselbe Beginn für dieselbe Person");
}

// R00090: die Kennung trifft genau ihren Eintrag, auch wenn davor einer eingefügt wurde
#[tokio::test]
async fn kennung_trifft_den_eintrag_trotz_einfuegen_davor() {
    let tmp = tempfile::tempdir().unwrap();
    mit_zeiten(tmp.path());
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let (_, r) = senden(Method::POST, a, "api/aufgaben/1/zeiten", "st", json!({"beginn": "2026-10-25 05:57+01:00", "ende": "2026-10-25 07:40+01:00", "wer": "cl"})).await;
    let kennungen: Vec<String> = r["zeiten"].as_array().unwrap().iter().map(|z| z["kennung"].as_str().unwrap().to_string()).collect();
    assert!(kennungen.contains(&"cl@2026-10-25T05:57+01:00".to_string()), "{kennungen:?}");
    // ein anderer schreibt einen Eintrag vor alle anderen in die Datei
    let datei = lies(tmp.path(), "aufgaben/0001-eins.md").replace("```kanbanD-time\n", "```kanbanD-time\n2026-10-10 08:00 · 2026-10-10 09:00 · st\n");
    std::fs::write(tmp.path().join("aufgaben/0001-eins.md"), datei).unwrap();
    let (s, r) = senden(Method::PATCH, a, "api/aufgaben/1/zeiten/cl@2026-10-25T05%3A57%2B01%3A00", "st", json!({"ende": "2026-10-25 07:50+01:00"})).await;
    assert_eq!(s, 200, "{r}");
    let datei = lies(tmp.path(), "aufgaben/0001-eins.md");
    assert!(datei.contains("2026-10-25 05:57+01:00 · 2026-10-25 07:50+01:00 · cl") && datei.contains("2026-10-10 08:00 · 2026-10-10 09:00 · st"), "{datei}");
    assert_eq!(senden(Method::DELETE, a, "api/aufgaben/1/zeiten/cl@2026-10-25T06%3A00%2B01%3A00", "st", json!(null)).await.0, 404);
    assert_eq!(senden(Method::DELETE, a, "api/aufgaben/1/zeiten/cl@2026-10-25T05%3A57%2B01%3A00", "st", json!(null)).await.0, 200);
    assert!(!lies(tmp.path(), "aufgaben/0001-eins.md").contains("05:57"));
}
