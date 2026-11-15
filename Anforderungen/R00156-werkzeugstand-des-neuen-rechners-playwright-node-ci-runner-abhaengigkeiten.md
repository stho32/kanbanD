---
id: R00156
status: In Arbeit
datum: 2026-11-15
---

# R00156: Werkzeugstand des neuen Rechners — Playwright 1.65.1, Node 22, CI-Runner `ubuntu-latest`, Cargo-Abhängigkeiten

## Beschreibung

Seit dem 2026-11-15 läuft die Entwicklung auf einem Rechner mit Ubuntu 26.04, Node 22 und Rust 1.100. Playwright 1.57.0 (`e2e/package.json`) unterstützt Ubuntu 26.04 nicht: der Browser lädt nur mit `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64`, und aus demselben Grund ist die Prüfstufe des Release-Workflows auf `ubuntu-24.04` festgehalten. Die CI baut mit Node 20, das seit April 2026 ohne Unterstützung ist, und der Unit-Befehl `node --test e2e/einheit/` scheitert unter Node 22 (Ordner statt Muster).

Diese Anforderung hebt die Werkzeuge auf den Stand des Rechners, ohne Umweg: Playwright 1.65.1 (Chromium 159 statt 143), Runner `ubuntu-latest`, Node 22, der Unit-Befehl als Muster, die Rust-Abhängigkeiten auf ihrem Minor- und Patch-Stand. Danach läuft derselbe Prüfumfang wie vorher ohne Override. **Am Verhalten des Programms ändert sich nichts.**

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanke „Getestet wird mit `cargo test` (Unit und Integration) und Playwright (E2E gegen das echte Programm)“.

## Geschäftlicher Nutzen

Heute hängt jedes Gate an einer Umgebungsvariable, die in jedem Auftrag genannt werden muss; fehlt sie, ist das Gate rot, ohne dass die Karte einen Fehler hätte (`AI-Team/gelerntes.md`, 2026-11-15, #169). Der Release-Workflow prüft auf einem anderen Betriebssystem und einer anderen Node-Version als der Rechner, auf dem gebaut wird — ein Rot dort lässt sich lokal nicht nachstellen. Mit einem Stand für Rechner und CI entfällt der Override, und ein rotes Gate heißt wieder: die Karte hat einen Fehler.

## Funktionale Anforderungen

Die Arbeit läuft in fester Reihenfolge, jeder Schritt mit eigenem Commit (Entscheidung des product-owner, 2026-11-15) — ein Rot ist damit an seinem Commit zuzuordnen:

1. **Referenzlauf** der drei Testebenen am heutigen Stand, mit Override (kein Commit; Ergebnis im Bericht).
2. **`cargo update`** auf Minor- und Patch-Stände, `Cargo.lock` als eigener Commit, geprüft noch mit Playwright 1.57.
3. **Playwright 1.65.1** als eigener Commit; vorher sind die Änderungshinweise der Versionen 1.58–1.65 und die Node-Mindestversion gegen die Suite geprüft.
4. **Reparaturen** an Tests, die am neuen Chromium scheitern — je Ursache ein eigener Commit, an der Ursache gerichtet, nicht abgeschwächt.
5. **CI-Runner `ubuntu-latest`, Node 22 und der Unit-Befehl** `node --test "e2e/einheit/*.js"` in einem Commit.

Dazu gelten drei Regeln:

- **Paket zurücksetzen statt Programm ändern:** Macht ein einzelnes Paket aus `cargo update` etwas rot, das ohne Eingriff ins Programm nicht zu richten ist, wird nur dieses Paket zurückgesetzt (`cargo update --precise`) und im Bericht genannt; die Karte läuft weiter.
- **Befund am Programm wird eigene Karte:** Sieht das Programm am neuen Chromium wirklich anders aus oder verhält es sich anders, ändert diese Anforderung das Programm nicht. Der Test behält seine Prüfung und wird mit `test.fail()` samt Kartennummer und einem Satz Grund gekennzeichnet — nie `test.skip`, nie eine gelockerte Erwartung, nie eine längere Wartezeit.
- **Unit-Befehl nur, wo er als Anweisung gelesen wird:** ersetzt wird in `README.md:82`, `.github/workflows/release.yml:71` und als Befehlswort in den 12 Protokollzeilen von `Dokumentation/Gelerntes.md`. WBS, ADRs und bestehende Anforderungen bleiben als Geschichte stehen.

## Nicht-funktionale Anforderungen

- **Kein Produktivcode:** `src/`, `web/` und `Cargo.toml` bleiben unverändert.
- **Kein abgeschwächtes Lastprofil (ADR-0026):** `e2e/playwright.config.js` bleibt unverändert (Frist 30000, keine `retries`, `workers: 4`, `timezoneId`, `globalSetup`); in `release.yml` bleiben `TZ: Europe/Berlin` (`:79`) und `--workers=2` (`:83`).
- **Kein neuer Umweg:** kein Override, keine festgehaltene Runner- oder Browser-Version an anderer Stelle.

## Akzeptanzkriterien

Geprüft wird auf dem Zweig der Karte gegen `main`. Suchen laufen mit `git grep` (nur versionierte Dateien, also ohne `e2e/node_modules`).

### Referenzlauf

- [ ] **AK 1:** Gegeben der Stand von `main` mit Playwright 1.57.0 und gesetztem Override, wenn `cargo test`, `node --test "e2e/einheit/*.js"` und die volle Playwright-Suite gelaufen sind, dann nennt der Bericht je Ebene die Zahl bestandener und gescheiterter Tests und den Namen jedes roten oder wackelnden Tests. Der Lauf erzeugt keinen Commit.

### `cargo update`

- [ ] **AK 2:** Gegeben der Commit des `cargo update`, dann ändert er außerhalb von `Dokumentation/` und `Anforderungen/` nur `Cargo.lock`; `git diff main -- Cargo.toml` ist leer.
- [ ] **AK 3:** Die Nachricht dieses Commits nennt die Zahl der aktualisierten Pakete (am 2026-11-15 meldete `cargo update --dry-run` 37, gemessen vom architekt) und das Ergebnis eines `cargo update --dry-run` unmittelbar danach: kein Paket mehr zur Aktualisierung — ausgenommen Pakete, die nach der Regel „Paket zurücksetzen“ mit `cargo update --precise` auf dem alten Stand gehalten sind; jedes davon nennt der Bericht mit Name, Version und dem Test, der rot war. Beispiel: wird nichts zurückgesetzt, meldet der Lauf 0 Pakete; wird `notify` zurückgesetzt, meldet er genau dieses eine. Versionen, die erst nach dem Commit erschienen sind, zählen bei einer späteren Prüfung nicht.
- [ ] **AK 4:** In `Cargo.lock` steht `reqwest` weiter in einer Version 0.12.x und `matchit` in 0.8.4.
- [ ] **AK 5:** Gegeben der Stand nach diesem Commit, noch mit Playwright 1.57.0 und Override, dann sind `cargo test` und `node --test "e2e/einheit/*.js"` grün und die volle Playwright-Suite endet mit 0 failed. Dieser Commit liegt in der Geschichte vor dem Playwright-Commit.

### Playwright 1.65.1

- [ ] **AK 6:** Gegeben der Playwright-Commit, dann steht in `e2e/package.json` `"@playwright/test": "1.65.1"` (fest, ohne `^` oder `~`), `npm ci` in `e2e/` läuft mit der neuen `package-lock.json` durch, `npx playwright --version` nennt 1.65.1, und der Commit ändert außerhalb von `Dokumentation/` und `Anforderungen/` nur `e2e/package.json` und `e2e/package-lock.json`.
- [ ] **AK 7:** Die Nachricht dieses Commits nennt (a) den Wert von `engines.node` aus `@playwright/test` 1.65.1 und dass Node 22 ihn erfüllt, (b) jede Änderung aus den Änderungshinweisen der Versionen 1.58–1.65, die eine in `e2e/` genutzte Schnittstelle trifft, oder „keine“, (c) Quelle und Abrufdatum. Erfüllt Node 22 die Mindestversion nicht, wird das gemeldet und nichts umgangen.
- [ ] **AK 8:** Gegeben eine Shell ohne `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE` (`env -u PLAYWRIGHT_HOST_PLATFORM_OVERRIDE …`), wenn in `e2e/` `npx playwright install chromium` läuft, dann endet es ohne Fehler (heute rot: Playwright 1.57 kennt Ubuntu 26.04 nicht). `git grep -n PLAYWRIGHT_HOST_PLATFORM_OVERRIDE -- .github e2e README.md` ergibt keinen Treffer (heute 0, bleibt 0).

### Reparaturen am neuen Chromium

- [ ] **AK 9:** Gegeben ein Test, der mit Playwright 1.57 grün war und mit 1.65.1 rot ist, weil die Probe an Eigenheiten des alten Browsers hängt, dann ist er an der Ursache gerichtet; je Ursache gibt es genau einen Commit, der außerhalb von `Dokumentation/` und `Anforderungen/` nur Dateien unter `e2e/tests/` ändert und die Ursache in seiner Nachricht nennt. Beispiel: drei rote Tests mit der Ursache „Messung direkt nach `setViewportSize`“ und ein roter Test mit der Ursache „Schreibweise eines Farbwerts“ ergeben zwei Commits. Gibt es kein Rot, gibt es keinen solchen Commit, und der Bericht sagt „kein Fund“.
- [ ] **AK 10:** Keine Probe ist abgeschwächt: `git diff main -- e2e/tests` enthält keine hinzugefügte Zeile mit `test.skip`, `test.fixme`, `waitForTimeout` oder `retries` und keine hinzugefügte oder erhöhte Frist (`timeout`); `git diff main -- e2e/playwright.config.js` ist leer; die Zahl der Playwright-Tests im Schlusslauf ist nicht kleiner als im Referenzlauf.
- [ ] **AK 11:** Gegeben ein Rot an einer Messung nach einem nackten `setViewportSize(`, dann ist die Stelle auf die Hilfe `breiteSetzen` (`e2e/tests/hilfen.js`) umgestellt und trägt keine Frist (ADR-0026, Regel 2).
- [ ] **AK 12:** Gegeben ein Befund am Programm (dieselbe Spec am selben gebauten Programm: Chromium 143 grün, Chromium 159 rot, und der Bericht sagt, was der Nutzer sieht), dann ist die Erwartung des Tests unverändert, der Test trägt `test.fail()` mit der Nummer der Bug-Karte und einem Satz Grund, und der Bericht nennt jede so gekennzeichnete Stelle unter „Karten“. Die Zahl der `test.fail(` unter `e2e/tests/` ist gleich der Zahl dieser gemeldeten Befunde (heute 0). Beispiel: zwei Befunde am Programm ergeben genau zwei `test.fail(`, jede mit Kartennummer.
- [ ] **AK 13:** `git diff main --stat -- src web Cargo.toml` ist leer.

### CI-Runner, Node 22 und Unit-Befehl

- [ ] **AK 14:** `.github/workflows/release.yml:41` lautet `runs-on: ubuntu-latest` ohne Kommentar am Zeilenende; `git grep -n -F -e 'ubuntu-24.04' -e 'node-version: "20"' -- .github e2e README.md` ergibt keinen Treffer (heute zwei: `release.yml:41` und `:53`).
- [ ] **AK 15:** `.github/workflows/release.yml:53` lautet `node-version: "22"`.
- [ ] **AK 16:** `release.yml` hat weiter 186 Zeilen; `git diff main -- .github/workflows/release.yml` zeigt genau drei geänderte Zeilen (41, 53, 71), keine entfallene und keine neue; Zeile 79 enthält `TZ: Europe/Berlin`, Zeile 83 `npx playwright test --workers=2`.
- [ ] **AK 17:** `release.yml:71` und `README.md:82` nennen `node --test "e2e/einheit/*.js"`; `git grep -c -F 'node --test e2e/einheit/' -- README.md .github Dokumentation/Gelerntes.md` ergibt keinen Treffer (heute 14: je einer in `README.md` und `release.yml`, 12 in `Dokumentation/Gelerntes.md`).
- [ ] **AK 18:** In `Dokumentation/Gelerntes.md` ist in den 12 Protokollzeilen nur das Befehlswort ersetzt: `git show main:Dokumentation/Gelerntes.md | sed 's#node --test e2e/einheit/#node --test "e2e/einheit/*.js"#g' | diff - Dokumentation/Gelerntes.md` zeigt nur hinzugekommene Zeilen (`>`), keine entfallene oder geänderte (`<`). Heute zeigt dieselbe Probe 12 Zeilen mit `<`. Die Zeile des Laufs #170 nennt den Grund (Node 22 nimmt für `--test` ein Muster, keinen Ordner), ohne den alten Befehl wörtlich zu wiederholen.
- [ ] **AK 19:** Die Änderungen aus AK 14–17 und die 12 Ersetzungen aus AK 18 stehen in einem Commit. `git diff main --stat -- Dokumentation/ADRs` ist leer; unter `Anforderungen/` ist gegenüber `main` nur `R00156-…` neu bzw. geändert; in `Dokumentation/Planung/kanbanD.md` sind nur die Zeilen von I0143 und B0732–B0738 berührt, dazu höchstens der gerechnete Status ihrer Vorfahren (D0002, A0001).

### Abnahme-Probe der Karte (wörtlich, Suche nach Vorgabe der Architektur eingegrenzt)

- [ ] **AK 20:** Gegeben der Endstand in einer Shell ohne `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE`, lokal ohne Fremdlast (ohne `nice`, kein anderes Gate läuft), wenn `cd e2e && npx playwright install chromium && npx playwright test` dreimal hintereinander läuft, dann endet jeder der drei Läufe mit 0 failed und 0 flaky. Ein Lauf mit einem Rot zählt nicht und beginnt die Reihe neu. Beispiel: grün, rot, grün, grün, grün — erfüllt mit den Läufen 3 bis 5, und der rote Name aus Lauf 2 steht im Bericht.
- [ ] **AK 21:** `cargo test` und `node --test "e2e/einheit/*.js"` sind am Endstand grün; für beide ist die Zahl der Tests nicht kleiner als im Referenzlauf (AK 1; für Playwright steht dasselbe in AK 10).
- [ ] **AK 22:** Der Bericht nennt jeden Test, der in einem Lauf nach dem Playwright-Commit rot war, mit dem Vermerk „auch im Referenzlauf“ oder „neu seit 1.65.1“. Ein Name mit „neu seit 1.65.1“ ist nach AK 9 oder AK 12 behandelt, nicht durch Wiederholen erledigt.
- [ ] **AK 23:** Mit Stellen, die nach AK 12 gekennzeichnet sind, gilt „volle Suite grün ohne Override“ als erfüllt; der Bericht führt sie einzeln auf.
- [ ] **AK 24:** `git log --reverse main..HEAD` zeigt nach den Commits der Planung die Commits des Baus in der Reihenfolge `cargo update` → Playwright 1.65.1 → Reparaturen (keine, eine oder mehrere) → CI-Runner mit Node 22 und Unit-Befehl.
- [ ] **AK 25:** Nach dem Push läuft der Release-Workflow auf `ubuntu-latest` mit Node 22 durch, samt Windows-Bau. **Nachweis durch den Director nach dem Push des Betreibers**; der entwickler erfüllt dieses Kriterium mit AK 14–16 und AK 20–21 und hakt es nicht selbst ab.

## Betroffene Verzeichnisstruktur

```
Cargo.lock                              # Minor- und Patch-Stände
e2e/
├── package.json, package-lock.json     # @playwright/test 1.65.1
└── tests/                              # nur bei Reparaturen, je Ursache ein Commit
.github/workflows/release.yml           # Zeilen 41, 53, 71
README.md                               # Zeile 82
Dokumentation/Gelerntes.md              # Befehlswort in 12 Protokollzeilen, Zeile des Laufs
```

Unverändert: `src/`, `web/`, `Cargo.toml`, `e2e/playwright.config.js`, `Dokumentation/ADRs/`, bestehende Anforderungen, `AI-Team/`.

## Technische Überlegungen

### Optionen (Zuschnitt)

| | A: eine Karte, getrennte Commits in fester Reihenfolge | B: `cargo update` als eigene Karte | C: Override und festgehaltenen Runner behalten |
|---|---|---|---|
| Zuordnung eines Rots | am Commit | an der Karte | entfällt |
| Kosten | eine Gate-Serie | zwei Gate-Serien, nie zwei Gates zugleich | keine, der Umweg bleibt in jedem Auftrag |
| Auftrag des Betreibers | erfüllt | erfüllt, später | verfehlt („keine Workarounds, die nicht nötig sind“) |

**Entscheidung: A** (product-owner, 2026-11-15, `AI-Team/po-entscheidungen.md`, Zeilen zu #170).

### Ablauf (Vorplanung, sieben Bubbles — welche es am Ende werden, entscheidet der Entwickler)

1. **B0732 Referenzlauf** — Stand von `main` mit Override → Zahlen und Namen je Ebene.
2. **B0733 `cargo update`** — `Cargo.lock` → Minor-/Patch-Stand; Prüfung mit Playwright 1.57. *Unklar: Wirkung von 37 Paketen ungemessen.*
3. **B0734 Änderungshinweise 1.58–1.65 und Node-Mindestversion** — gegen die genutzten Schnittstellen.
4. **B0735 Playwright 1.65.1** — `package.json` und Sperrdatei; Browser ohne Override; erster voller Lauf → Liste der roten Tests je Ursache.
5. **B0736 Reparaturen** — je Ursache ein Commit oder `test.fail()` mit Kartennummer. *Unklar: Zahl der Ursachen unbekannt.*
6. **B0737 CI-Runner, Node 22, Unit-Befehl** — ein Commit, 14 Stellen mit dem Unit-Befehl, drei Zeilen in `release.yml`.
7. **B0738 Abnahme-Probe** — drei volle Läufe ohne Override, Abgleich mit dem Referenzlauf.

### Prüfpunkte der Architektur für Chromium 143 → 159

- 121 nackte `setViewportSize(` gegen 22 Aufrufe der Hilfe `breiteSetzen` (`e2e/tests/hilfen.js:134`).
- Farbwerte als Text (`oklch(…)` in `struktur-hilfen.js:153–162`, `r00136-menuekoepfe.spec.js:14–18`, `kontrast.spec.js:204`) hängen an der Schreibweise des Browsers.
- Layoutmaße (`boundingBox`, `getBoundingClientRect`, Scroll- und Client-Maße), Textbreiten über Canvas, `fontFamily`-Vergleiche, `ariaSnapshot` (7 Stellen), CPU-Drossel über CDP (`r00110-neueste-antwort.spec.js:249–250`), `page.clock`, Touch-Emulation, `visualViewport`.

## Tests

Diese Anforderung baut keine neue Funktion; ihr Nachweis ist der unveränderte Prüfumfang auf dem neuen Werkzeugstand.

- **Rot vor dem Bau:** `npx playwright install chromium` ohne Override (AK 8); die Suchen aus AK 14, AK 17 und AK 18 (2, 14 und 12 Treffer).
- **Regression:** `cargo test`, `node --test "e2e/einheit/*.js"`, volle Playwright-Suite — nach dem `cargo update` (AK 5) und am Endstand (AK 20–21).
- **Kein Ausweichen:** AK 10 (keine abgeschwächte Probe), AK 12 (`test.fail()` hält einen Befund am Programm im Gate sichtbar; Playwright meldet den Test, sobald er wieder grün wird).

## Abhängigkeiten

- Abhängig von: ADR-0026 (unverändert); Entscheidungen des product-owner vom 2026-11-15 zu #170; Architektur 2026-11-15 (keine Technikfrage, keine ADR).
- Blockiert: das Entfernen des Hinweises „Rechner seit 2026-11-15“ zum Override aus `AI-Team/factory.md` (Director, nach dem Zusammenführen).
- Nicht Teil: `reqwest` 0.13 (eigener Sprung), Behebung von Befunden am Programm (je eigene Bug-Karte).

## Offene Fragen

- **Kartennummer für `test.fail()`:** Die Bug-Karte legt der Director an, der entwickler braucht ihre Nummer aber schon für die Kennzeichnung (AK 12). Vorgeschlagener Weg: der entwickler meldet den Befund mit Beleg unter „Karten“, der Director legt die Karte an und gibt die Nummer in einer kurzen Nacharbeit zurück. Blockiert den Bau nicht, solange kein Befund am Programm auftritt.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

- Nach dem Push (Betreiber): Release-Lauf auf GitHub ansehen, samt Windows-Bau, der nur im Release-Job läuft (Director, AK 25).
- Danach entfernt der Director den Hinweis „Rechner seit 2026-11-15“ zum Override aus `AI-Team/factory.md`.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die Verlegung auf einen Rechner mit Ubuntu 26.04 und Node 22 am 2026-11-15: Playwright 1.57.0 lädt dort keinen Browser, der Unit-Befehl scheitert, und die CI prüft deshalb auf einem festgehaltenen älteren System mit Node 20. Wird Playwright auf 1.65.1 gehoben (X), kennt es das Betriebssystem des Rechners und des aktuellen Runners, der Browser lädt ohne Override (Y), und Rechner und CI prüfen wieder auf demselben Stand (Z). Der Hebel ist die Playwright-Version und nicht der Override, weil der Override einen Browser für ein anderes System lädt und in jedem Auftrag neu genannt werden muss. Die feste Reihenfolge der Commits sorgt dafür, dass ein Rot seiner Änderung zuzuordnen ist: erst die Rust-Pakete am alten Browser, dann der neue Browser, dann die CI.

## Missing-Docs

- Änderungshinweise von Playwright 1.58–1.65 und die Node-Mindestversion von 1.65.1 sind in der Planung nicht gelesen (Lücke aus der Architektur); sie werden beim Bau geprüft (AK 7).

## Notizen

- **Herkunft:** Karte #170 (Vorrang, Auftrag des Betreibers 2026-11-15: „das System auf den richtigen Stand bringen, keine Workarounds, die nicht nötig sind“).
- **Heimat:** eigene Interaction `I0143` unter D0002 neben I0137 und I0138; CI-Workflow, README und `Cargo.lock` sind eine benannte Abweichung vom Dialog.
- **Keine User Story:** Wartung der Umgebung ohne neuen Nutzer und ohne Nutzerverhalten (wie R00150 und R00151); abgenommen wird über die Proben.
- **Keine Oberfläche, kein Produktivcode;** Labels der Karte: keine.
- **Abnahme-Probe eingegrenzt:** Die Karte verlangt „im Repository steht nirgends mehr `ubuntu-24.04` oder `node-version: "20"`“. Diese Anforderung und die WBS enthalten die Zeichenfolgen selbst; die Suche gilt deshalb für `.github/`, `e2e/` und `README.md` (Vorgabe der Architektur).
- **Unit-Befehl, bewusst stehen gelassen:** WBS, ADRs, bestehende Anforderungen und `AI-Team/gelerntes.md` (nennt eine Datei, keinen Ordner). Die Rollendateien unter `AI-Team/` hat der Director schon umgestellt.
- **Hinweise für den Bau:** volle Suite nur ohne `nice` und ohne paralleles Gate; `tests/live.rs` ist lastempfindlich, ein Rot dort einzeln nachfahren; für den Beleg nach AK 12 dieselbe Spec mit Playwright 1.57 (Override) in einer Kopie des Standes in der Ablage gegen dasselbe gebaute Programm fahren.
- **Umfang:** I0143: 7 Bubbles · 5 klar (Richtwert, ungemessen) · 2 unklar (B0733 Bandbreite 0,5–2 h, B0736 Bandbreite 0,5–4 h); Summe der Spannen 3,5–11 h, Hypothese.
- **Verworfene Alternativen:** B (zwei Karten) — zwei Gate-Serien ohne mehr Trennschärfe; C (Override behalten) — widerspricht dem Auftrag.
