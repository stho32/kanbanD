use super::Kanban;
use super::herkunft::absolut;
use crate::fehler::Fehler;
use crate::herkunft::wbs_tabelle;
use crate::waechter::FremdeWbs;
use crate::wbs::{Stand, WbsKnoten, WbsTabelle, stand};
use crate::wbs_datei::{Geschrieben, NeuerKnoten, knoten_anlegen, naechste_id, neuen_knoten_pruefen, schreibbar, status_setzen, teilbaum_auf_rot, verwerfen, wiederherstellen};
use crate::modell::Anwendung;
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

/// Ein Knoten, wie die WBS-Sicht ihn zeigt: die Zeile der Datei und was aus den Kindern folgt.
#[derive(Debug, Serialize)]
pub struct WbsZeile {
    #[serde(flatten)]
    pub knoten: WbsKnoten,
    /// Status nach Skill; weicht er von `status` ab, widerspricht die Datei der Rechnung
    pub gerechnet: String,
    /// erreichte Ebene nach Skill
    pub erreicht: String,
}

/// `GET /api/wbs/{kürzel}`.
#[derive(Debug, Serialize)]
pub struct WbsSicht {
    pub kuerzel: String,
    pub name: String,
    /// voller Pfad der WBS-Datei im Arbeits-Repository
    pub datei: String,
    pub knoten: Vec<WbsZeile>,
    pub stand: Stand,
    /// die WBS-Datei hat Änderungen, die im Arbeits-Repository nicht committet sind
    pub nicht_committet: bool,
    /// Anforderungsdatei je in der Tabelle genannter Anforderung, soweit im Anforderungsordner gefunden
    pub anforderungen: BTreeMap<String, String>,
}

/// `R00053, R00054` → beide IDs.
fn anforderungs_ids(zelle: &str) -> impl Iterator<Item = &str> {
    zelle.split(|c: char| !c.is_ascii_alphanumeric()).filter(|w| w.len() == 6 && w.starts_with('R') && w[1..].bytes().all(|b| b.is_ascii_digit()))
}

fn anforderungsdateien(ordner: &Path, gesucht: &[&str]) -> BTreeMap<String, String> {
    let Ok(eintraege) = std::fs::read_dir(ordner) else { return BTreeMap::new() };
    eintraege
        .flatten()
        .filter_map(|d| {
            let name = d.file_name().to_string_lossy().to_string();
            let id = name.split(['-', '.']).next().filter(|id| gesucht.contains(id) && name.ends_with(".md"))?.to_string();
            Some((id, d.path().to_string_lossy().into_owned()))
        })
        .collect()
}

impl Kanban {
    /// Name und voller Pfad der WBS-Datei einer registrierten Anwendung.
    fn wbs_datei(&self, kuerzel: &str) -> Result<(Anwendung, PathBuf), Fehler> {
        let e = self.ordner().einstellungen().ok().flatten().unwrap_or_default();
        let a = e.quellen.anwendungen.iter().find(|a| a.kuerzel == kuerzel).cloned().ok_or_else(|| Fehler::NichtGefunden(format!("Anwendung „{kuerzel}“ steht nicht im Register")))?;
        let datei = absolut(self.ordner().wurzel(), &a.wbs);
        Ok((a, datei))
    }

    /// Text der WBS-Datei; ohne Pfad oder unlesbar ist die Anwendung nicht erreichbar (409).
    fn wbs_text(kuerzel: &str, a: &Anwendung, datei: &Path) -> Result<String, Fehler> {
        Some(&a.wbs).filter(|p| !p.is_empty()).and_then(|_| std::fs::read_to_string(datei).ok()).ok_or_else(|| Fehler::Konflikt(format!("WBS von „{kuerzel}“ nicht erreichbar: {}", datei.display())))
    }

    /// Die WBS einer registrierten Anwendung mit gerechnetem Status, erreichter Ebene und Stand.
    pub fn wbs(&self, kuerzel: &str) -> Result<WbsSicht, Fehler> {
        let (a, datei) = self.wbs_datei(kuerzel)?;
        let text = Self::wbs_text(kuerzel, &a, &datei)?;
        let tabelle = wbs_tabelle(&text);
        let ids: Vec<&str> = tabelle.alle().iter().flat_map(|k| anforderungs_ids(&k.requirement)).collect();
        let anforderungen = if a.anforderungen.is_empty() { BTreeMap::new() } else { anforderungsdateien(&absolut(self.ordner().wurzel(), &a.anforderungen), &ids) };
        let knoten = tabelle.alle().iter().map(|k| WbsZeile { knoten: k.clone(), gerechnet: tabelle.gerechneter_status(&k.id), erreicht: tabelle.erreichte_ebene(&k.id) }).collect();
        Ok(WbsSicht { kuerzel: kuerzel.into(), name: a.name.clone(), nicht_committet: crate::git::geaendert(&datei), datei: datei.to_string_lossy().into(), stand: stand(&tabelle), knoten, anforderungen })
    }
}

/// `PATCH /api/wbs/{kürzel}/knoten/{id}`: die Knoten, deren Status sich in der Datei geändert hat.
#[derive(Debug, Serialize)]
pub struct WbsGeaendert {
    pub geaendert: Vec<String>,
}

impl Kanban {
    /// Die Sperre der WBS-Datei — Schreibzugriffe auf dieselbe Datei gehen nacheinander, andere Dateien und der Ordner warten nicht.
    fn wbs_sperre(&self, datei: &Path) -> Arc<Mutex<()>> {
        let schluessel = datei.canonicalize().unwrap_or_else(|_| datei.to_path_buf());
        self.wbs_sperren.lock().unwrap_or_else(|e| e.into_inner()).entry(schluessel).or_default().clone()
    }

    /// Liest die WBS-Datei unter ihrer Sperre, ändert sie mit `aendern` und schreibt sie zurück, wenn sich etwas geändert hat.
    /// Im Arbeits-Repository wird nie committet.
    fn wbs_aendern<T>(&self, kuerzel: &str, aendern: impl FnOnce(&str, &Path, &str) -> Result<(Geschrieben, T), Fehler>) -> Result<T, Fehler> {
        let (a, datei) = self.wbs_datei(kuerzel)?;
        let sperre = self.wbs_sperre(&datei);
        let _gesperrt = sperre.lock().unwrap_or_else(|e| e.into_inner());
        let text = Self::wbs_text(kuerzel, &a, &datei)?;
        let (g, ergebnis) = aendern(&text, &datei, &crate::uhr::heute())?;
        if g.text != text {
            self.als_eigen_merken(&datei);
            datei_ersetzen(&datei, &g.text)?;
        }
        Ok(ergebnis)
    }

    /// Setzt den Status eines Blatts der WBS von `kuerzel` (R00055); Vorfahren und `zuletzt` werden mitgeschrieben.
    /// Wer handelt, prüft der Aufrufer — im Arbeits-Repository entsteht kein Commit, also auch kein Autor.
    pub fn wbs_status_setzen(&self, kuerzel: &str, id: &str, status: &str) -> Result<WbsGeaendert, Fehler> {
        self.wbs_aendern(kuerzel, |text, _, heute| mit_geaenderten(status_setzen(text, id, status, heute)?))
    }

    /// Legt einen Knoten in der WBS von `kuerzel` an (R00056): nächste freie ID aus der Datei und allen ihren Ständen
    /// im Arbeits-Repository, Zeile `rot` nach dem letzten Nachfahren der Eltern.
    pub fn wbs_knoten_anlegen(&self, kuerzel: &str, neu: &NeuerKnoten) -> Result<WbsNeu, Fehler> {
        self.wbs_aendern(kuerzel, |text, datei, heute| {
            schreibbar(text)?;
            let praefix = neuen_knoten_pruefen(&wbs_tabelle(text), neu)?;
            let mut staende = crate::git::staende_der_datei(datei);
            staende.push(text.to_string());
            let id = naechste_id(praefix, &staende);
            Ok((knoten_anlegen(text, neu, &id, heute)?, WbsNeu { id }))
        })
    }
}

impl Kanban {
    /// Verwirft einen Knoten der WBS von `kuerzel` samt zählender Nachfahren (R00056); nichts wird gelöscht.
    pub fn wbs_verwerfen(&self, kuerzel: &str, id: &str, grund: &str) -> Result<WbsGeaendert, Fehler> {
        self.wbs_aendern(kuerzel, |text, _, heute| mit_geaenderten(verwerfen(text, id, grund, heute)?))
    }

    /// Setzt einen Knoten der WBS von `kuerzel` zur Überarbeitung auf rot — ein Blatt selbst, sonst alle zählenden Blätter
    /// darunter (R00057); Vorfahren gerechnet, kein Commit.
    pub fn wbs_ueberarbeiten(&self, kuerzel: &str, id: &str) -> Result<WbsGeaendert, Fehler> {
        self.wbs_aendern(kuerzel, |text, _, heute| mit_geaenderten(teilbaum_auf_rot(text, id, heute)?))
    }

    /// Hebt das Verwerfen eines Knotens der WBS von `kuerzel` auf (R00071); kein Commit.
    pub fn wbs_wiederherstellen(&self, kuerzel: &str, id: &str, grund: &str) -> Result<WbsGeaendert, Fehler> {
        self.wbs_aendern(kuerzel, |text, _, heute| mit_geaenderten(wiederherstellen(text, id, grund, heute)?))
    }

    /// Die Knotentabelle der WBS von `kuerzel`, wenn die Datei lesbar und nicht defekt ist — zum Prüfen ohne Schreiben.
    pub fn wbs_tabelle_lesen(&self, kuerzel: &str) -> Result<WbsTabelle, Fehler> {
        let (a, datei) = self.wbs_datei(kuerzel)?;
        let text = Self::wbs_text(kuerzel, &a, &datei)?;
        schreibbar(&text)?;
        Ok(wbs_tabelle(&text))
    }
}

/// `POST /api/wbs/{kürzel}/knoten`: die ID des neuen Knotens.
#[derive(Debug, Serialize)]
pub struct WbsNeu {
    pub id: String,
}

impl Kanban {
    /// Der eigene Schreibzugriff gilt dem Wächter nicht als extern — dem fremden mit vollem Pfad, dem des Ordners relativ.
    fn als_eigen_merken(&self, datei: &Path) {
        let voll = kanonisch(datei);
        self.eigene_merken(&voll.to_string_lossy());
        if let Some(rel) = crate::waechter::relativ(&kanonisch(self.ordner().wurzel()), &voll) {
            self.eigene_merken(&rel);
        }
    }
}

/// Voller Pfad mit aufgelöstem Ordner — so, wie der fremde Wächter die Datei nennt (die Datei selbst darf fehlen).
fn kanonisch(datei: &Path) -> PathBuf {
    let ordner = datei.parent().and_then(|o| o.canonicalize().ok());
    match (ordner, datei.file_name()) {
        (Some(o), Some(n)) => o.join(n),
        _ => datei.to_path_buf(),
    }
}

/// Was geschrieben wird und, als Antwort, welche Knoten sich dabei geändert haben.
fn mit_geaenderten(g: Geschrieben) -> Result<(Geschrieben, WbsGeaendert), Fehler> {
    let geaendert = g.geaendert.clone();
    Ok((g, WbsGeaendert { geaendert }))
}

/// Schreibt über eine Zwischendatei im selben Ordner — wer liest, sieht den alten oder den neuen Stand, nie einen halben.
fn datei_ersetzen(datei: &Path, text: &str) -> Result<(), Fehler> {
    let mut tmp = datei.as_os_str().to_owned();
    tmp.push(".kanbanD-tmp");
    std::fs::write(&tmp, text)?;
    std::fs::rename(&tmp, datei)?;
    Ok(())
}

impl Kanban {
    /// Die WBS-Dateien der registrierten Anwendungen außerhalb des Ordners, für den Dateiwächter —
    /// was im Ordner liegt, sieht er ohnehin.
    pub fn fremde_wbs(&self) -> Vec<FremdeWbs> {
        let e = self.ordner().einstellungen().ok().flatten().unwrap_or_default();
        let wurzel = self.ordner().wurzel();
        let innen = wurzel.canonicalize().unwrap_or_else(|_| wurzel.to_path_buf());
        e.quellen
            .anwendungen
            .iter()
            .filter(|a| !a.wbs.is_empty())
            .filter_map(|a| {
                let roh = absolut(wurzel, &a.wbs);
                let ordner = roh.parent()?.canonicalize().ok()?;
                let datei = kanonisch(&roh);
                Some(FremdeWbs { kuerzel: a.kuerzel.clone(), git: crate::git::git_verzeichnis(&ordner), datei }).filter(|f| !f.datei.starts_with(&innen))
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anforderungen_aus_der_zelle() {
        assert_eq!(anforderungs_ids("R00053, R00054").collect::<Vec<_>>(), ["R00053", "R00054"]);
        assert_eq!(anforderungs_ids("R0005 · X00054 · R000540").count(), 0);
    }
}
