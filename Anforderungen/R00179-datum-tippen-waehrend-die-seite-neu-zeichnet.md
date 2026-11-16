---
id: R00179
status: Neu
datum: 2026-11-16
ursprung: Bug-Report
ursprungslauf:
---

# R00179: Behebung — Datum eintippen, während die Seite neu zeichnet: Eingabe springt zurück, nichts wird gespeichert

## Beschreibung

**Karte #189 (Fund des entwicklers an #188, Nachfolger von #180 / R00173):** Tippt jemand ein Datum in ein Datumsfeld, während die Seite neu zeichnet — ein [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) einer fremden Änderung (Mensch tippt, Agent schreibt) oder das Nachladen nach dem eigenen Speichern —, springt die Eingabe auf den Tag zurück. Aus „3112“ + „2026“ über dem gespeicherten 12.11.2026 wird 20.02.0006, gespeichert wird nichts. Ohne fremde Änderung ist dieselbe Eingabe grün.

Gemessen (Probe des entwicklers, `e2e`-tauglich, heute 6 von 6 rot): Durchsatz und Burndown, „Zeitraum von“. Nicht gemessen, am Code gleich gebaut: alle übrigen Datumsfelder (siehe Ursachenanalyse).

## Ursachenanalyse

Am Code gelesen, nicht gefahren; die erste Bubble misst je Feld.

- `render()` (`web/app.js` um `:1133`) ersetzt `#main` und `#over` vollständig (`innerHTML`, um `:1178–1181`). Das Datumsfeld ist danach ein **neues** Element. Der Sicherer (`fokusstand` / `fokusFuehren`) gibt ihm Fokus und Wert zurück — nicht aber, in welchem Teil des Felds (Tag, Monat, Jahr) getippt wurde. Der Browser beginnt wieder beim Tag: „2026“ landet als Tag 20, Monat 02, Jahr 0006.
- Die Regel aus R00173 hängt am alten Element: `datumstippen.feld` und `gehaltenesDatumsfeld` (`web/app.js` um `:2640–2643`) zeigen nach dem Zeichnen auf ein Element, das nicht mehr im Dokument ist. Das Jahr 0006 ist unfertig und wird gehalten — also nie gespeichert.
- Betroffen ist jedes Datumsfeld, das ein Zeichnen ersetzt: „Zeitraum von“ und „Zeitraum bis“ der Berichtsfilter (`data-bf`, in jedem Bericht mit Zeitraum), „Rechnen ab“ im Fever Chart (`data-fb="start"`), die Fälligkeit im Aufgabenfenster (`data-af="faellig"`); der Bauart nach auch die Felder mit Speichern per Knopf: Datum eines Termins (`data-tf="datum"`) und Fälligkeit der neuen Aufgabe (`data-nf="faellig"`) — dort springt die Eingabe, gespeichert wird ohnehin erst mit dem Knopf.

## Lösungsvorschlag

Solange in einem Datumsfeld eine getippte Eingabe läuft (erste Ziffer bis Speichern, Verwerfen oder Verlassen), wird das Feld nicht ersetzt: das Zeichnen wird aufgeschoben und danach genau einmal nachgeholt — Vorbild ist der Aufschub während eines Zuges (`S.ui.nachZug`, `web/app.js` um `:1135`). Nur Browser; Regel und Entscheidungstabelle aus R00173 (`datumsaenderung`, `web/eingabe.js`) bleiben unverändert.

## Test-Strategie

E2E im echten Programm mit `keyboard.type` (nie `fill()`), fremde Änderung als Commit im Ordner. Die Probe der Karte (`Software-Factory/gemeinsam/scratchpad/entw1-188/probe-live.spec.js`) wird Spec der Suite und ist **rot ohne Fix**. Achtung: sie wartet heute auf den Renderzähler (`kdTest.renders()`); wird das Zeichnen aufgeschoben, steigt er nicht — gewartet wird dann auf das angekommene Live-Ereignis, geurteilt am Endzustand (Feld, Datei, Verlauf erst nach dem Commit, `imVerlauf` aus r00173). Zwischen- und Endstand der Eingabe müssen sich unterscheiden (Lehre R00173), deshalb AK 4 mit eigenem Beispiel. Ist die Probe für ein Feld am heutigen Stand grün, entfällt dort der Umbau, der Test bleibt als Wächter.

## Akzeptanzkriterien

**Grundbestand:** eingerichteter Ordner, ein Board mit `report-filter: {period: eigen, from: 2026-11-12}` und einer Aufgabe #1 in der ersten Spalte, Identität gesetzt. „Fremde Änderung“ heißt: ein Commit im Ordner, der nicht aus dieser Seite kommt, und sein Live-Ereignis ist in der Seite angekommen. „Tippen“ heißt Taste für Taste.

- [ ] **AK 1 Abnahme-Probe der Karte #189:** Gegeben der geöffnete Durchsatz, in „Zeitraum von“ ist `3112` getippt. Wenn eine fremde Änderung eintrifft (Aufgabe #1 umbenannt) und danach `2026` getippt wird, dann zeigt das Feld 31.12.2026 und trägt den Fokus, und die Board-Datei trägt `from: 2026-12-31`. Dasselbe im Burndown; ohne fremde Änderung bleibt es grün. Heute: Feld 20.02.0006, Datei unverändert (6 von 6 rot). Spätestens wenn die Eingabe gespeichert oder das Feld verlassen ist, zeigt die Seite den fremden Stand (Probe: die fremde Änderung zieht #1 in die Abschlussspalte → der Durchsatz zählt danach 1).
- [ ] **AK 2 Alle Felder ohne Knopf:** Die Probe aus AK 1 gilt ebenso für „Zeitraum bis“, für „Rechnen ab“ im Fever Chart und für die Fälligkeit im Aufgabenfenster (fremde Änderung an einer anderen Aufgabe und an der geöffneten), mit Tastenabstand 120 und 900 ms: das Feld zeigt das getippte Datum, die Datei trägt es.
- [ ] **AK 3 Nachladen nach eigenem Speichern:** Gegeben der Durchsatz. Wenn in „Zeitraum von“ `01112026` getippt, mit Tab weitergegangen und ohne Warten in „Zeitraum bis“ `30112026` getippt wird — auch mit einem um 0,4 s gebremsten Commit (wie in #188 gemessen) —, dann trägt die Board-Datei `from: 2026-11-01` und `to: 2026-11-30`, und es sind genau zwei Speicherungen entstanden. Dasselbe für `12112026` in „Rechnen ab“ im Fever Chart bei gebremstem Commit (Vermutung der Karte, 10 von 10 rot — zuerst messen).
- [ ] **AK 4 Kein Zwischenstand (Regel aus R00173 gilt weiter):** Gegeben `from: 2026-11-12`, in „Zeitraum von“ ist `0503` getippt (Zwischenstand 05.03.2026). Wenn eine fremde Änderung eintrifft und danach `2027` getippt wird, dann trägt die Datei `from: 2027-03-05`, und es gibt genau einen Commit des Speicherns — keinen mit `2026-03-05`, `0002-`, `0020-` oder `0202-`. Wird stattdessen nach der fremden Änderung `20` getippt und das Feld verlassen, zeigt es wieder 12.11.2026, und es ist nichts gespeichert. Die Specs `r00173-*.spec.js` bleiben unverändert grün.
- [ ] **AK 5 Felder mit Knopf:** Gegeben das Formular „Neuer Termin“ bzw. „Neue Aufgabe“, im Datumsfeld ist `3112` getippt. Wenn eine fremde Änderung eintrifft und danach `2026` getippt wird, dann zeigt das Feld 31.12.2026, und der Knopf legt Termin bzw. Aufgabe mit dem 31.12.2026 an. Zuerst messen; ist es heute grün, bleibt der Test als Wächter.

## Implementierungshinweise

- **Nicht hinein:** Server, Dateiformat, die Entscheidungstabelle `datumsaenderung`; ein Umbau von `render()` auf teilweises Ersetzen.
- Der Aufschub endet mit der Eingabe (Speichern, Verwerfen, Verlassen), nicht nach einer Frist — eine Frist brächte den Fehler bei langsamem Tippen (900 ms) zurück.
- Kein neuer sichtbarer Text, keine Zeichnung; Route, API und Dateiformat unverändert.

## Offene Fragen

Keine, die den Bau aufhalten. An den product-owner (im Bericht des planers, Empfehlung eingebaut): Dauer des Aufschubs (AK 1, letzter Satz) und Umfang um die Felder mit Knopf (AK 5).

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: ein Zeichnen ersetzt das Datumsfeld mitten in der Eingabe, und das neue Feld beginnt wieder beim Tag. Wird das Feld während einer laufenden Eingabe nicht ersetzt (X), landen die folgenden Ziffern dort, wo der Mensch sie hintippt, und die Regel aus R00173 sieht weiter dasselbe Feld (Y); gespeichert wird das fertig getippte Datum, und die fremde Änderung erscheint, sobald die Eingabe zu Ende ist (Z).

## Notizen

- Heimat: I0169 unter D0006, braucht I0163 (R00173). Die Fälligkeit im Aufgabenfenster und die Felder mit Knopf gehören fachlich zu D0003 bzw. D0002 und werden hier mitgebaut, weil sie dieselbe Ursache und dieselbe Abhilfe teilen (wie in R00173).
- Workaround heute: Kalender oder Pfeiltasten; oder das Datum erneut tippen, wenn gerade niemand sonst schreibt.
- `ursprungslauf` leer: Bestand seit dem vollständigen Ersetzen beim Zeichnen, durch R00173 erst erreichbar geworden (vorher scheiterte das Tippen schon an der ersten Jahresziffer).
- Verworfen: das Feld nach dem Zeichnen wieder einhängen oder den Teil des Felds wiederherstellen — der Browser gibt den Teil (Tag, Monat, Jahr) nicht preis und setzt ihn beim erneuten Fokus zurück.
