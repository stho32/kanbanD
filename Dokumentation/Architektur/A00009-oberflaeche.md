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
- [ADR-0010: Fokusführung über Ebenen mit Rückgabe](../ADRs/0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) — Soll (#8): reines Modul `web/fokus.js` (Ebenen, Tab-Umlauf, Fokusziel), Kleber am Ende von `render()`, Menüs mit echtem DOM-Fokus, Radiogruppen roving

## Offene Fragen

## Notizen / Quellen

- Einstieg `index.html`, `app.js`; Kopfzeile und Spalten `ansicht.js`; Gestaltung `kd-tokens.css`, `kd-base.css`, `kd-app.css` (Breakpoints 1180 und 1024 px, Responsive R00077).
- Plain JavaScript ohne Build-Schritt.
- Zeichenmodell: jedes Live-Ereignis mit geändertem Stand zeichnet `#kopf`, `#main`, `#over` per `innerHTML` neu (`web/app.js:428–465`); was das übersteht, regelt ADR-0007 (Soll: ein Sicherer über stabile Schlüssel; Ist 2026-11-05: Selektorliste `rollpositionen()` nur für `#main`, Felder nur mit `id`).
- Beobachtet (Karte #19, 2026-11-05): offenes Fenster verliert Scrollstand (`.mod-main` breit, `.mod-body` bis 640 px) und Fokus des Titelfelds bei jedem fremden Kommentar; der halb getippte Titel wird dabei committet.
- Soll nach ADR-0009 (Karte #18): Geldwerte genau einmal an der Grenze `Math.round(x * 100)`, danach ganzzahlig; Mitte `Math.floor((min + max + 1) / 2)`; Anzeige `Intl.NumberFormat('de-DE')`, Symbol hinter dem Betrag. Erste Ausbaustufe ohne schreibenden Aufrufer für `cost`.
- Soll nach ADR-0010 (Karte #8): Rangfolge nach `render()` — `S.ui.fokus`, Sicherer nur in der obersten Ebene, Rückgabe der geschlossenen Ebene, Startziel der geöffneten, `fokusKarte`/`fokusZeile`, erstes Element der obersten Ebene; `inert` unter der obersten Ebene, `aria-modal`, `aria-expanded` an Menü-Auslösern. Ist 2026-11-06: drei Menü-Mechanismen (`#kmenue` mit virtuellem Index `web/app.js:1332–1400`, `#pop` ohne Pfeile, `div`-menuitems ohne `tabindex` `web/ansicht.js:280`, `:300`), Dialoge ohne Fokusfalle (`web/ansicht.js:188`, `:209–232`, `:455`, `:471`, `:549`), Radiogruppen ohne `tabindex` (`:109`, `:666`, `:711`, `:764`), `spalte-zu` ohne Fokusziel (`web/app.js:1079`).
- Abweichungen von ADR-0010 erkennen: `grep -n "\.focus(" web/*.js` — 2026-11-06 neun Fundstellen (`app.js` 8, `sichtzustand.js` 1); nach dem Umbau nur `fokusSetzen`, der Kleber in `render()` und der keydown-Zweig der Fokusführung.
- nachgeführt 2026-11-06 nach #18 (ADR-0009)
- Einordnung der `#pop` nach ADR-0010 (PO 2026-11-06, `AI-Team/po-entscheidungen.md:107–108`): Ich-Pop Menü; Board-, Lauf-, Defekte-Dateien-Pop nicht-modale Fenster ohne `inert`, Tab am Rand schließt; künftig nur Einträge ⇒ Menü, sonst Fenster.
- nachgeführt 2026-11-06 nach #8 (ADR-0010)
