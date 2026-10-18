---
id: R00028
status: Neu
datum: 2026-10-18
---

# R00028: Schnelleingabe mit Kürzeln

## Beschreibung

Beim Anlegen einer Aufgabe lassen sich die wichtigsten Felder gleich im Titel mitgeben: `Login reparieren @mi class:bug label:ui due:morgen I0007`. Erkannte Kürzel werden aus dem Titel genommen und als Felder gesetzt; unter dem Eingabefeld zeigt eine Vorschau, was erkannt wurde. Das gilt auch für jede Zeile beim mehrzeiligen Einfügen.

Zahlt ein auf: [Vision](R00000-vision.md) — „per Tastatur bedienbar“; Filterwörter (R00019) sind dieselben Kürzel.

## Geschäftlicher Nutzen

Eine Aufgabe ist in einem Zug vollständig, ohne das Fenster zu öffnen.

## Funktionale Anforderungen

- `@kürzel` einer eingetragenen Person → zuständig (mehrere möglich; ersetzt die automatische Zuweisung der anlegenden Person). Unbekannte `@…` bleiben im Titel.
- `class:<schlüssel>` einer vorhandenen Klasse; `label:<text>` (mehrere); `due:` mit `heute`, `morgen`, `übermorgen`, `+N` (Tage), `JJJJ-MM-TT` oder `TT.MM.` / `TT.MM.JJJJ`; Herkunft als `I0001`-artige WBS-ID oder `R00001`.
- Unbekannte Klasse oder unlesbares Datum bleiben im Titel stehen.
- `POST /api/aufgaben` und `/api/aufgaben/mehrere` nehmen je Aufgabe `klasse`, `zustaendige`, `labels`, `faellig`, `herkunft` an — geprüft wie beim Ändern (R00011); ein Verstoß → 400, nichts entsteht.
- Die Vorschau zeigt Titel und erkannte Felder als Plaketten, während getippt wird.

## Akzeptanzkriterien

- [ ] Auswertung am 2026-10-18: `Login reparieren @mi @zz class:bug class:gibts label:ui due:morgen I0007` → Titel `Login reparieren @zz class:gibts`, zuständig `[mi]`, Klasse `bug`, Labels `[ui]`, Fälligkeit `2026-10-19`, Herkunft `[I0007]`
- [ ] `due:+7` → 2026-10-25; `due:24.12.` → 2026-12-24; `due:31.02.` bleibt im Titel
- [ ] API mit `klasse: "gibtsnicht"` → 400; mit gültigen Feldern → Datei enthält sie, ein Commit
- [ ] Oberfläche: Eingabe zeigt die Vorschau; Enter legt die Karte mit Klassenfarbe und Zuständiger an

## Betroffene Verzeichnisstruktur

`web/eingabe.js`, `src/dienst/aufgabe_anlegen.rs`, `web/`; Tests `e2e/einheit/eingabe.test.js`, `tests/mehrere.rs`, `e2e/tests/r00028-schnelleingabe.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `schnelleingabe(text, {personen, klassen}, heute) -> {titel, zustaendige, klasse, labels, faellig, herkunft}` (pure, JS)
- `Angaben` (DTO) je neuer Aufgabe; Prüfung über `Aufgabe::aendern`

## Tests
- Unit: alle Kürzel, Datumsformen, Unbekanntes
- Integration: Felder beim Anlegen, Fehler ohne Wirkung
- E2E: Vorschau und Anlegen

## Abhängigkeiten
- Abhängig von: R00027, R00011

## Offene Fragen
