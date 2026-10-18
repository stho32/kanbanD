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

const WBS: &str = "# WBS\n\n| ID | Ebene | Eltern | Name | Status | Braucht |\n|---|---|---|---|---|---|\n| I0005 | Interaction | D0001 | Anlegen | gruen | |\n| I0007 | Interaction | D0001 | {name} | rot | I0005 |\n";

/// Ein Arbeits-Repository mit WBS und einer Anforderung, getrennt vom kanbanD-Ordner.
fn arbeits_repository(name: &str) -> tempfile::TempDir {
    let r = tempfile::tempdir().unwrap();
    std::fs::write(r.path().join("plan.md"), WBS.replace("{name}", name)).unwrap();
    std::fs::create_dir_all(r.path().join("anf")).unwrap();
    std::fs::write(r.path().join(format!("anf/R00014-{name}.md")), format!("# R00014: {name}\n")).unwrap();
    r
}

fn register(kd: &std::path::Path, kc: Option<&std::path::Path>) -> String {
    let eintrag = |k: &str, p: &std::path::Path| format!("    {k}: {{name: {k}, wbs: \"{}\", requirements: \"{}\"}}\n", p.join("plan.md").display(), p.join("anf").display());
    format!("---\npeople:\n  st: {{name: Stefan, kind: human}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n{}{}---\n", kc.map(|p| eintrag("kc", p)).unwrap_or_default(), eintrag("kd", kd))
}

fn aufgabe(ordner: &std::path::Path, nr: u32, herkunft: &str) {
    std::fs::write(ordner.join(format!("aufgaben/000{nr}-a.md")), format!("---\nid: {nr}\ntitle: a{nr}\norigins: [{herkunft}]\n---\n")).unwrap();
}

#[tokio::test]
async fn gleiche_id_in_zwei_anwendungen_loest_je_kuerzel_auf() {
    let (kd, kc) = (arbeits_repository("Bewegen"), arbeits_repository("Kassieren"));
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::write(tmp.path().join("kanbanD.md"), register(kd.path(), Some(kc.path()))).unwrap();
    aufgabe(tmp.path(), 1, "kd:I0007, kc:R00014");
    aufgabe(tmp.path(), 2, "kc:I0007");
    aufgabe(tmp.path(), 3, "I0007");
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (_, q) = senden(Method::GET, &lauf.adresse, "api/herkunft", "st", json!(null)).await;
    let wbs = |r: &tempfile::TempDir| r.path().canonicalize().unwrap().join("plan.md").to_string_lossy().to_string();
    assert_eq!((q["kd:I0007"]["datei"].as_str().unwrap(), q["kd:I0007"]["name"].as_str().unwrap(), q["kd:I0007"]["zeile"].as_u64()), (wbs(&kd).as_str(), "Bewegen", Some(6)));
    assert_eq!((q["kc:I0007"]["datei"].as_str().unwrap(), q["kc:I0007"]["name"].as_str().unwrap()), (wbs(&kc).as_str(), "Kassieren"));
    assert_eq!((&q["kd:I0007"]["anwendung"], &q["kd:I0007"]["schluessel"], &q["kd:I0007"]["braucht"]), (&json!("kd"), &json!("kd:I0007"), &json!(["kd:I0005"])));
    assert_eq!(q["kd:I0005"]["status"], "gruen", "über Braucht erreichte Knoten qualifiziert");
    assert_eq!(q["kc:R00014"]["name"], "Kassieren");
    assert!(q.get("I0007").is_none(), "unqualifiziert bei zwei Anwendungen ist mehrdeutig: {q}");
}

#[tokio::test]
async fn bei_einer_anwendung_loest_auch_unqualifiziert_auf() {
    let kd = arbeits_repository("Bewegen");
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    std::fs::write(tmp.path().join("kanbanD.md"), register(kd.path(), None)).unwrap();
    aufgabe(tmp.path(), 1, "I0007");
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (_, q) = senden(Method::GET, &lauf.adresse, "api/herkunft", "st", json!(null)).await;
    assert_eq!((&q["I0007"]["name"], &q["I0007"]["schluessel"], &q["I0007"]["anwendung"]), (&json!("Bewegen"), &json!("kd:I0007"), &json!("kd")));
}
