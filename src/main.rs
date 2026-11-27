use kanband::protokoll::{Ereignis, Protokoll, Stufe};
use kanband::start::{Aufruffehler, Startauftrag, Umgebung, browser, ordner, server};
use std::process::ExitCode;

fn main() -> ExitCode {
    // Aufruffehler vor dem Start bleiben die einzige Ausgabe von `main` (ADR-0001 N1.2 Regel 5).
    let auftrag = match Startauftrag::aus_argumenten(std::env::args().skip(1)) {
        Ok(a) => a,
        Err(fehler) => {
            eprintln!("{fehler}");
            return if fehler == Aufruffehler::HilfeGewuenscht { ExitCode::SUCCESS } else { ExitCode::from(2) };
        }
    };
    let umgebung = Umgebung::aus_prozess();
    let protokoll = Protokoll::betrieb(auftrag.log_stufe, auftrag.log_ordner(&auftrag.ordner, &umgebung));
    protokoll.panik_hook_installieren();
    let ordner = match ordner::ordner_vorbereiten(&auftrag.ordner) {
        Ok(o) => o,
        Err(e) => {
            protokoll.schreiben(Stufe::Error, Ereignis::Fehlgeschlagen, &[("grund", format!("Ordner {} lässt sich nicht vorbereiten: {e}", auftrag.ordner.display()))]);
            return ExitCode::FAILURE;
        }
    };
    grosse_puffer_zurueckgeben();
    let laufzeit = tokio::runtime::Runtime::new().expect("Tokio-Laufzeit");
    laufzeit.block_on(starten(auftrag, ordner, protokoll))
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

async fn starten(auftrag: Startauftrag, ordner: std::path::PathBuf, protokoll: Protokoll) -> ExitCode {
    let listener = match server::freien_listener_binden(&auftrag.host, auftrag.port).await {
        Ok(l) => l,
        Err(e) => {
            protokoll.schreiben(Stufe::Error, Ereignis::Fehlgeschlagen, &[("grund", format!("Kein freier Port ab {}: {e}", auftrag.port))]);
            return ExitCode::FAILURE;
        }
    };
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(auftrag.port);
    let adresse = server::browser_adresse(&auftrag.host, port);
    // Die Adresse bleibt als funktionale Ausgabe auf stdout (Aufrufer und Proben lesen sie); das Protokoll führt
    // dieselbe Aussage als `INFO gestartet` (R00258 AK 20).
    println!("kanbanD läuft für {} unter {adresse}", ordner.display());
    protokoll.schreiben(
        Stufe::Info,
        Ereignis::Gestartet,
        &[("ordner", ordner.display().to_string()), ("port", port.to_string()), ("log", protokoll.log_pfad().map(|p| p.display().to_string()).unwrap_or_else(|| "-".to_string()))],
    );
    if auftrag.browser_oeffnen {
        browser::oeffnen(&protokoll, &adresse);
    }
    let (ende, ende_rx) = tokio::sync::watch::channel(false);
    let (router, episoden) = kanband::web::router_mit_ende_protokoll_und_episoden(ordner, port, ende_rx, protokoll.clone());
    let signal = async move {
        beenden_verlangt().await;
        let _ = ende.send(true);
    };
    let ergebnis = axum::serve(listener, router).with_graceful_shutdown(signal).await;
    // Nach dem geordneten Beenden enden die offenen Episoden der Kapazitätsgrenzen (ADR-0001 N1.4 Regel 5,
    // R00269 AK 8): sonst bliebe die letzte Episode ohne Ende-Zeile.
    kanband::web::episoden_beenden(&episoden, &protokoll);
    if let Err(e) = ergebnis {
        protokoll.schreiben(Stufe::Error, Ereignis::Fehlgeschlagen, &[("grund", format!("Server beendet mit Fehler: {e}"))]);
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
