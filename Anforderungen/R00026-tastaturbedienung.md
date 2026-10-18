---
id: R00026
status: Neu
datum: 2026-10-18
---

# R00026: Tastaturbedienung

## Beschreibung

Das Board ist ohne Maus bedienbar: Pfeiltasten bewegen den Fokus zwischen Karten, Umschalt+Pfeil verschiebt die fokussierte Karte (zwischen Spalten oder innerhalb), Enter öffnet sie, `n` legt in der Spalte der fokussierten Karte (sonst der ersten) eine neue an, `/` springt ins Filterfeld, `?` zeigt alle Kürzel, Esc schließt. Im Aufgabenfenster wechseln ↑/↓ die Karte.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design … per Tastatur bedienbar und folgt gewohnten Konventionen“.

## Geschäftlicher Nutzen

Wer viel am Board arbeitet, ist mit der Tastatur schneller; zugleich ist das Board barrierearm.

## Funktionale Anforderungen

- Fokus: ←/→ zur Karte gleicher Position (oder letzter) in der Nachbarspalte mit Karten; ↑/↓ innerhalb der Spalte; ohne Fokus wählt jede Pfeiltaste die erste sichtbare Karte.
- Umschalt+←/→ verschiebt in die Nachbarspalte an gleiche Position (höchstens ans Ende); Umschalt+↑/↓ tauscht mit der Nachbarkarte; am Rand passiert nichts. Der Fokus bleibt auf der Karte.
- Enter öffnet die fokussierte Karte; `n` öffnet „+ Karte“; `?` öffnet die Übersicht der Kürzel, Esc schließt sie.
- Kürzel wirken nicht, solange ein Eingabefeld den Fokus hat.

## Akzeptanzkriterien

- [ ] Rechnung: Spalten `A: 1,2,3 · B: — · C: 4` — von 2 nach rechts → 4 (leere Spalte übersprungen, Position 1 gibt es in C nicht: letzte); von 4 nach links → 1 (gleiche Position); von 1 nach unten → 2; von 3 nach unten → keine
- [ ] Rechnung: Umschalt+→ von 2 → `{spalte: B, index: 0}` (Nachbarspalte, auch wenn leer); Umschalt+↑ von 2 → `{spalte: A, index: 0}`; Umschalt+← von 1 → keins
- [ ] Oberfläche: Tab auf eine Karte, → , Umschalt+→, Enter → richtige Karte in neuer Spalte geöffnet; Board-Datei geändert
- [ ] Oberfläche: `n` öffnet das Eingabefeld; `?` zeigt die Kürzel

## Betroffene Verzeichnisstruktur

`web/tastatur.js` (pure), `web/app.js`, `web/ansicht.js`; Unit-Tests `e2e/einheit/tastatur.test.js`, E2E `e2e/tests/r00026-tastatur.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `nachbar(spalten, nr, richtung) -> nr|null`, `verschiebeziel(spalten, nr, richtung) -> {spalte, index}|null` (pure; `spalten` = sichtbare Karten je Spalte)

## Tests
- Unit: alle Richtungen und Ränder
- E2E: Fokus, Verschieben, Öffnen, `n`, `?`

## Abhängigkeiten
- Abhängig von: R00006, R00011

## Offene Fragen
