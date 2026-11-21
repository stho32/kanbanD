//! Warnungen einer Aktion und Hinweise eines Boards — rein, ohne Dateizugriff. Sie warnen, sie sperren nicht.
//! Die Plausibilität `column-checks` (R00059) ist mit R00222 entfallen (ADR-0034 Regel 4); geblieben sind die Warnung
//! der WIP-Grenze und die Hinweise zu unbekannten Eigentümern (R00097, R00120).

use crate::format::yaml;
use crate::modell::Board;
use serde::Serialize;

/// Eine Warnung, wie die Antwort einer Aktion sie nennt (heute nur `grenze`: die WIP-Grenze einer Spalte ist erreicht).
/// `knoten` und `details` bleiben als leere Listen in der Antwort, damit ältere Leser dieselbe Form bekommen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Warnung {
    pub pruefung: String,
    pub text: String,
    pub knoten: Vec<String>,
    pub details: Vec<String>,
}

/// Je unbekanntem Eigentümer (R00097) und je verwaistem oder ungültigem `column-owner`-Eintrag (R00120) ein Hinweis;
/// die Datei bleibt lesbar und schreibbar.
pub fn unbekannte(board: &Board) -> Vec<String> {
    // Karte #142 Nacharbeit B2: ein Wert, der den Menschen meint, sperrt — der Hinweis sagt das, statt ihn als
    // bloß „unbekannt“ stehen zu lassen; ein Wert, der ihn nicht nennt (`chef`), behält den Wortlaut aus R00120 AK 5.
    let eigentuemer = board.spalten.iter().filter_map(|s| s.eigentuemer_unbekannt.as_ref().map(|e| {
        let sperre = if crate::modell::meint_human_wert(e) { " — meint den Menschen, sperrt Agenten fail-safe" } else { "" };
        format!("Spalte „{}“: unbekannter Eigentümer „{e}“ — bekannt sind human, agent{sperre}", s.name)
    }));
    let roh = board.eigentuemer_roh.iter().map(|e| {
        let wert = yaml::anzeige(&e.wert);
        let sperre = if e.meint_human() { " — meint den Menschen, sperrt Agenten fail-safe über das ganze Board" } else { "" };
        match &e.schluessel {
            None => format!("column-owner ist keine Zuordnung — „{wert}“ bleibt erhalten{sperre}"),
            Some(k) if board.spalten.iter().any(|s| &s.name == k) => format!("column-owner: „{k}“ hat keinen Textwert — „{k}: {wert}“ bleibt erhalten{sperre}"),
            Some(k) => format!("column-owner: „{k}: {wert}“ passt auf keine Spalte — der Eintrag bleibt erhalten{sperre}"),
        }
    });
    eigentuemer.chain(roh).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::Spalte;

    // Karte #142 Nacharbeit B2: der Hinweis für einen Wert, der den Menschen meint, nennt die fail-safe Sperre.
    #[test]
    fn unbekannter_eigentuemer_der_den_menschen_meint_nennt_die_sperre() {
        let spalte = |name: &str, roh: &str| Spalte { eigentuemer_unbekannt: Some(roh.into()), name: name.into(), ..Default::default() };
        let b = Board { slug: "b".into(), titel: "B".into(), spalten: vec![spalte("Eingang", "Human"), spalte("Erledigt", "chef")], termine: vec![], anwendungen: None, klassen: None, start: None, fieber: Default::default(), berichtsfilter: Default::default(), bestand: None, eigentuemer_roh: vec![], archiviert: None, transkripte_erfassen: None };
        assert_eq!(
            unbekannte(&b),
            [
                "Spalte „Eingang“: unbekannter Eigentümer „Human“ — bekannt sind human, agent — meint den Menschen, sperrt Agenten fail-safe",
                "Spalte „Erledigt“: unbekannter Eigentümer „chef“ — bekannt sind human, agent",
            ]
        );
    }

    #[test]
    fn unbekannter_eigentuemer_wird_je_spalte_genannt() {
        let spalte = |name: &str, roh: Option<&str>| Spalte { eigentuemer_unbekannt: roh.map(Into::into), name: name.into(), grenze: None, aufgaben: vec![], ..Default::default() };
        let b = Board { slug: "b".into(), titel: "B".into(), spalten: vec![spalte("Eingang", Some("chef")), spalte("Erledigt", None)], termine: vec![], anwendungen: None, klassen: None, start: None, fieber: Default::default(), berichtsfilter: Default::default(), bestand: None, eigentuemer_roh: vec![], archiviert: None, transkripte_erfassen: None };
        assert_eq!(unbekannte(&b), ["Spalte „Eingang“: unbekannter Eigentümer „chef“ — bekannt sind human, agent"]);
    }

    // R00120 AK 5 und US-1: je verwaistem oder ungültigem Eintrag ein Hinweis
    #[test]
    fn verwaiste_und_ungueltige_column_owner_werden_gemeldet() {
        let spalte = |name: &str| Spalte { name: name.into(), grenze: None, aufgaben: vec![], ..Default::default() };
        let b = Board {
            slug: "b".into(),
            titel: "B".into(),
            spalten: vec![spalte("Eingang"), spalte("Erledigt")],
            termine: vec![],
            anwendungen: None, klassen: None,
            start: None,
            fieber: Default::default(),
            berichtsfilter: Default::default(),
            bestand: None,
            eigentuemer_roh: vec![
                crate::modell::ColumnOwnerEintrag { schluessel: Some("eingang".into()), wert: "human".into() },
                crate::modell::ColumnOwnerEintrag { schluessel: Some("Eingang".into()), wert: serde_yaml::Value::Sequence(vec!["human".into()]) },
                crate::modell::ColumnOwnerEintrag { schluessel: None, wert: "human".into() },
            ],
            archiviert: None,
            transkripte_erfassen: None,
        };
        assert_eq!(
            unbekannte(&b),
            [
                "column-owner: „eingang: human“ passt auf keine Spalte — der Eintrag bleibt erhalten — meint den Menschen, sperrt Agenten fail-safe über das ganze Board",
                "column-owner: „Eingang“ hat keinen Textwert — „Eingang: [human]“ bleibt erhalten — meint den Menschen, sperrt Agenten fail-safe über das ganze Board",
                "column-owner ist keine Zuordnung — „human“ bleibt erhalten — meint den Menschen, sperrt Agenten fail-safe über das ganze Board",
            ]
        );
    }
}
