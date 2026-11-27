---
id: R00262
status: Neu
datum: 2026-11-27
ursprung: Bug-Report
ursprungslauf: R00245
---

# R00262: Behebung — die Probe von R00245 AK 8 misst die Überschrift des Commit-Kopfs vor dem Umbruch

## Beschreibung

Karte #280, aus der Merge-Wache von #278 (Director, 2026-11-26, `main` `3ec65f4e`): die Probe `e2e/tests/r00245-review-commit-leiste.spec.js:471` (R00245 AK 8, schmale Breiten 414 und 599 px) wird gelegentlich rot.

**Reproduktion (aus dem Kartenbefund):** dieselbe Spec im vollen Gate oder einzeln mit 1 Worker. **Erwartet:** `{ zeilen: true, passt: true }` — die Überschrift des Commit-Kopfs bricht auf mehr als eine Zeile um und passt in die Breite. **Tatsächlich:** `zeilen: false` — sie meldet eine einzige Zeile. Häufigkeit: 1 von 60 Einzelläufen (`--repeat-each=10 --workers=1`, Breite 414) und 1 von 1 vollem Gate (Breite 599); die übrigen 59 Läufe sind grün.

Das ist **falsch gebaut im Test, nicht in der Seite.** Nach dem zweiten `commitOeffnen(page, k, 9, h.c2lang)` (`:469`) misst der Fall die Überschrift sofort (`:470`). `commitOeffnen` navigiert über die Hash-Adresse (`adresse`, `:10`): dieselbe Seite, nur ein neuer Anker. Der SPA setzt den Commit-Kopf daraufhin neu — `page.goto` und das `waitFor` auf `.rv-commit h2` (`commitOeffnen`, `:40`) kehren aber zurück, solange das **alte** `h2` noch sichtbar ist. Die Messung liest dann die Überschrift des vorigen Commits, `h.c3a = KENNUNG_40` (`review-hilfen.js:352`, `[AAAA…]` — 40 `A`, ein Wort) — das bricht **nicht** um: `zeilen: false`. Kommt das Neuzeichnen vor der Messung (geringere Last), liest die Messung den richtigen Kopf und wird grün — daher der Wackler.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): die Review-Seite trägt die Abnahme einer Karte. Ein rotes Gate auf `main` bremst die Merge-Wache **jeder** Karte und lässt ein echtes Rot im Rauschen untergehen.

### Domänenbezug

Fachbegriffe sind nicht betroffen. „Anker“, „Neuzeichnen“ und „Hash-Adresse“ sind Begriffe des Testsystems (ADR-0026) und haben im Glossar keinen Eintrag.

## Ursachenanalyse

### Root Cause

Ein Wettlauf zwischen dem Neuzeichnen des Commit-Kopfs und der Messung; belegt am Code der Spec (Stand `karte/280`) und an ADR-0026:

- Die Adresse ist ein Hash (`adresse(k, nr, hash)`, `:10`) → dieselbe Seite, keine neue Last; der Kopflauf bleibt derselbe DOM-Knoten, der SPA schreibt erst seinen Inhalt neu (Titel, Chips, Zweige).
- `commitOeffnen` (`:38–42`) wartet nur auf die Sichtbarkeit von `.rv-commit h2` und `#rv-u-alle[aria-label]`. Beide sind vom vorigen Commit schon da und sichtbar → das Warten kehrt sofort zurück.
- Der Fall misst daraufhin in einem Zug (`:470`) `getClientRects().length` und `getBoundingClientRect().height`. Solange der alte Kopf steht, ist das `h2` das von `h.c3a` (`[AAAA…]`, ein Wort) — einzeilig; `zeilen: false`.

Verletzt sind **ADR-0026 Regel 1** („nackte Lesung nach einer Aktion ist verboten — auf den Zustand warten“) und **Regel 3** („die Ansicht steht, bevor gemessen wird“). `liveBereit` allein genügt laut Regel 3 nicht; hier genügt auch das Sichtbarkeits-`waitFor` auf den Anker nicht, weil der Anker vom vorigen Commit stammt.

Ausgeschlossen: ein Fehler in der Seite (die Messung des richtigen Kopfs ist bei beiden Breiten und beiden Themen grün; #278 hat keinen Byte der Review-Seite berührt), eine Nachlässigkeit der Kriterien (AK 8 verlangt den Umbruch ausdrücklich) und ein Einbruch durch #239/#279 (beide ändern `hilfen.js`, nicht diese Spec).

### Betroffene Komponenten

- `e2e/tests/r00245-review-commit-leiste.spec.js:448–481` — die Breitenschleife von AK 8, darin der zweite `commitOeffnen(page, k, 9, h.c2lang)` (`:469`) und die Messung (`:470–471`).
- **Nicht** betroffen: `web/` und `src/` (keine Änderung an der Seite), `e2e/tests/hilfen.js` (von #239 und #279 geändert — nur benutzen, nicht anfassen), die übrigen Kriterien von R00245 und andere Specs.

## Lösungsvorschlag

### Langfristige Lösung

Option A (empfohlen): **nach dem Öffnen des Commits auf den gezeichneten, umgebrochenen Kopf warten, dann messen** — genau die Regel, die ADR-0026 Regel 1 und 3 für jede Messung verlangt. Das ist in einem Zug prüfbar: der Fall wartet vor `:470` über `await expect.poll(() => s.ueberschrift().evaluate(...))` auf die gemessene Eigenschaft des **neuen** Kopfs (die Überschrift ist umgebrochen bzw. trägt den Titel des neuen Commits), und misst erst danach. Vorbild sind die Trefferproben aus ADR-0033 N2 / R00252 (`expect.poll` auf den Zielzustand).

### Alternative Ansätze

- **B `await bereit(page, s.ueberschrift())`** (ADR-0026 Regel 3: `liveBereit` + Sichtbarkeitsanker + `kdTest.gezeichnet()`): die Hausform und die kürzeste Zeile — **nur wenn** sie den Kopflauf wirklich trägt. Der Anker ist vom vorigen Commit schon sichtbar; ob `kdTest.gezeichnet()` das Neuzeichnen des Kopfs umfasst, muss der Bau prüfen, sonst wartet sie nicht. Gewählt nur mit Beleg (die Wiederholungsprobe AK 1 ist grün).
- **C `await breiteSetzen(page, breite, 900)` erneut nach dem Öffnen** (ADR-0026 Regel 2: zwei Frames Layout): erzwingt ein Neuzeichnen nach dem `resize`-Hörer. Verworfen, solange A genügt — sie misst die Breite ein zweites Mal, obwohl sich die Breite nicht geändert hat; sie ist das gröbere Mittel.
- **Feste Wartezeit (`waitForTimeout`):** in ADR-0026 Regel 5 ausdrücklich untersagt und wackelig. Verworfen.

### Test-Strategie

#### Unit Test zur Bug-Reproduktion

Es gibt keinen Unit Test, denn der Fehler liegt in der E2E-Probe selbst (Vorbild R00252, R00231). Die Reproduktion ist die unveränderte Spec auf dem heutigen Stand: `npx playwright test tests/r00245-review-commit-leiste.spec.js -g "AK 8" --repeat-each=10 --workers=1` zeigt den Fehler in etwa 1 von 60 Läufen (Breite 414); im vollen Gate 1 von 1 (Breite 599, `3ec65f4e`). Weil die Rate klein ist, trägt die Wiederholung **30×** den Nachweis (AK 1), und der Mutant (AK 3) muss **rot** werden.

#### Wächter der Probe

Die Gate-Probe muss rot werden können, ohne Zeitmaß: der Mutant „Messung ohne Warten“ (das Warten entfällt, gemessen wird direkt nach `commitOeffnen` wie heute) lässt den Wackler zurückkehren und wird rot — er ist der Wächter, der die Zusage dieses Kriteriums trägt (AK 3).

#### Regressionstests

- Die ganze Spec `r00245-review-commit-leiste.spec.js` bleibt grün (AK 1–10, US-1..US-7 unverändert).
- Alle Tests aller Ebenen sind grün (Gate); kein anderer Wackler wird eingeführt.

## Akzeptanzkriterien

### Bug behoben

- [ ] **AK 1 Probe grün:** Gegeben der Stand dieser Karte bei Rechnerlast < 6 (Tagbetrieb, 8 Kerne), wenn `npx playwright test tests/r00245-review-commit-leiste.spec.js -g "AK 8" --repeat-each=30 --workers=1` läuft, dann ist sie 30 von 30 grün, und die Spec ist im vollen Gate (4 Worker) grün. Heute rot: 1 von 60 Einzelläufen (Breite 414), 1 von 1 vollem Gate (Breite 599, `3ec65f4e`).
- [ ] **AK 2 Warten vor der Messung:** Nach dem zweiten `commitOeffnen(page, k, 9, h.c2lang)` wartet der Fall, bis der neu geöffnete Commit-Kopf gezeichnet und seine Überschrift umgebrochen ist, bevor er `:470` misst. Prüfbar am Code der Spec: vor der Messung steht ein Warten auf das **gemessene** Element (`expect.poll` auf die Eigenschaft des neuen Kopfs, `bereit(page, s.ueberschrift())` oder `breiteSetzen`), nicht nur `liveBereit`/das Sichtbarkeits-`waitFor` aus `commitOeffnen`. Beleg der Ursache: ohne das Warten liest die Messung den vorigen Kopf (`h.c3a`, `[AAAA…]`, ein Wort → `zeilen: false`).
- [ ] **AK 3 Mutant „Messung ohne Warten“ rot:** Wird das Warten aus AK 2 entfernt (gemessen wird direkt nach `commitOeffnen`, wie heute), dann wird die Probe rot (mindestens eine der Wiederholungen aus AK 1); der Durchlauf nennt die Zahl der Wiederholungen und die beobachtete rote Rate (heute 1 von 60). Wird der Mutant bei der gewählten Wiederholung **nicht** rot, ist das der Beleg, dass das Warten nicht der tragende Teil ist, und geht als Frage an den planer (die Wiederholung ist dann größer zu wählen oder die Last des vollen Gates zu nehmen).
- [ ] **AK 4 Keine Wanduhr-Grenze:** Die Probe prüft weiterhin **ohne** Zeitmaß (ADR-0026 N5 Regel 12). Der Fix führt weder `waitForTimeout` noch eine andere Zeit- oder Dauer-Grenze ein; gewartet wird auf den Zustand.

### Bestand und Abgrenzung

- [ ] **AK 5 Begrenzung:** Es ändert sich nur `e2e/tests/r00245-review-commit-leiste.spec.js`; `e2e/tests/hilfen.js` wird höchstens benutzt, nie geändert (von #239 und #279 geändert). R00245 bleibt abgenommen und ihre übrigen Kriterien unberührt; in ihren „Notizen“ steht höchstens **eine** Verweiszeile auf R00262.

## Implementierungshinweise

- Nur die Spec `e2e/tests/r00245-review-commit-leiste.spec.js` ändern, **kein** Code unter `web/` oder `src/`, **kein** Byte in `e2e/tests/hilfen.js` (nur die dortigen Hilfen `bereit`/`breiteSetzen` benutzen, ADR-0026 Regel 2/3).
- Der Fix bleibt **im Fall** (Breitenschleife AK 8, `:469–471`); die Hilfen sind bereits vorhanden. Kein neuer Treiberzustand nötig.
- Wahl der Wartform ist Sache des entwicklers (Option A/B/C oben); er nennt die Wahl und den Beleg (AK 1 grün) im Bericht. Trägt `bereit(page, s.ueberschrift())` den Kopflauf nicht (der Anker ist vom vorigen Commit schon sichtbar), ist `expect.poll` auf die gemessene Eigenschaft zu nehmen.
- Mutanten nur in einer Kopie des Standes, nie im Worktree; `mutanteEinsetzen` nur mit Pfaden unter `/web/…` (Lehre #247) — hier ist die Mutante ohnehin eine Änderung an der Spec, keine am Programm.
- Das Gate läuft nicht neben einem anderen Gate (gelerntes 2026-11-15); die Wiederholungsprobe ebenso wenig. Keine Last- oder Dauerprobe (ADR-0026 N5 Regel 12; Lehre #278).
- Die Verweiszeile in R00245 „Notizen“ setzt der entwickler beim Abschluss (Vorbild B1364 in R00249); R00262 selbst bleibt sonst der einzige neue Text.

## Offene Fragen

- Keine, die den Bau aufhält.

## Warum löst diese Anforderung das Problem? (Pflicht)

Die Probe ist rot, weil sie die Überschrift in einem Zug liest, in dem der Commit-Kopf noch der des vorigen Commits ist — `commitOeffnen` kehrt zurück, sobald der (alte) Anker sichtbar ist, und das Neuzeichnen des SPA kommt je nach Last davor oder danach. Wenn der Fall wartet, bis der neue Kopf gezeichnet und umgebrochen ist, misst er, was ein Mensch sieht, und sein Ergebnis hängt nicht mehr an der Rechnerlast. Der Hebel ist die Reihenfolge im Test (ADR-0026 Regel 1 und 3), nicht die Seite (kein Byte der Review-Seite seit R00245 geändert) und nicht eine Wartezeit (Regel 5). Ein rotes Gate auf `main` bedeutet danach wieder einen echten Fehler und bremst nicht mehr die Merge-Wache jeder Karte.

## Notizen

- Priorität: Hoch (Gate auf `main` rot, bremst die Merge-Wache jeder Karte — dasselbe Muster wie R00252, R00231, I0242)
- Betroffene Nutzer/Systeme: Factory (Gate, Merge-Wache, #278); Menschen sind nicht betroffen
- Workaround: kein Gate über `main` laufen lassen, während die Maschine Last trägt — praktisch nicht einhaltbar
- `ursprungslauf: R00245`, denn die Probe stammt aus R00245 (I0235, B1284).
- **Herkunft der Zahlen:** 1 von 60 (Breite 414, `--repeat-each=10`) und 1 von 1 (Breite 599, `3ec65f4e`) stammen aus dem Befund der Merge-Wache von #278; die 59 grünen Läufe ebenso. `[AAAA…]` (40 `A`), `LANGER_TITEL`, die Hash-Adresse und die Zeilen `:10/:38–42/:469–471` sind am Code der Spec und von `review-hilfen.js` abgelesen. `#239`/`#279` als Änderer von `hilfen.js` stammen aus dem Auftrag des Directors.
- **Verworfene Alternativen** mit je einem Satz: siehe „Alternative Ansätze“ (B `bereit` nur mit Beleg; C `breiteSetzen` gröber als A; feste Wartezeit in ADR-0026 Regel 5 untersagt).
- Kein Feature-Knoten nötig: eine Interaction mit zwei Bubbles (Vorbild I0242/R00252, dasselbe Muster).
- Nicht Teil: die übrigen Wanduhr-Grenzen im Gate (`r00248:528`, `r00217:365/393`, `r00247:445`) — eigene Karte (I0246); R00245 selbst (bleibt abgenommen, höchstens eine Verweiszeile); die Klasse „Messung direkt nach `commitOeffnen`“ in anderen Specs, falls vorhanden — Anmerkung an den Director.
- User Story nach dem Bug-Format: `user-stories/R00262.md`.
