// R00208 (I0198, Karte #214): Gesamt-Diff der Karte per API lesen — Akzeptanztests gegen das echte Programm und ein
// echtes Arbeits-Repository (Ausgangslage von R00208, siehe `ausgangslage`). Schichten: Testfall (je AK) → Testsprache
// (`Lage`, `gesamt`, `nie_fremd`) → Treiber (`holen`: URL, Header, Status) → Programm.
mod gemeinsam;

use gemeinsam::{LANGSAM_D, Laufendes, UNTERWEGS_HOECHSTENS, gestaffelt, git, git_am, langsames_git, lies, rest_lesen, starten_mit};
use serde_json::{Value, json};
use std::cell::Cell;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

// ---- Treiber ----------------------------------------------------------------------------------------------------------

/// Eine Antwort, wie sie über die Leitung kam.
struct Antwort {
    status: u16,
    art: String,
    #[allow(dead_code)]
    etag: Option<String>,
    nosniff: bool,
    text: String,
}

impl Antwort {
    fn json(&self) -> Value {
        serde_json::from_str(&self.text).unwrap_or(Value::Null)
    }
}

/// `GET /api/aufgaben/{nr}/diff?{abfrage}` mit `If-None-Match`, falls genannt.
async fn holen(adresse: &str, nr: u32, abfrage: &str, bekannt: Option<&str>) -> Antwort {
    let mut a = reqwest::Client::new().get(format!("{adresse}api/aufgaben/{nr}/diff?{abfrage}"));
    if let Some(b) = bekannt {
        a = a.header("If-None-Match", b);
    }
    let r = a.send().await.unwrap();
    let kopf = |n: &str| r.headers().get(n).and_then(|w| w.to_str().ok()).map(str::to_string);
    let (status, art, etag, nosniff) = (r.status().as_u16(), kopf("content-type").unwrap_or_default(), kopf("etag"), kopf("x-content-type-options").as_deref() == Some("nosniff"));
    let bytes = r.bytes().await.unwrap();
    Antwort { status, art, etag, nosniff, text: String::from_utf8(bytes.to_vec()).expect("gültiges UTF-8") }
}

fn kodiert(text: &str) -> String {
    text.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-._~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect()
}

// ---- Testsprache: Ausgangslage ----------------------------------------------------------------------------------------

/// Ausgangslage von R00208: auf `main` von R A0 (a.txt z1…z12, r.txt r1…r10), K1, F, K2 (#2), L1, L2 (#3).
struct Lage {
    _tmp: tempfile::TempDir,
    basis: PathBuf,
    r: PathBuf,
    board: PathBuf,
    takt: Cell<u32>,
    karten: std::cell::RefCell<Vec<(u32, Vec<String>)>>,
    a0: String,
    k1: String,
    f: String,
    k2: String,
    l1: String,
    l2: String,
}

fn zeilen(prefix: &str, n: usize) -> String {
    (1..=n).map(|i| format!("{prefix}{i}\n")).collect()
}

impl Lage {
    /// Ein festes, je Commit steigendes Datum (die Folge „ganz als Folge“ ordnet nach dem Datum).
    fn datum(&self) -> String {
        let n = self.takt.get() + 1;
        self.takt.set(n);
        format!("2026-04-{:02}T{:02}:{:02}:00+00:00", 1 + n / 1440, (n / 60) % 24, n % 60)
    }

    fn git(&self, args: &[&str]) -> String {
        git_am(&self.r, "Ada", &self.datum(), args)
    }

    fn schreiben(&self, datei: &str, inhalt: &str) {
        std::fs::write(self.r.join(datei), inhalt).unwrap();
    }

    /// Wie `schreiben`, legt fehlende Ordner an.
    fn schreiben_in(&self, datei: &str, inhalt: &str) {
        std::fs::create_dir_all(self.r.join(datei).parent().unwrap()).unwrap();
        self.schreiben(datei, inhalt);
    }

    /// Ersetzt Zeile `nr` (ab 1) von `datei`.
    fn zeile(&self, datei: &str, nr: usize, text: &str) {
        let alt = std::fs::read_to_string(self.r.join(datei)).unwrap();
        let neu: String = alt.lines().enumerate().map(|(i, z)| if i + 1 == nr { format!("{text}\n") } else { format!("{z}\n") }).collect();
        self.schreiben(datei, &neu);
    }

    /// Ein Commit mit allem, was im Arbeitsbaum liegt.
    fn commit(&self, nachricht: &str) -> String {
        let d = self.datum();
        git_am(&self.r, "Ada", &d, &["add", "-A"]);
        git_am(&self.r, "Ada", &d, &["commit", "-q", "--allow-empty", "-m", nachricht]);
        git_am(&self.r, "Ada", &d, &["rev-parse", "HEAD"])
    }

    /// Legt Karte `nr` mit diesen Verweisen an (von Hand, ohne kanbanD) oder ersetzt ihre Verweise.
    fn karte(&self, nr: u32, verweise: &[String]) {
        let mut karten = self.karten.borrow_mut();
        karten.retain(|(n, _)| *n != nr);
        karten.push((nr, verweise.to_vec()));
        karten.sort();
        for (n, v) in karten.iter() {
            let liste: String = v.iter().map(|x| format!("  - {}\n", serde_json::to_string(x).unwrap())).collect();
            let commits = if v.is_empty() { String::new() } else { format!("commits:\n{liste}") };
            std::fs::write(self.board.join(format!("aufgaben/{n:04}-k.md")), format!("---\nid: {n}\ntitle: Karte {n}\n{commits}---\n")).unwrap();
        }
        let liste: String = karten.iter().map(|(n, _)| format!("- [#{n}](../aufgaben/{n:04}-k.md)\n")).collect();
        std::fs::write(self.board.join("boards/fabrik.md"), format!("# fabrik\n\n## Entwicklung\n\n{liste}")).unwrap();
        git(&self.board, &["add", "-A"]);
        git(&self.board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Karte"]);
    }

    fn starten(&self, umgebung: &[(&str, &str)]) -> Laufendes {
        starten_mit(&self.board, &["--port", "0", "--host", "127.0.0.1"], umgebung)
    }

    /// Mit Git-Spur: der Server schreibt `GIT_TRACE` in eine Datei.
    fn mit_spur(&self) -> (Laufendes, PathBuf) {
        let spur = self.basis.join("spur");
        let pfad = spur.to_str().unwrap().to_string();
        (self.starten(&[("GIT_TRACE", &pfad)]), spur)
    }

    fn board_zahl(&self) -> String {
        git(&self.board, &["rev-list", "--count", "HEAD"])
    }
}

fn kd(h: &str) -> String {
    format!("kd:{h}")
}

fn ausgangslage() -> Lage {
    let tmp = tempfile::tempdir().unwrap();
    let basis = tmp.path().canonicalize().unwrap();
    let (r, board) = (basis.join("R"), basis.join("board"));
    std::fs::create_dir_all(r.join("Dokumentation/Planung")).unwrap();
    std::fs::write(r.join("Dokumentation/Planung/app.md"), "# App\n").unwrap();
    let mut l = Lage { _tmp: tmp, basis, r, board, takt: Cell::new(0), karten: Default::default(), a0: String::new(), k1: String::new(), f: String::new(), k2: String::new(), l1: String::new(), l2: String::new() };
    l.git(&["init", "-q", "-b", "main"]);
    l.schreiben("a.txt", &zeilen("z", 12));
    l.schreiben("r.txt", &zeilen("r", 10));
    l.a0 = l.commit("A0");
    l.zeile("a.txt", 2, "K1");
    l.schreiben("k.txt", "k1\nk2\n");
    l.k1 = l.commit("K1");
    l.zeile("a.txt", 6, "FREMD-6");
    l.schreiben("f.txt", "FREMD-f\n");
    l.f = l.commit("F");
    l.zeile("a.txt", 11, "K2");
    l.schreiben("k.txt", "k1\nk2\nk3\n");
    l.k2 = l.commit("K2");
    l.schreiben("l.txt", "l1\nl2\nl3\n");
    l.l1 = l.commit("L1");
    l.zeile("l.txt", 2, "L2");
    std::fs::write(l.r.join("bild2.bin"), [0u8, 1, 2, 0, 255]).unwrap();
    l.l2 = l.commit("L2");
    std::fs::create_dir_all(l.board.join("aufgaben")).unwrap();
    std::fs::create_dir_all(l.board.join("boards")).unwrap();
    std::fs::write(l.board.join("kanbanD.md"), format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\n  entw1: {{name: Entwickler, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Dokumentation/Planung/app.md, requirements: \"\"}}\n---\n", l.r.display())).unwrap();
    git(&l.board, &["init", "-q"]);
    l.karte(2, &[kd(&l.k1), kd(&l.k2)]);
    l.karte(3, &[kd(&l.l1), kd(&l.l2)]);
    l
}

// ---- Testsprache: Proben ----------------------------------------------------------------------------------------------

fn dateien(d: &Value) -> &Vec<Value> {
    d["dateien"].as_array().unwrap_or_else(|| panic!("keine dateien: {d}"))
}

/// Der Eintrag mit diesem Namen (netto `neu`, bei gelöschten `alt`; Folge `pfad`).
fn eintrag<'a>(d: &'a Value, name: &str) -> &'a Value {
    dateien(d).iter().find(|f| f["pfad"] == name || f["neu"] == name || (f["neu"].is_null() && f["pfad"].is_null() && f["alt"] == name)).unwrap_or_else(|| panic!("{name} fehlt: {d}"))
}

fn namen(d: &Value) -> Vec<String> {
    dateien(d).iter().map(|f| f["pfad"].as_str().or(f["neu"].as_str()).or(f["alt"].as_str()).unwrap().to_string()).collect()
}

fn ist_folge(f: &Value) -> bool {
    f["schritte"].is_array()
}

/// Probe „nie fremd“ (PO Z. 426): keine Zeile, die mit `+` oder `-` beginnt und `FREMD` enthält, in irgendeinem `patch`
/// der JSON-Antwort und im `format=patch`-Text; `plus`/`minus` jedes Folge-Eintrags gleich der Summe seiner Schritte.
fn nie_fremd(d: &Value, text: &str) {
    let fremd = |p: &str| p.lines().filter(|z| (z.starts_with('+') || z.starts_with('-')) && z.contains("FREMD")).map(String::from).collect::<Vec<_>>();
    for f in dateien(d) {
        let patches: Vec<&str> = if ist_folge(f) { f["schritte"].as_array().unwrap().iter().filter_map(|s| s["patch"].as_str()).collect() } else { f["patch"].as_str().into_iter().collect() };
        for p in patches {
            assert_eq!(fremd(p), Vec::<String>::new(), "fremde Zeile im patch von {f}");
        }
        if ist_folge(f) {
            let summe = |feld: &str| f["schritte"].as_array().unwrap().iter().map(|s| s[feld].as_u64().unwrap()).sum::<u64>();
            assert_eq!((f["plus"].as_u64(), f["minus"].as_u64()), (Some(summe("plus")), Some(summe("minus"))), "Summe der Schritte: {f}");
        }
    }
    assert_eq!(fremd(text), Vec::<String>::new(), "fremde Zeile im format=patch-Text");
}

/// JSON und Text des Gesamt-Diffs einer Karte mit Status 200, Probe „nie fremd“ über beide.
async fn gesamt(adresse: &str, nr: u32, abfrage: &str) -> (Value, String) {
    let a = holen(adresse, nr, abfrage, None).await;
    assert_eq!(a.status, 200, "#{nr}?{abfrage}: {}", a.text);
    assert!(a.art.starts_with("application/json") && a.nosniff, "{} {}", a.art, a.nosniff);
    let trenner = if abfrage.is_empty() { "" } else { "&" };
    let t = holen(adresse, nr, &format!("{abfrage}{trenner}format=patch"), None).await;
    assert_eq!(t.status, 200, "#{nr} format=patch: {}", t.text);
    let d = a.json();
    nie_fremd(&d, &t.text);
    (d, t.text)
}

fn git_diff(r: &Path, basis: &str, letzter: &str) -> String {
    git(r, &["diff", "--full-index", "-M50%", "-l1000", "--submodule=short", basis, letzter]) + "\n"
}

/// Die Läufe des Startorts im Arbeits-Repository aus der Git-Spur.
fn spur(datei: &Path) -> Vec<String> {
    std::fs::read_to_string(datei).unwrap_or_default().lines().filter(|z| z.contains("trace: built-in: git") && z.contains("core.hooksPath=/dev/null")).map(String::from).collect()
}

fn spur_leeren(datei: &Path) {
    let _ = std::fs::write(datei, "");
}

// ---- AK 1: Folge, netto und verwaister Zwilling (Abnahme-Probe der Karte) · US-1 ---------------------------------------

#[tokio::test]
async fn ak01_folge_netto_und_verwaister_zwilling() {
    let l = ausgangslage();
    let lauf = l.starten(&[]);
    let (d, text) = gesamt(&lauf.adresse, 2, "").await;
    assert_eq!(d["anwendung"], "kd");
    assert_eq!(d["spanne"], json!({"basis": l.a0, "letzter": l.k2}));
    assert_eq!(namen(&d), ["a.txt", "k.txt"], "f.txt fehlt");
    let a = eintrag(&d, "a.txt");
    assert!(ist_folge(a), "{a}");
    assert_eq!((&a["plus"], &a["minus"], &a["binaer"]), (&json!(2), &json!(2), &json!(false)));
    let schritte = a["schritte"].as_array().unwrap();
    assert_eq!(schritte.iter().map(|s| (s["commit"].as_str().unwrap().to_string(), s["plus"].as_u64().unwrap(), s["minus"].as_u64().unwrap(), s["status"].as_str().unwrap().to_string())).collect::<Vec<_>>(), [(kd(&l.k1), 1, 1, "M".to_string()), (kd(&l.k2), 1, 1, "M".to_string())]);
    assert!(schritte[0]["patch"].as_str().unwrap().contains("-z2\n+K1\n") && schritte[1]["patch"].as_str().unwrap().contains("-z11\n+K2\n"), "{a}");
    assert_eq!(eintrag(&d, "k.txt"), &json!({"neu": "k.txt", "status": "A", "plus": 3, "minus": 0, "binaer": false, "gross": false, "nachladen": false, "nicht_utf8": false, "patch": "@@ -0,0 +1,3 @@\n+k1\n+k2\n+k3\n"}));
    assert_eq!(d["hinweise"], json!([{"art": "fremd_dazwischen", "commits": 1, "dateien": 1}]));
    assert_eq!(d["commits"].as_array().unwrap().iter().map(|c| c["verweis"].as_str().unwrap().to_string()).collect::<Vec<_>>(), [kd(&l.k1), kd(&l.k2)]);
    assert!(text.starts_with("# kanbanD: fremd_dazwischen"), "{text}");

    // ohne fremden Commit: bytegleich zu git diff, nur Netto-Einträge
    let (d3, text3) = gesamt(&lauf.adresse, 3, "").await;
    let l1_eltern = git(&l.r, &["rev-parse", &format!("{}^", l.l1)]);
    assert_eq!(text3, git_diff(&l.r, &format!("{}^", l.l1), &l.l2), "bytegleich zu git diff");
    assert_eq!(d3["spanne"], json!({"basis": l1_eltern, "letzter": l.l2}));
    assert_eq!(d3["hinweise"], json!([]));
    assert!(dateien(&d3).iter().all(|f| !ist_folge(f)) && namen(&d3) == ["bild2.bin", "l.txt"], "{d3}");

    // verwaister Zwilling K1' (derselbe Inhalt wie K1, vor einem Rebase, auf keinem Zweig)
    l.git(&["checkout", "-q", "--detach", &l.a0]);
    l.git(&["cherry-pick", &l.k1]);
    let k1_ = l.git(&["rev-parse", "HEAD"]);
    l.git(&["checkout", "-q", "main"]);
    assert_ne!(k1_, l.k1);
    l.karte(2, &[kd(&l.k1), kd(&l.k2), kd(&k1_)]);
    let (zwilling, _) = gesamt(&lauf.adresse, 2, "").await;
    for feld in ["spanne", "commits", "dateien"] {
        assert_eq!(zwilling[feld], d[feld], "{feld} unverändert");
    }
    assert_eq!(zwilling["hinweise"].as_array().unwrap().last(), Some(&json!({"art": "verwaist", "verweis": kd(&k1_)})));
}

// ---- AK 2: Umbenennung über einen fremden Commit · US-1 ----------------------------------------------------------------

/// #4: R1 (r.txt Zeile 1), fremd FR (Zeile 5 FREMD-R), R2 (r.txt → s.txt, Zeile 10).
fn mit_umbenennung(l: &Lage) -> (String, String) {
    l.zeile("r.txt", 1, "R1");
    let r1 = l.commit("R1");
    l.zeile("r.txt", 5, "FREMD-R");
    l.commit("FR");
    l.git(&["mv", "r.txt", "s.txt"]);
    l.zeile("s.txt", 10, "R2");
    let r2 = l.commit("R2");
    l.karte(4, &[kd(&r1), kd(&r2)]);
    (r1, r2)
}

// Mutant „Pfadangabe des Netto-Laufs nur Netto-Pfade“ (ADR-0032 N6 Durchsetzung 2) macht diesen Test rot
#[tokio::test]
async fn ak02_umbenennung_ueber_fremden_commit() {
    let l = ausgangslage();
    let (r1, r2) = mit_umbenennung(&l);
    let lauf = l.starten(&[]);
    let (d, _) = gesamt(&lauf.adresse, 4, "").await;
    assert!(dateien(&d).iter().all(ist_folge), "nur Folge-Einträge: {d}");
    assert_eq!(namen(&d), ["r.txt", "s.txt"]);
    assert_eq!(eintrag(&d, "r.txt")["schritte"][0]["commit"], json!(kd(&r1)));
    let s = &eintrag(&d, "s.txt")["schritte"];
    assert_eq!((&s[0]["commit"], &s[0]["status"], &s[0]["alt"], &s[0]["neu"]), (&json!(kd(&r2)), &json!("R"), &json!("r.txt"), &json!("s.txt")));
}

// ---- AK 3: Merges · US-2 -----------------------------------------------------------------------------------------------

/// Ein Seitenzweig ab HEAD, der `datei` mit `inhalt` schreibt, mit `--no-ff` auf main gemergt; liefert den Merge.
fn seitenmerge(l: &Lage, zweig: &str, datei: &str, inhalt: impl Fn(&Lage)) -> String {
    l.git(&["checkout", "-q", "-b", zweig]);
    inhalt(l);
    l.commit(&format!("{zweig}: {datei}"));
    l.git(&["checkout", "-q", "main"]);
    l.git(&["merge", "-q", "--no-ff", "-m", &format!("Merge {zweig}"), zweig]);
    l.git(&["rev-parse", "HEAD"])
}

// Mutant „Merge ohne Elternzeile im Namenslauf“ (ADR-0032 N6 Durchsetzung 3) macht diesen Test rot
#[tokio::test]
async fn ak03_fremder_merge_in_der_spanne() {
    let l = ausgangslage();
    l.schreiben("m.txt", &zeilen("m", 20));
    l.commit("m.txt");
    l.zeile("m.txt", 1, "M1");
    let m1 = l.commit("M1");
    seitenmerge(&l, "seite-m", "m.txt", |l| l.zeile("m.txt", 10, "FREMD-M"));
    l.zeile("m.txt", 20, "M2");
    let m2 = l.commit("M2");
    l.karte(5, &[kd(&m1), kd(&m2)]);
    let lauf = l.starten(&[]);
    let (d, _) = gesamt(&lauf.adresse, 5, "").await;
    let m = eintrag(&d, "m.txt");
    assert!(ist_folge(m), "{d}");
    assert_eq!(m["schritte"].as_array().unwrap().iter().map(|s| s["commit"].clone()).collect::<Vec<_>>(), [json!(kd(&m1)), json!(kd(&m2))]);
    assert_eq!(d["hinweise"], json!([{"art": "fremd_dazwischen", "commits": 1, "dateien": 1}]));
}

#[tokio::test]
async fn ak03_merge_an_der_karte() {
    let l = ausgangslage();
    l.schreiben("n.txt", &zeilen("n", 5));
    l.commit("n.txt");
    l.zeile("n.txt", 1, "N1");
    let n1 = l.commit("N1");
    let mk = seitenmerge(&l, "seite-y", "y.txt", |l| l.schreiben("y.txt", "FREMD-Y\n"));
    l.zeile("n.txt", 5, "N2");
    let n2 = l.commit("N2");
    l.karte(6, &[kd(&n1), kd(&mk), kd(&n2)]);
    let lauf = l.starten(&[]);
    let (d, text) = gesamt(&lauf.adresse, 6, "").await;
    assert_eq!(d["commits"].as_array().unwrap().iter().map(|c| c["verweis"].clone()).collect::<Vec<_>>(), [json!(kd(&n1)), json!(kd(&n2))]);
    assert!(d["hinweise"].as_array().unwrap().contains(&json!({"art": "merge_ausgelassen", "verweis": kd(&mk)})), "{d}");
    assert!(!d.to_string().contains("y.txt") && !text.contains("y.txt"), "y.txt steht nirgends: {d}");
    let einzeln = holen(&lauf.adresse, 6, &format!("commit={}", kodiert(&kd(&mk))), None).await;
    assert_eq!(einzeln.status, 200);
    assert!(einzeln.json()["dateien"].as_array().unwrap().iter().any(|f| f["neu"] == "y.txt"), "R00206 unverändert");
}

// ---- AK 4: ganz als Folge, nie netto · US-3 ----------------------------------------------------------------------------

fn nie_netto(d: &Value) {
    assert!(!dateien(d).is_empty() && dateien(d).iter().all(ist_folge), "kein Netto-Eintrag: {d}");
    assert_eq!(d["spanne"], Value::Null);
}

#[tokio::test]
async fn ak04_nicht_linear() {
    let l = ausgangslage();
    let vorher = l.git(&["rev-parse", "HEAD"]);
    l.schreiben("p.txt", "P1\n");
    let p1 = l.commit("P1");
    l.git(&["checkout", "-q", "-b", "seite", &vorher]);
    l.schreiben("q.txt", "P2\n");
    let p2 = l.commit("P2");
    l.git(&["checkout", "-q", "main"]);
    l.karte(7, &[kd(&p1), kd(&p2)]);
    let lauf = l.starten(&[]);
    let (d, _) = gesamt(&lauf.adresse, 7, "").await;
    assert_eq!(d["hinweise"][0], json!({"art": "ganz_als_folge", "grund": "nicht_linear"}));
    nie_netto(&d);
    assert_eq!(namen(&d), ["p.txt", "q.txt"]);
}

/// `n` leere fremde Commits auf `main` in einem Lauf (`commit-tree` über `fast-import` wäre schneller, hier reicht es).
fn fremde(l: &Lage, n: usize) {
    let mut eingabe = String::new();
    let kopf = l.git(&["rev-parse", "HEAD"]);
    eingabe.push_str("reset refs/heads/main\nfrom ");
    eingabe.push_str(&kopf);
    eingabe.push('\n');
    for i in 0..n {
        eingabe.push_str(&format!("commit refs/heads/main\ncommitter Fremd <f@f> 1775000000 +0000\ndata {}\nfremd {i:04}\n\n", 11));
    }
    let mut kind = std::process::Command::new("git").arg("-C").arg(&l.r).args(["fast-import", "--quiet"]).stdin(std::process::Stdio::piped()).spawn().unwrap();
    use std::io::Write;
    kind.stdin.take().unwrap().write_all(eingabe.as_bytes()).unwrap();
    assert!(kind.wait().unwrap().success());
    l.git(&["reset", "-q", "--hard", "main"]);
}

#[tokio::test]
async fn ak04_zu_viele_fremde() {
    let l = ausgangslage();
    for (nr, n) in [(8u32, 1001usize), (18, 1000)] {
        l.schreiben(&format!("q{nr}.txt"), "Q1\n");
        let q1 = l.commit("Q1");
        fremde(&l, n);
        l.schreiben(&format!("q{nr}.txt"), "Q1\nQ2\n");
        let q2 = l.commit("Q2");
        l.karte(nr, &[kd(&q1), kd(&q2)]);
    }
    let lauf = l.starten(&[]);
    let (d, _) = gesamt(&lauf.adresse, 8, "").await;
    assert_eq!(d["hinweise"][0], json!({"art": "ganz_als_folge", "grund": "fremd_zu_viele"}));
    nie_netto(&d);
    let (d, _) = gesamt(&lauf.adresse, 18, "").await;
    assert!(!d["hinweise"].to_string().contains("ganz_als_folge") && d["spanne"].is_object(), "genau 1.000: {d}");
    assert!(dateien(&d).iter().all(|f| !ist_folge(f)), "leere fremde Commits berühren nichts: {d}");
}

// ---- AK 6: Antwortform, Anwendungen, ersetzt „ohne commit 400“ · US-4 --------------------------------------------------

#[tokio::test]
async fn ak06_antwortform_und_anwendungen() {
    let l = ausgangslage();
    // zweite Anwendung zw mit Repository R2 und Z1
    let r2 = l.basis.join("R2");
    std::fs::create_dir_all(r2.join("Planung")).unwrap();
    std::fs::write(r2.join("Planung/zw.md"), "# ZW\n").unwrap();
    git_am(&r2, "Zoe", "2026-04-02T09:00:00+00:00", &["init", "-q", "-b", "main"]);
    git_am(&r2, "Zoe", "2026-04-02T09:00:00+00:00", &["add", "-A"]);
    git_am(&r2, "Zoe", "2026-04-02T09:00:00+00:00", &["commit", "-q", "-m", "Z0"]);
    std::fs::write(r2.join("z.txt"), "z\n").unwrap();
    git_am(&r2, "Zoe", "2026-04-02T10:00:00+00:00", &["add", "-A"]);
    git_am(&r2, "Zoe", "2026-04-02T10:00:00+00:00", &["commit", "-q", "-m", "Z1"]);
    let z1 = git(&r2, &["rev-parse", "HEAD"]);
    let register = lies(&l.board, "kanbanD.md").replace("---\n", "").replace("requirements: \"\"}\n", &format!("requirements: \"\"}}\n    zw: {{name: ZW, wbs: {}/Planung/zw.md, requirements: \"\"}}\n", r2.display()));
    std::fs::write(l.board.join("kanbanD.md"), format!("---\n{register}---\n")).unwrap();
    l.karte(2, &[kd(&l.k1), kd(&l.k2), format!("zw:{z1}")]);
    l.karte(9, &[]);
    let lauf = l.starten(&[]);
    let (d, _) = gesamt(&lauf.adresse, 2, "").await;
    assert_eq!(d["anwendung"], "kd");
    assert!(d["hinweise"].as_array().unwrap().contains(&json!({"art": "weitere_anwendungen", "anwendungen": ["zw"]})), "{d}");
    let liste: Value = reqwest::get(format!("{}api/aufgaben/2/commits", lauf.adresse)).await.unwrap().json().await.unwrap();
    for c in d["commits"].as_array().unwrap() {
        let mut e = liste["commits"].as_array().unwrap().iter().find(|e| e["verweis"] == c["verweis"]).unwrap().clone();
        for f in ["zustand", "zweige", "entfernte_zweige"] {
            e.as_object_mut().unwrap().remove(f);
        }
        assert_eq!(c, &e, "wie die Liste, ohne Zustand und Zweige");
    }
    let (z, _) = gesamt(&lauf.adresse, 2, "anwendung=zw").await;
    assert_eq!((z["anwendung"].as_str(), namen(&z)), (Some("zw"), vec!["z.txt".to_string()]));
    for (nr, abfrage, status) in [(2, "anwendung=xx", 404), (9, "", 404), (2, &*format!("anwendung=kd&commit={}", kodiert(&kd(&l.k1))), 400)] {
        let a = holen(&lauf.adresse, nr, abfrage, None).await;
        assert_eq!((a.status, a.json()["fehler"].is_string()), (status, true), "#{nr}?{abfrage}: {}", a.text);
    }
    // von Hand: gelöschter Commit, nicht registrierte Anwendung, mehrdeutiger Kurz-Hash (zwei Objekte mit Präfix 7f62b7e)
    for n in [18876, 29727] {
        let pfad = l.basis.join("objekt");
        std::fs::write(&pfad, format!("tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904\nauthor A <a@a> 0 +0000\ncommitter A <a@a> 0 +0000\n\n{n}\n")).unwrap();
        assert!(git(&l.r, &["hash-object", "-w", "-t", "commit", pfad.to_str().unwrap()]).starts_with(gemeinsam::PRAEFIX_ZWEIER));
    }
    let fehlt = "0123456789abcdef0123456789abcdef01234567".to_string();
    l.karte(2, &[kd(&l.k1), kd(&l.k2), kd(&fehlt), format!("xx:{}", l.k1), kd(gemeinsam::PRAEFIX_ZWEIER)]);
    let (d, _) = gesamt(&lauf.adresse, 2, "").await;
    let hinweise = d["hinweise"].as_array().unwrap();
    assert!(hinweise.contains(&json!({"art": "ausgelassen", "verweis": kd(&fehlt), "zustand": "fehlt"})), "{d}");
    assert!(hinweise.contains(&json!({"art": "ausgelassen", "verweis": format!("xx:{}", l.k1), "zustand": "anwendung_unbekannt"})), "{d}");
    assert!(hinweise.contains(&json!({"art": "ausgelassen", "verweis": kd(gemeinsam::PRAEFIX_ZWEIER), "zustand": "unlesbar"})), "{d}");
    assert_eq!(namen(&d), ["a.txt", "k.txt"], "dieselben dateien");
}

// ---- AK 7: datei= und format=patch · US-5 ------------------------------------------------------------------------------

#[tokio::test]
async fn ak07_datei_und_format_patch() {
    let l = ausgangslage();
    let (lauf, spurdatei) = l.mit_spur();
    let (d, _) = gesamt(&lauf.adresse, 2, "").await;
    let (k, _) = gesamt(&lauf.adresse, 2, "datei=k.txt").await;
    assert_eq!(dateien(&k), &vec![eintrag(&d, "k.txt").clone()]);
    let (a, _) = gesamt(&lauf.adresse, 2, "datei=a.txt").await;
    assert_eq!(dateien(&a), &vec![eintrag(&d, "a.txt").clone()]);
    spur_leeren(&spurdatei);
    for name in ["f.txt", "*", "../a.txt"] {
        let r = holen(&lauf.adresse, 2, &format!("datei={}", kodiert(name)), None).await;
        assert_eq!((r.status, r.json()["fehler"].is_string()), (404, true), "{name}: {}", r.text);
        assert!(!spur(&spurdatei).iter().any(|z| z.ends_with(&format!(" -- {name}")) || z.contains(&format!(" '{name}'"))), "{name} erreicht Git: {:?}", spur(&spurdatei));
    }
    let t = holen(&lauf.adresse, 2, "format=patch", None).await;
    assert_eq!((t.status, t.art.as_str(), t.nosniff), (200, "text/x-diff; charset=utf-8", true));
    assert!(t.text.lines().next().unwrap().starts_with("# kanbanD: fremd_dazwischen"), "{}", t.text);
    let s1 = t.text.find(&format!("# kanbanD: Folge a.txt — Schritt 1 von 2, Commit {}\n", kd(&l.k1))).expect("Schritt 1");
    let s2 = t.text.find(&format!("# kanbanD: Folge a.txt — Schritt 2 von 2, Commit {}\n", kd(&l.k2))).expect("Schritt 2");
    assert!(s1 < s2 && t.text[s1..s2].contains("+K1") && t.text[s2..].contains("+K2"), "{}", t.text);
    assert!(t.text.contains("diff --git a/k.txt b/k.txt\nnew file mode 100644\nindex "), "k.txt als Patch von Git: {}", t.text);
}

// ---- AK 8: Kappe, 4 MB zusammen, Gesamtgrenze · US-6 -------------------------------------------------------------------

#[tokio::test]
async fn ak08_kappe_und_vier_mb_zusammen() {
    let l = ausgangslage();
    std::fs::create_dir_all(l.r.join("viele")).unwrap();
    for i in 0..2001 {
        std::fs::write(l.r.join(format!("viele/{i:04}.txt")), format!("{i}\n")).unwrap();
    }
    let viele = l.commit("2.001 Dateien");
    l.karte(10, &[kd(&viele)]);
    // #11: S1 (25 Dateien zu 2.000 Zeilen, t.txt), fremd FS, S2 (t.txt)
    for i in 1..=25 {
        l.schreiben(&format!("s{i:02}.txt"), &format!("{}\n", "a".repeat(99)).repeat(2000));
    }
    l.schreiben("t.txt", "t1\nt2\nt3\n");
    let s1 = l.commit("S1");
    l.zeile("t.txt", 2, "FREMD-T");
    l.commit("FS");
    l.zeile("t.txt", 3, "S2");
    let s2 = l.commit("S2");
    l.karte(11, &[kd(&s1), kd(&s2)]);
    let (lauf, spurdatei) = l.mit_spur();
    let (d, _) = gesamt(&lauf.adresse, 10, "").await;
    assert_eq!((dateien(&d).len(), d["hinweise"].clone()), (2000, json!([{"art": "dateien_gekappt", "gezeigt": 2000, "gesamt": 2001}])));
    spur_leeren(&spurdatei);
    let (d, _) = gesamt(&lauf.adresse, 11, "").await;
    let netto: Vec<&Value> = dateien(&d).iter().filter(|f| f["neu"].as_str().is_some_and(|n| n.starts_with('s'))).collect();
    assert_eq!(netto.len(), 25);
    assert!(netto[..20].iter().all(|f| f["patch"].is_string() && f["nachladen"] == false), "die ersten 20 mit patch");
    assert!(netto[20..].iter().all(|f| f["patch"].is_null() && f["nachladen"] == true), "21 bis 25 nachladen");
    let t = eintrag(&d, "t.txt");
    assert!(ist_folge(t) && t["schritte"].as_array().unwrap().iter().all(|s| s["nachladen"] == true && s["patch"].is_null()), "kein Rest: {t}");
    let laeufe = spur(&spurdatei);
    assert!(!laeufe.iter().any(|z| z.contains("--stdin") && z.contains(" -p ")), "kein Patch-Lauf für die Folge: {laeufe:#?}");
    let (einzeln, _) = gesamt(&lauf.adresse, 11, "datei=t.txt").await;
    assert!(eintrag(&einzeln, "t.txt")["schritte"].as_array().unwrap().iter().all(|s| s["patch"].is_string()), "{einzeln}");
}

#[tokio::test]
async fn ak08_gesamtgrenze() {
    let l = ausgangslage();
    let echt = String::from_utf8(std::process::Command::new("sh").args(["-c", "command -v git"]).output().unwrap().stdout).unwrap().trim().to_string();
    let ordner = l.basis.join("bin");
    std::fs::create_dir_all(&ordner).unwrap();
    std::fs::write(ordner.join("git"), format!("#!/bin/sh\ncase \"$*\" in *\"{}\"*core.hooksPath=/dev/null*) sleep 4;; esac\nexec {echt} \"$@\"\n", l.r.display())).unwrap();
    std::fs::set_permissions(ordner.join("git"), std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    let pfad = format!("{}:{}", ordner.display(), std::env::var("PATH").unwrap());
    let lauf = l.starten(&[("PATH", &pfad)]);
    let start = Instant::now();
    let a = holen(&lauf.adresse, 2, "", None).await;
    assert!(start.elapsed() <= Duration::from_secs(15), "{:?}", start.elapsed());
    assert_eq!((a.status, a.json()["fehler"].is_string(), a.json()["dateien"].is_null()), (503, true, true), "{}", a.text);
    std::thread::sleep(Duration::from_millis(500));
    let laufend = String::from_utf8(std::process::Command::new("ps").args(["-eo", "args"]).output().unwrap().stdout).unwrap();
    assert!(!laufend.lines().any(|z| z.contains(l.r.to_str().unwrap()) && z.contains("hooksPath")), "danach läuft kein Git-Prozess mehr: {laufend}");
}

// ---- AK 9: feindliche Konfiguration und nur lesend · US-7 --------------------------------------------------------------

#[tokio::test]
async fn ak09_feindliche_konfiguration_und_nur_lesend() {
    let l = ausgangslage();
    mit_umbenennung(&l);
    let anfragen = [(2u32, ""), (2, "format=patch"), (4, ""), (4, "format=patch")];
    let sauber = {
        let lauf = l.starten(&[]);
        let mut v = vec![];
        for (nr, q) in anfragen {
            v.push(holen(&lauf.adresse, nr, q, None).await.text);
        }
        v
    };
    let r_vorher = (git(&l.r, &["count-objects", "-v"]), git(&l.r, &["status", "--porcelain"]));
    let (board_vorher, karte_vorher) = (l.board_zahl(), lies(&l.board, "aufgaben/0002-k.md"));
    let marke = l.basis.join("marke");
    let skript = l.basis.join("skript.sh");
    std::fs::write(&skript, format!("#!/bin/sh\ncase \"$PWD $*\" in *\"{}\"*) echo \"$0 $*\" >> {};; esac\nexit 0\n", l.r.display(), marke.display())).unwrap();
    std::fs::set_permissions(&skript, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    let s = skript.to_str().unwrap();
    std::fs::write(l.r.join(".git/info/attributes"), "* diff=x\n").unwrap();
    let ordnung = l.basis.join("reihenfolge");
    std::fs::write(&ordnung, "z*\nr*\n").unwrap();
    for (k, w) in [("diff.external", s), ("diff.x.command", s), ("diff.x.textconv", s), ("core.pager", s), ("color.ui", "always"), ("core.fsmonitor", s), ("core.hooksPath", l.basis.to_str().unwrap()), ("diff.noprefix", "true"), ("diff.renames", "false"), ("diff.renameLimit", "1"), ("diff.context", "0"), ("diff.algorithm", "patience"), ("diff.orderFile", ordnung.to_str().unwrap()), ("core.quotepath", "true"), ("diff.ignoreSubmodules", "all")] {
        git(&l.r, &["config", k, w]);
    }
    let umgebung = [("GIT_EXTERNAL_DIFF", s), ("GIT_PAGER", s), ("PAGER", s), ("GIT_CONFIG_COUNT", "1"), ("GIT_CONFIG_KEY_0", "diff.external"), ("GIT_CONFIG_VALUE_0", s)];
    let lauf = l.starten(&umgebung);
    let _ = std::fs::remove_file(&marke);
    let mut feindlich = vec![];
    for (nr, q) in anfragen {
        feindlich.push(holen(&lauf.adresse, nr, q, None).await.text);
    }
    assert_eq!(feindlich, sauber, "bytegleich zur Antwort im sauberen Repository");
    assert!(!marke.exists(), "ein Skript lief: {}", lies(&l.basis, "marke"));
    // Gegenprobe: git log --name-only folgt diff.renames=false (der alte Pfad fehlt), git diff startet das Skript
    let roh = std::process::Command::new("git").arg("-C").arg(&l.r).args(["-c", "core.fsmonitor=false", "diff", "HEAD^", "HEAD"]).env("GIT_PAGER", "cat").output().unwrap();
    let _ = roh;
    assert!(marke.exists(), "Gegenprobe: git diff startet diff.external");
    for (nr, q) in [(2u32, "anwendung=--output%3Dx"), (2, "datei=--output%3Dx"), (2, "datei=%24(touch%20x)")] {
        let a = holen(&lauf.adresse, nr, q, None).await;
        assert!(matches!(a.status, 400 | 404) && a.json()["fehler"].is_string(), "{q}: {} {}", a.status, a.text);
    }
    assert!(!l.r.join("x").exists() && !l.board.join("x").exists());
    for f in [".gitattributes"] {
        assert!(!l.r.join(f).exists());
    }
    std::fs::remove_file(l.r.join(".git/info/attributes")).unwrap();
    for k in ["diff.external", "diff.x.command", "diff.x.textconv", "core.pager", "color.ui", "core.fsmonitor", "core.hooksPath", "diff.noprefix", "diff.renames", "diff.renameLimit", "diff.context", "diff.algorithm", "diff.orderFile", "core.quotepath", "diff.ignoreSubmodules"] {
        git(&l.r, &["config", "--unset", k]);
    }
    assert_eq!((git(&l.r, &["count-objects", "-v"]), git(&l.r, &["status", "--porcelain"])), r_vorher, "R unverändert");
    assert!(!l.r.join(".git/index.lock").exists());
    assert_eq!((l.board_zahl(), lies(&l.board, "aufgaben/0002-k.md")), (board_vorher, karte_vorher), "Board-Ordner unverändert");
}

// ---- AK 6: Beschreibung in Endpunktliste, OpenAPI und README · US-4 ----------------------------------------------------

#[tokio::test]
async fn ak06_beschreibung() {
    let l = ausgangslage();
    let lauf = l.starten(&[]);
    let liste: Value = reqwest::get(format!("{}api/endpunkte", lauf.adresse)).await.unwrap().json().await.unwrap();
    let routen = liste.as_array().unwrap();
    assert_eq!(routen.iter().filter(|e| e["pfad"] == "/api/aufgaben/{nr}/diff").count(), 1, "keine neue Route");
    let e = routen.iter().find(|e| e["methode"] == "GET" && e["pfad"] == "/api/aufgaben/{nr}/diff").unwrap();
    let zweck = e["zweck"].as_str().unwrap();
    for wort in ["Ohne commit", "anwendung", "netto", "Folge", "schritte", "spanne", "ganz_als_folge", "fremd_dazwischen", "weitere_anwendungen", "verwaist", "merge_ausgelassen", "ausgelassen", "404", "400"] {
        assert!(zweck.contains(wort), "Zweck nennt {wort}");
    }
    let api: Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse)).await.unwrap().json().await.unwrap();
    let get = &api["paths"]["/api/aufgaben/{nr}/diff"]["get"];
    let parameter: Vec<&str> = get["parameters"].as_array().unwrap().iter().map(|p| p["name"].as_str().unwrap()).collect();
    assert_eq!(parameter, ["nr", "commit", "anwendung", "datei", "format", "If-None-Match"]);
    assert_eq!(get["parameters"][1]["required"], json!(false), "commit ist nicht mehr Pflicht");
    assert_eq!(get["description"].as_str(), Some(zweck));
    assert!(get["responses"]["200"]["description"].as_str().unwrap().contains("Gesamt-Diff"));
    let readme = std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("README.md")).unwrap();
    let abschnitt = readme.split("### Alle Änderungen der Karte lesen").nth(1).expect("README-Abschnitt").split("\n## ").next().unwrap();
    for wort in ["GET /api/aufgaben/2/diff", "\"schritte\"", "anwendung=", "ganz_als_folge", "merge_ausgelassen", "&datei=", "format=patch", "404", "400"] {
        assert!(abschnitt.contains(wort), "README nennt {wort}");
    }
}

// ---- AK 8: Antwortbudget wie A3 (R00206 AK 20 b mit N = 30, ohne commit) · US-6 ----------------------------------------

#[tokio::test]
async fn ak08_antwortbudget() {
    let l = ausgangslage();
    l.schreiben("gross1.txt", &(0..170_000).map(|i| format!("{:<44}\n", format!("gross1-{i}"))).collect::<String>());
    let x = l.commit("gross1");
    l.karte(12, &[kd(&x)]);
    let lauf = l.starten(&[("PATH", &langsames_git(&l.r, LANGSAM_D))]);
    let start = Instant::now();
    let groesse = holen(&lauf.adresse, 12, "datei=gross1.txt", None).await.text.len();
    eprintln!("AK 8: Einzelanfrage T = {:?} mit langsamem Git (d = {LANGSAM_D} s)", start.elapsed());
    assert!(groesse > 7 << 20, "{groesse}");
    let adresse = lauf.adresse.clone();
    let pfad = "api/aufgaben/12/diff?datei=gross1.txt".to_string();
    let g = tokio::task::spawn_blocking(move || gestaffelt(&adresse, &pfad, 30)).await.unwrap();
    assert!((2..=UNTERWEGS_HOECHSTENS).contains(&g.hoechstens_unterwegs), "{} Anfragen zugleich unterwegs", g.hoechstens_unterwegs);
    assert_eq!(g.offen_und_ungelesen(), 30, "alle offen, nach der Statuszeile ungelesen");
    let verbindungen = g.verbindungen;
    let ok = verbindungen.iter().filter(|(_, s)| *s == 200).count();
    assert!(ok >= 1 && ok <= (64 << 20) / groesse, "{ok} × 200 bei {groesse} Byte");
    for (mut s, status) in verbindungen.into_iter().filter(|(_, s)| *s != 200) {
        assert_eq!(status, 503);
        let rumpf: Value = serde_json::from_str(&rest_lesen(&mut s)).unwrap();
        assert!(rumpf["fehler"].as_str().unwrap().starts_with("Antwortbudget"), "{rumpf}");
    }
}

// ---- Nacharbeit 1 (Code-Review B1–B5, Security S1/S2) ------------------------------------------------------------------

/// Jeder Name steht höchstens einmal in `dateien` (ein Pfad gehört genau einem Eintrag: netto oder Folge).
fn eindeutig(d: &Value) {
    let mut n = namen(d);
    let alle = n.len();
    n.sort();
    n.dedup();
    assert_eq!(n.len(), alle, "ein Name doppelt: {d}");
}

/// `datei=` auf jeden Namen: 200 mit genau diesem Eintrag (gleich dem der Liste, ohne Patch-Felder), nie 500; auf jeden
/// weiteren Pfad 200 oder 404.
async fn datei_auf_jeden_pfad(adresse: &str, nr: u32, d: &Value, weitere: &[&str]) {
    let ohne_patch = |f: &Value| {
        let weg = |v: &mut Value| {
            if let Some(o) = v.as_object_mut() {
                o.retain(|k, _| !["patch", "gross", "nachladen"].contains(&k.as_str()));
            }
        };
        let mut f = f.clone();
        weg(&mut f);
        for s in f["schritte"].as_array_mut().into_iter().flatten() {
            weg(s);
        }
        f
    };
    for name in namen(d) {
        let (e, _) = gesamt(adresse, nr, &format!("datei={}", kodiert(&name))).await;
        assert_eq!(dateien(&e).len(), 1, "datei={name}: {e}");
        assert_eq!(ohne_patch(&dateien(&e)[0]), ohne_patch(eintrag(d, &name)), "datei={name}");
    }
    for name in weitere {
        let a = holen(adresse, nr, &format!("datei={}", kodiert(name)), None).await;
        assert!(matches!(a.status, 200 | 404), "datei={name}: {} {}", a.status, a.text);
    }
}

/// Ein Folge-Eintrag mit genau diesen Schritten `(verweis, status, alt, neu, plus, minus)`.
fn schritte_von(f: &Value) -> Vec<(String, String, Value, Value, u64, u64)> {
    assert!(ist_folge(f), "kein Folge-Eintrag: {f}");
    f["schritte"].as_array().unwrap().iter().map(|s| (s["commit"].as_str().unwrap().to_string(), s["status"].as_str().unwrap().to_string(), s["alt"].clone(), s["neu"].clone(), s["plus"].as_u64().unwrap(), s["minus"].as_u64().unwrap())).collect()
}

// B1 (a) Abnahme-Probe: K1 ändert a.txt, F legt f1.txt mit FREMD-1..3 an, K2 `git mv f1.txt c.txt` → c.txt als Folge mit
// dem Schritt K2 `R f1.txt → c.txt`, 0/0; kein Netto-Eintrag mit FREMD-Zeilen (heute: c.txt netto `A` mit F-Zeilen,
// f1.txt Folge `D` mit `-FREMD`)
#[tokio::test]
async fn b1_umbenennung_einer_fremd_angelegten_datei() {
    let l = ausgangslage();
    l.zeile("a.txt", 3, "B1-K1");
    let k1 = l.commit("K1");
    l.schreiben("f1.txt", &zeilen("FREMD-", 3));
    l.commit("F");
    l.git(&["mv", "f1.txt", "c.txt"]);
    let k2 = l.commit("K2");
    l.karte(20, &[kd(&k1), kd(&k2)]);
    // (b) F legt x.txt an, dann benennt K1 x.txt nach y.txt um (K0 davor öffnet die Spanne)
    l.zeile("a.txt", 4, "B1-K0");
    let k0 = l.commit("K0");
    l.schreiben("x.txt", &zeilen("FREMD-x", 4));
    l.commit("F-x");
    l.git(&["mv", "x.txt", "y.txt"]);
    let k1b = l.commit("K1b");
    l.karte(21, &[kd(&k0), kd(&k1b)]);
    // (c) Ziel netto abgedeckt, Quelle Folge: F schreibt q.txt so stark um, dass Git netto nicht mehr paart
    l.schreiben("q.txt", &zeilen("q", 4));
    l.commit("q.txt");
    l.zeile("a.txt", 5, "B1-K0c");
    let k0c = l.commit("K0c");
    l.schreiben("q.txt", &(zeilen("q", 4) + &zeilen("FREMD-q", 30)));
    l.commit("F-q");
    l.git(&["mv", "q.txt", "w.txt"]);
    let k1c = l.commit("K1c");
    l.karte(22, &[kd(&k0c), kd(&k1c)]);
    // (d) Kette: F legt u.txt an, K1 benennt nach u1.txt, K2 nach u2/inner, K3 hängt an u2/inner an
    l.zeile("a.txt", 7, "B1-K0d");
    let k0d = l.commit("K0d");
    l.schreiben("u.txt", &zeilen("FREMD-u", 5));
    l.commit("F-u");
    l.git(&["mv", "u.txt", "u1.txt"]);
    let k1d = l.commit("K1d");
    std::fs::create_dir_all(l.r.join("u2")).unwrap();
    l.git(&["mv", "u1.txt", "u2/inner"]);
    let k2d = l.commit("K2d");
    let u2 = std::fs::read_to_string(l.r.join("u2/inner")).unwrap();
    l.schreiben("u2/inner", &format!("{u2}K3d\n"));
    let k3d = l.commit("K3d");
    l.karte(23, &[kd(&k0d), kd(&k1d), kd(&k2d), kd(&k3d)]);
    // (e) Zwischenname ohne fremde Zeilen (Zufallsprobe Seed 12): K1 benennt r.txt nach m.txt, K2 m.txt nach m.txt/inner,
    // ein fremder Commit dazwischen berührt anderes → eine Datei, ein Eintrag
    l.git(&["mv", "r.txt", "m.txt"]);
    let k1e = l.commit("K1e");
    l.zeile("a.txt", 8, "FREMD-e");
    l.commit("F-e");
    l.git(&["rm", "-q", "--cached", "m.txt"]);
    let inhalt = std::fs::read_to_string(l.r.join("m.txt")).unwrap();
    std::fs::remove_file(l.r.join("m.txt")).unwrap();
    l.schreiben_in("m.txt/inner", &inhalt);
    let k2e = l.commit("K2e");
    l.karte(24, &[kd(&k1e), kd(&k2e)]);
    // (f) Zwischenname, den die Karte anlegt: K1 legt n.txt an, ein fremder Commit berührt anderes, K2 benennt n.txt nach
    // z.txt um → netto `A z.txt`, n.txt erscheint nirgends (sonst ein Folge-Eintrag nur mit „A n.txt“)
    l.schreiben("n.txt", &zeilen("n", 6));
    let k1f = l.commit("K1f");
    l.zeile("a.txt", 12, "FREMD-f");
    l.commit("F-f");
    l.git(&["mv", "n.txt", "z.txt"]);
    let k2f = l.commit("K2f");
    l.karte(25, &[kd(&k1f), kd(&k2f)]);
    let lauf = l.starten(&[]);

    let (d, _) = gesamt(&lauf.adresse, 20, "").await;
    eindeutig(&d);
    assert!(!namen(&d).contains(&"f1.txt".to_string()), "f1.txt trägt nur den Schritt K2 bei c.txt: {d}");
    assert_eq!(schritte_von(eintrag(&d, "c.txt")), [(kd(&k2), "R".into(), json!("f1.txt"), json!("c.txt"), 0, 0)]);
    datei_auf_jeden_pfad(&lauf.adresse, 20, &d, &["f1.txt"]).await;

    let (d, _) = gesamt(&lauf.adresse, 21, "").await;
    eindeutig(&d);
    assert_eq!(schritte_von(eintrag(&d, "y.txt")), [(kd(&k1b), "R".into(), json!("x.txt"), json!("y.txt"), 0, 0)]);
    datei_auf_jeden_pfad(&lauf.adresse, 21, &d, &["x.txt"]).await;

    let (d, _) = gesamt(&lauf.adresse, 22, "").await;
    eindeutig(&d);
    assert_eq!(schritte_von(eintrag(&d, "w.txt")), [(kd(&k1c), "R".into(), json!("q.txt"), json!("w.txt"), 0, 0)]);
    datei_auf_jeden_pfad(&lauf.adresse, 22, &d, &["q.txt"]).await;

    let (d, _) = gesamt(&lauf.adresse, 23, "").await;
    eindeutig(&d);
    assert_eq!(schritte_von(eintrag(&d, "u1.txt")), [(kd(&k1d), "R".into(), json!("u.txt"), json!("u1.txt"), 0, 0)]);
    let u2 = schritte_von(eintrag(&d, "u2/inner"));
    assert_eq!(u2.iter().map(|s| (s.0.clone(), s.1.clone())).collect::<Vec<_>>(), [(kd(&k2d), "R".into()), (kd(&k3d), "M".into())]);
    datei_auf_jeden_pfad(&lauf.adresse, 23, &d, &["u.txt"]).await;

    let (d, _) = gesamt(&lauf.adresse, 24, "").await;
    eindeutig(&d);
    assert!(!namen(&d).contains(&"m.txt".to_string()) && !dateien(&d).iter().any(ist_folge), "eine Netto-Umbenennung r.txt → m.txt/inner, kein Zwischenname: {d}");
    assert_eq!((&eintrag(&d, "m.txt/inner")["status"], &eintrag(&d, "m.txt/inner")["alt"]), (&json!("R"), &json!("r.txt")));
    datei_auf_jeden_pfad(&lauf.adresse, 24, &d, &["m.txt", "r.txt"]).await;

    let (d, _) = gesamt(&lauf.adresse, 25, "").await;
    eindeutig(&d);
    assert!(!namen(&d).contains(&"n.txt".to_string()), "n.txt ist ein Zwischenname: {d}");
    assert_eq!(&eintrag(&d, "z.txt")["status"], &json!("A"));
    datei_auf_jeden_pfad(&lauf.adresse, 25, &d, &["n.txt"]).await;
}

// B2 Abnahme-Probe: Basis b und d/x mit gleichem Inhalt; K1 ersetzt d/x durch d/x/inner, K2 hängt K2 an, K3 ersetzt b
// durch b/inner — ohne und mit F zwischen K2 und K3, das b ändert; Variante: fremde Löschung von d/x mit Zwilling.
// Heute: mit F `…/diff` 500 (`--literal-pathspecs d/x` trifft `d/x/…`, Git paart neu)
#[tokio::test]
async fn b2_typwechsel_mit_gleichem_blob() {
    let l = ausgangslage();
    let inhalt = zeilen("zw", 10);
    let mut karten = vec![];
    for (nr, mit_f) in [(30u32, false), (31, true)] {
        let (b, dx) = (format!("b{nr}"), format!("d{nr}/x"));
        l.schreiben_in(&b, &inhalt);
        l.schreiben_in(&dx, &inhalt);
        l.commit("Basis");
        std::fs::remove_file(l.r.join(&dx)).unwrap();
        l.schreiben_in(&format!("{dx}/inner"), &inhalt);
        let k1 = l.commit("K1");
        l.schreiben_in(&format!("{dx}/inner"), &format!("{inhalt}K2\n"));
        let k2 = l.commit("K2");
        if mit_f {
            l.schreiben_in(&b, &format!("{inhalt}FREMD-b\n"));
            l.commit("F");
        }
        let alt = std::fs::read_to_string(l.r.join(&b)).unwrap();
        std::fs::remove_file(l.r.join(&b)).unwrap();
        l.schreiben_in(&format!("{b}/inner"), &alt);
        let k3 = l.commit("K3");
        l.karte(nr, &[kd(&k1), kd(&k2), kd(&k3)]);
        karten.push((nr, b, dx));
    }
    // fremde Löschung von d32/x mit Zwilling b32: K1 ändert a.txt, F löscht d32/x, K2 verschiebt b32 nach d32/x/inner
    l.schreiben_in("b32", &inhalt);
    l.schreiben_in("d32/x", &inhalt);
    l.commit("Basis 32");
    l.zeile("a.txt", 9, "K1-32");
    let k1 = l.commit("K1-32");
    std::fs::remove_file(l.r.join("d32/x")).unwrap();
    l.commit("F-32");
    std::fs::remove_file(l.r.join("b32")).unwrap();
    l.schreiben_in("d32/x/inner", &inhalt);
    let k2 = l.commit("K2-32");
    l.karte(32, &[kd(&k1), kd(&k2)]);
    karten.push((32, "b32".into(), "d32/x".into()));
    // Neupaarung über die Pfadangabe: Basis b33 (Inhalt X) und d33/x (X und eine Zeile mehr); ein Kartenschritt löscht
    // beide und legt d33/x/inner mit X an → Git paart `R b33 → d33/x/inner` (gleicher Inhalt) und `D d33/x`. Eine
    // Pfadangabe `d33/x` allein träfe d33/x/inner, und Git paarte `R d33/x → d33/x/inner`.
    // #33 ein Kartencommit (netto, datei=d33/x); #34 dasselbe mit einem fremden Commit, der d33/x ändert (D d33/x Folge)
    for (nr, fremd) in [(33u32, false), (34, true)] {
        let (b, dx) = (format!("b{nr}"), format!("d{nr}/x"));
        l.schreiben_in(&b, &inhalt);
        l.schreiben_in(&dx, &format!("{inhalt}y\n"));
        l.commit("Basis");
        l.zeile("a.txt", 1, &format!("K0-{nr}"));
        let k0 = l.commit("K0");
        if fremd {
            l.schreiben_in(&dx, &format!("{inhalt}y\nanders\n"));
            l.commit("F");
        }
        std::fs::remove_file(l.r.join(&b)).unwrap();
        std::fs::remove_file(l.r.join(&dx)).unwrap();
        l.schreiben_in(&format!("{dx}/inner"), &inhalt);
        let k1 = l.commit("K1");
        l.karte(nr, &if fremd { vec![kd(&k0), kd(&k1)] } else { vec![kd(&k1)] });
        karten.push((nr, b, dx));
    }
    let lauf = l.starten(&[]);
    for (nr, b, dx) in karten {
        let (d, _) = gesamt(&lauf.adresse, nr, "").await;
        eindeutig(&d);
        datei_auf_jeden_pfad(&lauf.adresse, nr, &d, &[&b, &dx, &format!("{b}/inner"), &format!("{dx}/inner")]).await;
        if nr == 34 {
            let k1 = d["commits"][1]["verweis"].as_str().unwrap().to_string();
            assert_eq!(schritte_von(eintrag(&d, "d34/x")), [(k1, "D".into(), json!("d34/x"), Value::Null, 0, 12)], "{d}");
            assert_eq!((&eintrag(&d, "d34/x/inner")["status"], &eintrag(&d, "d34/x/inner")["alt"]), (&json!("R"), &json!("b34")));
        }
    }
}

/// Probe „nie fremd“ mit der Ausnahme des Kartenschritts (R00208 AK 2): keine `+`-Zeile mit `FREMD`; `-…FREMD…` nur im
/// Schritt `erlaubt` (der Kartenschritt löscht die fremde Zeile selbst), im JSON wie im `format=patch`-Text gleich oft.
fn nie_fremd_ausser(d: &Value, text: &str, erlaubt: &str) {
    let fremd = |p: &str, vorzeichen: char| p.lines().filter(|z| z.starts_with(vorzeichen) && z.contains("FREMD")).count();
    let mut geloescht = 0;
    for f in dateien(d) {
        let patches: Vec<(&str, &str)> = if ist_folge(f) { f["schritte"].as_array().unwrap().iter().filter_map(|s| Some((s["commit"].as_str().unwrap(), s["patch"].as_str()?))).collect() } else { f["patch"].as_str().map(|p| ("netto", p)).into_iter().collect() };
        for (commit, p) in patches {
            assert_eq!(fremd(p, '+'), 0, "fremde Zeile im patch von {f}");
            if commit != erlaubt {
                assert_eq!(fremd(p, '-'), 0, "fremde Zeile im patch von {f}");
            }
            geloescht += fremd(p, '-');
        }
    }
    assert_eq!((fremd(text, '+'), fremd(text, '-')), (0, geloescht), "fremde Zeile im format=patch-Text: {text}");
}

// B2-Rest Abnahme-Probe (Code-Review Wiederholung, #214): A0 `b` und `d/x` mit gleichem Inhalt, K0 ändert a.txt, F hängt
// FREMD an d/x, K1 löscht b, K2 ersetzt das Verzeichnis d durch die Datei d → die Pfadangabe `b d` des Netto-Laufs trifft
// über `d` auch `d/x` (Folge, Zwilling von b). Heute 500 „Stück 3 gehört zu einer Datei des Laufs, steht aber nicht an
// ihrer Stelle“. Varianten: Zwilling vor dem Netto-Eintrag (`z` statt `b`), Zwilling als `A` mit Typwechsel Datei d →
// Verzeichnis d, dasselbe im Patch-Lauf der Folge; `datei=` auf jeden Pfad der Karte.
#[tokio::test]
async fn b2_rest_zwilling_ausserhalb_der_netto_eintraege() {
    let l = ausgangslage();
    let inhalt = zeilen("B", 4);
    let mut karten = vec![];
    // Verzeichnis → Datei, gelöschter Zwilling hinter (b) bzw. vor (z) dem Netto-Eintrag
    for (nr, zw) in [(50u32, "b50"), (51, "z51")] {
        let (d, dx) = (format!("d{nr}"), format!("d{nr}/x"));
        l.schreiben_in(zw, &inhalt);
        l.schreiben_in(&dx, &inhalt);
        l.commit("A0");
        l.zeile("a.txt", 3, &format!("K0-{nr}"));
        let k0 = l.commit("K0");
        l.schreiben_in(&dx, &format!("{inhalt}FREMD\n"));
        l.commit("F");
        std::fs::remove_file(l.r.join(zw)).unwrap();
        let k1 = l.commit("K1");
        std::fs::remove_dir_all(l.r.join(&d)).unwrap();
        l.schreiben_in(&d, "datei d\nganz anders\n");
        let k2 = l.commit("K2");
        l.karte(nr, &[kd(&k0), kd(&k1), kd(&k2)]);
        karten.push((nr, kd(&k2), vec![zw.to_string(), d, dx.clone()], zw.to_string(), dx));
    }
    // Datei → Verzeichnis, Zwilling als `A`: K1 legt d52/x an, F hängt FREMD an, K2 nimmt FREMD zurück und legt b52 mit
    // gleichem Inhalt an
    l.schreiben_in("d52", "datei d\nganz anders\n");
    l.commit("A0");
    l.zeile("a.txt", 4, "K0-52");
    let k0 = l.commit("K0");
    std::fs::remove_file(l.r.join("d52")).unwrap();
    l.schreiben_in("d52/x", &inhalt);
    let k1 = l.commit("K1");
    l.schreiben_in("d52/x", &format!("{inhalt}FREMD\n"));
    l.commit("F");
    l.schreiben_in("d52/x", &inhalt);
    l.schreiben_in("b52", &inhalt);
    let k2 = l.commit("K2");
    l.karte(52, &[kd(&k0), kd(&k1), kd(&k2)]);
    karten.push((52, kd(&k2), vec!["b52".into(), "d52".into(), "d52/x".into()], "b52".into(), "d52/x".into()));
    // im Folge-Lauf: F ändert die Datei d53 und löscht y53; K1 ersetzt d53 durch d53/x und legt y53 wieder an, beide mit
    // gleichem Inhalt → die Pfadangabe `d53 y53` des Patch-Laufs von K1 trifft über `d53` auch `d53/x` (netto, Zwilling
    // des Folge-Schritts `A y53`)
    l.schreiben_in("d53", "datei d\nganz anders\n");
    l.schreiben_in("y53", "y\n");
    l.commit("A0");
    l.zeile("a.txt", 5, "K0-53");
    let k0 = l.commit("K0");
    l.schreiben_in("d53", "datei d\nganz anders\nFREMD\n");
    std::fs::remove_file(l.r.join("y53")).unwrap();
    l.commit("F");
    std::fs::remove_file(l.r.join("d53")).unwrap();
    l.schreiben_in("d53/x", &inhalt);
    l.schreiben_in("y53", &inhalt);
    let k1 = l.commit("K1");
    l.karte(53, &[kd(&k0), kd(&k1)]);
    karten.push((53, kd(&k1), vec!["d53".into(), "d53/x".into(), "y53".into()], "d53/x".into(), "y53".into()));
    let lauf = l.starten(&[]);
    for (nr, k2, pfade, zw, folge) in karten {
        let mut abfragen = vec![String::new()];
        abfragen.extend(pfade.iter().chain([&"a.txt".to_string()]).map(|p| format!("datei={}", kodiert(p))));
        for q in abfragen {
            let a = holen(&lauf.adresse, nr, &q, None).await;
            assert_eq!(a.status, 200, "#{nr}?{q}: {}", a.text);
            let trenner = if q.is_empty() { "" } else { "&" };
            let t = holen(&lauf.adresse, nr, &format!("{q}{trenner}format=patch"), None).await;
            assert_eq!(t.status, 200, "#{nr}?{q} format=patch: {}", t.text);
            let d = a.json();
            nie_fremd_ausser(&d, &t.text, &k2);
            eindeutig(&d);
            if q.is_empty() {
                let mut n = namen(&d);
                n.sort();
                let mut soll: Vec<String> = pfade.iter().cloned().chain(["a.txt".into()]).collect();
                soll.sort();
                assert_eq!(n, soll, "#{nr}: {d}");
                // die Netto-Einträge tragen ihren eigenen Patch, nie den des Zwillings
                let netto = eintrag(&d, &zw);
                assert!(!ist_folge(netto), "#{nr} {zw} netto: {d}");
                let hunk = if netto["status"] == "D" { "@@ -1,4 +0,0 @@\n-B1\n-B2\n-B3\n-B4\n" } else { "@@ -0,0 +1,4 @@\n+B1\n+B2\n+B3\n+B4\n" };
                assert_eq!(netto["patch"], json!(hunk), "#{nr} {zw}: {d}");
                let stueck = t.text.split("diff --git ").find(|s| s.starts_with(&format!("a/{zw} b/{zw}\n"))).unwrap_or_else(|| panic!("#{nr}: Kopf von {zw} fehlt: {}", t.text));
                assert!(stueck.contains(&format!("\n{hunk}")), "#{nr}: Stück von {zw}: {stueck}");
                let schritte = schritte_von(eintrag(&d, &folge)).len();
                assert_eq!(t.text.matches(&format!("diff --git a/{folge} b/{folge}\n")).count(), schritte, "#{nr}: nur die Schritte von {folge}: {}", t.text);
            }
        }
    }
}

// B5 Abnahme-Probe: ein Dateiname mit Tab am Ende in K1, F und K2 → 200 mit Folge und beiden Schritten; Varianten
// Umbenennung und binär (heute 500: `ends_with(b"\t")` hielt den Eintrag für eine Umbenennung)
#[tokio::test]
async fn b5_dateiname_mit_tab_am_ende() {
    let l = ausgangslage();
    l.schreiben("x\t", &zeilen("x", 5));
    std::fs::write(l.r.join("bin\t"), [0u8, 1, 2]).unwrap();
    let k1 = l.commit("K1");
    l.zeile("x\t", 2, "FREMD-x");
    std::fs::write(l.r.join("bin\t"), [0u8, 1, 2, 3]).unwrap();
    l.commit("F");
    l.zeile("x\t", 4, "K2");
    std::fs::write(l.r.join("bin\t"), [0u8, 1, 2, 3, 4]).unwrap();
    l.git(&["mv", "r.txt", "r\t"]);
    let k2 = l.commit("K2");
    l.zeile("r\t", 3, "FREMD-r");
    l.commit("F2");
    l.git(&["mv", "r\t", "s\t"]);
    let k3 = l.commit("K3");
    l.karte(40, &[kd(&k1), kd(&k2), kd(&k3)]);
    let lauf = l.starten(&[]);
    let (d, _) = gesamt(&lauf.adresse, 40, "").await;
    eindeutig(&d);
    assert_eq!(schritte_von(eintrag(&d, "x\t")).iter().map(|s| (s.0.clone(), s.1.clone())).collect::<Vec<_>>(), [(kd(&k1), "A".into()), (kd(&k2), "M".into())]);
    let bin = eintrag(&d, "bin\t");
    assert_eq!((schritte_von(bin).len(), &bin["binaer"]), (2, &json!(true)), "{bin}");
    assert_eq!(schritte_von(eintrag(&d, "s\t")), [(kd(&k3), "R".into(), json!("r\t"), json!("s\t"), 0, 0)]);
    datei_auf_jeden_pfad(&lauf.adresse, 40, &d, &[]).await;
}

/// Die Antworten, die S1 und S2 vergleichen: Gesamt-Diff, `format=patch`, `datei=`, Commit-Liste, Diff je Commit.
async fn antworten(adresse: &str, l: &Lage) -> Vec<(u16, String)> {
    let mut v = vec![];
    for q in ["", "format=patch", "datei=a.txt", "datei=k.txt", &format!("commit={}", kodiert(&kd(&l.k1))), &format!("commit={}&format=patch", kodiert(&kd(&l.k2)))] {
        let a = holen(adresse, 2, q, None).await;
        v.push((a.status, a.text));
    }
    let liste = reqwest::get(format!("{adresse}api/aufgaben/2/commits")).await.unwrap();
    v.push((liste.status().as_u16(), liste.text().await.unwrap()));
    v
}

// S1 Abnahme-Probe: je eine getrackte und eine ungetrackte Datei mit dem Hash von Kartencommit, Elternteil und Basis →
// Gesamt-Diff, `format=patch`, `datei=` und die Commit-Liste antworten 200, bytegleich zur Antwort ohne diese Dateien
// (heute 404 `repository_fehlt` „ambiguous argument … both revision and filename“)
#[tokio::test]
async fn s1_dateien_mit_hash_namen() {
    let l = ausgangslage();
    let lauf = l.starten(&[]);
    let vorher = antworten(&lauf.adresse, &l).await;
    assert!(vorher.iter().all(|(s, _)| *s == 200), "{vorher:?}");
    // getrackt auf einem Seitenzweig (main bleibt, die Zweige der Commits auch), ungetrackt im Arbeitsbaum
    l.git(&["checkout", "-q", "-b", "hashnamen"]);
    for h in [&l.k1, &l.k2] {
        l.schreiben(h, "getrackt\n");
    }
    l.commit("Dateien mit Hash-Namen");
    l.git(&["checkout", "-q", "main"]);
    l.git(&["branch", "-q", "-D", "hashnamen"]);
    for h in [&l.k1, &l.a0, &l.f] {
        l.schreiben(h, "ungetrackt\n");
    }
    let mit = antworten(&lauf.adresse, &l).await;
    assert_eq!(mit, vorher, "bytegleich");
    // getrackt auf main: K1 und Basis als Dateien im Arbeitsbaum und im Index
    for h in [&l.k1, &l.a0] {
        std::fs::remove_file(l.r.join(h)).ok();
    }
    l.schreiben(&l.k2, "getrackt\n");
    l.schreiben(&l.a0, "getrackt\n");
    let neu = l.commit("Hash-Namen auf main");
    let _ = neu;
    let mit = antworten(&lauf.adresse, &l).await;
    assert_eq!(mit, vorher, "bytegleich, getrackt");
}

// S2 Abnahme-Probe: `git replace <K1> <evil>` → 200 ohne FREMD-Zeile, bytegleich zur Antwort ohne den Ref
#[tokio::test]
async fn s2_replace_refs_schmuggeln_nichts() {
    let l = ausgangslage();
    let lauf = l.starten(&[]);
    let vorher = antworten(&lauf.adresse, &l).await;
    l.git(&["checkout", "-q", "--detach", &l.a0]);
    l.zeile("a.txt", 2, "FREMD-evil");
    let evil = l.commit("K1");
    l.git(&["checkout", "-q", "main"]);
    l.git(&["replace", &l.k1, &evil]);
    assert!(l.git(&["show", &l.k1]).contains("+FREMD-evil"), "Gegenprobe: Git selbst folgt dem Ref");
    let mit = antworten(&lauf.adresse, &l).await;
    assert_eq!(mit, vorher, "bytegleich");
}

/// Legt `n` kleine Dateien `<ordner>/<i>.txt` an (ohne Commit).
fn viele(l: &Lage, ordner: &str, n: usize) {
    std::fs::create_dir_all(l.r.join(ordner)).unwrap();
    for i in 0..n {
        std::fs::write(l.r.join(format!("{ordner}/{i:05}.txt")), format!("{i}\n")).unwrap();
    }
}

fn hinweis<'a>(d: &'a Value, art: &str) -> Option<&'a Value> {
    d["hinweise"].as_array().unwrap().iter().find(|h| h["art"] == art)
}

// B3 Abnahme-Probe: mehr als 4 MB Namen allein in den Kartencommits → 200 mit höchstens 2.000 Einträgen und
// `dateien_gekappt`, nie 500; geprüft mit 1.000, 2.000, 2.001 und 42.000 Dateien in einem Kartencommit, dazu zwei
// Kartencommits zu je 21.000 Dateien mit einem fremden Commit dazwischen (heute 500 „Namen … länger als 4 MB“)
#[tokio::test]
async fn b3_namen_der_kartencommits_ueber_vier_mb() {
    let l = ausgangslage();
    let mut einzeln = vec![];
    for (nr, n) in [(50u32, 1000usize), (51, 2000), (52, 2001), (53, 42_000)] {
        viele(&l, &format!("v{nr}"), n);
        let k = l.commit(&format!("{n} Dateien"));
        l.karte(nr, &[kd(&k)]);
        einzeln.push((nr, n));
    }
    viele(&l, "va", 21_000);
    let ka = l.commit("Ka");
    l.zeile("a.txt", 10, "FREMD-v");
    l.commit("F");
    viele(&l, "vb", 21_000);
    let kb = l.commit("Kb");
    l.karte(54, &[kd(&ka), kd(&kb)]);
    let lauf = l.starten(&[]);
    for (nr, n) in einzeln {
        let (d, _) = gesamt(&lauf.adresse, nr, "").await;
        let gezeigt = n.min(2000);
        assert_eq!(dateien(&d).len(), gezeigt, "#{nr}");
        let kappe = (n > 2000).then(|| json!({"art": "dateien_gekappt", "gezeigt": 2000, "gesamt": n}));
        assert_eq!(d["hinweise"], json!(kappe.into_iter().collect::<Vec<_>>()), "#{nr}: nur die Kappe, keine Folge");
        assert!(dateien(&d).iter().all(|f| !ist_folge(f) && f["status"] == "A"), "#{nr}: ein Kartencommit ist netto");
    }
    let (d, _) = gesamt(&lauf.adresse, 54, "").await;
    assert_eq!(d["hinweise"][0], json!({"art": "ganz_als_folge", "grund": "fremd_zu_gross"}));
    let kappe = hinweis(&d, "dateien_gekappt").unwrap_or_else(|| panic!("{}", d["hinweise"]));
    assert_eq!((kappe["gezeigt"].as_u64(), kappe["gesamt"].as_u64()), (Some(dateien(&d).len() as u64), Some(42_000)));
    assert!(dateien(&d).len() <= 2000);
    let a = holen(&lauf.adresse, 54, "datei=va%2F00000.txt", None).await;
    assert_eq!((a.status, a.json()["fehler"].is_string()), (404, true), "datei= ohne vollständige Namen: {}", a.text);
}

/// Eine Zeile von 79 Zeichen mit Nummer.
fn zeile79(p: &str, i: usize) -> String {
    format!("{:<79}\n", format!("{p}-{i}"))
}

// B4 (a) Abnahme-Probe zu M5 „Folge bekommt den vollen Rest statt Rest nach Netto“: Netto 2 MB plus Folge 3 MB ergibt
// höchstens 4 MB Patch zusammen (FA 11)
#[tokio::test]
async fn b4a_vier_mb_zusammen() {
    let l = ausgangslage();
    for i in 0..10 {
        l.schreiben(&format!("n{i}.txt"), &(0..2500).map(|z| zeile79(&format!("n{i}"), z)).collect::<String>());
    }
    for i in 0..7 {
        l.schreiben(&format!("g{i}.txt"), &(0..2900).map(|z| zeile79(&format!("g{i}"), z)).collect::<String>());
    }
    let k1 = l.commit("K1");
    for i in 0..7 {
        l.zeile(&format!("g{i}.txt"), 1, "FREMD-g");
    }
    l.commit("F");
    for i in 0..7 {
        let alt = std::fs::read_to_string(l.r.join(format!("g{i}.txt"))).unwrap();
        l.schreiben(&format!("g{i}.txt"), &alt.lines().enumerate().map(|(z, t)| if (2..1402).contains(&z) { zeile79(&format!("K2-{i}"), z) } else { format!("{t}\n") }).collect::<String>());
    }
    let k2 = l.commit("K2");
    l.karte(60, &[kd(&k1), kd(&k2)]);
    let lauf = l.starten(&[]);
    let (d, _) = gesamt(&lauf.adresse, 60, "").await;
    let laenge = |f: &Value| f["patch"].as_str().map_or(0, str::len);
    let netto: Vec<&Value> = dateien(&d).iter().filter(|f| !ist_folge(f)).collect();
    let schritte: Vec<&Value> = dateien(&d).iter().filter(|f| ist_folge(f)).flat_map(|f| f["schritte"].as_array().unwrap()).collect();
    assert_eq!((netto.len(), schritte.len()), (10, 14));
    assert!(netto.iter().all(|f| f["patch"].is_string()), "Netto zuerst");
    let summe: usize = netto.iter().chain(&schritte).map(|f| laenge(f)).sum();
    assert!(summe > 3 << 20, "die Folge bekommt den Rest: {summe}");
    assert!(summe <= 4 << 20, "4 MB zusammen: {summe}");
    assert!(schritte.iter().any(|s| s["nachladen"] == true) && schritte.iter().any(|s| s["patch"].is_string()), "Rest reicht für einen Teil");
}

// B4 (b) Abnahme-Probe zu M10 „Pfadangabe D_karte nie zu lang“: D_karte über 1 MB → ganz als Folge mit fremd_zu_gross
#[tokio::test]
async fn b4b_pfadangabe_ueber_ein_mb() {
    let l = ausgangslage();
    let ordner = format!("lang/{}/{}/{}/{}", "a".repeat(240), "b".repeat(240), "c".repeat(240), "d".repeat(240));
    std::fs::create_dir_all(l.r.join(&ordner)).unwrap();
    for i in 0..1200 {
        std::fs::write(l.r.join(format!("{ordner}/{i:04}.txt")), format!("{i}\n")).unwrap();
    }
    let k1 = l.commit("K1");
    l.zeile("a.txt", 3, "FREMD-b4b");
    l.commit("F");
    l.zeile("a.txt", 4, "K2");
    let k2 = l.commit("K2");
    l.karte(61, &[kd(&k1), kd(&k2)]);
    assert!(1200 * (ordner.len() + 9) > 1 << 20);
    let lauf = l.starten(&[]);
    let (d, _) = gesamt(&lauf.adresse, 61, "").await;
    assert_eq!(d["hinweise"][0], json!({"art": "ganz_als_folge", "grund": "fremd_zu_gross"}), "{}", d["hinweise"]);
    assert!(d["spanne"].is_null() && dateien(&d).iter().all(ist_folge), "kein Netto-Eintrag: {}", d["hinweise"]);
}

// B4 (c) Abnahme-Probe zu M3/M4 „abgeschnittener Folge-Lauf“: Folge-Liste über 1 MB — ein Eintrag steht nur mit allen
// Schritten, der angefangene Commit zählt in `dateien_gekappt`; dazu Code-Review Sollte 3: werden alle Folge-Dateien
// verworfen, steht `fremd_dazwischen` trotzdem
#[tokio::test]
async fn b4c_folge_liste_abgeschnitten() {
    let l = ausgangslage();
    let mut karten = vec![];
    for (nr, zweiter) in [(62u32, 750usize), (63, 1500)] {
        let ordner = format!("lang{nr}/{}", "p".repeat(200));
        std::fs::create_dir_all(l.r.join(&ordner)).unwrap();
        let pfad = |i: usize| format!("{ordner}/{}{i:04}.txt", "q".repeat(186));
        for i in 0..1500 {
            std::fs::write(l.r.join(pfad(i)), "k1\n").unwrap();
        }
        let k1 = l.commit("K1");
        for i in 0..1500 {
            std::fs::write(l.r.join(pfad(i)), "k1\nFREMD\n").unwrap();
        }
        l.commit("F");
        for i in 0..zweiter {
            std::fs::write(l.r.join(pfad(i)), "k1\nFREMD\nk2\n").unwrap();
        }
        let k2 = l.commit("K2");
        l.karte(nr, &[kd(&k1), kd(&k2)]);
        karten.push((nr, zweiter, k1, (0..zweiter).map(pfad).collect::<std::collections::HashSet<_>>()));
    }
    let lauf = l.starten(&[]);
    for (nr, zweiter, k1, von_k2) in karten {
        let (d, _) = gesamt(&lauf.adresse, nr, "").await;
        let gezeigt = 1500 - zweiter;
        assert_eq!(dateien(&d).len(), gezeigt, "#{nr}");
        for f in dateien(&d) {
            assert!(!von_k2.contains(f["pfad"].as_str().unwrap()), "#{nr}: K2 berührt {} — der Eintrag fehlte ein Schritt", f["pfad"]);
            assert_eq!(schritte_von(f).iter().map(|s| (s.0.clone(), s.1.clone())).collect::<Vec<_>>(), [(kd(&k1), "A".to_string())]);
        }
        assert_eq!(hinweis(&d, "fremd_dazwischen"), Some(&json!({"art": "fremd_dazwischen", "commits": 1, "dateien": 1500})), "#{nr}: {}", d["hinweise"]);
        assert_eq!(hinweis(&d, "dateien_gekappt"), Some(&json!({"art": "dateien_gekappt", "gezeigt": gezeigt, "gesamt": 1500})), "#{nr}");
    }
}
