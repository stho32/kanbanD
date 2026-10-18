---
id: R00022
status: Neu
datum: 2026-10-18
---

# R00022: Stundenzettel und CSV

## Beschreibung

Das Menü „Berichte“ (Artboard D0006) bietet den Stundenzettel einer Person für eine Woche (Aufgaben × Tage mit Summen), die Kreuztabelle „Zeiten nach Aufgabe und Person“ für diese Woche, 30 Tage oder alles, und den Export aller Zeiteinträge als CSV. Berichte lesen nur; korrigiert wird an der Aufgabe — eine Zeile öffnet sie.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“, „Zeiterfassung, die zum Arbeiten passt“.

## Geschäftlicher Nutzen

Zeiten lassen sich abrechnen und auswerten, ohne die Dateien zu lesen.

## Funktionale Anforderungen

- `GET /api/berichte/zeiten.csv`: UTF-8 mit BOM, Trennzeichen `;`, Kopf `aufgabe;titel;person;art;beginn;ende;dauer_min;herkunft`; eine Zeile je Zeiteintrag (auch archivierte Aufgaben), laufende ohne Ende mit Dauer bis jetzt; Felder mit `;`, `"` oder Zeilenumbruch in Anführungszeichen.
- Stundenzettel: Person wählbar (aktive Menschen und Agenten), Woche Mo–So mit „‹ ›“ blätterbar; Zeilen = Aufgaben mit Zeit in der Woche, Spalten = Tage, Summen je Zeile, Tag und gesamt; Einträge über Mitternacht werden anteilig verteilt.
- Kreuztabelle: Zeilen = Aufgaben, Spalten = Personen mit Zeit im Zeitraum, Summen in beide Richtungen; Zeitraum „diese Woche“, „30 Tage“, „alles“.
- Beide Ansichten bieten „CSV“; Klick auf eine Zeile öffnet die Aufgabe.

## Akzeptanzkriterien

- [ ] CSV: Aufgabe 1 „a; b“ mit Eintrag 09:00–10:30 von st → Zeile `1;"a; b";st;human;2026-10-17 09:00;2026-10-17 10:30;90;thin air`
- [ ] Stundenzettel: Eintrag Mo 23:00–Di 01:00 → Mo 1:00, Di 1:00, Summe 2:00
- [ ] Kreuztabelle „alles“: #1 st 1:30, cl 0:30 → Zeilensumme 2:00, Spaltensummen passen
- [ ] Oberfläche: Berichte ▾ → Stundenzettel zeigt für Stefan die Aufgabe mit Zeit; CSV-Link liefert die Datei

## Betroffene Verzeichnisstruktur

`src/berichte.rs` (CSV, pure), `src/web/mod.rs`; `web/zeiten.js`, `web/ansicht.js`, `web/app.js`; Tests in `src/berichte.rs`, `tests/berichte.rs`, `e2e/einheit/zeiten.test.js`, `e2e/tests/r00022-berichte.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `berichte::zeiten_csv(&[Aufgabe], &Einstellungen, jetzt) -> String` (pure)
- `stundenzettel(aufgaben, wer, wochenbeginn, jetzt)`, `kreuztabelle(aufgaben, von, jetzt)` (pure, JS)

## Tests
- Unit: CSV-Zeilen und Quoting; Stundenzettel über Mitternacht; Kreuztabelle mit Summen
- Integration: CSV-Endpunkt
- E2E: Menü, Stundenzettel, CSV-Link

## Abhängigkeiten
- Abhängig von: R00014, R00015

## Offene Fragen
