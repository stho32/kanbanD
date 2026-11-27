// R00258 (I0248, Karte #239): Proben im echten Programm (Release-naher Debug-Build) — AK 1, 7, 11, 14, 17, 18, 19, 20, 22.
// Der Treiber startet `target/debug/kanbanD` auf einem freien Port und liest Log-Datei und stderr.
mod gemeinsam;

use reqwest::Method;
use serde_json::{Value, json};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

const KANBAND: &str = "---\npeople:\n  cl: {name: Claude, kind: agent}\n  mi: {name: Mensch, kind: human}\nclasses: {}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n---\n";

/// Agent `cl`, Aufgaben #1–#15 (Ausgangslage von R00258, im echten Ordner).
fn lage(pfad: &Path) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), KANBAND).unwrap();
    std::fs::write(pfad.join("boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n\n## Fertig\n").unwrap();
    for nr in 1..=15u32 {
        std::fs::write(pfad.join(format!("aufgaben/{nr:04}-k{nr}.md")), format!("---\nid: {nr}\ntitle: k{nr}\n---\n")).unwrap();
    }
    gemeinsam::git(pfad, &["init", "-q"]);
    gemeinsam::git(pfad, &["add", "-A"]);
    gemeinsam::git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgangslage"]);
}

/// Eine laufende Instanz mit Log-Datei und stderr-Mitschnitt.
struct Instanz {
    tmp: tempfile::TempDir,
    kind: Child,
    adresse: String,
    log: PathBuf,
    stderr: PathBuf,
}

impl Drop for Instanz {
    fn drop(&mut self) {
        gemeinsam::geordnet_beenden(&mut self.kind);
    }
}

/// Wartet auf die erste HTTP-Antwort — danach ist die Startzeile geschrieben und geflusht.
fn erste_antwort_abwarten(adresse: &str) {
    use std::io::{Read, Write};
    let ziel = adresse.trim_start_matches("http://").trim_end_matches('/');
    let mut leitung = std::net::TcpStream::connect(ziel).expect("Instanz nimmt Verbindungen an");
    leitung.set_read_timeout(Some(std::time::Duration::from_secs(10))).unwrap();
    leitung.write_all(b"GET / HTTP/1.0\r\n\r\n").unwrap();
    leitung.read_exact(&mut [0u8; 1]).expect("erste HTTP-Antwort der Instanz");
}

/// Startet das echte Programm. `log_ordner` gibt `--log-ordner` vor (AK 17: ein gesperrter Ordner); ist es `None`,
/// gilt der XDG-Pfad aus der Umgebung (AK 14). `zusatz` sind weitere Argumente.
fn starten(log_ordner: Option<&Path>, zusatz: &[&str], umgebung: &[(&str, &str)]) -> Instanz {
    let tmp = tempfile::tempdir().unwrap();
    let ordner = tmp.path().join("mein-board");
    lage(&ordner);
    let stderr = tmp.path().join("stderr.txt");
    let log = log_ordner.map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from(umgebung.iter().find(|(n, _)| *n == "XDG_STATE_HOME").map(|(_, w)| *w).unwrap_or(".")).join("kanbanD/mein-board"));
    if log_ordner.is_some() {
        std::fs::create_dir_all(&log).unwrap();
    }
    let mut befehl = Command::new(env!("CARGO_BIN_EXE_kanbanD"));
    befehl.arg(&ordner).args(["--kein-browser", "--host", "127.0.0.1", "--port", "0"]);
    if let Some(l) = log_ordner {
        befehl.arg("--log-ordner").arg(l);
    }
    let mut kind = befehl
        .args(zusatz)
        .envs(umgebung.iter().copied())
        .stdout(Stdio::piped())
        .stderr(Stdio::from(std::fs::File::create(&stderr).unwrap()))
        .spawn()
        .expect("kanbanD startet");
    let mut zeile = String::new();
    BufReader::new(kind.stdout.take().unwrap()).read_line(&mut zeile).unwrap();
    let adresse = zeile.split_whitespace().last().expect("Adresse in der Startzeile").to_string();
    // Bereit, wenn die erste Antwort kommt: die Zeile `INFO gestartet` ist geflusht, bevor der Dienst lauscht
    erste_antwort_abwarten(&adresse);
    Instanz { tmp, kind, adresse, log, stderr }
}

impl Instanz {
    fn kanband_log(&self) -> PathBuf {
        self.log.join("kanbanD.log")
    }

    fn logtext(&self) -> String {
        std::fs::read_to_string(self.kanband_log()).unwrap_or_default()
    }

    fn stderr(&self) -> String {
        std::fs::read_to_string(&self.stderr).unwrap_or_default()
    }

    fn board(&self) -> PathBuf {
        self.tmp.path().join("mein-board")
    }

    async fn zaehle(&self, merkmal: &str) -> usize {
        self.logtext().lines().filter(|z| z.contains(merkmal)).count()
    }
}

async fn anfrage(methode: Method, instanz: &Instanz, pfad: &str, wer: &str, rumpf: Value) -> u16 {
    reqwest::Client::new().request(methode, format!("{}{pfad}", instanz.adresse)).header("X-KanbanD-Wer", wer).json(&rumpf).send().await.unwrap().status().as_u16()
}

// ---- AK 1 / P1: die Karten-Probe im echten Programm ---------------------------------------------------------

#[tokio::test]
async fn p1_die_karten_probe_im_echten_programm() {
    let tmp = tempfile::tempdir().unwrap();
    let i = starten(Some(&tmp.path().join("instanz-log")), &[], &[]);
    assert_eq!(reqwest::get(format!("{}api/zustand", i.adresse)).await.unwrap().status().as_u16(), 200);
    let vorher = i.zaehle(" WARN abgewiesen ").await;
    let status = anfrage(Method::PATCH, &i, "api/aufgaben/1", "cl", json!({"labels": ["braucht:999"], "beschreibung": "GEHEIM-239"})).await;
    assert_eq!(status, 400, "P1: {}", i.logtext());
    assert_eq!(i.zaehle(" WARN abgewiesen ").await, vorher + 1, "genau eine neue Zeile: {}", i.logtext());
    let text = i.logtext();
    for erwartet in ["status=400", "wer=cl", "methode=PATCH", "endpunkt=/api/aufgaben/{nr}", "aufgabe=#1", "ursache=eingabe", "Aufgabe #999 gibt es nicht (braucht:999)"] {
        assert!(text.contains(erwartet), "{erwartet} fehlt in {text}");
    }
    assert!(!text.contains("GEHEIM-239"), "{text}");
    assert!(!text.contains("\"labels\""), "{text}");
}

// ---- AK 7 / P1b: der Sammelweg im echten Programm ----------------------------------------------------------

#[tokio::test]
async fn p1b_der_sammelweg_nennt_anzahl_und_erstes_ziel() {
    let tmp = tempfile::tempdir().unwrap();
    let i = starten(Some(&tmp.path().join("instanz-log")), &[], &[]);
    let aenderungen: Vec<Value> = (4..=15).map(|nr| if nr == 9 { json!({"nummer": nr, "labels": ["braucht:999"]}) } else { json!({"nummer": nr, "titel": format!("t{nr}")}) }).collect();
    let status = anfrage(Method::PATCH, &i, "api/aufgaben/mehrere", "cl", json!({"aenderungen": aenderungen})).await;
    assert_eq!(status, 400, "{}", i.logtext());
    let text = i.logtext();
    assert!(text.contains("ziele=12") && text.contains("erstes=#4"), "{text}");
    assert!(!text.contains("aufgabe=#"), "{text}");
}

// ---- AK 11 (P-Variante): ein Header mit Backslash-n bricht die Zeile nicht ---------------------------------

#[tokio::test]
async fn p1_header_mit_backslash_n_bleibt_eine_zeile() {
    let tmp = tempfile::tempdir().unwrap();
    let i = starten(Some(&tmp.path().join("instanz-log")), &[], &[]);
    let vorher = i.logtext().lines().count();
    let status = reqwest::Client::new()
        .patch(format!("{}api/aufgaben/9999", i.adresse))
        .header("X-KanbanD-Wer", "a\\nb")
        .json(&json!({"titel": "x"}))
        .send()
        .await
        .unwrap()
        .status()
        .as_u16();
    assert_eq!(status, 400);
    assert_eq!(i.logtext().lines().count(), vorher + 1, "{}", i.logtext());
    assert_eq!(i.logtext().lines().filter(|z| z.contains(" WARN abgewiesen ")).count(), 1, "{}", i.logtext());
}

// ---- AK 14: Ziel außerhalb des Board-Ordners, XDG als Vorgabe ----------------------------------------------

#[tokio::test]
async fn p1d_ohne_log_ordner_schreibt_das_programm_nach_xdg() {
    let tmp = tempfile::tempdir().unwrap();
    let i = starten(None, &[], &[("XDG_STATE_HOME", tmp.path().to_str().unwrap())]);
    assert_eq!(reqwest::get(format!("{}api/zustand", i.adresse)).await.unwrap().status().as_u16(), 200);
    let erwartet = tmp.path().join("kanbanD/mein-board/kanbanD.log");
    assert!(erwartet.exists(), "XDG-Ziel fehlt: {erwartet:?}");
    assert!(std::fs::read_to_string(&erwartet).unwrap().contains(" INFO gestartet "), "{}", std::fs::read_to_string(&erwartet).unwrap());
    assert_eq!(gemeinsam::git(&i.board(), &["status", "--porcelain"]), "", "der Board-Ordner bleibt sauber");
    assert!(!i.board().join("kanbanD.log").exists(), "kein Log im Board-Ordner");
}

// ---- AK 17: ein nicht schreibbarer Log-Ordner stoppt den Dienst nicht --------------------------------------

#[tokio::test]
async fn p1d_nicht_schreibbarer_log_ordner_stoppt_den_dienst_nicht() {
    use std::os::unix::fs::PermissionsExt;
    let tmp = tempfile::tempdir().unwrap();
    let log = tmp.path().join("gesperrt");
    std::fs::create_dir_all(&log).unwrap();
    let mut rechte = std::fs::metadata(&log).unwrap().permissions();
    rechte.set_mode(0o555);
    std::fs::set_permissions(&log, rechte).unwrap();
    let i = starten(Some(&log), &[], &[]);
    let status = reqwest::get(format!("{}api/zustand", i.adresse)).await.unwrap().status().as_u16();
    assert_eq!(status, 200, "AK 17: /api/zustand antwortet");
    anfrage(Method::PATCH, &i, "api/aufgaben/9999", "cl", json!({"titel": "x"})).await;
    let stderr = i.stderr();
    assert!(stderr.contains("gesperrt") && stderr.contains("nicht schreibbar"), "{stderr}");
    assert_eq!(stderr.matches("nicht schreibbar").count(), 1, "genau eine Zeile zum Log-Ordner: {stderr}");
    assert!(stderr.contains(" WARN abgewiesen "), "die Abweisung steht weiter auf stderr: {stderr}");
    let mut rechte = std::fs::metadata(&log).unwrap().permissions();
    rechte.set_mode(0o755);
    std::fs::set_permissions(&log, rechte).unwrap();
}

// ---- AK 18 / 19: Stufen und Aufruffehler -------------------------------------------------------------------

#[tokio::test]
async fn p1e_stufe_warn_unterdrueckt_info_und_die_variable_verliert_gegen_das_flag() {
    let tmp = tempfile::tempdir().unwrap();
    let i = starten(Some(&tmp.path().join("instanz-log")), &["--log", "warn"], &[]);
    assert_eq!(anfrage(Method::PATCH, &i, "api/aufgaben/9999", "cl", json!({"titel": "x"})).await, 404);
    let text = i.logtext();
    assert!(!text.contains(" INFO gestartet "), "{text}");
    assert!(text.contains(" WARN abgewiesen "), "{text}");

    let tmp2 = tempfile::tempdir().unwrap();
    let i2 = starten(Some(&tmp2.path().join("instanz-log")), &["--log", "error"], &[("KANBAND_LOG", "debug")]);
    assert_eq!(anfrage(Method::PATCH, &i2, "api/aufgaben/9999", "cl", json!({"titel": "x"})).await, 404);
    let text = i2.logtext();
    assert!(!text.contains(" WARN abgewiesen "), "Flag vor Variable: {text}");
    assert!(!text.contains(" INFO gestartet "), "{text}");
}

#[test]
fn p1e_eine_unbekannte_stufe_endet_mit_zwei() {
    for args in [vec!["--log", "laut"], vec!["--log", "laut", "--log-ordner", "/tmp/gibtsnicht"]] {
        let a = Command::new(env!("CARGO_BIN_EXE_kanbanD")).args(&args).output().unwrap();
        assert_eq!(a.status.code(), Some(2), "{args:?}");
        assert!(String::from_utf8_lossy(&a.stderr).contains("Keine gültige Stufe"), "{args:?}");
    }
    let a = Command::new(env!("CARGO_BIN_EXE_kanbanD")).env("KANBAND_LOG", "laut").output().unwrap();
    assert_eq!(a.status.code(), Some(2));
}

// ---- AK 20 (Start) und AK 22 ------------------------------------------------------------------------------

#[tokio::test]
async fn p1_gestartet_und_keine_ausgabe_am_protokoll_vorbei() {
    let tmp = tempfile::tempdir().unwrap();
    let i = starten(Some(&tmp.path().join("instanz-log")), &[], &[]);
    assert_eq!(reqwest::get(format!("{}api/zustand", i.adresse)).await.unwrap().status().as_u16(), 200);
    let text = i.logtext();
    assert!(text.contains(" INFO gestartet "), "{text}");
    for feld in ["ordner=", "port=", "log="] {
        assert!(text.contains(feld), "{feld} fehlt in {text}");
    }
    // AK 22 / P1f: keine Ausgabe am Protokoll vorbei
    let g = Command::new("sh").args(["-c", "grep -rn 'eprintln!\\|println!' src | grep -v 'src/main.rs\\|src/protokoll.rs'"]).current_dir(env!("CARGO_MANIFEST_DIR")).output().unwrap();
    let treffer = String::from_utf8_lossy(&g.stdout);
    assert!(treffer.trim().is_empty(), "Ausgabe am Protokoll vorbei:\n{treffer}");
}
