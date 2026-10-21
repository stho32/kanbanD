---
id: R00073
status: Erledigt
datum: 2026-10-21
---

# R00073: Diagramme im Vollbild, Datum überall unter dem Zeiger

## Beschreibung

Die Diagramme der Berichte — Burndown, Durchlaufzeit und Wie lange noch — lassen sich auf Vollbild vergrößern, und sie zeigen überall unter dem Mauszeiger das Datum an der Stelle.

- **Vollbild**: ein Knopf oben rechts am Diagramm füllt den Bildschirm mit dem Diagramm; Esc oder der Knopf beenden es. Das Vollbild übersteht das Neuzeichnen, das „Wie lange noch“ live auslöst.
- **Datum überall**: bisher zeigt der Tooltip nur über den Tagen mit Daten (bei „Wie lange noch“ nur bis heute, bei „Durchlaufzeit“ nur an den Punkten). Künftig zeigen Fadenkreuz und Tooltip an jeder Stelle der Zeichenfläche den Tag unter dem Zeiger — in der Zukunft von „Wie lange noch“ zusätzlich je Serie die Chance, bis zu diesem Tag fertig zu sein.
- **Datum mit Jahr**: jede Datumsangabe in Diagrammen und ihren Tooltips nennt Tag, Monat und Jahr. An der x-Achse steht das Jahr umgebrochen unter Tag und Monat (`21.10.` / `2026`).

Zahlt ein auf: [Vision](R00000-vision.md) — Berichte, die man lesen kann, ohne nachzurechnen.

## Geschäftlicher Nutzen

Prognosen und Verläufe lassen sich im Gespräch groß zeigen und an jeder Stelle datieren — auch über einen Jahreswechsel, ohne zu raten, welches Jahr gemeint ist.

## Funktionale Anforderungen

- Je Diagramm ein Knopf „Vollbild“ (`aria-label="Diagramm im Vollbild"`), im Vollbild „Vollbild beenden“; Esc beendet; ein Wechsel der Ansicht beendet.
- Zeigerposition → Tag: auf der Zeichenfläche wird die Position auf den nächsten Kalendertag gerundet; Fadenkreuz auf diesem Tag, Tooltip mit `TT.MM.JJJJ` als Kopf.
- Burndown: Kopf mit Jahr, darunter offen und Umfang wie bisher.
- Durchlaufzeit: Kopf „Ankunft TT.MM.JJJJ“, darunter die Zahl der Aufgaben, die an diesem Tag angekommen sind; die Punkte bleiben klickbar, ihr Titel nennt das Datum mit Jahr.
- Wie lange noch: bis heute wie bisher (Umfang, offen je Spalte), danach je Spalte „fertig bis dahin: X % · Y % in der 5-Tage-Woche“ (wie die Termin-Chance) bzw. „erreicht“ oder „keine Aussage“; Beschriftungen der Fächer und Termine mit Jahr.
- x-Achsen aller drei Diagramme: zwei Zeilen `TT.MM.` und `JJJJ`.

## Akzeptanzkriterien

- [x] Der Knopf „Diagramm im Vollbild“ legt das Diagramm über den ganzen Bildschirm; Esc stellt die Seite wieder her; bei „Wie lange noch“ bleibt das Vollbild nach einem Live-Neuzeichnen stehen
- [x] „Wie lange noch“: Zeiger rechts von heute zeigt einen Tooltip mit Datum samt Jahr und der Chance je Spalte
- [x] „Durchlaufzeit“: Zeiger auf leerer Fläche zeigt einen Tooltip mit Datum samt Jahr
- [x] Burndown: Tooltip mit Datum samt Jahr
- [x] Die x-Achse aller drei Diagramme zeigt je Marke Tag.Monat und darunter das Jahr
- [x] Zeigerposition → Tag ist als reine Funktion getestet (Rundung, Ränder, ein einziger Tag)

## Betroffene Verzeichnisstruktur

`web/berichte.js`, `web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Tests `e2e/einheit/berichte.test.js`, `e2e/tests/r00073-diagramme.spec.js`.

## Abhängigkeiten
- Abhängig von: R00044, R00045, R00046, R00047

## Offene Fragen
- keine
