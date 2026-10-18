---
id: R00045
status: Erledigt
datum: 2026-10-18
---

# R00045: Durchlaufzeit als eigener Bericht

## Beschreibung

Die Durchlaufzeit ist ein eigener Bericht, angelehnt an Kanbanflows „Cycle & Lead time“: wie lange Aufgaben von einer Spalte bis zu einer anderen brauchen. Standard ist die Lead Time — vom ersten Auftauchen auf dem Board bis zur Abschlussspalte; mit „von Spalte“ und „bis Spalte“ wird daraus z. B. die Cycle Time ab „In Arbeit“. Eine Aufgabe hat eine Spalte erreicht, sobald sie dort oder rechts davon liegt; es zählt das erste Erreichen.

Ein Streudiagramm zeigt je Aufgabe Ankunftstag und Tage, mit Linien für Median und 85 %; darunter die Tabelle und die Kennzahlen Anzahl, Mittel, Median, 85 %. Die Filterleiste gilt: Zeitraum (nach Ankunft), Farben, Personen, Labels.

Löst ab: die Tabelle „Durchlaufzeit je Aufgabe“ aus R00023 (Datei unverändert).

Zahlt ein auf: [Vision](R00000-vision.md) — „Git als Archiv inklusive Zeiten“.

## Geschäftlicher Nutzen

Wer fragt „wie lange dauert so etwas bei uns?“, bekommt eine belegte Antwort mit Streuung.

## Funktionale Anforderungen

- Bericht unter `#/berichte/durchlauf`, im Menü „Berichte“ und mit `g d`.
- „von“ muss links von „bis“ liegen; sonst Hinweis statt Werten.
- Klick auf eine Zeile oder einen Punkt öffnet die Aufgabe.

## Akzeptanzkriterien

- [x] Unit: Lead Time und Cycle Time; Rückkehr zählt das erste Erreichen; Zeitraum nach Ankunft; Kennzahlen inkl. 85 %
- [x] E2E: Bericht zeigt #1 mit 1,0 Tagen und Kennzahlen; „von In Arbeit“ blendet Aufgaben aus, die „In Arbeit“ übersprungen haben, nicht; Farbe ausgeschlossen blendet aus
- [x] Burndown enthält keine Durchlaufzeit mehr

## Betroffene Verzeichnisstruktur

`web/berichte.js`, `web/ansicht.js`, `web/app.js`, `web/tastatur.js`, `web/kd-app.css`; Tests `e2e/einheit/berichte.test.js`, `e2e/einheit/tastatur.test.js`, `e2e/tests/r00045-durchlaufzeit.spec.js`.

## Abhängigkeiten
- Abhängig von: R00042, R00043, R00044

## Offene Fragen
