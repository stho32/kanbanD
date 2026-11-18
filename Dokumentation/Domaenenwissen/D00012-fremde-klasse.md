---
id: D00012
name: Fremde Klasse
status: Aktiv
sprache: de
verwandt: [D00010, D00011, D00001]
gebiet: Klassen
synonyme: [unbekannte Klasse]
---

# Fremde Klasse

## Definition

Eine fremde Klasse ist die Klasse einer Karte, deren Schlüssel der [Klassenvorrat](D00010-klassenvorrat.md) des betrachteten Boards nicht kennt. Fremd ist sie immer nur dort: dieselbe Karte kann auf einem Board ihre Klasse mit Farbe und Bezeichnung zeigen und auf einem anderen eine fremde (bestätigt, R00195:13, ADR-0031 Regel 5 mit Nachtrag N1).

## ELI14

Eine Karte hat eine Farbe mitgebracht, die es auf diesem Board nicht gibt — das Board zeigt dann nur ihr Wort, ohne Farbe.

## Bestandteile

- der Schlüssel an der Aufgabe (`class: <schlüssel>`), unverändert
- Anzeige: der Schlüssel als Text ohne Klassenfarbe, auf der Karte selbst und im zugänglichen Namen der Karte
- in der Klassenwahl ein eigener, gewählter Eintrag ohne Farbe; in den Berichten hinter den Klassen des Klassenvorrats; kein eigener Eintrag der Legende

## Beziehungen

- besteht zwischen einer Aufgabe und einem [Klassenvorrat](D00010-klassenvorrat.md), nicht an der Aufgabe allein
- nicht dasselbe wie „ohne Klasse“: eine Karte ohne Klasse trägt keinen Schlüssel und zeigt keinen Text
- sichtbar auf der Karte und in der Klassenwahl des [Aufgabenfensters](D00001-aufgabenfenster.md)

## Wechselwirkungen

- entsteht, ohne dass die Aufgabe sich ändert: wenn ein Board eigene Klassen bekommt, eine belegte Klasse gestrichen wird, ein Board zur [Vorgabe des Ordners](D00011-vorgabe-des-ordners.md) zurückkehrt oder eine Karte auf ein zweites Board mit anderem Klassenvorrat gelegt wird (R00195 AK 6, 9, 10)
- vergeht ebenso: wird eine Klasse mit demselben Schlüssel im Klassenvorrat wieder angelegt, hat die Karte ihre Farbe zurück (R00195 AK 9)
- wird nie entfernt oder umgeschrieben; kein Vorgang am Board ändert die Aufgabe (R00195:13, :61)
- neu setzen lässt sich ein Schlüssel nur, wenn ein Klassenvorrat der Aufgabe ihn kennt (sonst 400 mit Board und Schlüssel); ein unverändert mitgeschickter fremder Schlüssel wird angenommen (R00195 AK 4, ADR-0031 Regel 6)
- vor dem Streichen einer belegten Klasse und vor der Rückkehr zur Vorgabe nennt eine Hinweiszeile im Klassen-Editor die Zahl der Karten, deren Klasse dadurch fremd wird (R00195 AK 9, 10)

## Vorkommen in Anforderungen

- [R00195](../../Anforderungen/R00195-klassen-und-farben-je-board-mit-vorgabe-des-ordners.md) — Definition (Zeile 13), in Kauf genommen (Zeile 17), AK 4, AK 6, AK 9, AK 10

## Notizen / Quellen

- Definition nach R00195:13 und ADR-0031 Regel 5, Nachtrag N1 Nr. 1 — bestätigt; Entscheidung „nur anzeigen, auch auf der Karte erkennbar“ des product-owner, `AI-Team/po-entscheidungen.md` Z. 319 (2026-11-18).
- Code (beobachtet, Stand 49489753): kein eigener Bezeichner. Der Bestand sagt „unbekannte Klasse“ für eine Klasse, die `kanbanD.md` nicht kennt (`web/ansicht.js:616`, `web/berichte.js:1076`, `:1125–1130`, `web/kartenname.js:6`); ADR-0031 Regel 5 behandelt die fremde Klasse „wie die heute schon mögliche unbekannte Klasse“.
- „Unbekannte Klasse“ ist damit das Wort des Altbestands für dieselbe Sache und als Synonym geführt; neu geschrieben heißt sie „fremde Klasse“, auch wenn sie durch Streichen aus der Vorgabe entstanden ist (R00195 AK 9: „ist #2 fremd“).
- Oberfläche (de): das Wort „fremd“ steht nicht auf dem Schirm; sichtbar ist der Schlüssel als Text. Den Wortlaut der Hinweiszeile legt die Zeichnung fest (R00195:60).
- Nicht zu verwechseln mit „ohne Klasse“ (kein Schlüssel) und nicht mit einem ungültigen Schlüssel beim Setzen (wird mit 400 abgewiesen und nie gespeichert).
- Nicht verwenden: „ungültige Klasse“, „verwaiste Klasse“ für die fremde Klasse — sie ist ein gültiger, erhaltener Wert der Aufgabe.
- Offen: R00195:13 bindet „fremd“ an das „betrachtete Board“. Für die Aufgabenliste und für Aufgaben auf keinem Board (Klassenvorrat nach ADR-0031 Regel 3) ist nicht gesagt, ob eine dort unbekannte Klasse ebenfalls „fremd“ heißt und wie sie aussieht.
