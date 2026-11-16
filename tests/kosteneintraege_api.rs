// R00165 Teil B (I0154, ADR-0028 Punkt 5): Kosteneintrag über die API anlegen, ändern und löschen
mod gemeinsam;

use gemeinsam::{git, lies, senden};
use reqwest::Method;
use serde_json::{json, Value};
use std::path::Path;

const EINTRAG: &str = "  - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, amount: 3.46, currency: USD}\n";
const ZWEITER: &str = "  - {at: 2026-11-13 11:02+01:00, role: entwickler, column: Entwicklung, amount: 1.20, currency: USD}\n";
const KENNUNG: &str = "entwickler@2026-11-13T10:34+01:00";
const ALTE_POSTEN: &str = "cost:\n  currency: USD\n  items:\n    - {text: Planung, min: 0.10, max: 0.20}\n    - {text: Bau, amount: 0.30}\n";
/// Ein Eintrag einer anderen Rolle mit Tokens und einem Schlüssel, den kanbanD nicht kennt.
const FREMDER: &str = "  - {at: 2026-11-12 09:00+01:00, role: planer, column: Eingang, amount: 0.75, currency: EUR, tokens: 81234, note: von Hand}\n";

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
    ueberlagert(beispiel(), &angaben)
}

fn ueberlagert(mut basis: Value, angaben: &Value) -> Value {
    for (k, v) in angaben.as_object().unwrap() {
        basis[k] = v.clone();
    }
    basis
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

/// #1 mit alten Posten und drei Einträgen: dem fremden, dem des Beispiels und dem zweiten Lauf.
fn mit_bestand(pfad: &Path) -> gemeinsam::Laufendes {
    fabrik(pfad, &format!("{ALTE_POSTEN}cost-entries:\n{FREMDER}{EINTRAG}{ZWEITER}"));
    gemeinsam::starten_in_berlin(pfad, &["--port", "0"])
}

fn bestand(eintraege: &str) -> String {
    format!("---\nid: 1\ntitle: a1\n{ALTE_POSTEN}cost-entries:\n{eintraege}---\n")
}

// B0797 · AK 5: PATCH schreibt amount: 3.50, DELETE entfernt den Eintrag — je ein Commit; Schutz des Nutzers: die
// alten Posten und alle übrigen Einträge (auch Unbekanntes darin) stehen danach zeichengleich in der Datei
#[tokio::test]
async fn aendern_und_loeschen_je_ein_commit_und_alles_uebrige_zeichengleich() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = mit_bestand(tmp.path());
    let vorher = commits(tmp.path());

    let (s, a) = senden(Method::PATCH, &lauf.adresse, &pfad(KENNUNG), "cl", json!({"amount": 3.50})).await;
    assert_eq!(s, 200, "{a}");
    assert_eq!(a["kosteneintraege"][1], beispiel_mit(json!({"amount": 3.5, "kennung": KENNUNG})));
    assert_eq!(datei(tmp.path()), bestand(&format!("{FREMDER}{}{ZWEITER}", EINTRAG.replace("amount: 3.46", "amount: 3.50"))));
    assert_eq!(commits(tmp.path()), vorher + 1, "ein Commit");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Claude|#1 Kosteneintrag geändert: 3,50 USD (entwickler, Entwicklung)");

    let (s, a) = senden(Method::PATCH, &lauf.adresse, &pfad(KENNUNG), "cl", json!({"amount": 3.50})).await;
    assert_eq!((s, commits(tmp.path())), (200, vorher + 1), "ohne Änderung kein Commit: {a}");

    let (s, a) = senden(Method::DELETE, &lauf.adresse, &pfad(KENNUNG), "cl", json!(null)).await;
    assert_eq!(s, 200, "{a}");
    assert_eq!(datei(tmp.path()), bestand(&format!("{FREMDER}{ZWEITER}")), "genau der eine ist weg");
    assert_eq!(commits(tmp.path()), vorher + 2, "ein Commit");
    assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an|%s"]), "Claude|#1 Kosteneintrag gelöscht: 3,50 USD (entwickler, Entwicklung)");
    let kennungen: Vec<Value> = holen(&lauf.adresse).await["kosteneintraege"].as_array().unwrap().iter().map(|e| e["kennung"].clone()).collect();
    assert_eq!(kennungen, [json!("planer@2026-11-12T09:00+01:00"), json!("entwickler@2026-11-13T11:02+01:00")], "GET liefert ihn nicht mehr");
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "");
}

// Schutz des Nutzers · US-2: auch das Anlegen lässt alte Posten und übrige Einträge zeichengleich; ohne currency gilt cost.currency
#[tokio::test]
async fn anlegen_neben_alten_posten_nimmt_deren_waehrung_und_laesst_alles_stehen() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = mit_bestand(tmp.path());
    let mut rumpf = beispiel_mit(json!({"at": "2026-11-13T11:30:00Z", "role": " code reviewer ", "column": "Fertig", "amount": 0, "tokens": 12}));
    rumpf.as_object_mut().unwrap().remove("currency");
    let (s, a) = anlegen(&lauf.adresse, "st", rumpf).await;
    assert_eq!(s, 200, "{a}");
    let neu = "  - {at: 2026-11-13 12:30+01:00, role: code reviewer, column: Fertig, amount: 0.00, currency: USD, tokens: 12}\n";
    assert_eq!(datei(tmp.path()), bestand(&format!("{FREMDER}{EINTRAG}{ZWEITER}{neu}")), "in Ortszeit mit Versatz, Rolle getrimmt");
    assert_eq!(a["kosteneintraege"][3]["kennung"], "code reviewer@2026-11-13T12:30+01:00");
}

// B0797 · AK 4 · US-4: derselbe Aufruf ein zweites Mal → 409, nichts geschrieben; unbekannte Kennung → 404
#[tokio::test]
async fn gleiche_kennung_ist_409_und_unbekannte_kennung_404() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), "");
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    assert_eq!(anlegen(&lauf.adresse, "cl", beispiel()).await.0, 200);
    let vorher = stand(tmp.path());

    let (s, f) = anlegen(&lauf.adresse, "cl", beispiel()).await;
    assert_eq!(s, 409, "{f}");
    let meldung = f["fehler"].as_str().unwrap();
    assert!(meldung.contains(KENNUNG) && meldung.contains("eine Minute später eintragen"), "{meldung}");
    assert_eq!(anlegen(&lauf.adresse, "st", beispiel_mit(json!({"amount": 9, "column": "Fertig", "at": "2026-11-13T09:34Z"}))).await.0, 409, "derselbe Moment, dieselbe Rolle");

    let niemand = pfad("niemand@2026-11-13T10:34+01:00");
    assert_eq!(senden(Method::PATCH, &lauf.adresse, &niemand, "cl", json!({"amount": 1})).await.0, 404);
    assert_eq!(senden(Method::DELETE, &lauf.adresse, &niemand, "cl", json!(null)).await.0, 404);
    // PATCH auf eine belegte Kennung
    assert_eq!(anlegen(&lauf.adresse, "cl", beispiel_mit(json!({"role": "planer"}))).await.0, 200);
    let vorher_zwei = stand(tmp.path());
    let (s, f) = senden(Method::PATCH, &lauf.adresse, &pfad("planer@2026-11-13T10:34+01:00"), "cl", json!({"role": "entwickler"})).await;
    assert_eq!((s, stand(tmp.path())), (409, vorher_zwei.clone()), "{f}");
    assert_eq!(vorher_zwei.1, vorher.1 + 1, "bis dahin ist nur der planer dazugekommen");
}

// Sicherheit: die Kennung kommt aus der URL — kodiert und unkodiert trifft sie genau ihren Eintrag; verstümmelt,
// als Muster oder als Pfad trifft sie keinen (404), und die Datei bleibt, wie sie ist
#[tokio::test]
async fn kennung_aus_der_url_trifft_genau_ihren_eintrag_oder_keinen() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = mit_bestand(tmp.path());
    let vorher = stand(tmp.path());
    let basis = "api/aufgaben/1/kosteneintraege";
    for verstuemmelt in [
        "entwickler%402026-11-13T10%3A34%2B01%3A0",
        "entwickler%402026-11-13T10%3A34+01%3A00%20",
        "entwickler%402026-11-13T10%3A34%2001%3A00",
        "entwickler@2026-11-13T10:34",
        "entwickler",
        "entwickler%40",
        "Entwickler@2026-11-13T10:34+01:00",
        "entwickler%402026-11-13T10%3A34%2B01%3A00%2F..",
        "..%2Fentwickler%402026-11-13T10%3A34%2B01%3A00",
        "*",
        ".*",
        "%25",
        "%2A@%2A",
        "0",
        "entwickler@2026-11-13T10:34+01:00%0A",
        "%00",
    ] {
        for methode in [Method::PATCH, Method::DELETE] {
            let (s, f) = senden(methode.clone(), &lauf.adresse, &format!("{basis}/{verstuemmelt}"), "cl", json!({"amount": 0})).await;
            assert_eq!((s, f["fehler"].is_string()), (404, true), "{methode} {verstuemmelt}: {f}");
        }
    }
    assert_eq!(senden(Method::PATCH, &lauf.adresse, &format!("{basis}/%FF"), "cl", json!({"amount": 0})).await.0, 400, "kein UTF-8 im Pfad");
    assert_eq!(stand(tmp.path()), vorher, "keine verstümmelte Kennung hat etwas getroffen");

    // unkodiert (@, + und : wörtlich) und kodiert trifft dieselbe Kennung denselben Eintrag
    let (s, a) = senden(Method::PATCH, &lauf.adresse, &format!("{basis}/{KENNUNG}"), "cl", json!({"tokens": 1})).await;
    assert_eq!((s, &a["kosteneintraege"][1]["tokens"]), (200, &json!(1)), "{a}");
    let (s, a) = senden(Method::PATCH, &lauf.adresse, &pfad(KENNUNG), "cl", json!({"tokens": null})).await;
    assert_eq!(s, 200, "{a}");
    assert_eq!(datei(tmp.path()), vorher.0, "tokens: null entfernt den Wert wieder — die Datei steht wie am Anfang");
}

// Mensch und Agent schreiben wie bei Zeiteinträgen: jede eingetragene, aktive Person über X-KanbanD-Wer — sonst 400.
// Unbekannte Nummer → 404, defekte Datei → 423; nichts davon schreibt.
#[tokio::test]
async fn wer_schreiben_darf_und_404_und_423() {
    let tmp = tempfile::tempdir().unwrap();
    fabrik(tmp.path(), "");
    std::fs::write(tmp.path().join("aufgaben/0002-kaputt.md"), "---\nid: 2\ntitle: kaputt\ncost-entries:\n  - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, amount: abc, currency: USD}\n---\n").unwrap();
    git(tmp.path(), &["add", "-A"]);
    git(tmp.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "kaputt"]);
    let lauf = gemeinsam::starten_in_berlin(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let vorher = stand(tmp.path());
    let kaputt = lies(tmp.path(), "aufgaben/0002-kaputt.md");

    for wer in ["", "xx", "ab"] {
        assert_eq!(anlegen(a, wer, beispiel()).await.0, 400, "wer={wer:?}: fehlt, unbekannt oder stillgelegt");
        assert_eq!(senden(Method::DELETE, a, &pfad(KENNUNG), wer, json!(null)).await.0, 400, "wer={wer:?}");
    }
    for (methode, ziel) in [(Method::POST, "api/aufgaben/99/kosteneintraege".to_string()), (Method::PATCH, pfad(KENNUNG).replace("/1/", "/99/")), (Method::DELETE, pfad(KENNUNG).replace("/1/", "/99/"))] {
        assert_eq!(senden(methode.clone(), a, &ziel, "cl", beispiel()).await.0, 404, "{methode} {ziel}");
        assert_eq!(senden(methode.clone(), a, &ziel.replace("/99/", "/2/"), "cl", beispiel()).await.0, 423, "{methode} defekte Datei");
    }
    assert_eq!((stand(tmp.path()), lies(tmp.path(), "aufgaben/0002-kaputt.md")), (vorher.clone(), kaputt), "nichts geschrieben");

    // Mensch und Agent, beide über alle drei Routen
    for (wer, name, at) in [("st", "Stefan", "2026-11-13 10:34+01:00"), ("cl", "Claude", "2026-11-13 10:35+01:00")] {
        let kennung = format!("entwickler@{}", at.replace(' ', "T"));
        assert_eq!(anlegen(a, wer, beispiel_mit(json!({"at": at}))).await.0, 200, "{wer} legt an");
        assert_eq!(senden(Method::PATCH, a, &pfad(&kennung), wer, json!({"amount": 1})).await.0, 200, "{wer} ändert");
        assert_eq!(senden(Method::DELETE, a, &pfad(&kennung), wer, json!(null)).await.0, 200, "{wer} löscht");
        assert_eq!(git(tmp.path(), &["log", "-1", "--format=%an"]), name);
    }
    assert_eq!(datei(tmp.path()), vorher.0, "angelegt, geändert, gelöscht: die Datei steht wieder wie am Anfang");
}

// B0797: die drei Routen stehen in /api/endpunkte und in der OpenAPI — mit Rumpf, Kennung im Pfad und ihren Statuscodes
#[tokio::test]
async fn endpunktliste_und_openapi_beschreiben_die_drei_routen() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let liste: Value = reqwest::get(format!("{}api/endpunkte", lauf.adresse)).await.unwrap().json().await.unwrap();
    let d: Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse)).await.unwrap().json().await.unwrap();
    let seite = reqwest::get(format!("{}api", lauf.adresse)).await.unwrap().text().await.unwrap();
    for (methode, route, wort) in [("POST", "/api/aufgaben/{nr}/kosteneintraege", "eine Minute später"), ("PATCH", "/api/aufgaben/{nr}/kosteneintraege/{kennung}", "role@JJJJ-MM-TTTHH:MM±HH:MM"), ("DELETE", "/api/aufgaben/{nr}/kosteneintraege/{kennung}", "unbekannte Kennung → 404")] {
        let eintrag = liste.as_array().unwrap().iter().find(|e| e["methode"] == methode && e["pfad"] == route).unwrap_or_else(|| panic!("{methode} {route} fehlt in /api/endpunkte"));
        assert_eq!((&eintrag["wer"], &eintrag["thema"]), (&json!(true), &json!("Aufgaben")));
        let zweck = eintrag["zweck"].as_str().unwrap();
        assert!(zweck.contains(wort), "{zweck}");
        let op = &d["paths"][route][methode.to_lowercase()];
        assert_eq!(op["description"], eintrag["zweck"], "OpenAPI und Endpunktliste sagen dasselbe");
        for status in ["200", "400", "404", "409", "423"] {
            assert!(op["responses"][status].is_object(), "{methode} {route}: {status} fehlt");
        }
        assert!(op["responses"]["422"].is_null());
        assert_eq!(op["requestBody"].is_object(), methode != "DELETE", "{methode}: Rumpf");
        assert!(seite.contains(route), "/api nennt {route}");
    }
    let rumpf = &d["components"]["schemas"]["Kosteneintragsangaben"]["properties"];
    for feld in ["at", "role", "column", "amount", "currency", "tokens"] {
        assert!(rumpf[feld].is_object(), "Kosteneintragsangaben.{feld}");
    }
    assert!(rumpf["kennung"].is_null(), "die Kennung wird berechnet, nicht gesendet");
}

// B0798 · AK 3 · US-4: jede Abweisung ist 400 mit {fehler} und dem Feldnamen — nie 422 —, es entsteht kein Commit,
// und die Datei mit alten Posten und Einträgen ist danach byte-gleich. Jede Angabe läuft über POST (im Beispiel
// ersetzt) und über PATCH (allein, auf den bestehenden Eintrag).
#[tokio::test]
async fn jede_abweisung_ist_400_und_aendert_nichts() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = mit_bestand(tmp.path());
    let a = &lauf.adresse;
    let vorher = stand(tmp.path());
    let morgen = (chrono::Local::now() + chrono::Duration::days(1)).format("%Y-%m-%d %H:%M").to_string();
    let in_zwei_minuten = (chrono::Utc::now() + chrono::Duration::minutes(2)).format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let falsch = [
        (json!({"amount": -1}), "amount"),
        (json!({"amount": -0.01}), "amount"),
        (json!({"amount": 3.456}), "amount"),
        (json!({"amount": 1000000.01}), "amount"),
        (json!({"amount": 1e30}), "amount"),
        (json!({"amount": "3.46"}), "amount"),
        (json!({"amount": true}), "amount"),
        (json!({"amount": [1]}), "amount"),
        (json!({"column": "Gibtsnicht"}), "column"),
        (json!({"column": "In Arbeit"}), "column"),
        (json!({"column": "entwicklung"}), "column"),
        (json!({"column": "Entwicklung\n"}), "column"),
        (json!({"column": "Fertig\n- [#9](x)"}), "column"),
        (json!({"column": ""}), "column"),
        (json!({"column": 7}), "column"),
        (json!({"role": ""}), "role"),
        (json!({"role": "   "}), "role"),
        (json!({"role": "a@b"}), "role"),
        (json!({"role": "a\nb"}), "role"),
        (json!({"role": "a\u{0}b"}), "role"),
        (json!({"role": "r".repeat(61)}), "role"),
        (json!({"role": 7}), "role"),
        (json!({"at": "gestern"}), "at"),
        (json!({"at": "2026-11-13"}), "at"),
        (json!({"at": 12}), "at"),
        (json!({"at": morgen}), "at"),
        (json!({"at": in_zwei_minuten}), "at"),
        (json!({"at": "2999-01-01 00:00+01:00"}), "at"),
        (json!({"currency": "usd"}), "currency"),
        (json!({"currency": "USDX"}), "currency"),
        (json!({"currency": 7}), "currency"),
        (json!({"tokens": -1}), "tokens"),
        (json!({"tokens": 1.5}), "tokens"),
        (json!({"tokens": "viele"}), "tokens"),
        (json!({"kennung": KENNUNG}), "kennung"),
        (json!({"note": "x"}), "note"),
        (json!({"text": "Bau"}), "text"),
    ];
    let mut rot = vec![];
    for (angabe, feld) in &falsch {
        for (methode, ziel, rumpf) in [(Method::POST, "api/aufgaben/1/kosteneintraege".to_string(), ueberlagert(beispiel_mit(json!({"at": "2026-11-13 12:00+01:00"})), angabe)), (Method::PATCH, pfad(KENNUNG), angabe.clone())] {
            let (s, f) = senden(methode.clone(), a, &ziel, "cl", rumpf).await;
            if s != 400 || !f["fehler"].as_str().is_some_and(|m| m.contains(feld)) {
                rot.push(format!("{methode} {angabe}: {s} {f}"));
            }
        }
    }
    // ein Pflichtfeld fehlt (null gilt als fehlend)
    for feld in ["at", "role", "column", "amount"] {
        let mut rumpf = beispiel_mit(json!({"at": "2026-11-13 12:00+01:00"}));
        rumpf.as_object_mut().unwrap().remove(feld);
        let mut mit_null = rumpf.clone();
        mit_null[feld] = Value::Null;
        for rumpf in [rumpf, mit_null] {
            let (s, f) = anlegen(a, "cl", rumpf.clone()).await;
            if s != 400 || !f["fehler"].as_str().is_some_and(|m| m.contains(feld) && m.contains("fehlt")) {
                rot.push(format!("ohne {feld}: {s} {f}"));
            }
        }
    }
    // der Rumpf ist kein Objekt oder kein JSON
    for rumpf in ["[]", "\"x\"", "7", "null", "{", "", "{\"amount\": 1,}"] {
        for (methode, ziel) in [(Method::POST, "api/aufgaben/1/kosteneintraege".to_string()), (Method::PATCH, pfad(KENNUNG))] {
            let antwort = gemeinsam::senden_roh(methode.clone(), a, &ziel, "cl", Some("application/json"), rumpf).await;
            if antwort.status != 400 || !antwort.json()["fehler"].is_string() {
                rot.push(format!("{methode} Rumpf {rumpf:?}: {} {}", antwort.status, antwort.text));
            }
        }
    }
    assert!(rot.is_empty(), "{} Abweisungen falsch:\n{}", rot.len(), rot.join("\n"));
    assert_eq!(stand(tmp.path()), vorher, "kein Commit, keine offene Änderung, Datei byte-gleich");
    assert_eq!(holen(a).await["kosteneintraege"].as_array().map(Vec::len), Some(3), "die Aufgabe ist weiter lesbar");

    // ohne currency und ohne cost.currency der Aufgabe: 400
    let ohne = tempfile::tempdir().unwrap();
    fabrik(ohne.path(), "");
    let lauf = gemeinsam::starten_in_berlin(ohne.path(), &["--port", "0"]);
    let vorher = stand(ohne.path());
    let mut rumpf = beispiel();
    rumpf.as_object_mut().unwrap().remove("currency");
    let (s, f) = anlegen(&lauf.adresse, "cl", rumpf).await;
    assert_eq!((s, f["fehler"].as_str().unwrap().contains("currency fehlt")), (400, true), "{f}");
    assert_eq!(stand(ohne.path()), vorher);
}
