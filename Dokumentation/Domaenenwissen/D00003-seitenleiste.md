---
id: D00003
name: Seitenleiste
status: Aktiv
sprache: de
verwandt: [D00001, D00002, D00004, D00006]
gebiet: Oberfläche/Aufgabenfenster
code: [.mod-side, .mod-spalte, "#inhalt-spalte", vInhaltSpalte, vFensterDetails, vFeldZeile]
---

# Seitenleiste

## Definition

Die Seitenleiste ist der Teil des [Aufgabenfensters](D00001-aufgabenfenster.md), der alle Felder der Aufgabe zum Ändern trägt: Spalte, Klasse, Zuständige, Labels, Fällig, dazu laufende Timer und Zeiten. Sie ist heute die Ansicht „Details“ (einspaltig, `.mod-main`) — der frühere feste Platz rechts neben dem [Hauptbereich](D00002-hauptbereich.md) entfällt seit R00127/R00145 (bestätigt, R00011; geändert R00127, R00145).

Im **Inhalt** steht seit R00146 rechts eine **schmale Spalte** (`.mod-spalte`, `#inhalt-spalte`): die vier bearbeitbaren Zeilen Spalte, Klasse, Labels, Fällig und darunter die **nur lesenden** gewählten Zuständigen. Sie ist 200 px breit (Wertfläche 176 px), zeigt die Beschriftung über dem Wert und hat keine sichtbare Überschrift; für Hilfstechnik ist sie die Gruppe „Angaben zur Aufgabe“. Ab **641 px** steht sie rechts neben dem Hauptbereich, bei **640 px und weniger** im Fluss **nach** DURCHLÄUFE. Die Felder tragen dieselben `data-af`-Schlüssel wie ihre Gegenstücke in „Details“ und schreiben über denselben Weg — ein Feldwert, ein Schreibweg, ein Commit je Änderung. Das ist die ausdrückliche, eng gefasste **Ausnahme (#146, Betreiber-Entscheidung 2026-11-12)** von „jeder Abschnitt genau einmal“: alles andere bleibt je Ansicht genau einmal.

## ELI14

Der Ort im Aufgabenfenster, an dem alle Felder einer Aufgabe stehen und geändert werden — heute die Ansicht „Details“, im Inhalt die wichtigsten davon in einer schmalen Spalte rechts, die Zuständigen dort nur zum Lesen.

## Bestandteile

- Felder: Spalte (Auswahl, bewegt die Karte), Klasse, Zuständige, Labels, Fällig, Geschätzt (nur lesend, nur wenn `estimate` gesetzt; R00129), „wartet auf“, Herkunft
- im Inhalt die schmale Spalte: Spalte, Klasse, Labels, Fällig (bearbeitbar, ohne Schnellknöpfe am Datumsfeld) und die gewählten Zuständigen (nur lesend: Initiale `aria-hidden`, Name als Text, kein Chip; Leerfall „niemand“)
- Abschnitt „Läuft gerade“ mit den laufenden Timern
- Zeiten der Aufgabe

## Beziehungen

- gehört zu genau einem [Aufgabenfenster](D00001-aufgabenfenster.md)
- ist eine von mehreren Ansichten des Fensters und wird allein gezeichnet (R00145); die schmale Spalte im Inhalt steht daneben
- die schmale Spalte steht im DOM nach dem Hauptbereich und vor dem Fuß; bei 640 px und weniger im Fluss nach DURCHLÄUFE, ohne `order`

## Wechselwirkungen

- Feld „Spalte“ verschiebt die Karte (R00011:25, R00006); auf dem Handy ist es der einzige Weg dazu (R00077:19)
- [Schmales Layout](D00004-schmales-layout.md) stellt die Feldansichten unter den Hauptbereich
- Nach einer **eigenen** Änderung bleibt der Fokus im geänderten Feld; fällt das Feld weg (defektes Board, 423), steht er auf `#inhalt-spalte`, nie auf `BODY` (ADR-0010 N7)
- Zuständige werden allein in „Details“ geändert (R00039); die Spalte ist eine zweite Ansicht ohne zweiten Schreibweg

## Vorkommen in Anforderungen

- [R00011](../../Anforderungen/R00011-aufgabe-ansehen-und-bearbeiten.md) — Zeile 25; User Story US-2 „Felder in der Seitenleiste“
- [R00077](../../Anforderungen/R00077-responsive-fuer-tablet-und-handy.md) — „die Felder stehen unter Titel und Beschreibung statt daneben“ (Zeile 17)
- [R00103](../../Anforderungen/R00103-behebung-aufgabenfenster-springt-bei-live-aenderungen.md) — Begriffe (Zeile 19), Akzeptanzkriterium Seitenleiste (Zeile 94)
- [R00129](../../Anforderungen/R00129-geschaetzte-zeit-je-karte.md) — Feldzeile „Geschätzt“ (`estimate`, nur wenn gesetzt, nur lesend; Zeile 47)
- [R00146](../../Anforderungen/R00146-inhalt-schmale-rechte-spalte-mit-feldern.md) — schmale rechte Spalte im Inhalt (200 px, 641 px, nur lesende Zuständige, Ausnahme von „jeder Abschnitt genau einmal“)

## Notizen / Quellen

- Definition nach R00011:25 — bestätigt.
- Code (beobachtet, Stand Karte #146): die Feldansicht „Details“ zeichnet `vFensterDetails()` in `.mod-main` (einspaltig, `vFeldZeile` je Zeile); die schmale Spalte zeichnet `vInhaltSpalte()` als `<aside class="mod-spalte" id="inhalt-spalte" role="group" aria-label="Angaben zur Aufgabe">` (`web/ansicht.js`), gestaltet in `web/kd-app.css` (`.mod-body.mit-spalte`, `.mod-spalte`, `.felder.felder-schmal`).
- Oberfläche (de): kein sichtbarer Name. Die Feldbeschriftungen darin sind **deutsch** („Spalte“, „Klasse“, „Labels“, „Fällig“ aus `FELDER`, `web/kultur.js:67`); darunter steht der Schlüssel der Aufgabendatei klein in Mono in `.sl` (`column`, `class`, `labels`, `due`, `web/ansicht.js:185–189`), nie in `.k`. Die volle Feldansicht „Details“ zeigt auch „wartet auf“ deutsch (`web/ansicht.js:372`) — beobachtet.
- R00077 nennt die Seitenleiste nicht beim Namen, sondern „die Felder“ (Zeilen 17, 33).
- Nicht zu verwechseln mit dem Seiten-Knopf und -Menü der Kopfzeile (`vSeitenKnopf`, `vSeitenPop`, `web/ansicht.js:80–106`).
