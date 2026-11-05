---
id: D00002
name: Hauptbereich
status: Aktiv
sprache: de
verwandt: [D00001, D00003, D00004, D00006]
gebiet: Oberfläche/Aufgabenfenster
synonyme: [Hauptteil]
code: [.mod-main]
---

# Hauptbereich

## Definition

Der Hauptbereich ist der Teil des [Aufgabenfensters](D00001-aufgabenfenster.md), der den Text der Aufgabe trägt: Titel, Beschreibung und die Abschnitte darunter. Im breiten Layout steht er links neben der [Seitenleiste](D00003-seitenleiste.md) und scrollt für sich (bestätigt, R00011, R00103).

## ELI14

Die große linke Hälfte des Aufgabenfensters, in der Titel, Beschreibung und Kommentare stehen.

## Bestandteile

- Titel (Eingabefeld)
- Beschreibung (Markdown, Lesetext oder Eingabefeld)
- Abschnitte: Durchläufe, Anhänge, Kommentare samt Kommentarfeld, Teilaufgaben

## Beziehungen

- gehört zu genau einem [Aufgabenfenster](D00001-aufgabenfenster.md)
- steht neben der [Seitenleiste](D00003-seitenleiste.md); im [schmalen Layout](D00004-schmales-layout.md) über ihr
- hat im breiten Layout eine eigene [Leseposition](D00006-leseposition.md)

## Wechselwirkungen

- [Schmales Layout](D00004-schmales-layout.md) nimmt dem Hauptbereich das eigene Scrollen; dann scrollt der Fensterinhalt als Ganzes
- [Leseposition](D00006-leseposition.md) des Hauptbereichs wird beim Neuzeichnen gesichert (Soll nach R00103)

## Vorkommen in Anforderungen

- [R00011](../../Anforderungen/R00011-aufgabe-ansehen-und-bearbeiten.md) — als „Hauptteil (Titel, Beschreibung)“ (Zeile 25)
- [R00103](../../Anforderungen/R00103-behebung-aufgabenfenster-springt-bei-live-aenderungen.md) — Begriffe (Zeile 19), Akzeptanzkriterien (Zeilen 92–98)

## Notizen / Quellen

- Definition nach R00011:25 („Hauptteil“) und R00103:19, 70 — bestätigt.
- Code (beobachtet, Stand bb8ede3): `<div class="mod-main">` in `web/ansicht.js:211`; scrollt über `overflow:auto` in `web/kd-app.css:226`, im schmalen Layout `overflow:visible` (`web/kd-app.css:714`).
- Oberfläche (de): kein sichtbarer Text; der Begriff ist Sprache von Anforderungen und Tests.
- Erlaubtes Synonym „Hauptteil“ (R00011); Leitform ab R00103 „Hauptbereich“.
- Nicht zu verwechseln mit der Hauptsicht `#main` der Seite (Board, Aufgabenliste, Berichte, WBS-Sicht), die R00063 „Hauptsicht“ bzw. „Hauptfläche“ nennt (R00063:22, 33) und R00103 in den Implementierungshinweisen „Bereich `#main`“ — das ist eine andere Sache.
- Nicht verwenden: „Hauptfläche“, „Hauptsicht“ für den Hauptbereich des Fensters — beide meinen in R00063 `#main`.
- Offen: Der Dialog „Neue Aufgabe“ nutzt ebenfalls `.mod-main` (`web/ansicht.js:176`); ob „Hauptbereich“ auch dort gilt, ist nicht festgelegt.
