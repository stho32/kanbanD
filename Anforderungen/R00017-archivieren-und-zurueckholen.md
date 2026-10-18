---
id: R00017
status: Neu
datum: 2026-10-18
---

# R00017: Archivieren und zurückholen

## Beschreibung

Erledigtes verschwindet vom Board, ohne verloren zu gehen: Archivieren schreibt `archived: <Datum>` in die Aufgabe und stoppt laufende Timer; die Datei bleibt liegen, die Zeile in der Board-Datei auch. Die Archivansicht eines Boards zeigt die archivierten Karten; von dort und aus dem Aufgabenfenster lässt sich zurückholen. Zeiten zählen in Berichten weiter.

Zahlt ein auf: [Vision](R00000-vision.md) — „Git ist das Gedächtnis“, „Das Board besitzt seine Struktur“.

## Geschäftlicher Nutzen

Das Board bleibt übersichtlich, die Geschichte vollständig.

## Funktionale Anforderungen

- `POST /api/aufgaben/<nr>/archivieren` setzt `archived` auf heute und beendet alle laufenden Timer der Aufgabe jetzt; schon archiviert → 409.
- `POST /api/aufgaben/<nr>/zurueckholen` entfernt `archived`; nicht archiviert → 409.
- Nachrichten: `#<nr> archiviert` (mit `, n Timer gestoppt`, wenn welche liefen) bzw. `#<nr> zurückgeholt`.
- Das Board zeigt archivierte Aufgaben nicht; am Fuß der Abschlussspalte steht „Archiv (n)“ mit der Zahl der archivierten Aufgaben dieses Boards.
- Die Archivansicht zeigt nur archivierte Karten dieses Boards in ihren Spalten, mit Leiste „Archiv · n Karten · Archiv verlassen“.
- Im Fenster archiviert ▭ (mit Hinweis „#n archiviert · rückgängig“), ↺ holt zurück; eine archivierte Aufgabe zeigt oben „Archiviert am …“.

## Akzeptanzkriterien

- [ ] Archivieren mit einem laufenden Timer → `archived: <heute>`, Timer hat ein Ende, Nachricht `#1 archiviert, 1 Timer gestoppt`
- [ ] Zweites Archivieren → 409; Zurückholen → kein `archived` mehr; zweites Zurückholen → 409
- [ ] Oberfläche: archivieren im Fenster → Karte weg, „Archiv (1)“; „rückgängig“ → Karte wieder da
- [ ] Oberfläche: Archivansicht zeigt die Karte; Zurückholen im Fenster bringt sie aufs Board

## Betroffene Verzeichnisstruktur

`src/dienst/archiv.rs`, `src/web/mod.rs`, `web/`; Tests `tests/archiv.rs`, `e2e/tests/r00017-archiv.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `Kanban::archivieren(&Person, nr)`, `Kanban::zurueckholen(&Person, nr)` (Integration über `aufgabe_schreiben`)
- `uhr::heute()` (Ortszeit `JJJJ-MM-TT`)

## Tests
- Integration: Archivieren mit Timer, Konflikte, Zurückholen
- E2E: Fenster, Hinweis, Archivansicht

## Abhängigkeiten
- Abhängig von: R00011, R00014
- Blockiert: R00020

## Offene Fragen
