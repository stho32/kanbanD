//! Nachfolger eines verwaisten Commits suchen (R00218, ADR-0038): auf Anfrage, nur lesend, ohne die Sperre des
//! Board-Ordners — Fenster ab dem Autordatum, Vorfilter nach der Pfadmenge, `patch-id --stable` nur für die Übrigen,
//! Binärschutz. Die Antwort nennt nur Hash und Metadaten von Commits mit derselben `patch-id`, nie Patch-Text oder Pfade.

use crate::git::arbeitsrepo::{self, Arbeitsrepofehler, Vergleich, Vielart};
use crate::modell::{Rohdatei, Zform, abschnitte_z, roh_lesen};
use std::collections::BTreeSet;
use std::time::Instant;

/// Höchstzahl der Commits im Fenster (ADR-0038 T2; nach der Sondierung B1112 bleibt es bei 1.000).
pub const FENSTER_HOECHSTENS: usize = 1_000;
/// Das Fenster beginnt einen Tag vor dem Autordatum des verwaisten Commits (ADR-0038 Punkt 2.2).
pub const FENSTER_VORLAUF_S: i64 = 86_400;
/// Bytegrenze des Vorfilters (`--raw -z`, wie `GRENZE_NAMEN`, ADR-0038 Punkt 2.3).
pub const GRENZE_VORFILTER: usize = 4 << 20;

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
}
