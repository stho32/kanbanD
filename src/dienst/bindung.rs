use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::modell::Person;

impl Kanban {
    /// Bindet das Board an die genannten registrierten Anwendungen; `[]` löst es (`applications: []`, reines Kanban, R00062).
    /// Schon nachgetragene Phasen-Spalten bleiben stehen. Unbekanntes Kürzel → 400, ohne Änderung kein Commit.
    pub fn bindung_setzen(&self, wer: &Person, slug: &str, kuerzel: &[String]) -> Result<bool, Fehler> {
        let register = self.ordner().einstellungen().ok().flatten().unwrap_or_default().quellen.anwendungen;
        let mut neu: Vec<String> = vec![];
        for k in kuerzel.iter().map(|k| k.trim()) {
            if !register.iter().any(|a| a.kuerzel == k) {
                return Err(Fehler::Ungueltig(format!("Anwendung „{k}“ ist nicht registriert")));
            }
            if !neu.iter().any(|n| n == k) {
                neu.push(k.to_string());
            }
        }
        let _sperre = self.gesperrt();
        let mut b = self.ordner().board(slug)?;
        if b.anwendungen.as_ref() == Some(&neu) {
            return Ok(false);
        }
        let text = format!("Anwendungen von „{}“: {}", b.titel, if neu.is_empty() { "keine".to_string() } else { neu.join(", ") });
        b.anwendungen = Some(neu);
        self.aktion(wer, &text, &[(board_pfad(&b.slug), self.board_text(&b, None)?)])?;
        Ok(true)
    }
}
