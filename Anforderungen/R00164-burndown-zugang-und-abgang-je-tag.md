---
id: R00164
status: Neu
datum: 2026-11-15
---

# R00164: Burndown zeigt Zugang und Abgang je Tag

## Beschreibung

Auftrag des Betreibers (2026-11-14, Karte #154), wörtlich, soweit er diese Karte betrifft:

> „Ich möchte im Burndown pro Tag auch + und - sehen […]. Das andere ist, dass Läufe mit KI kontinuierlich neue Aufgaben erzeugen und aber auch welche abarbeiten. Ich möchte sehen, wie viele Aufgaben hinzugekommen sind, aber auch wie viele abgearbeitet wurden. Sonst kann ich die Produktivität des Burndowns schlecht einschätzen.“

**Umfang:** Der Burndown zeigt je Tag neben „offen“ und „Umfang“ drei Größen: **+ hinzugekommen**, **− erledigt**, **− entfernt**. Gezählt werden Ereignisse des Tages, nicht der Unterschied zweier Tagesenden. Zu sehen sind sie als kleine Balken je Tag unter der Linie, als Zahlen im Tooltip des Tages und in der Tabellenansicht, und als Summen des Zeitraums in einer Kennzahlzeile. Entschieden vom product-owner (`AI-Team/po-entscheidungen.md`, 2026-11-14, #154); Technik nach [ADR-0027](../Dokumentation/ADRs/0027-eine-bestandsregel-fuer-alle-berichte.md), Nachtrag N1.

**Abgrenzung:** Zielspalte „Erledigt heißt“ und Durchsatz-Bis → #156 · Durchsatz-Von mit Zugangsbalken → #157 · Hinweis in „Wie lange noch“ → #158 · Durchlaufzeit und Kumulativer Fluss folgen der Zielspalte → #159 · Rückläufer als eigene Größe und Herkunft des Zugangs → #160.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“. Baut auf [R00044](R00044-burndown-nach-zeitraum.md) (Burndown nach Zeitraum), [R00081](R00081-berichtsfilter-am-board.md) (Berichtsfilter) und R00152 (Bestandsregel, Karte #155).

## Akzeptanzkriterien

**Ausgangslage (Rechenbeispiel):** Board mit den Spalten „Eingang“, „In Arbeit“, „Fertig“ (Abschlussspalte), erster Stand am 02.11.; Zeitraum 02.11.–05.11.

| Tag | Was geschieht | + hinzugekommen | − erledigt | − entfernt | offen | Umfang |
|---|---|---|---|---|---|---|
| 02.11. | #1 und #3 in „Eingang“, #2 in „In Arbeit“ angelegt | 3 | 0 | 0 | 3 | 3 |
| 03.11. | #4 angelegt; #5 angelegt und am selben Tag nach „Fertig“; #1 nach „Fertig“ | 2 | 2 | 0 | 3 | 5 |
| 04.11. | #2 in „In Arbeit“ archiviert; #1 aus „Fertig“ zurück nach „In Arbeit“ | 1 | 0 | 1 | 3 | 4 |
| 05.11. | #1 und #3 nach „Fertig“; #5 in „Fertig“ archiviert | 0 | 2 | 0 | 1 | 4 |
| Summe | | 6 | 4 | 1 | | |

Probe der Bilanz: 03.11. 3 + 2 − 2 − 0 = 3 · 04.11. 3 + 1 − 0 − 1 = 3 · 05.11. 3 + 0 − 2 − 0 = 1. Der Durchsatz desselben Zeitraums ist 3 (#5, #1, #3 je beim ersten Erreichen), „− erledigt“ ist 4, weil #1 zweimal fertig wurde.

### Feature 1 — Rechnung und Zahlen (F0127)

- [ ] **AK 1 Bilanz:** An jedem Tag ab dem zweiten des Zeitraums gilt offen = offen(Vortag) + hinzugekommen − erledigt − entfernt (Beispiel: alle drei Zeilen 03.–05.11.).
- [ ] **AK 2 Am selben Tag angelegt und erledigt:** „+“ und „− erledigt“ steigen je um 1, „offen“ bleibt (Beispiel: #5 am 03.11.).
- [ ] **AK 3 Entfernt:** Eine außerhalb der Abschlussspalte archivierte Aufgabe zählt an ihrem Archivtag als „− entfernt“ +1 (Beispiel: #2 am 04.11.); ebenso eine offene Aufgabe, die vom Board genommen oder gelöscht wird, am Tag des Geschehens.
- [ ] **AK 4 Rückläufer und Archiv im Ziel:** Eine Aufgabe, die aus der Abschlussspalte zurückkommt, zählt als „+“ +1 (Beispiel: #1 am 04.11.). Wird eine Aufgabe in der Abschlussspalte archiviert, ändert sich keine der Größen (Beispiel: #5 am 05.11.).
- [ ] **AK 5 Ausgeschlossene Spalte:** Ist „Eingang“ im Berichtsfilter ausgeschlossen, zählt „+“ erst am Tag des Eintritts in eine gezählte Spalte (Beispiel: am 02.11. „+“ 1 statt 3, nur #2); ein Zug zurück in die ausgeschlossene Spalte zählt als „− entfernt“. Die Bilanz aus AK 1 gilt auch dann.
- [ ] **AK 6 Filter:** Personen-, Label- und Farbfilter, Zeitraum, „Rechnen ab“ und `reporting.burndown: false` wirken auf die drei Größen wie auf „offen“ (Beispiel: #5 mit `reporting.burndown: false` → 03.11. „+“ 1, „− erledigt“ 1; Zeitraum 03.11.–05.11. → Summen 3 · 4 · 1).
- [ ] **AK 8 Zahlen sichtbar:** Der Tooltip eines Tages und die Tabellenansicht (drei neue Spalten rechts von „Umfang“) zeigen die drei Zahlen des Tages; eine Kennzahlzeile über dem Diagramm zeigt die Summen des Zeitraums (Beispiel: „+ 6 hinzugekommen · − 4 erledigt · − 1 entfernt“).
- [ ] **AK 10 Nichts sonst ändert sich:** Board-Datei, API (`GET /api/berichte/bewegungen`) und die übrigen Berichte (Kumulativer Fluss, Durchsatz, Durchlaufzeit, „Wie lange noch“, Fever Chart) bleiben unverändert; es wird nichts gespeichert.

### Feature 2 — Balken und Legende (F0128, braucht die Zeichnung)

- [ ] **AK 7 Balken:** Unter der Linie steht je Tag ein kleiner Balken: „+“ nach oben, „−“ nach unten; „entfernt“ ist von „erledigt“ nicht nur durch Farbe unterscheidbar; lesbar in Hell und Dunkel. Gestaltung nach der Zeichnung am Artboard `Dokumentation/Wireframes/D0006.dc.html`, Anker `#burndown-zugang-abgang`.
- [ ] **AK 9 Legende:** Die Legende nennt die drei Größen, sagt, ab wo „+“ zählt (bei ausgeschlossener Spalte: ab dem Eintritt in eine gezählte Spalte, AK 5), und sagt, dass „erledigt“ bei Nacharbeit über dem Durchsatz liegen kann.

## Tests

Unit in `e2e/einheit/` (Bilanz an jedem Tag für einen Datensatz mit allen Übergängen, ADR-0027 N1 Punkt 6), E2E als neue Spec am Rechenbeispiel mit datierten Commits (Vorbild `e2e/tests/r00121-fluss.spec.js`). Bestehende Tests des Burndowns bleiben ohne geänderte Erwartung an „offen“ und „Umfang“ grün.

## Implementierungshinweise

- **Rechnung:** `burndown` (`web/berichte.js:181–200`) liefert je Tag zusätzlich die drei Größen; ein Ereignis ist ein Wechsel von `imBestand(f, bestandAm(…))` und „nicht erledigt“ an einem Änderungspunkt der Aufgabe (ADR-0027 N1 Punkte 1 und 2). Keine zweite Regel neben `bestandAm`; `erledigtSpalten` bleibt Parameter (#156).
- **Zeichnen:** `vVerlauf` (`web/ansicht.js:1175–1206`: Tooltip, Legende, Tabellenansicht), CSS `web/kd-app.css:678–700`.
- **Geerbt aus ADR-0027 N1 Punkt 5, kein Fehler:** Eine zurückgeholte Aufgabe verliert ihr „− entfernt“ rückwirkend; „− entfernt“ durch Archivieren steht am Archivtag ab 0 Uhr; eine direkt in der Abschlussspalte angelegte Aufgabe erzeugt kein Ereignis.
- **Nicht hinein:** keine Zielspalte, keine eigene Von-Spalte im Burndown, keine Rückläufer als eigene Größe, keine Herkunft des Zugangs, kein Eingriff in Durchsatz, Kumulativen Fluss oder „Wie lange noch“, kein Server, kein Datenformat.
- Die Fundstellen sind am Code belegt, nicht am Programm gefahren.

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Feature 2: Die Zeichnung unter `#burndown-zugang-abgang` und ihre Freigabe durch den product-owner klärt der Director getrennt; Feature 1 ist ohne sie baubar.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung sagen: „Von“ im Durchsatz kommt mit #157 als Zugangsbalken, die Zielspalte mit #156.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Ein KI-Lauf legt an einem Tag fünf Aufgaben an und erledigt fünf — die Linie „offen“ bleibt flach, und der Burndown sieht nach Stillstand aus. Zählt der Bericht die Ereignisse des Tages (X), stehen Zugang und Abgang nebeneinander (Y), und der Betreiber liest ab, wie viel abgearbeitet wurde und wie viel hinzukam; weil „entfernt“ getrennt steht, gilt Aufräumen nicht als Produktivität (Z).

## Notizen

- Heimat: I0152 unter D0006 mit F0127 (AK 1–6, 8, 10) und F0128 (AK 7, 9). Die Nummern der Kriterien folgen der Liste des architekt; AK 7 und AK 9 stehen deshalb bei Feature 2.
- Optionen: vor der Planung entschieden — Vergleich der Tagesenden ist verworfen, weil eine am selben Tag angelegte und erledigte Aufgabe unsichtbar bliebe (Beratung realist-consultant, Entscheidung product-owner).
