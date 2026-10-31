---
id: X00001
name: Schreibweg und Regeln an Zügen
art: Aspekt
geltung: Makro
befund: Uneinheitlich
hausantwort: "Kanban-Methode unter gesperrt() → Prüfung → aktion() (src/dienst/mod.rs)"
betrifft:
  - A00004
  - A00007
  - A00008
  - A00006
  - A00003
herkunft: code
quellen:
  - src/dienst/mod.rs
  - src/dienst/bewegen.rs
  - src/dienst/reservierung.rs
  - src/dienst/aufgabe_anlegen.rs
  - src/dienst/anhaenge.rs
  - src/dienst/fieber.rs
---

# Schreibweg und Regeln an Zügen

## Hausantwort

Jede schreibende Aktion ist eine Methode von `Kanban` in [A00004 Dienste](../A00004-dienste.md) und läuft in drei Schritten:

1. **Sperre** — `let _sperre = self.gesperrt();` (eine `Mutex` je Ordner; WBS-Dateien fremder Repos haben eigene Sperren in `wbs_sperren`).
2. **Prüfung** — Stand frisch aus dem Ordner lesen, fachliche Regel am [Modell](../A00006-modell.md) anwenden, bei Verstoß `Fehler::{Ungueltig, Konflikt, NichtGefunden}` (→ 400/409/404) zurückgeben, **bevor** etwas geschrieben ist.
3. **`aktion(autor, nachricht, dateien)`** — Dateien schreiben, Pfade als eigen merken ([A00008 Wächter](../A00008-waechter.md)), genau ein Commit über [A00007 Git](../A00007-git.md).

Nach dem Commit kommen nur noch Warnungen (z. B. Spaltenprüfungen `column-checks` in `bewegen.rs::warnungen`), nie Abweisungen.

## Systemantwort

Regeln an Zügen nach [ADR-0002](../../ADRs/0002-zugregeln-gemeinsam-vor-der-aktion.md): Zählen und Eigentümer als reine Funktionen am `Board` ([A00006](../A00006-modell.md)), eine Entscheidungsfunktion `zugregeln(wer, vorher, nachher, archiviert)` im Dienst — unter der Sperre, nach der Änderung im Speicher, **vor** `aktion()`. Agent ⇒ `Fehler::GrenzeErreicht` (409) bzw. `Fehler::Verboten` (403) nach [ADR-0003](../../ADRs/0003-abweisungen-mit-strukturiertem-rumpf.md); Mensch ⇒ `Warnung { pruefung: "grenze" }`.

Zusammengesetzte Aktionen nach [ADR-0005](../../ADRs/0005-zusammengesetzte-aktionen-in-einem-commit.md): **eine öffentliche Methode = eine Sperre = ein `aktion()`**; Teilschritte ohne Sperre und ohne Commit.

| Schreibweg | Ort | Grenze R00096 | Eigentümer R00097 |
|---|---|---|---|
| `ziehen` | `reservierung.rs` | ja, vor der Reservierung | ja (`von` = Menschen-Spalte) |
| `bewegen`, `mehrere_bewegen` | `bewegen.rs` | ja, Stand nach allen Zügen | ja, auch Umsortieren |
| Anlegen mit `spalte` (einzeln, mehrere, Board-Pfad) | `aufgabe_anlegen.rs` | ja | nein (Hineinlegen erlaubt) |
| Auf das Board legen | Board-Pfad `…/aufgaben` | ja | nein |
| Vom Board nehmen | `DELETE …/aufgaben/{nr}` | nein | ja |
| Archivieren (einzeln, mehrere) | `archiv.rs` | nein | ja, auf jedem Board |
| Zurückholen (einzeln, mehrere) | `archiv.rs` | ja, auf jedem Board | nein |
| Wiederöffnen über `key` | `aufgabe_anlegen.rs`, R00098 | ja | nein |
| Erledigen | `erledigen.rs` (geplant), R00099 | ja (Abschlussspalte) | eigener Ablauf: Agent in Menschen-Spalte ⇒ Signal statt Zug |

Schlüsselsuche (R00098, R00099) nach [ADR-0004](../../ADRs/0004-schluesselsuche-unter-der-sperre.md): unter derselben Sperre über `ordner().aufgaben()`, einmal je Anfrage.

Erkennen von Abweichungen: Schreibzugriffe außerhalb von `aktion()` finden sich mit `grep -rn "\.schreib(\|committen(" src/dienst`; jede Fundstelle außer `mod.rs` steht unten oder ist ein Befund. Eine Regel, die erst nach `aktion()` prüft, ist ein Befund (dann ist der Commit schon da).

## Abweichungen

| Baustein | Ort | Was anders ist |
|---|---|---|
| A00004 | `src/dienst/anhaenge.rs:66`, `:87` | Anhänge (Binärdateien) werden außerhalb von `aktion()` geschrieben und über `committen()` committet — ein Commit je Aktion bleibt erhalten |
| A00004 | `src/dienst/fieber.rs:115` | Commit mit Systemautor `kanband` statt handelnder Person (Cache verworfen) |

## Offene Fragen

- keine (Zug-Prüfung entschieden in ADR-0002)

## Notizen / Quellen

- `gesperrt()` wird in 17 Dateien unter `src/dienst/` benutzt (gezählt 2026-10-31).
- Die Sperre ist prozessweit; ein zweiter kanbanD-Prozess auf demselben Ordner ist nicht abgesichert.
