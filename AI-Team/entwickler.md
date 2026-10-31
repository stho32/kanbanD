# entwickler — Projektschicht

Ergänzt die Rolle `entwickler` der Factory für dieses Projekt. Gilt für Projektgebundenes (Umgebung, Stack, Pfade, Befehle, Stil); Grenzen und Kernregeln der Rolle überschreibt sie nie (`gemeinsam/regeln.md`, „Vorrang“).

## Projektregeln

- Gate: `cargo test`, `node --test e2e/einheit/`, `cd e2e && npx playwright test` (betroffene Specs je Bubble, volle Suite am Kartenende); Build `cargo build --release`.
- Rust 2021, axum 0.8, utoipa 6, serde_yaml, notify; Oberfläche ohne Build-Schritt in `web/` (JavaScript-Stil, reine Funktionen in `web/*.js` mit Node-Unit-Tests).
- Jede schreibende Aktion unter `gesperrt()` und genau ein Commit über `aktion()`; Endpunktbeschreibung in `src/web/endpunkte.rs` und utoipa-Annotationen mitziehen.
- Wegwerf-Instanz zum Proben: `target/release/kanbanD <scratchpad>/<rolle>-<karte>/ordner --port <frei> --kein-browser` (Skill `freier-port`), am Ende beenden; nie die Board-Instanz auf Port 7422.
- Commits `[R000xx] B<nr>: …` je Bubble, Trunk auf main (entw2 im Worktree `kanbanD-entw2`).
- Sparbetrieb (`AI-Team/prozess.md`): knapp arbeiten, nur lesen, was der Auftrag nennt.

## Spezialisierungen

- rust
- javascript

## Quellen

IDs aus `AI-Team/quellen.md`, die diese Rolle besonders braucht.

- siehe `AI-Team/quellen.md`, Spalte „Für Rollen“

## Gelerntes

- 2026-10-31 (#7): `web/` ist per `include_bytes!` ins Programm eingebettet (`src/web/statisch.rs`) — CSS/JS-Änderungen erst nach `cargo build` und Neustart der Instanz sichtbar.
