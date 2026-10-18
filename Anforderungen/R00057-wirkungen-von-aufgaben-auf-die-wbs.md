---
id: R00057
status: Neu
datum: 2026-10-18
---

# R00057: Wirkungen von Aufgaben auf die WBS

## Beschreibung

Eine Aufgabe nennt in einem eigenen Namensraum `wbs-effects`, wie sie auf Knoten einer Anwendung wirkt: `create` legt einen Knoten an, `rework` setzt einen Knoten zur Überarbeitung auf `rot`, `remove` verwirft ihn. Die Wirkung tritt **sofort** ein, sobald sie an der Aufgabe gesetzt wird. Die Herkunft (`origins`, woher die Aufgabe kommt) bleibt davon getrennt. `gruen` entsteht nie über eine Wirkung.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgaben wirken auf Knoten: sie legen an, setzen zur Überarbeitung zurück oder verwerfen.“

## Geschäftlicher Nutzen

Eine Aufgabe trägt selbst, was sie am Programm ändert. Die KI muss Board und WBS nicht getrennt pflegen und abgleichen.

## Funktionale Anforderungen

- Frontmatter der Aufgabe:
  ```yaml
  wbs-effects:
    - {application: kd, action: create, node: I0048, parent: D0002, level: Interaction, name: „…“, done-criterion: US-1}
    - {application: kd, action: rework, node: D0002}
    - {application: kd, action: remove, node: I0014}
  ```
- `PATCH /api/aufgaben/<nr>/wbs-effects` mit einer Wirkung `{application, action, node?, parent?, level?, name?, done_criterion?}` hängt sie an; Identität Pflicht.
- `create` ohne `node`: kanbanD legt den Knoten nach R00056 an und schreibt die vergebene ID in die Wirkung. `rework`: setzt den Knoten (Blatt oder oberer Knoten mit allen zählenden Nachfahren) auf `rot`. `remove`: verwirft nach R00056.
- Reihenfolge einer Aktion: erst die WBS schreiben, dann die Aufgabe; scheitert die WBS (Knoten unbekannt, Datei defekt, Anwendung nicht erreichbar), bleibt die Aufgabe unverändert und die Antwort nennt den Grund (409).
- Ein Commit im Board-Repository für die Aufgabe (`#<nr> wirkt auf kd:I0048 (create)`), kein Commit im Arbeits-Repository.
- Eine gesetzte Wirkung wird nicht rückgängig gemacht, wenn sie aus der Aufgabe entfernt wird; das Entfernen ändert nur die Aufgabe.
- Karte und Aufgabenfenster zeigen die Wirkungen als Chips (`+ kd:I0048`, `↻ kd:D0002`, `− kd:I0014`) mit Link in die WBS-Sicht; die WBS-Sicht zeigt je Knoten die Aufgaben, die auf ihn wirken.
- Unbekannte Schlüssel in einer Wirkung bleiben erhalten.

## Akzeptanzkriterien

### Wirkung tritt ein
- [ ] Wirkung `create` unter `D0002` an #7 → WBS hat `I0048 rot` unter `D0002`, #7 trägt `node: I0048`, ein Commit im Board-Repository, keiner im Arbeits-Repository
- [ ] `rework D0002` (alle Kinder `gruen`) → `D0002` und seine zählenden Nachfahren `rot`
- [ ] `remove I0014` → `I0014` und Nachfahren `verworfen`
- [ ] `rework` auf unbekannten Knoten → 409, Aufgabendatei unverändert

### Anzeige
- [ ] Karte #7 zeigt `+ kd:I0048`; WBS-Sicht zeigt an `I0048` „#7“
- [ ] Wirkung aus #7 entfernen → `I0048` bleibt in der WBS

## Betroffene Verzeichnisstruktur

`src/modell/aufgabe.rs` und `src/format/aufgabe.rs` (`wbs-effects`), `src/dienst/wirkungen.rs` (neu), `src/web/mod.rs`, `src/web/endpunkte.rs`, `web/`; Tests `tests/wirkungen.rs`, `e2e/tests/r00057-wirkungen.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `Wirkung` (DTO) — Anwendung, Aktion (`Anlegen | Ueberarbeiten | Verwerfen`), Knoten, Angaben zum neuen Knoten
- `Kanban::wirkung_setzen(wer, nr, wirkung)` (Integration: R00056/R00055-Operationen, dann Aufgabe schreiben und committen)

## Tests
- Unit: Lesen und Schreiben des Namensraums, Rundlauf mit unbekannten Schlüsseln
- Integration: Board-Repository und Arbeits-Repository getrennt, Commit nur im Board-Repository, Fehlerpfad ohne Teiländerung
- E2E: Wirkung im Aufgabenfenster setzen, Chip und Gegenanzeige in der WBS-Sicht

## Abhängigkeiten
- Abhängig von: R00053, R00056
- Blockiert: R00059

## Offene Fragen
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Die WBS ist die Struktur des Programms, Aufgaben sind Arbeit, die sie verändert; heute steht dieser Zusammenhang nur im Kopf der KI und wird über getrennte Commands nachgezogen. Wenn die Aufgabe ihre Wirkung ausdrücklich trägt und kanbanD sie sofort ausführt, sind Board und WBS nach jeder Aktion konsistent. Die Gegenanzeige in der WBS-Sicht macht sichtbar, welche Arbeit an welchem Teil des Programms hängt. Darauf baut die Plausibilitätsprüfung (R00059) auf, die beim Weiterziehen prüft, ob die betroffenen Knoten grün sind.

## Notizen

- Verworfen: Wirkung erst bei Spaltenwechseln (rework beim Start, remove beim Abschluss) — gewünscht ist die sofortige Wirkung.
- Verworfen: Wirkung als reiner Verweis ohne Ausführung — dann bliebe der Abgleich bei der KI.
