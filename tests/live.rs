mod gemeinsam;

use kanband::waechter::{Eigene, Ereignis, starten};
use std::sync::mpsc;
use std::time::Duration;

fn beobachten(pfad: &std::path::Path) -> (notify::RecommendedWatcher, mpsc::Receiver<Ereignis>, Eigene) {
    let (tx, rx) = mpsc::channel();
    let eigene = Eigene::default();
    let w = starten(pfad.canonicalize().unwrap(), eigene.clone(), move |e| {
        let _ = tx.send(e);
    })
    .unwrap();
    std::thread::sleep(Duration::from_millis(100));
    (w, rx, eigene)
}

#[test]
fn editor_aenderung_ist_extern_und_gebuendelt() {
    let tmp = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(tmp.path().join("aufgaben")).unwrap();
    let (_w, rx, _) = beobachten(tmp.path());
    std::fs::write(tmp.path().join("aufgaben/0001-x.md"), "a").unwrap();
    std::fs::write(tmp.path().join("aufgaben/0001-x.md"), "b").unwrap();
    let e = rx.recv_timeout(Duration::from_secs(2)).unwrap();
    assert_eq!(e.pfade, vec!["aufgaben/0001-x.md"]);
    assert!(e.von_aussen);
}

#[test]
fn eigene_aenderung_ist_nicht_extern() {
    let tmp = tempfile::tempdir().unwrap();
    let (_w, rx, eigene) = beobachten(tmp.path());
    eigene.merken("boards/b.md");
    std::fs::create_dir_all(tmp.path().join("boards")).unwrap();
    std::fs::write(tmp.path().join("boards/b.md"), "x").unwrap();
    let mut alle = vec![];
    while let Ok(e) = rx.recv_timeout(Duration::from_millis(800)) {
        alle.push(e);
    }
    let e = alle.iter().find(|e| e.pfade.contains(&"boards/b.md".to_string())).expect("Ereignis zu boards/b.md");
    assert_eq!(e.pfade, vec!["boards/b.md"]);
    assert!(!e.von_aussen);
}

#[test]
fn git_und_zwischendateien_erzeugen_kein_ereignis() {
    let tmp = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(tmp.path().join(".git")).unwrap();
    let (_w, rx, _) = beobachten(tmp.path());
    std::fs::write(tmp.path().join(".git/index"), "x").unwrap();
    std::fs::write(tmp.path().join("a.kanbanD-tmp"), "x").unwrap();
    assert!(rx.recv_timeout(Duration::from_millis(600)).is_err());
}
