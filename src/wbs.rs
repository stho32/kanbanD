//! Die WBS einer Anwendung als Daten und ihre Rechnungen nach Skill `work-breakdown-structure` — rein, ohne Dateizugriff.

use serde::Serialize;

/// Eine Zeile der Knotentabelle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct WbsKnoten {
    pub id: String,
    pub ebene: String,
    /// leer bei der Application (`—`)
    pub eltern: String,
    pub name: String,
    /// wie in der Datei gesetzt
    pub status: String,
    pub fertig_kriterium: String,
    pub eingabe_ausgabe: String,
    pub aufwand: String,
    pub ausbaustufe: String,
    pub braucht: Vec<String>,
    pub requirement: String,
    pub notiz: String,
    /// 1-basiert, für den Editor-Link
    pub zeile: usize,
    /// Spalten, die `/planung` nicht kennt (z. B. `Phase`), in Dateireihenfolge — erhalten, nicht gedeutet
    #[serde(skip)]
    pub weitere: Vec<(String, String)>,
}

/// Alle Knoten einer WBS-Datei in Dateireihenfolge.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct WbsTabelle(Vec<WbsKnoten>);

impl WbsTabelle {
    pub fn aus(knoten: Vec<WbsKnoten>) -> WbsTabelle {
        WbsTabelle(knoten)
    }

    pub fn alle(&self) -> &[WbsKnoten] {
        &self.0
    }

    pub fn knoten(&self, id: &str) -> Option<&WbsKnoten> {
        self.0.iter().find(|k| k.id == id)
    }

    /// Kinder, die in Status, Fortschritt und erreichter Ebene zählen.
    pub fn kinder(&self, id: &str) -> Vec<&WbsKnoten> {
        self.0.iter().filter(|k| k.eltern == id && k.zaehlt()).collect()
    }

    /// Status nach Skill: ein Knoten ohne zählende Kinder trägt seinen Status selbst, sonst wird er aus den Kindern gerechnet.
    pub fn gerechneter_status(&self, id: &str) -> String {
        self.status_auf_pfad(id, &mut vec![])
    }

    /// `pfad` sind die Knoten über `id` — ein Zyklus in `Eltern` endet beim gesetzten Status statt endlos.
    fn status_auf_pfad<'a>(&'a self, id: &'a str, pfad: &mut Vec<&'a str>) -> String {
        let gesetzt = self.knoten(id).map(|k| k.status.clone()).unwrap_or_default();
        let kinder = self.kinder(id);
        if kinder.is_empty() || pfad.contains(&id) {
            return gesetzt;
        }
        pfad.push(id);
        let stati: Vec<String> = kinder.iter().map(|k| self.status_auf_pfad(&k.id, pfad)).filter(|s| s != "bestehend").collect();
        pfad.pop();
        ampel(&stati).to_string()
    }
}

impl WbsKnoten {
    /// `option`, `ausbau` und `verworfen` zählen weder in Zähler noch Nenner.
    pub fn zaehlt(&self) -> bool {
        !matches!(self.status.as_str(), "option" | "ausbau" | "verworfen")
    }
}

/// Alle grün (oder keine) → gruen; ein gelbes oder gemischt grün/rot → gelb; sonst rot.
fn ampel(stati: &[String]) -> &'static str {
    let hat = |s: &str| stati.iter().any(|x| x == s);
    if stati.iter().all(|s| s == "gruen") {
        "gruen"
    } else if hat("gelb") || (hat("gruen") && hat("rot")) {
        "gelb"
    } else {
        "rot"
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;

    /// Knoten aus `(id, ebene, eltern, status)`.
    pub(crate) fn baum(zeilen: &[(&str, &str, &str, &str)]) -> WbsTabelle {
        WbsTabelle::aus(
            zeilen
                .iter()
                .enumerate()
                .map(|(i, (id, ebene, eltern, status))| WbsKnoten {
                    id: id.to_string(),
                    ebene: ebene.to_string(),
                    eltern: eltern.to_string(),
                    name: format!("Name {id}"),
                    status: status.to_string(),
                    fertig_kriterium: String::new(),
                    eingabe_ausgabe: String::new(),
                    aufwand: String::new(),
                    ausbaustufe: String::new(),
                    braucht: vec![],
                    requirement: String::new(),
                    notiz: String::new(),
                    zeile: i + 1,
                    weitere: vec![],
                })
                .collect(),
        )
    }

    #[test]
    fn interaction_mit_gruenem_und_rotem_feature_ist_gelb_auch_wenn_die_datei_gruen_sagt() {
        let t = baum(&[("A0001", "Application", "", "gruen"), ("D0001", "Dialog", "A0001", "gruen"), ("I0001", "Interaction", "D0001", "gruen"), ("F0001", "Feature", "I0001", "gruen"), ("F0002", "Feature", "I0001", "rot")]);
        assert_eq!(t.gerechneter_status("I0001"), "gelb");
        assert_eq!(t.knoten("I0001").unwrap().status, "gruen", "die Datei bleibt, wie sie ist");
        assert_eq!(t.gerechneter_status("A0001"), "gelb", "über drei Ebenen");
        assert_eq!(t.gerechneter_status("F0002"), "rot", "ein Blatt trägt seinen Status selbst");
    }

    #[test]
    fn ampel_regeln_nach_skill() {
        let mit = |kinder: &[&str]| {
            let mut z = vec![("I0001", "Interaction", "", "rot")];
            let ids = ["B0001", "B0002", "B0003"];
            z.extend(kinder.iter().zip(ids).map(|(s, id)| (id, "Bubble", "I0001", *s)));
            baum(&z).gerechneter_status("I0001")
        };
        assert_eq!(mit(&["gruen", "gruen"]), "gruen");
        assert_eq!(mit(&["gruen", "bestehend"]), "gruen", "bestehend zählt wie gruen");
        assert_eq!(mit(&["bestehend", "bestehend"]), "gruen");
        assert_eq!(mit(&["rot", "gelb"]), "gelb");
        assert_eq!(mit(&["gruen", "rot"]), "gelb");
        assert_eq!(mit(&["rot", "rot"]), "rot");
        assert_eq!(mit(&["rot", "bestehend"]), "rot");
        assert_eq!(mit(&["gruen", "verworfen", "option"]), "gruen", "option und verworfen zählen nicht");
        assert_eq!(mit(&["option", "ausbau"]), "rot", "ohne zählende Kinder gilt der eigene Status");
    }

    #[test]
    fn zyklus_in_eltern_endet() {
        let t = baum(&[("I0001", "Interaction", "I0002", "rot"), ("I0002", "Interaction", "I0001", "gruen")]);
        assert_eq!(t.gerechneter_status("I0001"), "rot", "beim Wiedersehen gilt der gesetzte Status von I0001");
    }
}
