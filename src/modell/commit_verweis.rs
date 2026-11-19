//! Commit-Verweis `<kürzel>:<hash>` oder `<hash>` (R00202, ADR-0032 Punkte 1 und 3) — die Form prüfen und gegen das
//! Register lesen, rein und **ohne Git**: eine Eingabe, die hier scheitert, erreicht Git nie (AK 6).

use super::{Anwendung, Anwendungen, kuerzel_gueltig};

/// Kürzester Kurz-Hash, den eine Anfrage nennen darf.
pub const HASH_MIN: usize = 7;
/// Längster Hash: voller Hash eines SHA-256-Repositorys.
pub const HASH_MAX: usize = 64;

/// Eine Abweisung samt dem Verweis, wie er in der Anfrage stand (Fehlerform `{fehler, verweis}`, ADR-0003).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Verweisfehler {
    pub meldung: String,
    pub verweis: String,
}

/// Ein Verweis in gültiger Form: Kürzel (ohne → Standardanwendung) und Hash, kleingeschrieben — noch ohne Register und Git.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Verweisform {
    pub kuerzel: Option<String>,
    pub hash: String,
}

impl Verweisform {
    pub fn lesen(text: &str) -> Result<Verweisform, Verweisfehler> {
        let (kuerzel, hash) = match text.split_once(':') {
            Some((k, h)) => (Some(k), h),
            None => (None, text),
        };
        if kuerzel.is_some_and(|k| !kuerzel_gueltig(k)) || !hash_gueltig(hash) {
            return Err(fehler(text, format!("„{}“ ist kein Commit-Verweis — erwartet <kürzel>:<hash> oder <hash> mit {HASH_MIN} bis {HASH_MAX} Zeichen 0-9a-f", crate::nachricht::wert(text))));
        }
        Ok(Verweisform { kuerzel: kuerzel.map(String::from), hash: hash.to_ascii_lowercase() })
    }
}

/// `^[0-9a-fA-F]{7,64}$` — nur ASCII; Großbuchstaben schreibt [`Verweisform::lesen`] klein.
fn hash_gueltig(hash: &str) -> bool {
    (HASH_MIN..=HASH_MAX).contains(&hash.len()) && hash.bytes().all(|b| b.is_ascii_hexdigit())
}

fn fehler(verweis: &str, meldung: String) -> Verweisfehler {
    Verweisfehler { meldung, verweis: verweis.into() }
}

/// Der Verweis gegen das Register: mit Kürzel eine registrierte Anwendung, ohne Kürzel nur die Standardanwendung —
/// bewusst strenger als [`Anwendungen::aufloesen`] (ADR-0032 Punkt 1). Liefert die Anwendung und den Hash.
pub fn lesen<'a>(text: &str, anwendungen: &'a Anwendungen) -> Result<(&'a Anwendung, String), Verweisfehler> {
    let form = Verweisform::lesen(text)?;
    let anwendung = match &form.kuerzel {
        Some(k) => anwendungen.alle().iter().find(|a| !k.is_empty() && a.kuerzel == *k).ok_or_else(|| fehler(text, format!("Anwendung „{k}“ ist nicht registriert")))?,
        None => anwendungen.alle().iter().find(|a| a.kuerzel.is_empty()).ok_or_else(|| fehler(text, format!("„{}“ nennt keine Anwendung, und es gibt keine Standardanwendung — <kürzel>:<hash> schreiben", crate::nachricht::wert(text))))?,
    };
    Ok((anwendung, form.hash))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::Quellen;

    const K1: &str = "3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e";

    /// Register mit `kd` und `xx`; mit `standard` dazu die Standardanwendung (sources.wbs).
    fn register(standard: bool) -> Anwendungen {
        let anwendung = |k: &str| Anwendung { kuerzel: k.into(), name: k.into(), wbs: format!("/{k}/app.md"), anforderungen: String::new() };
        let wbs = if standard { "/r/Dokumentation/Planung/app.md" } else { "" };
        Anwendungen::aus(&Quellen { wbs: wbs.into(), anforderungen: String::new(), anwendungen: vec![anwendung("kd"), anwendung("xx")] })
    }

    fn fehler(text: &str, anwendungen: &Anwendungen) -> Verweisfehler {
        lesen(text, anwendungen).map(|(a, h)| (a.kuerzel.clone(), h)).unwrap_err()
    }

    // AK 4, AK 6: was die Form verletzt, ist ein Fehler mit dem Verweis aus der Anfrage — Git sieht es nie
    #[test]
    fn form_verletzt() {
        let r = register(true);
        let zu_lang = "a".repeat(HASH_MAX + 1);
        let zu_kurz = "3f2a9c";
        for text in [
            &format!("kd:{zu_kurz}"),
            "kd:main",
            "kd:HEAD",
            "kd:3f2a9cg",
            &format!("kd:{zu_lang}"),
            "kd:--output=x",
            "kd:../x",
            "kd:3f2a9c1;rm -rf x",
            "kd:3f2a9c1 --all",
            "kd:3f2a 9c1",
            "kd:$(touch x)",
            "kd:3f2a9c1^{tree}",
            "kd:3f2a9c1~1",
            "kd:@{-1}",
            "kd:３f2a9c1",
            "kd:",
            ":3f2a9c1",
            "",
            " kd:3f2a9c1",
            "kd:3f2a9c1\n",
            "KD!:3f2a9c1",
            "kd:x:3f2a9c1",
            zu_kurz,
            "--output=x",
        ] {
            let f = fehler(text, &r);
            assert_eq!(f.verweis, text, "{text:?}");
            assert!(!f.meldung.is_empty(), "{text:?}");
        }
    }

    // AK 4: 7 bis 64 Zeichen 0-9a-f, Großbuchstaben werden kleingeschrieben
    #[test]
    fn form_gueltig_grenzen_und_kleinschreibung() {
        let r = register(false);
        for (text, hash) in [("kd:3f2a9c1", "3f2a9c1".to_string()), ("kd:3F2A9C1", "3f2a9c1".into()), (&format!("kd:{K1}"), K1.into()), (&format!("kd:{K1}0"), format!("{K1}0")), (&format!("kd:{}", "A".repeat(HASH_MAX)), "a".repeat(HASH_MAX))] {
            let (a, h) = lesen(text, &r).unwrap_or_else(|f| panic!("{text}: {f:?}"));
            assert_eq!((a.kuerzel.as_str(), h), ("kd", hash), "{text}");
        }
        assert_eq!(Verweisform::lesen("kd:3F2A9C1"), Ok(Verweisform { kuerzel: Some("kd".into()), hash: "3f2a9c1".into() }));
        assert_eq!(Verweisform::lesen("3f2a9c1"), Ok(Verweisform { kuerzel: None, hash: "3f2a9c1".into() }));
    }

    // AK 5: ein Kürzel, das nicht im Register steht, ist ein Fehler
    #[test]
    fn kuerzel_nicht_registriert() {
        let f = fehler(&format!("xy:{K1}"), &register(true));
        assert_eq!(f.verweis, format!("xy:{K1}"));
        assert!(f.meldung.contains("„xy“"), "{}", f.meldung);
    }

    // AK 3: ohne Kürzel nur die Standardanwendung — gibt es keine, wird nie geraten
    #[test]
    fn ohne_kuerzel_nur_die_standardanwendung() {
        let f = fehler(K1, &register(false));
        assert_eq!(f.verweis, K1);
        assert!(f.meldung.contains("Standardanwendung"), "{}", f.meldung);
        let r = register(true);
        let (a, h) = lesen(K1, &r).unwrap();
        assert_eq!((a.kuerzel.as_str(), a.wbs.as_str(), h.as_str()), ("", "/r/Dokumentation/Planung/app.md", K1));
        let (a, _) = lesen(&format!("kd:{K1}"), &r).unwrap();
        assert_eq!(a.kuerzel, "kd", "mit Kürzel gilt das Register, auch neben der Standardanwendung");
    }
}
