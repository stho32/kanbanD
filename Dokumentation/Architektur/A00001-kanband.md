---
id: A00001
name: kanbanD
code: kanbanD
ebene: System
eltern:
repo: kanbanD
status: Aktiv
herkunft: code
quellen:
  - Cargo.toml
  - src/
  - web/
verwandt: []
domaene: []
---

# kanbanD

## Verantwortung

kanbanD macht einen Git-versionierten Ordner aus Markdown-Dateien zu einem Kanban-Board, das Menschen (Browser) wie KI-Agenten (HTTP-API) gemeinsam bedienen.

## Schnittstellen

- eingehend: Browser (Oberfläche, SSE-Ereignisse) und Agenten (HTTP/JSON-API, Handelnder über Header `X-KanbanD-Wer`), beide über einen Port ab 7420
- eingehend: Änderungen von außen am Ordner (Editor, `git`), vom Wächter erkannt
- ausgehend: Dateisystem des Board-Ordners; `git` als Kindprozess, ein Commit je Aktion
- ausgehend: WBS-Dateien fremder Arbeits-Repositories (lesend, beobachtet)

## Abhaengigkeiten

- [A00002 kanbanD-Programm](A00002-kanband-programm.md) — einziger Container
- extern: `git` im Pfad, Dateisystem, Browser

## Entscheidungen

## Offene Fragen

## Notizen / Quellen

- Ein Repository, ein System: deshalb ist die Wurzel `System`, nicht `Loesung` (`Loesung` verlangt mehr als ein Repo).
- Angelegt 2026-10-31 als knappes Startmodell (Karte #7); verfeinert wird bei späteren Karten.
- Vorlagen unter `~/.claude/app-architectures/`: keine offensichtlich passend (`rust-cli` deckt den eingebetteten Webserver nicht ab).
