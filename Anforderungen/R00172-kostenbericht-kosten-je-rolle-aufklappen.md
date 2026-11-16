---
id: R00172
status: Erledigt
datum: 2026-11-16
---

# R00172: Kostenbericht — Kosten je Rolle aufklappen

## Beschreibung

Herkunft: Auftrag des Betreibers vom 2026-11-15 (Karte #167), Zuschnitt des product-owner, Technik vom architekt am Code belegt. **Wozu**, im Wortlaut des Betreibers: „… und man soll auch die Kosten pro Rolle aufklappen können um ‚noch weiter in die Details gehen zu können‘.“

**Umfang:** Der Bericht „Kosten“ ([R00171](R00171-kostenbericht-zeitraum-spaltenabschnitt-und-aufgabenliste.md)) bekommt je Währung eine aufklappbare Gruppe **„Kosten je Rolle“**: je Rolle die Summe ihrer zählenden Einträge, je Rolle weiter aufklappbar bis zu ihren Aufgaben und deren Einträgen.

**Entschieden:**

1. **Rechnung:** `kostenaufstellung()` in `web/kosten.js` liefert je Währungsgruppe `rollen: [{rolle, cent, aufgaben: [{nummer, titel, cent, eintraege: [{at, spalte, cent, tokens}]}]}]` aus denselben zählenden Einträgen wie die Summe; mit und ohne Bereich gilt: Summe der Rollen = Teilzeile „Einträge“. „Ohne Rolle“ sind allein die alten Posten — eine abgesetzte Schlusszeile, die ohne Bereich mitzählt und mit Bereich „nicht in der Summe“ steht (Betreiber 2026-11-16, wie R00171).
2. **Director:** keine Sonderregel — die Rolle `director` am Eintrag ist eine Rolle wie jede andere.
3. **Schreibweise:** Rollen stehen getrennt, wie sie gespeichert sind (`Entwickler` ≠ `entwickler`), alphabetisch sortiert, „ohne Rolle“ zuletzt; je Währung eine eigene Rollengruppe.
4. **Aufklappen:** natives `<details>` in zwei Ebenen — „Kosten je Rolle“, darin je Rolle; unter einer Rolle ihre Aufgaben (Nr., Titel, Betrag), darunter eingerückt die Einträge (Zeitpunkt, Spalte, Betrag) ohne dritte Klappe. Der Klappzustand lebt nur in der Sitzung (`S.ui`, Muster der Filterbox `web/app.js:66–70`); nichts wird gespeichert, kein Datenformat.
5. **Beispielboard:** In `e2e/tests/r00171-beispielboard.js` bekommt der Eintrag #1 12.11. 1,00 die Rolle `planer` und der Eintrag #2 0,54 die Rolle `architekt`; alle übrigen bleiben `entwickler`. Die Tests von R00171 bleiben unverändert grün.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“. Baut auf R00171 und [R00165](R00165-kosteneintraege-mit-zeitstempel-rolle-und-spalte.md).

## Akzeptanzkriterien

**Ausgangslage:** das Beispielboard mit vier Aufgaben aus R00171 mit den Rollen aus Entscheidung 5, Betrachter in +01:00, alle Beträge in USD. **Fall 1** = Zeitraum 12.11.–13.11., Abschnitt „Entwicklung“–„Abnahme“.

- [x] **AK 1 Rollen im Bereich:** Fall 1, „Kosten je Rolle“ aufgeklappt: architekt 0,54 $ · entwickler 3,46 $ · planer 1,00 $ in dieser Reihenfolge; Rollen 5,00 $ = Summe des Berichts 5,00 $ (0,54 + 3,46 + 1,00).
- [x] **AK 2 Bis zur Aufgabe und ihren Einträgen:** Fall 1, „entwickler“ aufgeklappt: Aufgabe #1 mit 3,46 $ und darunter der Eintrag 13.11. 10:34 · „Entwicklung“ · 3,46 $; „planer“: #1 mit 1,00 $; „architekt“: #2 mit 0,54 $.
- [x] **AK 3 Ohne Rolle im Bereich:** Fall 1: die Schlusszeile „ohne Rolle“ nennt 5,00 $ mit „nicht in der Summe“.
- [x] **AK 4 Ohne Bereiche:** architekt 0,54 $ · entwickler 9,46 $ (#1 5,46 $ = 3,46 + 2,00; #3 4,00 $) · planer 1,00 $ = „Einträge“ 11,00 $; „ohne Rolle“ 5,00 $ zählt mit; Summe 16,00 $.
- [x] **AK 5 Folgt dem Bereich, bleibt offen:** Ein Wechsel von Zeitraum oder Abschnitt ändert die Rollensummen (von AK 4 zu Fall 1: entwickler 9,46 $ → 3,46 $); eine aufgeklappte Rolle bleibt dabei und nach einem Live-Ereignis offen.
- [x] **AK 6 Tastatur:** Tab erreicht jede Klappe; Enter und Leertaste öffnen und schließen sie.
- [x] **AK 7 Schmal:** Bei 375 px Breite kein waagrechtes Scrollen; Rolle und Betrag bleiben lesbar.
- [x] **AK 8 Bleibt:** Zugeklappt (Anfangszustand) sind Summen, Aufgabenliste, Eimer und Texte wie vor der Karte — die Proben von R00171 laufen unverändert grün; sichtbar steht „Aufgaben“, nie „Karten“.

Gestaltung nach der Zeichnung `Dokumentation/Wireframes/D0006.dc.html#kosten-je-rolle`.

## Tests

Unit in `e2e/einheit/kosten.test.js` an `kostenaufstellung()` (erster Test: Fall 1 → 54/346/100 Cent, Summe der Rollen = „Einträge“). E2E als Spec am Beispielboard mit fester Browser-Uhr und Zeitzone.

## Implementierungshinweise

- Schnitt: F0139 Rechnung je Rolle (`web/kosten.js`, Einheitstest) · F0140 Zeichnung und Klappzustand (`web/ansicht.js`, `web/app.js`, CSS).
- **Nicht hinein:** Export · Preistabelle · Zusammenfassen verschieden geschriebener Rollen · Speichern des Klappzustands.

## Warum löst diese Anforderung das Problem?

Auslöser: Der Bericht nennt je Bereich eine Summe und die Aufgaben dahinter, aber nicht, welche Rolle sie verursacht hat. Klappt der Betreiber „Kosten je Rolle“ auf (X), sieht er je Rolle ihren Anteil und darunter Aufgaben und Einträge (Y); damit belegt er die Summe bis zum einzelnen Eintrag, ohne Aufgabendateien von Hand zu addieren (Z).

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Die Zeichnung `Dokumentation/Wireframes/D0006.dc.html#kosten-je-rolle` entsteht vor dem Bau durch den gestalter (beauftragt der Director).
