use crate::modell::Einstellung;
/// Die Länge eines Inhalts fürs Protokoll: `<n Zeichen>` (R00258 FA 13, ADR-0001 N1.8 Regel 1) — der eine Ort im
/// Modell, hier für die Dienst- und Webschicht weitergereicht.
pub use crate::modell::inhalt_laenge;

/// Warum eine Anfrage abgewiesen wurde — eine geschlossene Liste, abgebildet an genau einem Ort
/// (`Fehler::ursache()`, R00258 FA 11, ADR-0001 N1.4 Regel 3). Nie aus dem Text der Meldung gelesen.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ursache {
    Eingabe,
    Fehlt,
    Verboten,
    Konflikt,
    Grenze,
    Defekt,
    ZuGross,
    Zeitgrenze,
    Lesegrenze,
    Antwortbudget,
    Intern,
}

impl Ursache {
    pub fn text(self) -> &'static str {
        match self {
            Ursache::Eingabe => "eingabe",
            Ursache::Fehlt => "fehlt",
            Ursache::Verboten => "verboten",
            Ursache::Konflikt => "konflikt",
            Ursache::Grenze => "grenze",
            Ursache::Defekt => "defekt",
            Ursache::ZuGross => "zu_gross",
            Ursache::Zeitgrenze => "zeitgrenze",
            Ursache::Lesegrenze => "lesegrenze",
            Ursache::Antwortbudget => "antwortbudget",
            Ursache::Intern => "intern",
        }
    }
}

/// Welche Kapazitätsgrenze belegt ist (R00258 FA 11): die Ursache wird nie aus dem Meldungstext gelesen.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Grenze {
    Lesegrenze,
    Antwortbudget,
}

/// Was ein Anwendungsfall melden kann; jede Art hat ihren HTTP-Status.
#[derive(Debug, PartialEq, Eq)]
pub enum Fehler {
    /// Die Eingabe ist unvollständig oder falsch (400).
    Ungueltig(String),
    /// Das Ziel gibt es nicht (404).
    NichtGefunden(String),
    /// Der Zustand erlaubt die Aktion nicht (409).
    Konflikt(String),
    /// Die Datei ist defekt und nur lesbar (423).
    Defekt(String),
    /// Dateisystem oder Git versagen (500).
    Intern(String),
    /// Ein Zug brächte die Spalte über ihre Grenze (409, ADR-0003); `anzahl` ist die Belegung vor dem Zug.
    GrenzeErreicht { spalte: String, grenze: u32, anzahl: u32 },
    /// Ein Agent nähme eine Karte aus einer Spalte, die dem Menschen gehört (403, R00097, ADR-0003).
    Verboten { meldung: String, spalte: String, nummer: u32 },
    /// Ein Agent änderte Grenze oder Eigentümer einer Spalte (403, R00102, ADR-0006); nur über `einstellung_verboten`
    /// anlegen, damit Meldung und Einstellung zusammenpassen.
    EinstellungVerboten { meldung: String, spalte: String, einstellung: Einstellung },
    /// Ein Agent ändert die Art oder den Zustand (`aktiv`) einer Person bzw. legt einen Menschen an (403, Karte #127 und
    /// #137, ADR-0003); nur über `personenart_verboten`/`personenstatus_verboten` anlegen, damit Meldung und Kürzel
    /// zusammenpassen. Beide Wege tragen denselben Rumpf `{fehler, kuerzel}` — je Endpunkt bleibt es eine 403-Form.
    PersonenartVerboten { meldung: String, kuerzel: String },
    /// Ein Commit-Verweis ist ungültig (400) oder steht nicht an der Aufgabe (404, `fehlt`) — Rumpf `{fehler, verweis}` mit
    /// dem Verweis, wie er in der Anfrage stand (R00202, ADR-0032 Punkt 4).
    Verweis { meldung: String, verweis: String, fehlt: bool },
    /// Ein Commit-Verweis steht dem Vorhaben im Weg (409): beim Ersetzen stehen `alt` und `neu` beide an der Aufgabe — Rumpf
    /// `{fehler, verweis}` mit dem `alt`, das sich mit `DELETE` entfernen lässt (R00203, ADR-0032 N1.4).
    VerweisKonflikt { meldung: String, verweis: String },
    /// Ein Git-Prozess im Arbeits-Repository überschritt die Zeitgrenze und wurde beendet (503, ADR-0032 Punkt 3).
    Zeitgrenze(String),
    /// Das Antwortbudget ist belegt (503, ADR-0032 N5.1) — sofort, ohne Warten; der Text beginnt mit „Antwortbudget“.
    /// `grenze` nennt, welche der beiden Kapazitätsgrenzen voll ist (R00258 FA 11).
    Ausgelastet { grenze: Grenze, meldung: String },
    /// Zu diesem Commit-Verweis gibt es keinen Diff (404, R00206 FA 3, ADR-0032 N4.2) — Rumpf `{fehler, zustand, grund?}`
    /// mit dem Zustand, den auch die Commit-Liste nennt.
    Commitzustand { meldung: String, zustand: crate::modell::Commitzustand, grund: Option<String> },
    /// Für die Aufgabe ist „Transkripte erfassen“ wirksam aus (409, R00216 AK 3, ADR-0036 Regel 5) — Rumpf
    /// `{fehler, erfassung: "aus", boards}` mit den Boards der Aufgabe, die aus sind.
    ErfassungAus { meldung: String, boards: Vec<String> },
    /// Die Kennung oder der gefaltete Dateiname eines Transkripts ist an der Aufgabe schon belegt (409, ADR-0036 Regel 2)
    /// — Rumpf `{fehler, kennung}` mit der Kennung des Eintrags, der im Weg steht.
    KennungBelegt { meldung: String, kennung: String },
    /// Das Transkript lässt sich nicht ausliefern (404, ADR-0036 Regel 5) — Rumpf `{fehler, zustand}`.
    Transkriptzustand { meldung: String, zustand: crate::modell::Transkriptzustand },
    /// Der Körper ist größer als erlaubt (413, ADR-0036 Regel 5).
    ZuGross(String),
    /// Ein Agent stellt „Transkripte erfassen“ um (403, R00220 FA 3, ADR-0036 Nachtrag „Umschalten“) — Rumpf
    /// `{fehler, einstellung: "record-transcripts"}`; nur über `schalter_verboten` anlegen.
    SchalterVerboten { meldung: String },
    /// Eine Abweisung, deren Meldung **Inhalt** einsetzt (Aufgaben-Titel, Fehlertext des Parsers, Wert aus Rumpf
    /// oder Query, Commit-Text): der Rumpf nennt ihn wie bisher, das Protokoll nur seine Länge `<n Zeichen>`
    /// (R00258 FA 13, ADR-0001 N1.8 Regel 1). `ursache` bestimmt Status und Protokollfeld; `verweis` füllt den
    /// Rumpf der Verweis-Fehler.
    Inhalt { meldung: String, grund: String, ursache: Ursache, verweis: Option<String> },
}

impl Fehler {
    pub fn meldung(&self) -> &str {
        match self {
            Fehler::Ungueltig(m) | Fehler::NichtGefunden(m) | Fehler::Konflikt(m) | Fehler::Defekt(m) | Fehler::Intern(m) | Fehler::Zeitgrenze(m) | Fehler::Ausgelastet { meldung: m, .. } | Fehler::ZuGross(m) => m,
            Fehler::GrenzeErreicht { .. } => "Grenze erreicht",
            Fehler::Inhalt { meldung, .. } => meldung,
            Fehler::Verboten { meldung, .. } | Fehler::EinstellungVerboten { meldung, .. } | Fehler::PersonenartVerboten { meldung, .. } | Fehler::Verweis { meldung, .. } | Fehler::VerweisKonflikt { meldung, .. } | Fehler::Commitzustand { meldung, .. } | Fehler::ErfassungAus { meldung, .. } | Fehler::KennungBelegt { meldung, .. } | Fehler::Transkriptzustand { meldung, .. } | Fehler::SchalterVerboten { meldung } => meldung,
        }
    }

    /// Warum diese Abweisung — die einzige Abbildung `Fehler` → `Ursache` (R00258 FA 11), nie aus dem Text gelesen.
    pub fn ursache(&self) -> Ursache {
        match self {
            Fehler::Ungueltig(_) => Ursache::Eingabe,
            Fehler::NichtGefunden(_) => Ursache::Fehlt,
            Fehler::Konflikt(_) => Ursache::Konflikt,
            Fehler::Defekt(_) => Ursache::Defekt,
            Fehler::Intern(_) => Ursache::Intern,
            Fehler::GrenzeErreicht { .. } => Ursache::Grenze,
            Fehler::Inhalt { ursache, .. } => *ursache,
            Fehler::Verboten { .. } | Fehler::EinstellungVerboten { .. } | Fehler::PersonenartVerboten { .. } | Fehler::SchalterVerboten { .. } => Ursache::Verboten,
            Fehler::Verweis { fehlt: true, .. } => Ursache::Fehlt,
            Fehler::Verweis { fehlt: false, .. } => Ursache::Eingabe,
            Fehler::VerweisKonflikt { .. } => Ursache::Konflikt,
            Fehler::Zeitgrenze(_) => Ursache::Zeitgrenze,
            Fehler::Ausgelastet { grenze, .. } => match grenze {
                Grenze::Lesegrenze => Ursache::Lesegrenze,
                Grenze::Antwortbudget => Ursache::Antwortbudget,
            },
            Fehler::Commitzustand { .. } | Fehler::Transkriptzustand { .. } => Ursache::Fehlt,
            Fehler::ErfassungAus { .. } | Fehler::KennungBelegt { .. } => Ursache::Konflikt,
            Fehler::ZuGross(_) => Ursache::ZuGross,
        }
    }

    /// Die Fassung der Meldung für das Protokoll, ohne Inhalt (R00258 FA 13, ADR-0001 N1.8 Regel 1): an jeder
    /// Fundstelle, die Inhalt einsetzt, steht dort nur dessen Länge; alles Übrige ist die Meldung selbst.
    pub fn grund_fuer_protokoll(&self) -> String {
        match self {
            Fehler::Inhalt { grund, .. } => grund.clone(),
            anders => anders.meldung().to_string(),
        }
    }

    /// Eine 400, deren Meldung einen Wert aus Rumpf oder Query einsetzt: der Rumpf nennt ihn im Wortlaut, das
    /// Protokoll an seiner Stelle nur `<n Zeichen>` (R00258 FA 13). `vor` und `nach` rahmen den Wert.
    pub fn ungueltig_mit_wert(vor: &str, wert: &str, nach: &str) -> Fehler {
        Fehler::ungueltig_mit_inhalt(format!("{vor}{wert}{nach}"), format!("{vor}{}{nach}", inhalt_laenge(wert)))
    }

    /// Eine 404, deren Meldung einen Wert aus Rumpf oder Query einsetzt (R00258 FA 13).
    pub fn nicht_gefunden_mit_wert(vor: &str, wert: &str, nach: &str) -> Fehler {
        Fehler::nicht_gefunden_mit_inhalt(format!("{vor}{wert}{nach}"), format!("{vor}{}{nach}", inhalt_laenge(wert)))
    }

    /// Eine 409, deren Meldung einen Wert aus Rumpf oder Query einsetzt (R00258 FA 13).
    pub fn konflikt_mit_wert(vor: &str, wert: &str, nach: &str) -> Fehler {
        Fehler::konflikt_mit_inhalt(format!("{vor}{wert}{nach}"), format!("{vor}{}{nach}", inhalt_laenge(wert)))
    }

    /// Eine 400, deren Meldung Inhalt einsetzt (FA 13).
    pub fn ungueltig_mit_inhalt(meldung: impl Into<String>, grund: impl Into<String>) -> Fehler {
        Fehler::Inhalt { meldung: meldung.into(), grund: grund.into(), ursache: Ursache::Eingabe, verweis: None }
    }

    /// Eine 404, deren Meldung Inhalt einsetzt.
    pub fn nicht_gefunden_mit_inhalt(meldung: impl Into<String>, grund: impl Into<String>) -> Fehler {
        Fehler::Inhalt { meldung: meldung.into(), grund: grund.into(), ursache: Ursache::Fehlt, verweis: None }
    }

    /// Eine 423, deren Meldung Inhalt einsetzt (Fehlertext des Parsers).
    pub fn defekt_mit_inhalt(meldung: impl Into<String>, grund: impl Into<String>) -> Fehler {
        Fehler::Inhalt { meldung: meldung.into(), grund: grund.into(), ursache: Ursache::Defekt, verweis: None }
    }

    /// Eine 409, deren Meldung Inhalt einsetzt.
    pub fn konflikt_mit_inhalt(meldung: impl Into<String>, grund: impl Into<String>) -> Fehler {
        Fehler::Inhalt { meldung: meldung.into(), grund: grund.into(), ursache: Ursache::Konflikt, verweis: None }
    }

    /// Ein Verweis-Fehler mit Inhalt: 400, bzw. 404 mit `fehlt: true` (Rumpf `{fehler, verweis}`).
    pub fn verweis_mit_inhalt(meldung: impl Into<String>, grund: impl Into<String>, verweis: String, fehlt: bool) -> Fehler {
        Fehler::Inhalt { meldung: meldung.into(), grund: grund.into(), ursache: if fehlt { Ursache::Fehlt } else { Ursache::Eingabe }, verweis: Some(verweis) }
    }

    /// Ein Verweis-Konflikt (409) mit Inhalt.
    pub fn verweis_konflikt_mit_inhalt(meldung: impl Into<String>, grund: impl Into<String>, verweis: String) -> Fehler {
        Fehler::Inhalt { meldung: meldung.into(), grund: grund.into(), ursache: Ursache::Konflikt, verweis: Some(verweis) }
    }

    /// Die Lesegrenze ist voll (503) — der eine Ort für die Grenzart.
    pub fn lesegrenze(meldung: String) -> Fehler {
        Fehler::Ausgelastet { grenze: Grenze::Lesegrenze, meldung }
    }

    /// Das Antwortbudget ist belegt (503) — der eine Ort für die Grenzart.
    pub fn antwortbudget(meldung: String) -> Fehler {
        Fehler::Ausgelastet { grenze: Grenze::Antwortbudget, meldung }
    }

    /// „Grenze der Spalte „<Name>“ ändern nur Menschen“ bzw. „Eigentümer der Spalte …“ — der eine Ort für den Wortlaut.
    pub fn einstellung_verboten(spalte: &str, einstellung: Einstellung) -> Fehler {
        let was = match einstellung {
            Einstellung::Grenze => "Grenze",
            Einstellung::Eigentuemer => "Eigentümer",
        };
        Fehler::EinstellungVerboten { meldung: format!("{was} der Spalte „{spalte}“ ändern nur Menschen"), spalte: spalte.into(), einstellung }
    }

    /// „Die Art der Person „<Kürzel>“ ändern nur Menschen“ bzw. für eine neue Person „Eine neue Person der Art „human“
    /// legen nur Menschen an“ (Karte #127) — der eine Ort für den Wortlaut.
    pub fn personenart_verboten(kuerzel: &str, neu: bool) -> Fehler {
        let meldung = if neu {
            "Eine neue Person der Art „human“ legen nur Menschen an".to_string()
        } else {
            format!("Die Art der Person „{kuerzel}“ ändern nur Menschen")
        };
        Fehler::PersonenartVerboten { meldung, kuerzel: kuerzel.into() }
    }

    /// „Den Zustand der Person „<Kürzel>“ ändern nur Menschen“ (Karte #137, stilllegen und reaktivieren) — der eine Ort
    /// für den Wortlaut; derselbe Rumpf `{fehler, kuerzel}` wie die Art.
    pub fn personenstatus_verboten(kuerzel: &str) -> Fehler {
        Fehler::PersonenartVerboten { meldung: format!("Den Zustand der Person „{kuerzel}“ ändern nur Menschen"), kuerzel: kuerzel.into() }
    }
}

impl Fehler {
    /// „Den Schalter „Transkripte erfassen“ stellen nur Menschen um“ (R00220 FA 3) — der eine Ort für den Wortlaut, ohne
    /// Schlusspunkt wie die übrigen Meldungen.
    pub fn schalter_verboten() -> Fehler {
        Fehler::SchalterVerboten { meldung: "Den Schalter „Transkripte erfassen“ stellen nur Menschen um".into() }
    }

    /// Ein Abschnitt von `kanbanD.md` lässt sich nicht zeilengenau ändern (R00250, ADR-0043 Regeln 5–7): der eine Ort für
    /// den Wortlaut nach PO Z. 667, gleich für alle Schreibwege; `schluessel` wie in der Datei.
    pub fn handform(schluessel: &str) -> Fehler {
        Fehler::Konflikt(format!("Nicht gespeichert: Der Abschnitt „{schluessel}“ in kanbanD.md ist von Hand gestaltet und lässt sich nicht zeilengenau ändern. Bitte die Änderung direkt in kanbanD.md eintragen."))
    }
}

impl From<std::io::Error> for Fehler {
    fn from(e: std::io::Error) -> Self {
        Fehler::Intern(format!("Dateizugriff: {e}"))
    }
}

/// Eine Modell-Meldung (400) mit getrennten Fassungen für Rumpf und Protokoll (R00258 FA 13) — der eine Ort, an dem
/// die Dienstschicht sie in einen [`Fehler`] umhüllt.
impl From<crate::modell::Meldung> for Fehler {
    fn from(m: crate::modell::Meldung) -> Fehler {
        Fehler::ungueltig_mit_inhalt(m.meldung, m.grund)
    }
}

impl std::fmt::Display for Fehler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.meldung())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // R00258 AK 10 / FA 13: Inhalte stehen im Protokoll nur als Länge, der Rumpf bleibt unverändert
    #[test]
    fn der_grund_fuer_das_protokoll_ersetzt_inhalt_durch_seine_laenge() {
        let f = Fehler::ungueltig_mit_inhalt(
            "„GEHEIM-TITEL-239“: Aufgabe #999 gibt es nicht (braucht:999)",
            format!("„{}“: Aufgabe #999 gibt es nicht (braucht:999)", inhalt_laenge("GEHEIM-TITEL-239")),
        );
        assert_eq!(f.meldung(), "„GEHEIM-TITEL-239“: Aufgabe #999 gibt es nicht (braucht:999)", "der Rumpf bleibt unverändert");
        assert_eq!(f.grund_fuer_protokoll(), "„<16 Zeichen>“: Aufgabe #999 gibt es nicht (braucht:999)");
        assert!(!f.grund_fuer_protokoll().contains("GEHEIM-TITEL-239"));
        assert_eq!(f.ursache(), Ursache::Eingabe);
    }

    #[test]
    fn der_grund_bleibt_die_meldung_wo_kein_inhalt_steht() {
        assert_eq!(Fehler::Ungueltig("Person „zz“ steht nicht in kanbanD.md".into()).grund_fuer_protokoll(), "Person „zz“ steht nicht in kanbanD.md");
        assert_eq!(inhalt_laenge(""), "<0 Zeichen>");
        assert_eq!(inhalt_laenge("äöü"), "<3 Zeichen>", "nach Zeichen, nicht Bytes");
    }

    #[test]
    fn ein_verweis_fehler_mit_inhalt_behaelt_seinen_rumpf_marker() {
        let f = Fehler::verweis_mit_inhalt("„GEHEIM“ passt zu 2 Commit-Verweisen an #1 — längeren Hash nennen", "„<6 Zeichen>“ passt zu 2 Commit-Verweisen an #1 — längeren Hash nennen", "GEHEIM".into(), false);
        assert_eq!(f.ursache(), Ursache::Eingabe);
        assert_eq!(f.grund_fuer_protokoll(), "„<6 Zeichen>“ passt zu 2 Commit-Verweisen an #1 — längeren Hash nennen");
        assert!(matches!(f, Fehler::Inhalt { verweis: Some(v), .. } if v == "GEHEIM"));
    }
}
