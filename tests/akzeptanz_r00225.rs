// R00225 (I0215, Karte #234): Gesamt-Diff — Folge und „fremde Commits“ nur mit fremdem Commit (ADR-0032 N8). Akzeptanztests
// gegen das echte Programm und ein echtes Arbeits-Repository, Ausgangslage aus R00225 „Akzeptanzkriterien“ (Fälle N, N+F, F,
// M). Schichten: Testfall (je AK) → Testsprache (`Lage`, `fall_*`, `gesamt`, `kein_fremd_dazwischen_mit_null`) → Treiber
// (`holen`: URL, Status) → Programm.
mod gemeinsam;

use gemeinsam::{Laufendes, git, git_am, starten_mit};
use serde_json::{Value, json};
use std::cell::Cell;
use std::path::PathBuf;

// ---- Treiber ----------------------------------------------------------------------------------------------------------

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
    let r = reqwest::get(format!("{adresse}api/aufgaben/{nr}/diff?{abfrage}")).await.unwrap();
    let status = r.status().as_u16();
    Antwort { status, text: r.text().await.unwrap() }
}

fn kodiert(text: &str) -> String {
    text.bytes().map(|b| if b.is_ascii_alphanumeric() || b"-._~".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect()
}

// ---- Testsprache: Ausgangslage ----------------------------------------------------------------------------------------

/// Arbeits-Repository R (Anwendung `kd`, Standardanwendung) und Board-Ordner mit Karten, die Commits von R tragen.
struct Lage {
    _tmp: tempfile::TempDir,
    r: PathBuf,
    board: PathBuf,
    takt: Cell<u32>,
}

/// Zehn Zeilen, die Git als denselben Inhalt einer Umbenennung erkennt.
const X: &str = "x0\nx1\nx2\nx3\nx4\nx5\nx6\nx7\nx8\nx9\n";

fn zeilen(prefix: &str, n: usize) -> String {
    (1..=n).map(|i| format!("{prefix}{i}\n")).collect()
}

impl Lage {
    fn neu() -> Lage {
        let tmp = tempfile::tempdir().unwrap();
        let basis = tmp.path().canonicalize().unwrap();
        let (r, board) = (basis.join("R"), basis.join("board"));
        std::fs::create_dir_all(r.join("Dokumentation/Planung")).unwrap();
        std::fs::write(r.join("Dokumentation/Planung/app.md"), "# App\n").unwrap();
        let l = Lage { _tmp: tmp, r, board, takt: Cell::new(0) };
        l.git(&["init", "-q", "-b", "main"]);
        std::fs::create_dir_all(l.board.join("aufgaben")).unwrap();
        std::fs::create_dir_all(l.board.join("boards")).unwrap();
        std::fs::write(l.board.join("kanbanD.md"), format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Dokumentation/Planung/app.md, requirements: \"\"}}\n---\n", l.r.display())).unwrap();
        git(&l.board, &["init", "-q"]);
        l
    }

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

    fn loeschen(&self, pfad: &str) {
        let p = self.r.join(pfad);
        if p.is_dir() { std::fs::remove_dir_all(p) } else { std::fs::remove_file(p) }.unwrap();
    }

    /// Ersetzt Zeile `nr` (ab 1) von `datei`.
    fn zeile(&self, datei: &str, nr: usize, text: &str) {
        let alt = std::fs::read_to_string(self.r.join(datei)).unwrap();
        let neu: String = alt.lines().enumerate().map(|(i, z)| if i + 1 == nr { format!("{text}\n") } else { format!("{z}\n") }).collect();
        self.schreiben(datei, &neu);
    }

    fn commit(&self, nachricht: &str) -> String {
        let d = self.datum();
        git_am(&self.r, "Ada", &d, &["add", "-A"]);
        git_am(&self.r, "Ada", &d, &["commit", "-q", "--allow-empty", "-m", nachricht]);
        git_am(&self.r, "Ada", &d, &["rev-parse", "HEAD"])
    }

    /// Legt die einzige Karte `nr` mit diesen Commits an.
    fn karte(&self, nr: u32, commits: &[&str]) {
        let liste: String = commits.iter().map(|h| format!("  - \"kd:{h}\"\n")).collect();
        std::fs::write(self.board.join(format!("aufgaben/{nr:04}-k.md")), format!("---\nid: {nr}\ntitle: Karte {nr}\ncommits:\n{liste}---\n")).unwrap();
        std::fs::write(self.board.join("boards/fabrik.md"), format!("# fabrik\n\n## Entwicklung\n\n- [#{nr}](../aufgaben/{nr:04}-k.md)\n")).unwrap();
        git(&self.board, &["add", "-A"]);
        git(&self.board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Karte"]);
    }

    fn starten(&self) -> Laufendes {
        starten_mit(&self.board, &["--port", "0", "--host", "127.0.0.1"], &[])
    }
}

/// Die Kartencommits eines Falls und der fremde Commit (falls einer dazwischen liegt).
struct Fall {
    k1: String,
    k2: String,
}

const NR: u32 = 2;

/// A0 mit `b`, `d/x`, `g`; K1 löscht `b` und die Datei `d/x`, legt `d/x/inner` mit dem Inhalt von `b` an und ändert Zeile 2
/// von `g`; mit `fremd` ändert F danach Zeile 7 von `g` auf `FREMD-g`; K2 benennt `d/x/inner` in `bb` um und legt `d/x` wie
/// in A0 an. Fall N ohne, Fall N+F mit fremdem Commit.
fn fall_n(l: &Lage, fremd: bool) -> Fall {
    l.schreiben("b", X);
    l.schreiben("d/x", &format!("{X}y\n"));
    l.schreiben("g", &zeilen("g", 12));
    l.commit("A0");
    l.loeschen("b");
    l.loeschen("d/x");
    l.schreiben("d/x/inner", X);
    l.zeile("g", 2, "K1-g");
    let k1 = l.commit("K1 Datei wird Verzeichnis");
    if fremd {
        l.zeile("g", 7, "FREMD-g");
        l.commit("F fremd");
    }
    l.loeschen("d/x");
    l.schreiben("bb", X);
    l.schreiben("d/x", &format!("{X}y\n"));
    let k2 = l.commit("K2 Verzeichnis wird Datei");
    l.karte(NR, &[&k1, &k2]);
    Fall { k1, k2 }
}

/// Fall F (R00208 #2): A0 `a.txt` z1…z12; K1 Zeile 2 und `k.txt`; F (fremd) Zeile 6 `FREMD-6` und `f.txt`; K2 Zeile 11 und
/// `k.txt` um eine Zeile länger.
fn fall_f(l: &Lage) -> Fall {
    l.schreiben("a.txt", &zeilen("z", 12));
    l.commit("A0");
    l.zeile("a.txt", 2, "K1");
    l.schreiben("k.txt", "k1\nk2\n");
    let k1 = l.commit("K1");
    l.zeile("a.txt", 6, "FREMD-6");
    l.schreiben("f.txt", "FREMD-f\n");
    l.commit("F");
    l.zeile("a.txt", 11, "K2");
    l.schreiben("k.txt", "k1\nk2\nk3\n");
    let k2 = l.commit("K2");
    l.karte(NR, &[&k1, &k2]);
    Fall { k1, k2 }
}

/// Fall M: N1 ändert Zeile 2 von `n.txt`; ein Seitenzweig ändert Zeile 8 auf `FREMD-8` und wird mit `--no-ff` gemergt (MK);
/// N2 ändert Zeile 11. Die Karte trägt N1, MK, N2. Liefert (N1, MK, N2).
fn fall_m(l: &Lage) -> (String, String, String) {
    l.schreiben("n.txt", &zeilen("n", 12));
    l.commit("A0");
    l.zeile("n.txt", 2, "N1");
    let n1 = l.commit("N1");
    l.git(&["checkout", "-q", "-b", "seite"]);
    l.zeile("n.txt", 8, "FREMD-8");
    l.commit("seite: n.txt");
    l.git(&["checkout", "-q", "main"]);
    l.git(&["merge", "-q", "--no-ff", "-m", "MK Merge seite", "seite"]);
    let mk = l.git(&["rev-parse", "HEAD"]);
    l.zeile("n.txt", 11, "N2");
    let n2 = l.commit("N2");
    l.karte(NR, &[&n1, &mk, &n2]);
    (n1, mk, n2)
}

// ---- Testsprache: Proben ----------------------------------------------------------------------------------------------

fn dateien(d: &Value) -> &Vec<Value> {
    d["dateien"].as_array().unwrap_or_else(|| panic!("keine dateien: {d}"))
}

fn namen(d: &Value) -> Vec<String> {
    dateien(d).iter().map(|f| f["pfad"].as_str().or(f["neu"].as_str()).or(f["alt"].as_str()).unwrap().to_string()).collect()
}

fn eintrag<'a>(d: &'a Value, name: &str) -> &'a Value {
    dateien(d).iter().find(|f| f["pfad"] == name || f["neu"] == name).unwrap_or_else(|| panic!("{name} fehlt: {d}"))
}

fn ist_folge(f: &Value) -> bool {
    f["schritte"].is_array()
}

fn schritte(f: &Value) -> Vec<String> {
    assert!(ist_folge(f), "kein Folge-Eintrag: {f}");
    f["schritte"].as_array().unwrap().iter().map(|s| s["commit"].as_str().unwrap().to_string()).collect()
}

fn hinweis<'a>(d: &'a Value, art: &str) -> Option<&'a Value> {
    d["hinweise"].as_array().unwrap().iter().find(|h| h["art"] == art)
}

/// Probe „nie fremd“ (R00208): keine `+`/`-`-Zeile mit `FREMD` im JSON und im `format=patch`-Text.
fn nie_fremd(d: &Value, text: &str) {
    let fremd = |p: &str| p.lines().filter(|z| (z.starts_with('+') || z.starts_with('-')) && z.contains("FREMD")).count();
    for f in dateien(d) {
        let patches: Vec<&str> = if ist_folge(f) { f["schritte"].as_array().unwrap().iter().filter_map(|s| s["patch"].as_str()).collect() } else { f["patch"].as_str().into_iter().collect() };
        assert_eq!(patches.iter().map(|p| fremd(p)).sum::<usize>(), 0, "fremde Zeile im patch von {f}");
    }
    assert_eq!(fremd(text), 0, "fremde Zeile im format=patch-Text: {text}");
}

/// Kein Hinweis `fremd_dazwischen` mit `commits` 0, weder im JSON noch im `format=patch`-Text (R00225 AK 3).
fn kein_fremd_dazwischen_mit_null(d: &Value, text: &str) {
    assert!(hinweis(d, "fremd_dazwischen").is_none_or(|h| h["commits"].as_u64() >= Some(1)), "fremd_dazwischen mit 0 Commits: {}", d["hinweise"]);
    assert!(!text.lines().any(|z| z.starts_with("# kanbanD: fremd_dazwischen") && z.contains("commits=0")), "{text}");
}

/// JSON und `format=patch`-Text mit Status 200, Proben „nie fremd“ und „kein fremd_dazwischen mit 0“.
async fn gesamt(adresse: &str, abfrage: &str) -> (Value, String) {
    let a = holen(adresse, NR, abfrage).await;
    assert_eq!(a.status, 200, "?{abfrage}: {}", a.text);
    let trenner = if abfrage.is_empty() { "" } else { "&" };
    let t = holen(adresse, NR, &format!("{abfrage}{trenner}format=patch")).await;
    assert_eq!(t.status, 200, "?{abfrage} format=patch: {}", t.text);
    let d = a.json();
    nie_fremd(&d, &t.text);
    kein_fremd_dazwischen_mit_null(&d, &t.text);
    (d, t.text)
}

/// Der 404-Text für einen Pfad aus Kartencommits ohne Eintrag im Gesamtbild (PO Z. 509).
fn ohne_aenderung(nr: u32) -> String {
    format!("die Datei steht in Kartencommits von #{nr}, hat im Gesamtbild aber keine Änderung (die Aufgabe nimmt sie selbst zurück oder benennt sie weiter) — die Schritte mit commit= und datei= laden")
}

/// `datei=<pfad>` ergibt 404 mit `{fehler}` im Wortlaut für „steht in Kartencommits, hat aber keine Änderung“.
async fn datei_ohne_aenderung(adresse: &str, pfad: &str) {
    let a = holen(adresse, NR, &format!("datei={}", kodiert(pfad))).await;
    assert_eq!(a.status, 404, "datei={pfad}: {}", a.text);
    assert_eq!(a.json(), json!({"fehler": ohne_aenderung(NR)}), "datei={pfad}");
}

fn kommt_nicht_vor(d: &Value, text: &str, pfad: &str) {
    assert!(!namen(d).iter().any(|n| n == pfad || n.starts_with(&format!("{pfad}/"))), "{pfad} steht in dateien: {:?}", namen(d));
    assert!(!dateien(d).iter().any(|f| f.to_string().contains(pfad)), "{pfad} steht in einem Eintrag: {d}");
    assert!(!text.lines().any(|z| z.contains(pfad)), "{pfad} steht im format=patch-Text: {text}");
}

// ---- AK 1: Fall N über die API · US-2 ----------------------------------------------------------------------------------

// Abnahme-Probe N8.4 (wörtlich): kein Eintrag d/x (auch nicht d/x/inner), genau bb und g netto, kein fremd_dazwischen; im
// format=patch keine Zeile mit d/x und keine `# kanbanD: fremd_dazwischen`; datei=d/x → 404 {fehler}. Mutant m1 macht ihn rot.
#[tokio::test]
async fn ak01_fall_n_netto_unveraendert_erscheint_nirgends() {
    let l = Lage::neu();
    fall_n(&l, false);
    let lauf = l.starten();
    let (d, text) = gesamt(&lauf.adresse, "").await;
    assert_eq!(namen(&d), ["bb", "g"], "{d}");
    assert!(dateien(&d).iter().all(|f| !ist_folge(f)), "beide netto: {d}");
    assert_eq!((&eintrag(&d, "bb")["status"], &eintrag(&d, "bb")["alt"]), (&json!("R"), &json!("b")));
    assert_eq!(d["hinweise"], json!([]), "kein fremd_dazwischen");
    kommt_nicht_vor(&d, &text, "d/x");
    assert!(!text.contains("# kanbanD: fremd_dazwischen"), "{text}");
    datei_ohne_aenderung(&lauf.adresse, "d/x").await;
    datei_ohne_aenderung(&lauf.adresse, "d/x/inner").await;
}

// ---- AK 2: Fall N+F über die API · US-3 --------------------------------------------------------------------------------

#[tokio::test]
async fn ak02_fall_n_und_f_nur_g_ist_folge() {
    let l = Lage::neu();
    let f = fall_n(&l, true);
    let lauf = l.starten();
    let (d, text) = gesamt(&lauf.adresse, "").await;
    assert_eq!(namen(&d), ["bb", "g"], "{d}");
    assert!(!ist_folge(eintrag(&d, "bb")), "bb netto: {d}");
    assert_eq!(schritte(eintrag(&d, "g")), [format!("kd:{}", f.k1)], "g Folge mit dem Schritt K1");
    assert_eq!(d["hinweise"], json!([{"art": "fremd_dazwischen", "commits": 1, "dateien": 1}]));
    kommt_nicht_vor(&d, &text, "d/x");
    datei_ohne_aenderung(&lauf.adresse, "d/x").await;
    let (g, _) = gesamt(&lauf.adresse, "datei=g").await;
    assert_eq!(namen(&g), ["g"]);
    assert_eq!(schritte(&dateien(&g)[0]), [format!("kd:{}", f.k1)]);
    let _ = f.k2;
}

// ---- AK 3: Fall M über die API · US-5 ----------------------------------------------------------------------------------

// Mutant m3 (fremd_dazwischen ohne `commits ≥ 1`) macht ihn rot
#[tokio::test]
async fn ak03_fall_m_nur_merge_der_karte_ohne_fremd_dazwischen() {
    let l = Lage::neu();
    let (n1, mk, n2) = fall_m(&l);
    let lauf = l.starten();
    let (d, text) = gesamt(&lauf.adresse, "").await;
    assert_eq!(namen(&d), ["n.txt"], "{d}");
    assert_eq!(schritte(eintrag(&d, "n.txt")), [format!("kd:{n1}"), format!("kd:{n2}")]);
    assert_eq!(d["hinweise"], json!([{"art": "merge_ausgelassen", "verweis": format!("kd:{mk}")}]), "kein fremd_dazwischen");
    assert!(!text.contains("fremd_dazwischen"), "{text}");
    let (e, _) = gesamt(&lauf.adresse, "datei=n.txt").await;
    assert!(hinweis(&e, "fremd_dazwischen").is_none(), "{e}");
}

// ---- AK 4: Fall F, Gegenprobe · US-4 -----------------------------------------------------------------------------------

#[tokio::test]
async fn ak04_fall_f_fremder_commit_an_derselben_datei_unveraendert() {
    let l = Lage::neu();
    let f = fall_f(&l);
    let lauf = l.starten();
    let (d, text) = gesamt(&lauf.adresse, "").await;
    assert_eq!(namen(&d), ["a.txt", "k.txt"], "{d}");
    assert_eq!(schritte(eintrag(&d, "a.txt")), [format!("kd:{}", f.k1), format!("kd:{}", f.k2)]);
    assert!(!ist_folge(eintrag(&d, "k.txt")), "k.txt netto: {d}");
    assert_eq!(d["hinweise"], json!([{"art": "fremd_dazwischen", "commits": 1, "dateien": 1}]));
    assert!(text.starts_with("# kanbanD: fremd_dazwischen commits=1 dateien=1\n"), "{text}");
}

// ---- AK 6: abgeschnittene Netto-Liste (N8.3 Punkt 2, Pre-Mortem j) -----------------------------------------------------

/// So viele neue Dateien, dass die Netto-Liste (`--raw`, über 100 Byte je Eintrag) über ihre Grenze von 1 MB kommt.
const VIELE: usize = 12_000;

// K1 legt 12.000 Dateien an und ändert a.txt, F (fremd) ändert eine andere Zeile von a.txt, K2 ändert a.txt: die Netto-Liste
// ist abgeschnitten. Unbelastete Pfade werden nicht Folge und verschwinden nicht ohne Zählung. Mutant m4 macht ihn rot.
#[tokio::test]
async fn ak06_abgeschnittene_netto_liste_unbelastete_netto_und_gezaehlt() {
    let l = Lage::neu();
    l.schreiben("a.txt", &zeilen("z", 12));
    l.commit("A0");
    std::fs::create_dir_all(l.r.join("v")).unwrap();
    for i in 0..VIELE {
        std::fs::write(l.r.join(format!("v/{i:05}.txt")), format!("{i}\n")).unwrap();
    }
    l.zeile("a.txt", 2, "K1");
    let k1 = l.commit("K1 viele");
    l.zeile("a.txt", 6, "FREMD-6");
    l.commit("F");
    l.zeile("a.txt", 11, "K2");
    let k2 = l.commit("K2");
    l.karte(NR, &[&k1, &k2]);
    let lauf = l.starten();
    let (d, _) = gesamt(&lauf.adresse, "").await;
    let folgen: Vec<&Value> = dateien(&d).iter().filter(|f| ist_folge(f)).collect();
    assert_eq!(folgen.iter().map(|f| f["pfad"].as_str().unwrap()).collect::<Vec<_>>(), ["a.txt"], "nur der belastete Pfad ist Folge");
    assert_eq!(hinweis(&d, "fremd_dazwischen"), Some(&json!({"art": "fremd_dazwischen", "commits": 1, "dateien": 1})));
    let kappe = hinweis(&d, "dateien_gekappt").unwrap_or_else(|| panic!("keine Kappe: {}", d["hinweise"]));
    assert_eq!(kappe["gezeigt"].as_u64(), Some(dateien(&d).len() as u64));
    assert!(kappe["gesamt"].as_u64().unwrap() > VIELE as u64, "gesamt zählt alle netto geänderten Dateien (a.txt und {VIELE} neue): {kappe}");
    assert!(dateien(&d).len() <= 2000);
    // D1 (ADR-0032 N8.6 Punkt 4 (a), Code-Review #234 Muss 2): mit datei= läuft die Netto-Liste bis 20 MB, ein Pfad hinter
    // dem Schnitt der Liste ist damit erreichbar wie vor der Karte; vor dem Schnitt unverändert. Mutant m7 macht ihn rot.
    for i in [VIELE - 1, 0] {
        let pfad = format!("v/{i:05}.txt");
        let (e, _) = gesamt(&lauf.adresse, &format!("datei={}", kodiert(&pfad))).await;
        assert_eq!(namen(&e), [pfad.clone()], "{e}");
        assert_eq!((&dateien(&e)[0]["status"], ist_folge(&dateien(&e)[0])), (&json!("A"), false), "{pfad} netto A: {e}");
    }
    // Gegenprobe (D2): ein Pfad in keinem Kartencommit behält „… in keinem Kartencommit …“
    let fehlt = holen(&lauf.adresse, NR, "datei=nicht/da.txt").await;
    assert_eq!((fehlt.status, fehlt.json()), (404, json!({"fehler": format!("die Datei steht in keinem Kartencommit von #{NR} — datei= nennt einen Pfad der Karte, buchstäblich")})));
}

// ---- AK 8: README „Für Agenten“ und Endpunktbeschreibung ---------------------------------------------------------------

#[tokio::test]
async fn ak08_readme_und_beschreibung_nennen_netto_unveraendert() {
    let readme = std::fs::read_to_string(std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("README.md")).unwrap();
    let abschnitt = readme.split("### Alle Änderungen der Karte lesen").nth(1).expect("README-Abschnitt").split("\n## ").next().unwrap();
    let satz = abschnitt.split("\n- ").find(|s| s.starts_with("**Netto unverändert**")).unwrap_or_else(|| panic!("kein Punkt „Netto unverändert“: {abschnitt}"));
    for wort in ["selbst wieder zurücknimmt", "erscheint nicht", "`datei=` auf sie ergibt 404", "`fremd_dazwischen` steht nur, wenn mindestens ein fremder Commit", "`commits` ≥ 1"] {
        assert!(satz.contains(wort), "README nennt „{wort}“: {satz}");
    }
    let datei = abschnitt.split("\n- ").find(|s| s.starts_with("`&datei=<pfad>`")).unwrap();
    assert!(datei.contains("in keinem Kartencommit") && datei.contains("keine Änderung"), "beide 404-Fälle: {datei}");
    // AK 8 Halbsatz zu N8.6 Punkt 4 (d), PO Z. 514: hinter dem Schnitt eigener Text mit Verweis auf commit= und datei=
    assert!(datei.contains("auch mit `datei=` zu groß, um zu sagen, ob er im Gesamtbild eine Änderung hat") && datei.contains("auf `commit=` und `datei=` verweist"), "Halbsatz zu (d): {datei}");
    let l = Lage::neu();
    fall_f(&l);
    let lauf = l.starten();
    let liste: Value = reqwest::get(format!("{}api/endpunkte", lauf.adresse)).await.unwrap().json().await.unwrap();
    let zweck = liste.as_array().unwrap().iter().find(|e| e["methode"] == "GET" && e["pfad"] == "/api/aufgaben/{nr}/diff").unwrap()["zweck"].as_str().unwrap().to_string();
    assert!(zweck.contains("netto unverändert") && zweck.contains("fremd_dazwischen nur mit commits ≥ 1"), "{zweck}");
}

// ---- AK 7 (m2): ein unbelasteter Pfad aus einem verworfenen Netto-Eintrag bleibt Folge -----------------------------------

// A0 `x` (zehn Zeilen); K0 legt `k.txt` an; F (fremd) ändert Zeile 1 von `x`; K1 löscht `x`; K2 legt `y` mit dem Inhalt von
// `x` aus A0 an. Die Kartenschritte verbinden `x` und `y` nicht, der Netto-Lauf paart sie aber als `R100 x → y`: der Eintrag
// ist verworfen (x belastet), und `y` steht nur in ihm. `y` muss Folge mit dem Schritt K2 sein, sonst verschwindet eine Datei,
// die die Karte angelegt hat (Mutant m2 „nur belastete Pfade“; `b2_rest_zwilling_ausserhalb_der_netto_eintraege` tötet ihn
// nicht, weil seine verworfenen Einträge nur belastete Pfade tragen).
#[tokio::test]
async fn ak07_unbelasteter_pfad_aus_verworfenem_netto_eintrag_bleibt_folge() {
    let l = Lage::neu();
    l.schreiben("x", X);
    l.commit("A0");
    l.schreiben("k.txt", "k1\n");
    let k0 = l.commit("K0");
    l.zeile("x", 1, "anders");
    l.commit("F fremd");
    l.loeschen("x");
    let k1 = l.commit("K1 x weg");
    l.schreiben("y", X);
    let k2 = l.commit("K2 y neu");
    l.karte(NR, &[&k0, &k1, &k2]);
    let a0 = l.git(&["rev-parse", &format!("{k0}~")]);
    assert!(l.git(&["diff", "-M50%", "--name-status", &a0, &k2]).lines().any(|z| z.starts_with('R') && z.ends_with("x\ty")), "Ausgangslage: Git paart x → y netto");
    let lauf = l.starten();
    let (d, _) = gesamt(&lauf.adresse, "").await;
    assert_eq!(namen(&d), ["k.txt", "x", "y"], "{d}");
    assert!(!ist_folge(eintrag(&d, "k.txt")));
    assert_eq!(schritte(eintrag(&d, "x")), [format!("kd:{k1}")]);
    assert_eq!(schritte(eintrag(&d, "y")), [format!("kd:{k2}")]);
    assert_eq!(eintrag(&d, "y")["schritte"][0]["status"], json!("A"));
    assert_eq!(d["hinweise"], json!([{"art": "fremd_dazwischen", "commits": 1, "dateien": 2}]));
    let (e, _) = gesamt(&lauf.adresse, "datei=y").await;
    assert_eq!(schritte(&dateien(&e)[0]), [format!("kd:{k2}")]);
}

// ---- AK 10: Gruppen (ADR-0032 N8.6, Code-Review #234 Muss 1) ----------------------------------------------------------

/// G1/G2: A0 legt `p` an (zehn Zeilen `x0`…`x9`); K1 `git mv p q`; F (fremd) legt `b` mit dem Inhalt von `p` an; K2 hängt an
/// `b` die Zeile `zusatz` an und löscht `q` (G1) oder schreibt `q` ganz neu mit `y0`…`y9` (G2). Prüft, dass Git netto
/// `R p → b` paart (der Eintrag ist verworfen, `b` ist belastet).
fn fall_g(l: &Lage, neu_schreiben: bool) -> Fall {
    l.schreiben("p", X);
    let a0 = l.commit("A0");
    l.git(&["mv", "p", "q"]);
    let k1 = l.commit("K1 p wird q");
    l.schreiben("b", X);
    l.commit("F fremd b");
    if neu_schreiben {
        l.schreiben("q", &(0..10).map(|i| format!("y{i}\n")).collect::<String>());
    } else {
        l.loeschen("q");
    }
    l.schreiben("b", &format!("{X}zusatz\n"));
    let k2 = l.commit("K2");
    l.karte(NR, &[&k1, &k2]);
    let netto = l.git(&["diff", "-M50%", "--name-status", &a0, &k2, "--", "p", "q", "b"]);
    assert!(netto.lines().any(|z| z.starts_with('R') && z.ends_with("p\tb")), "Ausgangslage: Git paart p → b netto: {netto}");
    Fall { k1, k2 }
}

/// Die Schritte eines Folge-Eintrags als (Commit, Status, alt, neu).
fn schritte_voll(f: &Value) -> Vec<(String, String, Value, Value)> {
    assert!(ist_folge(f), "kein Folge-Eintrag: {f}");
    f["schritte"].as_array().unwrap().iter().map(|s| (s["commit"].as_str().unwrap().to_string(), s["status"].as_str().unwrap().to_string(), s["alt"].clone(), s["neu"].clone())).collect()
}

/// Gemeinsame Erwartung von G1 und G2: `q` ist Folge mit K1 `R p → q` und dem zweiten Schritt, `b` Folge mit K2,
/// `fremd_dazwischen {commits 1, dateien 2}`, `datei=q` und `datei=b` liefern den Eintrag. `p` ist kein Name eines Eintrags
/// (eine Umbenennung steht beim neuen Pfad), `datei=p` ergibt deshalb 404 mit dem Text für „in Kartencommits, ohne Eintrag“.
async fn gruppe_ganz_folge(adresse: &str, f: &Fall, zweiter: (&str, Value)) {
    let (d, _) = gesamt(adresse, "").await;
    assert_eq!(namen(&d), ["b", "q"], "{d}");
    let k = |h: &str| format!("kd:{h}");
    assert_eq!(schritte_voll(eintrag(&d, "q")), [(k(&f.k1), "R".into(), json!("p"), json!("q")), (k(&f.k2), zweiter.0.into(), json!("q"), zweiter.1.clone())], "{d}");
    assert_eq!(schritte(eintrag(&d, "b")), [k(&f.k2)], "{d}");
    assert_eq!(d["hinweise"], json!([{"art": "fremd_dazwischen", "commits": 1, "dateien": 2}]));
    for name in ["q", "b"] {
        let (e, _) = gesamt(adresse, &format!("datei={name}")).await;
        assert_eq!(dateien(&e).iter().map(ohne_patch).collect::<Vec<_>>(), [ohne_patch(eintrag(&d, name))], "datei={name}: {e}");
    }
    datei_ohne_aenderung(adresse, "p").await;
}

/// Ein Eintrag ohne die Felder, die mit `datei=` anders ausfallen dürfen (größeres Budget).
fn ohne_patch(f: &Value) -> Value {
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
}

// G1 (Probe des Code-Reviews, wörtlich): K2 löscht q. Heute: nur b, dateien 1 — die Löschung von p verschwindet ohne Zählung.
// Mutant m5 („(b) je Pfad“) macht ihn rot.
#[tokio::test]
async fn ak10_g1_gruppenpartner_eines_verworfenen_pfads_ist_folge() {
    let l = Lage::neu();
    let f = fall_g(&l, false);
    let lauf = l.starten();
    gruppe_ganz_folge(&lauf.adresse, &f, ("D", Value::Null)).await;
}

// G2 (gespaltene Gruppe): K2 schreibt q ganz neu. Netto paart Git `R p → b` (verworfen) und `A q` (gedeckt): die Gruppe
// {p, q} ist verdorben, also ist auch `A q` nicht netto. Heute: q netto A, p nirgends. Mutant m6 (ohne Fixpunkt) macht ihn rot.
#[tokio::test]
async fn ak10_g2_gespaltene_gruppe_ganz_folge() {
    let l = Lage::neu();
    let f = fall_g(&l, true);
    let lauf = l.starten();
    gruppe_ganz_folge(&lauf.adresse, &f, ("M", json!("q"))).await;
}

// ---- ETag (Legacy-Review #234 Muss 1) -----------------------------------------------------------------------------------

/// Der `ETag` des Gesamt-Diffs nach der Formel vor der Karte #234 (FNV-1a über Verweise, Zweigspitzen, Anwendung, `datei`,
/// `format`, `GRENZEN_VERSION` 1) — nachgerechnet gegen das Programm vor der Karte (Fall N: JSON, patch, datei=d/x gleich).
fn etag_vorgaenger(verweise: &[String], spitzen: &str, datei: Option<&str>, format: &str) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    let mut teile: Vec<&[u8]> = vec![b"gesamt\0"];
    for v in verweise {
        teile.extend([v.as_bytes(), b"\0"]);
    }
    let version = 1u32.to_be_bytes();
    teile.extend([b"\x01".as_slice(), spitzen.as_bytes(), b"\0", b"kd", b"\0", datei.unwrap_or("\u{1}").as_bytes(), b"\0", format.as_bytes(), b"\0", &version]);
    for b in teile.iter().flat_map(|t| t.iter()) {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("\"gesamt-{h:016x}\"")
}

// Abnahme-Probe des Legacy-Reviews (wörtlich): Fall N mit den Varianten ohne Parameter, format=patch, datei=d/x und datei=bb —
// keine antwortet mit 304 auf den ETag des Vorgängers. Heute: 304 in allen vier.
#[tokio::test]
async fn etag_des_vorgaengers_ergibt_kein_304() {
    let l = Lage::neu();
    let f = fall_n(&l, false);
    let spitzen = git(&l.r, &["for-each-ref", "--format=%(objectname) %(refname)", "refs/heads", "refs/remotes"]);
    let verweise = [format!("kd:{}", f.k1), format!("kd:{}", f.k2)];
    let lauf = l.starten();
    let client = reqwest::Client::new();
    for (abfrage, datei, format, status) in [("", None, "json", 200), ("format=patch", None, "patch", 200), ("datei=d/x", Some("d/x"), "json", 404), ("datei=bb", Some("bb"), "json", 200)] {
        let alt = etag_vorgaenger(&verweise, &format!("{spitzen}\n"), datei, format);
        let a = client.get(format!("{}api/aufgaben/{NR}/diff?{abfrage}", lauf.adresse)).header("If-None-Match", &alt).send().await.unwrap();
        assert_eq!(a.status().as_u16(), status, "?{abfrage} mit dem ETag des Vorgängers {alt}");
        assert_ne!(a.headers().get("etag").and_then(|e| e.to_str().ok()), Some(alt.as_str()), "?{abfrage}");
    }
}
