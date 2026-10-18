//! R00054 WBS-Sicht: die WBS einer registrierten Anwendung aus ihrem Arbeits-Repository lesen.
mod gemeinsam;

use gemeinsam::{git, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

const WBS: &str = "---\napplication: Kasse\n---\n\n# WBS\n\n| ID | Ebene | Eltern | Name | Status | Fertig-Kriterium | Eingabe → Ausgabe | Aufwand | Ausbaustufe | Braucht | Requirement | Notiz | Phase |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n| A0001 | Application | — | Kasse | gelb | alle Dialogs gruen |  |  |  |  |  |  |  |\n| D0001 | Dialog | A0001 | Kassieren | gelb | alle Interactions gruen |  |  |  |  | R00001 |  |  |\n| I0001 | Interaction | D0001 | Bon drucken | gruen | US-1 |  |  |  |  | R00001, R00002 |  | Abnahme |\n| F0001 | Feature | I0001 | Kopf | gruen | AK-1 |  |  |  |  |  |  |  |\n| F0002 | Feature | I0001 | Summe | rot | AK-2 |  |  |  |  |  |  |  |\n| B0001 | Bubble | F0002 | Summe rechnen | rot | Test gruen | Posten → Summe | 0,5-1 |  |  |  |  |  |\n| F0003 | Feature | I0001 | Logo | option | AK-3 |  |  |  |  |  |  |  |\n";

/// Ein Arbeits-Repository getrennt vom kanbanD-Ordner: WBS committet, Anforderung R00001 im Anforderungsordner.
fn arbeits_repository() -> (tempfile::TempDir, PathBuf) {
    let t = tempfile::tempdir().unwrap();
    let wurzel = t.path().canonicalize().unwrap();
    std::fs::create_dir_all(wurzel.join("Dokumentation/Planung")).unwrap();
    std::fs::create_dir_all(wurzel.join("Anforderungen")).unwrap();
    std::fs::write(wurzel.join("Dokumentation/Planung/kasse.md"), WBS).unwrap();
    std::fs::write(wurzel.join("Anforderungen/R00001-bon.md"), "# R00001: Bon\n").unwrap();
    git(&wurzel, &["init", "-q"]);
    git(&wurzel, &["add", "-A"]);
    git(&wurzel, &["-c", "user.name=KI", "-c", "user.email=k@k", "commit", "-q", "-m", "WBS"]);
    (t, wurzel)
}

fn mit_register(ordner: &Path, arbeit: &Path) {
    gemeinsam::eingerichtet(ordner);
    let kanban = format!("---\npeople:\n  st: {{name: Stefan, kind: human}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kc: {{name: Kasse, wbs: {}/Dokumentation/Planung/kasse.md, requirements: {}/Anforderungen}}\n    weg: {{name: Weg, wbs: /gibt/es/nicht.md, requirements: \"\"}}\n---\n", arbeit.display(), arbeit.display());
    std::fs::write(ordner.join("kanbanD.md"), kanban).unwrap();
    git(ordner, &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-am", "Register"]);
}

async fn wbs(adresse: &str, kuerzel: &str) -> (u16, Value) {
    senden(Method::GET, adresse, &format!("api/wbs/{kuerzel}"), "st", json!(null)).await
}

#[tokio::test]
async fn wbs_mit_gerechnetem_status_stand_und_anforderungen() {
    let (_a, arbeit) = arbeits_repository();
    let tmp = tempfile::tempdir().unwrap();
    mit_register(tmp.path(), &arbeit);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, w) = wbs(&lauf.adresse, "kc").await;
    assert_eq!(s, 200, "{w}");
    let ids: Vec<&str> = w["knoten"].as_array().unwrap().iter().map(|k| k["id"].as_str().unwrap()).collect();
    assert_eq!(ids, ["A0001", "D0001", "I0001", "F0001", "F0002", "B0001", "F0003"], "Dateireihenfolge");
    let i = &w["knoten"][2];
    assert_eq!((i["status"].as_str(), i["gerechnet"].as_str(), i["erreicht"].as_str()), (Some("gruen"), Some("gelb"), Some("Feature")), "Widerspruch zur Datei bleibt sichtbar");
    assert_eq!((i["eltern"].as_str(), i["fertig_kriterium"].as_str(), i["zeile"].as_u64()), (Some("D0001"), Some("US-1"), Some(11)));
    assert_eq!(w["knoten"][5]["eingabe_ausgabe"], "Posten → Summe");
    assert!(i.get("weitere").is_none() && i.get("Phase").is_none(), "die Spalte Phase stört nicht");
    assert_eq!(w["stand"], json!({"gruen": 1, "gelb": 0, "rot": 1, "slices": 2, "aktiv": "B0001", "pfad": ["A0001", "D0001", "I0001", "F0002", "B0001"], "laufend": []}));
    assert_eq!(w["nicht_committet"], false);
    assert_eq!(w["anforderungen"], json!({"R00001": format!("{}/Anforderungen/R00001-bon.md", arbeit.display())}));
    assert_eq!((w["name"].as_str(), w["datei"].as_str().map(String::from)), (Some("Kasse"), Some(format!("{}/Dokumentation/Planung/kasse.md", arbeit.display()))));
}

#[tokio::test]
async fn unbekanntes_kuerzel_404_nicht_erreichbar_409() {
    let (_a, arbeit) = arbeits_repository();
    let tmp = tempfile::tempdir().unwrap();
    mit_register(tmp.path(), &arbeit);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, r) = wbs(&lauf.adresse, "xx").await;
    assert_eq!((s, r["fehler"].as_str()), (404, Some("Anwendung „xx“ steht nicht im Register")));
    let (s, r) = wbs(&lauf.adresse, "weg").await;
    assert_eq!(s, 409, "{r}");
    assert!(r["fehler"].as_str().unwrap().contains("/gibt/es/nicht.md"));
}

#[tokio::test]
async fn nicht_committet_bis_zum_commit_im_arbeits_repository() {
    let (_a, arbeit) = arbeits_repository();
    let tmp = tempfile::tempdir().unwrap();
    mit_register(tmp.path(), &arbeit);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let plan = arbeit.join("Dokumentation/Planung/kasse.md");
    std::fs::write(&plan, WBS.replace("| Summe rechnen | rot |", "| Summe rechnen | gruen |")).unwrap();
    let (_, w) = wbs(&lauf.adresse, "kc").await;
    assert_eq!((w["nicht_committet"].as_bool(), w["knoten"][4]["gerechnet"].as_str(), w["stand"]["gruen"].as_u64()), (Some(true), Some("gruen"), Some(2)));
    let log_vorher = git(&arbeit, &["rev-list", "--count", "HEAD"]);
    git(&arbeit, &["-c", "user.name=KI", "-c", "user.email=k@k", "commit", "-q", "-am", "B0001 gruen"]);
    let (_, w) = wbs(&lauf.adresse, "kc").await;
    assert_eq!(w["nicht_committet"], false);
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "", "im kanbanD-Ordner ändert sich nichts");
    assert_ne!(git(&arbeit, &["rev-list", "--count", "HEAD"]), log_vorher);
}

#[tokio::test]
async fn wbs_im_arbeits_repository_aendert_sich_ereignis_mit_kuerzel_auch_nach_neuem_register() {
    let (_a, arbeit) = arbeits_repository();
    let tmp = tempfile::tempdir().unwrap();
    mit_register(tmp.path(), &arbeit);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let plan = arbeit.join("Dokumentation/Planung/kasse.md");
    let e = gemeinsam::ereignis_abwarten(&lauf.adresse, || std::fs::write(&plan, WBS.replace("| Summe rechnen | rot |", "| Summe rechnen | gruen |")).unwrap(), |v| v["wbs"] == json!(["kc"])).await;
    assert_eq!((e["pfade"].clone(), e["extern"].clone()), (json!([plan.to_string_lossy()]), json!(true)));
    let commit = || git(&arbeit, &["-c", "user.name=KI", "-c", "user.email=k@k", "commit", "-q", "-am", "B0001 gruen"]);
    gemeinsam::ereignis_abwarten(&lauf.adresse, || drop(commit()), |v| v["wbs"] == json!(["kc"])).await;
    let (_b, zweite) = arbeits_repository();
    let kanban = gemeinsam::lies(tmp.path(), "kanbanD.md").replace("    weg: {name: Weg, wbs: /gibt/es/nicht.md", &format!("    weg: {{name: Weg, wbs: {}/Dokumentation/Planung/kasse.md", zweite.display()));
    std::fs::write(tmp.path().join("kanbanD.md"), kanban).unwrap();
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    let neu = zweite.join("Dokumentation/Planung/kasse.md");
    gemeinsam::ereignis_abwarten(&lauf.adresse, || std::fs::write(&neu, "x").unwrap(), |v| v["wbs"] == json!(["weg"])).await;
}

#[test]
fn beobachtet_wird_nur_was_ausserhalb_des_ordners_liegt() {
    let (_a, arbeit) = arbeits_repository();
    let tmp = tempfile::tempdir().unwrap();
    mit_register(tmp.path(), &arbeit);
    let text = gemeinsam::lies(tmp.path(), "kanbanD.md").replace("  applications:\n", "  applications:\n    in: {name: Innen, wbs: plan/wbs.md, requirements: \"\"}\n");
    std::fs::create_dir_all(tmp.path().join("plan")).unwrap();
    std::fs::write(tmp.path().join("kanbanD.md"), text).unwrap();
    let f = kanband::dienst::Kanban::neu(tmp.path().to_path_buf()).fremde_wbs();
    assert_eq!(f.len(), 1, "innen liegt im Ordner, weg hat keinen Ordner: {f:?}");
    assert_eq!((f[0].kuerzel.as_str(), f[0].datei.clone(), f[0].git.clone()), ("kc", arbeit.join("Dokumentation/Planung/kasse.md"), Some(arbeit.join(".git"))));
}
