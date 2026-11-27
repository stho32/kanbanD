use super::{Kanban, Schritt};
use super::zugregeln::personen_pruefen;
use crate::fehler::Fehler;
use std::sync::MutexGuard;
use crate::format::einstellungen;
use crate::modell::{Anwendung, Art, Einstellungen, Klasse, Person, SIGNAL_FAELLIG, Signal, kuerzel_gueltig};

pub const PALETTE: [&str; 16] = ["yellow", "amber", "orange", "red", "rose", "pink", "magenta", "violet", "indigo", "blue", "sky", "cyan", "teal", "green", "lime", "grey"];

/// Palettenname oder `#rrggbb`.
pub fn farbe_gueltig(f: &str) -> bool {
    PALETTE.contains(&f) || (f.len() == 7 && f.starts_with('#') && f[1..].chars().all(|c| c.is_ascii_hexdigit()))
}

fn schluessel_gueltig(s: &str) -> bool {
    !s.is_empty() && s.len() <= 24 && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
}

/// Ein Klassensatz — der des Ordners oder der eines Boards (ADR-0031 Regel 1): Schlüssel, Bezeichnung, Farbe, keine Dopplung.
pub fn klassen_pruefen(klassen: &[Klasse]) -> Result<(), Fehler> {
    let mut gesehen: Vec<&str> = vec![];
    for k in klassen {
        if !schluessel_gueltig(&k.schluessel) {
            return Err(Fehler::ungueltig_mit_wert("Klassenschlüssel „", &k.schluessel, "“: Kleinbuchstaben, Ziffern, - und _"));
        }
        if k.bezeichnung.trim().is_empty() {
            return Err(Fehler::ungueltig_mit_wert("Klasse „", &k.schluessel, "“ braucht eine Bezeichnung"));
        }
        if !farbe_gueltig(&k.farbe) {
            return Err(Fehler::ungueltig_mit_inhalt(format!("Farbe „{}“: einer der 16 Palettennamen oder #rrggbb", k.farbe), format!("Farbe „{}“: einer der 16 Palettennamen oder #rrggbb", crate::fehler::inhalt_laenge(&k.farbe))));
        }
        if gesehen.contains(&k.schluessel.as_str()) {
            return Err(Fehler::ungueltig_mit_wert("Klasse „", &k.schluessel, "“ ist doppelt"));
        }
        gesehen.push(&k.schluessel);
    }
    Ok(())
}

/// Regeln für neue Einstellungen gegenüber den bisherigen.
pub fn einstellungen_pruefen(alt: &Einstellungen, neu: &Einstellungen) -> Result<(), Fehler> {
    let mut gesehen: Vec<&str> = vec![];
    for p in &neu.personen {
        if !kuerzel_gueltig(&p.kuerzel) {
            return Err(Fehler::ungueltig_mit_wert("Kürzel „", &p.kuerzel, "“: 1–8 Kleinbuchstaben oder Ziffern"));
        }
        if p.name.trim().is_empty() {
            return Err(Fehler::ungueltig_mit_wert("Für „", &p.kuerzel, "“ fehlt der Name"));
        }
        if gesehen.contains(&p.kuerzel.as_str()) {
            return Err(Fehler::ungueltig_mit_wert("Kürzel „", &p.kuerzel, "“ ist doppelt"));
        }
        gesehen.push(&p.kuerzel);
    }
    if let Some(weg) = alt.personen.iter().find(|p| !gesehen.contains(&p.kuerzel.as_str())) {
        return Err(Fehler::konflikt_mit_wert("„", &weg.name, "“ wird stillgelegt, nicht entfernt"));
    }
    klassen_pruefen(&neu.klassen)?;
    signale_pruefen(&neu.signale)?;
    register_pruefen(&neu.quellen.anwendungen)
}

/// Signale (R00076): Schlüssel wie Klassen, nicht `due` (gerechnet), mit Bedeutung und Farbe, eindeutig.
fn signale_pruefen(signale: &[Signal]) -> Result<(), Fehler> {
    let mut gesehen: Vec<&str> = vec![];
    for g in signale {
        if !schluessel_gueltig(&g.schluessel) {
            return Err(Fehler::ungueltig_mit_wert("Signalschlüssel „", &g.schluessel, "“: Kleinbuchstaben, Ziffern, - und _"));
        }
        if g.schluessel == SIGNAL_FAELLIG {
            return Err(Fehler::Ungueltig(format!("„{SIGNAL_FAELLIG}“ ist das Signal der Fälligkeit und wird gerechnet")));
        }
        if g.bezeichnung.trim().is_empty() {
            return Err(Fehler::ungueltig_mit_wert("Signal „", &g.schluessel, "“ braucht eine Bedeutung"));
        }
        if !farbe_gueltig(&g.farbe) {
            return Err(Fehler::ungueltig_mit_inhalt(format!("Farbe „{}“: einer der 16 Palettennamen oder #rrggbb", g.farbe), format!("Farbe „{}“: einer der 16 Palettennamen oder #rrggbb", crate::fehler::inhalt_laenge(&g.farbe))));
        }
        if gesehen.contains(&g.schluessel.as_str()) {
            return Err(Fehler::ungueltig_mit_wert("Signal „", &g.schluessel, "“ ist doppelt"));
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
            return Err(Fehler::ungueltig_mit_wert("Anwendungskürzel „", &a.kuerzel, "“: 1–8 Kleinbuchstaben oder Ziffern"));
        }
        if a.name.trim().is_empty() {
            return Err(Fehler::ungueltig_mit_wert("Für die Anwendung „", &a.kuerzel, "“ fehlt der Name"));
        }
        if gesehen.contains(&a.kuerzel.as_str()) {
            return Err(Fehler::ungueltig_mit_wert("Anwendungskürzel „", &a.kuerzel, "“ ist doppelt"));
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

/// Antwort von `POST /api/einstellungen/vorschau` (R00250, ADR-0043 N1.1): `text` ist genau die Datei `kanbanD.md`, die
/// `PUT /api/einstellungen` mit demselben Rumpf jetzt schreiben würde (BOM und Zeilenenden der Datei), ohne Änderung die
/// heutige; `geaendert` = `PUT` würde committen.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, utoipa::ToSchema)]
pub struct Einstellungsvorschau {
    pub text: String,
    pub geaendert: bool,
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
    for a in &mut neu.quellen.anwendungen {
        a.name = a.name.trim().into();
    }
    neu.quellen.anwendungen.sort_by(|a, b| a.kuerzel.cmp(&b.kuerzel));
    neu.repository_ergaenzen();
}

/// Ob das ergänzte `repository` allein schon eine Änderung ist (ADR-0034 N2 Regel 2): `PUT /api/einstellungen` stellt ein
/// Register in alter Form um, auch wenn sonst nichts geändert ist (die eine Änderung beim ersten Mal, R00209 AK 9). Eine
/// Aktion an einer Person committet ohne eigene Änderung nichts (R00091) und lässt die alte Form immer stehen: geschrieben
/// werden nur die geänderten Abschnitte (R00250 AK 4, ADR-0043 Regel 3).
#[derive(Clone, Copy, PartialEq, Eq)]
enum Altform {
    /// das ergänzte `repository` zählt als Änderung (PUT)
    Umstellen,
    /// nur eine eigene Änderung zählt; ohne sie bleibt die alte Form stehen (Personenaktionen)
    Stehenlassen,
}

/// Was ein Schreibweg der Einstellungen schreiben würde (ADR-0043 N1.3, Regel 8): `datei` ist der neue Text von
/// `kanbanD.md` (`None` = keine Änderung), `text` der bisherige.
struct Entwurf<T> {
    datei: Option<String>,
    text: String,
    nachricht: String,
    ergebnis: T,
}

/// Die Änderung des `PUT /api/einstellungen`, für Speichern und Vorschau dieselbe (ADR-0043 N1.3): der Schalter steht
/// nicht im Rumpf und bleibt, wie er in der Datei steht (R00216 AK 5, ADR-0036 Regel 4), alles andere kommt aus dem Rumpf.
fn rumpf_uebernehmen(e: &mut Einstellungen, neu: Einstellungen) -> Result<(String, ()), Fehler> {
    *e = Einstellungen { transkripte_erfassen: e.transkripte_erfassen, ..neu };
    Ok(("Einstellungen geändert".into(), ()))
}

impl Kanban {
    /// Der eine Schreibweg der Einstellungen bis vor das Schreiben (ADR-0043 Regel 8): lesen, `aendern` anwenden,
    /// normalisieren, prüfen und — zeilengenau, nur die geänderten Abschnitte (Regeln 3–6) — den neuen Text bilden. Schreibt
    /// nichts, merkt nichts vor, kein Commit; die Sperre ist Parameter, damit er nur unter ihr läuft.
    fn einstellungen_entwerfen<T>(&self, _sperre: &MutexGuard<'_, ()>, art: Art, altform: Altform, aendern: impl FnOnce(&mut Einstellungen) -> Result<(String, T), Fehler>) -> Result<Entwurf<T>, Fehler> {
        let alt = self.ordner().einstellungen()?.ok_or_else(|| Fehler::Konflikt("Der Ordner ist noch nicht eingerichtet".into()))?;
        let mut neu = alt.clone();
        let (nachricht, ergebnis) = aendern(&mut neu)?;
        normalisieren(&mut neu);
        einstellungen_pruefen(&alt, &neu)?;
        personen_pruefen(art, &alt.personen, &neu.personen)?;
        let mut vergleich = alt.clone();
        if altform == Altform::Stehenlassen {
            vergleich.repository_ergaenzen();
        }
        // der Text unter derselben Sperre wie das Modell
        let text = self.ordner().lies(einstellungen::DATEI)?.unwrap_or_default();
        if neu == vergleich {
            return Ok(Entwurf { datei: None, text, nachricht, ergebnis });
        }
        // von Hand gestaltet oder nicht rücklesbar → 409 (ADR-0043 Regeln 5–6)
        let datei = einstellungen::abschnitte_schreiben(&text, &alt, &vergleich, &neu).map_err(Fehler::handform)?;
        Ok(Entwurf { datei: Some(datei), text, nachricht, ergebnis })
    }

    /// Der eine Schreibweg der Einstellungen: der Entwurf und, bei einer Änderung, genau ein Commit (R00250, ADR-0043).
    /// `aendern` liefert die Commit-Nachricht und ein Ergebnis.
    fn einstellungen_aendern<T>(&self, wer: &Person, altform: Altform, aendern: impl FnOnce(&mut Einstellungen) -> Result<(String, T), Fehler>) -> Result<(bool, T), Fehler> {
        let sperre = self.gesperrt();
        let Entwurf { datei, nachricht, ergebnis, .. } = self.einstellungen_entwerfen(&sperre, wer.art, altform, aendern)?;
        let Some(datei) = datei else { return Ok((false, ergebnis)) };
        self.aktion(wer, &nachricht, &[Schritt::schreiben(einstellungen::DATEI, datei)])?;
        Ok((true, ergebnis))
    }

    pub fn einstellungen_setzen(&self, wer: &Person, neu: Einstellungen) -> Result<bool, Fehler> {
        self.einstellungen_aendern(wer, Altform::Umstellen, |e| rumpf_uebernehmen(e, neu)).map(|(geaendert, ())| geaendert)
    }

    /// Trockenlauf von `einstellungen_setzen` mit demselben Rumpf (ADR-0043 N1.3): der Text, den `PUT` jetzt schreiben
    /// würde, und dieselben Fehler; schreibt nichts. Die Sperre gilt nur für Lesen und Rechnen.
    pub fn einstellungen_vorschau(&self, art: Art, neu: Einstellungen) -> Result<Einstellungsvorschau, Fehler> {
        let entwurf = {
            let sperre = self.gesperrt();
            self.einstellungen_entwerfen(&sperre, art, Altform::Umstellen, |e| rumpf_uebernehmen(e, neu))?
        };
        let geaendert = entwurf.datei.is_some();
        Ok(Einstellungsvorschau { text: entwurf.datei.unwrap_or(entwurf.text), geaendert })
    }

    /// Eine Person anlegen (R00091); ein vorhandenes Kürzel ist ein Konflikt, die Regeln prüft `einstellungen_pruefen`.
    pub fn person_anlegen(&self, wer: &Person, n: &Personenangabe) -> Result<Person, Fehler> {
        let p = Person { kuerzel: n.kuerzel.trim().into(), name: n.name.trim().into(), art: n.art, aktiv: n.aktiv.unwrap_or(true) };
        let (_, p) = self.einstellungen_aendern(wer, Altform::Stehenlassen, |e| {
            if e.person(&p.kuerzel).is_some() {
                return Err(Fehler::konflikt_mit_wert("Kürzel „", &p.kuerzel, "“ gibt es schon"));
            }
            e.personen.push(p.clone());
            Ok((format!("Person „{}“ ({}) angelegt", crate::nachricht::wert(&p.name), crate::nachricht::wert(&p.kuerzel)), p))
        })?;
        Ok(p)
    }

    /// Name, Art oder aktiv einer Person ändern; unbekannt → 404.
    pub fn person_aendern(&self, wer: &Person, kuerzel: &str, a: &PersonAenderung) -> Result<Person, Fehler> {
        let (_, p) = self.einstellungen_aendern(wer, Altform::Stehenlassen, |e| {
            let p = e.personen.iter_mut().find(|p| p.kuerzel == kuerzel).ok_or_else(|| Fehler::nicht_gefunden_mit_wert("Person „", kuerzel, "“ steht nicht in kanbanD.md"))?;
            let tat = if a.aktiv == Some(false) && p.aktiv { "stillgelegt" } else { "geändert" };
            a.anwenden(p);
            Ok((format!("Person „{}“ ({}) {}", crate::nachricht::wert(&p.name), crate::nachricht::wert(kuerzel), tat), p.clone()))
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
        Anwendung { kuerzel: k.into(), name: name.into(), repository: "".into(), wbs: "/a/plan.md".into(), anforderungen: "".into() }
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
            assert!(matches!(einstellungen_pruefen(&alt, &f), Err(Fehler::Ungueltig(_)) | Err(Fehler::Inhalt { ursache: crate::fehler::Ursache::Eingabe, .. })), "{k}/{name}");
        }
        let mut f = e;
        f.quellen.anwendungen[1].kuerzel = "kd".into();
        assert!(einstellungen_pruefen(&alt, &f).unwrap_err().meldung().contains("doppelt"));
    }

    /// R00195 AK 3 (ADR-0031 Regel 1): eine Prüfung für die Klassen des Ordners und eines Boards.
    #[test]
    fn klassen_pruefen_nennt_schluessel_bezeichnung_farbe_und_dopplung() {
        let k = |s: &str, b: &str, f: &str| Klasse { schluessel: s.into(), bezeichnung: b.into(), farbe: f.into() };
        assert_eq!(klassen_pruefen(&[]), Ok(()), "der leere Satz ist gültig");
        assert_eq!(klassen_pruefen(&[k("etappe1", "Etappe 1", "green"), k("eol", "Altlast", "#885500")]), Ok(()));
        let meldung = |klassen: &[Klasse]| klassen_pruefen(klassen).unwrap_err().meldung().to_string();
        assert!(meldung(&[k("eol", "EOL", "amber"), k("eol", "Altlast", "red")]).contains("„eol“ ist doppelt"));
        assert!(meldung(&[k("eol", " ", "amber")]).contains("braucht eine Bezeichnung"));
        assert!(meldung(&[k("eol", "EOL", "lila")]).contains("Farbe „lila“"));
        assert!(meldung(&[k("Etappe 1", "Etappe 1", "green")]).contains("Klassenschlüssel „Etappe 1“"));
        assert!(meldung(&[k("", "leer", "green")]).contains("Klassenschlüssel"));
    }

    #[test]
    fn regeln() {
        let alt = Einstellungen { personen: vec![p("st")], ..Default::default() };
        let gut = Einstellungen { personen: vec![p("st"), p("mi")], klassen: vec![Klasse { schluessel: "doku_1".into(), bezeichnung: "Doku".into(), farbe: "teal".into() }], ..Default::default() };
        assert!(einstellungen_pruefen(&alt, &gut).is_ok());
        let mut f = gut.clone();
        f.personen.remove(0);
        assert!(matches!(einstellungen_pruefen(&alt, &f), Err(Fehler::Konflikt(_)) | Err(Fehler::Inhalt { ursache: crate::fehler::Ursache::Konflikt, .. })));
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
