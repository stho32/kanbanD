---
id: R00154
status: Neu
datum: 2026-11-15
ursprung: Bug-Report
ursprungslauf: R00102
---

# R00154: Behebung — Typfehler in Pfad- und Abfrageparametern ergeben Klartext statt 400 mit `{"fehler": …}`

## Beschreibung

Ein falscher Pfad- oder Abfrageparameter wird vom Rahmen (axum) abgewiesen, bevor ein Handler ihn sieht — mit dem richtigen Status **400**, aber als englischer Klartext (`text/plain`), der bei Typfehlern den gesendeten Wert wiederholt. ADR-0003 verlangt für jede Abweisung `Content-Type: application/json` und den Rumpf `{"fehler": "…"}`; die API-Beschreibung nennt 400 als `Fehlerantwort` (`src/web/openapi.rs:33`), und die Oberfläche liest `json.fehler` (`web/app.js:100`).

Reproduzierbar (gemessen am Programm vom Stand `8df2028`, 2026-11-15): `GET /api/aufgaben/abc` → 400, `text/plain; charset=utf-8`, ``Invalid URL: Cannot parse `abc` to a `u32` ``. Erwartet: 400, `Content-Type: application/json`, `{"fehler": "…"}` auf Deutsch mit dem Parameternamen `nr`, ohne Text des Rahmens und ohne `abc`.

Herkunft: Karte #168 (ADR-0003 Nachtrag N1 Punkt 3; Entscheidung des product-owner 2026-11-15: eigene Karte unmittelbar nach #39, `AI-Team/po-entscheidungen.md`). Folgekarte zu #39 (R00153, Rumpf); baut auf deren Stand auf.

Zahlt ein auf: [Vision](R00000-vision.md) — Agenten-Schnittstelle: ein Agent reagiert auf eine Abweisung, ohne Text des Rahmens zu deuten.

## Ursachenanalyse

### Root Cause

- 59 Handler in `src/web/mod.rs` nehmen ihre Parameter als `Path<T>` und `Query<T>` von axum 0.8.9 (60 Verwendungen; der Handler `board` trägt beide). Die Abweisung des Extraktors (`PathRejection`, `QueryRejection`) entsteht vor dem Handler und geht nicht durch `impl IntoResponse for Fehler`.
- Beobachtete Antworten heute (Probe des architekt, ADR-0003 N4), alle 400 und `text/plain; charset=utf-8`:

| Anfrage | Rumpf heute |
|---|---|
| `GET /api/aufgaben/abc` (ebenso `-1`, `99999999999`) | ``Invalid URL: Cannot parse `abc` to a `u32` `` |
| `DELETE /api/aufgaben/1/teilaufgaben/abc` | ``Invalid URL: Cannot parse value at index 1 with value `abc` to a `u64` `` |
| `DELETE /api/aufgaben/abc/teilaufgaben/abc` | ``Invalid URL: Cannot parse value at index 0 with value `abc` to a `u32` `` |
| `GET /api/aufgaben/%FF` | ``Invalid URL: Invalid UTF-8 in `nr` `` |
| `GET /api/boards/%FF` | ``Invalid URL: Invalid UTF-8 in `slug` `` |
| `DELETE /api/aufgaben/1/teilaufgaben/%FF` | ``Invalid URL: Invalid UTF-8 in `i` `` |
| `GET /api/berichte/verlauf` | ``Failed to deserialize query string: missing field `board` `` |
| `GET /api/berichte/verlauf?board=a&board=b` | ``Failed to deserialize query string: duplicate field `board` `` |
| `GET /api/boards/gibtsnicht?archivierte=ja&archivierte=ja` | ``Failed to deserialize query string: duplicate field `archivierte` `` |
| `PATCH /api/aufgaben/abc` mit `{"titel": 5}` | ``Invalid URL: Cannot parse `abc` to a `u32` `` (der Pfad antwortet, nicht der Rumpf) |

- Bei einem Typfehler trägt die Abweisung des Rahmens den Parameternamen nicht (nur den Index oder nichts), nur bei ungültigem UTF-8.

Ausgeschlossen: der Rumpf (R00153, Karte #39); die Fachprüfungen — `GET /api/aufgaben/999` → 404 `{"fehler":"Aufgabe #999 gibt es nicht"}` und `GET /api/aufgaben?unsinn=1` → 400 `{"fehler":"Unbekannter Filter „unsinn“ — …"}` kommen schon in der Form; 404 (unbekannte Route) und 405 (falsche Methode) des Routers — sie entstehen in keinem Extraktor (siehe „Abgrenzung“).

### Betroffene Komponenten

- `src/web/mod.rs` (60 Verwendungen in 59 Handlern; Tabellen unter AK 2 und AK 6), das Modul des Extraktors `JsonKoerper<T>` aus R00153 (dort entstehen Abweisungstyp und Rumpf-Funktion).
- Neuer Integrationstest über alle Routen mit Pfad- oder Abfrageparameter.
- Unverändert: `src/web/statisch.rs:62` (`Path<String>` der Route `/web/{*name}` — keine API-Route), `src/fehler.rs`.

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0003 Nachtrag N4 (Akzeptiert): **zwei eigene Extraktoren `Pfad<T>` und `Abfrage<T>`** im Modul von `JsonKoerper<T>`, mit demselben Abweisungstyp der Web-Schicht; alle 60 Verwendungen wechseln.

- Jede Abweisung → **400**, `application/json`, `{"fehler": "…"}`, deutsch. `Fehler` bekommt keine Variante, kein Statuscode ändert sich.
- `Pfad<T>` nennt den Parameternamen aus der Routenschablone (`RawPathParams`, am gemeldeten Index; bei einem einzelnen Wert den einzigen). `Abfrage<T>` nennt das Feld auf dem Weg, auf dem `JsonKoerper<T>` ein fehlendes Pflichtfeld benennt.
- Reihenfolge wie heute: Pfad vor Abfrage vor Rumpf; es wird nicht gesammelt.

### Alternative Ansätze

Verworfen in ADR-0003 N4: ein Layer über dem Router, der Klartext umschreibt (kennt weder Parameter noch Feld, zweiter Antwortweg); `WithRejection<Path<T>, …>` je Route (60 Stellen, Name fehlt bei Typfehlern); 404 für eine nicht-numerische Nummer (ändert einen richtigen Status, macht Formfehler und fehlende Aufgabe ununterscheidbar).

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Integrationstest im echten Programm (`tests/`, Helfer `tests/gemeinsam`): die Tabellen unter AK 2 und AK 6, je Stelle eine Anfrage. **Rot ohne Fix** (`text/plain`).

### Code-Extraktion für isoliertes Testing

Die Extraktoren sind für sich testbar (Unit): Name aus der Schablone bei einem und bei zwei Parametern, Typfehler und ungültiges UTF-8, fehlendes und doppeltes Abfragefeld, Meldung ohne Rahmen-Text und ohne den gesendeten Wert.

### Regressionstests

- Keine bestehende Erwartung ändert sich: in `tests/`, `src/` und `e2e/tests/` schreibt kein Test einen Text des Rahmens fest (gesucht 2026-11-15: `Invalid URL`, `Failed to deserialize query`, `missing field`, `duplicate field` — kein Treffer).
- Abgleich der Tabelle gegen `src/web/endpunkte.rs` (AK 3), damit eine neue Route mit Pfadparameter nicht ungeprüft bleibt.
- Festhalte-Proben für das, was ausdrücklich nicht Teil ist (AK 13–AK 15).

## Akzeptanzkriterien

**Grundbestand** (herstellbar mit `tests/gemeinsam`: `mit_drei_aufgaben`, Start mit `--port 0`): eingerichteter Ordner, Person „st“, Board „entwicklung“ mit der Spalte „Zu erledigen“, Aufgaben #1–#3. Jede Anfrage trägt `X-KanbanD-Wer: st`; ein Rumpf wird nicht gesendet, wo keiner genannt ist.

**Form einer Abweisung** (gilt für jedes Kriterium, das „in der Form“ sagt): Status **400**; `Content-Type: application/json`; der Rumpf ist ein JSON-Objekt mit dem Feld `fehler` (nicht leere Zeichenkette). **Kein Commit** = `git rev-parse HEAD` und `git status --porcelain` des Board-Ordners sind vor und nach der Anfrage gleich; verlangt an jeder Zeile mit Methode ≠ GET (der Test darf es über die ganze Tabelle auf einmal messen).

**Meldung:** deutsch; **nennt den Parameter** = der Name steht als eigenes Wort in `fehler` (Groß- und Kleinschreibung beachtet, davor und danach kein Buchstabe, keine Ziffer, kein `_`), und bei einer Route mit zwei Parametern steht der Name des anderen nicht als eigenes Wort darin; enthält keinen Text des Rahmens (`Invalid URL`, `Cannot parse`, `at index`, `Invalid UTF-8`, `Failed to`, `missing field`, `duplicate field`, `u32`, `u64`); wiederholt den gesendeten Wert nicht. Empfohlene Hausform wie in R00153: `<Parametername>: <was erwartet wird>` (der Wortlaut ist Sache des Entwicklers, ADR-0003 N4 „Grenze“).

Beispiele gegen die Regel geprüft: `nr: erwartet wird eine ganze Zahl ab 0` nennt `nr`, nicht `i`; `i: erwartet wird eine ganze Zahl ab 0` nennt `i`, nicht `nr`; `slug: kein gültiges UTF-8` nennt `slug`; `board: fehlt` und `board: mehrfach angegeben` nennen `board`. Eine Meldung, die an der Route `…/teilaufgaben/{i}` immer `nr` nennt, fällt durch — „enthält `i`“ allein wäre keine Probe (jeder deutsche Satz enthält ein i).

### Bug behoben (Pflicht)

- [ ] **AK 1 Abnahme-Probe der Karte (wörtlich):** `GET /api/aufgaben/abc` (bzw. eine Route mit `Path<u32>`) → 400, `Content-Type: application/json`, Rumpf `{"fehler": "…"}`, `fehler` nennt `nr`, kein Text des Rahmens, kein Commit. `GET /api/berichte/verlauf` **ohne** `?board=` (Pflichtfeld der `Query<BoardWahl>`) → 400 in der Form, `fehler` nennt `board`. — Heute je 400 `text/plain` (Tabelle in „Root Cause“). Erfüllt, wenn AK 2, AK 4 und AK 6 erfüllt sind.
- [ ] **AK 2 Jede der 55 Routen mit Pfadparameter, jede der 68 Parameterstellen:** Gegeben der Grundbestand, wenn an einer Zeile der Tabelle **ein** Parameter durch den Abschnitt `%FF` ersetzt wird und die übrigen ihren Grundwert tragen (`nr` → `1`, `i` → `0`, `slug` → `entwicklung`, `kuerzel` → `st`, `id` → `I0001`, `name` → `x.txt`, `signal` → `x`, `kennung` → `x`), dann antwortet der Server mit 400 in der Form, und `fehler` nennt den ersetzten Parameter. Das trifft auch die Text-Parameter, die sonst nicht abzuweisen sind. Rechnung: 42 Routen mit einem Parameter + 13 mit zweien = 42 + 26 = **68 Anfragen**. Heute: 68-mal `text/plain`. Beispiele: `GET /api/boards/%FF` → `fehler` nennt `slug`; `DELETE /api/aufgaben/1/teilaufgaben/%FF` → `i`; `DELETE /api/aufgaben/%FF/teilaufgaben/0` → `nr`.

| Nr | Methode und Pfad (Schablone) | Handler (`src/web/mod.rs`) | Parameter in der Reihenfolge der Schablone |
|---|---|---|---|
| 1 | GET /api/aufgaben/{nr} | `aufgabe_lesen` | `nr` (Zahl) |
| 2 | PATCH /api/aufgaben/{nr} | `aufgabe_aendern` | `nr` (Zahl) |
| 3 | DELETE /api/aufgaben/{nr} | `aufgabe_loeschen` | `nr` (Zahl) |
| 4 | GET /api/aufgaben/{nr}/anhaenge | `anhaenge` | `nr` (Zahl) |
| 5 | POST /api/aufgaben/{nr}/anhaenge | `anhang_ablegen` | `nr` (Zahl) |
| 6 | GET /api/aufgaben/{nr}/anhaenge/{name} | `anhang_lesen` | `nr` (Zahl), `name` (Text) |
| 7 | DELETE /api/aufgaben/{nr}/anhaenge/{name} | `anhang_entfernen` | `nr` (Zahl), `name` (Text) |
| 8 | POST /api/aufgaben/{nr}/archivieren | `archivieren` | `nr` (Zahl) |
| 9 | POST /api/aufgaben/{nr}/duplizieren | `aufgabe_duplizieren` | `nr` (Zahl) |
| 10 | POST /api/aufgaben/{nr}/durchlaeufe | `durchlauf_eintragen` | `nr` (Zahl) |
| 11 | POST /api/aufgaben/{nr}/kommentare | `kommentieren` | `nr` (Zahl) |
| 12 | POST /api/aufgaben/{nr}/reservierung | `reservieren` | `nr` (Zahl) |
| 13 | DELETE /api/aufgaben/{nr}/reservierung | `freigeben` | `nr` (Zahl) |
| 14 | PUT /api/aufgaben/{nr}/signale/{signal} | `signal_setzen` | `nr` (Zahl), `signal` (Text) |
| 15 | DELETE /api/aufgaben/{nr}/signale/{signal} | `signal_zuruecknehmen` | `nr` (Zahl), `signal` (Text) |
| 16 | POST /api/aufgaben/{nr}/teilaufgaben | `teilaufgabe_anlegen` | `nr` (Zahl) |
| 17 | POST /api/aufgaben/{nr}/teilaufgaben/mehrere | `teilaufgaben_anlegen` | `nr` (Zahl) |
| 18 | PATCH /api/aufgaben/{nr}/teilaufgaben/{i} | `teilaufgabe_aendern` | `nr` (Zahl), `i` (Zahl) |
| 19 | DELETE /api/aufgaben/{nr}/teilaufgaben/{i} | `teilaufgabe_entfernen` | `nr` (Zahl), `i` (Zahl) |
| 20 | POST /api/aufgaben/{nr}/timer/start | `timer_starten` | `nr` (Zahl) |
| 21 | POST /api/aufgaben/{nr}/timer/stop | `timer_stoppen` | `nr` (Zahl) |
| 22 | GET /api/aufgaben/{nr}/verlauf | `aufgabe_verlauf` | `nr` (Zahl) |
| 23 | GET /api/aufgaben/{nr}/wbs-effects | `wirkungen_stand` | `nr` (Zahl) |
| 24 | PATCH /api/aufgaben/{nr}/wbs-effects | `wirkung_setzen` | `nr` (Zahl) |
| 25 | DELETE /api/aufgaben/{nr}/wbs-effects/{i} | `wirkung_entfernen` | `nr` (Zahl), `i` (Zahl) |
| 26 | POST /api/aufgaben/{nr}/wbs-effects/{i}/eintritt | `wirkung_eintritt` | `nr` (Zahl), `i` (Zahl) |
| 27 | POST /api/aufgaben/{nr}/zeiten | `zeit_nachtragen` | `nr` (Zahl) |
| 28 | PATCH /api/aufgaben/{nr}/zeiten/{kennung} | `zeit_korrigieren` | `nr` (Zahl), `kennung` (Text) |
| 29 | DELETE /api/aufgaben/{nr}/zeiten/{kennung} | `zeit_loeschen` | `nr` (Zahl), `kennung` (Text) |
| 30 | POST /api/aufgaben/{nr}/zurueckholen | `zurueckholen` | `nr` (Zahl) |
| 31 | GET /api/boards/{slug} | `board` | `slug` (Text) |
| 32 | PATCH /api/boards/{slug} | `board_aendern` | `slug` (Text) |
| 33 | DELETE /api/boards/{slug} | `board_loeschen` | `slug` (Text) |
| 34 | PUT /api/boards/{slug}/anwendungen | `bindung_setzen` | `slug` (Text) |
| 35 | POST /api/boards/{slug}/aufgaben | `auf_board_legen` | `slug` (Text) |
| 36 | POST /api/boards/{slug}/aufgaben/mehrere | `mehrere_auf_board_legen` | `slug` (Text) |
| 37 | DELETE /api/boards/{slug}/aufgaben/{nr} | `von_board_nehmen` | `slug` (Text), `nr` (Zahl) |
| 38 | PUT /api/boards/{slug}/berichtsfilter | `berichtsfilter_setzen` | `slug` (Text) |
| 39 | PUT /api/boards/{slug}/bestand | `bestand_setzen` | `slug` (Text) |
| 40 | POST /api/boards/{slug}/bewegen | `bewegen` | `slug` (Text) |
| 41 | POST /api/boards/{slug}/bewegen-mehrere | `mehrere_bewegen` | `slug` (Text) |
| 42 | PUT /api/boards/{slug}/fieber | `fieber_setzen` | `slug` (Text) |
| 43 | GET /api/boards/{slug}/fieber/cache | `fieber_cache` | `slug` (Text) |
| 44 | POST /api/boards/{slug}/fieber/cache | `fieber_ergaenzen` | `slug` (Text) |
| 45 | DELETE /api/boards/{slug}/fieber/cache | `fieber_verwerfen` | `slug` (Text) |
| 46 | PUT /api/boards/{slug}/spalten | `spalten_setzen` | `slug` (Text) |
| 47 | PUT /api/boards/{slug}/start | `start_setzen` | `slug` (Text) |
| 48 | PUT /api/boards/{slug}/termine | `termine_setzen` | `slug` (Text) |
| 49 | POST /api/boards/{slug}/ziehen | `ziehen` | `slug` (Text) |
| 50 | PATCH /api/personen/{kuerzel} | `person_aendern` | `kuerzel` (Text) |
| 51 | DELETE /api/personen/{kuerzel} | `person_stilllegen` | `kuerzel` (Text) |
| 52 | GET /api/wbs/{kuerzel} | `wbs` | `kuerzel` (Text) |
| 53 | POST /api/wbs/{kuerzel}/knoten | `wbs_knoten_anlegen` | `kuerzel` (Text) |
| 54 | PATCH /api/wbs/{kuerzel}/knoten/{id} | `wbs_status` | `kuerzel` (Text), `id` (Text) |
| 55 | POST /api/wbs/{kuerzel}/knoten/{id}/verwerfen | `wbs_verwerfen` | `kuerzel` (Text), `id` (Text) |

- [ ] **AK 3 Die Tabelle ist vollständig:** Der Test gleicht ab: die Einträge in `src/web/endpunkte.rs`, deren Pfad vor einem `?` eine `{…}`-Stelle trägt (gezählt: 55), sind genau die 55 Zeilen aus AK 2, mit denselben Parameternamen. Kommt eine Route mit Pfadparameter hinzu, die in der Tabelle fehlt, ist der Test rot. (Von den 80 Einträgen tragen 57 ein `{`; zwei davon nur in der Abfrage: `/api/berichte/verlauf?board={slug}` und `/api/berichte/bewegungen?board={slug}` — sie stehen in AK 6.)
- [ ] **AK 4 Typfehler an jedem der 35 Zahlenparameter:** wenn an einer Zeile der Tabelle ein mit „Zahl“ bezeichneter Parameter `abc` trägt (die übrigen ihren Grundwert), dann 400 in der Form, `fehler` nennt diesen Parameter und enthält `abc` nicht. Rechnung: 20 Routen mit `nr` allein + 6 mit `nr` vor einem Text + 4 × 2 (`nr` und `i`) + 1 (`nr` hinter `slug`) = **35 Anfragen**. Beispiele: `GET /api/aufgaben/abc` → `nr`; `DELETE /api/aufgaben/1/teilaufgaben/abc` → `i` (heute nennt der Rahmen nur „index 1“); `DELETE /api/boards/entwicklung/aufgaben/abc` → `nr`.
- [ ] **AK 5 Grenzen der Zahl und zwei Typfehler zugleich:** `GET /api/aufgaben/-1` und `GET /api/aufgaben/99999999999` → je 400 in der Form, `fehler` nennt `nr` (heute Klartext; `99999999999` liegt über 4294967295, der größten Nummer). `DELETE /api/aufgaben/abc/teilaufgaben/abc` → 400 in der Form, `fehler` nennt `nr` (den ersten falschen), nicht `i`.
- [ ] **AK 6 Abfrageparameter:** Gegeben der Grundbestand, wenn die Anfrage einer Zeile gesendet wird, dann 400 in der Form, und `fehler` nennt das Feld der Zeile. Heute: 6-mal `text/plain`.

| Nr | Anfrage | Handler | Fall | Feld in `fehler` |
|---|---|---|---|---|
| 1 | GET /api/berichte/verlauf | `verlauf` | Pflichtfeld fehlt | `board` |
| 2 | GET /api/berichte/verlauf?board=a&board=b | `verlauf` | Feld doppelt | `board` |
| 3 | GET /api/berichte/bewegungen | `bewegungen` | Pflichtfeld fehlt | `board` |
| 4 | GET /api/berichte/bewegungen?board=a&board=b | `bewegungen` | Feld doppelt | `board` |
| 5 | GET /api/boards?archivierte=ja&archivierte=ja | `boards` | Feld doppelt | `archivierte` |
| 6 | GET /api/boards/entwicklung?archivierte=ja&archivierte=ja | `board` | Feld doppelt | `archivierte` |

- [ ] **AK 7 Meldung ohne Rahmen-Text und ohne den gesendeten Wert:** `GET /api/aufgaben/Zx9-Inhalt` → `fehler` enthält weder `Zx9-Inhalt` noch eines der Wörter aus „Meldung“ oben; `GET /api/berichte/verlauf?board=zx9a&board=zx9b` → `fehler` enthält weder `zx9a` noch `zx9b`. Die Wörter des Rahmens fehlen in allen 68 + 35 + 6 Antworten aus AK 2, AK 4 und AK 6.
- [ ] **AK 8 Pfad vor Rumpf:** `PATCH /api/aufgaben/abc` mit `Content-Type: application/json` und `{"titel": 5}` → 400 in der Form, `fehler` nennt `nr` und nicht `titel`; ebenso mit dem Rumpf `x` und `Content-Type: application/x-www-form-urlencoded` (400 mit `nr`, nicht 415). Aufgabe #1 ist unverändert.
- [ ] **AK 9 Rot ohne Fix:** Die Tests zu AK 2, AK 4 und AK 6 sind am Stand vor dem Fix (nach #39) für alle Zeilen rot (`text/plain`) und mit Fix grün; der Commit nennt das Ergebnis. **Probe zuerst:** weicht eine Antwort vor dem Fix von 400 Klartext ab, ist das ein Befund an den architekt, kein stilles Anpassen.

### Unverändert (Gegenproben)

- [ ] **AK 10 Gültige Parameter:** Die bestehende Suite (`cargo test`) ist **ohne geänderte Erwartung** grün. Dazu ein Festhalte-Test je Extraktor-Art (Status und Rumpf vor dem Fix messen und festschreiben, bei der Planung nicht gefahren): `GET /api/aufgaben/1` (eine Zahl), `GET /api/boards/entwicklung?archivierte=ja` (Text und Abfrage), `GET /api/berichte/verlauf?board=entwicklung` (Pflichtfeld der Abfrage) — je Erfolg und kein Commit; `PATCH /api/aufgaben/1/teilaufgaben/0` mit `{"erledigt": true}` nach `POST /api/aufgaben/1/teilaufgaben` mit `{"text": "x"}` (zwei Zahlen, schreibend) — Erfolg und genau ein Commit je Anfrage, wie vor dem Fix.
- [ ] **AK 11 Fachantworten bleiben:** `GET /api/aufgaben/999` → 404 `{"fehler":"Aufgabe #999 gibt es nicht"}`; `GET /api/berichte/verlauf?board=gibtsnicht` → 404 `{"fehler":"Board „gibtsnicht“ gibt es nicht"}`; `GET /api/aufgaben?unsinn=1` → 400 `{"fehler":"Unbekannter Filter „unsinn“ — board, spalte, klasse, signal, zustaendig, reserviert, label, key, archivierte"}` — je wörtlich wie heute.
- [ ] **AK 12 `%FF` im Abfragewert wird weiter nicht vom Rahmen abgewiesen:** `GET /api/aufgaben?board=%FF` und `GET /api/berichte/verlauf?board=%FF` → 400 mit der Fachmeldung `Board-Name „…“ ungültig: 1–40 Zeichen aus a–z, 0–9, -`; `GET /api/boards/x?archivierte=%FF` → 404 `{"fehler":"Board „x“ gibt es nicht"}` — Status und Rumpf wie vor dem Fix (Festhalte-Test: vorher messen, festschreiben).
- [ ] **AK 13 404 und 405 des Routers unverändert (Festhalte-Probe, ADR-0003 N4 Punkt 6):** `GET /api/gibtsnicht` → 404, kein `Content-Type`, leerer Rumpf; `PUT /api/aufgaben/1` → 405, leerer Rumpf; `DELETE /api/zustand` → 405 mit `allow: GET,HEAD`.
- [ ] **AK 14 Statische Dateien unverändert:** `GET /web/gibtsnicht.js` → 404, `text/plain`, `nicht gefunden`; `src/web/statisch.rs` ist unverändert (`git diff --stat` nennt die Datei nicht).
- [ ] **AK 15 Beschriebener Kontrakt:** `GET /api/openapi.json` und `GET /api/endpunkte` liefern denselben Inhalt wie vor dem Fix (vor dem Fix speichern, danach vergleichen; der Commit nennt das Ergebnis). Die Pfad- und Abfrageparameter stehen weiter an jeder Route der Beschreibung.

### Bauart (ADR-0003 N4)

- [ ] **AK 16 Eine Stelle:** Kein Handler in `src/web/mod.rs` nimmt `Path<T>` oder `Query<T>` des Rahmens: `grep -c "Path<\|Query<" src/web/mod.rs` ergibt 0 (heute 59 Zeilen mit 60 Verwendungen); `src/fehler.rs` ist unverändert. Das hält auch `GET /api/aufgaben` (`aufgaben`, freie Paare), den keine Anfrage zur Abweisung bringt. **Mutante:** eine Route der Tabelle zurück auf `Path<T>` → der Test zu AK 2 ist an ihrer Zeile rot; `verlauf`, `bewegungen`, `boards` oder `board` zurück auf `Query<T>` → der Test zu AK 6 ist rot.

## Implementierungshinweise

- **Abgrenzung — 404 und 405 des Routers:** unbekannte Route (404) und falsche Methode (405) antworten heute mit leerem Rumpf. Sie entstehen im Router, nicht in einem Extraktor, und gehören **nicht** in diese Anforderung (ADR-0003 N4 Punkt 6); AK 13 hält sie unverändert fest. Ob sie künftig `{fehler}` tragen sollen, ist eine offene Frage an den product-owner (siehe „Offene Fragen“) und hält den Bau nicht auf.
- **Abgrenzung — weiteres:** der Rumpf ist R00153 (kein Handler mit `JsonKoerper<T>` ändert sein Verhalten am Rumpf); keine neuen Statuscodes, keine neuen `Fehler`-Varianten; `/web/{*name}` bleibt bei `Path` (`GET /web/%FF` antwortet weiter mit dem Klartext des Rahmens).
- **Baut auf #39:** Abweisungstyp und Rumpf-Funktion entstehen mit `JsonKoerper<T>` (R00153) und werden hier nicht ein zweites Mal angelegt. Der Code von #39 liegt bei der Planung noch nicht auf main; Zeilennummern in `src/web/mod.rs` sind deshalb weggelassen, die Handlernamen tragen.
- **Nicht gebaut, nur gelesen (Probe zuerst):** dass `RawPathParams` die Namen in der Reihenfolge der Schablone liefert und neben dem eigenen Lesen des Pfads im selben Extraktor verfügbar ist, hat der architekt am Code von axum 0.8.9 gelesen, nicht gebaut. Trägt der Weg nicht, meldet der Entwickler das an den architekt, statt das Kriterium „nennt den Parameter“ still zu lockern.
- **Nicht geprobt:** AK 2 und AK 4 sind über die Regel erzeugt; gefahren hat der architekt nur die Fälle der Tabelle in „Root Cause“. Für `%FF` zusammen mit einem Typfehler an derselben Route (`/api/aufgaben/abc/teilaufgaben/%FF`) legt diese Anforderung nicht fest, welcher Parameter genannt wird — der Rahmen prüft UTF-8 voraussichtlich vor dem Typ.
- **API-Beschreibung:** `utoipa` läuft mit `axum_extras` (`Cargo.toml:26`) und kann Parameter aus `Path<T>`/`Query<T>` der Signatur ableiten; die Routen nennen ihre Parameter zwar ausdrücklich in `params(…)`, AK 15 prüft trotzdem, dass mit den eigenen Extraktoren nichts aus der Beschreibung fällt.
- **`verlauf` und `bewegungen`** schreiben `axum::extract::Query<…>` aus (kein Import-Kürzel) — der `grep` aus AK 16 trifft sie.
- Die Oberfläche zeigt `json.fehler` an (`web/app.js:100`); mit dem Fix erscheint dort die deutsche Meldung. Kein Element und kein Code der Oberfläche ändert sich.
- Protokollierung: ADR-0001 (Logging) ist „Vorgeschlagen“ und nicht gebaut; diese Anforderung schreibt keine Protokollzeile.

## Offene Fragen

1. **An den product-owner — hält den Bau nicht auf:** Sollen 404 (unbekannte Route) und 405 (falsche Methode) des Routers künftig ebenfalls `application/json` mit `{"fehler": "…"}` tragen? Heute: leerer Rumpf, die Oberfläche fällt auf `statusText` zurück. Empfehlung des planers: eigene Karte, falls gewünscht (eigener Antwortweg am Router, ADR-0003 N4 Punkt 6) — nicht in dieser Anforderung.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: `GET /api/aufgaben/abc` ergibt 400 als englischen Klartext mit dem gesendeten Wert, weil der Rahmen den Pfad abweist, bevor ein Handler ihn sieht. Lesen alle 59 Handler Pfad und Abfrage über die eigenen Extraktoren (X), dann geht jede dieser Abweisungen durch dieselbe Abbildung wie die des Rumpfs und der Fachprüfungen (Y), und ein Agent bekommt an jeder Route 400 mit `{fehler}` und dem Namen des Parameters, wie ADR-0003 und die API-Beschreibung es zusagen (Z). Der Abgleich gegen `endpunkte.rs`, die Probe mit `%FF` an jeder Parameterstelle und der `grep` halten fest, dass die nächste Route nicht wieder durchfällt.

## Notizen

- Priorität: Mittel — Bruch des API-Kontrakts in der Form, der Status ist schon richtig; klein. Workaround: Clients lesen bei 400 ohne JSON den Statustext.
- **Herkunft:** Karte #168; Technik: ADR-0003 Nachtrag N4 (2026-11-15, `03137e6`), N1 Punkt 3. Bezug: R00153 (Karte #39), R00096, R00097, R00102.
- **Heimat:** eigene Interaction `I0141` unter D0007, neben I0140; braucht I0140.
- **Zählungen (planer, 2026-11-15, gezählt am Stand `03137e6`):** 59 Zeilen mit `Path<` oder `Query<` in `src/web/mod.rs` = 60 Verwendungen (55 `Path`, 5 `Query`); 80 Einträge in `src/web/endpunkte.rs`, davon 55 mit Pfadparameter — deckungsgleich mit der Routenliste des architekt (Abgleich nach Methode und Pfad ohne Abweichung); 68 Parameterstellen, davon 35 Zahlen (`u32` 31, `usize` 4) und 33 Texte.
- **Sicherheitsbezug:** heute steht der gesendete Wert im Rumpf der Abweisung; mit dem Fix nicht mehr (AK 4, AK 7).
- Labels der Karte: `bug`, `text`, `fehlerpfad`, `sicherheit`, `braucht:39`.
