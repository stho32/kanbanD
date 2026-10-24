---
id: R00079
status: Erledigt
datum: 2026-10-24
---

# R00079: Zielspalte im Fever Chart

## Beschreibung

Im Projekt-Fever-Chart (R00078) zählt bisher als erledigt, was die Abschlussspalte erreicht hat, bei gebundenen Boards: was die letzte Phase durchlaufen hat. Manche Projekte schließen aber final nur wenige Aufgaben ab; dort trägt vorübergehend eine frühere Spalte die Aussage, im Projekt Puya etwa „Entwicklung“. Die **Zielspalte** ist wählbar: zur Auswahl stehen dieselben Blöcke wie in „Wie lange noch“, also je Spalte „erreicht“ (dort oder rechts davon), je Phase „durchlaufen“ (in einer Spalte einer späteren Phase). Fortschritt und prognostiziertes Ende kommen dann aus diesem Block.

Die Wahl steht am Board und gilt nur im Fever Chart; „Wie lange noch“ bleibt unberührt. Ohne Wahl bleibt alles wie in R00078.

Zahlt ein auf: [Vision](R00000-vision.md) — informelle Regeln eines Teams ermöglichen, ohne sie ins Werkzeug zu gießen.

## Geschäftlicher Nutzen

Das Fever Chart zeigt eine Aussage, sobald es irgendeinen messbaren Durchsatz gibt, auch wenn die letzte Spalte noch fast leer ist.

## Funktionale Anforderungen

- Board-Datei: `fever: {target-column: <Spalte oder Phase>}`; fehlt der Schlüssel, gilt der letzte Block.
- `PUT /api/boards/{slug}/fieber` nimmt `zielspalte` (Text oder null); ein leerer Name ist ungültig (400).
- Bericht: Auswahl „Erledigt heißt“ mit den Blöcken aus „Wie lange noch“; Kennzahl, Tooltip und Methodik nennen, was gezählt wird. Gibt es die gewählte Spalte nicht mehr, Hinweis und Rechnung mit dem letzten Block.
- Cache: eine gesetzte Zielspalte gehört zum Schlüssel; ohne Zielspalte bleibt der Schlüssel aus R00078 gültig.

## Akzeptanzkriterien

- [x] Format: Rundlauf mit `target-column`; ohne Schlüssel unverändert
- [x] API: Zielspalte setzen → Frontmatter, Commit; leer → 400
- [x] Unit: Prognose nur für einen benannten Block; Tag des Fever Charts nach Zielspalte; Schlüssel ohne Zielspalte wie bisher, mit Zielspalte anders
- [x] E2E: „Erledigt heißt“ auf „In Arbeit“ → Board-Datei, Fortschritt nach „In Arbeit erreicht“, Cache für den neuen Schlüssel ergänzt; unbekannte Zielspalte → Hinweis

## Betroffene Verzeichnisstruktur

`src/modell/board.rs`, `src/format/board.rs`, `web/berichte.js`, `web/ansicht.js`, `web/app.js`; Tests `tests/fieber.rs`, `e2e/einheit/berichte.test.js`, `e2e/tests/r00078-fieber.spec.js`.

## Abhängigkeiten
- Abhängig von: R00078

## Offene Fragen
- keine — Bedeutung „passiert“ = Block aus „Wie lange noch“, geklärt am 2026-10-24
