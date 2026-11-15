//! Der JSON-Rumpf einer Anfrage — die eine Stelle, an der ein Formfehler abgewiesen wird (ADR-0003 N1/N3).

use crate::fehler::Fehler;
use axum::body::Bytes;
use axum::extract::path::ErrorKind;
use axum::extract::rejection::PathRejection;
use axum::extract::{FromRequest, FromRequestParts, OptionalFromRequest, RawPathParams, Request};
use axum::http::request::Parts;
use axum::http::header::CONTENT_TYPE;
use axum::http::{HeaderMap, StatusCode};
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
    /// `Content-Type` fehlt oder nennt kein JSON: 415.
    KeinJson,
    /// Der Rumpf überschreitet die Grenze des Rahmens: 413.
    ZuGross,
}

impl IntoResponse for Abweisung {
    fn into_response(self) -> Response {
        match self {
            Abweisung::Inhalt(fehler) => fehler.into_response(),
            Abweisung::KeinJson => super::fehlerantwort(StatusCode::UNSUPPORTED_MEDIA_TYPE, "Content-Type fehlt oder ist nicht application/json — der Rumpf wird nur als JSON gelesen"),
            Abweisung::ZuGross => super::fehlerantwort(StatusCode::PAYLOAD_TOO_LARGE, "Der Rumpf ist zu groß für eine JSON-Anfrage"),
        }
    }
}

impl<T: DeserializeOwned, S: Send + Sync> FromRequest<S> for JsonKoerper<T> {
    type Rejection = Abweisung;

    async fn from_request(anfrage: Request, zustand: &S) -> Result<Self, Abweisung> {
        if !nennt_json(anfrage.headers()) {
            return Err(Abweisung::KeinJson);
        }
        let rumpf = Bytes::from_request(anfrage, zustand).await.map_err(|e| match e.status() {
            StatusCode::PAYLOAD_TOO_LARGE => Abweisung::ZuGross,
            _ => Abweisung::Inhalt(Fehler::Ungueltig("Der Rumpf konnte nicht gelesen werden".to_string())),
        })?;
        lesen(&rumpf).map(JsonKoerper).map_err(Abweisung::Inhalt)
    }
}

/// Ein wahlfreier Rumpf (`Option<JsonKoerper<T>>`) fehlt, wenn die Anfrage keinen `Content-Type` trägt — wie beim Rahmen.
impl<T: DeserializeOwned, S: Send + Sync> OptionalFromRequest<S> for JsonKoerper<T> {
    type Rejection = Abweisung;

    async fn from_request(anfrage: Request, zustand: &S) -> Result<Option<Self>, Abweisung> {
        if !anfrage.headers().contains_key(CONTENT_TYPE) {
            return Ok(None);
        }
        <Self as FromRequest<S>>::from_request(anfrage, zustand).await.map(Some)
    }
}

/// Nennt der `Content-Type` JSON? Genau `application/json` oder `application/<name>+json`, Parameter und Großschreibung sind frei.
fn nennt_json(kopf: &HeaderMap) -> bool {
    let Some(art) = kopf.get(CONTENT_TYPE).and_then(|wert| wert.to_str().ok()) else {
        return false;
    };
    let art = art.split(';').next().unwrap_or_default().trim().to_ascii_lowercase();
    match art.split_once('/') {
        Some(("application", "json")) => true,
        Some(("application", unterart)) => unterart.rsplit_once('+').is_some_and(|(name, suffix)| !name.is_empty() && suffix == "json"),
        _ => false,
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

/// Die Parameter des Pfads als `T`. Jeder Handler nimmt sie so — nie als `axum::extract::Path<T>`, dessen Abweisung
/// als englischer Klartext mit dem gesendeten Wert am Antwortweg von `Fehler` vorbeigeht (ADR-0003 N4).
pub struct Pfad<T>(pub T);

impl<T: DeserializeOwned + Send, S: Send + Sync> FromRequestParts<S> for Pfad<T> {
    type Rejection = Abweisung;

    async fn from_request_parts(teile: &mut Parts, zustand: &S) -> Result<Self, Abweisung> {
        let abweisung = match axum::extract::Path::<T>::from_request_parts(teile, zustand).await {
            Ok(axum::extract::Path(wert)) => return Ok(Pfad(wert)),
            Err(abweisung) => abweisung,
        };
        let PathRejection::FailedToDeserializePathParams(abweisung) = abweisung else {
            return Err(Abweisung::Inhalt(pfad_falsch_gelesen()));
        };
        // Die Namen stehen nur bei lesbaren Werten bereit; bei ungültigem UTF-8 trägt die Abweisung den Namen selbst
        let namen: Vec<String> = RawPathParams::from_request_parts(teile, zustand).await.map(|werte| werte.iter().map(|(name, _wert)| name.to_string()).collect()).unwrap_or_default();
        Err(Abweisung::Inhalt(pfadfehler(abweisung.kind(), &namen)))
    }
}

/// Deutsche Meldung `Pfadparameter <Name>: <was erwartet wird>`. Der Rahmen nennt bei einem Typfehler nur die Stelle —
/// der Name kommt aus der Routenschablone (`namen`, in ihrer Reihenfolge). Der gesendete Wert und der Wortlaut des Rahmens bleiben weg.
fn pfadfehler(art: &ErrorKind, namen: &[String]) -> Fehler {
    let einziger = namen.first().filter(|_| namen.len() == 1);
    let (name, aussage) = match art {
        ErrorKind::InvalidUtf8InPathParam { key } => (Some(key), "kein gültiges UTF-8".to_string()),
        ErrorKind::ParseErrorAtIndex { index, expected_type, .. } => (namen.get(*index), zahl_im_pfad(expected_type)),
        ErrorKind::ParseError { expected_type, .. } => (einziger, zahl_im_pfad(expected_type)),
        ErrorKind::ParseErrorAtKey { key, expected_type, .. } => (Some(key), zahl_im_pfad(expected_type)),
        ErrorKind::DeserializeError { key, .. } => (Some(key), FALSCHE_FORM.to_string()),
        ErrorKind::Message(_) => (einziger, FALSCHE_FORM.to_string()),
        _ => return pfad_falsch_gelesen(),
    };
    match name {
        Some(name) => Fehler::Ungueltig(format!("Pfadparameter {name}: {aussage}")),
        None => Fehler::Ungueltig(format!("Pfadparameter: {aussage}")),
    }
}

/// Was an der Stelle erwartet wird; bis `u32` mit der oberen Grenze, weil auch eine zu große Zahl eine ganze Zahl ab 0 ist.
fn zahl_im_pfad(typ: &str) -> String {
    let groesste = match typ {
        "u8" => Some(u64::from(u8::MAX)),
        "u16" => Some(u64::from(u16::MAX)),
        "u32" => Some(u64::from(u32::MAX)),
        _ => None,
    };
    match (groesste, erwartung(typ)) {
        (Some(groesste), _) => format!("ganze Zahl von 0 bis {groesste} erwartet"),
        (None, Some(erwartet)) => format!("{erwartet} erwartet"),
        (None, None) => FALSCHE_FORM.to_string(),
    }
}

const FALSCHE_FORM: &str = "Wert hat nicht die erwartete Form";

/// Die Route nennt in ihrer Schablone andere Parameter, als ihr Handler liest — ein Fehler im Programm, kein Fehler der Anfrage (500 wie beim Rahmen).
fn pfad_falsch_gelesen() -> Fehler {
    Fehler::Intern("Die Route liest ihre Pfadparameter nicht so, wie ihre Schablone sie nennt".to_string())
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

    async fn pflicht(anfrage: Request) -> Result<JsonKoerper<Rumpf>, Abweisung> {
        <JsonKoerper<Rumpf> as FromRequest<()>>::from_request(anfrage, &()).await
    }

    async fn wahlfrei(anfrage: Request) -> Result<Option<JsonKoerper<Rumpf>>, Abweisung> {
        <JsonKoerper<Rumpf> as OptionalFromRequest<()>>::from_request(anfrage, &()).await
    }

    /// Die Antwort des Extraktors auf eine Anfrage mit diesem Rumpf: Status, `Content-Type`, Rumpf als JSON.
    async fn antwort(anfrage: axum::http::request::Builder, rumpf: impl Into<axum::body::Body>) -> (u16, String, Value) {
        let abweisung = match pflicht(anfrage.body(rumpf.into()).unwrap()).await {
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
        let JsonKoerper(rumpf) = pflicht(json_anfrage().body(r#"{"text": "a"}"#.into()).unwrap()).await.unwrap();
        assert_eq!(rumpf.text, "a");
    }

    #[tokio::test]
    async fn der_extraktor_weist_einen_formfehler_mit_400_und_fehler_als_json_ab() {
        for (rumpf, meldung) in [(r#"{"text": 7}"#, "text: Text erwartet, nicht Zahl"), ("{", "Der Rumpf ist kein gültiges JSON (Zeile 1, Spalte 1)"), ("", "Der Rumpf ist leer — kein gültiges JSON")] {
            assert_eq!(antwort(json_anfrage(), rumpf).await, (400, "application/json".to_string(), serde_json::json!({"fehler": meldung})), "{rumpf}");
        }
    }

    const KEIN_JSON: &str = "Content-Type fehlt oder ist nicht application/json — der Rumpf wird nur als JSON gelesen";

    #[tokio::test]
    async fn ohne_oder_mit_fremdem_content_type_weist_der_extraktor_mit_415_und_fehler_als_json_ab() {
        let gueltig = r#"{"text": "a"}"#;
        assert_eq!(antwort(Request::post("/"), gueltig).await, (415, "application/json".to_string(), serde_json::json!({"fehler": KEIN_JSON})));
        for art in ["text/plain", "application/jsonx", "text/json", "json", "application/", "application/+json", "application/json+xml", "application/x-www-form-urlencoded", "multipart/form-data; boundary=application/json"] {
            assert_eq!(antwort(Request::post("/").header("content-type", art), gueltig).await, (415, "application/json".to_string(), serde_json::json!({"fehler": KEIN_JSON})), "{art}");
        }
    }

    #[tokio::test]
    async fn json_mit_parameter_in_grossschreibung_oder_als_suffix_gilt_als_json() {
        for art in ["application/json", "application/json; charset=utf-8", "application/json;charset=utf-8", "APPLICATION/JSON", "Application/Json ; charset=UTF-8", "application/vnd.api+json", "application/problem+json; charset=utf-8"] {
            let gelesen = pflicht(Request::post("/").header("content-type", art).body(r#"{"text": "a"}"#.into()).unwrap()).await;
            assert!(gelesen.is_ok(), "{art}");
        }
    }

    #[tokio::test]
    async fn ein_rumpf_ueber_der_grenze_des_rahmens_wird_mit_413_und_fehler_als_json_abgewiesen() {
        let rumpf = |bytes: usize| format!(r#"{{"text": "{}"}}"#, "a".repeat(bytes - 12));
        let zu_gross = serde_json::json!({"fehler": "Der Rumpf ist zu groß für eine JSON-Anfrage"});
        assert_eq!(antwort(json_anfrage(), rumpf(3 * 1024 * 1024)).await, (413, "application/json".to_string(), zu_gross.clone()));
        assert_eq!(antwort(json_anfrage(), rumpf(2 * 1024 * 1024 + 1)).await, (413, "application/json".to_string(), zu_gross));
        let gelesen = pflicht(json_anfrage().body(rumpf(2 * 1024 * 1024).into()).unwrap()).await;
        assert!(gelesen.is_ok(), "genau 2 MiB gehen durch");
    }

    #[tokio::test]
    async fn ein_wahlfreier_rumpf_fehlt_nur_ohne_content_type() {
        let ohne = wahlfrei(Request::post("/").body("".into()).unwrap()).await;
        assert!(matches!(ohne, Ok(None)));
        let mit = wahlfrei(json_anfrage().body(r#"{"text": "a"}"#.into()).unwrap()).await;
        assert!(matches!(mit, Ok(Some(JsonKoerper(Rumpf { text, .. }))) if text == "a"));
        let falsch = wahlfrei(json_anfrage().body(r#"{"text": 7}"#.into()).unwrap()).await;
        assert!(matches!(falsch, Err(Abweisung::Inhalt(Fehler::Ungueltig(meldung))) if meldung == "text: Text erwartet, nicht Zahl"));
        let fremd = wahlfrei(Request::post("/").header("content-type", "text/plain").body("{}".into()).unwrap()).await;
        assert!(matches!(fremd, Err(Abweisung::KeinJson)));
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

#[cfg(test)]
mod parameter_tests {
    use super::*;
    use axum::Router;
    use axum::routing::get;
    use serde::Deserialize;
    use serde_json::json;

    #[derive(Debug, Deserialize)]
    struct Benannt {
        #[allow(dead_code)] // nur über Debug gelesen
        nr: u32,
        #[allow(dead_code)]
        name: String,
    }

    #[derive(Debug, Deserialize)]
    #[serde(rename_all = "lowercase")]
    enum Art {
        Fein,
    }

    #[derive(Debug, Deserialize)]
    struct Gewaehlt {
        #[allow(dead_code)]
        nr: u32,
        #[allow(dead_code)]
        art: Art,
    }

    /// Ein Dienst mit Routen je Form der Parameter; jede antwortet mit dem gelesenen Wert.
    async fn dienst() -> String {
        let router = Router::new()
            .route("/eine/{nr}", get(async |Pfad(nr): Pfad<u32>| format!("{nr:?}")))
            .route("/zwei/{nr}/teil/{i}", get(async |Pfad(beide): Pfad<(u32, usize)>| format!("{beide:?}")))
            .route("/text/{slug}/{nr}", get(async |Pfad(beide): Pfad<(String, u32)>| format!("{beide:?}")))
            .route("/benannt/{nr}/{name}", get(async |Pfad(b): Pfad<Benannt>| format!("{b:?}")))
            .route("/art/{art}", get(async |Pfad(art): Pfad<Art>| format!("{art:?}")))
            .route("/gewaehlt/{nr}/{art}", get(async |Pfad(g): Pfad<Gewaehlt>| format!("{g:?}")))
            .route("/verzaehlt/{a}/{b}", get(async |Pfad(nr): Pfad<u32>| format!("{nr:?}")));
        let horcher = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let adresse = format!("http://{}", horcher.local_addr().unwrap());
        tokio::spawn(async move { axum::serve(horcher, router).await.unwrap() });
        adresse
    }

    /// Status, `Content-Type` und Rumpf der Antwort auf `GET <pfad>`.
    async fn antwort(adresse: &str, pfad: &str) -> (u16, String, String) {
        let antwort = reqwest::get(format!("{adresse}{pfad}")).await.unwrap();
        let art = antwort.headers().get("content-type").and_then(|w| w.to_str().ok()).unwrap_or_default().to_string();
        (antwort.status().as_u16(), art, antwort.text().await.unwrap())
    }

    fn abgewiesen(status: u16, meldung: &str) -> (u16, String, String) {
        (status, "application/json".to_string(), json!({"fehler": meldung}).to_string())
    }

    const NR: &str = "Pfadparameter nr: ganze Zahl von 0 bis 4294967295 erwartet";
    const I: &str = "Pfadparameter i: ganze Zahl ab 0 erwartet";

    #[tokio::test]
    async fn gueltige_pfadparameter_werden_gelesen() {
        let adresse = dienst().await;
        for (pfad, gelesen) in [("/eine/7", "7"), ("/eine/4294967295", "4294967295"), ("/zwei/7/teil/3", "(7, 3)"), ("/text/b%C3%A4r/1", "(\"bär\", 1)"), ("/benannt/7/x", "Benannt { nr: 7, name: \"x\" }")] {
            assert_eq!(antwort(&adresse, pfad).await, (200, "text/plain; charset=utf-8".to_string(), gelesen.to_string()), "{pfad}");
        }
    }

    #[tokio::test]
    async fn ein_einzelner_parameter_mit_falschem_typ_nennt_den_namen_der_schablone() {
        let adresse = dienst().await;
        for wert in ["abc", "-1", "99999999999", "4294967296", "1.0", "Zx9-Inhalt", "%20"] {
            assert_eq!(antwort(&adresse, &format!("/eine/{wert}")).await, abgewiesen(400, NR), "{wert}");
        }
    }

    #[tokio::test]
    async fn bei_zwei_parametern_nennt_die_meldung_den_ersten_falschen() {
        let adresse = dienst().await;
        for (pfad, meldung) in [("/zwei/1/teil/abc", I), ("/zwei/1/teil/-1", I), ("/zwei/abc/teil/0", NR), ("/zwei/abc/teil/abc", NR), ("/text/x/abc", NR), ("/benannt/abc/x", NR)] {
            assert_eq!(antwort(&adresse, pfad).await, abgewiesen(400, meldung), "{pfad}");
        }
    }

    #[tokio::test]
    async fn ungueltiges_utf8_nennt_den_parameter_auch_wenn_er_text_ist_und_geht_dem_typfehler_vor() {
        let adresse = dienst().await;
        for (pfad, name) in [("/eine/%FF", "nr"), ("/zwei/%FF/teil/0", "nr"), ("/zwei/1/teil/%FF", "i"), ("/text/%FF/1", "slug"), ("/text/x/%FF", "nr"), ("/zwei/abc/teil/%FF", "i"), ("/benannt/1/%FF", "name")] {
            assert_eq!(antwort(&adresse, pfad).await, abgewiesen(400, &format!("Pfadparameter {name}: kein gültiges UTF-8")), "{pfad}");
        }
    }

    #[tokio::test]
    async fn ein_unbekannter_wert_einer_aufzaehlung_im_pfad_wird_mit_400_abgewiesen_ohne_den_wert() {
        let adresse = dienst().await;
        assert_eq!(antwort(&adresse, "/art/fein").await.0, 200);
        assert_eq!(antwort(&adresse, "/art/Zx9-Inhalt").await, abgewiesen(400, "Pfadparameter art: Wert hat nicht die erwartete Form"));
        // Bei mehreren Parametern nennt der Rahmen hier weder Stelle noch Namen — die Meldung rät nicht
        assert_eq!(antwort(&adresse, "/gewaehlt/1/Zx9-Inhalt").await, abgewiesen(400, "Pfadparameter: Wert hat nicht die erwartete Form"));
    }

    #[tokio::test]
    async fn eine_route_die_ihre_parameter_falsch_zaehlt_antwortet_mit_500_in_der_form() {
        let adresse = dienst().await;
        assert_eq!(antwort(&adresse, "/verzaehlt/1/2").await, abgewiesen(500, "Die Route liest ihre Pfadparameter nicht so, wie ihre Schablone sie nennt"));
    }
}
