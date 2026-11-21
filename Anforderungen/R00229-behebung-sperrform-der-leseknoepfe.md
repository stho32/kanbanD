---
id: R00229
status: Neu
datum: 2026-11-21
ursprung: Bug-Report
ursprungslauf: R00219
---

# R00229: Behebung — gesperrte Leseknöpfe tragen die Sperrform von Z. 216 (`--kd-faint`)

## Beschreibung

Karte #247, entstanden aus der PO-Entscheidung Z. 491 (2026-11-21). Gesperrte Bedienelemente tragen in der ganzen Anwendung die Schrift `--kd-faint`, die Kontur `--kd-line`, keinen Hover, und der Fokusring bleibt ungedämpft (PO Z. 216, Archiv; Z. 484 S-A). Die Leseknöpfe „Neu lesen“ und „Erneut versuchen“ im [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) stehen gesperrt stattdessen in `--kd-muted`, der Ruhefarbe freier Bedienelemente. Ein gesperrter Knopf sieht dort aus wie ein freier.

**Reproduktion:** Aufgabe #1 mit Läufen öffnen, Ansicht „Läufe“, die Antwort auf `GET /api/aufgaben/1/transkripte` halten, „Neu lesen“ drücken. **Erwartet:** die Schrift des gesperrten Knopfs ist die berechnete Farbe von `--kd-faint`. **Tatsächlich:** `--kd-muted` (hell `oklch(0.48 0.018 255)` statt `oklch(0.62 0.014 255)`). Ebenso „Neu lesen“ in „Commits“ und „Erneut versuchen“ in „Läufe“; dieser hovert zusätzlich auf `--kd-sunken` und behält die Kontur `--kd-line-strong`.

Das ist **falsch gebaut**: R00219 FA 7 verlangt für „Neu lesen“ ausdrücklich „Form Z. 216“, und Z. 216 gilt seit 2026-11-14 für jeden gesperrten Auslöser der ganzen Anwendung. Der Fehler entstand zuerst in R00205 (B1006, `df431884`, „Neu lesen“ in „Commits“) und wurde in R00219 (`d0e7cee5`, „Erneut versuchen“ in „Läufe“) samt AK 10 auf `--kd-muted` angeglichen. Die PO-Entscheidung Z. 491 hält die Regel `--kd-faint` und lässt den Code angleichen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): wer in der Abnahme liest, sieht verlässlich, ob ein Lesen gerade läuft.

## Ursachenanalyse

### Root Cause

Belegt am Stand `3041b300` (`web/kd-app.css`, ADR-0025 N5):

- `:1311` `.cl-textknopf[aria-disabled="true"]{cursor:progress;opacity:1;color:var(--kd-muted)}` — trifft „Neu lesen“ in „Commits“ (`web/commits.js:345`) und in „Läufe“ (`web/laeufe.js:205`).
- `:1362` `.lf-panel .cl-knopf[aria-disabled="true"]{color:var(--kd-muted);cursor:progress}` — trifft „Erneut versuchen“ in „Läufe“ (`web/laeufe.js:197`); Kontur `--kd-line-strong` und Hover `--kd-sunken` kommen ungedämpft aus `:1319–1320`.
- `:1728` `.lv-ganz .cl-knopf[aria-disabled="true"]…` — „Erneut versuchen“ der Laufansicht (`web/lauf.js:253`) ist schon richtig, aber als dritte, ansichtsgebundene Regel.

Die Sperrform der Leseknöpfe hängt an der Ansicht statt an der Komponente. Jede neue Ansicht legt deshalb eine eigene Regel an, und zwei sind auseinandergelaufen. Kein Test verlangt die Farbe `--kd-faint` an „Neu lesen“ oder an „Erneut versuchen“ in „Läufe“; `e2e/tests/r00219-ansicht-laeufe.spec.js:506` prüft nur „andere Farbe als frei, ≥ 3:1“.

Ausgeschlossen: `sperrenMarkieren` (`data-sperrform`, R00190) ist nicht beteiligt, denn die Leseknöpfe tragen kein `data-act`, solange sie gesperrt sind. „Erneut versuchen“ in „Commits“ (`commits.js:358`) sperrt nie.

### Betroffene Komponenten

- `web/kd-app.css`: Regeln `:1311`, `:1362`, `:1728` (Komponenten `.cl-textknopf`, `.cl-knopf`)
- `e2e/tests/r00219-ansicht-laeufe.spec.js:516` (Zeiger), nur wenn Z ≠ `progress`
- **Nicht** betroffen: `web/*.js`, `.btn[data-sperrform]` und die Familien aus `:15–26`, `.ts-seg[aria-disabled]`, `.km-e.km-aktuell`, Fokusregeln `:1361`, `:1726–1727`

## Lösungsvorschlag

### Langfristige Lösung

ADR-0025 N5 Variante B: je Komponente **eine** Regel ohne Ansichtspräfix, `.cl-textknopf[aria-disabled="true"]` und `.cl-knopf[aria-disabled="true"]`, je samt `:hover`, in der Form nach Z. 216: Schrift `--kd-faint`, bei `.cl-knopf` Kontur `--kd-line` und Fläche `--kd-surface`, Zeiger Z. Die Regeln `:1362` und `:1728` entfallen.

### Alternative Ansätze

Entschieden im ADR-0025 N5:

- **A, an Ort und Stelle umstellen:** Damit bliebe die Form an der Ansicht, und die nächste Ansicht legt die vierte Regel an. Verworfen.
- **C, ein globaler Selektor `[aria-disabled="true"]`:** Er trifft den aktuellen Menüeintrag, `.ts-seg` und Auslöser mit `data-act` vor Ablauf der 200 ms (R00190). Verworfen.
- **D, `data-sperrform` an den Leseknöpfen:** Das wäre eine Änderung in drei Ansichten statt im Stil. Verworfen, solange keine weitere Knopffamilie sofort sperrt.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

E2E im echten Programm, Antworten mit `page.route` gehalten und über ein Promise freigegeben (keine Schlafzeiten), wie in `r00219-ansicht-laeufe.spec.js` und `r00205-ansicht-commits.spec.js`. Die Farbe von `--kd-faint` wird je Thema über ein Probe-Element berechnet (Muster `r00221-laufansicht.spec.js:582–584`) und mit `getComputedStyle(knopf).color` verglichen. Heute rot: AK 1, 2, 3, 4 und 8.

### Code-Extraktion für isoliertes Testing

AK 8 ist eine Einheitenprobe in Node: Sie liest `web/*.css`, entfernt Kommentare und prüft die Selektorlisten. Weitere Extraktion ist nicht nötig.

### Regressionstests

- `r00219-ansicht-laeufe.spec.js`, `r00205-ansicht-commits.spec.js`, `r00221-laufansicht.spec.js`, `kontrast.spec.js` ohne geänderte Erwartung grün, mit einer Ausnahme: der Zeiger in `r00219…:516` folgt Z.
- alle Tests aller Ebenen grün (Gate)

## Akzeptanzkriterien

**Ausgangslage:** wie R00219 „Ausgangslage“ (#1 auf `fabrik` mit den Läufen L1–L6) und R00205 (#4 mit Commit-Verweisen), Browser headless, Themen hell und dunkel über die Einstellung des Programms. „Gesperrt“ heißt: Der Knopf trägt `aria-disabled="true"`, weil die Antwort auf sein Lesen gehalten wird.

**Zeiger gesperrter Leseknöpfe Z = _offen: `progress` oder `default`_.** Der ux-reviewer entscheidet den Wert in der UX-Vorprüfung gegen R00148 AK 19, er wird **nur hier** eingetragen. Alle Kriterien unten verweisen auf Z.

**Rechenbeispiel zu den Farben** (`web/kd-tokens.css`): `--kd-faint` hell `oklch(0.62 0.014 255)`, dunkel `oklch(0.62 0.014 250)`; `--kd-muted` hell `oklch(0.48 0.018 255)`, dunkel `oklch(0.74 0.014 250)`. Heute ergibt der gesperrte Knopf die Farbe von `--kd-muted`, also ≠ `--kd-faint` → rot. Kontrast von `--kd-faint` (ADR-0025 N5): hell 3,59 auf `--kd-surface`, 3,29 auf `--kd-bg`; dunkel 4,40 und 4,98 — ≥ 3:1 (Z. 484 S-A).

### Bug behoben

- [ ] **AK 1 „Neu lesen“ in „Läufe“:** Gegeben #1, Ansicht „Läufe“, Lesen gehalten, wenn der Knopf gesperrt ist, dann ist seine berechnete Schrift in hell und dunkel die Farbe von `--kd-faint`, `opacity` 1, die Fläche bleibt durchsichtig, kein Rand (Breite 0), der Zeiger ist Z, und die Schrift steht ≥ 3:1 gegen die Fläche dahinter. Heute: `--kd-muted` (rot).
- [ ] **AK 2 „Neu lesen“ in „Commits“ (Ergänzung des architekt):** Gegeben #4, Ansicht „Commits“, Lesen gehalten, dann gilt dasselbe wie in AK 1, hell und dunkel. Heute: `--kd-muted` (rot).
- [ ] **AK 3 „Erneut versuchen“ in „Läufe“:** Gegeben 503 an #1 und ein gehaltenes zweites Lesen über „Erneut versuchen“, dann ist am gesperrten Knopf in hell und dunkel die Schrift die Farbe von `--kd-faint`, die Kontur (`border-color`) die von `--kd-line`, die Fläche die von `--kd-surface`, `opacity` 1, der Zeiger Z und die Schrift ≥ 3:1. Heute: Schrift `--kd-muted`, Kontur `--kd-line-strong` (rot).
- [ ] **AK 4 Hover neutral:** Gegeben die gesperrten Knöpfe aus AK 1–3, wenn der Zeiger darüber steht, dann sind Schrift, Kontur und Fläche dieselben berechneten Werte wie ohne Zeiger, und keine Fläche wechselt auf `--kd-sunken`. Heute: „Erneut versuchen“ in „Läufe“ wechselt auf `--kd-sunken` (rot).
- [ ] **AK 5 Fokusring unverändert:** Gegeben einer der Knöpfe aus AK 1–3 hat per Tab den Fokus, wenn er gesperrt wird, dann sind `outline-style`, `outline-width`, `outline-color` und `outline-offset` dieselben berechneten Werte wie am selben fokussierten Knopf im freien Zustand, hell und dunkel; `outline-style` ist `solid` und `outline-width` mindestens 2 px (R00219 AK 10, R00205 AK 10). Heute grün (Wächter).

### Nichts anderes ändert sich

- [ ] **AK 6 Freie Form bleibt:** Gegeben die drei Knöpfe frei, dann sind Schrift, Kontur, Fläche, Hover und Zeiger (`pointer`) dieselben berechneten Werte wie am Stand `3041b300`: „Neu lesen“ in `--kd-accent-ink`; „Erneut versuchen“ in `--kd-text` mit Kontur `--kd-line-strong` und Hover `--kd-sunken`. Heute grün (Wächter).
- [ ] **AK 7 Laufansicht und Menüeintrag bleiben:** Gegeben die Laufansicht (R00221) mit gesperrtem „Erneut versuchen“, dann sind Schrift `--kd-faint`, Kontur `--kd-line`, Fläche `--kd-surface`, Hover neutral und Fokusring wie am Stand `3041b300`; nur der Zeiger ist Z. Ebenso behält der aktuelle Eintrag im Ansichtsmenü (`aria-disabled="true"`, kein Auslöser) seine Schrift `--kd-muted`. Heute grün (Wächter; der Zeiger der Laufansicht ist heute `default`).
- [ ] **AK 8 Eine Regel je Komponente (ADR-0025 N5):** Gegeben `web/*.css` ohne Kommentare, dann steht keine Selektorliste mit `.cl-knopf[aria-disabled="true"]` oder `.cl-textknopf[aria-disabled="true"]` hinter einem Ansichtspräfix, kein Selektor beginnt mit `[aria-disabled="true"]`, und je Komponente gibt es eine Form für gesperrt und für gesperrt mit `:hover`. Heute rot: drei Selektoren mit Präfix (`.lf-panel .cl-knopf…`, `.lv-ganz .cl-knopf…`, `.lv-ganz .cl-knopf…:hover`), geprobt am Stand `3041b300`.
- [ ] **AK 9 Mutanten:** Jeder Mutant wird von einem benannten Test getötet. Die Mutanten laufen in einer eigenen Kopie, nicht im Worktree.
  - (m1) Schrift von `.cl-textknopf` gesperrt wieder `--kd-muted` → AK 1 und AK 2 rot
  - (m2) Schrift von `.cl-knopf` gesperrt wieder `--kd-muted` → AK 3 und AK 7 rot
  - (m3) Hover von `.cl-knopf` gesperrt auf `--kd-sunken` → AK 4 rot
  - (m4) `opacity:.5` am gesperrten Knoten → AK 1 bzw. AK 3 rot
  - (m5) `.lf-panel .cl-knopf[aria-disabled="true"]{color:var(--kd-muted)}` wieder angefügt → AK 3 und AK 8 rot
  - (m6) Komponentenregel durch `[aria-disabled="true"]{color:var(--kd-faint)}` ersetzt → AK 7 und AK 8 rot
  - (m7) Zeiger ≠ Z → AK 1 bzw. AK 3 rot

  Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung.
- [ ] **AK 10 Bug-Vorlage:** Die Reproduktionstests (AK 1–4, AK 8) sind ohne Fix rot und mit Fix grün. Der Fehler der Karte tritt im Szenario der User Story nicht mehr auf. Alle Tests aller Ebenen sind grün; `r00219-ansicht-laeufe.spec.js:516` erwartet Z, sonst ändert sich keine bestehende Erwartung.

## Implementierungshinweise

- Die zwei Komponentenregeln gehören direkt hinter `:1311` bzw. `:1320`, damit sie bei den Grundregeln der Komponente stehen. `:1362` und `:1728` entfallen, `:1361` und `:1726–1727` bleiben.
- `.cl-textknopf` hat keinen Rand (`border:0`); die Kontur aus Z. 216 betrifft nur `.cl-knopf`.
- Gilt Z = `default`, wird `r00219-ansicht-laeufe.spec.js:516` und der Titel des Tests `:506` mitgeändert.
- Ein gehaltener Hover auf einem Knopf mit `aria-disabled` geht in Playwright mit `hover({ force: true })` (vgl. Kommentar in `r00205-ansicht-commits.spec.js:415`).

## Offene Fragen

- **Zeiger Z** (`progress` oder `default`): Das entscheidet der ux-reviewer in der UX-Vorprüfung gegen R00148 AK 19 („ohne Cursorwechsel“), eingetragen oben unter „Akzeptanzkriterien“. Der Bau beginnt erst, wenn Z eingetragen ist.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der gesperrte Knopf sieht wie ein freier aus, weil seine Form an der Ansicht hängt und dort `--kd-muted` trägt, die Ruhefarbe freier Bedienelemente. Hängt die Form an der Komponente, tragen alle Leseknöpfe in allen Ansichten dieselbe Form nach Z. 216. Wer in „Läufe“ oder „Commits“ „Neu lesen“ drückt, sieht dann dieselbe Dämpfung wie an jedem anderen gesperrten Auslöser der Anwendung und erkennt, dass das Lesen läuft. Der Hebel ist die Komponentenregel und nicht zwei geänderte Farbwerte: AK 8 macht jede künftige ansichtsgebundene Regel im Gate rot, bevor sie wieder auseinanderläuft.

## Notizen

- Priorität: Niedrig (Gestaltung, die Sperre selbst wirkt)
- Betroffene Nutzer/Systeme: Mensch in „Läufe“, „Commits“ und der Laufansicht des Aufgabenfensters
- Workaround: keiner nötig; die Ansage im Statusbereich meldet das Lesen
- Nachgezogen über `/anforderung review` mit Notiz: R00219 AK 10 und R00205 (Karte #247)
