//! Transkript eines Agentenlaufs an der Aufgabe (R00216, ADR-0036 Regel 3): ein kleiner Eintrag unter `transcripts`
//! mit Zeitpunkt, Rolle, Spalte und Größe der gz-Datei. Die Datei selbst liegt unversioniert unter `transkripte/<nr>/`;
//! ihr Name entsteht nur aus der Kennung `role@at` (wie bei Kosteneinträgen) — ein Eintrag trägt nie einen Pfad.
//! Ein formwidriger Eintrag macht die Aufgabe nicht defekt: er bleibt wörtlich stehen und gilt als `unlesbar`.

use super::kosten::Felder;
use super::kosteneintrag::{kennung, rolle_pruefen};
use serde_yaml::Value;

/// Ordner der Transkripte im Board-Ordner (ADR-0036 Regel 1) — hier, wo die Dienste und der Wächter ihn lesen,
/// ohne voneinander abzuhängen (A00004 → A00008).
pub const TRANSKRIPTE_ORDNER: &str = "transkripte";
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

    /// Der Dateiname aus der Kennung (ADR-0036 Regel 2): `<rolle>@JJJJ-MM-TTTHHMM±HHMM.jsonl.gz` — die Rolle
    /// kleingeschrieben, jede Folge von Zeichen außerhalb `[a-z0-9]` ein `-`, `-` am Rand entfällt, leer → `lauf`.
    /// Ein Pfad entsteht daraus nur in `dienst::transkripte` (Regel 7).
    pub fn dateiname(&self) -> String {
        let zeit = crate::uhr::Zeitpunkt::lesen(&self.zeitpunkt).map(|z| z.moment().format("%Y-%m-%dT%H%M%z").to_string()).unwrap_or_default();
        format!("{}@{zeit}.jsonl.gz", rolle_falten(&self.rolle))
    }
}

/// `Code Reviewer` → `code-reviewer`, `../../x` → `x`, `..` → `lauf`.
fn rolle_falten(rolle: &str) -> String {
    let mut s = String::new();
    for c in rolle.to_lowercase().chars() {
        if c.is_ascii_lowercase() || c.is_ascii_digit() {
            s.push(c);
        } else if !s.ends_with('-') {
            s.push('-');
        }
    }
    let s = s.trim_matches('-');
    if s.is_empty() { "lauf".to_string() } else { s.to_string() }
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

/// Zustand eines Transkripts in der Liste (ADR-0036 Regel 5) — aus einem `symlink_metadata` und drei Byte, ohne Entpacken.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Transkriptzustand {
    /// reguläre Datei, Größe gleich `bytes`, beginnt mit `1f 8b 08`
    Vorhanden,
    /// liegt nicht auf diesem Rechner
    Fehlt,
    /// Größe ungleich `bytes`
    Abweichend,
    /// Eintrag formwidrig, keine reguläre Datei, Symlink, über 10 MB oder Kennbytes falsch
    Unlesbar,
}

/// Die Kennbytes einer gzip-Datei mit Deflate (RFC 1952): `1f 8b 08`.
pub const GZIP_KENNBYTES: [u8; 3] = [0x1f, 0x8b, 0x08];

/// Ob für eine Aufgabe Transkripte abgelegt werden dürfen (ADR-0036 Regel 4) und welche Boards „aus“ sind.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, utoipa::ToSchema)]
pub struct Erfassung {
    pub erfassen: bool,
    /// Slugs der Boards der Aufgabe, die wirksam „aus“ sind, in der Reihenfolge der Boardliste
    pub boards_aus: Vec<String>,
}

/// Der wirksame Schalter für die Aufgabe `nr`: „an“ nur, wenn **alle** Boards, auf denen sie liegt (auch archivierte),
/// wirksam „an“ sind — je Board der eigene Wert, sonst die Vorgabe des Ordners, sonst „aus“; liegt sie auf keinem Board,
/// gilt die Vorgabe (R00216 AK 3).
pub fn erfassung(nr: u32, boards: &[super::Board], vorgabe: Option<bool>) -> Erfassung {
    let ihre: Vec<&super::Board> = boards.iter().filter(|b| b.spalte_von(nr).is_some()).collect();
    if ihre.is_empty() {
        return Erfassung { erfassen: vorgabe.unwrap_or(false), boards_aus: vec![] };
    }
    let boards_aus: Vec<String> = ihre.iter().filter(|b| !b.transkripte_erfassen.or(vorgabe).unwrap_or(false)).map(|b| b.slug.clone()).collect();
    Erfassung { erfassen: boards_aus.is_empty(), boards_aus }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// fabrik (#1, #2) und zweit (#2) mit eigenem Schalter; `zweit_archiviert` archiviert zweit.
    fn boards(fabrik: Option<bool>, zweit: Option<bool>, zweit_archiviert: bool) -> Vec<super::super::Board> {
        let lesen = |slug, text| crate::format::board::lesen(slug, text).unwrap();
        let mut f = lesen("fabrik", "# Fabrik\n\n## Eingang\n\n- #2\n- #3\n\n## Entwicklung\n\n- #1\n\n## Fertig\n");
        let mut z = lesen("zweit", "# Zweit\n\n## Eingang\n\n- #2\n\n## Fertig\n");
        f.transkripte_erfassen = fabrik;
        z.transkripte_erfassen = zweit;
        z.archiviert = zweit_archiviert.then(|| "2026-11-20".to_string());
        vec![f, z]
    }

    fn aus(slugs: &[&str]) -> Erfassung {
        Erfassung { erfassen: false, boards_aus: slugs.iter().map(|s| s.to_string()).collect() }
    }

    const AN: Erfassung = Erfassung { erfassen: true, boards_aus: vec![] };

    fn eintrag(at: &str, rolle: &str) -> Transkripteintrag {
        Transkripteintrag::neu("t", Some(at), Some(rolle), Some("E"), 1).unwrap()
    }

    // R00216 AK 9a, FA 2: die Faltung nach der Tabelle, dazu Versatz in beide Richtungen und die längste Rolle
    #[test]
    fn dateiname_aus_der_kennung() {
        for (rolle, name) in [("entwickler", "entwickler"), ("../../x", "x"), ("a/b", "a-b"), ("..", "lauf"), ("C:\\x", "c-x"), ("Code Reviewer", "code-reviewer"), ("  ÄÖü--x__y ", "x-y"), ("ß", "lauf"), ("-a-", "a"), ("A1 B2", "a1-b2")] {
            assert_eq!(eintrag("2026-11-13 10:34+01:00", rolle).dateiname(), format!("{name}@2026-11-13T1034+0100.jsonl.gz"), "{rolle:?}");
        }
        assert_eq!(eintrag("2026-11-13 10:34-05:30", "x").dateiname(), "x@2026-11-13T1034-0530.jsonl.gz");
        assert_eq!(eintrag("2026-11-13 10:34Z", "x").dateiname(), "x@2026-11-13T1034+0000.jsonl.gz");
        let lang = "a".repeat(60);
        assert_eq!(eintrag("2026-11-13 10:34+01:00", &lang).dateiname(), format!("{lang}@2026-11-13T1034+0100.jsonl.gz"));
        assert_eq!(eintrag("2026-11-13 10:34+01:00", "Code Reviewer").dateiname(), eintrag("2026-11-13 10:34+01:00", "code-reviewer").dateiname(), "gleich gefaltet (AK 8)");
    }

    // R00216 AK 3: die Tabelle Zeile für Zeile
    #[test]
    fn wirksamer_schalter_nach_der_tabelle() {
        assert_eq!(erfassung(1, &boards(None, None, false), None), aus(&["fabrik"]), "ohne beides aus");
        assert_eq!(erfassung(1, &boards(None, None, false), Some(true)), AN, "Vorgabe an");
        assert_eq!(erfassung(1, &boards(Some(false), None, false), Some(true)), aus(&["fabrik"]), "Board aus schlägt Vorgabe an");
        assert_eq!(erfassung(1, &boards(Some(true), None, false), Some(false)), AN, "Board an schlägt Vorgabe aus");
        assert_eq!(erfassung(2, &boards(None, Some(false), false), Some(true)), aus(&["zweit"]), "eines von zweien aus");
        assert_eq!(erfassung(2, &boards(None, Some(false), true), Some(true)), aus(&["zweit"]), "auch ein archiviertes Board zählt");
        assert_eq!(erfassung(2, &boards(Some(true), Some(true), false), Some(true)), AN, "alle an");
        assert_eq!(erfassung(9, &boards(None, None, false), Some(false)), aus(&[]), "auf keinem Board: Vorgabe aus");
        assert_eq!(erfassung(9, &boards(None, None, false), Some(true)), AN, "auf keinem Board: Vorgabe an");
        assert_eq!(erfassung(9, &boards(None, None, false), None), aus(&[]), "auf keinem Board, keine Vorgabe: aus");
        assert_eq!(erfassung(2, &boards(Some(false), Some(false), false), None), aus(&["fabrik", "zweit"]), "alle aus, in Reihenfolge der Boardliste");
    }

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
