use std::process::{Command, Stdio};

/// Öffnet die Adresse im Standardbrowser; ein Fehlschlag wird nur gemeldet.
/// `KANBAND_BROWSER` ersetzt den Standardbrowser durch ein eigenes Programm.
pub fn oeffnen(adresse: &str) {
    let eigenes = std::env::var("KANBAND_BROWSER").ok();
    let (programm, args): (&str, Vec<&str>) = if let Some(p) = eigenes.as_deref() {
        (p, vec![adresse])
    } else if cfg!(target_os = "macos") {
        ("open", vec![adresse])
    } else if cfg!(windows) {
        ("cmd", vec!["/C", "start", "", adresse])
    } else {
        ("xdg-open", vec![adresse])
    };
    if let Err(e) = Command::new(programm).args(args).stdout(Stdio::null()).stderr(Stdio::null()).spawn() {
        eprintln!("Browser ließ sich nicht öffnen ({e}) — bitte {adresse} selbst aufrufen.");
    }
}
