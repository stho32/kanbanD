//! Durchläufe (R00094): eine Phase, die eine Karte durchlaufen hat, als Daten an der Karte — dazu ein Kommentar für Menschen.

use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Durchlauf, Ergebnis, Kommentar, Person};
use crate::uhr;
use serde::Deserialize;

/// Rumpf von `POST …/durchlaeufe`.
#[derive(Debug, Clone, Deserialize)]
pub struct NeuerDurchlauf {
    pub phase: String,
    pub ergebnis: String,
    pub dauer: Option<String>,
    pub text: Option<String>,
    pub wer: Option<String>,
}

/// „Entwicklung bestanden (entw, 1:43): Gate grün“ — Dauer und Text nur, wenn es sie gibt.
fn kommentartext(d: &Durchlauf) -> String {
    let wer = match d.dauer_minuten {
        Some(m) => format!("{}, {}", d.wer, uhr::hm(m)),
        None => d.wer.clone(),
    };
    let kopf = format!("{} {} ({wer})", d.phase, d.ergebnis.text());
    if d.text.is_empty() { kopf } else { format!("{kopf}: {}", d.text) }
}

impl Kanban {
    /// Trägt einen Durchlauf ein, jetzt mit Versatz, für `n.wer` oder die handelnde Person; Kommentar und Block in einem Commit.
    pub fn durchlauf_eintragen(&self, wer: &Person, nr: u32, n: &NeuerDurchlauf) -> Result<Aufgabe, Fehler> {
        let phase = n.phase.trim();
        if phase.is_empty() || phase.chars().count() > 40 || phase.contains('·') {
            return Err(Fehler::Ungueltig("Phase: 1–40 Zeichen, ohne ·".into()));
        }
        let ergebnis = Ergebnis::lesen(n.ergebnis.trim()).ok_or_else(|| Fehler::Ungueltig(format!("Ergebnis „{}“: bestanden, befund oder entfaellt", n.ergebnis)))?;
        let dauer_minuten = n.dauer.as_deref().map(|d| uhr::dauer_lesen(d).ok_or_else(|| Fehler::Ungueltig(format!("Dauer „{d}“: z. B. 0:45, 1,5 oder 90 min")))).transpose()?;
        let fuer = match n.wer.as_deref() {
            Some(k) => self.ordner().einstellungen()?.and_then(|e| e.person(k).cloned()).ok_or_else(|| Fehler::Ungueltig(format!("Person „{k}“ steht nicht in kanbanD.md")))?,
            None => wer.clone(),
        };
        // eine Zeile je Durchlauf: Umbrüche werden Leerzeichen
        let text = n.text.as_deref().unwrap_or_default().split_whitespace().collect::<Vec<_>>().join(" ");
        let jetzt = uhr::jetzt();
        let d = Durchlauf { zeitpunkt: jetzt.clone(), phase: phase.into(), ergebnis, wer: fuer.kuerzel.clone(), dauer_minuten, text };
        self.aufgabe_schreiben(wer, nr, |a| {
            a.kommentare.push(Kommentar { wer: wer.kuerzel.clone(), zeitpunkt: jetzt, text: kommentartext(&d) });
            let nachricht = format!("#{nr} Durchlauf: {} {} ({})", d.phase, d.ergebnis.text(), fuer.name);
            a.durchlaeufe.push(d);
            Ok(Some(nachricht))
        })
    }
}
