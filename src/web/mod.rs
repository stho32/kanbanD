//! HTTP: Oberfläche und API in einem Router.

mod statisch;

use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{Value, json};
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Clone)]
pub struct App {
    pub ordner: Arc<PathBuf>,
}

pub fn router(ordner: PathBuf) -> Router {
    let app = App { ordner: Arc::new(ordner) };
    Router::new()
        .route("/api/zustand", get(zustand))
        .merge(statisch::router())
        .with_state(app)
}

async fn zustand(State(app): State<App>) -> Json<Value> {
    Json(json!({
        "ordner": app.ordner.to_string_lossy(),
        "eingerichtet": app.ordner.join("kanbanD.md").exists(),
    }))
}
