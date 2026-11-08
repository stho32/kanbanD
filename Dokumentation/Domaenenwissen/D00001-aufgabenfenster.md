---
id: D00001
name: Aufgabenfenster
status: Aktiv
sprache: de
verwandt: [D00002, D00003, D00004, D00005, D00006, D00007, D00008]
gebiet: Oberfläche/Aufgabenfenster
synonyme: [Fenster]
code: [vFenster, "#over", .mod, .mod-body, S.ui.offen]
---

# Aufgabenfenster

## Definition

Das Aufgabenfenster ist der Dialog über der aktuellen Sicht, in dem genau eine Aufgabe gelesen und bearbeitet wird: Kopf, [Hauptbereich](D00002-hauptbereich.md) (Titel, Beschreibung, Abschnitte) und [Seitenleiste](D00003-seitenleiste.md) (Felder). Es öffnet sich mit einem Klick auf eine Karte; jede Änderung darin geht sofort in die Aufgabendatei und wird committet (bestätigt, R00011).

## ELI14

Das Fenster, das aufgeht, wenn man auf eine Karte klickt, und in dem man alles über diese eine Aufgabe sieht und ändern kann.

## Bestandteile

- Kopf: Nummer, Klasse, Pfad, Umschalter Inhalt/Datei, Position „n / m“ mit ↑ ↓, „In VS Code öffnen“, ✕ (R00011)
- [Hauptbereich](D00002-hauptbereich.md): Titel, Beschreibung, Abschnitte (Kommentare, Teilaufgaben, Anhänge, Durchläufe)
- [Seitenleiste](D00003-seitenleiste.md): Spalte, Klasse, Zuständige, Labels, Fälligkeit, laufende Timer, Zeiten
- Fuß: Speicherhinweis („gespeichert hh:mm“) und Fehlermeldung
- Hinweis-Anker zwischen Körper und Fuß, in dem der [Hinweis](D00007-hinweis.md) steht, solange das Fenster oberster Dialog ist (R00112 FA 18)
- in der Ansicht „Datei“ nur der Dateitext, ohne Seitenleiste

## Beziehungen

- zeigt genau eine Aufgabe; Blättern mit ↑ ↓ wechselt zur nächsten Aufgabe der sichtbaren Reihe
- besteht aus genau einem [Hauptbereich](D00002-hauptbereich.md) und genau einer [Seitenleiste](D00003-seitenleiste.md)
- im [schmalen Layout](D00004-schmales-layout.md) füllt es den Bildschirm, die Seitenleiste steht unter dem Hauptbereich
- wird bei jedem [Live-Ereignis](D00005-live-ereignis.md) mit geändertem Stand neu gezeichnet
- hält je offener Aufgabe eine eigene [Leseposition](D00006-leseposition.md)
- zeigt höchstens einen [Hinweis](D00007-hinweis.md), als Überlagerung 8 px über dem Fuß

## Wechselwirkungen

- [Live-Ereignis](D00005-live-ereignis.md) zeichnet das Aufgabenfenster neu (heute mit Verlust von Leseposition und Fokus, R00103)
- [Leseposition](D00006-leseposition.md) wird im Aufgabenfenster nur gehalten, solange dieselbe Aufgabe offen bleibt
- [Schmales Layout](D00004-schmales-layout.md) ordnet Hauptbereich und Seitenleiste untereinander an
- [Rückgängig](D00008-rueckgaengig.md) gilt auch bei offenem Fenster; seine Ablehnung steht im Fuß („nicht rückgängig: …“, R00112 FA 4)

## Vorkommen in Anforderungen

- [R00011](../../Anforderungen/R00011-aufgabe-ansehen-und-bearbeiten.md) — führt das Aufgabenfenster ein (Zeilen 11, 25)
- [R00077](../../Anforderungen/R00077-responsive-fuer-tablet-und-handy.md) — füllt auf Tablet und Handy den Bildschirm (Zeilen 13, 17, 33)
- [R00063](../../Anforderungen/R00063-behebung-scrollposition-beim-kontextmenue.md) — ausdrücklich nicht geprüft (Zeile 72)
- [R00103](../../Anforderungen/R00103-behebung-aufgabenfenster-springt-bei-live-aenderungen.md) — Leseposition und Eingabe im Aufgabenfenster bei Live-Ereignissen
- [R00112](../../Anforderungen/R00112-entfernen-rueckgaengig-und-sichtbare-entfernen-knoepfe.md) — Hinweis mit „rückgängig“ im Fenster, Ablehnung im Fuß (FA 4, 18; AK 7)

## Notizen / Quellen

- Definition nach R00011, Beschreibung (Zeile 11) und Funktionale Anforderungen (Zeile 25) — bestätigt.
- Code (beobachtet, Stand bb8ede3): gezeichnet von `vFenster()` in `web/ansicht.js:200–223` in den Bereich `#over` (`web/app.js:451`); Dialog `.mod` mit `role="dialog"` und `aria-label="Aufgabe #<nr>"` (`web/ansicht.js:222`); offen ist die Aufgabe `S.ui.offen`.
- Oberfläche (de): der Begriff selbst steht nicht auf dem Schirm; die Bildschirmleser-Beschriftung lautet „Aufgabe #<nr>“.
- Planung: der WBS-Dialog heißt `D0003 Aufgabe` (`Dokumentation/Planung/kanbanD.md:20`), Artboard `Dokumentation/Wireframes/D0003.dc.html`.
- Erlaubte Kurzform „Fenster“, wo der Zusammenhang eindeutig ist (R00011:25, R00103 durchgehend).
- Nicht zu verwechseln mit dem Browserfenster (Fenstergröße 1400 × 700 in R00103) und mit dem Dialog „Neue Aufgabe“ (`vNeu()`, `web/ansicht.js:168–189`), der dieselben CSS-Klassen `.mod-main`/`.mod-side` benutzt, aber keine bestehende Aufgabe zeigt.
- Nicht verwenden: „Detailansicht“, „Kartenfenster“, „Aufgabendialog“ — führen eine zweite Form ein. „Detailansicht“ kommt einmal vor, in einer Bildunterschrift des Wireframes `Dokumentation/Wireframes/kanbanD Board.html:229` („Volle Information im Tooltip oder in der Detailansicht“), gemeint ist dort das Aufgabenfenster (geduldet, Entwurf); die anderen beiden nirgends (`grep`, 2026-11-05).
