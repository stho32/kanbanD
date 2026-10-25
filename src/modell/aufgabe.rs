use super::{Anwendungen, Einstellungen, Herkunftsschluessel};
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Teilaufgabe {
    pub text: String,
    pub erledigt: bool,
}

/// Eine Zeile im Block `kanbanD-time`. Zeitpunkte als `JJJJ-MM-TT HH:MM` in Ortszeit; ohne Ende läuft sie.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Zeiteintrag {
    pub wer: String,
    pub beginn: String,
    pub ende: Option<String>,
}

impl Zeiteintrag {
    /// Kennung `wer@JJJJ-MM-TTTHH:MM±HH:MM` (R00090): Person und Beginn als eindeutiger Moment — ein Altbeginn ohne
    /// Versatz bekommt den seiner Ortszeit-Deutung. Ein unlesbarer Beginn bleibt, wie er ist.
    pub fn kennung(&self) -> String {
        let beginn = crate::uhr::Zeitpunkt::lesen(&self.beginn).map(|z| z.iso()).unwrap_or_else(|| self.beginn.clone());
        format!("{}@{beginn}", self.wer)
    }
}

/// Eine Karte, die eine Instanz für sich hält (R00087); in der Datei `reservation: {who, instance, since}`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Reservierung {
    pub wer: String,
    pub instanz: String,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Kommentar {
    pub wer: String,
    pub zeitpunkt: String,
    pub text: String,
}

/// Was eine Aufgabe an einem WBS-Knoten bewirkt (R00057); in der Datei englisch wie der Namensraum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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
        #[derive(Deserialize)]
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
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Phasenangaben {
    /// `skipped`: Phasen, die für diese Aufgabe entfallen — sie zählt dort weder in Zähler und Nenner noch im Durchsatz
    pub uebersprungen: Vec<String>,
    /// Schlüssel im Namensraum, die kanbanD nicht kennt — bleiben beim Schreiben erhalten.
    #[serde(skip)]
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

/// `reporting`: ob die Aufgabe in Berichten zählt (R00060); fehlt ein Schlüssel, gilt der Standard — sie zählt.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
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
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Aufgabe {
    pub nummer: u32,
    /// Dateiname unter `aufgaben/`, z. B. `0012-kopfzeile.md`.
    pub datei: String,
    pub titel: String,
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
    /// `wbs-effects`: wie die Aufgabe auf Knoten einer Anwendung gewirkt hat (R00057)
    pub wirkungen: Vec<Wirkung>,
    pub phasen: Phasenangaben,
    #[serde(rename = "reporting")]
    pub zaehlung: Berichtszaehlung,
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
            wirkungen: vec![],
            phasen: Phasenangaben::default(),
            zaehlung: Berichtszaehlung::default(),
            weitere: vec![],
        }
    }

    /// Der Ordner der Anhänge: Dateiname ohne `.md`.
    pub fn anhangordner(&self) -> &str {
        self.datei.strip_suffix(".md").unwrap_or(&self.datei)
    }
}

/// Was eine Änderung setzt; `None` heißt „unverändert“, `Some(None)` bei entfernbaren Feldern „entfernen“.
#[derive(Debug, Clone, Default, Deserialize)]
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
}

/// `{"burndown": false, "forecast": null}` — ein Wert setzt, `null` entfernt den Schlüssel (der Standard gilt wieder), fehlt er, bleibt er.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct Zaehlungsaenderung {
    #[serde(default, deserialize_with = "entfernbar")]
    pub burndown: Option<Option<bool>>,
    #[serde(default, deserialize_with = "entfernbar")]
    pub forecast: Option<Option<bool>>,
}

/// `{"uebersprungen": [...]}` (auch `skipped` wie in der Datei) ersetzt die entfallenden Phasen.
#[derive(Debug, Clone, Default, Deserialize)]
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

fn entfernbar<'de, D: serde::Deserializer<'de>, T: Deserialize<'de>>(d: D) -> Result<Option<Option<T>>, D::Error> {
    Ok(Some(Option::deserialize(d)?))
}

impl Aufgabe {
    /// Wendet die Änderung an und liefert die Namen der Felder, die sich wirklich geändert haben.
    pub fn aendern(&mut self, a: &Aufgabenaenderung, e: &Einstellungen) -> Result<Vec<&'static str>, String> {
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
}
