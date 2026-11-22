mod gemeinsam;

use gemeinsam::git;
use kanband::fehler::Fehler;
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

/// ADR-0005 N2 Punkt 3, ADR-0008 zweite Linie: `committen` prüft seine Pfade, bevor es etwas anfasst — die
/// direkten Aufrufer (`anhaenge`, `fieber`) gehen nicht durch `aktion()`. Ein Pfad außerhalb der Wurzel oder
/// ein doppelter Pfad ist ein Programmierfehler und endet intern, ohne Index oder Arbeitsbaum zu berühren.
#[test]
fn pfad_ausserhalb_der_wurzel_und_doppelter_pfad_werden_abgewiesen() {
    let t = repo();
    std::fs::write(t.path().join("a.md"), "a").unwrap();
    git(t.path(), &["add", "-A"]);
    git(t.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
    let vorher = git(t.path(), &["status", "--porcelain"]);
    for (pfad, grund) in [("../x.md", "verlässt den Ordner"), ("/etc/passwd", "verlässt den Ordner"), ("a\u{0}b.md", "NUL")] {
        let fehler = committen(t.path(), &[pfad.into()], &stefan(), "raus").unwrap_err();
        assert!(matches!(fehler, Fehler::Intern(_)) && fehler.meldung().contains(grund), "„{pfad}“ weist die eigene Prüfung ab: {fehler:?}");
        assert_eq!(git(t.path(), &["status", "--porcelain"]), vorher, "Index und Arbeitsbaum unberührt");
    }
    let doppelt = ["a.md".to_string(), "a.md".to_string()];
    let fehler = committen(t.path(), &doppelt, &stefan(), "doppelt").unwrap_err();
    assert!(fehler.meldung().contains("doppelt"), "doppelter Pfad weist die eigene Prüfung ab: {fehler:?}");
    assert_eq!(git(t.path(), &["rev-list", "--count", "HEAD"]), "1", "kein Commit");
}

/// ADR-0005 N2 Punkt 4: die Meldung sagt „zurückgenommen“ nur, wenn es stimmt. Lässt sich ein Pfad nicht
/// zurücknehmen (hier: eine neue Datei in einem schreibgeschützten Ordner), nennt der Fehler den Pfad und den
/// Grund — er behauptet keinen Erfolg und verschweigt den Fehlschlag nicht auf `stderr`.
#[test]
fn eine_gescheiterte_ruecknahme_steht_in_der_meldung() {
    use std::os::unix::fs::PermissionsExt;
    let t = repo();
    std::fs::write(t.path().join("bleibt.md"), "alt").unwrap();
    git(t.path(), &["add", "-A"]);
    git(t.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
    let haken = t.path().join(".git/hooks/pre-commit");
    std::fs::write(&haken, "#!/bin/sh\nexit 1\n").unwrap();
    std::fs::set_permissions(&haken, std::fs::Permissions::from_mode(0o755)).unwrap();
    let unter = t.path().join("unter");
    std::fs::create_dir(&unter).unwrap();
    std::fs::write(unter.join("neu.md"), "neu").unwrap();
    std::fs::set_permissions(&unter, std::fs::Permissions::from_mode(0o555)).unwrap();
    let fehler = committen(t.path(), &["unter/neu.md".into()], &stefan(), "scheitert").unwrap_err();
    std::fs::set_permissions(&unter, std::fs::Permissions::from_mode(0o755)).unwrap();
    assert!(!fehler.meldung().contains("zurückgenommen:"), "kein Erfolg behauptet: {fehler:?}");
    assert!(fehler.meldung().contains("unter/neu.md"), "der Pfad steht in der Meldung: {fehler:?}");
    assert!(fehler.meldung().contains("Rücknahme"), "die gescheiterte Rücknahme steht in der Meldung: {fehler:?}");
}

/// ADR-0005 N2 Punkt 2 (akzeptierte Schwäche, festgehalten): trägt ein Pfad vor der Aktion eine uncommittete
/// Änderung, verliert er sie — die Rücknahme stellt den Stand von HEAD her und lässt `git status` leer. Der Test
/// hält die bewusst in Kauf genommene Schwäche fest, damit sie nicht unbemerkt kippt.
#[test]
fn vorher_schmutziger_pfad_steht_nach_dem_fehlschlag_auf_head() {
    use std::os::unix::fs::PermissionsExt;
    let t = repo();
    std::fs::write(t.path().join("schmutzig.md"), "alt").unwrap();
    git(t.path(), &["add", "-A"]);
    git(t.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
    std::fs::write(t.path().join("schmutzig.md"), "uncommittete Handarbeit").unwrap();
    assert!(!git(t.path(), &["status", "--porcelain"]).is_empty(), "vorher schmutzig");
    let haken = t.path().join(".git/hooks/pre-commit");
    std::fs::write(&haken, "#!/bin/sh\nexit 1\n").unwrap();
    std::fs::set_permissions(&haken, std::fs::Permissions::from_mode(0o755)).unwrap();
    committen(t.path(), &["schmutzig.md".into()], &stefan(), "scheitert").unwrap_err();
    assert_eq!(std::fs::read_to_string(t.path().join("schmutzig.md")).unwrap(), "alt", "der Stand von HEAD");
    assert_eq!(git(t.path(), &["status", "--porcelain"]), "", "kein Git-Rest");
}

/// ADR-0005 N2 Durchsetzung „Pfad außerhalb“: existiert die Datei außerhalb der Wurzel, ist das der gefährliche
/// Fall — die Prüfung weist ihn ab, ohne die Datei draußen anzufassen.
#[test]
fn pfad_ausserhalb_der_wurzel_bleibt_ohne_wirkung() {
    let aussen = tempfile::tempdir().unwrap();
    let t = aussen.path().join("repo");
    std::fs::create_dir(&t).unwrap();
    git(&t, &["init", "-q"]);
    std::fs::write(t.join("a.md"), "a").unwrap();
    git(&t, &["add", "-A"]);
    git(&t, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
    std::fs::write(aussen.path().join("x.md"), "draußen").unwrap();
    let vorher = git(&t, &["status", "--porcelain"]);
    let fehler = committen(&t, &["../x.md".into()], &stefan(), "raus").unwrap_err();
    assert!(matches!(fehler, Fehler::Intern(_)), "ein Pfad außerhalb ist ein Programmierfehler: {fehler:?}");
    assert_eq!(git(&t, &["status", "--porcelain"]), vorher, "Index und Arbeitsbaum unberührt");
    assert_eq!(std::fs::read_to_string(aussen.path().join("x.md")).unwrap(), "draußen", "die Datei draußen bleibt");
}

/// ADR-0005 N2 Punkt 4 / Leitlinie: ohne lesbares HEAD ist unbekannt, was die Aktion angelegt hat — dann wird
/// nichts gelöscht. Eine vor der Aktion vorhandene Datei bleibt liegen, der Index wird zurückgesetzt, soweit
/// möglich, und die Meldung nennt den Grund, statt „zurückgenommen“ zu behaupten.
#[test]
fn ohne_head_loescht_die_ruecknahme_nichts() {
    use std::os::unix::fs::PermissionsExt;
    let t = repo();
    std::fs::create_dir_all(t.path().join("boards")).unwrap();
    std::fs::create_dir_all(t.path().join("aufgaben")).unwrap();
    std::fs::write(t.path().join("boards/fabrik.md"), "# fabrik").unwrap();
    std::fs::write(t.path().join("kanbanD.md"), "---\nst: st\n---\n").unwrap();
    std::fs::write(t.path().join("aufgaben/0001-neu.md"), "neu").unwrap();
    let haken = t.path().join(".git/hooks/pre-commit");
    std::fs::write(&haken, "#!/bin/sh\nexit 1\n").unwrap();
    std::fs::set_permissions(&haken, std::fs::Permissions::from_mode(0o755)).unwrap();
    let fehler = committen(t.path(), &["boards/fabrik.md".into(), "aufgaben/0001-neu.md".into()], &stefan(), "scheitert").unwrap_err();
    assert!(t.path().join("boards/fabrik.md").exists(), "die vorher vorhandene Datei bleibt liegen: {fehler:?}");
    assert!(fehler.meldung().contains("HEAD fehlt"), "der Grund steht in der Meldung: {fehler:?}");
    assert!(!fehler.meldung().contains("zurückgenommen:"), "kein Erfolg behauptet: {fehler:?}");
}

/// Variante: HEAD ist lesbar (`rev-parse` findet es), aber `git ls-tree` scheitert (exit 128) — auch dann wird
/// nichts gelöscht, der Grund steht im Text.
#[test]
fn ls_tree_scheitert_trotz_head_laesst_die_datei_stehen() {
    let t = repo();
    std::fs::write(t.path().join("bleibt.md"), "alt").unwrap();
    git(t.path(), &["add", "-A"]);
    git(t.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
    let tree = git(t.path(), &["rev-parse", "HEAD^{tree}"]);
    let objekt = t.path().join(format!(".git/objects/{}/{}", &tree[..2], &tree[2..]));
    std::fs::remove_file(&objekt).unwrap();
    std::fs::write(t.path().join("neu.md"), "neu").unwrap();
    let fehler = committen(t.path(), &["neu.md".into()], &stefan(), "scheitert").unwrap_err();
    assert!(t.path().join("neu.md").exists(), "die Datei bleibt liegen: {fehler:?}");
    assert!(fehler.meldung().contains("nicht zurückgenommen"), "der Grund steht in der Meldung: {fehler:?}");
    assert!(!fehler.meldung().contains("zurückgenommen:"), "kein Erfolg behauptet: {fehler:?}");
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

// R00233 (ADR-0005 N4): hält jemand außerhalb von kanbanD `.git/index.lock`, scheitert der Commit schon an
// `git add` — die Rücknahme darf die Sperre selbst nicht brauchen. „Sperre setzen“ heißt eine leere
// `.git/index.lock` vor dem Aufruf, „Sperre entfernen“ heißt sie danach löschen.

fn eingerichtet_mit(t: &std::path::Path, dateien: &[(&str, &str)]) {
    for (pfad, inhalt) in dateien {
        let ziel = t.join(pfad);
        std::fs::create_dir_all(ziel.parent().unwrap()).unwrap();
        std::fs::write(ziel, inhalt).unwrap();
    }
    git(t, &["add", "-A"]);
    git(t, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
}

fn sperre_setzen(t: &std::path::Path) {
    std::fs::write(t.join(".git/index.lock"), "").unwrap();
}

fn sperre_entfernen(t: &std::path::Path) {
    std::fs::remove_file(t.join(".git/index.lock")).unwrap();
}

fn zwischendateien(t: &std::path::Path) -> Vec<String> {
    let mut funde = vec![];
    let mut offen = vec![t.to_path_buf()];
    while let Some(ordner) = offen.pop() {
        for e in std::fs::read_dir(&ordner).unwrap().flatten() {
            let p = e.path();
            if p.file_name().is_some_and(|n| n == ".git") {
                continue;
            }
            if e.file_type().unwrap().is_dir() {
                offen.push(p);
            } else if p.to_string_lossy().ends_with(".kanbanD-tmp") {
                funde.push(p.to_string_lossy().into_owned());
            }
        }
    }
    funde
}

/// R00233 AK 1 (Abnahme-Probe 1 aus N4): Sperre gehalten, alle drei Arten — geändert, gelöscht, neu.
#[test]
fn gehaltene_sperre_nimmt_geaenderte_geloeschte_und_neue_pfade_zurueck() {
    let t = repo();
    eingerichtet_mit(t.path(), &[("a.md", "alt"), ("d.md", "da")]);
    std::fs::write(t.path().join("a.md"), "neu").unwrap();
    std::fs::remove_file(t.path().join("d.md")).unwrap();
    std::fs::write(t.path().join("n.md"), "neu").unwrap();
    sperre_setzen(t.path());
    let pfade = ["a.md".to_string(), "d.md".to_string(), "n.md".to_string()];
    let fehler = committen(t.path(), &pfade, &stefan(), "scheitert").unwrap_err();
    sperre_entfernen(t.path());
    let meldung = fehler.meldung();
    assert!(meldung.contains("index.lock"), "der Grund des Commits steht vorn: {meldung}");
    assert!(meldung.contains("zurückgenommen:"), "Erfolg der Rücknahme: {meldung}");
    assert!(!meldung.contains("Rücknahme unvollständig"), "kein Fehlschlag der Rücknahme: {meldung}");
    assert_eq!(git(t.path(), &["status", "--porcelain"]), "", "Status leer");
    assert_eq!(std::fs::read_to_string(t.path().join("a.md")).unwrap(), "alt");
    assert_eq!(std::fs::read_to_string(t.path().join("d.md")).unwrap(), "da");
    assert!(!t.path().join("n.md").exists(), "die neue Datei ist weg");
    assert_eq!(git(t.path(), &["rev-list", "--count", "HEAD"]), "1", "kein neuer Commit");
}

/// R00233, eigene Variante zu AK 1: die Wurzel ist ein Unterordner des Repositories — der Inhalt aus HEAD
/// wird relativ zur Wurzel gelesen, nicht relativ zur Wurzel des Repositories.
#[test]
fn gehaltene_sperre_im_unterordner_nimmt_relativ_zum_unterordner_zurueck() {
    let t = repo();
    eingerichtet_mit(t.path(), &[("a.md", "oben"), ("kanban/a.md", "alt")]);
    let k = t.path().join("kanban");
    std::fs::write(k.join("a.md"), "neu").unwrap();
    sperre_setzen(t.path());
    let fehler = committen(&k, &["a.md".into()], &stefan(), "scheitert").unwrap_err();
    sperre_entfernen(t.path());
    assert!(fehler.meldung().contains("zurückgenommen:"), "{fehler:?}");
    assert_eq!(std::fs::read_to_string(k.join("a.md")).unwrap(), "alt");
    assert_eq!(git(t.path(), &["status", "--porcelain"]), "", "Status leer");
}

/// R00233 AK 3 (Abnahme-Probe 3 aus N4): lässt sich ein Pfad nicht zurückschreiben (Elternordner nicht
/// beschreibbar), nennt die Meldung ihn, und die übrigen Pfade sind trotzdem zurückgenommen.
#[test]
fn gehaltene_sperre_und_gescheitertes_zurueckschreiben_nimmt_den_rest_trotzdem_zurueck() {
    use std::os::unix::fs::PermissionsExt;
    let t = repo();
    eingerichtet_mit(t.path(), &[("zu/a.md", "alt"), ("d.md", "da")]);
    std::fs::write(t.path().join("zu/a.md"), "neu").unwrap();
    std::fs::remove_file(t.path().join("d.md")).unwrap();
    std::fs::write(t.path().join("n.md"), "neu").unwrap();
    let zu = t.path().join("zu");
    std::fs::set_permissions(&zu, std::fs::Permissions::from_mode(0o555)).unwrap();
    sperre_setzen(t.path());
    let pfade = ["zu/a.md".to_string(), "d.md".to_string(), "n.md".to_string()];
    let fehler = committen(t.path(), &pfade, &stefan(), "scheitert").unwrap_err();
    sperre_entfernen(t.path());
    std::fs::set_permissions(&zu, std::fs::Permissions::from_mode(0o755)).unwrap();
    let meldung = fehler.meldung();
    assert!(meldung.contains("Rücknahme unvollständig") && meldung.contains("zu/a.md"), "{meldung}");
    assert!(!meldung.contains("zurückgenommen:"), "kein Erfolg behauptet: {meldung}");
    assert_eq!(std::fs::read_to_string(t.path().join("d.md")).unwrap(), "da", "die Rücknahme macht weiter");
    assert!(!t.path().join("n.md").exists(), "die neue Datei ist weg");
    assert_eq!(zwischendateien(t.path()), Vec::<String>::new(), "keine Nachbardatei");
}

/// R00233 AK 5 (N4 Punkt 4): zurückgeschrieben werden nur gewöhnliche Dateien, das Ausführbit wie in HEAD;
/// eine Verknüpfung bleibt unberührt und steht als nicht wiederhergestellt in der Meldung.
#[test]
fn gehaltene_sperre_schreibt_nur_gewoehnliche_dateien_zurueck() {
    use std::os::unix::fs::PermissionsExt;
    let t = repo();
    eingerichtet_mit(t.path(), &[("a.md", "a"), ("x.sh", "alt")]);
    std::fs::set_permissions(t.path().join("x.sh"), std::fs::Permissions::from_mode(0o755)).unwrap();
    std::os::unix::fs::symlink("a.md", t.path().join("l.md")).unwrap();
    git(t.path(), &["add", "-A"]);
    git(t.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "x.sh ausführbar, l.md verknüpft"]);
    assert_eq!(git(t.path(), &["ls-tree", "HEAD", "--format=%(objectmode) %(path)", "--", "x.sh", "l.md"]), "120000 l.md\n100755 x.sh");
    std::fs::write(t.path().join("x.sh"), "neu").unwrap();
    std::fs::remove_file(t.path().join("l.md")).unwrap();
    std::fs::write(t.path().join("l.md"), "neu").unwrap();
    sperre_setzen(t.path());
    let fehler = committen(t.path(), &["x.sh".into(), "l.md".into()], &stefan(), "scheitert").unwrap_err();
    sperre_entfernen(t.path());
    let x = t.path().join("x.sh");
    assert_eq!(std::fs::read_to_string(&x).unwrap(), "alt");
    assert_eq!(std::fs::metadata(&x).unwrap().permissions().mode() & 0o111, 0o111, "x.sh ist ausführbar");
    assert_eq!(git(t.path(), &["status", "--porcelain", "--", "x.sh"]), "", "x.sh steht auf HEAD");
    let l = t.path().join("l.md");
    assert!(std::fs::symlink_metadata(&l).unwrap().file_type().is_file(), "l.md bleibt die gewöhnliche Datei");
    assert_eq!(std::fs::read_to_string(&l).unwrap(), "neu");
    let meldung = fehler.meldung();
    assert!(meldung.contains("l.md ließ sich nicht wiederherstellen: Art 120000"), "{meldung}");
    assert!(meldung.contains("Rücknahme unvollständig"), "{meldung}");
}

/// R00233 AK 8 (m6): gelingt das Anlegen der Nachbardatei, scheitert aber das Umbenennen (an der Stelle von
/// `a.md` steht ein nicht leerer Ordner), bleibt keine Nachbardatei liegen, und die Meldung nennt den Pfad.
#[test]
fn gescheitertes_umbenennen_laesst_keine_nachbardatei_liegen() {
    let t = repo();
    eingerichtet_mit(t.path(), &[("a.md", "alt")]);
    std::fs::remove_file(t.path().join("a.md")).unwrap();
    std::fs::create_dir(t.path().join("a.md")).unwrap();
    std::fs::write(t.path().join("a.md/drin"), "x").unwrap();
    sperre_setzen(t.path());
    let fehler = committen(t.path(), &["a.md".into()], &stefan(), "scheitert").unwrap_err();
    sperre_entfernen(t.path());
    let meldung = fehler.meldung();
    assert!(meldung.contains("Rücknahme unvollständig") && meldung.contains("a.md ließ sich nicht wiederherstellen"), "{meldung}");
    assert_eq!(zwischendateien(t.path()), Vec::<String>::new(), "keine Nachbardatei");
}
