---
id: X00002
name: Logging
art: Aspekt
geltung: Makro
befund: Uneinheitlich
hausantwort: "eigenes Modul src/protokoll.rs nach ADR-0001 N1 (Option C, ohne neue Abhängigkeit)"
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
  - src/dienst/mod.rs
  - src/ablage.rs
  - Dokumentation/ADRs/0001-logging-konzept.md
---

# Logging

## Hausantwort

[ADR-0001: Logging-Konzept](../../ADRs/0001-logging-konzept.md), akzeptiert in der Fassung von Nachtrag N1 (2026-11-23, Karte #239): eigenes Modul `src/protokoll.rs` ohne neue Abhängigkeit, ein `Protokoll` je Instanz (nie global), Ziel stderr und `~/.local/state/kanbanD/<ordnername>/kanbanD.log` (`--log-ordner`), täglich rotiert, 14 Tage; Stufen DEBUG · INFO · WARN · ERROR · EXCEPTION (`--log`, `KANBAND_LOG`); ein Ereignis = eine Zeile mit benannten Feldern (N1.3). Abgewiesene Anfragen schreibt genau eine Middleware (N1.4), defekte Dateien das Defektregister im `Ordner` (N1.5), lange Schreibsperren der `Sperrhalter` (N1.6).

## Systemantwort

Heute nur `eprintln!` an acht Stellen und ein `println!` (Startmeldung, `src/main.rs:51`): Startfehler (`src/main.rs:8`, `:15`, `:45`, `:62`), Browser nicht geöffnet (`src/start/browser.rs:17`), Wächter nicht aktiv (`src/web/mod.rs:61`, `:157`) und, seit #208, die Warnung „gelöscht, aber `transkripte/<nr>/` ließ sich nicht entfernen“ beim endgültigen Löschen (`src/dienst/archiv.rs:71`, ADR-0036 Regel 9). Keine Stufen, keine Datei, kein Eintrag je Commit, abgewiesene Züge (403/409) unprotokolliert.

## Abweichungen

Bis Karte #239 gebaut ist, weicht der ganze Bestand von der Hausantwort ab:

- A00002 · `src/main.rs:15`, `:45`, `:51`, `:62` — Start- und Endmeldungen über `eprintln!`/`println!` statt Protokoll (N1.2 Regel 5)
- A00002 · `src/start/browser.rs:17` — `eprintln!`
- A00003 · `src/web/mod.rs:57` — Wächter nicht aktiv über `eprintln!`
- A00003 · `src/web/mod.rs:142` — `impl IntoResponse for Fehler` ohne Zeile; abgewiesene Anfragen (4xx, 503) unprotokolliert (N1.4)
- A00004 · `src/dienst/archiv.rs:71` — `eprintln!`
- A00004 · `src/dienst/mod.rs:259` — `gesperrt()` misst keine Haltezeit (N1.6)
- A00002 · `src/ablage.rs:86–129` — defekte Dateien ohne Zeile (N1.5)

## Offene Fragen

- Messwerte der Lesegrenze zusätzlich über die API (z. B. `GET /api/zustand`)? Nach N1.6 Regel 3 vorerst nur im Log.

## Notizen / Quellen

- nachgeführt 2026-11-23 nach #239 (Architektur): ADR-0001 akzeptiert mit Nachtrag N1; `befund` Uneinheitlich mit den Fundstellen oben (Soll), Systemantwort unverändert (Ist).
- Erkennen von Abweichungen nach Annahme: `grep -rn "eprintln!\|println!" src` außerhalb von `src/main.rs` ist ein Befund.
- nachgeführt 2026-11-21 nach #208 (R00216, ADR-0036, `c37b74cc`): achte `eprintln!`-Stelle in `src/dienst/archiv.rs:71`, damit erstmals eine Ausgabe in den Diensten ([A00004](../A00004-dienste.md)); Zeilen der Web-Schicht auf den Stand von main gebracht (`grep -rn "eprintln!\|println!" src`).
