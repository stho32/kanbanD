---
id: R00032
status: Erledigt
datum: 2026-10-18
---

# R00032: Sitzung und Verbindung

## Beschreibung

Kleine Dinge, die den Alltag glätten: Der Browser merkt sich das zuletzt gewählte Board und öffnet es wieder. Der Fenstertitel nennt das Board und — wenn Timer laufen — deren Zahl, sodass man es in der Tab-Leiste sieht. Kommt die Verbindung nach einer Unterbrechung zurück, sagt ein Hinweis „Wieder verbunden · Stand nachgeladen“. Ein leeres Board erklärt, wie Karten entstehen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Live überall“, „gewohnte Konventionen“.

## Geschäftlicher Nutzen

Weniger Orientierung, weniger Suchen nach dem richtigen Board, Vertrauen in den Live-Stand.

## Funktionale Anforderungen

- Letztes Board je Browser (`localStorage`, fehlertolerant); gilt, wenn die Adresse kein Board nennt und es das Board noch gibt.
- Fenstertitel: `<Board> — kanbanD`, bei laufenden Timern `(<n> ▶) <Board> — kanbanD`; auf anderen Seiten der Seitenname.
- Nach Wiederverbindung des Ereignisstroms: Hinweis „Wieder verbunden · Stand nachgeladen“.
- Ein Board ohne Karten zeigt in der ersten Spalte: „Noch keine Karten. „+ Karte“ oder Taste n — eine eingefügte Liste legt mehrere an, Kürzel wie @kürzel oder due:morgen setzen Felder.“

## Akzeptanzkriterien

- [x] Board „Test“ wählen, Seite ohne `#…` neu öffnen → „Test“ ist offen
- [x] Mit einem laufenden Timer lautet der Titel `(1 ▶) Entwicklung — kanbanD`
- [x] Leeres Board zeigt den Hilfetext
- [x] Nach einem Verbindungsabbruch und Wiederverbindung erscheint der Hinweis

## Betroffene Verzeichnisstruktur

`web/app.js`, `web/ansicht.js`; E2E `e2e/tests/r00032-sitzung.spec.js`.

## Tests
- E2E: alle Kriterien (Wiederverbindung über ein ausgelöstes Fehler- und Öffnungsereignis der Ereignisquelle)

## Abhängigkeiten
- Abhängig von: R00007, R00008

## Offene Fragen
