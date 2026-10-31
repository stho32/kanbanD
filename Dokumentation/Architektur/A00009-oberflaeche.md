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

## Offene Fragen

## Notizen / Quellen

- Einstieg `index.html`, `app.js`; Kopfzeile und Spalten `ansicht.js`; Gestaltung `kd-tokens.css`, `kd-base.css`, `kd-app.css` (Breakpoints 1180 und 1024 px, Responsive R00077).
- Plain JavaScript ohne Build-Schritt.
