---
id: R00021
status: Neu
datum: 2026-10-18
---

# R00021: Personenübersicht

## Beschreibung

Die Seite „Personen“ (Artboard D0005) zeigt je aktiver Person, was gerade läuft, eine Tagesleiste von 6 bis 20 Uhr mit den heutigen Zeiten, die Summen heute und in dieser Woche sowie die offenen zugewiesenen Aufgaben. Personen sind gruppiert in „läuft jetzt“, „heute aktiv“ und „heute ruhig“. Ein Klick auf eine Person zeigt das Board gefiltert auf sie.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mensch und Agent arbeiten gleichberechtigt“, „Zeiterfassung, die zum Arbeiten passt“.

## Geschäftlicher Nutzen

Auf einen Blick sehen, wer woran arbeitet — Menschen wie Agenten.

## Funktionale Anforderungen

- Zeiten zählen anteilig im Zeitraum: heute ab 0 Uhr, Woche ab Montag 0 Uhr (Ortszeit); laufende Einträge bis jetzt.
- „zugewiesen offen“: nicht archivierte Aufgaben mit der Person als Zuständiger, die auf dem aktuellen Board nicht in der Abschlussspalte liegen; „begonnen“ davon die, die nicht in der ersten Spalte liegen.
- Gruppen: läuft jetzt (mindestens ein laufender Timer), heute aktiv (Zeit heute > 0), heute ruhig (sonst).
- Umschalter „Menschen + Agenten“, „nur Menschen“, „nur Agenten“; „Stillgelegte einblenden“.
- Laufende Timer sind in der Zeile stoppbar; die Aufgabennummer öffnet die Aufgabe.
- Klick auf den Namen öffnet das Board mit Filter `@<kürzel>`.

## Akzeptanzkriterien

- [ ] Rechnung: Eintrag gestern 23:00–heute 01:00 zählt heute 1:00; laufender Eintrag seit 30 Minuten zählt 0:30; Eintrag am Montag dieser Woche zählt zur Woche
- [ ] Rechnung: Person mit laufendem Timer → Gruppe 0; nur heute gearbeitet → 1; sonst → 2
- [ ] Rechnung: Aufgabe in „In Arbeit“ für st → offen 1, begonnen 1; in „Erledigt“ → nicht offen
- [ ] Oberfläche: Stefan mit laufendem Timer steht unter „läuft jetzt“, Stopp beendet ihn
- [ ] Oberfläche: Klick auf „Mia“ zeigt das Board mit Filter `@mi`

## Betroffene Verzeichnisstruktur

`web/zeiten.js` (pure), `web/ansicht.js`, `web/app.js`; Unit-Tests `e2e/einheit/zeiten.test.js`, E2E `e2e/tests/r00021-personen.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `anteil(eintrag, von, bis, jetzt)`, `personenZeilen(aufgaben, personen, board, jetzt)` (pure)

## Tests
- Unit: Anteile, Gruppen, offen/begonnen
- E2E: Gruppe und Stopp, Klick filtert

## Abhängigkeiten
- Abhängig von: R00014

## Offene Fragen
