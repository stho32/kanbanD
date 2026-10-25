//! Zeitpunkte in der Zone Europe/Berlin (R00084): Ortszeit-Deutung und Rechnen über die Zeitumstellung.
//! Eigene Testdatei, weil die Zone über `TZ` für den ganzen Prozess gesetzt wird.

use kanband::uhr::{Zeitpunkt, jetzt, minuten, verschieben};

fn in_berlin() {
    // Alle Tests dieser Datei setzen denselben Wert — das parallele Setzen ist deshalb harmlos.
    unsafe { std::env::set_var("TZ", "Europe/Berlin") };
}

fn in_ortszeit(s: &str) -> String {
    Zeitpunkt::lesen(s).unwrap().in_ortszeit().datei()
}

#[test]
fn altbestand_zaehlt_als_ortszeit() {
    in_berlin();
    assert_eq!(minuten("2026-10-25 01:00", "2026-10-25 04:00"), Some(240));
    assert_eq!(minuten("2026-10-25 01:00+02:00", "2026-10-25 04:00"), Some(240), "gemischt");
}

#[test]
fn zweideutige_ortszeit_ist_die_fruehere_fehlende_die_spaetere() {
    in_berlin();
    assert_eq!(in_ortszeit("2026-10-25 02:30"), "2026-10-25 02:30+02:00");
    assert_eq!(in_ortszeit("2026-03-29 02:30"), "2026-03-29 03:30+02:00");
    assert_eq!(in_ortszeit("2026-01-05 12:00"), "2026-01-05 12:00+01:00");
}

#[test]
fn jetzt_traegt_den_berliner_versatz() {
    in_berlin();
    let j = jetzt();
    assert!(j.ends_with("+01:00") || j.ends_with("+02:00"), "{j}");
}

#[test]
fn eingaben_in_utc_landen_in_ortszeit() {
    in_berlin();
    assert_eq!(in_ortszeit("2026-10-25T06:41Z"), "2026-10-25 07:41+01:00");
    assert_eq!(in_ortszeit("2026-10-25T07:41+01:00"), "2026-10-25 07:41+01:00");
    assert_eq!(in_ortszeit("2026-10-25 00:33Z"), "2026-10-25 02:33+02:00");
}

#[test]
fn verschieben_ueber_die_umstellung_nimmt_den_neuen_versatz() {
    in_berlin();
    assert_eq!(verschieben("2026-10-25 03:10+01:00", -60), Some("2026-10-25 02:10+01:00".into()));
    assert_eq!(verschieben("2026-10-25 03:10+01:00", -120), Some("2026-10-25 02:10+02:00".into()));
    assert_eq!(minuten("2026-10-25 02:10+02:00", "2026-10-25 03:10+01:00"), Some(120));
}
