# entwicklertester — Projektschicht

Ergänzt die Rolle `entwicklertester` der Factory für dieses Projekt. Gilt für Projektgebundenes (Umgebung, Stack, Pfade, Befehle, Stil); Grenzen und Kernregeln der Rolle überschreibt sie nie (`gemeinsam/regeln.md`, „Vorrang“).

## Projektregeln

- Testdaten nur in der Wegwerf-Instanz; Agent-Personen über `POST /api/personen` mit `art: agent` anlegen.
- Wegwerf-Instanz zum Proben: `target/release/kanbanD <scratchpad>/<rolle>-<karte>/ordner --port <frei> --kein-browser` (Skill `freier-port`), am Ende beenden; nie die Board-Instanz auf Port 7422.
- Sparbetrieb (`AI-Team/prozess.md`): knapp arbeiten, nur lesen, was der Auftrag nennt.

## Spezialisierungen

Keine aus der Factory.

## Quellen

IDs aus `AI-Team/quellen.md`, die diese Rolle besonders braucht.

- siehe `AI-Team/quellen.md`, Spalte „Für Rollen“

## Gelerntes

- 2026-10-31 (#7): `web/` ist per `include_bytes!` ins Programm eingebettet (`src/web/statisch.rs`) — CSS/JS-Änderungen erst nach `cargo build` und Neustart der Instanz sichtbar.
- 2026-11-01 (#3): Ungültige Werte in der Board-Datei (z. B. `column-owner: Eingang: chef`) weist die API mit 400 ab — als Gegeben per Datei und Commit im Testordner herstellen und im Bericht als „manuell hergestellt“ kennzeichnen.
