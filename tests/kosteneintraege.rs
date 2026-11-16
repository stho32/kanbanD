// R00165 Teil A (I0153, ADR-0028): Kosteneinträge stehen an der Aufgabe und bleiben erhalten
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{json, Value};
use std::path::Path;

const ALTE_POSTEN: &str = "cost:\n  currency: USD\n  items:\n    - {text: Planung, min: 0.10, max: 0.20}\n    - {text: Bau, amount: 0.30}\n";
const EINTRAG: &str = "  - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, amount: 3.46, currency: USD}\n";
const ZWEITER: &str = "  - {at: 2026-11-13 11:02+01:00, role: entwickler, column: Entwicklung, amount: 1.20, currency: USD, tokens: 81234}\n";

/// Board „fabrik“ mit Eingang, Entwicklung, Fertig; #1 in Entwicklung, #2 in Fertig — `kopf` je Aufgabe ins Frontmatter.
fn fabrik(pfad: &Path, kopf: [&str; 2]) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    for (n, kopf) in (1..).zip(kopf) {
        std::fs::write(pfad.join(format!("aufgaben/000{n}-a{n}.md")), format!("---\nid: {n}\ntitle: a{n}\n{kopf}---\n")).unwrap();
    }
    std::fs::write(
        pfad.join("boards/fabrik.md"),
        "# Fabrik\n\n## Eingang\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-a1.md)\n\n## Fertig\n\n- [#2](../aufgaben/0002-a2.md)\n",
    )
    .unwrap();
    git(pfad, &["add", "-A"]);
    git(pfad, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Fabrik"]);
}

fn datei(pfad: &Path, n: u32) -> String {
    lies(pfad, &format!("aufgaben/000{n}-a{n}.md"))
}

async fn aendern(adresse: &str, n: u32, aenderung: Value) -> (u16, Value) {
    senden(Method::PATCH, adresse, &format!("api/aufgaben/{n}"), "st", aenderung).await
}

async fn holen(adresse: &str, n: u32) -> (u16, Value) {
    let r = reqwest::get(format!("{adresse}api/aufgaben/{n}")).await.unwrap();
    (r.status().as_u16(), r.json().await.unwrap())
}

/// Der Wert unter `cost-entries` im Frontmatter, unabhängig von der Schreibweise (Fluss- oder Blockform).
fn eintraege_in_der_datei(text: &str) -> serde_yaml::Value {
    let kopf = text.strip_prefix("---\n").and_then(|t| t.split("\n---\n").next()).unwrap();
    serde_yaml::from_str::<serde_yaml::Value>(kopf).unwrap()["cost-entries"].clone()
}

// B0791, Wache für AK 6: eine alte Datei mit cost.items und von Hand geschriebenem cost-entries übersteht eine
// Titeländerung — der Abschnitt cost zeichengleich, kein Eintrag verloren oder im Inhalt verändert, nicht defekt.
// Gilt schon am Stand vor R00165 (dort als unbekannter Schlüssel in Blockform).
#[tokio::test]
async fn alte_datei_mit_posten_und_eintraegen_uebersteht_eine_titelaenderung() {
    let tmp = tempfile::tempdir().unwrap();
    let kopf = format!("{ALTE_POSTEN}cost-entries:\n{EINTRAG}{ZWEITER}");
    fabrik(tmp.path(), [&kopf, ""]);
    let vorher = eintraege_in_der_datei(&datei(tmp.path(), 1));
    assert_eq!(vorher.as_sequence().map(Vec::len), Some(2), "Ausgangslage: zwei Einträge");
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    assert_eq!(holen(&lauf.adresse, 1).await.0, 200, "lesbar, nicht defekt");
    let (s, a) = aendern(&lauf.adresse, 1, json!({"titel": "umbenannt"})).await;
    assert_eq!(s, 200, "{a}");

    let nachher = datei(tmp.path(), 1);
    assert!(nachher.contains("title: umbenannt\n"), "{nachher}");
    assert!(nachher.contains(ALTE_POSTEN), "cost zeichengleich:\n{nachher}");
    assert_eq!(eintraege_in_der_datei(&nachher), vorher, "kein Eintrag verloren oder verändert:\n{nachher}");
    assert_eq!(holen(&lauf.adresse, 1).await.0, 200, "auch nach dem Schreiben nicht defekt");
}
