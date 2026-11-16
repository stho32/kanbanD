// R00165 Teil B (I0154, ADR-0028 Punkt 5): Kosteneintrag über die API anlegen, ändern und löschen
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{json, Value};
use std::path::Path;

const EINTRAG: &str = "  - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, amount: 3.46, currency: USD}\n";
const ZWEITER: &str = "  - {at: 2026-11-13 11:02+01:00, role: entwickler, column: Entwicklung, amount: 1.20, currency: USD}\n";
const KENNUNG: &str = "entwickler@2026-11-13T10:34+01:00";

/// Board „fabrik“ mit Eingang, Entwicklung, Fertig; #1 in Entwicklung — `kopf` ins Frontmatter von #1. Daneben das
/// Board „entwicklung“ des Grundbestands (Zu erledigen, In Arbeit, Erledigt), auf dem #1 nicht liegt.
fn fabrik(pfad: &Path, kopf: &str) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    std::fs::write(pfad.join("aufgaben/0001-a1.md"), format!("---\nid: 1\ntitle: a1\n{kopf}---\n")).unwrap();
    std::fs::write(pfad.join("boards/fabrik.md"), "# Fabrik\n\n## Eingang\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-a1.md)\n\n## Fertig\n").unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
}

fn datei(pfad: &Path) -> String {
    lies(pfad, "aufgaben/0001-a1.md")
}

fn commits(pfad: &Path) -> u32 {
    git(pfad, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

/// Datei von #1, Zahl der Commits und offene Änderungen — nach einer Abweisung gleich wie davor.
fn stand(pfad: &Path) -> (String, u32, String) {
    (datei(pfad), commits(pfad), git(pfad, &["status", "--porcelain"]))
}

fn beispiel() -> Value {
    json!({"at": "2026-11-13 10:34+01:00", "role": "entwickler", "column": "Entwicklung", "amount": 3.46, "currency": "USD"})
}

/// Das Beispiel mit ersetzten oder ergänzten Angaben.
fn beispiel_mit(angaben: Value) -> Value {
    let mut b = beispiel();
    for (k, v) in angaben.as_object().unwrap() {
        b[k] = v.clone();
    }
    b
}

/// Pfad eines Eintrags über seine Kennung, URL-kodiert.
fn pfad(kennung: &str) -> String {
    format!("api/aufgaben/1/kosteneintraege/{}", kennung.replace('@', "%40").replace('+', "%2B").replace(':', "%3A"))
}

async fn anlegen(adresse: &str, wer: &str, rumpf: Value) -> (u16, Value) {
    senden(Method::POST, adresse, "api/aufgaben/1/kosteneintraege", wer, rumpf).await
}

async fn holen(adresse: &str) -> Value {
    reqwest::get(format!("{adresse}api/aufgaben/1")).await.unwrap().json().await.unwrap()
}

// B0795 · AK 1, AK 2 · US-1 · Abnahme-Probe der Karte #166: Board „fabrik“, #1 in „Entwicklung“, POST mit 3,46 →
// der Eintrag steht an #1, genau ein Commit, GET liefert ihn mit Kennung; ein zweiter Lauf → zweiter Eintrag daneben
#[tokio::test]
#[ignore = "erwartet rot: die Route gibt es noch nicht (404) — grün mit B0797"]
async fn abnahme_probe_eintrag_anlegen_und_zweiter_lauf() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), "");
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());

    let (s, a) = anlegen(&lauf.adresse, "cl", beispiel()).await;
    assert_eq!(s, 200, "{a}");
    let erster = beispiel_mit(json!({"kennung": KENNUNG}));
    assert_eq!(a["kosteneintraege"], json!([erster]), "die Antwort ist die Aufgabe");
    assert_eq!(datei(tmp.path()), format!("---\nid: 1\ntitle: a1\ncost-entries:\n{EINTRAG}---\n"), "die Zeile des Beispiels");
    assert_eq!(commits(tmp.path()), vorher + 1, "genau ein Commit");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "", "nichts bleibt offen");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Claude|#1 Kosteneintrag angelegt: 3,46 USD (entwickler, Entwicklung)");
    assert_eq!(holen(&lauf.adresse).await["kosteneintraege"], json!([erster]), "GET liefert ihn mit kennung");

    let (s, a) = anlegen(&lauf.adresse, "cl", beispiel_mit(json!({"at": "2026-11-13 11:02+01:00", "amount": 1.20}))).await;
    assert_eq!(s, 200, "{a}");
    assert_eq!(datei(tmp.path()), format!("---\nid: 1\ntitle: a1\ncost-entries:\n{EINTRAG}{ZWEITER}---\n"), "zweiter Eintrag daneben, der erste unverändert");
    assert_eq!(commits(tmp.path()), vorher + 2);
    let kennungen: Vec<&str> = a["kosteneintraege"].as_array().unwrap().iter().map(|e| e["kennung"].as_str().unwrap()).collect();
    assert_eq!(kennungen, [KENNUNG, "entwickler@2026-11-13T11:02+01:00"]);
}
