//! R00250 (ADR-0043): jeder Schreibweg über `einstellungen_aendern` ändert in `kanbanD.md` nur die Zeilen, die sich ändern —
//! Dienst mit echtem Git, Ausgangslage Datei H (AK 1–8).
mod gemeinsam;

use gemeinsam::git;
use kanband::dienst::{Kanban, PersonAenderung, Personenangabe};
use kanband::fehler::Fehler;
use kanband::format::frontmatter;
use kanband::modell::{Art, Einstellungen, Person, Signal};
use std::path::PathBuf;

/// Die Zeilen, die `einrichten` für Ordner F schreibt (R00250 Ausgangslage), und der Standard-Textkörper.
const SH: &str = "  sh: {name: Sven, kind: human}\n";
const AG: &str = "  ag: {name: Agent A, kind: agent}\n";
const KLASSEN: &str = "classes:\n  bug: {label: Fehler, color: red}\n";
const QUELLEN: &str = "sources:\n  repository: \"\"\n";
const STANDARD_KOERPER: &str = "\n# kanbanD\n\nEinstellungen dieses Ordners: Personen (`people`), Klassen (`classes`), Signale (`signals`) und Quellpfade (`sources`).\nPersonen werden stillgelegt (`active: false`), nicht entfernt.\n";

/// So schreibt `einrichten` die Datei von F (Probe in `h_ist_einrichten_plus_vier_zusaetze`).
fn f_eingerichtet() -> String {
    format!("---\npeople:\n{SH}{AG}{KLASSEN}{QUELLEN}---\n{STANDARD_KOERPER}")
}

/// Datei H: F mit den vier Zusätzen von Hand.
fn h() -> String {
    format!("---\n# von Hand\neigener-schluessel: 1\npeople:\n{SH}{AG}# Klassen folgen\n{KLASSEN}{QUELLEN}---\n# Unser Ordner\n\nVon Hand geschrieben.\n")
}

fn wortlaut(schluessel: &str) -> Fehler {
    Fehler::Konflikt(format!("Nicht gespeichert: Der Abschnitt „{schluessel}“ in kanbanD.md ist von Hand gestaltet und lässt sich nicht zeilengenau ändern. Bitte die Änderung direkt in kanbanD.md eintragen."))
}

struct Lage {
    _tmp: tempfile::TempDir,
    pfad: PathBuf,
    k: Kanban,
}

/// Ordner mit `text` als `kanbanD.md`, als „von Hand“ committet.
fn lage(text: &str) -> Lage {
    let tmp = tempfile::tempdir().unwrap();
    let pfad = tmp.path().join("ordner");
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), text).unwrap();
    std::fs::write(pfad.join("boards/entwicklung.md"), "# Entwicklung\n\n## Offen\n\n## Erledigt\n").unwrap();
    git(&pfad, &["init", "-q"]);
    git(&pfad, &["add", "-A"]);
    git(&pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "von Hand"]);
    let k = Kanban::neu(pfad.clone());
    Lage { _tmp: tmp, pfad, k }
}

fn sh() -> Person {
    Person { kuerzel: "sh".into(), name: "Sven".into(), art: Art::Mensch, aktiv: true }
}

impl Lage {
    fn datei(&self) -> String {
        String::from_utf8(std::fs::read(self.pfad.join("kanbanD.md")).unwrap()).unwrap()
    }

    fn head(&self) -> String {
        git(&self.pfad, &["rev-parse", "HEAD"])
    }

    /// `git diff --numstat HEAD~1 HEAD -- kanbanD.md` als (entfernt, hinzugefügt).
    fn diff(&self) -> (u32, u32) {
        let z = git(&self.pfad, &["diff", "--numstat", "HEAD~1", "HEAD", "--", "kanbanD.md"]);
        let mut t = z.split_whitespace();
        let hinzu = t.next().unwrap().parse().unwrap();
        let weg = t.next().unwrap().parse().unwrap();
        (weg, hinzu)
    }

    /// Wie `GET /api/einstellungen` → ändern → `PUT`: die Antwortform als JSON, ohne die Lese-Rückfälle.
    fn put(&self, aendern: impl FnOnce(&mut Einstellungen)) -> Result<bool, Fehler> {
        let gelesen = self.k.zustand().unwrap().einstellungen.unwrap();
        let mut e: Einstellungen = serde_json::from_value(serde_json::to_value(gelesen).unwrap()).unwrap();
        aendern(&mut e);
        self.k.einstellungen_setzen(&sh(), e)
    }

    fn patch(&self, kuerzel: &str, a: PersonAenderung) -> Result<Person, Fehler> {
        self.k.person_aendern(&sh(), kuerzel, &a)
    }

    /// Nichts geschrieben: `HEAD` und Datei wie vorher.
    fn unveraendert(&self, head: &str, text: &str) {
        assert_eq!(self.head(), head, "kein Commit");
        assert_eq!(self.datei(), text, "Datei zeichengleich");
    }
}

fn umbenennen(e: &mut Einstellungen) {
    e.personen[0].name = "Sven Hansen".into();
}

fn name(n: &str) -> PersonAenderung {
    PersonAenderung { name: Some(n.into()), ..Default::default() }
}

fn stilllegen() -> PersonAenderung {
    PersonAenderung { aktiv: Some(false), ..Default::default() }
}

fn warten() -> Signal {
    Signal { schluessel: "warten".into(), bezeichnung: "Warten".into(), farbe: "amber".into() }
}

/// Fügt `zeilen` vor dem schließenden `---` des Frontmatters ein.
fn vor_schluss(text: &str, zeilen: &str) -> String {
    let i = text[4..].find("---\n").unwrap() + 4;
    format!("{}{zeilen}{}", &text[..i], &text[i..])
}

#[test]
fn h_ist_einrichten_plus_vier_zusaetze() {
    let e = kanband::format::einstellungen::lesen(&f_eingerichtet()).unwrap();
    assert_eq!(kanband::format::einstellungen::schreiben(&e), f_eingerichtet(), "F so, wie einrichten schreibt");
    assert_eq!(kanband::format::einstellungen::lesen(&h()).unwrap(), e, "H liest sich wie F");
}

// ---- AK 1: Probe der Karte ----

#[test]
fn ak1_umbenennen_aendert_genau_die_zeile_von_sh() {
    let l = lage(&h());
    assert_eq!(l.put(umbenennen), Ok(true));
    assert_eq!(l.diff(), (1, 1));
    assert_eq!(l.datei(), h().replace(SH, "  sh: {name: Sven Hansen, kind: human}\n"), "alles andere zeichengleich");
}

// ---- AK 2: jeder Schreibweg ändert nur seine Zeilen ----

#[test]
fn ak2_person_anlegen_neue_zeile_hinter_ag() {
    let l = lage(&h());
    l.k.person_anlegen(&sh(), &Personenangabe { kuerzel: "ab".into(), name: "Anna B".into(), art: Art::Mensch, aktiv: None }).unwrap();
    assert_eq!(l.diff(), (0, 1));
    assert_eq!(l.datei(), h().replace(AG, &format!("{AG}  ab: {{name: Anna B, kind: human}}\n")), "vor „# Klassen folgen“");
}

#[test]
fn ak2_stilllegen_aendert_die_zeile_von_ag() {
    let l = lage(&h());
    l.patch("ag", stilllegen()).unwrap();
    assert_eq!(l.diff(), (1, 1));
    assert_eq!(l.datei(), h().replace(AG, "  ag: {name: Agent A, kind: agent, active: false}\n"));
}

#[test]
fn ak2_erstes_signal_vor_dem_schluss_und_wieder_weg() {
    let l = lage(&h());
    assert_eq!(l.put(|e| e.signale.push(warten())), Ok(true));
    assert_eq!(l.diff(), (0, 2));
    assert_eq!(l.datei(), vor_schluss(&h(), "signals:\n  warten: {label: Warten, color: amber}\n"), "hinter sources (Regel 1)");
    assert_eq!(l.put(|e| e.signale.clear()), Ok(true));
    assert_eq!(l.diff(), (2, 0));
    assert_eq!(l.datei(), h(), "wieder zeichengleich mit H");
    let (head, text) = (l.head(), l.datei());
    assert_eq!(l.put(|_| {}), Ok(false), "unveränderter Rumpf");
    l.unveraendert(&head, &text);
}

// ---- AK 3: CRLF und BOM bleiben ----

fn crlf_bom(t: &str) -> String {
    format!("\u{feff}{}", t.replace('\n', "\r\n"))
}

fn zeilenenden_crlf(t: &str) {
    assert_eq!(t.matches('\n').count(), t.matches("\r\n").count(), "jede Zeile endet auf \\r\\n:\n{t:?}");
    assert!(t.starts_with('\u{feff}'), "BOM bleibt");
}

#[test]
fn ak3_crlf_und_bom_bleiben() {
    let l = lage(&crlf_bom(&h()));
    assert_eq!(l.put(umbenennen), Ok(true));
    assert_eq!(l.diff(), (1, 1));
    assert_eq!(l.datei(), crlf_bom(&h().replace(SH, "  sh: {name: Sven Hansen, kind: human}\n")));
    zeilenenden_crlf(&l.datei());
    let l = lage(&crlf_bom(&h()));
    assert_eq!(l.put(|e| e.signale.push(warten())), Ok(true));
    assert_eq!(l.diff(), (0, 2));
    assert_eq!(l.datei(), crlf_bom(&vor_schluss(&h(), "signals:\n  warten: {label: Warten, color: amber}\n")));
    zeilenenden_crlf(&l.datei());
}

#[test]
fn ak3_gegenprobe_lf_ohne_bom_bleibt_so() {
    let l = lage(&h());
    l.put(|e| e.signale.push(warten())).unwrap();
    let t = l.datei();
    assert!(!t.contains('\r') && !t.starts_with('\u{feff}'), "{t:?}");
}

// ---- AK 4: alte Form von sources ----

const ALTFORM: &str = "sources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {name: kanbanD, wbs: /r/kd/Dokumentation/Planung/kanbanD.md, requirements: /r/kd/Anforderungen}\n";

#[test]
fn ak4_put_stellt_sources_um_sonst_zeichengleich() {
    let alt = h().replace(QUELLEN, ALTFORM);
    let l = lage(&alt);
    assert_eq!(l.put(umbenennen), Ok(true));
    let t = l.datei();
    let block = frontmatter::abschnitt_lesen(&t, "sources").unwrap();
    assert!(block.contains("repository:") && !block.contains("wbs") && !block.contains("requirements"), "neue Form (ADR-0034 N2 Regel 2):\n{block}");
    let erwartet = alt.replace(SH, "  sh: {name: Sven Hansen, kind: human}\n").replace(ALTFORM, &format!("{block}\n"));
    assert_eq!(t, erwartet, "nur die Zeile von sh und der Block sources");
}

#[test]
fn ak4_patch_laesst_die_alte_form_stehen() {
    let alt = h().replace(QUELLEN, ALTFORM);
    let l = lage(&alt);
    l.patch("sh", name("Sven Hansen")).unwrap();
    assert_eq!(l.diff(), (1, 1));
    assert_eq!(l.datei(), alt.replace(SH, "  sh: {name: Sven Hansen, kind: human}\n"));
}

// ---- AK 5: record-transcripts hinter sources bleibt dort ----

const REGISTER: &str = "sources:\n  repository: \"\"\n  applications:\n    kd: {name: kanbanD, repository: /r/kd}\n";

#[test]
fn ak5_schalter_hinter_sources_bleibt_letzte_zeile() {
    let mit = vor_schluss(&h().replace(QUELLEN, REGISTER), "record-transcripts: true\n");
    let l = lage(&mit);
    assert_eq!(l.put(|e| e.quellen.anwendungen[0].name = "kanbanD neu".into()), Ok(true));
    assert_eq!(l.diff(), (1, 1));
    assert_eq!(l.datei(), mit.replace("{name: kanbanD,", "{name: kanbanD neu,"), "nur die Zeile im Block sources");
    assert_eq!(l.put(umbenennen), Ok(true));
    assert_eq!(l.diff(), (1, 1));
    assert!(l.datei().contains("record-transcripts: true\n---\n# Unser Ordner"), "letzte Zeile des Frontmatters:\n{}", l.datei());
}

// ---- AK 6: Handform im geänderten Abschnitt wird verweigert ----

#[test]
fn ak6_eingerueckter_kommentar_in_people_put_patch_stilllegen() {
    let text = h().replace(SH, &format!("{SH}  # Vertretung\n"));
    let l = lage(&text);
    let head = l.head();
    assert_eq!(l.put(umbenennen), Err(wortlaut("people")));
    l.unveraendert(&head, &text);
    assert_eq!(l.patch("sh", name("Sven Hansen")), Err(wortlaut("people")));
    l.unveraendert(&head, &text);
    assert_eq!(l.patch("ag", stilllegen()), Err(wortlaut("people")));
    l.unveraendert(&head, &text);
}

#[test]
fn ak6_formen_von_people() {
    for (fall, text) in [
        ("Blockform", h().replace(SH, "  sh:\n    {name: Sven, kind: human}\n")),
        ("eigene Anführung", h().replace("name: Sven,", "name: 'Sven',")),
        ("Leerzeile zwischen sh und ag", h().replace(SH, &format!("{SH}\n"))),
    ] {
        let l = lage(&text);
        let head = l.head();
        assert_eq!(l.put(umbenennen), Err(wortlaut("people")), "{fall}");
        l.unveraendert(&head, &text);
    }
}

#[test]
fn ak6_reihenfolge_classes_vor_sources() {
    let text = h().replace(KLASSEN, "classes:\n  bug: {label: Fehler, color: red}\n  # Farbe abgestimmt\n").replace(QUELLEN, "sources:\n  repository: \"\"  # leer\n");
    let l = lage(&text);
    let head = l.head();
    let ergebnis = l.put(|e| {
        e.klassen[0].bezeichnung = "Bug".into();
        e.quellen.repository = "/r/neu".into();
    });
    assert_eq!(ergebnis, Err(wortlaut("classes")));
    l.unveraendert(&head, &text);
}

// ---- AK 7: Handform bleibt, wo nichts geändert wird ----

#[test]
fn ak7_handform_in_classes_bleibt_beim_umbenennen() {
    let text = h().replace(KLASSEN, "classes:\n  bug: {label: Fehler, color: red}\n  # Farbe abgestimmt\n");
    let l = lage(&text);
    assert_eq!(l.put(umbenennen), Ok(true));
    assert_eq!(l.diff(), (1, 1));
    assert_eq!(l.datei(), text.replace(SH, "  sh: {name: Sven Hansen, kind: human}\n"));
}

// ---- AK 8: Rücklese-Sicherung ----

#[test]
fn ak8_people_zitiert() {
    let text = h().replace("people:", "\"people\":");
    let l = lage(&text);
    let head = l.head();
    assert_eq!(l.put(umbenennen), Err(wortlaut("people")));
    l.unveraendert(&head, &text);
}

/// Die Mutante „Rücklese-Prüfung entfernt“ (m2) macht genau diesen Fall rot: ohne Rücklesen stünde `signals` doppelt da.
#[test]
fn ak8_signals_zitiert_und_leer_scheitert_beim_ruecklesen() {
    let text = h().replace(QUELLEN, &format!("\"signals\": {{}}\n{QUELLEN}"));
    let l = lage(&text);
    let head = l.head();
    assert_eq!(l.put(|e| e.signale.push(warten())), Err(wortlaut("signals")));
    l.unveraendert(&head, &text);
}
