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
    assert!(d["info"]["description"].as_str().unwrap().contains("Ein Objekt kommt direkt, eine Liste verpackt"));
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

/// Karte #142 Nacharbeit B2: die Beschreibungen nennen die gebaute Fail-safe-Sperre — jeder Nicht-Skalar und jede
/// Schreibweise von `human`/`mensch` unter `column-owner` sperrt Agenten über das ganze Board. Vorher stand dort
/// „ein unbekannter Wert gilt nicht“ und verschwieg die Sperre — heute nennt der Text die fail-safe Sperre.
#[tokio::test]
async fn beschreibung_nennt_die_fail_safe_sperre() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d = beschreibung(&lauf.adresse).await;
    let satz = "ein Eintrag unter `column-owner`, der kein Skalar ist oder den Menschen meint (`human`/`mensch` in jeder Schreibweise), sperrt Agenten fail-safe (403)";
    let info = d["info"]["description"].as_str().unwrap();
    assert!(info.contains(satz), "info: {info}");
    for pfad in ["/api/boards", "/api/boards/{slug}"] {
        let text = d["paths"][pfad]["get"]["description"].as_str().unwrap();
        assert!(text.contains(satz), "{pfad}: {text}");
        assert!(!text.contains("gilt nicht"), "{pfad} verschweigt die Sperre: {text}");
    }
    let liste: Vec<&str> = kanband::web::endpunkte::ENDPUNKTE.iter().filter(|e| e.methode == "GET" && (e.pfad == "/api/boards" || e.pfad == "/api/boards/{slug}")).map(|e| e.zweck).collect();
    assert_eq!(liste.len(), 2);
    for zweck in liste {
        assert!(zweck.contains(satz), "/api/endpunkte: {zweck}");
    }
    let seite = kanband::web::endpunkte::api_seite("http://h:1/");
    assert!(seite.contains("fail-safe"), "die API-Seite nennt die fail-safe Sperre nicht");
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

/// Karte #130 (S2 aus #124): duplizieren nimmt den Rumpf freiwillig — der Handler liest `Option<Json<Zielort>>`,
/// POST ohne Rumpf antwortet 201. Die Beschreibung darf ihn deshalb nicht als Pflicht deklarieren (OpenAPI-Standard:
/// fehlt `required`, ist der Rumpf freiwillig).
#[tokio::test]
async fn duplizieren_hat_einen_freiwilligen_rumpf() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d = beschreibung(&lauf.adresse).await;
    let rumpf = &d["paths"]["/api/aufgaben/{nr}/duplizieren"]["post"]["requestBody"];
    assert!(rumpf["content"]["application/json"]["schema"].is_object(), "Rumpf-Schema fehlt: {rumpf}");
    assert!(!rumpf["required"].as_bool().unwrap_or(false), "Rumpf ist freiwillig: {rumpf}");
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

/// R00096 B0284: die zehn Endpunkte, an denen ein Agent an der WIP-Grenze abgewiesen wird; `true` = Zug mit Warnung für Menschen.
/// R00142: duplizieren legt an und prüft die Grenze wie das Anlegen — ein Mensch wird ohne Warnung durchgelassen.
const GRENZE: [(&str, &str, bool); 10] = [
    ("post", "/api/boards/{slug}/ziehen", true),
    ("post", "/api/boards/{slug}/bewegen", true),
    ("post", "/api/boards/{slug}/bewegen-mehrere", true),
    ("post", "/api/aufgaben", false),
    ("post", "/api/aufgaben/mehrere", false),
    ("post", "/api/aufgaben/{nr}/duplizieren", false),
    ("post", "/api/boards/{slug}/aufgaben", false),
    ("post", "/api/boards/{slug}/aufgaben/mehrere", false),
    ("post", "/api/aufgaben/{nr}/zurueckholen", false),
    ("post", "/api/aufgaben/zurueckholen", false),
];

#[tokio::test]
async fn zehn_endpunkte_nennen_die_grenze() {
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
    assert_eq!((zaehle(agent), zaehle("Mensch: Warnung grenze"), zaehle("Mensch: ohne Warnung")), (10, 3, 7), "Seite /api");
    let felder = &d["components"]["schemas"]["GrenzeErreicht"]["properties"];
    assert!(["fehler", "spalte", "grenze", "anzahl"].iter().all(|f| felder[f].is_object()), "{felder}");
}

/// R00097 B0298/R00128/R00141: die neun Endpunkte, an denen ein Agent keine Karte aus einer Menschen-Spalte nimmt,
/// ein ganzes Board nicht archiviert oder löscht bzw. eine Aufgabe nicht endgültig löscht.
const SPERRE: [(&str, &str); 9] = [
    ("post", "/api/boards/{slug}/ziehen"),
    ("post", "/api/boards/{slug}/bewegen"),
    ("post", "/api/boards/{slug}/bewegen-mehrere"),
    ("delete", "/api/boards/{slug}/aufgaben/{nr}"),
    ("post", "/api/aufgaben/{nr}/archivieren"),
    ("post", "/api/aufgaben/archivieren"),
    ("patch", "/api/boards/{slug}"),
    ("delete", "/api/boards/{slug}"),
    ("delete", "/api/aufgaben/{nr}"),
];

#[tokio::test]
async fn neun_endpunkte_nennen_den_eigentuemer_und_spalten_das_feld() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d = beschreibung(&lauf.adresse).await;
    let seite = reqwest::get(format!("{}api", lauf.adresse)).await.unwrap().text().await.unwrap();
    let agent = "Agent aus einer Menschen-Spalte → 403 {fehler, spalte, nummer}";
    let zweck = |methode: &str, pfad: &str| kanband::web::endpunkte::ENDPUNKTE.iter().find(|e| e.methode.eq_ignore_ascii_case(methode) && e.pfad == pfad).unwrap().zweck;
    for (methode, pfad) in SPERRE {
        assert!(zweck(methode, pfad).contains(agent), "/api/endpunkte {pfad}: {}", zweck(methode, pfad));
        let op = &d["paths"][pfad][methode];
        assert!(op["description"].as_str().unwrap().contains(agent), "openapi {pfad}");
        assert_eq!(op["responses"]["403"]["content"]["application/json"]["schema"]["$ref"], "#/components/schemas/Verboten", "403 {pfad}");
    }
    assert_eq!(seite.matches(agent).count(), 9, "Seite /api");
    let felder = &d["components"]["schemas"]["Verboten"]["properties"];
    assert!(["fehler", "spalte", "nummer"].iter().all(|f| felder[f].is_object()), "{felder}");
    let spalten = "eigentuemer: human, agent oder null";
    assert!(zweck("PUT", "/api/boards/{slug}/spalten").contains(spalten), "{}", zweck("PUT", "/api/boards/{slug}/spalten"));
    let put = d["paths"]["/api/boards/{slug}/spalten"]["put"]["description"].as_str().unwrap();
    assert!(put.contains(spalten), "{put}");
    assert!(put.contains("ändern nur Menschen") && zweck("PUT", "/api/boards/{slug}/spalten").contains("ändern nur Menschen"), "PUT …/spalten nennt die Sperre für Agenten");
    assert!(d["components"]["schemas"]["SpaltenAenderung"]["properties"]["eigentuemer"].is_object());
    for text in [zweck("GET", "/api/boards/{slug}"), d["paths"]["/api/boards/{slug}"]["get"]["description"].as_str().unwrap()] {
        assert!(text.contains("eigentuemer: column-owner"), "{text}");
    }
    assert!(d["info"]["description"].as_str().unwrap().contains("schützt vor Versehen, nicht vor Angriffen"), "openapi info");
    assert!(seite.contains("column-owner") && seite.contains("beruht auf <span class=\"mono\">X-KanbanD-Wer</span> und schützt vor Versehen, nicht vor Angriffen"), "Seite /api nennt Eigentümer und Full Trust");
}

/// R00102 B0307: PUT …/spalten nennt die Einstellungsregel; das 403-Schema `EinstellungVerboten` steht nur dort (ADR-0006).
#[tokio::test]
async fn spalten_nennen_die_einstellungsregel_und_nur_dort_ihr_403() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d = beschreibung(&lauf.adresse).await;
    let seite = reqwest::get(format!("{}api", lauf.adresse)).await.unwrap().text().await.unwrap();
    let zweck = kanband::web::endpunkte::ENDPUNKTE.iter().find(|e| e.methode == "PUT" && e.pfad == "/api/boards/{slug}/spalten").unwrap().zweck;
    let put = &d["paths"]["/api/boards/{slug}/spalten"]["put"];
    for text in [zweck, put["description"].as_str().unwrap()] {
        for teil in ["Grenze und Eigentümer ändern nur Menschen", "403 {fehler, spalte, einstellung: grenze|eigentuemer}", "für Agenten nach Spaltennamen", "Umbenennen und Tauschen einer Spalte mit Einstellung zählen als Änderung, auch mit mitgesendeten Werten", "Namen der Anfrage von links, dann bisherige Namen, die fehlen, je Name grenze vor eigentuemer", "grenze fehlt → behält, null oder 0 → entfernt"] {
            assert!(text.contains(teil), "fehlt „{teil}“: {text}");
        }
    }
    assert_eq!(put["responses"]["403"]["content"]["application/json"]["schema"]["$ref"], "#/components/schemas/EinstellungVerboten");
    let felder = d["components"]["schemas"]["EinstellungVerboten"]["properties"].as_object().unwrap();
    assert_eq!(felder.keys().collect::<Vec<_>>(), ["einstellung", "fehler", "spalte"], "{felder:?}");
    let mit_schema: Vec<String> = d["paths"]
        .as_object()
        .unwrap()
        .iter()
        .flat_map(|(pfad, ops)| ops.as_object().unwrap().iter().map(move |(m, op)| (format!("{m} {pfad}"), op)))
        .filter(|(_, op)| op["responses"]["403"].to_string().contains("EinstellungVerboten"))
        .map(|(wo, _)| wo)
        .collect();
    assert_eq!(mit_schema, ["put /api/boards/{slug}/spalten"], "403 EinstellungVerboten nur an PUT …/spalten");
    let satz = "Die Art einer Person (<span class=\"mono\">art</span>) und den Zustand (<span class=\"mono\">aktiv</span>: stilllegen, reaktivieren) einer Person der Art <span class=\"mono\">human</span> setzen nur Menschen (403 <span class=\"mono\">{fehler, kuerzel}</span>";
    assert!(seite.contains(satz), "Seite /api nennt die Personenart- und Zustandsregel");
    assert!(d["info"]["description"].as_str().unwrap().contains("Die Art einer Person (`art`) und den Zustand (`aktiv`: stilllegen, reaktivieren) einer Person der Art `human` setzen nur Menschen (403 `PersonenartVerboten`"), "openapi info");
}

/// Karte #127/#137: `art` und `aktiv` eines Menschen setzen nur Menschen — dieselbe 403-Form `PersonenartVerboten` an den
/// vier Wegen, die sie schreiben.
#[tokio::test]
async fn personenart_verboten_ist_eine_eigene_403_form() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d = beschreibung(&lauf.adresse).await;
    for (methode, pfad) in [("post", "/api/personen"), ("patch", "/api/personen/{kuerzel}"), ("delete", "/api/personen/{kuerzel}"), ("put", "/api/einstellungen")] {
        let op = &d["paths"][pfad][methode];
        assert_eq!(op["responses"]["403"]["content"]["application/json"]["schema"]["$ref"], "#/components/schemas/PersonenartVerboten", "{methode} {pfad}");
        let text = op["description"].as_str().unwrap();
        assert!(text.contains("403 {fehler, kuerzel}"), "{methode} {pfad}: {text}");
        let zweck = kanband::web::endpunkte::ENDPUNKTE.iter().find(|e| e.methode.eq_ignore_ascii_case(methode) && e.pfad == pfad).unwrap().zweck;
        assert!(zweck.contains("403 {fehler, kuerzel}"), "{methode} {pfad} in /api/endpunkte: {zweck}");
    }
    let felder = d["components"]["schemas"]["PersonenartVerboten"]["properties"].as_object().unwrap();
    assert_eq!(felder.keys().collect::<Vec<_>>(), ["fehler", "kuerzel"], "{felder:?}");
    let mut mit_schema: Vec<String> = d["paths"]
        .as_object()
        .unwrap()
        .iter()
        .flat_map(|(pfad, ops)| ops.as_object().unwrap().iter().map(move |(m, op)| (format!("{m} {pfad}"), op)))
        .filter(|(_, op)| op["responses"]["403"].to_string().contains("PersonenartVerboten"))
        .map(|(wo, _)| wo)
        .collect();
    mit_schema.sort();
    // dazu der Trockenlauf des PUT, der dieselbe 403 rechnet, ohne zu schreiben (R00250, ADR-0043 N1.1)
    assert_eq!(mit_schema, ["delete /api/personen/{kuerzel}", "patch /api/personen/{kuerzel}", "post /api/einstellungen/vorschau", "post /api/personen", "put /api/einstellungen"], "403 PersonenartVerboten nur an den Wegen, die art und aktiv schreiben, und am Trockenlauf des PUT");
}

/// R00009 Karte #22: die Beschreibung von PUT …/spalten nennt die `alt`-Semantik samt Verhalten ohne `alt`.
#[tokio::test]
async fn spalten_nennen_die_alt_semantik() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d = beschreibung(&lauf.adresse).await;
    let seite = reqwest::get(format!("{}api", lauf.adresse)).await.unwrap().text().await.unwrap();
    let zweck = kanband::web::endpunkte::ENDPUNKTE.iter().find(|e| e.methode == "PUT" && e.pfad == "/api/boards/{slug}/spalten").unwrap().zweck;
    let put = d["paths"]["/api/boards/{slug}/spalten"]["put"]["description"].as_str().unwrap();
    let satz = "fehlt `alt`, übernimmt die Zeile die Spalte gleichen Namens, sonst bleibt sie neu und leer";
    assert!(zweck.contains(satz), "/api/endpunkte: {zweck}");
    assert!(put.contains(satz), "openapi: {put}");
    assert!(seite.contains(satz), "Seite /api");
}

/// R00099 B0338: POST /api/aufgaben/erledigen ist vollständig beschrieben — Felder, vier Ergebnisse, warnungen, 409 mit Grenze.
#[tokio::test]
async fn erledigen_ist_beschrieben() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d = beschreibung(&lauf.adresse).await;
    let seite = reqwest::get(format!("{}api", lauf.adresse)).await.unwrap().text().await.unwrap();
    let op = &d["paths"]["/api/aufgaben/erledigen"]["post"];
    for status in ["200", "400", "404", "409"] {
        assert!(op["responses"][status].is_object(), "Antwort {status}");
    }
    let konflikt = op["responses"]["409"]["content"]["application/json"]["schema"]["$ref"].as_str().unwrap_or_default();
    let schema = d["components"]["schemas"][konflikt.rsplit('/').next().unwrap()].to_string();
    assert!(schema.contains("#/components/schemas/GrenzeErreicht"), "409: {schema}");
    let erledigt = &d["components"]["schemas"]["Erledigt"]["properties"];
    let ergebnis = erledigt["ergebnis"]["$ref"].as_str().unwrap().rsplit('/').next().unwrap().to_string();
    assert_eq!(d["components"]["schemas"][&ergebnis]["enum"], serde_json::json!(["erledigt", "schon erledigt", "gemeldet", "schon gemeldet"]));
    assert!(erledigt["warnungen"]["items"]["$ref"].as_str().unwrap().ends_with("/Warnung"), "{erledigt}");
    let zweck = kanband::web::endpunkte::ENDPUNKTE.iter().find(|e| e.methode == "POST" && e.pfad == "/api/aufgaben/erledigen").unwrap().zweck;
    for text in [zweck, op["description"].as_str().unwrap()] {
        for teil in ["key", "board", "text 1–2000 Zeichen", "signal", "„erledigt“, „schon erledigt“, „gemeldet“, „schon gemeldet“", "warnungen", "grenze", "409", "mehrfach vergeben", "„Grenze erreicht“"] {
            assert!(text.contains(teil), "fehlt „{teil}“: {text}");
        }
    }
    assert!(seite.contains("/api/aufgaben/erledigen") && seite.contains("„schon gemeldet“"), "Seite /api");
}

/// R00118 B0534–B0536: die Grenze-Texte sind rechtschreiblich rein — deutsches schließendes Anführungszeichen im
/// Schema `GrenzeErreicht`, keine verschachtelten gleichen Anführungszeichen in der Warnung, „Aufgabe“ statt „Karte“.
#[tokio::test]
async fn grenze_texte_sind_rein() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d = beschreibung(&lauf.adresse).await;
    let seite = reqwest::get(format!("{}api", lauf.adresse)).await.unwrap().text().await.unwrap();

    // B0534: das Feld `fehler` endet mit dem deutschen schließenden Anführungszeichen.
    let fehler = d["components"]["schemas"]["GrenzeErreicht"]["properties"]["fehler"]["description"].as_str().unwrap();
    assert!(fehler.contains("immer „Grenze erreicht“"), "B0534: {fehler}");
    assert!(!fehler.contains("Grenze erreicht\""), "B0534: gerades Anführungszeichen: {fehler}");

    // B0535: die Warnung nennt die Spalte in deutschen Anführungszeichen, ohne sie erneut einzuschließen.
    for pfad in ["/api/boards/{slug}/bewegen", "/api/boards/{slug}/bewegen-mehrere", "/api/boards/{slug}/ziehen"] {
        let text = d["paths"][pfad]["post"]["description"].as_str().unwrap();
        assert!(text.contains("Warnung grenze: Grenze erreicht: „<Spalte>“ hat n von g"), "B0535 {pfad}: {text}");
        assert!(!text.contains("„Grenze erreicht: „"), "B0535 {pfad}: verschachtelt: {text}");
    }

    // B0536: auf das Board legen sagt „Aufgabe“.
    let aufgaben = d["paths"]["/api/boards/{slug}/aufgaben"]["post"]["description"].as_str().unwrap();
    assert!(aufgaben.contains("eine schon liegende Aufgabe"), "B0536: {aufgaben}");
    assert!(!aufgaben.contains("schon liegende Karte"), "B0536: {aufgaben}");

    // Dieselben Texte stehen auf der Seite /api (Quelle `endpunkte.rs`); `<Spalte>` ist dort maskiert.
    assert!(seite.contains("Warnung grenze: Grenze erreicht: „&lt;Spalte&gt;“ hat n von g"), "Seite /api: Warnung");
    assert!(seite.contains("eine schon liegende Aufgabe"), "Seite /api: Aufgabe");
    assert!(!seite.contains("„Grenze erreicht: „") && !seite.contains("schon liegende Karte"), "Seite /api rein");
}

/// R00120 AK 9/10: das OpenAPI-Schema `Spalte` und die Beschreibungen nennen `eigentuemer_unbekannt`; die
/// Hausregel zur Großschreibung nach dem Doppelpunkt ist angewandt.
#[tokio::test]
async fn spalte_schema_und_beschreibung_nennen_eigentuemer_unbekannt() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let d = beschreibung(&lauf.adresse).await;
    assert!(d["components"]["schemas"]["Spalte"]["properties"]["eigentuemer_unbekannt"].is_object(), "AK 9: Schemafeld Spalte.eigentuemer_unbekannt");
    let zweck = |pfad: &str| kanband::web::endpunkte::ENDPUNKTE.iter().find(|e| e.methode == "GET" && e.pfad == pfad).unwrap().zweck;
    assert!(zweck("/api/boards").contains("eigentuemer_unbekannt"), "GET /api/boards: {}", zweck("/api/boards"));
    assert!(zweck("/api/boards/{slug}").contains("eigentuemer_unbekannt"), "GET /api/boards/{{slug}}");
    assert!(d["paths"]["/api/boards"]["get"]["description"].as_str().unwrap().contains("eigentuemer_unbekannt"), "openapi GET /api/boards");
    let info = d["info"]["description"].as_str().unwrap();
    assert!(info.contains("): Aus einer Spalte, die dem Menschen gehört"), "Hausregel Doppelpunkt: {info}");
    assert!(info.contains("Antwortregel: Ein Objekt kommt direkt"), "Hausregel Doppelpunkt Antwortregel: {info}");
}

/// R00159 AK 8: die drei Wege der Archiv-Familie nennen die 423 des defekten Ordners und ihren Vorrang vor der 403 —
/// in `/api/openapi.json`, in `/api/endpunkte` und auf der Seite `/api`; bei DELETE entfällt der alte Klammerzusatz.
#[tokio::test]
async fn archiv_familie_nennt_die_423_und_ihren_vorrang() {
    let tmp = tempfile::tempdir().unwrap();
    let lauf = gemeinsam::eingerichtet_starten(tmp.path());
    let satz = "Agent bei einer defekten Board-Datei im Ordner → 423 {fehler}, geht der 403 vor";
    let d = beschreibung(&lauf.adresse).await;
    let liste: Value = reqwest::get(format!("{}api/endpunkte", lauf.adresse)).await.unwrap().json().await.unwrap();
    for (methode, pfad) in [("POST", "/api/aufgaben/{nr}/archivieren"), ("POST", "/api/aufgaben/archivieren"), ("DELETE", "/api/aufgaben/{nr}")] {
        let openapi = d["paths"][pfad][methode.to_lowercase()]["description"].as_str().unwrap().to_string();
        let zweck = liste.as_array().unwrap().iter().find(|e| e["methode"] == methode && e["pfad"] == pfad).unwrap()["zweck"].as_str().unwrap().to_string();
        for (wo, text) in [("openapi.json", openapi), ("endpunkte", zweck)] {
            assert!(text.contains(satz), "{wo} {methode} {pfad}: {text}");
            assert!(!text.contains("defektes Board 423") && !text.contains("ein defektes Board des Ordners ist 423"), "{wo} {methode} {pfad} trägt noch den alten Zusatz: {text}");
        }
    }
    let seite = reqwest::get(format!("{}api", lauf.adresse)).await.unwrap().text().await.unwrap();
    assert_eq!(seite.matches(satz).count(), 3, "Seite /api nennt den Satz an genau den drei Endpunkten");
    assert!(!seite.contains("R00097/R00120; defektes Board 423"), "Seite /api trägt bei DELETE noch den alten Klammerzusatz");
}
