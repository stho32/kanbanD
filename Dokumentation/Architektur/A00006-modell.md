---
id: A00006
name: Modell
code: modell
ebene: Komponente
eltern: A00002
repo: kanbanD
status: Aktiv
herkunft: code
quellen:
  - src/modell/
verwandt: []
domaene: []
blackbox: Startmodell bewusst knapp; verfeinert wird, sobald eine Karte den Baustein ändert.
---

# Modell

## Verantwortung

Das Modell hält die Begriffe von kanbanD als Daten mit ihren fachlichen Regeln, ohne Dateien oder HTTP.

## Schnittstellen

- eingehend: Typen `Aufgabe`, `Board`, `Spalte`, `Einstellungen`, `Person` (mit Art human/agent), Operationen wie `Board::bewegen`
- eingehend (R00096, Zählen der WIP-Grenze): `Board::belegung(archiviert)` → `Belegung` (je Spalte eine `Spaltenbelegung` mit Name, Grenze und zählenden Nummern, archivierte ausgenommen), `Belegung::grenzverletzungen(vorher)` → `Grenzverletzungen` (Liste von `Grenzverletzung { spalte, grenze, vorher, nachher }`, Spalten von links nach rechts; Umsortieren ist kein Zugang); rein, ohne Dateien, re-exportiert in `src/modell/mod.rs`, definiert in `board.rs`
- eingehend (R00097/R00120, Eigentümer): `Spalte.eigentuemer: Option<Eigentuemer>` (`human`/`agent`) und `Spalte.eigentuemer_unbekannt: Option<String>` (unbekannter Rohwert), dazu `Board.eigentuemer_roh: Vec<ColumnOwnerEintrag>` für verwaiste/ungültige `column-owner`-Einträge; `Board::entnahme_erlaubt(art, nummer)` → `Result<(), Entnahmesperre>` sperrt einen Agenten aus einer Menschen-Spalte, über **alle** Spalten einer Nummer, oder fail-safe, wenn ein `human` meinender, ungebundener Eintrag das ganze Board sperrt (PO Z. 187); `Eigentuemer` (wem die Spalte gehört) ist von `Art` (wer handelt) bewusst getrennt
- ausgehend: keine

## Abhaengigkeiten

- keine internen

## Entscheidungen

- [ADR-0002: Zugregeln gemeinsam vor der Aktion](../ADRs/0002-zugregeln-gemeinsam-vor-der-aktion.md)
- [ADR-0004: Schlüsselsuche unter der Sperre](../ADRs/0004-schluesselsuche-unter-der-sperre.md) — Nachtrag N1 (#44, Akzeptiert): die Suche sieht auch defekte Aufgabendateien — Soll: `Schluesseltreffer::suchen`, `doppelte_schluessel` und der Filter `?key=` bleiben Funktionen über lesbare Aufgaben; die strenge Prüfung `Fremdschluessel::pruefen` gilt weiter für Datei und API
- [ADR-0006: Einstellung verboten als dritte Abweisung](../ADRs/0006-einstellung-verboten-als-dritte-abweisung.md) — Soll: `Einstellung { Grenze, Eigentuemer }` liegt im Modell, `Fehler::EinstellungVerboten` verweist darauf
- [ADR-0009: Kosten als ganze Cent, eine Prüfung für Datei und API](../ADRs/0009-kosten-als-ganze-cent-eine-pruefung-fuer-datei-und-api.md) — Soll (#18): Typ `Kosten { waehrung, basis, wert: Betrag | Spanne | Positionen }` in ganzen Cent mit einem prüfenden Konstruktor für Format und API
- [ADR-0017: Rückgängig als Gegenaktion mit gemerktem Inhalt](../ADRs/0017-rueckgaengig-als-gegenaktion-mit-gemerktem-inhalt.md) — gebaut (#12, R00112, Zweig `karte/12`, `9d246a3`): `Board::aufnehmen(nummer, spalte, index)` legt an `index` ein, gekappt auf die Länge der Spalte, ohne `index` unten
- [ADR-0022: Board umbenennen, archivieren, löschen](../ADRs/0022-board-umbenennen-archivieren-loeschen.md) — gebaut (#35, R00128, `a318c3b`): `Board` bekommt `archiviert: Option<String>`; der Slug bleibt die Identität (Dateiname, URL, Cache-Schlüssel), nur der Titel ändert sich; `Board::abnehmen` nimmt eine Zeile aus allen Spalten heraus
- [ADR-0023: Geschätzte Zeit je Karte — ganze Minuten in der Datei, Anzeige `h:mm` erst beim Zeichnen; eine Prüfung für Datei und API, jeder Fehler 400](../ADRs/0023-geschaetzte-zeit-als-ganze-minuten-eine-pruefung-fuer-datei-und-api.md) — gebaut (Karte #37, R00129, `20b8bfa`): `Aufgabe.geschaetzte_minuten: Option<u32>` (`#[serde(rename = "estimate")]`, `src/modell/aufgabe.rs:411–412`), `null`/fehlend heißt „keine Schätzung“; die eine Prüfung `geschaetzte_minuten_pruefen` samt `GESCHAETZT_MELDUNG` (`:362`, `:366`) re-exportiert in `src/modell/mod.rs`, für Format und API gleich; gültig 1–100.000 Minuten
- [ADR-0021: Karten-Verlauf aus der Git-Geschichte gerechnet — ableiten statt speichern](../ADRs/0021-karten-verlauf-aus-der-git-geschichte.md) — gebaut (#119, R00124, `56ec980`): `Spalte.datums_trenner: Option<bool>` (`src/modell/board.rs:32`, `None` = Schlüssel `column-dates` fehlt — der **wirksame Standard** (Abschlussspalte an) entscheidet in der Anzeige, nicht im Modell) und `SpaltenAenderung.datums_trenner: Option<Option<bool>>` (`:468`, `true`/`false` setzt, `null` entfernt den Schlüssel, fehlend behält); `Board::spalten_setzen` wertet es aus (`:547`), Test `datums_trenner_setzen_behalten_entfernen` (`:980`). Der Karten-Verlauf selbst ist **kein Modellbegriff** — er wird aus Git gerechnet (ADR-0021), nicht als Feld gehalten
- [ADR-0031: Klassen je Board — eigener Satz in der Board-Datei, sonst die Vorgabe des Ordners](../ADRs/0031-klassen-je-board-mit-vorgabe-des-ordners.md) (Vorgeschlagen, Karte #200) — Soll: `Board.klassen: Option<Vec<Klasse>>` und `Board::klassenvorrat(&Einstellungen)` als einzige Auflösung; `Aufgabe.klasse` bleibt ein Schlüssel (Regeln 1, 2, 5)
- [ADR-0034: kanbanD ohne WBS — Register mit Repository, Phasen werden Spalten](../ADRs/0034-kanband-ohne-wbs-register-mit-repository-phasen-werden-spalten.md) (Akzeptiert, #224–#228) — Soll: `Anwendung { kuerzel, name, repository }`; `Wirkung`, `Phasenangaben`, `Spalte.phase`, `Spalte.pruefungen` entfallen

## Offene Fragen

## Notizen / Quellen

- `src/modell/mod.rs` Re-Exporte und `slug`; `board.rs` Spalten, Grenzen (`limits`), Bewegen; `einstellungen.rs` Personen.
- nachgeführt 2026-11-01 nach R00096 (Architektur-Review #2)
- Soll nach ADR-0009 (Karte #18): Inhaltsregeln von `cost` (min ≤ max, ≥ 0, ≤ 1.000.000 $, `currency` `[A-Z]{3}`, `basis`/`text` nicht leer, 1–100 Positionen) an einer Stelle im Modell; Vorbild `Fremdschluessel::pruefen` (R00098).
- nachgeführt 2026-11-06 nach #18 (ADR-0009)

- Ist nach ADR-0017 (Karte #12, R00112, Zweig `karte/12`, `9d246a3`): `Board::aufnehmen(nummer, spalte, index: Option<usize>)` (`src/modell/board.rs:307`) fügt an `index.min(len)` ein, ohne Angabe unten. `SchonAufDemBoard` und `SpalteUnbekannt` sind unverändert. Test `aufnehmen_an_einer_stelle_gekappt_auf_die_laenge` (`board.rs:913`).
- nachgeführt 2026-11-08 nach dem Bau von #12 (R00112, ADR-0017)
- nachgeführt 2026-11-11 nach R00120: `Eigentuemer`/`Entnahmesperre`/`ColumnOwnerEintrag` und `Board::entnahme_erlaubt` (`src/modell/board.rs:529`), `Board.eigentuemer_roh` (`board.rs:310`) ergänzt; `entnahme_erlaubt` über alle Spalten und fail-safe (PO Z. 187).
- nachgeführt 2026-11-11 nach R00128 (#35): `Board.archiviert: Option<String>` (Frontmatter `archived`, im JSON `archiviert: <JJJJ-MM-TT> | null`); `BoardVerwalten { titel: Option<String>, archiviert: Option<bool> }` (Rumpf von `PATCH …/boards/{slug}`, `None` = nicht ändern) in `src/dienst/board_verwalten.rs`; board-weite Eigentümer-Prüfung `board_entnahme_pruefen(art, board)` (`src/dienst/zugregeln.rs`) für Archivieren und Löschen.
- nachgeführt 2026-11-11 nach dem Bau von #37 (R00129, ADR-0023): `Aufgabe.geschaetzte_minuten: Option<u32>` (`#[serde(rename = "estimate")]`, `src/modell/aufgabe.rs:411–412`, `null`/fehlend = keine Schätzung); `GESCHAETZTE_MINUTEN_MAX` (`:359`), `GESCHAETZT_MELDUNG` (`:362`) und `geschaetzte_minuten_pruefen` (`:366`) für Datei und API gleich; `Aufgabenaenderung.estimate: Option<Option<serde_json::Value>>` roh (`:477`), `Aufgabe::aendern` (`:544`) wertet ihn aus — jeder Fehler 400.
- nachgeführt 2026-11-12 nach R00124 (ADR-0021): `Spalte.datums_trenner: Option<bool>` (`src/modell/board.rs:32`, `None` = Schlüssel fehlt, Standard entscheidet die Anzeige) und `SpaltenAenderung.datums_trenner: Option<Option<bool>>` (`:468`, setzen/entfernen/behalten); `Board::spalten_setzen` (`:547`), Test `datums_trenner_setzen_behalten_entfernen` (`:980`).
- Der neutrale Begriff **„Wer“** (O1, R00123): der **Handelnde an einem Vorgang** — das Personenkürzel einer kanbanD-Person (`<kürzel>@kanbanD`) oder der **Git-Name** eines kanbanD-fremden Autors. Er steht im Schreibweg (`X-KanbanD-Wer`), im Commit-Autor (`git::Autor::wer()`), im Karten-Verlauf (R00123) und in der Spalte „Wer“ der Durchläufe- und Verlaufstabelle; die Anzeige führt Kürzel und Name zusammen (`vVerlaufWer`, `web/ansicht.js:322`). Die Rückabbildung `%ae` → Kürzel ist die Regel, der Git-Name der Rückfall.
