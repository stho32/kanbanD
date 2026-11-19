// R00202 (I0192, ADR-0032 Punkt 1): der Schlüssel `commits` in der Aufgabendatei — Rundlauf, Legacy, GET, Duplizieren
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{json, Value};
use std::path::Path;

/// So schreibt kanbanD `commits`: mit Kürzel, ohne Kürzel (Standardanwendung), ein unlesbarer Eintrag von Hand und ein
/// Hash aus lauter Ziffern, der als Text in Anführungszeichen steht — sonst läse YAML ihn als Zahl zurück.
const COMMITS: &str = "commits:\n  - kd:3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e\n  - 9c6b91f5d0e3a2b1c4d5e6f7a8b9c0d1e2f3a4b5\n  - kd:zz\n  - '1234567890123456789012345678901234567890'\n";

/// Board „fabrik“ mit Eingang, Entwicklung, Fertig; #1 in Entwicklung, #2 in Eingang — `kopf` je Aufgabe ins Frontmatter.
fn fabrik(pfad: &Path, kopf: [&str; 2]) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    for (n, kopf) in (1..).zip(kopf) {
        std::fs::write(pfad.join(format!("aufgaben/000{n}-a{n}.md")), format!("---\nid: {n}\ntitle: a{n}\n{kopf}---\n")).unwrap();
    }
    std::fs::write(
        pfad.join("boards/fabrik.md"),
        "# Fabrik\n\n## Eingang\n\n- [#2](../aufgaben/0002-a2.md)\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-a1.md)\n\n## Fertig\n",
    )
    .unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
}

fn datei(pfad: &Path, n: u32) -> String {
    lies(pfad, &format!("aufgaben/000{n}-a{n}.md"))
}

async fn titel_aendern(adresse: &str, n: u32, titel: &str) -> (u16, Value) {
    senden(Method::PATCH, adresse, &format!("api/aufgaben/{n}"), "st", json!({ "titel": titel })).await
}

async fn holen(adresse: &str, n: u32) -> (u16, Value) {
    let r = reqwest::get(format!("{adresse}api/aufgaben/{n}")).await.unwrap();
    (r.status().as_u16(), r.json().await.unwrap())
}

// B0988 · AK 9a/9c · US-7: eine von kanbanD geschriebene Datei mit `commits` übersteht eine Titeländerung zeichengleich
// bis auf den Titel, die Aufgabe ist nicht defekt. Am Stand vor R00202 grün über die unbekannten Schlüssel (`weitere`) —
// bleibt die Wache dafür, dass alte und neue Version dieselbe Schreibweise haben.
#[tokio::test]
async fn datei_mit_commits_uebersteht_eine_titelaenderung_zeichengleich() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), [COMMITS, ""]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    assert_eq!(holen(&lauf.adresse, 1).await.0, 200, "lesbar, nicht defekt");
    let (s, a) = titel_aendern(&lauf.adresse, 1, "umbenannt").await;
    assert_eq!(s, 200, "{a}");
    assert_eq!(datei(tmp.path(), 1), format!("---\nid: 1\ntitle: umbenannt\n{COMMITS}---\n"));
    assert_eq!(holen(&lauf.adresse, 1).await.0, 200, "auch nach dem Schreiben nicht defekt");
}
