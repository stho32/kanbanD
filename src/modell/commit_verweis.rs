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

/// Höchstzahl der Paare eines Aufrufs `POST …/commits/ersetzen` (ADR-0032 N1.4) — vor dem ersten Git-Aufruf geprüft.
pub const HOECHSTZAHL_PAARE: usize = 500;

/// Eine Abweisung des Rumpfs; `verweis` nennt den auslösenden Text aus der Anfrage, wo es einen gibt (Rumpfform und
/// Zahl der Paare haben keinen).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ersetzungsfehler {
    pub meldung: String,
    pub verweis: Option<String>,
}

/// Ein Paar des Rumpfs in gültiger Form: `alt` nur als Form (nie gegen Git), `neu` gegen das Register gelesen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Paar {
    pub alt_text: String,
    pub alt: Verweisform,
    pub neu_text: String,
    /// Die Anwendung von `neu` — zugleich die von `alt` (gleiches Kürzel).
    pub anwendung: Anwendung,
    pub neu_hash: String,
}

/// Der Rumpf `{ersetzungen: [{alt, neu}, …]}` als Paare — rein und **ohne Git**: was hier scheitert, erreicht Git nie.
/// Geprüft wird in dieser Reihenfolge: Rumpfform, Zahl der Paare, dann je Paar die Form von `alt`, sein Kürzel im Register,
/// Form und Register von `neu`, gleiches Kürzel, und dass kein Verweis zweimal vorkommt (auch als Kette).
pub fn ersetzungen_lesen(rumpf: &serde_json::Value, anwendungen: &Anwendungen) -> Result<Vec<Paar>, Ersetzungsfehler> {
    let ohne_verweis = |meldung: String| Ersetzungsfehler { meldung, verweis: None };
    let liste = rumpf
        .as_object()
        .filter(|o| o.len() == 1)
        .and_then(|o| o.get("ersetzungen"))
        .and_then(serde_json::Value::as_array)
        .filter(|l| !l.is_empty())
        .ok_or_else(|| ohne_verweis("Rumpf {ersetzungen: [{alt, neu}, …]} mit mindestens einem Paar erwartet".into()))?;
    if liste.len() > HOECHSTZAHL_PAARE {
        return Err(ohne_verweis(format!("Die Anfrage nennt {} Paare — mehr als {HOECHSTZAHL_PAARE} nimmt ein Aufruf nicht an", liste.len())));
    }
    let mut paare: Vec<Paar> = Vec::with_capacity(liste.len());
    let mut gesehen: Vec<(Option<String>, String)> = Vec::with_capacity(2 * liste.len());
    for (i, eintrag) in liste.iter().enumerate() {
        let (alt_text, neu_text) = paar_texte(eintrag).ok_or_else(|| ohne_verweis(format!("ersetzungen[{i}] ist kein Paar {{alt, neu}} aus zwei Texten")))?;
        let alt = Verweisform::lesen(alt_text).map_err(Ersetzungsfehler::from)?;
        if let Some(k) = &alt.kuerzel
            && !anwendungen.alle().iter().any(|a| !k.is_empty() && a.kuerzel == *k)
        {
            return Err(mit_verweis(alt_text, format!("Anwendung „{k}“ ist nicht registriert")));
        }
        let (anwendung, neu_hash) = lesen(neu_text, anwendungen).map_err(Ersetzungsfehler::from)?;
        let kuerzel_neu = Some(anwendung.kuerzel.clone()).filter(|k| !k.is_empty());
        if alt.kuerzel != kuerzel_neu {
            return Err(mit_verweis(neu_text, format!("„{}“ und „{}“ nennen nicht dieselbe Anwendung — ein Paar ersetzt innerhalb einer Anwendung", crate::nachricht::wert(alt_text), crate::nachricht::wert(neu_text))));
        }
        for (text, schluessel) in [(alt_text, (alt.kuerzel.clone(), alt.hash.clone())), (neu_text, (kuerzel_neu.clone(), neu_hash.clone()))] {
            if gesehen.iter().any(|g| g.0 == schluessel.0 && (g.1.starts_with(&schluessel.1) || schluessel.1.starts_with(&g.1))) {
                return Err(mit_verweis(text, format!("„{}“ kommt im Aufruf mehr als einmal vor (als alt oder neu, auch eine Kette oder ein Tausch)", crate::nachricht::wert(text))));
            }
            gesehen.push(schluessel);
        }
        paare.push(Paar { alt_text: alt_text.into(), alt, neu_text: neu_text.into(), anwendung: anwendung.clone(), neu_hash });
    }
    Ok(paare)
}

/// `{alt, neu}` mit genau diesen beiden Schlüsseln, beide Texte.
fn paar_texte(eintrag: &serde_json::Value) -> Option<(&str, &str)> {
    let o = eintrag.as_object().filter(|o| o.len() == 2)?;
    Some((o.get("alt")?.as_str()?, o.get("neu")?.as_str()?))
}

fn mit_verweis(verweis: &str, meldung: String) -> Ersetzungsfehler {
    Ersetzungsfehler { meldung, verweis: Some(verweis.into()) }
}

impl From<Verweisfehler> for Ersetzungsfehler {
    fn from(f: Verweisfehler) -> Self {
        Ersetzungsfehler { meldung: f.meldung, verweis: Some(f.verweis) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::Quellen;

    const K1: &str = "3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e";

    /// Register mit `kd` und `xx`; mit `standard` dazu die Standardanwendung (sources.wbs).
    fn register(standard: bool) -> Anwendungen {
        let anwendung = |k: &str| Anwendung { kuerzel: k.into(), name: k.into(), repository: String::new(), wbs: format!("/{k}/app.md"), anforderungen: String::new() };
        let wbs = if standard { "/r/Dokumentation/Planung/app.md" } else { "" };
        Anwendungen::aus(&Quellen { repository: String::new(), wbs: wbs.into(), anforderungen: String::new(), anwendungen: vec![anwendung("kd"), anwendung("xx")] })
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

    // ---- Paare des Rumpfs (R00203 B0994): rein, ohne Git

    const K2: &str = "9c6b91f5d0e3a2b1c4d5e6f7a8b9c0d1e2f3a4b5";
    const K3: &str = "8e20ad9b3c5d7f1a2b4c6d8e0f1a3b5c7d9e1f2a";
    const K4: &str = "1d4c7e2a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e";

    fn paar(alt: &str, neu: &str) -> serde_json::Value {
        serde_json::json!({"alt": alt, "neu": neu})
    }

    fn rumpf(paare: &[serde_json::Value]) -> serde_json::Value {
        serde_json::json!({"ersetzungen": paare})
    }

    fn gelesen(rumpf: &serde_json::Value, standard: bool) -> Result<Vec<Paar>, Ersetzungsfehler> {
        ersetzungen_lesen(rumpf, &register(standard))
    }

    fn verweis(f: Ersetzungsfehler) -> Option<String> {
        assert!(!f.meldung.is_empty());
        f.verweis
    }

    // AK 1, AK 3: gültige Paare in der Reihenfolge der Anfrage; alt als Form, neu mit Anwendung und Hash, groß wird klein
    #[test]
    fn paare_in_reihenfolge_und_form() {
        let r = rumpf(&[paar(&format!("kd:{}", &K1[..7]), &format!("kd:{}", K3.to_uppercase())), paar(&format!("kd:{K2}"), &format!("kd:{}", &K4[..7]))]);
        let p = gelesen(&r, false).unwrap();
        assert_eq!(p.len(), 2);
        assert_eq!((p[0].alt.clone(), p[0].anwendung.kuerzel.as_str(), p[0].neu_hash.as_str()), (Verweisform { kuerzel: Some("kd".into()), hash: K1[..7].into() }, "kd", K3));
        assert_eq!((p[0].alt_text.as_str(), p[1].neu_hash.as_str(), p[1].alt.hash.as_str()), (format!("kd:{}", &K1[..7]).as_str(), &K4[..7], K2));
    }

    // AK 3: ohne Kürzel gilt die Standardanwendung — beide ohne Kürzel ist dasselbe, gemischt ist ein Fehler mit dem neu
    #[test]
    fn standardanwendung_und_kuerzel_muessen_zusammenpassen() {
        let p = gelesen(&rumpf(&[paar(&K1[..7], K3)]), true).unwrap();
        assert_eq!((p[0].alt.kuerzel.clone(), p[0].anwendung.kuerzel.as_str()), (None, ""));
        assert_eq!(verweis(gelesen(&rumpf(&[paar(&format!("kd:{}", &K2[..7]), K3)]), true).unwrap_err()).as_deref(), Some(K3), "alt mit Kürzel, neu ohne");
        assert_eq!(verweis(gelesen(&rumpf(&[paar(&K2[..7], &format!("kd:{K3}"))]), true).unwrap_err()).as_deref(), Some(format!("kd:{K3}").as_str()), "alt ohne Kürzel, neu mit");
        assert_eq!(verweis(gelesen(&rumpf(&[paar(&K2[..7], K3)]), false).unwrap_err()).as_deref(), Some(K3), "keine Standardanwendung");
        assert_eq!(verweis(gelesen(&rumpf(&[paar(&format!("kd:{K1}"), &format!("xx:{K3}"))]), true).unwrap_err()).as_deref(), Some(format!("xx:{K3}").as_str()), "zwei Anwendungen");
    }

    // AK 6: Rumpfform — kein Verweis zu nennen
    #[test]
    fn rumpfform() {
        let gut = paar(&format!("kd:{K1}"), &format!("kd:{K3}"));
        for r in [
            serde_json::json!({"ersetzungen": []}),
            serde_json::json!({"commits": [gut.clone()]}),
            serde_json::json!({"ersetzungen": "x"}),
            serde_json::json!({"ersetzungen": [gut.clone()], "x": 1}),
            serde_json::json!({"ersetzungen": [{"alt": "kd:3f2a9c1", "neu": "kd:8e20ad9", "x": 1}]}),
            serde_json::json!({"ersetzungen": [{"neu": "kd:8e20ad9"}]}),
            serde_json::json!({"ersetzungen": [{"alt": "kd:3f2a9c1"}]}),
            serde_json::json!({"ersetzungen": [{"alt": "kd:3f2a9c1", "neu": 5}]}),
            serde_json::json!({"ersetzungen": [{"alt": null, "neu": "kd:8e20ad9"}]}),
            serde_json::json!({"ersetzungen": [gut.clone(), "kd:3f2a9c1"]}),
            serde_json::json!({"ersetzungen": [gut.clone(), []]}),
            serde_json::json!([gut.clone()]),
            serde_json::json!("x"),
            serde_json::Value::Null,
        ] {
            assert_eq!(verweis(gelesen(&r, false).unwrap_err()), None, "{r}");
        }
    }

    // AK 6, AK 9: Form und Register von alt und neu — der Fehler trägt den Text aus der Anfrage
    #[test]
    fn form_und_register_von_alt_und_neu() {
        let schlecht = [format!("kd:{}", &K1[..6]), "kd:main".into(), "kd:HEAD".into(), "kd:3f2a9cg".into(), format!("xy:{K1}"), format!("kd:{}", "a".repeat(HASH_MAX + 1)), "kd:--output=x".into(), "kd:../x".into(), "kd:3f2a9c1;rm -rf x".into(), "kd:3f2a9c1 --all".into(), "kd:3f2a 9c1".into(), "kd:$(touch x)".into(), "kd:3f2a9c1^{tree}".into(), "kd:".into(), String::new()];
        let gut_alt = format!("kd:{K2}");
        let gut_neu = format!("kd:{K3}");
        for text in &schlecht {
            assert_eq!(verweis(gelesen(&rumpf(&[paar(&gut_alt, &gut_neu), paar(text, &format!("kd:{K4}"))]), false).unwrap_err()).as_deref(), Some(text.as_str()), "alt {text:?}");
            assert_eq!(verweis(gelesen(&rumpf(&[paar(&gut_alt, &gut_neu), paar(&format!("kd:{K1}"), text)]), false).unwrap_err()).as_deref(), Some(text.as_str()), "neu {text:?}");
        }
    }

    // AK 6: 7 Zeichen angenommen, 6 abgewiesen; 64 gültige Form, 65 nicht — für alt und für neu
    #[test]
    fn grenzen_der_hashlaenge() {
        let h = |n: usize| "a".repeat(n);
        assert!(gelesen(&rumpf(&[paar(&format!("kd:{}", h(7)), &format!("kd:{}", "b".repeat(64)))]), false).is_ok());
        assert!(gelesen(&rumpf(&[paar(&format!("kd:{}", h(64)), &format!("kd:{}", "b".repeat(7)))]), false).is_ok());
        for (alt, neu) in [(6, 7), (7, 6), (65, 7), (7, 65)] {
            assert!(gelesen(&rumpf(&[paar(&format!("kd:{}", h(alt)), &format!("kd:{}", "b".repeat(neu)))]), false).is_err(), "{alt}/{neu}");
        }
    }

    // AK 7: doppelt, Kette, Tausch, alt = neu — der Fehler nennt den zweiten Auftritt, auch Kurz- gegen Voll-Hash
    #[test]
    fn doppelt_kette_und_tausch() {
        let kd = |h: &str| format!("kd:{h}");
        let k = |h: &str| kd(&h[..7]);
        for (fall, paare, zweiter) in [
            ("alt doppelt", vec![paar(&kd(K1), &kd(K3)), paar(&kd(K1), &kd(K4))], kd(K1)),
            ("alt doppelt kurz/voll", vec![paar(&kd(K1), &kd(K3)), paar(&k(K1), &kd(K4))], k(K1)),
            ("alt doppelt voll/kurz", vec![paar(&k(K1), &kd(K3)), paar(&kd(K1), &kd(K4))], kd(K1)),
            ("neu doppelt", vec![paar(&kd(K1), &kd(K3)), paar(&kd(K2), &kd(K3))], kd(K3)),
            ("neu doppelt kurz/voll", vec![paar(&kd(K1), &k(K3)), paar(&kd(K2), &kd(K3))], kd(K3)),
            ("alt gleich neu", vec![paar(&kd(K1), &kd(K1))], kd(K1)),
            ("alt gleich neu kurz/voll", vec![paar(&kd(K1), &k(K1))], k(K1)),
            ("Kette", vec![paar(&kd(K1), &kd(K3)), paar(&kd(K3), &kd(K4))], kd(K3)),
            ("Kette rückwärts", vec![paar(&kd(K3), &kd(K4)), paar(&kd(K1), &kd(K3))], kd(K3)),
            ("Kette kurz/voll", vec![paar(&kd(K1), &k(K3)), paar(&kd(K3), &kd(K4))], kd(K3)),
            ("Tausch", vec![paar(&kd(K1), &kd(K2)), paar(&kd(K2), &kd(K1))], kd(K2)),
        ] {
            assert_eq!(verweis(gelesen(&rumpf(&paare), false).unwrap_err()), Some(zweiter), "{fall}");
        }
        // dieselbe Hash-Zeichenfolge in verschiedenen Anwendungen ist nicht doppelt
        assert!(gelesen(&rumpf(&[paar(&kd(K1), &kd(K3)), paar(&format!("xx:{K1}"), &format!("xx:{K3}"))]), false).is_ok());
        assert!(gelesen(&rumpf(&[paar(&kd(K1), &kd(K3)), paar(K2, K4)]), true).is_ok(), "ohne Kürzel ist eine andere Anwendung als kd");
    }

    // AK 7: genau 500 Paare gelten, 501 nicht — ohne Verweis, und bevor ein Paar gelesen wird
    #[test]
    fn hoechstens_500_paare() {
        let paare = |n: usize| (0..n).map(|i| paar(&format!("kd:{i:040x}"), &format!("kd:{:040x}", i + 10_000))).collect::<Vec<_>>();
        assert_eq!(gelesen(&rumpf(&paare(HOECHSTZAHL_PAARE)), false).unwrap().len(), 500);
        let f = gelesen(&rumpf(&paare(HOECHSTZAHL_PAARE + 1)), false).unwrap_err();
        assert!(f.meldung.contains("501") && f.meldung.contains("500"), "{}", f.meldung);
        assert_eq!(f.verweis, None);
        let mut schlecht = paare(HOECHSTZAHL_PAARE + 1);
        schlecht[0] = serde_json::json!("kein Paar");
        assert!(gelesen(&rumpf(&schlecht), false).unwrap_err().meldung.contains("501"), "die Zahl wird zuerst geprüft");
    }
}
