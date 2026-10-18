//! Die Oberfläche ist in das Programm eingebettet.

use axum::extract::Path;
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;

macro_rules! dateien {
    ($($name:literal => $typ:literal),* $(,)?) => {
        const DATEIEN: &[(&str, &str, &[u8])] = &[
            $(($name, $typ, include_bytes!(concat!(env!("CARGO_MANIFEST_DIR"), "/web/", $name)))),*
        ];
    };
}

dateien! {
    "index.html" => "text/html; charset=utf-8",
}

fn liefern(name: &str) -> Response {
    match DATEIEN.iter().find(|(n, _, _)| *n == name) {
        Some((_, typ, inhalt)) => ([(header::CONTENT_TYPE, *typ), (header::CACHE_CONTROL, "no-cache")], *inhalt).into_response(),
        None => (StatusCode::NOT_FOUND, "nicht gefunden").into_response(),
    }
}

pub fn router<S: Clone + Send + Sync + 'static>() -> Router<S> {
    Router::new()
        .route("/", get(|| async { liefern("index.html") }))
        .route("/web/{*name}", get(|Path(name): Path<String>| async move { liefern(&name) }))
}
