---
id: R00061
status: Neu
datum: 2026-10-18
ursprung: Bug-Report
ursprungslauf: R00054
---

# R00061: Behebung der unzuverlässigen E2E-Tests der WBS-Sicht unter paralleler Last

## Beschreibung

Im vollständigen Playwright-Lauf (4 Worker) scheitern Tests der WBS-Sicht gelegentlich, ohne dass sich Code geändert hat. Reproduzierbar mit `cd e2e && npx playwright test tests/r00054-wbs-sicht.spec.js tests/r00056-wbs-knoten.spec.js --repeat-each 4`: auf dem Stand b8df541 (vor R00059) 4 von 40 Läufen rot, nach R00059 ähnlich.

- `r00054-wbs-sicht.spec.js:42` „Tabelle: Einrückung …“ — `getComputedStyle(td).paddingLeft` ergibt `NaN`
- `r00054-wbs-sicht.spec.js:63` „US-2: Dialog zuklappen …“ — `toBeHidden` scheitert, die Zeilen bleiben sichtbar
- `r00054-wbs-sicht.spec.js:82` „US-1: Kopf zeigt Stand …“ — Zeitüberschreitung nach 30 s
- `r00054-wbs-sicht.spec.js:99` „US-3: Editor im Arbeits-Repository …“
- `r00056-wbs-knoten.spec.js:33` „US-1: Interaction unter einem Dialog anlegen …“

Erwartet: jeder Test ist in jedem Lauf grün. Tatsächlich: einzelne Läufe rot, beim Wiederholen grün.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“ (verlässliche Gates vor dem Push).

## Ursachenanalyse

### Root Cause
Nicht belegt. Hypothese: ein zweites `render()` (Live-Ereignis aus dem Arbeits-Repository oder nachlaufendes `laden()` nach dem Sprung `#/wbs/<kürzel>/<id>`) ersetzt die Tabelle zwischen dem Auflösen des Locators und `evaluate` (ein gelöstes `td` liefert dann leeres `paddingLeft` → `NaN`) bzw. setzt einen soeben geänderten Klappzustand zurück. Ausgeschlossen: R00059 als Ursache (rot auch auf b8df541).

### Betroffene Komponenten
- `web/app.js` `laden`, `ereignis`, `wbs-gehe` (Sprungmarke `wbsGesprungen`)
- `src/waechter.rs` (Ereignisse für fremde WBS-Dateien)
- `e2e/tests/r00054-wbs-sicht.spec.js`, `e2e/tests/r00056-wbs-knoten.spec.js`

## Lösungsvorschlag

### Langfristige Lösung
Ursache mit Trace (`--trace on`) und Zählung der `render()`-Aufrufe je Test belegen; ist es ein überzähliges Neuladen, das Neuladen nach eigenen Schreibzugriffen in der WBS-Sicht entprellen; die Tests warten danach auf einen eindeutigen Ruhezustand (z. B. `html[data-live="verbunden"]` und eine Stand-Kennung der WBS) statt auf Momentaufnahmen.

### Alternative Ansätze
- Wiederholungen (`retries`) in der Playwright-Konfiguration — verdeckt den Fehler, statt ihn zu beheben.
- Weniger Worker — macht das Gate langsamer und die Ursache bleibt.

## Test-Strategie

### Unit Test zur Bug-Reproduktion
Ein Test, der `laden()` zweimal kurz hintereinander auslöst und prüft, dass ein gewählter Klappzustand und die Sprungmarke erhalten bleiben (rot vor dem Fix).

### Code-Extraktion für isoliertes Testing
Den Klapp- und Sprungzustand aus `laden` in eine reine Funktion in `web/wbs.js` ziehen.

### Regressionstests
`--repeat-each 10` über die WBS-Specs mit 4 Workern ohne rote Läufe.

## Akzeptanzkriterien
- [ ] Der Reproduktionstest ist ohne Fix rot und mit Fix grün
- [ ] `npx playwright test tests/r00054-wbs-sicht.spec.js tests/r00056-wbs-knoten.spec.js --repeat-each 10` ist ohne roten Lauf
- [ ] Keine neuen Fehler: alle Tests aller Ebenen grün

## Implementierungshinweise
Gefunden im Lauf R00059 (Phase 8, vorbestehende Failures); Beleg in `kanbanD-anmerkungen.md` Nr. 122.

## Offene Fragen
- Liegt die Ursache im Programm (überzähliges Neuladen) oder nur im Test (Momentaufnahme ohne Warten)?

## Warum löst diese Anforderung das Problem? (Pflicht)
Ein Gate, das ohne Änderung rot wird, lehrt, rote Läufe zu ignorieren; dann rutscht auch ein echter Fehler durch. Wird die Ursache belegt und das Neuladen bzw. das Warten im Test deterministisch, ist jeder rote Lauf wieder ein Befund.

## Notizen
- Nicht inline in R00059 repariert: kein Bezug zur Anforderung (Kernprinzip „vorbestehende Probleme werden dokumentiert“).
