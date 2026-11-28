---
id: R00269
status: In Arbeit
datum: 2026-11-27
---

# R00269: Logging nach ADR-0001, Scheibe 2 — Episoden der Kapazitätsgrenzen, Defektregister und Haltezeit der Schreibsperre

## Beschreibung

kanbanD protokolliert abgewiesene Anfragen seit Scheibe 1 (R00258, Karte #239) mit genau einer Zeile je Anfrage. Das ist für Einzelfälle richtig, flutet aber bei den beiden Kapazitätsgrenzen: solange die Lesegrenze belegt ist oder das Antwortbudget ausgeschöpft ist, hinterlässt jede abgewiesene Anfrage eine eigene Zeile. Eine defekte Datei dagegen hinterlässt heute gar keine Spur im Log, und eine lange gehaltene Schreibsperre ist ebenfalls unsichtbar. ADR-0001 Nachtrag N1 regelt das in N1.4 Regel 5/6 (Episoden), N1.5 (Defektregister) und N1.6 (Sperrhalter, Messwert der Lesegrenze). Diese Anforderung setzt den Nachtrag N1 für Scheibe 2 um; Maßstab ist `Dokumentation/ADRs/0001-logging-konzept.md`, Nachtrag N1. Karte #272, Labels `fehlerpfad`, `sicherheit`.

Heute (Stand `0239cc4a`): Jede 503 der Lesegrenze und des Antwortbudgets schreibt eine eigene ` WARN abgewiesen `-Zeile (gewollter Zwischenstand, PO Z. 703). Die drei vollständigen Leser `Ordner::einstellungen`, `Ordner::boards` und `Ordner::aufgaben` (`src/ablage.rs:139/147/166`) liefern defekte Dateien an den Aufrufer, protokollieren sie aber nicht und kennen kein Register. `Kanban::gesperrt()` (`src/dienst/mod.rs:284`) gibt den nackten `MutexGuard<'_, ()>` zurück; keine Zeile nennt die Haltezeit. `Lesegrenze::belegt()` gibt es nur unter `#[cfg(test)]` (`src/dienst/lesegrenze.rs:28`).

Zahlt ein auf: [Vision](R00000-vision.md) — Menschen und Agenten arbeiten über dieselbe API am selben Ordner; wer eine Instanz betreibt, muss einen Sturm von Abweisungen als eine Episode nachlesen können, eine defekte Datei einmal im Log sehen und eine lange gehaltene Schreibsperre erkennen, ohne den Board-Ordner (Git) zu verschmutzen und ohne Inhalte ins Log zu schreiben.

### Domänenbezug

Kein Eintrag im Glossar betroffen. „Episode“, „Defektregister“, „Sperrhalter“ und „Haltezeit“ sind Begriffe aus ADR-0001 N1.4–N1.6 und haben im Glossar keinen Eintrag.

## Geschäftlicher Nutzen

Ein Sturm von 503-Antworten ist für den Betreiber heute nicht als ein Ereignis lesbar: 200 Abweisungen erzeugen 200 Zeilen, und der eine Messwert (wie viele Plätze belegt waren, wie viele Abweisungen es waren) geht unter. Eine defekte Datei steht heute nur in der Antwort der API, nie im Log; der Betreiber sieht weder, dass sie kaputt ging, noch, dass sie repariert wurde. Und eine Schreibsperre, die eine Sekunde oder länger gehalten wird, ist die Ursache für stockende Züge, die heute spurlos bleibt. Nach #272 gilt: eine Zeile je Episode, eine Warning je defekter Datei und Episode, eine Warning ab 1 s Haltezeit — jeweils mit den Feldern, die der Betrieb braucht, und ohne Inhalt.

## Funktionale Anforderungen

- FA 1: Für die beiden Kapazitätsgrenzen führt das Protokoll je Ursache (`lesegrenze`, `antwortbudget`) eine Episode. Die erste Abweisung einer Episode schreibt die volle ` WARN abgewiesen `-Zeile mit den Feldern aus N1.4 Regel 2 und zusätzlich `episode=beginn` sowie `belegt=<belegt>/<höchstens>` (Lesegrenze) bzw. `frei_kb=<kb>` (Antwortbudget); jede weitere Abweisung derselben Ursache wird nur gezählt und schreibt nichts. Die Episoden der beiden Ursachen sind unabhängig voneinander.
- FA 2: Die Episode endet, sobald seit ihrer letzten Abweisung **mindestens 10 s** vergangen sind (Ruhe ab der letzten Abweisung, nicht ab dem Beginn). Dann steht genau eine ` INFO Episode beendet `-Zeile mit `ursache=…`, `abweisungen=<n>`, `dauer_ms=<ms>` (von der ersten bis zur letzten Abweisung) und bei der Lesegrenze `belegt_max=<n>` (größte beobachtete Belegung der Episode); beim Antwortbudget gibt es kein `belegt_max`. Eine Abweisung nach dem Ende beginnt eine neue Episode mit neuen Zählern. Kommt eine Abweisung genau 10 s nach der letzten, endet zuerst die alte Episode (Ende-Zeile), dann beginnt die neue.
- FA 3: Geprüft wird die Ruhe bei **jeder** folgenden Anfrage (auch einer erfolgreichen) in der Middleware, vor dem Zurückgeben der Antwort, und beim geordneten Beenden der Instanz: `main` ruft nach `axum::serve(…).with_graceful_shutdown(…).await` das Beenden der Episoden auf; ein zweiter Aufruf und ein Aufruf ohne offene Episode schreiben nichts. (Hinweis des architekt: `App::ende` ist nur das Signal; ohne diesen Haken endet die letzte Episode nie.)
- FA 4: Die Episodenlogik ist eine reine Funktion mit übergebenem Zeitpunkt (`beobachten`, ADR-0001 N1.4 Regel 6) ohne Uhr; der Zustand gehört der Instanz (am `Protokoll` oder `App`, Wahl des Entwicklers), nie global.
- FA 5: `zeitgrenze` und jede 4xx/übrige 5xx-Abweisung bleiben bei genau einer Zeile je Anfrage ohne Feld `episode`.
- FA 6: Der Messwert der Lesegrenze (belegte Plätze, Abweisungen je Zeitraum) steht nur in diesen Zeilen; `Lesegrenze::belegt()` (heute `#[cfg(test)]`, `src/dienst/lesegrenze.rs:28`) und der Stand von `Antwortbudget::frei()` werden dafür lesbar, aber nicht über die API (PO Z. 704). Keine neue Route, kein neues Antwortfeld.
- FA 7: Das `Ordner` hält ein **Defektregister** je Instanz (nur im Speicher): die Pfade, die beim letzten vollständigen Lesen ihrer Art defekt waren. Ein Pfad, der defekt gelesen wird und nicht im Register steht, schreibt genau einmal ` WARN defekte Datei ` mit `pfad=<relativ>` (bei Aufgaben zusätzlich `aufgabe=#<n>` aus dem Dateinamen) und kommt ins Register; ein Pfad im Register schreibt nichts mehr. Ist er beim nächsten vollständigen Lesen seiner Art lesbar oder fehlt er, schreibt das Protokoll genau einmal ` INFO Datei repariert pfad=…` und nimmt ihn heraus; ein erneuter Defekt beginnt eine neue Episode mit neuer Warning. Ein Neustart beginnt mit leerem Register (eine Warning je defekter Datei und Start ist gewollt).
- FA 8: Nie Inhalt: weder Dateiinhalt noch Fehlertext des Parsers noch lesbare Schlüssel stehen in diesen Zeilen — nur relativer Pfad und Nummer. (`DefekteDatei.fehler` und `.schluessel` bleiben für die API wie heute.)
- FA 9: **Entscheidung (Hinweis 4 des architekt):** Der Begriff „vollständiger Leser“ bleibt auf `Ordner::einstellungen`, `Ordner::boards` und `Ordner::aufgaben` begrenzt. `Ordner::aufgabenpfad` und `Aufgabenverzeichnis::pfad_und_text` melden nicht ins Register. Gründe: (a) das Register hält den Stand „beim letzten vollständigen Lesen defekt“ und braucht die Menge aller Dateien einer Art, um „repariert oder fehlt“ zu erkennen (N1.5 Regel 3) — ein Einzelweg sieht eine Datei und könnte weder Reparatur noch Fehlen schließen; (b) der Einzelweg antwortet bereits mit 423, und die Middleware schreibt dafür je Anfrage eine ` WARN abgewiesen `-Zeile mit `ursache=defekt` — die Spur fehlt also nicht; (c) liest ein Einzelweg im Rückfall doch alles (`pfad_und_text` ruft dann `Ordner::aufgaben`), ist das ein vollständiges Lesen und meldet legitim. Die Meldung folgt dem vollständigen Lesen, nicht dem Endpunkt.
- FA 10: Ein `Sperrhalter` ersetzt den nackten `MutexGuard<'_, ()>` als Rückgabe von `Kanban::gesperrt()` (`src/dienst/mod.rs:284`, `#[track_caller]`). Er misst die Wartezeit vor dem Betreten und die Haltezeit bis zum Fallenlassen. Ist die Haltezeit ≥ `SPERRSCHWELLE` (Konstante, `Duration::from_secs(1)`; je Instanz nur in Tests überschreibbar), schreibt er beim Fallenlassen genau eine ` WARN Schreibsperre lange gehalten `-Zeile mit `halte_ms=`, `warte_ms=` und `ort=<datei>:<zeile>` der aufrufenden Stelle; darunter nichts.
- FA 11: Drei Signaturen nehmen heute `&MutexGuard<'_, ()>` und ändern sich auf den `Sperrhalter`: `aufgabe_anlegen.rs:118` (`aufgaben_anlegen_gesperrt`), `:128` (`anlegen_gesperrt`), `einstellungen.rs:199` (`einstellungen_entwerfen`); dazu die Aufrufstelle `aufgabe_anlegen.rs:100` (`&self.gesperrt()`). Alle Aufrufe `.gesperrt()` bleiben unverändert (heute 38 Zeilen: 36 `self.gesperrt()`, 2 `k.gesperrt()` in `src/dienst/mod.rs`-Tests; die „39“ der ADR ist veraltet).
- FA 12: Rumpf und Status jeder Antwort bleiben bytegleich; alle bestehenden Tests bleiben grün, bis auf den einen Fall in AK 9.

## Nicht-funktionale Anforderungen

- Sicherheit: keine neue Zeile enthält Rumpf, Beschreibung, Kommentar, Aufgaben-Titel, Commit-Text, Dateiinhalt, Parser-Meldung, Query-String oder Schlüssel; Werte laufen durch das bestehende Escaping und Kürzen (N1.3), kein Wert bricht die Zeile.
- Zeit: **Im Gate urteilt der Zustand, nicht die Wanduhr** (ADR-0026 N7 Regel 13). Die Grenzen 10 s Ruhe und 1 s Haltezeit werden im Gate über übergebene Zeitpunkte, `Duration::ZERO`, eine sehr große Schwelle und eine reine Vergleichsfunktion geprüft — nie mit `sleep`, nie mit einer Dauer-Zusicherung. Die echte Spanne läuft als `#[ignore]`-Lastprobe (Vorbild `tests/lastprobe_r00206.rs:23`), nur ausdrücklich, nur bei Last unter 2 (1-Minuten-Wert aus `/proc/loadavg`; bei Last ab 2 meldet sie „keine Messung: Last < 2 nötig“), mit Last und Messwert in der Ausgabe; nie nachts (21–8 Uhr). Keine Probe im Gate verlangt eine Rechnerlast ab 6 (die Grenze dieser Maschine).
- Keine neue Abhängigkeit; kein globaler Zustand (N1.7 Regel 1).

## Akzeptanzkriterien

Ebene je Kriterium: **U** Unit, **I** Integrationstest in-process gegen den Router mit Sammler-Senke (Treiber wie die bestehenden Tests), **P** Probe wörtlich aus dem Auftrag, **L** Lastprobe (`#[ignore]`). „Heute“ ist der Stand `0239cc4a`, am Code geprüft.

### Episoden der Kapazitätsgrenzen (Interaction I0258)

- [x] **AK 1 Probe P3, Beginn** (I, P): Gegeben alle `LESEN_HOECHSTENS` = 4 Plätze der Lesegrenze belegt (wie `src/dienst/commits_lesen.rs:359`, nicht `:348`) und eine kurze Frist der Testinstanz, wenn dreimal `GET /api/aufgaben/1/commits` kommt, dann dreimal `503`, und das Log hat genau 1 Zeile ` WARN abgewiesen ` mit `ursache=lesegrenze`, `episode=beginn`, `belegt=4/4`, `endpunkt=/api/aufgaben/{nr}/commits`, `aufgabe=#1`. **Heute rot**: 3 Zeilen, ohne `episode=`/`belegt=`.
- [x] **AK 2 Ende nach 10 s Ruhe, Rechenbeispiel** (U, P): Gegeben drei Abweisungen der Lesegrenze zu den Zeitpunkten t0, t0+1 s und t_letzte = t0+2 s mit größter Belegung 4, dann gilt mit übergebenen Zeitpunkten: bei t0+9 s keine Zeile (7 s Ruhe); bei t_letzte+10 s−1 ms keine; bei t_letzte+10 s genau 1 Zeile ` INFO Episode beendet ` mit `ursache=lesegrenze`, `abweisungen=3`, `belegt_max=4`, `dauer_ms=2000`; ein weiterer Aufruf bei t_letzte+11 s schreibt keine zweite. **Heute rot**: keine Funktion, kein Ende. Die Funktionsform (`beobachten` für die Abweisung, die Ruhe-Abfrage daneben) wählt der Entwickler; der Test nennt sie im Bericht.
- [x] **AK 3 Flut schreibt nichts** (I): Gegeben die Episode aus AK 1 offen, wenn 20 weitere Abweisungen der Lesegrenze kommen, dann bleibt `grep -c ' WARN abgewiesen '` bei 1, und das Ende (AK 2) meldet `abweisungen=23`. **Heute rot**: 23 Zeilen.
- [x] **AK 4 Variante Antwortbudget** (I, P): Gegeben ein kleines Antwortbudget (`Antwortbudget::mit`, wie `src/dienst/transkripte.rs:818`), wenn drei Anfragen daran abgewiesen werden, dann genau 1 ` WARN abgewiesen ` mit `ursache=antwortbudget`, `episode=beginn`, `frei_kb=<n>`; nach 10 s Ruhe genau 1 ` INFO Episode beendet ` mit `abweisungen=3`, `dauer_ms=` und **ohne** `belegt_max`. **Heute rot**: 3 Zeilen.
- [x] **AK 5 Ursachen getrennt** (U): Gegeben eine offene Episode `lesegrenze`, wenn eine Abweisung `antwortbudget` kommt, dann schreibt sie ihre eigene Zeile `episode=beginn`; das Ende der einen Episode schreibt nur ihre Ende-Zeile und lässt die andere offen. **Heute rot**.
- [x] **AK 6 Neue Episode** (U): Gegeben das Ende aus AK 2, wenn eine weitere Abweisung bei t_letzte+30 s kommt, dann `episode=beginn`, und ihr Ende meldet `abweisungen=1` (Zähler neu); kommt die Abweisung genau bei t_letzte+10 s, steht zuerst die Ende-Zeile der alten und danach die Beginn-Zeile der neuen Episode. **Heute rot**.
- [x] **AK 7 Ruhe wird bei jeder Anfrage geprüft** (I, gestellte Zeit statt Wanduhr): Gegeben eine offene Episode und die Zeit der Instanz auf t_letzte+9 s, wenn eine erfolgreiche Anfrage (200) kommt, dann keine Ende-Zeile; auf t_letzte+10 s gestellt genau 1 Ende-Zeile **vor** der Antwort (die Zeile steht nach dem `await` der Antwort im Sammler). Die Naht für die gestellte Zeit wählt der Entwickler. **Heute rot**.
- [x] **AK 8 Ende beim geordneten Beenden** (I; Tagprobe P): Gegeben eine offene Episode, wenn das Beenden der Episoden aufgerufen wird (derselbe Aufruf, den `main` nach `with_graceful_shutdown` macht), dann genau 1 ` INFO Episode beendet `; ein zweiter Aufruf und ein Aufruf ohne offene Episode 0. Tagprobe im Bau (nicht nachts): Release-Programm auf freiem Port, Lesegrenze füllen und abweisen, `SIGTERM` an die eigene PID → die letzte Zeile der Logdatei ist ` INFO Episode beendet `. **Heute rot**.
- [x] **AK 9 Zusage: `zeitgrenze` und 4xx je Anfrage** (I): Gegeben drei Anfragen, die an der Zeitgrenze enden, dann 3 Zeilen ` WARN abgewiesen ` mit `ursache=zeitgrenze` und ohne `episode=`; drei 409 ebenso 3 Zeilen. **Heute grün** (`ak3_drei_abweisungen_je_503_grund_ergeben_drei_zeilen`, `src/web/mod.rs:2277`, prüft die reine Funktion `abweisungszeile` für drei Ursachen). Der Fall `zeitgrenze` bleibt unverändert; die Fälle `lesegrenze` und `antwortbudget` behaupten „drei Zeilen“ und fallen mit AK 1/4 weg oder bleiben als Funktionstest, falls die Episodenlogik außerhalb von `abweisungszeile` sitzt — der Entwickler nennt die Änderung im Bericht.
- [x] **AK 10 Zusage: Messwert nur im Log, Antworten unverändert** (I): Rumpf und Status der 503 (`lesegrenze`, `antwortbudget`, `zeitgrenze`) sind bytegleich zu heute; die Menge der Routen der OpenAPI-Beschreibung ist unverändert; `GET /api/aufgaben/1/commits?x=GEHEIM-272` bei belegter Lesegrenze lässt `grep -c GEHEIM-272` im Log bei 0. **Heute grün.**
- [x] **AK 11 Mutanten** (U/I): (a) Episode endet nie → AK 2 rot; (b) jede Abweisung schreibt Zeile → AK 3 rot; (c) Ruhe ab dem Beginn statt ab der letzten Abweisung gemessen → AK 2 rot; (d) beide Ursachen teilen eine Episode → AK 5 rot; (e) Ruhe nur bei Abweisungen geprüft → AK 7 rot; (f) Beenden ohne Haken → AK 8 rot. Jeder Mutant macht genau ein Kriterium rot (Zurücklegen nur auf committetem Stand).
- [x] **AK 12 Lastprobe der Ruhe-Spanne** (L): Gegeben Last unter 2, wenn eine Episode mit echter Uhr 10 s ohne Abweisung bleibt und danach eine Anfrage kommt, dann steht die Ende-Zeile, und die gemessene Ruhe `d` liegt zwischen 10 s und 15 s (Obergrenze 50 % über dem Sollwert). Bei Last ab 2 meldet sie „keine Messung: Last < 2 nötig“; im Gate erscheint sie als `ignored`; nachts nicht fahren. **Heute rot**.

### Defektregister (Interaction I0259, Feature F0201)

- [ ] **AK 13 Probe P2, wörtlich** (I, P): `printf -- '---\nid: [\n---\nGEHEIM-DEFEKT\n' > <ordner>/aufgaben/3-kaputt.md`; `GET /api/aufgaben?wartet=ja` zweimal → `grep -c ' WARN defekte Datei .*#3' $LOG` = 1 und `grep -c GEHEIM-DEFEKT $LOG` = 0. Datei reparieren, `GET` → genau 1 Zeile ` INFO Datei repariert `; wieder kaputt machen, `GET` → `grep -c ' WARN defekte Datei .*#3'` = 2. **Heute rot**: 0 Zeilen (Ereignis nicht vorhanden).
- [ ] **AK 14 Nur Pfad und Nummer** (I): Für defekte Aufgabe, defekte Board-Datei (`boards/x.md`), defekte `kanbanD.md` (`Ordner::einstellungen` liefert dort `Err` statt `DefekteDatei` und zählt trotzdem als defekter Pfad) und eine Datei ohne gültiges UTF-8 steht je eine Warning mit `pfad=`; `aufgabe=#<n>` nur bei Aufgaben; weder Parser-Meldung noch Schlüssel noch Inhalt (`grep -c 'id: \['` = 0, `grep -c GEHEIM-DEFEKT` = 0). Für `kanbanD.md` bleibt zusätzlich jede 423-Antwort eine eigene ` WARN abgewiesen `-Zeile mit `ursache=defekt`. **Heute rot** (keine Zeile).
- [ ] **AK 15 Übergänge des Registers** (U): neuer Defekt → 1 Warning; derselbe Pfad erneut → 0; Pfad lesbar → 1 Info und aus dem Register; Pfad fehlt → 1 Info; danach erneut defekt → neue Warning; zwei defekte Pfade → je eine; ein Pfad der anderen Art (Boards statt Aufgaben) berührt das Register nicht. **Heute rot**.
- [ ] **AK 16 Einzelwege melden nicht** (I): Gegeben eine neu gestartete Instanz mit `aufgaben/3-kaputt.md` defekt, wenn `GET /api/aufgaben/3` kommt, dann `423`, 0 Zeilen ` WARN defekte Datei ` und 1 Zeile ` WARN abgewiesen ` mit `ursache=defekt`; **Positivkontrolle**: danach `GET /api/aufgaben` → genau 1 Zeile ` WARN defekte Datei `. Liest der Einzelweg in Wahrheit doch alles, meldet der Entwickler das (FA 9 c). **Heute**: Teil 1 grün, Positivkontrolle rot.
- [ ] **AK 17 Neustart** (I): Gegeben dieselbe defekte Datei und eine zweite Instanz auf demselben Ordner, wenn sie `GET /api/aufgaben` liest, dann hat sie in ihrem eigenen Sammler genau 1 Warning. **Heute rot**.
- [ ] **AK 18 Zusage: Antworten und Bestand** (I): Die Liste der defekten Dateien im Rumpf von `GET /api/aufgaben`, die 423 der Einzelwege und das „nur lesbar“ bleiben bytegleich; die defekte Datei bleibt im Bestand. **Heute grün.**
- [ ] **AK 19 Mutanten** (U/I): Warning bei jeder Lesung → AK 13 rot; nie repariert → AK 13 (Info, zweite Warning) rot; Parser-Meldung ins Log → AK 14 rot; Einzelweg meldet → AK 16 rot; Register global statt je Instanz → AK 17 rot.

### Sperrhalter (Interaction I0259, Feature F0202)

- [ ] **AK 20 Probe P4, wörtlich** (I, P): Instanz mit `sperrschwelle = Duration::ZERO`; `PATCH /api/aufgaben/1 {"titel":"x"}` → 200, genau 1 ` WARN Schreibsperre lange gehalten ` mit `halte_ms=`, `warte_ms=`, `ort=src/dienst/`; mit der Standard-Schwelle 0 Zeilen; `assert_eq!(SPERRSCHWELLE, Duration::from_secs(1))`. **Heute rot** (kein `Sperrhalter`; der Test kompiliert nicht).
- [ ] **AK 21 Der Aufrufort ist die aufrufende Stelle** (I): derselbe `PATCH` → `ort=src/dienst/aufgabe_aendern.rs:<zeile>` (die Stelle von `let _sperre = self.gesperrt();`, heute Zeile 16) — nicht `src/dienst/mod.rs`. Mutant „`#[track_caller]` entfernt“ → rot (P4 allein bliebe grün, weil beide mit `src/dienst/` beginnen). **Heute rot**.
- [ ] **AK 22 Schwelle als Spanne und Vergleich ohne Wanduhr** (U): die reine Vergleichsfunktion `lange_gehalten(halte, schwelle)`: (999 ms, 1 s) → nein, (1000 ms, 1 s) → ja, (0, ZERO) → ja; und mit `sperrschwelle` = 1 h schreibt der `PATCH` aus AK 20 keine Zeile. Mutanten: Schwelle ignoriert (immer schreiben), nie schreiben, Schwelle fest 1 s statt der Naht → je rot. **Heute rot**.
- [ ] **AK 23 `warte_ms` nur Zahl** (I): `warte_ms=` und `halte_ms=` tragen ganze Zahlen (`^[0-9]+$`); kein Test beurteilt ihre Größe im Gate. **Heute rot**.
- [ ] **AK 24 Zusage: 38 Aufrufstellen, drei Signaturen** (U): `grep -rn '[a-z]\.gesperrt()' src | wc -l` = 38 vor und nach der Änderung (die Zeile von `:100` bleibt eine Stelle); die drei Signaturen und `:100` sind auf den `Sperrhalter` umgestellt; `tests/fitness_r00257_momentaufnahme.rs` (sucht wörtlich `let _sperre = self.gesperrt();`) und die beiden Tests in `src/dienst/mod.rs:385/476`, die die Sperre halten, bleiben grün. **Heute grün** (38).
- [ ] **AK 25 Zusage: Antworten** (I): Rumpf und Status von `PATCH /api/aufgaben/{nr}` und der Anlegen-Wege (200/201) sind bytegleich; das volle Gate bleibt grün.
- [ ] **AK 26 Lastprobe der Haltezeit** (L): Gegeben Last unter 2 und die Standard-Schwelle, wenn die Sperre 1,3 s gehalten wird, dann genau 1 Warning mit `halte_ms` zwischen 1000 und 2000; bei 0,3 s Haltezeit 0 Zeilen. Bei Last ab 2 „keine Messung: Last < 2 nötig“; im Gate `ignored`; nachts nicht. **Heute rot**.

## Betroffene Verzeichnisstruktur

- `src/protokoll.rs` — `Ereignis`-Varianten `EpisodeBeendet`, `DefekteDatei`, `DateiRepariert`, `SchreibsperreLangeGehalten` (Texte aus N1.3); beide Interaktionen ergänzen dieselbe Aufzählung, ein Rebase-Konflikt ist mechanisch.
- `src/dienst/` — Episodenzustand und `beobachten` (neues Modul); `lesegrenze.rs` (`belegt()` ohne `cfg(test)`), `antwortbudget.rs`; `mod.rs` (`Sperrhalter`, `SPERRSCHWELLE`, `gesperrt`); `aufgabe_anlegen.rs`, `einstellungen.rs` (Signaturen).
- `src/web/mod.rs` — Middleware `abweisung_protokollieren` (Episoden, Ruhe bei jeder Anfrage); `src/main.rs` — Haken nach `with_graceful_shutdown`.
- `src/ablage.rs` — Defektregister im `Ordner` (`Clone` und `Debug` bleiben, das Register hängt hinter `Arc<Mutex<…>>`); Abgleich in `einstellungen`, `boards`, `aufgaben`.
- `tests/akzeptanz_r00269.rs` (I, P), Unit-Tests an den Modulen, Lastproben `#[ignore]` (Vorbild `tests/lastprobe_r00206.rs`).

## Technische Überlegungen

- Die ADR legt fest (N1.4 Regel 5/6, N1.5, N1.6); der architekt hat sie am heutigen `main` bestätigt (Lauf 272-architekt-1), keine neue Technikfrage.
- `Ordner` kennt kein `Protokoll` (`Ordner::neu(wurzel)`, `src/dienst/mod.rs:164`); wie das Register schreibt (Protokoll im `Ordner` oder Rückgabe der Übergänge an `Kanban`), entscheidet der Entwickler; N1.7 Regel 1 verlangt nur „je Instanz, nie global“.
- Testnaht P3: Die vier Plätze belegen der Test in `commits_lesen.rs:359` über `s.k.lesegrenze.betreten(…)` am `Kanban`; für den HTTP-Weg braucht der Router ein vorbereitetes `Kanban` oder einen gleichwertigen Weg. Beide sind zulässig; der Entwickler nennt die gewählte Naht im Bericht.
- Jede Probe auf Abwesenheit (0 Zeilen) hat eine Positivkontrolle im selben Test (AK 16, AK 22).

## Tests

- `tests/akzeptanz_r00269.rs` für die Integrationsfälle, Unit-Tests für `beobachten`, Register und Vergleichsfunktion mit festen Zeitpunkten; Sammler-Senke, kein `sleep`; jeder Test war einmal rot (Vorher-Stand oder Mutant).
- Mutanten laufen auf dem committeten Stand (AK 11, AK 19, AK 21, AK 22).
- Bestehende Tests bleiben grün, außer dem einen Fall in AK 9.

## Abhängigkeiten

- R00258 (Scheibe 1, #239) ist gebaut: Middleware, `abweisungszeile`, Sammler-Senke, `Fehler::ursache()`.
- Die Interaction I0259 ist von I0258 unabhängig (andere Dateien außer `protokoll.rs`).
- Maßstab: ADR-0001 Nachtrag N1 (N1.4 Regel 5/6, N1.5, N1.6, N1.7); ADR-0026 N7 Regel 13 für die Zeitgrenzen.

## Offene Fragen

keine — die beiden Fragen des ersten Entwurfs (Ende-Zeile des Antwortbudgets, Testnaht) sind entschieden (FA 2: ohne `belegt_max`; Technische Überlegungen: Naht nach Wahl des Entwicklers).

## Manuelle Vorbereitungstätigkeiten

- keine

## Manuelle Nachbereitungstätigkeiten

- Director: nach #272 die Log-Zeilen in `AI-Team/factory.md` „Umgebung“ und im Observability-Review nachziehen (Episode, Defektregister, Sperrhalter); Verweis auf #272 in R00258 „Notizen“ als gebaut markieren.

## Warum löst diese Anforderung das Problem? (Pflicht)

Ohne #272 bleibt jeder Sturm von Kapazitätsabweisungen eine unlesbare Folge von Zeilen, eine defekte Datei bleibt im Log unsichtbar, und eine lange gehaltene Schreibsperre ist unsichtbar. Mit #272 schreibt die Middleware je Episode eine Beginn- und eine Ende-Zeile mit dem Messwert, das `Ordner` führt ein Defektregister und meldet jeden Defekt einmal (und die Reparatur einmal), und der `Sperrhalter` warnt ab 1 s Haltezeit mit Ort. Die Antworten ändern sich nicht; der Betreiber liest den Zustand, nicht den Inhalt.

## Missing-Docs

- Glossar: „Episode“, „Defektregister“, „Sperrhalter“ und „Haltezeit“ haben keinen Eintrag; sie sind Begriffe aus ADR-0001 N1 und gelten im Log. Kein Domänenwissen betroffen.
- Die ADR nennt in N1.3 neun Ereignisse, der Code kennt elf (Härtung des architekt, kein Hindernis); die vier neuen Ereignisse dieser Anforderung stehen schon in N1.3.

## Notizen

- Umfang: 11 Bubbles gezählt (B1467–B1477) in zwei Interactions, alle bis Bubble geplant; Richtwert 11–20 h (Summe der Spannen je Bubble, Hypothese des planers, nicht gemessen). Schnitt: I0258 (Episoden, N1.4 Regel 5/6, 5 Bubbles) und I0259 (Defektregister N1.5 und Sperrhalter N1.6, je ein unabhängiges Feature, 3 + 3 Bubbles) — die drei Themen berühren verschiedene Dateien und sind je von außen prüfbar; die zwei Scheiben ergeben sich daraus, dass 11 Bubbles für eine Karte zu groß sind.
- Hinweise des architekt: (1) P3-Verweis `commits_lesen.rs:359` (in AK 1); (2) drei Signaturen plus `aufgabe_anlegen.rs:100` als eigene Bubble (B1476); (3) Episode endet beim geordneten Beenden (AK 8, B1470); (4) Entscheidung zu `aufgabenpfad`/`pfad_und_text` in FA 9 begründet.
- Nicht Teil: neue API für den Messwert (PO Z. 704), Rotation und Aufbewahrung (Scheibe 1), unbekannte Pfade ohne Zeile (N1.8 Regel 3), Nachtrag der elf Ereignisse in der ADR.
- Für `abschliessen`: R00258 AK 3 (drei Zeilen je 503-Grund) gilt für `lesegrenze` und `antwortbudget` nur bis zu dieser Anforderung; die Verweiszeile setzt der Director beim Abschluss.
