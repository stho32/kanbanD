//! R00220 (ADR-0036 Nachtrag „Umschalten“): „Transkripte erfassen“ umschalten — Dienst und Routen (AK 1–4, US-1..US-3).
mod gemeinsam;

use gemeinsam::{git, lies};
use kanband::dienst::{Kanban, Schalterantwort};
use kanband::fehler::Fehler;
use kanband::modell::{Art, Person};
use std::path::{Path, PathBuf};

/// Das Board mit dem Namen aus 60 Zeichen (R00220 Ausgangslage): ein Slug hat höchstens 40 Zeichen, der Name ist der Titel.
const LANG: &str = "lang";
const LANGER_NAME: &str = "zweites-board-mit-einem-sehr-langen-namen-aus-sechzig-zeiche";
const EINSTELLUNGEN: &str = "---\npeople:\n  sh: {name: Stefan, kind: human}\n  entw1: {name: Entwickler, kind: agent}\nclasses: {}\nsources:\n  wbs: plan/wbs.md\n  requirements: anf/\n---\n";

/// Die Ausgangslage von R00220: Vorgabe ohne Schlüssel (also „aus“), `fabrik` mit `record-transcripts: true`, `zweit`
/// und das Board mit 60 Zeichen ohne Schlüssel. Die Dateien stehen in der Form, die kanbanD selbst schreibt — so zeigt
/// der Diff eines Umschaltens, ob wirklich nur der Schlüssel dazukommt.
fn ausgangslage(pfad: &Path) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    let e = kanband::format::einstellungen::lesen(EINSTELLUNGEN).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), kanband::format::einstellungen::schreiben(&e)).unwrap();
    for (slug, titel, kopf) in [("fabrik", "fabrik", "---\nrecord-transcripts: true\n---\n\n"), ("zweit", "zweit", ""), (LANG, LANGER_NAME, "")] {
        let roh = format!("{kopf}# {titel}\n\n## Eingang\n\n## Fertig\n");
        let b = kanband::format::board::lesen(slug, &roh).unwrap();
        std::fs::write(pfad.join(format!("boards/{slug}.md")), kanband::format::board::schreiben(&b, |_| None)).unwrap();
    }
    git(pfad, &["init", "-q"]);
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgangslage"]);
}

fn mensch() -> Person {
    Person { kuerzel: "sh".into(), name: "Stefan".into(), art: Art::Mensch, aktiv: true }
}

fn agent() -> Person {
    Person { kuerzel: "entw1".into(), name: "Entwickler".into(), art: Art::Agent, aktiv: true }
}

fn commits(pfad: &Path) -> u32 {
    git(pfad, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

/// Ein Commit mehr, und er nennt genau diese eine Datei.
fn ein_commit_an(pfad: &Path, vorher: u32, datei: &str) {
    assert_eq!(commits(pfad), vorher + 1, "genau ein Commit");
    assert_eq!(git(pfad, &["show", "--name-only", "--format=", "HEAD"]), datei, "genau eine Datei");
}

/// Die geänderten Zeilen des letzten Commits ohne Kopf: nur der Schlüssel und, wo der Frontmatter neu entsteht oder
/// verschwindet, sein Rahmen.
fn nur_der_schluessel_geaendert(pfad: &Path) {
    let diff = git(pfad, &["show", "-U0", "--format=", "HEAD"]);
    let geaendert: Vec<&str> = diff.lines().filter(|z| (z.starts_with('+') || z.starts_with('-')) && !z.starts_with("+++") && !z.starts_with("---")).collect();
    assert!(!geaendert.is_empty(), "{diff}");
    for z in &geaendert {
        let inhalt = &z[1..];
        assert!(inhalt.starts_with("record-transcripts: ") || inhalt == "---" || inhalt.is_empty(), "fremde Zeile im Diff: {z:?}\n{diff}");
    }
}

struct Lage {
    _tmp: tempfile::TempDir,
    pfad: PathBuf,
    kanban: Kanban,
}

fn lage() -> Lage {
    let tmp = tempfile::tempdir().unwrap();
    let pfad = tmp.path().join("ordner");
    ausgangslage(&pfad);
    let kanban = Kanban::neu(pfad.clone());
    Lage { _tmp: tmp, pfad, kanban }
}

fn antwort(erfassen: Option<bool>, wirksam: bool) -> Schalterantwort {
    Schalterantwort { erfassen, wirksam }
}

// ---- B1133 Dienst ----

/// AK 1 / US-1 (Dienst): `true` schreibt den Schlüssel, gleicher Wert committet nicht, `None` entfernt ihn wieder.
#[test]
fn dienst_board_an_und_wie_vorgabe() {
    let l = lage();
    let vorher = commits(&l.pfad);
    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), "zweit", Some(true)).unwrap(), (true, antwort(Some(true), true)));
    ein_commit_an(&l.pfad, vorher, "boards/zweit.md");
    nur_der_schluessel_geaendert(&l.pfad);
    assert!(lies(&l.pfad, "boards/zweit.md").contains("\nrecord-transcripts: true\n"));
    assert_eq!(git(&l.pfad, &["log", "-1", "--format=%an|%s"]), "Stefan|Transkripte auf „zweit“: an");

    let datei = lies(&l.pfad, "boards/zweit.md");
    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), "zweit", Some(true)).unwrap(), (false, antwort(Some(true), true)));
    assert_eq!((commits(&l.pfad), lies(&l.pfad, "boards/zweit.md")), (vorher + 1, datei), "gleicher Wert: kein Commit, zeichengleich");

    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), "zweit", None).unwrap(), (true, antwort(None, false)));
    ein_commit_an(&l.pfad, vorher + 1, "boards/zweit.md");
    nur_der_schluessel_geaendert(&l.pfad);
    assert!(!lies(&l.pfad, "boards/zweit.md").contains("record-transcripts"));
    assert_eq!(git(&l.pfad, &["log", "-1", "--format=%s"]), "Transkripte auf „zweit“: wie Vorgabe");
    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), "zweit", None).unwrap(), (false, antwort(None, false)));
    assert_eq!(commits(&l.pfad), vorher + 2);
}

/// `false` am Board wird ausdrücklich geschrieben, auch wenn die Vorgabe schon „aus“ ist; `wirksam` folgt der Vorgabe bei `None`.
#[test]
fn dienst_board_aus_ausdruecklich_und_wirksam_nach_vorgabe() {
    let l = lage();
    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), "fabrik", Some(false)).unwrap(), (true, antwort(Some(false), false)));
    assert!(lies(&l.pfad, "boards/fabrik.md").contains("\nrecord-transcripts: false\n"));
    assert_eq!(git(&l.pfad, &["log", "-1", "--format=%s"]), "Transkripte auf „fabrik“: aus");
    l.kanban.vorgabe_transkripte_setzen(&mensch(), true).unwrap();
    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), LANG, None).unwrap(), (false, antwort(None, true)), "wie Vorgabe, die jetzt an ist");
    assert_eq!(l.kanban.board_transkripte_setzen(&mensch(), "fabrik", None).unwrap(), (true, antwort(None, true)));
}

/// AK 2 / US-1 (Dienst): verglichen wird der wirksame Wert — „aus“ ohne Schlüssel ändert nichts; danach ausdrücklich.
#[test]
fn dienst_vorgabe_vergleicht_den_wirksamen_wert() {
    let l = lage();
    let (vorher, datei) = (commits(&l.pfad), lies(&l.pfad, "kanbanD.md"));
    assert_eq!(l.kanban.vorgabe_transkripte_setzen(&mensch(), false).unwrap(), (false, antwort(Some(false), false)));
    assert_eq!((commits(&l.pfad), lies(&l.pfad, "kanbanD.md")), (vorher, datei), "fehlt der Schlüssel, ist „aus“ schon wirksam");

    assert_eq!(l.kanban.vorgabe_transkripte_setzen(&mensch(), true).unwrap(), (true, antwort(Some(true), true)));
    ein_commit_an(&l.pfad, vorher, "kanbanD.md");
    nur_der_schluessel_geaendert(&l.pfad);
    assert!(lies(&l.pfad, "kanbanD.md").contains("\nrecord-transcripts: true\n"));
    assert_eq!(git(&l.pfad, &["log", "-1", "--format=%an|%s"]), "Stefan|Transkripte, Vorgabe des Ordners: an");

    assert_eq!(l.kanban.vorgabe_transkripte_setzen(&mensch(), false).unwrap(), (true, antwort(Some(false), false)));
    ein_commit_an(&l.pfad, vorher + 1, "kanbanD.md");
    assert!(lies(&l.pfad, "kanbanD.md").contains("\nrecord-transcripts: false\n"), "ausdrücklich geschrieben");
    assert_eq!(git(&l.pfad, &["log", "-1", "--format=%s"]), "Transkripte, Vorgabe des Ordners: aus");
    assert_eq!(l.kanban.vorgabe_transkripte_setzen(&mensch(), false).unwrap(), (false, antwort(Some(false), false)));
    assert_eq!(commits(&l.pfad), vorher + 2);
}

/// AK 3 / US-2 (Dienst): ein Agent bekommt immer 403 mit `einstellung`, auch bei gleichem Wert und unbekanntem Board.
#[test]
fn dienst_agent_schaltet_nie() {
    let l = lage();
    let (vorher, fabrik, vorgabe) = (commits(&l.pfad), lies(&l.pfad, "boards/fabrik.md"), lies(&l.pfad, "kanbanD.md"));
    let erwartet = "Den Schalter „Transkripte erfassen“ stellen nur Menschen um";
    for f in [
        l.kanban.board_transkripte_setzen(&agent(), "fabrik", Some(true)).unwrap_err(),
        l.kanban.board_transkripte_setzen(&agent(), "fabrik", Some(false)).unwrap_err(),
        l.kanban.board_transkripte_setzen(&agent(), "gibtsnicht", Some(true)).unwrap_err(),
        l.kanban.vorgabe_transkripte_setzen(&agent(), true).unwrap_err(),
        l.kanban.vorgabe_transkripte_setzen(&agent(), false).unwrap_err(),
    ] {
        assert!(matches!(&f, Fehler::SchalterVerboten { .. }), "{f:?}");
        assert_eq!(f.meldung(), erwartet);
    }
    assert_eq!((commits(&l.pfad), lies(&l.pfad, "boards/fabrik.md"), lies(&l.pfad, "kanbanD.md")), (vorher, fabrik, vorgabe));
}

/// Ein unbekanntes Board ergibt für einen Menschen 404, ohne Commit.
#[test]
fn dienst_unbekanntes_board() {
    let l = lage();
    let vorher = commits(&l.pfad);
    assert!(matches!(l.kanban.board_transkripte_setzen(&mensch(), "gibtsnicht", Some(true)), Err(Fehler::NichtGefunden(_))));
    assert_eq!(commits(&l.pfad), vorher);
}

