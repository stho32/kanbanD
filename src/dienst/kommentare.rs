use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Kommentar, Person};
use crate::uhr;

impl Kanban {
    pub fn kommentieren(&self, wer: &Person, nr: u32, text: &str) -> Result<Aufgabe, Fehler> {
        let text = text.trim().replace("\r\n", "\n");
        if text.is_empty() {
            return Err(Fehler::Ungueltig("Der Kommentar ist leer".into()));
        }
        let kurz: String = text.replace('\n', " ").chars().take(50).collect();
        self.aufgabe_schreiben(wer, nr, |a| {
            kommentiert(a, wer, &text);
            Ok(Some(format!("#{nr} kommentiert: {kurz}")))
        })
    }
}

/// Kommentar-Kern (ADR-0005): ohne Sperre und ohne Commit; `text` ist schon geprüft.
pub(super) fn kommentiert(a: &mut Aufgabe, wer: &Person, text: &str) {
    a.kommentare.push(Kommentar { wer: wer.kuerzel.clone(), zeitpunkt: uhr::jetzt(), text: text.to_string() });
}

#[cfg(test)]
mod tests {
    use super::kommentiert;
    use crate::modell::{Art, Aufgabe, Kommentar, Person};

    // R00098 B0322: Kommentar-Kern ohne Sperre und Commit
    #[test]
    fn kommentar_kern() {
        let mut a = Aufgabe::neu(7, "0007-x.md".into(), "x".into());
        a.kommentare.push(Kommentar { wer: "st".into(), zeitpunkt: "2026-11-01T10:00".into(), text: "früher".into() });
        let cl = Person { kuerzel: "cl".into(), name: "Claude".into(), art: Art::Agent, aktiv: true };
        kommentiert(&mut a, &cl, "Erneut gefunden (Schlüssel „k4“)");
        assert_eq!(a.kommentare.len(), 2);
        assert_eq!((a.kommentare[0].text.as_str(), a.kommentare[1].wer.as_str(), a.kommentare[1].text.as_str()), ("früher", "cl", "Erneut gefunden (Schlüssel „k4“)"));
        assert!(!a.kommentare[1].zeitpunkt.is_empty());
    }
}
