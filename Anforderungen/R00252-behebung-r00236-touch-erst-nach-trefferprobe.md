---
id: R00252
status: Neu
datum: 2026-11-23
ursprung: Bug-Report
ursprungslauf: R00236
---

# R00252: Behebung — die Touch-Probe von R00236 tippt erst nach der Trefferprobe auf die Nummer

## Beschreibung

Karte #273, entstanden in der Nachprüfung von #259 (code-reviewer, 2026-11-23). Technik: ADR-0033 Nachtrag N2 „Zeigeraktionen auf Ziele im Code-Bereich erst nach der Trefferprobe“ (akzeptiert) und der Architektur-Kommentar an der Karte.

**Reproduktion (Probe der Karte):** Die Spec `r00236 mit Touch › AK 6/AK 10: Tippen auf die Nummer 13 öffnet den Link; Knöpfe ≥ 44 px hoch` läuft auf `main` mit 1 Worker und eigenem Build. **Erwartet:** grün, `geoeffnet()` liefert `vscode://file<wurzel>/src/a.rs:13`. **Tatsächlich:** 5 von 5 rot, `geoeffnet()` ist leer. Im Gate von #258 war dieselbe Spec grün.

Das ist **falsch gebaut im Test, nicht in der Seite** (ADR-0033 N2): Ein Mensch sieht nur gezeichnete Bilder, und in jedem gezeichneten Bild trifft der Punkt an der sichtbaren Nummer `td.n`. Die Probe tippt dagegen in ein Bild, das sich zwischen `touchstart` und `click` noch verschiebt. Die Seite bleibt unverändert.

Zahlt ein auf: [Vision](R00000-vision.md) — über R00236 (Sprung an die Zeile in VS Code per Tippen). Ein rotes Gate auf `main` bremst die Merge-Wache jeder Karte. Eine Probe, deren Ergebnis an der Rechnerlast hängt, gibt kein Urteil über die Seite.

### Domänenbezug

Fachbegriffe sind nicht betroffen. „Trefferprobe“ ist der Begriff aus ADR-0033 N2: `document.elementFromPoint` an der Mitte des Ziels liefert das Ziel selbst. Im Glossar hat er keinen eigenen Eintrag.

## Ursachenanalyse

### Root Cause

Belegt in ADR-0033 N2 (Messung des architekt, Chromium aus `e2e/node_modules`, 414 × 900, Touch, je 3–5 Läufe) und am Code der Spec (Stand `39cc2936`, `karte/273` nach dem Rebase auf `main`):

- `e2e/tests/r00236-review-pfad-vscode-patch.spec.js:481` ruft `s.nummerNeu('src/a.rs', 13).tap()` ohne vorheriges Scrollen und ohne Trefferprobe. Der Treiber `seite()` (`:31–51`) liefert nur Locatoren.
- Code-Blöcke mit `content-visibility: auto` haben, solange sie nicht gezeichnet sind, die geschätzte Höhe `Zeilen × 18 px` (ADR-0033 Punkt 5). Beim ersten Zeichnen wachsen sie um rund 19 px (gemessen 36 → 55, 162 → 181, 90 → 109).
- `tap()` rollt `.rv`, bis die Nummer am unteren Rand liegt (y 833–851, Rand 851). `touchstart` trifft `td.n`. Im nächsten Bild wächst ein Block darüber, die Nummer rückt auf y 852 aus dem Bild. Der `click`, den Touch erst nach `touchend` erzeugt, trifft die Zeile darüber (`td.n` ohne Link). Es gibt keinen Sprung, 3/3 rot.
- Direkt nach `scrollIntoView` liefert `elementFromPoint` an der Nummer noch `DIV.dz-b`, weil der Block übersprungen wird. Ein Bild später liefert er `td.n` (12/12).

**Warum vorher grün:** Seit 173dca44 gab es keinen Code-Commit. Mit 4- bzw. 8-facher CPU-Drosselung ist der Test 4/5 bzw. 5/5 grün, weil die Blöcke dann vor dem Tippen gezeichnet sind. Das Gate von #258 lief unter Fremdlast.

### Betroffene Komponenten

- `e2e/tests/r00236-review-pfad-vscode-patch.spec.js`: Treiber `seite()` und der Fall `AK 6/AK 10: Tippen auf die Nummer 13`.
- **Nicht** betroffen: `web/` (Seite, Stil, Punkt 5 von ADR-0033), Rust-Code, andere Specs.

## Lösungsvorschlag

### Langfristige Lösung

Regel aus ADR-0033 N2, gebündelt im Treiber der Spec: Der Treiber `seite()` bekommt eine Zeigeraktion, die

1. das Ziel mit `scrollIntoViewIfNeeded()` ins Bild holt,
2. mit `expect.poll` wartet, bis `document.elementFromPoint` an der Mitte des Ziels (`getBoundingClientRect`) das Ziel selbst liefert,
3. erst dann `tap()` ausführt.

Der Fall `Tippen auf die Nummer 13` tippt über diese Aktion. Vorlage ist die Gegenprobe des architekt (`gemeinsam/scratchpad/arch-273/fix/r00236-fix.spec.js` der Factory, dort noch im Fall statt im Treiber): Touch-Test 10/10, ganze Datei 27/27 grün.

### Alternative Ansätze

Entschieden in ADR-0033 N2:

- **Feste Wartezeit vor dem Tippen:** 2 s ergeben 2/5 grün. Verworfen.
- **Höhenschätzung der Blöcke korrigieren (Seite):** Das änderte Punkt 5 für einen Fehler, den ein Mensch nicht erlebt. Verworfen.
- **Nur `scrollIntoViewIfNeeded()` ohne Trefferprobe:** Lokal 4/4 grün, aber direkt danach liefert `elementFromPoint` noch `DIV.dz-b`. Das Ergebnis hinge wieder an der Zeitlage. Nicht gewählt.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Es gibt keinen Unit Test, denn der Fehler liegt in der E2E-Probe selbst. Die Reproduktion ist die unveränderte Spec auf dem heutigen Stand: `npx playwright test r00236-review-pfad-vscode-patch.spec.js -g "Touch" --repeat-each=5 --workers=1` ist ohne Fix 5/5 rot (AK 4). Mit Fix wird derselbe Aufruf mit `--repeat-each=10` grün (AK 1).

### Code-Extraktion für isoliertes Testing

Die Zeigeraktion mit Trefferprobe liegt im Treiber `seite()`, damit jede weitere Probe an Nummern oder Codezeilen sie nutzen kann (ADR-0033 N2 „Inkauf“).

### Regressionstests

- Die ganze Datei `r00236-review-pfad-vscode-patch.spec.js` ist grün (Gegenprobe des architekt: 27/27).
- Alle Tests aller Ebenen sind grün (Gate).

## Akzeptanzkriterien

Abnahme des architekt, wörtlich (Kommentar an Karte #273):

### Bug behoben

- [ ] **AK 1:** `npx playwright test r00236-review-pfad-vscode-patch.spec.js -g "Touch" --repeat-each=10 --workers=1` auf main 10/10 grün
- [ ] **AK 2:** im vollen Gate r00236 grün
- [ ] **AK 3:** die Spec tippt erst nach bestätigter Trefferprobe (`td.n`)
- [ ] **AK 4:** ohne Fix heute 5/5 rot

**Prüfbarkeit:**

- AK 1 und AK 4 laufen bei 1 Worker ohne paralleles Gate. Die Rechnerlast steht im Bericht, denn unter hoher Last wird der unveränderte Test zeitweise grün (ADR-0033 N2: 4/5 bei 4-facher Drosselung). AK 4 wird deshalb vor dem Fix auf dem Stand `39cc2936` geprüft (`uptime` im Bericht, Last ≤ 6,0 bei 8 Kernen).
- AK 3 ist am Code der Spec prüfbar: Vor `tap()` stehen im Treiber `scrollIntoViewIfNeeded()` und ein `expect.poll` auf `elementFromPoint(...) === ziel`. Der Fall ruft `tap()` nicht mehr direkt am Locator auf. Mutante: Entfernt man die Trefferprobe aus dem Treiber, wird AK 1 wieder rot (mindestens 1 von 10).

## Implementierungshinweise

- Nur `e2e/tests/r00236-review-pfad-vscode-patch.spec.js` ändern, kein Code unter `web/` oder `src/`.
- Name der Aktion im Treiber nach `javascript-stil`, z. B. `tippen(ziel)`. Die Trefferprobe vergleicht gegen das Element selbst, nicht gegen einen Vorfahren.
- Die Mausklicks auf Nummern und Codezeilen in derselben Datei (`:186–191`) sind heute grün und nicht Teil dieser Anforderung. Die Regel aus N2 gilt für neue Proben.
- Das Gate läuft nicht neben einem anderen Gate.

## Offene Fragen

- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Die Probe ist rot, weil sie in ein Bild tippt, das sich zwischen `touchstart` und `click` noch verschiebt. Wenn sie erst tippt, nachdem der Punkt an der Mitte der Nummer im gezeichneten Bild die Nummer trifft, prüft sie, was ein Mensch erlebt. Ihr Ergebnis hängt dann nicht mehr an der Rechnerlast. Der Hebel ist die Reihenfolge im Test, nicht eine Wartezeit und nicht die Seite.

## Notizen

- Priorität: Hoch (Gate auf `main` rot, bremst die Merge-Wache jeder Karte)
- Betroffene Nutzer/Systeme: Factory (Gate, Merge-Wache); Menschen sind nicht betroffen
- Workaround: keiner, der das Gate grün macht
- `ursprungslauf: R00236`, denn die Spec stammt aus R00236 (I0226, B1230).
- **Herkunft der Zahlen:** 5/5 rot, 4/4 mit Scrollen und 2/5 mit 2 s stammen aus der Nachprüfung von #259. Die Höhen, Lagen, 12/12 und die Drosselungswerte sind die Messung in ADR-0033 N2. 10/10 und 27/27 sind die Gegenprobe des architekt. Alle Werte sind übernommen, nicht nachgemessen.
- User Story nach dem Bug-Format: `user-stories/R00252.md`.
