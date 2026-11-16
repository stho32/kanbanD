//! R00183: `GET /api/instanz` nennt Ordner, Port und Version der Instanz — im echten Programm.
mod gemeinsam;

use gemeinsam::{Laufendes, git};
use serde_json::{Value, json};
use std::path::Path;

const VERSION: &str = env!("CARGO_PKG_VERSION");

struct Antwort {
    status: u16,
    art: String,
    json: Value,
}

async fn instanz(adresse: &str) -> Antwort {
    let r = reqwest::get(format!("{adresse}api/instanz")).await.unwrap();
    let status = r.status().as_u16();
    let art = r.headers().get("content-type").and_then(|w| w.to_str().ok()).unwrap_or_default().to_string();
    Antwort { status, art, json: serde_json::from_str(&r.text().await.unwrap()).unwrap_or(Value::Null) }
}

async fn zustand(adresse: &str) -> (u16, Value) {
    let r = reqwest::get(format!("{adresse}api/zustand")).await.unwrap();
    (r.status().as_u16(), r.json().await.unwrap_or(Value::Null))
}

/// Der Port aus der Startzeile (`http://127.0.0.1:<port>/`).
fn port_der(adresse: &str) -> u16 {
    adresse.trim_end_matches('/').rsplit(':').next().unwrap().parse().expect("Port in der Adresse")
}

fn kanonisch(pfad: &Path) -> String {
    pfad.canonicalize().unwrap().to_string_lossy().into_owned()
}

/// Startet mit `kanbanD . --port <P>` im Ordner; `P` war eben noch frei. Nimmt ihn bis zum Start ein anderer
/// Prozess, weicht das Programm aus — dann mit dem nächsten freien Port noch einmal.
fn im_ordner_auf_freiem_port(ordner: &Path) -> (Laufendes, u16) {
    for _ in 0..10 {
        let frei = std::net::TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        let lauf = gemeinsam::starten_aus(ordner, Path::new("."), &["--port", &frei.to_string()]);
        if port_der(&lauf.adresse) == frei {
            return (lauf, frei);
        }
    }
    panic!("kein freier Port blieb bis zum Start frei");
}

// ── B0891: Ordner und Version (AK 1, AK 2) ──────────────────────────────────────────────────────────────

// US-1, Abnahme-Probe der Karte #147: gestartet mit `kanbanD . --port <P>` im Ordner A
#[tokio::test]
async fn us1_instanz_nennt_ordner_und_version_wie_der_zustand() {
    let tmp = tempfile::tempdir().unwrap();
    let a = tmp.path().join("Boards/A");
    std::fs::create_dir_all(&a).unwrap();
    let (lauf, _) = im_ordner_auf_freiem_port(&a);

    let antwort = instanz(&lauf.adresse).await;

    assert_eq!(antwort.status, 200, "{}", antwort.json);
    assert_eq!(antwort.art, "application/json");
    assert_eq!(antwort.json["ordner"], kanonisch(&a));
    assert_eq!(antwort.json["ordner"], zustand(&lauf.adresse).await.1["ordner"]);
    assert_eq!(antwort.json["version"], VERSION);
}

// US-2, AK 2: über einen Symlink gestartet nennt `ordner` das Ziel
#[cfg(unix)]
#[tokio::test]
async fn us2_start_ueber_symlink_nennt_das_aufgeloeste_ziel() {
    let tmp = tempfile::tempdir().unwrap();
    let a = tmp.path().join("Boards/A");
    std::fs::create_dir_all(&a).unwrap();
    let kurz = tmp.path().join("kurz");
    std::os::unix::fs::symlink(&a, &kurz).unwrap();
    let lauf = gemeinsam::starten(&kurz, &["--port", "0"]);

    let antwort = instanz(&lauf.adresse).await;

    assert_eq!(antwort.status, 200, "{}", antwort.json);
    assert_eq!(antwort.json["ordner"], kanonisch(&a));
    assert!(!antwort.json["ordner"].as_str().unwrap().ends_with("kurz"), "{}", antwort.json);
    assert_eq!(antwort.json["ordner"], zustand(&lauf.adresse).await.1["ordner"]);
}

// ── B0892: gebundener Port (AK 1, AK 3) ─────────────────────────────────────────────────────────────────

// AK 1 wörtlich: genau drei Felder, `port` als Zahl
#[tokio::test]
async fn us1_antwort_ist_genau_ordner_port_version() {
    let tmp = tempfile::tempdir().unwrap();
    let a = tmp.path().join("Boards/A");
    std::fs::create_dir_all(&a).unwrap();
    let (lauf, port) = im_ordner_auf_freiem_port(&a);

    let antwort = instanz(&lauf.adresse).await;

    assert_eq!(antwort.json, json!({"ordner": kanonisch(&a), "port": port, "version": VERSION}));
    assert!(antwort.json["port"].is_u64(), "{}", antwort.json);
}

// US-2, AK 3: der verlangte Port ist belegt — die Instanz nennt den, auf den sie ausgewichen ist
#[tokio::test]
async fn us2_belegter_port_instanz_nennt_den_ausgewichenen() {
    let tmp = tempfile::tempdir().unwrap();
    let belegt = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let verlangt = belegt.local_addr().unwrap().port();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", &verlangt.to_string()]);
    let gebunden = port_der(&lauf.adresse);
    assert!(gebunden > verlangt, "Startzeile nennt {gebunden}, verlangt war {verlangt}");

    let antwort = instanz(&lauf.adresse).await;

    assert_eq!(antwort.json["port"], gebunden, "{}", antwort.json);
}

// AK 3: `--port 0` — der Port, auf dem die Anfrage ankam, nie 0
#[tokio::test]
async fn port_null_nennt_den_port_der_anfrage() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let antwort = instanz(&lauf.adresse).await;

    assert_ne!(antwort.json["port"], 0, "{}", antwort.json);
    assert_eq!(antwort.json["port"], port_der(&lauf.adresse), "{}", antwort.json);
}

// ── B0893: ohne Anmeldung, nur lesend, ohne den Ordner zu lesen (AK 4) ──────────────────────────────────

// AK 4: im noch nicht eingerichteten Ordner, ohne `X-KanbanD-Wer`; der Aufruf legt nichts an
#[tokio::test]
async fn nicht_eingerichteter_ordner_antwortet_und_bleibt_leer() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    assert_eq!(zustand(&lauf.adresse).await.1["eingerichtet"], false);
    let vorher = git(tmp.path(), &["status", "--porcelain"]);

    let antwort = instanz(&lauf.adresse).await;

    assert_eq!(antwort.status, 200, "{}", antwort.json);
    assert_eq!(antwort.json["ordner"], kanonisch(tmp.path()));
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), vorher);
    assert_eq!(git(tmp.path(), &["rev-list", "--all", "--count"]), "0");
}

// US-1, AK 4: der Aufruf schreibt nichts — Commits und `git status` unverändert
#[tokio::test]
async fn us1_aufruf_schreibt_nichts() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let stand = || (git(tmp.path(), &["rev-list", "--count", "HEAD"]), git(tmp.path(), &["status", "--porcelain"]));
    let vorher = stand();

    let antwort = instanz(&lauf.adresse).await;

    assert_eq!(antwort.status, 200, "{}", antwort.json);
    assert_eq!(stand(), vorher);
}

// US-3, AK 4: `GET /api/zustand` scheitert an einer Datei ohne Leserecht — die Instanz antwortet trotzdem
#[cfg(unix)]
#[tokio::test]
async fn us3_unlesbare_aufgabendatei_zustand_500_instanz_200() {
    use std::os::unix::fs::PermissionsExt;
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let datei = tmp.path().join("aufgaben/0002-zwei.md");
    std::fs::set_permissions(&datei, std::fs::Permissions::from_mode(0o000)).unwrap();
    if std::fs::read(&datei).is_ok() {
        eprintln!("übersprungen: als root greift chmod 000 nicht");
        return;
    }
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (status, z) = zustand(&lauf.adresse).await;
    assert_eq!(status, 500, "{z}");

    let antwort = instanz(&lauf.adresse).await;

    assert_eq!(antwort.status, 200, "{}", antwort.json);
    assert_eq!(antwort.json, json!({"ordner": kanonisch(tmp.path()), "port": port_der(&lauf.adresse), "version": VERSION}));
}

// US-3, AK 4: nur lesend — jede andere Methode wird mit 405 abgewiesen
#[tokio::test]
async fn us3_andere_methoden_sind_405() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());

    for methode in [reqwest::Method::POST, reqwest::Method::PUT, reqwest::Method::PATCH, reqwest::Method::DELETE] {
        let r = reqwest::Client::new().request(methode.clone(), format!("{}api/instanz", lauf.adresse)).header("X-KanbanD-Wer", "st").send().await.unwrap();
        assert_eq!(r.status(), 405, "{methode}");
    }
}

// ── B0894: beschrieben (AK 5) ───────────────────────────────────────────────────────────────────────────

// US-3, AK 5: Endpunktliste und Übersicht nennen den Endpunkt
#[tokio::test]
async fn us3_endpunktliste_und_uebersicht_nennen_die_instanz() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());

    let liste: Value = reqwest::get(format!("{}api/endpunkte", lauf.adresse)).await.unwrap().json().await.unwrap();
    let seite = reqwest::get(format!("{}api", lauf.adresse)).await.unwrap().text().await.unwrap();

    let zeilen: Vec<&Value> = liste.as_array().unwrap().iter().filter(|e| e["pfad"] == "/api/instanz").collect();
    assert_eq!(zeilen.len(), 1, "{zeilen:?}");
    assert_eq!(zeilen[0]["methode"], "GET");
    assert_eq!(zeilen[0]["wer"], false);
    assert_eq!(zeilen[0]["thema"], "Ordner");
    let zweck = zeilen[0]["zweck"].as_str().unwrap();
    for wort in ["ordner", "port", "version"] {
        assert!(zweck.contains(wort), "{zweck}");
    }
    assert!(seite.contains("/api/instanz"));
}

// AK 5: OpenAPI nennt die drei Felder mit ihren Typen
#[tokio::test]
async fn openapi_beschreibt_die_drei_felder_mit_typ() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());

    let d: Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse)).await.unwrap().json().await.unwrap();

    let antwort = &d["paths"]["/api/instanz"]["get"]["responses"]["200"]["content"]["application/json"]["schema"];
    let verweis = antwort["$ref"].as_str().unwrap_or_else(|| panic!("kein Schema an GET /api/instanz: {}", d["paths"]["/api/instanz"]));
    let schema = d.pointer(&verweis[1..]).expect("Verweis auflösbar");
    let felder = schema["properties"].as_object().unwrap();
    assert_eq!(felder.keys().map(String::as_str).collect::<Vec<_>>(), ["ordner", "port", "version"]);
    assert_eq!(felder["ordner"]["type"], "string");
    assert_eq!(felder["port"]["type"], "integer");
    assert_eq!(felder["version"]["type"], "string");
    let mut pflicht: Vec<&str> = schema["required"].as_array().unwrap().iter().map(|f| f.as_str().unwrap()).collect();
    pflicht.sort();
    assert_eq!(pflicht, ["ordner", "port", "version"]);
    assert_eq!(d["paths"]["/api/instanz"]["get"]["tags"], json!(["Ordner"]));
}

// AK 5: das README nennt den Endpunkt im Abschnitt zur API — und wozu ein Agent ihn braucht
#[test]
fn readme_nennt_den_endpunkt_und_seinen_zweck() {
    let readme = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/README.md")).unwrap();
    let abschnitt = readme.split("\n## Für Agenten\n").nth(1).expect("Abschnitt „Für Agenten“").split("\n## ").next().unwrap();
    let satz = abschnitt.lines().find(|z| z.contains("`GET /api/instanz`")).expect("`GET /api/instanz` im Abschnitt „Für Agenten“");
    assert!(satz.contains("`{ordner, port, version}`"), "{satz}");
    assert!(satz.contains("erkennt ein Agent seine Instanz"), "{satz}");
}
