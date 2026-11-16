---
id: R00166
status: Neu
datum: 2026-11-16
---

# R00166: „Erledigt heißt“ je Board — gilt für Burndown, Durchsatz und Fever Chart

## Beschreibung

Auftrag des Betreibers (2026-11-14, Karte #154, hier Karte #156), wörtlich, soweit er diese Karte betrifft:

> „… und eine Zielspalte auswählen können. Zum Beispiel gibt es einige Boards, die bis ‚Erledigt‘ (letzte Spalte) laufen, aber wo etwas Organisatorisches hart verhindert, dass dort aktuell Aufgaben ankommen. Der eigentliche Entwicklungsprozess endet dort aktuell vorher. … Bei der Auswertung ‚Durchsatz‘ hätte ich ebenfalls gerne die Möglichkeit, die Von- und Bis-Spalte zu wählen.“

**Umfang:** Burndown und Durchsatz bekommen die Auswahl „Erledigt heißt“ des Fever Charts ([R00079](R00079-zielspalte-im-fever-chart.md)). Es gibt **eine Zielspalte je Board**, nicht eine je Bericht: Die Wahl steht in der Board-Datei und gilt für Burndown, Durchsatz (als „Bis“) und Fever Chart zugleich. Regel wie in R00079: erledigt ist, was den gewählten Block oder einen rechts davon erreicht hat; ohne Wahl gilt die letzte Spalte. Technik nach [ADR-0027](../Dokumentation/ADRs/0027-eine-bestandsregel-fuer-alle-berichte.md), Nachtrag N2 — der Schlüssel bleibt `fever: {target-column: …}`, kein Eingriff in Dateiformat, Route oder Server.

> **Achtung, Änderung ohne Handgriff:** Ein Board, das **heute schon** eine Zielspalte für das Fever Chart gespeichert hat, zeigt nach dieser Karte im **Burndown und im Durchsatz andere Zahlen als vorher** — sie rechnen dann bis zu dieser Zielspalte statt bis zur letzten Spalte (AK 6). Das ist gewollt; bei der Auslieferung ausdrücklich sagen.

**In Kauf genommen:** Mit gewählter Zielspalte nennt der Burndown weniger „offen“ als Kumulativer Fluss und „Wie lange noch“ — die rechnen bis Karte #159 weiter bis zur Abschlussspalte; die Kopfleisten sagen, was jeweils zählt (ADR-0027 N2 Punkt 7).

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“. Baut auf [R00164](R00164-burndown-zugang-und-abgang-je-tag.md) (Zugang und Abgang je Tag), [R00122](R00122-bericht-durchsatz-je-zeitraum.md) (Durchsatz), [R00081](R00081-berichtsfilter-am-board.md) (Berichtsfilter) und R00079.

## Akzeptanzkriterien

**Ausgangslage (Rechenbeispiel):** Board mit den Spalten A · B · C · Erledigt (ohne Phasen), drei Aufgaben, Zeitraum 02.11.–04.11., Durchsatz mit Auflösung „Tag“.

| Tag | Was geschieht | ohne Wahl: + · − erledigt · offen | ohne Wahl: Durchsatz | Zielspalte B: + · − erledigt · offen | Zielspalte B: Durchsatz |
|---|---|---|---|---|---|
| 02.11. | #1, #2, #3 in A angelegt | 3 · 0 · 3 | 0 | 3 · 0 · 3 | 0 |
| 03.11. | #1 nach B; #2 nach B; #3 nach Erledigt | 0 · 1 · 2 | 1 | 0 · 3 · 0 | 3 |
| 04.11. | #1 weiter nach C; #2 zurück nach A | 0 · 0 · 2 | 0 | 1 · 0 · 1 | 0 |
| Summe | | 3 · 1 | 1 | 4 · 3 | 3 |

Probe der Bilanz mit Zielspalte B („− entfernt“ ist überall 0): 03.11. 3 + 0 − 3 = 0 · 04.11. 0 + 1 − 0 = 1. Ohne Wahl: 03.11. 3 + 0 − 1 = 2 · 04.11. 2 + 0 − 0 = 2.

### Feature 1 — Rechnung mit Zielspalte (F0129, ohne Zeichnung baubar)

- [ ] **AK 1 Burndown:** Mit Zielspalte B zählt ein Zug nach B an dem Tag als „− erledigt“, „offen“ sinkt, und die Bilanz offen = offen(Vortag) + hinzugekommen − erledigt − entfernt geht an jedem Tag auf (Beispiel: 03.11. „− erledigt“ 3, „offen“ 0).
- [ ] **AK 2 Durchsatz:** Derselbe Zug ist im Durchsatz eine Ankunft in der Periode; ein Weiterzug nach C oder Erledigt zählt nicht erneut (Beispiel: 03.11. Durchsatz 3; #1 am 04.11. nach C → 0).
- [ ] **AK 3 Rückzug:** Ein Zug von B zurück nach A ist im Burndown „+ hinzugekommen“; der Durchsatz bleibt unverändert (Beispiel: #2 am 04.11. → „+“ 1, „offen“ 1, Durchsatz weiter Summe 3).
- [ ] **AK 6 Bestehende Board-Datei:** Eine Board-Datei, die `fever: {target-column: B}` schon trägt, wirkt ohne Handarbeit in Burndown, Durchsatz und Fever Chart (Beispiel: Zahlen der Spalten „Zielspalte B“).
- [ ] **AK 7 Ohne Wahl:** Die Zahlen aller Berichte sind wie vor der Karte (Beispiel: Spalten „ohne Wahl“), und die Board-Datei bekommt keinen neuen Schlüssel.
- [ ] **AK 8 Fremde Berichte:** Mit Wahl ändern sich Durchlaufzeit, Kumulativer Fluss und „Wie lange noch“ nicht; ihre Kopfleiste nennt weiter die Abschlussspalte (Beispiel: Kumulativer Fluss am 03.11. „fertig“ 1, nicht 3).

### Feature 2 — Auswahl in beiden Kopfleisten (F0130, braucht F0129 und die Zeichnung)

- [ ] **AK 4 Auswahl:** Burndown und Durchsatz zeigen „Erledigt heißt“ mit denselben Blöcken wie das Fever Chart, auch auf Boards mit Phasen, samt dem Satz „gilt für Burndown, Durchsatz und Fever Chart dieses Boards“. Gestaltung nach der Zeichnung `Dokumentation/Wireframes/D0006.dc.html#erledigt-heisst`.
- [ ] **AK 5 Eine Wahl für drei Berichte:** Eine Wahl im Burndown steht danach im Durchsatz und im Fever Chart; nach Neuladen steht `fever: {target-column: B}` in der Board-Datei, geschrieben mit einem Commit.
- [ ] **AK 9 Spalte gibt es nicht mehr:** Gibt es die gewählte Spalte nicht mehr (auch, weil sie im Berichtsfilter ausgeschlossen ist), zeigen Burndown und Durchsatz den Hinweis aus R00079 („Zielspalte „…“ gibt es nicht mehr — gerechnet wird mit „…“.“) und rechnen mit dem letzten Block (Beispiel: `target-column: Abnahme` → Zahlen der Spalten „ohne Wahl“).

### Feature 3 — Texte nennen, was als erledigt zählt (F0131, braucht F0130)

- [ ] **AK 10 Texte:** Kopfleiste, Kennzahl, Tooltip und Legende von Burndown und Durchsatz nennen den Block, der als erledigt zählt (Beispiel: Zielspalte B → „B“ statt „Abschlussspalte“); der Durchsatz sagt, dass „Von“ noch fehlt.

## Tests

Unit in `e2e/einheit/`: ein Datensatz, alle Berichtsfunktionen einmal ohne und einmal mit Zielspalte — ohne Wahl alles gleich, mit Wahl nur Burndown und Durchsatz anders (ADR-0027 N2 Punkt 8). E2E als neue Spec am Rechenbeispiel mit datierten Commits (Vorbild: die Spec zu R00164).

## Implementierungshinweise

- Vorgabe ist ADR-0027 N2; die Zielspalte ist **Parameter** nur für `burndown` (samt `ausgenommen`) und `durchsatzZiel`, `erledigtSpalten(bew)` liest die Wahl nie. Speichern über den vorhandenen Weg `PUT /api/boards/{slug}/fieber`.
- Die Fundstellen des ADR sind am Code gelesen, nicht am Programm gefahren; die erste Bubble (B0803) ist deshalb der Test an der Trennstelle.
- **Nicht hinein:** Von-Spalte im Durchsatz (#157) · Hinweis in „Wie lange noch“ (#158) · Durchlaufzeit und Kumulativer Fluss folgen der Zielspalte (#159) · keine Von-Spalte im Burndown (leistet der Spaltenausschluss, R00081) · kein Server, kein Datenformat, kein neuer Schlüssel.

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Features 2 und 3: Die Zeichnung unter `Dokumentation/Wireframes/D0006.dc.html#erledigt-heisst` beauftragt der Director getrennt; Feature 1 ist ohne sie baubar und für sich lieferbar.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung sagen: (1) Boards mit schon gespeicherter Zielspalte zeigen in Burndown und Durchsatz andere Zahlen als vorher; (2) „Von“ im Durchsatz fehlt noch und kommt mit #157.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Auf einem Board endet die Entwicklung in B, nach „Erledigt“ kommt wegen einer organisatorischen Sperre nichts — der Burndown bleibt flach, der Durchsatz bei 0, obwohl gearbeitet wird. Zählt das Board „erledigt“ ab der gewählten Spalte (X), sinkt „offen“ mit jedem Zug nach B und der Durchsatz zählt die Ankunft (Y); weil dieselbe Wahl für Burndown, Durchsatz und Fever Chart gilt, widersprechen sich die drei Berichte nicht (Z).

## Notizen

- Heimat: I0156 unter D0006 mit F0129 (AK 1–3, 6–8), F0130 (AK 4, 5, 9) und F0131 (AK 10). Die Nummern der Kriterien folgen der Liste des architekt und stehen deshalb nicht in Reihenfolge.
- Optionen: vor der Planung entschieden — ein neutraler Schlüssel ist verworfen (Lesen aus zwei Quellen, ältere Versionen zeigten eine andere Zielspalte; ADR-0027 N2 Punkt 1); eine Zielspalte je Bericht ist verworfen (Entscheidung des product-owner, Karte #156).
