---
id: R00018
status: Erledigt
datum: 2026-10-18
---

# R00018: Herkunft und Abhängigkeiten

## Beschreibung

Eine Aufgabe nennt in `origins` ihre Herkunft: WBS-Knoten (`I0001`), Anforderungen (`R00014`) oder `thin air`. Die Karte zeigt sie; ein Klick öffnet die Quelldatei an der richtigen Zeile im Editor (VS Code). Liegt die WBS im Repository, werden ihre `Braucht`-Beziehungen zu Abhängigkeiten zwischen Aufgaben: braucht der Knoten einer Aufgabe einen Knoten, dessen Aufgabe noch nicht in der Abschlussspalte liegt, zeigt die Karte „wartet auf #n“.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die WBS als Nachbar statt als Importquelle“.

## Geschäftlicher Nutzen

Das Board zeigt auf Planung und Anforderungen statt sie zu kopieren, und Reihenfolgen aus der WBS werden sichtbar.

## Funktionale Anforderungen

- Erlaubte Herkunft: WBS-Knoten `[ADIFB]` + 4 Ziffern, Anforderung `R` + 5 Ziffern, `thin air`; andere Werte → 400. `thin air` schließt andere aus.
- `PATCH /api/aufgaben/<nr>` nimmt `herkunft` (Liste) an; Nachricht `#<nr> geändert: Herkunft`.
- Pfade in `kanbanD.md` (`sources.wbs` = WBS-Datei, `sources.requirements` = Anforderungsordner) gelten relativ zum kanbanD-Ordner.
- `GET /api/herkunft` liefert je in Aufgaben verwendeter Herkunft `{datei (absolut), zeile, name, status, braucht}`; nicht auflösbare Herkunft fehlt dort.
- WBS: Zeile der Knotentabelle `| <ID> | … |`; Name, Status und Braucht aus den Spalten `Name`, `Status`, `Braucht`. Anforderung: Datei `<ID>-*.md` im Anforderungsordner, Zeile 1, Name aus der ersten Überschrift.
- „wartet auf #n“: eine Aufgabe mit WBS-Herkunft X; X braucht Y; eine nicht archivierte Aufgabe #n mit Herkunft Y liegt auf dem aktuellen Board nicht in der Abschlussspalte.
- Fenster: Herkunft als Chips mit Link und ×, Eingabe „I0001 / R00014 · Enter“, Fehlermeldung bei ungültiger Eingabe; Zeile „wartet auf“ mit Links auf die Aufgaben.

## Akzeptanzkriterien

- [x] `PATCH {herkunft: ["I0007", "R00014"]}` schreibt `origins: [I0007, R00014]`; `["X1"]` → 400; `["thin air", "I0001"]` → 400
- [x] WBS mit `| I0007 | Interaction | D0001 | Bewegen | rot | … | I0005 | …` in Zeile 12 → `/api/herkunft` liefert für I0007 `zeile: 12`, `name: Bewegen`, `braucht: ["I0005"]`
- [x] `R00014` mit Datei `R00014-timer.md` → Pfad dieser Datei, `name` aus `# R00014: Timer`
- [x] Aufgabe #2 (I0007) und #1 (I0005, in „In Arbeit“) → Karte #2 zeigt „wartet auf #1“; #1 in „Erledigt“ → keine Anzeige
- [x] Link der Herkunft auf der Karte ist `vscode://file<absoluter Pfad>:<zeile>`

## Betroffene Verzeichnisstruktur

`src/modell/aufgabe.rs` (Herkunft prüfen), `src/herkunft.rs` (WBS lesen, pure), `src/dienst/herkunft.rs`, `src/web/mod.rs`, `web/`; Tests in den Modulen, `tests/herkunft.rs`, `e2e/tests/r00018-herkunft.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `herkunft_gueltig(&str) -> bool` (pure)
- `wbs_knoten(text) -> Vec<WbsKnoten{id, zeile, name, status, braucht}>` (pure)
- `Kanban::herkunft() -> BTreeMap<String, Quelle>` (Operation)
- Oberfläche rechnet „wartet auf“ aus `/api/herkunft` und dem Board

## Tests
- Unit: Prüfung, WBS-Zeilen
- Integration: `/api/herkunft` mit WBS und Anforderung im Ordner
- E2E: Chip anlegen, Link, wartet auf

## Abhängigkeiten
- Abhängig von: R00011

## Offene Fragen
