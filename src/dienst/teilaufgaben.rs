use super::Kanban;
use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Person, Teilaufgabe};
use serde::Deserialize;

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Teilaufgabenaenderung {
    pub erledigt: Option<bool>,
    pub text: Option<String>,
    /// Neue Stelle in der Liste (0-basiert); außerhalb der Liste heißt „ans Ende“ (R00067).
    pub position: Option<usize>,
}

fn text_pruefen(t: &str) -> Result<String, Fehler> {
    let t = t.trim();
    if t.is_empty() {
        return Err(Fehler::Ungueltig("Die Teilaufgabe braucht einen Text".into()));
    }
    Ok(t.replace('\n', " "))
}

fn position(a: &Aufgabe, i: usize) -> Result<(), Fehler> {
    if i >= a.teilaufgaben.len() {
        return Err(Fehler::NichtGefunden(format!("#{} hat keine Teilaufgabe an Position {i}", a.nummer)));
    }
    Ok(())
}

impl Kanban {
    pub fn teilaufgabe_anlegen(&self, wer: &Person, nr: u32, text: &str) -> Result<Aufgabe, Fehler> {
        let text = text_pruefen(text)?;
        self.aufgabe_schreiben(wer, nr, |a| {
            a.teilaufgaben.push(Teilaufgabe { text: text.clone(), erledigt: false });
            Ok(Some(format!("#{nr} Teilaufgabe „{text}“ ergänzt")))
        })
    }

    pub fn teilaufgaben_anlegen(&self, wer: &Person, nr: u32, texte: &[String]) -> Result<Aufgabe, Fehler> {
        let texte: Vec<String> = texte.iter().map(|t| text_pruefen(t)).collect::<Result<_, _>>()?;
        if texte.is_empty() {
            return Err(Fehler::Ungueltig("Keine Teilaufgabe angegeben".into()));
        }
        self.aufgabe_schreiben(wer, nr, |a| {
            a.teilaufgaben.extend(texte.iter().map(|t| Teilaufgabe { text: t.clone(), erledigt: false }));
            Ok(Some(match texte.as_slice() {
                [t] => format!("#{nr} Teilaufgabe „{t}“ ergänzt"),
                alle => format!("#{nr} {} Teilaufgaben ergänzt", alle.len()),
            }))
        })
    }

    pub fn teilaufgabe_aendern(&self, wer: &Person, nr: u32, i: usize, aend: &Teilaufgabenaenderung) -> Result<Aufgabe, Fehler> {
        let neuer_text = aend.text.as_deref().map(text_pruefen).transpose()?;
        self.aufgabe_schreiben(wer, nr, |a| {
            position(a, i)?;
            let t = &mut a.teilaufgaben[i];
            let vorher = t.clone();
            if let Some(e) = aend.erledigt {
                t.erledigt = e;
            }
            if let Some(n) = &neuer_text {
                t.text = n.clone();
            }
            let t = t.clone();
            let ziel = aend.position.map(|p| p.min(a.teilaufgaben.len() - 1)).filter(|z| *z != i);
            if let Some(z) = ziel {
                let weg = a.teilaufgaben.remove(i);
                a.teilaufgaben.insert(z, weg);
            }
            Ok(match (vorher.erledigt != t.erledigt, vorher.text != t.text, ziel) {
                (_, true, _) => Some(format!("#{nr} Teilaufgabe „{}“ geändert", t.text)),
                (_, false, Some(z)) => Some(format!("#{nr} Teilaufgabe „{}“ an Position {} verschoben", t.text, z + 1)),
                (true, false, None) if t.erledigt => Some(format!("#{nr} Teilaufgabe „{}“ erledigt", t.text)),
                (true, false, None) => Some(format!("#{nr} Teilaufgabe „{}“ wieder offen", t.text)),
                (false, false, None) => None,
            })
        })
    }

    pub fn teilaufgabe_entfernen(&self, wer: &Person, nr: u32, i: usize) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| {
            position(a, i)?;
            let t = a.teilaufgaben.remove(i);
            Ok(Some(format!("#{nr} Teilaufgabe „{}“ entfernt", t.text)))
        })
    }
}
