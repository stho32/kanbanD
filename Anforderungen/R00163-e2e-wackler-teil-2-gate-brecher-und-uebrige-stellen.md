---
id: R00163
status: In Arbeit
datum: 2026-11-15
---

# R00163: E2E-Wackler Teil 2 — erst die Gate-Brecher, dann die übrigen Stellen nach ADR-0026

## Beschreibung

Folgekarte #162 aus #139 (R00150). Einzelne E2E-Proben messen, lesen oder urteilen, bevor der Zielzustand steht, und machen unter Last wechselnd das Gate rot. Diese Anforderung richtet sie an den fünf Regeln und den Hilfen von ADR-0026 aus (`breiteSetzen`, `bereit`, `filterSchalten` in `e2e/tests/hilfen.js`, `expect.poll`). **Am Verhalten des Programms ändert sich nichts; geändert wird nur `e2e/tests/`.**

Zwei Blöcke, je eine Interaction. **Block 1 wird zuerst gebaut und für sich ausgeliefert**, weil seine Stellen am 2026-11-15 abends sechs Gates zum Glücksspiel gemacht haben (jede Karte kostete einen zweiten vollen Lauf).

**Block 1 — Gate-Brecher (I0150), sieben Stellen in fünf Dateien.** Zeilen am Stand `502f51b`; Ursachen am Code gelesen, nicht gefahren.

| Stelle (Test) | Vermutete Ursache |
|---|---|
| `r00124-datums-trenner.spec.js:150` | `:155` misst das Querscrollen unmittelbar nach `setViewportSize` (`:154`), ohne das Layout abzuwarten |
| `r00127-kartendetails-tabs.spec.js:302` | `:310`–`:314` messen Kopf und Seite direkt nach `setViewportSize` (`:308`); `:316` nimmt `boundingBox()` des Menüs direkt nach dem Klick |
| `r00127-kartendetails-tabs.spec.js:328` und `:348` | `boundingBox()` des Auslösers (`:333`, `:353`) gleich nach dem Öffnen des Fensters; ein Neuzeichnen nach dem PATCH des `beforeEach` kann den Knoten ersetzen (null) |
| `r00115-kartentext.spec.js:130` | `:135` `setViewportSize`, `:136` wartet auf ein schon vorhandenes Element, `:140` misst — kein Layout abgewartet |
| `kultur.spec.js:234` | `:261`–`:263` nehmen das Maß des Diagramms und bewegen den Zeiger einmal, ohne dass der Bericht steht; ein Neuzeichnen danach nimmt die Blase mit |
| `r00114-vergessene-timer.spec.js:191` | Beginn `vor(47 * 60 + 59)` (`:198`), auf die Minute gekürzt: bis `:207` liest, ist der Timer bis zu 59 s plus Laufzeit älter und kippt unter Last auf 48 Stunden |
| `r00119-kopfzeichen-tooltip.spec.js:220` | die zweite Seite schließt (`:234`) sofort nach Enter; das Live-Ereignis trifft die erste Seite zu unbestimmter Zeit um die Zusicherungen `:235`–`:237` |

**Block 2 — übrige Stellen (I0151)**, die Liste der Karte, Zeilen geprüft: nackte Datei- oder Git-Lesung nach einer Aktion in `r00047-termine:65`, `r00014-timer:42`/`:43` (Test `:30`), `r00078-fieber:119`, den Tests `r00058-phasen-spalten:70` und `r00057-wirkungen:61`; `waitForTimeout` in `r00007-live:18`/`:28`; Filterklicks ohne `filterSchalten` in `r00044-burndown:32`–`:35`, `r00045-durchlaufzeit`, `r00081-berichtsfilter-am-board`, `r00105-kostenbericht`, `r00122-durchsatz`; von #139 schon berührt und nur zu prüfen: `r00105-preisetikett` US-21 (`:183`), `r00105-kostenbericht:231`, `kultur.spec.js` US-6 (`:382`, in der Karte `:346`).

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanke „Getestet wird mit `cargo test` (Unit und Integration) und Playwright (E2E gegen das echte Programm)“.

## Akzeptanzkriterien

### Block 1 — Gate-Brecher (I0150)

- [ ] **AK 1:** Die sieben Tests, mit `--repeat-each=30 --workers=2` gefahren (Datei:Zeile am Stand nach dem Bau, 210 Läufe): 0 failed, 0 flaky.
- [ ] **AK 2:** Ein voller Lauf `npx playwright test --workers=2`: 0 failed. Allein gefahren, ohne `nice`, kein anderes Gate.
- [ ] **AK 3:** Der Commit nennt je Stelle die Ursache. Weicht die gefundene von der vermuteten ab, steht die gefundene dort.
- [ ] **AK 4:** `git diff --stat` des Baus zeigt nur `e2e/tests/`. Keine Erwartung ist abgeschwächt oder entfernt, `e2e/playwright.config.js` ist unverändert (kein Timeout erhöht, keine `retries`), und `grep -c waitForTimeout` über `e2e/tests/*.spec.js` ergibt in der Summe höchstens 25 wie heute.

### Block 2 — übrige Stellen (I0151)

- [x] **AK 5:** In den genannten Tests steht nach einer Aktion keine nackte Lesung `expect(k.lies(…))` oder `expect(k.git(…))` mehr; dieselbe Erwartung steht in `expect.poll`.
- [x] **AK 6:** `r00007-live.spec.js` enthält kein `waitForTimeout`.
- [x] **AK 7:** In den fünf genannten Dateien läuft jeder Filterklick, auf den ein Tippen oder eine Lesung folgt, über `filterSchalten`. Bleibt ein Klick, weil sein Zwischenzustand die Probe ist, nennt ihn der Commit.
- [x] **AK 8:** Die drei von #139 berührten Stellen sind ausgerichtet, oder der Commit nennt je Stelle „schon ausgerichtet“ mit Fundstelle.
- [ ] **AK 9:** Jede geänderte Datei einzeln unter Last mit `--repeat-each=10` grün (Last wie bei R00150: `--workers=1`, `nice -n 19`, paralleler `cargo build`); je Stelle die Ursache im Commit; die Schranken aus AK 4 gelten weiter.
- [ ] **AK 10:** Abnahme-Probe der Karte, wörtlich: „`npx playwright test --workers=2` dreimal hintereinander mit 0 failed und 0 flaky“. Rund 35 Minuten; **der Director fährt sie** am Kartenende, allein und ohne `nice`.

## Nicht hinein

- Produktivcode (`src/`, `web/`), `e2e/playwright.config.js`, neue Hilfen oder eine Warteschicht. Zeigt eine Stelle nach dem Ausrichten Programmverhalten, meldet der entwickler das; es wird eine eigene Karte.
- Die 23 weiteren `waitForTimeout` in 15 Dateien und die rund 200 weiteren nackten Lesungen (gezählt mit grep) — nur, was ein Wiederholungslauf dieser Karte rot zeigt.
- Rot unter Rechnerlast 17 (Kommentar vom 2026-11-15, Live-Ereignis in kurzer Frist): Frage des Betriebs („nie zwei Gates zugleich“) und der Karte #163, nicht dieser Karte.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: am 2026-11-15 war `r00124-datums-trenner:150` in zwei vollen Läufen rot und einzeln in 3 von 4, 1 von 6 und 1 von 33 Läufen, die übrigen sechs Stellen je ein- bis zweimal im vollen Lauf — unabhängig von der gebauten Karte. Wartet jede dieser Proben auf ihren Zielzustand statt auf den Zufall der Reihenfolge (X), gibt es das Fenster nicht mehr, in dem die Messung vor dem Layout, dem Zeichnen oder dem fremden Ereignis liegt (Y); ein rotes Gate heißt dann wieder „die Karte hat etwas gebrochen“, und der zweite volle Lauf je Karte entfällt (Z). Block 1 zuerst, weil er die beobachteten Ausfälle trägt; Block 2 räumt dieselben Klassen dort ab, wo sie bisher nur bewertet sind.

## Notizen

- **Herkunft:** Karte #162 (hier geht #152 auf); Technik: ADR-0026 Regeln 1–5, unverändert (Regel 7 betrifft Rust, Karte #163). WBS: I0150 (B0775–B0778) und I0151 (B0779–B0783) unter D0002 neben I0137.
- **Keine User Story:** Testcode ohne Nutzerverhalten (wie R00150, R00160); abgenommen wird über AK 1–10. Keine Oberfläche; Labels `wackler`, `test`.
- **Schnitt nach Ursache:** Messung direkt nach Größenänderung · Geometrie vor dem Zeichnen · Warten auf Zeit statt Zustand — je Klasse eine Bubble, dazu je Block die Abnahme-Probe.
- **Probe zuerst** (`AI-Team/factory.md`, „Schlank arbeiten“ A): Für `r00114:191` und `r00119:220` ist die Ursache am wenigsten sicher; der entwickler nimmt zuerst die scheiternde Zeile aus einem Wiederholungslauf und baut dann.
- **Umfang:** I0150 4 Bubbles, Summe der Spannen 3–6 h; I0151 5 Bubbles, 3,5–7 h (Hypothese, ungemessen). Die Dauer von AK 1 (unter zehn Minuten) ist eine Hypothese.
