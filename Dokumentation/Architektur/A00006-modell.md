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
- [ADR-0004: Schlüsselsuche unter der Sperre](../ADRs/0004-schluesselsuche-unter-der-sperre.md)
- [ADR-0006: Einstellung verboten als dritte Abweisung](../ADRs/0006-einstellung-verboten-als-dritte-abweisung.md) — Soll: `Einstellung { Grenze, Eigentuemer }` liegt im Modell, `Fehler::EinstellungVerboten` verweist darauf
- [ADR-0009: Kosten als ganze Cent, eine Prüfung für Datei und API](../ADRs/0009-kosten-als-ganze-cent-eine-pruefung-fuer-datei-und-api.md) — Soll (#18): Typ `Kosten { waehrung, basis, wert: Betrag | Spanne | Positionen }` in ganzen Cent mit einem prüfenden Konstruktor für Format und API
- [ADR-0017: Rückgängig als Gegenaktion mit gemerktem Inhalt](../ADRs/0017-rueckgaengig-als-gegenaktion-mit-gemerktem-inhalt.md) — gebaut (#12, R00112, Zweig `karte/12`, `9d246a3`): `Board::aufnehmen(nummer, spalte, index)` legt an `index` ein, gekappt auf die Länge der Spalte, ohne `index` unten

## Offene Fragen

## Notizen / Quellen

- `src/modell/mod.rs` Re-Exporte und `slug`; `board.rs` Spalten, Grenzen (`limits`), Bewegen; `einstellungen.rs` Personen.
- nachgeführt 2026-11-01 nach R00096 (Architektur-Review #2)
- Soll nach ADR-0009 (Karte #18): Inhaltsregeln von `cost` (min ≤ max, ≥ 0, ≤ 1.000.000 $, `currency` `[A-Z]{3}`, `basis`/`text` nicht leer, 1–100 Positionen) an einer Stelle im Modell; Vorbild `Fremdschluessel::pruefen` (R00098).
- nachgeführt 2026-11-06 nach #18 (ADR-0009)

- Ist nach ADR-0017 (Karte #12, R00112, Zweig `karte/12`, `9d246a3`): `Board::aufnehmen(nummer, spalte, index: Option<usize>)` (`src/modell/board.rs:307`) fügt an `index.min(len)` ein, ohne Angabe unten. `SchonAufDemBoard` und `SpalteUnbekannt` sind unverändert. Test `aufnehmen_an_einer_stelle_gekappt_auf_die_laenge` (`board.rs:913`).
- nachgeführt 2026-11-08 nach dem Bau von #12 (R00112, ADR-0017)
- nachgeführt 2026-11-11 nach R00120: `Eigentuemer`/`Entnahmesperre`/`ColumnOwnerEintrag` und `Board::entnahme_erlaubt` (`src/modell/board.rs:529`), `Board.eigentuemer_roh` (`board.rs:310`) ergänzt; `entnahme_erlaubt` über alle Spalten und fail-safe (PO Z. 187).
