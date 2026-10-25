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
            && oder(&self.reserviert, &|r| match r {
                "ja" => a.reservierung.is_some(),
                "nein" => a.reservierung.is_none(),
                instanz => a.reservierung.as_ref().is_some_and(|x| x.gehoert(instanz)),
            })
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

    #[test]
    fn fehler_in_der_abfrage() {
        assert!(Aufgabenfilter::aus_paaren(&paare(&[("spalte", "Backlog")])).is_err(), "spalte ohne board");
        assert!(Aufgabenfilter::aus_paaren(&paare(&[("farbe", "rot")])).is_err(), "unbekannt");
        assert!(Aufgabenfilter::aus_paaren(&paare(&[("archivierte", "vielleicht")])).is_err());
    }
}
