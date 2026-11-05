---
id: D00003
name: Seitenleiste
status: Aktiv
sprache: de
verwandt: [D00001, D00002, D00004, D00006]
gebiet: Oberfläche/Aufgabenfenster
code: [.mod-side, vFensterSeite]
---

# Seitenleiste

## Definition

Die Seitenleiste ist der Teil des [Aufgabenfensters](D00001-aufgabenfenster.md), der die Felder der Aufgabe zum Ändern trägt: Spalte, Klasse, Zuständige, Labels, Fälligkeit, dazu laufende Timer und Zeiten. Im breiten Layout steht sie rechts neben dem [Hauptbereich](D00002-hauptbereich.md) und scrollt für sich (bestätigt, R00011).

## ELI14

Die schmale rechte Spalte im Aufgabenfenster, in der man einstellt, wer zuständig ist, wann es fällig ist und in welcher Spalte die Karte steht.

## Bestandteile

- Felder: Spalte (Auswahl, bewegt die Karte), Klasse, Zuständige, Labels, Fälligkeit, „wartet auf“, Herkunft
- Abschnitt „Läuft gerade“ mit den laufenden Timern
- Zeiten der Aufgabe

## Beziehungen

- gehört zu genau einem [Aufgabenfenster](D00001-aufgabenfenster.md)
- steht rechts neben dem [Hauptbereich](D00002-hauptbereich.md); im [schmalen Layout](D00004-schmales-layout.md) darunter
- hat im breiten Layout eine eigene [Leseposition](D00006-leseposition.md), unabhängig von der des Hauptbereichs

## Wechselwirkungen

- Feld „Spalte“ verschiebt die Karte (R00011:25, R00006); auf dem Handy ist es der einzige Weg dazu (R00077:19)
- [Schmales Layout](D00004-schmales-layout.md) stellt die Seitenleiste unter den Hauptbereich

## Vorkommen in Anforderungen

- [R00011](../../Anforderungen/R00011-aufgabe-ansehen-und-bearbeiten.md) — Zeile 25; User Story US-2 „Felder in der Seitenleiste“
- [R00077](../../Anforderungen/R00077-responsive-fuer-tablet-und-handy.md) — „die Felder stehen unter Titel und Beschreibung statt daneben“ (Zeile 17)
- [R00103](../../Anforderungen/R00103-behebung-aufgabenfenster-springt-bei-live-aenderungen.md) — Begriffe (Zeile 19), Akzeptanzkriterium Seitenleiste (Zeile 94)

## Notizen / Quellen

- Definition nach R00011:25 — bestätigt.
- Code (beobachtet, Stand bb8ede3): `<aside class="mod-side">` in `web/ansicht.js:213`, Inhalt aus `vFensterSeite()` (`web/ansicht.js:253`); 350 px breit (`web/kd-app.css:224`), scrollt über `overflow:auto` (`web/kd-app.css:227`), im schmalen Layout `overflow:visible` und mit Linie oben statt links (`web/kd-app.css:714–716`).
- Oberfläche (de): kein sichtbarer Name. Die Feldbeschriftungen darin sind die Schlüssel der Aufgabendatei auf Englisch (`column`, `class`, `assignees`, `labels`, `due`, `origins`), daneben deutsch „wartet auf“ (`web/ansicht.js:213–221`) — beobachtet, nicht geprüft, ob gewollt.
- R00077 nennt die Seitenleiste nicht beim Namen, sondern „die Felder“ (Zeilen 17, 33).
- Nicht zu verwechseln mit dem Seiten-Knopf und -Menü der Kopfzeile (`vSeitenKnopf`, `vSeitenPop`, `web/ansicht.js:80–106`).
