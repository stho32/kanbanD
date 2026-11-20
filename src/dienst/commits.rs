//! Commit-Verweise an der Aufgabe hinterlegen und entfernen (R00202, ADR-0032 Punkt 4 mit N1.1) — gebaut wie die
//! Kosteneinträge (`aufgabe_schreiben`: Sperre, ein Commit, ohne Änderung keiner), ohne Spaltenregel und ohne neue
//! Zugriffsgrenze. Anders als dort läuft die Prüfung im Arbeits-Repository **vor** der Sperre, damit die Sperre nie auf
//! Git wartet; das Schreiben unter der Sperre prüft Duplikate und Höchstzahl deshalb erneut (Prüfen-dann-Handeln).

use super::Kanban;
use crate::fehler::Fehler;
use crate::format::aufgabe::COMMITS;
use crate::git::arbeitsrepo::{self, Arbeitsrepofehler};
use crate::modell::{Anwendung, Anwendungen, Aufgabe, HASH_MIN, Ersetzungsfehler, Herkunftsschluessel, Paar, Person, Verweisfehler, Verweisform, ersetzungen_lesen, verweis_lesen};
use crate::nachricht;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

/// Schutzwert (ADR-0032 Punkt 1): mehr Verweise nimmt eine Aufgabe über die API nicht auf.
pub const HOECHSTZAHL_COMMITS: usize = 500;

/// Rumpf von `POST …/commits/ersetzen`. Nur die Beschreibung für OpenAPI: gelesen wird der Rumpf roh.
#[derive(utoipa::ToSchema)]
#[allow(dead_code)] // die Felder tragen nur das Schema
pub struct Ersetzungsangaben {
    /// Paare alt → neu, 1 bis 500; ein Verweis kommt höchstens einmal vor (auch nicht als Kette)
    #[schema(min_items = 1, max_items = 500)]
    ersetzungen: Vec<Ersetzungspaar>,
}

/// Ein Paar: `alt` steht an der Karte (voller Hash oder Präfix ab 7 Zeichen), `neu` ist ein Commit im Arbeits-Repository.
#[derive(utoipa::ToSchema)]
#[allow(dead_code)]
pub struct Ersetzungspaar {
    alt: String,
    neu: String,
}

/// Was die Prüfung ohne Sperre ergeben hat: die gelesenen Paare und je Paar der volle Verweis von `neu`, wo Git gefragt
/// wurde (nur für Paare, die noch nicht erledigt sind).
#[derive(Debug)]
pub struct Ersetzungsplan {
    paare: Vec<Paar>,
    voll: Vec<Option<String>>,
}

/// Rumpf von `POST …/commits`. Nur die Beschreibung für OpenAPI: gelesen wird der Rumpf roh, damit jeder Fehler 400 wird.
#[derive(utoipa::ToSchema)]
#[allow(dead_code)] // das Feld trägt nur das Schema
pub struct Commitangaben {
    /// Verweise `<kürzel>:<hash>` oder `<hash>` (Standardanwendung); Hash 7 bis 64 Zeichen 0-9a-f, auch groß; mindestens einer
    #[schema(min_items = 1)]
    commits: Vec<String>,
}

impl Kanban {
    /// `POST /api/aufgaben/{nr}/commits` — alles oder nichts: erst prüfen (ohne Sperre), dann eintragen (unter der Sperre).
    pub fn commits_hinterlegen(&self, wer: &Person, nr: u32, rumpf: &serde_json::Value) -> Result<Aufgabe, Fehler> {
        let geprueft = self.commits_pruefen(nr, rumpf)?;
        self.commits_eintragen(wer, nr, &geprueft)
    }

    /// Ohne Sperre: Rumpf, Aufgabe vorhanden, Form und Register **aller** Verweise — erst danach startet Git (AK 6) —, dann
    /// Höchstzahl der Anfrage und Entdoppeln nach Kürzel und Hash, dann je eindeutigem Verweis die Wurzel des Arbeits-Repositorys und der volle Hash. Liefert die Verweise so, wie sie gespeichert werden.
    pub fn commits_pruefen(&self, nr: u32, rumpf: &serde_json::Value) -> Result<Vec<String>, Fehler> {
        let texte = verweise_aus(rumpf)?;
        self.ordner().aufgabe(nr)?;
        let quellen = self.ordner().einstellungen()?.unwrap_or_default().quellen;
        let anwendungen = Anwendungen::aus(&quellen);
        let gelesen = texte.iter().map(|t| verweis_lesen(t, &anwendungen).map_err(abweisung)).collect::<Result<Vec<_>, _>>()?;
        // Vor dem ersten Git-Aufruf: ein großer Rumpf darf nie viele Prozesse starten (Sicherheitsbefund Muss 1, Karte #207)
        if texte.len() > HOECHSTZAHL_COMMITS {
            return Err(Fehler::Konflikt(format!("Die Anfrage nennt {} Verweise — mehr als {HOECHSTZAHL_COMMITS} nimmt eine Aufgabe nicht auf", texte.len())));
        }
        let mut gesehen: HashSet<(&str, String)> = HashSet::new();
        let eindeutig = texte.iter().zip(gelesen).filter(|(_, (anwendung, hash))| gesehen.insert((anwendung.kuerzel.as_str(), hash.clone())));
        let mut wurzeln: HashMap<&str, PathBuf> = HashMap::new();
        let mut voll = vec![];
        for (text, (anwendung, hash)) in eindeutig {
            let wurzel = match wurzeln.get(anwendung.kuerzel.as_str()) {
                Some(w) => w.clone(),
                None => arbeitsrepo::wurzel(self.ordner().wurzel(), anwendung).map_err(|f| repo_fehler(f, text, anwendung))?,
            };
            let h = arbeitsrepo::commit_aufloesen(&wurzel, &hash).map_err(|f| repo_fehler(f, text, anwendung))?;
            wurzeln.insert(&anwendung.kuerzel, wurzel);
            voll.push(Herkunftsschluessel::qualifiziert(&anwendung.kuerzel, &h));
        }
        Ok(voll)
    }

    /// Unter der Sperre, ohne Git: Duplikate und Höchstzahl gegen die frisch gelesene Datei, ein Commit oder keiner.
    pub fn commits_eintragen(&self, wer: &Person, nr: u32, geprueft: &[String]) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| eintragen(a, geprueft))
    }

    /// `POST /api/aufgaben/{nr}/commits/ersetzen` — alles oder nichts: Karte und Git ohne Sperre, Austausch unter der Sperre.
    pub fn commits_ersetzen(&self, wer: &Person, nr: u32, rumpf: &serde_json::Value) -> Result<Aufgabe, Fehler> {
        let plan = self.commits_ersetzen_pruefen(nr, rumpf)?;
        self.commits_ersetzen_eintragen(wer, nr, &plan)
    }

    /// Ohne Sperre: Rumpf (Form, Kürzel, doppelt, Kette, Zahl — alles vor Git), Aufgabe, Karte (404, 409, Wiederholung,
    /// mehrdeutiger Präfix), und erst dann je **offenem** Paar Wurzel und voller Hash von `neu`. `alt` erreicht Git nie.
    pub fn commits_ersetzen_pruefen(&self, nr: u32, rumpf: &serde_json::Value) -> Result<Ersetzungsplan, Fehler> {
        let quellen = self.ordner().einstellungen()?.unwrap_or_default().quellen;
        let paare = ersetzungen_lesen(rumpf, &Anwendungen::aus(&quellen)).map_err(ersetzungsfehler)?;
        let offen = urteil(&self.ordner().aufgabe(nr)?, &paare)?;
        let mut wurzeln: HashMap<String, PathBuf> = HashMap::new();
        let mut voll = Vec::with_capacity(paare.len());
        for (paar, offen) in paare.iter().zip(offen) {
            if !offen {
                voll.push(None);
                continue;
            }
            let anwendung = &paar.anwendung;
            let wurzel = match wurzeln.get(&anwendung.kuerzel) {
                Some(w) => w.clone(),
                None => arbeitsrepo::wurzel(self.ordner().wurzel(), anwendung).map_err(|f| repo_fehler(f, &paar.neu_text, anwendung))?,
            };
            let hash = arbeitsrepo::commit_aufloesen(&wurzel, &paar.neu_hash).map_err(|f| repo_fehler(f, &paar.neu_text, anwendung))?;
            wurzeln.insert(anwendung.kuerzel.clone(), wurzel);
            voll.push(Some(Herkunftsschluessel::qualifiziert(&anwendung.kuerzel, &hash)));
        }
        Ok(Ersetzungsplan { paare, voll })
    }

    /// Unter der Sperre, ohne Git: Karte erneut gegen die frisch gelesene Datei, Austausch an der Stelle, ein Commit oder keiner.
    pub fn commits_ersetzen_eintragen(&self, wer: &Person, nr: u32, plan: &Ersetzungsplan) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| ersetzen(a, plan))
    }

    /// `DELETE /api/aufgaben/{nr}/commits/{verweis}` — voller Hash oder an der Karte eindeutiger Präfix ≥ 7; fragt das
    /// Arbeits-Repository nicht, damit sich auch ein verschwundener Verweis entfernen lässt.
    pub fn commit_entfernen(&self, wer: &Person, nr: u32, verweis: &str) -> Result<Aufgabe, Fehler> {
        let form = Verweisform::lesen(verweis).map_err(abweisung)?;
        self.aufgabe_schreiben(wer, nr, |a| entfernen(a, &form, verweis).map(Some))
    }
}

/// Der Rumpf ist genau `{commits: [Text, …]}` mit mindestens einem Eintrag; alles andere ist 400.
fn verweise_aus(rumpf: &serde_json::Value) -> Result<Vec<String>, Fehler> {
    let falsch = || Fehler::Ungueltig("Rumpf {commits: [Verweis, …]} mit mindestens einem Verweis erwartet".into());
    let feld = rumpf.as_object().filter(|o| o.len() == 1).and_then(|o| o.get("commits")).and_then(serde_json::Value::as_array).filter(|l| !l.is_empty()).ok_or_else(falsch)?;
    feld.iter().enumerate().map(|(i, v)| v.as_str().map(String::from).ok_or_else(|| Fehler::Ungueltig(format!("commits[{i}] ist kein Text: {v}")))).collect()
}

fn ersetzungsfehler(f: Ersetzungsfehler) -> Fehler {
    match f.verweis {
        Some(verweis) => Fehler::Verweis { meldung: f.meldung, verweis, fehlt: false },
        None => Fehler::Ungueltig(f.meldung),
    }
}

/// Die Karte gegen die Paare, in der Reihenfolge der Fehlerstufen aus R00203 FA 7: mehrdeutiger Präfix von `alt` (400), dann
/// `alt` und `neu` fehlen (404), dann beide da (409); sonst je Paar, ob es noch zu tun ist — `alt` da und `neu` nicht — oder
/// erledigt (`alt` weg und `neu` da, die Wiederholung). Ohne Git; gilt vor und unter der Sperre.
fn urteil(a: &Aufgabe, paare: &[Paar]) -> Result<Vec<bool>, Fehler> {
    let nr = a.nummer;
    if a.weitere.iter().any(|(k, _)| k == COMMITS) {
        return Err(Fehler::Konflikt(format!("#{nr}: {COMMITS} in der Datei ist keine Liste von Texten — erst von Hand reparieren")));
    }
    let (mut mehrdeutig, mut fehlt, mut beide) = (None, None, None);
    let mut offen = Vec::with_capacity(paare.len());
    for paar in paare {
        let treffer = a.commits.iter().filter(|c| passt(c, &paar.alt)).count();
        let neu = Verweisform { kuerzel: Some(paar.anwendung.kuerzel.clone()).filter(|k| !k.is_empty()), hash: paar.neu_hash.clone() };
        let neu_da = a.commits.iter().any(|c| passt(c, &neu));
        match (treffer, neu_da) {
            (0, false) => fehlt = fehlt.or(Some(paar)),
            (1, true) => beide = beide.or(Some(paar)),
            (n, _) if n > 1 => mehrdeutig = mehrdeutig.or(Some((paar, n))),
            _ => {}
        }
        offen.push(treffer == 1 && !neu_da);
    }
    if let Some((paar, n)) = mehrdeutig {
        return Err(Fehler::Verweis { meldung: format!("„{}“ passt zu {n} Commit-Verweisen an #{nr} — längeren Hash nennen", nachricht::wert(&paar.alt_text)), verweis: paar.alt_text.clone(), fehlt: false });
    }
    if let Some(paar) = fehlt {
        return Err(Fehler::Verweis { meldung: format!("#{nr} hat weder „{}“ noch „{}“ als Commit-Verweis", nachricht::wert(&paar.alt_text), nachricht::wert(&paar.neu_text)), verweis: paar.alt_text.clone(), fehlt: true });
    }
    if let Some(paar) = beide {
        return Err(Fehler::VerweisKonflikt { meldung: format!("#{nr} trägt „{}“ und „{}“ schon beide — „{}“ lässt sich mit DELETE entfernen", nachricht::wert(&paar.alt_text), nachricht::wert(&paar.neu_text), nachricht::wert(&paar.alt_text)), verweis: paar.alt_text.clone() });
    }
    Ok(offen)
}

/// Tauscht an der Stelle des alten Verweises den neuen ein; liefert die Commit-Nachricht, ohne offenes Paar `None`.
fn ersetzen(a: &mut Aufgabe, plan: &Ersetzungsplan) -> Result<Option<String>, Fehler> {
    let nr = a.nummer;
    let offen = urteil(a, &plan.paare)?;
    let mut tausch = vec![];
    for ((paar, offen), voll) in plan.paare.iter().zip(offen).zip(&plan.voll) {
        if !offen {
            continue;
        }
        let Some(voll) = voll else {
            return Err(Fehler::Konflikt(format!("#{nr}: „{}“ stand bei der Prüfung nicht mehr zu tun — Aufruf wiederholen", nachricht::wert(&paar.alt_text))));
        };
        let platz = a.commits.iter().position(|c| passt(c, &paar.alt)).expect("urteil: alt steht an der Karte");
        tausch.push((platz, voll));
    }
    let mut zeilen = vec![];
    for (platz, voll) in tausch {
        zeilen.push(format!("{} → {}", kurz(&a.commits[platz]), kurz(voll)));
        a.commits[platz] = voll.clone();
    }
    Ok((!zeilen.is_empty()).then(|| format!("#{nr} Commits ersetzt: {}", zeilen.join(", "))))
}

fn abweisung(f: Verweisfehler) -> Fehler {
    Fehler::Verweis { meldung: f.meldung, verweis: f.verweis, fehlt: false }
}

/// Was das Arbeits-Repository meldet, als Antwort: fehlendes Repository und kein Commit 400 mit Verweis, Zeitgrenze 503.
fn repo_fehler(f: Arbeitsrepofehler, text: &str, anwendung: &Anwendung) -> Fehler {
    let name = match nachricht::wert(&anwendung.kuerzel) {
        k if k.is_empty() => "der Standardanwendung".to_string(),
        k => format!("„{k}“"),
    };
    let verweis = |meldung: String| Fehler::Verweis { meldung, verweis: text.into(), fehlt: false };
    match f {
        Arbeitsrepofehler::RepositoryFehlt(grund) => verweis(format!("Repository {name} fehlt — {grund}")),
        Arbeitsrepofehler::KeinCommit => verweis(format!("„{}“ ist im Repository {name} kein Commit — nicht vorhanden, mehrdeutig (längeren Hash nennen) oder ein anderes Objekt", nachricht::wert(text))),
        Arbeitsrepofehler::Zeitgrenze => Fehler::Zeitgrenze(format!("Git im Repository {name} antwortete nicht in {} s — nichts geschrieben", arbeitsrepo::ZEITGRENZE.as_secs())),
        Arbeitsrepofehler::ZuvielAusgabe(n) => Fehler::Zeitgrenze(format!("Git im Repository {name} lieferte mehr als {n} Zeilen — abgebrochen")),
        Arbeitsrepofehler::Start(grund) | Arbeitsrepofehler::ArgumenteZuLang(grund) => Fehler::Intern(format!("git: {grund}")),
    }
}

/// Hängt an, was neu ist (auch innerhalb der Anfrage doppelt nur einmal), und liefert die Commit-Nachricht; ohne Neues
/// `None`, also kein Commit. Höchstzahl gegen die frisch gelesene Datei.
fn eintragen(a: &mut Aufgabe, geprueft: &[String]) -> Result<Option<String>, Fehler> {
    let nr = a.nummer;
    if a.weitere.iter().any(|(k, _)| k == COMMITS) {
        return Err(Fehler::Konflikt(format!("#{nr}: {COMMITS} in der Datei ist keine Liste von Texten — erst von Hand reparieren")));
    }
    let mut neu: Vec<&String> = vec![];
    for v in geprueft {
        if !a.commits.iter().chain(neu.iter().copied()).any(|c| derselbe_verweis(c, v)) {
            neu.push(v);
        }
    }
    if neu.is_empty() {
        return Ok(None);
    }
    if a.commits.len() + neu.len() > HOECHSTZAHL_COMMITS {
        return Err(Fehler::Konflikt(format!("#{nr} trägt schon {} Commit-Verweise — mehr nimmt eine Aufgabe nicht auf", a.commits.len())));
    }
    let nachricht = format!("#{nr} Commits hinterlegt: {}", neu.iter().map(|v| kurz(v)).collect::<Vec<_>>().join(", "));
    a.commits.extend(neu.into_iter().cloned());
    Ok(Some(nachricht))
}

/// Entfernt den einen Eintrag, der zu Kürzel und Präfix passt; keiner 404, mehrere 400 — beides entfernt nichts.
fn entfernen(a: &mut Aufgabe, form: &Verweisform, verweis: &str) -> Result<String, Fehler> {
    let nr = a.nummer;
    let treffer: Vec<usize> = a.commits.iter().enumerate().filter(|(_, c)| passt(c, form)).map(|(i, _)| i).collect();
    match treffer.as_slice() {
        [i] => Ok(format!("#{nr} Commit-Verweis entfernt: {}", kurz(&a.commits.remove(*i)))),
        [] => Err(Fehler::Verweis { meldung: format!("#{nr} hat keinen Commit-Verweis „{}“", nachricht::wert(verweis)), verweis: verweis.into(), fehlt: true }),
        mehrere => Err(Fehler::Verweis { meldung: format!("„{}“ passt zu {} Commit-Verweisen an #{nr} — längeren Hash nennen", nachricht::wert(verweis), mehrere.len()), verweis: verweis.into(), fehlt: false }),
    }
}

/// Dieselbe Anwendung (beide ohne Kürzel heißt Standardanwendung) und derselbe Hash, Groß-/Kleinschreibung gleich.
fn derselbe_verweis(a: &str, b: &str) -> bool {
    let teile = |v: &'_ str| match v.split_once(':') {
        Some((k, h)) => (Some(k.to_string()), h.to_ascii_lowercase()),
        None => (None, v.to_ascii_lowercase()),
    };
    teile(a) == teile(b)
}

/// Gleiches Kürzel (beide ohne heißt Standardanwendung) und der gespeicherte Hash beginnt mit dem genannten.
pub(super) fn passt(gespeichert: &str, form: &Verweisform) -> bool {
    let (kuerzel, hash) = match gespeichert.split_once(':') {
        Some((k, h)) => (Some(k), h),
        None => (None, gespeichert),
    };
    kuerzel == form.kuerzel.as_deref() && hash.to_ascii_lowercase().starts_with(&form.hash)
}

/// Der Verweis für die Commit-Nachricht: Kürzel und die ersten 7 Zeichen des Hashes (`kd:3f2a9c1`).
fn kurz(verweis: &str) -> String {
    let (praefix, hash) = verweis.rsplit_once(':').unwrap_or(("", verweis));
    let hash: String = hash.chars().take(HASH_MIN).collect();
    nachricht::wert(&if praefix.is_empty() { hash } else { format!("{praefix}:{hash}") })
}

#[cfg(test)]
mod tests {
    use super::*;

    const K1: &str = "kd:3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e";
    const K2: &str = "kd:9c6b91f5d0e3a2b1c4d5e6f7a8b9c0d1e2f3a4b5";

    fn aufgabe(commits: &[&str]) -> Aufgabe {
        let mut a = Aufgabe::neu(1, "0001-a.md".into(), "a".into());
        a.commits = commits.iter().map(|c| c.to_string()).collect();
        a
    }

    fn eintraege(geprueft: &[&str]) -> Vec<String> {
        geprueft.iter().map(|c| c.to_string()).collect()
    }

    fn status(f: Fehler) -> u16 {
        match f {
            Fehler::Konflikt(_) | Fehler::VerweisKonflikt { .. } => 409,
            Fehler::Verweis { fehlt: true, .. } => 404,
            Fehler::Verweis { fehlt: false, .. } => 400,
            anderer => panic!("{anderer:?}"),
        }
    }

    // AK 1, AK 7: Neues kommt hinten an, Vorhandenes und Doppeltes zählt einmal, nichts Neues → keine Nachricht (kein Commit)
    #[test]
    fn eintragen_haengt_nur_neues_an() {
        let mut a = aufgabe(&[K1]);
        assert_eq!(eintragen(&mut a, &eintraege(&[K1, K2, K2])).unwrap().as_deref(), Some("#1 Commits hinterlegt: kd:9c6b91f"));
        assert_eq!(a.commits, [K1, K2]);
        assert_eq!(eintragen(&mut a, &eintraege(&[K2, K1])).unwrap(), None, "nichts Neues");
        assert_eq!(a.commits, [K1, K2]);
        let mut b = aufgabe(&[]);
        assert_eq!(eintragen(&mut b, &eintraege(&[K2, "3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e"])).unwrap().as_deref(), Some("#1 Commits hinterlegt: kd:9c6b91f, 3f2a9c1"));
    }

    // Code-Review Optional 3: dieselbe Gleichheit wie `passt` im DELETE — Kürzel genau, Hash ohne Groß-/Kleinschreibung
    #[test]
    fn eintragen_vergleicht_den_hash_ohne_gross_und_kleinschreibung() {
        let mut a = aufgabe(&["kd:3F2A9C1E0B7D4A6F8E2C1B0A9D8E7F6A5B4C3D2E"]);
        assert_eq!(eintragen(&mut a, &eintraege(&[K1])).unwrap(), None, "derselbe Verweis, von Hand groß geschrieben");
        assert_eq!(a.commits.len(), 1);
        assert!(eintragen(&mut a, &eintraege(&["xx:3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e"])).unwrap().is_some(), "anderes Kürzel ist ein anderer Verweis");
    }

    // AK 7: 499 + 1 angenommen, 500 + 1 → 409 und nichts angehängt; zwei Neue an 499 sind zusammen zu viel
    #[test]
    fn hoechstens_500() {
        let fremde: Vec<String> = (0..HOECHSTZAHL_COMMITS - 1).map(|i| format!("kd:{i:040x}")).collect();
        let mut a = aufgabe(&[]);
        a.commits = fremde.clone();
        let vorher = a.clone();
        assert_eq!(status(eintragen(&mut a, &eintraege(&[K1, K2])).unwrap_err()), 409);
        assert_eq!(a, vorher);
        eintragen(&mut a, &eintraege(&[K1])).unwrap().unwrap();
        assert_eq!(a.commits.len(), 500);
        let f = eintragen(&mut a, &eintraege(&[K2])).unwrap_err();
        assert_eq!(f.meldung(), "#1 trägt schon 500 Commit-Verweise — mehr nimmt eine Aufgabe nicht auf");
        assert_eq!(eintragen(&mut a, &eintraege(&[K1])).unwrap(), None, "nichts Neues ist kein Verstoß");
    }

    // ADR-0032 Punkt 1: steht `commits` als unbekannter Schlüssel da (keine Liste von Texten), wird nichts dazugeschrieben
    #[test]
    fn unlesbarer_schluessel_wird_nicht_ueberschrieben() {
        let mut a = aufgabe(&[]);
        a.weitere.push(("commits".into(), serde_yaml::Value::String("von Hand".into())));
        let vorher = a.clone();
        assert_eq!(status(eintragen(&mut a, &eintraege(&[K1])).unwrap_err()), 409);
        assert_eq!(a, vorher);
    }

    // ADR-0032 Punkt 3: Zeitgrenze → 503 ohne Verweis; fehlendes Repository und kein Commit → 400 mit dem Verweis der Anfrage
    #[test]
    fn meldungen_des_arbeits_repositorys() {
        let kd = Anwendung { kuerzel: "kd".into(), name: "KD".into(), repository: String::new(), wbs: "/r/app.md".into(), anforderungen: String::new() };
        assert!(matches!(repo_fehler(Arbeitsrepofehler::Zeitgrenze, "kd:3f2a9c1", &kd), Fehler::Zeitgrenze(m) if m.contains("10 s") && m.contains("nichts geschrieben")));
        assert!(matches!(repo_fehler(Arbeitsrepofehler::RepositoryFehlt("Ordner fehlt: /r".into()), "kd:3f2a9c1", &kd), Fehler::Verweis { meldung, verweis, fehlt: false } if meldung.contains("/r") && meldung.contains("„kd“") && verweis == "kd:3f2a9c1"));
        assert!(matches!(repo_fehler(Arbeitsrepofehler::KeinCommit, "kd:0000000", &kd), Fehler::Verweis { verweis, fehlt: false, .. } if verweis == "kd:0000000"));
    }

    // AK 8: voller Hash oder eindeutiger Präfix ≥ 7 je Kürzel; unbekannt 404, mehrdeutig 400 — beides entfernt nichts
    #[test]
    fn entfernen_voll_oder_eindeutiger_praefix() {
        let ohne = "3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e";
        let zweier = ["kd:7f62b7e8c4aeab77b053e03929734afdc3d9bdc4", "kd:7f62b7e8c5daa353f97b7f84b0b410b9501a4e46"];
        let alle = [K1, K2, ohne, zweier[0], zweier[1], "kd:zz"];
        for (verweis, uebrig) in [("kd:3f2a9c1", vec![K2, ohne, zweier[0], zweier[1], "kd:zz"]), (K2, vec![K1, ohne, zweier[0], zweier[1], "kd:zz"]), ("kd:9C6B91F", vec![K1, ohne, zweier[0], zweier[1], "kd:zz"]), ("3f2a9c1", vec![K1, K2, zweier[0], zweier[1], "kd:zz"]), ("kd:7f62b7e8c4", vec![K1, K2, ohne, zweier[1], "kd:zz"])] {
            let mut a = aufgabe(&alle);
            let form = crate::modell::Verweisform::lesen(verweis).unwrap();
            entfernen(&mut a, &form, verweis).unwrap_or_else(|f| panic!("{verweis}: {f:?}"));
            assert_eq!(a.commits, uebrig, "{verweis}");
        }
        for (verweis, erwartet) in [("kd:0000000", 404), ("xy:3f2a9c1", 404), ("kd:7f62b7e", 400)] {
            let mut a = aufgabe(&alle);
            let form = crate::modell::Verweisform::lesen(verweis).unwrap();
            let f = entfernen(&mut a, &form, verweis).unwrap_err();
            assert!(matches!(&f, Fehler::Verweis { verweis: v, .. } if v == verweis), "{f:?}");
            assert_eq!(status(f), erwartet, "{verweis}");
            assert_eq!(a.commits, alle, "{verweis}");
        }
    }

    // ---- Ersetzen (R00203 B0995): Karte und Austausch ohne Git

    const K3: &str = "kd:8e20ad9b3c5d7f1a2b4c6d8e0f1a3b5c7d9e1f2a";
    const K4: &str = "kd:1d4c7e2a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e";
    const W1: &str = "kd:5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a";

    /// Der Plan, wie ihn die Prüfung baute: `voll` nur für offene Paare gefüllt (die Probe steht in tests/commits_ersetzen_dienst.rs).
    fn plan(a: &Aufgabe, paare: &[(&str, &str)]) -> Result<Ersetzungsplan, Fehler> {
        let kd = Anwendung { kuerzel: "kd".into(), name: "KD".into(), repository: String::new(), wbs: "/r/app.md".into(), anforderungen: String::new() };
        let register = Anwendungen::aus(&crate::modell::Quellen { repository: String::new(), wbs: String::new(), anforderungen: String::new(), anwendungen: vec![kd] });
        let rumpf = serde_json::json!({"ersetzungen": paare.iter().map(|(a, n)| serde_json::json!({"alt": a, "neu": n})).collect::<Vec<_>>()});
        let paare = ersetzungen_lesen(&rumpf, &register).map_err(ersetzungsfehler)?;
        let offen = urteil(a, &paare)?;
        let voll = paare.iter().zip(offen).map(|(p, offen)| offen.then(|| format!("kd:{}", p.neu_hash))).collect();
        Ok(Ersetzungsplan { paare, voll })
    }

    // AK 1: die neuen Hashes stehen auf den Plätzen der alten, der Rest behält Platz und Wortlaut; die Nachricht nennt die Paare
    #[test]
    fn ersetzen_tauscht_an_der_stelle() {
        let mut a = aufgabe(&[K1, W1, K2]);
        let p = plan(&a, &[(&K1[..10], K3), (&K2[..10], K4)]).unwrap();
        assert_eq!(ersetzen(&mut a, &p).unwrap().as_deref(), Some("#1 Commits ersetzt: kd:3f2a9c1 → kd:8e20ad9, kd:9c6b91f → kd:1d4c7e2"));
        assert_eq!(a.commits, [K3, W1, K4]);
        let mut b = aufgabe(&[K1, K2]);
        let p = plan(&b, &[(K2, K4)]).unwrap();
        ersetzen(&mut b, &p).unwrap();
        assert_eq!(b.commits, [K1, K4], "Platz 2 bleibt Platz 2");
    }

    // AK 4, AK 6: Wiederholung — `alt` weg und `neu` da ist erledigt, ohne Nachricht (kein Commit); gemischt zählt nur das offene
    #[test]
    fn ersetzen_wiederholung_ist_erledigt() {
        let mut a = aufgabe(&[K3, W1, K4]);
        let p = plan(&a, &[(K1, K3), (K2, &K4[..10])]).unwrap();
        assert_eq!(p.voll, [None, None]);
        assert_eq!(ersetzen(&mut a, &p).unwrap(), None);
        assert_eq!(a.commits, [K3, W1, K4]);
        let mut b = aufgabe(&[K3, W1]);
        let p = plan(&b, &[(K1, K3), (W1, K4)]).unwrap();
        assert_eq!(ersetzen(&mut b, &p).unwrap().as_deref(), Some("#1 Commits ersetzt: kd:5a5a5a5 → kd:1d4c7e2"));
        assert_eq!(b.commits, [K3, K4]);
    }

    // AK 5: Ersetzen ändert die Zahl nicht — bei 500 Verweisen kein Grund für einen Fehler
    #[test]
    fn ersetzen_bei_500_verweisen_bleibt_bei_500() {
        let mut a = aufgabe(&[]);
        a.commits = (0..HOECHSTZAHL_COMMITS - 1).map(|i| format!("kd:{i:040x}")).collect();
        a.commits.push(K1.into());
        let p = plan(&a, &[(K1, K3)]).unwrap();
        ersetzen(&mut a, &p).unwrap().unwrap();
        assert_eq!((a.commits.len(), a.commits.last().map(String::as_str)), (500, Some(K3)));
    }

    // AK 7/8: 400 (mehrdeutig) vor 404 (fehlt) vor 409 (beide da), je mit dem alt aus der Anfrage — und nichts verändert
    #[test]
    fn ersetzen_fehlerstufen_und_reihenfolge() {
        let zweier = ["kd:7f62b7e8c4aeab77b053e03929734afdc3d9bdc4", "kd:7f62b7e8c5daa353f97b7f84b0b410b9501a4e46"];
        let a = aufgabe(&[K1, K2, zweier[0], zweier[1]]);
        let fehlt = (K4, K3);
        let beide = (K1, K2);
        let mehrdeutig = ("kd:7f62b7e", "kd:abcdef0");
        for (paare, erwartet, verweis) in [
            (vec![fehlt], 404, K4),
            (vec![beide], 409, K1),
            (vec![mehrdeutig], 400, "kd:7f62b7e"),
            (vec![beide, fehlt], 404, K4),
            (vec![fehlt, beide, mehrdeutig], 400, "kd:7f62b7e"),
            (vec![(K2, "kd:fedcba9"), fehlt], 404, K4),
        ] {
            let f = plan(&a, &paare).unwrap_err();
            assert!(matches!(&f, Fehler::Verweis { verweis: v, .. } | Fehler::VerweisKonflikt { verweis: v, .. } if v == verweis), "{paare:?}: {f:?}");
            assert_eq!(status(f), erwartet, "{paare:?}");
        }
    }

    // AK 12 a, c: unlesbare und Ziffern-Einträge bleiben wörtlich stehen; `commits` ohne Liste von Texten → 409, nichts geändert
    #[test]
    fn ersetzen_laesst_den_bestand_unberuehrt() {
        let ziffern = "1234567890123456789012345678901234567890";
        let mut a = aufgabe(&[K1, "kd:zz", ziffern]);
        let p = plan(&a, &[(K1, K3)]).unwrap();
        ersetzen(&mut a, &p).unwrap();
        assert_eq!(a.commits, [K3, "kd:zz", ziffern]);
        assert_eq!(status(plan(&a, &[("kd:zz", K4)]).unwrap_err()), 400, "unlesbare Form lässt sich nicht ersetzen");

        let mut b = aufgabe(&[]);
        b.weitere.push(("commits".into(), serde_yaml::Value::String("von Hand".into())));
        let vorher = b.clone();
        assert_eq!(status(plan(&b, &[(K1, K3)]).unwrap_err()), 409);
        let p = Ersetzungsplan { paare: plan(&aufgabe(&[K1]), &[(K1, K3)]).unwrap().paare, voll: vec![Some(K3.into())] };
        assert_eq!(status(ersetzen(&mut b, &p).unwrap_err()), 409);
        assert_eq!(b, vorher);
    }

    // Prüfen-dann-Handeln: war ein Paar bei der Prüfung erledigt und ist es unter der Sperre wieder offen, fehlt der volle
    // Hash aus Git — 409 mit der Bitte zu wiederholen, nichts geändert
    #[test]
    fn ersetzen_ohne_geprueften_hash_unter_der_sperre_ist_409() {
        let erledigt = aufgabe(&[K3]);
        let p = plan(&erledigt, &[(K1, K3)]).unwrap();
        assert_eq!(p.voll, [None]);
        let mut jetzt = aufgabe(&[K1]);
        let vorher = jetzt.clone();
        assert_eq!(status(ersetzen(&mut jetzt, &p).unwrap_err()), 409);
        assert_eq!(jetzt, vorher);
    }
}
