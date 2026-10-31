//! Filter an `GET /api/aufgaben` (R00092): verschiedene Parameter UND, derselbe Parameter mehrfach ODER.

use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Board};

/// Was `GET /api/aufgaben?…` verlangt. Ohne jeden Parameter: alle Aufgaben, auch archivierte (wie vor R00092);
/// sobald einer genannt ist, gelten archivierte als ausgeblendet, außer `archivierte` sagt etwas anderes.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Aufgabenfilter {
    pub board: Option<String>,
    pub spalten: Vec<String>,
    pub klassen: Vec<String>,
    pub signale: Vec<String>,
    pub zustaendige: Vec<String>,
    /// `ja`, `nein` oder eine Instanz-Kennung
    pub reserviert: Vec<String>,
    /// R00095: ganzer Text ohne Groß/Klein
    pub labels: Vec<String>,
    pub archivierte: Archivierte,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum Archivierte {
    #[default]
    Mit,
    Ohne,
    Nur,
}

impl Aufgabenfilter {
    /// Aus den Paaren der Abfrage; ein unbekannter Parameter oder `spalte` ohne `board` ist ein Fehler (400).
    pub fn aus_paaren(paare: &[(String, String)]) -> Result<Aufgabenfilter, Fehler> {
        let mut f = Aufgabenfilter { archivierte: if paare.is_empty() { Archivierte::Mit } else { Archivierte::Ohne }, ..Default::default() };
        for (k, v) in paare {
            match k.as_str() {
                "board" => f.board = Some(v.clone()),
                "spalte" => f.spalten.push(v.clone()),
                "klasse" => f.klassen.push(v.clone()),
                "signal" => f.signale.push(v.clone()),
                "zustaendig" => f.zustaendige.push(v.clone()),
                "reserviert" => f.reserviert.push(v.clone()),
                "label" => f.labels.push(v.clone()),
                "archivierte" => {
                    f.archivierte = match v.as_str() {
                        "ja" => Archivierte::Mit,
                        "nein" => Archivierte::Ohne,
                        "nur" => Archivierte::Nur,
                        _ => return Err(Fehler::Ungueltig(format!("archivierte={v}: ja, nein oder nur"))),
                    }
                }
                _ => return Err(Fehler::Ungueltig(format!("Unbekannter Filter „{k}“ — board, spalte, klasse, signal, zustaendig, reserviert, archivierte"))),
            }
        }
        if !f.spalten.is_empty() && f.board.is_none() {
            return Err(Fehler::Ungueltig("spalte braucht board".into()));
        }
        Ok(f)
    }

    /// Trifft der Filter die Aufgabe? `board` ist das Board aus `board=` (schon gelesen), `heute` als JJJJ-MM-TT für `signal=due`.
    pub fn passt(&self, a: &Aufgabe, board: Option<&Board>, heute: &str) -> bool {
        let oder = |liste: &[String], trifft: &dyn Fn(&str) -> bool| liste.is_empty() || liste.iter().any(|w| trifft(w));
        let spalte = board.and_then(|b| b.spalte_von(a.nummer));
        let abgeschlossen = board.is_some_and(|b| b.spalten.last().is_some_and(|s| s.aufgaben.contains(&a.nummer)));
        let archiv = match self.archivierte {
            Archivierte::Mit => true,
            Archivierte::Ohne => a.archiviert.is_none(),
            Archivierte::Nur => a.archiviert.is_some(),
        };
        archiv
            && (self.board.is_none() || spalte.is_some())
            && oder(&self.spalten, &|s| spalte.is_some_and(|sp| sp.name == s))
            && oder(&self.klassen, &|k| a.klasse.as_deref() == Some(k))
            && oder(&self.signale, &|s| if s == "due" { !abgeschlossen && a.faellig.as_deref().is_some_and(|f| f <= heute) } else { a.signale.iter().any(|x| x == s) })
            && oder(&self.zustaendige, &|z| a.zustaendige.iter().any(|x| x == z))
            && oder(&self.labels, &|l| a.labels.iter().any(|x| label_trifft(l, x)))
            && oder(&self.reserviert, &|r| match r {
                "ja" => a.reservierung.is_some(),
                "nein" => a.reservierung.is_none(),
                instanz => a.reservierung.as_ref().is_some_and(|x| x.gehoert(instanz)),
            })
    }
}

/// Endet das Muster auf `*`, genügt das Präfix davor (kein Escape: ein Label, das selbst auf `*` endet,
/// wird über sein Präfix gefunden); sonst der ganze Text. Beides ohne Groß/Klein.
fn label_trifft(muster: &str, label: &str) -> bool {
    let muster = muster.to_lowercase();
    let label = label.to_lowercase();
    match muster.strip_suffix('*') {
        Some(praefix) => label.starts_with(praefix),
        None => label == muster,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::{Reservierung, Spalte};

    fn paare(q: &[(&str, &str)]) -> Vec<(String, String)> {
        q.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }

    fn aufgabe(nr: u32, klasse: Option<&str>, archiviert: bool) -> Aufgabe {
        let mut a = Aufgabe::neu(nr, format!("{nr:04}-x.md"), "x".into());
        a.klasse = klasse.map(str::to_string);
        a.archiviert = archiviert.then(|| "2026-10-01".into());
        a
    }

    fn board() -> Board {
        let spalte = |name: &str, aufgaben: Vec<u32>| Spalte { notiz: None, farbe: None, name: name.into(), grenze: None, aufgaben, phase: None, pruefungen: vec![] };
        let mut b = crate::format::board::lesen("x", "# X\n").unwrap();
        b.spalten = vec![spalte("Backlog", vec![89, 90, 93]), spalte("Fertig", vec![94])];
        b
    }

    #[test]
    fn ohne_parameter_alles_mit_parametern_ohne_archivierte() {
        let alt = aufgabe(89, Some("vorrang"), true);
        assert!(Aufgabenfilter::aus_paaren(&[]).unwrap().passt(&alt, None, "2026-10-25"));
        let f = Aufgabenfilter::aus_paaren(&paare(&[("klasse", "vorrang")])).unwrap();
        assert!(!f.passt(&alt, None, "2026-10-25"), "mit einem Filter sind archivierte ausgeblendet");
        let f = Aufgabenfilter::aus_paaren(&paare(&[("klasse", "vorrang"), ("archivierte", "nur")])).unwrap();
        assert!(f.passt(&alt, None, "2026-10-25") && !f.passt(&aufgabe(90, Some("vorrang"), false), None, "2026-10-25"));
    }

    #[test]
    fn und_zwischen_parametern_oder_innerhalb() {
        let b = board();
        let f = Aufgabenfilter::aus_paaren(&paare(&[("board", "x"), ("spalte", "Backlog"), ("klasse", "vorrang")])).unwrap();
        assert!(f.passt(&aufgabe(90, Some("vorrang"), false), Some(&b), "2026-10-25"));
        assert!(!f.passt(&aufgabe(93, None, false), Some(&b), "2026-10-25"), "falsche Klasse");
        assert!(!f.passt(&aufgabe(94, Some("vorrang"), false), Some(&b), "2026-10-25"), "falsche Spalte");
        assert!(!f.passt(&aufgabe(7, Some("vorrang"), false), Some(&b), "2026-10-25"), "nicht auf dem Board");
        let f = Aufgabenfilter::aus_paaren(&paare(&[("klasse", "a"), ("klasse", "b")])).unwrap();
        assert!(f.passt(&aufgabe(1, Some("a"), false), None, "") && f.passt(&aufgabe(2, Some("b"), false), None, "") && !f.passt(&aufgabe(3, Some("c"), false), None, ""));
    }

    #[test]
    fn signal_zustaendig_und_reserviert() {
        let b = board();
        let mut a = aufgabe(90, None, false);
        a.signale = vec!["mail".into()];
        a.zustaendige = vec!["cl".into()];
        a.faellig = Some("2026-10-24".into());
        a.reservierung = Some(Reservierung { wer: "cl".into(), instanz: "A".into(), seit: "2026-10-25 08:00+01:00".into() });
        let trifft = |q: &[(&str, &str)]| Aufgabenfilter::aus_paaren(&paare(q)).unwrap().passt(&a, Some(&b), "2026-10-25");
        assert!(trifft(&[("signal", "mail")]) && !trifft(&[("signal", "review")]));
        assert!(trifft(&[("signal", "due")]), "überfällig");
        assert!(trifft(&[("zustaendig", "cl")]) && !trifft(&[("zustaendig", "st")]));
        assert!(trifft(&[("reserviert", "ja")]) && trifft(&[("reserviert", "A")]) && !trifft(&[("reserviert", "B")]) && !trifft(&[("reserviert", "nein")]));
        let mut fertig = a.clone();
        fertig.nummer = 94;
        assert!(!Aufgabenfilter::aus_paaren(&paare(&[("signal", "due")])).unwrap().passt(&fertig, Some(&b), "2026-10-25"), "in der Abschlussspalte ist die Fälligkeit kein Signal");
    }

    /// R00095: #1 `[nc:304, repo:shop]`, #2 `[nc:305]`, #3 ohne Labels.
    fn mit_labels() -> Vec<Aufgabe> {
        let mut eins = aufgabe(1, None, false);
        eins.labels = vec!["nc:304".into(), "repo:shop".into()];
        let mut zwei = aufgabe(2, None, false);
        zwei.labels = vec!["nc:305".into()];
        vec![eins, zwei, aufgabe(3, None, false)]
    }

    fn getroffen(aufgaben: &[Aufgabe], q: &[(&str, &str)]) -> Vec<u32> {
        let f = Aufgabenfilter::aus_paaren(&paare(q)).unwrap();
        aufgaben.iter().filter(|a| f.passt(a, None, "2026-10-31")).map(|a| a.nummer).collect()
    }

    #[test]
    fn label_genau_mehrfach_oder_verschieden_und() {
        let a = mit_labels();
        assert_eq!(getroffen(&a, &[("label", "nc:304")]), vec![1]);
        assert_eq!(getroffen(&a, &[("label", "nc:304"), ("label", "nc:305")]), vec![1, 2]);
        assert_eq!(getroffen(&a, &[("label", "nc:304"), ("label", "repo:shop")]), vec![1]);
        assert_eq!(getroffen(&a, &[("label", "nc:30")]), Vec::<u32>::new(), "der ganze Text, kein Teilstück");
    }

    #[test]
    fn label_ohne_gross_klein() {
        assert_eq!(getroffen(&mit_labels(), &[("label", "NC:304")]), vec![1]);
    }

    #[test]
    fn label_archivierte_nur_auf_wunsch() {
        let mut a = mit_labels();
        a[0].archiviert = Some("2026-10-01".into());
        assert_eq!(getroffen(&a, &[("label", "nc:304")]), Vec::<u32>::new());
        assert_eq!(getroffen(&a, &[("label", "nc:304"), ("archivierte", "ja")]), vec![1]);
    }

    #[test]
    fn label_leer_trifft_nichts_ohne_fehler() {
        assert_eq!(getroffen(&mit_labels(), &[("label", "")]), Vec::<u32>::new());
    }

    #[test]
    fn label_und_klasse_verknuepft_und() {
        let mut a = mit_labels();
        a[1].klasse = Some("bug".into());
        assert_eq!(getroffen(&a, &[("label", "nc:304"), ("label", "nc:305"), ("klasse", "bug")]), vec![2]);
    }

    #[test]
    fn label_praefix_mit_stern() {
        let a = mit_labels();
        assert_eq!(getroffen(&a, &[("label", "nc:*")]), vec![1, 2]);
        assert_eq!(getroffen(&a, &[("label", "repo:*")]), vec![1]);
        assert_eq!(getroffen(&a, &[("label", "REPO:*")]), vec![1], "Präfix ohne Groß/Klein");
    }

    #[test]
    fn label_nur_stern_trifft_jede_aufgabe_mit_label_nicht_die_ohne() {
        assert_eq!(getroffen(&mit_labels(), &[("label", "*")]), vec![1, 2], "#3 ohne Label nicht");
    }

    #[test]
    fn label_mit_stern_am_ende_wird_ueber_sein_praefix_gefunden() {
        let mut a = mit_labels();
        a[2].labels = vec!["wichtig*".into()];
        a[1].labels = vec!["wichtiger".into()];
        assert_eq!(getroffen(&a, &[("label", "wichtig*")]), vec![2, 3], "kein Escape: Präfix trifft auch längere Labels");
    }

    #[test]
    fn fehler_in_der_abfrage() {
        assert!(Aufgabenfilter::aus_paaren(&paare(&[("spalte", "Backlog")])).is_err(), "spalte ohne board");
        assert!(Aufgabenfilter::aus_paaren(&paare(&[("farbe", "rot")])).is_err(), "unbekannt");
        assert!(Aufgabenfilter::aus_paaren(&paare(&[("archivierte", "vielleicht")])).is_err());
    }
}
