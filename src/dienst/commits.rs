//! Commit-Verweise an der Aufgabe hinterlegen und entfernen (R00202, ADR-0032 Punkt 4 mit N1.1) — gebaut wie die
//! Kosteneinträge (`aufgabe_schreiben`: Sperre, ein Commit, ohne Änderung keiner), ohne Spaltenregel und ohne neue
//! Zugriffsgrenze. Anders als dort läuft die Prüfung im Arbeits-Repository **vor** der Sperre, damit die Sperre nie auf
//! Git wartet; das Schreiben unter der Sperre prüft Duplikate und Höchstzahl deshalb erneut (Prüfen-dann-Handeln).

use super::Kanban;
use crate::fehler::Fehler;
use crate::format::aufgabe::COMMITS;
use crate::git::arbeitsrepo::{self, Arbeitsrepofehler};
use crate::modell::{Anwendung, Anwendungen, Aufgabe, HASH_MIN, Herkunftsschluessel, Person, Verweisfehler, Verweisform, verweis_lesen};
use crate::nachricht;
use std::collections::HashMap;
use std::path::PathBuf;

/// Schutzwert (ADR-0032 Punkt 1): mehr Verweise nimmt eine Aufgabe über die API nicht auf.
pub const HOECHSTZAHL_COMMITS: usize = 500;

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
    /// je Verweis die Wurzel des Arbeits-Repositorys und der volle Hash. Liefert die Verweise so, wie sie gespeichert werden.
    pub fn commits_pruefen(&self, nr: u32, rumpf: &serde_json::Value) -> Result<Vec<String>, Fehler> {
        let texte = verweise_aus(rumpf)?;
        self.ordner().aufgabe(nr)?;
        let quellen = self.ordner().einstellungen()?.unwrap_or_default().quellen;
        let anwendungen = Anwendungen::aus(&quellen);
        let gelesen = texte.iter().map(|t| verweis_lesen(t, &anwendungen).map_err(abweisung)).collect::<Result<Vec<_>, _>>()?;
        let mut wurzeln: HashMap<&str, PathBuf> = HashMap::new();
        let mut voll = vec![];
        for (text, (anwendung, hash)) in texte.iter().zip(gelesen) {
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

fn abweisung(f: Verweisfehler) -> Fehler {
    Fehler::Verweis { meldung: f.meldung, verweis: f.verweis, fehlt: false }
}

/// Was das Arbeits-Repository meldet, als Antwort: fehlendes Repository und kein Commit 400 mit Verweis, Zeitgrenze 503.
fn repo_fehler(f: Arbeitsrepofehler, text: &str, anwendung: &Anwendung) -> Fehler {
    let name = if anwendung.kuerzel.is_empty() { "der Standardanwendung".to_string() } else { format!("„{}“", anwendung.kuerzel) };
    let verweis = |meldung: String| Fehler::Verweis { meldung, verweis: text.into(), fehlt: false };
    match f {
        Arbeitsrepofehler::RepositoryFehlt(grund) => verweis(format!("Repository {name} fehlt — {grund}")),
        Arbeitsrepofehler::KeinCommit => verweis(format!("„{}“ ist im Repository {name} kein Commit — nicht vorhanden, mehrdeutig (längeren Hash nennen) oder ein anderes Objekt", nachricht::wert(text))),
        Arbeitsrepofehler::Zeitgrenze => Fehler::Zeitgrenze(format!("Git im Repository {name} antwortete nicht in {} s — nichts geschrieben", arbeitsrepo::ZEITGRENZE.as_secs())),
        Arbeitsrepofehler::Start(grund) => Fehler::Intern(format!("git: {grund}")),
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
        if !a.commits.contains(v) && !neu.contains(&v) {
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

/// Gleiches Kürzel (beide ohne heißt Standardanwendung) und der gespeicherte Hash beginnt mit dem genannten.
fn passt(gespeichert: &str, form: &Verweisform) -> bool {
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
            Fehler::Konflikt(_) => 409,
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
        let kd = Anwendung { kuerzel: "kd".into(), name: "KD".into(), wbs: "/r/app.md".into(), anforderungen: String::new() };
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
}
