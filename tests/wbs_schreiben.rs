//! R00055/R00056: kanbanD schreibt die WBS im Arbeits-Repository einer Anwendung — und committet dort nie.
mod gemeinsam;

use gemeinsam::git;
use kanband::dienst::Kanban;
use std::path::{Path, PathBuf};

const KOPF: &str = "---\napplication: Kasse\nzuletzt: 2026-01-01\n---\n\n# WBS\n\n| ID | Ebene | Eltern | Name | Status | Fertig-Kriterium | Eingabe → Ausgabe | Aufwand | Ausbaustufe | Braucht | Requirement | Notiz | Phase |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n";

/// `(id, ebene, eltern, status)` als Zeilen der Knotentabelle, mit einem maskierten Strich und einer fremden Spalte.
fn wbs(zeilen: &[(&str, &str, &str, &str)]) -> String {
    KOPF.to_string() + &zeilen.iter().map(|(id, ebene, eltern, status)| format!("| {id} | {ebene} | {eltern} | Name {id} | {status} | Test gruen | a \\| b → c | 0,5-1 |  |  |  |  | Abnahme |\n")).collect::<String>()
}

/// Ein Arbeits-Repository getrennt vom kanbanD-Ordner, WBS committet.
fn arbeits_repository(text: &str) -> (tempfile::TempDir, PathBuf) {
    let t = tempfile::tempdir().unwrap();
    let wurzel = t.path().canonicalize().unwrap();
    std::fs::create_dir_all(wurzel.join("Dokumentation/Planung")).unwrap();
    std::fs::write(wurzel.join("Dokumentation/Planung/kasse.md"), text).unwrap();
    git(&wurzel, &["init", "-q"]);
    git(&wurzel, &["add", "-A"]);
    git(&wurzel, &["-c", "user.name=KI", "-c", "user.email=k@k", "commit", "-q", "-m", "WBS"]);
    (t, wurzel)
}

fn mit_register(ordner: &Path, arbeit: &Path) {
    gemeinsam::eingerichtet(ordner);
    let kanban = format!("---\npeople:\n  st: {{name: Stefan, kind: human}}\n  cl: {{name: Claude, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kc: {{name: Kasse, wbs: {}/Dokumentation/Planung/kasse.md, requirements: \"\"}}\n---\n", arbeit.display());
    std::fs::write(ordner.join("kanbanD.md"), kanban).unwrap();
    git(ordner, &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-am", "Register"]);
}

fn plan(arbeit: &Path) -> String {
    gemeinsam::lies(arbeit, "Dokumentation/Planung/kasse.md")
}

/// I0002 mit acht Bubbles, alle rot.
fn acht_bubbles() -> String {
    let mut z = vec![("A0001", "Application", "—", "rot"), ("D0001", "Dialog", "A0001", "rot"), ("I0002", "Interaction", "D0001", "rot")];
    const IDS: [&str; 8] = ["B0001", "B0002", "B0003", "B0004", "B0005", "B0006", "B0007", "B0008"];
    z.extend(IDS.iter().map(|id| (*id, "Bubble", "I0002", "rot")));
    wbs(&z)
}

#[test]
fn gleichzeitige_schreibzugriffe_auf_dieselbe_wbs_gehen_nacheinander_und_nichts_wird_committet() {
    let (_a, arbeit) = arbeits_repository(&acht_bubbles());
    let tmp = tempfile::tempdir().unwrap();
    mit_register(tmp.path(), &arbeit);
    let kanban = std::sync::Arc::new(Kanban::neu(tmp.path().to_path_buf()));
    let commits_arbeit = git(&arbeit, &["rev-list", "--count", "HEAD"]);
    let commits_board = git(tmp.path(), &["rev-list", "--count", "HEAD"]);
    let faeden: Vec<_> = (1..=8)
        .map(|n| {
            let k = kanban.clone();
            std::thread::spawn(move || k.wbs_status_setzen("kc", &format!("B000{n}"), "gruen").unwrap())
        })
        .collect();
    for f in faeden {
        f.join().unwrap();
    }
    let text = plan(&arbeit);
    let heute = kanband::uhr::heute();
    let erwartet = acht_bubbles().replace("| rot |", "| gruen |").replace("zuletzt: 2026-01-01", &format!("zuletzt: {heute}"));
    assert_eq!(text, erwartet, "keine Änderung verloren, I0002, D0001 und A0001 gerechnet gruen, alles andere byte-gleich");
    assert_eq!((git(&arbeit, &["rev-list", "--count", "HEAD"]), git(tmp.path(), &["rev-list", "--count", "HEAD"])), (commits_arbeit, commits_board), "kein Commit, weder im Arbeits- noch im Board-Repository");
    assert_eq!(git(&arbeit, &["status", "--porcelain"]), "M Dokumentation/Planung/kasse.md");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "");
}

/// Wie in AK „Schreiben“: I0002 mit B0001 gruen und B0002 rot, Geschwister I0001 gruen.
fn ak_schreiben() -> String {
    wbs(&[("A0001", "Application", "—", "gelb"), ("D0001", "Dialog", "A0001", "gelb"), ("I0001", "Interaction", "D0001", "gruen"), ("I0002", "Interaction", "D0001", "gelb"), ("B0001", "Bubble", "I0002", "gruen"), ("B0002", "Bubble", "I0002", "rot")])
}

async fn status(adresse: &str, wer: &str, id: &str, status: &str) -> (u16, serde_json::Value) {
    gemeinsam::senden(reqwest::Method::PATCH, adresse, &format!("api/wbs/kc/knoten/{id}"), wer, serde_json::json!({ "status": status })).await
}

#[tokio::test]
async fn patch_setzt_bubble_gruen_vorfahren_gerechnet_nur_statuszellen_und_zuletzt_kein_commit() {
    let (_a, arbeit) = arbeits_repository(&ak_schreiben());
    let tmp = tempfile::tempdir().unwrap();
    mit_register(tmp.path(), &arbeit);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let log_vorher = git(&arbeit, &["log", "--format=%H"]);
    let (s, r) = status(&lauf.adresse, "cl", "B0002", "gruen").await;
    assert_eq!((s, r.clone()), (200, serde_json::json!({ "geaendert": ["B0002", "I0002", "D0001", "A0001"] })), "auch ein Agent setzt Status");
    let heute = kanband::uhr::heute();
    assert_eq!(plan(&arbeit), ak_schreiben().replace("| rot |", "| gruen |").replace("| gelb |", "| gruen |").replace("zuletzt: 2026-01-01", &format!("zuletzt: {heute}")));
    let diff = git(&arbeit, &["diff", "-U0", "--no-color"]);
    let geaendert: Vec<&str> = diff.lines().filter(|z| z.starts_with('+') && !z.starts_with("+++")).collect();
    assert_eq!(geaendert.len(), 5, "vier Zeilen mit neuer Status-Zelle und zuletzt: {diff}");
    assert!(geaendert.iter().all(|z| z.starts_with("+zuletzt:") || z.contains("| gruen | Test gruen | a \\| b → c | 0,5-1 |  |  |  |  | Abnahme |")), "{diff}");
    assert_eq!(git(&arbeit, &["log", "--format=%H"]), log_vorher, "git log im Arbeits-Repository unverändert");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "", "im Board-Repository ändert sich nichts");
    let (_, w) = gemeinsam::senden(reqwest::Method::GET, &lauf.adresse, "api/wbs/kc", "st", serde_json::Value::Null).await;
    assert_eq!((w["nicht_committet"].as_bool(), w["stand"]["gruen"].as_u64()), (Some(true), Some(2)));
}

#[tokio::test]
async fn patch_lehnt_gerechnete_planungsstatus_ohne_identitaet_und_defekte_datei_ab() {
    let (_a, arbeit) = arbeits_repository(&ak_schreiben());
    let tmp = tempfile::tempdir().unwrap();
    mit_register(tmp.path(), &arbeit);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (s, r) = status(&lauf.adresse, "st", "I0002", "rot").await;
    assert_eq!(s, 409, "{r}");
    assert!(r["fehler"].as_str().unwrap().starts_with("Status wird gerechnet"));
    assert_eq!(status(&lauf.adresse, "st", "B0002", "option").await.0, 400);
    assert_eq!(status(&lauf.adresse, "st", "B0099", "gruen").await.0, 404);
    let ohne = reqwest::Client::new().patch(format!("{}api/wbs/kc/knoten/B0002", lauf.adresse)).json(&serde_json::json!({"status": "gruen"})).send().await.unwrap();
    assert_eq!(ohne.status().as_u16(), 400, "Identität Pflicht");
    let (s, _) = gemeinsam::senden(reqwest::Method::PATCH, &lauf.adresse, "api/wbs/xx/knoten/B0002", "st", serde_json::json!({"status": "gruen"})).await;
    assert_eq!(s, 404, "unbekannte Anwendung");
    assert_eq!(plan(&arbeit), ak_schreiben(), "nichts geschrieben");
    let konflikt = ak_schreiben().replace("| B0002 |", "<<<<<<< HEAD\n| B0002 |") + "=======\n>>>>>>> x\n";
    std::fs::write(arbeit.join("Dokumentation/Planung/kasse.md"), &konflikt).unwrap();
    let (s, r) = status(&lauf.adresse, "st", "B0001", "rot").await;
    assert_eq!(s, 409, "{r}");
    assert_eq!(plan(&arbeit), konflikt, "defekte Datei bleibt, wie sie ist");
}

#[tokio::test]
async fn eigener_schreibzugriff_meldet_ereignis_mit_kuerzel_nicht_extern() {
    let (_a, arbeit) = arbeits_repository(&ak_schreiben());
    let tmp = tempfile::tempdir().unwrap();
    mit_register(tmp.path(), &arbeit);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let adresse = lauf.adresse.clone();
    let e = gemeinsam::ereignis_abwarten(
        &lauf.adresse,
        move || {
            std::thread::spawn(move || tokio::runtime::Runtime::new().unwrap().block_on(status(&adresse, "st", "B0002", "gelb")));
        },
        |v| v["wbs"] == serde_json::json!(["kc"]),
    )
    .await;
    assert_eq!(e["extern"], false, "{e}");
}
