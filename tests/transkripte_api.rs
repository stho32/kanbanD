// R00216 (I0206, ADR-0036): Transkripte über die API ablegen, auflisten, herunterladen, löschen — gegen das echte Programm
// in einem Wegwerf-Board-Ordner mit Git. Ausgangslage wie in der Anforderung: Boards „fabrik“ und „zweit“, #1 in
// fabrik/Entwicklung, #2 auf beiden, #3 in fabrik/Eingang, #4 auf keinem Board; Personen `sh` (Mensch), `entwickler` (Agent).
mod gemeinsam;

use gemeinsam::{git, lies};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

/// gzip von `{"art":"nachricht","wer":"agent","text":"hallo"}` mit Zeilenumbruch (mtime 0).
const G1: [u8; 63] = [
    0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0xff, 0xab, 0x56, 0x4a, 0x2c, 0x2a, 0x51, 0xb2, 0x52, 0xca, 0x4b, 0x4c, 0xce, 0x28, 0xca, 0x4c, 0xce, 0x28, 0x51, 0xd2, 0x51, 0x2a, 0x4f, 0x2d, 0x02, 0x8a, 0x24, 0xa6, 0xa7, 0xe6, 0x81, 0x78, 0x25, 0xa9, 0x15, 0x20, 0x05, 0x19, 0x89, 0x39, 0x39, 0xf9, 0x4a, 0xb5, 0x5c, 0x00, 0x27, 0x25, 0x5f,
    0x24, 0x31, 0x00, 0x00, 0x00,
];
const AT: &str = "2026-11-13 10:34+01:00";
const K: &str = "entwickler@2026-11-13T10:34+01:00";
const N: &str = "transkripte/0001/entwickler@2026-11-13T1034+0100.jsonl.gz";
const ZEHN_MB: usize = 10_485_760;

/// `n` Byte, beginnend mit den Kennbytes — der Server entpackt nicht.
fn gross(n: usize) -> Vec<u8> {
    let mut d = vec![0x5a; n];
    d[..3].copy_from_slice(&[0x1f, 0x8b, 0x08]);
    d
}

struct Ordner {
    _tmp: tempfile::TempDir,
    pfad: PathBuf,
    lauf: gemeinsam::Laufendes,
}

impl Ordner {
    fn adresse(&self) -> &str {
        &self.lauf.adresse
    }

    fn commits(&self) -> u32 {
        git(&self.pfad, &["rev-list", "--count", "HEAD"]).parse().unwrap()
    }

    fn status(&self) -> String {
        git(&self.pfad, &["status", "--porcelain", "--untracked-files=all"])
    }

    /// Alle Dateien unter `transkripte/`, relativ, sortiert.
    fn transkriptdateien(&self) -> Vec<String> {
        let mut aus = vec![];
        sammeln(&self.pfad, &self.pfad.join("transkripte"), &mut aus);
        aus.sort();
        aus
    }

    fn aufgabe(&self, nr: u32) -> String {
        let name = std::fs::read_dir(self.pfad.join("aufgaben")).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).find(|n| n.starts_with(&format!("{nr:04}-")) && n.ends_with(".md")).unwrap();
        lies(&self.pfad, &format!("aufgaben/{name}"))
    }

    fn schreiben_und_committen(&self, rel: &str, text: &str) {
        std::fs::write(self.pfad.join(rel), text).unwrap();
        git(&self.pfad, &["add", "-A"]);
        git(&self.pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", rel]);
    }
}

fn sammeln(wurzel: &Path, pfad: &Path, aus: &mut Vec<String>) {
    let Ok(m) = std::fs::symlink_metadata(pfad) else { return };
    if m.is_dir() {
        for e in std::fs::read_dir(pfad).unwrap() {
            sammeln(wurzel, &e.unwrap().path(), aus);
        }
    } else {
        aus.push(pfad.strip_prefix(wurzel).unwrap().to_string_lossy().into_owned());
    }
}

/// Die Ausgangslage; `vorgabe`, `fabrik`, `zweit` sind Frontmatter-Zeilen (leer = kein Schlüssel).
fn ausgangslage(vorgabe: &str, fabrik: &str, zweit: &str) -> Ordner {
    let tmp = tempfile::tempdir().unwrap();
    let pfad = tmp.path().join("ordner");
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), format!("---\n{vorgabe}people:\n  sh: {{name: Stefan, kind: human}}\n  entwickler: {{name: Entwickler, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n---\n")).unwrap();
    for (n, t) in [(1, "transkript-ablegen"), (2, "zwei"), (3, "drei"), (4, "ohne-board")] {
        std::fs::write(pfad.join(format!("aufgaben/000{n}-{t}.md")), format!("---\nid: {n}\ntitle: {t}\n---\n")).unwrap();
    }
    let kopf = |z: &str| if z.is_empty() { String::new() } else { format!("---\n{z}---\n\n") };
    std::fs::write(pfad.join("boards/fabrik.md"), format!("{}# fabrik\n\n## Eingang\n\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-transkript-ablegen.md)\n\n## Fertig\n", kopf(fabrik))).unwrap();
    std::fs::write(pfad.join("boards/zweit.md"), format!("{}# zweit\n\n## Eingang\n\n- [#2](../aufgaben/0002-zwei.md)\n\n## Fertig\n", kopf(zweit))).unwrap();
    git(&pfad, &["init", "-q"]);
    git(&pfad, &["add", "-A"]);
    git(&pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgangslage"]);
    let lauf = gemeinsam::starten_in_berlin(&pfad, &["--port", "0"]);
    Ordner { _tmp: tmp, pfad, lauf }
}

fn an() -> Ordner {
    ausgangslage("record-transcripts: true\n", "", "")
}

/// Multipart-Upload; `felder` in dieser Reihenfolge, die Datei zuletzt (`None` = ohne Datei).
async fn hochladen_mit(adresse: &str, nr: u32, wer: &str, felder: &[(&str, &str)], datei: Option<Vec<u8>>) -> (u16, Value) {
    let mut form = reqwest::multipart::Form::new();
    for (k, v) in felder {
        form = form.text(k.to_string(), v.to_string());
    }
    if let Some(d) = datei {
        form = form.part("datei", reqwest::multipart::Part::bytes(d).file_name("lauf.jsonl.gz"));
    }
    let r = reqwest::Client::new().post(format!("{adresse}api/aufgaben/{nr}/transkripte")).header("X-KanbanD-Wer", wer).multipart(form).send().await.unwrap();
    let s = r.status().as_u16();
    (s, r.json().await.unwrap_or(Value::Null))
}

async fn hochladen(adresse: &str, nr: u32, role: &str, at: &str, datei: Vec<u8>) -> (u16, Value) {
    hochladen_mit(adresse, nr, "entwickler", &[("at", at), ("role", role), ("column", "Entwicklung")], Some(datei)).await
}

async fn holen(adresse: &str, pfad: &str) -> (u16, Value) {
    let r = reqwest::get(format!("{adresse}{pfad}")).await.unwrap();
    (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
}

// AK 1 (Abnahme-Probe der Karte) · US-1
#[tokio::test]
async fn ak01_ablegen() {
    let o = an();
    let n = o.commits();
    let (s, e) = hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await;
    assert_eq!(s, 201, "{e}");
    assert_eq!(e, json!({ "kennung": K, "at": AT, "role": "entwickler", "column": "Entwicklung", "bytes": G1.len() }));
    assert_eq!(std::fs::read(o.pfad.join(N)).unwrap(), G1, "N byte-gleich zu G1");
    assert_eq!(lies(&o.pfad, "transkripte/.gitignore"), "*\n");
    assert_eq!(o.commits(), n + 1);
    assert_eq!(git(&o.pfad, &["log", "-1", "--format=%an"]), "Entwickler", "Autor ist die Person entwickler");
    assert_eq!(git(&o.pfad, &["show", "--name-only", "--format=", "HEAD"]), "aufgaben/0001-transkript-ablegen.md");
    assert!(o.aufgabe(1).contains(&format!("\ntranscripts:\n  - {{at: {AT}, role: entwickler, column: Entwicklung, bytes: {}}}\n", G1.len())), "{}", o.aufgabe(1));
    assert_eq!(o.status(), "", "git status --porcelain leer");
    assert_eq!(git(&o.pfad, &["ls-files", "transkripte"]), "");
    let (_, a) = holen(o.adresse(), "api/aufgaben/1").await;
    assert_eq!(a["transkripte"], json!([{ "kennung": K, "at": AT, "role": "entwickler", "column": "Entwicklung", "bytes": G1.len() }]));
}

// AK 2: eine vorhandene `transkripte/.gitignore` bleibt byte-gleich; der Start legt nichts an; die Wurzel-`.gitignore` bleibt
#[tokio::test]
async fn ak02_ablage_ohne_eingriff_in_fremde_dateien() {
    let o = an();
    assert!(!o.pfad.join("transkripte").exists(), "der Start legt keinen Ordner transkripte/ an");
    std::fs::create_dir(o.pfad.join("transkripte")).unwrap();
    std::fs::write(o.pfad.join("transkripte/.gitignore"), "# von Hand\n*\n").unwrap();
    o.schreiben_und_committen(".gitignore", "*.log\n");
    let (s, e) = hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await;
    assert_eq!(s, 201, "{e}");
    assert_eq!(lies(&o.pfad, "transkripte/.gitignore"), "# von Hand\n*\n");
    assert_eq!(lies(&o.pfad, ".gitignore"), "*.log\n");
}

// AK 3 (Tabelle) · US-2: wirksamer Schalter; bei 409 kein Commit, unter transkripte/ nichts — auch nicht bei G10+1
#[tokio::test]
async fn ak03_wirksamer_schalter() {
    let zeilen: [(&str, &str, &str, u32, Option<Value>); 9] = [
        ("", "", "", 1, Some(json!(["fabrik"]))),
        ("record-transcripts: true\n", "", "", 1, None),
        ("record-transcripts: true\n", "record-transcripts: false\n", "", 1, Some(json!(["fabrik"]))),
        ("record-transcripts: false\n", "record-transcripts: true\n", "", 1, None),
        ("record-transcripts: true\n", "", "record-transcripts: false\n", 2, Some(json!(["zweit"]))),
        ("record-transcripts: true\n", "", "record-transcripts: false\narchived: 2026-11-20\n", 2, Some(json!(["zweit"]))),
        ("record-transcripts: true\n", "record-transcripts: true\n", "record-transcripts: true\n", 2, None),
        ("record-transcripts: false\n", "", "", 4, Some(json!([]))),
        ("record-transcripts: true\n", "", "", 4, None),
    ];
    for (i, (vorgabe, fabrik, zweit, nr, aus)) in zeilen.into_iter().enumerate() {
        let o = ausgangslage(vorgabe, fabrik, zweit);
        let n = o.commits();
        let spalte = if nr == 1 { "Entwicklung" } else { "Eingang" };
        let (s, e) = hochladen_mit(o.adresse(), nr, "entwickler", &[("at", AT), ("role", "entwickler"), ("column", spalte)], Some(G1.to_vec())).await;
        match aus {
            None => assert_eq!(s, 201, "Zeile {}: {e}", i + 1),
            Some(boards) => {
                assert_eq!((s, &e["erfassung"], &e["boards"]), (409, &json!("aus"), &boards), "Zeile {}: {e}", i + 1);
                assert!(e["fehler"].is_string());
                assert_eq!(o.commits(), n, "Zeile {}", i + 1);
                assert!(!o.pfad.join("transkripte").exists(), "Zeile {}: nichts unter transkripte/", i + 1);
                let (s, e) = hochladen_mit(o.adresse(), nr, "entwickler", &[("at", AT), ("role", "entwickler"), ("column", spalte)], Some(gross(ZEHN_MB + 1))).await;
                assert_eq!(s, 409, "Zeile {}: 409 vor dem Körper, nicht 413: {e}", i + 1);
                assert!(!o.pfad.join("transkripte").exists());
            }
        }
    }
}

/// Nichts geschrieben: Commit-Zahl, Datei von #1 und die Dateien unter transkripte/ wie vorher, keine Zwischendatei.
fn nichts_geschrieben(o: &Ordner, vorher: &(u32, String, Vec<String>), was: &str) {
    assert_eq!((o.commits(), o.aufgabe(1), o.transkriptdateien()), vorher.clone(), "{was}");
    assert!(!o.transkriptdateien().iter().any(|d| d.ends_with(".kanbanD-tmp")), "{was}");
}

fn stand(o: &Ordner) -> (u32, String, Vec<String>) {
    (o.commits(), o.aufgabe(1), o.transkriptdateien())
}

// AK 6 · US-3: genau 10.485.760 Byte → 201, ein Byte mehr → 413, 60 MB → 413; nichts geschrieben
#[tokio::test]
async fn ak06_groesse() {
    let o = an();
    let (s, e) = hochladen(o.adresse(), 1, "entwickler", AT, gross(ZEHN_MB)).await;
    assert_eq!((s, &e["bytes"]), (201, &json!(ZEHN_MB)), "{e}");
    let vorher = stand(&o);
    let (s, e) = hochladen(o.adresse(), 1, "entwickler", "2026-11-13 10:35+01:00", gross(ZEHN_MB + 1)).await;
    assert_eq!(s, 413, "{e}");
    assert!(e["fehler"].is_string(), "{e}");
    nichts_geschrieben(&o, &vorher, "G10+1");
    let (s, e) = hochladen(o.adresse(), 1, "entwickler", "2026-11-13 10:36+01:00", gross(60 * 1024 * 1024)).await;
    assert_eq!(s, 413, "{e}");
    nichts_geschrieben(&o, &vorher, "60 MB");
    assert_eq!(o.transkriptdateien(), ["transkripte/.gitignore", N]);
}

// AK 7: Form der Anfrage — jede Abweisung 400 (404, 423), nie 422; nichts geschrieben, auch kein Ordner transkripte/
#[tokio::test]
async fn ak07_form_der_anfrage() {
    let o = an();
    let vorher = stand(&o);
    let felder = [("at", AT), ("role", "entwickler"), ("column", "Entwicklung")];
    let ohne = |k: &str| felder.iter().filter(|(f, _)| *f != k).copied().collect::<Vec<_>>();
    let mit = |k: &'static str, v: &'static str| felder.iter().map(|(f, w)| if *f == k { (*f, v) } else { (*f, *w) }).collect::<Vec<_>>();
    let lang = "r".repeat(61);
    let faelle: Vec<(&str, Vec<(&str, &str)>, Option<Vec<u8>>)> = vec![
        ("Zip statt gzip", felder.to_vec(), Some(vec![0x50, 0x4b, 0x03])),
        ("leere Datei", felder.to_vec(), Some(vec![])),
        ("zwei Byte", felder.to_vec(), Some(vec![0x1f, 0x8b])),
        ("ohne at", ohne("at"), Some(G1.to_vec())),
        ("ohne role", ohne("role"), Some(G1.to_vec())),
        ("ohne column", ohne("column"), Some(G1.to_vec())),
        ("ohne datei", felder.to_vec(), None),
        ("Spalte gibt es nicht", mit("column", "Gibtsnicht"), Some(G1.to_vec())),
        ("Datum falsch", mit("at", "2026-13-45 10:34+01:00"), Some(G1.to_vec())),
        ("Rolle mit @", mit("role", "a@b"), Some(G1.to_vec())),
        ("Zukunft", mit("at", "2099-01-01 10:00+01:00"), Some(G1.to_vec())),
    ];
    for (was, f, d) in faelle {
        let (s, e) = hochladen_mit(o.adresse(), 1, "entwickler", &f, d).await;
        assert_eq!(s, 400, "{was}: {e}");
        assert!(e["fehler"].is_string(), "{was}: {e}");
        nichts_geschrieben(&o, &vorher, was);
        assert!(!o.pfad.join("transkripte").exists(), "{was}: kein Ordner transkripte/");
    }
    let (s, e) = hochladen_mit(o.adresse(), 1, "entwickler", &[("at", AT), ("role", &lang), ("column", "Entwicklung")], Some(G1.to_vec())).await;
    assert_eq!(s, 400, "Rolle mit 61 Zeichen: {e}");
    let (s, e) = hochladen(o.adresse(), 999, "entwickler", AT, G1.to_vec()).await;
    assert_eq!(s, 404, "{e}");
    o.schreiben_und_committen("aufgaben/0003-drei.md", "---\nid: 3\ntitle: [kaputt\n---\n");
    let (s, e) = hochladen_mit(o.adresse(), 3, "entwickler", &[("at", AT), ("role", "entwickler"), ("column", "Eingang")], Some(G1.to_vec())).await;
    assert_eq!(s, 423, "{e}");
    assert!(!o.pfad.join("transkripte").exists());
}

// AK 8: gleiche Kennung, gleich gefalteter Name, Rest einer gelöschten Aufgabe, Höchstzahl 1000
#[tokio::test]
async fn ak08_kennung_faltung_hoechstzahl() {
    let o = an();
    assert_eq!(hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await.0, 201);
    let vorher = stand(&o);
    let (s, e) = hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await;
    assert_eq!((s, &e["kennung"]), (409, &json!(K)), "{e}");
    nichts_geschrieben(&o, &vorher, "gleiche Kennung");

    assert_eq!(hochladen(o.adresse(), 1, "Code Reviewer", AT, G1.to_vec()).await.0, 201);
    let vorher = stand(&o);
    let (s, e) = hochladen(o.adresse(), 1, "code-reviewer", AT, G1.to_vec()).await;
    assert_eq!((s, &e["kennung"]), (409, &json!("Code Reviewer@2026-11-13T10:34+01:00")), "{e}");
    nichts_geschrieben(&o, &vorher, "gleich gefaltet");
    assert_eq!(hochladen(o.adresse(), 1, "code-reviewer", "2026-11-13 10:35+01:00", G1.to_vec()).await.0, 201, "eine Minute später");

    // ein Rest ohne Eintrag wird überschrieben
    let o = an();
    std::fs::create_dir_all(o.pfad.join("transkripte/0001")).unwrap();
    std::fs::write(o.pfad.join(N), "alt").unwrap();
    assert_eq!(hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await.0, 201);
    assert_eq!(std::fs::read(o.pfad.join(N)).unwrap(), G1);

    // 999 + 1 wird angenommen, 1000 + 1 nicht
    let o = an();
    let zeilen: String = (0..999).map(|i| format!("  - {{at: 2026-01-01 {:02}:{:02}+01:00, role: alt, column: Entwicklung, bytes: 1}}\n", i / 60, i % 60)).collect();
    o.schreiben_und_committen("aufgaben/0001-transkript-ablegen.md", &format!("---\nid: 1\ntitle: transkript-ablegen\ntranscripts:\n{zeilen}---\n"));
    assert_eq!(hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await.0, 201, "999 + 1");
    let vorher = stand(&o);
    let (s, e) = hochladen(o.adresse(), 1, "entwickler", "2026-11-13 10:35+01:00", G1.to_vec()).await;
    assert_eq!(s, 409, "1000 + 1: {e}");
    assert!(e["fehler"].is_string() && e.get("kennung").is_none(), "{e}");
    nichts_geschrieben(&o, &vorher, "Höchstzahl");
}

/// Alle Dateien des Board-Ordners und seines Elternordners (ohne .git) mit Inhalt.
fn umgebung(o: &Ordner) -> Vec<(String, Vec<u8>)> {
    let eltern = o.pfad.parent().unwrap();
    let mut aus = vec![];
    fn lauf(wurzel: &Path, p: &Path, aus: &mut Vec<(String, Vec<u8>)>) {
        let m = std::fs::symlink_metadata(p).unwrap();
        if m.is_dir() {
            if p.file_name().is_some_and(|n| n == ".git") {
                return;
            }
            for e in std::fs::read_dir(p).unwrap() {
                lauf(wurzel, &e.unwrap().path(), aus);
            }
        } else {
            aus.push((p.strip_prefix(wurzel).unwrap().to_string_lossy().into_owned(), std::fs::read(p).unwrap_or_default()));
        }
    }
    lauf(eltern, eltern, &mut aus);
    aus.sort();
    aus
}

// AK 9a · US-4: Pfadangriffe über die Rolle landen gefaltet unter transkripte/0001/, sonst ändert sich nichts
#[tokio::test]
async fn ak09a_pfadangriffe_ueber_die_rolle() {
    for (rolle, name) in [("../../x", "x"), ("a/b", "a-b"), ("..", "lauf"), ("C:\\x", "c-x"), ("Code Reviewer", "code-reviewer")] {
        let o = an();
        let vorher: Vec<(String, Vec<u8>)> = umgebung(&o).into_iter().filter(|(p, _)| !p.starts_with("ordner/aufgaben/")).collect();
        let (s, e) = hochladen(o.adresse(), 1, rolle, AT, G1.to_vec()).await;
        assert_eq!(s, 201, "{rolle}: {e}");
        let datei = format!("transkripte/0001/{name}@2026-11-13T1034+0100.jsonl.gz");
        assert_eq!(std::fs::read(o.pfad.join(&datei)).unwrap(), G1, "{rolle}");
        let nachher: Vec<(String, Vec<u8>)> = umgebung(&o).into_iter().filter(|(p, _)| !p.starts_with("ordner/aufgaben/") && !p.starts_with("ordner/transkripte/")).collect();
        assert_eq!(nachher, vorher, "{rolle}: außerhalb von transkripte/ nichts neu oder geändert");
        assert_eq!(o.transkriptdateien(), ["transkripte/.gitignore".to_string(), datei]);
    }
}

// AK 9c (Hochladen) · US-4: transkripte/0001 oder transkripte/ ist ein Symlink nach außen → 500 ohne Commit, außen unverändert
#[cfg(unix)]
#[tokio::test]
async fn ak09cd_hochladen_ueber_einen_symlink() {
    for ebene in ["transkripte/0001", "transkripte"] {
        let o = an();
        let aussen = o.pfad.parent().unwrap().join("aussen");
        std::fs::create_dir(&aussen).unwrap();
        std::fs::write(aussen.join("entwickler@2026-11-13T1034+0100.jsonl.gz"), "fremd").unwrap();
        std::fs::create_dir_all(o.pfad.join(ebene).parent().unwrap()).unwrap();
        std::os::unix::fs::symlink(&aussen, o.pfad.join(ebene)).unwrap();
        let n = o.commits();
        let (s, e) = hochladen(o.adresse(), 1, "anderer", AT, G1.to_vec()).await;
        assert_eq!(s, 500, "{ebene}: {e}");
        assert!(e["fehler"].is_string());
        assert_eq!(o.commits(), n, "{ebene}");
        let inhalt: Vec<String> = std::fs::read_dir(&aussen).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
        assert_eq!(inhalt, ["entwickler@2026-11-13T1034+0100.jsonl.gz"], "{ebene}: außen nichts neu");
        assert_eq!(std::fs::read_to_string(aussen.join("entwickler@2026-11-13T1034+0100.jsonl.gz")).unwrap(), "fremd");
    }
}

// AK 15 (letzter Satz) · ADR-0036 Regel 8: während eines Uploads nennt kein Live-Ereignis einen Pfad unter transkripte/
#[tokio::test]
async fn ak15_kein_live_ereignis_unter_transkripte() {
    let o = an();
    let adresse = o.adresse().to_string();
    let lauf = tokio::spawn(async move {
        let antwort = reqwest::get(format!("{adresse}api/ereignisse")).await.unwrap();
        let mut strom = antwort.bytes_stream();
        let mut text = String::new();
        let ende = tokio::time::Instant::now() + std::time::Duration::from_secs(4);
        use futures_util::StreamExt;
        while let Ok(Some(Ok(teil))) = tokio::time::timeout_at(ende, strom.next()).await {
            text.push_str(&String::from_utf8_lossy(&teil));
            if text.contains("0001-transkript-ablegen.md") {
                break;
            }
        }
        text
    });
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    let (s, e) = hochladen(o.adresse(), 1, "entwickler", AT, gross(ZEHN_MB)).await;
    assert_eq!(s, 201, "{e}");
    // ein Pfad, den kanbanD nicht selbst geschrieben hat, erschiene als externe Änderung — hier darf keiner unter transkripte/ stehen
    std::fs::write(o.pfad.join("transkripte/0001/von-hand@2026-11-13T1034+0100.jsonl.gz"), G1).unwrap();
    let text = lauf.await.unwrap();
    assert!(!text.contains("transkripte/"), "{text}");
}

async fn herunterladen(adresse: &str, pfad: &str) -> (u16, reqwest::header::HeaderMap, Vec<u8>) {
    let r = reqwest::get(format!("{adresse}{pfad}")).await.unwrap();
    (r.status().as_u16(), r.headers().clone(), r.bytes().await.unwrap().to_vec())
}

fn zustaende(liste: &Value) -> Vec<(Value, Value)> {
    liste["transkripte"].as_array().unwrap().iter().map(|t| (t["kennung"].clone(), t["zustand"].clone())).collect()
}

// AK 4 · US-2 (Liste): der Zustand des Schalters ist vorab lesbar
#[tokio::test]
async fn ak04_zustand_vorher_lesbar() {
    let o = ausgangslage("record-transcripts: true\n", "", "record-transcripts: false\n");
    let (s, l) = holen(o.adresse(), "api/aufgaben/2/transkripte").await;
    assert_eq!((s, l), (200, json!({ "erfassen": false, "boards_aus": ["zweit"], "transkripte": [] })));
    assert_eq!(holen(o.adresse(), "api/boards/zweit").await.1["transkripte_erfassen"], json!(false));
    assert_eq!(holen(o.adresse(), "api/boards/fabrik").await.1["transkripte_erfassen"], Value::Null);
    let (_, l) = holen(o.adresse(), "api/aufgaben/1/transkripte").await;
    assert_eq!((&l["erfassen"], &l["boards_aus"]), (&json!(true), &json!([])));
    let o = ausgangslage("record-transcripts: true\n", "record-transcripts: true\n", "");
    assert_eq!(holen(o.adresse(), "api/boards/fabrik").await.1["transkripte_erfassen"], json!(true));
}

// AK 10 · AK 11 · US-5: Liste mit Zuständen in Reihenfolge des Hochladens, Herunterladen nur bei `vorhanden`
#[tokio::test]
async fn ak10_ak11_liste_und_herunterladen() {
    let o = an();
    let zeiten = ["2026-11-13 10:34+01:00", "2026-11-13 10:35+01:00", "2026-11-13 10:36+01:00", "2026-11-13 10:37+01:00"];
    for at in zeiten {
        assert_eq!(hochladen(o.adresse(), 1, "entwickler", at, G1.to_vec()).await.0, 201);
    }
    let datei = |at: &str| o.pfad.join(format!("transkripte/0001/entwickler@2026-11-13T{}+0100.jsonl.gz", &at[11..16].replace(':', "")));
    std::fs::remove_file(datei(zeiten[1])).unwrap();
    std::fs::write(datei(zeiten[2]), [G1.as_slice(), &[0]].concat()).unwrap();
    std::fs::write(datei(zeiten[3]), [&[0u8][..], &G1[1..]].concat()).unwrap();
    let text = o.aufgabe(1).replacen("---\n", "", 1).replacen("---\n", "  - {at: gestern, role: x}\n---\n", 1);
    o.schreiben_und_committen("aufgaben/0001-transkript-ablegen.md", &format!("---\n{text}"));

    let (s, l) = holen(o.adresse(), "api/aufgaben/1/transkripte").await;
    assert_eq!(s, 200, "{l}");
    let k = |at: &str| json!(format!("entwickler@{}", at.replacen(' ', "T", 1)));
    assert_eq!(zustaende(&l), [(k(zeiten[0]), json!("vorhanden")), (k(zeiten[1]), json!("fehlt")), (k(zeiten[2]), json!("abweichend")), (k(zeiten[3]), json!("unlesbar")), (Value::Null, json!("unlesbar"))]);
    assert_eq!(l["transkripte"][4]["role"], json!("x"));
    assert_eq!(holen(o.adresse(), "api/aufgaben/1").await.0, 200, "nicht defekt");

    let (s, kopf, rumpf) = herunterladen(o.adresse(), &format!("api/aufgaben/1/transkripte/{}", K.replace('+', "%2B"))).await;
    assert_eq!(s, 200);
    assert_eq!(kopf["content-type"], "application/gzip");
    assert!(kopf.get("content-encoding").is_none());
    assert!(kopf["content-disposition"].to_str().unwrap().starts_with("attachment"));
    assert_eq!(kopf["x-content-type-options"], "nosniff");
    assert_eq!(rumpf, G1, "byte-gleich");
    for (at, zustand) in [(zeiten[1], "fehlt"), (zeiten[2], "abweichend"), (zeiten[3], "unlesbar")] {
        let (s, e) = holen(o.adresse(), &format!("api/aufgaben/1/transkripte/{}", k(at).as_str().unwrap().replace('+', "%2B"))).await;
        assert_eq!((s, &e["zustand"]), (404, &json!(zustand)), "{at}: {e}");
        assert!(e["fehler"].is_string());
    }
    let (s, e) = holen(o.adresse(), "api/aufgaben/1/transkripte/niemand@2026-11-13T10:34%2B01:00").await;
    assert_eq!(s, 404, "{e}");
    assert!(e.get("zustand").is_none(), "unbekannte Kennung ohne Zustand: {e}");
    // Ausschalten ändert nichts am Lesen
    std::fs::write(o.pfad.join("kanbanD.md"), lies(&o.pfad, "kanbanD.md").replace("record-transcripts: true", "record-transcripts: false")).unwrap();
    assert_eq!(herunterladen(o.adresse(), &format!("api/aufgaben/1/transkripte/{}", K.replace('+', "%2B"))).await.2, G1);
}

// AK 9b: Pfade oder Dateinamen in der Adresse treffen nie eine Datei
#[tokio::test]
async fn ak09b_pfade_in_der_adresse() {
    let o = an();
    assert_eq!(hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await.0, 201);
    for weg in ["..%2F..%2Fkanban.md", "%2Fetc%2Fpasswd", "entwickler@2026-11-13T1034+0100.jsonl.gz", "..%2F0001-transkript-ablegen.md"] {
        let (s, _, rumpf) = herunterladen(o.adresse(), &format!("api/aufgaben/1/transkripte/{weg}")).await;
        assert_eq!(s, 404, "{weg}: {}", String::from_utf8_lossy(&rumpf));
    }
}

// AK 9c, 9d (Lesen): ein Symlink auf jeder Ebene ergibt `unlesbar`, 404 mit Zustand, außen unverändert
#[cfg(unix)]
#[tokio::test]
async fn ak09cd_lesen_ueber_einen_symlink() {
    for ebene in ["transkripte/0001", "transkripte", N] {
        let o = an();
        assert_eq!(hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await.0, 201);
        let aussen = o.pfad.parent().unwrap().join("aussen");
        std::fs::create_dir(&aussen).unwrap();
        std::fs::write(aussen.join("entwickler@2026-11-13T1034+0100.jsonl.gz"), G1).unwrap();
        // die echte Ebene beiseite, an ihre Stelle der Symlink
        std::fs::rename(o.pfad.join(ebene), o.pfad.parent().unwrap().join("beiseite")).unwrap();
        let ziel = if ebene == N { aussen.join("entwickler@2026-11-13T1034+0100.jsonl.gz") } else { aussen.clone() };
        if ebene == "transkripte" {
            std::fs::create_dir(aussen.join("0001")).unwrap();
            std::fs::write(aussen.join("0001/entwickler@2026-11-13T1034+0100.jsonl.gz"), G1).unwrap();
        }
        std::os::unix::fs::symlink(&ziel, o.pfad.join(ebene)).unwrap();
        let vorher = umgebung(&o).into_iter().filter(|(p, _)| p.starts_with("aussen")).collect::<Vec<_>>();
        let (_, l) = holen(o.adresse(), "api/aufgaben/1/transkripte").await;
        assert_eq!(zustaende(&l), [(json!(K), json!("unlesbar"))], "{ebene}");
        let (s, e) = holen(o.adresse(), &format!("api/aufgaben/1/transkripte/{}", K.replace('+', "%2B"))).await;
        assert_eq!((s, &e["zustand"]), (404, &json!("unlesbar")), "{ebene}: {e}");
        assert_eq!(umgebung(&o).into_iter().filter(|(p, _)| p.starts_with("aussen")).collect::<Vec<_>>(), vorher, "{ebene}: außen unverändert");
    }
}

// AK 15: `transkripte/0001` ist für kanbanD nicht lesbar — GET der Aufgabe und /api/zustand greifen nicht darauf zu
#[cfg(unix)]
#[tokio::test]
async fn ak15_lesen_ohne_dateisystem() {
    use std::os::unix::fs::PermissionsExt;
    let o = an();
    assert_eq!(hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await.0, 201);
    std::fs::set_permissions(o.pfad.join("transkripte/0001"), std::fs::Permissions::from_mode(0o000)).unwrap();
    let (s, a) = holen(o.adresse(), "api/aufgaben/1").await;
    let (sz, z) = holen(o.adresse(), "api/zustand").await;
    let (_, l) = holen(o.adresse(), "api/aufgaben/1/transkripte").await;
    std::fs::set_permissions(o.pfad.join("transkripte/0001"), std::fs::Permissions::from_mode(0o755)).unwrap();
    assert_eq!((s, a["transkripte"][0]["kennung"].clone()), (200, json!(K)));
    assert_eq!(sz, 200, "{z}");
    assert_eq!(zustaende(&l), [(json!(K), json!("unlesbar"))]);
}

async fn senden_als(adresse: &str, methode: reqwest::Method, pfad: &str, wer: &str) -> (u16, Value) {
    gemeinsam::senden(methode, adresse, pfad, wer, json!({})).await
}

fn kennung_in_adresse(k: &str) -> String {
    k.replace('+', "%2B")
}

// AK 13a · US-7: DELETE entfernt Eintrag (ein Commit) und Datei; unbekannt → 404 ohne Commit; fehlende Datei und „aus“ gehen
#[tokio::test]
async fn ak13a_loeschen() {
    let o = an();
    assert_eq!(hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await.0, 201);
    let n = o.commits();
    let (s, e) = senden_als(o.adresse(), reqwest::Method::DELETE, &format!("api/aufgaben/1/transkripte/{}", kennung_in_adresse(K)), "sh").await;
    assert_eq!(s, 200, "{e}");
    assert_eq!(o.commits(), n + 1);
    assert!(!o.pfad.join(N).exists());
    assert_eq!(holen(o.adresse(), "api/aufgaben/1/transkripte").await.1["transkripte"], json!([]));
    assert!(!o.aufgabe(1).contains("transcripts"), "{}", o.aufgabe(1));
    let (s, _) = senden_als(o.adresse(), reqwest::Method::DELETE, &format!("api/aufgaben/1/transkripte/{}", kennung_in_adresse(K)), "sh").await;
    assert_eq!((s, o.commits()), (404, n + 1), "unbekannte Kennung ohne Commit");

    assert_eq!(hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await.0, 201);
    std::fs::remove_file(o.pfad.join(N)).unwrap();
    std::fs::write(o.pfad.join("kanbanD.md"), lies(&o.pfad, "kanbanD.md").replace("record-transcripts: true", "record-transcripts: false")).unwrap();
    let n = o.commits();
    let (s, e) = senden_als(o.adresse(), reqwest::Method::DELETE, &format!("api/aufgaben/1/transkripte/{}", kennung_in_adresse(K)), "entwickler").await;
    assert_eq!((s, o.commits()), (200, n + 1), "Datei fehlt, Schalter aus: {e}");
}

// AK 13b, 13c · US-7: Archivieren und Zurückholen lassen alles stehen; endgültig löschen räumt transkripte/<nr>/, eine neue #1 erbt nichts
#[tokio::test]
async fn ak13bc_archivieren_und_endgueltig_loeschen() {
    let o = an();
    assert_eq!(hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await.0, 201);
    let adresse = format!("api/aufgaben/1/transkripte/{}", kennung_in_adresse(K));
    let vorher = herunterladen(o.adresse(), &adresse).await.2;
    assert_eq!(senden_als(o.adresse(), reqwest::Method::POST, "api/aufgaben/1/archivieren", "sh").await.0, 200);
    assert_eq!(herunterladen(o.adresse(), &adresse).await.2, vorher);
    assert_eq!(senden_als(o.adresse(), reqwest::Method::POST, "api/aufgaben/1/zurueckholen", "sh").await.0, 200);
    assert_eq!(herunterladen(o.adresse(), &adresse).await.2, vorher);
    assert!(o.aufgabe(1).contains("transcripts:"));

    for nr in [4, 3, 2, 1] {
        let (s, e) = senden_als(o.adresse(), reqwest::Method::DELETE, &format!("api/aufgaben/{nr}"), "sh").await;
        assert_eq!(s, 200, "#{nr}: {e}");
    }
    assert!(!o.pfad.join("transkripte/0001").exists(), "transkripte/0001/ geräumt");
    let (s, a) = gemeinsam::senden(reqwest::Method::POST, o.adresse(), "api/aufgaben", "sh", json!({ "titel": "neu", "board": "fabrik", "spalte": "Entwicklung" })).await;
    assert_eq!((s, &a["nummer"]), (201, &json!(1)), "{a}");
    assert_eq!(holen(o.adresse(), "api/aufgaben/1/transkripte").await.1["transkripte"], json!([]));
    assert_eq!(o.status(), "");
}

// AK 9c (Löschen): transkripte/0001 ist ein Symlink nach außen — DELETE entfernt nur den Eintrag, endgültig löschen gelingt, außen bleibt
#[cfg(unix)]
#[tokio::test]
async fn ak09c_loeschen_ueber_einen_symlink() {
    let o = an();
    assert_eq!(hochladen(o.adresse(), 1, "entwickler", AT, G1.to_vec()).await.0, 201);
    assert_eq!(hochladen(o.adresse(), 1, "entwickler", "2026-11-13 10:35+01:00", G1.to_vec()).await.0, 201);
    let aussen = o.pfad.parent().unwrap().join("aussen");
    std::fs::rename(o.pfad.join("transkripte/0001"), &aussen).unwrap();
    std::os::unix::fs::symlink(&aussen, o.pfad.join("transkripte/0001")).unwrap();
    let vorher = umgebung(&o).into_iter().filter(|(p, _)| p.starts_with("aussen")).collect::<Vec<_>>();
    assert_eq!(vorher.len(), 2);
    let n = o.commits();
    let (s, e) = senden_als(o.adresse(), reqwest::Method::DELETE, &format!("api/aufgaben/1/transkripte/{}", kennung_in_adresse(K)), "sh").await;
    assert_eq!((s, o.commits()), (200, n + 1), "{e}");
    let (s, e) = senden_als(o.adresse(), reqwest::Method::DELETE, "api/aufgaben/1", "sh").await;
    assert_eq!(s, 200, "{e}");
    assert_eq!(umgebung(&o).into_iter().filter(|(p, _)| p.starts_with("aussen")).collect::<Vec<_>>(), vorher, "außen unverändert");
}

// AK 15 · FA 10: Endpunktliste, OpenAPI und README beschreiben die vier Routen und die neuen Felder
#[tokio::test]
async fn ak15_beschreibung() {
    let o = an();
    let (_, eps) = holen(o.adresse(), "api/endpunkte").await;
    let routen: Vec<(String, String)> = eps.as_array().unwrap().iter().map(|e| (e["methode"].as_str().unwrap().to_string(), e["pfad"].as_str().unwrap().to_string())).collect();
    for (m, p) in [("POST", "/api/aufgaben/{nr}/transkripte"), ("GET", "/api/aufgaben/{nr}/transkripte"), ("GET", "/api/aufgaben/{nr}/transkripte/{kennung}"), ("DELETE", "/api/aufgaben/{nr}/transkripte/{kennung}")] {
        assert!(routen.contains(&(m.to_string(), p.to_string())), "Endpunktliste: {m} {p}");
    }
    let (_, api) = holen(o.adresse(), "api/openapi.json").await;
    let liste = &api["paths"]["/api/aufgaben/{nr}/transkripte"];
    let eins = &api["paths"]["/api/aufgaben/{nr}/transkripte/{kennung}"];
    let mut codes: Vec<String> = [&liste["post"], &liste["get"], &eins["get"], &eins["delete"]].iter().flat_map(|op| op["responses"].as_object().unwrap_or_else(|| panic!("{op}")).keys().cloned().collect::<Vec<_>>()).collect();
    codes.sort();
    codes.dedup();
    for c in ["200", "201", "400", "404", "409", "413", "423", "500", "503"] {
        assert!(codes.contains(&c.to_string()), "Statuscode {c} fehlt: {codes:?}");
    }
    let schemas = &api["components"]["schemas"];
    assert!(schemas["Aufgabe"]["properties"]["transkripte"].is_object(), "Aufgabe.transkripte");
    assert!(schemas["Board"]["properties"]["transkripte_erfassen"].is_object(), "Board.transkripte_erfassen");
    let readme = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/README.md")).unwrap();
    let ab = readme.split("### Transkripte ablegen").nth(1).expect("Abschnitt Transkripte ablegen");
    assert!(ab.contains("-F datei=@lauf.jsonl.gz") && ab.contains("/api/aufgaben/1/transkripte"), "Beispiel-Aufruf");
}
