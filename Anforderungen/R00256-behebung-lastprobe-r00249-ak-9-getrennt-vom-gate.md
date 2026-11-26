---
id: R00256
status: Neu
datum: 2026-11-26
ursprung: Bug-Report
ursprungslauf: R00249
---

# R00256: Behebung — die Long-Task-Probe von R00249 AK 9 verlässt das Gate und läuft als Lastprobe mit Lastbedingung

## Beschreibung

Karte #278, Befund des Directors vom 2026-11-26 vormittags auf `main` (`459f435d`) bei Rechnerlast 2,5–4,8: die Probe `e2e/tests/r00249-review-nebeneinander.spec.js:601` (R00249 AK 9 „kein `longtask` über 150 ms", 10.000 geänderte Zeilen, 5.000 Tabellenzeilen, 30 Wiederholungen) war dreimal von drei rot — Long Task 160 ms und 162 ms auf `main`, 187 ms im Worktree #233; Grenze 150 ms. Ein volles Gate auf `main` früher am selben Tag war grün.

**Nachgemessen in dieser Karte** (Kopie des Standes `eaf7c8c1` in der Ablage, vorgebautes Programm `target-main/debug/kanbanD`, Playwright `--workers=1`, nur diese eine Spec, `nice -n 10`, Last aus `/proc/loadavg`):

| Lauf | Last (1 min) | `umschalten` | `scrollen` | `zurueck` | Leseposition | Urteil |
|---|---|---|---|---|---|---|
| A | 5,78 | 128 ms | **165 ms** | 92 ms | 13 px | rot (Grenze 150 ms) |
| B | 3,68 | 110 ms | **156 ms** | 65 ms | 13 px | rot |
| C | 4,26 | 118 ms | **166 ms** | 103 ms | 0 px | rot |

(Alle Läufe A–C: Kopie des Standes in der Ablage `plan-278/`, 1 Worker, `nice -n 10`, Protokolle `lauf-last.txt` und `messung-mittel.jsonl`.)

In allen drei Läufen tragen die **übrigen** Zusagen von AK 9: die 5.000 Tabellenzeilen und die Leseposition (13 bzw. 13 bzw. 0 px, erlaubt sind 36 px) sind grün, und die Farbe ist vor der Messung fertig (`farbeAbwarten`). Rot ist allein das Wanduhr-Maß, und rot ist darin allein die **Scroll**-Phase; `umschalten` und `zurueck` lagen mit 110–128 ms und 65–103 ms unter der Grenze.

Ein Fenster **unter Last 2** kam in diesem Lauf nicht zustande: über 50 Minuten lag die 1-Minuten-Last zwischen 3,4 und 6,1 (Fremdlast: das Gate von `gitreviewA` und ein weiteres Karten-Gate auf derselben Maschine). Der ruhige Wert ist deshalb der dokumentierte Messwert aus R00249 „Notizen" (Messung B1312, Last ~1,5): `umschalten` 83 ms, `scrollen` 109–118 ms — **übernommen, nicht nachgemessen**; die Lastprobe nach dem Fix (AK 3) fährt ihn erneut bei Last < 2.

**Erwartet:** grün — derselbe Stand hat beim Bau der Probe (R00249 „Notizen", Last ~1,5) `umschalten` 83 ms und beim Scrollen 109–118 ms gemessen, und seit dem Commit von B1312 (`41e7060a`) ist am gemessenen Weg keine Zeile geändert (kein Byte in `web/diff.js`, `web/review-uebersicht.js`, `web/farbschlange.js`). **Tatsächlich:** rot, sobald die Maschine Last trägt.

Das ist **falsch gebaut im Test, nicht in der Seite.** `longtask` ist ein **Wanduhr-Maß** der Dauer einer Aufgabe des Hauptfadens (`PerformanceObserver`, R00249 AK 9): verliert der Zeichenprozess unter Fremdlast die CPU, wächst die gemessene Dauer, ohne dass die Seite mehr arbeitet. Die Grenze ist gegen den ruhigen Messwert zudem enger gesetzt, als `rollen/planer/zeitkriterien.md` verlangt (Abstand ≥ 30 %): 109–118 ms ruhig gegen 150 ms sind 27 %, nicht 30 % — nur der Umschaltwert (83 ms) trug den geforderten Abstand. Im vollen Gate kommt die Last, die das Urteil verschiebt, aus dem Gate selbst (4 Worker; Lehre #168: die volle Suite treibt diesen Rechner auf etwa 10 bei 8 Kernen), also auch ohne fremdes Gate.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen" (Z. 109): die Review-Seite „Nebeneinander" trägt die Abnahme einer Karte. Ein rotes Gate auf `main` bremst die Merge-Wache **jeder** Karte (hier #233 und #277) und lässt ein echtes Rot im Rauschen untergehen.

### Domänenbezug

Fachbegriffe sind nicht betroffen. „Long Task", „Lastprobe" und „Tagprobe" sind Begriffe des Testsystems (R00206 AK 15, R00204 AK 10, B1125, B1263) und haben im Glossar keinen Eintrag.

## Ursachenanalyse

### Root Cause

Zwei Ursachen, beide zugleich nötig für das rote Urteil; die erste ist die tragende:

1. **Das Maß hängt an der Maschine, nicht an der Seite.** `longtask` misst die Dauer einer Aufgabe des Hauptfadens in Wanduhr-Zeit. Unter CPU-Konkurrenz wird der Zeichenprozess mitten in der Aufgabe verdrängt; dieselbe Arbeit dauert dann länger als gemessen. Belegt mit demselben Stand und demselben Aufruf bei vier Lasten: Last ~1,5 (R00249 „Notizen", Messung B1312) → `umschalten` 83 ms, `scrollen` 109–118 ms; Last 3,68 → 110 / 156 ms; Last 4,26 → 118 / 166 ms; Last 5,78 → 128 / 165 ms. Faktor 1,3–1,5, sobald die Maschine überhaupt Last trägt, darüber flach (156→166 ms zwischen Last 3,7 und 4,3). Der rote Wert dieser Karte entsteht beim **Scrollen** (siehe Tabelle in „Beschreibung"), also im Zeichnen/Layout, das der Browser für die 5.000 Zeilen tut — nicht in einem Skript von kanbanD: die Review-Seite hat keinen Scroll-Zuhörer, der Arbeit verrichtet (`web/app.js:5071` ist die Tipp-Platzierung, die Farbauflage ist vor der Messung fertig, `farbeAbwarten`).
2. **Kein Rückschritt seit #260.** `git diff 41e7060a 459f435d -- web/` ändert genau `web/app.js` (58 Zeilen, Laufansicht und `reviewZurueck`), `web/index.html`, `web/kd-app.css` (34 Zeilen, Marker-Zeilen), `web/lauf-commits.js` (neu) und `web/lauf.js` — **kein Byte** in `web/diff.js`, `web/review-uebersicht.js` oder `web/farbschlange.js`; die Zeichenwege der Review-Seite sind unverändert. Kein Code-Hebel ohne Beleg, deshalb kein Fix in der Seite.
3. **Die Grenze ist für die entscheidende Phase zu eng.** R00249 AK 9 führt drei Messpunkte zusammen (`umschalten`, `scrollen`, `zurueck`) und prüft alle gegen 150 ms. Der Abstand, den `zeitkriterien.md` verlangt (≥ 30 %), ist nur beim Umschalten eingehalten (83 ms → 150 ms = 81 %); beim Scrollen sind 109–118 ms gegen 150 ms **27 %**. Der Hinweis „Grenze 150 ms (Abstand ≥ 30 % beim Umschalten)" in R00249 nennt genau diesen einen Wert.

Ausgeschlossen: ein Leck oder ein Fehler im Programm (der ruhige Wert liegt deutlich unter der Grenze; die 5.000 Tabellenzeilen und die Leseposition bleiben unter Last grün, 13 px von 36 px erlaubten), eine Nachlässigkeit der Spec (die Messung ist ereignisgenau, ohne Polling-Raster, und wartet auf Farbe und Zustand), und ein Einbruch durch eine spätere Karte (Punkt 2).

### Betroffene Komponenten

- `e2e/tests/r00249-review-nebeneinander.spec.js:601–654` — die Probe „AK 9: K-Last …" (Aufbau, 30 Wiederholungen, `longtask`-Urteil).
- `e2e/playwright.config.js` — nur, wenn die Lastprobe über eine projektweite Auswahl geführt wird (heute `testDir: './tests'`, 4 Worker, `globalSetup: bauen.js`).
- `Anforderungen/R00249-review-seite-ansicht-nebeneinander.md` — genau **eine** Verweiszeile in „Notizen" (Abgrenzung der beiden Anforderungen).
- **Nicht** betroffen: `web/` und `src/` (kein Byte am gemessenen Weg seit B1312), die übrigen Kriterien von R00249, andere Specs. Die Proben `r00248-review-umbrechen.spec.js:528`, `r00217-syntaxfarben.spec.js:365/393` und `r00247-review-wortmarke.spec.js:445` tragen **dieselbe** Klasse (Wanduhr-Grenze 150 ms im Gate) und sind **nicht** Teil dieser Karte — Anmerkung, eigene Karte nach demselben Muster.

## Lösungsvorschlag

### Langfristige Lösung

Option N1 (empfohlen): **das Lastmaß und das Gate trennen.**

- Die **Gate-Probe** behält von AK 9, was lastunabhängig ist und ein Urteil über die Seite gibt: K-Last mit 10.000 geänderten Zeilen → 5.000 Tabellenzeilen, die Leseposition über 30 Wiederholungen (|Δtop| ≤ 36 px), der Zustand der Seite. Sie trägt **kein** Wanduhr-Maß mehr.
- Die **Lastprobe** (`KD_LASTPROBE=1`, eigener, ausdrücklicher Lauf, `--workers=1`, im Kopf der Datei mit Befehl und Bedingung dokumentiert) misst die drei Werte weiter — wie die Lastproben des Projekts (R00206 AK 15, R00204 AK 10: eigener Test, nur ausdrücklich, `--release`, „ruhige Maschine (Last unter 2)", Werte in Ausgabe und Beleg). Sie nennt die Last, schreibt Last und Werte in die Ausgabe und, mit `KD_MESS_AUS`, in eine Datei; bei Last < 2 prüft sie die Grenze 150 ms aus ADR-0042 Q2 unverändert, bei Last ≥ 2 meldet sie „keine Messung: Last < 2 nötig" statt eines stillen Grüns.
- Der Verlust ist benannt und klein: nichts im Gate prüft die 150 ms automatisch. Er wird gedeckt durch den ausdrücklichen Lauf beim Abschluss der Karte (Werte in Bericht und Commit) und dadurch, dass kein Lauf mehr ein Urteil über die Maschine fällt.

### Alternative Ansätze

- **N2 Grenze anheben und im Gate lassen** (200–300 ms): am billigsten, aber das Kriterium urteilt weiter über die Maschine — im vollen Gate fährt die Suite selbst die Last auf etwa 10 bei 8 Kernen (Lehre #168); die Wackler würden seltener, nicht ausgeschlossen, und die in ADR-0042 Q2 entschiedene Grenze wäre still verfehlt. Verworfen.
- **N3 Messung lastunabhängig rechnen** (Verhältnis zu einer Kontrollaufgabe in derselben Seite, oder CPU-Zeit aus einem Profil statt Wanduhr): würde das Maß wirklich von der Maschine lösen, ist aber eine **neue** Grenze ohne Quelle — sie bräuchte einen ADR-Nachtrag des architekt, und die Vorbilder des Projekts führen die Lastprobe stattdessen als eigenen Lauf. Verworfen für diese Karte; als Frage an den architekt notiert (AK 5).
- **N4 Die Seite schneller machen** (Zeichnen weiter zerlegen, mehr `content-visibility`): wäre der richtige Weg, wenn die Seite die Ursache wäre — sie ist es nicht (Punkt 2 und 3 der Ursachenanalyse). Verworfen mangels Beleg; die Grenze bleibt Sache des architekt, nicht des Testumbaus.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Es gibt keinen Unit Test, denn der Fehler liegt in der E2E-Probe selbst (Vorbild R00231, R00252). Die Reproduktion ist die unveränderte Spec auf dem heutigen Stand: `npx playwright test tests/r00249-review-nebeneinander.spec.js -g "AK 9" --workers=1` ist bei Last 2,5–5,8 rot (nachgemessen: 165 ms bei Last 5,78) und bei Last < 2 grün. Vor dem Fix dreimal rot bei Last 2,5–5,8 (AK 1, AK 3).

### Wächter der Gate-Probe

Die Gate-Probe muss rot werden können, ohne Zeitmaß: Mutante m14 aus R00249 (Leseposition wird nicht gehalten, `web/app.js`) macht sie rot — sie ist der Wächter, der den verlorenen Automatismus am wirksamsten ersetzt. `mutanteEinsetzen` nur mit Pfaden unter `/web/…` (Lehre #247), Mutanten in einer Kopie, nie im Worktree.

### Regressionstests

- Die ganze Spec `r00249-review-nebeneinander.spec.js` bleibt grün (AK 1–8, 10 unverändert).
- Alle Tests aller Ebenen sind grün (Gate); kein anderer Wackler wird eingeführt.
- Die Lastprobe wird einmal ausdrücklich bei Last < 2 gefahren und ihre Werte stehen im Beleg (kein Gate).

## Akzeptanzkriterien

### Gate verlässlich, AK 9 weiter gemessen

- [ ] **AK 1 Probe grün unter Last:** Gegeben `main` bei Rechnerlast 2,5–5,8 (fremdes Gate läuft, 8 Kerne), wenn `npx playwright test tests/r00249-review-nebeneinander.spec.js -g "AK 9" --workers=1` läuft, dann ist sie grün, dreimal hintereinander, und im vollen Gate (4 Worker) ist sie grün. Heute rot: 165 ms bei Last 5,78 (diese Karte), 160/162/187 ms im Gate des Directors.
- [ ] **AK 2 Kein Zeitmaß im Gate:** In `e2e/tests/r00249-review-nebeneinander.spec.js` steht außerhalb der Lastprobe weder ein `longtask`-Maß noch eine andere Wanduhr-Grenze; die Gate-Probe prüft weiter 5.000 Tabellenzeilen und die Leseposition (30 Wiederholungen, |Δtop| ≤ 36 px; nachgemessen 13 px bei Last 5,78). Prüfbar am Code der Spec: `langeAufgabenSammeln`/`PerformanceObserver` kommen nur in der Lastprobe vor.
- [ ] **AK 3 Lastprobe misst weiter:** Gegeben `main` bei Last < 2, wenn die Lastprobe ausdrücklich läuft (`KD_LASTPROBE=1 npx playwright test tests/r00249-review-nebeneinander.spec.js -g "AK 9 Lastprobe" --workers=1`), dann nennt ihre Ausgabe die Last, die drei Werte `umschalten`, `scrollen`, `zurueck` in ms und die Zahl der Tabellenzeilen (5.000), und sie ist grün, wenn der größte Wert ≤ 150 ms ist (Grenze unverändert, ADR-0042 Q2; ruhiger Messwert aus R00249: 83 ms bzw. 109–118 ms).
- [ ] **AK 4 Lastbedingung sichtbar, kein stilles Grün:** Die Lastprobe nennt „Last < 2" im Kopf der Datei und in ihrer Ausgabe und liest die Last selbst (`/proc/loadavg`); bei Last ≥ 2 steht in ihrer Ausgabe die Last und der Satz „keine Messung: Last < 2 nötig", und es wird kein Messwert als bestanden gemeldet.
- [ ] **AK 5 Grenze bleibt 150 ms, kein stilles Anheben:** Die Grenze in der Lastprobe ist 150 ms (ADR-0042 Q2) und in R00256 dieselbe Zahl. Liegt der bei Last < 2 gemessene größte Wert über 115 ms (Rechnung: 150 ms ÷ 1,3 — darunter ist der Abstand kleiner als die von `zeitkriterien.md` verlangten 30 %), dann nennt der Durchlauf der Karte Last, Werte und den zu kleinen Abstand unter „Fragen" an den architekt, statt den Wert anzupassen; die Entscheidung über eine neue Grenze (etwa das Verhältnis-Maß aus N3) trifft der architekt per ADR-Nachtrag.
- [ ] **AK 6 Bestand und Abgrenzung:** R00249 bleibt abgenommen und unverändert gültig (AK 9 fordert weiter „kein Long Task über 150 ms"); in ihren „Notizen" steht genau **eine** Verweiszeile auf R00256 und ihre übrigen Kästchen bleiben, wie sie sind. Die Gate-Probe von AK 9 hält die Zusagen dieses Kriteriums unverändert (5.000 Tabellenzeilen, |Δtop| ≤ 36 px bei 30 Wiederholungen) und die übrigen Kriterien von R00249 bleiben unberührt; Mutant m14 (Leseposition nicht gehalten) wird von der Gate-Probe rot getötet.

## Implementierungshinweise

- Nur die Spec `e2e/tests/r00249-review-nebeneinander.spec.js` ändern (und, falls nötig, `e2e/playwright.config.js`), **kein** Code unter `web/` oder `src/`.
- Form der Lastprobe (Empfehlung, Wahl des entwicklers): eigener `test.describe('Lastprobe', …)` mit `test.skip(!process.env.KD_LASTPROBE, 'Lastprobe: nur ausdrücklich (KD_LASTPROBE=1), Last < 2')` **im Beschreibungsrumpf** — dann steht in jedem Gate-Lauf sichtbar „1 skipped" mit Grund, der ausdrückliche Lauf ist ein Aufruf, und der Fixture-Aufbau der Datei (Datei-Repository mit 10.000 Zeilen, kanbanD-Start) läuft für den übersprungenen Fall nicht mit (ein `test.skip` erst im Testkörper ließe den `beforeEach` der Datei laufen). Legt man den Fall stattdessen in eine eigene Datei außerhalb `testDir` mit eigener Config, sieht das Gate ihn gar nicht (stiller); nur mit Begründung im Bericht. Vorbild ist `#[ignore = "Lastprobe: nur ausdrücklich, mit --release"]` der Rust-Lastproben (`tests/lastprobe_r00204.rs`, `tests/lastprobe_r00206.rs`).
- Der Gate-Teil des Falls behält seinen Namen „AK 9: K-Last …" (R00249 AK 9 bleibt zitiert), die Lastprobe bekommt den Zusatz „Lastprobe"; die Verweiszeile in R00249 nennt beide.
- Namen nach `javascript-stil`: `langeAufgabenSammeln` bleibt, neu etwa `lastLesen()` (liest `/proc/loadavg`) und `messungMelden(messung, last)` (Ausgabe, Annotation, `KD_MESS_AUS`).
- Die Zahl der 30 Wiederholungen und der Fixture-Aufbau (K-Last, N4) bleiben unverändert — sie sind der Grund, warum die Probe im Gate bleibt.
- Das Gate läuft nicht neben einem anderen Gate; die Lastprobe ebenso wenig (sie misst sonst die fremde Arbeit).

## Offene Fragen

- Keine, die den Bau aufhält. Die Grenzfrage (Abstand 27 % beim Scrollen, entschieden in AK 5) geht als Messung an den architekt, nicht an den Betreiber — sie ist eine Frage der Grenze, nicht der Richtung.

## Warum löst diese Anforderung das Problem? (Pflicht)

Die Probe ist rot, weil sie die Dauer einer Aufgabe des Hauptfadens in Wanduhr-Zeit misst und diese Dauer wächst, wenn die Maschine beschäftigt ist — im Gate beschäftigt sie das Gate selbst. Wenn das Lastmaß aus dem Gate in einen ausdrücklichen Lauf mit genannter Lastbedingung wandert und das Gate nur noch prüft, was es unabhängig von der Maschine beurteilen kann (5.000 Tabellenzeilen, Leseposition), dann bedeutet ein rotes Gate wieder einen Fehler in der Seite. Die Messung geht nicht verloren: sie bleibt als Lastprobe mit Last und Werten im Beleg, genau wie die Lastproben, die das Projekt für Budget- und Antwortzeitfragen schon führt (R00206 AK 15, R00204 AK 10). Der Hebel ist die Trennung von Urteil und Beobachtung — sie ist an der Probe zu ziehen, nicht an der Seite (kein Rückschritt seit #260) und nicht an der Grenze (die gehört dem architekt, ADR-0042 Q2).

## Notizen

- Priorität: Hoch (Gate auf `main` rot, bremst die Merge-Wache jeder Karte — siehe R00252, dasselbe Muster in derselben Familie von Proben)
- Betroffene Nutzer/Systeme: Factory (Gate, Merge-Wache, #233/#277); Menschen sind nicht betroffen
- Workaround: kein Gate über `main` laufen lassen, während die Maschine Last trägt — praktisch nicht einhaltbar
- **Herkunft der Zahlen:** 160/162 ms (`main`), 187 ms (#233), dreimal von drei rot und „Last 2,5–4,8" stammen aus dem Befund des Directors. Die Läufe A–C (128/110/118 ms Umschalten, 165/156/166 ms Scrollen, 92/65/103 ms Zurück, Leseposition 13/13/0 px) sind die Messung dieser Detailplanung (Kopie des Standes `eaf7c8c1` in der Ablage `plan-278/`, vorgebautes Programm `target-main`, 1 Worker, `nice -n 10`; Protokolle `lauf-last.txt`, `lauf-mittel.txt`, `messung-last.jsonl`, `messung-mittel.jsonl`, Rezept `NACHFAHREN.md`). 83 ms, 109–118 ms und „Last ~1,5" sind die Messung B1312 aus R00249 „Notizen" (übernommen, nicht nachgemessen); ein eigener Lauf bei Last < 2 kam nicht zustande (Last blieb über 50 Minuten zwischen 3,4 und 6,1, Bericht der Detailplanung).
- **Verworfene Alternativen** mit je einem Satz: siehe „Alternative Ansätze" (N2 Anheben: Urteil fiele weiter über die Maschine; N3 Verhältnis-Maß: neue Grenze ohne Quelle; N4 Seite schneller machen: kein Rückschritt belegt).
- `ursprungslauf: R00249`, denn die Probe stammt aus R00249 (I0239, B1312/B1313).
- Nicht Teil: die übrigen Wanduhr-Grenzen im Gate (`r00248-review-umbrechen.spec.js:528`, `r00217-syntaxfarben.spec.js:365/393`, `r00247-review-wortmarke.spec.js:445`) — eigene Karte nach demselben Muster; ein neuer ADR-Nachtrag zur Grenze (architekt); R00249 selbst (bleibt abgenommen, eine Verweiszeile).
- User Story nach dem Bug-Format: `user-stories/R00256.md`.
