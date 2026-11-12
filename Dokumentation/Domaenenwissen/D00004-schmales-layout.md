---
id: D00004
name: Schmales Layout
status: Aktiv
sprache: de
verwandt: [D00001, D00002, D00003, D00006, D00007, D00009]
gebiet: Oberfläche
synonyme: [Handy-Layout, schmal]
code: ["@media (max-width:640px)"]
---

# Schmales Layout

## Definition

Das schmale Layout ist die Darstellung der Oberfläche bei einer Fensterbreite bis einschließlich 640 px, wie sie ein Handy hat. Im [Aufgabenfenster](D00001-aufgabenfenster.md) stehen dann die Felder der [Seitenleiste](D00003-seitenleiste.md) unter Titel und Beschreibung, und [Hauptbereich](D00002-hauptbereich.md) und Seitenleiste scrollen gemeinsam als ein Fensterinhalt (bestätigt, R00077, R00103).

## ELI14

So sieht kanbanD auf dem Handy aus: alles untereinander statt nebeneinander.

## Bestandteile

- Kopfzeile je Breite: ab 600 px die Leiste Board/Berichte ▾, unter 600 px der Seitenknopf „Seite: <Seite> ▾“ mit demselben Zielpaar; die vier selteneren Ziele und die Werkzeuge liegen im Menü „…“ ([Hauptnavigation](D00009-hauptnavigation.md), R00101, R00140)
- Board: jede Spalte fast bildschirmbreit, Wischen rastet spaltenweise ein
- Aufgabenfenster: Seitenleiste unter dem Hauptbereich, ein gemeinsamer Scrollbereich
- Einrichten einspaltig; breite Tabellen scrollen in sich

## Beziehungen

- Gegenstück: das breite Layout (Desktop ab 1025 px); dazwischen die Tablet-Stufe bis 1024 px (R00077:13)
- verändert die Anordnung von [Hauptbereich](D00002-hauptbereich.md) und [Seitenleiste](D00003-seitenleiste.md)
- im Aufgabenfenster gibt es dann nur eine [Leseposition](D00006-leseposition.md) statt zwei

## Wechselwirkungen

- [Aufgabenfenster](D00001-aufgabenfenster.md) füllt den Bildschirm und wird als Ganzes gescrollt
- [Leseposition](D00006-leseposition.md) hängt im Fenster am gemeinsamen Fensterinhalt (`.mod-body`), nicht an Hauptbereich und Seitenleiste
- [Hinweis](D00007-hinweis.md) bricht um, statt quer zu scrollen; „rückgängig“ bleibt ganz im Bild (R00112 AK 11)

## Vorkommen in Anforderungen

- [R00077](../../Anforderungen/R00077-responsive-fuer-tablet-und-handy.md) — Stufe „Handy (bis 640 px)“ (Zeilen 14–18)
- [R00103](../../Anforderungen/R00103-behebung-aufgabenfenster-springt-bei-live-aenderungen.md) — Begriffe (Zeile 19), Beispiel schmal 600 × 700 (Zeile 95)
- [R00112](../../Anforderungen/R00112-entfernen-rueckgaengig-und-sichtbare-entfernen-knoepfe.md) — Hinweis bei 320 × 640 (AK 11)
- [R00101](../../Anforderungen/R00101-kopfzeile-auf-jeder-breite-bedienbar.md) — Kopfzeile je M3-Stufe; unter 600 px Seitenknopf statt wischbarer Leiste (Zeilen 28–33)
- [R00140](../../Anforderungen/R00140-navigation-seltene-ziele-im-mehr-menue.md) — Leiste auf Board und Berichte gekürzt, die vier seltenen Ziele ins Menü „…“ (Zeilen 11, 28–37)

## Notizen / Quellen

- Definition nach R00077:14–18 (Stufe „Handy“) und R00103:19 („≤ 640 px … scrollen gemeinsam“) — bestätigt.
- Code (beobachtet, Stand bb8ede3): `@media (max-width:640px)` in `web/kd-app.css:710–716`; im Fenster scrollt `.mod-body` (`overflow:auto`), `.mod-main` und `.mod-side` nicht (`overflow:visible`). Die Tablet-Stufe ist `@media (max-width:1024px)` (`web/kd-app.css:700`).
- Oberfläche (de): kein sichtbarer Text; Begriff der Anforderungen und Tests.
- R00077 sagt „Handy“, R00103 „schmales Layout“ bzw. „schmal“ — dieselbe Sache, Leitform ab R00103 „schmales Layout“, weil es an der Breite hängt, nicht am Gerät (ein schmales Desktop-Fenster zählt auch).
- „Fensterinhalt“ (R00103:95) meint im schmalen Layout den gemeinsamen Scrollbereich `.mod-body` aus Hauptbereich und Seitenleiste.
- Nicht verwenden: „mobiler Modus“ — R00077:11 sagt ausdrücklich „dieselbe Seite, kein zweiter Modus“.
- Kopfzeilen-Bestandteil nachgeführt 2026-11-12 (R00140:196): bis R00101 war die compact-Navigation eine wischbare Leiste, seither ein Seitenknopf mit Menü; seit R00140 trägt die Leiste zwei Ziele (Board, Berichte ▾) und das Menü „…“ die vier seltenen (Code beobachtet, Stand c55e92d: `web/ansicht.js:84–147`, `web/kopfzeile.js:17–29`). Die Grenze der Kopfzeile ist 600 px (M3), nicht die 640 px dieses Eintrags — bei 600–640 px zeigt die Kopfzeile weiterhin die Leiste ([Hauptnavigation](D00009-hauptnavigation.md)).
