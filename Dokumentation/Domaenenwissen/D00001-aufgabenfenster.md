---
id: D00001
name: Aufgabenfenster
status: Aktiv
sprache: de
verwandt: [D00002, D00003, D00004, D00005, D00006, D00007, D00008]
gebiet: Oberfläche/Aufgabenfenster
synonyme: [Fenster]
code: [vFenster, "#over", .mod, .mod-body, .mod-spalte, "#inhalt-spalte", S.ui.offen]
---

# Aufgabenfenster

## Definition

Das Aufgabenfenster ist der Dialog über der aktuellen Sicht, in dem genau eine Aufgabe gelesen und bearbeitet wird: Kopf, [Hauptbereich](D00002-hauptbereich.md) (Titel, Beschreibung, Abschnitte) und — je Ansicht — die Felder der [Seitenleiste](D00003-seitenleiste.md). Im **Inhalt** steht rechts eine **schmale Spalte** mit Spalte, Klasse, Labels und Fällig (bearbeitbar) und den gewählten Zuständigen (nur lesend); „Details“ bleibt die vollständige Feldansicht. Es öffnet sich mit einem Klick auf eine Karte; jede Änderung darin geht sofort in die Aufgabendatei und wird committet (bestätigt, R00011; geändert R00127, R00145, R00146).

## ELI14

Das Fenster, das aufgeht, wenn man auf eine Karte klickt, und in dem man alles über diese eine Aufgabe sieht und ändern kann.

## Bestandteile

- Kopf: Nummer, Klasse, Pfad, Ansichts-Auslöser (nennt die Ansicht), „In VS Code öffnen“ (↗), Aktionsmenü (⋮), ✕ (R00011; R00144/R00145) — *aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#144/#145): Reiter-Umschalter, Position „n / m“ mit ↑ ↓, Archiv-Knopf und der beschriftete Lösch-Auslöser entfallen; „Archivieren“/„Zurückholen“ und „Endgültig löschen“ stehen im ⋮-Menü, die Ansichten im Ansichtsmenü.*
- [Hauptbereich](D00002-hauptbereich.md): Titel, Beschreibung, Abschnitte (Kommentare, Teilaufgaben, Anhänge, Durchläufe)
- [Seitenleiste](D00003-seitenleiste.md) „Details“: Spalte, Klasse, Zuständige, Labels, Fällig, Geschätzt (nur lesend, nur wenn `estimate` gesetzt), laufende Timer, Zeiten
- schmale Spalte im **Inhalt** (R00146, `#inhalt-spalte`): Spalte, Klasse, Labels, Fällig (dieselben `data-af`-Schlüssel, ohne Schnellknöpfe) und die gewählten Zuständigen (nur lesend, Leerfall „niemand“)
- Fuß: Speicherhinweis („gespeichert hh:mm“) und Fehlermeldung
- Hinweis-Anker zwischen Körper und Fuß, in dem der [Hinweis](D00007-hinweis.md) steht, solange das Fenster oberster Dialog ist (R00112 FA 18)
- in der Ansicht „Datei“ nur der Dateitext, ohne Seitenleiste

## Beziehungen

- zeigt genau eine Aufgabe; Blättern mit ↑ ↓ wechselt zur nächsten Aufgabe der sichtbaren Reihe — *aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#144): das Blättern ist gestrichen; eine andere Aufgabe erscheint nur durch Öffnen (R00144 FA 9/10).*
- zeigt genau eine Ansicht (R00145): „Inhalt“ besteht aus dem [Hauptbereich](D00002-hauptbereich.md) und der schmalen Spalte, „Details“ aus der Feldansicht der [Seitenleiste](D00003-seitenleiste.md)
- **Ausnahme (#146, Betreiber-Entscheidung 2026-11-12):** Spalte, Klasse, Labels, Fällig und die gewählten Zuständigen stehen in „Inhalt“ **und** in „Details“ — ein Feldwert, ein Schreibweg, ein Commit je Änderung; alles andere bleibt je Ansicht genau einmal
- im [schmalen Layout](D00004-schmales-layout.md) füllt es den Bildschirm; die schmale Spalte steht im Fluss nach DURCHLÄUFE, die Feldansicht „Details“ unter dem Hauptbereich
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
- [R00129](../../Anforderungen/R00129-geschaetzte-zeit-je-karte.md) — Feldzeile „Geschätzt“ (`estimate`, nur wenn gesetzt, nur lesend; R00129:47)
- [R00146](../../Anforderungen/R00146-inhalt-schmale-rechte-spalte-mit-feldern.md) — schmale rechte Spalte im Inhalt: 200 px, Umbruch 641 px, nur lesende Zuständige, Ausnahme von „jeder Abschnitt genau einmal“

## Notizen / Quellen

- Definition nach R00011, Beschreibung (Zeile 11) und Funktionale Anforderungen (Zeile 25) — bestätigt.
- Code (beobachtet, Stand bb8ede3): gezeichnet von `vFenster()` in `web/ansicht.js:200–223` in den Bereich `#over` (`web/app.js:451`); Dialog `.mod` mit `role="dialog"` und `aria-label="Aufgabe #<nr>"` (`web/ansicht.js:222`); offen ist die Aufgabe `S.ui.offen`.
- Oberfläche (de): der Begriff selbst steht nicht auf dem Schirm; die Bildschirmleser-Beschriftung lautet „Aufgabe #<nr>“.
- Planung: der WBS-Dialog heißt `D0003 Aufgabe` (`Dokumentation/Planung/kanbanD.md:20`), Artboard `Dokumentation/Wireframes/D0003.dc.html`.
- Erlaubte Kurzform „Fenster“, wo der Zusammenhang eindeutig ist (R00011:25, R00103 durchgehend).
- Die schmale Spalte im Inhalt (R00146) ist die einzige Stelle, an der ein Abschnitt in zwei Ansichten vorkommt; sie ist im Domänenwissen [Seitenleiste](D00003-seitenleiste.md) beschrieben (200 px, 641 px, DOM-Reihenfolge, Fokusfälle, Leerfall „niemand“).
- Nicht zu verwechseln mit dem Browserfenster (Fenstergröße 1400 × 700 in R00103) und mit dem Dialog „Neue Aufgabe“ (`vNeu()`, `web/ansicht.js:168–189`), der dieselben CSS-Klassen `.mod-main`/`.mod-side` benutzt, aber keine bestehende Aufgabe zeigt.
- Nicht verwenden: „Detailansicht“, „Kartenfenster“, „Aufgabendialog“ — führen eine zweite Form ein. „Detailansicht“ kommt einmal vor, in einer Bildunterschrift des Wireframes `Dokumentation/Wireframes/kanbanD Board.html:229` („Volle Information im Tooltip oder in der Detailansicht“), gemeint ist dort das Aufgabenfenster (geduldet, Entwurf); die anderen beiden nirgends (`grep`, 2026-11-05).
