//! Transkripte der Agentenläufe ablegen, lesen und löschen (R00216, ADR-0036). Die gz-Datei liegt unversioniert unter
//! `transkripte/<nr>/` (darin `transkripte/.gitignore` = `*`), versioniert wird nur der Eintrag `transcripts` an der Karte.
//!
//! **Pfadschutz (Regel 7):** Ein Pfad unter `transkripte/` entsteht nur in [`datei`] — aus der Nummer der Route und dem
//! Namen, den [`Transkripteintrag::dateiname`] aus der geprüften Kennung faltet. Vor jedem Öffnen, Umbenennen und Löschen
//! prüft sie den Namen gegen das Muster und weist Symlinks auf `transkripte/`, `transkripte/<nr>/` und die Datei ab.

use super::{Kanban, Schritt};
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::{Erfassung, GZIP_KENNBYTES, HOECHSTZAHL_TRANSKRIPTE, Person, TRANSKRIPT_HOECHSTENS, TRANSKRIPTE_ORDNER as ORDNER, Transkripteintrag, Transkriptzeile, Transkriptzustand};
use super::antwortbudget::Rumpf;
use std::io::Read;
use chrono::Utc;
use std::io::Write;
use std::path::{Path, PathBuf};

/// Inhalt von `transkripte/.gitignore`: der Ordner ignoriert sich selbst, die `.gitignore` des Menschen bleibt unberührt.
const GITIGNORE: &str = "*\n";

/// Je Stelle eine Handlung, die dort einmal läuft.
#[cfg(test)]
type Haken = std::collections::HashMap<&'static str, Box<dyn FnOnce()>>;

#[cfg(test)]
thread_local! {
    /// Haken zwischen Prüfen und Handeln (Lehre „Prüfen-dann-Handeln“): ein Test legt je Stelle eine Handlung ab, die
    /// genau dort einmal läuft — deterministisch statt mit Threads, die die Lücke nur zufällig treffen.
    static HAKEN: std::cell::RefCell<Haken> = std::cell::RefCell::default();
}

#[cfg(test)]
fn haken(stelle: &'static str) {
    if let Some(handlung) = HAKEN.with(|h| h.borrow_mut().remove(stelle)) {
        handlung();
    }
}

#[cfg(not(test))]
fn haken(_: &'static str) {}

/// Körpergrenze der Route `POST …/transkripte` (ADR-0036 Regel 5): die größte Datei und 64 KB für Felder und Rahmen.
pub const KOERPERGRENZE: usize = TRANSKRIPT_HOECHSTENS as usize + 64 * 1024;
/// Steht in jeder Meldung zu den Feldern vorn, z. B. `transkript.role: …`.
const PFAD: &str = "transkript";
/// Höchstlänge eines Textfelds der Anfrage in Byte — die Rolle hat höchstens 60 Zeichen, ein Zeitpunkt etwa 25.
pub const FELD_HOECHSTENS: usize = 1024;

/// Die Textfelder des Hochladens, wie sie in der Anfrage standen.
#[derive(Debug, Clone, Default)]
pub struct Ablageangaben {
    pub at: Option<String>,
    pub role: Option<String>,
    pub column: Option<String>,
}

impl Ablageangaben {
    /// Der Eintrag nach ADR-0028 Punkt 2: `at` nicht in der Zukunft, gespeichert in Ortszeit mit Versatz — wie beim
    /// Kosteneintrag desselben Laufs, damit beide dieselbe Kennung tragen.
    fn eintrag(&self, bytes: u64) -> Result<Transkripteintrag, Fehler> {
        let at = super::kosteneintraege::zeitpunkt_der_anfrage(PFAD, self.at.clone(), Utc::now())?;
        Transkripteintrag::neu(PFAD, at.as_deref(), self.role.as_deref(), self.column.as_deref(), bytes).map_err(Fehler::Ungueltig)
    }
}

/// So oft legt ein Upload den Ordner neu an, den ein gleichzeitig abgebrochener ihm entzogen hat.
const VERSUCHE_ORDNER: usize = 5;

/// Was ein Upload unter `transkripte/` angelegt hat — beim Verwerfen wird nur das zurückgebaut.
#[derive(Debug, Default)]
struct Angelegt {
    oben: bool,
    ordner: bool,
}

/// Die Datei eines Uploads auf dem Weg auf die Platte (ADR-0036 Regel 5, konstanter Speicher): die ersten drei Byte im
/// Speicher, bis die Kennbytes geprüft sind; erst dann entstehen Ordner und Zwischendatei `<…>.kanbanD-tmp` in
/// `transkripte/<nr>/`, in die jedes weitere Stück direkt geht. Fällt der Empfang, ohne eingehängt zu werden, löscht er
/// seine Zwischendatei; Ordner baut nur [`Kanban::transkript_verwerfen`] unter der Sperre zurück.
#[derive(Debug)]
pub struct Empfang {
    wurzel: PathBuf,
    nr: u32,
    anfang: Vec<u8>,
    datei: Option<std::fs::File>,
    zwischen: Option<PathBuf>,
    bytes: u64,
    angelegt: Angelegt,
}

impl Empfang {
    pub fn neu(wurzel: &Path, nr: u32) -> Empfang {
        Empfang { wurzel: wurzel.to_path_buf(), nr, anfang: vec![], datei: None, zwischen: None, bytes: 0, angelegt: Angelegt::default() }
    }

    /// Ein Stück der Datei: 413 ab dem Byte über 10.485.760, 400 bei falschen Kennbytes, 500, wenn der Ordner nicht sicher ist.
    pub fn stueck(&mut self, stueck: &[u8]) -> Result<(), Fehler> {
        self.bytes += stueck.len() as u64;
        if self.bytes > TRANSKRIPT_HOECHSTENS {
            return Err(Fehler::ZuGross(format!("Das Transkript ist größer als {TRANSKRIPT_HOECHSTENS} Byte (10 MB, gezippt)")));
        }
        if let Some(datei) = &mut self.datei {
            return Ok(datei.write_all(stueck)?);
        }
        self.anfang.extend_from_slice(stueck);
        if self.anfang.len() < GZIP_KENNBYTES.len() {
            return Ok(());
        }
        if self.anfang[..GZIP_KENNBYTES.len()] != GZIP_KENNBYTES {
            return Err(kein_gzip());
        }
        self.oeffnen()?;
        let anfang = std::mem::take(&mut self.anfang);
        Ok(self.datei.as_mut().expect("eben geöffnet").write_all(&anfang)?)
    }

    /// Ordner und Zwischendatei außerhalb der Sperre. Baut ein gleichzeitig abgebrochener Upload den Ordner zwischen
    /// Anlegen und Zwischendatei zurück, legt dieser ihn neu an; „angelegt“ ist nur, was **sein** `create_dir` anlegte.
    fn oeffnen(&mut self) -> Result<(), Fehler> {
        for _ in 0..VERSUCHE_ORDNER {
            let (ordner, angelegt) = ordner_anlegen_mit(&self.wurzel, self.nr).map_err(|f| Fehler::Intern(f.meldung().to_string()))?;
            self.angelegt.oben |= angelegt.oben;
            self.angelegt.ordner |= angelegt.ordner;
            haken("empfang: Ordner da, Zwischendatei noch nicht");
            let pfad = ordner.join(format!("{}.kanbanD-tmp", zwischenname()));
            match std::fs::OpenOptions::new().write(true).create_new(true).open(&pfad) {
                Ok(datei) => {
                    self.zwischen = Some(pfad);
                    self.datei = Some(datei);
                    return Ok(());
                }
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
                Err(e) => return Err(e.into()),
            }
        }
        // nur, wenn ihn fünf gleichzeitig abgebrochene Uploads nacheinander entfernt haben — 500 wie jeder Dateifehler
        Err(Fehler::Intern(format!("{ORDNER}/{:04}/ wurde {VERSUCHE_ORDNER}-mal während des Hochladens entfernt — erneut hochladen", self.nr)))
    }

    /// Der Körper ist vollständig: leer oder kürzer als die Kennbytes → 400.
    fn abschliessen(&mut self) -> Result<(PathBuf, u64), Fehler> {
        let datei = self.datei.take().ok_or_else(kein_gzip)?;
        datei.sync_all()?;
        Ok((self.zwischen.clone().expect("mit der Datei angelegt"), self.bytes))
    }
}

impl Drop for Empfang {
    fn drop(&mut self) {
        if let Some(z) = self.zwischen.take() {
            let _ = std::fs::remove_file(z);
        }
    }
}

fn kein_gzip() -> Fehler {
    Fehler::Ungueltig("datei: keine gzip-Datei — erwartet .jsonl.gz, beginnend mit 1f 8b 08".into())
}

/// Eindeutig je Prozess und Upload: Prozess, Zeit in Nanosekunden und ein Zähler.
fn zwischenname() -> String {
    static ZAEHLER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let n = ZAEHLER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let zeit = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or_default();
    format!(".hochladen-{}-{zeit}-{n}", std::process::id())
}

impl Kanban {
    /// Der wirksame Schalter für die Aufgabe (ADR-0036 Regel 4) aus allen Boards (auch archivierten) und `kanbanD.md`.
    pub fn transkripte_erfassung(&self, nr: u32) -> Result<Erfassung, Fehler> {
        let (boards, _) = self.ordner().boards()?;
        let vorgabe = self.ordner().einstellungen()?.and_then(|e| e.transkripte_erfassen);
        Ok(crate::modell::erfassung(nr, &boards, vorgabe))
    }

    /// Stufe 1, **bevor der Körper gelesen wird** (ADR-0036 Regel 5): 404 unbekannte Nummer → 423 defekte Datei →
    /// 409 `{fehler, erfassung: "aus", boards}` → 409 Höchstzahl.
    pub fn transkript_vorpruefen(&self, nr: u32) -> Result<(), Fehler> {
        let a = self.ordner().aufgabe(nr)?;
        erfassung_verlangen(nr, self.transkripte_erfassung(nr)?)?;
        hoechstzahl_pruefen(nr, &a.transkripte)
    }

    /// Stufe 2, sobald alle drei Felder da sind und **bevor die Datei gelesen wird**: ihre Form (400), dann Kennung und
    /// gefalteter Name (409 `{fehler, kennung}`) gegen die Datei der Aufgabe. Stehen die Felder hinter der Datei, prüft
    /// nur [`Kanban::transkript_einhaengen`] — die Prüfung unter der Sperre bleibt in jedem Fall (Prüfen, dann Handeln).
    pub fn transkript_felder_vorpruefen(&self, nr: u32, angaben: &Ablageangaben) -> Result<(), Fehler> {
        if angaben.at.is_none() || angaben.role.is_none() || angaben.column.is_none() {
            return Ok(());
        }
        let neu = angaben.eintrag(0)?;
        kennung_frei(&self.ordner().aufgabe(nr)?.transkripte, &neu, nr)
    }

    /// Stufe 3 unter der Sperre (Prüfen-dann-Handeln): gegen die frisch gelesene Datei erneut Schalter (409), Felder und
    /// Spalte (400), Höchstzahl (409), Kennung und gefalteter Name (409 `{fehler, kennung}`); dann die Zwischendatei
    /// umbenennen, den Eintrag schreiben und **einen** Commit nur mit der Aufgabendatei. Jeder Fehler räumt die
    /// Zwischendatei und, was dieser Upload angelegt hat; scheitert der Commit, wird die umbenannte Datei entfernt.
    /// `sync_all` der Zwischendatei läuft vor der Sperre — sie wartet nicht auf die Platte (ADR-0032).
    pub fn transkript_einhaengen(&self, wer: &Person, nr: u32, angaben: &Ablageangaben, mut empfang: Empfang) -> Result<Transkripteintrag, Fehler> {
        let abgeschlossen = empfang.abschliessen();
        let _sperre = self.gesperrt();
        let ergebnis = abgeschlossen.and_then(|(zwischen, bytes)| self.einhaengen_gesperrt(wer, nr, angaben, &mut empfang, zwischen, bytes));
        if ergebnis.is_err() {
            verwerfen_gesperrt(&mut empfang);
        }
        ergebnis
    }

    /// Ein Upload, der vor dem Einhängen scheitert: Zwischendatei und, was er angelegt hat, unter der Sperre zurückbauen.
    pub fn transkript_verwerfen(&self, mut empfang: Empfang) {
        let _sperre = self.gesperrt();
        verwerfen_gesperrt(&mut empfang);
    }

    fn einhaengen_gesperrt(&self, wer: &Person, nr: u32, angaben: &Ablageangaben, empfang: &mut Empfang, zwischen: PathBuf, bytes: u64) -> Result<Transkripteintrag, Fehler> {
        let mut a = self.ordner().aufgabe(nr)?;
        erfassung_verlangen(nr, self.transkripte_erfassung(nr)?)?;
        let neu = angaben.eintrag(bytes)?;
        super::kosteneintraege::spalte_pruefen(PFAD, &neu.spalte, nr, &self.ordner().boards()?.0)?;
        hoechstzahl_pruefen(nr, &a.transkripte)?;
        kennung_frei(&a.transkripte, &neu, nr)?;
        let unsicher = |f: Pfadfehler| Fehler::Intern(format!("Transkript nicht abgelegt: {}", f.meldung()));
        ordner_anlegen(self.ordner().wurzel(), nr).map_err(unsicher)?;
        let ziel = datei(self.ordner().wurzel(), nr, &neu).map_err(unsicher)?;
        std::fs::rename(&zwischen, &ziel)?;
        empfang.zwischen = None;
        let nachricht = format!("#{nr} Transkript abgelegt: {}", crate::nachricht::wert(&neu.kennung()));
        a.transkripte.push(Transkriptzeile::Lesbar(neu.clone()));
        let pfad = format!("{}/{}", aufgabe::ORDNER, a.datei);
        if let Err(f) = self.aktion(wer, &nachricht, &[Schritt::schreiben(pfad, aufgabe::schreiben(&a))]) {
            // Gelingt die Rücknahme, steht der Eintrag nicht mehr in der Aufgabendatei — die Datei geht mit. Misslingt sie
            // (etwa weil `aufgaben/` nicht beschreibbar ist), bleibt die geänderte Aufgabendatei mit dem Eintrag stehen und
            // die Datei bei ihr: im Arbeitsbaum nie ein Eintrag ohne Datei.
            let kennung = neu.kennung();
            let eintrag_steht = self.ordner().aufgabe(nr).is_ok_and(|a| a.transkripte.iter().any(|z| z.lesbar().is_some_and(|e| e.kennung() == kennung)));
            if !eintrag_steht {
                let _ = std::fs::remove_file(&ziel);
            }
            return Err(f);
        }
        Ok(neu)
    }
}

/// Antwort von `GET …/transkripte` (ADR-0036 Regel 5): der Schalter vorab und je Eintrag sein Zustand.
#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct Transkriptliste {
    pub erfassen: bool,
    pub boards_aus: Vec<String>,
    pub transkripte: Vec<Transkriptstand>,
}

/// Ein Eintrag der Liste; ein formwidriger trägt nur, was als Text lesbar ist, und den Zustand `unlesbar`.
#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct Transkriptstand {
    pub kennung: Option<String>,
    pub at: Option<String>,
    pub role: Option<String>,
    pub column: Option<String>,
    pub bytes: Option<u64>,
    pub zustand: Transkriptzustand,
}

impl Transkriptstand {
    fn aus(z: &Transkriptzeile, zustand: Transkriptzustand) -> Transkriptstand {
        match z {
            Transkriptzeile::Lesbar(e) => Transkriptstand { kennung: Some(e.kennung()), at: Some(e.zeitpunkt.clone()), role: Some(e.rolle.clone()), column: Some(e.spalte.clone()), bytes: Some(e.bytes), zustand },
            Transkriptzeile::Unlesbar(v) => {
                let text = |k: &str| v.get(k).and_then(crate::format::yaml::wert_als_text);
                Transkriptstand { kennung: None, at: text("at"), role: text("role"), column: text("column"), bytes: v.get("bytes").and_then(serde_yaml::Value::as_u64), zustand }
            }
        }
    }
}

/// Der Zustand eines Eintrags aus den Metadaten der geöffneten Datei und drei Byte — ohne Entpacken (ADR-0036 Regel 5).
fn zustand(wurzel: &Path, nr: u32, z: &Transkriptzeile) -> Transkriptzustand {
    let Some(e) = z.lesbar() else { return Transkriptzustand::Unlesbar };
    let Ok(pfad) = datei(wurzel, nr, e) else { return Transkriptzustand::Unlesbar };
    let (mut f, m) = match lesend_oeffnen(&pfad) {
        Ok(offen) => offen,
        Err(f) if f.kind() == std::io::ErrorKind::NotFound => return Transkriptzustand::Fehlt,
        Err(_) => return Transkriptzustand::Unlesbar,
    };
    if m.len() > TRANSKRIPT_HOECHSTENS {
        return Transkriptzustand::Unlesbar;
    }
    if m.len() != e.bytes {
        return Transkriptzustand::Abweichend;
    }
    let mut kopf = [0u8; 3];
    match f.read_exact(&mut kopf) {
        Ok(()) if kopf == GZIP_KENNBYTES => Transkriptzustand::Vorhanden,
        _ => Transkriptzustand::Unlesbar,
    }
}

#[cfg(test)]
thread_local! {
    /// Zähler am einzigen Leseort (Lehre „Grenzen, die Arbeit begrenzen“): Byte, die [`Kanban::transkript_lesen`] las.
    static GELESEN: std::cell::Cell<u64> = const { std::cell::Cell::new(0) };
}

impl Kanban {
    /// `GET …/transkripte`: Schalter und Einträge in der Reihenfolge der Datei mit ihrem Zustand.
    pub fn transkripte_liste(&self, nr: u32) -> Result<Transkriptliste, Fehler> {
        let a = self.ordner().aufgabe(nr)?;
        let Erfassung { erfassen, boards_aus } = self.transkripte_erfassung(nr)?;
        let wurzel = self.ordner().wurzel();
        let transkripte = a.transkripte.iter().map(|z| Transkriptstand::aus(z, zustand(wurzel, nr, z))).collect();
        Ok(Transkriptliste { erfassen, boards_aus, transkripte })
    }

    /// `GET …/transkripte/{kennung}`: die Datei unverändert im Antwortbudget (ADR-0036 Regel 6) — der Platz wird nach der
    /// Größe des Eintrags belegt, **bevor** gelesen wird; passt sie nicht, sofort 503. Liefert Rumpf und Dateinamen.
    /// Die Kennung der Adresse wird nur mit Einträgen verglichen, nie zu einem Pfad (Regel 7).
    pub fn transkript_lesen(&self, nr: u32, kennung: &str) -> Result<(Rumpf, String), Fehler> {
        let a = self.ordner().aufgabe(nr)?;
        let zeile = a.transkripte.iter().find(|z| z.lesbar().is_some_and(|e| e.kennung() == kennung)).ok_or_else(|| Fehler::NichtGefunden(format!("#{nr} hat kein Transkript {}", crate::nachricht::wert(kennung))))?;
        let e = zeile.lesbar().expect("gefunden als lesbar");
        let wurzel = self.ordner().wurzel();
        let stand = zustand(wurzel, nr, zeile);
        if stand != Transkriptzustand::Vorhanden {
            return Err(nicht_lieferbar(nr, kennung, stand));
        }
        let platz = self.antwortbudget.platz(e.bytes as usize).ok_or_else(|| Fehler::Ausgelastet(format!("Antwortbudget von {} MB belegt — Transkript in einigen Sekunden erneut laden", super::antwortbudget::ANTWORTBUDGET >> 20)))?;
        let pfad = datei(wurzel, nr, e).map_err(|_| nicht_lieferbar(nr, kennung, Transkriptzustand::Unlesbar))?;
        let mut bytes = Vec::with_capacity(e.bytes as usize);
        let (f, m) = lesend_oeffnen(&pfad).map_err(|_| nicht_lieferbar(nr, kennung, Transkriptzustand::Unlesbar))?;
        if m.len() != e.bytes {
            return Err(nicht_lieferbar(nr, kennung, Transkriptzustand::Abweichend));
        }
        f.take(e.bytes).read_to_end(&mut bytes)?;
        #[cfg(test)]
        GELESEN.with(|g| g.set(g.get() + bytes.len() as u64));
        if bytes.len() as u64 != e.bytes {
            return Err(nicht_lieferbar(nr, kennung, Transkriptzustand::Abweichend));
        }
        Ok((platz.rumpf(bytes), e.dateiname()))
    }
}

impl Kanban {
    /// `DELETE …/transkripte/{kennung}` (ADR-0036 Regel 5): erst den Eintrag entfernen und committen, danach die Datei
    /// löschen — beides unter **einer** Sperre, damit ein gleichzeitiger Upload derselben Kennung seine Datei behält.
    /// Fehlt sie oder ist ihr Pfad nicht sicher (Symlink), bleibt es beim Eintrag. Geht auch bei „aus“.
    pub fn transkript_loeschen(&self, wer: &Person, nr: u32, kennung: &str) -> Result<Transkripteintrag, Fehler> {
        let _sperre = self.gesperrt();
        let mut a = self.ordner().aufgabe(nr)?;
        let i = a.transkripte.iter().position(|z| z.lesbar().is_some_and(|e| e.kennung() == kennung)).ok_or_else(|| Fehler::NichtGefunden(format!("#{nr} hat kein Transkript {}", crate::nachricht::wert(kennung))))?;
        let Transkriptzeile::Lesbar(e) = a.transkripte.remove(i) else { unreachable!("als lesbar gefunden") };
        let nachricht = format!("#{nr} Transkript entfernt: {}", crate::nachricht::wert(&e.kennung()));
        self.aktion(wer, &nachricht, &[Schritt::schreiben(format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(&a))])?;
        haken("löschen: Eintrag committet, Datei noch da");
        if let Ok(pfad) = datei(self.ordner().wurzel(), nr, &e) {
            let _ = std::fs::remove_file(pfad);
        }
        Ok(e)
    }
}

/// Endgültig löschen (ADR-0036 Regel 9): `transkripte/<nr4>/` ganz entfernen, ohne einem Symlink zu folgen. Ist eine
/// Ebene ein Symlink, bleibt alles stehen; der Grund geht als Warnzeile ins Protokoll (X00002).
pub(crate) fn ordner_raeumen(wurzel: &Path, nr: u32) -> Result<(), String> {
    let ordner = aufgabenordner(wurzel, nr).map_err(|f| f.meldung().to_string())?;
    match std::fs::remove_dir_all(&ordner) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("{ORDNER}/{nr:04}/ ließ sich nicht entfernen: {e}")),
    }
}

/// Öffnet die Datei eines Eintrags zum Lesen, ohne einem Symlink zu folgen, der nach der Prüfung an ihre Stelle trat
/// (TOCTOU): vor dem Öffnen eine gewöhnliche Datei laut `symlink_metadata`, danach dieselbe Datei (Gerät und Inode) laut
/// Metadaten am Handle — sonst ein Fehler. Gelesen wird nur über das Handle, die Metadaten sind die des Handles.
fn lesend_oeffnen(pfad: &Path) -> std::io::Result<(std::fs::File, std::fs::Metadata)> {
    let vorher = std::fs::symlink_metadata(pfad)?;
    if !vorher.is_file() {
        return Err(std::io::Error::other("keine gewöhnliche Datei"));
    }
    haken("lesen: geprüft, noch nicht geöffnet");
    let f = std::fs::File::open(pfad)?;
    let m = f.metadata()?;
    if !m.is_file() || !dieselbe_datei(&vorher, &m) {
        return Err(std::io::Error::other("zwischen Prüfen und Öffnen ersetzt"));
    }
    Ok((f, m))
}

#[cfg(unix)]
fn dieselbe_datei(a: &std::fs::Metadata, b: &std::fs::Metadata) -> bool {
    use std::os::unix::fs::MetadataExt;
    a.dev() == b.dev() && a.ino() == b.ino()
}

/// Ohne Inode bleibt die Prüfung, dass das Handle eine gewöhnliche Datei der erwarteten Größe zeigt.
#[cfg(not(unix))]
fn dieselbe_datei(a: &std::fs::Metadata, b: &std::fs::Metadata) -> bool {
    a.len() == b.len()
}

fn nicht_lieferbar(nr: u32, kennung: &str, zustand: Transkriptzustand) -> Fehler {
    let wie = match zustand {
        Transkriptzustand::Fehlt => "liegt nicht auf diesem Rechner",
        Transkriptzustand::Abweichend => "hat nicht die eingetragene Größe",
        _ => "ist nicht lesbar",
    };
    Fehler::Transkriptzustand { meldung: format!("Das Transkript {} von #{nr} {wie}", crate::nachricht::wert(kennung)), zustand }
}

fn erfassung_verlangen(nr: u32, e: Erfassung) -> Result<(), Fehler> {
    if e.erfassen {
        return Ok(());
    }
    let wo = if e.boards_aus.is_empty() { "in der Vorgabe des Ordners (kanbanD.md)".to_string() } else { format!("auf {}", e.boards_aus.join(", ")) };
    Err(Fehler::ErfassungAus { meldung: format!("Transkripte erfassen ist für #{nr} aus ({wo}) — nichts abgelegt"), boards: e.boards_aus })
}

fn hoechstzahl_pruefen(nr: u32, zeilen: &[Transkriptzeile]) -> Result<(), Fehler> {
    if zeilen.len() >= HOECHSTZAHL_TRANSKRIPTE {
        return Err(Fehler::Konflikt(format!("#{nr} trägt schon {HOECHSTZAHL_TRANSKRIPTE} Transkripte — mehr nimmt eine Aufgabe nicht auf")));
    }
    Ok(())
}

/// ADR-0036 Regel 2: gleiche Kennung oder gleicher gefalteter Name an derselben Aufgabe → 409 mit der Kennung des
/// Eintrags, der im Weg steht. Ein Durchgang über die Einträge, je Eintrag einmal Kennung und Name.
fn kennung_frei(zeilen: &[Transkriptzeile], neu: &Transkripteintrag, nr: u32) -> Result<(), Fehler> {
    let (kennung, name) = (neu.kennung(), neu.dateiname());
    for e in zeilen.iter().filter_map(Transkriptzeile::lesbar) {
        let k = e.kennung();
        if k == kennung || e.dateiname() == name {
            let wie = if k == kennung { "hat schon ein Transkript".to_string() } else { format!("hat schon ein Transkript mit demselben Dateinamen ({name})") };
            return Err(Fehler::KennungBelegt { meldung: format!("#{nr} {wie} {k} — einen zweiten Lauf derselben Rolle in derselben Minute eine Minute später ablegen"), kennung: k });
        }
    }
    Ok(())
}

/// Zwischendatei löschen; Ordner, die dieser Upload angelegt hat, entfernen, wenn sie leer sind — `transkripte/` nur,
/// wenn darin nichts außer der eigenen `.gitignore` liegt. Nur unter der Sperre: ein gleichzeitiger Upload legt seine
/// Datei erst unter ihr ab und prüft die `.gitignore` dort erneut.
fn verwerfen_gesperrt(empfang: &mut Empfang) {
    if let Some(z) = empfang.zwischen.take() {
        let _ = std::fs::remove_file(z);
    }
    let oben = empfang.wurzel.join(ORDNER);
    if empfang.angelegt.ordner {
        let _ = std::fs::remove_dir(oben.join(format!("{:04}", empfang.nr)));
    }
    if empfang.angelegt.oben {
        let nur_gitignore = std::fs::read_dir(&oben).is_ok_and(|d| d.flatten().all(|e| e.file_name() == ".gitignore"));
        if nur_gitignore {
            let _ = std::fs::remove_file(oben.join(".gitignore"));
            let _ = std::fs::remove_dir(&oben);
        }
    }
}

/// Warum zu einem Eintrag kein sicherer Pfad entsteht. Für die Liste heißt jeder Fall `unlesbar`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Pfadfehler {
    /// Der gefaltete Name passt nicht auf das Muster — darf nicht vorkommen, ist die zweite Linie.
    Muster(String),
    /// `transkripte/`, `transkripte/<nr>/` oder die Datei ist ein Symlink oder hat die falsche Art.
    Unsicher(String),
}

impl Pfadfehler {
    pub(crate) fn meldung(&self) -> &str {
        match self {
            Pfadfehler::Muster(m) | Pfadfehler::Unsicher(m) => m,
        }
    }
}

/// Der eine Ort, an dem ein Pfad unter `transkripte/` entsteht (ADR-0036 Regel 7): `<wurzel>/transkripte/<nr4>/<name>`.
/// Prüft den Namen gegen `^[a-z0-9-]{1,60}@\d{4}-\d{2}-\d{2}T\d{4}[+-]\d{4}\.jsonl\.gz$` und dass `transkripte/` und
/// `transkripte/<nr4>/` keine Symlinks und, wenn vorhanden, Ordner sind und die Datei, wenn vorhanden, kein Symlink ist.
/// Was fehlt, ist kein Fehler — ob die Datei da ist, entscheidet der Aufrufer.
pub(crate) fn datei(wurzel: &Path, nr: u32, eintrag: &Transkripteintrag) -> Result<PathBuf, Pfadfehler> {
    let name = eintrag.dateiname();
    if !name_passt(&name) {
        return Err(Pfadfehler::Muster(format!("Programmfehler: Dateiname „{name}“ passt nicht auf das Muster der Transkripte")));
    }
    let ordner = aufgabenordner(wurzel, nr)?;
    let pfad = ordner.join(&name);
    if std::fs::symlink_metadata(&pfad).is_ok_and(|m| !m.is_file()) {
        return Err(Pfadfehler::Unsicher(format!("{ORDNER}/{nr:04}/{name} ist keine gewöhnliche Datei")));
    }
    Ok(pfad)
}

/// `<wurzel>/transkripte/<nr4>` nach der Prüfung beider Ebenen; fehlt eine, ist das kein Fehler.
pub(crate) fn aufgabenordner(wurzel: &Path, nr: u32) -> Result<PathBuf, Pfadfehler> {
    let oben = wurzel.join(ORDNER);
    ordner_pruefen(&oben, ORDNER)?;
    let ordner = oben.join(format!("{nr:04}"));
    ordner_pruefen(&ordner, &format!("{ORDNER}/{nr:04}"))?;
    Ok(ordner)
}

/// Legt `transkripte/` mit seiner `.gitignore` und `transkripte/<nr4>/` an, wo sie fehlen — eine vorhandene `.gitignore`
/// bleibt, wie sie ist (Regel 1), außer sie ist leer. Danach dieselbe Prüfung wie [`aufgabenordner`].
pub(crate) fn ordner_anlegen(wurzel: &Path, nr: u32) -> Result<PathBuf, Pfadfehler> {
    ordner_anlegen_mit(wurzel, nr).map(|(ordner, _)| ordner)
}

/// Wie [`ordner_anlegen`], dazu, welche Ebene **dieser** Aufruf angelegt hat.
fn ordner_anlegen_mit(wurzel: &Path, nr: u32) -> Result<(PathBuf, Angelegt), Pfadfehler> {
    let mut angelegt = Angelegt::default();
    let unsicher = |e: std::io::Error| Pfadfehler::Unsicher(format!("{ORDNER}/ lässt sich nicht anlegen: {e}"));
    let oben = wurzel.join(ORDNER);
    ordner_pruefen(&oben, ORDNER)?;
    match std::fs::create_dir(&oben) {
        Ok(()) => angelegt.oben = true,
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(e) => return Err(unsicher(e)),
    }
    ordner_pruefen(&oben, ORDNER)?;
    let ignorieren = oben.join(".gitignore");
    let fehlt_oder_leer = match std::fs::symlink_metadata(&ignorieren) {
        Err(e) => e.kind() == std::io::ErrorKind::NotFound,
        Ok(m) => m.is_file() && m.len() <= 64 && std::fs::read_to_string(&ignorieren).is_ok_and(|t| t.trim().is_empty()),
    };
    if fehlt_oder_leer {
        gitignore_schreiben(&oben).map_err(unsicher)?;
    }
    let ordner = oben.join(format!("{nr:04}"));
    match std::fs::create_dir(&ordner) {
        Ok(()) => angelegt.ordner = true,
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(e) => return Err(unsicher(e)),
    }
    Ok((aufgabenordner(wurzel, nr)?, angelegt))
}

/// `transkripte/.gitignore` über eine Zwischendatei und Umbenennen: es gibt nie eine leere oder halbe `.gitignore`, auch
/// wenn der Prozess oder der Plattenplatz mittendrin endet. Ersetzt eine leere (Rest eines Abbruchs der Vorversion).
fn gitignore_schreiben(oben: &Path) -> std::io::Result<()> {
    let zwischen = oben.join(format!("{}.kanbanD-tmp", zwischenname()));
    let geschrieben = std::fs::OpenOptions::new().write(true).create_new(true).open(&zwischen).and_then(|mut f| {
        f.write_all(GITIGNORE.as_bytes())?;
        f.sync_all()
    });
    let ergebnis = geschrieben.and_then(|()| std::fs::rename(&zwischen, oben.join(".gitignore")));
    if ergebnis.is_err() {
        let _ = std::fs::remove_file(&zwischen);
    }
    ergebnis
}

/// Ein vorhandener Pfad muss ein echter Ordner sein (kein Symlink); ein fehlender ist in Ordnung.
fn ordner_pruefen(pfad: &Path, anzeige: &str) -> Result<(), Pfadfehler> {
    match std::fs::symlink_metadata(pfad) {
        Ok(m) if m.file_type().is_symlink() => Err(Pfadfehler::Unsicher(format!("{anzeige} ist ein Symlink — kanbanD folgt ihm nicht"))),
        Ok(m) if !m.is_dir() => Err(Pfadfehler::Unsicher(format!("{anzeige} ist kein Ordner"))),
        _ => Ok(()),
    }
}

/// `^[a-z0-9-]{1,60}@\d{4}-\d{2}-\d{2}T\d{4}[+-]\d{4}\.jsonl\.gz$` ohne Regex-Bibliothek.
fn name_passt(name: &str) -> bool {
    let Some((rolle, rest)) = name.split_once('@') else { return false };
    let rolle_passt = (1..=60).contains(&rolle.len()) && rolle.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-');
    let Some(zeit) = rest.strip_suffix(".jsonl.gz") else { return false };
    let z = zeit.as_bytes();
    let ziffern = |von: usize, bis: usize| z[von..bis].iter().all(u8::is_ascii_digit);
    rolle_passt && z.len() == 20 && ziffern(0, 4) && z[4] == b'-' && ziffern(5, 7) && z[7] == b'-' && ziffern(8, 10) && z[10] == b'T' && ziffern(11, 15) && (z[15] == b'+' || z[15] == b'-') && ziffern(16, 20)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn eintrag(rolle: &str) -> Transkripteintrag {
        Transkripteintrag::neu("t", Some("2026-11-13 10:34+01:00"), Some(rolle), Some("E"), 1).unwrap()
    }

    /// Ein Board-Ordner mit #1 in fabrik/Entwicklung, `entwickler` (Agent) und der Vorgabe `record-transcripts: true`.
    fn ordner() -> (tempfile::TempDir, Kanban, Person) {
        let w = tempfile::tempdir().unwrap();
        let p = w.path();
        std::fs::create_dir_all(p.join("aufgaben")).unwrap();
        std::fs::create_dir_all(p.join("boards")).unwrap();
        std::fs::write(p.join("kanbanD.md"), "---\nrecord-transcripts: true\npeople:\n  entwickler: {name: Entwickler, kind: agent}\n---\n").unwrap();
        std::fs::write(p.join("aufgaben/0001-a.md"), "---\nid: 1\ntitle: a\n---\n").unwrap();
        std::fs::write(p.join("boards/fabrik.md"), "# Fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-a.md)\n").unwrap();
        for args in [&["init", "-q"][..], &["add", "-A"], &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "a"]] {
            std::process::Command::new("git").arg("-C").arg(p).args(args).output().unwrap();
        }
        let k = Kanban::neu(p.to_path_buf());
        let wer = k.handelnder(Some("entwickler")).unwrap();
        (w, k, wer)
    }

    fn angaben() -> Ablageangaben {
        Ablageangaben { at: Some("2026-11-13 10:34+01:00".into()), role: Some("entwickler".into()), column: Some("Entwicklung".into()) }
    }

    /// Der Eintrag, den ein Upload mit [`angaben`] ablegt — `at` in Ortszeit des Rechners umgerechnet, daher nicht fest
    /// verdrahtet: der Runner läuft in UTC, der Entwicklerrechner in Europe/Berlin.
    fn abgelegt() -> Transkripteintrag {
        angaben().eintrag(1).unwrap()
    }

    fn empfangen(k: &Kanban) -> Empfang {
        k.transkript_vorpruefen(1).unwrap();
        let mut e = Empfang::neu(k.ordner().wurzel(), 1);
        e.stueck(&[0x1f, 0x8b, 0x08, 1, 2, 3]).unwrap();
        e
    }

    fn dateien(w: &Path) -> Vec<String> {
        let mut d: Vec<String> = std::fs::read_dir(w.join("transkripte/0001")).map(|d| d.flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect()).unwrap_or_default();
        d.sort();
        d
    }

    fn git_status(w: &Path) -> String {
        let a = std::process::Command::new("git").arg("-C").arg(w).args(["status", "--porcelain", "--untracked-files=all"]).output().unwrap();
        String::from_utf8_lossy(&a.stdout).into_owned()
    }

    fn zwischendateien(w: &Path) -> usize {
        dateien(w).iter().filter(|d| d.ends_with(".kanbanD-tmp")).count()
    }

    // Nacharbeit 1 #208 (code-reviewer, Testlücke): bricht der Client ab, fällt der Empfang ohne Einhängen — er löscht
    // seine Zwischendatei; was bleibt, ist ignoriert
    #[test]
    fn abbruch_durch_den_client_raeumt_die_zwischendatei() {
        let (w, k, _) = ordner();
        let e = empfangen(&k);
        assert_eq!(zwischendateien(w.path()), 1);
        drop(e);
        assert_eq!(zwischendateien(w.path()), 0);
        assert_eq!(git_status(w.path()), "");
    }

    fn haken_setzen(stelle: &'static str, handlung: impl FnOnce() + 'static) {
        HAKEN.with(|h| h.borrow_mut().insert(stelle, Box::new(handlung)));
    }

    // Nacharbeit 1 #208 (code- und security-reviewer Sollte, Empfang::oeffnen): bricht ein Upload ab, der den Ordner
    // angelegt hat, während ein zweiter den Ordner schon gesehen, aber seine Zwischendatei noch nicht angelegt hat, darf
    // der zweite daran nicht scheitern (vorher: io-Fehler → 500). Danach baut jeder nur ab, was er selbst angelegt hat.
    #[test]
    fn abbruch_des_ersten_entzieht_dem_zweiten_den_ordner_nicht() {
        for zweiter_haengt_ein in [true, false] {
            let (w, k, wer) = ordner();
            let mut erster = empfangen(&k);
            haken_setzen("empfang: Ordner da, Zwischendatei noch nicht", move || verwerfen_gesperrt(&mut erster));
            let mut zweiter = Empfang::neu(k.ordner().wurzel(), 1);
            let r = zweiter.stueck(&[0x1f, 0x8b, 0x08, 7]);
            assert!(r.is_ok(), "zweiter Upload nach dem Abbruch des ersten: {r:?}");
            assert_eq!(zwischendateien(w.path()), 1, "nur die Zwischendatei des zweiten");
            if zweiter_haengt_ein {
                assert!(k.transkript_einhaengen(&wer, 1, &angaben(), zweiter).is_ok());
                assert_eq!(dateien(w.path()), [abgelegt().dateiname()]);
                assert_eq!(std::fs::read_to_string(w.path().join("transkripte/.gitignore")).unwrap(), "*\n");
            } else {
                k.transkript_verwerfen(zweiter);
                assert!(!w.path().join("transkripte").exists(), "der zweite hat den Ordner neu angelegt und baut ihn zurück");
            }
            assert_eq!(git_status(w.path()), "");
        }
    }

    // Nacharbeit 1 #208 (code-reviewer Sollte, transkript_loeschen): ein Upload derselben Kennung, der zwischen dem Commit
    // des Löschens und dem Entfernen der Datei eingehängt wird, verlor seine Datei — Eintrag ohne Datei. Jetzt entfernt
    // das Löschen die Datei unter der Sperre; der Upload wartet und behält Eintrag und Datei.
    #[test]
    fn loeschen_nimmt_einem_gleichzeitigen_upload_die_datei_nicht() {
        let (w, k, wer) = ordner();
        let alt = k.transkript_einhaengen(&wer, 1, &angaben(), empfangen(&k)).unwrap();
        let neu = empfangen(&k);
        let (committet, auf_commit_warten) = std::sync::mpsc::channel::<()>();
        let (eingehaengt, auf_upload_warten) = std::sync::mpsc::channel::<()>();
        std::thread::scope(|s| {
            let (k, wer) = (&k, &wer);
            let upload = s.spawn(move || {
                auf_commit_warten.recv().unwrap();
                let r = k.transkript_einhaengen(wer, 1, &angaben(), neu);
                let _ = eingehaengt.send(());
                r
            });
            haken_setzen("löschen: Eintrag committet, Datei noch da", move || {
                committet.send(()).unwrap();
                // mit Sperre wartet der Upload; ohne hängt er hier ein, und das Löschen entfernt danach seine Datei
                let _ = auf_upload_warten.recv_timeout(std::time::Duration::from_millis(1500));
            });
            k.transkript_loeschen(wer, 1, &alt.kennung()).unwrap();
            assert!(upload.join().unwrap().is_ok());
        });
        assert_eq!(k.ordner().aufgabe(1).unwrap().transkripte.len(), 1, "der Eintrag des Uploads");
        assert_eq!(dateien(w.path()), [abgelegt().dateiname()], "und seine Datei");
        assert_eq!(git_status(w.path()), "");
    }

    // Nacharbeit 1 #208 (security-reviewer Sollte 2, TOCTOU): wird die geprüfte Datei zwischen Prüfen und Öffnen durch
    // einen Symlink nach außen ersetzt, liefert weder die Liste noch das Herunterladen den fremden Inhalt
    #[cfg(unix)]
    #[test]
    fn symlink_zwischen_pruefen_und_oeffnen() {
        for weg in ["liste", "herunterladen"] {
            let (w, k, wer) = ordner();
            let e = k.transkript_einhaengen(&wer, 1, &angaben(), empfangen(&k)).unwrap();
            let aussen = tempfile::tempdir().unwrap();
            let fremd = aussen.path().join("fremd");
            std::fs::write(&fremd, [0x1f, 0x8b, 0x08, 9, 9, 9]).unwrap();
            let datei = w.path().join("transkripte/0001").join(e.dateiname());
            haken_setzen("lesen: geprüft, noch nicht geöffnet", move || {
                std::fs::remove_file(&datei).unwrap();
                std::os::unix::fs::symlink(&fremd, &datei).unwrap();
            });
            if weg == "liste" {
                let liste = k.transkripte_liste(1).unwrap();
                assert_eq!(liste.transkripte[0].zustand, Transkriptzustand::Unlesbar, "{weg}");
            } else {
                let r = k.transkript_lesen(1, &e.kennung());
                assert!(matches!(r, Err(Fehler::Transkriptzustand { zustand: Transkriptzustand::Unlesbar, .. })), "{weg}: {:?}", r.map(|(rumpf, _)| rumpf.bytes));
            }
        }
    }

    // Nacharbeit 1 #208 (code-reviewer Testlücke, observability-reviewer Sollte), R00233 AK 7: scheitert der Commit, gibt
    // es im Arbeitsbaum weder einen Eintrag ohne Datei noch eine Datei ohne Eintrag. Gelingt die Rücknahme (Haken
    // pre-commit, fremde `.git/index.lock` seit ADR-0005 N4), ist alles wie vorher; misslingt sie (ein Haken nimmt
    // `aufgaben/` das Schreibrecht), bleibt die Aufgabendatei geändert — dann bleibt auch die Datei.
    #[cfg(unix)]
    #[test]
    fn gescheiterter_commit_laesst_eintrag_und_datei_zusammen() {
        use std::os::unix::fs::PermissionsExt;
        let haken_setzen = |w: &Path, rumpf: &str| {
            let haken = w.join(".git/hooks/pre-commit");
            std::fs::write(&haken, format!("#!/bin/sh\n{rumpf}exit 1\n")).unwrap();
            std::fs::set_permissions(&haken, std::fs::Permissions::from_mode(0o755)).unwrap();
        };
        for (wie, ruecknahme_gelingt) in [("pre-commit", true), ("index.lock", true), ("aufgaben/ schreibgeschützt", false)] {
            let (w, k, wer) = ordner();
            let vorher = std::fs::read_to_string(w.path().join("aufgaben/0001-a.md")).unwrap();
            let sperre = w.path().join(".git/index.lock");
            match wie {
                "pre-commit" => haken_setzen(w.path(), ""),
                "aufgaben/ schreibgeschützt" => haken_setzen(w.path(), "chmod 0555 aufgaben\n"),
                _ => {}
            }
            let e = empfangen(&k);
            if wie == "index.lock" {
                std::fs::write(&sperre, "").unwrap();
            }
            let f = k.transkript_einhaengen(&wer, 1, &angaben(), e).unwrap_err();
            if wie == "index.lock" {
                std::fs::remove_file(&sperre).unwrap();
            }
            std::fs::set_permissions(w.path().join("aufgaben"), std::fs::Permissions::from_mode(0o755)).unwrap();
            assert!(matches!(f, Fehler::Intern(_)), "{wie}: {f:?}");
            assert_eq!(f.meldung().contains("Rücknahme unvollständig"), !ruecknahme_gelingt, "{wie}: {f:?}");
            let eintrag_da = k.ordner().aufgabe(1).unwrap().transkripte.len() == 1;
            assert_eq!(eintrag_da, !ruecknahme_gelingt, "{wie}");
            let datei_da = dateien(w.path()) == [abgelegt().dateiname()];
            assert_eq!(datei_da, eintrag_da, "{wie}: Eintrag und Datei zusammen — {:?}", dateien(w.path()));
            assert_eq!(zwischendateien(w.path()), 0, "{wie}");
            assert!(!w.path().join("aufgaben/0001-a.kanbanD-tmp").exists(), "{wie}: keine Nachbardatei der Rücknahme");
            if ruecknahme_gelingt {
                assert_eq!(std::fs::read_to_string(w.path().join("aufgaben/0001-a.md")).unwrap(), vorher, "{wie}");
                assert_eq!(git_status(w.path()), "", "{wie}");
            }
        }
    }

    // Prüfen-dann-Handeln (ADR-0036 Regel 5): zwei Uploads derselben Kennung haben beide die Vorprüfung und die
    // Zwischendatei hinter sich; unter der Sperre gewinnt genau einer, der zweite räumt seine Zwischendatei
    #[test]
    fn zwei_uploads_derselben_kennung_ergeben_genau_einen_eintrag() {
        let (w, k, wer) = ordner();
        let (erster, zweiter) = (empfangen(&k), empfangen(&k));
        assert_eq!(dateien(w.path()).iter().filter(|d| d.ends_with(".kanbanD-tmp")).count(), 2, "beide Zwischendateien liegen");
        assert!(k.transkript_einhaengen(&wer, 1, &angaben(), erster).is_ok());
        let f = k.transkript_einhaengen(&wer, 1, &angaben(), zweiter).unwrap_err();
        assert!(matches!(&f, Fehler::KennungBelegt { kennung, .. } if *kennung == abgelegt().kennung()), "{f:?}");
        assert_eq!(dateien(w.path()), [abgelegt().dateiname()]);
        assert_eq!(k.ordner().aufgabe(1).unwrap().transkripte.len(), 1);
    }

    // Prüfen-dann-Handeln: wird der Schalter zwischen Vorprüfung und Sperre ausgeschaltet, gilt der frisch gelesene Wert —
    // 409, und der Upload baut zurück, was er angelegt hat (auch transkripte/ mit seiner .gitignore)
    #[test]
    fn ausgeschaltet_zwischen_vorpruefung_und_sperre() {
        let (w, k, wer) = ordner();
        let e = empfangen(&k);
        assert!(w.path().join("transkripte/.gitignore").exists());
        std::fs::write(w.path().join("kanbanD.md"), "---\nrecord-transcripts: false\npeople:\n  entwickler: {name: Entwickler, kind: agent}\n---\n").unwrap();
        let f = k.transkript_einhaengen(&wer, 1, &angaben(), e).unwrap_err();
        assert!(matches!(&f, Fehler::ErfassungAus { boards, .. } if boards == &["fabrik".to_string()]), "{f:?}");
        assert!(!w.path().join("transkripte").exists(), "zurückgebaut");
        assert!(k.ordner().aufgabe(1).unwrap().transkripte.is_empty());
    }

    // R00216 AK 12 · US-6 (ADR-0032 N5.1, ADR-0036 Regel 6): mit 12 MB Budget passt eine Lesung von 10 MB, die zweite
    // ergibt sofort 503, ohne ein Byte gelesen zu haben; nach dem Ende der ersten geht sie
    #[test]
    fn volles_antwortbudget_vor_dem_lesen() {
        let (w, mut k, wer) = ordner();
        k.antwortbudget = super::super::antwortbudget::Antwortbudget::mit(12 << 20);
        let mut e = Empfang::neu(w.path(), 1);
        let mut zehn = vec![0x5a; TRANSKRIPT_HOECHSTENS as usize];
        zehn[..3].copy_from_slice(&GZIP_KENNBYTES);
        e.stueck(&zehn).unwrap();
        let eintrag = k.transkript_einhaengen(&wer, 1, &angaben(), e).unwrap();
        GELESEN.with(|g| g.set(0));
        let (erste, _) = k.transkript_lesen(1, &eintrag.kennung()).unwrap();
        assert_eq!(GELESEN.with(|g| g.get()), TRANSKRIPT_HOECHSTENS, "die erste Lesung liest die Datei");
        GELESEN.with(|g| g.set(0));
        let f = k.transkript_lesen(1, &eintrag.kennung()).unwrap_err();
        assert!(matches!(&f, Fehler::Ausgelastet(m) if m.starts_with("Antwortbudget")), "{f:?}");
        assert_eq!(GELESEN.with(|g| g.get()), 0, "bei 503 kein Byte gelesen");
        assert_eq!(erste.bytes, zehn);
        drop(erste);
        assert!(k.transkript_lesen(1, &eintrag.kennung()).is_ok(), "nach der ersten Lesung wieder frei");
    }

    #[test]
    fn muster_der_dateinamen() {
        for gut in ["entwickler@2026-11-13T1034+0100.jsonl.gz", "a@0000-00-00T0000-9999.jsonl.gz", &format!("{}@2026-11-13T1034+0100.jsonl.gz", "a".repeat(60))] {
            assert!(name_passt(gut), "{gut}");
        }
        for schlecht in ["", "@2026-11-13T1034+0100.jsonl.gz", "../x@2026-11-13T1034+0100.jsonl.gz", "a/b@2026-11-13T1034+0100.jsonl.gz", "A@2026-11-13T1034+0100.jsonl.gz", &format!("{}@2026-11-13T1034+0100.jsonl.gz", "a".repeat(61)), "a@2026-11-13T10:34+01:00.jsonl.gz", "a@2026-11-13T1034+0100.jsonl", "a@2026-11-13T1034+0100.jsonl.gz/", "a@b@2026-11-13T1034+0100.jsonl.gz", "a@2026-11-13T1034 0100.jsonl.gz"] {
            assert!(!name_passt(schlecht), "{schlecht}");
        }
    }

    #[test]
    fn pfad_unter_dem_ordner_der_aufgabe() {
        let w = tempfile::tempdir().unwrap();
        assert_eq!(datei(w.path(), 1, &eintrag("../../x")).unwrap(), w.path().join("transkripte/0001/x@2026-11-13T1034+0100.jsonl.gz"));
        assert!(!w.path().join("transkripte").exists(), "nur rechnen, nichts anlegen");
        assert_eq!(datei(w.path(), 208, &eintrag("Code Reviewer")).unwrap(), w.path().join("transkripte/0208/code-reviewer@2026-11-13T1034+0100.jsonl.gz"));
    }

    // R00216 AK 2, ADR-0036 Regel 1: `.gitignore` anlegen, wenn sie fehlt; eine vorhandene bleibt byte-gleich
    #[test]
    fn ordner_anlegen_schreibt_die_gitignore_nur_einmal() {
        let w = tempfile::tempdir().unwrap();
        assert_eq!(ordner_anlegen(w.path(), 1).unwrap(), w.path().join("transkripte/0001"));
        assert_eq!(std::fs::read_to_string(w.path().join("transkripte/.gitignore")).unwrap(), "*\n");
        std::fs::write(w.path().join("transkripte/.gitignore"), "# von Hand\n*\n").unwrap();
        ordner_anlegen(w.path(), 2).unwrap();
        assert_eq!(std::fs::read_to_string(w.path().join("transkripte/.gitignore")).unwrap(), "# von Hand\n*\n");
        assert!(w.path().join("transkripte/0002").is_dir());
        // Nacharbeit 1 #208: eine leere (Rest eines Abbruchs) wird ersetzt, ohne Zwischendatei zu hinterlassen
        std::fs::write(w.path().join("transkripte/.gitignore"), "").unwrap();
        ordner_anlegen(w.path(), 3).unwrap();
        assert_eq!(std::fs::read_to_string(w.path().join("transkripte/.gitignore")).unwrap(), "*\n");
        let mut namen: Vec<String> = std::fs::read_dir(w.path().join("transkripte")).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect();
        namen.sort();
        assert_eq!(namen, [".gitignore", "0001", "0002", "0003"]);
    }

    // R00216 AK 9c/9d, ADR-0036 Regel 7: ein Symlink auf jeder Ebene wird abgewiesen, ohne ihm zu folgen
    #[cfg(unix)]
    #[test]
    fn symlinks_auf_jeder_ebene_werden_abgewiesen() {
        use std::os::unix::fs::symlink;
        let aussen = tempfile::tempdir().unwrap();
        let unsicher = |r: Result<PathBuf, Pfadfehler>| matches!(r, Err(Pfadfehler::Unsicher(_)));

        let w = tempfile::tempdir().unwrap();
        std::fs::create_dir(w.path().join("transkripte")).unwrap();
        symlink(aussen.path(), w.path().join("transkripte/0001")).unwrap();
        assert!(unsicher(datei(w.path(), 1, &eintrag("x"))), "transkripte/<nr> ist ein Symlink");
        assert!(unsicher(ordner_anlegen(w.path(), 1)));

        let w = tempfile::tempdir().unwrap();
        symlink(aussen.path(), w.path().join("transkripte")).unwrap();
        assert!(unsicher(datei(w.path(), 1, &eintrag("x"))), "transkripte/ ist ein Symlink");
        assert!(unsicher(ordner_anlegen(w.path(), 1)));
        assert_eq!(std::fs::read_dir(aussen.path()).unwrap().count(), 0, "außen nichts angelegt");

        let w = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(w.path().join("transkripte/0001")).unwrap();
        std::fs::write(aussen.path().join("ziel"), "fremd").unwrap();
        symlink(aussen.path().join("ziel"), w.path().join("transkripte/0001/x@2026-11-13T1034+0100.jsonl.gz")).unwrap();
        assert!(unsicher(datei(w.path(), 1, &eintrag("x"))), "die Datei ist ein Symlink");

        let w = tempfile::tempdir().unwrap();
        std::fs::write(w.path().join("transkripte"), "keine Mappe").unwrap();
        assert!(unsicher(datei(w.path(), 1, &eintrag("x"))), "transkripte ist eine Datei");
    }
}
