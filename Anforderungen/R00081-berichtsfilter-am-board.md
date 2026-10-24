---
id: R00081
status: Erledigt
datum: 2026-10-24
---

# R00081: Berichtsfilter am Board, zugeklappt, mit „Rechnen ab“

## Beschreibung

Die Filterleiste der Berichte (R00043) wird eine **Box**, die per Standard zugeklappt ist: geschlossen zeigt sie eine Zeile mit der Zahl der wirkenden Filter und dem Datum „Rechnen ab“; ein Klick öffnet sie. Offen steht **jeder Filter in einer eigenen Zeile** (Rechnen ab, Zeitraum, Farben, Spalten, Zuständig, Labels). Ob die Box offen ist, merkt sich nur der Browser — das ist Ansicht.

Die Filtereinstellungen werden **dauerhaft im Markdown** gespeichert: je Board als `report-filter:` im Frontmatter der Board-Datei, für alle Berichte dieses Boards und für alle, die es ansehen. Jede Änderung ist ein Commit der gewählten Person; ohne Person wirkt der Filter nur in dieser Ansicht, und die Box sagt, dass er nicht gespeichert ist.

Der **Projektstart** (R00078) zieht als **„Rechnen ab“** in die Box und gilt für alle Berichte, die aus den Bewegungen des Boards rechnen: Burndown, Durchlaufzeit, Wie lange noch, Projekt-Fever-Chart. Vorher liegende Tage zählen nicht — so beginnt nach einer Neuplanung die Rechnung neu. Ein gewählter Zeitraum überstimmt das Datum wie bisher. Die Zeitberichte (Stundenzettel, Zeiten nach Aufgabe und Person) rechnen nicht aus Bewegungen und zeigen das Feld nicht.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein Kanban, das ein Ordner ist“: was ein Team einstellt, steht im Ordner.

## Geschäftlicher Nutzen

Die Berichte zeigen beim Öffnen das Diagramm statt einer langen Filterleiste; eingestellte Filter gehen nicht verloren und sind für alle gleich; nach einer Neuplanung genügt ein Datum.

## Funktionale Anforderungen

- Board-Datei: `report-filter: {period, from, to, exclude-classes, exclude-columns, people, labels}`, nur was vom Standard abweicht; unbekannter Zeitraum oder unlesbares Datum sind Formatfehler.
- `PUT /api/boards/{slug}/berichtsfilter` mit `{zeitraum, von, bis, ohneFarben, ohneSpalten, personen, labels}`; Commit „Berichtsfilter von „<Board>“ geändert“; ohne Änderung kein Commit; ungültig → 400. `GET /api/boards/{slug}` liefert `berichtsfilter`.
- Der Filter im Browser-Speicher (R00043) entfällt; ein Board ohne `report-filter` zeigt alles.
- Box: `details` mit Zusammenfassung „Filter · n aktiv · Rechnen ab TT.MM.JJJJ“ (bzw. „ab erster Aufgabe“); offen jede Gruppe in einer Zeile; Zurücksetzen hebt die Filter auf, nicht das Datum.
- „Rechnen ab“ (`start:` am Board, `PUT …/start`) wirkt in Burndown, Durchlaufzeit, Wie lange noch und Fever Chart, wenn kein Zeitraum gewählt ist. Es steht nicht mehr in den Termin- und Fever-Einstellungen.

## Akzeptanzkriterien

- [x] Format: Rundlauf mit allen Filterfeldern; Standard wird nicht geschrieben; Zeitraum „gibts“ ist Formatfehler
- [x] API: Filter setzen → Frontmatter und Commit der Person; gleicher Filter → kein Commit; falsches Datum → 400
- [x] Unit: Burndown und Durchlaufzeit beginnen bei „Rechnen ab“; ein Zeitraum überstimmt es
- [x] E2E: Box ist zu, öffnet per Klick, jede Gruppe eine Zeile; Farbe ausschließen → Board-Datei, nach Neuladen noch aktiv; „Rechnen ab“ in der Box setzt `start:`, der Burndown beginnt dort; ohne Person wirkt der Filter, wird aber nicht gespeichert

## Betroffene Verzeichnisstruktur

`src/modell/board.rs`, `src/format/board.rs`, `src/dienst/fieber.rs`, `src/web/mod.rs`, `src/web/endpunkte.rs`, `web/berichte.js`, `web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Tests `tests/berichtsfilter.rs`, `e2e/einheit/berichte.test.js`, `e2e/tests/r00081-berichtsfilter-am-board.spec.js` und die bestehenden Bericht-Tests.

## Abhängigkeiten
- Abhängig von: R00043 (Berichtsfilter), R00078 (Projektstart)

## Offene Fragen
- keine — „ab wann“ = Projektstart in der Filterbox, geklärt am 2026-10-24
