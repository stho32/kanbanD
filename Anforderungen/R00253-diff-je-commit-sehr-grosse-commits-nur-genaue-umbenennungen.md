---
id: R00253
status: Neu
datum: 2026-11-26
---

# R00253: Diff je Commit — sehr große Commits über 10.000 Einträgen nur mit genauen Umbenennungen, innerhalb der Gesamtgrenze

## Beschreibung

Karte #233 (Leistung, Folge aus [ADR-0032](../Dokumentation/ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) N7.9, erster Punkt). Wer auf der Review-Seite oder über die API einen sehr großen Commit liest, bekommt heute die Datei, die Liste oder den Patch oft gar nicht: Bei 145.000 Dateien antwortet `datei=x` mit 200 erst nach 8,76 s (bei Last 8–10 mit 503), die Liste schon ab 75.000 Dateien mit 503 nach 10 s. Die Zeit geht in die Umbenennungssuche von Git, die heute in jedem der bis zu vier Läufe einer Anfrage neu läuft.

Nach dieser Anforderung entscheidet kanbanD **je Commit einmal**, wie gründlich Umbenennungen gesucht werden: bis 10.000 Einträge wie heute, darüber nur Umbenennungen mit gleichem Inhalt. Alle Läufe dieses Commits folgen dem Urteil. Damit nichts still verloren geht, sagt ein Hinweis in der Antwort und eine Hinweiszeile auf der Review-Seite, dass umbenannte und zugleich geänderte Dateien als gelöscht und neu erscheinen.

Technik: ADR-0032 **Nachtrag N11** (architekt, Lauf 233-architekt-1; Option U1, Messungen N11.1, Abnahme-Proben N11.6 P1–P7). Produkt: product-owner, `AI-Team/po-entscheidungen.md` Z. 699–702 (Lauf 233-product-owner-1).

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109–110): auch der größte Commit einer Karte lässt sich ansehen, statt abgewiesen zu werden; KI-Agenten lesen dieselbe API (Z. 21).

Begriffe: „Hinweis“ meint hier einen Eintrag in `hinweise` der Diff-Antwort und die Hinweiszeile darüber (wie die Kappungszeile), **nicht** den knopflosen Hinweis [D00007](../Dokumentation/Domaenenwissen/D00007-hinweis.md). „Eintrag“ ist eine Zeile der Dateiliste des Commits gegen seinen ersten Elternteil, gezählt **ohne** Umbenennungssuche (eine Umbenennung zählt dort als zwei Einträge: alter Pfad gelöscht, neuer Pfad neu).

## Geschäftlicher Nutzen

Sehr große Commits (Ordner verschoben, Vendor-Stand eingecheckt, erzeugte Dateien) sind genau die, bei denen ein Mensch oder ein Reviewer-Agent nachsehen will, was passiert ist. Heute bekommen sie 503 statt eines Diffs. Danach bekommen sie den Diff in der Gesamtgrenze, mit einer klar benannten, kleinen Einbuße (umbenannt und geändert erscheint als `D` und `A`), und gewöhnliche Commits bleiben unverändert.

## Funktionale Anforderungen

- FA 1: Je Commit wird die Zahl seiner Einträge `n` ohne Umbenennungssuche bestimmt (ein Zähllauf für alle angefragten Commits, gegen den ersten Elternteil, beim Wurzel-Commit gegen den leeren Baum, Submodule mitgezählt).
- FA 2: Bis einschließlich `SCHWELLE_UMBENENNUNG = 10.000` Einträgen sucht der Diff Umbenennungen wie heute (`-M50% -l1000`, in `log` `-M -l1000`); darüber nur Umbenennungen mit gleichem Inhalt (`-M100%`, ohne `-l`). Die Schwelle ist eine Konstante im Modul (PO Z. 699: Startwert, ohne neue Entscheidung des Auftraggebers anpassbar).
- FA 3: Ein Urteil je Commit gilt für **jeden** Lauf dieses Commits: Metadaten (Zähler `plus`, `minus`, `dateien`), Roh-Liste, Zähler, Patch, mit und ohne Pfadangabe, in der Abkürzung von `datei=` ebenso wie im Rückfall ohne Angabe (N7.8), und in `format=patch`. Gemischt wird nie.
- FA 4: Über der Schwelle steht in `hinweise` des Diffs je Commit (Liste und `datei=`) an erster Stelle, vor `dateien_gekappt`, die neue Art `{art: "umbenennung_eingeschraenkt", dateien: n, schwelle: 10000}`. `format=patch` trägt keinen Hinweis (kein Kanal, wie bei `dateien_gekappt`).
- FA 5: Über der Schwelle bleibt eine Umbenennung mit gleichem Inhalt `R` mit `aehnlichkeit 100`; eine Umbenennung mit Änderung erscheint als `D` (alter Pfad) und `A` (neuer Pfad), beide vollständig und je über `datei=` ladbar.
- FA 6: Die Commit-Liste der Karte (R00204, `GET …/commits`) und die Kopfwerte `commits[i]` des Gesamt-Diffs (R00208) zählen jeden Commit nach demselben Urteil; der Körper des Gesamt-Diffs (Namens-, Netto- und Folge-Läufe) bleibt bei `-M50% -l1000` („nie fremd“, N11.3 Punkt 4).
- FA 7: `GRENZEN_VERSION` steigt um eins, damit ein alter `ETag` nicht die alte Form zurückgibt (N11.3 Punkt 7).
- FA 8: Die Review-Seite zeigt im Zustand „ein Commit“ (D0009 `#diff-fenster`) über der Schwelle eine Hinweiszeile mit Symbol und Text, **vor** der Kappungszeile, im Wortlaut (PO Z. 700): „Sehr großer Commit ({dateien} Dateien): Umbenennungen werden nur erkannt, wenn der Inhalt gleich blieb. Umbenannte und zugleich geänderte Dateien erscheinen als gelöscht und neu.“ `{dateien}` ist `n` aus dem Hinweis mit Tausenderpunkt wie die Kappungszeile („10.001“); die Schwelle steht nicht im Satz. Der Gesamt-Diff bekommt keinen Satz (PO Z. 701).
- FA 9: API-Beschreibung (OpenAPI des Diffs) und README „Für Agenten“ nennen die neue Hinweisart und die Bedeutung von `D`/`A` über der Schwelle.

## Nicht-funktionale Anforderungen

- Performance (Messungen N11.1, Git 2.48.1, Last 3–6): Die Grenzen der AK 1–3 sind die Gesamtgrenze von 10 s aus N4.1. Erwartet sind für `gross2.py` 145.000 `datei=x` etwa 5,7 s Git-Zeit statt 10,8 s (Herleitung N11.5: 0,07 + 3,86 + 0,13 + 1,61 s; Hypothese des architekt, wird mit AK 1 gemessen). Abstand zur Grenze damit etwa 40 %, über den 30 % aus der Zeitkriterien-Regel.
- Unter der Schwelle kommt nur der Zähllauf dazu (etwa 10 ms bei 30 Commits, gemessen N11.1); die Lastproben bleiben unter ihrem Ziel (AK 10).
- Sicherheit: keine neue Eingabe, kein neuer Endpunkt; die Schalter bestimmt weiter die Lesefunktion (N4.7), `-M100%` kommt zu den Formschaltern.
- Benutzerfreundlichkeit: die Hinweiszeile trägt Symbol und Text, nicht nur Farbe (PO Z. 700).

## Akzeptanzkriterien

Abnahme-Proben aus ADR-0032 N11.6, wörtlich übernommen. **Tagprobe** heißt: nur im Tagbetrieb (8–21 Uhr), Release-Build, eigene Instanz auf freiem Port mit `--host 127.0.0.1`, Repositories im eigenen Ordner der Ablage, `nice -n 10`, Last ≤ 6 vor jedem Lauf (`uptime`); fällt der Lauf in den Nachtbetrieb, meldet der Bericht das Kriterium als offen. Vorgeschlagene Ebene je Kriterium in eckigen Klammern (Regel „Interactor je Interaction, E2E nur für den Hot Path“).

### Sehr große Commits in der Gesamtgrenze (Karte)

- [ ] **AK 1 (P1, Abnahme der Karte, Tagprobe) [Probe im echten Programm]:** Gegeben ein Commit, der die Datei `x` durch den Ordner `x/` mit 145.000 gleichen Dateien ersetzt (`gemeinsam/scratchpad/srev-229/gross2.py <kanbanD> 145000 4` der Factory), wenn `datei=x` gelesen wird, dann antwortet kanbanD mit 200 innerhalb von 10 s. Heute 200 nach 8,76 s bei Last 5,5 und 503 bei Last 8–10.
- [ ] **AK 2 (P2, Tagprobe) [Probe im echten Programm]:** Gegeben derselbe Aufbau mit 75.000 Dateien (`gross2.py <kanbanD> 75000 4`), wenn die Liste (ohne `datei=`) gelesen wird, dann antwortet kanbanD mit 200 innerhalb von 10 s. Heute 503 nach 10,02 s (rot).
- [ ] **AK 3 (P3, Tagprobe) [Probe im echten Programm]:** Gegeben ein Commit, der 72.500 Dateien `a/<n>` nach `b/<n>` verschiebt und in jeder eine von vier Zeilen ändert (145.000 Einträge; `gemeinsam/scratchpad/arch-233/umbenannt2.py <kanbanD> 145000` der Factory), wenn Liste, `datei=b/aaaa` und `format=patch` gelesen werden, dann antwortet jede der drei Anfragen mit 200 innerhalb von 10 s. Heute 503 / 200 nach 9,11 s / 503 (rot).

### Schwelle und Urteil je Commit

Ausgangslage für AK 4–8 (P4): ein Commit, der gegen seinen ersten Elternteil `a/gleich.txt → b/gleich.txt` unverändert verschiebt, `a/r.txt` (5 Zeilen) nach `b/s.txt` verschiebt und dabei eine Zeile ändert, und `F` neue Dateien `z/<n>` mit je eigenem Inhalt anlegt. Ohne Umbenennungssuche hat er `4 + F` Einträge. Der Test nutzt die echte Konstante.

- [ ] **AK 4 (P4, Fall 10.000) [Integration]:** Gegeben `F = 9.996` (also 4 + 9.996 = 10.000 Einträge, genau auf der Schwelle), wenn Liste, `datei=b/s.txt` und `datei=b/gleich.txt` gelesen werden, dann steht `b/s.txt` als `R` mit `alt a/r.txt` und `aehnlichkeit ≥ 50`, `b/gleich.txt` als `R` mit 100, `hinweise` enthält kein `umbenennung_eingeschraenkt`, und `commits[0].dateien` ist 9.998 (zwei Paare zählen je als eine Datei: 10.000 − 2).
- [ ] **AK 5 (P4, Fall 10.001) [Integration]:** Gegeben `F = 9.997` (10.001 Einträge), wenn Liste, `datei=b/s.txt`, `datei=a/r.txt` und `format=patch` gelesen werden, dann steht `b/s.txt` als `A` (auch über `datei=b/s.txt`) und `a/r.txt` als `D` (auch über `datei=a/r.txt`), beide mit allen Zeilen, `b/gleich.txt` weiter als `R` mit 100; `hinweise[0]` ist `{art: "umbenennung_eingeschraenkt", dateien: 10001, schwelle: 10000}` in der Liste und bei `datei=`; `commits[0].dateien` ist 10.000 (nur das unveränderte Paar zählt als eine: 10.001 − 1); `format=patch` zeigt `deleted file` für `a/r.txt` und `new file` für `b/s.txt`. Heute zeigt Fall 10.001 `R` und keinen Hinweis (rot).
- [ ] **AK 6 (P4, beide Fälle) [Integration]:** Gegeben die Fälle 10.000 und 10.001, wenn die Commit-Liste der Karte (`GET …/commits`, R00204) gelesen wird, dann trägt der Commit dieselben `plus`, `minus` und `dateien` wie `commits[0]` des Diffs (9.998 bzw. 10.000 Dateien).
- [ ] **AK 7 (P5, ein Urteil je Commit, Befehlszeilen über `GIT_TRACE` wie R00206 AK 16 c) [Integration]:** Gegeben Fall 10.001, wenn Liste, `datei=b/s.txt` und `format=patch` gelesen werden, dann tragen alle Läufe `log` und `diff-tree` dieses Commits `-M100%` und keiner `-M50%` oder `-l1000`; gegeben Fall 10.000, dann tragen alle `-M50% -l1000` bzw. `-M -l1000`; und ein Gesamt-Diff über den Fall 10.001 startet `diff-tree` nur mit `-M50% -l1000`.
- [ ] **AK 8 (P7, `ETag`) [Integration]:** Gegeben der `ETag` einer Antwort für Fall 10.001 vom Stand vor der Erhöhung von `GRENZEN_VERSION`, wenn dieselbe Anfrage mit `If-None-Match: <dieser ETag>` gestellt wird, dann antwortet kanbanD mit 200, nicht mit 304.

### Hinweiszeile und Lastprofil

- [ ] **AK 9 (Hinweiszeile, PO Z. 700–701) [Unit (Node) für den Satz, Probe im echten Programm]:** Gegeben die Review-Seite zeigt Fall 10.001 im Zustand „ein Commit“, wenn die Seite gezeichnet ist, dann steht über den Dateien eine Zeile mit Symbol und dem Satz „Sehr großer Commit (10.001 Dateien): Umbenennungen werden nur erkannt, wenn der Inhalt gleich blieb. Umbenannte und zugleich geänderte Dateien erscheinen als gelöscht und neu.“, und zwar vor der Kappungszeile „2.000 von 10.000 Dateien gezeigt. …“; gegeben Fall 10.000, dann fehlt der Satz; gegeben der Gesamt-Diff der Aufgabe mit Fall 10.001, dann fehlt der Satz ebenfalls.
- [ ] **AK 10 (P6, Lastprofil, Tagprobe) [Lastprobe]:** Gegeben die Lastproben R00206 AK 15 (Ziel p95 500 ms), R00204 AK 10 (200 ms) und R00208 (500 ms) mit ihren Erzeugern, bei Last unter 2 wie dort verlangt, wenn sie nach dem Bau laufen, dann liegt jede mit p95 unter ihrem Ziel (Stand vorher: 107 / 85 ms, 150 ms, 259 ms); die Werte stehen in der Commit-Nachricht.

## Betroffene Verzeichnisstruktur

- `src/git/arbeitsrepo.rs`: Zähllauf, Urteil, `metadaten` (heute `:342`, Schalter `:345`), Lesefunktion `diff_tree`/`diff_tree_viele` (`:417–446`); Formschalter `-M100%`.
- `src/dienst/diff.rs`, `src/dienst/commits_lesen.rs`, `src/dienst/gesamt_diff.rs` (nur Kopfwerte), `src/dienst/nachfolger.rs`: Urteil weitergeben bzw. Zählung der Prozesse.
- `src/modell/commit_diff.rs:25` (`GRENZEN_VERSION`), Hinweisart im Modell des Diffs.
- `src/web/endpunkte.rs`, `src/web/mod.rs` (OpenAPI), `README.md` „Für Agenten“.
- `web/diff.js` (neben `gekapptHtml` `:770`), `web/app.js:2359` (Review-Seite, Reihenfolge vor der Kappungszeile).
- Tests: `tests/akzeptanz_r00253.rs` (neu), `e2e/einheit/diff.test.js`; Zählungstests `tests/arbeitsrepo_lesen.rs:208`, `src/dienst/nachfolger.rs:721`, `src/dienst/diff.rs:522` auf die neue Zahl.
- `Dokumentation/Wireframes/D0009*.dc.html`: eine Zeile `umbenennung_eingeschraenkt` in der Notiz „Hinweisarten“ (PO Z. 701, keine Nachzeichnung).

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler; Datenfluss in der WBS unter I0243)

1. **Proben zuerst rot** (B1342): AK 5, AK 7, AK 8 rot am heutigen Stand; AK 4 und AK 6 als Wächter grün.
2. **Zähllauf und Urteil** (B1343): `log --no-walk=unsorted -z --root --no-renames --ignore-submodules=none --diff-merges=first-parent --name-only --format=%H%x00 --end-of-options <commits> --` → `n` je Commit → `Umbenennungssuche::Voll` (≤ 10.000) oder `NurGleiche`; Zeilenzähl-Lauf je Gruppe (zweiter nur, wenn ein Commit über der Schwelle liegt); `Metadaten` trägt `umbenennung` und `n`.
3. **Formschalter** (B1344): `diff_tree` nimmt das Urteil; Befehlszeilentest beider Formen gegen echtes Git (R00206 AK 16 c).
4. **Diff je Commit** (B1345): `m.umbenennung` an jeden Lauf, Hinweis an erster Stelle, `GRENZEN_VERSION` + 1.
5. **Commit-Liste, Gesamt-Diff, Nachfolger** (B1346): gleiche Zähler, Körper des Gesamt-Diffs unverändert, Prozesszahlen neu (N11.3 Punkt 6: Diff je Commit etwa acht statt sieben, Liste 6 + 1 statt 5 + 1, Gesamt-Diff höchstens 17 statt 15, Nachfolgersuche einer mehr) — gesetzt, nicht gelockert.
6. **Beschreibung** (B1347): OpenAPI, README, Notiz „Hinweisarten“ in D0009.
7. **Hinweiszeile** (B1348): Satz aus dem Hinweis, Tausenderpunkt wie `tausender`, vor `gekapptHtml`.
8. **Probe im echten Programm** (B1349, Tagprobe): AK 1–3, AK 9, AK 10, Mutanten, Gate.

### Grobentwurf

- `Umbenennungssuche` (Aufzählung `Voll` | `NurGleiche`) — Urteil je Commit; die Lesefunktion übersetzt es in Schalter.
- `SCHWELLE_UMBENENNUNG: usize = 10_000` — Konstante im Modul.
- `Metadaten` (bestehend) — bekommt `umbenennung` und `n`.
- `metadaten(wurzel, commits, frist)` (bestehend) — startet zuerst den Zähllauf, dann je Gruppe den Zeilenzähl-Lauf.
- `diff_tree(…, umbenennung)` (bestehend, erweitert) — Form und Inhalt aus der Lesefunktion (N4.7).

### Änderungen an bestehenden Klassen

Siehe „Betroffene Verzeichnisstruktur“; die Anforderungen R00204, R00206 und R00208 bleiben als Dokumente unverändert, ihre Zählungstests werden auf die neue Zahl gesetzt.

## Tests

- **Unit (Rust):** Urteil aus `n` (10.000 → `Voll`, 10.001 → `NurGleiche`); Zerlegung des Zähllaufs (`-z`, Wurzel-Commit, Submodul).
- **Unit (Node):** Satz der Hinweiszeile und Reihenfolge vor der Kappungszeile (`e2e/einheit/diff.test.js`).
- **Integration:** AK 4–8 gegen den Dienst mit echtem Git in Wegwerf-Repositories (`fast-import`), Befehlszeilen über `GIT_TRACE`.
- **Probe im echten Programm / Last:** AK 1–3, AK 9 (headless), AK 10 — Tagprobe.
- **E2E:** keine neue Spec nötig (kein Hot Path; der Satz ist eine weitere Zeile im bestehenden Muster der Kappungszeile). Hält der entwickler die Reihenfolge im gezeichneten Zustand für Browser-Eigenes, begründet er eine E2E-Probe im Bericht.

## Abhängigkeiten

- Abhängig von: R00206 Diff eines Commits per API lesen (I0196), R00204 Commit-Liste einer Karte (I0194), R00208 Gesamt-Diff (I0198), R00211 Pfadangabe bei Typwechsel, Rückfall N7.8 (I0201) — alle gebaut.
- Blockiert: keine. Optional später: eigene Karte U5 (Zähler der Liste nicht doppelt zählen, N11 Konsequenzen).

## Offene Fragen

- keine an den Auftraggeber (PO Z. 702: nicht richtungsweisend).

## Manuelle Vorbereitungstätigkeiten

- Keine. Die Proben `srev-229/gross2.py` und `arch-233/umbenannt2.py` liegen in der Ablage der Factory; AK 1–3 beschreiben die Repositories so, dass sie auch ohne diese Skripte herstellbar sind.

## Manuelle Nachbereitungstätigkeiten

- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Commit mit 145.000 Dateien aus #229: `datei=x` kam nur knapp unter, bei Last über die Gesamtgrenze von 10 s, und die Liste schon ab 75.000 Dateien gar nicht. Die Messung N11.1 zeigt, dass die Zeit in der Umbenennungssuche steckt, die in jedem Lauf der Anfrage neu läuft, und dass `-l` sie nicht begrenzt (1 × 145.000 liegt unter 1.000²). Wenn kanbanD über 10.000 Einträgen nur noch Umbenennungen mit gleichem Inhalt sucht, dann sinkt jeder Lauf auf die Zeit ohne Suche (Liste 1,86 → 0,13 s, Rückfall 3,44 → 1,61 s), und die Anfrage passt wieder in die Gesamtgrenze. Weil das Urteil je Commit einmal fällt und alle Läufe ihm folgen, passen Liste, Zähler und Kopfwerte weiter zusammen; weil Hinweis und Hinweiszeile die Einbuße nennen, ist sie nie still. Der Hebel liegt genau hier und nicht in einem Cache oder einer Pfadbegrenzung: Der Cache hilft dem ersten Aufruf nicht, die Pfadbegrenzung hilft `datei=x` nicht (N11.1 Erkenntnis 4).

## Missing-Docs

- Keine: Verhalten von `-M100%` und `-l` ist mit Git 2.48.1 gemessen (N11.1) und in der Git-Dokumentation `git-diff` belegt.

## Notizen

- Verworfene Alternativen (N11.2): U2 `--no-renames` über der Schwelle (verliert unveränderte Verschiebungen, den häufigen Massenfall); U3 kleineres `-l` (Paarung über Dateinamen bleibt teuer, 3,58 s je Lauf); U4 `datei=` ohne `--numstat` (Zähler wichen von der Liste ab); U5 Wiederverwendung der Zähler (für diese Karte zu groß, eigene Karte); U6 Pfadbegrenzung (gebaut, hilft `x` nicht).
- Nicht Teil: die Liste von gross2 mit 145.000 Einträgen bleibt „200 oder 503“ (N7.9, R00211 AK 8; etwa 9 s Git-Zeit, N11.5 „Was bleibt“). Der Körper des Gesamt-Diffs bleibt bei voller Suche.
- Mutanten nennt N11.6; Auswahl und Testmittel entscheidet der entwickler.
