# ADR-0026: E2E-Tests warten auf den Zielzustand statt auf Zeit — fünf Regeln und zwei Hilfen in `e2e/tests/hilfen.js`

**Status**: Vorgeschlagen
**Datum**: 2026-11-14
**Entscheider**: Claude (autonom, architekt, Auftrag Betreiber 2026-11-14, Karte #139)
**Kontext-Anforderung**: — (Sammelkarte #139 „E2E-Wackler: Tests warten auf Zustand statt auf Zeit“, ohne WBS-Knoten)
**Erprobt durch**: — (die Regeln sind aus dem Bestand destilliert; die entscheidende Probe — Suite unter Last mehrfach grün — steht aus, siehe „Prüfung“)

## Kontext

Der Release-Workflow auf GitHub (`.github/workflows/release.yml:83`, Runner mit 4 Kernen, jetzt `--workers=2`) scheiterte am 2026-11-14 in drei Läufen an je 1–4 **wechselnden** Specs; lokal ist derselbe Stand grün (1261 Tests in `kanbanD-anmerkungen.md`, Zeile 139). Betroffen waren `e2e/tests/kultur.spec.js:349` (US-6, `expect(zu).toHaveCount(0)` in Zeile 274), `e2e/tests/r00126-alter-in-der-spalte.spec.js:184` (60 s Zusehen, ein Neuzeichnen mehr als erwartet), `e2e/tests/r00105-kostenbericht.spec.js:175/204/269` (Knopf `.bf-fuss .bf-leeren` nicht gefunden) und `e2e/tests/r00145-ansichtsmenue.spec.js:431` (schmale Breiten). Zeitzone scheidet aus (r00105:204 lief lokal 5/5 grün in Ortszeit und mit `TZ=UTC`, `kanbanD-anmerkungen.md`).

Es ist **kein Programmfehler, der an einer Stelle sitzt**, sondern eine Technikfrage der Testhärte: Die Proben lesen, messen oder zählen an einer Stelle, an der der Zielzustand noch nicht stehen muss. Belegt im Code:

- **Die Seite zeichnet über `render()` aus dem Zustand** (`web/app.js:738`, Zähler `S.renders`); ein Laden liefert den Stand asynchron über `laden()`/`dateiLaden()` und zeichnet erst bei Übernahme (ADR-0014). Eine Locator-Zusicherung (`expect(locator)…`) wartet darauf von selbst, eine **nackte Lesung** (`innerText`, `getBoundingClientRect`, `k.lies`, `k.git`) nicht.
- **`setViewportSize` ändert nur die Fenstergröße** — kein Rückgabewert, keine Zusicherung; die Umsetzung ins Layout (und ein `resize`-Hörer, der neu zeichnet) folgt im nächsten Frame. Die Datei `e2e/tests/r00105-preisetikett.spec.js` kennt das schon und hat die Hilfe `breiteSetzen` (`:256–260`, zwei `requestAnimationFrame`), benutzt sie in der betroffenen Probe (US-21, `:186–190`) aber nicht.
- **Ein Drüberlesen der drei genannten Ursachenkandidaten** ergibt: (1) `imFokus` (`e2e/tests/hilfen.js:198–204`) **zeichnet nicht neu** — die `focusin`-Hörer setzen nur `S.ui.fokusKarte`/`S.ui.fokusZeile` (`web/app.js:2043–2048`) bzw. zeigen einen Tooltip ohne `render()` (`tippZeigen`, `web/app.js:1091–1097`); der Verdacht ist damit widerlegt. (2) Datei- und Git-Lesungen ohne Warten sind im Bestand die häufigste Form (siehe unten). (3) Der Renderzähler in r00126: AK 7 zählt `window.kdTest.renders()` (`web/app.js:2906`) über 60 s Wanduhr; die einzige Zeichnung ohne Nutzeraktion ist der Live-Wächter: bleibt die Leitung 40 s still, schließt er und **zeichnet** den getrennten Zustand (`liveGetrennt`, `web/app.js:2862–2865`), die Wiederverbindung lädt nach und meldet es (`web/app.js:2877–2885`). Der Server sendet alle 15 s einen Herzschlag (`src/web/mod.rs:402`, `:413`); still länger als 40 s heißt neu verbinden.

Die Frage der Karte ist damit: **Wie wartet die E2E-Ebene verlässlich auf den Zielzustand — nach einer Aktion (Neuzeichnen), nach `setViewportSize` (Layout), nach einem Dateischreiben (Commit, Watcher), bei Fokus-Hilfen und bei Proben, die bewusst Dauer beobachten?** Ohne eine gemeinsame Antwort fischt jede Probe einzeln (`expect.poll` hier, `waitForTimeout` dort) und wackelt unter Last weiter.

### Qualitätsziele und Szenarien

- **Grünes Gate unter Last**: Ein voller Lauf (`cargo test`, `node --test`, `npx playwright test`) auf einem 4-Kern-Runner mit 2 Workern zeigt **keinen** wechselnden Fremd-Wackler mehr; heute sind es je Lauf 1–4 (Freigabe-Anlass der Karte).
- **Das Lastprofil bleibt gemessen, nicht ausgehöhlt** (Wissen im Auftrag: Änderung in allen offenen Sichten < 1 s, lesend p95 < 200 ms): Warten auf **Zustand** ja, pauschal längere Timeouts nein — eine verlängerte Frist verschiebt nur das Fenster (`gemeinsam/gelerntes.md`, „Timing- und Flake-Fehler am beobachtbaren Urteil festmachen“).
- **Reversibel und klein**: keine neue Infrastruktur, keine zweite Testschicht; höchstens eine Hilfe und ein Regelsatz im vorhandenen Harness `e2e/tests/hilfen.js`.
- **Die Unterscheidung bleibt ehrlich**: Wo der Test ein **echtes** Programmverhalten zeigt (z. B. r00126: Wächter-Neuverbindung), wird das als Programmverhalten benannt und nicht weghärtet.

## Optionen

### Option A: Fünf Regeln und zwei Hilfen im vorhandenen Harness (`e2e/tests/hilfen.js`)

Der Regelsatz wird als Kommentarblock am Kopf von `e2e/tests/hilfen.js` hinterlegt; `breiteSetzen` zieht aus `r00105-preisetikett.spec.js` dorthin und wird exportiert; ein kleiner Helfer `bereit(page, anker)` bündelt „live verbunden **und** die Ansicht steht“. Jede Probe richtet sich an diesen zwei Hilfen und den Regeln aus.

- Vorteile: Minimal (ein Regelsatz, eine verschobene, eine neue Funktion); baut auf Bestand (`liveBereit`, `breiteSetzen`, `expect.poll`-Muster, `kdTest.gezeichnet`) statt auf Neuem; die Stellen werden einzeln, aber nach **einer** Regel geheilt; keine Änderung an Produktivcode; sofort für jede Rolle anwendbar.
- Nachteile: Wirkt nur, wenn die Proben sich daran ausrichten — die Durchsetzung ist ein Review-Punkt, kein Compiler; die vorhandene `waitForTimeout`-Stelle `r00007-live.spec.js:18/28` muss aktiv gezogen werden.

### Option B: Timeouts und Wiederholungen global erhöhen

`playwright.config.js` (`:6–7`) bekommt ein größeres `timeout`, `retries: 1–2` und der Release-Lauf bleibt bei mehr Workern.

- Vorteile: die kleinste Änderung; fängt Ausreißer ohne Probenarbeit.
- Nachteile: **höhlt das Lastprofil aus** — eine Probe, die 8 s auf ein 200-ms-Ziel wartet, ist kein Wächter mehr; `retries` versteckt den Wackler, statt ihn zu reparieren (`gemeinsam/gelerntes.md`: „ein Lauf mit Wacklern ist nicht grün“); die Ursache bleibt und frisst bei jedem echten Rot die Signalstärke.

### Option C: Eine eigene Warteschicht (custom fixture, `waitForNetworkIdle`, globale `expect`-Erweiterung)

Eine neue Hilfsschicht kapselt jede Aktion in „Aktion + Warten auf Ruhe“ (Netz-Idle, Renderzähler-Stillstand) und wird überall dort eingesetzt.

- Vorteile: zentral; kann „Aktion → Ruhe“ vollständig abnehmen.
- Nachteile: **neue Infrastruktur**, die der Auftrag ausschließt; `waitForNetworkIdle` ist selbst lastabhängig und für ein Board mit SSE/Herzschlag ungeeignet; ein Render-Stillstand ist nicht definierbar, solange der Sekundentakt (`web/app.js:2972–2995`) läuft; verdeckt die einzelne Probe, die den Zustand kennt, hinter einer globalen Heuristik.

### Option D: Die genannten Stellen einzeln flicken, ohne gemeinsame Regel

Jede der ~20 bekannten Fundstellen einzeln mit `expect.poll`/`waitFor` versehen.

- Vorteile: keine Konvention, kein Text, nur Codeänderungen.
- Nachteile: Der nächste Wackler derselben Klasse entsteht sofort neu — es fehlt die Regel, an der eine künftige Probe sich ausrichtet; genau dieser Zustand ist der Anlass der Karte.

## Entscheidung

**Gewählt: Option A.** Es gibt **eine** gemeinsame Antwort („auf den Zustand warten“) und **zwei** Hilfen, an denen jede betroffene Stelle sich ausrichtet; die Durchsetzung ist ein kurzer Review-Punkt plus die Probe unter Last. Bewusst in Kauf genommen: Die Regeln sind Prosa und kein Mechanismus — ein Verstoß fällt erst im Review oder im vollen Lauf auf, nicht beim Übersetzen. Das ist der Preis dafür, keine neue Infrastruktur einzuführen, und er ist kleiner als der, den Option B (ausgehöhltes Lastprofil) oder C (neue Heuristik) kostet.

### Regeln

1. **Nackte Lesung nach einer Aktion ist verboten — auf den Zustand warten.** Nach einer schreibenden Aktion wird der Zielzustand über eine Locator-Zusicherung (`expect(locator).toHaveText/…`) oder `await expect.poll(() => …)` geprüft, **nie** mit einer nackten Lesung (`innerText`, `getBoundingClientRect`, `page.evaluate`, `k.lies`, `k.git`). Ort: Kopfkommentar „Warten“ in `e2e/tests/hilfen.js`; Mittel sind `expect`/`expect.poll` (Bestand).
2. **Nach `setViewportSize` erst das Layout stehen lassen, dann messen.** Die Probe setzt die Breite über die Hilfe `breiteSetzen(page, breite, hoehe)` (zwei `requestAnimationFrame`) und misst danach; dasselbe gilt nach dem ersten Sichtbarwerden eines **neu geöffneten** Elements (Dialog, Menü, Tabelle). Ort: die verschobene, exportierte Hilfe `breiteSetzen` in `e2e/tests/hilfen.js` (heute `r00105-preisetikett.spec.js:256–260`).
3. **Die Ansicht steht, bevor gezählt oder gemessen wird.** Vor jeder Messung, Zählung oder einem Vergleich des Renderzählers wartet die Probe `await bereit(page, anker)`: `liveBereit(page)` **und** ein Sichtbarkeitsanker der Ansicht; für den Renderzähler zusätzlich `window.kdTest.gezeichnet()` (`web/app.js:2908`, „kein Laden zwischen Übernahme und Zeichnen“). Ort: neue Hilfe `bereit` in `e2e/tests/hilfen.js`; Vorbild ist `nachDemLaden` in `kultur.spec.js:277–286`.
4. **Nach Dateischreiben auf Commit und Zustand warten.** Ein Dateischreiben (Test, Editor, Agent) wird über `await expect.poll(() => k.lies(rel))` bzw. `k.git(...)` geprüft, nie direkt gelesen; auf ein Live-Ereignis wartet die Probe über `liveBereit` plus Sichtbarkeitsanker, **nie** mit `page.waitForTimeout`. Ort: Regelsatz in `e2e/tests/hilfen.js` (Reader `k.lies`/`k.git`, `:43–45`).
5. **Eine Frist ist nur für das Ausbleiben eines Ereignisses erlaubt; Fokus-Hilfen sind kein Wartemittel.** `waitForTimeout` als Synchronisierung ist untersagt; wo eine Dauer beobachtet wird (z. B. „60 s ohne Neuzeichnen“), wird die Messgrundlage erst nach `bereit()` genommen und die Dauer als ausdrückliche Probe formuliert — bei zeitabhängigen Zusagen mit gestellter Uhr (`page.clock`, wie R00089) statt Wanduhr. `imFokus` (`e2e/tests/hilfen.js:198–204`) misst nur und zeichnet nicht neu (Belege im Kontext) und ist kein Wartemittel. Ort: Kommentar an `imFokus` und im Kopfkommentar „Warten“.

### Was ausdrücklich **nicht** entschieden wird

- **Kein pauschaler Timeout, keine `retries`** (`e2e/playwright.config.js:6–7` bleibt bei `timeout: 30000`; Wiederholungen sind kein Fix).
- **Keine neue Infrastruktur**: keine eigene Fixture-Schicht, kein `waitForNetworkIdle`, keine globale `expect`-Erweiterung.
- **Kein Produktivcode**: ergibt die Prüfung nach der Härtung, dass eine Stelle **echtes** Programmverhalten zeigt (z. B. r00126: Wächter-Neuverbindung), wird das eine eigene Bug-Karte, keine stille Härtung.

### Durchsetzung

- **Review-Punkt für `code-reviewer` und `architektur-reviewer`**: eine nackte Lesung nach einer Aktion, eine Messung direkt nach `setViewportSize` oder ein `waitForTimeout` als Synchronisierung in einem `e2e/tests/*.spec.js` ist ein Befund.
- **Probe unter Last** (siehe unten): die entscheidende Abnahme dieser Konvention ist der grüne Volllauf auf einem 4-Kern-Rechner mit 2 Workern.

## Konsequenzen

- **Positiv:**
  - Eine Antwort für alle betroffenen Stellen; eine künftige Probe richtet sich an zwei Hilfen aus, nicht an zwanzig Vorbildern.
  - Das Lastprofil bleibt gemessen: gewartet wird auf den Zustand (der schnell kommt), nicht auf die Uhr.
  - Keine neue Infrastruktur, kein Produktivcode, keine Änderung an `e2e/playwright.config.js`.
- **Negativ / In Kauf zu nehmen:**
  - Die Regeln sind Prosa; ein Verstoß fällt erst im Review oder im Lauf auf (siehe Entscheidung).
  - `bereit(page, anker)` braucht je Ansicht einen Anker — dieselbe Pflege wie `nachDemLaden` in `kultur.spec.js`; der Anker ist ein Soll, keine Zauberei.
  - Eine Probe, die auf einem **echten** langsamen Zustand besteht, wird durch die Regel nicht schneller — nur ehrlicher (sie schlägt mit sprechender Meldung fehl statt am Timeout).
- **Fallstricke für den Bau:**
  - `breiteSetzen` verschwindet aus `r00105-preisetikett.spec.js` — dort US-21 (`:186–190`) mitziehen, sonst bleibt die betroffene Stelle fleckig.
  - `liveBereit` allein genügt **nicht**: es bestätigt die Leitung, nicht den gezeichneten Stand (r00103) — der Anker aus Regel 3 und `kdTest.gezeichnet()` fehlen sonst.
  - Der `expect.poll`-Intervall bleibt die Vorgabe von Playwright; ein zu enger Intervall treibt die Last hoch, statt zu helfen.

## Prüfung (die Probe, die die Entscheidung trägt)

- **Abnahme-Probe (entscheidet `Akzeptiert`):** Nach dem Ausrichten der vier Release-Blocker an den Regeln — `kultur.spec.js` (US-6), `r00126` (AK 7), `r00105-kostenbericht` (`.bf-fuss .bf-leeren`), `r00145` (US-9) — fährt der **Release-Workflow-Befehl** `npx playwright test --workers=2` auf einem 4-Kern-Rechner dreimal hintereinander **0 failed / 0 flaky**; heute sind es je Lauf 1–4 wechselnde Specs.
- **Isolierte Gegenprobe je Klasse:** je eine der drei Klassen (`setViewportSize`, nackte Datei-/Git-Lesung, Wanduhr-Beobachtung) unter `nice -n 10` und Fremdlast 5×, erwartet je 5/5 grün (heute rot: `r00145` 3/5, `kanbanD-anmerkungen.md`).
- **Ehrlichkeits-Gegenprobe (kein Ausweichen):** Die geheilte r00126-AK-7-Probe misst die Messgrundlage nach `kdTest.gezeichnet()` und mit gestellter Uhr (`page.clock` + `kdTest.herzschlag`, `web/app.js:2910`); **wenn** sie dann noch ein zusätzliches Neuzeichnen zeigt, ist das Programmverhalten (Wächter, `web/app.js:2862–2885`) und wird als Bug-Karte gemeldet, nicht weghärtet.

## Offene Fragen

- **r00126 AK 7: Wächter oder Defekt?** Aus dem Code ist die einzige Zeichnung ohne Nutzeraktion die Wächter-Neuverbindung nach 40 s stiller Leitung (`web/app.js:2862–2885`, `src/web/mod.rs:413`); ob die 40-s-Regel unter CPU-Starvation eines Tabs zu früh greift, entscheidet die Gegenprobe oben. Bis dahin als Programmverhalten **unter Last** geführt, nicht als Defekt.
- **`tests/live.rs:57` (Datei-Watcher):** Der Rust-Test wartet über `gemeinsam::ereignis_abwarten` (`tests/gemeinsam/mod.rs:104–125`) mit einer harten 3-s-Frist auf ein SSE-Ereignis. Das ist **Testinfrastruktur**, nicht der E2E-Harness (`hilfen.js`) — dieselbe Klasse, aber ein anderer Ort; die bestehende Lehre („die Suite single-threaded fahren“, `AI-Team/gelerntes.md`, #142) gilt weiter. Ob die Frist selbst gehoben oder der Test serialisiert wird, gehört in eine eigene Karte.

## Quellen / Bezüge

- Karte #139 „E2E-Wackler: Tests warten auf Zustand statt auf Zeit“ (Sammelkarte, ohne WBS-Knoten); Anlass: drei gescheiterte Release-Läufe am 2026-11-14 (`.github/workflows/release.yml`, `kanbanD-anmerkungen.md`, Zeile 139).
- Bestand, an dem die Regeln sich ausrichten: `e2e/tests/hilfen.js` (`liveBereit` `:96–99`, `imFokus` `:198–204`, Reader `:43–45`), `e2e/tests/r00105-preisetikett.spec.js:256–260` (`breiteSetzen`), `e2e/tests/kultur.spec.js:271–286` (`allesAufklappen`, `nachDemLaden`), `web/app.js:2904–2913` (`kdTest`, `gezeichnet`), `web/app.js:2972–2995` (Sekundentakt).
- Programmverhalten im Kontext: `web/app.js:738` (`render`-Zähler), `web/app.js:2043–2048` und `:1091–1097` (Fokus/Tooltip ohne Neuzeichnen), `web/app.js:2862–2885` und `:2889–2899` (Live-Wächter, Neuverbindung), `src/web/mod.rs:402`/`:413` (Herzschlag 15 s, still > 40 s).
- [ADR-0014](0014-nur-die-neueste-antwort-wird-uebernommen.md) (nur die neueste Antwort wird übernommen — „kein Laden zwischen Übernahme und Zeichnen“, `kdTest.gezeichnet`), [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md) (Neuzeichnen), [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md) (Messprobe über alle Ansichten — Vorbild für „eine Probe je Klasse“), [ADR-0013](0013-deutsche-anzeige-an-der-zeichengrenze.md)/[ADR-0015](0015-meldungen-und-aktionen-ueberstehen-jede-breite.md) (Proben als Hausform).
- `gemeinsam/gelerntes.md`, Abschnitt „Proben“ („Timing- und Flake-Fehler am beobachtbaren Urteil festmachen, nicht an Wartezeiten“; „Konfiguration/Timing nur mit Kontrollpaar“); `Dokumentation/Gelerntes.md` R00089 (`page.clock` statt Warten), R00079 (`git log -1` als Zwischenzustand), R00109 („Warten vor jeder Lesung“), R00050 (Frist unter dem Test-Timeout).
- Bausteine: [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md) (primär — die E2E-Proben der Oberfläche); berührt `e2e/tests/*.spec.js`, `e2e/tests/hilfen.js`; **nicht** betroffen: Produktivcode, `e2e/playwright.config.js`, `src/`, `web/`.

## Nachtrag 2026-11-15: Erwartung und Seite rechnen vom selben Tag (Karte #164)

**Anlass**: Der Release-Workflow war am Sonntag 2026-11-15 rot (Commit `e38f2f9`): `e2e/tests/kultur.spec.js:205` bildet die erwartete Woche aus `tag(1)` (morgen), die Seite steht nach `page.clock.setSystemTime(new Date())` (`:203`) auf heute — sonntags sind das zwei Wochen. Dieselbe Klasse wie Karte #73 und #89 (`0fca756`, „Fieber in Kalendertagen“): eine Erwartung, die still annimmt, dass ein Nachbartag in derselben Woche liegt. Fehler der Probe, nicht des Programms.

**Belegt (Code, Ist)**: Die Uhr des Browsers lässt sich stellen (`page.clock.install({ time })`, `setFixedTime` — Vorbild `e2e/tests/r00122-durchsatz.spec.js:200`, festes Datum samt festen Testdaten). Die Uhr des Servers nicht (`src/uhr.rs:101–108`, `Local::now()`); Server, Knoten und Browser laufen in `Europe/Berlin` (`e2e/tests/hilfen.js:28`, `e2e/playwright.config.js:9`, `.github/workflows/release.yml:79`). Rund 30 Dateien in `e2e/tests/` leiten Testdaten und Erwartungen über eigene Helfer (`tag`, `vorTagen`, `heute`, `gestern`, `morgen`, `vor`) aus der Wanduhr ab; eine Erwartung über eine Kalendergrenze trägt davon heute nur `kultur.spec.js:205–211`.

### N1 Regel 6: Kalendergrenzen

6. **Die Erwartung wird aus demselben Zeitpunkt gerechnet, auf dem die Seite steht — nie aus einem Nachbartag.** Gilt für alles, was an einer Kalendergrenze kippt: Woche (Montag bis Sonntag), Monat, Jahr, Werktag gegen Wochenende. Hängt die Zusage selbst an einer Grenze, stellt die Probe die Uhr des Browsers auf ein **festes** Datum (`page.clock.install({ time })` bzw. `setFixedTime`) und rechnet die Erwartung aus genau diesem Datum; den Grenzfall deckt sie mit festen Daten ab (Sonntag, Montag, Samstag; Monatserster; 31.12./01.01.), nicht durch Warten auf den passenden Wochentag. Testdaten, die der Server gegen seine eigene Uhr prüft (z. B. „Ende nicht in der Zukunft“), bleiben relativ zu heute — dann darf die Zusage nicht davon abhängen, in welcher Woche oder welchem Monat heute liegt.

**Nicht entschieden**: keine stellbare Uhr im Server (Produktivcode, für diese Klasse nicht nötig — Woche und Datumsform rechnet die Oberfläche); kein gemeinsamer Datumshelfer für alle Specs (die rund 30 lokalen Helfer bleiben, bis eine Karte sie anfasst).

**Durchsetzung**: Review-Punkt wie oben — eine Erwartung aus `heute ± n`, die eine Woche, einen Monat oder ein Jahr benennt, ohne gestellte Uhr, ist ein Befund.

**Probe**: `kultur.spec.js` US-4 besteht mit auf Sonntag, Montag und Samstag gestellter Uhr des Browsers; gegen den Stand `e38f2f9` ist die Sonntags-Variante rot.
