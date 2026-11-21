//! Antwortbudget der Diff-Antworten (R00206, ADR-0032 N5.1, Security M-S1): alle Antworten 200 von `GET …/diff` halten
//! zusammen höchstens [`ANTWORTBUDGET`] Byte, bis der Client sie gelesen hat oder die Schreibfrist sie freigibt. Gezählt
//! wird in KB, aufgerundet. Belegt wird ohne Warten (wer wartete, hielte seinen fertigen Rumpf ungezählt im Speicher);
//! passt eine Antwort nicht mehr hinein, gibt es keinen [`Rumpf`] — der Dienst antwortet sofort 503.

use std::sync::{Arc, Mutex};

/// Byte, die alle Antworten 200 von `GET …/diff` zusammen halten dürfen (64 MB).
pub const ANTWORTBUDGET: usize = 67_108_864;

/// Das Budget; ein Klon teilt dasselbe Konto.
#[derive(Debug, Clone)]
pub struct Antwortbudget {
    frei_kb: Arc<Mutex<usize>>,
}

/// Ein fertiger Rumpf mit seinem Platz im Budget; fällt er, ist der Platz wieder frei.
#[derive(Debug)]
pub struct Rumpf {
    pub bytes: Vec<u8>,
    _beleg: Beleg,
}

/// Der Platz eines Rumpfs im Budget; fällt er, ist der Platz frei.
#[derive(Debug)]
pub struct Beleg {
    frei_kb: Arc<Mutex<usize>>,
    kb: usize,
}

impl Antwortbudget {
    /// Ein Budget von `bytes` Byte — im Betrieb [`ANTWORTBUDGET`], in Tests kleiner (interner Parameter, keine
    /// Konfiguration).
    pub fn mit(bytes: usize) -> Antwortbudget {
        Antwortbudget { frei_kb: Arc::new(Mutex::new(bytes / 1024)) }
    }

    /// Belegt den Platz für `bytes` — `None`, wenn er nicht mehr ins Budget passt (nie warten).
    pub fn belegen(&self, bytes: Vec<u8>) -> Option<Rumpf> {
        let beleg = self.platz(bytes.len())?;
        Some(Rumpf { bytes, _beleg: beleg })
    }

    /// Belegt den Platz für eine Antwort von `bytes` Byte, **bevor** sie gelesen wird (R00216, ADR-0036 Regel 6) — `None`,
    /// wenn er nicht mehr ins Budget passt (nie warten). Der Leser liest danach höchstens so viel und macht mit
    /// [`Beleg::rumpf`] den Rumpf daraus.
    pub fn platz(&self, bytes: usize) -> Option<Beleg> {
        let kb = bytes.div_ceil(1024);
        let mut frei = self.frei_kb.lock().unwrap_or_else(|p| p.into_inner());
        *frei = frei.checked_sub(kb)?;
        Some(Beleg { frei_kb: self.frei_kb.clone(), kb })
    }

    /// Wie viele Byte frei sind (in ganzen KB).
    pub fn frei(&self) -> usize {
        *self.frei_kb.lock().unwrap_or_else(|p| p.into_inner()) * 1024
    }
}

impl Rumpf {
    /// Die Bytes und ihr Platz im Budget, getrennt — wer den Platz hält, hält das Budget.
    pub fn teilen(self) -> (Vec<u8>, Beleg) {
        (self.bytes, self._beleg)
    }
}

impl Beleg {
    /// Der gelesene Rumpf auf seinem vorab belegten Platz; höchstens so groß wie belegt.
    pub fn rumpf(self, bytes: Vec<u8>) -> Rumpf {
        debug_assert!(bytes.len().div_ceil(1024) <= self.kb, "mehr gelesen als belegt");
        Rumpf { bytes, _beleg: self }
    }
}

impl Default for Antwortbudget {
    fn default() -> Antwortbudget {
        Antwortbudget::mit(ANTWORTBUDGET)
    }
}

impl Drop for Beleg {
    fn drop(&mut self) {
        *self.frei_kb.lock().unwrap_or_else(|p| p.into_inner()) += self.kb;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ADR-0032 N5.1 Regel 1 und 3: in KB aufgerundet, ohne Warten; ein fallender Rumpf gibt seinen Platz zurück
    #[test]
    fn belegen_in_kb_ohne_warten() {
        let b = Antwortbudget::mit(4096);
        let erster = b.belegen(vec![0; 2049]).unwrap();
        assert_eq!(b.frei(), 1024, "2049 Byte belegen 3 KB");
        assert!(b.belegen(vec![0; 1025]).is_none(), "passt nicht: sofort keiner");
        let zweiter = b.belegen(vec![0; 1024]).unwrap();
        assert_eq!(b.frei(), 0);
        drop(erster);
        assert_eq!(b.frei(), 3072);
        drop(zweiter);
        assert_eq!(b.frei(), 4096);
        assert_eq!(Antwortbudget::default().frei(), 64 << 20);
    }

    // R00216 ADR-0036 Regel 6: Platz nach Größe vor dem Lesen; ein fallender Beleg oder Rumpf gibt ihn zurück
    #[test]
    fn platz_vor_dem_lesen() {
        let b = Antwortbudget::mit(4096);
        let platz = b.platz(3000).unwrap();
        assert_eq!(b.frei(), 1024);
        assert!(b.platz(1025).is_none());
        let rumpf = platz.rumpf(vec![1; 3000]);
        assert_eq!(b.frei(), 1024, "der Rumpf hält den Platz");
        drop(rumpf);
        assert_eq!(b.frei(), 4096);
        drop(b.platz(4096).unwrap());
        assert_eq!(b.frei(), 4096);
    }
}
