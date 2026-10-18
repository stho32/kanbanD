---
id: R00043
status: Erledigt
datum: 2026-10-18
---

# R00043: Berichtsfilter wie Kanbanflow

## Beschreibung

Alle Berichte teilen eine Filterleiste, angelehnt an Kanbanflow (Board-Filter nach Person, Label, Farbe; Berichte nach Zeitraum):

- **Zeitraum** mit Vorgaben — heute, gestern, diese Woche, letzte Woche, dieser Monat, letzter Monat, letzte 30 Tage, letzte 90 Tage, dieses Jahr, alles — oder ein eigener Zeitraum von/bis.
- **Farben** (Klassen, dazu „ohne Klasse“) einzeln ausschließen.
- **Spalten** einzeln ausschließen (Board-Berichte).
- **Personen** und **Labels**: nur Aufgaben mit diesen; in Zeitberichten zählen bei Personen die Zeiten dieser Personen.

Der Filter gilt für alle Berichte gleich, wird im Browser gemerkt und lässt sich mit einem Klick zurücksetzen. Die Leiste nennt, wie viele Filter wirken.

Zahlt ein auf: [Vision](R00000-vision.md) — „gewohnte Konventionen“, „Git als Archiv inklusive Zeiten“.

## Geschäftlicher Nutzen

Fragen wie „wie viel Zeit ging letzte Woche in Fehler?“ oder „wie lange brauchen Funktionen ohne Doku?“ sind ohne Export beantwortbar.

## Funktionale Anforderungen

- Zeitraum-Vorgaben rechnen in lokaler Zeit; Woche beginnt am Montag; das Ende ist ausschließlich.
- „Zeiten nach Aufgabe und Person“ nutzt den Zeitraum der Leiste (statt der eigenen drei Knöpfe), Farben, Labels und Personen.
- Stundenzettel nutzt Farben und Labels; Zeitraum bleibt die gewählte Woche.

## Akzeptanzkriterien

- [x] Unit: Vorgaben heute, gestern, diese Woche, letzte Woche, dieser Monat, letzter Monat, eigener Zeitraum ergeben die richtigen Grenzen
- [x] Unit: Farbe ausgeschlossen, „ohne Klasse“ ausgeschlossen, nur Person, nur Label
- [x] Kreuztabelle: Zeitraum „gestern“ zeigt nur Zeiten von gestern; Farbe „Fehler“ ausgeschlossen blendet Fehler-Aufgaben aus; Person „Mia“ zeigt nur Mias Spalte
- [x] Filter bleibt nach Neuladen, „Zurücksetzen“ leert ihn

## Betroffene Verzeichnisstruktur

`web/berichte.js` (neu), `web/zeiten.js`, `web/ansicht.js`, `web/app.js`, `web/kd-app.css`, `web/index.html`, `src/web/statisch.rs`; Tests `e2e/einheit/berichte.test.js`, `e2e/tests/r00043-berichtsfilter.spec.js`.

## Abhängigkeiten
- Abhängig von: R00022, R00042

## Offene Fragen
