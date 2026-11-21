//! `Braucht` zwischen Karten (R00214, ADR-0035): das Label `braucht:<n>` ist der eine Träger einer Abhängigkeit —
//! „diese Aufgabe wartet auf #n“. Hier steht seine Deutung als reine Funktionen, ohne Dateien und ohne HTTP.

use super::{Aufgabe, Board};
use serde::Serialize;
use std::collections::{BTreeMap, HashMap, HashSet};

/// Meldung, wenn `braucht` im Rumpf eines Schreibaufrufs steht — geschrieben wird nur über `labels` (ADR-0035 Punkt 4).
pub const BRAUCHT_UEBER_LABELS: &str = "braucht über labels setzen (braucht:<nr>)";

/// Ein Eintrag des abgeleiteten, nur lesbaren Felds `braucht` (R00214): worauf die Aufgabe wartet und ob das erledigt ist.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Abhaengigkeit {
    /// Nummer der gebrauchten Aufgabe, aus dem Label `braucht:<nummer>`
    pub nummer: u32,
    /// Titel der gebrauchten Aufgabe; null, wenn es zur Nummer keine lesbare Aufgabendatei gibt
    pub titel: Option<String>,
    /// archiviert oder auf einem ihrer Boards in dessen letzter Spalte; ohne lesbare Datei false
    pub erledigt: bool,
}

/// Was ein Label über eine Abhängigkeit sagt.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Deutung {
    /// kein Präfix `braucht:` — ein gewöhnliches Label
    Keine,
    /// `braucht:<n>`, ohne Groß/Klein, `n` eine Kartennummer ≥ 1 ohne führende Null
    Nummer(u32),
    /// Präfix `braucht:`, aber andere Form — beim Lesen stumm, an der Tür abgewiesen
    Falsch,
}

/// Deutet ein Label (außen getrimmt wie beim Schreiben der Labels).
pub fn deuten(label: &str) -> Deutung {
    let label = label.trim();
    let Some(rest) = label.get(..PRAEFIX.len()).filter(|p| p.eq_ignore_ascii_case(PRAEFIX)).map(|_| &label[PRAEFIX.len()..]) else {
        return Deutung::Keine;
    };
    let ziffern = !rest.is_empty() && rest.bytes().all(|b| b.is_ascii_digit()) && !rest.starts_with('0');
    match rest.parse::<u32>() {
        Ok(n) if ziffern => Deutung::Nummer(n),
        _ => Deutung::Falsch,
    }
}

const PRAEFIX: &str = "braucht:";

/// Die gedeuteten Nummern in der Reihenfolge der Labels; dieselbe Nummer einmal (beim ersten Vorkommen).
/// Linear in der Zahl der Labels (AK 16): die Menge prüft, die Liste hält die Reihenfolge.
pub fn braucht_nummern(labels: &[String]) -> Vec<u32> {
    let mut gesehen: HashSet<u32> = HashSet::new();
    labels.iter().filter_map(|l| if let Deutung::Nummer(n) = deuten(l) { Some(n) } else { None }).filter(|n| gesehen.insert(*n)).collect()
}

/// Die Nummern, die auf einem der Boards in dessen letzter Spalte liegen — einmal gerechnet, je Aufgabe nachgeschlagen.
pub fn in_letzter_spalte<'a>(boards: impl IntoIterator<Item = &'a Board>) -> HashSet<u32> {
    boards.into_iter().filter_map(Board::abschlussspalte).flat_map(|s| s.aufgaben.iter().copied()).collect()
}

/// Erledigt ist eine Aufgabe, wenn sie archiviert ist oder auf einem der Boards in dessen letzter Spalte liegt
/// (ADR-0035 Punkt 3, `abgeschlossen` aus `in_letzter_spalte`) — dieselbe Entscheidung trifft
/// `POST /api/aufgaben/erledigen` für sein Board.
pub fn ist_erledigt(a: &Aufgabe, abgeschlossen: &HashSet<u32>) -> bool {
    a.archiviert.is_some() || abgeschlossen.contains(&a.nummer)
}

/// Das Feld `braucht` zu den Labels einer Aufgabe: `finde` liefert die gebrauchte Aufgabe, wenn ihre Datei lesbar ist;
/// `abgeschlossen` aus `in_letzter_spalte`.
pub fn abhaengigkeiten<'a>(labels: &[String], finde: impl Fn(u32) -> Option<&'a Aufgabe>, abgeschlossen: &HashSet<u32>) -> Vec<Abhaengigkeit> {
    let eintrag = |nummer: u32| match finde(nummer) {
        Some(a) => Abhaengigkeit { nummer, erledigt: ist_erledigt(a, abgeschlossen), titel: Some(a.titel.clone()) },
        None => Abhaengigkeit { nummer, titel: None, erledigt: false },
    };
    braucht_nummern(labels).into_iter().map(eintrag).collect()
}

// ---- Prüfung an der Tür (ADR-0035 Punkt 2) ----------------------------------------------------------------------------
// Die Meldungen stehen hier an einer Stelle; Wortlaut nach Entscheidung des PO (po-entscheidungen Z. 452).
// Sie nennen nur Nummern und festen Text, nie den Rest eines abgewiesenen Labels (R00214, Sicherheit).

/// Ein Label mit dem Präfix `braucht:` in anderer Form.
pub const FORM_MELDUNG: &str = "braucht: erwartet eine Kartennummer (braucht:12)";

pub fn selbstbezug_meldung(nummer: u32) -> String {
    format!("#{nummer} kann nicht auf sich selbst warten")
}

pub fn unbekannt_meldung(nummer: u32) -> String {
    format!("Aufgabe #{nummer} gibt es nicht (braucht:{nummer})")
}

/// Die neu hinzukommenden Labels mit dem Präfix `braucht:` — „neu“ heißt: in der gespeicherten Liste steht es nicht,
/// verglichen ohne Groß/Klein. Unverändert mitgeschickte Labels prüft die Tür nie (wie `klasse`, R00195).
/// Linear in der Zahl der Labels (AK 16).
pub fn neue_braucht_labels<'a>(vorher: &[String], nachher: &'a [String]) -> Vec<&'a str> {
    let gespeichert: HashSet<String> = vorher.iter().map(|l| l.trim().to_lowercase()).collect();
    nachher.iter().map(|l| l.as_str()).filter(|l| deuten(l) != Deutung::Keine && !gespeichert.contains(&l.trim().to_lowercase())).collect()
}

/// Prüft die neuen `braucht:`-Labels der Aufgabe `nummer` der Reihe nach — Form, Selbstbezug, unbekannte Nummer; der
/// erste Fehler gewinnt. `gibt_es` sagt, ob es zur Nummer eine Aufgabendatei im Ordner gibt (archivierte zählen).
/// Liefert die neuen Kanten `nummer → n` als Ziele in Label-Reihenfolge, jedes einmal.
pub fn an_der_tuer(nummer: u32, neue: &[&str], gibt_es: impl Fn(u32) -> bool) -> Result<Vec<u32>, String> {
    let mut ziele = vec![];
    let mut gesehen: HashSet<u32> = HashSet::new();
    for label in neue {
        let n = match deuten(label) {
            Deutung::Nummer(n) => n,
            Deutung::Falsch | Deutung::Keine => return Err(FORM_MELDUNG.into()),
        };
        if n == nummer {
            return Err(selbstbezug_meldung(n));
        }
        if !gibt_es(n) {
            return Err(unbekannt_meldung(n));
        }
        if gesehen.insert(n) {
            ziele.push(n);
        }
    }
    Ok(ziele)
}

pub fn kreis_meldung(ziel: u32, kreis: &[u32]) -> String {
    let pfeile: Vec<String> = kreis.iter().map(|n| format!("#{n}")).collect();
    format!("braucht:{ziel} ergäbe einen Kreis: {}", pfeile.join(" → "))
}

/// Der erste Kreis, den eine neue Kante schließt. `kanten` ist der Stand nach dem Schreiben (je Aufgabe die gedeuteten
/// Nummern, in Label-Reihenfolge) und enthält die neuen Kanten `a → b` aus `neue` (in Prüfreihenfolge). Eine neue Kante
/// schließt einen Kreis genau dann, wenn `a` und `b` in derselben starken Zusammenhangskomponente liegen — die rechnet
/// eine Suche über den ganzen Stand, nicht eine je Kante (linear, AK 16). Für die erste solche Kante dann der kürzeste
/// Weg von `b` zurück zu `a`. Kreise im Bestand ohne neue Kante stören nicht. Liefert `(a, b, [a, b, …, a])`.
pub fn kreis_suchen(kanten: &BTreeMap<u32, Vec<u32>>, neue: &[(u32, u32)]) -> Option<(u32, u32, Vec<u32>)> {
    if neue.is_empty() {
        return None;
    }
    let komponente = Komponenten::rechnen(kanten);
    let gemeinsam = |&&(a, b): &&(u32, u32)| komponente.get(&a).is_some_and(|k| komponente.get(&b) == Some(k));
    neue.iter().filter(gemeinsam).find_map(|&(a, b)| weg(kanten, b, a).map(|w| (a, b, std::iter::once(a).chain(w).collect())))
}

/// Starke Zusammenhangskomponenten nach Tarjan, ohne Rekursion (eine lange Kette darf den Stapel nicht sprengen).
struct Komponenten<'k> {
    kanten: &'k BTreeMap<u32, Vec<u32>>,
    /// Reihenfolge des Betretens je Knoten
    index: HashMap<u32, usize>,
    /// kleinster Index, den der Knoten über Baum- und Rückkanten erreicht
    tiefst: HashMap<u32, usize>,
    stapel: Vec<u32>,
    auf_stapel: HashSet<u32>,
    /// Ergebnis: je Knoten die Nummer seiner Komponente
    komponente: HashMap<u32, usize>,
}

impl<'k> Komponenten<'k> {
    fn rechnen(kanten: &'k BTreeMap<u32, Vec<u32>>) -> HashMap<u32, usize> {
        let mut t = Komponenten { kanten, index: HashMap::new(), tiefst: HashMap::new(), stapel: vec![], auf_stapel: HashSet::new(), komponente: HashMap::new() };
        for &start in kanten.keys() {
            if !t.index.contains_key(&start) {
                t.von(start);
            }
        }
        t.komponente
    }

    /// Tiefensuche ab `start` mit eigenem Pfad aus (Knoten, nächster Nachfolger).
    fn von(&mut self, start: u32) {
        self.betreten(start);
        let mut pfad: Vec<(u32, usize)> = vec![(start, 0)];
        while let Some(&mut (knoten, ref mut naechster)) = pfad.last_mut() {
            let nachfolger = self.kanten.get(&knoten).and_then(|n| n.get(*naechster)).copied();
            if let Some(n) = nachfolger {
                *naechster += 1;
                if !self.index.contains_key(&n) {
                    self.betreten(n);
                    pfad.push((n, 0));
                } else if self.auf_stapel.contains(&n) {
                    self.senken(knoten, self.index[&n]);
                }
                continue;
            }
            pfad.pop();
            if let Some(&(eltern, _)) = pfad.last() {
                self.senken(eltern, self.tiefst[&knoten]);
            }
            if self.tiefst[&knoten] == self.index[&knoten] {
                self.abschliessen(knoten);
            }
        }
    }

    fn betreten(&mut self, knoten: u32) {
        let i = self.index.len();
        self.index.insert(knoten, i);
        self.tiefst.insert(knoten, i);
        self.stapel.push(knoten);
        self.auf_stapel.insert(knoten);
    }

    fn senken(&mut self, knoten: u32, wert: usize) {
        let t = self.tiefst.get_mut(&knoten).expect("betreten");
        *t = (*t).min(wert);
    }

    /// `wurzel` ist Wurzel einer Komponente: alles auf dem Stapel bis zu ihr gehört dazu.
    fn abschliessen(&mut self, wurzel: u32) {
        let nummer = self.komponente.len(); // eindeutig: die Zahl der schon zugeordneten Knoten
        while let Some(k) = self.stapel.pop() {
            self.auf_stapel.remove(&k);
            self.komponente.insert(k, nummer);
            if k == wurzel {
                break;
            }
        }
    }
}

/// Kürzester Weg `von → … → nach` (Breitensuche in Label-Reihenfolge), beide Enden eingeschlossen.
fn weg(kanten: &BTreeMap<u32, Vec<u32>>, von: u32, nach: u32) -> Option<Vec<u32>> {
    let mut vorgaenger: BTreeMap<u32, u32> = BTreeMap::new();
    let mut warteschlange = std::collections::VecDeque::from([von]);
    while let Some(knoten) = warteschlange.pop_front() {
        if knoten == nach {
            let mut w = vec![nach];
            while let Some(&v) = vorgaenger.get(w.last().expect("nie leer")) {
                w.push(v);
            }
            w.reverse();
            return Some(w);
        }
        for &n in kanten.get(&knoten).into_iter().flatten() {
            if n != von && !vorgaenger.contains_key(&n) {
                vorgaenger.insert(n, knoten);
                warteschlange.push_back(n);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn graph(k: &[(u32, &[u32])]) -> BTreeMap<u32, Vec<u32>> {
        k.iter().map(|(a, b)| (*a, b.to_vec())).collect()
    }

    // R00214 B1088: Kreis aus 2 und 3 Knoten, aus zwei neuen Kanten im selben Aufruf, Bestandskreis ohne neue Kante
    #[test]
    fn kreis_je_lage() {
        assert_eq!(kreis_suchen(&graph(&[(1, &[2]), (2, &[1])]), &[(1, 2)]), Some((1, 2, vec![1, 2, 1])), "AK 10");
        assert_eq!(kreis_suchen(&graph(&[(1, &[3]), (3, &[2]), (2, &[1])]), &[(1, 3)]), Some((1, 3, vec![1, 3, 2, 1])), "AK 10, drei Knoten");
        assert_eq!(kreis_suchen(&graph(&[(1, &[5]), (5, &[1])]), &[(1, 5), (5, 1)]), Some((1, 5, vec![1, 5, 1])), "zwei neue Kanten, die erste nennt ihn");
        assert_eq!(kreis_suchen(&graph(&[(1, &[2]), (2, &[3]), (3, &[2])]), &[(1, 2)]), None, "Bestandskreis #2 ↔ #3 ohne neue Kante darin");
        assert_eq!(kreis_suchen(&graph(&[(1, &[2]), (2, &[3]), (3, &[4])]), &[(1, 2)]), None, "Kette ohne Rückweg");
        assert_eq!(kreis_suchen(&graph(&[(1, &[2]), (2, &[2, 9])]), &[(1, 2)]), None, "Selbstkante und unbekannte Nummer im Bestand");
        let zwei_wege = graph(&[(1, &[2]), (2, &[3, 1]), (3, &[1])]);
        assert_eq!(kreis_suchen(&zwei_wege, &[(1, 2)]), Some((1, 2, vec![1, 2, 1])), "der kürzeste Weg");
        assert_eq!(kreis_suchen(&graph(&[(1, &[2]), (2, &[3]), (3, &[4]), (4, &[2])]), &[(1, 2)]), None, "Kreis hinter der neuen Kante, nicht durch sie");
        assert_eq!(kreis_suchen(&graph(&[(1, &[2])]), &[]), None);
    }

    // R00214 B1095 (Sollte des security- und architektur-reviewers): eine Suche je Aufruf, nicht je neuer Kante — Kette
    // aus 20.000 Aufgaben, jede Kante neu; der Kreis schließt erst an der letzten Kante der Prüfreihenfolge
    #[test]
    fn kreis_suche_linear_in_den_neuen_kanten() {
        const N: u32 = 20_000;
        type Kanten = BTreeMap<u32, Vec<u32>>;
        let kette = |rueck: bool| -> (Kanten, Vec<(u32, u32)>) {
            let mut kanten: Kanten = (1..N).map(|i| (i, vec![i + 1])).collect();
            let mut neue: Vec<(u32, u32)> = (1..N).map(|i| (i, i + 1)).collect();
            if rueck {
                kanten.insert(N, vec![N - 1]);
                neue.push((N, N - 1));
            }
            (kanten, neue)
        };
        let ohne = binnen("Kette ohne Kreis", GRENZE, move || {
            let (k, n) = kette(false);
            kreis_suchen(&k, &n)
        });
        assert_eq!(ohne, None);
        let mit = binnen("Kreis an der letzten Kante", GRENZE, move || {
            let (k, n) = kette(true);
            kreis_suchen(&k, &n)
        });
        assert_eq!(mit, Some((N - 1, N, vec![N - 1, N, N - 1])), "die erste Kante der Prüfreihenfolge, die ihn schließt");
    }

    // B1095: dasselbe Ergebnis wie die Suche je neuer Kante (Referenz) — 2.000 Zufallsgraphen mit 2–12 Knoten
    #[test]
    fn kreis_suche_gleich_der_suche_je_kante() {
        let referenz = |k: &BTreeMap<u32, Vec<u32>>, neue: &[(u32, u32)]| neue.iter().find_map(|&(a, b)| weg(k, b, a).map(|w| (a, b, std::iter::once(a).chain(w).collect::<Vec<_>>())));
        let mut zufall: u64 = 0x2280_0214;
        let mut naechste = |grenze: u64| {
            zufall = zufall.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1_442_695_040_888_963_407);
            (zufall >> 33) % grenze
        };
        let mut mit_kreis = 0;
        for _ in 0..2_000 {
            let knoten = 2 + naechste(11) as u32;
            let mut kanten: BTreeMap<u32, Vec<u32>> = BTreeMap::new();
            let mut neue = vec![];
            for _ in 0..naechste(3 * knoten as u64) {
                let (a, b) = (1 + naechste(knoten as u64) as u32, 1 + naechste(knoten as u64 + 1) as u32);
                let liste = kanten.entry(a).or_default();
                if a != b && !liste.contains(&b) {
                    liste.push(b);
                    if naechste(2) == 0 {
                        neue.push((a, b));
                    }
                }
            }
            let erwartet = referenz(&kanten, &neue);
            mit_kreis += usize::from(erwartet.is_some());
            assert_eq!(kreis_suchen(&kanten, &neue), erwartet, "{kanten:?} neu {neue:?}");
        }
        assert!(mit_kreis > 200, "die Stichprobe enthält Kreise: {mit_kreis}");
    }

    #[test]
    fn kreis_meldung_in_pfeilform() {
        assert_eq!(kreis_meldung(2, &[1, 2, 1]), "braucht:2 ergäbe einen Kreis: #1 → #2 → #1");
        assert_eq!(kreis_meldung(3, &[1, 3, 2, 1]), "braucht:3 ergäbe einen Kreis: #1 → #3 → #2 → #1");
    }

    // R00214 B1087: neu ist, was nicht gespeichert ist (ohne Groß/Klein); nur Labels mit Präfix
    #[test]
    fn neu_ist_nur_was_nicht_gespeichert_ist() {
        let vorher = labels(&["braucht:abc", "braucht:888", "ui"]);
        assert_eq!(neue_braucht_labels(&vorher, &labels(&["braucht:abc", "braucht:888", "prio"])), Vec::<&str>::new(), "AK 11");
        assert_eq!(neue_braucht_labels(&vorher, &labels(&["braucht:abc", "braucht:888", "braucht:777"])), vec!["braucht:777"]);
        assert_eq!(neue_braucht_labels(&vorher, &labels(&["BRAUCHT:ABC", "Braucht:888"])), Vec::<&str>::new(), "ohne Groß/Klein");
        assert_eq!(neue_braucht_labels(&labels(&["BRAUCHT:ABC", "Braucht:999"]), &labels(&["braucht:abc", "braucht:999"])), Vec::<&str>::new(), "gespeichert groß, geschickt klein");
        assert_eq!(neue_braucht_labels(&[], &labels(&["braucht", "brauchtnix", "braucht:x", "braucht:1"])), vec!["braucht:x", "braucht:1"]);
        assert_eq!(neue_braucht_labels(&labels(&["braucht:1"]), &labels(&["braucht:01"])), vec!["braucht:01"], "andere Schreibweise der Zahl ist neu");
    }

    // R00214 AK 7–9: Reihenfolge der Labels, erster Fehler gewinnt; Meldungen ohne den Rest des Labels
    #[test]
    fn tuer_form_selbstbezug_unbekannt() {
        let gibt_es = |n: u32| [1, 2, 3, 4, 5].contains(&n);
        for falsch in ["braucht:x", "braucht:012", "braucht:0", "braucht: 1", "BRAUCHT:kd#12", "braucht:<script>"] {
            assert_eq!(an_der_tuer(5, &[falsch], gibt_es), Err(FORM_MELDUNG.to_string()), "{falsch}");
        }
        assert_eq!(an_der_tuer(5, &["braucht:5"], gibt_es), Err("#5 kann nicht auf sich selbst warten".into()));
        assert_eq!(an_der_tuer(5, &["braucht:999"], gibt_es), Err("Aufgabe #999 gibt es nicht (braucht:999)".into()));
        assert_eq!(an_der_tuer(5, &["braucht:4", "Braucht:1", "braucht:4"], gibt_es), Ok(vec![4, 1]));
        assert_eq!(an_der_tuer(5, &["braucht:999", "braucht:x"], gibt_es), Err(unbekannt_meldung(999)), "der erste Fehler in Label-Reihenfolge");
        assert_eq!(an_der_tuer(5, &["braucht:x", "braucht:5"], gibt_es), Err(FORM_MELDUNG.into()));
        assert_eq!(an_der_tuer(5, &["braucht:5", "braucht:999"], gibt_es), Err(selbstbezug_meldung(5)));
        assert_eq!(an_der_tuer(5, &[], gibt_es), Ok(vec![]));
    }

    // ---- AK 16 (B1095): linear in der Zahl der Labels — die Prüfung läuft unter der Schreibsperre ----------------------

    /// Führt `f` in eigenem Faden aus und bricht nach `grenze` ab — ein quadratischer Lauf hält den Test nicht minutenlang auf.
    fn binnen<T: Send + 'static>(was: &str, grenze: std::time::Duration, f: impl FnOnce() -> T + Send + 'static) -> T {
        let (senden, empfangen) = std::sync::mpsc::channel();
        std::thread::spawn(move || senden.send(f()));
        empfangen.recv_timeout(grenze).unwrap_or_else(|_| panic!("{was}: länger als {grenze:?}"))
    }

    const GRENZE: std::time::Duration = std::time::Duration::from_secs(1);

    fn viele(form: impl Fn(usize) -> String) -> Vec<String> {
        (0..100_000).map(form).collect()
    }

    #[test]
    fn ak16_neue_braucht_labels_100_000_unter_einer_sekunde() {
        let neu = binnen("q gespeichert, braucht:<n> geschickt", GRENZE, || neue_braucht_labels(&viele(|i| format!("q{i}")), &viele(|i| format!("braucht:{}", i + 10))).len());
        assert_eq!(neu, 100_000);
        let neu = binnen("dieselben gespeichert und geschickt", GRENZE, || {
            let l = viele(|i| format!("braucht:{}", i + 10));
            neue_braucht_labels(&l, &l).len()
        });
        assert_eq!(neu, 0);
        let neu = binnen("gespeichert groß, geschickt klein, umgekehrte Reihenfolge", GRENZE, || {
            let mut geschickt = viele(|i| format!("braucht:{}", i + 10));
            geschickt.reverse();
            neue_braucht_labels(&viele(|i| format!("BRAUCHT:{}", i + 10)), &geschickt).len()
        });
        assert_eq!(neu, 0);
    }

    #[test]
    fn ak16_braucht_nummern_100_000_unter_einer_sekunde() {
        let nummern = binnen("verschiedene Nummern", GRENZE, || braucht_nummern(&viele(|i| format!("braucht:{}", i + 1))));
        assert_eq!((nummern.len(), nummern.first(), nummern.last()), (100_000, Some(&1), Some(&100_000)), "Reihenfolge der Labels");
        let nummern = binnen("dieselbe Nummer", GRENZE, || braucht_nummern(&viele(|_| "braucht:7".into())));
        assert_eq!(nummern, vec![7]);
    }

    #[test]
    fn ak16_tuer_100_000_neue_unter_einer_sekunde() {
        let ziele = binnen("verschiedene Ziele", GRENZE, || {
            let l = viele(|i| format!("braucht:{}", i + 2));
            an_der_tuer(1, &l.iter().map(String::as_str).collect::<Vec<_>>(), |_| true)
        });
        assert_eq!(ziele.map(|z| (z.len(), z[0], z[99_999])), Ok((100_000, 2, 100_001)), "Reihenfolge der Labels");
    }

    /// Statisch (AK 16): außerhalb der Tests wird `.contains` nur auf Mengen gerufen — jeder Empfänger ist als
    /// `HashSet`/`BTreeSet` deklariert, nie eine Liste.
    #[test]
    fn ak16_contains_nur_auf_mengen() {
        let quelle = include_str!("braucht.rs");
        let code = &quelle[..quelle.find("#[cfg(test)]").expect("Testmodul")];
        let mengen = ["HashSet", "&HashSet", "BTreeSet", "&BTreeSet"];
        for (zeile, text) in code.lines().enumerate() {
            for (stelle, _) in text.match_indices(".contains(") {
                let vorn = &text[..stelle];
                let name = &vorn[vorn.rfind(|c: char| !(c.is_alphanumeric() || c == '_')).map_or(0, |i| i + 1)..];
                let als_menge = mengen.iter().any(|m| code.contains(&format!("{name}: {m}<")));
                assert!(!name.is_empty() && als_menge, "braucht.rs:{}: `{name}.contains` — keine Menge", zeile + 1);
            }
        }
    }

    fn labels(l: &[&str]) -> Vec<String> {
        l.iter().map(|x| x.to_string()).collect()
    }

    // R00214 B1084: Form ohne Groß/Klein, n ≥ 1 ohne führende Null; andere Form mit Präfix ist Falsch, ohne Präfix Keine
    #[test]
    fn deutung_je_form() {
        for (label, nummer) in [("braucht:1", 1), ("BRAUCHT:3", 3), ("Braucht:226", 226), ("bRaUcHt:42", 42), (" braucht:7 ", 7), ("braucht:4294967295", u32::MAX)] {
            assert_eq!(deuten(label), Deutung::Nummer(nummer), "{label:?}");
        }
        for label in ["braucht:", "braucht:abc", "braucht:kd#12", "braucht:012", "braucht:0", "braucht: 3", "braucht:3 4", "braucht:-1", "braucht:+1", "braucht:1.0", "braucht:I0004", "braucht:4294967296", "BRAUCHT:x", "braucht:١"] {
            assert_eq!(deuten(label), Deutung::Falsch, "{label:?}");
        }
        for label in ["braucht", "brauchtnix", "brauch:1", "feature", "", "nc:304", "xbraucht:1", "ä"] {
            assert_eq!(deuten(label), Deutung::Keine, "{label:?}");
        }
    }

    // R00214 AK 3: Reihenfolge der Labels, Dubletten einmal (auch in anderer Schreibweise), andere Form stumm
    #[test]
    fn nummern_in_label_reihenfolge_ohne_dubletten() {
        let l = labels(&["BRAUCHT:3", "braucht:1", "Braucht:1", "braucht:abc", "braucht:kd#12", "braucht:012", "braucht:0", "braucht:999"]);
        assert_eq!(braucht_nummern(&l), vec![3, 1, 999]);
        assert_eq!(braucht_nummern(&labels(&["feature", "braucht:226"])), vec![226], "Bestandsform");
        assert_eq!(braucht_nummern(&[]), Vec::<u32>::new());
    }

    fn board(slug: &str, spalten: &[(&str, &[u32])]) -> Board {
        let mut text = format!("# {slug}\n");
        for (name, nummern) in spalten {
            text.push_str(&format!("\n## {name}\n\n"));
            for n in *nummern {
                text.push_str(&format!("- #{n}\n"));
            }
        }
        crate::format::board::lesen(slug, &text).unwrap()
    }

    fn karte(nr: u32, archiviert: bool) -> Aufgabe {
        let mut a = Aufgabe::neu(nr, format!("{nr:04}-x.md"), "x".into());
        a.archiviert = archiviert.then(|| "2026-11-01".into());
        a
    }

    // R00214 B1084: archiviert × letzte Spalte × kein Board × zwei Boards (PO-Frage 1, Vorschlag: eines genügt)
    #[test]
    fn erledigt_je_lage() {
        let e = board("e", &[("Offen", &[1, 2]), ("In Arbeit", &[3]), ("Fertig", &[4])]);
        let f = board("f", &[("Eingang", &[4, 5]), ("Fertig", &[2])]);
        let leer = board("leer", &[]);
        assert!(!ist_erledigt(&karte(1, false), &in_letzter_spalte([&e])), "Offen");
        assert!(!ist_erledigt(&karte(3, false), &in_letzter_spalte([&e])), "In Arbeit");
        assert!(ist_erledigt(&karte(4, false), &in_letzter_spalte([&e])), "letzte Spalte");
        assert!(ist_erledigt(&karte(1, true), &in_letzter_spalte([&e])), "archiviert, auch auf dem Board in Offen");
        assert!(ist_erledigt(&karte(9, true), &in_letzter_spalte([&e])), "archiviert, auf keinem Board");
        assert!(!ist_erledigt(&karte(9, false), &in_letzter_spalte([&e, &f])), "auf keinem Board, nicht archiviert: offen");
        assert!(!ist_erledigt(&karte(9, false), &in_letzter_spalte([])), "ohne Boards offen");
        assert!(ist_erledigt(&karte(2, false), &in_letzter_spalte([&e, &f])), "auf e offen, auf f in der letzten Spalte");
        assert!(ist_erledigt(&karte(4, false), &in_letzter_spalte([&e, &f])), "auf e in der letzten Spalte, auf f offen");
        assert!(!ist_erledigt(&karte(5, false), &in_letzter_spalte([&e, &f])), "nur auf f, dort offen");
        assert!(!ist_erledigt(&karte(1, false), &in_letzter_spalte([&leer])), "Board ohne Spalten");
    }

    // R00214 AK 1–3: Titel und Erledigt der gebrauchten Aufgabe, fehlende oder unlesbare Datei titel null, erledigt false
    #[test]
    fn abhaengigkeiten_in_label_reihenfolge() {
        let e = board("e", &[("Offen", &[1]), ("Fertig", &[3])]);
        let mut geruest = karte(1, false);
        geruest.titel = "Gerüst".into();
        let mut alt = karte(4, true);
        alt.titel = "Alt".into();
        let alle = [geruest, karte(3, false), alt];
        let finde = |n: u32| alle.iter().find(|a| a.nummer == n);
        let eintrag = |nummer: u32, titel: Option<&str>, erledigt: bool| Abhaengigkeit { nummer, titel: titel.map(Into::into), erledigt };
        assert_eq!(abhaengigkeiten(&labels(&["feature", "braucht:1"]), finde, &in_letzter_spalte([&e])), vec![eintrag(1, Some("Gerüst"), false)]);
        assert_eq!(
            abhaengigkeiten(&labels(&["braucht:999", "BRAUCHT:3", "braucht:4", "braucht:abc", "braucht:3"]), finde, &in_letzter_spalte([&e])),
            vec![eintrag(999, None, false), eintrag(3, Some("x"), true), eintrag(4, Some("Alt"), true)]
        );
        assert_eq!(abhaengigkeiten(&labels(&["ui"]), finde, &in_letzter_spalte([&e])), vec![]);
        let json = serde_json::to_value(eintrag(999, None, false)).unwrap();
        assert_eq!(json, serde_json::json!({"nummer": 999, "titel": null, "erledigt": false}));
    }
}
