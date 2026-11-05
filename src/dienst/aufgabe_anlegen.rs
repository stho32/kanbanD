use super::Kanban;
use super::zugregeln::{archivierte, zug_pruefen};
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::{Art, Aufgabe, Aufgabenaenderung, Fremdschluessel, Person, Schluesseltreffer};
use serde::{Deserialize, Serialize};
use std::sync::MutexGuard;

/// Felder, die schon beim Anlegen gesetzt werden (Schnelleingabe).
#[derive(Debug, Clone, Default, Deserialize, utoipa::ToSchema)]
pub struct Angaben {
    /// Schlüssel eines fremden Systems (R00098): 1–200 Zeichen ohne Zeilenumbruch, außen getrimmt, genau mit Groß/Klein;
    /// trägt schon eine Karte den Schlüssel, wird keine neue angelegt
    pub key: Option<String>,
    pub klasse: Option<String>,
    pub zustaendige: Option<Vec<String>>,
    pub labels: Option<Vec<String>>,
    pub faellig: Option<String>,
    pub herkunft: Option<Vec<String>>,
    pub beschreibung: Option<String>,
    pub teilaufgaben: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize, utoipa::ToSchema)]
pub struct NeueAufgabe {
    pub titel: String,
    pub board: Option<String>,
    pub spalte: Option<String>,
    #[serde(flatten)]
    pub angaben: Angaben,
}

/// Eine neue Aufgabe in einer Liste: nur der Titel oder Titel mit Angaben.
#[derive(Debug, Clone, Deserialize, utoipa::ToSchema)]
#[serde(untagged)]
pub enum Eintrag {
    Titel(String),
    MitAngaben {
        titel: String,
        #[serde(flatten)]
        angaben: Angaben,
    },
}

#[derive(Debug, Clone, Deserialize, utoipa::ToSchema)]
pub struct NeueAufgaben {
    pub titel: Vec<Eintrag>,
    pub board: Option<String>,
    pub spalte: Option<String>,
}

/// Eine Karte der Antwort beim Anlegen: die Aufgabe und ob sie neu ist (R00098).
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct Angelegt {
    #[serde(flatten)]
    pub aufgabe: Aufgabe,
    /// `true`: neu angelegt; `false`: eine Karte mit dem Schlüssel gab es schon
    pub neu: bool,
}

impl Eintrag {
    fn teile(&self) -> (&str, Option<&Angaben>) {
        match self {
            Eintrag::Titel(t) => (t.trim(), None),
            Eintrag::MitAngaben { titel, angaben } => (titel.trim(), Some(angaben)),
        }
    }
}

impl Kanban {
    /// Legt die Aufgabendatei an und hängt sie, wenn verlangt, unten an eine Spalte — ein Commit.
    pub fn aufgabe_anlegen(&self, wer: &Person, neu: &NeueAufgabe) -> Result<Angelegt, Fehler> {
        let eintrag = Eintrag::MitAngaben { titel: neu.titel.clone(), angaben: neu.angaben.clone() };
        let mehrere = NeueAufgaben { titel: vec![eintrag], board: neu.board.clone(), spalte: neu.spalte.clone() };
        Ok(self.aufgaben_anlegen(wer, &mehrere)?.remove(0))
    }

    /// Mehrere Aufgaben mit fortlaufenden Nummern in der Reihenfolge der Liste — ein Commit für alle.
    /// Mit Board zählt die Zielspalte nach allen neuen; ein Agent über der Grenze legt keine an (R00096).
    /// Ein Eintrag mit `key`, den schon eine Karte trägt (auch ein früherer Eintrag derselben Anfrage), legt nichts an (R00098).
    pub fn aufgaben_anlegen(&self, wer: &Person, neu: &NeueAufgaben) -> Result<Vec<Angelegt>, Fehler> {
        self.aufgaben_anlegen_gesperrt(&self.gesperrt(), wer, neu)
    }

    /// Suchen und Schreiben unter derselben Sperre (ADR-0004): wer sie hält, sieht jede Karte, die ein früherer Aufruf anlegte.
    pub(super) fn aufgaben_anlegen_gesperrt(&self, _sperre: &MutexGuard<'_, ()>, wer: &Person, neu: &NeueAufgaben) -> Result<Vec<Angelegt>, Fehler> {
        let eintraege: Vec<(&str, Option<&Angaben>)> = neu.titel.iter().map(Eintrag::teile).collect();
        if eintraege.is_empty() || eintraege.iter().any(|(t, _)| t.is_empty()) {
            return Err(Fehler::Ungueltig("Jede Aufgabe braucht einen Titel".into()));
        }
        let schluessel = eintraege.iter().map(|(_, g)| g.and_then(|g| g.key.as_deref()).map(Fremdschluessel::pruefen).transpose()).collect::<Result<Vec<_>, _>>().map_err(Fehler::Ungueltig)?;
        let e = self.ordner().einstellungen()?.unwrap_or_default();
        let (vorhanden, _) = if neu.board.is_some() || schluessel.iter().any(Option::is_some) { self.ordner().aufgaben()? } else { Default::default() };
        let erste = self.ordner().naechste_nummer()?;
        let mut aufgaben: Vec<Aufgabe> = vec![];
        let mut plan: Vec<(u32, bool)> = vec![];
        for ((t, angaben), k) in eintraege.iter().zip(&schluessel) {
            if let Some(nr) = k.as_ref().and_then(|k| schon_da(&aufgaben, &vorhanden, k)) {
                plan.push((nr, false));
                continue;
            }
            let nummer = erste + aufgaben.len() as u32;
            let mut a = Aufgabe::neu(nummer, aufgabe::dateiname(nummer, t), t.to_string());
            a.schluessel = k.clone();
            if wer.art == Art::Mensch {
                a.zustaendige.push(wer.kuerzel.clone());
            }
            if let Some(g) = angaben {
                let aenderung = Aufgabenaenderung {
                    klasse: g.klasse.clone().map(Some),
                    zustaendige: g.zustaendige.clone(),
                    labels: g.labels.clone(),
                    faellig: g.faellig.clone().map(Some),
                    herkunft: g.herkunft.clone(),
                    beschreibung: g.beschreibung.clone(),
                    ..Default::default()
                };
                a.aendern(&aenderung, &e).map_err(|f| Fehler::Ungueltig(format!("„{t}“: {f}")))?;
                let teile = g.teilaufgaben.iter().flatten().map(|x| x.trim().replace('\n', " ")).filter(|x| !x.is_empty());
                a.teilaufgaben.extend(teile.map(|text| crate::modell::Teilaufgabe { text, erledigt: false }));
            }
            plan.push((nummer, true));
            aufgaben.push(a);
        }
        #[cfg(test)]
        {
            let haken = self.zwischen_suche_und_schreiben.lock().unwrap().take();
            if let Some(haken) = haken {
                haken();
            }
        }
        if !aufgaben.is_empty() {
            self.neue_schreiben(wer, neu, &aufgaben, &vorhanden)?;
        }
        let karte = |nr: u32| aufgaben.iter().chain(&vorhanden).find(|a| a.nummer == nr).cloned().expect("geplante Karte ist bekannt");
        Ok(plan.into_iter().map(|(nr, neu)| Angelegt { aufgabe: karte(nr), neu }).collect())
    }

    /// Die neuen Dateien, mit Board unten in die Spalte — ein Commit.
    fn neue_schreiben(&self, wer: &Person, neu: &NeueAufgaben, aufgaben: &[Aufgabe], vorhanden: &[Aufgabe]) -> Result<(), Fehler> {
        let erste = aufgaben[0].nummer;
        let mut dateien: Vec<(String, String)> = aufgaben.iter().map(|a| (format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(a))).collect();
        let mut nachricht = match aufgaben {
            [a] => format!("#{} „{}“ angelegt", a.nummer, a.titel),
            alle => format!("#{}–#{} angelegt ({} Aufgaben)", erste, erste + alle.len() as u32 - 1, alle.len()),
        };
        if let Some(slug) = &neu.board {
            let mut b = self.ordner().board(slug)?;
            let spaltenname = match &neu.spalte {
                Some(s) => s.clone(),
                None => b.spalten.first().map(|s| s.name.clone()).ok_or_else(|| Fehler::Ungueltig(format!("Board „{}“ hat keine Spalte", b.titel)))?,
            };
            let vorher = b.clone();
            let spalte = b.spalte_mut(&spaltenname).ok_or_else(|| Fehler::Ungueltig(format!("Spalte „{spaltenname}“ gibt es auf „{slug}“ nicht")))?;
            spalte.aufgaben.extend(aufgaben.iter().map(|a| a.nummer));
            // Agent: 409 über der Grenze; Mensch: durchgelassen ohne Warnung, die Antwort bleibt die Aufgabe (R00096)
            zug_pruefen(wer.art, &vorher, &b, &archivierte(vorhanden))?;
            nachricht.push_str(&format!(" in „{spaltenname}“ ({})", b.titel));
            let text = crate::format::board::schreiben(&b, |nr| aufgaben.iter().chain(vorhanden.iter()).find(|a| a.nummer == nr).map(|a| a.datei.clone()));
            dateien.push((board_pfad(&b.slug), text));
        }
        self.aktion(wer, &nachricht, &dateien)
    }
}

/// Die Nummer der Karte, die den Schlüssel schon trägt — zuerst unter den neuen dieser Anfrage, dann im Ordner.
fn schon_da(neue: &[Aufgabe], vorhanden: &[Aufgabe], k: &Fremdschluessel) -> Option<u32> {
    match Schluesseltreffer::suchen(neue, k) {
        Schluesseltreffer::Offen(nr) => Some(nr),
        _ => match Schluesseltreffer::suchen(vorhanden, k) {
            Schluesseltreffer::Keiner => None,
            Schluesseltreffer::Offen(nr) | Schluesseltreffer::Archiviert(nr) => Some(nr),
            Schluesseltreffer::Mehrfach(nummern) => Some(nummern[0]),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::{Angaben, Eintrag, Kanban, NeueAufgaben};
    use std::path::Path;
    use std::process::Command;
    use std::sync::{Arc, mpsc};
    use std::thread;
    use std::time::Duration;

    fn git(pfad: &Path, args: &[&str]) -> String {
        let aus = Command::new("git").args(args).current_dir(pfad).output().unwrap();
        String::from_utf8_lossy(&aus.stdout).trim().to_string()
    }

    fn mit_schluessel(titel: &str, key: &str) -> NeueAufgaben {
        let angaben = Angaben { key: Some(key.into()), ..Default::default() };
        NeueAufgaben { titel: vec![Eintrag::MitAngaben { titel: titel.into(), angaben }], board: None, spalte: None }
    }

    // B0319 Prüfen-dann-Handeln: der erste Aufruf hält die Sperre zwischen Suche und Schreiben, der zweite läuft in dieser Zeit an
    #[test]
    fn gleichzeitig_genau_eine_karte() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("kanbanD.md"), "---\npeople:\n  cl: {name: Claude, kind: agent}\n---\n").unwrap();
        git(tmp.path(), &["init", "-q"]);
        git(tmp.path(), &["add", "-A"]);
        git(tmp.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
        let k = Arc::new(Kanban::neu(tmp.path().to_path_buf()));
        let cl = k.handelnder(Some("cl")).unwrap();

        let (zweiter_tx, zweiter_rx) = mpsc::channel();
        let (k2, cl2) = (Arc::clone(&k), cl.clone());
        *k.zwischen_suche_und_schreiben.lock().unwrap() = Some(Box::new(move || {
            let (fertig_tx, fertig_rx) = mpsc::channel();
            let lauf = thread::spawn(move || {
                let r = k2.aufgaben_anlegen(&cl2, &mit_schluessel("zweiter", "k2"));
                fertig_tx.send(()).ok();
                r
            });
            let durchgelaufen = fertig_rx.recv_timeout(Duration::from_secs(2)).is_ok();
            zweiter_tx.send((lauf, durchgelaufen)).unwrap();
        }));
        let vorher: usize = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();

        let erster = k.aufgaben_anlegen(&cl, &mit_schluessel("erster", "k2"));
        let (lauf, durchgelaufen) = zweiter_rx.recv().unwrap();
        let zweiter = lauf.join().unwrap();

        assert!(!durchgelaufen, "der zweite Aufruf kam durch, während der erste zwischen Suche und Schreiben stand");
        let (erster, zweiter) = (erster.unwrap(), zweiter.unwrap());
        assert_eq!((erster[0].aufgabe.nummer, erster[0].neu), (1, true));
        assert_eq!((zweiter[0].aufgabe.nummer, zweiter[0].neu), (1, false), "dieselbe Karte, nicht neu (→ 200)");
        let dateien: Vec<_> = std::fs::read_dir(tmp.path().join("aufgaben")).unwrap().map(|e| e.unwrap().file_name()).collect();
        assert_eq!(dateien, ["0001-erster.md"], "genau eine Datei mit k2");
        assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<usize>().unwrap(), vorher + 1, "ein Commit");
    }
}
