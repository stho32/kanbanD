//! Der Diff eines Commits (R00206, ADR-0032 Punkt 6 Form F2, N4): Dateiliste aus `diff-tree --raw -z` und
//! `--numstat -z`, Patch-Text je Datei, Grenzen und Hinweise — rein, **ohne Git**: hier wird nur zerlegt, verbunden und
//! begrenzt, was der Startort gelesen hat.

use serde::Serialize;

/// Höchstzahl der Dateien in `dateien` (Startwert, Hypothese; Entscheidung des product-owner 2026-11-19).
pub const KAPPE_DATEIEN: usize = 2_000;
/// Bytegrenze je Lauf der Dateiliste (`--raw -z`, `--numstat -z`; Startwert, Hypothese, ADR-0032 N4.3).
pub const GRENZE_DATEILISTE: usize = 1_048_576;
/// Patch-Text einer Datei ab `@@`, roh gezählt: darüber `gross` (256 KB binär, ADR-0032 Punkt 8, N4.3).
pub const GRENZE_PATCH_DATEI: usize = 262_144;
/// Zeilen einer Datei (`plus + minus`): darüber `gross`, entschieden vor dem Patch-Lauf.
pub const GRENZE_ZEILEN: u64 = 3_000;
/// Ausgabe des Patch-Laufs der Liste mit Kopfzeilen (4 MB binär); danach `nachladen`.
pub const GRENZE_PATCH_LAUF: usize = 4_194_304;
/// Längster Pfad einer Datei, der in einen Patch-Lauf kommt (Byte, wie `PATH_MAX`); darüber `gross` (ADR-0032 N5.5 S1).
pub const PFAD_HOECHSTENS: usize = 4096;
/// Ausgabe des Patch-Laufs einer einzeln geladenen Datei (8 MB binär, ADR-0032 N5.1 Regel 6): die größte Antwort
/// (JSON höchstens etwa das Sechsfache) passt so ins Antwortbudget von 64 MB.
pub const GRENZE_EINZELN: usize = 8_388_608;
/// Dateiliste (`--raw -z`) für `datei=` (20 MB binär) — nur Zwischenstand im Bau, vor dem Patch-Lauf frei (N5.1 Regel 6).
pub const GRENZE_DATEILISTE_EINZELN: usize = 20_971_520;
/// Version der Grenzen im `ETag`: ändert sich eine Grenze, ändert sich jede Antwort.
pub const GRENZEN_VERSION: u32 = 1;

/// Eine Datei des Diffs (Form F2). Felder mit `?` fehlen, wenn sie nicht passen (nie `null`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Diffdatei {
    /// Pfad vorher; fehlt bei `A`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alt: Option<String>,
    /// Pfad nachher; fehlt bei `D`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub neu: Option<String>,
    /// `A`, `M`, `D`, `R` oder `T`
    pub status: String,
    /// nur bei `R`: die Ähnlichkeit in Prozent, die Git nennt
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aehnlichkeit: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modus_alt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modus_neu: Option<String>,
    pub plus: u64,
    pub minus: u64,
    pub binaer: bool,
    pub gross: bool,
    pub nachladen: bool,
    pub nicht_utf8: bool,
    /// der Patch-Text ab der ersten `@@`-Zeile, wenn die Datei Hunks hat und weder binär noch groß noch nachzuladen ist
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patch: Option<String>,
    /// die Pfade, wie Git sie schrieb — für die wörtliche Pfadangabe eines weiteren Laufs
    #[serde(skip)]
    pub pfade_roh: Vec<Vec<u8>>,
    /// die ganzen Stücke des Patch-Laufs zu dieser Datei mit den Kopfzeilen von Git — für `format=patch`
    #[serde(skip)]
    pub stuecke: Option<Vec<u8>>,
    /// die Blob-Hashes vorher und nachher aus `--raw` (bei `A` bzw. `D` Nullen) — Schlüssel der Stücke (ADR-0032 N5.2)
    #[serde(skip)]
    pub blobs: (String, String),
}

impl Diffdatei {
    /// Der Name der Datei für Hinweise und `datei=`: `neu`, bei gelöschten `alt`.
    pub fn name(&self) -> &str {
        self.neu.as_deref().or(self.alt.as_deref()).unwrap_or_default()
    }

    /// Über der Zeilengrenze (`plus + minus` > 3.000)? Entschieden aus den Zählern, vor dem Patch-Lauf.
    pub fn zu_viele_zeilen(&self) -> bool {
        self.plus + self.minus > GRENZE_ZEILEN
    }

    /// Ein Pfad über [`PFAD_HOECHSTENS`]? Dann kommt die Datei in keinen Patch-Lauf (ARG_MAX, ADR-0032 N5.5 S1).
    pub fn pfad_zu_lang(&self) -> bool {
        self.pfade_roh.iter().any(|p| p.len() > PFAD_HOECHSTENS)
    }

    /// Wie viele Stücke der Patch-Lauf für diese Datei schreibt: ein Typwechsel erscheint als Löschen und Anlegen.
    fn stueckzahl(&self) -> usize {
        if self.status == "T" { 2 } else { 1 }
    }
}

/// Ein Eintrag von `diff-tree --raw -z`: `:<modus alt> <modus neu> <hash alt> <hash neu> <status>[zahl]\0<pfad>\0`, bei
/// Umbenennung `…\0<alt>\0<neu>\0`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rohdatei {
    pub modus_alt: String,
    pub modus_neu: String,
    pub hash_alt: String,
    pub hash_neu: String,
    pub status: char,
    pub zahl: Option<u32>,
    pub pfade: Vec<Vec<u8>>,
}

/// Die vollständigen Einträge einer `--raw -z`-Ausgabe; ein angefangener Eintrag am Ende (ein abgeschnittener Lauf) fällt
/// weg. `None`, wenn ein vollständiger Eintrag nicht die Form hat.
pub fn roh_lesen(aus: &[u8]) -> Option<Vec<Rohdatei>> {
    let mut felder: Vec<&[u8]> = aus.split(|b| *b == 0).collect();
    // nach dem letzten NUL steht der Rest eines angefangenen Felds (oder nichts)
    felder.pop();
    let mut eintraege = vec![];
    let mut i = 0;
    while i < felder.len() {
        let kopf = std::str::from_utf8(felder[i]).ok()?.strip_prefix(':')?;
        let teile: Vec<&str> = kopf.split(' ').collect();
        let [modus_alt, modus_neu, hash_alt, hash_neu, status] = teile.as_slice() else { return None };
        let mut zeichen = status.chars();
        let art = zeichen.next()?;
        let zahl = zeichen.as_str();
        let zahl = if zahl.is_empty() { None } else { Some(zahl.parse().ok()?) };
        let anzahl = if matches!(art, 'R' | 'C') { 2 } else { 1 };
        if i + anzahl >= felder.len() {
            break;
        }
        let pfade = felder[i + 1..=i + anzahl].iter().map(|p| p.to_vec()).collect();
        eintraege.push(Rohdatei { modus_alt: modus_alt.to_string(), modus_neu: modus_neu.to_string(), hash_alt: hash_alt.to_string(), hash_neu: hash_neu.to_string(), status: art, zahl, pfade });
        i += 1 + anzahl;
    }
    Some(eintraege)
}

/// Zeilen hinzu und weg je Eintrag von `diff-tree --numstat -z` (`<plus>\t<minus>\t<pfad>\0` oder
/// `<plus>\t<minus>\t\0<alt>\0<neu>\0`); `None` bei einer Binärdatei (`-\t-`). Ein angefangener Eintrag fällt weg.
pub fn zahlen_lesen(aus: &[u8]) -> Option<Vec<Option<(u64, u64)>>> {
    Some(zahlen_mit_pfaden(aus)?.into_iter().map(|(z, _)| z).collect())
}

/// Zeilen hinzu und weg (`None` bei binär) eines Eintrags von `--numstat -z` mit seinen Pfaden.
pub type Zaehler = (Option<(u64, u64)>, Vec<Vec<u8>>);

/// Wie [`zahlen_lesen`], je Eintrag mit seinen Pfaden (bei Umbenennung `alt`, `neu`) — zum Verbinden über die Pfade statt
/// über die Position, wenn eine Pfadangabe mehr trifft als die gesuchten Dateien (ADR-0032 N5.2 Regel 6).
pub fn zahlen_mit_pfaden(aus: &[u8]) -> Option<Vec<Zaehler>> {
    let mut felder: Vec<&[u8]> = aus.split(|b| *b == 0).collect();
    felder.pop();
    let mut zahlen = vec![];
    let mut i = 0;
    while i < felder.len() {
        let teile: Vec<&[u8]> = felder[i].splitn(3, |b| *b == b'\t').collect();
        let [plus, minus, pfad] = teile.as_slice() else { return None };
        let anzahl = if pfad.is_empty() { 3 } else { 1 };
        if i + anzahl > felder.len() {
            break;
        }
        let zahl = |b: &[u8]| std::str::from_utf8(b).ok()?.parse::<u64>().ok();
        let werte = match (*plus, *minus) {
            (b"-", b"-") => None,
            _ => Some((zahl(plus)?, zahl(minus)?)),
        };
        let pfade = if anzahl == 1 { vec![pfad.to_vec()] } else { felder[i + 1..i + 3].iter().map(|p| p.to_vec()).collect() };
        zahlen.push((werte, pfade));
        i += anzahl;
    }
    Some(zahlen)
}

/// Die Dateiliste aus beiden Läufen, verbunden nach Position; höchstens [`KAPPE_DATEIEN`] und nur Einträge, die in beiden
/// Läufen vollständig sind. `None`, wenn eine Ausgabe nicht die Form hat oder zwei vollständige Läufe verschieden lang sind.
pub fn dateiliste(roh: &[u8], roh_abgeschnitten: bool, zahlen: &[u8], zahlen_abgeschnitten: bool) -> Option<Vec<Diffdatei>> {
    let roh = roh_lesen(roh)?;
    let zahlen = zahlen_lesen(zahlen)?;
    if !roh_abgeschnitten && !zahlen_abgeschnitten && roh.len() != zahlen.len() {
        return None;
    }
    Some(roh.into_iter().zip(zahlen).take(KAPPE_DATEIEN).map(|(r, z)| datei(r, z)).collect())
}

/// Eine Datei aus ihrem Roheintrag und ihren Zählern, noch ohne Patch.
pub fn datei(r: Rohdatei, zahlen: Option<(u64, u64)>) -> Diffdatei {
    let text = |p: &Vec<u8>| String::from_utf8_lossy(p).into_owned();
    let nicht_utf8 = r.pfade.iter().any(|p| std::str::from_utf8(p).is_err());
    let (alt, neu) = match (r.status, r.pfade.as_slice()) {
        ('A', [p]) => (None, Some(text(p))),
        ('D', [p]) => (Some(text(p)), None),
        (_, [a, n]) => (Some(text(a)), Some(text(n))),
        (_, [p]) => (Some(text(p)), Some(text(p))),
        _ => (None, None),
    };
    let (modus_alt, modus_neu) = modi(r.status, &r.modus_alt, &r.modus_neu);
    let (plus, minus) = zahlen.unwrap_or((0, 0));
    Diffdatei {
        alt,
        neu,
        status: r.status.to_string(),
        aehnlichkeit: if r.status == 'R' { r.zahl } else { None },
        modus_alt,
        modus_neu,
        plus,
        minus,
        binaer: zahlen.is_none(),
        gross: false,
        nachladen: false,
        nicht_utf8,
        patch: None,
        pfade_roh: r.pfade,
        stuecke: None,
        blobs: (r.hash_alt, r.hash_neu),
    }
}

/// Der gewöhnliche Modus einer Datei; neue und gelöschte Dateien nennen ihren Modus nur, wenn er davon abweicht.
const GEWOEHNLICH: &str = "100644";

/// Die Modi, die die Antwort nennt (R00206 FA 5): bei `A` nur `modus_neu`, bei `D` nur `modus_alt` (je nur, wenn er nicht
/// der gewöhnliche ist), bei `M`, `R`, `T` beide und nur, wenn sie verschieden sind.
fn modi(status: char, alt: &str, neu: &str) -> (Option<String>, Option<String>) {
    match status {
        'A' => (None, (neu != GEWOEHNLICH).then(|| neu.to_string())),
        'D' => ((alt != GEWOEHNLICH).then(|| alt.to_string()), None),
        _ if alt != neu => (Some(alt.to_string()), Some(neu.to_string())),
        _ => (None, None),
    }
}

/// Die Stücke einer Ausgabe von `diff-tree -p`, je beginnend mit einer Zeile `diff --git ` (sonst beginnt im Patch keine
/// Zeile so: Inhaltszeilen tragen ` `, `+`, `-` oder `\` vorn, Namen mit Zeilenumbruch zitiert Git). Zugeordnet wird
/// über die Blob-Hashes der Zeile `index`, nie über die Namen der Kopfzeile `diff --git` (ADR-0032 Punkt 6, N5.2).
pub fn stuecke(aus: &[u8]) -> Vec<&[u8]> {
    const KOPF: &[u8] = b"diff --git ";
    let mut anfaenge: Vec<usize> = vec![];
    let mut zeile = 0;
    while zeile < aus.len() {
        if aus[zeile..].starts_with(KOPF) {
            anfaenge.push(zeile);
        }
        zeile = match aus[zeile..].iter().position(|b| *b == b'\n') {
            Some(n) => zeile + n + 1,
            None => aus.len(),
        };
    }
    anfaenge.iter().enumerate().map(|(i, &a)| &aus[a..anfaenge.get(i + 1).copied().unwrap_or(aus.len())]).collect()
}

/// Der Patch-Text eines Stücks: ab der ersten Zeile, die mit `@@` beginnt, bis zum Ende; ohne Hunks leer.
pub fn hunks(stueck: &[u8]) -> &[u8] {
    if stueck.starts_with(b"@@") {
        return stueck;
    }
    match stueck.windows(3).position(|w| w == b"\n@@") {
        Some(i) => &stueck[i + 1..],
        None => &[],
    }
}

/// Passt die Art des Stücks zur Datei? `new file mode` nur beim Anlegen, `deleted file mode` nur beim Löschen,
/// `rename from` nur bei einer Umbenennung — eine verschobene Zuordnung fällt so auf, statt still falsche Patches zu
/// zeigen.
fn passt(d: &Diffdatei, teil: usize, stueck: &[u8]) -> bool {
    let kopf = &stueck[..stueck.len() - hunks(stueck).len()];
    let hat = |was: &[u8]| kopf.windows(was.len()).any(|w| w == was);
    let (neu, weg, umbenannt) = (hat(b"\nnew file mode "), hat(b"\ndeleted file mode "), hat(b"\nrename from "));
    match (d.status.as_str(), teil) {
        ("A", _) => neu && !weg,
        ("D", _) => weg && !neu,
        ("R", _) => umbenannt,
        ("T", 0) => weg,
        ("T", _) => neu,
        _ => !neu && !weg && !umbenannt,
    }
}

/// Welche Fassung des Patches eine Datei behält (ADR-0032 N5.1 Regel 7): für JSON nur `patch` (ab `@@`), für
/// `format=patch` nur die ganzen `stuecke` mit den Kopfzeilen von Git — nie beide, jede wäre eine Kopie.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Fassung {
    Patch,
    Stuecke,
}

/// Wie die Patches des Laufs verteilt werden: in der Liste mit der Grenze je Datei und `nachladen` nach einem Abbruch,
/// einzeln geladen ohne Grenze je Datei und `gross` nach einem Abbruch.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Verteilung {
    Liste,
    Einzeln,
}

/// Ordnet die Stücke eines Patch-Laufs den Dateien `im_lauf` (Stellen in `dateien`, in der Reihenfolge der Liste) zu —
/// über die Blob-Hashes, nie über die Position (ADR-0032 N5.2): jede Datei nimmt in Reihenfolge das nächste unbenutzte
/// Stück mit ihrem Schlüssel ([`gehoert`]); ein Stück, das zu keiner Datei des Laufs gehört (eine Pfadangabe `foo` trifft
/// auch `foo/…`), ist fremd und wird verworfen. Ein abgeschnittener Lauf ist unvollständig (N4.4 Regel 5): sein letztes
/// Stück gilt nie als ganz; die erste Datei, deren Stücke nicht alle vor dem Schnitt stehen, und alle folgenden bekommen
/// keinen Patch — in der Liste `nachladen` (die getroffene dazu `gross`, wenn schon mehr als 256 KB ihres Patch-Texts
/// gelesen waren), einzeln geladen `gross`. `Err`, wenn im ganzen Lauf einer Datei ein Stück fehlt oder vor dem Schnitt
/// ein Stück übrig bleibt, das zu einer Datei des Laufs gehört (die Zählprüfung, auch im abgeschnittenen Lauf).
pub fn patches_zuordnen(dateien: &mut [Diffdatei], im_lauf: &[usize], aus: &[u8], abgeschnitten: bool, verteilung: Verteilung, fassung: Fassung) -> Result<(), String> {
    let alle = stuecke(aus);
    let ganze = if abgeschnitten { alle.len().saturating_sub(1) } else { alle.len() };
    let mut benutzt = vec![false; ganze];
    let mut ab = 0;
    for (stelle, &i) in im_lauf.iter().enumerate() {
        let d = &dateien[i];
        let mut eigene = vec![];
        for teil in 0..d.stueckzahl() {
            let Some(k) = (ab..ganze).find(|&k| !benutzt[k] && gehoert(d, teil, alle[k])) else { break };
            benutzt[k] = true;
            eigene.push(k);
            ab = k + 1;
        }
        if eigene.len() < d.stueckzahl() {
            if !abgeschnitten {
                return Err(format!("Patch-Lauf: „{}“ ({}) hat {} von {} Stücken", d.name(), d.status, eigene.len(), d.stueckzahl()));
            }
            // getroffen: was von ihr da ist, zählt nur für die Grenze
            let angefangen = alle.get(ganze).filter(|s| gehoert(d, eigene.len(), s));
            let gelesen: usize = eigene.iter().map(|&k| hunks(alle[k]).len()).sum::<usize>() + angefangen.map_or(0, |s| hunks(s).len());
            for &rest in &im_lauf[stelle..] {
                abbrechen(&mut dateien[rest], verteilung);
            }
            if verteilung == Verteilung::Liste && gelesen > GRENZE_PATCH_DATEI {
                dateien[i].gross = true;
            }
            break;
        }
        let d = &mut dateien[i];
        let laenge: usize = eigene.iter().map(|&k| hunks(alle[k]).len()).sum();
        if !d.binaer && verteilung == Verteilung::Liste && laenge > GRENZE_PATCH_DATEI {
            d.gross = true;
            continue;
        }
        if fassung == Fassung::Stuecke {
            d.stuecke = Some(zusammen(eigene.iter().map(|&k| alle[k])));
        }
        if d.binaer || laenge == 0 {
            continue;
        }
        // Stücke enden an Zeilenenden: der Text ist gültiges UTF-8, wenn jedes Stück es ist
        d.nicht_utf8 |= eigene.iter().any(|&k| std::str::from_utf8(hunks(alle[k])).is_err());
        if fassung == Fassung::Patch {
            d.patch = Some(text(zusammen(eigene.iter().map(|&k| hunks(alle[k])))));
        }
    }
    let gehoert_einer = |k: usize| im_lauf.iter().any(|&i| (0..dateien[i].stueckzahl()).any(|t| gehoert(&dateien[i], t, alle[k])));
    if let Some(k) = (0..ganze).find(|&k| !benutzt[k] && gehoert_einer(k)) {
        return Err(format!("Patch-Lauf: Stück {k} gehört zu einer Datei des Laufs, steht aber nicht an ihrer Stelle"));
    }
    Ok(())
}

/// Die Stellen der Einträge, die eine gegen sie abgeschlossene Pfadangabe (`abschliessen`) trifft. Git wählt auch `…/`
/// (ADR-0032 N5.2), doch die abgeschlossene Angabe enthält jeden Pfad jedes so getroffenen Eintrags — der genaue
/// Vergleich genügt.
pub fn getroffen(angabe: &[Vec<u8>], eintraege: &[&[Vec<u8>]]) -> Vec<usize> {
    let angabe: std::collections::HashSet<&[u8]> = angabe.iter().map(Vec::as_slice).collect();
    (0..eintraege.len()).filter(|&i| eintraege[i].iter().any(|p| angabe.contains(p.as_slice()))).collect()
}

/// Ordnet die Stücke eines Laufs mit der Pfadangabe `angabe` zu, die gegen `bezug` abgeschlossen ist (Code-Review
/// B2-Rest, #214): der Lauf zeigt jeden Eintrag des Bezugslaufs, den die Angabe trifft ([`getroffen`]), in dessen
/// Reihenfolge — auch die mitgenommenen, die keinen Patch bekommen. Die Zuordnung ([`patches_zuordnen`]) läuft über alle
/// diese Einträge; so nimmt kein Zwilling (gleicher Blob, gleiche Art) das Stück eines anderen, und die Zählprüfung bleibt
/// streng. Danach bekommen nur die Dateien `im_lauf` ihr Ergebnis; die Stücke der mitgenommenen sind verworfen.
#[allow(clippy::too_many_arguments)]
pub fn patches_zuordnen_im_bezug(dateien: &mut [Diffdatei], im_lauf: &[usize], bezug: &[Diffdatei], angabe: &[Vec<u8>], aus: &[u8], abgeschnitten: bool, verteilung: Verteilung, fassung: Fassung) -> Result<(), String> {
    let pfade: Vec<&[Vec<u8>]> = bezug.iter().map(|d| d.pfade_roh.as_slice()).collect();
    let mut lauf: Vec<Diffdatei> = getroffen(angabe, &pfade).into_iter().map(|j| bezug[j].clone()).collect();
    let stelle: std::collections::HashMap<(&[Vec<u8>], &str), usize> = lauf.iter().enumerate().map(|(j, d)| ((d.pfade_roh.as_slice(), d.status.as_str()), j)).collect();
    let mut paare = vec![];
    for &i in im_lauf {
        let d = &dateien[i];
        let Some(&j) = stelle.get(&(d.pfade_roh.as_slice(), d.status.as_str())) else {
            return Err(format!("Patch-Lauf: „{}“ ({}) steht nicht im Bezugslauf", d.name(), d.status));
        };
        paare.push((i, j));
    }
    drop(stelle);
    for &(i, j) in &paare {
        std::mem::swap(&mut dateien[i], &mut lauf[j]);
    }
    let alle: Vec<usize> = (0..lauf.len()).collect();
    let ergebnis = patches_zuordnen(&mut lauf, &alle, aus, abgeschnitten, verteilung, fassung);
    for &(i, j) in &paare {
        std::mem::swap(&mut dateien[i], &mut lauf[j]);
    }
    ergebnis
}

/// Verbindet die Zähler eines Laufs, dessen Pfadangabe gegen den Bezug abgeschlossen ist (`abschliessen`), mit den
/// getroffenen Einträgen dieses Bezugs (`getroffen`, in seiner Reihenfolge; ADR-0032 N7.7): Git zeigt genau diese
/// Einträge mit genau diesen Pfaden. `Err`, wenn die Ausgabe davon abweicht — dann hat Git anders gepaart als der Bezug.
pub fn zahlen_im_bezug(getroffene: &mut [Diffdatei], zahlen: Vec<Zaehler>) -> Result<(), String> {
    if zahlen.len() != getroffene.len() {
        return Err(format!("Zähler: {} Einträge, der Bezug trifft {}", zahlen.len(), getroffene.len()));
    }
    for (d, (z, pfade)) in getroffene.iter_mut().zip(zahlen) {
        if pfade != d.pfade_roh {
            return Err(format!("Zähler passen nicht zur Datei „{}“", d.name()));
        }
        (d.plus, d.minus, d.binaer) = (z.map_or(0, |z| z.0), z.map_or(0, |z| z.1), z.is_none());
    }
    Ok(())
}

/// Die Teile hintereinander in einem Puffer genau ihrer Größe.
fn zusammen<'a>(teile: impl Iterator<Item = &'a [u8]> + Clone) -> Vec<u8> {
    let mut puffer = Vec::with_capacity(teile.clone().map(<[u8]>::len).sum());
    for t in teile {
        puffer.extend_from_slice(t);
    }
    puffer
}

/// Bytes als Text: gültiges UTF-8 ohne Kopie, sonst ersatzweise dekodiert.
fn text(bytes: Vec<u8>) -> String {
    String::from_utf8(bytes).unwrap_or_else(|f| String::from_utf8_lossy(f.as_bytes()).into_owned())
}

/// Gehört das Stück als Teil `teil` zur Datei (ADR-0032 N5.2 Regel 2)? Mit Zeile `index <alt>..<neu>` (`--full-index`)
/// muss das Paar **gleich** den Blob-Hashes aus `--raw` sein — beim Typwechsel erst `alt..0…`, dann `0…..neu`; ohne
/// `index`-Zeile (gleicher Inhalt: reine Umbenennung oder nur der Modus) entscheiden `rename from/to` gegen die Pfade bzw.
/// `old mode/new mode` gegen die Modi. Dazu muss die Art des Stücks zur Datei passen ([`passt`]).
fn gehoert(d: &Diffdatei, teil: usize, stueck: &[u8]) -> bool {
    let kopf = &stueck[..stueck.len() - hunks(stueck).len()];
    let (alt, neu) = (d.blobs.0.as_str(), d.blobs.1.as_str());
    let leer = "0".repeat(alt.len().max(neu.len()));
    let (von, nach) = match (d.status.as_str(), teil) {
        ("T", 0) => (alt, leer.as_str()),
        ("T", _) => (leer.as_str(), neu),
        _ => (alt, neu),
    };
    let schluessel = match zeile(kopf, b"index ") {
        Some(wert) => wert.split(|b| *b == b' ').next() == Some(&[von.as_bytes(), b"..", nach.as_bytes()].concat()[..]),
        None if alt != neu || d.status == "T" => false,
        None => match (zeile(kopf, b"rename from "), zeile(kopf, b"rename to ")) {
            (Some(a), Some(n)) => d.status == "R" && d.pfade_roh == [entquotet(a), entquotet(n)],
            _ => zeile(kopf, b"old mode ").is_some() && zeile(kopf, b"old mode ") == d.modus_alt.as_deref().map(str::as_bytes) && zeile(kopf, b"new mode ") == d.modus_neu.as_deref().map(str::as_bytes),
        },
    };
    schluessel && passt(d, teil, stueck)
}

/// Der Wert der Kopfzeile, die mit `name` beginnt (ohne den Namen, ohne Zeilenumbruch).
fn zeile<'a>(kopf: &'a [u8], name: &[u8]) -> Option<&'a [u8]> {
    kopf.split(|b| *b == b'\n').find_map(|z| z.strip_prefix(name))
}

/// Ein Name, wie Git ihn in `rename from/to` schreibt, zurück in Bytes: in Anführungszeichen C-maskiert (`\"`, `\\`,
/// `\n`, `\t`, Oktal), sonst wörtlich.
fn entquotet(wert: &[u8]) -> Vec<u8> {
    let Some(innen) = wert.strip_prefix(b"\"").and_then(|w| w.strip_suffix(b"\"")) else { return wert.to_vec() };
    let mut aus = vec![];
    let mut i = 0;
    while i < innen.len() {
        let b = innen[i];
        i += 1;
        if b != b'\\' || i >= innen.len() {
            aus.push(b);
            continue;
        }
        let e = innen[i];
        i += 1;
        aus.push(match e {
            b'a' => 7,
            b'b' => 8,
            b't' => b'\t',
            b'n' => b'\n',
            b'v' => 11,
            b'f' => 12,
            b'r' => b'\r',
            b'0'..=b'7' if innen.get(i..i + 2).is_some_and(|z| z.iter().all(|d| (b'0'..=b'7').contains(d))) => {
                let oktal = &innen[i - 1..i + 2];
                i += 2;
                oktal.iter().fold(0u8, |z, d| z.wrapping_mul(8).wrapping_add(d - b'0'))
            }
            anders => anders,
        });
    }
    aus
}

/// Die Dateien des Patch-Laufs der Liste (ADR-0032 N4.3, N5.5 S1): über der Zeilengrenze oder mit einem Pfad über
/// [`PFAD_HOECHSTENS`] → `gross`, nie im Lauf. Kommen alle gezeigten Dateien in den Lauf (und sind es alle des Commits),
/// läuft er ohne Pfadangabe; sonst nennt er die Pfade wörtlich, zusammen höchstens [`GRENZE_DATEILISTE`] Byte — die
/// Dateien, mit denen die Summe darüber käme, und alle folgenden sind `nachladen`. Liefert die Stellen im Lauf und ob
/// eine Pfadangabe nötig ist.
pub fn lauf_der_liste(dateien: &mut [Diffdatei], gesamt: u64) -> (Vec<usize>, bool) {
    for d in dateien.iter_mut().filter(|d| d.zu_viele_zeilen() || d.pfad_zu_lang()) {
        d.gross = true;
    }
    let im_lauf: Vec<usize> = (0..dateien.len()).filter(|i| !dateien[*i].gross).collect();
    if im_lauf.len() as u64 == gesamt {
        return (im_lauf, false);
    }
    let mut summe = 0;
    let mut lauf = vec![];
    for i in im_lauf {
        summe += dateien[i].pfade_roh.iter().map(Vec::len).sum::<usize>();
        if summe > GRENZE_DATEILISTE {
            dateien[i].nachladen = true;
        } else {
            lauf.push(i);
        }
    }
    (lauf, true)
}

/// Eine Datei, die der Abbruch des Patch-Laufs trifft oder die danach käme.
fn abbrechen(d: &mut Diffdatei, verteilung: Verteilung) {
    d.patch = None;
    d.stuecke = None;
    match verteilung {
        Verteilung::Liste => d.nachladen = true,
        Verteilung::Einzeln => d.gross = true,
    }
}

/// Die Antwort als Text (`format=patch`, R00206 FA 9): je Datei die Stücke von Git mit ihren Kopfzeilen; fehlt der
/// Patch (`gross`, `nachladen`), eine Kopfzeile wie die von Git und eine Zeile `# kanbanD: Patch fehlt (…)`. Nicht UTF-8
/// ersatzweise; zum Lesen, nicht für `git apply`. Die Stücke werden dabei genommen (jedes ist nach dem Übertragen frei).
pub fn patch_text(dateien: &mut [Diffdatei]) -> String {
    let mut text = String::with_capacity(dateien.iter().map(|d| d.stuecke.as_ref().map_or(256, Vec::len)).sum());
    for d in dateien {
        match d.stuecke.take() {
            Some(s) if !d.gross && !d.nachladen => text.push_str(&self::text(s)),
            _ => {
                let (alt, neu) = (d.alt.as_deref().unwrap_or(d.name()), d.neu.as_deref().unwrap_or(d.name()));
                text.push_str(&format!("diff --git {} {}\n", zitiert(&format!("a/{alt}")), zitiert(&format!("b/{neu}"))));
                text.push_str(&match (d.gross, d.nachladen) {
                    (true, _) => "# kanbanD: Patch fehlt (gross)\n".to_string(),
                    _ => format!("# kanbanD: Patch fehlt (nachladen), laden mit &datei={}\n", zitiert(d.name())),
                });
            }
        }
    }
    text
}

/// Ein Name, wie Git ihn in Kopfzeilen schreibt (`core.quotepath=off`): mit Anführungszeichen, `"`, `\` und
/// Steuerzeichen maskiert, sobald eines davon vorkommt — so beginnt keine Zeile des Texts mit einem fremden Namen.
pub(crate) fn zitiert(name: &str) -> String {
    if !name.chars().any(|c| c == '"' || c == '\\' || c.is_control()) {
        return name.to_string();
    }
    let mut z = String::from("\"");
    for c in name.chars() {
        match c {
            '"' => z.push_str("\\\""),
            '\\' => z.push_str("\\\\"),
            '\n' => z.push_str("\\n"),
            '\t' => z.push_str("\\t"),
            c if c.is_control() => {
                let mut puffer = [0u8; 4];
                for b in c.encode_utf8(&mut puffer).bytes() {
                    z.push_str(&format!("\\{b:03o}"));
                }
            }
            c => z.push(c),
        }
    }
    z.push('"');
    z
}

/// Ein Hinweis der Antwort (ADR-0032 N4.5): Objekte mit `art`; ein Leser überspringt eine unbekannte Art.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
#[serde(tag = "art", rename_all = "snake_case")]
pub enum Hinweis {
    /// Gesamt-Diff (R00208): die ganze Anwendung erscheint als Folge, nie netto
    GanzAlsFolge { grund: super::gesamt_diff::Grund },
    /// Gesamt-Diff: so viele fremde Commits in der Spanne, so viele Folge-Dateien
    FremdDazwischen { commits: usize, dateien: usize },
    /// Gesamt-Diff: die übrigen Anwendungen mit Verweisen an der Karte
    WeitereAnwendungen { anwendungen: Vec<String> },
    /// Gesamt-Diff: der Verweis ist auf keinem Zweig und nicht einbezogen
    Verwaist { verweis: String },
    /// Gesamt-Diff: ein Merge an der Karte, einzeln über `?commit=` lesbar
    MergeAusgelassen { verweis: String },
    /// Gesamt-Diff: der Verweis ist nicht lesbar (`fehlt`, `unlesbar`, `anwendung_unbekannt`)
    Ausgelassen { verweis: String, zustand: super::Commitzustand },
    /// die Liste zeigt `gezeigt` von `gesamt` Dateien
    DateienGekappt { gezeigt: usize, gesamt: u64 },
    /// die einzeln geladene Datei ist über der Grenze für einzeln geladene Dateien
    ZuGrossZumAnzeigen { datei: String },
}

#[cfg(test)]
mod tests {
    use super::*;

    const H: &str = "0000000000000000000000000000000000000000";

    fn roh(eintraege: &[(&str, &[&[u8]])]) -> Vec<u8> {
        let mut aus = vec![];
        for (kopf, pfade) in eintraege {
            aus.extend_from_slice(format!(":{kopf}").replace("H", H).as_bytes());
            aus.push(0);
            for p in *pfade {
                aus.extend_from_slice(p);
                aus.push(0);
            }
        }
        aus
    }

    // R00206 AK 1, 5: Status, Modi, Umbenennung mit Ähnlichkeit — gemessene Form von `diff-tree --raw -z`
    #[test]
    fn rohe_eintraege_lesen() {
        let aus = roh(&[("100644 100644 H H M", &[b"a.txt"]), ("000000 100644 H H A", &[b"bild.bin"]), ("100644 100644 H H R100", &[b"c.txt", b"c2.txt"]), ("100644 120000 H H T", &[b"t.txt"])]);
        let e = roh_lesen(&aus).unwrap();
        assert_eq!(e.iter().map(|e| (e.status, e.zahl, e.pfade.len())).collect::<Vec<_>>(), [('M', None, 1), ('A', None, 1), ('R', Some(100), 2), ('T', None, 1)]);
        assert_eq!(e[2].pfade, [b"c.txt".to_vec(), b"c2.txt".to_vec()]);
    }

    // ADR-0032 N4.3, R00206 FA 6: ein angefangener Eintrag am Ende eines abgeschnittenen Laufs zählt nie mit — auch nicht
    // eine Umbenennung, deren zweiter Pfad fehlt; ein ganzer Eintrag am Schnitt zählt
    #[test]
    fn angefangene_eintraege_fallen_weg() {
        let ganz = roh(&[("100644 100644 H H M", &[b"a.txt"]), ("100644 100644 H H R090", &[b"alt.txt", b"neu.txt"])]);
        assert_eq!(roh_lesen(&ganz).unwrap().len(), 2);
        // Ende des ersten Eintrags: hinter dem NUL nach `a.txt`
        let erstes = ganz.windows(6).position(|w| w == b"a.txt\0").unwrap() + 6;
        for schnitt in 1..ganz.len() {
            let erwartet = usize::from(schnitt >= erstes);
            assert_eq!(roh_lesen(&ganz[..schnitt]).unwrap().len(), erwartet, "Schnitt bei {schnitt}");
        }
        let zahlen = b"1\t1\ta.txt\x001\t1\t\x00alt.txt\x00neu.txt\x00";
        assert_eq!(zahlen_lesen(zahlen).unwrap(), [Some((1, 1)), Some((1, 1))]);
        for schnitt in [10, 15, 24, 30] {
            assert_eq!(zahlen_lesen(&zahlen[..schnitt]).unwrap().len(), 1, "Schnitt bei {schnitt}");
        }
        assert_eq!(zahlen_lesen(&zahlen[..9]).unwrap().len(), 0);
    }

    // R00206 AK 1, 4, 5: Binärdatei `-\t-` zählt 0/0 und ist binär; Umbenennung in numstat mit leerem Pfadfeld
    #[test]
    fn zahlen_und_binaer() {
        let z = zahlen_lesen(b"3\t1\ta.txt\x00-\t-\tx.bin\x000\t0\t\x00c.txt\x00c2.txt\x00").unwrap();
        assert_eq!(z, [Some((3, 1)), None, Some((0, 0))]);
        let aus = roh(&[("100644 100644 H H M", &[b"a.txt"]), ("100644 100644 H H M", &[b"x.bin"]), ("100644 100644 H H R100", &[b"c.txt", b"c2.txt"])]);
        let d = dateiliste(&aus, false, b"3\t1\ta.txt\x00-\t-\tx.bin\x000\t0\t\x00c.txt\x00c2.txt\x00", false).unwrap();
        assert_eq!(d.iter().map(|d| (d.plus, d.minus, d.binaer)).collect::<Vec<_>>(), [(3, 1, false), (0, 0, true), (0, 0, false)]);
        assert_eq!((d[2].alt.as_deref(), d[2].neu.as_deref(), d[2].aehnlichkeit), (Some("c.txt"), Some("c2.txt"), Some(100)));
    }

    // R00206 FA 5: `alt` fehlt bei A, `neu` bei D; Modi nur, wo sie sich ändern (A und D gegen den gewöhnlichen Modus)
    #[test]
    fn felder_je_status() {
        let d = |kopf: &str, pfade: &[&[u8]]| {
            let r = roh_lesen(&roh(&[(kopf, pfade)])).unwrap().remove(0);
            datei(r, Some((0, 0)))
        };
        let a = d("000000 100644 H H A", &[b"n.txt"]);
        assert_eq!((a.alt, a.neu.as_deref(), a.modus_alt, a.modus_neu), (None, Some("n.txt"), None, None));
        let l = d("000000 120000 H H A", &[b"l"]);
        assert_eq!((l.modus_alt, l.modus_neu.as_deref()), (None, Some("120000")));
        let s = d("000000 160000 H H A", &[b"sub"]);
        assert_eq!(s.modus_neu.as_deref(), Some("160000"));
        let g = d("100644 000000 H H D", &[b"weg.txt"]);
        assert_eq!((g.alt.as_deref(), g.neu, g.modus_alt, g.modus_neu), (Some("weg.txt"), None, None, None));
        let m = d("100644 100755 H H M", &[b"m.sh"]);
        assert_eq!((m.modus_alt.as_deref(), m.modus_neu.as_deref()), (Some("100644"), Some("100755")));
        let t = d("100644 120000 H H T", &[b"t.txt"]);
        assert_eq!((t.status.as_str(), t.modus_alt.as_deref(), t.modus_neu.as_deref()), ("T", Some("100644"), Some("120000")));
        let gleich = d("100644 100644 H H R087", &[b"a", b"b"]);
        assert_eq!((gleich.modus_alt, gleich.modus_neu, gleich.aehnlichkeit), (None, None, Some(87)));
        assert_eq!(d("100644 100644 H H M", &[b"x"]).aehnlichkeit, None);
    }

    // R00206 AK 6, FA 10: Pfade ohne Zitierung, nicht UTF-8 ersatzweise mit `nicht_utf8`
    #[test]
    fn pfade_wie_git_sie_schreibt() {
        let namen: [&[u8]; 4] = [b"n\ndiff --git a/y b/y.txt", "ä ö.txt".as_bytes(), b"a\xe4.txt", b"t\tb\"\\.txt"];
        let aus = roh(&namen.iter().map(|n| ("000000 100644 H H A", std::slice::from_ref(n))).collect::<Vec<_>>());
        let zahlen: Vec<u8> = namen.iter().flat_map(|n| [b"1\t0\t".to_vec(), n.to_vec(), vec![0]].concat()).collect();
        let d = dateiliste(&aus, false, &zahlen, false).unwrap();
        assert_eq!(d.iter().map(|d| d.neu.clone().unwrap()).collect::<Vec<_>>(), ["n\ndiff --git a/y b/y.txt", "ä ö.txt", "a\u{fffd}.txt", "t\tb\"\\.txt"]);
        assert_eq!(d.iter().map(|d| d.nicht_utf8).collect::<Vec<_>>(), [false, false, true, false]);
        assert_eq!(d[2].pfade_roh, [b"a\xe4.txt".to_vec()]);
    }

    // R00206 AK 10, ADR-0032 N4.3: höchstens 2.000 Dateien; nur Einträge, die in beiden Läufen vollständig sind
    #[test]
    fn kappe_und_kuerzerer_lauf() {
        let n = KAPPE_DATEIEN + 1;
        let namen: Vec<String> = (0..n).map(|i| format!("f{i:05}.txt")).collect();
        let aus = roh(&namen.iter().map(|_| ("000000 100644 H H A", &[][..])).collect::<Vec<_>>());
        // die Pfade einsetzen
        let aus: Vec<u8> = aus.split(|b| *b == 0).filter(|f| !f.is_empty()).zip(&namen).flat_map(|(k, p)| [k, &[0], p.as_bytes(), &[0]].concat()).collect();
        let zahlen: Vec<u8> = namen.iter().flat_map(|p| format!("1\t0\t{p}\0").into_bytes()).collect();
        assert_eq!(dateiliste(&aus, false, &zahlen, false).unwrap().len(), KAPPE_DATEIEN);
        let wenige = &zahlen[..zahlen.len() / 2 + 3];
        let d = dateiliste(&aus, false, wenige, true).unwrap();
        assert_eq!(d.len(), zahlen_lesen(wenige).unwrap().len(), "so viele, wie der kürzere Lauf vollständig hat");
        assert!(dateiliste(&aus, false, &zahlen[..zahlen.len() / 2], false).is_none(), "zwei ganze Läufe verschieden lang");
    }

    // ADR-0032 N4.5: `hinweise` als Objekte mit `art`
    #[test]
    fn hinweise_als_objekte() {
        assert_eq!(serde_json::to_value(Hinweis::DateienGekappt { gezeigt: 2000, gesamt: 2001 }).unwrap(), serde_json::json!({"art": "dateien_gekappt", "gezeigt": 2000, "gesamt": 2001}));
        assert_eq!(serde_json::to_value(Hinweis::ZuGrossZumAnzeigen { datei: "r.txt".into() }).unwrap(), serde_json::json!({"art": "zu_gross_zum_anzeigen", "datei": "r.txt"}));
    }

    /// Ein voller Blob-Hash aus einem Text (40 Hex-Zeichen, verschieden je Text).
    fn blob(text: &str) -> String {
        let f = text.bytes().fold(0xcbf2_9ce4_8422_2325u64, |h, b| (h ^ u64::from(b)).wrapping_mul(0x0000_0100_0000_01b3));
        format!("{f:016x}{:016x}{:08x}", f.rotate_left(17), f as u32)
    }

    fn neu(name: &str, status: &str) -> Diffdatei {
        let (modi, hashes) = match status {
            "A" => (("000000", "100644"), (H.to_string(), blob(&format!("{name}+")))),
            "D" => (("100644", "000000"), (blob(&format!("{name}-")), H.to_string())),
            "T" => (("100644", "120000"), (blob(&format!("{name}-")), blob(&format!("{name}+")))),
            _ => (("100644", "100644"), (blob(&format!("{name}-")), blob(&format!("{name}+")))),
        };
        let r = Rohdatei { modus_alt: modi.0.into(), modus_neu: modi.1.into(), hash_alt: hashes.0, hash_neu: hashes.1, status: status.chars().next().unwrap(), zahl: None, pfade: vec![name.as_bytes().to_vec()] };
        datei(r, Some((1, 1)))
    }

    /// Das Stück, das `diff-tree -p --full-index` für Teil `teil` der Datei schreibt, mit diesem Hunk.
    fn stueck(d: &Diffdatei, teil: usize, hunk: &str) -> String {
        let name = d.name();
        let (alt, neu) = (&d.blobs.0, &d.blobs.1);
        let kopf = match (d.status.as_str(), teil) {
            ("A", _) => format!("new file mode 100644\nindex {H}..{neu}\n--- /dev/null\n+++ b/{name}\n"),
            ("D", _) | ("T", 0) => format!("deleted file mode 100644\nindex {alt}..{H}\n--- a/{name}\n+++ /dev/null\n"),
            ("T", _) => format!("new file mode 120000\nindex {H}..{neu}\n--- /dev/null\n+++ b/{name}\n"),
            _ => format!("index {alt}..{neu} 100644\n--- a/{name}\n+++ b/{name}\n"),
        };
        format!("diff --git a/{name} b/{name}\n{kopf}{hunk}")
    }

    // R00206 AK 5: ein Typwechsel bringt zwei Stücke (Löschen, Anlegen); sein Patch ist beider Hunks
    #[test]
    fn typwechsel_aus_zwei_stuecken() {
        let mut d = vec![neu("t.txt", "T"), neu("u.txt", "M")];
        let aus = format!("{}{}{}", stueck(&d[0], 0, "@@ -1 +0,0 @@\n-x\n"), stueck(&d[0], 1, "@@ -0,0 +1 @@\n+ziel\n\\ No newline at end of file\n"), stueck(&d[1], 0, "@@ -1 +1 @@\n-a\n+b\n"));
        patches_zuordnen(&mut d, &[0, 1], aus.as_bytes(), false, Verteilung::Liste, Fassung::Patch).unwrap();
        assert_eq!(d[0].patch.as_deref(), Some("@@ -1 +0,0 @@\n-x\n@@ -0,0 +1 @@\n+ziel\n\\ No newline at end of file\n"));
        assert_eq!(d[1].patch.as_deref(), Some("@@ -1 +1 @@\n-a\n+b\n"));
    }

    // Eine verschobene Zuordnung fällt auf (Stück an falscher Stelle), statt falsche Patches zu zeigen
    #[test]
    fn verschobene_zuordnung_ist_ein_fehler() {
        let mut d = vec![neu("a.txt", "A"), neu("b.txt", "M")];
        let aus = format!("{}{}", stueck(&d[1], 0, "@@ -1 +1 @@\n-a\n+b\n"), stueck(&d[0], 0, "@@ -0,0 +1 @@\n+a\n"));
        assert!(patches_zuordnen(&mut d, &[0, 1], aus.as_bytes(), false, Verteilung::Liste, Fassung::Patch).is_err());
        let mut d = vec![neu("a.txt", "M")];
        assert!(patches_zuordnen(&mut d, &[0], b"", false, Verteilung::Liste, Fassung::Patch).is_err(), "Stück fehlt ohne Abbruch");
    }

    // ADR-0032 N5.2, Code-Review M1: die Pfadangabe `foo` trifft auch `foo/bar` — dessen Stück ist fremd und wird
    // verworfen, `foo2` bekommt sein eigenes Stück (Mutant „fremdes Stück der nächsten Datei geben“)
    #[test]
    fn fremde_stuecke_werden_verworfen() {
        let mut d = vec![neu("foo", "A"), neu("foo2", "D")];
        let fremd = neu("foo/bar", "D");
        let aus = format!("{}{}{}", stueck(&d[0], 0, "@@ -0,0 +1 @@\n+datei\n"), stueck(&fremd, 0, "@@ -1,2 +0,0 @@\n-1\n-2\n"), stueck(&d[1], 0, "@@ -1 +0,0 @@\n-foo2 inhalt\n"));
        for (abgeschnitten, schnitt) in [(false, aus.len()), (true, aus.len() - 3)] {
            let mut e = d.clone();
            patches_zuordnen(&mut e, &[0, 1], &aus.as_bytes()[..schnitt], abgeschnitten, Verteilung::Liste, Fassung::Patch).unwrap();
            assert_eq!(e[0].patch.as_deref(), Some("@@ -0,0 +1 @@\n+datei\n"));
            let erwartet = if abgeschnitten { (None, true) } else { (Some("@@ -1 +0,0 @@\n-foo2 inhalt\n"), false) };
            assert_eq!((e[1].patch.as_deref(), e[1].nachladen), erwartet, "abgeschnitten {abgeschnitten}");
        }
        // einzeln geladen: nur die gesuchte Datei, das fremde Stück davor zählt nicht
        let aus = format!("{}{}", stueck(&fremd, 0, "@@ -1,2 +0,0 @@\n-1\n-2\n"), stueck(&d[0], 0, "@@ -0,0 +1 @@\n+datei\n"));
        let mut e = d.clone();
        patches_zuordnen(&mut e, &[0], aus.as_bytes(), false, Verteilung::Einzeln, Fassung::Patch).unwrap();
        assert_eq!((e[0].patch.as_deref(), e[0].stuecke.is_none()), (Some("@@ -0,0 +1 @@\n+datei\n"), true));
        patches_zuordnen(&mut d, &[0], aus.as_bytes(), false, Verteilung::Einzeln, Fassung::Stuecke).unwrap();
        assert_eq!((d[0].patch.is_none(), d[0].stuecke.as_deref()), (true, Some(&aus.as_bytes()[aus.find("diff --git a/foo b/foo\n").unwrap()..])));
    }

    // Code-Review B2-Rest (#214): die Pfadangabe `d z` trifft über `d` auch `d/x` — gelöscht mit demselben Blob wie `z`
    // (Zwilling) und vor ihm im Lauf. Über alle getroffenen Einträge des Bezugs zugeordnet, bekommt `z` sein eigenes
    // Stück (mit seinem Kopf), das von `d/x` ist verworfen; nur über `im_lauf` nähme `z` das Stück von `d/x` und die
    // Zählprüfung bräche ab. `dz` trifft `d` nicht.
    #[test]
    fn zwilling_ausserhalb_der_dateien_des_laufs() {
        let z = neu("z", "D");
        let mut dx = neu("d/x", "D");
        dx.blobs = z.blobs.clone();
        let bezug = vec![neu("d", "A"), dx.clone(), neu("dz", "M"), z.clone()];
        let pfade: Vec<&[Vec<u8>]> = bezug.iter().map(|d| d.pfade_roh.as_slice()).collect();
        let angabe = crate::modell::abschliessen([b"d".to_vec(), b"z".to_vec()], &pfade);
        assert_eq!(getroffen(&angabe, &pfade), [0, 1, 3]);
        let aus = format!("{}{}{}", stueck(&bezug[0], 0, "@@ -0,0 +1 @@\n+neu\n"), stueck(&dx, 0, "@@ -1 +0,0 @@\n-B\n"), stueck(&z, 0, "@@ -1 +0,0 @@\n-B\n"));
        let mut d = vec![neu("d", "A"), z.clone()];
        assert!(patches_zuordnen(&mut d.clone(), &[0, 1], aus.as_bytes(), false, Verteilung::Liste, Fassung::Stuecke).is_err(), "Gegenprobe: ohne Bezug");
        patches_zuordnen_im_bezug(&mut d, &[0, 1], &bezug, &angabe, aus.as_bytes(), false, Verteilung::Liste, Fassung::Stuecke).unwrap();
        let text = |d: &Diffdatei| String::from_utf8(d.stuecke.clone().unwrap()).unwrap();
        assert_eq!(text(&d[1]), stueck(&z, 0, "@@ -1 +0,0 @@\n-B\n"));
        assert_eq!(text(&d[0]), stueck(&bezug[0], 0, "@@ -0,0 +1 @@\n+neu\n"));
        // abgeschnitten im Stück des Zwillings: z ist nachzuladen, nie mit dem fremden Stück
        let mut e = vec![neu("d", "A"), z.clone()];
        let schnitt = aus.find("diff --git a/z").unwrap() - 3;
        patches_zuordnen_im_bezug(&mut e, &[0, 1], &bezug, &angabe, &aus.as_bytes()[..schnitt], true, Verteilung::Liste, Fassung::Patch).unwrap();
        assert_eq!((e[0].patch.as_deref(), e[1].patch.as_deref(), e[1].nachladen), (Some("@@ -0,0 +1 @@\n+neu\n"), None, true));
        // eine Datei des Laufs, die der Bezug nicht kennt, ist ein Fehler
        let mut f = vec![neu("q", "M")];
        assert!(patches_zuordnen_im_bezug(&mut f, &[0], &bezug, &[b"q".to_vec()], b"", false, Verteilung::Liste, Fassung::Patch).is_err());
    }

    // R00211 AK 5 (m4): die Zähler eines Laufs mit abgeschlossener Angabe gehören genau zu den getroffenen Einträgen des
    // Bezugs — paart Git anders (Typwechsel `d/x` → `d/x/inner` neu gepaart), ist das ein Fehler, auch wenn der gesuchte
    // Eintrag selbst unter den Zählern steht
    #[test]
    fn zaehler_nur_ueber_die_getroffenen_des_bezugs() {
        let p = |n: &[&str]| n.iter().map(|x| x.as_bytes().to_vec()).collect::<Vec<_>>();
        let mut bezug = vec![neu("b", "D"), neu("d/x", "D")];
        zahlen_im_bezug(&mut bezug, vec![(Some((0, 10)), p(&["b"])), (None, p(&["d/x"]))]).unwrap();
        assert_eq!(bezug.iter().map(|d| (d.plus, d.minus, d.binaer)).collect::<Vec<_>>(), [(0, 10, false), (0, 0, true)]);
        // neu gepaart: d/x steht dabei, aber Git zeigt einen Eintrag mehr
        let mut e = vec![neu("d/x", "D")];
        assert!(zahlen_im_bezug(&mut e, vec![(Some((0, 11)), p(&["d/x"])), (Some((0, 0)), p(&["b", "d/x/inner"]))]).is_err());
        // derselbe Eintrag mit anderen Pfaden
        let mut f = vec![neu("d/x", "D")];
        assert!(zahlen_im_bezug(&mut f, vec![(Some((0, 1)), p(&["d/x", "d/x/inner"]))]).is_err());
        // einer fehlt
        let mut g = vec![neu("b", "D"), neu("d/x", "D")];
        assert!(zahlen_im_bezug(&mut g, vec![(Some((0, 11)), p(&["d/x"]))]).is_err());
    }

    // ADR-0032 N5.2 Regel 1: die Hashes werden auf Gleichheit verglichen — ein gekürzter Hash (Präfix des vollen) ist
    // ein anderes Stück (Mutant „Vergleich auf Präfix statt Gleichheit“)
    #[test]
    fn hashes_auf_gleichheit() {
        let mut d = vec![neu("a.txt", "M")];
        let voll = stueck(&d[0], 0, "@@ -1 +1 @@\n-a\n+b\n");
        let gekuerzt = voll.replace(&format!("index {}..{}", d[0].blobs.0, d[0].blobs.1), &format!("index {}..{}", &d[0].blobs.0[..7], &d[0].blobs.1[..7]));
        assert_ne!(gekuerzt, voll);
        assert!(patches_zuordnen(&mut d, &[0], gekuerzt.as_bytes(), false, Verteilung::Liste, Fassung::Patch).is_err(), "gekürzter Hash passt nicht");
        let laenger = voll.replace(&format!("..{} ", d[0].blobs.1), &format!("..{}0 ", d[0].blobs.1));
        assert!(patches_zuordnen(&mut d, &[0], laenger.as_bytes(), false, Verteilung::Liste, Fassung::Patch).is_err(), "längerer Hash passt nicht");
        patches_zuordnen(&mut d, &[0], voll.as_bytes(), false, Verteilung::Liste, Fassung::Patch).unwrap();
        assert!(d[0].patch.is_some());
    }

    // ADR-0032 N5.2 Regel 4: auch im abgeschnittenen Lauf wird bis zum Schnitt gezählt — ein ganzes Stück einer Datei
    // des Laufs, das nicht an ihrer Stelle steht, ist ein Fehler (Mutant „Stückzahl im abgeschnittenen Lauf ungeprüft“)
    #[test]
    fn stueckzahl_bis_zum_schnitt() {
        let d = vec![neu("a", "A"), neu("b", "A"), neu("c", "A")];
        let teile: Vec<String> = [1, 0, 2].iter().map(|&i| stueck(&d[i], 0, "@@ -0,0 +1 @@\n+x\n")).collect();
        let aus = teile.concat();
        for (abgeschnitten, schnitt) in [(false, aus.len()), (true, aus.len() - 3)] {
            let mut e = d.clone();
            let f = patches_zuordnen(&mut e, &[0, 1, 2], &aus.as_bytes()[..schnitt], abgeschnitten, Verteilung::Liste, Fassung::Patch);
            assert!(f.is_err(), "abgeschnitten {abgeschnitten}: {:?}", e.iter().map(|d| (d.patch.is_some(), d.nachladen)).collect::<Vec<_>>());
        }
        // richtig geordnet und abgeschnitten: ganz, ganz, nachladen
        let aus = [0, 1, 2].iter().map(|&i| stueck(&d[i], 0, "@@ -0,0 +1 @@\n+x\n")).collect::<String>();
        let mut e = d.clone();
        patches_zuordnen(&mut e, &[0, 1, 2], &aus.as_bytes()[..aus.len() - 3], true, Verteilung::Liste, Fassung::Patch).unwrap();
        assert_eq!(e.iter().map(|d| (d.patch.is_some(), d.nachladen)).collect::<Vec<_>>(), [(true, false), (true, false), (false, true)]);
    }

    // ADR-0032 N5.2 Regel 2: ohne `index`-Zeile (Inhalt gleich) entscheiden `rename from/to` (C-entquotet) bzw. die Modi
    #[test]
    fn stuecke_ohne_index_zeile() {
        let gleich = blob("gleich");
        let r = |alt: &[u8], neu: &[u8]| datei(Rohdatei { modus_alt: "100644".into(), modus_neu: "100644".into(), hash_alt: gleich.clone(), hash_neu: gleich.clone(), status: 'R', zahl: Some(100), pfade: vec![alt.to_vec(), neu.to_vec()] }, Some((0, 0)));
        let m = datei(Rohdatei { modus_alt: "100644".into(), modus_neu: "100755".into(), hash_alt: gleich.clone(), hash_neu: gleich.clone(), status: 'M', zahl: None, pfade: vec![b"m.sh".to_vec()] }, Some((0, 0)));
        let mut d = vec![r(b"a\"b\n.txt", b"\xe4 neu"), m];
        let aus = "diff --git \"a/a\\\"b\\n.txt\" \"b/\\344 neu\"\nsimilarity index 100%\nrename from \"a\\\"b\\n.txt\"\nrename to \"\\344 neu\"\ndiff --git a/m.sh b/m.sh\nold mode 100644\nnew mode 100755\n";
        patches_zuordnen(&mut d, &[0, 1], aus.as_bytes(), false, Verteilung::Liste, Fassung::Stuecke).unwrap();
        assert!(d.iter().all(|d| d.stuecke.is_some() && d.patch.is_none()));
        let mut falsch = vec![r(b"a\"b\n.txt", b"anders")];
        assert!(patches_zuordnen(&mut falsch, &[0], aus.split("diff --git a/m.sh").next().unwrap().as_bytes(), false, Verteilung::Liste, Fassung::Patch).is_err(), "anderer Name, anderes Stück");
        assert_eq!(entquotet(b"\"t\\tb\\\\\\001\""), b"t\tb\\\x01");
        assert_eq!(entquotet(b"ohne"), b"ohne");
    }

    fn einzeilig(d: &Diffdatei, n: usize) -> String {
        stueck(d, 0, &format!("@@ -0,0 +1 @@\n+{}\n", "a".repeat(n)))
    }

    // R00206 AK 7: Patch-Text 262.144 Byte ab `@@` (14 + 1 + 262.128 + 1) ist nicht groß, ein Byte mehr schon — roh
    // gezählt; nur in der Liste
    #[test]
    fn grenze_je_datei() {
        for (n, gross) in [(262_128, false), (262_129, true)] {
            let mut d = vec![neu("g.txt", "A")];
            let aus = einzeilig(&d[0], n);
            assert_eq!(hunks(aus.as_bytes()).len(), n + 16);
            patches_zuordnen(&mut d, &[0], aus.as_bytes(), false, Verteilung::Liste, Fassung::Patch).unwrap();
            assert_eq!((d[0].gross, d[0].patch.is_some()), (gross, !gross), "{n}");
            let mut d = vec![neu("g.txt", "A")];
            patches_zuordnen(&mut d, &[0], aus.as_bytes(), false, Verteilung::Einzeln, Fassung::Patch).unwrap();
            assert_eq!((d[0].gross, d[0].patch.is_some()), (false, true), "einzeln {n}");
        }
    }

    // R00206 FA 6, ADR-0032 N4.4 Regel 5: der Abbruch trifft eine Datei — sie und alle folgenden `nachladen`, die
    // getroffene dazu `gross`, wenn mehr als 256 KB von ihr gelesen waren; ein ganzes letztes Stück gilt nie als ganz
    #[test]
    fn abbruch_in_der_liste_und_einzeln() {
        let vier: Vec<Diffdatei> = (0..4).map(|i| neu(&format!("f{i}"), "A")).collect();
        let teile: Vec<String> = vier.iter().map(|d| einzeilig(d, 10)).collect();
        let aus = teile.concat();
        let schnitt = teile[0].len() + teile[1].len() + 15;
        let mut d = vier.clone();
        patches_zuordnen(&mut d, &[0, 1, 2, 3], &aus.as_bytes()[..schnitt], true, Verteilung::Liste, Fassung::Patch).unwrap();
        assert_eq!(d.iter().map(|d| (d.patch.is_some(), d.nachladen, d.gross)).collect::<Vec<_>>(), [(true, false, false), (true, false, false), (false, true, false), (false, true, false)]);
        let genau = teile[0].len() + teile[1].len();
        let mut d = vier.clone();
        patches_zuordnen(&mut d, &[0, 1, 2, 3], &aus.as_bytes()[..genau], true, Verteilung::Liste, Fassung::Patch).unwrap();
        assert_eq!(d.iter().map(|d| d.nachladen).collect::<Vec<_>>(), [false, true, true, true], "am Schnitt: das letzte Stück gilt nicht als ganz");
        let zwei = vec![neu("r", "A"), neu("s", "A")];
        let riesig = einzeilig(&zwei[0], 300_000);
        let mut d = zwei.clone();
        patches_zuordnen(&mut d, &[0, 1], &riesig.as_bytes()[..280_000], true, Verteilung::Liste, Fassung::Patch).unwrap();
        assert_eq!(d.iter().map(|d| (d.gross, d.nachladen)).collect::<Vec<_>>(), [(true, true), (false, true)]);
        let mut d = zwei.clone();
        patches_zuordnen(&mut d, &[0, 1], &riesig.as_bytes()[..200_000], true, Verteilung::Liste, Fassung::Patch).unwrap();
        assert_eq!(d.iter().map(|d| (d.gross, d.nachladen)).collect::<Vec<_>>(), [(false, true), (false, true)], "unter 256 KB gelesen: nur nachladen");
        let mut d = vec![zwei[0].clone()];
        patches_zuordnen(&mut d, &[0], &riesig.as_bytes()[..280_000], true, Verteilung::Einzeln, Fassung::Patch).unwrap();
        assert_eq!((d[0].gross, d[0].nachladen, d[0].patch.is_some()), (true, false, false));
        // das angefangene Stück einer fremden Datei macht die getroffene nicht groß
        let mut d = vec![zwei[1].clone()];
        patches_zuordnen(&mut d, &[0], &riesig.as_bytes()[..280_000], true, Verteilung::Liste, Fassung::Patch).unwrap();
        assert_eq!((d[0].gross, d[0].nachladen), (false, true));
    }

    // R00206 AK 5: binär, ohne Hunks (Modus) und nicht UTF-8 im Inhalt; `\r` bleibt
    #[test]
    fn binaer_ohne_hunks_und_nicht_utf8() {
        let mut d = vec![neu("b.bin", "A"), neu("m.sh", "M"), neu("l.txt", "M")];
        d[0].binaer = true;
        d[1].blobs.1 = d[1].blobs.0.clone();
        (d[1].modus_alt, d[1].modus_neu) = (Some("100644".into()), Some("100755".into()));
        let mut aus = format!("diff --git a/b.bin b/b.bin\nnew file mode 100644\nindex {H}..{}\nBinary files /dev/null and b/b.bin differ\ndiff --git a/m.sh b/m.sh\nold mode 100644\nnew mode 100755\n", d[0].blobs.1).into_bytes();
        aus.extend_from_slice(format!("diff --git a/l.txt b/l.txt\nindex {}..{} 100644\n--- a/l.txt\n+++ b/l.txt\n", d[2].blobs.0, d[2].blobs.1).as_bytes());
        aus.extend_from_slice(b"@@ -1 +1 @@\n-a\r\n+\xe4\r\n");
        let mut s = d.clone();
        patches_zuordnen(&mut d, &[0, 1, 2], &aus, false, Verteilung::Liste, Fassung::Patch).unwrap();
        assert_eq!((d[0].patch.is_some(), d[1].patch.is_some()), (false, false));
        assert_eq!(d[2].patch.as_deref(), Some("@@ -1 +1 @@\n-a\r\n+\u{fffd}\r\n"));
        assert!(d[2].nicht_utf8 && !d[1].nicht_utf8);
        assert!(d.iter().all(|d| d.stuecke.is_none()), "für JSON nur patch (ADR-0032 N5.1 Regel 7)");
        patches_zuordnen(&mut s, &[0, 1, 2], &aus, false, Verteilung::Liste, Fassung::Stuecke).unwrap();
        assert!(s[0].stuecke.as_ref().is_some_and(|s| s.ends_with(b"differ\n")));
        assert!(s[2].nicht_utf8 && s.iter().all(|d| d.patch.is_none() && d.stuecke.is_some()), "für den Text nur die Stücke");
        assert_eq!(patch_text(&mut s).as_bytes(), String::from_utf8_lossy(&aus).as_bytes());
    }

    // ADR-0032 N5.5 S1: ein Pfad über 4.096 Byte kommt in keinen Lauf (`gross`); die Pfadangabe bleibt bei höchstens
    // 1 MB, die Dateien jenseits davon sind `nachladen`; sind alle Dateien des Commits im Lauf, gibt es keine Pfadangabe
    #[test]
    fn lauf_der_liste_mit_pfadgrenzen() {
        let mut d = vec![neu("kurz", "A"), neu(&"k".repeat(PFAD_HOECHSTENS + 1), "A"), neu(&"g".repeat(PFAD_HOECHSTENS), "A")];
        let (lauf, mit) = lauf_der_liste(&mut d, 3);
        assert_eq!((lauf, mit, d.iter().map(|d| d.gross).collect::<Vec<_>>()), (vec![0, 2], true, vec![false, true, false]));
        let mut d: Vec<Diffdatei> = (0..1100).map(|i| neu(&format!("{i:04}{}", "p".repeat(996)), "A")).collect();
        let (lauf, mit) = lauf_der_liste(&mut d, 1100);
        assert_eq!((lauf.len(), mit), (1100, false), "alle im Lauf: ohne Pfadangabe, ohne Grenze");
        let (lauf, mit) = lauf_der_liste(&mut d, 1101);
        assert_eq!((lauf.len(), mit), (GRENZE_DATEILISTE / 1000, true));
        assert_eq!(lauf.iter().map(|i| d[*i].pfade_roh[0].len()).sum::<usize>(), 1_048_000);
        assert!(d[..1048].iter().all(|d| !d.nachladen) && d[1048..].iter().all(|d| d.nachladen && !d.gross));
    }

    // ADR-0032 N5.2 Regel 6: die Zähler einer Pfadangabe tragen ihre Pfade (bei Umbenennung beide)
    #[test]
    fn zahlen_mit_ihren_pfaden() {
        let z = zahlen_mit_pfaden(b"1\t0\tfoo\x003\t0\tfoo/bar\x00-\t-\t\x00a\x00b\x00").unwrap();
        assert_eq!(z, [(Some((1, 0)), vec![b"foo".to_vec()]), (Some((3, 0)), vec![b"foo/bar".to_vec()]), (None, vec![b"a".to_vec(), b"b".to_vec()])]);
    }

    // R00206 FA 9, AK 12: Text mit den Stücken von Git; ohne Patch eine eigene Kopfzeile (Namen zitiert wie bei Git) und
    // die Zeile `# kanbanD: Patch fehlt (…)`
    #[test]
    fn text_fuer_format_patch() {
        let mut d = vec![neu("a.txt", "M"), neu("gross.txt", "A"), neu("n\nx", "A"), neu("weg.txt", "D")];
        let a = stueck(&d[0], 0, "@@ -1 +1 @@\n-a\n+b\n");
        d[0].stuecke = Some(a.clone().into_bytes());
        d[1].gross = true;
        d[2].nachladen = true;
        d[3].nachladen = true;
        assert_eq!(patch_text(&mut d), format!("{a}diff --git a/gross.txt b/gross.txt\n# kanbanD: Patch fehlt (gross)\ndiff --git \"a/n\\nx\" \"b/n\\nx\"\n# kanbanD: Patch fehlt (nachladen), laden mit &datei=\"n\\nx\"\ndiff --git a/weg.txt b/weg.txt\n# kanbanD: Patch fehlt (nachladen), laden mit &datei=weg.txt\n"));
        assert_eq!(zitiert("esc\u{1b}"), "\"esc\\033\"");
        assert_eq!(zitiert("ä ö"), "ä ö");
    }
}
