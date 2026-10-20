---
id: R00068
status: Erledigt
datum: 2026-10-19
---

# R00068: Kurze Timerläufe verwerfen

## Beschreibung

Ein Timer, der weniger als 20 Sekunden lief, ist ein Fehlklick oder ein Ausprobieren und wird beim Stoppen nicht als Zeitblock festgehalten: Die laufende Zeile verschwindet aus dem Block `kanbanD-time`, statt ein Ende zu bekommen.

Die Aufgabendatei speichert Zeiten minutengenau; die Startsekunde hält der Server beim Start im Speicher. Kennt er sie nicht (Timer vor einem Neustart oder außerhalb von kanbanD gestartet), gilt die bisherige Regel: die Zeile wird abgeschlossen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Zeiten entstehen nebenbei und stimmen“.

## Geschäftlicher Nutzen

Stundenzettel und Berichte bleiben frei von Null-Minuten-Einträgen aus versehentlichen Starts.

## Funktionale Anforderungen

- Stopp nach weniger als 20 Sekunden (gemessen ab dem Start über diesen Server): die laufende Zeile wird entfernt; Commit `#n Timer von <Name> verworfen (unter 20 s)`.
- Stopp nach 20 Sekunden oder mehr: unverändert — Ende eintragen, Commit `#n Timer von <Name> gestoppt (h:mm)`.
- Startsekunde unbekannt: wie „20 Sekunden oder mehr“.
- Gilt für jeden Stopp über `POST /api/aufgaben/{nr}/timer/stop`, auch für den Timer einer anderen Person.

## Akzeptanzkriterien

- [x] Starten und sofort stoppen → keine Zeile im Block, Commit „verworfen (unter 20 s)“
- [x] Ein in der Datei laufender Timer ohne bekannte Startsekunde wird beim Stopp abgeschlossen
- [x] Grenze: 19 s verworfen, 20 s festgehalten (Unit-Test der Regel)

## Betroffene Verzeichnisstruktur

`src/dienst/mod.rs`, `src/dienst/timer.rs`; Test `tests/timer.rs`.

## Abhängigkeiten
- Abhängig von: R00014

## Offene Fragen
- keine
