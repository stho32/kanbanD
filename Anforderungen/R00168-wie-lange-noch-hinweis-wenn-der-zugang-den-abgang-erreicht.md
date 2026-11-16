---
id: R00168
status: Erledigt
datum: 2026-11-16
---

# R00168: Wie lange noch — Hinweis, wenn der Zugang den Abgang erreicht

## Beschreibung

Herkunft: Hinweis 5 des Directors zu Karte #154 (Befund des realist-consultant), vom Betreiber am 2026-11-14 freigegeben; hier Karte #158. „Wie lange noch“ ([R00046](R00046-wie-lange-noch.md)) rechnet nur mit den heute offenen Aufgaben; kommt laufend Arbeit hinzu, ist die Prognose zu optimistisch und sagt es nicht.

**Umfang:** Jeder Block mit Prognose zeigt eine Zeile mit **Zugang Ø** und **Abgang Ø** je Kalendertag über die Messbasis; ist der Zugang mindestens so groß wie der Abgang, steht zusätzlich „kein Ende absehbar“. Abgang ist der Durchsatz des Blocks. Zugang sind die Aufgaben, die in der Messbasis offen wurden (neu oder zurückgeholt), abzüglich der entfernten, nie unter 0. Die Prognosezahlen ändern sich nicht. Technik nach [ADR-0027](../Dokumentation/ADRs/0027-eine-bestandsregel-fuer-alle-berichte.md), Nachtrag N4.

**Wortlaute (endgültig):**

1. Als `<p class="sek">` direkt unter „Durchsatz Ø …“: „Zugang Ø 1,0, Abgang Ø 0,4 je Kalendertag in der Messbasis.“
2. Als `<p>` direkt unter der Prognosetabelle, nur bei Zugang ≥ Abgang: „Bei diesem Zugang kein Ende absehbar: Die Prognose rechnet nur mit den heute offenen Aufgaben.“
3. Ein Punkt in „Lesehinweise und Methodik“: „Zugang: Aufgaben, die in der Messbasis offen wurden (neu oder zurückgeholt), abzüglich der entfernten; Abgang ist der Durchsatz. Die Prognose rechnet ohne Zugang.“

Keine Zeichnung nötig: Textzeilen in vorhandenen Bausteinen, kein neues CSS, keine neue Bedienung.

> **In Kauf genommen — bei der Auslieferung sagen:** Ein Rückläufer zählt als Zugang, sein zweites Erreichen nicht als Abgang; der Hinweis irrt deshalb nur zur warnenden Seite. Die Prognosezahl selbst bleibt optimistisch — der Hinweis sagt es, er rechnet es nicht ein.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“. Baut auf R00046, [R00164](R00164-burndown-zugang-und-abgang-je-tag.md) (Zählweise „hinzugekommen“ und „entfernt“) und [R00081](R00081-berichtsfilter-am-board.md) (Berichtsfilter).

## Akzeptanzkriterien

**Rechenbeispiel:** Board Backlog · Arbeit · Erledigt (ohne Phasen), Messbasis „letzte 10 Tage“, Block der Abschlussspalte. Verglichen werden die Summen, nicht die gerundeten Mittel.

| Beispiel | vor der Messbasis offen | hinzugekommen | entfernt | erledigt | offen | Zugang Ø | Abgang Ø | „kein Ende absehbar“ |
|---|---|---|---|---|---|---|---|---|
| A | 0 | 10 | 0 | 4 | 6 | 10 : 10 = 1,0 | 4 : 10 = 0,4 | ja (10 ≥ 4) |
| B | 5 | 2 | 0 | 4 | 3 | 2 : 10 = 0,2 | 0,4 | nein (2 < 4) |
| C | 4 | 5 | 3 | 3 | 3 | (5 − 3) : 10 = 0,2 | 3 : 10 = 0,3 | nein (2 < 3) |

- [x] **AK 1 Zugang erreicht den Abgang (Abnahme der Karte):** In Beispiel A zeigt der Block der Abschlussspalte die Zeile 1 mit „1,0“ und „0,4“ und die Zeile 2 „kein Ende absehbar“.
- [x] **AK 2 Zugang darunter:** In Beispiel B steht nur die Zeile 1 mit „0,2“ und „0,4“; die Zeile 2 fehlt.
- [x] **AK 3 Prognose unverändert:** Perzentil-Tabelle, „Durchsatz Ø“ und Tagesreihe sind in A und B gleich dem Stand vor der Karte; „Abgang Ø“ ist gleich „Durchsatz Ø“ desselben Blocks.
- [x] **AK 4 Block ohne Prognose:** Hat ein Block unter 3 Läufe in der Messbasis oder nichts offen, steht keine der beiden Zeilen; es bleibt der heutige Satz.
- [x] **AK 5 Entferntes mindert den Zugang:** In Beispiel C zählt der Zugang 2 (Zeile 1 mit „0,2“ und „0,3“), kein „kein Ende absehbar“.
- [x] **AK 6 Dieselben Tage, sonst nichts:** „Messbasis“ und „Rechnen ab“ ändern beide Mittel über dieselben Tage (Beispiel A mit Messbasis 20 Tage: 0,5 und 0,2); Burndown, Durchsatz, Kumulativer Fluss und Fever Chart bleiben unverändert. Die Zeilen stehen je Block, auf Boards mit Phasen also mehrfach.

## Tests

Unit in `e2e/einheit/berichte.test.js`: ein Datensatz mit Zugang, Verworfenem und Rückläufer — `zeilen`, `reihe7` und `durchsatz` gleich dem Stand vor der Karte, die Zugangssumme gleich der Handrechnung (ADR-0027 N4 Punkt 6). E2E als Spec an den Beispielen A und B mit datierten Commits und fester Browser-Uhr (Vorbild: `r00046-wie-lange-noch.spec.js`).

## Implementierungshinweise

- Vorgabe ist ADR-0027 N4: ein zusätzliches Feld je Block in `prognoseRechnen` (`web/berichte.js`), nicht gerechnet mit `nurLetzter`; Zeichnung in `vPrognose` (`web/ansicht.js`). Kein Eingriff in Server, API oder Dateiformat.
- Die Fundstellen des ADR sind am Code gelesen, nicht gefahren; deshalb beginnt der Bau mit dem Unit-Test (B0820).
- **Nicht hinein:** keine Simulation mit Zugang (geparkt) · Angleichung an die Zielspalte ist Karte #159.

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung den Absatz „In Kauf genommen“ sagen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Auf Boards, auf denen laufend Aufgaben entstehen, nennt die Prognose ein Datum, das nie eintritt. Stehen Zugang und Abgang über dieselben Tage nebeneinander (X), sieht der Betreiber im selben Block, ob der Rest überhaupt schrumpft (Y), und liest das Datum bei „kein Ende absehbar“ nicht mehr als Zusage (Z).
