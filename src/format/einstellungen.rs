//! `kanbanD.md` — Personen, Klassen und Quellpfade des Ordners.

use super::{Formatfehler, frontmatter, yaml};
use crate::modell::{Anwendung, Art, Einstellungen, Klasse, Person, Quellen, Signal};

pub const DATEI: &str = "kanbanD.md";

pub fn lesen(text: &str) -> Result<Einstellungen, Formatfehler> {
    let (y, _) = frontmatter::trennen(text)?;
    let m = yaml::lesen(y)?;
    let mut e = Einstellungen::default();
    if let Some(people) = yaml::zuordnung(&m, "people") {
        for (k, v) in people {
            let kuerzel = yaml::wert_als_text(k).ok_or_else(|| Formatfehler("Kürzel unter people ist kein Text".into()))?;
            let p = v.as_mapping().ok_or_else(|| Formatfehler(format!("people.{kuerzel} ist keine Zuordnung")))?;
            let art = match yaml::text(p, "kind").as_deref() {
                Some("agent") => Art::Agent,
                Some("human") | None => Art::Mensch,
                Some(x) => return Err(Formatfehler(format!("people.{kuerzel}.kind „{x}“ ist weder human noch agent"))),
            };
            let aktiv = !matches!(p.get("active"), Some(serde_yaml::Value::Bool(false)));
            e.personen.push(Person { name: yaml::text(p, "name").unwrap_or_else(|| kuerzel.clone()), kuerzel, art, aktiv });
        }
    }
    e.klassen = klassen_lesen(&m)?.unwrap_or_default();
    e.transkripte_erfassen = super::board::schalter_lesen(&m)?;
    if let Some(signals) = yaml::zuordnung(&m, "signals") {
        for (k, v) in signals {
            let schluessel = yaml::wert_als_text(k).ok_or_else(|| Formatfehler("Schlüssel unter signals ist kein Text".into()))?;
            let c = v.as_mapping().ok_or_else(|| Formatfehler(format!("signals.{schluessel} ist keine Zuordnung")))?;
            e.signale.push(Signal { bezeichnung: yaml::text(c, "label").unwrap_or_else(|| schluessel.clone()), farbe: yaml::text(c, "color").unwrap_or_else(|| "grey".into()), schluessel });
        }
    }
    if let Some(s) = yaml::zuordnung(&m, "sources") {
        e.quellen = Quellen {
            repository: yaml::text(s, "repository").unwrap_or_default(),
            wbs: yaml::text(s, "wbs").unwrap_or_default(),
            anforderungen: yaml::text(s, "requirements").unwrap_or_default(),
            anwendungen: anwendungen_lesen(s)?,
        };
    }
    Ok(e)
}

/// `classes` aus dem Frontmatter von `kanbanD.md` oder einer Board-Datei (ADR-0031 Regel 1): je Schlüssel
/// `{label, color}` in Dateireihenfolge. `None` = der Schlüssel fehlt oder trägt keine Zuordnung, `Some([])` = `classes: {}`.
pub(crate) fn klassen_lesen(m: &serde_yaml::Mapping) -> Result<Option<Vec<Klasse>>, Formatfehler> {
    let Some(classes) = yaml::zuordnung(m, "classes") else { return Ok(None) };
    let mut klassen = vec![];
    for (k, v) in classes {
        let schluessel = yaml::wert_als_text(k).ok_or_else(|| Formatfehler("Schlüssel unter classes ist kein Text".into()))?;
        let c = v.as_mapping().ok_or_else(|| Formatfehler(format!("classes.{schluessel} ist keine Zuordnung")))?;
        klassen.push(Klasse {
            bezeichnung: yaml::text(c, "label").unwrap_or_else(|| schluessel.clone()),
            farbe: yaml::text(c, "color").unwrap_or_else(|| "grey".into()),
            schluessel,
        });
    }
    Ok(Some(klassen))
}

/// Der Abschnitt `classes:` ohne Zeilenende, für beide Dateien gleich; ein leerer Satz ist `classes: {}`.
pub(crate) fn klassen_schreiben(klassen: &[Klasse]) -> String {
    let mut s = String::from("classes:");
    if klassen.is_empty() {
        s.push_str(" {}");
    }
    for k in klassen {
        s.push_str(&format!("\n  {}: {{label: {}, color: {}}}", yaml::skalar(&k.schluessel), yaml::skalar(&k.bezeichnung), yaml::skalar(&k.farbe)));
    }
    s
}

/// `sources.applications` — je Kürzel `{name, repository, wbs, requirements}`, jeder Pfad darf fehlen; nach Kürzel sortiert.
/// Pfade werden nicht geprüft: ein fehlender Pfad macht die Anwendung unerreichbar, nicht die Datei defekt.
fn anwendungen_lesen(quellen: &serde_yaml::Mapping) -> Result<Vec<Anwendung>, Formatfehler> {
    let Some(register) = yaml::zuordnung(quellen, "applications") else { return Ok(vec![]) };
    let mut anwendungen = register
        .iter()
        .map(|(k, v)| {
            let kuerzel = yaml::wert_als_text(k).ok_or_else(|| Formatfehler("Kürzel unter sources.applications ist kein Text".into()))?;
            let a = v.as_mapping().ok_or_else(|| Formatfehler(format!("sources.applications.{kuerzel} ist keine Zuordnung")))?;
            Ok(Anwendung {
                name: yaml::text(a, "name").unwrap_or_else(|| kuerzel.clone()),
                repository: yaml::text(a, "repository").unwrap_or_default(),
                wbs: yaml::text(a, "wbs").unwrap_or_default(),
                anforderungen: yaml::text(a, "requirements").unwrap_or_default(),
                kuerzel,
            })
        })
        .collect::<Result<Vec<_>, Formatfehler>>()?;
    anwendungen.sort_by(|a, b| a.kuerzel.cmp(&b.kuerzel));
    Ok(anwendungen)
}

fn anwendungen_schreiben(anwendungen: &[Anwendung]) -> String {
    if anwendungen.is_empty() {
        return String::new();
    }
    let mut sortiert: Vec<&Anwendung> = anwendungen.iter().collect();
    sortiert.sort_by(|a, b| a.kuerzel.cmp(&b.kuerzel));
    let mut s = String::from("\n  applications:");
    for a in sortiert {
        s.push_str(&format!("\n    {}: {{name: {}, {}}}", yaml::skalar(&a.kuerzel), yaml::skalar(&a.name), pfad(&a.repository)));
    }
    s
}

/// Der Pfad einer Anwendung, wie er in der Datei steht (ADR-0034 N2 Regel 4): nur `repository` — der Lese-Rückfall wird
/// nie geschrieben.
fn pfad(repository: &str) -> String {
    format!("repository: {}", yaml::skalar(repository))
}

/// Der Abschnitt `people:` ohne Zeilenende in Normalform (ADR-0043 Regel 2); ein leerer Satz ist `people: {}`.
pub(crate) fn personen_schreiben(personen: &[Person]) -> String {
    let mut s = String::from("people:");
    if personen.is_empty() {
        s.push_str(" {}");
    }
    for p in personen {
        let art = if p.art == Art::Agent { "agent" } else { "human" };
        let aktiv = if p.aktiv { "" } else { ", active: false" };
        s.push_str(&format!("\n  {}: {{name: {}, kind: {art}{aktiv}}}", yaml::skalar(&p.kuerzel), yaml::skalar(&p.name)));
    }
    s
}

/// Der Abschnitt `signals:` ohne Zeilenende in Normalform; ohne Signale gibt es ihn nicht.
pub(crate) fn signale_schreiben(signale: &[Signal]) -> Option<String> {
    if signale.is_empty() {
        return None;
    }
    let mut s = String::from("signals:");
    for g in signale {
        s.push_str(&format!("\n  {}: {{label: {}, color: {}}}", yaml::skalar(&g.schluessel), yaml::skalar(&g.bezeichnung), yaml::skalar(&g.farbe)));
    }
    Some(s)
}

/// Der Abschnitt `sources:` ohne Zeilenende in Normalform (ADR-0034 N2 Regel 4): nur `repository`, je Anwendung auch.
pub(crate) fn quellen_schreiben(q: &Quellen) -> String {
    format!("sources:\n  {}{}", pfad(&q.repository), anwendungen_schreiben(&q.anwendungen))
}

/// Der Abschnitt `sources:` in der alten Registerform, wie frühere kanbanD-Versionen ihn schrieben: `wbs` und
/// `requirements`, je Anwendung `{name, wbs, requirements}`, nach Kürzel sortiert. Geschrieben wird er nie — die
/// Normalform-Prüfung (ADR-0043 Regel 6) erkennt an ihm einen Bestand, den ADR-0034 N2 Regel 2 umstellen darf.
pub(crate) fn quellen_altform_schreiben(q: &Quellen) -> String {
    let mut s = format!("sources:\n  wbs: {}\n  requirements: {}", yaml::skalar(&q.wbs), yaml::skalar(&q.anforderungen));
    if !q.anwendungen.is_empty() {
        s.push_str("\n  applications:");
    }
    let mut sortiert: Vec<&Anwendung> = q.anwendungen.iter().collect();
    sortiert.sort_by(|a, b| a.kuerzel.cmp(&b.kuerzel));
    for a in sortiert {
        s.push_str(&format!("\n    {}: {{name: {}, wbs: {}, requirements: {}}}", yaml::skalar(&a.kuerzel), yaml::skalar(&a.name), yaml::skalar(&a.wbs), yaml::skalar(&a.anforderungen)));
    }
    s
}

/// Die Abschnitte von `kanbanD.md`, die ein Schreibweg ändert, in der festen Reihenfolge (ADR-0043 Regel 3).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Abschnitt {
    Personen,
    Klassen,
    Signale,
    Quellen,
}

impl Abschnitt {
    pub const ALLE: [Abschnitt; 4] = [Abschnitt::Personen, Abschnitt::Klassen, Abschnitt::Signale, Abschnitt::Quellen];

    /// Der Schlüssel, wie er in der Datei steht.
    pub fn schluessel(self) -> &'static str {
        match self {
            Abschnitt::Personen => "people",
            Abschnitt::Klassen => "classes",
            Abschnitt::Signale => "signals",
            Abschnitt::Quellen => "sources",
        }
    }

    /// Der Block in Normalform für den Wert in `e`, ohne Zeilenende; `None` = der Abschnitt steht nicht in der Datei.
    pub fn block(self, e: &Einstellungen) -> Option<String> {
        match self {
            Abschnitt::Personen => Some(personen_schreiben(&e.personen)),
            Abschnitt::Klassen => Some(klassen_schreiben(&e.klassen)),
            Abschnitt::Signale => signale_schreiben(&e.signale),
            Abschnitt::Quellen => Some(quellen_schreiben(&e.quellen)),
        }
    }

    /// Ob der Wert dieses Abschnitts in `a` und `b` gleich ist.
    pub fn gleich(self, a: &Einstellungen, b: &Einstellungen) -> bool {
        match self {
            Abschnitt::Personen => a.personen == b.personen,
            Abschnitt::Klassen => a.klassen == b.klassen,
            Abschnitt::Signale => a.signale == b.signale,
            Abschnitt::Quellen => a.quellen == b.quellen,
        }
    }

    fn leer(self, e: &Einstellungen) -> bool {
        self.gleich(e, &Einstellungen::default())
    }
}

/// Ob der Abschnitt im Text der Normalform seines bisherigen Werts entspricht (ADR-0043 Regel 6, PO Z. 666): verglichen
/// ohne Zeilenende; bei `sources` gilt auch die alte Registerform; ein fehlender Abschnitt nur, wenn sein Wert leer ist.
/// Alles andere (eingerückter Kommentar, Block- statt Flussform, eigene Anführung, Leerzeile) ist von Hand gestaltet.
pub(crate) fn in_normalform(text: &str, abschnitt: Abschnitt, bisher: &Einstellungen) -> bool {
    let Some(steht) = frontmatter::abschnitt_lesen(text, abschnitt.schluessel()) else {
        return abschnitt.leer(bisher);
    };
    abschnitt.block(bisher).as_ref() == Some(&steht) || (abschnitt == Abschnitt::Quellen && steht == quellen_altform_schreiben(&bisher.quellen))
}

/// Setzt `kanbanD.md` aus den Abschnitten neu zusammen — nur für eine neue Datei (`einrichten`, ADR-0043 Regel 2);
/// jeder andere Schreibweg ändert nur die geänderten Abschnitte im vorhandenen Text.
pub fn schreiben(e: &Einstellungen) -> String {
    let mut s = format!("---\n{}\n{}", personen_schreiben(&e.personen), klassen_schreiben(&e.klassen));
    if let Some(signale) = signale_schreiben(&e.signale) {
        s.push_str(&format!("\n{signale}"));
    }
    if let Some(b) = e.transkripte_erfassen {
        s.push_str(&format!("\n{}: {b}", super::board::SCHALTER));
    }
    s.push_str(&format!(
        "\n{}\n---\n\n# kanbanD\n\nEinstellungen dieses Ordners: Personen (`people`), Klassen (`classes`), Signale (`signals`) und Quellpfade (`sources`).\nPersonen werden stillgelegt (`active: false`), nicht entfernt.\n",
        quellen_schreiben(&e.quellen)
    ));
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn beispiel() -> Einstellungen {
        Einstellungen {
            personen: vec![
                Person { kuerzel: "st".into(), name: "Stefan Hoffmann".into(), art: Art::Mensch, aktiv: true },
                Person { kuerzel: "cl".into(), name: "Claude".into(), art: Art::Agent, aktiv: true },
                Person { kuerzel: "ab".into(), name: "Anna: Gast".into(), art: Art::Mensch, aktiv: false },
            ],
            klassen: vec![Klasse { schluessel: "bug".into(), bezeichnung: "Fehler".into(), farbe: "#b04a8c".into() }],
            signale: vec![Signal { schluessel: "mail".into(), bezeichnung: "Neue E-Mail".into(), farbe: "blue".into() }],
            quellen: Quellen { repository: "Dokumentation/Planung".into(), ..Default::default() },
            transkripte_erfassen: None,
        }
    }

    const KOERPER: &str = "---\n\n# kanbanD\n\nEinstellungen dieses Ordners: Personen (`people`), Klassen (`classes`), Signale (`signals`) und Quellpfade (`sources`).\nPersonen werden stillgelegt (`active: false`), nicht entfernt.\n";

    /// R00250 B1314 (ADR-0043 Regel 2): je Abschnitt der Block in Normalform, ohne Zeilenende.
    #[test]
    fn abschnitte_in_normalform() {
        let e = beispiel();
        assert_eq!(personen_schreiben(&[]), "people: {}");
        assert_eq!(personen_schreiben(&e.personen), "people:\n  st: {name: Stefan Hoffmann, kind: human}\n  cl: {name: Claude, kind: agent}\n  ab: {name: \"Anna: Gast\", kind: human, active: false}");
        assert_eq!(klassen_schreiben(&e.klassen), "classes:\n  bug: {label: Fehler, color: \"#b04a8c\"}");
        assert_eq!(signale_schreiben(&[]), None, "ohne Signale kein Abschnitt");
        assert_eq!(signale_schreiben(&e.signale).as_deref(), Some("signals:\n  mail: {label: Neue E-Mail, color: blue}"));
        assert_eq!(quellen_schreiben(&Quellen::default()), "sources:\n  repository: \"\"");
        assert_eq!(quellen_schreiben(&e.quellen), "sources:\n  repository: Dokumentation/Planung");
    }

    /// R00250 AK 10 (Einrichten byte-gleich): `schreiben` aus den Abschnitten ergibt dieselben Bytes wie vor dem Umbau.
    #[test]
    fn schreiben_ist_byte_gleich_wie_vor_dem_umbau() {
        let mut e = beispiel();
        assert_eq!(
            schreiben(&e),
            format!("---\npeople:\n  st: {{name: Stefan Hoffmann, kind: human}}\n  cl: {{name: Claude, kind: agent}}\n  ab: {{name: \"Anna: Gast\", kind: human, active: false}}\nclasses:\n  bug: {{label: Fehler, color: \"#b04a8c\"}}\nsignals:\n  mail: {{label: Neue E-Mail, color: blue}}\nsources:\n  repository: Dokumentation/Planung\n{KOERPER}")
        );
        e.transkripte_erfassen = Some(true);
        e.signale.clear();
        assert!(schreiben(&e).contains("\nclasses:\n  bug: {label: Fehler, color: \"#b04a8c\"}\nrecord-transcripts: true\nsources:\n  repository: Dokumentation/Planung\n---\n"));
        assert_eq!(schreiben(&Einstellungen::default()), format!("---\npeople: {{}}\nclasses: {{}}\nsources:\n  repository: \"\"\n{KOERPER}"));
    }

    /// Die sechs echten Bestände (R00250 AK 9, Stand 2026-11-23), Namen von Menschen durch Platzhalter ersetzt.
    pub(crate) const BESTAENDE: [(&str, &str); 6] = [
        ("Entwicklungsprozess", include_str!("../../tests/altbestaende/kanbanD-md-2026-11-23/Entwicklungsprozess.md")),
        ("goaltreetoolA", include_str!("../../tests/altbestaende/kanbanD-md-2026-11-23/goaltreetoolA.md")),
        ("JoinPuyaApp", include_str!("../../tests/altbestaende/kanbanD-md-2026-11-23/JoinPuyaApp.md")),
        ("kanbanD-Demo", include_str!("../../tests/altbestaende/kanbanD-md-2026-11-23/kanbanD-Demo.md")),
        ("kanbanD", include_str!("../../tests/altbestaende/kanbanD-md-2026-11-23/kanbanD.md")),
        ("localchatA", include_str!("../../tests/altbestaende/kanbanD-md-2026-11-23/localchatA.md")),
    ];

    /// R00250 B1315: `lesen` und der Schreiber der alten Registerform ergeben je Bestand den Block `sources` zeichengleich.
    #[test]
    fn alte_registerform_der_sechs_bestaende_zeichengleich() {
        for (name, text) in BESTAENDE {
            let e = lesen(text).unwrap();
            let block = super::super::frontmatter::abschnitt_lesen(text, "sources").unwrap();
            assert_eq!(quellen_altform_schreiben(&e.quellen), block, "{name}");
        }
        let mit = "sources:\n  wbs: plan/wbs.md\n  requirements: anf/\n  applications:\n    kc: {name: \"K: C\", wbs: /c.md, requirements: \"\"}\n    kd: {name: kanbanD, wbs: /a/b.md, requirements: /a}";
        assert_eq!(quellen_altform_schreiben(&lesen(&format!("---\n{mit}\n---\n")).unwrap().quellen), mit, "Anführung und Sortierung wie im Normalform-Schreiber");
    }

    /// Datei H aus R00250 (Ausgangslage) ohne die Zusätze von Hand: so, wie `einrichten` sie schreibt.
    fn h_normal() -> (Einstellungen, String) {
        let e = lesen("---\npeople:\n  sh: {name: Sven, kind: human}\n  ag: {name: Agent A, kind: agent}\nclasses:\n  bug: {label: Fehler, color: red}\nsources:\n  repository: \"\"\n---\n").unwrap();
        let t = schreiben(&e);
        (e, t)
    }

    /// R00250 B1317 (ADR-0043 Regel 6): der bisherige Abschnittstext ist die Normalform seines bisherigen Werts; bei
    /// `sources` auch die alte Registerform; ein fehlender Abschnitt nur bei leerem Wert.
    #[test]
    fn normalform_je_abschnitt() {
        let (e, t) = h_normal();
        for a in Abschnitt::ALLE {
            assert!(in_normalform(&t, a, &e), "{a:?} in der Datei von einrichten");
        }
        for (name, text) in BESTAENDE {
            let b = lesen(text).unwrap();
            for a in Abschnitt::ALLE {
                assert!(in_normalform(text, a, &b), "{name}: {a:?}");
            }
        }
        let leer = Einstellungen::default();
        assert!(in_normalform("---\nx: 1\n---\n", Abschnitt::Personen, &leer), "fehlt bei leerem Wert");
        assert!(in_normalform(&t, Abschnitt::Signale, &e), "signals fehlt, keine Signale");
        assert!(!in_normalform("---\nx: 1\n---\n", Abschnitt::Personen, &e), "fehlt, obwohl Personen da sind");
        assert!(!in_normalform(&t.replace("people:", "\"people\":"), Abschnitt::Personen, &e), "zitierter Schlüssel fehlt als Abschnitt");
    }

    /// R00250 AK 6 (Formen): Handform im Abschnitt ist keine Normalform.
    #[test]
    fn handform_ist_keine_normalform() {
        let (e, t) = h_normal();
        let sh = "  sh: {name: Sven, kind: human}\n";
        for (fall, text) in [
            ("eingerückter Kommentar", t.replace(sh, &format!("{sh}  # Vertretung\n"))),
            ("Blockform", t.replace(sh, "  sh:\n    {name: Sven, kind: human}\n")),
            ("eigene Anführung", t.replace("name: Sven,", "name: 'Sven',")),
            ("Leerzeile zwischen Einträgen", t.replace(sh, &format!("{sh}\n"))),
            ("Leerzeichen am Zeilenende", t.replace(sh, "  sh: {name: Sven, kind: human} \n")),
        ] {
            assert_eq!(lesen(&text).unwrap().personen, e.personen, "{fall}: derselbe Wert");
            assert!(!in_normalform(&text, Abschnitt::Personen, &e), "{fall}");
            assert!(in_normalform(&text, Abschnitt::Klassen, &e), "{fall}: classes unberührt");
        }
        let klassen = t.replace("  bug: {label: Fehler, color: red}\n", "  bug: {label: Fehler, color: red}\n  # Farbe abgestimmt\n");
        assert!(!in_normalform(&klassen, Abschnitt::Klassen, &e));
        let quellen = t.replace("sources:\n  repository: \"\"\n", "sources:\n  repository: \"\"   # leer\n");
        assert!(!in_normalform(&quellen, Abschnitt::Quellen, &e));
        let crlf = t.replace('\n', "\r\n");
        assert!(in_normalform(&format!("\u{feff}{crlf}"), Abschnitt::Personen, &e), "verglichen ohne Zeilenende, BOM egal");
    }

    #[test]
    fn rundlauf_objekt_text_objekt() {
        let e = beispiel();
        assert_eq!(lesen(&schreiben(&e)).unwrap(), e);
    }

    #[test]
    fn rundlauf_text_objekt_text_ist_stabil() {
        let t = schreiben(&beispiel());
        assert_eq!(schreiben(&lesen(&t).unwrap()), t);
        assert!(t.contains("  st: {name: Stefan Hoffmann, kind: human}\n  cl: {name: Claude, kind: agent}\n"));
        assert!(t.contains("ab: {name: \"Anna: Gast\", kind: human, active: false}"));
    }

    fn anwendung(k: &str, wbs: &str) -> Anwendung {
        Anwendung { kuerzel: k.into(), name: format!("App {k}"), repository: format!("/r/{k}/repo"), wbs: wbs.into(), anforderungen: format!("/r/{k}") }
    }

    #[test]
    fn register_der_anwendungen_rundlauf_stabil_sortiert() {
        let mut e = beispiel();
        e.quellen.anwendungen = vec![anwendung("kd", "/home/x/kanbanD/plan.md"), anwendung("kc", "C:/y: z.md")];
        let t = schreiben(&e);
        assert!(t.contains("\n  applications:\n    kc: {name: App kc, repository: /r/kc/repo}\n    kd: {name: App kd, repository: /r/kd/repo}\n---"), "R00222: der Lese-Rückfall wird nie geschrieben:\n{t}");
        let gelesen = lesen(&t).unwrap();
        assert_eq!(gelesen.quellen.anwendungen.iter().map(|a| a.kuerzel.as_str()).collect::<Vec<_>>(), vec!["kc", "kd"]);
        assert_eq!(gelesen.quellen.repository, "Dokumentation/Planung", "Standardanwendung bleibt mit ihrem Repository");
        assert_eq!(schreiben(&gelesen), t);
        let knapp = lesen("---\nsources:\n  applications:\n    kd: {}\n---\n").unwrap();
        assert_eq!(knapp.quellen.anwendungen, vec![Anwendung { kuerzel: "kd".into(), name: "kd".into(), repository: "".into(), wbs: "".into(), anforderungen: "".into() }]);
        assert!(lesen("---\nsources:\n  applications:\n    kd: 5\n---\n").is_err());
        assert!(!schreiben(&beispiel()).contains("applications"), "ohne Register keine leere Zeile");
    }

    /// R00222 (ADR-0034 N2 Regel 4): geschrieben wird je Anwendung und in `sources` nur `repository` — auch wenn der
    /// Lese-Rückfall einen Pfad trägt; die neue Form liest sich zurück, wie sie geschrieben wurde.
    #[test]
    fn nur_repository_wird_geschrieben_auch_mit_lese_rueckfall() {
        let mut e = beispiel();
        e.quellen = Quellen {
            repository: "/r".into(),
            wbs: "plan/wbs.md".into(),
            anforderungen: "anf".into(),
            anwendungen: vec![
                Anwendung { kuerzel: "kd".into(), name: "kanbanD".into(), repository: "/r".into(), wbs: "".into(), anforderungen: "".into() },
                Anwendung { kuerzel: "lc".into(), name: "Lokal".into(), repository: "".into(), wbs: "".into(), anforderungen: "".into() },
                Anwendung { kuerzel: "pa".into(), name: "Probe".into(), repository: "/r/D/P".into(), wbs: "/r/D/P/pa.md".into(), anforderungen: "/r/A".into() },
            ],
        };
        let t = schreiben(&e);
        assert!(t.contains("\nsources:\n  repository: /r\n  applications:\n    kd: {name: kanbanD, repository: /r}\n    lc: {name: Lokal, repository: \"\"}\n    pa: {name: Probe, repository: /r/D/P}\n---"), "{t}");
        assert!(!t.contains("wbs") && !t.contains("requirements"), "{t}");
        let gelesen = lesen(&t).unwrap();
        assert_eq!(schreiben(&gelesen), t, "Rundlauf stabil");
        assert_eq!((gelesen.quellen.wbs.as_str(), gelesen.quellen.anwendungen[2].wbs.as_str()), ("", ""));
    }

    /// Ein Altbestand (nur `wbs`/`requirements`) liest sich ohne `repository` — den Rückfall rechnet das Modell, nicht der Leser.
    #[test]
    fn altbestand_liest_sich_ohne_repository() {
        let e = lesen("---\nsources:\n  wbs: plan/wbs.md\n  requirements: anf/\n  applications:\n    kd: {name: K, wbs: /r/D/P/kd.md, requirements: /r/A}\n---\n").unwrap();
        assert_eq!((e.quellen.repository.as_str(), e.quellen.wbs.as_str()), ("", "plan/wbs.md"));
        assert_eq!((e.quellen.anwendungen[0].repository.as_str(), e.quellen.anwendungen[0].wbs.as_str()), ("", "/r/D/P/kd.md"));
        assert_eq!(e.quellen.anwendungen[0].startordner().as_deref(), Some("/r/D/P"));
    }

    #[test]
    fn leere_einstellungen_und_fehlende_felder() {
        let leer = Einstellungen::default();
        assert_eq!(lesen(&schreiben(&leer)).unwrap(), leer);
        let e = lesen("---\npeople:\n  x: {}\nclasses:\n  c: {}\n---\n").unwrap();
        assert_eq!(e.personen[0].name, "x");
        assert_eq!(e.personen[0].art, Art::Mensch);
        assert_eq!(e.klassen[0].farbe, "grey");
        assert_eq!(lesen("# nur Text").unwrap(), Einstellungen::default());
    }

    #[test]
    fn falsche_art_und_falsche_struktur_sind_fehler() {
        assert!(lesen("---\npeople:\n  x: {kind: robot}\n---\n").unwrap_err().0.contains("robot"));
        assert!(lesen("---\npeople:\n  x: 5\n---\n").is_err());
        assert!(lesen("---\nclasses:\n  c: 5\n---\n").is_err());
        assert!(lesen("---\npeople:\n  [a]: {}\n---\n").is_err());
        assert!(lesen("---\nclasses:\n  [a]: {}\n---\n").is_err());
    }
}
