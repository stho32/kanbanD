---
id: R00058
status: Neu
datum: 2026-10-18
---

# R00058: Phasen als Spalten

## Beschreibung

Die Phasen einer Anwendung (Phasen-Datei neben ihrer WBS, sonst das Standardmodell `Entwicklung → Entwicklertest → Abnahme`) werden Spalten des Entwicklungs-Boards. Eine Spalte ist entweder an keine Phase gebunden (Backlog, Nächste Aufgaben, freie Spalten) oder an genau eine. Mehrere Spalten dürfen dieselbe Phase darstellen, etwa je eine Abnahme-Queue pro Entwickler. Liegt eine Karte in einer Phasen-Spalte, ist sie *in* dieser Phase; zieht sie in die Spalte einer späteren Phase oder in die Abschlussspalte, ist die Phase *durchlaufen*. Fehlt dem Board eine Phase, legt kanbanD die Spalte an. Zunächst gilt nur die Hauptspur; Nebenspuren folgen, wenn sie gebraucht werden.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Phasen nach dem Bau sind Spalten, durch die Aufgaben wandern; ein Zug ist ein Durchlauf.“

## Geschäftlicher Nutzen

Ein Durchlauf ist ein Zug mit Name und Zeitpunkt im Commit. Die Tabelle `## Durchläufe`, `/testen eintragen` und Anmerkungen wie „Entwicklertest steht aus“ werden überflüssig, und Wie lange noch rechnet je Phase aus dem Board.

## Funktionale Anforderungen

- Board-Frontmatter `column-phases`: Spaltenname → Phasenname, N:1; Spalten ohne Eintrag sind an keine Phase gebunden. Dasselbe Muster wie `limits`.
- Phasen kommen aus der Phasen-Datei jeder gebundenen Anwendung (Tabelle `## Phasen`, Hauptspur, ohne `verworfen`); Spalten werden über die Kopfzeile zugeordnet.
- Bindet ein Board eine Anwendung (R00053) und hat eine Phase der Hauptspur keine Spalte, legt kanbanD je fehlender Phase eine Spalte gleichen Namens an, an der Stelle nach der Spalte der Vorphase, und trägt sie in `column-phases` ein; ein Commit „Phasen-Spalten von „<Board>“ ergänzt: …“. Danach wird nichts automatisch umgeordnet.
- Eine Phase mit `gleich wie` bekommt keine eigene Spalte; sie gilt mit der genannten als durchlaufen.
- Phasenfolge eines Boards = Reihenfolge der Phasen in der Phasen-Datei; widerspricht die Spaltenreihenfolge ihr (Spalte einer späteren Phase links einer früheren), zeigt das Board einen Hinweis.
- „Erreicht“ wird **nach Phasen** gerechnet, nicht nach Spaltenindex: eine Karte hat Phase P durchlaufen, sobald sie in einer Spalte einer späteren Phase oder in der Abschlussspalte liegt oder lag (erstes Erreichen); zwei Spalten derselben Phase sind gleich weit.
- `entfällt`: Frontmatter der Aufgabe `phases: {skipped: [Abnahme]}` nimmt die Aufgabe aus Zähler, Nenner und Durchsatz dieser Phase; Überspringen ohne Markierung zählt als durchlaufen am Tag des Zugs.
- `eingebettet in: im-pair`: eine Aufgabe mit Label `im-pair` gilt in dieser Phase als durchlaufen, sobald sie die Vorphase durchlaufen hat.
- Befund: Zug nach links; die Phase gilt ab dann wieder als offen. Der Durchsatz behält den ersten Durchlauf (wie R00045, R00046), offen zählt nach dem aktuellen Stand.
- Wie lange noch (R00046) rechnet mit gebundenen Phasen je **Phase** statt je Spalte und beschriftet sie „Entwicklung durchlaufen“, „Entwicklertest durchlaufen“ …; ungebundene Boards rechnen unverändert je Spalte.

## Akzeptanzkriterien

### Spalten
- [ ] Board mit `## Backlog`, `## Nächste Aufgaben`, `## Entwicklung`, `## Erledigt`, Phasen-Datei mit `Entwicklung, Entwicklertest, Abnahme` → nach Bindung zusätzlich `## Entwicklertest` und `## Abnahme` vor `## Erledigt`, `column-phases` mit drei Einträgen, ein Commit
- [ ] Abnahme `gleich wie: Entwicklertest` → keine Spalte `Abnahme`
- [ ] `column-phases: {Abnahme Stefan: Abnahme, Abnahme Mia: Abnahme}` → kanbanD legt keine weitere Spalte `Abnahme` an

### Rechnung
- [ ] #1 Entwicklung (01.10.) → Abnahme Stefan (03.10.); #2 Entwicklung (01.10.) → Abnahme Mia (04.10.) → Entwicklertest (05.10.) → Durchlauf Entwicklertest am 03.10. bzw. 04.10.; #2 ist ab 05.10. in Abnahme wieder offen; „Abnahme Mia“ rechts von „Abnahme Stefan“ zählt nicht als weiter
- [ ] #3 mit `phases.skipped: [Entwicklertest]` springt von Entwicklung nach Abnahme → Entwicklertest-Nenner ohne #3, Durchsatz Entwicklertest ohne #3
- [ ] Wie lange noch auf dem gebundenen Board zeigt Blöcke „Entwicklung durchlaufen“, „Entwicklertest durchlaufen“, „Abnahme durchlaufen“ mit denselben Perzentilen wie dieselben Daten in der Rechnung von R00046 je Phase

## Betroffene Verzeichnisstruktur

`src/modell/board.rs`, `src/format/board.rs` (`column-phases`), `src/phasen.rs` (neu, pure: Phasen-Datei lesen, fehlende Spalten), `src/dienst/phasen.rs` (neu), `src/modell/aufgabe.rs` (`phases`), `web/berichte.js` (`prognose` nach Phasen), `web/ansicht.js`; Tests in den Modulen, `tests/phasen.rs`, `e2e/einheit/berichte.test.js`, `e2e/tests/r00058-phasen-spalten.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `Phasenfolge` (benannte Collection) — `fn lesen(text) -> Phasenfolge`, `fn fehlende_spalten(&self, board: &Board) -> Vec<SpaltenAenderung>`
- `prognose(bew, f, aufgabeZu, jetzt, phasen?)` in `web/berichte.js` — mit `phasen` wird `erreicht` über `column-phases` gerechnet

## Tests
- Unit: Phasen-Datei lesen (Kopfzeile, `verworfen`, `gleich wie`), fehlende Spalten, Erreichen nach Phase mit N:1, `skipped`, `im-pair`
- Integration: Bindung legt Spalten an, ein Commit
- E2E: Karte durch die Phasen ziehen, Bericht mit Phasenblöcken

## Abhängigkeiten
- Abhängig von: R00053, R00046
- Blockiert: R00059, R00060

## Offene Fragen
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Phasen nach dem Bau sind Fluss: jemand nimmt ein Stück Arbeit, prüft es und gibt es weiter — heute wird dieser Fluss in einer Tabelle nachgebucht, die in kanbanD sogar leer ist, während das Board „Abnahme“ in `kanbanD-test` fünf Abnahmen zeigt. Wenn die Phasen Spalten sind, ist der Zug selbst der Durchlauf mit Name und Zeitpunkt, und eine zweite Buchung entfällt. Weil „erreicht“ nach Phasen statt nach Spaltenindex gerechnet wird, tragen mehrere Queues derselben Phase richtig zur Kurve bei. Damit liefert Wie lange noch je Phase die Kurve, die `/anwendung wie-lange-noch` heute aus der Phasen-Datei rechnet.

## Notizen

- Out of scope: Nebenspuren (`Spur`, `Braucht` zwischen Phasen) — werden aufgenommen, wenn sie zum ersten Mal gebraucht werden; Vorschlag dann: Marken an der Karte.
- Verworfen: Phasen als eigenes Board und Phasen nur als Badges in der WBS-Sicht.
