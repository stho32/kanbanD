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

/// ADR-0005 N1: die Nachricht ist abgeleiteter Text — `committen` entfernt Steuerzeichen und Zeilenumbrüche,
/// bevor Git sie als Argument sieht; so kann kein Schreibweg an einem Feld mit NUL scheitern.
#[test]
fn die_nachricht_wird_vor_dem_commit_abgeleitet() {
    let t = repo();
    std::fs::write(t.path().join("a.md"), "a").unwrap();
    assert!(committen(t.path(), &["a.md".into()], &stefan(), "a\u{0}b\nzweite").unwrap());
    assert_eq!(git(t.path(), &["log", "-1", "--format=%s"]), "a b zweite");
}

/// ADR-0005 N1: scheitert der Commit, nimmt `committen` seine Pfade zurück — eine neue Datei ist weg, eine
/// geänderte steht wieder auf HEAD, eine gelöschte ist wieder da, der Index ist so wie vorher.
#[test]
fn gescheiterter_commit_nimmt_seine_pfade_zurueck() {
    use std::os::unix::fs::PermissionsExt;
    let t = repo();
    std::fs::write(t.path().join("bleibt.md"), "alt").unwrap();
    std::fs::write(t.path().join("geht.md"), "alt").unwrap();
    git(t.path(), &["add", "-A"]);
    git(t.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
    let haken = t.path().join(".git/hooks/pre-commit");
    std::fs::write(&haken, "#!/bin/sh\nexit 1\n").unwrap();
    std::fs::set_permissions(&haken, std::fs::Permissions::from_mode(0o755)).unwrap();
    let vorher = git(t.path(), &["status", "--porcelain"]);
    std::fs::write(t.path().join("neu.md"), "neu").unwrap();
    std::fs::write(t.path().join("bleibt.md"), "geändert").unwrap();
    std::fs::remove_file(t.path().join("geht.md")).unwrap();
    let pfade = ["neu.md".to_string(), "bleibt.md".to_string(), "geht.md".to_string()];
    let fehler = committen(t.path(), &pfade, &stefan(), "scheitert").unwrap_err();
    assert!(fehler.meldung().contains("neu.md"), "die Meldung nennt den Pfad: {fehler:?}");
    assert_eq!(git(t.path(), &["status", "--porcelain"]), vorher, "kein Git-Rest");
    assert!(!t.path().join("neu.md").exists(), "die neue Datei ist weg");
    assert_eq!(std::fs::read_to_string(t.path().join("bleibt.md")).unwrap(), "alt", "die geänderte steht wieder auf HEAD");
    assert_eq!(std::fs::read_to_string(t.path().join("geht.md")).unwrap(), "alt", "die gelöschte ist wieder da");
    assert_eq!(git(t.path(), &["rev-list", "--count", "HEAD"]), "1", "kein Commit");
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

#[test]
fn staende_einer_datei_im_unterordner_eines_fremden_repositorys_auch_geloeschte_zeilen() {
    let t = repo();
    let plan = t.path().join("Dokumentation/Planung");
    std::fs::create_dir_all(&plan).unwrap();
    let datei = plan.join("kasse.md");
    let c = |m: &str| git(t.path(), &["-c", "user.name=KI", "-c", "user.email=k@k", "commit", "-q", "-am", m]);
    std::fs::write(&datei, "| ID |\n| B0117 |\n").unwrap();
    git(t.path(), &["add", "-A"]);
    c("mit B0117");
    std::fs::write(&datei, "| ID |\n").unwrap();
    c("B0117 gelöscht");
    std::fs::write(&datei, "| ID |\n| B0118 |\n").unwrap();
    assert_eq!(kanband::git::staende_der_datei(&datei), ["| ID |\n| B0117 |\n", "| ID |\n"], "nur committete Stände, älteste zuerst");
    let ohne = tempfile::tempdir().unwrap();
    std::fs::write(ohne.path().join("w.md"), "x").unwrap();
    assert!(kanband::git::staende_der_datei(&ohne.path().join("w.md")).is_empty(), "ohne Repository keine Stände");
    assert!(kanband::git::staende_der_datei(std::path::Path::new("/gibt/es/nicht.md")).is_empty());
}

// R00123 B0571: `staende` liefert je Stand den Commit-Autor; `<kürzel>@kanbanD` wird zum Kürzel, ein fremder Autor bleibt sein Git-Name
#[test]
fn staende_tragen_den_commit_autor() {
    let t = repo();
    let datei = t.path().join("a.md");
    let c = |wer: &str, inhalt: &str| {
        std::fs::write(&datei, inhalt).unwrap();
        git(t.path(), &["add", "-A"]);
        git(t.path(), &["-c", &format!("user.name={wer}"), "-c", &format!("user.email={wer}@kanbanD"), "commit", "-q", "-m", wer]);
    };
    c("sh", "eins");
    c("cl", "zwei");
    let staende = kanband::git::staende(t.path(), "a.md").unwrap();
    let kurz: Vec<(&str, String)> = staende.iter().map(|s| (s.inhalt.as_str(), s.autor.wer())).collect();
    assert_eq!(kurz, vec![("eins", "sh".to_string()), ("zwei", "cl".to_string())]);
    assert_eq!(staende[0].autor.email, "sh@kanbanD");
    // fremder Autor: E-Mail ohne @kanbanD → Git-Name
    std::fs::write(&datei, "drei").unwrap();
    git(t.path(), &["add", "-A"]);
    let st = std::process::Command::new("git")
        .arg("-C").arg(t.path())
        .args(["commit", "-q", "-m", "extern"])
        .env("GIT_AUTHOR_NAME", "Extern").env("GIT_AUTHOR_EMAIL", "extern@example.org")
        .env("GIT_COMMITTER_NAME", "Extern").env("GIT_COMMITTER_EMAIL", "extern@example.org")
        .status().unwrap();
    assert!(st.success());
    let staende = kanband::git::staende(t.path(), "a.md").unwrap();
    assert_eq!(staende[2].autor.wer(), "Extern");
}
