// R00202 Commit-Verweise an der Karte hinterlegen und entfernen (API) — Akzeptanz US-1..US-6 und AK 1–8, 10 gegen das
// gestartete Programm. Schichten: Testfall (Fachsprache, unten) → Testsprache `Fabrik` → Treiber `Api` (kennt als einziger
// URLs, Kopfzeilen und Rümpfe). AK 9 steht in tests/commits_datei.rs, die Zwischenstufen in tests/commits_dienst.rs.
mod gemeinsam;

use gemeinsam::{PRAEFIX_ZWEIER, Repo, ZWEIER, git, lies, repo};
use serde_json::{Value, json};
use std::path::PathBuf;

// ---------------------------------------------------------------- Treiber

/// Der einzige Ort mit URLs, Kopfzeile `X-KanbanD-Wer` und Rumpfform.
struct Api {
    adresse: String,
}

/// Antwort der API: Status und Rumpf.
struct Antwort {
    status: u16,
    rumpf: Value,
}

impl Api {
    async fn hinterlegen_roh(&self, wer: &str, nr: u32, rumpf: Value) -> Antwort {
        let (status, rumpf) = gemeinsam::senden(reqwest::Method::POST, &self.adresse, &format!("api/aufgaben/{nr}/commits"), wer, rumpf).await;
        Antwort { status, rumpf }
    }

    async fn entfernen(&self, wer: &str, nr: u32, verweis: &str) -> Antwort {
        let r = reqwest::Client::new().delete(format!("{}api/aufgaben/{nr}/commits/{verweis}", self.adresse)).header("X-KanbanD-Wer", wer).send().await.unwrap();
        let status = r.status().as_u16();
        Antwort { status, rumpf: r.json().await.unwrap_or(Value::Null) }
    }

    async fn aufgabe(&self, nr: u32) -> Value {
        reqwest::get(format!("{}api/aufgaben/{nr}", self.adresse)).await.unwrap().json().await.unwrap()
    }

    async fn zustand(&self) -> u16 {
        reqwest::get(format!("{}api/zustand", self.adresse)).await.unwrap().status().as_u16()
    }
}

// ---------------------------------------------------------------- Testsprache

const ENTWICKLER: &str = "entwickler";
const MENSCH: &str = "sh";

/// Ausgangslage von R00202: Arbeits-Repository R, Board „fabrik“ mit #1 in „Entwicklung“ und #2 in „Eingang“, Register
/// mit `kd` (auf R) und `xx` (Ordner fehlt), Server mit `GIT_TRACE`.
struct Fabrik {
    repo: Repo,
    _ordner: tempfile::TempDir,
    board: PathBuf,
    spur: PathBuf,
    api: Api,
    _lauf: gemeinsam::Laufendes,
}

/// Abweichungen von der Ausgangslage: Standardanwendung (sources.wbs auf R) und Verweise, die #1 schon trägt.
#[derive(Default)]
struct Wie {
    standardanwendung: bool,
    commits_an_1: Vec<String>,
}

impl Fabrik {
    async fn oeffnen() -> Fabrik {
        Fabrik::mit(Wie::default()).await
    }

    async fn mit(wie: Wie) -> Fabrik {
        let repo = repo();
        let ordner = tempfile::tempdir().unwrap();
        let board = ordner.path().canonicalize().unwrap().join("board");
        std::fs::create_dir_all(board.join("boards")).unwrap();
        std::fs::create_dir_all(board.join("aufgaben")).unwrap();
        let wbs = repo.r.join("Dokumentation/Planung/app.md");
        let standard = if wie.standardanwendung { format!("{}", wbs.display()) } else { String::new() };
        std::fs::write(
            board.join("kanbanD.md"),
            format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\n  entwickler: {{name: Entwickler, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"{standard}\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}, requirements: \"\"}}\n    xx: {{name: XX, wbs: /gibt/es/nicht/app.md, requirements: \"\"}}\n---\n", wbs.display()),
        )
        .unwrap();
        let commits = if wie.commits_an_1.is_empty() { String::new() } else { format!("commits:\n{}", wie.commits_an_1.iter().map(|c| format!("  - {c}\n")).collect::<String>()) };
        std::fs::write(board.join("aufgaben/0001-verweise-hinterlegen.md"), format!("---\nid: 1\ntitle: Verweise hinterlegen\n{commits}---\n")).unwrap();
        std::fs::write(board.join("aufgaben/0002-zweite.md"), "---\nid: 2\ntitle: zweite\n---\n").unwrap();
        std::fs::write(board.join("boards/fabrik.md"), "# Fabrik\n\n## Eingang\n\n- [#2](../aufgaben/0002-zweite.md)\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-verweise-hinterlegen.md)\n\n## Fertig\n").unwrap();
        git(&board, &["init", "-q"]);
        git(&board, &["add", "-A"]);
        git(&board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
        let spur = ordner.path().join("spur");
        let lauf = gemeinsam::starten_mit(&board, &["--port", "0"], &[("GIT_TRACE", spur.to_str().unwrap())]);
        let api = Api { adresse: lauf.adresse.clone() };
        Fabrik { repo, _ordner: ordner, board, spur, api, _lauf: lauf }
    }

    fn k1(&self) -> String {
        self.repo.k1.clone()
    }

    fn k2(&self) -> String {
        self.repo.k2.clone()
    }

    async fn hinterlegt(&self, wer: &str, verweise: &[&str]) -> Antwort {
        self.api.hinterlegen_roh(wer, 1, json!({ "commits": verweise })).await
    }

    async fn entfernt(&self, verweis: &str) -> Antwort {
        self.api.entfernen(MENSCH, 1, verweis).await
    }

    async fn commits_an(&self, nr: u32) -> Value {
        self.api.aufgabe(nr).await["commits"].clone()
    }

    fn datei(&self) -> String {
        lies(&self.board, "aufgaben/0001-verweise-hinterlegen.md")
    }

    fn commit_zahl(&self) -> u32 {
        git(&self.board, &["rev-list", "--count", "HEAD"]).parse().unwrap()
    }

    fn letzter_autor(&self) -> String {
        git(&self.board, &["log", "-1", "--format=%ae"])
    }

    /// Datei von #1, Zahl der Commits, offene Änderungen im Board-Ordner — nach einer Abweisung gleich.
    fn stand(&self) -> (String, u32, String) {
        (self.datei(), self.commit_zahl(), git(&self.board, &["status", "--porcelain"]))
    }

    fn spur(&self) -> String {
        std::fs::read_to_string(&self.spur).unwrap_or_default()
    }

    /// Git-Aufrufe im Arbeits-Repository erkennt die Spur an den Befehlen des Moduls.
    fn git_im_arbeits_repository(&self) -> usize {
        self.spur().lines().filter(|z| z.contains("rev-parse --show-toplevel") || z.contains("--end-of-options")).count()
    }

    /// `n` echte Commits in R (auf einem eigenen Zweig), neueste zuerst — gebaut mit `git fast-import`.
    fn viele_commits(&self, n: usize) -> Vec<String> {
        let mut strom = String::new();
        for i in 0..n {
            strom.push_str(&format!("commit refs/heads/viele\ncommitter A <a@a> {} +0000\ndata 1\nx\n", 1_000_000 + i));
            strom.push_str(if i == 0 { "deleteall\n\n" } else { "\n" });
        }
        let mut kind = std::process::Command::new("git").arg("-C").arg(&self.repo.r).args(["fast-import", "--quiet"]).stdin(std::process::Stdio::piped()).spawn().unwrap();
        std::io::Write::write_all(&mut kind.stdin.take().unwrap(), strom.as_bytes()).unwrap();
        assert!(kind.wait().unwrap().success());
        git(&self.repo.r, &["rev-list", "viele"]).lines().map(String::from).collect()
    }

    fn repository_umbenennen(&self) {
        std::fs::rename(&self.repo.r, self.repo.r.with_file_name("R-weg")).unwrap();
    }
}

/// Eine Abweisung prüfen: Status, `fehler` als erstes Feld, `verweis` wie in der Anfrage (falls erwartet), nichts geändert.
fn abgewiesen(fall: &str, a: &Antwort, status: u16, verweis: Option<&str>, vorher: &(String, u32, String), nachher: &(String, u32, String)) -> Vec<String> {
    let mut abweichungen = vec![];
    if a.status != status {
        abweichungen.push(format!("{fall}: Status {} statt {status}: {}", a.status, a.rumpf));
    }
    let erstes = a.rumpf.as_object().and_then(|o| o.keys().next().cloned());
    if erstes.as_deref() != Some("fehler") || a.rumpf["fehler"].as_str().is_none_or(str::is_empty) {
        abweichungen.push(format!("{fall}: fehler nicht als erstes Feld: {}", a.rumpf));
    }
    if let Some(v) = verweis
        && a.rumpf["verweis"] != json!(v)
    {
        abweichungen.push(format!("{fall}: verweis {} statt {v:?}", a.rumpf["verweis"]));
    }
    if nachher != vorher {
        abweichungen.push(format!("{fall}: etwas geändert"));
    }
    abweichungen
}

fn bestanden(abweichungen: Vec<String>) {
    assert!(abweichungen.is_empty(), "{} Abweichungen:\n{}", abweichungen.len(), abweichungen.join("\n"));
}

fn zeile(verweis: &str) -> String {
    format!("\n  - {verweis}\n")
}

// ---------------------------------------------------------------- Testfälle

// US-1 · AK 1 · Abnahme-Probe der Karte #207: Kurz-Hash hinterlegen → voller Hash in der Datei, genau ein Commit mit
// dem Agenten als Autor, GET liefert ihn; ein zweiter Aufruf hängt dahinter an
#[tokio::test]
async fn us1_commit_mit_kurz_hash_hinterlegen() {
    let f = Fabrik::oeffnen().await;
    let (k1, k2) = (f.k1(), f.k2());
    let n = f.commit_zahl();

    let a = f.hinterlegt(ENTWICKLER, &[&format!("kd:{}", &k1[..7])]).await;
    assert_eq!(a.status, 200, "{}", a.rumpf);
    assert_eq!(a.rumpf["commits"], json!([format!("kd:{k1}")]));
    assert!(f.datei().contains(&format!("\ncommits:\n  - kd:{k1}\n---\n")), "{}", f.datei());
    assert_eq!(f.commit_zahl(), n + 1);
    assert_eq!(f.letzter_autor(), "entwickler@kanbanD");
    assert_eq!(f.commits_an(1).await, json!([format!("kd:{k1}")]));

    assert_eq!(f.hinterlegt(ENTWICKLER, &[&format!("kd:{k2}")]).await.status, 200);
    assert_eq!(f.commits_an(1).await, json!([format!("kd:{k1}"), format!("kd:{k2}")]), "Reihenfolge des Hinterlegens");
    assert_eq!(f.commit_zahl(), n + 2);
}

// US-2 · AK 2: ein Commit vom Kartenzweig im Worktree und ein verwaister Commit werden angenommen
#[tokio::test]
async fn us2_commit_vom_kartenzweig_und_verwaist_hinterlegen() {
    let f = Fabrik::oeffnen().await;
    let (w1, v1) = (f.repo.w1.clone(), f.repo.v1.clone());
    assert_eq!(f.hinterlegt(ENTWICKLER, &[&format!("kd:{}", &w1[..7])]).await.status, 200);
    assert_eq!(f.hinterlegt(ENTWICKLER, &[&format!("kd:{v1}")]).await.status, 200);
    assert_eq!(f.commits_an(1).await, json!([format!("kd:{w1}"), format!("kd:{v1}")]));
}

// AK 3: ohne Kürzel nur mit Standardanwendung, dann ohne Kürzel gespeichert
#[tokio::test]
async fn ak3_standardanwendung() {
    let ohne = Fabrik::oeffnen().await;
    let k1 = ohne.k1();
    let vorher = ohne.stand();
    let a = ohne.hinterlegt(ENTWICKLER, &[&k1]).await;
    bestanden(abgewiesen("ohne Standardanwendung", &a, 400, Some(&k1), &vorher, &ohne.stand()));

    let mit = Fabrik::mit(Wie { standardanwendung: true, ..Wie::default() }).await;
    let k1 = mit.k1();
    assert_eq!(mit.hinterlegt(ENTWICKLER, &[&k1]).await.status, 200);
    assert!(mit.datei().contains(&zeile(&k1)), "{}", mit.datei());
}

// US-3 · AK 7: Wiederholung ohne Commit, nur Neues mit genau einem Commit, Doppelte im Aufruf zählen einmal
#[tokio::test]
async fn us3_wiederholung_aendert_nichts() {
    let f = Fabrik::oeffnen().await;
    let (k1, k2) = (f.k1(), f.k2());
    assert_eq!(f.hinterlegt(ENTWICKLER, &[&format!("kd:{k1}")]).await.status, 200);
    let n = f.commit_zahl();

    let a = f.hinterlegt(ENTWICKLER, &[&format!("kd:{}", &k1[..7])]).await;
    assert_eq!((a.status, f.commit_zahl()), (200, n), "{}", a.rumpf);
    let a = f.hinterlegt(ENTWICKLER, &[&format!("kd:{k1}"), &format!("kd:{}", &k1[..7]), &format!("kd:{k2}"), &format!("kd:{}", k2.to_uppercase())]).await;
    assert_eq!((a.status, f.commit_zahl()), (200, n + 1), "{}", a.rumpf);
    assert_eq!(f.commits_an(1).await, json!([format!("kd:{k1}"), format!("kd:{k2}")]));
}

// AK 7: Höchstzahl 500 — 499 + 1 angenommen, danach 409, nichts geschrieben
#[tokio::test]
async fn ak7_hoechstens_500_verweise() {
    let fremde: Vec<String> = (0..499).map(|i| format!("kd:{i:040x}")).collect();
    let f = Fabrik::mit(Wie { commits_an_1: fremde, ..Wie::default() }).await;
    let (k1, k2) = (f.k1(), f.k2());
    assert_eq!(f.hinterlegt(ENTWICKLER, &[&format!("kd:{k1}")]).await.status, 200, "499 + 1");
    assert_eq!(f.commits_an(1).await.as_array().unwrap().len(), 500);
    let vorher = f.stand();
    let a = f.hinterlegt(ENTWICKLER, &[&format!("kd:{k2}")]).await;
    bestanden(abgewiesen("501.", &a, 409, None, &vorher, &f.stand()));
    let a = f.hinterlegt(ENTWICKLER, &[&format!("kd:{k1}")]).await;
    assert_eq!(a.status, 200, "nichts Neues ist kein Verstoß: {}", a.rumpf);
}

// US-4 · AK 5: unbekanntes Kürzel, unbekannter Hash, fehlendes Repository, alles oder nichts, falscher Rumpf, unbekannte Aufgabe
#[tokio::test]
async fn us4_falscher_verweis_wird_abgewiesen() {
    let f = Fabrik::oeffnen().await;
    let (k1, k2) = (f.k1(), f.k2());
    let mut abweichungen = vec![];
    for (liste, verweis) in [(vec![format!("xy:{k1}")], format!("xy:{k1}")), (vec!["kd:0000000".into()], "kd:0000000".into()), (vec![format!("kd:{k2}"), "kd:0000000".into()], "kd:0000000".into()), (vec![format!("xx:{k1}")], format!("xx:{k1}"))] {
        let vorher = f.stand();
        let a = f.hinterlegt(ENTWICKLER, &liste.iter().map(String::as_str).collect::<Vec<_>>()).await;
        abweichungen.extend(abgewiesen(&format!("{liste:?}"), &a, 400, Some(&verweis), &vorher, &f.stand()));
        if verweis.starts_with("xx:") && !a.rumpf["fehler"].as_str().unwrap_or_default().contains("/gibt/es/nicht") {
            abweichungen.push(format!("xx: fehler nennt das fehlende Repository nicht: {}", a.rumpf));
        }
    }
    for rumpf in [json!({"commits": format!("kd:{k1}")}), json!({"commits": [format!("kd:{k1}")], "x": 1}), json!({"commits": []}), json!({}), json!([format!("kd:{k1}")]), json!({"commits": [1234567]}), json!({"commits": null})] {
        let vorher = f.stand();
        let a = f.api.hinterlegen_roh(ENTWICKLER, 1, rumpf.clone()).await;
        abweichungen.extend(abgewiesen(&rumpf.to_string(), &a, 400, None, &vorher, &f.stand()));
    }
    let vorher = f.stand();
    let a = f.api.hinterlegen_roh(ENTWICKLER, 999, json!({"commits": [format!("kd:{k1}")]})).await;
    abweichungen.extend(abgewiesen("#999", &a, 404, None, &vorher, &f.stand()));
    bestanden(abweichungen);
    assert_eq!(f.commits_an(1).await, json!([]), "auch kd:<K2> steht nicht da");
}

// AK 4: Form des Hashes, Grenzen 6/7 und 64/65, Großbuchstaben, Blob, gültige Form ohne Commit
#[tokio::test]
async fn ak4_form_des_hashes() {
    let f = Fabrik::oeffnen().await;
    let k1 = f.k1();
    let mut abweichungen = vec![];
    for verweis in [format!("kd:{}", &k1[..6]), "kd:main".into(), "kd:HEAD".into(), "kd:3f2a9cg".into(), format!("kd:{k1}0"), format!("kd:{}", "a".repeat(64)), format!("kd:{}", "a".repeat(65)), format!("kd:{}", f.repo.blob), format!("kd:{}", &f.repo.blob[..7])] {
        let vorher = f.stand();
        let a = f.hinterlegt(ENTWICKLER, &[&verweis]).await;
        abweichungen.extend(abgewiesen(&verweis, &a, 400, Some(&verweis), &vorher, &f.stand()));
    }
    bestanden(abweichungen);
    let a = f.hinterlegt(ENTWICKLER, &[&format!("kd:{}", k1[..7].to_uppercase())]).await;
    assert_eq!(a.status, 200, "{}", a.rumpf);
    assert!(f.datei().contains(&zeile(&format!("kd:{k1}"))), "klein gespeichert: {}", f.datei());
}

// US-5 · AK 6: Eingaben, die Git nie erreichen — 400, keine Datei x, R unverändert, kein Text in der Spur
#[tokio::test]
async fn us5_angriff_ueber_den_verweis_erreicht_git_nicht() {
    let f = Fabrik::oeffnen().await;
    let k1 = f.k1();
    let r_vorher = f.repo.stand();
    let boese = ["kd:--output=x", "kd:../x", "kd:3f2a9c1;rm -rf x", "kd:3f2a9c1 --all", "kd:3f2a 9c1", "kd:$(touch x)", "kd:3f2a9c1^{tree}"];
    let mut abweichungen = vec![];
    for verweis in boese {
        let vorher = f.stand();
        let a = f.hinterlegt(ENTWICKLER, &[verweis]).await;
        abweichungen.extend(abgewiesen(verweis, &a, 400, Some(verweis), &vorher, &f.stand()));
        // gemischt mit einem gültigen Verweis davor: die Form wird vor jedem Git-Aufruf geprüft
        let a = f.hinterlegt(ENTWICKLER, &[&format!("kd:{k1}"), verweis]).await;
        abweichungen.extend(abgewiesen(&format!("kd:<K1>, {verweis}"), &a, 400, Some(verweis), &vorher, &f.stand()));
    }
    bestanden(abweichungen);
    assert!(!f.repo.r.join("x").exists() && !f.board.join("x").exists(), "Datei x angelegt");
    assert_eq!(f.repo.stand(), r_vorher, "R verändert");
    assert_eq!(f.git_im_arbeits_repository(), 0, "Git im Arbeits-Repository gestartet:\n{}", f.spur());
    let spur = f.spur();
    for verweis in boese {
        let rest = verweis.trim_start_matches("kd:");
        assert!(!spur.contains(rest), "{rest:?} in der Spur:\n{spur}");
    }
}

// Sicherheits-Befund Muss 1 (Karte #207): Höchstzahl und Entdoppeln greifen vor Git — die Spur zählt die Git-Aufrufe
// im Arbeits-Repository, ein großer Rumpf darf nie viele Prozesse starten
#[tokio::test]
async fn muss1_obergrenze_und_entdoppeln_vor_git() {
    let f = Fabrik::oeffnen().await;
    let (k1, k2) = (f.k1(), f.k2());
    let verschiedene: Vec<String> = (0..501).map(|i| format!("kd:{i:040x}")).collect();
    let g = Fabrik::oeffnen().await;
    let gueltige: Vec<String> = g.viele_commits(500).iter().map(|h| format!("kd:{h}")).collect();
    let mut abweichungen = vec![];
    for (fall, rumpf, erwartet, git_hoechstens) in [
        ("501 gleiche", vec![format!("kd:{k1}"); 501], 409, 0),
        ("5000 gleiche", vec![format!("kd:{k1}"); 5000], 409, 0),
        ("501 verschiedene", verschiedene, 409, 0),
        ("500 Einträge, ein Hash (Groß und klein gemischt)", (0..500).map(|i| if i % 2 == 0 { format!("kd:{k1}") } else { format!("kd:{}", k1.to_uppercase()) }).collect(), 200, 2),
        ("1 Verweis", vec![format!("kd:{k2}")], 200, 2),
    ] {
        let rumpf: Vec<&str> = rumpf.iter().map(String::as_str).collect();
        let (vorher, aufrufe) = (f.stand(), f.git_im_arbeits_repository());
        let a = f.hinterlegt(ENTWICKLER, &rumpf).await;
        let git = f.git_im_arbeits_repository() - aufrufe;
        if a.status != erwartet {
            abweichungen.push(format!("{fall}: Status {} statt {erwartet}: {}", a.status, a.rumpf));
        }
        if git > git_hoechstens {
            abweichungen.push(format!("{fall}: {git} Git-Aufrufe, höchstens {git_hoechstens}"));
        }
        if erwartet == 409 && f.stand() != vorher {
            abweichungen.push(format!("{fall}: etwas geändert"));
        }
    }
    // Gegenprobe: 500 verschiedene, echte Verweise gehen durch — je Verweis ein Git-Aufruf, mehr nicht
    let rumpf: Vec<&str> = gueltige.iter().map(String::as_str).collect();
    let a = g.hinterlegt(ENTWICKLER, &rumpf).await;
    if a.status != 200 || g.git_im_arbeits_repository() > 501 + 1 {
        abweichungen.push(format!("500 verschiedene gültige: Status {}, {} Git-Aufrufe: {}", a.status, g.git_im_arbeits_repository(), a.rumpf));
    }
    bestanden(abweichungen);
}

// US-6 · AK 8: entfernen über Kurz- und vollen Hash, unbekannt 404, Form 400, mehrdeutig an der Karte 400, ohne Repository
#[tokio::test]
async fn us6_verweis_entfernen_auch_wenn_das_repository_fehlt() {
    let f = Fabrik::oeffnen().await;
    let (k1, k2) = (f.k1(), f.k2());
    assert_eq!(f.hinterlegt(ENTWICKLER, &[&format!("kd:{k1}"), &format!("kd:{k2}"), &format!("kd:{}", ZWEIER[0]), &format!("kd:{}", ZWEIER[1])]).await.status, 200);
    let mut abweichungen = vec![];
    for (verweis, status) in [("kd:0000000".to_string(), 404), (format!("kd:{}", &k1[..6]), 400), (format!("kd:{PRAEFIX_ZWEIER}"), 400), ("kd:--output=x".into(), 400), (k1[..7].to_string(), 404)] {
        let vorher = f.stand();
        let a = f.entfernt(&verweis).await;
        abweichungen.extend(abgewiesen(&verweis, &a, status, Some(&verweis), &vorher, &f.stand()));
    }
    bestanden(abweichungen);

    f.repository_umbenennen();
    let n = f.commit_zahl();
    let a = f.entfernt(&format!("kd:{}", &k1[..7])).await;
    assert_eq!((a.status, f.commit_zahl()), (200, n + 1), "{}", a.rumpf);
    assert_eq!(f.letzter_autor(), "sh@kanbanD");
    let a = f.entfernt(&format!("kd:{}", k2.to_uppercase())).await;
    assert_eq!((a.status, f.commit_zahl()), (200, n + 2), "{}", a.rumpf);
    assert_eq!(f.commits_an(1).await, json!([format!("kd:{}", ZWEIER[0]), format!("kd:{}", ZWEIER[1])]));
}

// AK 10: Lesen startet keinen Git-Prozess im Arbeits-Repository, auch wenn Verweise an der Karte stehen
#[tokio::test]
async fn ak10_lesen_ohne_git_im_arbeits_repository() {
    let f = Fabrik::mit(Wie { commits_an_1: vec!["kd:3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e".into()], ..Wie::default() }).await;
    assert_eq!(f.commits_an(1).await, json!(["kd:3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e"]));
    assert_eq!(f.api.zustand().await, 200);
    reqwest::get(format!("{}api/aufgaben", f.api.adresse)).await.unwrap();
    assert_eq!(f.git_im_arbeits_repository(), 0, "{}", f.spur());
    // Gegenprobe: die Spur sieht das Modul, sobald es läuft
    f.hinterlegt(ENTWICKLER, &[&format!("kd:{}", f.k1())]).await;
    assert_eq!(f.git_im_arbeits_repository(), 2, "{}", f.spur());
}


// AK 10: Endpunktliste, OpenAPI und /api nennen beide Routen mit Rumpf und Statuscodes, die Aufgabe trägt `commits`;
// README „Für Agenten“ hat den Abschnitt mit dem Beispiel-Aufruf
#[tokio::test]
async fn ak10_beschreibung_nennt_beide_routen() {
    let f = Fabrik::oeffnen().await;
    let adresse = &f.api.adresse;
    let liste: Value = reqwest::get(format!("{adresse}api/endpunkte")).await.unwrap().json().await.unwrap();
    let d: Value = reqwest::get(format!("{adresse}api/openapi.json")).await.unwrap().json().await.unwrap();
    let seite = reqwest::get(format!("{adresse}api")).await.unwrap().text().await.unwrap();
    for (methode, route, statuscodes) in [("POST", "/api/aufgaben/{nr}/commits", ["200", "400", "404", "409", "503"]), ("DELETE", "/api/aufgaben/{nr}/commits/{verweis}", ["200", "400", "404", "409", "503"])] {
        let eintrag = liste.as_array().unwrap().iter().find(|e| e["methode"] == methode && e["pfad"] == route).unwrap_or_else(|| panic!("{methode} {route} fehlt in /api/endpunkte"));
        assert_eq!((&eintrag["wer"], &eintrag["thema"]), (&json!(true), &json!("Aufgaben")));
        let op = &d["paths"][route][methode.to_lowercase()];
        assert_eq!(op["description"], eintrag["zweck"], "OpenAPI und Endpunktliste sagen dasselbe");
        for status in statuscodes {
            assert!(op["responses"][status].is_object(), "{methode} {route}: {status} fehlt");
        }
        assert!(op["responses"]["422"].is_null());
        assert_eq!(op["requestBody"].is_object(), methode == "POST", "{methode}: Rumpf");
        assert!(seite.contains(route), "/api nennt {route}");
    }
    assert!(d["components"]["schemas"]["Commitangaben"]["properties"]["commits"].is_object());
    assert!(d["components"]["schemas"]["Verweisfehler"]["properties"]["verweis"].is_object());
    assert!(d["components"]["schemas"]["Aufgabe"]["properties"]["commits"].is_object(), "Feld commits an der Aufgabe");
    let readme = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/README.md")).unwrap();
    let abschnitt = readme.split("Commits an der Karte hinterlegen").nth(1).expect("README: Abschnitt „Commits an der Karte hinterlegen“");
    assert!(abschnitt.contains("-X POST http://localhost:7420/api/aufgaben/42/commits") && abschnitt.contains("DELETE /api/aufgaben/42/commits/"), "Beispiel-Aufrufe");
}
