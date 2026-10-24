---
id: R00082
status: Erledigt
datum: 2026-10-24
---

# R00082: Gewonnenen Puffer im Fever Chart beschriften

## Beschreibung

Negativer Pufferverbrauch im Projekt-Fever-Chart (R00078) ist richtig gerechnet — die Prognose war an dem Tag vor dem Planende fertig —, aber das Wort „Verbrauch“ führt in die Irre. Unter 0 % beschriftet das Fever Chart deshalb, was gemeint ist:

- Tooltip und Kennzahl des letzten Stands nennen bei negativem Wert „Puffer gewonnen: n <Einheit> vor Planende“.
- Die Fläche unter 0 % trägt die Beschriftung „VOR PLAN — PUFFER GEWONNEN“.
- War der Umfang an einem Tag deutlich kleiner als heute (unter 80 %), nennt der Tooltip ihn: „Umfang damals 15, heute 87 — die Prognose kannte nur die damaligen Aufgaben“. So ist erkennbar, warum frühe Punkte tief im Grünen liegen.

Die Zahl selbst und die Zonen bleiben, wie sie sind.

Zahlt ein auf: [Vision](R00000-vision.md) — Steuerung mit Zahlen, die man richtig liest.

## Geschäftlicher Nutzen

Niemand hält einen richtigen Wert für einen Fehler; früher Optimismus durch kleinen Umfang ist als solcher sichtbar.

## Funktionale Anforderungen

- Jeder Punkt kennt seinen Abstand zum Planende in Tagen der Einheit (negativ = davor).
- Tooltip, Kennzahl, Flächenbeschriftung und Umfangshinweis wie oben; Methodik erklärt beides.

## Akzeptanzkriterien

- [x] Unit: Abstand zum Planende je Punkt (Beispiel 40/20: Ende 44 → 4 Tage danach; Puffer 10 → 6 Tage davor)
- [x] E2E: ein Punkt vor Plan zeigt im Tooltip „Puffer gewonnen: … vor Planende“; die Fläche unter 0 % ist beschriftet; ein Punkt mit kleinerem Umfang nennt „Umfang damals …, heute …“

## Betroffene Verzeichnisstruktur

`web/berichte.js`, `web/ansicht.js`; Tests `e2e/einheit/berichte.test.js`, `e2e/tests/r00078-fieber.spec.js`.

## Abhängigkeiten
- Abhängig von: R00078

## Offene Fragen
- keine — Variante „beschriften statt abschneiden“ gewählt am 2026-10-24
