---
id: R00072
status: Erledigt
datum: 2026-10-20
---

# R00072: Wirkungsstand als Punkt auf der Karte

## Beschreibung

Die Karte zeigt ihre Wirkungen auf die WBS nicht mehr als einzelne Chips, sondern als **einen** Punkt: links in der rechtsbündigen Gruppe der untersten Zeile, ohne Beschriftung, mit Tooltip, ohne Link und ohne Reaktion auf Überfahren. Geschaltet und verlinkt wird im Aufgabenfenster (R00071).

Der Punkt sagt, ob die WBS im **Zielzustand** der Karte ist:

- `create` und `rework`: der Knoten steht und ist gerechnet `gruen` — gebaut;
- `remove`: der Knoten ist verworfen oder fehlt;
- ein `create` ohne Knoten ist nicht im Zielzustand.

Grün, wenn alle Wirkungen im Zielzustand sind; rot, wenn eine es nicht ist; grau, wenn keine rot ist, aber eine WBS nicht lesbar ist. Der Tooltip nennt je Wirkung Zeichen, Knoten, Absicht und Stand.

Die Ampel im Aufgabenfenster bekommt dieselbe Bedeutung (Zielzustand); der Schalter „eingetreten“ zeigt weiter, ob die Änderung an der WBS ausgeführt wurde (R00071). So ist eine Karte, die an einen schon gebauten Knoten gebunden ist, grün, ohne dass ihre `rework`-Wirkung ausgeführt sein muss — die JoinPuya-Karten mit grünen Interactions zeigen grün.

Ergänzt R00071: dort zeigte die Ampel den Eintritt; R00071 bleibt unverändert, diese Anforderung gilt für die Ampel.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die WBS als Stand, die Aufgaben als Fortschritt“.

## Geschäftlicher Nutzen

Auf einen Blick sehen, ob die Arbeit einer Karte in der WBS angekommen ist, ohne dass Chips die Karte füllen.

## Funktionale Anforderungen

- `GET /api/aufgaben/{nr}/wbs-effects` liefert je Wirkung zusätzlich `erfuellt: true|false|null`.
- Karte: ein Punkt `.wpunkt` (an/aus/grau) mit Tooltip, nur bei Karten mit Wirkungen; keine Chips mehr auf der Karte.
- Aufgabenfenster: Ampel je Wirkung = Zielzustand, Schalter = Eintritt.

## Akzeptanzkriterien

- [x] Karte mit einer Wirkung `rework` auf einen grünen Knoten (nicht eingetreten): Punkt grün; auf einen roten Knoten: Punkt rot
- [x] Karte mit zwei Wirkungen, eine im Zielzustand, eine nicht: Punkt rot, der Tooltip nennt beide mit Stand
- [x] Der Punkt ist kein Link und reagiert nicht auf Überfahren; die Karte zeigt keine Wirkungs-Chips mehr
- [x] `erfuellt` in der API wie oben

## Betroffene Verzeichnisstruktur

`src/dienst/wirkungen.rs`, `src/web/endpunkte.rs`; `web/wbs.js`, `web/ansicht.js`, `web/kd-app.css`; Tests `tests/wirkungen.rs`, `e2e/einheit/wbs.test.js`, `e2e/tests/r00057-wirkungen.spec.js`, `e2e/tests/r00071-wirkung-eintritt.spec.js`.

## Abhängigkeiten
- Abhängig von: R00057, R00071

## Offene Fragen
- keine
