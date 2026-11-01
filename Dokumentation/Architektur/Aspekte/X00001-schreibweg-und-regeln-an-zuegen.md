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
  - src/dienst/zugregeln.rs
  - src/dienst/zuordnung.rs
  - src/dienst/archiv.rs
---

# Schreibweg und Regeln an Zügen

## Hausantwort

Jede schreibende Aktion ist eine Methode von `Kanban` in [A00004 Dienste](../A00004-dienste.md) und läuft in drei Schritten:

1. **Sperre** — `let _sperre = self.gesperrt();` (eine `Mutex` je Ordner; WBS-Dateien fremder Repos haben eigene Sperren in `wbs_sperren`).
2. **Prüfung** — Stand frisch aus dem Ordner lesen, fachliche Regel am [Modell](../A00006-modell.md) anwenden, bei Verstoß `Fehler::{Ungueltig, Konflikt, GrenzeErreicht, Verboten, NichtGefunden}` (→ 400/409/409/403/404; Soll R00102: `EinstellungVerboten` → 403) zurückgeben, **bevor** etwas geschrieben ist.
3. **`aktion(autor, nachricht, dateien)`** — Dateien schreiben, Pfade als eigen merken ([A00008 Wächter](../A00008-waechter.md)), genau ein Commit über [A00007 Git](../A00007-git.md).

Nach dem Commit kommen nur noch Warnungen (z. B. Spaltenprüfungen `column-checks` in `bewegen.rs::warnungen`), nie Abweisungen. Die Warnung `grenze` entsteht dagegen schon in Schritt 2 und wird nur angehängt.

## Systemantwort

Regeln an Zügen nach [ADR-0002](../../ADRs/0002-zugregeln-gemeinsam-vor-der-aktion.md): Zählen als reine Funktionen am Modell ([A00006](../A00006-modell.md): `Board::belegung(archiviert)` → `Belegung`, `Belegung::grenzverletzungen(vorher)` → `Grenzverletzungen`), Entscheiden in der gemeinsamen Regeldatei `src/dienst/zugregeln.rs` — unter der Sperre, nach der Änderung im Speicher, **vor** `aktion()`:

- `zug_pruefen(art, vorher, nachher, archiviert)` (`zugregeln.rs:15`) — rein, ein Zug auf einem Board; für Schreibwege, die die Aufgaben ohnehin gelesen haben (`reservierung.rs`, `aufgabe_anlegen.rs`).
- `zugregeln(art, &Grenzverletzungen)` (`zugregeln.rs:42`) — die Entscheidung: Agent ⇒ erste Verletzung von links als `Fehler::GrenzeErreicht { spalte, grenze, anzahl }` (409, `anzahl` = Belegung vor dem Zug); Mensch ⇒ je Verletzung `Warnung { pruefung: "grenze" }`.
- Lesehelfer an `Kanban`: `grenzen_pruefen(wer, vorher, nachher)` (`zugregeln.rs:21`, liest die Archivierten selbst; `bewegen.rs`, `zuordnung.rs`) und `zurueckholen_pruefen(wer, nummern)` (`zugregeln.rs:28`, je Board in der Reihenfolge der Boardliste; `archiv.rs`).

Eigentümer (R00097) ist gebaut: `entnahme_und_zug_pruefen` (`zugregeln.rs`) gibt einem Agenten die erste gesperrte Karte als `Fehler::Verboten { meldung, spalte, nummer }` (403) nach [ADR-0003](../../ADRs/0003-abweisungen-mit-strukturiertem-rumpf.md).

Soll (R00102, I0087, noch nicht gebaut): `PUT /api/boards/{slug}/spalten` (`spalten.rs`) behält das Board vor `spalten_setzen` als „vorher“, ermittelt nach Formfehler (400) und „enthält Aufgaben“ (409) die `Einstellungsaenderungen` (reine Funktion am [Modell](../A00006-modell.md)) und entscheidet in `zugregeln.rs`: Agent mit Änderung ⇒ erste als `Fehler::EinstellungVerboten { meldung, spalte, einstellung }` (403) nach [ADR-0006](../../ADRs/0006-einstellung-verboten-als-dritte-abweisung.md); Mensch ⇒ weiter; dann `aktion()`.

Ob ein **Mensch** über der Grenze eine Warnung bekommt, hängt am Schreibweg (PO-Entscheidung 2026-11-01, `AI-Team/po-entscheidungen.md:26`): nur dort, wo die Antwort schon `warnungen` trägt — `ziehen`, `bewegen`, `mehrere_bewegen`. Beim Anlegen mit `spalte`, Auflegen und Zurückholen wird der Mensch ohne Warnung durchgelassen, die Antwortform bleibt unverändert; die Belegung sieht er im Spaltenkopf.

Zusammengesetzte Aktionen nach [ADR-0005](../../ADRs/0005-zusammengesetzte-aktionen-in-einem-commit.md): **eine öffentliche Methode = eine Sperre = ein `aktion()`**; Teilschritte ohne Sperre und ohne Commit.

| Schreibweg | Ort | Grenze R00096 | Warnung an Mensch | Eigentümer R00097 |
|---|---|---|---|---|
| `ziehen` | `reservierung.rs` | ja, vor der Reservierung | ja | ja (`von` = Menschen-Spalte) |
| `bewegen`, `mehrere_bewegen` | `bewegen.rs` | ja, Stand nach allen Zügen | ja | ja, auch Umsortieren |
| Anlegen mit `spalte` (einzeln, mehrere, Board-Pfad) | `aufgabe_anlegen.rs` | ja | nein | nein (Hineinlegen erlaubt) |
| Auf das Board legen (einzeln, mehrere) | `zuordnung.rs` (`auf_board_legen`, `mehrere_auf_board_legen`) | ja | nein | nein |
| Vom Board nehmen | `zuordnung.rs` (`von_board_nehmen`) | nein | — | ja |
| Archivieren (einzeln, mehrere) | `archiv.rs` | nein | — | ja, auf jedem Board |
| Zurückholen (einzeln, mehrere) | `archiv.rs` | ja, auf jedem Board | nein | nein |
| Wiederöffnen über `key` | `aufgabe_anlegen.rs`, R00098 | ja | offen (R00098) | nein |
| Erledigen | `erledigen.rs` (geplant), R00099 | ja (Abschlussspalte) | offen (R00099) | eigener Ablauf: Agent in Menschen-Spalte ⇒ Signal statt Zug |

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
- nachgeführt 2026-11-01 nach R00096 (Architektur-Review #2)
