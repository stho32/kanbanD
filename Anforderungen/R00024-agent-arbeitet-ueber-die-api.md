---
id: R00024
status: Erledigt
datum: 2026-10-18
---

# R00024: Agent arbeitet über die API

## Beschreibung

Ein Agent kann alles, was die Oberfläche kann, über die HTTP-API. Die Seite `/api` (Artboard D0007) beschreibt jeden Endpunkt mit Methode, Pfad, ob er eine Identität braucht, und Zweck, dazu ein Beispiel; `/api/endpunkte` liefert dieselbe Liste als JSON, damit ein Agent sie ohne Menschen lesen kann.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mensch und Agent arbeiten gleichberechtigt“.

## Geschäftlicher Nutzen

Agenten führen das Board mit den Werkzeugen, die sie ohnehin benutzen, und jede ihrer Aktionen trägt ihren Namen.

## Funktionale Anforderungen

- Eine Endpunkttabelle im Programm ist die eine Quelle für `/api` und `/api/endpunkte` (`[{methode, pfad, wer, zweck, thema}]`).
- Jeder Endpunkt der Tabelle existiert (kein 404/405 für Methode und Pfad mit Beispielwerten).
- `/api` zeigt den Satz zur Identität (`X-KanbanD-Wer`), ein `curl`-Beispiel mit der Adresse der laufenden Instanz und die Tabelle, gruppiert nach Thema.
- Die Statuszeile der Oberfläche verlinkt „API für Agenten“.

## Akzeptanzkriterien

- [x] `/api/endpunkte` enthält mindestens die Endpunkte zum Anlegen, Bewegen, Kommentieren, Timer starten/stoppen, Ereignisstrom
- [x] Jeder Eintrag antwortet auf seine Methode nicht mit 404/405 (Pfadparameter mit Beispielwerten)
- [x] `/api` ist HTML mit Titel „kanbanD · API“ und enthält jeden Pfad der Tabelle
- [x] Agentenlauf: `cl` legt #1 auf dem Board an, startet den Timer, bewegt #1 nach „Erledigt“, kommentiert, stoppt den Timer — fünf Commits, alle mit Autor „Claude“

## Betroffene Verzeichnisstruktur

`src/web/endpunkte.rs`, `src/web/mod.rs`, `web/`; Tests `tests/api.rs`, `e2e/tests/r00024-api.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `ENDPUNKTE: &[Endpunkt]` (Konstante), `api_seite(adresse) -> String` (pure)

## Tests
- Integration: Vollständigkeit der Tabelle gegen den Router, Agentenlauf mit Git-Prüfung
- E2E: `/api` im Browser, Link aus der Statuszeile

## Abhängigkeiten
- Abhängig von: R00005 und allen Endpunkten

## Offene Fragen
