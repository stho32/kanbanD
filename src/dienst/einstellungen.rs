use super::Kanban;
use crate::fehler::Fehler;
use crate::format::einstellungen;
use crate::modell::{Einstellungen, Person, kuerzel_gueltig};

pub const PALETTE: [&str; 16] = ["yellow", "amber", "orange", "red", "rose", "pink", "magenta", "violet", "indigo", "blue", "sky", "cyan", "teal", "green", "lime", "grey"];

/// Palettenname oder `#rrggbb`.
pub fn farbe_gueltig(f: &str) -> bool {
    PALETTE.contains(&f) || (f.len() == 7 && f.starts_with('#') && f[1..].chars().all(|c| c.is_ascii_hexdigit()))
}

fn schluessel_gueltig(s: &str) -> bool {
    !s.is_empty() && s.len() <= 24 && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

/// Regeln für neue Einstellungen gegenüber den bisherigen.
pub fn einstellungen_pruefen(alt: &Einstellungen, neu: &Einstellungen) -> Result<(), Fehler> {
    let mut gesehen: Vec<&str> = vec![];
    for p in &neu.personen {
        if !kuerzel_gueltig(&p.kuerzel) {
            return Err(Fehler::Ungueltig(format!("Kürzel „{}“: 1–8 Kleinbuchstaben oder Ziffern", p.kuerzel)));
        }
        if p.name.trim().is_empty() {
            return Err(Fehler::Ungueltig(format!("Für „{}“ fehlt der Name", p.kuerzel)));
        }
        if gesehen.contains(&p.kuerzel.as_str()) {
            return Err(Fehler::Ungueltig(format!("Kürzel „{}“ ist doppelt", p.kuerzel)));
        }
        gesehen.push(&p.kuerzel);
    }
    if let Some(weg) = alt.personen.iter().find(|p| !gesehen.contains(&p.kuerzel.as_str())) {
        return Err(Fehler::Konflikt(format!("„{}“ wird stillgelegt, nicht entfernt", weg.name)));
    }
    let mut klassen: Vec<&str> = vec![];
    for k in &neu.klassen {
        if !schluessel_gueltig(&k.schluessel) {
            return Err(Fehler::Ungueltig(format!("Klassenschlüssel „{}“: Kleinbuchstaben, Ziffern, - und _", k.schluessel)));
        }
        if k.bezeichnung.trim().is_empty() {
            return Err(Fehler::Ungueltig(format!("Klasse „{}“ braucht eine Bezeichnung", k.schluessel)));
        }
        if !farbe_gueltig(&k.farbe) {
            return Err(Fehler::Ungueltig(format!("Farbe „{}“: einer der 16 Palettennamen oder #rrggbb", k.farbe)));
        }
        if klassen.contains(&k.schluessel.as_str()) {
            return Err(Fehler::Ungueltig(format!("Klasse „{}“ ist doppelt", k.schluessel)));
        }
        klassen.push(&k.schluessel);
    }
    Ok(())
}

impl Kanban {
    pub fn einstellungen_setzen(&self, wer: &Person, mut neu: Einstellungen) -> Result<bool, Fehler> {
        let _sperre = self.gesperrt();
        let alt = self.ordner().einstellungen()?.ok_or_else(|| Fehler::Konflikt("Der Ordner ist noch nicht eingerichtet".into()))?;
        for p in &mut neu.personen {
            p.name = p.name.trim().into();
        }
        for k in &mut neu.klassen {
            k.bezeichnung = k.bezeichnung.trim().into();
        }
        neu.quellen.wbs = neu.quellen.wbs.trim().into();
        neu.quellen.anforderungen = neu.quellen.anforderungen.trim().into();
        einstellungen_pruefen(&alt, &neu)?;
        if neu == alt {
            return Ok(false);
        }
        self.aktion(wer, "Einstellungen geändert", &[(einstellungen::DATEI.into(), einstellungen::schreiben(&neu))])?;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::{Art, Klasse};

    fn p(k: &str) -> Person {
        Person { kuerzel: k.into(), name: k.to_uppercase(), art: Art::Mensch, aktiv: true }
    }

    #[test]
    fn farben() {
        assert!(farbe_gueltig("teal"));
        assert!(farbe_gueltig("#B04a8c"));
        assert!(!farbe_gueltig("lila"));
        assert!(!farbe_gueltig("#12345"));
        assert!(!farbe_gueltig("#12345g"));
    }

    #[test]
    fn regeln() {
        let alt = Einstellungen { personen: vec![p("st")], ..Default::default() };
        let gut = Einstellungen { personen: vec![p("st"), p("mi")], klassen: vec![Klasse { schluessel: "doku_1".into(), bezeichnung: "Doku".into(), farbe: "teal".into() }], ..Default::default() };
        assert!(einstellungen_pruefen(&alt, &gut).is_ok());
        let mut f = gut.clone();
        f.personen.remove(0);
        assert!(matches!(einstellungen_pruefen(&alt, &f), Err(Fehler::Konflikt(_))));
        let mut f = gut.clone();
        f.personen[1].kuerzel = "M!".into();
        assert!(einstellungen_pruefen(&alt, &f).is_err());
        let mut f = gut.clone();
        f.personen[1].name = " ".into();
        assert!(einstellungen_pruefen(&alt, &f).is_err());
        let mut f = gut.clone();
        f.personen.push(p("mi"));
        assert!(einstellungen_pruefen(&alt, &f).is_err());
        let mut f = gut.clone();
        f.klassen[0].farbe = "lila".into();
        assert!(einstellungen_pruefen(&alt, &f).is_err());
        let mut f = gut.clone();
        f.klassen.push(f.klassen[0].clone());
        assert!(einstellungen_pruefen(&alt, &f).is_err());
        let mut f = gut.clone();
        f.klassen[0].schluessel = "Doku".into();
        assert!(einstellungen_pruefen(&alt, &f).is_err());
        let mut f = gut;
        f.klassen[0].bezeichnung = "".into();
        assert!(einstellungen_pruefen(&alt, &f).is_err());
    }
}
