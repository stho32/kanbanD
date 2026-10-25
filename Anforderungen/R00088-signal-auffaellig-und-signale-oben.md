---
id: R00088
status: In Arbeit
datum: 2026-10-25
---

# R00088: Signal auffällig und „Signale oben“

## Beschreibung

Ein Signal (R00076) ist heute eine 18 px kleine pulsierende Fackel; bei vielen Karten übersieht man es. Künftig trägt die **ganze Karte** die Signalfarbe. Dazu kommt im Board-Kopf ein Schalter **„Signale oben“**: er zeigt in jeder Spalte zuerst die Karten mit Signal, dann den Rest — nur in der Anzeige, die Position der Karten im Board ändert sich nicht.

Zahlt ein auf: [Vision](R00000-vision.md) — Mensch und Agent auf einem gemeinsamen Board; der Mensch sieht, wo ein Agent ihn braucht.

## Geschäftlicher Nutzen

Bei einem reinen KI-Lauf springt ins Auge, welche Karten Aufmerksamkeit verlangen, ohne die Arbeitsreihenfolge der Agenten zu verändern.

## Funktionale Anforderungen

- Karte mit mindestens einem Signal: Streifen 4 px links in der Farbe des ersten gesetzten Signals (Reihenfolge der Einstellungen), leichter Hintergrundton derselben Farbe (Mischung mit dem Kartenhintergrund, in Hell- und Dunkelmodus lesbar), Fackel 22 px statt 18 px.
- Fälligkeit (`due`) ist kein Signal im Sinne dieser Färbung.
- Schalter „Signale oben“ im Board-Kopf neben dem Filter (`aria-pressed`); Zustand je Browser in `localStorage` (`kanbanD.signale-oben`), Fehler beim Speichern werden ignoriert.
- An: jede Spalte zeigt erst die Karten mit Signal in ihrer echten Reihenfolge, dann die ohne Signal in ihrer echten Reihenfolge; Spaltenzähler und Grenzen unverändert.
- An: Ziehen mit der Maus und Tastaturzüge zum Umsortieren sind gesperrt (Hinweis „Bei ‚Signale oben‘ nicht umsortierbar“); Zug in eine andere Spalte per Kontextmenü bleibt möglich.
- Aus: Anzeige wie heute.

## Akzeptanzkriterien

- [ ] Pure Sortierung: Spalte [1, 2s, 3, 4s] (s = Signal) → Anzeige [2, 4, 1, 3]; Board-Datei unverändert
- [ ] Karte mit Signal „review“ (Farbe rot) hat Streifen und Hintergrundton in Rot; ohne Signal keinen
- [ ] Schalter an → Reihenfolge wie oben; neu laden → Schalter bleibt an
- [ ] Schalter an → Ziehen mit der Maus ändert nichts, Hinweis erscheint
- [ ] Signal per API gesetzt → Karte färbt sich live und rückt bei „Signale oben“ live nach oben

## Betroffene Verzeichnisstruktur

`web/ansicht.js` (`vKarte`, Spaltenrendering, Board-Kopf), `web/app.js` (Schalter, Zug-Sperre), Sortierung als pure Funktion in `web/filter.js`, `web/kd-app.css`; Tests `e2e/einheit/filter.test.js`, `e2e/tests/r00088-signale-oben.spec.js`.

## Technische Überlegungen

- `signaleOben(nummern, aufgabeZu)` in `web/filter.js` (pure, stabil).
- Karte bekommt `data-sig` und `style="--sg:<farbe>"`; CSS `.ka[data-sig]{border-left:4px solid var(--sg); background:color-mix(in srgb, var(--sg) 10%, var(--kd-card))}`.
- Zug-Sperre in den Drag-Handlern und in `tastatur.js` beim Umsortieren.

## Tests
**Unit:** `signaleOben`. **E2E:** Färbung, Schalter mit Persistenz, Zug-Sperre, Live-Update.

## Abhängigkeiten
- Abhängig von: R00076, R00019

## Offene Fragen
- keine — Darstellung „ganze Karte in Signalfarbe“ und Schalter entschieden am 2026-10-25 (Feedback-Runde Punkt 5)

## Notizen
### Verworfene Alternativen
- Pulsierender Leuchtrand: zu unruhig bei vielen Signalen.
- Nur größere Fackel mit Schriftzug: zu wenig Wirkung.
- Signal-Filter (vorhanden): blendet den Rest aus, statt nur umzusortieren.

## Warum löst diese Anforderung das Problem? (Pflicht)

Kleine Fackel → Signal geht unter → der Mensch merkt nicht, dass ein Agent ihn braucht. Farbige Karte plus „Signale oben“ → signalisierte Karten stehen sichtbar oben → der Mensch reagiert, ohne dass die echte Reihenfolge, nach der Agenten ziehen, berührt wird.
