use super::Kanban;
use crate::ablage::board_pfad;
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::{Art, Aufgabe, Aufgabenaenderung, Person};
use serde::Deserialize;

/// Felder, die schon beim Anlegen gesetzt werden (Schnelleingabe).
#[derive(Debug, Clone, Default, Deserialize, utoipa::ToSchema)]
pub struct Angaben {
    pub klasse: Option<String>,
    pub zustaendige: Option<Vec<String>>,
    pub labels: Option<Vec<String>>,
    pub faellig: Option<String>,
    pub herkunft: Option<Vec<String>>,
    pub beschreibung: Option<String>,
    pub teilaufgaben: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize, utoipa::ToSchema)]
pub struct NeueAufgabe {
    pub titel: String,
    pub board: Option<String>,
    pub spalte: Option<String>,
    #[serde(flatten)]
    pub angaben: Angaben,
}

/// Eine neue Aufgabe in einer Liste: nur der Titel oder Titel mit Angaben.
#[derive(Debug, Clone, Deserialize, utoipa::ToSchema)]
#[serde(untagged)]
pub enum Eintrag {
    Titel(String),
    MitAngaben {
        titel: String,
        #[serde(flatten)]
        angaben: Angaben,
    },
}

#[derive(Debug, Clone, Deserialize, utoipa::ToSchema)]
pub struct NeueAufgaben {
    pub titel: Vec<Eintrag>,
    pub board: Option<String>,
    pub spalte: Option<String>,
}

impl Eintrag {
    fn teile(&self) -> (&str, Option<&Angaben>) {
        match self {
            Eintrag::Titel(t) => (t.trim(), None),
            Eintrag::MitAngaben { titel, angaben } => (titel.trim(), Some(angaben)),
        }
    }
}

impl Kanban {
    /// Legt die Aufgabendatei an und hängt sie, wenn verlangt, unten an eine Spalte — ein Commit.
    pub fn aufgabe_anlegen(&self, wer: &Person, neu: &NeueAufgabe) -> Result<Aufgabe, Fehler> {
        let eintrag = Eintrag::MitAngaben { titel: neu.titel.clone(), angaben: neu.angaben.clone() };
        let mehrere = NeueAufgaben { titel: vec![eintrag], board: neu.board.clone(), spalte: neu.spalte.clone() };
        Ok(self.aufgaben_anlegen(wer, &mehrere)?.remove(0))
    }

    /// Mehrere Aufgaben mit fortlaufenden Nummern in der Reihenfolge der Liste — ein Commit für alle.
    pub fn aufgaben_anlegen(&self, wer: &Person, neu: &NeueAufgaben) -> Result<Vec<Aufgabe>, Fehler> {
        let eintraege: Vec<(&str, Option<&Angaben>)> = neu.titel.iter().map(Eintrag::teile).collect();
        if eintraege.is_empty() || eintraege.iter().any(|(t, _)| t.is_empty()) {
            return Err(Fehler::Ungueltig("Jede Aufgabe braucht einen Titel".into()));
        }
        let e = self.ordner().einstellungen()?.unwrap_or_default();
        let _sperre = self.gesperrt();
        let erste = self.ordner().naechste_nummer()?;
        let mut aufgaben = vec![];
        for (i, (t, angaben)) in eintraege.iter().enumerate() {
            let nummer = erste + i as u32;
            let mut a = Aufgabe::neu(nummer, aufgabe::dateiname(nummer, t), t.to_string());
            if wer.art == Art::Mensch {
                a.zustaendige.push(wer.kuerzel.clone());
            }
            if let Some(g) = angaben {
                let aenderung = Aufgabenaenderung {
                    klasse: g.klasse.clone().map(Some),
                    zustaendige: g.zustaendige.clone(),
                    labels: g.labels.clone(),
                    faellig: g.faellig.clone().map(Some),
                    herkunft: g.herkunft.clone(),
                    beschreibung: g.beschreibung.clone(),
                    ..Default::default()
                };
                a.aendern(&aenderung, &e).map_err(|f| Fehler::Ungueltig(format!("„{t}“: {f}")))?;
                let teile = g.teilaufgaben.iter().flatten().map(|x| x.trim().replace('\n', " ")).filter(|x| !x.is_empty());
                a.teilaufgaben.extend(teile.map(|text| crate::modell::Teilaufgabe { text, erledigt: false }));
            }
            aufgaben.push(a);
        }
        let mut dateien: Vec<(String, String)> = aufgaben.iter().map(|a| (format!("{}/{}", aufgabe::ORDNER, a.datei), aufgabe::schreiben(a))).collect();
        let mut nachricht = match aufgaben.as_slice() {
            [a] => format!("#{} „{}“ angelegt", a.nummer, a.titel),
            alle => format!("#{}–#{} angelegt ({} Aufgaben)", erste, erste + alle.len() as u32 - 1, alle.len()),
        };
        if let Some(slug) = &neu.board {
            let mut b = self.ordner().board(slug)?;
            let spaltenname = match &neu.spalte {
                Some(s) => s.clone(),
                None => b.spalten.first().map(|s| s.name.clone()).ok_or_else(|| Fehler::Ungueltig(format!("Board „{}“ hat keine Spalte", b.titel)))?,
            };
            let spalte = b.spalte_mut(&spaltenname).ok_or_else(|| Fehler::Ungueltig(format!("Spalte „{spaltenname}“ gibt es auf „{slug}“ nicht")))?;
            spalte.aufgaben.extend(aufgaben.iter().map(|a| a.nummer));
            nachricht.push_str(&format!(" in „{spaltenname}“ ({})", b.titel));
            let (vorhanden, _) = self.ordner().aufgaben()?;
            let text = crate::format::board::schreiben(&b, |nr| aufgaben.iter().chain(vorhanden.iter()).find(|a| a.nummer == nr).map(|a| a.datei.clone()));
            dateien.push((board_pfad(&b.slug), text));
        }
        self.aktion(wer, &nachricht, &dateien)?;
        Ok(aufgaben)
    }
}
