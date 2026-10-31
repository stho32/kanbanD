# code-reviewer — Projektschicht

Ergänzt die Rolle `code-reviewer` der Factory für dieses Projekt. Gilt für Projektgebundenes (Umgebung, Stack, Pfade, Befehle, Stil); Grenzen und Kernregeln der Rolle überschreibt sie nie (`gemeinsam/regeln.md`, „Vorrang“).

## Projektregeln

- Gate: `cargo test`, `node --test e2e/einheit/`, `cd e2e && npx playwright test` (betroffene Specs je Bubble, volle Suite am Kartenende); Build `cargo build --release`.
- Prüfen: ein Commit je Aktion, Sperre um Prüfen-dann-Handeln, API-Beschreibung aktuell.
- Sparbetrieb (`AI-Team/prozess.md`): knapp arbeiten, nur lesen, was der Auftrag nennt.

## Spezialisierungen

- entwickler/rust
- entwickler/javascript

## Quellen

IDs aus `AI-Team/quellen.md`, die diese Rolle besonders braucht.

- siehe `AI-Team/quellen.md`, Spalte „Für Rollen“

## Gelerntes

- noch keine
