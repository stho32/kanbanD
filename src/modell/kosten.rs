//! Preisetikett einer Aufgabe (R00105, ADR-0009): geschätzte API-Kosten in ganzen Cent.
//! Ein Konstruktor prüft alle Inhaltsregeln — Datei und API rufen denselben.

use serde_yaml::{Mapping, Value};

/// Höchster Geldwert in Cent (1.000.000,00) — technischer Schutzwert für exakte `f64`- und JavaScript-Rechnung.
pub const HOECHSTWERT_CENT: u64 = 100_000_000;
pub const HOECHSTZAHL_POSITIONEN: usize = 100;

/// Abschnitt `cost` einer Aufgabe; Gesamtwerte aus Positionen werden nie gespeichert.
#[derive(Debug, Clone, PartialEq)]
pub struct Kosten {
    /// `currency`: genau drei Großbuchstaben A–Z, nicht normalisiert
    pub waehrung: String,
    pub basis: Option<String>,
    pub wert: Gesamt,
    /// Schlüssel in `cost`, die kanbanD nicht kennt — bleiben beim Schreiben der Datei erhalten.
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Gesamt {
    Betrag(u64),
    Spanne { min: u64, max: u64 },
    Positionen(Vec<Position>),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Position {
    pub text: String,
    pub wert: Wert,
    pub tokens: Option<u64>,
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Wert {
    Betrag(u64),
    Spanne { min: u64, max: u64 },
}

/// Für `GET` (ADR-0009 Entscheidung 5): die Schlüssel der Datei, Geldwerte als JSON-Zahl in Dollar, ohne unbekannte
/// Schlüssel und ohne abgeleitete Werte (keine Summe, keine Mitte).
impl serde::Serialize for Kosten {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut m = s.serialize_map(None)?;
        m.serialize_entry("currency", &self.waehrung)?;
        match &self.wert {
            Gesamt::Betrag(c) => wert_eintragen(&mut m, Wert::Betrag(*c))?,
            Gesamt::Spanne { min, max } => wert_eintragen(
                &mut m,
                Wert::Spanne {
                    min: *min,
                    max: *max,
                },
            )?,
            Gesamt::Positionen(_) => {}
        }
        if let Some(b) = &self.basis {
            m.serialize_entry("basis", b)?;
        }
        if let Gesamt::Positionen(p) = &self.wert {
            m.serialize_entry("items", p)?;
        }
        m.end()
    }
}

/// Zurück aus der Form von `GET` nur über den prüfenden Konstruktor — eine ungültige Angabe ist nie ein `Kosten`.
impl<'de> serde::Deserialize<'de> for Kosten {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Kosten, D::Error> {
        let v = serde_json::Value::deserialize(d)?;
        Kosten::aus_anfrage(&v).map_err(serde::de::Error::custom)
    }
}

impl serde::Serialize for Position {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut m = s.serialize_map(None)?;
        m.serialize_entry("text", &self.text)?;
        wert_eintragen(&mut m, self.wert)?;
        if let Some(t) = self.tokens {
            m.serialize_entry("tokens", &t)?;
        }
        m.end()
    }
}

fn wert_eintragen<M: serde::ser::SerializeMap>(m: &mut M, w: Wert) -> Result<(), M::Error> {
    match w {
        Wert::Betrag(c) => m.serialize_entry("amount", &dollar(c)),
        Wert::Spanne { min, max } => {
            m.serialize_entry("min", &dollar(min))?;
            m.serialize_entry("max", &dollar(max))
        }
    }
}

/// Cent → Dollar als nächstgelegene `f64`; die Division ist korrekt gerundet, also dieselbe Zahl, die der Text `1.10` ergibt.
pub(super) fn dollar(cent: u64) -> f64 {
    cent as f64 / 100.0
}

/// Von Hand, weil `Kosten` keine Felder in der Form der API hat (ADR-0009 Entscheidung 5: eigenes Schema).
impl utoipa::PartialSchema for Kosten {
    fn schema() -> utoipa::openapi::RefOr<utoipa::openapi::schema::Schema> {
        use utoipa::openapi::schema::{ArrayBuilder, ObjectBuilder, Type};
        let positionen = ArrayBuilder::new()
            .items(utoipa::openapi::Ref::from_schema_name("Kostenposition"))
            .min_items(Some(1))
            .max_items(Some(HOECHSTZAHL_POSITIONEN));
        ObjectBuilder::new()
            .description(Some(
                "Preisetikett: geschätzte API-Kosten. Genau eines von amount, min + max oder items. Geldwerte in Einheiten der Währung, 0 bis 1000000.00, höchstens zwei Nachkommastellen; \
                 ein unbekannter Schlüssel → 400. Ein Wert ersetzt den ganzen Abschnitt, null entfernt ihn.",
            ))
            .property("currency", ObjectBuilder::new().schema_type(Type::String).pattern(Some("^[A-Z]{3}$")).description(Some("ISO-Code, genau drei Großbuchstaben, z. B. USD")))
            .required("currency")
            .property("amount", geld("fester Betrag"))
            .property("min", geld("Untergrenze der Spanne, zusammen mit max"))
            .property("max", geld("Obergrenze der Spanne, ≥ min"))
            .property("basis", ObjectBuilder::new().schema_type(Type::String).min_length(Some(1)).description(Some("woher die Schätzung stammt, nicht leer")))
            .property("items", positionen.description(Some("Positionen; dann weder amount noch min/max — die Summe rechnet die Oberfläche")))
            .into()
    }
}

impl utoipa::ToSchema for Kosten {
    fn schemas(
        schemas: &mut Vec<(
            String,
            utoipa::openapi::RefOr<utoipa::openapi::schema::Schema>,
        )>,
    ) {
        schemas.push(("Kostenposition".into(), Position::schema()));
    }
}

impl Position {
    fn schema() -> utoipa::openapi::RefOr<utoipa::openapi::schema::Schema> {
        use utoipa::openapi::schema::{ObjectBuilder, Type};
        ObjectBuilder::new()
            .description(Some("Position eines Preisetiketts: amount oder min + max"))
            .property(
                "text",
                ObjectBuilder::new()
                    .schema_type(Type::String)
                    .min_length(Some(1)),
            )
            .required("text")
            .property("amount", geld("fester Betrag"))
            .property("min", geld("Untergrenze"))
            .property("max", geld("Obergrenze"))
            .property(
                "tokens",
                ObjectBuilder::new()
                    .schema_type(Type::Integer)
                    .minimum(Some(0.0))
                    .description(Some("geschätzte Tokens, ganze Zahl")),
            )
            .into()
    }
}

fn geld(beschreibung: &str) -> utoipa::openapi::schema::ObjectBuilder {
    use utoipa::openapi::schema::{ObjectBuilder, Type};
    ObjectBuilder::new()
        .schema_type(Type::Number)
        .minimum(Some(0.0))
        .maximum(Some(1_000_000.0))
        .multiple_of(Some(0.01))
        .description(Some(beschreibung))
}

/// Die Werte, wie sie in Datei oder Anfrage stehen — Geldwerte schon in Cent, sonst ungeprüft.
#[derive(Debug, Clone, Default)]
pub struct Rohkosten {
    pub waehrung: Option<String>,
    pub basis: Option<String>,
    pub betrag: Option<u64>,
    pub min: Option<u64>,
    pub max: Option<u64>,
    pub positionen: Option<Vec<Rohposition>>,
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

#[derive(Debug, Clone, Default)]
pub struct Rohposition {
    pub text: Option<String>,
    pub betrag: Option<u64>,
    pub min: Option<u64>,
    pub max: Option<u64>,
    pub tokens: Option<u64>,
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

impl Kosten {
    /// Abschnitt `cost` aus YAML (Datei oder umgewandeltes JSON): erst die Form, dann [`Kosten::pruefen`].
    /// `cost` aus dem Rumpf einer Anfrage (roh, damit jeder Fehler 400 wird und nie 422): unbekannte Schlüssel
    /// sind hier ein Fehler, sonst gilt derselbe Leser wie für die Datei (ADR-0009 Entscheidung 4).
    pub fn aus_anfrage(v: &serde_json::Value) -> Result<Kosten, String> {
        if let Some(m) = v.as_object() {
            nur_bekannte("cost", m, &KOSTEN_BEKANNT)?;
            let positionen = m
                .get("items")
                .and_then(serde_json::Value::as_array)
                .into_iter()
                .flatten();
            for (i, p) in positionen
                .enumerate()
                .filter_map(|(i, p)| p.as_object().map(|p| (i, p)))
            {
                nur_bekannte(&format!("cost.items[{i}]"), p, &POSITION_BEKANNT)?;
            }
        }
        let yaml = serde_yaml::to_value(v).map_err(|_| "cost: keine Zuordnung".to_string())?;
        Kosten::lesen(&yaml)
    }

    pub fn lesen(v: &Value) -> Result<Kosten, String> {
        let m = v.as_mapping().ok_or("cost: keine Zuordnung")?;
        let feld = Felder { m, pfad: "cost" };
        let positionen = match feld.wert("items") {
            None => None,
            Some(Value::Sequence(s)) => Some(
                s.iter()
                    .enumerate()
                    .map(|(i, p)| position_lesen(i, p))
                    .collect::<Result<_, _>>()?,
            ),
            Some(_) => return Err("cost.items: keine Liste".into()),
        };
        Kosten::pruefen(Rohkosten {
            waehrung: feld.text("currency")?,
            basis: feld.text("basis")?,
            betrag: feld.geld("amount")?,
            min: feld.geld("min")?,
            max: feld.geld("max")?,
            positionen,
            weitere: feld.weitere(&KOSTEN_BEKANNT),
        })
    }

    /// Alle Inhaltsregeln von ADR-0009 an einer Stelle; der Fehler nennt den Pfad (`cost.items[1]: min > max`).
    pub fn pruefen(roh: Rohkosten) -> Result<Kosten, String> {
        let waehrung = roh.waehrung.ok_or("cost: currency fehlt")?;
        if !(waehrung.len() == 3 && waehrung.bytes().all(|b| b.is_ascii_uppercase())) {
            return Err("cost.currency: genau drei Großbuchstaben A–Z".into());
        }
        if let Some(b) = &roh.basis {
            nicht_leer(b, "cost.basis")?;
        }
        let wert = match roh.positionen {
            Some(_) if roh.betrag.is_some() || roh.min.is_some() || roh.max.is_some() => {
                return Err("cost: items zusammen mit amount, min oder max".into())
            }
            Some(p) => Gesamt::Positionen(positionen_pruefen(p)?),
            None => match wert_pruefen(
                "cost",
                "amount, min + max oder items",
                roh.betrag,
                roh.min,
                roh.max,
            )? {
                Wert::Betrag(c) => Gesamt::Betrag(c),
                Wert::Spanne { min, max } => Gesamt::Spanne { min, max },
            },
        };
        Ok(Kosten {
            waehrung,
            basis: roh.basis,
            wert,
            weitere: roh.weitere,
        })
    }
}

const KOSTEN_BEKANNT: [&str; 6] = ["currency", "amount", "min", "max", "basis", "items"];
const POSITION_BEKANNT: [&str; 5] = ["text", "amount", "min", "max", "tokens"];

fn nur_bekannte(
    pfad: &str,
    m: &serde_json::Map<String, serde_json::Value>,
    bekannt: &[&str],
) -> Result<(), String> {
    match m.keys().find(|k| !bekannt.contains(&k.as_str())) {
        Some(k) => Err(format!("{pfad}: unbekannter Schlüssel „{k}“")),
        None => Ok(()),
    }
}

fn position_lesen(i: usize, v: &Value) -> Result<Rohposition, String> {
    let pfad = format!("cost.items[{i}]");
    let m = v
        .as_mapping()
        .ok_or_else(|| format!("{pfad}: keine Zuordnung"))?;
    let feld = Felder { m, pfad: &pfad };
    Ok(Rohposition {
        text: feld.text("text")?,
        betrag: feld.geld("amount")?,
        min: feld.geld("min")?,
        max: feld.geld("max")?,
        tokens: feld.tokens()?,
        weitere: feld.weitere(&POSITION_BEKANNT),
    })
}

/// Die Schlüssel einer Zuordnung in `cost` oder `cost-entries` mit dem Pfad für die Meldung; `null` gilt als fehlend.
pub(super) struct Felder<'a> {
    pub(super) m: &'a Mapping,
    pub(super) pfad: &'a str,
}

impl Felder<'_> {
    fn wert(&self, k: &str) -> Option<&Value> {
        self.m.get(k).filter(|v| !v.is_null())
    }

    pub(super) fn text(&self, k: &str) -> Result<Option<String>, String> {
        match self.wert(k) {
            None => Ok(None),
            Some(Value::String(s)) => Ok(Some(s.clone())),
            Some(_) => Err(format!("{}.{k}: kein Text", self.pfad)),
        }
    }

    pub(super) fn geld(&self, k: &str) -> Result<Option<u64>, String> {
        match self.wert(k) {
            None => Ok(None),
            Some(Value::Number(n)) => {
                cent_aus_zahltext(&n.to_string()).map(Some).ok_or_else(|| {
                    format!(
                        "{}.{k}: Zahl ≥ 0 mit höchstens zwei Nachkommastellen erwartet",
                        self.pfad
                    )
                })
            }
            Some(_) => Err(format!("{}.{k}: keine Zahl", self.pfad)),
        }
    }

    pub(super) fn tokens(&self) -> Result<Option<u64>, String> {
        match self.wert("tokens") {
            None => Ok(None),
            Some(v) => v
                .as_u64()
                .map(Some)
                .ok_or_else(|| format!("{}.tokens: ganze Zahl ≥ 0 erwartet", self.pfad)),
        }
    }

    pub(super) fn weitere(&self, bekannt: &[&str]) -> Vec<(String, Value)> {
        self.m
            .iter()
            .filter_map(|(k, w)| {
                k.as_str()
                    .filter(|k| !bekannt.contains(k))
                    .map(|k| (k.to_string(), w.clone()))
            })
            .collect()
    }
}

/// Kürzester Zahltext streng als `Ziffern[.Ziffern]` mit höchstens zwei Nachkommastellen → Cent (ADR-0009 Entscheidung 2).
/// Zu große Werte werden gesättigt, damit der Konstruktor sie mit „höchstens 1000000.00“ abweist.
fn cent_aus_zahltext(t: &str) -> Option<u64> {
    if t.contains(['e', 'E']) {
        // so schreibt der kürzeste Zahltext nur sehr große oder sehr kleine Zahlen — beide sind keine gültigen Geldwerte
        return t
            .parse::<f64>()
            .ok()
            .filter(|z| *z > 1_000_000.0)
            .map(|_| u64::MAX);
    }
    let (ganz, bruch) = t.split_once('.').unwrap_or((t, ""));
    let ziffern = |s: &str| s.bytes().all(|b| b.is_ascii_digit());
    if ganz.is_empty() || !ziffern(ganz) || !ziffern(bruch) || bruch.len() > 2 {
        return None;
    }
    let ganz = ganz.parse::<u64>().unwrap_or(u64::MAX);
    let bruch = format!("{bruch:0<2}").parse::<u64>().unwrap_or(0);
    Some(ganz.saturating_mul(100).saturating_add(bruch))
}

fn positionen_pruefen(roh: Vec<Rohposition>) -> Result<Vec<Position>, String> {
    if roh.is_empty() {
        return Err("cost.items: mindestens eine Position".into());
    }
    if roh.len() > HOECHSTZAHL_POSITIONEN {
        return Err(format!(
            "cost.items: höchstens {HOECHSTZAHL_POSITIONEN} Positionen"
        ));
    }
    roh.into_iter()
        .enumerate()
        .map(|(i, p)| position_pruefen(&format!("cost.items[{i}]"), p))
        .collect()
}

fn position_pruefen(pfad: &str, roh: Rohposition) -> Result<Position, String> {
    let text = roh.text.ok_or_else(|| format!("{pfad}: text fehlt"))?;
    nicht_leer(&text, &format!("{pfad}.text"))?;
    let wert = wert_pruefen(pfad, "amount oder min + max", roh.betrag, roh.min, roh.max)?;
    Ok(Position {
        text,
        wert,
        tokens: roh.tokens,
        weitere: roh.weitere,
    })
}

/// Genau ein Betrag oder eine Spanne, jeder Wert höchstens [`HOECHSTWERT_CENT`], min ≤ max.
fn wert_pruefen(
    pfad: &str,
    fehlt: &str,
    betrag: Option<u64>,
    min: Option<u64>,
    max: Option<u64>,
) -> Result<Wert, String> {
    match (betrag, min, max) {
        (Some(_), Some(_), _) | (Some(_), _, Some(_)) => {
            Err(format!("{pfad}: amount zusammen mit min/max"))
        }
        (Some(c), None, None) => Ok(Wert::Betrag(hoechstens(c, pfad, "amount")?)),
        (None, None, None) => Err(format!("{pfad}: {fehlt} fehlt")),
        (None, Some(_), None) => Err(format!("{pfad}: max fehlt")),
        (None, None, Some(_)) => Err(format!("{pfad}: min fehlt")),
        (None, Some(min), Some(max)) => {
            let (min, max) = (hoechstens(min, pfad, "min")?, hoechstens(max, pfad, "max")?);
            if min > max {
                Err(format!("{pfad}: min > max"))
            } else {
                Ok(Wert::Spanne { min, max })
            }
        }
    }
}

pub(super) fn hoechstens(cent: u64, pfad: &str, schluessel: &str) -> Result<u64, String> {
    if cent > HOECHSTWERT_CENT {
        Err(format!("{pfad}.{schluessel}: höchstens 1000000.00"))
    } else {
        Ok(cent)
    }
}

fn nicht_leer(text: &str, pfad: &str) -> Result<(), String> {
    if text.trim().is_empty() {
        Err(format!("{pfad}: leer"))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spanne(min: u64, max: u64) -> Rohkosten {
        Rohkosten {
            waehrung: Some("USD".into()),
            min: Some(min),
            max: Some(max),
            ..Default::default()
        }
    }

    fn betrag(cent: u64) -> Rohkosten {
        Rohkosten {
            waehrung: Some("USD".into()),
            betrag: Some(cent),
            ..Default::default()
        }
    }

    fn position(text: &str, min: u64, max: u64) -> Rohposition {
        Rohposition {
            text: Some(text.into()),
            min: Some(min),
            max: Some(max),
            ..Default::default()
        }
    }

    fn positionen(p: Vec<Rohposition>) -> Rohkosten {
        Rohkosten {
            waehrung: Some("USD".into()),
            positionen: Some(p),
            ..Default::default()
        }
    }

    fn fehler(roh: Rohkosten) -> String {
        Kosten::pruefen(roh).expect_err("Fehler erwartet")
    }

    #[test]
    fn spanne_mit_basis_wird_gebaut() {
        let k = Kosten::pruefen(Rohkosten {
            basis: Some("Schätzung planer".into()),
            ..spanne(60, 160)
        })
        .unwrap();
        assert_eq!(k.waehrung, "USD");
        assert_eq!(k.basis.as_deref(), Some("Schätzung planer"));
        assert_eq!(k.wert, Gesamt::Spanne { min: 60, max: 160 });
    }

    #[test]
    fn betrag_ohne_basis_wird_gebaut_auch_null() {
        assert_eq!(
            Kosten::pruefen(betrag(163)).unwrap().wert,
            Gesamt::Betrag(163)
        );
        assert_eq!(Kosten::pruefen(betrag(0)).unwrap().wert, Gesamt::Betrag(0));
        assert_eq!(Kosten::pruefen(betrag(163)).unwrap().basis, None);
    }

    #[test]
    fn positionen_werden_in_ihrer_reihenfolge_gebaut() {
        let k = Kosten::pruefen(positionen(vec![
            Rohposition {
                tokens: Some(12000),
                ..position("Planung", 10, 20)
            },
            Rohposition {
                text: Some("Gemeinkostenanteil".into()),
                betrag: Some(30),
                ..Default::default()
            },
        ]))
        .unwrap();
        let Gesamt::Positionen(p) = k.wert else {
            panic!("Positionen erwartet")
        };
        assert_eq!(p[0].text, "Planung");
        assert_eq!(p[0].wert, Wert::Spanne { min: 10, max: 20 });
        assert_eq!(p[0].tokens, Some(12000));
        assert_eq!(p[1].wert, Wert::Betrag(30));
        assert_eq!(p[1].tokens, None);
    }

    #[test]
    fn waehrung_genau_drei_grossbuchstaben_nicht_normalisiert() {
        assert_eq!(
            Kosten::pruefen(Rohkosten {
                waehrung: Some("CHF".into()),
                ..betrag(200)
            })
            .unwrap()
            .waehrung,
            "CHF"
        );
        assert_eq!(
            fehler(Rohkosten {
                waehrung: None,
                ..betrag(1)
            }),
            "cost: currency fehlt"
        );
        for w in [
            "usd", "Usd", "US", "USDX", "", "   ", "U$D", "ÄÖÜ", " USD", "US1",
        ] {
            assert_eq!(
                fehler(Rohkosten {
                    waehrung: Some(w.into()),
                    ..betrag(1)
                }),
                "cost.currency: genau drei Großbuchstaben A–Z",
                "{w:?}"
            );
        }
    }

    #[test]
    fn basis_und_text_nach_dem_trimmen_nicht_leer_sonst_unveraendert() {
        for leer in ["", "   ", "\t\n"] {
            assert_eq!(
                fehler(Rohkosten {
                    basis: Some(leer.into()),
                    ..betrag(1)
                }),
                "cost.basis: leer",
                "{leer:?}"
            );
            assert_eq!(
                fehler(positionen(vec![position("a", 1, 2), position(leer, 1, 2)])),
                "cost.items[1].text: leer",
                "{leer:?}"
            );
        }
        assert_eq!(
            Kosten::pruefen(Rohkosten {
                basis: Some(" x ".into()),
                ..betrag(1)
            })
            .unwrap()
            .basis
            .as_deref(),
            Some(" x ")
        );
        assert_eq!(
            fehler(positionen(vec![Rohposition {
                text: None,
                betrag: Some(1),
                ..Default::default()
            }])),
            "cost.items[0]: text fehlt"
        );
    }

    #[test]
    fn min_hoechstens_max() {
        assert_eq!(
            Kosten::pruefen(spanne(160, 160)).unwrap().wert,
            Gesamt::Spanne { min: 160, max: 160 }
        );
        assert_eq!(fehler(spanne(161, 160)), "cost: min > max");
        assert_eq!(
            fehler(positionen(vec![position("a", 1, 2), position("b", 3, 2)])),
            "cost.items[1]: min > max"
        );
    }

    #[test]
    fn genau_eine_gesamtangabe() {
        assert_eq!(
            fehler(Rohkosten {
                betrag: Some(1),
                ..spanne(1, 2)
            }),
            "cost: amount zusammen mit min/max"
        );
        assert_eq!(
            fehler(Rohkosten {
                betrag: Some(1),
                max: None,
                ..spanne(1, 2)
            }),
            "cost: amount zusammen mit min/max"
        );
        assert_eq!(
            fehler(Rohkosten {
                positionen: Some(vec![position("a", 1, 2)]),
                ..betrag(1)
            }),
            "cost: items zusammen mit amount, min oder max"
        );
        assert_eq!(
            fehler(Rohkosten {
                positionen: Some(vec![position("a", 1, 2)]),
                ..spanne(1, 2)
            }),
            "cost: items zusammen mit amount, min oder max"
        );
        assert_eq!(
            fehler(Rohkosten {
                waehrung: Some("USD".into()),
                ..Default::default()
            }),
            "cost: amount, min + max oder items fehlt"
        );
        assert_eq!(
            fehler(Rohkosten {
                max: None,
                ..spanne(1, 2)
            }),
            "cost: max fehlt"
        );
        assert_eq!(
            fehler(Rohkosten {
                min: None,
                ..spanne(1, 2)
            }),
            "cost: min fehlt"
        );
        let p = Rohposition {
            betrag: Some(1),
            ..position("a", 1, 2)
        };
        assert_eq!(
            fehler(positionen(vec![p])),
            "cost.items[0]: amount zusammen mit min/max"
        );
        let p = Rohposition {
            text: Some("a".into()),
            ..Default::default()
        };
        assert_eq!(
            fehler(positionen(vec![p])),
            "cost.items[0]: amount oder min + max fehlt"
        );
        let p = Rohposition {
            max: None,
            ..position("a", 1, 2)
        };
        assert_eq!(fehler(positionen(vec![p])), "cost.items[0]: max fehlt");
    }

    #[test]
    fn eine_bis_hundert_positionen() {
        assert_eq!(
            fehler(positionen(vec![])),
            "cost.items: mindestens eine Position"
        );
        let hundert = (0..100)
            .map(|i| position(&format!("p{i}"), 1, 2))
            .collect::<Vec<_>>();
        assert!(Kosten::pruefen(positionen(hundert.clone())).is_ok());
        let mut hunderteins = hundert;
        hunderteins.push(position("zu viel", 1, 2));
        assert_eq!(
            fehler(positionen(hunderteins)),
            "cost.items: höchstens 100 Positionen"
        );
    }

    #[test]
    fn je_wert_hoechstens_eine_million_die_summe_darf_darueber() {
        assert!(Kosten::pruefen(betrag(HOECHSTWERT_CENT)).is_ok());
        assert_eq!(
            fehler(betrag(HOECHSTWERT_CENT + 1)),
            "cost.amount: höchstens 1000000.00"
        );
        assert_eq!(
            fehler(spanne(1, HOECHSTWERT_CENT + 1)),
            "cost.max: höchstens 1000000.00"
        );
        assert_eq!(
            fehler(spanne(HOECHSTWERT_CENT + 1, HOECHSTWERT_CENT + 1)),
            "cost.min: höchstens 1000000.00"
        );
        let p = |t: &str| Rohposition {
            text: Some(t.into()),
            betrag: Some(60_000_000),
            ..Default::default()
        };
        assert!(Kosten::pruefen(positionen(vec![p("a"), p("b")])).is_ok());
        let ps = vec![
            position("a", 1, 2),
            position("b", 1, 2),
            position("c", 1, 2),
            position("d", 1, HOECHSTWERT_CENT + 1),
        ];
        assert_eq!(
            fehler(positionen(ps)),
            "cost.items[3].max: höchstens 1000000.00"
        );
        let p = Rohposition {
            text: Some("a".into()),
            betrag: Some(HOECHSTWERT_CENT + 1),
            ..Default::default()
        };
        assert_eq!(
            fehler(positionen(vec![p])),
            "cost.items[0].amount: höchstens 1000000.00"
        );
    }

    #[test]
    fn unbekannte_schluessel_bleiben_im_wert() {
        let note = vec![("note".to_string(), serde_yaml::Value::String("x".into()))];
        let k = Kosten::pruefen(Rohkosten {
            weitere: note.clone(),
            ..betrag(100)
        })
        .unwrap();
        assert_eq!(k.weitere, note);
        let p = Rohposition {
            weitere: note.clone(),
            ..position("a", 1, 2)
        };
        let Gesamt::Positionen(p) = Kosten::pruefen(positionen(vec![p])).unwrap().wert else {
            panic!()
        };
        assert_eq!(p[0].weitere, note);
    }

    fn yaml(text: &str) -> serde_yaml::Value {
        serde_yaml::from_str(text).unwrap()
    }

    fn gelesen(text: &str) -> Result<Kosten, String> {
        Kosten::lesen(&yaml(text))
    }

    fn betrag_aus(zahl: &str) -> Result<Kosten, String> {
        gelesen(&format!("currency: USD\namount: {zahl}\n"))
    }

    #[test]
    fn lesen_baut_spanne_mit_basis() {
        let k = gelesen("currency: USD\nmin: 0.60\nmax: 1.60\nbasis: Schätzung planer\n").unwrap();
        assert_eq!(
            (k.waehrung.as_str(), k.basis.as_deref(), &k.wert),
            (
                "USD",
                Some("Schätzung planer"),
                &Gesamt::Spanne { min: 60, max: 160 }
            )
        );
    }

    #[test]
    fn geldwerte_streng_als_zahl_mit_hoechstens_zwei_nachkommastellen() {
        for (zahl, cent) in [
            ("0", 0),
            ("0.0", 0),
            ("0.6", 60),
            ("0.60", 60),
            ("1.63", 163),
            ("17", 1700),
            ("0x11", 1700),
            ("1e2", 10000),
            ("0.01", 1),
            ("999999.99", 99_999_999),
            ("1000000.00", 100_000_000),
        ] {
            assert_eq!(
                betrag_aus(zahl).map(|k| k.wert),
                Ok(Gesamt::Betrag(cent)),
                "{zahl}"
            );
        }
        for zahl in ["1000000.01", "1000001", "1e20", "18446744073709551615"] {
            assert_eq!(
                betrag_aus(zahl).unwrap_err(),
                "cost.amount: höchstens 1000000.00",
                "{zahl}"
            );
        }
        for zahl in ["1.005", "-1", "-0.01", ".inf", "-.inf", ".nan", "0.001"] {
            assert_eq!(
                betrag_aus(zahl).unwrap_err(),
                "cost.amount: Zahl ≥ 0 mit höchstens zwei Nachkommastellen erwartet",
                "{zahl}"
            );
        }
        for zahl in ["\"1.63\"", "1,63", "true", "[1]", "{a: 1}", "zwei"] {
            assert_eq!(
                betrag_aus(zahl).unwrap_err(),
                "cost.amount: keine Zahl",
                "{zahl}"
            );
        }
        assert_eq!(
            gelesen("{currency: USD, min: \"1\", max: 2}").unwrap_err(),
            "cost.min: keine Zahl"
        );
        assert_eq!(
            gelesen("{currency: USD, items: [{text: a, min: 1, max: 1.001}]}").unwrap_err(),
            "cost.items[0].max: Zahl ≥ 0 mit höchstens zwei Nachkommastellen erwartet"
        );
    }

    #[test]
    fn form_der_texte_listen_und_zuordnungen() {
        assert_eq!(gelesen("[USD]").unwrap_err(), "cost: keine Zuordnung");
        assert_eq!(gelesen("USD").unwrap_err(), "cost: keine Zuordnung");
        assert_eq!(
            gelesen("{currency: 123, amount: 1}").unwrap_err(),
            "cost.currency: kein Text"
        );
        assert_eq!(
            gelesen("{currency: USD, amount: 1, basis: [a]}").unwrap_err(),
            "cost.basis: kein Text"
        );
        assert_eq!(
            gelesen("{currency: USD, items: {text: a}}").unwrap_err(),
            "cost.items: keine Liste"
        );
        assert_eq!(
            gelesen("{currency: USD, items: [a]}").unwrap_err(),
            "cost.items[0]: keine Zuordnung"
        );
        assert_eq!(
            gelesen("{currency: USD, items: [{text: 5, amount: 1}]}").unwrap_err(),
            "cost.items[0].text: kein Text"
        );
        for t in ["1.5", "-1", "\"12\"", "true"] {
            assert_eq!(
                gelesen(&format!(
                    "{{currency: USD, items: [{{text: a, amount: 1, tokens: {t}}}]}}"
                ))
                .unwrap_err(),
                "cost.items[0].tokens: ganze Zahl ≥ 0 erwartet",
                "{t}"
            );
        }
        let Gesamt::Positionen(p) =
            gelesen("{currency: USD, items: [{text: a, amount: 1, tokens: 0}]}")
                .unwrap()
                .wert
        else {
            panic!()
        };
        assert_eq!(p[0].tokens, Some(0));
    }

    #[test]
    fn inhaltsregeln_kommen_aus_dem_konstruktor() {
        assert_eq!(
            gelesen("{amount: 1.63}").unwrap_err(),
            "cost: currency fehlt"
        );
        assert_eq!(
            gelesen("{currency: usd, amount: 1.63}").unwrap_err(),
            "cost.currency: genau drei Großbuchstaben A–Z"
        );
        assert_eq!(
            gelesen("{currency: USD, items: [{text: a, amount: 1}, {text: b, min: 2, max: 1}]}")
                .unwrap_err(),
            "cost.items[1]: min > max"
        );
        assert_eq!(
            gelesen("{currency: USD, items: []}").unwrap_err(),
            "cost.items: mindestens eine Position"
        );
        assert_eq!(
            gelesen("{currency: USD, amount: 1, min: 1, max: 2}").unwrap_err(),
            "cost: amount zusammen mit min/max"
        );
    }

    #[test]
    fn null_gilt_als_fehlend_unbekannte_schluessel_bleiben_in_reihenfolge() {
        assert_eq!(
            gelesen("{currency: USD, amount: 1, basis: null}")
                .unwrap()
                .basis,
            None
        );
        assert_eq!(
            gelesen("{currency: null, amount: 1}").unwrap_err(),
            "cost: currency fehlt"
        );
        let k = gelesen("{currency: USD, note: x, amount: 1.00, a: {b: 1}}").unwrap();
        assert_eq!(
            k.weitere,
            vec![
                ("note".to_string(), yaml("x")),
                ("a".to_string(), yaml("{b: 1}"))
            ]
        );
        let Gesamt::Positionen(p) =
            gelesen("{currency: USD, items: [{text: a, amount: 1, quelle: log}]}")
                .unwrap()
                .wert
        else {
            panic!()
        };
        assert_eq!(p[0].weitere, vec![("quelle".to_string(), yaml("log"))]);
    }

    fn angefragt(json: &str) -> Result<Kosten, String> {
        Kosten::aus_anfrage(&serde_json::from_str(json).unwrap())
    }

    fn abgewiesen(json: &str) -> String {
        angefragt(json).expect_err(json)
    }

    #[test]
    fn anfrage_baut_kosten_wie_die_datei() {
        let k = angefragt(r#"{"currency":"USD","min":0.6,"max":1.6,"basis":"Schätzung planer"}"#)
            .unwrap();
        assert_eq!(
            (k.waehrung.as_str(), k.basis.as_deref(), &k.wert),
            (
                "USD",
                Some("Schätzung planer"),
                &Gesamt::Spanne { min: 60, max: 160 }
            )
        );
        assert_eq!(
            angefragt(r#"{"currency":"USD","amount":0}"#).unwrap().wert,
            Gesamt::Betrag(0)
        );
        assert_eq!(
            angefragt(r#"{"currency":"USD","amount":1.1}"#)
                .unwrap()
                .wert,
            Gesamt::Betrag(110)
        );
        assert_eq!(
            angefragt(r#"{"currency":"USD","amount":1000000.00}"#)
                .unwrap()
                .wert,
            Gesamt::Betrag(HOECHSTWERT_CENT)
        );
        assert!(angefragt(r#"{"currency":"USD","items":[{"text":"a","amount":600000.00},{"text":"b","amount":600000.00}]}"#).is_ok());
        let hundert = (0..100)
            .map(|i| format!(r#"{{"text":"p{i}","min":0.01,"max":0.02,"tokens":{i}}}"#))
            .collect::<Vec<_>>();
        assert!(angefragt(&format!(
            r#"{{"currency":"USD","items":[{}]}}"#,
            hundert.join(",")
        ))
        .is_ok());
        let hunderteins = format!(
            r#"{{"currency":"USD","items":[{},{{"text":"x","amount":1}}]}}"#,
            hundert.join(",")
        );
        assert_eq!(
            abgewiesen(&hunderteins),
            "cost.items: höchstens 100 Positionen"
        );
    }

    #[test]
    fn jeder_fehlfall_ist_eine_meldung_mit_pfad() {
        for (json, meldung) in [
            (r#"{"amount":1.63}"#, "cost: currency fehlt"),
            (
                r#"{"currency":"usd","amount":1.63}"#,
                "cost.currency: genau drei Großbuchstaben A–Z",
            ),
            (
                r#"{"currency":"USD","amount":"1.63"}"#,
                "cost.amount: keine Zahl",
            ),
            (
                r#"{"currency":"USD","amount":true}"#,
                "cost.amount: keine Zahl",
            ),
            (
                r#"{"currency":"USD","amount":[1]}"#,
                "cost.amount: keine Zahl",
            ),
            (
                r#"{"currency":"USD","amount":1.005}"#,
                "cost.amount: Zahl ≥ 0 mit höchstens zwei Nachkommastellen erwartet",
            ),
            (
                r#"{"currency":"USD","amount":-1}"#,
                "cost.amount: Zahl ≥ 0 mit höchstens zwei Nachkommastellen erwartet",
            ),
            (
                r#"{"currency":"USD","amount":1000000.01}"#,
                "cost.amount: höchstens 1000000.00",
            ),
            (
                r#"{"currency":"USD","amount":1e30}"#,
                "cost.amount: höchstens 1000000.00",
            ),
            (
                r#"{"currency":"USD","amount":1.63,"min":1,"max":2}"#,
                "cost: amount zusammen mit min/max",
            ),
            (
                r#"{"currency":"USD","amount":1.63,"items":[{"text":"a","amount":1}]}"#,
                "cost: items zusammen mit amount, min oder max",
            ),
            (r#"{"currency":"USD","min":2,"max":1}"#, "cost: min > max"),
            (
                r#"{"currency":"USD","items":[{"text":"a","amount":1},{"text":"b","min":2,"max":1}]}"#,
                "cost.items[1]: min > max",
            ),
            (
                r#"{"currency":"USD","items":[]}"#,
                "cost.items: mindestens eine Position",
            ),
            (
                r#"{"currency":"USD","items":[{"text":"   ","amount":1}]}"#,
                "cost.items[0].text: leer",
            ),
            (
                r#"{"currency":"USD","basis":"","amount":1}"#,
                "cost.basis: leer",
            ),
            (
                r#"{"currency":"USD","basis":3,"amount":1}"#,
                "cost.basis: kein Text",
            ),
            (
                r#"{"currency":"USD","items":[{"text":"a","amount":1,"tokens":-5}]}"#,
                "cost.items[0].tokens: ganze Zahl ≥ 0 erwartet",
            ),
            (
                r#"{"currency":"USD","ammount":1.63}"#,
                "cost: unbekannter Schlüssel „ammount“",
            ),
            (
                r#"{"currency":"USD","items":[{"text":"a","amount":1},{"text":"b","preis":1}]}"#,
                "cost.items[1]: unbekannter Schlüssel „preis“",
            ),
            (r#""USD""#, "cost: keine Zuordnung"),
            (r#"[{"currency":"USD"}]"#, "cost: keine Zuordnung"),
            (r#"1.63"#, "cost: keine Zuordnung"),
        ] {
            assert_eq!(abgewiesen(json), meldung, "{json}");
        }
    }

    #[test]
    fn json_form_im_rundlauf_ohne_unbekannte_schluessel() {
        let datei: Value = serde_yaml::from_str("currency: USD\nbasis: b\nnote: x\nitems:\n  - {text: a, min: 0.10, max: 0.20, tokens: 12000, z: 1}\n  - {text: c, amount: 1000000.00}\n").unwrap();
        let k = Kosten::lesen(&datei).unwrap();
        let json = serde_json::to_value(&k).unwrap();
        assert_eq!(
            json,
            serde_json::json!({"currency": "USD", "basis": "b", "items": [{"text": "a", "min": 0.1, "max": 0.2, "tokens": 12000}, {"text": "c", "amount": 1000000.0}]})
        );
        let zurueck: Kosten = serde_json::from_value(json.clone()).unwrap();
        assert_eq!(
            serde_json::to_value(&zurueck).unwrap(),
            json,
            "GET → Kosten → GET gleich"
        );
        for c in [0u64, 1, 7, 10, 110, 163, 2555, 99_999_999, HOECHSTWERT_CENT] {
            let k = Kosten::pruefen(Rohkosten {
                waehrung: Some("USD".into()),
                betrag: Some(c),
                ..Default::default()
            })
            .unwrap();
            let zurueck: Kosten =
                serde_json::from_str(&serde_json::to_string(&k).unwrap()).unwrap();
            assert_eq!(zurueck.wert, Gesamt::Betrag(c), "{c} Cent");
        }
        assert!(
            serde_json::from_str::<Kosten>(r#"{"currency":"usd","amount":1}"#).is_err(),
            "nur über den Konstruktor"
        );
    }
}
