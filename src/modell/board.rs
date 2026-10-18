use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Spalte {
    pub name: String,
    pub grenze: Option<u32>,
    pub aufgaben: Vec<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Linie {
    #[default]
    Durchgehend,
    Gestrichelt,
    Gepunktet,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Staerke {
    Fein,
    #[default]
    Normal,
    Fett,
}

/// Ein fester Termin des Boards, gezeichnet in „Wie lange noch“.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Termin {
    pub name: String,
    pub datum: String,
    pub farbe: String,
    #[serde(default)]
    pub linie: Linie,
    #[serde(default)]
    pub staerke: Staerke,
}

impl Termin {
    /// Name nicht leer, Datum JJJJ-MM-TT, Farbe ein Palettenname oder #Hex.
    pub fn pruefen(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Ein Termin braucht einen Namen".into());
        }
        if self.datum.len() != 10 || chrono::NaiveDate::parse_from_str(&self.datum, "%Y-%m-%d").is_err() {
            return Err(format!("Termin „{}“: Datum „{}“ ist nicht JJJJ-MM-TT", self.name, self.datum));
        }
        let farbe_ok = !self.farbe.is_empty() && (self.farbe.chars().all(|c| c.is_ascii_lowercase()) || (self.farbe.len() == 7 && self.farbe.starts_with('#') && self.farbe[1..].chars().all(|c| c.is_ascii_hexdigit())));
        if !farbe_ok {
            return Err(format!("Termin „{}“: Farbe „{}“ ist kein Palettenname und kein #rrggbb", self.name, self.farbe));
        }
        Ok(())
    }
}

/// Inhalt einer Board-Datei: die Struktur, wo jede Aufgabe darin liegt, feste Termine und gebundene Anwendungen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Board {
    pub slug: String,
    pub titel: String,
    pub spalten: Vec<Spalte>,
    #[serde(default)]
    pub termine: Vec<Termin>,
    /// Kürzel registrierter Anwendungen (`applications:`); leer heißt reines Kanban.
    #[serde(default)]
    pub anwendungen: Vec<String>,
}

impl Board {
    pub fn spalte_mut(&mut self, name: &str) -> Option<&mut Spalte> {
        self.spalten.iter_mut().find(|s| s.name == name)
    }

    /// Die Spalte, in der die Aufgabe liegt, falls sie auf diesem Board liegt.
    pub fn spalte_von(&self, nummer: u32) -> Option<&Spalte> {
        self.spalten.iter().find(|s| s.aufgaben.contains(&nummer))
    }

    pub fn abschlussspalte(&self) -> Option<&Spalte> {
        self.spalten.last()
    }

    /// Hängt die Aufgabe unten an die Spalte (ohne Angabe: die erste). Liefert den Spaltennamen.
    pub fn aufnehmen(&mut self, nummer: u32, spalte: Option<&str>) -> Result<String, Bewegfehler> {
        if self.spalte_von(nummer).is_some() {
            return Err(Bewegfehler::SchonAufDemBoard);
        }
        let ziel = match spalte {
            Some(s) => self.spalte_mut(s).ok_or(Bewegfehler::SpalteUnbekannt)?,
            None => self.spalten.first_mut().ok_or(Bewegfehler::SpalteUnbekannt)?,
        };
        ziel.aufgaben.push(nummer);
        Ok(ziel.name.clone())
    }

    /// Nimmt die Aufgabe vom Board; liefert, ob sie dort lag.
    pub fn abnehmen(&mut self, nummer: u32) -> bool {
        let vorher: usize = self.spalten.iter().map(|s| s.aufgaben.len()).sum();
        for s in &mut self.spalten {
            s.aufgaben.retain(|n| *n != nummer);
        }
        self.spalten.iter().map(|s| s.aufgaben.len()).sum::<usize>() < vorher
    }

    /// Nimmt die Aufgabe aus ihrer Spalte und setzt sie an `index` der Zielspalte (ohne Index oder
    /// zu groß: ans Ende). Liefert, ob sich etwas geändert hat.
    pub fn bewegen(&mut self, nummer: u32, ziel: &str, index: Option<usize>) -> Result<bool, Bewegfehler> {
        if !self.spalten.iter().any(|s| s.name == ziel) {
            return Err(Bewegfehler::SpalteUnbekannt);
        }
        let vorher = self.spalten.clone();
        let quelle = self.spalten.iter_mut().find(|s| s.aufgaben.contains(&nummer)).ok_or(Bewegfehler::NichtAufDemBoard)?;
        quelle.aufgaben.retain(|n| *n != nummer);
        let z = self.spalte_mut(ziel).expect("geprüft");
        let i = index.unwrap_or(z.aufgaben.len()).min(z.aufgaben.len());
        z.aufgaben.insert(i, nummer);
        Ok(self.spalten != vorher)
    }
}

/// Eine Spalte in der neuen Reihenfolge; `alt` ist der bisherige Name, dessen Aufgaben sie übernimmt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpaltenAenderung {
    pub name: String,
    pub alt: Option<String>,
    pub grenze: Option<u32>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Spaltenfehler {
    NameLeer,
    NameDoppelt(String),
    AltUnbekannt(String),
    AltDoppelt(String),
    EnthaeltAufgaben(String, usize),
}

impl Board {
    /// Setzt die Spalten neu. Bisherige Spalten mit Aufgaben müssen als `alt` vorkommen.
    pub fn spalten_setzen(&mut self, neu: &[SpaltenAenderung]) -> Result<bool, Spaltenfehler> {
        let mut namen: Vec<&str> = vec![];
        let mut alte: Vec<&str> = vec![];
        for n in neu {
            let name = n.name.trim();
            if name.is_empty() {
                return Err(Spaltenfehler::NameLeer);
            }
            if namen.contains(&name) {
                return Err(Spaltenfehler::NameDoppelt(name.into()));
            }
            namen.push(name);
            if let Some(alt) = n.alt.as_deref() {
                if !self.spalten.iter().any(|s| s.name == alt) {
                    return Err(Spaltenfehler::AltUnbekannt(alt.into()));
                }
                if alte.contains(&alt) {
                    return Err(Spaltenfehler::AltDoppelt(alt.into()));
                }
                alte.push(alt);
            }
        }
        if let Some(voll) = self.spalten.iter().find(|s| !s.aufgaben.is_empty() && !alte.contains(&s.name.as_str())) {
            return Err(Spaltenfehler::EnthaeltAufgaben(voll.name.clone(), voll.aufgaben.len()));
        }
        let spalten: Vec<Spalte> = neu
            .iter()
            .map(|n| Spalte {
                name: n.name.trim().into(),
                grenze: n.grenze.filter(|g| *g > 0),
                aufgaben: n.alt.as_deref().and_then(|a| self.spalten.iter().find(|s| s.name == a)).map(|s| s.aufgaben.clone()).unwrap_or_default(),
            })
            .collect();
        let geaendert = spalten != self.spalten;
        self.spalten = spalten;
        Ok(geaendert)
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum Bewegfehler {
    NichtAufDemBoard,
    SchonAufDemBoard,
    SpalteUnbekannt,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn b() -> Board {
        Board {
            slug: "b".into(),
            titel: "B".into(),
            spalten: vec![
                Spalte { name: "A".into(), grenze: None, aufgaben: vec![1, 2] },
                Spalte { name: "Z".into(), grenze: None, aufgaben: vec![3] },
            ],
            termine: vec![],
            anwendungen: vec![],
        }
    }

    #[test]
    fn bewegen_in_andere_spalte_und_innerhalb() {
        let mut b = b();
        assert_eq!(b.bewegen(2, "Z", None), Ok(true));
        assert_eq!((b.spalten[0].aufgaben.clone(), b.spalten[1].aufgaben.clone()), (vec![1], vec![3, 2]));
        assert_eq!(b.bewegen(2, "Z", Some(0)), Ok(true));
        assert_eq!(b.spalten[1].aufgaben, vec![2, 3]);
        assert_eq!(b.bewegen(1, "Z", Some(99)), Ok(true));
        assert_eq!(b.spalten[1].aufgaben, vec![2, 3, 1]);
    }

    #[test]
    fn gleiche_stelle_ist_keine_aenderung_und_fehler_werden_benannt() {
        let mut b = b();
        assert_eq!(b.bewegen(2, "A", Some(1)), Ok(false));
        assert_eq!(b.bewegen(9, "A", None), Err(Bewegfehler::NichtAufDemBoard));
        assert_eq!(b.bewegen(1, "X", None), Err(Bewegfehler::SpalteUnbekannt));
        assert_eq!(b.spalten[0].aufgaben, vec![1, 2]);
    }

    fn aend(name: &str, alt: Option<&str>, grenze: Option<u32>) -> SpaltenAenderung {
        SpaltenAenderung { name: name.into(), alt: alt.map(Into::into), grenze }
    }

    #[test]
    fn spalten_umbenennen_ergaenzen_begrenzen() {
        let mut b = b();
        b.spalten.insert(1, Spalte { name: "B".into(), grenze: None, aufgaben: vec![] });
        let neu = [aend("Offen", Some("A"), None), aend("Neu", None, Some(0)), aend("Z", Some("Z"), Some(2))];
        assert_eq!(b.spalten_setzen(&neu), Ok(true));
        let namen: Vec<(&str, Vec<u32>, Option<u32>)> = b.spalten.iter().map(|s| (s.name.as_str(), s.aufgaben.clone(), s.grenze)).collect();
        assert_eq!(namen, vec![("Offen", vec![1, 2], None), ("Neu", vec![], None), ("Z", vec![3], Some(2))]);
        let gleich = [aend("Offen", Some("Offen"), None), aend("Neu", Some("Neu"), None), aend("Z", Some("Z"), Some(2))];
        assert_eq!(b.spalten_setzen(&gleich), Ok(false));
    }

    #[test]
    fn spalten_regeln() {
        let mut b = b();
        assert_eq!(b.spalten_setzen(&[aend("Z", Some("Z"), None)]), Err(Spaltenfehler::EnthaeltAufgaben("A".into(), 2)));
        assert_eq!(b.spalten_setzen(&[aend(" ", Some("A"), None)]), Err(Spaltenfehler::NameLeer));
        assert_eq!(b.spalten_setzen(&[aend("X", Some("A"), None), aend("X", Some("Z"), None)]), Err(Spaltenfehler::NameDoppelt("X".into())));
        assert_eq!(b.spalten_setzen(&[aend("X", Some("Q"), None)]), Err(Spaltenfehler::AltUnbekannt("Q".into())));
        assert_eq!(b.spalten_setzen(&[aend("X", Some("A"), None), aend("Y", Some("A"), None)]), Err(Spaltenfehler::AltDoppelt("A".into())));
        assert_eq!(b.spalten.len(), 2);
    }

    #[test]
    fn aufnehmen_und_abnehmen() {
        let mut b = b();
        assert_eq!(b.aufnehmen(7, None), Ok("A".into()));
        assert_eq!(b.aufnehmen(8, Some("Z")), Ok("Z".into()));
        assert_eq!(b.spalten[1].aufgaben, vec![3, 8]);
        assert_eq!(b.aufnehmen(7, Some("Z")), Err(Bewegfehler::SchonAufDemBoard));
        assert_eq!(b.aufnehmen(9, Some("X")), Err(Bewegfehler::SpalteUnbekannt));
        assert!(b.abnehmen(7));
        assert!(!b.abnehmen(7));
        assert_eq!(b.spalten[0].aufgaben, vec![1, 2]);
        let mut leer = Board { slug: "l".into(), titel: "L".into(), spalten: vec![], termine: vec![], anwendungen: vec![] };
        assert_eq!(leer.aufnehmen(1, None), Err(Bewegfehler::SpalteUnbekannt));
    }

    #[test]
    fn spalten_finden() {
        let mut b = b();
        assert_eq!(b.spalte_von(3).unwrap().name, "Z");
        assert!(b.spalte_von(9).is_none());
        assert_eq!(b.abschlussspalte().unwrap().name, "Z");
        b.spalte_mut("A").unwrap().aufgaben.push(4);
        assert_eq!(b.spalten[0].aufgaben, vec![1, 2, 4]);
        assert!(b.spalte_mut("X").is_none());
    }
}
