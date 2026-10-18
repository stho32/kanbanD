//! R00053 Anwendungen registrieren: Register, qualifizierte Herkunft, Board-Bindung.
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};

async fn einstellungen(adresse: &str) -> Value {
    senden(Method::GET, adresse, "api/zustand", "st", json!(null)).await.1["einstellungen"].clone()
}

fn anwendung(kuerzel: &str, name: &str, wbs: &str, anforderungen: &str) -> Value {
    json!({"kuerzel": kuerzel, "name": name, "wbs": wbs, "anforderungen": anforderungen})
}

#[tokio::test]
async fn register_mit_zwei_anwendungen_stabil_sortiert_in_einem_commit() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let mut e = einstellungen(&lauf.adresse).await;
    e["quellen"]["anwendungen"] = json!([anwendung("kd", " kanbanD ", "/a/kd/plan.md", "/a/kd/anf"), anwendung("kc", "Kasse", "/a/kc/plan.md", "")]);
    let vorher: u32 = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();
    let (s, r) = senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", e.clone()).await;
    assert_eq!((s, r["geaendert"].as_bool()), (200, Some(true)));
    let datei = lies(tmp.path(), "kanbanD.md");
    assert!(datei.contains("sources:\n  wbs: plan/wbs.md\n  requirements: anf/\n  applications:\n    kc: {name: Kasse, wbs: /a/kc/plan.md, requirements: \"\"}\n    kd: {name: kanbanD, wbs: /a/kd/plan.md, requirements: /a/kd/anf}\n---"), "{datei}");
    assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap(), vorher + 1);
    let (_, r) = senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", einstellungen(&lauf.adresse).await).await;
    assert_eq!(r["geaendert"], false, "Rundlauf ändert nichts");
    assert_eq!(lies(tmp.path(), "kanbanD.md"), datei);
}

#[tokio::test]
async fn falsches_kuerzel_doppelt_oder_ohne_name_ist_400() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let e = einstellungen(&lauf.adresse).await;
    for liste in [
        json!([anwendung("KD!", "x", "/a", "")]),
        json!([anwendung("kd", "x", "/a", ""), anwendung("kd", "y", "/b", "")]),
        json!([anwendung("kd", " ", "/a", "")]),
    ] {
        let mut f = e.clone();
        f["quellen"]["anwendungen"] = liste.clone();
        let (s, r) = senden(Method::PUT, &lauf.adresse, "api/einstellungen", "st", f).await;
        assert_eq!(s, 400, "{liste} → {r}");
    }
    assert!(!lies(tmp.path(), "kanbanD.md").contains("applications"));
}

const MIT_KD: &str = "---\npeople:\n  st: {name: Stefan, kind: human}\nclasses: {}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {name: kanbanD, wbs: /gibt/es/nicht.md, requirements: \"\"}\n---\n";

#[tokio::test]
async fn qualifizierte_herkunft_schreiben_unbekanntes_kuerzel_ist_400() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::write(tmp.path().join("kanbanD.md"), MIT_KD).unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, _) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/2", "st", json!({"herkunft": ["kd:I0007"]})).await;
    assert_eq!(s, 200);
    assert!(lies(tmp.path(), "aufgaben/0002-zwei.md").contains("origins: [kd:I0007]\n"));
    let (s, f) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/2", "st", json!({"herkunft": ["xx:I0007"]})).await;
    assert_eq!(s, 400);
    assert!(f["fehler"].as_str().unwrap().contains("„xx“"));
    let (_, a) = senden(Method::GET, &lauf.adresse, "api/aufgaben/2", "st", json!(null)).await;
    assert_eq!(a["aufgabe"]["herkunft"], json!(["kd:I0007"]), "Rundlauf über die Datei");
}
