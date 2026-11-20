// R00213 (I0203, Karte #230): Gesamt-Diff ohne 500 bei gleich bewerteten Umbenennungsquellen (ADR-0032 N7.10).
// Akzeptanztests gegen das echte Programm und ein echtes Arbeits-Repository. Schichten: Testfall (AK) → Testsprache
// (`Lage`, `fall_n`, `fall_f`, `karte_pruefen`, Orakel `netto_stuecke`) → Treiber (`holen`) → Programm.
mod gemeinsam;

use gemeinsam::{Laufendes, git, starten_mit};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

// ---- Treiber ----------------------------------------------------------------------------------------------------------

/// `GET /api/aufgaben/{nr}/diff?{abfrage}` (Gesamt-Diff: ohne `commit`): Status und Rumpf.
async fn holen(adresse: &str, nr: u32, abfrage: &str) -> (u16, String) {
    let r = reqwest::Client::new().get(format!("{adresse}api/aufgaben/{nr}/diff?{abfrage}")).send().await.unwrap();
    let status = r.status().as_u16();
    (status, String::from_utf8(r.bytes().await.unwrap().to_vec()).expect("gültiges UTF-8"))
}

fn kodiert(text: &str) -> String {
    text.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-._~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect()
}

// ---- Testsprache: Ausgangslage ----------------------------------------------------------------------------------------

/// Arbeits-Repository R einer Anwendung `kd` im Register; Karten mit ihren Kartencommits.
struct Lage {
    _tmp: tempfile::TempDir,
    r: PathBuf,
    board: PathBuf,
}

fn git_r(r: &Path, args: &[&str]) -> String {
    let a = std::process::Command::new("git").arg("-C").arg(r).args(["-c", "user.name=A", "-c", "user.email=a@a"]).args(args).output().unwrap();
    assert!(a.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&a.stderr));
    String::from_utf8(a.stdout).unwrap()
}

/// Die Zeilen `l0 … l3` und dazu `rest`.
fn basis_mit(rest: &str) -> String {
    format!("{}{rest}\n", (0..4).map(|i| format!("l{i}\n")).collect::<String>())
}

impl Lage {
    fn neu() -> Lage {
        let tmp = tempfile::tempdir().unwrap();
        let basis = tmp.path().canonicalize().unwrap();
        let (r, board) = (basis.join("R"), basis.join("board"));
        let l = Lage { _tmp: tmp, r, board };
        std::fs::create_dir_all(l.r.join("Dokumentation/Planung")).unwrap();
        std::fs::write(l.r.join("Dokumentation/Planung/app.md"), "# App\n").unwrap();
        git_r(&l.r, &["init", "-q", "-b", "main"]);
        l.commit("WBS");
        std::fs::create_dir_all(l.board.join("aufgaben")).unwrap();
        std::fs::create_dir_all(l.board.join("boards")).unwrap();
        std::fs::write(l.board.join("kanbanD.md"), format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Dokumentation/Planung/app.md, requirements: \"\"}}\n---\n", l.r.display())).unwrap();
        git(&l.board, &["init", "-q"]);
        l
    }

    /// Ersetzt alle Dateien außer `Dokumentation` durch genau `baum` und committet.
    fn baum(&self, baum: &[(&str, String)], nachricht: &str) -> String {
        for e in std::fs::read_dir(&self.r).unwrap() {
            let n = e.unwrap().file_name().into_string().unwrap();
            if n != ".git" && n != "Dokumentation" {
                let p = self.r.join(&n);
                if p.is_dir() { std::fs::remove_dir_all(p).unwrap() } else { std::fs::remove_file(p).unwrap() }
            }
        }
        for (p, inhalt) in baum {
            std::fs::create_dir_all(self.r.join(p).parent().unwrap()).unwrap();
            std::fs::write(self.r.join(p), inhalt).unwrap();
        }
        self.commit(nachricht)
    }

    fn commit(&self, nachricht: &str) -> String {
        git_r(&self.r, &["add", "-A"]);
        git_r(&self.r, &["commit", "-q", "--allow-empty", "-m", nachricht]);
        git_r(&self.r, &["rev-parse", "HEAD"]).trim().to_string()
    }

    /// Karten `(nr, Kartencommits)` anlegen, dann das Programm mit `umgebung` starten.
    fn starten(&self, karten: &[(u32, Vec<String>)], umgebung: &[(&str, &str)]) -> Laufendes {
        let mut liste = String::new();
        for (nr, commits) in karten {
            let verweise: String = commits.iter().map(|k| format!("  - \"kd:{k}\"\n")).collect();
            std::fs::write(self.board.join(format!("aufgaben/{nr:04}-k.md")), format!("---\nid: {nr}\ntitle: Karte {nr}\ncommits:\n{verweise}---\n")).unwrap();
            liste.push_str(&format!("- [#{nr}](../aufgaben/{nr:04}-k.md)\n"));
        }
        std::fs::write(self.board.join("boards/fabrik.md"), format!("# fabrik\n\n## Entwicklung\n\n{liste}")).unwrap();
        git(&self.board, &["add", "-A"]);
        git(&self.board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Karten"]);
        starten_mit(&self.board, &["--port", "0", "--host", "127.0.0.1"], umgebung)
    }

    /// Ein `git` vorn im PATH des Servers (wie in `akzeptanz_r00206.rs`): für Läufe des Startorts in R führt es `bei_r`
    /// aus (`$echt` ist das echte Git), alles andere geht ans echte Git. Liefert den Wert für `PATH`.
    fn git_skript(&self, bei_r: &str) -> String {
        let echt = String::from_utf8(std::process::Command::new("sh").args(["-c", "command -v git"]).output().unwrap().stdout).unwrap().trim().to_string();
        let ordner = self.r.parent().unwrap().join("bin");
        std::fs::create_dir_all(&ordner).unwrap();
        let skript = format!("#!/bin/sh\necht={echt}\ncase \"$*\" in *\"{r}\"*core.hooksPath=/dev/null*)\n{bei_r}\n;; esac\nexec $echt \"$@\"\n", r = self.r.display());
        std::fs::write(ordner.join("git"), skript).unwrap();
        std::fs::set_permissions(ordner.join("git"), std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
        format!("{}:{}", ordner.display(), std::env::var("PATH").unwrap())
    }

    /// `D_karte`: alle Pfade, die die Kartencommits berühren (bei Umbenennung beide).
    fn d_karte(&self, karte: &[String]) -> Vec<String> {
        let mut pfade: Vec<String> = vec![];
        for k in karte {
            let aus = git_r(&self.r, &["diff-tree", "-r", "-M50%", "-l1000", "--name-status", &format!("{k}^"), k]);
            pfade.extend(aus.lines().flat_map(|z| z.split('\t').skip(1).map(String::from)));
        }
        pfade.sort();
        pfade.dedup();
        pfade
    }

    /// Orakel „bytegleich netto“: die Stücke von `diff-tree -p` von der Basis bis zum letzten Kartencommit, `-- D_karte`.
    fn netto_stuecke(&self, karte: &[String]) -> Vec<String> {
        let basis = format!("{}^", karte[0]);
        let letzter = karte.last().unwrap();
        let d = self.d_karte(karte);
        let mut args = vec!["diff-tree", "-r", "-p", "--full-index", "-M50%", "-l1000", "--no-ext-diff", "--no-textconv", basis.as_str(), letzter.as_str(), "--"];
        args.extend(d.iter().map(String::as_str));
        let aus = git_r(&self.r, &args);
        let mut stuecke: Vec<String> = vec![];
        for z in aus.split_inclusive('\n') {
            if z.starts_with("diff --git ") {
                stuecke.push(String::new());
            }
            stuecke.last_mut().expect("Ausgabe beginnt mit diff --git").push_str(z);
        }
        stuecke
    }
}

/// Vorgänger A der Variante `v`: Quellen `s0 … s<n-1>` (n = 2 bis 4) mit `l0..l3` und eigener Zeile, dazu `gross` mit
/// 3.010 Zeilen. Alle Quellen sind für `dst` und `dst2` gleich bewertet.
fn vorgaenger(l: &Lage, v: usize) -> String {
    let mut baum: Vec<(String, String)> = (0..2 + v % 3).map(|i| (format!("s{i}"), basis_mit(&format!("x{i}-{v}")))).collect();
    baum.push(("gross".into(), (0..3010 + v).map(|i| format!("g{i}\n")).collect()));
    let baum: Vec<(&str, String)> = baum.iter().map(|(p, c)| (p.as_str(), c.clone())).collect();
    l.baum(&baum, &format!("A{v}"))
}

/// Die Dateien nach K1: `dst` und `dst2`, je `l0..l3` und eine eigene Zeile.
fn nach_k1(v: usize) -> Vec<(&'static str, String)> {
    vec![("dst", basis_mit(&format!("neu{v}"))), ("dst2", basis_mit(&format!("neu2-{v}")))]
}

/// Fall N: Kartencommit K1 löscht Quellen und `gross`, legt `dst` und `dst2` an. Karte = K1.
fn fall_n(l: &Lage, v: usize) -> Vec<String> {
    vorgaenger(l, v);
    vec![l.baum(&nach_k1(v), &format!("K1-{v}"))]
}

/// Fall F: wie N, dann fremder Commit F hängt `FREMD` an `dst2`, dann Kartencommit K2 legt `k2` an. Karte = K1, K2.
fn fall_f(l: &Lage, v: usize) -> Vec<String> {
    vorgaenger(l, v);
    let k1 = l.baum(&nach_k1(v), &format!("K1-{v}"));
    let mut baum = nach_k1(v);
    baum[1].1.push_str("FREMD\n");
    l.baum(&baum, &format!("F-{v}"));
    baum.push(("k2", "k2\n".into()));
    let k2 = l.baum(&baum, &format!("K2-{v}"));
    vec![k1, k2]
}

// ---- Testsprache: Proben ----------------------------------------------------------------------------------------------

fn dateien(d: &Value) -> &Vec<Value> {
    d["dateien"].as_array().unwrap_or_else(|| panic!("keine dateien: {d}"))
}

/// Der Name eines Eintrags: Folge `pfad`, netto `neu` (bei gelöschten `alt`).
fn name(f: &Value) -> &str {
    f["pfad"].as_str().or(f["neu"].as_str()).or(f["alt"].as_str()).unwrap()
}

fn hunks(stueck: &str) -> &str {
    stueck.find("\n@@").map_or("", |i| &stueck[i + 1..])
}

/// Kein `+`/`-` mit `FREMD` im Text.
fn ohne_fremd(text: &str, wo: &str) {
    assert!(!text.lines().any(|z| (z.starts_with('+') || z.starts_with('-')) && z.contains("FREMD")), "{wo}: Zeile mit FREMD\n{text}");
}

/// Alle Patch-Texte eines Eintrags (netto: `patch`, Folge: die Patches der Schritte).
fn patches(f: &Value) -> Vec<String> {
    match f["schritte"].as_array() {
        Some(s) => s.iter().filter_map(|s| s["patch"].as_str().map(String::from)).collect(),
        None => f["patch"].as_str().map(String::from).into_iter().collect(),
    }
}

/// Ohne jeden Patch, obwohl das Orakel Hunks hat: dann muss der Eintrag (bzw. jeder Schritt) `nachladen` oder `gross` sein.
fn ohne_patch_erklaert(f: &Value) -> bool {
    let erklaert = |d: &Value| d["patch"].is_string() || d["nachladen"] == json!(true) || d["gross"] == json!(true) || d["binaer"] == json!(true) || d["status"] == json!("R") && d["aehnlichkeit"] == json!(100);
    match f["schritte"].as_array() {
        Some(s) => s.iter().all(erklaert),
        None => erklaert(f),
    }
}

/// Prüft eine Karte nach AK 1 und AK 2: Liste (JSON und `format=patch`) 200 ohne `FREMD`, jeder Netto-Patch bytegleich,
/// jeder Eintrag ohne Patch erklärt; `datei=dst`, `datei=dst2` und `datei=` auf jeden `nachladen`-Eintrag 200 ohne
/// `FREMD`, Netto bytegleich. Liefert, ob ein Eintrag `nachladen` stand.
async fn karte_pruefen(l: &Lage, adresse: &str, nr: u32, karte: &[String]) -> bool {
    let stuecke = l.netto_stuecke(karte);
    let netto_pruefen = |f: &Value, wo: &str| {
        if f["schritte"].is_array() {
            return;
        }
        if let Some(p) = f["patch"].as_str() {
            let (alt, neu) = (f["alt"].as_str().unwrap_or_else(|| name(f)), f["neu"].as_str().unwrap_or_else(|| name(f)));
            let kopf = format!("diff --git a/{alt} b/{neu}\n");
            let s: Vec<&String> = stuecke.iter().filter(|s| s.starts_with(&kopf)).collect();
            assert_eq!(s.len(), 1, "{wo}: Stück {kopf:?} im Orakel");
            assert_eq!(p, hunks(s[0]), "{wo}: Netto-Patch von {} nicht bytegleich", name(f));
        }
    };
    let (s, t) = holen(adresse, nr, "").await;
    assert_eq!(s, 200, "#{nr} Liste: {t}");
    let d: Value = serde_json::from_str(&t).unwrap();
    let mut nachladen = vec![];
    for f in dateien(&d) {
        for p in patches(f) {
            ohne_fremd(&p, &format!("#{nr} Liste {}", name(f)));
        }
        netto_pruefen(f, &format!("#{nr} Liste"));
        assert!(ohne_patch_erklaert(f), "#{nr} Liste: {} ohne Patch und ohne nachladen: {f}", name(f));
        let steht = |d: &Value| d["nachladen"] == json!(true);
        if steht(f) || f["schritte"].as_array().is_some_and(|s| s.iter().any(steht)) {
            nachladen.push(name(f).to_string());
        }
    }
    let (s, text) = holen(adresse, nr, "format=patch").await;
    assert_eq!(s, 200, "#{nr} format=patch: {text}");
    ohne_fremd(&text, &format!("#{nr} format=patch"));
    let mut namen: Vec<String> = vec!["dst".into(), "dst2".into()];
    namen.extend(nachladen.iter().cloned());
    for n in &namen {
        let (s, t) = holen(adresse, nr, &format!("datei={}", kodiert(n))).await;
        assert_eq!(s, 200, "#{nr} datei={n}: {t}");
        let e: Value = serde_json::from_str(&t).unwrap();
        assert_eq!(dateien(&e).len(), 1, "#{nr} datei={n}: {e}");
        let f = &dateien(&e)[0];
        for p in patches(f) {
            ohne_fremd(&p, &format!("#{nr} datei={n}"));
        }
        netto_pruefen(f, &format!("#{nr} datei={n}"));
        let ohne_nachladen = |d: &Value| d["nachladen"] != json!(true);
        assert!(ohne_nachladen(f) && f["schritte"].as_array().is_none_or(|s| s.iter().all(ohne_nachladen)), "#{nr} datei={n} nachladen: {f}");
        let (s, text) = holen(adresse, nr, &format!("datei={}&format=patch", kodiert(n))).await;
        assert_eq!(s, 200, "#{nr} datei={n}&format=patch: {text}");
        ohne_fremd(&text, &format!("#{nr} datei={n}&format=patch"));
    }
    !nachladen.is_empty()
}

// ---- Testfälle --------------------------------------------------------------------------------------------------------

/// AK 1, AK 2, US-1, US-2: Fälle N und F, je 40 Varianten (2 bis 4 gleich bewertete Quellen). Liste, `format=patch`,
/// `datei=dst`, `datei=dst2` und `datei=` auf jeden `nachladen`-Eintrag: immer 200, keine Zeile `FREMD`, Netto bytegleich.
/// Vor dem Fix in den Varianten mit vier Quellen 500 „Patch-Lauf: „dst“ (R) hat 0 von 1 Stücken“.
#[tokio::test]
async fn ak1_ak2_gleich_bewertete_quellen_netto_und_mit_fremdem_commit() {
    let l = Lage::neu();
    let mut karten: Vec<(u32, Vec<String>)> = vec![];
    for v in 0..40 {
        karten.push((v as u32 + 1, fall_n(&l, v)));
        karten.push((v as u32 + 101, fall_f(&l, v)));
    }
    let lauf = l.starten(&karten, &[]);
    let mut mit_nachladen = 0;
    for (nr, karte) in &karten {
        if karte_pruefen(&l, &lauf.adresse, *nr, karte).await {
            mit_nachladen += 1;
        }
    }
    assert!(mit_nachladen > 0, "keine Variante paarte mit Pfadangabe anders — die Probe prüft die Klasse nicht");
}

/// Ein Git-Skript für `Lage::git_skript`: jeder Patch-Lauf von `diff-tree` lässt das Stück von `pfad` weg.
fn ohne_stueck(pfad: &str) -> String {
    format!("case \"$*\" in *diff-tree*--raw*|*diff-tree*--numstat*|*diff-tree*--name*) ;; *diff-tree*) $echt \"$@\" | awk '/^diff --git /{{weg = ($0 == \"diff --git a/{pfad} b/{pfad}\")}} !weg'; exit 0;; esac")
}

/// AK 3 (Netto), N7.10 Regel: streng (500) nur, wenn der Netto-Patch-Lauf dieselbe Angabe hat wie die Netto-Liste. Ein
/// Git-Skript lässt das Stück von `b.txt` weg.
/// - K1 (nur Karte, alles im Lauf): Liste und Patch ohne Angabe → 500 „„b.txt“ (M) hat 0 von 1 Stücken“.
/// - Karte K2, fremder Commit F (an `f.txt`), K3: Liste und Patch mit `D_karte` → 500.
/// - K4 wie K1 und dazu `gross`: Patch mit kleinerer Angabe → 200, `b.txt` `nachladen`, `a.txt` mit Patch.
#[tokio::test]
async fn ak3_netto_streng_nur_bei_gleicher_angabe() {
    let l = Lage::neu();
    let a = |t: &str| format!("{t}\n");
    l.baum(&[("a.txt", a("a")), ("b.txt", a("b")), ("f.txt", a("f"))], "A");
    let k1 = l.baum(&[("a.txt", a("a1")), ("b.txt", a("b1")), ("f.txt", a("f"))], "K1");
    let k2 = l.baum(&[("a.txt", a("a2")), ("b.txt", a("b2")), ("f.txt", a("f"))], "K2");
    l.baum(&[("a.txt", a("a2")), ("b.txt", a("b2")), ("f.txt", a("f2"))], "F");
    let k3 = l.baum(&[("a.txt", a("a3")), ("b.txt", a("b3")), ("f.txt", a("f2"))], "K3");
    let gross: String = (0..3001).map(|i| format!("g{i}\n")).collect();
    let k4 = l.baum(&[("a.txt", a("a4")), ("b.txt", a("b4")), ("f.txt", a("f2")), ("gross", gross)], "K4");
    let pfad = l.git_skript(&ohne_stueck("b.txt"));
    let lauf = l.starten(&[(1, vec![k1]), (2, vec![k2, k3]), (3, vec![k4])], &[("PATH", &pfad)]);
    for nr in [1, 2] {
        let (s, t) = holen(&lauf.adresse, nr, "").await;
        assert_eq!((s, t.contains("„b.txt“ (M) hat 0 von 1 Stücken")), (500, true), "#{nr}: {t}");
    }
    let (s, t) = holen(&lauf.adresse, 3, "").await;
    assert_eq!(s, 200, "#3: {t}");
    let d: Value = serde_json::from_str(&t).unwrap();
    let datei = |n: &str| dateien(&d).iter().find(|f| name(f) == n).unwrap().clone();
    assert_eq!((datei("b.txt")["nachladen"].clone(), datei("b.txt")["patch"].clone()), (json!(true), Value::Null), "{d}");
    assert_eq!(datei("a.txt")["patch"], json!("@@ -1 +1 @@\n-a3\n+a4\n"), "{d}");
}

/// AK 3 (Folge): `b.txt` ist Folge (K1, fremder Commit F, K2 ändern es). Ein Git-Skript lässt jedes Stück von `b.txt` weg.
/// - Karte #1: der Folge-Patch-Lauf hat dieselbe Angabe wie die Folge-Liste → 500 „hat 0 von 1 Stücken“.
/// - Karte #2: dazu `gross2` (über 3.000 Zeilen), das auch F ändert — Folge-Pfad, aber nicht im Patch-Lauf; dessen Angabe
///   ist kleiner als die der Folge-Liste → 200, der **ganze** Folge-Eintrag `b.txt` `nachladen` (jeder Schritt, ohne
///   Patch), `a.txt` (netto) behält seinen Patch.
#[tokio::test]
async fn ak3_folge_ganz_nachladen_streng_nur_bei_gleicher_angabe() {
    let l = Lage::neu();
    let z = |t: &str| format!("{t}\n");
    let gross = |t: &str| (0..3001).map(|i| format!("{t}{i}\n")).collect::<String>();
    let mut karten = vec![];
    for (nr, mit_gross) in [(1u32, false), (2, true)] {
        let mut stand = vec![("a.txt", z("a")), ("b.txt", z("b0"))];
        l.baum(&stand, "A");
        stand = vec![("a.txt", z("a1")), ("b.txt", z("b1"))];
        if mit_gross {
            stand.push(("gross2", gross("g")));
        }
        let k1 = l.baum(&stand, "K1");
        stand[1].1 = z("b-fremd");
        if mit_gross {
            stand[2].1 = gross("f");
        }
        l.baum(&stand, "F");
        stand[1].1 = z("b2");
        let k2 = l.baum(&stand, "K2");
        karten.push((nr, vec![k1, k2]));
    }
    let pfad = l.git_skript(&ohne_stueck("b.txt"));
    let lauf = l.starten(&karten, &[("PATH", &pfad)]);
    let (s, t) = holen(&lauf.adresse, 1, "").await;
    assert_eq!((s, t.contains("„b.txt“ (M) hat 0 von 1 Stücken")), (500, true), "#1: {t}");
    for format in ["", "format=patch"] {
        let (s, t) = holen(&lauf.adresse, 2, format).await;
        assert_eq!(s, 200, "#2 {format}: {t}");
    }
    let (_, t) = holen(&lauf.adresse, 2, "").await;
    let d: Value = serde_json::from_str(&t).unwrap();
    let datei = |n: &str| dateien(&d).iter().find(|f| name(f) == n).unwrap_or_else(|| panic!("{n} fehlt: {d}")).clone();
    let b = datei("b.txt");
    let schritte = b["schritte"].as_array().unwrap_or_else(|| panic!("b.txt ist keine Folge: {b}"));
    assert_eq!(schritte.len(), 2, "{b}");
    assert!(schritte.iter().all(|s| s["nachladen"] == json!(true) && s["patch"].is_null()), "ganzer Eintrag nachladen: {b}");
    assert_eq!(datei("a.txt")["patch"], json!("@@ -1 +1 @@\n-a\n+a1\n"), "{d}");
}

/// Ein Git-Skript: jeder Patch-Lauf schreibt in `spur` „ohne“ (keine Pfadangabe), „bezug“ (die Angabe enthält einen Pfad
/// `gross…`, also die des Bezugs) oder „klein“; in einem kleinen Lauf fehlt das Stück, dessen Kopf auf ` b/<ziel>` endet.
fn spur_und_luecke(spur: &Path, ziel: &str) -> String {
    format!("case \"$*\" in *diff-tree*--raw*|*diff-tree*--numstat*|*diff-tree*--name*) ;; *diff-tree*) eval letztes=\\${{$#}}; case \" $* \" in *\" gross\"*) art=bezug;; *) art=klein;; esac; [ \"$letztes\" = \"--\" ] && art=ohne; echo $art >> {s}; if [ $art = klein ]; then $echt \"$@\" | awk '/^diff --git /{{weg = ($0 ~ / b\\/{ziel}$/)}} !weg'; exit 0; fi;; esac", s = spur.display())
}

fn spur_lesen(spur: &Path) -> Vec<String> {
    let l = std::fs::read_to_string(spur).unwrap_or_default().lines().map(String::from).collect();
    let _ = std::fs::remove_file(spur);
    l
}

/// AK 2: fehlt dem ersten Lauf von `datei=` das Stück, folgt genau ein Rückfall mit der Angabe des Bezugs — Fall N
/// (Spanne ohne fremde Commits) ohne Angabe, Fall F mit `D_karte` (enthält `gross`), Folge mit der Angabe der
/// Folge-Liste (enthält `gross2`); nie ohne Angabe über eine Spanne mit fremden Commits. Antwort 200, Netto bytegleich,
/// keine `FREMD`-Zeile. Vor dem Fix: 500 „hat 0 von 1 Stücken“.
#[tokio::test]
async fn ak2_datei_rueckfall_mit_der_angabe_des_bezugs() {
    for (fall, ziel, erwartet) in [("N", "dst", ["klein", "ohne"]), ("F", "dst", ["klein", "bezug"])] {
        let l = Lage::neu();
        let karte = if fall == "N" { fall_n(&l, 2) } else { fall_f(&l, 2) };
        let stuecke = l.netto_stuecke(&karte);
        let spur = l.r.parent().unwrap().join("spur");
        let pfad = l.git_skript(&spur_und_luecke(&spur, ziel));
        let lauf = l.starten(&[(1, karte.clone())], &[("PATH", &pfad)]);
        let (s, t) = holen(&lauf.adresse, 1, &format!("datei={ziel}")).await;
        assert_eq!(s, 200, "Fall {fall}: {t}");
        assert_eq!(spur_lesen(&spur), erwartet, "Fall {fall}: Läufe von datei={ziel}");
        let f = &dateien(&serde_json::from_str::<Value>(&t).unwrap())[0].clone();
        let kopf = format!("diff --git a/{} b/{}\n", f["alt"].as_str().unwrap_or(ziel), ziel);
        let st = stuecke.iter().find(|s| s.starts_with(&kopf)).unwrap();
        assert_eq!(f["patch"].as_str().unwrap(), hunks(st), "Fall {fall}: bytegleich");
        let (s, text) = holen(&lauf.adresse, 1, &format!("datei={ziel}&format=patch")).await;
        let ohne_hinweise: String = text.split_inclusive('\n').filter(|z| !z.starts_with("# kanbanD: ")).collect();
        assert_eq!((s, ohne_hinweise.as_str()), (200, st.as_str()), "Fall {fall} format=patch");
        ohne_fremd(&text, "datei format=patch");
    }
    // Folge: b.txt wie in ak3_folge…, Karte mit gross2 als Folge-Pfad außerhalb des ersten Laufs
    let l = Lage::neu();
    let z = |t: &str| format!("{t}\n");
    let gross = |t: &str| (0..3001).map(|i| format!("{t}{i}\n")).collect::<String>();
    l.baum(&[("a.txt", z("a")), ("b.txt", z("b0"))], "A");
    let k1 = l.baum(&[("a.txt", z("a1")), ("b.txt", z("b1")), ("gross2", gross("g"))], "K1");
    l.baum(&[("a.txt", z("a1")), ("b.txt", z("b-fremd")), ("gross2", gross("f"))], "F");
    let k2 = l.baum(&[("a.txt", z("a1")), ("b.txt", z("b2")), ("gross2", gross("f"))], "K2");
    let spur = l.r.parent().unwrap().join("spur");
    let pfad = l.git_skript(&spur_und_luecke(&spur, "b.txt"));
    let lauf = l.starten(&[(1, vec![k1, k2])], &[("PATH", &pfad)]);
    let (s, t) = holen(&lauf.adresse, 1, "datei=b.txt").await;
    assert_eq!(s, 200, "Folge: {t}");
    assert_eq!(spur_lesen(&spur), ["klein", "bezug"], "Folge: Läufe von datei=b.txt");
    let f = dateien(&serde_json::from_str::<Value>(&t).unwrap())[0].clone();
    let patches: Vec<&str> = f["schritte"].as_array().unwrap().iter().map(|s| s["patch"].as_str().unwrap_or("")).collect();
    assert_eq!(patches, ["@@ -1 +1 @@\n-b0\n+b1\n", "@@ -1 +1 @@\n-b-fremd\n+b2\n"], "{f}");
}
