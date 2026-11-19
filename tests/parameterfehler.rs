// R00154 (I0141, Karte #168): Ein falscher Pfad- oder Abfrageparameter wird an jeder Route mit 400 und {fehler} abgewiesen (ADR-0003 N4)
mod gemeinsam;

use gemeinsam::{Antwort, git, lies, mit_drei_aufgaben, senden_roh};
use reqwest::Method;
use std::collections::BTreeSet;
use std::path::Path;

/// R00154 AK 2: Methode, Schablone des Pfads und die Parameter, die eine Zahl sind — die Parameter selbst stehen in der Schablone.
const MIT_PFADPARAMETER: [(&str, &str, &[&str]); 61] = [
    ("GET", "/api/aufgaben/{nr}", &["nr"]),
    ("PATCH", "/api/aufgaben/{nr}", &["nr"]),
    ("DELETE", "/api/aufgaben/{nr}", &["nr"]),
    ("GET", "/api/aufgaben/{nr}/anhaenge", &["nr"]),
    ("POST", "/api/aufgaben/{nr}/anhaenge", &["nr"]),
    ("GET", "/api/aufgaben/{nr}/anhaenge/{name}", &["nr"]),
    ("DELETE", "/api/aufgaben/{nr}/anhaenge/{name}", &["nr"]),
    ("POST", "/api/aufgaben/{nr}/archivieren", &["nr"]),
    ("POST", "/api/aufgaben/{nr}/duplizieren", &["nr"]),
    ("POST", "/api/aufgaben/{nr}/durchlaeufe", &["nr"]),
    ("POST", "/api/aufgaben/{nr}/kommentare", &["nr"]),
    ("POST", "/api/aufgaben/{nr}/reservierung", &["nr"]),
    ("DELETE", "/api/aufgaben/{nr}/reservierung", &["nr"]),
    ("PUT", "/api/aufgaben/{nr}/signale/{signal}", &["nr"]),
    ("DELETE", "/api/aufgaben/{nr}/signale/{signal}", &["nr"]),
    ("POST", "/api/aufgaben/{nr}/teilaufgaben", &["nr"]),
    ("POST", "/api/aufgaben/{nr}/teilaufgaben/mehrere", &["nr"]),
    ("PATCH", "/api/aufgaben/{nr}/teilaufgaben/{i}", &["nr", "i"]),
    ("DELETE", "/api/aufgaben/{nr}/teilaufgaben/{i}", &["nr", "i"]),
    ("POST", "/api/aufgaben/{nr}/timer/start", &["nr"]),
    ("POST", "/api/aufgaben/{nr}/timer/stop", &["nr"]),
    ("GET", "/api/aufgaben/{nr}/verlauf", &["nr"]),
    ("GET", "/api/aufgaben/{nr}/wbs-effects", &["nr"]),
    ("PATCH", "/api/aufgaben/{nr}/wbs-effects", &["nr"]),
    ("DELETE", "/api/aufgaben/{nr}/wbs-effects/{i}", &["nr", "i"]),
    ("POST", "/api/aufgaben/{nr}/wbs-effects/{i}/eintritt", &["nr", "i"]),
    ("POST", "/api/aufgaben/{nr}/zeiten", &["nr"]),
    ("PATCH", "/api/aufgaben/{nr}/zeiten/{kennung}", &["nr"]),
    ("DELETE", "/api/aufgaben/{nr}/zeiten/{kennung}", &["nr"]),
    ("POST", "/api/aufgaben/{nr}/kosteneintraege", &["nr"]),
    ("PATCH", "/api/aufgaben/{nr}/kosteneintraege/{kennung}", &["nr"]),
    ("DELETE", "/api/aufgaben/{nr}/kosteneintraege/{kennung}", &["nr"]),
    ("POST", "/api/aufgaben/{nr}/commits", &["nr"]),
    ("DELETE", "/api/aufgaben/{nr}/commits/{verweis}", &["nr"]),
    ("POST", "/api/aufgaben/{nr}/zurueckholen", &["nr"]),
    ("GET", "/api/boards/{slug}", &[]),
    ("PATCH", "/api/boards/{slug}", &[]),
    ("DELETE", "/api/boards/{slug}", &[]),
    ("PUT", "/api/boards/{slug}/anwendungen", &[]),
    ("PUT", "/api/boards/{slug}/klassen", &[]),
    ("POST", "/api/boards/{slug}/aufgaben", &[]),
    ("POST", "/api/boards/{slug}/aufgaben/mehrere", &[]),
    ("DELETE", "/api/boards/{slug}/aufgaben/{nr}", &["nr"]),
    ("PUT", "/api/boards/{slug}/berichtsfilter", &[]),
    ("PUT", "/api/boards/{slug}/bestand", &[]),
    ("POST", "/api/boards/{slug}/bewegen", &[]),
    ("POST", "/api/boards/{slug}/bewegen-mehrere", &[]),
    ("PUT", "/api/boards/{slug}/fieber", &[]),
    ("GET", "/api/boards/{slug}/fieber/cache", &[]),
    ("POST", "/api/boards/{slug}/fieber/cache", &[]),
    ("DELETE", "/api/boards/{slug}/fieber/cache", &[]),
    ("PUT", "/api/boards/{slug}/spalten", &[]),
    ("PUT", "/api/boards/{slug}/start", &[]),
    ("PUT", "/api/boards/{slug}/termine", &[]),
    ("POST", "/api/boards/{slug}/ziehen", &[]),
    ("PATCH", "/api/personen/{kuerzel}", &[]),
    ("DELETE", "/api/personen/{kuerzel}", &[]),
    ("GET", "/api/wbs/{kuerzel}", &[]),
    ("POST", "/api/wbs/{kuerzel}/knoten", &[]),
    ("PATCH", "/api/wbs/{kuerzel}/knoten/{id}", &[]),
    ("POST", "/api/wbs/{kuerzel}/knoten/{id}/verwerfen", &[]),
];

/// R00154 AK 6: Anfrage und das Feld, das die Meldung nennt.
const ABFRAGEN: [(&str, &str); 6] = [
    ("/api/berichte/verlauf", "board"),
    ("/api/berichte/verlauf?board=a&board=b", "board"),
    ("/api/berichte/bewegungen", "board"),
    ("/api/berichte/bewegungen?board=a&board=b", "board"),
    ("/api/boards?archivierte=ja&archivierte=ja", "archivierte"),
    ("/api/boards/entwicklung?archivierte=ja&archivierte=ja", "archivierte"),
];

/// R00154 „Meldung“: Text des Rahmens, der in keiner Meldung stehen darf.
const RAHMENTEXT: [&str; 9] = ["Invalid URL", "Cannot parse", "at index", "Invalid UTF-8", "Failed to", "missing field", "duplicate field", "u32", "u64"];

/// Die Parameter einer Schablone in ihrer Reihenfolge.
fn parameter(schablone: &str) -> Vec<&str> {
    schablone.split('{').skip(1).filter_map(|rest| rest.split('}').next()).collect()
}

/// R00154 AK 2: der Grundwert eines Parameters.
fn grundwert(name: &str) -> &'static str {
    match name {
        "nr" => "1",
        "i" => "0",
        "slug" => "entwicklung",
        "kuerzel" => "st",
        "id" => "I0001",
        "name" => "x.txt",
        "signal" | "kennung" => "x",
        "verweis" => "kd:3f2a9c1",
        _ => panic!("kein Grundwert für {name}"),
    }
}

/// Die Schablone mit Grundwerten, ohne führenden Schrägstrich; `ersetzt` nennt Parameter mit einem anderen Wert.
fn gesendeter_pfad(schablone: &str, ersetzt: &[(&str, &str)]) -> String {
    parameter(schablone).into_iter().fold(schablone[1..].to_string(), |pfad, name| {
        let wert = ersetzt.iter().find(|(n, _)| *n == name).map_or(grundwert(name), |(_, wert)| wert);
        pfad.replace(&format!("{{{name}}}"), wert)
    })
}

/// Git-Stand des Board-Ordners: letzter Commit und offene Änderungen.
fn stand(ordner: &Path) -> (String, String) {
    (git(ordner, &["rev-parse", "HEAD"]), git(ordner, &["status", "--porcelain"]))
}

/// R00154 „Form einer Abweisung“ ohne den Git-Stand: 400, `application/json`, Objekt mit nicht leerem `fehler` — sonst der Grund.
fn form(antwort: &Antwort) -> Result<String, String> {
    let gesehen = format!("{} {} {:?}", antwort.status, antwort.art, antwort.text.chars().take(160).collect::<String>());
    if antwort.status != 400 {
        return Err(format!("Status 400 erwartet: {gesehen}"));
    }
    if antwort.art != "application/json" {
        return Err(format!("Content-Type application/json erwartet: {gesehen}"));
    }
    match antwort.json()["fehler"].as_str() {
        Some(fehler) if !fehler.is_empty() => Ok(fehler.to_string()),
        _ => Err(format!("Objekt mit nicht leerem Feld fehler erwartet: {gesehen}")),
    }
}

/// R00154 „nennt den Parameter“: der Name steht als eigenes Wort in der Meldung — davor und danach kein Buchstabe, keine Ziffer, kein `_`.
fn nennt(fehler: &str, name: &str) -> bool {
    let wortzeichen = |z: char| z.is_alphanumeric() || z == '_';
    fehler.match_indices(name).any(|(ab, _)| !fehler[..ab].chars().next_back().is_some_and(wortzeichen) && !fehler[ab + name.len()..].chars().next().is_some_and(wortzeichen))
}

/// R00154 „Meldung“: nennt `name`, keinen der `anderen` Parameter der Route und trägt keinen Text des Rahmens.
fn meldung_nennt_nur(fehler: &str, name: &str, andere: &[&str]) -> Result<(), String> {
    if !nennt(fehler, name) {
        return Err(format!("„{name}“ steht nicht als eigenes Wort in der Meldung: {fehler}"));
    }
    if let Some(anderer) = andere.iter().find(|anderer| **anderer != name && nennt(fehler, anderer)) {
        return Err(format!("die Meldung nennt den anderen Parameter „{anderer}“: {fehler}"));
    }
    match RAHMENTEXT.iter().find(|wort| fehler.contains(**wort)) {
        Some(wort) => Err(format!("Text des Rahmens „{wort}“ in der Meldung: {fehler}")),
        None => Ok(()),
    }
}

/// Sendet ohne Rumpf und verlangt die Abweisung in der Form, die `name` nennt und keinen der `anderen`; liefert die Meldung.
async fn abgewiesen(adresse: &str, methode: Method, pfad: &str, name: &str, andere: &[&str]) -> String {
    let antwort = senden_roh(methode, adresse, pfad, "st", None, "").await;
    let fehler = form(&antwort).unwrap_or_else(|grund| panic!("{pfad}: {grund}"));
    meldung_nennt_nur(&fehler, name, andere).unwrap_or_else(|grund| panic!("{pfad}: {grund}"));
    fehler
}

fn grundbestand() -> (tempfile::TempDir, gemeinsam::Laufendes) {
    let tmp = tempfile::tempdir().unwrap();
    mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    (tmp, lauf)
}

/// Je Zeile der Tabelle und je Parameter aus `auswahl` eine Anfrage, in der dieser Parameter `wert` trägt; liefert die roten Zeilen und die Zahl der Anfragen.
async fn tabelle_fahren(adresse: &str, wert: &str, auswahl: impl Fn(&[&str], &'static [&'static str]) -> Vec<String>) -> (Vec<String>, usize) {
    let (mut rot, mut anfragen) = (Vec::new(), 0);
    for (nr, (methode, schablone, zahlen)) in MIT_PFADPARAMETER.iter().enumerate() {
        let alle = parameter(schablone);
        for name in auswahl(&alle, zahlen) {
            anfragen += 1;
            let pfad = gesendeter_pfad(schablone, &[(&name, wert)]);
            let antwort = senden_roh(methode.parse().unwrap(), adresse, &pfad, "st", None, "").await;
            let urteil = form(&antwort).and_then(|fehler| {
                meldung_nennt_nur(&fehler, &name, &alle)?;
                if fehler.contains(wert) { Err(format!("der gesendete Wert steht in der Meldung: {fehler}")) } else { Ok(()) }
            });
            if let Err(grund) = urteil {
                rot.push(format!("Zeile {} {methode} {schablone} mit {name}={wert}: {grund}", nr + 1));
            }
        }
    }
    (rot, anfragen)
}

// AK 1, AK 2, AK 7, AK 9 (68 Antworten, seit R00165 mit den Kosteneinträgen 73, seit R00195 mit den Klassen des Boards 74, seit R00202 mit den Commit-Verweisen 77) · US-4
#[tokio::test]
async fn jede_route_weist_ungueltiges_utf8_an_jedem_pfadparameter_mit_400_und_dem_parameternamen_ab() {
    let (tmp, lauf) = grundbestand();
    let vorher = stand(tmp.path());
    let (rot, anfragen) = tabelle_fahren(&lauf.adresse, "%FF", |alle, _| alle.iter().map(|n| n.to_string()).collect()).await;
    assert_eq!(anfragen, 77, "45 Routen mit einem Parameter + 16 mit zweien");
    assert!(rot.is_empty(), "{} von 77 Anfragen rot:\n{}", rot.len(), rot.join("\n"));
    assert_eq!(stand(tmp.path()), vorher, "kein Commit, keine offene Änderung");
}

// AK 1, AK 4, AK 7, AK 9 (35 Antworten, seit R00165 mit den Kosteneinträgen 38, seit R00202 mit den Commit-Verweisen 40) · US-1, US-2
#[tokio::test]
async fn jeder_zahlenparameter_weist_einen_text_mit_400_und_dem_parameternamen_ab() {
    let (tmp, lauf) = grundbestand();
    let vorher = stand(tmp.path());
    let (rot, anfragen) = tabelle_fahren(&lauf.adresse, "abc", |_, zahlen| zahlen.iter().map(|n| n.to_string()).collect()).await;
    assert_eq!(anfragen, 40, "22 mit nr allein + 9 mit nr vor einem Text + 4 × 2 (nr und i) + 1 (nr hinter slug)");
    assert!(rot.is_empty(), "{} von 40 Anfragen rot:\n{}", rot.len(), rot.join("\n"));
    assert_eq!(stand(tmp.path()), vorher, "kein Commit, keine offene Änderung");
}

// AK 3
#[tokio::test]
async fn die_tabelle_nennt_jede_route_der_beschreibung_mit_pfadparameter_genau_einmal() {
    let (_tmp, lauf) = grundbestand();
    let liste: serde_json::Value = reqwest::get(format!("{}api/endpunkte", lauf.adresse)).await.unwrap().json().await.unwrap();
    let eintraege = liste.as_array().unwrap();
    let beschrieben: Vec<String> = eintraege.iter().filter(|e| e["pfad"].as_str().unwrap().split('?').next().unwrap().contains('{')).map(|e| format!("{} {}", e["methode"].as_str().unwrap(), e["pfad"].as_str().unwrap())).collect();
    let benannt: BTreeSet<String> = MIT_PFADPARAMETER.iter().map(|(m, p, _)| format!("{m} {p}")).collect();
    assert_eq!((eintraege.len(), beschrieben.len(), benannt.len()), (87, 61, 61), "87 Einträge, 61 mit Pfadparameter, keine Zeile doppelt");
    let beschrieben: BTreeSet<String> = beschrieben.into_iter().collect();
    assert_eq!(beschrieben.difference(&benannt).collect::<Vec<_>>(), Vec::<&String>::new(), "Route mit Pfadparameter fehlt in der Tabelle zu AK 2");
    assert_eq!(benannt.difference(&beschrieben).collect::<Vec<_>>(), Vec::<&String>::new(), "Zeile der Tabelle fehlt in der Beschreibung");
    let stellen: usize = MIT_PFADPARAMETER.iter().map(|(_, p, _)| parameter(p).len()).sum();
    let zahlen: usize = MIT_PFADPARAMETER.iter().map(|(_, _, z)| z.len()).sum();
    assert_eq!((stellen, zahlen), (77, 40), "77 Parameterstellen, davon 40 Zahlen");
    for (_, schablone, zahlen) in MIT_PFADPARAMETER {
        assert!(zahlen.iter().all(|z| parameter(schablone).contains(z)), "{schablone}: jede Zahl ist ein Parameter der Schablone");
    }
}

// AK 5
#[tokio::test]
async fn grenzen_der_zahl_und_zwei_typfehler_zugleich_nennen_den_ersten_falschen_parameter() {
    let (_tmp, lauf) = grundbestand();
    for wert in ["-1", "99999999999", "4294967296"] {
        let fehler = abgewiesen(&lauf.adresse, Method::GET, &format!("api/aufgaben/{wert}"), "nr", &[]).await;
        assert!(!fehler.contains(wert), "{fehler}");
    }
    abgewiesen(&lauf.adresse, Method::DELETE, "api/aufgaben/abc/teilaufgaben/abc", "nr", &["i"]).await;
    abgewiesen(&lauf.adresse, Method::DELETE, "api/aufgaben/1/teilaufgaben/-1", "i", &["nr"]).await;
}

// AK 1, AK 6, AK 7, AK 9 (6 Antworten) · US-3
#[tokio::test]
async fn ein_fehlender_oder_doppelter_abfrageparameter_wird_mit_400_und_dem_feldnamen_abgewiesen() {
    let (_tmp, lauf) = grundbestand();
    let mut rot = Vec::new();
    for (nr, (anfrage, feld)) in ABFRAGEN.iter().enumerate() {
        let antwort = senden_roh(Method::GET, &lauf.adresse, &anfrage[1..], "st", None, "").await;
        if let Err(grund) = form(&antwort).and_then(|fehler| meldung_nennt_nur(&fehler, feld, &["board", "archivierte", "slug"])) {
            rot.push(format!("Zeile {} GET {anfrage}: {grund}", nr + 1));
        }
    }
    assert!(rot.is_empty(), "{} von 6 Zeilen rot:\n{}", rot.len(), rot.join("\n"));
}

// AK 7
#[tokio::test]
async fn die_meldung_wiederholt_den_gesendeten_wert_nicht() {
    let (_tmp, lauf) = grundbestand();
    let fehler = abgewiesen(&lauf.adresse, Method::GET, "api/aufgaben/Zx9-Inhalt", "nr", &[]).await;
    assert!(!fehler.contains("Zx9-Inhalt"), "{fehler}");
    let fehler = abgewiesen(&lauf.adresse, Method::GET, "api/berichte/verlauf?board=zx9a&board=zx9b", "board", &[]).await;
    assert!(!fehler.contains("zx9a") && !fehler.contains("zx9b"), "{fehler}");
}

// AK 8
#[tokio::test]
async fn der_pfad_antwortet_vor_dem_rumpf() {
    let (tmp, lauf) = grundbestand();
    let aufgabe = lies(tmp.path(), "aufgaben/0001-eins.md");
    let vorher = stand(tmp.path());
    for (art, rumpf) in [("application/json", r#"{"titel": 5}"#), ("application/x-www-form-urlencoded", "x")] {
        let antwort = senden_roh(Method::PATCH, &lauf.adresse, "api/aufgaben/abc", "st", Some(art), rumpf).await;
        let fehler = form(&antwort).unwrap_or_else(|grund| panic!("{art}: {grund}"));
        meldung_nennt_nur(&fehler, "nr", &["titel"]).unwrap_or_else(|grund| panic!("{art}: {grund}"));
    }
    assert_eq!((lies(tmp.path(), "aufgaben/0001-eins.md"), stand(tmp.path())), (aufgabe, vorher), "Aufgabe #1 unverändert, kein Commit");
}

// ---- Gegenproben: am Stand vor dem Fix gemessen und festgeschrieben (R00154 AK 10–15) ----

/// Sendet und liefert die Antwort samt der Kopfzeile `allow`.
async fn roh_mit_allow(adresse: &str, methode: Method, pfad: &str) -> (u16, String, String, String) {
    let r = reqwest::Client::new().request(methode, format!("{adresse}{pfad}")).header("X-KanbanD-Wer", "st").send().await.unwrap();
    let kopf = |name: &str| r.headers().get(name).and_then(|w| w.to_str().ok()).unwrap_or_default().to_string();
    (r.status().as_u16(), kopf("content-type"), kopf("allow"), r.text().await.unwrap())
}

// AK 10 · US-5: lesend, je Extraktor-Art — eine Zahl, Text und Abfrage, Pflichtfeld der Abfrage
#[tokio::test]
async fn gueltige_parameter_lesen_wie_vor_dem_fix_und_ohne_commit() {
    let (tmp, lauf) = grundbestand();
    let vorher = stand(tmp.path());
    let aufgabe = senden_roh(Method::GET, &lauf.adresse, "api/aufgaben/1", "st", None, "").await;
    assert_eq!((aufgabe.status, aufgabe.art.as_str()), (200, "application/json"));
    assert_eq!((aufgabe.json()["nummer"].as_u64(), aufgabe.json()["titel"].as_str(), aufgabe.json()["pfad"].as_str()), (Some(1), Some("eins"), Some("aufgaben/0001-eins.md")));
    let board = senden_roh(Method::GET, &lauf.adresse, "api/boards/entwicklung?archivierte=ja", "st", None, "").await;
    assert_eq!((board.status, board.json()["slug"].as_str(), &board.json()["spalten"][0]["aufgaben"]), (200, Some("entwicklung"), &serde_json::json!([1, 2, 3])));
    let boards = senden_roh(Method::GET, &lauf.adresse, "api/boards?archivierte=ja", "st", None, "").await;
    assert_eq!((boards.status, boards.json()[0]["slug"].as_str(), boards.json().as_array().map(Vec::len)), (200, Some("entwicklung"), Some(1)));
    let verlauf = senden_roh(Method::GET, &lauf.adresse, "api/berichte/verlauf?board=entwicklung", "st", None, "").await;
    assert_eq!((verlauf.status, verlauf.json()["tage"][0]["offen"].as_u64(), verlauf.json()["tage"][0]["umfang"].as_u64()), (200, Some(3), Some(3)));
    let bewegungen = senden_roh(Method::GET, &lauf.adresse, "api/berichte/bewegungen?board=entwicklung", "st", None, "").await;
    assert_eq!((bewegungen.status, &bewegungen.json()["spalten"]), (200, &serde_json::json!(["Zu erledigen", "In Arbeit", "Erledigt"])));
    let filter = senden_roh(Method::GET, &lauf.adresse, "api/aufgaben?board=entwicklung&spalte=Zu%20erledigen", "st", None, "").await;
    assert_eq!((filter.status, filter.json()["aufgaben"].as_array().map(Vec::len)), (200, Some(3)), "freie Paare der Abfrage");
    assert_eq!(stand(tmp.path()), vorher, "lesend: kein Commit");
}

// AK 10: schreibend mit zwei Zahlen im Pfad — Erfolg und genau ein Commit je Anfrage
#[tokio::test]
async fn zwei_gueltige_zahlen_im_pfad_schreiben_mit_genau_einem_commit_je_anfrage() {
    let (tmp, lauf) = grundbestand();
    let commits = || git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse::<u32>().unwrap();
    let vorher = commits();
    let angelegt = senden_roh(Method::POST, &lauf.adresse, "api/aufgaben/1/teilaufgaben", "st", Some("application/json"), r#"{"text": "x"}"#).await;
    assert_eq!((angelegt.status, &angelegt.json()["teilaufgaben"], commits()), (200, &serde_json::json!([{"text": "x", "erledigt": false}]), vorher + 1));
    let abgehakt = senden_roh(Method::PATCH, &lauf.adresse, "api/aufgaben/1/teilaufgaben/0", "st", Some("application/json"), r#"{"erledigt": true}"#).await;
    assert_eq!((abgehakt.status, &abgehakt.json()["teilaufgaben"], commits()), (200, &serde_json::json!([{"text": "x", "erledigt": true}]), vorher + 2));
    assert_eq!(git(tmp.path(), &["status", "--porcelain"]), "", "keine offene Änderung");
}

// AK 11, AK 12 · US-5: Fachantworten wörtlich; %FF im Abfragewert weist der Rahmen nicht ab
#[tokio::test]
async fn fachantworten_und_ungueltiges_utf8_im_abfragewert_antworten_woertlich_wie_vor_dem_fix() {
    let (_tmp, lauf) = grundbestand();
    for (pfad, status, rumpf) in [
        ("api/aufgaben/999", 404, r#"{"fehler":"Aufgabe #999 gibt es nicht"}"#),
        ("api/berichte/verlauf?board=gibtsnicht", 404, r#"{"fehler":"Board „gibtsnicht“ gibt es nicht"}"#),
        ("api/aufgaben?unsinn=1", 400, r#"{"fehler":"Unbekannter Filter „unsinn“ — board, spalte, klasse, signal, zustaendig, reserviert, label, key, archivierte"}"#),
        ("api/aufgaben?board=%FF", 400, "{\"fehler\":\"Board-Name „\u{FFFD}“ ungültig: 1–40 Zeichen aus a–z, 0–9, -\"}"),
        ("api/berichte/verlauf?board=%FF", 400, "{\"fehler\":\"Board-Name „\u{FFFD}“ ungültig: 1–40 Zeichen aus a–z, 0–9, -\"}"),
        ("api/aufgaben?%FF=1", 400, "{\"fehler\":\"Unbekannter Filter „\u{FFFD}“ — board, spalte, klasse, signal, zustaendig, reserviert, label, key, archivierte\"}"),
        ("api/boards/x?archivierte=%FF", 404, r#"{"fehler":"Board „x“ gibt es nicht"}"#),
        ("api/aufgaben/1/anhaenge/x.txt", 404, r##"{"fehler":"#1 hat keinen Anhang „x.txt“"}"##),
    ] {
        let antwort = senden_roh(Method::GET, &lauf.adresse, pfad, "st", None, "").await;
        assert_eq!((antwort.status, antwort.art.as_str(), antwort.text.as_str()), (status, "application/json", rumpf), "{pfad}");
    }
}

// AK 13 · US-5: 404 und 405 entstehen im Router, nicht in einem Extraktor (ADR-0003 N4 Punkt 6) — leerer Rumpf, kein Content-Type
#[tokio::test]
async fn unbekannte_route_und_falsche_methode_antworten_mit_leerem_rumpf_wie_vor_dem_fix() {
    let (_tmp, lauf) = grundbestand();
    for (methode, pfad, status, allow) in [
        (Method::GET, "api/gibtsnicht", 404, ""),
        (Method::GET, "gibtsnicht", 404, ""),
        (Method::PUT, "api/aufgaben/1", 405, "GET,HEAD,PATCH,DELETE"),
        (Method::DELETE, "api/zustand", 405, "GET,HEAD"),
        (Method::GET, "api/aufgaben/abc/teilaufgaben/0", 405, "PATCH,DELETE"),
    ] {
        assert_eq!(roh_mit_allow(&lauf.adresse, methode.clone(), pfad).await, (status, String::new(), allow.to_string(), String::new()), "{methode} {pfad}");
    }
}

// AK 14: /web/{*name} ist keine API-Route und bleibt beim Extraktor des Rahmens
#[tokio::test]
async fn statische_dateien_antworten_wie_vor_dem_fix() {
    let (_tmp, lauf) = grundbestand();
    let fehlt = senden_roh(Method::GET, &lauf.adresse, "web/gibtsnicht.js", "st", None, "").await;
    assert_eq!((fehlt.status, fehlt.art.as_str(), fehlt.text.as_str()), (404, "text/plain; charset=utf-8", "nicht gefunden"));
    let kaputt = senden_roh(Method::GET, &lauf.adresse, "web/%FF", "st", None, "").await;
    assert_eq!((kaputt.status, kaputt.art.as_str(), kaputt.text.as_str()), (400, "text/plain; charset=utf-8", "Invalid URL: Invalid UTF-8 in `name`"));
}

// AK 15: die Beschreibung nennt an jeder Route die Pfadparameter der Schablone und an fünf Routen die Abfrageparameter
#[tokio::test]
async fn die_beschreibung_nennt_jeden_pfad_und_abfrageparameter() {
    let (_tmp, lauf) = grundbestand();
    let api: serde_json::Value = reqwest::get(format!("{}api/openapi.json", lauf.adresse)).await.unwrap().json().await.unwrap();
    let (mut routen, mut mit_pfad, mut abfragen) = (0, BTreeSet::new(), Vec::new());
    for (pfad, methoden) in api["paths"].as_object().unwrap() {
        for (methode, beschreibung) in methoden.as_object().unwrap() {
            routen += 1;
            let genannt = |ort: &str| -> Vec<String> { beschreibung["parameters"].as_array().into_iter().flatten().filter(|p| p["in"] == ort).map(|p| p["name"].as_str().unwrap().to_string()).collect() };
            assert_eq!(genannt("path"), parameter(pfad), "{methode} {pfad}");
            if !genannt("path").is_empty() {
                mit_pfad.insert(format!("{} {pfad}", methode.to_uppercase()));
            }
            if !genannt("query").is_empty() {
                abfragen.push(format!("{methode} {pfad}: {}", genannt("query").join(", ")));
            }
        }
    }
    assert_eq!(routen, 87);
    assert_eq!(mit_pfad, MIT_PFADPARAMETER.iter().map(|(m, p, _)| format!("{m} {p}")).collect::<BTreeSet<_>>(), "die 61 Routen der Tabelle");
    assert_eq!(abfragen, [
        "get /api/aufgaben: board, spalte, klasse, signal, zustaendig, reserviert, label, key, archivierte",
        "get /api/berichte/bewegungen: board",
        "get /api/berichte/verlauf: board",
        "get /api/boards: archivierte",
        "get /api/boards/{slug}: archivierte",
    ]);
}
