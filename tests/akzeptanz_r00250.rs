//! R00250 (ADR-0043) im gestarteten Programm über HTTP: jeder Schreibweg ändert in `kanbanD.md` nur die Zeilen, die sich
//! ändern (AK 1–8 mit `git diff --numstat`), die sechs echten Bestände (AK 9), `einstellungen::schreiben` nur aus
//! `einrichten` (AK 10).
mod gemeinsam;

use gemeinsam::{Laufendes, git, senden};
use kanband::format::frontmatter;
use reqwest::Method;
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

const SH: &str = "  sh: {name: Sven, kind: human}\n";
const SH_NEU: &str = "  sh: {name: Sven Hansen, kind: human}\n";
const AG: &str = "  ag: {name: Agent A, kind: agent}\n";
const KLASSEN: &str = "classes:\n  bug: {label: Fehler, color: red}\n";
const QUELLEN: &str = "sources:\n  repository: \"\"\n";

/// Datei H aus R00250 (Ausgangslage); dieselbe Form wie in `tests/zeilengenau_einstellungen.rs`.
fn h() -> String {
    format!("---\n# von Hand\neigener-schluessel: 1\npeople:\n{SH}{AG}# Klassen folgen\n{KLASSEN}{QUELLEN}---\n# Unser Ordner\n\nVon Hand geschrieben.\n")
}

fn wortlaut(schluessel: &str) -> String {
    format!("Nicht gespeichert: Der Abschnitt „{schluessel}“ in kanbanD.md ist von Hand gestaltet und lässt sich nicht zeilengenau ändern. Bitte die Änderung direkt in kanbanD.md eintragen.")
}

fn vor_schluss(text: &str, zeilen: &str) -> String {
    let i = text[4..].find("---\n").unwrap() + 4;
    format!("{}{zeilen}{}", &text[..i], &text[i..])
}

struct Lage {
    _tmp: tempfile::TempDir,
    pfad: PathBuf,
    lauf: Laufendes,
}

/// Ordner mit `text` als `kanbanD.md`, als „von Hand“ committet, Programm gestartet (`--port 0`).
fn lage(text: &str) -> Lage {
    let tmp = tempfile::tempdir().unwrap();
    let pfad = tmp.path().join("ordner");
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), text).unwrap();
    std::fs::write(pfad.join("boards/entwicklung.md"), "# Entwicklung\n\n## Offen\n\n## Erledigt\n").unwrap();
    git(&pfad, &["init", "-q"]);
    git(&pfad, &["add", "-A"]);
    git(&pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "von Hand"]);
    let lauf = gemeinsam::starten(&pfad, &["--port", "0"]);
    Lage { _tmp: tmp, pfad, lauf }
}

impl Lage {
    fn datei(&self) -> String {
        String::from_utf8(std::fs::read(self.pfad.join("kanbanD.md")).unwrap()).unwrap()
    }

    fn head(&self) -> String {
        git(&self.pfad, &["rev-parse", "HEAD"])
    }

    /// `git diff --numstat HEAD~1 HEAD -- kanbanD.md` wörtlich (hinzugefügt, entfernt, Datei).
    fn numstat(&self) -> String {
        git(&self.pfad, &["diff", "--numstat", "HEAD~1", "HEAD", "--", "kanbanD.md"])
    }

    async fn anfrage(&self, methode: Method, pfad: &str, wer: &str, rumpf: Value) -> (u16, Value) {
        senden(methode, &self.lauf.adresse, pfad, wer, rumpf).await
    }

    /// `GET /api/einstellungen` → `aendern` → `PUT`.
    async fn put(&self, wer: &str, aendern: impl FnOnce(&mut Value)) -> (u16, Value) {
        let (_, mut e) = self.anfrage(Method::GET, "api/einstellungen", wer, Value::Null).await;
        aendern(&mut e);
        self.anfrage(Method::PUT, "api/einstellungen", wer, e).await
    }

    /// 409 mit dem Wortlaut, kein Commit, Datei zeichengleich.
    fn verweigert(&self, antwort: (u16, Value), schluessel: &str, head: &str, text: &str) {
        assert_eq!(antwort, (409, json!({"fehler": wortlaut(schluessel)})));
        assert_eq!(self.head(), head, "kein Commit");
        assert_eq!(self.datei(), text, "Datei zeichengleich");
    }
}

fn umbenennen(e: &mut Value) {
    e["personen"][0]["name"] = json!("Sven Hansen");
}

fn signal_warten(e: &mut Value) {
    e["signale"] = json!([{"schluessel": "warten", "bezeichnung": "Warten", "farbe": "amber"}]);
}

// ---- AK 1–3: Probe der Karte, jeder Schreibweg, CRLF/BOM ----

#[tokio::test]
async fn ak1_probe_der_karte_ueber_put() {
    let l = lage(&h());
    assert_eq!(l.put("sh", umbenennen).await.0, 200);
    assert_eq!(l.numstat(), "1\t1\tkanbanD.md");
    assert_eq!(l.datei(), h().replace(SH, SH_NEU));
}

#[tokio::test]
async fn ak2_post_patch_put_je_nur_die_eigenen_zeilen() {
    let l = lage(&h());
    let (s, _) = l.anfrage(Method::POST, "api/personen", "sh", json!({"kuerzel": "ab", "name": "Anna B", "art": "human"})).await;
    assert!((200..=201).contains(&s), "{s}");
    assert_eq!(l.numstat(), "1\t0\tkanbanD.md");
    assert_eq!(l.datei(), h().replace(AG, &format!("{AG}  ab: {{name: Anna B, kind: human}}\n")));
    let l = lage(&h());
    let (s, _) = l.anfrage(Method::PATCH, "api/personen/ag", "sh", json!({"aktiv": false})).await;
    assert_eq!((s, l.numstat()), (200, "1\t1\tkanbanD.md".into()));
    assert_eq!(l.datei(), h().replace(AG, "  ag: {name: Agent A, kind: agent, active: false}\n"));
    let l = lage(&h());
    assert_eq!(l.put("sh", signal_warten).await.0, 200);
    assert_eq!(l.numstat(), "2\t0\tkanbanD.md");
    assert_eq!(l.datei(), vor_schluss(&h(), "signals:\n  warten: {label: Warten, color: amber}\n"));
    assert_eq!(l.put("sh", |e| e["signale"] = json!([])).await.0, 200);
    assert_eq!((l.numstat(), l.datei()), ("0\t2\tkanbanD.md".into(), h()));
    let head = l.head();
    assert_eq!(l.put("sh", |_| {}).await, (200, json!({"geaendert": false})));
    assert_eq!(l.head(), head, "kein Commit");
}

#[tokio::test]
async fn ak3_crlf_und_bom_ueber_put() {
    let crlf = |t: &str| format!("\u{feff}{}", t.replace('\n', "\r\n"));
    let l = lage(&crlf(&h()));
    assert_eq!(l.put("sh", umbenennen).await.0, 200);
    assert_eq!((l.numstat(), l.datei()), ("1\t1\tkanbanD.md".into(), crlf(&h().replace(SH, SH_NEU))));
    assert_eq!(l.put("sh", signal_warten).await.0, 200);
    let t = l.datei();
    assert_eq!(l.numstat(), "2\t0\tkanbanD.md");
    assert_eq!((t.matches('\n').count(), t.starts_with('\u{feff}')), (t.matches("\r\n").count(), true));
}

// ---- AK 4, 5, 7 ----

#[tokio::test]
async fn ak4_alte_form_put_stellt_um_patch_laesst_stehen() {
    let altform = "sources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {name: kanbanD, wbs: /r/kd/Dokumentation/Planung/kanbanD.md, requirements: /r/kd/Anforderungen}\n";
    let alt = h().replace(QUELLEN, altform);
    let l = lage(&alt);
    assert_eq!(l.put("sh", umbenennen).await.0, 200);
    let block = frontmatter::abschnitt_lesen(&l.datei(), "sources").unwrap();
    assert!(block.contains("repository:") && !block.contains("wbs"), "{block}");
    assert_eq!(l.datei(), alt.replace(SH, SH_NEU).replace(altform, &format!("{block}\n")));
    let l = lage(&alt);
    assert_eq!(l.anfrage(Method::PATCH, "api/personen/sh", "sh", json!({"name": "Sven Hansen"})).await.0, 200);
    assert_eq!((l.numstat(), l.datei()), ("1\t1\tkanbanD.md".into(), alt.replace(SH, SH_NEU)));
}

#[tokio::test]
async fn ak5_schalter_hinter_sources_bleibt_dort() {
    let mit = vor_schluss(&h().replace(QUELLEN, "sources:\n  repository: \"\"\n  applications:\n    kd: {name: kanbanD, repository: /r/kd}\n"), "record-transcripts: true\n");
    let l = lage(&mit);
    assert_eq!(l.put("sh", |e| e["quellen"]["anwendungen"][0]["name"] = json!("kanbanD neu")).await.0, 200);
    assert_eq!((l.numstat(), l.datei()), ("1\t1\tkanbanD.md".into(), mit.replace("{name: kanbanD,", "{name: kanbanD neu,")));
    assert_eq!(l.put("sh", umbenennen).await.0, 200);
    assert_eq!(l.numstat(), "1\t1\tkanbanD.md");
    assert!(l.datei().contains("record-transcripts: true\n---\n"));
}

#[tokio::test]
async fn ak7_handform_in_classes_bleibt() {
    let text = h().replace(KLASSEN, "classes:\n  bug: {label: Fehler, color: red}\n  # Farbe abgestimmt\n");
    let l = lage(&text);
    assert_eq!(l.put("sh", umbenennen).await.0, 200);
    assert_eq!((l.numstat(), l.datei()), ("1\t1\tkanbanD.md".into(), text.replace(SH, SH_NEU)));
}

// ---- AK 6, 8: Verweigerung mit Wortlaut ----

#[tokio::test]
async fn ak6_handform_in_people_ueber_put_patch_delete() {
    let text = h().replace(SH, &format!("{SH}  # Vertretung\n"));
    let l = lage(&text);
    let head = l.head();
    l.verweigert(l.put("sh", umbenennen).await, "people", &head, &text);
    l.verweigert(l.anfrage(Method::PATCH, "api/personen/sh", "sh", json!({"name": "Sven Hansen"})).await, "people", &head, &text);
    l.verweigert(l.anfrage(Method::PATCH, "api/personen/ag", "sh", json!({"aktiv": false})).await, "people", &head, &text);
    l.verweigert(l.anfrage(Method::DELETE, "api/personen/ag", "sh", Value::Null).await, "people", &head, &text);
    for form in [h().replace(SH, "  sh:\n    {name: Sven, kind: human}\n"), h().replace("name: Sven,", "name: 'Sven',"), h().replace(SH, &format!("{SH}\n"))] {
        let l = lage(&form);
        let head = l.head();
        l.verweigert(l.put("sh", umbenennen).await, "people", &head, &form);
    }
    let beide = h().replace(KLASSEN, "classes:\n  bug: {label: Fehler, color: red}\n  # Farbe abgestimmt\n").replace(QUELLEN, "sources:\n  repository: \"\"  # leer\n");
    let l = lage(&beide);
    let head = l.head();
    let antwort = l
        .put("sh", |e| {
            e["klassen"][0]["bezeichnung"] = json!("Bug");
            e["quellen"]["repository"] = json!("/r/neu");
        })
        .await;
    l.verweigert(antwort, "classes", &head, &beide);
}

#[tokio::test]
async fn ak8_ruecklese_sicherung_auch_beim_schalter() {
    let text = h().replace("people:", "\"people\":");
    let l = lage(&text);
    let head = l.head();
    l.verweigert(l.put("sh", umbenennen).await, "people", &head, &text);
    let text = h().replace(QUELLEN, &format!("\"signals\": {{}}\n{QUELLEN}"));
    let l = lage(&text);
    let head = l.head();
    l.verweigert(l.put("sh", signal_warten).await, "signals", &head, &text);
    let text = vor_schluss(&h(), "\"record-transcripts\": false\n");
    let l = lage(&text);
    let head = l.head();
    l.verweigert(l.anfrage(Method::PUT, "api/einstellungen/transkripte", "sh", json!({"erfassen": true})).await, "record-transcripts", &head, &text);
}

// ---- AK 9: Kopien der sechs echten Bestände ----

const BESTAENDE: [&str; 6] = ["Entwicklungsprozess", "goaltreetoolA", "JoinPuyaApp", "kanbanD-Demo", "kanbanD", "localchatA"];

fn bestand(name: &str) -> String {
    std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join(format!("tests/altbestaende/kanbanD-md-2026-11-23/{name}.md"))).unwrap()
}

/// Die erste Personenzeile und ihr Kürzel.
fn erste_person(text: &str) -> (String, String) {
    let zeile = text.lines().skip_while(|z| *z != "people:").nth(1).unwrap().to_string();
    let kuerzel = zeile.trim().split(':').next().unwrap().to_string();
    (format!("{zeile}\n"), kuerzel)
}

#[tokio::test]
async fn ak9_sechs_bestaende_put_und_patch() {
    for name in BESTAENDE {
        let alt = bestand(name);
        let (zeile, kuerzel) = erste_person(&alt);
        let (vorname, neuname) = (zeile.split("name: ").nth(1).unwrap().split(',').next().unwrap().to_string(), "Mensch Neu".to_string());
        let neue_zeile = zeile.replace(&format!("name: {vorname},"), &format!("name: {neuname},"));
        let alter_block = format!("{}\n", frontmatter::abschnitt_lesen(&alt, "sources").unwrap());

        let l = lage(&alt);
        let (s, v) = l.put(&kuerzel, |e| e["personen"][0]["name"] = json!(neuname)).await;
        assert_eq!(s, 200, "{name}: PUT nie verweigert: {v}");
        let neu = l.datei();
        let block = format!("{}\n", frontmatter::abschnitt_lesen(&neu, "sources").unwrap());
        let neue_form = !block.contains("wbs") && !block.contains("requirements") && block.contains("repository:");
        assert!(block == alter_block || neue_form, "{name}: sources bleibt oder steht in neuer Form\n{block}");
        assert_eq!(neu, alt.replace(&zeile, &neue_zeile).replace(&alter_block, &block), "{name}: nur die Zeile der Person und der Block sources");
        if name == "kanbanD" {
            assert!(neu.contains("record-transcripts: true\n---\n"), "{name}: Schalter bleibt letzte Zeile des Frontmatters");
        }

        let l = lage(&alt);
        let (s, v) = l.anfrage(Method::PATCH, &format!("api/personen/{kuerzel}"), &kuerzel, json!({"name": neuname})).await;
        assert_eq!(s, 200, "{name}: PATCH: {v}");
        assert_eq!((l.numstat(), l.datei()), ("1\t1\tkanbanD.md".into(), alt.replace(&zeile, &neue_zeile)), "{name}: PATCH");
    }
}

// ---- AK 10: einstellungen::schreiben nur aus einrichten ----

#[test]
fn ak10_einstellungen_schreiben_nur_aus_einrichten() {
    let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut aufrufer = vec![];
    let mut ordner = vec![src.clone()];
    while let Some(o) = ordner.pop() {
        for eintrag in std::fs::read_dir(&o).unwrap().map(Result::unwrap) {
            let p = eintrag.path();
            if p.is_dir() {
                ordner.push(p);
            } else if p.extension().is_some_and(|e| e == "rs") {
                let text = std::fs::read_to_string(&p).unwrap();
                let ohne_tests = text.split("#[cfg(test)]").next().unwrap_or_default();
                if ohne_tests.contains("einstellungen::schreiben(") {
                    aufrufer.push(p.strip_prefix(&src).unwrap().display().to_string());
                }
            }
        }
    }
    assert_eq!(aufrufer, vec!["dienst/einrichten.rs".to_string()], "ADR-0043 Durchsetzung");
}
