// R00118 B0539/B0540: die Probe „Aufruf vergessen“ als grep-Wächter.
//
// Der wahrscheinlichste Fehler an der WIP-Grenze (ADR-0002) ist ein neuer Weg, der eine Karte in eine Spalte bringt
// und die Grenzprüfung vergisst. Dieser Wächter hält die Listen aus X00001 bei: die Board-Datei-Schreiber (Funde von
// `board_pfad(`) müssen vollständig aufgezählt sein, und jeder Karten bewegende Weg muss vor `aktion()` prüfen.
// Zusätzlich: `Person` in `zugregeln.rs` wird kurz geschrieben, nicht voll qualifiziert (B0539).

/// Die Karten bewegenden Dienst-Dateien und die Grenzprüfung, die sie vor der Board-Schreibung aufrufen müssen.
/// `zurueckholen_pruefen` (archiv.rs) schreibt keine Board-Datei, lässt die Karten aber wieder zählen.
const BEWEGEND: [(&str, &str); 6] = [
    ("src/dienst/bewegen.rs", "entnahme_und_grenzen_pruefen"),
    ("src/dienst/aufgabe_anlegen.rs", "zug_mit_rueckkehr_pruefen"),
    ("src/dienst/zuordnung.rs", "grenzen_pruefen"),
    ("src/dienst/reservierung.rs", "entnahme_und_zug_pruefen"),
    ("src/dienst/erledigen.rs", "zug_pruefen"),
    ("src/dienst/archiv.rs", "zurueckholen_pruefen"),
];

/// Alle Dienst-Dateien, die `board_pfad(` führen — die 17 Board-Datei-Schreiber aus X00001 (R00128: `board_verwalten.rs`
/// für Umbenennen/Archivieren und den Löschweg; R00141: `archiv.rs::endgueltig_loeschen`). `verlauf.rs` liest die
/// Board-Datei nur; ein neuer Eintrag hier ist ein neuer Schreiber, den X00001 und diese Liste einordnen müssen.
const SCHREIBER: [&str; 17] = [
    "archiv.rs",
    "aufgabe_anlegen.rs",
    "berichtsfilter.rs",
    "bestand.rs",
    "bewegen.rs",
    "bindung.rs",
    "board_anlegen.rs",
    "board_verwalten.rs",
    "einrichten.rs",
    "erledigen.rs",
    "fieber.rs",
    "phasen.rs",
    "reservierung.rs",
    "spalten.rs",
    "termine.rs",
    "verlauf.rs",
    "zuordnung.rs",
];

fn quelle(rel: &str) -> String {
    std::fs::read_to_string(rel).unwrap_or_else(|e| panic!("{rel}: {e}"))
}

/// Erste Fundstelle von `nadel`; fehlt sie, ist die Probe rot.
fn stelle(text: &str, nadel: &str) -> usize {
    text.find(nadel).unwrap_or_else(|| panic!("nicht gefunden: {nadel}"))
}

#[test]
fn board_datei_schreiber_liste_ist_vollstaendig() {
    let mut gefunden: Vec<String> = std::fs::read_dir("src/dienst")
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .filter(|n| n.ends_with(".rs"))
        .filter(|n| std::fs::read_to_string(format!("src/dienst/{n}")).unwrap().contains("board_pfad("))
        .collect();
    gefunden.sort();
    let mut erwartet: Vec<String> = SCHREIBER.iter().map(|s| (*s).to_string()).collect();
    erwartet.sort();
    assert_eq!(gefunden, erwartet, "ein neuer Board-Datei-Schreiber muss in X00001 und dieser Liste eingeordnet werden");
}

#[test]
fn jeder_karten_bewegende_weg_prueft_die_grenze_vor_der_aktion() {
    for (datei, pruefung) in BEWEGEND {
        let text = quelle(datei);
        let p = stelle(&text, &format!("{pruefung}("));
        // Die Grenzprüfung steht vor der ersten Board-Schreibung; `archiv.rs` schreibt keine Board-Datei.
        let grenze = text.find("board_pfad(").unwrap_or_else(|| stelle(&text, "self.aktion("));
        assert!(p < grenze, "{datei}: {pruefung} steht nach dem Schreiben");
    }
}

#[test]
fn zugregeln_schreibt_person_kurz() {
    let text = quelle("src/dienst/zugregeln.rs");
    assert!(!text.contains("crate::modell::Person"), "B0539: `Person` ist importiert, die volle Schreibweise entfällt");
}
