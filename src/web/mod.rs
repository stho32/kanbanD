//! HTTP: Oberfläche und API in einem Router.

pub mod endpunkte;
mod statisch;

use crate::dienst::{Bewegung, Einrichtung, Kanban, NeueAufgabe, NeueAufgaben, NeuesBoard, Teilaufgabenaenderung, Zeitkorrektur};
use crate::fehler::Fehler;
use crate::modell::{Aufgabenaenderung, Einstellungen, SpaltenAenderung};
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
        .route("/api", get(api_seite))
        .route("/api/endpunkte", get(|| async { Json(endpunkte::ENDPUNKTE) }))
        .route("/api/einrichten", post(einrichten))
        .route("/api/boards", get(boards).post(board_anlegen))
        .route("/api/boards/{slug}", get(board))
        .route("/api/boards/{slug}/bewegen", post(bewegen))
        .route("/api/boards/{slug}/aufgaben", post(auf_board_legen))
        .route("/api/boards/{slug}/aufgaben/{nr}", axum::routing::delete(von_board_nehmen))
        .route("/api/boards/{slug}/spalten", axum::routing::put(spalten_setzen))
        .route("/api/wer", get(wer))
        .route("/api/einstellungen", axum::routing::put(einstellungen_setzen))
        .route("/api/aufgaben", get(aufgaben).post(aufgabe_anlegen))
        .route("/api/herkunft", get(herkunft))
        .route("/api/berichte/zeiten.csv", get(zeiten_csv))
        .route("/api/berichte/verlauf", get(verlauf))
        .route("/api/aufgaben/{nr}", get(aufgabe_lesen).patch(aufgabe_aendern))
        .route("/api/aufgaben/mehrere", post(aufgaben_anlegen))
        .route("/api/aufgaben/{nr}/teilaufgaben", post(teilaufgabe_anlegen))
        .route("/api/aufgaben/{nr}/teilaufgaben/mehrere", post(teilaufgaben_anlegen))
        .route("/api/aufgaben/{nr}/kommentare", post(kommentieren))
        .route("/api/aufgaben/{nr}/timer/start", post(timer_starten))
        .route("/api/aufgaben/{nr}/timer/stop", post(timer_stoppen))
        .route("/api/aufgaben/{nr}/zeiten", post(zeit_nachtragen))
        .route("/api/aufgaben/{nr}/archivieren", post(archivieren))
        .route("/api/aufgaben/{nr}/zurueckholen", post(zurueckholen))
        .route("/api/aufgaben/{nr}/anhaenge", get(anhaenge).post(anhang_ablegen).layer(axum::extract::DefaultBodyLimit::max(50 * 1024 * 1024)))
        .route("/api/aufgaben/{nr}/anhaenge/{name}", get(anhang_lesen).delete(anhang_entfernen))
        .route("/api/aufgaben/{nr}/zeiten/{i}", axum::routing::patch(zeit_korrigieren).delete(zeit_loeschen))
        .route("/api/aufgaben/{nr}/teilaufgaben/{i}", axum::routing::patch(teilaufgabe_aendern).delete(teilaufgabe_entfernen))
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

/// Aufgabe mit Pfad und Dateitext; eine defekte Datei kommt mit Fehler und Status 423.
async fn aufgabe_lesen(State(app): State<App>, Path(nr): Path<u32>) -> Result<Response, Fehler> {
    blockierend(&app, move |k| {
        let pfad = k.ordner().aufgabenpfad(nr)?;
        let text = k.ordner().lies(&pfad)?.unwrap_or_default();
        Ok(match k.ordner().aufgabe(nr) {
            Ok(a) => Json(json!({ "aufgabe": a, "pfad": pfad, "text": text })).into_response(),
            Err(f) => (StatusCode::LOCKED, Json(json!({ "fehler": f.meldung(), "pfad": pfad, "text": text }))).into_response(),
        })
    })
    .await
}

async fn aufgabe_aendern(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, Json(aenderung): Json<Aufgabenaenderung>) -> Result<Response, Fehler> {
    let a = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.aufgabe_aendern(&p, nr, &aenderung)
    })
    .await?;
    Ok(Json(a).into_response())
}

#[derive(serde::Deserialize)]
struct Text {
    text: String,
}

/// Schreibender Aufruf als handelnde Person, Antwort ist die geänderte Aufgabe.
async fn als_person<T: serde::Serialize + Send + 'static>(app: &App, wer: Option<String>, f: impl FnOnce(&Kanban, &crate::modell::Person) -> Result<T, Fehler> + Send + 'static) -> Result<Response, Fehler> {
    let t = blockierend(app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        f(k, &p)
    })
    .await?;
    Ok(Json(t).into_response())
}

async fn teilaufgabe_anlegen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, Json(t): Json<Text>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.teilaufgabe_anlegen(p, nr, &t.text)).await
}

async fn teilaufgabe_aendern(State(app): State<App>, Wer(wer): Wer, Path((nr, i)): Path<(u32, usize)>, Json(a): Json<Teilaufgabenaenderung>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.teilaufgabe_aendern(p, nr, i, &a)).await
}

async fn teilaufgabe_entfernen(State(app): State<App>, Wer(wer): Wer, Path((nr, i)): Path<(u32, usize)>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.teilaufgabe_entfernen(p, nr, i)).await
}

async fn kommentieren(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, Json(t): Json<Text>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.kommentieren(p, nr, &t.text)).await
}

async fn timer_starten(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.timer_starten(p, nr)).await
}

#[derive(serde::Deserialize, Default)]
struct Stopp {
    wer: Option<String>,
}

/// Der Körper ist freiwillig: leer, `null` oder `{"wer": "<kürzel>"}`.
async fn timer_stoppen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, koerper: axum::body::Bytes) -> Result<Response, Fehler> {
    let fuer = serde_json::from_slice::<Option<Stopp>>(&koerper).ok().flatten().unwrap_or_default().wer;
    als_person(&app, wer, move |k, p| k.timer_stoppen(p, nr, fuer.as_deref())).await
}

#[derive(serde::Deserialize)]
struct Dauer {
    dauer: String,
}

async fn zeit_nachtragen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, Json(d): Json<Dauer>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.zeit_nachtragen(p, nr, &d.dauer)).await
}

async fn zeit_korrigieren(State(app): State<App>, Wer(wer): Wer, Path((nr, i)): Path<(u32, usize)>, Json(z): Json<Zeitkorrektur>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.zeit_korrigieren(p, nr, i, &z)).await
}

async fn zeit_loeschen(State(app): State<App>, Wer(wer): Wer, Path((nr, i)): Path<(u32, usize)>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.zeit_loeschen(p, nr, i)).await
}

async fn anhaenge(State(app): State<App>, Path(nr): Path<u32>) -> Result<Response, Fehler> {
    let liste = blockierend(&app, move |k| k.anhaenge(nr)).await?;
    Ok(Json(liste).into_response())
}

async fn anhang_ablegen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, mut teile: axum::extract::Multipart) -> Result<Response, Fehler> {
    let mut datei = None;
    while let Some(feld) = teile.next_field().await.map_err(|e| Fehler::Ungueltig(format!("Hochladen: {e}")))? {
        if feld.name() == Some("datei") {
            let name = feld.file_name().unwrap_or("anhang").to_string();
            let bytes = feld.bytes().await.map_err(|e| Fehler::Ungueltig(format!("Hochladen: {e}")))?;
            datei = Some((name, bytes));
        }
    }
    let (name, bytes) = datei.ok_or_else(|| Fehler::Ungueltig("Feld „datei“ fehlt".into()))?;
    let a = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.anhang_ablegen(&p, nr, &name, &bytes)
    })
    .await?;
    Ok((StatusCode::CREATED, Json(a)).into_response())
}

fn inhaltstyp(name: &str) -> &'static str {
    match name.rsplit('.').next().map(str::to_lowercase).as_deref() {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        Some("pdf") => "application/pdf",
        Some("txt" | "log" | "md" | "csv") => "text/plain; charset=utf-8",
        Some("json") => "application/json",
        _ => "application/octet-stream",
    }
}

async fn anhang_lesen(State(app): State<App>, Path((nr, name)): Path<(u32, String)>) -> Result<Response, Fehler> {
    let (inhalt, name) = blockierend(&app, move |k| {
        let rel = k.anhangpfad(nr, &name)?;
        Ok((std::fs::read(k.ordner().wurzel().join(rel))?, name))
    })
    .await?;
    let typ = inhaltstyp(&name);
    // SVG und Unbekanntes nicht im Kontext der Seite ausführen lassen.
    let art = if typ.starts_with("image/svg") || typ == "application/octet-stream" { "attachment" } else { "inline" };
    let kopf = format!("{art}; filename*=UTF-8''{}", name.bytes().map(|b| if b.is_ascii_alphanumeric() || b".-_".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") }).collect::<String>());
    Ok(([(axum::http::header::CONTENT_TYPE, typ.to_string()), (axum::http::header::CONTENT_DISPOSITION, kopf), (axum::http::header::X_CONTENT_TYPE_OPTIONS, "nosniff".into())], inhalt).into_response())
}

async fn anhang_entfernen(State(app): State<App>, Wer(wer): Wer, Path((nr, name)): Path<(u32, String)>) -> Result<Response, Fehler> {
    blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.anhang_entfernen(&p, nr, &name)
    })
    .await?;
    Ok(Json(json!({ "entfernt": true })).into_response())
}

async fn archivieren(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.archivieren(p, nr)).await
}

async fn zurueckholen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.zurueckholen(p, nr)).await
}

async fn herkunft(State(app): State<App>) -> Result<Response, Fehler> {
    let q = blockierend(&app, |k| k.herkunft()).await?;
    Ok(Json(q).into_response())
}

#[derive(serde::Deserialize)]
struct Ablage {
    nummer: u32,
    spalte: Option<String>,
}

async fn auf_board_legen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(a): Json<Ablage>) -> Result<Response, Fehler> {
    let spalte = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.auf_board_legen(&p, &slug, a.nummer, a.spalte.as_deref())
    })
    .await?;
    Ok((StatusCode::CREATED, Json(json!({ "spalte": spalte }))).into_response())
}

async fn von_board_nehmen(State(app): State<App>, Wer(wer): Wer, Path((slug, nr)): Path<(String, u32)>) -> Result<Response, Fehler> {
    blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.von_board_nehmen(&p, &slug, nr)
    })
    .await?;
    Ok(Json(json!({ "genommen": true })).into_response())
}

/// Alle lesbaren Boards mit Struktur, nach Dateiname sortiert.
async fn boards(State(app): State<App>) -> Result<Response, Fehler> {
    let (boards, _) = blockierend(&app, |k| k.ordner().boards()).await?;
    Ok(Json(boards).into_response())
}

async fn zeiten_csv(State(app): State<App>) -> Result<Response, Fehler> {
    let csv = blockierend(&app, |k| {
        let (aufgaben, _) = k.ordner().aufgaben()?;
        let e = k.ordner().einstellungen().ok().flatten().unwrap_or_default();
        Ok(crate::berichte::zeiten_csv(&aufgaben, &e, &crate::uhr::jetzt()))
    })
    .await?;
    Ok(([(axum::http::header::CONTENT_TYPE, "text/csv; charset=utf-8"), (axum::http::header::CONTENT_DISPOSITION, "attachment; filename=\"kanbanD-zeiten.csv\"")], csv).into_response())
}

#[derive(serde::Deserialize)]
struct BoardWahl {
    board: String,
}

async fn verlauf(State(app): State<App>, axum::extract::Query(w): axum::extract::Query<BoardWahl>) -> Result<Response, Fehler> {
    let v = blockierend(&app, move |k| k.verlauf(&w.board)).await?;
    Ok(Json(v).into_response())
}

/// Die Beschreibung der API; das Beispiel nennt die Adresse, unter der sie gerade abgerufen wird.
async fn api_seite(headers: axum::http::HeaderMap) -> Response {
    let host = headers.get(axum::http::header::HOST).and_then(|h| h.to_str().ok()).unwrap_or("localhost");
    (
        [(axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8")],
        endpunkte::api_seite(&format!("http://{host}/")),
    )
        .into_response()
}

async fn aufgaben_anlegen(State(app): State<App>, Wer(wer): Wer, Json(neu): Json<NeueAufgaben>) -> Result<Response, Fehler> {
    let a = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.aufgaben_anlegen(&p, &neu)
    })
    .await?;
    Ok((StatusCode::CREATED, Json(a)).into_response())
}

#[derive(serde::Deserialize)]
struct Texte {
    texte: Vec<String>,
}

async fn teilaufgaben_anlegen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, Json(t): Json<Texte>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.teilaufgaben_anlegen(p, nr, &t.texte)).await
}
