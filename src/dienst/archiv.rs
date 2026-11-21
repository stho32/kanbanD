use super::{Kanban, Schritt};
use crate::fehler::Fehler;
use crate::modell::{Aufgabe, Person};
use crate::uhr;

impl Kanban {
    /// Setzt `archived` auf heute und beendet laufende Timer; Datei und Board-Zeile bleiben.
    /// Ein Agent nicht, wenn eine Board-Datei des Ordners defekt ist (423, R00120) oder — bei lesbarem Ordner — die Karte
    /// auf einem Board in einer Menschen-Spalte liegt (403, R00097); die 423 geht der 403 vor (R00159, ADR-0003 N2).
    pub fn archivieren(&self, wer: &Person, nr: u32) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| {
            if a.archiviert.is_some() {
                return Err(Fehler::Konflikt(format!("#{nr} ist schon archiviert")));
            }
            self.archivieren_pruefen(wer, &[nr])?;
            let jetzt = uhr::jetzt();
            let mut gestoppt = 0;
            for z in a.zeiten.iter_mut().filter(|z| z.ende.is_none()) {
                z.ende = Some(jetzt.clone());
                gestoppt += 1;
            }
            a.archiviert = Some(uhr::heute());
            a.reservierung = None;
            Ok(Some(match gestoppt {
                0 => format!("#{nr} archiviert"),
                n => format!("#{nr} archiviert, {n} Timer gestoppt"),
            }))
        })
    }

    /// Agent: 409, wenn die Karte dadurch auf einem Board über die Grenze käme (R00096).
    pub fn zurueckholen(&self, wer: &Person, nr: u32) -> Result<Aufgabe, Fehler> {
        self.aufgabe_schreiben(wer, nr, |a| {
            zurueckgeholt(a)?;
            self.zurueckholen_pruefen(wer, &[nr])?;
            Ok(Some(format!("#{nr} zurückgeholt")))
        })
    }
}

impl Kanban {
    /// Endgültig löschen (R00141, ADR-0024): die **dritte Bewegung** der Archiv-Familie neben archivieren/zurückholen.
    /// Entfernt die Aufgabendatei, ihre Zeile aus **allen** Board-Dateien und ihren Anhangsordner in **einem** Commit
    /// unter derselben Sperre `gesperrt()` wie ihre Geschwister; nur die Git-Geschichte behält die Karte. Ein Agent wird
    /// bei einem defekten Board des Ordners **423** abgewiesen (R00120), sonst aus einer Menschen-Spalte **403** (R00097)
    /// — die 423 geht der 403 vor (R00159, ADR-0003 N2); nichts geändert, kein Commit. Der Löschweg braucht nur den Pfad (`aufgabenpfad`), nicht das Modell — eine defekte
    /// Aufgabendatei lässt sich damit entfernen. Rückgabe ist die Nummer (Antwort `{nummer}`).
    pub fn endgueltig_loeschen(&self, wer: &Person, nr: u32) -> Result<u32, Fehler> {
        let _sperre = self.gesperrt();
        let pfad = self.ordner().aufgabenpfad(nr)?;
        // Prüfung vor jedem Schreiben: Agent bei defektem Board des Ordners 423, erst danach aus einer Menschen-Spalte 403.
        self.archivieren_pruefen(wer, &[nr])?;
        let mut schritte = vec![];
        let mut boardzahl = 0;
        let (boards, _) = self.ordner().boards()?;
        for b in boards.iter().filter(|b| b.spalte_von(nr).is_some()) {
            let mut b = b.clone();
            b.abnehmen(nr);
            boardzahl += 1;
            schritte.push(Schritt::schreiben(crate::ablage::board_pfad(&b.slug), self.board_text(&b, None)?));
        }
        let anhaenge = self.anhangdateien(&pfad);
        let anzahl = anhaenge.len();
        schritte.push(Schritt::entfernen(pfad.clone()));
        schritte.extend(anhaenge.into_iter().map(Schritt::entfernen));
        let nachricht = loeschnachricht(nr, anzahl, boardzahl);
        self.aktion(wer, &nachricht, &schritte)?;
        let _ = std::fs::remove_dir(self.ordner().wurzel().join(pfad.strip_suffix(".md").unwrap_or(&pfad)));
        // R00216, ADR-0036 Regel 9: eine neue Aufgabe mit derselben Nummer erbt nie ein fremdes Transkript
        if let Err(grund) = super::transkripte::ordner_raeumen(self.ordner().wurzel(), nr) {
            eprintln!("Warnung: #{nr} gelöscht, aber {grund} — die Reste haben keinen Eintrag und werden beim nächsten gleichnamigen Upload überschrieben");
        }
        self.timer_beginn.lock().unwrap_or_else(|e| e.into_inner()).retain(|(n, _), _| *n != nr);
        Ok(nr)
    }

    /// Die Dateien des Anhangsordners `aufgaben/<nr>-<slug>/` (relativ, sortiert); ohne Ordner keine. Die halbfertigen
    /// `.kanbanD-tmp`-Dateien des Schreibwegs zählen nicht.
    fn anhangdateien(&self, aufgabenpfad: &str) -> Vec<String> {
        let ordner = aufgabenpfad.strip_suffix(".md").unwrap_or(aufgabenpfad).to_string();
        let mut dateien = vec![];
        if let Ok(eintraege) = std::fs::read_dir(self.ordner().wurzel().join(&ordner)) {
            for e in eintraege.flatten() {
                let name = e.file_name().to_string_lossy().to_string();
                if !name.ends_with(".kanbanD-tmp") && e.file_type().map(|t| t.is_file()).unwrap_or(false) {
                    dateien.push(format!("{ordner}/{name}"));
                }
            }
        }
        dateien.sort();
        dateien
    }
}

/// Die Commit-Nachricht der Löschung (R00141): `#<nr> gelöscht`, bei Anhängen `, k Anhänge`, bei mehreren Boards
/// ` (m Boards)` — Muster `#<nr> archiviert`.
fn loeschnachricht(nr: u32, anhaenge: usize, boards: usize) -> String {
    let mut text = format!("#{nr} gelöscht");
    match anhaenge {
        0 => {}
        1 => text.push_str(", 1 Anhang"),
        n => text.push_str(&format!(", {n} Anhänge")),
    }
    if boards > 1 {
        text.push_str(&format!(" ({boards} Boards)"));
    }
    text
}

impl Kanban {
    /// Archiviert bzw. holt mehrere Aufgaben in einem Commit zurück; eine unbekannte Nummer ändert nichts.
    pub fn mehrere_archivieren(&self, wer: &Person, nummern: &[u32], archivieren: bool) -> Result<Vec<u32>, Fehler> {
        if nummern.is_empty() {
            return Err(Fehler::Ungueltig("Keine Aufgabe angegeben".into()));
        }
        super::ohne_doppelte(nummern.iter().copied())?;
        let _sperre = self.gesperrt();
        let mut geaendert = vec![];
        let mut dateien = vec![];
        let jetzt = uhr::jetzt();
        for nr in nummern {
            let mut a = self.ordner().aufgabe(*nr)?;
            if a.archiviert.is_some() == archivieren {
                continue;
            }
            if archivieren {
                for z in a.zeiten.iter_mut().filter(|z| z.ende.is_none()) {
                    z.ende = Some(jetzt.clone());
                }
                a.archiviert = Some(uhr::heute());
                a.reservierung = None;
            } else {
                zurueckgeholt(&mut a)?;
            }
            geaendert.push(*nr);
            dateien.push(Schritt::schreiben(format!("{}/{}", crate::format::aufgabe::ORDNER, a.datei), crate::format::aufgabe::schreiben(&a)));
        }
        if archivieren && !geaendert.is_empty() {
            self.archivieren_pruefen(wer, &geaendert)?;
        }
        if !archivieren && !geaendert.is_empty() {
            self.zurueckholen_pruefen(wer, &geaendert)?;
        }
        if !geaendert.is_empty() {
            let liste = geaendert.iter().map(|n| format!("#{n}")).collect::<Vec<_>>().join(", ");
            let tat = if archivieren { "archiviert" } else { "zurückgeholt" };
            let nachricht = match geaendert.len() {
                1 => format!("{liste} {tat}"),
                n => format!("{liste} {tat} ({n} Aufgaben)"),
            };
            self.aktion(wer, &nachricht, &dateien)?;
        }
        Ok(geaendert)
    }
}

/// Zurückholen-Kern (ADR-0005): ohne Sperre und ohne Commit — die Aufgabe im Speicher verliert `archived`.
/// Die Zugregel prüft die Hülle, weil erst sie weiß, auf welchen Boards die Karte liegt.
pub(super) fn zurueckgeholt(a: &mut Aufgabe) -> Result<(), Fehler> {
    match a.archiviert.take() {
        Some(_) => Ok(()),
        None => Err(Fehler::Konflikt(format!("#{} ist nicht archiviert", a.nummer))),
    }
}

#[cfg(test)]
mod tests {
    use super::{loeschnachricht, zurueckgeholt};
    use crate::fehler::Fehler;
    use crate::modell::Aufgabe;

    #[test]
    fn zurueckholen_kern() {
        let mut a = Aufgabe::neu(7, "0007-x.md".into(), "x".into());
        a.archiviert = Some("2026-11-01".into());
        assert!(zurueckgeholt(&mut a).is_ok());
        assert_eq!(a.archiviert, None);
        match zurueckgeholt(&mut a) {
            Err(Fehler::Konflikt(t)) => assert_eq!(t, "#7 ist nicht archiviert"),
            anders => panic!("{anders:?}"),
        }
    }

    // B0636 (R00141, FA 3): die Lösch-Nachricht — Muster `#<nr> archiviert`, Anhänge und mehrere Boards.
    #[test]
    fn loeschen_nachricht() {
        assert_eq!(loeschnachricht(1, 0, 0), "#1 gelöscht");
        assert_eq!(loeschnachricht(1, 0, 1), "#1 gelöscht");
        assert_eq!(loeschnachricht(1, 1, 1), "#1 gelöscht, 1 Anhang");
        assert_eq!(loeschnachricht(1, 2, 2), "#1 gelöscht, 2 Anhänge (2 Boards)");
        assert_eq!(loeschnachricht(7, 0, 3), "#7 gelöscht (3 Boards)");
    }

    // B0636 (R00141, Ablauf 2.4): ein laufender Timer der Nummer endet mit der Datei — der Startzeitpunkt wird verworfen.
    #[test]
    fn loeschen_verwirft_den_laufenden_timer() {
        use super::Kanban;
        use std::path::Path;
        use std::process::Command;

        fn git(p: &Path, a: &[&str]) -> String {
            let o = Command::new("git").args(a).current_dir(p).output().unwrap();
            String::from_utf8_lossy(&o.stdout).trim().to_string()
        }

        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join("boards")).unwrap();
        std::fs::create_dir_all(tmp.path().join("aufgaben")).unwrap();
        std::fs::write(tmp.path().join("kanbanD.md"), "---\npeople:\n  cl: {name: Claude, kind: agent}\n  st: {name: Stefan, kind: human}\n---\n").unwrap();
        std::fs::write(tmp.path().join("boards/a.md"), "# A\n\n## Bereit\n\n- #1\n").unwrap();
        std::fs::write(tmp.path().join("aufgaben/0001-eins.md"), "---\nid: 1\ntitle: eins\n---\n").unwrap();
        git(tmp.path(), &["init", "-q"]);
        git(tmp.path(), &["add", "-A"]);
        git(tmp.path(), &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "a"]);
        let k = Kanban::neu(tmp.path().to_path_buf());
        let cl = k.handelnder(Some("cl")).unwrap();
        let st = k.handelnder(Some("st")).unwrap();
        k.timer_starten(&cl, 1).unwrap();
        assert!(k.timer_beginn.lock().unwrap().contains_key(&(1, "cl".to_string())), "der Timer läuft");
        assert_eq!(k.endgueltig_loeschen(&st, 1).unwrap(), 1);
        assert!(!k.timer_beginn.lock().unwrap().contains_key(&(1, "cl".to_string())), "der Startzeitpunkt ist verworfen");
        assert!(!tmp.path().join("aufgaben/0001-eins.md").exists());
    }
}
