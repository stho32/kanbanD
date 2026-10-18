//! Register der Anwendungen und qualifizierte Herkunft (`kd:I0007`) — rein, ohne Dateizugriff.

use super::{Anwendung, Quellen, kuerzel_gueltig};

/// WBS-Knoten (`I0007`, auch A/D/F/B) oder Anforderung (`R00014`).
pub fn id_gueltig(id: &str) -> bool {
    let b = id.as_bytes();
    (b.len() == 5 && b"ADIFB".contains(&b[0]) && b[1..].iter().all(u8::is_ascii_digit)) || (b.len() == 6 && b[0] == b'R' && b[1..].iter().all(u8::is_ascii_digit))
}

/// Eine Herkunft zerlegt: `kd:I0007` → Kürzel `kd`, ID `I0007`; `I0007` ohne Kürzel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Herkunftsschluessel {
    pub kuerzel: Option<String>,
    pub id: String,
}

impl Herkunftsschluessel {
    pub fn lesen(herkunft: &str) -> Option<Herkunftsschluessel> {
        let (kuerzel, id) = match herkunft.split_once(':') {
            Some((k, id)) => (Some(k), id),
            None => (None, herkunft),
        };
        if !id_gueltig(id) || kuerzel.is_some_and(|k| !kuerzel_gueltig(k)) {
            return None;
        }
        Some(Herkunftsschluessel { kuerzel: kuerzel.map(String::from), id: id.into() })
    }

    /// Schreibweise mit Kürzel; die Standardanwendung (Kürzel leer) schreibt die ID allein.
    pub fn qualifiziert(kuerzel: &str, id: &str) -> String {
        if kuerzel.is_empty() { id.to_string() } else { format!("{kuerzel}:{id}") }
    }
}

/// Alle Anwendungen des Ordners: das Register und — falls Pfade gesetzt sind — die Standardanwendung mit leerem Kürzel.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Anwendungen(Vec<Anwendung>);

impl Anwendungen {
    pub fn aus(quellen: &Quellen) -> Anwendungen {
        let mut alle = vec![];
        if !quellen.wbs.is_empty() || !quellen.anforderungen.is_empty() {
            alle.push(Anwendung { kuerzel: String::new(), name: String::new(), wbs: quellen.wbs.clone(), anforderungen: quellen.anforderungen.clone() });
        }
        alle.extend(quellen.anwendungen.iter().cloned());
        Anwendungen(alle)
    }

    pub fn registriert(&self, kuerzel: &str) -> bool {
        !kuerzel.is_empty() && self.0.iter().any(|a| a.kuerzel == kuerzel)
    }

    pub fn alle(&self) -> &[Anwendung] {
        &self.0
    }

    /// Zu welcher Anwendung eine Herkunft gehört. Ohne Kürzel nur, wenn es genau eine Anwendung gibt.
    pub fn aufloesen(&self, herkunft: &str) -> Aufloesung<'_> {
        let Some(s) = Herkunftsschluessel::lesen(herkunft) else { return Aufloesung::Unbekannt };
        match (s.kuerzel, self.0.as_slice()) {
            (Some(k), _) => self.0.iter().find(|a| a.kuerzel == k).map_or(Aufloesung::Unbekannt, |a| Aufloesung::Eindeutig(a, s.id)),
            (None, [einzige]) => Aufloesung::Eindeutig(einzige, s.id),
            (None, []) => Aufloesung::Unbekannt,
            (None, _) => Aufloesung::Mehrdeutig,
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum Aufloesung<'a> {
    /// Anwendung und ID ohne Kürzel
    Eindeutig(&'a Anwendung, String),
    Mehrdeutig,
    Unbekannt,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn quellen(wbs: &str, kuerzel: &[&str]) -> Quellen {
        let anwendungen = kuerzel.iter().map(|k| Anwendung { kuerzel: k.to_string(), name: k.to_uppercase(), wbs: format!("/{k}/plan.md"), anforderungen: String::new() }).collect();
        Quellen { wbs: wbs.into(), anforderungen: String::new(), anwendungen }
    }

    #[test]
    fn schluessel_lesen() {
        assert_eq!(Herkunftsschluessel::lesen("kd:I0007"), Some(Herkunftsschluessel { kuerzel: Some("kd".into()), id: "I0007".into() }));
        assert_eq!(Herkunftsschluessel::lesen("R00014"), Some(Herkunftsschluessel { kuerzel: None, id: "R00014".into() }));
        for falsch in ["KD!:I0007", ":I0007", "kd:", "kd:X1", "kd:I0007:x", "thin air", "i0007", "neunzeich:I0001"] {
            assert_eq!(Herkunftsschluessel::lesen(falsch), None, "{falsch}");
        }
        assert_eq!(Herkunftsschluessel::qualifiziert("kd", "I0007"), "kd:I0007");
        assert_eq!(Herkunftsschluessel::qualifiziert("", "I0007"), "I0007");
    }

    #[test]
    fn aufloesen_eindeutig_mehrdeutig_unbekannt() {
        let zwei = Anwendungen::aus(&quellen("", &["kc", "kd"]));
        let kd = &zwei.alle()[1];
        assert_eq!(zwei.aufloesen("kd:I0007"), Aufloesung::Eindeutig(kd, "I0007".into()));
        assert_eq!(zwei.aufloesen("I0007"), Aufloesung::Mehrdeutig);
        assert_eq!(zwei.aufloesen("xx:I0007"), Aufloesung::Unbekannt);
        assert_eq!(zwei.aufloesen("thin air"), Aufloesung::Unbekannt);
        let eine = Anwendungen::aus(&quellen("", &["kd"]));
        assert_eq!(eine.aufloesen("R00014"), Aufloesung::Eindeutig(&eine.alle()[0], "R00014".into()));
        let standard = Anwendungen::aus(&quellen("plan.md", &[]));
        assert_eq!(standard.aufloesen("I0007"), Aufloesung::Eindeutig(&standard.alle()[0], "I0007".into()));
        assert_eq!(Anwendungen::aus(&quellen("plan.md", &["kd"])).aufloesen("I0007"), Aufloesung::Mehrdeutig, "Standard und Register zusammen sind zwei");
        assert_eq!(Anwendungen::aus(&quellen("", &[])).aufloesen("I0007"), Aufloesung::Unbekannt);
    }

    #[test]
    fn standardanwendung_nur_mit_pfaden_und_registrierte_kuerzel() {
        let a = Anwendungen::aus(&quellen("plan/wbs.md", &["kd"]));
        assert_eq!(a.alle().iter().map(|x| x.kuerzel.as_str()).collect::<Vec<_>>(), vec!["", "kd"]);
        assert!(a.registriert("kd") && !a.registriert("xx") && !a.registriert(""));
        assert_eq!(Anwendungen::aus(&quellen("", &[])).alle().len(), 0);
    }
}
