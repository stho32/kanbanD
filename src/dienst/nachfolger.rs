//! Nachfolger eines verwaisten Commits suchen (R00218, ADR-0038): auf Anfrage, nur lesend, ohne die Sperre des
//! Board-Ordners — Fenster ab dem Autordatum, Vorfilter nach der Pfadmenge, `patch-id --stable` nur für die Übrigen,
//! Binärschutz. Die Antwort nennt nur Hash und Metadaten von Commits mit derselben `patch-id`, nie Patch-Text oder Pfade.

use crate::git::arbeitsrepo::{self, Arbeitsrepofehler, Fenstercommit, Vergleich, Vielart};
use crate::modell::{Rohdatei, Zform, abschnitte_patch, abschnitte_z, roh_lesen};
use std::collections::{BTreeSet, HashMap};
use std::time::Instant;

/// Höchstzahl der Commits im Fenster (ADR-0038 T2; nach der Sondierung B1112 bleibt es bei 1.000).
pub const FENSTER_HOECHSTENS: usize = 1_000;
/// Das Fenster beginnt einen Tag vor dem Autordatum des verwaisten Commits (ADR-0038 Punkt 2.2).
pub const FENSTER_VORLAUF_S: i64 = 86_400;
/// Bytegrenze des Vorfilters (`--raw -z`, wie `GRENZE_NAMEN`, ADR-0038 Punkt 2.3).
pub const GRENZE_VORFILTER: usize = 4 << 20;

/// Höchstens so viele Übrige des Vorfilters gehen in den Patch-Lauf (ADR-0038 Punkt 2.4).
pub const UEBRIGE_HOECHSTENS: usize = 50;
/// Bytegrenze des Patch-Laufs (wie `GRENZE_EINZELN`, ADR-0038 Punkt 2.4).
pub const GRENZE_PATCH: usize = 8 << 20;

/// Warum die Suche nicht alles durchsehen konnte (`suche_gekappt`, ADR-0038 Punkt 4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum Kappgrund {
    /// mehr als 1.000 Commits im Fenster
    Fenster,
    /// der Vorfilter lief über seine Bytegrenze
    Vorfilter,
    /// mehr als 50 Übrige oder der Patch-Lauf über seiner Bytegrenze
    Patch,
}

/// Commits des Fensters, neueste zuerst.
pub type Fenster = Vec<Fenstercommit>;

/// Das Fenster eines verwaisten Commits: höchstens 1.000 Commits, und ob es gekappt ist.
pub fn fenster(wurzel: &std::path::Path, verwaist: &str, autordatum: i64, frist: Instant) -> Result<(Fenster, bool), Arbeitsrepofehler> {
    let mut commits = arbeitsrepo::fenster(wurzel, verwaist, autordatum - FENSTER_VORLAUF_S, FENSTER_HOECHSTENS, frist)?;
    let gekappt = commits.len() > FENSTER_HOECHSTENS;
    commits.truncate(FENSTER_HOECHSTENS);
    Ok((commits, gekappt))
}

/// Was der Vorfilter übrig lässt (ADR-0038 Punkt 2.3).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Vorfilter {
    /// die Einträge des verwaisten Commits (leer: er ändert keine Datei)
    pub eigene: Vec<Rohdatei>,
    /// Stellen im Fenster, deren Pfadmenge gleich der des verwaisten ist, in der Reihenfolge des Fensters, je mit Einträgen
    pub uebrige: Vec<(usize, Vec<Rohdatei>)>,
    /// so viele Commits des Fensters (von vorn) sind ganz gelesen; weniger als das Fenster heißt `suche_gekappt` `vorfilter`
    pub entschieden: usize,
}

/// Die Pfadmenge eines Commits ohne Umbenennungen: je Eintrag sein Pfad.
fn pfadmenge(eintraege: &[Rohdatei]) -> BTreeSet<&[u8]> {
    eintraege.iter().flat_map(|e| e.pfade.iter().map(Vec::as_slice)).collect()
}

/// Gleiche `patch-id` heißt gleiche Menge geänderter Pfade, denn `patch-id` zählt die Kopfzeilen `---`/`+++` mit.
pub fn pfadmenge_gleich(a: &[Rohdatei], b: &[Rohdatei]) -> bool {
    pfadmenge(a) == pfadmenge(b)
}

/// Liest den Lauf des Vorfilters über `[verwaist, fenster…]` (Köpfe in dieser Reihenfolge). Ist er abgeschnitten, gelten
/// nur die Commits vor dem letzten Kopf als gelesen; ein Commit ohne Kopf ändert nichts. `None`, wenn die Ausgabe nicht
/// die Form hat.
pub fn vorfilter(aus: &[u8], abgeschnitten: bool, koepfe: &[&str]) -> Option<Vorfilter> {
    let abschnitte = abschnitte_z(aus, koepfe, Zform::Roh)?;
    // Stelle im Lauf (0 = verwaist), bis zu der alles ganz gelesen ist
    let ganz = match abschnitte.last() {
        Some(letzter) if abgeschnitten => letzter.kopf,
        _ if abgeschnitten => 0,
        _ => koepfe.len(),
    };
    let mut eigene = vec![];
    let mut je_stelle: Vec<(usize, Vec<Rohdatei>)> = vec![];
    for a in abschnitte.iter().filter(|a| a.kopf < ganz) {
        let eintraege = roh_lesen(&aus[a.bereich.clone()])?;
        match a.kopf {
            0 => eigene = eintraege,
            k => je_stelle.push((k - 1, eintraege)),
        }
    }
    if ganz == 0 {
        return Some(Vorfilter { eigene, uebrige: vec![], entschieden: 0 });
    }
    let uebrige = je_stelle.into_iter().filter(|(_, e)| !eigene.is_empty() && pfadmenge_gleich(e, &eigene)).collect();
    Some(Vorfilter { eigene, uebrige, entschieden: ganz - 1 })
}

/// Ein Lauf des Vorfilters über das verwaiste und die Commits des Fensters.
pub fn vorfilter_lesen(wurzel: &std::path::Path, verwaist: Vergleich, fenster: &[Fenstercommit], frist: Instant) -> Result<Option<Vorfilter>, Arbeitsrepofehler> {
    let mut vergleiche = vec![verwaist];
    vergleiche.extend(fenster.iter().map(|f| Vergleich { commit: &f.commit, eltern: f.eltern.as_deref() }));
    let koepfe: Vec<&str> = vergleiche.iter().map(|v| v.commit).collect();
    let teil = arbeitsrepo::diff_tree_viele(wurzel, &vergleiche, Vielart::Pfade, &[], GRENZE_VORFILTER, frist)?;
    Ok(vorfilter(&teil.ausgabe, teil.abgeschnitten, &koepfe))
}

/// Ergebnis des Patch-Laufs: die Kandidaten als Stellen im Fenster, wie weit das Fenster entschieden ist und ob dabei
/// gekappt wurde (mehr als 50 Übrige oder Bytegrenze).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Treffer {
    pub kandidaten: Vec<usize>,
    pub entschieden: usize,
    pub gekappt: bool,
}

/// Die Pfade des verwaisten Commits, die er als Binärdatei ändert — aus seinem Stück des Patch-Laufs: je Eintrag ein
/// Block `diff --git`, in der Reihenfolge der Einträge (derselbe `diff-tree` ohne Umbenennungen). Passt die Zahl der Blöcke
/// nicht zu den Einträgen, gilt jeder Pfad als binär — die strenge Richtung.
pub fn binaerpfade(stueck: &[u8], eigene: &[Rohdatei]) -> Vec<Vec<u8>> {
    let mut bloecke: Vec<bool> = vec![];
    for zeile in stueck.split(|b| *b == b'\n') {
        if zeile.starts_with(b"diff --git ") {
            bloecke.push(false);
        } else if zeile.starts_with(b"Binary files ") || zeile == b"GIT binary patch" {
            if let Some(b) = bloecke.last_mut() {
                *b = true;
            }
        }
    }
    let pfad = |e: &Rohdatei| e.pfade.last().cloned().unwrap_or_default();
    if bloecke.len() != eigene.len() {
        return eigene.iter().map(pfad).collect();
    }
    eigene.iter().zip(bloecke).filter(|(_, binaer)| *binaer).map(|(e, _)| pfad(e)).collect()
}

/// Binärschutz (ADR-0038 Punkt 2.6): `patch-id` sieht bei einer Binärdatei nur „Binary files … differ“ — ein Kandidat
/// muss für jeden binär geänderten Pfad denselben neuen Blob haben wie das verwaiste.
pub fn binaer_gleich(binaer: &[Vec<u8>], eigene: &[Rohdatei], kandidat: &[Rohdatei]) -> bool {
    let neuer_blob = |liste: &[Rohdatei], p: &[u8]| liste.iter().find(|e| e.pfade.last().is_some_and(|x| x == p)).map(|e| e.hash_neu.clone());
    binaer.iter().all(|p| neuer_blob(eigene, p).is_some() && neuer_blob(eigene, p) == neuer_blob(kandidat, p))
}

/// Patch und `patch-id` (ADR-0038 Punkt 2.4–2.6): ein Lauf `diff-tree -p` über das verwaiste und höchstens 50 Übrige
/// (8 MB), ein Lauf `patch-id --stable` mit dem Text auf `stdin`; Kandidat ist jeder Übrige mit derselben `patch-id` und
/// gleichen Blobs der Binärdateien. Ein abgeschnittener letzter Commit zählt nie; der Patch-Text endet mit dem Aufruf.
pub fn patch_pruefen(wurzel: &std::path::Path, verwaist: Vergleich, fenster: &Fenster, vf: &Vorfilter, frist: Instant) -> Result<Treffer, Arbeitsrepofehler> {
    let mut gekappt = vf.uebrige.len() > UEBRIGE_HOECHSTENS;
    let uebrige = &vf.uebrige[..vf.uebrige.len().min(UEBRIGE_HOECHSTENS)];
    let mut entschieden = if gekappt { uebrige[uebrige.len() - 1].0 + 1 } else { vf.entschieden };
    if uebrige.is_empty() {
        return Ok(Treffer { kandidaten: vec![], entschieden, gekappt });
    }
    let mut vergleiche = vec![verwaist];
    vergleiche.extend(uebrige.iter().map(|(i, _)| Vergleich { commit: &fenster[*i].commit, eltern: fenster[*i].eltern.as_deref() }));
    let koepfe: Vec<&str> = vergleiche.iter().map(|v| v.commit).collect();
    let teil = arbeitsrepo::diff_tree_viele(wurzel, &vergleiche, Vielart::Patchtext, &[], GRENZE_PATCH, frist)?;
    let abschnitte = abschnitte_patch(&teil.ausgabe, &koepfe);
    let Some(eigenes) = abschnitte.first().filter(|a| a.kopf == 0) else {
        return Err(Arbeitsrepofehler::Start("Patch-Lauf ohne den verwaisten Commit".into()));
    };
    let mut ende = teil.ausgabe.len();
    let mut ganz = abschnitte.len();
    if teil.abgeschnitten {
        gekappt = true;
        let letzter = &abschnitte[abschnitte.len() - 1];
        if letzter.kopf == 0 {
            return Ok(Treffer { kandidaten: vec![], entschieden: 0, gekappt });
        }
        // der angefangene letzte Commit fällt samt Kopfzeile weg; entschieden ist das Fenster bis vor ihn
        ende = letzter.bereich.start - koepfe[letzter.kopf].len() - 1;
        ganz -= 1;
        entschieden = uebrige[letzter.kopf - 1].0;
    }
    let binaer = binaerpfade(&teil.ausgabe[eigenes.bereich.clone()], &vf.eigene);
    let ids: HashMap<String, String> = arbeitsrepo::patch_ids(wurzel, &teil.ausgabe[..ende], frist)?.into_iter().collect();
    drop(teil);
    let Some(meine) = ids.get(verwaist.commit) else { return Ok(Treffer { kandidaten: vec![], entschieden, gekappt }) };
    let gelesen: BTreeSet<usize> = abschnitte[..ganz].iter().filter(|a| a.kopf > 0).map(|a| a.kopf - 1).collect();
    let kandidaten = uebrige.iter().enumerate().filter(|(j, (i, eintraege))| gelesen.contains(j) && ids.get(&fenster[*i].commit) == Some(meine) && binaer_gleich(&binaer, &vf.eigene, eintraege)).map(|(_, (i, _))| *i).collect();
    Ok(Treffer { kandidaten, entschieden, gekappt })
}

// ---- Dienst: Zulassung, Zustand, Gesamtgrenze, Antwort ---------------------------------------------------------------

use super::Kanban;
use super::zweigcache::abdruck;
use crate::fehler::Fehler;
use crate::git::arbeitsrepo::{Objekt, Zweiggraph};
use crate::modell::{Anwendungen, Commitzustand, GRENZEN_VERSION, HASH_MAX, Herkunftsschluessel, Verweisform, Zweige, titel_kuerzen, verweis_lesen};
use std::path::Path;

/// Höchstens so viele Kandidaten stehen in der Antwort, der Rest in `kandidaten_weitere` (ADR-0038 Punkt 4).
pub const GEZEIGT_HOECHSTENS: usize = 10;

/// Ein Kandidat für den Nachfolger: Metadaten wie in der Liste (R00204), nie Pfade oder Patch-Text.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, utoipa::ToSchema)]
pub struct Kandidat {
    /// in der Schreibweise der Karte (`<kürzel>:<voller Hash>`, ohne Kürzel für die Standardanwendung) — passt wörtlich als `neu` in `ersetzen`
    pub verweis: String,
    pub hash: String,
    pub titel: String,
    pub autor: String,
    pub datum: String,
    pub zweige: Vec<String>,
    pub entfernte_zweige: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zweige_weitere: Option<usize>,
    /// steht schon an dieser Karte — `ersetzen` gäbe 409, der Zug ist `DELETE` des verwaisten Verweises
    pub an_der_karte: bool,
}

/// Ein Hinweis der Suche; ein Leser überspringt eine unbekannte Art.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, utoipa::ToSchema)]
#[serde(tag = "art", rename_all = "snake_case")]
pub enum Suchhinweis {
    /// die Suche hat nur `durchsucht` Commits des Fensters entschieden — ein Nachfolger kann fehlen
    SucheGekappt { durchsucht: usize, grund: Kappgrund },
    /// das verwaiste ist ein Merge: ohne Suche
    Merge,
    /// das verwaiste ändert keine Datei: ohne Suche
    Leer,
}

/// Die Antwort von `GET …/commits/{verweis}/nachfolger` (ADR-0038 Punkt 4).
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, utoipa::ToSchema)]
pub struct Nachfolger {
    /// der Verweis des verwaisten Eintrags, wörtlich wie in der Datei
    pub verweis: String,
    pub hash: String,
    pub durchsucht: usize,
    pub kandidaten: Vec<Kandidat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kandidaten_weitere: Option<usize>,
    pub hinweise: Vec<Suchhinweis>,
}

/// 304 ohne Rumpf oder die Antwort, je mit `ETag`, wenn der Verweis einen vollen Hash trägt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Nachfolgerantwort {
    Unveraendert(String),
    Ergebnis { etag: Option<String>, nachfolger: Nachfolger },
}

/// Reihenfolge der Kandidaten (ADR-0038 Punkt 4): Commit-Datum absteigend, bei Gleichstand nach Hash; gezeigt werden
/// höchstens 10, die Zahl der übrigen kommt dazu.
pub fn ordnen(mut kandidaten: Vec<(i64, String)>) -> (Vec<String>, usize) {
    kandidaten.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
    let weitere = kandidaten.len().saturating_sub(GEZEIGT_HOECHSTENS);
    (kandidaten.into_iter().take(GEZEIGT_HOECHSTENS).map(|(_, h)| h).collect(), weitere)
}

/// Der eine Hinweis zur Kappe: der Grund ist die Stufe, die `durchsucht` bestimmt hat.
fn kappe(fenster_gekappt: bool, vorfilter: usize, treffer: &Treffer, fensterlaenge: usize) -> Option<Suchhinweis> {
    let grund = if treffer.gekappt {
        Kappgrund::Patch
    } else if vorfilter < fensterlaenge {
        Kappgrund::Vorfilter
    } else if fenster_gekappt {
        Kappgrund::Fenster
    } else {
        return None;
    };
    Some(Suchhinweis::SucheGekappt { durchsucht: treffer.entschieden, grund })
}

impl Kanban {
    /// `GET /api/aufgaben/{nr}/commits/{verweis}/nachfolger` — liest die Aufgabe ohne Sperre und schreibt nie. Zulassung
    /// wie beim Diff je Commit, der Zustand wie in der Liste (≠ `verwaist` → 404 mit Zustand); ein Platz der Lesegrenze
    /// für die ganze Suche, alle Git-Prozesse nacheinander bis `frist`, danach 503 — nie eine Teilantwort.
    pub fn nachfolger_suchen(&self, nr: u32, verweis: &str, bekannt: Option<&str>, frist: Instant) -> Result<Nachfolgerantwort, Fehler> {
        let aufgabe = self.ordner().aufgabe(nr)?;
        let form = Verweisform::lesen(verweis).map_err(|f| Fehler::Verweis { meldung: f.meldung, verweis: f.verweis, fehlt: false })?;
        let treffer: Vec<&String> = aufgabe.commits.iter().filter(|c| super::commits::passt(c, &form)).collect();
        let gespeichert = match treffer.as_slice() {
            [v] => v.as_str(),
            [] => return Err(Fehler::Verweis { meldung: format!("#{nr} hat keinen Commit-Verweis „{}“", crate::nachricht::wert(verweis)), verweis: verweis.to_string(), fehlt: true }),
            mehrere => return Err(Fehler::Verweis { meldung: format!("„{}“ passt zu {} Commit-Verweisen an #{nr} — längeren Hash nennen", crate::nachricht::wert(verweis), mehrere.len()), verweis: verweis.to_string(), fehlt: false }),
        };
        let quellen = self.ordner().einstellungen()?.unwrap_or_default().quellen;
        let anwendungen = Anwendungen::aus(&quellen);
        Verweisform::lesen(gespeichert).map_err(|f| zustand(Commitzustand::Unlesbar, Some(f.meldung)))?;
        let (anwendung, hash) = verweis_lesen(gespeichert, &anwendungen).map_err(|_| zustand(Commitzustand::AnwendungUnbekannt, None))?;
        // ab hier startet Git: ein Platz der Lesegrenze für die ganze Suche, das Warten zählt zur Frist
        let _platz = self.lesegrenze.betreten(frist).ok_or_else(|| abbruch(Arbeitsrepofehler::Zeitgrenze))?;
        let wurzel = arbeitsrepo::wurzel_bis(self.ordner().wurzel(), anwendung, frist).map_err(repo_fehler)?;
        let fingerabdruck = arbeitsrepo::fingerabdruck(&wurzel, frist).map_err(repo_fehler)?;
        let etag = (hash.len() == 40 || hash.len() == HASH_MAX).then(|| etag(gespeichert, &wurzel, &fingerabdruck, &aufgabe.commits));
        if let (Some(e), Some(b)) = (&etag, bekannt) {
            if b.split(',').any(|w| w.trim() == e) {
                return Ok(Nachfolgerantwort::Unveraendert(e.clone()));
            }
        }
        let voll = match arbeitsrepo::objekte_pruefen(&wurzel, &[hash.as_str()], frist).map_err(repo_fehler)?.remove(0) {
            Objekt::Commit(voll) => voll,
            Objekt::Fehlt => return Err(zustand(Commitzustand::Fehlt, None)),
            Objekt::Mehrdeutig => return Err(zustand(Commitzustand::Unlesbar, Some(format!("Kurz-Hash „{}“ passt zu mehreren Objekten — längeren Hash nennen", crate::nachricht::wert(&hash))))),
            Objekt::NameEinesRefs => return Err(zustand(Commitzustand::Unlesbar, Some(format!("„{}“ ist zugleich der Name eines Zweigs oder Tags — vollen Hash nennen", crate::nachricht::wert(&hash))))),
        };
        let m = arbeitsrepo::metadaten(&wurzel, &[voll.as_str()], frist).map_err(repo_fehler)?.remove(&voll).ok_or_else(|| Fehler::Intern(format!("git: keine Metadaten zu {voll}")))?;
        let mut zweige = Zweigquelle { k: self, wurzel: &wurzel, fingerabdruck: &fingerabdruck, graph: None };
        if !zweige.je_commit(&[voll.as_str()], frist).map_err(repo_fehler)?.remove(&voll).unwrap_or_default().leer() {
            return Err(zustand(Commitzustand::AufZweig, None));
        }
        let ergebnis = |durchsucht, kandidaten, kandidaten_weitere, hinweise| Nachfolgerantwort::Ergebnis { etag: etag.clone(), nachfolger: Nachfolger { verweis: gespeichert.to_string(), hash: voll.clone(), durchsucht, kandidaten, kandidaten_weitere, hinweise } };
        if m.elternzahl > 1 {
            return Ok(ergebnis(0, vec![], None, vec![Suchhinweis::Merge]));
        }
        if m.dateien == 0 {
            return Ok(ergebnis(0, vec![], None, vec![Suchhinweis::Leer]));
        }
        let verwaist = Vergleich { commit: &voll, eltern: m.erster_elternteil.as_deref() };
        let (f, fenster_gekappt) = fenster(&wurzel, &voll, m.autordatum, frist).map_err(abbruch)?;
        let vf = vorfilter_lesen(&wurzel, verwaist, &f, frist).map_err(abbruch)?.ok_or_else(|| Fehler::Intern("git: Vorfilter unlesbar".into()))?;
        let t = patch_pruefen(&wurzel, verwaist, &f, &vf, frist).map_err(abbruch)?;
        let hinweise: Vec<Suchhinweis> = kappe(fenster_gekappt, vf.entschieden, &t, f.len()).into_iter().collect();
        let (gezeigt, weitere) = ordnen(t.kandidaten.iter().map(|i| (f[*i].zeit, f[*i].commit.clone())).collect());
        let gezeigt_refs: Vec<&str> = gezeigt.iter().map(String::as_str).collect();
        let kandidaten = if gezeigt.is_empty() {
            vec![]
        } else {
            let meta = arbeitsrepo::metadaten(&wurzel, &gezeigt_refs, frist).map_err(repo_fehler)?;
            let zw = zweige.je_commit(&gezeigt_refs, frist).map_err(repo_fehler)?;
            gezeigt.iter().map(|h| {
                let km = meta.get(h).ok_or_else(|| Fehler::Intern(format!("git: keine Metadaten zu {h}")))?;
                let z = zw.get(h).cloned().unwrap_or_default();
                let neu = Verweisform { kuerzel: Some(anwendung.kuerzel.clone()).filter(|k| !k.is_empty()), hash: h.clone() };
                Ok(Kandidat { verweis: Herkunftsschluessel::qualifiziert(&anwendung.kuerzel, h), hash: h.clone(), titel: titel_kuerzen(&km.titel), autor: km.autor.clone(), datum: km.datum.clone(), zweige: z.lokal, entfernte_zweige: z.entfernt, zweige_weitere: (z.weitere > 0).then_some(z.weitere), an_der_karte: aufgabe.commits.iter().any(|c| super::commits::passt(c, &neu)) })
            }).collect::<Result<Vec<_>, Fehler>>()?
        };
        let antwort = ergebnis(t.entschieden, kandidaten, (weitere > 0).then_some(weitere), hinweise);
        #[cfg(test)]
        if let Some(haken) = self.nach_dem_belegen.lock().unwrap().take() {
            haken(self.lesegrenze.belegt());
        }
        Ok(antwort)
    }
}

/// Zweige je Commit: aus dem Zweigcache der Liste unter dem Fingerabdruck, sonst aus einem einmal gelesenen Graphen —
/// Zustand und Kandidaten teilen sich den einen Lauf `rev-list` (ADR-0038 Punkt 2.7). Abgelegt wird nichts.
struct Zweigquelle<'a> {
    k: &'a Kanban,
    wurzel: &'a Path,
    fingerabdruck: &'a str,
    graph: Option<Zweiggraph>,
}

impl Zweigquelle<'_> {
    fn je_commit(&mut self, commits: &[&str], frist: Instant) -> Result<HashMap<String, Zweige>, Arbeitsrepofehler> {
        let schluessel = abdruck(self.fingerabdruck);
        let mut ergebnis: HashMap<String, Zweige> = HashMap::new();
        {
            let cache = self.k.zweigcache.lock().unwrap_or_else(|p| p.into_inner());
            ergebnis.extend(commits.iter().filter_map(|c| cache.holen(self.wurzel, &schluessel, c).map(|z| (c.to_string(), z))));
        }
        let offen: Vec<&str> = commits.iter().copied().filter(|c| !ergebnis.contains_key(*c)).collect();
        if offen.is_empty() {
            return Ok(ergebnis);
        }
        let graph = match self.graph.take() {
            Some(g) => g,
            None => arbeitsrepo::zweiggraph(self.wurzel, self.fingerabdruck, frist)?,
        };
        let erreicht = graph.erreichbar(&offen, frist);
        self.graph = Some(graph);
        let erreicht = erreicht?;
        ergebnis.extend(offen.iter().map(|c| (c.to_string(), Zweige::aus(erreicht.get(*c).into_iter().flatten().map(String::as_str)))));
        Ok(ergebnis)
    }
}

/// 404 mit dem Zustand des Verweises, wie die Liste ihn nennt: gesucht wird nur für `verwaist` (R00218 FA 2).
fn zustand(zustand: Commitzustand, grund: Option<String>) -> Fehler {
    Fehler::Commitzustand { meldung: "kein Nachfolger zu diesem Verweis — gesucht wird nur für einen Commit auf keinem Zweig; der Zustand sagt warum".into(), zustand, grund }
}

/// Repository fehlt oder verweigert → 404 `repository_fehlt` mit Grund; Zeitgrenze → 503; sonst 500.
fn repo_fehler(f: Arbeitsrepofehler) -> Fehler {
    match f {
        Arbeitsrepofehler::RepositoryFehlt(grund) => zustand(Commitzustand::RepositoryFehlt, Some(grund)),
        anders => abbruch(anders),
    }
}

/// Zeitgrenze und Zeilengrenze → 503 ohne Kandidaten; alles andere ist ein Fehler des Programms.
fn abbruch(f: Arbeitsrepofehler) -> Fehler {
    match f {
        Arbeitsrepofehler::Zeitgrenze => Fehler::Zeitgrenze(format!("Git im Arbeits-Repository antwortete nicht innerhalb von {} s — keine Suche nach dem Nachfolger", super::GESAMTGRENZE.as_secs())),
        Arbeitsrepofehler::ZuvielAusgabe(n) => Fehler::Zeitgrenze(format!("Git lieferte mehr als {n} Zeilen — keine Suche nach dem Nachfolger")),
        Arbeitsrepofehler::RepositoryFehlt(m) | Arbeitsrepofehler::Start(m) | Arbeitsrepofehler::ArgumenteZuLang(m) => Fehler::Intern(format!("git: {m}")),
        Arbeitsrepofehler::KeinCommit => Fehler::Intern("git: kein Commit".into()),
    }
}

/// `ETag` (ADR-0038 Punkt 7): verwaister Verweis, Repository, Zweigspitzen (Fingerabdruck), Verweise der Karte
/// (`an_der_karte`) und Version der Grenzen — FNV-1a 64 Bit wie beim Diff.
fn etag(verweis: &str, wurzel: &Path, fingerabdruck: &str, verweise: &[String]) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    let wurzel = wurzel.to_string_lossy();
    let karte = verweise.join("\n");
    let teile = [verweis.as_bytes(), b"\0", wurzel.as_bytes(), b"\0", fingerabdruck.as_bytes(), b"\0", karte.as_bytes(), b"\0", &GRENZEN_VERSION.to_be_bytes()];
    for b in teile.iter().flat_map(|t| t.iter()) {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("\"nachfolger-{h:016x}\"")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};
    use std::process::Command;
    use std::time::Duration;

    pub(super) fn git(r: &Path, args: &[&str]) -> String {
        let a = Command::new("git").arg("-C").arg(r).args(["-c", "user.name=A", "-c", "user.email=a@a"]).args(args).output().unwrap();
        assert!(a.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&a.stderr));
        String::from_utf8_lossy(&a.stdout).trim().to_string()
    }

    pub(super) fn frist() -> Instant {
        Instant::now() + Duration::from_secs(10)
    }

    fn roh(pfad: &str, neu: &str) -> Rohdatei {
        Rohdatei { modus_alt: "100644".into(), modus_neu: "100644".into(), hash_alt: "0".repeat(40), hash_neu: neu.into(), status: 'M', zahl: None, pfade: vec![pfad.as_bytes().to_vec()] }
    }

    // R00218 B1114: die Pfadmenge vergleicht nur Pfade, nicht Reihenfolge, Blobs oder Modus
    #[test]
    fn pfadmenge_vergleich() {
        assert!(pfadmenge_gleich(&[roh("a", "1"), roh("b", "2")], &[roh("b", "9"), roh("a", "8")]));
        assert!(!pfadmenge_gleich(&[roh("a", "1")], &[roh("a", "1"), roh("b", "2")]));
        assert!(!pfadmenge_gleich(&[roh("a", "1")], &[roh("c", "1")]));
        assert!(pfadmenge_gleich(&[], &[]));
    }

    const V: &str = "1111111111111111111111111111111111111111";
    const A: &str = "2222222222222222222222222222222222222222";
    const B: &str = "3333333333333333333333333333333333333333";
    const C: &str = "4444444444444444444444444444444444444444";

    fn eintrag(pfad: &str) -> String {
        format!(":100644 100644 {} {} M\0{pfad}\0", "0".repeat(40), "1".repeat(40))
    }

    // R00218 B1114: gleiche Pfadmenge kommt weiter, andere nicht; ein Commit ohne Kopf (leer) fällt weg
    #[test]
    fn vorfilter_nach_pfadmenge() {
        let aus = format!("{V}\0{}{A}\0{}{C}\0{}{}", eintrag("x"), eintrag("x"), eintrag("x"), eintrag("y"));
        let f = vorfilter(aus.as_bytes(), false, &[V, A, B, C]).unwrap();
        assert_eq!(f.uebrige.iter().map(|(i, _)| *i).collect::<Vec<_>>(), [0], "A ja, B leer, C andere Menge");
        assert_eq!((f.entschieden, f.eigene.len()), (3, 1));
    }

    // R00218 B1114: abgeschnitten → nur die Commits vor dem letzten Kopf zählen als gelesen (`entschieden`), der angefangene nie
    #[test]
    fn vorfilter_abgeschnitten_nur_ganz_gelesene() {
        let aus = format!("{V}\0{}{A}\0{}{B}\0{}{C}\0{}", eintrag("x"), eintrag("x"), eintrag("x"), &eintrag("x")[..20]);
        let f = vorfilter(aus.as_bytes(), true, &[V, A, B, C]).unwrap();
        assert_eq!(f.uebrige.iter().map(|(i, _)| *i).collect::<Vec<_>>(), [0, 1]);
        assert_eq!(f.entschieden, 2, "C ist angefangen");
        let cut = format!("{V}\0{}", &eintrag("x")[..20]);
        assert_eq!(vorfilter(cut.as_bytes(), true, &[V, A]).unwrap(), Vorfilter { eigene: vec![], uebrige: vec![], entschieden: 0 });
    }

    /// Repository R: M0 (`a.txt`, `b.txt`), K auf `karte/1` ändert `a.txt`, `main` bewegt (M1 `c.txt`), Rebase, `karte/1`
    /// gelöscht; G auf `fremd` ändert `a.txt` anders, H auf `fremd` ändert `b.txt`. Liefert Ordner, K, K', G, H, M1.
    pub(super) struct Rebase {
        pub _tmp: tempfile::TempDir,
        pub r: PathBuf,
        pub k: String,
        pub k2: String,
        pub g: String,
        pub h: String,
        pub m1: String,
    }

    pub(super) fn rebase() -> Rebase {
        let tmp = tempfile::tempdir().unwrap();
        let r = tmp.path().canonicalize().unwrap().join("R");
        std::fs::create_dir_all(&r).unwrap();
        git(&r, &["init", "-q", "-b", "main"]);
        std::fs::write(r.join("a.txt"), "eins\nzwei\ndrei\n").unwrap();
        std::fs::write(r.join("b.txt"), "Hallo\n").unwrap();
        git(&r, &["add", "-A"]);
        git(&r, &["commit", "-qm", "Grundstand", "--date=2020-01-01T00:00:00Z"]);
        git(&r, &["checkout", "-q", "-b", "karte/1"]);
        std::fs::write(r.join("a.txt"), "eins\nZWEI\ndrei\n").unwrap();
        git(&r, &["commit", "-qam", "Zeile zwei ändern"]);
        let k = git(&r, &["rev-parse", "HEAD"]);
        git(&r, &["checkout", "-q", "main"]);
        std::fs::write(r.join("c.txt"), "drei\n").unwrap();
        git(&r, &["add", "c.txt"]);
        git(&r, &["commit", "-qm", "Drittes anlegen"]);
        let m1 = git(&r, &["rev-parse", "HEAD"]);
        git(&r, &["checkout", "-q", "karte/1"]);
        let datum = [("GIT_COMMITTER_DATE", "2030-01-01T00:00:00Z")];
        assert!(Command::new("git").arg("-C").arg(&r).args(["-c", "user.name=A", "-c", "user.email=a@a", "rebase", "-q", "main"]).envs(datum).status().unwrap().success());
        let k2 = git(&r, &["rev-parse", "HEAD"]);
        git(&r, &["checkout", "-q", "main"]);
        git(&r, &["merge", "-q", "--ff-only", "karte/1"]);
        git(&r, &["branch", "-q", "-D", "karte/1"]);
        git(&r, &["checkout", "-q", "-b", "fremd", &m1]);
        std::fs::write(r.join("a.txt"), "eins\nzwei anders\ndrei\n").unwrap();
        git(&r, &["commit", "-qam", "Zeile zwei anders ändern"]);
        let g = git(&r, &["rev-parse", "HEAD"]);
        std::fs::write(r.join("b.txt"), "Servus\n").unwrap();
        git(&r, &["commit", "-qam", "Gruß ändern"]);
        let h = git(&r, &["rev-parse", "HEAD"]);
        git(&r, &["checkout", "-q", "main"]);
        Rebase { _tmp: tmp, r, k, k2, g, h, m1 }
    }

    // R00218 B1114 (ADR-0038 Punkt 2.2, 2.3) gegen echtes Git: das Fenster nennt K', G, H und M1, nie K und keinen Vorfahren
    // von K; der Vorfilter lässt nur K' und G (gleiche Pfadmenge `a.txt`) übrig
    #[test]
    fn fenster_und_vorfilter_gegen_echtes_git() {
        let s = rebase();
        let m = arbeitsrepo::metadaten(&s.r, &[s.k.as_str()], frist()).unwrap().remove(&s.k).unwrap();
        let (f, gekappt) = fenster(&s.r, &s.k, m.autordatum, frist()).unwrap();
        let im_fenster: BTreeSet<&str> = f.iter().map(|c| c.commit.as_str()).collect();
        assert_eq!(im_fenster, [s.k2.as_str(), s.g.as_str(), s.h.as_str(), s.m1.as_str()].into_iter().collect(), "Grundstand ist Vorfahr von K");
        assert!(!gekappt);
        assert_eq!(f[0].commit, s.k2, "neuester zuerst (Commit-Datum 2030)");
        let vf = vorfilter_lesen(&s.r, Vergleich { commit: &s.k, eltern: m.erster_elternteil.as_deref() }, &f, frist()).unwrap().unwrap();
        let uebrig: BTreeSet<&str> = vf.uebrige.iter().map(|(i, _)| f[*i].commit.as_str()).collect();
        assert_eq!(uebrig, [s.k2.as_str(), s.g.as_str()].into_iter().collect());
        assert_eq!(vf.entschieden, 4);
    }

    // R00218 AK 3 (B1114): ein Fenster aus 1.001 Commits wird bei 1.000 gekappt — über `git fast-import`
    #[test]
    fn fenster_mit_1001_commits_ist_gekappt() {
        let s = rebase();
        let mut strom = String::new();
        for i in 0..1_001 {
            let d = format!("{i}\n");
            strom.push_str(&format!("commit refs/heads/main\ncommitter A <a@a> {} +0000\ndata 1\nx\n{}M 644 inline n.txt\ndata {}\n{d}\n", 1_900_000_000 + i, if i == 0 { "from refs/heads/main^0\n" } else { "" }, d.len()));
        }
        let mut kind = Command::new("git").arg("-C").arg(&s.r).args(["fast-import", "--quiet"]).stdin(std::process::Stdio::piped()).spawn().unwrap();
        std::io::Write::write_all(&mut kind.stdin.take().unwrap(), strom.as_bytes()).unwrap();
        assert!(kind.wait().unwrap().success());
        let m = arbeitsrepo::metadaten(&s.r, &[s.k.as_str()], frist()).unwrap().remove(&s.k).unwrap();
        let (f, gekappt) = fenster(&s.r, &s.k, m.autordatum, frist()).unwrap();
        assert_eq!((f.len(), gekappt), (1_000, true));
    }

    /// Fenster, Vorfilter und Patch-Lauf für `v`; die Kandidaten als Hashes.
    pub(super) fn kandidaten(r: &Path, v: &str) -> (Vec<String>, Treffer) {
        let m = arbeitsrepo::metadaten(r, &[v], frist()).unwrap().remove(v).unwrap();
        let (f, _) = fenster(r, v, m.autordatum, frist()).unwrap();
        let verwaist = Vergleich { commit: v, eltern: m.erster_elternteil.as_deref() };
        let vf = vorfilter_lesen(r, verwaist, &f, frist()).unwrap().unwrap();
        let t = patch_pruefen(r, verwaist, &f, &vf, frist()).unwrap();
        (t.kandidaten.iter().map(|i| f[*i].commit.clone()).collect(), t)
    }

    // R00218 B1115: welche Pfade das verwaiste binär ändert, folgt aus seinen Blöcken in der Reihenfolge der Einträge;
    // passt die Zahl nicht, gilt jeder Pfad als binär
    #[test]
    fn binaerpfade_aus_dem_patch() {
        let eigene = [roh("a.txt", "1"), roh("bild.png", "2")];
        let stueck = b"diff --git a/a.txt b/a.txt\nindex 0..1 100644\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-Binary files x\n+y\ndiff --git a/bild.png b/bild.png\nindex 0..2 100644\nBinary files a/bild.png and b/bild.png differ\n";
        assert_eq!(binaerpfade(stueck, &eigene), [b"bild.png".to_vec()], "eine Inhaltszeile „-Binary files“ zählt nicht");
        assert_eq!(binaerpfade(b"diff --git a/a.txt b/a.txt\n", &eigene), [b"a.txt".to_vec(), b"bild.png".to_vec()]);
        assert!(binaerpfade(b"diff --git a/a.txt b/a.txt\ndiff --git a/bild.png b/bild.png\n", &eigene).is_empty());
    }

    // R00218 B1115 (ADR-0038 Pre-Mortem b): ein Kandidat mit anderem neuem Blob einer Binärdatei fällt heraus, Textdateien
    // dürfen einen anderen Blob haben (anderer Kontext nach dem Rebase)
    #[test]
    fn binaerschutz() {
        let eigene = [roh("a.txt", "1"), roh("bild.png", "X")];
        let binaer = vec![b"bild.png".to_vec()];
        assert!(binaer_gleich(&binaer, &eigene, &[roh("a.txt", "9"), roh("bild.png", "X")]));
        assert!(!binaer_gleich(&binaer, &eigene, &[roh("a.txt", "1"), roh("bild.png", "Y")]));
        assert!(!binaer_gleich(&binaer, &eigene, &[roh("a.txt", "1")]));
        assert!(binaer_gleich(&[], &eigene, &[roh("a.txt", "9"), roh("bild.png", "Y")]));
    }

    // R00218 B1115, Abnahme-Probe der Karte (ADR-0038 „Durchsetzung“, erster Test): K auf `karte/1`, Rebase auf ein
    // bewegtes `main`, `karte/1` gelöscht → genau K'; G (dieselbe Datei, anderer Inhalt) kommt nie vor
    #[test]
    fn durchsetzung_k_liefert_genau_k_strich() {
        let s = rebase();
        let (k, t) = kandidaten(&s.r, &s.k);
        assert_eq!(k, [s.k2.clone()]);
        assert!(!k.contains(&s.g) && !t.gekappt);
    }

    // R00218 AK 3 (B1115): B ändert `bild.png` auf X; B2 auf `z` ändert denselben alten Inhalt auf Y, B3 ist B per
    // Cherry-pick auf `w` → nur B3
    #[test]
    fn binaerdatei_nur_mit_gleichem_inhalt() {
        let s = rebase();
        let r = &s.r;
        std::fs::write(r.join("bild.png"), b"\x89PNG\0alt\0").unwrap();
        git(r, &["add", "bild.png"]);
        git(r, &["commit", "-qm", "Bild anlegen"]);
        let basis = git(r, &["rev-parse", "HEAD"]);
        git(r, &["checkout", "-q", "--detach", &basis]);
        std::fs::write(r.join("bild.png"), b"\x89PNG\0X\0").unwrap();
        git(r, &["commit", "-qam", "Bild tauschen"]);
        let b = git(r, &["rev-parse", "HEAD"]);
        git(r, &["checkout", "-q", "-b", "z", &basis]);
        std::fs::write(r.join("bild.png"), b"\x89PNG\0Y\0").unwrap();
        git(r, &["commit", "-qam", "Bild anders tauschen"]);
        let b2 = git(r, &["rev-parse", "HEAD"]);
        git(r, &["checkout", "-q", "-b", "w", &format!("{basis}")]);
        std::fs::write(r.join("d.txt"), "d\n").unwrap();
        git(r, &["add", "d.txt"]);
        git(r, &["commit", "-qm", "dazwischen"]);
        git(r, &["cherry-pick", &b]);
        let b3 = git(r, &["rev-parse", "HEAD"]);
        let (k, _) = kandidaten(r, &b);
        assert_eq!(k, [b3]);
        assert!(!k.contains(&b2));
    }

    // R00218 B1115: mehr als 50 Übrige → nur die 50 neuesten gehen in den Patch-Lauf, `gekappt`, entschieden bis zum 50.
    #[test]
    fn mehr_als_50_uebrige_sind_gekappt() {
        let s = rebase();
        let mut strom = String::new();
        for i in 0..51 {
            let d = format!("eins\n{i}\ndrei\n");
            strom.push_str(&format!("commit refs/heads/viele\ncommitter A <a@a> {} +0000\ndata 1\nx\n{}M 644 inline a.txt\ndata {}\n{d}\n", 1_900_000_000 + i, if i == 0 { format!("from {}\n", s.m1) } else { String::new() }, d.len()));
        }
        let mut kind = Command::new("git").arg("-C").arg(&s.r).args(["fast-import", "--quiet"]).stdin(std::process::Stdio::piped()).spawn().unwrap();
        std::io::Write::write_all(&mut kind.stdin.take().unwrap(), strom.as_bytes()).unwrap();
        assert!(kind.wait().unwrap().success());
        let (k, t) = kandidaten(&s.r, &s.k);
        assert!(k.is_empty(), "K' ist älter als die 50 neuesten Übrigen: {k:?}");
        assert_eq!((t.gekappt, t.entschieden), (true, 50));
    }

    // ---- Dienst ----

    /// Board-Ordner mit Register `kd` → `r` und #1 mit den Verweisen `verweise`.
    fn board(basis: &Path, r: &Path, verweise: &[String]) -> Kanban {
        let board = basis.join("board");
        std::fs::create_dir_all(board.join("aufgaben")).unwrap();
        std::fs::create_dir_all(board.join("boards")).unwrap();
        std::fs::write(r.join("app.md"), "# App\n").unwrap();
        std::fs::write(board.join("kanbanD.md"), format!("---\npeople:\n  entw1: {{name: E, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}/app.md, requirements: \"\"}}\n---\n", r.display())).unwrap();
        let liste: String = verweise.iter().map(|v| format!("  - {v}\n")).collect();
        std::fs::write(board.join("aufgaben/0001-a.md"), format!("---\nid: 1\ntitle: a\ncommits:\n{liste}---\n")).unwrap();
        std::fs::write(board.join("boards/fabrik.md"), "# Fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-a.md)\n").unwrap();
        git(&board, &["init", "-q"]);
        git(&board, &["add", "-A"]);
        git(&board, &["commit", "-qm", "Fabrik"]);
        Kanban::neu(board)
    }

    fn ergebnis(a: Nachfolgerantwort) -> (Option<String>, Nachfolger) {
        match a {
            Nachfolgerantwort::Ergebnis { etag, nachfolger } => (etag, nachfolger),
            Nachfolgerantwort::Unveraendert(e) => panic!("304 {e}"),
        }
    }

    fn suchen(k: &Kanban, verweis: &str) -> Result<Nachfolger, Fehler> {
        k.nachfolger_suchen(1, verweis, None, frist()).map(|a| ergebnis(a).1)
    }

    // R00218 AK 2 (B1116): `kd:<K:7>` an #1 → genau ein Kandidat `kd:<K'>` auf `main`, nicht an der Karte; G kommt nie
    // vor; Board-Ordner und Arbeits-Repository bleiben unverändert (Pre-Mortem d: kanbanD ersetzt nie selbst)
    #[test]
    fn dienst_nennt_k_strich_und_schreibt_nichts() {
        let s = rebase();
        let k = board(s._tmp.path(), &s.r, &[format!("kd:{}", s.k), format!("kd:{}", s.m1)]);
        let zahl = |o: &Path| git(o, &["rev-list", "--count", "HEAD"]);
        let (vorher_board, vorher_r) = (zahl(k.ordner().wurzel()), git(&s.r, &["status", "--porcelain"]));
        let n = suchen(&k, &format!("kd:{}", &s.k[..7])).unwrap();
        assert_eq!((n.verweis.as_str(), n.hash.as_str()), (format!("kd:{}", s.k).as_str(), s.k.as_str()));
        assert_eq!(n.kandidaten.len(), 1, "{n:?}");
        let c = &n.kandidaten[0];
        assert_eq!((c.verweis.as_str(), c.zweige.clone(), c.an_der_karte), (format!("kd:{}", s.k2).as_str(), vec!["main".to_string()], false));
        assert_eq!((c.titel.as_str(), c.autor.as_str()), ("Zeile zwei ändern", "A"));
        assert!(n.kandidaten_weitere.is_none() && n.hinweise.is_empty() && n.durchsucht == 4, "{n:?}");
        assert_eq!((zahl(k.ordner().wurzel()), git(&s.r, &["status", "--porcelain"])), (vorher_board, vorher_r));
        assert_eq!(git(k.ordner().wurzel(), &["status", "--porcelain"]), "");
    }

    // R00218 AK 2: steht K' schon an der Karte, trägt der Kandidat `an_der_karte: true`
    #[test]
    fn kandidat_schon_an_der_karte() {
        let s = rebase();
        let k = board(s._tmp.path(), &s.r, &[format!("kd:{}", s.k), format!("kd:{}", s.k2)]);
        let n = suchen(&k, &format!("kd:{}", s.k)).unwrap();
        assert_eq!(n.kandidaten.iter().map(|c| (c.hash.clone(), c.an_der_karte)).collect::<Vec<_>>(), [(s.k2.clone(), true)]);
    }

    // R00218 AK 2 (FA 4): Commit-Datum absteigend, bei Gleichstand nach Hash; höchstens 10, der Rest als Zahl
    #[test]
    fn ordnen_zehn_und_weitere() {
        let zwoelf: Vec<(i64, String)> = (0..12).map(|i| (i, format!("{i:02}"))).collect();
        let (gezeigt, weitere) = ordnen(zwoelf);
        assert_eq!(weitere, 2);
        assert_eq!(gezeigt, ["11", "10", "09", "08", "07", "06", "05", "04", "03", "02"], "neuester zuerst");
        let (gezeigt, _) = ordnen(vec![(1, "b".into()), (2, "z".into()), (1, "a".into())]);
        assert_eq!(gezeigt, ["z", "a", "b"], "im Gleichstand kleiner Hash vorn");
        let (gezeigt, weitere) = ordnen((0..10).map(|i| (i, format!("{i}"))).collect());
        assert_eq!((gezeigt.len(), weitere), (10, 0));
    }

    // R00218 AK 3: ein verwaister Merge → `merge`, ein leerer Commit → `leer`, je ohne Suche und ohne Kandidat
    #[test]
    fn merge_und_leer_ohne_suche() {
        let s = rebase();
        git(&s.r, &["checkout", "-q", "-b", "karte/4", &s.m1]);
        git(&s.r, &["merge", "-q", "--no-ff", "-m", "Zusammenführen", "fremd"]);
        let mg = git(&s.r, &["rev-parse", "HEAD"]);
        git(&s.r, &["checkout", "-q", "--detach", "main"]);
        git(&s.r, &["commit", "-q", "--allow-empty", "-m", "Leer"]);
        let e = git(&s.r, &["rev-parse", "HEAD"]);
        git(&s.r, &["checkout", "-q", "main"]);
        git(&s.r, &["branch", "-q", "-D", "karte/4"]);
        let k = board(s._tmp.path(), &s.r, &[format!("kd:{mg}"), format!("kd:{e}")]);
        let vorher = arbeitsrepo::aufrufe();
        let n = suchen(&k, &format!("kd:{mg}")).unwrap();
        assert_eq!((n.kandidaten.len(), n.hinweise.clone()), (0, vec![Suchhinweis::Merge]));
        assert_eq!(arbeitsrepo::aufrufe() - vorher, 5, "Wurzel, Fingerabdruck, cat-file, log, Zweige — kein Fenster");
        let n = suchen(&k, &format!("kd:{e}")).unwrap();
        assert_eq!((n.kandidaten.len(), n.hinweise.clone()), (0, vec![Suchhinweis::Leer]));
    }

    // R00218 AK 4: Zulassung — Aufgabe unbekannt, Zustand `auf_zweig`, Verweis nicht an der Karte, falsche Form,
    // Präfix mit 6 Zeichen, defekte Datei; ohne Git, wo es ohne geht
    #[test]
    fn zulassung() {
        let s = rebase();
        let k = board(s._tmp.path(), &s.r, &[format!("kd:{}", s.k), format!("kd:{}", s.m1)]);
        assert!(matches!(k.nachfolger_suchen(999, &format!("kd:{}", s.k), None, frist()), Err(Fehler::NichtGefunden(_))));
        match suchen(&k, &format!("kd:{}", &s.m1[..7])) {
            Err(Fehler::Commitzustand { zustand: Commitzustand::AufZweig, .. }) => {}
            anders => panic!("{anders:?}"),
        }
        let vorher = arbeitsrepo::aufrufe();
        assert!(matches!(suchen(&k, &format!("kd:{}", s.g)), Err(Fehler::Verweis { fehlt: true, .. })));
        assert!(matches!(suchen(&k, "kd:main"), Err(Fehler::Verweis { fehlt: false, .. })));
        assert!(matches!(suchen(&k, &format!("kd:{}", &s.k[..6])), Err(Fehler::Verweis { fehlt: false, .. })));
        assert_eq!(arbeitsrepo::aufrufe(), vorher, "kein Git für eine Abweisung ohne Repository");
        std::fs::write(k.ordner().wurzel().join("aufgaben/0001-a.md"), "---\nid: 1\ntitle: [kaputt\n---\n").unwrap();
        assert!(matches!(suchen(&k, &format!("kd:{}", s.k)), Err(Fehler::Defekt(_))), "423");
    }

    // R00218 AK 5 (Zählerprobe, ADR-0038 Q2): bei 1, 30 und 1.000 Commits im Fenster höchstens 12 Git-Prozesse, die
    // Lesegrenze ist während der Suche mit genau 1 belegt
    #[test]
    fn hoechstens_12_prozesse_und_ein_platz() {
        for weitere in [0usize, 29, 999] {
            let s = rebase();
            let mut strom = String::new();
            for i in 0..weitere {
                let d = format!("{i}\n");
                strom.push_str(&format!("commit refs/heads/viele\ncommitter A <a@a> {} +0000\ndata 1\nx\n{}M 644 inline n.txt\ndata {}\n{d}\n", 1_900_000_000 + i, if i == 0 { format!("from {}\n", s.m1) } else { String::new() }, d.len()));
            }
            if weitere > 0 {
                let mut kind = Command::new("git").arg("-C").arg(&s.r).args(["fast-import", "--quiet"]).stdin(std::process::Stdio::piped()).spawn().unwrap();
                std::io::Write::write_all(&mut kind.stdin.take().unwrap(), strom.as_bytes()).unwrap();
                assert!(kind.wait().unwrap().success());
            }
            // nur K' (und bei 0 weiteren G, H, M1) — die Zahl der Fenster-Commits steht in `durchsucht`
            git(&s.r, &["branch", "-q", "-D", "fremd"]);
            let k = board(s._tmp.path(), &s.r, &[format!("kd:{}", s.k)]);
            let belegt = std::sync::Arc::new(std::sync::Mutex::new(None));
            let b = belegt.clone();
            *k.nach_dem_belegen.lock().unwrap() = Some(Box::new(move |n| *b.lock().unwrap() = Some(n)));
            let vorher = arbeitsrepo::aufrufe();
            let n = suchen(&k, &format!("kd:{}", s.k)).unwrap();
            let prozesse = arbeitsrepo::aufrufe() - vorher;
            assert!(prozesse <= 12, "{weitere}: {prozesse} Prozesse");
            assert_eq!(*belegt.lock().unwrap(), Some(1), "{weitere}: Lesegrenze");
            assert_eq!(n.durchsucht, (weitere + 2).min(1_000), "{weitere}: K' und M1 dazu");
        }
    }

    // R00218 AK 6 (ADR-0038 Punkt 7): gleicher `If-None-Match` → 304 nach Wurzel und Fingerabdruck; ein neuer Zweig oder
    // ein neuer Verweis an der Karte ändert den `ETag`
    #[test]
    fn etag_und_304() {
        let s = rebase();
        let k = board(s._tmp.path(), &s.r, &[format!("kd:{}", s.k)]);
        let v = format!("kd:{}", s.k);
        let (etag, _) = ergebnis(k.nachfolger_suchen(1, &v, None, frist()).unwrap());
        let etag = etag.expect("voller Hash trägt einen ETag");
        let vorher = arbeitsrepo::aufrufe();
        assert_eq!(k.nachfolger_suchen(1, &v, Some(&etag), frist()).unwrap(), Nachfolgerantwort::Unveraendert(etag.clone()));
        assert_eq!(arbeitsrepo::aufrufe() - vorher, 2);
        git(&s.r, &["branch", "neu", &s.m1]);
        let (neu, _) = ergebnis(k.nachfolger_suchen(1, &v, Some(&etag), frist()).unwrap());
        assert_ne!(neu.as_deref(), Some(etag.as_str()));
        let datei = k.ordner().wurzel().join("aufgaben/0001-a.md");
        std::fs::write(&datei, format!("---\nid: 1\ntitle: a\ncommits:\n  - kd:{}\n  - kd:{}\n---\n", s.k, s.k2)).unwrap();
        let (dritter, n) = ergebnis(k.nachfolger_suchen(1, &v, neu.as_deref(), frist()).unwrap());
        assert_ne!(dritter, neu);
        assert!(n.kandidaten[0].an_der_karte);
        assert_eq!(k.nachfolger_suchen(1, &format!("kd:{}", &s.k[..7]), dritter.as_deref(), frist()).unwrap(), Nachfolgerantwort::Unveraendert(dritter.unwrap()), "der ETag hängt am gespeicherten Verweis, nicht an der Schreibweise der Anfrage");
    }

    // R00218 AK 4: ist die Gesamtgrenze vorbei, kommt 503 und es startet kein Git
    #[test]
    fn abgelaufene_frist_ist_503() {
        let s = rebase();
        let k = board(s._tmp.path(), &s.r, &[format!("kd:{}", s.k)]);
        let vorher = arbeitsrepo::aufrufe();
        assert!(matches!(k.nachfolger_suchen(1, &format!("kd:{}", s.k), None, Instant::now()), Err(Fehler::Zeitgrenze(_))));
        assert_eq!(arbeitsrepo::aufrufe() - vorher, 0);
    }

    // R00218 AK 5 (ADR-0038 Q3, Pre-Mortem c): die Antwort trägt keinen Schlüssel `patch`, `pfad`, `dateien`, keinen
    // Dateinamen und nie den Titel eines Commits mit anderer `patch-id`
    #[test]
    fn nie_inhalt_in_der_antwort() {
        let s = rebase();
        let k = board(s._tmp.path(), &s.r, &[format!("kd:{}", s.k)]);
        let text = serde_json::to_string(&suchen(&k, &format!("kd:{}", s.k)).unwrap()).unwrap();
        for verboten in ["\"patch\"", "\"pfad\"", "\"dateien\"", "a.txt", "b.txt", "Zeile zwei anders ändern", "Gruß ändern"] {
            assert!(!text.contains(verboten), "{verboten} in {text}");
        }
    }
}
