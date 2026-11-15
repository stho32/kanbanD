---
id: R00151
status: Neu
datum: 2026-11-15
ursprung: Bug-Report
ursprungslauf: R00109
---

# R00151: Behebung der Wochenleisten-Probe, die an jedem Sonntag scheitert

## Beschreibung

Der Release-Workflow auf GitHub (`.github/workflows/release.yml`, Lauf auf Commit `e38f2f9`, Sonntag 2026-11-15) ist rot: 1291 Playwright-Tests bestanden, 1 gescheitert, kein neues Release. Gescheitert ist `e2e/tests/kultur.spec.js:197` „US-4: Personen „zuletzt“ und Wochenleiste lang, Tagesköpfe kurz im laufenden Jahr“ — `#woche` zeigt „09.11.2026 – 15.11.2026“, die Probe erwartet „16.11.2026 – 22.11.2026“.

Reproduzierbar an jedem Sonntag: Stundenzettel öffnen, die Probe erwartet die Woche von morgen, das Programm zeigt richtig die laufende Woche (Montag bis Sonntag). **Fehler der Probe, nicht des Programms.** Diese Anforderung macht die Probe vom Wochentag des Laufs unabhängig (ADR-0026, Regel 6) und schließt Karte #89 („Test kultur.spec.js:193 (US-4 Wochenleiste) scheitert an jedem Sonntag“) mit ab — derselbe Test.

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanke „Getestet wird mit `cargo test` (Unit und Integration) und Playwright (E2E gegen das echte Programm)“.

## Ursachenanalyse

### Root Cause

`e2e/tests/kultur.spec.js:203` stellt die Uhr des Browsers mit `page.clock.setSystemTime(new Date())` auf heute zurück; `:205` bildet die erwartete Woche aus `woche(tag(1))` — aus morgen. Sonntags liegt morgen in der nächsten Woche. An derselben Variable `tage` hängen `:206` (Wochenleiste), `:207` (Tagesköpfe) und `:209` (Zahl der Klicks bis zur Neujahrswoche).

Zweite, latente Abhängigkeit an derselben Stelle: `kurz` (`:17`) rechnet „laufendes Jahr“ aus dem Tag des Laufs (`JAHR`, `:12`); in den ersten Januartagen enthält die Woche Tage zweier Jahre.

Ausgeschlossen: das Programm (zeigt die laufende Woche richtig), Last oder Timing (der Test ist an jedem Sonntag deterministisch rot, an den übrigen Tagen grün).

### Betroffene Komponenten

- `e2e/tests/kultur.spec.js:197–212` (US-4) — einzige Erwartung über eine Kalendergrenze ohne gestellte Uhr.
- `e2e/tests/hilfen.js:3–14` — Kopfkommentar „Warten“ nennt fünf Regeln, Regel 6 fehlt.
- Gesichtet und nach Lektüre robust (Architektur, `618b67c`): `r00022-berichte.spec.js:26`, `r00043-berichtsfilter.spec.js:8`, `r00148-zweiter-ausloeser.spec.js:453–470`, `r00081-berichtsfilter-am-board.spec.js:60–67`; in `kultur.spec.js` selbst `:140` (`fällig ${lang(tag(1))}` — lange Form, keine Kalendergrenze).

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0026, Nachtrag 2026-11-15, Regel 6: Die Probe stellt die Uhr des Browsers für den Stundenzettel auf ein **festes** Datum (`page.clock.setFixedTime` bzw. `install({ time })`, Vorbild `e2e/tests/r00122-durchsatz.spec.js:200`) und rechnet Woche, Tagesköpfe, laufendes Jahr und den Weg zur Neujahrswoche aus genau diesem Datum. Drei Varianten decken die Wochengrenze: Sonntag, Montag, Samstag. Der Teil „Personen zuletzt“ (`:199–202`) bleibt, wie er ist.

### Alternative Ansätze

- **`woche(tag(0))` statt `woche(tag(1))`** — behebt den Sonntag, prüft die Wochengrenze aber weiter nur am Tag des Laufs und lässt die Januar-Abhängigkeit stehen; verstößt gegen Regel 6 (Grenzfall mit festen Daten).
- **Stellbare Uhr im Server oder gemeinsamer Datumshelfer für alle Specs** — in ADR-0026 ausdrücklich nicht entschieden; Produktivcode bzw. rund 30 Dateien für eine einzige betroffene Stelle.

## Test-Strategie

### Test zur Bug-Reproduktion

Die Sonntags-Variante von US-4. **Rot ohne Fix**: der Stand `e38f2f9` ist sonntags rot (Release-Lauf; lokal heute, Sonntag 2026-11-15). Unabhängig vom Tag des Laufs belegt es die Mutante „Erwartung aus dem gestellten Datum plus einem Tag“: Sonntag rot, Montag und Samstag grün.

### Code-Extraktion für isoliertes Testing

Keine — die Wochenrechnung der Probe (`montag`, `woche`, `plus`, `:21–24`) ist bereits rein und bleibt.

### Regressionstests

`kultur.spec.js` vollständig; volles Gate (`cargo test`, Node-Tests, Playwright) grün.

## Akzeptanzkriterien

### Bug behoben (Pflicht)

- [ ] **AK 1 Sonntag:** Gegeben die Uhr des Browsers steht auf Sonntag, 15.11.2026, wenn der Stundenzettel geöffnet wird, dann zeigt die Wochenleiste „09.11.2026 – 15.11.2026“ und die Tagesköpfe „09.11.“ bis „15.11.“.
- [ ] **AK 2 Montag:** Gegeben Montag, 16.11.2026, dann „16.11.2026 – 22.11.2026“ und Tagesköpfe „16.11.“ bis „22.11.“.
- [ ] **AK 3 Samstag:** Gegeben Samstag, 21.11.2026, dann „16.11.2026 – 22.11.2026“ und Tagesköpfe „16.11.“ bis „22.11.“.
- [ ] **AK 4 Jahresgrenze:** Gegeben eine der drei Varianten, wenn bis zur Woche des 01.01.2026 zurückgeblättert wird (von der Woche ab 09.11. sind das 45 Wochen, von der Woche ab 16.11. 46), dann zeigt die Wochenleiste „29.12.2025 – 04.01.2026“ und die Tagesköpfe „29.12.2025“, „30.12.2025“, „31.12.2025“, „01.01.“, „02.01.“, „03.01.“, „04.01.“.
- [ ] **AK 5 Unabhängig vom Tag des Laufs:** Die Erwartungen von AK 1–4 rechnet die Probe aus dem gestellten Datum (Woche und laufendes Jahr), nicht aus dem Tag des Laufs; ein Rot nennt die Variante (Sonntag, Montag oder Samstag).
- [ ] **AK 6 Rot ohne Fix:** Mit der Mutante „Erwartung aus dem gestellten Datum plus einem Tag“ ist die Sonntags-Variante rot, Montag und Samstag bleiben grün; der Commit nennt das Ergebnis.

### Regelsatz und Umfang

- [ ] **AK 7:** Der Kopfkommentar „Warten“ in `e2e/tests/hilfen.js` nennt Regel 6 (Kalendergrenzen, ADR-0026) — sechs Regeln.
- [ ] **AK 8 Weitere Stellen:** Der Commit nennt das Ergebnis der Sichtung von `e2e/tests/` auf Erwartungen aus `heute ± n`, die Woche, Monat, Jahr oder Wochenende benennen, ohne gestellte Uhr; jeder weitere Fund ist im selben Zug nach Regel 6 behoben. Stand der Architektur: kein weiterer Fund.
- [ ] **AK 9:** Geändert sind nur Dateien unter `e2e/tests/`; keine Erwartung ist abgeschwächt, `e2e/playwright.config.js` unverändert, keine `retries`.

### Abnahme-Probe der Karte (wörtlich)

- [ ] Der Test besteht mit auf Sonntag, Montag und Samstag gestellter Uhr (AK 1–3).
- [ ] Volles Gate grün — lokal an einem Sonntag gefahren (heute, 2026-11-15) oder, an jedem anderen Tag, mit AK 1 und AK 6 als gleichwertigem Nachweis.
- [ ] Nach dem Push läuft der Release-Workflow durch. **Nachweis durch den Director nach dem Push des Betreibers** (GitHub-Lauf); der entwickler erfüllt dieses Kriterium mit dem lokalen Nachweis der beiden Zeilen darüber und hakt es nicht selbst ab.

## Implementierungshinweise

- Die Uhr lässt sich nur im Browser stellen; der Server prüft Zeiteinträge gegen seine echte Uhr (`src/uhr.rs:101–108`). Testdaten (`grundbestand`, `tag(-14)`, `HEUTE`) bleiben relativ zu heute — die Zusagen von AK 1–4 hängen nicht an ihnen (nur Wochenleiste und Tagesköpfe).
- Uhrzeit des gestellten Datums mittags (12:00, `Europe/Berlin`), nicht an der Tagesgrenze.
- `kurz` für die Varianten aus dem Jahr des gestellten Datums bilden, nicht aus `JAHR`; die übrigen Tests der Datei nutzen `JAHR` weiter.
- Zeigt eine Variante ein anderes Bild als AK 1–4 (etwa weil die Oberfläche das laufende Jahr nicht aus der Browser-Uhr nimmt), ist das ein Befund am Programm: melden, nicht die Erwartung anpassen.

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Nach dem Push (Betreiber): Release-Lauf auf GitHub ansehen (Director); Karte #89 mit schließen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der rote Release-Lauf vom Sonntag 2026-11-15: die Probe erwartet die Woche von morgen, die Seite steht auf heute. Rechnet die Probe Erwartung und Seite aus demselben, festen Datum (X), dann gibt es keinen Wochentag des Laufs mehr, an dem beide in verschiedenen Wochen liegen (Y), und der Release-Workflow ist auch sonntags grün (Z). Feste Daten statt `tag(0)`, weil nur so Sonntag, Montag, Samstag und die Jahresgrenze an jedem Tag geprüft werden — sonst wartet der nächste Fehler dieser Klasse auf seinen Kalendertag.

## Notizen

- Priorität: Hoch — blockiert das Release an jedem Sonntag. Workaround: Lauf am Montag wiederholen.
- **Herkunft:** Karte #164 (Auftrag des Betreibers 2026-11-15, Vorrang); schließt Karte #89 mit ab. Bezug: R00109, ADR-0026 Nachtrag (`618b67c`), Karte #73 (gleiche Klasse, Fever-Chart am Wochenende).
- **Heimat:** eigene Interaction `I0138` unter D0002 neben I0137 (Härtungsregel `AI-Team/gelerntes.md` 2026-11-11); I0098 (R00109) bleibt abgenommen und zu.
- **Ausgegrenzt (Nebenbefund der Architektur, keine Folgekarte):** `kontrast.spec.js:13–15` und `r00106-fokus.spec.js:460` bilden das Datum über `toISOString()` in UTC und liegen zwischen 0 und 2 Uhr Berliner Zeit einen Tag früher. Nach Lektüre kippt keine Zusage: `gestern()` wird vorgestern (weiter überfällig), `inTagen(3)` wird übermorgen (weiter „nicht heute und nicht morgen“, `kontrast.spec.js:519–522`), `tag(20)`/`tag(40)` werden 19/39 (geprüft wird nur `aria-pressed`). Nicht Teil dieser Anforderung.
- **Keine User Story:** reine Testhärte ohne neuen Nutzer (wie R00150); abgenommen wird über die Proben.
- **Keine Oberfläche, kein Produktivcode;** Labels der Karte: keine.
