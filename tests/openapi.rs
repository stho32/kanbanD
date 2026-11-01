// R00093 OpenAPI-Beschreibung
mod gemeinsam;

use serde_json::Value;

async fn beschreibung(adresse: &str) -> Value {
    reqwest::get(format!("{adresse}api/openapi.json")).await.unwrap().json().await.unwrap()
}

/// Löst `#/components/schemas/X` auf; ein nicht auflösbarer Verweis ist ein Fehler.
fn alle_verweise(v: &Value, d: &Value, fehlend: &mut Vec<String>) {
    match v {
        Value::Object(m) => {
            if let Some(r) = m.get("$ref").and_then(Value::as_str) {
                let ziel = r.trim_start_matches("#/").split('/').fold(d, |x, teil| &x[teil]);
                if ziel.is_null() {
                    fehlend.push(r.to_string());
                }
            }
            m.values().for_each(|w| alle_verweise(w, d, fehlend));
        }
        Value::Array(a) => a.iter().for_each(|w| alle_verweise(w, d, fehlend)),
        _ => {}
    }
}

#[tokio::test]
async fn openapi_31_vollstaendig_und_aufloesbar() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d = beschreibung(&lauf.adresse).await;
    assert!(d["openapi"].as_str().unwrap().starts_with("3.1"));
    assert_eq!(d["info"]["version"], env!("CARGO_PKG_VERSION"));
    assert!(d["info"]["description"].as_str().unwrap().contains("ein Objekt kommt direkt, eine Liste verpackt"));
    let mut fehlend = vec![];
    alle_verweise(&d, &d, &mut fehlend);
    assert!(fehlend.is_empty(), "nicht auflösbar: {fehlend:?}");
    // jede Zeile der Endpunktliste steht in der Beschreibung, und umgekehrt
    let tabelle: Vec<(String, String)> = kanband::web::endpunkte::ENDPUNKTE.iter().map(|e| (e.methode.to_lowercase(), e.pfad.split('?').next().unwrap().to_string())).collect();
    let mut beschrieben = vec![];
    for (pfad, ops) in d["paths"].as_object().unwrap() {
        for m in ops.as_object().unwrap().keys() {
            beschrieben.push((m.clone(), pfad.clone()));
        }
    }
    for t in &tabelle {
        assert!(beschrieben.contains(t), "in /api/endpunkte, nicht in OpenAPI: {t:?}");
    }
    for b in &beschrieben {
        assert!(tabelle.contains(b), "in OpenAPI, nicht in /api/endpunkte: {b:?}");
    }
}

#[tokio::test]
async fn ziehen_person_und_header() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d = beschreibung(&lauf.adresse).await;
    let ziehen = &d["paths"]["/api/boards/{slug}/ziehen"]["post"];
    let rumpf = ziehen["requestBody"]["content"]["application/json"]["schema"]["$ref"].as_str().unwrap().rsplit('/').next().unwrap().to_string();
    let felder = &d["components"]["schemas"][&rumpf]["properties"];
    assert!(felder["von"].is_object() && felder["nach"].is_object(), "{felder}");
    for status in ["200", "400", "404"] {
        assert!(ziehen["responses"][status].is_object(), "Antwort {status}");
    }
    let namen: Vec<&str> = ziehen["parameters"].as_array().unwrap().iter().map(|p| p["name"].as_str().unwrap()).collect();
    assert!(namen.contains(&"X-KanbanD-Wer") && namen.contains(&"X-KanbanD-Instanz") && namen.contains(&"slug"), "{namen:?}");
    assert_eq!(d["components"]["schemas"]["Art"]["enum"], serde_json::json!(["human", "agent"]));
    assert_eq!(d["components"]["schemas"]["Person"]["properties"]["art"]["$ref"], "#/components/schemas/Art");
    assert_eq!(d["components"]["schemas"]["Ergebnis"]["enum"], serde_json::json!(["bestanden", "befund", "entfaellt"]));
    assert!(d["components"]["schemas"]["Zeiteintrag"]["properties"]["kennung"].is_object(), "berechnetes Feld beschrieben");
}

#[tokio::test]
async fn accept_json_auf_api_leitet_weiter() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let ohne_folgen = reqwest::Client::builder().redirect(reqwest::redirect::Policy::none()).build().unwrap();
    let r = ohne_folgen.get(format!("{}api", lauf.adresse)).header("Accept", "application/json").send().await.unwrap();
    assert_eq!(r.status().as_u16(), 303);
    assert_eq!(r.headers()["location"], "/api/openapi.json");
    let seite = ohne_folgen.get(format!("{}api", lauf.adresse)).header("Accept", "text/html").send().await.unwrap();
    assert_eq!(seite.status().as_u16(), 200);
    assert!(seite.text().await.unwrap().contains("<b><a href=\"/api/openapi.json\">"), "die Seite verlinkt die Beschreibung oben");
}

/// R00096 B0284: die neun Endpunkte, an denen ein Agent an der WIP-Grenze abgewiesen wird; `true` = Zug mit Warnung für Menschen.
const GRENZE: [(&str, &str, bool); 9] = [
    ("post", "/api/boards/{slug}/ziehen", true),
    ("post", "/api/boards/{slug}/bewegen", true),
    ("post", "/api/boards/{slug}/bewegen-mehrere", true),
    ("post", "/api/aufgaben", false),
    ("post", "/api/aufgaben/mehrere", false),
    ("post", "/api/boards/{slug}/aufgaben", false),
    ("post", "/api/boards/{slug}/aufgaben/mehrere", false),
    ("post", "/api/aufgaben/{nr}/zurueckholen", false),
    ("post", "/api/aufgaben/zurueckholen", false),
];

#[tokio::test]
async fn neun_endpunkte_nennen_die_grenze() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d = beschreibung(&lauf.adresse).await;
    let seite = reqwest::get(format!("{}api", lauf.adresse)).await.unwrap().text().await.unwrap();
    let agent = "Agent über der WIP-Grenze → 409";
    for (methode, pfad, zug) in GRENZE {
        let mensch = if zug { "Mensch: Warnung grenze" } else { "Mensch: ohne Warnung" };
        let zeile = kanband::web::endpunkte::ENDPUNKTE.iter().find(|e| e.methode.eq_ignore_ascii_case(methode) && e.pfad == pfad).unwrap();
        assert!(zeile.zweck.contains(agent) && zeile.zweck.contains(mensch), "/api/endpunkte {pfad}: {}", zeile.zweck);
        let op = &d["paths"][pfad][methode];
        let text = op["description"].as_str().unwrap();
        assert!(text.contains(agent) && text.contains(mensch), "openapi {pfad}: {text}");
        let verweis = op["responses"]["409"]["content"]["application/json"]["schema"]["$ref"].as_str().unwrap_or_default();
        let schema = d["components"]["schemas"][verweis.rsplit('/').next().unwrap()].to_string();
        assert!(schema.contains("#/components/schemas/GrenzeErreicht") && schema.contains("#/components/schemas/Fehlerantwort"), "409 {pfad}: {schema}");
    }
    let zaehle = |t: &str| seite.matches(t).count();
    assert_eq!((zaehle(agent), zaehle("Mensch: Warnung grenze"), zaehle("Mensch: ohne Warnung")), (9, 3, 6), "Seite /api");
    let felder = &d["components"]["schemas"]["GrenzeErreicht"]["properties"];
    assert!(["fehler", "spalte", "grenze", "anzahl"].iter().all(|f| felder[f].is_object()), "{felder}");
}
