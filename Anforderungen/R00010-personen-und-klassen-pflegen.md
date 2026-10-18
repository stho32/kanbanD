---
id: R00010
status: Erledigt
datum: 2026-10-18
---

# R00010: Personen und Klassen pflegen

## Beschreibung

Die Seite „Einrichten“ pflegt, was für den ganzen Ordner gilt: Personen (Mensch oder Agent) und Klassen (Bezeichnung und Farbe) sowie die Quellpfade für WBS und Anforderungen. Personen werden nie entfernt, sondern stillgelegt — ihr Name bleibt an Karten und Zeiten lesbar. „Speichern“ schreibt `kanbanD.md` in einem Commit.

Zahlt ein auf: [Vision](R00000-vision.md) — „Personen und Klassen gelten für den ganzen Ordner“, „Mensch und Agent arbeiten gleichberechtigt“.

## Geschäftlicher Nutzen

Neue Mitarbeitende und Agenten kommen ohne Dateibearbeitung dazu; die Geschichte bleibt lesbar.

## Funktionale Anforderungen

- `PUT /api/einstellungen` mit `{personen, klassen, quellen}` ersetzt den Inhalt von `kanbanD.md`.
- Personen: Kürzel 1–8 Kleinbuchstaben/Ziffern, eindeutig, Name nicht leer; jede bisherige Person muss enthalten sein (sonst 409 „… wird stillgelegt, nicht entfernt“); das Kürzel einer Person ändert sich nicht.
- Klassen: Schlüssel aus Kleinbuchstaben, Ziffern, `-` und `_`, eindeutig; Bezeichnung nicht leer; Farbe ist einer der 16 Palettennamen oder `#rrggbb`. Klassen dürfen entfernt werden; Aufgaben behalten ihren Schlüssel und erscheinen ohne Farbe.
- Ohne Änderung kein Commit. Nachricht: `Einstellungen geändert`.
- Die Seite `#/einrichten` zeigt Personen (Kürzel, Name, Mensch/Agent, stilllegen/zurückholen), Klassen (Farbfeld mit Palette, Schlüssel, Bezeichnung, entfernen), Quellpfade und eine Vorschau von `kanbanD.md`; „Speichern“ und „Verwerfen“.
- Stillgelegte Personen sind unter „Ich bin …“ nicht wählbar; der Name bleibt an Karten sichtbar.

## Akzeptanzkriterien

- [x] Person `mi`/„Mia“ als Mensch hinzufügen, Klasse `doku`/„Doku“/`teal` hinzufügen → `kanbanD.md` enthält beide, ein Commit
- [x] Liste ohne bisherige Person `cl` → 409; neue Person mit Kürzel `M!` → 400; Farbe `lila` → 400; doppelter Klassenschlüssel → 400
- [x] Gleicher Inhalt → kein Commit
- [x] Oberfläche: „Claude“ stilllegen und speichern → `active: false` in der Datei; „Ich bin …“ zeigt Claude als stillgelegt
- [x] Oberfläche: Klasse „Fehler“ auf Farbe `orange` stellen → Karten dieser Klasse tragen nach dem Speichern die neue Farbe

## Betroffene Verzeichnisstruktur

`src/dienst/einstellungen.rs`, `src/web/mod.rs`, `web/`; Tests `tests/einstellungen.rs`, `e2e/tests/r00010-einrichten.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `Kanban::einstellungen_setzen(&Person, Einstellungen) -> Result<bool, Fehler>` (Integration)
- `einstellungen_pruefen(alt, neu) -> Result<(), Fehler>` (pure)
- `farbe_gueltig(&str) -> bool` (pure)

## Tests
- Unit: Prüfregeln
- Integration: API mit Git-Prüfung
- E2E: Stilllegen, Klassenfarbe

## Abhängigkeiten
- Abhängig von: R00003
- Blockiert: R00019

## Offene Fragen
