// R00105 B0366: Preisetikett über die API — PATCH einzeln und /mehrere, GET, defekte Datei, OpenAPI
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{json, Value};
use std::path::Path;

const SPANNE: &str = r#"{"currency":"USD","min":0.6,"max":1.6,"basis":"Schätzung planer"}"#;
const SPANNE_IN_DER_DATEI: &str =
    "cost:\n  currency: USD\n  min: 0.60\n  max: 1.60\n  basis: Schätzung planer\n";

/// Board „fabrik“ mit Eingang, In Arbeit, Fertig; #1 und #4 in Eingang, #2 in In Arbeit, #3 in Fertig — noch ohne Etikett.
fn fabrik(pfad: &Path) {
    gemeinsam::eingerichtet(pfad);
    std::fs::create_dir_all(pfad.join("aufgaben")).unwrap();
    for n in 1..=4 {
        std::fs::write(
            pfad.join(format!("aufgaben/000{n}-a{n}.md")),
            format!("---\nid: {n}\ntitle: a{n}\n---\n"),
        )
        .unwrap();
    }
    std::fs::write(
        pfad.join("boards/fabrik.md"),
        "# Fabrik\n\n## Eingang\n\n- [#1](../aufgaben/0001-a1.md)\n- [#4](../aufgaben/0004-a4.md)\n\n## In Arbeit\n\n- [#2](../aufgaben/0002-a2.md)\n\n## Fertig\n\n- [#3](../aufgaben/0003-a3.md)\n",
    )
    .unwrap();
    git(pfad, &["add", "-A"]);
    git(
        pfad,
        &[
            "-c",
            "user.name=V",
            "-c",
            "user.email=v@v",
            "commit",
            "-q",
            "-m",
            "Fabrik",
        ],
    );
}

fn commits(pfad: &Path) -> usize {
    git(pfad, &["rev-list", "--count", "HEAD"]).parse().unwrap()
}

fn letzter_commit(pfad: &Path) -> String {
    git(pfad, &["log", "-1", "--format=%s"])
}

fn datei(pfad: &Path, n: u32) -> String {
    lies(pfad, &format!("aufgaben/000{n}-a{n}.md"))
}

async fn kosten_setzen(adresse: &str, n: u32, cost: Value) -> (u16, Value) {
    senden(
        Method::PATCH,
        adresse,
        &format!("api/aufgaben/{n}"),
        "st",
        json!({ "cost": cost }),
    )
    .await
}

async fn holen(adresse: &str, n: u32) -> (u16, Value) {
    let r = reqwest::get(format!("{adresse}api/aufgaben/{n}"))
        .await
        .unwrap();
    (r.status().as_u16(), r.json().await.unwrap())
}

fn roh(json: &str) -> Value {
    serde_json::from_str(json).unwrap()
}

// AK „Kosten setzen“: Spanne mit Basis, Betrag; GET in den Schlüsseln der Datei, Geldwerte als JSON-Zahl in Dollar
#[tokio::test]
async fn setzen_ergibt_einen_commit_und_get_liefert_dollar() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());

    let (s, a) = kosten_setzen(&lauf.adresse, 1, roh(SPANNE)).await;
    assert_eq!((s, &a["cost"]), (200, &roh(SPANNE)), "{a}");
    assert_eq!(
        (commits(tmp.path()), letzter_commit(tmp.path())),
        (vorher + 1, "#1 geändert: Kosten".to_string())
    );
    assert_eq!(
        datei(tmp.path(), 1),
        format!("---\nid: 1\ntitle: a1\n{SPANNE_IN_DER_DATEI}---\n")
    );
    assert_eq!(holen(&lauf.adresse, 1).await.1["cost"], roh(SPANNE));

    assert_eq!(
        kosten_setzen(&lauf.adresse, 2, json!({"currency": "USD", "amount": 1.63}))
            .await
            .0,
        200
    );
    assert_eq!(
        holen(&lauf.adresse, 2).await.1["cost"],
        json!({"currency": "USD", "amount": 1.63})
    );
    assert!(datei(tmp.path(), 2).contains("cost:\n  currency: USD\n  amount: 1.63\n"));

    let positionen = json!({"currency": "USD", "basis": "Schätzung planer", "items": [
        {"text": "Planung", "min": 0.1, "max": 0.2, "tokens": 12000},
        {"text": "Bau", "min": 0.2, "max": 0.4},
        {"text": "Gemeinkostenanteil", "amount": 0.3}
    ]});
    assert_eq!(
        kosten_setzen(&lauf.adresse, 3, positionen.clone()).await.0,
        200
    );
    assert_eq!(holen(&lauf.adresse, 3).await.1["cost"], positionen);

    let (s, ohne) = holen(&lauf.adresse, 4).await;
    assert_eq!(
        (s, &ohne["cost"]),
        (200, &Value::Null),
        "Leerfall: kein Etikett"
    );
    assert_eq!(datei(tmp.path(), 4), "---\nid: 4\ntitle: a4\n---\n");
}

// US-7: denselben Wert setzen, Betrag ersetzt Spanne, Titeländerung lässt den Abschnitt, null entfernt ihn
#[tokio::test]
async fn ersetzen_und_entfernen() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    kosten_setzen(&lauf.adresse, 1, roh(SPANNE)).await;
    let vorher = commits(tmp.path());

    assert_eq!(kosten_setzen(&lauf.adresse, 1, roh(SPANNE)).await.0, 200);
    assert_eq!(commits(tmp.path()), vorher, "derselbe Wert: kein Commit");

    assert_eq!(
        kosten_setzen(&lauf.adresse, 1, json!({"currency": "USD", "amount": 1.1}))
            .await
            .0,
        200
    );
    assert_eq!(
        (commits(tmp.path()), letzter_commit(tmp.path())),
        (vorher + 1, "#1 geändert: Kosten".to_string())
    );
    let betrag = datei(tmp.path(), 1);
    assert!(
        betrag.contains("cost:\n  currency: USD\n  amount: 1.10\n---\n"),
        "{betrag}"
    );
    assert!(
        !betrag.contains("min:") && !betrag.contains("basis:"),
        "ersetzt, nicht gemischt: {betrag}"
    );

    let (s, _) = senden(
        Method::PATCH,
        &lauf.adresse,
        "api/aufgaben/1",
        "st",
        json!({"titel": "neu"}),
    )
    .await;
    assert_eq!(s, 200);
    assert_eq!(
        datei_nach_titel(tmp.path()),
        betrag.replace("title: a1", "title: neu"),
        "Abschnitt unverändert"
    );

    let (s, a) = kosten_setzen(&lauf.adresse, 1, Value::Null).await;
    assert_eq!((s, &a["cost"]), (200, &Value::Null));
    assert_eq!(
        (commits(tmp.path()), letzter_commit(tmp.path())),
        (vorher + 3, "#1 geändert: Kosten".to_string())
    );
    assert_eq!(
        datei_nach_titel(tmp.path()),
        "---\nid: 1\ntitle: neu\n---\n"
    );
    assert_eq!(kosten_setzen(&lauf.adresse, 1, Value::Null).await.0, 200);
    assert_eq!(
        commits(tmp.path()),
        vorher + 3,
        "nichts zu entfernen: kein Commit"
    );
}

/// Der Dateiname folgt dem Titel nicht (die Nummer bleibt der Schlüssel) — gelesen wird über das Verzeichnis.
fn datei_nach_titel(pfad: &Path) -> String {
    let name = std::fs::read_dir(pfad.join("aufgaben"))
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .find(|n| n.starts_with("0001-"))
        .unwrap();
    lies(pfad, &format!("aufgaben/{name}"))
}

// US-6 und AK-Grenzwerte: jeder Fehlfall 400 (nie 422, nie 500), Datei byte-gleich, Zahl der Commits gleich
#[tokio::test]
async fn fehlfaelle_sind_400_und_aendern_nichts() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    kosten_setzen(&lauf.adresse, 1, roh(SPANNE)).await;
    let (eins, vier, vorher) = (
        datei(tmp.path(), 1),
        datei(tmp.path(), 4),
        commits(tmp.path()),
    );

    let mehr_als_hundert = json!({"currency": "USD", "items": (0..101).map(|i| json!({"text": format!("p{i}"), "amount": 0.01})).collect::<Vec<_>>()});
    for (cost, meldung) in [
        (json!({"amount": 1.63}), "cost: currency fehlt"),
        (
            json!({"currency": "usd", "amount": 1.63}),
            "cost.currency: genau drei Großbuchstaben A–Z",
        ),
        (
            json!({"currency": "USD", "amount": "1.63"}),
            "cost.amount: keine Zahl",
        ),
        (
            json!({"currency": "USD", "amount": true}),
            "cost.amount: keine Zahl",
        ),
        (
            json!({"currency": "USD", "amount": 1.005}),
            "cost.amount: Zahl ≥ 0 mit höchstens zwei Nachkommastellen erwartet",
        ),
        (
            json!({"currency": "USD", "amount": -1}),
            "cost.amount: Zahl ≥ 0 mit höchstens zwei Nachkommastellen erwartet",
        ),
        (
            json!({"currency": "USD", "amount": 1.63, "min": 0.6, "max": 1.6}),
            "cost: amount zusammen mit min/max",
        ),
        (
            json!({"currency": "USD", "min": 1.6, "max": 0.6}),
            "cost: min > max",
        ),
        (
            json!({"currency": "USD", "items": [{"text": "a", "amount": 1}, {"text": "b", "min": 1.6, "max": 0.6}]}),
            "cost.items[1]: min > max",
        ),
        (
            json!({"currency": "USD", "amount": 1, "items": [{"text": "a", "amount": 1}]}),
            "cost: items zusammen mit amount, min oder max",
        ),
        (
            json!({"currency": "USD", "items": []}),
            "cost.items: mindestens eine Position",
        ),
        (
            json!({"currency": "USD", "items": [{"text": "   ", "amount": 1}]}),
            "cost.items[0].text: leer",
        ),
        (
            json!({"currency": "USD", "ammount": 1.63}),
            "cost: unbekannter Schlüssel „ammount“",
        ),
        (
            json!({"currency": "USD", "amount": 1000000.01}),
            "cost.amount: höchstens 1000000.00",
        ),
        (mehr_als_hundert, "cost.items: höchstens 100 Positionen"),
        (json!("1.63"), "cost: keine Zuordnung"),
    ] {
        let (s, a) = kosten_setzen(&lauf.adresse, 1, cost.clone()).await;
        assert_eq!((s, a["fehler"].as_str()), (400, Some(meldung)), "{cost}");
        assert_eq!(
            (datei(tmp.path(), 1), commits(tmp.path())),
            (eins.clone(), vorher),
            "{cost}: Datei byte-gleich, Commits gleich"
        );
    }

    // /mehrere: #1 und #4 mit „usd“ → 400, keine der beiden Dateien geändert
    let (s, a) = senden(
        Method::PATCH,
        &lauf.adresse,
        "api/aufgaben/mehrere",
        "st",
        json!({"aenderungen": [
            {"nummer": 4, "cost": {"currency": "USD", "amount": 1}},
            {"nummer": 1, "cost": {"currency": "usd", "amount": 1}}
        ]}),
    )
    .await;
    assert_eq!(
        (s, a["fehler"].as_str()),
        (
            400,
            Some("#1: cost.currency: genau drei Großbuchstaben A–Z")
        )
    );
    assert_eq!(
        (
            datei(tmp.path(), 1),
            datei(tmp.path(), 4),
            commits(tmp.path())
        ),
        (eins, vier, vorher)
    );

    // Grenzwerte: was gerade noch geht, geht
    let hundert = json!({"currency": "USD", "items": (0..100).map(|i| json!({"text": format!("p{i}"), "amount": 0.01})).collect::<Vec<_>>()});
    for cost in [
        json!({"currency": "USD", "amount": 1000000.00}),
        json!({"currency": "USD", "amount": 0}),
        hundert,
        json!({"currency": "USD", "items": [{"text": "a", "amount": 600000.00}, {"text": "b", "amount": 600000.00}]}),
    ] {
        assert_eq!(
            kosten_setzen(&lauf.adresse, 1, cost.clone()).await.0,
            200,
            "{cost}"
        );
    }
    assert!(datei(tmp.path(), 1).contains("  - {text: b, amount: 600000.00}\n"));

    let (s, r) = senden(
        Method::PATCH,
        &lauf.adresse,
        "api/aufgaben/mehrere",
        "st",
        json!({"aenderungen": [
            {"nummer": 1, "cost": {"currency": "USD", "amount": 1000000.00}},
            {"nummer": 4, "cost": {"currency": "EUR", "amount": 25.55}}
        ]}),
    )
    .await;
    assert_eq!(
        (s, &r[1]["cost"]),
        (200, &json!({"currency": "EUR", "amount": 25.55}))
    );
    assert_eq!(
        letzter_commit(tmp.path()),
        "#1, #4 geändert: Kosten (2 Aufgaben)"
    );
}

// US-8: von Hand geschriebene Dateien — formwidrig ist defekt, unbekannte Schlüssel bleiben und gehen nicht über GET hinaus
#[tokio::test]
async fn von_hand_geschriebene_dateien() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    std::fs::write(
        tmp.path().join("aufgaben/0009-a9.md"),
        "---\nid: 9\ntitle: a9\ncost: {amount: 1.63}\n---\n",
    )
    .unwrap();
    std::fs::write(
        tmp.path().join("aufgaben/0010-a10.md"),
        "---\nid: 10\ntitle: a10\ncost: {currency: USD, amount: 1.00, note: x}\n---\n",
    )
    .unwrap();
    git(tmp.path(), &["add", "-A"]);
    git(
        tmp.path(),
        &[
            "-c",
            "user.name=V",
            "-c",
            "user.email=v@v",
            "commit",
            "-q",
            "-m",
            "von Hand",
        ],
    );
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);

    let (s, defekt) = holen(&lauf.adresse, 9).await;
    assert_eq!(s, 423);
    assert!(
        defekt["fehler"]
            .as_str()
            .unwrap()
            .contains("cost: currency fehlt"),
        "{defekt}"
    );
    let vorher = commits(tmp.path());
    let (s, _) = kosten_setzen(&lauf.adresse, 9, json!({"currency": "USD", "amount": 1.63})).await;
    assert_eq!((s, commits(tmp.path())), (423, vorher), "nur lesbar");

    assert_eq!(
        holen(&lauf.adresse, 10).await.1["cost"],
        json!({"currency": "USD", "amount": 1.0}),
        "ohne unbekannte Schlüssel"
    );
    let (s, _) = senden(
        Method::PATCH,
        &lauf.adresse,
        "api/aufgaben/10",
        "st",
        json!({"titel": "zehn"}),
    )
    .await;
    assert_eq!(s, 200);
    let zehn = lies(tmp.path(), "aufgaben/0010-a10.md");
    assert!(
        zehn.contains("title: zehn\n") && zehn.contains("  note: x\n"),
        "{zehn}"
    );
}

// ADR-0009 Entscheidung 5: die OpenAPI beschreibt cost mit eigenem Schema, in der Aufgabe und in der Änderung
#[tokio::test]
async fn openapi_beschreibt_cost() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d: Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse))
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let schemas = &d["components"]["schemas"];
    let verweis = |schema: &str| schemas[schema]["properties"]["cost"].to_string();
    assert!(
        verweis("Aufgabenaenderung").contains("#/components/schemas/Kosten"),
        "{}",
        verweis("Aufgabenaenderung")
    );
    assert!(
        verweis("Aufgabe").contains("#/components/schemas/Kosten"),
        "{}",
        verweis("Aufgabe")
    );
    let kosten = &schemas["Kosten"]["properties"];
    for feld in ["currency", "amount", "min", "max", "basis", "items"] {
        assert!(
            kosten[feld].is_object(),
            "Kosten.{feld}: {}",
            schemas["Kosten"]
        );
    }
    assert!(
        schemas["Kostenposition"]["properties"]["tokens"].is_object(),
        "{}",
        schemas["Kostenposition"]
    );
    assert_eq!(schemas["Kosten"]["required"], json!(["currency"]));
    let patch = &d["paths"]["/api/aufgaben/{nr}"]["patch"];
    assert!(
        patch["responses"]["400"].is_object()
            && patch["description"].as_str().unwrap().contains("cost?")
    );
}
