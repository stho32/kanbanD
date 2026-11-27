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
  - examples/
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
  - src/wbs.rs
  - src/wbs_datei.rs
  - src/lizenzen.rs
  - examples/lizenzen.rs
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
- [A00010 Verlauf](A00010-verlauf.md)
- [A00011 Arbeits-Repository (lesend)](A00011-arbeitsrepo.md)
- Crates: axum, tokio, notify, serde/serde_yaml, utoipa, chrono

## Entscheidungen

- [ADR-0001: Logging-Konzept](../ADRs/0001-logging-konzept.md) (Akzeptiert mit Nachtrag N1, 2026-11-23)

## Offene Fragen

## Notizen / Quellen

- `ausgenommen`: Start (`src/start/`), Ablage (`src/ablage.rs`, Lesen/Schreiben im Ordner), Fehlerarten und die Fachmodule Berichte, Herkunft, Phasen, Prüfungen, Uhr, WBS sind im Startmodell bewusst noch keinem Kind zugeordnet; sie werden Bausteine, sobald eine Karte sie ändert.
- nachgeführt 2026-11-27 nach #250 (ADR-0045): `src/lizenzen.rs` (Erzeuger der Lizenzhinweise aus dem aufgelösten Abhängigkeitsgraph) und `examples/lizenzen.rs` (Beispiel-Einstieg) sind `ausgenommen` — dieselbe Form wie die einfileigen `src/`-Module darüber; `examples/` ist als `quellen`-Pfad aufgenommen. Der Lauf steht hinter dem Feature `lizenzen` (`Cargo.toml:16–24`, `src/lib.rs:9–10`). Die ausgelieferte `web/LIZENZEN.md` selbst ist eine `web/`-Datei und liegt damit unter [A00009 Oberfläche](A00009-oberflaeche.md).
- nachgeführt 2026-11-12 nach R00123/R00124 (ADR-0021): `src/verlauf.rs` ist kein `ausgenommen`-Eintrag mehr, sondern der neue Baustein [A00010 Verlauf](A00010-verlauf.md) — der Karten-Verlauf (R00123) ändert ihn erheblich (neue Einträge `Kartenart`, `KartenEintrag`, `Kartenverlauf`), damit greift die Regel „Bausteine, sobald eine Karte sie ändert“.
- Die Oberfläche `web/` ist per `include_bytes!` eingebettet (`src/web/statisch.rs`): eine Änderung an `web/` wird erst nach neuem Build sichtbar.
- nachgeführt 2026-11-19 nach #207 (ADR-0032 N2): `src/git/arbeitsrepo.rs` ist der Baustein [A00011 Arbeits-Repository (lesend)](A00011-arbeitsrepo.md), verfeinert aus A00007.
