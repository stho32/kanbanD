---
id: R00067
status: Erledigt
datum: 2026-10-19
---

# R00067: Teilaufgaben per Ziehen ordnen

## Beschreibung

Im Aufgabenfenster lässt sich die Reihenfolge der Teilaufgaben per Drag & Drop ändern: Eine Teilaufgabe wird auf eine andere gezogen und landet davor (obere Hälfte) oder dahinter (untere Hälfte). Die Reihenfolge ist die der Markdown-Liste in der Aufgabendatei — und damit auch, welche Teilaufgabe als nächste auf der Karte steht (R00038).

Zahlt ein auf: [Vision](R00000-vision.md) — „bedienbar ohne Umweg“.

## Geschäftlicher Nutzen

Die Reihenfolge der Teilschritte drückt die geplante Abfolge aus; sie lässt sich ohne Editor korrigieren.

## Funktionale Anforderungen

- Jede Teilaufgabe im Aufgabenfenster ist ziehbar (nicht, solange ihr Text bearbeitet wird); eine Einfügemarke zeigt das Ziel.
- Ablegen auf der oberen Hälfte einer anderen Teilaufgabe setzt davor, auf der unteren dahinter; Haken und Text bleiben.
- Sofort sichtbar, danach `PATCH /api/aufgaben/{nr}/teilaufgaben/{i} {position}` — ein Commit `#n Teilaufgabe „…“ an Position k verschoben`; gleiche Stelle → kein Commit; eine Position außerhalb der Liste setzt ans Ende.

## Akzeptanzkriterien

- [x] Server: `position` verschiebt an die Stelle, ein Commit, gleiche Stelle ohne Commit, Haken bleibt
- [x] Oberfläche: die dritte Teilaufgabe auf die obere Hälfte der ersten ziehen → steht an erster Stelle, Datei in neuer Reihenfolge
- [x] die erste auf die untere Hälfte der letzten ziehen → steht am Ende
- [x] Die nächste offene Teilaufgabe auf der Karte folgt der neuen Reihenfolge

## Betroffene Verzeichnisstruktur

`src/dienst/teilaufgaben.rs`, `src/web/endpunkte.rs`; `web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Tests `tests/teilaufgaben.rs`, `e2e/tests/r00067-teilaufgaben-ordnen.spec.js`.

## Abhängigkeiten
- Abhängig von: R00012, R00038, R00066

## Offene Fragen
- keine
