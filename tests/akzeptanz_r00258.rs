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
    // #16 ist defekt (unlesbares `estimate`) — für den 423-Fall aus AK 2
    std::fs::write(pfad.join("aufgaben/0016-kaputt.md"), "---\nid: 16\ntitle: kaputt\nestimate: abc\n---\n").unwrap();
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

/// `name=wert`-Paare einer Zeile; Werte in Anführungszeichen werden als Ganzes genommen, `\"` bricht sie nicht (AK 11).
fn felder(zeile: &str) -> Vec<(String, String)> {
    let b: Vec<char> = zeile.chars().collect();
    let mut felder = vec![];
    let mut i = 0;
    while i < b.len() {
        if b[i] == '=' {
            let mut start = i;
            while start > 0 && !b[start - 1].is_whitespace() {
                start -= 1;
            }
            let name: String = b[start..i].iter().collect();
            if !name.is_empty() && name.chars().all(|c| c.is_ascii_lowercase() || c == '_') {
                let mut j = i + 1;
                let wert;
                if j < b.len() && b[j] == '"' {
                    j += 1;
                    let mut s = String::new();
                    while j < b.len() {
                        if b[j] == '\\' && j + 1 < b.len() {
                            s.push(b[j]);
                            s.push(b[j + 1]);
                            j += 2;
                            continue;
                        }
                        if b[j] == '"' {
                            break;
                        }
                        s.push(b[j]);
                        j += 1;
                    }
                    wert = s;
                    i = j + 1;
                } else {
                    let mut s = String::new();
                    while j < b.len() && !b[j].is_whitespace() {
                        s.push(b[j]);
                        j += 1;
                    }
                    wert = s;
                    i = j;
                }
                felder.push((name, wert));
                continue;
            }
        }
        i += 1;
    }
    felder
}

// ---- AK 20: INFO commit ------------------------------------------------------------------------------------

#[tokio::test]
async fn ak20_ein_commit_hinterlaesst_eine_info_zeile_ohne_text() {
    let probe = Probe::neu();
    let (status, _) = probe.rufen("PATCH", "api/aufgaben/1", "cl", Some(json!({"titel": "GEHEIM-NEU-239"}))).await;
    assert_eq!(status, 200);
    let zeilen = probe.zeilen();
    assert_eq!(zeilen.iter().filter(|z| z.contains(" INFO commit ")).count(), 1, "{zeilen:?}");
    let zeile = zeilen.iter().find(|z| z.contains(" INFO commit ")).unwrap();
    assert!(zeile.contains("wer=cl"), "{zeile}");
    let dateien = gemeinsam::git(probe.ordner(), &["show", "--name-only", "--format=", "HEAD"]).lines().filter(|z| !z.trim().is_empty()).count();
    assert!(zeile.contains(&format!("dateien={dateien}")), "{zeile} erwartet dateien={dateien}");
    assert_eq!(zeilen.iter().filter(|z| z.contains("GEHEIM-NEU-239")).count(), 0, "{zeilen:?}");
}

// ---- AK 2: Ursache je Abweisung, abgetastet über die ganze Liste --------------------------------------------

#[tokio::test]
async fn ak2_jede_abweisung_traegt_status_und_ursache() {
    let probe = Probe::neu();
    // 403: Agent zieht eine Karte aus einer Spalte, die dem Menschen gehört
    let (status, _) = probe.mit_kopf("POST", "api/boards/entwicklung/ziehen", &[("X-KanbanD-Wer", "cl"), ("X-KanbanD-Instanz", "i1")], Some(json!({"von": "Eingang", "nach": "In Arbeit"}))).await;
    assert_eq!(status, 403);
    assert!(zeile_mit(&probe, "status=403").unwrap().contains("ursache=verboten"));
    // 409: Agent bewegt eine Karte in eine Spalte mit erreichter WIP-Grenze
    let (status, _) = probe.rufen("POST", "api/boards/entwicklung/bewegen", "cl", Some(json!({"nummer": 2, "spalte": "Voll"}))).await;
    assert_eq!(status, 409);
    assert!(zeile_mit(&probe, "status=409").unwrap().contains("ursache=grenze"));
    // 404: unbekannte Nummer
    let (status, _) = probe.rufen("PATCH", "api/aufgaben/9999", "cl", Some(json!({"titel": "x"}))).await;
    assert_eq!(status, 404);
    assert!(zeile_mit(&probe, "status=404").unwrap().contains("ursache=fehlt"));
    // 409 ohne Grenze: fremde gültige Reservierung
    let (status, _) = probe.mit_kopf("POST", "api/aufgaben/2/reservierung", &[("X-KanbanD-Wer", "cl"), ("X-KanbanD-Instanz", "i1")], None).await;
    assert_eq!(status, 200, "die eigene Reservierung geht");
    let (status, _) = probe.mit_kopf("POST", "api/aufgaben/2/reservierung", &[("X-KanbanD-Wer", "cl"), ("X-KanbanD-Instanz", "i2")], None).await;
    assert_eq!(status, 409);
    assert!(letzte_zeile(&probe).contains("ursache=konflikt"), "{}", letzte_zeile(&probe));
    // 423: Änderung an einer defekten Aufgabendatei
    let (status, _) = probe.rufen("PATCH", "api/aufgaben/16", "cl", Some(json!({"titel": "x"}))).await;
    assert_eq!(status, 423);
    assert!(zeile_mit(&probe, "status=423").unwrap().contains("ursache=defekt"));
    // 413: Körper über der Grenze der Route
    let gross = "a".repeat(3 * 1024 * 1024);
    let (status, _) = probe.rufen("PATCH", "api/aufgaben/1", "cl", Some(json!({"beschreibung": gross}))).await;
    assert_eq!(status, 413);
    assert!(zeile_mit(&probe, "status=413").unwrap().contains("ursache=zu_gross"));
    // 400: Kürzel steht nicht in kanbanD.md
    let (status, _) = probe.rufen("PATCH", "api/aufgaben/1", "zz", Some(json!({"titel": "x"}))).await;
    assert_eq!(status, 400);
    assert!(zeile_mit(&probe, "status=400").unwrap().contains("ursache=eingabe"));
    // 200 schreibt keine Zeile
    let vorher = probe.zaehle(" WARN abgewiesen ");
    let (status, _) = probe.rufen("PATCH", "api/aufgaben/1", "cl", Some(json!({"titel": "neu"}))).await;
    assert_eq!(status, 200);
    assert_eq!(probe.zaehle(" WARN abgewiesen "), vorher, "200 schreibt nichts");
    assert_eq!(probe.zaehle(" ERROR fehlgeschlagen "), 0);
}

/// Die erste Zeile, die dieses Merkmal trägt.
fn zeile_mit(probe: &Probe, merkmal: &str) -> Option<String> {
    probe.zeilen().into_iter().find(|z| z.contains(merkmal))
}

fn letzte_zeile(probe: &Probe) -> String {
    probe.zeilen().last().cloned().unwrap_or_default()
}

// ---- AK 4: ein gescheiterter Commit ist genau eine ERROR-Zeile ---------------------------------------------

#[tokio::test]
async fn ak4_ein_gescheiterter_commit_ist_genau_eine_error_zeile() {
    let probe = Probe::neu();
    // Das Board-Repository unbrauchbar machen: `git add` scheitert, die schreibende Aktion meldet 500 (intern).
    std::fs::remove_dir_all(probe.ordner().join(".git")).unwrap();
    let (status, rumpf) = probe.rufen("PATCH", "api/aufgaben/1", "cl", Some(json!({"titel": "neu"}))).await;
    assert_eq!(status, 500, "{}", rumpf);
    let zeilen = probe.zeilen();
    assert_eq!(zeilen.iter().filter(|z| z.contains(" ERROR fehlgeschlagen ")).count(), 1, "{zeilen:?}");
    assert_eq!(zeilen.iter().filter(|z| z.contains(" WARN abgewiesen ")).count(), 0, "{zeilen:?}");
    let zeile = zeilen.iter().find(|z| z.contains(" ERROR fehlgeschlagen ")).unwrap();
    assert!(zeile.contains("status=500") && zeile.contains("ursache=intern"), "{zeile}");
    assert!(zeile.contains("wer=cl") && zeile.contains("methode=PATCH") && zeile.contains("aufgabe=#1"), "{zeile}");
}

// ---- AK 5: Abweisung ohne Fehler von kanbanD ---------------------------------------------------------------

#[tokio::test]
async fn ak5_axum_abweisungen_enden_ueber_fehler_oder_ohne_grund() {
    let probe = Probe::neu();
    // Läuft über den Extraktor `Pfad<u32>` und damit über `Fehler` — Ursache `eingabe` (AK 5 zweiter Satz)
    let (status, _) = probe.rufen("PATCH", "api/aufgaben/abc", "cl", Some(json!({"titel": "x"}))).await;
    assert_eq!(status, 400);
    let zeile = letzte_zeile(&probe);
    assert!(zeile.contains(" WARN abgewiesen "), "{zeile}");
    assert!(zeile.contains("ursache=eingabe"), "{zeile}");
    // Eine Methode, die axum selbst abweist (405), trägt keinen Grund
    let (status, _) = probe.rufen("GET", "api/aufgaben/mehrere", "cl", None).await;
    assert_eq!(status, 405);
    let zeile = letzte_zeile(&probe);
    assert!(zeile.contains(" WARN abgewiesen "), "{zeile}");
    assert!(zeile.contains("status=405") && zeile.contains("ursache=-") && zeile.contains("grund=-"), "{zeile}");
}

// ---- AK 6: die Zeile ist da, wenn die Antwort da ist -------------------------------------------------------

#[tokio::test]
async fn ak6_die_zeile_steht_ohne_warten_nach_dem_await() {
    let probe = Probe::neu();
    let vorher = probe.zeilen().len();
    let (status, _) = probe.rufen("PATCH", "api/aufgaben/9999", "cl", Some(json!({"titel": "x"}))).await;
    assert_eq!(status, 404);
    assert_eq!(probe.zeilen().len(), vorher + 1, "ohne Warten und ohne Wiederholschleife");
}

// ---- AK 8: alle sieben Sammelwege --------------------------------------------------------------------------

#[tokio::test]
async fn ak8_alle_sieben_sammelwege_tragen_ziele_und_nach_bedarf_erstes() {
    let probe = Probe::neu();
    // (Weg, Methode, Pfad, Rumpf, erwarteter Status, erwartete Anzahl, erwartetes erstes, erwartete Aufgabe)
    let faelle: Vec<(&str, &str, &str, Value, u16, usize, Option<u32>, Option<u32>)> = vec![
        ("aendern", "PATCH", "api/aufgaben/mehrere", json!({"aenderungen": [{"nummer": 4}, {"nummer": 4}]}), 400, 2, Some(4), None),
        ("archivieren", "POST", "api/aufgaben/archivieren", json!({"nummern": [1, 9999]}), 404, 2, Some(1), None),
        ("zurueckholen", "POST", "api/aufgaben/zurueckholen", json!({"nummern": [1, 9999]}), 404, 2, Some(1), None),
        ("bewegen", "POST", "api/boards/entwicklung/bewegen-mehrere", json!({"ziele": [{"nummer": 9998, "spalte": "Voll"}, {"nummer": 9999, "spalte": "Voll"}]}), 404, 2, Some(9998), None),
        ("auf-board", "POST", "api/boards/entwicklung/aufgaben/mehrere", json!({"nummern": [9998, 9999]}), 404, 2, Some(9998), None),
        ("anlegen", "POST", "api/aufgaben/mehrere", json!({"titel": ["", "b"]}), 400, 2, None, None),
        ("teilaufgaben", "POST", "api/aufgaben/1/teilaufgaben/mehrere", json!({"texte": ["ok", ""]}), 400, 2, None, Some(1)),
    ];
    for (name, methode, pfad, rumpf, status, ziele, erstes, aufgabe) in faelle {
        let vorher = probe.zeilen().len();
        let (antwort, _) = probe.rufen(methode, pfad, "cl", Some(rumpf)).await;
        assert_eq!(antwort, status, "{name}");
        let zeilen = probe.zeilen();
        assert_eq!(zeilen.len(), vorher + 1, "{name}: genau eine Zeile: {:?}", &zeilen[vorher..]);
        let zeile = &zeilen[vorher];
        assert!(zeile.contains(&format!("ziele={ziele}")), "{name}: {zeile}");
        match erstes {
            Some(e) => assert!(zeile.contains(&format!("erstes=#{e}")), "{name}: {zeile}"),
            None => assert!(!zeile.contains("erstes="), "{name} ohne erstes: {zeile}"),
        }
        match aufgabe {
            Some(nr) => assert!(zeile.contains(&format!("aufgabe=#{nr}")), "{name}: {zeile}"),
            None => assert!(!zeile.contains("aufgabe=#"), "{name} ohne aufgabe: {zeile}"),
        }
    }
    // Rechenbeispiel AK 7: Reihenfolge #9, #4 → erstes=#9
    let (status, _) = probe.rufen("PATCH", "api/aufgaben/mehrere", "cl", Some(json!({"aenderungen": [{"nummer": 9}, {"nummer": 4}]}))).await;
    assert_eq!(status, 200, "beide gültig");
    let (status, _) = probe.rufen("PATCH", "api/aufgaben/mehrere", "cl", Some(json!({"aenderungen": [{"nummer": 9}, {"nummer": 4}, {"nummer": 4}]}))).await;
    assert_eq!(status, 400);
    assert!(letzte_zeile(&probe).contains("erstes=#9"), "Reihenfolge der Anfrage: {}", letzte_zeile(&probe));
}

// ---- AK 9: kein Rumpf, keine Query, kein fremder Header ----------------------------------------------------

#[tokio::test]
async fn ak9_kein_inhalt_keine_query_kein_fremder_header_im_log() {
    let probe = Probe::neu();
    let (status, _) = probe
        .mit_kopf(
            "PATCH",
            "api/aufgaben/1?q=GEHEIM-QUERY",
            &[("X-KanbanD-Wer", "cl"), ("Authorization", "Bearer GEHEIM-TOKEN"), ("Cookie", "k=GEHEIM-KEKS"), ("User-Agent", "GEHEIM-UA")],
            Some(json!({"labels": ["braucht:999"], "beschreibung": "GEHEIM-239"})),
        )
        .await;
    assert_eq!(status, 400);
    let zeile = letzte_zeile(&probe);
    for marker in ["GEHEIM-239", "GEHEIM-QUERY", "GEHEIM-TOKEN", "GEHEIM-KEKS", "GEHEIM-UA", "Authorization", "Cookie", "User-Agent"] {
        assert!(!zeile.contains(marker), "{marker} in {zeile}");
    }
    assert!(zeile.contains("endpunkt=/api/aufgaben/{nr}"), "die Vorlage, nie die rohe URI: {zeile}");
    assert!(!zeile.contains("?q="), "{zeile}");
}

// ---- AK 12: Kürzen von Kopfwerten --------------------------------------------------------------------------

#[tokio::test]
async fn ak12_kopfwerte_werden_auf_32_zeichen_gekuerzt() {
    let probe = Probe::neu();
    let lang = "a".repeat(40);
    probe.mit_kopf("PATCH", "api/aufgaben/9999", &[("X-KanbanD-Wer", &lang), ("X-KanbanD-Instanz", &lang)], Some(json!({"titel": "x"}))).await;
    let zeile = letzte_zeile(&probe);
    let erwartet = format!("{}{}", "a".repeat(32), "…");
    assert!(zeile.contains(&format!("wer={erwartet}")), "{zeile}");
    assert!(zeile.contains(&format!("instanz={erwartet}")), "{zeile}");
}
