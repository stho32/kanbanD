---
id: R00050
status: Erledigt
datum: 2026-10-18
---

# R00050: Live-Ereignisse während eigener Anfragen (Nachtrag)

## Beschreibung

Rekonstruiert aus dem Code von R00037 (`warteschlange` und `ereignis` in `web/app.js`). Teilaufgaben, die schnell hintereinander eingegeben werden, werden sofort angezeigt und in einer Warteschlange nacheinander gesendet. Jede gesendete Teilaufgabe ist ein Commit und löst ein Live-Ereignis aus. Würde jedes Ereignis neu laden, käme ein Zwischenstand vom Server und überschriebe die schon angezeigten, noch nicht gesendeten Teilaufgaben — sie würden kurz verschwinden und wieder auftauchen. Regel: Solange die eigene Warteschlange Anfragen enthält, werden Live-Ereignisse übergangen. Ist die Schlange leer, lädt die Seite genau einmal neu und zeigt damit auch alle fremden Änderungen aus der Zwischenzeit.

Zahlt ein auf: [Vision](R00000-vision.md) — „Live überall“; ergänzt [R00037](R00037-teilaufgaben-schnell-hintereinander.md) und [R00007](R00007-live-aktualisierung.md).

## Geschäftlicher Nutzen

Schnelles Tippen bleibt ruhig: keine springende Liste, keine verlorene Eingabe.

## Funktionale Anforderungen

- `ereignis()` kehrt ohne Laden zurück, solange `schlangeOffen > 0`.
- Nach der letzten Anfrage der Schlange: ein `laden()`; schlägt eine Anfrage fehl, steht der Fehler im Fenster und das Laden zeigt den tatsächlichen Stand.
- Neuzeichnen bewahrt Wert, Cursor und Fokus des aktiven Felds (R00037).
- Steht die Live-Verbindung, trägt `<html>` das Merkmal `data-live="verbunden"`; bricht sie ab, fällt es weg. Tests und Agenten im Browser warten darauf, bevor sie eine Änderung von außen erwarten.

## Akzeptanzkriterien

- [x] E2E `R00037 US-1`: fünf Teilaufgaben ohne Pause → in der Datei in Reihenfolge, Liste zeigt alle fünf, Feld leer und fokussiert, fünf Commits
- [x] E2E `R00037 US-2`: Änderung von außen beim Tippen → Titel aktualisiert, angefangener Text bleibt
- [x] E2E `R00050 US-1`: zehn Teilaufgaben ohne Pause, Antworten um 250 ms verzögert → die angezeigte Anzahl fällt zwischendurch nie (Gegenprobe ohne die Regel: rot)
- [x] E2E `R00037 US-2` und `R00007`: warten auf `data-live="verbunden"`, bevor von außen geschrieben wird

## Betroffene Verzeichnisstruktur

`web/app.js` (`warteschlange`, `ereignis`, `render`); Tests `e2e/tests/r00037-teilaufgaben-schnell.spec.js`, `e2e/tests/r00050-live-waehrend-anfragen.spec.js`.

## Abhängigkeiten
- Abhängig von: R00037, R00007

## Offene Fragen
