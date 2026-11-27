---
id: R00264
status: Neu
datum: 2026-11-27
ursprung: Bug-Report
ursprungslauf: R00224
---

# R00264: Behebung — die Seitenmeldung auf „Ein Commit“ bei 404 `repository_fehlt` wird genau einmal angesagt

## Beschreibung

Karte #254, gefunden im Entwicklertest von #245 (`gemeinsam/scratchpad/etst-245/bericht.md` Z. 22, Probe `probe3.spec.js`).

**Reproduktion:** „Ein Commit“ (`…/aufgabe/<nr>/review?commit=kd:<hash>`) öffnen, während `GET …/commits` gehalten ist und `GET …/diff?commit=…` mit echtem 404 `{zustand: "repository_fehlt", grund: "…"}` antwortet (der Repository-Ordner ist weggenommen). **Erwartet:** Die Seitenmeldung `.rv-meld` (`role="status"`, „Zu kd:<kurz> gibt es keinen Diff.“ mit dem Satz zu `repository_fehlt`) wird für dieses Ereignis genau einmal angesagt. **Tatsächlich:** `#review` zeichnet innerhalb von 6–25 ms zweimal neu, die Seitenmeldung wird beim zweiten Zeichnen mit gleichem Text neu eingehängt, und `ansagenZaehlen` zählt zwei Einträge. Ein Bildschirmleser kann sie doppelt sprechen.

Das ist **falsch gebaut gegen ADR-0018 Nachtrag N4 §1** („Ein Ereignis ergibt genau eine Live-Ansage“). §2 lässt die Live-Rolle an dieser Meldung ausdrücklich („Seitenmeldungen der Review-Seite“), weil „Ein Commit“ keinen Statusbereich hat, der sie ansagen könnte — der Weg der Nachbaransicht „Alle Änderungen“ (R00230) ist hier deshalb nicht der richtige. Das Verhalten bestand schon vor #245; R00230 AK 6 nennt für „Ein Commit“ nur 503 und 500, der 404 `repository_fehlt` liegt außerhalb des damals abgesteckten Umfangs (R00230 „Nicht betroffen“ nennt `web/app.js` und `web/diff.js`). Es ist der fünfte Fall derselben Klasse.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): Wer die Review-Seite mit einem Bildschirmleser liest, hört jeden Fehler einmal und verwechselt ihn nicht mit zwei Fehlern.

### Domänenbezug

Die Review-Seite gehört zum Dialog D0009 „Arbeit hinter der Karte“. „Ansage“, „Live-Region“ und „Statusbereich“ sind die Begriffe aus ADR-0018 N4; im Glossar (`Dokumentation/Domaenenwissen/`) steht dafür kein eigener Eintrag.

## Ursachenanalyse

### Root Cause

Belegt am Stand `74e00eb2` (Zweig `karte/254`):

- **Zwei Leser, zwei Zeichnungen:** `reviewAnstossen` startet zugleich `reviewListeLesen` und `reviewDiffLesen` (`web/app.js:1229–1264`). Jeder Abschluss zeichnet selbst (`reviewListeLesen` → `render()`, `web/app.js:1389–1412`; `reviewDiffLesen` → `render()`, `web/app.js:1420–1436`). Beide Zeichnungen sind legitim — die Commit-Leiste hängt an `r.liste`.
- **Die zweite Zeichnung ersetzt `#main` ganz:** Im Fehlerfall ist der Insel-Schlüssel null (`reviewInselSchluessel`, `web/app.js:1611–1620`), deshalb ersetzt `hauptbereichErsetzen` (`web/app.js:2804–2823`) `#main` vollständig; der alte `.rv-meld`-Knoten fällt weg, ein neuer entsteht.
- **Der Halter fehlt:** `render()` hält `#nf-meld`, `#rv-pos`, `#rv-ansage`, `#rv-wahl`, `#rv-laedt`, `#rv-gesehen-speicher` und `#rv-gesehen` (`ansageBehalten`/`gesehenAnsageBehalten`, `web/app.js:3311–3345`) — **nicht** den `role="status"`-Knoten `.rv-meld` (`meldungHtml`, `web/diff.js:722`; für 404 `repository_fehlt` `web/diff.js:742` mit `rolle: 'status'`).
- **Der Halter greift per `id`, und die `id` sitzt innen:** `ansageBehalten(vorher, id)` (`web/app.js:1121`) hält „das Element mit dieser id“; `id="rv-meld"` trägt heute das innere `h2` (Fokusziel, `web/app.js:2311`/`:2318`), nicht das äußere `div.rv-meld` mit der Rolle.
- **Die Zählhilfe zählt das neue Einhängen:** `ansagenZaehlen`/`ansagenBeobachten` (`e2e/tests/hilfen.js:341–347`, `:349 ff.`) verzeichnet eine Live-Region, die mit Text **neu eingehängt** wird; ein vom Halter **zurückgesetzter** Knoten mit unverändertem Text zählt nicht.

Bestätigung aus dem Ursprungslauf: `gemeinsam/scratchpad/etst-245/bericht.md` Z. 22 und `probe3.spec.js` — echte 404 über einen weggenommenen Repository-Ordner, zwei Einhängungen von `.rv-meld` in 6–25 ms, `ansagenZaehlen` zwei Einträge; bestand schon vor #245 (target-247).

Ausgeschlossen: die zweite Zeichnung selbst (sie ist nötig, damit die Leiste aktuell ist — sie zu unterdrücken lässt sie veralten); die Nachbaransicht „Alle Änderungen“ (sagt seit R00230 in `#rv-ansage` genau einmal an); die 503/500-Fälle auf „Ein Commit“ (R00230 AK 6, heute grün).

### Betroffene Komponenten

- `web/app.js` — `render()` (Halter für `.rv-meld`), `ansageBehalten` (Halteziel) bzw. die neue Kennung am äußeren `div`
- `web/diff.js` — `meldungHtml` (Seitenmeldung; Kennung am äußeren Knoten, ohne das Fokusziel `#rv-meld` zu verschieben)
- neue Spec `e2e/tests/r00264-eine-ansage-ein-commit.spec.js`
- **Nicht** betroffen: Wortlaute, Ton, Symbol, Fokus, die 503/500-Fälle (R00230 AK 6), „Alle Änderungen“ (R00230/I0220), Dateifehler, CSS

## Lösungsvorschlag

### Langfristige Lösung

**Option A (gewählt; Grobentwurf des architekt, Lauf 254-architekt-1): den `role="status"`-Knoten der Seitenmeldung über die zweite Zeichnung halten** — die Hausform (`ansageBehalten`), die ADR-0018 N4 §5 voraussetzt, kleinster Eingriff. `render()` hält das äußere `div.rv-meld`, sodass die zweite Zeichnung denselben Knoten mit unverändertem Text zurückbringt und `ansagenZaehlen` nichts Neues verzeichnet.

### Alternative Ansätze

- **B Meldung ohne Live-Rolle, Ansage in einem neuen Statusbereich auf „Ein Commit“:** widerspricht ADR-0018 N4 §2, das die Rolle an den „Seitenmeldungen der Review-Seite“ ausdrücklich lässt. Verworfen.
- **C die zweite Zeichnung unterdrücken:** sie ist legitim (die Commit-Leiste hängt an `r.liste`); sie zu unterdrücken lässt die Leiste veralten. Verworfen.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Der Reproduktionstest ist ein E2E-Test im echten Programm (`e2e/tests/r00264-eine-ansage-ein-commit.spec.js`); Browser-Eigenes (Live-Region, Ein-/Aus-hängen im DOM) begründet die Ebene (`gemeinsam/regeln.md`, „Interactor je Interaction, E2E nur für den Hot Path“ + Browser-Eigenes). `GET …/commits` wird mit `page.route` **gehalten** und über ein Promise freigegeben; `GET …/diff` antwortet 404. Gezählt wird mit `ansagenZaehlen` ab dem Beginn nach der ersten Zeichnung. Heute rot: zwei Einträge. Der eigentliche Treiber ist damit die Seite selbst, kein internes Modul.

### Code-Extraktion für isoliertes Testing

Keine nötig. Der Unit-Test `e2e/einheit/diff-zeichnen.test.js` belegt zusätzlich, dass die Seitenmeldung weiterhin `role="status"` trägt (AK 4).

### Wächter der Probe

Die Mutante „zweites Einhängen“ — den Halter für den Meldungsknoten wieder entfernen (in einer **Kopie** des Standes, nicht im Worktree) — lässt den Knoten erneut entstehen und macht AK 1 rot (zwei Einträge mit demselben Text). Gegengeprobe: ändert sich der Text der Meldung zwischen den Zeichnungen, bleibt es bei genau einer Ansage (ein Knoten, eine Textänderung).

### Regressionstests

- „Alle Änderungen“ (R00230/I0220) und die 503/500-Fälle auf „Ein Commit“ (R00230 AK 6) bleiben grün.
- alle Tests aller Ebenen grün (Gate).

## Akzeptanzkriterien

**Ausgangslage:** Aufgabe #11 (bzw. eine Aufgabe mit mindestens einem Commit-Verweis) auf `…/aufgabe/11/review?commit=kd:<hash>` („Ein Commit“); Mensch `sh`, Browser headless, Chromium aus `e2e/node_modules`. `GET /api/aufgaben/11/commits` wird mit `page.route` gehalten, `GET …/diff?commit=…` antwortet **404** `{zustand: "repository_fehlt", grund: "…"}`. Kein Zeitmaß (ADR-0026).

**Zählfenster:** `ansagenZaehlen(page).beginnen()` **direkt nach** der ersten Zeichnung (die Seitenmeldung `.rv-meld` mit dem `repository_fehlt`-Satz steht); der Live-Knoten wird gemerkt (`window.kdRegion = document.querySelector('#review .rv-meld')`). Dann wird die Commit-Liste freigegeben; gezählt wird bis zur sichtbaren zweiten Zeichnung (zustandsgesteuert, z. B. ein Eintrag der Leiste — nicht über eine feste Zeit). Ein Ladesatz `#rv-laedt` („Liest den Diff von …“) ist als eigener Start erlaubt, höchstens einer.

### Bug behoben

- [ ] **AK 1 404 `repository_fehlt` wird genau einmal angesagt (heute rot):** Gegeben die Ausgangslage oben. Wenn die Commit-Liste freigegeben wird und die zweite Zeichnung sichtbar ist, dann ist `document.querySelector('#review .rv-meld')` **derselbe Knoten** wie `window.kdRegion`, und `ansagenZaehlen` verzeichnet für die Seitenmeldung **keinen zweiten** Eintrag (über beide Zeichnungen zusammen genau **eine** Ansage). Heute: zwei Einträge mit demselben Text (rot, `etst-245/bericht.md` Z. 22).
- [ ] **AK 2 Nachbarübergänge derselben Ansicht und Neuladen:** Mit demselben Zählfenster ergibt jeder der folgenden Fälle genau eine Ergebnisansage (höchstens ein Ladesatz). Die Knoten-Zusage („die Meldung bleibt derselbe Knoten“) gilt nur für die Fälle **ohne Ladephase** — die zweite Zeichnung (AK 1) und das Neuladen; wo ein Ladesatz dazwischen liegt, verlangt der Fall genau eine Ergebnisansage **nach dem Ladesatz**:
  - Diff endet mit 500 `{fehler: "kaputt"}`, mit 503 `{art: "antwortbudget"}` und mit 503 Zeitgrenze;
  - die Adresse nennt „Verweis ungültig“ (`web/app.js:2311`) und „Aufgabe gibt es nicht“ (`web/app.js:2312`);
  - „Erneut versuchen“ mit erneutem Fehler: dazwischen liegt der erlaubte Ladesatz, der `.rv-meld` entfernt — es gilt genau eine Ergebnisansage **nach dem Ladesatz** (keine Knoten-Zusage);
  - die Adresse **neu laden** an jeder Position (nach der ersten Zeichnung und nach der zweiten) — je genau eine Ergebnisansage, die Meldung bleibt derselbe Knoten.
- [ ] **AK 3 Mutant „zweites Einhängen“ rot:** Wird der Halter für den Meldungsknoten wieder entfernt (in einer Kopie des Standes, nicht im Worktree), dann ist AK 1 rot — `ansagenZaehlen` zählt zwei Einträge mit demselben Text. Der Mutant wird **rot**; das ist der Wächter dieser Zusage. Der Gegenlauf (Text der Meldung zwischen den Zeichnungen geändert) bleibt bei genau einer Ansage grün.
- [ ] **AK 4 Bestand und Abgrenzung:** Die Seitenmeldung behält `role="status"` (ADR-0018 N4 §2 — sie wird **nicht** entfernt); Wortlaut, Satz, `grund`, Symbol, Ton, „Zur Liste der Commits“ und der Fokus (`#rv-meld`) bleiben unverändert. „Alle Änderungen“ (R00230/I0220) und die 503/500-Fälle auf „Ein Commit“ (R00230 AK 6) sind unberührt. R00230 bleibt abgenommen; in ihren „Notizen“ steht höchstens **eine** Verweiszeile auf R00264. Die Probe führt kein Zeitmaß ein (ADR-0026 N5 Regel 12).

## Implementierungshinweise

- Das äußere `div.rv-meld` braucht ein Halteziel für den `render()` — eine eigene Kennung am `div` und `ansageBehalten` auf ein Halteziel statt auf „das Element mit dieser id“ verallgemeinern, **ohne** das Fokusziel `#rv-meld` am `h2` zu verschieben (`S.ui.fokus = '#rv-meld'`, `web/app.js:1597`/`:2311`/`:2318`). Die Wahl ist Sache des entwicklers; er nennt sie und den Beleg (AK 1 grün) im Bericht.
- Ein Knoten, der mit unverändertem Text zurückkehrt, zählt bei `ansagenZaehlen` nicht (ADR-0018 N4 §5) — darum genügt das Halten; ein zweites Ansagen-Ereignis wird dabei nicht verschluckt (Gegengeprobe in „Wächter der Probe“).
- Mutanten nur in einer Kopie des Standes, nie im Worktree; `mutanteEinsetzen` greift nur bei Pfaden unter `/web/…` (Lehre #247) — hier `web/app.js`, also geeignet. `page.unrouteAll()` nimmt die `KD_MUTANTE`-Route mit (Lehre #232): nach dem Zurücksetzen der Routen die Mutante neu einsetzen.
- Das Gate läuft nicht neben einem anderen Gate (gelerntes 2026-11-15). Keine Last- oder Dauerprobe (ADR-0026 N5 Regel 12).
- Die Verweiszeile in R00230 „Notizen“ setzt der entwickler beim Abschluss (Vorbild B1417 in R00262); R00264 selbst bleibt sonst der einzige neue Text.

## Offene Fragen

- Keine, die den Bau aufhält.

## Warum löst diese Anforderung das Problem? (Pflicht)

`#review` zeichnet zweimal — einmal für den Diff, einmal für die Commit-Leiste. Weil der Fehlerfall `#main` ganz ersetzt und kein Halter den Meldungsknoten sichert, entsteht die `role="status"`-Meldung beim zweiten Zeichnen neu mit gleichem Text; ein Bildschirmleser sagt sie zweimal an. Wenn `render()` den Knoten hält, kehrt er mit unverändertem Text an seinen Platz zurück, und `ansagenZaehlen` verzeichnet nichts Neues. Der Hebel ist der Halter in `render()` (die Hausform, die ADR-0018 N4 §5 voraussetzt), nicht die Live-Rolle an der Meldung (N4 §2 lässt sie ausdrücklich, weil „Ein Commit“ keinen Statusbereich hat) und nicht die zweite Zeichnung (die Leiste braucht sie). Danach ergibt jedes Ereignis dieser Ansicht genau eine Ansage.

## Notizen

- Priorität: Mittel (Barrierefreiheit; die Bedienung selbst wirkt). Fünfter Fall derselben Klasse (ADR-0018 N4).
- Betroffene Nutzer/Systeme: Mensch mit Bildschirmleser auf „Ein Commit“ der Review-Seite
- Workaround: keiner. Die zweite Ansage ist redundant, aber nicht falsch.
- **Berichtigung 2026-11-27 (#254):** AK 2 — die Knoten-Zusage („die Meldung bleibt derselbe Knoten“) gilt nur für die Fälle ohne Ladephase (zweite Zeichnung, Neuladen); „Erneut versuchen“ verlangt genau eine Ergebnisansage **nach dem Ladesatz** (Befund des entwicklertesters, `254-entwicklertester-1.md`, Anmerkung 1).
- **Herkunft der Zahlen:** die zwei Einhängungen in 6–25 ms und „zwei Einträge“ stammen aus `etst-245/bericht.md` Z. 22 und `probe3.spec.js`; die Fundstellen (`web/app.js:1121/1229–1264/1389–1412/1420–1436/1597/1611–1620/2311/2312/2318/2804–2823/3311–3345`, `web/diff.js:722/742`, `e2e/tests/hilfen.js:341–347/349`) sind am Stand `74e00eb2` abgelesen (Belege: `gemeinsam/scratchpad/arch-254/bericht-detail.md`).
- **Verworfene Alternativen** mit je einem Satz: siehe „Alternative Ansätze“ (B widerspricht N4 §2, C lässt die Leiste veralten).
- Kein Feature-Knoten nötig: ein prüfbares Verhalten (eine Ansage je Ereignis dieser Ansicht); eine Interaction mit zwei Bubbles (Vorbild I0220/R00230, I0242/R00252).
- `ursprungslauf: R00224` — die Seitenmeldung mit `role="status"` auf „Ein Commit“ und die Zusage „genau eine Ansage“ für sie stammen aus R00224 (AK 6/7, Karte #232), wo der Fall lebt. Der Fall bestand schon vor #245; R00230 AK 6 nannte für „Ein Commit“ nur 503 und 500.
- Nicht Teil: die 503/500-Fälle (R00230 AK 6), „Alle Änderungen“ (R00230/I0220), Wortlaute, Ton, Symbol, Fokus, `web/kd-app.css`. Keine sichtbare Gestaltung — keine Vorprüfung, kein Label `oberflaeche`.
- User Story nach dem Bug-Format: `user-stories/R00264.md`.
