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
    // R00222 (ADR-0034 N2 Regel 4): nur `repository` wird geschrieben; mitgeschickte wbs/anforderungen werden überlesen —
    // die Standardanwendung behält ihr Repository aus dem Lese-Rückfall (GET liefert es ergänzt), die neuen bleiben ohne
    assert!(datei.contains("sources:\n  repository: plan\n  applications:\n    kc: {name: Kasse, repository: \"\"}\n    kd: {name: kanbanD, repository: \"\"}\n---"), "{datei}");
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
    assert_eq!(a["herkunft"], json!(["kd:I0007"]), "Rundlauf über die Datei");
}

const WBS: &str = "# WBS\n\n| ID | Ebene | Eltern | Name | Status | Braucht |\n|---|---|---|---|---|---|\n| I0005 | Interaction | D0001 | Anlegen | gruen | |\n| I0007 | Interaction | D0001 | {name} | rot | I0005 |\n";

#[tokio::test]
async fn register_mit_erreichbarkeit_ein_fehlender_pfad_macht_nichts_defekt() {
    let x = tempfile::tempdir().unwrap();
    std::fs::write(x.path().join("plan.md"), WBS).unwrap();
    std::fs::create_dir_all(x.path().join("req")).unwrap();
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::eingerichtet(tmp.path());
    let kanban = format!("---\npeople:\n  st: {{name: Stefan, kind: human}}\nclasses: {{}}\nsources:\n  wbs: plan/wbs.md\n  requirements: anf/\n  applications:\n    kd: {{name: kanbanD, wbs: \"{0}/plan.md\", requirements: \"{0}/req\"}}\n    rel: {{name: Relativ, wbs: kanbanD.md, requirements: \"\"}}\n---\n", x.path().display());
    std::fs::write(tmp.path().join("kanbanD.md"), kanban).unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, r) = senden(Method::GET, &lauf.adresse, "api/anwendungen", "st", json!(null)).await;
    assert_eq!(s, 200);
    assert_eq!(r["kd"]["name"], "kanbanD");
    // R00222: erreichbar nennt nur noch das Repository (Startordner aus dem Lese-Rückfall)
    assert_eq!(r["kd"]["erreichbar"], json!({"repository": true}));
    assert_eq!(r["rel"]["erreichbar"], json!({"repository": true}), "relativ zum kanbanD-Ordner");
    assert!(r["kd"].get("wbs").is_none() && r["kd"].get("anforderungen").is_none(), "{r}");
    assert_eq!(r["rel"]["repository"], ".", "R00209: Startordner einer WBS ohne Ordneranteil");
    std::fs::remove_file(x.path().join("plan.md")).unwrap();
    let (_, r) = senden(Method::GET, &lauf.adresse, "api/anwendungen", "st", json!(null)).await;
    assert_eq!(r["kd"]["erreichbar"], json!({"repository": true}), "R00209: der Ordner bleibt erreichbar, auch ohne die Datei");
    let (_, z) = senden(Method::GET, &lauf.adresse, "api/zustand", "st", json!(null)).await;
    assert_eq!(z["defekte"], json!([]), "kanbanD.md ist nicht defekt");
    assert_eq!(z["einstellungen"]["quellen"]["anwendungen"][0]["kuerzel"], "kd");
}

#[tokio::test]
async fn board_nennt_seine_anwendungen_und_bewegen_erhaelt_sie() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let board = lies(tmp.path(), "boards/entwicklung.md");
    std::fs::write(tmp.path().join("boards/entwicklung.md"), format!("---\napplications: [kd]\n---\n\n{board}")).unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (_, b) = senden(Method::GET, &lauf.adresse, "api/boards/entwicklung", "st", json!(null)).await;
    assert_eq!(b["anwendungen"], json!(["kd"]));
    let (s, _) = senden(Method::POST, &lauf.adresse, "api/boards/entwicklung/bewegen", "st", json!({"nummer": 1, "spalte": "In Arbeit"})).await;
    assert_eq!(s, 200);
    let nachher = lies(tmp.path(), "boards/entwicklung.md");
    assert!(nachher.starts_with("---\napplications: [kd]\n---\n"), "{nachher}");
    assert!(nachher.contains("## In Arbeit\n\n- [#1]"));
    let (_, ohne) = senden(Method::GET, &lauf.adresse, "api/boards", "st", json!(null)).await;
    assert_eq!(ohne[0]["anwendungen"], json!(["kd"]));
}
