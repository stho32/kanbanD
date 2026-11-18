// R00118 B0539/B0540: die Probe „Aufruf vergessen“ als grep-Wächter.
//
// Der wahrscheinlichste Fehler an der WIP-Grenze (ADR-0002) ist ein neuer Weg, der eine Karte in eine Spalte bringt
// und die Grenzprüfung vergisst. Dieser Wächter hält die Listen aus X00001 bei: die Board-Datei-Schreiber (Funde von
// `board_pfad(`) müssen vollständig aufgezählt sein, und jeder Karten bewegende Weg muss vor `aktion()` prüfen.
// Zusätzlich: `Person` in `zugregeln.rs` wird kurz geschrieben, nicht voll qualifiziert (B0539).

/// Die Karten bewegenden Wege (ADR-0002): je Eintrag (Datei, Weg-Marke, Grenzprüfung). Die Grenzprüfung muss **nach**
/// der Marke und **vor** der ersten Board-Schreibung der Datei stehen. `archiv.rs` führt zwei Wege: `zurueckholen`
/// (Marke leer; schreibt keine Board-Datei, lässt die Karten aber wieder zählen) und den Löschweg `endgueltig_loeschen`
/// (R00141). Der Löschweg schreibt als erster in `archiv.rs` eine Board-Datei; weil `archivieren_pruefen` auch im
/// früheren `archivieren` steht, grenzt die Marke `fn endgueltig_loeschen` die Nadel auf die Entnahme-Sperre des
/// Löschwegs ein — sonst bliebe deren Entfernen unentdeckt.
const BEWEGEND: [(&str, &str, &str); 7] = [
    ("src/dienst/bewegen.rs", "", "entnahme_und_grenzen_pruefen"),
    ("src/dienst/aufgabe_anlegen.rs", "", "zug_mit_rueckkehr_pruefen"),
    ("src/dienst/zuordnung.rs", "", "grenzen_pruefen"),
    ("src/dienst/reservierung.rs", "", "entnahme_und_zug_pruefen"),
    ("src/dienst/erledigen.rs", "", "zug_pruefen"),
    ("src/dienst/archiv.rs", "fn endgueltig_loeschen", "archivieren_pruefen"),
    ("src/dienst/archiv.rs", "", "zurueckholen_pruefen"),
];

/// Alle Dienst-Dateien, die `board_pfad(` führen — die 18 Board-Datei-Schreiber (17 aus X00001 (R00128: `board_verwalten.rs`
/// für Umbenennen/Archivieren und den Löschweg; R00141: `archiv.rs::endgueltig_loeschen`; R00195: `klassen.rs` setzt nur
/// `classes` im Frontmatter und bewegt keine Karte)). `verlauf.rs` liest die
/// Board-Datei nur; ein neuer Eintrag hier ist ein neuer Schreiber, den X00001 und diese Liste einordnen müssen.
const SCHREIBER: [&str; 18] = [
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
    "klassen.rs",
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
    for (datei, marke, pruefung) in BEWEGEND {
        let text = quelle(datei);
        let von = if marke.is_empty() { 0 } else { stelle(&text, marke) };
        // Die Grenzprüfung steht nach der Weg-Marke und vor der ersten Board-Schreibung; `archiv.rs::zurueckholen`
        // schreibt keine Board-Datei (Fallback `self.aktion(`), der Löschweg schreibt die Zeilen.
        let grenze = text.find("board_pfad(").unwrap_or_else(|| stelle(&text, "self.aktion("));
        let nadel = format!("{pruefung}(");
        let p = von + text[von..].find(&nadel).unwrap_or_else(|| panic!("{datei}: ab der Marke nicht gefunden: {nadel}"));
        assert!(p < grenze, "{datei}: {pruefung} steht nach dem Schreiben");
    }
}

#[test]
fn zugregeln_schreibt_person_kurz() {
    let text = quelle("src/dienst/zugregeln.rs");
    assert!(!text.contains("crate::modell::Person"), "B0539: `Person` ist importiert, die volle Schreibweise entfällt");
}
