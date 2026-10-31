---
id: A00002
name: kanbanD-Programm
code: kanband
ebene: Container
eltern: A00001
repo: kanbanD
status: Aktiv
herkunft: code
quellen:
  - src/
  - web/
  - Cargo.toml
ausgenommen:
  - src/main.rs
  - src/lib.rs
  - src/start/
  - src/ablage.rs
  - src/fehler.rs
  - src/berichte.rs
  - src/herkunft.rs
  - src/phasen.rs
  - src/pruefungen.rs
  - src/uhr.rs
  - src/verlauf.rs
  - src/wbs.rs
  - src/wbs_datei.rs
verwandt: []
domaene: []
---

# kanbanD-Programm

## Verantwortung

Ein Rust-Prozess (axum, tokio) bedient je gestartetem Ordner alle Kanäle — Oberfläche, API, Live-Ereignisse — aus einem Router.

## Schnittstellen

- eingehend: Aufruf `kanbanD [<ordner>] [--port <n>] [--host <adresse>] [--kein-browser]` (`src/start/mod.rs`); HTTP auf dem ersten freien Port ab 7420
- eingehend: SIGTERM, Strg+C — geordnetes Ende (`src/main.rs`)
- ausgehend: Dateien im Ordner, `git`, Ausgaben heute nur über `println!`/`eprintln!`

## Abhaengigkeiten

- [A00003 Web-Schicht](A00003-web-schicht.md)
- [A00004 Dienste](A00004-dienste.md)
- [A00005 Format](A00005-format.md)
- [A00006 Modell](A00006-modell.md)
- [A00007 Git](A00007-git.md)
- [A00008 Wächter](A00008-waechter.md)
- [A00009 Oberfläche](A00009-oberflaeche.md)
- Crates: axum, tokio, notify, serde/serde_yaml, utoipa, chrono

## Entscheidungen

- [ADR-0001: Logging-Konzept](../ADRs/0001-logging-konzept.md) (Vorgeschlagen)

## Offene Fragen

## Notizen / Quellen

- `ausgenommen`: Start (`src/start/`), Ablage (`src/ablage.rs`, Lesen/Schreiben im Ordner), Fehlerarten und die Fachmodule Berichte, Herkunft, Phasen, Prüfungen, Uhr, Verlauf, WBS sind im Startmodell bewusst noch keinem Kind zugeordnet; sie werden Bausteine, sobald eine Karte sie ändert.
- Die Oberfläche `web/` ist per `include_bytes!` eingebettet (`src/web/statisch.rs`): eine Änderung an `web/` wird erst nach neuem Build sichtbar.
