---
id: R00044
status: Erledigt
datum: 2026-10-18
---

# R00044: Burndown nach Zeitraum

## Beschreibung

Der Bericht „Burndown“ zeigt nur noch offene Aufgaben und Umfang je Tag — die Durchlaufzeit wird ein eigener Bericht (R00045). Er rechnet aus den Bewegungen des Boards (R00042) und folgt der Filterleiste (R00043): Zeitraum, Farben und Spalten ausschließen, nur Personen (zuständig), nur Labels. Eine Aufgabe in einer ausgeschlossenen Spalte zählt an diesem Tag nicht; „offen“ heißt: nicht in der Abschlussspalte.

Löst ab: den Teil „Durchlaufzeit“ des Berichts aus R00023 (Datei unverändert).

Zahlt ein auf: [Vision](R00000-vision.md) — „Git als Archiv inklusive Zeiten“.

## Geschäftlicher Nutzen

Der Verlauf eines Sprints oder Monats ist für sich lesbar, ohne Ideen-Spalte oder Doku-Aufgaben.

## Funktionale Anforderungen

- Je Tag im Zeitraum (nicht vor dem ersten Stand, nicht nach heute) zählt der Stand am Tagesende, heute der Stand jetzt.
- Ohne Treffer: Hinweis „Keine Aufgabe im Zeitraum“.

## Akzeptanzkriterien

- [x] Unit: offen und Umfang je Tag; Zeitraum schneidet; ausgeschlossene Spalte und Farbe zählen nicht
- [x] E2E: Burndown zeigt „offen 1“; eigener Zeitraum 01.10.–01.10. zeigt einen Tag mit „offen 2“; Spalte „Zu erledigen“ ausgeschlossen → „offen 0“; keine Durchlaufzeit-Tabelle

## Betroffene Verzeichnisstruktur

`web/berichte.js`, `web/ansicht.js`, `web/app.js`; Tests `e2e/einheit/berichte.test.js`, `e2e/tests/r00023-verlauf.spec.js` (angepasst), `e2e/tests/r00044-burndown.spec.js`.

## Abhängigkeiten
- Abhängig von: R00042, R00043

## Offene Fragen
