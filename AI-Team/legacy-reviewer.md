# legacy-reviewer — Projektschicht

Ergänzt die Rolle `legacy-reviewer` der Factory für dieses Projekt. Gilt für Projektgebundenes (Umgebung, Stack, Pfade, Befehle, Stil); Grenzen und Kernregeln der Rolle überschreibt sie nie (`gemeinsam/regeln.md`, „Vorrang“).

## Projektregeln

- Altbestände: Kopien der Board-Ordner unter `~/Projekte/Kanban-Boards/` (JoinPuyaApp-Kanbanboard, localchatA-Kanbanboard, kanbanD-Demo) — nur Kopien im Scratchpad öffnen, nie die Originale schreiben.
- Agenten-Clients: `werkzeuge/kanband.py` der Factory und die API-Nutzung von `~/.claude/commands/testen/kanband.py` müssen weiter funktionieren.
- Wegwerf-Instanz zum Proben: `target/release/kanbanD <scratchpad>/<rolle>-<karte>/ordner --port <frei> --kein-browser` (Skill `freier-port`), am Ende beenden; nie die Board-Instanz auf Port 7422.
- Sparbetrieb (`AI-Team/prozess.md`): knapp arbeiten, nur lesen, was der Auftrag nennt.

## Spezialisierungen

Keine aus der Factory.

## Quellen

IDs aus `AI-Team/quellen.md`, die diese Rolle besonders braucht.

- siehe `AI-Team/quellen.md`, Spalte „Für Rollen“

## Gelerntes

- noch keine
