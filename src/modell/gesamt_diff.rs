//! Der Gesamt-Diff einer Karte (R00208, ADR-0032 N6): Spanne, Einteilung je Datei in netto oder Folge, Zerlegung der
//! Ausgabe vieler Commits, Folge-Einträge mit Summen und der Text für `format=patch` — rein, **ohne Git**: hier wird nur
//! gelesen, eingeteilt und zusammengesetzt, was der Startort geliefert hat.

use super::commit_diff::{Diffdatei, Hinweis, roh_lesen};
use serde::Serialize;
use std::collections::{BTreeSet, HashMap, HashSet};
use std::ops::Range;

/// Bytegrenze des Namenslaufs (Startwert, Hypothese, ADR-0032 N6.8; etwa 40.000 Einträge).
pub const GRENZE_NAMEN: usize = 4_194_304;
/// Mehr fremde Commits in der Spanne → ganz als Folge (ADR-0032 Punkt 7.5).
pub const FREMD_HOECHSTENS: usize = 1_000;
/// Längste Pfadangabe `D_karte` in Byte (ADR-0032 N6.4, N5.5 S1); darüber ganz als Folge.
pub const GRENZE_PFADANGABE: usize = 1_048_576;
/// Der leere Baum je Objektformat (SHA-1, SHA-256): Basis, wenn der älteste Kartencommit keinen Elternteil hat.
pub const LEERER_BAUM: [&str; 2] = ["4b825dc642cb6eb9a060e54bf8d69288fbee4904", "6ef19b41225c5369f1c104d45d8d85efa9b057b53b14b4b9b939dd74decc5321"];

/// Der leere Baum im Objektformat eines Commits (an der Länge des Hashes erkannt).
pub fn leerer_baum(commit: &str) -> &'static str {
    if commit.len() == 64 { LEERER_BAUM[1] } else { LEERER_BAUM[0] }
}

/// Warum die ganze Anwendung als Folge erscheint (ADR-0032 N6.4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum Grund {
    NichtLinear,
    FremdZuViele,
    FremdZuGross,
}

impl Grund {
    pub fn text(self) -> &'static str {
        match self {
            Grund::NichtLinear => "nicht_linear",
            Grund::FremdZuViele => "fremd_zu_viele",
            Grund::FremdZuGross => "fremd_zu_gross",
        }
    }
}

/// Ein Commit der Erst-Eltern-Linie mit seinem ersten Elternteil (keiner beim Wurzel-Commit).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Linienpunkt {
    pub commit: String,
    pub eltern: Option<String>,
}

/// Die Spanne (ADR-0032 N6.1): Basis (`None` = leerer Baum) und die Commits der Linie vom ältesten Kartencommit bis zum
/// letzten, ältester zuerst.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Spannenlauf {
    pub basis: Option<String>,
    pub linie: Vec<Linienpunkt>,
}

/// Liest `rev-list --first-parent --parents --max-count=<hoechstens> <letzter>` (je Zeile `<commit> <eltern>…`, neuester
/// zuerst), bis alle Commits aus `karte` gesehen sind. Endet die Ausgabe vorher, liegt ein Kartencommit nicht auf der Linie
/// (`NichtLinear`) — außer die Ausgabe hat `hoechstens` Zeilen: dann sind es zu viele fremde (`FremdZuViele`).
pub fn spanne_lesen(aus: &[u8], karte: &HashSet<&str>, hoechstens: usize) -> Result<Spannenlauf, Grund> {
    let mut linie = vec![];
    let mut gesehen = 0;
    for zeile in String::from_utf8_lossy(aus).lines() {
        let mut teile = zeile.split(' ');
        let commit = teile.next().unwrap_or_default().to_string();
        let eltern = teile.next().map(String::from);
        if karte.contains(commit.as_str()) {
            gesehen += 1;
        }
        linie.push(Linienpunkt { commit, eltern });
        if gesehen == karte.len() {
            let basis = linie.last().and_then(|p| p.eltern.clone());
            linie.reverse();
            return Ok(Spannenlauf { basis, linie });
        }
    }
    Err(if linie.len() >= hoechstens { Grund::FremdZuViele } else { Grund::NichtLinear })
}

/// Ein Abschnitt einer Ausgabe mit vielen Köpfen: der Kopf (Stelle in der Eingabe) und die Bytes danach bis zum nächsten.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Abschnitt {
    pub kopf: usize,
    pub bereich: Range<usize>,
}

/// Die Form einer Ausgabe von `diff-tree --stdin … -z`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Zform {
    /// `--raw -z`: Eintrag `:<…> <status>\0<pfad>\0` (bei `R`/`C` zwei Pfade)
    Roh,
    /// `--numstat -z`: Eintrag `<plus>\t<minus>\t<pfad>\0` oder `<plus>\t<minus>\t\0<alt>\0<neu>\0`
    Zahlen,
}

/// Zerlegt eine `-z`-Ausgabe von `diff-tree --stdin` nach den Köpfen (ADR-0032 N6.2): ein Kopf steht **nur dort, wo ein
/// Eintrag erwartet wird**, und muss ein späterer der Eingabe `koepfe` sein — ein Pfad, der wie ein Hash aussieht, wird
/// nie Kopf. Ein angefangenes letztes Feld (abgeschnittener Lauf) bleibt im letzten Abschnitt. `None`, wenn ein Feld an
/// der Stelle eines Kopfs keiner ist.
pub fn abschnitte_z(aus: &[u8], koepfe: &[&str], form: Zform) -> Option<Vec<Abschnitt>> {
    let mut abschnitte: Vec<Abschnitt> = vec![];
    let mut naechster = 0;
    let mut pos = 0;
    while let Some(laenge) = aus[pos..].iter().position(|b| *b == 0) {
        let feld = &aus[pos..pos + laenge];
        let eintrag = match form {
            Zform::Roh => feld.first() == Some(&b':'),
            Zform::Zahlen => feld.contains(&b'\t'),
        };
        if !eintrag {
            let k = (naechster..koepfe.len()).find(|&k| koepfe[k].as_bytes() == feld)?;
            if let Some(a) = abschnitte.last_mut() {
                a.bereich.end = pos;
            }
            abschnitte.push(Abschnitt { kopf: k, bereich: pos + laenge + 1..aus.len() });
            naechster = k + 1;
            pos += laenge + 1;
            continue;
        }
        abschnitte.last()?;
        let pfade = match form {
            Zform::Roh => 1 + usize::from(roh_mit_zwei_pfaden(feld)),
            Zform::Zahlen => if zahlen_ohne_pfad(feld) { 2 } else { 0 },
        };
        pos += laenge + 1;
        for _ in 0..pfade {
            match aus[pos..].iter().position(|b| *b == 0) {
                Some(n) => pos += n + 1,
                None => return Some(abschnitte),
            }
        }
    }
    Some(abschnitte)
}

/// Ist ein Zähler-Eintrag `<plus>\t<minus>\t` mit leerem Pfad (eine Umbenennung, die Pfade folgen als eigene Felder)?
/// Nach Feldern, nicht nach dem letzten Zeichen: ein Name darf auf einen Tabulator enden.
fn zahlen_ohne_pfad(feld: &[u8]) -> bool {
    feld.splitn(3, |b| *b == b'\t').nth(2).is_some_and(<[u8]>::is_empty)
}

/// Hat ein Roh-Eintrag zwei Pfade (Status `R` oder `C` mit Zahl)?
fn roh_mit_zwei_pfaden(kopf: &[u8]) -> bool {
    let status = kopf.rsplit(|b| *b == b' ').next().unwrap_or_default();
    matches!(status.first(), Some(b'R' | b'C'))
}

/// Zerlegt eine Ausgabe von `diff-tree --stdin -p` nach den Köpfen: eine Zeile, die genau ein späterer Kopf der Eingabe
/// ist, steht nur dort, wo ein Stück `diff --git` beginnen kann — Inhaltszeilen tragen ` `, `+`, `-` oder `\` vorn,
/// Kopfzeilen von Git ein Schlüsselwort.
pub fn abschnitte_patch(aus: &[u8], koepfe: &[&str]) -> Vec<Abschnitt> {
    let mut abschnitte: Vec<Abschnitt> = vec![];
    let mut naechster = 0;
    let mut pos = 0;
    while pos < aus.len() {
        let ende = aus[pos..].iter().position(|b| *b == b'\n').map(|n| pos + n);
        if let Some(ende) = ende {
            let zeile = &aus[pos..ende];
            if let Some(k) = (naechster..koepfe.len()).find(|&k| koepfe[k].as_bytes() == zeile) {
                if let Some(a) = abschnitte.last_mut() {
                    a.bereich.end = pos;
                }
                abschnitte.push(Abschnitt { kopf: k, bereich: ende + 1..aus.len() });
                naechster = k + 1;
            }
        }
        pos = ende.map_or(aus.len(), |e| e + 1);
    }
    abschnitte
}

/// Die Pfade eines Eintrags: einer, bei einer Umbenennung zwei (`alt`, `neu`).
pub type Eintragspfade = Vec<Vec<u8>>;

/// Die Einträge je Commit aus dem Namenslauf (`--raw -z -M50% -l1000`: Umbenennungen wie im Diff des Commits, mit
/// beiden Pfaden), zerlegt nach den Köpfen. `None`, wenn die Ausgabe nicht die Form hat.
pub fn namen_lesen(aus: &[u8], koepfe: &[&str]) -> Option<HashMap<String, Vec<Eintragspfade>>> {
    let mut je_commit = HashMap::new();
    for a in abschnitte_z(aus, koepfe, Zform::Roh)? {
        let eintraege: Vec<Eintragspfade> = roh_lesen(&aus[a.bereich])?.into_iter().map(|r| r.pfade).collect();
        je_commit.insert(koepfe[a.kopf].to_string(), eintraege);
    }
    Some(je_commit)
}

/// Die Einteilung der Spanne (ADR-0032 N6.3): Pfade der Kartencommits und der übrigen Commits der Spanne, dazu die
/// **Gruppen** der Kartenpfade — Pfade, die ein Kartenschritt durch eine Umbenennung verbindet, gehören zusammen
/// (Code-Review B1, #214): eine Gruppe ist ganz netto oder ganz Folge. Berührt ein fremder Commit einen Pfad der Gruppe,
/// ist sie **belastet**: kein Pfad von ihr erscheint netto, denn der Netto-Diff zeigte die fremden Zeilen, die die
/// Umbenennung mitgenommen hat, als Arbeit der Karte.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Einteilung {
    pub karte: BTreeSet<Vec<u8>>,
    pub fremd: HashSet<Vec<u8>>,
    gruppe: HashMap<Vec<u8>, usize>,
    belastet: HashSet<usize>,
}

impl Einteilung {
    /// Aus den Einträgen je Commit: `karte` sind die einbezogenen Kartencommits, alle anderen Commits zählen zu `fremd`;
    /// die Umbenennungen der Kartencommits verbinden ihre Pfade zu Gruppen.
    pub fn aus(je_commit: &HashMap<String, Vec<Eintragspfade>>, karte: &HashSet<&str>) -> Einteilung {
        let mut e = Einteilung::default();
        let mut paare: Vec<(&[u8], &[u8])> = vec![];
        for (commit, eintraege) in je_commit {
            if !karte.contains(commit.as_str()) {
                e.fremd.extend(eintraege.iter().flatten().cloned());
            } else {
                e.karte.extend(eintraege.iter().flatten().cloned());
                paare.extend(eintraege.iter().filter_map(|p| match p.as_slice() {
                    [alt, neu] => Some((alt.as_slice(), neu.as_slice())),
                    _ => None,
                }));
            }
        }
        let stelle: HashMap<&[u8], usize> = e.karte.iter().enumerate().map(|(i, p)| (p.as_slice(), i)).collect();
        let mut oben: Vec<usize> = (0..stelle.len()).collect();
        fn wurzel(oben: &mut [usize], mut i: usize) -> usize {
            while oben[i] != i {
                oben[i] = oben[oben[i]];
                i = oben[i];
            }
            i
        }
        for (alt, neu) in paare {
            let (a, n) = (wurzel(&mut oben, stelle[alt]), wurzel(&mut oben, stelle[neu]));
            oben[a] = n;
        }
        for (p, i) in &stelle {
            let g = wurzel(&mut oben, *i);
            if e.fremd.contains(*p) {
                e.belastet.insert(g);
            }
            e.gruppe.insert(p.to_vec(), g);
        }
        e
    }

    /// Liegt der Pfad in `D_fremd` oder in einer belasteten Gruppe?
    fn belastet(&self, p: &[u8]) -> bool {
        self.fremd.contains(p) || self.gruppe.get(p).is_some_and(|g| self.belastet.contains(g))
    }

    /// Netto genau dann, wenn alle Pfade des Eintrags in `D_karte` und keiner in `D_fremd` oder in einer belasteten
    /// Gruppe liegt.
    pub fn netto(&self, d: &Diffdatei) -> bool {
        d.pfade_roh.iter().all(|p| self.karte.contains(p) && !self.belastet(p))
    }

    /// Die Folge-Pfade: alle Kartenpfade, die kein Netto-Eintrag trägt (`gedeckt`) — außer ihre Gruppe ist unbelastet und
    /// ein Netto-Eintrag trägt einen anderen Pfad von ihr (ein Zwischenname: K1 benennt `a` nach `m`, K2 `m` nach `z`;
    /// netto steht `a → z`, `m` erscheint nirgends).
    pub fn folgepfade(&self, gedeckt: &HashSet<&[u8]>) -> HashSet<Vec<u8>> {
        let gedeckte: HashSet<usize> = gedeckt.iter().filter_map(|p| self.gruppe.get(*p)).copied().collect();
        let zwischenname = |p: &[u8]| self.gruppe.get(p).is_some_and(|g| gedeckte.contains(g) && !self.belastet.contains(g));
        self.karte.iter().filter(|p| !gedeckt.contains(p.as_slice()) && !zwischenname(p)).cloned().collect()
    }

    /// Liegt jeder Pfad des Eintrags in `D_karte`? Sonst trifft ihn nur eine Pfadangabe `foo` als `foo/…` (N6.3).
    pub fn aus_der_karte(&self, d: &Diffdatei) -> bool {
        d.pfade_roh.iter().all(|p| self.karte.contains(p))
    }

    /// Die Pfadangabe `D_karte` und ihre Länge in Byte.
    pub fn pfadangabe_zu_lang(&self) -> bool {
        self.karte.iter().map(Vec::len).sum::<usize>() > GRENZE_PFADANGABE
    }
}

/// Schließt eine Pfadangabe gegen die Einträge eines Bezugslaufs ab (Code-Review B2, #214): jeder Eintrag, dessen Pfad
/// die Angabe trifft — genau oder als `foo/…`, denn eine Pfadangabe `foo` trifft in Git alles darunter, auch mit
/// `--literal-pathspecs` —, kommt mit allen seinen Pfaden hinein, bis nichts mehr dazukommt. Ein Lauf mit der Angabe sieht
/// dann nur ganze Einträge des Bezugslaufs, und Git paart die Umbenennungen wie dort; die Zuordnung läuft über alle
/// getroffenen Einträge und verwirft danach die Stücke der mitgenommenen (`patches_zuordnen_im_bezug`, B2-Rest). Sortiert.
pub fn abschliessen(pfade: impl IntoIterator<Item = Vec<u8>>, eintraege: &[&[Vec<u8>]]) -> Vec<Vec<u8>> {
    let mut index: Vec<(&[u8], usize)> = eintraege.iter().enumerate().flat_map(|(i, e)| e.iter().map(move |p| (p.as_slice(), i))).collect();
    index.sort();
    let mut genommen = vec![false; eintraege.len()];
    let mut drin: HashSet<Vec<u8>> = HashSet::new();
    let mut offen: Vec<Vec<u8>> = vec![];
    for p in pfade {
        if drin.insert(p.clone()) {
            offen.push(p);
        }
    }
    while let Some(s) = offen.pop() {
        let ab = index.partition_point(|(p, _)| *p < s.as_slice());
        for &(p, i) in index[ab..].iter().take_while(|(p, _)| p.starts_with(&s)) {
            let trifft = p.len() == s.len() || p[s.len()] == b'/';
            if trifft && !std::mem::replace(&mut genommen[i], true) {
                for q in eintraege[i] {
                    if drin.insert(q.clone()) {
                        offen.push(q.clone());
                    }
                }
            }
        }
    }
    let mut v: Vec<Vec<u8>> = drin.into_iter().collect();
    v.sort();
    v
}

/// Ein Schritt einer Folge-Datei: der Verweis wörtlich wie in der Datei der Karte und die Datei des Commits.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Schritt {
    pub commit: String,
    #[serde(flatten)]
    pub datei: Diffdatei,
}

/// Eine Datei als Folge der Kartenschritte (ADR-0032 N6.6): `plus`/`minus` ist die Summe der Schritte, `binaer` wahr,
/// wenn ein Schritt binär ist — eine Netto-Zahl gibt es nicht.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Folgedatei {
    pub pfad: String,
    pub plus: u64,
    pub minus: u64,
    pub binaer: bool,
    pub schritte: Vec<Schritt>,
}

/// Ein Eintrag von `dateien` im Gesamt-Diff: netto wie eine Datei des Diffs je Commit, oder als Folge.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
#[serde(untagged)]
pub enum Gesamtdatei {
    Netto(Diffdatei),
    Folge(Folgedatei),
}

impl Gesamtdatei {
    /// Der Name für die Ordnung und `datei=`: netto `neu` (bei gelöschten `alt`), als Folge `pfad`.
    pub fn name(&self) -> &str {
        match self {
            Gesamtdatei::Netto(d) => d.name(),
            Gesamtdatei::Folge(f) => &f.pfad,
        }
    }

    /// Die Bytes des Namens, wie Git sie schrieb — für die Ordnung in Bytefolge.
    pub fn name_roh(&self) -> Vec<u8> {
        let roh = |d: &Diffdatei| d.pfade_roh.last().cloned().unwrap_or_default();
        match self {
            Gesamtdatei::Netto(d) => roh(d),
            Gesamtdatei::Folge(f) => f.schritte.first().map(|s| roh(&s.datei)).unwrap_or_default(),
        }
    }
}

/// Die Schritte (Verweis, Datei) in der Reihenfolge der Schritte, gruppiert nach dem Namen des Schritts (`neu`, bei
/// gelöschten `alt`; eine Umbenennung steht beim neuen Pfad), je Gruppe die Summen.
pub fn folge_bilden(schritte: Vec<(String, Diffdatei)>) -> Vec<Folgedatei> {
    let mut folgen: Vec<Folgedatei> = vec![];
    let mut stelle: HashMap<Vec<u8>, usize> = HashMap::new();
    for (commit, datei) in schritte {
        let schluessel = datei.pfade_roh.last().cloned().unwrap_or_default();
        let i = *stelle.entry(schluessel).or_insert_with(|| {
            folgen.push(Folgedatei { pfad: datei.name().to_string(), plus: 0, minus: 0, binaer: false, schritte: vec![] });
            folgen.len() - 1
        });
        let f = &mut folgen[i];
        f.plus += datei.plus;
        f.minus += datei.minus;
        f.binaer |= datei.binaer;
        f.schritte.push(Schritt { commit, datei });
    }
    folgen
}

/// Ordnet die Einträge nach dem Namen in Bytefolge.
pub fn ordnen(dateien: &mut [Gesamtdatei]) {
    dateien.sort_by_key(Gesamtdatei::name_roh);
}

/// Die Spanne der Antwort: volle Hashes, `basis` null beim leeren Baum.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Spanne {
    pub basis: Option<String>,
    pub letzter: String,
}

/// Eine Zeile `# kanbanD: <art> …` je Hinweis für `format=patch` (ADR-0032 N6.9): die Felder als `name=wert`, Texte
/// zitiert wie Namen in Kopfzeilen — so beginnt keine Zeile mit fremdem Text.
pub fn hinweiszeile(h: &Hinweis) -> String {
    let wert = serde_json::to_value(h).unwrap_or_default();
    let art = wert["art"].as_str().unwrap_or_default().to_string();
    let mut zeile = format!("# kanbanD: {art}");
    if let Some(felder) = wert.as_object() {
        for (name, w) in felder.iter().filter(|(n, _)| *n != "art") {
            let text = match w {
                serde_json::Value::String(s) => super::commit_diff::zitiert(s),
                anders => anders.to_string(),
            };
            zeile.push_str(&format!(" {name}={text}"));
        }
    }
    zeile.push('\n');
    zeile
}

#[cfg(test)]
mod tests {
    use super::*;

    const A: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const B: &str = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const C: &str = "cccccccccccccccccccccccccccccccccccccccc";
    const D: &str = "dddddddddddddddddddddddddddddddddddddddd";

    fn menge<'a>(k: &[&'a str]) -> HashSet<&'a str> {
        k.iter().copied().collect()
    }

    // ADR-0032 N6.1: Basis ist der erste Elternteil des ältesten Kartencommits; die Linie läuft vom ältesten zum letzten,
    // fremde Commits dazwischen stehen mit
    #[test]
    fn spanne_basis_und_linie() {
        let aus = format!("{D} {C}\n{C} {B} {A}\n{B} {A}\n{A}\n");
        let s = spanne_lesen(aus.as_bytes(), &menge(&[D, B]), 1003).unwrap();
        assert_eq!(s.basis.as_deref(), Some(A));
        assert_eq!(s.linie.iter().map(|p| p.commit.as_str()).collect::<Vec<_>>(), [B, C, D]);
        assert_eq!(s.linie[1].eltern.as_deref(), Some(B), "beim Merge der erste Elternteil");
        let wurzel = spanne_lesen(aus.as_bytes(), &menge(&[D, A]), 1003).unwrap();
        assert_eq!(wurzel.basis, None, "Wurzel-Commit: leerer Baum");
    }

    // ADR-0032 N6.1, N6.4: endet die Ausgabe, bevor alle gesehen sind → nicht linear; bei voller Höchstzahl → zu viele
    #[test]
    fn spanne_nicht_linear_oder_zu_viele() {
        let aus = format!("{D} {C}\n{C} {B}\n{B}\n");
        assert_eq!(spanne_lesen(aus.as_bytes(), &menge(&[D, A]), 10), Err(Grund::NichtLinear));
        assert_eq!(spanne_lesen(aus.as_bytes(), &menge(&[D, A]), 3), Err(Grund::FremdZuViele));
        assert!(spanne_lesen(aus.as_bytes(), &menge(&[D, B]), 3).is_ok(), "genau an der Höchstzahl gefunden");
    }

    fn roh_eintrag(status: &str, pfade: &[&[u8]]) -> Vec<u8> {
        let mut e = format!(":100644 100644 {A} {B} {status}").into_bytes();
        e.push(0);
        for p in pfade {
            e.extend_from_slice(p);
            e.push(0);
        }
        e
    }

    // ADR-0032 N6.2: die Zerlegung ist strukturell — ein Pfad, der wie ein späterer Kopf aussieht, wird nie Kopf;
    // Umbenennung mit zwei Pfaden; Köpfe ohne Ausgabe fehlen
    #[test]
    fn abschnitte_roh_strukturell() {
        let mut aus = format!("{A}\0").into_bytes();
        aus.extend(roh_eintrag("M", &[C.as_bytes()]));
        aus.extend(roh_eintrag("R090", &[b"x", D.as_bytes()]));
        aus.extend(format!("{D}\0").into_bytes());
        aus.extend(roh_eintrag("A", &[b"k.txt"]));
        let a = abschnitte_z(&aus, &[A, B, C, D], Zform::Roh).unwrap();
        assert_eq!(a.iter().map(|a| a.kopf).collect::<Vec<_>>(), [0, 3]);
        assert_eq!(roh_lesen(&aus[a[0].bereich.clone()]).unwrap().len(), 2);
        assert_eq!(roh_lesen(&aus[a[1].bereich.clone()]).unwrap()[0].pfade, [b"k.txt".to_vec()]);
        // ein Feld an der Stelle eines Kopfs, das keiner ist (oder ein früherer)
        assert!(abschnitte_z(format!("{A}\0{A}\0").as_bytes(), &[A, B], Zform::Roh).is_none());
        assert!(abschnitte_z(b"x\0", &[A], Zform::Roh).is_none());
    }

    // ADR-0032 N6.2: `--numstat -z` mit Umbenennung (leerer Pfad, dann zwei Pfade, einer wie ein Kopf)
    #[test]
    fn abschnitte_zahlen() {
        let aus = format!("{A}\x001\t1\ta.txt\x00{B}\x001\t0\t\x00a.txt\x00{C}\x00{C}\x00-\t-\tb.bin\x00");
        let a = abschnitte_z(aus.as_bytes(), &[A, B, C], Zform::Zahlen).unwrap();
        assert_eq!(a.iter().map(|a| a.kopf).collect::<Vec<_>>(), [0, 1, 2]);
        let z = crate::modell::zahlen_mit_pfaden(&aus.as_bytes()[a[1].bereich.clone()]).unwrap();
        assert_eq!(z, [(Some((1, 0)), vec![b"a.txt".to_vec(), C.as_bytes().to_vec()])]);
    }

    // Code-Review B5 (#214): ein Name, der auf einen Tabulator endet, ist keine Umbenennung — auch binär (`-\t-\t`)
    #[test]
    fn abschnitte_zahlen_name_mit_tab_am_ende() {
        let aus = format!("{A}\x001\t1\tx\t\x00-\t-\tb\t\x00{B}\x000\t0\t\x00r\t\x00s\t\x00");
        let a = abschnitte_z(aus.as_bytes(), &[A, B], Zform::Zahlen).unwrap();
        assert_eq!(a.iter().map(|a| a.kopf).collect::<Vec<_>>(), [0, 1]);
        let z = crate::modell::zahlen_mit_pfaden(&aus.as_bytes()[a[0].bereich.clone()]).unwrap();
        assert_eq!(z, [(Some((1, 1)), vec![b"x\t".to_vec()]), (None, vec![b"b\t".to_vec()])]);
        let z = crate::modell::zahlen_mit_pfaden(&aus.as_bytes()[a[1].bereich.clone()]).unwrap();
        assert_eq!(z, [(Some((0, 0)), vec![b"r\t".to_vec(), b"s\t".to_vec()])]);
    }

    // ADR-0032 N6.2: im Patch ist ein Kopf eine eigene Zeile; eine Inhaltszeile mit Hash dahinter ist keiner
    #[test]
    fn abschnitte_im_patch() {
        let aus = format!("{A}\ndiff --git a/x b/x\n@@ -1 +1 @@\n-{B}\n+{C}\n{C}\ndiff --git a/y b/y\n");
        let a = abschnitte_patch(aus.as_bytes(), &[A, B, C]);
        assert_eq!(a.iter().map(|a| a.kopf).collect::<Vec<_>>(), [0, 2]);
        assert!(aus[a[0].bereich.clone()].ends_with(format!("+{C}\n").as_str()));
        assert_eq!(&aus[a[1].bereich.clone()], "diff --git a/y b/y\n");
    }

    fn datei(name: &str, plus: u64, binaer: bool) -> Diffdatei {
        let r = crate::modell::Rohdatei { modus_alt: "100644".into(), modus_neu: "100644".into(), hash_alt: A.into(), hash_neu: B.into(), status: 'M', zahl: None, pfade: vec![name.as_bytes().to_vec()] };
        crate::modell::diffdatei(r, if binaer { None } else { Some((plus, 1)) })
    }

    // ADR-0032 N6.6: Folge-Einträge gruppiert nach dem Namen, Summe der Schritte, binär, wenn ein Schritt binär ist
    #[test]
    fn folge_mit_summen() {
        let f = folge_bilden(vec![("kd:1".into(), datei("a.txt", 2, false)), ("kd:1".into(), datei("b.bin", 0, true)), ("kd:2".into(), datei("a.txt", 3, false))]);
        assert_eq!(f.iter().map(|f| (f.pfad.as_str(), f.plus, f.minus, f.binaer, f.schritte.len())).collect::<Vec<_>>(), [("a.txt", 5, 2, false, 2), ("b.bin", 0, 0, true, 1)]);
        assert_eq!(f[0].schritte.iter().map(|s| s.commit.as_str()).collect::<Vec<_>>(), ["kd:1", "kd:2"]);
        let json = serde_json::to_value(Gesamtdatei::Folge(f[0].clone())).unwrap();
        assert_eq!((json["pfad"].as_str(), json["schritte"][0]["commit"].as_str(), json["schritte"][0]["status"].as_str()), (Some("a.txt"), Some("kd:1"), Some("M")));
        assert!(json.get("status").is_none(), "keine Netto-Felder am Folge-Eintrag");
    }

    // ADR-0032 N6.3: netto genau dann, wenn alle Pfade in D_karte und keiner in D_fremd
    #[test]
    fn einteilung_netto_oder_folge() {
        let je: HashMap<String, Vec<Eintragspfade>> = [(A.to_string(), vec![vec![b"a".to_vec()], vec![b"k".to_vec()]]), (B.to_string(), vec![vec![b"a".to_vec()], vec![b"f".to_vec()]]), (C.to_string(), vec![vec![b"a".to_vec()], vec![b"b".to_vec()]])].into();
        let e = Einteilung::aus(&je, &menge(&[A, C]));
        assert!(e.netto(&datei("k", 1, false)) && e.netto(&datei("b", 1, false)));
        assert!(!e.netto(&datei("a", 1, false)), "von B berührt");
        assert!(!e.netto(&datei("f", 1, false)) && !e.aus_der_karte(&datei("f", 1, false)), "nur fremd");
    }

    fn pfade(p: &[&str]) -> Eintragspfade {
        p.iter().map(|x| x.as_bytes().to_vec()).collect()
    }

    // Code-Review B1 (#214): eine Umbenennung im Kartenschritt verbindet ihre Pfade; berührt ein fremder Commit einen
    // davon, ist keiner netto (auch über eine Kette); eine unbelastete Gruppe mit Netto-Eintrag hat keinen Zwischennamen
    // in der Folge
    #[test]
    fn gruppen_aus_umbenennungen() {
        // A: f → c (F legte f an), B (fremd): f; C: x → m, D: m → z, unbelastet; E: u → v, v → w über eine Kette, F2 berührt u
        let je: HashMap<String, Vec<Eintragspfade>> = [
            (A.to_string(), vec![pfade(&["f", "c"]), pfade(&["k"])]),
            (B.to_string(), vec![pfade(&["f"]), pfade(&["u"])]),
            (C.to_string(), vec![pfade(&["x", "m"]), pfade(&["u", "v"])]),
            (D.to_string(), vec![pfade(&["m", "z"]), pfade(&["v", "w"])]),
        ].into();
        let e = Einteilung::aus(&je, &menge(&[A, C, D]));
        let rohdatei = |status: char, p: &[&str]| crate::modell::diffdatei(crate::modell::Rohdatei { modus_alt: "100644".into(), modus_neu: "100644".into(), hash_alt: A.into(), hash_neu: B.into(), status, zahl: None, pfade: pfade(p) }, Some((1, 1)));
        assert!(!e.netto(&rohdatei('A', &["c"])), "c hängt an f, das F berührt");
        assert!(!e.netto(&rohdatei('A', &["w"])), "w hängt über v an u");
        assert!(e.netto(&rohdatei('R', &["x", "z"])) && e.netto(&rohdatei('A', &["k"])));
        let gedeckt: HashSet<&[u8]> = [b"x".as_slice(), b"z", b"k"].into();
        let mut folge: Vec<Vec<u8>> = e.folgepfade(&gedeckt).into_iter().collect();
        folge.sort();
        assert_eq!(folge, pfade(&["c", "f", "u", "v", "w"]), "m ist ein Zwischenname der gedeckten Gruppe x → m → z");
    }

    // Code-Review B2 (#214): die Pfadangabe nimmt jeden Eintrag ganz, dessen Pfad sie trifft — `d/x` trifft `d/x/inner`,
    // dessen Partner `b` kommt mit; `d/xy` und `d/x2` trifft sie nicht
    #[test]
    fn pfadangabe_abschliessen() {
        let eintraege = [pfade(&["d/x", "b/inner"]), pfade(&["b", "d/x/inner"]), pfade(&["d/xy"]), pfade(&["d/x2"]), pfade(&["c"])];
        let bezug: Vec<&[Vec<u8>]> = eintraege.iter().map(Vec::as_slice).collect();
        assert_eq!(abschliessen([b"d/x".to_vec()], &bezug), pfade(&["b", "b/inner", "d/x", "d/x/inner"]));
        assert_eq!(abschliessen([b"c".to_vec()], &bezug), pfade(&["c"]));
        assert_eq!(abschliessen([b"b/inner".to_vec()], &bezug), pfade(&["b", "b/inner", "d/x", "d/x/inner"]), "über den Partner und dessen Verzeichnis");
    }
}
