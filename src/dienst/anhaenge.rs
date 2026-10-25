use super::Kanban;
use crate::fehler::Fehler;
use crate::format::aufgabe;
use crate::modell::Person;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, utoipa::ToSchema)]
pub struct Anhang {
    pub name: String,
    pub groesse: u64,
}

/// Nur der letzte Pfadteil, ohne Steuerzeichen und führende Punkte, höchstens 120 Zeichen.
pub fn anhangname_bereinigen(roh: &str) -> String {
    let letzter = roh.rsplit(['/', '\\']).next().unwrap_or_default();
    let ohne: String = letzter.chars().filter(|c| !c.is_control() && !"<>:\"|?*".contains(*c)).collect();
    let name: String = ohne.trim().trim_start_matches('.').chars().take(120).collect();
    if name.trim().is_empty() { "anhang".into() } else { name.trim().to_string() }
}

/// `name`, oder `stamm-2.endung`, `stamm-3.endung`, … wenn der Name schon vergeben ist.
pub fn freier_name(name: &str, vorhanden: &[String]) -> String {
    if !vorhanden.iter().any(|v| v == name) {
        return name.to_string();
    }
    let (stamm, endung) = match name.rfind('.') {
        Some(i) if i > 0 => (&name[..i], &name[i..]),
        _ => (name, ""),
    };
    (2..).map(|n| format!("{stamm}-{n}{endung}")).find(|k| !vorhanden.contains(k)).expect("unendlich viele Kandidaten")
}

impl Kanban {
    fn anhangordner(&self, nr: u32) -> Result<String, Fehler> {
        let a = self.ordner().aufgabe(nr)?;
        Ok(format!("{}/{}", aufgabe::ORDNER, a.anhangordner()))
    }

    pub fn anhaenge(&self, nr: u32) -> Result<Vec<Anhang>, Fehler> {
        let dir = self.ordner().wurzel().join(self.anhangordner(nr)?);
        let mut liste = vec![];
        if let Ok(eintraege) = std::fs::read_dir(&dir) {
            for e in eintraege.flatten() {
                if e.file_type().map(|t| t.is_file()).unwrap_or(false) {
                    let name = e.file_name().to_string_lossy().to_string();
                    if !name.ends_with(".kanbanD-tmp") {
                        liste.push(Anhang { groesse: e.metadata().map(|m| m.len()).unwrap_or(0), name });
                    }
                }
            }
        }
        liste.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(liste)
    }

    pub fn anhang_ablegen(&self, wer: &Person, nr: u32, roh: &str, inhalt: &[u8]) -> Result<Anhang, Fehler> {
        let _sperre = self.gesperrt();
        let ordner = self.anhangordner(nr)?;
        let vorhanden: Vec<String> = self.anhaenge(nr)?.into_iter().map(|a| a.name).collect();
        let name = freier_name(&anhangname_bereinigen(roh), &vorhanden);
        let rel = format!("{ordner}/{name}");
        self.eigene_merken(&rel);
        let ziel = self.ordner().wurzel().join(&rel);
        std::fs::create_dir_all(ziel.parent().expect("hat Eltern"))?;
        std::fs::write(&ziel, inhalt)?;
        self.committen(wer, &format!("#{nr} Anhang „{name}“ hinzugefügt"), &[rel])?;
        Ok(Anhang { name, groesse: inhalt.len() as u64 })
    }

    /// Pfad (relativ) eines vorhandenen Anhangs.
    pub fn anhangpfad(&self, nr: u32, name: &str) -> Result<String, Fehler> {
        if !self.anhaenge(nr)?.iter().any(|a| a.name == name) {
            return Err(Fehler::NichtGefunden(format!("#{nr} hat keinen Anhang „{name}“")));
        }
        Ok(format!("{}/{name}", self.anhangordner(nr)?))
    }

    pub fn anhang_entfernen(&self, wer: &Person, nr: u32, name: &str) -> Result<(), Fehler> {
        let _sperre = self.gesperrt();
        let rel = self.anhangpfad(nr, name)?;
        self.eigene_merken(&rel);
        let pfad = self.ordner().wurzel().join(&rel);
        std::fs::remove_file(&pfad)?;
        if let Some(dir) = pfad.parent() {
            let _ = std::fs::remove_dir(dir); // nur, wenn leer
        }
        self.committen(wer, &format!("#{nr} Anhang „{name}“ entfernt"), &[rel])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn namen_bereinigen() {
        assert_eq!(anhangname_bereinigen("../../etc/passwd"), "passwd");
        assert_eq!(anhangname_bereinigen("C:\\temp\\bild.png"), "bild.png");
        assert_eq!(anhangname_bereinigen(".env"), "env");
        assert_eq!(anhangname_bereinigen(""), "anhang");
        assert_eq!(anhangname_bereinigen("a\u{0}b?.txt"), "ab.txt");
        assert_eq!(anhangname_bereinigen(&"x".repeat(200)).len(), 120);
    }

    #[test]
    fn freie_namen() {
        let v = vec!["bild.png".to_string(), "bild-2.png".into(), "liesmich".into()];
        assert_eq!(freier_name("neu.png", &v), "neu.png");
        assert_eq!(freier_name("bild.png", &v), "bild-3.png");
        assert_eq!(freier_name("liesmich", &v), "liesmich-2");
    }
}
