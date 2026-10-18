//! HTTP: Oberfläche und API in einem Router.

mod statisch;

use crate::dienst::{Einrichtung, Kanban};
use crate::fehler::Fehler;
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::json;
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Clone)]
pub struct App {
    pub kanban: Arc<Kanban>,
}

pub fn router(ordner: PathBuf) -> Router {
    let app = App { kanban: Arc::new(Kanban::neu(ordner)) };
    Router::new()
        .route("/api/zustand", get(zustand))
        .route("/api/einrichten", post(einrichten))
        .route("/api/boards/{slug}", get(board))
        .merge(statisch::router())
        .with_state(app)
}

impl IntoResponse for Fehler {
    fn into_response(self) -> Response {
        let status = match self {
            Fehler::Ungueltig(_) => StatusCode::BAD_REQUEST,
            Fehler::NichtGefunden(_) => StatusCode::NOT_FOUND,
            Fehler::Konflikt(_) => StatusCode::CONFLICT,
            Fehler::Defekt(_) => StatusCode::LOCKED,
            Fehler::Intern(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (status, Json(json!({ "fehler": self.meldung() }))).into_response()
    }
}

/// Führt einen Anwendungsfall außerhalb der Ereignisschleife aus (Dateien, Git).
async fn blockierend<T: Send + 'static>(app: &App, f: impl FnOnce(&Kanban) -> Result<T, Fehler> + Send + 'static) -> Result<T, Fehler> {
    let k = app.kanban.clone();
    tokio::task::spawn_blocking(move || f(&k)).await.map_err(|e| Fehler::Intern(format!("Abbruch: {e}")))?
}

async fn zustand(State(app): State<App>) -> Result<Response, Fehler> {
    let z = blockierend(&app, |k| k.zustand()).await?;
    Ok(Json(z).into_response())
}

async fn einrichten(State(app): State<App>, Json(e): Json<Einrichtung>) -> Result<Response, Fehler> {
    let slug = blockierend(&app, move |k| k.einrichten(&e)).await?;
    Ok((StatusCode::CREATED, Json(json!({ "board": slug }))).into_response())
}

async fn board(State(app): State<App>, Path(slug): Path<String>) -> Result<Response, Fehler> {
    let b = blockierend(&app, move |k| k.ordner().board(&slug)).await?;
    Ok(Json(b).into_response())
}
