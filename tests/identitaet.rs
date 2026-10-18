mod gemeinsam;

use serde_json::Value;

async fn wer(adresse: &str, kuerzel: Option<&str>) -> (u16, Value) {
    let mut r = reqwest::Client::new().get(format!("{adresse}api/wer"));
    if let Some(k) = kuerzel {
        r = r.header("X-KanbanD-Wer", k);
    }
    let a = r.send().await.unwrap();
    (a.status().as_u16(), a.json().await.unwrap())
}

#[tokio::test]
async fn agent_nennt_sich_und_bekommt_seine_person() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let (s, p) = wer(&lauf.adresse, Some("cl")).await;
    assert_eq!(s, 200);
    assert_eq!(p["kuerzel"], "cl");
    assert_eq!(p["art"], "agent");
    assert_eq!(p["name"], "Claude");
}

#[tokio::test]
async fn fehlende_unbekannte_und_stillgelegte_identitaet_wird_abgewiesen() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    for (k, erwartet) in [(None, "X-KanbanD-Wer fehlt"), (Some(" "), "X-KanbanD-Wer fehlt"), (Some("zz"), "„zz“"), (Some("ab"), "stillgelegt")] {
        let (s, f) = wer(&lauf.adresse, k).await;
        assert_eq!(s, 400, "{k:?}");
        assert!(f["fehler"].as_str().unwrap().contains(erwartet), "{f}");
    }
}

#[tokio::test]
async fn nicht_eingerichteter_ordner_ist_ein_konflikt() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    assert_eq!(wer(&lauf.adresse, Some("st")).await.0, 409);
}
