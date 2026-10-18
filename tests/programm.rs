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
async fn unbekannter_pfad_der_oberflaeche_ist_404_und_bekannter_liefert_den_typ() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let r = reqwest::get(format!("{}web/gibtsnicht.js", lauf.adresse)).await.unwrap();
    assert_eq!(r.status(), 404);
    let r = reqwest::get(format!("{}web/index.html", lauf.adresse)).await.unwrap();
    assert_eq!(r.headers()["content-type"], "text/html; charset=utf-8");
}

#[test]
fn ordner_der_sich_nicht_anlegen_laesst_endet_mit_fehler() {
    let tmp = tempfile::tempdir().unwrap();
    let datei = tmp.path().join("datei");
    std::fs::write(&datei, "x").unwrap();
    let a = Command::new(env!("CARGO_BIN_EXE_kanbanD")).arg(datei.join("unter")).arg("--kein-browser").output().unwrap();
    assert_eq!(a.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&a.stderr).contains("lässt sich nicht vorbereiten"));
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

#[test]
fn ohne_kein_browser_wird_der_browser_mit_der_adresse_geoeffnet() {
    let tmp = tempfile::tempdir().unwrap();
    let protokoll = tmp.path().join("geoeffnet.txt");
    let skript = tmp.path().join("browser.sh");
    std::fs::write(&skript, format!("#!/bin/sh\necho \"$1\" > {}\n", protokoll.display())).unwrap();
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(&skript, std::fs::Permissions::from_mode(0o755)).unwrap();
    let mut kind = Command::new(env!("CARGO_BIN_EXE_kanbanD"))
        .arg(tmp.path().join("k"))
        .args(["--host", "127.0.0.1", "--port", "0"])
        .env("KANBAND_BROWSER", &skript)
        .stdout(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    let mut zeile = String::new();
    std::io::BufRead::read_line(&mut std::io::BufReader::new(kind.stdout.take().unwrap()), &mut zeile).unwrap();
    let adresse = zeile.split_whitespace().last().unwrap().to_string();
    let mut gelesen = String::new();
    for _ in 0..50 {
        gelesen = std::fs::read_to_string(&protokoll).unwrap_or_default();
        if !gelesen.is_empty() { break; }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    gemeinsam::geordnet_beenden(&mut kind);
    assert_eq!(gelesen.trim(), adresse);
}
