//! Liest WBS und Anforderungen, auf die Aufgaben zeigen — rein, ohne Dateizugriff.

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WbsKnoten {
    pub id: String,
    /// 1-basiert, für den Editor-Link
    pub zeile: usize,
    pub name: String,
    pub status: String,
    pub braucht: Vec<String>,
}

fn zellen(zeile: &str) -> Vec<String> {
    zeile.trim().trim_matches('|').split('|').map(|z| z.trim().to_string()).collect()
}

/// Knoten aus der Knotentabelle einer WBS-Datei; Spalten werden über die Kopfzeile zugeordnet.
pub fn wbs_knoten(text: &str) -> Vec<WbsKnoten> {
    let mut kopf: Option<Vec<String>> = None;
    let mut knoten = vec![];
    for (i, zeile) in text.lines().enumerate() {
        if !zeile.trim_start().starts_with('|') {
            continue;
        }
        let z = zellen(zeile);
        if z.first().map(String::as_str) == Some("ID") {
            kopf = Some(z);
            continue;
        }
        let Some(k) = &kopf else { continue };
        let id = z.first().cloned().unwrap_or_default();
        if !crate::modell::id_gueltig(&id) || id.starts_with('R') {
            continue;
        }
        let feld = |name: &str| k.iter().position(|h| h == name).and_then(|p| z.get(p)).cloned().unwrap_or_default();
        let braucht = feld("Braucht").split(',').map(str::trim).filter(|s| !s.is_empty()).map(String::from).collect();
        knoten.push(WbsKnoten { id, zeile: i + 1, name: feld("Name"), status: feld("Status"), braucht });
    }
    knoten
}

/// Name einer Anforderung aus ihrer ersten Überschrift (`# R00014: Timer` → `Timer`).
pub fn anforderungsname(text: &str) -> String {
    let h = text.lines().find_map(|z| z.strip_prefix("# ")).unwrap_or_default().trim();
    match h.split_once(": ") {
        Some((id, rest)) if id.starts_with('R') => rest.to_string(),
        _ => h.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WBS: &str = "---\nx: 1\n---\n\n| ID | Ebene | Eltern | Name | Status | Fertig-Kriterium | Eingabe → Ausgabe | Aufwand | Ausbaustufe | Braucht | Requirement | Notiz |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n| A0001 | Application | — | App | gelb | | | | | | | |\n| I0005 | Interaction | D0001 | Anlegen | gruen | | | | | | R00005 | |\n| I0007 | Interaction | D0001 | Bewegen | rot | | | | | I0005, I0003 | | |\n| R00001 | x | | | | | | | | | | |\n";

    #[test]
    fn knoten_mit_zeile_name_status_braucht() {
        let k = wbs_knoten(WBS);
        assert_eq!(k.len(), 3);
        assert_eq!(k[2], WbsKnoten { id: "I0007".into(), zeile: 9, name: "Bewegen".into(), status: "rot".into(), braucht: vec!["I0005".into(), "I0003".into()] });
        assert!(k[1].braucht.is_empty());
        assert!(wbs_knoten("| I0001 | ohne Kopf |").is_empty());
    }

    #[test]
    fn name_der_anforderung() {
        assert_eq!(anforderungsname("---\nid: R00014\n---\n\n# R00014: Timer starten\n"), "Timer starten");
        assert_eq!(anforderungsname("# Nur Titel"), "Nur Titel");
        assert_eq!(anforderungsname(""), "");
    }
}
