use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
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
    /// Wem die Spalte gehört (`column-owner`, R00097); keiner heißt heutiges Verhalten.
    #[serde(default)]
    pub eigentuemer: Option<Eigentuemer>,
    /// Ein Wert unter `column-owner`, der weder `human` noch `agent` ist: gilt nicht, bleibt in der Datei und wird als Hinweis gemeldet;
    /// im JSON nur, wo es ihn gibt, damit „Spalten einrichten“ ihn zeigt (B0296).
    #[serde(skip_deserializing, skip_serializing_if = "Option::is_none")]
    pub eigentuemer_unbekannt: Option<String>,
}

/// Eigentümer einer Spalte (R00097): aus einer Spalte des Menschen nimmt kein Agent eine Karte heraus.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub enum Eigentuemer {
    #[serde(rename = "human")]
    Human,
    #[serde(rename = "agent")]
    Agent,
}

impl Eigentuemer {
    /// `human` oder `agent` — dieselben Werte wie `kind` der Personen.
    pub fn aus(wert: &str) -> Option<Eigentuemer> {
        match wert {
            "human" => Some(Eigentuemer::Human),
            "agent" => Some(Eigentuemer::Agent),
            _ => None,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Eigentuemer::Human => "human",
            Eigentuemer::Agent => "agent",
        }
    }
}

/// `#rrggbb` — die einzige Form, in der eine Spaltenfarbe gilt.
pub fn ist_hexfarbe(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Linie {
    #[default]
    Durchgehend,
    Gestrichelt,
    Gepunktet,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Staerke {
    Fein,
    #[default]
    Normal,
    Fett,
}

/// Ein fester Termin des Boards, gezeichnet in „Wie lange noch“.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
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
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
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
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
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
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
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
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SpaltenAenderung {
    pub name: String,
    pub alt: Option<String>,
    /// `limits`: `n > 0` setzt, `null` oder `0` entfernt, fehlt das Feld, behält sie die der alten Spalte (R00102).
    #[serde(default, deserialize_with = "super::aufgabe::entfernbar")]
    #[schema(value_type = Option<u32>)]
    pub grenze: Option<Option<u32>>,
    /// `column-checks` der Spalte; fehlt das Feld, behält sie die der alten Spalte.
    #[serde(default)]
    pub pruefungen: Option<Vec<String>>,
    /// `column-notes`; fehlt das Feld, behält sie den der alten Spalte, ein leerer Text entfernt ihn.
    #[serde(default)]
    pub notiz: Option<String>,
    /// `column-colors` als `#rrggbb`; fehlt das Feld, behält sie die der alten Spalte, ein leerer Text entfernt sie.
    #[serde(default)]
    pub farbe: Option<String>,
    /// `column-owner`: `human` oder `agent` setzt, `null` entfernt, fehlt das Feld, behält sie den der alten Spalte.
    #[serde(default, deserialize_with = "super::aufgabe::entfernbar")]
    #[schema(value_type = Option<String>)]
    pub eigentuemer: Option<Option<String>>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Spaltenfehler {
    NameLeer,
    NameDoppelt(String),
    AltUnbekannt(String),
    AltDoppelt(String),
    EnthaeltAufgaben(String, usize),
    FarbeUngueltig(String),
    EigentuemerUngueltig(String),
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
            if let Some(e) = n.eigentuemer.as_ref().and_then(|e| e.as_deref()).map(str::trim).filter(|e| Eigentuemer::aus(e).is_none()) {
                return Err(Spaltenfehler::EigentuemerUngueltig(e.into()));
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
                Spalte { name: n.name.trim().into(), grenze: match n.grenze {
                        Some(g) => g.filter(|g| *g > 0),
                        None => alt.and_then(|s| s.grenze),
                    }, aufgaben: alt.map(|s| s.aufgaben.clone()).unwrap_or_default(), phase: alt.and_then(|s| s.phase.clone()), pruefungen: n.pruefungen.as_ref().map(|p| p.iter().map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect()).unwrap_or_else(|| alt.map(|s| s.pruefungen.clone()).unwrap_or_default()), notiz: gesetzt_oder_alt(&n.notiz, alt.and_then(|s| s.notiz.clone())), farbe: gesetzt_oder_alt(&n.farbe, alt.and_then(|s| s.farbe.clone())), eigentuemer: match &n.eigentuemer {
                        Some(e) => e.as_deref().and_then(|e| Eigentuemer::aus(e.trim())),
                        None => alt.and_then(|s| s.eigentuemer),
                    },
                    eigentuemer_unbekannt: if n.eigentuemer.is_some() { None } else { alt.and_then(|s| s.eigentuemer_unbekannt.clone()) },
                }
            })
            .collect();
        let geaendert = spalten != self.spalten;
        self.spalten = spalten;
        Ok(geaendert)
    }
}

/// Eine Karte, die ein Agent nicht herausnehmen darf: sie liegt in einer Spalte, die dem Menschen gehört (R00097).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Entnahmesperre {
    pub spalte: String,
    pub nummer: u32,
}

impl Board {
    /// Darf `art` die Karte `nummer` aus ihrer Spalte nehmen? Gesperrt ist nur ein Agent aus einer Menschen-Spalte; eine Nummer, die nicht auf dem Board liegt, ist frei.
    pub fn entnahme_erlaubt(&self, art: super::Art, nummer: u32) -> Result<(), Entnahmesperre> {
        if art != super::Art::Agent {
            return Ok(());
        }
        match self.spalten.iter().find(|s| s.aufgaben.contains(&nummer)) {
            Some(s) if s.eigentuemer == Some(Eigentuemer::Human) => Err(Entnahmesperre { spalte: s.name.clone(), nummer }),
            _ => Ok(()),
        }
    }
}

/// Eine Einstellung der Spalte, die nur Menschen ändern (R00102); im Rumpf der 403 als `"grenze"` bzw. `"eigentuemer"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Einstellung {
    Grenze,
    Eigentuemer,
}

/// Eine geänderte Einstellung: `spalte` ist der Name in der Anfrage, bei einer entfernten Spalte ihr bisheriger Name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Einstellungsaenderung {
    pub spalte: String,
    pub einstellung: Einstellung,
}

/// Die geänderten Einstellungen eines `PUT …/spalten` in Prüfreihenfolge: die Spalten der Anfrage von links, darin
/// die Grenze vor dem Eigentümer, danach die entfernten Spalten in ihrer bisherigen Reihenfolge.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Einstellungsaenderungen(pub Vec<Einstellungsaenderung>);

impl Einstellungsaenderungen {
    /// Die Änderung, die eine Abweisung nennt.
    pub fn erste(&self) -> Option<&Einstellungsaenderung> {
        self.0.first()
    }
}

impl Board {
    /// Was `neu` an Grenze und Eigentümer ändert; `nachher` ist dieses Board nach `spalten_setzen(neu)`, seine Spalten
    /// stehen also in der Reihenfolge von `neu`. Jede Spalte wird mit der verglichen, die sie über `alt` übernimmt —
    /// ohne `alt` mit „keine Grenze, kein Eigentümer“; eine nicht übernommene Spalte mit „entfernt“.
    pub fn einstellungsaenderungen(&self, nachher: &Board, neu: &[SpaltenAenderung]) -> Einstellungsaenderungen {
        let uebernommen = |n: &SpaltenAenderung| n.alt.as_deref().and_then(|a| self.spalten.iter().find(|s| s.name == a));
        let angefragt = neu.iter().zip(&nachher.spalten).flat_map(|(n, s)| geaenderte_einstellungen(uebernommen(n), Some(s), &s.name));
        let alte: Vec<&str> = neu.iter().filter_map(|n| n.alt.as_deref()).collect();
        let entfernt = self.spalten.iter().filter(|s| !alte.contains(&s.name.as_str())).flat_map(|s| geaenderte_einstellungen(Some(s), None, &s.name));
        Einstellungsaenderungen(angefragt.chain(entfernt).collect())
    }
}

/// Die Einstellungen, in denen sich `vorher` und `nachher` unterscheiden, `grenze` vor `eigentuemer`; eine fehlende
/// Spalte hat keine. Der Eigentümer zählt wie sein `column-owner`-Eintrag in der Datei, ein unbekannter Rohwert also mit.
fn geaenderte_einstellungen(vorher: Option<&Spalte>, nachher: Option<&Spalte>, spalte: &str) -> Vec<Einstellungsaenderung> {
    let grenze = |s: Option<&Spalte>| s.and_then(|s| s.grenze).filter(|g| *g > 0);
    [(Einstellung::Grenze, grenze(vorher) != grenze(nachher)), (Einstellung::Eigentuemer, eigentuemer_eintrag(vorher) != eigentuemer_eintrag(nachher))]
        .into_iter()
        .filter(|(_, anders)| *anders)
        .map(|(einstellung, _)| Einstellungsaenderung { spalte: spalte.into(), einstellung })
        .collect()
}

/// Der `column-owner`-Eintrag der Spalte, wie er in der Datei steht — `human`, `agent`, ein unbekannter Rohwert oder keiner.
fn eigentuemer_eintrag(spalte: Option<&Spalte>) -> Option<&str> {
    spalte.and_then(|s| s.eigentuemer.map(Eigentuemer::name).or(s.eigentuemer_unbekannt.as_deref()))
}

/// Ein gesendeter Wert gilt, leer heißt entfernt; nicht gesendet behält den alten.
fn gesetzt_oder_alt(neu: &Option<String>, alt: Option<String>) -> Option<String> {
    match neu {
        Some(t) => Some(t.trim().to_string()).filter(|t| !t.is_empty()),
        None => alt,
    }
}

/// Die zählenden Karten einer Spalte (R00096): nicht archiviert — dieselbe Zahl wie im Spaltenkopf.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Spaltenbelegung {
    pub spalte: String,
    pub grenze: Option<u32>,
    pub nummern: Vec<u32>,
}

/// Belegung eines Boards, Spalten von links nach rechts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Belegung(pub Vec<Spaltenbelegung>);

impl Board {
    /// Je Spalte die Karten, die zählen; archivierte bleiben in der Board-Datei stehen und werden hier ausgenommen.
    pub fn belegung(&self, archiviert: &BTreeSet<u32>) -> Belegung {
        Belegung(
            self.spalten
                .iter()
                .map(|s| Spaltenbelegung { spalte: s.name.clone(), grenze: s.grenze, nummern: s.aufgaben.iter().copied().filter(|n| !archiviert.contains(n)).collect() })
                .collect(),
        )
    }
}

/// Eine Spalte, die nach einem Zug mehr Karten hat, als ihre Grenze erlaubt; `vorher`/`nachher` sind die zählenden Karten.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Grenzverletzung {
    pub spalte: String,
    pub grenze: u32,
    pub vorher: u32,
    pub nachher: u32,
}

/// Die verletzten Grenzen eines Zugs, Spalten von links nach rechts.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Grenzverletzungen(pub Vec<Grenzverletzung>);

impl Grenzverletzungen {
    pub fn ist_leer(&self) -> bool {
        self.0.is_empty()
    }
}

impl Belegung {
    /// `self` ist der Stand nach dem Zug. Verletzt ist eine Spalte mit Grenze (nicht 0), die einen Zugang hat — eine
    /// zählende Karte, die vorher dort nicht zählte — und danach mehr Karten hat als die Grenze. Umsortieren ist kein Zugang.
    pub fn grenzverletzungen(&self, vorher: &Belegung) -> Grenzverletzungen {
        let verletzungen = self
            .0
            .iter()
            .filter_map(|nach| {
                let grenze = nach.grenze.filter(|g| *g > 0)?;
                let vor: &[u32] = vorher.0.iter().find(|v| v.spalte == nach.spalte).map_or(&[], |v| &v.nummern);
                let hat_zugang = nach.nummern.iter().any(|n| !vor.contains(n));
                let anzahl_nachher = nach.nummern.len() as u32;
                (hat_zugang && anzahl_nachher > grenze).then(|| Grenzverletzung {
                    spalte: nach.spalte.clone(),
                    grenze,
                    vorher: vor.len() as u32,
                    nachher: anzahl_nachher,
                })
            })
            .collect();
        Grenzverletzungen(verletzungen)
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
                Spalte { notiz: None, farbe: None, eigentuemer: None, eigentuemer_unbekannt: None, name: "A".into(), grenze: None, aufgaben: vec![1, 2], phase: None, pruefungen: vec![] },
                Spalte { notiz: None, farbe: None, eigentuemer: None, eigentuemer_unbekannt: None, name: "Z".into(), grenze: None, aufgaben: vec![3], phase: None, pruefungen: vec![] },
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
        SpaltenAenderung { name: name.into(), alt: alt.map(Into::into), grenze: Some(grenze), pruefungen: None, notiz: None, farbe: None, eigentuemer: None }
    }

    #[test]
    fn spalten_umbenennen_ergaenzen_begrenzen() {
        let mut b = b();
        b.spalten.insert(1, Spalte { notiz: None, farbe: None, eigentuemer: None, eigentuemer_unbekannt: None, name: "B".into(), grenze: None, aufgaben: vec![], phase: None, pruefungen: vec![] });
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
        b.spalten.insert(1, Spalte { notiz: None, farbe: None, eigentuemer: None, eigentuemer_unbekannt: None, name: "B".into(), grenze: None, aufgaben: vec![], phase: Some("Abnahme".into()), pruefungen: vec![] });
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
    fn eigentuemer_setzen_behalten_entfernen_umbenennen() {
        let mut b = b();
        let mit = |e: Option<Option<&str>>, name: &str, alt: &str| SpaltenAenderung { eigentuemer: e.map(|x| x.map(String::from)), ..aend(name, Some(alt), None) };
        assert_eq!(b.spalten_setzen(&[mit(Some(Some("human")), "A", "A"), mit(Some(Some("agent")), "Z", "Z")]), Ok(true));
        assert_eq!(b.spalten.iter().map(|s| s.eigentuemer).collect::<Vec<_>>(), [Some(Eigentuemer::Human), Some(Eigentuemer::Agent)]);
        assert_eq!(b.spalten_setzen(&[mit(None, "A", "A"), mit(None, "Z", "Z")]), Ok(false), "fehlendes Feld behält");
        assert_eq!(b.spalten_setzen(&[mit(None, "Posteingang", "A"), mit(Some(None), "Z", "Z")]), Ok(true));
        assert_eq!(b.spalten.iter().map(|s| s.eigentuemer).collect::<Vec<_>>(), [Some(Eigentuemer::Human), None], "Umbenennen nimmt mit, null entfernt");
        b.spalten[1].aufgaben.clear();
        assert_eq!(b.spalten_setzen(&[mit(None, "Posteingang", "Posteingang"), aend("Neu", None, None)]), Ok(true));
        assert_eq!(b.spalten[1].eigentuemer, None, "entfernte Spalte nimmt ihn mit, neue hat keinen");
        let vorher = b.spalten.clone();
        assert_eq!(b.spalten_setzen(&[mit(Some(Some("chef")), "Posteingang", "Posteingang")]), Err(Spaltenfehler::EigentuemerUngueltig("chef".into())));
        assert_eq!(b.spalten, vorher, "Fehler ändern nichts");
    }

    #[test]
    fn entnahme_nur_agent_aus_menschen_spalte_gesperrt() {
        use super::super::Art;
        for (eigner, mensch, agent) in [(Some(Eigentuemer::Human), true, false), (Some(Eigentuemer::Agent), true, true), (None, true, true)] {
            let mut b = b();
            b.spalten[0].eigentuemer = eigner;
            assert_eq!(b.entnahme_erlaubt(Art::Mensch, 1).is_ok(), mensch, "Mensch × {eigner:?}");
            assert_eq!(b.entnahme_erlaubt(Art::Agent, 1).is_ok(), agent, "Agent × {eigner:?}");
        }
        let mut b = b();
        b.spalten[0].eigentuemer = Some(Eigentuemer::Human);
        assert_eq!(b.entnahme_erlaubt(Art::Agent, 2), Err(Entnahmesperre { spalte: "A".into(), nummer: 2 }));
        assert_eq!(b.entnahme_erlaubt(Art::Agent, 3), Ok(()), "Karte in einer Spalte ohne Eigentümer");
        assert_eq!(b.entnahme_erlaubt(Art::Agent, 99), Ok(()), "Nummer nicht auf dem Board");
        b.spalten[0].eigentuemer_unbekannt = Some("chef".into());
        b.spalten[0].eigentuemer = None;
        assert_eq!(b.entnahme_erlaubt(Art::Agent, 1), Ok(()), "ein unbekannter Wert gilt nicht");
    }

    #[test]
    fn unbekannter_rohwert_bleibt_ohne_feld_auch_beim_umbenennen() {
        let mut b = b();
        b.spalten[0].eigentuemer_unbekannt = Some("chef".into());
        assert_eq!(b.spalten_setzen(&[aend("Posteingang", Some("A"), None), aend("Z", Some("Z"), None)]), Ok(true));
        assert_eq!((b.spalten[0].eigentuemer, b.spalten[0].eigentuemer_unbekannt.as_deref()), (None, Some("chef")));
    }

    #[test]
    fn gesetzter_eigentuemer_ersetzt_einen_unbekannten() {
        let mut b = b();
        b.spalten[0].eigentuemer_unbekannt = Some("chef".into());
        let neu = SpaltenAenderung { eigentuemer: Some(Some("human".into())), ..aend("A", Some("A"), None) };
        assert_eq!(b.spalten_setzen(&[neu, aend("Z", Some("Z"), None)]), Ok(true));
        assert_eq!((b.spalten[0].eigentuemer, b.spalten[0].eigentuemer_unbekannt.as_deref()), (Some(Eigentuemer::Human), None));
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

    fn mit_grenze() -> Board {
        let mut b = b();
        b.spalten = vec![
            Spalte { notiz: None, farbe: None, eigentuemer: None, eigentuemer_unbekannt: None, name: "Bereit".into(), grenze: None, aufgaben: vec![7, 8], phase: None, pruefungen: vec![] },
            Spalte { notiz: None, farbe: None, eigentuemer: None, eigentuemer_unbekannt: None, name: "In Arbeit".into(), grenze: Some(2), aufgaben: vec![5, 6], phase: None, pruefungen: vec![] },
        ];
        b
    }

    fn zaehlend(b: &Belegung) -> Vec<(&str, Vec<u32>)> {
        b.0.iter().map(|s| (s.spalte.as_str(), s.nummern.clone())).collect()
    }

    // R00096: archivierte Karten zählen nicht
    #[test]
    fn belegung_ohne_archivierte_in_spaltenreihenfolge() {
        let b = mit_grenze();
        assert_eq!(zaehlend(&b.belegung(&BTreeSet::new())), vec![("Bereit", vec![7, 8]), ("In Arbeit", vec![5, 6])]);
        let belegung = b.belegung(&BTreeSet::from([6, 8, 42]));
        assert_eq!(zaehlend(&belegung), vec![("Bereit", vec![7]), ("In Arbeit", vec![5])], "#6 archiviert → „In Arbeit“ zählt 1");
        assert_eq!(belegung.0[1].grenze, Some(2));
    }

    fn belegt(spalten: &[(&str, Option<u32>, &[u32])]) -> Belegung {
        Belegung(spalten.iter().map(|(s, g, n)| Spaltenbelegung { spalte: s.to_string(), grenze: *g, nummern: n.to_vec() }).collect())
    }

    fn verletzt(spalte: &str, grenze: u32, vorher: u32, nachher: u32) -> Grenzverletzung {
        Grenzverletzung { spalte: spalte.into(), grenze, vorher, nachher }
    }

    // R00096: Rechenbeispiele der Akzeptanzkriterien
    #[test]
    fn grenzverletzungen_nur_bei_zugang_ueber_die_grenze() {
        let vorher = belegt(&[("Bereit", None, &[7, 8]), ("In Arbeit", Some(2), &[5, 6])]);
        let nachher = belegt(&[("Bereit", None, &[8]), ("In Arbeit", Some(2), &[7, 5, 6])]);
        assert_eq!(nachher.grenzverletzungen(&vorher), Grenzverletzungen(vec![verletzt("In Arbeit", 2, 2, 3)]), "[5, 6] + #7 bei 2");
        let vorher = belegt(&[("Bereit", None, &[7, 8]), ("In Arbeit", Some(2), &[5])]);
        let nachher = belegt(&[("Bereit", None, &[]), ("In Arbeit", Some(2), &[7, 8, 5])]);
        assert_eq!(nachher.grenzverletzungen(&vorher), Grenzverletzungen(vec![verletzt("In Arbeit", 2, 1, 3)]), "[5] + #7, #8 bei 2");
        let nachher = belegt(&[("Bereit", None, &[8]), ("In Arbeit", Some(2), &[7, 5])]);
        assert!(nachher.grenzverletzungen(&vorher).ist_leer(), "[5] + #7 bei 2: genau voll ist erlaubt");
    }

    #[test]
    fn umsortieren_tausch_und_ohne_grenze_verletzen_nichts() {
        let vorher = belegt(&[("Bereit", None, &[7]), ("In Arbeit", Some(2), &[5, 6])]);
        let umsortiert = belegt(&[("Bereit", None, &[7]), ("In Arbeit", Some(2), &[6, 5])]);
        assert!(umsortiert.grenzverletzungen(&vorher).ist_leer(), "Umsortieren [6, 5]");
        let getauscht = belegt(&[("Bereit", None, &[6]), ("In Arbeit", Some(2), &[7, 5])]);
        assert!(getauscht.grenzverletzungen(&vorher).ist_leer(), "eine heraus, eine hinein");
        let ueberfuellt = belegt(&[("Bereit", None, &[]), ("In Arbeit", Some(1), &[5, 6])]);
        let umsortiert = belegt(&[("Bereit", None, &[]), ("In Arbeit", Some(1), &[6, 5])]);
        assert!(umsortiert.grenzverletzungen(&ueberfuellt).ist_leer(), "schon über der Grenze: Umsortieren ist kein Zugang");
        for grenze in [None, Some(0)] {
            let vorher = belegt(&[("Bereit", None, &[7, 8, 9]), ("In Arbeit", grenze, &[5])]);
            let nachher = belegt(&[("Bereit", None, &[]), ("In Arbeit", grenze, &[7, 8, 9, 5])]);
            assert!(nachher.grenzverletzungen(&vorher).ist_leer(), "Grenze {grenze:?} ist keine Grenze");
        }
    }

    #[test]
    fn grenzverletzungen_in_spaltenreihenfolge_auch_durch_zurueckholen() {
        let mut b = mit_grenze();
        b.spalten[0].grenze = Some(1);
        b.spalten[1].aufgaben = vec![5, 6, 9];
        let vorher = b.belegung(&BTreeSet::from([6, 8]));
        let nachher = b.belegung(&BTreeSet::new());
        assert_eq!(
            nachher.grenzverletzungen(&vorher),
            Grenzverletzungen(vec![verletzt("Bereit", 1, 1, 2), verletzt("In Arbeit", 2, 2, 3)]),
            "#8 und #6 zurückgeholt: beide zählen wieder, links zuerst"
        );
    }

    // ---- R00102: Einstellungsänderungen eines PUT …/spalten

    /// Ausgangsboard der Akzeptanzkriterien: Eingang (human), In Arbeit (Grenze 2, leer), Erledigt.
    fn ausgang() -> Board {
        let spalte = |name: &str, grenze, eigentuemer| Spalte { notiz: None, farbe: None, eigentuemer, eigentuemer_unbekannt: None, name: name.into(), grenze, aufgaben: vec![], phase: None, pruefungen: vec![] };
        Board { spalten: vec![spalte("Eingang", None, Some(Eigentuemer::Human)), spalte("In Arbeit", Some(2), None), spalte("Erledigt", None, None)], ..b() }
    }

    /// Eine Spalte der Anfrage mit ausdrücklicher Grenze (`0` entfernt).
    fn mit_grenze_an(name: &str, alt: Option<&str>, grenze: u32) -> SpaltenAenderung {
        aend(name, alt, Some(grenze))
    }

    /// Die drei Spalten unverändert mit `alt` = Name und allen Werten.
    fn unveraendert() -> Vec<SpaltenAenderung> {
        vec![mit_grenze_an("Eingang", Some("Eingang"), 0), mit_grenze_an("In Arbeit", Some("In Arbeit"), 2), mit_grenze_an("Erledigt", Some("Erledigt"), 0)]
    }

    fn unveraendert_bis_auf(i: usize, s: SpaltenAenderung) -> Vec<SpaltenAenderung> {
        let mut neu = unveraendert();
        neu[i] = s;
        neu
    }

    fn aenderungen(vorher: &Board, neu: &[SpaltenAenderung]) -> Einstellungsaenderungen {
        let mut nachher = vorher.clone();
        nachher.spalten_setzen(neu).unwrap();
        vorher.einstellungsaenderungen(&nachher, neu)
    }

    fn geaendert(vorher: &Board, neu: &[SpaltenAenderung]) -> Vec<(String, Einstellung)> {
        aenderungen(vorher, neu).0.into_iter().map(|a| (a.spalte, a.einstellung)).collect()
    }

    fn grenze(spalte: &str) -> (String, Einstellung) {
        (spalte.into(), Einstellung::Grenze)
    }

    #[test]
    fn grenzaenderungen_je_spalte_ein_eintrag() {
        let b = ausgang();
        assert_eq!(geaendert(&b, &unveraendert_bis_auf(1, mit_grenze_an("In Arbeit", Some("In Arbeit"), 3))), [grenze("In Arbeit")], "2 → 3");
        assert_eq!(geaendert(&b, &unveraendert_bis_auf(1, mit_grenze_an("In Arbeit", Some("In Arbeit"), 0))), [grenze("In Arbeit")], "2 → keine");
        assert_eq!(geaendert(&b, &unveraendert_bis_auf(2, mit_grenze_an("Erledigt", Some("Erledigt"), 4))), [grenze("Erledigt")], "keine → 4");
        let mut neu = unveraendert();
        neu.insert(2, mit_grenze_an("Review", None, 1));
        assert_eq!(geaendert(&b, &neu), [grenze("Review")], "neue Spalte mit Grenze");
        let mut neu = unveraendert();
        neu.remove(1);
        assert_eq!(geaendert(&b, &neu), [grenze("In Arbeit")], "entfernte Spalte mit Grenze, bisheriger Name");
    }

    #[test]
    fn keine_grenzaenderung_bei_0_ohne_grenze_umbenennen_und_umsortieren() {
        let b = ausgang();
        assert_eq!(geaendert(&b, &unveraendert()), [], "unverändert");
        let mut neu = unveraendert_bis_auf(1, mit_grenze_an("Bau", Some("In Arbeit"), 2));
        neu.swap(0, 2);
        assert_eq!(geaendert(&b, &neu), [], "0 für Erledigt ohne Grenze, In Arbeit → Bau mit gleicher Grenze, umsortiert");
        let mut neu = unveraendert();
        neu.remove(2);
        assert_eq!(geaendert(&b, &neu), [], "leere Spalte ohne Grenze entfernt");
        let mut neu = unveraendert();
        neu.push(mit_grenze_an("Review", None, 0));
        assert_eq!(geaendert(&b, &neu), [], "neue Spalte ohne Grenze");
    }

    #[test]
    fn grenzaenderungen_erst_die_anfrage_von_links_dann_die_entfernten() {
        let mut b = ausgang();
        b.spalten[0].grenze = Some(5);
        let neu = [mit_grenze_an("Review", None, 1), mit_grenze_an("Erledigt", Some("Erledigt"), 4)];
        assert_eq!(geaendert(&b, &neu), [grenze("Review"), grenze("Erledigt"), grenze("Eingang"), eigentuemer("Eingang"), grenze("In Arbeit")]);
        assert_eq!(aenderungen(&b, &neu).erste().map(|a| a.spalte.as_str()), Some("Review"));
        assert_eq!(aenderungen(&ausgang(), &unveraendert()).erste(), None);
    }

    #[test]
    fn fehlende_grenze_behaelt_die_alte_null_und_0_entfernen() {
        let mit = |grenze: Option<Option<u32>>, name: &str| {
            let mut b = ausgang();
            let neu = unveraendert_bis_auf(1, SpaltenAenderung { grenze, ..aend(name, Some("In Arbeit"), None) });
            b.spalten_setzen(&neu).unwrap();
            (b.spalten[1].name.clone(), b.spalten[1].grenze)
        };
        assert_eq!(mit(None, "In Arbeit"), ("In Arbeit".into(), Some(2)), "fehlt → behält");
        assert_eq!(mit(None, "Bau"), ("Bau".into(), Some(2)), "Umbenennen ohne grenze nimmt sie mit");
        assert_eq!(mit(Some(None), "In Arbeit"), ("In Arbeit".into(), None), "null → keine");
        assert_eq!(mit(Some(Some(0)), "In Arbeit"), ("In Arbeit".into(), None), "0 → keine");
        assert_eq!(mit(Some(Some(5)), "In Arbeit"), ("In Arbeit".into(), Some(5)), "n → n");
        let mut b = ausgang();
        let mut neu = unveraendert();
        neu.push(SpaltenAenderung { grenze: None, ..aend("Review", None, None) });
        b.spalten_setzen(&neu).unwrap();
        assert_eq!(b.spalten[3].grenze, None, "neue Spalte ohne grenze hat keine");
    }

    fn eigentuemer(spalte: &str) -> (String, Einstellung) {
        (spalte.into(), Einstellung::Eigentuemer)
    }

    /// `s` mit gesendetem Eigentümer: `Some(None)` ist `null`.
    fn mit_eigentuemer(s: SpaltenAenderung, e: Option<&str>) -> SpaltenAenderung {
        SpaltenAenderung { eigentuemer: Some(e.map(String::from)), ..s }
    }

    #[test]
    fn eigentuemeraenderungen_je_spalte_ein_eintrag() {
        let b = ausgang();
        let erledigt = mit_grenze_an("Erledigt", Some("Erledigt"), 0);
        let eingang = mit_grenze_an("Eingang", Some("Eingang"), 0);
        assert_eq!(geaendert(&b, &unveraendert_bis_auf(2, mit_eigentuemer(erledigt, Some("human")))), [eigentuemer("Erledigt")], "keiner → human");
        assert_eq!(geaendert(&b, &unveraendert_bis_auf(0, mit_eigentuemer(eingang.clone(), Some("agent")))), [eigentuemer("Eingang")], "human → agent");
        assert_eq!(geaendert(&b, &unveraendert_bis_auf(0, mit_eigentuemer(eingang.clone(), None))), [eigentuemer("Eingang")], "human → keiner");
        let mut chef = ausgang();
        chef.spalten[2].eigentuemer_unbekannt = Some("chef".into());
        assert_eq!(geaendert(&chef, &unveraendert_bis_auf(2, mit_eigentuemer(mit_grenze_an("Erledigt", Some("Erledigt"), 0), None))), [eigentuemer("Erledigt")], "chef → keiner");
        assert_eq!(geaendert(&chef, &unveraendert()), [], "chef ohne Feld bleibt");
        let mut neu = unveraendert();
        neu.remove(0);
        assert_eq!(geaendert(&b, &neu), [eigentuemer("Eingang")], "entfernte Spalte mit human");
        assert_eq!(geaendert(&b, &unveraendert_bis_auf(0, mit_grenze_an("Posteingang", Some("Eingang"), 0))), [], "Umbenennen ohne Feld nimmt mit");
        assert_eq!(geaendert(&b, &unveraendert_bis_auf(0, mit_eigentuemer(eingang, Some("human")))), [], "gleicher Eigentümer gesendet");
    }

    #[test]
    fn reihenfolge_grenze_vor_eigentuemer_anfrage_vor_entfernten() {
        let b = ausgang();
        let eingang_agent = || mit_eigentuemer(mit_grenze_an("Eingang", Some("Eingang"), 0), Some("agent"));
        let in_arbeit_3 = || mit_grenze_an("In Arbeit", Some("In Arbeit"), 3);
        let erledigt = || mit_grenze_an("Erledigt", Some("Erledigt"), 0);
        let erste = |neu: &[SpaltenAenderung]| aenderungen(&b, neu).erste().map(|a| (a.spalte.clone(), a.einstellung));
        assert_eq!(erste(&[eingang_agent(), in_arbeit_3(), erledigt()]), Some(eigentuemer("Eingang")));
        assert_eq!(erste(&[in_arbeit_3(), eingang_agent(), erledigt()]), Some(grenze("In Arbeit")), "umsortiert");
        let beides = mit_eigentuemer(in_arbeit_3(), Some("agent"));
        assert_eq!(geaendert(&b, &[mit_grenze_an("Eingang", Some("Eingang"), 0), beides, erledigt()]), [grenze("In Arbeit"), eigentuemer("In Arbeit")], "in einer Spalte grenze vor eigentuemer");
        let neu = [mit_eigentuemer(erledigt(), Some("human")), mit_grenze_an("In Arbeit", Some("In Arbeit"), 2)];
        assert_eq!(geaendert(&b, &neu), [eigentuemer("Erledigt"), eigentuemer("Eingang")], "die entfernte kommt zuletzt");
    }
}
