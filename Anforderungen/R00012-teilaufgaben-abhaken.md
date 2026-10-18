---
id: R00012
status: Neu
datum: 2026-10-18
---

# R00012: Teilaufgaben abhaken

## Beschreibung

Eine Aufgabe trägt Teilaufgaben als Markdown-Checkboxen (`- [ ]`, `- [x]`). Im Aufgabenfenster lassen sie sich anlegen, abhaken, wieder öffnen und entfernen; jede Aktion ist ein Commit. Die Karte zeigt „☑ erledigt/gesamt“.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein Kanban, das ein Ordner ist“ (lesbar ohne kanbanD).

## Geschäftlicher Nutzen

Kleine Schritte einer Aufgabe sind sichtbar, ohne eigene Karten.

## Funktionale Anforderungen

- `POST /api/aufgaben/<nr>/teilaufgaben {text}` hängt eine offene Teilaufgabe an; leerer Text → 400.
- `PATCH /api/aufgaben/<nr>/teilaufgaben/<i> {erledigt?, text?}` ändert die Teilaufgabe an Position `i` (0-basiert); `DELETE …/<i>` entfernt sie; unbekannte Position → 404.
- Nachrichten: `#<nr> Teilaufgabe „<text>“ ergänzt | erledigt | wieder offen | geändert | entfernt`.
- Im Fenster: Klick auf Kästchen oder Text hakt ab bzw. öffnet wieder; „+ Teilaufgabe · Enter“ legt an und bleibt offen; ✕ entfernt.

## Akzeptanzkriterien

- [ ] Anlegen „a“, „b“, dann `PATCH 0 {erledigt: true}` → Datei enthält `- [x] a` und `- [ ] b`; drei Commits
- [ ] `DELETE 1` entfernt „b“; `PATCH 5` → 404; `POST {text: " "}` → 400
- [ ] Oberfläche: zwei Teilaufgaben anlegen, die erste abhaken → Karte zeigt „☑ 1/2“

## Betroffene Verzeichnisstruktur

`src/dienst/teilaufgaben.rs`, `src/web/mod.rs`, `web/`; Tests `tests/teilaufgaben.rs`, `e2e/tests/r00012-teilaufgaben.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `Kanban::teilaufgabe_anlegen | _aendern | _entfernen` (Integration über `aufgabe_schreiben`)

## Tests
- Integration: API mit Git-Prüfung
- E2E: Anlegen und Abhaken

## Abhängigkeiten
- Abhängig von: R00011

## Offene Fragen
