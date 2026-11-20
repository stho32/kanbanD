//! Ausliefern eines Rumpfs aus dem Antwortbudget (ADR-0032 N5.1 Regeln 4 und 5): als Strom **kopierter** Stücke von
//! 64 KB (`Bytes::copy_from_slice` — eine Teilansicht hielte den ganzen Rumpf im Schreibpuffer von hyper am Leben);
//! Rumpf und Budget-Platz liegen in einem geteilten Fach. Der Strom leert es nach dem letzten Stück, ein Abbruch der
//! Verbindung lässt es fallen. Liest der Client nicht, pollt hyper den Strom nie mehr — darum leert eine **Wache
//! außerhalb des Stroms** (eigener Task) das Fach nach der Schreibfrist; der nächste Poll endet mit einem Fehler.

use crate::dienst::antwortbudget::{Beleg, Rumpf};
use axum::body::{Body, Bytes};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Zeit, in der ein Client die ganze Antwort lesen muss, ab Übergabe an hyper (60 s).
pub const SCHREIBFRIST: Duration = Duration::from_secs(60);
/// Größe eines Stücks des Stroms.
pub const STUECK: usize = 65_536;

type Fach = Arc<Mutex<Option<(Bytes, Beleg)>>>;

/// Der Rumpf als Strom mit Wache; `frist` ist im Betrieb [`SCHREIBFRIST`], in Tests kürzer (interner Parameter).
pub fn ausliefern(rumpf: Rumpf, frist: Duration) -> Body {
    let (bytes, beleg) = rumpf.teilen();
    let fach: Fach = Arc::new(Mutex::new(Some((Bytes::from(bytes), beleg))));
    let wache = Arc::downgrade(&fach);
    tokio::spawn(async move {
        tokio::time::sleep(frist).await;
        if let Some(f) = wache.upgrade() {
            f.lock().unwrap_or_else(|p| p.into_inner()).take();
        }
    });
    Body::from_stream(futures_util::stream::unfold((fach, 0usize), |(fach, stelle)| async move {
        let stueck = naechstes(&fach, stelle)?;
        let weiter = stelle + stueck.as_ref().map_or(0, Bytes::len);
        Some((stueck, (fach, if weiter == stelle { usize::MAX } else { weiter })))
    }))
}

/// Das nächste Stück ab `stelle` als Kopie; `None` am Ende (das Fach wird geleert), ein Fehler nach der Schreibfrist.
fn naechstes(fach: &Fach, stelle: usize) -> Option<Result<Bytes, std::io::Error>> {
    let mut f = fach.lock().unwrap_or_else(|p| p.into_inner());
    match f.as_ref() {
        _ if stelle == usize::MAX => None,
        None => Some(Err(std::io::Error::other("Schreibfrist der Antwort abgelaufen"))),
        Some((bytes, _)) if stelle >= bytes.len() => {
            f.take();
            None
        }
        Some((bytes, _)) => Some(Ok(Bytes::copy_from_slice(&bytes[stelle..(stelle + STUECK).min(bytes.len())]))),
    }
}
