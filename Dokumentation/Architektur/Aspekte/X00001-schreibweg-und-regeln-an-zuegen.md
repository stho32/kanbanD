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

Einhängepunkte der geplanten Regeln (alle in Schritt 2, unter der Sperre, damit zwei Agenten nicht gleichzeitig dieselbe Lücke sehen):

| Regel | Anforderung | Einhängepunkt | Art des Handelnden |
|---|---|---|---|
| WIP-Grenze: Agent → 409, Mensch → Warnung | R00096 | `bewegen`, `mehrere_bewegen` (`bewegen.rs`), `ziehen` (`reservierung.rs`), Anlegen in eine Spalte (`aufgabe_anlegen.rs`) — jeweils vor `aktion()`; Mensch-Warnung neben den bestehenden Warnungen | `Person` aus `handelnder()` (Art aus `kanbanD.md`) |
| Spalten mit Eigentümer | R00097 | dieselben Züge wie R00096; gemeinsame Prüffunktion statt Kopie je Methode | wie oben |
| Idempotentes Anlegen über `key` | R00098 | `aufgabe_anlegen` vor der Nummernvergabe: Suche über alle Aufgaben samt Archiv unter der Sperre; Treffer offen ⇒ kein `aktion()`, Treffer archiviert ⇒ ein `aktion()` für das Wiederöffnen | unabhängig |

Erkennen von Abweichungen: Schreibzugriffe außerhalb von `aktion()` finden sich mit `grep -rn "\.schreib(\|committen(" src/dienst`; jede Fundstelle außer `mod.rs` steht unten oder ist ein Befund. Eine Regel, die erst nach `aktion()` prüft, ist ein Befund (dann ist der Commit schon da).

## Abweichungen

| Baustein | Ort | Was anders ist |
|---|---|---|
| A00004 | `src/dienst/anhaenge.rs:66`, `:87` | Anhänge (Binärdateien) werden außerhalb von `aktion()` geschrieben und über `committen()` committet — ein Commit je Aktion bleibt erhalten |
| A00004 | `src/dienst/fieber.rs:115` | Commit mit Systemautor `kanband` statt handelnder Person (Cache verworfen) |

## Offene Fragen

- Soll die gemeinsame Zug-Prüfung (R00096/R00097) eine eigene Funktion im Modell (`Board`) sein oder im Dienst? Empfehlung: Zählen im Modell (rein, testbar), Entscheidung nach Art des Handelnden im Dienst.

## Notizen / Quellen

- `gesperrt()` wird in 17 Dateien unter `src/dienst/` benutzt (gezählt 2026-10-31).
- Die Sperre ist prozessweit; ein zweiter kanbanD-Prozess auf demselben Ordner ist nicht abgesichert.
