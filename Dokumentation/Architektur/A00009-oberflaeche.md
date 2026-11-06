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

- [ADR-0007: Sichtzustand übersteht das Neuzeichnen](../ADRs/0007-sichtzustand-uebersteht-das-neuzeichnen.md) — Nachtrag N1 (#8): alle Kinder von `#app` gesichert, `#main`/`#over` hinter Wächtern, `href` als Schlüssel
- [ADR-0009: Kosten als ganze Cent, eine Prüfung für Datei und API](../ADRs/0009-kosten-als-ganze-cent-eine-pruefung-fuer-datei-und-api.md) — Soll (#18): Chip „≈“ mit Mitte, Reiter „Kosten“, Kostenbericht; gerechnet in ganzen Cent in einem reinen Modul neben `web/berichte.js`
- [ADR-0010: Fokusführung über Ebenen mit Rückgabe](../ADRs/0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) — gebaut (#8, R00106): reines Modul `web/fokus.js` (Ebenen, Tab-Umlauf, Rand der Pop-Fenster, Fokusziele), Kleber am Ende von `render()`, Menüs mit Fokus per Skript ohne Tab-Halt, Radiogruppen roving; Abweichungen vom Text im Nachtrag N1–N6; N7 Rückfall ohne offene Ebene nie auf ein fremdes Element; N7a Rang 6 nur bei nach dem Neuzeichnen offener Ebene

## Offene Fragen

- keine

## Notizen / Quellen

- Einstieg `index.html`, `app.js`; Kopfzeile und Spalten `ansicht.js`; Gestaltung `kd-tokens.css`, `kd-base.css`, `kd-app.css` (Breakpoints 1180 und 1024 px, Responsive R00077).
- Plain JavaScript ohne Build-Schritt.
- Zeichenmodell: jedes Live-Ereignis mit geändertem Stand zeichnet `#kopf`, `#main`, `#over` per `innerHTML` neu (`render()`, `web/app.js:431–476`); was das übersteht, regelt ADR-0007 (Soll: ein Sicherer über stabile Schlüssel; Ist 2026-11-05: Selektorliste `rollpositionen()` nur für `#main`, Felder nur mit `id`).
- Beobachtet (Karte #19, 2026-11-05): offenes Fenster verliert Scrollstand (`.mod-main` breit, `.mod-body` bis 640 px) und Fokus des Titelfelds bei jedem fremden Kommentar; der halb getippte Titel wird dabei committet.
- Soll nach ADR-0009 (Karte #18): Geldwerte genau einmal an der Grenze `Math.round(x * 100)`, danach ganzzahlig; Mitte `Math.floor((min + max + 1) / 2)`; Anzeige `Intl.NumberFormat('de-DE')`, Symbol hinter dem Betrag. Erste Ausbaustufe ohne schreibenden Aufrufer für `cost`.
- Fokusführung nach ADR-0010, gebaut (Karte #8, R00106, Stand kanbanD `429c1e2`): die Entscheidungen rechnet das reine Modul `web/fokus.js` (`ebenen(ui, gemerkt)`, `fallenSchritt`, `fensterRand`, `fokusZiel`, `kmenueEintrag`; Test `e2e/einheit/fokus.test.js`), angewandt vom Kleber am Ende von `render()` (`fokusFuehren`, `web/app.js:629–649`): `inert` unter dem obersten Dialog und `aria-modal` (`ebenenAbschirmen`, `:482–491`), `aria-expanded` an den Auslösern (`:494–498`), Tab-Halt je Radiogruppe (`:501–507`), dann das erste setzbare Ziel der Rangfolge `S.ui.fokus` → Sicherer nur in der obersten Ebene → Rückgabe der geschlossenen → Start der geöffneten bzw. obersten → `fokusKarte`/`fokusZeile` ohne Ebene → erstes Tabbares. `fokusKarte`/`fokusZeile` haben zwei Schreibwege: Aktionen und der `focusin`-Hörer `fuehrungNachziehen` (`:1333–1340`). Pop → Pop-Wechsel gleicht `popGewechseltDurch` aus (`:607–616`). Menüs: Einträge `tabindex="-1"`, Fokus per Skript, Tab schließt; Kontextmenü behält den Index in `S.ui.menue` und führt den DOM-Fokus nach. Radiogruppen: `radioSchritt` in `web/tastatur.js`. `tm-ziel` ist ein Knopf mit `aria-pressed`.
- Gegenstücke über `data-halt` (ADR-0010, Sicherer nach ADR-0007): `klapp:<spalte>` (`.bk-name` ↔ `.zu-streifen`), `spalte:<spalte>` (Fläche), `kopf:<spalte>` (`.bahn-kopf`, offen und zugeklappt), `info:<spalte>` (Kommentarzeichen `.info`) — `web/ansicht.js:614`, `:629`.
- `.focus()`-Fundstellen gemessen 2026-11-06 (`grep -n "\.focus(" web/*.js`): 10 — `app.js` 9, `sichtzustand.js` 1 (vorher 9). Durchsetzung ist der Wächtertest `e2e/einheit/fokus.test.js:74–131` (Liste `ERLAUBT`), nicht der `grep`; Abweichung von R00106 Z. 110 entschieden, siehe Notiz „Erlaubte `.focus()`-Orte“ unten.
- nachgeführt 2026-11-06 nach #18 (ADR-0009)
- Einordnung der `#pop` nach ADR-0010 (PO 2026-11-06, `AI-Team/po-entscheidungen.md:107–108`): Ich-Pop Menü; Board-, Lauf-, Defekte-Dateien-Pop nicht-modale Fenster ohne `inert`, Tab am Rand schließt; künftig nur Einträge ⇒ Menü, sonst Fenster.
- nachgeführt 2026-11-06 nach #8 (ADR-0010)
- nachgeführt 2026-11-06 nach Bau und Review von #8 (R00106, kanbanD `429c1e2`; ADR-0010 Nachtrag)
- Erlaubte `.focus()`-Orte (ADR-0010 N5), entschieden durch den product-owner 2026-11-06 (`AI-Team/po-entscheidungen.md:109`): `fensterTaste`, `listenTaste`, `brettTaste` und der `/`-Zweig des `keydown`-Hörers gelten als keydown-Zweige und werden in R00106 Z. 110 und ADR-0010 namentlich genannt; kein Umbau auf `S.ui.fokus`. Der Wächtertest zählt künftig `.focus()` je erlaubter Funktion (heute je einer: `web/app.js:1534`, `:1681`, `:1706`, `:1783`); Umsetzung in #8 durch den entwickler.
- Identität einer Ebene (ADR-0010 N3), entschieden durch den product-owner 2026-11-06 (`AI-Team/po-entscheidungen.md:110`): bleibt `art`; der Pop → Pop-Ausgleich `popGewechseltDurch`/`vorigerPop` bleibt im Kleber, gesichert durch E2E „S2“ (`e2e/tests/r00106-fokus.spec.js:842`). Umstellung auf `art` + Pop-Name erst bei einem Befund am Pop-Wechsel oder einem zweiten Ausgleich im Kleber.
- nachgeführt 2026-11-06 nach PO-Entscheidungen zu ADR-0010 N3/N5
- Soll nach ADR-0007 N1 (Karte #8, Nacharbeit 3, noch nicht gebaut): Der Sicherer gilt für alle Kinder von `#app` (heute `#kopf`, `#main`, `#stat`), nur `#main` (gleiche Sicht) und `#over` (gleiche offene Aufgabe) bleiben hinter Wächtern. `#stat` wird im selben Block wie die übrigen Bereiche ersetzt, vor `rollstaendeSetzen`. Schlüsselkandidat `[href="…"]` steht zwischen `data-act` und den Klassen. Ist 2026-11-06: gesichert `#kopf` immer, `#main`/`#over` mit Wächter, `#stat` nicht (`web/app.js:446–448`, `:474`); kein `href` in `web/sichtzustand.js:20–34`. Gemessen (realist-consultant): 34/110 bzw. 16/92 fokussierbare Elemente verloren.
- Soll nach ADR-0010 N7 (PO 2026-11-06, `AI-Team/po-entscheidungen.md:111`): Rückfall „erstes tabbares Element“ nur bei offener oder gerade geschlossener Ebene. Ohne Ebene gilt: dasselbe Element, sonst geführte Karte bzw. Zeile, sonst `BODY`, nie ein fremdes Eingabefeld oder Bedienelement. Ist: `ersterTabbarer` auch ohne Ebene auf `#main` (`web/app.js:650`, `:680–684`). Abnahme beider Nachträge als ein Abtastraster über alle fokussierbaren Elemente × 5 Sichten × 2 Breiten.
- nachgeführt 2026-11-06 nach ADR-0007 N1 und ADR-0010 N7
- Präzisiert nach ADR-0010 N7a (PO 2026-11-06, `AI-Team/po-entscheidungen.md:113`): Rückfall „erstes tabbares Element“ nur, wenn nach dem Neuzeichnen noch eine Ebene offen ist, und dann in der obersten. Letzte Ebene geschlossen und Rückgabe gescheitert → geführte Karte bzw. Zeile, sonst `BODY`. Die Notiz zu N7 („offener oder gerade geschlossener Ebene“) gilt insoweit nicht mehr.
- nachgeführt 2026-11-06 nach ADR-0010 N7a
