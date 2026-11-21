// R00218 (I0208, Karte #220): Nachfolger eines verwaisten Commits suchen — Akzeptanztests der API (AK 2–6) gegen das
// echte Programm und ein echtes Arbeits-Repository (Ausgangslage siehe `gemeinsam::R218`).
mod gemeinsam;

use gemeinsam::{Laufendes, R218, ausgangslage_r00218, git, senden, starten_mit};
use serde_json::{Value, json};
use std::time::{Duration, Instant};

// ---- Treiber ---------------------------------------------------------------------------------------------------------

fn starten(a: &R218, umgebung: &[(&str, &str)]) -> Laufendes {
    starten_mit(&a.board, &["--port", "0"], umgebung)
}

struct Antwort {
    status: u16,
    etag: Option<String>,
    rumpf: Value,
    text: String,
}

/// `GET /api/aufgaben/{nr}/commits/{verweis}/nachfolger` ohne `X-KanbanD-Wer`, optional mit `If-None-Match`.
async fn nachfolger(adresse: &str, nr: u32, verweis: &str, bekannt: Option<&str>) -> Antwort {
    let mut anfrage = reqwest::Client::new().get(format!("{adresse}api/aufgaben/{nr}/commits/{verweis}/nachfolger"));
    if let Some(b) = bekannt {
        anfrage = anfrage.header("If-None-Match", b);
    }
    let r = anfrage.send().await.unwrap();
    let status = r.status().as_u16();
    let etag = r.headers().get("etag").and_then(|w| w.to_str().ok()).map(String::from);
    let text = r.text().await.unwrap();
    Antwort { status, etag, rumpf: serde_json::from_str(&text).unwrap_or(Value::Null), text }
}

fn kd(h: &str) -> String {
    format!("kd:{h}")
}

fn hashes(rumpf: &Value) -> Vec<String> {
    rumpf["kandidaten"].as_array().unwrap().iter().map(|k| k["hash"].as_str().unwrap().to_string()).collect()
}

/// Alle Texte, die keine Antwort der Suche tragen darf (AK 5).
fn ohne_inhalt(a: &Antwort) {
    for verboten in ["\"patch\"", "\"pfad\"", "\"dateien\"", "a.txt", "b.txt", "bild.png", "Zeile zwei anders ändern"] {
        assert!(!a.text.contains(verboten), "{verboten} in {}", a.text);
    }
}

// ---- AK 2: Kandidaten ------------------------------------------------------------------------------------------------

// AK 2, AK 5: K → genau K' auf `main`; C → C1, dann C2; #3 → K' an der Karte; 12 Zweige → 10 und 2 weitere, bei 10 ohne
// Feld; die Commit-Zahl und `git status` bleiben bei allen Aufrufen gleich, keine Antwort trägt Inhalt
#[tokio::test]
async fn ak2_kandidaten() {
    let a = ausgangslage_r00218();
    let lauf = starten(&a, &[]);
    let vorher = a.stand();
    let k = nachfolger(&lauf.adresse, 1, &format!("kd:{}", &a.k[..7]), None).await;
    assert_eq!(k.status, 200, "{}", k.text);
    assert_eq!(k.rumpf["kandidaten"].as_array().unwrap().len(), 1, "{}", k.text);
    let kandidat = &k.rumpf["kandidaten"][0];
    assert_eq!((&kandidat["verweis"], &kandidat["zweige"], &kandidat["an_der_karte"]), (&json!(kd(&a.k2)), &json!(["main"]), &json!(false)));
    assert!(!hashes(&k.rumpf).contains(&a.g));
    ohne_inhalt(&k);
    let c = nachfolger(&lauf.adresse, 2, &kd(&a.c), None).await;
    assert_eq!(hashes(&c.rumpf), [a.c1.clone(), a.c2.clone()], "Commit-Datum absteigend");
    ohne_inhalt(&c);
    let k3 = nachfolger(&lauf.adresse, 3, &kd(&a.k), None).await;
    assert_eq!((&k3.rumpf["kandidaten"][0]["hash"], &k3.rumpf["kandidaten"][0]["an_der_karte"]), (&json!(a.k2), &json!(true)));
    a.c_auf_weitere_zweige(3, 10);
    let zehn = nachfolger(&lauf.adresse, 2, &kd(&a.c), None).await;
    assert_eq!(zehn.rumpf["kandidaten"].as_array().unwrap().len(), 10);
    assert!(zehn.rumpf.get("kandidaten_weitere").is_none(), "bei genau 10 fehlt das Feld: {}", zehn.text);
    a.c_auf_weitere_zweige(11, 12);
    let zwoelf = nachfolger(&lauf.adresse, 2, &kd(&a.c), None).await;
    assert_eq!((zwoelf.rumpf["kandidaten"].as_array().unwrap().len(), &zwoelf.rumpf["kandidaten_weitere"]), (10, &json!(2)));
    assert_eq!(zwoelf.rumpf["kandidaten"][0]["zweige"], json!(["c12"]), "neuester zuerst");
    ohne_inhalt(&zwoelf);
    let (zahl, _, board_status) = a.stand();
    assert_eq!((zahl, board_status), (vorher.0, vorher.2), "Board-Ordner unverändert");
}

// ---- AK 3: ohne Kandidat, mit Hinweis ----------------------------------------------------------------------------------

// AK 3: Squash leer ohne Hinweis, Merge `merge`, leerer Commit `leer`, Binärdatei nur mit gleichem Inhalt (B3, nie B2);
// R2 mit 1.001 Commits nach V → `suche_gekappt` mit `durchsucht: 1000`, `grund: fenster`
#[tokio::test]
async fn ak3_ohne_kandidat_mit_hinweis() {
    let a = ausgangslage_r00218();
    let lauf = starten(&a, &[]);
    let s1 = nachfolger(&lauf.adresse, 4, &kd(&a.s1), None).await;
    assert_eq!((s1.status, &s1.rumpf["kandidaten"], &s1.rumpf["hinweise"]), (200, &json!([]), &json!([])), "{}", s1.text);
    let mg = nachfolger(&lauf.adresse, 4, &kd(&a.mg), None).await;
    assert_eq!((&mg.rumpf["kandidaten"], &mg.rumpf["hinweise"]), (&json!([]), &json!([{"art": "merge"}])));
    let e = nachfolger(&lauf.adresse, 4, &kd(&a.e), None).await;
    assert_eq!((&e.rumpf["kandidaten"], &e.rumpf["hinweise"]), (&json!([]), &json!([{"art": "leer"}])));
    let b = nachfolger(&lauf.adresse, 4, &kd(&a.b), None).await;
    assert_eq!(hashes(&b.rumpf), [a.b3.clone()]);
    assert!(!b.text.contains(&a.b2));
    for antwort in [&s1, &mg, &e, &b] {
        ohne_inhalt(antwort);
    }
    // R2: V verwaist, danach 1.001 Commits auf `main`
    let r2 = a.r.parent().unwrap().join("R2");
    std::fs::create_dir_all(&r2).unwrap();
    git(&r2, &["init", "-q", "-b", "main"]);
    let mut strom = String::from("commit refs/heads/v\ncommitter A <a@a> 1800000000 +0000\ndata 1\nv\nM 644 inline v.txt\ndata 2\nv\n\n");
    for i in 0..1_001 {
        let d = format!("{i}\n");
        strom.push_str(&format!("commit refs/heads/main\ncommitter A <a@a> {} +0000\ndata 1\nm\nM 644 inline m.txt\ndata {}\n{d}\n", 1_800_000_100 + i, d.len()));
    }
    let mut kind = std::process::Command::new("git").arg("-C").arg(&r2).args(["fast-import", "--quiet"]).stdin(std::process::Stdio::piped()).spawn().unwrap();
    std::io::Write::write_all(&mut kind.stdin.take().unwrap(), strom.as_bytes()).unwrap();
    assert!(kind.wait().unwrap().success());
    let v = git(&r2, &["rev-parse", "v"]);
    git(&r2, &["branch", "-q", "-D", "v"]);
    std::fs::write(r2.join("app.md"), "# R2\n").unwrap();
    let einstellungen = std::fs::read_to_string(a.board.join("kanbanD.md")).unwrap().replace("applications:\n", &format!("applications:\n    r2: {{name: R2, wbs: {}/app.md, requirements: \"\"}}\n", r2.display()));
    std::fs::write(a.board.join("kanbanD.md"), einstellungen).unwrap();
    std::fs::write(a.board.join("aufgaben/0005-karte.md"), format!("---\nid: 5\ntitle: Karte 5\ncommits:\n  - r2:{v}\n---\n")).unwrap();
    git(&a.board, &["-c", "user.name=V", "-c", "user.email=v@v", "add", "-A"]);
    git(&a.board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "R2"]);
    let lauf = starten(&a, &[]);
    let gekappt = nachfolger(&lauf.adresse, 5, &format!("r2:{v}"), None).await;
    assert_eq!(gekappt.status, 200, "{}", gekappt.text);
    assert_eq!(gekappt.rumpf["hinweise"], json!([{"art": "suche_gekappt", "durchsucht": 1000, "grund": "fenster"}]));
    assert_eq!(gekappt.rumpf["durchsucht"], json!(1000));
}

// ---- AK 4: Zulassung und Zeitgrenze ------------------------------------------------------------------------------------

// AK 4: 999 → 404; M1 (auf `main`) → 404 `{fehler, zustand: "auf_zweig"}`; fremder Verweis → 404 `{fehler, verweis}`;
// `kd:main` und Präfix mit 6 Zeichen → 400; defekte Aufgabendatei → 423; kein Aufruf braucht `X-KanbanD-Wer`
#[tokio::test]
async fn ak4_zulassung() {
    let a = ausgangslage_r00218();
    let lauf = starten(&a, &[]);
    assert_eq!(nachfolger(&lauf.adresse, 999, &kd(&a.k), None).await.status, 404);
    let m1 = nachfolger(&lauf.adresse, 1, &format!("kd:{}", &a.m1[..7]), None).await;
    assert_eq!((m1.status, &m1.rumpf["zustand"]), (404, &json!("auf_zweig")), "{}", m1.text);
    assert!(m1.rumpf["fehler"].is_string());
    let fremd = nachfolger(&lauf.adresse, 1, &kd(&a.g), None).await;
    assert_eq!((fremd.status, &fremd.rumpf["verweis"]), (404, &json!(kd(&a.g))), "{}", fremd.text);
    assert_eq!(nachfolger(&lauf.adresse, 1, "kd:main", None).await.status, 400);
    assert_eq!(nachfolger(&lauf.adresse, 1, &format!("kd:{}", &a.k[..6]), None).await.status, 400);
    std::fs::write(a.board.join("aufgaben/0001-karte.md"), "---\nid: 1\ntitle: [kaputt\n---\n").unwrap();
    let defekt = nachfolger(&lauf.adresse, 1, &kd(&a.k), None).await;
    assert_eq!(defekt.status, 423, "{}", defekt.text);
}

// AK 4: ein `git`, das `patch-id` 60 s festhält → nach höchstens 15 s 503 `{fehler}` ohne `kandidaten`
#[tokio::test]
async fn ak4_haengendes_patch_id_ist_503() {
    let a = ausgangslage_r00218();
    let echt = String::from_utf8(std::process::Command::new("sh").args(["-c", "command -v git"]).output().unwrap().stdout).unwrap().trim().to_string();
    let ordner = a.r.parent().unwrap().join("bin-patch-id");
    std::fs::create_dir_all(&ordner).unwrap();
    std::fs::write(ordner.join("git"), format!("#!/bin/sh\ncase \"$*\" in *patch-id*) sleep 60 ;; esac\nexec {echt} \"$@\"\n")).unwrap();
    std::fs::set_permissions(ordner.join("git"), std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    let pfad = format!("{}:{}", ordner.display(), std::env::var("PATH").unwrap());
    let lauf = starten(&a, &[("PATH", &pfad)]);
    let start = Instant::now();
    let antwort = nachfolger(&lauf.adresse, 1, &kd(&a.k), None).await;
    let dauer = start.elapsed();
    assert_eq!(antwort.status, 503, "{}", antwort.text);
    assert!(dauer <= Duration::from_secs(15), "{dauer:?}");
    assert!(antwort.rumpf["fehler"].is_string() && antwort.rumpf.get("kandidaten").is_none(), "{}", antwort.text);
}

// ---- AK 5: nur lesen, nie Inhalt -----------------------------------------------------------------------------------------

// AK 5: der Kandidat ist kein Verweis der Karte — `?commit=kd:<K'>` an #1 ergibt 404, bis ersetzt ist; R und Board-Ordner
// bleiben bei allen Suchen unverändert
#[tokio::test]
async fn ak5_nur_lesen() {
    let a = ausgangslage_r00218();
    let lauf = starten(&a, &[]);
    let vorher = a.stand();
    for (nr, v) in [(1, &a.k), (2, &a.c), (3, &a.k), (4, &a.s1), (4, &a.mg), (4, &a.e), (4, &a.b)] {
        let antwort = nachfolger(&lauf.adresse, nr, &kd(v), None).await;
        assert_eq!(antwort.status, 200, "{}", antwort.text);
        ohne_inhalt(&antwort);
    }
    let diff = reqwest::get(format!("{}api/aufgaben/1/diff?commit={}", lauf.adresse, kd(&a.k2))).await.unwrap();
    assert_eq!(diff.status().as_u16(), 404);
    assert_eq!(a.stand(), vorher, "Commit-Zahl, git status in R und im Board-Ordner");
    let (status, _) = senden(reqwest::Method::POST, &lauf.adresse, "api/aufgaben/1/commits/ersetzen", "sh", json!({"ersetzungen": [{"alt": kd(&a.k), "neu": kd(&a.k2)}]})).await;
    assert_eq!(status, 200);
    let diff = reqwest::get(format!("{}api/aufgaben/1/diff?commit={}", lauf.adresse, kd(&a.k2))).await.unwrap();
    assert_eq!(diff.status().as_u16(), 200, "nach dem Ersetzen ist K' ein Verweis der Karte");
}

// ---- AK 6: ETag und Beschreibung -----------------------------------------------------------------------------------------

// AK 6: gleicher `If-None-Match` → 304; nach `git branch neu M0` → 200 mit neuem `ETag`; nach dem Hinterlegen von K' an #1
// ebenso, dann `an_der_karte: true`
#[tokio::test]
async fn ak6_etag() {
    let a = ausgangslage_r00218();
    let lauf = starten(&a, &[]);
    let erst = nachfolger(&lauf.adresse, 1, &kd(&a.k), None).await;
    let etag = erst.etag.clone().expect("ETag");
    let wieder = nachfolger(&lauf.adresse, 1, &kd(&a.k), Some(&etag)).await;
    assert_eq!((wieder.status, wieder.text.as_str()), (304, ""));
    git(&a.r, &["branch", "neu", &a.m0]);
    let zweig = nachfolger(&lauf.adresse, 1, &kd(&a.k), Some(&etag)).await;
    assert_eq!(zweig.status, 200);
    assert_ne!(zweig.etag.as_deref(), Some(etag.as_str()));
    let (status, _) = senden(reqwest::Method::POST, &lauf.adresse, "api/aufgaben/1/commits", "entw1", json!({"commits": [kd(&a.k2)]})).await;
    assert_eq!(status, 200);
    let hinterlegt = nachfolger(&lauf.adresse, 1, &kd(&a.k), zweig.etag.as_deref()).await;
    assert_eq!(hinterlegt.status, 200);
    assert_ne!(hinterlegt.etag, zweig.etag);
    assert_eq!(hinterlegt.rumpf["kandidaten"][0]["an_der_karte"], json!(true));
}

// AK 6: Endpunktliste, OpenAPI und /api nennen den Endpunkt mit 200, 304, 400, 404, 423, 503; README „Für Agenten“ hat das
// Beispiel „Nachfolger suchen, dann ersetzen“
#[tokio::test]
async fn ak6_beschreibung() {
    let a = ausgangslage_r00218();
    let lauf = starten(&a, &[]);
    let route = "/api/aufgaben/{nr}/commits/{verweis}/nachfolger";
    let liste: Value = reqwest::get(format!("{}api/endpunkte", lauf.adresse)).await.unwrap().json().await.unwrap();
    let eintrag = liste.as_array().unwrap().iter().find(|e| e["methode"] == "GET" && e["pfad"] == route).expect("Endpunktliste");
    assert_eq!((&eintrag["wer"], &eintrag["thema"]), (&json!(false), &json!("Aufgaben")));
    let d: Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse)).await.unwrap().json().await.unwrap();
    let op = &d["paths"][route]["get"];
    assert_eq!(op["description"], eintrag["zweck"]);
    for status in ["200", "304", "400", "404", "423", "503"] {
        assert!(op["responses"][status].is_object(), "{status} fehlt");
    }
    assert!(d["components"]["schemas"]["Nachfolger"]["properties"]["kandidaten"].is_object());
    let seite = reqwest::get(format!("{}api", lauf.adresse)).await.unwrap().text().await.unwrap();
    assert!(seite.contains(route));
    let readme = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/README.md")).unwrap();
    let abschnitt = readme.split("### Nachfolger eines verwaisten Commits suchen").nth(1).expect("README-Abschnitt");
    assert!(abschnitt.contains("Nachfolger suchen, dann ersetzen") && abschnitt.contains("/nachfolger") && abschnitt.contains("commits/ersetzen"));
    for status in ["200", "304", "400", "404", "423", "503"] {
        assert!(abschnitt.split("###").next().unwrap().contains(status), "README nennt {status}");
    }
}
