---
id: R00006
status: Neu
datum: 2026-10-18
---

# R00006: Aufgabe bewegen

## Beschreibung

Eine Karte lässt sich in eine andere Spalte oder an eine andere Stelle derselben Spalte ziehen. Das ändert ausschließlich die Board-Datei — die Aufgabendatei bleibt unberührt — und ergibt einen Commit unter dem Namen der handelnden Person.

Zahlt ein auf: [Vision](R00000-vision.md) — „Das Board besitzt seine Struktur“, „Git ist das Gedächtnis“.

## Geschäftlicher Nutzen

Jede Bewegung ist ein kleiner, mergebarer Diff mit Autor und Zeitpunkt — die Grundlage für Durchlaufzeiten.

## Funktionale Anforderungen

- `POST /api/boards/<slug>/bewegen` mit `{nummer, spalte, index?}`; `index` ist die Position in der Zielspalte nach dem Herausnehmen, ohne Angabe ans Ende; ein zu großer Index gilt als Ende.
- Die Aufgabe muss auf dem Board liegen (sonst 404), die Spalte muss existieren (sonst 400).
- Ändert sich nichts, entsteht kein Commit (Antwort 200, `bewegt: false`).
- Commit-Nachricht: `#<nr> nach „<Spalte>“ (<Board>)` bzw. `#<nr> in „<Spalte>“ umsortiert (<Board>)`.
- Oberfläche: Ziehen; obere Hälfte einer Karte = davor, untere = dahinter, freie Fläche = ans Ende; eine Einfügelinie zeigt das Ziel.

## Akzeptanzkriterien

### Bewegen
- [ ] Board `A: 1,2,3 · B: —`: `#2` nach B → `A: 1,3 · B: 2`; nur `boards/<slug>.md` im Commit
- [ ] `#3` in A an Index 0 → `A: 3,1,2`; Nachricht „umsortiert“
- [ ] Gleiche Position → kein Commit, `bewegt: false`
- [ ] Aufgabe nicht auf dem Board → 404; unbekannte Spalte → 400; ohne Identität → 400

### Oberfläche
- [ ] Karte #1 aus „Zu erledigen“ auf die freie Fläche von „In Arbeit“ ziehen: #1 steht in „In Arbeit“, die Aufgabendatei ist unverändert
- [ ] Karte #3 auf die obere Hälfte von #1 ziehen: #3 steht vor #1

## Betroffene Verzeichnisstruktur

`src/modell/board.rs` (pure), `src/dienst/bewegen.rs`, `src/web/mod.rs`, `web/app.js`; Tests im Modell, `tests/bewegen.rs`, `e2e/tests/r00006-aufgabe-bewegen.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `Board::bewegen(nummer, spalte, index) -> Result<bool, Bewegfehler>` (pure)
- `Kanban::bewegen(&Person, slug, &Bewegung) -> Result<bool, Fehler>` (Integration)

## Tests
- Unit: alle Fälle von `Board::bewegen`
- Integration: API mit Git-Prüfung
- E2E: Ziehen zwischen Spalten und innerhalb

## Abhängigkeiten
- Abhängig von: R00005
- Blockiert: R00023, R00026

## Offene Fragen
