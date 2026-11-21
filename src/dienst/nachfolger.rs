//! Nachfolger eines verwaisten Commits suchen (R00218, ADR-0038): auf Anfrage, nur lesend, ohne die Sperre des
//! Board-Ordners — Fenster ab dem Autordatum, Vorfilter nach der Pfadmenge, `patch-id --stable` nur für die Übrigen,
//! Binärschutz. Die Antwort nennt nur Hash und Metadaten von Commits mit derselben `patch-id`, nie Patch-Text oder Pfade.

use crate::git::arbeitsrepo::{self, Arbeitsrepofehler, Vergleich, Vielart};
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

/// Commits des Fensters: `(commit, erster Elternteil)`, neueste zuerst.
pub type Fenster = Vec<(String, Option<String>)>;

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
pub fn vorfilter_lesen(wurzel: &std::path::Path, verwaist: Vergleich, fenster: &[(String, Option<String>)], frist: Instant) -> Result<Option<Vorfilter>, Arbeitsrepofehler> {
    let mut vergleiche = vec![verwaist];
    vergleiche.extend(fenster.iter().map(|(c, e)| Vergleich { commit: c, eltern: e.as_deref() }));
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
    vergleiche.extend(uebrige.iter().map(|(i, _)| Vergleich { commit: &fenster[*i].0, eltern: fenster[*i].1.as_deref() }));
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
    let kandidaten = uebrige.iter().enumerate().filter(|(j, (i, eintraege))| gelesen.contains(j) && ids.get(&fenster[*i].0) == Some(meine) && binaer_gleich(&binaer, &vf.eigene, eintraege)).map(|(_, (i, _))| *i).collect();
    Ok(Treffer { kandidaten, entschieden, gekappt })
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
        let im_fenster: BTreeSet<&str> = f.iter().map(|(c, _)| c.as_str()).collect();
        assert_eq!(im_fenster, [s.k2.as_str(), s.g.as_str(), s.h.as_str(), s.m1.as_str()].into_iter().collect(), "Grundstand ist Vorfahr von K");
        assert!(!gekappt);
        assert_eq!(f[0].0, s.k2, "neuester zuerst (Commit-Datum 2030)");
        let vf = vorfilter_lesen(&s.r, Vergleich { commit: &s.k, eltern: m.erster_elternteil.as_deref() }, &f, frist()).unwrap().unwrap();
        let uebrig: BTreeSet<&str> = vf.uebrige.iter().map(|(i, _)| f[*i].0.as_str()).collect();
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
        (t.kandidaten.iter().map(|i| f[*i].0.clone()).collect(), t)
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
}
