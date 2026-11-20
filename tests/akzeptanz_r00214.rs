// R00214 (I0204, Karte #228): Braucht zwischen Karten — Deutung, Prüfung an der Tür und Lesefeld in der API.
// Schichten: Testfall (je AK) → Testsprache (`Lage`: Ausgangslage, Labels, Ziehen, Lesen) → Treiber (`gemeinsam::senden`,
// HTTP-GET, Dateien, Git) → echtes Programm. AK 14 (Bestand) ist die Legacy-Probe `ak14_…` (`#[ignore]`, von Hand in B1090),
// AK 15 laufen die Proben der Factory gegen eine Instanz mit diesem Stand (B1090).
mod gemeinsam;

use gemeinsam::{Laufendes, git, senden};
use reqwest::Method;
use serde_json::{Value, json};
use std::path::Path;

const FORM: &str = "braucht: erwartet eine Kartennummer (braucht:12)";
const FELD: &str = "braucht über labels setzen (braucht:<nr>)";

// ---- Treiber ----------------------------------------------------------------------------------------------------------

async fn get(adresse: &str, pfad: &str) -> (u16, Value) {
    let r = reqwest::get(format!("{adresse}{pfad}")).await.unwrap();
    let status = r.status().as_u16();
    (status, serde_json::from_str(&r.text().await.unwrap()).unwrap_or(Value::Null))
}

/// Die Aufgabendatei so, wie ein Mensch sie von Hand schreibt; Labels in Anführungszeichen wie im Bestand.
fn aufgabendatei(nr: u32, titel: &str, labels: &[&str], archiviert: bool) -> String {
    let mut kopf = format!("---\nid: {nr}\ntitle: {titel}\n");
    if !labels.is_empty() {
        let liste: Vec<String> = labels.iter().map(|l| format!("\"{l}\"")).collect();
        kopf.push_str(&format!("labels: [{}]\n", liste.join(", ")));
    }
    if archiviert {
        kopf.push_str("archived: 2026-11-01\n");
    }
    kopf + "---\n"
}

const DATEIEN: [(u32, &str, &str); 5] = [(1, "Gerüst", "0001-geruest.md"), (2, "Bau", "0002-bau.md"), (3, "Doku", "0003-doku.md"), (4, "Alt", "0004-alt.md"), (5, "Frei", "0005-frei.md")];

fn dateiname(nr: u32) -> &'static str {
    DATEIEN.iter().find(|(n, _, _)| *n == nr).map(|(_, _, d)| *d).expect("Aufgabe der Ausgangslage")
}

// ---- Testsprache ------------------------------------------------------------------------------------------------------

/// Ausgangslage von R00214: Board `e` mit „Offen“, „In Arbeit“, „Fertig“ (letzte); #1 „Gerüst“, #2 „Bau“ und #5 „Frei“
/// in Offen, #3 „Doku“ in In Arbeit, #4 „Alt“ archiviert (auf keinem Board). Labels „von Hand“ stehen vor dem Start im Commit.
struct Lage {
    k: tempfile::TempDir,
    lauf: Laufendes,
}

impl Lage {
    fn neu() -> Lage {
        Lage::von_hand(&[])
    }

    /// Ausgangslage, dazu je Aufgabe Labels, von Hand committet.
    fn von_hand(labels: &[(u32, &[&str])]) -> Lage {
        Lage::mit_dateien(labels, &[])
    }

    /// Wie `von_hand`, dazu weitere Aufgabendateien (Name, Text) — etwa eine defekte.
    fn mit_dateien(labels: &[(u32, &[&str])], weitere: &[(&str, &str)]) -> Lage {
        let k = tempfile::tempdir().unwrap();
        let w = k.path();
        std::fs::create_dir_all(w.join("boards")).unwrap();
        std::fs::create_dir_all(w.join("aufgaben")).unwrap();
        std::fs::write(w.join("kanbanD.md"), "---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\n---\n").unwrap();
        std::fs::write(w.join("boards/e.md"), "# E\n\n## Offen\n\n- #1\n- #2\n- #5\n\n## In Arbeit\n\n- #3\n\n## Fertig\n").unwrap();
        for (nr, titel, datei) in DATEIEN {
            let eigene: &[&str] = labels.iter().find(|(n, _)| *n == nr).map(|(_, l)| *l).unwrap_or(&[]);
            std::fs::write(w.join("aufgaben").join(datei), aufgabendatei(nr, titel, eigene, nr == 4)).unwrap();
        }
        for (datei, text) in weitere {
            std::fs::write(w.join("aufgaben").join(datei), text).unwrap();
        }
        git(w, &["init", "-q"]);
        git(w, &["add", "-A"]);
        git(w, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "Ausgangslage"]);
        let lauf = gemeinsam::starten(w, &["--port", "0"]);
        Lage { k, lauf }
    }

    fn ordner(&self) -> &Path {
        self.k.path()
    }

    fn commits(&self) -> u32 {
        git(self.ordner(), &["rev-list", "--count", "HEAD"]).parse().unwrap()
    }

    fn datei(&self, nr: u32) -> Vec<u8> {
        std::fs::read(self.ordner().join("aufgaben").join(dateiname(nr))).unwrap()
    }

    fn aufgabendateien(&self) -> usize {
        std::fs::read_dir(self.ordner().join("aufgaben")).unwrap().count()
    }

    async fn karte(&self, nr: u32) -> Value {
        let (s, a) = get(&self.lauf.adresse, &format!("api/aufgaben/{nr}")).await;
        assert_eq!(s, 200, "GET #{nr}: {a}");
        a
    }

    /// Die Karte, wie sie in der Liste `GET /api/aufgaben` steht.
    async fn in_der_liste(&self, nr: u32) -> Value {
        let (s, l) = get(&self.lauf.adresse, "api/aufgaben").await;
        assert_eq!(s, 200);
        l["aufgaben"].as_array().unwrap().iter().find(|a| a["nummer"] == nr).cloned().unwrap_or_else(|| panic!("#{nr} fehlt in der Liste"))
    }

    async fn braucht(&self, nr: u32) -> Value {
        self.karte(nr).await["braucht"].clone()
    }

    /// Nummern der Liste `GET /api/aufgaben?<abfrage>` oder der Status, wenn er nicht 200 ist.
    async fn liste(&self, abfrage: &str) -> Result<Vec<u64>, (u16, Value)> {
        let (s, l) = get(&self.lauf.adresse, &format!("api/aufgaben?{abfrage}")).await;
        if s != 200 {
            return Err((s, l));
        }
        Ok(l["aufgaben"].as_array().unwrap().iter().map(|a| a["nummer"].as_u64().unwrap()).collect())
    }

    async fn labels_setzen(&self, nr: u32, labels: &[&str]) -> (u16, Value) {
        self.aendern(nr, json!({ "labels": labels })).await
    }

    async fn aendern(&self, nr: u32, rumpf: Value) -> (u16, Value) {
        senden(Method::PATCH, &self.lauf.adresse, &format!("api/aufgaben/{nr}"), "cl", rumpf).await
    }

    async fn rufen(&self, methode: Method, pfad: &str, rumpf: Value) -> (u16, Value) {
        senden(methode, &self.lauf.adresse, pfad, "cl", rumpf).await
    }

    async fn ziehen(&self, nr: u32, spalte: &str) {
        let (s, f) = senden(Method::POST, &self.lauf.adresse, "api/boards/e/bewegen", "st", json!({"nummer": nr, "spalte": spalte})).await;
        assert_eq!(s, 200, "#{nr} nach {spalte}: {f}");
    }

    async fn archivieren(&self, nr: u32) {
        let (s, f) = senden(Method::POST, &self.lauf.adresse, &format!("api/aufgaben/{nr}/archivieren"), "st", json!({})).await;
        assert_eq!(s, 200, "#{nr} archivieren: {f}");
    }

    async fn loeschen(&self, nr: u32) {
        let (s, f) = senden(Method::DELETE, &self.lauf.adresse, &format!("api/aufgaben/{nr}"), "st", json!({})).await;
        assert_eq!(s, 200, "#{nr} löschen: {f}");
    }
}

fn fehler(antwort: &(u16, Value)) -> &str {
    antwort.1["fehler"].as_str().unwrap_or_default()
}

/// Ein Eintrag in `braucht`, gelesen als (nummer, titel, erledigt).
fn eintraege(braucht: &Value) -> Vec<(u64, Value, bool)> {
    braucht.as_array().unwrap_or_else(|| panic!("braucht ist keine Liste: {braucht}")).iter().map(|b| (b["nummer"].as_u64().unwrap(), b["titel"].clone(), b["erledigt"].as_bool().unwrap())).collect()
}

/// Abweisung an der Tür: 400 mit `meldung` (im Text enthalten), kein Commit, die Datei bytegleich.
async fn abgewiesen(lage: &Lage, nr: u32, labels: &[&str], meldung: &str) -> String {
    let (commits, datei) = (lage.commits(), lage.datei(nr));
    let antwort = lage.labels_setzen(nr, labels).await;
    assert_eq!(antwort.0, 400, "{labels:?}: {}", antwort.1);
    assert!(fehler(&antwort).contains(meldung), "{labels:?}: {}", antwort.1);
    assert_eq!(lage.commits(), commits, "{labels:?}: kein Commit");
    assert_eq!(lage.datei(nr), datei, "{labels:?}: Datei bytegleich");
    fehler(&antwort).to_string()
}

// ---- AK 1–4: Deutung und Lesefeld --------------------------------------------------------------------------------------

#[tokio::test]
async fn ak01_braucht_in_einzel_und_listenantwort() {
    let lage = Lage::von_hand(&[(2, &["feature", "braucht:1"])]);
    let erwartet = json!([{"nummer": 1, "titel": "Gerüst", "erledigt": false}]);
    assert_eq!(lage.karte(2).await["braucht"], erwartet, "GET /api/aufgaben/2");
    assert_eq!(lage.in_der_liste(2).await["braucht"], erwartet, "GET /api/aufgaben");
    assert_eq!(lage.karte(5).await["braucht"], json!([]), "#5 ohne Abhängigkeit");
    assert_eq!(lage.in_der_liste(5).await["braucht"], json!([]));
}

#[tokio::test]
async fn ak02_erledigt_heisst_letzte_spalte_oder_archiviert() {
    let lage = Lage::von_hand(&[(2, &["braucht:1"]), (3, &["braucht:4"])]);
    let erledigt = |b: Value| eintraege(&b)[0].2;
    assert!(!erledigt(lage.braucht(2).await), "#1 in Offen");
    lage.ziehen(1, "In Arbeit").await;
    assert!(!erledigt(lage.braucht(2).await), "#1 in In Arbeit, nicht archiviert");
    lage.ziehen(1, "Fertig").await;
    assert!(erledigt(lage.braucht(2).await), "#1 in der letzten Spalte");
    lage.ziehen(1, "Offen").await;
    assert!(!erledigt(lage.braucht(2).await), "#1 zurück in Offen");
    lage.archivieren(1).await;
    assert!(erledigt(lage.braucht(2).await), "#1 archiviert");
    assert_eq!(eintraege(&lage.braucht(3).await), vec![(4, json!("Alt"), true)], "#4 archiviert");
}

#[tokio::test]
async fn ak03_deutung_ohne_gross_klein_reihenfolge_dubletten_einmal_andere_form_stumm() {
    let labels = ["BRAUCHT:3", "braucht:1", "Braucht:1", "braucht:abc", "braucht:kd#12", "braucht:012", "braucht:0", "braucht:999"];
    let lage = Lage::von_hand(&[(2, &labels)]);
    let (commits, datei) = (lage.commits(), lage.datei(2));
    let a = lage.karte(2).await;
    assert_eq!(eintraege(&a["braucht"]), vec![(3, json!("Doku"), false), (1, json!("Gerüst"), false), (999, Value::Null, false)]);
    assert_eq!(a["labels"], json!(labels), "labels unverändert, alle acht");
    assert_eq!((lage.commits(), lage.datei(2)), (commits, datei), "Lesen schreibt nichts");
}

#[tokio::test]
async fn ak04_braucht_im_rumpf_wird_abgewiesen() {
    let lage = Lage::neu();
    let commits = lage.commits();
    let datei = lage.datei(5);
    let antwort = lage.aendern(5, json!({"braucht": [{"nummer": 1}]})).await;
    assert_eq!((antwort.0, fehler(&antwort)), (400, FELD), "PATCH: {}", antwort.1);
    let dateien = lage.aufgabendateien();
    let antwort = lage.rufen(Method::POST, "api/aufgaben", json!({"titel": "Neu", "braucht": [{"nummer": 1}]})).await;
    assert_eq!(antwort.0, 400, "POST: {}", antwort.1);
    assert!(fehler(&antwort).contains(FELD), "POST: {}", antwort.1);
    assert_eq!(lage.aufgabendateien(), dateien, "POST legt keine Datei an");
    let antwort = lage.rufen(Method::POST, "api/aufgaben/mehrere", json!({"titel": [{"titel": "A"}, {"titel": "B", "braucht": []}]})).await;
    assert_eq!(antwort.0, 400, "POST mehrere: {}", antwort.1);
    assert!(fehler(&antwort).contains(FELD), "POST mehrere: {}", antwort.1);
    let antwort = lage.rufen(Method::PATCH, "api/aufgaben/mehrere", json!({"aenderungen": [{"nummer": 1, "titel": "X"}, {"nummer": 5, "braucht": [{"nummer": 1}]}]})).await;
    assert_eq!(antwort.0, 400, "PATCH mehrere: {}", antwort.1);
    assert!(fehler(&antwort).contains(FELD), "PATCH mehrere: {}", antwort.1);
    assert_eq!(lage.commits(), commits, "kein Commit");
    assert_eq!(lage.datei(5), datei);
    assert_eq!(lage.aufgabendateien(), dateien);
}

// ---- AK 5–6: Filter ---------------------------------------------------------------------------------------------------

#[tokio::test]
async fn ak05_wartet_ja_nein_und_mit_anderen_filtern() {
    let lage = Lage::von_hand(&[(2, &["braucht:1"]), (3, &["braucht:4"])]);
    assert_eq!(lage.liste("wartet=ja").await, Ok(vec![2]));
    assert_eq!(lage.liste("wartet=nein").await, Ok(vec![1, 3, 5]), "#4 als archivierte nicht");
    assert_eq!(lage.liste("wartet=ja&board=e").await, Ok(vec![2]), "UND mit board");
    assert_eq!(lage.liste("wartet=nein&board=e&spalte=In%20Arbeit").await, Ok(vec![3]), "UND mit spalte");
    assert_eq!(lage.liste("wartet=ja&archivierte=ja").await, Ok(vec![2]));
    assert_eq!(lage.liste("label=braucht:1").await, Ok(vec![2]), "label= bleibt");
    let falsch = lage.liste("wartet=vielleicht").await.unwrap_err();
    assert_eq!(falsch.0, 400, "{}", falsch.1);
    lage.ziehen(1, "Fertig").await;
    assert_eq!(lage.liste("wartet=ja").await, Ok(vec![]), "#1 erledigt");
    assert_eq!(lage.liste("wartet=nein").await, Ok(vec![1, 2, 3, 5]));
}

#[tokio::test]
async fn ak06_fehlende_datei_zaehlt_als_offen() {
    let lage = Lage::von_hand(&[(5, &["braucht:999"])]);
    assert_eq!(lage.liste("wartet=ja").await, Ok(vec![5]));
}

// ---- AK 7–12: Prüfung an der Tür ---------------------------------------------------------------------------------------

#[tokio::test]
async fn ak07_falsche_form_mit_praefix_wird_abgewiesen() {
    let lage = Lage::neu();
    for label in ["braucht:x", "braucht:012", "braucht:0", "braucht: 1", "BRAUCHT:kd#12", "braucht:", "braucht:-1", "braucht:1.0", "braucht:+1", "braucht:99999999999"] {
        let meldung = abgewiesen(&lage, 5, &[label], FORM).await;
        assert_eq!(meldung, FORM, "{label}: genau die Meldung, ohne den Rest des Labels");
    }
    for gewoehnlich in [&["braucht"][..], &["brauchtnix"][..]] {
        let (s, a) = lage.labels_setzen(5, gewoehnlich).await;
        assert_eq!(s, 200, "{gewoehnlich:?}: {a}");
        assert_eq!(a["labels"], json!(gewoehnlich));
    }
}

#[tokio::test]
async fn ak08_selbstbezug_wird_abgewiesen() {
    let lage = Lage::neu();
    let meldung = abgewiesen(&lage, 5, &["braucht:5"], "#5 kann nicht auf sich selbst warten").await;
    assert_eq!(meldung, "#5 kann nicht auf sich selbst warten");
    abgewiesen(&lage, 5, &["Braucht:5"], "#5 kann nicht auf sich selbst warten").await;
}

#[tokio::test]
async fn ak09_unbekannte_nummer_abgewiesen_archivierte_angenommen() {
    let lage = Lage::neu();
    let meldung = abgewiesen(&lage, 5, &["braucht:999"], "#999").await;
    assert_eq!(meldung, "Aufgabe #999 gibt es nicht (braucht:999)", "Wortlaut PO Z. 452");
    let commits = lage.commits();
    let (s, a) = lage.labels_setzen(5, &["braucht:4"]).await;
    assert_eq!(s, 200, "{a}");
    assert_eq!(lage.commits(), commits + 1, "genau ein Commit");
    assert_eq!(eintraege(&lage.braucht(5).await), vec![(4, json!("Alt"), true)]);
}

#[tokio::test]
async fn ak10_kreis_wird_abgewiesen_und_benannt() {
    let lage = Lage::von_hand(&[(2, &["braucht:1"])]);
    let meldung = abgewiesen(&lage, 1, &["braucht:2"], "#1 → #2 → #1").await;
    assert_eq!(meldung, "braucht:2 ergäbe einen Kreis: #1 → #2 → #1", "Wortlaut PO Z. 452");

    let lang = Lage::von_hand(&[(2, &["braucht:1"]), (3, &["braucht:2"])]);
    abgewiesen(&lang, 1, &["braucht:3"], "#1 → #3 → #2 → #1").await;

    let mehrere = Lage::neu();
    let (commits, eins, fuenf) = (mehrere.commits(), mehrere.datei(1), mehrere.datei(5));
    let antwort = mehrere.rufen(Method::PATCH, "api/aufgaben/mehrere", json!({"aenderungen": [{"nummer": 1, "labels": ["braucht:5"]}, {"nummer": 5, "labels": ["braucht:1"]}]})).await;
    assert_eq!(antwort.0, 400, "{}", antwort.1);
    assert_eq!(fehler(&antwort), "#1: braucht:5 ergäbe einen Kreis: #1 → #5 → #1", "Vorsatz bei mehrere: {}", antwort.1);
    assert_eq!((mehrere.commits(), mehrere.datei(1), mehrere.datei(5)), (commits, eins, fuenf), "keine Datei geändert, kein Commit");
}

#[tokio::test]
async fn ak11_unveraendert_mitgeschickte_labels_werden_nicht_geprueft() {
    let lage = Lage::von_hand(&[(3, &["braucht:abc", "braucht:888"])]);
    let (s, a) = lage.labels_setzen(3, &["braucht:abc", "braucht:888", "prio"]).await;
    assert_eq!(s, 200, "{a}");
    assert_eq!(a["labels"], json!(["braucht:abc", "braucht:888", "prio"]));
    let meldung = abgewiesen(&lage, 3, &["braucht:abc", "braucht:888", "braucht:777"], "#777").await;
    assert!(!meldung.contains("abc") && !meldung.contains("888"), "{meldung}");

    let gross = Lage::von_hand(&[(3, &["BRAUCHT:abc", "Braucht:888"])]);
    let (s, a) = gross.labels_setzen(3, &["braucht:abc", "braucht:888", "prio"]).await;
    assert_eq!(s, 200, "Vergleich mit dem Gespeicherten ohne Groß/Klein: {a}");

    let geloescht = Lage::von_hand(&[(2, &["braucht:1"])]);
    geloescht.loeschen(1).await;
    let (s, a) = geloescht.labels_setzen(2, &["braucht:1", "ui"]).await;
    assert_eq!(s, 200, "ADR-0035 Pre-Mortem d: {a}");
    assert_eq!(eintraege(&geloescht.braucht(2).await), vec![(1, Value::Null, false)], "US-5");
}

#[tokio::test]
async fn ak12_anlegen_prueft_duplizieren_nicht() {
    let lage = Lage::von_hand(&[(3, &["braucht:abc", "braucht:888"])]);
    let (s, a) = lage.rufen(Method::POST, "api/aufgaben", json!({"titel": "Neu", "labels": ["braucht:1"]})).await;
    assert_eq!(s, 201, "{a}");
    let neu = a["nummer"].as_u64().unwrap() as u32;
    assert_eq!(lage.karte(neu).await["braucht"], json!([{"nummer": 1, "titel": "Gerüst", "erledigt": false}]));

    let (commits, dateien) = (lage.commits(), lage.aufgabendateien());
    let antwort = lage.rufen(Method::POST, "api/aufgaben", json!({"titel": "Kaputt", "labels": ["braucht:999"]})).await;
    assert_eq!(antwort.0, 400, "{}", antwort.1);
    assert!(fehler(&antwort).contains("#999"), "{}", antwort.1);
    let antwort = lage.rufen(Method::POST, "api/aufgaben/mehrere", json!({"titel": [{"titel": "A"}, {"titel": "B", "labels": ["braucht:999"]}]})).await;
    assert_eq!(antwort.0, 400, "{}", antwort.1);
    assert!(fehler(&antwort).contains("#999"), "{}", antwort.1);
    assert_eq!((lage.commits(), lage.aufgabendateien()), (commits, dateien), "keine Aufgabendatei, kein Commit");

    let (s, kopie) = lage.rufen(Method::POST, "api/aufgaben/3/duplizieren", json!({})).await;
    assert_eq!(s, 201, "{kopie}");
    assert_eq!(kopie["labels"], json!(["braucht:abc", "braucht:888"]), "Duplizieren prüft nicht");
}

// ---- AK 13: Beschreibung der API ---------------------------------------------------------------------------------------

#[tokio::test]
async fn ak13_openapi_und_endpunkte_beschreiben_braucht_und_wartet() {
    let lage = Lage::neu();
    let (s, api) = get(&lage.lauf.adresse, "api/openapi.json").await;
    assert_eq!(s, 200);
    let braucht = &api["components"]["schemas"]["Aufgabe"]["properties"]["braucht"];
    assert_eq!(braucht["readOnly"], json!(true), "{braucht}");
    let element = match &braucht["items"]["$ref"] {
        Value::String(verweis) => api.pointer(&verweis.replacen('#', "", 1)).cloned().unwrap(),
        _ => braucht["items"].clone(),
    };
    for feld in ["nummer", "titel", "erledigt"] {
        assert!(element["properties"][feld].is_object(), "{feld}: {element}");
    }
    assert!(element["properties"]["titel"].to_string().contains("null"), "titel nullable: {element}");
    let parameter = api["paths"]["/api/aufgaben"]["get"]["parameters"].as_array().unwrap();
    let wartet = parameter.iter().find(|p| p["name"] == "wartet").unwrap_or_else(|| panic!("Parameter wartet fehlt"));
    let text = wartet.to_string();
    assert!(text.contains("ja") && text.contains("nein"), "{wartet}");

    let (s, endpunkte) = get(&lage.lauf.adresse, "api/endpunkte").await;
    assert_eq!(s, 200);
    let beschreibung = |methode: &str, pfad: &str| {
        endpunkte.as_array().or(endpunkte["endpunkte"].as_array()).unwrap().iter().find(|e| e["methode"] == methode && e["pfad"] == pfad).map(|e| e.to_string()).unwrap_or_else(|| panic!("{methode} {pfad} fehlt"))
    };
    assert!(beschreibung("GET", "/api/aufgaben").contains("wartet=ja|nein"));
    for (methode, pfad) in [("POST", "/api/aufgaben"), ("PATCH", "/api/aufgaben/{nr}")] {
        let text = beschreibung(methode, pfad);
        for teil in ["braucht:", "selbst", "gibt es nicht", "Kreis", "braucht über labels setzen"] {
            assert!(text.contains(teil), "{methode} {pfad} nennt „{teil}“: {text}");
        }
    }
}

// ---- Eigene Varianten (entwickler, über die AK hinaus) ----------------------------------------------------------------

#[tokio::test]
async fn eigen_mehrere_nennen_die_nummer_und_eine_neue_karte_derselben_anfrage_gibt_es() {
    let lage = Lage::neu();
    let antwort = lage.rufen(Method::PATCH, "api/aufgaben/mehrere", json!({"aenderungen": [{"nummer": 1, "titel": "X"}, {"nummer": 5, "labels": ["braucht:x"]}]})).await;
    assert_eq!((antwort.0, fehler(&antwort)), (400, format!("#5: {FORM}").as_str()), "{}", antwort.1);
    let antwort = lage.rufen(Method::POST, "api/aufgaben", json!({"titel": "Neu", "labels": ["braucht:6"]})).await;
    assert_eq!((antwort.0, fehler(&antwort)), (400, "„Neu“: #6 kann nicht auf sich selbst warten"), "die neue Karte bekäme #6: {}", antwort.1);
    let (s, a) = lage.rufen(Method::POST, "api/aufgaben/mehrere", json!({"titel": [{"titel": "A"}, {"titel": "B", "labels": ["braucht:6"]}]})).await;
    assert_eq!(s, 201, "B wartet auf A aus derselben Anfrage: {a}");
    assert_eq!(lage.karte(7).await["braucht"], json!([{"nummer": 6, "titel": "A", "erledigt": false}]));
}

#[tokio::test]
async fn eigen_kreis_gegen_den_stand_nach_dem_ganzen_aufruf_und_beim_anlegen() {
    let lage = Lage::von_hand(&[(2, &["braucht:1"])]);
    let antwort = lage.rufen(Method::PATCH, "api/aufgaben/mehrere", json!({"aenderungen": [{"nummer": 2, "labels": []}, {"nummer": 1, "labels": ["braucht:2"]}]})).await;
    assert_eq!(antwort.0, 200, "die Kante #2 → #1 fällt im selben Aufruf weg: {}", antwort.1);
    assert_eq!(eintraege(&lage.braucht(1).await), vec![(2, json!("Bau"), false)]);

    let stale = Lage::von_hand(&[(2, &["braucht:6"])]);
    let antwort = stale.rufen(Method::POST, "api/aufgaben", json!({"titel": "Neu", "labels": ["braucht:2"]})).await;
    assert_eq!((antwort.0, fehler(&antwort)), (400, "„Neu“: braucht:2 ergäbe einen Kreis: #6 → #2 → #6"), "{}", antwort.1);
    let antwort = stale.labels_setzen(5, &["braucht:2"]).await;
    assert_eq!(antwort.0, 200, "ohne #6 kein Kreis: {}", antwort.1);
}

#[tokio::test]
async fn eigen_defekte_datei_zaehlt_als_vorhanden_und_liest_sich_wie_eine_fehlende() {
    let lage = Lage::mit_dateien(&[], &[("0006-kaputt.md", "---\nid: 6\ntitle: [kaputt\n---\n")]);
    let (s, a) = lage.labels_setzen(5, &["braucht:6"]).await;
    assert_eq!(s, 200, "es gibt die Datei: {a}");
    assert_eq!(lage.braucht(5).await, json!([{"nummer": 6, "titel": null, "erledigt": false}]));
    assert_eq!(lage.liste("wartet=ja").await, Ok(vec![5]));
}

// ---- AK 14: Legacy-Probe gegen Kopien der Bestände (von Hand, B1090) ---------------------------------------------------

/// Das Programm mit eigenem Mitschnitt von stderr („im Log steht keine Fehler- oder Warnzeile“).
struct Instanz {
    kind: std::process::Child,
    adresse: String,
    log: std::path::PathBuf,
}

impl Drop for Instanz {
    fn drop(&mut self) {
        gemeinsam::geordnet_beenden(&mut self.kind);
    }
}

impl Instanz {
    fn starten(board: &Path, log: std::path::PathBuf) -> Instanz {
        use std::io::BufRead;
        let mut kind = std::process::Command::new(env!("CARGO_BIN_EXE_kanbanD"))
            .arg(board)
            .args(["--kein-browser", "--host", "127.0.0.1", "--port", "0"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::from(std::fs::File::create(&log).unwrap()))
            .spawn()
            .expect("kanbanD startet");
        let mut zeile = String::new();
        std::io::BufReader::new(kind.stdout.take().unwrap()).read_line(&mut zeile).unwrap();
        let adresse = zeile.split_whitespace().last().expect("Adresse in der Startzeile").to_string();
        Instanz { kind, adresse, log }
    }

    /// Zeilen des Logs, die nach Fehler oder Warnung aussehen; ausgenommen die erschöpften inotify-Instanzen des Rechners.
    fn auffaellige_zeilen(&self) -> Vec<String> {
        let auffaellig = |z: &str| ["fehler", "warn", "error", "defekt", "nicht beobachtet"].iter().any(|w| z.to_lowercase().contains(w));
        let rechnergrenze = |z: &str| z.contains("nicht beobachtet (Too many open files (os error 24))");
        std::fs::read_to_string(&self.log).unwrap_or_default().lines().filter(|z| auffaellig(z) && !rechnergrenze(z)).map(String::from).collect()
    }
}

/// Alle versionierten Dateien mit Inhalt, sortiert — die Gleichheit ersetzt die SHA-256-Summe über `git ls-files`.
fn dateien(ordner: &Path) -> Vec<(String, Vec<u8>)> {
    let mut alle: Vec<_> = git(ordner, &["ls-files"]).lines().map(|p| (p.to_string(), std::fs::read(ordner.join(p)).unwrap())).collect();
    alle.sort();
    alle
}

/// Die Nummer eines Labels der Form `braucht:<Zahl>` (ohne Groß/Klein, ohne führende Null) — unabhängig vom Programm gezählt.
fn bestandsnummer(label: &str) -> Option<u64> {
    let (praefix, zahl) = label.split_at_checked(8)?;
    let form = praefix.eq_ignore_ascii_case("braucht:") && !zahl.is_empty() && !zahl.starts_with('0') && zahl.bytes().all(|b| b.is_ascii_digit());
    form.then(|| zahl.parse().ok()).flatten()
}

/// `R00214_KOPIEN` = Kopien der Board-Ordner, durch `:` getrennt (werden gelesen, nie beschrieben).
#[tokio::test]
#[ignore = "Legacy-Probe von Hand: braucht Kopien der Board-Ordner (R00214_KOPIEN)"]
async fn ak14_legacy_probe_kopien_der_bestaende() {
    let kopien = std::env::var("R00214_KOPIEN").expect("R00214_KOPIEN fehlt");
    let (mut dateien_mit, mut labels_gesamt) = (0, 0);
    for kopie in kopien.split(':').map(std::path::PathBuf::from) {
        let name = kopie.file_name().unwrap().to_string_lossy().to_string();
        let (zahl, vorher) = (git(&kopie, &["rev-list", "--count", "HEAD"]), dateien(&kopie));
        let lauf = Instanz::starten(&kopie, kopie.parent().unwrap().join(format!("log-{name}.txt")));
        let (s, liste) = get(&lauf.adresse, "api/aufgaben?archivierte=ja").await;
        assert_eq!(s, 200, "{name}");
        let (mut mit, mut eintraege) = (0, 0);
        for a in liste["aufgaben"].as_array().unwrap() {
            let mut erwartet: Vec<u64> = vec![];
            for n in a["labels"].as_array().unwrap().iter().filter_map(|l| bestandsnummer(l.as_str().unwrap())) {
                if !erwartet.contains(&n) {
                    erwartet.push(n);
                }
            }
            let gedeutet: Vec<u64> = a["braucht"].as_array().unwrap_or_else(|| panic!("{name} #{}: braucht fehlt", a["nummer"])).iter().map(|b| b["nummer"].as_u64().unwrap()).collect();
            assert_eq!(gedeutet, erwartet, "{name} #{}", a["nummer"]);
            if !gedeutet.is_empty() {
                mit += 1;
                eintraege += gedeutet.len();
            }
        }
        let (s, wartend) = get(&lauf.adresse, "api/aufgaben?wartet=ja&archivierte=ja").await;
        assert_eq!(s, 200, "{name}: wartet=ja");
        assert_eq!(git(&kopie, &["rev-list", "--count", "HEAD"]), zahl, "{name}: kein Commit");
        assert_eq!(dateien(&kopie), vorher, "{name}: alle Dateien bytegleich");
        assert_eq!(lauf.auffaellige_zeilen(), Vec::<String>::new(), "{name}");
        println!("{name}: {mit} Aufgaben mit braucht, {eintraege} Einträge, davon wartend {} Aufgaben", wartend["aufgaben"].as_array().unwrap().len());
        dateien_mit += mit;
        labels_gesamt += eintraege;
    }
    println!("gesamt: {dateien_mit} Aufgaben, {labels_gesamt} Einträge in braucht");
}
