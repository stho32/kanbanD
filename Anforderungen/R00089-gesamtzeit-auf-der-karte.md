---
id: R00089
status: Erledigt
datum: 2026-10-25
---

# R00089: Gesamtzeit auf der Karte

## Beschreibung

Die gebuchte Zeit einer Aufgabe steht heute nur im Aufgaben-Detail; auf der Karte erscheint nur ein laufender Timer. Künftig zeigt jede Karte mit gebuchter Zeit unten `Σ h:mm` — die Summe aller Zeiteinträge aller Personen, laufende live mitgezählt.

Zahlt ein auf: [Vision](R00000-vision.md) — Mensch und Agent auf einem gemeinsamen Board; Zeiten im Blick.

## Geschäftlicher Nutzen

Man sieht auf einen Blick, wie viel Zeit in einer Karte steckt — und bei Agenten, ob einer ungewöhnlich lange an einer Karte hängt.

## Funktionale Anforderungen

- Untere Kartenzeile (`.r3`), vor Teilaufgaben und Fälligkeit: `Σ h:mm`, Summe aller Einträge (abgeschlossene plus laufende bis jetzt).
- Summe 0 → kein Feld.
- Laufender Timer → die Summe zählt jede Minute mit (über den vorhandenen 1-s-Takt mit `data-since`-Mechanik).
- Tooltip: Summe je Person, `Name h:mm`, absteigend.
- Gleiche Rechnung wie im Detail (eine Funktion für beide).

## Akzeptanzkriterien

- [x] Einträge 1:00 (sh) und 0:42 (entw) → Karte zeigt `Σ 1:42`, Tooltip „Stefan 1:00 · Entwickler 0:42“
- [x] Keine Einträge → kein `Σ`
- [x] Laufender Timer seit 0:05 plus abgeschlossen 1:00 → `Σ 1:05`, nach einer Minute `Σ 1:06` ohne Reload
- [x] Detail und Karte zeigen dieselbe Summe

## Betroffene Verzeichnisstruktur

`web/zeiten.js` (Summe als pure Funktion), `web/ansicht.js` (`vKarte`, Detail), `web/kd-app.css`; Tests `e2e/einheit/zeiten.test.js`, `e2e/tests/r00089-gesamtzeit-auf-der-karte.spec.js`.

## Technische Überlegungen

- `summeMs(zeiten, jetzt)` und `summeJePerson(zeiten, jetzt)` in `web/zeiten.js` (über `zeitMs`, damit R00084 greift).
- Live: Element mit `data-summe-basis` (ms der abgeschlossenen) und `data-since` (frühester laufender Beginn je Person) — der 1-s-Takt in `app.js` rechnet nach.

## Tests
**Unit:** `summeMs`, `summeJePerson`. **E2E:** Anzeige, leer, live.

## Abhängigkeiten
- Abhängig von: R00014, R00084

## Offene Fragen
- keine — „Σ h:mm unten, leer bei 0, live“ entschieden am 2026-10-25 (Feedback-Runde Punkt 6)

## Notizen
### Verworfene Alternativen
- Immer sichtbar mit `Σ 0:00`: Rauschen auf Karten ohne Zeit.
- Nur per Schalter: das Feedback will die Zeit an jeder Karte.

## Warum löst diese Anforderung das Problem? (Pflicht)

Summe nur im Detail → man muss jede Karte öffnen → Zeitfresser bleiben unsichtbar. Summe auf der Karte → der Blick über das Board zeigt, wo Zeit steckt, und ein hängender Agent fällt an der wachsenden Zahl auf.
