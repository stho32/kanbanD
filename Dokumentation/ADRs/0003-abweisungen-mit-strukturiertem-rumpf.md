# ADR-0003: Abweisungen mit strukturiertem Rumpf — eigene Fehlerarten für Grenze (409) und Eigentümer (403)

**Status**: Akzeptiert
**Datum**: 2026-10-31
**Entscheider**: architekt (Software-Factory)
**Kontext-Anforderung**: R00096, R00097
**Erprobt durch**: —

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

## Quellen / Bezuege

- `src/fehler.rs`, `src/web/mod.rs` (`impl IntoResponse for Fehler`)
- ADR-0002
