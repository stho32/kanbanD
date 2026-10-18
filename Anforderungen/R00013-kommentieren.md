---
id: R00013
status: Neu
datum: 2026-10-18
---

# R00013: Kommentieren

## Beschreibung

Mensch und Agent kommentieren eine Aufgabe; jeder Kommentar ist eine Zeile `Zeitpunkt · kürzel · Text` im Codeblock `kanbanD-comments` der Aufgabendatei und ein Commit unter dem Namen der kommentierenden Person.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mensch und Agent arbeiten gleichberechtigt“.

## Geschäftlicher Nutzen

Absprachen zu einer Aufgabe stehen bei der Aufgabe und reisen mit dem Repository.

## Funktionale Anforderungen

- `POST /api/aufgaben/<nr>/kommentare {text}` hängt einen Kommentar mit der aktuellen Ortszeit (`JJJJ-MM-TT HH:MM`) und dem Kürzel der handelnden Person an; leerer Text → 400.
- Zeilenumbrüche im Text bleiben erhalten (in der Datei als `\n`).
- Nachricht: `#<nr> kommentiert: <bis 50 Zeichen>`.
- Das Fenster zeigt die Kommentare mit Kürzel, Name und Zeitpunkt; das Eingabefeld „+ Kommentar als <Name> · Enter“ ist ohne Identität gesperrt.

## Akzeptanzkriterien

- [ ] `POST {text: "Zwei\nZeilen"}` als `cl` → Zeile `<heute HH:MM> · cl · Zwei\nZeilen` in der Datei, Commit von „Claude“
- [ ] `POST {text: ""}` → 400
- [ ] Oberfläche: Kommentar „Gut so.“ als Stefan → erscheint mit „Stefan“ im Fenster

## Betroffene Verzeichnisstruktur

`src/uhr.rs` (Ortszeit), `src/dienst/kommentare.rs`, `src/web/mod.rs`, `web/`; Tests `tests/kommentare.rs`, `e2e/tests/r00013-kommentare.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `uhr::jetzt() -> String` (Ortszeit `JJJJ-MM-TT HH:MM`)
- `Kanban::kommentieren(&Person, nr, text)` (Integration über `aufgabe_schreiben`)

## Tests
- Integration: API mit Git- und Dateiprüfung
- E2E: Kommentar im Fenster

## Abhängigkeiten
- Abhängig von: R00011

## Offene Fragen
