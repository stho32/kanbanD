---
id: R00070
status: Erledigt
datum: 2026-10-20
---

# R00070: Dark-Mode

## Beschreibung

kanbanD lässt sich hell oder dunkel darstellen. Ohne Wahl folgt die Oberfläche der Einstellung des Systems (`prefers-color-scheme`); ein Knopf in der Kopfleiste schaltet reihum **System → Hell → Dunkel**. Die Wahl gilt je Browser und bleibt über ein Neuladen erhalten.

Dunkel heißt: alle Gestaltungswerte des Token-Sheets haben eine dunkle Entsprechung — Flächen, Linien, Text, Akzent, Klassenpalette, WBS-Ampel. Eigene Klassen- und Spaltenfarben (R00069) werden über die Fläche gemischt, damit Text lesbar bleibt.

Zahlt ein auf: [Vision](R00000-vision.md) — „bedienbar ohne Umweg“.

## Geschäftlicher Nutzen

Angenehmes Arbeiten bei wenig Licht und auf Systemen, die dunkel eingestellt sind.

## Funktionale Anforderungen

- Token-Sheet: dunkle Werte für alle Farb-Tokens, wirksam bei `prefers-color-scheme: dark` ohne Wahl oder bei `data-theme="dark"` am Wurzelelement; `data-theme="light"` erzwingt hell. `color-scheme` folgt, damit native Bedienelemente mitgehen.
- Kopfleiste: ein Knopf „Darstellung“ mit der aktuellen Wahl im Tooltip; Klick wechselt System → Hell → Dunkel → System.
- Die Wahl steht im Browser-Speicher (`kanbanD.thema`); fehlt er oder ist er gesperrt, gilt System.
- Eigene Klassenfarben mischen über die Fläche statt über Weiß; Spaltenfarben werden im Dunkeln gedämpft (Anteil als Token).

## Akzeptanzkriterien

- [x] Ohne Wahl und mit dunklem System ist der Hintergrund dunkel, mit hellem System hell
- [x] Der Knopf wechselt System → Hell → Dunkel → System; Hell und Dunkel gelten unabhängig vom System
- [x] Die Wahl überlebt ein Neuladen
- [x] Text auf Karten bleibt im Dunkeln lesbar (Kontrast Kartentext zu Kartengrund mindestens 4,5:1)

## Betroffene Verzeichnisstruktur

`web/kd-tokens.css`, `web/kd-app.css`, `web/ansicht.js`, `web/app.js`; Test `e2e/tests/r00070-dark-mode.spec.js`.

## Abhängigkeiten
- Abhängig von: R00004, R00069

## Offene Fragen
- keine
