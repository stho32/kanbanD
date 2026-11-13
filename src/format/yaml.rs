//! Gemeinsames für das Frontmatter: stabiles Schreiben einfacher Werte, bequemes Lesen.

use super::Formatfehler;
use serde_yaml::{Mapping, Value};

/// Ein Skalar so, dass YAML ihn als denselben Text zurückliest: ohne Anführungszeichen,
/// wenn das eindeutig ist, sonst in doppelten Anführungszeichen mit `\uXXXX` für alles,
/// was YAML nicht roh in einer Datei duldet. „Eindeutig“ entscheidet am Ende der Rücklese-Test,
/// nicht eine Liste der Sonderfälle: `0x11`, `0o17`, `.inf` liest YAML sonst als Zahl (R00098).
pub fn skalar(s: &str) -> String {
    let schlicht = !s.is_empty()
        && s.chars().all(|c| c.is_alphanumeric() || " _./-()äöüÄÖÜß".contains(c))
        && !s.starts_with([' ', '-', '.'])
        && !s.ends_with(' ')
        && !matches!(s.to_lowercase().as_str(), "true" | "false" | "yes" | "no" | "on" | "off" | "null" | "~")
        && s.parse::<f64>().is_err()
        && liest_sich_als_derselbe_text(s);
    if schlicht || ist_qualifizierte_herkunft(s) { s.to_string() } else { in_anfuehrungszeichen(s) }
}

fn liest_sich_als_derselbe_text(s: &str) -> bool {
    matches!(serde_yaml::from_str::<Value>(s), Ok(Value::String(t)) if t == s)
}

/// JSON-String (gültiges YAML), darin zusätzlich escapet, was YAML nicht druckbar nennt
/// (DEL, C1, U+FFFE/U+FFFF) oder als Zeilenumbruch faltet (U+0085, U+2028, U+2029).
fn in_anfuehrungszeichen(s: &str) -> String {
    let json = serde_json::to_string(s).expect("String ist JSON");
    json.chars()
        .map(|c| match c {
            '\u{7f}'..='\u{9f}' | '\u{2028}' | '\u{2029}' | '\u{fffe}' | '\u{ffff}' => format!("\\u{:04X}", c as u32),
            _ => c.to_string(),
        })
        .collect()
}

/// `kd:I0007` liest YAML auch in einer Liste als einen Text — ein Doppelpunkt ohne folgendes Leerzeichen trennt nichts.
fn ist_qualifizierte_herkunft(s: &str) -> bool {
    s.split_once(':').is_some_and(|(k, id)| !k.is_empty() && id.starts_with(|c: char| c.is_ascii_alphabetic()) && format!("{k}{id}").chars().all(|c| c.is_ascii_alphanumeric()))
}

pub fn liste(werte: &[String]) -> String {
    format!("[{}]", werte.iter().map(|w| skalar(w)).collect::<Vec<_>>().join(", "))
}

/// Ein beliebiger YAML-Wert in einer Zeile (Flussform), sicher geschrieben: jeder Text über [`skalar`], Listen als
/// `[...]`, Zuordnungen als `{...}`, ein Tag als `!tag …`. So bleibt ein handgeschriebener Wert wie
/// `column-owner: {Eingang: ["a] #human"]}` beim Schreiben heil und zeichengleich (Karte #142).
pub fn wert(v: &Value) -> String {
    match v {
        Value::String(s) => skalar(s),
        Value::Sequence(s) => format!("[{}]", s.iter().map(wert).collect::<Vec<_>>().join(", ")),
        Value::Mapping(m) => format!("{{{}}}", m.iter().map(|(k, w)| format!("{}: {}", wert(k), wert(w))).collect::<Vec<_>>().join(", ")),
        Value::Tagged(t) => format!("{} {}", t.tag, wert(&t.value)),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Null => "null".into(),
    }
}

/// Derselbe Wert als Text für eine Meldung: ein Text roh, Listen und Zuordnungen in Flussform ohne zusätzliche
/// Anführungszeichen (`[human]`, `{a: b}`), ein Tag mit `!tag`.
pub fn anzeige(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Sequence(s) => format!("[{}]", s.iter().map(anzeige).collect::<Vec<_>>().join(", ")),
        Value::Mapping(m) => format!("{{{}}}", m.iter().map(|(k, w)| format!("{}: {}", anzeige(k), anzeige(w))).collect::<Vec<_>>().join(", ")),
        Value::Tagged(t) => format!("{} {}", t.tag, anzeige(&t.value)),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Null => "null".into(),
    }
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
pub(crate) mod tests {
    use super::*;

    /// Texte, die YAML sonst als etwas anderes liest oder nicht roh duldet — auch für eigene Rundlauf-Tests (R00105).
    pub(crate) const RUNDLAUF_TEXTE: [&str; 34] = [
        "0x11", "0o17", "0b11", "0xFF", "0x10", "0X1A", "1e3", "17", "+1", "-1", ".5", "1_000", "0.", ".inf", "-.inf", ".nan", "Infinity",
        "a\u{7f}b", "\u{80}", "\u{9b}", "\u{fffe}", "\u{ffff}", "\u{85}", "a\u{2028}b", "a\u{2029}b",
        "\0", "\u{1b}", "a\tb", "\u{feff}x", "\u{202e}abc", "a\nb", "Größe", "kd:I0007", "Stefan Hoffmann",
    ];

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

    // R00098 Nacharbeit (Security-Review): jeder Text liest sich als derselbe String zurück — Klasse
    // „YAML liest etwas anderes“ (Zahlen mit Präfix) und „Datei unlesbar“ (nicht druckbare Zeichen)
    #[test]
    fn jeder_text_im_rundlauf() {
        for s in RUNDLAUF_TEXTE.map(String::from) {
            let y = format!("k: {}\nl: {}\n", skalar(&s), liste(std::slice::from_ref(&s)));
            let m = lesen(&y).unwrap_or_else(|e| panic!("{s:?} → {y:?}: {e:?}"));
            assert!(matches!(m.get("k"), Some(Value::String(t)) if *t == s), "{s:?} → {y:?} → {:?}", m.get("k"));
            assert_eq!(textliste(&m, "l"), vec![s.clone()], "{y:?}");
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

    // Karte #142: ein beliebiger YAML-Wert in einer Zeile liest sich als derselbe Wert zurück — auch mit `]`, `#`
    // und Zeilenumbrüchen im Text; das Blatt trägt den Schutz von `skalar`, die Datei bleibt heil.
    #[test]
    fn werte_in_einer_zeile_bleiben_dieselben() {
        for text in ["human", "a] #human", "#human", "a\n---\nb", "Mensch", "0x11", "a: b", "\"q\""] {
            for v in [Value::String(text.into()), Value::Sequence(vec![text.into()]), Value::Mapping([(text.into(), Value::from("x"))].into_iter().collect())] {
                let zeile = format!("k: {}\n", wert(&v));
                let gelesen = lesen(&zeile).unwrap_or_else(|e| panic!("{v:?} → {zeile:?}: {e:?}")).get("k").cloned();
                assert_eq!(gelesen, Some(v.clone()), "{v:?} → {zeile:?}");
            }
        }
        assert_eq!(wert(&Value::Sequence(vec!["human".into()])), "[human]");
        assert_eq!(wert(&Value::Sequence(vec!["a] #human".into()])), "[\"a] #human\"]");
        assert_eq!(wert(&Value::from("a: b")), "\"a: b\"");
        assert_eq!(anzeige(&Value::Sequence(vec!["a] #human".into()])), "[a] #human]");
        // Auch verschachtelte Formen und ein Tag lesen sich als derselbe Wert zurück (jedes Blatt über `skalar`).
        let schief = Value::Mapping([(Value::Sequence(vec!["a".into()]), Value::from("b"))].into_iter().collect());
        let getaggt: Value = serde_yaml::from_str("!foo human").unwrap();
        let geschachtelt = Value::Sequence(vec![Value::Mapping([("a".into(), Value::from(1))].into_iter().collect())]);
        for v in [schief, getaggt, geschachtelt] {
            let zeile = format!("k: {}\n", wert(&v));
            assert_eq!(lesen(&zeile).unwrap_or_else(|e| panic!("{v:?} → {zeile:?}: {e:?}")).get("k").cloned(), Some(v.clone()), "{zeile:?}");
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
