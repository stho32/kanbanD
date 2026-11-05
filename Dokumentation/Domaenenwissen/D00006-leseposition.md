---
id: D00006
name: Leseposition
status: Aktiv
sprache: de
verwandt: [D00001, D00002, D00003, D00004, D00005]
gebiet: Oberfläche
synonyme: [Scrollposition, Scrollstand]
code: [rollpositionen, rollpositionenSetzen]
---

# Leseposition

## Definition

Die Leseposition ist die Stelle, bis zu der eine Person eine scrollbare Fläche der Oberfläche gescrollt hat — waagerecht und senkrecht, je Fläche in Pixeln. Sie gehört zu einer Sicht bzw. zu einer offenen Aufgabe und soll jedes Neuzeichnen derselben Sicht überstehen; beim Wechsel der Sicht oder zu einer anderen Aufgabe beginnt die neue oben (bestätigt, R00063, R00103).

## ELI14

Die Stelle, an der du gerade liest — sie soll stehen bleiben, auch wenn sich im Hintergrund etwas aktualisiert.

## Bestandteile

- je gescrollter Fläche: waagerechter und senkrechter Wert in Pixeln
- Bezug: dieselbe Sicht in der Hauptsicht `#main` (Board, Aufgabenliste, Berichte, WBS-Sicht) bzw. dieselbe offene Aufgabe im [Aufgabenfenster](D00001-aufgabenfenster.md)
- im Aufgabenfenster breit zwei Flächen ([Hauptbereich](D00002-hauptbereich.md), [Seitenleiste](D00003-seitenleiste.md)), im [schmalen Layout](D00004-schmales-layout.md) eine (Fensterinhalt)

## Beziehungen

- wird durch jedes Neuzeichnen bedroht, vor allem durch [Live-Ereignisse](D00005-live-ereignis.md)
- im Aufgabenfenster je Fläche getrennt: der Hauptbereich behält seinen eigenen Stand, wenn die Seitenleiste gescrollt ist (R00103:94)

## Wechselwirkungen

- [Live-Ereignis](D00005-live-ereignis.md) setzt die Leseposition des Aufgabenfensters heute auf 0 (R00103:15)
- Blättern zu einer anderen Aufgabe setzt die Leseposition bewusst auf Anfang (R00103:98)

## Vorkommen in Anforderungen

- [R00063](../../Anforderungen/R00063-behebung-scrollposition-beim-kontextmenue.md) — als „Scrollposition“ in `#main` (Zeilen 15, 33, 55), „Leseposition“ (Zeile 72)
- [R00103](../../Anforderungen/R00103-behebung-aufgabenfenster-springt-bei-live-aenderungen.md) — Leseposition im Aufgabenfenster (F0022, Zeilen 91–100)

## Notizen / Quellen

- Definition nach R00063:33, 55 (gilt nur in derselben Sicht, wandert beim Wechsel nicht mit) und R00103:19, 98 — bestätigt; PO-Entscheidung `AI-Team/po-entscheidungen.md:64` (andere Aufgabe beginnt oben).
- Code (beobachtet, Stand bb8ede3): heute `rollpositionen()` / `rollpositionenSetzen()` mit fester Selektorliste nur für `#main` (`web/app.js:467–479`), Kommentar „hält die Leseposition“ (`web/app.js:441`). Soll nach [ADR-0007](../ADRs/0007-sichtzustand-uebersteht-das-neuzeichnen.md): ein allgemeiner Sicherer des Sichtzustands; der neue Bezeichner steht noch nicht fest.
- Oberfläche (de): kein sichtbarer Text.
- Erlaubte Synonyme: „Scrollposition“ (R00063, Titel) und „Scrollstand“ (R00103, für den gemessenen Pixelwert). Leitform in Anforderungen und Glossar ist „Leseposition“, weil sie sagt, wozu sie dient.
- Abgrenzung: „Sichtzustand“ (ADR-0007) ist weiter — Leseposition plus Fokus, Wert und Cursor eines Eingabefeldes. Cursor und Textauswahl sind keine Leseposition.
- Nicht verwenden: „Rollposition“ außerhalb des Codes — nur Bezeichner, kein Fachwort.
