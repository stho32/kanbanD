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

    /// Wie tief ein Ast geplant ist: ohne zählende Kinder die eigene Ebene (Interaction mit Notiz
    /// `kein Feature noetig`: Feature), sonst das Minimum über die erreichten Ebenen der Kinder.
    pub fn erreichte_ebene(&self, id: &str) -> String {
        EBENEN[self.rang_auf_pfad(id, &mut vec![])].to_string()
    }

    fn rang_auf_pfad<'a>(&'a self, id: &'a str, pfad: &mut Vec<&'a str>) -> usize {
        let Some(k) = self.knoten(id) else { return 0 };
        let kinder = self.kinder(id);
        if kinder.is_empty() || pfad.contains(&id) {
            let ohne_feature = k.ebene == "Interaction" && (k.notiz.contains("kein Feature noetig") || k.notiz.contains("kein Feature nötig"));
            return if ohne_feature { rang("Feature") } else { rang(&k.ebene) };
        }
        pfad.push(id);
        let tiefste = kinder.iter().map(|c| self.rang_auf_pfad(&c.id, pfad)).min().unwrap_or(0);
        pfad.pop();
        tiefste
    }
}

/// Der Stand des Ganzen über die Slice-Liste, dazu woran gerade gearbeitet wird.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Stand {
    /// zählende Slices je gerechnetem Status; `gelb` zählt voll in den Rest
    pub gruen: usize,
    pub gelb: usize,
    pub rot: usize,
    /// alle zählenden Slices (ohne `option`, `ausbau`, `verworfen`, `bestehend`)
    pub slices: usize,
    /// oberstes gelbes Blatt in Tabellenreihenfolge, sonst das erste rote
    pub aktiv: Option<String>,
    /// von der Application bis zum aktiven Knoten
    pub pfad: Vec<String>,
    /// die gelben Blätter in Tabellenreihenfolge
    pub laufend: Vec<String>,
}

impl WbsTabelle {
    /// Ein Slice ist ein Blatt der Steuerungsebene: Feature, oder Interaction ohne zählende Features.
    pub fn ist_slice(&self, k: &WbsKnoten) -> bool {
        k.zaehlt() && (k.ebene == "Feature" || (k.ebene == "Interaction" && !self.kinder(&k.id).iter().any(|c| c.ebene == "Feature")))
    }

    /// Die zählenden Slices in Tabellenreihenfolge.
    pub fn slices(&self) -> Vec<&WbsKnoten> {
        self.0.iter().filter(|k| self.ist_slice(k) && k.status != "bestehend").collect()
    }

    fn blaetter_mit(&self, status: &str) -> Vec<&WbsKnoten> {
        self.0.iter().filter(|k| k.zaehlt() && k.status == status && self.kinder(&k.id).is_empty()).collect()
    }

    /// Von der Application bis `id`; ein Zyklus in `Eltern` bricht ab.
    pub fn pfad(&self, id: &str) -> Vec<String> {
        let mut pfad = vec![];
        let mut jetzt = self.knoten(id);
        while let Some(k) = jetzt.filter(|k| !pfad.contains(&k.id)) {
            pfad.push(k.id.clone());
            jetzt = self.knoten(&k.eltern);
        }
        pfad.reverse();
        pfad
    }
}

pub fn stand(t: &WbsTabelle) -> Stand {
    let stati: Vec<String> = t.slices().iter().map(|s| t.gerechneter_status(&s.id)).collect();
    let anzahl = |s: &str| stati.iter().filter(|x| *x == s).count();
    let laufend: Vec<String> = t.blaetter_mit("gelb").iter().map(|k| k.id.clone()).collect();
    let aktiv = laufend.first().cloned().or_else(|| t.blaetter_mit("rot").first().map(|k| k.id.clone()));
    Stand {
        gruen: anzahl("gruen"),
        gelb: anzahl("gelb"),
        rot: stati.len() - anzahl("gruen") - anzahl("gelb"),
        slices: stati.len(),
        pfad: aktiv.as_deref().map(|a| t.pfad(a)).unwrap_or_default(),
        aktiv,
        laufend,
    }
}

/// Die Ebenen in Planungsreihenfolge.
const EBENEN: [&str; 5] = ["Application", "Dialog", "Interaction", "Feature", "Bubble"];

fn rang(ebene: &str) -> usize {
    EBENEN.iter().position(|e| *e == ebene).unwrap_or(0)
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

    /// Mini-Baum aus `references/erreichte-ebene-beispiel.md` („Vorher“).
    fn c64_clock() -> Vec<(&'static str, &'static str, &'static str, &'static str)> {
        vec![
            ("A0001", "Application", "", "gelb"),
            ("D0001", "Dialog", "A0001", "gelb"),
            ("I0001", "Interaction", "D0001", "gelb"),
            ("B0001", "Bubble", "I0001", "gruen"),
            ("B0002", "Bubble", "I0001", "bestehend"),
            ("I0002", "Interaction", "D0001", "rot"),
            ("D0002", "Dialog", "A0001", "rot"),
            ("I0003", "Interaction", "D0002", "rot"),
            ("I0004", "Interaction", "D0002", "option"),
        ]
    }

    fn erreicht(t: &WbsTabelle) -> Vec<String> {
        ["B0001", "B0002", "I0001", "I0002", "D0001", "I0003", "D0002", "A0001"].iter().map(|id| format!("{id} {}", t.erreichte_ebene(id))).collect()
    }

    #[test]
    fn erreichte_ebene_wie_im_rechenbeispiel_vorher() {
        let mut t = baum(&c64_clock());
        t.0[2].notiz = "kein Feature noetig".into(); // mit Kindern gilt die Notiz nicht
        assert_eq!(erreicht(&t), ["B0001 Bubble", "B0002 Bubble", "I0001 Bubble", "I0002 Interaction", "D0001 Interaction", "I0003 Interaction", "D0002 Interaction", "A0001 Interaction"]);
    }

    #[test]
    fn erreichte_ebene_wie_im_rechenbeispiel_nachher() {
        let mut z = c64_clock();
        z.extend([("F0001", "Feature", "I0002", "rot"), ("B0003", "Bubble", "F0001", "rot"), ("B0004", "Bubble", "F0001", "rot"), ("F0002", "Feature", "I0002", "rot"), ("B0005", "Bubble", "F0002", "rot")]);
        let t = baum(&z);
        assert_eq!(erreicht(&t), ["B0001 Bubble", "B0002 Bubble", "I0001 Bubble", "I0002 Bubble", "D0001 Bubble", "I0003 Interaction", "D0002 Interaction", "A0001 Interaction"]);
        assert_eq!(t.erreichte_ebene("F0001"), "Bubble");
    }

    #[test]
    fn interaction_ohne_kinder_mit_notiz_erreicht_feature() {
        let mut t = baum(&[("I0001", "Interaction", "", "rot"), ("I0002", "Interaction", "", "rot")]);
        t.0[0].notiz = "kein Feature nötig".into();
        assert_eq!((t.erreichte_ebene("I0001").as_str(), t.erreichte_ebene("I0002").as_str()), ("Feature", "Interaction"));
    }

    #[test]
    fn stand_ueber_vier_zaehlende_slices_ohne_option() {
        let t = baum(&[
            ("A0001", "Application", "", "gelb"),
            ("D0001", "Dialog", "A0001", "gelb"),
            ("I0001", "Interaction", "D0001", "gelb"),
            ("F0001", "Feature", "I0001", "gruen"),
            ("F0002", "Feature", "I0001", "gelb"),
            ("F0003", "Feature", "I0001", "option"),
            ("I0002", "Interaction", "D0001", "gruen"),
            ("B0001", "Bubble", "I0002", "gruen"),
            ("I0003", "Interaction", "D0001", "rot"),
            ("I0004", "Interaction", "D0001", "verworfen"),
            ("I0005", "Interaction", "D0001", "bestehend"),
            ("I0006", "Interaction", "D0001", "rot"),
            ("F0004", "Feature", "I0006", "ausbau"),
        ]);
        let s = stand(&t);
        assert_eq!(t.slices().iter().map(|k| k.id.as_str()).collect::<Vec<_>>(), ["F0001", "F0002", "I0002", "I0003", "I0006"]);
        assert_eq!((s.gruen, s.gelb, s.rot, s.slices), (2, 1, 2, 5));
        let ohne_i0006 = WbsTabelle::aus(t.alle().iter().filter(|k| k.id != "I0006" && k.id != "F0004").cloned().collect());
        let s = stand(&ohne_i0006);
        assert_eq!((s.gruen, s.gelb, s.rot, s.slices), (2, 1, 1, 4), "50 % · 25 % · 25 %");
    }

    #[test]
    fn slice_status_ist_gerechnet() {
        let t = baum(&[("I0001", "Interaction", "", "gruen"), ("B0001", "Bubble", "I0001", "gruen"), ("B0002", "Bubble", "I0001", "rot")]);
        assert_eq!((stand(&t).gruen, stand(&t).gelb), (0, 1));
    }

    #[test]
    fn aktiver_knoten_oberstes_gelbes_blatt_sonst_erstes_rotes() {
        let t = baum(&[("A0001", "Application", "", "gelb"), ("D0001", "Dialog", "A0001", "gelb"), ("I0001", "Interaction", "D0001", "gelb"), ("B0001", "Bubble", "I0001", "rot"), ("B0002", "Bubble", "I0001", "gelb"), ("B0003", "Bubble", "I0001", "gelb"), ("I0002", "Interaction", "D0001", "rot")]);
        let s = stand(&t);
        assert_eq!((s.aktiv.as_deref(), s.pfad.clone(), s.laufend.clone()), (Some("B0002"), vec!["A0001".to_string(), "D0001".into(), "I0001".into(), "B0002".into()], vec!["B0002".to_string(), "B0003".into()]));
        let nichts_gelb = baum(&[("D0001", "Dialog", "", "rot"), ("I0001", "Interaction", "D0001", "option"), ("I0002", "Interaction", "D0001", "rot")]);
        assert_eq!(stand(&nichts_gelb).aktiv.as_deref(), Some("I0002"), "option ist kein Blatt, das zählt");
        assert_eq!(stand(&baum(&[("I0001", "Interaction", "", "gruen")])).aktiv, None);
        assert!(stand(&WbsTabelle::default()).pfad.is_empty());
    }

    #[test]
    fn zyklus_in_eltern_endet() {
        let t = baum(&[("I0001", "Interaction", "I0002", "rot"), ("I0002", "Interaction", "I0001", "gruen")]);
        assert_eq!(t.gerechneter_status("I0001"), "rot", "beim Wiedersehen gilt der gesetzte Status von I0001");
    }
}
