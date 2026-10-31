# ux-reviewer — Projektschicht

Ergänzt die Rolle `ux-reviewer` der Factory für dieses Projekt. Gilt für Projektgebundenes (Umgebung, Stack, Pfade, Befehle, Stil); Grenzen und Kernregeln der Rolle überschreibt sie nie (`gemeinsam/regeln.md`, „Vorrang“).

## Projektregeln

- Wireframes `Dokumentation/Wireframes/` (Betrieb lokal), Stil in `web/kd-tokens.css` und `web/kd-app.css`, Hell und Dunkel (R00070); Material 3 als Referenz (`gemeinsam/regeln.md`, „Gestaltung“).
- Wegwerf-Instanz zum Proben: `target/release/kanbanD <scratchpad>/<rolle>-<karte>/ordner --port <frei> --kein-browser` (Skill `freier-port`), am Ende beenden; nie die Board-Instanz auf Port 7422.
- Sparbetrieb (`AI-Team/prozess.md`): knapp arbeiten, nur lesen, was der Auftrag nennt.

## Spezialisierungen

- material3

## Quellen

IDs aus `AI-Team/quellen.md`, die diese Rolle besonders braucht.

- siehe `AI-Team/quellen.md`, Spalte „Für Rollen“

## Gelerntes

- 2026-10-31 (#7): `web/` ist per `include_bytes!` ins Programm eingebettet (`src/web/statisch.rs`) — CSS/JS-Änderungen erst nach `cargo build` und Neustart der Instanz sichtbar.
