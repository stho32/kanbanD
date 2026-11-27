// R00223 (I0213, Karte #227, Scheibe S3 von ADR-0034): Phasen werden gewöhnliche Spalten — Akzeptanztests gegen das echte
// Programm, ein echtes Arbeits-Repository mit WBS und Phasen-Datei und einen echten kanbanD-Ordner (Ausgangslage von R00223).
// Schichten: Testfall (je AK) → Testsprache (`Lage`, `folge_ak03`) → Treiber (`lesen`, `senden`, `status_von`) → Programm.
// Die Berichte selbst (AK 1, 9) prüft `e2e/einheit/r00223-ohne-phasen.test.js`, die Oberfläche (AK 1, 10–13)
// `e2e/tests/r00223-ohne-phasen.spec.js`. AK 16 (Kopie des JoinPuya-Ordners) läuft als `#[ignore]`-Test von Hand.
mod gemeinsam;

use gemeinsam::{git, git_am, lies};
use serde_json::{Value, json};
use std::io::{BufRead, BufReader};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

// ---- Treiber ----------------------------------------------------------------------------------------------------------

async fn lesen(adresse: &str, pfad: &str) -> Value {
    let (status, v) = status_von(reqwest::Method::GET, adresse, pfad, None).await;
    assert_eq!(status, 200, "GET {pfad}: {v}");
    v
}

/// Status und Rumpf (JSON, sonst der Text als String) eines Aufrufs, mit oder ohne Rumpf, als Stefan.
async fn status_von(methode: reqwest::Method, adresse: &str, pfad: &str, rumpf: Option<Value>) -> (u16, Value) {
    let mut anfrage = reqwest::Client::new().request(methode, format!("{adresse}{pfad}")).header("X-KanbanD-Wer", "sh");
    if let Some(r) = rumpf {
        anfrage = anfrage.json(&r);
    }
    let antwort = anfrage.send().await.unwrap();
    let status = antwort.status().as_u16();
    let text = antwort.text().await.unwrap();
    (status, serde_json::from_str(&text).unwrap_or(Value::String(text)))
}

async fn senden(methode: reqwest::Method, adresse: &str, pfad: &str, rumpf: Value) -> (u16, Value) {
    status_von(methode, adresse, pfad, Some(rumpf)).await
}

async fn bewegen(adresse: &str, nummer: u32, spalte: &str) -> (u16, Value) {
    senden(reqwest::Method::POST, adresse, "api/boards/entwicklung/bewegen", json!({"nummer": nummer, "spalte": spalte})).await
}

/// Das Programm mit eigenem Mitschnitt von stderr („keine Fehler- oder Warnzeile im Log“).
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
    fn starten(programm: &Path, ordner: &Path, log: PathBuf) -> Instanz {
        let mut kind = Command::new(programm)
            .arg(ordner)
            .args(["--kein-browser", "--host", "127.0.0.1", "--port", "0"])
            .env("XDG_STATE_HOME", log.parent().unwrap_or(std::path::Path::new("/tmp")))
            .stdout(Stdio::piped())
            .stderr(Stdio::from(std::fs::File::create(&log).unwrap()))
            .spawn()
            .expect("kanbanD startet");
        let mut zeile = String::new();
        BufReader::new(kind.stdout.take().unwrap()).read_line(&mut zeile).unwrap();
        let adresse = zeile.split_whitespace().last().expect("Adresse in der Startzeile").to_string();
        Instanz { kind, adresse, log }
    }

    fn adresse(&self) -> &str {
        &self.adresse
    }

    /// Zeilen des Logs, die nach Fehler oder Warnung aussehen. Ausgenommen ist nur die Meldung „nicht beobachtet“ bei
    /// erschöpften inotify-Instanzen des Rechners (os error 24): sie hängt an der Zahl paralleler Instanzen.
    fn auffaellige_zeilen(&self) -> Vec<String> {
        let auffaellig = |z: &str| ["fehler", "warn", "error", "defekt", "phase"].iter().any(|w| z.to_lowercase().contains(w));
        // R00258: das Protokoll schreibt planmäßig nach stderr (ADR-0001 N1.2 Regel 1) — seine eigenen Zeilen sind keine Warnung des Tests
        let protokollzeile = |z: &str| matches!(z.split_whitespace().nth(1), Some("DEBUG" | "INFO" | "WARN" | "ERROR" | "EXCEPTION"));
        let rechnergrenze = |z: &str| z.contains("(os error 24)");
        std::fs::read_to_string(&self.log).unwrap_or_default().lines().filter(|z| !protokollzeile(z) && auffaellig(z) && !rechnergrenze(z)).map(String::from).collect()
    }
}

// ---- Testsprache: Ausgangslage ----------------------------------------------------------------------------------------

const SPALTEN: [&str; 5] = ["Offen", "Entwicklung", "Nacharbeit", "Reviews", "Erledigt"];
const PHASEN_DATEI: &str = "# Phasen\n\n## Phasen\n\n| Nr | Phase | Nachweis |\n|---|---|---|\n| 1 | Entwicklung | — |\n| 2 | Reviews | — |\n| 3 | Abnahme | — |\n";
const DATEIEN: [&str; 4] = ["0001-eins.md", "0002-zwei.md", "0003-drei.md", "0004-vier.md"];

/// Die Board-Datei `entwicklung`: `kopf` ist das Frontmatter, `lage` je Spalte (in der Reihenfolge von `SPALTEN`) die Nummern.
fn board_text(kopf: &str, lage: [&[u32]; 5]) -> String {
    let mut s = format!("---\n{kopf}---\n\n# Entwicklung\n");
    for (spalte, nummern) in SPALTEN.iter().zip(lage) {
        s.push_str(&format!("\n## {spalte}\n\n"));
        for n in nummern {
            s.push_str(&format!("- [#{n}](../aufgaben/{})\n", DATEIEN[*n as usize - 1]));
        }
    }
    s
}

/// Ausgangslage von R00223: Arbeits-Repository `R` mit WBS `Dokumentation/Planung/kd.md`, Phasen-Datei `kd-phasen.md`
/// (Entwicklung, Reviews, Abnahme) und dem Commit `C1`; kanbanD-Ordner `K` mit dem Register `kd` (repository, wbs) und dem
/// Board `entwicklung` (Offen, Entwicklung, Nacharbeit, Reviews, Erledigt; WIP-Grenze 1 an „Nacharbeit“; `applications: [kd]`).
/// `mit_phasen` legt `column-phases` (Entwicklung, Reviews) und `phases: {skipped: [Reviews]}` an #3 an; ohne ist es der
/// Zwilling `K'` — gleich erzeugt, mit derselben Folge datierter Bewegungen (nicht durch einen späteren Commit, Hinweise).
struct Lage {
    _tmp: tempfile::TempDir,
    basis: PathBuf,
    r: PathBuf,
    k: PathBuf,
    c1: String,
}

impl Drop for Lage {
    fn drop(&mut self) {
        // ein Test, der mitten in `chmod 000` scheitert, hinterlässt sonst einen Ordner, den das Aufräumen nicht löschen kann
        let _ = std::fs::set_permissions(self.planung(), std::fs::Permissions::from_mode(0o755));
    }
}

impl Lage {
    fn neu(mit_phasen: bool) -> Lage {
        let tmp = tempfile::tempdir().unwrap();
        let basis = tmp.path().canonicalize().unwrap();
        let (r, k) = (basis.join("R"), basis.join("K"));
        std::fs::create_dir_all(r.join("Dokumentation/Planung")).unwrap();
        std::fs::write(r.join("Dokumentation/Planung/kd.md"), "# WBS\n\n| ID | Ebene | Eltern | Name | Status |\n|---|---|---|---|---|\n| I0007 | Interaction | — | Liste | rot |\n").unwrap();
        std::fs::write(r.join("Dokumentation/Planung/kd-phasen.md"), PHASEN_DATEI).unwrap();
        std::fs::write(r.join("export.txt"), "eins\n").unwrap();
        git(&r, &["init", "-q", "-b", "main"]);
        git(&r, &["add", "-A"]);
        git(&r, &["-c", "user.name=Ada", "-c", "user.email=a@a", "commit", "-q", "-m", "C1 Export anlegen"]);
        let c1 = git(&r, &["rev-parse", "HEAD"]);
        std::fs::create_dir_all(k.join("aufgaben")).unwrap();
        std::fs::create_dir_all(k.join("boards")).unwrap();
        let drei = if mit_phasen { "phases: {skipped: [Reviews]}\n" } else { "" };
        for (datei, inhalt) in DATEIEN.iter().zip([
            format!("---\nid: 1\ntitle: Eins\ncommits:\n  - kd:{c1}\n---\n"),
            "---\nid: 2\ntitle: Zwei\n---\n".to_string(),
            format!("---\nid: 3\ntitle: Drei\n{drei}---\n"),
            "---\nid: 4\ntitle: Vier\n---\n".to_string(),
        ]) {
            std::fs::write(k.join("aufgaben").join(datei), inhalt).unwrap();
        }
        let l = Lage { _tmp: tmp, basis, r, k, c1 };
        l.register(&format!("kd: {{name: KD, repository: {}, wbs: {}}}", l.r.display(), l.wbs()));
        let kopf = format!("limits:\n  Nacharbeit: 1\n{}applications: [kd]\n", if mit_phasen { "column-phases:\n  Entwicklung: Entwicklung\n  Reviews: Reviews\n" } else { "" });
        git(&l.k, &["init", "-q"]);
        // die Bewegungen der Ausgangslage, je Tag ein Commit
        for (datum, lage) in [
            ("2026-11-01T09:00:00", [&[1, 2, 3, 4][..], &[], &[], &[], &[]]),
            ("2026-11-02T09:00:00", [&[3, 4][..], &[1, 2], &[], &[], &[]]),
            ("2026-11-03T09:00:00", [&[4][..], &[2, 3], &[], &[1], &[]]),
            ("2026-11-04T09:00:00", [&[4][..], &[], &[2], &[3], &[]]),
            ("2026-11-05T09:00:00", [&[4][..], &[], &[2], &[3], &[1]]),
        ] {
            std::fs::write(l.k.join("boards/entwicklung.md"), board_text(&kopf, lage)).unwrap();
            git_am(&l.k, "V", datum, &["add", "-A"]);
            git_am(&l.k, "V", datum, &["commit", "-q", "-m", "Stand"]);
        }
        l
    }

    fn planung(&self) -> PathBuf {
        self.r.join("Dokumentation/Planung")
    }

    fn wbs(&self) -> String {
        self.planung().join("kd.md").display().to_string()
    }

    /// `kanbanD.md` mit Stefan (Mensch), Claude (Agent) und den Registerzeilen `zeilen` (`kd: {…}`).
    fn register(&self, zeilen: &str) {
        std::fs::write(self.k.join("kanbanD.md"), format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\n  cl: {{name: Claude, kind: agent}}\nclasses: {{}}\nsources:\n  applications:\n    {zeilen}\n---\n")).unwrap();
    }

    fn committen(&self) {
        git(&self.k, &["add", "-A"]);
        git(&self.k, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Stand"]);
    }

    fn commits_k(&self) -> u32 {
        git(&self.k, &["rev-list", "--count", "HEAD"]).parse().unwrap()
    }

    fn commits_r(&self) -> u32 {
        git(&self.r, &["rev-list", "--count", "HEAD"]).parse().unwrap()
    }

    fn starten(&self) -> Instanz {
        self.starten_mit(Path::new(env!("CARGO_BIN_EXE_kanbanD")), "log.txt")
    }

    fn starten_mit(&self, programm: &Path, log: &str) -> Instanz {
        Instanz::starten(programm, &self.k, self.basis.join(log))
    }

    /// Den Ordner der WBS und der Phasen-Datei unlesbar machen (`chmod 000`) bzw. wieder lesbar.
    fn planung_rechte(&self, modus: u32) {
        std::fs::set_permissions(self.planung(), std::fs::Permissions::from_mode(modus)).unwrap();
    }

    /// SHA-256 der Phasen-Datei — liest sie mit vorübergehend lesbarem Ordner, damit `chmod 000` danach wieder gilt.
    fn phasen_sha(&self) -> String {
        let vorher = std::fs::metadata(self.planung()).unwrap().permissions().mode();
        self.planung_rechte(0o755);
        let sha = sha256(&self.planung().join("kd-phasen.md"));
        self.planung_rechte(vorher);
        sha
    }

    fn board_sha(&self) -> String {
        sha256(&self.k.join("boards/entwicklung.md"))
    }

    fn datei(&self, rel: &str) -> String {
        lies(&self.k, rel)
    }

    /// Dateien des letzten Commits in `K`.
    fn im_letzten_commit(&self) -> Vec<String> {
        let mut d: Vec<String> = git(&self.k, &["show", "--name-only", "--format=", "HEAD"]).lines().map(String::from).collect();
        d.sort();
        d
    }

    /// Ersetzt den Pfad der Lage durch `<B>`, damit Antworten zweier Lagen vergleichbar sind.
    fn ohne_pfad(&self, v: &Value) -> Value {
        serde_json::from_str(&v.to_string().replace(&self.basis.display().to_string(), "<B>")).unwrap()
    }
}

fn sha256(pfad: &Path) -> String {
    let a = Command::new("sha256sum").arg(pfad).output().unwrap();
    assert!(a.status.success(), "sha256sum {}: {}", pfad.display(), String::from_utf8_lossy(&a.stderr));
    String::from_utf8_lossy(&a.stdout).split_whitespace().next().unwrap().to_string()
}

/// Frontmatter einer Aufgabendatei als YAML-Wert.
fn frontmatter(text: &str) -> serde_yaml::Value {
    let rumpf = text.strip_prefix("---\n").unwrap().split("\n---").next().unwrap();
    serde_yaml::from_str(rumpf).unwrap()
}

fn phases_in(text: &str) -> serde_yaml::Value {
    let f = frontmatter(text);
    assert!(f.get("phases").is_some(), "phases fehlt in\n{text}");
    f.get("phases").cloned().unwrap()
}

/// Der Abschnitt `phases:` wörtlich (vom Schlüssel bis zum nächsten Schlüssel der obersten Ebene).
fn phases_abschnitt(text: &str) -> String {
    let mut drin = false;
    let mut s = String::new();
    for z in text.lines() {
        if z.starts_with("phases:") {
            drin = true;
        } else if drin && !z.starts_with(' ') {
            break;
        }
        if drin {
            s.push_str(z);
            s.push('\n');
        }
    }
    s
}

/// Alle Schlüssel eines JSON-Werts, rekursiv (auch in Listen).
fn schluessel_in(v: &Value, ziel: &mut Vec<String>) {
    match v {
        Value::Object(m) => {
            for (k, w) in m {
                ziel.push(k.clone());
                schluessel_in(w, ziel);
            }
        }
        Value::Array(l) => l.iter().for_each(|w| schluessel_in(w, ziel)),
        _ => {}
    }
}

fn alle_schluessel(v: &Value) -> Vec<String> {
    let mut s = vec![];
    schluessel_in(v, &mut s);
    s
}

// ---- AK 1 (API-Teil): Board und Bewegungen ohne Phasen, gleich dem Zwilling --------------------------------------------

#[tokio::test]
async fn ak01_board_ohne_phasen_ohne_commit_und_bewegungen_gleich_dem_zwilling() {
    let (k, zwilling) = (Lage::neu(true), Lage::neu(false));
    let vorher = k.commits_k();
    let (lauf, lauf_z) = (k.starten(), zwilling.starten());
    let b = lesen(lauf.adresse(), "api/boards/entwicklung").await;
    assert!(b.get("phasen").is_none(), "kein Schlüssel phasen: {b}");
    let spalten = b["spalten"].as_array().unwrap();
    assert!(spalten.iter().all(|s| s.get("phase").is_none()), "keine Spalte trägt phase: {b}");
    assert_eq!(spalten.iter().map(|s| s["name"].as_str().unwrap()).collect::<Vec<_>>(), SPALTEN, "genau die fünf Spalten der Ausgangslage");
    assert_eq!(k.commits_k(), vorher, "kein neuer Commit in K");
    lesen(lauf_z.adresse(), "api/boards/entwicklung").await;
    let pfad = "api/berichte/bewegungen?board=entwicklung";
    let (mut bew, mut bew_z) = (lesen(lauf.adresse(), pfad).await, lesen(lauf_z.adresse(), pfad).await);
    for v in [&mut bew, &mut bew_z] {
        v.as_object_mut().unwrap().remove("jetzt");
        let s = alle_schluessel(v);
        assert!(!s.iter().any(|k| k == "phasen" || k == "uebersprungen"), "bewegungen ohne phasen und uebersprungen: {v}");
    }
    assert_eq!(bew, bew_z, "bewegungen von K und K' gleich (bis auf jetzt)");
    assert_eq!(k.commits_k(), vorher, "auch die Bewegungen schreiben nichts");
}

// ---- AK 2: kein GET schreibt; column-phases fällt erst im Commit einer schreibenden Aktion ----------------------------

const LESENDE_GETS: [&str; 10] = [
    "api/boards",
    "api/boards/entwicklung",
    "api/boards/entwicklung",
    "api/aufgaben",
    "api/aufgaben/3",
    "api/berichte/bewegungen?board=entwicklung",
    "api/einstellungen",
    "api/anwendungen",
    "api/aufgaben/1/commits",
    "api/zustand",
];

async fn alle_gets(adresse: &str) {
    for pfad in LESENDE_GETS {
        lesen(adresse, pfad).await;
    }
}

#[tokio::test]
async fn ak02_kein_get_schreibt_column_phases_faellt_im_commit_der_bewegung() {
    let l = Lage::neu(true);
    let (vorher, sha) = (l.commits_k(), l.board_sha());
    let lauf = l.starten();
    alle_gets(lauf.adresse()).await;
    assert_eq!(l.commits_k(), vorher, "kein GET erzeugt einen Commit");
    assert_eq!(l.board_sha(), sha, "Board-Datei bytegleich");
    assert!(l.datei("boards/entwicklung.md").contains("column-phases"), "column-phases steht noch in der Datei");
    let (s, v) = bewegen(lauf.adresse(), 2, "Reviews").await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(l.commits_k(), vorher + 1, "genau ein Commit");
    let dateien = l.im_letzten_commit();
    assert!(dateien.contains(&"boards/entwicklung.md".to_string()), "{dateien:?}");
    assert!(dateien.iter().all(|d| d == "boards/entwicklung.md" || d == "aufgaben/0002-zwei.md"), "nur Board und Aufgabendatei: {dateien:?}");
    let im_commit = git(&l.k, &["show", "HEAD:boards/entwicklung.md"]);
    assert!(!im_commit.contains("column-phases"), "column-phases fehlt im Commit der Bewegung:\n{im_commit}");
}

#[tokio::test]
async fn ak02_bindung_loesen_ein_commit_ohne_column_phases() {
    let l = Lage::neu(true);
    let lauf = l.starten();
    let vorher = l.commits_k();
    let (s, v) = senden(reqwest::Method::PUT, lauf.adresse(), "api/boards/entwicklung/anwendungen", json!([])).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(l.commits_k(), vorher + 1, "genau ein Commit");
    let im_commit = git(&l.k, &["show", "HEAD:boards/entwicklung.md"]);
    assert!(!im_commit.contains("column-phases"), "column-phases fehlt im Commit der Bindung:\n{im_commit}");
}

// ---- AK 3: der Ordner der WBS ist unlesbar und stört nichts -----------------------------------------------------------

/// Die Folge aus AK 3: Board, #5 anlegen und durch alle fünf Spalten, jeder Bericht, die Commit-Liste von #1, Einstellungen
/// lesen und unverändert schreiben. Liefert je Schritt Status und vergleichbaren Inhalt (ohne Zeitstempel und Hashes).
async fn folge_ak03(l: &Lage, lauf: &Instanz) -> Vec<(String, u16, Value)> {
    let a = lauf.adresse();
    let mut schritte = vec![];
    let (s, b) = status_von(reqwest::Method::GET, a, "api/boards/entwicklung", None).await;
    schritte.push(("Board".into(), s, l.ohne_pfad(&b)));
    let (s, neu) = senden(reqwest::Method::POST, a, "api/aufgaben", json!({"titel": "Neu", "board": "entwicklung", "spalte": "Offen"})).await;
    schritte.push(("#5 anlegen".into(), s, json!(neu["nummer"])));
    for spalte in &SPALTEN[1..] {
        let (s, v) = bewegen(a, 5, spalte).await;
        schritte.push((format!("#5 nach {spalte}"), s, json!(v["warnungen"])));
    }
    for bericht in ["api/berichte/bewegungen?board=entwicklung", "api/berichte/verlauf?board=entwicklung", "api/berichte/zeiten.csv", "api/boards/entwicklung/fieber/cache"] {
        let (s, v) = status_von(reqwest::Method::GET, a, bericht, None).await;
        // Zeitstempel weg; was bleibt, sind die Schlüssel (`phasen` am lesbaren Ordner unterschiede sich)
        let mut schluessel = alle_schluessel(&v);
        schluessel.sort();
        schluessel.dedup();
        schritte.push((bericht.into(), s, json!(schluessel)));
    }
    let (s, c) = status_von(reqwest::Method::GET, a, "api/aufgaben/1/commits", None).await;
    let c1 = c["commits"].as_array().and_then(|liste| liste.iter().find(|e| e["verweis"] == format!("kd:{}", l.c1))).cloned().unwrap_or(Value::Null);
    schritte.push(("Commits #1, zustand von kd:<C1>".into(), s, json!([c1["zustand"], c1["titel"]])));
    let (s, e) = status_von(reqwest::Method::GET, a, "api/einstellungen", None).await;
    schritte.push(("Einstellungen lesen".into(), s, l.ohne_pfad(&e)));
    let (s, _) = senden(reqwest::Method::PUT, a, "api/einstellungen", e).await;
    schritte.push(("Einstellungen schreiben".into(), s, Value::Null));
    schritte
}

#[tokio::test]
async fn ak03_unlesbarer_ordner_der_wbs_stoert_nichts_und_gleiche_antworten() {
    let l = Lage::neu(true);
    let (r_vorher, sha_vorher) = (l.commits_r(), l.phasen_sha());
    l.planung_rechte(0o000);
    let lauf = l.starten();
    let unlesbar = folge_ak03(&l, &lauf).await;
    for (schritt, status, inhalt) in &unlesbar {
        assert!(*status < 400, "{schritt}: {status} {inhalt}");
    }
    assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new(), "keine Fehler- oder Warnzeile im Log");
    assert_eq!((l.commits_r(), l.phasen_sha()), (r_vorher, sha_vorher), "R und Phasen-Datei unverändert");
    drop(lauf);
    l.planung_rechte(0o755);

    let lesbar_lage = Lage::neu(true);
    let lesbar_lauf = lesbar_lage.starten();
    let lesbar = folge_ak03(&lesbar_lage, &lesbar_lauf).await;
    assert_eq!(lesbar.len(), unlesbar.len());
    for (l, u) in lesbar.iter().zip(&unlesbar) {
        assert_eq!(l, u, "dieselbe Folge mit lesbarem Ordner liefert dieselben Antworten — Schritt „{}“", l.0);
    }
}

// ---- AK 4, 5: phases ist ein unbekannter Schlüssel der Aufgabe --------------------------------------------------------

#[tokio::test]
async fn ak04_patch_phasen_wird_ueberlesen_phases_bleibt_in_der_datei() {
    let l = Lage::neu(true);
    let lauf = l.starten();
    let a = lauf.adresse();
    let drei = lesen(a, "api/aufgaben/3").await;
    assert!(drei.get("phasen").is_none(), "GET ohne phasen: {drei}");
    let (vorher, text) = (l.commits_k(), l.datei("aufgaben/0003-drei.md"));
    let (s, v) = senden(reqwest::Method::PATCH, a, "api/aufgaben/3", json!({"phasen": {"uebersprungen": []}})).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(l.commits_k(), vorher, "kein Commit, wenn sonst nichts geändert wird");
    assert_eq!(l.datei("aufgaben/0003-drei.md"), text, "Aufgabendatei bytegleich");
    let (s, v) = senden(reqwest::Method::PATCH, a, "api/aufgaben/3", json!({"titel": "Export prüfen", "phasen": {"uebersprungen": []}})).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(l.commits_k(), vorher + 1, "genau ein Commit");
    let text = l.datei("aufgaben/0003-drei.md");
    assert_eq!(frontmatter(&text)["title"], serde_yaml::Value::from("Export prüfen"), "{text}");
    assert_eq!(phases_in(&text), serde_yaml::from_str::<serde_yaml::Value>("{skipped: [Reviews]}").unwrap(), "phases als YAML gelesen gleich:\n{text}");
    let abschnitt = phases_abschnitt(&text);
    let (s, _) = senden(reqwest::Method::PATCH, a, "api/aufgaben/3", json!({"titel": "Export prüfen 2"})).await;
    assert_eq!(s, 200);
    assert_eq!(phases_abschnitt(&l.datei("aufgaben/0003-drei.md")), abschnitt, "ein zweites PATCH titel ändert kein Byte an phases");
}

#[tokio::test]
async fn ak05_phases_in_jeder_form_oeffnet_und_bleibt_beim_schreiben() {
    let l = Lage::neu(true);
    let formen = [
        (6, "0006-sechs.md", "phases: [Abnahme]\n"),
        (7, "0007-sieben.md", "phases: {skipped: Abnahme, reason: kein Kunde, owners: [mi]}\n"),
        (8, "0008-acht.md", "phases:\n"),
    ];
    for (n, datei, phases) in formen {
        std::fs::write(l.k.join("aufgaben").join(datei), format!("---\nid: {n}\ntitle: Form {n}\n{phases}---\n")).unwrap();
    }
    l.committen();
    let lauf = l.starten();
    let a = lauf.adresse();
    let liste = lesen(a, "api/aufgaben").await.to_string();
    for n in [6, 7, 8] {
        assert!(liste.contains(&format!("Form {n}")), "#{n} in GET /api/aufgaben: {liste}");
    }
    let z = lesen(a, "api/zustand").await;
    assert_eq!(z["defekte"], json!([]), "keine defekte Datei: {z}");
    for (n, datei, phases) in formen {
        let erwartet = phases_in(&format!("---\n{phases}---\n"));
        let (s, v) = senden(reqwest::Method::PATCH, a, &format!("api/aufgaben/{n}"), json!({"titel": format!("Form {n} geändert")})).await;
        assert_eq!(s, 200, "#{n}: {v}");
        let text = l.datei(&format!("aufgaben/{datei}"));
        assert_eq!(phases_in(&text), erwartet, "#{n}: phases als YAML gelesen gleich:\n{text}");
    }
    assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new(), "keine Warnung im Log");
}

// ---- AK 6, 7: Warnung mit zwei Schlüsseln, API-Beschreibung ohne Phasen -----------------------------------------------

#[tokio::test]
async fn ak06_warnung_hat_genau_pruefung_und_text() {
    let l = Lage::neu(true);
    let lauf = l.starten();
    let (s, v) = bewegen(lauf.adresse(), 4, "Nacharbeit").await;
    assert_eq!(s, 200, "{v}");
    let w = v["warnungen"].as_array().unwrap();
    assert_eq!(w.len(), 1, "genau eine Warnung: {v}");
    let mut schluessel: Vec<&String> = w[0].as_object().unwrap().keys().collect();
    schluessel.sort();
    assert_eq!(schluessel, ["pruefung", "text"], "{v}");
    assert_eq!(w[0]["pruefung"], "grenze");
    let api = lesen(lauf.adresse(), "api/openapi.json").await;
    let mut eigenschaften: Vec<&String> = api["components"]["schemas"]["Warnung"]["properties"].as_object().unwrap().keys().collect();
    eigenschaften.sort();
    assert_eq!(eigenschaften, ["pruefung", "text"], "Schema Warnung");
}

#[tokio::test]
async fn ak07_endpunkte_und_openapi_ohne_phasen_durchlaeufe_bleiben() {
    let l = Lage::neu(true);
    let lauf = l.starten();
    let api = lesen(lauf.adresse(), "api/openapi.json").await;
    let schemas = api["components"]["schemas"].as_object().unwrap();
    for name in ["Phasenstand", "Phasenkarte", "Phasenfolge", "BoardMitPhasen"] {
        assert!(!schemas.contains_key(name), "kein Schema {name}");
    }
    let eigenschaften: Vec<String> = schemas.values().flat_map(|s| s["properties"].as_object().map(|p| p.keys().cloned().collect::<Vec<_>>()).unwrap_or_default()).collect();
    for name in ["phasen", "uebersprungen"] {
        assert!(!eigenschaften.iter().any(|e| e == name), "keine Eigenschaft {name}");
    }
    assert!(schemas["Spalte"]["properties"].get("phase").is_none(), "Spalte ohne phase");
    let endpunkte = lesen(lauf.adresse(), "api/endpunkte").await;
    let zweck = |methode: &str, pfad: &str| {
        endpunkte.as_array().unwrap().iter().find(|e| e["methode"] == methode && e["pfad"].as_str().unwrap().starts_with(pfad)).unwrap_or_else(|| panic!("{methode} {pfad} fehlt"))["zweck"].as_str().unwrap().to_string()
    };
    assert!(!zweck("PATCH", "/api/aufgaben/{nr}").contains("phasen?"), "PATCH ohne phasen?");
    assert!(!zweck("GET", "/api/boards/{slug}").contains(" phase,"), "Spalten ohne phase");
    assert!(zweck("POST", "/api/aufgaben/{nr}/durchlaeufe").contains("phase (1–40 Zeichen)"), "Durchläufe bleiben");
    let text = endpunkte.to_string().to_lowercase();
    for wort in ["phasen", "uebersprungen", "spaltenphasen"] {
        assert!(!text.contains(wort), "die Endpunktliste nennt {wort}");
    }
}

// ---- AK 8: Gegenprobe Durchläufe ---------------------------------------------------------------------------------------

#[tokio::test]
async fn ak08_durchlaeufe_mit_phase_wie_vor_der_karte() {
    let l = Lage::neu(true);
    let lauf = l.starten();
    let a = lauf.adresse();
    let vorher = l.commits_k();
    let (s, v) = senden(reqwest::Method::POST, a, "api/aufgaben/1/durchlaeufe", json!({"phase": "Entwicklertest", "ergebnis": "bestanden"})).await;
    assert!(s < 300, "{s} {v}");
    assert_eq!(l.commits_k(), vorher + 1, "genau ein Commit");
    let text = l.datei("aufgaben/0001-eins.md");
    let block = text.split("kanbanD-runs").nth(1).unwrap_or_else(|| panic!("Block kanbanD-runs fehlt:\n{text}"));
    assert!(block.lines().any(|z| z.contains("Entwicklertest") && z.contains("bestanden")), "Zeile im Block:\n{text}");
    let (s, v) = senden(reqwest::Method::POST, a, "api/aufgaben/1/durchlaeufe", json!({"phase": "x".repeat(41), "ergebnis": "bestanden"})).await;
    assert_eq!(s, 400, "41 Zeichen: {v}");
}

// ---- AK 16: Legacy-Probe gegen eine Kopie des JoinPuya-Ordners (von Hand, B1166) --------------------------------------

/// `R00223_KOPIE` = Kopie des JoinPuya-Board-Ordners (mit `.git`) in der eigenen Ablage, `R00223_ALT` = Programm vor der
/// Karte, `R00223_ABLAGE` = Ordner für Bewegungen und Aufgaben beider Läufe (für den Node-Teil von AK 16, Fieber-Tage),
/// `R00223_WER` = Kürzel eines Menschen im Ordner. Erst das alte,
/// dann dieses Programm auf je einer frischen Kopie: kein Commit beim Start und Lesen, keine defekte Datei, kein Log-Rest,
/// gleiche Zustände der Commit-Verweise; danach `PATCH titel` an einer Aufgabe mit `phases` und eine Bewegung.
#[tokio::test]
#[ignore = "Legacy-Probe von Hand: R00223_KOPIE, R00223_ALT, R00223_ABLAGE, R00223_WER"]
async fn ak16_legacy_probe_joinpuya_kopie() {
    let var = |n: &str| PathBuf::from(std::env::var(n).unwrap_or_else(|_| panic!("{n} fehlt")));
    let (kopie, alt, ablage) = (var("R00223_KOPIE"), var("R00223_ALT"), var("R00223_ABLAGE"));
    let wer = std::env::var("R00223_WER").expect("R00223_WER fehlt (Kürzel eines Menschen im Ordner)");
    let mut zustaende = vec![];
    for (lauf_name, programm) in [("alt", alt.as_path()), ("neu", Path::new(env!("CARGO_BIN_EXE_kanbanD")))] {
        let ordner = ablage.join(format!("jopu-{lauf_name}"));
        let _ = std::fs::remove_dir_all(&ordner);
        assert!(Command::new("cp").arg("-a").arg(&kopie).arg(&ordner).status().unwrap().success());
        let zaehlen = || git(&ordner, &["rev-list", "--count", "HEAD"]);
        let fieber_vorher = lies(&ordner, "berichte/joinpuya-fieber.md");
        let vorher = zaehlen();
        let lauf = Instanz::starten(programm, &ordner, ablage.join(format!("log-{lauf_name}.txt")));
        let a = lauf.adresse();
        for pfad in ["api/boards", "api/boards/joinpuya", "api/aufgaben", "api/einstellungen", "api/anwendungen", "api/zustand", "api/boards/joinpuya/fieber/cache"] {
            lesen(a, pfad).await;
        }
        let bew = lesen(a, "api/berichte/bewegungen?board=joinpuya").await;
        std::fs::write(ablage.join(format!("bewegungen-{lauf_name}.json")), bew.to_string()).unwrap();
        std::fs::write(ablage.join(format!("aufgaben-{lauf_name}.json")), lesen(a, "api/aufgaben").await.to_string()).unwrap();
        assert_eq!(zaehlen(), vorher, "{lauf_name}: kein Commit beim Start und Lesen");
        assert_eq!(lesen(a, "api/zustand").await["defekte"], json!([]), "{lauf_name}: keine defekte Datei");
        assert_eq!(lies(&ordner, "berichte/joinpuya-fieber.md"), fieber_vorher, "{lauf_name}: Fieber-Cache unverändert");
        let mut z = vec![];
        let aufgaben = lesen(a, "api/aufgaben").await;
        for aufgabe in aufgaben["aufgaben"].as_array().or(aufgaben.as_array()).unwrap() {
            for verweis in aufgabe["commits"].as_array().cloned().unwrap_or_default() {
                let nr = aufgabe["nummer"].as_u64().unwrap();
                let liste = lesen(a, &format!("api/aufgaben/{nr}/commits")).await;
                let e = liste["commits"].as_array().unwrap().iter().find(|e| e["verweis"] == verweis).cloned().unwrap();
                z.push(json!([verweis, e["zustand"]]));
            }
        }
        zustaende.push(z);
        assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new(), "{lauf_name}: keine Fehler- oder Warnzeile im Log");
        if lauf_name == "neu" {
            let mit_phases = git(&ordner, &["grep", "-l", "^phases:", "--", "aufgaben"]);
            let datei = mit_phases.lines().next().expect("eine Aufgabe mit phases");
            let nr: u32 = datei.trim_start_matches("aufgaben/").split('-').next().unwrap().parse().unwrap();
            let erwartet = phases_in(&lies(&ordner, datei));
            let (s, v) = gemeinsam::senden(reqwest::Method::PATCH, a, &format!("api/aufgaben/{nr}"), &wer, json!({"titel": format!("Probe {nr}")})).await;
            assert_eq!(s, 200, "{v}");
            assert_eq!(phases_in(&lies(&ordner, datei)), erwartet, "phases inhaltlich gleich");
            let b = lesen(a, "api/boards/joinpuya").await;
            let spalten = b["spalten"].as_array().unwrap();
            let (von, nach) = (spalten.iter().position(|s| !s["aufgaben"].as_array().unwrap().is_empty()).unwrap(), 0usize);
            let nummer = spalten[von]["aufgaben"][0].as_u64().unwrap();
            let ziel = spalten[if von == nach { 1 } else { nach }]["name"].as_str().unwrap();
            let (s, v) = gemeinsam::senden(reqwest::Method::POST, a, "api/boards/joinpuya/bewegen", &wer, json!({"nummer": nummer, "spalte": ziel})).await;
            assert_eq!(s, 200, "{v}");
            assert!(!git(&ordner, &["show", "HEAD:boards/joinpuya.md"]).contains("column-phases"), "column-phases fehlt im Commit der Bewegung");
        }
    }
    // leer wäre die Probe wahr, ohne etwas zu vergleichen (Lehre aus R00222 B1158): die Kopie trägt dafür Verweise
    assert!(!zustaende[0].is_empty(), "die Kopie trägt mindestens einen Commit-Verweis");
    eprintln!("Zustände der Verweise: {:?}", zustaende[1]);
    assert_eq!(zustaende[0], zustaende[1], "zustand jedes Verweises in beiden Läufen gleich");
}
