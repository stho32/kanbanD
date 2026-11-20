//! Der Diff eines Commits (R00206, ADR-0032 Punkt 6 Form F2, N4): Dateiliste aus `diff-tree --raw -z` und
//! `--numstat -z`, Patch-Text je Datei, Grenzen und Hinweise — rein, **ohne Git**: hier wird nur zerlegt, verbunden und
//! begrenzt, was der Startort gelesen hat.

use serde::Serialize;

/// Höchstzahl der Dateien in `dateien` (Startwert, Hypothese; Entscheidung des product-owner 2026-11-19).
pub const KAPPE_DATEIEN: usize = 2_000;
/// Bytegrenze je Lauf der Dateiliste (`--raw -z`, `--numstat -z`; Startwert, Hypothese, ADR-0032 N4.3).
pub const GRENZE_DATEILISTE: usize = 1_048_576;

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
}

impl Diffdatei {
    /// Der Name der Datei für Hinweise und `datei=`: `neu`, bei gelöschten `alt`.
    pub fn name(&self) -> &str {
        self.neu.as_deref().or(self.alt.as_deref()).unwrap_or_default()
    }
}

/// Ein Eintrag von `diff-tree --raw -z`: `:<modus alt> <modus neu> <hash alt> <hash neu> <status>[zahl]\0<pfad>\0`, bei
/// Umbenennung `…\0<alt>\0<neu>\0`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rohdatei {
    pub modus_alt: String,
    pub modus_neu: String,
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
        let [modus_alt, modus_neu, _, _, status] = teile.as_slice() else { return None };
        let mut zeichen = status.chars();
        let art = zeichen.next()?;
        let zahl = zeichen.as_str();
        let zahl = if zahl.is_empty() { None } else { Some(zahl.parse().ok()?) };
        let anzahl = if matches!(art, 'R' | 'C') { 2 } else { 1 };
        if i + anzahl >= felder.len() {
            break;
        }
        let pfade = felder[i + 1..=i + anzahl].iter().map(|p| p.to_vec()).collect();
        eintraege.push(Rohdatei { modus_alt: modus_alt.to_string(), modus_neu: modus_neu.to_string(), status: art, zahl, pfade });
        i += 1 + anzahl;
    }
    Some(eintraege)
}

/// Zeilen hinzu und weg je Eintrag von `diff-tree --numstat -z` (`<plus>\t<minus>\t<pfad>\0` oder
/// `<plus>\t<minus>\t\0<alt>\0<neu>\0`); `None` bei einer Binärdatei (`-\t-`). Ein angefangener Eintrag fällt weg.
pub fn zahlen_lesen(aus: &[u8]) -> Option<Vec<Option<(u64, u64)>>> {
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
        zahlen.push(match (*plus, *minus) {
            (b"-", b"-") => None,
            _ => Some((zahl(plus)?, zahl(minus)?)),
        });
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

/// Ein Hinweis der Antwort (ADR-0032 N4.5): Objekte mit `art`; ein Leser überspringt eine unbekannte Art.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
#[serde(tag = "art", rename_all = "snake_case")]
pub enum Hinweis {
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
}
