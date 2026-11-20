// R00206 AK 20 (d), (e) — ADR-0032 N5.1 Regeln 4 und 5: eine Antwort aus dem Antwortbudget geht als Strom kopierter
// Stücke hinaus; liest der Client nicht, gibt eine Wache außerhalb des Stroms nach der Schreibfrist Budget und Speicher
// frei, obwohl die Verbindung offen bleibt. Eigene Testdatei mit einem Test: gemessen wird der Speicher dieses Prozesses.
use axum::routing::get;
use kanband::dienst::antwortbudget::Antwortbudget;
use kanband::web::strom::ausliefern;
use std::io::{Read, Write};
use std::os::fd::AsRawFd;
use std::time::{Duration, Instant};

const MB: usize = 1 << 20;

fn rss() -> usize {
    let status = std::fs::read_to_string("/proc/self/status").unwrap();
    status.lines().find(|z| z.starts_with("VmRSS:")).and_then(|z| z.split_whitespace().nth(1)).unwrap().parse::<usize>().unwrap() * 1024
}

unsafe extern "C" {
    fn setsockopt(fd: i32, level: i32, name: i32, wert: *const std::ffi::c_void, laenge: u32) -> i32;
}

/// Wartet, bis `bedingung` gilt — höchstens `dauer`; liefert, ob sie galt.
async fn bis(dauer: Duration, bedingung: impl Fn() -> bool) -> bool {
    let ende = Instant::now() + dauer;
    while !bedingung() {
        if Instant::now() > ende {
            return false;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    true
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn kopierte_stuecke_und_wache_geben_nach_der_frist_frei() {
    let budget = Antwortbudget::mit(64 * MB);
    let b = budget.clone();
    let app = axum::Router::new().route("/", get(move || {
        let rumpf = b.belegen(vec![b'x'; 8 * MB]).expect("Budget frei");
        async move { axum::response::Response::new(ausliefern(rumpf, Duration::from_secs(1))) }
    }));
    let horcher = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let ziel = horcher.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(horcher, app).await.unwrap() });
    let vorher = rss();
    let mut s = std::net::TcpStream::connect(ziel).unwrap();
    let klein: i32 = 4096;
    assert_eq!(unsafe { setsockopt(s.as_raw_fd(), 1, 8, (&raw const klein).cast(), 4) }, 0);
    s.write_all(b"GET / HTTP/1.1\r\nHost: x\r\n\r\n").unwrap();
    let mut anfang = [0u8; 12];
    s.read_exact(&mut anfang).unwrap();
    assert_eq!(&anfang, b"HTTP/1.1 200");
    assert!(budget.frei() <= 56 * MB, "belegt, solange der Client nicht liest: {} MB frei", budget.frei() / MB);
    let start = Instant::now();
    // (e) Wache außerhalb des Stroms: hyper pollt den Strom nicht mehr, trotzdem ist das Budget nach der Frist frei
    assert!(bis(Duration::from_secs(5), || budget.frei() == 64 * MB).await, "Budget nach der Frist noch belegt: {} MB frei", budget.frei() / MB);
    assert!(start.elapsed() >= Duration::from_millis(500), "frei erst nach der Frist: {:?}", start.elapsed());
    // (d) Kopie statt Teilansicht: auch der Speicher ist frei, obwohl die Verbindung offen ist
    let frei = bis(Duration::from_secs(3), || rss() <= vorher + 4 * MB).await;
    assert!(frei, "VmRSS {} MB über dem Ausgangswert bei offener Verbindung", (rss() - vorher) / MB);
    drop(s);
}
