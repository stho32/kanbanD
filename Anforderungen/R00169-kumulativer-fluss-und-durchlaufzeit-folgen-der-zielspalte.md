---
id: R00169
status: Erledigt
datum: 2026-11-16
---

# R00169: Kumulativer Fluss und Durchlaufzeit folgen der Zielspalte des Boards

## Beschreibung

Herkunft: Auftrag des Betreibers vom 2026-11-14 (Karte #154), Zuschnitt des product-owner (`AI-Team/po-entscheidungen.md`, 2026-11-14, #154 → #157, #159), hier Karte #159, vom Betreiber am 2026-11-14 freigegeben. **Zweck: Die Berichte eines Boards widersprechen sich nicht.** Seit [R00166](R00166-erledigt-heisst-je-board-fuer-burndown-durchsatz-und-fever-chart.md) gilt „Erledigt heißt“ für Burndown, Durchsatz und Fever Chart; Kumulativer Fluss und Durchlaufzeit rechnen noch fest bis zur letzten Spalte.

**Umfang:** Der Zielspalte des Boards (`fever: {target-column: …}`) folgen zusätzlich der **Kumulative Fluss** („offen“ und „fertig“) und die **Vorgabe „bis“ der Durchlaufzeit**; „von“ und „bis“ der Durchlaufzeit bleiben frei wählbar. Technik nach [ADR-0027](../Dokumentation/ADRs/0027-eine-bestandsregel-fuer-alle-berichte.md), Nachtrag N5 — kein Eingriff in Server, API oder Dateiformat.

> **Achtung, Randfall — ändert bestehende Zahlen, wenn die Abschlussspalte im Berichtsfilter ausgeschlossen ist** (und keine Zielspalte gewählt): Dann zählt der letzte sichtbare Block, als wäre er gewählt — der, den die Auswahl als „(Standard)“ zeigt. Burndown und Kumulativer Fluss zählen Aufgaben in diesem Block als erledigt statt offen; der Durchsatz zählt, statt „ausgeschlossen“ zu melden; das Fever Chart rechnet schon so (AK 8). Auf allen anderen Boards bleibt ohne Wahl alles gleich. Bei der Auslieferung ausdrücklich sagen.

**So gebaut, vom Betreiber nicht eigens entschieden** (Auslegung des architekt, ADR-0027 N5 Punkt 3): Die Karte sagt, eine abweichende Wahl von/bis der Durchlaufzeit „wird gespeichert“. Gemerkt wird sie **am Gerät je Board** (`localStorage`), nicht in der Board-Datei; auf die Vorgabe zurückgestellt, folgt der Bericht wieder dem Board.

**In Kauf genommen:** Auf Boards mit eingebetteter Phase liegt das Ziel des Burndowns eine Spalte früher als die Vorgabe „bis“ der Durchlaufzeit (ADR-0027 N5 Punkt 4).

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“. Baut auf R00166, [R00121](R00121-bericht-kumulativer-fluss-cfd.md) (Kumulativer Fluss), [R00045](R00045-durchlaufzeit-als-eigener-bericht.md) (Durchlaufzeit) und [R00081](R00081-berichtsfilter-am-board.md) (Berichtsfilter).

## Akzeptanzkriterien

**Ausgangslage (Rechenbeispiel aus R00166, um den Kumulativen Fluss ergänzt):** Board A · B · C · Erledigt (ohne Phasen), drei Aufgaben, Zeitraum 02.11.–04.11., kein weiterer Filter. Von Hand gerechnet.

| Tag | Was geschieht | Bänder A · B · C · Erledigt | ohne Wahl: Burndown offen · Umfang | ohne Wahl: Fluss offen · fertig · gesamt | Zielspalte B: Burndown offen · Umfang | Zielspalte B: Fluss offen · fertig · gesamt |
|---|---|---|---|---|---|---|
| 02.11. | #1, #2, #3 in A angelegt | 3 · 0 · 0 · 0 | 3 · 3 | 3 · 0 · 3 | 3 · 3 | 3 · 0 · 3 |
| 03.11. | #1 nach B; #2 nach B; #3 nach Erledigt | 0 · 2 · 0 · 1 | 2 · 3 | 2 · 1 · 3 | 0 · 3 | 0 · 3 · 3 |
| 04.11. | #1 weiter nach C; #2 zurück nach A | 1 · 0 · 1 · 1 | 2 · 3 | 2 · 1 · 3 | 1 · 3 | 1 · 3 · 3 |

Lesart: Mit Zielspalte B ist Fluss „offen“ die Summe der Bänder links von B, also Band A (3 · 0 · 1) — dieselbe Zahl wie Burndown „offen“. „fertig“ zählt das erste Erreichen und sinkt nicht: am 04.11. bleibt es 3, obwohl #2 zurück in A ist; deshalb ist offen + fertig (1 + 3) dort nicht „gesamt“ (3).

**Randfall am selben Beispiel:** keine Zielspalte, Spalte „Erledigt“ im Berichtsfilter ausgeschlossen — die Auswahl zeigt „C (Standard)“. Am 04.11. steht #1 in C: „offen“ ist in Burndown und Fluss 1 (heute 2), der Durchsatz zählt am 04.11. eine Aufgabe (heute: Meldung „ausgeschlossen“). 02.11. und 03.11. bleiben bei „offen“ 3 und 2.

### Feature 1 — Kumulativer Fluss folgt der Zielspalte (F0134)

- [x] **AK 1 Ohne Wahl:** Ohne gespeicherte Zielspalte und ohne ausgeschlossene Abschlussspalte sind alle Zahlen und Texte aller Berichte wie vor der Karte (Beispiel: Spalten „ohne Wahl“).
- [x] **AK 2 Eine Zahl:** Mit Zielspalte B gilt an jedem Tag bei gleichem Filter: Burndown „offen“ = Fluss „offen“ und Burndown „Umfang“ = Fluss „gesamt“; ohne Phasen ist Fluss „offen“ die Summe der Bänder links von B (Beispiel: 3 · 0 · 1 und 3 · 3 · 3).
- [x] **AK 3 „fertig“:** „fertig“ steigt, wenn eine Aufgabe erstmals B oder eine Spalte rechts davon erreicht, und sinkt bei Rücklauf nicht (Beispiel: 0 · 3 · 3).
- [x] **AK 4 Unberührt:** Bänder, „gesamt“ und „angekommen“ ändern sich durch die Wahl nicht (Beispiel: Spalte „Bänder“ in beiden Fällen gleich). **Ausnahme (Code-Review 2026-11-16, AK 2 geht vor):** Eine Aufgabe, die in einer Spalte des Zielblocks links der Abschlussspalte archiviert ist, gilt mit Wahl als erledigt statt verworfen und bleibt deshalb in ihrem Band und in „gesamt“ — so wie im Umfang des Burndowns seit R00166; ohne Wahl fällt sie ab dem Archivtag heraus.
- [x] **AK 7a Texte im Fluss:** Über dem Diagramm steht die Zeile „Erledigt heißt“ wie im Burndown; die Kopfleiste sagt „fertig heißt: in „B“ oder rechts davon“, die Legende „fertig (ab „B“)“. Der Satz zur Geltung der Auswahl nennt in Burndown, Durchsatz, Fever Chart und Fluss auch den Kumulativen Fluss. Gestaltung nach der Zeichnung `Dokumentation/Wireframes/D0006.dc.html#fluss-erledigt-heisst`.
- [x] **AK 8 Randfall:** Ist die Abschlussspalte im Berichtsfilter ausgeschlossen und nichts gewählt, rechnen Burndown, Fluss, Durchsatz und Fever Chart bis zum Block, den die Auswahl als „(Standard)“ zeigt (Beispiel: Absatz „Randfall“).
- [x] **AK 9 Phasen:** Auf einem Board mit Phasen und gewählter Phase gilt AK 2 ebenso.
- [x] **AK 10 Bleibt:** „Wie lange noch“ zeigt mit und ohne Wahl dieselben Zahlen; der gespeicherte Verlauf des Fever Charts wird durch die Karte nicht neu gerechnet, auch nicht im Randfall.

### Feature 2 — Durchlaufzeit öffnet mit „bis“ Zielspalte (F0135)

- [x] **AK 5 Vorgabe:** Mit Zielspalte B öffnet die Durchlaufzeit mit „bis B“; „von“ ist die erste Spalte (Beispiel: von A bis B). Ohne Zielspalte wie bisher bis zur letzten Spalte.
- [x] **AK 6 Abweichung:** Eine abweichende Wahl von/bis übersteht das Neuladen (je Board, an diesem Gerät) und ändert die Board-Datei nicht; auf die Vorgabe zurückgestellt, folgt der Bericht wieder dem Board (Beispiel: bis C gewählt, neu geladen → bis C; zurückgestellt → wieder bis B).
- [x] **AK 7b Texte in der Durchlaufzeit:** Die Kopfleiste nennt, was als erledigt zählt; an „bis“ steht, ob die Wahl dem Board folgt oder abweicht, samt dem Weg zurück zur Vorgabe — keine zweite Auswahl „Erledigt heißt“. Der Satz zur Geltung nennt auch die Durchlaufzeit. Gestaltung nach derselben Zeichnung.

## Tests

Unit in `e2e/einheit/`: der feste Vergleich aus R00166 (`VOR_DER_KARTE`) wird umgestellt — ohne Wahl alles gleich, mit Wahl ändern sich Burndown, Durchsatz und Fluss, sonst nichts; die Gleichung aus AK 2 an jedem Tag eines Zufallsbestands, einmal mit Phasen; ein Test für den Randfall (ADR-0027 N5 Punkt 8). E2E als Spec am Rechenbeispiel mit datierten Commits (Vorbild: die Spec zu R00166).

## Implementierungshinweise

- Vorgabe ist ADR-0027 N5: `fluss()` bekommt das Ziel als Parameter; in der Durchlaufzeit wechselt nur die Vorgabe; der Randfall wird allein in `zielblock()` aufgelöst. Nicht folgen dürfen die Prognose und der Cache-Schlüssel des Fever Charts.
- Die Fundstellen des ADR sind am Code gelesen, nicht am Programm gefahren; die erste Bubble (B0823) ist deshalb der Test an der Trennstelle.
- **Nicht hinein:** „Wie lange noch“ (bleibt, Karte wörtlich) · Von-Spalte als Vorgabe für „von“ (#157) · Rückläufer und Herkunft (#160) · kein Server, kein Dateiformat, kein neuer Schlüssel in der Board-Datei.

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Die Zeichnung `Dokumentation/Wireframes/D0006.dc.html#fluss-erledigt-heisst` beauftragt der Director getrennt. Ohne sie baubar: die Rechnung des Flusses und der Randfall (B0823–B0825) sowie Vorgabe und Merken der Durchlaufzeit (B0827, B0828).

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung sagen: (1) Boards mit gespeicherter Zielspalte zeigen im Kumulativen Fluss andere Zahlen für „offen“ und „fertig“ als vorher, und die Durchlaufzeit öffnet mit anderem „bis“; (2) der Randfall oben ändert Burndown, Fluss und Durchsatz auf Boards, deren Abschlussspalte im Berichtsfilter ausgeschlossen ist; (3) mit gespeicherter Zielspalte bleiben Aufgaben, die im Zielblock links der Abschlussspalte archiviert wurden, im Kumulativen Fluss in ihrem Band und in „gesamt“ (vorher fielen sie ab dem Archivtag heraus) — dieselbe Zählung wie im Umfang des Burndowns.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Auf einem Board mit Zielspalte B nennt der Burndown am 03.11. „offen“ 0, der Kumulative Fluss 2, und die Durchlaufzeit misst bis „Erledigt“, wo nichts ankommt. Rechnet der Fluss mit demselben Ziel wie der Burndown (X), nennen beide an jedem Tag dieselbe Zahl (Y); öffnet die Durchlaufzeit mit „bis B“, misst sie ohne Handgriff die Strecke, die das Board als seine Arbeit erklärt hat (Z).

## Notizen

- Heimat: I0159 unter D0006 mit F0134 (AK 1–4, 7a, 8, 9, 10) und F0135 (AK 5, 6, 7b). Die Nummern der Kriterien folgen der Liste des architekt; AK 7 ist je Feature geteilt, damit jedes für sich lieferbar ist und der Satz zur Geltung nur nennt, was schon folgt.
- Optionen: vor der Planung entschieden — die Abweichung von/bis in der Board-Datei zu speichern ist verworfen (die boardweite Aussage ist die Zielspalte, die Abweichung eine Sicht des Betrachters; ADR-0027 N5 Punkt 3).
