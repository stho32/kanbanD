---
id: R00011
status: Neu
datum: 2026-10-18
---

# R00011: Aufgabe ansehen und bearbeiten

## Beschreibung

Ein Klick auf eine Karte öffnet das Aufgabenfenster (Artboard D0003): Titel, Beschreibung, Klasse, Zuständige, Labels, Fälligkeit und Spalte lassen sich dort bearbeiten; jede Änderung wird sofort in die Aufgabendatei geschrieben und committet. Der Reiter „Datei“ zeigt die Datei so, wie sie im Ordner liegt. Mit ↑/↓ blättert man zur vorigen/nächsten Karte, Esc schließt.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgaben sind unabhängige Daten“, „Ein Commit je Aktion“.

## Geschäftlicher Nutzen

Alles Wesentliche einer Aufgabe an einem Ort, ohne dass jemand das Dateiformat kennen muss.

## Funktionale Anforderungen

- `GET /api/aufgaben/<nr>` liefert die Aufgabe, ihren Pfad und den Dateitext; eine defekte Datei liefert Pfad, Text und Fehler (Status 423).
- `PATCH /api/aufgaben/<nr>` ändert nur die genannten Felder: `titel`, `beschreibung`, `klasse` (`null` entfernt), `zustaendige`, `labels`, `faellig` (`null` entfernt). Der Dateiname bleibt.
- Regeln: Titel nicht leer; Klasse muss in `kanbanD.md` stehen; Zuständige müssen dort stehen; Fälligkeit `JJJJ-MM-TT`; Labels ohne Leereinträge. Verstoß → 400, unbekannte Nummer → 404, defekte Datei → 423.
- Ohne Änderung kein Commit; Nachricht `#<nr> geändert: <Felder>`.
- Das Fenster zeigt Kopf (Nummer, Klasse, Pfad, Inhalt/Datei, Position „n / m“, ↑ ↓, „In VS Code öffnen“, ✕), Hauptteil (Titel, Beschreibung) und Seitenleiste (Spalte, Klasse, Zuständige, Labels, Fälligkeit); die Spalte zu ändern bewegt die Karte (R00006).
- Titel, Beschreibung und Labels werden beim Verlassen des Feldes gespeichert, Auswahlfelder sofort.

## Akzeptanzkriterien

- [ ] `PATCH {titel: "Neu", klasse: "bug", labels: ["ui", "daten"], faellig: "2026-12-24"}` schreibt diese Felder; `git log -1` lautet `#1 geändert: Titel, Klasse, Labels, Fälligkeit`
- [ ] `PATCH {klasse: null}` entfernt `class:`; `PATCH {klasse: "gibtsnicht"}` → 400; `PATCH {faellig: "24.12."}` → 400; `PATCH {titel: ""}` → 400
- [ ] Gleiche Werte → kein Commit
- [ ] Defekte Datei: `GET` → 423 mit Text; `PATCH` → 423
- [ ] Oberfläche: Karte öffnen, Titel ändern, Tab verlassen → Karte zeigt neuen Titel, Datei geändert
- [ ] Oberfläche: Reiter „Datei“ zeigt den Dateitext; ↓ wechselt zur nächsten Karte; Esc schließt

## Betroffene Verzeichnisstruktur

`src/modell/aufgabe.rs` (Änderung anwenden), `src/dienst/aufgabe_aendern.rs`, `src/web/mod.rs`, `web/`; Tests im Modell, `tests/aufgabe_aendern.rs`, `e2e/tests/r00011-aufgabe-bearbeiten.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `Aufgabenaenderung` (DTO; `Option<Option<String>>` für entfernbare Felder)
- `Aufgabe::aendern(&Aufgabenaenderung, &Einstellungen) -> Result<Vec<&'static str>, String>` (pure; liefert geänderte Felder)
- `Kanban::aufgabe_aendern(&Person, nr, &Aufgabenaenderung)` (Integration)
- `Ordner::aufgabe(nr) -> Result<Aufgabe, Fehler>` (Operation)

## Tests
- Unit: alle Regeln von `Aufgabe::aendern`
- Integration: GET/PATCH mit Git-Prüfung, defekt
- E2E: Titel, Datei-Reiter, Blättern, Esc

## Abhängigkeiten
- Abhängig von: R00005
- Blockiert: R00012–R00018

## Offene Fragen
