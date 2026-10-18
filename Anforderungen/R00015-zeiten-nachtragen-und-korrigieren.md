---
id: R00015
status: Neu
datum: 2026-10-18
---

# R00015: Zeiten nachtragen und korrigieren

## Beschreibung

Zeiten werden nur an der Aufgabe gepflegt: Im Abschnitt „Zeiten“ des Aufgabenfensters stehen alle Einträge mit Summe; vergessene Zeit lässt sich als Dauer nachtragen, ein Eintrag lässt sich in Beginn und Ende korrigieren oder löschen. Jede Aktion ist ein Commit.

Zahlt ein auf: [Vision](R00000-vision.md) — „Zeiterfassung, die zum Arbeiten passt“.

## Geschäftlicher Nutzen

Vergessene Timer und Fehlklicks lassen sich beheben, ohne die Datei von Hand zu bearbeiten.

## Funktionale Anforderungen

- Dauer-Eingaben: `0:45`, `1:30`, `1,5`, `1.5` (Stunden), `90 min`, `45min`, `20m`; 0 oder unlesbar → 400.
- `POST /api/aufgaben/<nr>/zeiten {dauer}` trägt für die handelnde Person einen Eintrag ein, der jetzt endet und um die Dauer früher beginnt.
- `PATCH /api/aufgaben/<nr>/zeiten/<i> {beginn?, ende?}` korrigiert einen Eintrag (Ende nicht vor Beginn; bei laufendem Eintrag nur Beginn).
- `DELETE /api/aufgaben/<nr>/zeiten/<i>` löscht einen beendeten Eintrag; ein laufender → 409 („erst stoppen“).
- Nachrichten: `#<nr> Zeit nachgetragen: <h:mm> (<Name>)`, `#<nr> Zeit korrigiert (<Name>)`, `#<nr> Zeit gelöscht (<Name>, <h:mm>)`.
- Das Fenster zeigt die Einträge (neueste oben) mit Datum, Beginn–Ende, Person, Dauer und die Summe; ✎ öffnet Beginn/Ende zur Korrektur (Enter speichert), ✕ löscht; „+ Zeit nachtragen, z. B. 0:45 · Enter“.

## Akzeptanzkriterien

- [ ] `dauer_lesen`: „0:45“ → 45, „1,5“ → 90, „90 min“ → 90, „20m“ → 20, „x“ → keine, „0“ → keine
- [ ] Nachtragen „1:30“ um 12:00 ergibt `10:30 · 12:00 · st` (Prüfung relativ zu jetzt)
- [ ] Korrektur eines Eintrags auf `09:00`–`10:00`; Ende vor Beginn → 400; laufender Eintrag mit Ende → 400
- [ ] Löschen eines laufenden Eintrags → 409; eines beendeten → Zeile weg
- [ ] Oberfläche: „0:45“ nachtragen → Summe zeigt 0:45; Eintrag löschen → Summe 0:00

## Betroffene Verzeichnisstruktur

`src/uhr.rs` (Dauer lesen), `src/dienst/zeiten.rs`, `src/web/mod.rs`, `web/`; Tests `src/uhr.rs`, `tests/zeiten.rs`, `e2e/tests/r00015-zeiten.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `uhr::dauer_lesen(&str) -> Option<i64>`, `uhr::verschieben(zeitpunkt, minuten)` (pure)
- `Kanban::zeit_nachtragen | zeit_korrigieren | zeit_loeschen` (Integration)

## Tests
- Unit: Dauerformen, Verschieben
- Integration: alle API-Fälle
- E2E: Nachtragen, Löschen, Summe

## Abhängigkeiten
- Abhängig von: R00014

## Offene Fragen
