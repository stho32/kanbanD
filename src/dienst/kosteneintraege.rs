//! Kosteneinträge über die API anlegen, ändern und löschen (R00165 Teil B, ADR-0028 Punkte 2–5) — gebaut wie die
//! Zeiteinträge: geschrieben über `aufgabe_schreiben` (Sperre, ein Commit, ohne Änderung keiner), ohne Spaltenregel
//! und ohne neue Zugriffsgrenze. Die Inhaltsregeln prüft der Konstruktor des Modells; hier steht, was nur das
//! Schreiben prüft: Zeitpunkt nicht in der Zukunft, Spalte auf einem Board der Aufgabe, Kennung frei.

use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Board, Kosteneintrag, Person, Roheintrag};
use crate::nachricht::wert;
use crate::uhr::Zeitpunkt;
use chrono::{DateTime, Utc};

/// Schutzwert (ADR-0028 Punkt 2): mehr Einträge nimmt eine Aufgabe über die API nicht auf.
pub const HOECHSTZAHL_KOSTENEINTRAEGE: usize = 1000;

/// Steht in jeder Meldung zum Rumpf vorn, z. B. `kosteneintrag.amount: keine Zahl`.
const PFAD: &str = "kosteneintrag";

/// Rumpf von `POST` und `PATCH …/kosteneintraege` mit den Feldnamen der Datei. Nur die Beschreibung für OpenAPI:
/// gelesen wird der Rumpf roh über [`Roheintrag::aus_anfrage`], damit jeder Fehler 400 wird und nie 422.
#[derive(utoipa::ToSchema)]
#[allow(dead_code)] // die Felder trägt nur das Schema
pub struct Kosteneintragsangaben {
    /// Zeitpunkt JJJJ-MM-TT HH:MM, optional mit ±HH:MM oder Z, auch ISO mit T; ohne Versatz Ortszeit; nicht in der Zukunft
    at: Option<String>,
    /// Rolle, freier einzeiliger Text mit 1 bis 60 Zeichen ohne @
    role: Option<String>,
    /// Name einer Spalte eines Boards, auf dem die Aufgabe liegt
    column: Option<String>,
    /// Betrag ≥ 0 mit höchstens zwei Nachkommastellen
    #[schema(minimum = 0, maximum = 1_000_000, multiple_of = 0.01)]
    amount: Option<f64>,
    /// ISO-Code, genau drei Großbuchstaben; ohne gilt beim Anlegen cost.currency der Aufgabe
    #[schema(pattern = "^[A-Z]{3}$")]
    currency: Option<String>,
    /// verbrauchte Tokens, ganze Zahl ≥ 0; beim Ändern entfernt null den Wert
    tokens: Option<u64>,
}

impl Kanban {
    pub fn kosteneintrag_anlegen(&self, wer: &Person, nr: u32, rumpf: &serde_json::Value) -> Result<Aufgabe, Fehler> {
        let roh = Roheintrag::aus_anfrage(PFAD, rumpf).map_err(Fehler::Ungueltig)?;
        self.aufgabe_schreiben(wer, nr, |a| anlegen(a, roh, Utc::now(), || Ok(self.ordner().boards()?.0)).map(Some))
    }

    /// Die Form des Rumpfs wird vor der Kennung geprüft: ein Typfehler ist 400, auch wenn es den Eintrag nicht gibt.
    pub fn kosteneintrag_aendern(&self, wer: &Person, nr: u32, kennung: &str, rumpf: &serde_json::Value) -> Result<Aufgabe, Fehler> {
        let roh = Roheintrag::aus_anfrage(PFAD, rumpf).map_err(Fehler::Ungueltig)?;
        let tokens_entfernen = rumpf.get("tokens").is_some_and(serde_json::Value::is_null);
        self.aufgabe_schreiben(wer, nr, |a| aendern(a, kennung, roh, tokens_entfernen, Utc::now(), || Ok(self.ordner().boards()?.0)))
    }

    pub fn kosteneintrag_loeschen(&self, wer: &Person, nr: u32, kennung: &str) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| loeschen(a, kennung).map(Some))
    }
}

/// Hängt den Eintrag an und liefert die Commit-Nachricht. Ohne `currency` gilt `cost.currency` der Aufgabe.
fn anlegen(a: &mut Aufgabe, mut roh: Roheintrag, jetzt: DateTime<Utc>, boards: impl FnOnce() -> Result<Vec<Board>, Fehler>) -> Result<String, Fehler> {
    let nr = a.nummer;
    if a.kosteneintraege.len() >= HOECHSTZAHL_KOSTENEINTRAEGE {
        return Err(Fehler::Konflikt(format!("#{nr} trägt schon {HOECHSTZAHL_KOSTENEINTRAEGE} Kosteneinträge — mehr nimmt eine Aufgabe nicht auf")));
    }
    roh.zeitpunkt = zeitpunkt_der_anfrage(roh.zeitpunkt, jetzt)?;
    if roh.waehrung.is_none() {
        let etikett = a.kosten.as_ref().ok_or_else(|| Fehler::Ungueltig(format!("{PFAD}: currency fehlt, und #{nr} trägt kein cost.currency")))?;
        roh.waehrung = Some(etikett.waehrung.clone());
    }
    let neu = Kosteneintrag::pruefen(PFAD, roh).map_err(Fehler::Ungueltig)?;
    spalte_pruefen(&neu.spalte, nr, &boards()?)?;
    kennung_frei(a.kosteneintraege.iter(), &neu, nr)?;
    let nachricht = format!("#{nr} Kosteneintrag angelegt: {}", kurz(&neu));
    a.kosteneintraege.push(neu);
    Ok(nachricht)
}

/// Ersetzt die genannten Felder des Eintrags zur Kennung; was der Rumpf nicht nennt, bleibt — auch Schlüssel der
/// Datei, die kanbanD nicht kennt. Ohne Änderung `None`, also kein Commit.
fn aendern(a: &mut Aufgabe, kennung: &str, roh: Roheintrag, tokens_entfernen: bool, jetzt: DateTime<Utc>, boards: impl FnOnce() -> Result<Vec<Board>, Fehler>) -> Result<Option<String>, Fehler> {
    let nr = a.nummer;
    let i = stelle(a, kennung)?;
    let alt = a.kosteneintraege[i].clone();
    let neu = Kosteneintrag::pruefen(
        PFAD,
        Roheintrag {
            zeitpunkt: zeitpunkt_der_anfrage(roh.zeitpunkt, jetzt)?.or(Some(alt.zeitpunkt.clone())),
            rolle: roh.rolle.or(Some(alt.rolle.clone())),
            spalte: roh.spalte.or(Some(alt.spalte.clone())),
            cent: roh.cent.or(Some(alt.cent)),
            waehrung: roh.waehrung.or(Some(alt.waehrung.clone())),
            tokens: if tokens_entfernen { None } else { roh.tokens.or(alt.tokens) },
            weitere: alt.weitere.clone(),
        },
    )
    .map_err(Fehler::Ungueltig)?;
    // die Spalte eines bestehenden Eintrags ist eine Tatsache (AK 8) — geprüft wird nur eine neue
    if neu.spalte != alt.spalte {
        spalte_pruefen(&neu.spalte, nr, &boards()?)?;
    }
    if neu.kennung() != alt.kennung() {
        kennung_frei(a.kosteneintraege.iter().enumerate().filter(|(j, _)| *j != i).map(|(_, e)| e), &neu, nr)?;
    }
    if neu == alt {
        return Ok(None);
    }
    let nachricht = format!("#{nr} Kosteneintrag geändert: {}", kurz(&neu));
    a.kosteneintraege[i] = neu;
    Ok(Some(nachricht))
}

/// Entfernt genau den einen Eintrag zur Kennung.
fn loeschen(a: &mut Aufgabe, kennung: &str) -> Result<String, Fehler> {
    let i = stelle(a, kennung)?;
    let weg = a.kosteneintraege.remove(i);
    Ok(format!("#{} Kosteneintrag gelöscht: {}", a.nummer, kurz(&weg)))
}

/// Wo der Eintrag zur Kennung steht. Verglichen wird die ganze Kennung, zeichengleich wie `GET` sie liefert — kein
/// Muster, kein Teilvergleich: eine unbekannte oder verstümmelte Kennung trifft keinen Eintrag.
fn stelle(a: &Aufgabe, kennung: &str) -> Result<usize, Fehler> {
    a.kosteneintraege.iter().position(|e| e.kennung() == kennung).ok_or_else(|| Fehler::NichtGefunden(format!("#{} hat keinen Kosteneintrag {}", a.nummer, wert(kennung))))
}

/// `at` einer Anfrage: nicht in der Zukunft, gespeichert in Ortszeit mit Versatz (R00084). Ein unlesbarer Wert
/// bleibt stehen — der Konstruktor weist ihn mit dem Feldnamen ab.
fn zeitpunkt_der_anfrage(at: Option<String>, jetzt: DateTime<Utc>) -> Result<Option<String>, Fehler> {
    let Some(z) = at.as_deref().and_then(Zeitpunkt::lesen) else {
        return Ok(at);
    };
    if z.utc() > jetzt {
        return Err(Fehler::Ungueltig(format!("{PFAD}.at: Der Zeitpunkt liegt in der Zukunft")));
    }
    Ok(Some(z.in_ortszeit().datei()))
}

/// ADR-0028 Punkt 3: der Name ist eine Spalte eines Boards, auf dem die Aufgabe liegt — liegt sie auf keinem, eines
/// Boards des Ordners.
fn spalte_pruefen(spalte: &str, nr: u32, boards: &[Board]) -> Result<(), Fehler> {
    let liegt_irgendwo = boards.iter().any(|b| b.spalte_von(nr).is_some());
    let gemeint = |b: &&Board| !liegt_irgendwo || b.spalte_von(nr).is_some();
    if boards.iter().filter(gemeint).any(|b| b.spalten.iter().any(|s| s.name == spalte)) {
        return Ok(());
    }
    Err(Fehler::Ungueltig(format!("{PFAD}.column: „{}“ ist keine Spalte eines Boards, auf dem #{nr} liegt", wert(spalte))))
}

/// ADR-0028 Punkt 4: gleiche Kennung an derselben Aufgabe → 409. Zwei Läufe derselben Rolle in derselben Minute
/// kollidieren; die Meldung sagt dem Aufrufer, was er tut.
fn kennung_frei<'a>(mut uebrige: impl Iterator<Item = &'a Kosteneintrag>, neu: &Kosteneintrag, nr: u32) -> Result<(), Fehler> {
    let kennung = neu.kennung();
    if uebrige.any(|e| e.kennung() == kennung) {
        return Err(Fehler::Konflikt(format!("#{nr} hat schon einen Kosteneintrag {kennung} — einen zweiten Lauf derselben Rolle in derselben Minute eine Minute später eintragen")));
    }
    Ok(())
}

/// Der Eintrag für die Commit-Nachricht: `3,46 USD (entwickler, Entwicklung)` — Rolle und Spalte als eine Zeile.
fn kurz(e: &Kosteneintrag) -> String {
    format!("{},{:02} {} ({}, {})", e.cent / 100, e.cent % 100, e.waehrung, wert(&e.rolle), wert(&e.spalte))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modell::Kosten;
    use serde_json::json;

    fn jetzt() -> DateTime<Utc> {
        "2026-11-14T00:00:00Z".parse().unwrap()
    }

    /// #1 liegt auf „fabrik“ in Entwicklung, #2 auf keinem Board; „andere“ ist ein zweites Board des Ordners.
    fn boards() -> Result<Vec<Board>, Fehler> {
        let lesen = |slug, text| crate::format::board::lesen(slug, text).unwrap();
        Ok(vec![
            lesen("fabrik", "# Fabrik\n\n## Eingang\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-a.md)\n\n## Fertig\n"),
            lesen("andere", "# Andere\n\n## Wartet\n\n## Läuft\n"),
        ])
    }

    fn keine_boards() -> Result<Vec<Board>, Fehler> {
        panic!("die Boards werden nur für eine neue Spalte gelesen")
    }

    fn aufgabe(nr: u32) -> Aufgabe {
        Aufgabe::neu(nr, format!("000{nr}-a.md"), "a".into())
    }

    fn beispiel() -> serde_json::Value {
        json!({"at": "2026-11-13 10:34+01:00", "role": "entwickler", "column": "Entwicklung", "amount": 3.46, "currency": "USD"})
    }

    fn mit(angaben: serde_json::Value) -> Roheintrag {
        let mut b = beispiel();
        for (k, v) in angaben.as_object().unwrap() {
            b[k] = v.clone();
        }
        roh(b)
    }

    fn roh(rumpf: serde_json::Value) -> Roheintrag {
        Roheintrag::aus_anfrage(PFAD, &rumpf).unwrap()
    }

    /// #1 mit dem Eintrag des Beispiels und einem zweiten um 11:02, angelegt über die API-Regel — also in der Ortszeit
    /// des Laufs gespeichert; dazu die Kennung des ersten (in Berlin `entwickler@2026-11-13T10:34+01:00`).
    fn mit_zwei_eintraegen() -> (Aufgabe, String) {
        let mut a = aufgabe(1);
        for at in ["2026-11-13 10:34+01:00", "2026-11-13 11:02+01:00"] {
            anlegen(&mut a, mit(json!({"at": at})), jetzt(), boards).unwrap();
        }
        let kennung = a.kosteneintraege[0].kennung();
        (a, kennung)
    }

    fn meldung(f: Fehler) -> (u16, String) {
        match f {
            Fehler::Ungueltig(m) => (400, m),
            Fehler::NichtGefunden(m) => (404, m),
            Fehler::Konflikt(m) => (409, m),
            anderer => panic!("{anderer:?}"),
        }
    }

    #[test]
    fn anlegen_haengt_an_und_meldet_betrag_rolle_und_spalte() {
        let mut a = aufgabe(1);
        let nachricht = anlegen(&mut a, mit(json!({"at": "2026-11-13T09:34:59Z", "tokens": 7})), jetzt(), boards).unwrap();
        assert_eq!(nachricht, "#1 Kosteneintrag angelegt: 3,46 USD (entwickler, Entwicklung)");
        let e = &a.kosteneintraege[0];
        assert_eq!((e.cent, e.tokens, e.spalte.as_str()), (346, Some(7), "Entwicklung"));
        assert_eq!(Zeitpunkt::lesen(&e.zeitpunkt).unwrap().utc(), "2026-11-13T09:34:00Z".parse::<DateTime<Utc>>().unwrap(), "derselbe Moment, in Ortszeit gespeichert: {}", e.zeitpunkt);
        assert!(Zeitpunkt::lesen(&e.zeitpunkt).unwrap().datei().len() > 16, "mit Versatz: {}", e.zeitpunkt);
    }

    #[test]
    fn waehrung_aus_dem_etikett_oder_400() {
        let ohne = || mit(json!({"currency": null}));
        let mut a = aufgabe(1);
        assert_eq!(meldung(anlegen(&mut a, ohne(), jetzt(), boards).unwrap_err()), (400, "kosteneintrag: currency fehlt, und #1 trägt kein cost.currency".into()));
        a.kosten = Some(Kosten::aus_anfrage(&json!({"currency": "EUR", "amount": 1})).unwrap());
        anlegen(&mut a, ohne(), jetzt(), boards).unwrap();
        assert_eq!(a.kosteneintraege[0].waehrung, "EUR");
        anlegen(&mut a, mit(json!({"at": "2026-11-13 11:00+01:00"})), jetzt(), boards).unwrap();
        assert_eq!(a.kosteneintraege[1].waehrung, "USD", "eine genannte Währung geht vor");
    }

    #[test]
    fn spalte_nur_von_einem_board_auf_dem_die_aufgabe_liegt() {
        for (nr, spalte, erlaubt) in [(1, "Entwicklung", true), (1, "Fertig", true), (1, "Läuft", false), (1, "Gibtsnicht", false), (1, "entwicklung", false), (1, "Entwicklung ", false), (2, "Läuft", true), (2, "Fertig", true), (2, "Gibtsnicht", false)] {
            let mut a = aufgabe(nr);
            let ergebnis = anlegen(&mut a, mit(json!({"column": spalte})), jetzt(), boards);
            assert_eq!(ergebnis.is_ok(), erlaubt, "#{nr} {spalte}");
            assert_eq!(a.kosteneintraege.len(), usize::from(erlaubt), "#{nr} {spalte}");
            if let Err(f) = ergebnis {
                assert_eq!(meldung(f), (400, format!("kosteneintrag.column: „{}“ ist keine Spalte eines Boards, auf dem #{nr} liegt", spalte.trim())));
            }
        }
    }

    #[test]
    fn zeitpunkt_in_der_zukunft_ist_400_die_laufende_minute_nicht() {
        let mut a = aufgabe(1);
        assert_eq!(meldung(anlegen(&mut a, mit(json!({"at": "2026-11-14 01:01+01:00"})), jetzt(), boards).unwrap_err()), (400, "kosteneintrag.at: Der Zeitpunkt liegt in der Zukunft".into()));
        assert!(a.kosteneintraege.is_empty());
        anlegen(&mut a, mit(json!({"at": "2026-11-14 01:00:30+01:00"})), jetzt(), boards).unwrap();
        let (mut b, kennung) = mit_zwei_eintraegen();
        assert_eq!(meldung(aendern(&mut b, &kennung, roh(json!({"at": "2026-11-14 01:01+01:00"})), false, jetzt(), keine_boards).unwrap_err()).0, 400);
    }

    #[test]
    fn inhaltsregeln_des_konstruktors_gelten_mit_feldnamen() {
        for (angabe, feld) in [(json!({"role": "a@b"}), "role"), (json!({"role": " "}), "role"), (json!({"role": "a\nb"}), "role"), (json!({"role": "x".repeat(61)}), "role"), (json!({"at": "gestern"}), "at"), (json!({"amount": 1000000.01}), "amount"), (json!({"currency": "usd"}), "currency"), (json!({"column": null}), "column")] {
            let mut a = aufgabe(1);
            let (status, m) = meldung(anlegen(&mut a, mit(angabe.clone()), jetzt(), boards).unwrap_err());
            assert!(status == 400 && m.contains(feld), "{angabe} → {status} {m}");
            let (mut b, kennung) = mit_zwei_eintraegen();
            let vorher = b.kosteneintraege.clone();
            if angabe["column"].is_null() && angabe.get("column").is_some() {
                continue; // beim Ändern heißt null: bleibt
            }
            let (status, m) = meldung(aendern(&mut b, &kennung, roh(angabe.clone()), false, jetzt(), boards).unwrap_err());
            assert!(status == 400 && m.contains(feld), "ändern {angabe} → {status} {m}");
            assert_eq!(b.kosteneintraege, vorher);
        }
    }

    #[test]
    fn gleiche_kennung_ist_409_und_sagt_eine_minute_spaeter() {
        let (mut a, kennung) = mit_zwei_eintraegen();
        let vorher = a.kosteneintraege.clone();
        // dieselbe Rolle in derselben Minute — auch mit anderem Betrag, anderer Spalte und in anderer Schreibweise des Zeitpunkts
        for at in ["2026-11-13 10:34+01:00", "2026-11-13T09:34:20Z"] {
            let (status, m) = meldung(anlegen(&mut a, mit(json!({"at": at, "amount": 9, "column": "Fertig"})), jetzt(), boards).unwrap_err());
            assert_eq!(status, 409, "{at}");
            assert!(m.contains("eine Minute später") && m.contains(&kennung), "{m}");
        }
        assert_eq!(a.kosteneintraege, vorher);
        anlegen(&mut a, mit(json!({"role": "planer"})), jetzt(), boards).unwrap();
        assert_eq!(a.kosteneintraege.len(), 3, "eine andere Rolle in derselben Minute kollidiert nicht");
    }

    #[test]
    fn hoechstens_tausend_eintraege() {
        let mut a = aufgabe(1);
        let einer = Kosteneintrag::pruefen(PFAD, mit(json!({"role": "alt"}))).unwrap();
        a.kosteneintraege = vec![einer; HOECHSTZAHL_KOSTENEINTRAEGE - 1];
        anlegen(&mut a, mit(json!({})), jetzt(), boards).unwrap();
        assert_eq!(a.kosteneintraege.len(), 1000);
        let (status, m) = meldung(anlegen(&mut a, mit(json!({"role": "neu"})), jetzt(), boards).unwrap_err());
        assert_eq!((status, m.as_str(), a.kosteneintraege.len()), (409, "#1 trägt schon 1000 Kosteneinträge — mehr nimmt eine Aufgabe nicht auf", 1000));
    }

    #[test]
    fn aendern_ersetzt_nur_genannte_felder_des_einen_eintrags() {
        let (mut a, kennung) = mit_zwei_eintraegen();
        a.kosteneintraege[0].weitere = vec![("note".into(), serde_yaml::Value::String("x".into()))];
        a.kosteneintraege[0].tokens = Some(5);
        let vorher = a.kosteneintraege.clone();
        let nachricht = aendern(&mut a, &kennung, roh(json!({"amount": 3.5})), false, jetzt(), keine_boards).unwrap();
        assert_eq!(nachricht.as_deref(), Some("#1 Kosteneintrag geändert: 3,50 USD (entwickler, Entwicklung)"));
        assert_eq!(a.kosteneintraege[0], Kosteneintrag { cent: 350, ..vorher[0].clone() }, "Unbekanntes und tokens bleiben");
        assert_eq!(a.kosteneintraege[1], vorher[1], "der andere Eintrag bleibt");

        assert_eq!(aendern(&mut a, &kennung, roh(json!({})), false, jetzt(), keine_boards).unwrap(), None, "ohne Änderung kein Commit");
        assert_eq!(aendern(&mut a, &kennung, roh(json!({"amount": 3.5, "column": "Entwicklung"})), false, jetzt(), keine_boards).unwrap(), None, "gleiche Werte sind keine Änderung");
        aendern(&mut a, &kennung, roh(json!({"tokens": null})), true, jetzt(), keine_boards).unwrap().unwrap();
        assert_eq!(a.kosteneintraege[0].tokens, None, "tokens: null entfernt");
        aendern(&mut a, &kennung, roh(json!({"column": "Fertig", "tokens": 9})), false, jetzt(), boards).unwrap().unwrap();
        assert_eq!((a.kosteneintraege[0].spalte.as_str(), a.kosteneintraege[0].tokens), ("Fertig", Some(9)));
        assert_eq!(meldung(aendern(&mut a, &kennung, roh(json!({"column": "Gibtsnicht"})), false, jetzt(), boards).unwrap_err()).0, 400);
    }

    #[test]
    fn eine_umbenannte_spalte_hindert_das_aendern_des_betrags_nicht() {
        let (mut a, kennung) = mit_zwei_eintraegen();
        a.kosteneintraege[0].spalte = "Hiess frueher so".into();
        aendern(&mut a, &kennung, roh(json!({"amount": 1})), false, jetzt(), keine_boards).unwrap().unwrap();
        assert_eq!((a.kosteneintraege[0].cent, a.kosteneintraege[0].spalte.as_str()), (100, "Hiess frueher so"));
    }

    #[test]
    fn neue_rolle_oder_neuer_zeitpunkt_gibt_eine_neue_kennung_und_kollidiert_mit_den_uebrigen() {
        let (mut a, kennung) = mit_zwei_eintraegen();
        let vorher = a.kosteneintraege.clone();
        let (status, m) = meldung(aendern(&mut a, &kennung, roh(json!({"at": "2026-11-13 11:02+01:00"})), false, jetzt(), keine_boards).unwrap_err());
        assert!(status == 409 && m.contains("eine Minute später"), "{status} {m}");
        assert_eq!(a.kosteneintraege, vorher, "nichts geändert");

        aendern(&mut a, &kennung, roh(json!({"role": "planer"})), false, jetzt(), keine_boards).unwrap().unwrap();
        let als_planer = kennung.replace("entwickler@", "planer@");
        assert_eq!(a.kosteneintraege[0].kennung(), als_planer);
        assert_eq!(meldung(aendern(&mut a, &kennung, roh(json!({})), false, jetzt(), keine_boards).unwrap_err()).0, 404, "die alte Kennung trifft nicht mehr");
        aendern(&mut a, &als_planer, roh(json!({"at": "2026-11-13 11:02+01:00"})), false, jetzt(), keine_boards).unwrap().unwrap();
        assert_eq!(a.kosteneintraege.len(), 2, "planer und entwickler in derselben Minute stehen nebeneinander");
    }

    #[test]
    fn unbekannte_oder_verstuemmelte_kennung_trifft_keinen_eintrag() {
        let (_, echt) = mit_zwei_eintraegen();
        let zeit = echt.split_once('@').unwrap().1;
        let verstuemmelt = [
            format!("niemand@{zeit}"),
            "entwickler".to_string(),
            "entwickler@".to_string(),
            format!("@{zeit}"),
            echt[..echt.len() - 1].to_string(),
            echt[1..].to_string(),
            echt.replace('+', " "),
            echt.replace('T', " "),
            echt.replace("entwickler", "Entwickler"),
            format!("{echt}/.."),
            format!("{echt} "),
            format!("../{echt}"),
            "*".to_string(),
            ".*".to_string(),
            "%".to_string(),
            String::new(),
            "0".to_string(),
        ];
        for kennung in verstuemmelt.iter().map(String::as_str) {
            let (mut a, _) = mit_zwei_eintraegen();
            let vorher = a.kosteneintraege.clone();
            assert_eq!(meldung(aendern(&mut a, kennung, roh(json!({"amount": 0})), false, jetzt(), keine_boards).unwrap_err()).0, 404, "PATCH {kennung:?}");
            assert_eq!(meldung(loeschen(&mut a, kennung).unwrap_err()).0, 404, "DELETE {kennung:?}");
            assert_eq!(a.kosteneintraege, vorher, "{kennung:?}");
        }
    }

    #[test]
    fn loeschen_entfernt_genau_den_einen() {
        let (mut a, kennung) = mit_zwei_eintraegen();
        let zweiter = a.kosteneintraege[1].clone();
        assert_eq!(loeschen(&mut a, &kennung).unwrap(), "#1 Kosteneintrag gelöscht: 3,46 USD (entwickler, Entwicklung)");
        assert_eq!(a.kosteneintraege, vec![zweiter]);
        assert_eq!(meldung(loeschen(&mut a, &kennung).unwrap_err()), (404, format!("#1 hat keinen Kosteneintrag {kennung}")));
    }
}
