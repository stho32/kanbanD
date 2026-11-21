//! Transkript eines Agentenlaufs an der Aufgabe (R00216, ADR-0036 Regel 3): ein kleiner Eintrag unter `transcripts`
//! mit Zeitpunkt, Rolle, Spalte und Größe der gz-Datei. Die Datei selbst liegt unversioniert unter `transkripte/<nr>/`;
//! ihr Name entsteht nur aus der Kennung `role@at` (wie bei Kosteneinträgen) — ein Eintrag trägt nie einen Pfad.
//! Ein formwidriger Eintrag macht die Aufgabe nicht defekt: er bleibt wörtlich stehen und gilt als `unlesbar`.

use super::kosten::Felder;
use super::kosteneintrag::{kennung, rolle_pruefen};
use serde_yaml::Value;

/// Schutzwert (ADR-0036 Regel 3): mehr Einträge nimmt eine Aufgabe über die API nicht auf.
pub const HOECHSTZAHL_TRANSKRIPTE: usize = 1000;
/// Größte gz-Datei in Byte (ADR-0036 Regel 5, PO Z. 375): 10 MiB.
pub const TRANSKRIPT_HOECHSTENS: u64 = 10 * 1024 * 1024;
const BEKANNT: [&str; 4] = ["at", "role", "column", "bytes"];

/// Eine lesbare Zeile unter `transcripts`. In der API trägt sie zusätzlich ihre `kennung`.
#[derive(Debug, Clone, PartialEq)]
pub struct Transkripteintrag {
    /// `at`: Zeitpunkt in Dateiform (R00084)
    pub zeitpunkt: String,
    /// `role`: Rolle nach ADR-0028 Punkt 2 — freier Text, **kein** Dateiname
    pub rolle: String,
    /// `column`: Name der Spalte beim Ablegen
    pub spalte: String,
    /// `bytes`: Größe der gz-Datei
    pub bytes: u64,
    /// Schlüssel des Eintrags, die kanbanD nicht kennt — bleiben beim Schreiben der Datei erhalten.
    pub weitere: Vec<(String, Value)>,
}

/// Eine Zeile unter `transcripts`, wie sie in der Datei steht: lesbar oder wörtlich erhalten.
#[derive(Debug, Clone, PartialEq)]
pub enum Transkriptzeile {
    Lesbar(Transkripteintrag),
    Unlesbar(Value),
}

impl Transkriptzeile {
    /// Liest eine Zeile der Datei; was nicht den Regeln folgt, bleibt wörtlich als `Unlesbar`.
    pub fn lesen(v: &Value) -> Transkriptzeile {
        match Transkripteintrag::lesen(v) {
            Ok(e) => Transkriptzeile::Lesbar(e),
            Err(_) => Transkriptzeile::Unlesbar(v.clone()),
        }
    }

    pub fn lesbar(&self) -> Option<&Transkripteintrag> {
        match self {
            Transkriptzeile::Lesbar(e) => Some(e),
            Transkriptzeile::Unlesbar(_) => None,
        }
    }
}

impl Transkripteintrag {
    /// Ein Eintrag aus der Datei: eine Zuordnung mit `at`, `role`, `column` (Texte) und `bytes` (ganze Zahl ≥ 0).
    fn lesen(v: &Value) -> Result<Transkripteintrag, String> {
        const PFAD: &str = "transcripts[]";
        let m = v.as_mapping().ok_or_else(|| format!("{PFAD}: keine Zuordnung"))?;
        let feld = Felder { m, pfad: PFAD };
        let bytes = m.get("bytes").and_then(Value::as_u64).ok_or_else(|| format!("{PFAD}.bytes: ganze Zahl ≥ 0 erwartet"))?;
        let mut e = Transkripteintrag::neu(PFAD, feld.text("at")?.as_deref(), feld.text("role")?.as_deref(), feld.text("column")?.as_deref(), bytes)?;
        e.weitere = feld.weitere(&BEKANNT);
        Ok(e)
    }

    /// Die Inhaltsregeln an einer Stelle (ADR-0036 Regel 3 mit ADR-0028 Punkt 2): Datei und API rufen denselben
    /// Konstruktor; der Fehler nennt Pfad und Feld (`transkript.role: …`).
    pub fn neu(pfad: &str, at: Option<&str>, rolle: Option<&str>, spalte: Option<&str>, bytes: u64) -> Result<Transkripteintrag, String> {
        let fehlt = |feld: &str| format!("{pfad}: {feld} fehlt");
        let zeitpunkt = crate::uhr::Zeitpunkt::lesen(at.ok_or_else(|| fehlt("at"))?).ok_or_else(|| format!("{pfad}.at: Zeitpunkt JJJJ-MM-TT HH:MM±HH:MM erwartet"))?.datei();
        let rolle = rolle_pruefen(pfad, rolle.ok_or_else(|| fehlt("role"))?)?;
        let spalte = spalte.ok_or_else(|| fehlt("column"))?;
        if spalte.trim().is_empty() {
            return Err(format!("{pfad}.column: leer"));
        }
        Ok(Transkripteintrag { zeitpunkt, rolle, spalte: spalte.to_string(), bytes, weitere: vec![] })
    }

    /// Kennung `role@JJJJ-MM-TTTHH:MM±HH:MM` — dieselbe Rechnung wie beim Kosteneintrag desselben Laufs.
    pub fn kennung(&self) -> String {
        kennung(&self.rolle, &self.zeitpunkt)
    }
}

/// Für `GET`: `{kennung, at, role, column, bytes}` — ohne unbekannte Schlüssel.
impl serde::Serialize for Transkripteintrag {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut m = s.serialize_map(Some(5))?;
        m.serialize_entry("kennung", &self.kennung())?;
        m.serialize_entry("at", &self.zeitpunkt)?;
        m.serialize_entry("role", &self.rolle)?;
        m.serialize_entry("column", &self.spalte)?;
        m.serialize_entry("bytes", &self.bytes)?;
        m.end()
    }
}

impl utoipa::PartialSchema for Transkripteintrag {
    fn schema() -> utoipa::openapi::RefOr<utoipa::openapi::schema::Schema> {
        use utoipa::openapi::schema::{ObjectBuilder, Type};
        let text = |beschreibung: &str| ObjectBuilder::new().schema_type(Type::String).description(Some(beschreibung.to_string()));
        ObjectBuilder::new()
            .description(Some("Transkript eines Agentenlaufs (Schlüssel transcripts der Aufgabendatei); die gz-Datei liegt unversioniert im Ordner"))
            .property("kennung", text("role@JJJJ-MM-TTTHH:MM±HH:MM — berechnet aus Rolle und Zeitpunkt, wie beim Kosteneintrag"))
            .property("at", text("Zeitpunkt JJJJ-MM-TT HH:MM±HH:MM"))
            .property("role", text("Rolle, freier einzeiliger Text mit 1 bis 60 Zeichen ohne @"))
            .property("column", text("Name der Spalte beim Ablegen"))
            .property("bytes", ObjectBuilder::new().schema_type(Type::Integer).minimum(Some(0.0)).description(Some("Größe der gz-Datei in Byte")))
            .required("kennung")
            .required("at")
            .required("role")
            .required("column")
            .required("bytes")
            .into()
    }
}

impl utoipa::ToSchema for Transkripteintrag {}

#[cfg(test)]
mod tests {
    use super::*;

    fn zeile(text: &str) -> Transkriptzeile {
        Transkriptzeile::lesen(&serde_yaml::from_str(text).unwrap())
    }

    #[test]
    fn lesbarer_eintrag_mit_kennung_und_unbekanntem_schluessel() {
        let Transkriptzeile::Lesbar(e) = zeile("{at: 2026-11-13 10:34+01:00, role: Code Reviewer, column: Entwicklung, bytes: 281234, model: opus}") else { panic!("lesbar") };
        assert_eq!((e.zeitpunkt.as_str(), e.rolle.as_str(), e.spalte.as_str(), e.bytes), ("2026-11-13 10:34+01:00", "Code Reviewer", "Entwicklung", 281234));
        assert_eq!(e.kennung(), "Code Reviewer@2026-11-13T10:34+01:00");
        assert_eq!(e.weitere, vec![("model".to_string(), Value::String("opus".into()))]);
    }

    #[test]
    fn formwidrige_eintraege_bleiben_woertlich() {
        for text in ["{at: gestern, role: x}", "{at: 2026-11-13 10:34+01:00, role: a@b, column: E, bytes: 1}", "{at: 2026-11-13 10:34+01:00, role: x, column: E, bytes: -1}", "{at: 2026-11-13 10:34+01:00, role: x, column: '', bytes: 1}", "{at: 2026-11-13 10:34+01:00, role: x, column: E}", "kaputt", "[1, 2]"] {
            let v: Value = serde_yaml::from_str(text).unwrap();
            assert_eq!(Transkriptzeile::lesen(&v), Transkriptzeile::Unlesbar(v.clone()), "{text}");
        }
    }

    #[test]
    fn api_form_ohne_unbekannte_schluessel() {
        let Transkriptzeile::Lesbar(e) = zeile("{at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, bytes: 5, model: opus}") else { panic!() };
        assert_eq!(serde_json::to_value(&e).unwrap(), serde_json::json!({"kennung": "entwickler@2026-11-13T10:34+01:00", "at": "2026-11-13 10:34+01:00", "role": "entwickler", "column": "Entwicklung", "bytes": 5}));
    }
}
