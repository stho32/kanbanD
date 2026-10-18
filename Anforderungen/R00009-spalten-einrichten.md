---
id: R00009
status: Neu
datum: 2026-10-18
---

# R00009: Spalten einrichten

## Beschreibung

Im Modus „Spalten einrichten“ eines Boards lassen sich Spalten umbenennen, nach links und rechts schieben, neu anlegen (vor der Abschlussspalte) und entfernen, solange sie leer sind; jede Spalte kann eine Grenze (WIP-Limit) tragen. „Fertig“ schreibt die Board-Datei in einem Commit, „Verwerfen“ lässt alles, wie es war.

Zahlt ein auf: [Vision](R00000-vision.md) — „Das Board besitzt seine Struktur“.

## Geschäftlicher Nutzen

Der Ablauf eines Boards passt sich der Arbeit an, ohne dass eine Aufgabe ihre Spalte verliert.

## Funktionale Anforderungen

- `PUT /api/boards/<slug>/spalten` mit `[{name, alt?, grenze?}]` in der neuen Reihenfolge; `alt` nennt den bisherigen Namen, dessen Aufgaben die Spalte übernimmt; ohne `alt` ist sie neu und leer.
- Eine bisherige Spalte mit Aufgaben, die in der Liste fehlt → 409 „Spalte … enthält n Aufgaben“; unbekanntes `alt`, leerer oder doppelter Name, `alt` doppelt → 400.
- Grenzen stehen im Frontmatter der Board-Datei unter `limits`; Grenze 0 oder leer = keine.
- Ändert sich nichts, entsteht kein Commit. Nachricht: `Spalten von „<Board>“ geändert`.
- Der Spaltenkopf zeigt „Grenze n“; liegen mehr Karten in der Spalte, ist der Kopf als überschritten markiert.
- Der Einrichtemodus zeigt je Spalte Name, ←/→, ✕ (gesperrt mit Hinweis, wenn nicht leer), Grenze und Kartenzahl, dazu „neue Spalte · Enter“ und eine Vorschau der Board-Datei.

## Akzeptanzkriterien

- [ ] `A(1,2) · B() · C(3)` mit `[{name: "Offen", alt: "A"}, {name: "Neu"}, {name: "C", alt: "C", grenze: 2}]` ergibt `Offen(1,2) · Neu() · C(3)` und `limits: C: 2`
- [ ] Fehlt `A` (mit Aufgaben) → 409; fehlt `B` (leer) → erlaubt
- [ ] Gleiche Liste wie vorher → kein Commit
- [ ] Oberfläche: „In Arbeit“ in „Doing“ umbenennen, „Review“ anlegen, Fertig → Board zeigt „Zu erledigen · Doing · Review · Erledigt“, ein Commit
- [ ] Grenze 1 für „In Arbeit“ mit zwei Karten → Spaltenkopf trägt die Markierung „überschritten“

## Betroffene Verzeichnisstruktur

`src/modell/board.rs`, `src/dienst/spalten.rs`, `src/web/mod.rs`, `web/`; Tests im Modell, `tests/spalten.rs`, `e2e/tests/r00009-spalten.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `SpaltenAenderung { name, alt, grenze }` (DTO)
- `Board::spalten_setzen(&[SpaltenAenderung]) -> Result<bool, Spaltenfehler>` (pure)
- `Kanban::spalten_setzen(&Person, slug, &[SpaltenAenderung])` (Integration)

## Tests
- Unit: alle Regeln von `spalten_setzen`
- Integration: API, Konflikt, kein Commit ohne Änderung
- E2E: Einrichtemodus, Grenze

## Abhängigkeiten
- Abhängig von: R00008
- Blockiert: —

## Offene Fragen
