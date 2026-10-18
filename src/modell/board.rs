use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Spalte {
    pub name: String,
    pub grenze: Option<u32>,
    pub aufgaben: Vec<u32>,
}

/// Inhalt einer Board-Datei: die Struktur und wo jede Aufgabe darin liegt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Board {
    pub slug: String,
    pub titel: String,
    pub spalten: Vec<Spalte>,
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

#[derive(Debug, PartialEq, Eq)]
pub enum Bewegfehler {
    NichtAufDemBoard,
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
