---
id: R00173
status: Erledigt
datum: 2026-11-16
ursprung: Bug-Report
ursprungslauf:
---

# R00173: Behebung — eigener Berichtszeitraum: getipptes Datum wird nach der ersten Jahresziffer gespeichert; Bis-Tag an der Zeitumstellung mit 24 Stunden gerechnet

## Beschreibung

**Fehler A, Karte #180 (UX-Review von #165, Bestand):** In den Feldern „Zeitraum von“ und „Zeitraum bis“ der Berichte lässt sich ein Datum nicht eintippen. Nach der ersten Jahresziffer speichert die Seite `from: 0002-11-12` in die Board-Datei (ein Commit), zeichnet neu, und das Feld ist leer. Kalender und Pfeiltasten gehen; die Tests setzen das Datum mit `fill()` in einem Zug und sehen es nicht.

**Fehler B, Karte #181 (Code-Review von #165):** Endet ein eigener Zeitraum an einem Tag der Zeitumstellung, fehlt in Burndown, Durchsatz, Kumulativem Fluss und Durchlaufzeit die letzte Stunde des Tages (Herbst, 25 Stunden) oder die erste Stunde des Folgetags zählt mit (Frühjahr, 23 Stunden). Benannte Zeiträume sind nicht betroffen; der Kostenbericht ist seit #165 für sich behoben.

Ursache und Abhilfe hat der architekt am Code gelesen, nicht gefahren; die erste Bubble je Fehler misst ihn am heutigen Stand.

## Ursachenanalyse

**A:** Der `change`-Zweig für `data-bf="von|bis"` (`web/app.js` um `:2469–2500`) speichert sofort und ruft `render()`. Ein Datumsfeld meldet eine Änderung, sobald es ein vollständiges Datum trägt — nach der ersten Jahresziffer ist „0002“ eines, der Server nimmt es an, und das Neuzeichnen verwirft die Teil-Eingabe. Gleich gebaut: „Rechnen ab“ im Fever Chart (`data-fb="start"`, um `:2488`) und die Fälligkeit im Aufgabenfenster (`data-af="faellig"`, um `:2518`).

**B:** `zeitraumGrenzen` (`web/berichte.js` um `:27`, Fall `eigen`) rechnet die Obergrenze als Tagesanfang plus 24 Stunden statt als Beginn des Folgetags. Dieselbe Rechnung steckt in der Anzeige des Bis-Tags (`web/ansicht.js` um `:1175`, `isoD(g.bis - 864e5)`).

## Lösungsvorschlag

**A, nur Browser:** Im `change`-Zweig gilt für die drei Stellen eine Schwelle: Jahr unter 1000 und das Feld hat den Fokus → weder speichern noch zeichnen. Kommt das `change` beim Verlassen und das Jahr ist weiter unter 1000 → nicht speichern, das Feld zeigt wieder den gespeicherten Wert.

**B:** `zeitraumGrenzen` bildet die Obergrenze in Kalenderrechnung (00:00 Ortszeit des Folgetags). Die Sonderstelle des Kostenberichts (`web/kosten.js`, `kostenbereich`/`beginnDesFolgetags`) entfällt — eine Quelle. Die Anzeige des Bis-Tags rechnet ebenfalls in Kalendertagen.

> **Folge von B — bei der Auslieferung sagen:** Zahlen ändern sich nur in Burndown, Durchsatz, Kumulativem Fluss und Durchlaufzeit, nur bei eigenem Zeitraum, dessen Bis-Tag ein Tag der Zeitumstellung ist. Der Kostenbericht bleibt unverändert.

## Test-Strategie

A: E2E im echten Programm mit `keyboard.type` (nie `fill()`), gewartet wird auf den Zustand. B: Einheitstest mit TZ Europe/Berlin. AK 1 und AK 6 sind je die erste Bubble und **rot ohne Fix**; das gemessene Ergebnis steht im Commit. Ist die Probe für ein Nachbarfeld (AK 9) am heutigen Stand grün, entfällt dort der Umbau, der Test bleibt als Wächter.

## Akzeptanzkriterien

**Grundbestand:** eingerichteter Ordner, ein Board ohne gespeicherten Berichtszeitraum, Identität gesetzt.

Fehler A — Datum tippen (F0141):

- [x] **AK 1 Abnahme-Probe der Karte #180:** Gegeben ein geöffneter Bericht mit Zeitraum. Wenn in „Zeitraum von“ `12112026` getippt wird (Abstand der Tasten 0, 120 und 900 ms), dann zeigt das Feld 12.11.2026, die Board-Datei trägt `from: 2026-11-12`, und es gibt keinen Commit mit `0002-`. Heute: Commit mit `0002-11-12`, Feld leer.
- [x] **AK 2 Bis-Tag und Durchsatz:** Dasselbe gilt für „Zeitraum bis“ und im Durchsatz; je getipptem Datum entsteht genau ein Speichern (ein Commit).
- [x] **AK 3 Unfertig verlassen:** Wird das Feld mit unfertigem Jahr verlassen (getippt `12112`), dann ist nichts gespeichert (kein Commit), und das Feld zeigt den gespeicherten Wert — leer, wenn es keinen gibt.
- [x] **AK 4 Wie heute:** Kalender, Pfeiltasten und die bestehenden Specs (`fill()`) speichern und zeigen wie vor der Karte.
- [x] **AK 5 Altbestand:** Ein gespeichertes `from: 0002-11-12` wird im Feld gezeigt und lässt sich durch ein getipptes Datum überschreiben.
- [x] **AK 9 Nachbarfelder:** Die Probe aus AK 1 gilt ebenso für „Rechnen ab“ im Fever Chart und für die Fälligkeit im Aufgabenfenster: das Feld zeigt 12.11.2026, die Datei trägt das Datum, kein Commit mit `0002-`.

Fehler B — Bis-Tag an der Zeitumstellung (F0142):

- [x] **AK 6 Abnahme-Probe der Karte #181:** Einheitstest mit TZ Europe/Berlin. Eigener Zeitraum bis 25.10.2026: eine Bewegung am 25.10. um 23:30+01:00 zählt zum Zeitraum. Eigener Zeitraum bis 29.03.2026: eine Bewegung am 30.03. um 00:30+02:00 zählt nicht. Die Summe aus „bis Tag X“ und „ab Tag X+1“ ergibt alle Bewegungen. Das Bis-Feld eines benannten Zeitraums, der am 29.03.2026 endet, zeigt den 29.03. (heute den 28.03.).
- [x] **AK 7 Eine Quelle:** Der Kostenbericht nimmt seine Grenzen aus `zeitraumGrenzen` ohne Sonderstelle; seine Umstellungstests bleiben unverändert grün.
- [x] **AK 8 Sonst nichts:** Die festen Vergleiche von Burndown, Durchsatz, Kumulativem Fluss und Durchlaufzeit bleiben an allen übrigen Tagen unverändert grün.

## Implementierungshinweise

- **In Kauf genommen:** Der Server nimmt ein Jahr unter 1000 weiter an (`ist_datum`, `src/modell/board.rs` um `:296–308`). Eine Ablehnung würde Boards mit gespeichertem `0002` für jede Filteränderung sperren.
- **Nicht hinein:** Schwelle am Server; Datumsfelder mit Speichern per Knopf (Termin, neue Aufgabe) — nicht betroffen.
- Die Fälligkeit im Aufgabenfenster gehört fachlich zum Dialog Aufgabe und wird hier mitgebaut, weil sie denselben Zweig und dieselbe Schwelle teilt.
- Kein neuer sichtbarer Text, keine Zeichnung; Route, API und Dateiformat unverändert.

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Auslieferungsnotiz zu Fehler B (hervorgehobener Absatz oben).

## Warum löst diese Anforderung das Problem? (Pflicht)

A — Auslöser: die erste Jahresziffer macht das Feld zu einem vollständigen Datum. Speichert und zeichnet die Seite bei einem Jahr unter 1000 nicht (X), bleibt die Eingabe im Feld stehen (Y), und gespeichert wird erst das fertig getippte Datum (Z). B — Auslöser: ein Bis-Tag mit 23 oder 25 Stunden. Liegt die Obergrenze am Beginn des Folgetags (X), gehört jede Bewegung des Bis-Tags und keine des Folgetags zum Zeitraum (Y), und alle Berichte samt Kostenbericht rechnen mit derselben Grenze (Z).

## Notizen

- Heimat: I0163 unter D0006; F0141 (Fehler A) und F0142 (Fehler B) sind einzeln auslieferbar. Bezug: R00171 (Karte #165).
- Workaround heute: A — Kalender oder Pfeiltasten; B — keiner.
- `ursprungslauf` leer: Bestand, kein einzelner Slice zuzuordnen.
- Nacharbeit B1 (Reviews von #180), unmögliches Datum: Solange im Feld Ziffern getippt werden, gilt kein Zwischenstand als Absicht — auch nicht der leere, den das Feld meldet, wenn es den getippten Tag im Monat nicht gibt (31.11., 30.02.). Gespeichert wird das Datum, sobald das Jahr zu Ende getippt und das Datum gültig ist, sonst beim Verlassen oder mit Enter, wenn das Feld ein gültiges Datum trägt; trägt es beim Verlassen keines, zeigt es wieder den gespeicherten Wert, und nichts ist gelöscht. Geleert wird mit Rücktaste, Entf oder durch Setzen in einem Zug. Über die Schwelle „Jahr unter 1000“ der Abhilfe hinaus werden auch getippter Tag und Monat gehalten (gemessen: über einem gespeicherten Datum sind sie sofort ein gültiges Datum).
