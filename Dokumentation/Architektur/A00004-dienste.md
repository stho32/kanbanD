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
- [ADR-0004: Schlüsselsuche unter der Sperre](../ADRs/0004-schluesselsuche-unter-der-sperre.md) — Nachtrag N1 (#44, Akzeptiert): die Suche sieht auch defekte Aufgabendateien — Soll: `anlegen_gesperrt` behält die Liste der defekten Aufgaben und weist ein Anlegen mit `key` mit 423 ab, wenn eine defekte Datei den angefragten Schlüssel lesbar trägt; `erledigen` bleibt unberührt; Reihenfolge 400 → 423 → 409; heute wird die Liste verworfen (`src/dienst/aufgabe_anlegen.rs:132`)
- [ADR-0005: Zusammengesetzte Aktionen in einem Commit](../ADRs/0005-zusammengesetzte-aktionen-in-einem-commit.md) — Nachtrag N1 (#43): eine gescheiterte Aktion hinterlässt nichts (Index zurück, neu angelegte Datei entfernt, `Fehler::Intern` mit Pfaden), die Commit-Nachricht ist abgeleiteter Text (Steuerzeichen ersetzt, Länge begrenzt) — die Fachdaten werden dafür nie abgewiesen; Nachtrag N2 schärft „nichts": die Rücknahme stellt den Stand von HEAD her, ein Pfad mit uncommitteten Änderungen von vor der Aktion verliert sie, und die Pfadprüfung gilt auch in `committen` — Nachtrag N3 (#45, „Wiederöffnen mit `board` ist ein Umzug“) ist **zurückgezogen** (Betreiber 2026-11-15, nie gebaut); es gilt die dort festgehaltene Regel: „Archiviert“ ist eine Eigenschaft der Karte und gilt für alle Boards, Archivieren und Zurückholen ändern keine Board-Zeile (`archiv.rs`), Wiederöffnen über `key` bringt die Karte auf alle früheren Boards zurück und legt sie mit `board` zusätzlich oben auf das genannte (`aufgabe_anlegen.rs::schreiben`, R00098)
- [ADR-0009: Kosten als ganze Cent, eine Prüfung für Datei und API](../ADRs/0009-kosten-als-ganze-cent-eine-pruefung-fuer-datei-und-api.md) — Soll (#18): `aufgabe_aendern` prüft `cost` über den Modell-Konstruktor, Verstoß → `Fehler::Ungueltig` (400)
- [ADR-0017: Rückgängig als Gegenaktion mit gemerktem Inhalt](../ADRs/0017-rueckgaengig-als-gegenaktion-mit-gemerktem-inhalt.md) — gebaut (#12, R00112, Zweig `karte/12`, `9d246a3`): `auf_board_legen` legt an `index` ein (fehlt er, unten), Teilaufgabe anlegen an `position` mit `erledigt` — je ein Commit, Prüfungen unverändert (Grenze, Eigentümer, 409 schon liegend)
- [ADR-0022: Board umbenennen, archivieren, löschen](../ADRs/0022-board-umbenennen-archivieren-loeschen.md) — gebaut (#35, R00128, `4549a12`): `Kanban::board_aendern` (Titel und/oder Archiv, ohne Änderung kein Commit) und `Kanban::board_loeschen` (Board-Datei samt Cache) in `src/dienst/board_verwalten.rs`, je ein `aktion()`; die Eigentümer-Sperre prüft board-weit bei Archivieren und Löschen (403 Agent aus Menschen-Spalte / 423 defektes Board)
- [ADR-0023: Geschätzte Zeit je Karte — ganze Minuten in der Datei, Anzeige `h:mm` erst beim Zeichnen; eine Prüfung für Datei und API, jeder Fehler 400](../ADRs/0023-geschaetzte-zeit-als-ganze-minuten-eine-pruefung-fuer-datei-und-api.md) — gebaut (Karte #37, R00129, `20b8bfa`): `Aufgabe::aendern` (`src/modell/aufgabe.rs:544`) wertet `estimate` über `geschaetzte_minuten_pruefen` aus; die Kanban-Türen `Kanban::aufgabe_aendern` und `Kanban::mehrere_aendern` (`src/dienst/aufgabe_aendern.rs:18`, `:27`) reichen es durch — ein Wert ersetzt, `null` entfernt, fehlend lässt unverändert; Commit „#n geändert: Geschätzte Zeit“, ohne Änderung keiner; Verstoß → `Fehler::Ungueltig` (400)
- [ADR-0024: Aufgabe endgültig löschen](../ADRs/0024-aufgabe-endgueltig-loeschen-datei-entfernen-ein-commit.md) — gebaut (#36, R00141, `2dea478`): `Kanban::endgueltig_loeschen` (`src/dienst/archiv.rs`) entfernt Aufgabendatei, ihre Zeilen aus **allen** Board-Dateien und den Anhangsordner in **einem** `aktion()`-Aufruf (`Schritt::{Schreiben, Entfernen}`); davor `archivieren_pruefen` (403/423), eine defekte Aufgabendatei lässt sich über den Pfad entfernen
- [ADR-0021: Karten-Verlauf aus der Git-Geschichte gerechnet — ableiten statt speichern](../ADRs/0021-karten-verlauf-aus-der-git-geschichte.md) — gebaut (#119, R00123, `902a97b`): `Kanban::karten_verlauf(nummer)` (`src/dienst/verlauf.rs:19`) ist ein **rein lesender** Anwendungsfall ohne `aktion()`/Commit — er löst den Pfad der Aufgabendatei auf (vorhandene Datei oder jüngster gelöschter Pfad mit `git::pfad_zu_nummer`, `:24`), liest ihre Stände samt `archived` und Autor aus der Git-Geschichte (`git::staende`, `:31`), nimmt die Löschung (`git::loeschung`, `:38`) und führt sie mit den Ständen jeder Board-Datei (`:40–49`) über `verlauf::kartenverlauf` zusammen; unbekannte Nummer → 404
- [ADR-0031: Klassen je Board — eigener Satz in der Board-Datei, sonst die Vorgabe des Ordners](../ADRs/0031-klassen-je-board-mit-vorgabe-des-ordners.md) (Vorgeschlagen, Karte #200) — Soll: Schreibweg `PUT /api/boards/{slug}/klassen` unter `gesperrt()` → `klassen_pruefen` → `aktion()`; das Setzen einer Klasse prüft gegen den Vorrat der Boards, auf denen die Aufgabe liegt (Regel 6)
- [ADR-0034: kanbanD ohne WBS — Register mit Repository, Phasen werden Spalten](../ADRs/0034-kanband-ohne-wbs-register-mit-repository-phasen-werden-spalten.md) (Vorgeschlagen, #224) — Soll: Dienste `wbs`, `wirkungen`, `phasen`, `herkunft` entfallen; `anwendungen` und `einstellungen` führen `repository`; `bewegen` prüft keine Spaltenprüfung mehr

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
- nachgeführt 2026-11-11 nach dem Bau von #124 (R00142): `Kanban::aufgabe_duplizieren` (`src/dienst/aufgabe_anlegen.rs:99`) ist ein Anwendungsfall ohne eigenen Schreibweg — Quelle unter `gesperrt()` lesen (404/423), dann **Delegation an `anlegen_gesperrt`** (`:116`, Parameter `aus: Some(nr)` ändert nur die Commit-Nachricht „#<neu> dupliziert (aus #<nr>) …“), also Nummernvergabe, Board-Zeile, WIP-Grenze und **ein** Commit vom Anlegeweg geerbt; `angaben_der_quelle` (`:237`) ist die **eine Definitionsstelle** der Kopie (Titel `„<Titel> (Kopie)“` daneben): Klasse, Zuständige, Labels, Fälligkeit, Herkunft, Beschreibung, Teilaufgaben als Texte ohne Haken; `key: None` — der Schlüssel wird nie gesetzt, die `schon_da`-Prüfung entfällt für die Kopie; Verlauf, Zeiten, Kommentare, Durchläufe, Anhänge, Archivstand, Reservierung, `cost`, Signale, WBS-Wirkungen, Phasen und Berichts-Zählung bleiben bei der Quelle. Eigentümer-Regel sperrt nicht (Hineinlegen, R00097), ein Mensch wird ohne Warnung durchgelassen. Kein ADR (R00142).
- nachgeführt 2026-11-12 nach R00123/R00124 (ADR-0021): `Kanban::karten_verlauf` (`src/dienst/verlauf.rs:19`) ist rein lesend, kein `aktion()`, kein Commit; die Spalten-Einstellung `datums_trenner` (R00124) reist unverändert durch `Kanban::spalten_setzen` (`src/dienst/spalten.rs:12`) und `Board::spalten_setzen` — die Wertelogik liegt im Modell ([A00006](A00006-modell.md)).
