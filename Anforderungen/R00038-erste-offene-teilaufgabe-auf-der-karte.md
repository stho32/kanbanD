---
id: R00038
status: Neu
datum: 2026-10-18
---

# R00038: Erste offene Teilaufgabe auf der Karte

## Beschreibung

Hat eine Aufgabe offene Teilaufgaben, zeigt die Karte auf dem Board die erste davon unter dem Titel — als nächsten Schritt. Ein Klick auf ihr Kästchen hakt sie ab (ein Commit), und die nächste offene rückt nach.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein Kanban, das ein Ordner ist“ (Teilaufgaben sind Markdown-Checkboxen), gewohnte Konventionen (Kanbanflow zeigt Teilaufgaben auf der Karte).

## Geschäftlicher Nutzen

Der nächste Schritt jeder Aufgabe ist auf dem Board sichtbar, ohne die Karte zu öffnen.

## Funktionale Anforderungen

- Karte: Zeile „☐ <Text>“ der ersten nicht erledigten Teilaufgabe unter dem Titel; keine Zeile, wenn alle erledigt sind oder es keine gibt; in der Abschlussspalte keine Zeile.
- Klick auf das Kästchen hakt diese Teilaufgabe ab, ohne die Karte zu öffnen; ohne Identität öffnet sich „Ich bin …“.

## Akzeptanzkriterien

- [ ] #1 mit `[x] a`, `[ ] b`, `[ ] c` zeigt „b“; Klick → Datei `[x] b`, Karte zeigt „c“; Klick → keine Zeile, „☑ 3/3“
- [ ] Karte ohne Teilaufgaben und Karte in der Abschlussspalte zeigen keine Zeile

## Betroffene Verzeichnisstruktur

`web/ansicht.js`, `web/app.js`, `web/kd-app.css`; E2E `e2e/tests/r00038-naechste-teilaufgabe.spec.js`.

## Abhängigkeiten
- Abhängig von: R00012

## Offene Fragen
