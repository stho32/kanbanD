---
id: A00004
name: Dienste
code: dienst::Kanban
ebene: Komponente
eltern: A00002
repo: kanbanD
status: Aktiv
herkunft: code
quellen:
  - src/dienst/
verwandt: []
domaene: []
blackbox: Startmodell bewusst knapp; verfeinert wird, sobald eine Karte den Baustein ändert.
---

# Dienste

## Verantwortung

Die Dienste führen jede Aktion als Anwendungsfall auf dem Weg Sperre → Prüfung → `aktion()` aus, sodass jede Aktion genau einen Commit ergibt.

## Schnittstellen

- eingehend: öffentliche Methoden von `Kanban` (z. B. `aufgabe_anlegen`, `bewegen`, `ziehen`), aufgerufen von der [Web-Schicht](A00003-web-schicht.md)
- ausgehend: Lesen über `Ordner` (`src/ablage.rs`), Text über [Format](A00005-format.md), Commit über [Git](A00007-git.md); meldet eigene Pfade an den [Wächter](A00008-waechter.md) (`Eigene`)

## Abhaengigkeiten

- [A00005 Format](A00005-format.md), [A00006 Modell](A00006-modell.md), [A00007 Git](A00007-git.md), [A00008 Wächter](A00008-waechter.md)
- Querschnitt: [X00001 Schreibweg und Regeln an Zügen](Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md)

## Entscheidungen

- [ADR-0002: Zugregeln gemeinsam vor der Aktion](../ADRs/0002-zugregeln-gemeinsam-vor-der-aktion.md)
- [ADR-0004: Schlüsselsuche unter der Sperre](../ADRs/0004-schluesselsuche-unter-der-sperre.md)
- [ADR-0005: Zusammengesetzte Aktionen in einem Commit](../ADRs/0005-zusammengesetzte-aktionen-in-einem-commit.md)
## Offene Fragen

## Notizen / Quellen

- `src/dienst/mod.rs`: `Kanban`, `gesperrt()` (eine `Mutex` je Ordner, eigene Sperren je WBS-Datei), `aktion()` (schreiben, `Eigene` merken, committen).
- Je Anwendungsfall eine Datei (`bewegen.rs`, `reservierung.rs`, `aufgabe_anlegen.rs`, …).
- Daneben gemeinsame Regeldateien, die mehrere Anwendungsfälle aufrufen: `zugregeln.rs` (R00096, [ADR-0002](../ADRs/0002-zugregeln-gemeinsam-vor-der-aktion.md)) mit `zug_pruefen`, `zugregeln` und den Lesehelfern `grenzen_pruefen`/`zurueckholen_pruefen` — aufgerufen von `reservierung.rs`, `bewegen.rs`, `aufgabe_anlegen.rs`, `zuordnung.rs`, `archiv.rs`; Einzelheiten in [X00001](Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md).
- nachgeführt 2026-11-01 nach R00096 (Architektur-Review #2)
