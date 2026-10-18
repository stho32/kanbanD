---
id: R00060
status: Erledigt
datum: 2026-10-18
---

# R00060: Zählen in Berichten je Aufgabe

## Beschreibung

Ob eine Aufgabe im Burndown und in Wie lange noch zählt, hängt an ausdrücklich lesbaren und schreibbaren Eigenschaften der Aufgabe im Namensraum `reporting`: `reporting.burndown` und `reporting.forecast`. Fehlt ein Schlüssel, gilt der Standard: die Aufgabe zählt, wie heute. Wer das Board befüllt — die KI oder der Mensch — setzt `false` für Arbeit, die nicht in den Fortschritt gehört, etwa Anmerkungen oder Nebenarbeit. Neue Berichte bekommen später einen eigenen Schlüssel.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“, „Die WBS als Stand, die Aufgaben als Fortschritt“.

## Geschäftlicher Nutzen

Auf einem Board liegen Arbeitspakete und Zusatzaufgaben zusammen, und die Prognose rechnet trotzdem nur mit dem, was den Fortschritt ausmacht — damit sie mit `/anwendung wie-lange-noch` vergleichbar bleibt.

## Funktionale Anforderungen

- Frontmatter der Aufgabe:
  ```yaml
  reporting:
    burndown: false
    forecast: false
  ```
- `PATCH /api/aufgaben/<nr> {reporting: {burndown?, forecast?}}`; `null` entfernt den Schlüssel (Standard gilt wieder); Nachricht `#<nr> geändert: Zählen in Berichten`.
- Burndown (R00044) zählt eine Aufgabe nur mit `reporting.burndown ≠ false`, Wie lange noch (R00046, R00058) nur mit `reporting.forecast ≠ false`; beide nennen unter „Nicht enthalten“ die Zahl der so ausgenommenen Aufgaben.
- Aufgabenfenster: Abschnitt „Zählt in Berichten“ mit je einem Schalter und der Angabe „(Standard)“, solange der Schlüssel fehlt.
- Filterleiste (R00043) bleibt unabhängig: sie wirkt zusätzlich.
- Unbekannte Schlüssel unter `reporting` bleiben erhalten.

## Akzeptanzkriterien

- [x] #1 ohne `reporting`, #2 `reporting.forecast: false`, beide offen → Wie lange noch: Umfang 1, „Nicht enthalten: ausgenommen 1“; Burndown: Umfang 2
- [x] `PATCH {reporting: {forecast: null}}` an #2 → Schlüssel entfernt, Wie lange noch Umfang 2; ein Commit je Änderung
- [x] Rundlauf mit `reporting: {forecast: false, cycle-time: true}` erhält `cycle-time`
- [x] Oberfläche: Schalter „Wie lange noch“ ausschalten → Bericht offen passt sich ohne Neuladen an

## Betroffene Verzeichnisstruktur

`src/modell/aufgabe.rs`, `src/format/aufgabe.rs` (`reporting`), `src/dienst/aufgabe_aendern.rs`, `web/berichte.js` (`burndown`, `prognose`), `web/ansicht.js`; Tests in den Modulen, `e2e/einheit/berichte.test.js`, `e2e/tests/r00060-zaehlen.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `Berichtszaehlung` (DTO) — `burndown: Option<bool>`, `forecast: Option<bool>`, weitere Schlüssel unverändert
- `zaehlt` in `prognose` und `burndown` um die Eigenschaft erweitert (pure)

## Tests
- Unit: Standard, `false`, entfernter Schlüssel; „Nicht enthalten“
- Integration: PATCH mit Commit, Rundlauf
- E2E: Schalter im Aufgabenfenster, Bericht live

## Abhängigkeiten
- Abhängig von: R00044, R00046
- Blockiert: —

## Offene Fragen
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Auf einem Board, das die Arbeit an einer Anwendung führt, liegen neben den Arbeitspaketen auch Anmerkungen und Nebenarbeit; zählen sie mit, verschiebt sich die Prognose gegenüber `/anwendung wie-lange-noch`, das nur Arbeitspakete zählt. Eine ausdrücklich benannte Eigenschaft je Bericht macht die Entscheidung an der Karte sichtbar und änderbar, statt sie aus Klassen oder Spalten zu erraten. Weil der Standard das heutige Verhalten ist, behalten bestehende Boards ihre Zahlen. Je Bericht ein eigener Schlüssel hält das Modell erweiterbar, ohne bestehende Karten umzuschreiben.

## Notizen

- Verworfen: ein einziges `counts` für alle Berichte — nicht ausdrücklich genug und nicht erweiterbar.
- Verworfen: Zählen aus der WBS-Ebene rechnen — Knoten sind keine Aufgaben mehr.
