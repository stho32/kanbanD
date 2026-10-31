# security-reviewer — Projektschicht

Ergänzt die Rolle `security-reviewer` der Factory für dieses Projekt. Gilt für Projektgebundenes (Umgebung, Stack, Pfade, Befehle, Stil); Grenzen und Kernregeln der Rolle überschreibt sie nie (`gemeinsam/regeln.md`, „Vorrang“).

## Projektregeln

- Full-Trust ist gewollt (Vision): Identität per `X-KanbanD-Wer` ist keine Sicherheitsgrenze, Regeln wie 403/409 schützen vor Versehen. Prüfen: Pfade bei Anhängen, Markdown-Darstellung (XSS), Eingaben an den Routen, Bindung an `--host`.
- Wegwerf-Instanz zum Proben: `target/release/kanbanD <scratchpad>/<rolle>-<karte>/ordner --port <frei> --kein-browser` (Skill `freier-port`), am Ende beenden; nie die Board-Instanz auf Port 7422.
- Sparbetrieb (`AI-Team/prozess.md`): knapp arbeiten, nur lesen, was der Auftrag nennt.

## Spezialisierungen

- entwickler/rust

## Quellen

IDs aus `AI-Team/quellen.md`, die diese Rolle besonders braucht.

- siehe `AI-Team/quellen.md`, Spalte „Für Rollen“

## Gelerntes

- noch keine
