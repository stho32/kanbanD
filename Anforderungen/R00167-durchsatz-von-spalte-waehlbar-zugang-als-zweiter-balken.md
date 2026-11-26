---
id: R00167
status: Erledigt
datum: 2026-11-16
---

# R00167: Durchsatz — Von-Spalte wählbar, Zugang je Periode als zweiter Balken

## Beschreibung

Auftrag des Betreibers (2026-11-14, Karte #154, hier Karte #157), wörtlich, soweit er diese Karte betrifft:

> „Bei der Auswertung ‚Durchsatz‘ hätte ich ebenfalls gerne die Möglichkeit, die Von- und Bis-Spalte zu wählen.“ — „Ich möchte sehen, wie viele Aufgaben hinzugekommen sind, aber auch wie viele abgearbeitet wurden.“

**Umfang:** Der Durchsatz bekommt die Auswahl „von“ neben „Erledigt heißt“ ([R00166](R00166-erledigt-heisst-je-board-fuer-burndown-durchsatz-und-fever-chart.md)) und zeigt je Periode zwei Balken: den **Zugang** an der Von-Spalte neben dem unveränderten **Abgang** an der Zielspalte. Zugang heißt: je Aufgabe einmal, in der Periode, in der sie die Von-Spalte oder eine Spalte rechts davon **erstmals** erreicht; Rückläufer zählen nicht erneut. Ohne Wahl gilt die erste Spalte. Die Wahl steht in der Board-Datei als `fever: {from-column: …}`. Technik nach [ADR-0027](../Dokumentation/ADRs/0027-eine-bestandsregel-fuer-alle-berichte.md), Nachtrag N3.

„Von“ wird in dieser Form geliefert (Entscheidung des product-owner, Karte #157): nicht als Filter, sondern als eigene Zahl. Der Zugang ist bewusst etwas anderes als „+ hinzugekommen“ im Burndown — dort zählt Nacharbeit mehrfach, hier jede Aufgabe einmal; die Summen beider Berichte dürfen abweichen.

> **In Kauf genommen — bei der Auslieferung ausdrücklich sagen:** Eine **ältere kanbanD-Version**, die dieselbe Board-Datei schreibt, verliert den Schlüssel `from-column` beim nächsten Schreiben (sie baut den Kopf der Board-Datei ganz aus ihrem Modell); die Von-Wahl fällt dann still auf die Vorgabe zurück — keine falsche Zahl, aber eine verlorene Einstellung. Ebenso setzt ein noch offenes Browser-Fenster eines älteren Standes die Wahl zurück.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“. Baut auf R00166 (Zielspalte je Board), [R00122](R00122-bericht-durchsatz-je-zeitraum.md) (Durchsatz), [R00081](R00081-berichtsfilter-am-board.md) (Berichtsfilter) und R00045 (Durchlaufzeit, Vorbild der Auswahl).

## Akzeptanzkriterien

**Ausgangslage (Rechenbeispiel, zugleich die Abnahme der Karte):** Board mit den Spalten Backlog · Arbeit · Erledigt (ohne Phasen), Zielspalte nicht gewählt (also Erledigt), drei Aufgaben, Zeitraum 02.11.–04.11., Durchsatz mit Auflösung „Tag“.

| Tag | Was geschieht | Von = Backlog: Zugang · Abgang | Von = Arbeit: Zugang · Abgang |
|---|---|---|---|
| 02.11. | #1, #2, #3 im Backlog angelegt | 3 · 0 | 0 · 0 |
| 03.11. | #1 nach Arbeit; #2 nach Arbeit | 0 · 0 | 2 · 0 |
| 04.11. | #1 nach Erledigt; #2 zurück in den Backlog und wieder nach Arbeit | 0 · 1 | 0 · 1 |
| Summe | 3 angelegt, 2 nach Arbeit, 1 nach Erledigt | 3 · 1 | 2 · 1 |

Ø je Tag: Von = Backlog Zugang 3 : 3 = 1, Von = Arbeit Zugang 2 : 3 ≈ 0,67; Abgang in beiden Fällen 1 : 3 ≈ 0,33.

### Feature 1 — Von-Spalte speichern und wählen (F0132)

- [x] **AK 2 Speichern:** Wird im Durchsatz „von“ = Arbeit gewählt, steht nach Neuladen `fever: {from-column: Arbeit}` in der Board-Datei, geschrieben mit einem Commit, und die Auswahl zeigt wieder „Arbeit“.
- [x] **AK 3a Ohne Wahl, Datei:** Eine Board-Datei ohne `from-column` bleibt nach Lesen und Schreiben zeichengleich; sie bekommt keinen neuen Schlüssel.
- [x] **AK 5 Von nicht links vom Ziel:** Liegt „von“ rechts von der Zielspalte oder ist sie dieselbe (Beispiel: von = Erledigt), steht der Hinweis der Durchlaufzeit („von“ muss links vom Ziel liegen), es gibt keinen Zugangsbalken, und der Abgang bleibt stehen (0 · 0 · 1).
- [x] **AK 6 Spalte gibt es nicht mehr:** Steht in der Board-Datei `from-column: Abnahme` und das Board hat keine Spalte „Abnahme“, rechnet der Durchsatz mit der ersten Spalte (Zugang 3 · 0 · 0) und zeigt einen Hinweis „gibt es nicht mehr“; kein Fehler.
- [x] **AK 9 Wahlen stören einander nicht:** Eine Änderung am Fever Chart (Beispiel: Auflösung) und ein Kartenzug erhalten `from-column`; das Ändern von „von“ erhält `target-column` und alle übrigen Werte unter `fever`.

### Feature 2 — Zugang rechnen und zeigen (F0133, braucht F0132 und die Zeichnung)

- [x] **AK 1 Abnahme der Karte:** Im Beispiel ergibt von = Arbeit über den Zeitraum Zugang 2 und Abgang 1; von = Backlog ergibt Zugang 3 (je Tag wie in der Tabelle). Je Periode stehen zwei Balken nebeneinander, Gestaltung nach der Zeichnung `Dokumentation/Wireframes/D0006.dc.html#durchsatz-von`.
- [x] **AK 3b Ohne Wahl, Zahlen:** Ohne Wahl sind Abgang, Burndown, Kumulativer Fluss, Durchlaufzeit, Prognose und Fever Chart wie vor der Karte; mit Wahl ändert sich allein der Zugang im Durchsatz.
- [x] **AK 4 Rückläufer:** Eine Aufgabe, die von Arbeit zurück in den Backlog und wieder nach Arbeit geht, zählt im Zugang einmal (Beispiel: #2 am 04.11. → Zugang bei von = Arbeit bleibt 0, Summe 2).
- [x] **AK 7 Filter:** Berichtsfilter, „Rechnen ab“ und `reporting.forecast: false` an einer Aufgabe wirken auf beide Balken gleich (Beispiel: #1 trägt `reporting.forecast: false` → von = Arbeit Zugang 0 · 1 · 0, Abgang 0 · 0 · 0).
- [x] **AK 8 Texte:** Kennzahl (Ø Zugang und Ø Abgang nebeneinander), Tooltip und Tabellenansicht nennen beide Zahlen; die Legende sagt, dass der Zugang das **erstmalige** Erreichen zählt und deshalb vom „+ hinzugekommen“ des Burndowns abweichen darf. Der Satz „„Von“ lässt sich noch nicht wählen: …“ entfällt.
- [x] **AK 10 Direkt im Ziel angelegt:** Eine Aufgabe, die direkt in der Zielspalte angelegt wird, zählt in Zugang und Abgang derselben Periode (Beispiel: zusätzlich #4 am 04.11. in Erledigt angelegt → 04.11. Zugang 1 · Abgang 2, bei von = Backlog wie bei von = Arbeit).

## Tests

Unit in `e2e/einheit/`: der Test an der Trennstelle aus R00166 um die Von-Wahl erweitert — ohne Wahl alles gleich, mit Wahl nur die Zugangszahlen des Durchsatzes anders (ADR-0027 N3 Punkt 6). Rust: Rundlauf der Board-Datei ohne und mit `from-column`. E2E als Spec am Rechenbeispiel mit datierten Commits (Vorbild: die Spec zu R00166).

**Datenformat — was die Prüfung gegen den alten Stand belegen muss:** (1) Eine Datei ohne den Schlüssel bleibt zeichengleich. (2) Mit dem Schlüssel übersteht er Lesen, eine fremde Aktion (Kartenzug) und `PUT /api/boards/{slug}/fieber`. (3) Der alte Stand liest die neue Datei fehlerfrei und verliert nur diesen Schlüssel.

## Implementierungshinweise

- Vorgabe ist ADR-0027 N3: Modell `Fieber.vonspalte`, API-Feld `fieber.vonspalte`, dieselbe Route `PUT /api/boards/{slug}/fieber`; der Server prüft nur die Form, nicht „von links vom Ziel“. Die Von-Spalte ist **Parameter** (Vorgabe `null`) allein von `durchsatz()`; `zielblock()`, `durchsatzZiel()` ohne Parameter und `fieberSchluessel` lesen sie nie.
- Die Fundstellen des ADR sind am Code gelesen, nicht gefahren. Deshalb beginnt Feature 1 mit einer Rundlauf-Probe am heutigen Stand (B0812, erwartet: der Schlüssel geht verloren; die Messung gehört in den Commit) und Feature 2 mit dem Test an der Trennstelle (B0816).
- **Nicht hinein:** Hinweis in „Wie lange noch“ (#158) · Durchlaufzeit und Kumulativer Fluss folgen der gespeicherten Strecke (#159) · Rückläufer und Herkunft als eigene Auswertung (#160) · keine Von-Spalte im Burndown.

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Die Zeichnung unter `Dokumentation/Wireframes/D0006.dc.html#durchsatz-von` (Auswahl „von“, zweiter Balken, Kennzahl, Legende) beauftragt der Director getrennt.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung sagen: (1) „Von“ wird als Zugang je Periode geliefert, nicht als Filter; (2) den Absatz „In Kauf genommen“ wörtlich.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Der Durchsatz zeigt nur, was fertig wird — ob im selben Zeitraum mehr Arbeit hereinkommt, als abfließt, sieht der Betreiber dort nicht. Zählt der Bericht je Periode auch das erste Erreichen der Von-Spalte (X), stehen Zugang und Abgang nebeneinander (Y), und der Betreiber liest an einer Stelle ab, ob das Board aufstaut oder abbaut — für die Strecke, die er selbst wählt (Z).

## Notizen

- Heimat: I0157 unter D0006 mit F0132 (AK 2, 3a, 5, 6, 9) und F0133 (AK 1, 3b, 4, 7, 8, 10). Die Nummern der Kriterien folgen der Liste des architekt; AK 3 ist nach Feature in Datei (3a) und Zahlen (3b) geteilt.
- Optionen: vor der Planung entschieden — eigener Schlüssel auf oberster Ebene mit eigener Route und `report-filter` als Speicherort sind verworfen (ADR-0027 N3 Punkt 2); „Von“ als reiner Filter ist verworfen (Bedienelement ohne Wirkung, Karte #157).
- Vermerk 2026-11-26 (Karte #277): AK 8 (Ø Zugang und Ø Abgang je Periode in der Kennzahl) gilt ab [R00254](R00254-durchsatz-drei-durchschnitte-je-tag-und-zahlen-an-den-balken.md) in dessen Fassung: Ø je Kalendertag, unabhängig von der Auflösung, dazu Netto; der Ø je Periode steht an der Ø-Linie. Diese Anforderung bleibt abgenommen.
