//! Der JSON-Rumpf einer Anfrage — die eine Stelle, an der ein Formfehler abgewiesen wird (ADR-0003 N1/N3).

use crate::fehler::Fehler;
use axum::body::Bytes;
use axum::extract::{FromRequest, Request};
use axum::response::{IntoResponse, Response};
use serde::de::{DeserializeOwned, IgnoredAny};
use serde_json::Value;
use serde_json::error::Category;
use serde_path_to_error::{Path, Segment};

/// Der Rumpf als `T`, gelesen aus JSON. Jeder Handler mit JSON-Rumpf nimmt ihn so — nie als `axum::Json<T>`,
/// dessen Abweisung als englischer Klartext mit 422 am Antwortweg von `Fehler` vorbeigeht.
pub struct JsonKoerper<T>(pub T);

/// Warum der Extraktor einen Rumpf abweist — ein Typ der Web-Schicht, kein Dienst kann ihn erzeugen.
#[derive(Debug)]
pub enum Abweisung {
    /// Kein JSON oder JSON in falscher Form: 400 wie jede ungültige Eingabe.
    Inhalt(Fehler),
}

impl IntoResponse for Abweisung {
    fn into_response(self) -> Response {
        match self {
            Abweisung::Inhalt(fehler) => fehler.into_response(),
        }
    }
}

impl<T: DeserializeOwned, S: Send + Sync> FromRequest<S> for JsonKoerper<T> {
    type Rejection = Abweisung;

    async fn from_request(anfrage: Request, zustand: &S) -> Result<Self, Abweisung> {
        let rumpf = Bytes::from_request(anfrage, zustand).await.map_err(|_| Abweisung::Inhalt(Fehler::Ungueltig("Der Rumpf konnte nicht gelesen werden".to_string())))?;
        lesen(&rumpf).map(JsonKoerper).map_err(Abweisung::Inhalt)
    }
}

/// Liest den Rumpf als `T`; ein Formfehler wird `Fehler::Ungueltig` mit Feldpfad und deutscher Meldung.
fn lesen<T: DeserializeOwned>(rumpf: &[u8]) -> Result<T, Fehler> {
    let mut leser = serde_json::Deserializer::from_slice(rumpf);
    let wert = serde_path_to_error::deserialize(&mut leser).map_err(|e| match e.inner().classify() {
        Category::Data => Fehler::Ungueltig(formfehler(rumpf, e.path(), &e.inner().to_string())),
        // Eine Aufzählung, die statt Text eine Zahl bekommt, meldet der Rahmen als Syntaxfehler — der Rumpf ist aber JSON
        _ if serde_json::from_slice::<IgnoredAny>(rumpf).is_ok() => Fehler::Ungueltig(format!("{}: Wert hat nicht die erwartete Form", feld(e.path(), None))),
        _ => kein_json(rumpf, e.inner()),
    })?;
    leser.end().map_err(|e| kein_json(rumpf, &e))?;
    Ok(wert)
}

/// Der Rumpf ist kein JSON: leer, abgeschnitten, falsche Zeichen oder Zeichen hinter dem Wert.
fn kein_json(rumpf: &[u8], fehler: &serde_json::Error) -> Fehler {
    if rumpf.iter().all(u8::is_ascii_whitespace) {
        return Fehler::Ungueltig("Der Rumpf ist leer — kein gültiges JSON".to_string());
    }
    Fehler::Ungueltig(format!("Der Rumpf ist kein gültiges JSON (Zeile {}, Spalte {})", fehler.line(), fehler.column()))
}

/// Deutsche Meldung `<Feldpfad>: <was erwartet wird>` aus dem Text des Rahmens. Übernommen werden nur Teile,
/// die aus dem Programm stammen (Feldname, erlaubte Werte); der gesendete Wert und der Wortlaut des Rahmens nie.
fn formfehler(rumpf: &[u8], pfad: &Path, rahmen: &str) -> String {
    let rahmen = rahmen.rsplit_once(" at line ").map_or(rahmen, |(text, _stelle)| text);
    if let Some(name) = rahmen.strip_prefix("missing field ") {
        return format!("{}: Pflichtfeld fehlt", feld(pfad, Some(name)));
    }
    if let Some(name) = rahmen.strip_prefix("duplicate field ") {
        return format!("{}: Feld mehrfach genannt", feld(pfad, Some(name)));
    }
    let feld = feld(pfad, None);
    if rahmen.starts_with("unknown variant ") {
        return match erlaubte_werte(rahmen) {
            Some(werte) => format!("{feld}: unbekannter Wert — erlaubt: {werte}"),
            None => format!("{feld}: unbekannter Wert"),
        };
    }
    let (gesendet, erwartet) = rahmen.rsplit_once(", expected ").unwrap_or_default();
    let Some(erwartet) = erwartung(erwartet) else {
        return format!("{feld}: Wert hat nicht die erwartete Form");
    };
    match gesendet.strip_prefix("invalid type: ").and_then(art_des_rahmens) {
        Some(art) if art_am_pfad(rumpf, pfad).is_some_and(|dort| dort != art) => format!("{feld}: ein Feld darin hat die falsche Form ({erwartet} erwartet, nicht {art})"),
        Some(art) => format!("{feld}: {erwartet} erwartet, nicht {art}"),
        None => format!("{feld}: {erwartet} erwartet"),
    }
}

/// Der Feldpfad der Meldung; der Wurzelpfad heißt „Rumpf“, ein langer Pfad (gesendete Schlüssel) wird gekürzt.
fn feld(pfad: &Path, name: Option<&str>) -> String {
    const LAENGE: usize = 120;
    let name = name.map(|n| n.trim_matches('`'));
    let voll = match (pfad.iter().next().is_some(), name) {
        (true, Some(name)) => format!("{pfad}.{name}"),
        (true, None) => pfad.to_string(),
        (false, Some(name)) => name.to_string(),
        (false, None) => "Rumpf".to_string(),
    };
    if voll.chars().count() <= LAENGE {
        return voll;
    }
    voll.chars().take(LAENGE).chain(['…']).collect()
}

/// Die erlaubten Werte einer Aufzählung aus „…, expected one of `a`, `b`“ — sie stehen im Programm und folgen dem gesendeten Wert als Letztes.
fn erlaubte_werte(rahmen: &str) -> Option<String> {
    let (_gesendet, liste) = rahmen.rsplit_once(", expected ")?;
    let werte: Vec<&str> = liste.split('`').skip(1).step_by(2).collect();
    (!werte.is_empty()).then(|| werte.join(", "))
}

/// Was der Rahmen erwartet, auf Deutsch; `None` für alles, was hier nicht bekannt ist.
fn erwartung(rahmen: &str) -> Option<&'static str> {
    Some(match rahmen {
        "u8" | "u16" | "u32" | "u64" | "usize" => "ganze Zahl ab 0",
        "i8" | "i16" | "i32" | "i64" | "isize" => "ganze Zahl",
        "f32" | "f64" => "Zahl",
        "a string" | "string or map" => "Text",
        "a boolean" => "true oder false",
        "a sequence" => "Liste",
        "a map" => "Objekt",
        _ if rahmen.starts_with("struct ") => "Objekt",
        _ => return None,
    })
}

/// Die Art des gesendeten Werts aus dem ersten Wort des Rahmens („string "…"“, „integer `7`“) — der Wert selbst bleibt weg.
fn art_des_rahmens(gesendet: &str) -> Option<&'static str> {
    Some(match gesendet.split([' ', '`', '"']).next()? {
        "string" => "Text",
        "integer" => "Zahl",
        "floating" => "Kommazahl",
        "boolean" => "Wahrheitswert",
        "null" => "null",
        "sequence" => "Liste",
        "map" => "Objekt",
        _ => return None,
    })
}

/// Die Art des Werts, der im Rumpf am Pfad steht. Weicht sie von der gemeldeten ab, liegt der Fehler in einem
/// eingebetteten Teil (`#[serde(flatten)]`, Aufzählung ohne Kennzeichen), dessen Feld der Pfad nicht trägt.
fn art_am_pfad(rumpf: &[u8], pfad: &Path) -> Option<&'static str> {
    let wurzel: Value = serde_json::from_slice(rumpf).ok()?;
    let wert = pfad.iter().try_fold(&wurzel, |wert, stelle| match stelle {
        Segment::Seq { index } => wert.get(index),
        Segment::Map { key } => wert.get(key),
        _ => None,
    })?;
    Some(match wert {
        Value::String(_) => "Text",
        Value::Number(zahl) if zahl.is_f64() => "Kommazahl",
        Value::Number(_) => "Zahl",
        Value::Bool(_) => "Wahrheitswert",
        Value::Null => "null",
        Value::Array(_) => "Liste",
        Value::Object(_) => "Objekt",
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;
    use std::collections::BTreeMap;

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "lowercase")]
    enum Linie {
        Durchgehend,
        Gestrichelt,
    }

    #[derive(Debug, Deserialize)]
    struct Ziel {
        nummer: u32,
        linie: Option<Linie>,
    }

    #[derive(Debug, Deserialize)]
    struct Angaben {
        #[serde(default)]
        labels: Vec<String>,
    }

    #[derive(Debug, Deserialize)]
    struct Rumpf {
        text: String,
        #[serde(default)]
        fertig: bool,
        #[serde(default)]
        ziele: Vec<Ziel>,
        #[serde(default)]
        stunden: BTreeMap<String, f64>,
        #[serde(flatten)]
        angaben: Angaben,
    }

    /// Die Antwort des Extraktors auf eine Anfrage mit diesem Rumpf: Status, `Content-Type`, Rumpf als JSON.
    async fn antwort(anfrage: axum::http::request::Builder, rumpf: impl Into<axum::body::Body>) -> (u16, String, Value) {
        let abweisung = match JsonKoerper::<Rumpf>::from_request(anfrage.body(rumpf.into()).unwrap(), &()).await {
            Err(abweisung) => abweisung,
            Ok(JsonKoerper(rumpf)) => panic!("Abweisung erwartet: {rumpf:?}"),
        };
        let antwort = abweisung.into_response();
        let (status, art) = (antwort.status().as_u16(), antwort.headers()["content-type"].to_str().unwrap().to_string());
        let bytes = axum::body::to_bytes(antwort.into_body(), usize::MAX).await.unwrap();
        (status, art, serde_json::from_slice(&bytes).unwrap())
    }

    fn json_anfrage() -> axum::http::request::Builder {
        Request::post("/").header("content-type", "application/json")
    }

    #[tokio::test]
    async fn der_extraktor_liest_einen_gueltigen_rumpf() {
        let JsonKoerper(rumpf) = JsonKoerper::<Rumpf>::from_request(json_anfrage().body(r#"{"text": "a"}"#.into()).unwrap(), &()).await.unwrap();
        assert_eq!(rumpf.text, "a");
    }

    #[tokio::test]
    async fn der_extraktor_weist_einen_formfehler_mit_400_und_fehler_als_json_ab() {
        for (rumpf, meldung) in [(r#"{"text": 7}"#, "text: Text erwartet, nicht Zahl"), ("{", "Der Rumpf ist kein gültiges JSON (Zeile 1, Spalte 1)"), ("", "Der Rumpf ist leer — kein gültiges JSON")] {
            assert_eq!(antwort(json_anfrage(), rumpf).await, (400, "application/json".to_string(), serde_json::json!({"fehler": meldung})), "{rumpf}");
        }
    }

    /// Die Meldung, mit der `rumpf` als `Rumpf` abgewiesen wird.
    fn meldung(rumpf: &str) -> String {
        match lesen::<Rumpf>(rumpf.as_bytes()) {
            Err(Fehler::Ungueltig(meldung)) => meldung,
            anderes => panic!("Fehler::Ungueltig erwartet: {anderes:?}"),
        }
    }

    #[test]
    fn ein_gueltiger_rumpf_wird_gelesen_und_unbekannte_schluessel_ueberlesen() {
        let r: Rumpf = lesen(br#"{"text": "a", "fertig": true, "ziele": [{"nummer": 2, "linie": "gestrichelt"}], "stunden": {"mo": 1.5}, "labels": ["x"], "quatsch": 1}"#).unwrap();
        assert_eq!((r.text.as_str(), r.fertig, r.ziele[0].nummer, r.stunden["mo"], r.angaben.labels.len()), ("a", true, 2, 1.5, 1));
        assert!(matches!(r.ziele[0].linie, Some(Linie::Gestrichelt)));
        assert!(matches!(lesen::<Rumpf>(br#"{"text": "a", "ziele": [{"nummer": 1, "linie": "durchgehend"}]}"#).unwrap().ziele[0].linie, Some(Linie::Durchgehend)));
    }

    #[test]
    fn ein_falscher_typ_nennt_feldpfad_erwartung_und_art_des_gesendeten() {
        for (rumpf, erwartet) in [
            (r#"{"text": 7}"#, "text: Text erwartet, nicht Zahl"),
            (r#"{"text": "a", "fertig": "ja"}"#, "fertig: true oder false erwartet, nicht Text"),
            (r#"{"text": "a", "ziele": 7}"#, "ziele: Liste erwartet, nicht Zahl"),
            (r#"{"text": "a", "ziele": [7]}"#, "ziele[0]: Objekt erwartet, nicht Zahl"),
            (r#"{"text": "a", "ziele": [{"nummer": "eins"}]}"#, "ziele[0].nummer: ganze Zahl ab 0 erwartet, nicht Text"),
            (r#"{"text": "a", "ziele": [{"nummer": 2.0}]}"#, "ziele[0].nummer: ganze Zahl ab 0 erwartet, nicht Kommazahl"),
            (r#"{"text": "a", "ziele": [{"nummer": null}]}"#, "ziele[0].nummer: ganze Zahl ab 0 erwartet, nicht null"),
            (r#"{"text": "a", "ziele": [{"nummer": -1}]}"#, "ziele[0].nummer: ganze Zahl ab 0 erwartet"),
            (r#"{"text": "a", "stunden": {"mo": true}}"#, "stunden.mo: Zahl erwartet, nicht Wahrheitswert"),
            (r#"{"text": "a", "ziele": [{"nummer": 1, "linie": 7}]}"#, "ziele[0].linie: Wert hat nicht die erwartete Form"),
            (r#"[]"#, "Rumpf: Objekt erwartet, nicht Liste"),
            (r#""a""#, "Rumpf: Objekt erwartet, nicht Text"),
        ] {
            assert_eq!(meldung(rumpf), erwartet, "{rumpf}");
        }
    }

    #[test]
    fn ein_fehlendes_pflichtfeld_nennt_das_feld_mit_seinem_pfad() {
        assert_eq!(meldung("{}"), "text: Pflichtfeld fehlt");
        assert_eq!(meldung(r#"{"text": "a", "ziele": [{"nummer": 1}, {}]}"#), "ziele[1].nummer: Pflichtfeld fehlt");
    }

    #[test]
    fn ein_unbekannter_wert_einer_aufzaehlung_nennt_die_erlaubten_werte() {
        assert_eq!(meldung(r#"{"text": "a", "ziele": [{"nummer": 1, "linie": "wellig"}]}"#), "ziele[0].linie: unbekannter Wert — erlaubt: durchgehend, gestrichelt");
    }

    #[test]
    fn ein_falscher_typ_im_zweiten_element_nennt_die_stelle_1() {
        assert_eq!(meldung(r#"{"text": "a", "ziele": [{"nummer": 1}, {"nummer": "zwei"}]}"#), "ziele[1].nummer: ganze Zahl ab 0 erwartet, nicht Text");
    }

    #[test]
    fn ein_falscher_typ_in_einem_eingebetteten_teil_nennt_den_umgebenden_teil() {
        assert_eq!(meldung(r#"{"text": "a", "labels": 7}"#), "Rumpf: ein Feld darin hat die falsche Form (Liste erwartet, nicht Zahl)");
    }

    #[test]
    fn kaputtes_json_nennt_die_stelle_und_ein_leerer_rumpf_heisst_leer() {
        assert_eq!(meldung(r#"{"text": "#), "Der Rumpf ist kein gültiges JSON (Zeile 1, Spalte 9)");
        assert_eq!(meldung("{\"text\": \"a\",\n \"fertig\": wahr}"), "Der Rumpf ist kein gültiges JSON (Zeile 2, Spalte 12)");
        assert_eq!(meldung(r#"{"text": "a"} 7"#), "Der Rumpf ist kein gültiges JSON (Zeile 1, Spalte 15)");
        assert_eq!(meldung(""), "Der Rumpf ist leer — kein gültiges JSON");
        assert_eq!(meldung(" \n"), "Der Rumpf ist leer — kein gültiges JSON");
    }

    #[test]
    fn die_meldung_wiederholt_den_gesendeten_wert_nicht_auch_wenn_er_den_rahmen_nachahmt() {
        for rumpf in [
            r#"{"text": "a", "ziele": [{"nummer": "Zx9-Inhalt"}]}"#,
            r#"{"text": "a", "ziele": [{"nummer": "Zx9, expected a string at line 1 column 1"}]}"#,
            r#"{"text": "a", "ziele": [{"nummer": 1, "linie": "Zx9"}]}"#,
            r#"{"text": "a", "ziele": [{"nummer": 1, "linie": "x`, expected one of `Zx9"}]}"#,
            r#"{"text": "a", "ziele": [{"nummer": 1, "linie": "x`, expected `Zx9` at line 1 column 2"}]}"#,
            r#"{"text": "a", "fertig": "missing field `Zx9`"}"#,
            r#"{"text": "a", "labels": "Zx9"}"#,
        ] {
            let meldung = meldung(rumpf);
            assert!(!meldung.contains("Zx9"), "{rumpf}: {meldung}");
        }
    }

    #[test]
    fn keine_meldung_traegt_text_des_rahmens() {
        for rumpf in ["", "{", "[]", "{}", r#"{"text": 7}"#, r#"{"text": "a", "ziele": [{"nummer": -1}]}"#, r#"{"text": "a", "ziele": [{"nummer": 1, "linie": "wellig"}]}"#, r#"{"text": "a", "labels": 7}"#, r#"{"text": "a", "text": "b"}"#] {
            let meldung = meldung(rumpf);
            for wort in ["invalid", "expected", "missing", "unknown", "duplicate", "Failed", "line", "column", "struct", "`"] {
                assert!(!meldung.contains(wort), "{rumpf}: „{wort}“ in {meldung}");
            }
        }
    }

    #[test]
    fn ein_doppeltes_feld_wird_benannt() {
        assert_eq!(meldung(r#"{"text": "a", "ziele": [{"nummer": 1, "nummer": 2}]}"#), "ziele[0].nummer: Feld mehrfach genannt");
    }

    #[test]
    fn ein_langer_schluessel_im_pfad_wird_gekuerzt() {
        let rumpf = format!(r#"{{"text": "a", "stunden": {{"{}": "x"}}}}"#, "k".repeat(5000));
        let meldung = meldung(&rumpf);
        assert!(meldung.starts_with("stunden.kkk") && meldung.ends_with("…: Zahl erwartet, nicht Text"), "{meldung}");
        assert!(meldung.chars().count() < 200, "{}", meldung.chars().count());
    }
}
