// R00253 (I0243, Karte #233): Diff je Commit — sehr große Commits über 10.000 Einträgen nur mit genauen Umbenennungen.
// Akzeptanztests gegen das echte Programm und ein echtes Arbeits-Repository (Ausgangslage P4 aus ADR-0032 N11.6).
// Schichten: Testfall (je AK) → Testsprache (`Lage`, `diff`, `datei_holen`) → Treiber (`holen`: URL, Header, Status) → Programm.
//
// erwartet rot (B1342): AK 5, 6, 7, 8 — der heutige Stand sucht in jedem Lauf voll (`-M50% -l1000`) und gibt keinen
// Hinweis; die Markierung fällt, sobald alle grün sind.
mod gemeinsam;

use gemeinsam::{git, git_am, starten_mit, Laufendes};
use serde_json::{Value, json};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const ADA: &str = "Ada Autorin";
const DATUM: &str = "2026-03-05T09:00:00+00:00";

// ---- Treiber ----------------------------------------------------------------------------------------------------------

/// Eine Antwort, wie sie über die Leitung kam.
struct Antwort {
    status: u16,
    etag: Option<String>,
    text: String,
}

impl Antwort {
    fn json(&self) -> Value {
        serde_json::from_str(&self.text).unwrap_or(Value::Null)
    }
}

/// `GET /api/aufgaben/1/diff?{abfrage}` mit `If-None-Match`, falls genannt.
async fn holen(adresse: &str, abfrage: &str, bekannt: Option<&str>) -> Antwort {
    let mut a = reqwest::Client::new().get(format!("{adresse}api/aufgaben/1/diff?{abfrage}"));
    if let Some(b) = bekannt {
        a = a.header("If-None-Match", b);
    }
    let r = a.send().await.unwrap();
    let etag = r.headers().get("etag").and_then(|w| w.to_str().ok()).map(str::to_string);
    let status = r.status().as_u16();
    let text = r.text().await.unwrap();
    Antwort { status, etag, text }
}

fn kodiert(text: &str) -> String {
    text.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-._~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect()
}

// ---- Testsprache: Ausgangslage P4 -------------------------------------------------------------------------------------

/// Der Commit K (ADR-0032 N11.6 P4): `a/gleich.txt → b/gleich.txt` unverändert, `a/r.txt` (5 Zeilen) → `b/s.txt`
/// (eine Zeile geändert), dazu `F` neue Dateien `z/<n>` mit je eigenem Inhalt. Ohne Umbenennungssuche hat K `4 + F`
/// Einträge. #1 trägt `kd:K`.
struct Lage {
    _tmp: tempfile::TempDir,
    r: PathBuf,
    board: PathBuf,
    k: String,
}

/// Ein `git fast-import`-Strom aus `stdin` (wie die Erzeuger der Proben).
fn fast_import(r: &Path, strom: &[u8]) {
    let mut kind = Command::new("git").arg("-C").arg(r).args(["fast-import", "--quiet"]).stdin(Stdio::piped()).spawn().unwrap();
    kind.stdin.take().unwrap().write_all(strom).unwrap();
    assert!(kind.wait().unwrap().success(), "fast-import");
}

fn ausgangslage(f: usize) -> Lage {
    let tmp = tempfile::tempdir().unwrap();
    let basis = tmp.path().canonicalize().unwrap();
    let (r, board) = (basis.join("R"), basis.join("board"));
    std::fs::create_dir_all(r.join("Dokumentation/Planung")).unwrap();
    std::fs::write(r.join("Dokumentation/Planung/app.md"), "# App\n").unwrap();
    git_am(&r, ADA, DATUM, &["init", "-q", "-b", "main"]);
    std::fs::create_dir_all(r.join("a")).unwrap();
    std::fs::write(r.join("a/gleich.txt"), "g\n").unwrap();
    std::fs::write(r.join("a/r.txt"), "1\n2\n3\n4\n5\n").unwrap();
    git_am(&r, ADA, DATUM, &["add", "-A"]);
    git_am(&r, ADA, DATUM, &["commit", "-q", "-m", "A0"]);
    let mut strom = String::from("commit refs/heads/main\ncommitter Ada Autorin <ada@example.org> 1780000000 +0000\ndata 1\nK\nfrom refs/heads/main^0\ndeleteall\n");
    for (pfad, inhalt) in [("Dokumentation/Planung/app.md", "# App\n"), ("b/gleich.txt", "g\n"), ("b/s.txt", "1\n2\n3\n4\nX\n")] {
        strom.push_str(&format!("M 100644 inline {pfad}\ndata {}\n{inhalt}", inhalt.len()));
    }
    for i in 0..f {
        let inhalt = format!("z{i}\n");
        strom.push_str(&format!("M 100644 inline z/{i:06}\ndata {}\n{inhalt}", inhalt.len()));
    }
    fast_import(&r, strom.as_bytes());
    git_am(&r, ADA, DATUM, &["reset", "-q", "--hard"]);
    let k = git_am(&r, ADA, DATUM, &["rev-parse", "refs/heads/main"]);
    std::fs::create_dir_all(board.join("aufgaben")).unwrap();
    std::fs::create_dir_all(board.join("boards")).unwrap();
    std::fs::write(board.join("kanbanD.md"), format!("---\npeople:\n  entw1: {{name: E, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Dokumentation/Planung/app.md, requirements: \"\"}}\n---\n", r.display())).unwrap();
    std::fs::write(board.join("aufgaben/0001-r00253.md"), format!("---\nid: 1\ntitle: R00253\ncommits:\n  - kd:{k}\n---\n")).unwrap();
    std::fs::write(board.join("boards/fabrik.md"), "# fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-r00253.md)\n").unwrap();
    git(&board, &["init", "-q"]);
    git(&board, &["add", "-A"]);
    git(&board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "fabrik"]);
    Lage { _tmp: tmp, r, board, k }
}

impl Lage {
    fn starten(&self) -> Laufendes {
        starten_mit(&self.board, &["--port", "0"], &[])
    }

    /// Mit Git-Spur: der Server schreibt `GIT_TRACE` in eine Datei.
    fn mit_spur(&self) -> (Laufendes, PathBuf) {
        let spur = self.r.parent().unwrap().join("spur");
        let pfad = spur.to_str().unwrap().to_string();
        (starten_mit(&self.board, &["--port", "0"], &[("GIT_TRACE", &pfad)]), spur)
    }
}

/// `GET …/diff?commit=kd:<hash>` mit Status 200; liefert den Rumpf.
async fn diff(adresse: &str, hash: &str) -> Value {
    let a = holen(adresse, &format!("commit=kd:{hash}"), None).await;
    assert_eq!(a.status, 200, "{}", a.text);
    a.json()
}

/// `GET …/diff?commit=kd:<hash>&datei=<name>` mit Status 200.
async fn datei_holen(adresse: &str, hash: &str, name: &str) -> Value {
    let a = holen(adresse, &format!("commit=kd:{hash}&datei={}", kodiert(name)), None).await;
    assert_eq!(a.status, 200, "{name}: {}", a.text);
    a.json()
}

fn dateien(d: &Value) -> &Vec<Value> {
    d["dateien"].as_array().unwrap()
}

fn datei<'a>(d: &'a Value, name: &str) -> &'a Value {
    dateien(d).iter().find(|f| f["neu"] == name || (f["neu"].is_null() && f["alt"] == name)).unwrap_or_else(|| panic!("{name} fehlt: {d}"))
}

fn hat_hinweis(d: &Value, art: &str) -> bool {
    d["hinweise"].as_array().is_some_and(|h| h.iter().any(|x| x["art"] == art))
}

/// Die `log`- und `diff-tree`-Läufe des Startorts aus der Git-Spur.
fn laeufe(datei: &Path) -> Vec<String> {
    std::fs::read_to_string(datei).unwrap_or_default().lines().filter(|z| z.contains("trace: built-in: git log") || z.contains("trace: built-in: git diff-tree")).map(|z| z.split("trace: built-in: ").nth(1).unwrap().to_string()).collect()
}

fn spur_leeren(datei: &Path) {
    let _ = std::fs::write(datei, "");
}

/// Der Zähllauf (ADR-0032 N11.3 Punkt 1): `log` mit `--name-only` und `--no-renames` — er sucht keine Umbenennungen
/// und trägt deshalb keinen Umbenennungsschalter.
/// Eine Befehlszeile für die Fehlermeldung (die Pfadangabe kann zehntausende Zeichen tragen).
fn kurz(z: &str) -> &str {
    &z[..z.len().min(200)]
}

fn ist_zaehllauf(z: &str) -> bool {
    z.contains("git log") && z.contains("--name-only") && z.contains("--no-renames")
}

// ---- AK 4 (P4, Fall 10.000): genau auf der Schwelle sucht der Diff Umbenennungen wie bisher ---------------------------

#[tokio::test]
async fn ak04_fall_10000_umbenennungen_wie_bisher() {
    let l = ausgangslage(9_996);
    let lauf = l.starten();
    let d = diff(&lauf.adresse, &l.k).await;
    assert_eq!(d["commits"][0]["dateien"], json!(9_998), "zwei Paare zählen je als eine Datei: 10.000 − 2");
    assert!(!hat_hinweis(&d, "umbenennung_eingeschraenkt"), "{}", d["hinweise"]);
    let s = datei_holen(&lauf.adresse, &l.k, "b/s.txt").await;
    let f = datei(&s, "b/s.txt");
    assert_eq!((&f["status"], &f["alt"]), (&json!("R"), &json!("a/r.txt")));
    assert!(f["aehnlichkeit"].as_u64().unwrap_or(0) >= 50, "{f}");
    let g = datei_holen(&lauf.adresse, &l.k, "b/gleich.txt").await;
    let f = datei(&g, "b/gleich.txt");
    assert_eq!((&f["status"], &f["aehnlichkeit"]), (&json!("R"), &json!(100)), "{f}");
}

// ---- AK 5 (P4, Fall 10.001): umbenannt und geändert erscheint als gelöscht und neu --------------------------------

#[tokio::test]
async fn ak05_fall_10001_nur_genaue_umbenennungen() {
    let l = ausgangslage(9_997);
    let lauf = l.starten();
    let d = diff(&lauf.adresse, &l.k).await;
    assert_eq!(d["commits"][0]["dateien"], json!(10_000), "nur das unveränderte Paar zählt als eine: 10.001 − 1");
    assert_eq!(d["hinweise"][0], json!({"art": "umbenennung_eingeschraenkt", "dateien": 10_001, "schwelle": 10_000}), "{}", d["hinweise"]);
    // b/s.txt steht als A (auch über datei=b/s.txt), a/r.txt als D (auch über datei=a/r.txt), beide vollständig
    let s = datei_holen(&lauf.adresse, &l.k, "b/s.txt").await;
    let f = datei(&s, "b/s.txt");
    assert_eq!((&f["status"], &f["alt"], &f["plus"]), (&json!("A"), &Value::Null, &json!(5)), "{f}");
    assert!(f["patch"].as_str().unwrap_or_default().contains("+X"), "{f}");
    let r = datei_holen(&lauf.adresse, &l.k, "a/r.txt").await;
    let f = datei(&r, "a/r.txt");
    assert_eq!((&f["status"], &f["neu"], &f["minus"]), (&json!("D"), &Value::Null, &json!(5)), "{f}");
    assert!(f["patch"].as_str().unwrap_or_default().contains("-5"), "{f}");
    // der Hinweis steht auch bei datei=, an erster Stelle
    assert_eq!(s["hinweise"][0], json!({"art": "umbenennung_eingeschraenkt", "dateien": 10_001, "schwelle": 10_000}), "{}", s["hinweise"]);
    assert_eq!(r["hinweise"][0], json!({"art": "umbenennung_eingeschraenkt", "dateien": 10_001, "schwelle": 10_000}), "{}", r["hinweise"]);
    // b/gleich.txt bleibt R mit 100
    let g = datei_holen(&lauf.adresse, &l.k, "b/gleich.txt").await;
    let f = datei(&g, "b/gleich.txt");
    assert_eq!((&f["status"], &f["aehnlichkeit"]), (&json!("R"), &json!(100)), "{f}");
    // format=patch zeigt deleted file für a/r.txt und new file für b/s.txt
    let p = holen(&lauf.adresse, &format!("commit=kd:{}&format=patch", l.k), None).await;
    assert_eq!(p.status, 200);
    let (vor, nach) = (p.text.find("diff --git a/a/r.txt b/a/r.txt").expect("a/r.txt im Patch"), p.text.find("diff --git a/b/s.txt b/b/s.txt").expect("b/s.txt im Patch"));
    assert!(p.text[vor..nach].contains("deleted file"), "{}", &p.text[vor..nach]);
    assert!(p.text[nach..].contains("new file"), "{}", &p.text[nach..nach + 400]);
}

// ---- AK 6 (P4, beide Fälle): die Commit-Liste der Karte zählt nach demselben Urteil --------------------------------

#[tokio::test]
async fn ak06_liste_und_diff_zahlen_gleich() {
    for (f, erwartet) in [(9_996usize, 9_998u64), (9_997, 10_000)] {
        let l = ausgangslage(f);
        let lauf = l.starten();
        let d = diff(&lauf.adresse, &l.k).await;
        assert_eq!(d["commits"][0]["dateien"], json!(erwartet), "F={f}");
        let liste: Value = reqwest::get(format!("{}api/aufgaben/1/commits", lauf.adresse)).await.unwrap().json().await.unwrap();
        let e = liste["commits"].as_array().unwrap().iter().find(|e| e["hash"] == d["commits"][0]["hash"]).unwrap_or_else(|| panic!("F={f}: Commit fehlt in der Liste"));
        for feld in ["plus", "minus", "dateien"] {
            assert_eq!(e[feld], d["commits"][0][feld], "F={f}: {feld}");
        }
    }
}

// ---- AK 7 (P5): ein Urteil je Commit, die Befehlszeilen über `GIT_TRACE` -------------------------------------------

#[tokio::test]
async fn ak07_ein_urteil_je_commit_in_den_befehlszeilen() {
    // Fall 10.001: Liste, datei= und format=patch tragen `-M100%` und keiner `-M50%` oder `-l1000`
    let l = ausgangslage(9_997);
    let (lauf, spur) = l.mit_spur();
    spur_leeren(&spur);
    for abfrage in [format!("commit=kd:{}", l.k), format!("commit=kd:{}&datei=b/s.txt", l.k), format!("commit=kd:{}&format=patch", l.k)] {
        assert_eq!(holen(&lauf.adresse, &abfrage, None).await.status, 200, "{abfrage}");
    }
    let gelesen = laeufe(&spur);
    assert!(gelesen.iter().any(|z| z.contains("diff-tree")), "{gelesen:?}");
    assert!(gelesen.iter().any(|z| z.contains("-M100%")), "{gelesen:?}");
    for z in &gelesen {
        assert!(!z.contains("-M50%"), "Fall 10.001: {}", kurz(z));
        assert!(!z.contains("-l1000"), "Fall 10.001: {}", kurz(z));
        assert!(z.contains("-M100%") || ist_zaehllauf(z), "Fall 10.001: {}", kurz(z));
    }
    // ein Gesamt-Diff über den Fall 10.001 startet `diff-tree` nur mit `-M50% -l1000` (der Körper bleibt vollständig)
    spur_leeren(&spur);
    assert_eq!(holen(&lauf.adresse, "", None).await.status, 200);
    let dt: Vec<String> = laeufe(&spur).into_iter().filter(|z| z.contains("diff-tree")).collect();
    assert!(!dt.is_empty(), "Gesamt-Diff ohne diff-tree");
    for z in &dt {
        assert!(z.contains("-M50%") && z.contains("-l1000"), "Gesamt-Diff: {}", kurz(z));
    }
    // Fall 10.000: alle Läufe mit `-M50% -l1000` bzw. `-M -l1000`, keiner mit `-M100%`
    let l = ausgangslage(9_996);
    let (lauf, spur) = l.mit_spur();
    spur_leeren(&spur);
    for abfrage in [format!("commit=kd:{}", l.k), format!("commit=kd:{}&datei=b/s.txt", l.k), format!("commit=kd:{}&format=patch", l.k)] {
        assert_eq!(holen(&lauf.adresse, &abfrage, None).await.status, 200, "{abfrage}");
    }
    let gelesen = laeufe(&spur);
    assert!(!gelesen.is_empty());
    for z in &gelesen {
        assert!(!z.contains("-M100%"), "Fall 10.000: {}", kurz(z));
        assert!(z.contains("-l1000") || ist_zaehllauf(z), "Fall 10.000: {}", kurz(z));
        assert!(z.contains("-M50%") || z.contains("-M ") || ist_zaehllauf(z), "Fall 10.000: {}", kurz(z));
    }
}

// ---- AK 8 (P7): ein alter `ETag` gibt nicht die alte Form zurück ----------------------------------------------------

/// Der `ETag` des Diffs eines Commits nach der Formel vor der Karte (`GRENZEN_VERSION` 1) — FNV-1a über Verweis,
/// Startordner, `datei`, `format` und die Version, wie `diff.rs::etag`.
fn etag_vorgaenger(verweis: &str, start: &Path, datei: Option<&str>, format: &str) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    let version = 1u32.to_be_bytes();
    let teile: [&[u8]; 9] = [verweis.as_bytes(), b"\0", start.as_os_str().as_encoded_bytes(), b"\0", datei.unwrap_or("\u{1}").as_bytes(), b"\0", format.as_bytes(), b"\0", &version];
    for b in teile.iter().flat_map(|t| t.iter()) {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("\"diff-{h:016x}\"")
}

#[tokio::test]
async fn ak08_alter_etag_ergibt_kein_304() {
    let l = ausgangslage(9_997);
    let lauf = l.starten();
    let a = holen(&lauf.adresse, &format!("commit=kd:{}", l.k), None).await;
    assert_eq!(a.status, 200);
    let eigen = a.etag.clone().expect("ETag");
    // Gegenprobe: der eigene ETag ergibt 304 — der Mechanismus wirkt
    assert_eq!(holen(&lauf.adresse, &format!("commit=kd:{}", l.k), Some(&eigen)).await.status, 304, "eigener ETag");
    let start = l.r.join("Dokumentation/Planung");
    let alt = etag_vorgaenger(&format!("kd:{}", l.k), &start, None, "json");
    assert_eq!(holen(&lauf.adresse, &format!("commit=kd:{}", l.k), Some(&alt)).await.status, 200, "alter ETag {alt} gibt nicht die alte Form zurück");
}
