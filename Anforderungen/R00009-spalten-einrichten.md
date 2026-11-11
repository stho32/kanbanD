---
id: R00009
status: Erledigt
datum: 2026-10-18
---

# R00009: Spalten einrichten

## Beschreibung

Im Modus „Spalten einrichten“ eines Boards lassen sich Spalten umbenennen, nach links und rechts schieben, neu anlegen (vor der Abschlussspalte) und entfernen, solange sie leer sind; jede Spalte kann eine Grenze (WIP-Limit) tragen. „Fertig“ schreibt die Board-Datei in einem Commit, „Verwerfen“ lässt alles, wie es war.

Zahlt ein auf: [Vision](R00000-vision.md) — „Das Board besitzt seine Struktur“.

## Geschäftlicher Nutzen

Der Ablauf eines Boards passt sich der Arbeit an, ohne dass eine Aufgabe ihre Spalte verliert.

## Funktionale Anforderungen

- `PUT /api/boards/<slug>/spalten` mit `[{name, alt?, grenze?}]` in der neuen Reihenfolge; `alt` nennt den bisherigen Namen, dessen Aufgaben die Spalte übernimmt. Fehlt `alt` und trägt eine Zeile den Namen einer vorhandenen Spalte, gilt diese als übernommen (Aufgaben und Einstellungen bleiben); sonst ist die Spalte neu und leer. `alt` bleibt für Umbenennen und Tauschen Pflicht.
- Eine bisherige Spalte mit Aufgaben, die in keiner Zeile übernommen wird (kein `alt` nennt sie, und keine Zeile ohne `alt` trägt ihren Namen) → 409 „Spalte … enthält 1 Aufgabe“ bzw. „Spalte … enthält n Aufgaben — erst leeren“; unbekanntes `alt`, leerer oder doppelter Name, `alt` doppelt → 400.
- Grenzen stehen im Frontmatter der Board-Datei unter `limits`; Grenze 0 oder leer = keine.
- Ändert sich nichts, entsteht kein Commit. Nachricht: `Spalten von „<Board>“ geändert`.
- Der Spaltenkopf zeigt „Grenze n“; liegen mehr Karten in der Spalte, ist der Kopf als überschritten markiert.
- Der Einrichtemodus zeigt je Spalte Name, ←/→, ✕ (gesperrt mit Hinweis, wenn nicht leer), Grenze und Kartenzahl, dazu „neue Spalte · Enter“ und eine Vorschau der Board-Datei.

## Akzeptanzkriterien

- [x] `A(1,2) · B() · C(3)` mit `[{name: "Offen", alt: "A"}, {name: "Neu"}, {name: "C", alt: "C", grenze: 2}]` ergibt `Offen(1,2) · Neu() · C(3)` und `limits: C: 2`
- [x] Fehlt `A` (mit Aufgaben) → 409; fehlt `B` (leer) → erlaubt
- [x] Gleiche Liste wie vorher → kein Commit
- [x] Oberfläche: „In Arbeit“ in „Doing“ umbenennen, „Review“ anlegen, Fertig → Board zeigt „Zu erledigen · Doing · Review · Erledigt“, ein Commit
- [x] Grenze 1 für „In Arbeit“ mit zwei Karten → Spaltenkopf trägt die Markierung „überschritten“

### Toleranter Rückfall ohne `alt` (Karte #22, fortgeschrieben 2026-11-11)

Ausgangsboard `A(1,2) · B() · C(3)`; die Einstellungen der Spalten sind belegt (`grenze`, `eigentuemer`, `pruefungen`, `notiz`, `farbe`).

- [ ] `[{name: "A"}, {name: "Neu"}, {name: "C"}]` (kein `alt`) → `A(1,2) · Neu() · C(3)`, kein 409; `grenze`, `eigentuemer`, `pruefungen`, `notiz` und `farbe` der Spalten `A` und `C` bleiben unverändert
- [ ] `[{name: "Posteingang"}]` (Umbenennen von `A` ohne `alt`) → 409 „Spalte „A“ enthält 2 Aufgaben — erst leeren“; `A` wird nicht übernommen
- [ ] `[{name: "A", alt: "Gibtsnicht"}]` → 400 `AltUnbekannt`
- [ ] `A(1,2) · B()` mit `[{name: "Posteingang", alt: "A"}, {name: "A"}]` (Umbenennen und zugleich neu anlegen) → `Posteingang(1,2) · A()`; die neue `A` ist leer (der Rückfall der zweiten Zeile entfällt, weil das `alt` der ersten Zeile `A` beansprucht)
- [ ] Board aus leeren Spalten `A() · B()` mit `[{name: "A"}, {name: "Review"}]` → `A() · Review()`; `Review` ist neu und leer, kein Fehler
- [ ] `[{name: "A", alt: "A"}]` und `[{name: "A"}]` ergeben beide `A(1,2)` — mit und ohne `alt` dasselbe Ergebnis
- [ ] Eine Spalte mit genau einer Aufgabe, die nicht übernommen wird → „Spalte „A“ enthält 1 Aufgabe — erst leeren“; mit drei → „Spalte „A“ enthält 3 Aufgaben — erst leeren“

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

## Fortschreibung

### 2026-11-11 — Toleranter Rückfall ohne `alt` (Karte #22, Interaktion I0107)

**Anlass.** `PUT /api/boards/{slug}/spalten` ohne `alt` antwortete bei einer belegten Spalte mit 409 („Spalte … enthält 1 Aufgaben — erst leeren“), obwohl der Spaltenname unverändert blieb — auch bei einer Spalte mit nur archivierten Karten. Mit `alt` gelang derselbe Aufruf. **Ursache im Code:** `Board::spalten_setzen` (`src/modell/board.rs:428`) füllt die Menge der übernommenen alten Namen (`alte`) nur aus vorhandenem `alt`, sodass die Leer-Prüfung (Z. 456) die namensgleiche Spalte trifft.

**Entscheidung (product-owner, `AI-Team/po-entscheidungen.md` Z. 185, Commit 0cac078): der Contract wird tolerant.** Fehlt `alt`, gilt die Spalte gleichen Namens als übernommen; gibt es sie nicht, bleibt die Spalte neu und leer; `alt` bleibt für Umbenennen und Tauschen Pflicht. Ohne Toleranz verlöre ein Aufruf ohne `alt` die veröffentlichten Einstellungen der Spalte (`grenze`, `eigentuemer`, `pruefungen`, `notiz`, `farbe`), die er gar nicht ändern wollte — genau der Datenverlust, den „fehlende Felder behalten den Wert der alten Spalte“ ausschließt.

**Randfall.** Beansprucht das `alt` einer anderen Zeile denselben Namen, entfällt der Rückfall dieser Zeile (sonst würden Aufgaben doppelt übernommen); Umbenennen-und-neu-Anlegen bleibt so möglich. Die Menge der übernommenen Namen (`alte`) muss den Namensrückfall enthalten, sonst trifft die 409-Prüfung eine Spalte, deren Name gleich bleibt. Ein wirklich neuer Name ohne `alt` bleibt neu und leer und darf nicht mit `AltUnbekannt` scheitern.

**Nachgezogen in dieser Fassung:** FA 1 und FA 2 sowie die Akzeptanzkriterien zum Rückfall (oben); dazu die Beschreibung von `PUT …/spalten` (`src/web/endpunkte.rs:37`, `src/web/mod.rs:415`, OpenAPI) und die Zählregel „1 Aufgabe“/„n Aufgaben“ in `src/dienst/spalten.rs:19`.

**Wächter:** `tests/spalten.rs`, `tests/spalteneinstellungen.rs`, `e2e/tests/r00009-spalten.spec.js`, `tests/openapi.rs` (vergleicht `/api/endpunkte` ↔ OpenAPI) und R00102:80 (Grammatik).

**Wirkungskette:** Ein namensgleiches `PUT` ohne `alt` löst keinen 409 mehr aus (X); Aufgaben und Einstellungen der Spalte bleiben unangetastet (Y); Board und Agenten richten den Spaltensatz um, ohne Karten oder Einstellungen zu verlieren (Z).

**Status:** Der ursprüngliche Umfang ist ausgeliefert, die Fassung bleibt darum `Erledigt`; die neuen, noch offenen Kriterien gehören zur Interaktion I0107 (Karte #22). Den Statuswechsel beim Abschluss setzt allein `/implementierung`.

