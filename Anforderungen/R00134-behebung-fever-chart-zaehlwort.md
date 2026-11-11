---
id: R00134
status: Neu
datum: 2026-11-11
ursprung: Bug-Report
ursprungslauf: R00078
---

# R00134: Behebung des Zählworts in der Fortschrittszeile des Fever-Charts

## Beschreibung

Beim Öffnen des Berichts „Projekt-Fever-Chart“ rechnet kanbanD die fehlenden Tage nach und schreibt über dem Diagramm „rechnet n von m Tagen …“. Das Zählwort steht dort wörtlich in der Mehrzahl „Tagen“, auch wenn unmittelbar davor die Zahl 1 steht. Nach der Regel des Auftraggebers richtet sich das Zählwort nach der Zahl unmittelbar davor (PO-Entscheidung zu #18, `AI-Team/po-entscheidungen.md` Z. 117–120, Frage 1: 1 → Einzahl); bei einem fehlenden Tag muss die Zeile „rechnet 1 von 1 Tag …“ heißen.

Fundstellen (gelesen am 2026-11-11): `web/ansicht.js:1301` (erste Zeichnung des Berichts) und `web/app.js:292` (Fortschritt während der Rechnung) tragen beide dasselbe wörtliche „Tagen“. Die bestehende Zählwort-Hilfe `zaehlwort` (`web/kosten.js:35–38`, aus R00105 / PO Z. 117) wird an keiner der beiden Stellen benutzt.

Zahlt ein auf: [Vision](R00000-vision.md) — „Eine festgelegte Kultur“ (die Oberfläche ist deutsch und folgt gewohnten Konventionen).

### Domänenbezug

- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)

## Ursachenanalyse

### Root Cause

Belegt im Code (gelesen am 2026-11-11):

- **Erste Zeichnung** (`web/ansicht.js:1300–1301`): `const lauf = u.fieberLauf && …; const status = \`… ${lauf ? \`rechnet ${u.fieberLauf.n} von ${u.fieberLauf.von} Tagen …\` : …}\``. Das Zählwort „Tagen“ ist ein Literal; die Zahl davor ist `u.fieberLauf.von`.
- **Fortschritt** (`web/app.js:289–292`): `if (i % 4 === 3) { lauf.n = i + 1; … el.firstChild.textContent = \`rechnet ${lauf.n} von ${lauf.von} Tagen … \`; }`. Dasselbe Literal; die Zahl davor ist `lauf.von`.
- Die reine Hilfe `zaehlwort(zahl, einzahl, mehrzahl)` existiert seit R00105 und liefert genau die Regel von PO Z. 117, liegt aber im Kostenmodul `web/kosten.js` und wird hier nicht gerufen. `web/kosten.js` selbst nutzt sie nicht — ihre Aufrufer sind der Kostenbericht (`web/ansicht.js:1037`, `:1041`).

Ausgeschlossen:

- Der **Cache-Zweig derselben Zeile** (`web/ansicht.js:1301`, `st.cache.length === 1 ? 'Tag' : 'Tage'`) ist schon richtig (Probe: genau ein Tag im Cache → „1 Tag aus dem Cache“).
- Die Hilfe selbst ist richtig (`e2e/einheit/kosten.test.js:203–207`): `zaehlwort(1, …) = 'Aufgabe'`, `(0)`, `(2)`, `(11)` → `'Aufgaben'`.
- Nicht betroffen sind die übrigen Zählstellen der Oberfläche (PO Z. 117 nennt sie als Vorbild).

**Zusatzbefund zur Sichtbarkeit** (Probe des planers, headless Chromium, 2026-11-11, eigenes Wegwerf-Programm): Die Fortschrittszeile wird heute **erst beim vierten fehlenden Tag** in den DOM geschrieben (`web/app.js:289`, `i % 4 === 3`). Gemessen: mit 1 bzw. 2 fehlenden Tagen erscheint **keine** „rechnet …“-Zeile (nur der Cache-Text); mit 5, 30 fehlenden Tagen erscheint „rechnet 4 von 5 Tagen …“, „rechnet 4 von 30 Tagen …“ usw. Der Zweig der ersten Zeichnung (`ansicht.js:1301`) wurde auch bei 60 fremden Änderungen während der Rechnung nie sichtbar. Die wörtliche Mehrzahl ist damit heute nur dort sichtbar, wo sie ohnehin stimmt. Die Abnahme-Probe der Karte #53 („mit genau einem Tag → von 1 Tag“, heute rot) ist deshalb **nicht ohne eine kleine Verhaltensänderung prüfbar** — die Zeile muss schon beim ersten fehlenden Tag erscheinen (Lösungsvorschlag Punkt 3, FA 3).

### Betroffene Komponenten

- `web/kultur.js` — nimmt `zaehlwort` auf (Anzeigeform an der Zeichengrenze, ADR-0013)
- `web/kosten.js` — gibt `zaehlwort` ab (Definition und Export)
- `web/ansicht.js:1301` — Statuszeile des Fever-Charts
- `web/app.js:289–292` — Fortschritt während der Nachtrag-Rechnung
- `e2e/einheit/kosten.test.js`, `e2e/einheit/kultur.test.js` (Unit), neu `e2e/tests/r00134-fieber-zaehlwort.spec.js`

## Lösungsvorschlag

### Langfristige Lösung

Architektur bindend (Board-Kommentar #53; ADR-0013, ADR-0019; keine Technikfrage, kein neues ADR):

1. **Eine Zählwort-Hilfe an einer Stelle.** `zaehlwort` zieht von `web/kosten.js` nach `web/kultur.js` (reines Modul, im Browser und in Node, wie `zeiten.js`/`kosten.js`; ADR-0013 „Anzeige an der Zeichengrenze“). Bedeutung unverändert: 1 → Einzahl, sonst Mehrzahl (PO Z. 117). `web/kosten.js` definiert und exportiert sie nicht mehr.
2. **Beide Fever-Stellen nutzen sie.** `web/ansicht.js:1301` und `web/app.js:292` bilden das Wort über `zaehlwort(<Zahl unmittelbar davor>, 'Tag', 'Tagen')` — an beiden Stellen ist das `…von`. Der Kostenbericht (`web/ansicht.js:1037`, `:1041`) ruft dieselbe Hilfe aus `web/kultur.js` und bleibt im Verhalten unverändert.
3. **Die Fortschrittszeile erscheint schon beim ersten fehlenden Tag.** `web/app.js:289` schreibt den Fortschritt künftig beim ersten Tag wie auch weiter bei jedem vierten (`i === 0 || i % 4 === 3`), damit die Zeile bei einem fehlenden Tag sichtbar ist und die Abnahme-Probe der Karte #53 („mit genau einem Tag → von 1 Tag“) erfüllt werden kann.

### Alternative Ansätze

- **A — nur die zwei Stellen mit einer lokalen Bedingung nachbessern** (`von === 1 ? 'Tag' : 'Tagen'`): verworfen — zweimal dieselbe Regel neben der vorhandenen Hilfe; widerspricht „eine Regel an einem Ort“ (PO Z. 17) und der Vorgabe der Architektur.
- **B — eine eigene Fieber-Hilfe `fieberFortschritt(n, von)` in `web/berichte.js`**: verworfen — die Anforderung ist ein Zählwort, keine neue Rechnung; ein zweiter Satzbauer neben den zwei Aufrufstellen wäre mehr Code als die zwei Aufrufe.
- **C — die Zeile vor der Schleife einmal setzen** („rechnet 0 von m Tagen …“): verworfen — die Karten-Probe nennt „von 1 Tag“, die Zahl davor ist die Gesamtzahl; ein Vorlauf mit 0 nennt das Falsche.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

`e2e/einheit/kultur.test.js` (node --test): `zaehlwort` aus `web/kultur.js` — `1 → 'Tag'`, `0`, `2`, `11 → 'Tagen'`; die Datei `web/kosten.js` exportiert `zaehlwort` nicht mehr (`e2e/einheit/kosten.test.js:203` auf `web/kultur.js` umgestellt). Wächter gegen eine zweite Hilfe: `grep -rn "function zaehlwort" web/` findet nur `web/kultur.js`.

### Code-Extraktion für isoliertes Testing

Keine. `zaehlwort` ist bereits eine reine Funktion; die Zeichenketten der beiden Stellen bleiben inline (Vorgabe der Architektur: an beiden Stellen nutzen). Die Regel ist über die E2E-Probe an der sichtbaren Zeile gedeckt.

### Regressionstests

- Der Kostenbericht liefert dieselben Texte („0 von 1 Aufgabe, nach Filter“, „1 von 1 Aufgabe mit Etikett“) — `e2e/tests/r00105-kostenbericht.spec.js` bleibt grün.
- Die Fortschrittszeile mit vier fehlenden Tagen bleibt „rechnet 4 von 4 Tagen …“; der Cache-Zweig „1 Tag aus dem Cache“ / „2 Tage aus dem Cache“ unverändert.
- Wächter: `e2e/einheit/kultur.test.js`, `e2e/tests/r00078-fieber.spec.js` grün.

## Akzeptanzkriterien

Gegeben jeder E2E-Prüfung: eigener Ordner mit Git, Board `entwicklung` mit acht Aufgaben, letzte Bewegung gestern; Projektstart `start` auf den Tag `heute − m` gesetzt; Zieltermin und Puffer gesetzt; Cache `berichte/entwicklung-fieber.md` ohne die m fehlenden Tage; die Anfrage `POST /api/boards/entwicklung/fieber/cache` wird von der Probe **angehalten**, damit die Fortschrittszeile sichtbar bleibt (Muster der gehaltenen Anfragen in `e2e/tests/r00103-sichtzustand.spec.js`).

### Bug behoben (Pflicht)

- [ ] Der Reproduktionstest ist ohne Fix rot und mit Fix grün
- [ ] Der ursprüngliche Fehler tritt im Szenario der User Story nicht mehr auf
- [ ] Keine neuen Fehler: alle Tests aller Ebenen grün

### Zählwort (Unit)

- [ ] Gegeben die Hilfe aus `web/kultur.js`, wenn `zaehlwort(1, 'Tag', 'Tagen')` gerufen wird, dann `'Tag'`; `(0)`, `(2)` und `(11)` → `'Tagen'` (nur die Zahl 1, nicht die Endziffer)
- [ ] Gegeben `web/kosten.js`, wenn es geladen wird, dann exportiert es `zaehlwort` nicht mehr, und `web/kultur.js` tut es (`grep -rn "function zaehlwort" web/` findet nur `web/kultur.js`)

### Fortschrittszeile (E2E)

- [ ] Gegeben m = 1 fehlender Tag, wenn der Bericht geöffnet wird, dann enthält `#fieber-lauf` „rechnet 1 von 1 Tag …“ — heute entsteht keine Zeile (rot) und mit Fix „von 1 Tag“
- [ ] Gegeben m = 2 fehlende Tage, wenn der Bericht geöffnet wird, dann enthält die Zeile „rechnet 1 von 2 Tagen …“ — heute rot
- [ ] Gegenprobe m = 4: die Zeile zeigt zuerst „rechnet 1 von 4 Tagen …“ und nach dem vierten Tag „rechnet 4 von 4 Tagen …“ (die Häppchen-Meldung jedes vierte Tage bleibt)
- [ ] Grenzfall m = 0 (Start heute): keine „rechnet“-Zeile, der Bericht zeigt den Cache-Text
- [ ] Mutanten: nähmen die beiden Stellen je ein Literal `'Tagen'` bzw. `'Tag'`, dann ist m = 1 bzw. m = 2 rot

### Cache-Zweig (Regression, heute grün)

- [ ] Gegeben genau ein Tag im Cache, wenn der Bericht fertig gerechnet ist, dann steht dort „1 Tag aus dem Cache …“
- [ ] Gegeben zwei Tage im Cache, dann „2 Tage aus dem Cache …“

### Eine Regel an einem Ort

- [ ] Der Kostenbericht ruft dieselbe Hilfe aus `web/kultur.js`; seine Texte sind unverändert („0 von 1 Aufgabe, nach Filter“, „1 von 1 Aufgabe mit Etikett“), kein zweites Zählwort neben `zaehlwort`

## Implementierungshinweise

- Reihenfolge: `web/kultur.js` um `zaehlwort` erweitern (in die `Object.assign`-Liste am Ende aufnehmen) → `e2e/einheit/kultur.test.js` ergänzen, `e2e/einheit/kosten.test.js:203–207` auf `web/kultur.js` umstellen → `zaehlwort` aus `web/kosten.js` (Definition und Export, `:36` und `:103`) entfernen → beide Fever-Stellen umstellen → `web/app.js:289` auf `i === 0 || i % 4 === 3`.
- Ladereihenfolge in `web/index.html` stimmt: `kultur.js` (Zeile 17) vor `kosten.js` (28), `ansicht.js` (32) und `app.js` (33); die Hilfe ist als Global verfügbar.
- `web/app.js:292` schreibt den Text in den ersten Textknoten von `#fieber-lauf` (Element aus `web/ansicht.js:1301`); die Bedingung `el && el.firstChild` bleibt.
- Keine Änderung an Rechnung, Cache-Schlüssel, API oder Dateiformat.
- Nach `test-ehrlichkeit`: der Reproduktionstest (m = 1) ist heute rot (keine Zeile); er muss die sichtbare Zeile prüfen, nicht den Quelltext.

## Offene Fragen

- keine im Sinne einer Richtungsfrage. Die Frage „Wie wird die Karten-Probe prüfbar?“ beantwortet der planer mit FA 3 (erste Häppchen-Meldung), weil die Zeile sonst für m = 1 nie erscheint; die Entscheidung steht im Bericht und in den Notizen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass die Fortschrittszeile des Fever-Charts das Zählwort fest auf „Tagen“ setzt, während die Zahl davor 1 sein kann — eine Ausnahme von der Oberflächenregel „1 → Einzahl“ (PO Z. 117). Zieht die eine Zählwort-Hilfe von `web/kosten.js` nach `web/kultur.js` und rufen beide Fever-Stellen sie, dann richtet sich das Wort automatisch nach der Zahl davor und niemand kann die Regel an einer dritten Stelle erneut falsch abschreiben; dass die beiden Stellen heute mit demselben Literal doppelt existieren, ist genau der Hebel: eine Hilfe, zwei Aufrufe, keine Kopie. Die kleine Verhaltensänderung in `web/app.js:289` macht die Zeile bei einem fehlenden Tag sichtbar — ohne sie ist die Zusage „von 1 Tag“ nirgends zu beobachten und nicht abnehmbar. Die Fortschrittszeile ist die einzige Stelle des Berichts mit einem Zählwort; Rechnung, Cache und Datei bleiben unberührt, die Anforderung ist klein, umkehrbar und ohne Wirkung auf Daten.

## Notizen

- Priorität: Niedrig (Rechtschreib-/Konsistenzbefund, PO-Entscheidung zu #18, eigener kleiner Befund für den Director)
- Betroffene Nutzer/Systeme: jeder Mensch, der den Projekt-Fever-Chart öffnet, während fehlende Tage nachgerechnet werden
- Workaround: keiner nötig
- Herkunft: Karte #53 „Fever-Chart: „rechnet n von m Tagen“ ohne Einzahl“ (Label bug), PO-Entscheidung zu #18 (`AI-Team/po-entscheidungen.md` Z. 117–120); betroffener WBS-Knoten I0066 / Bubble B0225 (D0006)
- **Entscheidung des planers (Bericht):** FA 3 (Fortschrittszeile schon beim ersten fehlenden Tag, `web/app.js:289`) ist neu gegenüber dem Auftrag. Begründung: Probe 2026-11-11 zeigt, dass die Zeile heute erst ab vier fehlenden Tagen geschrieben wird; die Abnahme-Probe der Karte #53 („mit genau einem Tag → von 1 Tag“) ist sonst nicht erfüllbar, und die Anforderung hätte keinen roten Reproduktionstest. Die Architekturvorgabe (Hilfe nach `kultur.js`, an beiden Stellen nutzen) wird unverändert umgesetzt; FA 3 kommt hinzu. Verworfen: die Zeile gar nicht sichtbar machen und nur den Quelltext statisch prüfen (verletzt test-ehrlichkeit: kein echter Zustand).
- Verworfen: eigene Zählwort-Hilfe im Kostenmodul belassen und im Fever-Chart nachahmen; die Zeile vor der Schleife mit 0 setzen (Alternative A und C oben)
- Sichtbarkeitsbefund (Beleg): eigene Wegwerf-Instanz, headless Chromium, Board mit 8 bzw. 40 Aufgaben, Bericht `#/berichte/fieber`; mit m = 1/2 fehlenden Tagen erschien nie eine „rechnet“-Zeile, mit m = 5/30/4 „rechnet 4 von 5 Tagen“, „rechnet 4 von 30 Tagen“, auch bei 60 fremden Änderungen während der Rechnung war der Zweig der ersten Zeichnung nicht sichtbar
