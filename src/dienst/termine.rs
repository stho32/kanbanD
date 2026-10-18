use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::{Person, Termin};

fn tt_mm_jjjj(datum: &str) -> String {
    let t: Vec<&str> = datum.split('-').collect();
    format!("{}.{}.{}", t[2], t[1], t[0])
}

/// Commit-Nachricht: genau ein Termin dazu oder weg wird benannt, sonst die Sammelnachricht.
fn nachricht(alt: &[Termin], neu: &[Termin], board: &str) -> String {
    let dazu: Vec<&Termin> = neu.iter().filter(|t| !alt.contains(t)).collect();
    let weg: Vec<&Termin> = alt.iter().filter(|t| !neu.contains(t)).collect();
    match (dazu.as_slice(), weg.as_slice()) {
        ([t], []) => format!("Termin „{}“ ({}) angelegt in „{board}“", t.name, tt_mm_jjjj(&t.datum)),
        ([], [t]) => format!("Termin „{}“ ({}) entfernt aus „{board}“", t.name, tt_mm_jjjj(&t.datum)),
        _ => format!("Termine von „{board}“ geändert"),
    }
}

impl Kanban {
    /// Ersetzt die Termine des Boards, nach Datum sortiert; ohne Änderung kein Commit.
    pub fn termine_setzen(&self, wer: &Person, slug: &str, mut neu: Vec<Termin>) -> Result<bool, Fehler> {
        for t in &mut neu {
            t.name = t.name.trim().to_string();
            t.pruefen().map_err(Fehler::Ungueltig)?;
        }
        neu.sort_by(|a, b| a.datum.cmp(&b.datum).then(a.name.cmp(&b.name)));
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        if b.termine == neu {
            return Ok(false);
        }
        let text = nachricht(&b.termine, &neu, &b.titel);
        b.termine = neu;
        self.aktion(wer, &text, &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::{Linie, Staerke};

    fn t(name: &str, datum: &str) -> Termin {
        Termin { name: name.into(), datum: datum.into(), farbe: "red".into(), linie: Linie::Durchgehend, staerke: Staerke::Normal }
    }

    #[test]
    fn nachricht_nennt_den_einzelnen_termin() {
        let a = t("Deadline", "2027-10-31");
        let b = t("Review", "2026-11-15");
        assert_eq!(nachricht(&[], std::slice::from_ref(&a), "E"), "Termin „Deadline“ (31.10.2027) angelegt in „E“");
        assert_eq!(nachricht(&[a.clone(), b.clone()], std::slice::from_ref(&a), "E"), "Termin „Review“ (15.11.2026) entfernt aus „E“");
        assert_eq!(nachricht(std::slice::from_ref(&a), &[t("Deadline", "2027-11-30")], "E"), "Termine von „E“ geändert");
        assert_eq!(nachricht(&[], &[a, b], "E"), "Termine von „E“ geändert");
    }
}
