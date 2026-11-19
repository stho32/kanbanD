//! Commit-Liste einer Karte lesen (R00204, ADR-0032 Punkt 5 mit N1.2, N1.3, N3) — live aus den Arbeits-Repositories des
//! Registers, nur lesend und ohne die Sperre des Board-Ordners.

use super::Kanban;
use super::zweigcache::abdruck;
use crate::fehler::Fehler;
use crate::git::arbeitsrepo::{self, Arbeitsrepofehler, Metadaten, Objekt};
use crate::modell::{Anwendung, Anwendungen, Commiteintrag, Verweisform, Zustand, Zweige, titel_kuerzen, verweis_lesen};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

/// Grenze für den ganzen Aufruf ab Eingang der Anfrage (ADR-0032 N3.1); danach startet kein Git mehr, Antwort 503.
pub const GESAMTGRENZE: Duration = Duration::from_secs(10);

impl Kanban {
    /// `GET /api/aufgaben/{nr}/commits` — je Verweis der Karte genau ein Eintrag, Datum aufsteigend, Einträge ohne
    /// Metadaten danach in der Reihenfolge der Datei. Liest die Aufgabe ohne Sperre und schreibt nie; Git läuft nur bis
    /// `frist` (Eingang + [`GESAMTGRENZE`]), danach 503 — nie eine Teilantwort.
    pub fn commits_lesen(&self, nr: u32, frist: Instant) -> Result<Vec<Commiteintrag>, Fehler> {
        let aufgabe = self.ordner().aufgabe(nr)?;
        if aufgabe.commits.is_empty() {
            return Ok(vec![]);
        }
        let quellen = self.ordner().einstellungen()?.unwrap_or_default().quellen;
        let anwendungen = Anwendungen::aus(&quellen);
        let mut eintraege: Vec<Option<Commiteintrag>> = vec![None; aufgabe.commits.len()];
        let mut je_anwendung: Vec<(&Anwendung, Vec<(usize, &str, String)>)> = vec![];
        for (i, text) in aufgabe.commits.iter().enumerate() {
            match einordnen(text, &anwendungen) {
                Err(e) => eintraege[i] = Some(e),
                Ok(g) => match je_anwendung.iter_mut().find(|(a, _)| a.kuerzel == g.anwendung.kuerzel) {
                    Some((_, liste)) => liste.push((i, text, g.hash)),
                    None => je_anwendung.push((g.anwendung, vec![(i, text, g.hash)])),
                },
            }
        }
        let mut je_wurzel: Vec<(PathBuf, Vec<(usize, &str, &str, String)>)> = vec![];
        for (anwendung, verweise) in je_anwendung {
            match arbeitsrepo::wurzel_bis(self.ordner().wurzel(), anwendung, frist) {
                Ok(w) => {
                    let liste = verweise.into_iter().map(|(i, t, h)| (i, t, anwendung.kuerzel.as_str(), h));
                    match je_wurzel.iter_mut().find(|(x, _)| *x == w) {
                        Some((_, l)) => l.extend(liste),
                        None => je_wurzel.push((w, liste.collect())),
                    }
                }
                Err(f) => {
                    for (i, t, h) in verweise {
                        eintraege[i] = Some(repository_fehlt(t, &anwendung.kuerzel, &h, f.clone())?);
                    }
                }
            }
        }
        for (wurzel, verweise) in je_wurzel {
            match self.repository_lesen(&wurzel, &verweise, frist) {
                Ok(gelesen) => gelesen.into_iter().for_each(|(i, e)| eintraege[i] = Some(e)),
                Err(f @ Arbeitsrepofehler::RepositoryFehlt(_)) => {
                    for (i, t, k, h) in &verweise {
                        eintraege[*i] = Some(repository_fehlt(t, k, h, f.clone())?);
                    }
                }
                Err(f) => return Err(abbruch(f)),
            }
        }
        Ok(sortiert(eintraege.into_iter().flatten().collect()))
    }

    /// Alle Verweise eines Repositorys: Objekte, Metadaten, Fingerabdruck, Zweigliste für Commits ohne Cache-Treffer,
    /// am Ende die zweite Fingerabdruck-Probe und die Ablage (ADR-0032 N1.3, N3.2, N3.4).
    fn repository_lesen(&self, wurzel: &Path, verweise: &[(usize, &str, &str, String)], frist: Instant) -> Result<Vec<(usize, Commiteintrag)>, Arbeitsrepofehler> {
        let mut namen: Vec<&str> = verweise.iter().map(|(_, _, _, h)| h.as_str()).collect();
        namen.sort();
        namen.dedup();
        let objekte: HashMap<&str, Objekt> = namen.iter().copied().zip(arbeitsrepo::objekte_pruefen(wurzel, &namen, frist)?).collect();
        let mut commits: Vec<&str> = objekte.values().filter_map(|o| if let Objekt::Commit(h) = o { Some(h.as_str()) } else { None }).collect();
        commits.sort();
        commits.dedup();
        let (metadaten, zweige) = if commits.is_empty() { (HashMap::new(), HashMap::new()) } else { (arbeitsrepo::metadaten(wurzel, &commits, frist)?, self.zweige(wurzel, &commits, frist)?) };
        verweise.iter().map(|(i, text, kuerzel, hash)| Ok((*i, eintrag(text, kuerzel, hash, &objekte[hash.as_str()], &metadaten, &zweige)?))).collect()
    }

    /// Die Zweige je Commit: aus dem Cache unter dem Fingerabdruck, sonst ein Lauf Z5 für die übrigen; abgelegt wird nach
    /// der zweiten Probe, nur bei gleichem Fingerabdruck. Die Sperre des Caches hält nie über einen Git-Prozess.
    fn zweige(&self, wurzel: &Path, commits: &[&str], frist: Instant) -> Result<HashMap<String, Zweige>, Arbeitsrepofehler> {
        let fingerabdruck = arbeitsrepo::fingerabdruck(wurzel, frist)?;
        let schluessel = abdruck(&fingerabdruck);
        let mut ergebnis: HashMap<String, Zweige> = HashMap::new();
        {
            let cache = self.zweigcache.lock().unwrap_or_else(|p| p.into_inner());
            ergebnis.extend(commits.iter().filter_map(|c| cache.holen(wurzel, &schluessel, c).map(|z| (c.to_string(), z))));
        }
        let offen: Vec<&str> = commits.iter().copied().filter(|c| !ergebnis.contains_key(*c)).collect();
        if offen.is_empty() {
            return Ok(ergebnis);
        }
        let erreicht = arbeitsrepo::erreichbar(wurzel, &fingerabdruck, &offen, frist)?;
        let neu: Vec<(String, Zweige)> = offen.iter().map(|c| (c.to_string(), Zweige::aus(erreicht.get(*c).into_iter().flatten().map(String::as_str)))).collect();
        #[cfg(test)]
        if let Some(haken) = self.vor_der_probe.lock().unwrap().take() {
            haken();
        }
        // Scheitert die Probe, wird nur nichts abgelegt — die Antwort selbst gilt für den Fingerabdruck vom Beginn
        if let Ok(probe) = arbeitsrepo::fingerabdruck_probe(wurzel) {
            self.zweigcache.lock().unwrap_or_else(|p| p.into_inner()).ablegen(wurzel, &fingerabdruck, &probe, neu.clone());
        }
        ergebnis.extend(neu);
        Ok(ergebnis)
    }
}

/// Zeitgrenze und Zeilengrenze → 503 ohne Liste; alles andere ist ein Fehler des Programms.
fn abbruch(f: Arbeitsrepofehler) -> Fehler {
    match f {
        Arbeitsrepofehler::Zeitgrenze => Fehler::Zeitgrenze(format!("Git in einem Arbeits-Repository antwortete nicht innerhalb von {} s — keine Liste", GESAMTGRENZE.as_secs())),
        Arbeitsrepofehler::ZuvielAusgabe(n) => Fehler::Zeitgrenze(format!("die Zweigliste eines Arbeits-Repositorys hat mehr als {n} Zeilen — keine Liste")),
        Arbeitsrepofehler::RepositoryFehlt(m) | Arbeitsrepofehler::Start(m) => Fehler::Intern(format!("git: {m}")),
        Arbeitsrepofehler::KeinCommit => Fehler::Intern("git: kein Commit".into()),
    }
}

/// Ein Verweis eines Repositorys, das fehlt oder das Git verweigert; Zeitgrenze und Co. brechen die Anfrage ab.
fn repository_fehlt(text: &str, kuerzel: &str, hash: &str, f: Arbeitsrepofehler) -> Result<Commiteintrag, Fehler> {
    match f {
        Arbeitsrepofehler::RepositoryFehlt(grund) => Ok(Commiteintrag { anwendung: Some(kuerzel.into()), hash: Some(hash.into()), grund: Some(grund), ..Commiteintrag::neu(text, Zustand::RepositoryFehlt) }),
        anders => Err(abbruch(anders)),
    }
}

/// Der Eintrag eines Verweises, dessen Repository gelesen ist.
fn eintrag(text: &str, kuerzel: &str, hash: &str, objekt: &Objekt, metadaten: &HashMap<String, Metadaten>, zweige: &HashMap<String, Zweige>) -> Result<Commiteintrag, Arbeitsrepofehler> {
    let basis = |zustand| Commiteintrag { anwendung: Some(kuerzel.into()), hash: Some(hash.into()), ..Commiteintrag::neu(text, zustand) };
    let unlesbar = |grund: String| Commiteintrag { grund: Some(grund), ..basis(Zustand::Unlesbar) };
    let wert = crate::nachricht::wert(hash);
    Ok(match objekt {
        Objekt::Fehlt => basis(Zustand::Fehlt),
        Objekt::Mehrdeutig => unlesbar(format!("Kurz-Hash „{wert}“ passt zu mehreren Objekten — längeren Hash nennen")),
        Objekt::NameEinesRefs => unlesbar(format!("„{wert}“ ist zugleich der Name eines Zweigs oder Tags — vollen Hash nennen")),
        Objekt::Commit(voll) => {
            let m = metadaten.get(voll).ok_or_else(|| Arbeitsrepofehler::Start(format!("keine Metadaten zu {voll}")))?;
            let z = zweige.get(voll).cloned().unwrap_or_default();
            let mut e = Commiteintrag { hash: Some(voll.clone()), titel: Some(titel_kuerzen(&m.titel)), autor: Some(m.autor.clone()), datum: Some(m.datum.clone()), plus: Some(m.plus), minus: Some(m.minus), dateien: Some(m.dateien), ..basis(Zustand::Verwaist) };
            if !z.leer() {
                e.zustand = Zustand::AufZweig;
                e.zweige_weitere = (z.weitere > 0).then_some(z.weitere);
                e.zweige = Some(z.lokal);
                e.entfernte_zweige = Some(z.entfernt);
            }
            e
        }
    })
}

/// Datum aufsteigend nach dem Zeitpunkt (nicht nach dem Text), bei Gleichstand in der Reihenfolge der Datei; Einträge
/// ohne Datum danach, ebenfalls in der Reihenfolge der Datei.
fn sortiert(mut eintraege: Vec<Commiteintrag>) -> Vec<Commiteintrag> {
    let zeitpunkt = |e: &Commiteintrag| e.datum.as_deref().and_then(|d| chrono::DateTime::parse_from_rfc3339(d).ok()).map(|d| d.timestamp());
    eintraege.sort_by_key(|e| match zeitpunkt(e) {
        Some(t) => (0, t),
        None => (1, 0),
    });
    eintraege
}

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
    use std::process::Command;

    fn git(r: &Path, args: &[&str]) -> String {
        let a = Command::new("git").arg("-C").arg(r).args(["-c", "user.name=A", "-c", "user.email=a@a"]).args(args).output().unwrap();
        assert!(a.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&a.stderr));
        String::from_utf8_lossy(&a.stdout).trim().to_string()
    }

    /// Arbeits-Repository mit `main` (c1, c2) und Zweig `b` auf c1; Board-Ordner mit #1, an der beide Verweise stehen.
    struct Stand {
        _tmp: tempfile::TempDir,
        r: PathBuf,
        c1: String,
        c2: String,
        k: Kanban,
    }

    fn stand() -> Stand {
        let tmp = tempfile::tempdir().unwrap();
        let basis = tmp.path().canonicalize().unwrap();
        let (r, board) = (basis.join("R"), basis.join("board"));
        std::fs::create_dir_all(r.join("Planung")).unwrap();
        std::fs::write(r.join("Planung/app.md"), "# App\n").unwrap();
        git(&r, &["init", "-q", "-b", "main"]);
        git(&r, &["add", "-A"]);
        git(&r, &["commit", "-qm", "c1"]);
        let c1 = git(&r, &["rev-parse", "HEAD"]);
        git(&r, &["commit", "-q", "--allow-empty", "-m", "c2"]);
        let c2 = git(&r, &["rev-parse", "HEAD"]);
        git(&r, &["branch", "b", &c1]);
        std::fs::create_dir_all(board.join("aufgaben")).unwrap();
        std::fs::create_dir_all(board.join("boards")).unwrap();
        std::fs::write(board.join("kanbanD.md"), format!("---\npeople:\n  entw1: {{name: E, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Planung/app.md, requirements: \"\"}}\n---\n", r.display())).unwrap();
        std::fs::write(board.join("aufgaben/0001-a.md"), format!("---\nid: 1\ntitle: a\ncommits:\n  - kd:{c1}\n  - kd:{c2}\n---\n")).unwrap();
        std::fs::write(board.join("boards/fabrik.md"), "# Fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-a.md)\n").unwrap();
        git(&board, &["init", "-q"]);
        git(&board, &["add", "-A"]);
        git(&board, &["commit", "-qm", "Fabrik"]);
        Stand { _tmp: tmp, r, c1, c2, k: Kanban::neu(board) }
    }

    fn frist() -> Instant {
        Instant::now() + GESAMTGRENZE
    }

    /// Liest die Liste und zählt die Git-Prozesse dabei.
    fn lesen_und_zaehlen(s: &Stand) -> (Vec<Commiteintrag>, usize) {
        let vorher = arbeitsrepo::aufrufe();
        let liste = s.k.commits_lesen(1, frist()).unwrap();
        (liste, arbeitsrepo::aufrufe() - vorher)
    }

    fn zweige_von(liste: &[Commiteintrag], h: &str) -> (Zustand, Option<Vec<String>>) {
        let e = liste.iter().find(|e| e.hash.as_deref() == Some(h)).unwrap();
        (e.zustand, e.zweige.clone())
    }

    // R00204 AK 11, ADR-0032 N3.2: kalt 6 Prozesse (Wurzel, cat-file, log, Fingerabdruck, Zweigliste, Probe), aus dem
    // Cache 4 ohne Zweigliste; nach Bewegen eines Zweigs wieder die Zweigliste und kein veraltetes Ergebnis
    #[test]
    fn zweite_liste_aus_dem_cache() {
        let s = stand();
        let (kalt, n) = lesen_und_zaehlen(&s);
        assert_eq!(n, 6);
        assert_eq!(zweige_von(&kalt, &s.c1), (Zustand::AufZweig, Some(vec!["b".into(), "main".into()])));
        let (warm, n) = lesen_und_zaehlen(&s);
        assert_eq!(n, 4, "kein rev-list, keine Probe");
        assert_eq!(warm, kalt);
        assert_eq!(s.k.zweigcache.lock().unwrap().len(), 2);
        git(&s.r, &["branch", "-f", "b", &s.c2]);
        let (neu, n) = lesen_und_zaehlen(&s);
        assert_eq!(n, 6, "Zweig bewegt: Zweigliste neu");
        assert_eq!(zweige_von(&neu, &s.c2), (Zustand::AufZweig, Some(vec!["b".into(), "main".into()])));
    }

    // ADR-0032 N3.2: bewegt sich ein Zweig zwischen erstem und zweitem Fingerabdruck, wird nichts abgelegt — auch wenn er
    // danach zurückkehrt, rechnet der nächste Aufruf die Zweigliste neu
    #[test]
    fn zweig_bewegt_vor_der_probe_legt_nichts_ab() {
        let s = stand();
        let (r, c2) = (s.r.clone(), s.c2.clone());
        *s.k.vor_der_probe.lock().unwrap() = Some(Box::new(move || {
            git(&r, &["branch", "-f", "b", &c2]);
        }));
        let (liste, _) = lesen_und_zaehlen(&s);
        assert_eq!(zweige_von(&liste, &s.c2), (Zustand::AufZweig, Some(vec!["main".into()])), "die Antwort gilt für den Fingerabdruck vom Beginn");
        assert!(s.k.zweigcache.lock().unwrap().is_empty(), "nichts abgelegt");
        git(&s.r, &["branch", "-f", "b", &s.c1]);
        let (_, n) = lesen_und_zaehlen(&s);
        assert_eq!(n, 6, "der alte Fingerabdruck trifft nichts im Cache");
        // hin und zurück zwischen den Proben: der Fingerabdruck ist gleich, das Ergebnis stammt aus seinen Spitzen und stimmt
        let (r, c1, c2) = (s.r.clone(), s.c1.clone(), s.c2.clone());
        s.k.zweigcache.lock().unwrap().ablegen(Path::new("/"), "", "", vec![]);
        *s.k.vor_der_probe.lock().unwrap() = Some(Box::new(move || {
            git(&r, &["branch", "-f", "b", &c2]);
            git(&r, &["branch", "-f", "b", &c1]);
        }));
        let neu = Kanban::neu(s.k.ordner().wurzel().to_path_buf());
        *neu.vor_der_probe.lock().unwrap() = s.k.vor_der_probe.lock().unwrap().take();
        let kalt = neu.commits_lesen(1, frist()).unwrap();
        let warm = neu.commits_lesen(1, frist()).unwrap();
        assert_eq!(warm, kalt);
        assert_eq!(zweige_von(&warm, &s.c1), (Zustand::AufZweig, Some(vec!["b".into(), "main".into()])));
    }

    // R00204 AK 8: hält ein Schreiber die Sperre des Board-Ordners, antwortet das Lesen trotzdem, ohne auf ihn zu warten
    #[test]
    fn lesen_wartet_nicht_auf_die_sperre() {
        let s = stand();
        let _schreiber = s.k.sperre.lock().unwrap();
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::scope(|bereich| {
            bereich.spawn(|| tx.send(s.k.commits_lesen(1, frist()).map(|l| l.len())).unwrap());
            assert_eq!(rx.recv_timeout(Duration::from_secs(5)).expect("Lesen wartet auf die Sperre").unwrap(), 2);
        });
    }

    // ADR-0032 N3.1: ist die Gesamtgrenze vorbei, kommt 503 und es startet kein Git; eine Karte ohne Verweise startet nie Git
    #[test]
    fn abgelaufene_gesamtgrenze_ist_503() {
        let s = stand();
        let vorher = arbeitsrepo::aufrufe();
        assert!(matches!(s.k.commits_lesen(1, Instant::now()), Err(Fehler::Zeitgrenze(_))));
        assert_eq!(arbeitsrepo::aufrufe() - vorher, 0);
    }

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
