# ADR-0038: Nachfolger eines verwaisten Commits — Suche auf Klick über `patch-id --stable` mit Vorfilter nach Pfaden, Fenster ab dem Autordatum, höchstens 1.000 Commits, nie Inhalt in der Antwort

**Status**: Vorgeschlagen — wird „Akzeptiert“, sobald die Sondierung der Karte (Punkt 9) das Orakel und das Messziel trifft. Suchraum, Verfahren, Sicherheitsgrenze und Antwortform sind vom Bestand getragen (ADR-0032 Punkt 3, N1.2, N1.4, N3.1, N4.4, N5.1, N6.8, N7.4); offen sind nur die Zahlen (1.000 Commits, p95 < 2 s). Löst ADR-0032 N1.7 ab.
**Datum**: 2026-11-21
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #220, Lauf 220-architekt-1)
**Kontext-Anforderung**: — (Karte #220, Scheibe A5; die Anforderung schreibt der planer). Bezug: po-entscheidungen Z. 389 (Betreiber 2026-11-19, Punkt 4), ADR-0032 N1.2, N1.4, N1.7, N3, N4.4, N5.1, N6.8, N7.4, N7.10; ADR-0034 (Register nennt das Repository)
**Erprobt durch**: — (am Code gelesen, Stand `65809adb`; nichts gefahren, Nachtbetrieb ohne Lastprobe). Die Zahlen trägt die Sondierung der Karte nach.

## Kontext

- **Belegt (Code)**:
  - Der Startort `src/git/arbeitsrepo.rs` kennt sieben Befehle (`Befehl`, Z. 57–65). Ein neuer Befehl braucht je eine Zuordnung in `erzeugt_diffs`, `schalter`, `liefert_teil` und `einzige_form`, sonst baut das Programm nicht.
  - `git()` und `git_teil()` geben Eingaben über `stdin` (`Lauf.eingabe`, `lesend_ausfuehren` Z. 676 ff.). Eine Röhre zwischen zwei Git-Prozessen gibt es nicht.
  - Die Lesegrenze (`src/dienst/lesegrenze.rs`) hat 4 Plätze. Ihr Versprechen lautet: „jeder Lesevorgang startet seine Git-Prozesse nacheinander, also laufen nie mehr Git-Prozesse für das Lesen als Plätze belegt sind.“
  - `erreichbar` (Z. 482) baut den Graphen aller Zweigspitzen aus einem Lauf `rev-list --parents --stdin` im Speicher (Z5, ADR-0032 N3.4).
  - `diff_tree_viele` (Z. 421) liest viele Commits in einem Lauf `diff-tree --stdin`, je Zeile `<commit> <erster Elternteil>`.
  - Die Oberfläche zeigt `verwaist` als „auf keinem Zweig“ (`web/commits.js:12`), der Gesamt-Diff nennt ihn als „nicht einbezogen“ (`web/gesamt.js:63`). Einen Weg vom verwaisten Commit zu seinem Nachfolger gibt es nicht.
- **Gemessen 2026-11-19** (ADR-0032 N1.7): `log -p -n 1000 | patch-id --stable` kostet in kanbanD 3,0 s. Im Wegwerf-Repository mit 20.000 Commits (N3) kostet `rev-list --parents --branches --remotes` 0,16–0,24 s.
- **Vermutet, nicht gefahren**: `diff-tree --stdin -r --raw` über 1.000 Commits vergleicht nur Bäume und rechnet keinen Text. Es kostet deshalb einen Bruchteil von `-p`. Dass gleiche `patch-id` dieselbe Menge geänderter Pfade bedeutet, folgt daraus, dass `patch-id` die Kopfzeilen `---`/`+++` mitzählt. Für reine Modusänderungen ist es nicht sicher; darum gibt es das Orakel in Punkt 9.
- **Rebase und Cherry-pick** behalten Autor und Autordatum und setzen ein neues Commit-Datum. Ein Nachfolger hat also ein Commit-Datum ≥ dem Autordatum des verwaisten Commits. Ausnahmen sind Uhren, die falsch gehen, und `--reset-author`; bei `--reset-author` liegt das Datum später, das schadet dem Fenster nicht.
- **Squash** (viele Patches zu einem) hat nie eine gleiche `patch-id`. Dasselbe gilt für einen Rebase, der einen Konflikt anders löst.

Qualitätsziele (Szenarien mit Maß):

- **Q1 Richtig**: Für einen gerebasten Commit ohne Konflikt nennt die Suche den Nachfolger. Sie nennt nie einen Commit, dessen `patch-id --stable` anders ist.
- **Q2 Begrenzt**: Kalt im Wegwerf-Repository nach B0998 (20.000 Commits, 50 Zweige, ohne `commit-graph`) p95 < 2 s. Immer gilt: Antwort ≤ 15 s, höchstens 12 Git-Prozesse nacheinander in einem Platz der Lesegrenze, kein ungezählter Speicher über die Bytegrenzen hinaus.
- **Q3 Nie fremder Code**: Die Antwort enthält keine Zeile, keinen Dateinamen und keinen Patch. Der Diff eines Kandidaten bleibt unlesbar, bis er über `ersetzen` an der Karte steht (ADR-0032 Punkt 3 „nur Verweise der Karte“).
- **Q4 Mensch entscheidet**: Die Suche schreibt nie. Ersetzt wird nur über `POST …/commits/ersetzen` (N1.4).

## Optionen

| Variante | Stärke | Schwäche |
|---|---|---|
| V1 — Strom `log -p --branches --remotes … \| patch-id --stable`, wie gemessen | einfach; ein Befehl mehr; kein Vorfilter, der irren kann | entweder eine Röhre zwischen zwei Prozessen (bricht das Versprechen der Lesegrenze, neuer Startweg mit zwei Prozessgruppen) oder der ganze Patch-Text von 1.000 Commits im Speicher (ohne Obergrenze, bei großen Commits Hunderte MB; mit Grenze ein Teil, der die Suche still verkürzt); 3,0 s schon in kanbanD, in einem großen Repository mit großen Commits leicht über 10 s |
| **V2 — Fenster, Vorfilter nach Pfaden, dann `patch-id` nur für die Übrigen, Prozesse nacheinander** (gewählt) | Text wird nur für die wenigen Commits gerechnet, die dieselben Pfade ändern; jeder Schritt hat eine Bytegrenze; das Versprechen der Lesegrenze bleibt; nur ein neuer Befehl ohne Schalter | ein Vorfilter mehr, der richtig sein muss (Orakel in Punkt 9); bei reinen Modusänderungen kann er einen Nachfolger übersehen (die sichere Richtung) |
| V3 — `patch-id` in Rust nachbauen | kein neuer Befehl, kein zweiter Prozess | Gits Regeln (Leerraum, Kopfzeilen, `--stable`-Summe je Datei) nachzubauen und mit jeder Git-Version abzugleichen; ein Fehler bringt falsche Kandidaten |
| V4 — Gleichheit über Autor, Autordatum und Titel (ein Lauf `log --format`) | ein Prozess, sehr billig; findet auch einen Rebase mit anders gelöstem Konflikt | kein Beleg für gleichen Inhalt; bei `--reset-author`, Reword oder einer Folge gleich betitelter Commits falsch oder leer; die Karte verlangt `patch-id` |

Für die Suchtiefe:

| Variante | Stärke | Schwäche |
|---|---|---|
| T1 — alle Commits der Zweige | findet alles | wächst mit der Geschichte, nicht begrenzt |
| **T2 — Commits der Zweige, nicht Vorfahr des verwaisten, Commit-Datum ab Autordatum − 1 Tag, höchstens 1.000, neueste zuerst** (gewählt, wie N1.7 vorschlug, mit Autordatum statt Commit-Datum) | begrenzt durch eine Zahl; das Fenster folgt aus der Art, wie ein Nachfolger entsteht | in einem Repository mit mehr als 1.000 Commits seit dem verwaisten fällt der älteste Teil heraus, sichtbar über `suche_gekappt` |
| T3 — nur der Zweig, auf dem der Commit lag | billig | der Zweig ist nach dem Merge meist gelöscht, der Nachfolger liegt auf einem anderen Zweig (N1) |

## Entscheidung

**Gewählt: V2 mit T2.** Akzeptierte Schwäche: ein Squash, ein anders gelöster Konflikt und ein Nachfolger hinter den 1.000 neuesten Commits werden nicht gefunden. Die Antwort sagt das, sie rät nie.

1. **Endpunkt**: `GET /api/aufgaben/{nr}/commits/{verweis}/nachfolger`. `verweis` ist der volle Hash oder ein an der Karte eindeutiger Präfix ≥ 7 (wie `DELETE`, N1.4). Es gibt kein `X-KanbanD-Wer`, keine Sperre und kein Schreiben.
   - Aufgabe unbekannt → 404; Verweis nicht an der Karte → 404 `{fehler, verweis}`; Form falsch, Präfix mehrdeutig → 400; defekte Datei → 423 (wie der Diff je Commit).
   - Zustand ≠ `verwaist` → 404 `{fehler, zustand, grund?}` (wie N1.6). Der Zustand wird mit demselben Helfer gerechnet wie in der Liste (`objekte_pruefen`, Fingerabdruck, `erreichbar` samt Zweigcache), damit Liste und Suche nicht auseinanderlaufen.
2. **Ablauf** (ein Platz der Lesegrenze für die ganze Anfrage, alle Prozesse nacheinander, Gesamtgrenze 10 s ab Eintritt in den Handler, Grenze je Prozess `min(10 s, Rest)`, Antwort ≤ 15 s, bei Zeitüberschreitung 503 `{fehler}` und nie eine Teilantwort — N3.1, N4.1):
   1. Wurzel, `cat-file --batch-check`, `log --no-walk` (Metadaten, Elternteil, Autordatum), Fingerabdruck, Zweigliste: Der Zustand muss `verwaist` sein.
   2. **Fenster** — ein Lauf `rev-list --no-merges --parents --since=<Autordatum − 86.400 s> --max-count=1001 --branches --remotes ^<verwaist> --` (ohne Tags, ohne `*/HEAD`). Bei 1.001 Zeilen werden 1.000 durchsucht, mit Hinweis `suche_gekappt`.
   3. **Vorfilter** — ein Lauf `diff_tree_viele` mit `-r --raw -z --no-renames --root` über das verwaiste und die Fenster-Commits, je Zeile `<commit> <erster Elternteil>`, Bytegrenze 4 MB (wie `GRENZE_NAMEN`). Weiter kommt nur ein Commit, dessen Menge geänderter Pfade gleich der des verwaisten ist. Ist der Lauf abgeschnitten, gelten nur die vollständig gelesenen Commits als durchsucht, mit Hinweis `suche_gekappt`.
   4. **Patch** — ein Lauf `diff_tree_viele` mit `-p --no-renames --root` (Schalter des Startorts: `--no-ext-diff --no-textconv --no-color`, `core.quotepath=off`) über das verwaiste und höchstens 50 Übrige des Vorfilters, Bytegrenze 8 MB (wie `GRENZE_EINZELN`). Bei mehr als 50 Übrigen oder einem Teil werden nur ganz gelesene Commits geprüft, mit Hinweis `suche_gekappt`. Ein abgeschnittener letzter Commit zählt nie.
   5. **`patch-id`** — ein Lauf `patch-id --stable` mit dem Patch-Text aus 4 auf `stdin`. Die Ausgabe `<patch-id> <commit>` liest `patch-id` aus dem Kopf von `diff-tree`. Kandidat ist jeder Commit mit derselben `patch-id` wie das verwaiste.
   6. **Binärdateien**: `patch-id` sieht bei Binärdateien ohne `--binary` nur „Binary files … differ“ und hielte damit jede Änderung derselben Datei für gleich. Deshalb muss ein Kandidat für jeden Pfad, den das verwaiste als binär ändert, denselben neuen Blob haben (aus dem `--raw` in 3). Sonst fällt er heraus. `--binary` kommt nicht: Es bläht den Patch-Text auf, und ein Delta hängt vom alten Blob ab.
   7. **Metadaten und Zweige** der höchstens 10 gezeigten Kandidaten: ein Lauf `log --no-walk`. Die Zweige kommen aus dem Graphen von Schritt 1 (kein weiterer `rev-list`), notfalls über `erreichbar`.
   - Höchstens **12 Git-Prozesse**, unabhängig von der Zahl der Commits; bei Treffer im Zweigcache weniger.
3. **Neuer Befehl `patch-id`** im Startort, achter Eintrag in `Befehl`: `erzeugt_diffs` falsch (er liest nur `stdin`, er startet weder Diff-Treiber noch textconv), `schalter` ohne, `liefert_teil` falsch, `einzige_form` nur `["--stable"]`. Eingabe immer über `stdin`, nie ein Pfad, nie eine Revision. Er bekommt dieselbe gehärtete Umgebung wie jeder Befehl. Zeilengrenze 1.100 (eine Zeile je Commit). Ändert ADR-0032 Punkt 3 und N7.4: Der Startort kennt damit **acht Befehle**.
4. **Antwort 200**: `{verweis, hash, durchsucht, kandidaten: [{verweis, hash, titel, autor, datum, zweige, entfernte_zweige, zweige_weitere?, an_der_karte}], kandidaten_weitere?, hinweise: [{art, …}]}`.
   - `verweis` des Kandidaten in der Schreibweise der Karte (`<kürzel>:<voller Hash>`, ohne Kürzel für die Standardanwendung). Er passt also wörtlich in `ersetzen` als `neu`.
   - Felder wie in der Liste (R00204): Titel gekürzt auf 500 Zeichen, nur der Autorname, Commit-Datum ISO 8601, Zweige je höchstens 10.
   - `an_der_karte: true`, wenn der Kandidat schon an dieser Karte steht. Dann gäbe `ersetzen` 409 (N1.4); der richtige Zug ist `DELETE` des verwaisten. Die Oberfläche bietet dann „verwaisten Verweis entfernen“ statt „ersetzen“ an.
   - **Reihenfolge**: Commit-Datum absteigend, bei Gleichstand nach Hash. Gezeigt werden höchstens 10 Kandidaten, der Rest steht als `kandidaten_weitere: n`, nur bei n > 0.
   - **Null Kandidaten**: `kandidaten: []`, 200, kein Fehler. Die Oberfläche sagt: „Kein Commit mit gleichem Patch auf einem Zweig gefunden. Nach Squash oder einem anders gelösten Konflikt findet die Suche keinen Nachfolger.“ (Wortlaut für planer und gestalter.)
   - **Mehrere Kandidaten** (Cherry-pick auf zwei Zweige, alter entfernter Zweig): alle in der Reihenfolge oben, nie eine Auswahl durch kanbanD. Auch bei genau einem Kandidaten wählt der Mensch.
   - `hinweise`, Arten neu und eindeutig für diesen Endpunkt (ergänzt N4.5): `suche_gekappt` (`durchsucht`, `grund`: `fenster` | `vorfilter` | `patch`), `merge` (das verwaiste ist ein Merge, ohne Suche, `kandidaten: []`), `leer` (das verwaiste ändert keine Datei, ohne Suche). Ein Leser überspringt eine unbekannte Art.
5. **Sicherheit** (Q3):
   - Die Antwort trägt nie Patch-Text, Dateinamen oder Zeilen. Nach außen gehen nur Hash und Metadaten von Commits mit **gleicher** `patch-id`, also derselben Änderung wie das verwaiste, das an der Karte steht. Titel und Autor anderer Commits erscheinen nie.
   - Ein Kandidat ist kein Verweis der Karte. `?commit=` gibt für ihn weiterhin 404, bis der Mensch ersetzt.
   - Patch-Text der übrigen Commits wird innerhalb des Platzes gelesen und verworfen (wie N7.10 Punkt 2). Seine Menge begrenzen die Bytegrenzen aus 2.3 und 2.4.
   - Eingabe ist nur ein Verweis der Karte. Kein Pfad, keine Revision von außen; Fenster, Datum und Commit-Liste rechnet der Dienst selbst. Revisionen stehen hinter `--end-of-options`, davor `--`, wie N7.4.
6. **Speicher und Antwortbudget**: Die Antwort ist klein (höchstens 10 Kandidaten, unter 16 KB). Sie läuft nicht über das Antwortbudget von 64 MB (N5.1 gilt für die Antworten von `…/diff`). Ungezählter Speicher liegt nur während des belegten Platzes: höchstens 4 MB + 8 MB + Ausgabe von `patch-id`, gebaut wie in N5.1 Punkt 2.
7. **Kein Cache**, aber ein `ETag`: Das Ergebnis hängt nur vom verwaisten Hash, von den Zweigspitzen (Fingerabdruck), von den Verweisen der Karte (`an_der_karte`) und von `GRENZEN_VERSION` ab. Gleicher `If-None-Match` → 304 nach Wurzel und Fingerabdruck (2 Prozesse). Ein Cache im Speicher lohnt nicht: Die Suche läuft nur auf Klick, und eine Wiederholung ohne Zweigbewegung kostet über den `ETag` fast nichts.
8. **Oberfläche** (Wortlaut für planer und gestalter, Entscheid beim product-owner, siehe Fragen): An einem Eintrag `verwaist` der Commit-Liste steht „Nachfolger suchen“. Der Klick zeigt die Kandidaten mit Titel, Datum und Zweig, je Kandidat „Ersetzen“ (ruft `ersetzen` mit genau diesem Paar) oder bei `an_der_karte` „Verwaisten Verweis entfernen“. Nie automatisch, nie beim Laden der Liste.
9. **Sondierung zuerst** (entwickler, höchstens 30 Minuten, erste Bubble der Karte, vor den Kriterien — `AI-Team/factory.md`, „Schlank arbeiten“ A):
   - **Aufbau**: der Erzeuger aus B0998 (20.000 Commits, 50 Zweige, ohne `commit-graph`), dazu
     - (a) ein Kartenzweig mit 5 Commits, gerebased auf `main` nach 500 weiteren Commits, Zweig gelöscht;
     - (b) ein Commit, cherry-gepickt auf zwei Zweige;
     - (c) ein Squash von 3 Commits;
     - (d) ein Rebase mit Leerraum-Änderung im Kontext;
     - (e) eine Binärdatei, auf zwei Zweigen verschieden geändert;
     - (f) eine reine Modusänderung neben einer Textänderung.
     - Dazu kanbanD selbst, nur lesend.
   - **Orakel**: Die Kandidaten aus V2 sind gleich der Menge aus `git log -p --no-merges --no-renames --branches --remotes ^<verwaist> --since=<…> -n 1000 | git patch-id --stable`, gefiltert auf die `patch-id` des verwaisten. Ausgenommen ist nur der Binärfall (e), in dem V2 strenger ist. Erwartet: (a) je der Nachfolger, (b) zwei, (c) keiner, (d) einer, (e) keiner.
   - **Messung**: 20 kalte Läufe je Fall über die Funktion des Dienstes (neuer Prozess, Zweigcache leer), p95 = der 19. Wert, Last nach `uptime` ≤ 6, sonst warten.
   - **Regel, ohne Rückfrage**:
     1. Orakel gleich und p95 < 2 s: 1.000 bleibt. Der architekt setzt den Status auf „Akzeptiert“.
     2. Orakel gleich, p95 ≥ 2 s: Die Höchstzahl wird halbiert, bis p95 < 2 s gilt, aber nie unter 200. Der Wert steht in der Commit-Nachricht und im Bericht. Die Zeitgrenze von 10 s wird nicht weicher.
     3. Orakel ungleich (etwa Fall f), oder p95 ≥ 2 s bei 200: **Halt**, nichts weiter bauen. Der entwickler meldet die Messwerte an den Director (Rückweg `anforderung_falsch`). Der architekt entscheidet dann per Nachtrag. Das ist der einzige Fall, in dem zurückgefragt wird.

## Konsequenzen

**Positiv:**
- Wer von Hand rebased, findet den Nachfolger mit einem Klick und ersetzt ihn mit einem zweiten.
- Die Kosten sind durch Zahlen begrenzt (1.000 Commits, 4 MB, 8 MB, 50, 12 Prozesse, 10 s), nicht durch die Größe des Repositories.
- Das Versprechen der Lesegrenze, ein Prozess je Platz, bleibt bestehen.
- Kein neuer Weg zum Inhalt fremder Commits.

**Negativ / Inkauf:**
- Squash und anders gelöste Konflikte bleiben ohne Vorschlag.
- In sehr aktiven Repositories fällt ein alter verwaister Commit aus dem Fenster der 1.000 neuesten. `suche_gekappt` macht das sichtbar.
- Ein veralteter entfernter Zweig (ohne `fetch --prune`) kann einen alten Zwilling als Kandidaten zeigen. Sein Zweigname steht da (wie N1.2).
- `--stable` übersieht Leerraum. Ein Kandidat, der sich nur im Leerraum unterscheidet, gilt als gleich. Der Mensch bestätigt.
- Ein achter Befehl im Startort.

**Durchsetzung:**
- **Erster Test** (Modul, echtes Git im Wegwerf-Repository): Commit K auf `karte/1`, Rebase auf ein bewegtes `main`, `karte/1` gelöscht. Dann liefert `nachfolger(K)` genau K' mit `zweige ["main"]`. Gegenprobe: Ein Commit mit denselben Pfaden und anderem Inhalt kommt nie vor.
- **Startort**: Tests über alle Befehle (`liefert_teil` nur `DiffTree`, `einzige_form` von `PatchId` = `--stable`). `patch-id` ohne `stdin` oder mit einem Argument außer `--stable` ist ein Fehler.
- **Zählerprobe** (gemeinsam/gelerntes, Grenzen): `aufrufe()` ≤ 12 je Suche bei 1, 30 und 1.000 Fenster-Commits. Die Lesegrenze ist während der Suche mit genau 1 belegt.
- **Sicherheit**: Kein `patch`, kein `pfad`, kein `dateien` in der JSON-Antwort, über alle Fälle der Sondierung. `?commit=<kandidat>` gibt 404, bis ersetzt ist.
- **Zeitgrenze**: Ein `git`-Skript, das `patch-id` 60 s hält, ergibt nach spätestens 15 s 503, nie eine Teilliste.
- **Pre-Mortem**:
  - (a) Jemand baut V1 als Röhre „für Tempo“. Die Zählerprobe der Lesegrenze wird rot (zwei Prozesse je Platz).
  - (b) Jemand lässt den Binärschutz weg, „weil `patch-id` reicht“. Fall (e) wird rot.
  - (c) Jemand gibt den Patch eines Kandidaten zur Vorschau aus. Die Sicherheitsprobe wird rot.
  - (d) Jemand ersetzt bei genau einem Kandidaten selbst. Der Test „Board-Repository nach der Suche unverändert“ (`git status --porcelain`, Zahl der Commits gleich) wird rot.

## Folgeentscheidungen / Aufgaben

- [ ] entwickler (Karte #220): Sondierung nach Punkt 9 zuerst. Danach trägt der architekt den Status nach.
- [ ] product-owner: Gehört die Oberfläche (Punkt 8) zu dieser Karte? Empfehlung: ja, die Karte sagt „nur auf Klick“. Bis zur Antwort gilt: API und Knopf an der Commit-Liste.
- [ ] product-owner: Sollen Commits mit gleichem Autor, Autordatum und Titel, aber anderem Patch (Konflikt anders gelöst) als „ähnlich“ erscheinen (V4 als zweite Stufe)? Empfehlung: nein, nicht in dieser Karte. Es gäbe einen Vorschlag ohne Beleg für gleichen Inhalt.
- [ ] ADR-0032 N1.8 (Factory): Scheitert die Titelprüfung in `_rebase`, könnte die Factory diese Suche nutzen. Das gehört nicht zu kanbanD und braucht eine eigene Entscheidung der Factory.

## Quellen / Bezüge

- ADR-0032 Punkt 3, N1.2, N1.4, N1.6, N1.7 (abgelöst), N1.8, N3.1, N3.4, N4.1, N4.4, N4.5, N5.1, N6.8, N7.4, N7.10; ADR-0034
- `src/git/arbeitsrepo.rs` Z. 57–125 (`Befehl`), 421 (`diff_tree_viele`), 482 (`erreichbar`), 676 (`lesend_ausfuehren`); `src/dienst/lesegrenze.rs` Z. 1–14; `src/dienst/commits_lesen.rs` Z. 14; `src/web/endpunkte.rs:135–138`; `web/commits.js:12`, `web/gesamt.js:63`
- po-entscheidungen Z. 389 (Betreiber 2026-11-19, Punkt 4); Karte #220
- Git-Dokumentation `git-patch-id` (`--stable`, Eingabe aus `diff-tree`), `git-rev-list` (`--since`, `--max-count`, `--no-merges`), `git-diff-tree` (`--stdin`, `--raw`, `--root`). Git 2.48.1 auf diesem Rechner. Dass `patch-id` die Kopfzeilen mitzählt und wie es mit Modusänderungen umgeht, ist aus dem Gedächtnis beschrieben; die Sondierung prüft es mit dem Orakel.
