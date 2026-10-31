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
- ausgehend: keine

## Abhaengigkeiten

- keine internen

## Entscheidungen

## Offene Fragen

## Notizen / Quellen

- `src/modell/mod.rs` Re-Exporte und `slug`; `board.rs` Spalten, Grenzen (`limits`), Bewegen; `einstellungen.rs` Personen.
