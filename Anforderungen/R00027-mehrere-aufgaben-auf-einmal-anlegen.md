---
id: R00027
status: Neu
datum: 2026-10-18
---

# R00027: Mehrere Aufgaben auf einmal anlegen

## Beschreibung

Wer eine Liste hat — aus einer Notiz, einer Mail, einem Protokoll —, fügt sie in „+ Karte“, „+ Aufgabe ohne Board“ oder „+ Teilaufgabe“ ein und bekommt je Zeile eine Aufgabe bzw. Teilaufgabe, in einem Commit. Listenzeichen (`-`, `*`, `1.`, `- [ ]`) werden entfernt, leere Zeilen übergangen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design … folgt gewohnten Konventionen“; „Ein Commit je Aktion“.

## Geschäftlicher Nutzen

Zehn Aufgaben aus einem Besprechungsprotokoll sind ein Einfügen statt zehnmal Tippen und Enter.

## Funktionale Anforderungen

- `zeilenAusText(text)`: je nicht leerer Zeile ein Titel; vorne `- `, `* `, `+ `, `1. `, `1) `, `- [ ] `, `- [x] ` entfernt; Leerraum getrimmt.
- `POST /api/aufgaben/mehrere {titel: [...], board?, spalte?}` legt alle in Folge an (fortlaufende Nummern, Reihenfolge der Liste) — **ein** Commit `#5–#8 angelegt (4 Aufgaben)` plus ` in „<Spalte>“ (<Board>)`; leere Liste oder leerer Titel → 400, nichts entsteht.
- `POST /api/aufgaben/<nr>/teilaufgaben/mehrere {texte: [...]}` hängt alle an — ein Commit `#<nr> 3 Teilaufgaben ergänzt`.
- Einfügen von Text mit Zeilenumbruch in die genannten Felder legt ohne Rückfrage an; der Hinweis nennt die Zahl. Einzeilige Eingaben verhalten sich wie bisher.

## Akzeptanzkriterien

- [ ] `zeilenAusText("- a\n\n* b\n1. c\n- [ ] d\n  e  ")` → `["a","b","c","d","e"]`
- [ ] API mit drei Titeln auf leerem Board → Nummern 1, 2, 3 in dieser Reihenfolge unten in der Spalte, genau ein Commit mit vier Dateien
- [ ] Teilaufgaben mehrere → ein Commit
- [ ] Oberfläche: drei Zeilen in „+ Karte“ einfügen → drei Karten, Hinweis „3 Aufgaben angelegt“
- [ ] Oberfläche: Zeilen in „+ Teilaufgabe“ einfügen → alle als Teilaufgaben

## Betroffene Verzeichnisstruktur

`web/eingabe.js` (pure), `src/dienst/aufgabe_anlegen.rs`, `src/dienst/teilaufgaben.rs`, `src/web/mod.rs`, `web/app.js`; Tests `e2e/einheit/eingabe.test.js`, `tests/mehrere.rs`, `e2e/tests/r00027-mehrere.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `zeilenAusText(text) -> [string]` (pure, JS)
- `Kanban::aufgaben_anlegen(&Person, &NeueAufgaben) -> Vec<Aufgabe>`, `Kanban::teilaufgaben_anlegen(&Person, nr, &[String])` (Integration)

## Tests
- Unit: Listenzeichen, Leerzeilen
- Integration: ein Commit, Reihenfolge, Fehler ohne Wirkung
- E2E: Einfügen in Bahn und Teilaufgaben

## Abhängigkeiten
- Abhängig von: R00005, R00012

## Offene Fragen
