//! HTTP: Oberfläche und API in einem Router.

mod statisch;

use crate::dienst::{Bewegung, Einrichtung, Kanban, NeueAufgabe, NeuesBoard};
use crate::fehler::Fehler;
use crate::modell::{Einstellungen, SpaltenAenderung};
use crate::waechter::{self, Ereignis};
use axum::response::sse::{Event, KeepAlive, Sse};
use futures_util::stream::Stream;
use tokio::sync::{broadcast, watch};
use tokio_stream::StreamExt;
use tokio_stream::wrappers::BroadcastStream;
use axum::extract::{FromRequestParts, Path, State};
use axum::http::request::Parts;
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
    pub ereignisse: broadcast::Sender<Ereignis>,
    ende: watch::Receiver<bool>,
    _waechter: Option<Arc<notify::RecommendedWatcher>>,
}

/// Router ohne Ende-Signal (Ereignisströme laufen, bis der Client geht).
pub fn router(ordner: PathBuf) -> Router {
    router_mit_ende(ordner, watch::channel(false).1)
}

/// Wird `ende` wahr, schließen sich die Ereignisströme — sonst wartet ein geordnetes Beenden ewig auf sie.
pub fn router_mit_ende(ordner: PathBuf, ende: watch::Receiver<bool>) -> Router {
    let kanban = Arc::new(Kanban::neu(ordner.clone()));
    let (ereignisse, _) = broadcast::channel(256);
    let tx = ereignisse.clone();
    let waechter = match waechter::starten(ordner, kanban.eigene(), move |e| {
        let _ = tx.send(e);
    }) {
        Ok(w) => Some(Arc::new(w)),
        Err(e) => {
            eprintln!("Ordner wird nicht beobachtet ({e}) — Änderungen von außen erscheinen erst nach Neuladen.");
            None
        }
    };
    let app = App { kanban, ereignisse, ende, _waechter: waechter };
    Router::new()
        .route("/api/ereignisse", get(ereignisstrom))
        .route("/api/zustand", get(zustand))
        .route("/api/einrichten", post(einrichten))
        .route("/api/boards", post(board_anlegen))
        .route("/api/boards/{slug}", get(board))
        .route("/api/boards/{slug}/bewegen", post(bewegen))
        .route("/api/boards/{slug}/spalten", axum::routing::put(spalten_setzen))
        .route("/api/wer", get(wer))
        .route("/api/einstellungen", axum::routing::put(einstellungen_setzen))
        .route("/api/aufgaben", get(aufgaben).post(aufgabe_anlegen))
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

/// Das Kürzel aus dem Header `X-KanbanD-Wer`, falls genannt.
pub struct Wer(pub Option<String>);

impl<S: Send + Sync> FromRequestParts<S> for Wer {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(teile: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        Ok(Wer(teile.headers.get("x-kanband-wer").and_then(|w| w.to_str().ok()).map(str::to_string)))
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

async fn wer(State(app): State<App>, Wer(wer): Wer) -> Result<Response, Fehler> {
    let p = blockierend(&app, move |k| k.handelnder(wer.as_deref())).await?;
    Ok(Json(p).into_response())
}

async fn aufgaben(State(app): State<App>) -> Result<Response, Fehler> {
    let (aufgaben, defekte) = blockierend(&app, |k| k.ordner().aufgaben()).await?;
    Ok(Json(json!({ "aufgaben": aufgaben, "defekte": defekte })).into_response())
}

async fn aufgabe_anlegen(State(app): State<App>, Wer(wer): Wer, Json(neu): Json<NeueAufgabe>) -> Result<Response, Fehler> {
    let a = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.aufgabe_anlegen(&p, &neu)
    })
    .await?;
    Ok((StatusCode::CREATED, Json(a)).into_response())
}

async fn bewegen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(bw): Json<Bewegung>) -> Result<Response, Fehler> {
    let bewegt = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.bewegen(&p, &slug, &bw)
    })
    .await?;
    Ok(Json(json!({ "bewegt": bewegt })).into_response())
}

/// Server-Sent Events: je Änderung im Ordner ein `data: {"pfade": […], "extern": …}`.
async fn ereignisstrom(State(app): State<App>) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let mut ende = app.ende.clone();
    let geschlossen = async move {
        let _ = ende.wait_for(|e| *e).await;
    };
    let strom = futures_util::StreamExt::take_until(BroadcastStream::new(app.ereignisse.subscribe()), geschlossen).map(|e| {
        // Wer zu langsam liest, bekommt ein leeres Ereignis und lädt einfach alles neu.
        let e = e.unwrap_or(Ereignis { pfade: vec![], von_aussen: true });
        Ok(Event::default().data(serde_json::to_string(&e).unwrap_or_default()))
    });
    Sse::new(strom).keep_alive(KeepAlive::new().interval(std::time::Duration::from_secs(15)))
}

async fn board_anlegen(State(app): State<App>, Wer(wer): Wer, Json(neu): Json<NeuesBoard>) -> Result<Response, Fehler> {
    let slug = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.board_anlegen(&p, &neu)
    })
    .await?;
    Ok((StatusCode::CREATED, Json(json!({ "board": slug }))).into_response())
}

async fn spalten_setzen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(neu): Json<Vec<SpaltenAenderung>>) -> Result<Response, Fehler> {
    let geaendert = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.spalten_setzen(&p, &slug, &neu)
    })
    .await?;
    Ok(Json(json!({ "geaendert": geaendert })).into_response())
}

async fn einstellungen_setzen(State(app): State<App>, Wer(wer): Wer, Json(neu): Json<Einstellungen>) -> Result<Response, Fehler> {
    let geaendert = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.einstellungen_setzen(&p, neu)
    })
    .await?;
    Ok(Json(json!({ "geaendert": geaendert })).into_response())
}
