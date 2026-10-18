---
id: R00008
status: Neu
datum: 2026-10-18
---

# R00008: Boards wechseln und anlegen

## Beschreibung

Eine Instanz zeigt alle Boards des Boardverzeichnisses. Ein Klick auf den Boardnamen in der Kopfzeile öffnet die Liste der Boards; dort lässt sich wechseln und ein neues Board anlegen. Das aktuelle Board steht in der Adresse (`#/board/<slug>`), damit Neuladen und Lesezeichen es behalten.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mehrere Boards über einem Aufgabenbestand“.

## Geschäftlicher Nutzen

Verschiedene Sichten auf dieselben Aufgaben (z. B. Entwicklung und Test) ohne zweite Instanz.

## Funktionale Anforderungen

- `POST /api/boards` mit `{titel, spalten?}` legt `boards/<slug>.md` an; ohne Spalten gelten „Zu erledigen, In Arbeit, Erledigt“. Ein Commit `Board „<Titel>“ angelegt`.
- Titel ohne Buchstaben/Ziffern, leere oder doppelte Spalten → 400; Slug schon vorhanden → 409.
- Die Kopfzeile zeigt den Boardnamen als Schalter; das Popover listet alle Boards (aktuelles markiert) und ein Feld „Neues Board · Enter“.
- Nach dem Anlegen wechselt die Seite auf das neue Board.
- Ein unbekannter Slug in der Adresse zeigt das erste Board.

## Akzeptanzkriterien

- [ ] `POST /api/boards {titel: "Test & Abnahme"}` erzeugt `boards/test-abnahme.md` mit drei Standardspalten und einen Commit mit nur dieser Datei
- [ ] Zweites Anlegen mit demselben Titel → 409; leerer Titel → 400
- [ ] Popover zeigt „Entwicklung“ und „Test“; Klick auf „Test“ zeigt dessen Spalten, die Adresse endet auf `#/board/test`
- [ ] Neues Board über das Popover: Name, Enter → das neue Board ist offen
- [ ] Neuladen auf `#/board/test` zeigt „Test“

## Betroffene Verzeichnisstruktur

`src/dienst/board_anlegen.rs`, `src/web/mod.rs`, `web/`; Tests `tests/boards.rs`, `e2e/tests/r00008-boards.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `NeuesBoard { titel, spalten }` (DTO), `Kanban::board_anlegen(&Person, &NeuesBoard) -> Result<String, Fehler>`
- Prüfung der Spalten gemeinsam mit der Einrichtung (`spalten_pruefen`)

## Tests
- Integration: API mit Git-Prüfung, Konflikt, Fehler
- E2E: Wechseln, Anlegen, Neuladen

## Abhängigkeiten
- Abhängig von: R00003, R00004
- Blockiert: R00009, R00020

## Offene Fragen
