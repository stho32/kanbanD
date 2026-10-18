---
id: R00040
status: Erledigt
datum: 2026-10-18
---

# R00040: Ziehen in der Aufgabenliste

## Beschreibung

In der Aufgabenliste lassen sich Zeilen per Drag & Drop verteilen. Neben der Tabelle steht eine Leiste „Ziehen auf“ mit jeder Spalte jedes Boards und dem Archiv. Eine Zeile auf eine Spalte gezogen legt die Aufgabe dort ans Ende — liegt sie schon auf diesem Board, wird sie dorthin bewegt (nur die Board-Datei ändert sich). Auf „Archiv“ gezogen wird sie archiviert. Jede Aktion ist ein Commit.

Zahlt ein auf: [Vision](R00000-vision.md) — „Bewegen ändert nur die Board-Datei“, „Eine Aufgabe kann auf mehreren Boards liegen“.

## Geschäftlicher Nutzen

Aufgaben ohne Board und Ideen aus der Liste lassen sich mit einer Geste einplanen.

## Funktionale Anforderungen

- Nicht archivierte Zeilen sind ziehbar; Ziele markieren sich beim Überfahren.
- Ziel Spalte eines Boards, auf dem die Aufgabe nicht liegt → `POST /api/boards/{slug}/aufgaben` (ans Ende).
- Ziel Spalte eines Boards, auf dem sie liegt → `POST /api/boards/{slug}/bewegen` ans Ende dieser Spalte.
- Ziel Archiv → archivieren mit Rückgängig im Hinweis.

## Akzeptanzkriterien

- [x] #2 (ohne Board) auf „Entwicklung · In Arbeit“ ziehen → Board-Datei listet #2 unter „In Arbeit“, Aufgabendatei unverändert
- [x] #1 (auf Entwicklung, Zu erledigen) auf „Entwicklung · Erledigt“ ziehen → nur die Board-Datei ändert sich
- [x] #1 auf „Archiv“ ziehen → `archived:` in der Datei

## Betroffene Verzeichnisstruktur

`web/ansicht.js`, `web/app.js`, `web/kd-app.css`; E2E `e2e/tests/r00040-liste-ziehen.spec.js`.

## Abhängigkeiten
- Abhängig von: R00020, R00006

## Offene Fragen
