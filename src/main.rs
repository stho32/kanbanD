use kanband::start::{Aufruffehler, Startauftrag, browser, ordner, server};
use std::process::ExitCode;

fn main() -> ExitCode {
    let auftrag = match Startauftrag::aus_argumenten(std::env::args().skip(1)) {
        Ok(a) => a,
        Err(fehler) => {
            eprintln!("{fehler}");
            return if fehler == Aufruffehler::HilfeGewuenscht { ExitCode::SUCCESS } else { ExitCode::from(2) };
        }
    };
    let ordner = match ordner::ordner_vorbereiten(&auftrag.ordner) {
        Ok(o) => o,
        Err(e) => {
            eprintln!("Ordner {} lässt sich nicht vorbereiten: {e}", auftrag.ordner.display());
            return ExitCode::FAILURE;
        }
    };
    grosse_puffer_zurueckgeben();
    let laufzeit = tokio::runtime::Runtime::new().expect("Tokio-Laufzeit");
    laufzeit.block_on(starten(auftrag, ordner))
}

/// Große Puffer (ab 256 KB: Git-Ausgaben, Rümpfe der Diff-Antworten) gehen immer als eigene Abbildung an das System
/// und nach dem Freigeben sofort zurück (R00206, ADR-0032 N5.1). Ohne feste Schwelle hebt glibc sie nach dem ersten
/// freigegebenen großen Puffer an; danach liegen große Puffer im Heap der Threads und bleiben nach dem Freigeben im
/// Speicher des Prozesses — das Antwortbudget begrenzte dann nur die Buchung, nicht den Speicher.
#[cfg(all(target_os = "linux", target_env = "gnu"))]
fn grosse_puffer_zurueckgeben() {
    unsafe extern "C" {
        fn mallopt(param: i32, wert: i32) -> i32;
    }
    const M_MMAP_THRESHOLD: i32 = -3;
    // SAFETY: setzt nur eine Schwelle des Allokators, vor dem ersten Thread
    unsafe { mallopt(M_MMAP_THRESHOLD, 256 * 1024) };
}

#[cfg(not(all(target_os = "linux", target_env = "gnu")))]
fn grosse_puffer_zurueckgeben() {}

async fn starten(auftrag: Startauftrag, ordner: std::path::PathBuf) -> ExitCode {
    let listener = match server::freien_listener_binden(&auftrag.host, auftrag.port).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Kein freier Port ab {}: {e}", auftrag.port);
            return ExitCode::FAILURE;
        }
    };
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(auftrag.port);
    let adresse = server::browser_adresse(&auftrag.host, port);
    println!("kanbanD läuft für {} unter {adresse}", ordner.display());
    if auftrag.browser_oeffnen {
        browser::oeffnen(&adresse);
    }
    let (ende, ende_rx) = tokio::sync::watch::channel(false);
    let router = kanband::web::router_mit_ende(ordner, port, ende_rx);
    let signal = async move {
        beenden_verlangt().await;
        let _ = ende.send(true);
    };
    if let Err(e) = axum::serve(listener, router).with_graceful_shutdown(signal).await {
        eprintln!("Server beendet mit Fehler: {e}");
        return ExitCode::FAILURE;
    }
    ExitCode::SUCCESS
}

/// Strg+C oder SIGTERM beenden den Server geordnet.
async fn beenden_verlangt() {
    #[cfg(unix)]
    {
        let mut term = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).expect("SIGTERM-Handler");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {}
            _ = term.recv() => {}
        }
    }
    #[cfg(not(unix))]
    let _ = tokio::signal::ctrl_c().await;
}
