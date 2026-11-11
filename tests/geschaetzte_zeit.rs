// R00129 B0610: Geschätzte Zeit über die API — PATCH einzeln und /mehrere, GET, defekte Datei, OpenAPI.
// Akzeptanzkriterien aus US-1..US-3; ADR-0023: eine Prüfung für Datei und API, jeder Fehler 400 (nie 422, nie 500).
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{json, Value};
use std::path::Path;

/// Board „fabrik“ mit Eingang, In Arbeit, Fertig; #1 und #4 in Eingang, #2 in In Arbeit, #3 in Fertig — noch ohne Schätzung.
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

const MELDUNG: &str = "estimate: ganze Zahl von Minuten ≥ 1 erwartet";

async fn schaetzung_setzen(adresse: &str, n: u32, estimate: Value) -> (u16, Value) {
    senden(
        Method::PATCH,
        adresse,
        &format!("api/aufgaben/{n}"),
        "st",
        json!({ "estimate": estimate }),
    )
    .await
}

async fn holen(adresse: &str, n: u32) -> (u16, Value) {
    let r = reqwest::get(format!("{adresse}api/aufgaben/{n}"))
        .await
        .unwrap();
    (r.status().as_u16(), r.json().await.unwrap())
}

// US-1/AK „Schätzung setzen und lesen“: setzen bringt genau einen Commit, die Datei trägt estimate, GET liefert die Zahl;
// derselbe Wert ändert nichts. US-2-Grenzwerte: 1 und 100000, der kürzeste Zahltext.
#[tokio::test]
async fn setzen_ergibt_einen_commit_und_get_liefert_die_zahl() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let vorher = commits(tmp.path());

    let (s, a) = schaetzung_setzen(&lauf.adresse, 1, json!(150)).await;
    assert_eq!((s, a["estimate"].as_u64()), (200, Some(150)), "{a}");
    assert_eq!(
        (commits(tmp.path()), letzter_commit(tmp.path())),
        (vorher + 1, "#1 geändert: Geschätzte Zeit".to_string())
    );
    assert!(datei(tmp.path(), 1).contains("estimate: 150\n"), "{}", datei(tmp.path(), 1));
    assert_eq!(holen(&lauf.adresse, 1).await.1["estimate"], json!(150));

    assert_eq!(schaetzung_setzen(&lauf.adresse, 1, json!(150)).await.0, 200);
    assert_eq!(commits(tmp.path()), vorher + 1, "derselbe Wert: kein Commit");

    for (wert, text) in [(1_u64, "estimate: 1\n"), (100_000, "estimate: 100000\n")] {
        assert_eq!(schaetzung_setzen(&lauf.adresse, 1, json!(wert)).await.0, 200, "{wert}");
        assert!(datei(tmp.path(), 1).contains(text), "{wert}: {}", datei(tmp.path(), 1));
        assert_eq!(holen(&lauf.adresse, 1).await.1["estimate"], json!(wert));
    }

    // Leerfall: #4 hat keine Schätzung, GET liefert null
    assert_eq!(holen(&lauf.adresse, 4).await.1["estimate"], Value::Null);
    assert_eq!(datei(tmp.path(), 4), "---\nid: 4\ntitle: a4\n---\n");
}

// US-2: ersetzen, Titeländerung lässt die Schätzung, null entfernt sie mit einem Commit, /mehrere setzt für zwei in einem Commit.
#[tokio::test]
async fn ersetzen_entfernen_und_mehrere() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    schaetzung_setzen(&lauf.adresse, 1, json!(150)).await;
    let vorher = commits(tmp.path());

    assert_eq!(schaetzung_setzen(&lauf.adresse, 1, json!(90)).await.0, 200);
    assert!(datei(tmp.path(), 1).contains("estimate: 90\n"), "{}", datei(tmp.path(), 1));
    assert_eq!(
        (commits(tmp.path()), letzter_commit(tmp.path())),
        (vorher + 1, "#1 geändert: Geschätzte Zeit".to_string())
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
    assert!(
        datei_ueber_titel(tmp.path()).contains("title: neu\nestimate: 90\n"),
        "Titeländerung lässt estimate: {}",
        datei_ueber_titel(tmp.path())
    );

    let (s, a) = schaetzung_setzen(&lauf.adresse, 1, Value::Null).await;
    assert_eq!((s, &a["estimate"]), (200, &Value::Null));
    assert!(
        !datei_ueber_titel(tmp.path()).contains("estimate"),
        "null entfernt den Schlüssel: {}",
        datei_ueber_titel(tmp.path())
    );
    assert_eq!(
        (commits(tmp.path()), letzter_commit(tmp.path())),
        (vorher + 3, "#1 geändert: Geschätzte Zeit".to_string())
    );
    assert_eq!(schaetzung_setzen(&lauf.adresse, 1, Value::Null).await.0, 200);
    assert_eq!(commits(tmp.path()), vorher + 3, "nichts zu entfernen: kein Commit");

    // /mehrere: #1 und #4 auf 30 in einem Commit
    let (s, r) = senden(
        Method::PATCH,
        &lauf.adresse,
        "api/aufgaben/mehrere",
        "st",
        json!({"aenderungen": [
            {"nummer": 1, "estimate": 30},
            {"nummer": 4, "estimate": 30}
        ]}),
    )
    .await;
    assert_eq!((s, r[0]["estimate"].as_u64(), r[1]["estimate"].as_u64()), (200, Some(30), Some(30)), "{r}");
    assert_eq!(
        (commits(tmp.path()), letzter_commit(tmp.path())),
        (vorher + 4, "#1, #4 geändert: Geschätzte Zeit (2 Aufgaben)".to_string())
    );
    assert!(datei_ueber_titel(tmp.path()).contains("estimate: 30\n"));
    assert!(datei(tmp.path(), 4).contains("estimate: 30\n"));
}

/// Der Dateiname von #1 folgt dem geänderten Titel nicht (die Nummer bleibt der Schlüssel) — gelesen wird über das Verzeichnis.
fn datei_ueber_titel(pfad: &Path) -> String {
    let name = std::fs::read_dir(pfad.join("aufgaben"))
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .find(|n| n.starts_with("0001-"))
        .unwrap();
    lies(pfad, &format!("aufgaben/{name}"))
}

// US-3 und AK „Ungültige Werte“: jeder Fehlfall 400 mit derselben Meldung (nie 422, nie 500), Datei byte-gleich, Commits gleich.
#[tokio::test]
async fn fehlfaelle_sind_400_und_aendern_nichts() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    schaetzung_setzen(&lauf.adresse, 1, json!(150)).await;
    let (eins, vier, vorher) = (datei(tmp.path(), 1), datei(tmp.path(), 4), commits(tmp.path()));

    for falsch in [
        json!("2:30"),
        json!("150"),
        json!(150.0),
        json!(2.5),
        json!(0),
        json!(-1),
        json!(100001),
        json!(".inf"),
        json!(".nan"),
        json!(true),
        json!([1]),
        json!({"minuten": 1}),
    ] {
        let (s, a) = schaetzung_setzen(&lauf.adresse, 1, falsch.clone()).await;
        assert_eq!((s, a["fehler"].as_str()), (400, Some(MELDUNG)), "{falsch}");
        assert_eq!(
            (datei(tmp.path(), 1), commits(tmp.path())),
            (eins.clone(), vorher),
            "{falsch}: Datei byte-gleich, Commits gleich"
        );
    }

    // /mehrere: #1 und #4 mit einer ungültigen Schätzung → 400, keine der beiden Dateien ändert sich
    let (s, a) = senden(
        Method::PATCH,
        &lauf.adresse,
        "api/aufgaben/mehrere",
        "st",
        json!({"aenderungen": [
            {"nummer": 4, "estimate": 30},
            {"nummer": 1, "estimate": 0}
        ]}),
    )
    .await;
    let erwartet = format!("#1: {MELDUNG}");
    assert_eq!((s, a["fehler"].as_str()), (400, Some(erwartet.as_str())));
    assert_eq!(
        (datei(tmp.path(), 1), datei(tmp.path(), 4), commits(tmp.path())),
        (eins.clone(), vier.clone(), vorher)
    );

    // fehlendes Feld lässt unverändert: nur der Titel ändert sich
    let (s, _) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/1", "st", json!({"titel": "noch neu"})).await;
    assert_eq!(s, 200);
    assert!(datei_ueber_titel(tmp.path()).contains("estimate: 150\n"));
}

// US-3/AK „defekte Dateien“: eine von Hand geschriebene estimate-Form ist defekt (423) und nur lesbar; estimate: 3 gilt als drei Minuten und bleibt beim Schreiben zeichengleich; eine Aufgabe ohne estimate bleibt beim Ändern byte-gleich.
#[tokio::test]
async fn von_hand_geschriebene_dateien() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path());
    std::fs::write(
        tmp.path().join("aufgaben/0009-a9.md"),
        "---\nid: 9\ntitle: a9\nestimate: 2:30\n---\n",
    )
    .unwrap();
    std::fs::write(
        tmp.path().join("aufgaben/0010-a10.md"),
        "---\nid: 10\ntitle: a10\nestimate: 3\n---\n",
    )
    .unwrap();
    std::fs::write(
        tmp.path().join("aufgaben/0011-a11.md"),
        "---\nid: 11\ntitle: a11\n---\n",
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
    assert!(defekt["fehler"].as_str().unwrap().contains(MELDUNG), "{defekt}");
    let vorher = commits(tmp.path());
    let (s, _) = schaetzung_setzen(&lauf.adresse, 9, json!(150)).await;
    assert_eq!((s, commits(tmp.path())), (423, vorher), "nur lesbar");

    // estimate: 3 ist drei Minuten und bleibt beim Schreiben zeichengleich
    let (s, a) = holen(&lauf.adresse, 10).await;
    assert_eq!((s, a["estimate"].as_u64()), (200, Some(3)));
    let (s, _) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/10", "st", json!({"titel": "zehn"})).await;
    assert_eq!(s, 200);
    let zehn = lies(tmp.path(), "aufgaben/0010-a10.md");
    assert!(zehn.contains("title: zehn\nestimate: 3\n"), "{zehn}");

    // eine von Hand geschriebene Aufgabe ohne estimate bleibt bis auf die Titelzeile byte-gleich
    let ohne = lies(tmp.path(), "aufgaben/0011-a11.md");
    let (s, _) = senden(Method::PATCH, &lauf.adresse, "api/aufgaben/11", "st", json!({"titel": "elf"})).await;
    assert_eq!(s, 200);
    let elf = lies(tmp.path(), "aufgaben/0011-a11.md");
    assert_eq!(elf, ohne.replace("title: a11", "title: elf"), "keine neue Zeile für die Schätzung");
}

// ADR-0023 Entscheidung 5: die OpenAPI beschreibt estimate als ganze Zahl in derselben Aufgabenaenderung wie cost, samt 400.
#[tokio::test]
async fn openapi_beschreibt_estimate() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d: Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse))
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let schemas = &d["components"]["schemas"];
    let ganzzahlig = |s: &Value| s["type"] == json!("integer") || s["type"].as_array().is_some_and(|a| a.contains(&json!("integer")));
    let aenderung = &schemas["Aufgabenaenderung"]["properties"]["estimate"];
    assert!(aenderung.is_object(), "{aenderung}");
    assert!(ganzzahlig(aenderung), "{aenderung}");
    let ganz = &schemas["Aufgabe"]["properties"]["estimate"];
    assert!(ganz.is_object(), "{ganz}");
    assert!(ganzzahlig(ganz), "{ganz}");
    let patch = &d["paths"]["/api/aufgaben/{nr}"]["patch"];
    assert!(patch["responses"]["400"].is_object());
    assert!(patch["description"].as_str().unwrap().contains("estimate?"), "{}", patch["description"]);
}
