//! Gesamt-Diff einer Karte lesen (R00208, ADR-0032 N6) — `GET …/diff` ohne `commit`: je Datei netto (Basis bis letzter
//! Kartencommit), wo kein fremder Commit der Spanne ihre Pfade berührt, sonst als Folge der Kartenschritte; nie eine
//! `+`/`−`-Zeile aus einem fremden Commit. Live aus dem Arbeits-Repository, nur lesend, ohne die Sperre des Board-Ordners,
//! mit den Grenzen und dem Antwortbudget des Diffs je Commit; höchstens 15 Git-Prozesse je Anfrage.

use super::Kanban;
use super::diff::{Diffantwort, Diffanfrage, Diffcommit, Diffformat, repo_fehler};
use crate::fehler::Fehler;
use crate::git::arbeitsrepo::{self, Arbeitsrepofehler, Diffart, Metadaten, Objekt, Teil, Umbenennungssuche, Vergleich, Vielart};
use crate::modell::{Anwendung, Anwendungen, Commitzustand, Diffdatei, EINTEILUNG_VERSION, Einteilung, Eintragspfade, FREMD_HOECHSTENS, Fassung, Folgedatei, GRENZE_DATEILISTE, GRENZE_EINZELN, GRENZE_PATCH_LAUF, GRENZEN_VERSION, Gesamtdatei, Grund, Hinweis, KAPPE_DATEIEN, Spanne, Verteilung, Verweisform, Zform, abschliessen, abschnitte_patch, abschnitte_z, diffdatei, folge_bilden, hinweiszeile, lauf_der_liste, im_bezug_zugeordnet, leerer_baum, namen_lesen, nicht_zugeordnet_im_bezug, ordnen, patch_text, patches_zuordnen, patches_zuordnen_im_bezug, roh_lesen, spanne_lesen, titel_kuerzen, verweis_lesen, zahlen_lesen};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::time::Instant;

/// Die Antwort von `GET …/diff` ohne `commit` (ADR-0032 N6.6).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Gesamtdiff {
    pub anwendung: String,
    /// absolute Wurzel des Arbeits-Repositorys dieser Anwendung aus `git rev-parse --show-toplevel` (R00236)
    pub wurzel: String,
    /// `{basis, letzter}` (volle Hashes, `basis` null beim leeren Baum); null bei `ganz_als_folge` und ohne einbezogene Commits
    pub spanne: Option<Spanne>,
    pub commits: Vec<Diffcommit>,
    pub dateien: Vec<Gesamtdatei>,
    pub hinweise: Vec<Hinweis>,
}

/// Ein Verweis der gewählten Anwendung: Text wörtlich, Hash wie im Verweis.
struct Verweis<'a> {
    text: &'a str,
    hash: String,
}

/// Ein einbezogener Kartencommit: Verweis wörtlich, voller Hash, Stelle in der Datei.
#[derive(Debug, Clone)]
struct Kartencommit {
    verweis: String,
    hash: String,
    stelle: usize,
}

impl Kanban {
    /// `GET /api/aufgaben/{nr}/diff` ohne `commit` (R00208): eine Anwendung je Antwort, ETag aus Verweisen, Zweigspitzen,
    /// Anwendung, `datei`, `format` und Version der Grenzen (304 nach Wurzel und Zweigspitzen).
    pub(super) fn gesamt_diff_lesen(&self, nr: u32, anfrage: &Diffanfrage, frist: Instant) -> Result<Diffantwort, Fehler> {
        let aufgabe = self.ordner().aufgabe(nr)?;
        let quellen = self.ordner().einstellungen()?.unwrap_or_default().quellen;
        let anwendungen = Anwendungen::aus(&quellen);
        let mut ausgelassen: Vec<Hinweis> = vec![];
        let mut je_anwendung: Vec<(&Anwendung, Vec<Verweis>)> = vec![];
        for text in &aufgabe.commits {
            if Verweisform::lesen(text).is_err() {
                ausgelassen.push(Hinweis::Ausgelassen { verweis: text.clone(), zustand: Commitzustand::Unlesbar });
                continue;
            }
            match verweis_lesen(text, &anwendungen) {
                Err(_) => ausgelassen.push(Hinweis::Ausgelassen { verweis: text.clone(), zustand: Commitzustand::AnwendungUnbekannt }),
                Ok((a, hash)) => match je_anwendung.iter_mut().find(|(x, _)| x.kuerzel == a.kuerzel) {
                    Some((_, l)) => l.push(Verweis { text, hash }),
                    None => je_anwendung.push((a, vec![Verweis { text, hash: hash.clone() }])),
                },
            }
        }
        let gewaehlt = match &anfrage.anwendung {
            Some(k) => je_anwendung.iter().position(|(a, _)| a.kuerzel == *k),
            None => (!je_anwendung.is_empty()).then_some(0),
        };
        let Some(gewaehlt) = gewaehlt else {
            return Err(Fehler::NichtGefunden(match &anfrage.anwendung {
                Some(k) => format!("#{nr} hat keinen Commit-Verweis der Anwendung „{}“", crate::nachricht::wert(k)),
                None => format!("#{nr} hat keine Commit-Verweise — nichts zu zeigen"),
            }));
        };
        let weitere: Vec<String> = je_anwendung.iter().enumerate().filter(|(i, _)| *i != gewaehlt).map(|(_, (a, _))| a.kuerzel.clone()).collect();
        let (anwendung, verweise) = &je_anwendung[gewaehlt];
        // ab hier startet Git: höchstens 4 Lesevorgänge gleichzeitig, das Warten zählt zur Frist
        let _platz = self.lesegrenze.betreten(frist).ok_or_else(|| super::lesegrenze::belegt("kein Diff"))?;
        let wurzel = arbeitsrepo::wurzel_bis(self.ordner().wurzel(), anwendung, frist).map_err(repo_fehler)?;
        let spitzen = arbeitsrepo::fingerabdruck(&wurzel, frist).map_err(repo_fehler)?;
        let etag = etag(&aufgabe.commits, &spitzen, &anwendung.kuerzel, &wurzel, anfrage);
        if anfrage.bekannt.as_deref().is_some_and(|b| b.split(',').any(|w| w.trim() == etag)) {
            return Ok(Diffantwort::Unveraendert(etag));
        }
        let mut lauf = Gesamtlauf { k: self, wurzel: &wurzel, frist, anfrage, nr };
        let diff = lauf.lesen(anwendung, verweise, &spitzen, weitere, ausgelassen, nr)?;
        let bytes = match anfrage.format {
            Diffformat::Json => serde_json::to_vec(&diff).map_err(|f| Fehler::Intern(format!("JSON: {f}")))?,
            Diffformat::Patch => text(diff).into_bytes(),
        };
        let rumpf = self.antwortbudget.belegen(bytes).ok_or_else(|| Fehler::antwortbudget(format!("Antwortbudget von {} MB belegt — Diff in einigen Sekunden erneut laden", super::antwortbudget::ANTWORTBUDGET >> 20)))?;
        Ok(Diffantwort::Rumpf { etag: Some(etag), format: anfrage.format, rumpf })
    }
}

/// Ein Gesamt-Diff im Bau: Kanban, Wurzel, Frist und Anfrage.
struct Gesamtlauf<'a> {
    k: &'a Kanban,
    wurzel: &'a Path,
    frist: Instant,
    anfrage: &'a Diffanfrage,
    nr: u32,
}

/// Ein Folge-Lauf: die Commits in der Reihenfolge der Schritte (Verweis, Vergleich) und die Pfadangabe (leer = alle).
struct Folgeplan {
    commits: Vec<(String, String, Option<String>)>,
    pfade: Vec<Vec<u8>>,
}

impl Gesamtlauf<'_> {
    fn git<T>(&self, r: Result<T, Arbeitsrepofehler>) -> Result<T, Fehler> {
        r.map_err(repo_fehler)
    }

    fn lesen(&mut self, anwendung: &Anwendung, verweise: &[Verweis], spitzen: &str, weitere: Vec<String>, ausgelassen: Vec<Hinweis>, nr: u32) -> Result<Gesamtdiff, Fehler> {
        let (wurzel, frist) = (self.wurzel, self.frist);
        let mut namen: Vec<&str> = verweise.iter().map(|v| v.hash.as_str()).collect();
        namen.sort();
        namen.dedup();
        let objekte: HashMap<&str, Objekt> = namen.iter().copied().zip(self.git(arbeitsrepo::objekte_pruefen(wurzel, &namen, frist))?).collect();
        let mut voll: Vec<&str> = objekte.values().filter_map(|o| if let Objekt::Commit(h) = o { Some(h.as_str()) } else { None }).collect();
        voll.sort();
        voll.dedup();
        let (metadaten, zweige) = if voll.is_empty() { (HashMap::new(), HashMap::new()) } else { (self.git(arbeitsrepo::metadaten(wurzel, &voll, frist))?, self.git(self.k.zweige_mit(wurzel, spitzen, &voll, frist))?) };
        // Hinweise je Verweis in der Reihenfolge der Datei, nach Art geordnet (ADR-0032 N6.7)
        let (mut verwaist, mut merges, mut fehlend) = (vec![], vec![], vec![]);
        let mut karte: Vec<Kartencommit> = vec![];
        for (stelle, v) in verweise.iter().enumerate() {
            match &objekte[v.hash.as_str()] {
                Objekt::Fehlt => fehlend.push(Hinweis::Ausgelassen { verweis: v.text.into(), zustand: Commitzustand::Fehlt }),
                Objekt::Mehrdeutig | Objekt::NameEinesRefs => fehlend.push(Hinweis::Ausgelassen { verweis: v.text.into(), zustand: Commitzustand::Unlesbar }),
                Objekt::Commit(h) if zweige.get(h).is_none_or(|z| z.leer()) => verwaist.push(Hinweis::Verwaist { verweis: v.text.into() }),
                Objekt::Commit(h) if metadaten.get(h).is_some_and(|m| m.elternzahl > 1) => merges.push(Hinweis::MergeAusgelassen { verweis: v.text.into() }),
                Objekt::Commit(h) if karte.iter().any(|k| k.hash == *h) => {}
                Objekt::Commit(h) => karte.push(Kartencommit { verweis: v.text.into(), hash: h.clone(), stelle }),
            }
        }
        let merges_der_karte: HashSet<String> = verweise.iter().filter_map(|v| match &objekte[v.hash.as_str()] {
            Objekt::Commit(h) if metadaten.get(h).is_some_and(|m| m.elternzahl > 1) => Some(h.clone()),
            _ => None,
        }).collect();
        let mut nachher: Vec<Hinweis> = vec![];
        if !weitere.is_empty() {
            nachher.push(Hinweis::WeitereAnwendungen { anwendungen: weitere });
        }
        nachher.extend(verwaist);
        nachher.extend(merges);
        nachher.extend(fehlend);
        nachher.extend(ausgelassen);
        let mut diff = Gesamtdiff { anwendung: anwendung.kuerzel.clone(), wurzel: wurzel.display().to_string(), spanne: None, commits: vec![], dateien: vec![], hinweise: vec![] };
        if karte.is_empty() {
            if self.anfrage.datei.is_some() {
                return Err(datei_fehlt(nr));
            }
            diff.hinweise = nachher;
            return Ok(diff);
        }
        let m = |h: &str| -> Result<&Metadaten, Fehler> { metadaten.get(h).ok_or_else(|| Fehler::Intern(format!("git: keine Metadaten zu {h}"))) };
        // Spanne (N6.1) oder ganz als Folge (N6.4)
        let kartenmenge: HashSet<&str> = karte.iter().map(|c| c.hash.as_str()).collect();
        let mut grund: Option<Grund> = None;
        let mut spanne = None;
        if karte.len() == 1 {
            spanne = Some(crate::modell::Spannenlauf { basis: m(&karte[0].hash)?.erster_elternteil.clone(), linie: vec![crate::modell::Linienpunkt { commit: karte[0].hash.clone(), eltern: m(&karte[0].hash)?.erster_elternteil.clone() }] });
        } else {
            let alle: Vec<&str> = karte.iter().map(|c| c.hash.as_str()).collect();
            let koepfe = self.git(arbeitsrepo::koepfe(wurzel, &alle, frist))?;
            match koepfe.as_slice() {
                [letzter] => {
                    let hoechstens = FREMD_HOECHSTENS + karte.len() + merges_der_karte.len() + 1;
                    let aus = self.git(arbeitsrepo::linie(wurzel, letzter, hoechstens, frist))?;
                    match spanne_lesen(&aus, &kartenmenge, hoechstens) {
                        Ok(s) => spanne = Some(s),
                        Err(g) => grund = Some(g),
                    }
                }
                _ => grund = Some(Grund::NichtLinear),
            }
        }
        let fremde: usize = spanne.as_ref().map_or(0, |s| s.linie.iter().filter(|p| !kartenmenge.contains(p.commit.as_str()) && !merges_der_karte.contains(&p.commit)).count());
        if fremde > FREMD_HOECHSTENS {
            (grund, spanne) = (Some(Grund::FremdZuViele), None);
        }
        // Namenslauf über die Spanne (N6.2 Schritt 4); abgeschnitten oder Pfadangabe zu lang → fremd_zu_gross — außer die
        // Spanne ist reine Kartenarbeit: dann ist D_fremd sicher leer, alles netto, und nur die Namen sind unvollständig (B3)
        let mut einteilung = None;
        let mut je_commit = HashMap::new();
        let mut namen_vollstaendig = true;
        if let Some(s) = &spanne {
            let vergleiche: Vec<Vergleich> = s.linie.iter().map(|p| Vergleich { commit: &p.commit, eltern: p.eltern.as_deref() }).collect();
            let koepfe: Vec<&str> = s.linie.iter().map(|p| p.commit.as_str()).collect();
            let teil = self.git(arbeitsrepo::diff_tree_viele(wurzel, &vergleiche, Vielart::Namen, &[], self.k.grenze_namen, frist))?;
            let nur_karte = s.linie.iter().all(|p| kartenmenge.contains(p.commit.as_str()));
            if teil.abgeschnitten && !nur_karte {
                grund = Some(Grund::FremdZuGross);
            } else {
                namen_vollstaendig = !teil.abgeschnitten;
                je_commit = namen_lesen(&teil.ausgabe, &koepfe).ok_or_else(|| Fehler::Intern("git: Namenslauf unlesbar".into()))?;
                let e = Einteilung::aus(&je_commit, &kartenmenge);
                if e.pfadangabe_zu_lang() {
                    grund = Some(Grund::FremdZuGross);
                } else {
                    einteilung = Some(e);
                }
            }
        }
        // Netto (N6.3): Liste und Zähler mit der Pfadangabe D_karte (ohne D_fremd ohne Angabe); startet Git mit der
        // Angabe nicht (Argumentgrenze), ist das wie eine zu lange Pfadangabe: ganz als Folge (N7.10 Punkt 3)
        let mut netto_laeufe: Option<(Teil, Teil)> = None;
        if let (Some(s), Some(e)) = (&spanne, &einteilung) {
            let letzter = s.linie.last().map(|p| p.commit.clone()).unwrap_or_default();
            let eltern = s.basis.clone().unwrap_or_else(|| leerer_baum(&letzter).to_string());
            let vergleich = Vergleich { eltern: Some(&eltern), commit: &letzter };
            let karte_pfade: Vec<&[u8]> = e.karte.iter().map(Vec::as_slice).collect();
            let pfade: &[&[u8]] = if e.fremd.is_empty() { &[] } else { &karte_pfade };
            // mit datei= bis 20 MB, dieselbe Pfadangabe, kein Prozess mehr (N8.6 Punkt 4 (a)); die Folge-Läufe behalten ihre Grenze
            let grenze = if self.anfrage.datei.is_some() { self.k.grenze_netto_datei } else { GRENZE_DATEILISTE };
            let roh = gestartet(arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Roh, Umbenennungssuche::Voll, pfade, grenze, frist)).map_err(repo_fehler)?;
            let zahlen = match roh {
                Some(_) => gestartet(arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Zahlen, Umbenennungssuche::Voll, pfade, grenze, frist)).map_err(repo_fehler)?,
                None => None,
            };
            match (roh, zahlen) {
                (Some(r), Some(z)) => netto_laeufe = Some((r, z)),
                _ => (grund, einteilung) = (Some(Grund::FremdZuGross), None),
            }
        }
        // Reihenfolge der Schritte: auf der Linie vom ältesten zum letzten; ganz als Folge wie die Liste
        let schritte: Vec<Kartencommit> = match (&spanne, grund) {
            (Some(s), None) => s.linie.iter().filter_map(|p| karte.iter().find(|c| c.hash == p.commit).cloned()).collect(),
            _ => {
                let mut k = karte.clone();
                let zeit = |c: &Kartencommit| metadaten.get(&c.hash).and_then(|m| chrono::DateTime::parse_from_rfc3339(&m.datum).ok()).map_or(i64::MAX, |d| d.timestamp());
                k.sort_by_key(|c| (zeit(c), c.stelle));
                k
            }
        };
        let diffcommits = |schritte: &[Kartencommit]| -> Result<Vec<Diffcommit>, Fehler> {
            schritte.iter().map(|c| {
                let m = m(&c.hash)?;
                Ok(Diffcommit { verweis: c.verweis.clone(), anwendung: anwendung.kuerzel.clone(), hash: c.hash.clone(), titel: titel_kuerzen(&m.titel), autor: m.autor.clone(), datum: m.datum.clone(), plus: m.plus, minus: m.minus, dateien: m.dateien })
            }).collect()
        };
        // Obergrenze der Einträge, wenn die Namen unvollständig sind: die Dateien der Kartenschritte zusammen (B3)
        let obergrenze = |schritte: &[Kartencommit]| -> Result<u64, Fehler> { schritte.iter().map(|c| Ok(m(&c.hash)?.dateien)).sum() };
        let mut einteilung = match (grund, einteilung) {
            (None, Some(e)) => e,
            _ => {
                // ganz als Folge: D_karte aus einem Namenslauf nur über die Kartencommits
                let vergleiche: Vec<Vergleich> = schritte.iter().map(|c| Ok(Vergleich { commit: &c.hash, eltern: m(&c.hash)?.erster_elternteil.as_deref() })).collect::<Result<_, Fehler>>()?;
                let koepfe: Vec<&str> = schritte.iter().map(|c| c.hash.as_str()).collect();
                let teil = self.git(arbeitsrepo::diff_tree_viele(wurzel, &vergleiche, Vielart::Namen, &[], crate::modell::GRENZE_NAMEN, frist))?;
                if teil.abgeschnitten {
                    // ohne vollständige Namen ist kein Folge-Eintrag sicher vollständig: keiner, Kappe mit Obergrenze (B3)
                    if self.anfrage.datei.is_some() {
                        return Err(zu_gross_fuer_datei(nr));
                    }
                    diff.hinweise.extend(grund.map(|g| Hinweis::GanzAlsFolge { grund: g }));
                    diff.hinweise.extend(nachher);
                    diff.hinweise.push(Hinweis::DateienGekappt { gezeigt: 0, gesamt: obergrenze(&schritte)? });
                    diff.commits = diffcommits(&schritte)?;
                    return Ok(diff);
                }
                je_commit = namen_lesen(&teil.ausgabe, &koepfe).ok_or_else(|| Fehler::Intern("git: Namenslauf unlesbar".into()))?;
                Einteilung::aus(&je_commit, &kartenmenge)
            }
        };
        let datei = self.anfrage.datei.as_deref();
        // ohne fremden Pfad und ohne Pfadangabe ist jeder Eintrag des Netto-Laufs Arbeit der Karte, auch wenn die Namen
        // unvollständig sind (B3)
        let alles_netto = einteilung.fremd.is_empty();
        // „steht in keinem Kartencommit“ gilt nur bei vollständig gelesenen Namen (R00255 AK 5, ADR-0032 N10.3 Punkt 3);
        // sonst entscheiden die Läufe, und bleibt die Auswahl leer, folgt `datei_hinter_dem_schnitt` (unten)
        if namen_vollstaendig && datei.is_some_and(|d| !einteilung.karte.contains(d.as_bytes())) {
            return Err(datei_fehlt(nr));
        }
        let mut netto: Vec<Diffdatei> = vec![];
        let mut netto_liste: Vec<Diffdatei> = vec![];
        let mut abgeschnitten = false;
        let mut netto_vollstaendig = true;
        let basis_vergleich = spanne.as_ref().filter(|_| grund.is_none()).map(|s| {
            let letzter = s.linie.last().map(|p| p.commit.clone()).unwrap_or_default();
            let basis = s.basis.clone();
            (basis, letzter)
        });
        if let (Some((basis, letzter)), Some((roh, zahlen))) = (&basis_vergleich, netto_laeufe.take()) {
            abgeschnitten |= roh.abgeschnitten || zahlen.abgeschnitten;
            netto_vollstaendig = !abgeschnitten;
            netto_liste = verbinden(&roh, &zahlen)?;
            netto = if alles_netto { netto_liste.clone() } else { einteilung.teilen(netto_liste.clone()).0 };
            diff.spanne = Some(Spanne { basis: basis.clone(), letzter: letzter.clone() });
        }
        // Folge (N8.6 Punkt 2): Kartenpfade ohne Netto-Eintrag in D_fremd oder in einer verdorbenen Gruppe (belastet oder mit
        // einem Pfad in einem verworfenen Netto-Eintrag, bis zum Fixpunkt in `teilen`); netto unveränderte Pfade erscheinen nirgends. Unbelastete Pfade hinter einer abgeschnittenen Liste sind netto und
        // zählen über `gesamt` (N8.3 Punkt 2, B3). Ganz als Folge: jeder Kartenpfad (N6.4)
        let gedeckt: HashSet<&[u8]> = netto.iter().flat_map(|d| d.pfade_roh.iter().map(Vec::as_slice)).collect();
        let folgepfade: HashSet<Vec<u8>> = match grund {
            Some(_) => einteilung.karte.iter().cloned().collect(),
            None => einteilung.folgepfade(&gedeckt),
        };
        let mut plan = Folgeplan { commits: vec![], pfade: vec![] };
        for c in &schritte {
            if je_commit.get(&c.hash).is_some_and(|es: &Vec<Eintragspfade>| es.iter().flatten().any(|p| folgepfade.contains(p))) {
                plan.commits.push((c.verweis.clone(), c.hash.clone(), m(&c.hash)?.erster_elternteil.clone()));
            }
        }
        if grund.is_none() {
            // abgeschlossen gegen die Einträge der Kartenschritte: Git paart im Folge-Lauf wie im Namenslauf (B2)
            let bezug: Vec<&[Vec<u8>]> = plan.commits.iter().flat_map(|(_, h, _)| je_commit.get(h).into_iter().flatten().map(Vec::as_slice)).collect();
            plan.pfade = abschliessen(folgepfade.iter().cloned(), &bezug);
        }
        let (mut folgen, unvollstaendig, folge_abgeschnitten, listen) = self.folge_listen(&plan, &folgepfade, &je_commit)?;
        abgeschnitten |= folge_abgeschnitten;
        // Hinweise vor den Arten aus A3 (N6.7)
        if let Some(g) = grund {
            diff.hinweise.push(Hinweis::GanzAlsFolge { grund: g });
        } else if fremde >= 1 && (!folgen.is_empty() || unvollstaendig > 0) {
            // auch wenn alle Folge-Einträge am Schnitt verworfen sind (Code-Review Sollte 3); ohne fremden Commit nie — belastet
            // dann nur ein Merge der Karte, und den nennt `merge_ausgelassen` (N8.3 Punkt 3)
            diff.hinweise.push(Hinweis::FremdDazwischen { commits: fremde, dateien: folgen.len() + unvollstaendig });
        }
        diff.hinweise.extend(nachher);
        // Einträge zusammen, nach dem Namen in Bytefolge, Kappe (ein Folge-Eintrag zählt einmal)
        let mut dateien: Vec<Gesamtdatei> = netto.into_iter().map(Gesamtdatei::Netto).chain(folgen.drain(..).map(Gesamtdatei::Folge)).collect();
        ordnen(&mut dateien);
        let mut gesamt = (dateien.len() + unvollstaendig) as u64;
        if abgeschnitten {
            gesamt = gesamt.max(einteilung.karte.len() as u64);
        }
        if !namen_vollstaendig {
            gesamt = gesamt.max(obergrenze(&schritte)?);
        }
        if let Some(name) = datei {
            dateien.retain(|d| d.name() == name);
            if dateien.is_empty() {
                // in Kartencommits, aber ohne Eintrag (N8.6 Punkt 4): ist kein Lauf abgeschnitten, netto unverändert oder
                // Zwischenname (c, PO Z. 509); sonst lässt sich das nicht sagen (d, PO Z. 514)
                return Err(if abgeschnitten || !namen_vollstaendig { datei_hinter_dem_schnitt(nr) } else { datei_ohne_aenderung(nr) });
            }
        } else {
            dateien.truncate(KAPPE_DATEIEN);
            if (dateien.len() as u64) < gesamt {
                diff.hinweise.push(Hinweis::DateienGekappt { gezeigt: dateien.len(), gesamt });
            }
        }
        // Patches: Netto zuerst, die Folge bekommt den Rest der 4 MB (mit datei= 8 MB)
        let fassung = match self.anfrage.format {
            Diffformat::Json => Fassung::Patch,
            Diffformat::Patch => Fassung::Stuecke,
        };
        let (budget, verteilung) = if datei.is_some() { (GRENZE_EINZELN, Verteilung::Einzeln) } else { (GRENZE_PATCH_LAUF, Verteilung::Liste) };
        let mut rest = budget;
        if let Some((basis, letzter)) = &basis_vergleich {
            let eltern = basis.clone().unwrap_or_else(|| leerer_baum(letzter).to_string());
            let vergleich = Vergleich { eltern: Some(&eltern), commit: letzter };
            let mut nettodateien: Vec<Diffdatei> = vec![];
            let mut stellen = vec![];
            for (i, d) in dateien.iter_mut().enumerate() {
                if let Gesamtdatei::Netto(n) = d {
                    nettodateien.push(std::mem::replace(n, leer()));
                    stellen.push(i);
                }
            }
            if !nettodateien.is_empty() {
                // ohne Pfadangabe nur, wenn alle Einträge der Spanne netto und im Lauf sind (dann bytegleich zu git diff)
                let ohne_angabe = einteilung.fremd.is_empty() && netto_vollstaendig && datei.is_none() && nettodateien.len() == gesamt as usize;
                let (im_lauf, mit_angabe) = match verteilung {
                    Verteilung::Liste => lauf_der_liste(&mut nettodateien, if ohne_angabe { gesamt } else { u64::MAX }),
                    Verteilung::Einzeln => ((0..nettodateien.len()).collect(), true),
                };
                if !im_lauf.is_empty() {
                    // abgeschlossen gegen die Netto-Liste: der Lauf sieht ganze Einträge, Git paart wie dort (B2)
                    let bezug: Vec<&[Vec<u8>]> = netto_liste.iter().map(|d| d.pfade_roh.as_slice()).collect();
                    let angabe = if mit_angabe { abschliessen(im_lauf.iter().flat_map(|i| nettodateien[*i].pfade_roh.iter().cloned()), &bezug) } else { vec![] };
                    let pfade: Vec<&[u8]> = angabe.iter().map(Vec::as_slice).collect();
                    // streng nur mit genau der Angabe der Netto-Liste (auch „keine“): dann sieht Git dieselbe Matrix und paart
                    // wie dort (N7.10); jede kleinere Angabe ist eine Abkürzung — ein Eintrag ohne Stück ist `nachladen`
                    let bezug_angabe: Vec<&Vec<u8>> = if einteilung.fremd.is_empty() { vec![] } else { einteilung.karte.iter().collect() };
                    let gleich = angabe.iter().eq(bezug_angabe.iter().copied());
                    let vorher = (verteilung == Verteilung::Einzeln && !gleich).then(|| nettodateien.clone());
                    let ohne = match gestartet(arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Patch, Umbenennungssuche::Voll, &pfade, budget, frist)).map_err(repo_fehler)? {
                        // startet Git mit der Angabe nicht (Argumentgrenze): die Einträge des Laufs `nachladen` (N7.10 Punkt 3)
                        None if verteilung == Verteilung::Einzeln && gleich => return Err(zu_gross_fuer_datei(nr)),
                        None => {
                            for &i in &im_lauf {
                                abbrechen(&mut nettodateien[i], verteilung);
                            }
                            im_lauf.clone()
                        }
                        Some(patch) if gleich => {
                            rest = if patch.abgeschnitten { 0 } else { budget - patch.ausgabe.len() };
                            // mit Angabe über alle Einträge der Netto-Liste, die sie trifft: kein Zwilling nimmt ein fremdes Stück
                            let zuordnung = if mit_angabe {
                                patches_zuordnen_im_bezug(&mut nettodateien, &im_lauf, &netto_liste, &angabe, &patch.ausgabe, patch.abgeschnitten, verteilung, fassung)
                            } else {
                                patches_zuordnen(&mut nettodateien, &im_lauf, &patch.ausgabe, patch.abgeschnitten, verteilung, fassung)
                            };
                            zuordnung.map_err(|f| Fehler::Intern(format!("git: {f}")))?;
                            vec![]
                        }
                        Some(patch) => {
                            rest = if patch.abgeschnitten { 0 } else { budget - patch.ausgabe.len() };
                            nicht_zugeordnet_im_bezug(&mut nettodateien, &im_lauf, &netto_liste, &angabe, &patch.ausgabe, patch.abgeschnitten, verteilung, fassung)
                        }
                    };
                    if let Some(vorher) = vorher.filter(|_| !ohne.is_empty()) {
                        // datei=: Rückfall mit genau der Angabe der Netto-Liste — dieselbe Matrix, streng (N7.10 Punkt 2)
                        nettodateien = vorher;
                        let alle: Vec<Vec<u8>> = netto_liste.iter().flat_map(|d| d.pfade_roh.iter().cloned()).collect();
                        let pfade: Vec<&[u8]> = bezug_angabe.iter().map(|p| p.as_slice()).collect();
                        let Some(patch) = gestartet(arbeitsrepo::diff_tree(wurzel, vergleich, Diffart::Patch, Umbenennungssuche::Voll, &pfade, budget, frist)).map_err(repo_fehler)? else {
                            return Err(zu_gross_fuer_datei(nr));
                        };
                        let zuordnung = patches_zuordnen_im_bezug(&mut nettodateien, &im_lauf, &netto_liste, &alle, &patch.ausgabe, patch.abgeschnitten, verteilung, fassung);
                        if !im_bezug_zugeordnet(zuordnung, !netto_vollstaendig).map_err(|f| Fehler::Intern(format!("git: {f}")))? {
                            return Err(zu_gross_fuer_datei(nr));
                        }
                    }
                }
            }
            for (i, n) in stellen.into_iter().zip(nettodateien) {
                dateien[i] = Gesamtdatei::Netto(n);
            }
        }
        self.folge_patches(&mut dateien, &plan, &listen, rest, verteilung, fassung)?;
        diff.hinweise.extend(dateien.iter().flat_map(|d| match d {
            Gesamtdatei::Netto(n) => vec![n],
            Gesamtdatei::Folge(f) => f.schritte.iter().map(|s| &s.datei).collect(),
        }).filter(|d| d.pfad_zu_lang() || (datei.is_some() && d.gross)).map(|d| Hinweis::ZuGrossZumAnzeigen { datei: d.name().to_string() }).collect::<Vec<_>>());
        diff.commits = diffcommits(&schritte)?;
        diff.dateien = dateien;
        Ok(diff)
    }

    /// Liste und Zähler des Folge-Laufs über `diff-tree --stdin`, zerlegt nach den Köpfen, zu Folge-Einträgen gruppiert.
    /// Ein Eintrag erscheint nur mit allen Schritten: berührt ein Commit, dessen Abschnitt am Schnitt liegt oder fehlt,
    /// einen seiner Pfade, fällt er weg (zweiter Wert: wie viele). Dritter Wert: ein Lauf war abgeschnitten. Vierter: je
    /// Commit des Plans alle gelesenen Einträge (Bezug der Pfadangabe und der Zuordnung des Patch-Laufs). Ein
    /// Schritt ist ein Eintrag, dessen Pfade alle Folge-Pfade sind (eine Gruppe ist ganz netto oder ganz Folge).
    #[allow(clippy::type_complexity)]
    fn folge_listen(&self, plan: &Folgeplan, folgepfade: &HashSet<Vec<u8>>, je_commit: &HashMap<String, Vec<Eintragspfade>>) -> Result<(Vec<Folgedatei>, usize, bool, Vec<Vec<Diffdatei>>), Fehler> {
        if plan.commits.is_empty() {
            return Ok((vec![], 0, false, vec![]));
        }
        let vergleiche: Vec<Vergleich> = plan.commits.iter().map(|(_, h, e)| Vergleich { commit: h, eltern: e.as_deref() }).collect();
        let koepfe: Vec<&str> = plan.commits.iter().map(|(_, h, _)| h.as_str()).collect();
        let pfade: Vec<&[u8]> = plan.pfade.iter().map(Vec::as_slice).collect();
        // startet Git mit der Angabe nicht (Argumentgrenze), ist das wie ein abgeschnittener Lauf ohne vollständigen
        // Abschnitt: die Folge-Einträge fallen weg, `dateien_gekappt` (N7.10 Punkt 3); mit datei= der Diff je Commit
        let zu_lang = || if self.anfrage.datei.is_some() { Err(zu_gross_fuer_datei(self.nr)) } else { Ok((vec![], 0, true, vec![vec![]; plan.commits.len()])) };
        // mit `datei=` liest die Folge-Liste bis `grenze_netto_datei` wie die Netto-Liste (R00255 AK 1, ADR-0032 N10.3
        // Punkt 1); ohne `datei=` bleibt die Folge-Grenze — die Liste wird nicht größer (AK 6)
        let grenze = if self.anfrage.datei.is_some() { self.k.grenze_netto_datei } else { self.k.grenze_folge_liste };
        let Some(roh) = gestartet(arbeitsrepo::diff_tree_viele(self.wurzel, &vergleiche, Vielart::Diff(Diffart::Roh), &pfade, grenze, self.frist)).map_err(repo_fehler)? else { return zu_lang() };
        let Some(zahlen) = gestartet(arbeitsrepo::diff_tree_viele(self.wurzel, &vergleiche, Vielart::Diff(Diffart::Zahlen), &pfade, grenze, self.frist)).map_err(repo_fehler)? else { return zu_lang() };
        let form = || Fehler::Intern("git: Folge-Lauf unlesbar".into());
        let roh_ab = abschnitte_z(&roh.ausgabe, &koepfe, Zform::Roh).ok_or_else(form)?;
        let zahlen_ab = abschnitte_z(&zahlen.ausgabe, &koepfe, Zform::Zahlen).ok_or_else(form)?;
        let abgeschnitten = roh.abgeschnitten || zahlen.abgeschnitten;
        // vollständig sind die Abschnitte vor dem letzten jedes abgeschnittenen Laufs
        let grenze = |ab: &[crate::modell::Abschnitt], ab_geschnitten: bool| if ab_geschnitten { ab.last().map_or(0, |a| a.kopf) } else { koepfe.len() };
        let vollstaendig_bis = grenze(&roh_ab, roh.abgeschnitten).min(grenze(&zahlen_ab, zahlen.abgeschnitten));
        let mut schritte: Vec<(String, Diffdatei)> = vec![];
        let mut listen: Vec<Vec<Diffdatei>> = vec![vec![]; plan.commits.len()];
        for (k, (verweis, _, _)) in plan.commits.iter().enumerate().take(vollstaendig_bis) {
            let r = roh_ab.iter().find(|a| a.kopf == k);
            let z = zahlen_ab.iter().find(|a| a.kopf == k);
            let (r, z) = match (r, z) {
                (Some(r), Some(z)) => (roh_lesen(&roh.ausgabe[r.bereich.clone()]).ok_or_else(form)?, zahlen_lesen(&zahlen.ausgabe[z.bereich.clone()]).ok_or_else(form)?),
                (None, None) => continue,
                _ => return Err(form()),
            };
            if r.len() != z.len() {
                return Err(form());
            }
            for d in r.into_iter().zip(z).map(|(r, z)| diffdatei(r, z)) {
                listen[k].push(d.clone());
                if d.pfade_roh.iter().all(|p| folgepfade.contains(p)) {
                    schritte.push((verweis.clone(), d));
                }
            }
        }
        let unvollstaendige: HashSet<&str> = koepfe[vollstaendig_bis..].iter().copied().collect();
        let betroffen: HashSet<&[u8]> = unvollstaendige.iter().flat_map(|h| je_commit.get(*h).into_iter().flatten().flatten().map(Vec::as_slice)).collect();
        let alle = folge_bilden(schritte);
        let n = alle.len();
        let folgen: Vec<Folgedatei> = alle.into_iter().filter(|f| !f.schritte.iter().any(|s| s.datei.pfade_roh.iter().any(|p| betroffen.contains(p.as_slice())))).collect();
        let weg = n - folgen.len();
        Ok((folgen, weg, abgeschnitten, listen))
    }

    /// Der Patch-Lauf der Folge über `diff-tree --stdin` mit dem Rest des Budgets; ohne Rest sind alle Schritte
    /// `nachladen` (mit `datei=` `gross`) ohne Lauf. Zuordnung je Abschnitt über die Blob-Hashes (N5.2).
    fn folge_patches(&self, dateien: &mut [Gesamtdatei], plan: &Folgeplan, listen: &[Vec<Diffdatei>], rest: usize, verteilung: Verteilung, fassung: Fassung) -> Result<(), Fehler> {
        // je Commit des Plans die Schritte (Eintrag, Schritt), in der Reihenfolge der Einträge
        let mut je_commit: Vec<Vec<(usize, usize)>> = vec![vec![]; plan.commits.len()];
        for (i, d) in dateien.iter().enumerate() {
            if let Gesamtdatei::Folge(f) = d {
                for (j, s) in f.schritte.iter().enumerate() {
                    if let Some(k) = plan.commits.iter().position(|(v, _, _)| *v == s.commit) {
                        je_commit[k].push((i, j));
                    }
                }
            }
        }
        let schritt = |dateien: &mut [Gesamtdatei], (i, j): (usize, usize)| -> Diffdatei {
            match &mut dateien[i] {
                Gesamtdatei::Folge(f) => std::mem::replace(&mut f.schritte[j].datei, leer()),
                Gesamtdatei::Netto(_) => leer(),
            }
        };
        let zurueck = |dateien: &mut [Gesamtdatei], (i, j): (usize, usize), d: Diffdatei| {
            if let Gesamtdatei::Folge(f) = &mut dateien[i] {
                f.schritte[j].datei = d;
            }
        };
        let mut gruppen: Vec<Vec<Diffdatei>> = je_commit.iter().map(|stellen| stellen.iter().map(|s| schritt(dateien, *s)).collect()).collect();
        let mut im_lauf: Vec<Vec<usize>> = vec![];
        for g in &mut gruppen {
            let mut lauf = vec![];
            for (i, d) in g.iter_mut().enumerate() {
                if verteilung == Verteilung::Liste && (d.zu_viele_zeilen() || d.pfad_zu_lang()) {
                    d.gross = true;
                } else if rest == 0 {
                    abbrechen(d, verteilung);
                } else {
                    lauf.push(i);
                }
            }
            im_lauf.push(lauf);
        }
        let mit: Vec<usize> = (0..plan.commits.len()).filter(|k| !im_lauf[*k].is_empty()).collect();
        // Folge-Einträge, denen ein Schritt-Stück im Lauf mit kleinerer Angabe fehlt
        let mut ganz_nachladen: HashSet<usize> = HashSet::new();
        if !mit.is_empty() {
            let mut eigene: Vec<Vec<u8>> = vec![];
            for &k in &mit {
                for &i in &im_lauf[k] {
                    eigene.extend(gruppen[k][i].pfade_roh.iter().cloned());
                }
            }
            // abgeschlossen gegen die Listen des Folge-Laufs: Git paart wie dort (B2)
            let bezug: Vec<&[Vec<u8>]> = mit.iter().flat_map(|&k| listen[k].iter().map(|d| d.pfade_roh.as_slice())).collect();
            let angabe = abschliessen(eigene, &bezug);
            // streng nur mit genau der Angabe der Folge-Liste (N7.10); sonst fehlt einem Schritt das Stück → in der Liste
            // ganzer Eintrag `nachladen` (unten), mit datei= ein zweiter Lauf mit der Angabe der Folge-Liste, streng
            let vorher = (verteilung == Verteilung::Einzeln && angabe != plan.pfade).then(|| gruppen.clone());
            let mut fehlt = self.folge_lauf(&mut gruppen, &im_lauf, &mit, plan, listen, &angabe, angabe == plan.pfade, rest, verteilung, fassung)?;
            if let Some(vorher) = vorher.filter(|_| !fehlt.is_empty()) {
                gruppen = vorher;
                fehlt = self.folge_lauf(&mut gruppen, &im_lauf, &mit, plan, listen, &plan.pfade, true, rest, verteilung, fassung)?;
            }
            ganz_nachladen.extend(fehlt.into_iter().map(|(k, i)| je_commit[k][i].0));
        }
        for (stellen, g) in je_commit.into_iter().zip(gruppen) {
            for (s, d) in stellen.into_iter().zip(g) {
                zurueck(dateien, s, d);
            }
        }
        for i in ganz_nachladen {
            if let Gesamtdatei::Folge(f) = &mut dateien[i] {
                for s in &mut f.schritte {
                    abbrechen(&mut s.datei, verteilung);
                }
            }
        }
        Ok(())
    }
}

impl Gesamtlauf<'_> {
    /// Ein Patch-Lauf der Folge mit der Pfadangabe `angabe` über die Commits `mit`, je Abschnitt zugeordnet; `streng`
    /// (dieselbe Angabe wie die Folge-Liste): ein fehlendes Stück ist ein Fehler. Sonst liefert er die Schritte
    /// (Commit, Stelle) ohne Stück außerhalb des Schnitts.
    #[allow(clippy::too_many_arguments)]
    fn folge_lauf(&self, gruppen: &mut [Vec<Diffdatei>], im_lauf: &[Vec<usize>], mit: &[usize], plan: &Folgeplan, listen: &[Vec<Diffdatei>], angabe: &[Vec<u8>], streng: bool, rest: usize, verteilung: Verteilung, fassung: Fassung) -> Result<Vec<(usize, usize)>, Fehler> {
        let vergleiche: Vec<Vergleich> = mit.iter().map(|&k| Vergleich { commit: &plan.commits[k].1, eltern: plan.commits[k].2.as_deref() }).collect();
        let koepfe: Vec<&str> = mit.iter().map(|&k| plan.commits[k].1.as_str()).collect();
        let pfade: Vec<&[u8]> = angabe.iter().map(Vec::as_slice).collect();
        let mut fehlt = vec![];
        let Some(patch) = gestartet(arbeitsrepo::diff_tree_viele(self.wurzel, &vergleiche, Vielart::Diff(Diffart::Patch), &pfade, rest, self.frist)).map_err(repo_fehler)? else {
            // startet Git mit der Angabe nicht (Argumentgrenze): alle Schritte des Laufs fehlen (N7.10 Punkt 3); mit datei=
            // und schon der Angabe der Folge-Liste bleibt nur der Diff je Commit
            if streng && verteilung == Verteilung::Einzeln {
                return Err(zu_gross_fuer_datei(self.nr));
            }
            for &k in mit {
                for &i in &im_lauf[k] {
                    abbrechen(&mut gruppen[k][i], verteilung);
                    fehlt.push((k, i));
                }
            }
            return Ok(fehlt);
        };
        let abschnitte = abschnitte_patch(&patch.ausgabe, &koepfe);
        let letzter = abschnitte.last().map(|a| a.kopf);
        for (stelle, &k) in mit.iter().enumerate() {
            let teil = abschnitte.iter().find(|a| a.kopf == stelle);
            let geschnitten = patch.abgeschnitten && letzter.is_some_and(|l| l == stelle);
            let hinter_dem_schnitt = patch.abgeschnitten && letzter.is_none_or(|l| stelle > l);
            if hinter_dem_schnitt {
                for &i in &im_lauf[k] {
                    abbrechen(&mut gruppen[k][i], verteilung);
                }
                continue;
            }
            let bytes = teil.map_or(&[][..], |a| &patch.ausgabe[a.bereich.clone()]);
            if streng {
                // ohne Angabe trifft der Lauf jeden Eintrag seiner Liste
                let alle: Vec<Vec<u8>> = if angabe.is_empty() { listen[k].iter().flat_map(|d| d.pfade_roh.iter().cloned()).collect() } else { vec![] };
                let treffer = if angabe.is_empty() { &alle[..] } else { angabe };
                patches_zuordnen_im_bezug(&mut gruppen[k], &im_lauf[k], &listen[k], treffer, bytes, geschnitten, verteilung, fassung).map_err(|f| Fehler::Intern(format!("git: {f}")))?;
            } else {
                let ohne = nicht_zugeordnet_im_bezug(&mut gruppen[k], &im_lauf[k], &listen[k], angabe, bytes, geschnitten, verteilung, fassung);
                // am Schnitt fehlt ein Stück auch wegen der Grenze: dort bleibt es beim Schritt (wie bisher)
                if !geschnitten {
                    fehlt.extend(ohne.into_iter().map(|i| (k, i)));
                }
            }
        }
        Ok(fehlt)
    }
}

/// Eine Datei, die ein Abbruch trifft oder für die kein Rest bleibt (wie `commit_diff::abbrechen`).
fn abbrechen(d: &mut Diffdatei, verteilung: Verteilung) {
    d.patch = None;
    d.stuecke = None;
    match verteilung {
        Verteilung::Liste => d.nachladen = true,
        Verteilung::Einzeln => d.gross = true,
    }
}

/// Ein Platzhalter beim Herausnehmen einer Datei.
fn leer() -> Diffdatei {
    diffdatei(crate::modell::Rohdatei { modus_alt: String::new(), modus_neu: String::new(), hash_alt: String::new(), hash_neu: String::new(), status: 'M', zahl: None, pfade: vec![] }, None)
}

/// Liste und Zähler eines Laufs nach Position verbunden; nur Einträge, die in beiden vollständig sind.
fn verbinden(roh: &Teil, zahlen: &Teil) -> Result<Vec<Diffdatei>, Fehler> {
    let form = || Fehler::Intern("git: Dateiliste von diff-tree unlesbar".into());
    let r = roh_lesen(&roh.ausgabe).ok_or_else(form)?;
    let z = zahlen_lesen(&zahlen.ausgabe).ok_or_else(form)?;
    if !roh.abgeschnitten && !zahlen.abgeschnitten && r.len() != z.len() {
        return Err(form());
    }
    Ok(r.into_iter().zip(z).map(|(r, z)| diffdatei(r, z)).collect())
}

/// Ein Lauf, den der Startort wegen der Argumentgrenze nicht startete (Vorabgrenze oder E2BIG, N7.9), ist `None`.
fn gestartet<T>(lauf: Result<T, Arbeitsrepofehler>) -> Result<Option<T>, Arbeitsrepofehler> {
    match lauf {
        Ok(t) => Ok(Some(t)),
        Err(Arbeitsrepofehler::ArgumenteZuLang(_)) => Ok(None),
        Err(f) => Err(f),
    }
}

/// 404 nach N7.3, wenn auch der Rückfall die Datei nicht liefern kann: auf den Diff je Commit verweisen.
fn zu_gross_fuer_datei(nr: u32) -> Fehler {
    Fehler::NichtGefunden(format!("die Namen der Kartencommits von #{nr} sind länger als {} MB — die Datei mit commit= und datei= laden", crate::modell::GRENZE_NAMEN >> 20))
}

/// 404 für einen Pfad, der in Kartencommits steht, im Gesamtbild aber keinen Eintrag hat (Wortlaut PO Z. 509).
fn datei_ohne_aenderung(nr: u32) -> Fehler {
    Fehler::NichtGefunden(format!("die Datei steht in Kartencommits von #{nr}, hat im Gesamtbild aber keine Änderung (die Aufgabe nimmt sie selbst zurück oder benennt sie weiter) — die Schritte mit commit= und datei= laden"))
}

/// 404 für einen Pfad, der in Kartencommits steht und keinen Eintrag hat, wenn ein Lauf abgeschnitten ist — auch mit `datei=`
/// (ADR-0032 N8.6 Punkt 4 (d), Wortlaut PO Z. 514).
fn datei_hinter_dem_schnitt(nr: u32) -> Fehler {
    Fehler::NichtGefunden(format!("die Datei steht in Kartencommits von #{nr}, die Liste der Änderungen ist aber zu groß, um zu sagen, ob sie im Gesamtbild eine Änderung hat — die Schritte mit commit= und datei= laden"))
}

/// 404 für einen Pfad, der in keinem Kartencommit steht (N8.6 Punkt 4 (b)).
fn datei_fehlt(nr: u32) -> Fehler {
    Fehler::NichtGefunden(format!("die Datei steht in keinem Kartencommit von #{nr} — datei= nennt einen Pfad der Karte, buchstäblich"))
}

/// Der Text für `format=patch` (ADR-0032 N6.9): je Hinweis eine Zeile `# kanbanD: …`, Netto-Dateien als Patch von Git,
/// vor jedem Schritt einer Folge-Datei `# kanbanD: Folge <pfad> — Schritt i von n, Commit <verweis>`.
fn text(mut diff: Gesamtdiff) -> String {
    let mut t = String::new();
    for h in &diff.hinweise {
        t.push_str(&hinweiszeile(h));
    }
    for d in &mut diff.dateien {
        match d {
            Gesamtdatei::Netto(n) => t.push_str(&patch_text(std::slice::from_mut(n))),
            Gesamtdatei::Folge(f) => {
                let anzahl = f.schritte.len();
                let pfad = crate::modell::zitiert(&f.pfad);
                for (i, s) in f.schritte.iter_mut().enumerate() {
                    t.push_str(&format!("# kanbanD: Folge {pfad} — Schritt {} von {anzahl}, Commit {}\n", i + 1, s.commit));
                    t.push_str(&patch_text(std::slice::from_mut(&mut s.datei)));
                }
            }
        }
    }
    t
}

/// `ETag` (ADR-0032 N6.10, E3): alle Verweise der Karte wörtlich in Reihenfolge, Fingerabdruck der Zweigspitzen,
/// Anwendung, Wurzel (R00236, ADR-0042 Punkt 6), `datei`, `format`, Version der Grenzen und Version der Einteilung.
fn etag(verweise: &[String], spitzen: &str, anwendung: &str, wurzel: &Path, anfrage: &Diffanfrage) -> String {
    etag_mit(verweise, spitzen, anwendung, wurzel, anfrage, EINTEILUNG_VERSION)
}

/// Wie [`etag`], mit wählbarer Version der Einteilung — die Probe zu R00255 AK 7 rechnet den Wert vor dem Fix nach.
fn etag_mit(verweise: &[String], spitzen: &str, anwendung: &str, wurzel: &Path, anfrage: &Diffanfrage, einteilung_version: u32) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    let format = match anfrage.format {
        Diffformat::Json => "json",
        Diffformat::Patch => "patch",
    };
    let mut teile: Vec<&[u8]> = vec![b"gesamt\0"];
    for v in verweise {
        teile.extend([v.as_bytes(), b"\0"]);
    }
    let (version, einteilung) = (GRENZEN_VERSION.to_be_bytes(), einteilung_version.to_be_bytes());
    teile.extend([b"\x01".as_slice(), spitzen.as_bytes(), b"\0", anwendung.as_bytes(), b"\0", wurzel.as_os_str().as_encoded_bytes(), b"\0", anfrage.datei.as_deref().unwrap_or("\u{1}").as_bytes(), b"\0", format.as_bytes(), b"\0", &version, &einteilung]);
    for b in teile.iter().flat_map(|t| t.iter()) {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("\"gesamt-{h:016x}\"")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::process::Command;
    use std::time::Duration;

    fn git(r: &Path, args: &[&str]) -> String {
        let a = Command::new("git").arg("-C").arg(r).args(["-c", "user.name=T", "-c", "user.email=t@example.org"]).args(args).output().unwrap();
        assert!(a.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&a.stderr));
        String::from_utf8_lossy(&a.stdout).trim().to_string()
    }

    struct Stand {
        _tmp: tempfile::TempDir,
        r: PathBuf,
        board: PathBuf,
        karten: Vec<(u32, Vec<String>)>,
    }

    impl Stand {
        fn neu() -> Stand {
            let tmp = tempfile::tempdir().unwrap();
            let basis = tmp.path().canonicalize().unwrap();
            let (r, board) = (basis.join("R"), basis.join("board"));
            std::fs::create_dir_all(r.join("Planung")).unwrap();
            std::fs::write(r.join("Planung/app.md"), "# App\n").unwrap();
            std::fs::write(r.join("a.txt"), (1..=100).map(|i| format!("z{i}\n")).collect::<String>()).unwrap();
            git(&r, &["init", "-q", "-b", "main"]);
            git(&r, &["add", "-A"]);
            git(&r, &["commit", "-qm", "A0"]);
            std::fs::create_dir_all(board.join("aufgaben")).unwrap();
            std::fs::create_dir_all(board.join("boards")).unwrap();
            std::fs::write(board.join("kanbanD.md"), format!("---\npeople:\n  entw1: {{name: E, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/Planung/app.md, requirements: \"\"}}\n---\n", r.display())).unwrap();
            git(&board, &["init", "-q"]);
            Stand { _tmp: tmp, r, board, karten: vec![] }
        }

        /// Ersetzt Zeile `nr` von a.txt und legt, wenn genannt, `datei` an; committet.
        fn commit(&self, zeile: Option<(usize, &str)>, datei: Option<&str>, nachricht: &str) -> String {
            if let Some((nr, text)) = zeile {
                let alt = std::fs::read_to_string(self.r.join("a.txt")).unwrap();
                std::fs::write(self.r.join("a.txt"), alt.lines().enumerate().map(|(i, z)| if i + 1 == nr { format!("{text}\n") } else { format!("{z}\n") }).collect::<String>()).unwrap();
            }
            if let Some(d) = datei {
                std::fs::write(self.r.join(d), format!("{d}\n")).unwrap();
            }
            git(&self.r, &["add", "-A"]);
            git(&self.r, &["commit", "-q", "--allow-empty", "-m", nachricht]);
            git(&self.r, &["rev-parse", "HEAD"])
        }

        fn karte(&mut self, nr: u32, hashes: &[String]) {
            self.karten.retain(|(n, _)| *n != nr);
            self.karten.push((nr, hashes.iter().map(|h| format!("kd:{h}")).collect()));
            let mut liste = String::new();
            for (n, v) in &self.karten {
                let c: String = v.iter().map(|x| format!("  - {x}\n")).collect();
                std::fs::write(self.board.join(format!("aufgaben/{n:04}-k.md")), format!("---\nid: {n}\ntitle: k\ncommits:\n{c}---\n")).unwrap();
                liste.push_str(&format!("- [#{n}](../aufgaben/{n:04}-k.md)\n"));
            }
            std::fs::write(self.board.join("boards/fabrik.md"), format!("# Fabrik\n\n## Entwicklung\n\n{liste}")).unwrap();
            git(&self.board, &["add", "-A"]);
            git(&self.board, &["commit", "-qm", "k"]);
        }

        /// Bewegt einen Zweig: der Fingerabdruck ändert sich, der Zweig-Cache trifft nicht (kalt).
        fn kalt(&self, i: usize) {
            git(&self.r, &["branch", "-f", &format!("bewegt{i}"), "HEAD"]);
        }
    }

    fn anfrage(abfrage: &[(&str, &str)], bekannt: Option<String>) -> Diffanfrage {
        let paare: Vec<(String, String)> = abfrage.iter().map(|(k, w)| (k.to_string(), w.to_string())).collect();
        Diffanfrage::aus_paaren(&paare, bekannt).unwrap()
    }

    fn frist() -> Instant {
        Instant::now() + Duration::from_secs(10)
    }

    /// Liest den Gesamt-Diff und zählt die Git-Prozesse dabei.
    fn lesen(k: &Kanban, nr: u32, a: &Diffanfrage) -> (Diffantwort, usize) {
        let vorher = arbeitsrepo::aufrufe();
        let antwort = k.diff_lesen(nr, a, frist()).unwrap();
        (antwort, arbeitsrepo::aufrufe() - vorher)
    }

    fn json(a: &Diffantwort) -> (serde_json::Value, String) {
        match a {
            Diffantwort::Rumpf { rumpf, etag, .. } => (serde_json::from_slice(&rumpf.bytes).unwrap(), etag.clone().unwrap()),
            Diffantwort::Unveraendert(_) => panic!("304"),
        }
    }

    // R00208 AK 5, ADR-0032 N6 Durchsetzung 5: kalt höchstens 17 Git-Prozesse bei 1, 10 und 30 Kartencommits, linear
    // (alles netto) und abwechselnd mit fremden Commits auf derselben Datei (Folge); je Form gleich bei 10 und 30
    // (Mutant „Folge je Commit statt --stdin“ wüchse mit der Karte)
    #[test]
    fn prozesse_unabhaengig_von_der_zahl_der_commits() {
        let mut s = Stand::neu();
        let mut nr = 1;
        let mut zahlen = vec![];
        for folge in [false, true] {
            for n in [1usize, 10, 30] {
                let mut hashes = vec![];
                for i in 0..n {
                    let datei = format!("k{nr}-{i}.txt");
                    let zeile = folge.then(|| (2 * i + 1, format!("K{nr}-{i}")));
                    hashes.push(s.commit(zeile.as_ref().map(|(z, t)| (*z, t.as_str())), Some(&datei), "K"));
                    if folge {
                        s.commit(Some((2 * i + 2, &format!("FREMD{nr}-{i}"))), None, "F");
                    }
                }
                s.karte(nr, &hashes);
                nr += 1;
            }
        }
        let k = Kanban::neu(s.board.clone());
        for nr in 1..=6u32 {
            s.kalt(nr as usize);
            let (antwort, prozesse) = lesen(&k, nr, &anfrage(&[], None));
            let (d, _) = json(&antwort);
            assert!(prozesse <= 17, "#{nr}: {prozesse} Prozesse");
            let folgen = d["dateien"].as_array().unwrap().iter().filter(|f| f["schritte"].is_array()).count();
            zahlen.push((prozesse, folgen));
        }
        assert_eq!(zahlen[1].0, zahlen[2].0, "linear: gleich bei 10 und 30 — {zahlen:?}");
        assert_eq!(zahlen[4].0, zahlen[5].0, "Folge: gleich bei 10 und 30 — {zahlen:?}");
        assert_eq!(zahlen.iter().map(|z| z.1).collect::<Vec<_>>(), [0, 0, 0, 0, 1, 1], "Folge nur in der zweiten Form (a.txt; bei einem Commit gibt es nichts dazwischen)");
        // 16 statt 15: der Zähllauf (R00253/N11.3) kommt dazu; die Obergrenze 17 deckt auch eine gemischte Liste,
        // bei der der Zeilenzähl-Lauf zweimal läuft
        assert_eq!(zahlen[5].0, 16, "die zweite Form mit Netto und Folge: {zahlen:?}");
    }

    // R00225 AK 6 D2 (ADR-0032 N8.6 Punkt 4 (d), PO Z. 514): auch mit datei= ist die Netto-Liste abgeschnitten (Grenze im Test
    // verkleinert statt 20 MB) — ein Pfad aus Kartencommits ohne Eintrag ergibt 404 mit eigenem Text, der nicht „in keinem
    // Kartencommit“ sagt und auf commit= verweist; ein Pfad in keinem Kartencommit behält seinen Text. Mutant m8 macht ihn rot
    #[test]
    fn datei_hinter_der_abgeschnittenen_liste_eigener_text() {
        let mut s = Stand::neu();
        std::fs::create_dir_all(s.r.join("v")).unwrap();
        for i in 0..40 {
            std::fs::write(s.r.join(format!("v/{i:03}.txt")), format!("{i}\n")).unwrap();
        }
        let k1 = s.commit(Some((2, "K1")), None, "K1 viele");
        s.commit(Some((6, "FREMD-6")), None, "F");
        let k2 = s.commit(Some((11, "K2")), None, "K2");
        s.karte(2, &[k1, k2]);
        let mut k = Kanban::neu(s.board.clone());
        k.grenze_netto_datei = 300;
        let fehler = |k: &Kanban, datei: &str| match k.diff_lesen(2, &anfrage(&[("datei", datei)], None), frist()) {
            Err(Fehler::NichtGefunden(t)) => t,
            anders => panic!("datei={datei}: kein 404: {anders:?}"),
        };
        let hinten = fehler(&k, "v/039.txt");
        assert_eq!(hinten, "die Datei steht in Kartencommits von #2, die Liste der Änderungen ist aber zu groß, um zu sagen, ob sie im Gesamtbild eine Änderung hat — die Schritte mit commit= und datei= laden");
        assert!(!hinten.contains("in keinem Kartencommit") && hinten.contains("commit="));
        assert!(!hinten.replace("#2", "").chars().any(|c| c.is_ascii_digit()), "keine Zahl im Text: {hinten}");
        assert_eq!(fehler(&k, "nicht/da.txt"), "die Datei steht in keinem Kartencommit von #2 — datei= nennt einen Pfad der Karte, buchstäblich");
        // Gegenprobe: mit der Grenze für datei= (20 MB) steht der Eintrag da
        k.grenze_netto_datei = crate::modell::GRENZE_DATEILISTE_EINZELN;
        let (a, _) = lesen(&k, 2, &anfrage(&[("datei", "v/039.txt")], None));
        let (d, _) = json(&a);
        assert_eq!((d["dateien"][0]["neu"].as_str(), d["dateien"][0]["status"].as_str()), (Some("v/039.txt"), Some("A")), "{d}");
    }

    // Legacy-Review #234 Muss 1: die Einteilung hat sich mit ADR-0032 N8 geändert, ein ETag nach der Formel vor der Karte
    // darf kein 304 mehr bekommen. Fester Eingang, Wert nach der alten Formel nachgerechnet und gegen das Programm vor der
    // Karte geprüft (Fall N: JSON, patch, datei=d/x gleich)
    #[test]
    fn etag_nicht_wie_vor_der_einteilung_n8() {
        let verweise = [format!("kd:{}", "a".repeat(40))];
        assert_ne!(etag(&verweise, "s", "kd", Path::new("/w"), &anfrage(&[], None)), "\"gesamt-05092438c966be2e\"");
    }

    // R00208 AK 5, ADR-0032 N6.10 (E3): 304 nach genau 2 Prozessen; ein neuer Commit auf einem beliebigen Zweig, eine
    // andere Anwendung, datei oder format → 200
    #[test]
    fn etag_aus_verweisen_und_zweigspitzen() {
        let mut s = Stand::neu();
        let k1 = s.commit(Some((1, "K1")), Some("k.txt"), "K1");
        s.commit(Some((5, "FREMD")), None, "F");
        let k2 = s.commit(Some((9, "K2")), None, "K2");
        s.karte(2, &[k1.clone(), k2.clone()]);
        let k = Kanban::neu(s.board.clone());
        let (erste, _) = lesen(&k, 2, &anfrage(&[], None));
        let (_, etag) = json(&erste);
        let (zweite, prozesse) = lesen(&k, 2, &anfrage(&[], Some(etag.clone())));
        assert!(matches!(&zweite, Diffantwort::Unveraendert(e) if *e == etag), "{zweite:?}");
        assert_eq!(prozesse, 2, "Wurzel und Zweigspitzen");
        for andere in [&[("format", "patch")][..], &[("datei", "k.txt")]] {
            let (a, _) = lesen(&k, 2, &anfrage(andere, Some(etag.clone())));
            assert!(matches!(a, Diffantwort::Rumpf { .. }), "{andere:?}: kein 304");
        }
        git(&s.r, &["checkout", "-q", "-b", "nebenbei"]);
        s.commit(None, Some("n.txt"), "nebenbei");
        git(&s.r, &["checkout", "-q", "main"]);
        let (dritte, _) = lesen(&k, 2, &anfrage(&[], Some(etag.clone())));
        let (_, neu) = json(&dritte);
        assert_ne!(neu, etag, "neuer Commit auf einem Zweig → anderer ETag");
        // main auf K1 zurück: K2 wird verwaist — mit dem alten ETag kein 304
        git(&s.r, &["branch", "-D", "nebenbei"]);
        git(&s.r, &["reset", "-q", "--hard", &k1]);
        git(&s.r, &["reflog", "expire", "--expire=now", "--all"]);
        let (vierte, _) = lesen(&k, 2, &anfrage(&[], Some(neu)));
        let (d, _) = json(&vierte);
        assert_eq!(d["commits"].as_array().unwrap().iter().map(|c| c["hash"].as_str().unwrap()).collect::<Vec<_>>(), [k1.as_str()]);
        assert!(d["hinweise"].as_array().unwrap().contains(&serde_json::json!({"art": "verwaist", "verweis": format!("kd:{k2}")})), "{d}");
    }

    // R00208 AK 4, ADR-0032 N6.4: Namenslauf an seiner (verkleinerten) Grenze abgeschnitten → ganz als Folge mit
    // fremd_zu_gross, kein Netto-Eintrag, keine fremde Zeile (Mutant „abgeschnittener Namenslauf als vollständig“)
    #[test]
    fn namenslauf_abgeschnitten_ganz_als_folge() {
        let mut s = Stand::neu();
        let k1 = s.commit(Some((2, "K1")), Some("k.txt"), "K1");
        s.commit(Some((6, "FREMD-6")), Some("f.txt"), "F");
        let k2 = s.commit(Some((11, "K2")), None, "K2");
        s.karte(2, &[k1, k2]);
        let mut k = Kanban::neu(s.board.clone());
        k.grenze_namen = 100;
        let (a, _) = lesen(&k, 2, &anfrage(&[], None));
        let (d, _) = json(&a);
        assert_eq!(d["hinweise"][0], serde_json::json!({"art": "ganz_als_folge", "grund": "fremd_zu_gross"}), "{d}");
        assert_eq!(d["spanne"], serde_json::Value::Null);
        let dateien = d["dateien"].as_array().unwrap();
        assert_eq!(dateien.iter().map(|f| f["pfad"].as_str().unwrap_or("netto")).collect::<Vec<_>>(), ["a.txt", "k.txt"]);
        let text = d.to_string();
        assert!(!text.contains("+FREMD") && !text.contains("-FREMD") && !text.contains("f.txt"), "{d}");
        // Gegenprobe: mit der vollen Grenze ist k.txt netto
        k.grenze_namen = crate::modell::GRENZE_NAMEN;
        let (a, _) = lesen(&k, 2, &anfrage(&[], None));
        let (d, _) = json(&a);
        assert!(d["dateien"].as_array().unwrap().iter().any(|f| f["neu"] == "k.txt"), "{d}");
    }

    /// Ein Pfad unter sieben Ordnern zu 214 Zeichen (über 1.500 Byte): jede Pfadangabe mit ihm ist lang.
    fn lang(name: &str) -> String {
        vec!["n".repeat(214); 7].join("/") + "/" + name
    }

    fn lang_schreiben(s: &Stand, name: &str, inhalt: &str) {
        let p = s.r.join(lang(name));
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(p, inhalt).unwrap();
    }

    /// Die Vorabgrenze dieses Threads auf „Patch-Lauf ohne Angabe + 1.000“: jeder Lauf ohne Pfadangabe startet, jede
    /// Angabe mit einem langen Pfad nicht (R00211 AK 12, `vorabgrenze_setzen`).
    fn kleine_vorabgrenze(r: &Path) {
        arbeitsrepo::vorabgrenze_setzen(Some(0));
        let f = arbeitsrepo::diff_tree(r, Vergleich { eltern: Some("HEAD~"), commit: "HEAD" }, Diffart::Patch, Umbenennungssuche::Voll, &[], GRENZE_EINZELN, frist()).unwrap_err();
        let Arbeitsrepofehler::ArgumenteZuLang(m) = f else { panic!("{f:?}") };
        let ohne: usize = m.split_whitespace().nth(2).unwrap().parse().unwrap();
        arbeitsrepo::vorabgrenze_setzen(Some(ohne + 1000));
    }

    fn roh(k: &Kanban, nr: u32, a: &Diffanfrage) -> Result<String, Fehler> {
        match k.diff_lesen(nr, a, frist())? {
            Diffantwort::Rumpf { rumpf, .. } => Ok(String::from_utf8(rumpf.bytes.clone()).unwrap()),
            Diffantwort::Unveraendert(_) => panic!("304"),
        }
    }

    fn steht_nachladen(f: &serde_json::Value) -> bool {
        match f["schritte"].as_array() {
            Some(s) => s.iter().all(|s| s["nachladen"] == true && s["patch"].is_null()),
            None => f["nachladen"] == true && f["patch"].is_null(),
        }
    }

    // R00213 AK 4 (ADR-0032 N7.10 Punkt 3), Netto-Liste: K1 ändert a.txt und legt einen langen Pfad an, ein fremder
    // Commit ändert f.txt, K2 ändert a.txt. Die Netto-Liste mit D_karte liegt über der (kleinen) Vorabgrenze → ganz als
    // Folge mit fremd_zu_gross, 200; der Folge-Patch-Lauf (Angabe mit dem langen Pfad) startet ebenfalls nicht → alle
    // Schritte `nachladen`; `datei=<langer Pfad>` fällt ohne Angabe über die Kartencommits zurück → 200 mit Patch.
    // Vor dem Fix: 500 „git: Argumente zählen …“ über `abbruch`.
    #[test]
    fn netto_liste_ueber_der_vorabgrenze_ganz_als_folge() {
        let mut s = Stand::neu();
        lang_schreiben(&s, "p", "lang\n");
        let k1 = s.commit(Some((2, "K1")), None, "K1");
        s.commit(None, Some("f.txt"), "F");
        let k2 = s.commit(Some((11, "K2")), None, "K2");
        s.karte(2, &[k1, k2]);
        let k = Kanban::neu(s.board.clone());
        kleine_vorabgrenze(&s.r);
        let t = roh(&k, 2, &anfrage(&[], None));
        let text = roh(&k, 2, &anfrage(&[("format", "patch")], None));
        let einzeln = roh(&k, 2, &anfrage(&[("datei", &lang("p"))], None));
        arbeitsrepo::vorabgrenze_setzen(None);
        let d: serde_json::Value = serde_json::from_str(&t.unwrap_or_else(|f| panic!("Liste: {f:?}"))).unwrap();
        assert_eq!(d["hinweise"][0], serde_json::json!({"art": "ganz_als_folge", "grund": "fremd_zu_gross"}), "{d}");
        assert!(d["dateien"].as_array().unwrap().iter().all(steht_nachladen), "{d}");
        assert!(text.unwrap_or_else(|f| panic!("format=patch: {f:?}")).contains("ganz_als_folge"));
        let e: serde_json::Value = serde_json::from_str(&einzeln.unwrap_or_else(|f| panic!("datei=: {f:?}"))).unwrap();
        assert_eq!(e["dateien"][0]["schritte"][0]["patch"], serde_json::json!("@@ -0,0 +1 @@\n+lang\n"), "{e}");
    }

    // R00213 AK 4, Patch-Lauf der Netto-Liste: nur Kartencommits (Netto-Liste ohne Angabe), zwei lange Pfade und eine
    // Datei über 3.000 Zeilen — der Patch-Lauf nennt die langen Pfade und liegt über der Vorabgrenze → 200, beide
    // `nachladen`; `datei=` auf jeden fällt mit der Angabe der Netto-Liste (keine) zurück → 200 mit Patch.
    #[test]
    fn netto_patch_lauf_ueber_der_vorabgrenze_nachladen() {
        let mut s = Stand::neu();
        lang_schreiben(&s, "p", "p\n");
        lang_schreiben(&s, "q", "q\n");
        std::fs::write(s.r.join("gross"), (0..3001).map(|i| format!("g{i}\n")).collect::<String>()).unwrap();
        let k1 = s.commit(None, None, "K1");
        s.karte(3, &[k1]);
        let k = Kanban::neu(s.board.clone());
        kleine_vorabgrenze(&s.r);
        let t = roh(&k, 3, &anfrage(&[], None));
        let text = roh(&k, 3, &anfrage(&[("format", "patch")], None));
        let einzeln: Vec<_> = ["p", "q"].iter().map(|n| roh(&k, 3, &anfrage(&[("datei", &lang(n))], None))).collect();
        arbeitsrepo::vorabgrenze_setzen(None);
        let d: serde_json::Value = serde_json::from_str(&t.unwrap_or_else(|f| panic!("Liste: {f:?}"))).unwrap();
        for n in ["p", "q"] {
            let f = d["dateien"].as_array().unwrap().iter().find(|f| f["neu"] == lang(n).as_str()).unwrap();
            assert!(steht_nachladen(f), "{n}: {f}");
        }
        text.unwrap_or_else(|f| panic!("format=patch: {f:?}"));
        for (n, e) in ["p", "q"].iter().zip(einzeln) {
            let e: serde_json::Value = serde_json::from_str(&e.unwrap_or_else(|f| panic!("datei={n}: {f:?}"))).unwrap();
            assert_eq!(e["dateien"][0]["patch"], serde_json::json!(format!("@@ -0,0 +1 @@\n+{n}\n")), "{e}");
        }
    }

    // R00213 AK 4, Folge-Liste (am Aufrufort: über die API nicht erreichbar, weil die Netto-Liste mit D_karte vor ihr
    // läuft und länger zählt): startet der Folge-Lauf wegen der Argumentgrenze nicht, fallen seine Einträge weg wie bei
    // einem abgeschnittenen Lauf (→ `dateien_gekappt`); mit datei= 404 nach N7.3
    #[test]
    fn folge_liste_ueber_der_vorabgrenze_wie_abgeschnitten() {
        let s = Stand::neu();
        lang_schreiben(&s, "p", "p\n");
        let k1 = s.commit(None, None, "K1");
        let eltern = git(&s.r, &["rev-parse", "HEAD~"]);
        let k = Kanban::neu(s.board.clone());
        let plan = Folgeplan { commits: vec![(format!("kd:{k1}"), k1.clone(), Some(eltern))], pfade: vec![lang("p").into_bytes()] };
        let folgepfade: HashSet<Vec<u8>> = plan.pfade.iter().cloned().collect();
        let je_commit = HashMap::new();
        kleine_vorabgrenze(&s.r);
        let liste = anfrage(&[], None);
        let ergebnis = Gesamtlauf { k: &k, wurzel: &s.r, frist: frist(), anfrage: &liste, nr: 4 }.folge_listen(&plan, &folgepfade, &je_commit);
        let einzeln = anfrage(&[("datei", &lang("p"))], None);
        let mit_datei = Gesamtlauf { k: &k, wurzel: &s.r, frist: frist(), anfrage: &einzeln, nr: 4 }.folge_listen(&plan, &folgepfade, &je_commit);
        arbeitsrepo::vorabgrenze_setzen(None);
        let (folgen, weg, abgeschnitten, listen) = ergebnis.unwrap_or_else(|f| panic!("{f:?}"));
        assert_eq!((folgen.len(), weg, abgeschnitten, listen.len()), (0, 0, true, 1));
        assert!(matches!(mit_datei, Err(Fehler::NichtGefunden(m)) if m.contains("commit= und datei=")));
    }

    // R00255 AK 5 (ADR-0032 N10.3 Punkt 3): `datei_fehlt` nur bei vollständigen Namen. Der Namenslauf ist an seiner
    // (verkleinerten) Grenze gekappt — ein Pfad hinter dem Schnitt der Namen ist nicht „in keinem Kartencommit“, sondern
    // hinter dem Schnitt; sind die Namen vollständig, bleibt der Text. Mutant m5 macht die erste Zusicherung rot.
    #[test]
    fn datei_fehlt_nur_bei_vollstaendigen_namen() {
        let mut s = Stand::neu();
        std::fs::create_dir_all(s.r.join("d")).unwrap();
        for i in 0..60 {
            std::fs::write(s.r.join(format!("d/{i:02}")), format!("{i}\n")).unwrap();
        }
        let k1 = s.commit(None, None, "K1 viele");
        s.karte(2, &[k1]);
        let mut k = Kanban::neu(s.board.clone());
        // kappt den Namenslauf nach etwa 20 der 60 Einträge
        k.grenze_namen = 2_000;
        let fehler = |k: &Kanban, datei: &str| match k.diff_lesen(2, &anfrage(&[("datei", datei)], None), frist()) {
            Err(Fehler::NichtGefunden(t)) => t,
            anders => panic!("datei={datei}: kein 404: {anders:?}"),
        };
        let (a, _) = lesen(&k, 2, &anfrage(&[("datei", "d/59")], None));
        let (d, _) = json(&a);
        assert_eq!((d["dateien"][0]["neu"].as_str(), d["dateien"][0]["status"].as_str()), (Some("d/59"), Some("A")), "{d}");
        let hinten = fehler(&k, "nicht/da");
        assert!(!hinten.contains("in keinem Kartencommit") && hinten.contains("commit="), "{hinten}");
        // vollständige Namen: derselbe Pfad behält „in keinem Kartencommit“
        k.grenze_namen = crate::modell::GRENZE_NAMEN;
        assert!(fehler(&k, "nicht/da").contains("in keinem Kartencommit"), "vollständige Namen");
    }

    // R00255 AK 7 (ADR-0032 N10.3 Punkt 4): E2 ändert Antworten ohne `datei=`, also wechselt die Version der Einteilung
    // im `ETag` — ein `If-None-Match` mit dem `ETag` von vor dem Fix darf kein 304 mehr bekommen.
    #[test]
    fn etag_waechst_mit_der_einteilung_version() {
        let verweise = [format!("kd:{}", "a".repeat(40))];
        let a = anfrage(&[], None);
        let jetzt = etag(&verweise, "s", "kd", Path::new("/w"), &a);
        assert_eq!(EINTEILUNG_VERSION, 3, "R00255 AK 7: Version der Einteilung");
        assert_eq!(jetzt, etag_mit(&verweise, "s", "kd", Path::new("/w"), &a, 3), "{jetzt}");
        assert_ne!(etag_mit(&verweise, "s", "kd", Path::new("/w"), &a, 2), jetzt, "der ETag vor dem Fix ist ein anderer");
    }

    // R00255 AK 6 (ADR-0032 N10.3 Punkt 1): mit `datei=` liest die Folge-Liste bis `grenze_netto_datei` (20 MB), ohne
    // `datei=` bleibt die Folge-Grenze (`grenze_folge_liste`) — die Liste wird nicht größer. `ganz_als_folge` billig über
    // einen nicht-linearen Verlauf (K1 auf einem Seitenzweig, K2 auf `main`). Mutant m1 (Folge-Liste mit `datei=` weiter
    // 1 MB) und m2 (Folge-Grenze auch ohne `datei=` 20 MB) werden hier rot.
    #[test]
    fn folge_liste_mit_datei_bis_20_mb_ohne_datei_unveraendert() {
        let mut s = Stand::neu();
        git(&s.r, &["checkout", "-q", "-b", "seite"]);
        for i in 0..50 {
            std::fs::write(s.r.join(format!("s{i:02}.txt")), format!("{i}\n")).unwrap();
        }
        let k1 = s.commit(None, None, "K1 Seite");
        git(&s.r, &["checkout", "-q", "main"]);
        let k2 = s.commit(None, Some("k2.txt"), "K2");
        s.karte(2, &[k1, k2]);
        let mut k = Kanban::neu(s.board.clone());
        // K1 allein liegt über der Folge-Grenze
        k.grenze_folge_liste = 300;
        // ohne datei=: ganz als Folge (nicht linear) mit leerer Liste und Kappe — unverändert
        let (a, _) = lesen(&k, 2, &anfrage(&[], None));
        let (d, _) = json(&a);
        assert_eq!(d["hinweise"][0], serde_json::json!({"art": "ganz_als_folge", "grund": "nicht_linear"}), "{d}");
        assert_eq!(d["dateien"], serde_json::json!([]), "{d}");
        assert_eq!(d["hinweise"][1], serde_json::json!({"art": "dateien_gekappt", "gezeigt": 0, "gesamt": 51}), "{d}");
        // mit datei=: bis 20 MB gelesen → 200 mit Folge-Eintrag hinter dem Schnitt der Liste
        let (a, _) = lesen(&k, 2, &anfrage(&[("datei", "k2.txt")], None));
        let (d, _) = json(&a);
        assert_eq!((d["dateien"][0]["pfad"].as_str(), d["dateien"][0]["schritte"][0]["status"].as_str()), (Some("k2.txt"), Some("A")), "{d}");
        // Gegenprobe: kleine grenze_netto_datei → 404 hinter dem Schnitt, nicht „in keinem Kartencommit“
        k.grenze_netto_datei = 300;
        let f = match k.diff_lesen(2, &anfrage(&[("datei", "k2.txt")], None), frist()) {
            Err(Fehler::NichtGefunden(t)) => t,
            anders => panic!("kein 404: {anders:?}"),
        };
        assert!(!f.contains("in keinem Kartencommit") && f.contains("commit="), "{f}");
    }
}
