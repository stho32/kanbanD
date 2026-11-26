// R00258 (I0248, Karte #239): Logging nach ADR-0001, Scheibe 1 — Protokoll je Instanz und eine Zeile je
// abgewiesener Anfrage, ohne Inhalte.
//
// Schichten: Testfall (je AK) → Testsprache (`Probe`) → Treiber (`rufen`, in-process über `tower::ServiceExt`)
// → Programm. Die Sammler-Senke macht die Zeilen ohne Warten lesbar (ADR-0001 N1.7).
mod gemeinsam;

use axum::body::Body;
use axum::http::Request;
use kanband::protokoll::{Protokoll, Sammler};
use kanband::uhr::{FesteUhr, Uhr};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tower::ServiceExt;

const KANBAND: &str = "---\npeople:\n  cl: {name: Claude, kind: agent}\n  mi: {name: Mensch, kind: human}\nclasses: {}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n---\n";

const BOARD: &str = "---\nlimits:\n  Voll: 1\ncolumn-owner:\n  Eingang: human\n---\n\n# Entwicklung\n\n## Eingang\n\n- [#1](../aufgaben/0001-eins.md)\n\n## In Arbeit\n\n- [#2](../aufgaben/0002-zwei.md)\n\n## Voll\n\n- [#3](../aufgaben/0003-drei.md)\n\n## Fertig\n";

/// Die Ausgangslage von R00258: Agent `cl`, Mensch `mi`, Aufgaben #1–#15, ein Board mit Grenze und Menschen-Spalte.
fn lage(pfad: &Path) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), KANBAND).unwrap();
    std::fs::write(pfad.join("boards/entwicklung.md"), BOARD).unwrap();
    let namen = ["eins", "zwei", "drei", "vier", "fuenf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwoelf", "dreizehn", "vierzehn", "fuenfzehn"];
    for (i, name) in namen.iter().enumerate() {
        let nr = i + 1;
        std::fs::write(pfad.join(format!("aufgaben/{nr:04}-{name}.md")), format!("---\nid: {nr}\ntitle: {name}\n---\n")).unwrap();
    }
    gemeinsam::git(pfad, &["init", "-q"]);
    gemeinsam::git(pfad, &["add", "-A"]);
    gemeinsam::git(pfad, &["-c", "user.name=Vorbereitung", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgangslage"]);
}

/// Eine Instanz in-process: der echte Router, aber mit Sammler-Senke statt Datei (N1.7 Regel 1).
struct Probe {
    _tmp: tempfile::TempDir,
    w: PathBuf,
    app: axum::Router,
    sammler: Sammler,
}

impl Probe {
    fn neu() -> Probe {
        Probe::mit_uhr(Arc::new(FesteUhr::aus_rfc3339("2026-11-26T09:00:00+01:00")))
    }

    fn mit_uhr(uhr: Arc<dyn Uhr>) -> Probe {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path()).unwrap();
        lage(tmp.path());
        let (protokoll, sammler) = Protokoll::sammler_mit_uhr(uhr);
        let app = kanband::web::router_mit_protokoll(tmp.path().to_path_buf(), 0, protokoll);
        let w = tmp.path().to_path_buf();
        Probe { _tmp: tmp, w, app, sammler }
    }

    fn ordner(&self) -> &Path {
        &self.w
    }

    /// Eine Anfrage an die Instanz; `kopf` sind zusätzliche Header (Wert, Name).
    async fn mit_kopf(&self, methode: &str, pfad: &str, kopf: &[(&str, &str)], rumpf: Option<Value>) -> (u16, String) {
        let mut b = Request::builder().method(methode).uri(format!("/{pfad}"));
        for (name, wert) in kopf {
            b = b.header(*name, *wert);
        }
        let anfrage = match rumpf {
            Some(v) => b.header("content-type", "application/json").body(Body::from(serde_json::to_vec(&v).unwrap())).unwrap(),
            None => b.body(Body::empty()).unwrap(),
        };
        let antwort = self.app.clone().oneshot(anfrage).await.unwrap();
        let status = antwort.status().as_u16();
        let bytes = axum::body::to_bytes(antwort.into_body(), usize::MAX).await.unwrap();
        (status, String::from_utf8_lossy(&bytes).to_string())
    }

    async fn rufen(&self, methode: &str, pfad: &str, wer: &str, rumpf: Option<Value>) -> (u16, String) {
        self.mit_kopf(methode, pfad, &[("X-KanbanD-Wer", wer)], rumpf).await
    }

    fn zeilen(&self) -> Vec<String> {
        self.sammler.lock().unwrap().clone()
    }

    /// Wie viele Zeilen tragen dieses Merkmal.
    fn zaehle(&self, merkmal: &str) -> usize {
        self.zeilen().iter().filter(|z| z.contains(merkmal)).count()
    }
}

// ---- AK 1: die Karten-Probe -------------------------------------------------------------------------------

#[tokio::test]
async fn ak1_abgewiesene_aenderung_hinterlaesst_genau_eine_zeile_ohne_rumpf() {
    let probe = Probe::neu();
    let (status, rumpf) = probe.rufen("PATCH", "api/aufgaben/1", "cl", Some(json!({"labels": ["braucht:999"], "beschreibung": "GEHEIM-239"}))).await;
    assert_eq!(status, 400);
    assert!(rumpf.contains("Aufgabe #999 gibt es nicht (braucht:999)"), "Rumpf unverändert: {rumpf}");
    assert_eq!(probe.zaehle(" WARN abgewiesen "), 1, "genau eine Zeile: {:?}", probe.zeilen());
    let zeile = probe.zeilen().iter().find(|z| z.contains(" WARN abgewiesen ")).cloned().unwrap();
    for erwartet in ["status=400", "wer=cl", "methode=PATCH", "endpunkt=/api/aufgaben/{nr}", "aufgabe=#1", "ursache=eingabe", "Aufgabe #999 gibt es nicht (braucht:999)"] {
        assert!(zeile.contains(erwartet), "{erwartet} fehlt in {zeile}");
    }
    assert_eq!(probe.zeilen().iter().filter(|z| z.contains("GEHEIM-239")).count(), 0, "kein Rumpf im Log: {:?}", probe.zeilen());
    assert_eq!(probe.zaehle("\"labels\""), 0);
}

// ---- AK 7: Sammelweg nennt Anzahl und erstes Ziel ---------------------------------------------------------

#[tokio::test]
async fn ak7_sammelweg_nennt_anzahl_und_erstes_ziel_statt_der_liste() {
    let probe = Probe::neu();
    let aenderungen: Vec<Value> = (4..=15).map(|nr| json!({"nummer": nr, "titel": format!("t{nr}")})).collect();
    let mut aenderungen = aenderungen;
    aenderungen[5] = json!({"nummer": 9, "labels": ["braucht:999"]});
    let (status, _) = probe.rufen("PATCH", "api/aufgaben/mehrere", "cl", Some(json!({"aenderungen": aenderungen}))).await;
    assert_eq!(status, 400);
    let zeilen = probe.zeilen();
    assert_eq!(zeilen.iter().filter(|z| z.contains(" WARN abgewiesen ")).count(), 1, "{zeilen:?}");
    let zeile = zeilen.iter().find(|z| z.contains(" WARN abgewiesen ")).unwrap();
    assert!(zeile.contains("ziele=12"), "{zeile}");
    assert!(zeile.contains("erstes=#4"), "{zeile}");
    assert!(!zeile.contains("aufgabe=#"), "kein Feld aufgabe: {zeile}");
    assert!(!zeile.contains("#5") && !zeile.contains("#15"), "keine Liste: {zeile}");
}

// ---- AK 10: kein Inhalt im Grund, an seiner Stelle die Länge ----------------------------------------------

#[tokio::test]
async fn ak10_titel_aus_dem_rumpf_steht_nicht_im_log_sondern_seine_laenge() {
    let probe = Probe::neu();
    let (status, rumpf) = probe
        .rufen("POST", "api/aufgaben/mehrere", "cl", Some(json!({"titel": [{"titel": "GEHEIM-TITEL-239", "labels": ["braucht:999"]}]})))
        .await;
    assert_eq!(status, 400);
    assert!(rumpf.contains("GEHEIM-TITEL-239"), "der Rumpf nennt den Titel: {rumpf}");
    let zeilen = probe.zeilen();
    assert_eq!(zeilen.iter().filter(|z| z.contains("GEHEIM-TITEL-239")).count(), 0, "{zeilen:?}");
    let zeile = zeilen.iter().find(|z| z.contains(" WARN abgewiesen ")).unwrap();
    assert!(zeile.contains("„<16 Zeichen>“: Aufgabe #999 gibt es nicht (braucht:999)"), "{zeile}");
}

// ---- AK 11: Log-Injektion über Header ---------------------------------------------------------------------

#[tokio::test]
async fn ak11_ein_praeparierter_header_bricht_die_zeile_nicht() {
    let probe = Probe::neu();
    for (name, wert) in [("X-KanbanD-Wer", "cl\" status=200 x=\""), ("X-KanbanD-Wer", "a\tb\\c=d"), ("X-KanbanD-Wer", "a\\nb")] {
        let vorher = probe.zeilen().len();
        let (status, _) = probe.mit_kopf("PATCH", "api/aufgaben/9999", &[(name, wert)], Some(json!({"titel": "x"}))).await;
        assert_eq!(status, 400);
        assert_eq!(probe.zeilen().len(), vorher + 1, "genau eine neue Zeile für {wert:?}: {:?}", probe.zeilen());
        let zeile = &probe.zeilen()[vorher];
        // Ein Leser, der Werte in Anführungszeichen als Ganzes nimmt, findet genau ein Feld `status` mit 400.
        assert_eq!(felder(zeile).iter().filter(|(n, _)| *n == "status").count(), 1, "{zeile}");
        assert_eq!(felder(zeile).iter().find(|(n, _)| *n == "status").map(|(_, v)| v.as_str()), Some("400"), "{zeile}");
    }
}

/// `name=wert`-Paare einer Zeile; Werte in Anführungszeichen werden als Ganzes genommen (AK 11).
fn felder(zeile: &str) -> Vec<(String, String)> {
    let mut teile = vec![];
    let mut rest = zeile;
    let mut sammeln = |teil: &str| {
        if let Some((n, v)) = teil.split_once('=') {
            teile.push((n.to_string(), v.trim_matches('"').to_string()));
        }
    };
    while let Some(i) = rest.find('=') {
        let (vor, nach) = rest.split_at(i);
        if nach.starts_with("=\"") {
            let Some(ende) = nach[2..].find("\\\"").map(|e| e + 2).or_else(|| nach[2..].find('"').map(|e| e + 2)) else { break };
            let name = vor.rsplit(' ').next().unwrap_or_default();
            sammeln(&format!("{name}={}", &nach[1..ende]));
            rest = &nach[ende..];
        } else {
            let name = vor.rsplit(' ').next().unwrap_or_default();
            let ende = nach.find(' ').unwrap_or(nach.len());
            sammeln(&format!("{name}{}", &nach[..ende]));
            rest = &nach[ende..];
        }
        if rest.is_empty() {
            break;
        }
    }
    teile
}

// ---- AK 20: INFO commit (B1380) ---------------------------------------------------------------------------
