use super::{Anwendungen, Einstellungen, Herkunftsschluessel, Kosten};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Teilaufgabe {
    pub text: String,
    pub erledigt: bool,
}

/// Eine Zeile im Block `kanbanD-time`. Zeitpunkte in Dateiform (R00084); ohne Ende läuft sie.
/// In der API trägt sie zusätzlich ihre `kennung` (R00090).
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct Zeiteintrag {
    pub wer: String,
    pub beginn: String,
    pub ende: Option<String>,
}

impl Serialize for Zeiteintrag {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut z = s.serialize_struct("Zeiteintrag", 4)?;
        z.serialize_field("wer", &self.wer)?;
        z.serialize_field("beginn", &self.beginn)?;
        z.serialize_field("ende", &self.ende)?;
        z.serialize_field("kennung", &self.kennung())?;
        z.end()
    }
}

/// Von Hand, weil die API das berechnete Feld `kennung` mitliefert (R00090).
impl utoipa::PartialSchema for Zeiteintrag {
    fn schema() -> utoipa::openapi::RefOr<utoipa::openapi::schema::Schema> {
        use utoipa::openapi::schema::{ObjectBuilder, Type};
        let text = |beschreibung: &str| ObjectBuilder::new().schema_type(Type::String).description(Some(beschreibung.to_string()));
        ObjectBuilder::new()
            .property("wer", text("Kürzel der Person"))
            .property("beginn", text("Zeitpunkt JJJJ-MM-TT HH:MM±HH:MM (Altbestand ohne Versatz)"))
            .property("ende", ObjectBuilder::new().schema_type(utoipa::openapi::schema::SchemaType::from_iter([Type::String, Type::Null])).description(Some("wie beginn; null, solange der Eintrag läuft")))
            .property("kennung", text("wer@JJJJ-MM-TTTHH:MM±HH:MM — adressiert den Eintrag in PATCH/DELETE …/zeiten/{kennung}"))
            .required("wer")
            .required("beginn")
            .required("ende")
            .required("kennung")
            .into()
    }
}

impl utoipa::ToSchema for Zeiteintrag {}

impl Zeiteintrag {
    /// Kennung `wer@JJJJ-MM-TTTHH:MM±HH:MM` (R00090): Person und Beginn als eindeutiger Moment — ein Altbeginn ohne
    /// Versatz bekommt den seiner Ortszeit-Deutung. Ein unlesbarer Beginn bleibt, wie er ist.
    pub fn kennung(&self) -> String {
        let beginn = crate::uhr::Zeitpunkt::lesen(&self.beginn).map(|z| z.iso()).unwrap_or_else(|| self.beginn.clone());
        format!("{}@{beginn}", self.wer)
    }

    /// Trifft die Kennung diesen Eintrag? Der Beginn darf in jeder lesbaren Form kommen (`Z`, anderer Versatz, Leerzeichen).
    pub fn hat_kennung(&self, kennung: &str) -> bool {
        let normal = kennung.split_once('@').and_then(|(wer, zeit)| crate::uhr::Zeitpunkt::lesen(zeit).map(|z| format!("{wer}@{}", z.iso())));
        self.kennung() == normal.as_deref().unwrap_or(kennung)
    }
}

/// Ergebnis eines Durchlaufs (R00094); in Datei und API klein geschrieben.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Ergebnis {
    Bestanden,
    Befund,
    Entfaellt,
}

impl Ergebnis {
    pub fn lesen(s: &str) -> Option<Ergebnis> {
        match s {
            "bestanden" => Some(Ergebnis::Bestanden),
            "befund" => Some(Ergebnis::Befund),
            "entfaellt" => Some(Ergebnis::Entfaellt),
            _ => None,
        }
    }

    pub fn text(self) -> &'static str {
        match self {
            Ergebnis::Bestanden => "bestanden",
            Ergebnis::Befund => "befund",
            Ergebnis::Entfaellt => "entfaellt",
        }
    }
}

/// Eine Phase, die eine Karte durchlaufen hat (R00094): eine Zeile im Block `kanbanD-runs`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Durchlauf {
    /// Zeitpunkt JJJJ-MM-TT HH:MM±HH:MM
    pub zeitpunkt: String,
    pub phase: String,
    pub ergebnis: Ergebnis,
    /// Kürzel der Person, für die der Durchlauf gilt
    pub wer: String,
    pub dauer_minuten: Option<i64>,
    pub text: String,
}

/// Eine Karte, die eine Instanz für sich hält (R00087); in der Datei `reservation: {who, instance, since}`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Reservierung {
    /// Kürzel der Person
    pub wer: String,
    /// Kennung der Instanz, 1–64 Zeichen aus A–Z a–z 0–9 . _ -
    pub instanz: String,
    /// Zeitpunkt JJJJ-MM-TT HH:MM±HH:MM; die Reservierung hält 24 h ab hier
    pub seit: String,
}

/// Eine Reservierung hält 24 h ab `seit`; wer sie verlängert, setzt `seit` neu.
pub const RESERVIERUNG_MINUTEN: i64 = 24 * 60;

impl Reservierung {
    /// Gültig, solange seit `seit` weniger als 24 h vergangen sind; ein unlesbarer Zeitpunkt gilt nicht.
    pub fn gueltig(&self, jetzt: &str) -> bool {
        crate::uhr::minuten(&self.seit, jetzt).is_some_and(|m| m < RESERVIERUNG_MINUTEN)
    }

    pub fn gehoert(&self, instanz: &str) -> bool {
        self.instanz == instanz
    }
}

/// Kennung einer Instanz: 1–64 Zeichen aus `A-Z a-z 0-9 . _ -` (R00087).
pub fn instanz_gueltig(s: &str) -> bool {
    (1..=64).contains(&s.len()) && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

/// Schlüssel eines fremden Systems (R00098, `key:`): außen getrimmt 1–200 Zeichen ohne Zeilenumbruch, genau mit Groß/Klein.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(try_from = "String", into = "String")]
pub struct Fremdschluessel(String);

impl TryFrom<String> for Fremdschluessel {
    type Error = String;
    fn try_from(text: String) -> Result<Fremdschluessel, String> {
        Fremdschluessel::pruefen(&text)
    }
}

impl From<Fremdschluessel> for String {
    fn from(k: Fremdschluessel) -> String {
        k.0
    }
}

impl Fremdschluessel {
    pub fn pruefen(text: &str) -> Result<Fremdschluessel, String> {
        let text = text.trim();
        let umbruch = |c: char| matches!(c, '\n' | '\r' | '\u{0B}' | '\u{0C}' | '\u{85}' | '\u{2028}' | '\u{2029}');
        if !(1..=200).contains(&text.chars().count()) || text.contains(umbruch) {
            return Err("Schlüssel: 1–200 Zeichen ohne Zeilenumbruch".into());
        }
        Ok(Fremdschluessel(text.to_string()))
    }

    pub fn text(&self) -> &str {
        &self.0
    }
}

/// Ein Schlüssel, den mehrere Karten tragen (nach einem Merge oder von Hand) — `GET /api/zustand` meldet ihn (R00098).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Dublette {
    pub key: String,
    pub nummern: Vec<u32>,
}

/// Je Schlüssel mit mehr als einer Karte die Nummern aufsteigend, nach Schlüssel sortiert.
pub fn doppelte_schluessel(aufgaben: &[Aufgabe]) -> Vec<Dublette> {
    let mut je_schluessel: std::collections::BTreeMap<&str, Vec<u32>> = Default::default();
    for a in aufgaben {
        if let Some(k) = &a.schluessel {
            je_schluessel.entry(k.text()).or_default().push(a.nummer);
        }
    }
    let mehrfach = je_schluessel.into_iter().filter(|(_, n)| n.len() > 1);
    mehrfach
        .map(|(key, mut nummern)| {
            nummern.sort();
            Dublette { key: key.to_string(), nummern }
        })
        .collect()
}

/// Was die Suche nach einem Schlüssel unter den Aufgaben findet (R00098, ADR-0004).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Schluesseltreffer {
    Keiner,
    Offen(u32),
    Archiviert(u32),
    /// mehrere Karten tragen den Schlüssel, Nummern aufsteigend
    Mehrfach(Vec<u32>),
}

impl Schluesseltreffer {
    pub fn suchen(aufgaben: &[Aufgabe], schluessel: &Fremdschluessel) -> Schluesseltreffer {
        let mut treffer: Vec<&Aufgabe> = aufgaben.iter().filter(|a| a.schluessel.as_ref() == Some(schluessel)).collect();
        treffer.sort_by_key(|a| a.nummer);
        match treffer.as_slice() {
            [] => Schluesseltreffer::Keiner,
            [a] if a.archiviert.is_some() => Schluesseltreffer::Archiviert(a.nummer),
            [a] => Schluesseltreffer::Offen(a.nummer),
            alle => Schluesseltreffer::Mehrfach(alle.iter().map(|a| a.nummer).collect()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Kommentar {
    pub wer: String,
    /// Zeitpunkt JJJJ-MM-TT HH:MM±HH:MM (Altbestand ohne Versatz)
    pub zeitpunkt: String,
    pub text: String,
}

/// Was eine Aufgabe an einem WBS-Knoten bewirkt (R00057); in der Datei englisch wie der Namensraum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, utoipa::ToSchema)]
pub enum Aktion {
    #[serde(rename = "create")]
    Anlegen,
    #[serde(rename = "rework")]
    Ueberarbeiten,
    #[serde(rename = "remove")]
    Verwerfen,
}

impl Aktion {
    pub const ALLE: [Aktion; 3] = [Aktion::Anlegen, Aktion::Ueberarbeiten, Aktion::Verwerfen];

    pub fn schluessel(self) -> &'static str {
        match self {
            Aktion::Anlegen => "create",
            Aktion::Ueberarbeiten => "rework",
            Aktion::Verwerfen => "remove",
        }
    }

    pub fn aus(schluessel: &str) -> Option<Aktion> {
        Aktion::ALLE.into_iter().find(|a| a.schluessel() == schluessel)
    }
}

/// Eine Zeile in `wbs-effects`: Anwendung (Kürzel aus dem Register), Aktion, Knoten und — bei `create` — die Angaben zum neuen Knoten.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Wirkung {
    #[serde(rename = "application")]
    pub anwendung: String,
    #[serde(rename = "action")]
    pub aktion: Aktion,
    #[serde(rename = "node", skip_serializing_if = "Option::is_none")]
    pub knoten: Option<String>,
    #[serde(rename = "parent", skip_serializing_if = "Option::is_none")]
    pub eltern: Option<String>,
    #[serde(rename = "level", skip_serializing_if = "Option::is_none")]
    pub ebene: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(rename = "done_criterion", skip_serializing_if = "Option::is_none")]
    pub fertig_kriterium: Option<String>,
    /// `executed` — ob und wann die Wirkung in der WBS ausgeführt wurde (R00071).
    #[serde(rename = "executed", default, skip_serializing_if = "Ausfuehrung::ist_frueher")]
    #[schema(value_type = Option<serde_json::Value>)]
    pub ausgefuehrt: Ausfuehrung,
    /// Schlüssel, die kanbanD nicht kennt — bleiben beim Schreiben erhalten.
    #[serde(skip)]
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

/// `executed` einer Wirkung (R00071): fehlt — aus der Zeit vor R00071, als jede Wirkung mit dem Setzen ausgeführt wurde;
/// `false` — nur vermerkt; ein Datum — an diesem Tag ausgeführt.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum Ausfuehrung {
    #[default]
    Frueher,
    Offen,
    Am(String),
}

impl Ausfuehrung {
    pub fn ist_frueher(&self) -> bool {
        *self == Ausfuehrung::Frueher
    }

    /// Ausgeführt gilt auch, was aus der Zeit vor R00071 stammt.
    pub fn ausgefuehrt(&self) -> bool {
        *self != Ausfuehrung::Offen
    }
}

impl Serialize for Ausfuehrung {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self {
            Ausfuehrung::Frueher => s.serialize_bool(true),
            Ausfuehrung::Offen => s.serialize_bool(false),
            Ausfuehrung::Am(datum) => s.serialize_str(datum),
        }
    }
}

impl<'de> Deserialize<'de> for Ausfuehrung {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        #[derive(Deserialize, utoipa::ToSchema)]
        #[serde(untagged)]
        enum Roh {
            Ja(bool),
            Datum(String),
        }
        Ok(match Roh::deserialize(d)? {
            Roh::Ja(false) => Ausfuehrung::Offen,
            Roh::Ja(true) => Ausfuehrung::Frueher,
            Roh::Datum(datum) => Ausfuehrung::Am(datum),
        })
    }
}

impl Wirkung {
    /// `kd:I0048` — der Knoten, auf den die Wirkung wirkt; ein `create` vor der Ausführung hat noch keinen.
    pub fn schluessel(&self) -> Option<String> {
        self.knoten.as_deref().map(|k| Herkunftsschluessel::qualifiziert(&self.anwendung, k))
    }
}

/// `phases`: wie die Aufgabe die Phasen ihrer Anwendung durchläuft (R00058); in der Datei englisch wie der Namensraum.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Phasenangaben {
    /// `skipped`: Phasen, die für diese Aufgabe entfallen — sie zählt dort weder in Zähler und Nenner noch im Durchsatz
    pub uebersprungen: Vec<String>,
    /// Schlüssel im Namensraum, die kanbanD nicht kennt — bleiben beim Schreiben erhalten.
    #[serde(skip)]
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

/// `reporting`: ob die Aufgabe in Berichten zählt (R00060); fehlt ein Schlüssel, gilt der Standard — sie zählt.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Berichtszaehlung {
    /// `burndown: false` nimmt die Aufgabe aus dem Burndown
    #[serde(skip_serializing_if = "Option::is_none")]
    pub burndown: Option<bool>,
    /// `forecast: false` nimmt die Aufgabe aus Wie lange noch
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forecast: Option<bool>,
    /// Schlüssel im Namensraum, die kanbanD nicht kennt — bleiben beim Schreiben erhalten.
    #[serde(skip)]
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

/// Eine Aufgabe: unabhängige Datei, weiß nichts von Boards.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Aufgabe {
    pub nummer: u32,
    /// Dateiname unter `aufgaben/`, z. B. `0012-kopfzeile.md`.
    pub datei: String,
    pub titel: String,
    /// `key` (R00098): Schlüssel eines fremden Systems, beim Anlegen gesetzt, danach unveränderlich
    #[serde(rename = "key")]
    pub schluessel: Option<Fremdschluessel>,
    pub klasse: Option<String>,
    pub zustaendige: Vec<String>,
    pub labels: Vec<String>,
    pub faellig: Option<String>,
    pub herkunft: Vec<String>,
    /// `signals`: gesetzte Signale (R00076), Schlüssel aus `kanbanD.md`
    pub signale: Vec<String>,
    pub archiviert: Option<String>,
    /// `reservation` (R00087); abgelaufene blendet schon das Lesen aus der Ablage aus
    pub reservierung: Option<Reservierung>,
    pub beschreibung: String,
    pub teilaufgaben: Vec<Teilaufgabe>,
    pub zeiten: Vec<Zeiteintrag>,
    pub kommentare: Vec<Kommentar>,
    /// Block `kanbanD-runs` (R00094)
    pub durchlaeufe: Vec<Durchlauf>,
    /// Zeilen im Block `kanbanD-runs`, die kein Durchlauf sind, mit ihrer Stelle im Block — sie bleiben beim Schreiben erhalten.
    #[serde(skip)]
    pub durchlaeufe_fremd: Vec<(usize, String)>,
    /// `wbs-effects`: wie die Aufgabe auf Knoten einer Anwendung gewirkt hat (R00057)
    pub wirkungen: Vec<Wirkung>,
    pub phasen: Phasenangaben,
    #[serde(rename = "reporting")]
    pub zaehlung: Berichtszaehlung,
    /// `cost` (R00105): Preisetikett, geschätzte API-Kosten; null ohne Etikett
    #[serde(rename = "cost")]
    pub kosten: Option<Kosten>,
    /// Frontmatter-Schlüssel, die kanbanD nicht kennt — bleiben beim Schreiben erhalten.
    #[serde(skip)]
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

impl Aufgabe {
    pub fn neu(nummer: u32, datei: String, titel: String) -> Aufgabe {
        Aufgabe {
            nummer,
            datei,
            titel,
            schluessel: None,
            klasse: None,
            zustaendige: vec![],
            labels: vec![],
            faellig: None,
            herkunft: vec![],
            signale: vec![],
            archiviert: None,
            reservierung: None,
            beschreibung: String::new(),
            teilaufgaben: vec![],
            zeiten: vec![],
            kommentare: vec![],
            durchlaeufe: vec![],
            durchlaeufe_fremd: vec![],
            wirkungen: vec![],
            phasen: Phasenangaben::default(),
            zaehlung: Berichtszaehlung::default(),
            kosten: None,
            weitere: vec![],
        }
    }

    /// Der Ordner der Anhänge: Dateiname ohne `.md`.
    pub fn anhangordner(&self) -> &str {
        self.datei.strip_suffix(".md").unwrap_or(&self.datei)
    }
}

/// Was eine Änderung setzt; `None` heißt „unverändert“, `Some(None)` bei entfernbaren Feldern „entfernen“.
#[derive(Debug, Clone, Default, Deserialize, utoipa::ToSchema)]
pub struct Aufgabenaenderung {
    pub titel: Option<String>,
    pub beschreibung: Option<String>,
    #[serde(default, deserialize_with = "entfernbar")]
    pub klasse: Option<Option<String>>,
    pub zustaendige: Option<Vec<String>>,
    pub labels: Option<Vec<String>>,
    #[serde(default, deserialize_with = "entfernbar")]
    pub faellig: Option<Option<String>>,
    pub herkunft: Option<Vec<String>>,
    /// ersetzt die Signale; jedes muss in `kanbanD.md` eingerichtet sein
    pub signale: Option<Vec<String>>,
    pub phasen: Option<Phasenaenderung>,
    pub reporting: Option<Zaehlungsaenderung>,
    /// `cost` (R00105) roh, damit jeder Fehler 400 wird und nie 422; ein Wert ersetzt den Abschnitt, `null` entfernt ihn
    #[serde(default, deserialize_with = "entfernbar")]
    #[schema(value_type = Option<Kosten>)]
    pub cost: Option<Option<serde_json::Value>>,
    /// Ob `key` mitgeschickt wurde, mit welchem Wert auch immer — der Schlüssel wird nur beim Anlegen gesetzt (R00098).
    #[serde(default, rename = "key", deserialize_with = "mitgeschickt")]
    #[schema(ignore)]
    pub schluessel_mitgeschickt: bool,
}

fn mitgeschickt<'de, D: serde::Deserializer<'de>>(d: D) -> Result<bool, D::Error> {
    serde::de::IgnoredAny::deserialize(d).map(|_| true)
}

/// `{"burndown": false, "forecast": null}` — ein Wert setzt, `null` entfernt den Schlüssel (der Standard gilt wieder), fehlt er, bleibt er.
#[derive(Debug, Clone, Default, Deserialize, utoipa::ToSchema)]
pub struct Zaehlungsaenderung {
    #[serde(default, deserialize_with = "entfernbar")]
    pub burndown: Option<Option<bool>>,
    #[serde(default, deserialize_with = "entfernbar")]
    pub forecast: Option<Option<bool>>,
}

/// `{"uebersprungen": [...]}` (auch `skipped` wie in der Datei) ersetzt die entfallenden Phasen.
#[derive(Debug, Clone, Default, Deserialize, utoipa::ToSchema)]
pub struct Phasenaenderung {
    #[serde(alias = "skipped")]
    pub uebersprungen: Option<Vec<String>>,
}

pub const OHNE_HERKUNFT: &str = "thin air";

/// Fehlertext für ein Signal, das nicht eingerichtet ist — `due` wird gerechnet und ist nie setzbar.
pub fn signal_unbekannt(s: &str) -> String {
    if s == crate::modell::SIGNAL_FAELLIG { format!("„{s}“ ist das Signal der Fälligkeit und wird gerechnet — die Fälligkeit setzt es") } else { format!("Signal „{s}“ steht nicht in kanbanD.md") }
}

/// Doppelte entfernen, Reihenfolge des ersten Auftretens behalten.
fn eindeutig(liste: Vec<String>) -> Vec<String> {
    let mut aus: Vec<String> = vec![];
    for x in liste {
        if !aus.contains(&x) {
            aus.push(x);
        }
    }
    aus
}

/// `thin air`, eine ID (`I0007`, `R00014`) oder eine ID mit dem Kürzel einer registrierten Anwendung (`kd:I0007`).
pub fn herkunft_gueltig(h: &str, anwendungen: &Anwendungen) -> bool {
    h == OHNE_HERKUNFT || Herkunftsschluessel::lesen(h).is_some_and(|s| s.kuerzel.is_none_or(|k| anwendungen.registriert(&k)))
}

/// Eingabe in Schreibweise der Datei: `thin air` klein, Kürzel klein, ID groß (`KD:i0007` → `kd:I0007`).
fn herkunft_normalisieren(x: &str) -> String {
    if x.eq_ignore_ascii_case(OHNE_HERKUNFT) {
        return OHNE_HERKUNFT.into();
    }
    match x.split_once(':') {
        Some((k, id)) => format!("{}:{}", k.trim().to_lowercase(), id.trim().to_uppercase()),
        None => x.to_uppercase(),
    }
}

pub(crate) fn entfernbar<'de, D: serde::Deserializer<'de>, T: Deserialize<'de>>(d: D) -> Result<Option<Option<T>>, D::Error> {
    Ok(Some(Option::deserialize(d)?))
}

impl Aufgabe {
    /// Wendet die Änderung an und liefert die Namen der Felder, die sich wirklich geändert haben.
    pub fn aendern(&mut self, a: &Aufgabenaenderung, e: &Einstellungen) -> Result<Vec<&'static str>, String> {
        if a.schluessel_mitgeschickt {
            return Err("Schlüssel ist nicht änderbar".into());
        }
        let mut neu = self.clone();
        if let Some(t) = &a.titel {
            if t.trim().is_empty() {
                return Err("Die Aufgabe braucht einen Titel".into());
            }
            neu.titel = t.trim().into();
        }
        if let Some(b) = &a.beschreibung {
            neu.beschreibung = b.trim().into();
        }
        if let Some(k) = &a.klasse {
            let k = k.as_deref().map(str::trim).filter(|k| !k.is_empty());
            if let Some(k) = k
                && e.klasse(k).is_none()
            {
                return Err(format!("Klasse „{k}“ steht nicht in kanbanD.md"));
            }
            neu.klasse = k.map(Into::into);
        }
        if let Some(z) = &a.zustaendige {
            if let Some(f) = z.iter().find(|k| e.person(k).is_none()) {
                return Err(format!("Person „{f}“ steht nicht in kanbanD.md"));
            }
            neu.zustaendige = eindeutig(z.clone());
        }
        if let Some(l) = &a.labels {
            neu.labels = l.iter().map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect();
        }
        if let Some(f) = &a.faellig {
            let f = f.as_deref().map(str::trim).filter(|f| !f.is_empty());
            if let Some(d) = f
                && NaiveDate::parse_from_str(d, "%Y-%m-%d").is_err()
            {
                return Err(format!("Fälligkeit „{d}“: erwartet JJJJ-MM-TT"));
            }
            neu.faellig = f.map(Into::into);
        }
        if let Some(h) = &a.herkunft {
            let h: Vec<String> = h.iter().map(|x| x.trim()).filter(|x| !x.is_empty()).map(herkunft_normalisieren).collect();
            let anwendungen = Anwendungen::aus(&e.quellen);
            if let Some(f) = h.iter().find(|x| !herkunft_gueltig(x, &anwendungen)) {
                return match Herkunftsschluessel::lesen(f).and_then(|s| s.kuerzel) {
                    Some(k) => Err(format!("„{f}“: Anwendung „{k}“ steht nicht in kanbanD.md")),
                    None => Err(format!("„{f}“ ist keine Herkunft — erwartet I0001, R00014, kd:I0001 oder thin air")),
                };
            }
            if h.len() > 1 && h.iter().any(|x| x == OHNE_HERKUNFT) {
                return Err("„thin air“ steht nur allein".into());
            }
            neu.herkunft = eindeutig(h);
        }
        if let Some(s) = &a.signale {
            let s: Vec<String> = s.iter().map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect();
            if let Some(f) = s.iter().find(|x| e.signal(x).is_none()) {
                return Err(signal_unbekannt(f));
            }
            neu.signale = eindeutig(s);
        }
        if let Some(u) = a.phasen.as_ref().and_then(|p| p.uebersprungen.as_ref()) {
            neu.phasen.uebersprungen = eindeutig(u.iter().map(|x| x.trim().to_string()).filter(|x| !x.is_empty()).collect());
        }
        if let Some(z) = &a.reporting {
            if let Some(b) = z.burndown {
                neu.zaehlung.burndown = b;
            }
            if let Some(f) = z.forecast {
                neu.zaehlung.forecast = f;
            }
        }
        if let Some(k) = &a.cost {
            neu.kosten = k.as_ref().map(Kosten::aus_anfrage).transpose()?;
        }
        let mut felder = vec![];
        for (name, geaendert) in [
            ("Titel", neu.titel != self.titel),
            ("Beschreibung", neu.beschreibung != self.beschreibung),
            ("Klasse", neu.klasse != self.klasse),
            ("Zuständige", neu.zustaendige != self.zustaendige),
            ("Labels", neu.labels != self.labels),
            ("Fälligkeit", neu.faellig != self.faellig),
            ("Herkunft", neu.herkunft != self.herkunft),
            ("Signale", neu.signale != self.signale),
            ("Phasen", neu.phasen != self.phasen),
            ("Zählen in Berichten", neu.zaehlung != self.zaehlung),
            ("Kosten", neu.kosten != self.kosten),
        ] {
            if geaendert {
                felder.push(name);
            }
        }
        *self = neu;
        Ok(felder)
    }
}

#[cfg(test)]
mod tests {
    // R00090: Kennung aus Person und Beginn als ISO mit Versatz; Altbestand mit dem Versatz seiner Ortszeit-Deutung
    #[test]
    fn kennung_eines_zeiteintrags() {
        let z = |beginn: &str| super::Zeiteintrag { wer: "entw".into(), beginn: beginn.into(), ende: None };
        assert_eq!(z("2026-10-25 05:57+01:00").kennung(), "entw@2026-10-25T05:57+01:00");
        assert_eq!(z("2026-10-25 04:57+00:00").kennung(), "entw@2026-10-25T04:57+00:00");
        let alt = z("2026-10-18 09:00").kennung();
        assert!(alt.starts_with("entw@2026-10-18T09:00") && (alt.ends_with("+02:00") || alt.len() == "entw@2026-10-18T09:00+00:00".len()), "{alt}");
        assert_eq!(serde_json::to_value(z("2026-10-25 05:57+01:00")).unwrap()["kennung"], "entw@2026-10-25T05:57+01:00", "in der API");
    }

    // R00087: 24 h ab seit, auf die Minute
    #[test]
    fn reservierung_haelt_24_stunden() {
        let r = super::Reservierung { wer: "cl".into(), instanz: "a".into(), seit: "2026-10-24 10:00+02:00".into() };
        assert!(r.gueltig("2026-10-25 08:59+01:00"), "23:59 h — über die Zeitumstellung");
        assert!(!r.gueltig("2026-10-25 10:01+02:00"), "24:01 h");
        assert!(!r.gueltig("2026-10-25 09:00+01:00"), "genau 24 h");
        assert!(r.gueltig("2026-10-24 09:00+02:00"), "seit in der Zukunft zählt als frisch");
        assert!(r.gehoert("a") && !r.gehoert("b"));
    }

    // R00098 B0315: 1–200 Zeichen ohne Zeilenumbruch, außen getrimmt, Groß/Klein bleibt
    #[test]
    fn schluessel_pruefen() {
        let fehler = Err("Schlüssel: 1–200 Zeichen ohne Zeilenumbruch".to_string());
        for k in ["", "   ", "\n", "a\nb", "a\rb", "a\u{2028}b", &"x".repeat(201)] {
            assert_eq!(super::Fremdschluessel::pruefen(k), fehler, "{k:?}");
        }
        for (k, erwartet) in [("k", "k"), (" k1 ", "k1"), ("K4", "K4"), ("shop/nc-304/lodash", "shop/nc-304/lodash"), ("a: b", "a: b")] {
            assert_eq!(super::Fremdschluessel::pruefen(k).unwrap().text(), erwartet, "{k:?}");
        }
        let lang = "ä".repeat(200);
        assert_eq!(super::Fremdschluessel::pruefen(&lang).unwrap().text(), lang, "200 Zeichen, nicht Bytes");
        assert!(super::Fremdschluessel::pruefen(&"ä".repeat(201)).is_err());
    }

    // R00098 B0317: genau mit Groß/Klein; offen, archiviert, mehrfach aufsteigend
    #[test]
    fn schluessel_suchen() {
        use super::{Aufgabe, Fremdschluessel, Schluesseltreffer};
        let k = |t: &str| Fremdschluessel::pruefen(t).unwrap();
        let karte = |nr: u32, schluessel: Option<&str>, archiviert: bool| {
            let mut a = Aufgabe::neu(nr, format!("{nr:04}-x.md"), "x".into());
            a.schluessel = schluessel.map(k);
            a.archiviert = archiviert.then(|| "2026-10-01".into());
            a
        };
        assert_eq!(Schluesseltreffer::suchen(&[], &k("k4")), Schluesseltreffer::Keiner);
        let offen = [karte(3, None, false), karte(7, Some("k4"), false), karte(8, Some("k5"), false)];
        assert_eq!(Schluesseltreffer::suchen(&offen, &k("k4")), Schluesseltreffer::Offen(7));
        assert_eq!(Schluesseltreffer::suchen(&offen, &k("K4")), Schluesseltreffer::Keiner, "Groß/Klein zählt");
        assert_eq!(Schluesseltreffer::suchen(&[karte(7, Some("k4"), true)], &k("k4")), Schluesseltreffer::Archiviert(7));
        let doppelt = [karte(9, Some("k5"), false), karte(8, Some("k5"), true)];
        assert_eq!(Schluesseltreffer::suchen(&doppelt, &k("k5")), Schluesseltreffer::Mehrfach(vec![8, 9]));
    }

    // R00098 B0329: je Schlüssel mit mehr als einer Karte die Nummern aufsteigend, Schlüssel sortiert
    #[test]
    fn doppelte_schluessel_finden() {
        use super::{Aufgabe, Dublette, Fremdschluessel, doppelte_schluessel};
        let karte = |nr: u32, schluessel: Option<&str>| {
            let mut a = Aufgabe::neu(nr, format!("{nr:04}-x.md"), "x".into());
            a.schluessel = schluessel.map(|t| Fremdschluessel::pruefen(t).unwrap());
            a
        };
        assert_eq!(doppelte_schluessel(&[karte(1, Some("k1")), karte(2, None), karte(3, None)]), vec![]);
        let alle = [karte(9, Some("k5")), karte(4, Some("a")), karte(8, Some("k5")), karte(5, Some("A")), karte(6, Some("a")), karte(7, Some("k4"))];
        assert_eq!(doppelte_schluessel(&alle), vec![Dublette { key: "a".into(), nummern: vec![4, 6] }, Dublette { key: "k5".into(), nummern: vec![8, 9] }]);
    }

    #[test]
    fn instanz_kennungen() {
        for k in ["a", "agent-1", "Rechner.2_b", &"x".repeat(64)] {
            assert!(super::instanz_gueltig(k), "{k}");
        }
        for k in ["", "mit leer", "ä", "a/b", &"x".repeat(65)] {
            assert!(!super::instanz_gueltig(k), "{k}");
        }
    }

    use super::*;
    use crate::modell::{Art, Klasse, Person};

    fn e() -> Einstellungen {
        Einstellungen {
            personen: vec![Person { kuerzel: "st".into(), name: "S".into(), art: Art::Mensch, aktiv: true }],
            klassen: vec![Klasse { schluessel: "bug".into(), bezeichnung: "Fehler".into(), farbe: "red".into() }],
            ..Default::default()
        }
    }

    fn aend(json: &str) -> Aufgabenaenderung {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn felder_aendern_und_benennen() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        let f = a.aendern(&aend(r#"{"titel":" Neu ","klasse":"bug","labels":["ui"," ","daten"],"faellig":"2026-12-24","zustaendige":["st"]}"#), &e()).unwrap();
        assert_eq!(f, vec!["Titel", "Klasse", "Zuständige", "Labels", "Fälligkeit"]);
        assert_eq!((a.titel.as_str(), a.klasse.as_deref(), a.labels.clone(), a.faellig.as_deref()), ("Neu", Some("bug"), vec!["ui".to_string(), "daten".into()], Some("2026-12-24")));
        assert_eq!(a.aendern(&aend(r#"{"titel":"Neu"}"#), &e()).unwrap(), Vec::<&str>::new());
        assert_eq!(a.aendern(&aend(r#"{"klasse":null,"faellig":null,"beschreibung":"b"}"#), &e()).unwrap(), vec!["Beschreibung", "Klasse", "Fälligkeit"]);
        assert!(a.klasse.is_none() && a.faellig.is_none());
        assert_eq!(a.datei, "0001-x.md");
    }

    #[test]
    fn herkunft_pruefen_und_setzen() {
        let ohne = Anwendungen::aus(&Default::default());
        let g = |h: &str| herkunft_gueltig(h, &ohne);
        assert!(g("I0007") && g("D0001") && g("R00014") && g("thin air"));
        assert!(!g("X1") && !g("I007") && !g("R0001") && !g("i0007") && !g("kd:I0007"));
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        assert_eq!(a.aendern(&aend(r#"{"herkunft":["i0007"," R00014 ","I0007"]}"#), &e()).unwrap(), vec!["Herkunft"]);
        assert_eq!(a.herkunft, vec!["I0007", "R00014"]);
        assert!(a.aendern(&aend(r#"{"herkunft":["X1"]}"#), &e()).unwrap_err().contains("X1"));
        assert!(a.aendern(&aend(r#"{"herkunft":["Thin Air","I0001"]}"#), &e()).is_err());
        a.aendern(&aend(r#"{"herkunft":["THIN AIR"]}"#), &e()).unwrap();
        assert_eq!(a.herkunft, vec!["thin air"]);
    }

    #[test]
    fn qualifizierte_herkunft_braucht_ein_registriertes_kuerzel() {
        let mut mit = e();
        mit.quellen.anwendungen = vec![crate::modell::Anwendung { kuerzel: "kd".into(), name: "kanbanD".into(), wbs: "/x/plan.md".into(), anforderungen: "".into() }];
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        assert_eq!(a.aendern(&aend(r#"{"herkunft":["KD:i0007","R00014"]}"#), &mit).unwrap(), vec!["Herkunft"]);
        assert_eq!(a.herkunft, vec!["kd:I0007", "R00014"]);
        let f = a.aendern(&aend(r#"{"herkunft":["xx:I0007"]}"#), &mit).unwrap_err();
        assert!(f.contains("Anwendung „xx“"), "{f}");
        assert!(a.aendern(&aend(r#"{"herkunft":["KD!:I0007"]}"#), &mit).unwrap_err().contains("keine Herkunft"));
        assert_eq!(a.herkunft, vec!["kd:I0007", "R00014"]);
    }

    #[test]
    fn entfallende_phasen_setzen() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        assert_eq!(a.aendern(&aend(r#"{"phasen":{"uebersprungen":[" Abnahme ","","Abnahme","Entwicklertest"]}}"#), &e()).unwrap(), vec!["Phasen"]);
        assert_eq!(a.phasen.uebersprungen, vec!["Abnahme", "Entwicklertest"]);
        assert!(a.aendern(&aend(r#"{"phasen":{"skipped":["Abnahme","Entwicklertest"]}}"#), &e()).unwrap().is_empty(), "skipped wie in der Datei, gleich ist keine Änderung");
        assert_eq!(a.aendern(&aend(r#"{"phasen":{"uebersprungen":[]}}"#), &e()).unwrap(), vec!["Phasen"]);
        assert!(a.phasen.uebersprungen.is_empty());
        assert!(a.aendern(&aend(r#"{"phasen":{}}"#), &e()).unwrap().is_empty(), "ohne Liste bleibt alles");
    }

    #[test]
    fn regeln_lassen_die_aufgabe_unveraendert() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        for j in [r#"{"titel":" "}"#, r#"{"klasse":"gibtsnicht"}"#, r#"{"faellig":"24.12."}"#, r#"{"zustaendige":["zz"]}"#] {
            assert!(a.aendern(&aend(j), &e()).is_err(), "{j}");
        }
        assert_eq!(a, Aufgabe::neu(1, "0001-x.md".into(), "x".into()));
        assert!(a.aendern(&aend(r#"{"klasse":"  ","faellig":""}"#), &e()).unwrap().is_empty());
    }

    // R00105: cost ersetzt den Abschnitt, null entfernt ihn, fehlt er, bleibt er; jeder Fehler ist eine Meldung, kein serde-Fehler
    #[test]
    fn kosten_setzen_ersetzen_entfernen() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        let setzen = r#"{"cost":{"currency":"USD","min":0.6,"max":1.6,"basis":"Schätzung planer"}}"#;
        assert_eq!(a.aendern(&aend(setzen), &e()).unwrap(), vec!["Kosten"]);
        assert_eq!(a.kosten.as_ref().map(|k| &k.wert), Some(&crate::modell::Gesamt::Spanne { min: 60, max: 160 }));
        assert!(a.aendern(&aend(setzen), &e()).unwrap().is_empty(), "derselbe Wert ändert nichts");
        assert_eq!(a.aendern(&aend(r#"{"titel":"y"}"#), &e()).unwrap(), vec!["Titel"]);
        assert!(a.kosten.is_some(), "ohne cost bleibt der Abschnitt");
        assert_eq!(a.aendern(&aend(r#"{"cost":{"currency":"USD","amount":1.1}}"#), &e()).unwrap(), vec!["Kosten"]);
        assert_eq!(a.kosten.as_ref().map(|k| (&k.wert, &k.basis)), Some((&crate::modell::Gesamt::Betrag(110), &None)), "ersetzt, nicht gemischt");
        assert_eq!(a.aendern(&aend(r#"{"cost":null}"#), &e()).unwrap(), vec!["Kosten"]);
        assert_eq!(a.kosten, None);
        assert!(a.aendern(&aend(r#"{"cost":null}"#), &e()).unwrap().is_empty());
    }

    #[test]
    fn falsche_kosten_aendern_nichts() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        a.aendern(&aend(r#"{"cost":{"currency":"USD","amount":1.63}}"#), &e()).unwrap();
        let vorher = a.clone();
        for (cost, meldung) in [
            (r#""1.63""#, "cost: keine Zuordnung"),
            (r#"{"currency":"USD","amount":"1.63"}"#, "cost.amount: keine Zahl"),
            (r#"{"currency":"USD","ammount":1.63}"#, "cost: unbekannter Schlüssel „ammount“"),
            (r#"{"currency":"usd","amount":1}"#, "cost.currency: genau drei Großbuchstaben A–Z"),
        ] {
            let aenderung: Aufgabenaenderung = serde_json::from_str(&format!(r#"{{"titel":"neu","cost":{cost}}}"#)).expect("roh angenommen, kein serde-Fehler");
            assert_eq!(a.aendern(&aenderung, &e()).unwrap_err(), meldung, "{cost}");
            assert_eq!(a, vorher, "{cost}: auch der Titel bleibt");
        }
    }
}
