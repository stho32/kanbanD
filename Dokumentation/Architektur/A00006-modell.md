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
- ausgehend: keine

## Abhaengigkeiten

- keine internen

## Entscheidungen

- [ADR-0002: Zugregeln gemeinsam vor der Aktion](../ADRs/0002-zugregeln-gemeinsam-vor-der-aktion.md)
- [ADR-0004: Schlüsselsuche unter der Sperre](../ADRs/0004-schluesselsuche-unter-der-sperre.md)
## Offene Fragen

## Notizen / Quellen

- `src/modell/mod.rs` Re-Exporte und `slug`; `board.rs` Spalten, Grenzen (`limits`), Bewegen; `einstellungen.rs` Personen.

## Ergänzungshistorie

| Datum | Änderung | Grund |
|---|---|---|
| 2026-11-01 | Schnittstellen um `Belegung`, `Spaltenbelegung`, `Grenzverletzung(en)`, `Board::belegung`, `Belegung::grenzverletzungen` ergänzt | Architektur-Review zu R00096 (Karte #2, I0085) |
