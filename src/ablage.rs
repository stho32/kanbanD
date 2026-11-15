//! Der Ordner auf der Platte: Dateien lesen und schreiben, sonst nichts.

use crate::fehler::Fehler;
use crate::format::{self, aufgabe, board, einstellungen};
use crate::modell::{Aufgabe, Board, Einstellungen, Fremdschluessel};
use serde::Serialize;
use std::io;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct DefekteDatei {
    pub pfad: String,
    pub fehler: String,
    /// Die Schlüssel, die eine defekte Aufgabendatei lesbar trägt (R00157, ADR-0004 N1) — nur im Speicher, für die
    /// Schlüsselsuche beim Anlegen; kein Feld der API.
    #[serde(skip)]
    #[schema(ignore)]
    pub schluessel: Vec<Fremdschluessel>,
}

impl DefekteDatei {
    pub fn neu(pfad: impl Into<String>, fehler: impl Into<String>) -> DefekteDatei {
        DefekteDatei { pfad: pfad.into(), fehler: fehler.into(), schluessel: vec![] }
    }
}

/// Der Grund einer Aufgabendatei, die kein gültiges UTF-8 ist (R00161) — sie wird nie gelesen, als wäre sie Text.
const KEIN_UTF8: &str = "Datei ist kein gültiges UTF-8 — als UTF-8 speichern";

#[derive(Debug, Clone)]
pub struct Ordner {
    wurzel: PathBuf,
}

impl Ordner {
    pub fn neu(wurzel: PathBuf) -> Ordner {
        Ordner { wurzel }
    }

    pub fn wurzel(&self) -> &Path {
        &self.wurzel
    }

    pub fn lies(&self, rel: &str) -> io::Result<Option<String>> {
        match std::fs::read_to_string(self.wurzel.join(rel)) {
            Ok(t) => Ok(Some(t)),
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Wie `lies`, nur ohne UTF-8 vorauszusetzen: `Err` trägt die Bytes einer Datei, die kein gültiges UTF-8 ist (R00161).
    /// „Nicht gefunden“ ist leerer Text, jeder andere Zugriffsfehler bleibt einer.
    fn lies_bytes(&self, rel: &str) -> io::Result<Result<String, Vec<u8>>> {
        match std::fs::read(self.wurzel.join(rel)) {
            Ok(bytes) => Ok(String::from_utf8(bytes).map_err(|e| e.into_bytes())),
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Ok(String::new())),
            Err(e) => Err(e),
        }
    }

    /// Schreibt über eine Nachbardatei und Umbenennen, damit kein Leser eine halbe Datei sieht.
    /// Ein Pfad außerhalb der Wurzel wird abgewiesen, bevor etwas angelegt ist.
    pub fn schreib(&self, rel: &str, text: &str) -> io::Result<()> {
        eingeschlossen(rel).map_err(|grund| io::Error::new(io::ErrorKind::InvalidInput, grund))?;
        let ziel = self.wurzel.join(rel);
        if let Some(eltern) = ziel.parent() {
            std::fs::create_dir_all(eltern)?;
        }
        let tmp = ziel.with_extension("kanbanD-tmp");
        std::fs::write(&tmp, text)?;
        std::fs::rename(&tmp, &ziel)
    }

    pub fn existiert(&self, rel: &str) -> bool {
        self.wurzel.join(rel).exists()
    }

    pub fn einstellungen(&self) -> Result<Option<Einstellungen>, Fehler> {
        match self.lies(einstellungen::DATEI)? {
            None => Ok(None),
            Some(t) => einstellungen::lesen(&t).map(Some).map_err(|e| Fehler::Defekt(format!("{}: {e}", einstellungen::DATEI))),
        }
    }

    /// Alle Board-Dateien, nach Dateiname sortiert; unlesbare und solche mit einem Namen außerhalb der Form (ADR-0008) kommen als defekt zurück.
    pub fn boards(&self) -> Result<(Vec<Board>, Vec<DefekteDatei>), Fehler> {
        let mut gut = vec![];
        let mut defekt = vec![];
        for (slug, rel) in self.markdown_dateien(board::ORDNER)? {
            if !crate::modell::slug_gueltig(&slug) {
                defekt.push(DefekteDatei::neu(rel, "Dateiname ist kein gültiger Board-Name — umbenennen"));
                continue;
            }
            let text = self.lies(&rel)?.unwrap_or_default();
            match board::lesen(&slug, &text) {
                Ok(b) => gut.push(b),
                Err(e) => defekt.push(DefekteDatei::neu(rel, e.to_string())),
            }
        }
        Ok((gut, defekt))
    }

    /// Alle Aufgaben, nach Dateiname sortiert. Unlesbare, doppelt nummerierte und solche ohne gültiges UTF-8 (R00161)
    /// kommen als defekt zurück — mit den Schlüsseln, die sie lesbar tragen (R00157): unlesbare nachsichtig gelesen, doppelt nummerierte streng.
    pub fn aufgaben(&self) -> Result<(Vec<Aufgabe>, Vec<DefekteDatei>), Fehler> {
        let mut gut: Vec<Aufgabe> = vec![];
        let mut defekt = vec![];
        for (stamm, rel) in self.markdown_dateien(aufgabe::ORDNER)? {
            let text = match self.lies_bytes(&rel)? {
                Ok(text) => text,
                Err(bytes) => {
                    let schluessel = aufgabe::schluessel_nachsichtig(&String::from_utf8_lossy(&bytes));
                    defekt.push(DefekteDatei { pfad: rel, fehler: KEIN_UTF8.into(), schluessel });
                    continue;
                }
            };
            match aufgabe::lesen(&format!("{stamm}.md"), &text).map(ohne_abgelaufene) {
                Ok(a) => match gut.iter().find(|g| g.nummer == a.nummer) {
                    Some(erste) => {
                        let fehler = format!("Nummer #{} doppelt — auch in aufgaben/{}", a.nummer, erste.datei);
                        defekt.push(DefekteDatei { pfad: rel, fehler, schluessel: a.schluessel.into_iter().collect() });
                    }
                    None => gut.push(a),
                },
                Err(e) => defekt.push(DefekteDatei { pfad: rel, fehler: e.to_string(), schluessel: aufgabe::schluessel_nachsichtig(&text) }),
            }
        }
        Ok((gut, defekt))
    }

    /// Pfad der Aufgabendatei zur Nummer (erste Datei mit dieser Nummer im Namen oder als `id`).
    /// Der Pfad der Aufgabendatei mit dieser Nummer: die erste nach Dateinamen sortierte nummerierte Datei, die sich
    /// lesen lässt; findet keine nummerierte Datei, entscheidet wie bisher der Inhalt (eine von Hand benannte Datei
    /// trägt die Nummer nur in `id`), und eine defekte nummerierte Datei bleibt auffindbar (R00123/B0573).
    /// Der Normalfall liest nur die Dateinamen des Ordners und eine Datei — nicht alle 5000 Aufgaben je Aufruf (#131).
    pub fn aufgabenpfad(&self, nummer: u32) -> Result<String, Fehler> {
        let nummeriert: Vec<String> = self
            .markdown_dateien(aufgabe::ORDNER)?
            .into_iter()
            .filter(|(stamm, _)| aufgabe::nummer_aus_dateiname(stamm) == Some(nummer))
            .map(|(_, rel)| rel)
            .collect();
        for pfad in &nummeriert {
            let text = self.lies(pfad)?.unwrap_or_default();
            if aufgabe::lesen(pfad.rsplit('/').next().unwrap_or_default(), &text).is_ok() {
                return Ok(pfad.clone());
            }
        }
        if let Some(erster) = nummeriert.first() {
            return Ok(erster.clone());
        }
        let (gut, defekt) = self.aufgaben()?;
        if let Some(a) = gut.iter().find(|a| a.nummer == nummer) {
            return Ok(format!("{}/{}", aufgabe::ORDNER, a.datei));
        }
        defekt
            .iter()
            .find(|d| d.pfad.rsplit('/').next().and_then(aufgabe::nummer_aus_dateiname) == Some(nummer))
            .map(|d| d.pfad.clone())
            .ok_or_else(|| Fehler::NichtGefunden(format!("Aufgabe #{nummer} gibt es nicht")))
    }

    /// Die Aufgabe zur Nummer; eine defekte Datei ist nur lesbar.
    pub fn aufgabe(&self, nummer: u32) -> Result<Aufgabe, Fehler> {
        let pfad = self.aufgabenpfad(nummer)?;
        let text = self.lies(&pfad)?.unwrap_or_default();
        let datei = pfad.rsplit('/').next().unwrap_or_default().to_string();
        aufgabe::lesen(&datei, &text).map(ohne_abgelaufene).map_err(|e| Fehler::Defekt(format!("{pfad}: {e} — nur lesbar, bis die Datei repariert ist")))
    }

    /// Höchste Nummer unter allen Dateinamen in `aufgaben/` plus 1 — auch defekte Dateien zählen.
    pub fn naechste_nummer(&self) -> Result<u32, Fehler> {
        let hoechste = self.markdown_dateien(aufgabe::ORDNER)?.iter().filter_map(|(stamm, _)| aufgabe::nummer_aus_dateiname(stamm)).max().unwrap_or(0);
        Ok(hoechste + 1)
    }

    /// Die eine Eingangstür zu einer Board-Datei: erst die Form (400), dann die Datei (404) — ADR-0008.
    pub fn board(&self, slug: &str) -> Result<Board, Fehler> {
        if !crate::modell::slug_gueltig(slug) {
            return Err(Fehler::Ungueltig(board_name_ungueltig(slug)));
        }
        let rel = board_pfad(slug);
        let text = self.lies(&rel)?.ok_or_else(|| Fehler::NichtGefunden(format!("Board „{slug}“ gibt es nicht")))?;
        board::lesen(slug, &text).map_err(|e| Fehler::Defekt(format!("{rel}: {e}")))
    }

    /// (Dateistamm, relativer Pfad) aller `.md` in einem Unterordner, sortiert.
    pub fn markdown_dateien(&self, unterordner: &str) -> io::Result<Vec<(String, String)>> {
        let dir = self.wurzel.join(unterordner);
        let mut liste = vec![];
        match std::fs::read_dir(&dir) {
            Ok(eintraege) => {
                for e in eintraege {
                    let e = e?;
                    let name = e.file_name().to_string_lossy().to_string();
                    if let Some(stamm) = name.strip_suffix(".md")
                        && e.file_type()?.is_file()
                    {
                        liste.push((stamm.to_string(), format!("{unterordner}/{name}")));
                    }
                }
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }
        liste.sort();
        Ok(liste)
    }
}

/// Meldung zu einem Board-Namen außerhalb der Form; Steuerzeichen (NUL) kommen nie roh in die Antwort.
fn board_name_ungueltig(slug: &str) -> String {
    const FORM: &str = "1–40 Zeichen aus a–z, 0–9, -";
    if slug.chars().any(char::is_control) { format!("Board-Name ungültig: {FORM}") } else { format!("Board-Name „{slug}“ ungültig: {FORM}") }
}

/// Zweite Linie (ADR-0008 Option D): jeder Pfad relativ und nur aus normalen Bestandteilen (kein `..`, `.`, keine Wurzel,
/// kein NUL), keiner doppelt. Ein Treffer ist ein Programmierfehler, nie eine Benutzereingabe.
pub fn pfade_pruefen(pfade: &[&str]) -> Result<(), String> {
    for (i, rel) in pfade.iter().enumerate() {
        eingeschlossen(rel)?;
        if pfade[..i].contains(rel) {
            return Err(format!("Pfad „{rel}“ doppelt in einer Aktion"));
        }
    }
    Ok(())
}

/// Ein Pfad, der unter der Wurzel bleibt und in Normalform steht: nicht leer, ohne NUL, nur `Component::Normal` und
/// kein leerer oder `.`-Abschnitt (`components()` glättet `a/./b` und `a//b` still) — so ist „doppelt“ ein Textvergleich.
fn eingeschlossen(rel: &str) -> Result<(), String> {
    if rel.contains('\0') {
        return Err("Pfad mit NUL".into());
    }
    if rel.is_empty() {
        return Err("Pfad leer".into());
    }
    let normal = Path::new(rel).components().all(|c| matches!(c, std::path::Component::Normal(_)));
    let ohne_leere_abschnitte = rel.split('/').all(|t| !t.is_empty() && t != "." && t != "..");
    if !(normal && ohne_leere_abschnitte) {
        return Err(format!("Pfad „{rel}“ verlässt den Ordner oder steht nicht in Normalform"));
    }
    Ok(())
}

pub fn board_pfad(slug: &str) -> String {
    format!("{}/{slug}.md", board::ORDNER)
}

impl From<format::Formatfehler> for Fehler {
    fn from(e: format::Formatfehler) -> Self {
        Fehler::Defekt(e.0)
    }
}

/// Eine abgelaufene Reservierung gilt als nicht vorhanden (R00087); der nächste Schreibzugriff entfernt sie aus der Datei.
fn ohne_abgelaufene(mut a: Aufgabe) -> Aufgabe {
    if a.reservierung.as_ref().is_some_and(|r| !r.gueltig(&crate::uhr::jetzt())) {
        a.reservierung = None;
    }
    a
}

#[cfg(test)]
mod tests {
    use super::Ordner;
    use crate::fehler::Fehler;

    fn ordner_mit_fabrik() -> (tempfile::TempDir, Ordner) {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("boards")).unwrap();
        std::fs::write(tmp.path().join("boards/fabrik.md"), "# fabrik\n\n## In Arbeit\n").unwrap();
        std::fs::write(tmp.path().join("fremd.md"), "# fremd\n\n## Geheim\n").unwrap();
        let o = Ordner::neu(tmp.path().to_path_buf());
        (tmp, o)
    }

    // B0340: die Eingangstür prüft die Form vor dem Lesen — auch wenn hinter dem Pfad ein lesbares Board läge
    #[test]
    fn board_weist_ungueltige_form_vor_dem_lesen_ab() {
        let (_tmp, o) = ordner_mit_fabrik();
        for name in ["../fremd", "./fabrik", "Fabrik", "", "fabrik\0"] {
            assert!(matches!(o.board(name), Err(Fehler::Ungueltig(_))), "{name:?}: {:?}", o.board(name));
        }
        assert!(!o.board("fabrik\0").unwrap_err().meldung().contains('\0'), "kein NUL in der Meldung");
        assert!(matches!(o.board(&"a".repeat(40)), Err(Fehler::NichtGefunden(_))));
        assert_eq!(o.board("fabrik").unwrap().titel, "fabrik");
    }

    // R00157 B0742: die defekte Aufgabendatei trägt ihre lesbaren Schlüssel im Speicher, in der Reihenfolge des Lesens
    #[test]
    fn defekte_aufgabendatei_traegt_ihren_schluessel() {
        let (tmp, o) = ordner_mit_fabrik();
        let a = tmp.path().join("aufgaben");
        std::fs::create_dir_all(&a).unwrap();
        std::fs::write(a.join("0009-marker.md"), "---\nid: 9\n<<<<<<< HEAD\nkey: k1\n=======\nkey: k2\n>>>>>>> sensor\n---\n").unwrap();
        std::fs::write(a.join("0007-fund.md"), "---\nid: 7\ntitle: Fund\nkey: k1\nestimate: abc\n---\n").unwrap();
        std::fs::write(a.join("0003-alt.md"), "---\nid: 3\ntitle: Alt\nkey: k3\n---\n").unwrap();
        std::fs::write(a.join("0003-doppelt.md"), "---\nid: 3\ntitle: Doppelt\nkey: k4\n---\n").unwrap();
        std::fs::write(a.join("0008-ohne.md"), "---\nid: 8\nestimate: abc\n---\n").unwrap();
        std::fs::write(a.join("0008-leer.md"), "---\nid: 8\nkey: \"\"\n---\n").unwrap();
        let (gut, defekt) = o.aufgaben().unwrap();
        assert_eq!(gut.iter().map(|a| a.nummer).collect::<Vec<_>>(), [3]);
        let gelesen: Vec<(&str, Vec<&str>)> = defekt.iter().map(|d| (d.pfad.as_str(), d.schluessel.iter().map(|k| k.text()).collect())).collect();
        let erwartet: Vec<(&str, Vec<&str>)> = vec![
            ("aufgaben/0003-doppelt.md", vec!["k4"]),
            ("aufgaben/0007-fund.md", vec!["k1"]),
            ("aufgaben/0008-leer.md", vec![]),
            ("aufgaben/0008-ohne.md", vec![]),
            ("aufgaben/0009-marker.md", vec!["k1", "k2"]),
        ];
        assert_eq!(gelesen, erwartet);
    }

    // B0341: Liste und Eingangstür sagen dasselbe — ein Dateistamm außerhalb der Form ist defekt, nichts wird umbenannt
    #[test]
    fn boards_meldet_handbenannte_datei_als_defekt() {
        let (tmp, o) = ordner_mit_fabrik();
        std::fs::write(tmp.path().join("boards/Alt_Board.md"), "# Alt\n\n## Offen\n").unwrap();
        let (gut, defekt) = o.boards().unwrap();
        assert_eq!(gut.iter().map(|b| b.slug.as_str()).collect::<Vec<_>>(), ["fabrik"]);
        assert_eq!(defekt, [super::DefekteDatei::neu("boards/Alt_Board.md", "Dateiname ist kein gültiger Board-Name — umbenennen")]);
        assert_eq!(std::fs::read_to_string(tmp.path().join("boards/Alt_Board.md")).unwrap(), "# Alt\n\n## Offen\n");
    }

    // B0342: zweite Linie — die reine Prüfung der Pfade einer Aktion
    #[test]
    fn pfade_pruefen_laesst_nur_eindeutige_normale_pfade_durch() {
        assert_eq!(super::pfade_pruefen(&["aufgaben/0001-a.md", "boards/fabrik.md", "anhaenge/1/bild.png"]), Ok(()));
        for (pfade, grund) in [
            (vec!["aufgaben/0001-a.md", "../x.md"], "verlässt"),
            (vec!["/tmp/x.md"], "verlässt"),
            (vec!["aufgaben/./x.md"], "Normalform"),
            (vec!["aufgaben//x.md"], "Normalform"),
            (vec!["aufgaben/x.md/"], "Normalform"),
            (vec!["aufgaben/a\0.md"], "NUL"),
            (vec![""], "leer"),
            (vec!["aufgaben/0001-a.md", "aufgaben/0001-a.md"], "doppelt"),
        ] {
            let e = super::pfade_pruefen(&pfade).expect_err(&format!("{pfade:?}"));
            assert!(e.contains(grund), "{pfade:?}: {e}");
            assert!(!e.contains('\0'), "kein NUL in der Meldung");
        }
    }

    // #131: der Pfad je Karte — nummerierte Datei (Normalfall), defekte nummerierte Datei bleibt auffindbar,
    // eine von Hand benannte Datei trägt die Nummer nur im Inhalt (`id`), unbekannt ist 404
    #[test]
    fn aufgabenpfad_findet_nummerierte_und_von_hand_benannte_dateien() {
        let (tmp, o) = ordner_mit_fabrik();
        std::fs::create_dir_all(tmp.path().join("aufgaben")).unwrap();
        std::fs::write(tmp.path().join("aufgaben/0007-sieben.md"), "---\nid: 7\ntitle: sieben\n---\n").unwrap();
        std::fs::write(tmp.path().join("aufgaben/0008-kaputt.md"), "---\ntitle: kaputt\n---\n").unwrap();
        std::fs::write(tmp.path().join("aufgaben/von-hand.md"), "---\nid: 9\ntitle: neun\n---\n").unwrap();
        assert_eq!(o.aufgabenpfad(7).unwrap(), "aufgaben/0007-sieben.md");
        assert_eq!(o.aufgabenpfad(8).unwrap(), "aufgaben/0008-kaputt.md", "die defekte Datei bleibt über den Dateinamen auffindbar");
        assert_eq!(o.aufgabenpfad(9).unwrap(), "aufgaben/von-hand.md", "der Inhalt entscheidet, wenn kein Dateiname die Nummer trägt");
        assert!(matches!(o.aufgabenpfad(99), Err(Fehler::NichtGefunden(_))));
    }

    #[test]
    fn schreib_bleibt_unter_der_wurzel() {
        let eltern = tempfile::tempdir().unwrap();
        let w = eltern.path().join("w");
        std::fs::create_dir_all(&w).unwrap();
        let o = Ordner::neu(w.clone());
        assert!(o.schreib("../x.md", "x").is_err());
        assert!(!eltern.path().join("x.md").exists(), "keine Datei neben dem Ordner");
        let absolut = eltern.path().join("y.md");
        assert!(o.schreib(absolut.to_str().unwrap(), "y").is_err());
        assert!(!absolut.exists());
        o.schreib("anhaenge/1/bild.png", "png").unwrap();
        assert_eq!(std::fs::read_to_string(w.join("anhaenge/1/bild.png")).unwrap(), "png");
    }
}
