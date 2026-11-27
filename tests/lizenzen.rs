//! R00263 AK 5 (B1435, Probe P2): Die committete `web/LIZENZEN.md` ist offline gegen
//! `Cargo.lock` vollständig und hat je enthaltenem Paket die vier Felder.
//!
//! Der Test liest `Cargo.lock` und die Hinweisdatei als Text — ohne Server, ohne Netz,
//! ohne `cargo metadata`. Er parst die Hinweisdatei mit eigener Hand, damit er die
//! Erzeugung nicht mit deren eigenem Code prüft.
//!
//! Hinweis zur Positivkontrolle: AK 2, P2c und M3 nennen `tower` als dev-Abhängigkeit,
//! die fehlen soll. `tower 0.5.3` ist aber eine **normale** Abhängigkeit von `axum`
//! (`cargo metadata`: kind=normal, optional=false; `cargo tree -e normal -i tower`),
//! liegt also im Release-Binary und gehört in die Hinweise. Geprüft werden hier daher
//! die dev-**only**-Pakete `tempfile` und `reqwest`; der Widerspruch steht im Bericht.

use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;

fn lies(rel: &str) -> String {
    std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join(rel)).unwrap()
}

/// Alle (Name, Version) aus `Cargo.lock`.
fn lock_pakete(text: &str) -> BTreeSet<(String, String)> {
    let mut pakete = BTreeSet::new();
    let mut name: Option<String> = None;
    let mut version: Option<String> = None;
    let mut im_paket = false;
    for zeile in text.lines() {
        let z = zeile.trim();
        if z == "[[package]]" {
            if let (Some(n), Some(v)) = (name.take(), version.take()) {
                pakete.insert((n, v));
            }
            im_paket = true;
            continue;
        }
        if !im_paket {
            continue;
        }
        if let Some(rest) = z.strip_prefix("name = ") {
            name = Some(rest.trim_matches('"').to_string());
        } else if let Some(rest) = z.strip_prefix("version = ") {
            version = Some(rest.trim_matches('"').to_string());
        }
    }
    if let (Some(n), Some(v)) = (name.take(), version.take()) {
        pakete.insert((n, v));
    }
    pakete
}

struct Gelesen {
    /// `(Name, Version, Lizenz, hat_Urhebertext)`.
    enthalten: Vec<(String, String, String, bool)>,
    /// `(Name, Version) -> Grund`.
    ausnahmen: BTreeMap<(String, String), String>,
}

/// Parst die Abschnitte „Enthaltene Pakete“ und „Ausgenommene Pakete“ der Hinweisdatei.
fn lizenzdatei(text: &str) -> Gelesen {
    let mut enthalten = Vec::new();
    let mut ausnahmen = BTreeMap::new();
    let mut abschnitt = "";

    for zeile in text.lines() {
        if zeile.starts_with("## Enthaltene Pakete") {
            abschnitt = "enthalten";
            continue;
        }
        if zeile.starts_with("## Ausgenommene Pakete") {
            abschnitt = "ausgenommen";
            continue;
        }

        if abschnitt == "ausgenommen" {
            if let Some(rest) = zeile.strip_prefix("| ") {
                let felder: Vec<&str> = rest.split('|').map(str::trim).collect();
                if felder.len() >= 4 && !felder[0].is_empty() && felder[0] != "Paket" && !felder[0].starts_with("---") {
                    ausnahmen.insert((felder[0].to_string(), felder[1].to_string()), felder[2].to_string());
                }
            }
            continue;
        }

        if abschnitt == "enthalten" {
            if let Some(kopf) = zeile.strip_prefix("### ") {
                let teile: Vec<&str> = kopf.split_whitespace().collect();
                if teile.len() == 2 {
                    enthalten.push((teile[0].to_string(), teile[1].to_string(), String::new(), false));
                }
                continue;
            }
            if let Some(eintrag) = enthalten.last_mut() {
                if let Some(lizenz) = zeile.strip_prefix("Lizenz: ") {
                    eintrag.2 = lizenz.trim().to_string();
                } else if zeile.trim() == "Urhebertext:" {
                    eintrag.3 = false;
                } else if !zeile.trim().is_empty() && !eintrag.2.is_empty() {
                    eintrag.3 = true;
                }
            }
        }
    }
    Gelesen { enthalten, ausnahmen }
}

#[test]
fn menge_aus_cargo_lock_ist_enthalten_vereinigt_ausnahmen() {
    let lock = lock_pakete(&lies("Cargo.lock"));
    let gelesen = lizenzdatei(&lies("web/LIZENZEN.md"));

    let enthalten: BTreeSet<(String, String)> =
        gelesen.enthalten.iter().map(|(n, v, _, _)| (n.clone(), v.clone())).collect();
    let ausnahmen: BTreeSet<(String, String)> = gelesen.ausnahmen.keys().cloned().collect();
    assert!(enthalten.is_disjoint(&ausnahmen), "kein Paket steht in beiden Mengen");

    let vereinigt: BTreeSet<(String, String)> = enthalten.union(&ausnahmen).cloned().collect();
    let fehlen: Vec<_> = lock.difference(&vereinigt).collect();
    let zuviel: Vec<_> = vereinigt.difference(&lock).collect();
    assert!(fehlen.is_empty(), "in keiner Menge, aber in Cargo.lock: {fehlen:?}");
    assert!(zuviel.is_empty(), "in keiner Cargo.lock: {zuviel:?}");
}

#[test]
fn jede_ausnahme_hat_einen_grund_aus_der_liste() {
    let gelesen = lizenzdatei(&lies("web/LIZENZEN.md"));
    let erlaubt = ["dev", "build", "plattformfremd", "workspace"];
    let falsch: Vec<_> =
        gelesen.ausnahmen.iter().filter(|(_, g)| !erlaubt.contains(&g.as_str())).collect();
    assert!(falsch.is_empty(), "unbekannte Gründe: {falsch:?}");
}

#[test]
fn je_enthaltenem_paket_vier_felder() {
    let gelesen = lizenzdatei(&lies("web/LIZENZEN.md"));
    assert!(gelesen.enthalten.len() > 50, "die Datei ist nicht leer: {} Pakete", gelesen.enthalten.len());
    let ohne: Vec<String> = gelesen
        .enthalten
        .iter()
        .filter(|(_, _, lizenz, text)| lizenz.is_empty() || !text)
        .map(|(n, v, _, _)| format!("{n} {v}"))
        .collect();
    assert!(ohne.is_empty(), "ohne Lizenz oder Urhebertext: {ohne:?}");
}

#[test]
fn dev_only_pakete_sind_nicht_enthalten() {
    let gelesen = lizenzdatei(&lies("web/LIZENZEN.md"));
    for name in ["tempfile", "reqwest"] {
        assert!(
            !gelesen.enthalten.iter().any(|(n, _, _, _)| n == name),
            "{name} ist dev-only und darf nicht enthalten sein"
        );
        assert!(
            gelesen.ausnahmen.keys().any(|(n, _)| n == name),
            "{name} muss mit Grund in den Ausnahmen stehen"
        );
    }
}
