---
id: R00149
status: Neu
datum: 2026-11-14
ursprung: Bug-Report
ursprungslauf: R00005
---

# R00149: Behebung — eine gescheiterte Aktion lässt nichts liegen und meldet ehrlich

## Beschreibung

Ein `POST /api/aufgaben` mit einem Titel, den Git nicht als Commit-Argument trägt, scheitert am Commit, **nachdem** die Aufgabendatei schon geschrieben und vorgemerkt wurde. Ein NUL-Byte im Titel (`"a\u0000b"`) lässt `git commit` mit „nul byte found in provided data“ abbrechen; ein Titel von etwa 1 MB sprengt die Argumentlänge (`MAX_ARG_STRLEN`). In beiden Fällen antwortet der Server `500`, die Datei liegt aber im Arbeitsbaum und steht im Index — ohne Commit, in keiner Git-Historie. Ein zweiter `POST` mit demselben `key` findet diese Datei und antwortet `200`/`neu: false` (R00098) für eine Karte, die niemand erzeugt zu haben glaubt.

Reproduzierbar (Ordner mit Board „fabrik“, Person `st`):

| Schritt | erwartet | heute |
|---|---|---|
| `POST /api/aufgaben {titel: "a\u0000b", key: "nul-1"}` | 201, genau ein Commit, Datei trägt den Titel | 500 („nul byte found in provided data“), Datei vorgemerkt ohne Commit |
| `POST /api/aufgaben {titel: <1 MB>, key: "lang-1"}` | 201, genau ein Commit, Nachricht kurz | 500 (Argumentgrenze), Datei vorgemerkt ohne Commit |
| derselbe `POST` mit `key: "nul-1"` noch einmal | 200 / `neu: false` **nur**, wenn die Karte committet ist | 200 / `neu: false` für die nie committete Karte |

Die Anforderung setzt [ADR-0005](../Dokumentation/ADRs/0005-zusammengesetzte-aktionen-in-einem-commit.md) **Nachtrag N1** (die Commit-Nachricht ist abgeleiteter Text; eine Aktion ist ganz oder gar nicht) und **Nachtrag N2** (die Rücknahme stellt den Stand von HEAD her; die Pfadprüfung aus [ADR-0008](../Dokumentation/ADRs/0008-board-slug-geprueft-vor-jedem-dateizugriff.md) gilt auch in `committen`) um. Sie ändert die Fachdaten nicht: der Titel bleibt roh in der Datei, nur die Nachricht wird abgeleitet.

Zahlt ein auf: [Vision](R00000-vision.md) — „Git ist das Gedächtnis. Jede Aktion in kanbanD ergibt einen eigenen Commit.“ Eine Datei ohne Commit widerspricht dem Satz; sie liegt als Rest einer gescheiterten Aktion da und wird beim nächsten `key`-Aufruf als vorhandene Karte ausgegeben.

## Ursachenanalyse

### Root Cause

Belegt am Stand `a2108ff` (gelesen 2026-11-14) und am uncommitteten Bauversuch Zweig `karte/43`:

1. **Der Commit-Nachricht fehlen die Grenzen.** Die Nachricht entsteht im Anlegeweg roh aus dem Titel (`format!("#{} „{}“ angelegt", …, a.titel)`, `src/dienst/aufgabe_anlegen.rs:160`). Sie geht unverändert als Argument in `git commit -q -m <nachricht>` (`src/git.rs:44`). Ein NUL-Byte oder eine übergroße Nachricht lässt Git scheitern — kein Schreibweg hat die Nachricht vorher abgeleitet.
2. **Die Aktion lässt einen halben Zustand zurück.** `Kanban::aktion` (`src/dienst/mod.rs:191–213`) ruft erst `ordner.schreib(…)` bzw. `remove_file`, dann `git::committen`. Scheitert der Commit, nimmt niemand die Datei aus dem Index oder entfernt sie — `git status --porcelain` ist nicht mehr so wie vor der Aktion.
3. **`committen` prüft seine Pfade nicht.** Der Weg führt über `relevante_pfade` (`src/git.rs:55`) direkt zu `git add`/`git commit`; die zweite Linie aus ADR-0008 sitzt heute allein in `aktion()` (`src/dienst/mod.rs:193`). Die direkten Aufrufer `src/dienst/anhaenge.rs:66/87` und `src/dienst/fieber.rs:115` gehen nicht durch `aktion()`.

Ausgeschlossen: den Titel am Eingang abweisen (400). Das Format trägt ihn (YAML-sicher, `yaml::skalar`), die Datei schreibt und liest ihn; die Grenze wäre erfunden und träfe Importe und Handeingaben. Der Mangel liegt allein in der Nachricht und in der Rücknahme (ADR-0005 N1 „Verworfen“).

### Betroffene Komponenten

- `src/git.rs` — `committen` (`:31–48`), `relevante_pfade` (`:55`); **neu** ein Kern `committen_und_pruefen`, `in_head` und `zuruecknehmen`
- `src/dienst/mod.rs` — `aktion` (`:191–213`), `committen` (`:183`)
- `src/dienst/aufgabe_anlegen.rs` — der Nachrichtenbau (`:160`, `:194` im Bauversuch), `board_anlegen.rs`, `board_verwalten.rs`, `kommentare.rs` — dieselbe Stelle weiterer Nachrichten
- `src/ablage.rs` — `pfade_pruefen` (`:185`), in `committen` aufzurufen
- `src/dienst/anhaenge.rs` (`:66`, `:87`) und `src/dienst/fieber.rs` (`:115`) — direkte `committen`-Aufrufer ohne `aktion()`
- **neu**: `src/nachricht.rs` (Ableitung der Nachricht)
- Tests: `tests/aufgabe_anlegen.rs`, `tests/git.rs`

## Lösungsvorschlag

### Langfristige Lösung

ADR-0005 N1 und N2 wörtlich, in drei Teilen:

1. **Die Nachricht ist abgeleiteter Text** (N1 Punkt 1 und 4). Eine Funktion macht aus einem Feldwert eine Zeile: Steuerzeichen (NUL, Umbruch, Tabulator, C1) und Unicode-Zeilentrenner werden zu einem Leerzeichen, die Länge ist begrenzt (eine Zeile, rund 120 Zeichen, Rest `…`). `committen` leitet die Nachricht **ein letztes Mal** ab, bevor sie als Argument an Git geht; alle Schreibwege, die eine Nachricht bauen (Titel, Board-Titel, Kommentar-Auszug), laufen durch dieselbe Funktion statt durch ein eigenes `format!`. Die **Fachdaten** (Titel in der Datei) bleiben unverändert und werden nie abgewiesen.
2. **Eine Aktion ist ganz oder gar nicht** (N1 Punkt 2, N2 Punkt 1/2). Scheitert der Commit, nimmt `committen` seine Pfade aus dem Index zurück (`git reset -- <pfade>`), stellt geänderte und gelöschte Dateien aus HEAD wieder her (`git checkout HEAD -- <pfad>`) und **entfernt** Dateien, die HEAD nicht kennt (die diese Aktion angelegt hat). Ein Pfad, der **vor** der Aktion uncommittete Änderungen trug, verliert sie — akzeptierte Schwäche (N2 Punkt 2): wer Handarbeit schützt, committet sie vorher.
3. **Die Pfadprüfung gilt auch in `committen`** (N2 Punkt 3). `ablage::pfade_pruefen` läuft **vor** `git add` und **vor** jedem Zugriff der Rücknahme, weil die direkten Aufrufer (`anhaenge`, `fieber`) nicht durch `aktion()` gehen. Ein Verstoß endet mit `Fehler::Intern`; Index und Arbeitsbaum bleiben unberührt.
4. **Die Meldung sagt, was geschah** (N2 Punkt 4). `Fehler::Intern` nennt die betroffenen Pfade; die Rücknahme meldet ihren eigenen Fehlschlag (Datei ließ sich nicht entfernen oder wiederherstellen), statt „zurückgenommen“ zu behaupten, wenn es nicht stimmt.

### Optionen

| | A: ADR-0005 N1/N2 wörtlich | B: nur die Nachricht kürzen | C: Titel am Eingang abweisen (400) | D: im temporären Arbeitsbaum committen |
|---|---|---|---|---|
| Komplexität | klein–mittel: eine Ableitung, eine Rücknahme, eine Prüfung | klein: eine Zeile im Anlegeweg | klein: eine Prüfung im Eingang | groß: zweiter Schreibweg neben `aktion()` |
| Testbarkeit | hoch: Unit (Ableitung, Rücknahme) + Integration je Fall | mittel: nur der NUL-/Längenfall | hoch, aber deckt die Halbaktion **nicht** | mittel, mit neuer Baustelle |
| Reversibilität | hoch: drei Stellen, jede für sich rücknehmbar | hoch | hoch | niedrig |
| Risiko | gering; die Rücknahme ist die einzige neue Löschstelle | die Halbaktion bleibt; `key`/`neu:false` lügt weiter | erfundene Grenze, trifft Importe und Handeingaben | Pfadprüfung und Wächter-Merkung gingen daran vorbei |
| Sichtbare Änderung | keine Oberfläche; API-Meldung und Commit-Nachricht | keine | neue 400 für Titel | keine |

**Entscheidung: A** — durch ADR-0005 N1/N2 bereits entschieden und hier nur umgesetzt.

### Alternative Ansätze

- **B — nur die Nachricht kürzen** (den Halbzustand lassen): lässt eine uncommittete Karte liegen und `key`/`neu: false` lügt weiter — der teurere Teil des Fehlers (N1 „Verworfen“).
- **C — Titel mit Steuerzeichen am Eingang abweisen (400):** das Format trägt den Titel, die Datei schreibt und liest ihn; die Grenze wäre erfunden und träfe Importe und Handeingaben (N1 „Verworfen“).
- **D — in einem temporären Arbeitsbaum committen und danach verschieben:** ein zweiter Schreibweg neben `aktion()`; Pfadprüfung (ADR-0008) und Wächter-Merkung gingen daran vorbei (N1 „Verworfen“).

## Test-Strategie

### Unit Test zur Bug-Reproduktion

- **Ableitung:** `nachricht::wert("a\u{0}b")` → `"a b"`; `wert("Tab\tund\r\nUmbruch")` → `"Tab und  Umbruch"`; ein Wert von 61 Zeichen wird auf 60 + `…` gekürzt; genau 60 Zeichen bleiben ganz; `fertig(<200 Zeichen>)` ist eine Zeile ≤ 120 Zeichen ohne Steuerzeichen. Heute rot: `src/nachricht.rs` existiert nicht.
- **Rücknahme:** `committen` gegen ein Wegwerf-Repo mit scheiterndem `pre-commit`-Hook; ein Pfad neu, einer geändert, einer gelöscht → nach dem Fehler ist der neue weg, der geänderte auf HEAD, der gelöschte wieder da, `git status --porcelain` wie vorher, kein Commit. Heute rot: `committen` nimmt nichts zurück.

### Code-Extraktion für isoliertes Testing

`nachricht::wert`/`fertig` sind reine Funktionen in `src/nachricht.rs` und werden direkt getestet. `in_head` (kennt HEAD den Pfad?) und `zuruecknehmen` sind klein genug für den Integrationstest gegen ein echtes Git-Repository; den Schnitt (Prüfung direkt in `committen` oder gemeinsamer Helfer für `aktion` und `committen`) wählt der Entwickler (N2 „Grenze“).

### Regressionstests

- `tests/git.rs` — bestehende Fälle (kein Commit ohne Änderung, gelöschte Datei als Löschung, Unterordner) bleiben grün.
- `tests/aufgabe_anlegen.rs`, `tests/archiv.rs`, `tests/aufruf_vergessen.rs` und die übrigen Schreibwege bleiben grün; der Umbau von `committen` ist für sie transparent.
- Alle Ebenen: `cargo test` (die `e2e`-Suite ist nicht betroffen; keine Oberfläche).

## Akzeptanzkriterien

Grundbestand: ein Wegwerf-Ordner mit Board „fabrik“, Person `st` (Mensch); die Reproduktion läuft über die API (`POST /api/aufgaben`). „Genau ein Commit“ heißt `git rev-list --count HEAD` + 1; „kein Git-Rest“ heißt `git status --porcelain` leer.

### Bug behoben (Pflicht)

- [ ] Der Reproduktionstest ist ohne Fix rot und mit Fix grün
- [ ] Der ursprüngliche Fehler tritt in den Szenarien der User Story nicht mehr auf
- [ ] Keine neuen Fehler: `cargo test` grün

### NUL und Überlänge (ADR-0005 N1 Punkt 1)

- [ ] Gegeben ein Ordner mit Board „fabrik“, wenn `POST /api/aufgaben {titel: "a\u0000b", key: "nul-1"}` ankommt, dann antwortet der Server 201, es entsteht genau ein Commit, `git log -1 --format=%s` ist **eine** Zeile **ohne** Steuerzeichen, die Aufgabendatei trägt den Titel `a\u0000b`, und `git status --porcelain` ist leer
- [ ] Gegeben die committete Karte #1 mit `key: nul-1` aus dem vorigen Schritt, wenn derselbe `POST` erneut ankommt, dann antwortet der Server 200 mit `neu: false` und derselben Nummer #1 (heute 200 mit `neu: false` für eine nie committete Karte)
- [ ] Gegeben ein Titel mit 1 000 000 Zeichen, wenn `POST /api/aufgaben {titel: <1 MB>, key: "lang-1"}` ankommt, dann antwortet der Server 201, es entsteht genau ein Commit, die Nachricht ist eine Zeile mit höchstens 120 Zeichen, und die Aufgabendatei trägt den Titel ganz
- [ ] Gegeben ein Feldwert mit NUL, Umbruch, Tabulator oder Unicode-Zeilentrenner, der in eine Commit-Nachricht geht, wenn die Nachricht abgeleitet wird, dann steht statt jedes Steuerzeichens ein Leerzeichen — kein Feld wird deshalb abgewiesen

### Aktion ganz oder gar nicht (ADR-0005 N1 Punkt 2, N2 Punkt 1/2)

- [ ] Gegeben ein scheiternder Commit (ein `pre-commit`-Hook, der `exit 1` liefert, in der Testkopie), wenn `POST /api/aufgaben {titel: "halb", key: "halb-1"}` ankommt, dann antwortet der Server 500, `git status --porcelain` ist leer, `aufgaben/0001-halb.md` existiert nicht, der Stand von `HEAD` ist unverändert, und die Meldung nennt den Pfad `aufgaben/0001-halb.md`
- [ ] Gegeben die Datei von Schritt „Aktion ganz oder gar nicht“ ist nach dem Fehlschlag verschwunden und der Hook entfernt, wenn `POST /api/aufgaben {titel: "halb", key: "halb-1"}` erneut ankommt, dann antwortet der Server 201 mit `neu: true` (nicht 200/`neu: false`)
- [ ] Gegeben eine Datei mit uncommitteter Änderung (vorher schmutziger Pfad), wenn der Commit scheitert, dann hat die Datei den Stand von `HEAD`, und `git status --porcelain` ist leer (die akzeptierte Schwäche ist festgehalten, nicht umgangen)
- [ ] Gegeben ein Pfad, den `HEAD` kennt und der gelöscht wurde, wenn der Commit scheitert, dann ist die Datei wiederhergestellt
- [ ] Gegeben `committen` mit dem Pfad `../x.md`, dann endet der Aufruf mit einem internen Fehler, und Index und Arbeitsbaum bleiben unberührt
- [ ] Gegeben eine Aktion, die denselben Pfad zweimal nennt, dann endet sie mit einem internen Fehler, bevor etwas geschrieben wird

### Meldung und eine Stelle (ADR-0005 N1 Punkt 4, N2 Punkt 4)

- [ ] Gegeben die Rücknahme gelingt, wenn der Fehlschlag gemeldet wird, dann nennt die Meldung die betroffenen Pfade
- [ ] Gegeben die Rücknahme scheitert (eine Datei ließ sich nicht entfernen oder nicht wiederherstellen), dann sagt die Meldung das, statt „zurückgenommen“ zu behaupten
- [ ] Gegeben ein Schreibweg, der eine Commit-Nachricht baut (Titel, Board-Titel, Kommentar-Auszug), wenn er eine Nachricht erzeugt, dann läuft jedes Feld durch die eine Funktion — kein `format!` an ihr vorbei (Review-Punkt `code-reviewer`, ADR-0005 N1 Punkt 4)

## Implementierungshinweise

- **Der Stand liegt schon vor.** Im Worktree `kanbanD-entw1` (Zweig `karte/43`, uncommittet) liegen `src/nachricht.rs` (neu, `wert`/`fertig`), Änderungen in `src/git.rs` (`committen_und_pruefen`, `in_head`, `zuruecknehmen`), in `src/dienst/aufgabe_anlegen.rs`, `board_anlegen.rs`, `board_verwalten.rs`, `kommentare.rs`, in `src/lib.rs` und Tests in `tests/aufgabe_anlegen.rs` und `tests/git.rs`. Dieser Stand ist zu **übernehmen** und um die drei Anpassungen aus ADR-0005 N2 zu ergänzen:
  - **(a) `pfade_pruefen` in `committen`** vor `git add` und vor jedem Zugriff der Rücknahme (`ablage::pfade_pruefen`), weil `anhaenge.rs:66/87` und `fieber.rs:115` nicht durch `aktion()` gehen.
  - **(b) Der Fehlschlag der Rücknahme steht in der Meldung**, nicht nur auf `stderr`: die Meldung sagt „zurückgenommen“ nur, wenn es stimmt (heute `eprintln!("Rücknahme: …")` im Bauversuch).
  - **(c) zwei Proben ergänzen:** vorher schmutziger Pfad (akzeptierte Schwäche, N2) und `../`-Pfad (Pfadprüfung in `committen`).
- Die Nachricht ist abgeleiteter Text: Ableitung in `committen` **und** an den Schreibwegen (Titel, Board-Titel, Kommentar-Auszug) über dieselbe Funktion (N1 Punkt 4). Länge und Wortlaut sind Sache des Entwicklers (N1 „Grenze“).
- `git reset`/`git checkout` in der Rücknahme fassen **nur** die Pfade der Aktion an; fremde Änderungen im Arbeitsbaum oder Index bleiben unberührt (Vorgabe von `committen`). Ein Review-Punkt (`code-reviewer`) ist eine Rücknahme, die einen Pfad außerhalb von `pfade` anfasst, und eine Meldung, die „zurückgenommen“ ohne Prüfung behauptet.
- Ob eine gescheiterte Aktion zusätzlich protokolliert wird, regelt ADR-0001; nicht Teil dieser Anforderung.

## Offene Fragen

- Keine an den Auftraggeber. Die Technikfrage ist mit ADR-0005 N1 und N2 entschieden; die drei Anpassungen (a)–(c) sind der Architektur-Vorprüfung entnommen.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine: der Fix ändert keine Oberfläche, nur den Server (Commit-Nachricht, Rücknahme, Fehlermeldung).

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die Befundkarte #43 (Entwickler- und Security-Review #4): Ein Titel mit NUL-Byte oder 1 MB lässt `POST /api/aufgaben` mit `500` scheitern, nachdem die Datei geschrieben und vorgemerkt ist; ein zweiter `POST` mit demselben `key` meldet `200`/`neu: false` für eine Karte, die in keiner Git-Historie steht. Ursache ist der Bruch in der Zusage „jede Aktion ergibt einen Commit“: die Commit-Nachricht geht roh aus dem Titel an Git (X), und scheitert der Commit, nimmt niemand den halben Zustand zurück (Y). Wird die Nachricht abgeleitet und die Nachricht an einer Stelle gebaut, kann kein Feld Git mehr zum Scheitern bringen; nimmt `committen` seine Pfade im Fehlerfall auf den Stand von HEAD zurück und prüft seine Pfade, bleibt von einer gescheiterten Aktion nichts liegen (Z): der Ordner ist wie vor der Aktion, `git status` ist leer, und derselbe `key` legt danach **neu** an, statt eine uncommittete Karte zu melden. Der Hebel sitzt in `committen`, nicht im Anlegeweg: die Nachricht entsteht an mehreren Schreibwegen, der halbe Zustand an jeder `aktion()`, und die Rücknahme in `committen` schließt auch die direkten Aufrufer (`anhaenge`, `fieber`) ein, die nicht durch `aktion()` gehen (ADR-0005 N1/N2).

## Notizen

- **Optionen-Tableau**: A (ADR-0005 N1/N2 wörtlich) gewählt; B (nur die Nachricht kürzen), C (Titel am Eingang abweisen), D (temporärer Arbeitsbaum) verworfen — je ein Satz unter „Alternative Ansätze“.
- **Priorität**: Hoch — eine Datei ohne Commit unterläuft „Git ist das Gedächtnis“ und lässt `key`/`neu: false` lügen.
- **Betroffene Nutzer/Systeme**: jeder Schreibweg über die API und die Oberfläche, der eine Commit-Nachricht aus einem Feld baut (Anlegen, Board anlegen/umbenennen/archivieren/löschen, Kommentar); mittelbar jeder Agent, der idempotent mit `key` arbeitet (R00098).
- **Workaround**: den Titel ohne Steuerzeichen und kurz halten; eine liegen gebliebene Datei von Hand committen oder entfernen.
- **Nicht Umfang**: die Protokollierung einer gescheiterten Aktion (ADR-0001); die Länge und der Wortlaut der gekürzten Nachricht im Einzelnen (Sache des Entwicklers, N1 „Grenze“); der Schlüssel-Filter (R00132/R00098) — berührt, aber unverändert.
- **Herkunft**: Karte #43 „Titel mit NUL oder Überlänge lässt Karte uncommittet liegen“ (Entwickler- und Security-Review #4, vorbestehend); `ursprungslauf: R00005` (der Anlegeweg, in dem die Nachricht entsteht). Architektur: ADR-0005 Nachträge N1 (`2026-11-13`) und N2 (`2026-11-14`, `a2108ff`) sind die Vorgabe; der uncommittete Bauversuch Zweig `karte/43` liegt im Worktree `kanbanD-entw1`.
- **WBS-Heimat (Detailplanung 2026-11-14)**: eigene Interaction **I0136** unter D0002, 6 Bubbles B0691–B0696 (kein Feature: ein Aspekt — „eine Aktion ist ganz oder gar nicht und die Nachricht ist abgeleitet“), B0691 ist die Abnahme-Probe (heute rot). Vorgänger I0134/R00147 (nur Bubbles, kein Feature).
