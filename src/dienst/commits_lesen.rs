//! Commit-Liste einer Karte lesen (R00204, ADR-0032 Punkt 5 mit N1.2, N1.3, N3) — live aus den Arbeits-Repositories des
//! Registers, nur lesend und ohne die Sperre des Board-Ordners.

use crate::modell::{Anwendung, Anwendungen, Commiteintrag, Verweisform, Zustand, verweis_lesen};

/// Ein Verweis, der Git erreichen darf: Form gültig, Anwendung registriert.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Gelesen<'a> {
    anwendung: &'a Anwendung,
    hash: String,
}

/// Ohne Git: Form, dann Register (ADR-0032 N1.2, Reihenfolge `unlesbar`, `anwendung_unbekannt`). Ein Eintrag, der hier
/// scheitert, erreicht Git nie.
fn einordnen<'a>(text: &str, anwendungen: &'a Anwendungen) -> Result<Gelesen<'a>, Commiteintrag> {
    let form = Verweisform::lesen(text).map_err(|f| Commiteintrag { grund: Some(f.meldung), ..Commiteintrag::neu(text, Zustand::Unlesbar) })?;
    match verweis_lesen(text, anwendungen) {
        Ok((anwendung, hash)) => Ok(Gelesen { anwendung, hash }),
        Err(_) => Err(Commiteintrag { anwendung: Some(form.kuerzel.unwrap_or_default()), hash: Some(form.hash), ..Commiteintrag::neu(text, Zustand::AnwendungUnbekannt) }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::Quellen;

    const K1: &str = "3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e";

    fn register(standard: bool) -> Anwendungen {
        let kd = Anwendung { kuerzel: "kd".into(), name: "KD".into(), wbs: "/r/app.md".into(), anforderungen: String::new() };
        Anwendungen::aus(&Quellen { wbs: if standard { "/s/app.md".into() } else { String::new() }, anforderungen: String::new(), anwendungen: vec![kd] })
    }

    // R00204 AK 12: was die Form verletzt, ist `unlesbar` mit Grund und dem Verweis wörtlich — auch bei fremdem Kürzel
    #[test]
    fn form_verletzt_ist_unlesbar() {
        let r = register(true);
        for text in ["kd:--output=x", "kd:../x", "kd:3f2a9c1;rm -rf x", "kd:3f2a9c1 --all", "kd:3f2a 9c1", "kd:$(touch x)", &format!("kd:{K1}^{{tree}}"), &format!("kd:{K1} "), &format!("kd:{K1}\n{K1}"), &format!("kd:{K1}\u{0}"), "xy:--x", ""] {
            let e = einordnen(text, &r).unwrap_err();
            assert_eq!((e.verweis.as_str(), e.zustand), (text, Zustand::Unlesbar), "{text:?}");
            assert!(e.grund.as_deref().is_some_and(|g| !g.is_empty()), "{text:?}");
            assert_eq!((e.anwendung, e.hash), (None, None), "{text:?}");
        }
    }

    // R00204 AK 4: nicht registriertes Kürzel und Verweis ohne Kürzel ohne Standardanwendung → `anwendung_unbekannt`
    #[test]
    fn register_unbekannt() {
        let e = einordnen(&format!("xy:{K1}"), &register(true)).unwrap_err();
        assert_eq!((e.zustand, e.anwendung.as_deref(), e.hash.as_deref()), (Zustand::AnwendungUnbekannt, Some("xy"), Some(K1)));
        let e = einordnen(&K1.to_uppercase(), &register(false)).unwrap_err();
        assert_eq!((e.zustand, e.anwendung.as_deref(), e.hash.as_deref()), (Zustand::AnwendungUnbekannt, Some(""), Some(K1)));
        let (mit, ohne) = (register(true), register(false));
        let g = einordnen(K1, &mit).unwrap();
        assert_eq!((g.anwendung.kuerzel.as_str(), g.hash.as_str()), ("", K1), "mit Standardanwendung");
        let g = einordnen(&format!("kd:{}", K1.to_uppercase()), &ohne).unwrap();
        assert_eq!((g.anwendung.kuerzel.as_str(), g.hash.as_str()), ("kd", K1), "Hash kleingeschrieben");
    }
}
