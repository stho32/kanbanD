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
  - A00004
herkunft: code
quellen:
  - src/main.rs
  - src/web/mod.rs
  - src/start/browser.rs
  - src/dienst/archiv.rs
---

# Logging

## Hausantwort

Keine. Soll-Konzept des Betreibers in `AI-Team/umgebung.md` (Zeile „Logging“), zur Entscheidung als [ADR-0001: Logging-Konzept](../../ADRs/0001-logging-konzept.md) (`Vorgeschlagen`).

## Systemantwort

Heute nur `eprintln!` an acht Stellen und ein `println!` (Startmeldung, `src/main.rs:51`): Startfehler (`src/main.rs:8`, `:15`, `:45`, `:62`), Browser nicht geöffnet (`src/start/browser.rs:17`), Wächter nicht aktiv (`src/web/mod.rs:61`, `:157`) und, seit #208, die Warnung „gelöscht, aber `transkripte/<nr>/` ließ sich nicht entfernen“ beim endgültigen Löschen (`src/dienst/archiv.rs:71`, ADR-0036 Regel 9). Keine Stufen, keine Datei, kein Eintrag je Commit, abgewiesene Züge (403/409) unprotokolliert.

## Abweichungen

## Offene Fragen

- Wird ADR-0001 angenommen (Crate-Wahl, Ablage außerhalb des Board-Ordners)? Bis dahin ist jede neue Ausgabe `eprintln!`.

## Notizen / Quellen

- Erkennen von Abweichungen nach Annahme: `grep -rn "eprintln!\|println!" src` außerhalb von `src/main.rs` ist ein Befund.
- nachgeführt 2026-11-21 nach #208 (R00216, ADR-0036, `c37b74cc`): achte `eprintln!`-Stelle in `src/dienst/archiv.rs:71`, damit erstmals eine Ausgabe in den Diensten ([A00004](../A00004-dienste.md)); Zeilen der Web-Schicht auf den Stand von main gebracht (`grep -rn "eprintln!\|println!" src`).
