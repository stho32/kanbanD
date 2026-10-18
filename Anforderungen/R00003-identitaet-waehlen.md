---
id: R00003
status: Erledigt
datum: 2026-10-18
---

# R00003: Identität wählen

## Beschreibung

Jeder Browser-Tab wählt über „Ich bin …“ in der Kopfzeile, welcher Mensch er ist; die Wahl gilt nur für diesen Tab. Jeder schreibende Aufruf der API nennt im Header `X-KanbanD-Wer` das Kürzel der handelnden Person — Mensch oder Agent —, und kanbanD committet unter ihrem Namen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mensch und Agent arbeiten gleichberechtigt“, Leitplanke „Full-Trust“.

## Geschäftlicher Nutzen

An jeder Änderung ist ablesbar, wer gehandelt hat, ohne Anmeldung.

## Funktionale Anforderungen

- `X-KanbanD-Wer: <kürzel>` bestimmt die handelnde Person; sie muss in `kanbanD.md` stehen und aktiv sein.
- Fehlt der Header, antwortet ein schreibender Aufruf 400 „Wer handelt? Header X-KanbanD-Wer fehlt“; unbekannte oder stillgelegte Kürzel antworten 400 mit Kürzel in der Meldung.
- `GET /api/wer` liefert die Person zum Header (zum Prüfen für Agenten).
- Die Kopfzeile zeigt „nicht gewählt ▾“ oder Kürzel und Name; das Popover listet aktive Menschen zur Wahl, Agenten und Stillgelegte nur ausgegraut.
- Die Wahl liegt in `sessionStorage` (je Tab) und übersteht ein Neuladen; nach dem Einrichten ist „ich“ gewählt.

## Akzeptanzkriterien

### API
- [x] `GET /api/wer` mit `X-KanbanD-Wer: cl` liefert `{"kuerzel":"cl","art":"agent",…}`
- [x] Ohne Header 400 mit „X-KanbanD-Wer fehlt“; mit `zz` 400 mit „zz“; mit stillgelegtem Kürzel 400 mit „stillgelegt“

### Oberfläche
- [x] Ein frischer Tab zeigt „nicht gewählt“; nach Wahl von „Stefan“ zeigt die Kopfzeile „Stefan“, auch nach Neuladen
- [x] Ein zweiter Tab (eigene Sitzung) zeigt wieder „nicht gewählt“
- [x] Agenten erscheinen im Popover, sind aber nicht wählbar

## Betroffene Verzeichnisstruktur

Prüfung in `src/dienst/mod.rs` (`handelnder`), Header-Auslese in `src/web/mod.rs`; Oberfläche `web/ansicht.js`, `web/app.js`; Tests in `tests/identitaet.rs`, `e2e/tests/r00003-identitaet.spec.js`.

## Technische Überlegungen

### Ablauf
1. Header lesen (`wer_aus_header`)
2. `Kanban::handelnder(kuerzel)` — Einstellungen lesen, Person suchen, aktiv prüfen
3. Oberfläche: `fetch` setzt den Header aus `sessionStorage`

### Grobentwurf
- `Kanban::handelnder(Option<&str>) -> Result<Person, Fehler>` (Integration)
- `Wer` (Extraktor) — Header als `Option<String>`

## Tests
- Unit: keine pure Logik über das Suchen hinaus
- Integration: `GET /api/wer` mit allen Fällen
- E2E: Wahl, Neuladen, zweiter Tab

## Abhängigkeiten
- Abhängig von: R00002
- Blockiert: R00005 und alle schreibenden Aktionen

## Offene Fragen
