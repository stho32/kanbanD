---
id: X00002
name: Logging
art: Aspekt
geltung: Makro
befund: Ungeklaert
hausantwort: ""
betrifft:
  - A00002
  - A00003
herkunft: code
quellen:
  - src/main.rs
  - src/web/mod.rs
  - src/start/browser.rs
---

# Logging

## Hausantwort

Keine. Soll-Konzept des Betreibers in `AI-Team/umgebung.md` (Zeile „Logging“), zur Entscheidung als [ADR-0001: Logging-Konzept](../../ADRs/0001-logging-konzept.md) (`Vorgeschlagen`).

## Systemantwort

Heute nur `eprintln!`/`println!` an sieben Stellen: Startfehler (`src/main.rs`), Browser nicht geöffnet (`src/start/browser.rs`), Wächter nicht aktiv (`src/web/mod.rs:54`, `:133`). Keine Stufen, keine Datei, kein Eintrag je Commit, abgewiesene Züge (403/409) unprotokolliert.

## Abweichungen

## Offene Fragen

- Wird ADR-0001 angenommen (Crate-Wahl, Ablage außerhalb des Board-Ordners)? Bis dahin ist jede neue Ausgabe `eprintln!`.

## Notizen / Quellen

- Erkennen von Abweichungen nach Annahme: `grep -rn "eprintln!\|println!" src` außerhalb von `src/main.rs` ist ein Befund.
