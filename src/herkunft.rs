//! Liest WBS und Anforderungen, auf die Aufgaben zeigen — rein, ohne Dateizugriff.

use crate::wbs::{WbsKnoten, WbsTabelle};

/// Zellen einer Tabellenzeile; `\\|` ist ein Strich im Text, kein Spaltentrenner (Grenzen wie beim Schreiben).
fn zellen(zeile: &str) -> Vec<String> {
    crate::wbs_datei::zellgrenzen(zeile).into_iter().map(|r| zeile[r].trim().replace("\\|", "|")).collect()
}

/// Die bekannten Spalten der Knotentabelle (`/planung`); andere bleiben als `weitere` erhalten.
const SPALTEN: [&str; 12] = ["ID", "Ebene", "Eltern", "Name", "Status", "Fertig-Kriterium", "Eingabe → Ausgabe", "Aufwand", "Ausbaustufe", "Braucht", "Requirement", "Notiz"];

/// Knoten aus der Knotentabelle einer WBS-Datei, in Dateireihenfolge; Spalten werden über die Kopfzeile zugeordnet.
pub fn wbs_tabelle(text: &str) -> WbsTabelle {
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
        let eltern = Some(feld("Eltern")).filter(|e| e != "—" && !e.is_empty()).unwrap_or_default();
        let weitere = k.iter().zip(z.iter()).filter(|(h, _)| !SPALTEN.contains(&h.as_str())).map(|(h, w)| (h.clone(), w.clone())).collect();
        knoten.push(WbsKnoten {
            id,
            zeile: i + 1,
            ebene: feld("Ebene"),
            eltern,
            name: feld("Name"),
            status: feld("Status"),
            fertig_kriterium: feld("Fertig-Kriterium"),
            eingabe_ausgabe: feld("Eingabe → Ausgabe"),
            aufwand: feld("Aufwand"),
            ausbaustufe: feld("Ausbaustufe"),
            braucht,
            requirement: feld("Requirement"),
            notiz: feld("Notiz"),
            weitere,
        });
    }
    WbsTabelle::aus(knoten)
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
    fn knoten_mit_allen_spalten_in_dateireihenfolge() {
        let t = wbs_tabelle(WBS);
        let k = t.alle();
        assert_eq!(k.iter().map(|x| x.id.as_str()).collect::<Vec<_>>(), vec!["A0001", "I0005", "I0007"]);
        assert_eq!((k[2].zeile, k[2].ebene.as_str(), k[2].eltern.as_str(), k[2].name.as_str(), k[2].status.as_str()), (9, "Interaction", "D0001", "Bewegen", "rot"));
        assert_eq!(k[2].braucht, vec!["I0005", "I0003"]);
        assert_eq!((k[1].requirement.as_str(), k[1].braucht.len()), ("R00005", 0));
        assert_eq!(k[0].eltern, "", "— heißt ohne Eltern");
        assert!(wbs_tabelle("| I0001 | ohne Kopf |").alle().is_empty());
    }

    #[test]
    fn zusaetzliche_spalte_stoert_nicht_und_bleibt_erhalten() {
        let text = "| ID | Ebene | Phase | Name | Status | Notiz | Eingabe → Ausgabe | Aufwand | Fertig-Kriterium |\n|---|---|---|---|---|---|---|---|---|\n| B0001 | Bubble | Abnahme | Lesen | gruen | n | a → b | 0,5-1 | Test gruen |\n";
        let t = wbs_tabelle(text);
        let k = &t.alle()[0];
        assert_eq!((k.name.as_str(), k.status.as_str(), k.notiz.as_str(), k.eingabe_ausgabe.as_str(), k.aufwand.as_str(), k.fertig_kriterium.as_str()), ("Lesen", "gruen", "n", "a → b", "0,5-1", "Test gruen"));
        assert_eq!(k.weitere, vec![("Phase".to_string(), "Abnahme".to_string())]);
        assert_eq!((k.eltern.as_str(), k.requirement.as_str()), ("", ""), "fehlende Spalten sind leer");
    }

    #[test]
    fn maskierter_strich_ist_text() {
        let text = "| ID | Name | Eingabe → Ausgabe | Status |\n|---|---|---|---|\n| B0001 | Ziehen | Spalte \\| Archiv → x | gruen |\n";
        let t = wbs_tabelle(text);
        let k = &t.alle()[0];
        assert_eq!((k.eingabe_ausgabe.as_str(), k.status.as_str()), ("Spalte | Archiv → x", "gruen"));
        assert_eq!(zellen("| a \\| b | c \\|"), vec!["a | b", "c |"]);
    }

    #[test]
    fn name_der_anforderung() {
        assert_eq!(anforderungsname("---\nid: R00014\n---\n\n# R00014: Timer starten\n"), "Timer starten");
        assert_eq!(anforderungsname("# Nur Titel"), "Nur Titel");
        assert_eq!(anforderungsname(""), "");
    }
}
