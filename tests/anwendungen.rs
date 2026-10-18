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
