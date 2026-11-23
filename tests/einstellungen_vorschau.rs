//! R00250 Nacharbeit (ADR-0043 N1.3/N1.4, Regel 8): die Vorschau in „Einrichten“ ist ein Trockenlauf desselben
//! Schreibwegs wie `PUT /api/einstellungen` — Dienst mit echtem Git. V5 Gleichlauf, V6 ohne Änderung, V7 schreibt nichts.
mod gemeinsam;

use gemeinsam::git;
use kanband::dienst::{Einstellungsvorschau, Kanban};
use kanband::fehler::Fehler;
use kanband::modell::{Art, Einstellungen, Klasse, Person, Signal};
use std::path::{Path, PathBuf};

const SH: &str = "  sh: {name: Sven, kind: human}\n";
const AG: &str = "  ag: {name: Agent A, kind: agent}\n";
const KLASSEN: &str = "classes:\n  bug: {label: Fehler, color: red}\n";
const QUELLEN: &str = "sources:\n  repository: \"\"\n";

/// Datei H aus R00250 (Ausgangslage).
fn h() -> String {
    format!("---\n# von Hand\neigener-schluessel: 1\npeople:\n{SH}{AG}# Klassen folgen\n{KLASSEN}{QUELLEN}---\n# Unser Ordner\n\nVon Hand geschrieben.\n")
}

fn crlf_bom(t: &str) -> String {
    format!("\u{feff}{}", t.replace('\n', "\r\n"))
}

struct Lage {
    _tmp: tempfile::TempDir,
    pfad: PathBuf,
    k: Kanban,
}

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

fn mensch(kuerzel: &str) -> Person {
    Person { kuerzel: kuerzel.into(), name: "x".into(), art: Art::Mensch, aktiv: true }
}

impl Lage {
    fn datei(&self) -> String {
        String::from_utf8(std::fs::read(self.pfad.join("kanbanD.md")).unwrap()).unwrap()
    }

    fn head(&self) -> String {
        git(&self.pfad, &["rev-parse", "HEAD"])
    }

    /// Der Rumpf wie `GET /api/einstellungen` → ändern, als JSON-Rundlauf ohne die Lese-Rückfälle.
    fn entwurf(&self, aendern: &dyn Fn(&mut Einstellungen)) -> Einstellungen {
        let gelesen = self.k.zustand().unwrap().einstellungen.unwrap();
        let mut e: Einstellungen = serde_json::from_value(serde_json::to_value(gelesen).unwrap()).unwrap();
        aendern(&mut e);
        e
    }
}

/// V5: erst `vorschau`, dann `PUT` mit demselben Rumpf. 200: `text` byte-gleich mit der Datei danach und `geaendert`
/// gleich; Fehler: derselbe Fehler, nichts geschrieben.
fn gleichlauf(fall: &str, text: &str, wer: &Person, aendern: &dyn Fn(&mut Einstellungen)) -> Result<Einstellungsvorschau, Fehler> {
    let l = lage(text);
    let (head, vorher) = (l.head(), l.datei());
    let vorschau = l.k.einstellungen_vorschau(wer.art, l.entwurf(aendern));
    assert_eq!((l.head(), l.datei()), (head.clone(), vorher.clone()), "{fall}: die Vorschau schreibt nichts");
    let put = l.k.einstellungen_setzen(wer, l.entwurf(aendern));
    match &vorschau {
        Ok(v) => {
            assert_eq!(put, Ok(v.geaendert), "{fall}: geaendert wie PUT");
            assert_eq!(v.text, l.datei(), "{fall}: text byte-gleich mit der Datei nach PUT");
        }
        Err(f) => {
            assert_eq!(put.as_ref().err(), Some(f), "{fall}: derselbe Fehler wie PUT");
            assert_eq!((l.head(), l.datei()), (head, vorher), "{fall}: PUT schreibt auch nichts");
        }
    }
    vorschau
}

fn umbenennen(e: &mut Einstellungen) {
    e.personen[0].name = "Sven Hansen".into();
}

fn warten() -> Signal {
    Signal { schluessel: "warten".into(), bezeichnung: "Warten".into(), farbe: "amber".into() }
}

fn bestand(name: &str) -> String {
    std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join(format!("tests/altbestaende/kanbanD-md-2026-11-23/{name}.md"))).unwrap()
}

/// Das Kürzel der ersten Person eines Bestands.
fn erste_person(text: &str) -> String {
    let zeile = text.lines().skip_while(|z| *z != "people:").nth(1).unwrap();
    zeile.trim().split(':').next().unwrap().to_string()
}

fn handform(schluessel: &str) -> Fehler {
    Fehler::Konflikt(format!("Nicht gespeichert: Der Abschnitt „{schluessel}“ in kanbanD.md ist von Hand gestaltet und lässt sich nicht zeilengenau ändern. Bitte die Änderung direkt in kanbanD.md eintragen."))
}

#[test]
fn v5_gleichlauf_h_und_varianten() {
    let sh = mensch("sh");
    let v = gleichlauf("H", &h(), &sh, &umbenennen).unwrap();
    assert!(v.geaendert && v.text.contains("# von Hand") && v.text.contains("# Unser Ordner") && !v.text.contains("# kanbanD"), "H bleibt H: {}", v.text);
    let v = gleichlauf("H CRLF+BOM", &crlf_bom(&h()), &sh, &umbenennen).unwrap();
    assert!(v.text.starts_with('\u{feff}') && v.text.contains("Sven Hansen, kind: human}\r\n"), "BOM und CRLF im text");
    let gemischt = h().replace("# Unser Ordner\n\nVon Hand geschrieben.\n", "# Unser Ordner\r\n\r\nVon Hand geschrieben.\r\n");
    gleichlauf("gemischte Zeilenenden", &gemischt, &sh, &|e| {
        umbenennen(e);
        e.signale.push(warten());
    })
    .unwrap();
    let leer = h().replace(QUELLEN, &format!("signals: {{}}\n{QUELLEN}"));
    assert!(gleichlauf("signals: {}", &leer, &sh, &|e| e.signale.push(warten())).unwrap().geaendert);
    let hand_people = h().replace(SH, &format!("{SH}  # Vertretung\n"));
    assert_eq!(gleichlauf("Handform people", &hand_people, &sh, &umbenennen).err(), Some(handform("people")));
    let hand_classes = h().replace(KLASSEN, "classes:\n  # Farbe abgestimmt\n  bug: {label: Fehler, color: red}\n");
    assert!(gleichlauf("Handform classes, Änderung an sh", &hand_classes, &sh, &umbenennen).unwrap().geaendert);
    let zitiert = h().replace(QUELLEN, &format!("\"signals\": {{}}\n{QUELLEN}"));
    assert_eq!(gleichlauf("\"signals\": {} zitiert (Rücklesen)", &zitiert, &sh, &|e| e.signale.push(warten())).err(), Some(handform("signals")));
    let doppelt = gleichlauf("Kürzel doppelt", &h(), &sh, &|e| e.personen.push(Person { kuerzel: "sh".into(), name: "Zweiter".into(), art: Art::Mensch, aktiv: true }));
    assert!(matches!(doppelt, Err(Fehler::Ungueltig(_))), "{doppelt:?}");
    let agent = Person { kuerzel: "ag".into(), name: "Agent A".into(), art: Art::Agent, aktiv: true };
    assert!(matches!(gleichlauf("Agent legt Mensch still", &h(), &agent, &|e| e.personen[0].aktiv = false), Err(Fehler::PersonenartVerboten { .. })));
    let neue_klasse = |e: &mut Einstellungen| e.klassen.push(Klasse { schluessel: "neu".into(), bezeichnung: "Neu".into(), farbe: "blue".into() });
    assert!(gleichlauf("neue Klasse", &h(), &sh, &neue_klasse).unwrap().geaendert);
}

/// V5 mit den sechs Beständen: unverändert (nur die Registerumstellung, Mutant „Stehenlassen“) und erste Person umbenannt.
#[test]
fn v5_gleichlauf_sechs_bestaende() {
    for name in ["bestand-a", "bestand-b", "bestand-c", "bestand-d", "bestand-e", "bestand-f"] {
        let text = bestand(name);
        let wer = mensch(&erste_person(&text));
        let v = gleichlauf(&format!("{name} unverändert"), &text, &wer, &|_| {}).unwrap();
        assert_eq!(v.geaendert, text.contains("applications:"), "{name}: umgestellt wird nur ein Register mit Anwendung");
        gleichlauf(&format!("{name} umbenannt"), &text, &wer, &|e| e.personen[0].name = "Mensch Neu".into()).unwrap();
    }
}

/// V6: ohne Änderung → `geaendert: false`, `text` = Datei byte-gleich (auch mit BOM und CRLF).
#[test]
fn v6_ohne_aenderung_die_heutige_datei() {
    for text in [h(), crlf_bom(&h())] {
        let l = lage(&text);
        let v = l.k.einstellungen_vorschau(Art::Mensch, l.entwurf(&|_| {})).unwrap();
        assert_eq!(v, Einstellungsvorschau { text: text.clone(), geaendert: false });
    }
}

/// V7: 20 Vorschauen mit Änderung, Handform und ungültigem Entwurf schreiben nichts — `HEAD`, `git status`, Bytes und
/// `mtime` von `kanbanD.md` gleich, keine Temporärdatei.
#[test]
fn v7_schreibt_nichts() {
    let text = h().replace(SH, &format!("{SH}  # Vertretung\n"));
    let l = lage(&text);
    let mtime = || std::fs::metadata(l.pfad.join("kanbanD.md")).unwrap().modified().unwrap();
    let (head, vorher) = (l.head(), mtime());
    let mut ergebnisse = vec![];
    for i in 0..20 {
        let entwurf = match i % 3 {
            0 => l.entwurf(&umbenennen),
            1 => l.entwurf(&|e| e.signale.push(warten())),
            _ => l.entwurf(&|e| e.personen[0].kuerzel = "UNGÜLTIG".into()),
        };
        ergebnisse.push(l.k.einstellungen_vorschau(Art::Mensch, entwurf).map(|v| v.geaendert));
    }
    assert_eq!(ergebnisse[0], Err(handform("people")), "Handform");
    assert_eq!(ergebnisse[1], Ok(true), "Signal: people bleibt unberührt, also keine Verweigerung");
    assert!(matches!(ergebnisse[2], Err(Fehler::Ungueltig(_))), "ungültiges Kürzel: {:?}", ergebnisse[2]);
    assert_eq!(l.head(), head, "kein Commit");
    assert_eq!(git(&l.pfad, &["status", "--porcelain"]), "", "nichts im Arbeitsbaum");
    assert_eq!((l.datei(), mtime()), (text, vorher), "Bytes und mtime gleich");
    let tmp = std::fs::read_dir(&l.pfad).unwrap().filter(|e| e.as_ref().unwrap().file_name().to_string_lossy().contains("kanbanD-tmp")).count();
    assert_eq!(tmp, 0, "keine Temporärdatei");
}
