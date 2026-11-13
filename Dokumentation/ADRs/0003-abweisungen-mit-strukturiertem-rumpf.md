# ADR-0003: Abweisungen mit strukturiertem Rumpf — eigene Fehlerarten für Grenze (409) und Eigentümer (403)

**Status**: Akzeptiert
**Datum**: 2026-10-31
**Entscheider**: architekt (Software-Factory)
**Kontext-Anforderung**: R00096, R00097
**Nachträge**: 2026-11-13 — Abweisungen des Rahmens in derselben Form: ein eigener Extraktor statt 422-Klartext (Karte #39), siehe [Nachtrag N1](#nachtrag-2026-11-13-n1-formfehler-des-rahmens-in-derselben-form-karte-39). Der Text oberhalb des Nachtrags ist der Stand der Annahme und bleibt unverändert.
**Erprobt durch**: —
**Ergänzt durch**: [ADR-0006](0006-einstellung-verboten-als-dritte-abweisung.md) (dritte Variante `EinstellungVerboten`, 403, R00102)

## Kontext

`Fehler` (`src/fehler.rs`) kennt fünf Arten mit je einem Text; die Web-Schicht macht daraus `{fehler: <text>}` (`src/web/mod.rs`, `IntoResponse`). R00096 verlangt `409 {fehler: "Grenze erreicht", spalte, grenze, anzahl}`, R00097 `403 {fehler: "Spalte „…“ gehört dem Menschen", spalte, nummer}`. 403 gibt es bisher nicht. Agenten sollen auf die Felder reagieren, ohne den Text zu parsen.

## Optionen

### Option A: Fachlich benannte Varianten mit Feldern
- `Fehler::GrenzeErreicht { spalte, grenze, anzahl }` → 409, `Fehler::Verboten { meldung, spalte, nummer }` → 403; `IntoResponse` fügt die Felder an `fehler` an.
- Vorteile: typisiert, der Compiler zwingt jede `match`-Stelle zur Entscheidung; Tests vergleichen Varianten statt Texte.
- Nachteile: je neuer strukturierter Abweisung eine Variante.

### Option B: allgemeine Zusatzfelder an jeder Art (`Konflikt(String, Map)`)
- Vorteile: eine Erweiterung für alles Künftige.
- Nachteile: untypisiert (`serde_json` im Fehlertyp der Dienste), alle bestehenden Konstruktoren ändern sich, Feldnamen nur per Konvention.

### Option C: Text bleibt, Felder im Header oder als eigener Antworttyp der Web-Schicht
- Vorteile: `Fehler` unverändert.
- Nachteile: die Web-Schicht müsste fachliche Felder kennen oder den Text parsen; widerspricht der Form, die R00096/R00097 vorgeben.

## Entscheidung

**Gewählt: Option A**

Zwei Abweisungen mit fester Form rechtfertigen zwei Varianten; der Typ bleibt frei von JSON. Die „Schlüssel mehrfach vergeben“-Abweisung aus R00098 bleibt `Konflikt(String)`, weil sie keine Felder verlangt.

## Konsequenzen

**Positiv:**
- `meldung()` bleibt; der Rumpf behält `fehler` als erstes Feld, Oberfläche und bestehende Clients lesen weiter nur `fehler`.

**Negativ / Inkauf zu nehmen:**
- Jede erschöpfende `match`-Stelle über `Fehler` wird angepasst; OpenAPI (`src/web/openapi.rs`) beschreibt beide Rümpfe zusätzlich.

**Folgeentscheidungen / Aufgaben:**
- [ ] Wird ADR-0001 (Logging) angenommen: beide Varianten als Warning protokollieren.

## Nachtrag 2026-11-13 N1: Formfehler des Rahmens in derselben Form (Karte #39)

**Anlass**: Karte #39 („Typfehler im Rumpf ergeben 422 Klartext statt 400 `{fehler}`", Anmerkung A1 aus dem Entwicklertest von #27). Der Text oben entscheidet, **welche** Form eine Abweisung hat (400 mit `{fehler}`, 409 mit Feldern, 403 mit Feldern), aber nicht, **woher** eine Abweisung kommt. Der Rahmen (Axum) weist einen Rumpf mit falschem JSON-Typ ab, bevor ein Handler ihn sieht, und zwar mit **422** und `text/plain`. ADR-0003 gilt damit für jede Fachprüfung und für keinen Formfehler — die Regel hat ein Loch, durch das jeder Endpunkt fällt. Der Status bleibt `Akzeptiert`; der Nachtrag schließt das Loch, er ändert keine der oben entschiedenen Formen.

**Belegt (Code)**, kanbanD `cc9e553` (gelesen 2026-11-13):
- Jeder schreibende Endpunkt nimmt den Rumpf als `Json<T>` (`src/web/mod.rs:20` Import; z. B. `aufgabe_anlegen` `:374`, `bewegen` `:392`, `board_aendern` `:302`). Die Abweisung des Extraktors entsteht **vor** dem Handler; `Fehler` ist daran nicht beteiligt.
- `impl IntoResponse for Fehler` bildet die Formen oben ab (`:152–181`): `Ungueltig` → 400 mit `{"fehler": …}` (`:180`).
- `serde_path_to_error` liegt bereits im Baum (über `axum 0.8`, `Cargo.lock:945`); eine direkte Nutzung ist eine Zeile in `Cargo.toml` und **keine neue Abhängigkeit**.
- Die Liste der Endpunkte, über die die Probe laufen muss, steht gepflegt in `src/web/endpunkte.rs`.

### Entschieden

1. **Ein Formfehler ist ein Formfehler.** Jede Abweisung des Rahmens — kaputtes JSON, falscher Typ, fehlendes Pflichtfeld — geht durch **einen** eigenen Extraktor (`JsonKoerper<T>`, ein Modul unter `src/web/`) und wird zu `Fehler::Ungueltig` → **400**, `Content-Type: application/json`, Rumpf `{"fehler": "…"}`. Kein Handler fängt sie einzeln.
2. **Die Meldung nennt das Feld.** Der Feldpfad kommt aus `serde_path_to_error` (etwa `grenze`), die Meldung ist deutsch und übernimmt den Rahmen-Text nicht wörtlich. Damit kann ein Agent reagieren, ohne zu raten — derselbe Grund, aus dem R00096/R00097 Felder verlangen.
3. **Pfad und Query tragen dieselbe Form.** `Path`/`Query`-Abweisungen (etwa `{nr}` = `abc`) sind derselbe Fall und laufen über dieselbe Stelle; die Umsetzung darf mit dem Rumpf beginnen, der Rest folgt im selben Zug.
4. **Kein Commit bei einer Abweisung** — das ist heute schon so (die Prüfung liegt vor `aktion()`), die Probe hält es fest.

**Verworfen**:
- **Je Handler `Result<Json<T>, JsonRejection>`** (oder `WithRejection` an jeder Route): dieselbe Form an 20 Stellen, vergessbar, und der nächste Endpunkt fällt wieder durch — genau die Schwäche, wegen der ADR-0003 Option A typisierte Varianten statt allgemeiner Felder gewählt hat.
- **Ein Layer, der 422-Antworten nachträglich auf 400 umschreibt**: müsste den Rahmen-Text parsen oder ersetzen, kennt den Feldpfad nicht und wäre ein zweiter Antwortweg neben `IntoResponse for Fehler` (ADR-0003 Option C, dort schon verworfen).
- **Nur den Status ändern, Text lassen**: `text/plain` bleibt, der Feldname fehlt, die Oberfläche kann die Meldung nicht am Feld anzeigen (R00111-Muster `aria-invalid`/`aria-describedby`).
- **Titel/Steuerzeichen am Eingang abweisen** (verwandt, aber #43): nicht hier — #43 entscheidet über die Commit-Nachricht, nicht über den Rumpf.

### Durchsetzung (Fitness-Funktion)

- **Probe über alle schreibenden Endpunkte**: Liste aus `src/web/endpunkte.rs` (Methode ≠ GET) abgleichen, je Endpunkt einen Rumpf mit falschem Typ senden → 400, `content-type: application/json`, `fehler` nennt den Feldpfad, und `git log` bleibt unverändert. Eine Mutante (ein Endpunkt ohne den Extraktor) muss rot werden, sonst ist die Liste unvollständig.
- **Unit** im Extraktor: kaputtes JSON, falscher Typ, fehlendes Pflichtfeld, falscher Typ in einem verschachtelten Feld — je 400 mit Pfad.
- **Review-Punkt für `code-reviewer`**: `Json<…>` statt `JsonKoerper<…>` an einem schreibenden Endpunkt ist ein Befund; ebenso eine Abweisung, die den Rahmen-Text ungefiltert weitergibt.

**Grenze**: Wortlaut der Meldungen und die genaue Form des Feldpfads (`grenze` gegen `rumpf.grenze`) sind Sache des `entwickler`; ob die Probe als eigener Test oder in `tests/` je Endpunkt läuft, entscheidet die Planung. Die Statuscodes der Fachprüfungen (409, 403, 423) bleiben unberührt.

## Quellen / Bezuege

- `src/fehler.rs`, `src/web/mod.rs` (`impl IntoResponse for Fehler`)
- ADR-0002
- Nachtrag N1: Karte #39 (Anmerkung A1 aus #27); `src/web/mod.rs:20`, `:152–181`, `:302`, `:374`, `:392`; `src/web/endpunkte.rs`; `Cargo.lock:945` (`serde_path_to_error` über `axum 0.8`)
