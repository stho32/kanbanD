//! Lizenzhinweise der eingebetteten Rust-Pakete (R00263, ADR-0045).
//!
//! Der Generator löst den Abhängigkeitsgraph für die Release-Ziele auf, teilt die
//! Pakete aus `Cargo.lock` in enthaltene und ausgenommene (mit Grund) und formt daraus
//! `web/LIZENZEN.md`. Alles hinter dem Cargo-Feature `lizenzen`, damit `cargo install`
//! und `RUSTFLAGS=-D warnings` nichts Totes sehen (Auftrag #250, ADR-0045).

use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

/// Ein Fehler beim Auflösen, Lesen oder Schreiben.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Fehler {
    /// Die Ausgabe von `cargo metadata` ist nicht lesbar oder unvollständig.
    Metadaten(String),
    /// Ein enthaltenes Paket trägt weder Lizenzangabe noch Lizenzdatei.
    PaketOhneLizenz { paket: String },
    /// Im Registrarcache liegt kein Lizenztext zum Paket.
    KeinLizenztext { paket: String },
    /// Ein Lese- oder Schreibfehler im Dateisystem.
    Io(String),
}

impl std::fmt::Display for Fehler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Fehler::Metadaten(s) => write!(f, "Metadaten unlesbar: {s}"),
            Fehler::PaketOhneLizenz { paket } => write!(f, "Paket ohne Lizenzangabe: {paket}"),
            Fehler::KeinLizenztext { paket } => write!(f, "kein Lizenztext im Cache: {paket}"),
            Fehler::Io(s) => write!(f, "Dateizugriff: {s}"),
        }
    }
}

impl std::error::Error for Fehler {}

/// Art einer Kante im aufgelösten Abhängigkeitsgraph.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kantenart {
    /// Eine gewöhnliche Abhängigkeit (`kind` fehlt).
    Normal,
    /// Eine Test-Abhängigkeit (`[dev-dependencies]`).
    Dev,
    /// Eine Bau-Abhängigkeit (`[build-dependencies]`).
    Build,
}

impl Kantenart {
    fn aus_json(kind: Option<&str>) -> Kantenart {
        match kind {
            Some("dev") => Kantenart::Dev,
            Some("build") => Kantenart::Build,
            _ => Kantenart::Normal,
        }
    }
}

/// Ein Paket aus der `cargo metadata`-Ausgabe.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Paketinfo {
    pub name: String,
    pub version: String,
    pub lizenz: Option<String>,
    pub lizenz_datei: Option<String>,
    /// Der Ordner des Pakets im Registrarcache (Elternordner von `manifest_path`).
    pub ordner: String,
    /// Ein Paket des Workspace selbst (keine Fremdquelle).
    pub workspace: bool,
}

/// Die aufgelöste Ausgabe einer `cargo metadata`-Ausführung.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Metadaten {
    /// Die Kennung des Wurzelpakets der Auflösung.
    pub root: String,
    /// Je Knoten die Kanten (Ziel-Kennung, Art).
    pub kanten: BTreeMap<String, Vec<(String, Kantenart)>>,
    /// Alle Pakete der Auflösung, nach Kennung.
    pub pakete: BTreeMap<String, Paketinfo>,
}

/// Liest die Ausgabe von `cargo metadata --format-version 1`.
pub fn lesen(json: &str) -> Result<Metadaten, Fehler> {
    let wert: Value = serde_json::from_str(json).map_err(|e| Fehler::Metadaten(e.to_string()))?;
    let pakete_json = wert
        .get("packages")
        .and_then(Value::as_array)
        .ok_or_else(|| Fehler::Metadaten("packages fehlt".into()))?;
    let mut pakete = BTreeMap::new();
    for p in pakete_json {
        let id = text(p, "id")?;
        let manifest = text(p, "manifest_path")?;
        let ordner = std::path::Path::new(&manifest)
            .parent()
            .map(|x| x.to_string_lossy().into_owned())
            .unwrap_or_default();
        pakete.insert(
            id,
            Paketinfo {
                name: text(p, "name")?,
                version: text(p, "version")?,
                lizenz: p.get("license").and_then(Value::as_str).map(str::to_string),
                lizenz_datei: p.get("license_file").and_then(Value::as_str).map(str::to_string),
                ordner,
                workspace: p.get("source").is_none_or(Value::is_null),
            },
        );
    }

    let resolve = wert.get("resolve").ok_or_else(|| Fehler::Metadaten("resolve fehlt".into()))?;
    let root = text(resolve, "root")?;
    let nodes = resolve
        .get("nodes")
        .and_then(Value::as_array)
        .ok_or_else(|| Fehler::Metadaten("resolve.nodes fehlt".into()))?;
    let mut kanten = BTreeMap::new();
    for n in nodes {
        let id = text(n, "id")?;
        let mut liste = Vec::new();
        if let Some(deps) = n.get("deps").and_then(Value::as_array) {
            for d in deps {
                let ziel = text(d, "pkg")?;
                match d.get("dep_kinds").and_then(Value::as_array) {
                    Some(arten) => {
                        for k in arten {
                            liste.push((ziel.clone(), Kantenart::aus_json(k.get("kind").and_then(Value::as_str))));
                        }
                    }
                    None => liste.push((ziel.clone(), Kantenart::Normal)),
                }
            }
        }
        kanten.insert(id, liste);
    }
    Ok(Metadaten { root, kanten, pakete })
}

fn text(v: &Value, feld: &str) -> Result<String, Fehler> {
    v.get(feld)
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| Fehler::Metadaten(format!("Feld {feld} fehlt")))
}

/// Alle Kennungen, die von der Wurzel über Kanten der genannten Arten erreichbar sind.
pub fn erreichbar(md: &Metadaten, arten: &[Kantenart]) -> BTreeSet<String> {
    let mut gesehen = BTreeSet::new();
    let mut offen = vec![md.root.clone()];
    gesehen.insert(md.root.clone());
    while let Some(id) = offen.pop() {
        let Some(kanten) = md.kanten.get(&id) else {
            continue;
        };
        for (ziel, art) in kanten {
            if arten.contains(art) && gesehen.insert(ziel.clone()) {
                offen.push(ziel.clone());
            }
        }
    }
    gesehen
}

/// Der Grund, aus dem ein Paket aus `Cargo.lock` nicht in die Hinweisdatei aufgenommen wird.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AusnahmeGrund {
    Dev,
    Build,
    Plattformfremd,
    Workspace,
}

impl AusnahmeGrund {
    /// Der Grund als Wort der festen Liste aus R00263.
    pub fn wort(&self) -> &'static str {
        match self {
            AusnahmeGrund::Dev => "dev",
            AusnahmeGrund::Build => "build",
            AusnahmeGrund::Plattformfremd => "plattformfremd",
            AusnahmeGrund::Workspace => "workspace",
        }
    }
}

/// Die Einteilung der Pakete in enthaltene und ausgenommene.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Auswahl {
    /// Kennungen der enthaltenen Pakete, nach Name und Version sortiert.
    pub enthalten: Vec<String>,
    /// Kennungen der ausgenommenen Pakete mit Grund, nach Name und Version sortiert.
    pub ausnahmen: Vec<(String, AusnahmeGrund)>,
}

/// Teilt die Pakete von `komplett` in enthaltene und ausgenommene.
///
/// Enthalten ist, was für eines der `plattformen`-Ziele über `normal`- und
/// `build`-Kanten erreichbar ist. Ausgenommen ist der Rest: nur über `dev`
/// erreichbar → `dev`, sonst nur für fremde Ziele → `plattformfremd`, das
/// Workspace-Paket selbst → `workspace`.
pub fn auswahl(komplett: &Metadaten, plattformen: &[&Metadaten]) -> Auswahl {
    let mut enthalten: BTreeSet<String> = BTreeSet::new();
    for p in plattformen {
        for id in erreichbar(p, &[Kantenart::Normal, Kantenart::Build]) {
            if id != komplett.root && komplett.pakete.contains_key(&id) {
                enthalten.insert(id);
            }
        }
    }

    let basis = erreichbar(komplett, &[Kantenart::Normal, Kantenart::Build]);
    let mut ausnahmen: Vec<(String, AusnahmeGrund)> = Vec::new();
    for (id, info) in &komplett.pakete {
        if info.workspace {
            ausnahmen.push((id.clone(), AusnahmeGrund::Workspace));
        } else if !enthalten.contains(id) {
            let grund = if basis.contains(id) {
                AusnahmeGrund::Plattformfremd
            } else {
                AusnahmeGrund::Dev
            };
            ausnahmen.push((id.clone(), grund));
        }
    }

    let sortieren = |a: &String, b: &String| {
        let links = &komplett.pakete[a];
        let rechts = &komplett.pakete[b];
        (&links.name, &links.version).cmp(&(&rechts.name, &rechts.version))
    };
    let mut enthalten: Vec<String> = enthalten.into_iter().collect();
    enthalten.sort_by(&sortieren);
    ausnahmen.sort_by(|a, b| sortieren(&a.0, &b.0));
    Auswahl { enthalten, ausnahmen }
}

/// Ein enthaltenes Paket mit allem, was in die Hinweisdatei kommt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Paket {
    pub name: String,
    pub version: String,
    pub lizenz: String,
    pub urhebertext: String,
}

/// Liest den Urheber- und Lizenztext eines Pakets aus seinem Ordner im Cache.
///
/// Ist `lizenz_datei` gesetzt, wird genau diese Datei gelesen. Sonst werden alle
/// Dateien gelesen, deren Name mit `LICENSE`, `LICENCE`, `COPYING`, `NOTICE` oder
/// `UNLICENSE` beginnt (in Namensordnung zusammengefügt).
pub fn lizenztext_lesen(ordner: &std::path::Path, lizenz_datei: Option<&str>) -> Result<String, Fehler> {
    let mut dateien: Vec<std::path::PathBuf> = Vec::new();
    match lizenz_datei {
        Some(name) => dateien.push(ordner.join(name)),
        None => {
            let eintraege =
                std::fs::read_dir(ordner).map_err(|e| Fehler::Io(format!("{}: {e}", ordner.display())))?;
            let mut gefunden: Vec<std::path::PathBuf> = eintraege
                .filter_map(|e| e.ok().map(|e| e.path()))
                .filter(|p| p.is_file() && ist_lizenzdatei(p.file_name().and_then(|n| n.to_str()).unwrap_or("")))
                .collect();
            gefunden.sort();
            dateien.extend(gefunden);
        }
    }

    let mut teile = Vec::new();
    for datei in &dateien {
        let text = std::fs::read_to_string(datei)
            .map_err(|_| Fehler::KeinLizenztext { paket: datei.display().to_string() })?;
        teile.push(text);
    }
    let gesamt = teile.join("\n");
    if gesamt.trim().is_empty() {
        return Err(Fehler::KeinLizenztext { paket: ordner.display().to_string() });
    }
    Ok(gesamt)
}

fn ist_lizenzdatei(name: &str) -> bool {
    let oben = name.to_ascii_uppercase();
    ["LICENSE", "LICENCE", "COPYING", "NOTICE", "UNLICENSE"]
        .iter()
        .any(|praefix| oben.starts_with(praefix))
}

/// Baut die Einträge der enthaltenen Pakete mit Lizenz und Urhebertext.
///
/// Ein Paket ohne Lizenzangabe und ohne Lizenzdatei ist ein Fehler (`PaketOhneLizenz`).
pub fn enthaltene(komplett: &Metadaten, auswahl: &Auswahl) -> Result<Vec<Paket>, Fehler> {
    let mut pakete = Vec::new();
    for id in &auswahl.enthalten {
        let info = komplett.pakete.get(id).ok_or_else(|| Fehler::Metadaten(format!("Paket {id} fehlt")))?;
        if info.lizenz.is_none() && info.lizenz_datei.is_none() {
            return Err(Fehler::PaketOhneLizenz { paket: format!("{} {}", info.name, info.version) });
        }
        let urhebertext = lizenztext_lesen(std::path::Path::new(&info.ordner), info.lizenz_datei.as_deref())
            .map_err(|_| Fehler::KeinLizenztext { paket: format!("{} {}", info.name, info.version) })?;
        pakete.push(Paket {
            name: info.name.clone(),
            version: info.version.clone(),
            lizenz: info.lizenz.clone().unwrap_or_else(|| "siehe Urhebertext".to_string()),
            urhebertext,
        });
    }
    Ok(pakete)
}

/// Ein ausgenommenes Paket mit Grund, wie es der Generator ausgibt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Ausnahme {
    pub name: String,
    pub version: String,
    pub grund: AusnahmeGrund,
}

/// Baut die Ausnahmeliste mit Name, Version und Grund.
pub fn ausnahmen(komplett: &Metadaten, auswahl: &Auswahl) -> Vec<Ausnahme> {
    auswahl
        .ausnahmen
        .iter()
        .filter_map(|(id, grund)| {
            komplett.pakete.get(id).map(|info| Ausnahme {
                name: info.name.clone(),
                version: info.version.clone(),
                grund: *grund,
            })
        })
        .collect()
}

/// Die Paketmengen einer Hinweisdatei.
#[derive(Debug, Default, PartialEq, Eq)]
struct Mengen {
    enthalten: BTreeSet<(String, String)>,
    ausgenommen: BTreeSet<(String, String)>,
}

/// Liest die Abschnitte „Enthaltene Pakete“ und „Ausgenommene Pakete“ einer Hinweisdatei.
fn mengen(text: &str) -> Mengen {
    let mut mengen = Mengen::default();
    let mut abschnitt = "";
    for zeile in text.lines() {
        if zeile.starts_with("## Enthaltene Pakete") {
            abschnitt = "enthalten";
            continue;
        }
        if zeile.starts_with("## Ausgenommene Pakete") {
            abschnitt = "ausgenommen";
            continue;
        }
        if abschnitt == "ausgenommen" {
            if let Some(rest) = zeile.strip_prefix("| ") {
                let felder: Vec<&str> = rest.split('|').map(str::trim).collect();
                if felder.len() >= 4 && !felder[0].is_empty() && felder[0] != "Paket" && !felder[0].starts_with("---") {
                    mengen.ausgenommen.insert((felder[0].to_string(), felder[1].to_string()));
                }
            }
        } else if abschnitt == "enthalten" {
            if let Some(kopf) = zeile.strip_prefix("### ") {
                let teile: Vec<&str> = kopf.split_whitespace().collect();
                if teile.len() == 2 {
                    mengen.enthalten.insert((teile[0].to_string(), teile[1].to_string()));
                }
            }
        }
    }
    mengen
}

/// Vergleicht die committete Hinweisdatei mit dem frisch erzeugten Inhalt.
///
/// Sind die Inhalte verschieden, nennt der Fehler, welche Pakete in der einen Fassung
/// fehlen bzw. unerwartet stehen — ein veralteter Stand wird so ohne Nachzählen sichtbar
/// (R00263 AK 6, ADR-0045 Q1).
///
/// Die **Version des Workspace-Pakets** zählt nicht mit: der Release-Ablauf setzt sie
/// vor diesem Schritt per `sed` auf die Auslieferungsversion (B1, #250 Nacharbeit).
pub fn pruefen(datei: &str, frisch: &str) -> Result<(), Vec<String>> {
    let datei = workspace_entkoppeln(datei);
    let frisch = workspace_entkoppeln(frisch);
    if datei == frisch {
        return Ok(());
    }
    let alt = mengen(&datei);
    let neu = mengen(&frisch);
    let mut namen = Vec::new();
    for (n, v) in neu.enthalten.difference(&alt.enthalten) {
        namen.push(format!("fehlt in der Datei: {n} {v}"));
    }
    for (n, v) in alt.enthalten.difference(&neu.enthalten) {
        namen.push(format!("unerwartet in der Datei: {n} {v}"));
    }
    for (n, v) in neu.ausgenommen.difference(&alt.ausgenommen) {
        namen.push(format!("fehlt in den Ausnahmen: {n} {v}"));
    }
    for (n, v) in alt.ausgenommen.difference(&neu.ausgenommen) {
        namen.push(format!("unerwartet in den Ausnahmen: {n} {v}"));
    }
    if namen.is_empty() {
        namen.push("Inhalt weicht ab (Lizenztext, Reihenfolge oder Format)".to_string());
    }
    Err(namen)
}

/// Ersetzt die Versionsspalte jeder `workspace`-Zeile durch einen festen Platzhalter,
/// damit die Versionsnummer des Programms selbst den Vergleich nicht stört.
fn workspace_entkoppeln(text: &str) -> String {
    let mut aus = String::with_capacity(text.len());
    for (i, zeile) in text.lines().enumerate() {
        if i > 0 {
            aus.push('\n');
        }
        let felder: Vec<&str> = zeile.split('|').map(str::trim).collect();
        if felder.len() >= 5 && felder[0].is_empty() && !felder[1].is_empty() && felder[3] == "workspace" {
            aus.push_str(&format!("| {} | - | {} |", felder[1], felder[3]));
        } else {
            aus.push_str(zeile);
        }
    }
    if text.ends_with('\n') {
        aus.push('\n');
    }
    aus
}

/// Formt die enthaltenen und ausgenommenen Pakete zu `web/LIZENZEN.md`.
pub fn formatiere(pakete: &[Paket], ausnahmen: &[Ausnahme]) -> String {
    let mut text = String::new();
    text.push_str(concat!(
        "# Lizenzhinweise der eingebetteten Rust-Pakete\n\n",
        "kanbanD ist ein einzelnes Programm, in das die Oberfläche eingebettet ist. Es gibt\n",
        "damit auch die Rust-Pakete weiter, aus denen es gebaut ist. Diese Datei nennt sie mit\n",
        "Lizenz und Urhebertext. Quelle der Wahrheit ist `Cargo.lock`; erzeugt mit\n",
        "`cargo run --features lizenzen --example lizenzen` und geprüft von `tests/lizenzen.rs`.\n\n",
        "Die Liste ist eine **Obermenge**: sie folgt dem aufgelösten Abhängigkeitsgraphen der\n",
        "Release-Ziele (ADR-0045) und nennt auch Pakete, deren Merkmale (`features`) im\n",
        "jeweiligen Bau nicht aktiviert sind. Kein eingebettetes Paket fehlt dadurch.\n\n",
        "## Enthaltene Pakete\n\n",
    ));
    for p in pakete {
        text.push_str(&format!(
            "### {} {}\nLizenz: {}\nUrhebertext:\n\n{}\n\n",
            p.name,
            p.version,
            p.lizenz,
            p.urhebertext.trim_end()
        ));
    }
    text.push_str(concat!(
        "## Ausgenommene Pakete\n\n",
        "Nicht enthaltene Pakete aus `Cargo.lock` mit Grund: `dev`: nur Testabhängigkeit,\n",
        "`build`: nur Bauabhängigkeit, `plattformfremd`: nur für andere Ziele, `workspace`: kanbanD selbst.\n\n",
        "| Paket | Version | Grund |\n",
        "| --- | --- | --- |\n",
    ));
    for a in ausnahmen {
        text.push_str(&format!("| {} | {} | {} |\n", a.name, a.version, a.grund.wort()));
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    // Ein kleiner Graph: das Workspace-Paket `ws` hängt normal an `a`, als dev an `b`
    // und normal an `d` (nur für ein fremdes Ziel); `a` hängt als build an `c`.
    const KOMPLETT: &str = r#"{
        "packages": [
            {"id":"ws","name":"ws","version":"0.1.0","source":null,"manifest_path":"/x/ws/Cargo.toml"},
            {"id":"a","name":"a","version":"1.0.0","source":"registry+x","manifest_path":"/x/a/Cargo.toml"},
            {"id":"b","name":"b","version":"1.0.0","source":"registry+x","manifest_path":"/x/b/Cargo.toml"},
            {"id":"c","name":"c","version":"1.0.0","source":"registry+x","manifest_path":"/x/c/Cargo.toml"},
            {"id":"d","name":"d","version":"1.0.0","source":"registry+x","manifest_path":"/x/d/Cargo.toml"}
        ],
        "resolve": {"root":"ws","nodes":[
            {"id":"ws","deps":[
                {"pkg":"a","dep_kinds":[{"kind":null}]},
                {"pkg":"b","dep_kinds":[{"kind":"dev"}]},
                {"pkg":"d","dep_kinds":[{"kind":null}]}]},
            {"id":"a","deps":[{"pkg":"c","dep_kinds":[{"kind":"build"}]}]},
            {"id":"b","deps":[]},{"id":"c","deps":[]},{"id":"d","deps":[]}]}}"#;

    const ZIEL: &str = r#"{
        "packages": [
            {"id":"ws","name":"ws","version":"0.1.0","source":null,"manifest_path":"/x/ws/Cargo.toml"},
            {"id":"a","name":"a","version":"1.0.0","source":"registry+x","manifest_path":"/x/a/Cargo.toml"},
            {"id":"c","name":"c","version":"1.0.0","source":"registry+x","manifest_path":"/x/c/Cargo.toml"}
        ],
        "resolve": {"root":"ws","nodes":[
            {"id":"ws","deps":[{"pkg":"a","dep_kinds":[{"kind":null}]}]},
            {"id":"a","deps":[{"pkg":"c","dep_kinds":[{"kind":"build"}]}]},
            {"id":"c","deps":[]}]}}"#;

    fn namen(md: &Metadaten, ids: &[String]) -> Vec<String> {
        ids.iter().map(|i| md.pakete[i].name.clone()).collect()
    }

    #[test]
    fn auswahl_teilt_in_enthalten_und_ausnahmen() {
        let komplett = lesen(KOMPLETT).unwrap();
        let ziel = lesen(ZIEL).unwrap();
        let a = auswahl(&komplett, &[&ziel, &ziel]);

        assert_eq!(namen(&komplett, &a.enthalten), vec!["a", "c"]);
        let gruende: Vec<(String, &str)> =
            a.ausnahmen.iter().map(|(i, g)| (komplett.pakete[i].name.clone(), g.wort())).collect();
        assert_eq!(
            gruende,
            vec![
                ("b".to_string(), "dev"),
                ("d".to_string(), "plattformfremd"),
                ("ws".to_string(), "workspace"),
            ]
        );
    }

    #[test]
    fn enthaltene_und_ausnahmen_decken_alle_pakete() {
        let komplett = lesen(KOMPLETT).unwrap();
        let ziel = lesen(ZIEL).unwrap();
        let a = auswahl(&komplett, &[&ziel, &ziel]);

        let mut alle: BTreeSet<String> = a.enthalten.iter().cloned().collect();
        alle.extend(a.ausnahmen.iter().map(|(i, _)| i.clone()));
        assert_eq!(alle.len(), komplett.pakete.len(), "jedes Paket genau einmal");
    }

    #[test]
    fn dev_kante_macht_nicht_enthalten() {
        let komplett = lesen(KOMPLETT).unwrap();
        let ziel = lesen(ZIEL).unwrap();
        let a = auswahl(&komplett, &[&ziel, &ziel]);
        let b = komplett.pakete.keys().find(|i| komplett.pakete[*i].name == "b").unwrap();
        assert!(!a.enthalten.contains(b), "b hängt nur als dev-Abhängigkeit");
    }

    #[test]
    fn kaputte_metadaten_sind_ein_fehler() {
        assert!(matches!(lesen("{").unwrap_err(), Fehler::Metadaten(_)));
    }

    fn graph_mit_a(ordner: &std::path::Path, lizenz: &str) -> Metadaten {
        let json = format!(
            r#"{{
                "packages":[
                  {{"id":"ws","name":"ws","version":"0.1.0","source":null,"manifest_path":"{o}/Cargo.toml"}},
                  {{"id":"a","name":"a","version":"1.0.0","source":"registry+x","manifest_path":"{o}/a/Cargo.toml"{l}}}
                ],
                "resolve":{{"root":"ws","nodes":[
                  {{"id":"ws","deps":[{{"pkg":"a","dep_kinds":[{{"kind":null}}]}}]}},
                  {{"id":"a","deps":[]}}]}}
            }}"#,
            o = ordner.display(),
            l = lizenz,
        );
        lesen(&json).unwrap()
    }

    fn nur_a() -> Auswahl {
        Auswahl { enthalten: vec!["a".to_string()], ausnahmen: vec![] }
    }

    #[test]
    fn lizenztext_liest_datei_im_ordner() {
        let ordner = tempfile::tempdir().unwrap();
        std::fs::write(ordner.path().join("LICENSE-MIT"), "MIT TEXT\n").unwrap();
        std::fs::write(ordner.path().join("README.md"), "kein Lizenztext\n").unwrap();

        let text = lizenztext_lesen(ordner.path(), None).unwrap();
        assert!(text.contains("MIT TEXT"), "gelesener Text: {text}");
        assert!(!text.contains("kein Lizenztext"), "README wird nicht gelesen");
    }

    #[test]
    fn lizenztext_nimmt_lizenz_datei_wenn_gesetzt() {
        let ordner = tempfile::tempdir().unwrap();
        std::fs::write(ordner.path().join("LICENSE-MIT"), "MIT TEXT\n").unwrap();
        std::fs::write(ordner.path().join("NOTICE"), "NOTICE TEXT\n").unwrap();

        let text = lizenztext_lesen(ordner.path(), Some("NOTICE")).unwrap();
        assert!(text.contains("NOTICE TEXT"));
        assert!(!text.contains("MIT TEXT"), "nur die benannte Datei: {text}");
    }

    #[test]
    fn fehlender_lizenztext_ist_ein_fehler() {
        let ordner = tempfile::tempdir().unwrap();
        std::fs::write(ordner.path().join("README.md"), "kein Lizenztext\n").unwrap();
        assert!(matches!(
            lizenztext_lesen(ordner.path(), None).unwrap_err(),
            Fehler::KeinLizenztext { .. }
        ));
    }

    #[test]
    fn enthaltene_baut_vier_felder() {
        let ordner = tempfile::tempdir().unwrap();
        let paket_ordner = ordner.path().join("a");
        std::fs::create_dir(&paket_ordner).unwrap();
        std::fs::write(paket_ordner.join("LICENSE"), "Copyright 2026 Ada\n").unwrap();

        let md = graph_mit_a(ordner.path(), r#", "license":"MIT""#);
        let pakete = enthaltene(&md, &nur_a()).unwrap();
        assert_eq!(pakete.len(), 1);
        assert_eq!(pakete[0].name, "a");
        assert_eq!(pakete[0].version, "1.0.0");
        assert_eq!(pakete[0].lizenz, "MIT");
        assert!(pakete[0].urhebertext.contains("Copyright 2026 Ada"));
    }

    #[test]
    fn paket_ohne_lizenzangabe_ist_ein_fehler_mit_namen() {
        let ordner = tempfile::tempdir().unwrap();
        std::fs::create_dir(ordner.path().join("a")).unwrap();
        let md = graph_mit_a(ordner.path(), "");
        match enthaltene(&md, &nur_a()).unwrap_err() {
            Fehler::PaketOhneLizenz { paket } => assert_eq!(paket, "a 1.0.0"),
            andere => panic!("erwartet PaketOhneLizenz, war {andere:?}"),
        }
    }

    #[test]
    fn ausnahmen_tragen_name_version_grund() {
        let komplett = lesen(KOMPLETT).unwrap();
        let ziel = lesen(ZIEL).unwrap();
        let a = auswahl(&komplett, &[&ziel, &ziel]);

        let paare: Vec<(String, String, &str)> = ausnahmen(&komplett, &a)
            .iter()
            .map(|x| (x.name.clone(), x.version.clone(), x.grund.wort()))
            .collect();
        assert_eq!(
            paare,
            vec![
                ("b".to_string(), "1.0.0".to_string(), "dev"),
                ("d".to_string(), "1.0.0".to_string(), "plattformfremd"),
                ("ws".to_string(), "0.1.0".to_string(), "workspace"),
            ]
        );
    }

    #[test]
    fn formatiere_schreibt_vier_felder_und_ausnahmen() {
        let pakete = vec![Paket {
            name: "a".to_string(),
            version: "1.0.0".to_string(),
            lizenz: "MIT".to_string(),
            urhebertext: "Copyright 2026 Ada\n".to_string(),
        }];
        let ausnahmen = vec![Ausnahme {
            name: "b".to_string(),
            version: "2.0.0".to_string(),
            grund: AusnahmeGrund::Dev,
        }];

        let text = formatiere(&pakete, &ausnahmen);
        assert!(text.contains("## Enthaltene Pakete"), "{text}");
        assert!(text.contains("### a 1.0.0"), "Name und Version: {text}");
        assert!(text.contains("Lizenz: MIT"), "Lizenzfeld");
        assert!(text.contains("Urhebertext:"), "Urhebertextfeld");
        assert!(text.contains("Copyright 2026 Ada"), "Urhebertext");
        assert!(text.contains("## Ausgenommene Pakete"), "Ausnahmenabschnitt");
        assert!(text.contains("| b | 2.0.0 | dev |"), "Ausnahmenzeile: {text}");
    }

    const FRISCH: &str = concat!(
        "## Enthaltene Pakete\n\n",
        "### a 1.0.0\nLizenz: MIT\nUrhebertext:\n\ntext a\n\n",
        "### b 2.0.0\nLizenz: MIT\nUrhebertext:\n\ntext b\n\n",
        "## Ausgenommene Pakete\n\n",
        "| Paket | Version | Grund |\n| --- | --- | --- |\n",
        "| c | 3.0.0 | dev |\n",
        "| kanband | 0.1.0 | workspace |\n",
    );

    #[test]
    fn pruefen_gleich_ist_ok() {
        assert!(pruefen(FRISCH, FRISCH).is_ok());
    }

    #[test]
    fn pruefen_nennt_fehlendes_paket() {
        // M1-Form: ein Eintrag fehlt in der committeten Datei.
        let datei = FRISCH.replace("### b 2.0.0\nLizenz: MIT\nUrhebertext:\n\ntext b\n\n", "");
        assert_ne!(datei, FRISCH, "die Mutation muss greifen");

        let namen = pruefen(&datei, FRISCH).unwrap_err();
        assert!(
            namen.iter().any(|n| n.contains("fehlt in der Datei: b 2.0.0")),
            "der fehlende Name steht in der Meldung: {namen:?}"
        );
    }

    #[test]
    fn pruefen_nennt_paket_in_den_ausnahmen() {
        // M2-Form: ein enthaltenes Paket steht von Hand in der Ausnahmetabelle.
        let datei = FRISCH
            .replace("### b 2.0.0\nLizenz: MIT\nUrhebertext:\n\ntext b\n\n", "")
            .replace("| c | 3.0.0 | dev |", "| b | 2.0.0 | dev |\n| c | 3.0.0 | dev |");
        assert_ne!(datei, FRISCH, "die Mutation muss greifen");

        let namen = pruefen(&datei, FRISCH).unwrap_err();
        assert!(
            namen.iter().any(|n| n.contains("unerwartet in den Ausnahmen: b 2.0.0")),
            "das falsch ausgenommene Paket steht in der Meldung: {namen:?}"
        );
    }

    #[test]
    fn pruefen_ueberlebt_den_versionswechsel_des_workspace_pakets() {
        // B1: Der Release-Ablauf setzt die Version des Workspace-Pakets per `sed`;
        // die Datei bleibt sonst gleich und gilt weiter als aktuell.
        let datei = FRISCH.replace("| kanband | 0.1.0 | workspace |", "| kanband | 1.2.3 | workspace |");
        assert_ne!(datei, FRISCH, "die Mutation muss greifen");
        assert!(pruefen(&datei, FRISCH).is_ok(), "die Version des Workspace-Pakets zählt nicht");
    }

    #[test]
    fn pruefen_bricht_bei_veralteter_paketversion() {
        // Gegenstück: eine geänderte Version eines fremden Pakets bleibt ein Fehler.
        let datei = FRISCH.replace("| c | 3.0.0 | dev |", "| c | 2.9.0 | dev |");
        assert_ne!(datei, FRISCH, "die Mutation muss greifen");
        let namen = pruefen(&datei, FRISCH).unwrap_err();
        assert!(
            namen.iter().any(|n| n.contains("unerwartet in den Ausnahmen: c 2.9.0")),
            "die veraltete Fremdversion wird gemeldet: {namen:?}"
        );
    }
}
