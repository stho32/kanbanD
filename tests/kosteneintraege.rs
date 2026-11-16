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
    assert_eq!(nachher, format!("---\nid: 1\ntitle: umbenannt\n{kopf}---\n"), "B0793: Reihenfolge und Schreibweise der Einträge zeichengleich");
    assert_eq!(holen(&lauf.adresse, 1).await.0, 200, "auch nach dem Schreiben nicht defekt");
}

// AK 1a: der Eintrag aus der Datei kommt über GET mit seiner Kennung; ohne Einträge eine leere Liste
#[tokio::test]
async fn get_liefert_kosteneintraege_mit_kennung() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), [&format!("cost-entries:\n{EINTRAG}{ZWEITER}"), ""]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let (s, a) = holen(&lauf.adresse, 1).await;
    assert_eq!(s, 200, "{a}");
    assert_eq!(
        a["kosteneintraege"],
        json!([
            {"at": "2026-11-13 10:34+01:00", "role": "entwickler", "column": "Entwicklung", "amount": 3.46, "currency": "USD", "kennung": "entwickler@2026-11-13T10:34+01:00"},
            {"at": "2026-11-13 11:02+01:00", "role": "entwickler", "column": "Entwicklung", "amount": 1.2, "currency": "USD", "tokens": 81234, "kennung": "entwickler@2026-11-13T11:02+01:00"}
        ])
    );
    assert_eq!(a["cost"], Value::Null, "Einträge ohne Preisetikett");
    assert_eq!(holen(&lauf.adresse, 2).await.1["kosteneintraege"], json!([]));
}

// AK 6: alte Posten über PATCH cost gesetzt — lesbar, nach einer Titeländerung zeichengleich, kein Eintrag entstanden
#[tokio::test]
async fn alte_posten_bleiben_und_werden_nie_zu_eintraegen() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), ["", ""]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let posten = json!({"currency": "USD", "items": [{"text": "Planung", "min": 0.10, "max": 0.20}, {"text": "Bau", "amount": 0.30}]});
    assert_eq!(aendern(&lauf.adresse, 2, json!({"cost": posten})).await.0, 200);
    assert_eq!(datei(tmp.path(), 2), format!("---\nid: 2\ntitle: a2\n{ALTE_POSTEN}---\n"));

    let (s, a) = aendern(&lauf.adresse, 2, json!({"titel": "zwei"})).await;
    assert_eq!(s, 200, "nicht defekt: {a}");
    assert_eq!(datei(tmp.path(), 2), format!("---\nid: 2\ntitle: zwei\n{ALTE_POSTEN}---\n"));
    let (s, a) = holen(&lauf.adresse, 2).await;
    assert_eq!((s, &a["cost"], &a["kosteneintraege"]), (200, &posten, &json!([])), "{a}");
}

// AK 7: PATCH cost — mit einem Betrag und mit null — lässt die Zeilen unter cost-entries stehen
#[tokio::test]
async fn patch_cost_beruehrt_die_eintraege_nie() {
    let tmp = tempfile::tempdir().unwrap();
    let eintraege = format!("cost-entries:\n{EINTRAG}{ZWEITER}");
    fabrik(tmp.path(), [&eintraege, ""]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = holen(&lauf.adresse, 1).await.1["kosteneintraege"].clone();

    let (s, a) = aendern(&lauf.adresse, 1, json!({"cost": {"currency": "USD", "amount": 2.00}})).await;
    assert_eq!((s, &a["kosteneintraege"]), (200, &vorher), "{a}");
    assert_eq!(datei(tmp.path(), 1), format!("---\nid: 1\ntitle: a1\ncost:\n  currency: USD\n  amount: 2.00\n{eintraege}---\n"));

    let (s, a) = aendern(&lauf.adresse, 1, json!({"cost": null})).await;
    assert_eq!((s, &a["cost"], &a["kosteneintraege"]), (200, &Value::Null, &vorher), "{a}");
    assert_eq!(datei(tmp.path(), 1), format!("---\nid: 1\ntitle: a1\n{eintraege}---\n"), "nur das Etikett ist weg");
    assert_eq!(holen(&lauf.adresse, 1).await.1["kosteneintraege"], vorher);
}

// AK 8: der Eintrag ist eine Tatsache — nach dem Umbenennen der Spalte steht weiter column: Entwicklung, nicht defekt
#[tokio::test]
async fn umbenannte_spalte_aendert_den_eintrag_nicht() {
    let tmp = tempfile::tempdir().unwrap();
    let eintraege = format!("cost-entries:\n{EINTRAG}");
    fabrik(tmp.path(), [&eintraege, ""]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let spalten = json!([{"name": "Eingang", "alt": "Eingang"}, {"name": "Bau", "alt": "Entwicklung"}, {"name": "Fertig", "alt": "Fertig"}]);
    let (s, b) = senden(Method::PUT, &lauf.adresse, "api/boards/fabrik/spalten", "st", spalten).await;
    assert_eq!(s, 200, "{b}");
    assert!(lies(tmp.path(), "boards/fabrik.md").contains("## Bau\n\n- [#1]"), "die Spalte heißt jetzt Bau");

    let (s, a) = holen(&lauf.adresse, 1).await;
    assert_eq!((s, &a["kosteneintraege"][0]["column"]), (200, &json!("Entwicklung")), "{a}");
    let (s, a) = aendern(&lauf.adresse, 1, json!({"titel": "eins"})).await;
    assert_eq!(s, 200, "schreibbar, nicht defekt: {a}");
    assert_eq!(datei(tmp.path(), 1), format!("---\nid: 1\ntitle: eins\n{eintraege}---\n"));
}

// Schutz des Nutzers: ein ungültiger Eintrag einer von Hand bearbeiteten Datei wirft nichts weg — die Aufgabe ist
// defekt (nur lesbar) mit Stelle und Feld im Grund, und kein Schreiben fasst die Datei an.
#[tokio::test]
async fn ungueltiger_eintrag_macht_die_aufgabe_defekt_und_nichts_geht_verloren() {
    let tmp = tempfile::tempdir().unwrap();
    let kaputt = EINTRAG.replace("amount: 3.46", "amount: abc");
    fabrik(tmp.path(), [&format!("{ALTE_POSTEN}cost-entries:\n{ZWEITER}{kaputt}"), ""]);
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = (datei(tmp.path(), 1), git(tmp.path(), &["rev-list", "--count", "HEAD"]));

    let (s, defekt) = holen(&lauf.adresse, 1).await;
    assert_eq!((s, defekt["fehler"].as_str().unwrap().contains("cost-entries[1].amount: keine Zahl")), (423, true), "{defekt}");
    assert_eq!(defekt["text"], json!(vorher.0), "der Dateitext bleibt lesbar");
    for aenderung in [json!({"titel": "x"}), json!({"cost": null})] {
        assert_eq!(aendern(&lauf.adresse, 1, aenderung).await.0, 423);
    }
    assert_eq!((datei(tmp.path(), 1), git(tmp.path(), &["rev-list", "--count", "HEAD"])), vorher, "Datei byte-gleich, kein Commit");
}

// Die OpenAPI und die Endpunktliste nennen das neue Feld der Aufgabe
#[tokio::test]
async fn openapi_beschreibt_kosteneintraege() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d: Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse)).await.unwrap().json().await.unwrap();
    let schemas = &d["components"]["schemas"];
    assert!(schemas["Aufgabe"]["properties"]["kosteneintraege"].to_string().contains("#/components/schemas/Kosteneintrag"), "{}", schemas["Aufgabe"]["properties"]["kosteneintraege"]);
    for feld in ["at", "role", "column", "amount", "currency", "tokens", "kennung"] {
        assert!(schemas["Kosteneintrag"]["properties"][feld].is_object(), "Kosteneintrag.{feld}: {}", schemas["Kosteneintrag"]);
    }
    assert_eq!(schemas["Kosteneintrag"]["required"], json!(["at", "role", "column", "amount", "currency", "kennung"]));
    let beschreibung = d["paths"]["/api/aufgaben/{nr}"]["get"]["description"].as_str().unwrap();
    assert!(beschreibung.contains("kosteneintraege: [{at, role, column, amount, currency, tokens?, kennung}]"), "{beschreibung}");
}
