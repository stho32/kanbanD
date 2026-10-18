use kanband::start::Startauftrag;
use std::process::ExitCode;

fn main() -> ExitCode {
    match Startauftrag::aus_argumenten(std::env::args().skip(1)) {
        Ok(_auftrag) => ExitCode::SUCCESS,
        Err(fehler) => {
            let hilfe = matches!(fehler, kanband::start::Aufruffehler::HilfeGewuenscht);
            eprintln!("{fehler}");
            if hilfe { ExitCode::SUCCESS } else { ExitCode::from(2) }
        }
    }
}
