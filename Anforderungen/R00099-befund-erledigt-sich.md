---
id: R00099
status: Neu
datum: 2026-10-31
---

# R00099: Befund erledigt sich

## Beschreibung

Findet ein Sensor einen Befund nicht mehr, erledigt er dessen Karte über ihren Schlüssel (`key`, R00098) mit einem einzigen Aufruf: Er kommentiert mit Begründung und legt die Karte in die Abschlussspalte, beides in einem Commit. Liegt die Karte in einer Spalte, die dem Menschen gehört (R00097), wird sie nicht bewegt, sondern nur kommentiert und mit einem Signal versehen. Wiederholte Aufrufe ändern nichts mehr.

Zahlt ein auf: [Vision](R00000-vision.md) — Menschen im Browser, KI-Agenten über die API auf einem gemeinsamen Board.

## Geschäftlicher Nutzen

Ohne diesen Weg bleiben behobene Befunde liegen: Ein Sensor sieht den Befund nicht mehr, aber die Karte steht weiter im Eingang oder in der Arbeit. Das Board taugt dann nicht mehr als Übersicht darüber, wo es brennt. Mit „erledigt sich“ bildet das Board den Bestand ab, den die Sensoren heute sehen.

## Prüfung: geht es schon mit Vorschlag 3 und den vorhandenen Endpunkten?

Nein. Nötig wären ein lesender und zwei schreibende Aufrufe:
1. `GET /api/aufgaben?key=…&board=…` → Nummer und Spalte (R00098, lesend);
2. `POST /api/aufgaben/{nr}/kommentare {text}` → **Commit 1**;
3. `POST /api/boards/{slug}/bewegen {nummer, spalte: <letzte>}` → **Commit 2**, oder in einer Menschen-Spalte `PUT /api/aufgaben/{nr}/signale/{signal}` → **Commit 2**.

Zwischen 2 und 3 kann ein Mensch die Karte bewegen, und ein Abbruch hinterlässt einen Kommentar ohne Zug. Außerdem muss jeder Sensor die Menschen-Spalte selbst erkennen und die Idempotenz selbst bauen (sonst ein neuer Kommentar an jedem Tag). Der eigene Endpunkt lohnt sich deshalb, nach dem Vorbild von R00094 (Durchlauf und Kommentar in einem Commit).

## Funktionale Anforderungen

### Endpunkt
- `POST /api/aufgaben/erledigen {key, board, text, signal}` (braucht Wer):
  - `key` — Schlüssel nach R00098, Pflicht;
  - `board` — Slug, Pflicht, denn eine Karte kann auf mehreren Boards liegen;
  - `text` — Begründung, getrimmt 1–2000 Zeichen, Zeilenumbrüche erlaubt, Pflicht;
  - `signal` — Schlüssel eines in `kanbanD.md` eingerichteten Signals, Pflicht. Es wird nur in Menschen-Spalten gesetzt, aber immer geprüft, damit ein Sensor den Fehler sofort sieht und nicht erst, wenn eine Karte einmal im Eingang liegt.

### Ablauf unter der Sperre, ein Commit
0. Eingaben prüfen (`key`, `text`, `signal`, `board` nicht leer) → sonst `400`, vor jeder Suche. Ein unbekanntes Board → `404`.
1. Schlüssel suchen. Keine Karte → `404`, mehrfach vergeben → `409` (wie R00098).
2. Karte archiviert oder in der Abschlussspalte (letzte Spalte) des Boards → `200` `{ergebnis: "schon erledigt"}`, kein Commit.
3. Karte nicht auf dem Board → `404`.
4. Karte in einer Spalte mit `column-owner: human` und Wer ist ein Agent:
   - Signal schon gesetzt → `200` `{ergebnis: "schon gemeldet"}`, kein Commit;
   - sonst Kommentar „Befund nicht mehr gefunden: <text>“ und Signal setzen → `200` `{ergebnis: "gemeldet"}`, Commit „#n Befund nicht mehr gefunden — gemeldet (<Board>)“.
5. Sonst Kommentar „Befund nicht mehr gefunden: <text>“, Karte oben in die Abschlussspalte, eine Reservierung entfernen → `200` `{ergebnis: "erledigt"}`, Commit „#n erledigt sich: „<von>“ → „<Abschlussspalte>“ (<Board>)“.
- Die Antwort enthält immer `{aufgabe, ergebnis}`.
- Die Grenze (R00096) gilt auch für die Abschlussspalte. Ist sie voll, folgt `409`, ohne Kommentar.
- Für einen Menschen als Wer gilt Schritt 4 nicht, denn Menschen-Spalten sperren nur Agenten.
- Im Fall „gemeldet“ bleiben Spalte und Reservierung unverändert; der Commit enthält nur die Aufgabendatei.
- Ein schon gesetztes Signal an einer Karte außerhalb einer Menschen-Spalte bleibt beim Erledigen unverändert.

### Beschreibung
- `/api`, `/api/endpunkte`, `/api/openapi.json` beschreiben den Endpunkt, die vier Ergebnisse und die Fehler.

## Nicht-funktionale Anforderungen

- Atomar: Kommentar, Zug bzw. Signal und das Entfernen der Reservierung stehen in genau einem Commit, oder es geschieht nichts.
- Idempotent: Ein zweiter gleicher Aufruf erzeugt weder einen Commit noch einen Kommentar.

## Akzeptanzkriterien

Alle Beispiele spielen auf dem Board „fabrik“ mit den Spalten Eingang (`column-owner: human`), Freigegeben, In Arbeit, Verstehen & Freigabe, Fertig; in `kanbanD.md` ist das Signal `behoben` eingerichtet. `bot` ist ein Agent, `st` ein Mensch. Der Aufruf heißt kurz `erledigen {…}` für `POST /api/aufgaben/erledigen`.

### Erledigen
- [ ] Gegeben #7 trägt `key: k1`, liegt in „In Arbeit“ (ohne Eigentümer) und ist von Instanz A reserviert, wenn `bot` `erledigen {key: "k1", board: "fabrik", text: "lodash 4.17.21 ist eingespielt", signal: "behoben"}` schickt, dann antwortet kanbanD `200 {aufgabe, ergebnis: "erledigt"}`, #7 liegt oben in „Fertig“, trägt den Kommentar „Befund nicht mehr gefunden: lodash 4.17.21 ist eingespielt“ von `bot` und keine Reservierung, und `git log` hat genau einen neuen Commit „#7 erledigt sich: „In Arbeit“ → „Fertig“ (fabrik)“, der Board-Datei und Aufgabendatei enthält.
- [ ] Gegeben derselbe Ausgang nach dem ersten Aufruf, wenn `bot` denselben Aufruf noch einmal schickt, dann antwortet kanbanD `200 {ergebnis: "schon erledigt"}`, es gibt keinen neuen Commit und keinen neuen Kommentar.
- [ ] Gegeben #7 trägt `key: k1` und ist archiviert, wenn `bot` erledigen schickt, dann antwortet kanbanD `200 {ergebnis: "schon erledigt"}` ohne Commit — auch wenn #7 nicht auf „fabrik“ liegt.
- [ ] **Grenzwert:** Gegeben derselbe Ausgang, wenn `text` 2000 Zeichen hat, dann `200 {ergebnis: "erledigt"}`; mit 2001 Zeichen `400` ohne Commit.

### Menschen-Spalte
- [ ] Gegeben #8 trägt `key: k2` und liegt im Eingang, der Menschen gehört, wenn `bot` `erledigen {key: "k2", board: "fabrik", text: "nicht mehr gefunden", signal: "behoben"}` schickt, dann antwortet kanbanD `200 {ergebnis: "gemeldet"}`, #8 liegt weiter im Eingang, trägt das Signal `behoben` und einen Kommentar „Befund nicht mehr gefunden: nicht mehr gefunden“, eine Reservierung bleibt unverändert, und es gibt genau einen Commit „#8 Befund nicht mehr gefunden — gemeldet (fabrik)“.
- [ ] Gegeben #8 trägt danach das Signal `behoben`, wenn `bot` denselben Aufruf noch einmal schickt, dann antwortet kanbanD `200 {ergebnis: "schon gemeldet"}` ohne Commit und ohne Kommentar.
- [ ] Gegeben #8 liegt im Eingang, wenn `st` denselben Aufruf schickt, dann antwortet kanbanD `200 {ergebnis: "erledigt"}`, und #8 liegt oben in „Fertig“ (Menschen-Spalten sperren nur Agenten).

### Fehler
- [ ] **Leerfall:** Gegeben keine Karte trägt `k9`, wenn `bot` mit `key: "k9"` erledigen schickt, dann antwortet kanbanD `404`, ohne Commit.
- [ ] **Leerfall:** Gegeben #7 trägt `k1`, liegt aber nicht auf „fabrik“, wenn `bot` mit `board: "fabrik"` erledigen schickt, dann `404`; mit `board: "gibtsnicht"` ebenfalls `404`; jeweils ohne Commit.
- [ ] **Fehlfall:** Gegeben #7 liegt in „In Arbeit“, wenn `bot` mit `signal: "gibtsnicht"` erledigen schickt, dann antwortet kanbanD `400`, obwohl das Signal in dieser Spalte gar nicht gesetzt würde; mit `text: ""` oder `"   "` ebenfalls `400`; jeweils ohne Commit. Eingaben werden vor der Suche geprüft: ein ungültiger Text mit einem unbekannten Schlüssel ergibt `400`, nicht `404`.
- [ ] **Fehlfall Dublette:** Gegeben #8 und #9 tragen beide `key: k5`, wenn `bot` mit `key: "k5"` erledigen schickt, dann antwortet kanbanD `409` „Schlüssel „k5“ mehrfach vergeben: #8, #9“, ohne Commit.
- [ ] **Fehlfall Grenze:** Gegeben „Fertig“ hat die Grenze 1 und trägt #3, wenn `bot` #7 erledigen will, dann antwortet kanbanD `409 {fehler: "Grenze erreicht", spalte: "Fertig", grenze: 1, anzahl: 1}`, #7 bleibt mit Reservierung in „In Arbeit“, ohne Kommentar und ohne Commit. Eine archivierte Karte in „Fertig“ zählt nicht. Für `st` gilt die Antwort auf Offene Frage 1.

### Beschreibung
- [ ] `/api`, `/api/endpunkte` und `/api/openapi.json` nennen `POST /api/aufgaben/erledigen` mit `key`, `board`, `text` (1–2000 Zeichen), `signal` (eingerichtet, immer geprüft), den vier Ergebnissen `erledigt`, `schon erledigt`, `gemeldet`, `schon gemeldet` und den Fehlern `400`, `404`, `409`.

## Betroffene Verzeichnisstruktur

Ablauf als neuer Dienst `src/dienst/erledigen.rs` neben `src/dienst/reservierung.rs`, Route in `src/web/mod.rs`, Beschreibung in `src/web/endpunkte.rs`. Die Tests liegen im Modul und unter `tests/`.

## Technische Überlegungen

### Ablauf
1. **Eingaben prüfen**: `Fremdschluessel::pruefen`, Text, Signal gegen die Einstellungen
2. **Lage bestimmen** (pure): `Erledigungslage::aus(aufgabe, board, art)` → `SchonErledigt | SchonGemeldet | Melden | Erledigen`
3. **Schreiben** je nach Lage in einem Commit (`aktion` mit Board- und Aufgabendatei)

### Grobentwurf

**Wichtige Einstiegsstellen:** neue Route `POST /api/aufgaben/erledigen`.

- `Erledigung` (DTO, immutable, Anfrage) — `key`, `board`, `text`, `signal`
- `Erledigungslage` (Enum) — die vier Fälle
  - `fn bestimmen(aufgabe: &Aufgabe, board: &Board, art: Art, signal: &str) -> Erledigungslage` (pure)
- `Erledigt` (DTO, Antwort) — `aufgabe`, `ergebnis`
- `Kanban::erledigen(&self, wer: &Person, e: &Erledigung) -> Result<Erledigt, Fehler>` (Integration)

### Änderungen an bestehenden Klassen
- keine außer der Route. Die Bausteine (Schlüsselsuche aus R00098, Eigentümer aus R00097, Grenze aus R00096, Kommentar, Signal, Zug) werden wiederverwendet.

## Tests

**Unit:** `Erledigungslage::bestimmen` über alle Fälle × Mensch/Agent.
**Integration:** alle Akzeptanzkriterien gegen einen echten Ordner, jeweils mit Zählung der Commits in `git log`.
**E2E:** keine, ein reiner API-Endpunkt. Die Wirkung (Signal auf der Karte) deckt R00076 ab.

## Abhängigkeiten
- Abhängig von: R00098 (Schlüssel), R00097 (Eigentümer), R00096 (Grenze), R00076 (Signale)
- Blockiert: —

## Offene Fragen
1. **Mensch über der Grenze** (offen, an den PO): „Ist sie voll, folgt `409`“ unterscheidet nicht nach Wer; R00096 weist nur Agenten ab, Menschen bekommen an Zug-Endpunkten eine Warnung `grenze`, beim Anlegen und Zurückholen keine (PO-Entscheidung 2026-11-01). Empfehlung: `st` bekommt `200 {ergebnis: "erledigt", warnungen: [grenze]}`, denn Erledigen ist ein Zug und die Antwortform ist neu. Alternativen: `200` ohne Warnung, oder `409` auch für Menschen.

## Manuelle Vorbereitungstätigkeiten
- In `kanbanD.md` des Factory-Ordners ein Signal einrichten, zum Beispiel `behoben`, „Befund nicht mehr gefunden“.

## Manuelle Nachbereitungstätigkeiten
- Sensoren: für jeden Schlüssel, den sie heute nicht mehr finden, `erledigen` aufrufen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass behobene Befunde ohne Rückmeldung des Sensors auf dem Board liegen bleiben und es als Bestandsübersicht unbrauchbar machen. Ein einziger idempotenter Aufruf je verschwundenem Schlüssel lässt jeder Sensor-Lauf das Board auf den gesehenen Stand bringen. Behobenes landet in der Abschlussspalte, und der Bestand stimmt wieder. Liegt die Karte noch beim Menschen, bewegt der Sensor sie nicht an der Freigabe vorbei, sondern meldet sich mit Kommentar und Signal. Der Mensch entscheidet. Der Hebel ist ein eigener Endpunkt und nicht eine Folge vorhandener Aufrufe, denn nur so sind Kommentar und Zug atomar, und nur kanbanD kennt unter der Sperre die aktuelle Spalte und ihren Eigentümer.

## Missing-Docs
- keine

## Notizen

**Optionen**

| # | Option | Komplexität | Atomar | Idempotent | Reversibilität |
|---|---|---|---|---|---|
| A | `POST /api/aufgaben/erledigen {key, board, text, signal}` | mittel | ja | ja, im Server | hoch |
| B | `POST /api/aufgaben/{nr}/erledigen` — Nummer vorher über `?key=` | mittel | ja | ja | hoch |
| C | `bewegen` um `kommentar` erweitern, Rest im Sensor | gering | nur der Zug | nein, im Sensor | hoch |

**Wahl: A** — ohne Rückfrage, weil der Betreiber den Maßstab vorgegeben hat („eigener Endpunkt nur, wenn sonst nicht atomar“). Der Sensor kennt nur den Schlüssel, und erst A erledigt das Suchen unter derselben Sperre.

**Verworfene Alternativen**
- *B*: Zwischen der Suche und dem Erledigen kann sich die Lage ändern, und der Sensor macht einen Aufruf mehr.
- *C*: Die Unterscheidung nach Menschen-Spalten und die Idempotenz lägen wieder in jedem Sensor.

**Ohne Rückfrage entschieden:** `signal` ist immer Pflicht und wird immer geprüft. Die Reservierung wird beim Erledigen entfernt, wie beim Archivieren.

**Ergänzung 2026-11-05 (`/anforderung abschliessen`, planer):** Akzeptanzkriterien als Gegeben/Wenn/Dann mit Werten umgeschrieben; Grenz-, Leer- und Fehlfälle ergänzt (2000/2001 Zeichen, leerer Text, archivierte Karte, Karte nicht auf dem Board, unbekanntes Board, Dublette, Reihenfolge 400 vor 404); Prüfschritt 0, Trimmen des Texts und das Verhalten von Reservierung und Signal im Fall „gemeldet“ in die funktionalen Anforderungen übernommen; eine offene Frage an den PO. User Story um US-4 bis US-6 ergänzt. Code-Stand 2026-11-05: nichts davon gebaut; Kerne aus R00098 (`zurueckgeholt`, `kommentiert`, `Board::oben_einordnen`, `zug_mit_rueckkehr_pruefen`) vorhanden, Signal-Kern fehlt.
