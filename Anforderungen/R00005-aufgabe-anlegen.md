---
id: R00005
status: Erledigt
datum: 2026-10-18
---

# R00005: Aufgabe anlegen

## Beschreibung

„+ Karte“ am Fuß einer Spalte legt eine Aufgabe an: eine neue Datei unter `aufgaben/` mit der nächsten freien Nummer und eine Zeile am Ende dieser Spalte in der Board-Datei — beides in einem Commit unter dem Namen der handelnden Person. Über die API lässt sich eine Aufgabe auch ohne Board anlegen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgaben sind unabhängige Daten“, „Ein Commit je Aktion“.

## Geschäftlicher Nutzen

Neue Arbeit landet mit einem Tastendruck im Board und ist sofort versioniert.

## Funktionale Anforderungen

- Nächste Nummer = höchste Nummer unter allen Dateinamen in `aufgaben/` plus 1 (auch defekte Dateien zählen); im leeren Ordner 1.
- Dateiname `<nr 4-stellig>-<slug des Titels>.md`; der Dateiname bleibt, wenn sich der Titel später ändert.
- Die neue Aufgabe trägt `id`, `title` und als `assignees` die anlegende Person, wenn sie ein Mensch ist.
- `POST /api/aufgaben` mit `{titel, board?, spalte?}` und `X-KanbanD-Wer`; mit Board ohne Spalte gilt die erste Spalte. Antwort 201 mit `nummer` und `datei`.
- Leerer Titel, unbekanntes Board oder unbekannte Spalte antworten 400 bzw. 404; es entsteht keine Datei.
- Commit-Nachricht: `#<nr> „<Titel>“ angelegt` und, wenn auf einem Board, `in „<Spalte>“ (<Board>)`.
- Oberfläche: „+ Karte“ öffnet ein Eingabefeld; Enter legt an und lässt das Feld für die nächste Karte offen, Esc bricht ab. Ohne gewählte Identität öffnet sich „Ich bin …“ mit Hinweis.

## Akzeptanzkriterien

### Anlegen
- [x] In einem Ordner mit den Dateien `0001-a.md` und `0007-b.md` bekommt die neue Aufgabe die Nummer 8 und die Datei `0008-<slug>.md`
- [x] Der Commit enthält genau die Aufgabendatei und die Board-Datei; Autor ist die handelnde Person
- [x] Die Board-Datei hat danach unter der Spalte als letzte Zeile `- [#8](../aufgaben/0008-<slug>.md)`
- [x] Ohne Board entsteht nur die Aufgabendatei
- [x] Leerer Titel → 400, unbekanntes Board → 404, unbekannte Spalte → 400; kein Commit

### Oberfläche
- [x] „+ Karte“ in „In Arbeit“, Titel, Enter: die Karte erscheint unten in „In Arbeit“, das Feld bleibt offen
- [x] Ohne Identität öffnet „+ Karte“ das Popover „Ich bin …“ mit Hinweis, und es entsteht keine Datei

## Betroffene Verzeichnisstruktur

`src/dienst/aufgabe_anlegen.rs`, `src/ablage.rs`, `src/web/mod.rs`; Oberfläche `web/`; Tests `tests/aufgabe_anlegen.rs`, `e2e/tests/r00005-aufgabe-anlegen.spec.js`.

## Technische Überlegungen

### Ablauf
1. Handelnden bestimmen
2. Unter der Schreibsperre: nächste Nummer, Aufgabe bauen, Board lesen und Zeile anhängen
3. Beide Dateien schreiben, ein Commit

### Grobentwurf
- `Ordner::naechste_nummer() -> u32` (Operation)
- `NeueAufgabe { titel, board, spalte }` (DTO)
- `Kanban::aufgabe_anlegen(&Person, &NeueAufgabe) -> Result<Aufgabe, Fehler>` (Integration)
- `Board::spalte_mut(name)` (pure)

## Tests
- Unit: `Board::spalte_mut`, Nummernregel
- Integration: alle API-Fälle mit Git-Prüfung
- E2E: Karte anlegen, ohne Identität

## Abhängigkeiten
- Abhängig von: R00003, R00004
- Blockiert: R00006, R00011

## Offene Fragen
