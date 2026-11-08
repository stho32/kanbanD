---
id: D00005
name: Live-Ereignis
status: Aktiv
sprache: de
verwandt: [D00001, D00006, D00008]
gebiet: Live-Aktualisierung
synonyme: [Ereignis]
code: [Ereignis, ereignis, /api/ereignisse]
---

# Live-Ereignis

## Definition

Ein Live-Ereignis ist die Nachricht des Servers an alle offenen Sichten, dass sich im Ordner etwas geändert hat: eine Liste der geänderten Pfade und die Angabe, ob die Änderung von außen kam (`extern`). Änderungen innerhalb von 150 ms werden zu einem Ereignis gebündelt; ausgeliefert wird es als Server-Sent Event über `GET /api/ereignisse` (bestätigt, R00007).

## ELI14

Die Durchsage „hier hat sich gerade etwas geändert“, die jedes offene Browserfenster bekommt, damit es sich sofort selbst aktualisiert.

## Bestandteile

- `pfade`: geänderte Dateien relativ zum Ordner, sortiert, ohne Doppelte
- `extern`: wahr, wenn nicht alle Pfade in den letzten 3 s von kanbanD selbst geschrieben wurden
- `wbs`: Kürzel der Anwendungen, deren WBS sich geändert hat (nur im Code, beobachtet)

## Beziehungen

- entsteht bei jeder Änderung im Ordner, egal ob über Oberfläche, API, Editor oder `git pull` (R00007:11)
- jedes Live-Ereignis mit geändertem Stand zeichnet die Oberfläche neu, auch das [Aufgabenfenster](D00001-aufgabenfenster.md)
- darf die [Leseposition](D00006-leseposition.md) nicht verschieben (R00103)
- entsteht auch bei jedem [Rückgängig](D00008-rueckgaengig.md), denn es schreibt wie jede Aktion einen Commit

## Wechselwirkungen

- [Aufgabenfenster](D00001-aufgabenfenster.md) wird durch jedes Live-Ereignis mit geändertem Stand neu gezeichnet — auch, wenn die Änderung eine andere Aufgabe betrifft (R00103:27)
- [Leseposition](D00006-leseposition.md) wird über das Neuzeichnen nach einem Live-Ereignis gehalten (Soll R00103; heute nur in `#main`)

## Vorkommen in Anforderungen

- [R00007](../../Anforderungen/R00007-live-aktualisierung.md) — führt Ereignisse ein (Zeilen 11, 22–26)
- [R00063](../../Anforderungen/R00063-behebung-scrollposition-beim-kontextmenue.md) — „Live-Ereignisse“ als Grund, die Position im Neuzeichnen zu halten (Zeile 37)
- [R00103](../../Anforderungen/R00103-behebung-aufgabenfenster-springt-bei-live-aenderungen.md) — Begriffe (Zeile 19), Gegeben der Akzeptanzkriterien

## Notizen / Quellen

- Definition nach R00007, Funktionale Anforderungen (Zeilen 21–26) — bestätigt.
- Code (beobachtet, Stand bb8ede3): Struktur `Ereignis { pfade, von_aussen → "extern", wbs }` in `src/waechter.rs:15–22`, Bündelung 150 ms und „eigen gilt 3 s“ in `src/waechter.rs:11–12`; Endpunkt `src/web/endpunkte.rs:33`; im Browser `liveVerbinden()` (`EventSource`, `web/app.js:1776–1780`) und Behandlung in `ereignis()` (`web/app.js:1756–1769`). Architektur: Baustein [A00008 Wächter](../Architektur/A00008-waechter.md).
- Oberfläche (de): der Begriff steht nicht auf dem Schirm; sichtbar ist nur der Verbindungszustand in der Kopfzeile („nicht live“, R00007:26) und die Marke „extern“ an Karten.
- Erlaubte Kurzform „Ereignis“ (R00007, Code). R00103 nennt es in Prosa auch „fremde Änderung“ — gemeint ist dort die Änderung, die das Ereignis auslöst, nicht das Ereignis.
- Abgrenzung: Auch eigene Änderungen (`extern: false`) sind Live-Ereignisse (R00007:31). Die Akzeptanzkriterien von R00103 legen nur für ihre Prüfung fest, dass das Live-Ereignis ein Kommentar des Agenten `bot` über die API ist; das ist ein Testfall, keine engere Definition.
- Nicht zu verwechseln mit den Ereignissen der Aufgabengeschichte (Commits) und mit DOM-Ereignissen (`change`, `mouseover`) im Code.
