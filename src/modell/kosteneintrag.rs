//! Kosteneintrag einer Aufgabe (R00165, ADR-0028): angefallene Kosten eines Rollenlaufs mit Zeitpunkt, Rolle und Spalte.
//! Ein Konstruktor prüft die Inhaltsregeln — Datei und API rufen denselben. Ob es die Spalte gibt und ob der
//! Zeitpunkt in der Zukunft liegt, prüft nur das Schreiben über die Route: ein gelesener Eintrag ist eine Tatsache.

use super::kosten::{Felder, dollar, hoechstens};
use serde_yaml::Value;

pub const ROLLE_HOECHSTENS_ZEICHEN: usize = 60;
const BEKANNT: [&str; 6] = ["at", "role", "column", "amount", "currency", "tokens"];

/// Eine Zeile unter `cost-entries`. In der API trägt sie zusätzlich ihre `kennung`.
#[derive(Debug, Clone, PartialEq)]
pub struct Kosteneintrag {
    /// `at`: Zeitpunkt in Dateiform (R00084)
    pub zeitpunkt: String,
    /// `role`: freier einzeiliger Text, getrimmt 1–60 Zeichen, ohne `@`
    pub rolle: String,
    /// `column`: Name der Spalte, wie er beim Eintragen hieß
    pub spalte: String,
    /// `amount` in ganzen Cent
    pub cent: u64,
    /// `currency`: genau drei Großbuchstaben A–Z
    pub waehrung: String,
    pub tokens: Option<u64>,
    /// Schlüssel des Eintrags, die kanbanD nicht kennt — bleiben beim Schreiben der Datei erhalten.
    pub weitere: Vec<(String, Value)>,
}

/// Die Werte, wie sie in Datei oder Anfrage stehen — der Betrag schon in Cent, sonst ungeprüft.
#[derive(Debug, Clone, Default)]
pub struct Roheintrag {
    pub zeitpunkt: Option<String>,
    pub rolle: Option<String>,
    pub spalte: Option<String>,
    pub cent: Option<u64>,
    pub waehrung: Option<String>,
    pub tokens: Option<u64>,
    pub weitere: Vec<(String, Value)>,
}

impl Roheintrag {
    /// Die Form: eine Zuordnung, jedes Feld in seinem Typ — noch ohne Inhaltsregeln; `null` gilt als fehlend.
    fn lesen(pfad: &str, v: &Value) -> Result<Roheintrag, String> {
        let m = v.as_mapping().ok_or_else(|| format!("{pfad}: keine Zuordnung"))?;
        let feld = Felder { m, pfad };
        Ok(Roheintrag {
            zeitpunkt: feld.text("at")?,
            rolle: feld.text("role")?,
            spalte: feld.text("column")?,
            cent: feld.geld("amount")?,
            waehrung: feld.text("currency")?,
            tokens: feld.tokens()?,
            weitere: feld.weitere(&BEKANNT),
        })
    }

    /// Rumpf einer Anfrage (roh, damit jeder Fehler 400 wird und nie 422): ein Objekt nur mit den Schlüsseln der
    /// Datei, sonst dieselbe Form. Was fehlt, bleibt `None` — `POST` verlangt es über [`Kosteneintrag::pruefen`],
    /// `PATCH` nimmt dafür den Wert des bestehenden Eintrags.
    pub fn aus_anfrage(pfad: &str, v: &serde_json::Value) -> Result<Roheintrag, String> {
        let keine_zuordnung = || format!("{pfad}: keine Zuordnung");
        let m = v.as_object().ok_or_else(keine_zuordnung)?;
        if let Some(k) = m.keys().find(|k| !BEKANNT.contains(&k.as_str())) {
            return Err(format!("{pfad}: unbekannter Schlüssel „{k}“"));
        }
        Roheintrag::lesen(pfad, &serde_yaml::to_value(v).map_err(|_| keine_zuordnung())?)
    }
}

impl Kosteneintrag {
    /// Ein Eintrag aus YAML (Datei oder umgewandeltes JSON): erst die Form, dann [`Kosteneintrag::pruefen`].
    /// `pfad` steht in jeder Meldung vorn, z. B. `cost-entries[0]`.
    pub fn lesen(pfad: &str, v: &Value) -> Result<Kosteneintrag, String> {
        Kosteneintrag::pruefen(pfad, Roheintrag::lesen(pfad, v)?)
    }

    /// Alle Inhaltsregeln von ADR-0028 Punkt 2 an einer Stelle; der Fehler nennt Pfad und Feld (`cost-entries[0].role: …`).
    pub fn pruefen(pfad: &str, roh: Roheintrag) -> Result<Kosteneintrag, String> {
        let fehlt = |feld: &str| format!("{pfad}: {feld} fehlt");
        let zeitpunkt = roh.zeitpunkt.ok_or_else(|| fehlt("at"))?;
        let zeitpunkt = crate::uhr::Zeitpunkt::lesen(&zeitpunkt).ok_or_else(|| format!("{pfad}.at: Zeitpunkt JJJJ-MM-TT HH:MM±HH:MM erwartet"))?.datei();
        let rolle = roh.rolle.ok_or_else(|| fehlt("role"))?.trim().to_string();
        let zeichen = rolle.chars().count();
        if zeichen == 0 || zeichen > ROLLE_HOECHSTENS_ZEICHEN || rolle.contains('@') || rolle.chars().any(char::is_control) {
            return Err(format!("{pfad}.role: einzeiliger Text mit 1 bis {ROLLE_HOECHSTENS_ZEICHEN} Zeichen ohne @ erwartet"));
        }
        let spalte = roh.spalte.ok_or_else(|| fehlt("column"))?;
        if spalte.trim().is_empty() {
            return Err(format!("{pfad}.column: leer"));
        }
        let cent = hoechstens(roh.cent.ok_or_else(|| fehlt("amount"))?, pfad, "amount")?;
        let waehrung = roh.waehrung.ok_or_else(|| fehlt("currency"))?;
        if !(waehrung.len() == 3 && waehrung.bytes().all(|b| b.is_ascii_uppercase())) {
            return Err(format!("{pfad}.currency: genau drei Großbuchstaben A–Z"));
        }
        Ok(Kosteneintrag { zeitpunkt, rolle, spalte, cent, waehrung, tokens: roh.tokens, weitere: roh.weitere })
    }

    /// Kennung `role@JJJJ-MM-TTTHH:MM±HH:MM` (ADR-0028 Punkt 4), gerechnet wie bei Zeiteinträgen: ein Zeitpunkt ohne
    /// Versatz bekommt den seiner Ortszeit-Deutung.
    pub fn kennung(&self) -> String {
        let zeitpunkt = crate::uhr::Zeitpunkt::lesen(&self.zeitpunkt).map(|z| z.iso()).unwrap_or_else(|| self.zeitpunkt.clone());
        format!("{}@{zeitpunkt}", self.rolle)
    }
}

/// Für `GET`: die Schlüssel der Datei, der Betrag als JSON-Zahl in Dollar, dazu die berechnete `kennung`;
/// ohne unbekannte Schlüssel.
impl serde::Serialize for Kosteneintrag {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut m = s.serialize_map(None)?;
        m.serialize_entry("at", &self.zeitpunkt)?;
        m.serialize_entry("role", &self.rolle)?;
        m.serialize_entry("column", &self.spalte)?;
        m.serialize_entry("amount", &dollar(self.cent))?;
        m.serialize_entry("currency", &self.waehrung)?;
        if let Some(t) = self.tokens {
            m.serialize_entry("tokens", &t)?;
        }
        m.serialize_entry("kennung", &self.kennung())?;
        m.end()
    }
}

/// Zurück aus der Form von `GET` nur über den prüfenden Konstruktor; die berechnete `kennung` wird nicht gelesen.
impl<'de> serde::Deserialize<'de> for Kosteneintrag {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Kosteneintrag, D::Error> {
        let mut v = Value::deserialize(d)?;
        if let Some(m) = v.as_mapping_mut() {
            m.remove("kennung");
        }
        Kosteneintrag::lesen("kosteneintraege[]", &v).map_err(serde::de::Error::custom)
    }
}

/// Von Hand, weil die API das berechnete Feld `kennung` mitliefert und die Schlüssel der Datei trägt.
impl utoipa::PartialSchema for Kosteneintrag {
    fn schema() -> utoipa::openapi::RefOr<utoipa::openapi::schema::Schema> {
        use utoipa::openapi::schema::{ObjectBuilder, Type};
        let text = |beschreibung: &str| ObjectBuilder::new().schema_type(Type::String).description(Some(beschreibung.to_string()));
        ObjectBuilder::new()
            .description(Some("Kosteneintrag: angefallene Kosten eines Rollenlaufs (Schlüssel cost-entries der Aufgabendatei)"))
            .property("at", text("Zeitpunkt JJJJ-MM-TT HH:MM±HH:MM"))
            .property("role", text("Rolle, freier einzeiliger Text mit 1 bis 60 Zeichen ohne @"))
            .property("column", text("Name der Spalte, wie er beim Eintragen hieß — bleibt, auch wenn die Spalte umbenannt oder entfernt wird"))
            .property("amount", ObjectBuilder::new().schema_type(Type::Number).minimum(Some(0.0)).maximum(Some(1_000_000.0)).multiple_of(Some(0.01)).description(Some("Betrag in Einheiten der Währung")))
            .property("currency", ObjectBuilder::new().schema_type(Type::String).pattern(Some("^[A-Z]{3}$")).description(Some("ISO-Code, genau drei Großbuchstaben, z. B. USD")))
            .property("tokens", ObjectBuilder::new().schema_type(Type::Integer).minimum(Some(0.0)).description(Some("verbrauchte Tokens, ganze Zahl")))
            .property("kennung", text("role@JJJJ-MM-TTTHH:MM±HH:MM — berechnet aus Rolle und Zeitpunkt"))
            .required("at")
            .required("role")
            .required("column")
            .required("amount")
            .required("currency")
            .required("kennung")
            .into()
    }
}

impl utoipa::ToSchema for Kosteneintrag {}

#[cfg(test)]
mod tests {
    use super::*;

    const PFAD: &str = "cost-entries[0]";

    fn gelesen(yaml: &str) -> Result<Kosteneintrag, String> {
        Kosteneintrag::lesen(PFAD, &serde_yaml::from_str(yaml).unwrap())
    }

    fn fehler(yaml: &str) -> String {
        gelesen(yaml).expect_err("ungültig")
    }

    /// Der Eintrag des Beispiels aus R00165 mit einer ersetzten oder ergänzten Angabe.
    fn beispiel_mit(angabe: &str) -> String {
        let schluessel = angabe.split(':').next().unwrap();
        let rest: Vec<&str> = ["at: 2026-11-13 10:34+01:00", "role: entwickler", "column: Entwicklung", "amount: 3.46", "currency: USD"].into_iter().filter(|a| !a.starts_with(&format!("{schluessel}:"))).collect();
        format!("{{{}, {angabe}}}", rest.join(", "))
    }

    fn beispiel_ohne(schluessel: &str) -> String {
        beispiel_mit(&format!("{schluessel}: null"))
    }

    #[test]
    fn eintrag_des_beispiels_wird_gebaut() {
        let e = gelesen(&beispiel_mit("tokens: 81234")).unwrap();
        assert_eq!(
            e,
            Kosteneintrag { zeitpunkt: "2026-11-13 10:34+01:00".into(), rolle: "entwickler".into(), spalte: "Entwicklung".into(), cent: 346, waehrung: "USD".into(), tokens: Some(81234), weitere: vec![] }
        );
        assert_eq!(gelesen(&beispiel_ohne("tokens")).unwrap().tokens, None, "tokens ist freiwillig");
        assert_eq!(gelesen(&beispiel_mit("amount: 0")).unwrap().cent, 0, "null ist ein Betrag");
    }

    #[test]
    fn kennung_aus_rolle_und_zeitpunkt() {
        assert_eq!(gelesen(&beispiel_mit("tokens: 1")).unwrap().kennung(), "entwickler@2026-11-13T10:34+01:00");
        let anders = gelesen(&beispiel_mit("at: 2026-11-13T09:34:59Z")).unwrap();
        assert_eq!((anders.zeitpunkt.as_str(), anders.kennung().as_str()), ("2026-11-13 09:34+00:00", "entwickler@2026-11-13T09:34+00:00"));
    }

    #[test]
    fn jedes_pflichtfeld_fehlt_mit_seinem_namen() {
        for feld in ["at", "role", "column", "amount", "currency"] {
            assert_eq!(fehler(&beispiel_ohne(feld)), format!("{PFAD}: {feld} fehlt"));
        }
        assert_eq!(fehler("[1, 2]"), format!("{PFAD}: keine Zuordnung"));
    }

    #[test]
    fn falsche_werte_nennen_das_feld() {
        for (angabe, feld) in [
            ("at: gestern", "at"),
            ("at: 2026-11-13", "at"),
            ("at: 12", "at"),
            ("role: \"  \"", "role"),
            ("role: a@b", "role"),
            ("role: \"a\\nb\"", "role"),
            ("role: 7", "role"),
            ("column: \" \"", "column"),
            ("column: [a]", "column"),
            ("amount: abc", "amount"),
            ("amount: -1", "amount"),
            ("amount: 3.456", "amount"),
            ("amount: 1000000.01", "amount"),
            ("currency: usd", "currency"),
            ("currency: USDX", "currency"),
            ("tokens: -1", "tokens"),
            ("tokens: 1.5", "tokens"),
        ] {
            let f = fehler(&beispiel_mit(angabe));
            assert!(f.starts_with(&format!("{PFAD}.{feld}: ")), "{angabe} → {f}");
        }
    }

    #[test]
    fn rolle_getrimmt_ein_bis_sechzig_zeichen() {
        assert_eq!(gelesen(&beispiel_mit("role: \"  code reviewer \"")).unwrap().rolle, "code reviewer");
        let sechzig = "ä".repeat(ROLLE_HOECHSTENS_ZEICHEN);
        assert_eq!(gelesen(&beispiel_mit(&format!("role: {sechzig}"))).unwrap().rolle, sechzig);
        assert!(fehler(&beispiel_mit(&format!("role: {sechzig}ä"))).starts_with(&format!("{PFAD}.role: ")));
    }

    #[test]
    fn spalte_wird_nicht_gegen_ein_board_geprueft_und_unbekanntes_bleibt() {
        let e = gelesen(&beispiel_mit("column: Gibtsnichtmehr, note: x")).unwrap();
        assert_eq!((e.spalte.as_str(), e.weitere), ("Gibtsnichtmehr", vec![("note".to_string(), Value::String("x".into()))]));
    }

    // R00165 Teil B: der Rumpf einer Anfrage — nur bekannte Schlüssel, jeder Typfehler nennt sein Feld, Fehlendes bleibt offen
    #[test]
    fn rumpf_einer_anfrage_nur_mit_bekannten_schluesseln_und_richtigen_typen() {
        let roh = Roheintrag::aus_anfrage("kosteneintrag", &serde_json::json!({"amount": 3.5, "tokens": null})).unwrap();
        assert_eq!((roh.cent, roh.tokens, roh.zeitpunkt, roh.rolle, roh.spalte, roh.waehrung), (Some(350), None, None, None, None, None));
        for (rumpf, meldung) in [
            (serde_json::json!({"amount": 1, "kennung": "a@b"}), "kosteneintrag: unbekannter Schlüssel „kennung“"),
            (serde_json::json!([1]), "kosteneintrag: keine Zuordnung"),
            (serde_json::json!("x"), "kosteneintrag: keine Zuordnung"),
            (serde_json::json!({"amount": "3.46"}), "kosteneintrag.amount: keine Zahl"),
            (serde_json::json!({"amount": -1}), "kosteneintrag.amount: Zahl ≥ 0 mit höchstens zwei Nachkommastellen erwartet"),
            (serde_json::json!({"amount": 3.456}), "kosteneintrag.amount: Zahl ≥ 0 mit höchstens zwei Nachkommastellen erwartet"),
            (serde_json::json!({"role": 7}), "kosteneintrag.role: kein Text"),
            (serde_json::json!({"column": ["a"]}), "kosteneintrag.column: kein Text"),
            (serde_json::json!({"at": 12}), "kosteneintrag.at: kein Text"),
            (serde_json::json!({"tokens": 1.5}), "kosteneintrag.tokens: ganze Zahl ≥ 0 erwartet"),
        ] {
            assert_eq!(Roheintrag::aus_anfrage("kosteneintrag", &rumpf).err().as_deref(), Some(meldung), "{rumpf}");
        }
    }

    #[test]
    fn api_form_mit_kennung_ohne_unbekanntes() {
        let e = gelesen(&beispiel_mit("note: x")).unwrap();
        assert_eq!(
            serde_json::to_value(&e).unwrap(),
            serde_json::json!({"at": "2026-11-13 10:34+01:00", "role": "entwickler", "column": "Entwicklung", "amount": 3.46, "currency": "USD", "kennung": "entwickler@2026-11-13T10:34+01:00"})
        );
        let zurueck: Kosteneintrag = serde_json::from_value(serde_json::to_value(&e).unwrap()).unwrap();
        assert_eq!(zurueck, Kosteneintrag { weitere: vec![], ..e });
    }
}
