---
id: R00084
status: Erledigt
datum: 2026-10-25
---

# R00084: Zeitpunkte mit Zeitzone

## Beschreibung

kanbanD schreibt Zeitpunkte von Zeiteinträgen, Kommentaren und Archivierung heute als Ortszeit ohne Zone (`2026-10-25 07:41`). In der Nacht der Zeitumstellung gibt es `02:33` zweimal, und `uhr::minuten` rechnet einen Eintrag über die Umstellung hinweg eine Stunde zu kurz (Fall #39 auf dem JoinPuya-Board); im Browser wurde laufende Zeit nach der Umstellung mit einer Stunde zu viel angezeigt. Künftig trägt jeder neu geschriebene Zeitpunkt seinen UTC-Versatz (`2026-10-25 07:41+01:00`); gerechnet wird über echte Zeitpunkte, angezeigt weiter in Ortszeit ohne Versatz.

Zahlt ein auf: [Vision](R00000-vision.md) — Git als vollständiges Gedächtnis: wer wann was getan hat, eindeutig.

## Geschäftlicher Nutzen

Zeiten stimmen auch über die Zeitumstellung, zwischen Rechnern in verschiedenen Zonen und in lange offenen Browser-Tabs; niemand muss Einträge von Hand umrechnen.

## Funktionale Anforderungen

- Neu geschriebene Zeitpunkte (Timer-Start/-Stopp, Nachtragen, Korrektur, Kommentar, Archivierung) haben die Form `JJJJ-MM-TT HH:MM±HH:MM` mit dem Versatz der Ortszeit in diesem Moment.
- Gelesen werden beide Formen: mit Versatz, und ohne Versatz (Altbestand) als Ortszeit; bei zweideutiger Ortszeit (Umstellungsnacht) gilt die frühere, bei nicht existierender die spätere Deutung.
- Eingaben über die API (`beginn`, `ende`) dürfen mit oder ohne Versatz kommen, auch in ISO-Form `2026-10-25T07:41+01:00` oder `…Z`; gespeichert wird in der Dateiform mit Versatz.
- Dauern (`uhr::minuten`, Summen, Berichte, CSV) rechnen über UTC-Zeitpunkte.
- Die API liefert Zeitpunkte in der Dateiform; die Oberfläche rechnet mit dem Versatz und zeigt `HH:MM` in der Ortszeit des Browsers.
- Bestehende Dateien werden nicht umgeschrieben; nur Einträge, die ohnehin geschrieben werden, bekommen den Versatz.

## Akzeptanzkriterien

### Rechnen
- [x] `minuten("2026-10-25 02:33+02:00", "2026-10-25 02:10+01:00")` = 37 (über die Umstellung)
- [x] `minuten("2026-10-25 01:00", "2026-10-25 04:00")` ohne Versatz in `Europe/Berlin` = 240 (Altbestand als Ortszeit)
- [x] `jetzt()` endet auf einen Versatz `+01:00` bzw. `+02:00`
- [x] Zeitpunkte `…T…Z`, `…T…+01:00`, `… HH:MM` und `… HH:MM:SS` werden gelesen und in Dateiform normalisiert

### Datei und API
- [x] Ein Timer-Start schreibt `JJJJ-MM-TT HH:MM±HH:MM` in den Block `kanbanD-time`; Rundlauf lesen → schreiben ist verlustfrei, Altzeilen bleiben ohne Versatz unverändert
- [x] Kommentar- und Archivzeitpunkt tragen den Versatz

### Oberfläche
- [x] `zeitMs("2026-10-25 02:33+02:00")` = `Date.UTC(2026,9,25,0,33)` unabhängig von der Zone des Browsers
- [x] Die Zeitliste und der Timer zeigen `HH:MM` ohne Versatz in Ortszeit
- [x] Ein laufender Timer, gestartet `05:57+01:00`, zeigt um 07:40 Ortszeit `1:43`

## Betroffene Verzeichnisstruktur

`src/uhr.rs` (Zeitpunkt-Logik), `src/format/aufgabe.rs` (`zeitpunkt`, `ZEITFORMAT`), `src/dienst/{timer,zeiten,kommentare,archiv}.rs`, `src/berichte.rs`, `src/verlauf.rs`; Oberfläche `web/zeiten.js`, `web/ansicht.js`; Tests `tests/`, `e2e/einheit/`, `e2e/tests/`.

## Technische Überlegungen

### Ablauf
1. **Ein Typ für Zeitpunkte** in `uhr.rs`: lesen (mit/ohne Versatz, ISO), normalisieren, nach UTC wandeln, formatieren — `chrono::DateTime<FixedOffset>`; Ortszeit-Deutung über `chrono::Local` mit `LocalResult::Ambiguous` → früher, `None` → später.
2. **Alle Schreiber** über `uhr::jetzt()`, das jetzt den Versatz anhängt.
3. **Vergleiche** (`ende < beginn`, Sortierung, Tagesgrenzen in Berichten) über UTC statt über Strings.
4. **Client**: `zeitMs` erkennt den Versatz; ohne Versatz wie bisher `new Date(j, m-1, t, h, mi)`; Anzeigen nutzen `slice(11, 16)` statt `slice(11)`.

### Grobentwurf
- `uhr::Zeitpunkt` (Wert, immutable) — Zeitpunkt mit Versatz
  - `fn lesen(s: &str) -> Option<Zeitpunkt>` · `fn datei(&self) -> String` · `fn utc(&self) -> DateTime<Utc>`
- `uhr::minuten(beginn, ende)` bleibt Signatur, rechnet über `Zeitpunkt`.

### Änderungen an bestehenden Klassen
- `format::aufgabe::zeitpunkt` delegiert an `uhr::Zeitpunkt::lesen`.
- `dienst::zeiten::zeit_korrigieren` vergleicht über UTC.
- `web/zeiten.js::zeitMs`, Anzeige-Slices in `web/ansicht.js`.
- Prüfen: `~/.claude/commands/testen/kanband.py` und `~/.claude/commands/anwendung/wie-lange-noch.py` lesen Zeitpunkte — beide müssen den Versatz vertragen (anpassen, falls sie den kanbanD-Zeitpunkt parsen).

## Tests
**Unit:** `uhr` (Lesen aller Formen, zweideutige/fehlende Stunde, Minuten über die Umstellung), `web/zeiten.js` (`zeitMs` mit Versatz, mit `TZ=Europe/Berlin` und `TZ=UTC`).
**Integration:** `tests/` — Timer-Start schreibt Versatz, Altzeile bleibt, Korrektur mit ISO-Eingabe.
**E2E:** Zeitliste zeigt `HH:MM` ohne Versatz; laufender Timer zählt richtig.

## Abhängigkeiten
- Abhängig von: R00014, R00015
- Blockiert: R00090

## Offene Fragen
- keine — Form „Versatz in Datei und API“ entschieden am 2026-10-25 (Feedback-Runde Punkt 7)

## Notizen
### Verworfene Alternativen
- Intern UTC (`…T06:41Z`): sauber, aber in der Datei für Menschen schlecht lesbar.
- Nur Client-Korrektur: lässt die Zweideutigkeit der Umstellungsnacht in der Datei.

## Warum löst diese Anforderung das Problem? (Pflicht)

Ortszeit ohne Zone → in der Umstellungsnacht zweideutig und für jede Rechnung auf Ortsregeln angewiesen → falsche Dauern und Anzeigen. Mit Versatz → jeder Zeitpunkt ist ein eindeutiger Moment → Dauern über UTC stimmen immer, die Anzeige rechnet nur noch für die Darstellung in Ortszeit um.
