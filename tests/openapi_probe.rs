// R00093 B0261: Probe für utoipa 6 und utoipa-axum 0.3 (Skill dependency-probe) — die Annahmen, auf denen die
// OpenAPI-Beschreibung von kanbanD baut. Bleibt als Regressionsschutz bei Updates der Bibliotheken.

use serde::{Deserialize, Serialize};
use utoipa::{OpenApi, ToSchema};
use utoipa_axum::{router::OpenApiRouter, routes};

#[derive(Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
enum Art {
    Mensch,
    Agent,
}

#[derive(Serialize, Deserialize, ToSchema)]
struct Person {
    kuerzel: String,
    art: Art,
    #[serde(skip)]
    #[allow(dead_code)]
    intern: Vec<String>,
}

/// eine Person
#[utoipa::path(get, path = "/api/personen/{nr}", params(("nr" = u32, Path, description = "Nummer")), responses((status = 200, body = Person), (status = 404, description = "unbekannt")))]
async fn person(axum::extract::Path(_nr): axum::extract::Path<u32>) -> axum::Json<Person> {
    axum::Json(Person { kuerzel: "st".into(), art: Art::Mensch, intern: vec![] })
}

#[derive(OpenApi)]
#[openapi(info(title = "Probe"))]
struct Doku;

fn beschreibung() -> serde_json::Value {
    let (_router, api): (axum::Router, _) = OpenApiRouter::with_openapi(Doku::openapi()).routes(routes!(person)).split_for_parts();
    serde_json::to_value(api).unwrap()
}

#[test]
fn openapi_31_mit_pfadparameter_und_antworten() {
    let d = beschreibung();
    assert!(d["openapi"].as_str().unwrap().starts_with("3.1"), "{}", d["openapi"]);
    let get = &d["paths"]["/api/personen/{nr}"]["get"];
    assert_eq!(get["parameters"][0]["name"], "nr");
    assert_eq!(get["parameters"][0]["in"], "path");
    assert_eq!(get["responses"]["200"]["content"]["application/json"]["schema"]["$ref"], "#/components/schemas/Person");
    assert!(get["responses"]["404"].is_object());
}

#[test]
fn enum_mit_serde_umbenennung_und_ausgelassenes_feld() {
    let d = beschreibung();
    let schemas = &d["components"]["schemas"];
    assert_eq!(schemas["Art"]["enum"], serde_json::json!(["mensch", "agent"]), "serde(rename_all) gilt im Schema");
    assert!(schemas["Person"]["properties"]["intern"].is_null(), "serde(skip) fehlt im Schema");
    assert_eq!(schemas["Person"]["properties"]["art"]["$ref"], "#/components/schemas/Art", "Schemas werden aus den Pfaden gesammelt");
}

#[test]
fn router_traegt_die_beschriebene_route() {
    let (router, _api): (axum::Router, _) = OpenApiRouter::new().routes(routes!(person)).split_for_parts();
    let antwort = tokio::runtime::Runtime::new().unwrap().block_on(async {
        let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let adresse = l.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(l, router).await.unwrap() });
        let ok = reqwest::get(format!("http://{adresse}/api/personen/7")).await.unwrap().status().as_u16();
        let falsch = reqwest::get(format!("http://{adresse}/api/personen/keine-zahl")).await.unwrap().status().as_u16();
        (ok, falsch)
    });
    assert_eq!(antwort, (200, 400), "Fault-Injection: ein falscher Pfadparameter scheitert wie bei axum");
}
