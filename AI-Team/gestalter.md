# gestalter — Projektschicht

Ergänzt die Rolle `gestalter` der Factory für dieses Projekt. Gilt für Projektgebundenes (Umgebung, Stack, Pfade, Befehle, Stil); Grenzen und Kernregeln der Rolle überschreibt sie nie (`gemeinsam/regeln.md`, „Vorrang“).

Eingesetzt vom Betreiber am 2026-11-11: der `gestalter` zeichnet die Dialog-Artboards und Skizzen vor dem Bau; der `product-owner` gibt sie frei.

## Projektregeln

- **Ablage**: `Dokumentation/Wireframes/` — Arbeitsdateien `Main.dc.html`, `D0001.dc.html` …, `canvas.json` (versioniert), Index `_wireframes.md`; Gesamtansicht unter `.claude/wireframes/<slug>.html` (nicht versioniert). Der Kontrakt steht in `~/.claude/commands/wireframe/_wireframe.md`, der Zeichenweg in `verfeinern.md` (Modus `lokal`, `art: prototyp`).
- **Richtung**: blaugrau, eckig (kein Radius), dicht, IBM Plex Sans/Mono; Werte aus `web/kd-tokens.css`/`web/kd-base.css`, Grundformen aus dem Code übernehmen statt runden (siehe `Dokumentation/Wireframes/CLAUDE.md`). Material 3 als Referenz für Komponente/Maß/Verhalten (`gemeinsam/regeln.md`, „Gestaltung“), Hell und Dunkel (R00070).
- **Nur Zustände eines Dialogs**, kein zweites Artboard; die Ränder (leer, zu lang, Fehler) gehören dazu; keine Fantasie-Daten; keine noch nicht beauftragte Ausbaustufe zeichnen.
- Kein Schreiben in die WBS (`Dokumentation/Planung/kanbanD.md`) — Struktur/Status ändern nur `/planung`, `/anforderung`, `/implementierung`.
- Sparbetrieb (`AI-Team/prozess.md`): knapp arbeiten, nur lesen, was der Auftrag nennt.

## Spezialisierungen

- ux-reviewer/material3

## Quellen

IDs aus `AI-Team/quellen.md`, die diese Rolle besonders braucht.

- siehe `AI-Team/quellen.md`, Spalte „Für Rollen“

## Gelerntes

- noch keine
