// R00149 (ADR-0005 N1 Punkt 4): „Die Nachricht wird an einer Stelle gebaut" als Wächter.
//
// Jeder Schreibweg, der eine Commit-Nachricht baut, schickt jedes freie Textfeld (Titel, Board- und
// Spaltennamen, Personennamen, Kommentar- und Teilaufgabentexte, Dateinamen) durch `nachricht::wert`;
// kein `format!` geht an der einen Funktion vorbei. Dieser Wächter hält das dauerhaft: er sucht in den
// Dienst-Dateien die Nachrichtenzeilen und verlangt dort `nachricht::wert`. Ein neuer Schreibweg mit
// einem rohen Feld in der Nachricht macht ihn rot.
//
// Nachrichtenzeile = ein `format!`, das **keine** Fehlermeldung (`Fehler::`/`Err(`/`ungueltig(`) und
// **kein** Kommentar-Text (`kommentiert(`) ist und das ein Feld der Form `„{}“` oder einen Zugriff auf
// ein freies Feld (`.titel`/`.name`/`.spalte`/`.kuerzel`) trägt. Zwei Proben:
//   1. Ein Feld der Form `„{}“` muss durch `nachricht::wert` gegangen sein — die Prüfung des
//      `security-reviewer`: grep -nE 'format!\("[^"]*„\{\}“' src/dienst/*.rs | grep -v nachricht::wert.
//   2. Nach dem Herausnehmen aller `nachricht::wert(...)` darf in der Zeile kein freies Feld mehr stehen.

/// Freie Felder, die in einer Commit-Nachricht durch `nachricht::wert` müssen. `.text` fehlt bewusst:
/// `.text()` (etwa `d.ergebnis.text()`) ist kein Feld; Teilaufgabentexte deckt die Probe 1 ab.
const FREIE_FELDER: &[&str] = &[".titel", ".name", ".spalte", ".kuerzel"];

/// Warn-, Anzeige- und Fachdaten-Zeilen (keine Commit-Nachricht, kein `wert`): Datei und ein Merkmal.
const KEINE_NACHRICHT: &[(&str, &str)] = &[
    ("src/dienst/aufgabe_anlegen.rs", "Eintrag::MitAngaben"), // Kopietitel als Fachdatum, kein Commit
    ("src/dienst/aufgabe_anlegen.rs", "vorsatz_mit_inhalt"), // Vorsatz einer Fehlermeldung (Abweisung/Protokoll), kein Commit
    ("src/dienst/wirkungen.rs", "w.aktion.schluessel()"), // Anzeigename einer Wirkung
    ("src/dienst/wirkungen.rs", "let grund = format!"), // Beschreibung in der WBS-Datei (dort wird nie committet)
    ("src/dienst/zugregeln.rs", "Grenze erreicht"), // Warnung an den Menschen, kein Commit
];

/// Trägt `text` den Feldzugriff `feld`? Nur, wenn kein Wortzeichen folgt — sonst trifft `.spalte` auch `.spalten`.
fn enthaelt_feld(text: &str, feld: &str) -> bool {
    let mut s = text;
    while let Some(i) = s.find(feld) {
        let nach = &s[i + feld.len()..];
        if !nach.chars().next().is_some_and(|c| c.is_alphanumeric() || c == '_') {
            return true;
        }
        s = nach;
    }
    false
}

/// Trägt die Zeile eine Nachricht (Probe 1: `„{}“`; Probe 2: freies Feld) und ist keine Fehlermeldung?
fn ist_nachrichtenzeile(zeile: &str) -> bool {
    zeile.contains("format!(")
        && !zeile.contains("Fehler::")
        && !zeile.contains("Err(")
        && !zeile.contains("ungueltig(")
        && !zeile.contains("kommentiert(")
        && (zeile.contains("„{}“") || FREIE_FELDER.iter().any(|f| enthaelt_feld(&ohne_wert(zeile), f)))
}

/// Entfernt jedes `nachricht::wert(...)` samt passender Klammer aus der Zeile; was übrig bleibt, ist der rohe Text.
fn ohne_wert(zeile: &str) -> String {
    let nadel = "nachricht::wert(";
    let mut rest = String::new();
    let mut s = zeile;
    while let Some(i) = s.find(nadel) {
        rest.push_str(&s[..i]);
        let nach = &s[i + nadel.len()..];
        let mut tiefe = 1i32;
        let mut ende = None;
        for (k, c) in nach.char_indices() {
            match c {
                '(' => tiefe += 1,
                ')' => {
                    tiefe -= 1;
                    if tiefe == 0 {
                        ende = Some(k);
                        break;
                    }
                }
                _ => {}
            }
        }
        match ende {
            Some(k) => s = &nach[k + 1..],
            None => return zeile.to_string(),
        }
    }
    rest.push_str(s);
    rest
}

#[test]
fn keine_rohen_felder_in_commit_nachrichten() {
    let mut roh: Vec<String> = vec![];
    let mut dateien: Vec<std::path::PathBuf> = std::fs::read_dir("src/dienst")
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("rs"))
        .collect();
    dateien.sort();
    for pfad in dateien {
        let rel = format!("src/dienst/{}", pfad.file_name().unwrap().to_string_lossy());
        let text = std::fs::read_to_string(&pfad).unwrap();
        for (i, zeile) in text.lines().enumerate() {
            if !ist_nachrichtenzeile(zeile) {
                continue;
            }
            if KEINE_NACHRICHT.iter().any(|(f, m)| *f == rel && zeile.contains(m)) {
                continue;
            }
            let probe1 = zeile.contains("„{}“") && !zeile.contains("nachricht::wert");
            let probe2 = FREIE_FELDER.iter().any(|f| enthaelt_feld(&ohne_wert(zeile), f));
            if probe1 || probe2 {
                roh.push(format!("{rel}:{}: {}", i + 1, zeile.trim()));
            }
        }
    }
    assert!(roh.is_empty(), "Diese Nachrichtenzeilen gehen an `nachricht::wert` vorbei:\n{}", roh.join("\n"));
}
