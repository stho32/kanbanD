// R00154 (I0141, Karte #168): Ein falscher Pfad- oder Abfrageparameter wird an jeder Route mit 400 und {fehler} abgewiesen (ADR-0003 N4)
mod gemeinsam;

use gemeinsam::{Antwort, git, lies, mit_drei_aufgaben, senden_roh};
use reqwest::Method;
use std::collections::BTreeSet;
use std::path::Path;

/// R00154 AK 2: Methode, Schablone des Pfads und die Parameter, die eine Zahl sind — die Parameter selbst stehen in der Schablone.
const MIT_PFADPARAMETER: [(&str, &str, &[&str]); 55] = [
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
    ("POST", "/api/aufgaben/{nr}/zurueckholen", &["nr"]),
    ("GET", "/api/boards/{slug}", &[]),
    ("PATCH", "/api/boards/{slug}", &[]),
    ("DELETE", "/api/boards/{slug}", &[]),
    ("PUT", "/api/boards/{slug}/anwendungen", &[]),
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

// AK 1, AK 2, AK 7, AK 9 (68 Antworten) · US-4
#[tokio::test]
#[ignore = "erwartet rot bis B0718"]
async fn jede_route_weist_ungueltiges_utf8_an_jedem_pfadparameter_mit_400_und_dem_parameternamen_ab() {
    let (tmp, lauf) = grundbestand();
    let vorher = stand(tmp.path());
    let (rot, anfragen) = tabelle_fahren(&lauf.adresse, "%FF", |alle, _| alle.iter().map(|n| n.to_string()).collect()).await;
    assert_eq!(anfragen, 68, "42 Routen mit einem Parameter + 13 mit zweien");
    assert!(rot.is_empty(), "{} von 68 Anfragen rot:\n{}", rot.len(), rot.join("\n"));
    assert_eq!(stand(tmp.path()), vorher, "kein Commit, keine offene Änderung");
}

// AK 1, AK 4, AK 7, AK 9 (35 Antworten) · US-1, US-2
#[tokio::test]
#[ignore = "erwartet rot bis B0718"]
async fn jeder_zahlenparameter_weist_einen_text_mit_400_und_dem_parameternamen_ab() {
    let (tmp, lauf) = grundbestand();
    let vorher = stand(tmp.path());
    let (rot, anfragen) = tabelle_fahren(&lauf.adresse, "abc", |_, zahlen| zahlen.iter().map(|n| n.to_string()).collect()).await;
    assert_eq!(anfragen, 35, "20 mit nr allein + 6 mit nr vor einem Text + 4 × 2 (nr und i) + 1 (nr hinter slug)");
    assert!(rot.is_empty(), "{} von 35 Anfragen rot:\n{}", rot.len(), rot.join("\n"));
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
    assert_eq!((eintraege.len(), beschrieben.len(), benannt.len()), (80, 55, 55), "80 Einträge, 55 mit Pfadparameter, keine Zeile doppelt");
    let beschrieben: BTreeSet<String> = beschrieben.into_iter().collect();
    assert_eq!(beschrieben.difference(&benannt).collect::<Vec<_>>(), Vec::<&String>::new(), "Route mit Pfadparameter fehlt in der Tabelle zu AK 2");
    assert_eq!(benannt.difference(&beschrieben).collect::<Vec<_>>(), Vec::<&String>::new(), "Zeile der Tabelle fehlt in der Beschreibung");
    let stellen: usize = MIT_PFADPARAMETER.iter().map(|(_, p, _)| parameter(p).len()).sum();
    let zahlen: usize = MIT_PFADPARAMETER.iter().map(|(_, _, z)| z.len()).sum();
    assert_eq!((stellen, zahlen), (68, 35), "68 Parameterstellen, davon 35 Zahlen");
    for (_, schablone, zahlen) in MIT_PFADPARAMETER {
        assert!(zahlen.iter().all(|z| parameter(schablone).contains(z)), "{schablone}: jede Zahl ist ein Parameter der Schablone");
    }
}

// AK 5
#[tokio::test]
#[ignore = "erwartet rot bis B0718"]
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
#[ignore = "erwartet rot bis B0718"]
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
#[ignore = "erwartet rot bis B0718"]
async fn die_meldung_wiederholt_den_gesendeten_wert_nicht() {
    let (_tmp, lauf) = grundbestand();
    let fehler = abgewiesen(&lauf.adresse, Method::GET, "api/aufgaben/Zx9-Inhalt", "nr", &[]).await;
    assert!(!fehler.contains("Zx9-Inhalt"), "{fehler}");
    let fehler = abgewiesen(&lauf.adresse, Method::GET, "api/berichte/verlauf?board=zx9a&board=zx9b", "board", &[]).await;
    assert!(!fehler.contains("zx9a") && !fehler.contains("zx9b"), "{fehler}");
}

// AK 8
#[tokio::test]
#[ignore = "erwartet rot bis B0718"]
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
