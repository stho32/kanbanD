//! Ein Eintrag der Commit-Liste einer Karte (R00204, ADR-0032 N1.2): der Verweis wörtlich, sein Zustand und — soweit
//! lesbar — Anwendung, Hash, Zweige und Metadaten. Zustände werden nie gespeichert, nur bei jedem Lesen gerechnet.

use serde::Serialize;

/// Längster Titel in Unicode-Zeichen; ist die erste Zeile länger, folgt „…“ (Entscheidung des PO, R00204 AK 17).
pub const TITEL_HOECHSTENS: usize = 500;

/// Zustand eines Verweises (ADR-0032 N1.2), geprüft in der Reihenfolge der Varianten.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum Zustand {
    Unlesbar,
    AnwendungUnbekannt,
    RepositoryFehlt,
    Fehlt,
    AufZweig,
    Verwaist,
}

/// Ein Eintrag der Antwort von `GET …/commits`; Felder, die zum Zustand nicht passen, fehlen (nie `null`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Commiteintrag {
    /// wörtlich wie in der Datei
    pub verweis: String,
    /// Kürzel der Anwendung, leerer Text für die Standardanwendung
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anwendung: Option<String>,
    /// voll und kleingeschrieben, wenn der Commit gefunden ist; sonst wie im Verweis, kleingeschrieben
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hash: Option<String>,
    pub zustand: Zustand,
    /// bei `unlesbar` und `repository_fehlt`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grund: Option<String>,
    /// bei `auf_zweig`: lokale Zweige ohne `refs/heads/`, höchstens 10, alphabetisch
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zweige: Option<Vec<String>>,
    /// bei `auf_zweig`: entfernte Zweige ohne `refs/remotes/` und ohne `*/HEAD`, höchstens 10, alphabetisch
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entfernte_zweige: Option<Vec<String>>,
    /// bei `auf_zweig`, nur wenn > 0: wie viele Zweige beide Listen zusammen nicht nennen
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zweige_weitere: Option<usize>,
    /// bei `auf_zweig` und `verwaist`: erste Zeile der Nachricht, höchstens 500 Zeichen, sonst gekürzt mit „…“
    #[serde(skip_serializing_if = "Option::is_none")]
    pub titel: Option<String>,
    /// nur der Name, nie die E-Mail-Adresse
    #[serde(skip_serializing_if = "Option::is_none")]
    pub autor: Option<String>,
    /// Commit-Datum, ISO 8601 mit der Zeitzone des Commits
    #[serde(skip_serializing_if = "Option::is_none")]
    pub datum: Option<String>,
    /// hinzugefügte Zeilen gegen den ersten Elternteil (Wurzel: gegen den leeren Baum)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plus: Option<u64>,
    /// entfernte Zeilen
    #[serde(skip_serializing_if = "Option::is_none")]
    pub minus: Option<u64>,
    /// berührte Dateien, Binärdateien eingeschlossen
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dateien: Option<u64>,
}

impl Commiteintrag {
    /// Ein Eintrag nur mit Verweis und Zustand; die übrigen Felder setzt der Aufrufer.
    pub fn neu(verweis: &str, zustand: Zustand) -> Commiteintrag {
        Commiteintrag { verweis: verweis.into(), anwendung: None, hash: None, zustand, grund: None, zweige: None, entfernte_zweige: None, zweige_weitere: None, titel: None, autor: None, datum: None, plus: None, minus: None, dateien: None }
    }
}

/// Die erste Zeile auf höchstens [`TITEL_HOECHSTENS`] Unicode-Zeichen: länger → die ersten 500 und „…“; nie mitten im Zeichen.
pub fn titel_kuerzen(erste_zeile: &str) -> String {
    match erste_zeile.char_indices().nth(TITEL_HOECHSTENS) {
        Some((ende, _)) => format!("{}…", &erste_zeile[..ende]),
        None => erste_zeile.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // R00204 AK 17: gezählt in Unicode-Zeichen, nicht in Bytes oder UTF-16-Einheiten
    #[test]
    fn titel_hoechstens_500_zeichen() {
        let a = |n: usize| "a".repeat(n);
        assert_eq!(titel_kuerzen(&a(600)), format!("{}…", a(500)));
        assert_eq!(titel_kuerzen(&a(600)).chars().count(), 501);
        assert_eq!(titel_kuerzen(&a(500)), a(500), "genau 500 bleibt");
        assert_eq!(titel_kuerzen(&a(501)), format!("{}…", a(500)));
        assert_eq!(titel_kuerzen(&"ä".repeat(600)), format!("{}…", "ä".repeat(500)), "nach Zeichen, nicht nach Bytes (das wären 250)");
        let emoji = format!("{}\u{1F600}", a(499));
        assert_eq!(titel_kuerzen(&emoji), emoji, "das Emoji an Stelle 500 bleibt ganz");
        assert_eq!(titel_kuerzen(&format!("{emoji}xyz")), format!("{emoji}…"), "499 × a, das ganze Emoji, …");
        assert_eq!(titel_kuerzen(""), "");
    }

    // ADR-0032 N1.2: Zustände in snake_case, Felder ohne Wert fehlen (nie null)
    #[test]
    fn antwortform() {
        let mut e = Commiteintrag::neu("kd:abc", Zustand::AufZweig);
        e.anwendung = Some(String::new());
        e.zweige = Some(vec![]);
        assert_eq!(serde_json::to_value(&e).unwrap(), serde_json::json!({"verweis": "kd:abc", "anwendung": "", "zustand": "auf_zweig", "zweige": []}));
        for (z, text) in [(Zustand::Unlesbar, "unlesbar"), (Zustand::AnwendungUnbekannt, "anwendung_unbekannt"), (Zustand::RepositoryFehlt, "repository_fehlt"), (Zustand::Fehlt, "fehlt"), (Zustand::Verwaist, "verwaist")] {
            assert_eq!(serde_json::to_value(z).unwrap(), serde_json::json!(text));
        }
    }
}
