mod gemeinsam;

use std::process::Command;

#[tokio::test]
async fn start_in_neuem_ordner_liefert_zustand_und_oberflaeche() {
    let tmp = tempfile::tempdir().unwrap();
    let ordner = tmp.path().join("kanban");
    let lauf = gemeinsam::starten(&ordner, &["--port", "0"]);
    let zustand: serde_json::Value = reqwest::get(format!("{}api/zustand", lauf.adresse)).await.unwrap().json().await.unwrap();
    assert_eq!(zustand["ordner"], ordner.canonicalize().unwrap().to_string_lossy().as_ref());
    assert_eq!(zustand["eingerichtet"], false);
    assert!(ordner.join(".git").is_dir());
    let seite = reqwest::get(&lauf.adresse).await.unwrap().text().await.unwrap();
    assert!(seite.contains("<title>kanbanD</title>"));
}

#[tokio::test]
async fn belegter_port_fuehrt_zum_naechsten_freien_und_wird_genannt() {
    let tmp = tempfile::tempdir().unwrap();
    let belegt = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let p = belegt.local_addr().unwrap().port();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", &p.to_string()]);
    assert!(!lauf.adresse.contains(&format!(":{p}/")), "{}", lauf.adresse);
    assert_eq!(reqwest::get(format!("{}api/zustand", lauf.adresse)).await.unwrap().status(), 200);
}

#[test]
fn unbekanntes_argument_endet_mit_exit_2_und_aufrufzeile() {
    let a = Command::new(env!("CARGO_BIN_EXE_kanbanD")).arg("--gibtsnicht").output().unwrap();
    assert_eq!(a.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&a.stderr).starts_with("Aufruf: kanbanD"));
}

#[test]
fn hilfe_endet_mit_null() {
    let a = Command::new(env!("CARGO_BIN_EXE_kanbanD")).arg("--hilfe").output().unwrap();
    assert_eq!(a.status.code(), Some(0));
    assert!(String::from_utf8_lossy(&a.stderr).starts_with("Aufruf: kanbanD"));
}
