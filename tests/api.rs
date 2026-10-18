mod gemeinsam;

use gemeinsam::{git, senden};
use reqwest::Method;
use serde_json::{Value, json};

/// (Pfad, Methoden) aller Routen aus dem Router-Quelltext — die Tabelle muss sie vollständig beschreiben.
fn routen() -> Vec<(String, Vec<String>)> {
    let quelle = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/web/mod.rs")).unwrap();
    quelle
        .lines()
        .filter_map(|z| z.trim().strip_prefix(".route(\"/api/"))
        .map(|rest| {
            let (pfad, rumpf) = rest.split_once('"').unwrap();
            let methoden = ["get", "post", "put", "patch", "delete"].iter().filter(|m| rumpf.contains(&format!("{m}("))).map(|m| m.to_uppercase()).collect();
            (format!("/api/{pfad}"), methoden)
        })
        .collect()
}

#[test]
fn jede_route_ist_beschrieben_und_jede_beschreibung_eine_route() {
    let tabelle: Vec<(String, String)> = kanband::web::endpunkte::ENDPUNKTE.iter().map(|e| (e.methode.to_string(), e.pfad.split('?').next().unwrap().to_string())).collect();
    let mut aus_router = vec![];
    for (pfad, methoden) in routen() {
        if pfad == "/api/endpunkte" {
            continue;
        }
        for m in methoden {
            aus_router.push((m, pfad.clone()));
        }
    }
    for r in &aus_router {
        assert!(tabelle.contains(r), "nicht beschrieben: {r:?}");
    }
    for t in &tabelle {
        assert!(aus_router.contains(t), "beschrieben, aber nicht im Router: {t:?}");
    }
}

#[tokio::test]
async fn jeder_beschriebene_endpunkt_existiert() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::mit_drei_aufgaben(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let (_, eps) = senden(Method::GET, &lauf.adresse, "api/endpunkte", "st", json!(null)).await;
    assert!(eps.as_array().unwrap().len() >= 30);
    for e in eps.as_array().unwrap() {
        let pfad = e["pfad"].as_str().unwrap().replace("{slug}", "entwicklung").replace("{nr}", "1").replace("{i}", "0").replace("{name}", "a.txt");
        if pfad == "/api/ereignisse" {
            continue;
        }
        let methode = Method::from_bytes(e["methode"].as_str().unwrap().as_bytes()).unwrap();
        let r = reqwest::Client::new().request(methode, format!("{}{}", lauf.adresse, &pfad[1..])).header("X-KanbanD-Wer", "st").send().await.unwrap();
        let status = r.status().as_u16();
        let text = r.text().await.unwrap();
        assert_ne!(status, 405, "{} {pfad}", e["methode"]);
        assert!(status != 404 || text.contains("fehler"), "Route fehlt: {} {pfad}", e["methode"]);
    }
}

#[tokio::test]
async fn api_seite_und_agentenlauf_unter_eigenem_namen() {
    let tmp = tempfile::tempdir().unwrap();
    gemeinsam::eingerichtet_starten(tmp.path());
    let lauf = gemeinsam::starten(tmp.path(), &["--port", "0"]);
    let a = &lauf.adresse;
    let seite = reqwest::get(format!("{a}api")).await.unwrap().text().await.unwrap();
    assert!(seite.contains("<title>kanbanD · API</title>") && seite.contains("X-KanbanD-Wer"));
    assert!(seite.contains(&format!("curl -X POST {a}api/aufgaben")));
    let vorher: usize = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();
    let (s, neu) = senden(Method::POST, a, "api/aufgaben", "cl", json!({"titel": "Agentenaufgabe", "board": "entwicklung"})).await;
    assert_eq!(s, 201);
    let nr = neu["nummer"].as_u64().unwrap();
    for (methode, pfad, daten) in [
        (Method::POST, format!("api/aufgaben/{nr}/timer/start"), Value::Null),
        (Method::POST, "api/boards/entwicklung/bewegen".to_string(), json!({"nummer": nr, "spalte": "Erledigt"})),
        (Method::POST, format!("api/aufgaben/{nr}/kommentare"), json!({"text": "fertig"})),
        (Method::POST, format!("api/aufgaben/{nr}/timer/stop"), Value::Null),
    ] {
        assert_eq!(senden(methode, a, &pfad, "cl", daten).await.0, 200, "{pfad}");
    }
    let nachher: usize = git(tmp.path(), &["rev-list", "--count", "HEAD"]).parse().unwrap();
    assert_eq!(nachher - vorher, 5);
    let autoren = git(tmp.path(), &["log", "-5", "--format=%an"]);
    assert_eq!(autoren.lines().collect::<Vec<_>>(), vec!["Claude"; 5]);
}
