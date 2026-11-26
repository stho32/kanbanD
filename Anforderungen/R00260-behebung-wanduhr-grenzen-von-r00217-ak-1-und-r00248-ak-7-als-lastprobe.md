---
id: R00260
status: Neu
datum: 2026-11-27
ursprung: Bug-Report
ursprungslauf: R00248
---

# R00260: Behebung — die Long-Task-Grenzen von R00248 AK 7 und R00217 AK 1 verlassen das Gate und laufen als Lastprobe mit Lastbedingung

## Beschreibung

Karte #279, Folgekarte von #278 ([R00256](R00256-behebung-lastprobe-r00249-ak-9-getrennt-vom-gate.md)). Dieselbe Ursache: ein Test urteilt im Gate über eine **Wanduhr-Dauer** (`longtask` über 150 ms, `PerformanceObserver`). Verliert der Zeichenprozess unter Fremdlast die CPU, wächst die gemessene Dauer, ohne dass die Seite mehr arbeitet; das volle Gate erzeugt die Last selbst (4 Worker, etwa 10 bei 8 Kernen, Lehre #168). Ein rotes Gate heißt dann „Maschine ausgelastet“, nicht „Seite falsch“.

**Fundstellen am Code gelesen** (Stand `main` `71345f25`, nach ADR-0026 N5a):

| Spec | Zeile | Kriterium | Zeitgrenze im Gate |
|---|---|---|---|
| `e2e/tests/r00248-review-umbrechen.spec.js` | 478 (Urteil 528) | R00248 AK 7 (K-Last, Umschalten, Scrollen, Zurück) | `expect(Math.max(nachUmschalten, beimScrollen, zurueck)).toBeLessThanOrEqual(150)` |
| `e2e/tests/r00217-syntaxfarben.spec.js` | 365 | R00217 AK 1 (`feindlich.md`/`.html`/`.js`) | `expect(await langeSeit(…)).toEqual([])`, `langeSeit` filtert Dauern über 150 ms |
| `e2e/tests/r00217-syntaxfarben.spec.js` | 393 | R00217 AK 1 (`lang.rs`, ab `data-farbe="laeuft"`) | dasselbe |

**Beleg „heute rot“:** `r00248:478` — Befund des Directors auf `main` (Merge-Wache #233, 2026-11-26), rot bei Last 3–5, hält jedes volle Gate auf `main` rot. `r00217:365/393` — als gleiche Klasse benannt (#278), **in dieser Karte nicht rot gesehen und nicht nachgemessen**; die Klasse ist am Code belegt (Wanduhr-Maß mit fester Grenze). Die ruhigen Messwerte der Anforderungen sind: R00248 AK 7 höchstens 86 ms im Gate (Abstand 43 %), R00217 AK 1 längste Lücke 10–22 ms (Abstand über 80 %).

**Geprüft und nicht Teil dieser Karte** (mit Grund in „Abgrenzung“): `r00247-review-wortmarke.spec.js:445` (Messung **ohne** Grenze), `r00207-review-seite.spec.js:198` (gestellte Uhr, kein Wanduhr-Maß), `r00221-laufansicht.spec.js:363` (Frist im Sekundenmaßstab, anderer Mechanismus).

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“: die Review-Seite trägt die Abnahme einer Karte; ein verlässliches Gate bremst die Merge-Wache jeder Karte nicht.

### Domänenbezug

Fachbegriffe sind nicht betroffen. „Long Task“, „Lastprobe“ und „Last unter 2“ sind Begriffe des Testsystems (R00256, R00206 AK 15, R00204 AK 10, ADR-0026 Regel 12) und haben im Glossar keinen Eintrag.

## Ursachenanalyse

### Root Cause

1. **Das Maß hängt an der Maschine, nicht an der Seite.** Gemessen ist die Dauer einer Aufgabe des Hauptfadens in Wanduhr-Zeit; unter CPU-Konkurrenz wird sie bei unveränderter Arbeit länger (R00256 gemessen: Faktor 1,3–1,5 gegenüber ruhig). ADR-0026 Regel 12 (N5, N5a) legt fest: ein Zeitmaß urteilt nicht im Gate, es läuft ausdrücklich (`KD_LASTPROBE=1`) und bei Last < 2.
2. **Beide Fundstellen sind dem Gate nachträglich zugewachsen** (R00248 AK 7 und R00217 AK 1 sind vor R00256 gebaut). Kein Rückschritt der Seite belegt: `git diff` am gemessenen Weg ist für diese Karte nicht nötig, weil kein Code unter `web/` oder `src/` geändert wird.

Ausgeschlossen: ein Fehler in der Seite (kein Beleg, ruhige Werte weit unter der Grenze) und eine Änderung der Grenze (150 ms bleibt, ADR-0040 Punkt 6, ADR-0042 Q2).

### Betroffene Komponenten

- `e2e/tests/r00248-review-umbrechen.spec.js:478–530` — Fall „AK 7: K-Last …“.
- `e2e/tests/r00217-syntaxfarben.spec.js:313–337` (Helfer `langeAufgabenBeobachten`, `langeSeit`), `:357–372` (Schleife `feindlich.*`), `:374–396` (`lang.rs`).
- Je eine Verweiszeile in „Notizen“ von `Anforderungen/R00248-*.md` und `Anforderungen/R00217-*.md`.
- **Nicht** betroffen: `web/`, `src/`, `e2e/playwright.config.js`, alle übrigen Kriterien beider Anforderungen.

## Lösungsvorschlag

### Langfristige Lösung

Option N1 (empfohlen, ADR-0026 N5a, Vorbild R00256 und `r00249-review-nebeneinander.spec.js:634–696`): **Urteil und Beobachtung trennen.**

- Der **Gate-Fall** behält, was die Maschine nicht beeinflusst (Zustand, Knoten, Anfragen, Farbe, Blockzahl), und trägt kein Wanduhr-Urteil.
- Die **Lastprobe** je Spec (`test.describe('Lastprobe', …)` mit `test.skip(!process.env.KD_LASTPROBE, …)` im Rumpf; Last aus `/proc/loadavg`) misst die Dauern weiter, nennt Last und Werte und prüft die Grenze 150 ms nur bei Last < 2.

### Alternative Ansätze

- **N2 Grenze anheben und im Gate lassen:** das Urteil fiele weiter über die Maschine, die Grenze der ADR wäre still verfehlt. Verworfen (wie R00256).
- **N3 Verhältnis-Maß statt Wanduhr:** neue Grenze ohne Quelle, ADR-Sache des architekts. Verworfen für diese Karte.
- **N4 Alle ms-Grenzen des Gates in einer Karte umstellen** (`r00100:482`, `r00123:279`, `r00221:456`, `e2e/einheit/bestand.test.js:146`, `lauf-satz.test.js:640`): größerer Umfang ohne Rot-Beleg; ADR-0026 N5a nimmt sie ausdrücklich aus Regel 12. Verworfen, als Beobachtung im Bericht.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Es gibt keinen Unit Test; der Fehler liegt in der E2E-Probe (Vorbild R00231, R00252, R00256). Reproduktion: `npx playwright test tests/r00248-review-umbrechen.spec.js -g "AK 7: K-Last" --workers=1` auf dem heutigen Stand bei Last 3–5 (rot laut Director) und bei Last < 2 grün.

### Wächter der Gate-Fälle

Die Gate-Fälle müssen ohne Zeitmaß rot werden können: Mutant m5 von R00248 (das Umschalten zeichnet die Seite neu, Zeilenknoten neu) tötet den Gate-Fall von AK 7; für R00217 AK 1 nennt der Entwickler zu jedem Mutanten der Anforderung („alle Blöcke in einer Aufgabe aufgelegt“, „`tokenize` auf dem Hauptfaden“) den Test, der ihn im Gate tötet. `mutanteEinsetzen` nur mit Pfaden unter `/web/…` (Lehre #247), nur in einer Kopie; ein Mutantenlauf gilt erst, wenn mindestens ein Mutant rot wurde.

### Regressionstests

- Beide Specs bleiben vollständig grün, sonst unverändert (R00248 AK 1–6, 8–10; R00217 AK 2–10).
- Alle Tests aller Ebenen sind grün (Gate), kein neuer Wackler.

## Akzeptanzkriterien

### Gate verlässlich

- [ ] **AK 1 R00248 AK 7 im Gate ohne Zeitmaß, grün unter Last:** Gegeben `main` bei Rechnerlast 2,5–5,8 (8 Kerne), wenn `npx playwright test tests/r00248-review-umbrechen.spec.js -g "AK 7: K-Last" --workers=1` läuft, dann ist der Fall grün, dreimal hintereinander, und im vollen Gate (4 Worker) ebenso. Heute rot bei Last 3–5 (Befund des Directors).
- [ ] **AK 2 R00248 AK 7 behält den zeitfreien Teil:** Der Gate-Fall prüft weiter 5.000 `tr.add` in `src/gross.rs`, dass die erste und die letzte Zeile nach dem Umschalten dieselben Knoten sind (Marke `kdMarke`), und dass kein `/api/`-Aufruf entsteht; Mutant m5 (Umschalten zeichnet neu) macht ihn rot.
- [ ] **AK 3 R00217 AK 1 im Gate ohne Zeitmaß, grün unter Last:** Gegeben `main` bei Last 2,5–5,8, wenn `npx playwright test tests/r00217-syntaxfarben.spec.js -g "AK 1" --workers=1` läuft, dann sind beide Fälle (`feindlich.*` und `lang.rs`) grün, dreimal hintereinander, und im vollen Gate ebenso.
- [ ] **AK 4 R00217 AK 1 behält den zeitfreien Teil:** `feindlich.md`/`.html`/`.js` zeigen den vollständigen Text (64/64/261 Zeilen zu je 1.012 Zeichen), `data-farbe="nein"` und kein `tk-…`-Element; `lang.rs` endet `data-farbe="ja"` mit 10.000 Zeilen, `let` in der ersten und der letzten, 21 Blöcke `.dz-b`. Zu jedem Mutanten von R00217 AK 1 nennt der Durchlauf den Gate-Test, der ihn tötet; tötet ihn nur das Zeitmaß, steht das als benannter Verlust im Bericht.

### Lastprobe misst weiter

- [ ] **AK 5 Lastprobe R00248 AK 7:** Gegeben Last < 2, wenn `KD_LASTPROBE=1 npx playwright test tests/r00248-review-umbrechen.spec.js -g "AK 7 Lastprobe" --workers=1` läuft, dann nennt die Ausgabe die Last und die vier Werte `scrollenAus`, `nachUmschalten`, `beimScrollen`, `zurueck` in ms, und der Fall ist grün, wenn der größte der drei letzten Werte ≤ 150 ms ist (`scrollenAus` ist Vergleichswert, kein Kriterium, wie heute).
- [ ] **AK 6 Lastprobe R00217 AK 1:** Gegeben Last < 2, wenn `KD_LASTPROBE=1 npx playwright test tests/r00217-syntaxfarben.spec.js -g "AK 1 Lastprobe" --workers=1` läuft, dann nennt die Ausgabe die Last und je Datei (`feindlich.md`, `feindlich.html`, `feindlich.js`, `lang.rs` ab `laeuft`) die längste Aufgabe in ms, und der Fall ist grün, wenn jede ≤ 150 ms ist.
- [ ] **AK 7 Lastbedingung sichtbar, kein stilles Grün:** Beide Lastproben nennen „Last < 2“ im Kopf der Datei und in der Ausgabe, lesen die Last selbst (`/proc/loadavg`, 1-Minuten-Wert) und schreiben Last und Werte mit `KD_MESS_AUS` in eine Datei. Bei Last ≥ 2 steht in der Ausgabe die Last und „keine Messung: Last < 2 nötig“, und es wird kein Messwert als bestanden gemeldet. Ohne `KD_LASTPROBE` erscheinen beide im Gate als `skipped` mit dem Grund.
- [ ] **AK 8 Grenze bleibt 150 ms, kein stilles Anheben:** Liegt ein bei Last < 2 gemessener Wert über 115 ms (150 ms ÷ 1,3, Abstand ≥ 30 %, `zeitkriterien.md`), nennt der Durchlauf Last, Werte und den zu kleinen Abstand als Frage an den architekt, statt die Grenze zu ändern. Kommt kein Fenster unter Last 2 zustande (Wartezeit höchstens 10 Minuten, nie 21–8 Uhr), bleibt die Messung offen und der Durchlauf nennt die gemessene Last — kein Rot.

### Abgrenzung

- [ ] **AK 9 Nur diese zwei Specs, kein Zeitmaß-Urteil mehr im Gate:** Geändert werden nur `r00248-review-umbrechen.spec.js` und `r00217-syntaxfarben.spec.js` (± ein gemeinsamer Helfer `lastLesen` in `e2e/tests/hilfen.js`, nur neu hinzugefügt); `web/`, `src/` und `e2e/playwright.config.js` bleiben unberührt, `r00247`, `r00207` und `r00221` bleiben bytegleich. Prüfbar: in den drei Specs `r00217`, `r00248`, `r00247` steht außerhalb der Lastproben keine Zusicherung (`expect`) auf eine `kdLang`-Dauer; Beobachtungen ohne Grenze (`r00217:385`, `r00247:437–465`) bleiben.
- [ ] **AK 10 Bestand:** R00217 und R00248 bleiben abgenommen und gültig (ihr Kriterium „kein Long Task über 150 ms“ gilt weiter); in „Notizen“ jeder der beiden steht genau **eine** Verweiszeile auf R00260, ihre Kästchen bleiben, wie sie sind.

## Implementierungshinweise

- Form der Lastprobe wie `r00249-review-nebeneinander.spec.js:634–696`: `test.describe('Lastprobe', …)` mit `test.skip(!process.env.KD_LASTPROBE, 'Lastprobe: nur ausdrücklich (KD_LASTPROBE=1), Last < 2')` im Rumpf, damit der Fixture-Aufbau der Datei im Gate für den übersprungenen Fall nicht mitläuft; `lastLesen()` und `messungMelden()` wie dort. Ein gemeinsames `lastLesen` in `hilfen.js` ist erlaubt, wenn es die Datei von R00249 nicht ändert (Wahl des Entwicklers).
- R00248: der Fall wird geteilt — Gate: Aufbau, `toHaveCount(5000)`, Markierung, Umschalten, Scrollen, Knoten und Anfragen prüfen, ohne `langeAufgabenSammeln`; Lastprobe: dieselbe Messfolge mit den vier Werten. Der heutige Ablauf der Messung (`bisEnde`, `zweiBilder`, Startzeiten) bleibt für die Lastprobe unverändert.
- R00217: `langeSeit` darf in den Gate-Fällen als Beobachtung ohne Zusicherung stehen bleiben (wie `r00217:385`); die beiden Zusicherungen (`toEqual([])`, Zeilen 365 und 393) wandern in die Lastprobe, die das Aufklappen/„Änderungen anzeigen“ wiederholt.
- Namen nach `javascript-stil`; Mutanten nur in einer Kopie.
- Das Gate läuft nicht neben einem anderen Gate; die Lastprobe ebenso wenig und nie nachts (21–8 Uhr, Lehre #234).

## Offene Fragen

- Keine, die den Bau aufhält. Zwei Folgefragen gehen an den Director, nicht an den Betreiber: die zwei Wackler `r00207:198` und `r00221:363` brauchen eine eigene Karte mit Befund unter Last (siehe „Notizen“); die kleineren ms-Grenzen im Gate (N4) sind eine Beobachtung.

## Warum löst diese Anforderung das Problem? (Pflicht)

Die Fälle sind rot, weil sie die Dauer einer Aufgabe des Hauptfadens in Wanduhr-Zeit gegen eine feste Grenze halten und diese Dauer wächst, wenn die Maschine beschäftigt ist — im Gate beschäftigt sie das Gate selbst. Wandert das Maß in einen ausdrücklichen Lauf mit genannter Lastbedingung und prüft das Gate nur, was es unabhängig von der Maschine beurteilen kann (Zeilen, Knoten, Farbe, Blöcke, Anfragen), bedeutet ein rotes Gate wieder einen Fehler in der Seite. Die Messung geht nicht verloren: sie läuft als Lastprobe mit Last und Werten im Beleg, wie R00256 und die Rust-Lastproben. Der Hebel sitzt an der Probe, nicht an der Seite und nicht an der Grenze.

## Notizen

- Priorität: Hoch (Gate auf `main` bei Last ≥ 3 rot, bremst die Merge-Wache jeder Karte).
- Betroffene Nutzer/Systeme: Factory (Gate, Merge-Wache); Menschen sind nicht betroffen.
- Workaround: kein Gate auf `main` bei Last — praktisch nicht einhaltbar.
- **Herkunft der Zahlen:** „Last 3–5, rot“ (r00248:478): Kommentar des Directors an Karte #279 vom 2026-11-26. 86 ms, 43 % Abstand, Vergleichswert 162 ms: R00248 AK 7 (Messung im Gate, 2 Worker). 10–22 ms, über 80 %: R00217 Messziel (Probe des architekts, ADR-0040). 1,3–1,5 und 115 ms: R00256 (gemessen) und die Rechnung 150 ms ÷ 1,3. Alle Zahlen **übernommen, in dieser Detailplanung nicht nachgemessen** (Rechnerlast 4,9 beim Planen, kein Lauf).
- **Nicht Teil, mit Grund (geprüft am Code):**
  - `r00247:445` — AK 9 ist seit PO Z. 676 eine Messung ohne Grenze (`annotations.push`, `console.log`, `KD_MESS_AUS`, keine Zusicherung auf `mit`/`ohne`); es gibt nichts abzutrennen (ADR-0026 N5a Korrektur). Die Kartenbeschreibung und der Nachtrag N5 nennen die Stelle fälschlich als Grenze.
  - `r00207:198` (AK 6, „auch nach 70 s“) — `page.clock.install()` und `runFor(70000)` sind gestellte, **virtuelle** Zeit, kein Wanduhr-Maß und keine Dauer-Zusicherung; die Klasse ist eine andere. Der Rotgrund unter Last ist am Code nicht erkennbar (nackte Lesung `expect(z.diff.length)` nach `runFor`, Timer-Läufe im Seitenprozess); ohne Lauf unter Last kein Fix ohne Raten.
  - `r00221:363` (AK 3, L8 Bombe) — keine Dauer-Zusicherung des Kriteriums, sondern harte Warte-Fristen des Tests (`toHaveText … timeout: 20000`, Klick `timeout: 2000`, `expect.poll … timeout: 2000` für den Rückweg nach dem Freigeben von 16 MiB). R00221 AK 3 nennt keine Zahl; die 2.000 ms hat die Spec gewählt. Das ist die Klasse „Frist als Synchronisierung“ (ADR-0026 Regel 5), ein Wackler im Sekundenmaßstab, den ADR-0026 N5a ausdrücklich aus Regel 12 nimmt; die Lehre „ein Fix, der nur länger wartet, verschiebt das Fenster“ verlangt zuerst den Befund, welche der drei Fristen reißt.
- User Story nach dem Bug-Format: `user-stories/R00260.md`.
