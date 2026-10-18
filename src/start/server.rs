use std::io;
use tokio::net::TcpListener;

/// Bindet den ersten freien Port ab `port` (höchstens 50 Versuche); Port 0 überlässt die Wahl dem System.
pub async fn freien_listener_binden(host: &str, port: u16) -> io::Result<TcpListener> {
    if port == 0 {
        return TcpListener::bind((host, 0)).await;
    }
    let mut letzter_fehler = None;
    for p in port..port.saturating_add(50) {
        match TcpListener::bind((host, p)).await {
            Ok(l) => return Ok(l),
            Err(e) => letzter_fehler = Some(e),
        }
    }
    Err(letzter_fehler.unwrap_or_else(|| io::Error::other("kein freier Port")))
}

/// Die Adresse, unter der ein Browser auf diesem Rechner die Anwendung erreicht.
pub fn browser_adresse(host: &str, port: u16) -> String {
    let h = if host == "0.0.0.0" || host == "::" { "localhost" } else { host };
    format!("http://{h}:{port}/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lauschen_auf_allen_adressen_wird_fuer_den_browser_zu_localhost() {
        assert_eq!(browser_adresse("0.0.0.0", 7420), "http://localhost:7420/");
        assert_eq!(browser_adresse("192.168.1.5", 80), "http://192.168.1.5:80/");
    }

    #[tokio::test]
    async fn belegter_port_fuehrt_zum_naechsten_freien() {
        let belegt = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let p = belegt.local_addr().unwrap().port();
        let l = freien_listener_binden("127.0.0.1", p).await.unwrap();
        assert!(l.local_addr().unwrap().port() > p);
    }

    #[tokio::test]
    async fn port_null_waehlt_das_system() {
        let l = freien_listener_binden("127.0.0.1", 0).await.unwrap();
        assert_ne!(l.local_addr().unwrap().port(), 0);
    }
}
