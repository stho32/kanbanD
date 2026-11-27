# ADR-0026: E2E-Tests warten auf den Zielzustand statt auf Zeit — fünf Regeln und zwei Hilfen in `e2e/tests/hilfen.js`

**Status**: Vorgeschlagen (Nachträge N1–N6; N4 Regel 11 an eine Probe gebunden; N5 Regel 12 aufgenommen, Karte #280; N5a Klassengrenze, Fundstellen und Suchmuster, Karte #279; N6 dehnt Regel 12 auf die Einheitentests aus, Karte #276; N7 berichtigt die Klassengrenze aus N5a — ein erwarteter Zeitablauf bleibt mit seinem Zustand im Gate, seine Wanduhr-Spanne wird Lastprobe, Karte #283)
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

## Nachtrag 2026-11-15: Rust-Live-Tests warten auf den beobachtenden Wächter (Karte #163)

Schließt die offene Frage zu `tests/live.rs:57`. **Belegt (Code, Ist; nicht gefahren)**: Jede gestartete Programminstanz öffnet zwei inotify-Instanzen (`src/web/mod.rs:48` Ordner, `:135` fremde WBS). Gibt der Kern keine mehr her (Grenze je Benutzer `max_user_instances=128`; auf dem Entwicklungsrechner belegt der Desktop im Leerlauf rund 80), läuft das Programm **ohne** Wächter weiter und meldet das nur mit einer Zeile auf stderr (`src/web/mod.rs:56`, `:140`). Dann kommt nie ein Ereignis — die 3-s-Frist in `gemeinsam::ereignis_abwarten` (`tests/gemeinsam/mod.rs:112`) läuft unabhängig von ihrer Länge ab. Die Grenze gilt über alle Prozesse des Benutzers; die Testdatei selbst braucht parallel höchstens rund 13 Instanzen.

**Regel 7 (sinngemäß Regel 1 und 5 für `tests/*.rs`)**: Ein Test, der ein Live-Ereignis erwartet, löst erst aus, wenn der Wächter nachweislich beobachtet. Bereitzeichen ohne Produktivcode: nach der ersten HTTP-Antwort (der Router und damit der Wächter sind dann gebaut) steht auf dem mitgeschnittenen stderr der Instanz **keine** Zeile „… nicht beobachtet“; direkt gestartete Wächter (`waechter::starten`, `fremde_starten`) liefern `Ok`. Fehlt das Bereitzeichen, wiederholt die Hilfe in `tests/gemeinsam/mod.rs` den Start begrenzt und scheitert danach mit der benannten Ursache (inotify-Grenze der Umgebung), nicht mit „kein passendes Ereignis“. Die 3-s-Frist bleibt und misst danach nur noch das Programm.

**Verworfen**: Tests der Datei serialisieren — senkt den Eigenbedarf von rund 13 auf 2, die Grenze erschöpfen aber fremde Prozesse; längere Frist — ohne Wächter kommt nie ein Ereignis; Wächter in den übrigen Tests abschalten — verlangt einen Schalter im Programm.

**Nicht entschieden**: Dass das Programm den Ausfall des Wächters nur auf stderr meldet (keine Wiederholung, kein Zeichen in API oder Oberfläche), ist ein Betriebsthema und eine eigene Karte; ein Zustandsfeld dort wäre das bessere Bereitzeichen.

**Probe**: vier gleichzeitige Läufe der Testdatei `live`, fünf Runden, 20 von 20 grün; mit dauerhaft belegter Grenze scheitert ein Lauf mit der benannten Ursache.

## Nachtrag 2026-11-22: Geometrie in einem Zug messen (Karte #240)

**Anlass**: `e2e/tests/r00127-kartendetails-tabs.spec.js:356` (Touch, ≥ 44 px) und `:332` (feiner Zeiger, ≥ 24 px) waren in vollen Läufen unter Last einzeln rot, allein grün. Im Gate von #231 maß `:366` die Größe 0 (`Expected: >= 44, Received: 0`, Lauf 402 ms, also nicht langsam).

**Belegt (Code und Probe, ohne Last, 1 Worker)**:

- `locator.evaluate(fn)` ist **kein** Zug. Playwright 1.65.1 löst erst den Knoten auf und wertet danach in einem zweiten Aufruf aus (`_withElement`: `waitForSelector` mit `state: "attached"`, dann `handle.evaluate`). Ersetzt ein Neuzeichnen den Knoten dazwischen, misst `getBoundingClientRect` den ausgehängten Knoten: 0 × 0. Die Annahme in `r00127-kartendetails-tabs.spec.js:60` („in einem Zug in der Seite gelesen“) stimmt daher nicht. `boundingBox()` liefert in dieser Lage `null`.
- Das Neuzeichnen kommt **von der Seite und ist gewollt**. Die Testdaten tragen eine laufende Stoppuhr seit dem 2026-11-11 (`LAEUFT`, `:17`). Der erste Sekundentakt nach dem Laden erkennt sie als vergessen und zeichnet einmal neu (`web/app.js:5302–5325`, `taktVergessen` `:5226`, R00114). Ohne Last fällt dieser Takt hinter die Messung, unter Last mitten hinein.
- Probe (`gemeinsam/scratchpad/arch-240/`, Stand `5236704c`):
  - mit den Testdaten der Spec folgt nach dem Messpunkt 3 von 3 Mal ein weiteres Zeichnen, das den Auslöser ersetzt;
  - mit dem Knoten aus Schritt 1 und erst nach diesem Takt ausgewertet misst die Probe 10 von 10 Mal 0 × 0 (`isConnected: false`);
  - zeichnet die Seite in jedem Frame neu, ist die Zweischritt-Messung 10 von 10 Mal rot (`Received: 0`), die Messung in einem `page.evaluate` 10 von 10 Mal grün;
  - die beiden Specs unverändert, `--repeat-each=20`: 40 von 40 grün.
- Eine verzögerte Antwort (`page.route` auf `/api/aufgaben/1`, `/anhaenge`, CSS, 300–800 ms) stellt den Fehler **nicht** nach. Das Fenster zeichnet erst, wenn beide Antworten da sind.

**Urteil**: Die Ursache liegt im Test, nicht in der Seite. Die Seite zeichnet den Auslöser nie mit Höhe 0, sie ersetzt ihn beim Neuzeichnen (ADR-0007, `#over` über `innerHTML`). Gemessen wird ein Knoten, der nicht mehr im Dokument hängt.

### N3 Regel 8: Geometrie in einem Zug, mit Wiederholung

8. **Lage und Größe werden in einem einzigen Aufruf in der Seite gelesen und unter `expect.poll` geprüft.** Erlaubt ist `page.evaluate(sel => document.querySelector(sel)…getBoundingClientRect(), sel)`, weil Auflösen und Messen dann in derselben Aufgabe der Seite liegen. Fehlt der Knoten, liefert die Lesung `null`, nie 0. Ort: eine Hilfe `masse(page, selektor)` in `e2e/tests/hilfen.js`, die `rechteck` aus `r00127` ablöst. Die Schwelle prüft `await expect.poll(async () => { const m = await masse(page, sel); return m && Math.min(m.width, m.height); }).toBeGreaterThanOrEqual(44)`. `locator.evaluate`, `elementHandle` und `boundingBox()` sind für Maße untersagt. Dasselbe gilt für Lesungen, die an einem ausgehängten Knoten still 0 liefern (`scrollWidth`, `clientHeight`): am Kopf in `r00127:312` wird „einzeilig“ dann leer wahr.

**Verworfen**:

- *Auf das Takt-Zeichnen warten* oder die Stoppuhr aus den Testdaten nehmen: Das bindet die Probe an eine Eigenheit der Daten. Ein Live-Ereignis oder das nächste Zeichnen stößt sie wieder um.
- *Die Seite hält unveränderte Knoten* (Abgleich statt `innerHTML` in `#over`): Das ist Produktivcode gegen die Hausform aus ADR-0007, und es gibt keinen Defekt, den es behebt.
- *Nur `expect.poll` um die heutige `locator.evaluate`*: Das wird grün, behält aber die Lesung, die am ausgehängten Knoten 0 liefert. An den Stellen mit `≤`-Erwartung (`:312`) bliebe die Probe leer wahr.

**Nicht entschieden**: Die übrigen Fundstellen in Specs, die die Karte nicht nennt, werden nicht in einem Zug umgestellt. Das sind 47 Lesungen `locator.evaluate(… getBoundingClientRect …)` in 23 Specs und 89 Aufrufe `boundingBox()`. Sie wackeln nur, wenn zwischen Auflösen und Messen gezeichnet wird. Das betrifft vor allem die Specs mit laufender Stoppuhr: `r00101-kopfzeile`, `r00114-vergessene-timer`, `r00115-kartentext`, `r00117-kopfzeile`, `r00140-navigation`, `r00199-personen-tag-blaettern`. Durchgesetzt wird die Regel wie die übrigen: als Review-Punkt an jeder neu geschriebenen oder angefassten Messung.

**Probe**: In `r00127` misst jede Größenprobe (`:312`, `:320`, `:341`, `:365`, `:371`) über `masse` und `expect.poll`. Abgenommen wird so:

- Eine zusätzliche Variante lässt die Seite in jedem Frame neu zeichnen (`requestAnimationFrame`-Schleife mit `render()`). Sie ist 10 von 10 Mal grün. Mit dem alten `rechteck(locator)` ist sie 10 von 10 Mal rot.
- `:332` und `:356` sind mit `--repeat-each=20 --workers=1` 40 von 40 Mal grün.
- Mutante: `masse` löst über `elementHandle` auf und misst danach. Die Variante wird rot.

## Nachtrag 2026-11-22: Folgearbeit der Ansicht, Antwort vor dem Körper, Halter vor der Navigation (Karte #246)

**Anlass**: Vier Tests waren in Gates unter Last (2026-11-21/22, Last 5,9–7,6) einzeln rot und allein 3 von 3 grün: `tests/transkripte_api.rs` `ak03_wirksamer_schalter`, `e2e/tests/r00124-datums-trenner.spec.js:46` (US-1), `e2e/tests/r00148-zweiter-ausloeser.spec.js:515` (B2 Taste „t“, im Gate von `55108b99` Zeile 535) und `e2e/tests/r00223-ohne-phasen.spec.js:262/285/308` (AK 12/13). Es sind drei verschiedene Ursachen und ein offener Fall. Den Takt einer laufenden Stoppuhr (N3) hat keiner dieser Tests in den Daten, und keiner misst Geometrie über `locator.evaluate`. N3 wirkt hier also nicht mit.

Die Proben liefen ohne Last mit 1 Worker gegen `target/debug/kanbanD` vom Stand `6dcc1b69` (`gemeinsam/scratchpad/arch-246/`).

### r00124 US-1: Lesung vor dem ersten Zeichnen (Regel 1 und 3, keine neue Regel)

- **Belegt (Code)**: Die Seite verbindet die Live-Leitung vor dem ersten Laden (`web/app.js:5329–5330`). `onopen` setzt `data-live="verbunden"` (`:5188`), unabhängig davon, ob `laden()` schon gezeichnet hat. Karten und Trenner der Spalte „Fertig“ entstehen erst mit der Sammelabfrage samt `GET /api/berichte/bewegungen` (`:277–284`, Git-Verlauf, unter Last langsam). Die Spec liest nach `liveBereit` sofort mit `allInnerTexts` (`r00124-datums-trenner.spec.js:49`).
- **Belegt (Probe)**: Mit einem um 1,5 s verzögerten `GET /api/berichte/bewegungen` (`page.route`) ist die heutige Lesung 3 von 3 Mal rot. Das Fehlerbild gleicht dem Gate: `Array []` statt drei Trennern. Die Zusicherung `await expect(trenner(page)).toHaveText([...])` ist mit Verzögerung 3 von 3 Mal grün und ohne Verzögerung ebenfalls 3 von 3 Mal.
- **Urteil**: Die Ursache liegt im Test. Er verletzt Regel 1 (nackte Lesung) und Regel 3 (`liveBereit` allein ist nicht „die Ansicht steht“). Eine neue Regel braucht es nicht. Die Folge-Lesung `evaluateAll` (`:51`) gehört hinter die Zusicherung oder unter `expect.poll`.

### r00223 AK 12/13: Folgearbeit der Ansicht setzt den Klappzustand zurück

- **Belegt (Code)**: Das Fever Chart rechnet nach dem ersten Zeichnen fehlende Tage nach (`fieberNachtragen`, `web/app.js:448–478`). Danach schreibt es den Cache (`POST …/fieber/cache`, ein Commit, dazu ein Live-Ereignis) und zeichnet am Ende neu (`:477`). Dabei ersetzt `render()` die Kinder von `#main` (`hauptbereichErsetzen`, `:2117`). Ein aufgeklapptes `<details>` (`web/ansicht.js:2089`, `:2143`) steht danach wieder zu. Diesen Restfall nimmt ADR-0007 bewusst in Kauf, er ist also gewolltes Programmverhalten und kein Defekt. Der Anker `#main .fb-einst` und `kdTest.gezeichnet()` sind schon vor dem Ende dieser Folgearbeit wahr. `allesAufklappen` (`r00223-ohne-phasen.spec.js:99–106`) klappt deshalb einen Stand auf, den das nächste Zeichnen wieder ersetzt.
- **Belegt (Probe)**:
  - Ohne Verzögerung ersetzt die Seite `#main` nach `bereit()` noch zweimal, nach 50 und 63 ms. Bei „Wie lange noch“ ersetzt sie es in 3 s nie.
  - Mit einem um 1,5 s verzögerten `POST …/fieber/cache` ist `allesAufklappen` rot. Das Fehlerbild gleicht dem Gate: `#main details:not([open])`, erwartet 0, erhalten 1.
- **Urteil**: Die Ursache liegt im Test. Er stellt einen Sichtzustand her, den die Seite beim Neuzeichnen nicht hält, und liest ihn erst in späteren Aufrufen. Die Lücke in diesem ADR: Regel 3 kennt kein Ende der Folgearbeit, und Regel 8 deckt nur die Geometrie ab.

### Rust `ak03_wirksamer_schalter`: Antwort vor dem Körper mit einem Client, der erst schreibt

- **Belegt (Gate-Log)**: Der Lauf panickte an `tests/transkripte_api.rs:110` (`send().await.unwrap()`) mit `hyper::Error(BodyWrite, Os { code: 32, kind: BrokenPipe })` auf `POST /api/aufgaben/2/transkripte`. Das ist der zweite Upload einer Zeile mit `aus` (`:184`, `gross(ZEHN_MB + 1)`).
- **Belegt (Code)**: Der Server antwortet 409, bevor er den Körper liest (`src/web/mod.rs:1351–1357`, ADR-0036 Regel 5). Danach schließt er die Verbindung, ohne den Rest zu lesen.
- **Belegt (Probe, roher Socket, Python)**: Schickt der Client Kopf und Körper ohne Pause, endet sein Schreiben nach rund 1,8 MB von 10 MB mit `BrokenPipe`, 5 von 5 Mal. Die Antwort `HTTP/1.1 409` bleibt danach lesbar, auch nach 0, 50 und 300 ms Pause.
- **Belegt (Lock-Datei)**: hyper 1.12, reqwest 0.12.28.
- **Begründet, nicht geprobt**: reqwest schreibt den ganzen Körper und liest dabei. Ob er die Antwort liefert oder den Schreibfehler, hängt davon ab, was er zuerst bearbeitet. Unter Last kommt der Schreibfehler zuerst. Dieselbe Klasse tragen die 413-Proben `:209` und `:213`, denn der Server liest dort bis zur Grenze und schließt dann.
- **Urteil**: Die Ursache liegt im Test, die Zusage des Servers stimmt. Der Client der Probe passt nicht zu einer Antwort, die vor dem Körper kommt.

### r00148 B2 Taste „t“: eingegrenzt, nicht belegt

- **Belegt (Diagnose von #198, Gate von `55108b99`)**:
  - Der Halter stand 7 ms vor dem Tastendruck.
  - Die Seite nahm den Start auf: `timerStart` war gesetzt, der Server führte einen offenen Zeiteintrag „09:52“, und 17 ms nach dem Tastendruck lud die Seite neu.
  - Playwright meldete für `POST …/timer/start` weder einen Treffer der Route noch ein `request`-Ereignis. Die Anfrage ging also an der Abfangschicht vorbei.
  - Fokus, Fenster und Sperre waren richtig.
- **Vermutung**: `anfragenHalten` (`r00148-zweiter-ausloeser.spec.js:44–58`) registriert die erste Route der Seite erst nach der Navigation. Unter Last greift das Abfangen für eine Anfrage, die Millisekunden später abgeht, noch nicht.
- **Probe ohne Last**: 150 frische Seiten, je erste Route nach dem Laden, Anfrage sofort danach. Keine Anfrage ging vorbei (0 von 150). Bei einer Rate von 1 zu 1000 bis 3300 ist das kein Gegenbeleg, stellt den Fehler aber auch nicht nach.

### N4 Regel 9: Sichtzustand, den die Probe herstellt, wird im selben Zug gelesen

9. **Was die Probe selbst aufklappt, auswählt oder einblendet und was die Seite beim Neuzeichnen nicht hält (ADR-0007, Restfälle wie `<details>`), wird in demselben Aufruf in der Seite hergestellt und gelesen.** Ein Beispiel ist `page.evaluate`, das alle `#main details` öffnet und in derselben Aufgabe Text, Zahl oder `scrollWidth` liest, wenn nötig unter `expect.poll`. Für Text genügt die Kopie: `sichttext` setzt `open` in der geklonten Wurzel. Aufklappen per Klick und spätere Lesung in getrennten Aufrufen sind untersagt, solange die Ansicht noch Folgearbeit hat. Folgearbeit ist zum Beispiel ein Nachtrag, eine Rechnung in Häppchen oder ein Schreiben beim Lesen. Sie macht `kdTest.gezeichnet()` nicht falsch. Ort: `allesAufklappen` und `sichttext` in `r00223-ohne-phasen.spec.js`, als Hilfe nach `e2e/tests/hilfen.js`, sobald eine zweite Spec sie braucht.

### N4 Regel 10: Antwort vor dem Körper mit einem Client prüfen, der sie unabhängig vom Schreiben liest (`tests/*.rs`)

10. **Eine Zusage „Antwort, bevor der Körper gelesen wird“ (409 Erfassung aus, 409 bei 1000 Einträgen) prüft der Test mit einem rohen `std::net::TcpStream`.** Er schickt Kopf, die Felder vor der Datei und höchstens ein erstes Stück, mit `Content-Length` über 10 MB. Dann liest er Statuszeile und JSON mit einer Lesefrist von 5 s. Liest der Server den Körper doch, hängt der Server und der Test scheitert benannt an der Frist. Für 413 schreibt der Client weiter, bis der Server schließt. Einen Schreibfehler (`BrokenPipe`, `ConnectionReset`) zählt er dabei nicht als Ergebnis, danach liest er die Antwort. Ein reqwest-Aufruf mit vollem Körper ist für beide Fälle untersagt. Ort: eine Hilfe in `tests/gemeinsam/mod.rs` oder in `tests/transkripte_api.rs`, benutzt an `:184`, `:209` und `:213`.

### N4 Regel 11 (Vorgeschlagen): Anfragen dort halten, wo die Seite sie absendet

11. **Ein Halter für „die Anfrage läuft“ steht, bevor die Seite lädt, und wird danach nur scharf geschaltet.** Möglich ist das auf zwei Wegen:
    - eine Hülle um `window.fetch` per `page.addInitScript` vor `page.goto`, die zählt und hält;
    - oder `page.route` vor `page.goto`, mit einer Marke `scharf`.

    Neben der Zählung am Halter prüft die Probe den Zustand am Server: genau ein Zeiteintrag bzw. ein Commit. Ort: `anfragenHalten` in `r00148-zweiter-ausloeser.spec.js`. **Vorgeschlagen**, weil die Ursache nicht belegt ist. Das entscheidet die Probe unten.

### Nicht entschieden

- **Kein Produktivcode.** Der Server bleibt bei „409 vor dem Körper“, und die Seite hält `<details>` weiter nicht (ADR-0007).
- **Clients mit vollem Körper**: Ein Client, der ohne `Expect: 100-continue` den ganzen Körper schreibt, sieht statt der 409 womöglich einen Schreibfehler. Das betrifft einen künftigen Upload-Client der Factory. Zur Zusage aus ADR-0036 gehört deshalb der Hinweis „mit `Expect: 100-continue` senden oder beim Schreiben lesen“. Das ist eine Frage an die Beschreibung des Endpunkts und keine Änderung des Servers.

### Durchsetzung

Review-Punkt wie oben:
- ein Klick-Aufklappen mit späterer Lesung in einer Ansicht mit Folgearbeit;
- ein reqwest-Upload mit vollem Körper gegen eine Antwort vor dem Körper;
- ein `page.route`-Halter, der erst nach `page.goto` steht.

### Probe (Abnahme je Ursache)

- **r00124**: Variante mit 1,5 s verzögertem `GET /api/berichte/bewegungen`. Heute ist sie 3 von 3 Mal rot (`Array []`), nach dem Fix 10 von 10 Mal grün. Dazu `r00124-datums-trenner.spec.js` mit `--repeat-each=20 --workers=1` grün.
- **r00223**: Variante mit 1,5 s verzögertem `POST …/fieber/cache` und eine Variante, die in jedem Frame neu zeichnet (wie N3). Beide sind heute rot und nach dem Fix je 10 von 10 Mal grün. Mutante: Aufklappen per Klick und spätere Lesung, die Variante wird rot.
- **ak03 sowie `:209`/`:213`**: Variante mit künstlich langsamem Leser: Der Client schreibt den vollen Körper und liest erst 300 ms nach dem Schreibfehler. Sie ist heute rot, denn der reqwest-Weg liefert den Fehler statt der Antwort, und nach dem Fix 10 von 10 Mal grün. Mutante: Der Server liest den Körper vor der Prüfung, dann scheitert die Probe an der Lesefrist bzw. an 413 statt 409.
- **r00148 (entscheidet Regel 11)**: Der Halter steht vor `page.goto`. Mutante: Der Halter wird erst nach dem Laden angelegt. Die Diagnose aus #198 bleibt. Die Regel wird `Akzeptiert`, wenn das Gate in 10 vollen Läufen mit Last kein Rot an r00148:515 zeigt. Bis dahin gilt die Regel als Vorschlag.

## Nachtrag 2026-11-26: Zeitmaße laufen als Lastprobe mit Lastbedingung, nicht im Gate (Karte #280)

**Anlass**: Die Long-Task-Probe von R00249 AK 9 (`longtask` ≤ 150 ms, ADR-0040 Punkt 6, ADR-0042 Q2) war im vollen Gate auf `main` lastabhängig rot — dreimal von drei bei Rechnerlast 2,5–4,8 (160/162 ms; im Worktree #233 187 ms), während derselbe Stand ruhig (Last ~1,5) beim Scrollen 109–118 ms maß (R00256, #278). `longtask` misst die **Wanduhr-Zeit** des Hauptfadens: verliert der Zeichenprozess unter CPU-Konkurrenz die CPU, wächst die gemessene Dauer, ohne dass die Seite mehr arbeitet (Faktor 1,3–1,5, darüber flach). Ein Zeiturteil im Gate urteilt damit über die Maschine, nicht über die Seite — und die Last stammt im vollen Lauf aus dem Gate selbst (4 Worker treiben diesen Rechner auf etwa 10 bei 8 Kernen, #168). Dieselbe Klasse tragen `r00248:528`, `r00217:365/393` und `r00247:445` (Wanduhr-Grenze 150 ms im Gate).

**Belegt (Code, ausgeliefert)**: R00256 ist auf `main` gebaut und abgenommen (B1362–B1364, `d24a1c37`, `df8379e7`, `3ec65f4e`): die Zeitmessung von AK 9 liegt in einem Beschreibungsrumpf mit `test.skip(!process.env.KD_LASTPROBE, 'Lastprobe: nur ausdrücklich (KD_LASTPROBE=1), Last < 2')` (`e2e/tests/r00249-review-nebeneinander.spec.js:633`), die Last kommt aus `/proc/loadavg`; im Gate erscheint der Fall als `skipped`, das zeitfreie Verhalten (5.000 Tabellenzeilen, Leseposition Δtop ≤ 36 px über 30 Wiederholungen) bleibt im Gate und wird von Mutant m14 getötet (Anker auf dem Kopf der Datei → 56.670 px Versatz). Vorbild auf der Rust-Ebene: `#[ignore = "Lastprobe: nur ausdrücklich, mit --release"]` (`tests/lastprobe_r00206.rs:23`, `-- --ignored`).

### N5 Regel 12: Ein Zeitmaß urteilt nicht im Gate — es läuft als Lastprobe mit genannter Last

12. **Ein Kriterium, das Wanduhr-Zeit misst (`longtask`/`PerformanceObserver`, eine Dauer in ms), steht nicht als Gate-Kriterium in der Suite.** Im Gate bleibt nur das **zeitfreie** Verhalten desselben Kriteriums (Zustand, Anzahl, Position), bewacht durch einen Mutanten. Das Zeitmaß läuft **nur ausdrücklich** (`KD_LASTPROBE=1`) und **nur bei Last < 2** (1-Minuten-Wert aus `/proc/loadavg`); der Lauf nennt Last und Messwerte in der Ausgabe und in der Messdatei. Bei Last ≥ 2 meldet der Lauf „keine Messung: Last < 2 nötig“ statt eines stillen Grüns, und im Gate erscheint der Fall als `skipped` mit dem Grund. Gilt für E2E (`e2e/tests/*.spec.js`) und Rust (`tests/*.rs`). Eine Zeitgrenze, die das Gate selbst trägt, ist ein Befund — auch wenn sie heute grün ist, denn das Gate erzeugt die Last, die sie kippt.

**Nicht entschieden**: Ob eine einzelne Grenze richtig gesetzt ist (die 150 ms aus ADR-0040 Punkt 6 und ADR-0042 Q2), entscheidet sich je Kriterium am Abstand zum ruhigen Messwert (≥ 30 %, `rollen/planer/zeitkriterien.md`) — diese Regel ändert die Grenze nicht, sie nimmt sie nur aus dem Gate. Die drei übrigen Wanduhr-Grenzen im Gate (`r00248:528`, `r00217:365/393`, `r00247:445`) sind nicht Teil dieser Aufnahme, sondern eine eigene Karte (WBS I0246).

### N5a: Klassengrenze, Fundstellen und Suchmuster (Karte #279, 2026-11-26)

Regel 12 ist eng zu lesen — **im Gate bleiben**:

- **Beobachtung ohne Grenze** (kostet kein Rot): `e2e/tests/r00219-ansicht-laeufe.spec.js:954–975` (ADR-0039 N1 Punkt 5), `e2e/tests/r00247-review-wortmarke.spec.js:437–465` (PO Z. 676), `e2e/tests/r00217-syntaxfarben.spec.js:385`.
- **Eine Untergrenze einer Frist** („erst nach 1.000 ms“, `e2e/tests/r00217-syntaxfarben.spec.js:468`): Last erfüllt sie nur besser.
- **Grenzen im Sekundenmaßstab mit Abstand ≥ 30 %** (`tests/akzeptanz_r00204.rs` u. a.) sind eine andere Klasse, nicht Gegenstand von Regel 12.

**Fundstellen, die Regel 12 heute trifft** (Stand main `71345f25`, am Code gelesen): `e2e/tests/r00217-syntaxfarben.spec.js:365` und `:393` (AK 1; Helfer `langeAufgabenBeobachten`/`langeSeit` `:313–337`) und `e2e/tests/r00248-review-umbrechen.spec.js:528` (AK 7) — Vorbild der Abtrennung ist `r00249-review-nebeneinander.spec.js:634–696` (R00256). **Korrektur zum Nachtrag oben**: `r00247:445` ist **keine** Grenze — AK 9 in `r00247-review-wortmarke.spec.js:437–465` ist seit PO Z. 676 eine Messung ohne Grenze; dort ist nichts abzutrennen.

**Zum Finden** (das Muster der Durchsetzung, nicht nur `longtask`): `grep -rn "longtask" e2e/` (4 Specs) und `grep -rn "performance\.now\|Date\.now" e2e/tests e2e/einheit` (acht Specs, zwei Einheitstests). Die dort gefundenen Wanduhr-Grenzen ohne `longtask` (`r00100-bestand.spec.js:482`, `r00123-kartenverlauf.spec.js:279`, `r00221-laufansicht.spec.js:456`, `e2e/einheit/bestand.test.js:146`, `e2e/einheit/lauf-satz.test.js:640`) sind dieselbe Krankheit in kleinerem Maß; ihre Umstellung entscheidet der planer je Karte, sie sind nicht Teil dieser Regel.

### Durchsetzung

Review-Punkt für `code-reviewer` und `architektur-reviewer`: eine Zeitgrenze (`longtask`, eine Dauer in ms) als **Gate**-Kriterium in `e2e/tests/*.spec.js` oder `tests/*.rs` ist ein Befund; sie gehört in einen `KD_LASTPROBE`- bzw. `#[ignore]`-Lauf mit genannter Last.

### Probe (Abnahme)

`KD_LASTPROBE=1 npx playwright test tests/r00249-review-nebeneinander.spec.js -g "AK 9 Lastprobe" --workers=1` bei Last < 2 grün, bei Last ≥ 2 „keine Messung: Last < 2 nötig“; im Gate `1 skipped`. Mutant (m14): Anker der zeitfreien Gate-Probe auf den Kopf der Datei statt auf die oberste Zeile → die Gate-Probe wird rot.

## Nachtrag 2026-11-26: Regel 12 gilt auch für Einheitentests — R00247 AK 9 über den Zähler, die Zeit als Lastprobe (Karte #276)

**Anlass**: `e2e/einheit/wortmarke.test.js:175` (R00247 AK 9) prüft die Linearität der Wortmarke über die Wanduhr: doppelte Zeilenzahl soll ein Zeitverhältnis 1,3–3 ergeben (`:180–182`, `kuerzesteZeit` `:165–173`). Im parallelen `node --test`-Lauf unter Last wurde er rot (Verhältnis 3,16 / 3,5 / 4,2), allein grün. Dieselbe Klasse wie N5, aber N5 nennt nur E2E (`e2e/tests/*.spec.js`) und Rust (`tests/*.rs`); die Einheitentests (`e2e/einheit/*.js`) fehlen dort.

**Belegt (Code, Stand `71345f25`)**:
- Die Messnaht ist vorhanden: `wortMarken(zeilen, zaehler = { vergleiche: 0 })` und `wortMarke(alt, neu, zaehler)` erhöhen `zaehler.vergleiche` je Zeichenvergleich in Präfix- und Suffixschleife (`web/review-uebersicht.js:406`, `:491`, `:516`, `:529`). Für die Entscheidung ändert sich kein Produktivcode.
- Der Test prüft die Vergleiche schon exakt (`assert.strictEqual(vergleiche(doppelt), 2 * vergleiche(einfach))`, `e2e/einheit/wortmarke.test.js:178`); das Wanduhr-Verhältnis steht daneben (`:180–182`). Ein quadratischer Mutant (jedes Zeichen gegen jedes, m12 aus R00247) tötet den Zähler.

**Entscheidung**:
1. **Im Gate entscheidet der Zähler**, nicht die Uhr: doppelte Zeilenzahl ⇒ exakt doppelte Vergleiche. Für eine reine Funktion ist das die härtere, lastfreie Aussage; die Laufzeit folgt der Zahl der Vergleiche, ein Zeitverhältnis misst unter Last die Maschine (Faktor 1,3–1,5, darüber flach).
2. **Das Wanduhr-Verhältnis bleibt Kriterium, aber als Lastprobe** im selben Einheitentest (Node `node:test`: `{ skip: !process.env.KD_LASTPROBE }` an `test`/`describe`, im Gate erscheint der Fall als `skipped`): nur ausdrücklich, nur bei Last < 2 aus `/proc/loadavg`, die Ausgabe nennt Last und beide Zeiten; bei Last ≥ 2 „keine Messung: Last < 2 nötig“ statt stillen Grüns. Das ist Regel 12 (Nachtrag N5, Karte #280, Zweig `karte/280`, Commit `523c32f8`; zum Zeitpunkt dieses Nachtrags dort, nicht auf `main`), hier nur der Geltungsbereich.
3. **Keine neue Messnaht**: der optionale Zähler ist die Naht; die Zeitmessung braucht keine, sie umschließt den Aufruf einer reinen, synchronen Funktion (`process.hrtime.bigint()`).

**Durchsetzung**: Review-Punkt wie N5 — ein Dauermaß in ms als Gate-Kriterium ist auch in `e2e/einheit/*.js` ein Befund; es gehört in einen `KD_LASTPROBE`-Lauf mit genannter Last.

**Probe (Abnahme)**: `node --test e2e/einheit/*.js` unter Last ≥ 6 zehnmal grün (der Zeitfall erscheint als `skipped`); `KD_LASTPROBE=1 node --test e2e/einheit/wortmarke.test.js` bei Last < 2 grün, mit Last und beiden Zeiten in der Ausgabe; Mutant „jedes Zeichen gegen jedes“ → der Zähler-Test wird rot.

## Nachtrag 2026-11-27: Ein Zeitablauf, der das Verhalten ist — der Zustand urteilt im Gate, die Spanne wird Lastprobe (Karte #283)

**Anlass**: Der Release-Workflow v1.0.48 war im Job `pruefen` auf dem GitHub-Runner rot (`.github/workflows/release.yml`, `cargo test`, Run 11:02 UTC, Commit `41f9f45b`): `tests/akzeptanz_r00204.rs:663` `muss2_enkel_haelt_die_pipe` meldete für die Enkel **außerhalb** der Prozessgruppe („setsid", „hält stdout") eine Antwort, die die Spanne `10 s ≤ d ≤ 15 s` verletzt. Die Wiederholung desselben Jobs war grün, lokal (Gate) grün, und keine Karte des Tages hat den Test oder `src/git` berührt (Kartenangabe). Ein roter `pruefen`-Job hält jede Auslieferung auf.

**Der Musterfall ist entschieden; zu weit war die Klassengrenze.** ADR-0032 N3.1 (Gesamtgrenze 10 s ab Eingang, „Beendigung und Antwort brauchen höchstens 5 s", obere Grenze der Antwort 15 s) und die Security-Muss-2-Härtung (`2bbf5074`; `src/git/arbeitsrepo.rs:904–950`: nach normalem Git-Ende `gruppe_toeten` `:943`, danach `bis_zum_ende` `:963` mit derselben Frist) bleiben unverändert richtig — am Programm wird hier nichts entschieden. Zu berichtigen ist die Grenze der Regel: **N5a** nimmt „Grenzen im Sekundenmaßstab mit Abstand ≥ 30 % (`tests/akzeptanz_r00204.rs` u. a.)" vom Gate aus, und **R00261** (B1414, `23514b1b`) hat in derselben Datei die **Leistungsurteile** (`:301` PATCH < 1 s) aus dem Gate genommen, die Frist-Fälle aber mit dem Grund „Zeitablauf wird erwartet, obere Schranke ≥ 3 × Sollwert" ausdrücklich **behalten** (Fundliste AK 6). `muss2` (`:682`, 15 s gegen die 10-s-Frist, das 1,5-Fache) und `ak09` (`:347`, `:372`) erfüllen diesen Abstand nicht; und was unter Fremdlast kippt, ist nicht die Frist, sondern die **Maschine**: die Probe misst vom Absenden bis zur Antwort, Verbindungsannahme, Aufgaben-Zeitplanung und Antwort liegen obendrauf (das volle Gate fährt diesen Rechner allein auf etwa 10, #168).

**Entscheidung (Regel 13).** Ist das **erwartete Verhalten ein Zeitablauf** (die Frist greift), dann:

1. **Im Gate urteilt der Zustand, zeitfrei** — der Status samt **Ursache** (`503` mit `zeitgrenze`, `src/fehler.rs:33`), die **Marke** (der Enkel außerhalb der Gruppe lebt nach der Antwort: die Antwort kam, ohne auf ihn zu warten) und das **Prozessende** (der Enkel in der Gruppe ist nach der Antwort tot). Keine Spanne beurteilt den Ablauf selbst; der Client hält nur eine **Ausbleibe-Frist** (hier 20 s, das Doppelte der Frist, `tests/akzeptanz_r00204.rs:655`), deren Ablauf `0` liefert und den Test benannt rot macht — ein Ausbleibe-Wächter (Regel 5), kein Leistungsurteil.
2. **Die Spanne ist Lastprobe** — die obere Schranke `d ≤ 15 s` (ADR-0032 N3.1) und die Untergrenze `d ≥ 10 s` (N5a) laufen **nur ausdrücklich** (`#[ignore]`) und **nur bei Last < 2** (1-Minuten-Wert aus `/proc/loadavg`), nennen Last und Messwerte und melden bei Last ≥ 2 „keine Messung: Last < 2 nötig". Vorbild: R00261 (`tests/akzeptanz_r00204.rs:305–334`), `tests/lastprobe_r00206.rs:23`.
3. **N5a wird berichtigt**: Nicht der Abstand entscheidet die Klasse, sondern **was die Grenze misst**. Eine **Untergrenze** einer Frist („erst nach n") und der Zustand bleiben im Gate; die **Wanduhr-Spanne** einer Frist geht als Lastprobe. Die Frist-Grenzen in `tests/akzeptanz_r00204.rs` — `muss2` (`:674` `≤ 5 s` für den Enkel in der Gruppe, `:682` `10 s ≤ d ≤ 15 s`), `ak09` (`:347`) und `ak09_gesamtgrenze` (`:372`) — gehören zu dieser Klasse; ihre Zustandsteile (200/503, `!lebt`, Prozess-Zähler) bleiben im Gate.

**Verworfen**: die Spanne im Gate lassen und nur die Frist anheben — verschiebt das Fenster und nimmt dem Gate sein Urteil (Regel 12); die ganze `muss2`-Probe als Lastprobe führen — der Zustand („der Enkel verlängert die Frist nicht") ist zeitfrei prüfbar und gehört ins Gate; den Test löschen — die Zusage aus R00204 Security Muss 2 bliebe unbewacht.

**Nicht entschieden**: ob der beobachtete Bruch die obere Schranke der Spanne traf (dann trägt dieser Nachtrag) oder die Variante **in der Gruppe** `503` statt `200` lieferte, also `gruppe_toeten` `:943` unter Runnerlast nicht griff (dann ist es ein Befund am Programm und eine eigene Karte). Die Kartenangabe („die zweite lief in die Frist … erwartet war 200") und der Code (außerhalb der Gruppe erwartet `:682` `503`) passen nicht zusammen; welcher Bruch vorlag, entscheidet die `befunde`-Zeile des Runner-Logs (`assert!(befunde.is_empty(), "{befunde:#?}")`, `:690`) — vor dem Bau festzustellen, sonst könnte ein Fix die falsche Grenze treffen.

**Durchsetzung**: Review-Punkt wie N5 — eine Wanduhr-**Spanne** um einen erwarteten Zeitablauf (`tests/*.rs`, `e2e/tests/*.spec.js`, `e2e/einheit/*.js`) ist ein Befund; sie gehört in eine Lastprobe mit genannter Last. Der Zustandsteil bleibt im Gate.

**Probe (Abnahme)**: Shim wie `git_skript` (`:264`), der je gehärtetem Git-Aufruf einen Enkel startet; vier Varianten (in der Gruppe, `setsid`, `setsid … 2>/dev/null` hält stdout, `setsid … >/dev/null` hält stderr). Gate-Erwartung **ohne Zeitmaß**: außerhalb → `503` mit `fehler == "zeitgrenze"` und der Enkel lebt danach; in der Gruppe → `200` und der Enkel ist nach der Antwort tot. Heute rot: `muss2` im Release-Runner (v1.0.48). Nach dem Fix: `cargo test --test akzeptanz_r00204` unter Last ≥ 6 zehnmal grün, der Zeitfall erscheint als `ignored`; die Lastprobe bei Last < 2 nennt Last und `d` und prüft `10 s ≤ d ≤ 15 s`. Mutanten am Programm (`src/git/arbeitsrepo.rs`, in einer Kopie des Standes): (M1 „Enkel erbt die Pipe") `bis_zum_ende` `:963` wartet ohne Frist (blockierendes `recv()` statt `recv_timeout`) → die Anfrage hängt bis zum Ende des Enkels, die Ausbleibe-Frist liefert `0`, die Gate-Probe wird rot; (M2) `gruppe_toeten(gruppe)` `:943` entfernt → der Enkel in der Gruppe überlebt, die Gate-Probe „Enkel tot" wird rot.
