---
id: R00042
status: Erledigt
datum: 2026-10-18
---

# R00042: Bewegungen eines Boards

## Beschreibung

Die Board-Berichte (Burndown, Durchlaufzeit, Wie lange noch) rechnen im Browser aus einer gemeinsamen Grundlage: je Aufgabe die Folge ihrer Spaltenwechsel auf einem Board, gelesen aus der Git-Geschichte der Board-Datei, dazu die heutigen Spalten. So lassen sich die Berichte filtern, ohne den Server erneut zu fragen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Git als Archiv inklusive Zeiten“, „Bewegen ändert nur die Board-Datei“.

## Geschäftlicher Nutzen

Jede Auswertung des Flusses beruht auf denselben belegten Zeitpunkten.

## Funktionale Anforderungen

- `GET /api/berichte/bewegungen?board={slug}` liefert `spalten` (heutige Reihenfolge), `jetzt` und `aufgaben`: je Nummer `wechsel` als Liste aus `zeitpunkt` und `spalte` (`null` = vom Board genommen), in zeitlicher Folge.
- Stände werden nach Zeitpunkt geordnet; ein nicht committeter aktueller Stand zählt als Stand „jetzt“.
- Unbekanntes Board → 404.

## Akzeptanzkriterien

- [x] Drei Commits (01.10. #1 #2 in „Zu erledigen“, 02.10. #1 erledigt, 04.10. #2 erledigt, #1 vom Board) → #1: Zu erledigen, Erledigt, null; #2: Zu erledigen, Erledigt
- [x] Endpunkt steht in `GET /api/endpunkte`

## Betroffene Verzeichnisstruktur

`src/verlauf.rs`, `src/dienst/verlauf.rs`, `src/web/mod.rs`, `src/web/endpunkte.rs`; Test `tests/verlauf.rs`.

## Abhängigkeiten
- Abhängig von: R00023

## Offene Fragen
