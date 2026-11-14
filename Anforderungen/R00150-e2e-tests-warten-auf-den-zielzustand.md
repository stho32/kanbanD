---
id: R00150
status: Neu
datum: 2026-11-14
---

# R00150: E2E-Tests warten auf den Zielzustand statt auf Zeit

## Beschreibung

Die vier E2E-Proben, an denen der Release-Workflow auf GitHub am 2026-11-14 in drei Läufen an je 1–4 wechselnden Specs scheiterte, lesen, messen oder zählen an einer Stelle, an der der Zielzustand noch nicht stehen muss. Diese Anforderung richtet sie an den fünf Regeln und zwei Hilfen aus, die ADR-0026 entschieden hat: eine Probe wartet auf den Zustand (Locator-Zusicherung oder `expect.poll`), lässt nach `setViewportSize` erst das Layout stehen, nimmt ihre Messgrundlage erst nach `bereit(page, anker)`, wartet nach einem Dateischreiben auf Commit und Zustand und formuliert eine beobachtete Dauer als ausdrückliche Probe mit gestellter Uhr.

Das gemessene Lastprofil bleibt dabei unangetastet: keine Erwartung wird abgeschwächt, kein Timeout pauschal erhöht, `retries` bleiben aus. Betroffen sind vier Stellen: `e2e/tests/kultur.spec.js` (US-6), `e2e/tests/r00126-alter-in-der-spalte.spec.js` (US-5/AK 7), `e2e/tests/r00105-kostenbericht.spec.js` (US-18/S2/S6/US-25) und `e2e/tests/r00145-ansichtsmenue.spec.js` (US-9); ihr gemeinsames Mittel sind die beiden Hilfen in `e2e/tests/hilfen.js` — die verschobene `breiteSetzen(page, breite, hoehe)` und die neue `bereit(page, anker)`.

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanke „Getestet wird mit `cargo test` (Unit und Integration) und Playwright (E2E gegen das echte Programm)“.

### Domänenbezug
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Geschäftlicher Nutzen

Der Release-Workflow ist blockiert: dieselben vier Specs scheiterten in drei Läufen hintereinander, lokal ist der Stand grün. Ein Gate, das unter Last 1–4 wechselnde Fremd-Wackler zeigt, ist kein Gate — jeder Lauf muss nachgefahren und bewertet werden, und ein echtes Rot geht im Rauschen unter (`gemeinsam/gelerntes.md`, „Wacklige E2E-Tests …“). Die Ursache liegt nicht am Programm, sondern an der Messgrundlage der Proben: sie lesen, messen oder zählen, während die Ansicht noch zeichnet. Wer die vier Stellen an einer gemeinsamen Regel ausrichtet, bekommt ein Gate, das den Zielzustand abwartet statt die Uhr — die Probe wird nicht schlaffer, sondern ehrlicher: sie fällt mit sprechender Meldung, statt am Timeout zu hängen.

## Funktionale Anforderungen

### Regeln und Hilfen (ADR-0026)

1. **Nackte Lesung nach einer Aktion ist verboten.** Nach einer schreibenden Aktion prüft die Probe den Zielzustand über eine Locator-Zusicherung (`expect(locator).toHaveText/…`) oder `await expect.poll(() => …)`, nie mit `innerText`, `getBoundingClientRect`, `page.evaluate`, `k.lies` oder `k.git`.
2. **Nach `setViewportSize` erst das Layout.** Die Probe setzt die Breite über `breiteSetzen(page, breite, hoehe)` (zwei `requestAnimationFrame`) und misst danach; dasselbe gilt nach dem ersten Sichtbarwerden eines neu geöffneten Elements.
3. **Die Ansicht steht, bevor gezählt oder gemessen wird.** Vor jeder Messung wartet die Probe `bereit(page, anker)` — `liveBereit(page)` und ein Sichtbarkeitsanker der Ansicht; für den Renderzähler zusätzlich `window.kdTest.gezeichnet()`.
4. **Nach Dateischreiben auf Commit und Zustand warten.** Gelesen wird über `await expect.poll(() => k.lies(rel))` bzw. `k.git(...)`; auf ein Live-Ereignis wartet die Probe über `liveBereit` plus Anker, nie mit `page.waitForTimeout`.
5. **Eine Frist ist nur für das Ausbleiben eines Ereignisses erlaubt.** Wo eine Dauer beobachtet wird, wird die Messgrundlage erst nach `bereit()` genommen und die Dauer als ausdrückliche Probe mit gestellter Uhr (`page.clock`) formuliert, nicht als Wanduhr.

Die zwei Hilfen stehen in `e2e/tests/hilfen.js`: `breiteSetzen` (aus `e2e/tests/r00105-preisetikett.spec.js` verschoben, exportiert) und `bereit(page, anker)`. Der Regelsatz steht als Kommentarblock am Kopf von `e2e/tests/hilfen.js`.

### Die vier Release-Blocker

6. **`kultur.spec.js` US-6:** das Aufklappen wartet erst den fertigen Bericht ab (`nachDemLaden`/Berichtstitel) und klappt dann je Schritt auf den Zustand; die feste 20-Schritt-Schleife, die `zu.count()` während des Zeichnens liest, entfällt.
7. **`r00126-…spec.js` US-5/AK 7:** die Messgrundlage (`window.kdTest.renders()`) wird erst nach `bereit`/`kdTest.gezeichnet()` genommen, die beobachtete Dauer mit `page.clock` gestellt statt als Wanduhr.
8. **`r00105-kostenbericht.spec.js` US-18/S2/S6/US-25:** Klick und Attribut auf `.bf-fuss .bf-leeren` warten den geladenen Bericht ab (Anker `1 aktiv`/Berichtstitel) statt unmittelbar nach `goto` + `filterOeffnen` zu greifen.
9. **`r00145-ansichtsmenue.spec.js` US-9:** `kopfMessen` misst erst nach `breiteSetzen`, nicht direkt nach `setViewportSize`.

## Nicht-funktionale Anforderungen

- **Kein abgeschwächtes Lastprofil:** keine Erwartung wird abgeschwächt, kein Timeout pauschal erhöht, `retries` bleiben aus; `e2e/playwright.config.js` bleibt unverändert.
- **Kein Produktivcode:** diese Anforderung ändert nur `e2e/tests/*`. Zeigt die Gegenprobe der r00126-Probe echtes Programmverhalten (ein zusätzliches Neuzeichnen des Live-Wächters), wird das als Bug-Karte gemeldet und **nicht** weghärtet.
- **Keine neue Infrastruktur:** keine Fixture-Schicht, kein `waitForNetworkIdle`, keine globale `expect`-Erweiterung.

## Akzeptanzkriterien

### Regeln und Hilfen

- [ ] Gegeben `e2e/tests/hilfen.js`, wenn `bereit(page, anker)` und `breiteSetzen(page, breite, hoehe)` aufgerufen werden, dann bestätigt `bereit` die Live-Verbindung, wartet den Anker und für den Renderzähler `kdTest.gezeichnet()`, und `breiteSetzen` wartet zwei `requestAnimationFrame`; beide sind exportiert.
- [ ] Gegeben `r00105-preisetikett.spec.js` US-21, wenn die verschobene `breiteSetzen` genutzt wird, dann ist dessen lokale Fassung entfernt und die Probe bleibt grün.

### Die vier Release-Blocker

- [ ] Gegeben ein Bericht mit zugeklappten `<details>`, wenn der Bericht noch zeichnet, dann wartet das Aufklappen den fertigen Bericht ab, und `expect(zu).toHaveCount(0)` beweist, dass kein `<details>` zu bleibt; die feste 20-Schritt-Schleife entfällt.
- [ ] Gegeben 60 s stille Leitung, wenn die Probe den Renderzähler liest, dann ist die Messgrundlage nach `bereit`/`gezeichnet()` genommen und die Dauer mit `page.clock` gestellt; zeigt sie ein zusätzliches Neuzeichnen, ist die Probe rot und der Befund ein Bug.
- [ ] Gegeben `#/berichte/prognose` mit gespeichertem Filter, wenn `filterOeffnen` gelaufen ist, dann wartet der Klick auf `.bf-fuss .bf-leeren` den Anker `1 aktiv` ab und läuft nicht in die Zeitgrenze.
- [ ] Gegeben 320/375/414 px über `breiteSetzen` gesetzt, wenn `kopfMessen` läuft, dann stimmen Kopfhöhe, gemeinsame Oberkante und Querschnitt.

### Abnahme-Probe der Karte (wörtlich)

- [ ] Gegeben der Stand nach dieser Anforderung auf vier Kernen, wenn `npx playwright test --workers=2` dreimal hintereinander läuft, dann 0 failed und 0 flaky.
- [ ] Gegeben jede der vier Spec-Dateien einzeln unter Last (`--workers=1`, `nice -n 19`, paralleler `cargo build`), wenn sie mit `--repeat-each=10` läuft, dann grün.
- [ ] Je Stelle ist die Ursache im Commit benannt.

## Betroffene Verzeichnisstruktur

```
e2e/
└── tests/
    ├── hilfen.js                       # Regelsatz; breiteSetzen (verschoben), bereit (neu)
    ├── r00105-preisetikett.spec.js     # US-21 nutzt die verschobene breiteSetzen
    ├── kultur.spec.js                  # Aufklappen wartet den fertigen Bericht ab
    ├── r00126-alter-in-der-spalte.spec.js
    ├── r00105-kostenbericht.spec.js
    └── r00145-ansichtsmenue.spec.js
Dokumentation/
└── ADRs/0026-warten-auf-zustand-statt-zeit-in-e2e-tests.md   # die fünf Regeln und zwei Hilfen
```

## Technische Überlegungen

### Optionen

| | A: fünf Regeln und zwei Hilfen im Harness | B: Timeouts und `retries` global erhöhen | C: eine eigene Warteschicht | D: jede Stelle einzeln |
|---|---|---|---|---|
| Lastprofil | bleibt gemessen | wird ausgehöhlt | verdeckt die Probe hinter einer Heuristik | bleibt, aber ohne Regel |
| Aufwand / Risiko | klein, reversibel | kleinste Änderung, versteckte Wackler | neue Infrastruktur, `waitForNetworkIdle` lastabhängig | ~20 Einzelflicken, nächster Wackler sofort neu |
| Durchsetzung | Review-Punkt | keine | global | keine |

**Entscheidung: A** (ADR-0026, „Entscheidung“). Die Umsetzung folgt der Entscheidung des Architekten unverändert; die Anforderung ist ihre Heimat, nicht eine neue Technikfrage.

### Ablauf

1. **Hilfen zuerst** (`e2e/tests/hilfen.js`): `breiteSetzen` aus `r00105-preisetikett.spec.js:256–260` verschieben und exportieren, `bereit(page, anker)` ergänzen, den Regelsatz als Kopfkommentar schreiben; `r00105-preisetikett.spec.js` US-21 (`:186–190`) mitziehen (ADR-0026, Fallstrick 1).
2. **Die vier Stellen** an den Regeln ausrichten: `kultur.spec.js` (`:252–254`, `:271–286`), `r00126-…spec.js` (`:184–193`), `r00105-kostenbericht.spec.js` (`:175`, `:204`, `:231`, `:269`), `r00145-ansichtsmenue.spec.js` (`:431`).
3. **Gegenprobe r00126** (Regel 5, ADR-0026 „Ehrlichkeits-Gegenprobe“): `kdTest.gezeichnet()` + `page.clock`; ein verbleibendes Neuzeichnen ist Programmverhalten und wird als Bug-Karte gemeldet.

### Grobentwurf (die Hilfen und die geänderten Proben)

**Wichtige Einstiegsstellen:** `e2e/tests/hilfen.js` ist das gemeinsame Harness aller Suiten; die zwei Hilfen sind sein einziger neuer Schnitt.

- `breiteSetzen(page, breite, hoehe)` (verschobene Hilfe) — setzt `page.setViewportSize` und wartet zwei `requestAnimationFrame` lang, bis der `resize`-Hörer neu gezeichnet und das Layout gerechnet hat.
- `bereit(page, anker)` (neue Hilfe) — `liveBereit(page)` **und** ein Sichtbarkeitsanker der Ansicht; für den Renderzähler zusätzlich `window.kdTest.gezeichnet()`.

**Änderungen an bestehenden Dateien:** `r00105-preisetikett.spec.js` (lokale `breiteSetzen` entfällt, US-21 nutzt die verschobene), `kultur.spec.js` (Aufklappen wartet den Zustand ab), `r00126-alter-in-der-spalte.spec.js` (Messgrundlage und gestellte Uhr), `r00105-kostenbericht.spec.js` (`.bf-fuss .bf-leeren` nach dem Zielzustand), `r00145-ansichtsmenue.spec.js` (`kopfMessen` nach `breiteSetzen`).

### Wächter

`e2e/tests/kultur.spec.js`, `e2e/tests/r00126-alter-in-der-spalte.spec.js`, `e2e/tests/r00105-kostenbericht.spec.js`, `e2e/tests/r00145-ansichtsmenue.spec.js`, `e2e/tests/r00105-preisetikett.spec.js`; die Abnahme ist der volle Lauf `npx playwright test --workers=2`.

## Tests

Nach Skill `test-pyramide`; die Probe misst eine echte Zustandsänderung (Skill `test-ehrlichkeit`).

- **E2E:** die vier genannten Spec-Dateien; Abnahme-Probe der Karte (voller Lauf 3×, je Datei `--repeat-each=10` unter Last).
- **Rot vor dem Bau:** die vier Stellen wackeln unter Last (`kanbanD-anmerkungen.md`, Zeile 139; `AI-Team/gelerntes.md`, #80).
- **Gegenprobe (kein Ausweichen):** r00126 misst nach `gezeichnet()` und gestellter Uhr; ein verbleibendes Neuzeichnen ist ein Programmfehler, keine Testhärte.

## Abhängigkeiten

- Abhängig von: ADR-0026 (`5f4dcfe`), den grünen Nachbar-Interactions I0118 (R00126), I0098 (R00109, `kultur.spec.js`), I0094 (R00105, `r00105-kostenbericht.spec.js`) und I0132 (R00145, `r00145-ansichtsmenue.spec.js`) — sie bleiben abgenommen und zu.
- Blockiert: den Release-Workflow (`.github/workflows/release.yml`).
- Nicht Teil: die übrigen Wackler-Stellen der Bewertung (`gemeinsam/scratchpad/arch-139/bewertung-stellen.md`), `tests/live.rs:57` (Rust).

## Offene Fragen

- **r00126 AK 7: Wächter oder Defekt?** Die Gegenprobe entscheidet es; bis dahin wird die Stelle als Programmverhalten unter Last geführt (ADR-0026, „Offene Fragen“). Keine blockierende Frage an den Betreiber.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine — Änderung nur an `e2e/tests/`; der Projekt-Commit trägt die Ursache je Stelle.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser sind drei gescheiterte Release-Läufe am 2026-11-14 an je 1–4 wechselnden Specs. Die Proben lesen, messen oder zählen, während die Ansicht noch zeichnet: `allesAufklappen` liest `zu.count()` in einer festen Schleife, r00126 liest `renders()` direkt nach `liveBereit`, r00105-kostenbericht greift auf `.bf-fuss .bf-leeren` unmittelbar nach `goto` + `filterOeffnen`, r00145 misst direkt nach `setViewportSize`. Weil es kein Programmfehler an einer Stelle ist, sondern eine Technikfrage der Testhärte, hilft ein einzelner Flicken nicht: der nächste Wackler derselben Klasse entsteht sofort neu. Wenn die vier Stellen sich an einer gemeinsamen Antwort und zwei Hilfen ausrichten (X), dann wartet jede Probe den Zielzustand ab (Y), und der Release-Lauf zeigt keinen wechselnden Fremd-Wackler mehr — das echte Rot bleibt sichtbar (Z). Genau dieser Hebel ist gewählt und nicht ein größerer Timeout, weil eine verlängerte Frist das Fenster nur verschiebt und `retries` den Wackler verstecken.

## Missing-Docs

- Keine.

## Notizen

- **Herkunft:** Karte #139 (Sammelkarte ohne WBS-Knoten; vom Betreiber am 2026-11-14 vorgezogen, weil die Wackler das Release auf GitHub blockieren). Technik: ADR-0026 `5f4dcfe` („Vorgeschlagen“), fünf Regeln und zwei Hilfen; Bewertung der Stellen: `gemeinsam/scratchpad/arch-139/bewertung-stellen.md`.
- **Heimat:** eigene Interaction `I0137` unter D0002 (Board), nach der Härtungsregel `AI-Team/gelerntes.md` (2026-11-11, Vorbilder I0106/R00117, I0134/R00147); I0118, I0098, I0094 und I0132 sind grün/abgenommen und bleiben zu. Elterndialog D0002, weil das E2E-Harness `e2e/tests/hilfen.js` (Start, `liveBereit`, `breiteSetzen`) das Board bootet und zwei der vier Specs Board-Specs sind; die zwei Bericht-Specs (`kultur.spec.js`, `r00105-kostenbericht.spec.js`) sind eine benannte Abweichung.
- **Kein Feature:** `kein Feature noetig` — ein Aspekt: die Messgrundlage wartet auf den Zielzustand.
- **Keine neue User Story:** die Arbeit ist Testhärte; abgenommen wird über die Proben (Abnahme-Probe der Karte wörtlich), eine Erzählung ohne neuen Nutzer wäre eine zweite Wahrheit.
- **Keine Oberfläche** (Label `oberflaeche` trifft nicht zu), keine Artboard-Freigabe, kein ux-Review; **kein Produktivcode**.
- **Umfang:** nur die vier Release-Blocker; die übrigen Stellen der Bewertung sind die Folgekarte „E2E-Wackler Teil 2“, `tests/live.rs:57` eine eigene Karte. 5 Bubbles, Richtwert 5,5–10 h ungemessen (Summe der Spannen, Hypothese).
