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
- Antwort: jedes Element trägt zusätzlich `neu: true|false`, auch die Einzelantwort; `…/mehrere` antwortet `201`, sobald ein Eintrag neu ist, sonst `200` (vorbehaltlich Offene Frage 2).
- Ein ungültiger Schlüssel (leer nach dem Trimmen, über 200 Zeichen, mit Zeilenumbruch) → `400` „Schlüssel: 1–200 Zeichen ohne Zeilenumbruch“; in `…/mehrere` für die ganze Anfrage.
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

Alle Beispiele spielen im Ordner mit dem Board „fabrik“ (Spalten „Eingang“, „In Arbeit“, „Fertig“); `bot` ist ein Agent, `st` ein Mensch.

### Anlegen
- [ ] Gegeben keine Karte trägt den Schlüssel `shop/nc-304/lodash`, wenn `bot` `POST /api/aufgaben {titel: "Abhängigkeit veraltet", key: "shop/nc-304/lodash", board: "fabrik", spalte: "Eingang"}` schickt, dann antwortet kanbanD `201` mit `neu: true`, die neue Datei trägt `key: shop/nc-304/lodash`, und es gibt einen Commit mehr.
- [ ] Gegeben #7 trägt `key: shop/nc-304/lodash` und ist offen, wenn `bot` denselben Aufruf mit dem Titel „anders“ schickt, dann antwortet kanbanD `200` mit #7 und `neu: false`, der Titel von #7 bleibt „Abhängigkeit veraltet“, und `git log` hat keinen neuen Commit.
- [ ] Gegeben #7 trägt `key: k4`, wenn `bot` mit `key: "K4"` anlegt, dann entsteht eine neue Karte mit `201` (Groß- und Kleinschreibung zählt).
- [ ] Gegeben keine Karte trägt `k1`, wenn `bot` mit `key: "  k1  "` anlegt, dann trägt die neue Datei `key: k1`, und ein folgender Aufruf mit `key: "k1"` antwortet `200`.
- [ ] Gegeben keine Karte trägt `k2`, wenn zwei Aufrufe mit `key: "k2"` gleichzeitig ankommen, dann gibt es genau eine Datei mit `k2`, die Statuscodes sind {201, 200}, und beide Antworten nennen dieselbe Nummer. Geprüft wird deterministisch: Der erste Aufruf hält die Sperre zwischen Suchen und Schreiben, während der zweite anläuft.
- [ ] Gegeben keine Karte trägt `k3`, wenn `bot` `POST /api/aufgaben/mehrere {titel: [{titel: "a", key: "k3"}, {titel: "b", key: "k3"}, {titel: "c"}]}` schickt, dann entstehen genau zwei Karten in einem Commit, die Antwort nennt für die beiden `k3`-Einträge dieselbe Nummer (der erste `neu: true`, der zweite `neu: false`), und der Titel der `k3`-Karte ist „a“.
- [ ] **Leerfall:** Gegeben eine Anfrage ohne `key`, wenn `bot` anlegt, dann verhält sich kanbanD wie heute: `201`, Datei ohne Zeile `key`.
- [ ] **Grenzwert:** Gegeben keine Karte trägt den Schlüssel, wenn `bot` mit einem Schlüssel aus 200 Zeichen anlegt, dann `201`; mit einem aus einem Zeichen ebenfalls `201`.
- [ ] **Fehlfall:** Gegeben ein Schlüssel `""`, `"   "`, einer aus 201 Zeichen oder `"a\nb"`, wenn `bot` damit anlegt, dann antwortet kanbanD `400` „Schlüssel: 1–200 Zeichen ohne Zeilenumbruch“, und es entsteht weder eine Datei noch ein Commit. In `…/mehrere` weist ein ungültiger Schlüssel die ganze Anfrage ab.

### Wiederöffnen
- [ ] Gegeben #7 trägt `key: k4`, liegt in „Fertig“ und ist archiviert, wenn `bot` `POST /api/aufgaben {titel: "x", key: "k4", board: "fabrik", spalte: "Eingang"}` schickt, dann antwortet kanbanD `200` mit #7 und `neu: false`, #7 ist nicht mehr archiviert und liegt oben in „Eingang“, trägt den Kommentar „Erneut gefunden (Schlüssel „k4“)“ von `bot`, ihre früheren Kommentare und Zeiten sind unverändert, und es gibt genau einen Commit „#7 erneut gefunden: wieder geöffnet“.
- [ ] Gegeben derselbe Ausgang, wenn die Anfrage keine `spalte` nennt, dann liegt #7 oben in „Eingang“ als erster Spalte von „fabrik“.
- [ ] Gegeben derselbe Ausgang, wenn die Anfrage kein `board` nennt, dann liegt #7 wieder in „Fertig“, wohin das Zurückholen sie legt.
- [ ] **Fehlfall Grenze:** Gegeben „Eingang“ hat die Grenze 2 und trägt #5 und #6, wenn `bot` mit `key: "k4"`, `board: "fabrik"` anlegt, dann antwortet kanbanD `409` `{fehler: "Grenze erreicht", spalte: "Eingang", grenze: 2, anzahl: 2}`, #7 bleibt archiviert, und es gibt keinen Commit. Schickt `st` denselben Aufruf, wird #7 mit `200` ohne Warnung wieder geöffnet.
- [ ] **Eigentümer** (vorbehaltlich Offene Frage 1): Gegeben „Fertig“ gehört Menschen, wenn `bot` #7 wie oben wieder öffnet, dann antwortet kanbanD `200`; das Hineinlegen in eine Spalte, die Menschen gehört, ist wie in R00097 erlaubt.

### Unveränderlich
- [ ] Gegeben #7 trägt `key: k4`, wenn `PATCH /api/aufgaben/7 {key: "x"}` ankommt, dann antwortet kanbanD `400` „Schlüssel ist nicht änderbar“, die Datei ist unverändert, und es gibt keinen Commit. Dasselbe gilt für `{key: "k4"}`, für `{key: null}` und über `PATCH /api/aufgaben/mehrere`.
- [ ] Gegeben #7 trägt `key: k4`, wenn `st` #7 im Browser öffnet, dann zeigt das Aufgabenfenster die Zeile „Schlüssel“ mit dem Text `k4` ohne Eingabefeld.
- [ ] **Leerfall:** Gegeben #8 hat keinen Schlüssel, wenn `st` #8 öffnet, dann zeigt das Aufgabenfenster keine Zeile „Schlüssel“.

### Filter und Dubletten
- [ ] Gegeben #7 trägt `key: k4` und ist offen, wenn `GET /api/aufgaben?key=k4` ankommt, dann ist die Antwort [#7]; nach dem Archivieren von #7 ist sie [], mit `&archivierte=ja` wieder [#7].
- [ ] Gegeben #7 trägt `k4` und #9 trägt `k9`, wenn `?key=k4&key=k9` ankommt, dann ist die Antwort [#7, #9]; `?key=K4` liefert [].
- [ ] **Leerfall:** Wenn `?key=` ohne Wert ankommt, dann ist die Antwort [] ohne `400` (wie bei `label`, R00095).
- [ ] **Fehlfall Dublette:** Gegeben #8 und #9 tragen beide `key: k5` (von Hand oder durch einen Merge), wenn `?key=k5` ankommt, dann ist die Antwort [#8, #9]; wenn `bot` mit `key: "k5"` anlegt, dann antwortet kanbanD `409` „Schlüssel „k5“ mehrfach vergeben: #8, #9“ ohne Commit; `GET /api/zustand` nennt die Dublette `k5` mit #8 und #9.

### Beschreibung
- [ ] `/api`, `/api/endpunkte` und `/api/openapi.json` nennen bei `POST /api/aufgaben` und `/api/aufgaben/mehrere` das Feld `key`, `201` gegen `200`, das Feld `neu`, das Wiederöffnen und beide `409`, bei `PATCH /api/aufgaben` die `400` für `key`, bei `GET /api/aufgaben` den Parameter `key` und bei `GET /api/zustand` die Dubletten.

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
**Integration:** alle Kriterien unter „Anlegen“, „Wiederöffnen“ und „Filter und Dubletten“ gegen einen echten Ordner mit `git log`, dazu der gleichzeitige Aufruf deterministisch: der erste Aufruf hält die Sperre zwischen Suchen und Schreiben (Haken oder Zwischenstufe direkt aufgerufen), während der zweite anläuft; Threads mit Barrier allein genügen nicht.
**E2E:** Das Aufgabenfenster zeigt den Schlüssel nur lesbar (US-4).

## Abhängigkeiten
- Abhängig von: R00092 (Filter), R00096 (Grenze beim Wiederöffnen), R00097 (Eigentümer beim Wiederöffnen)
- Blockiert: R00099 (Befund erledigt sich)

## Offene Fragen
- Archivfall entschieden am 2026-10-31: wieder öffnen.
1. **Eigentümer beim Wiederöffnen** (offen, an den PO): Liegt die archivierte Karte in einer Spalte, die Menschen gehört (etwa „Fertig“), und nennt der Sensor ein `board`, nimmt das Wiederöffnen sie dort heraus. Gilt dafür die Entnahmeregel aus R00097? Empfehlung: nein — die Karte ist abgeschlossen und nicht in Arbeit; mit `403` bliebe ein Rückfall für den Sensor unsichtbar. Bei „ja“ antwortet kanbanD `403` „Verboten“ ohne Commit.
2. **Antwortform** (offen, an den PO): Empfehlung `neu` als zusätzliches Feld je Element der heutigen Antwort (rückwärtsverträglich) und für `…/mehrere` `201`, sobald ein Eintrag neu ist, sonst `200`.

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

**Ergänzung 2026-11-05 (`/anforderung abschliessen`, planer):** Akzeptanzkriterien als Gegeben/Wenn/Dann mit Werten umgeschrieben, Grenz-, Leer- und Fehlfälle ergänzt (ungültiger Schlüssel, Groß- und Kleinschreibung, Trimmen, leerer Filter, Grenze beim Wiederöffnen, `PATCH` mit gleichem Wert); Regel für ungültige Schlüssel und Antwortform in die funktionalen Anforderungen übernommen; Probe für gleichzeitige Aufrufe deterministisch; zwei offene Fragen an den PO. User Story um US-5 und US-6 ergänzt. Code-Stand 2026-11-05: nichts davon gebaut.
