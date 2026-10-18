---
id: R00037
status: Neu
datum: 2026-10-18
---

# R00037: Teilaufgaben schnell hintereinander

## Beschreibung

Teilaufgaben lassen sich im Aufgabenfenster so schnell eingeben, wie man tippt: Enter fügt die Teilaufgabe sofort sichtbar an und leert das Feld, ohne auf den Server zu warten; die Anfragen laufen geordnet nacheinander im Hintergrund, jede ein Commit. Allgemein gilt: wird die Seite neu gezeichnet (Live-Ereignis, Neuladen), bleiben Fokus, Text und Cursor des gerade benutzten Eingabefelds erhalten.

Zahlt ein auf: [Vision](R00000-vision.md) — „Live überall“ (ohne beim Tippen zu stören).

## Geschäftlicher Nutzen

Eine Liste von Schritten ist in Sekunden erfasst; nichts geht verloren, weil gleichzeitig jemand anderes schreibt.

## Funktionale Anforderungen

- Enter in „+ Teilaufgabe“: Teilaufgabe erscheint sofort, Feld leer und fokussiert; die Anfrage wird an eine Warteschlange gehängt, die strikt nacheinander sendet; nach der letzten wird neu geladen.
- Schlägt eine Anfrage fehl, nennt der Fuß den Fehler, und nach dem Neuladen zeigt die Liste den tatsächlichen Stand.
- Neuzeichnen bewahrt im aktiven Feld mit `id` Wert, Cursorposition und Fokus.

## Akzeptanzkriterien

- [ ] Fünf Teilaufgaben ohne Pause hintereinander getippt (je Text + Enter) → alle fünf in dieser Reihenfolge in der Datei, fünf Commits
- [ ] Während des Tippens in „+ Teilaufgabe“ ändert ein Editor die Aufgabendatei → der getippte Text bleibt im Feld, der Fokus auch

## Betroffene Verzeichnisstruktur

`web/app.js`; E2E `e2e/tests/r00037-teilaufgaben-schnell.spec.js`.

## Abhängigkeiten
- Abhängig von: R00012, R00007

## Offene Fragen
