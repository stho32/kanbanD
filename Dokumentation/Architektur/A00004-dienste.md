---
id: A00004
name: Dienste
code: dienst::Kanban
ebene: Komponente
eltern: A00002
repo: kanbanD
status: Aktiv
herkunft: code
quellen:
  - src/dienst/
verwandt: []
domaene: []
blackbox: Startmodell bewusst knapp; verfeinert wird, sobald eine Karte den Baustein ändert.
---

# Dienste

## Verantwortung

Die Dienste führen jede Aktion als Anwendungsfall auf dem Weg Sperre → Prüfung → `aktion()` aus, sodass jede Aktion genau einen Commit ergibt.

## Schnittstellen

- eingehend: öffentliche Methoden von `Kanban` (z. B. `aufgabe_anlegen`, `bewegen`, `ziehen`), aufgerufen von der [Web-Schicht](A00003-web-schicht.md)
- ausgehend: Lesen über `Ordner` (`src/ablage.rs`), Text über [Format](A00005-format.md), Commit über [Git](A00007-git.md); meldet eigene Pfade an den [Wächter](A00008-waechter.md) (`Eigene`)

## Abhaengigkeiten

- [A00005 Format](A00005-format.md), [A00006 Modell](A00006-modell.md), [A00007 Git](A00007-git.md), [A00008 Wächter](A00008-waechter.md)
- Querschnitt: [X00001 Schreibweg und Regeln an Zügen](Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md)

## Entscheidungen

- [ADR-0002: Zugregeln gemeinsam vor der Aktion](../ADRs/0002-zugregeln-gemeinsam-vor-der-aktion.md)
- [ADR-0004: Schlüsselsuche unter der Sperre](../ADRs/0004-schluesselsuche-unter-der-sperre.md)
- [ADR-0005: Zusammengesetzte Aktionen in einem Commit](../ADRs/0005-zusammengesetzte-aktionen-in-einem-commit.md)
- [ADR-0009: Kosten als ganze Cent, eine Prüfung für Datei und API](../ADRs/0009-kosten-als-ganze-cent-eine-pruefung-fuer-datei-und-api.md) — Soll (#18): `aufgabe_aendern` prüft `cost` über den Modell-Konstruktor, Verstoß → `Fehler::Ungueltig` (400)
- [ADR-0017: Rückgängig als Gegenaktion mit gemerktem Inhalt](../ADRs/0017-rueckgaengig-als-gegenaktion-mit-gemerktem-inhalt.md) — gebaut (#12, R00112, Zweig `karte/12`, `9d246a3`): `auf_board_legen` legt an `index` ein (fehlt er, unten), Teilaufgabe anlegen an `position` mit `erledigt` — je ein Commit, Prüfungen unverändert (Grenze, Eigentümer, 409 schon liegend)
- [ADR-0022: Board umbenennen, archivieren, löschen](../ADRs/0022-board-umbenennen-archivieren-loeschen.md) — gebaut (#35, R00128, `4549a12`): `Kanban::board_aendern` (Titel und/oder Archiv, ohne Änderung kein Commit) und `Kanban::board_loeschen` (Board-Datei samt Cache) in `src/dienst/board_verwalten.rs`, je ein `aktion()`; die Eigentümer-Sperre prüft board-weit bei Archivieren und Löschen (403 Agent aus Menschen-Spalte / 423 defektes Board)
- [ADR-0023: Geschätzte Zeit je Karte — ganze Minuten in der Datei, Anzeige `h:mm` erst beim Zeichnen; eine Prüfung für Datei und API, jeder Fehler 400](../ADRs/0023-geschaetzte-zeit-als-ganze-minuten-eine-pruefung-fuer-datei-und-api.md) — gebaut (Karte #37, R00129, `20b8bfa`): `Aufgabe::aendern` (`src/modell/aufgabe.rs:544`) wertet `estimate` über `geschaetzte_minuten_pruefen` aus; die Kanban-Türen `Kanban::aufgabe_aendern` und `Kanban::mehrere_aendern` (`src/dienst/aufgabe_aendern.rs:18`, `:27`) reichen es durch — ein Wert ersetzt, `null` entfernt, fehlend lässt unverändert; Commit „#n geändert: Geschätzte Zeit“, ohne Änderung keiner; Verstoß → `Fehler::Ungueltig` (400)
- [ADR-0024: Aufgabe endgültig löschen](../ADRs/0024-aufgabe-endgueltig-loeschen-datei-entfernen-ein-commit.md) — gebaut (#36, R00141, `2dea478`): `Kanban::endgueltig_loeschen` (`src/dienst/archiv.rs`) entfernt Aufgabendatei, ihre Zeilen aus **allen** Board-Dateien und den Anhangsordner in **einem** `aktion()`-Aufruf (`Schritt::{Schreiben, Entfernen}`); davor `archivieren_pruefen` (403/423), eine defekte Aufgabendatei lässt sich über den Pfad entfernen

## Offene Fragen

## Notizen / Quellen

- `src/dienst/mod.rs`: `Kanban`, `gesperrt()` (eine `Mutex` je Ordner, eigene Sperren je WBS-Datei), `aktion()` (eine Folge von `Schritt::Schreiben` und `Schritt::Entfernen`; alle Pfade **beider Arten** vor dem ersten Schritt geprüft, als eigen gemerkt, **ein** Commit — R00141, [ADR-0024](../ADRs/0024-aufgabe-endgueltig-loeschen-datei-entfernen-ein-commit.md)). `Kanban::entfernen()` gibt es nicht mehr — Löschen ist ein Entfernen-Schritt desselben `aktion()`.
- Je Anwendungsfall eine Datei (`bewegen.rs`, `reservierung.rs`, `aufgabe_anlegen.rs`, …).
- Daneben gemeinsame Regeldateien, die mehrere Anwendungsfälle aufrufen: `zugregeln.rs` (R00096, [ADR-0002](../ADRs/0002-zugregeln-gemeinsam-vor-der-aktion.md)) mit `zug_pruefen`, `zugregeln`, den Lesehelfern `grenzen_pruefen`/`zurueckholen_pruefen` und den Entnahme-Helfern (`entnahme_pruefen`, `entnahme_und_zug_pruefen`, `entnahme_und_grenzen_pruefen`, `archivieren_pruefen`, R00097/R00120) — aufgerufen von `reservierung.rs`, `bewegen.rs`, `aufgabe_anlegen.rs`, `zuordnung.rs`, `archiv.rs`; Einzelheiten in [X00001](Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md).
- Entnahme-Helfer (R00097/R00120): `entnahme_pruefen(art, board, entnommen)` nennt die erste Sperre als `Fehler::Verboten` (403); `entnahme_und_zug_pruefen` bzw. `Kanban::entnahme_und_grenzen_pruefen` stellen die Entnahmeregel vor die Grenzprüfung; `Kanban::archivieren_pruefen` prüft je Board der Boardliste und liefert einem Agenten 423 `Fehler::Defekt`, sobald eine Board-Datei des Ordners unlesbar ist.
- nachgeführt 2026-11-01 nach R00096 (Architektur-Review #2)
- Soll nach ADR-0009 (Karte #18): `cost` ersetzt den ganzen Abschnitt, `null` entfernt; Commit „#n geändert: Kosten“, ohne Änderung keiner. Der Dienst rechnet keine Summen.
- nachgeführt 2026-11-06 nach #18 (ADR-0009)
- Soll nach ADR-0017 (Karte #12, überholt durch das Ist darunter): Wiederherstellen ist kein eigener Anwendungsfall. Es ist ein gewöhnliches Anlegen, mit den Prüfungen nach ADR-0002 und einem Commit nach ADR-0005. Zeiteintrag (`Zeitnachtrag` mit `beginn`/`ende`/`wer`) und Anhang (`anhang_ablegen`, `freier_name`) reichen schon heute (Probe 2026-11-08).
- nachgeführt 2026-11-08 nach #12 (ADR-0017)

- Ist nach ADR-0017 (Karte #12, R00112, Zweig `karte/12`, `9d246a3`):
  - `auf_board_legen(wer, slug, nummer, spalte, index)` (`src/dienst/zuordnung.rs:10`) reicht `index` an `Board::aufnehmen` weiter. Prüfungen und Commit sind unverändert. Das Auflegen mehrerer Aufgaben ruft `aufnehmen(…, None)`, also unten.
  - `teilaufgabe_anlegen(wer, nr, text, position, erledigt)` (`src/dienst/teilaufgaben.rs:31`) legt an `position` ein; außerhalb oder ohne Angabe ans Ende. `erledigt` setzt den Haken. Ein Commit.
  - Einen eigenen Anwendungsfall „wiederherstellen“ gibt es nicht. Zeiteintrag und Anhang laufen über die bestehenden Wege.
- nachgeführt 2026-11-08 nach dem Bau von #12 (R00112, ADR-0017)
- nachgeführt 2026-11-11 nach R00120 (Härtung Spalten mit Eigentümer): Entnahme-Helfer `entnahme_pruefen`, `entnahme_und_zug_pruefen`, `entnahme_und_grenzen_pruefen`, `archivieren_pruefen` (`src/dienst/zugregeln.rs`); `archivieren_pruefen` fail-safe 423 bei defektem Board (PO Z. 188).
- nachgeführt 2026-11-11 nach dem Bau von #37 (R00129, ADR-0023): `estimate` läuft durch `Aufgabe::aendern` (`src/modell/aufgabe.rs:544`, Prüfung `geschaetzte_minuten_pruefen`) und die Kanban-Türen `Kanban::aufgabe_aendern`/`Kanban::mehrere_aendern` (`src/dienst/aufgabe_aendern.rs:18`, `:27`); Commit „#n geändert: Geschätzte Zeit“, ohne Änderung keiner; der Dienst rechnet nichts mit dem Wert.
