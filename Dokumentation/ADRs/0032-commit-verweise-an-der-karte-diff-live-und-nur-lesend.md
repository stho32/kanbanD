# ADR-0032: Commit-Verweise an der Karte — Schlüssel `commits` mit `<kürzel>:<voller Hash>`, Diff live und nur lesend aus dem Arbeits-Repository des Registers, Gesamt-Diff dateiweise ohne fremde Änderungen

**Status**: Akzeptiert (Punkte 1–9; Punkt 5 Zustände, Punkt 6 Zulassung, Punkt 7.1 und Punkt 9 Liste geändert durch Nachtrag N1); Punkt 10 „Vorausschau #208–#210“ Vorgeschlagen; Nachtrag N1 (2026-11-19) Akzeptiert, darin N1.7 Vorgeschlagen; Nachtrag N2 (2026-11-19) Akzeptiert, darin N2.5 nur Folgerung; Nachtrag N3 (2026-11-19) Akzeptiert (Gesamtgrenze und Cache beim Lesen, Lücken in N1.2, Rückfall zu N1.3)
**Datum**: 2026-11-19
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #207, Lauf 207-architekt-1)
**Kontext-Anforderung**: — (Karte #207 „Commits an der Karte und Review-Diff direkt aus dem Board“, Teil A; Anforderung und WBS-Knoten folgen über den planer). Bezug: Karten #208–#210, po-entscheidungen Z. 358–383, R00053, ADR-0003, ADR-0008, ADR-0021, ADR-0028, ADR-0030, ADR-0031
**Erprobt durch**: — (am Code gelesen, nicht gefahren; getragen von der bestehenden Systemantwort für unbekannte Schlüssel der Aufgabendatei und vom Vorbild ADR-0028; Größen der Hervorheber gemessen, siehe Punkt 10). Nachtrag N2 ergänzt: Legacy-Probe gegen die gebaute Vorversion (main ae04fcfd) mit 0, 1, 2, 5 und 30 Einträgen; Schreibweise durch den Test `commits_hinter_cost_entries_in_der_schreibweise_der_vorversion`; Umgebung und Sperren durch die Tests `umgebung_und_sperren_des_startorts` und `repository_konfiguration_fuehrt_nichts_aus` in `src/git/arbeitsrepo.rs`

## Kontext

- **Betreiber 2026-11-19** (po-entscheidungen Z. 381): Commits nur als **Verweis** (Kürzel der Anwendung + Hash von `main`), den Diff liest kanbanD **live**; die Factory hinterlegt erst nach dem Zusammenführen; ein verschwundener Commit wird sichtbar markiert. *(„erst nach dem Zusammenführen“ und „Hash von `main`“ abgelöst durch Nachtrag N1, Betreiber 2026-11-19)*
- **Vision**: Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110–113); Nicht-Ziel „Kein Git-Client … Im Arbeits-Repository liest kanbanD Commits nur“ (Z. 194–200); Leitplanken „Board-Repository und Arbeits-Repository sind getrennt“, „Git-freundliche Form“, „Ein Commit je Aktion“, „Full-Trust“.
- **PO entschieden** (Z. 365–370): Register statt Pfad, Wurzel aus dem WBS-Pfad „kein neues Feld“, Hash 7–40 Hex zum vollen aufgelöst, nur lesende Git-Befehle mit getrennten Argumenten, beim Hinterlegen Existenz prüfen (sonst 400); Gesamtansicht zeigt nie fremde Änderungen; Form im Frontmatter oben, endgültig im ADR.
- **Belegt (Code)**:
  - Unbekannte Schlüssel oben im Frontmatter der Aufgabe überstehen jedes Schreiben (`weitere`, `src/format/aufgabe.rs`, Test `handgeschriebene_datei_ohne_id_mit_sekunden_und_unbekanntem_schluessel` :667) — ältere Versionen tragen einen neuen Schlüssel mit (ADR-0028 Option B).
  - Register: `Anwendung { kuerzel, name, wbs, anforderungen }` (`src/modell/einstellungen.rs:40`), Standardanwendung mit leerem Kürzel (`src/modell/anwendungen.rs:44`), `kuerzel_gueltig` 1–8 Zeichen `[a-z0-9]` (`einstellungen.rs:77`). Das Register ändert `PUT /api/einstellungen` (Mensch oder Agent, ein Commit).
  - `src/git.rs` startet Git heute nur im Board-Repository, immer als `Command::new("git")` mit Argumentliste, ohne Shell (`:8`, `:215`, `:289`).
  - `/api/zustand` und `GET /api/aufgaben/{nr}` fallen unter das Lastprofil „lesend p95 < 200 ms bei 5.000 Aufgaben“ (`AI-Team/factory.md` „Lastprofil“).
  - Die Factory rebased jeden Kartenzweig und führt mit `--ff-only` zusammen (po-entscheidungen Z. 360) — die Commits einer Karte liegen auf `main` meist zusammenhängend; Nacharbeit oder `[DOC]`-Commits können später dazwischen liegen.

## Optionen

### Gesamt-Diff aus nicht zusammenhängenden Commits

- **G1 — Spanne `erster^..letzter`**: ein Git-Aufruf, genau GitHubs „Files changed“. Schwäche: zeigt jeden fremden Commit dazwischen als Kartenarbeit — vom PO ausgeschlossen.
- **G2 — Patches der Karte in einem temporären Index nacheinander anwenden** (`read-tree` + `apply --cached` + `write-tree`, dann `diff-tree`): echter Netto-Diff auch über Lücken. Schwäche: schreibt Objekte in das Arbeits-Repository (verletzt „nur lesend“), scheitert bei Konflikten, viele Prozesse.
- **G3 — dateiweise** (gewählt): je Datei entscheiden — hat zwischen Vorgänger des ersten und dem letzten Kartencommit **kein fremder Commit** die Datei berührt, ist `git diff basis letzter -- <datei>` rein Kartenarbeit (Netto); sonst zeigt die Datei die Änderungen der Kartencommits **einzeln nacheinander** mit Hinweis. Stärke: nur lesende Befehle, keine Konflikte, der häufige Fall (zusammenhängend) ist ganz netto. Schwäche: eine Datei, an der fremd und Karte abwechselnd arbeiteten, erscheint als Folge statt als Summe.
- **G4 — immer Folge je Commit**: am einfachsten, nie fremd. Schwäche: kein Gesamtbild, gerade das verlangt der Betreiber („alle Änderungen der Karte als ein gemeinsames Diff“).

### Antwortform des Diffs

- **F1 — rohe Patch-Ausgabe von Git**: Agenten lesen sie gewohnt. Schwäche: die Oberfläche müsste Dateigrenzen aus Kopfzeilen parsen (Pfade mit Leerzeichen, Anführungszeichen), Grenzen ließen sich nicht je Datei setzen.
- **F2 — JSON je Datei mit Patch-Text** (gewählt): Dateiliste aus `--raw -z`/`--numstat -z` (Pfade robust), je Datei Kopf, Zähler, Merkmale und ihr Patch-Text; die Oberfläche zerlegt nur Hunks. Rohform zusätzlich über `?format=patch` für Agenten. Schwäche: zwei Formen.
- **F3 — vollständig strukturiert (Hunks und Zeilen als Objekte)**: bequemer im Browser. Schwäche: etwa das Dreifache an Bytes, für Agenten unhandlich.

## Entscheidung

**Gewählt: G3 und F2.** Akzeptierte Schwäche: eine von fremden Commits mitberührte Datei zeigt die Kartenänderungen als Folge statt als Netto-Summe; es gibt zwei Antwortformen.

1. **Form in der Aufgabendatei** — Schlüssel `commits` oben im Frontmatter, hinter `cost-entries`, Blockliste, je Eintrag eine Zeile, Reihenfolge des Hinterlegens:
   ```yaml
   commits:
     - kd:3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e
     - 9c6b91f5d0e3a2b1c4d5e6f7a8b9c0d1e2f3a4b5
   ```
   - Mit Kürzel `<kürzel>:<voller Hash>`; ohne Kürzel nur für die **Standardanwendung** (leeres Kürzel, `Herkunftsschluessel::qualifiziert`). Gespeichert wird immer der volle Hash (40 Hex, in SHA-256-Repositories 64), kleingeschrieben. Geschrieben wird über den vorhandenen Skalar-Helfer (Lehre #142), damit ein Hash aus lauter Ziffern nicht als Zahl zurückgelesen wird.
   - Titel, Autor, Datum, Zähler werden **nie gespeichert**, sondern gelesen.
   - **Legacy**: ältere Versionen tragen `commits` als unbekannten Schlüssel mit (belegt, siehe Kontext); sie zeigen ihn nicht. Durchsetzung: Format-Test Rundlauf zeichengleich.
   - Ein Eintrag, der die Form verletzt (Handbearbeitung), macht die Aufgabe **nicht** defekt: er bleibt wörtlich stehen und erscheint mit Zustand `unlesbar`. Schutzwert: höchstens 500 Einträge je Aufgabe.
   - Ohne Kürzel heißt immer Standardanwendung. Gibt es keine, ist der Zustand `anwendung_unbekannt` — nie geraten. Bewusst strenger als `Anwendungen::aufloesen` bei Herkünften: ein später registriertes zweites Repository macht alte Verweise nicht mehrdeutig.
   - Duplizieren nimmt `commits` nicht mit (wie `cost-entries`).

2. **Repository-Wurzel aus dem Register**, kein neues Feld: Startordner ist der Ordner der WBS-Datei, ohne WBS-Pfad der Anforderungsordner; Wurzel = `git -C <startordner> rev-parse --show-toplevel`. Fehlt der Ordner, ist er kein Repository oder verweigert Git ihn (`safe.directory`), gilt der Zustand `repository_fehlt` mit Grund. Kein Zwischenspeicher: je Anfrage neu ermittelt (wenige Millisekunden), damit ein geändertes Register sofort gilt.

3. **Sicherheitsgrenze**:
   - Eine Anfrage nennt **nie einen Pfad**, nur Verweise (`<kürzel>:<hex>`). Kürzel nach `kuerzel_gueltig` und registriert; Hash `^[0-9a-f]{7,64}$` (Großbuchstaben werden kleingeschrieben).
   - **Nur Verweise der Karte**: Diff-Anfragen gelten nur für Verweise, die an der Aufgabe stehen (sonst 404). Die API ist damit kein allgemeiner Lesezugang zum Repository.
   - **Nur lesende Git-Befehle**, abschließende Liste: `rev-parse`, `cat-file`, `log`, `rev-list`, `diff`, `diff-tree`, `merge-base`, `for-each-ref`. Immer mit Argumentliste, ohne Shell, mit `--end-of-options` vor jedem Verweis. Dazu `--no-ext-diff --no-textconv --no-color` und `-c core.quotepath=off`. Umgebung `GIT_OPTIONAL_LOCKS=0`, `GIT_TERMINAL_PROMPT=0`. So führen Konfiguration und `.gitattributes` des Arbeits-Repositorys keine Programme aus (externe Diff-Treiber, textconv).
   - Ein Modul ist der einzige Ort, der Git in Arbeits-Repositories startet (Arbeitsname `src/git/arbeitsrepo.rs`, getrennt von `git::committen`). Es kennt kein `add`, `commit`, `checkout`, `fetch`, `gc` und schreibt nie Objekte.
   - Zeitgrenze je Git-Prozess 10 s, danach wird der Prozess beendet → 503 `{fehler}`.
   - **Inkauf (Full-Trust)**: wer das Register ändern darf (`PUT /api/einstellungen`, auch ein Agent), kann jedes Git-Repository des Rechners registrieren und dessen Commits lesen. Das ist dieselbe Grenze, die schon das Schreiben der WBS an registrierten Pfaden hat. Die Änderung ist ein sichtbarer Commit im Board-Repository.

4. **Hinterlegen und Entfernen** *(ergänzt um „ersetzen“ durch N1.4)* (Schreibweg `gesperrt()` → Prüfung → `aktion()`, ein Commit je Aufruf, wie Zeit- und Kosteneinträge):
   - `POST /api/aufgaben/{nr}/commits` mit `{commits: ["kd:3f2a9c1", …]}` — **alles oder nichts**. Je Eintrag: Form, Kürzel registriert, Repository erreichbar, `rev-parse --verify --quiet --end-of-options <h>^{commit}` liefert genau einen Commit. Fehler → 400 `{fehler, verweis}`, nichts geschrieben; ein mehrdeutiger Kurz-Hash ist ebenfalls 400. Kurz-Hashes werden vor dem Schreiben zum vollen Hash aufgelöst.
   - Schon vorhandene Verweise werden übersprungen. Ist nichts neu: 200 ohne Commit (idempotent für Wiederholungen der Factory).
   - Die Git-Prüfung läuft **vor** dem Sperren des Board-Ordners, das Schreiben danach; die Sperre wartet nie auf Git im Arbeits-Repository.
   - `DELETE /api/aufgaben/{nr}/commits/{verweis}` — voller Hash oder an dieser Karte eindeutiger Präfix ≥ 7; unbekannt → 404. Entfernen prüft das Repository nicht, damit sich auch verschwundene Verweise entfernen lassen.
   - Mensch und Agent über `X-KanbanD-Wer`; keine Spaltenregel, keine neue Zugriffsgrenze. Fehler nach ADR-0003 (`fehler` zuerst), nie 422.
   - `GET /api/aufgaben/{nr}` und `/api/zustand` liefern nur die **gespeicherten Verweise** (`commits: [Text]`), **ohne Git-Aufruf** (Lastprofil).

5. **Lesen** — `GET /api/aufgaben/{nr}/commits`: je Verweis `{verweis, anwendung, hash, zustand, titel?, autor?, datum?, plus?, minus?, dateien?}`. Je Repository höchstens drei Git-Aufrufe: `cat-file --batch-check`, dann `log --no-walk --format … --shortstat`, dann die Prüfung auf Erreichbarkeit. Sortiert nach Commit-Datum; Verweise ohne Metadaten folgen in der Reihenfolge des Hinterlegens.
   - **Zustände** *(abgelöst durch N1.2)*: `vorhanden`; `nicht_auf_zweig` (das Objekt gibt es, aber kein Zweig und kein Remote-Zweig erreicht es — typisch ein Hash vom Kartenzweig vor dem Rebase); `fehlt`; `repository_fehlt`; `anwendung_unbekannt`; `unlesbar`.
   - Nichts wird automatisch entfernt. Die Oberfläche zeigt jeden Zustand außer `vorhanden` sichtbar.

6. **Diff je Commit** — `GET /api/aufgaben/{nr}/diff?commit=<verweis>`:
   - `git diff <eltern> <hash>` gegen den **ersten Elternteil**. Bei einem Merge-Commit ist das, was der Merge auf die Hauptlinie brachte; beim Wurzel-Commit wird gegen den leeren Baum verglichen.
   - Antwort F2: `{anwendung, commits: [...], dateien: [{alt, neu, status: A|M|D|R|T, aehnlichkeit?, plus, minus, binaer, gross, nachladen, nicht_utf8, patch?}], hinweise: []}`; `?format=patch` liefert dieselbe Auswahl als `text/x-diff`.
   - Dateiliste und Zähler kommen aus `--raw --numstat -z` (Pfade mit beliebigen Zeichen). Den Patch-Text ordnet das Modul in derselben Reihenfolge zu, nicht über das Parsen der Kopfzeilen.
   - Ein Verweis mit Zustand ≠ `vorhanden`/`nicht_auf_zweig` → 404 `{fehler, zustand}`. *(nach N1.2: ≠ `auf_zweig`/`verwaist`)*

7. **Gesamt-Diff der Karte** — `GET /api/aufgaben/{nr}/diff` (G3), je Anwendung getrennt:
   1. Einbezogen werden die Kartencommits im Zustand `vorhanden`. Ausgelassene (`nicht_auf_zweig`, `fehlt` …) stehen in `hinweise`. *(nach N1.5: `auf_zweig` einbezogen, `verwaist` ausgelassen)*
   2. Ordnen: `letzter` ist der Commit, von dem alle anderen Vorfahren sind (`merge-base --is-ancestor`); `basis` = erster Elternteil des ältesten. Gibt es keinen solchen `letzten`, oder liegt ein Kartencommit nicht auf der Erst-Eltern-Linie von `letzter` nach `basis`, wird die ganze Anwendung als **Folge** gezeigt: jeder Commit einzeln, Hinweis „Commits liegen nicht auf einer Linie“.
   3. `git log --first-parent --format=%H --name-only -M basis..letzter` (ein Aufruf) teilt die Commits der Spanne in Karte und fremd; daraus folgen die Dateimengen `D_karte` und `D_fremd`.
   4. Dateien in `D_karte \ D_fremd` → **netto** `git diff -M basis letzter -- <dateien>`. Dateien in `D_karte ∩ D_fremd` → **Folge**: je Kartencommit, der die Datei ändert, sein Patch dieser Datei, mit Hinweis „zwischen den Commits der Karte hat ein fremder Commit diese Datei geändert“.
   5. Sind es über 1.000 fremde Commits in der Spanne, wird die Anwendung als Folge gezeigt, mit Hinweis.
   - Ohne Lücke ergibt das genau den Netto-Diff `basis..letzter`. Fremder Code erscheint nie, auch nicht still.

8. **Grenzen** (Startwerte als Konstanten im Modul; nie still gekürzt, jede Grenze ist ein sichtbares Merkmal):
   - **Datei**: Patch über 256 KB oder 3.000 Zeilen → `gross: true`, ohne Patch, nachladbar über `&datei=<neuer Pfad>`. Eine einzeln geladene Datei bis 20 MB; darüber nur Zähler, Hinweis „zu groß zum Anzeigen“.
   - **Antwort**: Summe der Patches über 4 MB → folgende Dateien `nachladen: true`. Die Dateiliste bleibt vollständig.
   - **Binärdateien** (`-\t-` in `numstat`): nur benannt, `binaer: true`, nie Inhalt.
   - **Umbenennungen**: `-M` mit Git-Standard (50 %), `status R`, `aehnlichkeit`; keine Kopie-Erkennung.
   - **Sonstiges**: Modusänderungen und Submodule (`--submodule=short`) als Kopfangabe. Nicht-UTF-8 wird ersatzweise dekodiert und `nicht_utf8: true` gesetzt.

9. **Lastprofil**:
   - `/api/zustand` und `GET /api/aufgaben/{nr}` bleiben ohne Git-Aufruf.
   - Liste der Commits: p95 < 200 ms bei 30 Verweisen in einem Repository. *(Weg dahin nach N1.3)*
   - Diff auf Klick, nicht im Lastprofil; Ziel p95 < 500 ms für einen Commit bis 1 MB Patch, < 2 s für den Gesamt-Diff von 30 Commits.
   - Git läuft im Blocking-Pool **ohne** die Sperre des Board-Ordners: Schreiben (p95 < 500 ms) wartet nie auf einen Diff.
   - Ein Diff zu einem vollen Hash ändert sich nie → `ETag` aus den beteiligten Hashes, 304 bei Wiederholung. Kein Cache auf Platte.

10. **Vorausschau #208–#210** (Vorgeschlagen — einzuordnen, damit nichts das Modell sprengt; entschieden wird an den Karten):
    - **Ablage**: `<ordner>/transkripte/<nr>/<datei>.jsonl.gz`. Darin legt kanbanD einmal `transkripte/.gitignore` mit dem Inhalt `*` an: selbst-ignorierend wie bei `venv` und `.pytest_cache`, kein Commit, die `.gitignore` des Menschen bleibt unberührt. Nicht im Anhang-Ordner, denn der ist versioniert, wird von `anhaenge()` gelistet und ändert beim Umbenennen den Slug.
      - Der Dateiname kommt aus der Kennung `role@at` ohne `:` (Windows), z. B. `entwickler@2026-11-13T1034+0100`.
      - Endgültiges Löschen einer Aufgabe (ADR-0024) löscht ihren Transkript-Ordner mit.
    - **gzip ohne Abhängigkeit**: Der Server prüft beim Hochladen nur die Kennbytes `1f 8b 08` und die Größe (≤ 10 MB) und entpackt nicht.
      - Ausgeliefert wird `application/gzip` **ohne** `Content-Encoding`; der Browser entpackt mit `DecompressionStream('gzip')`. Ein defekter Inhalt wird so eine abfangbare Fehlerzeile.
      - Mit `Content-Encoding: gzip` bräche `fetch` bei defektem Inhalt als Netzwerkfehler ab, also nicht so (Abweichung von po-entscheidungen Z. 375).
    - **Schalter** `transcripts: an|aus` im Board-Frontmatter wie `classes` (ADR-0031). Der Board-Schreiber kennt nur benannte Schlüssel (ADR-0031 Z. 20): eine ältere Version lässt ihn beim Schreiben weg, das Board fällt auf die Vorgabe des Ordners zurück, ohne Vorgabe auf „aus“. Das ist die sichere Richtung.
      - Abweisung bei „aus“: **409** `{fehler, erfassung: "aus", boards}`. Es ist ein Zustand des Boards, keine Berechtigung; 403 bleibt für „ein Agent schaltet um“ (ADR-0006).
    - **Syntax-Hervorhebung** (#209), Kandidaten am 2026-11-19 über `npm pack` gemessen:

      | Kandidat | Lizenz | Größe min / gzip | Bauart | Urteil |
      |---|---|---|---|---|
      | Prism 1.30.0 (Kern + clike, markup, css, javascript, rust, php, markup-templating, python, bash, yaml, markdown, json, sql, csharp, toml, diff) | MIT | 53,5 KB / 19,0 KB | `Prism.tokenize(text, grammatik)` liefert Tokens; DOM per `textContent`, kein `innerHTML` (Geist ADR-0030); `Prism.manual = true` | **Empfehlung** |
      | highlight.js 11.12.0 (`highlight.min.js`, Standardbündel) | BSD-3-Clause | 129 KB / 43 KB (14 Einzelsprachen weitere 56 KB min) | liefert HTML-Text, Zeilenzerlegung über Span-Grenzen nötig | verworfen: größer, HTML-Text statt Tokens |
      | eigener schmaler Hervorheber | – | ~ 8–12 KB | Regex-Tabelle je Sprache, zeilenweise mit Zustand | verworfen: Qualität und Pflege je Sprache |
      | Shiki, CodeMirror, Monaco | MIT | MB-Bereich bzw. WASM | | verworfen: zu groß |

      Eine vorab gebaute Datei `web/vendor/prism.js` mit `LICENSE-prism.txt` daneben, eingebettet wie die Schriften (`src/web/statisch.rs`), ohne Build-Schritt. Hervorgehoben wird je Hunk und Seite (alt: Kontext + entfernt, neu: Kontext + hinzugefügt); die Tokens werden an `\n` in Zeilen geteilt. Inkauf: beginnt ein Hunk mitten in einem Blockkommentar, ist die Färbung bis zu dessen Ende falsch. Sprache nach Dateiendung, unbekannt → ohne Farbe.

## Konsequenzen

**Positiv:**
- Kein Code wandert ins Board-Repository.
- Die Factory kann gleich nach A1 hinterlegen, Daten sammeln sich vor der Ansicht.
- Ältere Versionen lesen und schreiben die Datei verlustfrei.
- Das Arbeits-Repository wird nie verändert, auch nicht um Objekte.
- Fremder Code erscheint nie als Kartenarbeit.

**Negativ / Inkauf:**
- Gemischt berührte Dateien erscheinen als Folge.
- Ein Repository, das auf diesem Rechner fehlt, zeigt nur Verweise.
- Ein Commit, den `git gc` nach einem Rebase entfernt, wechselt von `nicht_auf_zweig` auf `fehlt`. *(nach N1: von `verwaist` auf `fehlt`)*
- Das Register ist die Lesegrenze, und es ändern auch Agenten.
- Ältere Versionen kennen die Routen nicht (404).

**Durchsetzung:**
- Format-Test: Datei mit `commits` (mit und ohne Kürzel, ein unlesbarer Eintrag, ein Hash aus lauter Ziffern) übersteht Lesen und Schreiben zeichengleich, die Aufgabe ist nicht defekt.
- API-Test: unbekannter Hash, mehrdeutiger Kurz-Hash, unbekanntes Kürzel, Pfad statt Hash (`kd:../x`, `kd:--output=x`) → 400, Zahl der Commits im Board-Repository gleich; Diff zu einem Hash, der nicht an der Karte steht → 404.
- **Gesamt-Diff-Probe** (Wegwerf-Repository im Test): Karte K1, fremd F, Karte K2.
  - F ändert eine andere Datei: Netto für die Kartendateien, F unsichtbar.
  - F ändert dieselbe Datei: sie erscheint als Folge K1, K2 mit Hinweis, F-Zeilen nirgends.
  - Ohne F: Ergebnis bytegleich zu `git diff K1^ K2`.
- **Nur lesend**: Im Wegwerf-Repository sind `diff.external` und ein `textconv`-Treiber gesetzt, die eine Markerdatei schreiben würden. Nach allen Lese-Aufrufen fehlt die Markerdatei, und `git count-objects -v` sowie `git status --porcelain` sind unverändert.
- Mutationsprobe: Entfernen von `--no-ext-diff` oder `--no-textconv` macht die Probe rot.
- Review-Punkt für `security-reviewer` und `architektur-reviewer`: neue Git-Aufrufe in Arbeits-Repositories nur im einen Modul, nur aus der Liste in Punkt 3.

**Folgeentscheidungen / Aufgaben:**
- [ ] ~~Factory hinterlegt die Commits nach dem Zusammenführen mit Hashes von `main`~~ — abgelöst durch N1.8 (hinterlegen während der Arbeit, ersetzen nach jedem Rebase).
- [ ] #209: Sondierung Prism (Zeilenzerlegung, hell/dunkel, Lizenzdatei) vor dem Bau der Hervorhebung.
- [ ] #208/#210: Punkt 10 an den Karten bestätigen oder ablösen.
- [ ] E1 neu nach N1.8: Factory hinterlegt während der Arbeit und ersetzt nach jedem Rebase (`/factory lehren`).
- [ ] Scheibe A5 (eigene Karte): Nachfolgervorschlag über `patch-id` nach N1.7.

## Nachtrag 2026-11-19 N1: Hinterlegen während der Arbeit, Erreichbarkeit gegen alle Zweige, „ersetzen alt → neu“ (Karte #207)

**Anlass**: Betreiber-Entscheidung 2026-11-19 (po-entscheidungen, letzte Zeile, präzisiert Z. 381). Commits einer Karte liegen während der Arbeit auf einem Kartenzweig in einem Worktree. Nach Rebase und Merge liegen sie mit neuen Hashes auf dem Zielzweig (meist, aber nicht immer `main`), und der Quellzweig entfällt. Entschieden: (1) Hinterlegen schon während der Arbeit; (2) Erreichbarkeit gegen alle Zweige, der Zustand nennt den Zweig, ein Commit auf keinem Zweig heißt „verwaist“; (3) eine API „ersetze alt → neu“, eine Aktion, ein Commit; (4) ein Nachfolgervorschlag über `patch-id` als eigene spätere Karte. Punkte 1–4 und 8 oben bleiben unverändert, Punkt 5, 6, 7.1 und 9 werden hier geändert (im Text oben markiert).

**Belegt (gefahren 2026-11-19, kanbanD `5c108a05`, Git 2.48.1, Last 1,4)**:
- Worktrees: `git -C …/.worktrees/kanbanD/karte-207 rev-parse --git-common-dir` → `/home/shoff/Projekte/kanbanD/.git`; `--git-dir` → `…/.git/worktrees/karte-207`. Objektdatenbank und `refs/heads/*` sind gemeinsam; ein Commit im Worktree ist sofort aus dem Hauptrepo lesbar, sein Zweig steht in `for-each-ref refs/heads`. Eigen je Worktree sind nur `HEAD` und `refs/worktree/*`.
- Kosten (2.540 Commits, 16 Zweige: 6 lokal, 10 entfernt, mit `commit-graph`): `for-each-ref --contains <h> refs/heads refs/remotes` je Commit ≈ 11 ms → 30 Commits nacheinander 323 ms (verfehlt die 200 ms), mit 4 parallelen Prozessen 90 ms, ohne `commit-graph` (`-c core.commitGraph=false`) 112 ms. Der Fingerabdruck aller Zweigspitzen (`for-each-ref --format='%(objectname) %(refname)'`) kostet 2 ms.
- Factory: `_rebase` (`werkzeuge/board.py:729`) prüft, dass die Commit-Titel von `main..<zweig>` vor und nach dem Rebase gleich sind (Zahl und Reihenfolge); gerebased wird in `wache_vorbereiten` (:762) **und** in `dokumente` (:741, frühe Übernahme von Dokumenten).

### N1.1 Hinterlegen während der Arbeit

Die API aus Punkt 4 ändert sich nicht: `POST …/commits` prüft nur, dass das Objekt ein Commit ist, nicht, auf welchem Zweig es liegt. Ein Hash vom Kartenzweig ist gültig.

### N1.2 Zustandsmodell (ersetzt die Zustände in Punkt 5)

| Zustand | Bedeutung | Felder |
|---|---|---|
| `auf_zweig` | mindestens ein lokaler oder entfernter Zweig erreicht den Commit | `zweige: [Text]` (lokal, ohne `refs/heads/`), `entfernte_zweige: [Text]` (ohne `refs/remotes/`, ohne `*/HEAD`), je höchstens 10, Rest als `zweige_weitere: n` |
| `verwaist` | das Objekt gibt es, kein Zweig erreicht es (typisch: Hash vor einem Rebase oder Squash; Commit auf losgelöstem `HEAD` eines Worktrees) | Titel, Autor, Datum wie sonst |
| `fehlt` | das Objekt gibt es nicht (mehr) | – |
| `repository_fehlt`, `anwendung_unbekannt`, `unlesbar` | unverändert nach Punkt 2 und 1 | – |

- `vorhanden` und `nicht_auf_zweig` gibt es nicht mehr. Die Zustände werden nie gespeichert, also gibt es keine Migration.
- **Entfernte Zweige zählen mit**, getrennt benannt. Grund: ein gepushter Commit, dessen lokaler Zweig gelöscht ist, ist nicht verwaist, und `git gc` entfernt ihn nicht. Inkauf: ein veralteter entfernter Zweig (ohne `fetch --prune`) hält einen Hash vor dem Rebase als `auf_zweig origin/karte/…`; das ist sichtbar, weil der Name dasteht. kanbanD holt nie selbst (`fetch` bleibt verboten, Punkt 3).
- Tags zählen nicht als Zweig.
- `/api/zustand` und `GET /api/aufgaben/{nr}` bleiben ohne Git-Aufruf (Punkt 9).

### N1.3 Kosten der Zweigliste (ändert Punkt 5 „höchstens drei Git-Aufrufe“)

Optionen:
- **Z1 — `for-each-ref --contains` je Commit, höchstens 4 parallel, flüchtiger Cache** (gewählt). Stärke: genaue Zweigliste, gemessen 90 ms kalt für 30 Verweise. Schwäche: ein Prozess je Commit, wenn der Cache kalt ist.
- **Z2 — ein Lauf `rev-list <spitze>` je Zweig, Mengenabgleich im Modul**. Stärke: ein Prozess je Zweig, unabhängig von der Zahl der Verweise. Schwäche: jeder Lauf geht durch die ganze Geschichte; bei vielen entfernten Zweigen und großer Geschichte teurer als Z1.
- **Z3 — nur „auf irgendeinem Zweig ja/nein“** über einen Lauf `rev-list --branches --remotes` (18 ms). Stärke: ein Prozess. Schwäche: nennt den Zweig nicht, das verlangt der Betreiber.

Ablauf je Repository: `cat-file --batch-check`, `log --no-walk …`, `for-each-ref --format='%(objectname) %(refname)' refs/heads refs/remotes` (Fingerabdruck), dann für jeden Commit ohne Cache-Treffer `for-each-ref --format='%(refname)' --contains <h> refs/heads refs/remotes`, höchstens 4 gleichzeitig.
- **Cache nur flüchtig** (Leitplanke: ein Cache darf, er wird nicht versioniert): im Speicher des Prozesses, Schlüssel (Wurzel, SHA-256 des Fingerabdrucks, Hash) → Zweige. Erreichbarkeit hängt nur von den Zweigspitzen ab, die Invalidierung ist also genau: bewegt sich ein Zweig, ändert sich der Fingerabdruck. Höchstens 10.000 Einträge, bei Überlauf wird geleert. Nie auf Platte, nie im Board-Ordner.
- Lastprofil unverändert: Liste p95 < 200 ms bei 30 Verweisen, **auch kalt**. Annahme, die A2 prüft: ein Repository mit ~20.000 Commits und ~50 Zweigen ohne `commit-graph` hält das. kanbanD schreibt nie einen `commit-graph` (nur lesend). Hält es nicht: Zweigliste kappen und Z3 als Vorstufe, nicht still.

### N1.4 Ersetzen (neu in Punkt 4)

`POST /api/aufgaben/{nr}/commits/ersetzen` mit `{ersetzungen: [{alt: "kd:3f2a9c1", neu: "kd:8e20ad9"}, …]}`. Schreibweg wie Punkt 4, ein Commit für alle Paare, **alles oder nichts**.
- `alt`: Verweis an **dieser Karte**, voller Hash oder an der Karte eindeutiger Präfix ≥ 7 (wie `DELETE`). Geprüft wird nur gegen die Karte, nie gegen das Repository; ein `fehlt` oder `verwaist` lässt sich also ersetzen.
- `neu`: Prüfung wie beim Hinterlegen (Form, Kürzel registriert, `rev-parse … ^{commit}`, Kurz-Hash wird voll), vor dem Sperren. Ein Zweig ist nicht verlangt.
- `alt` und `neu` tragen **dasselbe Kürzel**.
- Der neue Verweis nimmt den **Platz** des alten in der Liste ein (Reihenfolge des Hinterlegens bleibt).
- Fehlerformen (ADR-0003, `fehler` zuerst, nie 422; nichts geschrieben):
  - 400 `{fehler, verweis}`: Form, unbekanntes Kürzel, `neu` existiert nicht oder ist mehrdeutig, Kürzel verschieden, ein Verweis doppelt im Aufruf (als `alt` oder als `neu`), eine Kette (ein `neu` ist zugleich `alt` im selben Aufruf), mehr als 500 Paare, leere Liste.
  - 404 `{fehler, verweis}`: `alt` steht nicht an der Karte (und `neu` auch nicht).
  - 409 `{fehler, verweis}`: `alt` und `neu` stehen beide schon an der Karte. Der Aufrufer entfernt `alt` dann mit `DELETE`; still zusammengelegt wird nicht.
  - 503 wie Punkt 3 (Zeitgrenze).
- **Wiederholung**: ein Paar, dessen `alt` fehlt und dessen `neu` schon an der Karte steht, gilt als erledigt und wird übersprungen. Ist kein Paar übrig: 200 ohne Commit.
- Legacy: das Format der Datei ändert sich nicht; ältere Versionen kennen die Route nicht (404).

### N1.5 Gesamt-Diff mit verwaisten Commits (ändert Punkt 7.1)

Einbezogen werden Commits im Zustand `auf_zweig`. **Verwaiste zählen nicht mit**, auch wenn sie lesbar sind. Sie stehen in `hinweise` mit „verwaist — mit ersetzen nachziehen“, und der Diff je Commit (Punkt 6) bleibt für sie lesbar.
- Grund: ein verwaister Commit ist fast immer der Zwilling eines gerebasten Commits an derselben Karte. Mitgezählt würde seine Änderung doppelt erscheinen, und weil er auf keiner Linie mit den übrigen liegt, fiele die ganze Anwendung in die Folge-Darstellung.
- Inkauf: ein verwaister Commit **ohne** Zwilling (Arbeit, die verworfen wurde) fehlt im Gesamtbild. Er steht aber sichtbar unter den Hinweisen.
- Commits auf verschiedenen Zweigen (z. B. ein Teil schon auf `main`, der Rest auf `karte/<nr>` darüber) sind für Punkt 7 kein Sonderfall: geordnet wird nach dem Commit-Graphen, nicht nach Zweigen.

### N1.6 Zulassung je Commit (ändert Punkt 6)

Diff je Commit für `auf_zweig` und `verwaist`; sonst 404 `{fehler, zustand}`.

### N1.7 Nachfolgervorschlag über `patch-id` (Vorgeschlagen, eigene Karte)

Für einen verwaisten Commit schlägt kanbanD Nachfolger vor: Commits auf Zweigen, deren `git patch-id --stable` gleich ist. Er ersetzt nie selbst; der Mensch oder Agent bestätigt über N1.4. Dafür käme `patch-id` (liest stdin, schreibt nichts) in die Liste aus Punkt 3. Offen und an der Karte zu entscheiden sind die Suchtiefe (Vorschlag: Commits der Zweige seit dem Datum des verwaisten Commits, höchstens 1.000) und der Umgang mit Squash (ein Patch aus vielen, keine Gleichheit). Gemessen 2026-11-19: `log -p -n 1000 | patch-id --stable` kostet in kanbanD 3,0 s. Der Vorschlag ist deshalb ein eigener Aufruf auf Klick und nicht Teil der Liste; die Suchtiefe ist die eigentliche Frage der Probe. Status `Vorgeschlagen`, bis die Probe der Karte steht.

### N1.8 Hinweis für die Factory (E1, nicht Teil von kanbanD)

- Hinterlegen: nach jedem Bericht einer bauenden Rolle die neuen Hashes von `main..karte/<nr>` per `POST`.
- Ersetzen: `_rebase` liest `rev-list --reverse main..<zweig>` vor und nach dem Rebase. Die vorhandene Titelprüfung stellt gleiche Zahl und Reihenfolge sicher, also sind die Paare die Positionen. Die Factory sendet nur Paare, deren `alt` laut `GET /api/aufgaben/{nr}` an der Karte steht (ohne Git-Aufruf), in **einem** `ersetzen`. Das gilt für `wache_vorbereiten` **und** `dokumente`.
- Scheitert die Titelprüfung (Squash, fallengelassener Commit), ersetzt die Factory nicht, und die Verweise bleiben `verwaist` sichtbar. `patch-id` ist erst N1.7.
- Abnahme-Idee: nach `wache … gruen` steht kein Verweis der Karte im Zustand `verwaist`.

### N1 Konsequenzen

- Positiv: Reviewer sehen die Commits schon während der Arbeit; der Zustand sagt, wo ein Commit liegt; ein Rebase kostet einen Commit im Board-Repository statt vieler `DELETE`/`POST`.
- Inkauf: je Bewegung eines Zweigs ist der Cache für dieses Repository kalt (bis 4 parallele Git-Prozesse je Liste); veraltete entfernte Zweige verdecken „verwaist“; ein Commit auf losgelöstem `HEAD` eines Worktrees gilt als verwaist, obwohl der Worktree ihn hält.
- Durchsetzung (zusätzlich zu oben):
  - Zustands-Probe im Wegwerf-Repository: Commit auf `main` → `auf_zweig ["main"]`; Commit nur auf einem Zweig eines **Worktrees** → `auf_zweig ["karte/1"]`, gelesen über das Hauptrepo; Hash vor einem Rebase → `verwaist`; nach `gc --prune=now` ohne Reflog → `fehlt`; nur auf `refs/remotes/o/x` → `auf_zweig`, `entfernte_zweige ["o/x"]`.
  - Cache-Probe: Liste zweimal → beim zweiten Mal kein `--contains`-Aufruf (Zähler im Modul); Zweig bewegt → wieder `--contains`. Der Board-Ordner ist danach unverändert (`git status --porcelain`).
  - Ersetzen-Probe: zwei Paare in einem Aufruf → genau ein Commit, Plätze erhalten; ein Paar mit unbekanntem `neu` → 400 und die Zahl der Commits ist gleich; Wiederholung → 200 ohne Commit; `alt` und `neu` beide an der Karte → 409.
  - Gesamt-Diff-Probe: K1, K2 auf dem Zweig, dazu K1' verwaist an der Karte → Netto wie ohne K1', Hinweis nennt K1'.

## Nachtrag 2026-11-19 N2: Schreibweise von `commits`, Legacy mit einem Eintrag, gehärteter Startpunkt (Karte #207, Architektur-Review S1–S3, O1–O3)

Der bisherige Text bleibt stehen; N2 ändert die genannten Stellen und gilt, wo er ihnen widerspricht. Gebaut in `28a26e33`, `a3f26b81`, `3279e9f9`.

### N2.1 Schreibweise von `commits` (ändert Punkt 1 „Geschrieben wird über den vorhandenen Skalar-Helfer“)

- `commits` wird in der Schreibweise von `serde_yaml` geschrieben, nicht über `yaml::skalar`. Grund: `yaml::skalar` setzt `kd:…` in Anführungszeichen, das Beispiel in Punkt 1 zeigt es ohne, und die Vorversion schreibt den unbekannten Schlüssel in der Schreibweise von `serde_yaml` zurück. Nur so schreibt sie die Datei **zeichengleich** zurück (Rundlauf, Punkt 1 „Legacy“).
- Lehre #142 bleibt erfüllt: ein Hash aus lauter Ziffern steht als `'1234…'` in Anführungszeichen und wird als Text gelesen, nie als Zahl.
- Belegt durch den Test `commits_hinter_cost_entries_in_der_schreibweise_der_vorversion` (`src/format/aufgabe.rs`).

### N2.2 Legacy: nicht für genau einen Eintrag (ändert Punkt 1 „Legacy“ und Kontext „Belegt“)

- Die Behauptung „ältere Versionen tragen `commits` mit“ gilt **nicht für genau einen Eintrag**. Die Vorversion (main `ae04fcfd`) schreibt einen unbekannten Schlüssel mit genau **einem** Listen- oder Map-Eintrag in **eine** Zeile (`k: - x`, `k: a: b`). Die Aufgabe ist danach defekt (HTTP 423). Daten gehen nicht verloren. Betroffen ist jeder unbekannte Schlüssel mit einem Eintrag, nicht nur `commits`.
- **Entscheidung: Inkaufnahme plus Heilung.** Der nachsichtige Leser heilt genau diese Form (`yaml_heilen`, `a3f26b81`): `k: - x` und `k: a: b` in einer Zeile gelten wie der Block darunter. Die neue Version schreibt immer Blockform.
- **Rollout-Regel:** Erst laufen alle Instanzen an einem Board auf der neuen Version, dann hinterlegt die Factory Verweise (N1.8, E1). Solange eine ältere Instanz am Board schreibt, kann ein einzelner Verweis die Aufgabe für sie defekt machen.
- Probe: Legacy-Probe gegen die gebaute Vorversion mit 0, 1, 2, 5 und 30 Einträgen. Ergebnis: 0, 2, 5 und 30 laufen zeichengleich zurück; 1 erzeugt die Zeilenform und wird von der neuen Version geheilt.

### N2.3 Härtung des Startpunkts (Security Sollte 1, Teil Umgebung; `3279e9f9`; ändert Punkt 3 „Umgebung“)

Ein Startort (`git`/`kommando` in `src/git/arbeitsrepo.rs`) baut jeden Aufruf:
- **Entfernt** werden `GIT_CONFIG_*`, `GIT_PAGER`, `PAGER`, `GIT_EXTERNAL_DIFF`, `GIT_EXEC_PATH`, `GIT_ASKPASS`, `GIT_SSH_COMMAND` (dazu die Umlenkungen `GIT_DIR` und Verwandte).
- **Gesetzt** werden `GIT_CONFIG_NOSYSTEM=1` und `GIT_CONFIG_GLOBAL=/dev/null`, dazu für jeden Befehl `-c core.fsmonitor=false -c core.hooksPath=/dev/null`.
- **Folge:** `safe.directory` aus der Benutzerkonfiguration wirkt nicht mehr. Ein Arbeits-Repository, das einem anderen Benutzer gehört, ist `repository_fehlt` mit Grund; es gibt keinen Weg, das aus kanbanD zu umgehen.
- **Für die Diff-Scheibe festgelegt (O1, noch nicht gebaut):** `--no-ext-diff --no-textconv --no-color -c core.quotepath=off` leitet das Modul aus `Befehl` ab; der Aufrufer setzt sie nicht und kann sie nicht auslassen. Bei einer Zeitüberschreitung wird die **Prozessgruppe** beendet, nicht nur Git (Ist: `laufen` beendet nur den Kindprozess; die Gruppe kommt mit der Scheibe, die Git-Kindprozesse startet).
- **Fitness Function (O3, Vorschrift, Test steht aus):** `Command::new("git")` steht außerhalb von Tests nur in `src/git.rs`, `src/start/ordner.rs` und `src/git/arbeitsrepo.rs`. Ein vierter Ort ist ein Befund.

### N2.4 Bewusste Grenze: absolute Pfade in Fehlermeldungen (Security-Review S2)

Fehlermeldungen (`repository_fehlt`, 503) nennen absolute Pfade. kanbanD ist ein lokales Werkzeug ohne Anmeldung (Full-Trust), und der Pfad hilft beim Beheben. Wird kanbanD je über ein Netz bereitgestellt, entfällt diese Grenze.

### N2.5 Offener Punkt außerhalb von A1 (Folgerung, nicht entschieden)

Das Board-Git (`src/git.rs:360` `status`, `:366` `rev-parse --absolute-git-dir`) läuft über Registerpfade **ohne Zeitgrenze** und mit der **Umgebung des Betreibers**. Folgen: ein Repository mit `include.path` auf eine FIFO lässt den Serverstart hängen; `core.fsmonitor` aus dem Repository wird ausgeführt. Offen, an einer eigenen Karte zu entscheiden: dieselbe Härtung und Zeitgrenze für das Board-Git (etwa über `laufen` und den Startort) oder bewusst nicht, weil dort das eigene Repository des Betreibers liegt. N2 trifft dazu keine Entscheidung.

### N2 Konsequenzen

- Positiv: die Vorversion schreibt `commits` zeichengleich zurück; der Schaden der Vorversion bei einem Eintrag ist heilbar; Konfiguration und Umgebung des Betreibers führen im Arbeits-Repository kein Programm aus.
- Inkauf: bis alle Instanzen aktualisiert sind, kann eine ältere Instanz die Aufgabe bei genau einem Verweis defekt machen (423); `safe.directory` wirkt nicht; absolute Pfade in Meldungen; das Board-Git bleibt bis zur Entscheidung zu N2.5 ungehärtet.

## Nachtrag 2026-11-19 N3: Gesamtgrenze und Cache beim Lesen, Lücken in N1.2, Rückfall zu N1.3 (Karte #211, Scheibe A2, R00204, Fragen des planers)

Der bisherige Text bleibt stehen; N3 ergänzt die genannten Stellen und gilt, wo er ihnen widerspricht. Entscheider: Claude (autonom, architekt, Lauf 211-architekt-1).

**Belegt (gefahren 2026-11-19, Git 2.48.1, Rechnerlast 5–7 durch fremde Läufe, daher Größenordnung, keine Abnahmewerte)**: Wegwerf-Repository in `gemeinsam/scratchpad/arch-211/big` der Factory, 20.779 Commits, 50 Zweige (26 lokal, 24 entfernt, `main` linear), ohne `commit-graph`, 30 Verweise (20 auf `main`, 5 auf Zweigspitzen, 5 verwaist), `-c core.commitGraph=false`:

| Weg | Prozesse | Zeit (kalt) |
|---|---|---|
| Z1 `for-each-ref --contains` je Commit, 4 parallel | 30 | **1,01–1,10 s** (ein einzelner Aufruf 0,15 s für einen verwaisten, 0,38 s für einen Commit auf `main`) |
| Z2 `rev-list <spitze>` je Zweig, 4 parallel | 50 | 1,3–1,5 s |
| Z3 `rev-list --branches --remotes` (nur ja/nein) | 1 | 0,11–0,12 s |
| Z5 `rev-list --parents --branches --remotes`, Erreichbarkeit im Speicher | 1 | 0,16–0,24 s (nur der Git-Teil; `cat-file` und `log` für 30 Verweise zusammen 0,02 s) |

Die Annahme aus N1.3 („ein Repository mit ~20.000 Commits und ~50 Zweigen ohne `commit-graph` hält das“) ist damit für Z1 **nicht belegt, sondern nach dieser Messung widerlegt**; die Messung in B0998 bleibt die Abnahme.

### N3.1 Gesamtgrenze beim Lesen (präzisiert Punkt 3 „Zeitgrenze je Git-Prozess 10 s“)

R00204 ist richtig und bleibt: zusätzlich zur Grenze je Prozess gilt für `GET …/commits` eine Grenze für den **ganzen Aufruf**. Ohne sie wären es bei 30 Verweisen und 4 gleichzeitigen Prozessen nominell 8 Wellen × 10 s = 80 s.

- **10 s ab Eingang der Anfrage**, gezählt über alles: Warten auf einen freien Platz der vier, Wurzel, `cat-file`, `log`, Fingerabdruck, Zweiglisten. Danach werden alle laufenden Git-Prozesse samt Prozessgruppe beendet, es wird nichts Neues gestartet, die Antwort ist 503 `{fehler}`. Beendigung und Antwort brauchen höchstens 5 s; **15 s ist die obere Grenze der Antwort**, nicht die Grenze der Arbeit.
- Die Grenze je Prozess bleibt 10 s, wird aber auf den **Rest der Gesamtgrenze** gekürzt: Grenze je Prozess = `min(10 s, Rest)`. Eine eigene Zahl für einen einzelnen Prozess gibt es beim Lesen damit nicht mehr als wirksame Größe. Punkt 3 bleibt für Aufrufe ohne Gesamtgrenze (`POST …/commits`, `ersetzen`) unverändert.
- **Keine Teilantwort**: bei Überschreitung gibt es nie eine Liste mit fehlenden Zweigen, nur 503.
- Der Diff (Scheibe A3) bekommt eine **eigene** Gesamtgrenze, in A3 festzulegen; N3 gilt nur für die Liste.

### N3.2 Cache nach einem Abbruch (präzisiert N1.3 „Cache nur flüchtig“)

Ergebnisse, die schon da sind, bleiben erhalten; sonst käme eine Wiederholung nie voran. Regeln:

1. **Nur ganze, erfolgreiche Zweiglisten** werden abgelegt: Prozess mit Ausstiegscode 0 und vollständig gelesener Ausgabe. Ein beendeter, abgelaufener oder fehlgeschlagener Prozess legt **nichts** ab. Insbesondere gilt eine leere Ausgabe eines abgebrochenen Prozesses nie als „kein Zweig“ (sonst würde `auf_zweig` zu `verwaist`).
2. **Ablage am Ende der Anfrage**, bei Erfolg wie bei Abbruch, nach einer **zweiten Fingerabdruck-Probe** (derselbe `for-each-ref`, 2 ms, gehört zum Spielraum von 5 s und hat 2 s Grenze). Ist der Fingerabdruck gleich dem vom Beginn, werden die fertigen Ergebnisse unter ihm abgelegt; ist er anders (ein Zweig hat sich während der Anfrage bewegt, auch hin und zurück), werden sie verworfen. Grund: ein Ergebnis, das nach einer Bewegung gelesen wurde, läge sonst unter dem alten Schlüssel, und ein Zweig, der zurückbewegt wird, träfe einen falschen Eintrag. Folge: die Git-Spur einer kalten Liste hat einen Aufruf mehr (5 statt 4); die Spur einer Liste, die ganz aus dem Cache kommt, bleibt bei 4.
3. Die Sperre des Caches (Mutex) wird **nie während eines Git-Prozesses** gehalten, nur zum Lesen und Ablegen. Zwei gleichzeitige Anfragen rechnen im Zweifel doppelt, das ist Inkauf.
4. Obergrenze und Leeren bei Überlauf wie in N1.3. Abgelegt wird je Anfrage höchstens bis zur Obergrenze; der Rest wird verworfen, nicht der Cache geleert.

Wirkung: nach einem 503 beginnt die Wiederholung mit den schon fertigen Zweiglisten und braucht nur noch die übrigen; ein Repository, das in einem Anlauf nicht reicht, wird über mehrere Anläufe vollständig, solange sich kein Zweig bewegt.

### N3.3 Lücken in N1.2 (bestätigt, mit Wortlaut)

1. **`zweige_weitere`: lokale und entfernte Zweige zusammen, nur bei n > 0 — bestätigt.** n = (Zahl aller erreichenden lokalen + Zahl aller erreichenden entfernten Zweige) − (Zahl der in `zweige` und `entfernte_zweige` genannten). Tags und `*/HEAD` zählen nicht. Beide Listen sind alphabetisch (Bytefolge des Namens) und je auf 10 gekappt. Grund: ein Leser will wissen, **ob** mehr da ist; eine zweite Zahl verlangt eine zweite Zeile der Oberfläche ohne Nutzen, und N1.2 spricht von „Rest als `zweige_weitere: n`“ im Singular. Schwäche: bei n > 0 ist nicht ablesbar, welche Liste gekappt wurde; sie ist es genau dann, wenn sie 10 Namen hat.
2. **Objekt, das kein Commit ist, gilt als `fehlt` — bestätigt.** Maßgeblich ist der Typ aus `cat-file --batch-check`: nur `commit` zählt. Blob, Baum und auch ein **Tag-Objekt** (`git tag -a`) sind `fehlt`; es wird **nicht** zum Commit aufgelöst (kein `^{commit}` beim Lesen). Hinterlegen schreibt immer den Hash des Commits (Punkt 4), so entsteht ein Tag-Objekt nur von Hand. Grund: der Verweis nennt einen Commit, ein anderes Objekt ist für einen Reviewer ohne Diff und Titel ein Verweis auf nichts; `fehlt` ist der Zustand, den die Oberfläche als „Verweis entfernen oder ersetzen“ zeigt.
3. **Mehrdeutiger handgeschriebener Kurz-Hash gilt als `unlesbar` mit `grund` — bestätigt.** Erkannt über die Antwort `ambiguous` von `cat-file --batch-check`, **unabhängig vom Typ** der Treffer (auch Commit gegen Blob). Das ist bewusst strenger als `rev-parse …^{commit}` beim Hinterlegen, das nach Typ unterscheidet; es ist unschädlich, weil Hinterlegen immer den vollen Hash speichert und ein Kurz-Hash nur von Hand entsteht. Ein Kurz-Hash ohne Treffer ist `fehlt`, nicht `unlesbar`.

**Folge für R00204** (Wortlaut für den planer; die Anforderung ändert der planer):
- Zustand `unlesbar` (Zeile 54), letzter Satz ersetzen: „Ein Eintrag, der die Form verletzt, erreicht Git nie; ein mehrdeutiger Kurz-Hash wird von `cat-file --batch-check` als `ambiguous` gemeldet und ist `unlesbar` mit `grund`, gleich welchen Typs die Treffer haben.“ (Heute steht dort „Der Eintrag erreicht Git nie“ auch für den mehrdeutigen Hash; das ist nicht zu erfüllen.)
- Zustand `fehlt` (Zeile 57): „… kein Commit-Objekt zu diesem Hash (auch nicht, wenn das Objekt ein Blob, ein Baum oder ein Tag-Objekt ist; es wird nicht zum Commit aufgelöst).“ AK 5 um ein Tag-Objekt (`git tag -a`) → `fehlt` ergänzen.
- Zeitgrenze (Zeile 71) und AK 9: Zusatz „Grenze je Prozess = `min(10 s, Rest der Gesamtgrenze)`“. AK 9: „… und es steht nichts im Cache“ ersetzen durch „und kein abgebrochenes Ergebnis steht im Cache“, dazu ein zweiter Fall: ein `git`-Skript, das die ersten 4 Zweiglisten sofort, jede weitere 60 s hält → nach spätestens 15 s 503; derselbe Aufruf ohne Skript ergibt 200 mit der Liste aus AK 1, und seine Git-Spur enthält **4 `--contains` weniger** als eine kalte Liste.
- Cache (Zeile 69) und AK 11: „Ablage am Ende der Anfrage nach einer zweiten Fingerabdruck-Probe, bei ungleichem Fingerabdruck verworfen; nur erfolgreiche Zweiglisten.“ AK 11: die Git-Spur einer **kalten** Liste hat 5 Aufrufe im Repository (Wurzel, `cat-file`, `log`, Fingerabdruck, Zweiglisten …, Probe) — die Zahl 4 gilt nur für die Liste aus dem Cache. Zusätzlich eine Probe im Test des Moduls: Zweig bewegt sich zwischen erstem und zweitem Fingerabdruck → nichts abgelegt.

### N3.4 Rückfall bei Reißen der Schwelle (ergänzt N1.3 „Hält es nicht: Zweigliste kappen und Z3 als Vorstufe, nicht still“)

**Die Schwelle (p95 < 200 ms bei 30 Verweisen, kalt, ~20.000 Commits, ~50 Zweige, ohne `commit-graph`) bleibt, niemand ändert sie.** Der Rückfall ändert den Weg, nicht die Schwelle und nicht die Antwortform.

**Entscheidung gegen die in N1.3 genannten Wege**:
- *Zweigliste kappen* hilft nicht: schon ein einziger `--contains` auf `main` kostet 0,38 s, eine Welle von vier also mehr als die ganze Schwelle; Kappen der Zahl der Commits mit Zweigliste ließe zudem Verweise ohne Namen, also eine andere Antwort.
- *Z3 allein* trägt die Schwelle (0,12 s), liefert aber nur ja/nein und verlangt eine andere Antwortform (der Betreiber will den Zweig genannt haben).
- *Z2* ist langsamer als Z1.

**Gewählt als Rückfall: Z5** — ein einziger Lauf `git rev-list --parents --branches --remotes` (nur Kanten, ohne Tags), die Zweigspitzen kommen aus dem Fingerabdruck (`for-each-ref`, dort ohne `*/HEAD`), die Erreichbarkeit der höchstens 500 Verweise je Spitze wird im Speicher des Moduls gerechnet (Durchlauf rückwärts über die Elternkanten, je Spitze einmal besucht). Stärke: ein Prozess, unabhängig von der Zahl der Verweise, gleiche Antwort wie Z1, `rev-list` steht schon in der Befehlsliste (Punkt 3), keine Änderung am Format. Schwäche: Kosten wachsen mit der Länge der Geschichte (nicht mit den Verweisen); gemessen 0,16–0,24 s nur für Git bei Last 5–7, also **knapp** an der Schwelle, und der Speicher wächst mit der Geschichte. Schutz: bricht die Ausgabe 3.000.000 Zeilen ab, wird der Prozess beendet und die Zweigliste ist ein Fehler (503 `{fehler}` mit Grund), nie eine gekürzte Liste. Der Cache aus N1.3 und N3.2 bleibt unverändert (je Hash → Zweige unter dem Fingerabdruck); der Graph selbst wird nicht abgelegt.

**Ablauf und Zuständigkeit — der entwickler entscheidet ohne Rückfrage**:
1. B0998 misst Z1 **und** Z5 auf demselben Wegwerf-Repository (20.000 Commits, 50 Zweige, ohne `commit-graph`, 30 Verweise gemischt auf `main`, Zweigen, verwaist), je **20 kalte Läufe** (neuer Prozess, Cache des Moduls leer), `-c core.commitGraph=false`; p95 = der 19. Wert der sortierten Läufe, die Messung **gesamt** (Wurzel, `cat-file`, `log`, Fingerabdruck, Zweiglisten), Last nach `uptime` ≤ 6, sonst warten. Die Werte stehen in der Commit-Nachricht von B0998.
2. Ist Z1 p95 < 200 ms: **Z1 bleibt** (wie B1001 es nennt).
3. Sonst, ist Z5 p95 < 200 ms: **Z5 statt Z1**, in B1001; die Anforderung bleibt gültig bis auf die Worte „je Commit `--contains`“ (siehe unten). Es gibt **ein** Verfahren im Dienst, kein Umschalten nach Größe des Repositories (zwei Wege wären doppelt zu testen).
4. Sind beide ≥ 200 ms: **Halt**, nichts bauen, was die Schwelle weicher macht. Der entwickler meldet die Messwerte an den Director (Rückweg `anforderung_falsch`, Grund: Schwelle nicht erreichbar); über eine andere Form der Antwort (Z3: Zweige ohne Namen, Namen nur aus dem Cache, mit ausdrücklichem Feld) entscheidet dann der architekt per Nachtrag N4 und der planer ändert die Anforderung. Das ist der **einzige** Fall, in dem zurückgefragt wird.
5. Ein Rückfall auf Z5 wird nicht still gemacht: die Gründe stehen in der Commit-Nachricht von B0998 und im Bericht der Karte; der architekt trägt Z5 danach in „Erprobt durch“ ein.

**Folge für R00204** bei Z5 (Wortlaut für den planer, erst wirksam, wenn B0998 Z5 wählt; der planer kann ihn schon jetzt als Alternative aufnehmen): Zeile 69 und B1001 „je Commit `--contains`“ → „die Zweigliste (je Commit `for-each-ref --contains`, oder, wenn B0998 es verlangt, ein Lauf `rev-list --parents --branches --remotes` mit Erreichbarkeit im Speicher)“; AK 11 „startet wieder je Commit ein `--contains`“ → „startet wieder die Zweigliste (Prozess je Commit oder der eine Lauf)“; „mindestens 2 gleichzeitig bei 30 Verweisen“ und „nie mehr als 4“ gelten nur für Z1. Die Probe der Erreichbarkeit (AK 1) bleibt unverändert, dazu ein Vergleichstest: Z1 und Z5 liefern auf demselben Repository dieselben Listen.

### N3 Konsequenzen

- Positiv: der Aufruf ist durch eine Grenze von 10 s (Antwort ≤ 15 s) nach oben begrenzt; ein Abbruch verliert keine Arbeit und fälscht keinen Zustand; der Rückfall steht fest, Schwelle und Antwortform bleiben, der entwickler muss nur im Fall 4 fragen.
- Inkauf: die kalte Liste hat einen Git-Aufruf mehr; zwei gleichzeitige Anfragen rechnen doppelt; bei Z5 wächst der Speicher mit der Geschichte (Schutz 3.000.000 Zeilen); der Fall 4 kann die Scheibe aufhalten.
- Durchsetzung: Proben AK 9 und AK 11 wie oben; Vergleichstest Z1/Z5 nur, wenn Z5 gewählt wird; Messprotokoll in B0998.

## Quellen / Bezuege

- Karten #207–#210; po-entscheidungen Z. 358–383 und Betreiber-Entscheidung 2026-11-19 (letzte Zeile, Nachtrag N1); `werkzeuge/board.py` der Factory (`_rebase`, `dokumente`, `wache_vorbereiten`); Vision Z. 110–113, 145–200; `AI-Team/factory.md` „Lastprofil“
- `src/git.rs`, `src/modell/anwendungen.rs`, `src/modell/einstellungen.rs:40`, `:77`, `src/format/aufgabe.rs:667`, `src/web/statisch.rs`, `src/web/endpunkte.rs:35`
- ADR-0003, ADR-0006, ADR-0008, ADR-0021, ADR-0024, ADR-0028, ADR-0030, ADR-0031
- Git-Dokumentation `git-diff` (`--no-ext-diff`, `--no-textconv`, `--raw -z`), `gitattributes` (diff-Treiber, textconv), `git-rev-parse` (`--end-of-options`, `^{commit}`) — Git 2.48.1 auf diesem Rechner
- npm: `prismjs` 1.30.0 (MIT), `@highlightjs/cdn-assets` 11.12.0 (BSD-3-Clause), abgerufen 2026-11-19; Messung in `gemeinsam/scratchpad/arch-207/` der Factory
