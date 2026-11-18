---
id: R00197
status: Neu
datum: 2026-11-18
ursprung: Bug-Report
ursprungslauf: R00195
---

# R00197: Behebung — Meldung bei fehlender Klasse nennt wieder „steht nicht in kanbanD.md“, wo die Vorgabe gilt

## Beschreibung

Herkunft: Karte #202 (Vorrang, Befund des legacy-reviewer an #200). Seit [R00195](R00195-klassen-und-farben-je-board-mit-vorgabe-des-ordners.md) weist kanbanD eine nirgends geführte Klasse auf einem Board **ohne eigenen Satz** mit „Klasse „vorrang“ gibt es auf dem Board „b“ nicht — dort gilt: …“ ab, obwohl dort die [Vorgabe des Ordners](../Dokumentation/Domaenenwissen/D00011-vorgabe-des-ordners.md) aus `kanbanD.md` gilt. Der Agenten-Client der Software-Factory (`werkzeuge/board.py:379`) legt eine fehlende Klasse nur an, wenn die Meldung „steht nicht in kanbanD.md“ enthält; `karte-neu --klasse vorrang` scheitert seither auf jedem Ordner ohne `vorrang`.

**Ursache (am Code gelesen, Stand 2026-11-18, nicht gefahren):** `Klassengeltung` merkt sich je Board nur Slug und Schlüssel des [Klassenvorrats](../Dokumentation/Domaenenwissen/D00010-klassenvorrat.md) (`src/modell/board.rs:360`), nicht, ob der Vorrat der eigene Satz oder die Vorgabe ist. `pruefen` (`:364–372`) nennt den Wortteil deshalb nur noch für eine Aufgabe auf keinem Board (`:368`); jedes Board, auch eines mit der Vorgabe, läuft in die Zweige `:370` und `:371`.

**Erwartet** ([ADR-0031 N2](../Dokumentation/ADRs/0031-klassen-je-board-mit-vorgabe-des-ordners.md)): Der Wortteil „steht nicht in kanbanD.md“ steht **genau dann** in der Meldung, wenn ein Eintrag in `kanbanD.md` die Anfrage gültig machen würde — die Aufgabe liegt auf keinem Board, oder mindestens eines ihrer Boards hat keinen eigenen Satz. Führen alle Boards der Aufgabe einen eigenen Satz (auch `classes: {}`), fehlt der Wortteil, und die Meldung nennt Board und Schlüssel wie in R00195 AK 4. Gilt für `POST` und `PATCH /api/aufgaben`; Status 400 und Form `{fehler}` bleiben.

Zahlt ein auf: [Vision](R00000-vision.md) — Agenten arbeiten über die API am selben Board wie Menschen.

## Akzeptanzkriterien

**Ausgangslage:** Ein Ordner, dessen `kanbanD.md` die Klassen `sicherheit` und `eol` führt, `vorrang` nicht. Board `b` ohne `classes`; Board `c` mit eigenem Satz (`phase1`, ohne `vorrang`); Board `leer` mit `classes: {}`. Aufgabe #1 nur auf `b`, #2 nur auf `c`, #3 auf `b` und `c`, #4 nur auf `leer`, #5 auf keinem Board. „Der Wortteil“ ist wörtlich `steht nicht in kanbanD.md`.

- [ ] **AK 1 Board mit der Vorgabe (Abnahme-Probe der Karte):** `POST /api/aufgaben {titel: "x", board: "b", spalte: <erste>, klasse: "vorrang"}` → 400, `fehler` enthält den Wortteil (darf zusätzlich das Board nennen). Variante: `PATCH /api/aufgaben/1 {klasse: "vorrang"}` → gleich. Heute rot: beide Meldungen lauten „… gibt es auf dem Board „b“ nicht — dort gilt: sicherheit, eol“.
- [ ] **AK 2 Gegenprobe eigener Satz, auch der leere:** `POST` mit `board: "c"` und `PATCH /api/aufgaben/2 {klasse: "vorrang"}` → 400, `fehler` enthält den Wortteil **nicht** und nennt `c` und `vorrang` (R00195 AK 4). Dasselbe mit `board: "leer"` und `PATCH /api/aufgaben/4`: ohne Wortteil, nennt `leer` und `vorrang`.
- [ ] **AK 3 Mischfall und kein Board:** `PATCH /api/aufgaben/3 {klasse: "vorrang"}` (ein Board mit Vorgabe, eines mit eigenem Satz) → 400 **mit** dem Wortteil. `PATCH /api/aufgaben/5 {klasse: "vorrang"}` → 400 mit dem Wortteil wie bisher. Hat `b` ebenfalls einen eigenen Satz ohne `vorrang`, antwortet #3 ohne den Wortteil und nennt `b`, `c` und `vorrang`.
- [ ] **AK 4 Ende-zu-Ende mit dem Agenten-Client:** `python3 /home/shoff/Projekte/Software-Factory/werkzeuge/board.py … karte-neu … --klasse vorrang` gegen eine Instanz auf einer Kopie eines Ordners ohne `vorrang` (Board der Konfiguration ohne `classes`) → Karte angelegt, `vorrang` steht danach in `kanbanD.md`. Heute rot: der Aufruf endet mit der 400-Meldung, keine Karte.
- [ ] **AK 5 Bestand:** Was vorher gültig war, bleibt gültig (`sicherheit` auf `b`, `phase1` auf `c` und auf #3 → 2xx); die Tests zu R00195 AK 4 laufen grün, angepasst nur dort, wo sie den alten Wortlaut für ein Board mit Vorgabe festhalten. Keine abgewiesene Anfrage erzeugt einen Commit.

## Tests

Unit zuerst an `Klassengeltung::pruefen` (heute rot für `nur_wartung`: Wortteil fehlt), als Tabelle über die Fälle kein Board · Vorgabe · eigener Satz · leerer Satz · Vorgabe + eigener Satz · zwei eigene Sätze. Danach API-Test je `POST` und `PATCH` in `tests/klassen_je_board.rs` (AK 1–3). AK 4 als Probe am gestarteten Programm mit dem echten `board.py` auf einer Ordnerkopie. Mutanten, die rot werden müssen: Wortteil immer · Wortteil nur ohne Board (heutiger Stand) · Mischfall zählt als „alle eigen“.

## Implementierungshinweise

- Wie `Klassengeltung` die Herkunft des Vorrats je Board trägt, entscheidet der entwickler (ADR-0031 N2, „Grenze“). Der Wortteil steht an **einer** Stelle im Code mit Verweis auf N2; der übrige Wortlaut ist frei.
- Aufrufer: `src/dienst/aufgabe_anlegen.rs:140`, `src/dienst/aufgabe_aendern.rs:7–8`; Mehrfach-Anlegen und Duplizieren laufen über denselben Weg und folgen mit.
- **Nicht hinein:** ein Fehlercode oder Feld im Rumpf (ADR-0031 N2) · Änderungen an `werkzeuge/board.py` (fremdes Repository, nur als Probe aufrufen) · Meldungen der Oberfläche.
- Optionen: entfällt — der Lösungsraum ist durch ADR-0031 N2 entschieden, der Fix ist lokal.

## Warum löst diese Anforderung das Problem?

Auslöser: Die Factory legt eine Vorrang-Karte auf einem Board an, dessen Ordner `vorrang` noch nicht führt. Nennt die Abweisung wieder den Wortteil, wo ein Eintrag in `kanbanD.md` hilft (X), erkennt der Agenten-Client den Fall, trägt die Klasse ein und wiederholt die Anfrage (Y); die Karte entsteht ohne Handgriff eines Menschen (Z). Wo ein Eintrag in `kanbanD.md` nichts ändern würde (alle Boards mit eigenem Satz), bleibt der Wortteil weg, und der Client schreibt nicht vergeblich in die Vorgabe.

## Offene Fragen

Keine.

## Notizen

- Priorität: Hoch (Vorrang-Karte). Betroffen: jeder Agenten-Client, der am Wortteil hängt. Workaround: `vorrang` vorab in `kanbanD.md` eintragen.
