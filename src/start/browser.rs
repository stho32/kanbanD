use std::process::{Command, Stdio};

/// Öffnet die Adresse im Standardbrowser; ein Fehlschlag wird nur gemeldet.
pub fn oeffnen(adresse: &str) {
    let (programm, args): (&str, Vec<&str>) = if cfg!(target_os = "macos") {
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
