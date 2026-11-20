// R00211 (I0201, Karte #229): Diff je Commit — Pfadangabe bei Typwechsel Datei ↔ Verzeichnis ohne 500 (ADR-0032 N7.7).
// Akzeptanztests gegen das echte Programm und ein echtes Arbeits-Repository. Schichten: Testfall (je Fall a–d und AK) →
// Testsprache (`Lage`, `fall`, `liste_pruefen`, `datei_auf_jeden_namen`, Orakel `stuecke`) → Treiber (`holen`) → Programm.
mod gemeinsam;

use gemeinsam::{Laufendes, git, starten_mit};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

// ---- Treiber ----------------------------------------------------------------------------------------------------------

/// `GET /api/aufgaben/1/diff?{abfrage}`: Status und Rumpf, wie sie über die Leitung kamen.
async fn holen(adresse: &str, abfrage: &str) -> (u16, String) {
    let r = reqwest::Client::new().get(format!("{adresse}api/aufgaben/1/diff?{abfrage}")).send().await.unwrap();
    let status = r.status().as_u16();
    (status, String::from_utf8(r.bytes().await.unwrap().to_vec()).expect("gültiges UTF-8"))
}

fn kodiert(text: &str) -> String {
    text.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-._~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect()
}

// ---- Testsprache: Ausgangslage ----------------------------------------------------------------------------------------

/// Arbeits-Repository R einer Anwendung `kd` im Register, Aufgabe #1 mit genau dem Verweis `kd:<K>`.
struct Lage {
    _tmp: tempfile::TempDir,
    r: PathBuf,
    board: PathBuf,
}

/// `X`: die zehn Zeilen `x0` … `x9`.
fn x() -> String {
    (0..10).map(|i| format!("x{i}\n")).collect()
}

fn git_r(r: &Path, args: &[&str]) -> String {
    let a = std::process::Command::new("git").arg("-C").arg(r).args(["-c", "user.name=A", "-c", "user.email=a@a"]).args(args).output().unwrap();
    assert!(a.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&a.stderr));
    String::from_utf8(a.stdout).unwrap()
}

impl Lage {
    fn neu() -> Lage {
        let tmp = tempfile::tempdir().unwrap();
        let basis = tmp.path().canonicalize().unwrap();
        let (r, board) = (basis.join("R"), basis.join("board"));
        let l = Lage { _tmp: tmp, r, board };
        l.schreiben("Dokumentation/Planung/app.md", "# App\n");
        git_r(&l.r, &["init", "-q", "-b", "main"]);
        l.commit("WBS");
        std::fs::create_dir_all(l.board.join("aufgaben")).unwrap();
        std::fs::create_dir_all(l.board.join("boards")).unwrap();
        std::fs::write(l.board.join("kanbanD.md"), format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Dokumentation/Planung/app.md, requirements: \"\"}}\n---\n", l.r.display())).unwrap();
        git(&l.board, &["init", "-q"]);
        l
    }

    /// Schreibt `datei` (legt fehlende Ordner an).
    fn schreiben(&self, datei: &str, inhalt: &str) {
        std::fs::create_dir_all(self.r.join(datei).parent().unwrap()).unwrap();
        std::fs::write(self.r.join(datei), inhalt).unwrap();
    }

    fn loeschen(&self, pfad: &str) {
        let p = self.r.join(pfad);
        if p.is_dir() { std::fs::remove_dir_all(p).unwrap() } else { std::fs::remove_file(p).unwrap() }
    }

    fn commit(&self, nachricht: &str) -> String {
        git_r(&self.r, &["add", "-A"]);
        git_r(&self.r, &["commit", "-q", "-m", nachricht]);
        git_r(&self.r, &["rev-parse", "HEAD"]).trim().to_string()
    }

    /// Aufgabe #1 mit genau dem Verweis `kd:<k>`, dann das Programm gestartet.
    fn starten(&self, k: &str) -> Laufendes {
        self.starten_mit(&[k], &[])
    }

    /// Aufgabe #1 mit genau den Verweisen `kd:<k>` je Commit, dann das Programm mit `umgebung` gestartet.
    fn starten_mit<S: AsRef<str>>(&self, commits: &[S], umgebung: &[(&str, &str)]) -> Laufendes {
        let verweise: String = commits.iter().map(|k| format!("  - \"kd:{}\"\n", k.as_ref())).collect();
        std::fs::write(self.board.join("aufgaben/0001-k.md"), format!("---\nid: 1\ntitle: Karte 1\ncommits:\n{verweise}---\n")).unwrap();
        std::fs::write(self.board.join("boards/fabrik.md"), "# fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-k.md)\n").unwrap();
        git(&self.board, &["add", "-A"]);
        git(&self.board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Karte"]);
        starten_mit(&self.board, &["--port", "0", "--host", "127.0.0.1"], umgebung)
    }

    /// Ein `git` vorn im PATH des Servers (wie `git_skript` in `akzeptanz_r00206.rs`): für Läufe des Startorts in R führt
    /// es `bei_r` aus (`$echt` ist das echte Git), alles andere geht ans echte Git. Liefert den Wert für `PATH`.
    fn git_skript(&self, bei_r: &str) -> String {
        let echt = String::from_utf8(std::process::Command::new("sh").args(["-c", "command -v git"]).output().unwrap().stdout).unwrap().trim().to_string();
        let ordner = self.r.parent().unwrap().join("bin");
        std::fs::create_dir_all(&ordner).unwrap();
        let skript = format!("#!/bin/sh\necht={echt}\ncase \"$*\" in *\"{r}\"*core.hooksPath=/dev/null*)\n{bei_r}\n;; esac\nexec $echt \"$@\"\n", r = self.r.display());
        std::fs::write(ordner.join("git"), skript).unwrap();
        std::fs::set_permissions(ordner.join("git"), std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
        format!("{}:{}", ordner.display(), std::env::var("PATH").unwrap())
    }

    /// Orakel „bytegleich“: die Stücke von `git diff-tree -p` **ohne Pfadangabe** (R00211, Ausgangslage).
    fn stuecke(&self, k: &str) -> Vec<String> {
        let aus = git_r(&self.r, &["diff-tree", "-r", "-p", "--full-index", "-M50%", "-l1000", "--no-ext-diff", "--no-textconv", &format!("{k}^"), k]);
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

/// Fall (a) Typwechsel Datei → Verzeichnis mit gleichem Blob: Vorgänger `b` = X, `d/x` = X + `y`; K löscht beide und legt
/// `d/x/inner` = X an. `dazu` legt im selben K weitere Dateien an (Fall d, AK 3).
fn fall_a(l: &Lage, dazu: impl Fn(&Lage)) -> String {
    l.schreiben("b", &x());
    l.schreiben("d/x", &format!("{}y\n", x()));
    l.commit("Vorgänger");
    l.loeschen("b");
    l.loeschen("d/x");
    l.schreiben("d/x/inner", &x());
    dazu(l);
    l.commit("K")
}

/// Fall (b) die Umkehrung: Vorgänger `d/x/inner` = X; K benennt `d/x/inner` nach `b` um und legt `d/x` = X + `y` an.
fn fall_b(l: &Lage) -> String {
    l.schreiben("d/x/inner", &x());
    l.commit("Vorgänger");
    l.loeschen("d/x");
    l.schreiben("b", &x());
    l.schreiben("d/x", &format!("{}y\n", x()));
    l.commit("K")
}

/// Fall (c) Zwilling: Vorgänger `b` = X, `d/x` = X, `g` eine Zeile; K löscht `b`, ersetzt das Verzeichnis `d` durch die
/// Datei `d` und schreibt `g` mit 3.001 Zeilen neu (`gross`, die Liste läuft mit Pfadangabe).
fn fall_c(l: &Lage) -> String {
    l.schreiben("b", &x());
    l.schreiben("d/x", &x());
    l.schreiben("g", "alt\n");
    l.commit("Vorgänger");
    l.loeschen("b");
    l.loeschen("d");
    l.schreiben("d", "datei d\nganz anders\n");
    l.schreiben("g", &(0..3001).map(|i| format!("g{i}\n")).collect::<String>());
    l.commit("K")
}

// ---- Testsprache: Proben ----------------------------------------------------------------------------------------------

fn dateien(d: &Value) -> &Vec<Value> {
    d["dateien"].as_array().unwrap_or_else(|| panic!("keine dateien: {d}"))
}

/// Der Name einer Datei der Liste: `neu`, bei gelöschten `alt`.
fn name(f: &Value) -> &str {
    f["neu"].as_str().or(f["alt"].as_str()).unwrap()
}

/// Das Stück der Datei aus dem Orakel (Kopf `diff --git a/<alt> b/<neu>`).
fn stueck_von<'a>(stuecke: &'a [String], f: &Value) -> &'a str {
    let (alt, neu) = (f["alt"].as_str().unwrap_or_else(|| name(f)), name(f));
    let kopf = format!("diff --git a/{alt} b/{neu}\n");
    let treffer: Vec<&String> = stuecke.iter().filter(|s| s.starts_with(&kopf)).collect();
    assert_eq!(treffer.len(), 1, "genau ein Stück mit {kopf:?}");
    treffer[0]
}

/// Die Hunks eines Stücks (ab der ersten Zeile `@@`), leer ohne Hunks.
fn hunks(stueck: &str) -> &str {
    stueck.find("\n@@").map_or("", |i| &stueck[i + 1..])
}

/// Hat die Datei einen Patch, ist er bytegleich zum Orakel; ohne Patch nur, wenn sie `gross` oder `nachladen` ist oder das
/// Orakel keine Hunks hat.
fn patch_pruefen(f: &Value, stuecke: &[String]) {
    let erwartet = hunks(stueck_von(stuecke, f));
    match f["patch"].as_str() {
        Some(p) => assert_eq!(p, erwartet, "Patch von {} nicht bytegleich", name(f)),
        None => assert!(erwartet.is_empty() || f["gross"] == json!(true) || f["nachladen"] == json!(true), "{} ohne Patch: {f}", name(f)),
    }
}

/// Die Liste des Commits als JSON und `format=patch`: je 200, jeder Patch bytegleich, jedes Stück mit Patch im Text.
async fn liste_pruefen(adresse: &str, k: &str, stuecke: &[String]) -> Value {
    let (s, t) = holen(adresse, &format!("commit=kd:{k}")).await;
    assert_eq!(s, 200, "Liste: {t}");
    let d: Value = serde_json::from_str(&t).unwrap();
    for f in dateien(&d) {
        patch_pruefen(f, stuecke);
    }
    let (s, text) = holen(adresse, &format!("commit=kd:{k}&format=patch")).await;
    assert_eq!(s, 200, "Liste format=patch: {text}");
    for f in dateien(&d).iter().filter(|f| f["patch"].is_string()) {
        assert!(text.contains(stueck_von(stuecke, f)), "Stück von {} fehlt im Text", name(f));
    }
    d
}

/// `datei=<name>` auf jeden Namen der Liste, als JSON und mit `format=patch` (AK 1): 200, genau der eine Eintrag der Liste
/// mit `status`, `alt`, `neu`, `plus`, `minus`; der Patch bytegleich, der Text gleich dem Stück.
async fn datei_auf_jeden_namen(adresse: &str, k: &str, liste: &Value, stuecke: &[String]) {
    for f in dateien(liste) {
        let n = name(f);
        let (s, t) = holen(adresse, &format!("commit=kd:{k}&datei={}", kodiert(n))).await;
        assert_eq!(s, 200, "datei={n}: {t}");
        let d: Value = serde_json::from_str(&t).unwrap();
        assert_eq!(dateien(&d).len(), 1, "datei={n}: {d}");
        let e = &dateien(&d)[0];
        for feld in ["status", "alt", "neu", "plus", "minus"] {
            assert_eq!(e[feld], f[feld], "datei={n}: {feld}");
        }
        let erwartet = hunks(stueck_von(stuecke, f));
        assert_eq!(e["patch"].as_str().unwrap_or(""), erwartet, "datei={n}: Patch nicht bytegleich");
        let (s, text) = holen(adresse, &format!("commit=kd:{k}&datei={}&format=patch", kodiert(n))).await;
        assert_eq!(s, 200, "datei={n}&format=patch: {text}");
        assert_eq!(text, stueck_von(stuecke, f), "datei={n}&format=patch nicht bytegleich");
    }
}

// ---- Testfälle --------------------------------------------------------------------------------------------------------

/// AK 1 (a), US-1: `datei=d/x` → genau `D d/x`, minus 11, `@@ -1,11 +0,0 @@`. Vor dem Fix 500 „Zähler passen nicht zur Datei“.
#[tokio::test]
async fn ak1_a_typwechsel_datei_zu_verzeichnis() {
    let l = Lage::neu();
    let k = fall_a(&l, |_| {});
    let stuecke = l.stuecke(&k);
    let lauf = l.starten(&k);
    let liste = liste_pruefen(&lauf.adresse, &k, &stuecke).await;
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k}&datei=d/x")).await;
    assert_eq!(s, 200, "{t}");
    let d: Value = serde_json::from_str(&t).unwrap();
    let e = &dateien(&d)[0];
    assert_eq!((&e["status"], &e["minus"], &e["plus"]), (&json!("D"), &json!(11), &json!(0)));
    assert!(e["patch"].as_str().unwrap().starts_with("@@ -1,11 +0,0 @@\n-x0\n"), "{e}");
    datei_auf_jeden_namen(&lauf.adresse, &k, &liste, &stuecke).await;
}

/// AK 1 (b), US-2: `datei=d/x` → genau `A d/x`, plus 11, Text mit Kopf `diff --git a/d/x b/d/x`. Vor dem Fix je 500.
#[tokio::test]
async fn ak1_b_typwechsel_verzeichnis_zu_datei() {
    let l = Lage::neu();
    let k = fall_b(&l);
    let stuecke = l.stuecke(&k);
    let lauf = l.starten(&k);
    let liste = liste_pruefen(&lauf.adresse, &k, &stuecke).await;
    let (s, text) = holen(&lauf.adresse, &format!("commit=kd:{k}&datei=d/x&format=patch")).await;
    assert_eq!(s, 200, "{text}");
    assert!(text.starts_with("diff --git a/d/x b/d/x\n"), "{text}");
    datei_auf_jeden_namen(&lauf.adresse, &k, &liste, &stuecke).await;
}

/// AK 1 und AK 2 (c), US-4: Zwilling `b`/`d/x` und `g` `gross` — die Liste läuft mit Pfadangabe; jeder hat seinen Kopf.
/// Festhalte-Probe: vor dem Fix schon grün.
#[tokio::test]
async fn ak1_ak2_c_zwilling_mit_grosser_datei() {
    let l = Lage::neu();
    let k = fall_c(&l);
    let stuecke = l.stuecke(&k);
    let lauf = l.starten(&k);
    let liste = liste_pruefen(&lauf.adresse, &k, &stuecke).await;
    let g = dateien(&liste).iter().find(|f| name(f) == "g").unwrap();
    assert_eq!(g["gross"], json!(true), "g läuft nicht mit: die Liste hat eine Pfadangabe");
    for n in ["b", "d/x"] {
        let f = dateien(&liste).iter().find(|f| name(f) == n).unwrap();
        assert!(f["patch"].is_string(), "{n} mit eigenem Patch: {f}");
    }
    datei_auf_jeden_namen(&lauf.adresse, &k, &liste, &stuecke).await;
}

/// AK 2 (d), US-3: Fall (a) und 2.000 neue Dateien `d/x/a0000` … `d/x/a1999` → 200, `dateien_gekappt` 2.000 von 2.002,
/// `d/x` mit eigenem Patch. Vor dem Fix 500 „Patch-Lauf: „d/x“ (D) hat 0 von 1 Stücken“.
#[tokio::test]
async fn ak2_d_liste_ueber_der_kappe() {
    let l = Lage::neu();
    let k = fall_a(&l, |l| {
        for i in 0..2000 {
            l.schreiben(&format!("d/x/a{i:04}"), &format!("a{i}\n"));
        }
    });
    let stuecke = l.stuecke(&k);
    let lauf = l.starten(&k);
    let liste = liste_pruefen(&lauf.adresse, &k, &stuecke).await;
    assert_eq!((dateien(&liste).len(), &liste["hinweise"]), (2000, &json!([{"art": "dateien_gekappt", "gezeigt": 2000, "gesamt": 2002}])));
    let dx = dateien(&liste).iter().find(|f| name(f) == "d/x").unwrap();
    assert_eq!((&dx["status"], &dx["minus"]), (&json!("D"), &json!(11)));
    assert_eq!(dx["patch"].as_str().unwrap().lines().filter(|z| z.starts_with('-')).count(), 11, "{dx}");
}

/// Eigene Variante zu AK 1 (Mutant m3): Zwilling als Umbenennung im Typwechsel — Vorgänger `s` = X und `m/a` = X; K legt
/// die Datei `m` und `c` an, beide X + `z`: zwei Umbenennungen mit demselben Blob-Paar. `datei=m` trifft über `m/` auch
/// die Quelle `m/a` und so die andere Umbenennung, deren Stück vor dem von `m` steht; nur im Bezug zugeordnet bekommt `m`
/// sein eigenes Stück.
#[tokio::test]
async fn ak1_e_umbenennungs_zwilling_im_typwechsel() {
    let l = Lage::neu();
    l.schreiben("s", &x());
    l.schreiben("m/a", &x());
    l.commit("Vorgänger");
    l.loeschen("s");
    l.loeschen("m");
    l.schreiben("m", &format!("{}z\n", x()));
    l.schreiben("c", &format!("{}z\n", x()));
    let k = l.commit("K");
    let stuecke = l.stuecke(&k);
    let lauf = l.starten(&k);
    let liste = liste_pruefen(&lauf.adresse, &k, &stuecke).await;
    assert_eq!(dateien(&liste).iter().map(|f| (f["status"].as_str().unwrap(), name(f))).collect::<Vec<_>>(), [("R", "c"), ("R", "m")], "{liste}");
    datei_auf_jeden_namen(&lauf.adresse, &k, &liste, &stuecke).await;
    // N7.8: die Zuordnung im Bezug trägt ohne Rückfall (der Rückfall heilte sonst still eine Zuordnung ohne Bezug)
    assert_eq!(laeufe_fuer(&l, &k, "m").await.len(), 3, "Dateiliste, Zähler, Patch — kein Rückfall");
}

/// AK 3, US-5: Fall (a) und so viele neue Dateien `d/x/a<nnnn>…` mit Namen von 200 Zeichen, dass die Dateiliste über 1 MB
/// liegt und `R b → d/x/inner` hinter dem Schnitt steht. Die Liste: 200, `d/x` `nachladen` ohne Patch, nie 500;
/// `datei=d/x` (Liste bis 20 MB vollständig): 200 wie AK 1.
#[tokio::test]
async fn ak3_abgeschnittene_liste_mit_umbenennung_hinter_dem_schnitt() {
    let l = Lage::neu();
    let fuell = "f".repeat(195);
    let k = fall_a(&l, |l| {
        for i in 0..3600 {
            l.schreiben(&format!("d/x/a{i:04}{fuell}"), &format!("a{i}\n"));
        }
    });
    let roh = git_r(&l.r, &["diff-tree", "-r", "-M50%", "-l1000", "--raw", "-z", &format!("{k}^"), &k]);
    assert!(roh.len() > 1 << 20, "Dateiliste {} Byte, nicht über 1 MB", roh.len());
    let schnitt = roh.as_bytes()[..1 << 20].iter().rposition(|b| *b == 0).unwrap();
    assert!(roh[..schnitt].find("d/x/inner").is_none(), "R b → d/x/inner steht vor dem Schnitt");
    let stuecke = l.stuecke(&k);
    let lauf = l.starten(&k);
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k}")).await;
    assert_eq!(s, 200, "{t}");
    let d: Value = serde_json::from_str(&t).unwrap();
    let dx = dateien(&d).iter().find(|f| name(f) == "d/x").unwrap();
    assert_eq!((&dx["nachladen"], &dx["patch"]), (&json!(true), &Value::Null), "{dx}");
    let (s, text) = holen(&lauf.adresse, &format!("commit=kd:{k}&format=patch")).await;
    assert_eq!(s, 200, "{text}");
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k}&datei=d/x")).await;
    assert_eq!(s, 200, "{t}");
    let e: Value = serde_json::from_str(&t).unwrap();
    assert_eq!(dateien(&e)[0]["patch"].as_str().unwrap(), hunks(stueck_von(&stuecke, dx)));
}

/// Eigene Variante zu AK 3, berichtigt durch AK 8 (ADR-0032 N7.8): Fall (a) mit so vielen Dateien unter `d/x/`, dass die
/// gegen die Liste abgeschlossene Angabe von `datei=d/x` über 1 MB läge (ARG_MAX, N5.5 S1) → Rückfall ohne Pfadangabe:
/// 200 mit `D d/x` und bytegleichem Patch, nie 500; die Liste bleibt 200. Vor N7.8: 404 „Dateiliste zu groß“.
#[tokio::test]
async fn ak3_ak8_abgeschlossene_angabe_ueber_1_mb_faellt_zurueck() {
    let l = Lage::neu();
    let fuell = "f".repeat(195);
    let k = fall_a(&l, |l| {
        for i in 0..5300 {
            l.schreiben(&format!("d/x/a{i:04}{fuell}"), &format!("a{i}\n"));
        }
    });
    let stuecke = l.stuecke(&k);
    let lauf = l.starten(&k);
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k}&datei=d/x")).await;
    assert_eq!(s, 200, "{t}");
    let e: Value = serde_json::from_str(&t).unwrap();
    let dx = &dateien(&e)[0];
    assert_eq!((dateien(&e).len(), &dx["status"], &dx["minus"]), (1, &json!("D"), &json!(11)), "{e}");
    assert_eq!(dx["patch"].as_str().unwrap(), hunks(stueck_von(&stuecke, dx)));
    let (s, text) = holen(&lauf.adresse, &format!("commit=kd:{k}&datei=d/x&format=patch")).await;
    assert_eq!((s, text.as_str()), (200, stueck_von(&stuecke, dx)));
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k}")).await;
    assert_eq!(s, 200, "{t}");
}

// ---- Feste Fälle aus der Zufallsprobe (AK 4): vor dem Fix rot ----------------------------------------------------------

/// Ein Commit K von genau dem Baum `vorher` (Pfad, Inhalt) auf genau den Baum `nachher`.
fn baeume(l: &Lage, vorher: &[(&str, &str)], nachher: &[(&str, &str)]) -> String {
    let leeren = |l: &Lage| {
        for e in std::fs::read_dir(&l.r).unwrap() {
            let n = e.unwrap().file_name().into_string().unwrap();
            if n != ".git" && n != "Dokumentation" {
                l.loeschen(&n);
            }
        }
    };
    for (baum, nachricht) in [(vorher, "Vorgänger"), (nachher, "K")] {
        leeren(l);
        for (p, inhalt) in baum {
            l.schreiben(p, inhalt);
        }
        if nachricht == "K" {
            return l.commit(nachricht);
        }
        l.commit(nachricht);
    }
    unreachable!()
}

fn zeilen(prefix: &str, n: usize) -> String {
    (0..n).map(|j| format!("{prefix}-{j}\n")).collect()
}

async fn fester_fall(vorher: &[(&str, &str)], nachher: &[(&str, &str)]) {
    let l = Lage::neu();
    let k = baeume(&l, vorher, nachher);
    let stuecke = l.stuecke(&k);
    let lauf = l.starten(&k);
    let liste = liste_pruefen(&lauf.adresse, &k, &stuecke).await;
    datei_auf_jeden_namen(&lauf.adresse, &k, &liste, &stuecke).await;
}

/// Seed 14: drei gleiche Inhalte; K: `R w1/x → d0.txt/x` und `R d0.txt → t1`. Vor dem Fix `datei=t1` 500 „Zähler passen
/// nicht zur Datei“ (die Angabe `d0.txt` traf `d0.txt/x`).
#[tokio::test]
async fn ak4_seed_14_drei_zwillinge_mit_typwechsel() {
    let b = zeilen("b0", 4);
    fester_fall(&[("d0.txt", &b), ("v0/y/z", &b), ("w1/x", &b)], &[("d0.txt/x", &b), ("t1", &b), ("v0/y/z", &b)]).await;
}

/// Seed 72: K löscht `v0/y/z` (Zwilling von `d0.txt`) und benennt `d0.txt` nach `v0/y/z/inner` um. Vor dem Fix
/// `datei=v0/y/z` 500 „Zähler passen nicht zur Datei“.
#[tokio::test]
async fn ak4_seed_72_geloeschter_zwilling_unter_dem_ziel() {
    let b = zeilen("b0", 4);
    let g = zeilen("g1", 3002);
    fester_fall(&[("d0.txt", &b), ("v0/y/z", &b), ("w1/x", &b)], &[("g1", &g), ("v0/y/z/inner", &b), ("w1/x", &b)]).await;
}

/// Seed 645: zwei Dateien über 3.000 Zeilen (Liste mit Pfadangabe), `g2/x → k5-1/inner` mit dem Inhalt der gelöschten
/// `k5-1`, `g2` wird Datei. Vor dem Fix `datei=k5-1` 500 „Zähler passen nicht zur Datei“.
#[tokio::test]
async fn ak4_seed_645_typwechsel_beider_richtungen_mit_grossen_dateien() {
    let (g1, g5, g6) = (zeilen("g1", 3002), zeilen("g5", 3006), zeilen("g6", 3007));
    fester_fall(&[("g0", &g5), ("g2/x", &g1), ("k5-1", &g1)], &[("g0", &g6), ("g2", &g6), ("k5-1/inner", &g1)]).await;
}

// ---- Nacharbeit 1 (ADR-0032 N7.8): ein Lauf mit Pfadangabe ist eine Abkürzung, kein Beleg --------------------------

/// Variante `v` der Abnahme-Probe `tie2f.py` (Code-Review M1): Commit A legt `n` = 2 bis 4 Quellen `s<i>` an, je die
/// Zeilen `l0 l1 l2 l3` und eine eigene Zeile, dazu `gross` mit 3.010 + `v` Zeilen; Commit B löscht alle und legt `dst`
/// und `dst2` an, je `l0..l3` und eine eigene Zeile. Alle Quellen sind für beide Ziele gleich bewertet; die Liste läuft
/// wegen `gross` mit Pfadangabe. Liefert B.
fn gleich_bewertet(l: &Lage, v: usize) -> String {
    let basis: String = (0..4).map(|i| format!("l{i}\n")).collect();
    let quellen: Vec<(String, String)> = (0..2 + v % 3).map(|i| (format!("s{i}"), format!("{basis}x{i}-{v}\n"))).collect();
    let gross = (0..3010 + v).map(|i| format!("g{i}\n")).collect::<String>();
    let vorher: Vec<(&str, &str)> = quellen.iter().map(|(p, c)| (p.as_str(), c.as_str())).chain([("gross", gross.as_str())]).collect();
    let (dst, dst2) = (format!("{basis}neu{v}\n"), format!("{basis}neu2-{v}\n"));
    baeume(l, &vorher, &[("dst", &dst), ("dst2", &dst2)])
}

/// AK 7, AK 8, US-6: 40 Varianten mit gleich bewerteten Quellen. Je Variante die Liste als JSON und mit `format=patch`:
/// 200, jeder Patch bytegleich zum Lauf ohne Pfadangabe, ein Eintrag ohne Stück `nachladen` statt 500; dann `datei=` auf
/// jeden Namen (darin jede `nachladen`-Datei): 200 und bytegleich. Vor dem Fix in den Varianten mit vier Quellen 500
/// „Patch-Lauf: „dst“ (R) hat 0 von 1 Stücken“.
#[tokio::test]
async fn ak7_ak8_gleich_bewertete_quellen_in_40_varianten() {
    let l = Lage::neu();
    let commits: Vec<String> = (0..40).map(|v| gleich_bewertet(&l, v)).collect();
    let lauf = l.starten_mit(&commits, &[]);
    let mut mit_nachladen = 0;
    for k in &commits {
        let stuecke = l.stuecke(k);
        let liste = liste_pruefen(&lauf.adresse, k, &stuecke).await;
        assert!(dateien(&liste).iter().any(|f| f["gross"] == json!(true)), "{k}: gross fehlt — die Liste liefe ohne Pfadangabe");
        if dateien(&liste).iter().any(|f| f["nachladen"] == json!(true)) {
            mit_nachladen += 1;
        }
        datei_auf_jeden_namen(&lauf.adresse, k, &liste, &stuecke).await;
    }
    assert!(mit_nachladen > 0, "keine Variante paarte mit Pfadangabe anders — die Probe prüft die Klasse nicht");
}

/// AK 8: Rückfall ohne Pfadangabe mit dem Stück hinter 8 MB. Vorgänger: Datei `x`; K löscht sie, legt 5.300 Dateien
/// unter `x/` an (abgeschlossene Angabe von `datei=x` über 1 MB → Rückfall) und davor in der Reihenfolge `a-riesig` mit
/// über 8 MB Patch. `datei=x` → 200, `D x` mit `minus` wie in der Liste, `gross` ohne Patch, Hinweis
/// `zu_gross_zum_anzeigen`. Vor dem Fix: 404 „Dateiliste zu groß“.
#[tokio::test]
async fn ak8_rueckfall_mit_stueck_hinter_8_mb_ist_gross() {
    let l = Lage::neu();
    l.schreiben("x", "x0\nx1\nx2\n");
    l.commit("Vorgänger");
    l.loeschen("x");
    let fuell = "f".repeat(200);
    for i in 0..5300 {
        l.schreiben(&format!("x/{i:04}{fuell}"), "q\n");
    }
    l.schreiben("a-riesig", &(0..320_000).map(|i| format!("riesige Zeile {i:>12}\n")).collect::<String>());
    let k = l.commit("K");
    let lauf = l.starten(&k);
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k}&datei=x")).await;
    assert_eq!(s, 200, "{t}");
    let d: Value = serde_json::from_str(&t).unwrap();
    let x = &dateien(&d)[0];
    assert_eq!((dateien(&d).len(), &x["status"], &x["minus"], &x["gross"], &x["patch"]), (1, &json!("D"), &json!(3), &json!(true), &Value::Null), "{d}");
    assert_eq!(d["hinweise"], json!([{"art": "zu_gross_zum_anzeigen", "datei": "x"}]));
}

/// AK 8 (Director, E2BIG): startet Git mit der abgeschlossenen Angabe nicht, weil Argumente und Umgebung zusammen über
/// ARG_MAX liegen, löst das den Rückfall ohne Pfadangabe aus. Die Instanz läuft mit Füllvariablen bis 150 KB unter
/// ARG_MAX (sie gehen an jedes Git); Fall (a) mit 1.000 Dateien unter `d/x/` gibt eine Angabe von etwa 210 KB — unter der
/// gezählten Grenze von 1 MB, zusammen mit der Umgebung über ARG_MAX. `datei=d/x` → 200 wie AK 1. Vor dem Fix: 500
/// „git: Argument list too long (os error 7)“.
#[tokio::test]
async fn ak8_e2big_beim_start_faellt_zurueck() {
    let l = Lage::neu();
    let fuell = "f".repeat(195);
    let k = fall_a(&l, |l| {
        for i in 0..1000 {
            l.schreiben(&format!("d/x/a{i:04}{fuell}"), &format!("a{i}\n"));
        }
    });
    let stuecke = l.stuecke(&k);
    let arg_max: usize = String::from_utf8(std::process::Command::new("getconf").arg("ARG_MAX").output().unwrap().stdout).unwrap().trim().parse().unwrap();
    let wert = "u".repeat(100_000);
    let namen: Vec<String> = (0..(arg_max - 150_000) / 100_020).map(|i| format!("KD_FUELLE_{i:04}")).collect();
    let umgebung: Vec<(&str, &str)> = namen.iter().map(|n| (n.as_str(), wert.as_str())).collect();
    let lauf = l.starten_mit(&[&k], &umgebung);
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k}&datei=d/x")).await;
    assert_eq!(s, 200, "{t}");
    let e: Value = serde_json::from_str(&t).unwrap();
    let dx = &dateien(&e)[0];
    assert_eq!((&dx["status"], &dx["minus"]), (&json!("D"), &json!(11)), "{e}");
    assert_eq!(dx["patch"].as_str().unwrap(), hunks(stueck_von(&stuecke, dx)));
}

/// AK 9, US-7: Die Dateiliste von `datei=` ist an der Grenze abgeschnitten (ein Git-Skript liefert endlos Einträge), und
/// auch der Rückfall findet den Namen nicht → 404 mit dem Wortlaut nach PO Z. 447 und dem vollen Hash; ohne den Pfad
/// aus der Anfrage und ohne „MB“.
#[tokio::test]
async fn ak9_liste_zu_gross_wortlaut() {
    let l = Lage::neu();
    let k = fall_a(&l, |_| {});
    let pfad = l.git_skript("case \"$*\" in *diff-tree*--raw*) while :; do printf ':000000 100644 0000000000000000000000000000000000000000 1111111111111111111111111111111111111111 A\\0%01000d\\0' 0; done;; esac");
    let lauf = l.starten_mit(&[&k], &[("PATH", &pfad)]);
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k}&datei=gesucht%2Fdatei.txt")).await;
    assert_eq!(s, 404, "{t}");
    let fehler = serde_json::from_str::<Value>(&t).unwrap()["fehler"].as_str().unwrap().to_string();
    assert_eq!(fehler, format!("Diese Datei lässt sich hier nicht einzeln laden: Die Dateiliste des Commits ist zu groß. Lokal lesbar mit `git show {k} -- ` und dem Pfad der Datei."));
    assert!(!fehler.contains("gesucht") && !fehler.contains("MB"), "{fehler}");
}

/// AK 10: streng (500) nur im Lauf ohne Pfadangabe gegen die vollständige Liste. Ein Git-Skript lässt im Patch-Lauf das
/// Stück von `b.txt` weg. K1 (nur `a.txt`, `b.txt`: Lauf ohne Angabe) → 500 „hat 0 von 1 Stücken“; K2 (dazu `gross`:
/// Lauf mit Angabe) → 200, `b.txt` `nachladen` ohne Patch, `a.txt` mit Patch. Mutanten: m7 (Lauf mit Angabe wieder
/// streng) macht K2 rot, m8 (`nachladen` auch ohne Angabe) macht K1 rot.
#[tokio::test]
async fn ak10_streng_nur_ohne_pfadangabe() {
    let l = Lage::neu();
    let k1 = baeume(&l, &[("a.txt", "a\n"), ("b.txt", "b\n")], &[("a.txt", "a2\n"), ("b.txt", "b2\n")]);
    let gross = zeilen("g", 3001);
    let k2 = baeume(&l, &[("a.txt", "a\n"), ("b.txt", "b\n")], &[("a.txt", "a2\n"), ("b.txt", "b2\n"), ("gross", &gross)]);
    let ohne_b = "case \"$*\" in *diff-tree*--raw*|*diff-tree*--numstat*) ;; *diff-tree*) $echt \"$@\" | awk '/^diff --git /{weg = ($0 == \"diff --git a/b.txt b/b.txt\")} !weg'; exit 0;; esac";
    let pfad = l.git_skript(ohne_b);
    let lauf = l.starten_mit(&[&k1, &k2], &[("PATH", &pfad)]);
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k1}")).await;
    assert_eq!((s, t.contains("„b.txt“ (M) hat 0 von 1 Stücken")), (500, true), "{t}");
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k2}")).await;
    assert_eq!(s, 200, "{t}");
    let d: Value = serde_json::from_str(&t).unwrap();
    let datei = |n: &str| dateien(&d).iter().find(|f| name(f) == n).unwrap().clone();
    assert_eq!((datei("b.txt")["nachladen"].clone(), datei("b.txt")["patch"].clone()), (json!(true), Value::Null), "{d}");
    assert_eq!(datei("a.txt")["patch"], json!("@@ -1 +1 @@\n-a\n+a2\n"), "{d}");
    // `datei=b.txt`: die Abkürzung findet das Stück nicht, der Rückfall ohne Angabe gegen die vollständige Liste auch
    // nicht → streng 500 (N7.8)
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k1}&datei=b.txt")).await;
    assert_eq!((s, t.contains("„b.txt“ (M) hat 0 von 1 Stücken")), (500, true), "{t}");
}

/// AK 1 mit N7.8 (eigene Variante, Pre-Mortem N7 (f)): in Fall (a) trägt die abgeschlossene Angabe — `datei=d/x` liest
/// Dateiliste, Zähler und Patch je einmal, die beiden letzten mit Pfadangabe, ohne Rückfall. Mutant „Angabe nicht
/// abschließen“: Git paart neu, der Rückfall heilt die Antwort, doch die Läufe verraten ihn.
#[tokio::test]
async fn ak1_abgeschlossene_angabe_traegt_ohne_rueckfall() {
    let l = Lage::neu();
    let k = fall_a(&l, |_| {});
    assert_eq!(laeufe_fuer(&l, &k, "d/x").await, ["--raw --", "--numstat d/x/inner", "-p d/x/inner"], "Dateiliste ohne, Zähler und Patch mit Angabe (letzter Pfad sortiert)");
}

/// Die Läufe von `diff-tree`, die `datei=<name>` an K braucht: je Lauf seine Art und das letzte Argument (`--` ohne
/// Pfadangabe, sonst der letzte Pfad). Die Antwort muss 200 sein.
async fn laeufe_fuer(l: &Lage, k: &str, name: &str) -> Vec<String> {
    let spur = l.r.parent().unwrap().join("spur");
    let _ = std::fs::remove_file(&spur);
    let pfad = l.git_skript(&format!("case \"$*\" in *diff-tree*) eval letztes=\\${{$#}}; for a in --raw --numstat -p; do case \" $* \" in *\" $a \"*) echo \"$a $letztes\" >> {};; esac; done;; esac", spur.display()));
    let lauf = l.starten_mit(&[k], &[("PATH", &pfad)]);
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k}&datei={}", kodiert(name))).await;
    assert_eq!(s, 200, "{t}");
    std::fs::read_to_string(&spur).unwrap().lines().map(String::from).collect()
}

/// AK 8 (N7.8, eigene Variante): die Abkürzung mit Pfadangabe ist kein Beleg — liefert sie keine passenden Zähler bzw.
/// kein Stück (ein Git-Skript leert die Ausgabe jedes Laufs mit Pfadangabe), folgt der Rückfall ohne Angabe: `datei=`
/// auf jeden Namen von Fall (a) ergibt 200, bytegleich. Mutanten: Zähler bzw. Stück ohne Rückfall streng → 500.
#[tokio::test]
async fn ak8_rueckfall_wenn_die_abkuerzung_nichts_belegt() {
    for lauf_art in ["--numstat", "-p"] {
        let l = Lage::neu();
        let k = fall_a(&l, |_| {});
        let stuecke = l.stuecke(&k);
        let leer = format!("eval letztes=\\${{$#}}; case \"$*\" in *diff-tree*{lauf_art}*) if [ \"$letztes\" != \"--\" ]; then exit 0; fi;; esac");
        let pfad = l.git_skript(&leer);
        let lauf = l.starten_mit(&[&k], &[("PATH", &pfad)]);
        let liste = liste_pruefen(&lauf.adresse, &k, &stuecke).await;
        datei_auf_jeden_namen(&lauf.adresse, &k, &liste, &stuecke).await;
    }
}
