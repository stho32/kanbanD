// R00236 (I0226, Karte #255): die Diff-Antwort nennt die Wurzel des Arbeits-Repositorys (`wurzel`), und kein 304
// bestätigt eine alte Wurzel — Akzeptanztests gegen das echte Programm und echtes Git (AK 1, 2). Schichten: Testfall
// (je AK) → Testsprache (`Lage`) → Treiber (`holen`: URL, Header, Status) → Programm.
mod gemeinsam;

use gemeinsam::{Laufendes, git_am, starten};
use serde_json::Value;
use std::path::{Path, PathBuf};

const ADA: &str = "Ada Autorin";
const DATUM: &str = "2026-03-05T09:00:00+00:00";

// ---- Treiber ----------------------------------------------------------------------------------------------------------

struct Antwort {
    status: u16,
    etag: Option<String>,
    text: String,
}

impl Antwort {
    fn json(&self) -> Value {
        serde_json::from_str(&self.text).unwrap_or(Value::Null)
    }
}

async fn holen(adresse: &str, abfrage: &str, bekannt: Option<&str>) -> Antwort {
    let mut a = reqwest::Client::new().get(format!("{adresse}api/aufgaben/1/diff?{abfrage}"));
    if let Some(b) = bekannt {
        a = a.header("If-None-Match", b);
    }
    let r = a.send().await.unwrap();
    let etag = r.headers().get("etag").and_then(|w| w.to_str().ok()).map(str::to_string);
    let status = r.status().as_u16();
    Antwort { status, etag, text: r.text().await.unwrap() }
}

// ---- Testsprache ------------------------------------------------------------------------------------------------------

/// Ausgangslage von R00236 (Ausschnitt für die API): `W` = `<tmp>/R x` mit dem Unterordner `plan`, im Register als
/// `repository` `W/plan` (Anwendung `kd`); `V` = `<tmp>/V` direkt als Repository von `wb`. #1 trägt `kd:K` und `wb:B`.
/// Feste Daten, deshalb feste Hashes: der ETag von vor der Karte steht als Wert im Test.
struct Lage {
    _tmp: tempfile::TempDir,
    basis: PathBuf,
    w: PathBuf,
    v: PathBuf,
    board: PathBuf,
    k: String,
}

fn commit(r: &Path, nachricht: &str) -> String {
    git_am(r, ADA, DATUM, &["add", "-A"]);
    git_am(r, ADA, DATUM, &["commit", "-q", "-m", nachricht]);
    git_am(r, ADA, DATUM, &["rev-parse", "HEAD"])
}

fn ausgangslage() -> Lage {
    let tmp = tempfile::tempdir().unwrap();
    let basis = tmp.path().canonicalize().unwrap();
    let (w, v, board) = (basis.join("R x"), basis.join("V"), basis.join("board"));
    std::fs::create_dir_all(w.join("plan")).unwrap();
    std::fs::write(w.join("plan/wbs.md"), "# Plan\n").unwrap();
    git_am(&w, ADA, DATUM, &["init", "-q", "-b", "main"]);
    std::fs::write(w.join("a.rs"), "1\n2\n3\n").unwrap();
    commit(&w, "Grundstand");
    std::fs::write(w.join("a.rs"), "1\nzwei\n3\n").unwrap();
    let k = commit(&w, "K");
    std::fs::create_dir_all(&v).unwrap();
    git_am(&v, ADA, DATUM, &["init", "-q", "-b", "main"]);
    std::fs::write(v.join("b.js"), "a\n").unwrap();
    commit(&v, "Grund wb");
    std::fs::write(v.join("b.js"), "a\nb\n").unwrap();
    let b = commit(&v, "B");
    std::fs::create_dir_all(board.join("aufgaben")).unwrap();
    std::fs::create_dir_all(board.join("boards")).unwrap();
    std::fs::write(board.join("aufgaben/0001-review.md"), format!("---\nid: 1\ntitle: Review\ncommits:\n  - kd:{k}\n  - wb:{b}\n---\n")).unwrap();
    std::fs::write(board.join("boards/fabrik.md"), "# fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-review.md)\n").unwrap();
    let lage = Lage { _tmp: tmp, basis, w: w.clone(), v, board, k };
    lage.register(&w.join("plan"));
    gemeinsam::git(&lage.board, &["init", "-q"]);
    gemeinsam::git(&lage.board, &["add", "-A"]);
    gemeinsam::git(&lage.board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "fabrik"]);
    lage
}

impl Lage {
    /// Das Register: `kd` mit `repository` = `kd_ordner`, `wb` mit `V`.
    fn register(&self, kd_ordner: &Path) {
        let text = format!("---\npeople:\n  sh: {{name: Stefan, kind: human}}\nclasses: {{}}\nsources:\n  wbs: \"\"\n  requirements: \"\"\n  applications:\n    kd: {{name: KD, repository: \"{}\"}}\n    wb: {{name: WB, repository: \"{}\"}}\n---\n", kd_ordner.display(), self.v.display());
        std::fs::write(self.board.join("kanbanD.md"), text).unwrap();
    }

    /// `kd` zeigt auf eine Kopie von `W` unter `<tmp>/R2` (dieselben Commits).
    fn auf_kopie_umstellen(&self) -> PathBuf {
        let r2 = self.basis.join("R2");
        let a = std::process::Command::new("cp").arg("-a").arg(&self.w).arg(&r2).status().unwrap();
        assert!(a.success());
        self.register(&r2.join("plan"));
        r2
    }

    fn starten(&self) -> Laufendes {
        starten(&self.board, &["--port", "0"])
    }

    fn ein_commit(&self) -> String {
        format!("commit=kd:{}", self.k)
    }
}

fn show_toplevel(ordner: &Path) -> String {
    git_am(ordner, ADA, DATUM, &["rev-parse", "--show-toplevel"])
}

// ---- Testfälle --------------------------------------------------------------------------------------------------------

// AK 1: beide Formen tragen `wurzel` gleich `rev-parse --show-toplevel` (nicht `W/plan`), `wb` die Wurzel `V`
#[tokio::test]
async fn ak1_wurzel_in_beiden_formen() {
    let lage = ausgangslage();
    let lauf = lage.starten();
    let erwartet = show_toplevel(&lage.w.join("plan"));
    assert_eq!(erwartet, lage.w.display().to_string(), "Probe: die Wurzel ist W");
    for abfrage in [lage.ein_commit(), String::new(), "anwendung=kd".into()] {
        let a = holen(&lauf.adresse, &abfrage, None).await;
        assert_eq!(a.status, 200, "{abfrage}: {}", a.text);
        assert_eq!(a.json()["wurzel"].as_str(), Some(erwartet.as_str()), "{abfrage}");
    }
    let wb = holen(&lauf.adresse, "anwendung=wb", None).await;
    assert_eq!(wb.json()["wurzel"].as_str(), Some(show_toplevel(&lage.v).as_str()), "{}", wb.text);
}

// AK 1: `format=patch` bleibt bytegleich zur Antwort vor der Karte (Wert vom Programm vor der Karte)
#[tokio::test]
async fn ak1_patch_bytegleich() {
    let lage = ausgangslage();
    let lauf = lage.starten();
    for (abfrage, vorher) in [(format!("{}&format=patch", lage.ein_commit()), PATCH_VOR_DER_KARTE.to_string()), ("format=patch".into(), format!("{GESAMT_KOPF}{PATCH_VOR_DER_KARTE}"))] {
        let a = holen(&lauf.adresse, &abfrage, None).await;
        assert_eq!(a.status, 200, "{abfrage}");
        assert_eq!(a.text, vorher, "{abfrage}");
    }
}

const PATCH_VOR_DER_KARTE: &str = "diff --git a/a.rs b/a.rs\nindex 01e79c32a8c99c557f0757da7cb6d65b3414466d..7e8b688c56b0b34aa02fb3d0fc66ebc3457da41e 100644\n--- a/a.rs\n+++ b/a.rs\n@@ -1,3 +1,3 @@\n 1\n-2\n+zwei\n 3\n";
const GESAMT_KOPF: &str = "# kanbanD: weitere_anwendungen anwendungen=[\"wb\"]\n";

// AK 1: die OpenAPI nennt `wurzel` in `Diff` und `Gesamtdiff` und im Text von `GET …/diff`
#[tokio::test]
async fn ak1_openapi_nennt_wurzel() {
    let lage = ausgangslage();
    let lauf = lage.starten();
    let api: Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse)).await.unwrap().json().await.unwrap();
    for schema in ["Diff", "Gesamtdiff"] {
        let s = &api["components"]["schemas"][schema];
        assert!(s["properties"]["wurzel"].is_object(), "{schema}: {s}");
        assert!(s["required"].as_array().unwrap().iter().any(|r| r == "wurzel"), "{schema}: required");
    }
    let text = api["paths"]["/api/aufgaben/{nr}/diff"]["get"]["description"].as_str().unwrap();
    assert!(text.contains("wurzel"), "{text}");
}

// AK 2 (Wächter gegen m9, m11): nach Umstellen des Registers auf die Kopie R2 kein 304 mit der alten Wurzel — beide
// Formen, `json` und `format=patch`; ohne Änderung bleibt es bei 304
#[tokio::test]
async fn ak2_keine_alte_wurzel_per_304() {
    let lage = ausgangslage();
    let lauf = lage.starten();
    let abfragen = [lage.ein_commit(), format!("{}&format=patch", lage.ein_commit()), String::new(), "format=patch".into()];
    let mut tags = vec![];
    for abfrage in &abfragen {
        let a = holen(&lauf.adresse, abfrage, None).await;
        assert_eq!(a.status, 200, "{abfrage}");
        let e = a.etag.unwrap_or_else(|| panic!("{abfrage}: kein ETag"));
        assert_eq!(holen(&lauf.adresse, abfrage, Some(&e)).await.status, 304, "{abfrage}: ohne Änderung 304");
        tags.push(e);
    }
    let r2 = lage.auf_kopie_umstellen();
    for (abfrage, e) in abfragen.iter().zip(&tags) {
        let a = holen(&lauf.adresse, abfrage, Some(e)).await;
        assert_eq!(a.status, 200, "{abfrage}: alte Wurzel nicht per 304");
        if !abfrage.contains("patch") {
            assert_eq!(a.json()["wurzel"].as_str(), Some(r2.display().to_string().as_str()), "{abfrage}");
        }
    }
}

// AK 2: der ETag, den das Programm vor der Karte zur selben Anfrage gebildet hat (fester Wert), ergibt 200 mit
// `wurzel`, nicht 304 — je Form, `json` und `format=patch`
#[tokio::test]
async fn ak2_etag_von_vor_der_karte_ergibt_200() {
    let lage = ausgangslage();
    let lauf = lage.starten();
    let faelle = [(lage.ein_commit(), ETAG_EIN_COMMIT_JSON), (format!("{}&format=patch", lage.ein_commit()), ETAG_EIN_COMMIT_PATCH), (String::new(), ETAG_GESAMT_JSON), ("format=patch".into(), ETAG_GESAMT_PATCH)];
    for (abfrage, alt) in faelle {
        let a = holen(&lauf.adresse, &abfrage, Some(alt)).await;
        assert_eq!(a.status, 200, "{abfrage}: mit dem ETag von vor der Karte");
        assert_ne!(a.etag.as_deref(), Some(alt), "{abfrage}: neuer ETag");
        if !abfrage.contains("patch") {
            assert_eq!(a.json()["wurzel"].as_str(), Some(lage.w.display().to_string().as_str()), "{abfrage}");
        }
    }
}

// erfasst am Stand 8a118840 (vor der Karte) mit `werte_vor_der_karte_ausgeben`
const ETAG_EIN_COMMIT_JSON: &str = "\"diff-1c6beb4b72de1cda\"";
const ETAG_EIN_COMMIT_PATCH: &str = "\"diff-745ffa4ec22e270c\"";
const ETAG_GESAMT_JSON: &str = "\"gesamt-f8cc7661f4a12769\"";
const ETAG_GESAMT_PATCH: &str = "\"gesamt-d06c004f53b2f8bd\"";
