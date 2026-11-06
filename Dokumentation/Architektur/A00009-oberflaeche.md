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
- [ADR-0009: Kosten als ganze Cent, eine Prüfung für Datei und API](../ADRs/0009-kosten-als-ganze-cent-eine-pruefung-fuer-datei-und-api.md) — Soll (#18): Chip „≈“ mit Mitte, Reiter „Kosten“, Kostenbericht; gerechnet in ganzen Cent in einem reinen Modul neben `web/berichte.js`

## Offene Fragen

## Notizen / Quellen

- Einstieg `index.html`, `app.js`; Kopfzeile und Spalten `ansicht.js`; Gestaltung `kd-tokens.css`, `kd-base.css`, `kd-app.css` (Breakpoints 1180 und 1024 px, Responsive R00077).
- Plain JavaScript ohne Build-Schritt.
- Zeichenmodell: jedes Live-Ereignis mit geändertem Stand zeichnet `#kopf`, `#main`, `#over` per `innerHTML` neu (`web/app.js:428–465`); was das übersteht, regelt ADR-0007 (Soll: ein Sicherer über stabile Schlüssel; Ist 2026-11-05: Selektorliste `rollpositionen()` nur für `#main`, Felder nur mit `id`).
- Beobachtet (Karte #19, 2026-11-05): offenes Fenster verliert Scrollstand (`.mod-main` breit, `.mod-body` bis 640 px) und Fokus des Titelfelds bei jedem fremden Kommentar; der halb getippte Titel wird dabei committet.
- Soll nach ADR-0009 (Karte #18): Geldwerte genau einmal an der Grenze `Math.round(x * 100)`, danach ganzzahlig; Mitte `Math.floor((min + max + 1) / 2)`; Anzeige `Intl.NumberFormat('de-DE')`, Symbol hinter dem Betrag. Erste Ausbaustufe ohne schreibenden Aufrufer für `cost`.
- nachgeführt 2026-11-06 nach #18 (ADR-0009)
