---
id: R00031
status: Erledigt
datum: 2026-10-18
---

# R00031: Rückgängig

## Beschreibung

Nach dem Bewegen, Anlegen und Archivieren erscheint unten ein Hinweis mit „rückgängig“; Strg+Z (bzw. ⌘Z) löst ihn aus, solange er sichtbar ist. Rückgängig ist selbst eine Aktion mit eigenem Commit — die Geschichte bleibt vollständig.

Zahlt ein auf: [Vision](R00000-vision.md) — „Git ist das Gedächtnis“ (nichts wird umgeschrieben), „gewohnte Konventionen“.

## Geschäftlicher Nutzen

Fehlgriffe beim Ziehen oder Anlegen sind mit einem Tastendruck behoben.

## Funktionale Anforderungen

- Bewegen (Ziehen, Umschalt+Pfeil, Spaltenwahl im Fenster): Hinweis `#n nach „<Spalte>“`; rückgängig bewegt die Aufgabe an Spalte und Position vor der Bewegung.
- Anlegen (eine oder mehrere): Hinweis `#n angelegt` bzw. `n Aufgaben angelegt`; rückgängig archiviert die neuen Aufgaben (Dateien bleiben, wie überall in kanbanD).
- Archivieren: wie bisher mit „rückgängig“ (R00017).
- Strg+Z / ⌘Z löst „rückgängig“ des sichtbaren Hinweises aus, nicht aber in Eingabefeldern (dort bleibt das Rückgängig des Browsers).
- Der Hinweis verschwindet nach 8 Sekunden; danach gibt es kein Rückgängig mehr.

## Akzeptanzkriterien

- [x] Ziehen von #1 aus „Zu erledigen“ (Position 0) nach „Erledigt“, „rückgängig“ → #1 wieder an Position 0 in „Zu erledigen“; zwei Commits
- [x] Umschalt+→ auf #2, Strg+Z → #2 zurück
- [x] Zwei Zeilen einfügen, „rückgängig“ → beide archiviert, vom Board verschwunden
- [x] Strg+Z in einem Eingabefeld löst nichts aus

## Betroffene Verzeichnisstruktur

`web/app.js`, `web/ansicht.js`; E2E `e2e/tests/r00031-rueckgaengig.spec.js`. Keine neuen Endpunkte (Bewegen und Archivieren bestehen).

## Tests
- E2E: alle Kriterien

## Abhängigkeiten
- Abhängig von: R00006, R00017, R00027

## Offene Fragen
