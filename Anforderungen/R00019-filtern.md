---
id: R00019
status: Neu
datum: 2026-10-18
---

# R00019: Filtern

## Beschreibung

Das Board lässt sich über ein Filterfeld in der Kopfzeile eingrenzen: Freitext sucht im Titel, dazu Schlüsselwörter für Nummer, Person, Klasse, Herkunft, Label und Archiv. Ein Umschalter zeigt alle, nur meine oder nur Agenten-Aufgaben; eine Legende unter dem Board zeigt die Klassen mit ihrer Zahl und filtert per Klick.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design … per Tastatur bedienbar“; Herkunft filterbar (Wireframes).

## Geschäftlicher Nutzen

Auch auf vollen Boards findet man das Gesuchte in Sekunden.

## Funktionale Anforderungen

- Wörter werden mit UND verknüpft; Groß-/Kleinschreibung zählt nicht.
- `#12` → Nummer 12; `@st` → `st` ist zuständig; `class:bug`, `class:none`; `origin:I0023`, `origin:"thin air"`; `label:ui`; `is:archived` → Archivansicht; jedes andere Wort (auch `x:y` mit unbekanntem Schlüssel) muss im Titel vorkommen.
- Umschalter: „alle“, „meine“ (ich bin zuständig), „Agenten“ (ein Agent ist zuständig).
- Die Spaltenzahl zählt nur Treffer; leere Spalten zeigen „keine Treffer“.
- Legende: je Klasse Farbe, Bezeichnung und Zahl der sichtbaren Karten, dazu „ohne Klasse“; Klick setzt bzw. entfernt `class:<schlüssel>` im Filter.
- `/` setzt den Fokus ins Filterfeld; Esc leert es.
- Filter und Umschalter bleiben je Tab über ein Neuladen erhalten.

## Akzeptanzkriterien

- [ ] `passt`: „kopf class:feature“ trifft #12 „Kopfzeile verdichten“ (feature), nicht #13 „Kopfzeile“ (bug); „#12“ trifft nur 12; „@cl“ nur Aufgaben mit cl; `origin:"thin air"` nur Aufgaben ohne Herkunft; `class:none` nur ohne Klasse; `label:UI` trifft `ui`
- [ ] Oberfläche: „class:bug“ zeigt nur Fehler-Karten, Spaltenzahlen passen; Klick auf „Fehler“ in der Legende entfernt den Filter wieder
- [ ] Oberfläche: „meine“ zeigt nur Karten, für die ich zuständig bin
- [ ] Oberfläche: `/` fokussiert das Filterfeld, Esc leert es

## Betroffene Verzeichnisstruktur

`web/filter.js` (pure, auch in Node ladbar), `web/ansicht.js`, `web/app.js`; Unit-Tests `e2e/einheit/filter.test.js` (`node --test`), E2E `e2e/tests/r00019-filtern.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `filterWoerter(text) -> [[schlüssel, wert]]`, `passt(aufgabe, text, {ich, personen}) -> bool` (pure)

## Tests
- Unit: alle Schlüsselwörter, Anführungszeichen, UND-Verknüpfung
- E2E: Filterfeld, Legende, Umschalter, Tastatur

## Abhängigkeiten
- Abhängig von: R00005, R00010

## Offene Fragen
