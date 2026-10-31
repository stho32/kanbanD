---
id: R00096
status: Neu
datum: 2026-10-31
---

# R00096: WIP-Grenze für Agenten durchsetzen

## Beschreibung

Die Grenze einer Spalte (`limits` im Frontmatter des Boards, R00009) wird verbindlich, sobald ein Agent eine Karte hineinlegen will: Ist die Spalte voll, antwortet kanbanD mit `409` „Grenze erreicht“ und committet nichts. Ein Mensch darf die Grenze überschreiten, bekommt aber eine Warnung, so wie heute bei nicht erfüllten Spaltenprüfungen (`column-checks`).

Zahlt ein auf: [Vision](R00000-vision.md) — Menschen im Browser, KI-Agenten über die API auf einem gemeinsamen Board.

## Geschäftlicher Nutzen

Über die Grenze stellt der Mensch das Tempo der Wartungsfabrik ein. Heute ist sie nur eine Markierung im Spaltenkopf: Ein Behandler kann über `ziehen` beliebig viele Karten in eine Spalte mit Grenze 1 holen (geprüft am 2026-10-31: Spalte „In Arbeit“ mit Grenze 1 und drei Karten, `ziehen` antwortet 200 ohne Warnung). Damit die Grenze wirkt, muss sie bei Agenten durchgesetzt werden.

## Funktionale Anforderungen

### Wer gebremst wird
- Ob gebremst wird, hängt an der Art der handelnden Person (`X-KanbanD-Wer` → `kind` in `kanbanD.md`) und nicht am Kanal: `agent` wird abgewiesen, `human` wird gewarnt, auch wenn ein Mensch die API aufruft.

### Wann eine Spalte voll ist
- Gezählt werden die nicht archivierten Karten, die in der Zielspalte liegen, also dieselbe Zahl wie im Spaltenkopf. Voll heißt Anzahl ≥ Grenze. Ohne Grenze (fehlt, leer oder 0) ist eine Spalte nie voll.
- Wird eine Karte nur innerhalb ihrer Spalte umsortiert, ist das kein Zugang und wird nie gebremst.

### Betroffene Schreibwege (alle, die eine Karte in eine Spalte bringen)
- `POST /api/boards/{slug}/ziehen` — die Prüfung kommt vor der Reservierung. Ist die Zielspalte voll, wird nichts reserviert, nichts zugewiesen und nichts bewegt.
- `POST /api/boards/{slug}/bewegen`
- `POST /api/boards/{slug}/bewegen-mehrere` — geprüft wird der Stand nach allen Zügen. Überschreitet eine Zielspalte dann ihre Grenze, wird die ganze Anfrage abgewiesen.
- `POST /api/aufgaben` und `POST /api/aufgaben/mehrere` mit `board` und `spalte`, sowie `POST /api/boards/{slug}/aufgaben` und `…/aufgaben/mehrere`.
- `POST /api/aufgaben/{nr}/zurueckholen` und `POST /api/aufgaben/zurueckholen`, sofern die Karte dadurch wieder in einer Spalte zählt.

### Antwort an einen Agenten
- `409` mit `{fehler: "Grenze erreicht", spalte, grenze, anzahl}`, ohne Commit und ohne Änderung an einer Datei.

### Antwort an einen Menschen
- Der Zug wird ausgeführt und committet. In `warnungen` steht ein Eintrag `{pruefung: "grenze", text: "Grenze erreicht: „<Spalte>“ hat <n> von <Grenze>"}`, also in derselben Form wie die Warnungen der Spaltenprüfungen.
- Die Oberfläche zeigt diese Warnung genauso an wie eine Warnung aus `column-checks`.

### Beschreibung
- `/api`, `/api/endpunkte` und `/api/openapi.json` nennen bei jedem betroffenen Endpunkt die `409` für Agenten und die Warnung `grenze` für Menschen.

## Nicht-funktionale Anforderungen

- Prüfung und Zug laufen unter derselben Sperre wie heute (`gesperrt()`). Zwei gleichzeitige `ziehen` in eine Spalte mit genau einem freien Platz ergeben genau einen Erfolg und eine `409`.

## Akzeptanzkriterien

### Agent
- [ ] „In Arbeit“ mit Grenze 2 und den Karten [5, 6], „Bereit“ = [7]: Agent `bot` zieht aus „Bereit“ nach „In Arbeit“ → `409` `{fehler: "Grenze erreicht", spalte: "In Arbeit", grenze: 2, anzahl: 2}`. `git log` hat keinen neuen Commit, #7 ist nicht reserviert und `bot` ist nicht zuständig
- [ ] Dieselbe Lage mit `bewegen {nummer: 7, spalte: "In Arbeit"}` als `bot` → `409`, kein Commit
- [ ] „In Arbeit“ = [5] bei Grenze 2: `bewegen-mehrere` mit #7 und #8 nach „In Arbeit“ → `409` (es wären 3 von 2), keine der beiden Karten bewegt
- [ ] „In Arbeit“ = [5, 6] bei Grenze 2, #6 archiviert → zählt 1, `ziehen` gelingt
- [ ] `bot` sortiert #6 innerhalb der vollen Spalte „In Arbeit“ nach oben → `200`
- [ ] `POST /api/aufgaben {titel, board, spalte: "In Arbeit"}` als `bot` bei voller Spalte → `409`, es entsteht keine Datei
- [ ] Zwei gleichzeitige `ziehen` von zwei Instanzen in eine Spalte mit Grenze 3 und 2 Karten → genau ein `200` und ein `409`

### Mensch
- [ ] Mensch `st` bewegt #7 in die volle Spalte „In Arbeit“ (Grenze 2) → `200`, ein Commit, `warnungen` enthält `{pruefung: "grenze", text: "Grenze erreicht: „In Arbeit“ hat 3 von 2"}`
- [ ] In der Oberfläche erscheint nach dem Ziehen per Maus die Warnung wie bei einer nicht erfüllten Spaltenprüfung, und die Karte liegt in der Spalte

### Ohne Grenze
- [ ] Spalte ohne `limits`-Eintrag: `bot` bewegt beliebig viele Karten hinein, ohne `409`

## Betroffene Verzeichnisstruktur

Regel als reine Funktion am Board-Modell (`src/modell/board.rs`). Durchsetzung in den Diensten `src/dienst/bewegen.rs`, `src/dienst/reservierung.rs`, `src/dienst/aufgabe_anlegen.rs` und an den Stellen, die auf das Board legen oder zurückholen. Fehlerform in `src/fehler.rs`, Anzeige der Warnung in `web/app.js`. Die Tests liegen im jeweiligen Modul, unter `tests/` und `e2e/tests/`.

## Technische Überlegungen

### Ablauf
1. **Handelnde Person bestimmen** (vorhanden: `handelnder` → `Person { art }`)
2. **Zielstand berechnen**: das Board nach dem gewünschten Zug im Speicher, noch nicht geschrieben
3. **Grenzen prüfen**: `board.ueber_grenze(&zielstand, &zugaenge)` → Liste der überschrittenen Spalten
   - 3.1 Leer: weiter wie heute
   - 3.2 Nicht leer und `art == Agent`: `Fehler::Konflikt` mit Spalte, Grenze und Anzahl. Es wird nichts geschrieben
   - 3.3 Nicht leer und `art == Human`: Zug ausführen, Warnung `grenze` anhängen
4. **Commit wie heute**

### Grobentwurf

**Wichtige Einstiegsstellen:** die Dienstmethoden `bewegen`, `mehrere_bewegen`, `ziehen`, `aufgabe_anlegen`, `aufgaben_anlegen`, das Auflegen aufs Board und das Zurückholen. Alle laufen schon unter `gesperrt()`.

- `Grenzverletzung` (DTO, immutable) — Spalte, Grenze, Anzahl nach dem Zug
- `Grenzverletzungen` (benannte Collection)
  - `fn ist_leer(&self) -> bool`
  - `fn als_warnungen(&self) -> Vec<Warnung>`
- `Board` (vorhanden) — reine Prüfung
  - `fn grenzverletzungen(&self, vorher: &Board) -> Grenzverletzungen` — vergleicht die Spaltenbelegung vorher und nachher und zählt nur Spalten mit Zugang; Archivierte werden über die Aufgabenliste ausgenommen
- `Fehler::Konflikt` (vorhanden) — trägt künftig optional einen strukturierten Rumpf (`spalte`, `grenze`, `anzahl`) für die `409`

### Änderungen an bestehenden Klassen
- `Kanban::bewegen`, `mehrere_bewegen`, `ziehen`, `aufgabe_anlegen`, `aufgaben_anlegen`, Auflegen und Zurückholen: die Prüfung vor dem Schreiben einbauen
- `Warnung`: neue Prüfung `grenze` ohne Knoten
- `web/app.js`: Die Anzeige der Zugwarnungen nimmt `grenze` auf, falls sie heute nur `column-checks` kennt

## Tests

**Unit:** `Board::grenzverletzungen` — Zugang, Umsortieren, archivierte Karten, keine Grenze, mehrere Zielspalten (Rechenbeispiele aus den Kriterien).
**Integration:** jeder betroffene Endpunkt als Agent (`409`, `git log` unverändert) und als Mensch (`200`, Warnung). Der gleichzeitige `ziehen` mit zwei Threads.
**E2E:** Ein Mensch zieht per Maus in eine volle Spalte, die Warnung wird sichtbar (US-3).

## Abhängigkeiten
- Abhängig von: R00009 (Grenzen), R00059 (Warnungen beim Zug), R00087 (`ziehen`)
- Blockiert: —

## Offene Fragen
- keine

## Manuelle Vorbereitungstätigkeiten
- keine

## Manuelle Nachbereitungstätigkeiten
- Im Factory-Board die Grenzen der Team-Spalten bewusst setzen. Agenten, die bisher ohne Grenze gearbeitet haben, bekommen sonst plötzlich eine `409`.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass die Grenze heute nur angezeigt wird: Behandler ziehen weiter, auch wenn die Spalte voll ist, und das Tempo bestimmt der schnellste Agent statt der Mensch. Wird die Grenze für Agenten zur harten `409`, hört ein Behandler auf zu ziehen, bis ein Platz frei ist. So wächst die Arbeit in Bearbeitung nicht über das hinaus, was der Mensch in „Verstehen & Freigabe“ prüfen kann. Der Hebel liegt bei der Zielspalte jedes Schreibwegs und nicht nur bei `ziehen`, denn sonst umginge ein Agent die Grenze einfach über `bewegen` oder das Anlegen in der Spalte. Menschen bleiben frei, weil die Grenze ihr Werkzeug ist und keine Fessel.

## Missing-Docs
- Wie die Oberfläche Zugwarnungen heute darstellt (Toast, Hinweiszeile), ist in keiner Anforderung zusammengefasst. R00059 beschreibt nur die Prüfungen.

## Notizen

**Optionen-Tableau übersprungen:** Der Betreiber hat das Verhalten vorgegeben (409 für Agenten, Warnung für Menschen). Ohne Rückfrage entschieden wurde nur der Umfang der Schreibwege. Er umfasst alle, die eine Karte in eine Spalte bringen, und nicht nur `ziehen` und `bewegen`, sonst wäre die Grenze umgehbar.

**Verworfene Alternativen**
- *Nur `ziehen` bremsen*: Ein Sensor legt über `POST /api/aufgaben` mit `spalte` unbegrenzt an, und ein Behandler könnte über `bewegen` ausweichen.
- *Bremsen nach Kanal (API gegen Oberfläche)*: Ein Mensch mit Skript würde zum Agenten, ein Agent mit Browser zum Menschen. Die Art der Person ist bereits die Unterscheidung, mit der R00087 arbeitet.
- *Warnung auch für Agenten statt 409*: Ein Agent wertet Warnungen nicht verlässlich aus, die Grenze wäre dann wieder nur eine Abmachung.
