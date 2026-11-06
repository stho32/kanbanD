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
- [ADR-0010: Fokusführung über Ebenen mit Rückgabe](../ADRs/0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) — gebaut (#8, R00106): reines Modul `web/fokus.js` (Ebenen, Tab-Umlauf, Rand der Pop-Fenster, Fokusziele), Kleber am Ende von `render()`, Menüs mit Fokus per Skript ohne Tab-Halt, Radiogruppen roving; Abweichungen vom Text im Nachtrag N1–N6

## Offene Fragen

- Erlaubte `.focus()`-Orte (ADR-0010 N5): der Wächtertest erlaubt `fensterTaste`, `listenTaste`, `brettTaste` und den `/`-Zweig des `keydown`-Hörers pauschal je Funktion; R00106 Z. 110 nennt nur Sicherer, Kleber und den keydown-Zweig der Fokusführung. Angleichen der Anforderung oder Umbau auf `S.ui.fokus` — offen.
- Identität einer Ebene (ADR-0010 N3): heute `art`, der Wechsel Pop → Pop wird im Kleber über `popGewechseltDurch`/`vorigerPop` ausgeglichen; `art` + Pop-Name in `web/fokus.js` wäre rein testbar — nicht entschieden.

## Notizen / Quellen

- Einstieg `index.html`, `app.js`; Kopfzeile und Spalten `ansicht.js`; Gestaltung `kd-tokens.css`, `kd-base.css`, `kd-app.css` (Breakpoints 1180 und 1024 px, Responsive R00077).
- Plain JavaScript ohne Build-Schritt.
- Zeichenmodell: jedes Live-Ereignis mit geändertem Stand zeichnet `#kopf`, `#main`, `#over` per `innerHTML` neu (`render()`, `web/app.js:431–476`); was das übersteht, regelt ADR-0007 (Soll: ein Sicherer über stabile Schlüssel; Ist 2026-11-05: Selektorliste `rollpositionen()` nur für `#main`, Felder nur mit `id`).
- Beobachtet (Karte #19, 2026-11-05): offenes Fenster verliert Scrollstand (`.mod-main` breit, `.mod-body` bis 640 px) und Fokus des Titelfelds bei jedem fremden Kommentar; der halb getippte Titel wird dabei committet.
- Soll nach ADR-0009 (Karte #18): Geldwerte genau einmal an der Grenze `Math.round(x * 100)`, danach ganzzahlig; Mitte `Math.floor((min + max + 1) / 2)`; Anzeige `Intl.NumberFormat('de-DE')`, Symbol hinter dem Betrag. Erste Ausbaustufe ohne schreibenden Aufrufer für `cost`.
- Fokusführung nach ADR-0010, gebaut (Karte #8, R00106, Stand kanbanD `429c1e2`): die Entscheidungen rechnet das reine Modul `web/fokus.js` (`ebenen(ui, gemerkt)`, `fallenSchritt`, `fensterRand`, `fokusZiel`, `kmenueEintrag`; Test `e2e/einheit/fokus.test.js`), angewandt vom Kleber am Ende von `render()` (`fokusFuehren`, `web/app.js:629–649`): `inert` unter dem obersten Dialog und `aria-modal` (`ebenenAbschirmen`, `:482–491`), `aria-expanded` an den Auslösern (`:494–498`), Tab-Halt je Radiogruppe (`:501–507`), dann das erste setzbare Ziel der Rangfolge `S.ui.fokus` → Sicherer nur in der obersten Ebene → Rückgabe der geschlossenen → Start der geöffneten bzw. obersten → `fokusKarte`/`fokusZeile` ohne Ebene → erstes Tabbares. `fokusKarte`/`fokusZeile` haben zwei Schreibwege: Aktionen und der `focusin`-Hörer `fuehrungNachziehen` (`:1333–1340`). Pop → Pop-Wechsel gleicht `popGewechseltDurch` aus (`:607–616`). Menüs: Einträge `tabindex="-1"`, Fokus per Skript, Tab schließt; Kontextmenü behält den Index in `S.ui.menue` und führt den DOM-Fokus nach. Radiogruppen: `radioSchritt` in `web/tastatur.js`. `tm-ziel` ist ein Knopf mit `aria-pressed`.
- Gegenstücke über `data-halt` (ADR-0010, Sicherer nach ADR-0007): `klapp:<spalte>` (`.bk-name` ↔ `.zu-streifen`), `spalte:<spalte>` (Fläche), `kopf:<spalte>` (`.bahn-kopf`, offen und zugeklappt), `info:<spalte>` (Kommentarzeichen `.info`) — `web/ansicht.js:614`, `:629`.
- `.focus()`-Fundstellen gemessen 2026-11-06 (`grep -n "\.focus(" web/*.js`): 10 — `app.js` 9, `sichtzustand.js` 1 (vorher 9). Durchsetzung ist der Wächtertest `e2e/einheit/fokus.test.js:74–131` (Liste `ERLAUBT`), nicht der `grep`; Abweichung von R00106 Z. 110 siehe Offene Fragen.
- nachgeführt 2026-11-06 nach #18 (ADR-0009)
- Einordnung der `#pop` nach ADR-0010 (PO 2026-11-06, `AI-Team/po-entscheidungen.md:107–108`): Ich-Pop Menü; Board-, Lauf-, Defekte-Dateien-Pop nicht-modale Fenster ohne `inert`, Tab am Rand schließt; künftig nur Einträge ⇒ Menü, sonst Fenster.
- nachgeführt 2026-11-06 nach #8 (ADR-0010)
- nachgeführt 2026-11-06 nach Bau und Review von #8 (R00106, kanbanD `429c1e2`; ADR-0010 Nachtrag)
