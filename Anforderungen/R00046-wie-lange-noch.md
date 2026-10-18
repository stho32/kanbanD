---
id: R00046
status: Erledigt
datum: 2026-10-18
---

# R00046: Wie lange noch

## Beschreibung

Der Bericht „Wie lange noch“ überträgt `/anwendung wie-lange-noch --karte` auf das Kanban: statt Phasen einer WBS sind es die Spalten des Boards. Eine Aufgabe hat eine Spalte erreicht, sobald sie dort oder rechts davon liegt. Je Spalte (außer der ersten) entsteht eine Kurve „noch nicht erreicht“ und — aus dem gemessenen Durchsatz (erreichte Aufgaben je Kalendertag, Nulltage eingeschlossen) — eine Monte-Carlo-Prognose mit den Perzentilen 50, 70, 85 und 95 %, als Datum in der 7- und in der 5-Tage-Woche. Eine Spalte wird nie früher prognostiziert als die Spalte links davon; deren Datum steht als Untergrenze dabei, nicht verrechnet. Unter drei gemessenen Läufen gibt es keine Perzentile („ungemessen“). Angelehnt an Kanbanflows „Monte Carlo forecasting“.

Spalten und Farben lassen sich über die Filterleiste (R00043) ausschließen — z. B. eine Ideen-Spalte oder Doku-Aufgaben; ebenso nur Personen, nur Labels; der Zeitraum ist die Messbasis des Durchsatzes. Der Bericht rechnet live neu, sobald Aufgaben bewegt, angelegt, archiviert oder vom Board genommen werden — er kann offen bleiben.

Zahlt ein auf: [Vision](R00000-vision.md) — „Git als Archiv inklusive Zeiten“, „Live überall“.

## Geschäftlicher Nutzen

Die Frage „wann sind wir durch?“ hat eine belegte Antwort mit Wahrscheinlichkeiten statt einer Schätzung.

## Funktionale Anforderungen

- Bericht unter `#/berichte/prognose`, im Menü „Berichte“ unter „Verlauf“, Kürzel `g w`.
- Kopf: „n von m fertig“ (Abschlussspalte), je Spalte „k von m erreicht“, Stand mit Uhrzeit.
- Diagramm: Umfang gestrichelt, je Spalte „offen“ bis heute, Fächer P50/P85/P95 bis 0 — höchstens drei Spalten farbig (die drei rechten), die übrigen in Tabelle und Blöcken; Tooltip je Tag; Tabellenansicht.
- Block je Spalte: Fortschrittsbalken, Tabelle der Perzentile (Datum 7-Tage-Woche, 5-Tage-Woche, Kalender- und Arbeitstage, nicht vor), Tagesreihe, Ø Durchsatz; „ungemessen“ unter drei Läufen; „alle erreicht“, wenn nichts offen.
- „Nicht enthalten“: Aufgaben ohne Board; Aufgaben in ausgeschlossenen Spalten oder Farben.
- Lesehinweise und Methodik.
- 5-Tage-Woche: Durchsatz nur über Werktage (Wochenend-Ankünfte zählen zum nächsten Werktag), Ziehung über Werktage, Datum ab heute nur Mo–Fr gezählt.
- Die Ziehung ist mit festem Startwert reproduzierbar.

## Akzeptanzkriterien

- [x] Unit: erreicht/offen je Spalte; Tagesreihe mit Nulltagen; Perzentile monoton und reproduzierbar; unter drei Läufen ungemessen; Untergrenze der Vorspalte; 5-Tage-Reihe und Werktagsdatum; Spalte und Farbe ausgeschlossen
- [x] E2E: Bericht zeigt Kopfzahlen, Block „Erledigt“ mit P50…P95, ungemessene Spalte; Spalte ausschließen entfernt ihren Block
- [x] E2E live: Bericht offen, eine Aufgabe wird per API nach „Erledigt“ bewegt → Kopfzahl steigt ohne Neuladen; neue Aufgabe → Umfang steigt

## Betroffene Verzeichnisstruktur

`web/berichte.js`, `web/ansicht.js`, `web/app.js`, `web/tastatur.js`, `web/kd-app.css`; Tests `e2e/einheit/berichte.test.js`, `e2e/einheit/tastatur.test.js`, `e2e/tests/r00046-wie-lange-noch.spec.js`.

## Abhängigkeiten
- Abhängig von: R00042, R00043, R00007

## Offene Fragen
