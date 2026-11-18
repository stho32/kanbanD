---
id: D00010
name: Klassenvorrat
status: Aktiv
sprache: de
verwandt: [D00011, D00012, D00001]
gebiet: Klassen
synonyme: [Vorrat]
code: ["Board::klassenvorrat"]
---

# Klassenvorrat

## Definition

Der Klassenvorrat eines Boards ist die geordnete Liste der Klassen, die für die Karten dieses Boards gelten: seine eigenen Klassen, wenn das Board welche führt, sonst die [Vorgabe des Ordners](D00011-vorgabe-des-ordners.md). Er ist immer genau eines von beiden, nie eine Mischung (bestätigt, R00195:13, ADR-0031 Regel 2).

## ELI14

Die Liste der Farben mit Namen, aus der man auf einem bestimmten Board für eine Karte wählen kann.

## Bestandteile

- je Klasse: Schlüssel, Bezeichnung, Farbe (Palettenname oder `#rrggbb`)
- die Reihenfolge der Klassen; sie ist die Dringlichkeit in den Berichten
- Herkunft, genau eine von zweien: die **eigenen Klassen** des Boards (der eigene Satz, `classes:` in der Board-Datei) oder die Vorgabe des Ordners
- ein eigener Satz darf leer sein (`classes: {}`): das Board hat dann ausdrücklich keine Klassen, und die Vorgabe gilt für es nicht

## Beziehungen

- jedes Board hat genau einen Klassenvorrat
- beliebig viele Boards ohne eigene Klassen teilen sich die [Vorgabe des Ordners](D00011-vorgabe-des-ordners.md) als Klassenvorrat
- eine Klasse, deren Schlüssel der Klassenvorrat nicht kennt, ist auf diesem Board eine [fremde Klasse](D00012-fremde-klasse.md)
- eine Aufgabe trägt höchstens einen Schlüssel; liegt sie auf mehreren Boards, trifft dieser eine Schlüssel auf mehrere Klassenvorräte
- die Klassenwahl im [Aufgabenfenster](D00001-aufgabenfenster.md) bietet die Klassen des Klassenvorrats an

## Wechselwirkungen

- der Klassenvorrat bestimmt Farbe und Bezeichnung jeder Karte des Boards, die Legende, die Klassenwahl (Aufgabenfenster, „Neue Aufgabe“, Kartenmenü, Menü mehrerer Karten, Schnelleingabe `class:`) und die Reihenfolge in den Berichten des Boards (R00195 AK 5)
- er entscheidet, welcher Schlüssel beim Setzen einer Klasse gültig ist: einer aus dem Klassenvorrat eines Boards, auf dem die Aufgabe liegt; liegt sie auf keinem, einer aus der Vorgabe des Ordners (R00195 AK 4, ADR-0031 Regel 6)
- außerhalb eines Boards (Aufgabenliste) gilt der Klassenvorrat des ersten Boards der Boardliste, auf dem die Aufgabe liegt; liegt sie auf keinem, die Vorgabe des Ordners (R00195 AK 7, ADR-0031 Regel 3)
- derselbe Schlüssel kann in zwei Klassenvorräten verschieden heißen und gefärbt sein (ADR-0031, Konsequenzen)

## Vorkommen in Anforderungen

- [R00195](../../Anforderungen/R00195-klassen-und-farben-je-board-mit-vorgabe-des-ordners.md) — führt den Begriff ein (Zeile 13); Gültigkeit beim Setzen (AK 4), Anzeige je Board (AK 5–7), Einrichten (AK 8–10)

## Notizen / Quellen

- Definition nach R00195:13 und ADR-0031 Regel 2 (`Dokumentation/ADRs/0031-klassen-je-board-mit-vorgabe-des-ordners.md`) — bestätigt; Entscheidungen des product-owner in `AI-Team/po-entscheidungen.md`, Zeilen vom 2026-11-18 zu #200.
- Code: `Board::klassenvorrat(&Einstellungen)` und eine Vorrat-Funktion in `web/` sind in ADR-0031 Regel 2 und R00195 („Tests“, „Implementierungshinweise“) festgelegt, aber noch nicht gebaut (Stand 49489753). Dazu geplant: `Board.klassen: Option<Vec<Klasse>>`, Frontmatter `classes` der Board-Datei, `klassen` in `GET /api/boards/{slug}`, `PUT /api/boards/{slug}/klassen`. Der Name der Funktion in `web/` ist offen.
- Oberfläche (de): der Begriff selbst steht nicht auf dem Schirm; sichtbar ist der Abschnitt „Klassen dieses Boards“ mit der Wahl „Vorgabe des Ordners“ oder „eigene Klassen“ (R00195 AK 8).
- Erlaubte Kurzform „Vorrat“, wenn das Board im Satz genannt ist (ADR-0031 Regeln 3, 5, 6, 8).
- Der eine Zweig heißt auf dem Schirm und in der Vision „eigene Klassen“; in R00195 und ADR-0031 steht dafür auch „eigener Satz“, „Satz“ und „Klassensatz“. Gemeint ist dasselbe; neu geschrieben „eigene Klassen“, „eigener Satz“ nur als Kurzform im technischen Text.
- Nicht zu verwechseln mit der [Vorgabe des Ordners](D00011-vorgabe-des-ordners.md): sie ist nur einer der zwei möglichen Inhalte des Klassenvorrats.
- Nicht verwenden: „Klassen des Boards“ für den Klassenvorrat — ein Board ohne eigene Klassen hat einen Klassenvorrat, aber keine eigenen Klassen.
- Nicht verwenden: „benannter Klassensatz“ — ein im Ordner benannter, von Boards geteilter Satz ist ADR-0031 Option D und verworfen.
- Offen: ein Eintrag „Klasse“ fehlt im Domänenwissen (Schlüssel, Bezeichnung, Farbe; in der Karte #200 auch „Aufgabenklasse“ genannt).
