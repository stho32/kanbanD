// R00209 (I0199, Karte #225): Register führt das Repository der Anwendung — Akzeptanztests gegen das echte Programm und
// ein echtes Arbeits-Repository (Ausgangslage von R00209, siehe `Lage::neu`). Schichten: Testfall (je AK) → Testsprache
// (`Lage`, `register`, `eintrag_kd`) → Treiber (`lesen`, `einstellungen_setzen`: URL, Header, Status) → Programm.
// AK 6 (unveränderte Factory) und AK 8 (Kopie des JoinPuya-Ordners) laufen zusätzlich von Hand in B1040; hier steht der
// Rundlauf der Factory als API-Folge (`ak06_…`) und die Legacy-Probe als `#[ignore]`-Test mit Umgebungsvariablen.
mod gemeinsam;

use gemeinsam::{git, lies};
use serde_json::{Value, json};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};

// ---- Treiber ----------------------------------------------------------------------------------------------------------

async fn lesen(adresse: &str, pfad: &str) -> Value {
    let r = reqwest::get(format!("{adresse}{pfad}")).await.unwrap();
    assert_eq!(r.status().as_u16(), 200, "GET {pfad}");
    r.json().await.unwrap()
}

async fn einstellungen_setzen(adresse: &str, e: &Value) -> (u16, Value) {
    gemeinsam::senden(reqwest::Method::PUT, adresse, "api/einstellungen", "sh", e.clone()).await
}

/// Das Programm mit eigenem Mitschnitt von stderr (AK 3, 7: „keine Fehler- oder Warnzeile im Log“).
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
    fn starten(programm: &Path, board: &Path, log: PathBuf) -> Instanz {
        let mut kind = Command::new(programm)
            .arg(board)
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

    /// Zeilen des Logs, die nach Fehler oder Warnung aussehen.
    fn auffaellige_zeilen(&self) -> Vec<String> {
        std::fs::read_to_string(&self.log).unwrap_or_default().lines().filter(|z| ["fehler", "warn", "error", "defekt"].iter().any(|w| z.to_lowercase().contains(w))).map(String::from).collect()
    }
}

// ---- Testsprache: Ausgangslage ----------------------------------------------------------------------------------------

/// Ausgangslage von R00209: Arbeits-Repository `R` mit Commit `C` auf `main`, `R/Dokumentation/Planung/kd.md` und
/// `R/Anforderungen/`; kanbanD-Ordner `K` außerhalb von `R`; Aufgabe #1 trägt `kd:<C>`, `pa:<C>` und `<C>`.
struct Lage {
    _tmp: tempfile::TempDir,
    basis: PathBuf,
    r: PathBuf,
    k: PathBuf,
    c: String,
}

impl Lage {
    fn neu() -> Lage {
        let tmp = tempfile::tempdir().unwrap();
        let basis = tmp.path().canonicalize().unwrap();
        let (r, k) = (basis.join("R"), basis.join("K"));
        std::fs::create_dir_all(r.join("Dokumentation/Planung")).unwrap();
        std::fs::create_dir_all(r.join("Anforderungen")).unwrap();
        std::fs::write(r.join("Dokumentation/Planung/kd.md"), "# WBS\n").unwrap();
        std::fs::write(r.join("Anforderungen/R00001-x.md"), "# R00001\n").unwrap();
        git(&r, &["init", "-q", "-b", "main"]);
        git(&r, &["add", "-A"]);
        git(&r, &["-c", "user.name=Ada", "-c", "user.email=a@a", "commit", "-q", "-m", "Erster Stand"]);
        let c = git(&r, &["rev-parse", "HEAD"]);
        std::fs::create_dir_all(k.join("aufgaben")).unwrap();
        std::fs::create_dir_all(k.join("boards")).unwrap();
        std::fs::write(k.join("aufgaben/0001-eins.md"), format!("---\nid: 1\ntitle: eins\ncommits:\n  - kd:{c}\n  - pa:{c}\n  - lc:{c}\n  - {c}\n---\n")).unwrap();
        std::fs::write(k.join("boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n").unwrap();
        let l = Lage { _tmp: tmp, basis, r, k, c };
        l.register("");
        git(&l.k, &["init", "-q"]);
        l.committen();
        l
    }

    fn wbs(&self) -> String {
        format!("{}/Dokumentation/Planung/kd.md", self.r.display())
    }

    fn anf(&self) -> String {
        format!("{}/Anforderungen", self.r.display())
    }

    fn r_text(&self) -> String {
        self.r.display().to_string()
    }

    /// `kanbanD.md` mit Stefan (Mensch), einem Agenten und den Registerzeilen `zeilen` (ohne Einrückung je Zeile `kd: {…}`).
    fn register(&self, zeilen: &str) {
        let anwendungen = if zeilen.is_empty() { String::new() } else { format!("  applications:\n{}", zeilen.lines().map(|z| format!("    {z}\n")).collect::<String>()) };
        std::fs::write(self.k.join("kanbanD.md"), format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\n  entw1: {{name: Entwickler, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n{anwendungen}---\n")).unwrap();
    }

    fn committen(&self) {
        git(&self.k, &["add", "-A"]);
        git(&self.k, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Stand"]);
    }

    fn commits_zahl(&self) -> String {
        git(&self.k, &["rev-list", "--count", "HEAD"])
    }

    fn starten(&self) -> Instanz {
        Instanz::starten(Path::new(env!("CARGO_BIN_EXE_kanbanD")), &self.k, self.basis.join("log.txt"))
    }

    fn datei(&self) -> String {
        lies(&self.k, "kanbanD.md")
    }
}

/// Der Eintrag `<kürzel>:<C>` (bzw. `<C>` ohne Kürzel) aus `GET /api/aufgaben/1/commits`.
async fn verweis(adresse: &str, verweis: &str) -> Value {
    let l = lesen(adresse, "api/aufgaben/1/commits").await;
    l["commits"].as_array().unwrap().iter().find(|e| e["verweis"] == verweis).cloned().unwrap_or_else(|| panic!("{verweis} fehlt: {l}"))
}

/// Was an einem Verweis gleich bleiben muss (AK 2): Zustand, Hash, Titel, Zweige.
fn kern(e: &Value) -> Value {
    json!({"zustand": e["zustand"], "hash": e["hash"], "titel": e["titel"], "zweige": e["zweige"]})
}

fn anwendung<'a>(e: &'a Value, kuerzel: &str) -> &'a Value {
    e["quellen"]["anwendungen"].as_array().unwrap().iter().find(|a| a["kuerzel"] == kuerzel).unwrap_or_else(|| panic!("{kuerzel} fehlt: {e}"))
}

fn zeile_von<'a>(datei: &'a str, kuerzel: &str) -> &'a str {
    datei.lines().find(|z| z.trim_start().starts_with(&format!("{kuerzel}: "))).unwrap_or_else(|| panic!("{kuerzel} fehlt in\n{datei}"))
}

// ---- AK 1: Startordner ------------------------------------------------------------------------------------------------

#[tokio::test]
#[ignore = "erwartet rot (ATDD) bis B1036–B1038"]
async fn ak01_startordner_je_zeile_der_tabelle() {
    let l = Lage::neu();
    let lauf = l.starten();
    let zeilen = [
        ("{name: A, repository: /p/app, wbs: /p/app/Dokumentation/Planung/app.md, requirements: /p/app/Anforderungen}", "/p/app"),
        ("{name: A, wbs: /p/app/Dokumentation/Planung/app.md, requirements: /p/app/Anforderungen}", "/p/app/Dokumentation/Planung"),
        ("{name: A, requirements: /p/app/Anforderungen}", "/p/app/Anforderungen"),
        ("{name: A, repository: \"  \", wbs: Dokumentation/Planung/app.md}", "Dokumentation/Planung"),
        ("{name: A, wbs: app.md}", "."),
        ("{name: A, repository: /p/fehlt, wbs: /p/app/Dokumentation/Planung/app.md}", "/p/fehlt"),
        ("{name: A}", ""),
    ];
    for (eintrag, erwartet) in zeilen {
        l.register(&format!("kd: {eintrag}"));
        let e = lesen(lauf.adresse(), "api/einstellungen").await;
        assert_eq!(anwendung(&e, "kd")["repository"], erwartet, "{eintrag}");
        let a = lesen(lauf.adresse(), "api/anwendungen").await;
        assert_eq!(a["kd"]["repository"], erwartet, "{eintrag}");
    }
}

// ---- AK 2, 3: Commit-Verweise in allen Registerformen -----------------------------------------------------------------

#[tokio::test]
#[ignore = "erwartet rot (ATDD) bis B1036–B1038"]
async fn ak02_ak03_gleicher_zustand_in_allen_registerformen() {
    let l = Lage::neu();
    let lauf = l.starten();
    let ziel = format!("kd:{}", l.c);
    l.register(&format!("kd: {{name: kanbanD, wbs: {}, requirements: {}}}", l.wbs(), l.anf()));
    let mit_wbs = kern(&verweis(lauf.adresse(), &ziel).await);
    assert_eq!(mit_wbs, json!({"zustand": "auf_zweig", "hash": l.c, "titel": "Erster Stand", "zweige": ["main"]}));
    l.register(&format!("kd: {{name: kanbanD, repository: {}}}", l.r_text()));
    assert_eq!(kern(&verweis(lauf.adresse(), &ziel).await), mit_wbs, "neues Register");
    l.register(&format!("kd: {{name: kanbanD, requirements: {}}}", l.anf()));
    assert_eq!(kern(&verweis(lauf.adresse(), &ziel).await), mit_wbs, "nur requirements");
    l.register(&format!("kd: {{name: kanbanD, wbs: {}}}", l.wbs()));
    let wbs_datei = l.r.join("Dokumentation/Planung/kd.md");
    std::fs::set_permissions(&wbs_datei, std::os::unix::fs::PermissionsExt::from_mode(0o000)).unwrap();
    assert_eq!(kern(&verweis(lauf.adresse(), &ziel).await), mit_wbs, "WBS-Datei unlesbar (chmod 000)");
    std::fs::set_permissions(&wbs_datei, std::os::unix::fs::PermissionsExt::from_mode(0o644)).unwrap();
    std::fs::remove_file(&wbs_datei).unwrap();
    assert_eq!(kern(&verweis(lauf.adresse(), &ziel).await), mit_wbs, "WBS-Datei fehlt, Ordner ist da");
    l.register("kd: {name: kanbanD}");
    let ohne = verweis(lauf.adresse(), &ziel).await;
    assert_eq!(ohne["zustand"], "repository_fehlt", "{ohne}");
    assert!(!ohne["grund"].as_str().unwrap_or_default().is_empty(), "mit Grund: {ohne}");
    l.register(&format!("kd: {{name: kanbanD, repository: {}/gibt-es-nicht, wbs: {}}}", l.r_text(), l.wbs()));
    let falsch = verweis(lauf.adresse(), &ziel).await;
    assert_eq!(falsch["zustand"], "repository_fehlt", "kein Rückfall auf wbs (US-5): {falsch}");
    assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new());
}

// ---- AK 4, 5: Schreiben -----------------------------------------------------------------------------------------------

#[tokio::test]
#[ignore = "erwartet rot (ATDD) bis B1036–B1038"]
async fn ak04_put_in_neuer_form_schreibt_nur_repository() {
    let l = Lage::neu();
    l.register(&format!("kd: {{name: kanbanD, wbs: {}, requirements: {}}}", l.wbs(), l.anf()));
    l.committen();
    let lauf = l.starten();
    let vorher = kern(&verweis(lauf.adresse(), &format!("kd:{}", l.c)).await);
    let zahl: u32 = l.commits_zahl().parse().unwrap();
    let mut e = lesen(lauf.adresse(), "api/einstellungen").await;
    e["quellen"]["anwendungen"] = json!([{"kuerzel": "kd", "name": "kanbanD", "repository": l.r_text()}]);
    let (status, antwort) = einstellungen_setzen(lauf.adresse(), &e).await;
    assert_eq!(status, 200, "{antwort}");
    let datei = l.datei();
    assert_eq!(zeile_von(&datei, "kd").trim(), format!("kd: {{name: kanbanD, repository: {}}}", l.r_text()));
    assert!(!datei.contains("Dokumentation/Planung/kd.md") && !datei.contains("/Anforderungen"), "{datei}");
    assert_eq!(l.commits_zahl(), (zahl + 1).to_string(), "genau ein Commit");
    assert_eq!(kern(&verweis(lauf.adresse(), &format!("kd:{}", l.c)).await), vorher);
    let e = lesen(lauf.adresse(), "api/einstellungen").await;
    let kd = anwendung(&e, "kd");
    assert_eq!((&kd["repository"], &kd["wbs"], &kd["anforderungen"]), (&json!(l.r_text()), &json!(""), &json!("")), "Schlüssel vorhanden, nicht weggelassen: {kd}");
    let a = lesen(lauf.adresse(), "api/anwendungen").await;
    assert_eq!((&a["kd"]["repository"], &a["kd"]["wbs"], &a["kd"]["anforderungen"]), (&json!(l.r_text()), &json!(""), &json!("")), "{a}");
    assert_eq!(a["kd"]["erreichbar"]["repository"], true);
}

#[tokio::test]
#[ignore = "erwartet rot (ATDD) bis B1036–B1038"]
async fn ak05_put_wie_die_heutige_factory_reicht_wbs_durch() {
    let l = Lage::neu();
    let lauf = l.starten();
    let planung = format!("{}/Dokumentation/Planung", l.r.display());
    let pa_wbs = format!("{planung}/pa.md");
    let mut e = lesen(lauf.adresse(), "api/einstellungen").await;
    e["quellen"]["anwendungen"] = json!([{"kuerzel": "pa", "name": "Probe", "wbs": pa_wbs, "anforderungen": l.anf()}]);
    let (status, antwort) = einstellungen_setzen(lauf.adresse(), &e).await;
    assert_eq!(status, 200, "{antwort}");
    assert_eq!(zeile_von(&l.datei(), "pa").trim(), format!("pa: {{name: Probe, repository: {planung}, wbs: {pa_wbs}, requirements: {}}}", l.anf()));
    let a = lesen(lauf.adresse(), "api/anwendungen").await;
    assert_eq!((&a["pa"]["repository"], &a["pa"]["wbs"], &a["pa"]["erreichbar"]["repository"]), (&json!(planung), &json!(pa_wbs), &json!(true)), "{a}");
    assert_eq!(verweis(lauf.adresse(), &format!("pa:{}", l.c)).await["zustand"], "auf_zweig");
    let mut e = lesen(lauf.adresse(), "api/einstellungen").await;
    e["quellen"]["anwendungen"] = json!([{"kuerzel": "pa", "name": "Probe", "repository": l.r_text(), "wbs": pa_wbs, "anforderungen": l.anf()}]);
    assert_eq!(einstellungen_setzen(lauf.adresse(), &e).await.0, 200);
    assert_eq!(zeile_von(&l.datei(), "pa").trim(), format!("pa: {{name: Probe, repository: {}, wbs: {pa_wbs}, requirements: {}}}", l.r_text(), l.anf()));
}

// ---- AK 6: Rundlauf der heutigen Factory als API-Folge (board_binden.py, board.py `_einrichten`) ---------------------

/// Wie `board_binden._sorge_fuer_register`: Anwendung über den realpath von `wbs` wiedererkennen, sonst anhängen und PUT.
async fn binden_wie_die_factory(adresse: &str, eintrag: &Value) -> Result<String, String> {
    let mut e = lesen(adresse, "api/einstellungen").await;
    let wbs = |a: &Value| std::fs::canonicalize(a["wbs"].as_str().expect("wbs immer vorhanden (board_binden.py:54)")).ok();
    let anwendungen = e["quellen"]["anwendungen"].as_array().unwrap().clone();
    if let Some(gleich) = anwendungen.iter().find(|a| wbs(a).is_some() && wbs(a) == wbs(eintrag)) {
        return Ok(gleich["kuerzel"].as_str().unwrap().into());
    }
    if anwendungen.iter().any(|a| a["kuerzel"] == eintrag["kuerzel"]) {
        return Err(format!("Kürzel „{}“ ist im Register schon für eine andere WBS vergeben", eintrag["kuerzel"]));
    }
    e["quellen"]["anwendungen"].as_array_mut().unwrap().push(eintrag.clone());
    let (status, antwort) = einstellungen_setzen(adresse, &e).await;
    assert_eq!(status, 200, "{antwort}");
    Ok(eintrag["kuerzel"].as_str().unwrap().into())
}

#[tokio::test]
async fn ak06_factory_bindet_traegt_signal_ein_und_erkennt_wieder() {
    let l = Lage::neu();
    let lauf = l.starten();
    let eintrag = json!({"kuerzel": "pa", "name": "Probe", "wbs": l.wbs(), "anforderungen": l.anf()});
    assert_eq!(binden_wie_die_factory(lauf.adresse(), &eintrag).await, Ok("pa".into()));
    let mut e = lesen(lauf.adresse(), "api/einstellungen").await;
    e["signale"] = json!([{"schluessel": "wartet", "bezeichnung": "Wartet", "farbe": "amber"}]);
    assert_eq!(einstellungen_setzen(lauf.adresse(), &e).await.0, 200);
    assert_eq!(binden_wie_die_factory(lauf.adresse(), &eintrag).await, Ok("pa".into()), "zweiter Aufruf erkennt pa wieder");
    let e = lesen(lauf.adresse(), "api/einstellungen").await;
    assert_eq!(e["quellen"]["anwendungen"].as_array().unwrap().len(), 1, "{e}");
    let pa = anwendung(&e, "pa");
    assert_eq!((&pa["repository"], &pa["wbs"]), (&json!(format!("{}/Dokumentation/Planung", l.r.display())), &json!(l.wbs())));
}

// ---- AK 7: Altbestand öffnet, wie er ist ------------------------------------------------------------------------------

#[tokio::test]
async fn ak07_start_und_lesen_schreiben_nichts() {
    let l = Lage::neu();
    let alt = format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\nclasses: {{}}\nsources:\n  wbs: {}\n  requirements: {}\n  applications:\n    kd: {{name: kanbanD, wbs: {}, requirements: {}}}\n---\n", l.wbs(), l.anf(), l.wbs(), l.anf());
    std::fs::write(l.k.join("kanbanD.md"), &alt).unwrap();
    l.committen();
    let zahl = l.commits_zahl();
    let lauf = l.starten();
    let z = lesen(lauf.adresse(), "api/zustand").await;
    assert_eq!(z["defekte"], json!([]), "{z}");
    let e = lesen(lauf.adresse(), "api/einstellungen").await;
    assert_eq!(e["quellen"]["repository"], format!("{}/Dokumentation/Planung", l.r.display()), "Standardanwendung mit Startordner");
    lesen(lauf.adresse(), "api/anwendungen").await;
    lesen(lauf.adresse(), "api/aufgaben/1/commits").await;
    assert_eq!(l.commits_zahl(), zahl, "kein Commit");
    assert_eq!(l.datei(), alt, "kanbanD.md bytegleich");
    assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new());
}

// ---- AK 10 (API-Teil): Quellen mit Repository ------------------------------------------------------------------------

#[tokio::test]
#[ignore = "erwartet rot (ATDD) bis B1036–B1038"]
async fn ak10_quellen_und_neue_anwendung_nur_mit_repository() {
    let l = Lage::neu();
    let lauf = l.starten();
    let zahl: u32 = l.commits_zahl().parse().unwrap();
    let mut e = lesen(lauf.adresse(), "api/einstellungen").await;
    e["quellen"] = json!({"repository": l.r_text(), "anwendungen": [{"kuerzel": "lc", "name": "Lokal", "repository": l.r_text()}]});
    let (status, antwort) = einstellungen_setzen(lauf.adresse(), &e).await;
    assert_eq!(status, 200, "{antwort}");
    let datei = l.datei();
    assert!(datei.contains(&format!("sources:\n  repository: {}\n  applications:\n    lc: {{name: Lokal, repository: {}}}\n---", l.r_text(), l.r_text())), "{datei}");
    assert_eq!(l.commits_zahl(), (zahl + 1).to_string());
    assert_eq!(verweis(lauf.adresse(), &format!("lc:{}", l.c)).await["zustand"], "auf_zweig");
    let e = lesen(lauf.adresse(), "api/einstellungen").await;
    assert_eq!((&e["quellen"]["repository"], &e["quellen"]["wbs"], &e["quellen"]["anforderungen"]), (&json!(l.r_text()), &json!(""), &json!("")));
    assert_eq!(e["quellen"]["erreichbar"]["repository"], true, "{e}");
    let mut e2 = e.clone();
    e2["quellen"]["repository"] = json!(format!("{}/gibt-es-nicht", l.r.display()));
    assert_eq!(einstellungen_setzen(lauf.adresse(), &e2).await.0, 200, "Speichern bleibt möglich");
    assert_eq!(lesen(lauf.adresse(), "api/einstellungen").await["quellen"]["erreichbar"]["repository"], false);
    let mut e3 = e.clone();
    e3["quellen"]["anwendungen"][0]["repository"] = json!("");
    assert_eq!(einstellungen_setzen(lauf.adresse(), &e3).await.0, 200, "leeres Repository: Speichern ohne Meldung");
    assert_eq!(verweis(lauf.adresse(), &format!("lc:{}", l.c)).await["zustand"], "repository_fehlt");
    let a = lesen(lauf.adresse(), "api/anwendungen").await;
    assert_eq!((&a["lc"]["repository"], &a["lc"]["erreichbar"]["repository"]), (&json!(""), &json!(false)));
}

/// Ohne Kürzel: `<C>` gehört zur Standardanwendung, wenn sie die einzige ist (`sources.repository`, AK 10).
#[tokio::test]
#[ignore = "erwartet rot (ATDD) bis B1036–B1038"]
async fn ak10_standardanwendung_nur_mit_repository() {
    let l = Lage::neu();
    let lauf = l.starten();
    let mut e = lesen(lauf.adresse(), "api/einstellungen").await;
    e["quellen"] = json!({"repository": l.r_text(), "anwendungen": []});
    assert_eq!(einstellungen_setzen(lauf.adresse(), &e).await.0, 200);
    assert_eq!(verweis(lauf.adresse(), &l.c).await["zustand"], "auf_zweig");
}

// ---- AK 8: Legacy-Probe gegen eine Kopie des JoinPuya-Ordners (von Hand, B1040) -------------------------------------

/// `R00209_KOPIE` = Kopie des Board-Ordners (wird beschrieben), `R00209_ALT` = Programm vor der Karte,
/// `R00209_VERWEIS` = `jopu:<hash>` an Aufgabe `R00209_NR`, `R00209_REPO` = Ordner für das `PUT` in neuer Form.
#[tokio::test]
#[ignore = "Legacy-Probe von Hand: braucht eine Kopie des JoinPuya-Ordners (R00209_KOPIE …)"]
async fn ak08_legacy_probe_joinpuya_kopie() {
    let var = |n: &str| std::env::var(n).unwrap_or_else(|_| panic!("{n} fehlt"));
    let (kopie, alt, ziel, nr, repo) = (PathBuf::from(var("R00209_KOPIE")), PathBuf::from(var("R00209_ALT")), var("R00209_VERWEIS"), var("R00209_NR"), var("R00209_REPO"));
    let ablage = kopie.parent().unwrap().to_path_buf();
    let datei = std::fs::read(kopie.join("kanbanD.md")).unwrap();
    let zahl = git(&kopie, &["rev-list", "--count", "HEAD"]);
    let eintrag = |l: &Value| l["commits"].as_array().unwrap().iter().find(|e| e["verweis"] == ziel.as_str()).map(|e| json!({"zustand": e["zustand"], "hash": e["hash"], "titel": e["titel"]})).unwrap_or_else(|| panic!("{ziel} fehlt: {l}"));
    let mut ergebnisse = vec![];
    for (programm, log) in [(alt.as_path(), "log-alt.txt"), (Path::new(env!("CARGO_BIN_EXE_kanbanD")), "log-neu.txt")] {
        let lauf = Instanz::starten(programm, &kopie, ablage.join(log));
        let z = lesen(lauf.adresse(), "api/zustand").await;
        assert_eq!(z["defekte"], json!([]), "{log}: {}", z["defekte"]);
        lesen(lauf.adresse(), "api/einstellungen").await;
        lesen(lauf.adresse(), "api/anwendungen").await;
        ergebnisse.push(eintrag(&lesen(lauf.adresse(), &format!("api/aufgaben/{nr}/commits")).await));
        assert_eq!(git(&kopie, &["rev-list", "--count", "HEAD"]), zahl, "{log}: kein Commit");
        assert_eq!(std::fs::read(kopie.join("kanbanD.md")).unwrap(), datei, "{log}: bytegleich");
        assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new(), "{log}");
    }
    assert_eq!(ergebnisse[0], ergebnisse[1], "vor und nach der Karte gleich");
    let lauf = Instanz::starten(Path::new(env!("CARGO_BIN_EXE_kanbanD")), &kopie, ablage.join("log-put.txt"));
    let mut e = lesen(lauf.adresse(), "api/einstellungen").await;
    let jopu = e["quellen"]["anwendungen"].as_array_mut().unwrap().iter_mut().find(|a| a["kuerzel"] == "jopu").unwrap();
    *jopu = json!({"kuerzel": "jopu", "name": jopu["name"], "repository": repo});
    let (status, antwort) = gemeinsam::senden(reqwest::Method::PUT, lauf.adresse(), "api/einstellungen", &var("R00209_WER"), e).await;
    assert_eq!(status, 200, "{antwort}");
    let text = std::fs::read_to_string(kopie.join("kanbanD.md")).unwrap();
    assert_eq!(zeile_von(&text, "jopu").contains(&format!("repository: {repo}")), true, "{text}");
    assert!(!zeile_von(&text, "jopu").contains("wbs:"), "{text}");
    assert_eq!(eintrag(&lesen(lauf.adresse(), &format!("api/aufgaben/{nr}/commits")).await), ergebnisse[0], "nach dem PUT gleich");
}
