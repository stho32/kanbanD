---
id: R00069
status: Erledigt
datum: 2026-10-20
---

# R00069: Spaltenkommentar und Spaltenfarbe

## Beschreibung

Eine Spalte kann einen Kommentar und eine eigene Hintergrundfarbe tragen. Der Kommentar erklärt, was in der Spalte gilt (z. B. „nur mit grünem Build“); im Spaltenkopf steht dann ein ⓘ, das beim Überfahren den Kommentar als Tooltip zeigt. Die Farbe hebt eine Spalte visuell hervor.

Beides wird in den Spalteneinstellungen des Boards gepflegt und steht in der Board-Datei im Frontmatter, neben `limits`, `column-phases` und `column-checks`:

```yaml
column-notes:
  Code-Review: Nur mit grünem Build
column-colors:
  Code-Review: "#ffe8b0"
```

Zahlt ein auf: [Vision](R00000-vision.md) — „die Datei ist die Wahrheit, die Oberfläche macht sie bedienbar“.

## Geschäftlicher Nutzen

Absprachen zur Spalte stehen dort, wo gearbeitet wird; wichtige Spalten fallen auf.

## Funktionale Anforderungen

- Board-Datei: `column-notes` (Spalte → Text) und `column-colors` (Spalte → `#rrggbb`) werden gelesen und geschrieben; leere Werte entfallen; eine Farbe, die nicht `#rrggbb` ist, wird beim Lesen ignoriert und beim Setzen mit 400 abgewiesen.
- `PUT /api/boards/{slug}/spalten`: je Spalte optional `notiz` und `farbe`; fehlt das Feld, behält die Spalte den Wert der alten Spalte (wie `pruefungen`), ein leerer Text entfernt ihn. `GET /api/boards/{slug}` liefert beide Felder.
- Spaltenkopf: mit Kommentar ein ⓘ, Tooltip = Kommentar; ohne Kommentar kein ⓘ.
- Spalte: mit Farbe trägt die Spalte diese Farbe als Hintergrund; im Dark-Mode (R00070) gedämpft, damit Karten lesbar bleiben.
- Spalteneinstellungen: je Spalte ein Feld „Kommentar“, eine Farbwahl und ein Knopf, der die Farbe entfernt; die Vorschau der Board-Datei zeigt `column-notes` und `column-colors`.

## Akzeptanzkriterien

- [x] Lesen und Schreiben der Board-Datei bewahren Kommentar und Farbe; ungültige Farbe wird beim Lesen ignoriert
- [x] `PUT …/spalten` ohne die Felder behält die Werte, mit leerem Text entfernt sie, mit ungültiger Farbe 400
- [x] Spalte mit Kommentar zeigt ⓘ mit dem Kommentar als Tooltip, ohne Kommentar kein ⓘ
- [x] In den Spalteneinstellungen gesetzte Farbe und Kommentar stehen nach dem Speichern in der Datei und auf dem Board

## Betroffene Verzeichnisstruktur

`src/modell/board.rs`, `src/format/board.rs`, `src/dienst/spalten.rs`, `src/web/endpunkte.rs`; `web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Tests `tests/spalten.rs`, Unit-Tests in `src/format/board.rs`, `e2e/tests/r00069-spaltenkommentar-farbe.spec.js`.

## Abhängigkeiten
- Abhängig von: R00004, R00009

## Offene Fragen
- keine
