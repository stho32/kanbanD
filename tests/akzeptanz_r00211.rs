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
        std::fs::write(self.board.join("aufgaben/0001-k.md"), format!("---\nid: 1\ntitle: Karte 1\ncommits:\n  - \"kd:{k}\"\n---\n")).unwrap();
        std::fs::write(self.board.join("boards/fabrik.md"), "# fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-k.md)\n").unwrap();
        git(&self.board, &["add", "-A"]);
        git(&self.board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Karte"]);
        starten_mit(&self.board, &["--port", "0", "--host", "127.0.0.1"], &[])
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

/// Eigene Variante zu AK 3 (ADR-0032 N7.2 „die Grenze von 1 MB für die Pfadangabe gilt für die abgeschlossene Angabe“,
/// N5.5 S1 ARG_MAX): Fall (a) mit so vielen Dateien unter `d/x/`, dass die gegen die Liste abgeschlossene Angabe von
/// `datei=d/x` über 1 MB läge → 404 „Dateiliste zu groß“, nie 500; die Liste bleibt 200.
#[tokio::test]
async fn ak3_abgeschlossene_angabe_ueber_1_mb() {
    let l = Lage::neu();
    let fuell = "f".repeat(195);
    let k = fall_a(&l, |l| {
        for i in 0..5300 {
            l.schreiben(&format!("d/x/a{i:04}{fuell}"), &format!("a{i}\n"));
        }
    });
    let lauf = l.starten(&k);
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k}&datei=d/x")).await;
    assert_eq!(s, 404, "{t}");
    assert!(t.contains("Dateiliste zu groß"), "{t}");
    let (s, t) = holen(&lauf.adresse, &format!("commit=kd:{k}")).await;
    assert_eq!(s, 200, "{t}");
}
