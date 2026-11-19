//! Flüchtiger Cache der Zweiglisten (ADR-0032 N1.3, N3.2): nur im Speicher des Prozesses, Schlüssel (Wurzel, SHA-256
//! des Fingerabdrucks, Hash) → Zweige. Erreichbarkeit hängt nur von den Zweigspitzen ab; bewegt sich ein Zweig, ändert
//! sich der Fingerabdruck und damit der Schlüssel. Nie auf Platte, nie im Board-Ordner.

use crate::modell::Zweige;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Höchstens so viele Einträge; bei Überlauf wird geleert.
pub const CACHE_HOECHSTENS: usize = 10_000;

/// SHA-256 eines Fingerabdrucks — der Schlüssel bleibt klein, gleich wie viele Zweige das Repository hat.
pub type Abdruck = [u8; 32];

#[derive(Debug, Default)]
pub struct Zweigcache {
    eintraege: HashMap<(PathBuf, Abdruck, String), Zweige>,
}

impl Zweigcache {
    pub fn holen(&self, wurzel: &Path, abdruck: &Abdruck, hash: &str) -> Option<Zweige> {
        self.eintraege.get(&(wurzel.to_path_buf(), *abdruck, hash.to_string())).cloned()
    }

    /// Legt die Ergebnisse unter dem Fingerabdruck vom Beginn ab — nur, wenn die zweite Probe am Ende denselben
    /// Fingerabdruck zeigt (ADR-0032 N3.2). Je Aufruf höchstens [`CACHE_HOECHSTENS`], der Rest wird verworfen; passt es
    /// nicht mehr dazu, wird vorher geleert.
    pub fn ablegen(&mut self, wurzel: &Path, beginn: &str, ende: &str, ergebnisse: Vec<(String, Zweige)>) -> usize {
        if beginn != ende {
            return 0;
        }
        let abdruck = abdruck(beginn);
        let neu: Vec<(String, Zweige)> = ergebnisse.into_iter().take(CACHE_HOECHSTENS).collect();
        if self.eintraege.len() + neu.len() > CACHE_HOECHSTENS {
            self.eintraege.clear();
        }
        let n = neu.len();
        self.eintraege.extend(neu.into_iter().map(|(hash, z)| ((wurzel.to_path_buf(), abdruck, hash), z)));
        n
    }

    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.eintraege.len()
    }

    #[cfg(test)]
    pub fn is_empty(&self) -> bool {
        self.eintraege.is_empty()
    }
}

/// Der Schlüsselteil zu einem Fingerabdruck.
pub fn abdruck(fingerabdruck: &str) -> Abdruck {
    sha256(fingerabdruck.as_bytes())
}

/// SHA-256 nach FIPS 180-4 — klein genug, um ohne neue Abhängigkeit auszukommen; geprüft an den Testvektoren der Norm.
fn sha256(daten: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    let mut h: [u32; 8] = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    let mut nachricht = daten.to_vec();
    nachricht.push(0x80);
    while nachricht.len() % 64 != 56 {
        nachricht.push(0);
    }
    nachricht.extend_from_slice(&((daten.len() as u64) * 8).to_be_bytes());
    for block in nachricht.chunks(64) {
        let mut w = [0u32; 64];
        for (i, wort) in block.chunks(4).enumerate() {
            w[i] = u32::from_be_bytes([wort[0], wort[1], wort[2], wort[3]]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ (!e & g);
            let t1 = hh.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(t1);
            d = c;
            c = b;
            b = a;
            a = t1.wrapping_add(t2);
        }
        for (x, y) in h.iter_mut().zip([a, b, c, d, e, f, g, hh]) {
            *x = x.wrapping_add(y);
        }
    }
    let mut aus = [0u8; 32];
    for (i, x) in h.iter().enumerate() {
        aus[4 * i..4 * i + 4].copy_from_slice(&x.to_be_bytes());
    }
    aus
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(b: &[u8]) -> String {
        b.iter().map(|x| format!("{x:02x}")).collect()
    }

    // FIPS 180-4 / NIST-Beispiele: leer, „abc“, zwei Blöcke, eine Million „a“
    #[test]
    fn sha256_testvektoren() {
        assert_eq!(hex(&sha256(b"")), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        assert_eq!(hex(&sha256(b"abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assert_eq!(hex(&sha256(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")), "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
        assert_eq!(hex(&sha256(&vec![b'a'; 1_000_000])), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
    }

    fn z(n: &str) -> Zweige {
        Zweige { lokal: vec![n.into()], ..Zweige::default() }
    }

    // ADR-0032 N3.2: abgelegt wird nur bei gleichem Fingerabdruck am Ende; Schlüssel ist (Wurzel, Abdruck, Hash)
    #[test]
    fn ablegen_nur_bei_gleichem_fingerabdruck() {
        let mut c = Zweigcache::default();
        let r = Path::new("/r");
        assert_eq!(c.ablegen(r, "a refs/heads/main\n", "b refs/heads/main\n", vec![("h1".into(), z("main"))]), 0, "Zweig bewegt");
        assert!(c.is_empty());
        assert_eq!(c.ablegen(r, "a refs/heads/main\n", "a refs/heads/main\n", vec![("h1".into(), z("main"))]), 1);
        assert_eq!(c.holen(r, &abdruck("a refs/heads/main\n"), "h1"), Some(z("main")));
        assert_eq!(c.holen(r, &abdruck("b refs/heads/main\n"), "h1"), None, "anderer Fingerabdruck, anderer Schlüssel");
        assert_eq!(c.holen(Path::new("/s"), &abdruck("a refs/heads/main\n"), "h1"), None, "andere Wurzel");
        assert_eq!(c.holen(r, &abdruck("a refs/heads/main\n"), "h2"), None);
    }

    // ADR-0032 N1.3, N3.2: höchstens 10.000; was nicht mehr passt, leert vorher; je Aufruf höchstens 10.000
    #[test]
    fn ueberlauf_leert() {
        let mut c = Zweigcache::default();
        let r = Path::new("/r");
        let viele = |von: usize, n: usize| (von..von + n).map(|i| (format!("h{i}"), z("m"))).collect::<Vec<_>>();
        c.ablegen(r, "f", "f", viele(0, CACHE_HOECHSTENS - 1));
        c.ablegen(r, "f", "f", viele(CACHE_HOECHSTENS, 1));
        assert_eq!(c.len(), CACHE_HOECHSTENS, "genau voll");
        c.ablegen(r, "f", "f", viele(20_000, 1));
        assert_eq!(c.len(), 1, "Überlauf leert");
        assert_eq!(c.ablegen(r, "f", "f", viele(30_000, CACHE_HOECHSTENS + 5)), CACHE_HOECHSTENS);
        assert_eq!(c.len(), CACHE_HOECHSTENS, "nie mehr als die Obergrenze");
    }
}
