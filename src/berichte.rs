//! Auswertungen über Aufgaben und ihre Zeiten — rein, ohne Dateizugriff.

use crate::modell::{Art, Aufgabe, Einstellungen, OHNE_HERKUNFT};
use crate::uhr;

fn feld(s: &str) -> String {
    if s.contains([';', '"', '\n', '\r']) { format!("\"{}\"", s.replace('"', "\"\"")) } else { s.to_string() }
}

/// Eine Zeile je Zeiteintrag, `;`-getrennt, mit BOM; laufende Einträge zählen bis `jetzt`.
pub fn zeiten_csv(aufgaben: &[Aufgabe], e: &Einstellungen, jetzt: &str) -> String {
    let mut s = String::from("\u{feff}aufgabe;titel;person;art;beginn;ende;dauer_min;herkunft\n");
    for a in aufgaben {
        let herkunft = if a.herkunft.is_empty() { OHNE_HERKUNFT.to_string() } else { a.herkunft.join(" ") };
        for z in &a.zeiten {
            let art = match e.person(&z.wer).map(|p| p.art) {
                Some(Art::Agent) => "agent",
                _ => "human",
            };
            let minuten = uhr::minuten(&z.beginn, z.ende.as_deref().unwrap_or(jetzt)).unwrap_or(0);
            let zeile = [a.nummer.to_string(), feld(&a.titel), feld(&z.wer), art.into(), z.beginn.clone(), z.ende.clone().unwrap_or_default(), minuten.to_string(), feld(&herkunft)];
            s.push_str(&zeile.join(";"));
            s.push('\n');
        }
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::{Person, Zeiteintrag};

    #[test]
    fn eine_zeile_je_eintrag_mit_quoting_und_laufendem() {
        let e = Einstellungen { personen: vec![Person { kuerzel: "cl".into(), name: "Claude".into(), art: Art::Agent, aktiv: true }], ..Default::default() };
        let mut a = Aufgabe::neu(1, "0001-a.md".into(), "a; b".into());
        a.zeiten = vec![
            Zeiteintrag { wer: "st".into(), beginn: "2026-10-17 09:00".into(), ende: Some("2026-10-17 10:30".into()) },
            Zeiteintrag { wer: "cl".into(), beginn: "2026-10-18 11:00".into(), ende: None },
        ];
        let mut b = Aufgabe::neu(2, "0002-b.md".into(), "Zitat \"x\"".into());
        b.herkunft = vec!["I0001".into(), "R00002".into()];
        b.zeiten = vec![Zeiteintrag { wer: "st".into(), beginn: "2026-10-18 08:00".into(), ende: Some("2026-10-18 08:05".into()) }];
        let csv = zeiten_csv(&[a, b, Aufgabe::neu(3, "0003-c.md".into(), "ohne".into())], &e, "2026-10-18 11:45");
        let zeilen: Vec<&str> = csv.lines().collect();
        assert_eq!(zeilen[0], "\u{feff}aufgabe;titel;person;art;beginn;ende;dauer_min;herkunft");
        assert_eq!(zeilen[1], "1;\"a; b\";st;human;2026-10-17 09:00;2026-10-17 10:30;90;thin air");
        assert_eq!(zeilen[2], "1;\"a; b\";cl;agent;2026-10-18 11:00;;45;thin air");
        assert_eq!(zeilen[3], "2;\"Zitat \"\"x\"\"\";st;human;2026-10-18 08:00;2026-10-18 08:05;5;I0001 R00002");
        assert_eq!(zeilen.len(), 4);
    }
}
