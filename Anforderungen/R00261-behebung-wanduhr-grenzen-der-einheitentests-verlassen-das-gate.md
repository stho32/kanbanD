---
id: R00261
status: Neu
datum: 2026-11-27
ursprung: Bug-Report
ursprungslauf: R00247
---

# R00261: Behebung — Wanduhr-Grenzen der Einheits- und Rust-Tests verlassen das Gate (R00247 AK 9, R00214 AK 16 und gleiche Fälle)

## Beschreibung

Karte #276 (entstanden aus #248, #260, #269, ergänzt aus #235): Der Einheitentest `e2e/einheit/wortmarke.test.js:175` (R00247 AK 9, „doppelte Zeilenzahl, etwa doppelte Zeit“) urteilt über das Wanduhr-Verhältnis `t(10.000)/t(5.000)` gegen 1,3–3 (`:180–182`). Im parallelen `node --test`-Lauf und unter Last war er rot (3,16 / 3,5 / 4,2; Gate von #248 auf `main`, Gate von #260, 3 von 6 Läufen bei #269), allein grün. Derselbe Fehler steckt in Rust: `tests/akzeptanz_r00214.rs:476` (`ak16_viele_labels_halten_die_schreibsperre_nicht_auf`, R00214 AK 16, „< 1 s“ je Aufruf) war im Gate von #235 unter Fremdlast rot (1,015 s), einzeln grün.

Die Entscheidung liegt vor: ADR-0026 Nachtrag N6 (`131086e3`) dehnt Regel 12 aus N5 auf Einheitentests (`e2e/einheit/*.js`) aus: im Gate entscheidet der Zähler, die Wanduhr läuft nur als Lastprobe (`KD_LASTPROBE=1`, Last < 2). Für Rust nennt N5 `tests/*.rs` schon.

Das ist **falsch gebaut im Test, nicht im Programm**: der Zähler `vergleiche` steht in `wortmarke.test.js:178` bereits exakt (`2 × `), das Zeitverhältnis daneben misst unter Last die Maschine (Faktor 1,3–1,5, darüber flach, R00256).

**Suche nach weiteren Fällen** (Planer, Stand `131086e3`; Muster in der Anforderung festgehalten, weil ADR-0026 keinen „N5a“ führt): `grep -nE "hrtime|performance\.now|Date\.now\(\)" e2e/einheit/*.js` und `grep -nE "elapsed\(\)|Instant::now" tests/*.rs src` (Prüfung auf `assert` mit Dauer). Gezählt (Herkunft: gelesen, nicht gemessen):

| Stelle | Urteil im Gate | Einordnung |
|---|---|---|
| `e2e/einheit/wortmarke.test.js:182` | Verhältnis 1,3–3 | Wanduhr als Leistungsurteil (AK 1–3) |
| `e2e/einheit/bestand.test.js:146` | < 200 ms | Leistungsurteil |
| `e2e/einheit/markdown-tabellen.test.js:214`, `:242` | < 200 ms (je Fall) | Leistungsurteil; Größe (`html.length`) daneben schon zeitfrei |
| `e2e/einheit/lauf-satz.test.js:640` | < 2000 ms | Leistungsurteil |
| `tests/akzeptanz_r00214.rs:464/469/471/476/478/482` und `:495` | je < 1 s | Leistungsurteil (AK 4–5) |
| `src/modell/braucht.rs:360–366` (`binnen`, `GRENZE` 1 s) | < 1 s je 100.000 Labels | Leistungsurteil |
| `tests/akzeptanz_r00204.rs:301`, `tests/akzeptanz_r00206.rs:512`, `:609` | PATCH/GET < 1 s bzw. < 5 s | Leistungsurteil; der zeitfreie Zustand („das GET hängt noch“, Status ≠ 503) steht daneben |
| `src/verlauf.rs:444`, `src/dienst/commits_lesen.rs:326`, `src/dienst/diff.rs:568` | < 200 ms / < 2 s | Leistungsurteil |
| `tests/arbeitsrepo.rs:102/136`, `tests/arbeitsrepo_zeilengrenze.rs:23`, `tests/akzeptanz_r00204.rs:318/343/584/707`, `r00206:423/571/585`, `r00208:559`, `r00218:167`, `tests/live.rs`, `antwortbudget_strom.rs:57` | Zeitgrenze oder Frist **ist** das Verhalten (Zeitablauf wird erwartet, obere Schranke ≥ 3 × Sollwert) | **ausgenommen**, in der Fundliste (AK 6) mit Grund geführt |

Nicht gezählt, weil kein Urteil: `lauf-commits.test.js:181`, `lauf-auswerten.test.js:168/341` (nur `console.log` „Beobachtung“).

**Nicht Teil:** die Playwright-Specs (`e2e/tests/*.spec.js`, u. a. `r00247:445`, `r00248:528`, `r00217:365/393`) — Karte #279.

### Domänenbezug

Keine Fachbegriffe betroffen. „Lastprobe“ und „Zähler“ sind Begriffe des Testsystems (R00256, ADR-0026 N5/N6).

## Ursachenanalyse

### Root Cause

1. **Das Maß hängt an der Maschine, nicht an der Funktion.** Eine reine, synchrone Funktion braucht unter CPU-Konkurrenz länger (der Prozess wird verdrängt), ohne dass sie mehr Arbeit tut. Das Verhältnis zweier Wanduhr-Zeiten kippt, weil sich die Last zwischen den beiden Messungen ändert. Das volle Gate erzeugt die Last selbst (Lehre #168, etwa 10 bei 8 Kernen).
2. **Die zeitfreie Aussage ist da und härter.** `vergleiche(doppelt) === 2 * vergleiche(einfach)` (`wortmarke.test.js:178`) tötet den quadratischen Mutanten (m12 aus R00247) ohne Uhr. Die Wanduhr trägt über den Zähler hinaus nichts bei.
3. **Regel 12 galt nur für E2E und Rust-Integration** (N5); Einheitentests und `src`-Unit-Tests waren nicht benannt — daher kam der Fehler dort immer wieder (ADR-0026 N6).

Ausgeschlossen: ein Fehler im Programm (die Funktionen bleiben linear, Zähler belegt).

### Betroffene Komponenten

- Tests: `e2e/einheit/{wortmarke,bestand,markdown-tabellen,lauf-satz}.test.js`; `tests/akzeptanz_r00214.rs`, `tests/akzeptanz_r00204.rs`, `tests/akzeptanz_r00206.rs`; Unit-Tests in `src/modell/braucht.rs`, `src/verlauf.rs`, `src/dienst/commits_lesen.rs`, `src/dienst/diff.rs`; neu `tests/lastprobe_r00214.rs`.
- Möglich: eine schmale Zählernaht in `src/modell/braucht.rs` (Frage 1).
- **Nicht** betroffen: `web/` (Funktionen unverändert), Playwright-Specs (#279).

## Lösungsvorschlag

### Langfristige Lösung

Option N1 (empfohlen, entschieden in ADR-0026 N6): **Urteil und Beobachtung trennen.**
- Im Gate steht nur die zeitfreie Aussage desselben Kriteriums (Zähler, Zustand, Größe), von einem Mutanten bewacht.
- Das Zeitmaß läuft nur ausdrücklich (`KD_LASTPROBE=1` bzw. `#[ignore]` mit `--release`, `-- --ignored`) und nur bei Last < 2 (1-Minuten-Wert aus `/proc/loadavg`); die Ausgabe nennt Last und Zeiten; bei Last ≥ 2 „keine Messung: Last < 2 nötig“ statt stillen Grüns; im Gate erscheint der Fall als `skipped`/`ignored` mit Grund.

### Alternative Ansätze

- **N2 Grenze anheben, im Gate lassen:** verschiebt das Fenster, das Gate urteilt weiter über die Maschine (R00256 N2). Verworfen.
- **N3 Wiederholung/Minimum der Zeiten (heute `kuerzesteZeit`, 9 Läufe):** trug bei #248/#260/#269 nicht (3,16–4,2 trotz Minimum). Verworfen.
- **N4 Test löschen, nur Zähler:** verliert die Zeitzusage von R00247 AK 9 ganz. Verworfen, die Lastprobe hält sie.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Kein neuer roter Unit Test: der Fehler liegt im Test. Reproduktion: `node --test e2e/einheit/*.js` unter Last ≥ 6 (sechs CPU-Schleifen) auf `131086e3`, zehnmal; mindestens ein Lauf ist heute rot am Verhältnis. Für Rust: `cargo test --test akzeptanz_r00214 ak16_viele_labels` unter Last ≥ 6 (heute 1,015 s im Gate von #235).

### Wächter der Gate-Tests

Quadratischer Mutant je Fall, in einer Kopie, nie im Worktree: wortmarke „jedes Zeichen gegen jedes“ (m12) → Zähler rot; `neue_braucht_labels` mit `Vec::contains` → Zähler (Frage 1) rot. Mutanten nur auf committetem Stand zurücklegen.

### Regressionstests

Alle Tests aller Ebenen grün; die zeitfreien Aussagen der geänderten Fälle (Zustand, Größe, Antworten) bleiben wörtlich erhalten.

## Akzeptanzkriterien

### R00247 AK 9 (Wortmarke)

- [ ] **AK 1 Zähler im Gate:** Gegeben `e2e/einheit/wortmarke.test.js`, wenn `node --test e2e/einheit/wortmarke.test.js` läuft, dann enthält der Fall „AK 9 …“ weder `hrtime` noch ein Zeitverhältnis, und er prüft `vergleiche(10.000 Zeilen) === 2 × vergleiche(5.000 Zeilen)` sowie `vergleiche(5.000) === 5 × vergleiche(1.000)` (Anzahlen 1.000, 5.000, 10.000). Der Mutant „jedes Zeichen gegen jedes“ macht ihn rot; heute grün (Zähler schon exakt), die Uhr daneben rot unter Last.
- [ ] **AK 2 Zehnmal grün unter Last:** Gegeben Last ≥ 6 aus `/proc/loadavg` (gemessen), wenn `node --test e2e/einheit/*.js` zehnmal hintereinander läuft, dann sind alle zehn Läufe grün (Zähler: 10 von 10); der Zeitfall erscheint als `skipped`. Heute mindestens ein Lauf rot (Verhältnis 3,16–4,2).
- [ ] **AK 3 Lastprobe misst weiter:** Gegeben Last < 2, wenn `KD_LASTPROBE=1 node --test e2e/einheit/wortmarke.test.js` läuft, dann nennt die Ausgabe Last, beide Zeiten in ms und das Verhältnis und ist grün bei Verhältnis 1,3–3 (Grenze unverändert); bei Last ≥ 2 steht „keine Messung: Last < 2 nötig“ und kein Messwert gilt als bestanden; ohne `KD_LASTPROBE` ist der Fall `skipped` mit dem Grund.

### R00214 AK 16 (Rust)

- [ ] **AK 4 Gate zeitfrei:** Gegeben `tests/akzeptanz_r00214.rs` und der Unit-Test `ak16_*` in `src/modell/braucht.rs`, wenn `cargo test` läuft, dann steht in beiden außerhalb der Lastprobe keine `Duration`/`Instant`/`recv_timeout`-Grenze. Sie prüfen unverändert die Antworten (400 „Aufgabe #10 gibt es nicht (braucht:10)“, 200, `braucht` der Liste) und neu die Arbeit gezählt: ≤ c × n Schritte für n = 1.000, 10.000, 100.000 Labels in `neue_braucht_labels` und `braucht_nummern`, drei Formen (verschiedene, gleiche, umgekehrte Reihenfolge). Der Mutant `Vec::contains` macht sie rot.
- [ ] **AK 5 Lastprobe Rust:** Gegeben Last < 2, wenn `cargo test --release --test lastprobe_r00214 -- --ignored --nocapture` läuft, dann nennt die Ausgabe die Last und die Zeiten von 20.000 Labels speichern, zweimal PATCH (verschiedene, gleiche `braucht`), `GET /api/aufgaben` und den fremden PATCH auf #2 (je < 1 s, Grenze unverändert aus R00214 AK 16); bei Last ≥ 2 „keine Messung: Last < 2 nötig“; im Gate `ignored`.

### Weitere Stellen

- [ ] **AK 6 Fundliste:** Der Bericht der Karte enthält die Fundliste der Suche (beide Muster, `e2e/einheit`, `tests`, `src`), je Fundstelle als „Leistungsurteil“ (umgebaut) oder „Frist ist das Verhalten“ (ausgenommen, mit Grund) eingeordnet; nach dem Umbau findet die Suche außerhalb der Lastproben nur noch die ausgenommenen Fälle.
- [ ] **AK 7 JS-Stellen:** Gegeben `bestand.test.js` (B0347 „< 200 ms“), `markdown-tabellen.test.js` (zwei Fälle „< 200 ms“), `lauf-satz.test.js` (`farbenErlaubt` „< 2000 ms“), dann steht in keinem dieser Fälle im Gate eine Dauer-Grenze; ihre zeitfreien Aussagen (Zahlen, Größe `html.length`, Rückgabewerte, Text) sind unverändert; die Zeit läuft je Fall als Lastprobe nach AK 3.
- [ ] **AK 8 Rust-Stellen:** Gegeben `akzeptanz_r00204.rs:301`, `akzeptanz_r00206.rs:512` und `:609`, `src/verlauf.rs:444`, `src/dienst/commits_lesen.rs:326`, `src/dienst/diff.rs:568`, dann steht dort im Gate keine Dauer-Grenze; die Zustandsaussagen daneben („das GET hängt noch“, Status ≠ 503, Anzahl Einträge, Fehlertext) bleiben; die Zeit läuft als Lastprobe nach AK 5 (eine Datei je Gruppe oder gemeinsam, Wahl des entwicklers).
- [ ] **AK 9 Gate grün unter Last:** Gegeben Last ≥ 6, wenn `node --test e2e/einheit/*.js` und `cargo test` je zehnmal bzw. einmal vollständig laufen, dann sind die geänderten Fälle in allen Läufen grün; ein quadratischer Mutant je Zähler-Fall bleibt rot (AK 1, AK 4).

## Implementierungshinweise

- Nur Tests (und höchstens die Zählernaht aus Frage 1); kein Verhalten der Seite oder des Programms ändert sich.
- Muster Node: `test(name, { skip: !process.env.KD_LASTPROBE }, …)`, Last aus `/proc/loadavg`; Vorbild Rust: `tests/lastprobe_r00206.rs` (`#[ignore = "Lastprobe: nur ausdrücklich, mit --release"]`, Funktion `last()`), `tests/lastprobe_r00257.rs`; Playwright-Vorbild R00256.
- Lastproben nicht neben einem anderen Gate und nur tagsüber bei Last < 2 (gelerntes #234).
- Nach `javascript-stil`/Rust-Stil des Projekts; die Last-Hilfe einmal je Sprache, nicht je Fall.

## Offene Fragen

1. **An den architekt:** Für `neue_braucht_labels`/`braucht_nummern` (R00214 AK 16) gibt es heute keine Zählernaht (anders als `wortMarken(zeilen, zaehler)`). Empfehlung: ein optionaler Zähler als Parameter der Prüfungsfunktion, Rückgabe unverändert (Vorbild `wortMarken`); bis zur Antwort gilt das. Alternative: nur Lastprobe plus Mutant über die Antworten.
2. **An den PO:** Die Grenzen selbst bleiben (1,3–3; 1 s; 200 ms); keine Richtungsfrage. Nur zur Kenntnis: etwa 14 Rust-Stellen sind als „Frist ist das Verhalten“ ausgenommen (Fundliste), weil dort der Zeitablauf Anforderung ist.

## Warum löst diese Anforderung das Problem? (Pflicht)

Die Tests fielen rot, weil sie Dauer in Wanduhr-Zeit als Urteil trugen, und das Gate erzeugt die Last, die dieses Maß kippt. Wenn im Gate nur die zeitfreie Aussage urteilt (Zähler der Vergleiche, Zustand, Größe) und jeder Mutant sie weiterhin tötet, bedeutet ein rotes Gate wieder einen Fehler in der Funktion. Die Zeitzusage geht nicht verloren, sie läuft als Lastprobe bei Last < 2 mit genannten Werten (Muster R00256, R00257).

## Notizen

- Priorität: Hoch (rotes Gate bremst die Merge-Wache jeder Karte: #248, #260, #269, #235).
- Betroffene Nutzer/Systeme: Factory (Gate, Merge-Wache); Menschen nicht betroffen.
- Workaround: kein Gate bei Last — nicht einhaltbar.
- **Herkunft der Zahlen:** Verhältnisse 3,16/3,5/4,2 und „3 von 6 Läufen“ aus der Karte #276; 1,015 s aus dem Hinweis des Directors (#235); Zählungen der Fundliste gelesen am Stand `131086e3` (nicht ausgeführt); keine eigene Messung dieser Detailplanung.
- ADR-0026 führt keinen Nachtrag „N5a“; die Suchmuster stehen oben.
- Nicht Teil: Playwright-Specs (#279, R00260), neue Grenzen.
- User Story: `user-stories/R00261.md`.
