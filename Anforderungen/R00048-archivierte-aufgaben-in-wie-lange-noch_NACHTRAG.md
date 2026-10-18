---
id: R00048
status: Erledigt
datum: 2026-10-18
---

# R00048: Archivierte Aufgaben in „Wie lange noch“ (Nachtrag)

## Beschreibung

Rekonstruiert aus dem Code von R00046 (`prognose` in `web/berichte.js`). Archivieren lässt die Zeile im Board stehen ([R00017](R00017-archivieren-und-zurueckholen.md)). Damit eine abgebrochene Aufgabe in „Wie lange noch“ nicht für immer als offen zählt, gilt: Eine archivierte Aufgabe, die **nicht** in der Abschlussspalte liegt, gilt ab ihrem Archivtag (`archived:`) als verworfen. Sie zählt weder zum Umfang noch zu den offenen Aufgaben. Der Bericht nennt ihre Anzahl unter „Nicht enthalten“. Eine archivierte Aufgabe in der Abschlussspalte zählt weiter als fertig, damit ihr Durchsatz in der Messung bleibt. Vor dem Archivtag zählt die Aufgabe im Verlauf normal.

Das Burndown (R00044) zählt archivierte Aufgaben unverändert mit.

Zahlt ein auf: [Vision](R00000-vision.md) — „Git als Archiv“; ergänzt [R00046](R00046-wie-lange-noch.md).

## Geschäftlicher Nutzen

Die Prognose rechnet nur mit Arbeit, die noch ansteht; verworfene Aufgaben verschieben das Datum nicht.

## Funktionale Anforderungen

- Zählregel je Zeitpunkt t: Aufgabe auf dem Board, Spalte nicht ausgeschlossen, und nicht (archiviert ∧ Spalte ≠ Abschlussspalte ∧ t ≥ Archivtag).
- „Nicht enthalten“: Zeile „Archiviert außerhalb der Abschlussspalte (gelten als verworfen): n“.
- Live: Archivieren über Oberfläche oder API ändert den offenen Bericht ohne Neuladen.

## Akzeptanzkriterien

- [x] Unit `Prognose: archiviert außerhalb der Abschlussspalte ist verworfen`: #1 in A archiviert am 20.10., #2 in Z archiviert, #3 offen → Umfang 2, erreicht 1, offen 1, verworfen 1; Umfang je Tag 3, 2, 2
- [x] E2E `R00046 US-3`: Bericht offen, `POST /api/aufgaben/5/archivieren` → „4 von 6 fertig“ (vorher 4 von 7) und „gelten als verworfen): 1“

## Betroffene Verzeichnisstruktur

`web/berichte.js` (`prognose`), `web/ansicht.js` (`vPrognose`, Abschnitt „Nicht enthalten“); Tests `e2e/einheit/berichte.test.js`, `e2e/tests/r00046-wie-lange-noch.spec.js`.

## Abhängigkeiten
- Abhängig von: R00046, R00017

## Offene Fragen
