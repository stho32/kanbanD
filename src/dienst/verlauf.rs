use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::board;
use crate::git;
use crate::modell::Board;
use crate::verlauf::{Aufgabenstand, Bewegungen, Kartenverlauf, Verlauf, bewegungen, kartenverlauf, spuren_wechsel, verlauf};

impl Kanban {
    /// Verlauf eines Boards aus den committeten Ständen seiner Datei, dazu der aktuelle Stand, falls er abweicht.
    pub fn verlauf(&self, slug: &str) -> Result<Verlauf, Fehler> {
        let (staende, jetzt) = self.staende(slug)?;
        Ok(verlauf(&staende, jetzt.date()))
    }

    /// Der Verlauf einer Aufgabe aus der Git-Geschichte (R00123, ADR-0021): die Historie ihrer Datei (Erstellung,
    /// `archived`) und jeder Board-Datei, die die Nummer je führte (Bewegungen), zeitlich zusammengeführt.
    /// „wer“ ist der Commit-Autor. Rein lesend; unbekannte Nummer → 404.
    pub fn karten_verlauf(&self, nummer: u32) -> Result<Kartenverlauf, Fehler> {
        let w = self.ordner().wurzel();
        // Pfad der Aufgabendatei: die vorhandene Datei oder der jüngste gelöschte Pfad mit dieser Nummer (B0573).
        let pfad = match self.ordner().aufgabenpfad(nummer) {
            Ok(p) => p,
            Err(Fehler::NichtGefunden(_)) => match git::pfad_zu_nummer(w, crate::format::aufgabe::ORDNER, nummer)? {
                Some(p) => p,
                None => return Err(Fehler::NichtGefunden(format!("Aufgabe #{nummer} gibt es nicht"))),
            },
            Err(e) => return Err(e),
        };
        let datei = pfad.rsplit('/').next().unwrap_or_default().to_string();
        let aufgabe: Vec<Aufgabenstand> = git::staende(w, &pfad)?
            .into_iter()
            .map(|stand| {
                let archiviert = crate::format::aufgabe::lesen(&datei, &stand.inhalt).ok().and_then(|a| a.archiviert);
                Aufgabenstand { zeitpunkt: stand.zeitpunkt, archiviert, autor: stand.autor }
            })
            .collect();
        let loeschung = if w.join(&pfad).exists() { None } else { git::loeschung(w, &pfad)?.map(|s| (s.zeitpunkt, s.autor)) };
        let (boards, defekte) = self.ordner().boards()?;
        // Alle Board-Stände in einem Zug lesen, dann nur die behalten, in denen sich die Lage der Karte ändert (#131):
        // die Kosten hängen an der Karte, nicht an der Gesamt-Historie aller Boards.
        let pfade: Vec<String> = boards.iter().map(|b| board_pfad(&b.slug)).collect();
        let stands = git::staende_mehrerer(w, &pfade)?;
        // R00120: ein defektes Board weist den Lesenden nicht ab; die Lücke steht sichtbar in der Antwort (#131).
        let luecke: Vec<String> = defekte
            .iter()
            .filter_map(|d| d.pfad.strip_prefix(crate::format::board::ORDNER)?.strip_prefix('/'))
            .filter_map(|name| name.strip_suffix(".md"))
            .filter(|slug| crate::modell::slug_gueltig(slug))
            .map(str::to_string)
            .collect();
        let brett: Vec<(String, Vec<(chrono::NaiveDateTime, Board, git::Autor)>)> = boards
            .iter()
            .zip(stands)
            .map(|(b, staende)| {
                let staende = spuren_wechsel(&staende, nummer).into_iter().filter_map(|s| board::lesen(&b.slug, &s.inhalt).ok().map(|bd| (s.zeitpunkt, bd, s.autor.clone()))).collect();
                (b.slug.clone(), staende)
            })
            .collect();
        Ok(kartenverlauf(nummer, &aufgabe, &brett, loeschung, luecke))
    }

    /// Spaltenwechsel je Aufgabe aus denselben Ständen; Spalten in heutiger Reihenfolge. Je Aufgabe Labels, entfallende
    /// Phasen und `reporting` aus ihrer Datei.
    pub fn bewegungen(&self, slug: &str) -> Result<Bewegungen, Fehler> {
        let (staende, jetzt) = self.staende(slug)?;
        let spalten = staende.last().map(|(_, b)| b.spalten.iter().map(|s| s.name.clone()).collect()).unwrap_or_default();
        let mut bew = bewegungen(&staende, spalten, jetzt);
        let (aufgaben, _) = self.ordner().aufgaben()?;
        for b in &mut bew.aufgaben {
            if let Some(a) = aufgaben.iter().find(|a| a.nummer == b.nummer) {
                b.labels = a.labels.clone();
                b.uebersprungen = a.phasen.uebersprungen.clone();
                b.reporting = a.zaehlung.clone();
            }
        }
        Ok(bew)
    }

    fn staende(&self, slug: &str) -> Result<(Vec<(chrono::NaiveDateTime, Board)>, chrono::NaiveDateTime), Fehler> {
        let aktuell = self.ordner().board(slug)?;
        let rel = board_pfad(&aktuell.slug);
        let mut staende: Vec<_> = git::staende(self.ordner().wurzel(), &rel)?.into_iter().filter_map(|stand| board::lesen(slug, &stand.inhalt).ok().map(|b| (stand.zeitpunkt, b))).collect();
        // Nach Zeitpunkt ordnen: die Commit-Folge muss nicht der Datumsfolge entsprechen (Rebase, gesetzte Daten).
        staende.sort_by_key(|(zp, _)| *zp);
        let jetzt = chrono::Local::now().naive_local();
        if staende.last().map(|(_, b)| b != &aktuell).unwrap_or(true) {
            staende.push((jetzt, aktuell));
        }
        Ok((staende, jetzt))
    }
}
