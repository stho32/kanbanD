use super::Kanban;
use super::herkunft::absolut;
use crate::fehler::Fehler;
use crate::herkunft::wbs_tabelle;
use crate::waechter::FremdeWbs;
use crate::wbs::{Stand, WbsKnoten, stand};
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::Path;

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
    /// Die WBS einer registrierten Anwendung mit gerechnetem Status, erreichter Ebene und Stand.
    pub fn wbs(&self, kuerzel: &str) -> Result<WbsSicht, Fehler> {
        let e = self.ordner().einstellungen().ok().flatten().unwrap_or_default();
        let a = e.quellen.anwendungen.iter().find(|a| a.kuerzel == kuerzel).ok_or_else(|| Fehler::NichtGefunden(format!("Anwendung „{kuerzel}“ steht nicht im Register")))?;
        let datei = absolut(self.ordner().wurzel(), &a.wbs);
        let text = Some(&a.wbs).filter(|p| !p.is_empty()).and_then(|_| std::fs::read_to_string(&datei).ok()).ok_or_else(|| Fehler::Konflikt(format!("WBS von „{kuerzel}“ nicht erreichbar: {}", datei.display())))?;
        let tabelle = wbs_tabelle(&text);
        let ids: Vec<&str> = tabelle.alle().iter().flat_map(|k| anforderungs_ids(&k.requirement)).collect();
        let anforderungen = if a.anforderungen.is_empty() { BTreeMap::new() } else { anforderungsdateien(&absolut(self.ordner().wurzel(), &a.anforderungen), &ids) };
        let knoten = tabelle.alle().iter().map(|k| WbsZeile { knoten: k.clone(), gerechnet: tabelle.gerechneter_status(&k.id), erreicht: tabelle.erreichte_ebene(&k.id) }).collect();
        Ok(WbsSicht { kuerzel: kuerzel.into(), name: a.name.clone(), nicht_committet: crate::git::geaendert(&datei), datei: datei.to_string_lossy().into(), stand: stand(&tabelle), knoten, anforderungen })
    }
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
                let datei = ordner.join(roh.file_name()?);
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
