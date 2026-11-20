// R00206 (I0196, Karte #213): Diff eines Commits per API lesen — Akzeptanztests gegen das echte Programm und ein echtes
// Arbeits-Repository (Ausgangslage von R00204 mit X1 und G1, siehe `ausgangslage`). Schichten: Testfall (je AK) →
// Testsprache (`Lage`, `diff`, `spur`) → Treiber (`holen`: URL, Header, Status) → Programm.
mod gemeinsam;

use gemeinsam::{Laufendes, R204, ausgangslage_r00204, git, git_am, lies, senden, starten_mit};
use serde_json::{Value, json};
use std::os::unix::ffi::OsStrExt;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

const ADA: &str = "Ada Autorin";
const X1_DATUM: &str = "2026-03-05T09:00:00+00:00";

// ---- Treiber ----------------------------------------------------------------------------------------------------------

/// Eine Antwort, wie sie über die Leitung kam.
struct Antwort {
    status: u16,
    art: String,
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

/// Ausgangslage von R00206: R00204 dazu auf `main` X1 (a.txt Zeile 2 „zwei“ → „Zwei“, bild.bin neu, c.txt → c2.txt)
/// und G1 (gross.txt 3.001 Zeilen zu je 50 `x`, klein.txt eine Zeile); #1 trägt K3, W1, V1, V2, R1, X1, G1.
struct Lage {
    a: R204,
    x1: String,
    g1: String,
}

fn ausgangslage() -> Lage {
    let a = ausgangslage_r00204();
    std::fs::write(a.r.join("a.txt"), "eins\nzwei\n").unwrap();
    git_am(&a.r, ADA, "2026-03-04T12:00:00+00:00", &["commit", "-q", "-am", "a.txt vorbereiten"]);
    std::fs::write(a.r.join("a.txt"), "eins\nZwei\n").unwrap();
    std::fs::write(a.r.join("bild.bin"), [0u8, 1, 2, 3]).unwrap();
    git_am(&a.r, ADA, X1_DATUM, &["mv", "c.txt", "c2.txt"]);
    let x1 = commit(&a.r, "Text, Binär, Umbenennung");
    std::fs::write(a.r.join("gross.txt"), format!("{}\n", "x".repeat(50)).repeat(3001)).unwrap();
    std::fs::write(a.r.join("klein.txt"), "klein\n").unwrap();
    let g1 = commit(&a.r, "G1");
    let mut verweise = a.verweise();
    verweise.extend([format!("kd:{x1}"), format!("kd:{g1}")]);
    a.von_hand(&verweise);
    a.v2_entfernen();
    Lage { a, x1, g1 }
}

/// Ein Commit auf dem aktuellen Zweig von R mit allem, was im Arbeitsbaum liegt.
fn commit(r: &Path, nachricht: &str) -> String {
    git_am(r, ADA, X1_DATUM, &["add", "-A"]);
    git_am(r, ADA, X1_DATUM, &["commit", "-q", "--allow-empty", "-m", nachricht]);
    git_am(r, ADA, X1_DATUM, &["rev-parse", "HEAD"])
}

impl Lage {
    fn starten(&self, umgebung: &[(&str, &str)]) -> Laufendes {
        starten_mit(&self.a.board, &["--port", "0"], umgebung)
    }

    /// Mit Git-Spur: der Server schreibt `GIT_TRACE` in eine Datei.
    fn mit_spur(&self, umgebung: &[(&str, &str)]) -> (Laufendes, PathBuf) {
        let spur = self.a.basis.join("spur");
        let mut u = umgebung.to_vec();
        let pfad = spur.to_str().unwrap().to_string();
        u.push(("GIT_TRACE", &pfad));
        (self.starten(&u), spur)
    }

    /// Hängt Verweise an #1 an (von Hand, ohne kanbanD).
    fn anhaengen(&self, hashes: &[&str]) {
        let mut verweise: Vec<String> = serde_yaml::from_str::<Value>(lies(&self.a.board, "aufgaben/0001-commit-liste.md").split("---").nth(1).unwrap()).unwrap()["commits"].as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
        verweise.extend(hashes.iter().map(|h| format!("kd:{h}")));
        self.a.von_hand(&verweise);
    }
}

/// `GET …/diff?commit=kd:<hash>` mit Status 200; liefert den Rumpf.
async fn diff(adresse: &str, hash: &str) -> Value {
    let a = holen(adresse, 1, &format!("commit=kd:{hash}"), None).await;
    assert_eq!(a.status, 200, "{}", a.text);
    a.json()
}

fn dateien(d: &Value) -> &Vec<Value> {
    d["dateien"].as_array().unwrap()
}

fn datei<'a>(d: &'a Value, name: &str) -> &'a Value {
    dateien(d).iter().find(|f| f["neu"] == name || (f["neu"].is_null() && f["alt"] == name)).unwrap_or_else(|| panic!("{name} fehlt: {d}"))
}

/// Die Läufe des Startorts im Arbeits-Repository aus der Git-Spur seit `ab` Zeilen.
fn spur(datei: &Path) -> Vec<String> {
    let text = std::fs::read_to_string(datei).unwrap_or_default();
    let befehle = ["git rev-parse --show-toplevel", "git cat-file --batch-check", "git log --no-ext-diff", "git diff-tree", "git for-each-ref", "git rev-list", "--contains"];
    text.lines().filter(|z| z.contains("trace: built-in:") && befehle.iter().any(|b| z.contains(b))).map(String::from).collect()
}

fn spur_leeren(datei: &Path) {
    let _ = std::fs::write(datei, "");
}

/// Ein `git` vorn im PATH des Servers; für Läufe des Startorts in R (Pfad und `core.hooksPath=/dev/null` in den
/// Argumenten) führt es `bei_r` aus (dort steht `$echt` für das echte Git), alles andere geht ans echte Git.
fn git_skript(a: &R204, bei_r: &str) -> String {
    let echt = String::from_utf8(std::process::Command::new("sh").args(["-c", "command -v git"]).output().unwrap().stdout).unwrap().trim().to_string();
    let ordner = a.basis.join("bin");
    std::fs::create_dir_all(&ordner).unwrap();
    let skript = format!("#!/bin/sh\necht={echt}\ncase \"$*\" in *\"{r}\"*core.hooksPath=/dev/null*)\n{bei_r}\n;; esac\nexec $echt \"$@\"\n", r = a.r.display());
    std::fs::write(ordner.join("git"), skript).unwrap();
    std::fs::set_permissions(ordner.join("git"), std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    format!("{}:{}", ordner.display(), std::env::var("PATH").unwrap())
}

fn lebt(pid: &str) -> bool {
    let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).unwrap_or_default();
    !stat.is_empty() && !stat.rsplit(')').next().unwrap_or_default().trim_start().starts_with('Z')
}

/// Arbeitsbaum, Objekte und Zeitstempel unter `.git` — „nur lesend“ heißt: alles gleich, keine `index.lock`.
fn r_stand(r: &Path) -> (String, String, Vec<(PathBuf, std::time::SystemTime)>) {
    let mut zeiten = vec![];
    let mut offen = vec![r.join(".git")];
    while let Some(d) = offen.pop() {
        for e in std::fs::read_dir(&d).unwrap().flatten() {
            let p = e.path();
            if p.is_dir() {
                offen.push(p);
            } else {
                zeiten.push((p.clone(), e.metadata().unwrap().modified().unwrap()));
            }
        }
    }
    zeiten.sort();
    let status = std::process::Command::new("git").arg("-C").arg(r).args(["status", "--porcelain"]).env("GIT_OPTIONAL_LOCKS", "0").output().unwrap();
    (String::from_utf8_lossy(&status.stdout).into_owned(), git(r, &["count-objects", "-v"]), zeiten)
}

// ---- AK 1: Text, Binär, Umbenennung (Abnahme-Probe der Karte) · US-1 -------------------------------------------------

#[tokio::test]
async fn ak01_text_binaer_umbenennung() {
    let l = ausgangslage();
    let (lauf, spurdatei) = l.mit_spur(&[]);
    let (datei_vorher, zahl) = (lies(&l.a.board, "aufgaben/0001-commit-liste.md"), l.a.commit_zahl());
    let r_vorher = r_stand(&l.a.r);
    spur_leeren(&spurdatei);
    let a = holen(&lauf.adresse, 1, &format!("commit=kd:{}", l.x1), None).await;
    assert_eq!(a.status, 200, "{}", a.text);
    assert!(a.art.starts_with("application/json") && a.nosniff, "{} {}", a.art, a.nosniff);
    let d = a.json();
    assert_eq!(d["anwendung"], "kd");
    assert_eq!(d["dateien"], json!([
        {"alt": "a.txt", "neu": "a.txt", "status": "M", "plus": 1, "minus": 1, "binaer": false, "gross": false, "nachladen": false, "nicht_utf8": false, "patch": "@@ -1,2 +1,2 @@\n eins\n-zwei\n+Zwei\n"},
        {"neu": "bild.bin", "status": "A", "plus": 0, "minus": 0, "binaer": true, "gross": false, "nachladen": false, "nicht_utf8": false},
        {"alt": "c.txt", "neu": "c2.txt", "status": "R", "aehnlichkeit": 100, "plus": 0, "minus": 0, "binaer": false, "gross": false, "nachladen": false, "nicht_utf8": false}
    ]));
    assert_eq!(d["hinweise"], json!([]));
    let spur_diff = spur(&spurdatei);
    assert!(!spur_diff.iter().any(|z| z.contains("--contains") || z.contains("for-each-ref") || z.contains("rev-list")), "keine Zweigliste: {spur_diff:?}");
    let liste: Value = reqwest::get(format!("{}api/aufgaben/1/commits", lauf.adresse)).await.unwrap().json().await.unwrap();
    let mut eintrag = liste["commits"].as_array().unwrap().iter().find(|e| e["hash"] == l.x1.as_str()).unwrap().clone();
    let e = eintrag.as_object_mut().unwrap();
    e.remove("zustand");
    e.remove("zweige");
    e.remove("entfernte_zweige");
    assert_eq!(d["commits"], json!([eintrag]), "wie die Liste, ohne Zustand und Zweige");
    assert_eq!(d["commits"][0]["dateien"], 3);
    assert_eq!((lies(&l.a.board, "aufgaben/0001-commit-liste.md"), l.a.commit_zahl()), (datei_vorher, zahl), "GET schreibt nie");
    assert_eq!(r_stand(&l.a.r), r_vorher, "in R nichts geändert");
}

// ---- AK 2: Zulassung und Zustände, Gegenprobe Liste gegen Diff · US-2 ---------------------------------------------------

#[tokio::test]
async fn ak02_zulassung_und_zustaende() {
    let l = ausgangslage();
    let a = &l.a;
    // R00204 AK 4: eine Anwendung, deren Ordner kein Repository ist; zwei Commit-Objekte mit demselben 7er-Präfix
    let kein_repo = a.basis.join("kein-repo/Planung");
    std::fs::create_dir_all(&kein_repo).unwrap();
    let register = format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\n  entw1: {{name: Entwickler, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {r}/Dokumentation/Planung/app.md, requirements: \"\"}}\n    zz: {{name: ZZ, wbs: {kein}/app.md, requirements: \"\"}}\n---\n", r = a.r.display(), kein = kein_repo.display());
    std::fs::write(a.board.join("kanbanD.md"), register).unwrap();
    git(&a.board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-am", "Register"]);
    for n in [18876, 29727] {
        let pfad = a.basis.join("objekt");
        std::fs::write(&pfad, format!("tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904\nauthor A <a@a> 0 +0000\ncommitter A <a@a> 0 +0000\n\n{n}\n")).unwrap();
        git(&a.r, &["hash-object", "-w", "-t", "tree", "/dev/null"]);
        assert!(git(&a.r, &["hash-object", "-w", "-t", "commit", pfad.to_str().unwrap()]).starts_with("7f62b7e"));
    }
    let blob = git(&a.r, &["rev-parse", &format!("{}:a.txt", a.k1)]);
    let baum = git(&a.r, &["rev-parse", &format!("{}^{{tree}}", a.k1)]);
    git(&a.r, &["-c", "user.name=A", "-c", "user.email=a@a", "tag", "-a", "-m", "t", "t1", &a.k2]);
    let tag = git(&a.r, &["rev-parse", "t1"]);
    let fremde = [format!("xy:{}", a.k1), format!("zz:{}", a.k1), "kd:7f62b7e".to_string(), format!("kd:{blob}"), format!("kd:{baum}"), format!("kd:{tag}")];
    let mut verweise: Vec<String> = a.verweise();
    verweise.extend([format!("kd:{}", l.x1)]);
    verweise.extend(fremde.iter().cloned());
    a.von_hand(&verweise);
    let lauf = l.starten(&[]);
    let liste: Value = reqwest::get(format!("{}api/aufgaben/1/commits", lauf.adresse)).await.unwrap().json().await.unwrap();
    let liste = liste["commits"].as_array().unwrap().clone();
    let mut gesehen = std::collections::BTreeSet::new();
    for eintrag in &liste {
        let verweis = eintrag["verweis"].as_str().unwrap();
        let antwort = holen(&lauf.adresse, 1, &format!("commit={}", kodiert(verweis)), None).await;
        let zustand = eintrag["zustand"].as_str().unwrap();
        gesehen.insert(zustand.to_string());
        if zustand == "auf_zweig" || zustand == "verwaist" {
            assert_eq!(antwort.status, 200, "{verweis} ({zustand}): {}", antwort.text);
        } else {
            let r = antwort.json();
            assert_eq!((antwort.status, &r["zustand"], &r["grund"]), (404, &eintrag["zustand"], &eintrag["grund"]), "{verweis}: Diff {} gegen Liste {eintrag}", antwort.text);
            assert!(r["fehler"].is_string());
        }
    }
    assert_eq!(gesehen.into_iter().collect::<Vec<_>>(), ["anwendung_unbekannt", "auf_zweig", "fehlt", "repository_fehlt", "unlesbar", "verwaist"], "alle sechs Zustände durch Liste und Diff");
    for (h, name) in [(&a.k3, "c.txt"), (&a.w1, "b.txt"), (&a.v1, "v.txt")] {
        let d = diff(&lauf.adresse, h).await;
        assert_eq!((dateien(&d).len(), &datei(&d, name)["status"]), (1, &json!("A")), "{name}");
    }
    for h in [&blob, &baum, &tag, &a.v2] {
        let r = holen(&lauf.adresse, 1, &format!("commit=kd:{h}"), None).await;
        assert_eq!((r.status, r.json()["zustand"].as_str()), (404, Some("fehlt")), "{h}");
    }
    let r = holen(&lauf.adresse, 999, &format!("commit=kd:{}", a.k3), None).await;
    assert_eq!((r.status, r.json()["zustand"].is_null(), r.json()["fehler"].is_string()), (404, true, true));
    std::fs::write(a.board.join("aufgaben/0003-defekt.md"), "---\nid: 3\ntitle: [kaputt\n---\n").unwrap();
    assert_eq!(holen(&lauf.adresse, 3, &format!("commit=kd:{}", a.k3), None).await.status, 423);
}

// ---- AK 3: der Parameter commit ---------------------------------------------------------------------------------------

#[tokio::test]
async fn ak03_parameter_commit() {
    let l = ausgangslage();
    // ein zweiter Verweis an #1, der mit demselben Präfix beginnt wie K3
    l.anhaengen(&[&l.a.k3[..12]]);
    let (lauf, spurdatei) = l.mit_spur(&[]);
    let d = holen(&lauf.adresse, 1, &format!("commit=kd:{}", &l.x1[..7]), None).await;
    assert_eq!((d.status, d.json()["commits"][0]["verweis"].as_str()), (200, Some(format!("kd:{}", l.x1).as_str())), "Präfix ab 7, verweis wörtlich wie in der Datei");
    let d = holen(&lauf.adresse, 1, &format!("commit=kd:{}", l.x1.to_uppercase()), None).await;
    assert_eq!(d.status, 200, "Großbuchstaben");
    spur_leeren(&spurdatei);
    // ohne commit: der Gesamt-Diff der Karte (R00208 AK 6 ersetzt „ohne commit 400“ aus R00206 FA 11, AK 3)
    let r = holen(&lauf.adresse, 1, "", None).await;
    assert_eq!((r.status, r.json()["dateien"].is_array()), (200, true), "ohne commit: Gesamt-Diff — {}", r.text);
    spur_leeren(&spurdatei);
    for boese in ["kd:3f2a9c".to_string(), "kd:main".into(), "kd:--output=x".into(), format!("kd:{}^{{tree}}", l.a.k1), format!("kd:{}", &l.a.k3[..7])] {
        let r = holen(&lauf.adresse, 1, &format!("commit={}", kodiert(&boese)), None).await;
        assert_eq!((r.status, r.json()["verweis"].as_str()), (400, Some(boese.as_str())), "{boese}: {}", r.text);
        assert!(r.json()["fehler"].is_string());
    }
    let r = holen(&lauf.adresse, 1, &format!("commit=kd:{}", l.a.k1), None).await;
    assert_eq!((r.status, r.json()["verweis"].as_str(), r.json()["zustand"].is_null()), (404, Some(format!("kd:{}", l.a.k1).as_str()), true), "Commit, aber nicht an #1");
    let r = holen(&lauf.adresse, 1, &format!("commit=kd:{}&format=xyz", l.x1), None).await;
    assert_eq!(r.status, 400);
    assert_eq!(spur(&spurdatei), Vec::<String>::new(), "keine Abweisung startet Git");
}

// ---- AK 4: was verglichen wird ----------------------------------------------------------------------------------------

#[tokio::test]
async fn ak04_wurzel_merge_und_leerer_commit() {
    let l = ausgangslage();
    let r = &l.a.r;
    git_am(r, ADA, X1_DATUM, &["checkout", "-q", "-b", "seite"]);
    std::fs::write(r.join("d4.txt"), "1\n2\n3\n4\n").unwrap();
    commit(r, "d4");
    git_am(r, ADA, X1_DATUM, &["checkout", "-q", "main"]);
    git_am(r, ADA, X1_DATUM, &["merge", "-q", "--no-ff", "-m", "Merge", "seite"]);
    let merge = git(r, &["rev-parse", "HEAD"]);
    let leer = commit(r, "leer");
    l.anhaengen(&[&l.a.k1, &merge, &leer]);
    let lauf = l.starten(&[]);
    let d = diff(&lauf.adresse, &merge).await;
    assert_eq!((dateien(&d).len(), &datei(&d, "d4.txt")["status"], &datei(&d, "d4.txt")["plus"]), (1, &json!("A"), &json!(4)), "gegen den ersten Elternteil");
    // K1 der Ausgangslage von R00204 legt die WBS-Datei und a.txt (2 Zeilen) an
    let d = diff(&lauf.adresse, &l.a.k1).await;
    assert!(dateien(&d).iter().all(|f| f["status"] == "A"), "Wurzel gegen den leeren Baum: {d}");
    assert_eq!((dateien(&d).len(), &datei(&d, "a.txt")["plus"]), (2, &json!(2)));
    let d = diff(&lauf.adresse, &leer).await;
    assert_eq!((&d["dateien"], &d["commits"][0]["dateien"], &d["hinweise"]), (&json!([]), &json!(0), &json!([])));
}

// ---- AK 6, AK 18: Pfade, Zeichen und feindlicher Inhalt nur als Daten · US-5 ---------------------------------------

#[tokio::test]
async fn ak06_ak18_fremder_inhalt_nur_als_daten() {
    let l = ausgangslage();
    let r = &l.a.r;
    let namen = ["ä ö.txt", "mit Leerzeichen.txt", "-x.txt", "a\"b.txt", "a\\b.txt", "t\tb.txt", "n\ndiff --git a/y b/y.txt", "esc\u{1b}.txt", "<script>alert(1)</script>.txt", "bidi\u{202e}.txt"];
    for (i, n) in namen.iter().enumerate() {
        std::fs::create_dir_all(r.join(n).parent().unwrap()).unwrap();
        std::fs::write(r.join(n), format!("inhalt {i}\n")).unwrap();
    }
    for roh in [&b"a\xe4.txt"[..], b"a\xf6.txt"] {
        std::fs::write(r.join(std::ffi::OsStr::from_bytes(roh)), b"latin\n").unwrap();
    }
    let namen_commit = commit(r, "Namen");
    let inhalt = format!("</script><img src=x onerror=alert(1)>\n\u{1b}[31mrot\n\tTab\nCRLF\r\nU+2028 \u{2028} U+0085 \u{85}\n{}\n", "z".repeat(100_000));
    std::fs::write(r.join("feind.txt"), &inhalt).unwrap();
    git_am(r, ADA, X1_DATUM, &["add", "-A"]);
    let aus = std::process::Command::new("git").arg("-C").arg(r).args(["-c", "user.email=m@m", "commit", "-q", "-m", "<script>alert(1)</script> \"x\" \\ y"]).env("GIT_AUTHOR_NAME", "Mallory <img src=x>").env("GIT_COMMITTER_NAME", "C").output().unwrap();
    assert!(aus.status.success());
    let feind = git(r, &["rev-parse", "HEAD"]);
    std::fs::write(r.join("latin.txt"), b"caf\xe9\n").unwrap();
    git_am(r, ADA, X1_DATUM, &["add", "-A"]);
    git_am(r, ADA, X1_DATUM, &["-c", "i18n.commitEncoding=latin1", "commit", "-q", "-m", "latin"]);
    let latin = git(r, &["rev-parse", "HEAD"]);
    l.anhaengen(&[&namen_commit, &feind, &latin]);
    let lauf = l.starten(&[]);
    let d = diff(&lauf.adresse, &namen_commit).await;
    for (i, n) in namen.iter().enumerate() {
        let f = datei(&d, n);
        assert_eq!(f["patch"], format!("@@ -0,0 +1 @@\n+inhalt {i}\n"), "{n:?}: eigener Patch");
        // gegen git diff-tree -p je Datei
        let p = git(r, &["--literal-pathspecs", "diff-tree", "-p", &format!("{namen_commit}^"), &namen_commit, "--", n]);
        assert!(p.ends_with(&format!("+inhalt {i}")), "{n:?}: {p}");
    }
    let latin1: Vec<&Value> = dateien(&d).iter().filter(|f| f["nicht_utf8"] == true).collect();
    assert_eq!(latin1.iter().map(|f| f["neu"].as_str().unwrap()).collect::<Vec<_>>(), ["a\u{fffd}.txt", "a\u{fffd}.txt"]);
    let beide = holen(&lauf.adresse, 1, &format!("commit=kd:{namen_commit}&datei={}", kodiert("a\u{fffd}.txt")), None).await;
    assert_eq!((beide.status, dateien(&beide.json()).len()), (200, 2), "datei=a�.txt liefert beide");
    let a = holen(&lauf.adresse, 1, &format!("commit=kd:{feind}"), None).await;
    assert!(a.art.starts_with("application/json") && a.nosniff);
    let d = a.json();
    assert_eq!(d["commits"][0]["titel"], "<script>alert(1)</script> \"x\" \\ y");
    assert_eq!(d["commits"][0]["autor"], git(r, &["log", "-1", "--format=%an", &feind]));
    assert!(!d["commits"][0]["autor"].as_str().unwrap().contains('@'), "ohne E-Mail");
    let patch: String = inhalt.lines().map(|z| format!("+{z}\n")).collect::<String>().replace("+CRLF\n", "+CRLF\r\n");
    assert_eq!(datei(&d, "feind.txt")["patch"], format!("@@ -0,0 +1,6 @@\n{patch}"), "zeichengleich, \\r bleibt");
    let d = diff(&lauf.adresse, &latin).await;
    assert_eq!((&datei(&d, "latin.txt")["nicht_utf8"], &datei(&d, "latin.txt")["patch"]), (&json!(true), &json!("@@ -0,0 +1 @@\n+caf\u{fffd}\n")));
}

// ---- US-3: große Dateien kommen als Merkmal (AK 7, AK 8, AK 11 im echten Programm) ---------------------------------

#[tokio::test]
async fn us3_grosse_dateien_als_merkmal() {
    let l = ausgangslage();
    let r = &l.a.r;
    std::fs::write(r.join("lang.txt"), format!("{}\n", "a".repeat(300_000))).unwrap();
    let lang = commit(r, "lang");
    let inhalt = format!("{}\n", "a".repeat(99)).repeat(2000);
    for i in 1..=25 {
        std::fs::write(r.join(format!("f{i:02}.txt")), &inhalt).unwrap();
    }
    let h = commit(r, "gross");
    l.anhaengen(&[&lang, &h]);
    let lauf = l.starten(&[]);
    let d = diff(&lauf.adresse, &l.g1).await;
    assert_eq!((&datei(&d, "gross.txt")["gross"], &datei(&d, "gross.txt")["plus"], datei(&d, "gross.txt").get("patch")), (&json!(true), &json!(3001), None));
    assert!(datei(&d, "klein.txt")["patch"].is_string());
    let einzeln = holen(&lauf.adresse, 1, &format!("commit=kd:{}&datei=gross.txt", l.g1), None).await.json();
    assert_eq!((dateien(&einzeln).len(), &datei(&einzeln, "gross.txt")["gross"], datei(&einzeln, "gross.txt")["patch"].is_string()), (1, &json!(false), true));
    let d = diff(&lauf.adresse, &lang).await;
    assert_eq!((&datei(&d, "lang.txt")["gross"], &datei(&d, "lang.txt")["plus"], datei(&d, "lang.txt").get("patch")), (&json!(true), &json!(1), None), "eine Zeile, aber 300.000 Byte");
    let d = diff(&lauf.adresse, &h).await;
    let nach: Vec<bool> = (1..=25).map(|i| datei(&d, &format!("f{i:02}.txt"))["nachladen"] == true).collect();
    assert_eq!(nach, [vec![false; 20], vec![true; 5]].concat());
    for i in 21..=25 {
        let e = holen(&lauf.adresse, 1, &format!("commit=kd:{h}&datei=f{i:02}.txt"), None).await.json();
        assert_eq!((datei(&e, &format!("f{i:02}.txt"))["patch"].as_str().map(str::len), &datei(&e, &format!("f{i:02}.txt"))["nachladen"]), (Some(202_019), &json!(false)));
    }
}

// ---- AK 9: die Ausgabe wird mit Abbruch gelesen · US-4 ---------------------------------------------------------------

/// Ein Git-Skript: der Patch-Lauf (`diff-tree` ohne `--raw` und `--numstat`) schreibt die Kopfzeilen von riesig.txt und
/// danach endlos `+aaaa…`-Zeilen, je MB die Zahl der geschriebenen Bytes in `zaehler`; alles andere geht ans echte Git.
/// Die Zeile `index` trägt wie bei `--full-index` die vollen Hashes (`blob`: der Blob von riesig.txt) — sonst wäre das
/// Stück fremd (ADR-0032 N5.2).
fn endlos_skript(a: &R204, blob: &str) -> String {
    let zaehler = a.basis.join("zaehler");
    let zeile = format!("+{}", "a".repeat(1023));
    git_skript(a, &format!("case \"$*\" in *diff-tree*--raw*|*diff-tree*--numstat*) ;; *diff-tree*)\necho $$ >> {pids}\nprintf 'diff --git a/riesig.txt b/riesig.txt\\nnew file mode 100644\\nindex 0000000000000000000000000000000000000000..{blob}\\n--- /dev/null\\n+++ b/riesig.txt\\n@@ -0,0 +1,3 @@\\n'\nn=0\nwhile :; do if yes '{zeile}' | head -c 1048576; then n=$((n+1048576)); echo $n > {z}; else sleep 60; fi; done\n;; esac", pids = a.basis.join("pids").display(), z = zaehler.display()))
}

#[tokio::test]
async fn ak09_ausgabe_mit_abbruch() {
    let l = ausgangslage();
    std::fs::write(l.a.r.join("riesig.txt"), "1\n2\n3\n").unwrap();
    let h = commit(&l.a.r, "riesig");
    l.anhaengen(&[&h]);
    let pfad = endlos_skript(&l.a, &git(&l.a.r, &["rev-parse", &format!("{h}:riesig.txt")]));
    let lauf = l.starten(&[("PATH", &pfad)]);
    for (abfrage, hoechstens, hinweise) in [(format!("commit=kd:{h}"), 5 << 20, json!([])), (format!("commit=kd:{h}&datei=riesig.txt"), 9 << 20, json!([{"art": "zu_gross_zum_anzeigen", "datei": "riesig.txt"}]))] {
        let _ = std::fs::remove_file(l.a.basis.join("pids"));
        let start = Instant::now();
        let a = holen(&lauf.adresse, 1, &abfrage, None).await;
        assert!(start.elapsed() <= Duration::from_secs(15), "{:?}", start.elapsed());
        assert_eq!(a.status, 200, "{abfrage}: {}", a.text);
        let d = a.json();
        let f = datei(&d, "riesig.txt");
        assert_eq!((&f["gross"], f.get("patch")), (&json!(true), None), "{abfrage}");
        assert_eq!(d["hinweise"], hinweise, "{abfrage}");
        let gezaehlt: usize = lies(&l.a.basis, "zaehler").trim().parse().unwrap();
        assert!(gezaehlt <= hoechstens, "{abfrage}: {gezaehlt} Byte geschrieben");
        tokio::time::sleep(Duration::from_millis(300)).await;
        for p in lies(&l.a.basis, "pids").split_whitespace() {
            assert!(!lebt(p), "{abfrage}: Prozess {p} lebt");
        }
    }
}

// ---- AK 10: Zahl der Dateien, Zeilengrenze vor dem Patch-Lauf · US-4 --------------------------------------------------

#[tokio::test]
async fn ak10_zahl_der_dateien_und_zeilengrenze() {
    let l = ausgangslage();
    let r = &l.a.r;
    for i in 0..2000 {
        std::fs::write(r.join(format!("n{i:04}.txt")), format!("{i}\n")).unwrap();
    }
    let n2000 = commit(r, "2000");
    for i in 0..2001 {
        std::fs::write(r.join(format!("m{i:04}.txt")), format!("m{i}\n")).unwrap();
    }
    let n2001 = commit(r, "2001");
    for i in 0..3000 {
        std::fs::write(r.join(format!("o{i:04}.txt")), format!("o{i}\n")).unwrap();
    }
    let n3000 = commit(r, "3000");
    l.anhaengen(&[&n2000, &n2001, &n3000]);
    // zählt die Ausgabebytes jedes Laufs im Arbeits-Repository
    let zaehler = l.a.basis.join("bytes");
    let pfad = git_skript(&l.a, &format!("t=$(mktemp); $echt \"$@\" > $t; rc=$?; wc -c < $t >> {}; cat $t; rm -f $t; exit $rc", zaehler.display()));
    let lauf = l.starten(&[("PATH", &pfad)]);
    let d = diff(&lauf.adresse, &n2000).await;
    assert_eq!((dateien(&d).len(), &d["hinweise"]), (2000, &json!([])));
    for (h, gesamt) in [(&n2001, 2001), (&n3000, 3000)] {
        let d = diff(&lauf.adresse, h).await;
        assert_eq!((dateien(&d).len(), &d["commits"][0]["dateien"], &d["hinweise"]), (2000, &json!(gesamt), &json!([{"art": "dateien_gekappt", "gezeigt": 2000, "gesamt": gesamt}])));
        assert!(dateien(&d).iter().all(|f| f["plus"] == 1), "keine gezeigte Datei ohne Zähler");
    }
    let _ = std::fs::remove_file(&zaehler);
    let d = diff(&lauf.adresse, &l.g1).await;
    assert_eq!((&datei(&d, "gross.txt")["gross"], &datei(&d, "gross.txt")["plus"], datei(&d, "gross.txt").get("patch")), (&json!(true), &json!(3001), None));
    assert!(datei(&d, "klein.txt")["patch"].is_string());
    let summe: usize = lies(&l.a.basis, "bytes").split_whitespace().map(|z| z.parse::<usize>().unwrap()).sum();
    assert!(summe < 156_052 / 2, "{summe} Byte: der Patch von gross.txt wurde nie erzeugt");
}

// ---- AK 11: einzeln nachladen, nur Pfade aus der Dateiliste --------------------------------------------------------

#[tokio::test]
async fn ak11_einzeln_nachladen() {
    let l = ausgangslage();
    let r = &l.a.r;
    std::fs::write(r.join("a*b.txt"), "stern\n").unwrap();
    std::fs::write(r.join("axb.txt"), "x b\n").unwrap();
    std::fs::remove_file(r.join("klein.txt")).unwrap();
    let h = commit(r, "Stern");
    l.anhaengen(&[&h]);
    let (lauf, spurdatei) = l.mit_spur(&[]);
    let e = holen(&lauf.adresse, 1, &format!("commit=kd:{h}&datei={}", kodiert("a*b.txt")), None).await.json();
    assert_eq!(dateien(&e).iter().map(|f| f["neu"].as_str().unwrap()).collect::<Vec<_>>(), ["a*b.txt"]);
    let e = holen(&lauf.adresse, 1, &format!("commit=kd:{h}&datei=klein.txt"), None).await.json();
    assert_eq!((&datei(&e, "klein.txt")["status"], &datei(&e, "klein.txt")["patch"]), (&json!("D"), &json!("@@ -1 +0,0 @@\n-klein\n")), "gelöscht über alt");
    spur_leeren(&spurdatei);
    for fremd in ["*", ":(top)a.txt", "../a.txt", "-x", "fehlt.txt"] {
        let a = holen(&lauf.adresse, 1, &format!("commit=kd:{h}&datei={}", kodiert(fremd)), None).await;
        assert_eq!((a.status, a.json()["fehler"].is_string()), (404, true), "{fremd}: {}", a.text);
        assert!(!a.json()["fehler"].as_str().unwrap().contains("zu groß"), "{fremd}");
    }
    for zu in ["a.txt%00".to_string(), "x".repeat(5000)] {
        assert_eq!(holen(&lauf.adresse, 1, &format!("commit=kd:{h}&datei={zu}"), None).await.status, 400, "{}", &zu[..8]);
    }
    let pfadangaben: Vec<String> = spur(&spurdatei).into_iter().filter(|z| z.contains(" -- ")).collect();
    assert_eq!(pfadangaben, Vec::<String>::new(), "kein fremder Text erreicht Git als Pfadangabe");
    // eine bis zur Grenze abgeschnittene Dateiliste: 404 mit dem Grund
    let pfad = git_skript(&l.a, "case \"$*\" in *diff-tree*--raw*) while :; do printf ':000000 100644 0000000000000000000000000000000000000000 1111111111111111111111111111111111111111 A\\0%01000d\\0' 0; done;; esac");
    let lauf = l.starten(&[("PATH", &pfad)]);
    let a = holen(&lauf.adresse, 1, &format!("commit=kd:{h}&datei=fehlt.txt"), None).await;
    assert_eq!(a.status, 404, "{}", a.text);
    assert!(a.json()["fehler"].as_str().unwrap().contains("Dateiliste zu groß"), "{}", a.text);
    // auch die Liste liest die Dateiliste mit Grenze: der endlose Lauf endet bei 1 MB, nicht an der Gesamtgrenze
    let start = Instant::now();
    let a = holen(&lauf.adresse, 1, &format!("commit=kd:{h}"), None).await;
    assert!(a.status != 503 && start.elapsed() < Duration::from_secs(5), "{} nach {:?}", a.status, start.elapsed());
}

// ---- AK 12: format=patch und ETag · US-8 ------------------------------------------------------------------------------

#[tokio::test]
async fn ak12_format_patch_und_etag() {
    let l = ausgangslage();
    let inhalt = format!("{}\n", "a".repeat(99)).repeat(2000);
    for i in 1..=25 {
        std::fs::write(l.a.r.join(format!("f{i:02}.txt")), &inhalt).unwrap();
    }
    std::fs::write(l.a.r.join("a-latin.txt"), b"caf\xe9\n").unwrap();
    let h = commit(&l.a.r, "25");
    l.anhaengen(&[&h]);
    let (lauf, spurdatei) = l.mit_spur(&[]);
    let json = holen(&lauf.adresse, 1, &format!("commit=kd:{}", l.x1), None).await;
    let t = holen(&lauf.adresse, 1, &format!("commit=kd:{}&format=patch", l.x1), None).await;
    assert_eq!((t.status, t.art.as_str(), t.nosniff), (200, "text/x-diff; charset=utf-8", true));
    assert!(t.text.contains(&format!("diff --git a/a.txt b/a.txt\nindex ")) && t.text.contains(json.json()["dateien"][0]["patch"].as_str().unwrap()), "{}", t.text);
    assert!(t.text.contains("Binary files /dev/null and b/bild.bin differ\n"), "{}", t.text);
    assert!(t.text.contains("diff --git a/c.txt b/c2.txt\nsimilarity index 100%\nrename from c.txt\nrename to c2.txt\n"), "{}", t.text);
    let g = holen(&lauf.adresse, 1, &format!("commit=kd:{}&format=patch", l.g1), None).await;
    assert!(g.text.contains("diff --git a/gross.txt b/gross.txt\n# kanbanD: Patch fehlt (gross)\n"), "{}", g.text);
    let n = holen(&lauf.adresse, 1, &format!("commit=kd:{h}&format=patch"), None).await;
    for i in 21..=25 {
        assert!(n.text.contains(&format!("diff --git a/f{i:02}.txt b/f{i:02}.txt\n# kanbanD: Patch fehlt (nachladen), laden mit &datei=f{i:02}.txt\n")), "f{i}");
    }
    assert!(n.text.contains("+caf\u{fffd}\n"), "Latin-1 mit Ersatzzeichen");
    let e = holen(&lauf.adresse, 1, &format!("commit=kd:{h}&format=patch&datei=f21.txt"), None).await;
    assert_eq!((e.text.matches("diff --git").count(), e.text.contains("+aaaa")), (1, true), "mit datei= nur diese Datei");
    // ETag: 304 ohne Rumpf und ohne Git; anderes datei oder format → 200
    let etag = json.etag.clone().expect("ETag");
    spur_leeren(&spurdatei);
    let n = holen(&lauf.adresse, 1, &format!("commit=kd:{}", l.x1), Some(&etag)).await;
    assert_eq!((n.status, n.text.as_str(), n.etag.as_deref()), (304, "", Some(etag.as_str())));
    assert_eq!(spur(&spurdatei), Vec::<String>::new(), "304 ohne Git");
    assert_eq!(holen(&lauf.adresse, 1, &format!("commit=kd:{}&format=patch", l.x1), Some(&etag)).await.status, 200);
    assert_eq!(holen(&lauf.adresse, 1, &format!("commit=kd:{}&datei=a.txt", l.x1), Some(&etag)).await.status, 200);
    assert_ne!(t.etag, json.etag, "format im ETag");
    // ein Verweis, der nicht mehr an der Karte steht: 404, kein 304
    l.a.von_hand(&[format!("kd:{}", l.a.k3)]);
    assert_eq!(holen(&lauf.adresse, 1, &format!("commit=kd:{}", l.x1), Some(&etag)).await.status, 404);
}

// ---- AK 13: Zeitgrenze und 503 · US-7 --------------------------------------------------------------------------------

#[tokio::test]
async fn ak13_zeitgrenze_und_503() {
    let l = ausgangslage();
    let pids = l.a.basis.join("pids");
    let schalter = l.a.basis.join("schalter");
    std::fs::write(&schalter, "").unwrap();
    let pfad = git_skript(&l.a, &format!("if [ -e {s} ]; then echo $$ >> {p}; sleep 300 & echo $! >> {p}; sleep 60; fi", s = schalter.display(), p = pids.display()));
    let lauf = l.starten(&[("PATH", &pfad)]);
    let start = Instant::now();
    let a = holen(&lauf.adresse, 1, &format!("commit=kd:{}", l.x1), None).await;
    let dauer = start.elapsed();
    assert_eq!((a.status, a.json()["fehler"].is_string(), a.json()["dateien"].is_null()), (503, true, true), "{}", a.text);
    assert!(dauer >= Duration::from_secs(10) && dauer <= Duration::from_secs(15), "{dauer:?}");
    tokio::time::sleep(Duration::from_millis(500)).await;
    let gestartet: Vec<String> = lies(&l.a.basis, "pids").split_whitespace().map(String::from).collect();
    assert_eq!(gestartet.len(), 2, "ein Git-Prozess samt Kind, danach keiner: {gestartet:?}");
    assert!(gestartet.iter().all(|p| !lebt(p)), "Skript oder Kind lebt");
    std::fs::remove_file(&schalter).unwrap();
    assert_eq!(holen(&lauf.adresse, 1, &format!("commit=kd:{}", l.x1), None).await.status, 200, "ohne Skript wieder 200");
    // zweiter Fall: jeder Aufruf 4 s — Wurzel 4 s, cat-file 4 s, der nächste auf 2 s gekürzt
    std::fs::remove_file(&pids).unwrap();
    let pfad = git_skript(&l.a, &format!("echo $$ >> {p}; sleep 4", p = pids.display()));
    let lauf4 = l.starten(&[("PATH", &pfad)]);
    let start = Instant::now();
    assert_eq!(holen(&lauf4.adresse, 1, &format!("commit=kd:{}", l.x1), None).await.status, 503);
    // der dritte Prozess endet mit der Gesamtgrenze bei 10 s, nicht nach seinen vollen 4 s (das wären 12 s)
    assert!(start.elapsed() < Duration::from_millis(11_500), "{:?}", start.elapsed());
    tokio::time::sleep(Duration::from_millis(500)).await;
    let gestartet: Vec<String> = lies(&l.a.basis, "pids").split_whitespace().map(String::from).collect();
    assert_eq!(gestartet.len(), 3, "Wurzel, cat-file, metadaten (gekürzt): {gestartet:?}");
    assert!(gestartet.iter().all(|p| !lebt(p)), "kein Prozess über die Gesamtgrenze hinaus");
}

// ---- AK 14: Lesen ohne Sperre und nur lesend · US-7 ------------------------------------------------------------------

#[tokio::test]
async fn ak14_lesen_ohne_sperre_und_nur_lesend() {
    let l = ausgangslage();
    let schalter = l.a.basis.join("schalter");
    std::fs::write(&schalter, "").unwrap();
    let pfad = git_skript(&l.a, &format!("if [ -e {s} ]; then rm -f {s}; sleep 5; fi", s = schalter.display()));
    let lauf = l.starten(&[("PATH", &pfad)]);
    let r_vorher = r_stand(&l.a.r);
    let adresse = lauf.adresse.clone();
    let x1 = l.x1.clone();
    let lesen = tokio::spawn(async move { holen(&adresse, 1, &format!("commit=kd:{x1}"), None).await });
    tokio::time::sleep(Duration::from_millis(500)).await;
    let start = Instant::now();
    let (status, rumpf) = senden(reqwest::Method::PATCH, &lauf.adresse, "api/aufgaben/1", "sh", json!({"titel": "Diff neu"})).await;
    assert_eq!(status, 200, "{rumpf}");
    assert!(start.elapsed() < Duration::from_secs(1), "PATCH wartete {:?}", start.elapsed());
    assert!(!lesen.is_finished(), "das GET hängt noch");
    let a = lesen.await.unwrap();
    assert_eq!((a.status, dateien(&a.json()).len()), (200, 3));
    let (datei_vorher, zahl) = (lies(&l.a.board, "aufgaben/0001-commit-liste.md"), l.a.commit_zahl());
    for abfrage in [format!("commit=kd:{}", l.x1), format!("commit=kd:{}", l.g1), format!("commit=kd:{}&datei=gross.txt", l.g1), format!("commit=kd:{}&format=patch", l.x1)] {
        assert_eq!(holen(&lauf.adresse, 1, &abfrage, None).await.status, 200);
    }
    assert_eq!((lies(&l.a.board, "aufgaben/0001-commit-liste.md"), l.a.commit_zahl()), (datei_vorher, zahl));
    assert_eq!(r_stand(&l.a.r), r_vorher, "R unverändert");
    assert!(!l.a.r.join(".git/index.lock").exists());
}

// ---- AK 16 (a): feindliche Konfiguration, Attribute, Umgebung · US-6 (Abnahme-Probe der Karte) ---------------------

#[tokio::test]
async fn ak16a_feindliche_konfiguration_fuehrt_nichts_aus() {
    let l = ausgangslage();
    let sauber = {
        let lauf = l.starten(&[]);
        (holen(&lauf.adresse, 1, &format!("commit=kd:{}", l.x1), None).await.text, holen(&lauf.adresse, 1, &format!("commit=kd:{}&format=patch", l.x1), None).await.text)
    };
    let marke = l.a.basis.join("marke");
    let skript = l.a.basis.join("skript.sh");
    std::fs::write(&skript, format!("#!/bin/sh\ncase \"$PWD $*\" in *\"{}\"*) echo \"$0 $*\" >> {};; esac\nexit 0\n", l.a.r.display(), marke.display())).unwrap();
    std::fs::set_permissions(&skript, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    let s = skript.to_str().unwrap();
    std::fs::write(l.a.r.join(".gitattributes"), "* diff=x\n").unwrap();
    for (k, w) in [("diff.external", s), ("diff.x.command", s), ("diff.x.textconv", s), ("core.pager", s), ("pager.diff", s), ("color.ui", "always"), ("color.diff", "always"), ("core.fsmonitor", s), ("core.hooksPath", l.a.basis.to_str().unwrap())] {
        git(&l.a.r, &["config", k, w]);
    }
    let umgebung = [("GIT_EXTERNAL_DIFF", s), ("GIT_PAGER", s), ("PAGER", s), ("GIT_CONFIG_COUNT", "1"), ("GIT_CONFIG_KEY_0", "diff.external"), ("GIT_CONFIG_VALUE_0", s)];
    let lauf = l.starten(&umgebung);
    let _ = std::fs::remove_file(&marke);
    let feindlich = (holen(&lauf.adresse, 1, &format!("commit=kd:{}", l.x1), None).await.text, holen(&lauf.adresse, 1, &format!("commit=kd:{}&format=patch", l.x1), None).await.text);
    assert_eq!(feindlich, sauber, "bytegleich zur Antwort im sauberen Repository");
    assert!(!marke.exists(), "ein Skript lief: {}", lies(&l.a.basis, "marke"));
    // Gegenprobe 1: `git diff` direkt in R startet diff.external und textconv — die Probe kann rot werden
    let roh = |args: &[&str]| std::process::Command::new("git").arg("-C").arg(&l.a.r).args(args).env("GIT_PAGER", "cat").output().unwrap();
    roh(&["diff", &format!("{}^", l.x1), &l.x1]);
    roh(&["diff", "--no-ext-diff", &format!("{}^", l.x1), &l.x1]);
    let gelaufen = lies(&l.a.basis, "marke");
    assert!(gelaufen.lines().count() >= 2, "Gegenprobe git diff: {gelaufen}");
    std::fs::remove_file(&marke).unwrap();
    // Gegenprobe 2: `git diff-tree -p --textconv` direkt in R legt die Marke von textconv an
    roh(&["diff-tree", "-r", "-p", "--textconv", &format!("{}^", l.x1), &l.x1]);
    assert!(marke.exists(), "Gegenprobe diff-tree --textconv");
    std::fs::remove_file(&marke).unwrap();
    // `git diff-tree -p` ohne Schalter startet nichts (gemessen, ADR-0032 N4; Fsmonitor und Hooks gesperrt — die startet
    // diff-tree sonst sehr wohl). Gegenprobe 3, abweichend vom „Belegt“ in N4: mit `--ext-diff` startet diff-tree den
    // Treiber `diff.x.command` aus `.gitattributes` — darum darf der Aufrufer `--ext-diff` nie nennen (AK 16 c)
    let ohne_monitor = ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "diff-tree", "-r", "-p"];
    roh(&[&ohne_monitor[..], &[&format!("{}^", l.x1), &l.x1]].concat());
    assert!(!marke.exists(), "diff-tree ohne Schalter startet nichts: {}", lies(&l.a.basis, "marke"));
    roh(&[&ohne_monitor[..], &["--ext-diff", &format!("{}^", l.x1), &l.x1]].concat());
    assert!(lies(&l.a.basis, "marke").contains("a.txt"), "Gegenprobe 3: diff-tree --ext-diff startet diff.x.command");
}

// ---- AK 16 (b): die Antwort hängt nicht von der Konfiguration ab -----------------------------------------------------

#[tokio::test]
async fn ak16b_antwort_unabhaengig_von_der_konfiguration() {
    let l = ausgangslage();
    let r = &l.a.r;
    std::fs::write(r.join("weg8.txt"), (1..=8).map(|i| format!("zeile {i}\n")).collect::<String>()).unwrap();
    std::fs::write(r.join("m.sh"), "m\n").unwrap();
    commit(r, "vor AK 5");
    std::fs::write(r.join("weg8.txt"), (1..=8).map(|i| if i == 4 { "vier\n".to_string() } else { format!("zeile {i}\n") }).collect::<String>()).unwrap();
    git_am(r, ADA, X1_DATUM, &["mv", "weg8.txt", "neu8.txt"]);
    std::fs::set_permissions(r.join("m.sh"), std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    std::os::unix::fs::symlink("ziel", r.join("link")).unwrap();
    std::fs::write(r.join("ohne.txt"), "a\nb").unwrap();
    git_am(r, ADA, X1_DATUM, &["add", "-A"]);
    git_am(r, ADA, X1_DATUM, &["update-index", "--add", "--cacheinfo", &format!("160000,{},sub", l.a.k1)]);
    git_am(r, ADA, X1_DATUM, &["commit", "-q", "-m", "AK 5"]);
    let ak5 = git(r, &["rev-parse", "HEAD"]);
    l.anhaengen(&[&ak5]);
    let lauf = l.starten(&[]);
    let mut sauber = vec![];
    for h in [&l.x1, &ak5] {
        sauber.push(holen(&lauf.adresse, 1, &format!("commit=kd:{h}"), None).await.text);
        sauber.push(holen(&lauf.adresse, 1, &format!("commit=kd:{h}&format=patch"), None).await.text);
    }
    std::fs::write(l.a.basis.join("reihenfolge"), "z*\nc*\n").unwrap();
    let ordnung = l.a.basis.join("reihenfolge");
    for (k, w) in [("diff.noprefix", "true"), ("diff.mnemonicPrefix", "true"), ("diff.renames", "false"), ("diff.renameLimit", "1000000"), ("diff.context", "0"), ("diff.algorithm", "patience"), ("diff.submodule", "log"), ("diff.ignoreSubmodules", "all"), ("diff.orderFile", ordnung.to_str().unwrap()), ("core.quotepath", "true"), ("diff.wsErrorHighlight", "all")] {
        git(r, &["config", k, w]);
    }
    let mut konfiguriert = vec![];
    for h in [&l.x1, &ak5] {
        konfiguriert.push(holen(&lauf.adresse, 1, &format!("commit=kd:{h}"), None).await.text);
        konfiguriert.push(holen(&lauf.adresse, 1, &format!("commit=kd:{h}&format=patch"), None).await.text);
    }
    assert_eq!(konfiguriert, sauber);
    let d: Value = serde_json::from_str(&sauber[2]).unwrap();
    assert_eq!((&datei(&d, "neu8.txt")["status"], &datei(&d, "sub")["modus_neu"], &datei(&d, "sub")["patch"]), (&json!("R"), &json!("160000"), &json!(format!("@@ -0,0 +1 @@\n+Subproject commit {}\n", l.a.k1))));
}

// ---- AK 17: Injection über die Anfrage -------------------------------------------------------------------------------

#[tokio::test]
async fn ak17_injection_ueber_die_anfrage() {
    let l = ausgangslage();
    let (lauf, spurdatei) = l.mit_spur(&[]);
    let r_vorher = r_stand(&l.a.r);
    spur_leeren(&spurdatei);
    let x1 = &l.x1;
    let commits = ["kd:--output=x".to_string(), "kd:../x".into(), "kd:3f2a9c1;rm -rf x".into(), "kd:$(touch x)".into(), format!("kd:{x1}^{{tree}}"), format!("kd:{x1} "), format!("kd:{x1}\n{}", l.a.k1), format!("kd:{x1}\0")];
    for c in &commits {
        let a = holen(&lauf.adresse, 1, &format!("commit={}", kodiert(c)), None).await;
        assert!(matches!(a.status, 400 | 404) && a.json()["fehler"].is_string(), "{c:?}: {} {}", a.status, a.text);
    }
    assert_eq!(spur(&spurdatei), Vec::<String>::new(), "die Prüfung der Form startet kein Git");
    for d in ["--output=x", "$(touch x)", "a.txt;touch x", ":(glob)**"] {
        let a = holen(&lauf.adresse, 1, &format!("commit=kd:{x1}&datei={}", kodiert(d)), None).await;
        assert!(matches!(a.status, 400 | 404) && a.json()["fehler"].is_string(), "{d:?}: {} {}", a.status, a.text);
        assert!(!spur(&spurdatei).iter().any(|z| z.contains(d)), "{d} erreicht Git");
    }
    assert!(!l.a.r.join("x").exists() && !l.a.board.join("x").exists());
    assert_eq!(r_stand(&l.a.r).0, r_vorher.0, "git status --porcelain in R unverändert");
}

// ---- AK 19: Bestand und Beschreibung · US-8 -------------------------------------------------------------------------

#[tokio::test]
async fn ak19_bestand_und_beschreibung() {
    let l = ausgangslage();
    let (lauf, spurdatei) = l.mit_spur(&[]);
    let (datei_vorher, zahl) = (lies(&l.a.board, "aufgaben/0001-commit-liste.md"), l.a.commit_zahl());
    let vorher: Vec<String> = lesewege(&lauf.adresse).await;
    spur_leeren(&spurdatei);
    for abfrage in [format!("commit=kd:{}", l.x1), format!("commit=kd:{}&datei=a.txt", l.x1), format!("commit=kd:{}&format=patch", l.g1)] {
        assert_eq!(holen(&lauf.adresse, 1, &abfrage, None).await.status, 200);
    }
    assert_eq!((lies(&l.a.board, "aufgaben/0001-commit-liste.md"), l.a.commit_zahl()), (datei_vorher, zahl), "GET …/diff schreibt nie");
    spur_leeren(&spurdatei);
    assert_eq!(lesewege(&lauf.adresse).await, vorher, "Lesewege unverändert");
    assert_eq!(spur(&spurdatei), Vec::<String>::new(), "GET /api/aufgaben/1, /api/aufgaben, /api/zustand starten kein Git");
    // (c) Endpunktliste, OpenAPI, README
    let liste: Value = reqwest::get(format!("{}api/endpunkte", lauf.adresse)).await.unwrap().json().await.unwrap();
    let e = liste.as_array().unwrap().iter().find(|e| e["methode"] == "GET" && e["pfad"] == "/api/aufgaben/{nr}/diff").expect("Route in der Endpunktliste");
    let zweck = e["zweck"].as_str().unwrap();
    for wort in ["commit", "datei", "format", "256 KB", "3.000 Zeilen", "4 MB", "8 MB", "2.000", "Antwortbudget", "64 MB", "ETag", "304", "400", "404", "423", "503", "dateien_gekappt", "zu_gross_zum_anzeigen", "gross", "nachladen"] {
        assert!(zweck.contains(wort), "Zweck nennt {wort}");
    }
    let api: Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse)).await.unwrap().json().await.unwrap();
    let get = &api["paths"]["/api/aufgaben/{nr}/diff"]["get"];
    for status in ["200", "304", "400", "404", "423", "503"] {
        assert!(get["responses"][status].is_object(), "OpenAPI nennt {status}");
    }
    assert!(get["responses"]["503"]["description"].as_str().unwrap().contains("Antwortbudget"), "OpenAPI nennt beide Gründe für 503");
    let parameter: Vec<&str> = get["parameters"].as_array().unwrap().iter().map(|p| p["name"].as_str().unwrap()).collect();
    // R00208 bringt `anwendung` (nur ohne commit) dazu
    assert_eq!(parameter, ["nr", "commit", "anwendung", "datei", "format", "If-None-Match"]);
    assert_eq!(get["description"].as_str(), Some(zweck), "derselbe Text");
    let readme = std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("README.md")).unwrap();
    let abschnitt = readme.split("### Diff eines Commits lesen").nth(1).expect("README-Abschnitt").split("\n### ").next().unwrap();
    assert!(abschnitt.contains("GET /api/aufgaben/1/diff?commit=kd:<X1>") && abschnitt.contains("Merkmale, keine Fehler") && abschnitt.contains("&datei=<neu>"));
    assert!(abschnitt.contains("8 MB") && abschnitt.contains("Antwortbudget") && abschnitt.contains("64 MB") && !abschnitt.contains("20 MB"), "README nennt Grenzen und Budget");
}

/// Die Lesewege ohne Git: die Aufgabe, die Liste, der Zustand — als Text.
async fn lesewege(adresse: &str) -> Vec<String> {
    let mut texte = vec![];
    for pfad in ["api/aufgaben/1", "api/aufgaben", "api/zustand"] {
        texte.push(reqwest::get(format!("{adresse}{pfad}")).await.unwrap().text().await.unwrap());
    }
    texte
}

// ---- AK 21: Zuordnung von Patch und Datei, Typwechsel, Pfade (Code-Review M1, ADR-0032 N5.2, N5.5 S1) ---------------

/// Der Patch-Text, den Git für eine gelöschte (`zeichen` `-`) oder neue (`+`) Datei mit diesem Inhalt schreibt.
fn ganzer_patch(zeichen: char, inhalt: &str) -> String {
    let n = inhalt.lines().count();
    let bereich = if n == 1 { "1".to_string() } else { format!("1,{n}") };
    let kopf = if zeichen == '-' { format!("@@ -{bereich} +0,0 @@\n") } else { format!("@@ -0,0 +{bereich} @@\n") };
    kopf + &inhalt.lines().map(|z| format!("{zeichen}{z}\n")).collect::<String>()
}

/// Zeilen mit eigenem Text je Datei: `n` Zeilen zu je `breite` Byte (mit Zeilenumbruch).
fn zeilen(name: &str, n: usize, breite: usize) -> String {
    (0..n).map(|i| format!("{:<w$}\n", format!("{name}-{i}"), w = breite - 1)).collect()
}

/// Setup A (Probe P5): Commit 1 legt `foo/bar` (4.000 Zeilen zu 51 Byte) und `foo2` an, Commit 2 löscht beide und legt
/// die Datei `foo` an; mit `zz` dazu `zz00`…`zz19` (je 2.500 Zeilen zu 100 Byte) in Commit 1, gelöscht in Commit 2.
/// Setup C: Commit 3 macht aus der Datei `foo` wieder das Verzeichnis mit `foo/bar`. Liefert (Commit 2, Commit 3).
fn typwechsel(l: &Lage, zz: bool) -> (String, String) {
    let r = &l.a.r;
    std::fs::create_dir_all(r.join("foo")).unwrap();
    std::fs::write(r.join("foo/bar"), zeilen("bar", 4000, 51)).unwrap();
    std::fs::write(r.join("foo2"), "foo2 inhalt\n").unwrap();
    for i in (0..20).filter(|_| zz) {
        std::fs::write(r.join(format!("zz{i:02}")), zeilen(&format!("zz{i:02}"), 2500, 100)).unwrap();
    }
    commit(r, "Verzeichnis foo");
    std::fs::remove_dir_all(r.join("foo")).unwrap();
    std::fs::remove_file(r.join("foo2")).unwrap();
    for i in (0..20).filter(|_| zz) {
        std::fs::remove_file(r.join(format!("zz{i:02}"))).unwrap();
    }
    std::fs::write(r.join("foo"), "datei\n").unwrap();
    let c2 = commit(r, "Datei foo");
    std::fs::remove_file(r.join("foo")).unwrap();
    std::fs::create_dir_all(r.join("foo")).unwrap();
    std::fs::write(r.join("foo/bar"), zeilen("bar", 4000, 51)).unwrap();
    let c3 = commit(r, "wieder Verzeichnis foo");
    l.anhaengen(&[&c2, &c3]);
    (c2, c3)
}

#[tokio::test]
async fn ak21a_c_typwechsel_zwischen_datei_und_verzeichnis() {
    let l = ausgangslage();
    let (c2, c3) = typwechsel(&l, false);
    let lauf = l.starten(&[]);
    // (a) Setup A: Verzeichnis foo/ → Datei foo
    let a = holen(&lauf.adresse, 1, &format!("commit=kd:{c2}&datei=foo"), None).await;
    assert_eq!(a.status, 200, "{}", a.text);
    let e = a.json();
    assert_eq!(dateien(&e).iter().map(|f| (f["neu"].as_str(), f["status"].as_str())).collect::<Vec<_>>(), [(Some("foo"), Some("A"))]);
    assert_eq!(datei(&e, "foo")["patch"], json!("@@ -0,0 +1 @@\n+datei\n"));
    let d = diff(&lauf.adresse, &c2).await;
    assert_eq!((&datei(&d, "foo/bar")["gross"], datei(&d, "foo/bar").get("patch")), (&json!(true), None));
    assert_eq!(datei(&d, "foo2")["patch"], json!("@@ -1 +0,0 @@\n-foo2 inhalt\n"), "nicht der Patch von foo/bar");
    assert_eq!(datei(&d, "foo")["patch"], json!("@@ -0,0 +1 @@\n+datei\n"));
    // (c) Setup C: Datei foo → Verzeichnis foo/
    let e = holen(&lauf.adresse, 1, &format!("commit=kd:{c3}&datei=foo"), None).await;
    assert_eq!(e.status, 200, "{}", e.text);
    assert_eq!(dateien(&e.json()).iter().map(|f| (f["alt"].as_str(), f["status"].as_str(), f["patch"].as_str())).collect::<Vec<_>>(), [(Some("foo"), Some("D"), Some("@@ -1 +0,0 @@\n-datei\n"))]);
    let e = holen(&lauf.adresse, 1, &format!("commit=kd:{c3}&datei=foo/bar"), None).await.json();
    assert_eq!((dateien(&e).len(), &datei(&e, "foo/bar")["patch"]), (1, &json!(ganzer_patch('+', &zeilen("bar", 4000, 51)))));
    let d = diff(&lauf.adresse, &c3).await;
    assert_eq!((datei(&d, "foo")["patch"].as_str(), &datei(&d, "foo/bar")["gross"]), (Some("@@ -1 +0,0 @@\n-datei\n"), &json!(true)));
    // beide Richtungen auch als Text: je Datei nur ihr eigenes Stück
    for (c, name, eigen) in [(&c2, "foo", "new file mode"), (&c3, "foo", "deleted file mode")] {
        let t = holen(&lauf.adresse, 1, &format!("commit=kd:{c}&datei={name}&format=patch"), None).await;
        assert_eq!(t.status, 200, "{}", t.text);
        assert!(t.text.starts_with(&format!("diff --git a/foo b/foo\n{eigen}")) && t.text.matches("diff --git").count() == 1 && !t.text.contains("foo/bar"), "{}", t.text);
    }
    let t = holen(&lauf.adresse, 1, &format!("commit=kd:{c2}&format=patch"), None).await;
    assert_eq!(t.status, 200, "{}", t.text);
    assert!(t.text.contains("diff --git a/foo/bar b/foo/bar\n# kanbanD: Patch fehlt (gross)\n") && t.text.contains("@@ -1 +0,0 @@\n-foo2 inhalt\n"), "{}", &t.text[..t.text.len().min(2000)]);
    assert_eq!(t.text.matches("bar-0").count(), 0, "kein Stück von foo/bar im Text");
    let t = holen(&lauf.adresse, 1, &format!("commit=kd:{c3}&format=patch"), None).await;
    assert!(t.status == 200 && t.text.contains("diff --git a/foo/bar b/foo/bar\n# kanbanD: Patch fehlt (gross)\n") && t.text.matches("bar-0").count() == 0, "{}", &t.text[..t.text.len().min(2000)]);
}

#[tokio::test]
async fn ak21b_viele_stuecke_im_abgeschnittenen_lauf() {
    let l = ausgangslage();
    let (c2, _) = typwechsel(&l, true);
    let lauf = l.starten(&[]);
    let d = diff(&lauf.adresse, &c2).await;
    let mut gezeigt = 0;
    for i in 0..20 {
        let name = format!("zz{i:02}");
        let f = datei(&d, &name);
        assert_eq!((&f["minus"], &f["gross"]), (&json!(2500), &json!(false)), "{name}");
        match f["patch"].as_str() {
            Some(p) => {
                assert_eq!(p, ganzer_patch('-', &zeilen(&name, 2500, 100)), "{name}: eigener Patch, Kopf passt zu minus");
                gezeigt += 1;
            }
            None => assert_eq!(f["nachladen"], json!(true), "{name}: ohne Patch nur nachladen"),
        }
    }
    assert!((1..20).contains(&gezeigt), "der Lauf ist abgeschnitten: {gezeigt} von 20 mit Patch");
    assert_eq!(datei(&d, "foo2")["patch"], json!("@@ -1 +0,0 @@\n-foo2 inhalt\n"));
    for f in dateien(&d).iter().filter(|f| f["patch"].is_string()) {
        let p = f["patch"].as_str().unwrap();
        let name = f["neu"].as_str().or(f["alt"].as_str()).unwrap();
        assert!(!p.contains("bar-0") || name == "foo/bar", "{name} zeigt ein Stück von foo/bar");
    }
}

/// Ein Commit auf HEAD von R, im Objektspeicher gebaut (ohne Arbeitsbaum): `dateien` sind (Pfad, Inhalt).
fn im_objektspeicher(r: &Path, dateien: &[(String, String)]) -> String {
    let index = r.join(".git").join("kd-test-index");
    let mit_index = |args: &[&str], eingabe: Option<&str>| {
        use std::io::Write;
        let mut k = std::process::Command::new("git").arg("-C").arg(r).args(args).env("GIT_INDEX_FILE", &index).stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::piped()).spawn().unwrap();
        k.stdin.take().unwrap().write_all(eingabe.unwrap_or_default().as_bytes()).unwrap();
        let aus = k.wait_with_output().unwrap();
        assert!(aus.status.success(), "{args:?}");
        String::from_utf8(aus.stdout).unwrap().trim().to_string()
    };
    mit_index(&["read-tree", "HEAD"], None);
    let mut liste = String::new();
    for (pfad, inhalt) in dateien {
        let blob = mit_index(&["hash-object", "-w", "--stdin"], Some(inhalt));
        liste.push_str(&format!("100644 blob {blob}\t{pfad}\n"));
    }
    mit_index(&["update-index", "--add", "--index-info"], Some(&liste));
    let baum = mit_index(&["write-tree"], None);
    let c = git_am(r, ADA, X1_DATUM, &["commit-tree", "-p", "HEAD", "-m", "im Objektspeicher", &baum]);
    std::fs::remove_file(&index).unwrap();
    c
}

#[tokio::test]
async fn ak21e_lange_pfade_und_summe_der_pfadangabe() {
    let l = ausgangslage();
    let r = &l.a.r;
    let lang = "k".repeat(130_000);
    // Variante über der Grenze eines einzelnen Arguments (MAX_ARG_STRLEN 131.072 Byte): heute 500 „Argument list too long“
    let laenger = "m".repeat(140_000);
    let c = im_objektspeicher(r, &[(lang.clone(), "lang\n".into()), (laenger.clone(), "laenger\n".into()), ("gross3001.txt".into(), "x\n".repeat(3001)), ("eins.txt".into(), "eins\n".into()), ("zwei.txt".into(), "zwei\n".into())]);
    let viele: Vec<(String, String)> = (0..1500).map(|i| (format!("{i:04}{}", "p".repeat(996)), format!("{i}\n"))).chain([("gross3001.txt".to_string(), "x\n".repeat(3001))]).collect();
    let v = im_objektspeicher(r, &viele);
    l.anhaengen(&[&c, &v]);
    // zählt die Bytes der Befehlszeile jedes Patch-Laufs (diff-tree ohne --raw und --numstat)
    let zaehler = l.a.basis.join("pfadangabe");
    let pfad = git_skript(&l.a, &format!("case \"$*\" in *diff-tree*--raw*|*diff-tree*--numstat*) ;; *diff-tree*) printf '%s' \"$*\" | wc -c >> {};; esac", zaehler.display()));
    let lauf = l.starten(&[("PATH", &pfad)]);
    let a = holen(&lauf.adresse, 1, &format!("commit=kd:{c}"), None).await;
    assert_eq!(a.status, 200, "{}", &a.text[..a.text.len().min(300)]);
    let d = a.json();
    for p in [&lang, &laenger] {
        let f = datei(&d, p);
        assert_eq!((&f["gross"], f.get("patch")), (&json!(true), None), "langer Pfad: gross ohne Patch");
        assert!(d["hinweise"].as_array().unwrap().iter().any(|h| h["art"] == "zu_gross_zum_anzeigen" && h["datei"] == p.as_str()), "Hinweis zu_gross_zum_anzeigen");
    }
    assert_eq!((datei(&d, "eins.txt")["patch"].as_str(), datei(&d, "zwei.txt")["patch"].as_str()), (Some("@@ -0,0 +1 @@\n+eins\n"), Some("@@ -0,0 +1 @@\n+zwei\n")));
    assert_eq!(datei(&d, "gross3001.txt")["gross"], json!(true));
    let _ = std::fs::remove_file(&zaehler);
    let a = holen(&lauf.adresse, 1, &format!("commit=kd:{v}"), None).await;
    assert_eq!(a.status, 200, "{}", &a.text[..a.text.len().min(300)]);
    let d = a.json();
    let laeufe: Vec<usize> = lies(&l.a.basis, "pfadangabe").split_whitespace().map(|z| z.parse().unwrap()).collect();
    assert!(!laeufe.is_empty() && laeufe.iter().all(|n| *n <= (1 << 20) + 4096), "Befehlszeilen der Patch-Läufe: {laeufe:?}");
    for f in dateien(&d).iter().filter(|f| f["neu"] != "gross3001.txt") {
        assert!(f["patch"].is_string() || f["nachladen"] == true, "{}: Patch oder nachladen", &f["neu"].as_str().unwrap()[..4]);
    }
}

// ---- AK 20: Speicher der Antworten (Security M-S1, ADR-0032 N5.1) ---------------------------------------------------

/// `VmRSS` und `VmHWM` eines Prozesses in Byte.
fn speicher(pid: u32) -> (usize, usize) {
    let status = std::fs::read_to_string(format!("/proc/{pid}/status")).unwrap();
    let wert = |name: &str| status.lines().find(|z| z.starts_with(name)).and_then(|z| z.split_whitespace().nth(1)).unwrap().parse::<usize>().unwrap() * 1024;
    (wert("VmRSS:"), wert("VmHWM:"))
}

/// Setzt `VmHWM` auf den heutigen `VmRSS` zurück (Linux, `clear_refs` 5).
fn spitze_zuruecksetzen(pid: u32) {
    std::fs::write(format!("/proc/{pid}/clear_refs"), "5").unwrap();
}

unsafe extern "C" {
    fn setsockopt(fd: i32, level: i32, name: i32, wert: *const std::ffi::c_void, laenge: u32) -> i32;
}

/// Eine Verbindung mit kleinem Empfangspuffer (`SO_RCVBUF` 4096), die die Anfrage sendet und nur die Statuszeile liest.
fn langsam(adresse: &str, pfad: &str) -> (std::net::TcpStream, u16) {
    use std::io::{Read, Write};
    use std::os::fd::AsRawFd;
    let ziel = adresse.trim_start_matches("http://").trim_end_matches('/');
    let mut s = std::net::TcpStream::connect(ziel).unwrap();
    let klein: i32 = 4096;
    assert_eq!(unsafe { setsockopt(s.as_raw_fd(), 1, 8, (&raw const klein).cast(), 4) }, 0, "SO_RCVBUF");
    s.write_all(format!("GET /{pfad} HTTP/1.1\r\nHost: {ziel}\r\n\r\n").as_bytes()).unwrap();
    let mut zeile = vec![];
    let mut b = [0u8; 1];
    while !zeile.ends_with(b"\r\n") {
        s.read_exact(&mut b).unwrap();
        zeile.push(b[0]);
    }
    let status = String::from_utf8(zeile).unwrap().split_whitespace().nth(1).unwrap().parse().unwrap();
    (s, status)
}

/// Der Rest einer kleinen Antwort mit `Content-Length` (die Statuszeile ist schon gelesen): der Rumpf als Text.
fn rest_lesen(s: &mut std::net::TcpStream) -> String {
    use std::io::Read;
    let mut kopf = vec![];
    let mut b = [0u8; 1];
    while !kopf.ends_with(b"\r\n\r\n") {
        s.read_exact(&mut b).unwrap();
        kopf.push(b[0]);
    }
    let kopf = String::from_utf8(kopf).unwrap().to_ascii_lowercase();
    let laenge: usize = kopf.lines().find_map(|z| z.strip_prefix("content-length:")).unwrap().trim().parse().unwrap();
    let mut rumpf = vec![0u8; laenge];
    s.read_exact(&mut rumpf).unwrap();
    String::from_utf8(rumpf).unwrap()
}

const MB: usize = 1 << 20;

/// Commit X legt `gross1.txt` mit 170.000 Zeilen zu je 45 Byte an (7,3 MB) und hängt an #1.
fn gross1(l: &Lage) -> (String, String) {
    let inhalt = zeilen("gross1", 170_000, 45);
    std::fs::write(l.a.r.join("gross1.txt"), &inhalt).unwrap();
    let x = commit(&l.a.r, "gross1");
    l.anhaengen(&[&x]);
    (x, inhalt)
}

#[tokio::test]
async fn ak20a_c_einzelanfrage_und_schneller_client() {
    let l = ausgangslage();
    let (x, inhalt) = gross1(&l);
    let lauf = l.starten(&[]);
    let pid = lauf.kind.id();
    holen(&lauf.adresse, 1, &format!("commit=kd:{}", l.x1), None).await;
    let erwartet = ganzer_patch('+', &inhalt);
    let git_text = std::process::Command::new("git").arg("-C").arg(&l.a.r).args(["diff-tree", "-r", "-p", "--full-index", "--no-color", &format!("{x}^"), &x, "--", "gross1.txt"]).output().unwrap().stdout;
    for format in ["", "&format=patch"] {
        let (vorher, _) = speicher(pid);
        spitze_zuruecksetzen(pid);
        let a = holen(&lauf.adresse, 1, &format!("commit=kd:{x}&datei=gross1.txt{format}"), None).await;
        let (_, spitze) = speicher(pid);
        assert_eq!(a.status, 200, "{format}");
        let bytes = a.text.len();
        eprintln!("AK 20 (a) {format:?}: Antwort {bytes} Byte, Anstieg VmHWM {} Byte", spitze - vorher);
        assert!(spitze - vorher <= 3 * bytes + 4 * MB, "{format}: Anstieg {} MB bei {} MB Antwort", (spitze - vorher) / MB, bytes / MB);
        // (c) dieselben Bytes wie am Stück, ETag und nosniff unverändert
        assert!(a.etag.is_some() && a.nosniff, "{format}");
        if format.is_empty() {
            assert_eq!((a.art.as_str(), datei(&a.json(), "gross1.txt")["patch"].as_str()), ("application/json", Some(erwartet.as_str())));
        } else {
            assert_eq!((a.art.as_str(), a.text.as_bytes()), ("text/x-diff; charset=utf-8", git_text.as_slice()));
        }
    }
}

#[tokio::test]
async fn ak20b_viele_die_nicht_lesen() {
    let l = ausgangslage();
    let (x, _) = gross1(&l);
    let pfad = format!("api/aufgaben/1/diff?commit=kd:{x}&datei=gross1.txt");
    for n in [6usize, 30] {
        let lauf = l.starten(&[]);
        let pid = lauf.kind.id();
        let groesse = holen(&lauf.adresse, 1, &format!("commit=kd:{x}&datei=gross1.txt"), None).await.text.len();
        let (vorher, _) = speicher(pid);
        let adresse = lauf.adresse.clone();
        let p = pfad.clone();
        let verbindungen = tokio::task::spawn_blocking(move || std::thread::scope(|s| (0..n).map(|_| s.spawn(|| langsam(&adresse, &p))).collect::<Vec<_>>().into_iter().map(|t| t.join().unwrap()).collect::<Vec<_>>())).await.unwrap();
        let (danach, _) = speicher(pid);
        let ok = verbindungen.iter().filter(|(_, s)| *s == 200).count();
        eprintln!("AK 20 (b) N = {n}: Antwort {groesse} Byte, VmRSS {vorher} → {danach} Byte, {ok} × 200");
        assert!(danach.saturating_sub(vorher) <= 64 * MB + n * MB / 2 + 8 * MB, "N = {n}: +{} MB, {ok} × 200", (danach - vorher) / MB);
        assert!(ok >= 1 && ok <= 64 * MB / groesse, "N = {n}: {ok} × 200 bei {groesse} Byte");
        for (mut s, status) in verbindungen.into_iter().filter(|(_, s)| *s != 200) {
            assert_eq!(status, 503, "N = {n}");
            let rumpf: Value = serde_json::from_str(&rest_lesen(&mut s)).unwrap();
            assert!(rumpf["fehler"].as_str().unwrap().starts_with("Antwortbudget"), "{rumpf}");
        }
        // (c) ist das Budget wieder frei (die langsamen sind geschlossen), ergibt dieselbe Anfrage 200
        let bis = Instant::now() + Duration::from_secs(10);
        loop {
            let a = holen(&lauf.adresse, 1, &format!("commit=kd:{x}&datei=gross1.txt"), None).await;
            if a.status == 200 {
                break;
            }
            assert!(Instant::now() < bis, "Budget nach dem Schließen nicht frei: {}", a.text);
        }
    }
}

// ---- AK 11: Grenze für den Patch einer einzeln geladenen Datei (8 MB, ADR-0032 N5.1 Regel 6) -------------------------

#[tokio::test]
async fn ak11_grenze_einzeln_8_mb() {
    let l = ausgangslage();
    let r = &l.a.r;
    let grenze = 8_388_608usize;
    let mut hashes = vec![];
    for (name, mehr) in [("g8a.txt", 0usize), ("g8b.txt", 1)] {
        let mut inhalt = format!("{}\n", "a".repeat(99)).repeat(80_000);
        std::fs::write(r.join(name), &inhalt).unwrap();
        let h = commit(r, name);
        let laenge = |h: &str| std::process::Command::new("git").arg("-C").arg(r).args(["diff-tree", "-r", "-p", "--full-index", "--no-color", &format!("{h}^"), h, "--", name]).output().unwrap().stdout.len();
        let fehlt = grenze + mehr - laenge(&h);
        git_am(r, ADA, X1_DATUM, &["reset", "-q", "--hard", "HEAD^"]);
        inhalt.pop();
        inhalt.push_str(&"a".repeat(fehlt));
        inhalt.push('\n');
        std::fs::write(r.join(name), &inhalt).unwrap();
        let h = commit(r, name);
        assert_eq!(laenge(&h), grenze + mehr, "Ausgabe des Patch-Laufs von {name}");
        hashes.push(h);
    }
    l.anhaengen(&[&hashes[0], &hashes[1]]);
    let lauf = l.starten(&[]);
    for (h, name, gross) in [(&hashes[0], "g8a.txt", false), (&hashes[1], "g8b.txt", true)] {
        let a = holen(&lauf.adresse, 1, &format!("commit=kd:{h}&datei={name}"), None).await;
        assert_eq!(a.status, 200, "{}", &a.text[..a.text.len().min(300)]);
        let d = a.json();
        assert_eq!((&datei(&d, name)["gross"], datei(&d, name)["patch"].is_string()), (&json!(gross), !gross), "{name}");
        let hinweise = if gross { json!([{"art": "zu_gross_zum_anzeigen", "datei": name}]) } else { json!([]) };
        assert_eq!(d["hinweise"], hinweise, "{name}");
    }
}
