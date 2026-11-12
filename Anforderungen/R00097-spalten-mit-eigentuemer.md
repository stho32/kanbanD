---
id: R00097
status: Neu
datum: 2026-10-31
---

# R00097: Spalten mit Eigentümer

## Beschreibung

Eine Spalte kann einen Eigentümer haben: `human` oder `agent`. Er wird im Frontmatter des Boards unter `column-owner` geführt, ist im Spalten-Dialog einstellbar und im Spaltenkopf sichtbar. Aus einer Spalte mit dem Eigentümer `human` darf ein Agent keine Karte herausholen: `ziehen`, `bewegen`, vom Board nehmen und archivieren werden mit `403` abgewiesen. Hineinlegen, Kommentieren, Zeit buchen, Felder ändern und Signale setzen bleiben erlaubt. Für Menschen ändert sich nichts.

Zahlt ein auf: [Vision](R00000-vision.md) — Menschen im Browser, KI-Agenten über die API auf einem gemeinsamen Board.

## Geschäftlicher Nutzen

In der Wartungsfabrik ist die Freigabe die Stelle, an der ein Mensch entscheidet, was ein Behandler anfassen darf (Eingang → Freigegeben) und was ausgeliefert wird (Verstehen & Freigabe). Heute ist das nur eine Abmachung: Jeder Agent kann eine Karte über die API aus dem Eingang direkt nach „Freigegeben“ bewegen. Mit Eigentümer-Spalten setzt kanbanD die Freigabe durch.

## Funktionale Anforderungen

### Datenmodell
- Frontmatter des Boards: `column-owner: {<Spalte>: human | agent}`. Fehlt eine Spalte darin, hat sie keinen Eigentümer und es gilt das heutige Verhalten. Andere Werte machen die Board-Datei nicht defekt, sie werden aber ignoriert und als Hinweis gemeldet (wie unbekannte Prüfungen).
- Benennt `PUT /api/boards/{slug}/spalten` eine Spalte um, nimmt sie ihren Eigentümer mit. Entfernt es eine Spalte, entfällt ihr Eintrag. Das Feld heißt dort `eigentuemer: human | agent | null`, ein fehlendes Feld behält den alten Wert.
- `GET /api/boards/{slug}` liefert je Spalte `eigentuemer`.

### Durchsetzung (handelnde Person mit `kind: agent`, Karte liegt in einer Spalte mit `human`)
- `POST …/ziehen` mit `von` = Menschen-Spalte → `403`.
- `POST …/bewegen` und `…/bewegen-mehrere`, sobald eine der Karten in einer Menschen-Spalte liegt → `403`. Das gilt auch für das Umsortieren innerhalb der Spalte, denn die Reihenfolge im Eingang ist die Priorität des Menschen.
- `DELETE …/aufgaben/{nr}` (vom Board nehmen) → `403`.
- `POST /api/aufgaben/{nr}/archivieren` und `POST /api/aufgaben/archivieren` → `403`, wenn die Karte auf irgendeinem Board in einer Menschen-Spalte liegt.
- Antwortform `403` `{fehler: "Spalte „<Name>“ gehört dem Menschen", spalte, nummer}`, ohne Commit.

### Erlaubt bleibt (auch in Menschen-Spalten)
- Eine Karte hineinlegen: anlegen mit `spalte`, auf das Board legen, aus einer anderen Spalte hineinbewegen (für Agenten mit Grenze nach R00096).
- Kommentieren, Zeit buchen, Teilaufgaben, Felder über `PATCH`, Signale setzen und zurücknehmen, Anhänge, Durchläufe, Reservieren.

### Oberfläche
- Spalten-Dialog: je Spalte eine Auswahl „Eigentümer“ mit `—`, `Mensch`, `Agent`.
- Spaltenkopf: ein kleines Zeichen für Mensch bzw. Agent, Tooltip „Spalte gehört dem Menschen — Agenten können Karten hineinlegen, aber nicht herausnehmen“ bzw. „Spalte gehört den Agenten“. Im zugeklappten Streifen (R00074) steht das Zeichen über dem Namen.
- Menschen bewegen weiter frei, die Oberfläche sperrt nichts.

### Beschreibung
- `/api`, `/api/endpunkte`, `/api/openapi.json` beschreiben `column-owner`, das Feld `eigentuemer` und die `403`.

## Nicht-funktionale Anforderungen

- Sicherheit: Die Durchsetzung beruht auf dem Header `X-KanbanD-Wer` (Full-Trust, Vision). Ein Agent, der `X-KanbanD-Wer` eines Menschen nennt, kommt durch. Das ist hier gewollt, denn die Regel schützt vor Versehen und nicht vor Angriffen. Die API-Beschreibung sagt das.
- Sicherheit: **Die `art` einer Person setzen nur Menschen** (Karte #127). Der eine Schreibweg `einstellungen_aendern` — `POST /api/personen`, `PATCH /api/personen/{kuerzel}` und `PUT /api/einstellungen` — weist jede Änderung der `art` durch einen Agenten mit `403 {fehler, kuerzel}` ab, ohne Commit, die Einstellungsdatei bleibt byte-gleich; ein Agent legt nur Personen der Art `agent` an. Sonst höbe ein Agent diese Sperre mit einem Aufruf dauerhaft auf. Die API-Beschreibung nennt die Regel samt `PersonenartVerboten`.

## Akzeptanzkriterien

### Format
- [ ] `PUT …/spalten` mit `[{name: "Eingang", alt: "Eingang", eigentuemer: "human"}, …]` schreibt `column-owner:\n  Eingang: human` ins Frontmatter, und ein zweites `PUT` ohne `eigentuemer` behält ihn
- [ ] Umbenennen „Eingang“ → „Posteingang“ mit `alt` schreibt `Posteingang: human`
- [ ] `column-owner: {Eingang: chef}` → Board lesbar, `hinweise` enthält den unbekannten Wert, Eingang ohne Eigentümer

### Agent
- [ ] Eingang (`human`) = [1, 2], Freigegeben ohne Eigentümer: `bot` bewegt #1 nach Freigegeben → `403`, kein Commit, #1 liegt weiter in Eingang
- [ ] `bot` zieht aus Eingang → `403`
- [ ] `bot` sortiert #2 im Eingang nach oben → `403`
- [ ] `bot` archiviert #1 → `403`; `bot` nimmt #1 vom Board → `403`
- [ ] `bot` legt eine neue Aufgabe in Eingang an → `201`; `bot` kommentiert #1 → erfolgreich; `bot` bucht 0:30 auf #1 → erfolgreich; `bot` setzt Signal `review` auf #1 → erfolgreich
- [ ] `bot` bewegt #9 aus „In Arbeit“ nach „Verstehen & Freigabe“ (`human`) → `200`
- [ ] `bot` schickt `PATCH /api/personen/bot {art: "human"}` → `403` `{fehler: "Die Art der Person „bot“ ändern nur Menschen", kuerzel: "bot"}`, `fehler` als erstes Feld, `kanbanD.md` byte-gleich, kein Commit; danach `DELETE /api/aufgaben/1` aus Eingang (`human`) → `403` (die Sperre hält)
- [ ] `bot` schickt `PATCH /api/personen/st {art: "agent"}` → `403`, `kuerzel: "st"`; auch Zurückstufen ändert niemand außer Menschen
- [ ] `bot` schickt `PATCH /api/personen/bot {art: "agent"}` (unverändert) oder nur `{name: "…"}` → `200`, ohne Änderung kein Commit; `POST /api/personen` mit `art: "agent"` → `201`, mit `art: "human"` → `403` `{fehler: "Eine neue Person der Art „human“ legen nur Menschen an", kuerzel: "mi"}`; `PUT /api/einstellungen` mit eigener `art: "human"` → `403`, mit unveränderter Art → `200`
- [ ] `st` setzt `PATCH /api/personen/bot {art: "human"}` → `200`, ein Commit, die Datei trägt `kind: human`

### Mensch
- [ ] `st` bewegt #1 von Eingang nach Freigegeben → `200`, ein Commit

### Oberfläche
- [ ] Im Spalten-Dialog „Eigentümer: Mensch“ für Eingang wählen und speichern → Spaltenkopf zeigt das Mensch-Zeichen mit Tooltip, nach Neuladen weiterhin

## Betroffene Verzeichnisstruktur

Format in `src/format/board.rs` (neben `column-checks`, `column-colors`), Modell in `src/modell/board.rs`, Regel und Durchsetzung in `src/dienst/` (bewegen, reservierung, archivieren, vom Board nehmen), neue Fehlerart in `src/fehler.rs`, Oberfläche in `web/ansicht.js` (Spaltenkopf, Spalten-Dialog) und `web/app.js`. Die Tests liegen im jeweiligen Modul, unter `tests/` und `e2e/tests/`.

## Technische Überlegungen

### Ablauf
1. **Lesen**: `column-owner` → `Spalte.eigentuemer: Option<Eigentuemer>`
2. **Vor jedem Herausnehmen**: `pruefe_entnahme(person, board, nummern)`
   - 2.1 `person.art == Human` → erlaubt
   - 2.2 sonst für jede Nummer die Spalte suchen. Ist ihr Eigentümer `Human`, folgt `Fehler::Verboten`
3. **Danach** gelten die Grenze (R00096), die Prüfungen und der Commit wie heute

### Grobentwurf

**Wichtige Einstiegsstellen:** die Dienstmethoden für Bewegen, Ziehen, Archivieren, vom Board nehmen; `PUT …/spalten`; Spaltenkopf und Spalten-Dialog.

- `Eigentuemer` (Enum: `Human`, `Agent`) — Wert aus `column-owner`
- `Board` (vorhanden)
  - `fn entnahme_erlaubt(&self, art: Art, nummer: u32) -> Result<(), Entnahmesperre>` — reine Prüfung
- `Entnahmesperre` (DTO, immutable) — Spalte und Nummer, wird zu `Fehler::Verboten`
- `Fehler::Verboten(String)` (neu) → HTTP `403`
- `SpaltenAenderung` (vorhanden) — neues Feld `eigentuemer`

### Änderungen an bestehenden Klassen
- `format::board::lesen` und `schreiben`: `column-owner` lesen, Hinweise, stabile Reihenfolge der Spalten
- `Kanban::bewegen`, `mehrere_bewegen`, `ziehen`, Archivieren (einzeln und mehrere), vom Board nehmen: `entnahme_erlaubt` vor dem Schreiben
- `Fehler` und die Abbildung auf HTTP-Codes: `Verboten` → 403

## Tests

**Unit:** `Board::entnahme_erlaubt` für die Kombinationen Mensch/Agent × Eigentümer human/agent/keiner. Rundreise des Formats mit Umbenennen.
**Integration:** jeder gesperrte Endpunkt als Agent (`403`, `git log` unverändert), jeder erlaubte als Agent, alles als Mensch.
**E2E:** Eigentümer im Spalten-Dialog setzen, Zeichen im Kopf (US-4).

## Abhängigkeiten
- Abhängig von: R00009 (Spalten einrichten), R00087 (`ziehen`)
- Wirkt zusammen mit: R00096 (Grenze), R00099 (Befund erledigt sich: in Menschen-Spalten nur Kommentar und Signal)
- Blockiert: R00099

## Offene Fragen
- keine

## Manuelle Vorbereitungstätigkeiten
- keine

## Manuelle Nachbereitungstätigkeiten
- Im Factory-Board Eingang und „Verstehen & Freigabe“ auf `human` stellen. „Freigegeben“ darf **nicht** `human` sein, sonst können Behandler dort nicht ziehen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass die Freigabe durch den Menschen heute nur eine Abmachung ist: Ein fehlerhafter oder übereifriger Behandler kann eine ungesichtete Karte aus dem Eingang bewegen und bearbeiten. Hat der Eingang den Eigentümer `human`, scheitert jeder solche Versuch mit `403`. Eine Karte kommt dann nur in die Arbeit, wenn ein Mensch sie nach „Freigegeben“ gezogen hat. Dasselbe gilt für „Verstehen & Freigabe“ vor der Auslieferung. Der Hebel liegt beim Herausnehmen und nicht beim Hineinlegen, weil Sensoren und Behandler Karten gerade in Menschen-Spalten abliefern sollen. Die Regel hängt an der Spalte und nicht an einzelnen Endpunkten, so muss jeder neue Schreibweg dieselbe Prüfung durchlaufen.

## Missing-Docs
- keine

## Notizen

**Optionen-Tableau übersprungen:** Der Betreiber hat die Regel vorgegeben. Ohne Rückfrage entschieden:
- **Werte `human | agent` statt `mensch | agent`**: dieselben Werte wie bei `kind` der Personen in `kanbanD.md`. Ein Schlüssel `column-owner` mit dem Wert `mensch` würde Deutsch und Englisch im selben Frontmatter mischen. Die Oberfläche zeigt „Mensch“ bzw. „Agent“.
- **Auch das Umsortieren ist gesperrt**: Die Reihenfolge im Eingang ist die Priorität des Menschen.
- **Auch Archivieren und vom Board nehmen sind gesperrt**: Beides nimmt eine Karte heraus und wäre sonst ein Weg an der Sperre vorbei.
- **Reservieren bleibt erlaubt**: Es bewegt nichts, und `ziehen` ist ohnehin gesperrt.

**Verworfene Alternativen**
- *Rechte je Person statt je Spalte*: Das widerspricht Full-Trust und braucht eine Rechteverwaltung, die die Vision ausschließt.
- *Sperre nur in der Oberfläche anzeigen*: Agenten arbeiten über die API, die Sperre wäre wirkungslos.
