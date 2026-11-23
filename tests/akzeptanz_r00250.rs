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

const BESTAENDE: [&str; 6] = ["bestand-a", "bestand-b", "bestand-c", "bestand-d", "bestand-e", "bestand-f"];

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
        if name == "bestand-e" {
            assert!(neu.contains("record-transcripts: true\n---\n"), "{name}: Schalter bleibt letzte Zeile des Frontmatters");
        }

        let l = lage(&alt);
        let (s, v) = l.anfrage(Method::PATCH, &format!("api/personen/{kuerzel}"), &kuerzel, json!({"name": neuname})).await;
        assert_eq!(s, 200, "{name}: PATCH: {v}");
        assert_eq!((l.numstat(), l.datei()), ("1\t1\tkanbanD.md".into(), alt.replace(&zeile, &neue_zeile)), "{name}: PATCH");
    }
}

/// R00250 Nacharbeit (PO Z. 687, Sollte 4 des legacy-reviewer): `GET` → `PUT` mit unveränderten Werten ergibt je Bestand
/// genau den Diff der Registerumstellung (ADR-0034 N2 Regel 2) und sonst nichts — gemessen am Original vom
/// legacy-reviewer (`leg-248/drive-orig.txt`): ohne Anwendungen kein Commit, mit einer Anwendung `2 3` (`wbs`/`requirements`
/// → `repository`, die Zeile der Anwendung in neuer Form; der Pfad ist der Ordner der WBS).
#[tokio::test]
async fn nacharbeit_unveraendertes_put_nur_die_registerumstellung() {
    let erwartet: [(&str, Option<(&str, &str)>); 6] = [
        ("bestand-a", None),
        ("bestand-b", Some(("bb", "/home/nutzer/projekte/beispiel-b/Dokumentation/Planung"))),
        ("bestand-c", Some(("bc", "/home/nutzer/projekte/beispiel-c/Documentation/Planning"))),
        ("bestand-d", None),
        ("bestand-e", Some(("be", "/home/nutzer/projekte/beispiel-e/Dokumentation/Planung"))),
        ("bestand-f", Some(("bf", "/home/nutzer/projekte/beispiel-f/Dokumentation/Planung"))),
    ];
    for (name, umstellung) in erwartet {
        let alt = bestand(name);
        let l = lage(&alt);
        let head = l.head();
        let (_, wer) = erste_person(&alt);
        let (s, v) = l.put(&wer, |_| {}).await;
        let Some((kuerzel, repository)) = umstellung else {
            assert_eq!((s, v), (200, json!({"geaendert": false})), "{name}");
            assert_eq!((l.head(), l.datei()), (head, alt), "{name}: kein Commit, Datei zeichengleich");
            continue;
        };
        assert_eq!((s, v), (200, json!({"geaendert": true})), "{name}");
        let alter_block = frontmatter::abschnitt_lesen(&alt, "sources").unwrap();
        let app = alter_block.lines().last().unwrap();
        let app_name = app.split("name: ").nth(1).unwrap().split(',').next().unwrap();
        let neuer_block = format!("sources:\n  repository: \"\"\n  applications:\n    {kuerzel}: {{name: {app_name}, repository: {repository}}}");
        assert_eq!(l.numstat(), "2\t3\tkanbanD.md", "{name}");
        assert_eq!(l.datei(), alt.replace(&alter_block, &neuer_block), "{name}: nur der Block sources");
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

// ---- Nacharbeit (ADR-0043 N1): POST /api/einstellungen/vorschau im gestarteten Programm ----

fn crlf_bom(t: &str) -> String {
    format!("\u{feff}{}", t.replace('\n', "\r\n"))
}

impl Lage {
    /// `GET /api/einstellungen` → `aendern` → der Rumpf.
    async fn rumpf(&self, aendern: impl FnOnce(&mut Value)) -> Value {
        let (_, mut e) = self.anfrage(Method::GET, "api/einstellungen", "sh", Value::Null).await;
        aendern(&mut e);
        e
    }

    async fn vorschau(&self, wer: Option<&str>, rumpf: &Value) -> (u16, Value) {
        let mut anfrage = reqwest::Client::new().post(format!("{}api/einstellungen/vorschau", self.lauf.adresse)).json(rumpf);
        if let Some(wer) = wer {
            anfrage = anfrage.header("X-KanbanD-Wer", wer);
        }
        let r = anfrage.send().await.unwrap();
        let status = r.status().as_u16();
        assert!(r.headers()["content-type"].to_str().unwrap().starts_with("application/json"), "JSON wie alle Antworten");
        (status, serde_json::from_str(&r.text().await.unwrap()).unwrap_or(Value::Null))
    }

    /// V5 über HTTP: `vorschau`, dann `PUT` mit demselben Rumpf — 200: `text` byte-gleich mit der Datei danach;
    /// sonst gleicher Status und gleiches `fehler`, nichts geschrieben.
    async fn gleichlauf(&self, fall: &str, wer: &str, rumpf: Value) -> (u16, Value) {
        let (head, vorher) = (self.head(), self.datei());
        let (s, v) = self.vorschau(Some(wer), &rumpf).await;
        assert_eq!((self.head(), self.datei()), (head.clone(), vorher.clone()), "{fall}: Vorschau schreibt nichts");
        let (ps, pv) = self.anfrage(Method::PUT, "api/einstellungen", wer, rumpf).await;
        if s == 200 {
            assert_eq!((ps, &pv["geaendert"]), (200, &v["geaendert"]), "{fall}: geaendert wie PUT");
            assert_eq!(v["text"].as_str().unwrap(), self.datei(), "{fall}: text byte-gleich mit der Datei nach PUT");
        } else {
            assert_eq!((ps, &pv), (s, &v), "{fall}: gleicher Status und gleiches fehler wie PUT");
            assert_eq!((self.head(), self.datei()), (head, vorher), "{fall}: nichts geschrieben");
        }
        (s, v)
    }
}

/// V1/V2 über HTTP (Abnahme des PO): H und H in CRLF mit BOM, `sh` umbenannt → `text` = Datei nach `PUT`, BOM und CRLF.
#[tokio::test]
async fn n1_v2_vorschau_gleich_der_datei_nach_put() {
    for text in [h(), crlf_bom(&h())] {
        let l = lage(&text);
        let rumpf = l.rumpf(umbenennen).await;
        let (s, v) = l.gleichlauf("H", "sh", rumpf).await;
        assert_eq!((s, &v["geaendert"]), (200, &json!(true)));
        let t = v["text"].as_str().unwrap();
        assert!(t.contains("# von Hand") && t.contains("eigener-schluessel: 1") && t.contains("# Klassen folgen") && t.contains("# Unser Ordner") && !t.contains("# kanbanD"), "{t}");
        assert_eq!(t.starts_with('\u{feff}'), text.starts_with('\u{feff}'), "BOM wie die Datei");
    }
}

/// V4/V5 über HTTP: Handform → 409 mit dem Wortlaut, Kürzel doppelt → 400, beide wie `PUT`; ohne Änderung → `geaendert: false`.
#[tokio::test]
async fn n1_v5_gleichlauf_fehler_und_ohne_aenderung() {
    let hand = h().replace(SH, &format!("{SH}  # Vertretung\n"));
    let l = lage(&hand);
    let rumpf = l.rumpf(umbenennen).await;
    assert_eq!(l.gleichlauf("Handform", "sh", rumpf).await, (409, json!({"fehler": wortlaut("people")})));
    let l = lage(&h());
    let rumpf = l.rumpf(|e| e["personen"].as_array_mut().unwrap().push(json!({"kuerzel": "sh", "name": "Zweiter", "art": "human", "aktiv": true}))).await;
    let (s, v) = l.gleichlauf("Kürzel doppelt", "sh", rumpf).await;
    assert_eq!(s, 400, "{v}");
    let rumpf = l.rumpf(|_| {}).await;
    assert_eq!(l.vorschau(Some("sh"), &rumpf).await, (200, json!({"text": h(), "geaendert": false})), "V6");
    let l = lage(&bestand("bestand-b"));
    let rumpf = l.rumpf(|_| {}).await;
    assert_eq!(l.gleichlauf("bestand-b unverändert", "sh", rumpf).await.1["geaendert"], json!(true), "Registerumstellung wie PUT");
}

/// V7 über HTTP: 20 Vorschauen (Änderung, Handform, ungültig) — kein Commit, Arbeitsbaum sauber, Bytes und mtime gleich.
#[tokio::test]
async fn n1_v7_vorschau_schreibt_nichts() {
    let text = h().replace(SH, &format!("{SH}  # Vertretung\n"));
    let l = lage(&text);
    let mtime = || std::fs::metadata(l.pfad.join("kanbanD.md")).unwrap().modified().unwrap();
    let (head, vorher) = (l.head(), mtime());
    let rumpfe = [l.rumpf(umbenennen).await, l.rumpf(signal_warten).await, json!({"personen": "kein Satz"})];
    let mut status = vec![];
    for i in 0..20 {
        status.push(l.vorschau(Some("sh"), &rumpfe[i % 3]).await.0);
    }
    assert_eq!((status[0], status[1]), (409, 200), "Handform, Signal");
    assert!((400..500).contains(&status[2]), "ungültiger Rumpf: {}", status[2]);
    assert_eq!(l.head(), head, "kein Commit");
    assert_eq!(git(&l.pfad, &["status", "--porcelain"]), "", "Arbeitsbaum sauber");
    assert_eq!((l.datei(), mtime()), (text, vorher), "Bytes und mtime gleich");
}

/// V8: Rechte wie `PUT` — Agent legt einen Menschen still → 403 `{fehler, kuerzel}`; ohne Header gerechnet wie ein
/// Mensch → 200; unbekannte Person → 400.
#[tokio::test]
async fn n1_v8_rechte_wie_put() {
    let l = lage(&h());
    let still = l.rumpf(|e| e["personen"][0]["aktiv"] = json!(false)).await;
    let (s, v) = l.gleichlauf("Agent", "ag", still.clone()).await;
    assert_eq!((s, &v["kuerzel"]), (403, &json!("sh")), "{v}");
    assert_eq!(l.vorschau(None, &still).await.0, 200, "ohne Header wie ein Mensch");
    let (s, v) = l.gleichlauf("unbekannt", "xx", still).await;
    assert_eq!(s, 400, "{v}");
}

/// V9: Pfade im Rumpf sind nur Text — `/etc`, `../../x` und ein FIFO im Ordner werden nicht geöffnet (ein Öffnen des FIFO
/// bliebe hängen); die Antwort kommt in normaler Zeit.
#[tokio::test]
async fn n1_v9_pfade_werden_nicht_geoeffnet() {
    let l = lage(&h());
    let fifo = l.pfad.join("fifo");
    assert!(std::process::Command::new("mkfifo").arg(&fifo).status().unwrap().success());
    for pfad in ["/etc", "../../x", fifo.to_str().unwrap()] {
        let rumpf = l.rumpf(|e| e["quellen"]["repository"] = json!(pfad)).await;
        let antwort = tokio::time::timeout(std::time::Duration::from_secs(5), l.vorschau(Some("sh"), &rumpf)).await.expect("Antwort in normaler Zeit");
        assert_eq!(antwort.0, 200, "{pfad}: {}", antwort.1);
        assert!(antwort.1["text"].as_str().unwrap().contains(pfad), "{pfad}: {}", antwort.1["text"]);
    }
}

/// V14: OpenAPI und Endpunktliste nennen den Trockenlauf; `wer: false`.
#[tokio::test]
async fn n1_v14_openapi_und_endpunkte() {
    let l = lage(&h());
    let (_, d) = l.anfrage(Method::GET, "api/openapi.json", "sh", Value::Null).await;
    let post = &d["paths"]["/api/einstellungen/vorschau"]["post"];
    assert_eq!(post["requestBody"]["content"]["application/json"]["schema"]["$ref"], json!("#/components/schemas/Einstellungen"), "{post}");
    assert_eq!(post["responses"]["200"]["content"]["application/json"]["schema"]["$ref"], json!("#/components/schemas/Einstellungsvorschau"));
    assert!(d["components"]["schemas"]["Einstellungsvorschau"]["properties"]["text"].is_object());
    assert!(post["description"].as_str().unwrap().contains("Trockenlauf von PUT /api/einstellungen"));
    let e = kanband::web::endpunkte::ENDPUNKTE.iter().find(|e| e.methode == "POST" && e.pfad == "/api/einstellungen/vorschau").expect("in der Endpunktliste");
    assert!(!e.wer, "X-KanbanD-Wer optional");
    assert_eq!(e.zweck, post["description"].as_str().unwrap(), "derselbe Text");
}
