// R00255 (I0245, Karte #236): Gesamt-Diff — `datei=` bei sehr großen Kartencommits. Akzeptanztests gegen das echte
// Programm und ein echtes Arbeits-Repository (Ausgangslage von R00255: Fälle kfk, kk, d45). Schichten: Testfall (je AK)
// → Testsprache (`Lage`, `liste`, `datei`) → Treiber (`holen`: URL, Status) → Programm.
//
// Die großen Fälle (17.000 lange Pfade für AK 1–3, 45.000 kurze für AK 4–5) laufen als Tagprobe ausdrücklich:
// `cargo test --test akzeptanz_r00255 -- --ignored --nocapture` (ruhige Maschine, Last unter 2).
mod gemeinsam;

use gemeinsam::{git, git_am, starten_mit, Laufendes};
use serde_json::{Value, json};
use std::cell::{Cell, RefCell};
use std::path::PathBuf;
use std::time::Instant;

// ---- Treiber ----------------------------------------------------------------------------------------------------------

/// Eine Antwort, wie sie über die Leitung kam.
struct Antwort {
    status: u16,
    text: String,
}

impl Antwort {
    fn json(&self) -> Value {
        serde_json::from_str(&self.text).unwrap_or(Value::Null)
    }
}

/// `GET /api/aufgaben/{nr}/diff?{abfrage}`.
async fn holen(adresse: &str, nr: u32, abfrage: &str) -> Antwort {
    let r = reqwest::Client::new().get(format!("{adresse}api/aufgaben/{nr}/diff?{abfrage}")).send().await.unwrap();
    let status = r.status().as_u16();
    let bytes = r.bytes().await.unwrap();
    Antwort { status, text: String::from_utf8(bytes.to_vec()).expect("gültiges UTF-8") }
}

/// Prozentkodiert wie ein Agent es tut.
fn kodiert(text: &str) -> String {
    text.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-._~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect()
}

/// Ein Pfad von 122 Byte (`g/<nr>-xxx…x.txt`): 9.000 davon liegen über der 1-MB-Pfadangabe `D_karte`.
fn langer_pfad(i: usize) -> String {
    format!("g/{i:05}-{}.txt", "x".repeat(110))
}

// ---- Testsprache: Ausgangslage ----------------------------------------------------------------------------------------

/// Ausgangslage von R00255: Arbeits-Repository R (Anwendung `kd`), Karten mit ihren Commit-Verweisen.
struct Lage {
    _tmp: tempfile::TempDir,
    r: PathBuf,
    board: PathBuf,
    takt: Cell<u32>,
    karten: RefCell<Vec<(u32, Vec<String>)>>,
}

impl Lage {
    fn neu() -> Lage {
        let tmp = tempfile::tempdir().unwrap();
        let basis = tmp.path().canonicalize().unwrap();
        let (r, board) = (basis.join("R"), basis.join("board"));
        std::fs::create_dir_all(r.join("Dokumentation/Planung")).unwrap();
        std::fs::write(r.join("Dokumentation/Planung/app.md"), "# App\n").unwrap();
        std::fs::create_dir_all(board.join("aufgaben")).unwrap();
        std::fs::create_dir_all(board.join("boards")).unwrap();
        std::fs::write(board.join("kanbanD.md"), format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\n  entw1: {{name: Entwickler, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Dokumentation/Planung/app.md, requirements: \"\"}}\n---\n", r.display())).unwrap();
        git(&board, &["init", "-q"]);
        let l = Lage { _tmp: tmp, r, board, takt: Cell::new(0), karten: Default::default() };
        l.git(&["init", "-q", "-b", "main"]);
        l
    }

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
        let p = self.r.join(datei);
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(p, inhalt).unwrap();
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

    fn starten(&self) -> Laufendes {
        starten_mit(&self.board, &["--port", "0", "--host", "127.0.0.1"], &[])
    }
}

fn kd(h: &str) -> String {
    format!("kd:{h}")
}

/// Fall kk (AK 3): `anzahl` lange Pfade in einem Kartencommit, kein fremder Commit. Karte #1.
fn lage_kk(anzahl: usize) -> (Lage, String) {
    let l = Lage::neu();
    l.schreiben("a.txt", "a\n");
    l.commit("A0");
    for i in 0..anzahl {
        l.schreiben(&langer_pfad(i), "z\n");
    }
    let k1 = l.commit("K1");
    l.karte(1, &[kd(&k1)]);
    (l, k1)
}

/// Fall kfk (AK 1, 2): `anzahl` lange Pfade in K1, fremder Commit F ändert `a.txt`, K2 legt `k2.txt` an. Karte #2.
fn lage_kfk(anzahl: usize) -> (Lage, String, String) {
    let l = Lage::neu();
    l.schreiben("a.txt", "a\n");
    l.commit("A0");
    for i in 0..anzahl {
        l.schreiben(&langer_pfad(i), "z\n");
    }
    let k1 = l.commit("K1");
    l.schreiben("a.txt", "a\nFREMD\n");
    l.commit("F");
    l.schreiben("k2.txt", "k2\n");
    let k2 = l.commit("K2");
    l.karte(2, &[kd(&k1), kd(&k2)]);
    (l, k1, k2)
}

// ---- Testsprache: Proben ----------------------------------------------------------------------------------------------

fn dateien(d: &Value) -> &Vec<Value> {
    d["dateien"].as_array().unwrap_or_else(|| panic!("keine dateien: {d}"))
}

/// Der Eintrag mit diesem Namen (netto `neu`, bei gelöschten `alt`; Folge `pfad`).
fn eintrag<'a>(d: &'a Value, name: &str) -> &'a Value {
    dateien(d).iter().find(|f| f["pfad"] == name || f["neu"] == name || (f["neu"].is_null() && f["pfad"].is_null() && f["alt"] == name)).unwrap_or_else(|| panic!("{name} fehlt: {d}"))
}

fn ist_folge(f: &Value) -> bool {
    f["schritte"].is_array()
}

/// Der Hinweis `dateien_gekappt` der Antwort (flacher Hinweis, nicht Feld).
fn kappe(d: &Value) -> Value {
    d["hinweise"].as_array().unwrap_or_else(|| panic!("keine hinweise: {d}")).iter().find(|h| h["art"] == "dateien_gekappt").cloned().unwrap_or_else(|| panic!("kein dateien_gekappt: {d}"))
}

/// Die Liste des Gesamt-Diffs einer Karte mit Status 200.
async fn liste(adresse: &str, nr: u32, abfrage: &str) -> Value {
    let a = holen(adresse, nr, abfrage).await;
    assert_eq!(a.status, 200, "#{nr}?{abfrage}: {}", a.text);
    a.json()
}

/// `datei=` mit Status 200 und dem erwarteten Eintrag.
async fn datei(adresse: &str, nr: u32, pfad: &str) -> Value {
    let a = holen(adresse, nr, &format!("datei={}", kodiert(pfad))).await;
    assert_eq!(a.status, 200, "#{nr}?datei={pfad}: {}", a.text);
    a.json()
}

/// `datei=` mit Status 404 und dem Text.
async fn datei_404(adresse: &str, nr: u32, pfad: &str) -> String {
    let a = holen(adresse, nr, &format!("datei={}", kodiert(pfad))).await;
    assert_eq!(a.status, 404, "#{nr}?datei={pfad}: {}", a.text);
    a.text
}

fn last() -> String {
    std::fs::read_to_string("/proc/loadavg").unwrap_or_default().split(' ').next().unwrap_or_default().to_string()
}

// ---- AK 1, 2: Folge-Liste mit `datei=` hinter dem Schnitt (Fall kfk) · US-1 -------------------------------------------

#[tokio::test]
async fn ak01_folge_liste_mit_datei_hinter_dem_schnitt() {
    let (l, _k1, k2) = lage_kfk(9_000);
    let lauf = l.starten();
    let letzter = langer_pfad(8_999);
    let erster = langer_pfad(0);

    // AK 2: die Liste ohne `datei=` bleibt unverändert — ganz als Folge mit fremd_zu_gross, leere dateien, Kappe
    let d = liste(&lauf.adresse, 2, "").await;
    assert_eq!(d["hinweise"][0], json!({"art": "ganz_als_folge", "grund": "fremd_zu_gross"}), "{d}");
    assert_eq!(d["dateien"], json!([]), "{d}");
    assert_eq!(kappe(&d), json!({"art": "dateien_gekappt", "gezeigt": 0, "gesamt": 9_001}), "Kartenpfade K1 + k2.txt: {d}");

    // AK 1: k2.txt (Schritt K2, hinter dem Schnitt der Folge-Liste) → 200 mit Folge-Eintrag
    let e = datei(&lauf.adresse, 2, "k2.txt").await;
    let f = eintrag(&e, "k2.txt");
    assert!(ist_folge(f), "Folge-Eintrag erwartet: {f}");
    let schritte = f["schritte"].as_array().unwrap();
    assert_eq!(schritte.len(), 1, "{f}");
    assert_eq!((schritte[0]["commit"].as_str(), schritte[0]["status"].as_str()), (Some(kd(&k2).as_str()), Some("A")), "{f}");
    assert!(schritte[0]["patch"].as_str().is_some_and(|p| p.contains("+k2")), "{f}");

    // AK 1: ein Pfad aus K1, vor und hinter dem Schnitt der Liste
    for p in [&erster, &letzter] {
        let e = datei(&lauf.adresse, 2, p).await;
        let f = eintrag(&e, p);
        assert!(ist_folge(f) && f["schritte"].as_array().unwrap().len() == 1, "{p}: {f}");
    }

    // AK 1/2: a.txt steht nur im fremden Commit → 404 „in keinem Kartencommit“
    let t = datei_404(&lauf.adresse, 2, "a.txt").await;
    assert!(t.contains("in keinem Kartencommit"), "{t}");
}

// ---- AK 3: Pfadangabe nur mit fremden Pfaden (Fall kk) · US-2 ----------------------------------------------------------

#[tokio::test]
async fn ak03_pfadangabe_nur_mit_fremden_pfaden() {
    let (l, _k1) = lage_kk(9_000);
    let lauf = l.starten();
    let letzter = langer_pfad(8_999);

    // ohne fremden Pfad: netto, 2.000 gezeigte von 9.000, kein ganz_als_folge
    let d = liste(&lauf.adresse, 1, "").await;
    assert_eq!(d["hinweise"], json!([]), "kein ganz_als_folge: {d}");
    assert!(!d["spanne"].is_null(), "{d}");
    assert_eq!(kappe(&d), json!({"art": "dateien_gekappt", "gezeigt": 2_000, "gesamt": 9_000}), "{d}");
    assert!(dateien(&d).iter().all(|f| !ist_folge(f)), "nur Netto-Einträge: {d}");

    // der letzte Pfad liegt hinter dem Schnitt der Liste → 200 mit Netto-Eintrag `A`
    let e = datei(&lauf.adresse, 1, &letzter).await;
    let f = eintrag(&e, &letzter);
    assert_eq!(f["status"], json!("A"), "{f}");
    assert!(!ist_folge(f), "netto: {f}");
}

// ---- AK 4, 5: Tagprobe — 17.000 lange Pfade und 45.000 kurze (d45) ---------------------------------------------------

#[tokio::test]
#[ignore = "Tagprobe: 17.000 bzw. 45.000 Pfade im echten Programm — ruhige Maschine (Last unter 2), 8–21 Uhr"]
async fn tagprobe_kfk_17000_und_d45_45000() {
    let t0 = Instant::now();
    // Fall kfk mit 17.000 langen Pfaden (AK 1–3 im echten Programm, Probe P1/P3 der Karte #230)
    let (l, _k1, _k2) = lage_kfk(17_000);
    let lauf = l.starten();
    let letzter = langer_pfad(16_999);
    let (d, t) = (liste(&lauf.adresse, 2, "").await, Instant::now());
    eprintln!("Tagprobe kfk Liste: {} — {} s, Last {}", d["hinweise"], t.duration_since(t0).as_secs_f64(), last());
    let e = datei(&lauf.adresse, 2, "k2.txt").await;
    eprintln!("Tagprobe kfk datei=k2.txt: Folge {}, {} s", ist_folge(eintrag(&e, "k2.txt")), t.elapsed().as_secs_f64());
    let e = datei(&lauf.adresse, 2, &letzter).await;
    eprintln!("Tagprobe kfk datei=<letzter K1-Pfad>: Schritt {}, {} s", eintrag(&e, &letzter)["schritte"].as_array().unwrap().len(), t.elapsed().as_secs_f64());
    let a = datei_404(&lauf.adresse, 2, "a.txt").await;
    assert!(a.contains("in keinem Kartencommit"), "{a}");
    drop(lauf);

    // Fall kk mit 17.000 langen Pfaden (Probe P3)
    let (l, _k1) = lage_kk(17_000);
    let lauf = l.starten();
    let t1 = Instant::now();
    let d = liste(&lauf.adresse, 1, "").await;
    eprintln!("Tagprobe kk Liste: dateien_gekappt {}, hinweise {} — {} s, Last {}", kappe(&d), d["hinweise"], t1.elapsed().as_secs_f64(), last());
    assert_eq!(kappe(&d), json!({"art": "dateien_gekappt", "gezeigt": 2_000, "gesamt": 17_000}), "{d}");
    let letzter = langer_pfad(16_999);
    let e = datei(&lauf.adresse, 1, &letzter).await;
    assert_eq!(eintrag(&e, &letzter)["status"], json!("A"), "{e}");
    eprintln!("Tagprobe kk datei=<letzter Pfad>: netto A, {} s, Last {}", t1.elapsed().as_secs_f64(), last());
    drop(lauf);

    // Fall d45 (AK 4, 5): 45.000 kurze Pfade — Namenslauf über 4 MB
    let l = Lage::neu();
    l.schreiben("a.txt", "a\n");
    l.commit("A0");
    for i in 0..45_000 {
        l.schreiben(&format!("d/{i:06}"), "z\n");
    }
    let k1 = l.commit("K1");
    l.karte(1, &[kd(&k1)]);
    let lauf = l.starten();
    let t2 = Instant::now();
    let e = datei(&lauf.adresse, 1, "d/044999").await;
    let f = eintrag(&e, "d/044999");
    eprintln!("Tagprobe d45 datei=d/044999: {} — {} s, Last {}", f["status"], t2.elapsed().as_secs_f64(), last());
    assert_eq!(f["status"], json!("A"), "{f}");
    let t3 = Instant::now();
    let t = datei_404(&lauf.adresse, 1, "nicht/da").await;
    assert!(!t.contains("in keinem Kartencommit") && t.contains("commit="), "{t}");
    eprintln!("Tagprobe d45 datei=nicht/da: hinter dem Schnitt, {} s, Last {}", t3.elapsed().as_secs_f64(), last());
    eprintln!("Tagprobe gesamt: {} s, Last {}", t0.elapsed().as_secs_f64(), last());
}
