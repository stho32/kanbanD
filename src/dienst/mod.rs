//! Die Anwendungsfälle: prüfen, Dateien schreiben, committen — unter einer Schreibsperre.

mod anhaenge;
mod anwendungen;
mod archiv;
mod aufgabenfilter;
mod berichtsfilter;
mod braucht;
mod bestand;
mod aufgabe_aendern;
mod aufgabe_anlegen;
mod bewegen;
mod bindung;
mod commits;
mod commits_lesen;
pub mod nachfolger;
pub use commits_lesen::GESAMTGRENZE;
pub mod antwortbudget;
pub mod diff;
mod gesamt_diff;
pub use gesamt_diff::Gesamtdiff;
mod zweigcache;
mod lesegrenze;
mod board_anlegen;
mod board_lesen;
mod board_verwalten;
mod durchlaeufe;
mod einrichten;
mod einstellungen;
mod erledigen;
mod fieber;
mod klassen;
mod kommentare;
mod kosteneintraege;
mod reservierung;
mod schalter;
mod signale;
mod spalten;
mod teilaufgaben;
mod termine;
mod timer;
pub(crate) mod transkripte;
mod verlauf;
mod zeiten;
mod zugregeln;
mod zuordnung;

pub use anhaenge::{Anhang, anhangname_bereinigen, freier_name};
pub use anwendungen::{Einstellungsantwort, Erreichbar, Quellenantwort, Registereintrag, RepositoryErreichbar};
pub use aufgabenfilter::{Archivierte, Aufgabenfilter};
pub use durchlaeufe::NeuerDurchlauf;
pub use reservierung::{Gezogen, Zug, erste_freie, instanz_pruefen};
pub use aufgabe_anlegen::{Angelegt, NeueAufgabe, NeueAufgaben, Zielort};
pub use bewegen::{Bewegt, Bewegung};
pub use board_lesen::BoardMitHinweisen;
pub use teilaufgaben::Teilaufgabenaenderung;
pub use zeiten::{Zeitkorrektur, Zeitnachtrag};
pub use commits::{Commitangaben, Ersetzungsangaben, Ersetzungspaar, Ersetzungsplan, HOECHSTZAHL_COMMITS};
pub use kosteneintraege::{HOECHSTZAHL_KOSTENEINTRAEGE, Kosteneintragsangaben};
pub use board_anlegen::{NeuesBoard, STANDARDSPALTEN};
pub use board_verwalten::BoardVerwalten;
pub use einrichten::{Einrichtung, NeuePerson};
pub use schalter::{Schalterantwort, nur_menschen_schalten};
pub use erledigen::{Erledigt, Erledigung, Erledigungsergebnis};
pub use einstellungen::{Einstellungsvorschau, PALETTE, PersonAenderung, Personenangabe, farbe_gueltig};

use crate::ablage::{DefekteDatei, Ordner};
use crate::fehler::Fehler;
use crate::git;
use crate::waechter::Eigene;
use crate::format::board;
use crate::modell::{Aufgabe, Board, Einstellungen, Person};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Kanban {
    ordner: Ordner,
    sperre: Mutex<()>,
    eigene: Eigene,
    /// Startsekunde je laufendem Timer (Aufgabe, Kürzel) — die Datei kennt nur Minuten (R00068)
    timer_beginn: Mutex<HashMap<(u32, String), std::time::Instant>>,
    /// flüchtiger Cache der Zweiglisten je Arbeits-Repository (R00204, ADR-0032 N1.3); nie während eines Git-Prozesses gesperrt
    zweigcache: Mutex<zweigcache::Zweigcache>,
    /// höchstens 4 Lesevorgänge in Arbeits-Repositories gleichzeitig (Nacharbeit #211, Security Muss 3)
    lesegrenze: lesegrenze::Lesegrenze,
    /// Platz aller Antworten 200 von `GET …/diff`, bis der Client sie gelesen hat (ADR-0032 N5.1)
    antwortbudget: antwortbudget::Antwortbudget,
    /// Bytegrenze des Namenslaufs im Gesamt-Diff (R00208, ADR-0032 N6.8); Tests verkleinern sie (AK 4)
    grenze_namen: usize,
    /// Bytegrenze von Netto-Liste und Netto-Zähler des Gesamt-Diffs mit `datei=` (ADR-0032 N8.6 Punkt 4 (a)); Tests
    /// verkleinern sie (R00225 AK 6 D2)
    grenze_netto_datei: usize,
    /// Bytegrenze von Roh- und Zähler-Lauf der Folge-Liste ohne `datei=` (R00255, ADR-0032 N10.3 Punkt 1); Tests
    /// verkleinern sie (AK 6)
    grenze_folge_liste: usize,
    /// Testnaht (R00206 B1015): läuft einmal direkt nach dem Belegen des Antwortbudgets, mit der Zahl belegter Plätze der
    /// Lesegrenze
    #[cfg(test)]
    nach_dem_belegen: Mutex<Option<Box<dyn FnOnce(usize) + Send>>>,
    /// Testnaht (R00204 B1001): läuft einmal zwischen Zweigliste und zweiter Fingerabdruck-Probe
    #[cfg(test)]
    vor_der_probe: Mutex<Option<Box<dyn FnOnce() + Send>>>,
    /// Testnaht (R00098 B0319): läuft beim Anlegen einmal zwischen Suche und Schreiben, unter der Sperre
    #[cfg(test)]
    zwischen_suche_und_schreiben: Mutex<Option<Box<dyn FnOnce() + Send>>>,
    /// Testnaht (R00118 B0538): läuft beim Ziehen einmal zwischen Grenzprüfung und `aktion()`, unter der Sperre
    #[cfg(test)]
    zwischen_grenzpruefung_und_aktion: Mutex<Option<Box<dyn FnOnce() + Send>>>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct BoardKopf {
    pub slug: String,
    pub titel: String,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct Zustand {
    pub ordner: String,
    pub eingerichtet: bool,
    pub einstellungen: Option<Einstellungen>,
    pub boards: Vec<BoardKopf>,
    pub defekte: Vec<DefekteDatei>,
    /// R00098: Schlüssel, die mehrere Karten tragen — wie doppelte Nummern unter `defekte`
    pub dubletten: Vec<crate::modell::Dublette>,
}

/// Ein Schritt einer [`Kanban::aktion`] (R00141, ADR-0024): eine Datei **schreiben** oder **entfernen**. Der Entfernen-
/// Schritt ersetzt den bisher eigenen Löschweg `entfernen()` — **ein** Weg, **ein** Commit (ADR-0005).
pub(crate) enum Schritt {
    Schreiben { pfad: String, text: String },
    Entfernen { pfad: String },
}

impl Schritt {
    /// Eine Datei mit `text` schreiben.
    pub(crate) fn schreiben(pfad: impl Into<String>, text: impl Into<String>) -> Schritt {
        Schritt::Schreiben { pfad: pfad.into(), text: text.into() }
    }

    /// Eine Datei entfernen; ein fehlender Pfad zählt in `aktion` nicht.
    pub(crate) fn entfernen(pfad: impl Into<String>) -> Schritt {
        Schritt::Entfernen { pfad: pfad.into() }
    }

    fn pfad(&self) -> &str {
        match self {
            Schritt::Schreiben { pfad, .. } | Schritt::Entfernen { pfad } => pfad,
        }
    }
}

impl Kanban {
    pub fn neu(wurzel: PathBuf) -> Kanban {
        Kanban { ordner: Ordner::neu(wurzel), sperre: Mutex::new(()), eigene: Eigene::default(), timer_beginn: Mutex::default(), zweigcache: Mutex::default(), lesegrenze: lesegrenze::Lesegrenze::default(), antwortbudget: antwortbudget::Antwortbudget::default(), grenze_namen: crate::modell::GRENZE_NAMEN, grenze_netto_datei: crate::modell::GRENZE_DATEILISTE_EINZELN, grenze_folge_liste: crate::modell::GRENZE_DATEILISTE,
            #[cfg(test)]
            nach_dem_belegen: Mutex::default(),
            #[cfg(test)]
            vor_der_probe: Mutex::default(),
            #[cfg(test)]
            zwischen_suche_und_schreiben: Mutex::default(),
            #[cfg(test)]
            zwischen_grenzpruefung_und_aktion: Mutex::default(),
        }
    }

    pub fn ordner(&self) -> &Ordner {
        &self.ordner
    }

    /// Was kanbanD selbst geschrieben hat — der Wächter unterscheidet so eigene von externen Änderungen.
    pub fn eigene(&self) -> Eigene {
        self.eigene.clone()
    }

    pub fn zustand(&self) -> Result<Zustand, Fehler> {
        let mut defekte = vec![];
        let einstellungen = match self.ordner.einstellungen() {
            // die Antwortform des Registers: `repository` als Startordner (ADR-0034 N2 Regel 2) — gelesen, nicht geschrieben
            Ok(e) => e.map(|mut e| {
                e.repository_ergaenzen();
                e
            }),
            Err(Fehler::Defekt(f)) => {
                defekte.push(DefekteDatei::neu(crate::format::einstellungen::DATEI, f));
                None
            }
            Err(f) => return Err(f),
        };
        let (boards, defekte_boards) = self.ordner.boards()?;
        defekte.extend(defekte_boards);
        let (aufgaben, defekte_aufgaben) = self.ordner.aufgaben()?;
        defekte.extend(defekte_aufgaben);
        Ok(Zustand {
            ordner: self.ordner.wurzel().to_string_lossy().into(),
            eingerichtet: self.ordner.existiert(crate::format::einstellungen::DATEI),
            einstellungen,
            boards: boards.into_iter().filter(|b| b.archiviert.is_none()).map(|b| BoardKopf { slug: b.slug, titel: b.titel }).collect(),
            defekte,
            dubletten: crate::modell::doppelte_schluessel(&aufgaben),
        })
    }

    /// Die handelnde Person zum Kürzel aus `X-KanbanD-Wer`: eingetragen und aktiv.
    pub fn handelnder(&self, kuerzel: Option<&str>) -> Result<Person, Fehler> {
        let kuerzel = kuerzel.map(str::trim).filter(|k| !k.is_empty()).ok_or_else(|| Fehler::Ungueltig("Wer handelt? Header X-KanbanD-Wer fehlt".into()))?;
        let e = self.ordner.einstellungen()?.ok_or_else(|| Fehler::Konflikt("Der Ordner ist noch nicht eingerichtet".into()))?;
        let p = e.person(kuerzel).ok_or_else(|| Fehler::Ungueltig(format!("Person „{kuerzel}“ steht nicht in kanbanD.md")))?;
        if !p.aktiv {
            return Err(Fehler::Ungueltig(format!("Person „{kuerzel}“ ist stillgelegt")));
        }
        Ok(p.clone())
    }

    pub(crate) fn eigene_merken(&self, rel: &str) {
        self.eigene.merken(rel);
    }

    pub(crate) fn committen(&self, wer: &Person, nachricht: &str, pfade: &[String]) -> Result<(), Fehler> {
        git::committen(self.ordner.wurzel(), pfade, wer, nachricht)?;
        Ok(())
    }

    /// Führt die Schritte einer Aktion aus und committet sie als **eine** Aktion (ADR-0005, ADR-0024). Jeder Schritt
    /// **schreibt** oder **entfernt** eine Datei; vor dem ersten Schritt prüft sie alle Pfade beider Arten (ADR-0008,
    /// zweite Linie): ein Pfad außerhalb des Ordners oder doppelt ⇒ `Fehler::Intern`, ohne dass etwas geschrieben oder
    /// entfernt ist. Ein Entfernen-Schritt auf einen fehlenden Pfad zählt nicht. Ändert sich nichts, entsteht kein Commit.
    fn aktion(&self, autor: &Person, nachricht: &str, schritte: &[Schritt]) -> Result<(), Fehler> {
        let alle: Vec<&str> = schritte.iter().map(Schritt::pfad).collect();
        crate::ablage::pfade_pruefen(&alle).map_err(|grund| Fehler::Intern(format!("Programmfehler, nichts geschrieben oder entfernt: {grund}")))?;
        let mut geaendert = vec![];
        for schritt in schritte {
            match schritt {
                Schritt::Schreiben { pfad, text } => {
                    self.eigene.merken(pfad);
                    self.ordner.schreib(pfad, text)?;
                    geaendert.push(pfad.clone());
                }
                Schritt::Entfernen { pfad } => {
                    if self.ordner().existiert(pfad) {
                        self.eigene_merken(pfad);
                        std::fs::remove_file(self.ordner().wurzel().join(pfad))?;
                        geaendert.push(pfad.clone());
                    }
                }
            }
        }
        git::committen(self.ordner.wurzel(), &geaendert, autor, nachricht)?;
        Ok(())
    }

    /// Text der Board-Datei; die Links zeigen auf die Dateinamen der Aufgaben (`neu` ist noch nicht auf der Platte).
    fn board_text(&self, b: &Board, neu: Option<&Aufgabe>) -> Result<String, Fehler> {
        let (aufgaben, _) = self.ordner.aufgaben()?;
        Ok(board::schreiben(b, |nr| {
            neu.filter(|a| a.nummer == nr).or_else(|| aufgaben.iter().find(|a| a.nummer == nr)).map(|a| a.datei.clone())
        }))
    }

    fn gesperrt(&self) -> std::sync::MutexGuard<'_, ()> {
        self.sperre.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// Eingangstür der Sammel-Wege (B0344): eine Nummer zweimal in einer Anfrage ist ungültige Eingabe (400) —
/// geprüft, bevor gelesen oder geschrieben wird, damit sie nie die zweite Linie in `aktion` erreicht.
pub(crate) fn ohne_doppelte(nummern: impl IntoIterator<Item = u32>) -> Result<(), Fehler> {
    let mut gesehen = std::collections::HashSet::new();
    match nummern.into_iter().find(|n| !gesehen.insert(*n)) {
        Some(n) => Err(Fehler::Ungueltig(format!("#{n} doppelt in der Anfrage — jede Aufgabe höchstens einmal"))),
        None => Ok(()),
    }
}

/// Höchstens so viele Einträge trägt eine Sammelanfrage (ADR-0044 E2, PO Z. 669): die längste Sperrdauer hängt nicht
/// an der Ordnergröße. 5000 ist erlaubt, 5001 wird abgewiesen. Eine Konstante, keine Einstellung.
pub const HOECHSTENS_EINTRAEGE: usize = 5000;

/// Die Grenze an der Tür der sieben Sammelwege (ADR-0044 E2): bis [`HOECHSTENS_EINTRAEGE`] Einträge sind erlaubt.
/// Geprüft **vor** `gesperrt()`, vor jedem Lesen und vor `ohne_doppelte` — nichts wird gelesen oder geschrieben, kein
/// Commit. Der Wortlaut steht wörtlich in `AI-Team/po-entscheidungen.md` Z. 670 (ohne Tausendertrenner, ohne Vorsatz
/// `#<nummer>: `, weil kein einzelner Eintrag scheitert) und ist an allen sieben Wegen derselbe. Nicht 413: das steht
/// in kanbanD für die Größe des Körpers in Bytes (`Fehler::ZuGross`, ADR-0036 Regel 5).
pub(crate) fn sammelgrenze_pruefen(anzahl: usize) -> Result<(), Fehler> {
    if anzahl > HOECHSTENS_EINTRAEGE {
        return Err(Fehler::Ungueltig(format!("Zu viele Einträge in einer Sammelanfrage: {anzahl}, höchstens {HOECHSTENS_EINTRAEGE} sind erlaubt. Bitte in Teilen senden.")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{Kanban, Schritt};
    use crate::fehler::Fehler;
    use std::path::Path;
    use std::process::Command;

    fn git(pfad: &Path, args: &[&str]) -> String {
        let aus = Command::new("git").args(args).current_dir(pfad).output().unwrap();
        String::from_utf8_lossy(&aus.stdout).trim().to_string()
    }

    // B0342/B0635: aktion() prüft alle Pfade **beider Arten** (Schreiben und Entfernen) vor dem ersten Schritt (ADR-0008 Option D)
    #[test]
    fn aktion_bricht_vor_dem_ersten_schreiben_ab() {
        let eltern = tempfile::tempdir().unwrap();
        let w = eltern.path().join("w");
        std::fs::create_dir_all(w.join("aufgaben/0001-a")).unwrap();
        std::fs::write(w.join("kanbanD.md"), "---\npeople:\n  cl: {name: Claude, kind: agent}\n---\n").unwrap();
        std::fs::write(w.join("aufgaben/0001-a.md"), "---\nid: 1\ntitle: a\n---\n").unwrap();
        std::fs::write(w.join("aufgaben/0001-a/bild.png"), "png").unwrap();
        git(&w, &["init", "-q"]);
        git(&w, &["add", "-A"]);
        git(&w, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "a"]);
        let k = Kanban::neu(w.clone());
        let cl = k.handelnder(Some("cl")).unwrap();
        let vorher = (git(&w, &["rev-list", "--count", "HEAD"]), std::fs::read(w.join("aufgaben/0001-a.md")).unwrap());
        let absolut = eltern.path().join("abs.md").to_string_lossy().into_owned();
        for zweiter in ["../x.md", absolut.as_str(), "aufgaben/x\0.md", "aufgaben/0001-a.md"] {
            // Schreiben: eine Datei überschreiben, dazu ein ungültiger Pfad — nichts wird geschrieben
            let schreiben = [Schritt::schreiben("aufgaben/0001-a.md", "überschrieben"), Schritt::schreiben(zweiter, "x")];
            let e = k.aktion(&cl, "Probe", &schreiben);
            assert!(matches!(e, Err(Fehler::Intern(_))), "Schreiben {zweiter:?}: {e:?}");
            assert_eq!((git(&w, &["rev-list", "--count", "HEAD"]), std::fs::read(w.join("aufgaben/0001-a.md")).unwrap()), vorher, "Schreiben {zweiter:?}: nichts geschrieben, kein Commit");
            // Entfernen: eine Datei entfernen, dazu ein ungültiger Pfad — nichts wird entfernt
            let entfernen = [Schritt::entfernen("aufgaben/0001-a.md"), Schritt::entfernen(zweiter)];
            let e = k.aktion(&cl, "Probe", &entfernen);
            assert!(matches!(e, Err(Fehler::Intern(_))), "Entfernen {zweiter:?}: {e:?}");
            assert!(w.join("aufgaben/0001-a.md").exists(), "Entfernen {zweiter:?}: die Datei ist noch da");
            assert_eq!(git(&w, &["rev-list", "--count", "HEAD"]), vorher.0.to_string(), "Entfernen {zweiter:?}: kein Commit");
        }
        assert!(!eltern.path().join("x.md").exists() && !eltern.path().join("abs.md").exists(), "nichts neben dem Ordner");
        assert!(w.join("aufgaben/0001-a/bild.png").exists(), "der Anhang bleibt");
        assert_eq!(git(&w, &["status", "--porcelain"]), "");
    }

    #[test]
    fn ohne_doppelte_nennt_die_erste_doppelte_nummer() {
        assert!(super::ohne_doppelte([1, 2, 3]).is_ok());
        let e = super::ohne_doppelte([1, 2, 1, 2]).unwrap_err();
        assert!(matches!(&e, Fehler::Ungueltig(m) if m.contains("#1 doppelt")), "{e:?}");
    }

    // R00257 AK 4 (ADR-0044 E2, PO Z. 670): die Grenze als reine Prüffunktion — die Spanne 4999/5000/5001, der
    // Wortlaut wörtlich, ohne Tausendertrenner und ohne Vorsatz `#<nummer>: `.
    #[test]
    fn sammelgrenze_prueft_die_spanne_und_den_wortlaut() {
        for anzahl in [0, 1, 4999, 5000] {
            assert_eq!(super::sammelgrenze_pruefen(anzahl), Ok(()), "{anzahl} ist erlaubt");
        }
        for anzahl in [5001, 12_000] {
            let e = super::sammelgrenze_pruefen(anzahl).unwrap_err();
            assert_eq!(
                e.meldung(),
                format!("Zu viele Einträge in einer Sammelanfrage: {anzahl}, höchstens 5000 sind erlaubt. Bitte in Teilen senden."),
                "{anzahl}"
            );
        }
    }

    // R00257 AK 4 (ADR-0044 E2): die Grenze steht **vor** `gesperrt()` — ein Test, der die Sperre hält, bekommt die
    // 400 auf 5001 Einträge sofort, ohne auf die Sperre zu warten; nichts wird gelesen (Zähler 0), kein Commit.
    #[test]
    fn grenze_wirkt_vor_der_sperre_ohne_zu_lesen() {
        use std::sync::{Arc, mpsc};
        use std::time::Duration;
        let (tmp, k) = ordner_mit_aufgaben(2);
        let k = Arc::new(k);
        let st = k.handelnder(Some("st")).unwrap();
        let commits = git(tmp.path(), &["rev-list", "--count", "HEAD"]);
        let sperre = k.gesperrt();
        let (k2, st2) = (Arc::clone(&k), st.clone());
        let (tx, rx) = mpsc::channel();
        let lauf = std::thread::spawn(move || {
            crate::ablage::zaehler::zuruecksetzen();
            let e = k2.mehrere_aendern(&st2, &(1..=5001).map(titelwechsel).collect::<Vec<_>>());
            let listings = crate::ablage::zaehler::listings();
            tx.send(()).ok();
            (e, listings)
        });
        let rechtzeitig = rx.recv_timeout(Duration::from_secs(2)).is_ok();
        drop(sperre);
        let (e, listings) = lauf.join().unwrap();
        assert!(rechtzeitig, "die Grenze wartet auf die Sperre, statt vor ihr zu greifen");
        assert_eq!(e.unwrap_err().meldung(), "Zu viele Einträge in einer Sammelanfrage: 5001, höchstens 5000 sind erlaubt. Bitte in Teilen senden.");
        assert_eq!(listings, 0, "die Grenze liest nichts");
        assert_eq!(git(tmp.path(), &["rev-list", "--count", "HEAD"]), commits, "kein Commit");
    }

    // ---- R00257 AK 1/AK 3 (I0247, ADR-0044 Prüfliste 1 und 3) --------------------------------------------------------

    /// Ausgangslage der Listing-Proben: ein Ordner mit `n` nummerierten Aufgaben (#1–#n), einem Board „entwicklung“
    /// ohne Zeilen und den Personen Stefan (Mensch) und Claude (Agent).
    fn ordner_mit_aufgaben(n: u32) -> (tempfile::TempDir, Kanban) {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("boards")).unwrap();
        std::fs::create_dir_all(tmp.path().join("aufgaben")).unwrap();
        std::fs::write(tmp.path().join("kanbanD.md"), "---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\n---\n").unwrap();
        for nr in 1..=n {
            std::fs::write(tmp.path().join(format!("aufgaben/{nr:04}-karte.md")), format!("---\nid: {nr}\ntitle: Karte {nr}\n---\n")).unwrap();
        }
        std::fs::write(tmp.path().join("boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n## Erledigt\n").unwrap();
        git(tmp.path(), &["init", "-q"]);
        git(tmp.path(), &["add", "-A"]);
        git(tmp.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgangslage"]);
        let k = Kanban::neu(tmp.path().to_path_buf());
        (tmp, k)
    }

    /// Ein Titelwechsel für die Nummer — sonst kein Feld, damit keine Klasse und kein `braucht:`-Label den Weg verbreitert.
    fn titelwechsel(nr: u32) -> (u32, crate::modell::Aufgabenaenderung) {
        (nr, crate::modell::Aufgabenaenderung { titel: Some(format!("neu {nr}")), ..Default::default() })
    }

    // R00257 AK 1 (ADR-0044 Prüfliste 1): für `mehrere_aendern`, `mehrere_archivieren` (beide Richtungen) und
    // `mehrere_auf_board_legen` hängt die Zahl der Listings von `aufgaben/` nicht von n ab und bleibt höchstens 3;
    // Einzeldateilesungen außerhalb der Einmal-Leser bleiben höchstens n + 1. Am Stand vor dem Fix ist der Zähler rot
    // (mindestens n Listings, eines je `aufgabenpfad`).
    #[test]
    fn sammelwege_listen_den_ordner_unabhaengig_von_n() {
        use crate::ablage::zaehler;
        let (_tmp, k) = ordner_mit_aufgaben(400);
        let st = k.handelnder(Some("st")).unwrap();
        // Weg → (n → (Listings, Einzeldateilesungen))
        let mut werte: std::collections::BTreeMap<&str, Vec<(u32, usize, usize)>> = std::collections::BTreeMap::new();
        let mut festhalten = |weg: &'static str, n: u32| werte.entry(weg).or_default().push((n, zaehler::listings(), zaehler::einzeldateien()));
        for n in [1u32, 10, 300] {
            let nummern: Vec<u32> = (1..=n).collect();
            zaehler::zuruecksetzen();
            k.mehrere_aendern(&st, &nummern.iter().map(|nr| titelwechsel(*nr)).collect::<Vec<_>>()).unwrap();
            festhalten("mehrere_aendern", n);
            zaehler::zuruecksetzen();
            k.mehrere_archivieren(&st, &nummern, true).unwrap();
            festhalten("mehrere_archivieren", n);
            zaehler::zuruecksetzen();
            k.mehrere_archivieren(&st, &nummern, false).unwrap();
            festhalten("zurueckholen", n);
            zaehler::zuruecksetzen();
            k.mehrere_auf_board_legen(&st, "entwicklung", &nummern, None).unwrap();
            festhalten("mehrere_auf_board_legen", n);
        }
        for (weg, reihe) in &werte {
            let listings: Vec<usize> = reihe.iter().map(|(_, l, _)| *l).collect();
            assert_eq!(listings[0], listings[2], "{weg}: Listings hängen von n ab: {reihe:?}");
            assert!(listings[2] <= 3, "{weg}: {} Listings bei n = 300, höchstens 3 erlaubt: {reihe:?}", listings[2]);
            for (n, _, einzel) in reihe {
                assert!(*einzel <= *n as usize + 1, "{weg}: {einzel} Einzeldateilesungen bei n = {n}, höchstens {} erlaubt", n + 1);
            }
        }
    }

    // R00257 AK 3 (ADR-0044 Prüfliste 3): die Momentaufnahme entsteht nach `gesperrt()`. Ein Test hält die Sperre und
    // legt in dieser Zeit `aufgaben/0010-neu.md` an; der zweite Faden startet `mehrere_aendern` mit dem Eintrag 10 und
    // läuft erst nach der Freigabe — die Änderung findet #10. Der Mutant „Momentaufnahme vor `gesperrt()`“ wird rot.
    #[test]
    fn momentaufnahme_entsteht_nach_der_sperre() {
        let (tmp, k) = ordner_mit_aufgaben(1);
        let k = std::sync::Arc::new(k);
        let st = k.handelnder(Some("st")).unwrap();
        let sperre = k.gesperrt();
        let (k2, st2) = (std::sync::Arc::clone(&k), st.clone());
        let lauf = std::thread::spawn(move || k2.mehrere_aendern(&st2, &[titelwechsel(10)]));
        // Die Datei entsteht, solange die Sperre gehalten ist; der zweite Faden kann `gesperrt()` erst danach nehmen.
        std::fs::write(tmp.path().join("aufgaben/0010-neu.md"), "---\nid: 10\ntitle: zehn\n---\n").unwrap();
        drop(sperre);
        let ergebnis = lauf.join().unwrap().unwrap();
        assert_eq!(ergebnis[0].nummer, 10);
        assert_eq!(ergebnis[0].titel, "neu 10", "die Momentaufnahme stammt aus der Zeit nach dem Warten");
        assert!(std::fs::read_to_string(tmp.path().join("aufgaben/0010-neu.md")).unwrap().contains("title: neu 10"));
    }
}
