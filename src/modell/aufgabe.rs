use super::{Abhaengigkeit, Anwendungen, BRAUCHT_UEBER_LABELS, Einstellungen, Herkunftsschluessel, Klassengeltung, Kosten, Kosteneintrag};
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
/// Höchste geschätzte Zeit in ganzen Minuten (ADR-0023 Regel 2) — technischer Schutzwert gegen Tippfehler, keine Produktregel.
pub const GESCHAETZTE_MINUTEN_MAX: u32 = 100_000;

/// Meldung eines formwidrigen `estimate` (ADR-0023): die Datei meldet sie als Formatfehler mit diesem Pfad, die API als 400.
pub const GESCHAETZT_MELDUNG: &str = "estimate: ganze Zahl von Minuten ≥ 1 erwartet";

/// Prüft einen rohen `estimate`-Wert als YAML-Wert — Datei und API rufen dieselbe Prüfung (ADR-0023 Regeln 3 und 4).
/// `None`/`null` heißt „keine Schätzung"; gültig ist die ganze Zahl 1..=100.000, jede andere Form ist ein Fehler mit Pfad.
pub fn geschaetzte_minuten_pruefen(wert: Option<&serde_yaml::Value>) -> Result<Option<u32>, String> {
    match wert {
        None | Some(serde_yaml::Value::Null) => Ok(None),
        Some(serde_yaml::Value::Number(n)) => n.as_u64().and_then(|m| u32::try_from(m).ok()).filter(|m| (1..=GESCHAETZTE_MINUTEN_MAX).contains(m)).map(Some).ok_or_else(|| GESCHAETZT_MELDUNG.to_string()),
        Some(_) => Err(GESCHAETZT_MELDUNG.to_string()),
    }
}

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
    #[serde(rename = "reporting")]
    pub zaehlung: Berichtszaehlung,
    /// `cost` (R00105): Preisetikett, geschätzte API-Kosten; null ohne Etikett
    #[serde(rename = "cost")]
    pub kosten: Option<Kosten>,
    /// `cost-entries` (R00165, ADR-0028): angefallene Kosten je Rollenlauf, in der Reihenfolge der Datei; `PATCH cost` berührt sie nie
    #[serde(default)]
    pub kosteneintraege: Vec<Kosteneintrag>,
    /// `commits` (R00202, ADR-0032 Punkt 1): Commit-Verweise `<kürzel>:<voller Hash>`, ohne Kürzel die Standardanwendung —
    /// wörtlich wie in der Datei, in der Reihenfolge des Hinterlegens; auch ein unlesbarer Eintrag bleibt stehen
    #[serde(default)]
    pub commits: Vec<String>,
    /// `transcripts` (R00216, ADR-0036 Regel 3): Transkripte der Agentenläufe in der Reihenfolge des Ablegens; in der
    /// API als `transkripte: [{kennung, at, role, column, bytes}]` nur die lesbaren, ohne Zugriff auf `transkripte/`.
    /// Ein formwidriger Eintrag bleibt wörtlich in der Datei und erscheint nur in `GET …/transkripte` (als `unlesbar`).
    #[serde(default, rename = "transkripte", serialize_with = "nur_lesbare", deserialize_with = "nie_gelesen_liste")]
    #[schema(value_type = Vec<super::Transkripteintrag>)]
    pub transkripte: Vec<super::Transkriptzeile>,
    /// `estimate` (R00129): geschätzte Zeit in ganzen Minuten, ≥ 1 und ≤ 100.000; null/fehlend heißt „keine Schätzung“
    #[serde(rename = "estimate")]
    pub geschaetzte_minuten: Option<u32>,
    /// `braucht` (R00214, ADR-0035 Punkt 4): abgeleitet aus den Labels `braucht:<n>` in deren Reihenfolge, nur lesbar —
    /// steht in `GET /api/aufgaben` und `GET /api/aufgaben/{nr}`, ohne Abhängigkeit `[]`; geschrieben wird über `labels`
    // `deserialize_with` statt `skip_deserializing`: utoipa ließe das Feld sonst aus dem Schema weg (utoipa-gen 6, serde.rs:51).
    #[serde(default, deserialize_with = "nie_gelesen", skip_serializing_if = "Option::is_none")]
    #[schema(schema_with = braucht_schema)]
    pub braucht: Option<Vec<Abhaengigkeit>>,
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
            zaehlung: Berichtszaehlung::default(),
            kosten: None,
            kosteneintraege: vec![],
            commits: vec![],
            transkripte: vec![],
            geschaetzte_minuten: None,
            braucht: None,
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
    pub reporting: Option<Zaehlungsaenderung>,
    /// `cost` (R00105) roh, damit jeder Fehler 400 wird und nie 422; ein Wert ersetzt den Abschnitt, `null` entfernt ihn
    #[serde(default, deserialize_with = "entfernbar")]
    #[schema(value_type = Option<Kosten>)]
    pub cost: Option<Option<serde_json::Value>>,
    /// `estimate` (R00129) roh, damit jeder Fehler 400 wird und nie 422; ein Wert ersetzt, `null` entfernt, fehlend lässt unverändert
    #[serde(default, deserialize_with = "entfernbar")]
    #[schema(value_type = Option<u32>)]
    pub estimate: Option<Option<serde_json::Value>>,
    /// Ob `key` mitgeschickt wurde, mit welchem Wert auch immer — der Schlüssel wird nur beim Anlegen gesetzt (R00098).
    #[serde(default, rename = "key", deserialize_with = "mitgeschickt")]
    #[schema(ignore)]
    pub schluessel_mitgeschickt: bool,
    /// Ob `braucht` mitgeschickt wurde — das Feld ist nur lesbar, geschrieben wird über `labels` (R00214).
    #[serde(default, rename = "braucht", deserialize_with = "mitgeschickt")]
    #[schema(ignore)]
    pub braucht_mitgeschickt: bool,
}

/// Schema von `braucht` von Hand: `readOnly` am Feld selbst. `#[schema(read_only)]` setzt es in utoipa 6 nur an die
/// Elemente, und `Array` hat kein eigenes `read_only` — deshalb über die flach geschriebene Zusatz-Tabelle.
fn braucht_schema() -> utoipa::openapi::schema::Array {
    use utoipa::PartialSchema;
    use utoipa::openapi::extensions::Extensions;
    use utoipa::openapi::schema::{ArrayBuilder, SchemaType, Type};
    let mut nur_lesbar = Extensions::default();
    nur_lesbar.insert("readOnly".into(), serde_json::Value::Bool(true));
    ArrayBuilder::new()
        .schema_type(SchemaType::from_iter([Type::Array, Type::Null]))
        .items(Abhaengigkeit::schema())
        .extensions(Some(nur_lesbar))
        .description(Some("nur lesbar, abgeleitet aus den Labels `braucht:<n>` in deren Reihenfolge (R00214, ADR-0035): [{nummer, titel, erledigt}] — steht in GET /api/aufgaben und GET /api/aufgaben/{nr}, ohne Abhängigkeit []; geschrieben wird über labels, braucht im Rumpf → 400"))
        .build()
}

/// `transkripte` in der API: nur die lesbaren Einträge.
fn nur_lesbare<S: serde::Serializer>(zeilen: &[super::Transkriptzeile], s: S) -> Result<S::Ok, S::Error> {
    s.collect_seq(zeilen.iter().filter_map(super::Transkriptzeile::lesbar))
}

/// `transkripte` im Rumpf einer Anfrage wird überlesen — geschrieben wird nur über `…/transkripte` (R00216).
fn nie_gelesen_liste<'de, D: serde::Deserializer<'de>, T>(d: D) -> Result<Vec<T>, D::Error> {
    serde::de::IgnoredAny::deserialize(d).map(|_| vec![])
}

/// Ein nur lesbares Feld: was immer ankommt, wird überlesen.
fn nie_gelesen<'de, D: serde::Deserializer<'de>, T>(d: D) -> Result<Option<T>, D::Error> {
    serde::de::IgnoredAny::deserialize(d).map(|_| None)
}

pub(crate) fn mitgeschickt<'de, D: serde::Deserializer<'de>>(d: D) -> Result<bool, D::Error> {
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
    /// `klassen` sagt, welche Klasse die Aufgabe annehmen darf (ADR-0031 Regel 6); ein unveränderter Wert wird nicht geprüft.
    pub fn aendern(&mut self, a: &Aufgabenaenderung, e: &Einstellungen, klassen: &Klassengeltung) -> Result<Vec<&'static str>, String> {
        if a.schluessel_mitgeschickt {
            return Err("Schlüssel ist nicht änderbar".into());
        }
        if a.braucht_mitgeschickt {
            return Err(BRAUCHT_UEBER_LABELS.into());
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
                && self.klasse.as_deref() != Some(k)
            {
                klassen.pruefen(k)?;
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
        if let Some(wert) = &a.estimate {
            // `estimate` kommt roh an und geht durch dieselbe Prüfung wie das Frontmatter (ADR-0023 Regel 4): jeder Fehler 400.
            let yaml = wert.as_ref().map(serde_yaml::to_value).transpose().map_err(|_| GESCHAETZT_MELDUNG.to_string())?;
            neu.geschaetzte_minuten = geschaetzte_minuten_pruefen(yaml.as_ref())?;
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
            ("Zählen in Berichten", neu.zaehlung != self.zaehlung),
            ("Kosten", neu.kosten != self.kosten),
            ("Geschätzte Zeit", neu.geschaetzte_minuten != self.geschaetzte_minuten),
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

    fn geltung() -> Klassengeltung {
        Klassengeltung::neu([], &e())
    }

    /// R00214 AK 4: `braucht` im Rumpf — mit jedem Wert, auch neben anderen Feldern — ändert nichts und wird abgewiesen.
    #[test]
    fn braucht_im_rumpf_wird_abgewiesen() {
        let mut a = Aufgabe::neu(5, "0005-frei.md".into(), "Frei".into());
        let vorher = a.clone();
        for rumpf in [r#"{"braucht":[{"nummer":1}]}"#, r#"{"braucht":[]}"#, r#"{"braucht":null}"#, r#"{"titel":"x","labels":["braucht:1"],"braucht":7}"#] {
            assert_eq!(a.aendern(&aend(rumpf), &e(), &geltung()).unwrap_err(), "braucht über labels setzen (braucht:<nr>)", "{rumpf}");
            assert_eq!(a, vorher, "{rumpf}");
        }
        assert_eq!(a.aendern(&aend(r#"{"labels":["braucht:1"]}"#), &e(), &geltung()).unwrap(), vec!["Labels"], "über labels geht es");
        assert_eq!(serde_json::to_value(&a).unwrap().get("braucht"), None, "ungerechnet steht das Feld nicht in der Antwort");
    }

    /// R00195 AK 4 (ADR-0031 Regel 6): ein unverändert mitgeschickter Wert wird nicht geprüft — auch ein fremder nicht.
    #[test]
    fn eine_unveraendert_mitgeschickte_fremde_klasse_bleibt_stehen() {
        let mut a = Aufgabe::neu(2, "0002-zwei.md".into(), "Zwei".into());
        a.klasse = Some("sicherheit".into());
        assert_eq!(a.aendern(&aend(r#"{"titel":"neu","klasse":"sicherheit"}"#), &e(), &geltung()).unwrap(), vec!["Titel"]);
        assert_eq!(a.aendern(&aend(r#"{"klasse":" sicherheit "}"#), &e(), &geltung()).unwrap(), Vec::<&str>::new());
        assert_eq!(a.klasse.as_deref(), Some("sicherheit"));
        assert_eq!(a.aendern(&aend(r#"{"klasse":"gibtsnicht"}"#), &e(), &geltung()).unwrap_err(), "Klasse „gibtsnicht“ steht nicht in kanbanD.md");
        assert_eq!(a.aendern(&aend(r#"{"klasse":"bug"}"#), &e(), &geltung()).unwrap(), vec!["Klasse"]);
    }

    fn aend(json: &str) -> Aufgabenaenderung {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn felder_aendern_und_benennen() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        let f = a.aendern(&aend(r#"{"titel":" Neu ","klasse":"bug","labels":["ui"," ","daten"],"faellig":"2026-12-24","zustaendige":["st"]}"#), &e(), &geltung()).unwrap();
        assert_eq!(f, vec!["Titel", "Klasse", "Zuständige", "Labels", "Fälligkeit"]);
        assert_eq!((a.titel.as_str(), a.klasse.as_deref(), a.labels.clone(), a.faellig.as_deref()), ("Neu", Some("bug"), vec!["ui".to_string(), "daten".into()], Some("2026-12-24")));
        assert_eq!(a.aendern(&aend(r#"{"titel":"Neu"}"#), &e(), &geltung()).unwrap(), Vec::<&str>::new());
        assert_eq!(a.aendern(&aend(r#"{"klasse":null,"faellig":null,"beschreibung":"b"}"#), &e(), &geltung()).unwrap(), vec!["Beschreibung", "Klasse", "Fälligkeit"]);
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
        assert_eq!(a.aendern(&aend(r#"{"herkunft":["i0007"," R00014 ","I0007"]}"#), &e(), &geltung()).unwrap(), vec!["Herkunft"]);
        assert_eq!(a.herkunft, vec!["I0007", "R00014"]);
        assert!(a.aendern(&aend(r#"{"herkunft":["X1"]}"#), &e(), &geltung()).unwrap_err().contains("X1"));
        assert!(a.aendern(&aend(r#"{"herkunft":["Thin Air","I0001"]}"#), &e(), &geltung()).is_err());
        a.aendern(&aend(r#"{"herkunft":["THIN AIR"]}"#), &e(), &geltung()).unwrap();
        assert_eq!(a.herkunft, vec!["thin air"]);
    }

    #[test]
    fn qualifizierte_herkunft_braucht_ein_registriertes_kuerzel() {
        let mut mit = e();
        mit.quellen.anwendungen = vec![crate::modell::Anwendung { kuerzel: "kd".into(), name: "kanbanD".into(), repository: String::new(), wbs: "/x/plan.md".into(), anforderungen: "".into() }];
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        assert_eq!(a.aendern(&aend(r#"{"herkunft":["KD:i0007","R00014"]}"#), &mit, &geltung()).unwrap(), vec!["Herkunft"]);
        assert_eq!(a.herkunft, vec!["kd:I0007", "R00014"]);
        let f = a.aendern(&aend(r#"{"herkunft":["xx:I0007"]}"#), &mit, &geltung()).unwrap_err();
        assert!(f.contains("Anwendung „xx“"), "{f}");
        assert!(a.aendern(&aend(r#"{"herkunft":["KD!:I0007"]}"#), &mit, &geltung()).unwrap_err().contains("keine Herkunft"));
        assert_eq!(a.herkunft, vec!["kd:I0007", "R00014"]);
    }

    // R00223 (ADR-0034 N4 Regel 2): `phasen` im PATCH ist ein unbekanntes Feld und wird überlesen — keine Änderung, und ein
    // `phases`, das die Datei trägt, bleibt unter den unbekannten Schlüsseln stehen.
    #[test]
    fn phasen_im_patch_wird_ueberlesen() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        a.weitere.push(("phases".into(), serde_yaml::from_str("{skipped: [Reviews]}").unwrap()));
        let vorher = a.clone();
        for rumpf in [r#"{"phasen":{"uebersprungen":["Abnahme"]}}"#, r#"{"phasen":{"uebersprungen":[]}}"#, r#"{"phasen":{"skipped":["Abnahme"]}}"#] {
            assert!(a.aendern(&aend(rumpf), &e(), &geltung()).unwrap().is_empty(), "{rumpf}");
            assert_eq!(a, vorher, "{rumpf}");
        }
    }

    #[test]
    fn regeln_lassen_die_aufgabe_unveraendert() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        for j in [r#"{"titel":" "}"#, r#"{"klasse":"gibtsnicht"}"#, r#"{"faellig":"24.12."}"#, r#"{"zustaendige":["zz"]}"#] {
            assert!(a.aendern(&aend(j), &e(), &geltung()).is_err(), "{j}");
        }
        assert_eq!(a, Aufgabe::neu(1, "0001-x.md".into(), "x".into()));
        assert!(a.aendern(&aend(r#"{"klasse":"  ","faellig":""}"#), &e(), &geltung()).unwrap().is_empty());
    }

    // R00105: cost ersetzt den Abschnitt, null entfernt ihn, fehlt er, bleibt er; jeder Fehler ist eine Meldung, kein serde-Fehler
    #[test]
    fn kosten_setzen_ersetzen_entfernen() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        let setzen = r#"{"cost":{"currency":"USD","min":0.6,"max":1.6,"basis":"Schätzung planer"}}"#;
        assert_eq!(a.aendern(&aend(setzen), &e(), &geltung()).unwrap(), vec!["Kosten"]);
        assert_eq!(a.kosten.as_ref().map(|k| &k.wert), Some(&crate::modell::Gesamt::Spanne { min: 60, max: 160 }));
        assert!(a.aendern(&aend(setzen), &e(), &geltung()).unwrap().is_empty(), "derselbe Wert ändert nichts");
        assert_eq!(a.aendern(&aend(r#"{"titel":"y"}"#), &e(), &geltung()).unwrap(), vec!["Titel"]);
        assert!(a.kosten.is_some(), "ohne cost bleibt der Abschnitt");
        assert_eq!(a.aendern(&aend(r#"{"cost":{"currency":"USD","amount":1.1}}"#), &e(), &geltung()).unwrap(), vec!["Kosten"]);
        assert_eq!(a.kosten.as_ref().map(|k| (&k.wert, &k.basis)), Some((&crate::modell::Gesamt::Betrag(110), &None)), "ersetzt, nicht gemischt");
        assert_eq!(a.aendern(&aend(r#"{"cost":null}"#), &e(), &geltung()).unwrap(), vec!["Kosten"]);
        assert_eq!(a.kosten, None);
        assert!(a.aendern(&aend(r#"{"cost":null}"#), &e(), &geltung()).unwrap().is_empty());
    }

    // R00129 B0607: eine Prüfung für Datei und API — ganze Minuten 1..=100.000, sonst der Pfadfehler (ADR-0023 Regeln 2, 3)
    #[test]
    fn geschaetzte_minuten_pruefen_je_form() {
        let p = |t: &str| super::geschaetzte_minuten_pruefen(Some(&serde_yaml::from_str::<serde_yaml::Value>(t).unwrap()));
        for (t, m) in [("1", 1_u32), ("5", 5), ("150", 150), ("100000", super::GESCHAETZTE_MINUTEN_MAX)] {
            assert_eq!(p(t), Ok(Some(m)), "{t}");
        }
        assert_eq!(p("null"), Ok(None), "null heißt keine Schätzung");
        assert_eq!(super::geschaetzte_minuten_pruefen(None), Ok(None), "fehlend heißt keine Schätzung");
        for t in ["0", "-1", "100001", "2.5", "150.0", "\"150\"", "2:30", ".inf", "-.inf", ".nan", "true", "[1]", "{a: 1}"] {
            assert_eq!(p(t), Err(super::GESCHAETZT_MELDUNG.to_string()), "{t}");
        }
    }

    // R00129 B0609: estimate roh — setzen, ersetzen, null entfernt, fehlend lässt unverändert; jeder Fehlfall eine Meldung, kein serde-Fehler
    #[test]
    fn geschaetzte_zeit_setzen_ersetzen_entfernen() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        assert_eq!(a.aendern(&aend(r#"{"estimate":150}"#), &e(), &geltung()).unwrap(), vec!["Geschätzte Zeit"]);
        assert_eq!(a.geschaetzte_minuten, Some(150));
        assert!(a.aendern(&aend(r#"{"estimate":150}"#), &e(), &geltung()).unwrap().is_empty(), "derselbe Wert ändert nichts");
        assert_eq!(a.aendern(&aend(r#"{"titel":"y"}"#), &e(), &geltung()).unwrap(), vec!["Titel"]);
        assert_eq!(a.geschaetzte_minuten, Some(150), "ohne estimate bleibt der Wert");
        assert_eq!(a.aendern(&aend(r#"{"estimate":90}"#), &e(), &geltung()).unwrap(), vec!["Geschätzte Zeit"]);
        assert_eq!(a.geschaetzte_minuten, Some(90));
        assert_eq!(a.aendern(&aend(r#"{"estimate":null}"#), &e(), &geltung()).unwrap(), vec!["Geschätzte Zeit"]);
        assert_eq!(a.geschaetzte_minuten, None);
        assert!(a.aendern(&aend(r#"{"estimate":null}"#), &e(), &geltung()).unwrap().is_empty(), "nichts zu entfernen");
        for falsch in [r#""2:30""#, r#""150""#, r#"150.0"#, r#"2.5"#, r#"0"#, r#"-1"#, r#"100001"#, r#"true"#] {
            a.geschaetzte_minuten = Some(150);
            let vorher = a.clone();
            assert_eq!(a.aendern(&aend(&format!(r#"{{"estimate":{falsch}}}"#)), &e(), &geltung()).unwrap_err(), super::GESCHAETZT_MELDUNG, "{falsch}");
            assert_eq!(a, vorher, "{falsch}: nichts geändert");
        }
    }

    #[test]
    fn falsche_kosten_aendern_nichts() {
        let mut a = Aufgabe::neu(1, "0001-x.md".into(), "x".into());
        a.aendern(&aend(r#"{"cost":{"currency":"USD","amount":1.63}}"#), &e(), &geltung()).unwrap();
        let vorher = a.clone();
        for (cost, meldung) in [
            (r#""1.63""#, "cost: keine Zuordnung"),
            (r#"{"currency":"USD","amount":"1.63"}"#, "cost.amount: keine Zahl"),
            (r#"{"currency":"USD","ammount":1.63}"#, "cost: unbekannter Schlüssel „ammount“"),
            (r#"{"currency":"usd","amount":1}"#, "cost.currency: genau drei Großbuchstaben A–Z"),
        ] {
            let aenderung: Aufgabenaenderung = serde_json::from_str(&format!(r#"{{"titel":"neu","cost":{cost}}}"#)).expect("roh angenommen, kein serde-Fehler");
            assert_eq!(a.aendern(&aenderung, &e(), &geltung()).unwrap_err(), meldung, "{cost}");
            assert_eq!(a, vorher, "{cost}: auch der Titel bleibt");
        }
    }
}
