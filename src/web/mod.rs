//! HTTP: Oberfläche und API in einem Router.

pub mod endpunkte;
pub mod openapi;
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
use axum::extract::{FromRequestParts, Path, Query, State};
use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::{Json, Router};
use utoipa::OpenApi;
use utoipa_axum::{router::OpenApiRouter, routes};
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
    let fremde = fremde_beobachten(&kanban, ereignisse.clone());
    let tx = ereignisse.clone();
    let waechter = match waechter::starten(ordner, kanban.eigene(), move |e| {
        if e.pfade.iter().any(|p| p == crate::format::einstellungen::DATEI) {
            fremde();
        }
        let _ = tx.send(e);
    }) {
        Ok(w) => Some(Arc::new(w)),
        Err(e) => {
            eprintln!("Ordner wird nicht beobachtet ({e}) — Änderungen von außen erscheinen erst nach Neuladen.");
            None
        }
    };
    let app = App { kanban, ereignisse, ende, _waechter: waechter };
    // Router und OpenAPI-Beschreibung aus einer Quelle (R00093): jeder Handler trägt sein #[utoipa::path]
    let (router, api) = OpenApiRouter::with_openapi(openapi::ApiDoc::openapi())
        .routes(routes!(ereignisstrom))
        .routes(routes!(zustand))
        .routes(routes!(api_seite))
        .routes(routes!(endpunkte_liste))
        .routes(routes!(einrichten))
        .routes(routes!(boards, board_anlegen))
        .routes(routes!(board))
        .routes(routes!(bewegen))
        .routes(routes!(mehrere_bewegen))
        .routes(routes!(mehrere_auf_board_legen))
        .routes(routes!(auf_board_legen))
        .routes(routes!(von_board_nehmen))
        .routes(routes!(spalten_setzen))
        .routes(routes!(termine_setzen))
        .routes(routes!(bindung_setzen))
        .routes(routes!(start_setzen))
        .routes(routes!(berichtsfilter_setzen))
        .routes(routes!(fieber_setzen))
        .routes(routes!(fieber_cache, fieber_ergaenzen, fieber_verwerfen))
        .routes(routes!(wer))
        .routes(routes!(einstellungen_lesen, einstellungen_setzen))
        .routes(routes!(personen, person_anlegen))
        .routes(routes!(person_aendern, person_stilllegen))
        .routes(routes!(aufgaben, aufgabe_anlegen))
        .routes(routes!(herkunft))
        .routes(routes!(anwendungen))
        .routes(routes!(wbs))
        .routes(routes!(wbs_knoten_anlegen))
        .routes(routes!(wbs_status))
        .routes(routes!(wbs_verwerfen))
        .routes(routes!(zeiten_csv))
        .routes(routes!(verlauf))
        .routes(routes!(bewegungen))
        .routes(routes!(aufgabe_lesen, aufgabe_aendern))
        .routes(routes!(aufgaben_anlegen, mehrere_aendern))
        .routes(routes!(mehrere_archivieren))
        .routes(routes!(mehrere_zurueckholen))
        .routes(routes!(teilaufgabe_anlegen))
        .routes(routes!(teilaufgaben_anlegen))
        .routes(routes!(kommentieren))
        .routes(routes!(wirkung_setzen, wirkungen_stand))
        .routes(routes!(wirkung_eintritt))
        .routes(routes!(wirkung_entfernen))
        .routes(routes!(signal_setzen, signal_zuruecknehmen))
        .routes(routes!(timer_starten))
        .routes(routes!(timer_stoppen))
        .routes(routes!(zeit_nachtragen))
        .routes(routes!(archivieren))
        .routes(routes!(reservieren, freigeben))
        .routes(routes!(durchlauf_eintragen))
        .routes(routes!(ziehen))
        .routes(routes!(zurueckholen))
        .routes({
            let (schemas, pfade, methoden) = routes!(anhaenge, anhang_ablegen);
            (schemas, pfade, methoden.layer(axum::extract::DefaultBodyLimit::max(50 * 1024 * 1024)))
        })
        .routes(routes!(anhang_lesen, anhang_entfernen))
        .routes(routes!(zeit_korrigieren, zeit_loeschen))
        .routes(routes!(teilaufgabe_aendern, teilaufgabe_entfernen))
        .routes(routes!(openapi_json))
        .split_for_parts();
    let _ = OPENAPI.set(api);
    router.merge(statisch::router()).with_state(app)
}

/// Beobachtet die WBS-Dateien des Registers außerhalb des Ordners; die Rückgabe setzt sie neu aus `kanbanD.md`.
fn fremde_beobachten(kanban: &Arc<Kanban>, ereignisse: broadcast::Sender<Ereignis>) -> impl Fn() + Send + 'static {
    let fremd = match waechter::fremde_starten(kanban.eigene(), move |e| {
        let _ = ereignisse.send(e);
    }) {
        Ok(w) => Some(Arc::new(w)),
        Err(e) => {
            eprintln!("WBS-Dateien der Anwendungen werden nicht beobachtet ({e}) — ihre Änderungen erscheinen erst nach Neuladen.");
            None
        }
    };
    let k = kanban.clone();
    let neu_setzen = move || {
        if let Some(w) = &fremd {
            w.setzen(k.fremde_wbs());
        }
    };
    neu_setzen();
    neu_setzen
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

/// Die Kennung der Instanz aus dem Header `X-KanbanD-Instanz`, falls genannt (R00087).
pub struct Instanz(pub Option<String>);

impl<S: Send + Sync> FromRequestParts<S> for Instanz {
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(teile: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        Ok(Instanz(teile.headers.get("x-kanband-instanz").and_then(|w| w.to_str().ok()).map(str::to_string)))
    }
}

/// Optionaler Rumpf `{instanz}` — das Feld ersetzt den Header für Aufrufer, die keine Header setzen können.
#[derive(serde::Deserialize, utoipa::ToSchema)]
struct MitInstanz {
    instanz: Option<String>,
}

/// Der Header gilt vor dem Feld; ein leerer oder fremder Rumpf heißt „kein Feld“.
fn instanz_aus(header: Option<String>, rumpf: &[u8]) -> Option<String> {
    header.or_else(|| serde_json::from_slice::<MitInstanz>(rumpf).ok().and_then(|r| r.instanz))
}

/// Führt einen Anwendungsfall außerhalb der Ereignisschleife aus (Dateien, Git).
async fn blockierend<T: Send + 'static>(app: &App, f: impl FnOnce(&Kanban) -> Result<T, Fehler> + Send + 'static) -> Result<T, Fehler> {
    let k = app.kanban.clone();
    tokio::task::spawn_blocking(move || f(&k)).await.map_err(|e| Fehler::Intern(format!("Abbruch: {e}")))?
}

#[utoipa::path(
    get,
    path = "/api/zustand",
    tag = "Ordner",
    description = "Ordner, eingerichtet?, Einstellungen, Boards, defekte Dateien",
    responses((status = 200, description = "Erfolg", body = crate::dienst::Zustand), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn zustand(State(app): State<App>) -> Result<Response, Fehler> {
    let z = blockierend(&app, |k| k.zustand()).await?;
    Ok(Json(z).into_response())
}

#[utoipa::path(
    post,
    path = "/api/einrichten",
    tag = "Ordner",
    description = "erster Start {ich, agenten, board, spalten, quellen}",
    request_body = crate::dienst::Einrichtung,
    responses((status = 201, description = "Erfolg", body = crate::web::openapi::BoardAngelegt), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn einrichten(State(app): State<App>, Json(e): Json<Einrichtung>) -> Result<Response, Fehler> {
    let slug = blockierend(&app, move |k| k.einrichten(&e)).await?;
    Ok((StatusCode::CREATED, Json(json!({ "board": slug }))).into_response())
}

/// `?archivierte=ja` nimmt archivierte Karten in die Spalten der Board-Antworten auf (R00092).
#[derive(serde::Deserialize, Default, utoipa::ToSchema)]
struct MitArchivierten {
    archivierte: Option<String>,
}

impl MitArchivierten {
    fn gewuenscht(&self) -> bool {
        self.archivierte.as_deref() == Some("ja")
    }
}

/// Die Spalten ohne archivierte Karten — dieselbe Sicht wie die Oberfläche; die Board-Datei behält ihren Platz für „zurückholen“.
fn ohne_archivierte(k: &Kanban, boards: &mut [&mut crate::modell::Board]) -> Result<(), Fehler> {
    let (aufgaben, _) = k.ordner().aufgaben()?;
    let archiviert: std::collections::HashSet<u32> = aufgaben.iter().filter(|a| a.archiviert.is_some()).map(|a| a.nummer).collect();
    for b in boards.iter_mut() {
        for s in &mut b.spalten {
            s.aufgaben.retain(|n| !archiviert.contains(n));
        }
    }
    Ok(())
}

#[utoipa::path(
    get,
    path = "/api/boards/{slug}",
    tag = "Boards",
    description = "ein Board {slug, titel, spalten: [{name, grenze, aufgaben (ohne archivierte; ?archivierte=ja nimmt sie auf — die Board-Datei behält ihren Platz), phase, pruefungen: column-checks, notiz: column-notes, farbe: column-colors}], termine (je {name, datum, farbe, linie, staerke, ziel}), anwendungen, start: Projektstart JJJJ-MM-TT | null, fieber: {puffer, perzentil, woche, gelb: [bei 0 %, bei 100 %], rot, zielspalte, aufloesung}, berichtsfilter: {zeitraum, von, bis, ohneFarben, ohneSpalten, personen, labels, messbasisTage}, phasen: null | {anwendung, folge: [{nr, name, eingebettet, gleich}], hinweise}, hinweise: [unbekannte Prüfung …]}; ist es an eine Anwendung gebunden und fehlt einer Phase der Hauptspur die Spalte, legt kanbanD sie zuerst an (ein Commit „Phasen-Spalten von „<Board>“ ergänzt: …“)",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("archivierte" = Option<String>, Query, description = "ja nimmt archivierte Karten in die Spalten auf")),
    responses((status = 200, description = "Erfolg", body = crate::dienst::BoardMitPhasen), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn board(State(app): State<App>, Path(slug): Path<String>, Query(q): Query<MitArchivierten>) -> Result<Response, Fehler> {
    let b = blockierend(&app, move |k| {
        let mut b = k.board_mit_phasen(&slug)?;
        if !q.gewuenscht() {
            ohne_archivierte(k, &mut [&mut b.board])?;
        }
        Ok(b)
    })
    .await?;
    Ok(Json(b).into_response())
}

#[utoipa::path(
    get,
    path = "/api/wer",
    tag = "Ordner",
    description = "die Person zum Header X-KanbanD-Wer",
    params(("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    responses((status = 200, description = "Erfolg", body = crate::modell::Person), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn wer(State(app): State<App>, Wer(wer): Wer) -> Result<Response, Fehler> {
    let p = blockierend(&app, move |k| k.handelnder(wer.as_deref())).await?;
    Ok(Json(p).into_response())
}

/// Alle Aufgaben, oder gefiltert über `board`, `spalte`, `klasse`, `signal`, `zustaendig`, `reserviert`, `archivierte` (R00092).
#[utoipa::path(
    get,
    path = "/api/aufgaben",
    tag = "Aufgaben",
    description = "alle Aufgaben und defekte Dateien — Filter: board, spalte (braucht board), klasse, signal (auch due), zustaendig, reserviert=ja|nein|<instanz>, archivierte=ja|nein|nur; verschiedene Parameter UND, derselbe mehrfach ODER (?klasse=a&klasse=b); ohne Parameter alle, auch archivierte, sobald einer genannt ist gilt archivierte=nein; unbekannter Parameter → 400",
    params(("board" = Option<String>, Query, description = "Karten auf diesem Board"), ("spalte" = Option<String>, Query, description = "Karten in dieser Spalte (braucht board); mehrfach: oder"), ("klasse" = Option<String>, Query, description = "Klasse; mehrfach: oder"), ("signal" = Option<String>, Query, description = "gesetztes Signal oder due; mehrfach: oder"), ("zustaendig" = Option<String>, Query, description = "Kürzel einer zuständigen Person; mehrfach: oder"), ("reserviert" = Option<String>, Query, description = "ja, nein oder eine Instanz-Kennung"), ("archivierte" = Option<String>, Query, description = "ja, nein (Standard, sobald ein Filter genannt ist) oder nur")),
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Aufgabenliste), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn aufgaben(State(app): State<App>, Query(paare): Query<Vec<(String, String)>>) -> Result<Response, Fehler> {
    let filter = crate::dienst::Aufgabenfilter::aus_paaren(&paare)?;
    let (aufgaben, defekte) = blockierend(&app, move |k| {
        let (aufgaben, defekte) = k.ordner().aufgaben()?;
        let board = filter.board.as_deref().map(|slug| k.ordner().board(slug)).transpose()?;
        if let Some(s) = filter.spalten.iter().find(|s| board.as_ref().is_some_and(|b| !b.spalten.iter().any(|x| &x.name == *s))) {
            return Err(Fehler::Ungueltig(format!("Spalte „{s}“ gibt es auf diesem Board nicht")));
        }
        let heute = crate::uhr::heute();
        Ok((aufgaben.into_iter().filter(|a| filter.passt(a, board.as_ref(), &heute)).collect::<Vec<_>>(), defekte))
    })
    .await?;
    Ok(Json(json!({ "aufgaben": aufgaben, "defekte": defekte })).into_response())
}

#[utoipa::path(
    post,
    path = "/api/aufgaben",
    tag = "Aufgaben",
    description = "anlegen {titel, board?, spalte?}",
    params(("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::dienst::NeueAufgabe,
    responses((status = 201, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn aufgabe_anlegen(State(app): State<App>, Wer(wer): Wer, Json(neu): Json<NeueAufgabe>) -> Result<Response, Fehler> {
    let a = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.aufgabe_anlegen(&p, &neu)
    })
    .await?;
    Ok((StatusCode::CREATED, Json(a)).into_response())
}

#[utoipa::path(
    post,
    path = "/api/boards/{slug}/bewegen",
    tag = "Boards",
    description = "Aufgabe bewegen {nummer, spalte, index?} — ohne index oben in die Zielspalte (auch beim Umsortieren), index zu groß → ans Ende; ändert nur die Board-Datei; Antwort {bewegt, warnungen: [{pruefung, text, knoten: [kd:I0048], details: [kd:I0048 rot | Knoten fehlt | WBS nicht erreichbar]}]} — Prüfungen (column-checks) der verlassenen Spalte bei einem Zug nach rechts (Rang der Phase, ohne Phasen Spaltenindex); der Zug wird immer ausgeführt und committet",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::dienst::Bewegung,
    responses((status = 200, description = "Erfolg", body = crate::dienst::Bewegt), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn bewegen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(bw): Json<Bewegung>) -> Result<Response, Fehler> {
    let bewegt = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.bewegen(&p, &slug, &bw)
    })
    .await?;
    Ok(Json(bewegt).into_response())
}

/// Takt des Herzschlags; `KANBAND_HERZSCHLAG_MS` verkürzt ihn für Tests.
fn herzschlag_takt() -> std::time::Duration {
    let ms = std::env::var("KANBAND_HERZSCHLAG_MS").ok().and_then(|v| v.parse().ok()).unwrap_or(15_000);
    std::time::Duration::from_millis(ms)
}

/// Server-Sent Events: je Änderung im Ordner ein `data: {"pfade": […], "extern": …}`, dazu im Takt ein
/// `event: herzschlag`, an dem der Client eine still abgerissene Verbindung erkennt (R00085).
#[utoipa::path(
    get,
    path = "/api/ereignisse",
    tag = "Ordner",
    description = "Server-Sent Events {pfade, extern} je Änderung im Ordner; alle 15 s `event: herzschlag` mit `{}` — still länger als 40 s heißt: neu verbinden",
    responses((status = 200, description = "Server-Sent Events: data {pfade, extern, wbs} je Änderung, event herzschlag mit {} alle 15 s", content_type = "text/event-stream", body = String), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn ereignisstrom(State(app): State<App>) -> Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>> {
    let mut ende = app.ende.clone();
    let geschlossen = async move {
        let _ = ende.wait_for(|e| *e).await;
    };
    let aenderungen = BroadcastStream::new(app.ereignisse.subscribe()).map(|e| {
        // Wer zu langsam liest, bekommt ein leeres Ereignis und lädt einfach alles neu.
        let e = e.unwrap_or(Ereignis { pfade: vec![], von_aussen: true, wbs: vec![] });
        Ok(Event::default().data(serde_json::to_string(&e).unwrap_or_default()))
    });
    let takt = herzschlag_takt();
    let herzschlag = futures_util::stream::unfold((), move |()| async move {
        tokio::time::sleep(takt).await;
        Some((Ok(Event::default().event("herzschlag").data("{}")), ()))
    });
    let strom = futures_util::StreamExt::take_until(futures_util::stream::select(aenderungen, herzschlag), geschlossen);
    Sse::new(strom).keep_alive(KeepAlive::new().interval(std::time::Duration::from_secs(15)))
}

#[utoipa::path(
    post,
    path = "/api/boards",
    tag = "Boards",
    description = "Board anlegen {titel, spalten?}",
    params(("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::dienst::NeuesBoard,
    responses((status = 201, description = "Erfolg", body = crate::web::openapi::BoardAngelegt), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn board_anlegen(State(app): State<App>, Wer(wer): Wer, Json(neu): Json<NeuesBoard>) -> Result<Response, Fehler> {
    let slug = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.board_anlegen(&p, &neu)
    })
    .await?;
    Ok((StatusCode::CREATED, Json(json!({ "board": slug }))).into_response())
}

#[utoipa::path(
    put,
    path = "/api/boards/{slug}/spalten",
    tag = "Boards",
    description = "Spalten setzen [{name, alt?, grenze?, pruefungen?, notiz?, farbe?}] — fehlende Felder behalten den Wert der alten Spalte, leerer Text entfernt notiz/farbe; farbe als #rrggbb, sonst 400",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Vec<crate::modell::SpaltenAenderung>,
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Geaendert), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn spalten_setzen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(neu): Json<Vec<SpaltenAenderung>>) -> Result<Response, Fehler> {
    let geaendert = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.spalten_setzen(&p, &slug, &neu)
    })
    .await?;
    Ok(Json(json!({ "geaendert": geaendert })).into_response())
}

#[utoipa::path(
    put,
    path = "/api/boards/{slug}/termine",
    tag = "Boards",
    description = "Termine setzen [{name, datum, farbe, linie?: durchgehend|gestrichelt|gepunktet, staerke?: fein|normal|fett, ziel?: true — höchstens einer, Zieltermin des Fever Charts}]",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Vec<crate::modell::Termin>,
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Geaendert), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn termine_setzen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(neu): Json<Vec<crate::modell::Termin>>) -> Result<Response, Fehler> {
    let geaendert = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.termine_setzen(&p, &slug, neu)
    })
    .await?;
    Ok(Json(json!({ "geaendert": geaendert })).into_response())
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct Start {
    start: Option<String>,
}

#[utoipa::path(
    put,
    path = "/api/boards/{slug}/start",
    tag = "Boards",
    description = "„Rechnen ab“ (Projektstart) setzen {start: \"JJJJ-MM-TT\" | null} — ab diesem Tag rechnen Burndown, Durchlaufzeit, Wie lange noch und Fever Chart; null = erste Aufgabe auf dem Board",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Start,
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Geaendert), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn start_setzen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(s): Json<Start>) -> Result<Response, Fehler> {
    let geaendert = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.start_setzen(&p, &slug, s.start)
    })
    .await?;
    Ok(Json(json!({ "geaendert": geaendert })).into_response())
}

#[utoipa::path(
    put,
    path = "/api/boards/{slug}/berichtsfilter",
    tag = "Boards",
    description = "Berichtsfilter des Boards setzen {zeitraum: heute|gestern|woche|vorwoche|monat|vormonat|30|90|jahr|alles|eigen, von, bis (bei eigen), ohneFarben: [Klasse | \"\" = ohne], ohneSpalten, personen, labels, messbasisTage: 1–3650 (Standard 90, letzte N Tage für die Prognose)} — gilt für alle Berichte und alle, die das Board ansehen",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::modell::Berichtsfilter,
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Geaendert), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn berichtsfilter_setzen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(f): Json<crate::modell::Berichtsfilter>) -> Result<Response, Fehler> {
    let geaendert = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.berichtsfilter_setzen(&p, &slug, f)
    })
    .await?;
    Ok(Json(json!({ "geaendert": geaendert })).into_response())
}

#[utoipa::path(
    put,
    path = "/api/boards/{slug}/fieber",
    tag = "Boards",
    description = "Fever Chart einstellen {puffer: Tage | null, perzentil: 50|70|85|95, woche: 5|7, gelb: [bei 0 %, bei 100 %], rot: […]}",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::modell::Fieber,
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Geaendert), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn fieber_setzen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(f): Json<crate::modell::Fieber>) -> Result<Response, Fehler> {
    let geaendert = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.fieber_setzen(&p, &slug, f)
    })
    .await?;
    Ok(Json(json!({ "geaendert": geaendert })).into_response())
}

#[utoipa::path(
    get,
    path = "/api/boards/{slug}/fieber/cache",
    tag = "Boards",
    description = "Cache des Fever Charts {abschnitte: [{schluessel, tage: [{datum, erledigt, umfang, ende7: [P50, P70, P85, P95], ende5: […]}]}]}",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)")),
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Fiebercache), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn fieber_cache(State(app): State<App>, Path(slug): Path<String>) -> Result<Response, Fehler> {
    let abschnitte = blockierend(&app, move |k| k.fieber_cache(&slug)).await?;
    Ok(Json(json!({ "abschnitte": abschnitte })).into_response())
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct Fiebernachtrag {
    schluessel: String,
    tage: Vec<crate::format::fieber::Fiebertag>,
}

/// Ohne Identität: der Cache wird unter „kanbanD“ committet (R00078).
#[utoipa::path(
    post,
    path = "/api/boards/{slug}/fieber/cache",
    tag = "Boards",
    description = "Cache ergänzen {schluessel, tage} — nur fehlende Tage vor heute, ein Commit unter „kanbanD“, ohne X-KanbanD-Wer",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)")),
    request_body = Fiebernachtrag,
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Neu), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn fieber_ergaenzen(State(app): State<App>, Path(slug): Path<String>, Json(n): Json<Fiebernachtrag>) -> Result<Response, Fehler> {
    let neu = blockierend(&app, move |k| k.fieber_ergaenzen(&slug, &n.schluessel, n.tage, &crate::uhr::heute())).await?;
    Ok(Json(json!({ "neu": neu })).into_response())
}

#[utoipa::path(
    delete,
    path = "/api/boards/{slug}/fieber/cache",
    tag = "Boards",
    description = "Cache verwerfen — ein Commit unter „kanbanD“",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)")),
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Verworfen), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn fieber_verwerfen(State(app): State<App>, Path(slug): Path<String>) -> Result<Response, Fehler> {
    let verworfen = blockierend(&app, move |k| k.fieber_verwerfen(&slug)).await?;
    Ok(Json(json!({ "verworfen": verworfen })).into_response())
}

#[utoipa::path(
    put,
    path = "/api/boards/{slug}/anwendungen",
    tag = "Boards",
    description = "Bindung setzen [kürzel…] registrierter Anwendungen (applications); [] löst das Board (reines Kanban, keine Phasen, nachgetragene Spalten bleiben), ein Commit „Anwendungen von „<Board>“: …“; unbekanntes Kürzel → 400",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Vec<String>,
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Geaendert), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn bindung_setzen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(kuerzel): Json<Vec<String>>) -> Result<Response, Fehler> {
    let geaendert = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.bindung_setzen(&p, &slug, &kuerzel)
    })
    .await?;
    Ok(Json(json!({ "geaendert": geaendert })).into_response())
}

/// Die Einstellungen in der Form, die `PUT` annimmt (R00091).
#[utoipa::path(
    get,
    path = "/api/einstellungen",
    tag = "Ordner",
    description = "Personen, Klassen, Signale und Quellen in der Form, die PUT annimmt",
    responses((status = 200, description = "Erfolg", body = crate::modell::Einstellungen), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn einstellungen_lesen(State(app): State<App>) -> Result<Response, Fehler> {
    let e = blockierend(&app, |k| k.ordner().einstellungen()?.ok_or_else(|| Fehler::Konflikt("Der Ordner ist noch nicht eingerichtet".into()))).await?;
    Ok(Json(e).into_response())
}

#[utoipa::path(
    get,
    path = "/api/personen",
    tag = "Personen",
    description = "{personen: [{kuerzel, name, art: human|agent, aktiv}]}",
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Personenliste), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn personen(State(app): State<App>) -> Result<Response, Fehler> {
    let e = blockierend(&app, |k| k.ordner().einstellungen()?.ok_or_else(|| Fehler::Konflikt("Der Ordner ist noch nicht eingerichtet".into()))).await?;
    Ok(Json(json!({ "personen": e.personen })).into_response())
}

#[utoipa::path(
    post,
    path = "/api/personen",
    tag = "Personen",
    description = "Person anlegen {kuerzel, name, art: human|agent, aktiv?} → 201 mit der Person; Kürzel 1–8 Kleinbuchstaben oder Ziffern, Name nicht leer; Kürzel vorhanden → 409; ein Commit der kanbanD.md",
    params(("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::dienst::Personenangabe,
    responses((status = 201, description = "Erfolg", body = crate::modell::Person), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn person_anlegen(State(app): State<App>, Wer(wer): Wer, Json(n): Json<crate::dienst::Personenangabe>) -> Result<Response, Fehler> {
    let p = blockierend(&app, move |k| {
        let wer = k.handelnder(wer.as_deref())?;
        k.person_anlegen(&wer, &n)
    })
    .await?;
    Ok((StatusCode::CREATED, Json(p)).into_response())
}

#[utoipa::path(
    patch,
    path = "/api/personen/{kuerzel}",
    tag = "Personen",
    description = "Person ändern {name?, art?, aktiv?} → die Person; andere Personen, Klassen und Signale bleiben; unbekannt → 404; ohne Änderung kein Commit",
    params(("kuerzel" = String, Path, description = "Kürzel einer Person bzw. Anwendung"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::dienst::PersonAenderung,
    responses((status = 200, description = "Erfolg", body = crate::modell::Person), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn person_aendern(State(app): State<App>, Wer(wer): Wer, Path(kuerzel): Path<String>, Json(a): Json<crate::dienst::PersonAenderung>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.person_aendern(p, &kuerzel, &a)).await
}

/// Personen werden nie entfernt, nur stillgelegt — `DELETE` setzt `aktiv: false`.
#[utoipa::path(
    delete,
    path = "/api/personen/{kuerzel}",
    tag = "Personen",
    description = "Person stilllegen (aktiv: false) — Personen werden nie entfernt; Antwort die Person",
    params(("kuerzel" = String, Path, description = "Kürzel einer Person bzw. Anwendung"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    responses((status = 200, description = "Erfolg", body = crate::modell::Person), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn person_stilllegen(State(app): State<App>, Wer(wer): Wer, Path(kuerzel): Path<String>) -> Result<Response, Fehler> {
    let stilllegen = crate::dienst::PersonAenderung { aktiv: Some(false), ..Default::default() };
    als_person(&app, wer, move |k, p| k.person_aendern(p, &kuerzel, &stilllegen)).await
}

#[utoipa::path(
    put,
    path = "/api/einstellungen",
    tag = "Ordner",
    description = "Personen, Klassen, Signale, Quellen und Register der Anwendungen ersetzen (Personen nur stilllegen); signale: [{schluessel, bezeichnung, farbe}] — Schlüssel wie Klassen, „due“ vergeben",
    params(("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::modell::Einstellungen,
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Geaendert), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn einstellungen_setzen(State(app): State<App>, Wer(wer): Wer, Json(neu): Json<Einstellungen>) -> Result<Response, Fehler> {
    let geaendert = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.einstellungen_setzen(&p, neu)
    })
    .await?;
    Ok(Json(json!({ "geaendert": geaendert })).into_response())
}

/// Aufgabe mit Pfad und Dateitext; eine defekte Datei kommt mit Fehler und Status 423.
#[utoipa::path(
    get,
    path = "/api/aufgaben/{nr}",
    tag = "Aufgaben",
    description = "die Aufgabe direkt, dazu pfad und text der Datei auf oberster Ebene (423 bei defekter Datei: {fehler, pfad, text})",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe")),
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::AufgabeMitDatei), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::DefekteAufgabe), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn aufgabe_lesen(State(app): State<App>, Path(nr): Path<u32>) -> Result<Response, Fehler> {
    blockierend(&app, move |k| {
        let pfad = k.ordner().aufgabenpfad(nr)?;
        let text = k.ordner().lies(&pfad)?.unwrap_or_default();
        Ok(match k.ordner().aufgabe(nr) {
            // ein Objekt direkt (R00092): die Karte, daneben Pfad und Text der Datei
            Ok(a) => {
                let mut karte = serde_json::to_value(&a).map_err(|e| Fehler::Intern(format!("Aufgabe als JSON: {e}")))?;
                karte["pfad"] = json!(pfad);
                karte["text"] = json!(text);
                Json(karte).into_response()
            }
            Err(f) => (StatusCode::LOCKED, Json(json!({ "fehler": f.meldung(), "pfad": pfad, "text": text }))).into_response(),
        })
    })
    .await
}

#[utoipa::path(
    patch,
    path = "/api/aufgaben/{nr}",
    tag = "Aufgaben",
    description = "ändern {titel?, beschreibung?, klasse?, zustaendige?, labels?, faellig?, herkunft?, signale?: [Schlüssel], phasen?: {uebersprungen: [Phase]}, reporting?: {burndown?: bool | null, forecast?: bool | null}} — phasen.uebersprungen (auch skipped) ersetzt phases.skipped: diese Phasen entfallen für die Aufgabe; reporting setzt, ob die Aufgabe im Burndown bzw. in Wie lange noch zählt (false nimmt sie aus, null entfernt den Schlüssel: Standard, sie zählt), Commit „#n geändert: Zählen in Berichten“",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::modell::Aufgabenaenderung,
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn aufgabe_aendern(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, Json(aenderung): Json<Aufgabenaenderung>) -> Result<Response, Fehler> {
    let a = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.aufgabe_aendern(&p, nr, &aenderung)
    })
    .await?;
    Ok(Json(a).into_response())
}

#[utoipa::path(
    put,
    path = "/api/aufgaben/{nr}/signale/{signal}",
    tag = "Aufgaben",
    description = "Signal setzen — hebt die Aufgabe hervor (pulsierende Fackel auf der Karte, Zahl im Spaltenkopf); nur in kanbanD.md eingerichtete Signale (signals), sonst 400; schon gesetzt: kein Commit; Commit „#n Signal „<Bedeutung>“ gesetzt“ → Aufgabe",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("signal" = String, Path, description = "Schlüssel des Signals aus kanbanD.md"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn signal_setzen(State(app): State<App>, Wer(wer): Wer, Path((nr, signal)): Path<(u32, String)>) -> Result<Response, Fehler> {
    signal_schalten(app, wer, nr, signal, true).await
}

#[utoipa::path(
    delete,
    path = "/api/aufgaben/{nr}/signale/{signal}",
    tag = "Aufgaben",
    description = "Signal zurücknehmen; nicht gesetzt: kein Commit; Commit „#n Signal „<Bedeutung>“ zurückgenommen“ → Aufgabe. Das Signal „due“ (Fälligkeit heute oder überschritten) wird gerechnet und folgt dem Feld faellig",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("signal" = String, Path, description = "Schlüssel des Signals aus kanbanD.md"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn signal_zuruecknehmen(State(app): State<App>, Wer(wer): Wer, Path((nr, signal)): Path<(u32, String)>) -> Result<Response, Fehler> {
    signal_schalten(app, wer, nr, signal, false).await
}

async fn signal_schalten(app: App, wer: Option<String>, nr: u32, signal: String, an: bool) -> Result<Response, Fehler> {
    let a = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.signal_schalten(&p, nr, &signal, an)
    })
    .await?;
    Ok(Json(a).into_response())
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
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

#[utoipa::path(
    post,
    path = "/api/aufgaben/{nr}/teilaufgaben",
    tag = "Aufgaben",
    description = "Teilaufgabe anlegen {text}",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Text,
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn teilaufgabe_anlegen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, Json(t): Json<Text>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.teilaufgabe_anlegen(p, nr, &t.text)).await
}

#[utoipa::path(
    patch,
    path = "/api/aufgaben/{nr}/teilaufgaben/{i}",
    tag = "Aufgaben",
    description = "Teilaufgabe ändern {erledigt?, text?, position?} — position verschiebt an diese Stelle (0-basiert, außerhalb = ans Ende)",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("i" = usize, Path, description = "Position in der Liste, ab 0"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::dienst::Teilaufgabenaenderung,
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn teilaufgabe_aendern(State(app): State<App>, Wer(wer): Wer, Path((nr, i)): Path<(u32, usize)>, Json(a): Json<Teilaufgabenaenderung>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.teilaufgabe_aendern(p, nr, i, &a)).await
}

#[utoipa::path(
    delete,
    path = "/api/aufgaben/{nr}/teilaufgaben/{i}",
    tag = "Aufgaben",
    description = "Teilaufgabe entfernen",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("i" = usize, Path, description = "Position in der Liste, ab 0"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn teilaufgabe_entfernen(State(app): State<App>, Wer(wer): Wer, Path((nr, i)): Path<(u32, usize)>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.teilaufgabe_entfernen(p, nr, i)).await
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/{nr}/kommentare",
    tag = "Aufgaben",
    description = "kommentieren {text}",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Text,
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn kommentieren(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, Json(t): Json<Text>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.kommentieren(p, nr, &t.text)).await
}

#[utoipa::path(
    patch,
    path = "/api/aufgaben/{nr}/wbs-effects",
    tag = "Aufgaben",
    description = "Wirkung auf die WBS vermerken, ohne sie auszuführen {application, action: create|rework|remove, node?, parent?, level?, name?, done_criterion?} → Aufgabe; executed: false, die WBS bleibt; geprüft gegen die WBS (Knoten fehlt, Datei defekt oder nicht erreichbar 409, falsche Angaben 400); dieselbe Wirkung zweimal: kein Commit",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::dienst::WirkungEingabe,
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn wirkung_setzen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, Json(w): Json<crate::dienst::WirkungEingabe>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.wirkung_setzen(p, nr, &w)).await
}

#[utoipa::path(
    get,
    path = "/api/aufgaben/{nr}/wbs-effects",
    tag = "Aufgaben",
    description = "Wirkungen mit Eintritt [{i, application, action, node?, …, executed, eingetreten: true|false|null, erfuellt: true|false|null}] — erfuellt (Zielzustand): create/rework Knoten gerechnet gruen, remove verworfen oder fehlt; eingetreten — create: Knoten steht und ist nicht verworfen; remove: Knoten verworfen oder fehlt; rework: executed gesetzt (fehlt = vor R00071, gilt als eingetreten); null: WBS nicht lesbar",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe")),
    responses((status = 200, description = "Erfolg", body = Vec<crate::dienst::Wirkungsstand>), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn wirkungen_stand(State(app): State<App>, Path(nr): Path<u32>) -> Result<Response, Fehler> {
    Ok(Json(blockierend(&app, move |k| k.wirkungen_stand(nr)).await?).into_response())
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct Eintritt {
    an: bool,
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/{nr}/wbs-effects/{i}/eintritt",
    tag = "Aufgaben",
    description = "Eintritt schalten {an: true|false} → Aufgabe; an: create legt an (ID wird eingetragen), rework setzt den Teilbaum rot, remove verwirft; aus: create verwirft den Knoten, remove hebt das Verwerfen auf (Blätter rot), rework nimmt nur den Vermerk zurück; schon so: keine Änderung; die WBS ohne Commit, ein Commit im Board-Repository",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("i" = usize, Path, description = "Position in der Liste, ab 0"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Eintritt,
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn wirkung_eintritt(State(app): State<App>, Wer(wer): Wer, Path((nr, i)): Path<(u32, usize)>, Json(e): Json<Eintritt>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.wirkung_eintritt(p, nr, i, e.an)).await
}

#[utoipa::path(
    delete,
    path = "/api/aufgaben/{nr}/wbs-effects/{i}",
    tag = "Aufgaben",
    description = "Wirkung aus der Aufgabe entfernen — die WBS bleibt, wie sie ist",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("i" = usize, Path, description = "Position in der Liste, ab 0"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn wirkung_entfernen(State(app): State<App>, Wer(wer): Wer, Path((nr, i)): Path<(u32, usize)>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.wirkung_entfernen(p, nr, i)).await
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/{nr}/timer/start",
    tag = "Zeiten",
    description = "eigenen Timer starten",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn timer_starten(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.timer_starten(p, nr)).await
}

#[derive(serde::Deserialize, Default, utoipa::ToSchema)]
struct Stopp {
    wer: Option<String>,
}

/// Der Körper ist freiwillig: leer, `null` oder `{"wer": "<kürzel>"}`.
#[utoipa::path(
    post,
    path = "/api/aufgaben/{nr}/timer/stop",
    tag = "Zeiten",
    description = "Timer stoppen {wer?} — auch fremde; lief er (seit dem Start über diesen Server) unter 20 s, wird die Zeile verworfen statt abgeschlossen",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body(content = Option<Stopp>, description = "freiwillig"),
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn timer_stoppen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, koerper: axum::body::Bytes) -> Result<Response, Fehler> {
    let fuer = serde_json::from_slice::<Option<Stopp>>(&koerper).ok().flatten().unwrap_or_default().wer;
    als_person(&app, wer, move |k, p| k.timer_stoppen(p, nr, fuer.as_deref())).await
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/{nr}/zeiten",
    tag = "Zeiten",
    description = "Zeit nachtragen — entweder {dauer} (endet jetzt) oder {beginn, ende} (Formen wie bei der Korrektur; Ende nach Beginn, nicht in der Zukunft); optional wer: bucht für diese Person, Autor bleibt die handelnde; gleiche Kennung wer@beginn schon vorhanden → 409",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::dienst::Zeitnachtrag,
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn zeit_nachtragen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, Json(n): Json<crate::dienst::Zeitnachtrag>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.zeit_nachtragen(p, nr, &n)).await
}

#[utoipa::path(
    patch,
    path = "/api/aufgaben/{nr}/zeiten/{kennung}",
    tag = "Zeiten",
    description = "Zeiteintrag über seine Kennung wer@JJJJ-MM-TTTHH:MM±HH:MM (Feld kennung jedes Zeiteintrags, URL-kodiert) korrigieren {beginn?, ende?}; ein neuer Beginn gibt eine neue Kennung — JJJJ-MM-TT HH:MM, optional ±HH:MM oder Z, auch ISO mit T; ohne Versatz als Ortszeit, gespeichert in Ortszeit mit Versatz",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("kennung" = String, Path, description = "Kennung des Zeiteintrags wer@JJJJ-MM-TTTHH:MM±HH:MM, URL-kodiert"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::dienst::Zeitkorrektur,
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn zeit_korrigieren(State(app): State<App>, Wer(wer): Wer, Path((nr, kennung)): Path<(u32, String)>, Json(z): Json<Zeitkorrektur>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.zeit_korrigieren(p, nr, &kennung, &z)).await
}

#[utoipa::path(
    delete,
    path = "/api/aufgaben/{nr}/zeiten/{kennung}",
    tag = "Zeiten",
    description = "Zeiteintrag über seine Kennung löschen (nur beendete); unbekannte Kennung → 404",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("kennung" = String, Path, description = "Kennung des Zeiteintrags wer@JJJJ-MM-TTTHH:MM±HH:MM, URL-kodiert"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn zeit_loeschen(State(app): State<App>, Wer(wer): Wer, Path((nr, kennung)): Path<(u32, String)>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.zeit_loeschen(p, nr, &kennung)).await
}

#[utoipa::path(
    get,
    path = "/api/aufgaben/{nr}/anhaenge",
    tag = "Aufgaben",
    description = "Anhänge auflisten",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe")),
    responses((status = 200, description = "Erfolg", body = Vec<crate::dienst::Anhang>), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn anhaenge(State(app): State<App>, Path(nr): Path<u32>) -> Result<Response, Fehler> {
    let liste = blockierend(&app, move |k| k.anhaenge(nr)).await?;
    Ok(Json(liste).into_response())
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/{nr}/anhaenge",
    tag = "Aufgaben",
    description = "Anhang hochladen (multipart, Feld datei)",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body(content_type = "multipart/form-data", description = "Feld datei mit der Datei"),
    responses((status = 201, description = "Erfolg", body = crate::dienst::Anhang), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
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

#[utoipa::path(
    get,
    path = "/api/aufgaben/{nr}/anhaenge/{name}",
    tag = "Aufgaben",
    description = "Anhang laden",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("name" = String, Path, description = "Dateiname des Anhangs")),
    responses((status = 200, description = "der Anhang mit seinem Inhaltstyp", content_type = "application/octet-stream", body = Vec<u8>), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
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

#[utoipa::path(
    delete,
    path = "/api/aufgaben/{nr}/anhaenge/{name}",
    tag = "Aufgaben",
    description = "Anhang entfernen",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("name" = String, Path, description = "Dateiname des Anhangs"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Entfernt), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn anhang_entfernen(State(app): State<App>, Wer(wer): Wer, Path((nr, name)): Path<(u32, String)>) -> Result<Response, Fehler> {
    blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.anhang_entfernen(&p, nr, &name)
    })
    .await?;
    Ok(Json(json!({ "entfernt": true })).into_response())
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/{nr}/durchlaeufe",
    tag = "Aufgaben",
    description = "Durchlauf eintragen {phase (1–40 Zeichen), ergebnis: bestanden|befund|entfaellt, dauer?, text?, wer?} — jetzt mit Versatz, wer wie beim Zeitnachtrag; Zeile im Block kanbanD-runs und Kommentar „<Phase> <ergebnis> (<wer>, <dauer>): <text>“ in einem Commit; die Aufgabe trägt durchlaeufe: [{zeitpunkt, phase, ergebnis, wer, dauer_minuten, text}]",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::dienst::NeuerDurchlauf,
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn durchlauf_eintragen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, Json(n): Json<crate::dienst::NeuerDurchlauf>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.durchlauf_eintragen(p, nr, &n)).await
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/{nr}/reservierung",
    tag = "Reservierungen",
    description = "reservieren für Wer und Instanz (Header X-KanbanD-Instanz oder Feld instanz, 1–64 Zeichen A–Z a–z 0–9 . _ -) — 24 h ab jetzt; eigene Instanz verlängert; fremde gültige → 409 mit Inhaber; Antwort: die Aufgabe mit reservierung {wer, instanz, seit}. Eine fremde Reservierung sperrt nur Reservieren und Ziehen",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md"), ("X-KanbanD-Instanz" = String, Header, description = "Pflicht, Kennung der laufenden Instanz, 1–64 Zeichen aus A–Z a–z 0–9 . _ -; ersatzweise Feld instanz im Rumpf")),
    request_body(content = Option<crate::web::openapi::InstanzAngabe>, description = "freiwillig"),
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn reservieren(State(app): State<App>, Wer(wer): Wer, Instanz(instanz): Instanz, Path(nr): Path<u32>, rumpf: axum::body::Bytes) -> Result<Response, Fehler> {
    let instanz = crate::dienst::instanz_pruefen(instanz_aus(instanz, &rumpf).as_deref())?;
    als_person(&app, wer, move |k, p| k.reservieren(p, &instanz, nr)).await
}

#[utoipa::path(
    post,
    path = "/api/boards/{slug}/ziehen",
    tag = "Reservierungen",
    description = "nächste Karte ziehen {von, nach?, instanz?} — braucht Wer und Instanz; atomar in einem Commit: die oberste Karte in von ohne fremde gültige Reservierung (eigene zählt als frei, archivierte nicht) wird für Wer/Instanz reserviert, Wer zuständig und oben in nach einsortiert (ohne nach: die Spalte rechts von von; letzte Spalte → 400); Prüfungen wie bei bewegen; Antwort {aufgabe, von, nach, warnungen}; keine freie Karte → 404 {fehler: \"nichts zu ziehen\"}",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md"), ("X-KanbanD-Instanz" = String, Header, description = "Pflicht, Kennung der laufenden Instanz, 1–64 Zeichen aus A–Z a–z 0–9 . _ -; ersatzweise Feld instanz im Rumpf")),
    request_body = crate::web::openapi::ZugMitInstanz,
    responses((status = 200, description = "Erfolg", body = crate::dienst::Gezogen), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn ziehen(State(app): State<App>, Wer(wer): Wer, Instanz(instanz): Instanz, Path(slug): Path<String>, rumpf: axum::body::Bytes) -> Result<Response, Fehler> {
    let instanz = crate::dienst::instanz_pruefen(instanz_aus(instanz, &rumpf).as_deref())?;
    let zug: crate::dienst::Zug = serde_json::from_slice(&rumpf).map_err(|e| Fehler::Ungueltig(format!("Rumpf {{von, nach?}}: {e}")))?;
    als_person(&app, wer, move |k, p| k.ziehen(p, &instanz, &slug, &zug)).await
}

#[utoipa::path(
    delete,
    path = "/api/aufgaben/{nr}/reservierung",
    tag = "Reservierungen",
    description = "freigeben — die eigene Instanz, oder ein Mensch jede; fremde Instanz eines Agenten → 409; keine Reservierung → 404",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md"), ("X-KanbanD-Instanz" = Option<String>, Header, description = "Kennung der laufenden Instanz, 1–64 Zeichen aus A–Z a–z 0–9 . _ -; ersatzweise Feld instanz im Rumpf")),
    request_body(content = Option<crate::web::openapi::InstanzAngabe>, description = "freiwillig"),
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn freigeben(State(app): State<App>, Wer(wer): Wer, Instanz(instanz): Instanz, Path(nr): Path<u32>, rumpf: axum::body::Bytes) -> Result<Response, Fehler> {
    let instanz = instanz_aus(instanz, &rumpf);
    als_person(&app, wer, move |k, p| k.freigeben(p, instanz.as_deref(), nr)).await
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/{nr}/archivieren",
    tag = "Aufgaben",
    description = "archivieren (stoppt laufende Timer, entfernt die Reservierung)",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn archivieren(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.archivieren(p, nr)).await
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/{nr}/zurueckholen",
    tag = "Aufgaben",
    description = "aus dem Archiv zurückholen",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn zurueckholen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.zurueckholen(p, nr)).await
}

#[utoipa::path(
    get,
    path = "/api/herkunft",
    tag = "Aufgaben",
    description = "WBS-Knoten und Anforderungen der verwendeten Herkunft, je Schreibweise mit anwendung und schluessel",
    responses((status = 200, description = "Erfolg", body = std::collections::BTreeMap<String, crate::dienst::Quelle>), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn herkunft(State(app): State<App>) -> Result<Response, Fehler> {
    let q = blockierend(&app, |k| k.herkunft()).await?;
    Ok(Json(q).into_response())
}

#[utoipa::path(
    get,
    path = "/api/anwendungen",
    tag = "Ordner",
    description = "Register der Anwendungen {kürzel: {name, wbs, anforderungen, erreichbar: {wbs, anforderungen}}}",
    responses((status = 200, description = "Erfolg", body = std::collections::BTreeMap<String, crate::dienst::Registereintrag>), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn anwendungen(State(app): State<App>) -> Result<Response, Fehler> {
    let r = blockierend(&app, |k| k.anwendungen()).await?;
    Ok(Json(r).into_response())
}

#[utoipa::path(
    get,
    path = "/api/wbs/{kuerzel}",
    tag = "WBS",
    description = "WBS einer registrierten Anwendung {knoten: [{id, ebene, eltern, name, status, gerechnet, erreicht, …, zeile}], stand: {gruen, gelb, rot, slices, aktiv, pfad, laufend}, nicht_committet, anforderungen}; 404 unbekannt, 409 nicht erreichbar",
    params(("kuerzel" = String, Path, description = "Kürzel einer Person bzw. Anwendung")),
    responses((status = 200, description = "Erfolg", body = crate::dienst::WbsSicht), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn wbs(State(app): State<App>, Path(kuerzel): Path<String>) -> Result<Response, Fehler> {
    let w = blockierend(&app, move |k| k.wbs(&kuerzel)).await?;
    Ok(Json(w).into_response())
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct StatusWahl {
    #[serde(default)]
    status: String,
}

#[utoipa::path(
    patch,
    path = "/api/wbs/{kuerzel}/knoten/{id}",
    tag = "WBS",
    description = "Status eines Blatts setzen {status: rot|gelb|gruen} → {geaendert: [ids]}; Vorfahren gerechnet, zuletzt gesetzt, kein Commit im Arbeits-Repository; 409 bei Kindern oder defekter Datei, 400 bei option/ausbau/verworfen/bestehend",
    params(("kuerzel" = String, Path, description = "Kürzel einer Person bzw. Anwendung"), ("id" = String, Path, description = "Knoten-ID der WBS, z. B. I0007"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = StatusWahl,
    responses((status = 200, description = "Erfolg", body = crate::dienst::WbsGeaendert), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn wbs_status(State(app): State<App>, Wer(wer): Wer, Path((kuerzel, id)): Path<(String, String)>, Json(w): Json<StatusWahl>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, _| k.wbs_status_setzen(&kuerzel, &id, &w.status)).await
}

#[utoipa::path(
    post,
    path = "/api/wbs/{kuerzel}/knoten",
    tag = "WBS",
    description = "Knoten anlegen {ebene, eltern, name, fertig_kriterium, eingabe_ausgabe?, aufwand?, ausbaustufe?, braucht?, requirement?, notiz?} → 201 {id}; nächste freie ID auch aus der Git-Historie der WBS, Zeile rot nach dem letzten Nachfahren der Eltern, kein Commit; 400 bei fehlendem Pflichtfeld, falscher Eltern-Ebene oder Aufwand unter 0,4h",
    params(("kuerzel" = String, Path, description = "Kürzel einer Person bzw. Anwendung"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::wbs_datei::NeuerKnoten,
    responses((status = 201, description = "Erfolg", body = crate::dienst::WbsNeu), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn wbs_knoten_anlegen(State(app): State<App>, Wer(wer): Wer, Path(kuerzel): Path<String>, Json(neu): Json<crate::wbs_datei::NeuerKnoten>) -> Result<Response, Fehler> {
    let r = blockierend(&app, move |k| {
        k.handelnder(wer.as_deref())?;
        k.wbs_knoten_anlegen(&kuerzel, &neu)
    })
    .await?;
    Ok((StatusCode::CREATED, Json(r)).into_response())
}

#[derive(serde::Deserialize, Default, utoipa::ToSchema)]
struct Grund {
    #[serde(default)]
    grund: String,
}

/// Der Körper ist freiwillig: leer, `null` oder `{"grund": "…"}`.
#[utoipa::path(
    post,
    path = "/api/wbs/{kuerzel}/knoten/{id}/verwerfen",
    tag = "WBS",
    description = "Knoten verwerfen {grund?} → {geaendert: [ids]}; verworfen an Knoten und zählenden Nachfahren, keine Zeile gelöscht, Grund in der Notiz, kein Commit; 409 schon verworfen oder Application",
    params(("kuerzel" = String, Path, description = "Kürzel einer Person bzw. Anwendung"), ("id" = String, Path, description = "Knoten-ID der WBS, z. B. I0007"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Grund,
    responses((status = 200, description = "Erfolg", body = crate::dienst::WbsGeaendert), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn wbs_verwerfen(State(app): State<App>, Wer(wer): Wer, Path((kuerzel, id)): Path<(String, String)>, koerper: axum::body::Bytes) -> Result<Response, Fehler> {
    let grund = serde_json::from_slice::<Option<Grund>>(&koerper).ok().flatten().unwrap_or_default().grund;
    als_person(&app, wer, move |k, _| k.wbs_verwerfen(&kuerzel, &id, &grund)).await
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct Ablage {
    nummer: u32,
    spalte: Option<String>,
}

#[utoipa::path(
    post,
    path = "/api/boards/{slug}/aufgaben",
    tag = "Boards",
    description = "Aufgabe auf das Board legen {nummer, spalte?}",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Ablage,
    responses((status = 201, description = "Erfolg", body = crate::web::openapi::SpalteAntwort), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn auf_board_legen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(a): Json<Ablage>) -> Result<Response, Fehler> {
    let spalte = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.auf_board_legen(&p, &slug, a.nummer, a.spalte.as_deref())
    })
    .await?;
    Ok((StatusCode::CREATED, Json(json!({ "spalte": spalte }))).into_response())
}

#[utoipa::path(
    delete,
    path = "/api/boards/{slug}/aufgaben/{nr}",
    tag = "Boards",
    description = "Aufgabe vom Board nehmen",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    responses((status = 200, description = "Erfolg", body = crate::web::openapi::Genommen), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn von_board_nehmen(State(app): State<App>, Wer(wer): Wer, Path((slug, nr)): Path<(String, u32)>) -> Result<Response, Fehler> {
    blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.von_board_nehmen(&p, &slug, nr)
    })
    .await?;
    Ok(Json(json!({ "genommen": true })).into_response())
}

/// Alle lesbaren Boards mit Struktur, nach Dateiname sortiert.
#[utoipa::path(
    get,
    path = "/api/boards",
    tag = "Boards",
    description = "alle Boards mit Spalten und Aufgabennummern — ohne archivierte Karten, mit ?archivierte=ja mit ihnen",
    params(("archivierte" = Option<String>, Query, description = "ja nimmt archivierte Karten in die Spalten auf")),
    responses((status = 200, description = "Erfolg", body = Vec<crate::modell::Board>), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn boards(State(app): State<App>, Query(q): Query<MitArchivierten>) -> Result<Response, Fehler> {
    let boards = blockierend(&app, move |k| {
        let (mut boards, _) = k.ordner().boards()?;
        if !q.gewuenscht() {
            ohne_archivierte(k, &mut boards.iter_mut().collect::<Vec<_>>())?;
        }
        Ok(boards)
    })
    .await?;
    Ok(Json(boards).into_response())
}

#[utoipa::path(
    get,
    path = "/api/berichte/zeiten.csv",
    tag = "Berichte",
    description = "alle Zeiteinträge als CSV",
    responses((status = 200, description = "Zeiteinträge als CSV mit ; und BOM", content_type = "text/csv", body = String), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn zeiten_csv(State(app): State<App>) -> Result<Response, Fehler> {
    let csv = blockierend(&app, |k| {
        let (aufgaben, _) = k.ordner().aufgaben()?;
        let e = k.ordner().einstellungen().ok().flatten().unwrap_or_default();
        Ok(crate::berichte::zeiten_csv(&aufgaben, &e, &crate::uhr::jetzt()))
    })
    .await?;
    Ok(([(axum::http::header::CONTENT_TYPE, "text/csv; charset=utf-8"), (axum::http::header::CONTENT_DISPOSITION, "attachment; filename=\"kanbanD-zeiten.csv\"")], csv).into_response())
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct BoardWahl {
    board: String,
}

#[utoipa::path(
    get,
    path = "/api/berichte/verlauf",
    tag = "Berichte",
    description = "offene Aufgaben je Tag und Durchlaufzeiten aus Git",
    params(("board" = Option<String>, Query, description = "Slug des Boards")),
    responses((status = 200, description = "Erfolg", body = crate::verlauf::Verlauf), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn verlauf(State(app): State<App>, axum::extract::Query(w): axum::extract::Query<BoardWahl>) -> Result<Response, Fehler> {
    let v = blockierend(&app, move |k| k.verlauf(&w.board)).await?;
    Ok(Json(v).into_response())
}

#[utoipa::path(
    get,
    path = "/api/berichte/bewegungen",
    tag = "Berichte",
    description = "je Aufgabe die Spaltenwechsel aus Git (Grundlage der Board-Berichte) {spalten: [Name in heutiger Reihenfolge, die letzte ist die Abschlussspalte], jetzt: JJJJ-MM-TT HH:MM, aufgaben: [{nummer, wechsel: [{zeitpunkt: JJJJ-MM-TT HH:MM, spalte: Name | null = vom Board genommen}], labels, uebersprungen: phases.skipped, reporting: {burndown?: false, forecast?: false} (nur gesetzte Schlüssel; fehlt einer, zählt die Aufgabe)}], phasen: null bei reinem Kanban | {anwendung, folge: [{nr, name, eingebettet, gleich}] (Hauptspur, ohne verworfen), spaltenphasen: {Spalte: Phase} (column-phases von heute, N:1)}} — eine Phase P ist durchlaufen, sobald die Aufgabe in einer Spalte einer späteren Phase oder in der Abschlussspalte liegt oder lag (erstes Erreichen zählt im Durchsatz, offen nach dem aktuellen Stand); gleich wie: mit der genannten Phase; eingebettet in im-pair: mit der Vorphase, wenn die Aufgabe das Label im-pair trägt; uebersprungen: nicht in Zähler, Nenner und Durchsatz der Phase; reporting.forecast false: nicht in Wie lange noch (Umfang, Nenner, Durchsatz, je Spalte und je Phase), reporting.burndown false: nicht im Burndown",
    params(("board" = Option<String>, Query, description = "Slug des Boards")),
    responses((status = 200, description = "Erfolg", body = crate::verlauf::Bewegungen), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn bewegungen(State(app): State<App>, axum::extract::Query(w): axum::extract::Query<BoardWahl>) -> Result<Response, Fehler> {
    let v = blockierend(&app, move |k| k.bewegungen(&w.board)).await?;
    Ok(Json(v).into_response())
}

/// Die Beschreibung der API; das Beispiel nennt die Adresse, unter der sie gerade abgerufen wird.
/// Wer JSON verlangt, bekommt die OpenAPI-Beschreibung (R00093).
#[utoipa::path(
    get,
    path = "/api",
    tag = "API",
    description = "diese Beschreibung als Seite; mit Accept: application/json 303 auf /api/openapi.json",
    responses((status = 200, description = "Beschreibung der API als Seite", content_type = "text/html", body = String), (status = 303, description = "mit Accept: application/json weiter nach /api/openapi.json"), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn api_seite(headers: axum::http::HeaderMap) -> Response {
    let will_json = headers.get(axum::http::header::ACCEPT).and_then(|a| a.to_str().ok()).is_some_and(|a| a.contains("application/json"));
    if will_json {
        return (StatusCode::SEE_OTHER, [(axum::http::header::LOCATION, "/api/openapi.json")]).into_response();
    }
    let host = headers.get(axum::http::header::HOST).and_then(|h| h.to_str().ok()).unwrap_or("localhost");
    (
        [(axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8")],
        endpunkte::api_seite(&format!("http://{host}/")),
    )
        .into_response()
}

#[utoipa::path(
    get,
    path = "/api/endpunkte",
    tag = "API",
    description = "diese Liste maschinenlesbar {methode, pfad, wer, thema, zweck}",
    responses((status = 200, description = "Erfolg", body = Vec<crate::web::endpunkte::Endpunkt>), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn endpunkte_liste() -> Json<&'static [endpunkte::Endpunkt]> {
    Json(endpunkte::ENDPUNKTE)
}

/// Die Beschreibung, aus Handlern und Typen erzeugt; einmal je Prozess gebaut.
static OPENAPI: std::sync::OnceLock<utoipa::openapi::OpenApi> = std::sync::OnceLock::new();

#[utoipa::path(
    get,
    path = "/api/openapi.json",
    tag = "API",
    description = "die vollständige Beschreibung als OpenAPI 3.1 — Felder, erlaubte Werte, Formate und Fehlerformen",
    responses((status = 200, description = "diese Beschreibung, OpenAPI 3.1", body = Object), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn openapi_json() -> Response {
    Json(OPENAPI.get()).into_response()
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/mehrere",
    tag = "Aufgaben",
    description = "mehrere anlegen {titel: [...], board?, spalte?} — ein Commit",
    params(("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = crate::dienst::NeueAufgaben,
    responses((status = 201, description = "Erfolg", body = Vec<crate::modell::Aufgabe>), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn aufgaben_anlegen(State(app): State<App>, Wer(wer): Wer, Json(neu): Json<NeueAufgaben>) -> Result<Response, Fehler> {
    let a = blockierend(&app, move |k| {
        let p = k.handelnder(wer.as_deref())?;
        k.aufgaben_anlegen(&p, &neu)
    })
    .await?;
    Ok((StatusCode::CREATED, Json(a)).into_response())
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct Texte {
    texte: Vec<String>,
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/{nr}/teilaufgaben/mehrere",
    tag = "Aufgaben",
    description = "mehrere Teilaufgaben anlegen {texte: [...]} — ein Commit",
    params(("nr" = u32, Path, description = "Nummer der Aufgabe"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Texte,
    responses((status = 200, description = "Erfolg", body = crate::modell::Aufgabe), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn teilaufgaben_anlegen(State(app): State<App>, Wer(wer): Wer, Path(nr): Path<u32>, Json(t): Json<Texte>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.teilaufgaben_anlegen(p, nr, &t.texte)).await
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct Nummern {
    nummern: Vec<u32>,
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct Ziele {
    ziele: Vec<Bewegung>,
}

#[utoipa::path(
    post,
    path = "/api/boards/{slug}/bewegen-mehrere",
    tag = "Boards",
    description = "mehrere Aufgaben bewegen {ziele: [{nummer, spalte, index?}]} — alle heraus, dann der Reihe nach an index ihrer Spalte, ohne index oben in Anfragereihenfolge (die erste genannte ganz oben); ein Commit; Antwort wie bewegen",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Ziele,
    responses((status = 200, description = "Erfolg", body = crate::dienst::Bewegt), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn mehrere_bewegen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(z): Json<Ziele>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.mehrere_bewegen(p, &slug, &z.ziele)).await
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct Legen {
    nummern: Vec<u32>,
    spalte: Option<String>,
}

#[utoipa::path(
    post,
    path = "/api/boards/{slug}/aufgaben/mehrere",
    tag = "Boards",
    description = "mehrere Aufgaben auf das Board legen {nummern, spalte?} — ein Commit, schon liegende bleiben; Antwort: gelegte Nummern",
    params(("slug" = String, Path, description = "Slug des Boards (Dateiname unter boards/ ohne .md)"), ("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Legen,
    responses((status = 200, description = "Erfolg", body = Vec<u32>), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn mehrere_auf_board_legen(State(app): State<App>, Wer(wer): Wer, Path(slug): Path<String>, Json(l): Json<Legen>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.mehrere_auf_board_legen(p, &slug, &l.nummern, l.spalte.as_deref())).await
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct EineAenderung {
    nummer: u32,
    #[serde(flatten)]
    aenderung: Aufgabenaenderung,
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct Aenderungen {
    aenderungen: Vec<EineAenderung>,
}

#[utoipa::path(
    patch,
    path = "/api/aufgaben/mehrere",
    tag = "Aufgaben",
    description = "mehrere ändern {aenderungen: [{nummer, …Felder wie PATCH /api/aufgaben/{nr}}]} — ein Commit, ein ungültiges Feld ändert nichts",
    params(("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Aenderungen,
    responses((status = 200, description = "Erfolg", body = Vec<crate::modell::Aufgabe>), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn mehrere_aendern(State(app): State<App>, Wer(wer): Wer, Json(a): Json<Aenderungen>) -> Result<Response, Fehler> {
    let liste: Vec<_> = a.aenderungen.into_iter().map(|e| (e.nummer, e.aenderung)).collect();
    als_person(&app, wer, move |k, p| k.mehrere_aendern(p, &liste)).await
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/archivieren",
    tag = "Aufgaben",
    description = "mehrere archivieren {nummern} — ein Commit",
    params(("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Nummern,
    responses((status = 200, description = "Erfolg", body = Vec<u32>), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn mehrere_archivieren(State(app): State<App>, Wer(wer): Wer, Json(n): Json<Nummern>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.mehrere_archivieren(p, &n.nummern, true)).await
}

#[utoipa::path(
    post,
    path = "/api/aufgaben/zurueckholen",
    tag = "Aufgaben",
    description = "mehrere zurückholen {nummern} — ein Commit",
    params(("X-KanbanD-Wer" = String, Header, description = "Kürzel der handelnden Person aus kanbanD.md")),
    request_body = Nummern,
    responses((status = 200, description = "Erfolg", body = Vec<u32>), (status = 400, description = "ungültige Eingabe", body = crate::web::openapi::Fehlerantwort), (status = 404, description = "nicht gefunden", body = crate::web::openapi::Fehlerantwort), (status = 423, description = "Datei defekt — nur lesbar", body = crate::web::openapi::Fehlerantwort), (status = 409, description = "Konflikt mit dem Zustand", body = crate::web::openapi::Fehlerantwort), (status = 500, description = "Git oder Dateisystem", body = crate::web::openapi::Fehlerantwort))
)]
async fn mehrere_zurueckholen(State(app): State<App>, Wer(wer): Wer, Json(n): Json<Nummern>) -> Result<Response, Fehler> {
    als_person(&app, wer, move |k, p| k.mehrere_archivieren(p, &n.nummern, false)).await
}
