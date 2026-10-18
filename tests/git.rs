mod gemeinsam;

use gemeinsam::git;
use kanband::git::committen;
use kanband::modell::{Art, Person};

fn stefan() -> Person {
    Person { kuerzel: "st".into(), name: "Stefan Hoffmann".into(), art: Art::Mensch, aktiv: true }
}

fn repo() -> tempfile::TempDir {
    let t = tempfile::tempdir().unwrap();
    git(t.path(), &["init", "-q"]);
    t
}

#[test]
fn commit_traegt_die_person_als_autor_und_nur_die_genannten_pfade() {
    let t = repo();
    std::fs::write(t.path().join("a.md"), "a").unwrap();
    std::fs::write(t.path().join("fremd.md"), "f").unwrap();
    assert!(committen(t.path(), &["a.md".into()], &stefan(), "a angelegt").unwrap());
    assert_eq!(git(t.path(), &["log", "-1", "--format=%an <%ae>|%s"]), "Stefan Hoffmann <st@kanbanD>|a angelegt");
    assert_eq!(git(t.path(), &["show", "--name-only", "--format=", "HEAD"]), "a.md");
    assert_eq!(git(t.path(), &["status", "--porcelain"]), "?? fremd.md");
}

#[test]
fn bereits_gestagte_fremde_aenderung_bleibt_im_index_und_nicht_im_commit() {
    let t = repo();
    std::fs::write(t.path().join("x.md"), "x").unwrap();
    git(t.path(), &["add", "x.md"]);
    std::fs::write(t.path().join("a.md"), "a").unwrap();
    committen(t.path(), &["a.md".into()], &stefan(), "a").unwrap();
    assert_eq!(git(t.path(), &["show", "--name-only", "--format=", "HEAD"]), "a.md");
    assert_eq!(git(t.path(), &["status", "--porcelain"]), "A  x.md");
}

#[test]
fn geloeschte_datei_wird_als_loeschung_committet_und_ohne_aenderung_entsteht_kein_commit() {
    let t = repo();
    std::fs::write(t.path().join("a.md"), "a").unwrap();
    committen(t.path(), &["a.md".into()], &stefan(), "an").unwrap();
    std::fs::remove_file(t.path().join("a.md")).unwrap();
    assert!(committen(t.path(), &["a.md".into()], &stefan(), "weg").unwrap());
    assert_eq!(git(t.path(), &["show", "--name-status", "--format=", "HEAD"]), "D\ta.md");
    assert!(!committen(t.path(), &["a.md".into()], &stefan(), "nichts").unwrap());
    assert_eq!(git(t.path(), &["rev-list", "--count", "HEAD"]), "2");
}

#[test]
fn unterordner_eines_repositories_committet_relativ_zum_unterordner() {
    let t = repo();
    let k = t.path().join("kanban");
    std::fs::create_dir_all(k.join("boards")).unwrap();
    std::fs::write(k.join("boards/b.md"), "# B").unwrap();
    committen(&k, &["boards/b.md".into()], &stefan(), "b").unwrap();
    assert_eq!(git(t.path(), &["show", "--name-only", "--format=", "HEAD"]), "kanban/boards/b.md");
}

#[test]
fn ohne_repository_ist_es_ein_interner_fehler() {
    let t = tempfile::tempdir().unwrap();
    std::fs::write(t.path().join("a.md"), "a").unwrap();
    let f = committen(t.path(), &["a.md".into()], &stefan(), "a").unwrap_err();
    assert!(f.meldung().starts_with("git ls-files"), "{f}");
}

#[test]
fn geaendert_bis_zum_commit_auch_gestagt_und_neu() {
    use kanband::git::geaendert;
    let t = repo();
    let datei = t.path().join("plan").join("wbs.md");
    std::fs::create_dir_all(datei.parent().unwrap()).unwrap();
    std::fs::write(&datei, "a").unwrap();
    assert!(geaendert(&datei), "unversioniert");
    git(t.path(), &["add", "-A"]);
    assert!(geaendert(&datei), "gestagt");
    git(t.path(), &["-c", "user.name=x", "-c", "user.email=x@x", "commit", "-q", "-m", "a"]);
    assert!(!geaendert(&datei), "committet");
    let index_vorher = std::fs::metadata(t.path().join(".git/index")).unwrap().modified().unwrap();
    std::fs::write(&datei, "b").unwrap();
    assert!(geaendert(&datei), "ungestagt");
    assert_eq!(std::fs::metadata(t.path().join(".git/index")).unwrap().modified().unwrap(), index_vorher, "der Index bleibt unberührt");
    std::fs::write(t.path().join("plan/anderes.md"), "x").unwrap();
    git(t.path(), &["checkout", "--", "plan/wbs.md"]);
    assert!(!geaendert(&datei), "andere Dateien zählen nicht");
}

#[test]
fn ausserhalb_eines_repositories_unveraendert() {
    let t = tempfile::tempdir().unwrap();
    std::fs::write(t.path().join("wbs.md"), "a").unwrap();
    assert!(!kanband::git::geaendert(&t.path().join("wbs.md")));
    assert!(!kanband::git::geaendert(std::path::Path::new("/")));
}
