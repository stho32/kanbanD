//! Gemeinsames für das Frontmatter: stabiles Schreiben einfacher Werte, bequemes Lesen.

use super::Formatfehler;
use serde_yaml::{Mapping, Value};

/// Ein Skalar so, dass YAML ihn als denselben Text zurückliest: ohne Anführungszeichen,
/// wenn das eindeutig ist, sonst als JSON-String (gültiges YAML).
pub fn skalar(s: &str) -> String {
    let schlicht = !s.is_empty()
        && s.chars().all(|c| c.is_alphanumeric() || " _./-()äöüÄÖÜß".contains(c))
        && !s.starts_with([' ', '-', '.'])
        && !s.ends_with(' ')
        && !matches!(s.to_lowercase().as_str(), "true" | "false" | "yes" | "no" | "on" | "off" | "null" | "~")
        && s.parse::<f64>().is_err();
    if schlicht || ist_qualifizierte_herkunft(s) { s.to_string() } else { serde_json::to_string(s).expect("String ist JSON") }
}

/// `kd:I0007` liest YAML auch in einer Liste als einen Text — ein Doppelpunkt ohne folgendes Leerzeichen trennt nichts.
fn ist_qualifizierte_herkunft(s: &str) -> bool {
    s.split_once(':').is_some_and(|(k, id)| !k.is_empty() && id.starts_with(|c: char| c.is_ascii_alphabetic()) && format!("{k}{id}").chars().all(|c| c.is_ascii_alphanumeric()))
}

pub fn liste(werte: &[String]) -> String {
    format!("[{}]", werte.iter().map(|w| skalar(w)).collect::<Vec<_>>().join(", "))
}

pub fn lesen(yaml: &str) -> Result<Mapping, Formatfehler> {
    if yaml.trim().is_empty() {
        return Ok(Mapping::new());
    }
    match serde_yaml::from_str::<Value>(yaml) {
        Ok(Value::Mapping(m)) => Ok(m),
        Ok(Value::Null) => Ok(Mapping::new()),
        Ok(_) => Err(Formatfehler("Frontmatter ist keine Zuordnung".into())),
        Err(e) => Err(Formatfehler(format!("Frontmatter unlesbar: {e}"))),
    }
}

pub fn text(m: &Mapping, schluessel: &str) -> Option<String> {
    m.get(schluessel).and_then(wert_als_text)
}

pub fn wert_als_text(v: &Value) -> Option<String> {
    match v {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

pub fn textliste(m: &Mapping, schluessel: &str) -> Vec<String> {
    match m.get(schluessel) {
        Some(Value::Sequence(s)) => s.iter().filter_map(wert_als_text).collect(),
        Some(v) => wert_als_text(v).into_iter().collect(),
        None => vec![],
    }
}

pub fn zuordnung<'a>(m: &'a Mapping, schluessel: &str) -> Option<&'a Mapping> {
    m.get(schluessel).and_then(Value::as_mapping)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schlichte_texte_bleiben_ohne_anfuehrungszeichen() {
        assert_eq!(skalar("Stefan Hoffmann"), "Stefan Hoffmann");
        assert_eq!(skalar("Anforderungen/"), "Anforderungen/");
        assert_eq!(skalar("Größe"), "Größe");
    }

    #[test]
    fn mehrdeutige_texte_werden_gequotet_und_lesen_sich_zurueck() {
        for s in ["", "a: b", "true", "12", "#x", "- y", " z", "\"q\"", "1.5", "null", "a, b"] {
            let y = format!("k: {}\n", skalar(s));
            let m = lesen(&y).unwrap();
            assert_eq!(text(&m, "k").unwrap_or_default(), s, "{y}");
        }
    }

    #[test]
    fn qualifizierte_herkunft_bleibt_schlicht_auch_in_der_liste() {
        assert_eq!(skalar("kd:I0007"), "kd:I0007");
        assert_eq!(liste(&["kd:I0007".into(), "R00014".into()]), "[kd:I0007, R00014]");
        assert_eq!(textliste(&lesen("o: [kd:I0007, R00014]\n").unwrap(), "o"), vec!["kd:I0007", "R00014"]);
        for s in ["a:", ":a", "a: b", "a:b c", "12:30"] {
            assert_ne!(skalar(s), s, "{s}");
        }
    }

    #[test]
    fn listen_und_fehler() {
        let m = lesen("l: [a, \"b, c\"]\ne: x\nz: {a: 1}\n").unwrap();
        assert_eq!(textliste(&m, "l"), vec!["a", "b, c"]);
        assert_eq!(textliste(&m, "e"), vec!["x"]);
        assert_eq!(textliste(&m, "fehlt"), Vec::<String>::new());
        assert!(zuordnung(&m, "z").is_some());
        assert_eq!(liste(&["a".into(), "b c".into(), "1".into()]), "[a, b c, \"1\"]");
        assert!(lesen("- a\n- b\n").is_err());
        assert!(lesen("a: [\n").is_err());
        assert!(lesen("~\n").unwrap().is_empty());
    }
}
