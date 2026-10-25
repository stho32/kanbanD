use super::Kanban;
use crate::fehler::Fehler;
use crate::format::einstellungen;
use crate::modell::{Anwendung, Art, Einstellungen, Person, SIGNAL_FAELLIG, Signal, kuerzel_gueltig};

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
    signale_pruefen(&neu.signale)?;
    register_pruefen(&neu.quellen.anwendungen)
}

/// Signale (R00076): Schlüssel wie Klassen, nicht `due` (gerechnet), mit Bedeutung und Farbe, eindeutig.
fn signale_pruefen(signale: &[Signal]) -> Result<(), Fehler> {
    let mut gesehen: Vec<&str> = vec![];
    for g in signale {
        if !schluessel_gueltig(&g.schluessel) {
            return Err(Fehler::Ungueltig(format!("Signalschlüssel „{}“: Kleinbuchstaben, Ziffern, - und _", g.schluessel)));
        }
        if g.schluessel == SIGNAL_FAELLIG {
            return Err(Fehler::Ungueltig(format!("„{SIGNAL_FAELLIG}“ ist das Signal der Fälligkeit und wird gerechnet")));
        }
        if g.bezeichnung.trim().is_empty() {
            return Err(Fehler::Ungueltig(format!("Signal „{}“ braucht eine Bedeutung", g.schluessel)));
        }
        if !farbe_gueltig(&g.farbe) {
            return Err(Fehler::Ungueltig(format!("Farbe „{}“: einer der 16 Palettennamen oder #rrggbb", g.farbe)));
        }
        if gesehen.contains(&g.schluessel.as_str()) {
            return Err(Fehler::Ungueltig(format!("Signal „{}“ ist doppelt", g.schluessel)));
        }
        gesehen.push(&g.schluessel);
    }
    Ok(())
}

/// Kürzel nach den Regeln der Personenkürzel, eindeutig; jede Anwendung hat einen Namen.
fn register_pruefen(anwendungen: &[Anwendung]) -> Result<(), Fehler> {
    let mut gesehen: Vec<&str> = vec![];
    for a in anwendungen {
        if !kuerzel_gueltig(&a.kuerzel) {
            return Err(Fehler::Ungueltig(format!("Anwendungskürzel „{}“: 1–8 Kleinbuchstaben oder Ziffern", a.kuerzel)));
        }
        if a.name.trim().is_empty() {
            return Err(Fehler::Ungueltig(format!("Für die Anwendung „{}“ fehlt der Name", a.kuerzel)));
        }
        if gesehen.contains(&a.kuerzel.as_str()) {
            return Err(Fehler::Ungueltig(format!("Anwendungskürzel „{}“ ist doppelt", a.kuerzel)));
        }
        gesehen.push(&a.kuerzel);
    }
    Ok(())
}

/// Rumpf von `POST /api/personen` (R00091); ohne `aktiv` ist die Person aktiv.
#[derive(Debug, Clone, serde::Deserialize, utoipa::ToSchema)]
pub struct Personenangabe {
    /// 1–8 Kleinbuchstaben oder Ziffern
    pub kuerzel: String,
    pub name: String,
    pub art: Art,
    pub aktiv: Option<bool>,
}

/// Rumpf von `PATCH /api/personen/{kürzel}`: nur genannte Felder ändern sich.
#[derive(Debug, Clone, Default, serde::Deserialize, utoipa::ToSchema)]
pub struct PersonAenderung {
    pub name: Option<String>,
    pub art: Option<Art>,
    pub aktiv: Option<bool>,
}

impl PersonAenderung {
    /// Wendet die genannten Felder an; liefert, ob sich etwas geändert hat.
    pub fn anwenden(&self, p: &mut Person) -> bool {
        let vorher = p.clone();
        if let Some(n) = &self.name {
            p.name = n.trim().into();
        }
        if let Some(a) = self.art {
            p.art = a;
        }
        if let Some(a) = self.aktiv {
            p.aktiv = a;
        }
        *p != vorher
    }
}

/// Bezeichnungen und Pfade ohne Rand, Register nach Kürzel — die Normalform, in der verglichen und geschrieben wird.
fn normalisieren(neu: &mut Einstellungen) {
    for p in &mut neu.personen {
        p.name = p.name.trim().into();
    }
    for k in &mut neu.klassen {
        k.bezeichnung = k.bezeichnung.trim().into();
    }
    for g in &mut neu.signale {
        g.bezeichnung = g.bezeichnung.trim().into();
    }
    neu.quellen.wbs = neu.quellen.wbs.trim().into();
    neu.quellen.anforderungen = neu.quellen.anforderungen.trim().into();
    for a in &mut neu.quellen.anwendungen {
        a.name = a.name.trim().into();
        a.wbs = a.wbs.trim().into();
        a.anforderungen = a.anforderungen.trim().into();
    }
    neu.quellen.anwendungen.sort_by(|a, b| a.kuerzel.cmp(&b.kuerzel));
}

impl Kanban {
    /// Der eine Schreibweg der Einstellungen: unter der Sperre lesen, `aendern` anwenden, normalisieren, prüfen und
    /// nur bei einer Änderung committen. `aendern` liefert die Commit-Nachricht und ein Ergebnis.
    fn einstellungen_aendern<T>(&self, wer: &Person, aendern: impl FnOnce(&mut Einstellungen) -> Result<(String, T), Fehler>) -> Result<(bool, T), Fehler> {
        let _sperre = self.gesperrt();
        let alt = self.ordner().einstellungen()?.ok_or_else(|| Fehler::Konflikt("Der Ordner ist noch nicht eingerichtet".into()))?;
        let mut neu = alt.clone();
        let (nachricht, ergebnis) = aendern(&mut neu)?;
        normalisieren(&mut neu);
        einstellungen_pruefen(&alt, &neu)?;
        if neu == alt {
            return Ok((false, ergebnis));
        }
        self.aktion(wer, &nachricht, &[(einstellungen::DATEI.into(), einstellungen::schreiben(&neu))])?;
        Ok((true, ergebnis))
    }

    pub fn einstellungen_setzen(&self, wer: &Person, neu: Einstellungen) -> Result<bool, Fehler> {
        self.einstellungen_aendern(wer, |e| {
            *e = neu;
            Ok(("Einstellungen geändert".into(), ()))
        })
        .map(|(geaendert, ())| geaendert)
    }

    /// Eine Person anlegen (R00091); ein vorhandenes Kürzel ist ein Konflikt, die Regeln prüft `einstellungen_pruefen`.
    pub fn person_anlegen(&self, wer: &Person, n: &Personenangabe) -> Result<Person, Fehler> {
        let p = Person { kuerzel: n.kuerzel.trim().into(), name: n.name.trim().into(), art: n.art, aktiv: n.aktiv.unwrap_or(true) };
        let (_, p) = self.einstellungen_aendern(wer, |e| {
            if e.person(&p.kuerzel).is_some() {
                return Err(Fehler::Konflikt(format!("Kürzel „{}“ gibt es schon", p.kuerzel)));
            }
            e.personen.push(p.clone());
            Ok((format!("Person „{}“ ({}) angelegt", p.name, p.kuerzel), p))
        })?;
        Ok(p)
    }

    /// Name, Art oder aktiv einer Person ändern; unbekannt → 404.
    pub fn person_aendern(&self, wer: &Person, kuerzel: &str, a: &PersonAenderung) -> Result<Person, Fehler> {
        let (_, p) = self.einstellungen_aendern(wer, |e| {
            let p = e.personen.iter_mut().find(|p| p.kuerzel == kuerzel).ok_or_else(|| Fehler::NichtGefunden(format!("Person „{kuerzel}“ steht nicht in kanbanD.md")))?;
            let tat = if a.aktiv == Some(false) && p.aktiv { "stillgelegt" } else { "geändert" };
            a.anwenden(p);
            Ok((format!("Person „{}“ ({kuerzel}) {tat}", p.name), p.clone()))
        })?;
        Ok(p)
    }
}

#[cfg(test)]
mod tests_person {
    use super::*;

    #[test]
    fn personaenderung_aendert_nur_genannte_felder() {
        let mut p = Person { kuerzel: "crev".into(), name: "Code-Reviewer".into(), art: Art::Agent, aktiv: true };
        assert!(PersonAenderung { name: Some(" Reviewer ".into()), ..Default::default() }.anwenden(&mut p));
        assert_eq!((p.name.as_str(), p.art, p.aktiv), ("Reviewer", Art::Agent, true));
        assert!(!PersonAenderung { name: Some("Reviewer".into()), ..Default::default() }.anwenden(&mut p), "gleicher Wert ist keine Änderung");
        assert!(PersonAenderung { aktiv: Some(false), ..Default::default() }.anwenden(&mut p));
        assert!(!p.aktiv);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::{Anwendung, Art, Klasse};

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

    fn anwendung(k: &str, name: &str) -> Anwendung {
        Anwendung { kuerzel: k.into(), name: name.into(), wbs: "/a/plan.md".into(), anforderungen: "".into() }
    }

    #[test]
    fn regeln_fuer_das_register() {
        let alt = Einstellungen::default();
        let mut e = Einstellungen::default();
        e.quellen.anwendungen = vec![anwendung("kd", "kanbanD"), anwendung("k2", "Kasse")];
        assert!(einstellungen_pruefen(&alt, &e).is_ok());
        for (k, name) in [("KD!", "x"), ("", "x"), ("neunzeich", "x"), ("kd", " ")] {
            let mut f = e.clone();
            f.quellen.anwendungen[0] = anwendung(k, name);
            assert!(matches!(einstellungen_pruefen(&alt, &f), Err(Fehler::Ungueltig(_))), "{k}/{name}");
        }
        let mut f = e;
        f.quellen.anwendungen[1].kuerzel = "kd".into();
        assert!(einstellungen_pruefen(&alt, &f).unwrap_err().meldung().contains("doppelt"));
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
