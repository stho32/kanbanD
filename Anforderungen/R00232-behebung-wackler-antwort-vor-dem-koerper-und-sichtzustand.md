---
id: R00232
status: Offen
datum: 2026-11-22
ursprung: Bug-Report
ursprungslauf: R00216
---

# R00232: Behebung — drei Wackler unter Last: Antwort vor dem Körper mit rohem Socket prüfen, Trenner per Zusicherung lesen, Sichtzustand im selben Zug lesen

## Beschreibung

Karte #246. Im Gate auf `main` für #217 (`55108b99`, Last bis 5,9) waren drei Tests rot, jeder danach allein 3 von 3 grün; in Gates vom 2026-11-21/22 kamen `r00223` AK 12/13 dazu (ADR-0026 N4, „Anlass“):

- `tests/transkripte_api.rs` `ak03_wirksamer_schalter` (Panic an `:110`, `hyper::Error(BodyWrite, BrokenPipe)`); dieselbe Klasse tragen die 413-Proben in `ak06_groesse` (`:209`, `:213`)
- `e2e/tests/r00124-datums-trenner.spec.js:46` (US-1): `Array []` statt drei Trennern
- `e2e/tests/r00223-ohne-phasen.spec.js:262`, `:285`, `:308` (AK 12/13): `#main details:not([open])` erwartet 0, erhalten 1

Alle drei Ursachen liegen **im Test**; die Zusagen des Programms stimmen (ADR-0026 N4, „Urteil“ je Fall). Das ist **falsch gebaut im Test**, nicht im Programm: R00216 (409 vor dem Körper, 413 über 10.485.760 Byte), R00124 US-1 und R00223 AK 12/13 bleiben unverändert gültig; ihre Proben lesen nur zu einem Zeitpunkt oder mit einem Client, der unter Last etwas anderes sieht.

Die Karte hat zwei Teile (PO Z. 516): **A** die Rust-Proben nach ADR-0026 N4 Regel 10, **B** die beiden E2E-Specs nach Regel 1/3 und Regel 9.

Zahlt ein auf: [Vision](R00000-vision.md) über die Leitplanke des Teams, dass ein rotes Gate einen echten Fehler bedeutet — ein Wackler, der in vollen Läufen fremde Karten rot färbt, lässt ein echtes Rot im Rauschen untergehen.

## Ursachenanalyse

### Root Cause

Belegt in [ADR-0026](../Dokumentation/ADRs/0026-warten-auf-zustand-statt-zeit-in-e2e-tests.md) Nachtrag N4 (Commit `e400d5aa`), Proben ohne Last mit 1 Worker gegen den Stand `6dcc1b69`:

- **A, `ak03` und `ak06`:** Der Server antwortet 409, bevor er den Körper liest (`src/web/mod.rs:1351–1357`, ADR-0036 Regel 5), und schließt dann die Verbindung; bei 413 liest er bis zur Grenze und schließt. Der Test lädt über reqwest mit vollem Körper hoch (`hochladen_mit`, `tests/transkripte_api.rs:102–113`) und wertet `send().await.unwrap()`. Ein roher Socket, der Kopf und Körper ohne Pause schickt, bekommt nach rund 1,8 MB von 10 MB `BrokenPipe`, 5 von 5 Mal; die Antwort `HTTP/1.1 409` bleibt danach lesbar, auch nach 0, 50 und 300 ms Pause. Unter Last liefert reqwest den Schreibfehler statt der Antwort (begründet, nicht geprobt).
- **B, `r00124:46`:** `onopen` setzt `data-live="verbunden"` (`web/app.js:5188`), bevor `laden()` gezeichnet hat; die Spalte „Fertig“ mit Trennern entsteht erst mit `GET /api/berichte/bewegungen` (`:277–284`). Die Spec liest nach `liveBereit` sofort mit `allInnerTexts` (`:49`). Mit 1,5 s verzögerter Antwort ist das 3 von 3 rot, mit `toHaveText` 3 von 3 grün. Verletzt Regel 1 (nackte Lesung) und Regel 3 (`liveBereit` allein ist nicht „die Ansicht steht“).
- **B, `r00223` AK 12/13:** Das Fever Chart rechnet nach dem ersten Zeichnen fehlende Tage nach (`fieberNachtragen`, `web/app.js:448–478`), schreibt `POST …/fieber/cache` und zeichnet `#main` neu (`:2117`); aufgeklappte `<details>` (`web/ansicht.js:2089`, `:2143`) stehen danach wieder zu — gewolltes Verhalten nach ADR-0007. `allesAufklappen` (`r00223-ohne-phasen.spec.js:99–106`) klappt per Klick auf, `sichttext` (`:109`) und `querScrollen` (`:170`) lesen in späteren Aufrufen. Mit 1,5 s verzögertem `POST …/fieber/cache` ist das rot wie im Gate.

### Betroffene Komponenten

- `tests/transkripte_api.rs` (oder `tests/gemeinsam/mod.rs`): neue Hilfe für den rohen Upload; `ak03_wirksamer_schalter` (`:184`) und `ak06_groesse` (`:209`, `:213`)
- `e2e/tests/r00124-datums-trenner.spec.js`: `:46` (Lesungen `:49`, `:52`) und `:200` (Lesung `:204`, gleiche Klasse)
- `e2e/tests/r00223-ohne-phasen.spec.js`: `allesAufklappen`, `sichttext`, `querScrollen` und ihre Aufrufer `:262`, `:285`, `:308`
- **Nicht** betroffen: `src/`, `web/` (kein Produktivcode); `ak08` (`:292`, kleiner Körper); `e2e/tests/r00148-zweiter-ausloeser.spec.js` (siehe Nicht-Ziel)

## Lösungsvorschlag

### Langfristige Lösung

- **A (Regel 10):** Eine Hilfe sendet den Upload über einen rohen `std::net::TcpStream`: Kopf mit `Content-Length` über 10 MB, die Felder vor der Datei, dann entweder **höchstens ein erstes Stück** (409-Zusage) oder **weiter bis der Server schließt** (413-Zusage). Ein Schreibfehler (`BrokenPipe`, `ConnectionReset`) ist kein Ergebnis; danach liest sie Statuszeile und JSON mit einer Lesefrist von 5 s. Ein reqwest-Aufruf mit vollem Körper über 10 MB entfällt in diesen Proben.
- **B (Regel 1/3):** r00124 liest Trenner per Zusicherung (`await expect(trenner(page)).toHaveText([...])`) und die Reihe (`folge`) unter `expect.poll`.
- **B (Regel 9):** r00223 stellt den Sichtzustand im selben Aufruf her, in dem es liest: `sichttext` setzt `open` an jedem `<details>` der geklonten Wurzel; `querScrollen` öffnet die `<details>` in demselben `page.evaluate`, in dem es misst. Aufklappen per Klick mit späterer Lesung entfällt.

### Alternative Ansätze

Entschieden im ADR, hier nur benannt:

- Timeout erhöhen oder `retries` — verschiebt nur das Fenster; verworfen (ADR-0026 Option B)
- `Expect: 100-continue` im Test-Client — prüft einen anderen Client als den der Zusage, und reqwest unterstützt es nicht verlässlich; verworfen zugunsten des rohen Sockets (Regel 10)
- `<details>` beim Neuzeichnen offen halten — Produktivcode gegen ADR-0007 ohne Defekt; verworfen
- auf das Ende von `fieberNachtragen` warten — es gibt kein beobachtbares Ende, `kdTest.gezeichnet()` ist schon vorher wahr; verworfen

## Test-Strategie

### Test zur Bug-Reproduktion

Je Ursache eine Variante, die die Lage **ohne Last** herstellt (ADR-0026 N4 „Probe“): A ein Client, der den vollen Körper schreibt und erst nach dem Schreibfehler liest; B r00124 mit verzögertem `GET /api/berichte/bewegungen`; B r00223 mit verzögertem `POST …/fieber/cache` und mit Neuzeichnen in jedem Frame. Jede Variante ist zuerst mit der heutigen Lesart rot (Mutante), dann mit der neuen grün.

### Code-Extraktion für isoliertes Testing

Die Hilfe für den rohen Upload (A) ist für sich prüfbar: dieselbe Hilfe liefert für 409 und 413 Status und JSON, auch wenn das Schreiben scheitert.

### Regressionstests

- alle übrigen Tests von `tests/transkripte_api.rs`, r00124 und r00223 ohne geänderte Erwartung grün
- alle Tests aller Ebenen grün (Gate)

## Akzeptanzkriterien

**Ausgangslage:** die Testdaten der drei Dateien unverändert (`an()` und `ausgangslage(…)` in `tests/transkripte_api.rs`, `grundbestand` in r00124, `ausgangslage(R)` in r00223). Alle Proben laufen **ohne Rechnerlast** und mit 1 Worker; keine Lastprobe ist Kriterium dieser Anforderung (Nachtbetrieb, `AI-Team/gelerntes.md` 2026-11-22). „10 von 10“ heißt zehn Läufe in Folge: E2E mit `--repeat-each=10 --workers=1`, Rust mit `for i in $(seq 10); do cargo test --test transkripte_api -- <namen>; done`.

### A — Antwort vor dem Körper (Rust, Regel 10)

- [ ] **AK 1 Roher Upload für 409:** Gegeben eine Zeile mit Erfassung `aus` in `ak03_wirksamer_schalter`: der zweite Upload (heute `:184`, `gross(ZEHN_MB + 1)` über reqwest) geht über die rohe Hilfe mit `Content-Length` über 10.485.760 und höchstens einem ersten Stück des Körpers. Er liefert 409 mit `erfassung: "aus"` binnen der Lesefrist von 5 s; Commit-Zahl unverändert, nichts unter `transkripte/` — wie heute geprüft. Liest der Server den Körper, scheitert der Test benannt an der Lesefrist („Lesefrist 5 s: Server liest den Körper“ o. ä.), er hängt nicht.
- [ ] **AK 2 Roher Upload für 413:** In `ak06_groesse` gehen „ein Byte mehr“ (`:209`, 10.485.761 Byte) und „60 MB“ (`:213`) über die rohe Hilfe, die schreibt, bis der Server schließt, einen Schreibfehler nicht als Ergebnis wertet und danach liest. Beide liefern 413 mit `fehler` als Zeichenkette; `nichts_geschrieben` wie heute. Der Upload von genau 10.485.760 Byte (`:206`, 201) bleibt über reqwest.
- [ ] **AK 3 Kein voller reqwest-Körper über der Grenze:** `grep -nE 'hochladen(_mit)?\(.*gross\((ZEHN_MB \+ 1|60 \* 1024)' tests/transkripte_api.rs` findet keine Zeile mehr (heute trifft es `:184`, `:209`, `:213`).
- [ ] **AK 4 Variante „langsamer Leser“ (Abnahme-Probe, wörtlich nach N4):** Ein zusätzlicher Test schreibt mit der rohen Hilfe den **vollen** Körper (10.485.761 Byte) ohne Pause und liest erst nach einer Pause von 0, 50 und 300 ms nach dem Schreibfehler (bzw. nach dem Ende des Schreibens, falls keiner kommt) — einmal gegen Erfassung `aus` (erwartet 409, `erfassung: "aus"`), einmal gegen Erfassung an (erwartet 413). Er ist 10 von 10 grün. Heute: die Variante gibt es nicht; die Lage ist belegt (roher Socket, 5 von 5 `BrokenPipe` nach rund 1,8 MB, die 409 danach lesbar, N4).
- [ ] **AK 5 Mutanten A**, jeder von einem benannten Test getötet, in einer eigenen Kopie, nicht im Worktree:
  - (mA1) die Hilfe wertet einen Schreibfehler als Ergebnis (wie `send().await.unwrap()` heute) → die Variante aus AK 4 gegen Erfassung `aus` rot (Mutante „heutige Lesart“).
  - (mA2) der Server liest den Körper vor der Prüfung (`transkript_ablegen`, `src/web/mod.rs:1351–1357`: erst die Teile lesen, dann `transkript_vorpruefen`) → AK 1 scheitert an der Lesefrist bzw. an 413 statt 409 (Mutante der Karte).

### B — E2E-Lesungen (Regel 1/3 und Regel 9)

- [ ] **AK 6 r00124 liest per Zusicherung:** In US-1 (`:46`) stehen die Trenner über `await expect(trenner(page)).toHaveText(['— Heute —', '— Gestern —', '— <vorgestern als TT.MM.JJJJ> —'])` und die Reihe `['T', '4', 'T', '3', '2', 'T', '1']` unter `expect.poll`; ebenso die erste Reihe in „AK Reihenfolge“ (`:200`, heute `expect(await folge(page))` an `:204`). `grep -nE 'await texte\(page\)|expect\(await folge' e2e/tests/r00124-datums-trenner.spec.js` findet keine Zeile mehr (heute `:49`, `:204`). Erwartete Werte unverändert.
- [ ] **AK 7 Variante r00124 (Abnahme-Probe, wörtlich nach N4):** Ein zusätzlicher Test hält `GET /api/berichte/bewegungen` per `page.route` 1,5 s zurück und prüft dann US-1 wie AK 6. Er ist 10 von 10 grün. Heute 3 von 3 rot mit der Lesung von `:49` (`Array []`, Probe des architekt).
- [ ] **AK 8 r00124 wiederholt:** `npx playwright test r00124-datums-trenner --repeat-each=20 --workers=1` ist grün, 0 failed, 0 flaky.
- [ ] **AK 9 r00223 liest den Sichtzustand im selben Zug:** `sichttext` setzt `open` an jedem `<details>` der geklonten Wurzel, bevor es `innerText` liest; `querScrollen` öffnet alle `#main details` (bzw. `#fenster details`) im selben `page.evaluate`, in dem es `scrollWidth`/`clientWidth` misst. Kein Aufruf in `:262`, `:285`, `:308` klappt per Klick auf und liest danach in einem getrennten Aufruf; `allesAufklappen` entfällt oder liest selbst im selben Zug. Erwartungen (Wörter, `/phase/i`, Breiten 375/641/768/980 px, Farben) unverändert.
- [ ] **AK 10 Positivprobe gegen die leere Wahrheit:** Die Prüfungen „Text enthält X nicht“ in `:262` und `:285` gelten nur, wenn jede Box mitgelesen ist. `sichttext` liefert dazu im selben Aufruf die Zahl der `<details>` in der Kopie und die Zahl derer, deren Inhalt außer `<summary>` einen nicht leeren `innerText` hat. Der Test verlangt für „Wie lange noch“ und „Fever Chart“: beide Zahlen gleich und mindestens 1 (Fever Chart heute 2: „Zonengrenzen“ und „Tabellenansicht“, `web/ansicht.js:2089`, `:2143`). Eine zugeklappte Box macht den Test rot, nicht grün.
- [ ] **AK 11 Varianten r00223 (Abnahme-Probe, wörtlich nach N4):** Zwei zusätzliche Tests auf „Fever Chart“ (`entwicklung`): (v1) `POST …/fieber/cache` per `page.route` 1,5 s zurückgehalten, (v2) die Seite zeichnet in jedem Frame neu (`requestAnimationFrame`-Schleife mit `render()`, wie R00231 AK 3). Beide lesen Sichttext mit Positivprobe (AK 10) und `querScrollen` wie AK 9 und sind je 10 von 10 grün. Heute ist v1 rot (`#main details:not([open])` erwartet 0, erhalten 1, Probe des architekt); v2 ist mit der heutigen Lesart rot (mB1).
- [ ] **AK 12 Mutanten B**, jeder von einem benannten Test getötet, in einer eigenen Kopie, nicht im Worktree:
  - (mB1) Aufklappen per Klick und spätere Lesung in einem getrennten Aufruf (das heutige `allesAufklappen` vor `sichttext`/`querScrollen`) → v1 und v2 rot (Mutante der Karte).
  - (mB2) `sichttext` setzt `open` in der Kopie nicht → AK 10 rot.
  - (mB3) die Variante aus AK 7 liest wie heute mit `allInnerTexts` direkt nach `liveBereit` → rot.

  Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung.

### Für beide Teile

- [ ] **AK 13 Bug-Vorlage:** Kein Produktivcode geändert — außer AK 14 (`git diff --stat main...` nur unter `tests/` und `e2e/tests/`). Keine Erwartung abgeschwächt, kein Timeout pauschal erhöht, keine `retries`, kein neues `waitForTimeout` (die Verzögerung der Varianten sitzt im Routen-Handler). Alle Tests aller Ebenen grün.
- [ ] **AK 14 Scroll-Rahmen der Prognose-Tabelle (Ausnahme von AK 13):** Die Tabellenansicht von „Wie lange noch“ liegt wie die Tabellen von Burndown und Kumulativem Fluss in einem benannten, per Tastatur erreichbaren Rahmen `.bericht-rahmen` (Beschriftung „Prognose je Tag“). Bei geöffneter Tabellenansicht gilt bei 375, 641, 768 und 980 px auf `entwicklung` und `breit` für Dokument und `.body.bericht` `scrollWidth ≤ clientWidth`; quer rollt nur der Rahmen. Der Test zu R00223 AK 13 (`r00223-ohne-phasen.spec.js:326`) ist ohne Änderung grün, am Stand vor dem Fix rot (743/759 px bei 375/641 px). Das ist die einzige Änderung am Produktivcode (`git diff --stat main...` außer `tests/`, `e2e/tests/` nur `web/ansicht.js`).

## Nicht-Ziele

- **`e2e/tests/r00148-zweiter-ausloeser.spec.js:515`** (B2 Taste „t“, im Gate von `55108b99` Zeile 535): Ursache eingegrenzt, nicht belegt (ohne Last 0 von 150); ADR-0026 N4 Regel 11 bleibt „Vorgeschlagen“. **Wiedereintritt (PO Z. 516):** Wird `r00148:515` im Gate wieder rot, legt der Director eine eigene Karte mit Regel 11 und der Diagnose aus #198 an.
- Der Hinweis „mit `Expect: 100-continue` senden“ in der Beschreibung des Upload-Endpunkts (ADR-0036) ist Härtung, kein Kriterium dieser Karte.
- Lastproben (volle Suite mit Last, Gate in Folge) — nur am Tag zulässig und hier kein Kriterium.

## Implementierungshinweise

- Vorbilder für rohe Sockets: `tests/gemeinsam/mod.rs:88`, `:206–240` (`nur_statuszeile`, `rest_lesen`), `tests/antwortbudget_strom.rs:46`. Das Multipart-Format bildet `hochladen_mit` (`tests/transkripte_api.rs:102`) ab: Felder `at`, `role`, `column`, dann Teil `datei` mit `filename="lauf.jsonl.gz"`, Kopf `X-KanbanD-Wer`.
- Lesefrist über `set_read_timeout(Some(Duration::from_secs(5)))`; die 5 s gelten ab dem Ende des Schreibens.
- `sichttext` klont schon (`r00223-ohne-phasen.spec.js:109–116`); `open` in der Kopie setzen reicht für Text (Regel 9). Für `querScrollen` braucht es die echten Knoten, deshalb Öffnen und Messen in einem `page.evaluate`, wenn nötig unter `expect.poll`.
- Regel 9 nennt `e2e/tests/hilfen.js` als Ort erst, wenn eine zweite Spec die Hilfe braucht — hier bleibt sie in r00223.
- Das Gate allein fahren, ohne `nice`, kein anderes Gate daneben (AI-Team/gelerntes.md 2026-11-15).

## Offene Fragen

- keine, die den Bau aufhält.

## Warum löst diese Anforderung das Problem? (Pflicht)

- **A:** Der Server antwortet und schließt, bevor der Körper ganz gesendet ist; reqwest bekommt dabei unter Last zuerst den Schreibfehler und wirft die Antwort weg. Die rohe Hilfe trennt Schreiben und Lesen: sie zählt den Schreibfehler nicht und liest danach die Antwort, die der Server schon gesendet hat. Damit hängt das Urteil an der Statuszeile, nicht daran, welches Ereignis der Client zuerst bearbeitet; die Variante „langsamer Leser“ stellt genau diese Reihenfolge ohne Last her.
- **B r00124:** `liveBereit` sagt nur, dass die Leitung steht, nicht, dass „Fertig“ gezeichnet ist. Eine Zusicherung wartet auf den Zustand, eine Lesung nimmt den Augenblick; mit der Zusicherung ist eine langsame Bewegungsabfrage nur noch Wartezeit, kein Rot.
- **B r00223:** Die Seite ersetzt `#main` nach dem Nachtrag und klappt dabei die Boxen zu. Wird im selben Aufruf geöffnet und gelesen, kann kein Neuzeichnen dazwischenfallen; die Positivprobe stellt sicher, dass eine zugeklappte Box nicht als „Wort fehlt“ grün durchgeht.

## Notizen

- Priorität: Hoch (Wackler im Gate, Vorrang nach gemeinsam/gelerntes.md)
- Betroffene Nutzer/Systeme: jedes Gate mit voller Rust- und Playwright-Suite
- Workaround: den roten Test allein nachfahren
- Ursprung je Teil: A in R00216 (Transkripte ablegen), B in R00124 (Datums-Trenner) und R00223 (Phasen werden gewöhnliche Spalten)
- `:200`/`:204` in r00124 ist nicht im Gate aufgefallen, trägt aber dieselbe Lesung direkt nach `liveBereit` und wird mit derselben Regel und derselben Variante abgedeckt (Entscheidung des planer, Bericht Lauf 246-planer-1)
- Grundlage: ADR-0026 Nachtrag N4 (`e400d5aa`), PO Z. 516 (`e67b1d57`), Kommentar des architekt auf Karte #246 vom 2026-11-22
