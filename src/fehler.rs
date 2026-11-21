use crate::modell::Einstellung;

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
    Ausgelastet(String),
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
}

impl Fehler {
    pub fn meldung(&self) -> &str {
        match self {
            Fehler::Ungueltig(m) | Fehler::NichtGefunden(m) | Fehler::Konflikt(m) | Fehler::Defekt(m) | Fehler::Intern(m) | Fehler::Zeitgrenze(m) | Fehler::Ausgelastet(m) | Fehler::ZuGross(m) => m,
            Fehler::GrenzeErreicht { .. } => "Grenze erreicht",
            Fehler::Verboten { meldung, .. } | Fehler::EinstellungVerboten { meldung, .. } | Fehler::PersonenartVerboten { meldung, .. } | Fehler::Verweis { meldung, .. } | Fehler::VerweisKonflikt { meldung, .. } | Fehler::Commitzustand { meldung, .. } | Fehler::ErfassungAus { meldung, .. } | Fehler::KennungBelegt { meldung, .. } | Fehler::Transkriptzustand { meldung, .. } | Fehler::SchalterVerboten { meldung } => meldung,
        }
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
}

impl From<std::io::Error> for Fehler {
    fn from(e: std::io::Error) -> Self {
        Fehler::Intern(format!("Dateizugriff: {e}"))
    }
}

impl std::fmt::Display for Fehler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.meldung())
    }
}
