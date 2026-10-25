---
id: R00090
status: In Arbeit
datum: 2026-10-25
---

# R00090: Zeiten-API mit Beginn, Ende und Kennung

## Beschreibung

Zeit nachtragen (R00015) kennt über die API nur `{dauer}` mit Ende „jetzt“; ein Nachtrag aus einem Logbuch braucht deshalb POST plus PATCH. Korrigieren und Löschen adressieren einen Eintrag über seine Position (`/zeiten/{i}`) — schreibt jemand dazwischen auf dieselbe Karte, trifft man den falschen. Künftig nimmt `POST …/zeiten` auch `{beginn, ende, wer?}`, und jeder Eintrag hat die Kennung **`wer@beginn`**, über die er angesprochen wird.

Zahlt ein auf: [Vision](R00000-vision.md) — KI-Agenten über die API als gleichwertige Nutzer.

## Geschäftlicher Nutzen

Ein Agent trägt Zeitblöcke in einem Aufruf nach und korrigiert genau den Eintrag, den er meint — auch wenn andere gleichzeitig auf die Karte schreiben.

## Funktionale Anforderungen

- `POST /api/aufgaben/{nr}/zeiten` nimmt **entweder** `{dauer}` (wie bisher) **oder** `{beginn, ende}`; beides oder keins → `400`.
- `beginn`/`ende` in allen Formen aus R00084; `ende` vor `beginn` → `400`; `ende` in der Zukunft → `400`.
- Optional `wer` (Kürzel einer bekannten Person): bucht für diese Person; Commit-Autor bleibt die handelnde Person; unbekannt → `400`.
- Kennung eines Eintrags: `<kürzel>@<beginn in ISO-Form mit Versatz>`, z. B. `entw@2026-10-25T05:57+01:00`; Einträge ohne Versatz (Altbestand) bekommen den Versatz ihrer Ortszeit-Deutung.
- Jeder Zeiteintrag in API-Antworten trägt das Feld `kennung`.
- Ein neuer Eintrag mit derselben Kennung wie ein vorhandener → `409`.
- `PATCH` und `DELETE /api/aufgaben/{nr}/zeiten/{kennung}` (URL-kodiert) ersetzen die Index-Route; unbekannte Kennung → `404`; ändert ein PATCH den Beginn, liefert die Antwort den Eintrag mit neuer Kennung.
- Die Oberfläche spricht Einträge über die Kennung an.
- Antwort von `POST`: die Aufgabe (wie bisher) — der neue Eintrag ist über `kennung` darin auffindbar.

## Akzeptanzkriterien

- [ ] `POST {beginn: "2026-10-25 05:57+01:00", ende: "2026-10-25 07:40+01:00", wer: "entw"}` → ein Eintrag 1:43 für entw, ein Commit
- [ ] `POST {dauer: "0:45"}` wirkt wie bisher
- [ ] `POST {dauer, beginn}` → `400`; Ende vor Beginn → `400`; `wer: "xyz"` → `400`
- [ ] Zweimal derselbe `{beginn, wer}` → zweites Mal `409`
- [ ] `PATCH /zeiten/entw@2026-10-25T05:57+01:00 {ende: …}` korrigiert genau diesen Eintrag, auch wenn vorher ein anderer Eintrag davor eingefügt wurde
- [ ] `DELETE` mit unbekannter Kennung → `404`
- [ ] Oberfläche: Korrigieren und Löschen in der Zeitliste funktionieren (E2E)

## Betroffene Verzeichnisstruktur

`src/modell/aufgabe.rs` (`Zeiteintrag::kennung`), `src/dienst/zeiten.rs`, `src/web/mod.rs` (Routen), `src/web/endpunkte.rs`, `web/ansicht.js`, `web/app.js`; Tests `tests/`, `e2e/tests/`.

## Technische Überlegungen

- `Zeiteintrag::kennung(&self) -> String` aus `wer` und `uhr::Zeitpunkt::lesen(beginn)`; Serialisierung der API ergänzt `kennung`.
- `eintrag(a, kennung)` sucht über die Kennung statt über den Index.
- `Zeitnachtrag` (DTO) — `dauer: Option`, `beginn: Option`, `ende: Option`, `wer: Option`.

## Tests
**Unit:** Kennung aus Eintrag (mit/ohne Versatz). **Integration:** alle API-Kriterien. **E2E:** Zeitliste korrigieren und löschen.

## Abhängigkeiten
- Abhängig von: R00015, R00084
- Blockiert: R00093

## Offene Fragen
- keine — Form und Kennung entschieden am 2026-10-25 (Feedback-Runde Punkte 8, 9)

## Notizen
### Verworfene Alternativen
- Zufällige Kennung in der Datei: stabil über Korrekturen, aber neues Dateiformat und Lücke bei handgeschriebenen Zeilen.
- Index mit Vorbedingung: löst die Verwechslung nur halb.

## Warum löst diese Anforderung das Problem? (Pflicht)

Ende = jetzt → Nachtrag braucht zwei Aufrufe; Index → gleichzeitiger Schreiber verschiebt Positionen → falscher Eintrag. Beginn/Ende im POST und Kennung aus Inhalt → ein Aufruf je Block, und jeder Eintrag bleibt adressierbar, egal was davor eingefügt wird.
