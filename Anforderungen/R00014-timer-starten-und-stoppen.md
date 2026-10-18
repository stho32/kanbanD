---
id: R00014
status: Erledigt
datum: 2026-10-18
---

# R00014: Timer starten und stoppen

## Beschreibung

Jede Person startet an einer Aufgabe ihren Timer; er steht sofort als Zeile mit `...` als Ende im Block `kanbanD-time` der Aufgabe (ein Commit) und übersteht damit einen Absturz. Beim Stopp wird genau diese Zeile um das Ende ergänzt (ein Commit). Mehrere Timer dürfen gleichzeitig laufen — mehrere Personen an einer Aufgabe, eine Person an mehreren Aufgaben —, und fremde Timer lassen sich stoppen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Zeiterfassung, die zum Arbeiten passt“.

## Geschäftlicher Nutzen

Zeiten entstehen beim Arbeiten statt im Nachhinein, und jeder sieht, woran gerade gearbeitet wird.

## Funktionale Anforderungen

- `POST /api/aufgaben/<nr>/timer/start` startet den Timer der handelnden Person; läuft er an dieser Aufgabe schon → 409.
- `POST /api/aufgaben/<nr>/timer/stop {wer?}` stoppt den laufenden Timer von `wer` (ohne Angabe: die handelnde Person); keiner läuft → 409. Autor des Commits ist, wer stoppt.
- Nachrichten: `#<nr> Timer von <Name> gestartet` bzw. `#<nr> Timer von <Name> gestoppt (<h:mm>)`.
- Die Karte zeigt laufende Timer als Plakette mit mitlaufender Dauer (eigener Timer gefüllt).
- Das Fenster zeigt „Läuft gerade“ mit allen laufenden Timern der Aufgabe (Stopp je Zeile) und „▶ Meinen Timer starten“; ohne Identität öffnet der Start „Ich bin …“.
- Die Kopfzeile zeigt „N läuft/laufen“, wenn Timer laufen; das Popover listet sie mit Aufgabe, Person, Dauer und Stopp; Klick auf eine Zeile öffnet die Aufgabe.

## Akzeptanzkriterien

- [x] Start durch `st` → Zeile `<jetzt> · ... · st`; zweiter Start durch `st` → 409; Start durch `cl` → zweite laufende Zeile
- [x] Stopp durch `st` mit `{wer: "cl"}` → Claudes Zeile hat ein Ende, Commit-Autor ist Stefan; Stefans Timer läuft weiter
- [x] Stopp ohne laufenden Timer → 409
- [x] Oberfläche: Timer starten → Karte zeigt die Plakette, Kopfzeile „1 läuft“; im Popover stoppen → Plakette weg

## Betroffene Verzeichnisstruktur

`src/dienst/timer.rs`, `src/web/mod.rs`, `web/`; Tests `tests/timer.rs`, `e2e/tests/r00014-timer.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `Kanban::timer_starten(&Person, nr)`, `Kanban::timer_stoppen(&Person, nr, wer)` (Integration)
- `dauer(beginn, ende) -> Minuten` (pure, `uhr`)

## Tests
- Unit: Dauer
- Integration: Start, doppelter Start, fremder Stopp, Stopp ohne Lauf
- E2E: Start im Fenster, Stopp über die Kopfzeile

## Abhängigkeiten
- Abhängig von: R00011
- Blockiert: R00015, R00021, R00022

## Offene Fragen
