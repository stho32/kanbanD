---
id: A00009
name: Oberfläche
code: web
ebene: Komponente
eltern: A00002
repo: kanbanD
status: Aktiv
herkunft: code
quellen:
  - web/
verwandt: []
domaene: []
blackbox: Startmodell bewusst knapp; verfeinert wird, sobald eine Karte den Baustein ändert.
---

# Oberfläche

## Verantwortung

Die Oberfläche zeigt Boards im Browser als Einzelseite, die allein über die API liest oder schreibt.

## Schnittstellen

- ausgehend: `fetch` auf `/api/…` mit `X-KanbanD-Wer`, SSE für Live-Aktualisierung (`web/verbindung.js`)
- eingehend: ausgeliefert eingebettet durch die [Web-Schicht](A00003-web-schicht.md)

## Abhaengigkeiten

- [A00003 Web-Schicht](A00003-web-schicht.md)

## Entscheidungen

- [ADR-0007: Sichtzustand übersteht das Neuzeichnen](../ADRs/0007-sichtzustand-uebersteht-das-neuzeichnen.md)

## Offene Fragen

## Notizen / Quellen

- Einstieg `index.html`, `app.js`; Kopfzeile und Spalten `ansicht.js`; Gestaltung `kd-tokens.css`, `kd-base.css`, `kd-app.css` (Breakpoints 1180 und 1024 px, Responsive R00077).
- Plain JavaScript ohne Build-Schritt.
- Zeichenmodell: jedes Live-Ereignis mit geändertem Stand zeichnet `#kopf`, `#main`, `#over` per `innerHTML` neu (`web/app.js:428–465`); was das übersteht, regelt ADR-0007 (Soll: ein Sicherer über stabile Schlüssel; Ist 2026-11-05: Selektorliste `rollpositionen()` nur für `#main`, Felder nur mit `id`).
- Beobachtet (Karte #19, 2026-11-05): offenes Fenster verliert Scrollstand (`.mod-main` breit, `.mod-body` bis 640 px) und Fokus des Titelfelds bei jedem fremden Kommentar; der halb getippte Titel wird dabei committet.
