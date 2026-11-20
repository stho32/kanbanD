//! `Braucht` zwischen Karten (R00214, ADR-0035): das Label `braucht:<n>` ist der eine Träger einer Abhängigkeit —
//! „diese Aufgabe wartet auf #n“. Hier steht seine Deutung als reine Funktionen, ohne Dateien und ohne HTTP.

use super::{Aufgabe, Board};

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

#[cfg(test)]
mod tests {
    use super::*;

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
}
