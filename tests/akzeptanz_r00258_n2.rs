// R00258 (I0248, Karte #239) Nacharbeit 1 — Muss 2: Ein geschlossener stderr-Kanal bringt den Dienst nicht um.
//
// Treiber: das echte Programm, stderr auf ein Rohr (bzw. `/dev/full`); der Leser endet nach der ersten Zeile. Zwei
// abgewiesene Anfragen müssen 400 mit normalem Rumpf liefern, `/api/zustand` 200, der Prozess lebt, und die Logdatei
// beide `WARN abgewiesen` tragen (ADR-0001 N1.2 Regel 3: ein Fehler der Ausgabe stoppt nichts).
mod gemeinsam;

use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

const KANBAND: &str = "---\npeople:\n  cl: {name: Claude, kind: agent}\n  mi: {name: Mensch, kind: human}\nclasses: {}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n---\n";

fn lage(pfad: &Path) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), KANBAND).unwrap();
    std::fs::write(pfad.join("boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n\n## Fertig\n").unwrap();
    std::fs::write(pfad.join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\n---\n").unwrap();
    gemeinsam::git(pfad, &["init", "-q"]);
    gemeinsam::git(pfad, &["add", "-A"]);
    gemeinsam::git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgangslage"]);
}

/// Wartet auf die erste HTTP-Antwort — danach lauscht der Dienst.
fn erste_antwort_abwarten(adresse: &str) {
    use std::io::Write;
    let ziel = adresse.trim_start_matches("http://").trim_end_matches('/');
    let mut leitung = std::net::TcpStream::connect(ziel).expect("Instanz nimmt Verbindungen an");
    leitung.set_read_timeout(Some(std::time::Duration::from_secs(10))).unwrap();
    leitung.write_all(b"GET / HTTP/1.0\r\n\r\n").unwrap();
    leitung.read_exact(&mut [0u8; 1]).expect("erste HTTP-Antwort der Instanz");
}

/// Die Adresse aus der Startzeile auf stdout.
fn adresse_lesen(kind: &mut Child) -> String {
    let mut zeile = String::new();
    BufReader::new(kind.stdout.take().unwrap()).read_line(&mut zeile).unwrap();
    zeile.split_whitespace().last().expect("Adresse in der Startzeile").to_string()
}

struct Instanz {
    _tmp: tempfile::TempDir,
    kind: Child,
    adresse: String,
    log: PathBuf,
}

impl Drop for Instanz {
    fn drop(&mut self) {
        gemeinsam::geordnet_beenden(&mut self.kind);
    }
}

impl Instanz {
    fn logtext(&self) -> String {
        std::fs::read_to_string(self.log.join("kanbanD.log")).unwrap_or_default()
    }

    /// Zwei abgewiesene Anfragen (400), dann Zustand (200).
    async fn zwei_abweisungen_und_zustand(&self) {
        for _ in 0..2 {
            let status = reqwest::Client::new()
                .patch(format!("{}api/aufgaben/1", self.adresse))
                .header("X-KanbanD-Wer", "cl")
                .json(&serde_json::json!({"labels": ["braucht:999"]}))
                .send()
                .await
                .expect("Antwort trotz geschlossenem stderr")
                .status()
                .as_u16();
            assert_eq!(status, 400, "Abweisung mit normalem Rumpf: {}", self.logtext());
        }
        let zustand = reqwest::get(format!("{}api/zustand", self.adresse)).await.expect("Zustand trotz geschlossenem stderr").status().as_u16();
        assert_eq!(zustand, 200);
    }
}

/// Startet das Programm mit stderr auf ein Rohr, dessen Leser nach der ersten Zeile endet (dann EPIPE).
fn starten_rohr() -> Instanz {
    let tmp = tempfile::tempdir().unwrap();
    let ordner = tmp.path().join("mein-board");
    lage(&ordner);
    let log = tmp.path().join("instanz-log");
    std::fs::create_dir_all(&log).unwrap();
    let mut kind = Command::new(env!("CARGO_BIN_EXE_kanbanD"))
        .arg(&ordner)
        .args(["--kein-browser", "--host", "127.0.0.1", "--port", "0", "--log-ordner"])
        .arg(&log)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("kanbanD startet");
    let adresse = adresse_lesen(&mut kind);
    erste_antwort_abwarten(&adresse);
    let mut rohr = kind.stderr.take().unwrap();
    let mut erste = String::new();
    BufReader::new(&mut rohr).read_line(&mut erste).unwrap();
    drop(rohr);
    Instanz { _tmp: tmp, kind, adresse, log }
}

/// Startet das Programm mit stderr auf einen Kanal, dessen Schreiben immer scheitert (`/dev/full`).
fn starten_voll() -> Instanz {
    let tmp = tempfile::tempdir().unwrap();
    let ordner = tmp.path().join("mein-board");
    lage(&ordner);
    let log = tmp.path().join("instanz-log");
    std::fs::create_dir_all(&log).unwrap();
    let voll = std::fs::OpenOptions::new().write(true).open("/dev/full").expect("/dev/full");
    let mut kind = Command::new(env!("CARGO_BIN_EXE_kanbanD"))
        .arg(&ordner)
        .args(["--kein-browser", "--host", "127.0.0.1", "--port", "0", "--log-ordner"])
        .arg(&log)
        .stdout(Stdio::piped())
        .stderr(Stdio::from(voll))
        .spawn()
        .expect("kanbanD startet");
    let adresse = adresse_lesen(&mut kind);
    erste_antwort_abwarten(&adresse);
    Instanz { _tmp: tmp, kind, adresse, log }
}

// ---- Muss 2: stderr-Leser endet nach der ersten Zeile ------------------------------------------------

#[tokio::test]
async fn n2_ein_geschlossenes_stderr_rohr_bringt_den_dienst_nicht_um() {
    let mut i = starten_rohr();
    i.zwei_abweisungen_und_zustand().await;
    assert!(i.kind.try_wait().unwrap().is_none(), "der Prozess lebt");
    let text = i.logtext();
    assert_eq!(text.matches(" WARN abgewiesen ").count(), 2, "beide Abweisungen stehen in der Datei: {text}");
}

// ---- Muss 2 (Variante): stderr auf /dev/full ---------------------------------------------------------

#[tokio::test]
async fn n2_ein_voller_stderr_kanal_bringt_den_dienst_nicht_um() {
    let mut i = starten_voll();
    i.zwei_abweisungen_und_zustand().await;
    assert!(i.kind.try_wait().unwrap().is_none(), "der Prozess lebt");
    assert_eq!(i.logtext().matches(" WARN abgewiesen ").count(), 2, "{}", i.logtext());
}
