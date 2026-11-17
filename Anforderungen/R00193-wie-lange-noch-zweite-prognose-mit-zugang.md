---
id: R00193
status: Erledigt
datum: 2026-11-17
---

# R00193: Wie lange noch — zweite Prognose „Mit Zugang wie in der Messbasis“

## Beschreibung

Herkunft: Karte #196 (aus #160 Punkt 2), Betreiber-Freigabe am 2026-11-17. „Wie lange noch“ ([R00046](R00046-wie-lange-noch.md)) simuliert nur den Abgang; der Hinweis „kein Ende absehbar“ ([R00168](R00168-wie-lange-noch-hinweis-wenn-der-zugang-den-abgang-erreicht.md)) sagt, dass die Prognose zu optimistisch ist, nennt aber kein Datum. Auf Boards, auf denen KI-Läufe laufend Aufgaben erzeugen, will der Betreiber eine Zahl, nicht nur die Warnung.

**Umfang:** Unter der Perzentil-Tabelle jedes Blocks mit Prognose steht, wenn der Zugang der Messbasis größer als 0 ist, eine zweite, gleich gebaute Tabelle „Mit Zugang wie in der Messbasis“: die Daten, bis die offenen Aufgaben abgearbeitet sind, wenn weiter Aufgaben im Tempo der Messbasis hinzukommen. Reicht der Abgang nicht, steht in der Zelle „kein Ende innerhalb von 365 Tagen“ statt eines Datums.

**Rechnung:** dieselbe Monte-Carlo-Technik. Je simuliertem Tag wird der Abgang wie bisher aus der Tagesreihe der Messbasis gezogen, dazu der Zugang aus der Zugangsreihe derselben Messbasis (je Tag „hinzugekommen − entfernt“ nach R00164, nie unter 0; getrennt für Kalender- und Arbeitstage wie `tagesreihen`). Stand = Stand + Zugang − Abgang, nie unter 0; fertig, wenn er 0 erreicht; Obergrenze 365 simulierte Tage. Die Abgangsziehung ist dieselbe wie in der ersten Tabelle (gleicher Seed), nur der Zugang kommt hinzu — deshalb ist „mit Zugang“ nie früher. Die zweite Rechnung wird wie die erste im Gedächtnis von `prognose` gemerkt und nicht für das Fever Chart (`nurLetzter`) gerechnet.

Keine Zeichnung nötig: eine zweite Tabelle im Muster der ersten, ohne neues Bedienelement und ohne neues CSS.

> **In Kauf genommen:** Der Zugang gilt gleichbleibend und ohne Sonderbehandlung von Rückläufern (wie in R00168); je Tag nie unter 0 heißt, dass ein Tag mit mehr entfernten als hinzugekommenen Aufgaben den Zugang anderer Tage nicht mindert — die Summe der Reihe kann daher über dem Zugang aus R00168 liegen. Die Tabelle irrt damit nur zur warnenden Seite.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“. Baut auf R00046, R00168, [R00164](R00164-burndown-zugang-und-abgang-je-tag.md) (Zugang je Tag), [R00047](R00047-termine-in-wie-lange-noch.md) (Termine) und [R00081](R00081-berichtsfilter-am-board.md); Technik nach [ADR-0027](../Dokumentation/ADRs/0027-eine-bestandsregel-fuer-alle-berichte.md) N4.

## Akzeptanzkriterien

**Rechenbeispiel A (aus R00168):** Zugang 1,0 und Abgang 0,4 je Kalendertag in der Messbasis, 6 offen. **Rechenbeispiel B (Unit, konstante Reihen):** 10 offen, Abgang 2 je Tag.

- [x] **AK 1 Zugang 0 (Zugang aus R00168 ist 0):** Es steht keine zweite Tabelle (sie wäre gleich der ersten); es bleibt der heutige Block.
- [x] **AK 2 Deterministisches Beispiel B:** Zugang 1 je Tag → p50 und p95 liegen bei 10 Tagen mit Zugang (5 ohne); Zugang 2 je Tag → „kein Ende innerhalb von 365 Tagen“.
- [x] **AK 3 Rechenbeispiel A (Abnahme der Karte):** Die zweite Tabelle zeigt für p50 und p85 „kein Ende innerhalb von 365 Tagen“ oder ein späteres Datum als die erste, nie ein früheres; der Hinweis „kein Ende absehbar“ steht weiter, die Tabelle steht daneben, nicht anstelle.
- [x] **AK 4 Nie früher:** In jedem Perzentil und für beide Wochen liegt „mit Zugang“ nicht vor „ohne Zugang“ (Unit über zufällige Reihen mit festem Seed).
- [x] **AK 5 Alles andere gleich:** Perzentile und Datumsspalten der ersten Tabelle, „Durchsatz Ø“, Diagramm, Fever Chart, Burndown, Durchsatz und Kumulativer Fluss ohne geänderte Erwartung; Board-Datei und API unverändert; das Fever Chart rechnet die zweite Prognose nicht mit.
- [x] **AK 6 Texte und Filter:** Überschrift der zweiten Tabelle „Mit Zugang wie in der Messbasis“ und ein Punkt in „Lesehinweise und Methodik“ sagen, was sie rechnet („Zugang wie in der Messbasis, ohne Rückläufer-Sonderbehandlung, gleichbleibend“) und dass sie bei hohem Zugang kein Ende finden kann; Messbasis-Filter und „Rechnen ab“ wirken auf Abgangs- und Zugangsreihe gleich (Beispiel A mit Messbasis 20 Tage statt 10: dieselben Tage für beide).

## Tests

Unit in `e2e/einheit/berichte.test.js` (AK 2, 4, 5 zuerst rot, weil das Feld fehlt); E2E als Spec am Rechenbeispiel A mit datierten Commits und fester Browser-Uhr (Vorbild `e2e/tests/r00168-zugang-gegen-abgang.spec.js`).

## Implementierungshinweise

- `ziehen` (`web/berichte.js`) bekommt eine Variante mit Zugangsreihe und Obergrenze 365; `prognoseRechnen` liefert je Block mit Prognose `ph.mitZugang` (Zeilen je Perzentil, bei „kein Ende“ ohne Datum), nicht mit `nurLetzter`; Zeichnung in `vPrognose` (`web/ansicht.js`) unter der ersten Tabelle, Spalten wie dort ohne „Nicht vor“.
- Die Zugangsreihe je Tag kommt aus `ereignisseJeTag`, dem Weg von `zugangZu`; die Tabelle steht nur, wenn `ph.zugang > 0`.
- **Nicht hinein:** Rückläufer-Sonderbehandlung · wachsender oder fallender Zugang · Zugang im Diagramm oder im Fever Chart.

## Offene Fragen

Keine (siehe Bericht zu Karte #196: Zugang je Tag nie unter 0 nach Empfehlung).

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung den Absatz „In Kauf genommen“ sagen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Wo laufend Aufgaben entstehen, nennt die Prognose ein Datum, das nie eintritt, und der Hinweis „kein Ende absehbar“ nennt gar keines. Rechnet eine zweite Tabelle denselben Weg mit dem Zugang der Messbasis (X), steht neben dem optimistischen Datum ein ehrliches oder die Aussage, dass es so nicht endet (Y), und der Betreiber entscheidet mit einer Zahl statt mit einer Warnung (Z).
