//! Verlauf eines Boards aus seinen Ständen — rein, ohne Git.

use crate::modell::Board;
use chrono::{NaiveDate, NaiveDateTime};
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Serialize, utoipa::ToSchema)]
pub struct Tag {
    pub datum: String,
    pub offen: usize,
    pub umfang: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, utoipa::ToSchema)]
pub struct Durchlauf {
    pub nummer: u32,
    pub eintritt: String,
    pub abschluss: String,
    pub tage: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, utoipa::ToSchema)]
pub struct Verlauf {
    pub tage: Vec<Tag>,
    pub durchlauf: Vec<Durchlauf>,
    pub mittel: Option<f64>,
    pub median: Option<f64>,
}

/// Ein Spaltenwechsel; `spalte: None` heißt vom Board genommen.
#[derive(Debug, Clone, PartialEq, Serialize, utoipa::ToSchema)]
pub struct Wechsel {
    pub zeitpunkt: String,
    pub spalte: Option<String>,
}

/// Ein einzelner Zug zwischen zwei aufeinanderfolgenden Ständen: `von`/`nach` sind Spaltennamen, `None` heißt
/// „nicht auf dem Board“ (auf das Board gelegt bzw. vom Board genommen, R00123).
#[derive(Debug, Clone, PartialEq)]
pub struct Zug {
    pub nummer: u32,
    pub zeitpunkt: NaiveDateTime,
    pub von: Option<String>,
    pub nach: Option<String>,
}

/// Je Aufgabe die Wechsel, ihre Labels und ob sie in den Berichten zählt.
#[derive(Debug, Clone, PartialEq, Serialize, utoipa::ToSchema)]
pub struct Bewegung {
    pub nummer: u32,
    pub wechsel: Vec<Wechsel>,
    pub labels: Vec<String>,
    /// `reporting` der Aufgabe (R00060): `burndown`/`forecast` false nimmt sie aus dem Bericht, fehlt der Schlüssel, zählt sie
    pub reporting: crate::modell::Berichtszaehlung,
}

#[derive(Debug, Clone, PartialEq, Serialize, utoipa::ToSchema)]
pub struct Bewegungen {
    pub spalten: Vec<String>,
    pub jetzt: String,
    pub aufgaben: Vec<Bewegung>,
}

/// Je Aufgabe die Wechsel zwischen aufeinanderfolgenden Ständen; `staende` in zeitlicher Folge.
pub fn bewegungen(staende: &[(NaiveDateTime, Board)], spalten: Vec<String>, jetzt: NaiveDateTime) -> Bewegungen {
    let fmt = |z: &NaiveDateTime| z.format(crate::format::aufgabe::ZEITFORMAT).to_string();
    let mut je: BTreeMap<u32, Vec<Wechsel>> = BTreeMap::new();
    for zug in zuege(staende) {
        je.entry(zug.nummer).or_default().push(Wechsel { zeitpunkt: fmt(&zug.zeitpunkt), spalte: zug.nach });
    }
    let aufgaben = je.into_iter().map(|(nummer, wechsel)| Bewegung { nummer, wechsel, labels: vec![], reporting: Default::default() }).collect();
    Bewegungen { spalten, jetzt: fmt(&jetzt), aufgaben }
}

/// Je Aufgabe die Züge zwischen aufeinanderfolgenden Ständen; `staende` in zeitlicher Folge. Ein Zug nennt `von` und
/// `nach` (R00123); dieselbe Quelle wie [`bewegungen`], damit der Karten-Verlauf die Logik nicht verdoppelt.
pub fn zuege(staende: &[(NaiveDateTime, Board)]) -> Vec<Zug> {
    let mut vorher: BTreeMap<u32, String> = BTreeMap::new();
    let mut zuege = vec![];
    for (zp, b) in staende {
        let mut jetzt_da: BTreeMap<u32, String> = BTreeMap::new();
        for s in &b.spalten {
            for n in &s.aufgaben {
                jetzt_da.entry(*n).or_insert_with(|| s.name.clone());
            }
        }
        for (n, sp) in &jetzt_da {
            match vorher.get(n) {
                Some(v) if v == sp => {}
                Some(v) => zuege.push(Zug { nummer: *n, zeitpunkt: *zp, von: Some(v.clone()), nach: Some(sp.clone()) }),
                None => zuege.push(Zug { nummer: *n, zeitpunkt: *zp, von: None, nach: Some(sp.clone()) }),
            }
        }
        for (n, sp) in vorher.iter().filter(|(n, _)| !jetzt_da.contains_key(n)) {
            zuege.push(Zug { nummer: *n, zeitpunkt: *zp, von: Some(sp.clone()), nach: None });
        }
        vorher = jetzt_da;
    }
    zuege
}

/// Die Stände, in denen sich die Lage der Karte ändert — ihre Spalte oder „nicht auf dem Board“; nur sie können einen
/// Bewegungseintrag ergeben. Der erste Stand bleibt, damit die erste Lage bekannt ist. Ein Commit, der die Karte nicht
/// bewegt, kann ihre Spalte nicht ändern; eine umbenannte Spalte ändert die Spur und bleibt so sichtbar (#131).
pub fn spuren_wechsel(staende: &[crate::git::Stand], nummer: u32) -> Vec<&crate::git::Stand> {
    let marke = format!("#{nummer}");
    let mut behalten = vec![];
    let mut vorher: Option<Option<&str>> = None;
    for stand in staende {
        // Ohne `#<nummer>` im Text kann die Karte nicht darauf stehen — der billige Vorfilter für die vielen fremden Stände.
        let spur = if stand.inhalt.contains(&marke) { kartenspur(&stand.inhalt, nummer) } else { None };
        if vorher != Some(spur) {
            behalten.push(stand);
            vorher = Some(spur);
        }
    }
    behalten
}

/// Die Spalte, in der die Karte in diesem Board-Text steht: die `## `-Überschrift über ihrer Zeile; `None` heißt
/// „nicht auf dem Board“. Rein textlich und billig — der Filter, der die Auswertung auf die Stände der Karte begrenzt
/// (#131); Überschrift und Aufgabenzeile werden nach denselben Regeln erkannt wie beim Lesen der Board-Datei.
pub fn kartenspur(text: &str, nummer: u32) -> Option<&str> {
    let (_, koerper) = crate::format::frontmatter::trennen(text).ok()?;
    let mut spalte: Option<&str> = None;
    for zeile in koerper.lines() {
        let z = zeile.trim_end();
        if let Some(name) = z.strip_prefix("## ") {
            spalte = Some(name.trim());
        } else if crate::format::board::aufgabennummer(z) == Some(nummer) {
            return spalte;
        }
    }
    None
}

/// Die Art eines Verlaufs-Eintrags (R00123); in der API klein geschrieben.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Kartenart {
    Erstellt,
    Bewegt,
    Archiviert,
    Zurueckgeholt,
    Geloescht,
}

/// Ein Eintrag des Karten-Verlaufs (R00123, ADR-0021): aus der Git-Geschichte gerechnet, kein zweiter Speicher.
#[derive(Debug, Clone, PartialEq, Serialize, utoipa::ToSchema)]
pub struct KartenEintrag {
    /// Zeitpunkt `JJJJ-MM-TT HH:MM` (Ortszeit)
    pub zeitpunkt: String,
    pub art: Kartenart,
    /// Der Commit-Autor: Kürzel einer kanbanD-Person oder Git-Name eines fremden Autors
    pub wer: String,
    /// Slug des Boards; nur bei Bewegung (und bei der Erstellung, wenn sie mit der Aufnahme geschah)
    pub board: Option<String>,
    /// Spalte, aus der bewegt wurde; null = auf das Board gelegt oder kein Wechsel
    pub von: Option<String>,
    /// Spalte, in die bewegt wurde; null = vom Board genommen
    pub nach: Option<String>,
}

/// Die Einträge des Karten-Verlaufs, neueste zuerst.
#[derive(Debug, Clone, PartialEq, Serialize, utoipa::ToSchema)]
pub struct Kartenverlauf {
    pub eintraege: Vec<KartenEintrag>,
    /// Slugs der Boards, deren Datei nicht lesbar war: ihre Einträge können fehlen (R00120: der Lesende wird nicht
    /// abgewiesen, die Lücke steht sichtbar in der Antwort; #131). Leer heißt vollständig.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub defekt: Vec<String>,
}

impl Kartenverlauf {
    pub fn leer() -> Kartenverlauf {
        Kartenverlauf { eintraege: vec![], defekt: vec![] }
    }
}

/// Ein Stand der Aufgabendatei, soweit der Verlauf ihn braucht: Zeitpunkt, `archived` und Autor (R00123/B0571–B0573).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Aufgabenstand {
    pub zeitpunkt: NaiveDateTime,
    pub archiviert: Option<String>,
    pub autor: crate::git::Autor,
}

/// Führt die Git-Geschichte der Aufgabendatei und jeder Board-Datei zu einem Karten-Verlauf zusammen (ADR-0021).
/// Ein Commit je Aktion ist ein Eintrag; die Aufnahme auf ein Board im selben Commit wie die Erstellung geht in
/// `erstellt` auf (kein zweiter `bewegt`). Zeitlich gemischt über alle Boards, neueste zuerst. `defekt` sind die
/// Boards ohne lesbare Datei — sie erscheinen als Lücke in der Antwort, nicht als Abbruch (#131).
pub fn kartenverlauf(
    nummer: u32,
    aufgabe: &[Aufgabenstand],
    boards: &[(String, Vec<(NaiveDateTime, Board, crate::git::Autor)>)],
    loeschung: Option<(NaiveDateTime, crate::git::Autor)>,
    defekt: Vec<String>,
) -> Kartenverlauf {
    let fmt = |z: &NaiveDateTime| z.format(crate::format::aufgabe::ZEITFORMAT).to_string();
    let mut selbst: Vec<KartenEintrag> = vec![];
    for (slug, staende) in boards {
        let paare: Vec<(NaiveDateTime, Board)> = staende.iter().map(|(z, b, _)| (*z, b.clone())).collect();
        for zug in zuege(&paare).into_iter().filter(|z| z.nummer == nummer) {
            let wer = staende.iter().find(|(z, _, _)| *z == zug.zeitpunkt).map(|(_, _, a)| a.wer()).unwrap_or_default();
            selbst.push(KartenEintrag { zeitpunkt: fmt(&zug.zeitpunkt), art: Kartenart::Bewegt, wer, board: Some(slug.clone()), von: zug.von, nach: zug.nach });
        }
    }
    let mut eintraege: Vec<KartenEintrag> = vec![];
    // Erstellt: der erste Commit der Aufgabendatei; die Aufnahme auf ein Board im selben Commit verschmilzt hierher.
    if let Some((erst, _)) = aufgabe.split_first() {
        let passend = selbst.iter().position(|z| z.zeitpunkt == fmt(&erst.zeitpunkt) && z.von.is_none());
        let (board, nach) = match passend {
            Some(i) => {
                let z = selbst.remove(i);
                (z.board, z.nach)
            }
            None => (None, None),
        };
        eintraege.push(KartenEintrag { zeitpunkt: fmt(&erst.zeitpunkt), art: Kartenart::Erstellt, wer: erst.autor.wer(), board, von: None, nach });
    }
    // Archiviert / Zurückgeholt aus dem Wechsel des `archived`-Feldes.
    for fenster in aufgabe.windows(2) {
        let (vor, nach) = (&fenster[0], &fenster[1]);
        let art = match (vor.archiviert.is_some(), nach.archiviert.is_some()) {
            (false, true) => Some(Kartenart::Archiviert),
            (true, false) => Some(Kartenart::Zurueckgeholt),
            _ => None,
        };
        if let Some(art) = art {
            eintraege.push(KartenEintrag { zeitpunkt: fmt(&nach.zeitpunkt), art, wer: nach.autor.wer(), board: None, von: None, nach: None });
        }
    }
    eintraege.extend(selbst);
    if let Some((zeitpunkt, autor)) = loeschung {
        eintraege.push(KartenEintrag { zeitpunkt: fmt(&zeitpunkt), art: Kartenart::Geloescht, wer: autor.wer(), board: None, von: None, nach: None });
    }
    // neueste zuerst; der Zeitpunkt `JJJJ-MM-TT HH:MM` sortiert als Text wie chronologisch
    eintraege.sort_by(|a, b| b.zeitpunkt.cmp(&a.zeitpunkt));
    Kartenverlauf { eintraege, defekt }
}

fn zaehlen(b: &Board) -> (usize, usize) {
    let umfang: usize = b.spalten.iter().map(|s| s.aufgaben.len()).sum();
    let fertig = b.abschlussspalte().map(|s| s.aufgaben.len()).unwrap_or(0);
    (umfang - fertig, umfang)
}

fn runden(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

/// `staende` in zeitlicher Folge. Je Tag gilt der letzte Stand bis Tagesende, Tage ohne Stand übernehmen den Vortag.
pub fn verlauf(staende: &[(NaiveDateTime, Board)], heute: NaiveDate) -> Verlauf {
    let mut je_tag: BTreeMap<NaiveDate, &Board> = BTreeMap::new();
    let mut eintritt: BTreeMap<u32, NaiveDateTime> = BTreeMap::new();
    let mut abschluss: BTreeMap<u32, NaiveDateTime> = BTreeMap::new();
    for (zp, b) in staende {
        je_tag.insert(zp.date(), b);
        let fertig = b.abschlussspalte().map(|s| s.aufgaben.clone()).unwrap_or_default();
        for s in &b.spalten {
            for n in &s.aufgaben {
                eintritt.entry(*n).or_insert(*zp);
                if fertig.contains(n) {
                    abschluss.entry(*n).or_insert(*zp);
                }
            }
        }
    }
    let mut tage = vec![];
    if let Some((&erster, _)) = je_tag.iter().next() {
        let mut stand = None;
        let mut d = erster;
        while d <= heute.max(erster) {
            if let Some(b) = je_tag.get(&d) {
                stand = Some(*b);
            }
            let (offen, umfang) = stand.map(zaehlen).unwrap_or((0, 0));
            tage.push(Tag { datum: d.format("%Y-%m-%d").to_string(), offen, umfang });
            d = d.succ_opt().expect("Datum im Bereich");
        }
    }
    let fmt = |z: &NaiveDateTime| z.format(crate::format::aufgabe::ZEITFORMAT).to_string();
    let mut durchlauf: Vec<Durchlauf> = abschluss
        .iter()
        .map(|(n, a)| {
            let e = eintritt[n];
            Durchlauf { nummer: *n, eintritt: fmt(&e), abschluss: fmt(a), tage: runden((*a - e).num_minutes() as f64 / 1440.0) }
        })
        .collect();
    durchlauf.sort_by(|a, b| b.abschluss.cmp(&a.abschluss).then(a.nummer.cmp(&b.nummer)));
    let mut werte: Vec<f64> = durchlauf.iter().map(|d| d.tage).collect();
    werte.sort_by(|a, b| a.partial_cmp(b).expect("keine NaN"));
    let mittel = (!werte.is_empty()).then(|| runden(werte.iter().sum::<f64>() / werte.len() as f64));
    let median = (!werte.is_empty()).then(|| {
        let m = werte.len() / 2;
        runden(if werte.len().is_multiple_of(2) { (werte[m - 1] + werte[m]) / 2.0 } else { werte[m] })
    });
    Verlauf { tage, durchlauf, mittel, median }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::Spalte;

    fn b(a: &[u32], z: &[u32]) -> Board {
        Board { slug: "b".into(), titel: "B".into(), spalten: vec![Spalte { name: "A".into(), grenze: None, aufgaben: a.to_vec(), ..Default::default() }, Spalte { name: "Z".into(), grenze: None, aufgaben: z.to_vec(), ..Default::default() }], termine: vec![], anwendungen: None, klassen: None, start: None, fieber: Default::default(), berichtsfilter: Default::default(), bestand: None, eigentuemer_roh: vec![], archiviert: None, transkripte_erfassen: None }
    }

    fn zp(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M").unwrap()
    }

    #[test]
    fn offen_umfang_und_durchlauf() {
        let staende = vec![(zp("2026-10-01 09:00"), b(&[1, 2], &[])), (zp("2026-10-02 09:00"), b(&[2], &[1])), (zp("2026-10-04 09:00"), b(&[], &[1, 2]))];
        let v = verlauf(&staende, NaiveDate::from_ymd_opt(2026, 10, 4).unwrap());
        assert_eq!(v.tage.iter().map(|t| t.offen).collect::<Vec<_>>(), vec![2, 1, 1, 0]);
        assert_eq!(v.tage.iter().map(|t| t.umfang).collect::<Vec<_>>(), vec![2, 2, 2, 2]);
        assert_eq!(v.tage[2].datum, "2026-10-03");
        assert_eq!(v.durchlauf.iter().map(|d| (d.nummer, d.tage)).collect::<Vec<_>>(), vec![(2, 3.0), (1, 1.0)]);
        assert_eq!((v.mittel, v.median), (Some(2.0), Some(2.0)));
    }

    #[test]
    fn rueckkehr_aendert_die_erste_abschlusszeit_nicht_und_mehrere_staende_am_tag() {
        let staende = vec![
            (zp("2026-10-01 09:00"), b(&[1], &[])),
            (zp("2026-10-02 09:00"), b(&[], &[1])),
            (zp("2026-10-03 09:00"), b(&[1], &[])),
            (zp("2026-10-03 17:00"), b(&[], &[1])),
        ];
        let v = verlauf(&staende, NaiveDate::from_ymd_opt(2026, 10, 5).unwrap());
        assert_eq!(v.durchlauf[0].tage, 1.0);
        assert_eq!(v.tage.iter().map(|t| t.offen).collect::<Vec<_>>(), vec![1, 0, 0, 0, 0]);
        assert_eq!((v.mittel, v.median), (Some(1.0), Some(1.0)));
    }

    #[test]
    fn wechsel_je_aufgabe_mit_abnehmen() {
        let staende = vec![(zp("2026-10-01 09:00"), b(&[1, 2], &[])), (zp("2026-10-01 10:00"), b(&[1, 2], &[])), (zp("2026-10-02 09:00"), b(&[2], &[1])), (zp("2026-10-04 09:00"), b(&[], &[2]))];
        let w = bewegungen(&staende, vec!["A".into(), "Z".into()], zp("2026-10-05 08:00"));
        let kurz = |i: usize| w.aufgaben[i].wechsel.iter().map(|x| (x.zeitpunkt.as_str(), x.spalte.as_deref())).collect::<Vec<_>>();
        assert_eq!(w.aufgaben[0].nummer, 1);
        assert_eq!(kurz(0), vec![("2026-10-01 09:00", Some("A")), ("2026-10-02 09:00", Some("Z")), ("2026-10-04 09:00", None)]);
        assert_eq!(kurz(1), vec![("2026-10-01 09:00", Some("A")), ("2026-10-04 09:00", Some("Z"))]);
        assert_eq!((w.spalten.len(), w.jetzt.as_str()), (2, "2026-10-05 08:00"));
    }

    #[test]
    fn ohne_staende_und_gerader_median() {
        let v = verlauf(&[], NaiveDate::from_ymd_opt(2026, 10, 5).unwrap());
        assert!(v.tage.is_empty() && v.mittel.is_none() && v.median.is_none());
        let staende = vec![(zp("2026-10-01 00:00"), b(&[1, 2, 3, 4], &[])), (zp("2026-10-02 00:00"), b(&[3, 4], &[1, 2])), (zp("2026-10-05 00:00"), b(&[], &[1, 2, 3, 4]))];
        let v = verlauf(&staende, NaiveDate::from_ymd_opt(2026, 10, 5).unwrap());
        assert_eq!(v.median, Some(2.5));
        assert_eq!(v.mittel, Some(2.5));
    }

    // R00123 B0571: der Commit-Autor — Kürzel aus `<kürzel>@kanbanD`, sonst der Git-Name unverändert
    fn autor(wer: &str) -> crate::git::Autor {
        match wer {
            "Extern" => crate::git::Autor { name: "Extern".into(), email: "extern@example.org".into() },
            k => crate::git::Autor { name: format!("Name {k}"), email: format!("{k}@kanbanD") },
        }
    }

    fn board3(e: &[u32], a: &[u32], f: &[u32]) -> Board {
        let s = |name: &str, aufgaben: &[u32]| Spalte { name: name.into(), aufgaben: aufgaben.to_vec(), ..Default::default() };
        Board { slug: "fabrik".into(), titel: "fabrik".into(), spalten: vec![s("Eingang", e), s("In Arbeit", a), s("Fertig", f)], ..Board { slug: String::new(), titel: String::new(), spalten: vec![], termine: vec![], anwendungen: None, klassen: None, start: None, fieber: Default::default(), berichtsfilter: Default::default(), bestand: None, eigentuemer_roh: vec![], archiviert: None, transkripte_erfassen: None } }
    }

    fn auf(zp_str: &str, archiviert: Option<&str>, wer: &str) -> Aufgabenstand {
        Aufgabenstand { zeitpunkt: zp(zp_str), archiviert: archiviert.map(Into::into), autor: autor(wer) }
    }

    // R00123 B0572: das Rechenbeispiel der AK (sechs Commits, zwei Autoren, vom Board genommen, Erstellung verschmilzt)
    #[test]
    fn kartenverlauf_rechnet_das_rechenbeispiel() {
        let aufgabe = [auf("2026-10-01 09:00", None, "sh"), auf("2026-10-04 09:00", Some("2026-10-04"), "sh"), auf("2026-10-05 09:00", None, "sh")];
        let fabrik = vec![
            (zp("2026-10-01 09:00"), board3(&[1], &[], &[]), autor("sh")),
            (zp("2026-10-02 09:00"), board3(&[], &[1], &[]), autor("cl")),
            (zp("2026-10-03 09:00"), board3(&[], &[], &[1]), autor("cl")),
            (zp("2026-10-06 09:00"), board3(&[], &[], &[]), autor("sh")),
        ];
        let v = kartenverlauf(1, &aufgabe, &[("fabrik".into(), fabrik)], None, vec![]);
        let kurz: Vec<(&str, Kartenart, Option<&str>, Option<&str>, Option<&str>, &str)> = v.eintraege.iter().map(|e| (e.zeitpunkt.as_str(), e.art, e.board.as_deref(), e.von.as_deref(), e.nach.as_deref(), e.wer.as_str())).collect();
        assert_eq!(
            kurz,
            vec![
                ("2026-10-06 09:00", Kartenart::Bewegt, Some("fabrik"), Some("Fertig"), None, "sh"),
                ("2026-10-05 09:00", Kartenart::Zurueckgeholt, None, None, None, "sh"),
                ("2026-10-04 09:00", Kartenart::Archiviert, None, None, None, "sh"),
                ("2026-10-03 09:00", Kartenart::Bewegt, Some("fabrik"), Some("In Arbeit"), Some("Fertig"), "cl"),
                ("2026-10-02 09:00", Kartenart::Bewegt, Some("fabrik"), Some("Eingang"), Some("In Arbeit"), "cl"),
                ("2026-10-01 09:00", Kartenart::Erstellt, Some("fabrik"), None, Some("Eingang"), "sh"),
            ],
            "sechs Einträge, neueste zuerst, die Aufnahme bei der Erstellung verschmilzt"
        );
    }

    // R00123 B0573: die gelöschte Aufgabendatei ergibt einen eigenen Eintrag, die früheren bleiben
    #[test]
    fn kartenverlauf_mit_loeschung_und_fremdem_autor() {
        let aufgabe = [auf("2026-10-01 09:00", None, "sh")];
        let fabrik = vec![(zp("2026-10-01 09:00"), board3(&[1], &[], &[]), autor("sh")), (zp("2026-10-07 09:00"), board3(&[], &[1], &[]), autor("Extern"))];
        let v = kartenverlauf(1, &aufgabe, &[("fabrik".into(), fabrik)], Some((zp("2026-10-09 09:00"), autor("sh"))), vec![]);
        assert_eq!(v.eintraege.first().map(|e| (e.art, e.zeitpunkt.as_str(), e.wer.as_str())), Some((Kartenart::Geloescht, "2026-10-09 09:00", "sh")), "geloescht zuoberst");
        assert_eq!(v.eintraege.len(), 3, "Erstellung, Bewegung des fremden Autors, Löschung");
        assert_eq!(v.eintraege[1].wer, "Extern", "fremder Autor unverändert");
        assert_eq!(v.eintraege[2].art, Kartenart::Erstellt);
    }

    // R00123 B0572: mehrere Boards — je Bewegung das Board genannt, zeitlich gemischt
    #[test]
    fn kartenverlauf_ueber_mehrere_boards() {
        let aufgabe = [auf("2026-10-01 09:00", None, "sh")];
        let fabrik = vec![(zp("2026-10-01 09:00"), board3(&[1], &[], &[]), autor("sh")), (zp("2026-10-02 09:00"), board3(&[], &[1], &[]), autor("cl"))];
        let privat = vec![(zp("2026-10-07 09:00"), board3(&[1], &[], &[]), autor("sh")), (zp("2026-10-08 09:00"), board3(&[], &[1], &[]), autor("sh"))];
        let v = kartenverlauf(1, &aufgabe, &[("fabrik".into(), fabrik), ("privat".into(), privat)], None, vec![]);
        let boards: Vec<&str> = v.eintraege.iter().filter(|e| e.art == Kartenart::Bewegt).map(|e| e.board.as_deref().unwrap_or("")).collect();
        assert_eq!(boards, vec!["privat", "privat", "fabrik"], "beide Bewegungsfolgen, zeitlich gemischt");
        let aufnahme = v.eintraege.iter().find(|e| e.board.as_deref() == Some("privat") && e.von.is_none());
        assert_eq!(aufnahme.map(|e| (e.zeitpunkt.as_str(), e.nach.as_deref())), Some(("2026-10-07 09:00", Some("Eingang"))), "auf das Board gelegt");
        assert_eq!(v.eintraege.last().map(|e| e.art), Some(Kartenart::Erstellt));
    }

    // R00123: Leistung — 100 Einträge über 5 Boards in unter 200 ms gerechnet (AK `< 200 ms`)
    #[test]
    fn kartenverlauf_leistung_100_eintraege() {
        let mut boards: Vec<(String, Vec<(NaiveDateTime, Board, crate::git::Autor)>)> = vec![];
        for b in 0..5 {
            let staende = (0..20)
                .map(|k| {
                    let board = if k % 2 == 0 { board3(&[1], &[], &[]) } else { board3(&[], &[1], &[]) };
                    (zp(&format!("2026-10-{:02} 09:00", 1 + k)), board, autor("sh"))
                })
                .collect();
            boards.push((format!("b{b}"), staende));
        }
        let aufgabe = [auf("2026-10-01 09:00", None, "sh")];
        let start = std::time::Instant::now();
        let v = kartenverlauf(1, &aufgabe, &boards, None, vec![]);
        let dauer = start.elapsed();
        assert!(v.eintraege.len() >= 100, "{} Einträge", v.eintraege.len());
        assert!(dauer.as_millis() < 200, "{dauer:?}");
    }

    // R00123: keine Nummer — kein Eintrag
    #[test]
    fn kartenverlauf_ohne_spur_ist_leer() {
        let v = kartenverlauf(99, &[], &[], None, vec![]);
        assert!(v.eintraege.is_empty());
    }

    #[test]
    fn zuege_nennen_von_und_nach() {
        let staende = vec![(zp("2026-10-01 09:00"), b(&[1], &[])), (zp("2026-10-02 09:00"), b(&[], &[1])), (zp("2026-10-03 09:00"), b(&[], &[]))];
        let z = zuege(&staende);
        let kurz: Vec<(u32, Option<&str>, Option<&str>)> = z.iter().map(|x| (x.nummer, x.von.as_deref(), x.nach.as_deref())).collect();
        assert_eq!(kurz, vec![(1, None, Some("A")), (1, Some("A"), Some("Z")), (1, Some("Z"), None)]);
    }

    // #131: die textliche Spur der Karte — Überschrift über ihrer Zeile, `#10` trifft `#1` nicht, Frontmatter zählt nicht
    #[test]
    fn kartenspur_liest_die_spalte_der_karte() {
        let text = "---\nid: 1\ncolumn-notes:\n  A: siehe #1\n---\n\n# Board\n\n## Eingang\n\n- #10\n\n## Arbeit\n\n- #1\n- #2\n";
        assert_eq!(kartenspur(text, 1), Some("Arbeit"));
        assert_eq!(kartenspur(text, 10), Some("Eingang"));
        assert_eq!(kartenspur(text, 99), None, "nicht auf dem Board");
        assert_eq!(kartenspur("# Board\n\n## A\n\n- #1\n", 1), Some("A"), "auch ohne Frontmatter");
    }

    // #131: nur die Stände mit geänderter Lage bleiben — die Umbenennung der Spalte zählt, ein fremder Zug nicht
    #[test]
    fn spuren_wechsel_behaelt_nur_geaenderte_lagen() {
        let stand = |zeit: &str, text: &str| crate::git::Stand { zeitpunkt: zp(zeit), inhalt: text.into(), autor: autor("sh") };
        let a = stand("2026-10-01 09:00", "# B\n\n## Eingang\n\n- #1\n\n## Arbeit\n");
        let fremd = stand("2026-10-02 09:00", "# B\n\n## Eingang\n\n- #1\n- #2\n\n## Arbeit\n");
        let umbenannt = stand("2026-10-03 09:00", "# B\n\n## Todo\n\n- #1\n- #2\n\n## Arbeit\n");
        let gleich = stand("2026-10-04 09:00", "# B\n\n## Todo\n\n- #2\n- #1\n\n## Arbeit\n");
        let weg = stand("2026-10-05 09:00", "# B\n\n## Todo\n\n- #2\n\n## Arbeit\n");
        let staende = vec![a, fremd, umbenannt, gleich, weg];
        let behalten: Vec<String> = spuren_wechsel(&staende, 1).iter().map(|s| s.zeitpunkt.format("%Y-%m-%d").to_string()).collect();
        assert_eq!(behalten, vec!["2026-10-01", "2026-10-03", "2026-10-05"], "fremder Zug und bloßes Umsortieren ändern die Lage nicht");
    }
}
