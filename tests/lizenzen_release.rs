//! R00263 AK 4 (B1434): Der Release-Ablauf legt `web/LIZENZEN.md` neben das Programm ins
//! Archiv, und `README.md` nennt den Ort — so genügt das Archiv allein (Q2).
//!
//! Der Test prüft die Quelle (Workflow und README), weil der Archivabschnitt nur in der
//! GitHub-Umgebung läuft. Er wird rot, sobald die Kopierzeile die Datei nicht mehr nennt.

use std::path::Path;

fn lies(rel: &str) -> String {
    std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join(rel)).unwrap()
}

#[test]
fn release_archiv_traegt_die_lizenzhinweise() {
    let yml = lies(".github/workflows/release.yml");
    let kopierzeile = yml
        .lines()
        .find(|z| z.trim_start().starts_with("cp ") && z.contains("target/release/"))
        .expect("die Kopierzeile des Archivabschnitts");
    assert!(
        kopierzeile.contains("web/LIZENZEN.md"),
        "die Kopierzeile nimmt die Hinweisdatei mit: {kopierzeile}"
    );
    assert!(kopierzeile.contains("README.md"), "die Kopierzeile nimmt die README mit: {kopierzeile}");
}

#[test]
fn readme_nennt_den_ort_der_hinweise() {
    let readme = lies("README.md");
    assert!(readme.contains("/web/LIZENZEN.md"), "README.md nennt /web/LIZENZEN.md");
}

#[test]
fn release_hat_den_pruefschritt() {
    let yml = lies(".github/workflows/release.yml");
    let schritt = yml
        .lines()
        .find(|z| z.contains("--pruefen"))
        .expect("der Release-Ablauf ruft lizenzen --pruefen auf");
    assert!(
        schritt.contains("lizenzen"),
        "der Prüfschritt ruft den Generator: {schritt}"
    );
}
