---
id: R00231
status: Offen
datum: 2026-11-22
ursprung: Bug-Report
ursprungslauf: R00127
---

# R00231: Behebung — die Größenproben in r00127 messen in einem Zug und messen nie einen ausgehängten Knoten

## Beschreibung

Karte #240. `e2e/tests/r00127-kartendetails-tabs.spec.js:356` (US-6, Touch, Auslöser ≥ 44 px) war im Gate von #231 einmal rot mit `Expected: >= 44, Received: 0`, allein 5 von 5 grün. Im Gate auf `main` für #218 (`c720a934`) war `:332` (US-6, feiner Zeiger, ≥ 24 px) einmal rot, allein 3 von 3 grün. Dasselbe Messmuster.

**Reproduktion ohne Last** (architekt, Probe `gemeinsam/scratchpad/arch-240/proben/probe-240e.spec.js` der Factory): Fenster #1 bei 320 px mit Touch öffnen, `liveBereit`, dann die Seite in jedem Frame neu zeichnen lassen (`requestAnimationFrame`-Schleife mit `render()`). **Erwartet:** der Auslöser misst ≥ 44 × 44 px. **Tatsächlich:** die heutige Messung `rechteck(locator)` liefert 10 von 10 Mal 0 (rot), eine Messung in einem einzigen `page.evaluate` 10 von 10 Mal ≥ 44 (grün).

Das ist **falsch gebaut im Test**, nicht in der Seite: die Seite zeichnet den Auslöser nie mit Höhe 0, sie ersetzt ihn beim Neuzeichnen (ADR-0007). US-6 von R00127 bleibt unverändert gültig; die Probe dafür misst nur unzuverlässig.

Zahlt ein auf: [Vision](R00000-vision.md) über die Leitplanke des Teams, dass ein rotes Gate einen echten Fehler bedeutet — ein Wackler, der in vollen Läufen fremde Karten rot färbt, lässt ein echtes Rot im Rauschen untergehen.

## Ursachenanalyse

### Root Cause

Belegt in [ADR-0026](../Dokumentation/ADRs/0026-warten-auf-zustand-statt-zeit-in-e2e-tests.md) Nachtrag „Geometrie in einem Zug messen“ (Commit `a86b06ab`), Stand `5236704c`:

- `rechteck` (`r00127-kartendetails-tabs.spec.js:61`) misst über `locator.evaluate`. Playwright 1.65.1 löst dabei erst den Knoten auf und wertet in einem zweiten Aufruf aus. Der Kommentar `:60` („in einem Zug“) stimmt nicht.
- Die Testdaten tragen eine laufende Stoppuhr (`LAEUFT`, `:17`). Der erste Sekundentakt nach dem Laden zeichnet einmal neu (`web/app.js:5302–5325`, R00114). Fällt er unter Last zwischen die beiden Schritte, misst `getBoundingClientRect` den ausgehängten Knoten: 0 × 0 bei `isConnected: false` (Probe: 10 von 10).
- Eine verzögerte Antwort (`page.route`, 300–800 ms) stellt den Fehler nicht nach.

### Betroffene Komponenten

- `e2e/tests/hilfen.js`: neue Hilfe `masse(page, selektor)`
- `e2e/tests/r00127-kartendetails-tabs.spec.js`: die fünf Messstellen `:312`, `:320`, `:341`, `:365`, `:371` (Zeilen am Stand `a86b06ab`); `rechteck` entfällt
- **Nicht** betroffen: `web/` (kein Produktivcode), die übrigen Specs — auch r00101, r00114, r00115, r00117, r00140 und r00199 mit laufender Stoppuhr gehören ausdrücklich **nicht** zu dieser Karte (ADR-0026 N3, „Nicht entschieden“)

## Lösungsvorschlag

### Langfristige Lösung

ADR-0026 N3 Regel 8: eine Hilfe `masse(page, selektor)` in `e2e/tests/hilfen.js` sucht den Knoten und misst ihn in **einem** `page.evaluate` — Auflösen und Messen liegen in derselben Aufgabe der Seite. Fehlt der Knoten, liefert sie `null`, nie 0. Sie liefert Lage und Größe (`x`, `y`, `width`, `height` aus `getBoundingClientRect`) und die Maße, die `:312` braucht (`scrollWidth`, `clientWidth`, `clientHeight`). Jede der fünf Messstellen prüft ihre Schwelle damit unter `expect.poll`; `null` besteht keine Prüfung.

### Alternative Ansätze

Entschieden im ADR, hier nur benannt:

- auf das Takt-Zeichnen warten oder die Stoppuhr aus den Testdaten nehmen — bindet die Probe an eine Eigenheit der Daten; verworfen
- unveränderte Knoten in der Seite erhalten — Produktivcode gegen ADR-0007 ohne Defekt; verworfen
- nur `expect.poll` um die heutige Messung — die Lesung am ausgehängten Knoten bleibt, `:312` bliebe leer wahr; verworfen

## Test-Strategie

### Test zur Bug-Reproduktion

Ein neuer Test in `r00127-kartendetails-tabs.spec.js` (Beschreibung Touch): der Auslöser wird gemessen, während die Seite in jedem Frame neu zeichnet. Er ist deterministisch und braucht keine Last. Mit `masse` grün, mit dem alten `rechteck` rot (AK 3).

### Code-Extraktion für isoliertes Testing

`masse` wird an einer statischen Probeseite (`page.setContent`, Vorbild `kultur-selbstprobe.spec.js`) geprüft: vorhandener Knoten → Maße, fehlender Selektor → `null` (AK 1).

### Regressionstests

- alle übrigen Tests von r00127 ohne geänderte Erwartung grün
- alle Tests aller Ebenen grün (Gate)

## Akzeptanzkriterien

**Ausgangslage:** die Testdaten von r00127 unverändert (`GRUND` mit laufender Stoppuhr `LAEUFT`), Fenster #1 bei 320 px geöffnet, wie in den Tests `:332` und `:356` heute.

### Bug behoben

- [ ] **AK 1 Hilfe `masse`:** `masse(page, selektor)` steht in `e2e/tests/hilfen.js` und wird exportiert. Gegeben eine Probeseite mit `<div id="m" style="width:50px;height:30px">`: `masse(page, '#m')` liefert `width` 50 und `height` 30; `masse(page, '#fehlt')` liefert `null`. Die Hilfe ruft genau ein `page.evaluate` auf; `locator.evaluate`, `elementHandle` und `boundingBox()` kommen in ihr nicht vor.
- [ ] **AK 2 Fünf Messstellen:** In r00127 messen `:312` (Kopf: `scrollWidth ≤ clientWidth`, `clientHeight ≤ max(36, --kd-ziel) + 2`), `:320` (Menü links und rechts im Bild), `:341` (Auslöser ≥ 24), `:365` (Auslöser ≥ 44) und `:371` (je Menüeintrag ≥ 44) über `masse` unter `expect.poll`. Schwellen und Meldungstexte bleiben, wie sie sind. `rechteck` und jede andere Maßlesung über `locator.evaluate`, `elementHandle` oder `boundingBox()` kommen in der Datei nicht mehr vor: die Suche `grep -nE 'rechteck|elementHandle|boundingBox|\.evaluate\(el' e2e/tests/r00127-kartendetails-tabs.spec.js` findet keine Codezeile mehr (Kommentare ausgenommen; heute trifft sie `:61`, `:312`, `:320`, `:341`, `:365`, `:371`). Liefert `masse` `null`, wird die Prüfung nicht grün.
- [ ] **AK 3 Abnahme-Probe der Karte (wörtlich nach ADR-0026 N3):** Eine zusätzliche Variante lässt die Seite in jedem Frame neu zeichnen (`requestAnimationFrame`-Schleife mit `render()`) und misst dann den Auslöser (Touch, ≥ 44). Sie ist mit `masse` 10 von 10 Mal grün (`--repeat-each=10 --workers=1`). Mit dem alten `rechteck(locator)` ist sie 10 von 10 Mal rot. Heute: die Variante gibt es nicht; die Messart von heute ist 10 von 10 rot (Probe des architekt).
- [ ] **AK 4 Wiederholung:** `:332` und `:356` (Zeilen am Stand nach dem Bau) sind mit `--repeat-each=20 --workers=1` 40 von 40 Mal grün, 0 flaky.
- [ ] **AK 5 Mutanten:** jeder Mutant wird von einem benannten Test getötet, in einer eigenen Kopie, nicht im Worktree.
  - (m1) `masse` löst über `elementHandle` auf und misst danach → die Variante aus AK 3 rot (Mutante der Karte).
  - (m2) die Variante aus AK 3 misst mit dem alten `rechteck` → rot.
  - (m3) `masse` liefert bei fehlendem Knoten `{width: 0, height: 0, …}` statt `null` → AK 1 rot.

  Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung.
- [ ] **AK 6 Bug-Vorlage:** Kein Produktivcode geändert (`git diff --stat` nur unter `e2e/tests/`). Keine Erwartung abgeschwächt, kein Timeout pauschal erhöht, keine `retries`, kein neues `waitForTimeout`. Alle Tests aller Ebenen grün.

## Implementierungshinweise

- Die Menüeinträge (`:371`) sind über `data-arg="<schlüssel>"` erreichbar (`web/ansicht.js:285`, `[role="menuitemradio"][data-arg="…"]` im `ANSICHTSMENUE`).
- `:312` misst heute schon die Seite in einem `page.evaluate` (`document.documentElement`); diese Lesung ist kein Fall dieser Karte.
- Die Probe `probe-240e.spec.js` des architekt zeigt Variante und Zweischritt-Messung nebeneinander.
- Das Gate allein fahren, ohne `nice`, kein anderes Gate daneben (AI-Team/gelerntes.md 2026-11-15).

## Offene Fragen

- keine, die den Bau aufhält. Die 47 übrigen Lesungen über `locator.evaluate` in 23 Specs und die 89 Aufrufe `boundingBox()` bleiben außerhalb der Karte (ADR-0026 N3, „Nicht entschieden“); Durchsetzung als Review-Punkt an neu geschriebenen oder angefassten Messungen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Die Probe wird rot, weil sie den Knoten in einem Schritt findet und in einem zweiten misst; ein Neuzeichnen dazwischen hängt ihn aus, und der ausgehängte Knoten misst 0. `masse` findet und misst in derselben Aufgabe der Seite, also misst sie immer den Knoten, der gerade im Dokument hängt. Fehlt er für einen Augenblick, kommt `null`, und `expect.poll` fragt erneut, statt 0 zu werten. Damit hängt das Urteil am dauerhaften Maß des Auslösers, nicht am Zeitpunkt des Takts; die Variante mit Neuzeichnen in jedem Frame belegt das ohne Last.

## Notizen

- Priorität: Hoch (Wackler im Gate, Vorrang nach gemeinsam/gelerntes.md)
- Betroffene Nutzer/Systeme: jedes Gate mit der vollen Playwright-Suite
- Workaround: den roten Test allein nachfahren
- Grundlage: ADR-0026 Nachtrag N3 Regel 8, Kommentar des architekt auf Karte #240 vom 2026-11-22
