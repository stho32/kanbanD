---
id: R00083
status: Erledigt
datum: 2026-10-24
---

# R00083: Messbasis „letzte N Tage“

## Beschreibung

Die Prognose in „Wie lange noch“ (R00046) und im Projekt-Fever-Chart (R00078) misst den Durchsatz bisher in einem Kalenderzeitraum („alles“, „dieser Monat“, „letzte 90 Tage“, eigener Zeitraum). Feste Kalenderzeiträume ergeben für eine Prognose keinen Sinn. Die **Messbasis** ist jetzt immer ein gleitendes Fenster: **die letzten N Tage**, N wählbar, Standard 90.

- Im Fever Chart gleitet das Fenster mit: für jeden Tag zählen die N Tage davor.
- Das Fenster beginnt nie vor „Rechnen ab“ (R00081) und nie vor dem Tag der ersten Aufgabe auf dem Board — Tage, an denen das Board leer war, sagen nichts über das Tempo und zählen nicht als Durchsatz null.
- N steht im Berichtsfilter des Boards (`report-filter: {window-days: N}`); die Kalenderauswahl erscheint in diesen beiden Berichten nicht mehr. Burndown, Durchlaufzeit und die Zeitberichte behalten ihren Zeitraum.
- N gehört zum Schlüssel des Fever-Caches; der Kalenderzeitraum nicht mehr. Bestehende Caches werden einmal neu gerechnet.

Zahlt ein auf: [Vision](R00000-vision.md) — Prognosen aus dem jüngsten Tempo eines Teams.

## Geschäftlicher Nutzen

Die Prognose folgt dem aktuellen Tempo, statt an Kalendergrenzen zu springen; eine Planungsphase vor der ersten Aufgabe verfälscht sie nicht.

## Funktionale Anforderungen

- Berichtsfilter: `messbasisTage` 1–3650 (Standard 90), in der Datei `window-days`, nur wenn nicht 90; sonst 400 bzw. Formatfehler.
- Prognose: Tagesreihe vom Fensteranfang max(heute − N + 1, Rechnen ab, erste Aufgabe) bis heute; der Verlauf im Diagramm beginnt weiter bei der ersten Aufgabe, frühestens bei „Rechnen ab“.
- Filterbox in „Wie lange noch“ und Fever Chart: Zeile „Messbasis: letzte N Tage, gleitend“; die Zusammenfassung nennt „Messbasis N T“.

## Akzeptanzkriterien

- [x] Format und API: `window-days` Rundlauf, Standard nicht geschrieben, 0 → 400 bzw. Formatfehler
- [x] Unit: Fenster der letzten N Tage; nie vor der ersten Aufgabe; Kalenderzeitraum wirkt nicht auf die Prognose; Cache-Schlüssel ohne Zeitraum
- [x] E2E: Messbasis 2 Tage → weniger Läufe, kürzere Tagesreihe, `window-days: 2` in der Board-Datei; keine Zeitraumauswahl in „Wie lange noch“

## Betroffene Verzeichnisstruktur

`src/modell/board.rs`, `src/format/board.rs`, `web/berichte.js`, `web/ansicht.js`, `web/app.js`; Tests `tests/berichtsfilter.rs`, `e2e/einheit/berichte.test.js`, `e2e/tests/r00081-berichtsfilter-am-board.spec.js`, `r00046`, `r00078`.

## Abhängigkeiten
- Abhängig von: R00046, R00078, R00081

## Offene Fragen
- keine — Fensteranfang „nie vor Rechnen ab und nie vor der ersten Aufgabe“ geklärt am 2026-10-24
