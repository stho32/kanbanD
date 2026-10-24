---
id: R00080
status: Erledigt
datum: 2026-10-24
---

# R00080: Auflösung im Fever Chart

## Beschreibung

Das Projekt-Fever-Chart (R00078) zeigt je Tag einen Punkt. Über Monate wird die Bahn dicht und unruhig; eine gröbere **Auflösung** zeigt nur jeden siebten bzw. dreißigsten Tag: „Tag“, „Woche (alle 7 T)“, „Monat (30 T)“. Gezählt wird vom letzten Stand rückwärts, damit der aktuelle Punkt immer dabei ist; fällt ein Stichtag auf einen Tag ohne Punkt (Wochenende in der Arbeitstage-Einheit, keine Prognose), gilt der letzte Punkt davor.

Die Auflösung ändert nur die Anzeige — gerechnet und gecacht wird weiter je Tag, Umschalten rechnet nichts neu. Sie steht am Board wie die übrigen Einstellungen.

Zahlt ein auf: [Vision](R00000-vision.md) — Steuerung in der Frequenz, in der ein Team tatsächlich hinschaut.

## Geschäftlicher Nutzen

Wer wöchentlich oder monatlich steuert, sieht die Bahn in seinem Takt; Rauschen von Tag zu Tag verdeckt die Richtung nicht mehr.

## Funktionale Anforderungen

- Board-Datei: `fever: {resolution: week | month}`; fehlt der Schlüssel, gilt `day`. Unbekannter Wert ist Formatfehler.
- `PUT /api/boards/{slug}/fieber` nimmt `aufloesung` ∈ {1, 7, 30}; sonst 400.
- Bericht: Auswahl „Auflösung“; Diagramm, Tooltip und Tabellenansicht zeigen nur die Stichtage; Kennzahlen des letzten Stands unverändert.

## Akzeptanzkriterien

- [x] Format: Rundlauf mit `resolution: month`; Standard wird nicht geschrieben; `resolution: hourly` ist Formatfehler
- [x] API: Auflösung setzen → Frontmatter, Commit; 5 → 400
- [x] Unit: Ausdünnen vom letzten Punkt rückwärts, Stichtag ohne Punkt nimmt den davor, Tag lässt alles
- [x] E2E: „Woche (alle 7 T)“ → Board-Datei, weniger Punkte, letzter Punkt bleibt; kein neuer Cache-Commit

## Betroffene Verzeichnisstruktur

`src/modell/board.rs`, `src/format/board.rs`, `web/berichte.js`, `web/ansicht.js`, `web/app.js`; Tests `tests/fieber.rs`, `e2e/einheit/berichte.test.js`, `e2e/tests/r00078-fieber.spec.js`.

## Abhängigkeiten
- Abhängig von: R00078

## Offene Fragen
- keine
