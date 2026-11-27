// R00258 (I0248, Karte #239) Nacharbeit 1 — Muss 1: Werte aus Rumpf/Query stehen im Protokoll nur als Länge.
//
// Schichten wie in `akzeptanz_r00258.rs`: Testfall (je Weg) → Testsprache (`Probe`) → Treiber (`rufen`, in-process
// über `tower::ServiceExt`) → Programm. Der Marker belegt, dass der Wert im Rumpf bleibt und im Protokoll fehlt.
mod gemeinsam;

use axum::body::Body;
use axum::http::Request;
use kanband::protokoll::{Protokoll, Sammler};
use kanband::uhr::FesteUhr;
use serde_json::{Value, json};
use std::path::Path;
use std::sync::Arc;
use tower::ServiceExt;

const KANBAND: &str = "---\npeople:\n  cl: {name: Claude, kind: agent}\n  mi: {name: Mensch, kind: human}\nclasses: {}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n---\n";

const BOARD: &str = "---\nlimits:\n  Voll: 1\ncolumn-owner:\n  Eingang: human\n---\n\n# Entwicklung\n\n## Eingang\n\n- [#1](../aufgaben/0001-eins.md)\n\n## In Arbeit\n\n- [#2](../aufgaben/0002-zwei.md)\n\n## Voll\n\n- [#3](../aufgaben/0003-drei.md)\n\n## Fertig\n";

/// Die Ausgangslage: Agent `cl`, Mensch `mi`, Aufgaben #1–#15, ein Board mit Grenze und Menschen-Spalte.
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

/// Eine Instanz in-process: der echte Router mit Sammler-Senke statt Datei (ADR-0001 N1.7 Regel 1).
struct Probe {
    _tmp: tempfile::TempDir,
    app: axum::Router,
    sammler: Sammler,
}

impl Probe {
    fn neu() -> Probe {
        let tmp = tempfile::tempdir().unwrap();
        lage(tmp.path());
        let (protokoll, sammler) = Protokoll::sammler_mit_uhr(Arc::new(FesteUhr::aus_rfc3339("2026-11-26T09:00:00+01:00")));
        let app = kanband::web::router_mit_protokoll(tmp.path().to_path_buf(), 0, protokoll);
        Probe { _tmp: tmp, app, sammler }
    }

    async fn rufen(&self, methode: &str, pfad: &str, wer: &str, rumpf: Value) -> (u16, String) {
        let anfrage = Request::builder()
            .method(methode)
            .uri(format!("/{pfad}"))
            .header("X-KanbanD-Wer", wer)
            .header("content-type", "application/json")
            .body(Body::from(serde_json::to_vec(&rumpf).unwrap()))
            .unwrap();
        let antwort = self.app.clone().oneshot(anfrage).await.unwrap();
        let status = antwort.status().as_u16();
        let bytes = axum::body::to_bytes(antwort.into_body(), usize::MAX).await.unwrap();
        (status, String::from_utf8_lossy(&bytes).to_string())
    }

    fn zeilen(&self) -> Vec<String> {
        self.sammler.lock().unwrap().clone()
    }

    fn letzte_abgewiesen(&self) -> String {
        self.zeilen().into_iter().filter(|z| z.contains(" WARN abgewiesen ")).next_back().expect("eine Abweisungszeile")
    }
}

/// `<n Zeichen>` für einen Marker — die Erwartung wird gerechnet, nicht gezählt.
fn kurz(marker: &str) -> String {
    format!("<{} Zeichen>", marker.chars().count())
}

/// Ein Fall: Weg, Rumpf, Status, ein Teil des Antwortrumpfs und der erwartete `grund`-Teil des Protokolls.
struct Fall {
    weg: &'static str,
    pfad: &'static str,
    rumpf: Value,
    status: u16,
    im_rumpf: String,
    im_grund: String,
    marker: Vec<&'static str>,
}

/// Die Wege des Auftrags mit einem Marker je Fundstelle (Muss 1).
fn faelle() -> Vec<Fall> {
    let datum = "GEHEIMMARKER";
    let herkunft = "GEHEIM-HERKUNFT";
    let anwendung = "gehmapp";
    let signal = "GEHEIM-SIGNAL";
    let person = "GEHEIM-PERSON";
    let costkey = "GEHEIM-SCHLUESSEL";
    let klasse = "GEHEIM-KLASSE";
    let mehrere = "GEHEIM-MEHRERE";
    let neu = "GEHEIM-NEU";
    let post = "GEHEIM-POST";
    let innen = "GEHEIM-INNEN";
    let innen2 = "GEHEIM-INNEN2";
    let commit = "GEHEIM-COMMIT";
    let alt = "GEHEIM-ALT";
    let neu2 = "GEHEIM-NEU2";
    let termin = "GEHEIM-TERMIN";
    let tdatum = "GEHEIM-DATUM";
    vec![
        Fall { weg: "PATCH", pfad: "api/aufgaben/1", rumpf: json!({"faellig": datum}), status: 400, im_rumpf: format!("Fälligkeit „{datum}“: erwartet JJJJ-MM-TT"), im_grund: format!("Fälligkeit „{}“: erwartet JJJJ-MM-TT", kurz(datum)), marker: vec![datum] },
        Fall { weg: "PATCH", pfad: "api/aufgaben/1", rumpf: json!({"herkunft": [herkunft]}), status: 400, im_rumpf: format!("„{herkunft}“ ist keine Herkunft"), im_grund: format!("„{}“ ist keine Herkunft", kurz(herkunft)), marker: vec![herkunft] },
        Fall { weg: "PATCH", pfad: "api/aufgaben/1", rumpf: json!({"herkunft": [format!("{anwendung}:I0007")]}), status: 400, im_rumpf: format!("Anwendung „{anwendung}“ steht nicht in kanbanD.md"), im_grund: format!("Anwendung „{}“ steht nicht in kanbanD.md", kurz(anwendung)), marker: vec![anwendung] },
        Fall { weg: "PATCH", pfad: "api/aufgaben/1", rumpf: json!({"signale": [signal]}), status: 400, im_rumpf: format!("Signal „{signal}“ steht nicht in kanbanD.md"), im_grund: format!("Signal „{}“ steht nicht in kanbanD.md", kurz(signal)), marker: vec![signal] },
        Fall { weg: "PATCH", pfad: "api/aufgaben/1", rumpf: json!({"zustaendige": [person]}), status: 400, im_rumpf: format!("Person „{person}“ steht nicht in kanbanD.md"), im_grund: format!("Person „{}“ steht nicht in kanbanD.md", kurz(person)), marker: vec![person] },
        Fall { weg: "PATCH", pfad: "api/aufgaben/1", rumpf: json!({"cost": {"currency": "EUR", costkey: 1}}), status: 400, im_rumpf: format!("cost: unbekannter Schlüssel „{costkey}“"), im_grund: format!("cost: unbekannter Schlüssel „{}“", kurz(costkey)), marker: vec![costkey] },
        Fall { weg: "PATCH", pfad: "api/aufgaben/1", rumpf: json!({"klasse": klasse}), status: 400, im_rumpf: format!("Klasse „{klasse}“"), im_grund: format!("Klasse „{}“", kurz(klasse)), marker: vec![klasse] },
        Fall { weg: "PATCH", pfad: "api/aufgaben/mehrere", rumpf: json!({"aenderungen": [{"nummer": 1, "faellig": mehrere}]}), status: 400, im_rumpf: format!("#1: Fälligkeit „{mehrere}“: erwartet JJJJ-MM-TT"), im_grund: format!("#1: Fälligkeit „{}“: erwartet JJJJ-MM-TT", kurz(mehrere)), marker: vec![mehrere] },
        Fall { weg: "POST", pfad: "api/aufgaben", rumpf: json!({"titel": neu, "faellig": post}), status: 400, im_rumpf: format!("„{neu}“: Fälligkeit „{post}“"), im_grund: format!("„{}“: Fälligkeit „{}“", kurz(neu), kurz(post)), marker: vec![neu, post] },
        Fall { weg: "POST", pfad: "api/aufgaben/mehrere", rumpf: json!({"titel": [{"titel": innen, "faellig": innen2}]}), status: 400, im_rumpf: format!("„{innen}“: Fälligkeit „{innen2}“"), im_grund: format!("„{}“: Fälligkeit „{}“", kurz(innen), kurz(innen2)), marker: vec![innen, innen2] },
        Fall { weg: "POST", pfad: "api/aufgaben/1/commits", rumpf: json!({"commits": [commit]}), status: 400, im_rumpf: format!("„{commit}“ ist kein Commit-Verweis"), im_grund: format!("„{}“ ist kein Commit-Verweis", kurz(commit)), marker: vec![commit] },
        Fall { weg: "POST", pfad: "api/aufgaben/1/commits/ersetzen", rumpf: json!({"ersetzungen": [{"alt": alt, "neu": neu2}]}), status: 400, im_rumpf: format!("„{alt}“ ist kein Commit-Verweis"), im_grund: format!("„{}“ ist kein Commit-Verweis", kurz(alt)), marker: vec![alt] },
        Fall { weg: "PUT", pfad: "api/boards/entwicklung/termine", rumpf: json!([{"name": termin, "datum": tdatum, "farbe": "red"}]), status: 400, im_rumpf: format!("Termin „{termin}“: Datum „{tdatum}“ ist nicht JJJJ-MM-TT"), im_grund: format!("Termin „{}“: Datum „{}“ ist nicht JJJJ-MM-TT", kurz(termin), kurz(tdatum)), marker: vec![termin, tdatum] },
    ]
}

// ---- Muss 1: je Fundstelle steht im Log die Länge, der Rumpf behält den Wortlaut --------------------------

#[tokio::test]
async fn ak10_n1_werte_aus_rumpf_stehen_im_log_nur_als_laenge() {
    for f in faelle() {
        let probe = Probe::neu();
        let (status, rumpf) = probe.rufen(f.weg, f.pfad, "cl", f.rumpf.clone()).await;
        assert_eq!(status, f.status, "{} {} {}", f.weg, f.pfad, rumpf);
        assert!(rumpf.contains(&f.im_rumpf), "der Antwortrumpf behält den Wortlaut — erwartet {:?} in {rumpf}", f.im_rumpf);
        let zeile = probe.letzte_abgewiesen();
        assert!(zeile.contains("status=400") && zeile.contains("ursache=eingabe"), "{} {}: {zeile}", f.weg, f.pfad);
        assert!(zeile.contains(&f.im_grund), "erwartet {:?} in {zeile}", f.im_grund);
        for marker in &f.marker {
            assert!(!zeile.contains(marker), "{marker} steht im Log: {zeile}");
        }
    }
}

// ---- Kontrollpaar: ein gültiger Wert erzeugt keine Abweisungszeile ---------------------------------------

#[tokio::test]
async fn ak10_n1_gueltige_werte_erzeugen_keine_zeile() {
    let probe = Probe::neu();
    let (status, _) = probe.rufen("PATCH", "api/aufgaben/1", "cl", json!({"faellig": "2026-12-24", "labels": ["harmlos"]})).await;
    assert_eq!(status, 200, "{:?}", probe.zeilen());
    assert_eq!(probe.zeilen().iter().filter(|z| z.contains(" WARN abgewiesen ")).count(), 0, "{:?}", probe.zeilen());
}
