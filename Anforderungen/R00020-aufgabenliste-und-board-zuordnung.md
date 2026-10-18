---
id: R00020
status: Neu
datum: 2026-10-18
---

# R00020: Aufgabenliste und Board-Zuordnung

## Beschreibung

Die Seite „Aufgaben“ (Artboard D0004) zeigt alle Aufgaben des Ordners als Tabelle — auch solche auf keinem Board und archivierte — mit der Angabe, auf welchen Boards und in welcher Spalte sie liegen. Von hier lässt sich eine Aufgabe auf ein Board legen, von einem Board nehmen und eine Aufgabe ohne Board anlegen. Die Aufgabe selbst ändert sich dabei nie; nur die Board-Datei.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mehrere Boards über einem Aufgabenbestand“, „Aufgaben sind unabhängige Daten“.

## Geschäftlicher Nutzen

Nichts geht verloren, was auf keinem Board liegt, und dieselbe Aufgabe kann in mehreren Abläufen auftauchen.

## Funktionale Anforderungen

- `GET /api/boards` liefert alle Boards mit Spalten und Aufgabennummern.
- `POST /api/boards/<slug>/aufgaben {nummer, spalte?}` hängt die Aufgabe unten an die Spalte (ohne Angabe: erste Spalte); liegt sie schon dort → 409; unbekannte Aufgabe → 404.
- `DELETE /api/boards/<slug>/aufgaben/<nr>` nimmt sie vom Board; liegt sie nicht dort → 404.
- Nachrichten: `#<nr> auf „<Board>“ gelegt (<Spalte>)` bzw. `#<nr> von „<Board>“ genommen`.
- Die Seite `#/aufgaben` zeigt Nr, Titel, Klasse, Zuständige und „Liegt auf“ (Board · Spalte, je mit ✕ zum Abnehmen); Bereiche „alle“, „ohne Board“, „archiviert“ mit Zahlen; das Filterfeld wirkt auch hier.
- Je Zeile „auf Board legen ▾“: Wahl von Board und Spalte; „+ Aufgabe ohne Board · Enter“ legt an; Klick auf den Titel öffnet das Aufgabenfenster.

## Akzeptanzkriterien

- [ ] #3 auf „Test“ legen → Zeile unter der ersten Spalte von `boards/test.md`, Aufgabendatei unverändert, ein Commit; noch einmal → 409
- [ ] #3 von „Entwicklung“ nehmen → Zeile weg, Aufgabe bleibt; noch einmal → 404
- [ ] Oberfläche: „ohne Board“ zeigt nur Aufgaben auf keinem Board; nach „auf Board legen“ verschwindet die Aufgabe dort und „Liegt auf“ nennt das Board
- [ ] Oberfläche: neue Aufgabe ohne Board erscheint unter „ohne Board“

## Betroffene Verzeichnisstruktur

`src/modell/board.rs`, `src/dienst/zuordnung.rs`, `src/web/mod.rs`, `web/`; Tests im Modell, `tests/zuordnung.rs`, `e2e/tests/r00020-aufgabenliste.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `Board::aufnehmen(nr, spalte) -> Result<String, …>`, `Board::abnehmen(nr) -> bool` (pure)
- `Kanban::auf_board_legen | von_board_nehmen` (Integration)
- `Ordner::boards()` für `GET /api/boards`

## Tests
- Unit: Aufnehmen, Abnehmen
- Integration: API mit Git-Prüfung
- E2E: Bereiche, Legen, Anlegen ohne Board

## Abhängigkeiten
- Abhängig von: R00008, R00017

## Offene Fragen
