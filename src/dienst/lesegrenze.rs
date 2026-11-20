//! Obergrenze gleichzeitiger Lesevorgänge in Arbeits-Repositories (Nacharbeit #211, Security Muss 3): jeder Lesevorgang
//! startet seine Git-Prozesse nacheinander, also laufen nie mehr Git-Prozesse für das Lesen als Plätze belegt sind. Wer
//! keinen Platz bekommt, wartet — höchstens bis zur Frist seiner Anfrage (die Wartezeit zählt zur Gesamtgrenze).
//!
//! Kein Single-Flight je (Wurzel, Fingerabdruck): wer wartet, findet nach dem ersten Lauf die Zweigliste im Cache und
//! startet nur noch die vier schnellen Prozesse ohne `rev-list`; gespart würden höchstens drei gleichzeitige
//! Zweiglisten je Fingerabdruck, um den Preis eines zweiten Warteorts mit eigener Fehlerweitergabe.

use std::sync::{Condvar, Mutex};
use std::time::Instant;

/// Höchstens so viele Lesevorgänge (und damit Git-Prozesse für das Lesen) gleichzeitig.
pub const LESEN_HOECHSTENS: usize = 4;

#[derive(Debug, Default)]
pub struct Lesegrenze {
    belegt: Mutex<usize>,
    frei: Condvar,
}

/// Ein belegter Platz; er wird beim Fallenlassen frei.
#[derive(Debug)]
pub struct Platz<'a>(&'a Lesegrenze);

impl Lesegrenze {
    /// Wie viele Plätze belegt sind.
    #[cfg(test)]
    pub fn belegt(&self) -> usize {
        *self.belegt.lock().unwrap_or_else(|p| p.into_inner())
    }

    /// Ein Platz, sobald einer frei ist — `None`, wenn bis `frist` keiner frei wurde.
    pub fn betreten(&self, frist: Instant) -> Option<Platz<'_>> {
        let mut belegt = self.belegt.lock().unwrap_or_else(|p| p.into_inner());
        while *belegt >= LESEN_HOECHSTENS {
            let rest = frist.checked_duration_since(Instant::now()).filter(|r| !r.is_zero())?;
            belegt = self.frei.wait_timeout(belegt, rest).unwrap_or_else(|p| p.into_inner()).0;
        }
        *belegt += 1;
        Some(Platz(self))
    }
}

impl Drop for Platz<'_> {
    fn drop(&mut self) {
        *self.0.belegt.lock().unwrap_or_else(|p| p.into_inner()) -= 1;
        self.0.frei.notify_one();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    // vier Plätze; der fünfte wartet bis zur Frist und bekommt keinen — wird einer frei, bekommt ihn der Wartende
    #[test]
    fn hoechstens_vier_plaetze() {
        let g = Lesegrenze::default();
        let fern = Instant::now() + Duration::from_secs(5);
        let mut plaetze: Vec<Platz> = (0..LESEN_HOECHSTENS).map(|_| g.betreten(fern).unwrap()).collect();
        let start = Instant::now();
        assert!(g.betreten(Instant::now() + Duration::from_millis(200)).is_none());
        assert!(start.elapsed() >= Duration::from_millis(200), "wartete bis zur Frist: {:?}", start.elapsed());
        assert!(g.betreten(Instant::now()).is_none(), "abgelaufene Frist, kein freier Platz");
        std::thread::scope(|s| {
            let wartend = s.spawn(|| g.betreten(Instant::now() + Duration::from_secs(5)).is_some());
            std::thread::sleep(Duration::from_millis(100));
            plaetze.pop();
            assert!(wartend.join().unwrap(), "der frei gewordene Platz geht an den Wartenden");
        });
        drop(plaetze);
        assert_eq!(*g.belegt.lock().unwrap(), 0);
    }
}
