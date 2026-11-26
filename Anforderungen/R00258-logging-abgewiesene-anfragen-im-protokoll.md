---
id: R00258
status: Neu
datum: 2026-11-26
---

# R00258: Logging nach ADR-0001, Scheibe 1 — Protokoll je Instanz und eine Zeile je abgewiesener Anfrage, ohne Inhalte

## Beschreibung

kanbanD führt ein Protokoll: jede Instanz schreibt nach stderr und in `kanbanD.log` außerhalb des Board-Ordners, rotiert täglich, hält 14 Tage und kennt die Stufen DEBUG, INFO, WARN, ERROR und EXCEPTION. Jede abgewiesene API-Anfrage (4xx, 503) hinterlässt genau eine WARN-Zeile, jeder Serverfehler (übrige 5xx) genau eine ERROR-Zeile. Die Zeile nennt Status, Kürzel, Endpunkt, Aufgabe und Ursache; sie enthält keinen Rumpf, keinen Inhalt und keinen fremden Header. Heute bleibt eine Abweisung spurlos (`impl IntoResponse for Fehler`, `src/web/mod.rs:143`), und es gibt nur acht `eprintln!`/`println!`.

Karte #239, Scheibe 1 nach ADR-0001 Nachtrag N1 (akzeptiert, `fa5a839e`, nach Rebase `1cd93362`): N1.1–N1.4 ohne N1.4 Regel 5 und 6, Proben P1–P1f, Karten-Probe „braucht:999“. Scheibe 2 (Fluten der Kapazitätsgrenzen als Episoden, defekte Dateien, Haltezeit der Schreibsperre; N1.4 Regel 5/6, N1.5, N1.6) ist Karte #272 (PO Z. 703). Bis #272 gebaut ist, schreibt **jede** 503 der Lesegrenze und des Antwortbudgets ihre eigene Zeile — gewollter Zwischenstand (PO Z. 703).

Zahlt ein auf: [Vision](R00000-vision.md) — Menschen und Agenten arbeiten über dieselbe API am selben Ordner; wer sie betreibt, muss nachlesen können, warum ein Agent abgewiesen wurde, ohne den Board-Ordner (Git) zu verschmutzen und ohne dass Inhalte der Aufgaben ins Log gelangen.

### Domänenbezug

Kein Eintrag im Glossar betroffen. „Abweisung“, „Ursache“, „Sammelweg“ und „Protokoll“ sind Begriffe aus ADR-0001 N1 bzw. ADR-0044 und haben im Glossar keinen Eintrag.

## Geschäftlicher Nutzen

Ein Agent meldet „mein Zug ging nicht“ — heute sieht der Betreiber nur den Rumpf, den der Agent vielleicht verworfen hat. Mit dem Protokoll liest er Zeitpunkt, Kürzel, Aufgabe und Ursache nach (`grep ' WARN abgewiesen ' kanbanD.log`). Der Observability-Review von #228 und #238 nennt die fehlende Spur als Befund; X00002 selbst nennt „abgewiesene Züge unprotokolliert“.

## Funktionale Anforderungen

- FA 1: Jede Instanz hat ihr eigenes Protokoll (kein globaler Zustand); Senke im Betrieb stderr und Datei, im Test ein Sammler (ADR-0001 N1.7 Regel 1).
- FA 2: Ziel `$XDG_STATE_HOME/kanbanD/<ordnername>/kanbanD.log`, ohne `XDG_STATE_HOME` `~/.local/state/kanbanD/<ordnername>/kanbanD.log`, nie im Board-Ordner; überschreibbar mit `--log-ordner <pfad>` bzw. `KANBAND_LOG_ORDNER`, Flag vor Variable (N1.2 Regel 1).
- FA 3: Tägliche Rotation nach Ortsdatum zu `kanbanD.log.JJJJ-MM-TT` (Datum des alten Tages); beim Start und bei jeder Rotation werden `kanbanD.log.<Datum>` mit Datum vor mehr als 14 Tagen gelöscht, andere Dateien nie (N1.2 Regel 2).
- FA 4: Ein Fehler des Logs stoppt nie den Server: eine Zeile auf stderr, die Datei-Senke ruht bis zur nächsten Rotation, stderr läuft weiter (N1.2 Regel 3).
- FA 5: Stufen `DEBUG`, `INFO`, `WARN`, `ERROR`, `EXCEPTION`; Standard `INFO`; `--log debug|info|warn|error` bzw. `KANBAND_LOG`, Flag vor Variable; ein unbekannter Wert ist ein Aufruffehler mit Exit-Code 2 (N1.2 Regel 4).
- FA 6: INFO-Zeilen `gestartet` (Ordner, Port, Log-Pfad) und je Commit in `aktion()` `commit` (`wer`, `instanz`, Anzahl Dateien, ohne Commit-Text); `EXCEPTION Panik` über einen Panik-Hook, den nur `main` setzt (N1.2 Regel 4).
- FA 7: Die acht `eprintln!`/`println!` ziehen ins Protokoll um; außerhalb von `src/main.rs` (Aufruffehler vor dem Start) und `src/protokoll.rs` gibt es keines mehr (N1.2 Regel 5).
- FA 8: Zeilenformat `<RFC 3339 mit ms und Versatz> <STUFE> <Ereignis> <feld>=<wert> …`, Ereignis aus einer geschlossenen Liste ohne `=`, Werte mit Leerzeichen in `"…"`, `"`, `\`, Zeilenumbruch und Steuerzeichen als `\"`, `\\`, `\n`, `\u{..}`; jeder Wert höchstens 200 Zeichen, gekürzt mit `…` (N1.3).
- FA 9: Genau eine Stelle schreibt Abweisungen: eine Middleware um alle `/api`-Routen, nach dem Handler und bevor die Antwort zurückgeht; 4xx und 503 → `WARN abgewiesen`, übrige 5xx → `ERROR fehlgeschlagen`; je Anfrage höchstens eine Zeile (N1.4 Regel 1).
- FA 10: Felder `status`, `wer`, `instanz` (falls Header), `methode`, `endpunkt` (Vorlage aus `MatchedPath`, nie die rohe URI), `aufgabe=#<n>` (Pfadparameter `nr`), `ursache`, `grund` (N1.4 Regel 2).
- FA 11: `ursache` aus einer geschlossenen Liste an genau einem Ort (`Fehler::ursache()`): `eingabe` 400, `fehlt` 404, `verboten` 403, `konflikt` 409, `grenze` 409 WIP, `defekt` 423, `zu_gross` 413, `zeitgrenze`, `lesegrenze`, `antwortbudget` (je 503), `intern` 500; `Fehler::Ausgelastet` trägt die volle Grenze als Feld, nie aus dem Text gelesen; Rumpf und Status der Antwort ändern sich nicht (N1.4 Regel 3).
- FA 12: Sammelwege tragen statt `aufgabe` die Felder `ziele=<Anzahl>` und `erstes=#<n>`, nie die Liste (N1.4 Regel 4).
- FA 13: `grund` ist die Meldung des Fehlers **ohne Inhalt**: wo eine Meldung einen Titel, einen Fehlertext des Parsers, einen Wert aus Rumpf oder Query oder einen Commit-Text einsetzt, steht im Log an dieser Stelle nur dessen Länge (`<n Zeichen>`); Nummern, Spalten-, Board- und Labelnamen, Kürzel und Schlüssel bleiben (N1.3 „Datenschutz“, gemeinsame Lehre „Benutzereingaben im Log nur als Länge oder Kennung“). Der Rumpf der Antwort bleibt unverändert.

## Nicht-funktionale Anforderungen

- Sicherheit: kein Wert bricht die Zeile (Log-Injektion über Header und Meldung); nie Rumpf, Beschreibung, Kommentar, Aufgaben-Titel, Commit-Text, Dateiinhalt, Query-String, Header außer `X-KanbanD-Wer` und `X-KanbanD-Instanz` (je höchstens 32 Zeichen, gekürzt mit `…`).
- Determinismus: die Zeile steht im Log, bevor die Antwort den Server verlässt (synchron geschrieben). Kein Test wartet auf eine Wanduhr, keine Zeitgrenze im Gate (Lehre #278); Rotation und Aufbewahrung über eine feste Uhr.
- Keine neue Abhängigkeit (ADR-0001 N1.1, Option C); `chrono` ist schon im Baum.

## Akzeptanzkriterien

Ebene je Kriterium in Klammern: **I** = Integrationstest in-process gegen die Instanz mit Sammler-Senke (Treiber `tower::ServiceExt`, wie die bestehenden Tests in `src/web/mod.rs`), **U** = Unit-Test einer reinen Funktion, **P** = Probe im echten Programm (Release-Build, eigene Instanz auf freiem Port, `--log-ordner <L>`, `LOG=<L>/kanbanD.log`). Kein Browser-E2E: keine Oberfläche betroffen. Ausgangslage aller I- und P-Kriterien: eingerichteter Wegwerf-Ordner mit Person `cl` (Art agent), Mensch `mi`, Aufgaben #1 und #2 (ADR-Proben `gemeinsam/scratchpad/arch-239/abnahme-proben.md` der Factory).

### Abgewiesene Anfragen

- [ ] **AK 1 Karten-Probe** (I, P): Gegeben #1 und der Agent `cl`, wenn `cl` `PATCH /api/aufgaben/1` mit `{"labels":["braucht:999"],"beschreibung":"GEHEIM-239"}` schickt, dann antwortet kanbanD 400 mit unverändertem Rumpf, und das Log hat **genau eine** neue Zeile mit ` WARN abgewiesen `; sie enthält `status=400`, `wer=cl`, `methode=PATCH`, `endpunkt=/api/aufgaben/{nr}`, `aufgabe=#1`, `ursache=eingabe` und `Aufgabe #999 gibt es nicht (braucht:999)`; `grep -c GEHEIM-239 $LOG` = 0 und `grep -c '"labels"' $LOG` = 0. Wörtlich P1: `vorher=$(grep -c ' WARN abgewiesen ' $LOG)`, `curl -s -o /dev/null -w '%{http_code}' -X PATCH -H 'X-KanbanD-Wer: cl' -H 'Content-Type: application/json' -d '{"labels":["braucht:999"],"beschreibung":"GEHEIM-239"}' http://127.0.0.1:$P/api/aufgaben/1` → `400`, danach `grep -c ' WARN abgewiesen ' $LOG` = vorher + 1.
- [ ] **AK 2 Ursache je Abweisung** (I): Gegeben die Ausgangslage, wenn je eine der folgenden Anfragen kommt, dann steht genau eine ` WARN abgewiesen `-Zeile mit diesem Status und dieser Ursache — abgetastet über die ganze Liste, nicht an Beispielen:

  | Anfrage | Status | `ursache` |
  |---|---|---|
  | Agent `cl` zieht eine Karte aus einer Spalte, die dem Menschen gehört | 403 | `verboten` |
  | Agent `cl` bewegt eine Karte in eine Spalte mit erreichter WIP-Grenze | 409 | `grenze` |
  | `PATCH /api/aufgaben/9999` | 404 | `fehlt` |
  | ein 409 ohne Grenze (z. B. fremde gültige Reservierung) | 409 | `konflikt` |
  | Änderung an einer defekten Aufgabendatei | 423 | `defekt` |
  | Körper über der Grenze der Route | 413 | `zu_gross` |
  | Anfrage mit `X-KanbanD-Wer: zz` (steht nicht in `kanbanD.md`) | 400 | `eingabe` |

  Eine Anfrage mit 200 oder 201 schreibt keine Zeile mit `abgewiesen` oder `fehlgeschlagen`.
- [ ] **AK 3 503 je Anfrage** (I): Gegeben die Fixture von `verweis_400_und_404_mit_verweis_zeitgrenze_503` (`src/web/mod.rs:1954`), wenn drei Anfragen an der Zeitgrenze enden, dann stehen drei Zeilen mit `status=503` und `ursache=zeitgrenze`. Gegeben die Lesegrenze voll belegt (wie `src/dienst/commits_lesen.rs:348`) bzw. ein kleines Antwortbudget (wie `src/dienst/transkripte.rs:818`), wenn drei Anfragen abgewiesen werden, dann stehen drei Zeilen mit `ursache=lesegrenze` bzw. `ursache=antwortbudget` (Zwischenstand bis #272, PO Z. 703). Mutant „Ursache aus dem Meldungstext“: die Meldung der Lesegrenze umformuliert → die Ursache bleibt `lesegrenze`.
- [ ] **AK 4 Serverfehler** (I): Gegeben ein Arbeits-Repository, dessen Commit scheitert (Fixture wie die bestehenden 500-Tests), wenn eine schreibende Anfrage 500 bekommt, dann steht genau eine Zeile ` ERROR fehlgeschlagen ` mit `status=500` und `ursache=intern` und keine ` WARN abgewiesen `-Zeile.
- [ ] **AK 5 Abweisung ohne Fehler von kanbanD** (I): Gegeben eine Anfrage an eine bekannte Route, die axum selbst abweist, bevor ein Handler einen `Fehler` liefert (z. B. ein Pfadparameter `nr`, der keine Zahl ist, falls er nicht über `src/web/koerper.rs` läuft), wenn sie mit einem 4xx endet, dann steht genau eine ` WARN abgewiesen `-Zeile mit `grund=-` und `ursache=-`. Läuft jede solche Abweisung schon über `Fehler`, nennt der Entwickler im Bericht den geprüften Fall, und das Kriterium gilt mit dessen Ursache.
- [ ] **AK 6 Die Zeile ist da, wenn die Antwort da ist** (I, P): Gegeben AK 1, wenn der Aufrufer die Antwort erhalten hat, dann steht die Zeile ohne Warten und ohne Wiederholschleife im Log (im Test: Lesen des Sammlers direkt nach dem `await`).

### Sammelwege

- [ ] **AK 7 Anzahl und erstes Ziel statt Liste** (I, P): Gegeben #4 bis #15, wenn `cl` `PATCH /api/aufgaben/mehrere` mit zwölf Änderungen in der Reihenfolge #4, #5, …, #15 schickt und eine davon ungültig ist, dann antwortet kanbanD 400, und es steht genau eine Zeile mit `ziele=12` und `erstes=#4`, ohne Feld `aufgabe` und ohne eine Liste von Nummern; in `grund` darf die Meldung die abgewiesene Nummer nennen wie der Rumpf. Rechenbeispiel: zwölf Einträge #4–#15 → `ziele=12`, `erstes=#4` (erstes in der Reihenfolge der Anfrage, nicht die kleinste Nummer: Reihenfolge #9, #4 → `erstes=#9`).
- [ ] **AK 8 alle sieben Sammelwege** (I): Gegeben je eine abgewiesene Anfrage an `PATCH /api/aufgaben/mehrere`, `POST /api/aufgaben/archivieren`, `POST /api/aufgaben/zurueckholen`, `POST /api/boards/{slug}/bewegen-mehrere`, `POST /api/boards/{slug}/aufgaben/mehrere`, `POST /api/aufgaben/mehrere` und `POST /api/aufgaben/{nr}/teilaufgaben/mehrere`, dann trägt jede Zeile `ziele=<Anzahl der Einträge>`; `erstes=#<n>` steht, wo die Einträge Nummern tragen (die ersten fünf), beim Anlegen mehrerer Aufgaben fehlt es; bei den Teilaufgaben steht zusätzlich `aufgabe=#<nr>` aus dem Pfad. Abgetastet über alle sieben.

### Sicherheit und Datenschutz

- [ ] **AK 9 kein Rumpf, keine Query, kein fremder Header** (I): Gegeben jede Anfrage aus AK 1, 2 und 7 zusätzlich mit dem Rumpf-Marker `GEHEIM-239`, der Query `?q=GEHEIM-QUERY` und den Headern `Authorization: Bearer GEHEIM-TOKEN`, `Cookie: k=GEHEIM-KEKS`, `User-Agent: GEHEIM-UA`, wenn sie abgewiesen wird, dann enthält keine Zeile des Sammlers einen der Marker, und `endpunkt` ist die Vorlage der Route (`/api/aufgaben/{nr}`, nie `/api/aufgaben/1?q=…`).
- [ ] **AK 10 keine Inhalte im Grund** (I): Gegeben eine Meldung, die Inhalt einsetzt, wenn die Anfrage abgewiesen wird, dann steht der Inhalt nicht im Log, an seiner Stelle seine Länge, und der Rumpf der Antwort ist unverändert. Abgetastet über die Fundliste (mindestens):

  | Anfrage | Meldung (Fundstelle) | im Log nicht |
  |---|---|---|
  | `POST /api/aufgaben/mehrere` mit `{"titel":["GEHEIM-TITEL-239"],…}` und Label `braucht:999` | `„{t}“: …` (`src/dienst/aufgabe_anlegen.rs:188`, `:202`) | `GEHEIM-TITEL-239` |
  | `POST /api/aufgaben/1/teilaufgaben` mit `{"text":"t","erledigt":"GEHEIM-WERT"}` | `„erledigt“ muss true oder false sein, nicht {wert}` (`src/web/mod.rs:1033`) | `GEHEIM-WERT` |
  | `POST /api/aufgaben/1/teilaufgaben` mit `{"text":"t","position":"GEHEIM-ZAHL"}` | `„{feld}“ muss eine ganze Zahl ab 0 sein, nicht {wert}` (`src/web/mod.rs:1648`) | `GEHEIM-ZAHL` |
  | `commits` mit dem Eintrag `{"x":"GEHEIM-COMMIT"}` | `commits[{i}] ist kein Text: {v}` (`src/dienst/commits.rs:140`) | `GEHEIM-COMMIT` |
  | `GET /api/aufgaben?wartet=GEHEIM-QUERY` | `wartet={v}: …` (`src/dienst/aufgabenfilter.rs:51`, `:58`) | `GEHEIM-QUERY` |
  | Änderung an einer defekten Datei mit `GEHEIM-DEFEKT` im Text | `{pfad}: {e} — nur lesbar …` (`src/ablage.rs:169`, `:185`; `aufgabe_anlegen.rs:319`) | `GEHEIM-DEFEKT` |

  Rechenbeispiel: Titel `GEHEIM-TITEL-239` (16 Zeichen) → `grund="„<16 Zeichen>“: Aufgabe #999 gibt es nicht (braucht:999)"`. Der Entwickler sucht die Fundliste vollständig (alle `Fehler::…(format!(…))` mit eingesetztem Inhalt) und nennt sie im Bericht; eine Meldung mit Inhalt, die nicht in der Liste steht, ist ein Befund.
- [ ] **AK 11 Log-Injektion über Header** (I, P): Gegeben `X-KanbanD-Wer: cl" status=200 x="` bzw. ein Wert mit Tabulator, Anführungszeichen, Backslash und `=`, wenn die Anfrage abgewiesen wird, dann wächst das Log um genau eine Zeile (`wc -l` + 1), und ein Leser, der Werte in Anführungszeichen als Ganzes nimmt, findet in ihr genau ein Feld `status` mit dem Wert `400`. P1-Variante wörtlich: Header `X-KanbanD-Wer: a\nb` (in einfachen Anführungszeichen, also Backslash und `n`) → die Zeile bleibt eine Zeile.
- [ ] **AK 12 Kürzen** (U, I): Gegeben `X-KanbanD-Wer` mit 40 × `a`, wenn die Anfrage abgewiesen wird, dann steht `wer=` mit 32 × `a` und `…`; gegeben `X-KanbanD-Instanz` mit 40 Zeichen, dann ebenso 32 und `…`; gegeben ein Wert mit 250 Zeichen, dann steht er mit 200 Zeichen und `…`.
- [ ] **AK 13 Zeilenformat** (U): Gegeben ein Ereignis zu einem festen Zeitpunkt, wenn es geschrieben wird, dann beginnt die Zeile mit dem Zeitpunkt in RFC 3339 mit Millisekunden und Versatz (`2026-11-23T14:19:05.123+01:00`), dann Stufe, Ereignis und Felder; Escaping als Tabelle: `a b` → `"a b"`, `a"b` → `"a\"b"`, `a\b` → `"a\\b"`, Zeilenumbruch → `\n`, Wagenrücklauf → `\u{d}`, Tabulator → `\u{9}`, `ESC` → `\u{1b}`; ein Wert ohne Leerzeichen und ohne diese Zeichen steht roh.

### Ziel, Rotation, Aufbewahrung

- [ ] **AK 14 Ziel außerhalb des Board-Ordners** (I, P): Gegeben `XDG_STATE_HOME=<S>` und kein `--log-ordner`, wenn kanbanD für den Ordner `…/mein-board` startet, dann gibt es `<S>/kanbanD/mein-board/kanbanD.log` mit der Zeile ` INFO gestartet `, und im Board-Ordner entsteht keine Datei (`git status --porcelain` leer, keine `*.log`). Ohne `XDG_STATE_HOME` liegt das Log unter `$HOME/.local/state/kanbanD/mein-board/` (Test mit gesetztem `HOME`). `--log-ordner <A>` mit `KANBAND_LOG_ORDNER=<B>` → das Log liegt in `<A>`; nur `KANBAND_LOG_ORDNER=<B>` → in `<B>`.
- [ ] **AK 15 Rotation** (U, feste Uhr): Gegeben eine Zeile am 2026-11-26 und die Uhr auf 2026-11-27 gestellt, wenn die nächste Zeile geschrieben wird, dann enthält `kanbanD.log.2026-11-26` die Zeile vom 26., und `kanbanD.log` enthält nur Zeilen vom 27.
- [ ] **AK 16 Aufbewahrung 14 Tage** (U, feste Uhr): Gegeben im Log-Ordner `kanbanD.log.2026-11-12`, `kanbanD.log.2026-11-13` und `x.txt`, wenn am 2026-11-27 rotiert oder gestartet wird, dann ist `kanbanD.log.2026-11-12` gelöscht (vor 15 Tagen), `kanbanD.log.2026-11-13` bleibt (vor 14 Tagen) und `x.txt` bleibt. Rechenbeispiel: 27 − 12 = 15 > 14 → löschen; 27 − 13 = 14 → behalten. Mutanten „≥ statt >“ und „15 statt 14“ werden rot.
- [ ] **AK 17 Logfehler stoppt nie** (I, P): Gegeben ein Log-Ordner ohne Schreibrecht (`chmod 555`), wenn kanbanD startet und danach eine Anfrage abgewiesen wird, dann antwortet `GET /api/zustand` 200, auf stderr steht genau eine Zeile, die den Log-Ordner als nicht schreibbar nennt, und die Abweisung erscheint weiter auf stderr.

### Stufen und Schalter

- [ ] **AK 18 Stufe wählen** (I, P): Gegeben `--log warn`, wenn kanbanD startet und eine Anfrage abgewiesen wird, dann gibt es keine Zeile ` INFO gestartet `, aber die ` WARN abgewiesen `-Zeile; gegeben `--log error`, dann keine ` WARN `-Zeile, aber ` ERROR fehlgeschlagen ` aus AK 4; gegeben `KANBAND_LOG=debug` und `--log error`, dann gilt `error`.
- [ ] **AK 19 unbekannte Stufe** (U, P): Gegeben `--log laut` bzw. nur `KANBAND_LOG=laut`, wenn kanbanD startet, dann endet es mit Exit-Code 2 und einer Meldung auf stderr, ohne zu lauschen.
- [ ] **AK 20 Start und Commit** (I): Gegeben die Ausgangslage, wenn kanbanD startet, dann steht genau eine ` INFO gestartet ` mit `ordner=`, `port=` und `log=`; wenn danach `cl` den Titel von #1 auf `GEHEIM-NEU-239` ändert, dann steht genau eine ` INFO commit ` mit `wer=cl` und `dateien=<n>`, wobei `<n>` die Anzahl der Pfade dieses Commits ist (`git show --name-only --format= HEAD | wc -l`), und `GEHEIM-NEU-239` steht in keiner Zeile.
- [ ] **AK 21 Panik** (U): Gegeben der Panik-Hook mit Sammler-Senke, wenn eine Panik ausgelöst und gefangen wird, dann steht genau eine Zeile ` EXCEPTION Panik ` mit `ort=<datei:zeile>`; der Text der Panik steht nicht darin (er kann Inhalt tragen).
- [ ] **AK 22 keine Ausgabe am Protokoll vorbei** (P): `grep -rn 'eprintln!\|println!' src | grep -v 'src/main.rs\|src/protokoll.rs'` ist leer (P1f); die bisherigen Meldungen (Browser nicht geöffnet, Ordner nicht beobachtet, Reste nach Löschen) erscheinen als Protokollzeilen mit Stufe.

## Betroffene Verzeichnisstruktur

- `src/protokoll.rs` (neu): Protokoll je Instanz, Zeilenformat, Senken (Datei+stderr, Sammler), Rotation, Aufbewahrung, Stufe, Panik-Hook.
- `src/fehler.rs`: `Fehler::ursache()`, Grenze in `Fehler::Ausgelastet`, Grund ohne Inhalt.
- `src/web/mod.rs`: Middleware um `/api` (`route_layer`), Response-Extension statt Schreiben in `into_response`/`fehlerantwort`, Anfragezettel der sieben Sammel-Handler.
- `src/start/mod.rs`, `src/main.rs`: Schalter `--log`, `--log-ordner`, Umgebungsvariablen, Aufruftext `AUFRUF`, Panik-Hook.
- `src/dienst/mod.rs` (`aktion`, `:230`): INFO `commit`; `src/start/browser.rs`, `src/dienst/archiv.rs:71`, `src/web/mod.rs:57`: Ausgaben ins Protokoll.
- Tests neben dem Code (`#[cfg(test)]`) bzw. `tests/akzeptanz_r00258.rs`.

## Technische Überlegungen

Quelle ist ADR-0001 Nachtrag N1 (akzeptiert); diese Anforderung wiederholt sie nicht, sondern nennt, was Scheibe 1 daraus baut. **Die Bubbles der WBS (I0248, B1373–B1381) sind Vorplanung** — welche Bubbles es am Ende werden, entscheidet der Entwickler.

### Ablauf

1. **Proben zuerst** (B1373): `tests/akzeptanz_r00258.rs` mit AK 1, 7, 10, 11 rot am heutigen Stand (keine Zeile, kein Sammler).
2. **Protokoll-Kern** (B1374): `Protokoll` als Wert je Instanz in `App`, `Kanban`, `Ordner`; `schreiben(stufe, ereignis, felder)`; Zeilenformat und Escaping als reine Funktion; Senke als Provider.
3. **Datei und Schalter** (F0171: B1375, B1376), parallel zu 4 und 5.
   - 3.1 Datei-Senke mit Uhr-Provider (`src/uhr.rs`), Rotation beim ersten Schreiben eines neuen Tages, Aufbewahrung beim Start und bei jeder Rotation, Fehler → eine stderr-Zeile, Senke ruht.
   - 3.2 Startauftrag um Stufe und Log-Ordner; Flag vor Variable; `Aufruffehler` für unbekannte Stufe (Exit 2 wie `src/main.rs:9`).
4. **Eine Stelle für Abweisungen** (F0172: B1377, B1378, B1379).
   - 4.1 `Fehler::ursache()` als einzige Abbildung; `Ausgelastet { grenze, meldung }`; `into_response` und `fehlerantwort` hängen `Abweisungsgrund { ursache, grund }` als Extension an, schreiben nichts.
   - 4.2 Grund ohne Inhalt: an jeder Fundstelle aus AK 10 trägt der `Fehler` neben der Meldung für den Rumpf eine Log-Fassung mit `<n Zeichen>` statt des Inhalts (Arbeitsname `Fehler::grund_fuer_protokoll()`); Rumpf unverändert. Bis der architekt anders entscheidet, gilt diese Regel (offene Frage 1).
   - 4.3 Middleware (`route_layer`, damit `MatchedPath` vorliegt) als dünner Adapter: die Zeile entsteht in einer reinen Funktion `abweisungszeile(status, methode, endpunkt, nr, kopf, zettel, grund) -> Option<Zeile>` (Interactor-Regel: Logik nicht im Adapter); leerer Anfragezettel (`Arc<Mutex<…>>`) in den Request-Extensions, nur die sieben Sammel-Handler füllen ihn vor dem Dienstaufruf.
5. **Ausgaben umziehen** (F0173: B1380): acht Ausgaben, `INFO gestartet`, `INFO commit` in `aktion()`, Panik-Hook nur in `main`.
6. **Abschluss** (B1381): Tagprobe im echten Programm (P1, P1b, P1d-Teil „schreibgeschützt“, P1e, P1f per Shell), Mutanten, Gate, R00258 `Erledigt`.

### Grobentwurf (Klassen-Entwurf ohne Implementierungen)

**Wichtige Einstiegsstellen:** Router-Aufbau in `src/web/mod.rs` (Middleware um `/api`), `impl IntoResponse for Fehler` (`:143`) und `fehlerantwort` (`:208`), Startargumente in `src/start/mod.rs`, `main` in `src/main.rs`, `Kanban::aktion` in `src/dienst/mod.rs:230`.

- `Protokoll` (Ressource je Instanz, klonbar) — schreibt eine Zeile in die Senke, filtert nach Stufe.
  - `fn schreiben(&self, stufe: Stufe, ereignis: Ereignis, felder: &[(&str, Wert)])`
  - `fn sammler() -> (Protokoll, Sammler)` (nur Test)
- `Stufe` (Enum) — `Debug`, `Info`, `Warn`, `Error`, `Exception`; `fn lesen(&str) -> Option<Stufe>`.
- `Ereignis` (Enum, geschlossene Liste) — Scheibe 1: `Gestartet`, `Commit`, `Abgewiesen`, `Fehlgeschlagen`, `Panik` und die umgezogenen Meldungen; Scheibe 2 ergänzt.
- `fn zeile(zeitpunkt, stufe, ereignis, felder) -> String` (reine Funktion) — Format und Escaping, Kürzung auf 200.
- `Dateisenke` (Ressource) — Ziel, Rotation, Aufbewahrung über `Uhr`.
- `Ursache` (Enum) — geschlossene Liste aus FA 11; `Fehler::ursache(&self) -> Ursache`.
- `Abweisungsgrund` (DTO, Response-Extension) — `ursache`, `grund` ohne Inhalt.
- `Anfragezettel` (DTO in `Arc<Mutex<…>>`) — `ziele`, `erstes`.
- `fn abweisungszeile(…) -> Option<Zeile>` (reine Funktion, Interactor der Abweisung).

### Änderungen an bestehenden Klassen

- `Fehler` (`src/fehler.rs`): `ursache()`, `Ausgelastet` mit Grenze, Log-Fassung an den Fundstellen aus AK 10.
- `Startauftrag`, `Aufruffehler`, `AUFRUF` (`src/start/mod.rs`): Stufe, Log-Ordner.
- `App`, `Kanban`, `Ordner`: Feld `protokoll`.
- Sammel-Handler (sieben, `src/web/mod.rs:1808`–`:1930`): Zettel füllen. **Achtung:** #241 (R00257) ändert dieselben sieben Wege parallel (Grenze 5000 an der Tür); beim Rebase ist ein Konflikt in diesen Handlern zu erwarten — main zuerst, eigene Zettel-Zeilen neu einsetzen.

## Tests

Nach Skill `test-pyramide`: Unit für Zeilenformat, Escaping, Kürzung, Stufen-Lesen, Rotation, Aufbewahrung, `abweisungszeile`, `Fehler::ursache`; Integration in-process mit Sammler-Senke für AK 1–12, 14, 17, 18, 20 (Zählen und Enthalten, nie ganze Zeile mit Zeitstempel, N1.7 Regel 3); Probe im echten Programm für AK 1, 7, 11, 14, 17, 19, 22. Kein Browser-E2E. Kein `sleep`, keine Wanduhr-Grenze.

**Mutanten** (je von einem benannten Test getötet): m1 Ursache aus dem Meldungstext (AK 3); m2 Escaping von `"` aus (AK 11, 13); m3 Kürzung der Header aus (AK 12); m4 Log-Fassung aus, Meldung roh (AK 10); m5 Aufbewahrung `>=` statt `>` (AK 16); m6 Variable vor Flag (AK 14, 18); m7 Zettel nicht gefüllt (AK 7, 8); m8 Middleware schreibt auch bei 2xx (AK 2); m9 `endpunkt` aus der rohen URI (AK 9).

## Abhängigkeiten

- Abhängig von: I0001 Ordner öffnen (Startargumente, gruen), I0024 Agent arbeitet über die API (gruen); Karte #228 auf `main` (Label `braucht:228`).
- Parallel: #241 (R00257, I0247) an denselben Sammel-Handlern — keine fachliche Abhängigkeit, nur Rebase.
- Blockiert: #272 (Scheibe 2: Episoden der Kapazitätsgrenzen, defekte Dateien, Sperrzeit) baut auf `src/protokoll.rs` und der Middleware auf.

## Offene Fragen

1. **An den architekt (nicht blockierend):** ADR-0001 N1.3 verbietet Titel, Commit-Text und Dateiinhalt im Log, N1.4 Regel 1 setzt `grund` = `Fehler::meldung()` — mindestens neun Meldungen setzen solchen Inhalt ein (Fundliste AK 10). Bis zur Antwort gilt FA 13 (Inhalt nur als Länge, Rumpf unverändert). Empfehlung: so bestätigen, als Satz in N1.3 nachtragen.
2. **An den architekt (nicht blockierend):** Board-Titel in Meldungen („Spalte „X“ gibt es auf „<Board>“ nicht“) — Kennung oder Titel? Bis zur Antwort Kennung (bleibt im Log), wie Spaltennamen.
3. **An den architekt (nicht blockierend):** `route_layer` schreibt nur für bekannte Routen; ein 404 auf einen unbekannten Pfad (`/api/gibtsnicht`) bleibt ohne Zeile. Empfehlung: für Scheibe 1 hinnehmen, in #272 oder als eigene Karte entscheiden.

## Manuelle Vorbereitungstätigkeiten

- keine

## Manuelle Nachbereitungstätigkeiten

- Director: nach #272 Log-Pfad, `--log-ordner`, `--log`/`KANBAND_LOG` in `AI-Team/factory.md` „Umgebung“; Verweis in `AI-Team/observability-reviewer.md` auf ADR-0001 umstellen (PO Z. 703, Kommentar des architekt).

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Observability-Review von #228: eine abgewiesene Anfrage hinterlässt keine Spur, also kann der Betreiber einem Agenten nicht sagen, warum sein Zug scheiterte. Wenn genau eine Middleware nach dem Handler jede Antwort ab 400 sieht, dann entsteht je Anfrage genau eine Zeile, ohne dass eine der rund 180 Fehlerstellen etwas schreiben muss — keine Stelle kann vergessen werden, keine doppelt. Weil die Ursache aus `Fehler::ursache()` kommt und nicht aus dem Text, bleibt `grep ursache=grenze` stabil, auch wenn Meldungen neu formuliert werden. Weil Werte escaped und gekürzt werden und Inhalte nur als Länge erscheinen, öffnet das neue Log weder Log-Injektion noch ein Datenleck — das wäre sonst der Preis der Sichtbarkeit. Das Protokoll je Instanz mit Sammler-Senke macht alles deterministisch prüfbar und ist das Fundament, auf dem #272 Episoden, Defekte und Sperrzeit nachzieht.

## Missing-Docs

- Welche Header-Bytes hyper an Handler durchreicht (CR/LF werden abgewiesen, Tabulator und `"` nicht) — AK 11 prüft deshalb Tabulator und Anführungszeichen im Header und Zeilenumbrüche über die Meldung.

## Notizen

- Umfang: 9 Bubbles gezählt (B1373–B1381), alle bis Bubble geplant; Richtwert 5–10 h ungemessen (Summe der Spannen, Hypothese des planers). Der architekt nannte etwa 7; dazu kamen B1378 „Grund ohne Inhalt“ (Widerspruch N1.3/N1.4, Fundliste) und die getrennte Abschluss-Bubble.
- Nicht Teil (Scheibe 2, #272): Episoden der Lesegrenze und des Antwortbudgets (`episode=`, `belegt=`, `Episode beendet`, `beobachten`), `WARN defekte Datei`/`INFO Datei repariert`, `Sperrhalter` und `Schreibsperre lange gehalten`.
- Verworfene Alternativen (ADR-0001 N1.1): `tracing` + `-subscriber` + `-appender` (19 Crates, Test-Erfassung je Thread wackelt), `log` + `flexi_logger` (globaler Logger, keine Felder).
