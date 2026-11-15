---
id: X00001
name: Schreibweg und Regeln an Zügen
art: Aspekt
geltung: Makro
befund: Uneinheitlich
hausantwort: "Kanban-Methode unter gesperrt() → Prüfung → aktion() (Schreiben oder Entfernen; src/dienst/mod.rs)"
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
  - src/dienst/board_verwalten.rs
  - src/ablage.rs
---

# Schreibweg und Regeln an Zügen

## Hausantwort

Jede schreibende Aktion ist eine Methode von `Kanban` in [A00004 Dienste](../A00004-dienste.md) und läuft in drei Schritten:

1. **Sperre** — `let _sperre = self.gesperrt();` (eine `Mutex` je Ordner; WBS-Dateien fremder Repos haben eigene Sperren in `wbs_sperren`).
2. **Prüfung** — Stand frisch aus dem Ordner lesen, fachliche Regel am [Modell](../A00006-modell.md) anwenden, bei Verstoß `Fehler::{Ungueltig, Konflikt, GrenzeErreicht, Verboten, NichtGefunden}` (→ 400/409/409/403/404; Soll R00102: `EinstellungVerboten` → 403) zurückgeben, **bevor** etwas geschrieben ist.
3. **`aktion(autor, nachricht, schritte)`** — Dateien schreiben oder entfernen (`Schritt::Schreiben` / `Schritt::Entfernen`), Pfade als eigen merken ([A00008 Wächter](../A00008-waechter.md)), genau ein Commit über [A00007 Git](../A00007-git.md).

Nach dem Commit kommen nur noch Warnungen (z. B. Spaltenprüfungen `column-checks` in `bewegen.rs::warnungen`), nie Abweisungen. Die Warnung `grenze` entsteht dagegen schon in Schritt 2 und wird nur angehängt.

## Systemantwort

Regeln an Zügen nach [ADR-0002](../../ADRs/0002-zugregeln-gemeinsam-vor-der-aktion.md): Zählen als reine Funktionen am Modell ([A00006](../A00006-modell.md): `Board::belegung(archiviert)` → `Belegung`, `Belegung::grenzverletzungen(vorher)` → `Grenzverletzungen`), Entscheiden in der gemeinsamen Regeldatei `src/dienst/zugregeln.rs` — unter der Sperre, nach der Änderung im Speicher, **vor** `aktion()`:

- `zug_pruefen(art, vorher, nachher, archiviert)` (`zugregeln.rs:15`) — rein, ein Zug auf einem Board; für Schreibwege, die die Aufgaben ohnehin gelesen haben (`reservierung.rs`, `aufgabe_anlegen.rs`).
- `zugregeln(art, &Grenzverletzungen)` (`zugregeln.rs:42`) — die Entscheidung: Agent ⇒ erste Verletzung von links als `Fehler::GrenzeErreicht { spalte, grenze, anzahl }` (409, `anzahl` = Belegung vor dem Zug); Mensch ⇒ je Verletzung `Warnung { pruefung: "grenze" }`.
- Lesehelfer an `Kanban`: `grenzen_pruefen(wer, vorher, nachher)` (`zugregeln.rs:21`, liest die Archivierten selbst; `bewegen.rs`, `zuordnung.rs`) und `zurueckholen_pruefen(wer, nummern)` (`zugregeln.rs:28`, je Board in der Reihenfolge der Boardliste; `archiv.rs`).

Eigentümer (R00097, R00120) ist gebaut: `Board::entnahme_erlaubt(art, nummer)` (`src/modell/board.rs:529`) sperrt einen Agenten, wenn die Karte in einer Menschen-Spalte liegt — geprüft über **alle** Spalten einer Nummer (`any`, R00120 Punkt 8) — oder ein `human` meinender, nicht an eine Spalte gebundener `column-owner`-Eintrag das ganze Board sperrt (fail-safe, PO Z. 187); die reine Prüfung `entnahme_pruefen` (`zugregeln.rs:29`) nennt die erste Sperre einer Nummernliste als `Fehler::Verboten { meldung, spalte, nummer }` (403) nach [ADR-0003](../../ADRs/0003-abweisungen-mit-strukturiertem-rumpf.md), `entnahme_und_zug_pruefen` (`zugregeln.rs:37`) und `Kanban::entnahme_und_grenzen_pruefen` (`zugregeln.rs:44`) stellen sie vor die Grenzprüfung (403 vor 409). `Kanban::archivieren_pruefen` (`zugregeln.rs:88`) prüft je Board der Boardliste und liefert einem Agenten **423** `Fehler::Defekt`, sobald eine Board-Datei des Ordners unlesbar ist (R00120 Punkt 2, PO Z. 188). **Ordnung der Sperren** nach [ADR-0003 Nachtrag N2](../../ADRs/0003-abweisungen-mit-strukturiertem-rumpf.md#nachtrag-2026-11-13-n2-ordnung-der-abweisungen--423-vor-403-vor-409-karte-121): treffen mehrere zu, gilt **423 vor 403 vor 409**, einheitlich für Board- und Aufgaben-Wege — der defekte Ordner macht jede Aussage über Sperren unsicher. Soll: der Defekt wird **vor** der Entnahmesperre der lesbaren Boards geprüft; Ist am 2026-11-13 (kanbanD `ad8ee18`): `archivieren_pruefen` prüft die 403 der lesbaren Boards zuerst (`zugregeln.rs:93`), also heute 403 statt 423 im Fall von R00120 AK 6 (Karte #121, Bau Welle 2).

Gebaut (R00102, I0087): `PUT /api/boards/{slug}/spalten` (`spalten.rs`) behält das Board vor `spalten_setzen` als „vorher“, ermittelt nach Formfehler (400) und „enthält Aufgaben“ (409) die `Einstellungsaenderungen` (reine Funktion am [Modell](../A00006-modell.md)) und entscheidet in `zugregeln.rs`: Agent mit Änderung ⇒ erste als `Fehler::EinstellungVerboten { meldung, spalte, einstellung }` (403) nach [ADR-0006](../../ADRs/0006-einstellung-verboten-als-dritte-abweisung.md); Mensch ⇒ weiter; dann `aktion()`.

Ob ein **Mensch** über der Grenze eine Warnung bekommt, hängt am Schreibweg (PO-Entscheidung 2026-11-01, `AI-Team/po-entscheidungen.md:26`): nur dort, wo die Antwort schon `warnungen` trägt — `ziehen`, `bewegen`, `mehrere_bewegen`. Beim Anlegen mit `spalte`, Auflegen und Zurückholen wird der Mensch ohne Warnung durchgelassen, die Antwortform bleibt unverändert; die Belegung sieht er im Spaltenkopf.

Zusammengesetzte Aktionen nach [ADR-0005](../../ADRs/0005-zusammengesetzte-aktionen-in-einem-commit.md): **eine öffentliche Methode = eine Sperre = ein `aktion()`**; Teilschritte ohne Sperre und ohne Commit.

| Schreibweg | Ort | Grenze R00096 | Warnung an Mensch | Eigentümer R00097 |
|---|---|---|---|---|
| `ziehen` | `reservierung.rs` | ja, vor der Reservierung | ja | ja (`von` = Menschen-Spalte) |
| `bewegen`, `mehrere_bewegen` | `bewegen.rs` | ja, Stand nach allen Zügen | ja | ja, auch Umsortieren |
| Anlegen mit `spalte` (einzeln, mehrere, Board-Pfad) | `aufgabe_anlegen.rs` | ja | nein | nein (Hineinlegen erlaubt) |
| `duplizieren` (Karte duplizieren) | `aufgabe_anlegen.rs` (`Kanban::aufgabe_duplizieren`), R00142 | ja, vom Anlegeweg geerbt | nein | nein (`Hineinlegen`, R00097) |
| Auf das Board legen (einzeln, mehrere) | `zuordnung.rs` (`auf_board_legen`, `mehrere_auf_board_legen`) | ja | nein | nein |
| Vom Board nehmen | `zuordnung.rs` (`von_board_nehmen`) | nein | — | ja |
| Archivieren (einzeln, mehrere) | `archiv.rs` | nein | — | ja, auf jedem Board |
| Endgültig löschen (eine Aufgabe) | `archiv.rs` (`endgueltig_loeschen`), R00141 | nein | — | ja, auf jedem Board (403 Agent aus Menschen-Spalte / 423 defektes Board **vor** dem ersten Schritt) |
| Zurückholen (einzeln, mehrere) | `archiv.rs` | ja, auf jedem Board | nein | nein |
| Wiederöffnen über `key` | `aufgabe_anlegen.rs`, R00098 | ja (Zielboard und jedes weitere Board, auf dem die Karte liegt — mit und ohne `board`, `rueckkehr_pruefen`) | offen (R00098) | nein (kein Herausnehmen, R00098; die Zeilen der übrigen Boards bleiben stehen) |
| Erledigen | `erledigen.rs` (geplant), R00099 | ja (Abschlussspalte) | offen (R00099) | eigener Ablauf: Agent in Menschen-Spalte ⇒ Signal statt Zug |
| Umbenennen (Umbenennen) | `board_verwalten.rs`, R00128 | nein | — | nein (bewegt keine Karte) |
| Archivieren eines Boards | `board_verwalten.rs`, R00128 | nein | — | ja, board-weit (alle Spalten) |
| Löschen eines Boards | `board_verwalten.rs`, R00128 | nein | — | ja, board-weit (alle Spalten) |

Schlüsselsuche (R00098, R00099) nach [ADR-0004](../../ADRs/0004-schluesselsuche-unter-der-sperre.md): unter derselben Sperre über `ordner().aufgaben()`, einmal je Anfrage.

Pfade nach [ADR-0008](../../ADRs/0008-board-slug-geprueft-vor-jedem-dateizugriff.md): ein Board-Slug aus Body, Pfad oder Query erreicht die Platte nur über `Ordner::board`, das die Form (`board::slug_gueltig`, 1–40 Zeichen `[a-z0-9-]`) **vor** jedem Lesen prüft — ungültig ⇒ `Fehler::Ungueltig` (400), gültig und fehlend ⇒ 404; `board_pfad` bekommt nur `b.slug` eines so gelesenen Boards. Zweite Linie: `aktion()` prüft alle Pfade beider Arten (Schreiben und Entfernen) vor dem ersten Schritt (relativ, ohne `..`, eindeutig) und `Ordner::schreib` den Einschluss — Treffer ⇒ `Fehler::Intern`, nichts geschrieben oder entfernt. Seit der Rücknahme (ADR-0005 N2, #43) ist `git::committen` eine zweite Stelle, die löscht: auch sie prüft ihre Pfade mit demselben `pfade_pruefen`, bevor sie Index oder Arbeitsbaum anfasst — Soll (#43, uncommitteter Bauversuch). Soll (#48, noch nicht gebaut). Erkennen: `grep -rn "board_pfad(" src` — jedes Argument außer `&b.slug`/`&board.slug` eines über `Ordner::board` gelesenen Boards ist ein Befund.

Erkennen von Abweichungen: Schreib- und Löschzugriffe außerhalb von `aktion()` finden sich mit `grep -rn "\.schreib(\|committen(\|remove_file\|remove_dir" src/dienst`; jede Fundstelle außer `mod.rs` steht unten oder ist ein Befund. Eine Regel, die erst nach `aktion()` prüft, ist ein Befund (dann ist der Commit schon da).

### Probe „Aufruf vergessen“ (R00118 B0540)

Die Schwäche von ADR-0002 — ein neuer Schreibweg vergisst den Aufruf — prüft `tests/aufruf_vergessen.rs` als `grep`-Wächter. Board-Datei-Schreiber sind die 17 Stellen mit `board_pfad(` unter `src/dienst/`. **Karten bewegende Wege** sind darunter `bewegen.rs`, `aufgabe_anlegen.rs`, `zuordnung.rs` (`auf_board_legen`, `mehrere_auf_board_legen`), `reservierung.rs`, `erledigen.rs` sowie `archiv.rs`: `zurueckholen_pruefen` schreibt keine Board-Datei, lässt die Karten aber wieder zählen, und `endgueltig_loeschen` (R00141) nimmt eine Karte von **allen** Boards und prüft vorher `archivieren_pruefen` (403 Agent aus Menschen-Spalte / 423 defektes Board, R00097/R00120); jeder Weg ruft vor `aktion()` die Grenzprüfung auf (`zug_pruefen`, `zug_mit_rueckkehr_pruefen`, `grenzen_pruefen`, `entnahme_und_zug_pruefen`, `zurueckholen_pruefen`).

**Ausnahmen** (Board-Datei-Schreiber ohne Kartenzug, keine Grenzprüfung nötig): `berichtsfilter.rs`, `bestand.rs`, `bindung.rs`, `board_anlegen.rs`, `board_verwalten.rs` (umbenennen/archivieren/löschen — prüft die Eigentümer-Sperre board-weit, bewegt aber keine Karte), `einrichten.rs`, `fieber.rs`, `phasen.rs`, `spalten.rs`, `termine.rs`, `verlauf.rs` (liest die Board-Datei nur) sowie `zuordnung.rs::von_board_nehmen` (nimmt eine Karte heraus, nie hinein). Ein neuer Schreiber lässt den Wächter rot werden und ist hier einzuordnen.

**Löschweg (R00128/R00141, A00007):** `board_verwalten.rs::board_loeschen` (Board-Datei samt Cache) und `archiv.rs::endgueltig_loeschen` (Aufgabendatei, Board-Zeilen, Anhänge) entfernen Dateien statt sie zu schreiben — als **Entfernen-Schritt** (`Schritt::Entfernen`) desselben `Kanban::aktion` (`mod.rs`), nicht mehr als eigener Weg `entfernen()`; alle Pfade beider Arten (Schreiben und Entfernen) werden vor dem ersten Schritt geprüft (ADR-0008, zweite Linie), ein Commit je Aktion bleibt erhalten ([ADR-0024](../../ADRs/0024-aufgabe-endgueltig-loeschen-datei-entfernen-ein-commit.md), Board-Löschung nach [ADR-0022](../../ADRs/0022-board-umbenennen-archivieren-loeschen.md)).

## Abweichungen

| Baustein | Ort | Was anders ist |
|---|---|---|
| A00004 | `src/dienst/anhaenge.rs:66`, `:87` | Anhänge (Binärdateien) werden außerhalb von `aktion()` geschrieben und über `committen()` committet — ein Commit je Aktion bleibt erhalten |
| A00004 | `src/dienst/fieber.rs:115` | Commit mit Systemautor `kanband` statt handelnder Person (Cache verworfen) |
| A00004 | `src/dienst/zugregeln.rs` (`zurueckholen_pruefen`) | liest `ordner().boards()?` und verwirft die Defekte-Liste: eine defekte Board-Datei wird beim Zurückholen übersprungen, die Karte gilt dort als auf keinem Board — der Weg läuft ohne Sperre durch (R00118 B0537); belegt `tests/wip_grenze.rs::zurueckholen_ueberspringt_defekte_board_dateien` |

## Offene Fragen

- keine (Zug-Prüfung entschieden in ADR-0002)

## Notizen / Quellen

- `gesperrt()` wird in 20 Dateien unter `src/dienst/` benutzt (gezählt 2026-11-11).
- Die Sperre ist prozessweit; ein zweiter kanbanD-Prozess auf demselben Ordner ist nicht abgesichert.
- nachgeführt 2026-11-01 nach R00096 (Architektur-Review #2)
- ergänzt 2026-11-06: Pfadregel nach ADR-0008 (#48)
- ergänzt 2026-11-11 (R00118 B0541): ADR-0002 Option B nennt die geplante Signatur `zugregeln(wer, vorher, nachher, archiviert)`; gebaut ist `zugregeln(art, &Grenzverletzungen)` (`zugregeln.rs:95`), die Vorher/Nachher-Rechnung liegt in `Board::belegung(archiviert)` → `Belegung::grenzverletzungen(vorher)` (s. oben, Systemantwort). Der Schnitt bleibt unverändert: Zählen im Modell, Entscheiden in `zugregeln.rs` — ADR-0002 in der Sache bestätigt.
- nachgeführt 2026-11-11 nach R00120 (Härtung Spalten mit Eigentümer): `entnahme_erlaubt` prüft alle Spalten einer Nummer; ein `human` meinender, ungebundener `column-owner`-Eintrag sperrt das ganze Board (403, PO Z. 187); `archivieren_pruefen` liefert bei einer unlesbaren Board-Datei 423 (PO Z. 188). Rohe `column-owner`-Einträge trägt das [Modell](../A00006-modell.md) in `Board.eigentuemer_roh` (`ColumnOwnerEintrag`), das [Format](../A00005-format.md) gibt sie beim Schreiben verlustfrei zurück, und `pruefungen::unbekannte` meldet sie.
- nachgeführt 2026-11-11 nach R00128/R00141 (#35/#36, ADR-0022/ADR-0024): Löschen ist ein **Entfernen-Schritt** desselben `aktion()`, kein eigener Weg `entfernen()` mehr; das Erkennungs-`grep` nimmt `remove_file`/`remove_dir` mit; `gesperrt()` in 20 Dateien (Stand 2026-11-11) statt 17.
- nachgeführt 2026-11-11 nach R00142 (#124): `duplizieren` ist **kein eigener Schreibweg**. `Kanban::aufgabe_duplizieren` (`src/dienst/aufgabe_anlegen.rs:99`) liest die Quelle unter der Sperre (`self.gesperrt()`, 404/423) und legt die Kopie über den vorhandenen Anlegeweg `anlegen_gesperrt` (`:116`, `aus: Some(nr)` ändert nur die Commit-Nachricht) an — eine Sperre, ein `aktion()`, ein Commit, Nummernvergabe und Board-Zeile wie beim Anlegen. Grenze, Warnung und Eigentümer sind damit geerbt: WIP-Grenze ja (Agent 409, Mensch ohne Warnung durchgelassen), Eigentümer-Regel sperrt nicht (Hineinlegen, R00097). Der Wächter `tests/aufruf_vergessen.rs` deckt `aufgabe_anlegen.rs` bereits ab; keine neue Ausnahme, keine Abweichung.
- berichtigt 2026-11-15 nach Karte #45: das am selben Tag eingetragene Soll „Wiederöffnen mit `board` ist ein Umzug“ ist **zurückgezogen** (Betreiber 2026-11-15, [ADR-0005 N3](../../ADRs/0005-zusammengesetzte-aktionen-in-einem-commit.md), nie gebaut). Es gilt der gebaute Stand von R00098: „Archiviert“ ist eine Eigenschaft der Karte und gilt für alle Boards; Archivieren und Zurückholen schreiben nur die Aufgabendatei (`src/dienst/archiv.rs:7–37`), keine Board-Zeile. Wiederöffnen über `key` nimmt `archived` zurück — die Karte liegt wieder auf allen Boards, auf denen sie vorher lag — und legt sie mit `board` zusätzlich oben auf das genannte Board; `schreiben` (`src/dienst/aufgabe_anlegen.rs:191`) schreibt nur dieses eine Board, die Rückkehr-Grenze der übrigen prüft `rueckkehr_pruefen` (`:233`, Agent 409). Kein Umzug, keine 423 auf diesem Weg.
