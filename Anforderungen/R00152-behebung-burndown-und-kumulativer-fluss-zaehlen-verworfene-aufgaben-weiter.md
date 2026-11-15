---
id: R00152
status: Neu
datum: 2026-11-15
ursprung: Bug-Report
ursprungslauf: R00121
---

# R00152: Behebung — Burndown und Kumulativer Fluss zählen außerhalb der Abschlussspalte archivierte Aufgaben weiter als offen

## Beschreibung

Eine Aufgabe, die außerhalb der Abschlussspalte archiviert wird (verworfen), zählt im Bericht „Burndown“ und im Bericht „Kumulativer Fluss“ weiter als offen und im Umfang; der Bericht „Wie lange noch“ nimmt dieselbe Aufgabe ab ihrem Archivtag aus dem Umfang. Zwei Berichte nennen für denselben Tag verschiedene Zahlen offener Aufgaben.

Reproduzierbar (Grundbestand B unten): zehn Aufgaben, fünf erledigt, eine der fünf offenen am 05.11.2026 im „Eingang“ archiviert. Am 06.11. zeigt der Burndown „offen 5, Umfang 10“, „Wie lange noch“ „Umfang 9, offen 4“. Erwartet: beide „offen 4, Umfang 9“; die Tage vor dem 05.11. bleiben, wie sie sind.

Diese Anforderung legt die Zählweise des Bestands für Burndown, Kumulativen Fluss und „Wie lange noch“ auf **eine** Regel (ADR-0027) und hält fest, wie die Berichte archivierte, vom Board genommene, endgültig gelöschte und zurückgelaufene Aufgaben zählen (Regel des product-owner vom 2026-11-14). Keine neue Anzeige, keine neue Einstellung, kein geänderter Text.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“.

## Ursachenanalyse

### Root Cause

- Archivieren schreibt nur `archived: <heute>` in die Aufgabendatei; die Board-Zeile bleibt stehen (`src/dienst/archiv.rs:7`, `:21`). Die Bewegungen kennen deshalb keinen Wechsel am Archivtag (`src/verlauf.rs:78–86`).
- Burndown und Kumulativer Fluss fragen nur „liegt in einer Spalte“ (`web/berichte.js:131`, `:153–159`, `:188–195`) und lesen `archiviert` nicht.
- Die Regel „archiviert außerhalb der Abschlussspalte heißt verworfen“ steht genau einmal, eingebettet in „Wie lange noch“ (`web/berichte.js:473–475`).
- Ebenso betroffen: die Zeile „Ausgenommen (`reporting.burndown: false`)“ unter Burndown und Kumulativem Fluss (`web/berichte.js:137–140`, `web/ansicht.js:1202`, `:1217`) zählt eine verworfene, ausgenommene Aufgabe mit (geprobt: 1 statt 0); „Wie lange noch“ zählt sie dort nicht (`e2e/einheit/berichte.test.js:352`).

Ausgeschlossen: Server, `GET /api/bewegungen`, Dateiformat — die Bewegungen sind richtig, es fehlt die Auswertung des Archivtags im Client. Durchsatz und Durchlaufzeit rechnen aus dem ersten Erreichen und sind nicht betroffen (geprobt).

### Betroffene Komponenten

- `web/berichte.js`: `zaehltMit`/`ausgenommen` (`:131–140`), `burndown` (`:144–164`), `fluss` (`:171–204`), `prognoseRechnen` (`:463–520`).
- `e2e/einheit/berichte.test.js`; E2E `e2e/tests/r00044-burndown.spec.js`, `r00121-fluss.spec.js`, `r00046-wie-lange-noch.spec.js`.

## Zählweise (Regel des product-owner: jede Anforderung für einen Bericht nennt sie ausdrücklich)

**Bestand** einer Aufgabe an einem Tag (Stand am Tagesende, heute: jetzt), eine Regel für Burndown, Kumulativen Fluss und „Wie lange noch“:

1. **nicht da** — die Aufgabe liegt an dem Tag in keiner Spalte des Boards (nie dort gewesen, vom Board genommen, endgültig gelöscht): zählt nicht.
2. **entfernt** (verworfen) — die Aufgabe trägt einen Archivtag, der Tag liegt am oder nach dem Archivtag (ab 0 Uhr), und sie liegt **nicht** in der Abschlussspalte: zählt weder in „offen“ noch in „Umfang“ bzw. „gesamt“ noch in einem Band.
3. **da** — sonst; **erledigt**, wenn sie in der Abschlussspalte liegt, sonst **offen**. Archiviert in der Abschlussspalte bleibt erledigt.

| Fall | Burndown (offen / Umfang) | Kumulativer Fluss (Bänder, offen, gesamt) | „Wie lange noch“ (Umfang, offen) | Durchsatz, Durchlaufzeit, Fluss „angekommen“/„fertig“ |
|---|---|---|---|---|
| archiviert außerhalb der Abschlussspalte | ab dem Archivtag weder offen noch Umfang | ab dem Archivtag in keinem Band | ab dem Archivtag kein Umfang (wie bisher), zählt unter „verworfen“ | unverändert: was vor dem Archivieren erreicht war, zählt weiter; „angekommen“ sinkt nicht |
| archiviert in der Abschlussspalte | bleibt Umfang, erledigt | bleibt im Band der Abschlussspalte | bleibt Umfang, erreicht | zählt weiter |
| vom Board genommen | ab dem Tag weder offen noch Umfang (wie bisher) | ab dem Tag in keinem Band (wie bisher) | ab dem Tag kein Umfang (wie bisher) | zählt weiter, wenn vorher erreicht |
| endgültig gelöscht | wie „vom Board genommen“; unter Personen-, Label- oder Farbfilter rückwirkend an keinem Tag | ebenso | ebenso | ohne Filter zählt sie weiter; unter Personen-, Label- oder Farbfilter verschwindet sie |
| zurückgelaufen (aus der Abschlussspalte zurück) | zählt wieder als offen | wechselt in das Band ihrer Spalte | zählt wieder als offen | zählt nur das erste Erreichen; „fertig“ sinkt nicht |
| archiviert und zurückgeholt | zählt an allen Tagen wieder | ebenso | ebenso | unverändert |

**Entscheidungen des product-owner (2026-11-15, `AI-Team/po-entscheidungen.md`, wörtlich):**

- Endgültig gelöscht: „Eine endgültig gelöschte Aufgabe fällt ab ihrem Löschtag aus dem Bestand. Unter einem Personen-, Label- oder Farbfilter verschwindet sie zusätzlich rückwirkend aus allen früheren Tagen und aus dem Durchsatz, weil ohne Datei weder Person noch Label bekannt sind; ohne Filter bleiben die Tage vor dem Löschtag unverändert.“
- Zurückgeholt und mehrfach archiviert: „Eine Aufgabe zählt ab ihrem Archivtag nicht mehr zum Bestand. Wird sie zurückgeholt, zählt sie an allen Tagen wieder, als wäre sie nie weg gewesen; bei mehrfachem Archivieren wirkt nur der letzte Archivtag. Für den Abgang je Tag heißt das: ‚− entfernt‘ steht am letzten Archivtag, die Rückkehr erscheint als ‚+‘, und die Legende sagt, dass ‚erledigt‘ über dem Durchsatz liegen kann.“ — Der Satz ab „Für den Abgang je Tag“ gilt der Folgekarte #154; diese Anforderung baut keinen Abgang je Tag und keine Legende.

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0027 (Option B, Akzeptiert): **eine reine Bestandsfunktion** in `web/berichte.js` neben `spalteAm` — aus `(wechsel, archiviert, t, erledigtSpalten)` wird der Zustand „nicht da“, „entfernt“ oder „da“ (mit Spalte und „erledigt“). Burndown, Kumulativer Fluss und „Wie lange noch“ lesen ihre Bestandsgrößen nur aus dieser Funktion; die eingebettete Bedingung in `:475` geht darin auf. `erledigtSpalten` ist Parameter, heute die letzte Spalte. Der Archivtag kommt aus der Aufgabenliste des Clients (`aufgabeZu(nr).archiviert`). Ereignisgrößen (Durchsatz, Durchlaufzeit, „angekommen“, „fertig“) bleiben unberührt; Filter (`ohneSpalten`, `aufgabePasst`, `reporting`) wirken wie bisher außerhalb der Funktion.

### Alternative Ansätze

- **Bedingung aus `:475` nach Burndown und Fluss kopieren** — die Regel stünde dreimal; derselbe Drift, der diesen Fehler erzeugt hat (ADR-0027 Option A).
- **Archivstand in die Verlaufsstrecke des Servers** — geschichtstreu, aber Vertragsänderung an `GET /api/bewegungen` und gegen p95 < 200 ms bei 5.000 Aufgaben unvermessen; für die Abnahme nicht nötig, vom product-owner verworfen (ADR-0027 Option C, Umkehrpunkt).

## Test-Strategie

### Unit Test zur Bug-Reproduktion

`node --test e2e/einheit/berichte.test.js`: Grundbestand A, Stand 10.11.2026 — `burndown` liefert am 06.11. `offen 1, umfang 3`. **Rot ohne Fix** (geprobt am Stand `karte/155`: 2 / 4). Ebenso `fluss` am 06.11.: Bänder 1·0·2 (heute 2·0·2).

### Code-Extraktion für isoliertes Testing

Die Bestandsfunktion ist rein und wird für sich getestet (fünf Fälle des Grundbestands A, dazu die Grenze Vortag/Archivtag und die Aufgabe ohne Datei).

### Regressionstests

- Unit: ein Test „gleiche Zahl offen“ über Burndown, Kumulativen Fluss und „Wie lange noch“ am selben Datensatz, je Tag; Festhalte-Tests für Durchsatz, „angekommen“, „fertig“.
- Bestehende Tests von „Wie lange noch“ bleiben unverändert grün (`berichte.test.js:200`, `:352`).
- E2E im echten Programm: die Abnahme-Probe der Karte (Grundbestand B) an Burndown und „Wie lange noch“; bestehende Specs `r00044`, `r00121`, `r00046`, `r00122` grün.

## Akzeptanzkriterien

**Grundbestand A** (Probe des Architekten, ADR-0027; herstellbar über die API und datierte Commits der Board-Datei wie `e2e/tests/r00121-fluss.spec.js:9`, Archivtag als `archived:` in der Aufgabendatei): Board „fabrik“, Spalten „Eingang“, „In Arbeit“, „Fertig“ (Abschlussspalte). 02.11.2026: #1–#7 in „Eingang“ angelegt, alle zuständig „st“. 03.11.: #2, #4, #6 nach „Fertig“. 06.11.: #3 archiviert (liegt in „Eingang“), #4 archiviert (liegt in „Fertig“), #5 endgültig gelöscht (lag in „Eingang“), #6 endgültig gelöscht (lag in „Fertig“), #7 vom Board genommen. Stand: 10.11.2026, ohne Filter.

Zustand am 10.11.: #1 da, offen · #2 da, erledigt · #3 entfernt · #4 da, erledigt · #5, #6, #7 nicht da.

| Tag | 02.11. | 03.–05.11. | 06.–10.11. heute (Fehler) | 06.–10.11. richtig |
|---|---|---|---|---|
| Burndown offen / Umfang | 7 / 7 | 4 / 7 | 2 / 4 | **1 / 3** |
| Fluss Bänder Eingang · In Arbeit · Fertig | 7 · 0 · 0 | 4 · 0 · 3 | 2 · 0 · 2 | **1 · 0 · 2** |
| Fluss offen / gesamt | 7 / 7 | 4 / 7 | 2 / 4 | **1 / 3** |
| Fluss angekommen · fertig | 7 · 0 | 7 · 3 | 7 · 3 | 7 · 3 |
| „Wie lange noch“ offen / Umfang (Verlauf) | 7 / 7 | 4 / 7 | 1 / 3 | 1 / 3 |

**Grundbestand B** (Abnahme der Karte; bildet die Zahlen der Probe des realist-consultant nach — „Burndown offen 5, Prognose offen 4“): dasselbe Board. 02.11.2026: #1–#10 in „Eingang“. 03.11.: #1–#5 nach „Fertig“. 05.11.: #6 archiviert (liegt in „Eingang“). Stand: 06.11.2026, ohne Filter.

| Tag | 02.11. | 03.11. | 04.11. | 05.11. | 06.11. |
|---|---|---|---|---|---|
| Burndown offen / Umfang heute (Fehler) | 10 / 10 | 5 / 10 | 5 / 10 | 5 / 10 | 5 / 10 |
| Burndown offen / Umfang richtig | 10 / 10 | 5 / 10 | 5 / 10 | **4 / 9** | **4 / 9** |
| „Wie lange noch“ offen / Umfang | 10 / 10 | 5 / 10 | 5 / 10 | 4 / 9 | 4 / 9 |

### Bug behoben (Pflicht)

- [ ] **AK 1 Burndown:** Gegeben Grundbestand A, wenn der Burndown gelesen wird, dann nennt er je Tag offen / Umfang 7 / 7 (02.11.), 4 / 7 (03.–05.11.) und 1 / 3 (06.–10.11.). Rechnung am 10.11.: #1 offen, #2 und #4 erledigt → Umfang 3, offen 1; #3 ist entfernt.
- [ ] **AK 2 Kumulativer Fluss:** Gegeben Grundbestand A, wenn der Kumulative Fluss gelesen wird, dann stehen die Bänder „Eingang · In Arbeit · Fertig“ bei 7 · 0 · 0 (02.11.), 4 · 0 · 3 (03.–05.11.) und 1 · 0 · 2 (06.–10.11.), „offen“ und „gesamt“ wie in AK 1; „angekommen“ ist an jedem Tag 7, „fertig“ 0 am 02.11. und 3 ab dem 03.11.
- [ ] **AK 3 Eine Zahl je Tag:** Gegeben Grundbestand A, wenn Burndown, Kumulativer Fluss und der Verlauf von „Wie lange noch“ gelesen werden, dann nennen alle drei an jedem der neun Tage dieselbe Zahl offener Aufgaben und denselben Umfang (7 / 7, dreimal 4 / 7, fünfmal 1 / 3).
- [ ] **AK 4 Abnahme der Karte (wörtlich):** In der Probe des realist-consultant (eine Aufgabe außerhalb der Abschlussspalte archiviert) zeigen Burndown und „Wie lange noch“ am selben Tag dieselbe Zahl offener Aufgaben; die Tage vor dem Archivtag bleiben unverändert. — Gegeben Grundbestand B im echten Programm, wenn Burndown und „Wie lange noch“ geöffnet werden, dann zeigt die Tabellenansicht des Burndown am 05.11. und 06.11. offen 4 und Umfang 9 und die Tabellenansicht von „Wie lange noch“ an denselben Tagen Umfang 9 und in der Spalte „noch nicht in „Fertig““ 4; am 02.–04.11. stehen in beiden 10 / 10, 5 / 10, 5 / 10; der Kopf von „Wie lange noch“ lautet „5 von 9 fertig“.
- [ ] **AK 5 Grenze Archivtag:** Gegeben Grundbestand A, dann zählt #3 am 05.11. (Vortag) in „offen“ und „Umfang“ und am 06.11. (Archivtag) nicht mehr — auch wenn der Stand „06.11., 12:00 Uhr“ ist (heutiger Tag: 1 / 3).
- [ ] **AK 6 Archiviert in der Abschlussspalte bleibt erledigt:** Gegeben Grundbestand A, dann zählt #4 ab dem 06.11. weiter im Umfang und im Band „Fertig“ (Band „Fertig“ 2 = #2 und #4), nicht in „offen“.
- [ ] **AK 7 Zeile „Ausgenommen“:** Gegeben Grundbestand A und #3 trägt `reporting.burndown: false`, wenn Burndown oder Kumulativer Fluss am 10.11. gelesen werden, dann steht unter „Nicht enthalten“ „Ausgenommen: 0“ (heute 1) und der Burndown nennt 6 / 6, 3 / 6, 1 / 3.
- [ ] **AK 8 Rot ohne Fix:** Die Tests zu AK 1 und AK 2 sind am Stand vor dem Fix rot (Burndown und Fluss am 06.11.: 2 / 4) und mit Fix grün; der Commit nennt das Ergebnis.

### Zählweise festgehalten (heute schon so, bleibt)

- [ ] **AK 9 „Wie lange noch“ unverändert:** Gegeben Grundbestand A, dann nennt „Wie lange noch“ am 10.11. Umfang 3, offen 1 und „verworfen 1“ — wie vor dem Fix; die bestehenden Tests des Berichts bleiben ohne Änderung ihrer Erwartungen grün.
- [ ] **AK 10 Durchsatz zählt weiter:** Gegeben Grundbestand A ohne Filter, dann ist der Durchsatz gesamt 3 (am 03.11.: #2, #4, #6) — die danach archivierte #4 und die danach gelöschte #6 zählen weiter.
- [ ] **AK 11 Vom Board genommen und endgültig gelöscht:** Gegeben Grundbestand A ohne Filter, dann zählen #5, #6 und #7 bis zum 05.11. im Bestand (Umfang 7) und ab dem 06.11. nicht mehr; die Tage vor dem 06.11. bleiben unverändert.
- [ ] **AK 12 Gelöscht unter Filter:** Gegeben Grundbestand A und der Filter „nur Person st“, dann nennt der Burndown 5 / 5 (02.11.), 3 / 5 (03.–05.11.) und 1 / 3 (06.–10.11.), der Fluss „angekommen“ 5 und „fertig“ 2, der Durchsatz gesamt 2 — die gelöschten #5 und #6 fehlen rückwirkend an allen Tagen.
- [ ] **AK 13 Zurückgeholt:** Gegeben Grundbestand A und #3 ist zurückgeholt (kein Archivtag mehr), dann nennen Burndown, Fluss und „Wie lange noch“ am 06.–10.11. 2 / 4 — #3 zählt an allen Tagen wieder.
- [ ] **AK 14 Mehrfach archiviert:** Gegeben Grundbestand A und #3 ist zurückgeholt und am 09.11. erneut archiviert (Archivtag 09.11.), dann nennen die drei Berichte 2 / 4 am 06.–08.11. und 1 / 3 am 09.–10.11.
- [ ] **AK 15 Zurückgelaufen:** Gegeben Grundbestand A und #2 geht am 08.11. aus „Fertig“ zurück nach „In Arbeit“, dann nennen die drei Berichte ab dem 08.11. 2 / 3, die Bänder stehen bei 1 · 1 · 1, „fertig“ bleibt 3 und der Durchsatz gesamt 3.
- [ ] **AK 16 Ausgeschlossene Spalte (Grenzfall Filter):** Gegeben Grundbestand A und die Spalte „Eingang“ ist ausgeschlossen, dann nennt der Burndown 0 / 0, 0 / 3 und ab dem 06.11. 0 / 2 — wie vor dem Fix.
- [ ] **AK 17 Leerfall:** Gegeben Grundbestand B ohne archivierte Aufgabe, dann nennen Burndown, Fluss und „Wie lange noch“ dieselben Zahlen wie vor dem Fix (10 / 10, danach 5 / 10).

### Bauart (ADR-0027)

- [ ] **AK 18 Eine Stelle:** In `web/berichte.js` liest außerhalb der Bestandsfunktion keine Bestandsgröße `archiviert` und keine prüft „liegt in einer Spalte“ selbst; die Bedingung aus `:475` gibt es nicht mehr als zweite Fassung. „Erledigt“ ist Parameter der Funktion (`erledigtSpalten`), heute die letzte Spalte.
- [ ] **AK 19 Nichts Sichtbares außer den Zahlen:** Kein Text, keine Legende, kein Element der Berichte ist geändert; Server, `GET /api/bewegungen` und Dateiformat sind unverändert.

## Implementierungshinweise

- Zahlen dieser Anforderung sind geprobt (planer, 2026-11-15, node gegen `web/berichte.js` am Stand `karte/155`, Ist und Soll je Tag); weicht der Bau von einer Zahl ab, ist das ein Befund — melden, nicht die Erwartung anpassen.
- Aufgabe ohne Datei (`aufgabeZu(nr)` liefert `undefined`): kein Archivtag, also nie „entfernt“ — #5 und #6 im Grundbestand A.
- Der Archivtag gilt ab 0 Uhr Ortszeit des Browsers (`isoTag`), wie heute in `:475`.
- `prognose` merkt nach Inhalt (`:454–455`, `archiviert` steht im Schlüssel) — bleibt.
- `verworfen` und `ausgenommen` in `prognoseRechnen` (`:517–518`) aus demselben Zustand bilden („entfernt“ bzw. „da“).
- `fluss` rechnet die Wechsel je Aufgabe einmal in Millisekunden vor (`:177–182`); die Bestandsfunktion darf den Bericht bei 5.000 Aufgaben nicht je Tag neu parsen lassen (Lastprofil der ADR).
- E2E: Archivtag in der Vergangenheit entsteht über `archived: 2026-11-05` in der Aufgabendatei und einen Commit; die Uhr des Browsers nach ADR-0026 Regel 6 fest stellen.
- Ausgegrenzt: „Bestand nach Labels“ (`offeneAufgaben`, `:650–654`), Kostenbericht, Fever Chart (rechnet über `prognose`, ändert sich nicht).

## Offene Fragen

Keine, die den Bau aufhält. An den product-owner (Empfehlung des planers: in #155 nichts ändern, Abgrenzung der Karte): Der Kopf des Burndown sagt „offen = nicht in der Abschlussspalte“, und anders als „Wie lange noch“ nennen Burndown und Kumulativer Fluss unter „Nicht enthalten“ keine Zahl der verworfenen Aufgaben. Ob der Leser das erfahren soll, entscheidet sich mit „− entfernt“ in #154.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: am selben Tag nennt der Burndown „offen 5“, „Wie lange noch“ „offen 4“, weil nur ein Bericht den Archivtag liest. Lesen alle drei Bestandsberichte den Zustand einer Aufgabe aus einer Funktion (X), dann kann eine verworfene Aufgabe nur noch in allen dreien zugleich zählen oder nicht zählen (Y), und die Zahlen offener Aufgaben stimmen je Tag überein; die Tage vor dem Archivtag bleiben, weil die Regel erst ab dem Archivtag greift (Z). Eine Stelle statt dreier Kopien, weil #154, #156 und #157 „entfernt“ und „erledigt“ an denselben Schleifen brauchen — sonst entsteht derselbe Fehler beim nächsten Umbau wieder.

## Notizen

- Priorität: Hoch — Voraussetzung für #154 („− entfernt“ wäre sonst falsch). Workaround: verworfene Aufgaben vom Board nehmen statt archivieren.
- **Herkunft:** Karte #155 (Befund K1 des realist-consultant auf #154, Betreiber-Auftrag 2026-11-14; vom product-owner als eigene Bugkarte eingeordnet). Technik: ADR-0027 (Akzeptiert). Bezug: R00023, R00044, R00046, R00081, R00121, R00122.
- **Heimat:** eigene Interaction `I0139` unter D0006; I0044 (R00044), I0046 (R00046) und I0111 (R00121) bleiben abgenommen und zu.
- **Präzisierung zu R00121** („Eine Aufgabe, die das Board verlässt (archiviert, ‚vom Board genommen‘), fällt ab diesem Tag aus dem Stapel“): archiviert **in der Abschlussspalte** bleibt im Band der Abschlussspalte (Karte #155, „archiviert in der Abschlussspalte bleibt erledigt“; Regel wie „Wie lange noch“).
- **Probe des realist-consultant:** sein Datensatz mit 10 Aufgaben ist nicht überliefert (Karte und Protokoll nennen nur „Burndown offen 5, Prognose offen 4“); Grundbestand B bildet diese Zahlen nach.
- **Akzeptierte Schwächen (ADR-0027):** zurückgeholte Aufgaben zählen rückwirkend; nur der letzte Archivtag wirkt; gelöschte Aufgaben verlieren ihre Merkmale. Umkehrpunkt: Option C der ADR, eigene Karte.
- Labels der Karte: `architektur` (ADR-0027 nennt den Review-Punkt für `code-reviewer` und `architektur-reviewer`).
