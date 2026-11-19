// R00203 Commit-Verweise nach einem Rebase ersetzen (API) — Akzeptanz US-1..US-6 und AK 1–4, 6–10, 12, 13 gegen das
// gestartete Programm mit echtem `git rebase`. Schichten: Testfall (Fachsprache, unten) → Testsprache `Fabrik` → Treiber
// `Api` (kennt als einziger URLs, Kopfzeilen und Rümpfe). AK 5 (500 bleiben 500), die Zahl 500/501 und der mehrdeutige
// Präfix stehen in den Tests der Module, AK 11 in tests/commits_ersetzen_dienst.rs.
mod gemeinsam;

use gemeinsam::{RepoMitRebase, git, lies, repo_mit_k3_k4};
use serde_json::{Value, json};
use std::path::PathBuf;

// ---------------------------------------------------------------- Treiber

/// Der einzige Ort mit URLs, Kopfzeile `X-KanbanD-Wer` und Rumpfform.
struct Api {
    adresse: String,
}

struct Antwort {
    status: u16,
    rumpf: Value,
}

impl Api {
    async fn senden(&self, methode: reqwest::Method, pfad: &str, wer: &str, rumpf: Value) -> Antwort {
        let (status, rumpf) = gemeinsam::senden(methode, &self.adresse, pfad, wer, rumpf).await;
        Antwort { status, rumpf }
    }

    async fn hinterlegen(&self, wer: &str, nr: u32, verweise: &[&str]) -> Antwort {
        self.senden(reqwest::Method::POST, &format!("api/aufgaben/{nr}/commits"), wer, json!({ "commits": verweise })).await
    }

    async fn ersetzen(&self, wer: &str, nr: u32, rumpf: Value) -> Antwort {
        self.senden(reqwest::Method::POST, &format!("api/aufgaben/{nr}/commits/ersetzen"), wer, rumpf).await
    }

    async fn aufgabe(&self, nr: u32) -> Value {
        reqwest::get(format!("{}api/aufgaben/{nr}", self.adresse)).await.unwrap().json().await.unwrap()
    }
}

// ---------------------------------------------------------------- Testsprache

const AGENT: &str = "entw1";
const MENSCH: &str = "sh";

/// Ausgangslage von R00203: Arbeits-Repository R mit K1..K4, Worktree mit W1, Board „fabrik“ mit #1 in „Entwicklung“ und
/// #2 in „Eingang“, Register `kd` (auf R), Server mit `GIT_TRACE`.
struct Fabrik {
    r: RepoMitRebase,
    _ordner: tempfile::TempDir,
    board: PathBuf,
    spur: PathBuf,
    api: Api,
    _lauf: gemeinsam::Laufendes,
}

#[derive(Default)]
struct Wie {
    standardanwendung: bool,
    /// Was #1 trägt, wörtlich in die Datei geschrieben (statt der drei Verweise der Ausgangslage über die API); `{K1}` und
    /// `{K3}` stehen für die Hashes von R.
    datei_commits: Option<Vec<&'static str>>,
    /// Zeilen, die zusätzlich unter `commits:` stehen sollen, ohne Liste von Texten (AK 12c).
    commits_kein_text: bool,
}

impl Fabrik {
    /// #1 trägt `kd:<K1>`, `kd:<W1>`, `kd:<K2>` (über `POST …/commits` hinterlegt).
    async fn oeffnen() -> Fabrik {
        let f = Fabrik::mit(Wie::default()).await;
        let (k1, w1, k2) = (f.k1(), f.w1(), f.k2());
        let a = f.api.hinterlegen(AGENT, 1, &[&format!("kd:{k1}"), &format!("kd:{w1}"), &format!("kd:{k2}")]).await;
        assert_eq!(a.status, 200, "{}", a.rumpf);
        f
    }

    async fn mit(wie: Wie) -> Fabrik {
        let r = repo_mit_k3_k4();
        let ordner = tempfile::tempdir().unwrap();
        let board = ordner.path().canonicalize().unwrap().join("board");
        std::fs::create_dir_all(board.join("boards")).unwrap();
        std::fs::create_dir_all(board.join("aufgaben")).unwrap();
        let wbs = r.basis.r.join("Dokumentation/Planung/app.md");
        let standard = if wie.standardanwendung { format!("{}", wbs.display()) } else { String::new() };
        std::fs::write(
            board.join("kanbanD.md"),
            format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\n  entw1: {{name: Entwickler 1, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"{standard}\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {}, requirements: \"\"}}\n---\n", wbs.display()),
        )
        .unwrap();
        let commits = match (&wie.datei_commits, wie.commits_kein_text) {
            (_, true) => "commits: von Hand\n".to_string(),
            (Some(liste), _) => format!("commits:\n{}", liste.iter().map(|c| format!("  - {}\n", c.replace("{K1}", &r.basis.k1).replace("{K3}", &r.k3))).collect::<String>()),
            _ => String::new(),
        };
        std::fs::write(board.join("aufgaben/0001-verweise-ersetzen.md"), format!("---\nid: 1\ntitle: Verweise ersetzen\n{commits}---\n")).unwrap();
        std::fs::write(board.join("aufgaben/0002-zweite.md"), "---\nid: 2\ntitle: zweite\n---\n").unwrap();
        std::fs::write(board.join("boards/fabrik.md"), "# Fabrik\n\n## Eingang\n\n- [#2](../aufgaben/0002-zweite.md)\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-verweise-ersetzen.md)\n\n## Fertig\n").unwrap();
        git(&board, &["init", "-q"]);
        git(&board, &["add", "-A"]);
        git(&board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
        let spur = ordner.path().join("spur");
        let lauf = gemeinsam::starten_mit(&board, &["--port", "0"], &[("GIT_TRACE", spur.to_str().unwrap())]);
        let api = Api { adresse: lauf.adresse.clone() };
        Fabrik { r, _ordner: ordner, board, spur, api, _lauf: lauf }
    }

    fn k1(&self) -> String {
        self.r.basis.k1.clone()
    }

    fn k2(&self) -> String {
        self.r.basis.k2.clone()
    }

    fn w1(&self) -> String {
        self.r.basis.w1.clone()
    }

    fn k3(&self) -> String {
        self.r.k3.clone()
    }

    fn k4(&self) -> String {
        self.r.k4.clone()
    }

    fn v1(&self) -> String {
        self.r.basis.v1.clone()
    }

    /// Ein Paar des Rumpfs, die Hashes auf 7 Zeichen gekürzt, wenn `kurz` gesetzt ist.
    fn paar(alt: &str, neu: &str) -> Value {
        json!({ "alt": alt, "neu": neu })
    }

    async fn ersetzt(&self, paare: Vec<Value>) -> Antwort {
        self.api.ersetzen(AGENT, 1, json!({ "ersetzungen": paare })).await
    }

    async fn commits_an(&self, nr: u32) -> Value {
        self.api.aufgabe(nr).await["commits"].clone()
    }

    fn datei(&self) -> String {
        lies(&self.board, "aufgaben/0001-verweise-ersetzen.md")
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

    fn repository_umbenennen(&self) {
        std::fs::rename(&self.r.basis.r, self.r.basis.r.with_file_name("R-weg")).unwrap();
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

fn kd(hash: &str) -> String {
    format!("kd:{hash}")
}

fn kd7(hash: &str) -> String {
    format!("kd:{}", &hash[..7])
}

// ---------------------------------------------------------------- Testfälle

// US-2 · AK 1 · Abnahme-Probe der Karte #219: zwei Paare in einem Aufruf → genau ein Commit, die neuen Hashes auf den
// Plätzen der alten (Platz 2 unberührt), volle Hashes, Autor der Agent, sonst ändert sich in der Datei nichts
#[tokio::test]
#[ignore = "erwartet rot: R00203 B0994–B0996 noch nicht gebaut"]
async fn us2_ak1_zwei_paare_ein_commit_plaetze_bleiben() {
    let f = Fabrik::oeffnen().await;
    let (k1, w1, k2, k3, k4) = (f.k1(), f.w1(), f.k2(), f.k3(), f.k4());
    let (datei_vorher, n) = (f.datei(), f.commit_zahl());

    let a = f.ersetzt(vec![Fabrik::paar(&kd7(&k1), &kd7(&k3)), Fabrik::paar(&kd7(&k2), &kd7(&k4))]).await;

    assert_eq!(a.status, 200, "{}", a.rumpf);
    assert_eq!(a.rumpf["commits"], json!([kd(&k3), kd(&w1), kd(&k4)]), "Antwort trägt die Aufgabe");
    assert_eq!(f.commits_an(1).await, json!([kd(&k3), kd(&w1), kd(&k4)]), "GET liefert dieselbe Liste");
    assert_eq!(f.commit_zahl(), n + 1, "genau ein Commit");
    assert_eq!(f.letzter_autor(), "entw1@kanbanD", "Autor ist der Agent");
    assert_eq!(f.datei(), datei_vorher.replace(&k1, &k3).replace(&k2, &k4), "sonst ändert sich nichts");
}

// US-1 · AK 2: nach einem echten `git rebase main` im Worktree ersetzt der Aufruf W1 durch W1' an Platz 2
#[tokio::test]
#[ignore = "erwartet rot: R00203 B0994–B0996 noch nicht gebaut"]
async fn us1_ak2_nach_einem_echten_rebase() {
    let f = Fabrik::oeffnen().await;
    let (k1, w1, k2) = (f.k1(), f.w1(), f.k2());
    let w1_neu = f.r.rebase();
    assert_ne!(w1_neu, w1, "der Rebase macht aus W1 einen neuen Commit");
    let n = f.commit_zahl();

    let a = f.ersetzt(vec![Fabrik::paar(&kd(&w1), &kd(&w1_neu))]).await;

    assert_eq!(a.status, 200, "{}", a.rumpf);
    assert_eq!(f.commits_an(1).await, json!([kd(&k1), kd(&w1_neu), kd(&k2)]));
    assert!(!f.datei().contains(&w1), "W1 steht nicht mehr da");
    assert_eq!(f.commit_zahl(), n + 1);
}

// AK 3: ohne Kürzel gilt die Standardanwendung — die Zeile bleibt ohne Kürzel; ein anderes Kürzel ist 400
#[tokio::test]
#[ignore = "erwartet rot: R00203 B0994–B0996 noch nicht gebaut"]
async fn ak3_standardanwendung() {
    let f = Fabrik::mit(Wie { standardanwendung: true, ..Wie::default() }).await;
    let (k1, k2, k3) = (f.k1(), f.k2(), f.k3());
    let a = f.api.hinterlegen(AGENT, 1, &[&k1, &kd(&k2)]).await;
    assert_eq!(a.status, 200, "{}", a.rumpf);

    let a = f.ersetzt(vec![Fabrik::paar(&k1[..7], &k3)]).await;
    assert_eq!(a.status, 200, "{}", a.rumpf);
    assert_eq!(f.commits_an(1).await, json!([k3, kd(&k2)]));
    assert!(f.datei().contains(&format!("\n  - {k3}\n")), "Zeile ohne Kürzel:\n{}", f.datei());

    let vorher = f.stand();
    let a = f.ersetzt(vec![Fabrik::paar(&kd7(&k2), &k3)]).await;
    bestanden(abgewiesen("kd:K2 → K3 (Kürzel verschieden)", &a, 400, None, &vorher, &f.stand()));
}

// US-3 · AK 4: Wiederholung ist 200 ohne Commit; ein erledigtes Paar neben einem neuen schreibt nur das neue; nach dem
// Umbenennen von R bleibt die Wiederholung 200, ein neues `neu` nennt das fehlende Repository
#[tokio::test]
#[ignore = "erwartet rot: R00203 B0994–B0996 noch nicht gebaut"]
async fn us3_ak4_wiederholung_aendert_nichts() {
    let f = Fabrik::oeffnen().await;
    let (k1, w1, k2, k3, k4) = (f.k1(), f.w1(), f.k2(), f.k3(), f.k4());
    let aufruf = || vec![Fabrik::paar(&kd7(&k1), &kd7(&k3)), Fabrik::paar(&kd7(&k2), &kd7(&k4))];
    assert_eq!(f.ersetzt(aufruf()).await.status, 200);
    let (datei, n) = (f.datei(), f.commit_zahl());

    let a = f.ersetzt(aufruf()).await;
    assert_eq!(a.status, 200, "{}", a.rumpf);
    assert_eq!((f.commit_zahl(), f.datei()), (n, datei), "Wiederholung ohne Commit");
    assert_eq!(a.rumpf["commits"], json!([kd(&k3), kd(&w1), kd(&k4)]));

    let w1_neu = f.r.rebase();
    let mut mit_neuem = vec![Fabrik::paar(&kd7(&k1), &kd7(&k3))];
    mit_neuem.push(Fabrik::paar(&kd(&w1), &kd(&w1_neu)));
    let a = f.ersetzt(mit_neuem).await;
    assert_eq!(a.status, 200, "{}", a.rumpf);
    assert_eq!(f.commits_an(1).await, json!([kd(&k3), kd(&w1_neu), kd(&k4)]));
    assert_eq!(f.commit_zahl(), n + 1, "nur das neue Paar, genau ein Commit");

    f.repository_umbenennen();
    let (n, vorher) = (f.commit_zahl(), f.stand());
    let a = f.ersetzt(vec![Fabrik::paar(&kd7(&k1), &kd7(&k3)), Fabrik::paar(&kd7(&k2), &kd7(&k4))]).await;
    assert_eq!((a.status, f.commit_zahl()), (200, n), "Wiederholung fragt R nicht, auch nicht nach dem Umbenennen");
    let a = f.ersetzt(vec![Fabrik::paar(&kd(&w1_neu), &kd(&f.v1()))]).await;
    bestanden(abgewiesen("neues neu ohne R", &a, 400, Some(&kd(&f.v1())), &vorher, &f.stand()));
    assert!(a.rumpf["fehler"].as_str().unwrap().contains("fehlt"), "nennt das fehlende Repository: {}", a.rumpf);
}

// AK 6: Rumpf und Form — nichts geschrieben, auch die guten Paare daneben nicht
#[tokio::test]
#[ignore = "erwartet rot: R00203 B0994–B0996 noch nicht gebaut"]
async fn ak6_rumpf_und_form() {
    let f = Fabrik::oeffnen().await;
    let (k1, k3, k4) = (f.k1(), f.k3(), f.k4());
    let gut = Fabrik::paar(&kd7(&k1), &kd7(&k3));
    let blob = f.r.basis.blob.clone();
    let rumpf = |paar: Value| json!({ "ersetzungen": [gut.clone(), paar] });
    let faelle: Vec<(String, Value, Option<String>)> = vec![
        ("leere Liste".into(), json!({"ersetzungen": []}), None),
        ("falscher Schlüssel".into(), json!({"commits": [gut.clone()]}), None),
        ("keine Liste".into(), json!({"ersetzungen": "x"}), None),
        ("unbekannter Schlüssel daneben".into(), json!({"ersetzungen": [gut.clone()], "x": 1}), None),
        ("drittes Feld im Paar".into(), rumpf(json!({"alt": kd7(&f.w1()), "neu": kd7(&k4), "x": 1})), None),
        ("Paar ohne alt".into(), rumpf(json!({"neu": kd7(&k4)})), None),
        ("neu als Zahl".into(), rumpf(json!({"alt": kd7(&f.w1()), "neu": 5})), None),
        ("neu null".into(), rumpf(json!({"alt": kd7(&f.w1()), "neu": null})), None),
        ("Eintrag ist kein Paar".into(), json!({"ersetzungen": [gut.clone(), "kd:3f2a9c1"]}), None),
        ("Rumpf ist eine Liste".into(), json!([gut.clone()]), None),
    ];
    let mut abweichungen = vec![];
    for (fall, rumpf, verweis) in faelle {
        let vorher = f.stand();
        let a = f.api.ersetzen(AGENT, 1, rumpf).await;
        abweichungen.extend(abgewiesen(&fall, &a, 400, verweis.as_deref(), &vorher, &f.stand()));
    }
    // Form und Register, je als alt und als neu
    let formfehler = [kd(&k1[..6]), "kd:main".into(), "kd:HEAD".into(), "kd:3f2a9cg".into(), format!("xy:{k1}"), kd(&"a".repeat(65)), "kd:".into(), String::new()];
    for text in formfehler {
        for (alt, neu) in [(text.clone(), kd7(&f.k4())), (kd7(&f.w1()), text.clone())] {
            let vorher = f.stand();
            let a = f.ersetzt(vec![gut.clone(), Fabrik::paar(&alt, &neu)]).await;
            abweichungen.extend(abgewiesen(&format!("{alt:?} → {neu:?}"), &a, 400, Some(&text), &vorher, &f.stand()));
        }
    }
    // neu, das es nicht gibt, ein Blob und 41 Zeichen im SHA-1-Repository: Git findet keinen Commit
    for neu in ["kd:0000000".to_string(), kd(&blob), kd(&format!("{k3}0"))] {
        let vorher = f.stand();
        let a = f.ersetzt(vec![gut.clone(), Fabrik::paar(&kd(&f.w1()), &neu)]).await;
        abweichungen.extend(abgewiesen(&neu, &a, 400, Some(&neu), &vorher, &f.stand()));
    }
    bestanden(abweichungen);

    let a = f.api.ersetzen(AGENT, 999, json!({"ersetzungen": [gut]})).await;
    assert_eq!(a.status, 404, "{}", a.rumpf);
    assert_eq!(a.rumpf.as_object().unwrap().keys().next().unwrap(), "fehler");
    assert!(a.rumpf.get("fehler").is_some());
}

// AK 7: doppelt, Kette, Zahl — 400, `verweis` ist der zweite Auftritt; 501 Paare erreichen Git nie
#[tokio::test]
#[ignore = "erwartet rot: R00203 B0994–B0996 noch nicht gebaut"]
async fn ak7_doppelt_kette_zahl() {
    let f = Fabrik::oeffnen().await;
    let (k1, k2, k3, k4) = (f.k1(), f.k2(), f.k3(), f.k4());
    let p = Fabrik::paar;
    let faelle: Vec<(&str, Vec<Value>, String)> = vec![
        ("alt doppelt", vec![p(&kd(&k1), &kd(&k3)), p(&kd(&k1), &kd(&k4))], kd(&k1)),
        ("alt doppelt, Kurz gegen Voll", vec![p(&kd(&k1), &kd(&k3)), p(&kd7(&k1), &kd(&k4))], kd7(&k1)),
        ("neu doppelt", vec![p(&kd(&k1), &kd(&k3)), p(&kd(&k2), &kd(&k3))], kd(&k3)),
        ("neu doppelt, Kurz gegen Voll", vec![p(&kd(&k1), &kd7(&k3)), p(&kd(&k2), &kd(&k3))], kd(&k3)),
        ("alt gleich neu", vec![p(&kd(&k1), &kd(&k1))], kd(&k1)),
        ("Kette", vec![p(&kd(&k1), &kd(&k3)), p(&kd(&k3), &kd(&k4))], kd(&k3)),
        ("Kette, Kurz gegen Voll", vec![p(&kd(&k1), &kd7(&k3)), p(&kd(&k3), &kd(&k4))], kd(&k3)),
        ("Tausch ist eine Kette", vec![p(&kd(&k1), &kd(&k2)), p(&kd(&k2), &kd(&k1))], kd(&k2)),
    ];
    let mut abweichungen = vec![];
    for (fall, paare, verweis) in faelle {
        let vorher = f.stand();
        let a = f.ersetzt(paare).await;
        abweichungen.extend(abgewiesen(fall, &a, 400, Some(&verweis), &vorher, &f.stand()));
    }
    bestanden(abweichungen);

    let vorher = (f.stand(), f.git_im_arbeits_repository());
    let viele: Vec<Value> = (0..501).map(|i| p(&format!("kd:{i:040x}"), &format!("kd:{:040x}", i + 1000))).collect();
    let a = f.ersetzt(viele).await;
    bestanden(abgewiesen("501 Paare", &a, 400, None, &vorher.0, &f.stand()));
    assert_eq!(f.git_im_arbeits_repository(), vorher.1, "501 Paare: kein Git-Aufruf\n{}", f.spur());
}

// AK 8: 404 (weder alt noch neu an der Karte), 409 (beide da, `verweis` ist das alt), ein 404-Paar verhindert auch das
// gute; ein Formfehler neben einem 404-Paar ist 400; Git läuft nicht, wenn die Karte schon abweist
#[tokio::test]
#[ignore = "erwartet rot: R00203 B0994–B0996 noch nicht gebaut"]
async fn ak8_karte_404_und_409() {
    let f = Fabrik::oeffnen().await;
    let (k1, k2, k3, k4) = (f.k1(), f.k2(), f.k3(), f.k4());
    let p = Fabrik::paar;
    let faelle: Vec<(&str, Vec<Value>, u16, String)> = vec![
        ("alt und neu fehlen", vec![p(&kd(&k4), &kd(&k3))], 404, kd(&k4)),
        ("beide an der Karte", vec![p(&kd(&k1), &kd(&k2))], 409, kd(&k1)),
        ("beide an der Karte, Kurz-Hash", vec![p(&kd7(&k1), &kd7(&k2))], 409, kd7(&k1)),
        ("gutes Paar und V1 → K4", vec![p(&kd(&k1), &kd(&k3)), p(&kd(&f.v1()), &kd(&k4))], 404, kd(&f.v1())),
        ("Formfehler und 404-Paar", vec![p(&kd(&k4), &kd(&k3)), p(&kd(&k1), "kd:main")], 400, "kd:main".into()),
    ];
    let mut abweichungen = vec![];
    for (fall, paare, status, verweis) in faelle {
        let (vorher, git_vorher) = (f.stand(), f.git_im_arbeits_repository());
        let a = f.ersetzt(paare).await;
        abweichungen.extend(abgewiesen(fall, &a, status, Some(&verweis), &vorher, &f.stand()));
        if status != 400 && f.git_im_arbeits_repository() != git_vorher {
            abweichungen.push(format!("{fall}: Git gestartet, obwohl die Karte abweist"));
        }
    }
    bestanden(abweichungen);
}

// US-5 · AK 9: Eingaben, die Git nie erreichen — als alt und als neu, die Spur enthält keinen der Texte
#[tokio::test]
#[ignore = "erwartet rot: R00203 B0994–B0996 noch nicht gebaut"]
async fn us5_ak9_angriff_ueber_den_verweis_erreicht_git_nicht() {
    let f = Fabrik::oeffnen().await;
    let (k1, k3, k4, w1) = (f.k1(), f.k3(), f.k4(), f.w1());
    let boese = ["kd:--output=x", "kd:../x", "kd:3f2a9c1;rm -rf x", "kd:3f2a9c1 --all", "kd:3f2a 9c1", "kd:$(touch x)", "kd:3f2a9c1^{tree}"];
    let r_vorher = f.r.basis.stand();
    let mut abweichungen = vec![];
    for text in boese {
        for (alt, neu) in [(text.to_string(), kd(&k3)), (kd(&k1), text.to_string())] {
            let vorher = f.stand();
            // ein gültiges Paar daneben: die Form wird vor jedem Git-Aufruf geprüft
            let a = f.ersetzt(vec![Fabrik::paar(&alt, &neu), Fabrik::paar(&kd(&w1), &kd(&k4))]).await;
            abweichungen.extend(abgewiesen(&format!("{alt:?} → {neu:?}"), &a, 400, Some(text), &vorher, &f.stand()));
        }
    }
    bestanden(abweichungen);
    assert!(!f.r.basis.r.join("x").exists() && !f.board.join("x").exists(), "Datei x angelegt");
    assert_eq!(f.r.basis.stand(), r_vorher, "R verändert");
    assert_eq!(f.git_im_arbeits_repository(), 0, "Git im Arbeits-Repository gestartet:\n{}", f.spur());
    let spur = f.spur();
    for text in boese {
        let rest = text.trim_start_matches("kd:");
        assert!(!spur.contains(rest), "{rest:?} in der Spur:\n{spur}");
    }
}

// US-6 · AK 10: verwaiste und aus R gelöschte Verweise lassen sich ersetzen, `alt` erreicht Git nie; unlesbare und
// Ziffern-Einträge bleiben wörtlich stehen
#[tokio::test]
#[ignore = "erwartet rot: R00203 B0994–B0996 noch nicht gebaut"]
async fn us6_ak10_verwaiste_und_geloeschte_verweise_nachziehen() {
    let f = Fabrik::mit(Wie::default()).await;
    let (v1, k3, k4) = (f.v1(), f.k3(), f.k4());
    let v2 = f.r.zweiter_verwaister();
    assert_eq!(f.api.hinterlegen(AGENT, 1, &[&kd(&v1), &kd(&v2)]).await.status, 200);
    f.r.aufraeumen();
    assert!(!git(&f.r.basis.r, &["cat-file", "-t", &v2]).contains("commit"), "V2 ist aus R entfernt");
    let (n, gezaehlt) = (f.commit_zahl(), f.git_im_arbeits_repository());

    let a = f.ersetzt(vec![Fabrik::paar(&kd(&v1), &kd7(&k3)), Fabrik::paar(&kd(&v2), &kd7(&k4))]).await;

    assert_eq!(a.status, 200, "{}", a.rumpf);
    assert_eq!(f.commits_an(1).await, json!([kd(&k3), kd(&k4)]), "neue Hashes auf den Plätzen der alten");
    assert_eq!(f.commit_zahl(), n + 1);
    let spur = f.spur();
    assert!(!spur.contains(&v1) && !spur.contains(&v2), "alt erreichte Git:\n{spur}");
    assert_eq!(f.git_im_arbeits_repository(), gezaehlt + 3, "Wurzel einmal, je neu ein rev-parse:\n{spur}");
}

// US-6 · AK 12 a, c, d: Bestand bleibt verlustfrei, ein unlesbarer Eintrag lässt sich nicht ersetzen, eine Datei mit
// `commits` ohne Liste von Texten wird nicht angefasst, Duplizieren trägt keine Verweise
#[tokio::test]
#[ignore = "erwartet rot: R00203 B0994–B0996 noch nicht gebaut"]
async fn us6_ak12_datei_legacy_und_duplizieren() {
    let ziffern = "1234567890123456789012345678901234567890";
    let f = Fabrik::mit(Wie { datei_commits: Some(vec!["kd:{K1}", "kd:zz", ziffern]), ..Wie::default() }).await;
    let (k1, k3) = (f.k1(), f.k3());
    let vorher = f.stand();
    let a = f.ersetzt(vec![Fabrik::paar("kd:zz", &kd(&k3))]).await;
    bestanden(abgewiesen("kd:zz ersetzen", &a, 400, Some("kd:zz"), &vorher, &f.stand()));

    let a = f.ersetzt(vec![Fabrik::paar(&kd7(&k1), &kd(&k3))]).await;
    assert_eq!(a.status, 200, "{}", a.rumpf);
    assert_eq!(f.datei(), vorher.0.replace(&kd(&k1), &kd(&k3)), "bis auf die eine Zeile zeichengleich");
    assert_eq!(f.commits_an(1).await, json!([kd(&k3), "kd:zz", ziffern]), "Ziffern-Hash als Text");

    let d = f.api.senden(reqwest::Method::POST, "api/aufgaben/1/duplizieren", MENSCH, json!({})).await;
    assert_eq!(d.status, 201, "{}", d.rumpf);
    let kopie = d.rumpf["nummer"].as_u64().unwrap() as u32;
    assert!(f.commits_an(kopie).await.as_array().unwrap().is_empty(), "Kopie ohne commits");

    let g = Fabrik::mit(Wie { commits_kein_text: true, ..Wie::default() }).await;
    let vorher = g.stand();
    let a = g.ersetzt(vec![Fabrik::paar(&kd7(&g.k1()), &kd7(&g.k3()))]).await;
    bestanden(abgewiesen("commits ohne Liste", &a, 409, None, &vorher, &g.stand()));
}

// AK 12 b: der Stand vor dieser Karte (main, gebaut; Pfad in KANBAND_VORVERSION) behält eine nach AK 1 geschriebene Datei
// bei einer Titeländerung zeichengleich. Nur mit der Variablen — sonst gäbe es nichts zu prüfen.
#[tokio::test]
#[ignore = "braucht KANBAND_VORVERSION=<gebautes kanbanD vor dieser Karte>"]
async fn ak12b_vorversion_behaelt_die_datei() {
    let vorversion = std::env::var("KANBAND_VORVERSION").expect("KANBAND_VORVERSION");
    let f = Fabrik::oeffnen().await;
    let (k1, k2, k3, k4) = (f.k1(), f.k2(), f.k3(), f.k4());
    assert_eq!(f.ersetzt(vec![Fabrik::paar(&kd7(&k1), &kd7(&k3)), Fabrik::paar(&kd7(&k2), &kd7(&k4))]).await.status, 200);
    let datei = f.datei();
    let nr0 = f._ordner.path().join("alt");
    std::fs::create_dir_all(&nr0).unwrap();
    let kopie = nr0.join("board");
    git(f._ordner.path(), &["clone", "-q", f.board.to_str().unwrap(), kopie.to_str().unwrap()]);
    let mut kind = std::process::Command::new(&vorversion).arg(&kopie).args(["--kein-browser", "--host", "127.0.0.1", "--port", "0"]).stdout(std::process::Stdio::piped()).spawn().unwrap();
    let mut zeile = String::new();
    std::io::BufRead::read_line(&mut std::io::BufReader::new(kind.stdout.take().unwrap()), &mut zeile).unwrap();
    let adresse = zeile.split_whitespace().last().unwrap().to_string();
    let a = gemeinsam::senden(reqwest::Method::PATCH, &adresse, "api/aufgaben/1", MENSCH, json!({"title": "Neuer Titel"})).await;
    gemeinsam::geordnet_beenden(&mut kind);
    assert_eq!(a.0, 200, "{}", a.1);
    let nachher = lies(&kopie, "aufgaben/0001-verweise-ersetzen.md");
    assert_eq!(nachher, datei.replace("title: Verweise ersetzen", "title: Neuer Titel"), "nur der Titel ändert sich");
}

// AK 13: Endpunktliste, OpenAPI und /api nennen die Route mit Rumpf, Statuscodes und dem Satz zur Wiederholung; die README
// hat das Beispiel „nach einem Rebase nachziehen“ mit einem Agenten-Kürzel von höchstens 8 Zeichen
#[tokio::test]
#[ignore = "erwartet rot: R00203 B0994–B0996 noch nicht gebaut"]
async fn ak13_beschreibung_nennt_die_route() {
    let f = Fabrik::oeffnen().await;
    let adresse = &f.api.adresse;
    let liste: Value = reqwest::get(format!("{adresse}api/endpunkte")).await.unwrap().json().await.unwrap();
    let d: Value = reqwest::get(format!("{adresse}api/openapi.json")).await.unwrap().json().await.unwrap();
    let seite = reqwest::get(format!("{adresse}api")).await.unwrap().text().await.unwrap();
    let route = "/api/aufgaben/{nr}/commits/ersetzen";
    let eintrag = liste.as_array().unwrap().iter().find(|e| e["methode"] == "POST" && e["pfad"] == route).expect("POST ersetzen fehlt in /api/endpunkte");
    assert_eq!((&eintrag["wer"], &eintrag["thema"]), (&json!(true), &json!("Aufgaben")));
    let op = &d["paths"][route]["post"];
    assert_eq!(op["description"], eintrag["zweck"], "OpenAPI und Endpunktliste sagen dasselbe");
    for status in ["200", "400", "404", "409", "503"] {
        assert!(op["responses"][status].is_object(), "{status} fehlt");
    }
    assert!(op["responses"]["422"].is_null());
    assert!(op["requestBody"].is_object());
    assert!(seite.contains(route), "/api nennt die Route");
    let zweck = eintrag["zweck"].as_str().unwrap();
    for stichwort in ["{ersetzungen: [{alt, neu}", "200 ohne Commit", "409", "503"] {
        assert!(zweck.contains(stichwort), "{stichwort:?} fehlt im Zweck: {zweck}");
    }
    assert!(d["components"]["schemas"]["Ersetzungsangaben"]["properties"]["ersetzungen"].is_object(), "Rumpf im Schema");
    let readme = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/README.md")).unwrap();
    let abschnitt = readme.split("Commits an der Karte hinterlegen").nth(1).expect("README: Abschnitt");
    assert!(abschnitt.contains("nach einem Rebase nachziehen") && abschnitt.contains("/api/aufgaben/42/commits/ersetzen"), "Beispiel fehlt");
    let wer = abschnitt.split("commits/ersetzen").nth(1).and_then(|s| s.split("X-KanbanD-Wer: ").nth(1)).and_then(|s| s.split('\'').next()).unwrap();
    assert!((1..=8).contains(&wer.len()), "Agenten-Kürzel {wer:?} hat mehr als 8 Zeichen");
}
