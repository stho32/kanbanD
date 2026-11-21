// R00222 (I0212, Karte #224, Scheibe S2 von ADR-0034): kanbanD liest, schreibt und zeigt die WBS nicht mehr — Akzeptanztests
// gegen das echte Programm, ein echtes Arbeits-Repository und einen echten kanbanD-Ordner (Ausgangslage von R00222, `Lage::neu`).
// Schichten: Testfall (je AK) → Testsprache (`Lage`, `Folge`, `Mitschnitt`) → Treiber (`lesen`, `senden`, `status_von`) → Programm.
// Die Oberfläche (AK 3, 4, 10, 11, 14) prüft `e2e/tests/r00222-ohne-wbs.spec.js`; AK 13 (Kopie des JoinPuya-Ordners) läuft
// als `#[ignore]`-Test mit Umgebungsvariablen, ebenso der Vergleich von AK 8 mit dem Programm vor der Karte.
mod gemeinsam;

use gemeinsam::{git, lies};
use serde_json::{Value, json};
use std::io::{BufRead, BufReader};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

// ---- Treiber ----------------------------------------------------------------------------------------------------------

async fn lesen(adresse: &str, pfad: &str) -> Value {
    let (status, v) = status_von(reqwest::Method::GET, adresse, pfad, None).await;
    assert_eq!(status, 200, "GET {pfad}: {v}");
    v
}

/// Status und Rumpf (JSON, sonst der Text als String) eines Aufrufs, mit oder ohne Rumpf, als Stefan.
async fn status_von(methode: reqwest::Method, adresse: &str, pfad: &str, rumpf: Option<Value>) -> (u16, Value) {
    let mut anfrage = reqwest::Client::new().request(methode, format!("{adresse}{pfad}")).header("X-KanbanD-Wer", "sh");
    if let Some(r) = rumpf {
        anfrage = anfrage.json(&r);
    }
    let antwort = anfrage.send().await.unwrap();
    let status = antwort.status().as_u16();
    let text = antwort.text().await.unwrap();
    (status, serde_json::from_str(&text).unwrap_or(Value::String(text)))
}

async fn senden(methode: reqwest::Method, adresse: &str, pfad: &str, rumpf: Value) -> (u16, Value) {
    status_von(methode, adresse, pfad, Some(rumpf)).await
}

/// Das Programm mit eigenem Mitschnitt von stderr („keine Fehler- oder Warnzeile im Log“).
struct Instanz {
    kind: Child,
    adresse: String,
    log: PathBuf,
}

impl Drop for Instanz {
    fn drop(&mut self) {
        gemeinsam::geordnet_beenden(&mut self.kind);
    }
}

impl Instanz {
    fn starten(programm: &Path, ordner: &Path, log: PathBuf) -> Instanz {
        let mut kind = Command::new(programm)
            .arg(ordner)
            .args(["--kein-browser", "--host", "127.0.0.1", "--port", "0"])
            .stdout(Stdio::piped())
            .stderr(Stdio::from(std::fs::File::create(&log).unwrap()))
            .spawn()
            .expect("kanbanD startet");
        let mut zeile = String::new();
        BufReader::new(kind.stdout.take().unwrap()).read_line(&mut zeile).unwrap();
        let adresse = zeile.split_whitespace().last().expect("Adresse in der Startzeile").to_string();
        Instanz { kind, adresse, log }
    }

    fn adresse(&self) -> &str {
        &self.adresse
    }

    /// Zeilen des Logs, die nach Fehler oder Warnung aussehen. Ausgenommen ist nur die Meldung „nicht beobachtet“ bei
    /// erschöpften inotify-Instanzen des Rechners (os error 24): sie hängt an der Zahl paralleler Instanzen, nicht an der WBS.
    fn auffaellige_zeilen(&self) -> Vec<String> {
        let auffaellig = |z: &str| ["fehler", "warn", "error", "defekt", "nicht beobachtet", "wbs"].iter().any(|w| z.to_lowercase().contains(w));
        let rechnergrenze = |z: &str| z.contains("(os error 24)");
        std::fs::read_to_string(&self.log).unwrap_or_default().lines().filter(|z| auffaellig(z) && !rechnergrenze(z)).map(String::from).collect()
    }

    fn beobachtet(&self) -> bool {
        !std::fs::read_to_string(&self.log).unwrap_or_default().contains("nicht beobachtet")
    }
}

/// Liest den Ereignisstrom im Hintergrund mit; `ereignisse()` liefert jedes `data:`-Ereignis als JSON (ohne Herzschlag).
struct Mitschnitt {
    ereignisse: Arc<Mutex<Vec<Value>>>,
    aufgabe: tokio::task::JoinHandle<()>,
}

impl Mitschnitt {
    async fn starten(adresse: &str) -> Mitschnitt {
        use futures_util::StreamExt;
        let antwort = reqwest::get(format!("{adresse}api/ereignisse")).await.unwrap();
        assert_eq!(antwort.headers()["content-type"], "text/event-stream");
        let ereignisse = Arc::new(Mutex::new(vec![]));
        let ziel = ereignisse.clone();
        let aufgabe = tokio::spawn(async move {
            let mut strom = antwort.bytes_stream();
            let mut puffer = String::new();
            while let Some(Ok(teil)) = strom.next().await {
                puffer.push_str(&String::from_utf8_lossy(&teil));
                while let Some(ende) = puffer.find("\n\n") {
                    let block: String = puffer.drain(..ende + 2).collect();
                    let herzschlag = block.lines().any(|z| z.starts_with("event:") && z.contains("herzschlag"));
                    if let Some(json) = block.lines().find_map(|z| z.strip_prefix("data: ")).filter(|_| !herzschlag) {
                        ziel.lock().unwrap().push(serde_json::from_str(json).unwrap_or(Value::String(json.into())));
                    }
                }
            }
        });
        Mitschnitt { ereignisse, aufgabe }
    }

    fn ereignisse(&self) -> Vec<Value> {
        self.ereignisse.lock().unwrap().clone()
    }

    /// Wartet höchstens 5 s auf ein Ereignis, das `bedingung` erfüllt (ein Ereignis, das kommen muss — Gegenprobe).
    async fn abwarten(&self, bedingung: impl Fn(&Value) -> bool) -> Vec<Value> {
        let ende = tokio::time::Instant::now() + std::time::Duration::from_secs(5);
        while tokio::time::Instant::now() < ende {
            let jetzt = self.ereignisse();
            if jetzt.iter().any(&bedingung) {
                return jetzt;
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }
        panic!("kein passendes Ereignis in {:?}", self.ereignisse());
    }
}

impl Drop for Mitschnitt {
    fn drop(&mut self) {
        self.aufgabe.abort();
    }
}

/// Ein Ereignis nennt die WBS: es trägt ein Feld `wbs` oder einen Pfad in das Arbeits-Repository.
fn nennt_wbs(e: &Value, r: &Path) -> bool {
    e.get("wbs").is_some() || e.to_string().contains(&r.display().to_string())
}

// ---- Testsprache: Ausgangslage ----------------------------------------------------------------------------------------

const WBS_KOPF: &str = "---\napplication: KD\n---\n\n| ID | Ebene | Eltern | Name | Status | Fertig-Kriterium | Eingabe → Ausgabe | Aufwand | Ausbaustufe | Braucht | Requirement | Notiz |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n";

/// Die zwei Wirkungen der Aufgabe #1 in Flussform (Ausgangslage von R00222) und dieselben als YAML-Wert.
const WIRKUNGEN: &str = "wbs-effects:\n  - {application: kd, action: create, node: I0048, parent: D0002, level: Interaction, name: Export, done-criterion: US-1}\n  - {application: kd, action: rework, node: D0002, executed: 2026-11-01}\n";

/// Ausgangslage von R00222: Arbeits-Repository `R` mit der WBS `R/Dokumentation/Planung/kd.md` (Knoten `I0007`),
/// `R/Anforderungen` und den Commits `C1`, `C2`; kanbanD-Ordner `K` mit dem Register `kd` (repository, wbs, requirements),
/// Board `entwicklung` (Offen, In Arbeit, Review, Erledigt; `applications: [kd]`, `column-checks` an „Review“, WIP-Grenze 1
/// an „In Arbeit“), #1 in „Review“ mit `kd:<C1>` und zwei Wirkungen in Flussform, #2 in „Offen“.
/// Dazu `column-phases` für alle drei Phasen des Standardmodells, wie alle 5 Boards im Bestand: seit S3 (R00223, ADR-0034
/// N4) ein unbekannter Schlüssel, den kanbanD überliest — die Fixture belegt jetzt das Überlesen.
struct Lage {
    _tmp: tempfile::TempDir,
    basis: PathBuf,
    r: PathBuf,
    k: PathBuf,
    c1: String,
}

impl Lage {
    fn neu() -> Lage {
        let tmp = tempfile::tempdir().unwrap();
        let basis = tmp.path().canonicalize().unwrap();
        let (r, k) = (basis.join("R"), basis.join("K"));
        std::fs::create_dir_all(r.join("Dokumentation/Planung")).unwrap();
        std::fs::create_dir_all(r.join("Anforderungen")).unwrap();
        std::fs::write(r.join("Dokumentation/Planung/kd.md"), format!("{WBS_KOPF}| A0001 | Application | — | KD | rot | US-1 |  |  |  |  |  |  |\n| D0002 | Dialog | A0001 | Export | rot | US-1 |  |  |  |  |  |  |\n| I0007 | Interaction | D0002 | Liste | rot | US-1 |  |  |  |  |  |  |\n")).unwrap();
        std::fs::write(r.join("Anforderungen/R00001-x.md"), "# R00001\n").unwrap();
        std::fs::write(r.join("export.txt"), "eins\n").unwrap();
        git(&r, &["init", "-q", "-b", "main"]);
        git(&r, &["add", "-A"]);
        git(&r, &["-c", "user.name=Ada", "-c", "user.email=a@a", "commit", "-q", "-m", "C1 Export anlegen"]);
        let c1 = git(&r, &["rev-parse", "HEAD"]);
        std::fs::write(r.join("export.txt"), "eins\nzwei\n").unwrap();
        git(&r, &["-c", "user.name=Ada", "-c", "user.email=a@a", "commit", "-q", "-am", "C2 Export erweitern"]);
        std::fs::create_dir_all(k.join("aufgaben")).unwrap();
        std::fs::create_dir_all(k.join("boards")).unwrap();
        std::fs::write(k.join("aufgaben/0001-export.md"), format!("---\nid: 1\ntitle: Export\ncommits:\n  - kd:{c1}\n{WIRKUNGEN}---\n")).unwrap();
        std::fs::write(k.join("aufgaben/0002-liste.md"), "---\nid: 2\ntitle: Liste\n---\n").unwrap();
        std::fs::write(
            k.join("boards/entwicklung.md"),
            "---\nlimits:\n  In Arbeit: 1\ncolumn-phases:\n  In Arbeit: Entwicklung\n  Review: Entwicklertest\n  Erledigt: Abnahme\ncolumn-checks:\n  Review: [wbs-effects-green]\napplications: [kd]\n---\n\n# Entwicklung\n\n## Offen\n\n- [#2](../aufgaben/0002-liste.md)\n\n## In Arbeit\n\n## Review\n\n- [#1](../aufgaben/0001-export.md)\n\n## Erledigt\n",
        )
        .unwrap();
        let l = Lage { _tmp: tmp, basis, r, k, c1 };
        l.register(&format!("kd: {{name: KD, repository: {}, wbs: {}, requirements: {}}}", l.r_text(), l.wbs(), l.anf()));
        git(&l.k, &["init", "-q"]);
        l.committen();
        l
    }

    fn wbs_pfad(&self) -> PathBuf {
        self.r.join("Dokumentation/Planung/kd.md")
    }

    fn wbs(&self) -> String {
        self.wbs_pfad().display().to_string()
    }

    fn anf(&self) -> String {
        format!("{}/Anforderungen", self.r.display())
    }

    fn r_text(&self) -> String {
        self.r.display().to_string()
    }

    /// `kanbanD.md` mit Stefan (Mensch), Claude (Agent) und der Registerzeile `zeile` (`kd: {…}`).
    fn register(&self, zeile: &str) {
        std::fs::write(self.k.join("kanbanD.md"), format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\n  cl: {{name: Claude, kind: agent}}\nclasses: {{}}\nsources:\n  applications:\n    {zeile}\n---\n")).unwrap();
    }

    fn committen(&self) {
        git(&self.k, &["add", "-A"]);
        git(&self.k, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Stand"]);
    }

    fn commits_k(&self) -> u32 {
        git(&self.k, &["rev-list", "--count", "HEAD"]).parse().unwrap()
    }

    fn commits_r(&self) -> u32 {
        git(&self.r, &["rev-list", "--count", "HEAD"]).parse().unwrap()
    }

    fn starten(&self) -> Instanz {
        self.starten_mit(Path::new(env!("CARGO_BIN_EXE_kanbanD")), "log.txt")
    }

    fn starten_mit(&self, programm: &Path, log: &str) -> Instanz {
        Instanz::starten(programm, &self.k, self.basis.join(log))
    }

    /// Die WBS unlesbar machen (`chmod 000`) bzw. wieder lesbar.
    fn wbs_rechte(&self, modus: u32) {
        std::fs::set_permissions(self.wbs_pfad(), std::fs::Permissions::from_mode(modus)).unwrap();
    }

    /// Inhalt der WBS — liest sie mit vorübergehend gesetztem Leserecht, damit `chmod 000` danach wieder gilt.
    fn wbs_bytes(&self) -> Vec<u8> {
        let vorher = std::fs::metadata(self.wbs_pfad()).unwrap().permissions().mode();
        self.wbs_rechte(0o644);
        let b = std::fs::read(self.wbs_pfad()).unwrap();
        self.wbs_rechte(vorher);
        b
    }

    fn datei(&self, rel: &str) -> String {
        lies(&self.k, rel)
    }

    /// Ersetzt den Pfad der Lage durch `<B>`, damit Antworten zweier Lagen vergleichbar sind.
    fn ohne_pfad(&self, v: &Value) -> Value {
        serde_json::from_str(&v.to_string().replace(&self.basis.display().to_string(), "<B>")).unwrap()
    }
}

/// Frontmatter einer Aufgabendatei als YAML-Wert.
fn frontmatter(text: &str) -> serde_yaml::Value {
    let rumpf = text.strip_prefix("---\n").unwrap().split("\n---").next().unwrap();
    serde_yaml::from_str(rumpf).unwrap()
}

fn wirkungen_in(text: &str) -> serde_yaml::Value {
    frontmatter(text).get("wbs-effects").cloned().unwrap_or_else(|| panic!("wbs-effects fehlt in\n{text}"))
}

/// Der Abschnitt `wbs-effects:` wörtlich (vom Schlüssel bis zum nächsten Schlüssel der obersten Ebene).
fn wirkungsabschnitt(text: &str) -> String {
    let mut drin = false;
    let mut s = String::new();
    for z in text.lines() {
        if z.starts_with("wbs-effects:") {
            drin = true;
        } else if drin && !z.starts_with(' ') {
            break;
        }
        if drin {
            s.push_str(z);
            s.push('\n');
        }
    }
    s
}

fn zeile_von<'a>(datei: &'a str, kuerzel: &str) -> &'a str {
    datei.lines().find(|z| z.trim_start().starts_with(&format!("{kuerzel}: "))).unwrap_or_else(|| panic!("{kuerzel} fehlt in\n{datei}"))
}

fn anwendung<'a>(e: &'a Value, kuerzel: &str) -> &'a Value {
    e["quellen"]["anwendungen"].as_array().unwrap().iter().find(|a| a["kuerzel"] == kuerzel).unwrap_or_else(|| panic!("{kuerzel} fehlt: {e}"))
}

async fn verweis(adresse: &str, verweis: &str) -> Value {
    let l = lesen(adresse, "api/aufgaben/1/commits").await;
    l["commits"].as_array().unwrap().iter().find(|e| e["verweis"] == verweis).cloned().unwrap_or_else(|| panic!("{verweis} fehlt: {l}"))
}

async fn bewegen(adresse: &str, nummer: u32, spalte: &str) -> (u16, Value) {
    senden(reqwest::Method::POST, adresse, "api/boards/entwicklung/bewegen", json!({"nummer": nummer, "spalte": spalte})).await
}

// ---- AK 1: die unlesbare WBS stört nichts -----------------------------------------------------------------------------

/// Die Folge aus AK 1: Start, Board, #3 anlegen und durch alle vier Spalten, #1 nach „Erledigt“, jeder Bericht, die
/// Commit-Liste von #1, Einstellungen lesen und unverändert schreiben. Liefert je Schritt Status und vergleichbaren Inhalt.
async fn folge_ak01(l: &Lage, lauf: &Instanz) -> Vec<(String, u16, Value)> {
    let a = lauf.adresse();
    let mut schritte = vec![];
    let (s, b) = status_von(reqwest::Method::GET, a, "api/boards/entwicklung", None).await;
    schritte.push(("Board".into(), s, l.ohne_pfad(&json!({"spalten": b["spalten"], "hinweise": b["hinweise"]}))));
    let (s, neu) = senden(reqwest::Method::POST, a, "api/aufgaben", json!({"titel": "Neu", "board": "entwicklung", "spalte": "Offen"})).await;
    schritte.push(("#3 anlegen".into(), s, json!(neu["nummer"])));
    for spalte in ["In Arbeit", "Review", "Erledigt"] {
        let (s, v) = bewegen(a, 3, spalte).await;
        schritte.push((format!("#3 nach {spalte}"), s, v));
    }
    let (s, v) = bewegen(a, 1, "Erledigt").await;
    schritte.push(("#1 nach Erledigt".into(), s, v));
    for bericht in ["api/berichte/bewegungen?board=entwicklung", "api/berichte/verlauf?board=entwicklung", "api/berichte/zeiten.csv", "api/boards/entwicklung/fieber/cache"] {
        let (s, _) = status_von(reqwest::Method::GET, a, bericht, None).await;
        schritte.push((bericht.into(), s, Value::Null));
    }
    let (s, c) = status_von(reqwest::Method::GET, a, "api/aufgaben/1/commits", None).await;
    // ohne Verweis und Hash: zwei Lagen haben verschiedene Commits (Zeitstempel) — verglichen werden Zustand und Titel
    schritte.push(("Commits #1".into(), s, json!(c["commits"].as_array().map(|l| l.iter().map(|e| json!([e["zustand"], e["titel"]])).collect::<Vec<_>>()))));
    let (s, e) = status_von(reqwest::Method::GET, a, "api/einstellungen", None).await;
    schritte.push(("Einstellungen lesen".into(), s, l.ohne_pfad(&e)));
    let (s, _) = senden(reqwest::Method::PUT, a, "api/einstellungen", e).await;
    schritte.push(("Einstellungen schreiben".into(), s, Value::Null));
    schritte
}

#[tokio::test]
async fn ak01_unlesbare_wbs_stoert_nichts_und_bleibt_bytegleich() {
    let l = Lage::neu();
    let wbs_vorher = l.wbs_bytes();
    let r_vorher = l.commits_r();
    l.wbs_rechte(0o000);
    let lauf = l.starten();
    let mitschnitt = Mitschnitt::starten(lauf.adresse()).await;
    let unlesbar = folge_ak01(&l, &lauf).await;
    for (schritt, status, inhalt) in &unlesbar {
        assert!(*status < 400, "{schritt}: {status} {inhalt}");
    }
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    let ereignisse = mitschnitt.ereignisse();
    assert!(!ereignisse.iter().any(|e| nennt_wbs(e, &l.r)), "kein Live-Ereignis nennt die WBS: {ereignisse:?}");
    assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new(), "keine Fehler- oder Warnzeile im Log");
    assert_eq!(l.wbs_bytes(), wbs_vorher, "WBS bytegleich");
    assert_eq!(l.commits_r(), r_vorher, "kein Commit in R");
    drop(mitschnitt);
    drop(lauf);

    let lesbar_lage = Lage::neu();
    let lesbar_lauf = lesbar_lage.starten();
    let lesbar = folge_ak01(&lesbar_lage, &lesbar_lauf).await;
    assert_eq!(lesbar.len(), unlesbar.len());
    for (l, u) in lesbar.iter().zip(&unlesbar) {
        assert_eq!(l, u, "dieselbe Folge mit lesbarer WBS liefert dieselben Antworten — Schritt „{}“", l.0);
    }
    l.wbs_rechte(0o644);
}

// ---- AK 2: die Endpunkte der WBS gibt es nicht mehr -------------------------------------------------------------------

#[tokio::test]
async fn ak02_endpunkte_der_wbs_antworten_404_ohne_commit() {
    let l = Lage::neu();
    let wbs_vorher = l.wbs_bytes();
    let (k_vorher, r_vorher) = (l.commits_k(), l.commits_r());
    let lauf = l.starten();
    let a = lauf.adresse();
    use reqwest::Method as M;
    let aufrufe: [(M, &str, Option<Value>); 8] = [
        (M::GET, "api/wbs/kd", None),
        (M::POST, "api/wbs/kd/knoten", Some(json!({"ebene": "Interaction", "eltern": "D0002", "name": "Neu", "fertig_kriterium": "US-1"}))),
        (M::PATCH, "api/wbs/kd/knoten/I0007", Some(json!({"status": "gruen"}))),
        (M::POST, "api/wbs/kd/knoten/I0007/verwerfen", Some(json!({"grund": "weg"}))),
        (M::GET, "api/aufgaben/1/wbs-effects", None),
        (M::PATCH, "api/aufgaben/1/wbs-effects", Some(json!({"application": "kd", "action": "rework", "node": "I0007"}))),
        (M::POST, "api/aufgaben/1/wbs-effects/0/eintritt", Some(json!({"an": true}))),
        (M::DELETE, "api/aufgaben/1/wbs-effects/0", None),
    ];
    for (methode, pfad, rumpf) in aufrufe {
        let (status, antwort) = status_von(methode.clone(), a, pfad, rumpf).await;
        assert_eq!(status, 404, "{methode} {pfad}: {antwort}");
    }
    assert_eq!((l.commits_k(), l.commits_r()), (k_vorher, r_vorher), "kein Commit");
    assert_eq!(l.wbs_bytes(), wbs_vorher, "WBS bytegleich");
    for pfad in ["api/endpunkte", "api/openapi.json"] {
        let text = lesen(a, pfad).await.to_string().to_lowercase();
        let grenze = |mut i: usize| {
            while !text.is_char_boundary(i) {
                i -= 1;
            }
            i
        };
        let stellen: Vec<&str> = text.match_indices("wbs").map(|(i, _)| &text[grenze(i.saturating_sub(60))..grenze((i + 40).min(text.len()))]).collect();
        assert!(stellen.is_empty(), "{pfad} nennt „wbs“: {stellen:#?}");
    }
}

// ---- AK 4 (API-Teil), AK 5: Wirkungen sind ein unbekannter Schlüssel --------------------------------------------------

#[tokio::test]
async fn ak04_api_zeigt_keine_wirkungen() {
    let l = Lage::neu();
    let lauf = l.starten();
    let a = lesen(lauf.adresse(), "api/aufgaben/1").await;
    assert!(a.get("wirkungen").is_none(), "{a}");
    let ausser_text: Vec<&String> = a.as_object().unwrap().iter().filter(|(k, v)| *k != "text" && v.to_string().contains("I0048")).map(|(k, _)| k).collect();
    assert!(ausser_text.is_empty(), "nur der Rohtext der Datei nennt den Knoten, kein Feld der API: {ausser_text:?}");
}

#[tokio::test]
async fn ak05_wirkungen_bleiben_beim_schreiben_inhaltlich_gleich() {
    let l = Lage::neu();
    std::fs::write(l.k.join("aufgaben/0004-leer.md"), "---\nid: 4\ntitle: Leer\nwbs-effects: []\n---\n").unwrap();
    l.committen();
    let erwartet = wirkungen_in(&format!("---\n{WIRKUNGEN}---\n"));
    let lauf = l.starten();
    let z = lesen(lauf.adresse(), "api/zustand").await;
    assert_eq!(z["defekte"], json!([]), "{z}");
    let vorher = l.commits_k();
    let (s, v) = senden(reqwest::Method::PATCH, lauf.adresse(), "api/aufgaben/1", json!({"titel": "Export prüfen"})).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(l.commits_k(), vorher + 1, "genau ein Commit");
    let text = l.datei("aufgaben/0001-export.md");
    assert_eq!(wirkungen_in(&text), erwartet, "inhaltlich gleich, executed eingeschlossen:\n{text}");
    let abschnitt = wirkungsabschnitt(&text);
    let (s, _) = senden(reqwest::Method::PATCH, lauf.adresse(), "api/aufgaben/1", json!({"titel": "Export prüfen 2"})).await;
    assert_eq!(s, 200);
    assert_eq!(wirkungsabschnitt(&l.datei("aufgaben/0001-export.md")), abschnitt, "ein zweites PATCH ändert kein Byte an wbs-effects");
    let (s, v) = lesen_status(lauf.adresse(), "api/aufgaben/4").await;
    assert_eq!(s, 200, "{v}");
    let (s, _) = senden(reqwest::Method::PATCH, lauf.adresse(), "api/aufgaben/4", json!({"titel": "Leer 2"})).await;
    assert_eq!(s, 200);
    assert_eq!(wirkungen_in(&l.datei("aufgaben/0004-leer.md")), serde_yaml::Value::Sequence(vec![]), "leere Liste bleibt als Schlüssel");
    assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new());
}

async fn lesen_status(adresse: &str, pfad: &str) -> (u16, Value) {
    status_von(reqwest::Method::GET, adresse, pfad, None).await
}

// ---- AK 6 (API-Teil): keine Plausibilität mehr, column-checks fällt beim Schreiben weg --------------------------------

#[tokio::test]
async fn ak06_bewegen_ohne_pruefwarnung_column_checks_faellt_im_commit_der_bewegung() {
    let l = Lage::neu();
    let lauf = l.starten();
    let a = lauf.adresse();
    let vorher = l.commits_k();
    let b = lesen(a, "api/boards/entwicklung").await;
    assert_eq!((l.commits_k(), &b["hinweise"]), (vorher, &json!([])), "Öffnen: kein Commit, keine Warnung");
    let (s, v) = bewegen(a, 1, "Erledigt").await;
    assert_eq!((s, &v["warnungen"]), (200, &json!([])), "keine Prüf-Warnung: {v}");
    assert_eq!(l.commits_k(), vorher + 1, "genau ein Commit");
    let im_commit = git(&l.k, &["show", "HEAD:boards/entwicklung.md"]);
    assert!(!im_commit.contains("column-checks"), "column-checks fehlt im Commit der Bewegung:\n{im_commit}");
    assert!(!im_commit.contains("column-phases"), "seit S3 (R00223 AK 2) fehlt auch column-phases im Commit der Bewegung:\n{im_commit}");
    assert_eq!(git(&l.k, &["show", "--name-only", "--format=", "HEAD"]), "boards/entwicklung.md", "nur die Board-Datei im Commit");
}

#[tokio::test]
async fn ak06_spalten_mit_pruefungen_200_ohne_column_checks() {
    let l = Lage::neu();
    let lauf = l.starten();
    let spalten = json!([
        {"name": "Offen", "notiz": "neu"}, {"name": "In Arbeit", "grenze": 1}, {"name": "Review", "pruefungen": ["wbs-effects-green"]}, {"name": "Erledigt", "pruefungen": ["wbs-effects-green"]}
    ]);
    let vorher = l.commits_k();
    let (s, v) = senden(reqwest::Method::PUT, lauf.adresse(), "api/boards/entwicklung/spalten", spalten).await;
    assert_eq!(s, 200, "{v}");
    let datei = l.datei("boards/entwicklung.md");
    assert_eq!(l.commits_k(), vorher + 1, "die Notiz schreibt das Board in einem Commit");
    assert!(datei.contains("column-notes") && !datei.contains("column-checks") && !datei.contains("wbs-effects-green"), "{datei}");
    let b = lesen(lauf.adresse(), "api/boards/entwicklung").await;
    assert!(b["spalten"].as_array().unwrap().iter().all(|s| s.get("pruefungen").is_none()), "{b}");
}

#[tokio::test]
async fn ak06_gegenprobe_wip_warnung_wie_vor_der_karte() {
    let l = Lage::neu();
    let lauf = l.starten();
    let a = lauf.adresse();
    let (s, _) = senden(reqwest::Method::POST, a, "api/aufgaben", json!({"titel": "Belegt", "board": "entwicklung", "spalte": "In Arbeit"})).await;
    assert!(s < 300);
    let (s, v) = bewegen(a, 2, "In Arbeit").await;
    assert_eq!((s, &v["warnungen"]), (200, &json!([{"pruefung": "grenze", "text": "Grenze erreicht: „In Arbeit“ hat 2 von 1"}])), "{v}");
}

// ---- AK 7: Änderungen an der WBS lösen kein Ereignis aus --------------------------------------------------------------

#[tokio::test]
async fn ak07_wbs_aenderung_und_commit_ohne_ereignis_aufgabe_mit_ereignis() {
    let l = Lage::neu();
    let lauf = gemeinsam::bis_beobachtet(gemeinsam::WAECHTER_OBERGRENZE, || {
        let lauf = l.starten();
        let _ = erste_antwort_abwarten(lauf.adresse());
        if lauf.beobachtet() { Ok(lauf) } else { Err("Wächter beobachtet nicht") }
    });
    let mitschnitt = Mitschnitt::starten(lauf.adresse()).await;
    let aufgabe = l.k.join("aufgaben/0002-liste.md");
    std::fs::write(&aufgabe, "---\nid: 2\ntitle: Liste geändert\n---\n").unwrap();
    mitschnitt.abwarten(|e| e.to_string().contains("0002-liste.md")).await;
    std::fs::write(l.wbs_pfad(), "# WBS geändert\n").unwrap();
    git(&l.r, &["-c", "user.name=Ada", "-c", "user.email=a@a", "commit", "-q", "-am", "C3 WBS"]);
    std::fs::write(&aufgabe, "---\nid: 2\ntitle: Liste zum zweiten\n---\n").unwrap();
    let ereignisse = mitschnitt.abwarten(|e| e.to_string().contains("0002-liste.md") && e != &Value::Null).await;
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    let ereignisse = [ereignisse, mitschnitt.ereignisse()].concat();
    assert!(!ereignisse.iter().any(|e| nennt_wbs(e, &l.r)), "kein Ereignis nennt die WBS oder trägt ein Feld wbs: {ereignisse:?}");
}

// ---- AK 8: Commit-Verweise in drei Registerformen, WBS unlesbar -------------------------------------------------------

/// Je Registerform (a) nur `repository`, (b) nur `wbs`, (c) nur `requirements`: Zustand von `kd:<C1>`, Diff von C1 und
/// Gesamt-Diff von #1 — mit der WBS `chmod 000`.
async fn folge_ak08(l: &Lage, programm: &Path, log: &str) -> Vec<Value> {
    let formen = [format!("kd: {{name: KD, repository: {}}}", l.r_text()), format!("kd: {{name: KD, wbs: {}}}", l.wbs()), format!("kd: {{name: KD, requirements: {}}}", l.anf())];
    let lauf = l.starten_mit(programm, log);
    let ziel = format!("kd:{}", l.c1);
    let mut ergebnis = vec![];
    for form in formen {
        l.register(&form);
        let v = verweis(lauf.adresse(), &ziel).await;
        let (s1, diff) = lesen_status(lauf.adresse(), &format!("api/aufgaben/1/diff?commit={ziel}")).await;
        let (s2, gesamt) = lesen_status(lauf.adresse(), "api/aufgaben/1/diff").await;
        ergebnis.push(l.ohne_pfad(&json!({"form": form.replace(&l.basis.display().to_string(), "<B>"), "zustand": v["zustand"], "titel": v["titel"], "diff": [s1, diff], "gesamt": [s2, gesamt]})));
    }
    assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new(), "{log}");
    ergebnis
}

#[tokio::test]
async fn ak08_commit_verweise_in_drei_registerformen_mit_unlesbarer_wbs() {
    let l = Lage::neu();
    l.wbs_rechte(0o000);
    let e = folge_ak08(&l, Path::new(env!("CARGO_BIN_EXE_kanbanD")), "log-ak08.txt").await;
    for f in &e {
        assert_eq!((&f["zustand"], &f["titel"], &f["diff"][0], &f["gesamt"][0]), (&json!("auf_zweig"), &json!("C1 Export anlegen"), &json!(200), &json!(200)), "{f}");
        assert_eq!((&f["diff"][1], &f["gesamt"][1]), (&e[0]["diff"][1], &e[0]["gesamt"][1]), "derselbe Inhalt in jeder Form: {f}");
    }
    l.wbs_rechte(0o644);
}

/// `R00222_ALT` = Programm vor der Karte: Zustand, Diff und Gesamt-Diff sind in allen drei Formen dieselben wie mit ihm.
#[tokio::test]
#[ignore = "Vergleich mit dem Programm vor der Karte von Hand: R00222_ALT=<Pfad zum Programm>"]
async fn ak08_gleich_wie_das_programm_vor_der_karte() {
    let alt = PathBuf::from(std::env::var("R00222_ALT").expect("R00222_ALT fehlt"));
    let l = Lage::neu();
    l.wbs_rechte(0o000);
    let vorher = folge_ak08(&l, &alt, "log-alt.txt").await;
    let nachher = folge_ak08(&l, Path::new(env!("CARGO_BIN_EXE_kanbanD")), "log-neu.txt").await;
    l.wbs_rechte(0o644);
    assert_eq!(nachher, vorher);
}

// ---- AK 9: Register im Übergang ---------------------------------------------------------------------------------------

#[tokio::test]
async fn ak09_put_mit_wbs_und_anforderungen_schreibt_nur_repository() {
    let l = Lage::neu();
    let lauf = l.starten();
    let a = lauf.adresse();
    let vorher = l.commits_k();
    let mut e = lesen(a, "api/einstellungen").await;
    e["quellen"] = json!({"repository": "", "wbs": "x.md", "anforderungen": "a/", "anwendungen": [{"kuerzel": "kd", "name": "KD", "repository": l.r_text(), "wbs": l.wbs(), "anforderungen": l.anf()}]});
    let (s, v) = senden(reqwest::Method::PUT, a, "api/einstellungen", e).await;
    assert_eq!(s, 200, "nie 400: {v}");
    assert_eq!(l.commits_k(), vorher + 1, "genau ein Commit");
    let datei = l.datei("kanbanD.md");
    assert_eq!(zeile_von(&datei, "kd").trim(), format!("kd: {{name: KD, repository: {}}}", l.r_text()), "{datei}");
    let sources = datei.split("sources:").nth(1).unwrap();
    assert!(!sources.contains("wbs") && !sources.contains("requirements"), "{datei}");
    let e = lesen(a, "api/einstellungen").await;
    let kd = anwendung(&e, "kd");
    assert!(kd.get("wbs").is_none() && kd.get("anforderungen").is_none(), "{kd}");
    assert!(e["quellen"].get("wbs").is_none() && e["quellen"].get("anforderungen").is_none(), "{}", e["quellen"]);
    let an = lesen(a, "api/anwendungen").await;
    assert!(an["kd"].get("wbs").is_none() && an["kd"].get("anforderungen").is_none(), "{an}");
    assert_eq!(an["kd"]["erreichbar"], json!({"repository": true}), "{an}");
}

#[tokio::test]
async fn ak09_rundlauf_in_altform_schreibt_den_startordner_als_repository() {
    let l = Lage::neu();
    l.register(&format!("kd: {{name: KD, wbs: {}}}", l.wbs()));
    l.committen();
    let vorher = l.commits_k();
    let lauf = l.starten();
    let a = lauf.adresse();
    let zustand = verweis(a, &format!("kd:{}", l.c1)).await["zustand"].clone();
    let e = lesen(a, "api/einstellungen").await;
    let planung = format!("{}/Dokumentation/Planung", l.r_text());
    assert_eq!(anwendung(&e, "kd")["repository"], json!(planung));
    assert_eq!(l.commits_k(), vorher, "ein Start allein schreibt nichts");
    let (s, v) = senden(reqwest::Method::PUT, a, "api/einstellungen", e).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(zeile_von(&l.datei("kanbanD.md"), "kd").trim(), format!("kd: {{name: KD, repository: {planung}}}"));
    assert_eq!(verweis(a, &format!("kd:{}", l.c1)).await["zustand"], zustand, "kd:<C1> behält seinen Zustand");
}

/// Wie `board_binden.binde` der Factory ab 1dd703c: Wiedererkennung über `realpath(repository)` (nie `a["wbs"]`), Eintrag
/// mit `repository`, `wbs` und `anforderungen`; ein zweiter Lauf erzeugt keinen Commit.
#[tokio::test]
async fn ak09_factory_bindet_zweimal_der_zweite_lauf_ohne_commit() {
    let l = Lage::neu();
    let lauf = l.starten();
    let a = lauf.adresse();
    let eintrag = json!({"kuerzel": "pa", "name": "Probe", "repository": l.r_text(), "wbs": l.wbs(), "anforderungen": l.anf()});
    let binden = || async {
        let mut e = lesen(a, "api/einstellungen").await;
        let real = |p: &Value| p.as_str().and_then(|p| std::fs::canonicalize(p).ok());
        let liste = e["quellen"]["anwendungen"].as_array().unwrap().clone();
        if liste.iter().any(|x| x["kuerzel"] == eintrag["kuerzel"] && real(&x["repository"]) == real(&eintrag["repository"])) {
            return;
        }
        e["quellen"]["anwendungen"].as_array_mut().unwrap().push(eintrag.clone());
        let (s, v) = senden(reqwest::Method::PUT, a, "api/einstellungen", e).await;
        assert_eq!(s, 200, "{v}");
    };
    binden().await;
    let nach_erstem = l.commits_k();
    binden().await;
    assert_eq!(l.commits_k(), nach_erstem, "der zweite Lauf erzeugt keinen Commit");
    assert_eq!(zeile_von(&l.datei("kanbanD.md"), "pa").trim(), format!("pa: {{name: Probe, repository: {}}}", l.r_text()));
}

// ---- AK 13: Legacy-Probe gegen eine Kopie des JoinPuya-Ordners (von Hand, B1158) -------------------------------------

/// `R00222_KOPIE` = Kopie des Board-Ordners (wird beschrieben), `R00222_ALT` = Programm vor der Karte,
/// `R00222_WER` = Kürzel eines Menschen dort, `R00222_BOARD` = Board mit `column-phases`.
#[tokio::test]
#[ignore = "Legacy-Probe von Hand: braucht eine Kopie des JoinPuya-Ordners (R00222_KOPIE …)"]
async fn ak13_legacy_probe_joinpuya_kopie() {
    let var = |n: &str| std::env::var(n).unwrap_or_else(|_| panic!("{n} fehlt"));
    let (kopie, alt, wer, slug) = (PathBuf::from(var("R00222_KOPIE")), PathBuf::from(var("R00222_ALT")), var("R00222_WER"), var("R00222_BOARD"));
    let ablage = kopie.parent().unwrap().to_path_buf();
    let zahl = || git(&kopie, &["rev-list", "--count", "HEAD"]);
    let start = zahl();
    let mit_wirkung: Vec<PathBuf> = std::fs::read_dir(kopie.join("aufgaben")).unwrap().filter_map(|e| e.ok().map(|e| e.path())).filter(|p| std::fs::read_to_string(p).unwrap_or_default().contains("wbs-effects:")).collect();
    assert!(!mit_wirkung.is_empty(), "Kopie hat Aufgaben mit wbs-effects");
    let mut zustaende = vec![];
    let mut phasen = vec![];
    for (programm, log) in [(alt.as_path(), "log-alt.txt"), (Path::new(env!("CARGO_BIN_EXE_kanbanD")), "log-neu.txt")] {
        let lauf = Instanz::starten(programm, &kopie, ablage.join(log));
        let z = lesen(lauf.adresse(), "api/zustand").await;
        assert_eq!(z["defekte"], json!([]), "{log}: {}", z["defekte"]);
        let alle = lesen(lauf.adresse(), "api/aufgaben").await;
        let mut je_verweis = std::collections::BTreeMap::new();
        for nr in alle["aufgaben"].as_array().unwrap().iter().filter(|a| a["commits"].as_array().is_some_and(|c| !c.is_empty())).filter_map(|a| a["nummer"].as_u64()) {
            let l = lesen(lauf.adresse(), &format!("api/aufgaben/{nr}/commits")).await;
            for e in l["commits"].as_array().unwrap() {
                je_verweis.insert(format!("#{nr} {}", e["verweis"]), e["zustand"].clone());
            }
        }
        zustaende.push(je_verweis);
        phasen.push(lesen(lauf.adresse(), &format!("api/boards/{slug}")).await["phasen"].clone());
        assert_eq!(zahl(), start, "{log}: kein Commit beim Start");
        assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new(), "{log}");
    }
    assert_eq!(zustaende[0], zustaende[1], "jopu:<hash> in beiden Läufen gleich");
    // R00222 AK 13 „phasen wie vor der Karte“ gilt seit S3 nicht mehr (R00223, ADR-0034 N4): das Board liefert kein phasen
    assert!(phasen[1].is_null(), "seit S3 kein phasen: {}", phasen[1]);
    let lauf = Instanz::starten(Path::new(env!("CARGO_BIN_EXE_kanbanD")), &kopie, ablage.join("log-schreiben.txt"));
    let a = lauf.adresse();
    let datei = &mit_wirkung[0];
    let vorher = wirkungen_in(&std::fs::read_to_string(datei).unwrap());
    let nr: u32 = frontmatter(&std::fs::read_to_string(datei).unwrap())["id"].as_u64().unwrap() as u32;
    let (s, v) = gemeinsam::senden(reqwest::Method::PATCH, a, &format!("api/aufgaben/{nr}"), &wer, json!({"titel": "Legacy-Probe R00222"})).await;
    assert_eq!(s, 200, "{v}");
    assert_eq!(wirkungen_in(&std::fs::read_to_string(datei).unwrap()), vorher, "wbs-effects inhaltlich gleich");
    let b = lesen(a, &format!("api/boards/{slug}")).await;
    let spalten = b["spalten"].as_array().unwrap();
    let (nummer, ziel) = spalten.iter().zip(spalten.iter().skip(1)).find_map(|(s, t)| s["aufgaben"][0].as_u64().map(|n| (n, t["name"].clone()))).expect("eine Aufgabe zum Bewegen");
    let (s, v) = gemeinsam::senden(reqwest::Method::POST, a, &format!("api/boards/{slug}/bewegen"), &wer, json!({"nummer": nummer, "spalte": ziel})).await;
    assert_eq!(s, 200, "{v}");
    assert!(!std::fs::read_to_string(kopie.join(format!("boards/{slug}.md"))).unwrap().contains("column-phases"), "column-phases fehlt nach der Bewegung (R00223 AK 16)");
    let e = lesen(a, "api/einstellungen").await;
    let (s, v) = gemeinsam::senden(reqwest::Method::PUT, a, "api/einstellungen", &wer, e).await;
    assert_eq!(s, 200, "{v}");
    let text = std::fs::read_to_string(kopie.join("kanbanD.md")).unwrap();
    let jopu = zeile_von(&text, "jopu");
    assert!(jopu.contains("repository:") && !jopu.contains("wbs:") && !jopu.contains("requirements:"), "{jopu}");
    assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new());
}

// ---- Hilfe: erste HTTP-Antwort abwarten (Router und Wächter stehen danach) -------------------------------------------

fn erste_antwort_abwarten(adresse: &str) -> std::io::Result<()> {
    use std::io::{Read, Write};
    let ziel = adresse.trim_start_matches("http://").trim_end_matches('/');
    let mut leitung = std::net::TcpStream::connect(ziel)?;
    leitung.set_read_timeout(Some(std::time::Duration::from_secs(10)))?;
    leitung.write_all(b"GET / HTTP/1.0\r\n\r\n")?;
    leitung.read_exact(&mut [0u8; 1])
}

// ---- AK 12: README ohne WBS-Sicht, Wirkungen und Plausibilität -------------------------------------------------------

/// Das Wort `wbs` (ohne Groß-/Kleinschreibung) steht nur noch im Satz zum Lese-Rückfall der Wurzel und in der Zeile zu den
/// Phasen (bis S3, #227); „Bedienen in Kürze“ nennt weder WBS-Sicht noch Wirkungen noch Plausibilität, „Für Agenten“ weder
/// `/api/wbs` noch `wbs-effects` noch ein Ereignisfeld `wbs`.
#[test]
fn ak12_readme_nennt_die_wbs_nur_im_rueckfall_und_bei_den_phasen() {
    let readme = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/README.md")).unwrap();
    let mit_wbs: Vec<&str> = readme.lines().filter(|z| z.to_lowercase().contains("wbs")).collect();
    let erlaubt = |z: &&str| z.starts_with("- **Phasen als Spalten**") || z.contains("Lese-Rückfall");
    assert!(mit_wbs.iter().all(erlaubt), "Zeilen mit „wbs“ außerhalb von Rückfall und Phasen:\n{}", mit_wbs.iter().filter(|z| !erlaubt(z)).map(|z| z.chars().take(120).collect::<String>()).collect::<Vec<_>>().join("\n"));
    assert_eq!(mit_wbs.len(), 2, "genau der Rückfall-Satz und die Phasen-Zeile");
    for verboten in ["/api/wbs", "wbs-effects", "Wirkungen auf die WBS", "Plausibilitätsprüfung", "column-checks", "`g k`"] {
        assert!(!readme.contains(verboten), "README nennt noch „{verboten}“");
    }
}
