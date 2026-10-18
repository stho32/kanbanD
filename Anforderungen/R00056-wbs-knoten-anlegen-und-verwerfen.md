---
id: R00056
status: Erledigt
datum: 2026-10-18
---

# R00056: WBS-Knoten anlegen und verwerfen

## Beschreibung

In der WBS-Sicht und über die API lassen sich Knoten anlegen und verwerfen. Ein neuer Knoten bekommt die nächste freie ID seines Präfixes (`A`, `D`, `I`, `F`, `B`), die nie wiederverwendet wird, und startet `rot`. Verwerfen setzt `verworfen` für den Knoten und seine zählenden Nachfahren und löscht keine Zeile. Wie in R00055 schreibt kanbanD die WBS-Datei im Arbeits-Repository, rechnet die Vorfahren neu und committet dort nicht.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgaben wirken auf Knoten: sie legen an, setzen zur Überarbeitung zurück oder verwerfen.“

## Geschäftlicher Nutzen

Umfang entsteht und verschwindet dort, wo die Arbeit beschlossen wird, und die Regeln von `/planung` (eine ID nie zweimal, nichts löschen außer über `loeschen`) gelten weiter, ohne dass die KI sie selbst prüfen muss.

## Funktionale Anforderungen

- `POST /api/wbs/<kürzel>/knoten {ebene, eltern, name, fertig_kriterium, eingabe_ausgabe?, aufwand?, ausbaustufe?, braucht?, requirement?, notiz?}` → `{id}`; Identität Pflicht.
- Pflicht: Ebene, Eltern, Name, Fertig-Kriterium („Ein Knoten, ein Fertig-Kriterium“). Die Eltern-Ebene muss passen (Feature darf übersprungen werden), sonst 400. `aufwand` nur bei Bubbles, nie unter der Untergrenze je Bubble des Skills.
- Nächste ID = höchste ID des Präfixes aus der Datei **und** aus allen Ständen der Datei in der Git-Historie des Arbeits-Repositories, plus 1.
- Die neue Zeile steht nach dem letzten Nachfahren ihres Eltern-Knotens.
- `POST /api/wbs/<kürzel>/knoten/<id>/verwerfen {grund?}` setzt `verworfen` am Knoten und an allen zählenden Nachfahren; der Grund kommt in die Notiz. Bereits `verworfen` → 409. `A0001` ist nicht verwerfbar.
- Vorfahren werden neu gerechnet, `zuletzt` wird gesetzt, kein Commit im Arbeits-Repository.
- Sicht: „+ Knoten“ in der Zeile des Eltern-Knotens, „verwerfen“ im Kontextmenü der Zeile mit Rückfrage und Grund.

## Akzeptanzkriterien

### Anlegen
- [x] Datei mit `B0001…B0116`, Historie mit einer gelöschten Zeile `B0117` → neue Bubble bekommt `B0118`
- [x] `POST {ebene: Interaction, eltern: D0002, name: X, fertig_kriterium: US-1}` → Zeile `I0048 | Interaction | D0002 | X | rot | US-1 |…` nach dem letzten Nachfahren von D0002; `D0002` gerechnet nicht mehr `gruen`
- [x] Fehlendes Fertig-Kriterium → 400; `ebene: Bubble, eltern: D0002` → 400

### Verwerfen
- [x] `verwerfen I0007` mit zwei Bubbles → drei Zeilen `verworfen`, keine Zeile entfernt; der Slice-Stand in R00054 zählt sie nicht mehr
- [x] `git log` im Arbeits-Repository unverändert nach beiden Operationen

## Betroffene Verzeichnisstruktur

`src/wbs.rs` (Anlegen, Verwerfen, nächste ID, pure), `src/git.rs` (`staende` für fremde Repositories), `src/dienst/wbs.rs`, `src/web/mod.rs`, `src/web/endpunkte.rs`, `web/wbs.js`; Tests `tests/wbs_schreiben.rs`, `e2e/tests/r00056-wbs-knoten.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `fn naechste_id(praefix: char, staende: &[String]) -> String` (pure)
- `fn knoten_anlegen(text, neu: &NeuerKnoten, id, heute) -> Result<String, WbsFehler>` (pure)
- `fn verwerfen(text, id, grund, heute) -> Result<String, WbsFehler>` (pure)

## Tests
- Unit: nächste ID mit Lücken und gelöschten Zeilen, Einfügestelle, Eltern-Regel, Verwerfen mit Nachfahren
- Integration: Temp-Arbeits-Repository mit Historie, kein neuer Commit
- E2E: Knoten anlegen und verwerfen in der Sicht

## Abhängigkeiten
- Abhängig von: R00054
- Blockiert: R00057

## Offene Fragen
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Aufgaben sollen Umfang erzeugen und entfernen können; dafür muss kanbanD Knoten nach denselben Regeln anlegen und verwerfen wie `/planung`. Die größte Gefahr ist eine wiederverwendete ID, denn Commits, Anforderungen und Ist-Zeiten verweisen auf sie; nur der Blick in die Git-Historie schließt das sicher aus. Weil Verwerfen markiert statt löscht, bleibt die Entscheidung nachvollziehbar, und Status- und Stand-Rechnung stimmen sofort. So wird die Wirkung einer Aufgabe auf die WBS (R00057) eine sichere Operation statt einer Handarbeit der KI.

## Notizen

- Out of scope: Felder bestehender Knoten ändern (Name, Fertig-Kriterium, Aufwand, Braucht, Notiz) und Knoten löschen — bleiben bei `/planung aendern` und `/planung loeschen`.
