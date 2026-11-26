// R00257 AK 3 (I0247, Karte #241), ADR-0044 Prüfliste 3: Die Momentaufnahme der Dateinamen entsteht in jedem
// Sammelweg **nach** `let _sperre = self.gesperrt();` und `Kanban` trägt kein Feld ihres Typs. Beides ist am Code
// geprüft (`grep`, ADR-0044) — als Fitness Function, weil die verhaltensgleiche Probe allein den Mutanten
// „Momentaufnahme vor `gesperrt()`“ nicht tötet: der Rückfall auf den Inhalt liest den Ordner erst beim Aufruf und
// findet eine während des Wartens angelegte Datei auch aus einer veralteten Namensliste (Befund in `Gelerntes`).
use std::path::Path;

fn lies(wurzel: &Path, rel: &str) -> String {
    std::fs::read_to_string(wurzel.join(rel)).unwrap_or_else(|e| panic!("{rel}: {e}"))
}

/// Die drei Sammelwege mit der Schleife über `ordner().aufgabe(nr)` (ADR-0044 E1): Datei und Name ihres Sammelwegs.
const WEGE: [(&str, &str); 3] = [
    ("src/dienst/aufgabe_aendern.rs", "fn mehrere_aendern"),
    ("src/dienst/archiv.rs", "fn mehrere_archivieren"),
    ("src/dienst/zuordnung.rs", "fn mehrere_auf_board_legen"),
];

#[test]
fn momentaufnahme_entsteht_nach_der_sperre() {
    let wurzel = Path::new(env!("CARGO_MANIFEST_DIR"));
    for (weg, name) in WEGE {
        let text = lies(wurzel, weg);
        let beginn = text.find(name).unwrap_or_else(|| panic!("{weg}: {name} nicht gefunden"));
        let momentaufnahme = text.find("verzeichnis()?").unwrap_or_else(|| panic!("{weg}: keine Momentaufnahme gefunden"));
        assert!(beginn < momentaufnahme, "{weg}: die Momentaufnahme steht außerhalb von {name}");
        assert!(
            text[beginn..momentaufnahme].contains("let _sperre = self.gesperrt();"),
            "{weg}: die Momentaufnahme in {name} entsteht vor `gesperrt()`"
        );
    }
    let modul = lies(wurzel, "src/dienst/mod.rs");
    assert!(!modul.contains("Aufgabenverzeichnis"), "`Kanban` (src/dienst/mod.rs) trägt ein Feld der Momentaufnahme");
}
