// R00204 (I0194, Karte #211): Commit-Liste einer Karte per API lesen — Akzeptanztests gegen das echte Programm, ein
// echtes Arbeits-Repository mit Worktree, entfernten Zweigen und Rebase (Ausgangslage siehe `gemeinsam::R204`).
mod gemeinsam;

use gemeinsam::{Laufendes, R204, ausgangslage_r00204, git, git_am, lies, senden, starten_mit};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

// ---- Treiber: Server und Aufrufe -------------------------------------------------------------------------------------

fn starten(a: &R204, umgebung: &[(&str, &str)]) -> Laufendes {
    starten_mit(&a.board, &["--port", "0"], umgebung)
}

/// `GET /api/aufgaben/{nr}/commits` → Status, Content-Type, Rumpf.
async fn liste_holen(adresse: &str, nr: u32) -> (u16, String, Value) {
    let r = reqwest::get(format!("{adresse}api/aufgaben/{nr}/commits")).await.unwrap();
    let status = r.status().as_u16();
    let art = r.headers().get("content-type").and_then(|w| w.to_str().ok()).unwrap_or_default().to_string();
    (status, art, r.json().await.unwrap_or(Value::Null))
}

async fn liste(adresse: &str) -> Vec<Value> {
    let (status, _, rumpf) = liste_holen(adresse, 1).await;
    assert_eq!(status, 200, "{rumpf}");
    rumpf["commits"].as_array().unwrap().clone()
}

async fn hinterlegen(adresse: &str, verweise: &[String]) {
    let (status, rumpf) = senden(reqwest::Method::POST, adresse, "api/aufgaben/1/commits", "entw1", json!({ "commits": verweise })).await;
    assert_eq!(status, 200, "{rumpf}");
}

/// Ausgangslage mit gestartetem Server: die fünf Verweise über die API hinterlegt, danach V2 aus R entfernt.
async fn hinterlegt(umgebung: &[(&str, &str)]) -> (R204, Laufendes) {
    let a = ausgangslage_r00204();
    let lauf = starten(&a, umgebung);
    hinterlegen(&lauf.adresse, &a.verweise()).await;
    a.v2_entfernen();
    (a, lauf)
}

fn eintrag<'a>(liste: &'a [Value], verweis: &str) -> &'a Value {
    liste.iter().find(|e| e["verweis"] == verweis).unwrap_or_else(|| panic!("kein Eintrag {verweis}: {liste:?}"))
}

fn schluessel(e: &Value) -> Vec<String> {
    let mut k: Vec<String> = e.as_object().unwrap().keys().cloned().collect();
    k.sort();
    k
}

/// Die Git-Spur eines Servers: Zeilen der Befehle im Arbeits-Repository (Board-Befehle wie `commit` zählen nicht).
fn spur(datei: &Path) -> Vec<String> {
    let text = std::fs::read_to_string(datei).unwrap_or_default();
    let befehle = ["git rev-parse --show-toplevel", "git cat-file --batch-check", "git log --no-ext-diff", "git for-each-ref '--format=%(objectname) %(refname)'", "git rev-list --parents", "--contains"];
    text.lines().filter(|z| z.contains("trace: built-in:") && befehle.iter().any(|b| z.contains(b))).map(String::from).collect()
}

/// Arbeitsbaum, Objekte und Zeitstempel unter `.git` — „nur lesend“ heißt: alles gleich, keine `index.lock`.
fn r_stand(r: &Path) -> (String, String, Vec<(PathBuf, std::time::SystemTime)>) {
    let mut zeiten = vec![];
    let mut offen = vec![r.join(".git")];
    while let Some(d) = offen.pop() {
        for e in std::fs::read_dir(&d).unwrap().flatten() {
            let p = e.path();
            if p.is_dir() {
                offen.push(p);
            } else {
                zeiten.push((p.clone(), e.metadata().unwrap().modified().unwrap()));
            }
        }
    }
    zeiten.sort();
    let status = std::process::Command::new("git").arg("-C").arg(r).args(["status", "--porcelain"]).env("GIT_OPTIONAL_LOCKS", "0").output().unwrap();
    (String::from_utf8_lossy(&status.stdout).into_owned(), git(r, &["count-objects", "-v"]), zeiten)
}

// ---- AK 1: fünf Zustände (Abnahme-Probe der Karte) -------------------------------------------------------------------

#[tokio::test]
async fn ak01_fuenf_zustaende() {
    let (a, lauf) = hinterlegt(&[]).await;
    let datei = lies(&a.board, "aufgaben/0001-commit-liste.md");
    let zahl = a.commit_zahl();
    let r_vorher = r_stand(&a.r);
    let l = liste(&lauf.adresse).await;
    let reihenfolge: Vec<&str> = l.iter().map(|e| e["verweis"].as_str().unwrap()).collect();
    let v = |h: &str| format!("kd:{h}");
    assert_eq!(reihenfolge, [v(&a.k3), v(&a.w1), v(&a.v1), v(&a.r1), v(&a.v2)], "Datum aufsteigend, V2 ohne Metadaten zuletzt");
    assert_eq!(l[0], json!({"verweis": v(&a.k3), "anwendung": "kd", "hash": a.k3, "zustand": "auf_zweig", "zweige": ["main"], "entfernte_zweige": ["o/main"], "titel": "c.txt anlegen", "autor": "Ada Autorin", "datum": "2026-03-01T10:00:00+01:00", "autordatum": 1772355600, "plus": 3, "minus": 0, "dateien": 1}));
    let w1 = eintrag(&l, &v(&a.w1));
    assert_eq!((&w1["zustand"], &w1["zweige"], &w1["entfernte_zweige"], &w1["autor"]), (&json!("auf_zweig"), &json!(["karte/1"]), &json!([]), &json!("Bernd Beispiel")));
    let v1 = eintrag(&l, &v(&a.v1));
    assert_eq!(v1["zustand"], "verwaist", "der Tag v1 zählt nicht");
    assert_eq!(schluessel(v1), ["anwendung", "autor", "autordatum", "dateien", "datum", "hash", "minus", "plus", "titel", "verweis", "zustand"]);
    let r1 = eintrag(&l, &v(&a.r1));
    assert_eq!((&r1["zustand"], &r1["zweige"], &r1["entfernte_zweige"]), (&json!("auf_zweig"), &json!([]), &json!(["o/x"])));
    assert_eq!(eintrag(&l, &v(&a.v2)), &json!({"verweis": v(&a.v2), "anwendung": "kd", "hash": a.v2, "zustand": "fehlt"}));
    assert!(l.iter().all(|e| e["anwendung"] == "kd" && e["hash"].as_str().is_some_and(|h| h.len() == 40)));
    assert_eq!((lies(&a.board, "aufgaben/0001-commit-liste.md"), a.commit_zahl()), (datei, zahl), "GET schreibt nie");
    assert_eq!(r_stand(&a.r), r_vorher, "in R nichts geändert");
    assert!(!a.r.join(".git/index.lock").exists());
}

// ---- AK 2: nach Rebase und Merge ------------------------------------------------------------------------------------

#[tokio::test]
async fn ak02_nach_rebase_und_merge() {
    let (a, lauf) = hinterlegt(&[]).await;
    git_am(&a.wt, "Bernd Beispiel", "2026-03-07T09:00:00+00:00", &["rebase", "-q", "main"]);
    let w1_neu = git(&a.wt, &["rev-parse", "HEAD"]);
    assert_ne!(w1_neu, a.w1);
    hinterlegen(&lauf.adresse, &[format!("kd:{w1_neu}")]).await;
    let l = liste(&lauf.adresse).await;
    assert_eq!(eintrag(&l, &format!("kd:{}", a.w1))["zustand"], "verwaist");
    let neu = eintrag(&l, &format!("kd:{w1_neu}"));
    assert_eq!((&neu["zustand"], &neu["zweige"]), (&json!("auf_zweig"), &json!(["karte/1"])));
    git_am(&a.r, "Ada Autorin", "2026-03-08T09:00:00+00:00", &["merge", "-q", "--ff-only", "karte/1"]);
    git_am(&a.r, "Ada Autorin", "2026-03-08T09:00:00+00:00", &["worktree", "remove", a.wt.to_str().unwrap()]);
    git_am(&a.r, "Ada Autorin", "2026-03-08T09:00:00+00:00", &["branch", "-d", "karte/1"]);
    let l = liste(&lauf.adresse).await;
    let neu = eintrag(&l, &format!("kd:{w1_neu}"));
    assert_eq!((&neu["zustand"], &neu["zweige"], &neu["entfernte_zweige"]), (&json!("auf_zweig"), &json!(["main"]), &json!([])));
    assert_eq!(eintrag(&l, &format!("kd:{}", a.w1))["zustand"], "verwaist");
}

// ---- AK 3: Zweiglisten und ihre Grenze ------------------------------------------------------------------------------

#[tokio::test]
async fn ak03_zweiglisten_und_grenze() {
    let a = ausgangslage_r00204();
    let z = gemeinsam::datei_commit(&a.r, "Ada Autorin", "2026-03-09T09:00:00+00:00", "z.txt", 1, "z");
    git_am(&a.r, "Ada Autorin", "2026-03-09T09:00:00+00:00", &["reset", "-q", "--hard", &a.k4]);
    for i in 1..=10 {
        git(&a.r, &["branch", &format!("z{i:02}"), &z]);
        git(&a.r, &["update-ref", &format!("refs/remotes/o/e{i:02}"), &z]);
    }
    git(&a.r, &["tag", "tz", &z]);
    git(&a.r, &["branch", "abcdef0", &a.k3]);
    a.von_hand(&[format!("kd:{z}"), format!("kd:{}", &a.k3[..7])]);
    let lauf = starten(&a, &[]);
    let l = liste(&lauf.adresse).await;
    let e = eintrag(&l, &format!("kd:{z}"));
    assert_eq!(e["zweige"], json!((1..=10).map(|i| format!("z{i:02}")).collect::<Vec<_>>()));
    assert_eq!(e["entfernte_zweige"], json!((1..=10).map(|i| format!("o/e{i:02}")).collect::<Vec<_>>()));
    assert!(e.get("zweige_weitere").is_none());
    let k3 = eintrag(&l, &format!("kd:{}", &a.k3[..7]));
    assert_eq!((&k3["zustand"], &k3["hash"]), (&json!("auf_zweig"), &json!(a.k3)));
    git(&a.r, &["branch", "z11", &z]);
    git(&a.r, &["update-ref", "refs/remotes/o/e11", &z]);
    git(&a.r, &["update-ref", "refs/remotes/o/e12", &z]);
    let l = liste(&lauf.adresse).await;
    let e = eintrag(&l, &format!("kd:{z}"));
    assert_eq!((e["zweige"].as_array().unwrap().len(), e["entfernte_zweige"].as_array().unwrap().len(), &e["zweige_weitere"]), (10, 10, &json!(3)));
}

// ---- AK 4: Anwendung und Repository ---------------------------------------------------------------------------------

#[tokio::test]
async fn ak04_anwendung_und_repository() {
    let a = ausgangslage_r00204();
    let kein_repo = a.basis.join("kein-repo/Planung");
    std::fs::create_dir_all(&kein_repo).unwrap();
    let register = |standard: &str| {
        format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\n  entw1: {{name: Entwickler, kind: agent}}\nclasses: {{}}\nsources:\n  wbs: \"{standard}\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, wbs: {r}/Dokumentation/Planung/app.md, requirements: \"\"}}\n    xx: {{name: XX, wbs: {fehlt}/app.md, requirements: \"\"}}\n    zz: {{name: ZZ, wbs: {kein}/app.md, requirements: \"\"}}\n---\n", r = a.r.display(), fehlt = a.basis.join("gibt-es-nicht").display(), kein = kein_repo.display())
    };
    std::fs::write(a.board.join("kanbanD.md"), register("")).unwrap();
    git(&a.board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-am", "Register"]);
    let mut verweise = a.verweise();
    verweise.retain(|v| !v.contains(&a.v2));
    let fremde = [format!("xx:{}", a.k1), format!("xy:{}", a.k1), a.k1.clone(), format!("zz:{}", a.k1)];
    verweise.extend(fremde.iter().cloned());
    a.von_hand(&verweise);
    let lauf = starten(&a, &[]);
    let l = liste(&lauf.adresse).await;
    assert_eq!(l.len(), 8);
    let xx = eintrag(&l, &fremde[0]);
    assert_eq!(xx["zustand"], "repository_fehlt");
    assert!(xx["grund"].as_str().unwrap().contains("gibt-es-nicht"), "{xx}");
    assert_eq!(eintrag(&l, &fremde[1])["zustand"], "anwendung_unbekannt");
    assert_eq!(eintrag(&l, &fremde[2])["zustand"], "anwendung_unbekannt");
    let zz = eintrag(&l, &fremde[3]);
    assert_eq!(zz["zustand"], "repository_fehlt");
    assert!(zz["grund"].as_str().unwrap().contains("kein Git-Repository"), "{zz}");
    assert_eq!(eintrag(&l, &format!("kd:{}", a.k3))["zweige"], json!(["main"]), "kd bleibt unverändert");
    assert_eq!(l[4..].iter().map(|e| e["verweis"].as_str().unwrap()).collect::<Vec<_>>(), fremde.iter().map(String::as_str).collect::<Vec<_>>(), "ohne Metadaten hinten, in der Reihenfolge der Datei");
    std::fs::write(a.board.join("kanbanD.md"), register(&format!("{}/Dokumentation/Planung/app.md", a.r.display()))).unwrap();
    let l = liste(&lauf.adresse).await;
    let ohne = eintrag(&l, &a.k1);
    assert_eq!((&ohne["zustand"], &ohne["anwendung"]), (&json!("auf_zweig"), &json!("")));
}

// ---- AK 5: handgeschriebene Einträge gültiger Form ------------------------------------------------------------------

#[tokio::test]
async fn ak05_handgeschriebene_eintraege() {
    let a = ausgangslage_r00204();
    let blob = git(&a.r, &["rev-parse", &format!("{}:a.txt", a.k1)]);
    let baum = git(&a.r, &["rev-parse", &format!("{}^{{tree}}", a.k1)]);
    git(&a.r, &["-c", "user.name=A", "-c", "user.email=a@a", "tag", "-a", "-m", "t1", "t1", &a.k3]);
    let tag = git(&a.r, &["rev-parse", "t1"]);
    let gross = format!("kd:{}", a.k3.to_uppercase());
    let verweise = [format!("kd:{blob}"), format!("kd:{baum}"), format!("kd:{}", &a.k3[..7]), gross.clone(), format!("kd:{}0", a.k1), format!("kd:{tag}"), format!("kd:{}", a.k3), format!("kd:{}", a.k3)];
    a.von_hand(&verweise);
    let spurdatei = a.basis.join("spur");
    let lauf = starten(&a, &[("GIT_TRACE", spurdatei.to_str().unwrap())]);
    let l = liste(&lauf.adresse).await;
    assert_eq!(l.len(), 8, "je Verweis ein Eintrag, auch doppelt");
    for v in [&verweise[0], &verweise[1], &verweise[4], &verweise[5]] {
        assert_eq!(eintrag(&l, v)["zustand"], "fehlt", "{v}");
    }
    let kurz = eintrag(&l, &verweise[2]);
    assert_eq!((&kurz["zustand"], &kurz["hash"]), (&json!("auf_zweig"), &json!(a.k3)), "voller Hash, Verweis wörtlich");
    assert_eq!(eintrag(&l, &gross)["hash"], json!(a.k3), "kleingeschrieben");
    let doppelt: Vec<&Value> = l.iter().filter(|e| e["verweis"] == verweise[6]).collect();
    assert_eq!((doppelt.len(), doppelt[0], doppelt[1]), (2, doppelt[1], doppelt[0]));
    let mit_doppel = spur(&spurdatei).len();
    std::fs::write(&spurdatei, "").unwrap();
    let einmal = a.basis.join("einmal");
    a.von_hand(&verweise[..7]);
    drop(lauf);
    let lauf = starten(&a, &[("GIT_TRACE", einmal.to_str().unwrap())]);
    liste(&lauf.adresse).await;
    assert_eq!(mit_doppel, spur(&einmal).len(), "ein doppelter Eintrag startet nicht mehr Git");
}

// ---- AK 7: Reihenfolge und Grenzen des Aufrufs ----------------------------------------------------------------------

#[tokio::test]
async fn ak07_reihenfolge_und_grenzen() {
    let a = ausgangslage_r00204();
    let spaet = gemeinsam::datei_commit(&a.r, "Ada Autorin", "2026-03-01T23:30:00-05:00", "s.txt", 1, "später");
    let frueh = gemeinsam::datei_commit(&a.r, "Ada Autorin", "2026-03-02T01:00:00+00:00", "f.txt", 1, "früher");
    let gleich1 = gemeinsam::datei_commit(&a.r, "Ada Autorin", "2026-03-02T05:00:00+00:00", "g1.txt", 1, "gleich 1");
    let gleich2 = gemeinsam::datei_commit(&a.r, "Ada Autorin", "2026-03-02T06:00:00+01:00", "g2.txt", 1, "gleich 2");
    let v = |h: &str| format!("kd:{h}");
    a.von_hand(&["kd:zz-unlesbar".into(), v(&gleich2), v(&spaet), "xy:3f2a9c1".into(), v(&gleich1), v(&frueh)]);
    std::fs::write(a.board.join("aufgaben/0003-defekt.md"), "---\nid: 3\ntitle: [kaputt\n---\n").unwrap();
    let spurdatei = a.basis.join("spur");
    let lauf = starten(&a, &[("GIT_TRACE", spurdatei.to_str().unwrap())]);
    let l = liste(&lauf.adresse).await;
    let reihenfolge: Vec<&str> = l.iter().map(|e| e["verweis"].as_str().unwrap()).collect();
    assert_eq!(reihenfolge, [v(&frueh).as_str(), &v(&spaet), &v(&gleich2), &v(&gleich1), "kd:zz-unlesbar", "xy:3f2a9c1"], "Zeitpunkt statt Text, Gleichstand in Reihenfolge der Datei, ohne Metadaten hinten");
    std::fs::write(&spurdatei, "").unwrap();
    let (status, _, rumpf) = liste_holen(&lauf.adresse, 2).await;
    assert_eq!((status, rumpf), (200, json!({"commits": []})));
    assert!(spur(&spurdatei).is_empty(), "ohne Verweise kein Git");
    let (status, _, rumpf) = liste_holen(&lauf.adresse, 999).await;
    assert_eq!(status, 404);
    assert!(rumpf["fehler"].as_str().is_some());
    let (status, _, rumpf) = liste_holen(&lauf.adresse, 3).await;
    assert_eq!(status, 423, "{rumpf}");
    let direkt = reqwest::get(format!("{}api/aufgaben/3", lauf.adresse)).await.unwrap().status().as_u16();
    assert_eq!(direkt, 423, "wie GET /api/aufgaben/{{nr}}");
}

// ---- AK 8 und 9: ohne Sperre, Zeitgrenze, 503 ----------------------------------------------------------------------

/// Ein `git` im PATH des Servers: für Aufrufe des gehärteten Startorts im Arbeits-Repository (`R` und
/// `core.hooksPath=/dev/null` in den Argumenten) führt es `vorher` aus, solange die Schalterdatei da ist, danach das echte
/// Git. Andere Aufrufe in R (die WBS-Sicht in `src/git.rs`, außerhalb dieser Karte) laufen ungebremst. Liefert `PATH`.
fn git_skript(a: &R204, vorher: &str) -> (PathBuf, String) {
    let echtes = String::from_utf8(std::process::Command::new("sh").args(["-c", "command -v git"]).output().unwrap().stdout).unwrap().trim().to_string();
    let ordner = a.basis.join("bin");
    std::fs::create_dir_all(&ordner).unwrap();
    let schalter = a.basis.join("schalter");
    std::fs::write(&schalter, "").unwrap();
    let skript = format!("#!/bin/sh\ncase \"$*\" in *\"{r}\"*core.hooksPath=/dev/null*) if [ -e {s} ]; then echo $$ >> {p}; {vorher}; fi;; esac\nexec {echtes} \"$@\"\n", r = a.r.display(), s = schalter.display(), p = a.basis.join("pids").display());
    std::fs::write(ordner.join("git"), skript).unwrap();
    std::fs::set_permissions(ordner.join("git"), std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    (schalter, format!("{}:{}", ordner.display(), std::env::var("PATH").unwrap()))
}

fn lebt(pid: &str) -> bool {
    let stat = std::fs::read_to_string(format!("/proc/{pid}/stat")).unwrap_or_default();
    !stat.is_empty() && !stat.rsplit(')').next().unwrap_or_default().trim_start().starts_with('Z')
}

fn pids(a: &R204) -> Vec<String> {
    lies(&a.basis, "pids").split_whitespace().map(String::from).collect()
}

#[tokio::test]
async fn ak08_lesen_ohne_sperre() {
    let a = ausgangslage_r00204();
    a.von_hand(&a.verweise()[..3]);
    // schläft 5 s vor der ersten Antwort im Arbeits-Repository: „vor jeder Antwort“ ergäbe bei 6 Prozessen 30 s und
    // damit nach der Gesamtgrenze von 10 s (AK 9) 503 statt der Liste
    let schalter = a.basis.join("schalter");
    let (_schalter, pfad) = git_skript(&a, &format!("rm -f {}; sleep 5", schalter.display()));
    let lauf = starten(&a, &[("PATH", &pfad)]);
    let adresse = lauf.adresse.clone();
    let lesen = tokio::spawn(async move { liste_holen(&adresse, 1).await });
    tokio::time::sleep(Duration::from_millis(500)).await;
    let (status, rumpf) = senden(reqwest::Method::PATCH, &lauf.adresse, "api/aufgaben/1", "sh", json!({"titel": "Commit-Liste neu"})).await;
    assert_eq!(status, 200, "{rumpf}");
    assert!(!lesen.is_finished(), "das GET hängt noch (sonst prüft die Probe nichts)");
    let (status, _, rumpf) = lesen.await.unwrap();
    assert_eq!((status, rumpf["commits"].as_array().map(Vec::len)), (200, Some(3)));
}

/// Lastprobe (R00261 AK 8): der PATCH wartet unter einer Sekunde auf das lesende GET (5 s Schlaf im Skript).
#[tokio::test]
#[ignore = "Lastprobe: nur ausdrücklich, mit --release"]
async fn ak08_lastprobe_lesen_ohne_sperre() {
    let l = last();
    eprintln!("AK 8 Lastprobe: Last unter 2 nötig (Last jetzt {l:.2})");
    if l >= 2.0 {
        eprintln!("AK 8 keine Messung: Last < 2 nötig (Last {l:.2}) — kein Wert gilt als bestanden");
        return;
    }
    let a = ausgangslage_r00204();
    a.von_hand(&a.verweise()[..3]);
    let schalter = a.basis.join("schalter");
    let (_schalter, pfad) = git_skript(&a, &format!("rm -f {}; sleep 5", schalter.display()));
    let lauf = starten(&a, &[("PATH", &pfad)]);
    let adresse = lauf.adresse.clone();
    let lesen = tokio::spawn(async move { liste_holen(&adresse, 1).await });
    tokio::time::sleep(Duration::from_millis(500)).await;
    let start = Instant::now();
    let (status, rumpf) = senden(reqwest::Method::PATCH, &lauf.adresse, "api/aufgaben/1", "sh", json!({"titel": "Commit-Liste neu"})).await;
    let dauer = start.elapsed();
    eprintln!("AK 8 Lastprobe: PATCH {} ms, Last {:.2}", dauer.as_millis(), last());
    assert_eq!(status, 200, "{rumpf}");
    assert!(dauer < Duration::from_secs(1), "PATCH wartete {dauer:?} auf das Lesen");
    drop(lesen);
}

/// Die 1-Minuten-Last der Maschine aus `/proc/loadavg` (R00261).
fn last() -> f64 {
    std::fs::read_to_string("/proc/loadavg").unwrap_or_default().split(' ').next().unwrap_or_default().parse().unwrap_or(f64::MAX)
}

#[tokio::test]
async fn ak09_zeitgrenze_503_und_prozessgruppe() {
    let (a, _) = (ausgangslage_r00204(), ());
    a.von_hand(&a.verweise());
    let (schalter, pfad) = git_skript(&a, &format!("sleep 300 & echo $! >> {}; sleep 60", a.basis.join("pids").display()));
    let lauf = starten(&a, &[("PATH", &pfad)]);
    let start = Instant::now();
    let (status, _, rumpf) = liste_holen(&lauf.adresse, 1).await;
    let dauer = start.elapsed();
    assert_eq!(status, 503, "{rumpf}");
    assert!(rumpf["fehler"].as_str().is_some());
    assert!(dauer >= Duration::from_secs(10) && dauer <= Duration::from_secs(15), "{dauer:?}");
    let gestartet = pids(&a);
    assert_eq!(gestartet.len(), 2, "genau ein Git-Prozess samt Kind, kein weiterer nach dem Abbruch: {gestartet:?}");
    tokio::time::sleep(Duration::from_millis(500)).await;
    for p in &gestartet {
        assert!(!lebt(p), "Prozess {p} lebt nach dem Abbruch");
    }
    std::fs::remove_file(&schalter).unwrap();
    a.v2_entfernen();
    let l = liste(&lauf.adresse).await;
    assert_eq!(l.len(), 5);
    assert_eq!(eintrag(&l, &format!("kd:{}", a.w1))["zweige"], json!(["karte/1"]), "kein abgebrochenes Ergebnis im Cache");
}

#[tokio::test]
async fn ak09_gesamtgrenze_statt_summe_der_prozessgrenzen() {
    let a = ausgangslage_r00204();
    let viele: Vec<String> = (0..30).map(|i| if i % 2 == 0 { format!("kd:{}", a.k3) } else { format!("kd:{}", a.w1) }).collect();
    a.von_hand(&viele);
    let (_schalter, pfad) = git_skript(&a, "sleep 9");
    let lauf = starten(&a, &[("PATH", &pfad)]);
    let start = Instant::now();
    let (status, _, _) = liste_holen(&lauf.adresse, 1).await;
    let dauer = start.elapsed();
    assert_eq!(status, 503);
    assert!(dauer <= Duration::from_secs(15), "{dauer:?}");
    tokio::time::sleep(Duration::from_millis(500)).await;
    assert!(pids(&a).iter().all(|p| !lebt(p)), "kein Prozess läuft über die Gesamtgrenze hinaus");
    assert_eq!(pids(&a).len(), 2, "Wurzel (9 s) und cat-file (abgebrochen bei 10 s), danach keiner mehr");
}

// ---- AK 11: Cache (Git-Spur) ----------------------------------------------------------------------------------------

#[tokio::test]
async fn ak11_cache_und_bewegter_zweig() {
    let a = ausgangslage_r00204();
    a.von_hand(&a.verweise());
    a.v2_entfernen();
    let spurdatei = a.basis.join("spur");
    let lauf = starten(&a, &[("GIT_TRACE", spurdatei.to_str().unwrap())]);
    let kalt = liste(&lauf.adresse).await;
    let s = spur(&spurdatei);
    assert_eq!(s.len(), 7, "kalt: Wurzel, cat-file, Zähllauf, Zeilenzähl-Lauf, Fingerabdruck, Zweigliste, Probe: {s:#?}");
    assert_eq!(s.iter().filter(|z| z.contains("rev-list --parents")).count(), 1);
    std::fs::write(&spurdatei, "").unwrap();
    let warm = liste(&lauf.adresse).await;
    let s = spur(&spurdatei);
    assert_eq!(s.len(), 5, "aus dem Cache: Wurzel, cat-file, Zähllauf, Zeilenzähl-Lauf, Fingerabdruck: {s:#?}");
    assert!(!s.iter().any(|z| z.contains("rev-list") || z.contains("--contains")));
    assert_eq!(warm, kalt);
    std::fs::write(&spurdatei, "").unwrap();
    // `git branch -f` verweigert einen Zweig, den ein Worktree ausgecheckt hat — update-ref bewegt ihn trotzdem
    git(&a.r, &["update-ref", "refs/heads/karte/1", &a.k4]);
    let neu = liste(&lauf.adresse).await;
    assert_eq!(spur(&spurdatei).iter().filter(|z| z.contains("rev-list --parents")).count(), 1, "Zweig bewegt: Zweigliste neu");
    assert_eq!(eintrag(&neu, &format!("kd:{}", a.w1))["zustand"], "verwaist", "kein veraltetes Ergebnis");
}

// ---- AK 12: Injection über die Datei --------------------------------------------------------------------------------

#[tokio::test]
async fn ak12_injection_ueber_die_datei() {
    let a = ausgangslage_r00204();
    let k1 = &a.k1;
    let boese = ["kd:--output=x".to_string(), "kd:../x".into(), "kd:3f2a9c1;rm -rf x".into(), "kd:3f2a9c1 --all".into(), "kd:3f2a 9c1".into(), "kd:$(touch x)".into(), format!("kd:{k1}^{{tree}}"), format!("kd:{k1} "), format!("kd:{k1}\n{}", a.k2), format!("kd:{k1}\u{0}")];
    let mut verweise = vec![format!("kd:{}", a.k3)];
    verweise.extend(boese.iter().cloned());
    verweise.push(format!("kd:{}", a.w1));
    a.von_hand(&verweise);
    let r_vorher = git(&a.r, &["status", "--porcelain"]);
    let spurdatei = a.basis.join("spur");
    let lauf = starten(&a, &[("GIT_TRACE", spurdatei.to_str().unwrap())]);
    let l = liste(&lauf.adresse).await;
    for b in &boese {
        let e = eintrag(&l, b);
        assert_eq!(e["zustand"], "unlesbar", "{b:?}");
        assert!(e["grund"].as_str().is_some_and(|g| !g.is_empty()), "{b:?}");
    }
    assert!(!a.r.join("x").exists() && !a.board.join("x").exists() && !a.basis.join("x").exists());
    assert_eq!(git(&a.r, &["status", "--porcelain"]), r_vorher);
    let text = std::fs::read_to_string(&spurdatei).unwrap_or_default();
    for teil in ["--output=x", "../x", "rm -rf", "--all", "touch", "^{tree}"] {
        assert!(!text.contains(teil), "{teil} in der Git-Spur");
    }
    assert_eq!(eintrag(&l, &format!("kd:{}", a.k3))["zweige"], json!(["main"]));
    let w1 = eintrag(&l, &format!("kd:{}", a.w1));
    assert_eq!((&w1["zweige"], &w1["titel"]), (&json!(["karte/1"]), &json!("b.txt anlegen")), "der Zeilenumbruch verschiebt nichts");
}

// ---- AK 13 und 17: feindlicher Inhalt, Titelgrenze ------------------------------------------------------------------

#[tokio::test]
async fn ak13_ak17_feindlicher_inhalt_und_titelgrenze() {
    let a = ausgangslage_r00204();
    let titel = "<script>alert(1)</script> \"x\" \\ y";
    let mit = |name: &str, nachricht: &str| {
        let aus = std::process::Command::new("git").arg("-C").arg(&a.r).args(["-c", "user.email=m@m", "commit", "-q", "--allow-empty", "-m", nachricht]).env("GIT_AUTHOR_NAME", name).env("GIT_COMMITTER_NAME", "C").output().unwrap();
        assert!(aus.status.success());
        git(&a.r, &["rev-parse", "HEAD"])
    };
    let boese = mit("Mallory <img src=x>", titel);
    let steuer = mit("A\u{1f}u\u{1e}t\to\rr", "T\u{1f}i\u{1e}t\te\rl");
    let lang = mit("A", &"a".repeat(600));
    let genau = mit("A", &"a".repeat(500));
    let umlaut = mit("A", &format!("{}\nzweite Zeile", "ä".repeat(600)));
    let emoji = mit("A", &format!("{}\u{1F600}", "a".repeat(499)));
    let emoji_mehr = mit("A", &format!("{}\u{1F600}xyz", "a".repeat(499)));
    let v = |h: &str| format!("kd:{h}");
    a.von_hand(&[v(&boese), v(&steuer), v(&lang), v(&genau), v(&umlaut), v(&emoji), v(&emoji_mehr), v(&a.k3)]);
    let lauf = starten(&a, &[]);
    let (status, art, rumpf) = liste_holen(&lauf.adresse, 1).await;
    assert_eq!(status, 200);
    assert!(art.starts_with("application/json"), "{art}");
    let l = rumpf["commits"].as_array().unwrap();
    let e = eintrag(l, &v(&boese));
    assert_eq!(e["titel"], titel);
    assert_eq!(e["autor"], git(&a.r, &["log", "-1", "--format=%an", &boese]), "der Name, wie Git ihn speichert");
    assert!(!e["autor"].as_str().unwrap().contains('@'));
    let e = eintrag(l, &v(&steuer));
    assert_eq!((&e["titel"], &e["autor"]), (&json!("T\u{1f}i\u{1e}t\te\rl"), &json!("A\u{1f}u\u{1e}t\to\rr")));
    let titel_von = |h: &str| eintrag(l, &v(h))["titel"].as_str().unwrap().to_string();
    assert_eq!(titel_von(&lang), format!("{}…", "a".repeat(500)));
    assert_eq!(titel_von(&genau), "a".repeat(500));
    assert_eq!(titel_von(&umlaut), format!("{}…", "ä".repeat(500)));
    assert_eq!(titel_von(&emoji), format!("{}\u{1F600}", "a".repeat(499)));
    assert_eq!(titel_von(&emoji_mehr), format!("{}\u{1F600}…", "a".repeat(499)));
    assert_eq!(eintrag(l, &v(&a.k3))["titel"], "c.txt anlegen", "nichts verschoben");
}

// ---- AK 14 (a): feindliche Konfiguration, Attribute, Umgebung -------------------------------------------------------

#[tokio::test]
async fn ak14a_feindliche_konfiguration_fuehrt_nichts_aus() {
    let a = ausgangslage_r00204();
    let marke = a.basis.join("marke");
    let skript = a.basis.join("skript.sh");
    // markiert nur Läufe im Arbeits-Repository R (die Board-Befehle des Servers sind nicht Gegenstand der Probe)
    std::fs::write(&skript, format!("#!/bin/sh\ncase \"$PWD $*\" in *\"{}\"*) echo \"$0 $*\" >> {};; esac\nexit 0\n", a.r.display(), marke.display())).unwrap();
    std::fs::set_permissions(&skript, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    let s = skript.to_str().unwrap();
    std::fs::write(a.r.join(".gitattributes"), "* diff=x\n").unwrap();
    for (k, w) in [("core.fsmonitor", s), ("core.hooksPath", a.basis.to_str().unwrap()), ("diff.external", s), ("diff.x.textconv", s), ("core.pager", s), ("pager.log", s), ("log.showSignature", "true"), ("gpg.program", s), ("core.sshCommand", s), ("core.askPass", s)] {
        git(&a.r, &["config", k, w]);
    }
    let baum = git(&a.r, &["rev-parse", &format!("{}^{{tree}}", a.k4)]);
    // ohne Elternteil: der Zweig `signiert` erreicht keinen Commit der Ausgangslage
    let roh = format!("tree {baum}\nauthor A <a@a> 1772000000 +0000\ncommitter A <a@a> 1772000000 +0000\ngpgsig -----BEGIN PGP SIGNATURE-----\n \n iQEz\n -----END PGP SIGNATURE-----\n\nsigniert\n");
    std::fs::write(a.basis.join("objekt"), roh).unwrap();
    let signiert = git(&a.r, &["hash-object", "-w", "-t", "commit", a.basis.join("objekt").to_str().unwrap()]);
    git(&a.r, &["update-ref", "refs/heads/signiert", &signiert]);
    let mut verweise = a.verweise();
    verweise.push(format!("kd:{signiert}"));
    a.von_hand(&verweise);
    a.v2_entfernen();
    // die Vorbereitung (gc in `v2_entfernen`) liest selbst den Index und startet den Fsmonitor — erst ab hier gilt die Probe
    let _ = std::fs::remove_file(&marke);
    let umgebung = [("GIT_EXTERNAL_DIFF", s), ("GIT_PAGER", s), ("PAGER", s), ("GIT_SSH_COMMAND", s), ("GIT_ASKPASS", s), ("GIT_EXEC_PATH", a.basis.to_str().unwrap()), ("GIT_CONFIG_COUNT", "1"), ("GIT_CONFIG_KEY_0", "core.fsmonitor"), ("GIT_CONFIG_VALUE_0", s)];
    let lauf = starten(&a, &umgebung);
    let l = liste(&lauf.adresse).await;
    assert_eq!(l.len(), 6);
    assert_eq!(eintrag(&l, &format!("kd:{}", a.k3))["zweige"], json!(["main"]));
    assert_eq!(eintrag(&l, &format!("kd:{}", a.w1))["zweige"], json!(["karte/1"]));
    assert_eq!(eintrag(&l, &format!("kd:{}", a.v1))["zustand"], "verwaist");
    assert_eq!(eintrag(&l, &format!("kd:{}", a.v2))["zustand"], "fehlt");
    assert_eq!(eintrag(&l, &format!("kd:{signiert}"))["titel"], "signiert");
    assert!(!marke.exists(), "ein Skript lief: {}", lies(&a.basis, "marke"));
    // Gegenprobe: ohne die Härtung laufen die Skripte
    git(&a.r, &["status"]);
    git(&a.r, &["log", "-1", "--show-signature", &signiert]);
    let gelaufen = lies(&a.basis, "marke");
    assert!(gelaufen.lines().count() >= 2, "Gegenprobe ohne Marken: {gelaufen}");
}

// ---- AK 15 (b) und AK 8: Lesen schreibt nie --------------------------------------------------------------------------

/// Die Datei, wie die Vorversion (`ae04fcfd`, vor R00202) sie nach einer Titeländerung zurückschreibt: den unbekannten
/// Schlüssel in der Schreibweise von `serde_yaml`, bei genau einem Eintrag in einer Zeile (ADR-0032 N2.2).
fn von_der_vorversion(n: usize, hashes: &[&String]) -> String {
    let eintraege: Vec<String> = (0..n).map(|i| format!("kd:{}", hashes[i % hashes.len()])).collect();
    let commits = match n {
        0 => "commits: []\n".to_string(),
        1 => format!("commits: - {}\n", eintraege[0]),
        _ => format!("commits:\n{}", eintraege.iter().map(|e| format!("- {e}\n")).collect::<String>()),
    };
    format!("---\nid: 1\ntitle: Commit-Liste neu\n{commits}---\n")
}

#[tokio::test]
async fn ak15_bestand_der_vorversion_lesen_ohne_zu_schreiben() {
    let a = ausgangslage_r00204();
    let lauf = starten(&a, &[]);
    for n in [0, 1, 2, 5, 30] {
        let text = von_der_vorversion(n, &[&a.k3, &a.w1, &a.v1]);
        std::fs::write(a.board.join("aufgaben/0001-commit-liste.md"), &text).unwrap();
        git(&a.board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-am", &format!("Vorversion {n}")]);
        let zahl = a.commit_zahl();
        let (status, _, rumpf) = liste_holen(&lauf.adresse, 1).await;
        assert_eq!(status, 200, "{n}: {rumpf}");
        assert_eq!(rumpf["commits"].as_array().unwrap().len(), n, "{n}: so viele Einträge wie die Datei trägt");
        let gespeichert: Value = reqwest::get(format!("{}api/aufgaben/1", lauf.adresse)).await.unwrap().json().await.unwrap();
        assert_eq!(gespeichert["commits"].as_array().unwrap().len(), n, "{n}: gleich viel wie GET /api/aufgaben/1");
        assert_eq!((lies(&a.board, "aufgaben/0001-commit-liste.md"), a.commit_zahl()), (text, zahl), "{n}: GET schreibt nie, auch die Zeilenform bleibt");
    }
}

// ---- AK 16: Beschreibung --------------------------------------------------------------------------------------------

#[tokio::test]
async fn ak16_endpunktliste_openapi_readme() {
    let a = ausgangslage_r00204();
    let lauf = starten(&a, &[]);
    let liste: Value = reqwest::get(format!("{}api/endpunkte", lauf.adresse)).await.unwrap().json().await.unwrap();
    let e = liste.as_array().unwrap().iter().find(|e| e["methode"] == "GET" && e["pfad"] == "/api/aufgaben/{nr}/commits").expect("Route in der Endpunktliste");
    let zweck = e["zweck"].as_str().unwrap();
    for wort in ["auf_zweig", "verwaist", "fehlt", "repository_fehlt", "anwendung_unbekannt", "unlesbar", "404", "423", "503", "Datum aufsteigend"] {
        assert!(zweck.contains(wort), "Zweck nennt {wort}: {zweck}");
    }
    let api: Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse)).await.unwrap().json().await.unwrap();
    let get = &api["paths"]["/api/aufgaben/{nr}/commits"]["get"];
    for status in ["200", "404", "423", "503"] {
        assert!(get["responses"][status].is_object(), "OpenAPI nennt {status}");
    }
    let zustand = &api["components"]["schemas"]["Commitzustand"]["enum"];
    assert_eq!(zustand, &json!(["unlesbar", "anwendung_unbekannt", "repository_fehlt", "fehlt", "auf_zweig", "verwaist"]));
    let readme = std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("README.md")).unwrap();
    assert!(readme.contains("### Commits einer Karte lesen") && readme.contains("GET /api/aufgaben/") && readme.contains("ersetzen"));
}

// ---- Nacharbeit 1, Security Muss 1: kein Lazy-Fetch aus der Konfiguration des Arbeits-Repositorys -------------------

/// Macht R zum Teilklon (`extensions.partialclone=origin`) mit `url` und den Zusatzschlüsseln und löscht den Blob
/// `K2:a.txt` — `log --numstat` über K2 bräuchte ihn und holte ihn sonst von selbst nach.
fn teilklon_ohne_blob(a: &R204, url: &str, zusatz: &[(&str, &str)]) {
    for (k, w) in [("core.repositoryformatversion", "1"), ("extensions.partialclone", "origin"), ("remote.origin.promisor", "true"), ("remote.origin.partialclonefilter", "blob:none"), ("remote.origin.url", url)].iter().chain(zusatz) {
        git(&a.r, &["config", k, w]);
    }
    let blob = git(&a.r, &["rev-parse", &format!("{}:a.txt", a.k2)]);
    let lose = a.r.join(".git/objects").join(&blob[..2]).join(&blob[2..]);
    if lose.exists() {
        std::fs::remove_file(&lose).unwrap();
    }
    let da = std::process::Command::new("git").arg("-C").arg(&a.r).args(["cat-file", "-e", &blob]).env("GIT_NO_LAZY_FETCH", "1").status().unwrap();
    assert!(!da.success(), "der Blob ist noch da");
}

#[tokio::test]
async fn muss1_lazy_fetch_startet_kein_programm() {
    let a = ausgangslage_r00204();
    let marke = a.basis.join("marke");
    let skript = a.basis.join("skript.sh");
    std::fs::write(&skript, format!("#!/bin/sh\necho \"$0 $*\" >> {}\nexit 1\n", marke.display())).unwrap();
    std::fs::set_permissions(&skript, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    let s = skript.to_str().unwrap();
    a.von_hand(&[format!("kd:{}", a.k2)]);
    let lauf = starten(&a, &[]);
    let varianten: [(&str, &[(&str, &str)]); 3] = [
        (a.r.to_str().unwrap(), &[("remote.origin.uploadpack", s)]),
        ("ssh://beispiel.invalid/r.git", &[("core.sshCommand", s)]),
        ("https://127.0.0.1:9/r.git", &[("credential.helper", s)]),
    ];
    let mut gelaufen = vec![];
    for (url, zusatz) in varianten {
        teilklon_ohne_blob(&a, url, zusatz);
        let start = Instant::now();
        let (status, _, rumpf) = liste_holen(&lauf.adresse, 1).await;
        let dauer = start.elapsed();
        assert!(dauer <= Duration::from_secs(15), "{url}: {dauer:?}");
        if marke.exists() {
            gelaufen.push(format!("{url}: {}", lies(&a.basis, "marke")));
            std::fs::remove_file(&marke).unwrap();
        }
        // ohne den Blob gibt es keine Statistik — Git verweigert `log --numstat`, der Eintrag ist `repository_fehlt` mit Grund
        assert_eq!(status, 200, "{url}: {rumpf}");
        let e = &rumpf["commits"][0];
        assert_eq!(e["zustand"], "repository_fehlt", "{url}: {rumpf}");
        assert!(e["grund"].as_str().is_some_and(|g| g.contains("lazy fetching disabled")), "{url}: {rumpf}");
    }
    assert!(gelaufen.is_empty(), "Programme aus der Konfiguration liefen: {gelaufen:?}");
}

// ---- Nacharbeit 1, Security Muss 2: ein Enkel, der die Pipe hält, verlängert die Frist nicht -----------------------

/// Ein Enkel von Git (`vorher` im Shim, danach `exec` auf das echte Git) — wie er läuft und welche Ausgaben er erbt.
struct Enkel {
    name: &'static str,
    /// in Gittes Prozessgruppe: stirbt mit ihr, die Antwort kommt ohne Warten
    in_der_gruppe: bool,
    /// was der Halter nach dem Markieren tut; die Umleitung entscheidet, welchen Strom er offen hält (`""` erbt beide)
    umleitung: &'static str,
}

const ENKEL: [Enkel; 4] = [
    Enkel { name: "in der Gruppe", in_der_gruppe: true, umleitung: "" },
    Enkel { name: "setsid", in_der_gruppe: false, umleitung: "" },
    Enkel { name: "hält stdout", in_der_gruppe: false, umleitung: " 2>/dev/null" },
    Enkel { name: "hält nur stderr", in_der_gruppe: false, umleitung: " >/dev/null" },
];

/// Eine Antwort: Status und **Dauer als Beobachtung** (R00267 AK 1: keine Zusicherung beurteilt eine Dauer).
type Antwort = (u16, Duration);

/// Der Enkel setzt vor Gits Lauf seine **Marke** (`<bereit>.<pid>`): er läuft, hat die Prozessgruppe verlassen (außer
/// der Variante in der Gruppe) und hält die geerbten Ströme. Der Shim wartet auf die Marke, bevor er Git ausführt — so
/// steht der Zustand „Enkel hält die Pipe“ **vor** dem Lesen fest und nicht erst nach der Antwort; sonst träfe die
/// Gruppentötung den Enkel, bevor er `setsid` gerufen hat (der Runner-Wettlauf aus Karte #283).
fn enkel_vorher(enkel: &Enkel, bereit: &Path, enkel_pids: &Path) -> String {
    let setsid = if enkel.in_der_gruppe { "" } else { "setsid " };
    format!(
        "{setsid}sh -c 'echo > {b}.$$; exec sleep 60{u}' & k=$!; echo $k >> {e}; while [ ! -e {b}.$k ]; do sleep 0.005; done",
        b = bereit.display(),
        e = enkel_pids.display(),
        u = enkel.umleitung,
    )
}

/// Eine Variante: `runden` GETs nacheinander, je Status und Dauer; danach die PIDs der Enkel, die Zahl der gesetzten
/// Marken und das Protokoll der Instanz (die Ursache der Abweisung, `Fehler::ursache()`).
async fn mit_enkel(enkel: &Enkel, runden: usize) -> (Vec<Antwort>, Vec<String>, usize, String) {
    let a = ausgangslage_r00204();
    a.von_hand(&a.verweise()[..3]);
    let enkel_pids = a.basis.join("enkel");
    let bereit = a.basis.join("bereit");
    let log = a.basis.join("log");
    let (_schalter, pfad) = git_skript(&a, &enkel_vorher(enkel, &bereit, &enkel_pids));
    let lauf = starten_mit(&a.board, &["--port", "0", "--log-ordner", log.to_str().unwrap()], &[("PATH", &pfad)]);
    let mut antworten = vec![];
    for _ in 0..runden {
        let start = Instant::now();
        // 0: hängt noch nach 20 s (die Ausbleibe-Frist, das Doppelte der Frist — kein Leistungsurteil)
        let status = tokio::time::timeout(Duration::from_secs(20), liste_holen(&lauf.adresse, 1)).await.map_or(0, |(s, _, _)| s);
        antworten.push((status, start.elapsed()));
    }
    tokio::time::sleep(Duration::from_millis(300)).await;
    let pids: Vec<String> = lies(&a.basis, "enkel").split_whitespace().map(String::from).collect();
    let marken = pids.iter().filter(|p| Path::new(&format!("{}.{p}", bereit.display())).exists()).count();
    (antworten, pids, marken, lies(&log, "kanbanD.log"))
}

#[tokio::test]
async fn muss2_enkel_haelt_die_pipe() {
    let laeufe: Vec<_> = ENKEL.iter().map(|e| tokio::spawn(mit_enkel(e, 2))).collect();
    let mut befunde = vec![];
    for (enkel, lauf) in ENKEL.iter().zip(laeufe) {
        let (antworten, pids, marken, protokoll) = lauf.await.unwrap();
        eprintln!("{}: {antworten:?}, Enkel {pids:?}", enkel.name);
        assert!(!pids.is_empty(), "{}: der Shim startete keinen Enkel", enkel.name);
        assert!(marken >= 1, "{}: kein Enkel setzte seine Marke — der Zustand stand vor der Anfrage nicht fest", enkel.name);
        let lebend: Vec<&String> = pids.iter().filter(|p| lebt(p)).collect();
        if enkel.in_der_gruppe {
            // Git endet normal, seine Gruppe mit ihm: die Liste kommt ohne Warten, kein Enkel bleibt
            if antworten.iter().any(|(s, _)| *s != 200) {
                befunde.push(format!("{}: {antworten:?}", enkel.name));
            }
            if !lebend.is_empty() {
                befunde.push(format!("{}: Enkel lebt: {lebend:?}", enkel.name));
            }
        } else {
            // außerhalb der Gruppe bleibt er — die Antwort wartet trotzdem nicht über die Ausbleibe-Frist hinaus; keine
            // Zusicherung beurteilt eine Dauer: es gilt der Zustand (503, Ursache `zeitgrenze`, der Enkel lebt danach)
            if antworten.iter().any(|(s, _)| *s != 503) {
                befunde.push(format!("{}: {antworten:?}", enkel.name));
            }
            if lebend.is_empty() {
                befunde.push(format!("{}: kein Enkel lebt nach der Antwort: {pids:?}", enkel.name));
            }
            if !(protokoll.contains("status=503") && protokoll.contains("ursache=zeitgrenze")) {
                befunde.push(format!("{}: kein `503 … ursache=zeitgrenze` im Protokoll", enkel.name));
            }
        }
        for p in &pids {
            let _ = std::process::Command::new("kill").arg("-9").arg(p).status();
        }
    }
    assert!(befunde.is_empty(), "{befunde:#?}");
}

// ---- Nacharbeit 1, Security Muss 3: höchstens 4 Git-Prozesse für das Lesen gleichzeitig ----------------------------

#[tokio::test]
async fn muss3_hoechstens_vier_git_prozesse_gleichzeitig() {
    let a = ausgangslage_r00204();
    a.von_hand(&a.verweise()[..3]);
    // ein Shim, der jeden Lesevorgang in R 200 ms dauern lässt und solange einen Eintrag in `laufend/` hält
    let echtes = String::from_utf8(std::process::Command::new("sh").args(["-c", "command -v git"]).output().unwrap().stdout).unwrap().trim().to_string();
    let (ordner, laufend) = (a.basis.join("bin"), a.basis.join("laufend"));
    std::fs::create_dir_all(&ordner).unwrap();
    std::fs::create_dir_all(&laufend).unwrap();
    let skript = format!("#!/bin/sh\ncase \"$*\" in *\"{r}\"*core.hooksPath=/dev/null*) mkdir {l}/$$; sleep 0.2; {echtes} \"$@\"; rc=$?; rmdir {l}/$$; exit $rc;; esac\nexec {echtes} \"$@\"\n", r = a.r.display(), l = laufend.display());
    std::fs::write(ordner.join("git"), skript).unwrap();
    std::fs::set_permissions(ordner.join("git"), std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
    let pfad = format!("{}:{}", ordner.display(), std::env::var("PATH").unwrap());
    let lauf = starten(&a, &[("PATH", &pfad)]);
    let fertig = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let zaehler = {
        let (fertig, laufend) = (fertig.clone(), laufend.clone());
        std::thread::spawn(move || {
            let mut hoechstens = 0;
            while !fertig.load(std::sync::atomic::Ordering::SeqCst) {
                hoechstens = hoechstens.max(std::fs::read_dir(&laufend).unwrap().count());
                std::thread::sleep(Duration::from_millis(5));
            }
            hoechstens
        })
    };
    let anfragen: Vec<_> = (0..16).map(|_| {
        let adresse = lauf.adresse.clone();
        tokio::spawn(async move {
            let start = Instant::now();
            let (status, _, _) = liste_holen(&adresse, 1).await;
            (status, start.elapsed())
        })
    }).collect();
    let mut antworten = vec![];
    for x in anfragen {
        antworten.push(x.await.unwrap());
    }
    fertig.store(true, std::sync::atomic::Ordering::SeqCst);
    let hoechstens = zaehler.join().unwrap();
    eprintln!("höchstens {hoechstens} gleichzeitig; {antworten:?}");
    assert!(antworten.iter().all(|(s, d)| *s == 200 && *d <= Duration::from_secs(15)), "{antworten:?}");
    assert!(hoechstens <= 4, "{hoechstens} Git-Prozesse gleichzeitig");
    assert!(hoechstens >= 2, "die Probe sieht Gleichzeitigkeit: {hoechstens}");
}
