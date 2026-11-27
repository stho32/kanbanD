// R00269 (I0258, Karte #272): Logging nach ADR-0001, Scheibe 2a — das Fluten der Lesegrenze und des Antwortbudgets
// schreibt je Episode eine Beginn- und (nach 10 s Ruhe) eine Ende-Zeile. Maßstab ADR-0001 N1.4 Regel 5/6.
//
// Schichten: Testfall (je AK) → Testsprache (`Probe`) → Treiber (`rufen`, in-process über `tower::ServiceExt`)
// → Programm. Die Sammler-Senke und die gestellte Uhr machen die Zeilen ohne Warten und ohne `sleep` lesbar
// (ADR-0001 N1.7, ADR-0026 N7 Regel 13).
mod gemeinsam;

use axum::body::Body;
use axum::http::Request;
use kanband::dienst::Kanban;
use kanband::protokoll::{Protokoll, Sammler};
use kanband::uhr::{FesteUhr, Uhr};
use serde_json::Value;
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tower::ServiceExt;

/// `kanbanD.md` mit Agent `cl` und der Anwendung `kc`, deren WBS im Arbeits-Repository liegt.
fn kanban_md(arbeit: &Path) -> String {
    format!(
        "---\npeople:\n  cl: {{name: Claude, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kc: {{name: Kasse, wbs: {}/Dokumentation/Planung/kasse.md, requirements: \"\"}}\n---\n",
        arbeit.display()
    )
}

const BOARD: &str = "# Entwicklung\n\n## Eingang\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n\n## Fertig\n";

/// Die Ausgangslage von R00269: Aufgaben #1–#4, #1 trägt den Commit `kc:<hash>`.
fn lage(pfad: &Path, arbeit: &Path, commit: &str) {
    std::fs::create_dir_all(pfad.join("boards")).unwrap();
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("kanbanD.md"), kanban_md(arbeit)).unwrap();
    std::fs::write(pfad.join("boards/entwicklung.md"), BOARD).unwrap();
    std::fs::write(pfad.join("aufgaben/0001-eins.md"), format!("---\nid: 1\ntitle: eins\ncommits:\n  - kc:{commit}\n---\n")).unwrap();
    for nr in 2..=4 {
        std::fs::write(pfad.join(format!("aufgaben/{nr:04}-k{nr}.md")), format!("---\nid: {nr}\ntitle: k{nr}\n---\n")).unwrap();
    }
    gemeinsam::git(pfad, &["init", "-q"]);
    gemeinsam::git(pfad, &["add", "-A"]);
    gemeinsam::git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgangslage"]);
}

/// Eine Instanz in-process: der echte Router mit Sammler-Senke (ADR-0001 N1.7 Regel 1) und stellbarer Uhr.
struct Probe {
    _tmp: tempfile::TempDir,
    _arbeit: tempfile::TempDir,
    commit: String,
    app: axum::Router,
    sammler: Sammler,
    uhr: Arc<FesteUhr>,
    kanban: Arc<Kanban>,
}

impl Probe {
    /// Die Standardprobe: eine kurze Gesamtgrenze, damit eine belegte Lesegrenze nicht die vollen 10 s wartet (AK 1).
    fn neu() -> Probe {
        Probe::mit(Duration::from_millis(30), None)
    }

    /// `gesamtgrenze` verkürzt die Frist der Testinstanz (AK 1), `antwortbudget` verkleinert ihr Budget (AK 4).
    fn mit(gesamtgrenze: Duration, antwortbudget: Option<usize>) -> Probe {
        let (arbeit, arbeit_pfad) = gemeinsam::arbeits_repository("# App\n");
        std::fs::write(arbeit_pfad.join("a.txt"), "a\n").unwrap();
        gemeinsam::git(&arbeit_pfad, &["add", "-A"]);
        gemeinsam::git(&arbeit_pfad, &["-c", "user.name=K", "-c", "user.email=k@k", "commit", "-q", "-m", "a"]);
        let commit = gemeinsam::git(&arbeit_pfad, &["rev-parse", "HEAD"]);
        let tmp = tempfile::tempdir().unwrap();
        lage(tmp.path(), &arbeit_pfad, &commit);
        let uhr = Arc::new(FesteUhr::aus_rfc3339("2026-11-27T10:00:00+01:00"));
        let (protokoll, sammler) = Protokoll::sammler_mit_uhr(uhr.clone());
        let mut kanban = Kanban::neu_mit_protokoll(tmp.path().to_path_buf(), protokoll.clone()).mit_gesamtgrenze(gesamtgrenze);
        if let Some(bytes) = antwortbudget {
            kanban = kanban.mit_antwortbudget(bytes);
        }
        let kanban = Arc::new(kanban);
        let app = kanband::web::router_mit_kanban(kanban.clone(), 0, protokoll);
        Probe { _tmp: tmp, _arbeit: arbeit, commit, app, sammler, uhr, kanban }
    }

    /// Belegt alle Plätze der Lesegrenze, bis der Rückgabewert fällt (AK 1).
    fn lesegrenze_fuellen(&self) -> Vec<kanband::dienst::Leseplatz<'_>> {
        let fern = Instant::now() + Duration::from_secs(30);
        (0..kanband::dienst::LESEN_HOECHSTENS).map(|_| self.kanban.lesegrenze_betreten(fern).expect("Platz der Lesegrenze")).collect()
    }

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

    fn zaehle(&self, merkmal: &str) -> usize {
        self.zeilen().iter().filter(|z| z.contains(merkmal)).count()
    }

    /// Die Uhr um `sekunden` Sekunden vorstellen — gestellte Zeit statt `sleep` (ADR-0026 N7 Regel 13).
    fn weiter(&self, sekunden: i64) {
        self.uhr.stellen(self.uhr.jetzt() + chrono::Duration::seconds(sekunden));
    }
}

// ---- AK 1 (P3): das Fluten der Lesegrenze schreibt eine Beginn-Zeile ---------------------------------------

#[tokio::test]
async fn ak1_fluten_der_lesegrenze_schreibt_eine_beginn_zeile() {
    let probe = Probe::neu();
    let plaetze = probe.lesegrenze_fuellen();
    for _ in 0..3 {
        let (status, rumpf) = probe.rufen("GET", "api/aufgaben/1/commits", "cl", None).await;
        assert_eq!(status, 503, "{rumpf}");
        assert!(rumpf.starts_with("{\"fehler\":\"Lesegrenze"), "der Rumpf bleibt die Lesegrenze: {rumpf}");
    }
    drop(plaetze);
    assert_eq!(probe.zaehle(" WARN abgewiesen "), 1, "genau eine Zeile je Episode: {:?}", probe.zeilen());
    let zeile = probe.zeilen().iter().find(|z| z.contains(" WARN abgewiesen ")).cloned().unwrap();
    for erwartet in ["ursache=lesegrenze", "episode=beginn", "belegt=4/4", "endpunkt=/api/aufgaben/{nr}/commits", "aufgabe=#1"] {
        assert!(zeile.contains(erwartet), "{erwartet} fehlt in {zeile}");
    }
}

// ---- AK 3: der ganze Sturm ist eine Zeile, das Ende meldet alle Abweisungen ---------------------------------

#[tokio::test]
async fn ak3_der_sturm_ist_eine_zeile_und_das_ende_zaehlt_alle() {
    let probe = Probe::neu();
    let plaetze = probe.lesegrenze_fuellen();
    for _ in 0..23 {
        let (status, _) = probe.rufen("GET", "api/aufgaben/1/commits", "cl", None).await;
        assert_eq!(status, 503);
    }
    drop(plaetze);
    assert_eq!(probe.zaehle(" WARN abgewiesen "), 1, "der Sturm ist eine Zeile: {:?}", probe.zeilen());
    // das Ende nach 10 s Ruhe meldet alle 23
    probe.weiter(10);
    let (status, _) = probe.rufen("GET", "api/aufgaben/2", "cl", None).await;
    assert_eq!(status, 200);
    let ende = probe.zeilen().into_iter().find(|z| z.contains(" INFO Episode beendet ")).expect("Ende-Zeile");
    assert!(ende.contains("ursache=lesegrenze") && ende.contains("abweisungen=23"), "{ende}");
}

// ---- AK 7: die Ruhe wird bei jeder Anfrage geprüft, vor der Antwort ----------------------------------------

#[tokio::test]
async fn ak7_die_ruhe_wird_bei_jeder_anfrage_geprueft() {
    let probe = Probe::neu();
    let plaetze = probe.lesegrenze_fuellen();
    let (status, _) = probe.rufen("GET", "api/aufgaben/1/commits", "cl", None).await;
    assert_eq!(status, 503);
    drop(plaetze);
    // bei t_letzte+9 s (gestellte Zeit): keine Ende-Zeile
    probe.weiter(9);
    let (status, _) = probe.rufen("GET", "api/aufgaben/2", "cl", None).await;
    assert_eq!(status, 200);
    assert_eq!(probe.zaehle(" INFO Episode beendet "), 0, "9 s Ruhe reichen nicht: {:?}", probe.zeilen());
    // bei t_letzte+10 s: genau 1 Ende-Zeile, sie steht nach dem `await` der Antwort im Sammler
    probe.weiter(1);
    let (status, _) = probe.rufen("GET", "api/aufgaben/2", "cl", None).await;
    assert_eq!(status, 200);
    assert_eq!(probe.zaehle(" INFO Episode beendet "), 1, "genau eine Ende-Zeile: {:?}", probe.zeilen());
    let ende = probe.zeilen().into_iter().find(|z| z.contains(" INFO Episode beendet ")).unwrap();
    assert!(ende.contains("ursache=lesegrenze") && ende.contains("abweisungen=1"), "{ende}");
}

// ---- AK 4: das Fluten des Antwortbudgets, ohne belegt_max --------------------------------------------------

#[tokio::test]
async fn ak4_fluten_des_antwortbudgets_ohne_belegt_max() {
    let probe = Probe::mit(Duration::from_secs(10), Some(0));
    let pfad = format!("api/aufgaben/1/diff?commit=kc:{}", probe.commit);
    for _ in 0..3 {
        let (status, rumpf) = probe.rufen("GET", &pfad, "cl", None).await;
        assert_eq!(status, 503, "{rumpf}");
        assert!(rumpf.starts_with("{\"fehler\":\"Antwortbudget"), "der Rumpf bleibt das Antwortbudget: {rumpf}");
    }
    assert_eq!(probe.zaehle(" WARN abgewiesen "), 1, "genau eine Zeile je Episode: {:?}", probe.zeilen());
    let zeile = probe.zeilen().iter().find(|z| z.contains(" WARN abgewiesen ")).cloned().unwrap();
    for erwartet in ["ursache=antwortbudget", "episode=beginn", "frei_kb=0"] {
        assert!(zeile.contains(erwartet), "{erwartet} fehlt in {zeile}");
    }
    // nach 10 s Ruhe endet die Episode, ohne belegt_max
    probe.weiter(10);
    let (status, _) = probe.rufen("GET", "api/aufgaben/2", "cl", None).await;
    assert_eq!(status, 200);
    let ende = probe.zeilen().into_iter().find(|z| z.contains(" INFO Episode beendet ")).expect("Ende-Zeile");
    assert!(ende.contains("ursache=antwortbudget") && ende.contains("abweisungen=3") && ende.contains("dauer_ms="), "{ende}");
    assert!(!ende.contains("belegt_max"), "das Antwortbudget hat kein belegt_max: {ende}");
}

// ---- AK 10: der Messwert steht nur im Log, Antworten und Routen bleiben unverändert ------------------------

#[tokio::test]
async fn ak10_messwert_nur_im_log_antworten_unveraendert() {
    let probe = Probe::neu();
    let plaetze = probe.lesegrenze_fuellen();
    let (status, rumpf) = probe.rufen("GET", "api/aufgaben/1/commits?x=GEHEIM-272", "cl", None).await;
    assert_eq!(status, 503);
    assert_eq!(rumpf, "{\"fehler\":\"Lesegrenze von 4 gleichzeitigen Lesevorgängen bis zur Frist von 10 s belegt, Git nicht gestartet — keine Liste\"}", "Rumpf bytegleich");
    drop(plaetze);
    assert_eq!(probe.zeilen().iter().filter(|z| z.contains("GEHEIM-272")).count(), 0, "die Query steht nie im Log: {:?}", probe.zeilen());
    // keine neue Route: die Episoden brauchen keine; jede (Methode, Pfad) der Endpunktliste bleibt eindeutig
    let (status, liste) = probe.rufen("GET", "api/endpunkte", "cl", None).await;
    assert_eq!(status, 200);
    let routen: Value = serde_json::from_str(&liste).unwrap();
    let routen = routen.as_array().unwrap();
    let paare: Vec<(String, String)> = routen.iter().map(|e| (e["methode"].as_str().unwrap().to_string(), e["pfad"].as_str().unwrap().to_string())).collect();
    let mut sortiert = paare.clone();
    sortiert.sort();
    sortiert.dedup();
    assert_eq!(sortiert.len(), paare.len(), "keine doppelte Route");
    assert!(paare.iter().all(|(_, p)| !p.contains("episod")), "keine Episoden-Route: {paare:?}");
    assert_eq!(paare.iter().filter(|(m, p)| m == "GET" && p == "/api/aufgaben/{nr}/commits").count(), 1, "die Commits-Route bleibt einmal");
}
