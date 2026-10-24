---
id: R00077
status: Erledigt
datum: 2026-10-21
---

# R00077: Responsive für Tablet und Handy

## Beschreibung

kanbanD ist für den Desktop gebaut; auf Tablet und Handy wird die Seite herausgezoomt (die Kopfzeile ist eine feste Zeile von rund 750 px), das Aufgabenfenster ragt aus dem Bild, Filter und Personenknopf überlappen. Die Oberfläche wird **responsiv** — dieselbe Seite, kein zweiter Modus — in zwei Stufen:

- **Tablet (bis 1024 px)**: die Kopfzeile bricht um — Board, Navigation und Personenknopf oben, Filter und Knöpfe darunter; das Aufgabenfenster und andere Dialoge füllen den Bildschirm.
- **Handy (bis 640 px)**:
  - Kopfzeile in drei Zeilen: Board und Personenknopf (nur Kürzel), darunter die Navigation als waagerecht wischbare Leiste, darunter Filter und „+“;
  - Board: jede Spalte fast bildschirmbreit, Wischen rastet Spalte für Spalte ein; zugeklappte Spalten bleiben schmal;
  - Aufgabenfenster: die Felder stehen unter Titel und Beschreibung statt daneben;
  - Einrichten einspaltig, die Vorschau darunter; breite Tabellen (WBS) scrollen in sich, die Seite nicht.
- **Touch** (grober Zeiger): Knöpfe und Symbole mindestens 32 px Tippfläche. Ziehen per Finger unterstützt der Browser nicht; verschoben wird über das Feld „Spalte“ im Aufgabenfenster.

Auf dem Desktop (ab 1025 px) ändert sich nichts.

Zahlt ein auf: [Vision](R00000-vision.md) — das Board ist überall da, wo die Arbeit ist.

## Geschäftlicher Nutzen

Unterwegs auf dem Handy nachsehen, eine Karte verschieben oder ein Signal quittieren; am Tablet im Gespräch das Board zeigen.

## Akzeptanzkriterien

- [x] Handy (390 × 844): Board, Aufgaben, Berichte, Einrichten und WBS sind ohne waagerechtes Scrollen der Seite lesbar (Seitenbreite = Bildschirmbreite)
- [x] Handy: eine Spalte füllt fast die Breite; Wischen rastet ein; die Navigation erreicht jede Seite
- [x] Handy und Tablet: das Aufgabenfenster füllt den Bildschirm; auf dem Handy stehen die Felder unter dem Text
- [x] Tablet (820 × 1180): Filter und Personenknopf überlappen nicht, die Kopfzeile bricht um
- [x] Touch: Tippflächen der Symbolknöpfe mindestens 32 px
- [x] Desktop (1500 px): Kopfzeile einzeilig wie bisher

## Betroffene Verzeichnisstruktur

`web/kd-app.css`, `web/ansicht.js`; Test `e2e/tests/r00077-responsive.spec.js`.

## Abhängigkeiten
- keine

## Offene Fragen
- keine
