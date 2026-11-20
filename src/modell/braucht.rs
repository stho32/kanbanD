//! `Braucht` zwischen Karten (R00214, ADR-0035): das Label `braucht:<n>` ist der eine Träger einer Abhängigkeit —
//! „diese Aufgabe wartet auf #n“. Hier steht seine Deutung als reine Funktionen, ohne Dateien und ohne HTTP.

use super::{Aufgabe, Board};
use serde::Serialize;
use std::collections::BTreeMap;

/// Meldung, wenn `braucht` im Rumpf eines Schreibaufrufs steht — geschrieben wird nur über `labels` (ADR-0035 Punkt 4).
pub const BRAUCHT_UEBER_LABELS: &str = "braucht über labels setzen (braucht:<nr>)";

/// Ein Eintrag des abgeleiteten, nur lesbaren Felds `braucht` (R00214): worauf die Aufgabe wartet und ob das erledigt ist.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Abhaengigkeit {
    /// Nummer der gebrauchten Aufgabe, aus dem Label `braucht:<nummer>`
    pub nummer: u32,
    /// Titel der gebrauchten Aufgabe; null, wenn es zur Nummer keine lesbare Aufgabendatei gibt
    pub titel: Option<String>,
    /// archiviert oder auf einem ihrer Boards in dessen letzter Spalte; ohne lesbare Datei false
    pub erledigt: bool,
}

/// Was ein Label über eine Abhängigkeit sagt.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Deutung {
    /// kein Präfix `braucht:` — ein gewöhnliches Label
    Keine,
    /// `braucht:<n>`, ohne Groß/Klein, `n` eine Kartennummer ≥ 1 ohne führende Null
    Nummer(u32),
    /// Präfix `braucht:`, aber andere Form — beim Lesen stumm, an der Tür abgewiesen
    Falsch,
}

/// Deutet ein Label (außen getrimmt wie beim Schreiben der Labels).
pub fn deuten(label: &str) -> Deutung {
    let label = label.trim();
    let Some(rest) = label.get(..PRAEFIX.len()).filter(|p| p.eq_ignore_ascii_case(PRAEFIX)).map(|_| &label[PRAEFIX.len()..]) else {
        return Deutung::Keine;
    };
    let ziffern = !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_digit()) && !rest.starts_with('0');
    match rest.parse::<u32>() {
        Ok(n) if ziffern => Deutung::Nummer(n),
        _ => Deutung::Falsch,
    }
}

const PRAEFIX: &str = "braucht:";

/// Die gedeuteten Nummern in der Reihenfolge der Labels; dieselbe Nummer einmal (beim ersten Vorkommen).
pub fn braucht_nummern(labels: &[String]) -> Vec<u32> {
    let mut nummern: Vec<u32> = vec![];
    for l in labels {
        if let Deutung::Nummer(n) = deuten(l)
            && !nummern.contains(&n)
        {
            nummern.push(n);
        }
    }
    nummern
}

/// Erledigt ist eine Aufgabe, wenn sie archiviert ist oder auf einem der Boards in dessen letzter Spalte liegt
/// (ADR-0035 Punkt 3) — dieselbe Entscheidung trifft `POST /api/aufgaben/erledigen` für sein Board.
pub fn ist_erledigt<'a>(a: &Aufgabe, boards: impl IntoIterator<Item = &'a Board>) -> bool {
    a.archiviert.is_some() || boards.into_iter().any(|b| b.abschlussspalte().is_some_and(|s| s.aufgaben.contains(&a.nummer)))
}

/// Das Feld `braucht` zu den Labels einer Aufgabe: `finde` liefert die gebrauchte Aufgabe, wenn ihre Datei lesbar ist.
pub fn abhaengigkeiten<'a>(labels: &[String], finde: impl Fn(u32) -> Option<&'a Aufgabe>, boards: &[Board]) -> Vec<Abhaengigkeit> {
    let eintrag = |nummer: u32| match finde(nummer) {
        Some(a) => Abhaengigkeit { nummer, erledigt: ist_erledigt(a, boards), titel: Some(a.titel.clone()) },
        None => Abhaengigkeit { nummer, titel: None, erledigt: false },
    };
    braucht_nummern(labels).into_iter().map(eintrag).collect()
}

// ---- Prüfung an der Tür (ADR-0035 Punkt 2) ----------------------------------------------------------------------------
// Die Meldungen stehen hier an einer Stelle; Wortlaut nach Entscheidung des PO (po-entscheidungen Z. 452).
// Sie nennen nur Nummern und festen Text, nie den Rest eines abgewiesenen Labels (R00214, Sicherheit).

/// Ein Label mit dem Präfix `braucht:` in anderer Form.
pub const FORM_MELDUNG: &str = "braucht: erwartet eine Kartennummer (braucht:12)";

pub fn selbstbezug_meldung(nummer: u32) -> String {
    format!("#{nummer} kann nicht auf sich selbst warten")
}

pub fn unbekannt_meldung(nummer: u32) -> String {
    format!("Aufgabe #{nummer} gibt es nicht (braucht:{nummer})")
}

/// Die neu hinzukommenden Labels mit dem Präfix `braucht:` — „neu“ heißt: in der gespeicherten Liste steht es nicht,
/// verglichen ohne Groß/Klein. Unverändert mitgeschickte Labels prüft die Tür nie (wie `klasse`, R00195).
pub fn neue_braucht_labels<'a>(vorher: &[String], nachher: &'a [String]) -> Vec<&'a str> {
    let gespeichert: Vec<String> = vorher.iter().map(|l| l.trim().to_lowercase()).collect();
    nachher.iter().map(|l| l.as_str()).filter(|l| deuten(l) != Deutung::Keine && !gespeichert.contains(&l.trim().to_lowercase())).collect()
}

/// Prüft die neuen `braucht:`-Labels der Aufgabe `nummer` der Reihe nach — Form, Selbstbezug, unbekannte Nummer; der
/// erste Fehler gewinnt. `gibt_es` sagt, ob es zur Nummer eine Aufgabendatei im Ordner gibt (archivierte zählen).
/// Liefert die neuen Kanten `nummer → n` als Ziele in Label-Reihenfolge.
pub fn an_der_tuer(nummer: u32, neue: &[&str], gibt_es: impl Fn(u32) -> bool) -> Result<Vec<u32>, String> {
    let mut ziele = vec![];
    for label in neue {
        let n = match deuten(label) {
            Deutung::Nummer(n) => n,
            Deutung::Falsch | Deutung::Keine => return Err(FORM_MELDUNG.into()),
        };
        if n == nummer {
            return Err(selbstbezug_meldung(n));
        }
        if !gibt_es(n) {
            return Err(unbekannt_meldung(n));
        }
        if !ziele.contains(&n) {
            ziele.push(n);
        }
    }
    Ok(ziele)
}

pub fn kreis_meldung(ziel: u32, kreis: &[u32]) -> String {
    let pfeile: Vec<String> = kreis.iter().map(|n| format!("#{n}")).collect();
    format!("braucht:{ziel} ergäbe einen Kreis: {}", pfeile.join(" → "))
}

/// Der erste Kreis, den eine neue Kante schließt. `kanten` ist der Stand nach dem Schreiben (je Aufgabe die gedeuteten
/// Nummern, in Label-Reihenfolge), `neue` sind die neuen Kanten `a → b` in Prüfreihenfolge. Gesucht wird je neuer Kante
/// der kürzeste Weg von `b` zurück zu `a`; Kreise im Bestand ohne neue Kante stören nicht. Liefert `(a, b, [a, b, …, a])`.
pub fn kreis_suchen(kanten: &BTreeMap<u32, Vec<u32>>, neue: &[(u32, u32)]) -> Option<(u32, u32, Vec<u32>)> {
    neue.iter().find_map(|&(a, b)| weg(kanten, b, a).map(|w| (a, b, std::iter::once(a).chain(w).collect())))
}

/// Kürzester Weg `von → … → nach` (Breitensuche in Label-Reihenfolge), beide Enden eingeschlossen.
fn weg(kanten: &BTreeMap<u32, Vec<u32>>, von: u32, nach: u32) -> Option<Vec<u32>> {
    let mut vorgaenger: BTreeMap<u32, u32> = BTreeMap::new();
    let mut warteschlange = std::collections::VecDeque::from([von]);
    while let Some(knoten) = warteschlange.pop_front() {
        if knoten == nach {
            let mut w = vec![nach];
            while let Some(&v) = vorgaenger.get(w.last().expect("nie leer")) {
                w.push(v);
            }
            w.reverse();
            return Some(w);
        }
        for &n in kanten.get(&knoten).into_iter().flatten() {
            if n != von && !vorgaenger.contains_key(&n) {
                vorgaenger.insert(n, knoten);
                warteschlange.push_back(n);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn graph(k: &[(u32, &[u32])]) -> BTreeMap<u32, Vec<u32>> {
        k.iter().map(|(a, b)| (*a, b.to_vec())).collect()
    }

    // R00214 B1088: Kreis aus 2 und 3 Knoten, aus zwei neuen Kanten im selben Aufruf, Bestandskreis ohne neue Kante
    #[test]
    fn kreis_je_lage() {
        assert_eq!(kreis_suchen(&graph(&[(1, &[2]), (2, &[1])]), &[(1, 2)]), Some((1, 2, vec![1, 2, 1])), "AK 10");
        assert_eq!(kreis_suchen(&graph(&[(1, &[3]), (3, &[2]), (2, &[1])]), &[(1, 3)]), Some((1, 3, vec![1, 3, 2, 1])), "AK 10, drei Knoten");
        assert_eq!(kreis_suchen(&graph(&[(1, &[5]), (5, &[1])]), &[(1, 5), (5, 1)]), Some((1, 5, vec![1, 5, 1])), "zwei neue Kanten, die erste nennt ihn");
        assert_eq!(kreis_suchen(&graph(&[(1, &[2]), (2, &[3]), (3, &[2])]), &[(1, 2)]), None, "Bestandskreis #2 ↔ #3 ohne neue Kante darin");
        assert_eq!(kreis_suchen(&graph(&[(1, &[2]), (2, &[3]), (3, &[4])]), &[(1, 2)]), None, "Kette ohne Rückweg");
        assert_eq!(kreis_suchen(&graph(&[(1, &[2]), (2, &[2, 9])]), &[(1, 2)]), None, "Selbstkante und unbekannte Nummer im Bestand");
        let zwei_wege = graph(&[(1, &[2]), (2, &[3, 1]), (3, &[1])]);
        assert_eq!(kreis_suchen(&zwei_wege, &[(1, 2)]), Some((1, 2, vec![1, 2, 1])), "der kürzeste Weg");
        assert_eq!(kreis_suchen(&graph(&[(1, &[2]), (2, &[3]), (3, &[4]), (4, &[2])]), &[(1, 2)]), None, "Kreis hinter der neuen Kante, nicht durch sie");
        assert_eq!(kreis_suchen(&graph(&[(1, &[2])]), &[]), None);
    }

    #[test]
    fn kreis_meldung_in_pfeilform() {
        assert_eq!(kreis_meldung(2, &[1, 2, 1]), "braucht:2 ergäbe einen Kreis: #1 → #2 → #1");
        assert_eq!(kreis_meldung(3, &[1, 3, 2, 1]), "braucht:3 ergäbe einen Kreis: #1 → #3 → #2 → #1");
    }

    // R00214 B1087: neu ist, was nicht gespeichert ist (ohne Groß/Klein); nur Labels mit Präfix
    #[test]
    fn neu_ist_nur_was_nicht_gespeichert_ist() {
        let vorher = labels(&["braucht:abc", "braucht:888", "ui"]);
        assert_eq!(neue_braucht_labels(&vorher, &labels(&["braucht:abc", "braucht:888", "prio"])), Vec::<&str>::new(), "AK 11");
        assert_eq!(neue_braucht_labels(&vorher, &labels(&["braucht:abc", "braucht:888", "braucht:777"])), vec!["braucht:777"]);
        assert_eq!(neue_braucht_labels(&vorher, &labels(&["BRAUCHT:ABC", "Braucht:888"])), Vec::<&str>::new(), "ohne Groß/Klein");
        assert_eq!(neue_braucht_labels(&[], &labels(&["braucht", "brauchtnix", "braucht:x", "braucht:1"])), vec!["braucht:x", "braucht:1"]);
        assert_eq!(neue_braucht_labels(&labels(&["braucht:1"]), &labels(&["braucht:01"])), vec!["braucht:01"], "andere Schreibweise der Zahl ist neu");
    }

    // R00214 AK 7–9: Reihenfolge der Labels, erster Fehler gewinnt; Meldungen ohne den Rest des Labels
    #[test]
    fn tuer_form_selbstbezug_unbekannt() {
        let gibt_es = |n: u32| [1, 2, 3, 4, 5].contains(&n);
        for falsch in ["braucht:x", "braucht:012", "braucht:0", "braucht: 1", "BRAUCHT:kd#12", "braucht:<script>"] {
            assert_eq!(an_der_tuer(5, &[falsch], gibt_es), Err(FORM_MELDUNG.to_string()), "{falsch}");
        }
        assert_eq!(an_der_tuer(5, &["braucht:5"], gibt_es), Err("#5 kann nicht auf sich selbst warten".into()));
        assert_eq!(an_der_tuer(5, &["braucht:999"], gibt_es), Err("Aufgabe #999 gibt es nicht (braucht:999)".into()));
        assert_eq!(an_der_tuer(5, &["braucht:4", "Braucht:1", "braucht:4"], gibt_es), Ok(vec![4, 1]));
        assert_eq!(an_der_tuer(5, &["braucht:999", "braucht:x"], gibt_es), Err(unbekannt_meldung(999)), "der erste Fehler in Label-Reihenfolge");
        assert_eq!(an_der_tuer(5, &["braucht:x", "braucht:5"], gibt_es), Err(FORM_MELDUNG.into()));
        assert_eq!(an_der_tuer(5, &["braucht:5", "braucht:999"], gibt_es), Err(selbstbezug_meldung(5)));
        assert_eq!(an_der_tuer(5, &[], gibt_es), Ok(vec![]));
    }

    fn labels(l: &[&str]) -> Vec<String> {
        l.iter().map(|x| x.to_string()).collect()
    }

    // R00214 B1084: Form ohne Groß/Klein, n ≥ 1 ohne führende Null; andere Form mit Präfix ist Falsch, ohne Präfix Keine
    #[test]
    fn deutung_je_form() {
        for (label, nummer) in [("braucht:1", 1), ("BRAUCHT:3", 3), ("Braucht:226", 226), ("bRaUcHt:42", 42), (" braucht:7 ", 7), ("braucht:4294967295", u32::MAX)] {
            assert_eq!(deuten(label), Deutung::Nummer(nummer), "{label:?}");
        }
        for label in ["braucht:", "braucht:abc", "braucht:kd#12", "braucht:012", "braucht:0", "braucht: 3", "braucht:3 4", "braucht:-1", "braucht:+1", "braucht:1.0", "braucht:I0004", "braucht:4294967296", "BRAUCHT:x", "braucht:١"] {
            assert_eq!(deuten(label), Deutung::Falsch, "{label:?}");
        }
        for label in ["braucht", "brauchtnix", "brauch:1", "feature", "", "nc:304", "xbraucht:1", "ä"] {
            assert_eq!(deuten(label), Deutung::Keine, "{label:?}");
        }
    }

    // R00214 AK 3: Reihenfolge der Labels, Dubletten einmal (auch in anderer Schreibweise), andere Form stumm
    #[test]
    fn nummern_in_label_reihenfolge_ohne_dubletten() {
        let l = labels(&["BRAUCHT:3", "braucht:1", "Braucht:1", "braucht:abc", "braucht:kd#12", "braucht:012", "braucht:0", "braucht:999"]);
        assert_eq!(braucht_nummern(&l), vec![3, 1, 999]);
        assert_eq!(braucht_nummern(&labels(&["feature", "braucht:226"])), vec![226], "Bestandsform");
        assert_eq!(braucht_nummern(&[]), Vec::<u32>::new());
    }

    fn board(slug: &str, spalten: &[(&str, &[u32])]) -> Board {
        let mut text = format!("# {slug}\n");
        for (name, nummern) in spalten {
            text.push_str(&format!("\n## {name}\n\n"));
            for n in *nummern {
                text.push_str(&format!("- #{n}\n"));
            }
        }
        crate::format::board::lesen(slug, &text).unwrap()
    }

    fn karte(nr: u32, archiviert: bool) -> Aufgabe {
        let mut a = Aufgabe::neu(nr, format!("{nr:04}-x.md"), "x".into());
        a.archiviert = archiviert.then(|| "2026-11-01".into());
        a
    }

    // R00214 B1084: archiviert × letzte Spalte × kein Board × zwei Boards (PO-Frage 1, Vorschlag: eines genügt)
    #[test]
    fn erledigt_je_lage() {
        let e = board("e", &[("Offen", &[1, 2]), ("In Arbeit", &[3]), ("Fertig", &[4])]);
        let f = board("f", &[("Eingang", &[4, 5]), ("Fertig", &[2])]);
        let leer = board("leer", &[]);
        assert!(!ist_erledigt(&karte(1, false), [&e]), "Offen");
        assert!(!ist_erledigt(&karte(3, false), [&e]), "In Arbeit");
        assert!(ist_erledigt(&karte(4, false), [&e]), "letzte Spalte");
        assert!(ist_erledigt(&karte(1, true), [&e]), "archiviert, auch auf dem Board in Offen");
        assert!(ist_erledigt(&karte(9, true), [&e]), "archiviert, auf keinem Board");
        assert!(!ist_erledigt(&karte(9, false), [&e, &f]), "auf keinem Board, nicht archiviert: offen");
        assert!(!ist_erledigt(&karte(9, false), []), "ohne Boards offen");
        assert!(ist_erledigt(&karte(2, false), [&e, &f]), "auf e offen, auf f in der letzten Spalte");
        assert!(ist_erledigt(&karte(4, false), [&e, &f]), "auf e in der letzten Spalte, auf f offen");
        assert!(!ist_erledigt(&karte(5, false), [&e, &f]), "nur auf f, dort offen");
        assert!(!ist_erledigt(&karte(1, false), [&leer]), "Board ohne Spalten");
    }

    // R00214 AK 1–3: Titel und Erledigt der gebrauchten Aufgabe, fehlende oder unlesbare Datei titel null, erledigt false
    #[test]
    fn abhaengigkeiten_in_label_reihenfolge() {
        let e = board("e", &[("Offen", &[1]), ("Fertig", &[3])]);
        let mut geruest = karte(1, false);
        geruest.titel = "Gerüst".into();
        let mut alt = karte(4, true);
        alt.titel = "Alt".into();
        let alle = [geruest, karte(3, false), alt];
        let finde = |n: u32| alle.iter().find(|a| a.nummer == n);
        let eintrag = |nummer: u32, titel: Option<&str>, erledigt: bool| Abhaengigkeit { nummer, titel: titel.map(Into::into), erledigt };
        assert_eq!(abhaengigkeiten(&labels(&["feature", "braucht:1"]), finde, &[e.clone()]), vec![eintrag(1, Some("Gerüst"), false)]);
        assert_eq!(
            abhaengigkeiten(&labels(&["braucht:999", "BRAUCHT:3", "braucht:4", "braucht:abc", "braucht:3"]), finde, &[e.clone()]),
            vec![eintrag(999, None, false), eintrag(3, Some("x"), true), eintrag(4, Some("Alt"), true)]
        );
        assert_eq!(abhaengigkeiten(&labels(&["ui"]), finde, &[e]), vec![]);
        let json = serde_json::to_value(eintrag(999, None, false)).unwrap();
        assert_eq!(json, serde_json::json!({"nummer": 999, "titel": null, "erledigt": false}));
    }
}
