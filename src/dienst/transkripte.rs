//! Transkripte der Agentenläufe ablegen, lesen und löschen (R00216, ADR-0036). Die gz-Datei liegt unversioniert unter
//! `transkripte/<nr>/` (darin `transkripte/.gitignore` = `*`), versioniert wird nur der Eintrag `transcripts` an der Karte.
//!
//! **Pfadschutz (Regel 7):** Ein Pfad unter `transkripte/` entsteht nur in [`datei`] — aus der Nummer der Route und dem
//! Namen, den [`Transkripteintrag::dateiname`] aus der geprüften Kennung faltet. Vor jedem Öffnen, Umbenennen und Löschen
//! prüft sie den Namen gegen das Muster und weist Symlinks auf `transkripte/`, `transkripte/<nr>/` und die Datei ab.

use super::{Kanban, Schritt};
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::{Erfassung, GZIP_KENNBYTES, HOECHSTZAHL_TRANSKRIPTE, Person, TRANSKRIPT_HOECHSTENS, Transkripteintrag, Transkriptzeile};
use chrono::Utc;
use std::io::Write;
use std::path::{Path, PathBuf};

/// Ordner der Transkripte im Board-Ordner (ADR-0036 Regel 1).
pub const ORDNER: &str = "transkripte";
/// Inhalt von `transkripte/.gitignore`: der Ordner ignoriert sich selbst, die `.gitignore` des Menschen bleibt unberührt.
const GITIGNORE: &str = "*\n";

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
    /// Die Form der Felder (400), sobald alle drei da sind — damit eine falsche Anfrage abgewiesen wird, bevor die Datei
    /// geschrieben ist. Die Spalte und die Kennung prüft erst [`Kanban::transkript_einhaengen`] unter der Sperre.
    pub fn form_pruefen(&self) -> Result<(), Fehler> {
        if self.at.is_some() && self.role.is_some() && self.column.is_some() {
            self.eintrag(0)?;
        }
        Ok(())
    }

    /// Der Eintrag nach ADR-0028 Punkt 2: `at` nicht in der Zukunft, gespeichert in Ortszeit mit Versatz — wie beim
    /// Kosteneintrag desselben Laufs, damit beide dieselbe Kennung tragen.
    fn eintrag(&self, bytes: u64) -> Result<Transkripteintrag, Fehler> {
        let at = super::kosteneintraege::zeitpunkt_der_anfrage(PFAD, self.at.clone(), Utc::now())?;
        Transkripteintrag::neu(PFAD, at.as_deref(), self.role.as_deref(), self.column.as_deref(), bytes).map_err(Fehler::Ungueltig)
    }
}

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

    fn oeffnen(&mut self) -> Result<(), Fehler> {
        let oben_da = self.wurzel.join(ORDNER).exists();
        let ordner_da = self.wurzel.join(ORDNER).join(format!("{:04}", self.nr)).exists();
        let ordner = ordner_anlegen(&self.wurzel, self.nr).map_err(|f| Fehler::Intern(f.meldung().to_string()))?;
        self.angelegt = Angelegt { oben: !oben_da, ordner: !ordner_da };
        let pfad = ordner.join(format!("{}.kanbanD-tmp", zwischenname()));
        let datei = std::fs::OpenOptions::new().write(true).create_new(true).open(&pfad)?;
        self.zwischen = Some(pfad);
        self.datei = Some(datei);
        Ok(())
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
    /// 409 `{fehler, erfassung: "aus", boards}`.
    pub fn transkript_vorpruefen(&self, nr: u32) -> Result<(), Fehler> {
        self.ordner().aufgabe(nr)?;
        erfassung_verlangen(nr, self.transkripte_erfassung(nr)?)
    }

    /// Stufe 3 unter der Sperre (Prüfen-dann-Handeln): gegen die frisch gelesene Datei erneut Schalter (409), Felder und
    /// Spalte (400), Höchstzahl (409), Kennung und gefalteter Name (409 `{fehler, kennung}`); dann die Zwischendatei
    /// umbenennen, den Eintrag schreiben und **einen** Commit nur mit der Aufgabendatei. Jeder Fehler räumt die
    /// Zwischendatei und, was dieser Upload angelegt hat; scheitert der Commit, wird die umbenannte Datei entfernt.
    pub fn transkript_einhaengen(&self, wer: &Person, nr: u32, angaben: &Ablageangaben, mut empfang: Empfang) -> Result<Transkripteintrag, Fehler> {
        let _sperre = self.gesperrt();
        let ergebnis = self.einhaengen_gesperrt(wer, nr, angaben, &mut empfang);
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

    fn einhaengen_gesperrt(&self, wer: &Person, nr: u32, angaben: &Ablageangaben, empfang: &mut Empfang) -> Result<Transkripteintrag, Fehler> {
        let (zwischen, bytes) = empfang.abschliessen()?;
        let mut a = self.ordner().aufgabe(nr)?;
        erfassung_verlangen(nr, self.transkripte_erfassung(nr)?)?;
        let neu = angaben.eintrag(bytes)?;
        super::kosteneintraege::spalte_pruefen(PFAD, &neu.spalte, nr, &self.ordner().boards()?.0)?;
        if a.transkripte.len() >= HOECHSTZAHL_TRANSKRIPTE {
            return Err(Fehler::Konflikt(format!("#{nr} trägt schon {HOECHSTZAHL_TRANSKRIPTE} Transkripte — mehr nimmt eine Aufgabe nicht auf")));
        }
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
            let _ = std::fs::remove_file(&ziel);
            return Err(f);
        }
        Ok(neu)
    }
}

fn erfassung_verlangen(nr: u32, e: Erfassung) -> Result<(), Fehler> {
    if e.erfassen {
        return Ok(());
    }
    let wo = if e.boards_aus.is_empty() { "in der Vorgabe des Ordners (kanbanD.md)".to_string() } else { format!("auf {}", e.boards_aus.join(", ")) };
    Err(Fehler::ErfassungAus { meldung: format!("Transkripte erfassen ist für #{nr} aus ({wo}) — nichts abgelegt"), boards: e.boards_aus })
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
/// bleibt, wie sie ist (Regel 1). Danach dieselbe Prüfung wie [`aufgabenordner`].
pub(crate) fn ordner_anlegen(wurzel: &Path, nr: u32) -> Result<PathBuf, Pfadfehler> {
    let unsicher = |e: std::io::Error| Pfadfehler::Unsicher(format!("{ORDNER}/ lässt sich nicht anlegen: {e}"));
    let oben = wurzel.join(ORDNER);
    ordner_pruefen(&oben, ORDNER)?;
    match std::fs::create_dir(&oben) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(e) => return Err(unsicher(e)),
    }
    ordner_pruefen(&oben, ORDNER)?;
    let ignorieren = oben.join(".gitignore");
    if std::fs::symlink_metadata(&ignorieren).is_err() {
        use std::io::Write;
        match std::fs::OpenOptions::new().write(true).create_new(true).open(&ignorieren) {
            Ok(mut f) => f.write_all(GITIGNORE.as_bytes()).map_err(unsicher)?,
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(e) => return Err(unsicher(e)),
        }
    }
    let ordner = oben.join(format!("{nr:04}"));
    match std::fs::create_dir(&ordner) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(e) => return Err(unsicher(e)),
    }
    aufgabenordner(wurzel, nr)
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

    // Prüfen-dann-Handeln (ADR-0036 Regel 5): zwei Uploads derselben Kennung haben beide die Vorprüfung und die
    // Zwischendatei hinter sich; unter der Sperre gewinnt genau einer, der zweite räumt seine Zwischendatei
    #[test]
    fn zwei_uploads_derselben_kennung_ergeben_genau_einen_eintrag() {
        let (w, k, wer) = ordner();
        let (erster, zweiter) = (empfangen(&k), empfangen(&k));
        assert_eq!(dateien(w.path()).iter().filter(|d| d.ends_with(".kanbanD-tmp")).count(), 2, "beide Zwischendateien liegen");
        assert!(k.transkript_einhaengen(&wer, 1, &angaben(), erster).is_ok());
        let f = k.transkript_einhaengen(&wer, 1, &angaben(), zweiter).unwrap_err();
        assert!(matches!(&f, Fehler::KennungBelegt { kennung, .. } if kennung == "entwickler@2026-11-13T10:34+01:00"), "{f:?}");
        assert_eq!(dateien(w.path()), ["entwickler@2026-11-13T1034+0100.jsonl.gz"]);
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
