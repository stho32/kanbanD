# ADR-0032: Commit-Verweise an der Karte — Schlüssel `commits` mit `<kürzel>:<voller Hash>`, Diff live und nur lesend aus dem Arbeits-Repository des Registers, Gesamt-Diff dateiweise ohne fremde Änderungen

**Status**: Akzeptiert (Punkte 1–9; Punkt 5 Zustände, Punkt 6 Zulassung, Punkt 7.1 und Punkt 9 Liste geändert durch Nachtrag N1); Punkt 10 „Vorausschau #208–#210“ Vorgeschlagen, darin Ablage, gzip und Schalter abgelöst durch ADR-0036 (2026-11-21); Nachtrag N1 (2026-11-19) Akzeptiert, darin N1.7 Vorgeschlagen; Nachtrag N2 (2026-11-19) Akzeptiert, darin N2.5 nur Folgerung; Nachtrag N3 (2026-11-19) Akzeptiert (Gesamtgrenze und Cache beim Lesen, Lücken in N1.2, Rückfall zu N1.3); Nachtrag N4 (2026-11-19) Akzeptiert (Diff eines Commits: Gesamtgrenze, Zulassung, Zählweise, Lauf mit Teilausgabe, `hinweise`, Befehl `diff-tree`; Kappe der Dateizahl und p95 < 500 ms nur Hypothese bis B1014); Nachtrag N5 (2026-11-20) Akzeptiert (Antwortbudget 64 MB, Schreibfrist 60 s, `GRENZE_EINZELN` 8 MB, Zuordnung über Blob-Hashes, Berichtigung N4 „Belegt“ zu `--ext-diff`, Submodule in `metadaten`); Nachtrag N6 (2026-11-20) Akzeptiert (Gesamt-Diff: Basis, Spanne, netto/Folge je Datei, Merges, Antwortform mit Summen, höchstens 15 Git-Prozesse, `datei=`, `format=patch`, `ETag`; p95 < 500 ms und `GRENZE_NAMEN` Hypothese bis zur Lastprobe der Karte #214; belegt p95 298 ms vor N7); Nachtrag N7 (2026-11-20) Akzeptiert (Gruppen über Umbenennungen der Karte, abgeschlossene Pfadangaben, Namen über 4 MB mit Kappe, `--` hinter Revisionen, `GIT_NO_REPLACE_OBJECTS`, `ETag` über alle Verweise; belegt durch die Nacharbeit 1 an #214 und eine Zufallsprobe über 1.200 Seeds; p95 nach N7.1 259 ms; Zuordnung im Bezug nach Nacharbeit 2; N7.7 Diff je Commit, Karte #229, berichtigt durch N7.8; N7.9 Zeitgrenze und Argumentgrenze; N7.10 Gesamt-Diff ohne 500 bei abweichender Paarung, Karte #230)
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
   - *(präzisiert durch N6: Basis und Spanne N6.1, Prozesse N6.2, Klassifikation N6.3 statt `log`/`git diff`, Merges N6.5, Antwortform N6.6)*
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

## Nachtrag 2026-11-19 N4: Diff eines Commits — Gesamtgrenze, Zulassung, Zählweise, Lauf mit Teilausgabe, `hinweise`, Befehl `diff-tree` (Karte #213, Scheibe A3, R00206, Fragen des planers)

Der bisherige Text bleibt stehen; N4 ergänzt die genannten Stellen und gilt, wo er ihnen widerspricht. Entscheider: Claude (autonom, architekt, Lauf 213-architekt-1). Fünf Empfehlungen des planers bestätigt (N4.1, N4.2, N4.3, N4.5 mit Zusätzen; N4.4 mit eigener Form), dazu die Wahl des Befehls (N4.6) und die Schalter je Befehl (N4.7).

**Belegt (gefahren 2026-11-19, Git 2.48.1, Wegwerf-Repositories in `gemeinsam/scratchpad/arch-213/` der Factory, Last 1–3)**:
- `git diff <a> <b>` startet `diff.external` und `textconv` aus Konfiguration und `.gitattributes` (Marke entstand). `git diff-tree -r -p <a> <b>` startet sie nicht; `diff-tree -p --ext-diff` startet auch mit dem Schalter nichts **(falsch, berichtigt in N5.3: mit `--ext-diff` startet `diff.<treiber>.command`)**, `diff-tree -p --textconv` startet textconv.
- `diff-tree` liest die Oberflächenkonfiguration nicht: mit `diff.noprefix`, `diff.context=0`, `diff.algorithm=patience`, `diff.submodule=log`, `diff.renames=false`, `diff.mnemonicPrefix`, `core.quotepath=true`, `diff.wsErrorHighlight=all`, `diff.renameLimit=1`, `color.ui=always`, `color.diff=always` ist seine Ausgabe bytegleich zur sauberen; die von `diff` ändert sich. `diff.orderFile` ändert die Reihenfolge bei `diff`, nicht bei `diff-tree`.
- Ein Merge-Commit allein (`diff-tree -r -p <merge>`) liefert nichts; `-m --first-parent` liefert die Diffs gegen **beide** Elternteile (`--first-parent` wirkt bei `diff-tree` nicht). Der erste Elternteil muss also genannt werden; für den Wurzel-Commit gilt `--root --no-commit-id <hash>`.
- `diff-tree -r --raw --numstat -z` schreibt **zuerst alle `--raw`-Einträge, dann alle `--numstat`-Einträge**.
- `git --literal-pathspecs diff-tree … -- 'a*b.txt'` trifft nur diese Datei (ohne den Schalter auch `axb.txt`). Eine umbenannte Datei bleibt `R` nur, wenn `alt` und `neu` beide in der Pfadangabe stehen (`R085`); mit nur `neu` wird sie `A`.
- `.gitattributes` im Arbeitsbaum, `.git/info/attributes` und `core.attributesFile` in der Konfiguration des Repositorys entscheiden bei `diff-tree --numstat` über „binär“ (`-diff`), auch für einen alten Commit. `-c core.attributesFile=/dev/null` und `--attr-source=<hash>` nehmen die ersten beiden Quellen weg; `.git/info/attributes` bleibt.
- **Nicht reproduziert:** `git diff --no-show-signature <a> <b>` bricht mit Ausstiegscode 128 ab. Es lief mit Ausstiegscode 0 in einem Repository mit Arbeitsbaum, in einem Bare-Repository, in einem verknüpften Worktree, mit `--end-of-options`, mit `-C`, mit der gehärteten Umgebung des Startorts, mit `--raw --numstat -z` und mit nur einem Commit; nur `--no-index` verwirft den Schalter (129). Die Befehlszeile, die 128 ergab, steht nicht in der Anforderung; die Entscheidung N4.7 hängt nicht davon ab.

### N4.1 Gesamtgrenze des Diffs — bestätigt (füllt N3.1 „in A3 festzulegen“)

- **10 s ab Eingang, Prozess `min(10 s, Rest)`, Antwort spätestens nach 15 s, keine Teilantwort**, wörtlich wie N3.1. Der Diff hat anders als die Liste keine Wellen, aber eine Kette von etwa sieben Prozessen nacheinander (Wurzel, Typ, Metadaten, erster Elternteil, Dateiliste, Zähler, Patch): ohne Gesamtgrenze wären es nominell 70 s.
- **Die Uhr läuft ab Eintritt in den Handler**, vor dem Warten auf einen Platz im Blocking-Pool; die Frist wird als Zeitpunkt (`Instant`) durchgereicht, nicht als Dauer, damit die Kürzung auf den Rest in einem Wort steht (wie `metadaten(…, frist)` in A2).
- Eine Zeitüberschreitung ist nie ein Teil: der Lauf mit Teilausgabe (N4.4) liefert bei Zeitüberschreitung **nichts**, nur der Fehler `Zeitgrenze`. 304 und alle Prüfungen ohne Git kosten keine Frist.
- Das Ziel p95 < 500 ms für einen Commit bis 1 MB bleibt **Hypothese**; B1014 misst es. 10 s ist die Obergrenze der Arbeit, nicht eine Erwartung.

### N4.2 Zulassung ohne Zweigliste — bestätigt (präzisiert N1.6)

- Der Diff prüft nur „Objekt ist ein Commit“ mit demselben Helfer wie die Liste (`objekte_pruefen`, Typ aus `cat-file --batch-check`). `auf_zweig` und `verwaist` zerlegen die Commits ohne Rest, also sind „Commit“ und „`auf_zweig` oder `verwaist`“ dieselbe Menge. Blob, Baum und Tag-Objekt sind `fehlt`, ein mehrdeutiger Kurz-Hash ist `unlesbar` (N3.3), beides wie in der Liste. Ein eigenes Urteil im Diff gibt es nicht; so können Liste und Diff nicht auseinanderlaufen.
- **Weiter wird mit dem vollen Hash gearbeitet, den `cat-file` meldet**, nie mit dem Text aus der Datei (ein Kurz-Hash könnte zwischen Prüfung und Lauf mehrdeutig werden).
- `commits[0]` trägt weder `zustand` noch `zweige`. Schwäche: Liste und Diff sind zwei Anfragen; bewegt sich dazwischen ein Zweig, zeigt B2 einen Zustand, der zum Diff nicht mehr ganz passt. Der Diff ist davon nicht betroffen (er hängt nur am Commit), unschädlich.
- Gegenprobe: ein Test, der alle Zustände der Liste (`auf_zweig`, `verwaist`, `fehlt`, `repository_fehlt`, `anwendung_unbekannt`, `unlesbar`) durch Liste **und** Diff schickt und 200 genau bei den ersten beiden verlangt.
- Der Gesamt-Diff (A4) braucht den Zustand (N1.5 schließt `verwaist` aus) und startet dort die Zweigliste; das ändert den Diff je Commit nicht.

### N4.3 Zählweise und Startwerte — bestätigt, eine Lücke geschlossen (präzisiert Punkt 8)

- **KB und MB binär** (1 KB = 1.024 Byte). **3.000 Zeilen als `plus + minus`** aus `--numstat`: die Entscheidung fällt **vor** dem Patch-Lauf; Kontextzeilen zählen nicht (die Größe fängt die Bytegrenze). **256 KB als Byte des Patch-Texts ab `@@`**, gezählt an den **rohen Bytes von Git**, nicht am dekodierten Text und nicht am JSON (ersatzweise Dekodierung und Maskierung machen den Text größer, die Grenze darf davon nicht abhängen). Grenze je Datei und Summe von 4 MB wie Punkt 8, Summe ebenfalls roh gezählt.
- **`-M50% -l1000`** in jedem Lauf, der Dateien aufführt oder zerlegt, damit `diff.renameLimit` aus dem Repository nichts ändert. Inkauf: bei mehr Kandidaten als der Grenze entfällt die **unscharfe** Erkennung (Git meldet das nur auf `stderr`); eine Umbenennung mit Änderung erscheint dann als `D` und `A`, vollständig, aber ohne `R`. Es gibt dafür keinen Hinweis; die genaue Erkennung (gleicher Inhalt) bleibt.
- **Kappe der Dateizahl: Konstante im Modul, Startwert in R00206, Hypothese.** Dieser ADR nennt keine Zahl (wie Punkt 8). Entscheidend ist die Form: nie still (`dateien_gekappt` mit `gezeigt` und `gesamt`), `commits[0].dateien` bleibt die wahre Zahl, kein Teil der Liste verliert Zähler.
- **Lücke in R00206:** „nur Pfade aus der Dateiliste erreichen Git“ (FA 8) und „die Dateiliste wird bei 2.001 Einträgen abgebrochen“ (NFR) vertragen sich nicht, sobald ein Commit mehr Dateien hat. Entscheidung: **`datei=` liest die Dateiliste (nur `--raw -z`) nicht gekappt, mit der Bytegrenze für einzeln geladene Dateien (20 MB)**; steht der Pfad nicht darin, ist es 404 `{fehler}`; war die Liste bis zur Grenze abgeschnitten, nennt `fehler` den Grund („Dateiliste zu groß“), nie eine falsche „nicht gefunden“-Meldung ohne Grund.
- **Dateiliste in zwei Läufen**: `--raw -z` und `--numstat -z` getrennt, jeder mit Bytegrenze (Startwert 1 MB, Hypothese; sie muss 2.001 Einträge mit durchschnittlichen Pfaden fassen). Grund: bei einem gemeinsamen Lauf stehen alle `--raw`-Einträge vor allen `--numstat`-Einträgen (gemessen); ein Abbruch in der Mitte ließe alle Zähler fehlen. Die Läufe haben dieselben Schalter und damit dieselbe Reihenfolge; verbunden werden sie nach Position. `gezeigt` ist die Zahl der in **beiden** Läufen vollständig gelesenen Einträge, höchstens die Kappe, `gesamt` ist `commits[0].dateien`.
- **Inkauf**: (a) Eine einzige Datei mit einer riesigen Zeile (unter 3.000 Zeilen) bricht den Patch-Lauf bei 4 MB; alle Dateien dahinter stehen `nachladen`. Sie sind einzeln ladbar, kosten aber je einen Aufruf. (b) Die JSON-Antwort ist größer als 4 MB, wenn Bytes maskiert werden (ein Steuerzeichen wird `\u0001`, sechsfach; ein ungültiges Byte wird U+FFFD, dreifach): höchstens etwa 24 MB bei 4 MB Git-Ausgabe. Das ist ein lokales Werkzeug (Full-Trust), kein Fehler; die Grenze sitzt an der Quelle.
- **Beiläufig (Sollte)**: A2 ruft `log … -M` ohne `-l1000`. Bei einem Commit mit mehr als etwa 1.000 Kandidaten und gesetztem `diff.renameLimit` können `commits[0].plus/minus` und die Summe der Dateien des Diffs auseinanderlaufen. Eine Zeile (`-l1000` in `metadaten`) in B1010 schließt das.

### N4.4 Lauf mit Teilausgabe — eigene Funktion statt Schalter in `Lauf` (ergänzt N2.3 „laufen“, grenzt N3.2 ab)

Optionen für den Startort:
- **L1 — ein Feld in `Lauf` (`bytegrenze`), `Output` bekommt `abgeschnitten`**. Stärke: kleinste Änderung. Schwäche: jeder Aufrufer von `git()` kann es setzen und bekommt einen Teil, wo er ein Ganzes erwartet; die Regel „die Liste bekommt nie eine Teilausgabe“ stünde nur in den Köpfen und in Tests. Verworfen.
- **L2 — zweite Funktion mit eigenem Rückgabetyp** (gewählt): `git()` und `Lauf` bleiben, wie sie sind: Zeitgrenze, Zeilengrenze und Fehler heißen `Err`, nie Teil. Neu `git_teil(ordner, befehl, args, bytegrenze, frist) -> Result<Teil, Arbeitsrepofehler>` mit `Teil { ausgabe: Vec<u8>, abgeschnitten: bool }`. Stärke: Der Typ trennt; wer eine Liste liest, ruft `git()` und hat gar keinen Weg zu einem Teil. Schwäche: eine zweite Funktion mit eigenem Lese-Thread; sie teilt Start, Gruppe beenden und Zähler mit `git()` (ein gemeinsamer innerer Teil `ausfuehren`).
- **L3 — der Diff-Leser hält das Kind selbst** (Streaming im Diff-Modul). Stärke: Zerlegen beim Lesen. Schwäche: zweiter Ort, der Prozesse startet und beendet; verletzt N2.3 „ein Startort“. Verworfen.

**Gewählt: L2.** Regeln:
1. `Teil.ausgabe` hat **höchstens `bytegrenze` Byte**. Gibt es mehr Ausgabe, ist `abgeschnitten` wahr und `ausgabe` sind genau die ersten `bytegrenze` Byte (nicht mehr; der Lese-Thread kann bis zu einem Block darüber lesen und schneidet ab). Genau `bytegrenze` Byte Ausgabe sind **nicht** abgeschnitten, ein Byte mehr schon (AK 9, Test des Moduls).
2. Bei `abgeschnitten` stirbt die **ganze Prozessgruppe** (wie bei `Zeitgrenze`), und der Ausstiegsstatus zählt nicht (es ist der eigene Tod). Ohne Abbruch zählt der Status wie bei `git()`: ungleich 0 ist `Err(Start)`.
3. **Zeitgrenze und Frist ergeben nie einen Teil**, auch nicht, wenn schon Bytes gelesen waren: `Err(Zeitgrenze)`. Dasselbe gilt für Lesefehler.
4. **Nur ein Befehl darf einen Teil liefern**: `Befehl::liefert_teil()` mit erschöpfendem `match` wie `erzeugt_diffs` (ein neuer Befehl braucht eine Zuordnung, sonst baut das Programm nicht); heute nur `DiffTree`. `git_teil` mit einem anderen Befehl bricht ab (`assert!`).
5. **Der Aufrufer behandelt einen Teil als unvollständig**: das letzte angefangene Stück (die Datei, die der Abbruch trifft, oder ein halber Eintrag der Dateiliste) wird verworfen und nie als vollständiger Patch gezeigt (FA 6).
6. Die Obergrenzen sind Bytegrenzen: Patch-Lauf 4 MB, einzeln geladene Datei 20 MB, Dateiliste je Lauf nach N4.3.

Durchsetzung: (1) Tests des Moduls: genau `n` und `n + 1` Byte; ein Skript, das nach 1 MB hängt, ergibt mit Frist `Err(Zeitgrenze)`, nie einen Teil mit 1 MB; die Prozessgruppe lebt nach dem Abbruch nicht mehr. (2) `liefert_teil()` ist für alle Befehle der Liste außer `DiffTree` falsch (Test über alle Befehle). (3) **Die Liste bekommt nie einen Teil:** die bestehenden Tests von R00204 zu `ZuvielAusgabe` und zur Zeitgrenze bleiben unverändert grün; ein Test mit Endlos-Skript für `for-each-ref`/`rev-list` ergibt `Err`. (4) Mutanten: Zeitgrenze liefert Teil; `git()` ruft den Teil-Pfad; Teil ohne Kürzung auf `bytegrenze`; Gruppe bleibt am Leben — jeder macht mindestens einen Test rot.

Pre-Mortem: wahrscheinlichster Fehler ist, dass ein späterer Entwickler für `rev-list` „nur den Anfang“ will und `liefert_teil()` auf wahr setzt. Das ist dann ein sichtbarer Eingriff in den Startort mit seinem Test (2), nicht ein Feld in einem Aufruf.

### N4.5 `hinweise` als Objekte mit `art` — bestätigt (ändert Punkt 6 „`hinweise: []`“ und N1.5 „Hinweis mit Text“)

- `hinweise: [ { art, … } ]`, `art` ist ASCII in Kleinbuchstaben mit Unterstrich, die übrigen Felder gehören zur Art. Ohne Anlass `[]`.
- Arten dieser Scheibe: `dateien_gekappt` (`gezeigt`, `gesamt`), `zu_gross_zum_anzeigen` (`datei`: `neu`, bei gelöschten `alt`). A4 und spätere Scheiben ergänzen Arten **in einem Nachtrag an dieser Stelle** (Name, Felder, Auslöser), damit die Namen einmalig bleiben; N1.5 „verwaist — mit ersetzen nachziehen“ wird in A4 die Art `verwaist` mit `verweis`, nicht mehr ein Text.
- **Ein Leser überspringt eine unbekannte `art`** (er weist sie nicht ab). Sonst bricht B2 an jeder Art, die A4 später ergänzt.
- Reihenfolge, damit die Antwort bytegleich bleibt: erst `dateien_gekappt`, dann `zu_gross_zum_anzeigen` in der Reihenfolge der Dateiliste.
- Kein Text in der API: die Oberfläche formuliert (D0009, gestalter). `gross` und `nachladen` sind Merkmale der Datei, keine Hinweise.

### N4.6 Befehl für Dateiliste und Patch: `diff-tree`, nicht `diff` (ändert Punkt 6 „`git diff <eltern> <hash>`“)

| Option | Stärke | Schwäche |
|---|---|---|
| **D1 — `git diff`** (Porcelain) | gewohnt, Elternteil wählbar über zwei Bäume | startet `diff.external` und `textconv` ohne Schalter; Form und Inhalt hängen an einem Dutzend Schlüssel von `diff.*` (jeder neue Schlüssel einer späteren Git-Version ist eine neue Lücke); der Mutant „Schalter weg“ ist nur durch die Marken-Probe zu töten |
| **D2 — `git diff-tree -r`** (Plumbing, gewählt) | startet ohne Schalter weder externe Diffs noch `textconv`; liest die Oberflächenkonfiguration nicht (gemessen: bytegleich bei elf gesetzten Schlüsseln); Reihenfolge und Form hängen nicht an `diff.orderFile`, `diff.renames`, Präfixen, Kontext, Algorithmus | der erste Elternteil muss genannt werden (`--first-parent` wirkt nicht), der Wurzel-Commit braucht `--root`; die Mutanten „`--no-ext-diff` weg“ und „`--no-textconv` weg“ sind **gleichwertig** (ohne sichtbare Wirkung), der Test der Befehlszeile (AK 16 c) ist der einzige Beleg |
| D3 — `git show` / `git log -p` | ein Aufruf mit Metadaten | Porcelain mit allen Schwächen von D1 und Signaturprüfung (`log.showSignature`); Patch und Dateiliste nicht trennbar |

**Gewählt: D2.** Die Schalter bleiben trotzdem Pflicht (N2.3): sie sind der Gürtel zum Hosenträger, falls ein Git das Standardverhalten ändert oder ein späterer Befehl `diff` doch gebraucht wird. Damit sie nicht tot bleiben:
- **Gegenprobe der Marken-Probe (AK 16 a)** nennt außer `git diff` direkt in R auch `git diff-tree -p --textconv` direkt (gemessen: erzeugt die Marke); die Probe kann also auch für den gewählten Befehl rot werden.
- **Ein Befehl `diff` kommt erst in `Befehl`, wenn ein Aufrufer ihn braucht** (heute keiner, auch A4 braucht ihn nicht: `diff-tree -r <basis> <letzter> -- <dateien>` liefert denselben Netto-Diff). Er bleibt in der Liste von Punkt 3 als Obergrenze. Kommt er, gilt für ihn die Mutationsprobe mit der Marke (er kann sie töten) und die Matrix von N4.7.
- **Erster Elternteil:** der entwickler nimmt ihn aus `rev-parse --verify --quiet --end-of-options <hash>^1` (Ausstieg 1 = Wurzel, dann `--root --no-commit-id`) oder aus `%P` in `metadaten`; beides ist ein Prozess weniger oder mehr, die Wahl ist seine. Der Aufruf nennt immer zwei volle Hashes, nie einen Commit allein (Merge-Commit).

**Attribute des Arbeits-Repositorys (Befund, Inkauf):** `.gitattributes` im Arbeitsbaum, `.git/info/attributes` und `core.attributesFile` des Repositorys bestimmen, ob Git eine Datei als binär behandelt (`-diff`, `binary`), auch für einen alten Commit. Sie führen kein Programm aus (die Treiber sind durch die Schalter gesperrt), ändern aber `binaer`, `plus`, `minus`. Entschieden: **nicht neutralisieren.** `--attr-source=<hash>` und `-c core.attributesFile=/dev/null` würden Diff und Liste auseinanderlaufen lassen (`log --shortstat` in A2 nimmt weiter die Attribute des Arbeitsbaums, und ein `--attr-source` gilt für alle Commits eines Aufrufs), und FA 4 verlangt für `commits[0]` dieselben Werte wie die Liste. Folge für Punkt 9: **der `ETag` gilt unter der Annahme gleicher Attribut-Dateien**; ändert der Betreiber sie, kann ein 304 `binaer`, `plus` und `minus` veraltet lassen. Das ist kein Sicherheitsproblem und kein Fehler der Liste. Sollte: stellt eine spätere Karte beide Wege (Liste und Diff) auf `--attr-source` um, steht der `ETag` wieder auf festem Grund.

### N4.7 Schalter je Befehl im Startort (ändert N2.3 „Für die Diff-Scheibe festgelegt“, behebt die Form von `NACH_DIFF`)

`NACH_DIFF` ist heute eine Konstante für jeden Befehl mit `erzeugt_diffs` und enthält `--no-show-signature`. Das ist ein Schalter für Befehle, die Signaturen kennen (`log`, `show`); nach N4.6 ist `diff-tree` der Befehl der Scheibe und nimmt ihn nicht (auch wenn Git 2.48.1 ihn bei `diff` und `diff-tree` hinnimmt, siehe „Nicht reproduziert“: es gibt keinen Grund, einen Schalter zu setzen, den der Befehl nicht braucht, und jede Version, die ihn verwirft, wäre ein Ausfall). Der Startort setzt die Schalter **aus dem Befehl**, nicht aus einer gemeinsamen Konstante:

| Befehl | vor dem Befehl (Startort) | nach dem Befehl (Startort) | verboten für den Aufrufer |
|---|---|---|---|
| `log` | `-c core.quotepath=off` | `--no-ext-diff --no-textconv --no-color --no-show-signature` | `--ext-diff --textconv --color --show-signature` |
| `diff-tree` | `-c core.quotepath=off --literal-pathspecs` | `--no-ext-diff --no-textconv --no-color` | `--ext-diff --textconv --color` |

- `--literal-pathspecs` kommt aus dem Befehl: eine Pfadangabe ist dann immer wörtlich, auch wenn ein Aufrufer es vergisst (gemessen: ohne ihn trifft `a*b.txt` auch `axb.txt`).
- **Form und Inhalt** bestimmt die Lesefunktion des Moduls (nicht der Startort, nie der Dienst): `-r`, `-M50% -l1000`, `--submodule=short`, `--raw -z` und `--numstat -z` oder `-p`, die Pfadangabe nach `--` mit `alt` und `neu` einer umbenannten Datei. Präfixe, Kontext, Algorithmus und `-O` braucht `diff-tree` nicht (gemessen); setzt der entwickler sie trotzdem, ist es ein Gürtel ohne Pflicht.
- **Test der Befehlszeile (AK 16 c)** je Befehl **und** ein Lauf der Zeile gegen echtes Git mit Ausstiegscode 0 (die Zeichenfolge allein bewiese nicht, dass Git sie annimmt; so wird ein Schalter, den ein Befehl verwirft, beim Bau rot, nicht im Betrieb). Ein neuer Befehl braucht eine Zeile in der Matrix, sonst baut das Programm nicht.

### Folge für R00206 (Wortlaut für den planer; die Anforderung ändert der planer)

1. **Technikfragen 1, 2, 3 (Teil), 5**: bestätigt, Wortlaut der Anforderung bleibt. Zusätze: NFR Zeitgrenze „Die Uhr läuft ab Eintritt in den Handler, vor dem Warten auf den Blocking-Pool.“; FA 7 „Ein Leser überspringt eine unbekannte `art`.“ und „Reihenfolge: erst `dateien_gekappt`, dann `zu_gross_zum_anzeigen` in der Reihenfolge der Dateiliste.“; FA 12 „… ändert sich nie“ ergänzen um „solange die Attribut-Dateien des Arbeits-Repositorys gleich bleiben (ADR-0032 N4.6)“.
2. **FA 8 und NFR „Ausgabe mit Abbruch“**: „`datei=` liest die Dateiliste (`--raw -z`) ohne Kappe bis zur Bytegrenze für einzeln geladene Dateien (20 MB); ein Pfad, der darin nicht steht, ist 404 `{fehler}`, war die Liste abgeschnitten, nennt `fehler` den Grund.“ NFR: „Obergrenzen: Dateiliste je Lauf (`--raw -z`, `--numstat -z`) 1 MB (Hypothese), Patch-Lauf 4 MB, einzeln geladene Datei 20 MB.“ AK 11 erweitern: ein Commit mit 3.000 Dateien (Kappe 2.000): die Datei Nr. 2.500 ist per `datei=` ladbar; AK 10: `gezeigt 2000`, `gesamt` gleich `commits[0].dateien`.
3. **Technische Überlegungen B1011**: „Dateiliste in **zwei** Läufen (`--raw -z`, `--numstat -z`), weil `diff-tree` alle `--raw`-Einträge vor allen `--numstat`-Einträgen schreibt; verbunden nach Position.“ NFR „etwa fünf kurze Git-Prozesse“ → „etwa sieben“.
4. **Befehl (Frage 4, erster Teil) und NFR „Nur lesend“**: „neuer Befehl `diff-tree` (`diff` nicht; er bleibt in der Liste von ADR-0032 Punkt 3 und kommt in `Befehl` erst mit einem Aufrufer)“. Hinweise-Absatz „Gemessen …“: der Satz zu `diff --no-show-signature` (Ausstiegscode 128) ist in der Umgebung **nicht reproduzierbar** (ADR-0032 N4, „Belegt“); ersetzen durch „`--no-show-signature` gehört nur zu `log` (ADR-0032 N4.7)“ oder die Befehlszeile nennen, die 128 ergab. Der erste Elternteil wird genannt (`--first-parent` wirkt bei `diff-tree` nicht), der Wurzel-Commit läuft mit `--root`.
5. **AK 16 (c)**: „Befehle `log` und `diff-tree`“, dazu „und ein Lauf der Befehlszeile gegen echtes Git endet mit Ausstiegscode 0“; **(d)**: für `diff-tree` sind „`--no-ext-diff` weg“ und „`--no-textconv` weg“ gleichwertige Mutanten, der Test der Befehlszeile ist der Beleg; **(a) Gegenprobe**: zusätzlich `git diff-tree -p --textconv` direkt in R erzeugt die Marke. `--literal-pathspecs` ist Teil der Befehlszeile von `diff-tree` (Test (c)).
6. **Betroffene Verzeichnisstruktur und B1010**: statt „`Lauf` mit Bytegrenze und gelieferter Teilausgabe (`abgeschnitten`)“ → „`git_teil` mit Bytegrenze und `Teil { ausgabe, abgeschnitten }`; `git()` und `Lauf` unverändert; `Befehl::liefert_teil()`“; Tests des Moduls und Mutanten nach N4.4. Dazu Sollte: `-l1000` in `metadaten` (A2).
7. **Hinweis „Bytegrenze“**: „Die Regel ‚ein abgebrochener Prozess liefert nie eine Teilausgabe‘ bleibt für `git()` und jede Zeitüberschreitung; `git_teil` liefert nur bei der Bytegrenze einen Teil (ADR-0032 N4.4).“

### N4 Konsequenzen

- Positiv: der Diff hat eine Obergrenze (10 s, Antwort ≤ 15 s); die Liste kann technisch keinen Teil bekommen; der gewählte Befehl führt auch bei vergessenen Schaltern nichts aus und ist von `diff.*` unabhängig; die Schalter stehen je Befehl und werden gegen echtes Git gefahren; `hinweise` ist erweiterbar, ohne Leser zu brechen; `datei=` erreicht jede Datei eines großen Commits.
- Inkauf: eine zweite Lauf-Funktion; gleichwertige Mutanten bei `diff-tree` (nur der Test der Befehlszeile beweist die Schalter); ein Prozess mehr (Dateiliste in zwei Läufen, erster Elternteil); `ETag` hängt an den Attribut-Dateien des Arbeits-Repositorys; unscharfe Umbenennungs-Erkennung entfällt bei sehr großen Commits ohne Hinweis; JSON bis etwa sechsfach größer als die Git-Ausgabe bei Steuerzeichen; Kappe der Dateizahl und p95 < 500 ms sind Hypothesen bis B1014.
- Durchsetzung: Proben nach N4.4 (Teil, Zeit, Befehle), N4.2 (Zustandsmatrix durch Liste und Diff), N4.7 (Befehlszeile je Befehl gegen echtes Git), AK 16 a mit zwei Gegenproben; Messprotokoll der Lastprobe in B1014.

## Nachtrag 2026-11-20 N5: Speichergrenze der Diff-Antworten, Zuordnung Patch ↔ Datei über Blob-Hashes, Berichtigung N4 „Belegt“, Submodule in `metadaten` (Karte #213, Nacharbeit nach Code- und Security-Review)

Der bisherige Text bleibt stehen; N5 gilt, wo er N4 widerspricht. Entscheider: Claude (autonom, architekt, Lauf 213-architekt-2). Anlass: Security-Review M-S1 (Verfügbarkeit), Code-Review M1 (Zuordnung), Bericht des entwicklers (Abweichung von N4 „Belegt“, Befund am Bestand A2), Sollte S1/S2 des Security-Reviews.

**Belegt (gefahren 2026-11-20, Git 2.48.1, axum 0.8.9, hyper 1.12.0, tokio 1.54.1, Probe-Server und Wegwerf-Repository in `gemeinsam/scratchpad/arch-213/` der Factory, Last ~4, `nice -n 19`)**:
- **Ein Rumpf am Stück** (`Bytes` von 20 MB, wie heute `Json(…)` und `(…, text)`): 6 Verbindungen mit `SO_RCVBUF=4096`, die nichts lesen, halten 6 × 20 MB (VmRSS 3,6 → 126,9 MB) bis zum Schließen der Verbindung. Das bestätigt M-S1.
- **Budget für Antwortbytes** (Semaphore in KB, Platz in den Rumpf verlegt): 3 Antworten bekommen 200 und halten 60 MB, die übrigen 3 bekommen 503; VmRSS 65,5 MB. Mit dem Schließen kehren Speicher und Budget zurück. hyper pollt einen Strom nur, wenn der Schreibpuffer Platz hat. Die Rückstauung ist also wirksam.
- **Eine Zeitgrenze *im* Strom greift nicht** (`timeout_at` um `next()`): Liest der Client nicht, pollt hyper den Strom nie mehr, und die Uhr wird nie gefragt. Nach 6,5 s war das Budget noch belegt.
- **Eine Wache außerhalb des Stroms greift**: Rumpf und Platz liegen in einem geteilten Fach, ein eigener Task leert es nach der Frist. Das allein reicht aber nicht, solange die Stücke **Teilansichten** (`Bytes::slice`) des großen Puffers sind. hyper hält das zuletzt geholte Stück im Schreibpuffer, und eine Teilansicht hält den ganzen 20-MB-Puffer am Leben (Budget frei, RSS weiter 65 MB). Erst **kopierte Stücke** (`Bytes::copy_from_slice`, 64 KB) geben den Speicher frei: VmRSS fiel nach der Frist bei weiter offenen Verbindungen von 66,7 auf 5,3 MB. Schnelle Clients bekamen dieselben 20.971.520 Byte wie am Stück.
- **`git diff-tree -p --ext-diff` startet `diff.<treiber>.command` aus `.gitattributes`** (Marke entstand); ohne Schalter und mit `--no-ext-diff` entsteht keine. Damit ist der Bericht des entwicklers bestätigt (siehe N5.3).
- **`diff-tree` kennt `--pathspec-from-file` nicht** (Git 2.48.1: Aufruf endet mit der Usage-Meldung).
- **`--full-index`** schreibt in der Zeile `index` die vollen Hashes, gleich denen aus `--raw`. Mit `--literal-pathspecs … -- foo` kommen bei einem Typwechsel `foo/bar` → `foo` zwei Stücke: `foo` (`index 0000…..e803…`) und `foo/bar` (`index 8a12…..0000…`). Das bestätigt M1 des Code-Reviews.

### N5.1 Speichergrenze der Diff-Antworten (Security M-S1)

| Option | Stärke | Schwäche |
|---|---|---|
| S1 — Antwort direkt aus Git streamen | kleinster Speicher | Widerspricht N4.1 „nie eine Teilantwort“ (der Status steht vor dem Ende von Git fest), JSON-Form F2 und `hinweise` stehen erst am Ende fest, N4.4 L3 (zweiter Startort) wurde verworfen; großer Umbau |
| S2 — nur Schreib-Zeitgrenze | klein | Begrenzt nichts *innerhalb* der Frist: N Verbindungen × 33 MB bleibt linear; eine Zeitgrenze im Strom greift nicht (gemessen) |
| S3 — nur `GRENZE_EINZELN` senken | eine Konstante | Linear in N bleibt linear |
| S4 — nur Kopien sparen | Einzelanfrage kleiner | Linear in N bleibt linear |
| **S5 — Budget für Antwortbytes + Wache mit Frist + Rumpf in kopierten Stücken + weniger Kopien + `GRENZE_EINZELN` 8 MB** (gewählt) | Obergrenze unabhängig von N (gemessen); kein Teil, keine neue Antwortform; ein langsamer oder böser Client hält das Budget höchstens bis zur Frist | Mehr Teile als jede Einzeloption; ein Client, der das Budget füllt, macht andere große Diffs bis zur Frist zu 503 (lokales Werkzeug, Full-Trust: hingenommen); das Bauen der Antwort bleibt außerhalb des Budgets, ist aber durch die Lesegrenze (4 Plätze) begrenzt |

**Gewählt: S5.** Regeln mit Zahlen:
1. **Budget `ANTWORTBUDGET` = 64 MB** (67.108.864 Byte) über alle Antworten 200 von `GET …/diff`, JSON und `format=patch`, groß und klein. Es wird in KB gezählt und aufgerundet. Das Budget ist ein Wert in `Kanban` neben `lesegrenze`, kein globaler Zustand. 304 und Fehlerantworten zählen nicht.
2. **Wann reserviert wird**: Nach dem Bauen des fertigen Rumpfs (JSON-Bytes bzw. Patch-Text), **noch im Platz der Lesegrenze**, mit `try_acquire` (nicht warten). Ungezählter Speicher liegt damit nur während eines belegten Lesegrenzen-Platzes, also höchstens 4 Antworten im Bau gleichzeitig, jede ≤ 10 s.
3. **Überschreitung → sofort 503**, kein Warten (Warten hielte den fertigen Rumpf ungezählt im Speicher). Rumpf `{"fehler":"Antwortbudget von 64 MB belegt — Diff in einigen Sekunden erneut laden"}`. Der Text beginnt mit `Antwortbudget` (die Tests prüfen den Anfang). Die bestehende 503-Form (`Fehlerantwort`) bleibt; die OpenAPI-Beschreibung von 503 nennt beide Gründe. `Retry-After` ist frei (Optional).
4. **Ausliefern als Strom**: Der Rumpf geht in **kopierten Stücken von 64 KB** (`Bytes::copy_from_slice`, keine `slice`-Teilansicht, siehe „Belegt“) über `Body::from_stream`. Rumpf und Budget-Platz liegen in **einem** geteilten Fach. Der Strom gibt beides frei, sobald das letzte Stück geholt ist; ein Abbruch der Verbindung gibt es frei, weil der Strom fallen gelassen wird.
5. **Schreib-Zeitgrenze `SCHREIBFRIST` = 60 s** ab Übergabe des Rumpfs an hyper. Eine **Wache außerhalb des Stroms** (eigener Task mit `Weak` auf das Fach) leert das Fach nach der Frist. Der nächste Poll liefert einen Fehler, hyper trennt. Eine Zeitgrenze *im* Strom ist verboten, weil sie nicht greift (gemessen). 60 s reichen für die größte Antwort (≤ 48 MB) ab 0,8 MB/s.
6. **`GRENZE_EINZELN` (Patch einer einzeln geladenen Datei) 20 MB → 8 MB** (8.388.608 Byte). Grund: Die größte mögliche Antwort muss ins Budget passen, sonst gäbe es für diese Datei dauerhaft 503. JSON ist höchstens etwa sechsmal so groß wie die Git-Ausgabe (N4.3 Inkauf b): 8 MB × 6 = 48 MB < 64 MB. Bei gewöhnlichem Text passen etwa 8 große Antworten gleichzeitig ins Budget. Ein Patch über 8 MB ist `gross` mit `zu_gross_zum_anzeigen`, wie heute über 20 MB. **Die Dateiliste für `datei=`** (`--raw -z`, N4.3) behält 20 MB als **eigene Konstante** (`GRENZE_DATEILISTE_EINZELN`). Sie ist nur Zwischenstand im Bau und wird vor dem Patch-Lauf freigegeben.
7. **Einzelanfrage ≤ etwa 3× Antwort**. Heute (6,5×) entstehen Kopien durch `stuecke.concat()` für JSON, `text` als `Vec`, `from_utf8_lossy(…).into_owned()` auch bei gültigem UTF-8, `patch_text` mit einer zweiten Ersatz-Dekodierung und das Wachsen des Ziels beim Serialisieren. Die Form wählt der entwickler. Pflicht ist das Maß in der Abnahme. Hinweise: je Format nur die nötige Fassung halten (JSON: `patch`, Text: Stücke), gültiges UTF-8 ohne Kopie übernehmen, die Git-Ausgabe vor dem Serialisieren freigeben, das Ziel vorab auf die geschätzte Größe reservieren.

Was nicht gilt: Kein Warten auf Budget, kein Streaming aus Git, keine Änderung an `git_teil` oder an der Lesegrenze, keine Konfiguration (Konstanten im Modul; Tests dürfen Frist und Budget über einen internen Parameter verkleinern).

**Andere große Antworten mit demselben Muster (nur benannt, nicht ausgeweitet):** `GET /api/aufgaben/{nr}/anhaenge/{name}` (`anhang_lesen`) liest den Anhang ganz ein (bis 50 MB, `DefaultBodyLimit` beim Ablegen) und hält ihn bis zum Lesen des Clients. Dort ist der Anhang aber selbst abgelegt, nicht aus einem fremden Repository erzeugt. Eine Folgekarte kann dieselben Teile verwenden (Budget, Strom mit Kopien, Wache) oder die Datei direkt streamen. Die übrigen Antworten (Listen, CSV, OpenAPI) sind klein im Verhältnis.

Pre-Mortem: (a) Ein späterer Entwickler ersetzt `copy_from_slice` durch `slice`, um eine Kopie zu sparen. Der Speicher hängt dann wieder am Client, das Budget aber nicht (Probe 2 unten wird rot). (b) Jemand legt die Frist als `timeout` um den Strom. Sie greift nie (Probe 3 wird rot). (c) Ein großer Rumpf wird vor dem Reservieren außerhalb der Lesegrenze gebaut. Der Bau wäre dann linear in N (Probe 1 mit N = 30 wird rot).

### N5.2 Zuordnung Patch ↔ Datei über Blob-Hashes (Code-Review M1)

Ursache: Eine Pfadangabe trifft in Git immer auch alles darunter (`foo` trifft `foo/bar`, auch mit `--literal-pathspecs`). Der Patch-Lauf liefert dann fremde Stücke, und die Zuordnung nach Position verrutscht. Im abgeschnittenen Lauf hebelt `ganze = alle.len() - 1` die Zählprüfung aus, und ein falscher Patch erreicht eine Datei.

**Bestätigt mit Schärfung (Vorschlag des Code-Reviews):**
1. **`--full-index`** in jedem Lauf mit `-p` (Form des Moduls nach N4.7). Die Zeile `index <alt>..<neu>[ <modus>]` trägt dann die vollen Hashes. Verglichen wird **auf Gleichheit, nicht auf Präfix**, mit `alt`/`neu` aus `--raw`. Der Eintrag der Dateiliste behält dafür beide Blob-Hashes (nicht serialisiert).
2. **Schlüssel eines Stücks**: Mit `index`-Zeile das Paar der Hashes. Ohne `index`-Zeile (der Inhalt ist gleich, `alt == neu`: reine Umbenennung oder nur der Modus) zusätzlich `rename from/to` bzw. `old mode/new mode` gegen den Eintrag, die Pfade C-entquotet. Bei Typwechsel `T` gehören zwei Stücke zur Datei: erst `alt..0000…`, dann `0000…..neu`. `passt` (Status gegen Kopfzeilen) bleibt als zweite Prüfung.
3. **Zuordnung**: Die Dateien des Laufs gehen in ihrer Reihenfolge durch. Jede nimmt das nächste unbenutzte Stück mit ihrem Schlüssel. **Ein Stück, das zu keiner Datei des Laufs passt, ist fremd und wird verworfen** (kein Fehler, kein Patch an einer anderen Datei). Haben zwei Dateien des Laufs denselben Schlüssel, ist ihr Inhalt gleich; dann entscheidet die Reihenfolge.
4. **Abgeschnittener Lauf**: Nur die Stücke **vor** dem Schnitt zählen; das letzte angefangene Stück zählt nie (N4.4 Regel 5). Eine Datei, deren Stücke nicht vollständig vor dem Schnitt stehen, wird `nachladen` (Liste) bzw. `gross` (einzeln). Ein vollständiges Stück vor dem Schnitt, das weder fremd ist noch einer Datei zugeordnet wurde, ist ein Fehler (500 `Patch-Lauf: …`) — dieselbe Zählprüfung wie im ganzen Lauf, nur bis zum Schnitt.
5. **Nicht abgeschnittener Lauf**: Jede Datei des Laufs hat alle ihre Stücke (`stueckzahl()`), sonst 500. Fremde Stücke ändern daran nichts.
6. Dasselbe gilt für `datei_lesen`: Pfadangabe und Zählerlauf treffen dort ebenfalls `foo/…`. Der Zählerlauf (`--numstat`) wird über die Pfade **mit** dem Eintrag aus `--raw` verbunden (nicht über die Länge). Alternativ liest er dieselben Stücke der Dateiliste und filtert wie in Regel 3; die Wahl hat der entwickler.

Verworfen: Pfadangabe mit `:(exclude)foo/` (verträgt sich nicht mit `--literal-pathspecs`, das N4.7 als Pflicht setzt). Verworfen außerdem: Pfade aus der Kopfzeile `diff --git a/… b/…` parsen. Sie ist mehrdeutig bei Leerzeichen und quotiert; der Hash ist eindeutig und schon da.

### N5.3 Berichtigung N4 „Belegt“, erster Punkt

Falsch war: „`diff-tree -p --ext-diff` startet auch mit dem Schalter nichts“. **Richtig (gemessen vom entwickler, nachgefahren 2026-11-20):** `git diff-tree -p --ext-diff` startet `diff.<treiber>.command`, sobald `.gitattributes` einen Treiber nennt. Ohne Schalter und mit `--no-ext-diff` startet nichts. **Den Schutz tragen also `--no-ext-diff` vom Startort und das Verbot von `--ext-diff` für Aufrufer (N4.7, Spalte „verboten“).** Das Standardverhalten von `diff-tree` allein trägt ihn nicht. Folgen:
- N4.6, Zeile D2, „startet ohne Schalter weder externe Diffs …“ bleibt richtig (ohne Schalter heißt ohne `--ext-diff`). Die Mutanten „`--no-ext-diff` weg“ bleiben gleichwertig, solange niemand `--ext-diff` setzt.
- Die Gegenprobe der Marken-Probe (AK 16 a) nennt zusätzlich `git diff-tree -p --ext-diff` direkt in R; der entwickler hat sie als Gegenprobe 3 schon in beiden Marken-Proben.
- Der Test „verboten für den Aufrufer“ (Startort weist `--ext-diff` ab) ist ab jetzt die tragende Probe und kein Gürtel mehr. Er muss rot werden, wenn das Verbot fällt.

### N5.4 `--ignore-submodules=none` in `metadaten` (Bestand A2, R00204) — bestätigt

`log` folgt `diff.ignoreSubmodules=all` aus dem Repository und ließ Submodule aus `plus`, `minus` und `dateien` weg; `diff-tree` mit `--ignore-submodules=none` zählt sie. Ohne den Schalter in beiden liefen `commits[0]` des Diffs und die Dateien des Diffs auseinander (FA 4). **Richtig und bleibt.** Die Liste von R00204 ändert sich dadurch **nur** in Repositorys mit `diff.ignoreSubmodules` ≠ `none`: Dort zählt sie jetzt Submodule mit, wie in jedem anderen Repository. Das ist die Korrektur einer Abhängigkeit von der Oberflächenkonfiguration (gleiche Art wie `-l1000`, N4.3 „Beiläufig“), keine Änderung des Vertrags. Belegt durch `ak16b` (entwickler). Gürtel für spätere Befehle: `--ignore-submodules=none` gehört zur Form jedes Laufs, der Dateien zählt oder aufführt (Lesefunktion des Moduls, N4.7).

### N5.5 Sollte des Security-Reviews

- **S1 ARG_MAX (jetzt mitnehmen):** `--pathspec-from-file` gibt es für `diff-tree` nicht (gemessen). Unter Linux darf ein einzelnes Argument höchstens 128 KB lang sein, alle Argumente zusammen etwa 2 MB. Zwei Regeln im Patch-Lauf der Liste: (a) Eine Datei mit einem Pfad (`alt` oder `neu`) über `DATEI_HOECHSTENS` (4.096 Byte) kommt nicht in den Lauf und ist `gross` mit `zu_gross_zum_anzeigen`. `datei=` nimmt solche Pfade schon heute nicht an (400), es gibt also keinen Weg, der sie erreicht. (b) Die Summe der Pfad-Bytes der Pfadangabe ist höchstens `GRENZE_DATEILISTE` (1 MB). Dateien, deren Pfade die Summe überschreiten würden, kommen nicht in den Lauf und sind `nachladen`. Beides ist klein und schließt einen 500 im selben Code, den die Nacharbeit ohnehin anfasst.
- **S2 Serverpfad im `grund` der 404 (keine Änderung):** Das ist die bewusste Grenze nach N2.4 (lokales Werkzeug, Full-Trust, der Pfad hilft beim Beheben). Sie gilt für die Liste wie für den Diff und fällt erst mit einer Bereitstellung über ein Netz. Keine Folgekarte.
- Optional, Bestand: stderr ohne Grenze, Bindung an 0.0.0.0 ohne `--host`. Beides gehört nicht zu dieser Karte.

### Folge für R00206 (Wortlaut für den planer; die Anforderung ändert der planer)

1. NFR „Ausgabe mit Abbruch“/Obergrenzen: „einzeln geladene Datei 20 MB“ → „Patch einer einzeln geladenen Datei 8 MB; Dateiliste für `datei=` 20 MB“; neu: „Antwortbudget 64 MB über alle Antworten 200 von …/diff; Überschreitung 503 `Antwortbudget …`; Schreib-Zeitgrenze 60 s; Einzelanfrage ≤ etwa 3× Antwort (ADR-0032 N5.1)“. AKs mit 20 MB auf 8 MB umstellen.
2. FA zur Zuordnung: „Stück und Datei werden über die Blob-Hashes (`--full-index`) verbunden; fremde Stücke unter einer gleichnamigen Verzeichnis-Pfadangabe werden verworfen (ADR-0032 N5.2).“
3. Pfade über 4.096 Byte und die Summe der Pfadangabe nach N5.5 S1.

### N5 Konsequenzen

- Positiv: Der Speicher ungelesener Antworten ist unabhängig von N begrenzt (64 MB), ein Client hält ihn höchstens 60 s. Eine falsche Zuordnung von Patch und Datei ist ausgeschlossen, solange die Blob-Hashes stimmen. Ein pathologischer Pfad ergibt keine 500 mehr. N4 „Belegt“ stimmt wieder mit dem Code überein.
- Inkauf: Ein Client, der das Budget füllt, macht 60 s lang andere große Diffs zu 503. Das Bauen der Antwort zählt nicht zum Budget: im Worst Case 4 Plätze × 3 × 48 MB, nur bei Steuerzeichen-Patches, je höchstens 10 s. Einzelne Patches zwischen 8 und 20 MB sind nicht mehr ladbar (`gross`). Ein zweiter Task je ausgelieferter Antwort. Dateien mit Pfaden über 4 KB zeigen keinen Patch.
- Durchsetzung: die Abnahme-Proben im Bericht an den Director (Karte #213), als Tests in `tests/akzeptanz_r00206.rs` bzw. Modultests; Mutanten: `slice` statt Kopie, Frist im Strom, Budget nie belegt, fremdes Stück zugeordnet, Stückzahl im abgeschnittenen Lauf ungeprüft — jeder macht mindestens einen Test rot.

## Nachtrag 2026-11-20 N6: Gesamt-Diff der Karte — Basis, Spanne, Klassifikation je Datei, Merges, Antwortform mit Folge-Einträgen und Summen, Grenzen, Prozesszahl, `datei=`, `format=patch`, `ETag` (Karte #214, Scheibe A4)

Der bisherige Text bleibt stehen; N6 macht Punkt 7 (mit N1.5) baubar und gilt, wo er ihm widerspricht. Entscheider: Claude (autonom, architekt, Lauf 214-architekt-1). Ergänzt die Arten von `hinweise` nach N4.5 an dieser Stelle.

**Belegt (gefahren 2026-11-20, Git 2.48.1, `nice -n 19`, Last 1,1–1,3; Skripte und Rohwerte in `gemeinsam/scratchpad/arch-214/` der Factory: `erzeuger.py`, `messen.py`, `messung-20.txt`)**:
- Wegwerf-Repository nach dem Erzeuger aus B0998 (16.000 Commits auf `main`, 49 Zweige × 81, 5 verwaiste), dazu fünf Szenarien über `main`: zusammen 22.859 Commits, 55 Zweige, ohne `commit-graph`, gehärtet wie der Startort. Je Szenario 20 Läufe, p95 in ms:

  | Szenario | Urteil | Spanne (`rev-list`) | Namenslauf | Netto, 3 Läufe | Folge je Commit (Prozesse) | Folge über `--stdin`, 3 Läufe | Zweige Z5 kalt |
  |---|---|---|---|---|---|---|---|
  | S1: 30 Kartencommits linear | 10 Dateien netto | 8 | 3 | 6 | – | – | 120 |
  | S2: 30 Karte abwechselnd mit 30 fremd | 10 netto, 10 Folge, 29 fremd | 8 | 4 | 8 | 62 (30) | 9 | 131 |
  | S3: 30 Karte gestreut in 1.000 | 10 netto, 30 Folge, 928 fremd | 8 | 25 | 8 | 170 (90) | 20 | 140 |
  | S4: 2 Karte, 1.498 fremd dazwischen | ganz als Folge | 8 | – | – | 12 (6) | 6 | 154 |
  | S5: 300 Kartencommits linear | 100 netto | 10 | 11 | 10 | – | – | 132 |
  | S5 erzwungen ganz als Folge | 300 Commits | | | | **2.217 (900)** | **38 (3)** | |

  Vorlauf (Wurzel, `cat-file`, `log` der Metadaten) 5–24 ms; `merge-base --independent` 3–22 ms, mit einem Kartencommit 22.000 Commits tief 50 ms. Kalt gesamt für S3 etwa 230 ms, mit warmem Zweig-Cache etwa 90 ms.
- **Umbenennung über einen fremden Commit** (K1 ändert `a`, F ändert `a`, K2 benennt `a` → `b` um): der Netto-Lauf mit der Pfadangabe aller Kartenpfade (`a`, `b`, `k`) meldet `R082 a → b`; mit der Pfadangabe nur `b` erscheint die Zeile von F als `+` im Netto (gemessen: 1 Treffer). Die Folge-Patches von K1 und K2 enthalten keine `+`/`−`-Zeile von F; eine Kontextzeile eines Kartenschritts kann Text aus F zeigen (so wie der Diff je Commit).
- **Merge-Commits**: `diff-tree --stdin` liefert für einen Merge ohne genannten Elternteil nichts; mit der Zeile `<merge> <erster Elternteil>` liefert er die Dateien, die der Merge auf die Hauptlinie bringt. Der Diff eines Merges gegen den ersten Elternteil enthält die Arbeit der Seitenlinie (gemessen: `y` aus einem fremden Zweig).
- **Bytegleich**: `diff-tree -r -p -M50% -l1000 --full-index --submodule=short <basis> <letzter>` ist bytegleich zu `git diff --full-index -M50% -l1000 --submodule=short <basis> <letzter>` (ohne Konfiguration); ohne `--full-index` bei `git diff` nicht (Zeile `index`).
- Der leere Baum `4b825dc642cb6eb9a060e54bf8d69288fbee4904` (SHA-256: `6ef19b41225c5369f1c104d45d8d85efa9b057b53b14b4b9b939dd74decc5321`) ist für Git immer vorhanden, auch ohne Objekt in der Datenbank (`cat-file -t` → `tree`, `diff-tree` läuft).

### N6.1 Basis und letzter Commit (präzisiert Punkt 7.2)

| Option | Stärke | Schwäche |
|---|---|---|
| **B1 — erster Elternteil des ältesten Kartencommits auf der Erst-Eltern-Linie des letzten** (gewählt) | genau die Arbeit der Karte, unabhängig vom Zielzweig; hängt nur an Hashes; ein Prozess (`rev-list`) | eine Karte, die über eine Seitenlinie gemergt wurde, fällt in die Folge (N6.4) |
| B2 — `merge-base` mit dem Zielzweig | entspricht „Files changed“ eines Pull Requests | verlangt einen Zielzweig, den kanbanD nicht kennt; zeigt fremde Commits auf dem Kartenzweig vor dem ersten Kartencommit; ändert sich, wenn `main` weiterläuft |
| B3 — je Commit sein Elternteil | nie fremd | ist die Folge, kein Gesamtbild |

- **Letzter**: `merge-base --independent <alle einbezogenen>`; genau ein Kopf ist der letzte, mehr Köpfe heißen `nicht_linear` (N6.4). Bei einem einzigen Kartencommit entfallen dieser Lauf und die Spanne.
- **Spanne**: ein Lauf `rev-list --first-parent --parents --max-count=<1000 + k + 1> --end-of-options <letzter>` (k = Zahl der einbezogenen Kartencommits). Gelesen wird, bis alle Kartencommits gesehen sind; **Basis** ist der erste Elternteil des zuletzt gesehenen (des ältesten). Hat er keinen, ist die Basis der leere Baum (Konstante je Objektformat, nicht `--root`). Endet die Ausgabe vorher, liegt ein Kartencommit nicht auf der Linie (`nicht_linear`); ist die Höchstzahl erreicht, sind es mehr als 1.000 fremde (`fremd_zu_viele`).
- Commits auf verschiedenen Zweigen (ein Teil auf `main`, der Rest auf `karte/<nr>` darüber) sind kein Sonderfall (N1.5): es zählt der Graph, nicht der Zweig.

### N6.2 Ablauf und Zahl der Git-Prozesse

| Option für Namen und Folge | Stärke | Schwäche |
|---|---|---|
| P1 — je Kartencommit drei Läufe `diff-tree` (Liste, Zähler, Patch) | die Leser aus A3 passen unverändert | 3 Prozesse je Commit: 900 Prozesse, 2,2 s bei 300 Commits und Last 1 (gemessen); wächst mit der Karte |
| **P2 — `diff-tree --stdin` mit je einer Zeile `<commit> <erster Elternteil>`** (gewählt) | konstante Zahl der Prozesse (3 statt 900, 38 ms statt 2.217 ms); der Elternteil ist ausdrücklich genannt (Merges, N6.5) | die Ausgabe vieler Commits muss nach Commits zerlegt werden; `git_teil` braucht eine Eingabe |
| P3 — `log -p` / `log --name-only` | ein Porcelain-Aufruf | liest `diff.*` (z. B. `diff.renames`: bei `--name-only` fehlt der alte Pfad einer Umbenennung, die Fremdmenge würde zu klein), Signaturprüfung; verworfen wie D1/D3 in N4.6 |

**Gewählt: P2.** Ablauf je Anwendung, höchstens **15 Git-Prozesse, unabhängig von der Zahl der Commits**:
1. Wurzel, `cat-file --batch-check`, `log` der Metadaten (wie die Liste; liefert Elternteile, Titel, Zähler).
2. Zustand mit **demselben Helfer wie die Liste** (Fingerabdruck, Cache oder Z5, zweite Probe; 3 Prozesse kalt, 1 warm). Einbezogen wird `auf_zweig` (N1.5).
3. `merge-base --independent` (1), Spanne `rev-list` (1).
4. *(geändert durch N7.1: mit `-M50% -l1000` statt `--no-renames`)* **Namenslauf** (1): `diff-tree --stdin -r --raw -z --no-renames` über alle Commits der Spanne (Karte und fremd), je Zeile `<commit> <erster Elternteil>`. `--raw` statt `--name-only`, damit die Zerlegung strukturell ist: ein Kopf (voller Hash) steht nur dort, wo ein Eintrag mit `:` erwartet wird; ein Pfad, der wie ein Hash aussieht, wird nie Kopf.
5. **Netto** (bis zu 3): Liste, Zähler, Patch `diff-tree <basis> <letzter>` wie in A3 (N4.3, N5.2).
6. **Folge** (bis zu 3): Liste, Zähler, Patch über `diff-tree --stdin` für die Kartencommits, die eine Folge-Datei berühren, Pfadangabe = Folge-Pfade; zerlegt nach den Köpfen in der Reihenfolge der Eingabe.

Inkauf: Die Zerlegung einer Ausgabe mit vielen Köpfen ist neu (Zähler `--numstat -z` mit Umbenennung: leerer Pfad, dann zwei Pfade; Patch: Kopf als eigene Zeile, wo `diff --git` erwartet wird). Ziel des Lastprofils: Gesamt-Diff von 30 Commits kalt **p95 < 500 ms** im 20.000er-Repository (gemessen ~230 ms bei Last 1,3 im Messskript; die Lastprobe der Karte misst über die API). Punkt 9 „< 2 s für 30 Commits“ wird damit enger.

### N6.3 Netto oder Folge je Datei (präzisiert Punkt 7.3 und 7.4)

*(Regel „netto genau dann“ und „übrige Kartenpfade sind Folge“ geändert durch N7.1 Gruppen; Pfadangaben durch N7.2)*

- Aus dem Namenslauf: `D_karte` = Pfade der Kartencommits, `D_fremd` = Pfade der übrigen Commits der Spanne (dazu Merges der Karte, N6.5). Ohne Umbenennungserkennung, also mit **beiden** Pfaden einer Umbenennung.
- **Netto-Lauf**: Ist `D_fremd` leer, ohne Pfadangabe (die Spanne ist reine Kartenarbeit). Sonst Liste und Zähler mit der Pfadangabe **`D_karte`** (nicht nur der Netto-Pfade: sonst wird eine Umbenennung über einen fremden Commit zu `A` mit dessen Zeilen, gemessen), Patch mit den Pfaden der Netto-Einträge.
- **Ein Eintrag ist netto genau dann, wenn keiner seiner Pfade (`alt`, `neu`) in `D_fremd` liegt** und alle in `D_karte` liegen. Ein Eintrag mit einem Pfad außerhalb von `D_karte` (Pfadangabe `foo` trifft `foo/…`, N5.2) wird verworfen. Alle übrigen Kartenpfade sind **Folge-Dateien**.
- Inkauf: eine Kopie oder eine Umbenennung unter 50 % Ähnlichkeit, deren Quelle ein fremder Commit vorher geändert hat, erscheint als neue Datei der Karte (wie im Diff des Commits selbst); ab 50 % (`R`) ist sie Folge.

### N6.4 Ganz als Folge (präzisiert Punkt 7.2 und 7.5)

Die ganze Anwendung erscheint als Folge (alle Dateien der einbezogenen Kartencommits, je Datei ein Folge-Eintrag) mit dem Hinweis `ganz_als_folge` und `grund`:
- `nicht_linear`: mehr als ein Kopf, oder ein Kartencommit liegt nicht auf der Erst-Eltern-Linie (z. B. über einen Merge aus einer Seitenlinie gebracht);
- `fremd_zu_viele`: mehr als 1.000 fremde Commits in der Spanne (Punkt 7.5 bleibt);
- `fremd_zu_gross`: der Namenslauf ist an seiner Bytegrenze abgeschnitten, oder die Pfadangabe `D_karte` überschritte 1 MB (N5.5 S1). Eine unvollständige Fremdmenge ist nie Grundlage eines Netto-Diffs.

Reihenfolge der Schritte: auf der Linie vom ältesten zum letzten; ganz als Folge wie die Liste (Datum aufsteigend, bei Gleichstand Reihenfolge der Datei, po-entscheidungen Z. 392).

### N6.5 Merge-Commits

- **Fremde Merges in der Spanne** zählen mit ihrer Änderung gegen den ersten Elternteil zu `D_fremd` (Zeile `<merge> <erster Elternteil>`; ohne sie fehlte, was der Merge brachte, und es erschiene netto).
- **Merges an der Karte** werden **nicht einbezogen**: ihr Diff gegen den ersten Elternteil trägt die Arbeit der Seitenlinie, die meist fremd ist. Sie zählen wie fremd zu `D_fremd` und stehen in `hinweise` (`merge_ausgelassen`). Der Diff je Commit (A3) bleibt für sie lesbar. Inkauf: die Konfliktauflösung eines Merges der Karte fehlt im Gesamtbild (sichtbar am Hinweis).

### N6.6 Antwortform und Summen der Folge-Dateien (beantwortet die Frage des gestalters, `_wireframes.md` D0009, po-entscheidungen Z. 405)

`GET /api/aufgaben/{nr}/diff` ohne `commit`, **eine Anwendung je Antwort**: `{anwendung, spanne, commits, dateien, hinweise}`.
- `anwendung=<kürzel>` wählt sie (leer = Standardanwendung). Ohne den Parameter gilt die erste Anwendung in der Reihenfolge der Verweise an der Karte; gibt es weitere, nennt sie der Hinweis `weitere_anwendungen` (`anwendungen: [kürzel]`). Grund: jede Antwort hat die Grenzen und das Budget einer A3-Antwort; die Review-Seite zeigt ohnehin einen Abschnitt je Anwendung. Keine Verweise dieser Anwendung (oder keine an der Karte) → 404 `{fehler}`; `repository_fehlt` → 404 wie A3.
- `spanne`: `{basis, letzter}` (volle Hashes; `basis` null beim leeren Baum), bei `ganz_als_folge` null. Damit ist der Netto-Teil für einen Agenten nachprüfbar.
- `commits`: die einbezogenen Kartencommits in der Reihenfolge der Schritte, je Eintrag wie `Diffcommit` (R00206 FA 4).
- `dateien`: nach dem Namen (`neu`, bei gelöschten `alt`) in Bytefolge, Netto- und Folge-Einträge gemischt.
  - **Netto-Eintrag**: unverändert die Datei aus A3 (`Diffdatei`).
  - **Folge-Eintrag**: `{pfad, plus, minus, binaer, schritte: [{commit, <Felder der Diffdatei>}]}`; `commit` ist der Verweis wörtlich wie in der Datei. Gruppiert nach dem Namen des Schritts; eine Umbenennung steht beim neuen Pfad.
- **Summen**: `plus`/`minus` eines Folge-Eintrags ist die **Summe der Schritte**, gebildet vom Server; `binaer` ist wahr, wenn ein Schritt binär ist. Eine **Netto-Zahl gibt es für Folge-Dateien nicht**: sie enthielte die Zeilen der fremden Commits, passte nicht zum Diff darunter (Bedingung des PO) und verriete fremde Arbeit als Zahl. Inkauf: eine Zeile, die die Karte hinzufügt und später wieder ändert, zählt in der Summe zweimal.

### N6.7 Arten von `hinweise` (ergänzt N4.5)

Neu, in dieser Reihenfolge vor den Arten aus A3: `ganz_als_folge` (`grund`), `fremd_dazwischen` (`commits`: Zahl der fremden Commits in der Spanne, `dateien`: Zahl der Folge-Dateien; nur, wenn es Folge-Dateien gibt), `weitere_anwendungen` (`anwendungen`), `verwaist` (`verweis`, je Verweis in der Reihenfolge der Datei; ersetzt den Text aus N1.5), `merge_ausgelassen` (`verweis`), `ausgelassen` (`verweis`, `zustand`: `fehlt`, `unlesbar`, `anwendung_unbekannt`). Danach `dateien_gekappt` und `zu_gross_zum_anzeigen` wie A3. Verweise ohne Anwendung (`unlesbar`, `anwendung_unbekannt`) stehen in jeder Antwort. Kein Hinweis je Folge-Datei: der Eintrag mit `schritte` ist das Merkmal.

### N6.8 Grenzen, Budget, Zeit — dieselben wie A3

- Je Netto-Datei und je Schritt: 256 KB / 3.000 Zeilen → `gross` (N4.3). **4 MB gelten für die Summe** aus Netto- und Folge-Patch-Lauf: der Folge-Lauf bekommt den Rest; ohne Rest sind alle Schritte `nachladen` ohne Lauf. Liste und Zähler je Lauf 1 MB. **Kappe 2.000 Einträge** (ein Folge-Eintrag zählt einmal); ein Folge-Eintrag erscheint nur mit allen Schritten, sonst fehlt er und zählt in `dateien_gekappt`. `gesamt` = Zahl der Einträge ohne Kappe; war ein Listenlauf abgeschnitten, die Zahl der Pfade von `D_karte` (Obergrenze).
- Neu: Bytegrenze des Namenslaufs **4 MB** (`GRENZE_NAMEN`, Startwert, Hypothese; etwa 40.000 Einträge). *(Folgen eines abgeschnittenen Namenslaufs geändert durch N7.3)*
- Gesamtgrenze 10 s ab Eintritt in den Handler, Antwort ≤ 15 s, keine Teilantwort (N4.1); ein Platz der Lesegrenze für die ganze Anfrage; Antwortbudget 64 MB, Strom und Schreibfrist wie N5.1. Die größte Antwort bleibt wie in A3 (4 MB Patch bzw. 8 MB mit `datei=`).

### N6.9 `datei=` und `format=patch`

- `?datei=<pfad>` ohne `commit`: dieselbe Antwortform mit genau diesem Eintrag, Patch bis 8 MB (bei Folge über alle Schritte zusammen). Der Pfad muss **in `D_karte` stehen** (sonst 404 `{fehler}`); nur so erreicht ein Pfad Git, wörtlich. Netto oder Folge wird wie in N6.3 bestimmt (die Kosten sind die einer Anfrage ohne `datei=`). Ein einzelner Schritt bleibt zusätzlich über `?commit=<verweis>&datei=<pfad>` (A3) ladbar.
- `?format=patch`: oben je Hinweis eine Zeile `# kanbanD: <art> …`; Netto-Dateien als Patch von Git; vor jedem Schritt einer Folge-Datei `# kanbanD: Folge <pfad> — Schritt i von n, Commit <verweis>`; fehlende Patches wie R00206 FA 9. Ohne Hinweise und ohne Folge ist der Text **bytegleich** zu `git diff --full-index -M50% -l1000 --submodule=short <basis> <letzter>`.
- `anwendung=` zusammen mit `commit=` → 400 (der Verweis trägt sein Kürzel). `commit=` bleibt wie R00206 FA 2: ein Präfix nur mit Kürzel, ohne Kürzel nur für die Standardanwendung. **A4 ändert daran nichts** (Hinweis aus #209): der Gesamt-Diff braucht keinen Verweis, die Review-Seite löst ein nacktes Präfix weiter über die Liste auf.

### N6.10 `ETag` (präzisiert Punkt 9 für den Gesamt-Diff)

*(gebaut strenger, siehe N7.5)*

| Option | Stärke | Schwäche |
|---|---|---|
| E1 — kein `ETag` | einfach | jede Wiederholung rechnet neu (~90–230 ms) |
| E2 — aus den Verweisen der Anwendung allein, 304 ohne Git | wie A3 | falsch: bewegt sich ein Zweig, wird ein Commit `verwaist` und fällt heraus, der 304 zeigte ihn weiter |
| **E3 — aus Verweisen (wörtlich, in Reihenfolge), Fingerabdruck der Zweigspitzen, `anwendung`, `datei`, `format`, `GRENZEN_VERSION`** (gewählt) | richtig, solange die Spitzen gleich sind; 304 nach 2 Git-Prozessen (Wurzel, `for-each-ref`, ~5 ms) | jede Bewegung eines Zweigs im Repository macht ihn ungültig |

Inkauf wie N4.6 (Attribut-Dateien) und: ein verwaister Commit, den `git gc` entfernt, wechselt im Hinweis von `verwaist` zu `ausgelassen fehlt`, ohne dass sich der `ETag` ändert.

### N6.11 Startort

- `Befehl::MergeBase` (`merge-base`, schon in der Liste von Punkt 3) ohne Schalter, `liefert_teil()` falsch, nur `--independent`.
- `git_teil` bekommt eine Eingabe auf `stdin` (für `diff-tree --stdin`); die Regeln aus N4.4 bleiben (nur `DiffTree` liefert einen Teil). Die Pfadangabe nach `--` gilt auch mit `--stdin` (gemessen).
- Ein Befehl `diff` kommt weiterhin nicht dazu (N4.6).

### N6 Durchsetzung (Abnahme-Proben, Wegwerf-Repository im Test)

1. K1, F (dieselbe Datei), K2: die Datei ist Folge mit zwei Schritten K1, K2, **keine `+`/`−`-Zeile von F** in irgendeinem `patch`, `fremd_dazwischen {commits: 1, dateien: 1}`; Summe = Schritte. Ohne F: `format=patch` bytegleich zu `git diff --full-index -M50% -l1000 --submodule=short K1^ K2`, `spanne` = `{K1^, K2}`. Mit verwaistem Zwilling K1' an der Karte: Ergebnis gleich, Hinweis `verwaist K1'`.
2. Umbenennung über einen fremden Commit (wie „Belegt“): `b` ist Folge, keine `+`-Zeile von F. Der Mutant „Pfadangabe des Netto-Laufs nur Netto-Pfade“ macht die Probe rot.
3. Fremder Merge in der Spanne, der eine Kartendatei ändert: die Datei ist Folge; der Mutant „Merge ohne Elternzeile im Namenslauf“ macht die Probe rot. Merge an der Karte: nicht in `commits`, Hinweis `merge_ausgelassen`, kein Inhalt der Seitenlinie.
4. Nicht linear (zwei Zweige), 1.001 fremde, Namenslauf abgeschnitten (Grenze über einen internen Parameter verkleinert): je `ganz_als_folge` mit dem Grund; nie ein Netto-Eintrag.
5. **Prozesszähler** (`arbeitsrepo::aufrufe()`, gemeinsam/gelerntes „Arbeit ≤ k × Buchung“): kalte Anfrage mit 1, 10 und 30 Kartencommits, mit und ohne Folge, je ≤ 15 Git-Prozesse, gleich für 10 und 30; 304 mit 2.
6. `ETag`: Zweig bewegt → anderer `ETag`; unverändert → 304 mit 2 Prozessen.
7. Nur lesend: Marken-Probe aus A3 (AK 16 a) über den Gesamt-Diff, `count-objects -v` und `status --porcelain` unverändert.
8. Lastprobe über die API wie R00206 AK 15: 30 Commits, 20.000er-Repository, kalt p95 < 500 ms.

Review-Punkt für `security-reviewer` und `architektur-reviewer`: Netto nur mit vollständiger Fremdmenge; jede Pfadangabe aus `D_karte`; neue Befehle nur im Startort.

Pre-Mortem: (a) Jemand spart die Pfadangabe `D_karte` und nimmt nur die Netto-Pfade → Leck über Umbenennung (Probe 2). (b) Der Namenslauf wird auf `log --name-only` umgestellt → `diff.renames` aus dem Repository verschluckt alte Pfade (P3). (c) Ein abgeschnittener Namenslauf wird als vollständig behandelt → Netto mit fremden Zeilen (Probe 4). (d) Folge je Commit statt `--stdin` → die Prozesse wachsen mit der Karte (Probe 5).

### N6 Konsequenzen

- Positiv: konstante Prozesszahl (≤ 15) und kurze Laufzeit auch bei 300 Commits; fremde `+`/`−`-Zeilen sind über Umbenennung, Merge und abgeschnittene Läufe ausgeschlossen; Summen der Folge-Dateien kommen fertig aus der API; ein Agent bekommt mit einem Aufruf das Gesamtbild der ersten Anwendung und den Hinweis auf weitere.
- Inkauf: eine neue Zerlegung für Ausgaben vieler Commits; Kontextzeilen eines Kartenschritts können fremden Text zeigen; Kopie und schwache Umbenennung aus einer fremd geänderten Datei gelten als Kartenarbeit; Konfliktauflösungen in Merges der Karte fehlen; der `ETag` wird bei jeder Zweigbewegung ungültig; Summen zählen später geänderte Zeilen doppelt.

## Nachtrag 2026-11-20 N7: Gruppen über Umbenennungen der Karte, abgeschlossene Pfadangaben, Namen über 4 MB, gehärteter Startort, `ETag` über alle Verweise (Karte #214, Nacharbeit 1)

Der bisherige Text bleibt stehen; N7 gilt, wo er N6 widerspricht. Entscheider: Claude (autonom, architekt, Lauf 214-architekt-2). Anlass: Code-Review B1–B5 und Security-Review S1/S2 an #214, gebaut in der Nacharbeit 1 (`26623c02` … `b9b6dcd0`), dazu die Abweichungen, die der architektur-reviewer als vertretbar gemeldet hat. N7 trägt den gebauten Stand nach; er ist belegt durch Abnahme-Proben, die vor dem Fix rot waren, und eine Zufallsprobe über 1.200 Seeds mit 0 Verstößen gegen „nie fremd“ und 0 Antworten 500 (vorher 25 Verstöße bei 60 Seeds; 76 Verstöße in 391 Szenarien hatten alle eine Umbenennung).

**Was N6.3 übersehen hat:** Die Regel „netto genau dann, wenn kein Pfad in `D_fremd` liegt“ prüfte nur die Pfade **eines** Eintrags. Ein fremder Commit F legt `f.txt` an, der Kartenschritt K2 benennt `f.txt` nach `c.txt` um. Der Netto-Lauf zwischen Basis und letztem kennt `f.txt` nicht (es gab sie an der Basis nicht), also erscheint `c.txt` als `A` mit den Zeilen von F. Im Namenslauf ohne Umbenennung waren `f.txt` und `c.txt` zwei unverbundene Pfade, und `c.txt` galt als rein. Der Folge-Lauf, der nur die Folge-Pfade nannte, zerlegte die Umbenennung zudem in `D` und `A`, und K2 zeigte `-`-Zeilen von F.

### N7.1 Namenslauf mit Umbenennung, Gruppen (ersetzt N6.2 Schritt 4 „`--no-renames`“ und die Regel in N6.3)

- Der Namenslauf läuft mit **`-M50% -l1000`** wie jeder andere Lauf (`diff_tree_viele`, `Vielart::Namen`). Ein Eintrag mit Umbenennung trägt beide Pfade **und ihr Paar**; die Menge der Pfade ist dieselbe wie ohne Umbenennung, das Paar ist neu.
- **Gruppen**: Pfade, die ein **Kartenschritt** durch eine Umbenennung verbindet, bilden eine Gruppe (transitiv, über Ketten `a → m → z`). Eine Gruppe ist ganz netto oder ganz Folge.
- Eine Gruppe ist **belastet**, wenn ein fremder Commit der Spanne (oder ein Merge der Karte, N6.5) einen ihrer Pfade berührt.
- **Netto genau dann**, wenn jeder Pfad des Eintrags in `D_karte` liegt und keiner in `D_fremd` oder in einer belasteten Gruppe. **Folge-Pfade** sind alle Kartenpfade, die kein Netto-Eintrag trägt, außer **Zwischennamen** einer unbelasteten, schon netto gedeckten Gruppe: K1 benennt `a` nach `m`, K2 `m` nach `z`; netto steht `a → z`, `m` erscheint nirgends.
- Umbenennungen **fremder** Commits verbinden nichts; ihre Pfade liegen ohnehin beide in `D_fremd`.
- Inkauf: Mehr als 1.000 Umbenennungskandidaten in einem Kartenschritt (`-l1000`) heben die unscharfe Erkennung auf. Das Paar fehlt dann, und die Gruppe zerfällt. Das ist nicht abgedeckt (offen aus der Nacharbeit) und bleibt eine bekannte Grenze, wie in N4.3 für den Diff je Commit. Unberührt bleibt die Inkaufnahme aus N6.3 (Kopie, Umbenennung unter 50 %). Ebenso das Risiko, das der code-reviewer als richtig bestätigt hat: Ein Kartenschritt, der Zeilen eines fremden Commits selbst löscht oder umschreibt, zeigt sie als `-`-Zeilen; das ist Arbeit der Karte (Wortlaut für den planer: „… außer der Kartenschritt löscht oder schreibt sie selbst um“).

### N7.2 Jede Pfadangabe wird gegen ihren Bezugslauf abgeschlossen (präzisiert N6.3 „Pfadangabe“ und N6.9)

- Eine Pfadangabe `d/x` trifft in Git auch `d/x/…`, auch mit `--literal-pathspecs` (N5.2). Im Netto- und im Folge-Lauf ließ das Git Einträge **neu paaren** (Typwechsel Datei ↔ Verzeichnis mit gleichem Blob), und die Zuordnung endete in 500.
- **Regel** (`abschliessen`, Modell): Jede Pfadangabe eines Laufs wird gegen die Einträge seines **Bezugslaufs** abgeschlossen. Für den Netto-Patch ist das die Netto-Liste, für den Folge-Patch je Commit die Liste des Folge-Laufs dieses Commits, für `datei=` die Liste des Laufs. Jeder Eintrag des Bezugslaufs, dessen Pfad die Angabe genau oder als `…/` trifft, kommt mit **allen** seinen Pfaden hinein, bis nichts mehr dazukommt. So sieht der Lauf nur ganze Einträge und paart wie der Bezugslauf.
- **Zuordnung im Bezug** *(berichtigt nach Nacharbeit 2, `7b177c0f`; ersetzt „die Stücke der mitgenommenen Einträge verwirft die Zuordnung als fremd, N5.2 Regel 3“)*: Die Zuordnung der Stücke (N5.2) läuft über **alle** Einträge des Bezugslaufs, die die abgeschlossene Pfadangabe trifft (`getroffen`), in der Reihenfolge des Bezugslaufs, auch über die mitgenommenen (`patches_zuordnen_im_bezug`). Erst danach bekommen nur die angefragten Einträge ihr Ergebnis; die Stücke der mitgenommenen werden verworfen. Grund: Ein mitgenommener **Zwilling** (gleicher Blob, gleiche Art) hat denselben Schlüssel wie ein angefragter Eintrag und ist am Schlüssel allein nicht als fremd zu erkennen; sonst nimmt einer das Stück des anderen, oder die Zählprüfung schlägt fehl. Die Zählprüfung bleibt streng: Fehlt einem getroffenen Eintrag eines nicht abgeschnittenen Laufs ein Stück, ist das 500, wie in N5.2 Regel 4 und 5.
- Die Grenze von 1 MB für die Pfadangabe (N5.5 S1) gilt für die abgeschlossene Angabe.

### N7.3 Namen über 4 MB (ersetzt N6.4 `fremd_zu_gross` für den Fall „Namen der Karte selbst zu groß“, ergänzt N6.8)

- **Spanne nur aus Kartencommits**, Namenslauf abgeschnitten: `D_fremd` ist sicher leer, alles ist netto, der Netto-Lauf läuft ohne Pfadangabe. Unvollständig sind nur die Namen. Antwort 200.
- **Spanne mit fremden Commits**, Namenslauf abgeschnitten: wie N6.4 `ganz_als_folge` mit `fremd_zu_gross`. Dafür läuft ein zweiter Namenslauf nur über die Kartencommits. Ist auch er abgeschnitten, kann kein Folge-Eintrag sicher vollständig sein: Die Antwort ist 200 mit `dateien: []`, `commits` vollständig und `dateien_gekappt {gezeigt: 0, gesamt: <Obergrenze>}`. Die Obergrenze ist die Summe der `dateien` der Kartenschritte aus den Metadaten; eine Datei in mehreren Schritten zählt dabei mehrfach. Mit `datei=` ergibt das 404 `{fehler}`; der Text verweist auf `commit=` und `datei=` (A3). Nie 500 (Code-Review B3: 42.000 Dateien, 2 × 21.000 Dateien).
- `GRENZE_NAMEN` (4 MB) ist ein **internes Feld** in `Kanban` (`grenze_namen`), damit Tests sie verkleinern können, keine Konfiguration (wie Frist und Budget in N5.1). Offen (Optional des architektur-reviewers): Der zweite Namenslauf nutzt noch die Konstante statt des Feldes; der Randfall „zweiter Lauf abgeschnitten“ ist deshalb nur mit großen Repositories probbar.

### N7.4 Startort: `--` hinter den Revisionen, keine Ersatzobjekte (ändert N2.3 und N6.11)

- **`--` immer hinter den Revisionen**: in `git_teil` (also in jedem Lauf `diff-tree`, auch ohne Pfade), in `metadaten` (`log`) und in `linie` (`rev-list`). `--end-of-options` beendet die Mehrdeutigkeitsprüfung „Revision oder Dateiname“ nicht. Eine Datei, die wie ein Commit-Hash heißt, legte sonst Liste, Diff je Commit und Gesamt-Diff mit `repository_fehlt` lahm (Security S1; betrifft auch R00204 und R00206).
- **`GIT_NO_REPLACE_OBJECTS=1`** in der gehärteten Umgebung jedes Befehls. `refs/replace/<hash>` schob sonst einen anderen Commit unter den Hash eines Kartencommits. Weder Fingerabdruck noch `ETag` decken `refs/replace` ab (Security S2). Die Liste der gesetzten Variablen in N2.3 wächst um diese Zeile.
- Der Startort kennt damit **sieben Befehle**: `rev-parse`, `cat-file`, `log`, `for-each-ref`, `rev-list`, `diff-tree`, `merge-base`. `merge-base` erzwingt `--independent --end-of-options`, und nur `diff-tree` liefert einen Teil. Ein Befehl `diff` ist nicht dabei (N4.6).

### N7.5 `ETag` über alle Verweise der Karte (ändert N6.10 E3)

Gebaut ist E3 mit **allen** Verweisen der Karte (wörtlich, in Reihenfolge), nicht nur denen der Anwendung, dazu Fingerabdruck, Anwendung, `datei`, `format` und `GRENZEN_VERSION`. Strenger als N6.10, und richtig: Die Hinweise jeder Antwort nennen auch Verweise anderer Anwendungen und solche ohne Anwendung (N6.7), etwa `weitere_anwendungen` und `ausgelassen`. Kommt an der Karte ein Verweis einer anderen Anwendung dazu, ändert sich die Antwort also auch für diese. Inkauf: ein unnötiger 200, wenn sich nur die Reihenfolge fremder Verweise ändert.

### N7.6 Belegt und offen

- **Lastprobe nach N7.1** (B1052, `674e8693`): p95 **259 ms** über die API (30 Commits, 20.000er-Repository, kalt), Namenslauf mit `-M50% -l1000` **159.061 Byte** bei 1.000 fremden Commits, also etwa 4 % von `GRENZE_NAMEN`. Damit ist das Ziel p95 < 500 ms belegt. Vor der Nacharbeit (B1029, `202c743b`) waren es 298 ms. Prozesse 10–15, bei 500 Kartencommits und 1.000 fremden 12–14 (security-reviewer); ein 304 kostet 2.
- **Eigene Karte #229:** Dieselbe Neupaarung wie in N7.2 steckt im Diff je Commit (R00206): `?commit=…&datei=d/x` ergibt 500 (Probe `gemeinsam/scratchpad/entw1-214/a3b.py` der Factory). Regel siehe N7.7.
- **Offen (Sollte des architektur-reviewers):** Ein Fitness-Test für den einzigen Startort fehlt: `Command::new("git")` darf außerhalb von `#[cfg(test)]` nur in den drei Dateien aus N2.3 stehen. Ebenso fehlen Dienst und Modell des Gesamt-Diffs (`src/dienst/gesamt_diff.rs`, `src/modell/gesamt_diff.rs`) in den Bausteinen A00004 und A00006.

### N7.7 Diff je Commit (A3): N7.2 gilt unverändert, mit zwei Präzisierungen (Karte #229)

*(Strenge und 404 bei Läufen mit Pfadangabe berichtigt durch N7.8)*

Entscheider: Claude (autonom, architekt, Lauf 229-architekt-1). Keine neue Technikfrage; N7.2 gilt auch für den Diff je Commit (`src/dienst/diff.rs`).
- **Beide Pfadangaben von A3**, nicht nur `datei=`: (1) `datei=` — Zähler- und Patch-Lauf mit der gegen die Roh-Liste bis 20 MB (`GRENZE_DATEILISTE_EINZELN`) abgeschlossenen Angabe, Zuordnung über `patches_zuordnen_im_bezug`; die Zähler werden ebenfalls nur über die getroffenen Einträge des Bezugs verbunden. (2) Die Liste mit Pfadangabe (`lauf_der_liste` liefert `true`: `gross`, `nachladen` oder Liste gekappt) — Bezug ist die gelesene Liste, wie der Netto-Patch in N7.2.
- **Abgeschnittener Bezugslauf**: Ist die Bezugsliste abgeschnitten (Liste über 1 MB, `datei=` über 20 MB), kann ein getroffener Eintrag hinter dem Schnitt liegen (etwa eine Umbenennung `d/x/a → z/…`, die am Ziel einsortiert ist), und Git paart dann anders als der Bezug. Scheitert die Zuordnung nur in diesem Fall, ist das **kein 500**: In der Liste werden die Dateien des Laufs `nachladen`, bei `datei=` gilt 404 „Dateiliste zu groß“ wie bei `DateiFehlt { liste_abgeschnitten: true }`. Bei vollständigem Bezug bleibt die Zählprüfung streng (500 wie N5.2).
- `format=patch` geht über dieselbe Zuordnung (`Fassung::Stuecke`) und hat keine Besonderheit.
- Durchsetzung: Abnahme-Proben der Karte #229 (Typwechsel in beiden Richtungen, Zwilling, `datei=` auf jeden Pfad, JSON und `format=patch`; vorher 500, nachher 200) und eine Zufallsprobe nach `probe_b2rest.py` über `?commit=`. Orakel: der Patch jeder Datei mit `datei=` ist bytegleich zu dem aus dem Lauf ohne Pfadangabe; nie 500.

### N7.8 Läufe mit Pfadangabe paaren nicht verlässlich wie der Bezug (berichtigt N7.2 „so paart der Lauf wie der Bezugslauf“ und N7.7, Karte #229, Code-Review M1)

Entscheider: Claude (autonom, architekt, Lauf 229-architekt-2). Anlass: Git sortiert gleich bewertete Umbenennungsquellen abhängig von der Größe der Matrix; eine Pfadangabe ändert die Matrix auch nach `abschliessen`. Belegt im rohen Git (`gemeinsam/scratchpad/arch-229/paarung.py` der Factory, 60 Varianten mit 2–4 gleichwertigen Quellen und einer Datei `gross`): Liste mit Pfadangabe „alle außer `gross`“ paart in 14 von 60 anders als ohne; Lauf ohne Angabe dreimal wiederholt 0 von 60 anders; `datei=` mit Ziel und Quelle des Bezugs 0 von 120 anders. Die Zuordnung über Blob-Hashes (N5.2) bleibt richtig: Ein anders gepaarter Eintrag bekommt kein falsches Stück, sondern keins.

- **Regel**: Ein Lauf mit Pfadangabe ist eine Abkürzung, kein Beleg. Fehlt einem Eintrag dort sein Stück (oder seine Zähler), ist das eine Abweichung der Paarung, kein Fehler. Streng (500 nach N5.2 Regel 4 und 5) ist nur ein Lauf **ohne** Pfadangabe gegen einen vollständigen Bezug: Er ist derselbe Befehl wie der Bezugslauf.
- **Liste (A3, gewählt V1)**: Einträge des Laufs ohne Stück werden `nachladen`; scheitert die Zuordnung so, dass kein Eintrag sicher ist (Reihenfolge), alle Dateien des Laufs. Nie 500, die übrigen behalten ihren Patch. Das Modell meldet dafür die nicht zugeordneten Einträge statt eines Fehlers für den ganzen Lauf.
- **`datei=` (A3)**: zuerst wie N7.7 mit der abgeschlossenen Angabe. Fehlen Zähler oder Stück, ist die Angabe über 1 MB (ARG_MAX, Sollte 1 des Code-Reviews) oder ist die Liste abgeschnitten, folgt **ein Rückfall ohne Pfadangabe**: Zähler bis 20 MB, Patch bis 8 MB, Zuordnung über die ganze Liste (paart wie sie). Liegt das Stück hinter der Grenze von 8 MB: 200 mit `gross` und `zu_gross_zum_anzeigen`, wie N5.2. 404 bleibt nur für „Name steht nicht in der Liste“ und für „Liste über 20 MB und der Rückfall findet den Eintrag nicht“. So bleibt jede `nachladen`-Datei einzeln ladbar.
- **Varianten**: V1 nachladen in der Liste und Rückfall bei `datei=` (gewählt). V2 Stücke über Pfade binden und Köpfe (`diff --git`, `rename from/to`) prüfen — verworfen: erkennt dieselbe Abweichung wie der Blob-Schlüssel, heilt sie nicht und bringt das Lesen gequoteter Köpfe als neue Fehlerquelle. V3 Patch der Liste immer ohne Pfadangabe — verworfen für die Liste: eine große Datei vorn verbraucht die 4 MB, alle folgenden werden `nachladen`, und Git rechnet ihren Patch trotzdem; als Rückfall für eine Datei (8 MB) ist sie richtig.
- **Gesamt-Diff (#214)**: Netto- und Folge-Läufe mit Angabe haben dieselbe Ursache (gleiche Zuordnung `patches_zuordnen_im_bezug`, streng). Nicht in dieser Karte: Ein Netto-Rückfall ohne Angabe läse über die Spanne auch fremde Änderungen (die Zuordnung verwürfe sie, sie zählen aber gegen das Budget und berühren „nie fremd“); ein Folge-Rückfall je Kartencommit wäre unbedenklich. Das braucht eine eigene Entscheidung. Eigene Vorrang-Karte, erste Probe rot nach dem Muster `tie2f.py` über eine Spanne mit Datei `gross`. Bis dahin ruft der Gesamt-Diff die Zuordnung unverändert streng.
- Durchsetzung: `crev-229/tie2f.py` als Abnahme-Probe (≥ 40 Varianten mit 2–4 Quellen, Liste und `format=patch`, nie 500, jeder gezeigte Patch bytegleich zum Stück aus `diff-tree -r -p --full-index -M50% -l1000` ohne Angabe), dazu `datei=` auf jede `nachladen`-Datei mit 200; ARG_MAX-Probe des Code-Reviews mit 200 statt 500. Pre-Mortem (h): Jemand macht den Lauf mit Pfadangabe wieder streng, „weil `abschliessen` die Paarung sichert“ — dann wird `tie2f.py` rot.

### N7.9 Sehr große Commits und die Argumentgrenze (ergänzt N7.8, Karte #229, Lauf 229-architekt-3)

- **Zeitgrenze statt 200 bei sehr großen Commits**: Für `datei=` in einem Commit mit 145.000 Dateien unter `x/` (`srev-229/gross2.py`) antwortet A3 mit 503 nach der Gesamtgrenze von 10 s (N4.1, Text der Zeitgrenze). Das ist zulässig: „nie 500“ gilt, eine Teilantwort gibt es nicht. Die Zeit geht vor allem in den Metadaten-Lauf `log --numstat -M` (Bestand R00206, 6,9 s gemessen bei Last 8–10), den auch die Liste und der Gesamt-Diff brauchen. Bei 75.000 Dateien waren es 200 nach 6,4 s. AK 8 der Karte lautet damit: nie 500; bis 75.000 Dateien 200; darüber 200 oder 503 mit dem Text der Zeitgrenze. Den Metadaten-Lauf schneller zu machen (etwa die Umbenennungssuche über einer Zahl von Einträgen auslassen oder für `datei=` ohne `--numstat`) gehört in eine **eigene Karte** (Leistung, kein Vorrang), weil er alle drei Lesewege betrifft. Abnahme dort: `gross2.py` ergibt 200 innerhalb von 10 s bei Last ≤ 6.
- **Argumentgrenze: E2BIG allein trägt nicht.** (1) Linux meldet E2BIG über `posix_spawn` oder `fork`/`exec` verlässlich als `ArgumentListTooLong`. macOS ebenso, dort ist ARG_MAX aber 1 MB einschließlich Umgebung, also kleiner als die Pfadangabe der Liste. (2) Windows begrenzt die Kommandozeile auf 32.767 UTF-16-Zeichen und meldet das nicht als E2BIG (`ERROR_FILENAME_EXCED_RANGE`), sodass der Rückfall nie ausgelöst würde. (3) Die Liste behandelt `ArgumenteZuLang` heute nicht, sie gäbe dann 500. **Entscheidung**: Der Startort prüft vor dem Start mit einer Vorabgrenze je Plattform. Unter Unix zählt er Σ(Länge + 1 + 8) über alle Argumente; Startwerte sind 1,75 MiB unter Linux und 768 KiB unter macOS. Unter Windows zählt er Σ(Länge + 3) in UTF-16 mit dem Startwert 32.000. Darüber startet er nicht und meldet `ArgumenteZuLang` wie bei E2BIG. E2BIG bleibt als Netz. `lauf_der_liste` zählt weiter nur Bytes (R00206 unverändert, die Abweichung des entwicklers ist damit gedeckt). Behandlung von `ArgumenteZuLang`: Bei `datei=` folgt der Rückfall ohne Angabe (N7.8). In der Liste werden alle Dateien des Laufs `nachladen`, nie 500; jede bleibt über `datei=` ladbar. Unter Linux erreicht die Liste die Grenze praktisch nicht: Die Roh-Liste bis 1 MB fasst höchstens etwa 10.000 Einträge, also etwa 80 KB Zeiger. Unter macOS reichen dafür etwa 250 Pfade mit je 4.000 Byte, unter Windows etwa 300 Pfade mit je 100 Zeichen. Abnahme: ein Modultest der Vorabgrenze je Plattform und ein Integrationstest mit kleiner Grenze, in dem die Liste `ArgumenteZuLang` bekommt. Ergebnis 200 mit `nachladen`, und jede dieser Dateien gibt über `datei=` 200.

### N7.10 Gesamt-Diff: abweichende Paarung und Argumentgrenze ohne 500 (überträgt N7.8 und N7.9 auf N7.2, Karte #230)

Entscheider: Claude (autonom, architekt, Lauf 230-architekt-1).

**Belegt am Stand `b6bd9231`** (Release-Build des Gates, Probe `gemeinsam/scratchpad/arch-230/tie_gesamt.py` der Factory, je Fall 40 Varianten mit 2–4 gleichwertigen Quellen):

| Fall | Aufbau | Liste und `format=patch` | `datei=` |
|---|---|---|---|
| N | Kartencommit K1 löscht `s0…` und `gross`, legt `dst` und `dst2` an | 16 von 40 mit 500 | 40 von 40 mit 200 |
| F | wie N, dann fremder Commit F (hängt `FREMD` an `dst2`) und Kartencommit K2 | 16 von 40 mit 500 | 40 von 40 mit 200 |
| G, H | große Folge-Datei im selben oder im nächsten Kartencommit | 0 von 40 | 40 von 40 |

Die Meldung ist stets „Patch-Lauf: „dst“ (R) hat 0 von 1 Stücken“, und zwar im **Netto-Lauf** (Pfadangabe ohne `gross`). Eine Zeile mit `FREMD` erschien nie. Im Folge-Lauf trat die Abweichung nicht auf; nach N7.8 ist sie dort aber möglich, sobald seine Angabe kleiner ist als die seiner Liste.

**Regel** (gilt für Netto und Folge): Streng (500) ist ein Patch-Lauf nur dann, wenn er **dieselbe Pfadangabe wie sein Bezugslauf** hat, einschließlich „keine“. Dann ist die Matrix gleich und die Paarung auch. Jede andere Angabe ist eine Abkürzung (N7.8).

1. **Liste**:
   - Ein Netto-Eintrag ohne Stück wird `nachladen`.
   - Fehlt einem Folge-Eintrag das Stück eines Schritts, wird der ganze Folge-Eintrag `nachladen`.
   - Nie 500; die übrigen Einträge behalten ihren Patch. Das Werkzeug ist `nicht_zugeordnet_im_bezug` aus #229.
2. **`datei=`** (Einzeln):
   - Fehlt das Stück, folgt ein Rückfall mit **genau der Angabe des Bezugslaufs**: Netto mit `D_karte` (oder ohne, wenn die Spanne keine fremden Commits hat), Folge mit der Angabe des Folge-Laufs. Bis 8 MB, zugeordnet über den ganzen Bezug, streng.
   - Der Rückfall liest nur, was die Liste schon gelesen hat. Die Netto-Stücke von Folge-Pfaden, die fremde Zeilen tragen, werden gelesen und verworfen, wie in den N7-Konsequenzen in Kauf genommen. In die Antwort kommen sie nie.
   - Liegt das Stück hinter 8 MB: `gross` und `zu_gross_zum_anzeigen`.
3. **Argumentgrenze** (N7.9):
   - Die Vorabgrenze wirkt schon, denn `git` und `git_teil` prüfen am selben Startort. Der Gesamt-Diff bildet `ArgumenteZuLang` heute aber über `abbruch` auf 500 ab.
   - Neu:
     - Netto-Liste mit `D_karte` zu lang → wie `pfadangabe_zu_lang`, also `ganz_als_folge` mit `fremd_zu_gross`.
     - Folge-Liste zu lang → wie ein abgeschnittener Folge-Lauf: Die Einträge fallen weg, `dateien_gekappt`.
     - Patch-Lauf der Liste zu lang → seine Einträge `nachladen`.
     - Bei `datei=` folgt der Rückfall aus Punkt 2; ist auch er zu lang, 404 mit dem Text aus N7.3 (Verweis auf `commit=` und `datei=`).
   - Unter Linux erreicht der Gesamt-Diff die Grenze praktisch nicht, weil der Namenslauf mit 4 MB vorher kappt (N7.3). Unter Windows (32.767 Zeichen) reichen etwa 300 Kartenpfade, wenn die Spanne fremde Commits hat.
4. **Varianten** für den Netto-Lauf der Liste:
   - **V1 `nachladen`** (gewählt).
   - V2 als Folge darstellen — verworfen: Die Aussage wäre falsch, denn der Eintrag ist netto. Außerdem bräuchte es Folge-Läufe je Commit und mehr Prozesse.
   - V3 `ganz_als_folge` — verworfen: Eine Datei verschlechtert die ganze Antwort.
   - V4 Rückfall ohne Angabe über die Spanne — verworfen: Er liest alle fremden Änderungen der Spanne gegen das Budget, und „nie fremd“ hinge dann allein an der Zuordnung.
   - V5 Rückfall mit der Angabe des Bezugs auch für die Liste — verworfen: Große Dateien und Folge-Pfade verbrauchen die 4 MB. Für `datei=` ist das richtig (Punkt 2).
5. Kriterien: nie 500, nie eine Zeile eines fremden Commits, Grenzen unverändert (64 MB Antwortbudget, 10 s, höchstens 15 Git-Prozesse; der Rückfall kostet einen Prozess nur bei `datei=` und nur im Fehlschlag).

Durchsetzung: die Abnahme-Probe der Karte #230 (Fälle N und F wie oben, heute rot), dazu ein Integrationstest mit kleiner Vorabgrenze für Netto- und Folge-Liste. Pre-Mortem (i): Jemand macht den Netto-Lauf wieder streng, „weil `abschliessen` reicht“. Dann wird Fall N rot.

### N7 Durchsetzung

Die Abnahme-Proben B1–B5, S1 und S2 der Nacharbeit (`tests/akzeptanz_r00208.rs`, Modultests in `src/modell/gesamt_diff.rs`) und 20 getötete Mutanten. Dazu gehören:
- B1 (a)–(c): Umbenennung einer fremd angelegten Datei, `x → y` nach fremdem Anlegen, Ziel netto gedeckt und Quelle Folge. Ergebnis: kein `[+-].*FREMD` in JSON und `format=patch`, der Schritt als `R`.
- B2: Typwechsel mit gleichem Blob, `datei=` auf jeden Kartenpfad. Ergebnis: 200.
- B3: 1.000, 2.000, 2.001 und 42.000 Dateien. Ergebnis: 200, nie 500.
- S1: Datei mit dem Namen eines Commit-Hashes. Ergebnis: bytegleich.
- S2: `refs/replace`. Ergebnis: keine FREMD-Zeile.

Pre-Mortem zusätzlich zu N6: (e) Jemand nimmt `-M` aus dem Namenslauf, „weil N6.2 `--no-renames` sagte“. Dann zerfallen die Gruppen, und B1 wird rot. (f) Eine neue Pfadangabe ohne `abschliessen` macht B2 rot. (g) Ein neuer Lesebefehl ohne `--` hinter den Revisionen macht S1 rot.

### N7 Konsequenzen

- Positiv: „nie fremd“ hält auch über Umbenennungen der Karte; Typwechsel und sehr große Karten ergeben keine 500; der Startort ist gegen mehrdeutige Namen und Ersatzobjekte gehärtet, für alle drei Lesewege.
- Inkauf: Eine belastete Gruppe bringt auch rein kartengeänderte Pfade in die Folge. Abgeschlossene Pfadangaben lassen Läufe fremde Stücke lesen, die verworfen werden (Bytes zählen gegen die 4 MB). Bei Namen über 4 MB mit fremden Commits zeigt die Antwort keine Datei. Der `ETag` wird auch bei Änderungen an Verweisen anderer Anwendungen ungültig.

## Quellen / Bezuege

- Karten #207–#210; po-entscheidungen Z. 358–383 und Betreiber-Entscheidung 2026-11-19 (letzte Zeile, Nachtrag N1); `werkzeuge/board.py` der Factory (`_rebase`, `dokumente`, `wache_vorbereiten`); Vision Z. 110–113, 145–200; `AI-Team/factory.md` „Lastprofil“
- `src/git.rs`, `src/modell/anwendungen.rs`, `src/modell/einstellungen.rs:40`, `:77`, `src/format/aufgabe.rs:667`, `src/web/statisch.rs`, `src/web/endpunkte.rs:35`
- ADR-0003, ADR-0006, ADR-0008, ADR-0021, ADR-0024, ADR-0028, ADR-0030, ADR-0031
- Git-Dokumentation `git-diff` (`--no-ext-diff`, `--no-textconv`, `--raw -z`), `gitattributes` (diff-Treiber, textconv), `git-rev-parse` (`--end-of-options`, `^{commit}`) — Git 2.48.1 auf diesem Rechner
- npm: `prismjs` 1.30.0 (MIT), `@highlightjs/cdn-assets` 11.12.0 (BSD-3-Clause), abgerufen 2026-11-19; Messung in `gemeinsam/scratchpad/arch-207/` der Factory
