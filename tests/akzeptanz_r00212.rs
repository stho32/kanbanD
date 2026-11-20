// R00212 (I0202, Karte #226): Herkunft als Text ohne Auflösung — Akzeptanztests gegen das echte Programm.
// Schichten: Testfall (je AK) → Testsprache (`Lage`, `herkunft_setzen`) → Treiber (`gemeinsam::senden`, `lesen`) → Programm.
// AK 1 und der API-Teil von AK 5 stehen hier; Chip, Fenster und Filter (AK 2 bis 4, 6) in
// `e2e/tests/r00212-herkunft-als-text.spec.js`. AK 7 (Altbestand) ist die Legacy-Probe `ak07_…` (`#[ignore]`, von Hand in B1064).
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

// ---- Treiber ----------------------------------------------------------------------------------------------------------

async fn lesen(adresse: &str, pfad: &str) -> (u16, String) {
    let r = reqwest::get(format!("{adresse}{pfad}")).await.unwrap();
    (r.status().as_u16(), r.text().await.unwrap())
}

async fn herkunft_setzen(adresse: &str, nr: u32, liste: Value) -> (u16, Value) {
    senden(Method::PATCH, adresse, &format!("api/aufgaben/{nr}"), "st", json!({"herkunft": liste})).await
}

fn commits(ordner: &Path) -> u32 {
    git(ordner, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

// ---- Testsprache: Ausgangslage ----------------------------------------------------------------------------------------

/// Ordner `K` mit Register `kd` (Repository `R` mit WBS `I0007`/`I0008`, `I0008` braucht `I0007`, und Anforderung `R00014`);
/// Aufgabe #1 mit `kd:I0007, kd:R00014` und Label `braucht:2`, #2 mit `kd:I0008`, #3 ohne Herkunft.
struct Lage {
    _r: tempfile::TempDir,
    k: tempfile::TempDir,
}

impl Lage {
    fn neu() -> Lage {
        let r = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(r.path().join("Dokumentation/Planung")).unwrap();
        std::fs::create_dir_all(r.path().join("Anforderungen")).unwrap();
        let wbs = "# WBS\n\n| ID | Ebene | Eltern | Name | Status | Braucht |\n|---|---|---|---|---|---|\n| I0007 | Interaction | D0001 | Bewegen | rot | |\n| I0008 | Interaction | D0001 | Warten | rot | I0007 |\n";
        std::fs::write(r.path().join("Dokumentation/Planung/kd.md"), wbs).unwrap();
        std::fs::write(r.path().join("Anforderungen/R00014-probe.md"), "# R00014: Probe\n").unwrap();
        let k = tempfile::tempdir().unwrap();
        gemeinsam::mit_drei_aufgaben(k.path());
        let wurzel = r.path().canonicalize().unwrap();
        let kanban = format!("---\npeople:\n  st: {{name: Stefan, kind: human}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: kanbanD, repository: {0}, wbs: {0}/Dokumentation/Planung/kd.md, requirements: {0}/Anforderungen}}\n---\n", wurzel.display());
        std::fs::write(k.path().join("kanbanD.md"), kanban).unwrap();
        std::fs::write(k.path().join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\nlabels: [braucht:2]\norigins: [kd:I0007, kd:R00014]\n---\n").unwrap();
        std::fs::write(k.path().join("aufgaben/0002-zwei.md"), "---\nid: 2\ntitle: zwei\norigins: [kd:I0008]\n---\n").unwrap();
        git(k.path(), &["add", "-A"]);
        git(k.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgangslage"]);
        Lage { _r: r, k }
    }

    fn ordner(&self) -> &Path {
        self.k.path()
    }
}

// ---- AK 1: Endpunkt ---------------------------------------------------------------------------------------------------

#[tokio::test]
async fn ak01_herkunft_gibt_404_auch_mit_abfrage_und_steht_in_keiner_beschreibung() {
    let lage = Lage::neu();
    let lauf = gemeinsam::starten(lage.ordner(), &["--port", "0"]);
    for pfad in ["api/herkunft", "api/herkunft?x=1"] {
        assert_eq!(lesen(&lauf.adresse, pfad).await.0, 404, "{pfad}");
    }
    let (s, endpunkte) = lesen(&lauf.adresse, "api/endpunkte").await;
    assert_eq!(s, 200);
    assert!(!endpunkte.contains("/api/herkunft"), "GET /api/endpunkte nennt ihn nicht mehr");
    let (s, openapi) = lesen(&lauf.adresse, "api/openapi.json").await;
    assert_eq!(s, 200);
    assert!(!openapi.contains("/api/herkunft"), "die OpenAPI-Beschreibung nennt ihn nicht mehr");
    let readme = std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("README.md")).unwrap();
    assert!(!readme.contains("/api/herkunft"), "README nennt ihn nicht");
}

#[test]
fn ak01_readme_sagt_die_herkunft_ist_ein_verweis_den_kanband_nicht_aufloest() {
    let readme = std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("README.md")).unwrap();
    assert!(readme.contains("Die Herkunft ist ein Verweis, den kanbanD nicht auflöst; ohne Kürzel ist sie bei mehreren Anwendungen mehrdeutig"));
    assert!(!readme.contains("löst eine Herkunft nur auf"));
}

// ---- AK 5: Herkunft schreiben (API-Teil) -----------------------------------------------------------------------------

#[tokio::test]
async fn ak05_schreiben_prueft_die_schreibweise_wie_vor_der_karte() {
    let lage = Lage::neu();
    let lauf = gemeinsam::starten(lage.ordner(), &["--port", "0"]);
    let vorher = commits(lage.ordner());
    let (s, _) = herkunft_setzen(&lauf.adresse, 3, json!(["kd:I0007", "R00014"])).await;
    assert_eq!(s, 200);
    assert_eq!(commits(lage.ordner()), vorher + 1, "genau ein Commit");
    assert!(lies(lage.ordner(), "aufgaben/0003-drei.md").contains("origins: [kd:I0007, R00014]\n"), "in dieser Reihenfolge");
    let nach_dem_schreiben = commits(lage.ordner());
    let (s, f) = herkunft_setzen(&lauf.adresse, 3, json!(["X1"])).await;
    assert_eq!(s, 400);
    assert!(f["fehler"].as_str().unwrap().contains("„X1“ ist keine Herkunft — erwartet I0001, R00014, kd:I0001 oder thin air"), "{f}");
    let (s, f) = herkunft_setzen(&lauf.adresse, 3, json!(["zz:I0001"])).await;
    assert_eq!(s, 400);
    assert!(f["fehler"].as_str().unwrap().contains("„zz“"), "{f}");
    assert_eq!(commits(lage.ordner()), nach_dem_schreiben, "kein Commit bei 400");
}

#[tokio::test]
async fn ak05_herkunft_wird_ohne_aufloesung_gelesen_auch_ohne_erreichbare_quellen() {
    let lage = Lage::neu();
    std::fs::remove_dir_all(lage._r.path().join("Dokumentation")).unwrap();
    let lauf = gemeinsam::starten(lage.ordner(), &["--port", "0"]);
    let (s, text) = lesen(&lauf.adresse, "api/aufgaben/1").await;
    assert_eq!(s, 200);
    let a: Value = serde_json::from_str(&text).unwrap();
    assert_eq!(a["herkunft"], json!(["kd:I0007", "kd:R00014"]));
}

// ---- AK 7: Legacy-Probe gegen Kopien der Altbestände (von Hand, B1064) -----------------------------------------------

/// Das Programm mit eigenem Mitschnitt von stderr („im Log steht keine Fehler- oder Warnzeile“).
struct Instanz {
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
    fn starten(programm: &Path, board: &Path, log: PathBuf) -> Instanz {
        let mut kind = Command::new(programm)
            .arg(board)
            .args(["--kein-browser", "--host", "127.0.0.1", "--port", "0"])
            .stdout(Stdio::piped())
            .stderr(Stdio::from(std::fs::File::create(&log).unwrap()))
            .spawn()
            .expect("kanbanD startet");
        let mut zeile = String::new();
        BufReader::new(kind.stdout.take().unwrap()).read_line(&mut zeile).unwrap();
        let adresse = zeile.split_whitespace().last().expect("Adresse in der Startzeile").to_string();
        Instanz { kind, adresse, log }
    }

    /// Zeilen des Logs, die nach Fehler oder Warnung aussehen; ausgenommen die erschöpften inotify-Instanzen des Rechners.
    fn auffaellige_zeilen(&self) -> Vec<String> {
        let auffaellig = |z: &str| ["fehler", "warn", "error", "defekt", "nicht beobachtet"].iter().any(|w| z.to_lowercase().contains(w));
        let rechnergrenze = |z: &str| z.contains("nicht beobachtet (Too many open files (os error 24))");
        std::fs::read_to_string(&self.log).unwrap_or_default().lines().filter(|z| auffaellig(z) && !rechnergrenze(z)).map(String::from).collect()
    }
}

/// Alle versionierten Dateien mit Inhalt, sortiert — die Gleichheit ersetzt die SHA-256-Summe über `git ls-files`.
fn dateien(ordner: &Path) -> Vec<(String, Vec<u8>)> {
    let mut alle: Vec<_> = git(ordner, &["ls-files"]).lines().map(|p| (p.to_string(), std::fs::read(ordner.join(p)).unwrap())).collect();
    alle.sort();
    alle
}

/// `R00212_KOPIEN` = Kopien der Board-Ordner, durch `:` getrennt (werden gelesen, nie beschrieben);
/// `R00212_ALT` = das Programm vor der Karte.
#[tokio::test]
#[ignore = "Legacy-Probe von Hand: braucht Kopien der vier Board-Ordner (R00212_KOPIEN, R00212_ALT)"]
async fn ak07_legacy_probe_kopien_der_altbestaende() {
    let var = |n: &str| std::env::var(n).unwrap_or_else(|_| panic!("{n} fehlt"));
    let alt = PathBuf::from(var("R00212_ALT"));
    for kopie in var("R00212_KOPIEN").split(':').map(PathBuf::from) {
        let ablage = kopie.parent().unwrap().to_path_buf();
        let name = kopie.file_name().unwrap().to_string_lossy().to_string();
        let (zahl, vorher) = (commits(&kopie), dateien(&kopie));
        let mut listen = vec![];
        for (programm, log) in [(alt.as_path(), "alt"), (Path::new(env!("CARGO_BIN_EXE_kanbanD")), "neu")] {
            let lauf = Instanz::starten(programm, &kopie, ablage.join(format!("log-{name}-{log}.txt")));
            let (s, text) = lesen(&lauf.adresse, "api/aufgaben").await;
            assert_eq!(s, 200, "{name} {log}");
            let a: Value = serde_json::from_str(&text).unwrap();
            let herkunft: Vec<(u64, Value)> = a["aufgaben"].as_array().unwrap().iter().map(|t| (t["nummer"].as_u64().unwrap(), t["herkunft"].clone())).collect();
            let (_, z) = lesen(&lauf.adresse, "api/zustand").await;
            assert_eq!(serde_json::from_str::<Value>(&z).unwrap()["defekte"], json!([]), "{name} {log}: keine defekte Datei");
            assert_eq!(commits(&kopie), zahl, "{name} {log}: kein Commit");
            assert_eq!(dateien(&kopie), vorher, "{name} {log}: alle Dateien bytegleich");
            assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new(), "{name} {log}");
            if log == "neu" {
                assert_eq!(lesen(&lauf.adresse, "api/herkunft").await.0, 404, "{name}");
            }
            listen.push(herkunft);
        }
        assert_eq!(listen[0], listen[1], "{name}: die Herkunft jeder Aufgabe ist vor und nach der Karte gleich");
        let mit: usize = listen[1].iter().filter(|(_, h)| h.as_array().is_some_and(|l| !l.is_empty())).count();
        let eintraege: usize = listen[1].iter().map(|(_, h)| h.as_array().map_or(0, Vec::len)).sum();
        println!("{name}: {mit} Aufgaben mit Herkunft, {eintraege} Einträge");
    }
}
