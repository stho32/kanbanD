//! OpenAPI-Beschreibung (R00093): Erzeugt aus den Rust-Typen und den `#[utoipa::path]` der Handler. Die Typen hier
//! beschreiben nur Antworten, die ein Handler als `json!` baut — damit auch sie ein Schema haben.

use utoipa::OpenApi;

/// Hausregel der Texte (R00120, Punkt 4): Nach einem Doppelpunkt, der einen Satz einleitet (nach einer Klammer oder
/// am Absatzanfang), beginnt der Satz groß; ein Doppelpunkt innerhalb einer Aufzählung oder Klammer bleibt klein.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "kanbanD",
        description = "Kanban-Boards als Markdown-Dateien in einem Git-Repository; Menschen im Browser, KI-Agenten über diese API.\n\n\
Jeder schreibende Aufruf nennt im Header `X-KanbanD-Wer` die handelnde Person (Kürzel aus `kanbanD.md`); kanbanD committet unter ihrem Namen. \
Mehrere Agenten an einem Board nennen zusätzlich `X-KanbanD-Instanz` (eigene Kennung je laufender Instanz) für Reservieren und Ziehen.\n\n\
Spalten mit Eigentümer (`column-owner`: `human` | `agent`): Aus einer Spalte, die dem Menschen gehört, nimmt ein Agent keine Karte (403 `Verboten`); \
ein Eintrag unter `column-owner`, der kein Skalar ist oder den Menschen meint (`human`/`mensch` in jeder Schreibweise), sperrt Agenten fail-safe (403) — gebunden seine Spalte, ungebunden das ganze Board; \
die Sperre beruht auf `X-KanbanD-Wer` und schützt vor Versehen, nicht vor Angriffen. \
Grenze und Eigentümer einer Spalte ändern über `PUT …/spalten` nur Menschen (403 `EinstellungVerboten`). \
Die Art einer Person (`art`) und den Zustand (`aktiv`: stilllegen, reaktivieren) einer Person der Art `human` setzen nur Menschen (403 `PersonenartVerboten` an `POST /api/personen`, `PATCH /api/personen/{kuerzel}`, `DELETE /api/personen/{kuerzel}` und `PUT /api/einstellungen`). \
Bekannte Grenze: Wer `X-KanbanD-Wer` eines Menschen nennt, kommt durch — die Regeln schützen vor Versehen, nicht vor Absicht.\n\n\
Antwortregel: Ein Objekt kommt direkt, eine Liste verpackt unter ihrem Sammlungsnamen (`{\"aufgaben\": […]}`), weil Listen Zusatzangaben tragen; \
ältere Listen-Endpunkte liefern ein Array. Statusantworten wie `{geaendert}` bleiben. Fehler: `{\"fehler\": \"…\"}`.\n\n\
Zeitpunkte: `JJJJ-MM-TT HH:MM±HH:MM` (Ortszeit mit Versatz); Eingaben auch als ISO mit `T`, mit `Z` oder ohne Versatz (dann Ortszeit). \
Dauern: `0:45`, `1,5` (Stunden), `90 min`."
    ),
    tags(
        (name = "Ordner"), (name = "Boards"), (name = "Aufgaben"), (name = "Zeiten"), (name = "Personen"),
        (name = "Reservierungen"), (name = "Anwendungen"), (name = "Berichte"), (name = "API")
    )
)]
pub struct ApiDoc;

/// Fehlerantwort der Endpunkte: 400 ungültig, 404 nicht gefunden, 409 Konflikt, 423 Datei defekt, 500 Git oder Dateisystem.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct Fehlerantwort {
    pub fehler: String,
}

/// 409 eines Agenten-Zugs über die WIP-Grenze (R00096, ADR-0003): `fehler` zuerst, dann die erste verletzte Spalte
/// von links, ihre Grenze und die Anzahl zählender Karten vor dem Zug.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct GrenzeErreicht {
    /// immer „Grenze erreicht“
    pub fehler: String,
    pub spalte: String,
    pub grenze: u32,
    pub anzahl: u32,
}

/// 403 eines Agenten, der eine Karte aus einer Spalte nähme, die dem Menschen gehört (R00097, ADR-0003): `fehler` zuerst
/// („Spalte „<Name>“ gehört dem Menschen“; bei einem ungebundenen `human`-Eintrag der board-weite Text), dann die
/// Spalte (im board-weiten Fall leer) und die erste gesperrte Karte in Anfragereihenfolge.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct Verboten {
    pub fehler: String,
    pub spalte: String,
    pub nummer: u32,
}

/// 403 eines Agenten, der über `PUT …/spalten` Grenze oder Eigentümer einer Spalte ändert (R00102, ADR-0006): `fehler`
/// zuerst („Grenze der Spalte „<Name>“ ändern nur Menschen“ bzw. „Eigentümer …“), dann der erste Spaltenname, unter dem
/// `limits` oder `column-owner` danach anders steht, und welche Einstellung — Namen der Anfrage von links, dann bisherige
/// Namen, die fehlen, je Name `grenze` vor `eigentuemer`.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct EinstellungVerboten {
    pub fehler: String,
    pub spalte: String,
    pub einstellung: crate::modell::Einstellung,
}

/// 403 eines Agenten, der die Art oder den Zustand (`aktiv`) einer Person setzt (Karte #127 und #137, ADR-0003): `fehler`
/// zuerst („Die Art der Person „<Kürzel>“ ändern nur Menschen“; für eine neue Person „Eine neue Person der Art „human“
/// legen nur Menschen an“; „Den Zustand der Person „<Kürzel>“ ändern nur Menschen“), dann das Kürzel der Person, deren
/// `art` oder `aktiv` gesetzt würde.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct PersonenartVerboten {
    pub fehler: String,
    pub kuerzel: String,
}

/// 400 eines ungültigen oder 404 eines an der Aufgabe fehlenden Commit-Verweises (R00202, ADR-0032 Punkt 4): `fehler`
/// zuerst, dann der Verweis, wie er in der Anfrage stand.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct Verweisfehler {
    pub fehler: String,
    pub verweis: String,
}

/// 409 der Endpunkte mit WIP-Grenze (R00096): Ein Agent über der Grenze bekommt [`GrenzeErreicht`], jeder andere Konflikt
/// die [`Fehlerantwort`]. Nur für die Beschreibung.
#[derive(serde::Serialize, utoipa::ToSchema)]
#[serde(untagged)]
#[allow(dead_code)]
pub enum Konflikt {
    GrenzeErreicht(GrenzeErreicht),
    Fehlerantwort(Fehlerantwort),
}

/// Ob ein Aufruf etwas geändert (und committet) hat.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct Geaendert {
    pub geaendert: bool,
}

/// Antwort der endgültigen Löschung: die Nummer der entfernten Aufgabe.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct Nummer {
    pub nummer: u32,
}

/// Slug des angelegten Boards.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct BoardAngelegt {
    pub board: String,
}

/// Spalte, in der die Aufgabe jetzt liegt.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct SpalteAntwort {
    pub spalte: String,
}

#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct Genommen {
    pub genommen: bool,
}

#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct Entfernt {
    pub entfernt: bool,
}

/// Zahl der neu in den Cache aufgenommenen Tage.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct Neu {
    pub neu: usize,
}

#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct Verworfen {
    pub verworfen: bool,
}

#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct Fiebercache {
    pub abschnitte: Vec<crate::format::fieber::Fieberabschnitt>,
}

/// Aufgaben samt den Dateien unter `aufgaben/`, die sich nicht lesen lassen.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct Aufgabenliste {
    pub aufgaben: Vec<crate::modell::Aufgabe>,
    pub defekte: Vec<crate::ablage::DefekteDatei>,
}

#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct Personenliste {
    pub personen: Vec<crate::modell::Person>,
}

/// Die Aufgabe direkt, dazu Pfad und Text ihrer Datei.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct AufgabeMitDatei {
    #[serde(flatten)]
    pub aufgabe: crate::modell::Aufgabe,
    pub pfad: String,
    pub text: String,
}

/// Eine defekte Aufgabendatei: nur lesbar, bis sie repariert ist.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct DefekteAufgabe {
    pub fehler: String,
    pub pfad: String,
    pub text: String,
}

/// Rumpf von `POST …/ziehen`; `instanz` ersetzt den Header `X-KanbanD-Instanz`.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct ZugMitInstanz {
    /// Spalte, aus der die oberste freie Karte genommen wird
    pub von: String,
    /// Zielspalte; ohne: die Spalte rechts von `von`
    pub nach: Option<String>,
    pub instanz: Option<String>,
}

/// Freiwilliger Rumpf von Reservieren und Freigeben: die Instanz, wenn kein Header gesetzt werden kann.
#[derive(serde::Serialize, utoipa::ToSchema)]
pub struct InstanzAngabe {
    /// 1–64 Zeichen aus A–Z, a–z, 0–9, `.`, `_`, `-`
    pub instanz: Option<String>,
}
