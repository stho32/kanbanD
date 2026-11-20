// R00153 (I0140, Karte #39): Ein Rumpf mit falscher Form wird an jedem schreibenden Endpunkt mit 400 und {fehler} abgewiesen (ADR-0003 N1/N3)
mod gemeinsam;

use gemeinsam::{Antwort, git, lies, mit_drei_aufgaben, senden_roh};
use reqwest::Method;
use std::collections::BTreeSet;
use std::path::Path;

const JSON: Option<&str> = Some("application/json");

/// R00153 AK 2: Methode, Pfad der Beschreibung, Rumpf mit falschem Typ, Feldname in `fehler`.
const MIT_JSON_RUMPF: [(&str, &str, &str, &str); 41] = [
    ("POST", "/api/einrichten", r#"{"ich": 7}"#, "ich"),
    ("PATCH", "/api/boards/{slug}", r#"{"archiviert": "ja"}"#, "archiviert"),
    ("POST", "/api/aufgaben", r#"{"titel": 7}"#, "titel"),
    ("POST", "/api/boards/{slug}/bewegen", r#"{"nummer": "eins", "spalte": "Zu erledigen"}"#, "nummer"),
    ("POST", "/api/boards", r#"{"titel": 7}"#, "titel"),
    ("PUT", "/api/boards/{slug}/spalten", r#"[{"name": "Zu erledigen", "grenze": "3"}]"#, "grenze"),
    ("PUT", "/api/boards/{slug}/termine", r#"[{"name": "X", "datum": "2027-10-31", "farbe": "red", "ziel": "ja"}]"#, "ziel"),
    ("PUT", "/api/boards/{slug}/start", r#"{"start": 7}"#, "start"),
    ("PUT", "/api/boards/{slug}/berichtsfilter", r#"{"messbasisTage": "viele"}"#, "messbasisTage"),
    ("PUT", "/api/boards/{slug}/bestand", r#"{"zeilen": 7, "spalten": "x"}"#, "zeilen"),
    ("PUT", "/api/boards/{slug}/fieber", r#"{"perzentil": "hoch"}"#, "perzentil"),
    ("POST", "/api/boards/{slug}/fieber/cache", r#"{"schluessel": 7, "tage": []}"#, "schluessel"),
    ("PUT", "/api/boards/{slug}/anwendungen", "[7]", "0"),
    ("PUT", "/api/boards/{slug}/klassen", r#"{"klassen": 7}"#, "klassen"),
    ("POST", "/api/personen", r#"{"kuerzel": 7, "name": "X"}"#, "kuerzel"),
    ("PATCH", "/api/personen/{kuerzel}", r#"{"aktiv": "ja"}"#, "aktiv"),
    ("PUT", "/api/einstellungen", r#"{"personen": 7}"#, "personen"),
    ("PATCH", "/api/aufgaben/{nr}", r#"{"titel": 7}"#, "titel"),
    ("POST", "/api/aufgaben/{nr}/teilaufgaben", r#"{"text": 7}"#, "text"),
    ("PATCH", "/api/aufgaben/{nr}/teilaufgaben/{i}", r#"{"text": 7}"#, "text"),
    ("POST", "/api/aufgaben/{nr}/kommentare", r#"{"text": 7}"#, "text"),
    ("POST", "/api/aufgaben/erledigen", r#"{"key": 7}"#, "key"),
    ("PATCH", "/api/aufgaben/{nr}/wbs-effects", r#"{"application": 7}"#, "application"),
    ("POST", "/api/aufgaben/{nr}/wbs-effects/{i}/eintritt", r#"{"an": "ja"}"#, "an"),
    ("POST", "/api/aufgaben/{nr}/zeiten", r#"{"dauer": 30}"#, "dauer"),
    ("PATCH", "/api/aufgaben/{nr}/zeiten/{kennung}", r#"{"beginn": 7}"#, "beginn"),
    ("POST", "/api/aufgaben/{nr}/kosteneintraege", r#"{"at": "2026-11-13 10:34+01:00", "role": "entwickler", "column": "Zu erledigen", "amount": "3.46", "currency": "USD"}"#, "amount"),
    ("PATCH", "/api/aufgaben/{nr}/kosteneintraege/{kennung}", r#"{"amount": "3.46"}"#, "amount"),
    ("POST", "/api/aufgaben/{nr}/commits", r#"{"commits": "kd:3f2a9c1"}"#, "commits"),
    ("POST", "/api/aufgaben/{nr}/commits/ersetzen", r#"{"ersetzungen": "kd:3f2a9c1"}"#, "ersetzungen"),
    ("POST", "/api/aufgaben/{nr}/durchlaeufe", r#"{"phase": 7, "ergebnis": "ok"}"#, "phase"),
    ("PATCH", "/api/wbs/{kuerzel}/knoten/{id}", r#"{"status": 7}"#, "status"),
    ("POST", "/api/wbs/{kuerzel}/knoten", r#"{"name": 7}"#, "name"),
    ("POST", "/api/boards/{slug}/aufgaben", r#"{"nummer": "eins"}"#, "nummer"),
    ("POST", "/api/aufgaben/mehrere", r#"{"titel": 7}"#, "titel"),
    ("POST", "/api/aufgaben/{nr}/teilaufgaben/mehrere", r#"{"texte": [7]}"#, "texte"),
    ("POST", "/api/boards/{slug}/bewegen-mehrere", r#"{"ziele": [{"nummer": "eins", "spalte": "Zu erledigen"}]}"#, "nummer"),
    ("POST", "/api/boards/{slug}/aufgaben/mehrere", r#"{"nummern": ["eins"]}"#, "nummern"),
    ("PATCH", "/api/aufgaben/mehrere", r#"{"aenderungen": 7}"#, "aenderungen"),
    ("POST", "/api/aufgaben/archivieren", r#"{"nummern": "alle"}"#, "nummern"),
    ("POST", "/api/aufgaben/zurueckholen", r#"{"nummern": "alle"}"#, "nummern"),
];

/// R00153 AK 3 und AK 19: nimmt einen wahlfreien JSON-Rumpf — ohne `Content-Type` fehlt er.
const MIT_WAHLFREIEM_JSON_RUMPF: [(&str, &str); 1] = [("POST", "/api/aufgaben/{nr}/duplizieren")];

/// R00153 AK 3: lesen den Rumpf als `Bytes` und bleiben, wie sie sind.
const MIT_BYTES_RUMPF: [(&str, &str); 5] = [
    ("POST", "/api/boards/{slug}/ziehen"),
    ("POST", "/api/aufgaben/{nr}/timer/stop"),
    ("POST", "/api/wbs/{kuerzel}/knoten/{id}/verwerfen"),
    ("POST", "/api/aufgaben/{nr}/reservierung"),
    ("DELETE", "/api/aufgaben/{nr}/reservierung"),
];

/// R00153 AK 3: ohne Rumpf oder Multipart.
const OHNE_JSON_RUMPF: [(&str, &str); 17] = [
    ("DELETE", "/api/boards/{slug}"),
    ("DELETE", "/api/boards/{slug}/fieber/cache"),
    ("DELETE", "/api/personen/{kuerzel}"),
    ("DELETE", "/api/aufgaben/{nr}"),
    ("PUT", "/api/aufgaben/{nr}/signale/{signal}"),
    ("DELETE", "/api/aufgaben/{nr}/signale/{signal}"),
    ("DELETE", "/api/aufgaben/{nr}/teilaufgaben/{i}"),
    ("DELETE", "/api/aufgaben/{nr}/wbs-effects/{i}"),
    ("POST", "/api/aufgaben/{nr}/timer/start"),
    ("DELETE", "/api/aufgaben/{nr}/zeiten/{kennung}"),
    ("DELETE", "/api/aufgaben/{nr}/kosteneintraege/{kennung}"),
    ("DELETE", "/api/aufgaben/{nr}/commits/{verweis}"),
    ("POST", "/api/aufgaben/{nr}/anhaenge"),
    ("DELETE", "/api/aufgaben/{nr}/anhaenge/{name}"),
    ("POST", "/api/aufgaben/{nr}/archivieren"),
    ("POST", "/api/aufgaben/{nr}/zurueckholen"),
    ("DELETE", "/api/boards/{slug}/aufgaben/{nr}"),
];

/// R00153 „Meldung“: Text des Rahmens, der in keiner Meldung stehen darf.
const RAHMENTEXT: [&str; 6] = ["invalid type", "invalid value", "expected", "missing field", "unknown variant", "Failed to"];

/// Der Pfad der Beschreibung mit den Werten des Grundbestands, ohne führenden Schrägstrich.
fn gesendeter_pfad(pfad: &str) -> String {
    let kuerzel = if pfad.starts_with("/api/wbs/") { "kd" } else { "st" };
    pfad[1..].replace("{slug}", "entwicklung").replace("{nr}", "1").replace("{kuerzel}", kuerzel).replace("{id}", "I0001").replace("{i}", "0").replace("{kennung}", "x")
}

/// Git-Stand des Board-Ordners: letzter Commit und offene Änderungen.
fn stand(ordner: &Path) -> (String, String) {
    (git(ordner, &["rev-parse", "HEAD"]), git(ordner, &["status", "--porcelain"]))
}

/// R00153 „Form einer Abweisung“ ohne den Git-Stand: Status, `application/json`, Objekt mit nicht leerem `fehler` — sonst der Grund.
fn form(antwort: &Antwort, status: u16) -> Result<String, String> {
    let gesehen = format!("{} {} {:?}", antwort.status, antwort.art, antwort.text.chars().take(160).collect::<String>());
    if antwort.status != status {
        return Err(format!("Status {status} erwartet: {gesehen}"));
    }
    if antwort.art != "application/json" {
        return Err(format!("Content-Type application/json erwartet: {gesehen}"));
    }
    match antwort.json()["fehler"].as_str() {
        Some(fehler) if !fehler.is_empty() => Ok(fehler.to_string()),
        _ => Err(format!("Objekt mit nicht leerem Feld fehler erwartet: {gesehen}")),
    }
}

/// Die Meldung trägt keinen Text des Rahmens.
fn ohne_rahmentext(fehler: &str) -> Result<(), String> {
    match RAHMENTEXT.iter().find(|wort| fehler.contains(**wort)) {
        Some(wort) => Err(format!("Text des Rahmens „{wort}“ in der Meldung: {fehler}")),
        None => Ok(()),
    }
}

/// Sendet einen JSON-Rumpf und verlangt die Abweisung in der Form ohne Commit; liefert die Meldung.
async fn abgewiesen(ordner: &Path, adresse: &str, methode: Method, pfad: &str, art: Option<&str>, rumpf: impl Into<reqwest::Body>, status: u16) -> String {
    let vorher = stand(ordner);
    let antwort = senden_roh(methode, adresse, pfad, "st", art, rumpf).await;
    let fehler = form(&antwort, status).unwrap_or_else(|grund| panic!("{pfad}: {grund}"));
    ohne_rahmentext(&fehler).unwrap_or_else(|grund| panic!("{pfad}: {grund}"));
    assert_eq!(stand(ordner), vorher, "{pfad}: kein Commit, keine offene Änderung");
    fehler
}

fn grundbestand() -> (tempfile::TempDir, gemeinsam::Laufendes) {
    let tmp = tempfile::tempdir().unwrap();
    mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    (tmp, lauf)
}

// AK 1, AK 2, AK 9 (36 Antworten, seit R00165 mit den Kosteneinträgen 38, seit R00195 mit den Klassen des Boards 39, seit R00202 mit den Commit-Verweisen 40, seit R00203 mit dem Ersetzen 41), AK 12 · US-3
#[tokio::test]
async fn jeder_endpunkt_mit_json_rumpf_weist_einen_falschen_typ_mit_400_und_feldnamen_ab() {
    let (tmp, lauf) = grundbestand();
    let mut rot = Vec::new();
    for (nr, (methode, pfad, rumpf, feld)) in MIT_JSON_RUMPF.iter().enumerate() {
        let vorher = stand(tmp.path());
        let antwort = senden_roh(methode.parse().unwrap(), &lauf.adresse, &gesendeter_pfad(pfad), "st", JSON, *rumpf).await;
        let urteil = form(&antwort, 400).and_then(|fehler| {
            ohne_rahmentext(&fehler)?;
            if fehler.contains(feld) { Ok(()) } else { Err(format!("Feldname „{feld}“ fehlt in der Meldung: {fehler}")) }
        });
        if let Err(grund) = urteil {
            rot.push(format!("Zeile {} {methode} {pfad}: {grund}", nr + 1));
        }
        if stand(tmp.path()) != vorher {
            rot.push(format!("Zeile {} {methode} {pfad}: Git-Stand des Ordners geändert", nr + 1));
        }
    }
    assert!(rot.is_empty(), "{} von 41 Zeilen rot:\n{}", rot.len(), rot.join("\n"));
}

// AK 3
#[tokio::test]
async fn die_tabelle_nennt_jeden_schreibenden_endpunkt_der_beschreibung_genau_einmal() {
    let (_tmp, lauf) = grundbestand();
    let liste: serde_json::Value = reqwest::get(format!("{}api/endpunkte", lauf.adresse)).await.unwrap().json().await.unwrap();
    let beschrieben: Vec<String> = liste.as_array().unwrap().iter().filter(|e| e["methode"] != "GET").map(|e| format!("{} {}", e["methode"].as_str().unwrap(), e["pfad"].as_str().unwrap())).collect();
    let benannt: Vec<String> = MIT_JSON_RUMPF.iter().map(|(m, p, _, _)| (m, p)).chain(MIT_WAHLFREIEM_JSON_RUMPF.iter().map(|(m, p)| (m, p))).chain(MIT_BYTES_RUMPF.iter().map(|(m, p)| (m, p))).chain(OHNE_JSON_RUMPF.iter().map(|(m, p)| (m, p))).map(|(m, p)| format!("{m} {p}")).collect();
    assert_eq!((beschrieben.len(), benannt.len()), (64, 64), "64 = 41 + 1 + 5 + 17");
    let (beschrieben, benannt): (BTreeSet<_>, BTreeSet<_>) = (beschrieben.into_iter().collect(), benannt.into_iter().collect());
    assert_eq!(benannt.len(), 64, "kein Endpunkt steht in zwei Listen");
    assert_eq!(beschrieben.difference(&benannt).collect::<Vec<_>>(), Vec::<&String>::new(), "schreibender Endpunkt in keiner der vier Listen — in die Tabelle zu AK 2 aufnehmen oder benennen");
    assert_eq!(benannt.difference(&beschrieben).collect::<Vec<_>>(), Vec::<&String>::new(), "benannter Endpunkt fehlt in der Beschreibung");
}

// AK 4 · US-1
#[tokio::test]
async fn eine_grenze_mit_falschem_typ_wird_mit_400_abgewiesen_und_nennt_grenze() {
    let (tmp, lauf) = grundbestand();
    let board = lies(tmp.path(), "boards/entwicklung.md");
    for grenze in ["-1", "\"3\"", "2.0"] {
        let rumpf = format!(r#"[{{"name": "Zu erledigen", "grenze": {grenze}}}]"#);
        let fehler = abgewiesen(tmp.path(), &lauf.adresse, Method::PUT, "api/boards/entwicklung/spalten", JSON, rumpf, 400).await;
        assert!(fehler.contains("grenze"), "grenze {grenze}: {fehler}");
        assert_eq!(lies(tmp.path(), "boards/entwicklung.md"), board, "grenze {grenze}: Board unverändert");
    }
}

// AK 5 · US-2
#[tokio::test]
async fn ein_fehlendes_pflichtfeld_wird_mit_400_abgewiesen_und_nennt_das_feld() {
    let (tmp, lauf) = grundbestand();
    let aufgabe = lies(tmp.path(), "aufgaben/0001-eins.md");
    let fehler = abgewiesen(tmp.path(), &lauf.adresse, Method::POST, "api/aufgaben/1/teilaufgaben", JSON, "{}", 400).await;
    assert!(fehler.contains("text"), "{fehler}");
    assert_eq!(lies(tmp.path(), "aufgaben/0001-eins.md"), aufgabe, "keine neue Teilaufgabe");
}

// AK 6
#[tokio::test]
async fn ein_unbekannter_wert_einer_aufzaehlung_wird_mit_400_abgewiesen_und_nennt_das_feld() {
    let (tmp, lauf) = grundbestand();
    let rumpf = r#"[{"name": "X", "datum": "2027-10-31", "farbe": "red", "linie": "wellig"}]"#;
    let fehler = abgewiesen(tmp.path(), &lauf.adresse, Method::PUT, "api/boards/entwicklung/termine", JSON, rumpf, 400).await;
    assert!(fehler.contains("linie"), "{fehler}");
    assert!(!fehler.contains("wellig"), "der gesendete Wert steht nicht in der Meldung: {fehler}");
}

// AK 7
#[tokio::test]
async fn ein_falscher_typ_im_zweiten_element_nennt_feld_und_stelle_und_bewegt_nichts() {
    let (tmp, lauf) = grundbestand();
    let board = lies(tmp.path(), "boards/entwicklung.md");
    let rumpf = r#"{"ziele": [{"nummer": 1, "spalte": "Zu erledigen"}, {"nummer": "zwei", "spalte": "Zu erledigen"}]}"#;
    let fehler = abgewiesen(tmp.path(), &lauf.adresse, Method::POST, "api/boards/entwicklung/bewegen-mehrere", JSON, rumpf, 400).await;
    assert!(fehler.contains("ziele[1].nummer"), "Feld und Stelle 1: {fehler}");
    assert_eq!(lies(tmp.path(), "boards/entwicklung.md"), board, "keine der beiden Aufgaben ist bewegt");
}

// AK 8 · US-4
#[tokio::test]
async fn kaputtes_json_und_ein_leerer_rumpf_werden_mit_400_und_deutscher_meldung_abgewiesen() {
    let (tmp, lauf) = grundbestand();
    for rumpf in [r#"{"titel": "#, ""] {
        let fehler = abgewiesen(tmp.path(), &lauf.adresse, Method::POST, "api/aufgaben", JSON, rumpf, 400).await;
        assert!(fehler.contains("kein gültiges JSON"), "Rumpf {rumpf:?}: {fehler}");
        assert_eq!(std::fs::read_dir(tmp.path().join("aufgaben")).unwrap().count(), 3, "Rumpf {rumpf:?}: keine Aufgabe angelegt");
    }
}

// AK 9
#[tokio::test]
async fn die_meldung_wiederholt_den_gesendeten_wert_nicht() {
    let (tmp, lauf) = grundbestand();
    let rumpf = r#"[{"name": "Zu erledigen", "grenze": "Zx9-Inhalt"}]"#;
    let fehler = abgewiesen(tmp.path(), &lauf.adresse, Method::PUT, "api/boards/entwicklung/spalten", JSON, rumpf, 400).await;
    assert!(!fehler.contains("Zx9-Inhalt"), "{fehler}");
    assert!(fehler.contains("grenze"), "{fehler}");
}

// AK 10 · US-4
#[tokio::test]
async fn ein_fehlender_oder_falscher_content_type_wird_mit_415_und_deutscher_meldung_abgewiesen() {
    let (tmp, lauf) = grundbestand();
    for art in [None, Some("text/plain")] {
        let rumpf = r#"{"titel": "x", "board": "entwicklung"}"#;
        let fehler = abgewiesen(tmp.path(), &lauf.adresse, Method::POST, "api/aufgaben", art, rumpf, 415).await;
        assert!(fehler.contains("Content-Type") && fehler.contains("application/json"), "Content-Type {art:?}: {fehler}");
        assert_eq!(std::fs::read_dir(tmp.path().join("aufgaben")).unwrap().count(), 3, "Content-Type {art:?}: keine Aufgabe angelegt");
    }
}

// AK 11 · US-4 — hält zugleich die Standardgrenze des Rahmens für JSON-Rümpfe fest (ADR-0003 N3 Punkt 6): 2 MiB gehen durch den Extraktor, 3 MiB nicht
#[tokio::test]
async fn ein_rumpf_von_3_mib_wird_mit_413_und_deutscher_meldung_abgewiesen() {
    let (tmp, lauf) = grundbestand();
    let aufgabe = lies(tmp.path(), "aufgaben/0001-eins.md");
    let rumpf = format!(r#"{{"text": "{}"}}"#, "a".repeat(3 * 1024 * 1024));
    let fehler = abgewiesen(tmp.path(), &lauf.adresse, Method::POST, "api/aufgaben/1/kommentare", JSON, rumpf, 413).await;
    assert!(fehler.contains("zu groß"), "{fehler}");
    assert_eq!(lies(tmp.path(), "aufgaben/0001-eins.md"), aufgabe, "kein Kommentar geschrieben");
}

// ---- Gegenproben: am Stand vor dem Fix gemessen und festgeschrieben (R00153 AK 13–17) ----

// AK 13 · US-5
#[tokio::test]
async fn ein_gueltiger_rumpf_legt_die_aufgabe_mit_genau_einem_commit_an() {
    let (tmp, lauf) = grundbestand();
    let commits = || git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap();
    let vorher = commits();
    let antwort = senden_roh(Method::POST, &lauf.adresse, "api/aufgaben", "st", JSON, r#"{"titel": "x", "board": "entwicklung"}"#).await;
    assert_eq!((antwort.status, antwort.json()["nummer"].as_u64()), (201, Some(4)), "{}", antwort.text);
    assert!(lies(tmp.path(), "boards/entwicklung.md").contains("- [#4](../aufgaben/0004-x.md)"), "die Aufgabe liegt auf dem Board");
    assert_eq!((commits(), git(tmp.path(), &["status", "--porcelain"])), (vorher + 1, String::new()), "genau ein Commit");
}

// AK 14: roh angenommene Felder behalten ihre fachliche Meldung
#[tokio::test]
async fn roh_angenommene_felder_antworten_mit_status_und_meldung_wie_vor_dem_fix() {
    let (tmp, lauf) = grundbestand();
    for (methode, pfad, rumpf, meldung) in [
        (Method::PATCH, "api/aufgaben/1", r#"{"cost": "teuer"}"#, "cost: keine Zuordnung"),
        (Method::PATCH, "api/aufgaben/1", r#"{"cost": {"x": 1}}"#, "cost: unbekannter Schlüssel „x“"),
        (Method::PATCH, "api/aufgaben/1", r#"{"estimate": "viel"}"#, "estimate: ganze Zahl von Minuten ≥ 1 erwartet"),
        (Method::POST, "api/aufgaben/1/teilaufgaben", r#"{"text": "a", "position": "x"}"#, "„position“ muss eine ganze Zahl ab 0 sein, nicht \"x\""),
        (Method::POST, "api/aufgaben/1/teilaufgaben", r#"{"text": "a", "erledigt": "ja"}"#, "„erledigt“ muss true oder false sein, nicht \"ja\""),
    ] {
        let vorher = stand(tmp.path());
        let antwort = senden_roh(methode, &lauf.adresse, pfad, "st", JSON, rumpf).await;
        assert_eq!((antwort.status, antwort.art.as_str(), antwort.json()["fehler"].as_str()), (400, "application/json", Some(meldung)), "{rumpf}");
        assert_eq!(stand(tmp.path()), vorher, "{rumpf}: kein Commit");
    }
}

// AK 15: unbekannte Schlüssel bleiben erlaubt (ADR-0003 N3 Punkt 5)
#[tokio::test]
async fn ein_unbekannter_schluessel_wird_ueberlesen() {
    let (tmp, lauf) = grundbestand();
    let vorher = stand(tmp.path());
    let antwort = senden_roh(Method::PATCH, &lauf.adresse, "api/boards/entwicklung", "st", JSON, r#"{"titel": "Entwicklung", "quatsch": 1}"#).await;
    assert_eq!((antwort.status, antwort.json()["titel"].as_str()), (200, Some("Entwicklung")), "{}", antwort.text);
    assert_eq!(stand(tmp.path()), vorher, "gleicher Titel: kein Commit");
    let antwort = senden_roh(Method::PATCH, &lauf.adresse, "api/boards/entwicklung", "st", JSON, r#"{"titel": "Werkstatt", "quatsch": 1}"#).await;
    assert_eq!((antwort.status, antwort.json()["titel"].as_str()), (200, Some("Werkstatt")), "{}", antwort.text);
    assert!(lies(tmp.path(), "boards/entwicklung.md").starts_with("# Werkstatt\n"), "der bekannte Schlüssel wirkt");
}

// AK 16: Handler, die den Rumpf als Bytes lesen, verlangen weder Rumpf noch Content-Type
#[tokio::test]
async fn timer_stop_und_reservierung_ohne_rumpf_und_content_type_antworten_fachlich() {
    let (_tmp, lauf) = grundbestand();
    for (pfad, status, meldung) in [("api/aufgaben/1/timer/stop", 409, "An #1 läuft kein Timer von Stefan"), ("api/aufgaben/1/reservierung", 400, "Welche Instanz? Header X-KanbanD-Instanz oder Feld instanz fehlt")] {
        let antwort = senden_roh(Method::POST, &lauf.adresse, pfad, "st", None, "").await;
        assert_eq!((antwort.status, antwort.json()["fehler"].as_str()), (status, Some(meldung)), "{pfad}");
    }
}

// AK 17: der beschriebene Kontrakt nennt an jedem schreibenden Endpunkt 400 mit Fehlerantwort und weder 415, 413 noch 422 (ADR-0003 N3 Punkt 7)
#[tokio::test]
async fn die_beschreibung_nennt_400_mit_fehlerantwort_und_keinen_code_des_transports() {
    let (_tmp, lauf) = grundbestand();
    let api: serde_json::Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse)).await.unwrap().json().await.unwrap();
    let mut schreibend = 0;
    let mut codes = BTreeSet::new();
    for (pfad, methoden) in api["paths"].as_object().unwrap() {
        for (methode, beschreibung) in methoden.as_object().unwrap() {
            codes.extend(beschreibung["responses"].as_object().unwrap().keys().cloned());
            if methode != "get" {
                schreibend += 1;
                assert_eq!(beschreibung["responses"]["400"]["content"]["application/json"]["schema"]["$ref"], "#/components/schemas/Fehlerantwort", "{methode} {pfad}");
            }
        }
    }
    assert_eq!(schreibend, 64);
    // 304: GET …/diff mit If-None-Match (R00206 FA 12) — die einzige Route mit ETag
    assert_eq!(codes.into_iter().collect::<Vec<_>>(), ["200", "201", "303", "304", "400", "403", "404", "409", "423", "500", "503"]);
}

// ADR-0003 N3 Punkt 6: die Standardgrenze des Rahmens bleibt — ein JSON-Rumpf von genau 2 MiB geht durch
#[tokio::test]
async fn ein_rumpf_von_genau_2_mib_wird_angenommen() {
    let (tmp, lauf) = grundbestand();
    let rumpf = format!(r#"{{"text": "{}"}}"#, "a".repeat(2 * 1024 * 1024 - 12));
    assert_eq!(rumpf.len(), 2 * 1024 * 1024);
    let antwort = senden_roh(Method::POST, &lauf.adresse, "api/aufgaben/1/kommentare", "st", JSON, rumpf).await;
    assert_eq!(antwort.status, 200, "{}", antwort.text.chars().take(160).collect::<String>());
    assert!(lies(tmp.path(), "aufgaben/0001-eins.md").len() > 2 * 1024 * 1024 - 12, "der Kommentar ist geschrieben");
}

// AK 20: application/json und application/<name>+json werden wie vor dem Fix angenommen, mit Parametern und in beliebiger Großschreibung
#[tokio::test]
async fn json_mit_parameter_grossschreibung_oder_json_suffix_wird_angenommen() {
    let (_tmp, lauf) = grundbestand();
    for art in ["application/json; charset=utf-8", "APPLICATION/JSON", "application/vnd.api+json", "Application/Vnd.Api+JSON; charset=UTF-8"] {
        let antwort = senden_roh(Method::POST, &lauf.adresse, "api/aufgaben", "st", Some(art), r#"{"titel": "x"}"#).await;
        assert_eq!(antwort.status, 201, "{art}: {}", antwort.text);
    }
}

// ---- Dieselbe Klasse an Stellen, die die Tabelle nicht nennt (R00153 AK 14 berichtigt, AK 19, AK 20) ----

// AK 14 (berichtigt): datums_trenner ist getypt, nicht roh — vor dem Fix 422 text/plain, jetzt 400 in der Form wie jedes Feld unter AK 1
#[tokio::test]
async fn ein_datums_trenner_mit_falschem_typ_wird_mit_400_abgewiesen_und_nennt_das_feld() {
    let (tmp, lauf) = grundbestand();
    let rumpf = r#"[{"name": "Zu erledigen", "datums_trenner": "ja"}]"#;
    let fehler = abgewiesen(tmp.path(), &lauf.adresse, Method::PUT, "api/boards/entwicklung/spalten", JSON, rumpf, 400).await;
    assert!(fehler.contains("datums_trenner"), "{fehler}");
}

// AK 19: der wahlfreie Rumpf von POST …/duplizieren geht durch denselben Extraktor; ohne Rumpf und Content-Type bleibt es bei 201
#[tokio::test]
async fn der_wahlfreie_rumpf_von_duplizieren_wird_bei_falscher_form_in_der_form_abgewiesen() {
    let (tmp, lauf) = grundbestand();
    let fehler = abgewiesen(tmp.path(), &lauf.adresse, Method::POST, "api/aufgaben/1/duplizieren", JSON, r#"{"board": 7}"#, 400).await;
    assert!(fehler.contains("board"), "{fehler}");
    abgewiesen(tmp.path(), &lauf.adresse, Method::POST, "api/aufgaben/1/duplizieren", Some("text/plain"), "{}", 415).await;
    assert_eq!(std::fs::read_dir(tmp.path().join("aufgaben")).unwrap().count(), 3, "in beiden Fällen keine Aufgabe angelegt");
    let antwort = senden_roh(Method::POST, &lauf.adresse, "api/aufgaben/1/duplizieren", "st", None, "").await;
    assert_eq!((antwort.status, antwort.json()["nummer"].as_u64()), (201, Some(4)), "ohne Rumpf und Content-Type wie bisher: {}", antwort.text);
}

// AK 20 (und eigene Varianten zu AK 10): alles außer application/json und application/<name>+json ist 415 — application/json+xml nahm der Rahmen vor dem Fix an
#[tokio::test]
async fn ein_content_type_der_nur_aehnlich_heisst_wird_mit_415_abgewiesen() {
    let (tmp, lauf) = grundbestand();
    for art in ["application/jsonx", "text/json", "json", "application/x-www-form-urlencoded", "application/json+xml"] {
        abgewiesen(tmp.path(), &lauf.adresse, Method::POST, "api/aufgaben", Some(art), r#"{"titel": "x"}"#, 415).await;
    }
}

// ADR-0003 N2 „400 bleibt vorn“: der Formfehler entsteht vor dem Handler, auch wenn es das Board nicht gibt
#[tokio::test]
async fn der_formfehler_geht_dem_unbekannten_board_vor() {
    let (tmp, lauf) = grundbestand();
    let fehler = abgewiesen(tmp.path(), &lauf.adresse, Method::PUT, "api/boards/gibtsnicht/termine", JSON, r#"[{"name": 7}]"#, 400).await;
    assert!(fehler.contains("name"), "{fehler}");
}
