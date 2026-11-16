---
id: R00171
status: Neu
datum: 2026-11-16
---

# R00171: Kostenbericht — Zeitraum, Spaltenabschnitt und Aufgabenliste

## Beschreibung

Herkunft: Auftrag des Betreibers vom 2026-11-15 (Karte #165), Zuschnitt des product-owner (`AI-Team/po-entscheidungen.md`, 2026-11-15, #165). **Wozu**, im Wortlaut des Betreibers: „Die Gesamtsumme reicht mir nicht. Ich möchte gerne Kosten von(inkl)-bis(inkl) auswählen können und die Liste der Aufgaben sehen. Wenn eine Aufgabe zum Teil in der Datums-Range bearbeitet wurde und zum Teil außerhalb, dann sollen natürlich nur die Kosten die innerhalb des Zeitraums für die Aufgaben angefallen sind gelistet werden.“ Und: „auch horizontal (nach Kanban-Board) kann ja Abschnittsweise abgerechnet werden“ — etwa in einem Kundenprojekt, dessen Aufgaben derzeit nur bis zur Abnahme laufen.

**Umfang:** Der Bericht „Kosten“ bekommt zwei Bereiche, je von–bis einschließlich, Voreinstellung „alle“: den **Zeitraum** und den **Spaltenabschnitt**. Ein Kosteneintrag ([R00165](R00165-kosteneintraege-mit-zeitstempel-rolle-und-spalte.md)) zählt genau dann, wenn sein Zeitstempel im Zeitraum **und** seine Spalte im Abschnitt liegt. Unter der Summe steht die **Aufgabenliste**: jede Aufgabe mit mindestens einem zählenden Eintrag, mit ihrer Summe und einem Kennzeichen. Technik nach [ADR-0028](../Dokumentation/ADRs/0028-kosteneintraege-als-eigener-schluessel-mit-kennung-und-eigener-route.md), Nachtrag N1.

**Entschieden:**

1. **Zeitraum** ist der eine Zeitraum des Berichtsfilters (`report-filter: period/from/to`, [R00081](R00081-berichtsfilter-am-board.md)), kein neuer Schlüssel. Die Tagesgrenze liegt in der Ortszeit des Betrachters.
2. **Spaltenabschnitt** sind zwei neue Unterschlüssel `cost-from-column` und `cost-to-column` in `report-filter` (API `kostenVonSpalte`, `kostenBisSpalte`). Es zählt die Spaltenfolge des Boards, Phasen wirken nicht; eine Grenze, die es nicht mehr gibt, gilt als nicht gesetzt und wird genannt. Ein Eintrag, dessen Spalte das Board nicht führt, zählt ohne Abschnitt wie bisher und steht mit Abschnitt in einem eigenen Eimer „Spalte nicht auf diesem Board“.
3. **Kennzeichen** je Aufgabe, je Board aus dem heutigen Stand gerechnet, in dieser Reihenfolge: „archiviert“ → „erledigt“ (in der Bis-Spalte oder rechts davon; ohne Bis-Spalte die Zielspalte des Boards, sonst die letzte Spalte) → „in Arbeit“ (trägt eine Reservierung) → „offen“.
4. **Alte Posten** ohne Datum, Rolle und Spalte (Entscheidung des Betreibers vom 2026-11-16): Ohne Zeitraum und Abschnitt bleibt der Bericht wie heute. Sobald ein Zeitraum oder ein Abschnitt gesetzt ist, zählt die Summe nur die passenden Einträge; die alten Posten stehen sichtbar daneben und zählen nicht mit.
5. **Trennstelle** ist `kostenbericht()` in `web/kosten.js`; der Server lernt nur die zwei Filterfelder.

> **Folge 1 — der Zeitraum wirkt künftig auch hier:** Ein Board, das heute einen Zeitraum im Berichtsfilter gespeichert hat, zeigt nach dieser Karte im Kostenbericht nur noch die Kosten dieses Zeitraums (bisher galt der Zeitraum dort nicht). Die Kopfzeile nennt den Zeitraum, „Zurücksetzen“ hebt ihn auf. Bei der Auslieferung sagen.

> **Folge 2 — eine ältere Programmversion verliert den Abschnitt:** Sie liest die Board-Datei fehlerfrei, schreibt die beiden neuen Schlüssel beim nächsten Speichern des Board-Kopfs aber nicht zurück; die Wahl fällt dann sichtbar auf „alle“. Kein Kosteneintrag geht verloren. In die Auslieferungsnotiz.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“. Baut auf R00165 (Kosteneinträge), [R00105](R00105-preisetikett-und-kostenbericht.md) (Kostenbericht) und R00081.

## Akzeptanzkriterien

**Ausgangslage (Beispielboard mit vier Aufgaben):** Spalten Eingang · Entwicklung · Abnahme · Produktiv, keine Zielspalte, kein Filter, Betrachter in +01:00. Alle Beträge in USD.

| Aufgabe | steht in | Einträge (Zeitstempel · Spalte · Betrag) |
|---|---|---|
| #1 | Produktiv | 12.11.2026 09:00 · Entwicklung · 1,00 — 13.11. 10:34 · Entwicklung · 3,46 — 14.11. 15:00 · Abnahme · 2,00 |
| #2 | Entwicklung | 13.11. 11:00 · Entwicklung · 0,54 |
| #3 | archiviert | 05.11. 08:00 · Entwicklung · 4,00 |
| #4 | Eingang | kein Eintrag; alter Posten ohne Datum, Rolle und Spalte 5,00 |

- [ ] **AK 1 Zeitraum und Abschnitt:** Zeitraum 12.11.–13.11., Abschnitt „Entwicklung“–„Abnahme“: Summe 5,00 $; die Liste zeigt #1 mit 4,46 $ und „erledigt“ (1,00 + 3,46; der Eintrag vom 14.11. fehlt) und #2 mit 0,54 $ und „offen“; #3 fehlt (05.11.); #4 steht unter „ohne Datum / ohne Rolle / ohne Spalte“ mit 5,00 $ daneben und zählt nicht in die Summe.
- [ ] **AK 2 Nur ein Teil der Aufgabe:** Zeitraum 12.11.–14.11., Abschnitt „Abnahme“–„Abnahme“: Summe 2,00 $, die Liste zeigt allein #1 mit 2,00 $.
- [ ] **AK 3 Ohne Bereiche:** Ohne Zeitraum und Abschnitt: „Einträge 11,00 $“ (1,00 + 3,46 + 2,00 + 0,54 + 4,00), #4 unter „ohne …“ mit 5,00 $, Summe wie heute 16,00 $; die Liste zeigt #1 6,46 $ „erledigt“, #2 0,54 $ „offen“, #3 4,00 $ „archiviert“.
- [ ] **AK 4 Bleibt:** Ohne Zeitraum und Abschnitt sind alle Zahlen des Berichts wie vor der Karte (R00165 AK 9).
- [ ] **AK 5 Gespeichert:** Nach der Wahl aus AK 1 trägt die Board-Datei in `report-filter` den Zeitraum und `cost-from-column: Entwicklung`, `cost-to-column: Abnahme`; nach dem Neuladen zeigt der Bericht dieselbe Wahl und dieselben Zahlen.
- [ ] **AK 6 Zurücksetzen:** „Zurücksetzen“ hebt Zeitraum und Abschnitt auf; der Bericht zeigt wieder AK 3, die Board-Datei trägt keinen der Schlüssel mehr.
- [ ] **AK 7 Fremde Spalte:** #2 trägt zusätzlich einen Eintrag 13.11. 12:00 · „Review“ · 0,25 $ (die Spalte führt das Board nicht). Ohne Abschnitt zählt er („Einträge 11,25 $“); mit der Wahl aus AK 1 bleibt die Summe 5,00 $, und der Bericht zeigt daneben „Spalte nicht auf diesem Board 0,25 $“.
- [ ] **AK 8 Verschwundene Grenze:** Steht in der Board-Datei `cost-to-column: Test` und führt das Board keine Spalte „Test“, nennt die Kopfzeile die Spalte als nicht mehr vorhanden; der Abschnitt gilt als „alle“, die Zahlen sind die aus AK 3.
- [ ] **AK 9 Tagesgrenze:** #2 trägt zusätzlich die Einträge 13.11. 23:30+01:00 · Entwicklung · 0,10 $ und 14.11. 00:10+01:00 · Entwicklung · 0,20 $. Zeitraum 12.11.–13.11. ohne Abschnitt: Summe 5,10 $ (4,46 + 0,54 + 0,10); der Eintrag von 00:10 zählt nicht.
- [ ] **AK 10 Dateiformat:** Eine Board-Datei ohne die beiden neuen Schlüssel schreibt das Programm zeichengleich wie vor der Karte.

Gestaltung der Leiste (Zeitraum, Abschnitt), der Aufgabenliste und der Eimer nach der Zeichnung `Dokumentation/Wireframes/D0006.dc.html#kosten-zeitraum-abschnitt`. Sichtbare Texte sagen „Aufgaben“, nicht „Karten“.

## Tests

Unit in `e2e/einheit/kosten.test.js`: fester Vergleich `VOR_DER_KARTE` an `kostenbericht()` — ohne Zeitraum und Abschnitt das bisherige Ergebnis; dazu die Fälle der Tabelle. Format-Test in Rust: Rundlauf mit beiden Schlüsseln, ohne sie zeichengleich. E2E als Spec am Beispielboard mit fester Browser-Uhr und Zeitzone.

## Implementierungshinweise

- Vorgabe ist ADR-0028 N1 (Fundstellen dort; am Code gelesen, nicht gefahren — deshalb beginnt jedes Feature mit dem Vergleich an der Trennstelle).
- Schnitt: F0136 Zeitraum und Aufgabenliste (nur Browser) · F0137 Spaltenabschnitt samt Speichern (Server und Format) · F0138 Kennzeichen, Eimer und Texte.
- **Nicht hinein:** Kosten je Rolle aufklappen (Karte #167) · Export · Währungsumrechnung · Bearbeiten im Bericht.

## Warum löst diese Anforderung das Problem?

Auslöser: Der Bericht nennt je Währung eine Summe über alles. Wählt der Betreiber Zeitraum und Abschnitt (X), zählt der Bericht nur die Einträge darin und nennt die Aufgaben dahinter (Y); damit lässt sich ein Abrechnungszeitraum oder ein Abschnitt des Boards belegen, ohne die Aufgabendateien von Hand zu addieren (Z).

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Die Zeichnung `Dokumentation/Wireframes/D0006.dc.html#kosten-zeitraum-abschnitt` entsteht vor dem Bau durch den gestalter (beauftragt der Director).
