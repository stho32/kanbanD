---
id: R00098
status: Neu
datum: 2026-10-31
---

# R00098: Idempotentes Anlegen über einen Fremdschlüssel

## Beschreibung

Eine Aufgabe kann beim Anlegen einen frei wählbaren Schlüssel `key` bekommen, der im ganzen Ordner eindeutig ist, archivierte Karten eingeschlossen. Legt ein Aufrufer mit einem schon vergebenen Schlüssel an, entsteht keine neue Karte. Er bekommt die bestehende mit `200` zurück. Ist sie archiviert, wird sie dabei wieder geöffnet. Neu ist außerdem der Filter `GET /api/aufgaben?key=…`. Im Aufgabenfenster ist der Schlüssel sichtbar, aber nicht änderbar.

Zahlt ein auf: [Vision](R00000-vision.md) — Menschen im Browser, KI-Agenten über die API auf einem gemeinsamen Board.

## Geschäftlicher Nutzen

Die Sensoren der Wartungsfabrik laufen täglich und melden dieselben Befunde immer wieder. Ohne Schlüssel muss jeder Sensor selbst erkennen, ob es eine Karte schon gibt (Titel vergleichen, Labels abfragen), und jeder macht das anders. Mit `key` wird das Anlegen idempotent: Derselbe Befund ergibt immer dieselbe Karte, und ein wieder aufgetretener Befund öffnet seine alte Karte samt Geschichte.

## Funktionale Anforderungen

### Datenmodell
- Frontmatter der Aufgabe: `key: <text>`, 1–200 Zeichen ohne Zeilenumbruch, vorne und hinten getrimmt, Groß- und Kleinschreibung zählt. Fehlt der Schlüssel, hat die Aufgabe keinen.
- Der Schlüssel wird nur beim Anlegen gesetzt. `PATCH` mit `key` → `400` „Schlüssel ist nicht änderbar“.

### Anlegen
- `POST /api/aufgaben {titel, key?, board?, spalte?, …}` und jeder Eintrag von `POST /api/aufgaben/mehrere` nehmen `key` an.
- Schlüssel unbekannt → anlegen wie heute, `201`.
- Schlüssel an einer offenen (nicht archivierten) Karte → `200` mit dieser Karte, unverändert, ohne Commit. Titel und Felder der Anfrage werden nicht übernommen.
- Schlüssel an einer archivierten Karte → **wieder öffnen**, in einem Commit:
  1. zurückholen wie `POST /api/aufgaben/{nr}/zurueckholen`;
  2. nennt die Anfrage `board`, kommt die Karte oben in `spalte` dieses Boards, ohne `spalte` in dessen erste Spalte. Ohne `board` bleibt sie dort, wohin das Zurückholen sie legt;
  3. Kommentar von Wer: „Erneut gefunden (Schlüssel „<key>“)“;
  4. Antwort `200` mit der Karte, Commit „#n erneut gefunden: wieder geöffnet“.
- In `…/mehrere` gilt das je Eintrag. Zweimal derselbe Schlüssel in einer Anfrage ergibt eine Karte. Die Antwort nennt je Eintrag die Nummer und `neu: true|false`.
- Grenze (R00096) und Eigentümer (R00097) gelten beim Wiederöffnen wie bei jedem anderen Hineinlegen.

### Doppelte Schlüssel
- Tragen nach einem Merge zwei Dateien denselben Schlüssel, liefert `?key=` beide. `POST` mit diesem Schlüssel → `409` „Schlüssel „<key>“ mehrfach vergeben: #a, #b“. Der Zustand (`GET /api/zustand`) meldet doppelte Schlüssel wie doppelte Nummern.

### Filter
- `GET /api/aufgaben?key=<text>` sucht genau diesen Schlüssel. Mehrfaches `key` wird mit ODER verknüpft, die Archivregel aus R00092 gilt: Archivierte erscheinen nur mit `archivierte=ja|nur`.

### Oberfläche
- Im Aufgabenfenster steht die Zeile „Schlüssel“ mit dem Text, nur lesbar und markierbar. Ohne Schlüssel entfällt die Zeile.

### Beschreibung
- `/api`, `/api/endpunkte`, `/api/openapi.json` beschreiben `key`, `200` gegen `201`, das Wiederöffnen, den Filter und die `409`.

## Nicht-funktionale Anforderungen

- Prüfen und Anlegen laufen unter der Ordnersperre. Zwei gleichzeitige `POST` mit demselben neuen Schlüssel ergeben genau eine Karte (einmal `201`, einmal `200`).
- Die Suche nach dem Schlüssel liest die Aufgaben wie die heutigen Filter. Ein Index ist nicht nötig, solange der Ordner keine fünfstellige Zahl von Aufgaben hat.

## Akzeptanzkriterien

### Anlegen
- [ ] `POST {titel: "Abhängigkeit veraltet", key: "shop/nc-304/lodash", board: "fabrik", spalte: "Eingang"}` → `201`, Datei mit `key: shop/nc-304/lodash`
- [ ] Derselbe Aufruf mit dem Titel „anders“ → `200`, gleiche Nummer, Titel unverändert, `git log` ohne neuen Commit
- [ ] Zwei gleichzeitige Aufrufe mit dem neuen Schlüssel `k2` → genau eine Datei mit `k2`, Statuscodes {201, 200}
- [ ] `…/mehrere` mit den Einträgen `[{titel: "a", key: "k3"}, {titel: "b", key: "k3"}, {titel: "c"}]` → zwei neue Karten, die Antwort nennt für beide `k3`-Einträge dieselbe Nummer

### Wiederöffnen
- [ ] #7 mit `key: k4` ist archiviert. `POST {titel, key: "k4", board: "fabrik", spalte: "Eingang"}` → `200`, #7 nicht mehr archiviert, oben in Eingang, Kommentar „Erneut gefunden (Schlüssel „k4“)“, genau ein Commit
- [ ] Dasselbe ohne `spalte` → #7 liegt in der ersten Spalte von „fabrik“

### Unveränderlich
- [ ] `PATCH /api/aufgaben/7 {key: "x"}` → `400`, Datei unverändert
- [ ] Das Aufgabenfenster zeigt „Schlüssel k4“ ohne Eingabefeld

### Filter und Dubletten
- [ ] `?key=k4` → [7]; nach dem Archivieren → [], mit `&archivierte=ja` → [7]
- [ ] Zwei Dateien mit `key: k5` (von Hand angelegt) → `?key=k5` liefert beide, `POST` mit `k5` → `409` mit beiden Nummern, `/api/zustand` meldet die Dublette

## Betroffene Verzeichnisstruktur

Format in `src/format/aufgabe.rs` (`BEKANNT`, lesen, schreiben), Modell in `src/modell/aufgabe.rs`, Anlegen und Wiederöffnen in `src/dienst/aufgabe_anlegen.rs` mit `src/dienst/archiv.rs`, Filter in `src/dienst/aufgabenfilter.rs`, Dublettenmeldung beim Zustand in `src/dienst/mod.rs`, Anzeige in `web/ansicht.js`. Tests im Modul, unter `tests/` und `e2e/tests/`.

## Technische Überlegungen

### Ablauf
1. **Prüfen**: `key` getrimmt, 1–200 Zeichen, kein Zeilenumbruch → sonst `400`
2. **Suchen** unter der Sperre: alle Aufgaben mit diesem Schlüssel
   - 2.1 keine → anlegen wie heute (`201`)
   - 2.2 mehr als eine → `409`
   - 2.3 eine offene → zurückgeben (`200`)
   - 2.4 eine archivierte → wieder öffnen (zurückholen, legen, kommentieren, ein Commit, `200`)

### Grobentwurf

**Wichtige Einstiegsstellen:** `POST /api/aufgaben`, `POST /api/aufgaben/mehrere`, `GET /api/aufgaben`, `PATCH /api/aufgaben/{nr}`, Aufgabenfenster.

- `Fremdschluessel` (Werttyp, immutable) — geprüfter Schlüsseltext
  - `fn pruefen(text: &str) -> Result<Fremdschluessel, Fehler>`
- `Schluesseltreffer` (Enum) — `Keiner`, `Offen(u32)`, `Archiviert(u32)`, `Mehrfach(Vec<u32>)`
  - `fn suchen(aufgaben: &[Aufgabe], key: &Fremdschluessel) -> Schluesseltreffer` (pure)
- `Angelegt` (DTO) — Aufgabe und `neu: bool`, daraus `201` oder `200`

### Änderungen an bestehenden Klassen
- `Aufgabe`: Feld `schluessel: Option<String>`; `Angaben` und `Eintrag`: Feld `key`
- `Kanban::aufgabe_anlegen`, `aufgaben_anlegen`: Fallunterscheidung nach `Schluesseltreffer`, Rückgabe `Angelegt`
- `Aufgabenaenderung`: `key` führt zu `400`
- `Aufgabenfilter`: Parameter `key`
- Zustand: doppelte Schlüssel neben doppelten Nummern

## Tests

**Unit:** `Fremdschluessel::pruefen` (Grenzen 0, 1, 200, 201 Zeichen, Umbruch), `Schluesseltreffer::suchen` (alle vier Fälle), Rundreise des Formats mit `key: "a: b"`.
**Integration:** alle Kriterien unter „Anlegen“, „Wiederöffnen“ und „Filter und Dubletten“ gegen einen echten Ordner mit `git log`, dazu der gleichzeitige Aufruf mit zwei Threads.
**E2E:** Das Aufgabenfenster zeigt den Schlüssel nur lesbar (US-4).

## Abhängigkeiten
- Abhängig von: R00092 (Filter), R00096 (Grenze beim Wiederöffnen), R00097 (Eigentümer beim Wiederöffnen)
- Blockiert: R00099 (Befund erledigt sich)

## Offene Fragen
- keine (Archivfall entschieden am 2026-10-31: wieder öffnen)

## Manuelle Vorbereitungstätigkeiten
- keine

## Manuelle Nachbereitungstätigkeiten
- Sensoren auf `key` umstellen und ihre eigene Dublettenerkennung entfernen. Der Schlüssel sollte aus Repository, Bedingung und Fundstelle gebildet werden, zum Beispiel `shop/nc-304/lodash`.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass tägliche Sensoren denselben Befund jeden Tag neu melden und das Board ohne eigene Dublettenerkennung in jedem Sensor mit Kopien volllaufen würde. Mit einem Schlüssel, den kanbanD selbst eindeutig hält, liefert derselbe Aufruf immer dieselbe Karte. Ein Sensor braucht nur noch „anlegen“ und keine vorherige Suche. Ein wieder aufgetretener Befund öffnet seine archivierte Karte. Damit bleibt die Geschichte (Kommentare, Zeiten, frühere Behebung) an einer Stelle, und der Mensch sieht den Rückfall als Rückfall. Der Hebel liegt im Anlegen selbst und nicht in einem Filter davor, denn nur unter der Sperre des Anlegens ist ausgeschlossen, dass zwei Läufe gleichzeitig zwei Karten erzeugen.

## Missing-Docs
- keine

## Notizen

**Befund aus der Prüfung (2026-10-31):** Ein heutiges kanbanD ignoriert unbekannte Felder. `POST /api/aufgaben {titel, key}` antwortet `201` und verwirft `key` still. Ein Sensor, der `key` schon schickt, bevor R00098 gebaut ist, erzeugt deshalb Dubletten, ohne einen Fehler zu sehen.

**Optionen-Tableau:** Der Betreiber hat Schlüssel, Filter und Anzeige vorgegeben. Für den Archivfall lagen vier Optionen vor, gewählt wurde „wieder öffnen“.

**Verworfene Alternativen**
- *Neue Karte mit Verweis auf die archivierte*: Der Schlüssel wäre dann nur unter offenen Karten eindeutig, und die Geschichte zerfiele auf mehrere Karten.
- *Nur melden, der Sensor holt selbst zurück*: zwei Aufrufe, nicht atomar, und jeder Sensor müsste den Fall selbst behandeln.
- *Wählbar je Aufruf (`beiArchiv`)*: drei Wege, die getestet und beschrieben werden müssten, ohne dass ein Bedarf benannt ist.
