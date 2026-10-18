---
id: R00007
status: Erledigt
datum: 2026-10-18
---

# R00007: Live-Aktualisierung

## Beschreibung

kanbanD beobachtet den Ordner. Ändert sich eine Datei — über die Oberfläche, die API, einen Editor oder ein `git pull` —, erfahren es alle offenen Sichten über einen Ereignisstrom und zeigen den neuen Stand ohne Neuladen. Änderungen von außen tragen an der betroffenen Karte für etwa 10 Sekunden die Marke „extern · Datei · vor N Sek“.

Zahlt ein auf: [Vision](R00000-vision.md) — „Live überall, egal woher die Änderung kommt“.

## Geschäftlicher Nutzen

Mensch und Agent sehen dieselbe Wahrheit, auch wenn der Agent direkt an den Dateien arbeitet.

## Funktionale Anforderungen

- Beobachtet wird der Ordner rekursiv ohne `.git/` und ohne Zwischendateien `*.kanbanD-tmp`.
- Änderungen innerhalb von 150 ms werden zu einem Ereignis `{pfade, extern}` gebündelt; Pfade relativ zum Ordner, sortiert, ohne Doppelte.
- `extern` ist falsch, wenn alle Pfade in den letzten 3 Sekunden von kanbanD selbst geschrieben wurden.
- `GET /api/ereignisse` liefert die Ereignisse als Server-Sent Events (`data: <json>`), mit Lebenszeichen alle 15 s.
- Die Oberfläche lädt nach jedem Ereignis neu. Bei externen Änderungen bekommen die Karten der geänderten Aufgabendateien und die in einer externen Board-Änderung verschobenen Karten die Marke „extern“, die nach 10 s verschwindet.
- Bricht die Verbindung ab, zeigt die Kopfzeile „nicht live“; nach der Wiederverbindung lädt die Seite neu.

## Akzeptanzkriterien

- [x] Schreibt ein Editor `aufgaben/0001-x.md`, kommt innerhalb von 2 s ein Ereignis mit `pfade: ["aufgaben/0001-x.md"], extern: true`
- [x] Legt kanbanD selbst eine Aufgabe an, ist das Ereignis `extern: false`
- [x] Ein Ereignis für `.git/` oder eine Zwischendatei entsteht nicht
- [x] Ändert ein Editor den Titel von #1, zeigt ein offener Browser ohne Neuladen den neuen Titel und an der Karte „extern · aufgaben/0001-…md“
- [x] Verschiebt ein Editor #1 in der Board-Datei nach „Erledigt“, steht die Karte im offenen Browser dort mit Marke „extern“
- [x] Legt ein zweiter Browser eine Karte an, erscheint sie im ersten ohne Marke

## Betroffene Verzeichnisstruktur

`src/waechter.rs` (Beobachtung, Bündelung), `src/dienst/mod.rs` (eigene Schreibzugriffe), `src/web/mod.rs` (SSE), `web/app.js`; Tests `src/waechter.rs` (Unit: Bündelung), `tests/live.rs`, `e2e/tests/r00007-live.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `Waechter::starten(wurzel, eigene: Eigene, sender)` (Operation, eigener Thread)
- `Eigene` (geteilte Liste eigener Schreibzugriffe mit Zeitpunkt)
- `Ereignis { pfade, extern }` (DTO)
- `relevant(rel_pfad) -> bool`, `buendeln(...)` (pure)

## Tests
- Unit: Filter und Extern-Regel
- Integration: SSE gegen echten Ordner, Editor-Schreiben, eigenes Anlegen
- E2E: Editor ändert Titel und Board, zweiter Browser legt an

## Abhängigkeiten
- Abhängig von: R00004
- Blockiert: R00025

## Offene Fragen
