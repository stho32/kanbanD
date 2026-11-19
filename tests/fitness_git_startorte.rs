// R00204 AK 14 (d), ADR-0032 N2.3 (Fitness Function O3): `Command::new("git")` steht außerhalb von Tests nur an drei
// Orten — dem Board-Repository (`src/git.rs`), dem Anlegen eines Ordners (`src/start/ordner.rs`) und dem einen Startort
// für Arbeits-Repositories (`src/git/arbeitsrepo.rs`). Ein vierter Ort ist ein Befund.
use std::collections::BTreeSet;
use std::path::Path;

const ERLAUBT: [&str; 3] = ["src/git.rs", "src/git/arbeitsrepo.rs", "src/start/ordner.rs"];

/// Die Dateien unter `wurzel/src`, die `Command::new("git")` außerhalb ihres Testmoduls (`#[cfg(test)]`) enthalten.
fn orte(wurzel: &Path) -> BTreeSet<String> {
    let mut gefunden = BTreeSet::new();
    let mut offen = vec![wurzel.join("src")];
    while let Some(ordner) = offen.pop() {
        for eintrag in std::fs::read_dir(&ordner).unwrap() {
            let pfad = eintrag.unwrap().path();
            if pfad.is_dir() {
                offen.push(pfad);
            } else if pfad.extension().is_some_and(|e| e == "rs") {
                let text = std::fs::read_to_string(&pfad).unwrap();
                let ohne_tests = text.split("#[cfg(test)]").next().unwrap_or_default();
                if ohne_tests.contains("Command::new(\"git\")") {
                    gefunden.insert(pfad.strip_prefix(wurzel).unwrap().to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }
    gefunden
}

#[test]
fn git_startet_nur_an_drei_orten() {
    let orte = orte(Path::new(env!("CARGO_MANIFEST_DIR")));
    assert_eq!(orte, ERLAUBT.iter().map(|o| o.to_string()).collect::<BTreeSet<_>>(), "Command::new(\"git\") außerhalb der drei Orte");
}

// Gegenprobe: ein vierter Ort wird gefunden, einer nur im Testmodul nicht
#[test]
fn ein_vierter_ort_wird_gefunden() {
    let tmp = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(tmp.path().join("src/dienst")).unwrap();
    std::fs::write(tmp.path().join("src/git.rs"), "fn a() { Command::new(\"git\"); }\n").unwrap();
    std::fs::write(tmp.path().join("src/dienst/vierter.rs"), "fn b() {\n    let c = Command::new(\"git\");\n}\n").unwrap();
    std::fs::write(tmp.path().join("src/dienst/nur_test.rs"), "fn c() {}\n#[cfg(test)]\nmod tests { fn d() { Command::new(\"git\"); } }\n").unwrap();
    assert_eq!(orte(tmp.path()), ["src/dienst/vierter.rs", "src/git.rs"].iter().map(|o| o.to_string()).collect::<BTreeSet<_>>());
}
