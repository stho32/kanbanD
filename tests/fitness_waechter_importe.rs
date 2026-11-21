// R00216 Nacharbeit 1 (architektur-reviewer, Muss): Die Dienste und die Web-Schicht hängen vom Wächter ab
// (A00004 → A00008), nie umgekehrt. Eine Kante `waechter → dienst` oder `waechter → web` ist ein Importzyklus.
// Erfasst sind `crate::dienst…`, `crate::web…` und die Klammerform `use crate::{…, dienst, …}`.
use std::path::Path;

const VERBOTEN: [&str; 2] = ["dienst", "web"];

/// Die verbotenen Module, auf die `text` außerhalb seines Testmoduls zugreift, in der Reihenfolge von [`VERBOTEN`].
fn verbotene_zugriffe(text: &str) -> Vec<&'static str> {
    let ohne_tests = text.split("#[cfg(test)]").next().unwrap_or_default();
    let mut klammern = String::new();
    for (i, _) in ohne_tests.match_indices("crate::{") {
        let rest = &ohne_tests[i + "crate::{".len()..];
        klammern.push_str(&rest[..rest.find('}').unwrap_or(rest.len())]);
        klammern.push(',');
    }
    let in_klammern = |modul: &str| klammern.split(',').any(|teil| teil.trim().split("::").next() == Some(modul));
    VERBOTEN
        .into_iter()
        .filter(|modul| {
            let direkt = format!("crate::{modul}");
            ohne_tests.match_indices(&direkt).any(|(i, _)| !ohne_tests[i + direkt.len()..].starts_with(|c: char| c.is_alphanumeric() || c == '_')) || in_klammern(modul)
        })
        .collect()
}

#[test]
fn der_waechter_importiert_weder_dienst_noch_web() {
    let text = std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("src/waechter.rs")).unwrap();
    assert_eq!(verbotene_zugriffe(&text), Vec::<&str>::new(), "src/waechter.rs greift auf eine Schicht zu, die ihn selbst nutzt");
}

// Gegenprobe: jede Schreibweise wird gefunden; ein Zugriff nur im Testmodul und ein ähnlicher Name nicht
#[test]
fn jede_schreibweise_wird_gefunden() {
    assert_eq!(verbotene_zugriffe("let t = crate::dienst::transkripte::ORDNER;"), ["dienst"]);
    assert_eq!(verbotene_zugriffe("use crate::web::App;"), ["web"]);
    assert_eq!(verbotene_zugriffe("use crate::{format, dienst::Kanban};"), ["dienst"]);
    assert_eq!(verbotene_zugriffe("use crate::{web};\nuse crate::dienst;"), ["dienst", "web"]);
    assert_eq!(verbotene_zugriffe("use crate::modell::transkript;\nuse crate::dienstplan::x;\nuse crate::webhaken;"), Vec::<&str>::new());
    assert_eq!(verbotene_zugriffe("fn a() {}\n#[cfg(test)]\nmod tests { use crate::dienst::Kanban; }"), Vec::<&str>::new());
}
