use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Spalte {
    pub name: String,
    pub grenze: Option<u32>,
    pub aufgaben: Vec<u32>,
    /// Phase der Anwendung, die diese Spalte darstellt (`column-phases`); keine heißt an keine Phase gebunden.
    #[serde(default)]
    pub phase: Option<String>,
    /// Plausibilitätsprüfungen beim Verlassen nach rechts (`column-checks`), z. B. `wbs-effects-green`.
    #[serde(default)]
    pub pruefungen: Vec<String>,
    /// Kommentar zur Spalte (`column-notes`), im Spaltenkopf als ⓘ mit Tooltip.
    #[serde(default)]
    pub notiz: Option<String>,
    /// Hintergrundfarbe der Spalte als `#rrggbb` (`column-colors`).
    #[serde(default)]
    pub farbe: Option<String>,
}

/// `#rrggbb` — die einzige Form, in der eine Spaltenfarbe gilt.
pub fn ist_hexfarbe(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit())
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
    /// Zieltermin des Projekt-Fever-Charts (R00078); höchstens einer je Board.
    #[serde(default)]
    pub ziel: bool,
}

impl Termin {
    /// Name nicht leer, Datum JJJJ-MM-TT, Farbe ein Palettenname oder #Hex.
    pub fn pruefen(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("Ein Termin braucht einen Namen".into());
        }
        if !ist_datum(&self.datum) {
            return Err(format!("Termin „{}“: Datum „{}“ ist nicht JJJJ-MM-TT", self.name, self.datum));
        }
        let farbe_ok = !self.farbe.is_empty() && (self.farbe.chars().all(|c| c.is_ascii_lowercase()) || (self.farbe.len() == 7 && self.farbe.starts_with('#') && self.farbe[1..].chars().all(|c| c.is_ascii_hexdigit())));
        if !farbe_ok {
            return Err(format!("Termin „{}“: Farbe „{}“ ist kein Palettenname und kein #rrggbb", self.name, self.farbe));
        }
        Ok(())
    }
}

/// Einstellungen des Projekt-Fever-Charts (R00078): Puffer in Tagen der Einheit, Perzentil der Prognose,
/// Einheit (5 = Arbeitstage, 7 = Kalendertage), Zonengrenzen als Verbrauch in % bei 0 und bei 100 % Fortschritt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Fieber {
    #[serde(default)]
    pub puffer: Option<u32>,
    #[serde(default = "Fieber::perzentil_standard")]
    pub perzentil: u32,
    #[serde(default = "Fieber::woche_standard")]
    pub woche: u32,
    #[serde(default = "Fieber::gelb_standard")]
    pub gelb: [u32; 2],
    #[serde(default = "Fieber::rot_standard")]
    pub rot: [u32; 2],
    /// Spalte bzw. Phase, deren Block als „erledigt“ zählt (R00079); `None` = der letzte Block.
    #[serde(default)]
    pub zielspalte: Option<String>,
    /// Anzeige je Tag, Woche oder Monat (R00080): Abstand der Punkte in Tagen, 1, 7 oder 30.
    #[serde(default = "Fieber::aufloesung_standard")]
    pub aufloesung: u32,
}

pub const FIEBER_PERZENTILE: [u32; 4] = [50, 70, 85, 95];
/// Auflösung in Tagen und ihr Name in der Board-Datei.
pub const FIEBER_AUFLOESUNGEN: [(u32, &str); 3] = [(1, "day"), (7, "week"), (30, "month")];

impl Fieber {
    fn perzentil_standard() -> u32 {
        95
    }
    fn woche_standard() -> u32 {
        5
    }
    fn gelb_standard() -> [u32; 2] {
        [10, 70]
    }
    fn rot_standard() -> [u32; 2] {
        [30, 100]
    }
    fn aufloesung_standard() -> u32 {
        1
    }

    /// Puffer mindestens 1, Perzentil aus FIEBER_PERZENTILE, Woche 5 oder 7, Grenzen bis 1000 %, Gelb nicht über Rot.
    pub fn pruefen(&self) -> Result<(), String> {
        if self.puffer == Some(0) {
            return Err("Der Puffer muss mindestens einen Tag lang sein".into());
        }
        if !FIEBER_PERZENTILE.contains(&self.perzentil) {
            return Err(format!("Perzentil {} ist nicht 50, 70, 85 oder 95", self.perzentil));
        }
        if self.woche != 5 && self.woche != 7 {
            return Err(format!("Woche {} ist nicht 5 (Arbeitstage) oder 7 (Kalendertage)", self.woche));
        }
        if self.gelb.iter().chain(&self.rot).any(|g| *g > 1000) {
            return Err("Zonengrenzen liegen zwischen 0 und 1000 %".into());
        }
        if !FIEBER_AUFLOESUNGEN.iter().any(|(t, _)| *t == self.aufloesung) {
            return Err(format!("Auflösung {} ist nicht 1 (Tag), 7 (Woche) oder 30 (Monat)", self.aufloesung));
        }
        if self.zielspalte.as_deref().is_some_and(|z| z.trim().is_empty()) {
            return Err("Die Zielspalte braucht einen Namen".into());
        }
        if self.gelb[0] > self.rot[0] || self.gelb[1] > self.rot[1] {
            return Err("Die Grenze zu Gelb liegt über der zu Rot".into());
        }
        Ok(())
    }
}

impl Default for Fieber {
    fn default() -> Self {
        Fieber { puffer: None, perzentil: Self::perzentil_standard(), woche: Self::woche_standard(), gelb: Self::gelb_standard(), rot: Self::rot_standard(), zielspalte: None, aufloesung: Self::aufloesung_standard() }
    }
}

/// Zeiträume des Berichtsfilters, wie `ZEITRAEUME` in web/berichte.js.
pub const ZEITRAEUME: [&str; 11] = ["heute", "gestern", "woche", "vorwoche", "monat", "vormonat", "30", "90", "jahr", "alles", "eigen"];

/// Filter der Berichte (R00043), seit R00081 am Board: Zeitraum (mit von/bis bei „eigen“), ausgeschlossene Klassen
/// (`""` = ohne Klasse) und Spalten, nur diese Personen und Labels. Die Namen sind die des Browsers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Berichtsfilter {
    #[serde(default = "Berichtsfilter::zeitraum_standard")]
    pub zeitraum: String,
    #[serde(default)]
    pub von: String,
    #[serde(default)]
    pub bis: String,
    #[serde(default)]
    pub ohne_farben: Vec<String>,
    #[serde(default)]
    pub ohne_spalten: Vec<String>,
    #[serde(default)]
    pub personen: Vec<String>,
    #[serde(default)]
    pub labels: Vec<String>,
    /// Messbasis der Prognose (R00083): die letzten N Tage, gleitend.
    #[serde(default = "Berichtsfilter::messbasis_standard")]
    pub messbasis_tage: u32,
}

impl Berichtsfilter {
    fn zeitraum_standard() -> String {
        "alles".into()
    }
    pub fn messbasis_standard() -> u32 {
        90
    }

    /// Bekannter Zeitraum; von und bis leer oder ein Datum.
    pub fn pruefen(&self) -> Result<(), String> {
        if !ZEITRAEUME.contains(&self.zeitraum.as_str()) {
            return Err(format!("Zeitraum „{}“ ist unbekannt", self.zeitraum));
        }
        if !(1..=3650).contains(&self.messbasis_tage) {
            return Err(format!("Messbasis {} Tage liegt nicht zwischen 1 und 3650", self.messbasis_tage));
        }
        if let Some(d) = [&self.von, &self.bis].into_iter().find(|d| !d.is_empty() && !ist_datum(d)) {
            return Err(format!("„{d}“ ist nicht JJJJ-MM-TT"));
        }
        Ok(())
    }
}

impl Default for Berichtsfilter {
    fn default() -> Self {
        Berichtsfilter { zeitraum: Self::zeitraum_standard(), von: String::new(), bis: String::new(), ohne_farben: vec![], ohne_spalten: vec![], personen: vec![], labels: vec![], messbasis_tage: Self::messbasis_standard() }
    }
}

/// `JJJJ-MM-TT` mit gültigem Datum.
pub fn ist_datum(s: &str) -> bool {
    s.len() == 10 && chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()
}

/// Inhalt einer Board-Datei: die Struktur, wo jede Aufgabe darin liegt, feste Termine und gebundene Anwendungen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Board {
    pub slug: String,
    pub titel: String,
    pub spalten: Vec<Spalte>,
    #[serde(default)]
    pub termine: Vec<Termin>,
    /// Kürzel registrierter Anwendungen (`applications:`): `None` = Schlüssel fehlt (Standardbindung),
    /// `Some([])` = ausdrücklich keine, das Board ist reines Kanban (R00062).
    #[serde(default)]
    pub anwendungen: Option<Vec<String>>,
    /// Projektstart (R00078): Messbasis von „Wie lange noch“ und Beginn des Fever Charts; `None` = erste Aufgabe auf dem Board.
    #[serde(default)]
    pub start: Option<String>,
    #[serde(default)]
    pub fieber: Fieber,
    /// Filter der Berichte dieses Boards (R00081), für alle, die es ansehen.
    #[serde(default)]
    pub berichtsfilter: Berichtsfilter,
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

    /// Die Spalte rechts von `name`; die letzte Spalte hat keine (R00087).
    pub fn folgespalte(&self, name: &str) -> Option<&str> {
        let i = self.spalten.iter().position(|s| s.name == name)?;
        self.spalten.get(i + 1).map(|s| s.name.as_str())
    }

    /// Nimmt die Aufgabe aus ihrer Spalte und setzt sie an `index` der Zielspalte (zu groß: ans Ende;
    /// ohne Index: oben, R00086). Liefert, ob sich etwas geändert hat.
    pub fn bewegen(&mut self, nummer: u32, ziel: &str, index: Option<usize>) -> Result<bool, Bewegfehler> {
        if !self.spalten.iter().any(|s| s.name == ziel) {
            return Err(Bewegfehler::SpalteUnbekannt);
        }
        let vorher = self.spalten.clone();
        let quelle = self.spalten.iter_mut().find(|s| s.aufgaben.contains(&nummer)).ok_or(Bewegfehler::NichtAufDemBoard)?;
        quelle.aufgaben.retain(|n| *n != nummer);
        let z = self.spalte_mut(ziel).expect("geprüft");
        let i = index.unwrap_or(0).min(z.aufgaben.len());
        z.aufgaben.insert(i, nummer);
        Ok(self.spalten != vorher)
    }

    /// Nimmt alle genannten Karten heraus und setzt sie der Reihe nach an `index` ihrer Zielspalte (R00065);
    /// ohne Index oben, in der Reihenfolge der Anfrage (R00086). Prüft vorher alles; bei einem Fehler bleibt
    /// das Board unverändert.
    pub fn mehrere_bewegen(&mut self, ziele: &[(u32, &str, Option<usize>)]) -> Result<bool, Bewegfehler> {
        if ziele.iter().any(|(_, spalte, _)| !self.spalten.iter().any(|s| s.name == *spalte)) {
            return Err(Bewegfehler::SpalteUnbekannt);
        }
        if ziele.iter().any(|(nr, _, _)| self.spalte_von(*nr).is_none()) {
            return Err(Bewegfehler::NichtAufDemBoard);
        }
        let vorher = self.spalten.clone();
        for s in &mut self.spalten {
            s.aufgaben.retain(|n| !ziele.iter().any(|(nr, _, _)| nr == n));
        }
        let mut oben: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
        for (nr, spalte, index) in ziele {
            let naechste_oben = oben.entry(spalte).or_default();
            let i = index.unwrap_or(*naechste_oben);
            if index.is_none() {
                *naechste_oben += 1;
            }
            let z = self.spalte_mut(spalte).expect("geprüft");
            z.aufgaben.insert(i.min(z.aufgaben.len()), *nr);
        }
        Ok(self.spalten != vorher)
    }
}

/// Eine Spalte in der neuen Reihenfolge; `alt` ist der bisherige Name, dessen Aufgaben sie übernimmt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpaltenAenderung {
    pub name: String,
    pub alt: Option<String>,
    pub grenze: Option<u32>,
    /// `column-checks` der Spalte; fehlt das Feld, behält sie die der alten Spalte.
    #[serde(default)]
    pub pruefungen: Option<Vec<String>>,
    /// `column-notes`; fehlt das Feld, behält sie den der alten Spalte, ein leerer Text entfernt ihn.
    #[serde(default)]
    pub notiz: Option<String>,
    /// `column-colors` als `#rrggbb`; fehlt das Feld, behält sie die der alten Spalte, ein leerer Text entfernt sie.
    #[serde(default)]
    pub farbe: Option<String>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Spaltenfehler {
    NameLeer,
    NameDoppelt(String),
    AltUnbekannt(String),
    AltDoppelt(String),
    EnthaeltAufgaben(String, usize),
    FarbeUngueltig(String),
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
            if let Some(f) = n.farbe.as_deref().map(str::trim).filter(|f| !f.is_empty() && !ist_hexfarbe(f)) {
                return Err(Spaltenfehler::FarbeUngueltig(f.into()));
            }
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
            .map(|n| {
                let alt = n.alt.as_deref().and_then(|a| self.spalten.iter().find(|s| s.name == a));
                Spalte { name: n.name.trim().into(), grenze: n.grenze.filter(|g| *g > 0), aufgaben: alt.map(|s| s.aufgaben.clone()).unwrap_or_default(), phase: alt.and_then(|s| s.phase.clone()), pruefungen: n.pruefungen.as_ref().map(|p| p.iter().map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect()).unwrap_or_else(|| alt.map(|s| s.pruefungen.clone()).unwrap_or_default()), notiz: gesetzt_oder_alt(&n.notiz, alt.and_then(|s| s.notiz.clone())), farbe: gesetzt_oder_alt(&n.farbe, alt.and_then(|s| s.farbe.clone())) }
            })
            .collect();
        let geaendert = spalten != self.spalten;
        self.spalten = spalten;
        Ok(geaendert)
    }
}

/// Ein gesendeter Wert gilt, leer heißt entfernt; nicht gesendet behält den alten.
fn gesetzt_oder_alt(neu: &Option<String>, alt: Option<String>) -> Option<String> {
    match neu {
        Some(t) => Some(t.trim().to_string()).filter(|t| !t.is_empty()),
        None => alt,
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
                Spalte { notiz: None, farbe: None, name: "A".into(), grenze: None, aufgaben: vec![1, 2], phase: None, pruefungen: vec![] },
                Spalte { notiz: None, farbe: None, name: "Z".into(), grenze: None, aufgaben: vec![3], phase: None, pruefungen: vec![] },
            ],
            termine: vec![],
            anwendungen: None,
            start: None,
            fieber: Default::default(), berichtsfilter: Default::default(),
        }
    }

    #[test]
    fn bewegen_in_andere_spalte_und_innerhalb() {
        let mut b = b();
        assert_eq!(b.bewegen(2, "Z", Some(1)), Ok(true));
        assert_eq!((b.spalten[0].aufgaben.clone(), b.spalten[1].aufgaben.clone()), (vec![1], vec![3, 2]));
        assert_eq!(b.bewegen(2, "Z", Some(0)), Ok(true));
        assert_eq!(b.spalten[1].aufgaben, vec![2, 3]);
        assert_eq!(b.bewegen(1, "Z", Some(99)), Ok(true));
        assert_eq!(b.spalten[1].aufgaben, vec![2, 3, 1]);
    }

    #[test]
    fn folgespalte_rechts_daneben() {
        let b = b();
        assert_eq!(b.folgespalte("A"), Some("Z"));
        assert_eq!(b.folgespalte("Z"), None);
        assert_eq!(b.folgespalte("X"), None);
    }

    // R00086: ohne Index oben — auch beim Umsortieren in derselben Spalte
    #[test]
    fn ohne_index_landet_die_karte_oben() {
        let mut b = b();
        b.spalten[1].aufgaben = vec![5, 6];
        b.spalten[0].aufgaben = vec![1, 2, 3, 7];
        assert_eq!(b.bewegen(7, "Z", None), Ok(true));
        assert_eq!(b.spalten[1].aufgaben, vec![7, 5, 6]);
        assert_eq!(b.bewegen(3, "A", None), Ok(true));
        assert_eq!(b.spalten[0].aufgaben, vec![3, 1, 2]);
        assert_eq!(b.bewegen(3, "A", None), Ok(false), "schon oben");
    }

    #[test]
    fn mehrere_ohne_index_oben_in_anfragereihenfolge() {
        let mut b = b();
        b.spalten[0].aufgaben = vec![7, 8, 1];
        b.spalten[1].aufgaben = vec![5];
        assert_eq!(b.mehrere_bewegen(&[(7, "Z", None), (8, "Z", None)]), Ok(true));
        assert_eq!(b.spalten[1].aufgaben, vec![7, 8, 5]);
        assert_eq!(b.mehrere_bewegen(&[(1, "Z", None), (5, "A", Some(9))]), Ok(true));
        assert_eq!((b.spalten[0].aufgaben.clone(), b.spalten[1].aufgaben.clone()), (vec![5], vec![1, 7, 8]));
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
        SpaltenAenderung { name: name.into(), alt: alt.map(Into::into), grenze, pruefungen: None, notiz: None, farbe: None }
    }

    #[test]
    fn spalten_umbenennen_ergaenzen_begrenzen() {
        let mut b = b();
        b.spalten.insert(1, Spalte { notiz: None, farbe: None, name: "B".into(), grenze: None, aufgaben: vec![], phase: None, pruefungen: vec![] });
        let neu = [aend("Offen", Some("A"), None), aend("Neu", None, Some(0)), aend("Z", Some("Z"), Some(2))];
        assert_eq!(b.spalten_setzen(&neu), Ok(true));
        let namen: Vec<(&str, Vec<u32>, Option<u32>)> = b.spalten.iter().map(|s| (s.name.as_str(), s.aufgaben.clone(), s.grenze)).collect();
        assert_eq!(namen, vec![("Offen", vec![1, 2], None), ("Neu", vec![], None), ("Z", vec![3], Some(2))]);
        let gleich = [aend("Offen", Some("Offen"), None), aend("Neu", Some("Neu"), None), aend("Z", Some("Z"), Some(2))];
        assert_eq!(b.spalten_setzen(&gleich), Ok(false));
    }

    #[test]
    fn umbenennen_nimmt_die_phase_mit_entfernen_nimmt_sie_weg() {
        let mut b = b();
        b.spalten[0].phase = Some("Entwicklung".into());
        b.spalten.insert(1, Spalte { notiz: None, farbe: None, name: "B".into(), grenze: None, aufgaben: vec![], phase: Some("Abnahme".into()), pruefungen: vec![] });
        assert_eq!(b.spalten_setzen(&[aend("Bau", Some("A"), None), aend("Neu", None, None), aend("Z", Some("Z"), None)]), Ok(true));
        assert_eq!(b.spalten.iter().map(|s| s.phase.as_deref()).collect::<Vec<_>>(), [Some("Entwicklung"), None, None]);
    }

    #[test]
    fn umbenennen_nimmt_die_pruefungen_mit_entfernen_nimmt_sie_weg() {
        let mut b = b();
        b.spalten[0].pruefungen = vec!["wbs-effects-green".into()];
        b.spalten[1].pruefungen = vec!["wbs-effects-green".into()];
        assert_eq!(b.spalten_setzen(&[aend("Bau", Some("A"), None), aend("Neu", None, None)]), Err(Spaltenfehler::EnthaeltAufgaben("Z".into(), 1)));
        b.spalten[1].aufgaben.clear();
        assert_eq!(b.spalten_setzen(&[aend("Bau", Some("A"), None), aend("Neu", None, None)]), Ok(true));
        assert_eq!(b.spalten.iter().map(|s| s.pruefungen.len()).collect::<Vec<_>>(), [1, 0]);
        let setzen = |p: &[&str]| SpaltenAenderung { pruefungen: Some(p.iter().map(|x| x.to_string()).collect()), ..aend("Neu", Some("Neu"), None) };
        assert_eq!(b.spalten_setzen(&[aend("Bau", Some("Bau"), None), setzen(&["wbs-effects-green", " "])]), Ok(true));
        assert_eq!(b.spalten[1].pruefungen, ["wbs-effects-green"], "gesetzt, leere fallen weg");
        assert_eq!(b.spalten_setzen(&[aend("Bau", Some("Bau"), None), setzen(&[])]), Ok(true));
        assert!(b.spalten[1].pruefungen.is_empty(), "leere Liste entfernt");
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
    fn mehrere_bewegen_nimmt_erst_alle_heraus() {
        let mut b = b();
        let start = b.spalten.clone();
        let erste = start[0].aufgaben.clone();
        assert_eq!(b.mehrere_bewegen(&[(erste[0], "Z", Some(0)), (erste[1], "Z", Some(1))]), Ok(true));
        assert_eq!(b.spalten[0].aufgaben, erste[2..].to_vec());
        assert_eq!(&b.spalten[1].aufgaben[..2], &[erste[0], erste[1]]);
        assert_eq!(b.mehrere_bewegen(&[(erste[0], "A", Some(0)), (erste[1], "A", Some(1))]), Ok(true));
        assert_eq!(b.spalten, start);
        assert_eq!(b.mehrere_bewegen(&[(erste[0], "A", Some(0))]), Ok(false));
        assert_eq!(b.mehrere_bewegen(&[(erste[0], "X", Some(0))]), Err(Bewegfehler::SpalteUnbekannt));
        assert_eq!(b.mehrere_bewegen(&[(erste[0], "Z", Some(0)), (99, "Z", Some(0))]), Err(Bewegfehler::NichtAufDemBoard));
        assert_eq!(b.spalten, start, "Fehler ändern nichts");
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
        let mut leer = Board { slug: "l".into(), titel: "L".into(), spalten: vec![], termine: vec![], anwendungen: None, start: None, fieber: Default::default(), berichtsfilter: Default::default() };
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
