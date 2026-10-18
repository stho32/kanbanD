//! Ortszeit für Zeiteinträge und Kommentare, in der Form der Dateien.

use crate::format::aufgabe::ZEITFORMAT;

/// Jetzt in Ortszeit als `JJJJ-MM-TT HH:MM`.
pub fn jetzt() -> String {
    chrono::Local::now().naive_local().format(ZEITFORMAT).to_string()
}
