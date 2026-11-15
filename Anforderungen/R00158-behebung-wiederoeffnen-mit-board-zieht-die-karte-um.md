---
id: R00158
status: Neu
datum: 2026-11-15
ursprung: Bug-Report
ursprungslauf: R00098
---

# R00158: Behebung — Wiederöffnen mit `board` lässt die Karte auf dem alten Board liegen

## Beschreibung

Öffnet ein Sensor eine archivierte Karte über ihren Schlüssel (`key`) wieder und nennt dabei ein **anderes** Board als das, auf dem die Karte liegt, kommt die Karte oben in die Spalte des genannten Boards — ihre Zeile auf dem alten Board bleibt aber stehen. Die wieder geöffnete Karte liegt danach offen auf zwei Boards zugleich: auf dem Zielboard im „Eingang“ und auf dem alten Board in „Fertig“, wo sie wieder zählt.

Reproduzierbar (am Code gelesen, noch nicht gefahren — die erste Bubble misst es): #7 liegt archiviert in „Fertig“ auf `fabrik`; `POST /api/aufgaben` mit `{"titel": "x", "key": "k4", "board": "zweit", "spalte": "Eingang"}` → heute 200, #7 steht oben in „Eingang“ von `zweit` **und** weiter in „Fertig“ von `fabrik`; der Commit trägt die Aufgabendatei und `boards/zweit.md`, nicht `boards/fabrik.md`. Erwartet: 200, #7 liegt nur auf `zweit`, der eine Commit trägt die Aufgabendatei und beide Board-Dateien.

Herkunft: Karte #45 (aus dem Code-Review von #4). Entscheidung des Betreibers vom 2026-11-13 (Kartenkommentar): die alte Board-Zeile wird entfernt, im selben Commit wie die neue. Entscheidungen des product-owner vom 2026-11-15 (`AI-Team/po-entscheidungen.md`, #45 A1–A6): enge Lesart — die Regel gilt **nur** für das Wiederöffnen mit `board`; eigene Interaction mit eigener Bug-Anforderung, R00098 bleibt abgenommen und unverändert.

**Umfang:** nur das Wiederöffnen einer archivierten Karte über `key` mit `board` in `POST /api/aufgaben` und `POST /api/aufgaben/mehrere`.

Zahlt ein auf: [Vision](R00000-vision.md) — „Git ist das Gedächtnis“ (eine Aktion, ein Commit), „Live überall“ und die Agenten-Schnittstelle, über die ein Befund genau eine Karte an genau einem Ort hat. „Dieselbe Aufgabe darf auf mehreren Boards liegen“ (Vision, „Mehrere Boards über einem Aufgabenbestand“) bleibt gültig: diese Anforderung führt keine allgemeine Regel „genau ein Board“ ein.

## Ursachenanalyse

### Root Cause

Belegt am Stand `karte/45` (`main` `54cbe00`) vom 2026-11-15, Einzelheiten in [ADR-0005 Nachtrag N3](../Dokumentation/ADRs/0005-zusammengesetzte-aktionen-in-einem-commit.md), Abschnitt „Belegt (Code)“:

- Wiederöffnen läuft im Anlegeweg: `anlegen_gesperrt` (`src/dienst/aufgabe_anlegen.rs:122`) findet den Schlüssel an einer archivierten Karte (`:145`), `wieder_geoeffnet` (`:285`) nimmt `archived` zurück und kommentiert.
- `schreiben` (`:191`) liest **nur** das Board der Anfrage (`:205`), legt die Karte dort mit `Board::oben_einordnen` oben ein (`:214`) und ruft einmal `aktion()` (`:228`).
- `oben_einordnen` (`src/modell/board.rs:388`) nimmt die Karte nur aus den Spalten **dieses** Boards (`abnehmen`, `:400`); die Dateien der übrigen Boards fasst niemand an.
- Archivieren entfernt Board-Zeilen nie (`src/dienst/archiv.rs:7`): die archivierte Karte steht weiter in der Datei ihres alten Boards und zählt dort nach dem Wiederöffnen wieder.
- Der Bestand weiß das: `rueckkehr_pruefen` (`src/dienst/aufgabe_anlegen.rs:233`) zählt die Karte auf den übrigen Boards wieder mit (409 für Agenten); `tests/fremdschluessel.rs:477` hält es fest.

Ausgeschlossen: das Wiederöffnen auf demselben Board (`oben_einordnen` nimmt die Karte dort aus jeder anderen Spalte, R00098 abgenommen) und das Wiederöffnen ohne `board` (kein Board-Schritt, gewollt).

**Lücke:** die Kette ist am Code gelesen, nicht mit einem Lauf nachgestellt. Die Abnahme-Probe (AK 1) ist der Nachweis; ihre Antwort und der Inhalt des Commits vor dem Fix werden gemessen und im Commit der ersten Bubble genannt.

### Betroffene Komponenten

- `src/dienst/aufgabe_anlegen.rs` — `schreiben` und `rueckkehr_pruefen` (A00004 Dienste; Schreibweg X00001).
- `src/web/endpunkte.rs`, `src/web/mod.rs` — die Beschreibung der beiden Endpunkte.
- Tests: `tests/fremdschluessel.rs` (eine geänderte Erwartung, AK 11), neue Integrationstests daneben; eine E2E-Probe für AK 10.
- Nicht betroffen: `src/modell/board.rs` (`abnehmen` liegt frei), `src/dienst/zuordnung.rs`, `src/dienst/archiv.rs`, `web/`.

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0005 Nachtrag N3 (Akzeptiert, Option A), Punkte 1–7:

1. **Wiederöffnen mit `board` ist ein Umzug.** Nach der Aktion liegt die wieder geöffnete Karte auf genau dem Board der Anfrage; ihre Zeile verschwindet aus jedem anderen Board des Ordners — auch aus einem archivierten Board, auch wenn sie dort mehrfach steht. Ohne `board` bleibt alles wie bisher.
2. **Die Regel gilt für diesen Weg, nicht für das Modell.** Auflegen, Bewegen, Archivieren, Zurückholen und das Wiederöffnen ohne `board` ändern sich nicht.
3. **Ein Commit, ein `aktion()`.** `schreiben` nimmt die Karte im Speicher per `Board::abnehmen` von jedem anderen Board und hängt je verlassenem Board einen Schreib-Schritt an dasselbe `aktion()` (Muster `endgueltig_loeschen`, `src/dienst/archiv.rs:54–60`). Jede Board-Datei kommt genau einmal vor, auch bei `…/mehrere`.
4. **Defekte Board-Datei ⇒ 423, nichts geschrieben** — für Mensch und Agent, und nur auf diesem Weg.
5. **Keine Entnahmesperre an den verlassenen Boards** (keine 403), weder aus einer Menschen-Spalte noch bei board-weiter Sperre.
6. **Grenzen:** geprüft wird das Zielboard wie bisher; `rueckkehr_pruefen` gilt nur noch ohne `board`.
7. **Die Commit-Nachricht bleibt** „#n erneut gefunden: wieder geöffnet“.

### Wortlaut (entschieden, product-owner 2026-11-15)

- **Meldung der 423** (Feld `fehler`), bestehender Wortlaut unverändert (`src/dienst/zugregeln.rs:109`): `boards/<slug>.md: <Grund> — nur lesbar, bis die Datei repariert ist`. `<Grund>` ist der Text, den `GET /api/zustand` unter `defekte` für diese Datei als `fehler` nennt.
- **Satz der API-Beschreibung**: „Nennt die Anfrage `board`, zieht die wieder geöffnete Karte auf dieses Board um: ihre Zeile verschwindet im selben Commit aus jedem anderen Board.“
- **Commit-Nachricht**: unverändert „#n erneut gefunden: wieder geöffnet“; sie nennt die verlassenen Boards nicht.

### Alternative Ansätze

Verworfen in ADR-0005 N3 (Tabelle „Optionen“, „Verworfen“):

- B `von_board_nehmen` wiederverwenden: zwei Commits oder Umbau einer selbst sperrenden Hülle; die 403 widerspräche R00098 („kein Herausnehmen“).
- C mit 409 abweisen, solange die Karte auf einem anderen Board liegt: widerspricht der Entscheidung des Betreibers; jeder Sensor müsste erst aufräumen.
- Clientseitig erst `DELETE …/boards/{slug}/aufgaben/{nr}`, dann anlegen: zwei Commits, dazwischen ein fremder Zug.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Integrationstest im echten Programm (`tests/`, Muster `befund_kehrt_zurueck_in_einem_commit`, `tests/fremdschluessel.rs:188`; Helfer `behoben`, `voll`, `menschenspalten`, `alles`): AK 1 als erster Test. **Rot ohne Fix** (erwartet: 200, aber #7 steht weiter in „Fertig“ von `fabrik`, und der Commit trägt `boards/fabrik.md` nicht); das Gemessene steht im Commit.

### Code-Extraktion für isoliertes Testing

Keine nötig: der Kern `Board::abnehmen` ist eine reine Methode und getestet. Welche Boards eine Karte verlassen muss (Boardliste ohne das Zielboard, je Board höchstens ein Schritt) lässt sich als reine Funktion im Dienst fassen und für sich testen; den Zuschnitt entscheidet der Entwickler.

### Regressionstests

- `tests/fremdschluessel.rs` bleibt grün mit **genau einer** geänderten Erwartung (AK 11).
- Die Rückkehr-Grenze ohne `board` bleibt gedeckt: `grenze_der_alten_spalte_ohne_board` (`tests/fremdschluessel.rs:281`).
- Das Wiederöffnen aus einer Menschen-Spalte desselben Boards bleibt gedeckt: `agent_oeffnet_aus_menschenspalte` (`:314`).
- Festgehalten, nicht geändert: Auflegen, Bewegen, Archivieren, Zurückholen, `DELETE …/boards/{slug}/aufgaben/{nr}` (403 für Agenten aus einer Menschen-Spalte).

## Akzeptanzkriterien

**Grundbestand** (herstellbar mit `behoben` aus `tests/fremdschluessel.rs`, Start mit `--port 0`): eingerichteter Ordner, `cl` ist Agent (der Sensor), `st` Mensch. Board `fabrik` mit den Spalten „Eingang“ (darin die offene Karte #3), „In Arbeit“ und „Fertig“; #7 „Fund“ mit `key: k4` ist archiviert (`archived: 2026-10-21`) und steht in „Fertig“ von `fabrik`. Dazu das Board `zweit` (`boards/zweit.md`) mit der Spalte „Eingang“, darin die offene Karte #5. Jede Anfrage trägt `X-KanbanD-Wer: cl`, wo nicht anders gesagt. Weitere Boards und Zeilen, die ein Kriterium nennt, werden vor dem Start von Hand in die Board-Dateien geschrieben und mit `git commit` committet.

**Die Umzugsanfrage** ist `POST /api/aufgaben` mit `{"titel": "x", "key": "k4", "board": "zweit", "spalte": "Eingang"}`.

**Nichts geschrieben** (gilt für jedes Kriterium, das so sagt): `git rev-parse HEAD` und alle Dateien unter `boards/` und `aufgaben/` sind vor und nach der Anfrage gleich (Helfer `alles`), `git status --porcelain` ist leer; #7 trägt weiter `archived: 2026-10-21`.

**Dateien des Commits** heißt: die Ausgabe von `git show --name-only --format= HEAD`, als Menge.

### Bug behoben (Kriterien des product-owner, wörtlich 1–12, je mit Beispiel)

- [ ] **AK 1 Umzug (Abnahme-Probe der Karte):** #7 archiviert in „Fertig“ auf `fabrik`, Anlegen mit `key`, `board: "zweit"`, `spalte: "Eingang"` ergibt 200. #7 liegt oben in „Eingang“ von `zweit` und in keiner Spalte von `fabrik`. Genau ein Commit mit Aufgabendatei und beiden Board-Dateien, Arbeitsbaum sauber.
  - Beispiel: Gegeben der Grundbestand. Wenn die Umzugsanfrage gesendet wird, dann antwortet kanbanD mit 200, `nummer: 7`, `neu: false`; „Eingang“ von `zweit` führt #7 vor #5; `boards/fabrik.md` nennt #7 in keiner Spalte, #3 steht weiter in „Eingang“; es gibt genau einen neuen Commit, seine Dateien sind `aufgaben/0007-fund.md`, `boards/fabrik.md` und `boards/zweit.md`; `git status --porcelain` ist leer. Heute (gelesen): 200, #7 steht zusätzlich weiter in „Fertig“ von `fabrik`, der Commit trägt `boards/fabrik.md` nicht.
- [ ] **AK 2 Mehrfach und mehrere Boards:** Liegt die Karte mehrfach im alten Board oder auf mehreren alten Boards, gehen alle Vorkommen; ein unbeteiligtes Board bleibt bytegleich.
  - Beispiel: Gegeben der Grundbestand; #7 steht auf `fabrik` zusätzlich in „In Arbeit“ (also zweimal), auf dem Board `privat` in „Heute“, und es gibt das Board `drittes` mit #3 in „Offen“. Wenn die Umzugsanfrage gesendet wird, dann 200; #7 steht nur noch in „Eingang“ von `zweit` — in keiner Spalte von `fabrik` und in keiner von `privat`; die Dateien des Commits sind `aufgaben/0007-fund.md`, `boards/fabrik.md`, `boards/privat.md`, `boards/zweit.md`; `boards/drittes.md` ist bytegleich und steht nicht im Commit.
- [ ] **AK 3 Zielboard gleich altem Board:** wie R00098; liegt die Karte zusätzlich auf weiteren Boards, gehen diese Zeilen.
  - Beispiel: Gegeben der Grundbestand; #7 steht zusätzlich auf `privat` in „Heute“. Wenn `POST /api/aufgaben` mit `{"titel": "x", "key": "k4", "board": "fabrik", "spalte": "Eingang"}` gesendet wird, dann 200; „Eingang“ von `fabrik` führt #7 vor #3, „Fertig“ ist leer; `privat` nennt #7 nicht mehr; die Dateien des Commits sind `aufgaben/0007-fund.md`, `boards/fabrik.md`, `boards/privat.md`.
  - Leerfall (wie R00098): liegt #7 nur auf `fabrik`, trägt der Commit `aufgaben/0007-fund.md` und `boards/fabrik.md` und sonst keine Board-Datei.
- [ ] **AK 4 Ohne `board`:** alles wie heute, die Karte bleibt auf allen Boards.
  - Beispiel: Gegeben der Grundbestand; #7 steht zusätzlich auf `privat` in „Heute“. Wenn `POST /api/aufgaben` mit `{"titel": "x", "key": "k4"}` gesendet wird, dann 200; #7 ist nicht mehr archiviert, steht weiter in „Fertig“ von `fabrik` und in „Heute“ von `privat`; `boards/fabrik.md`, `boards/privat.md` und `boards/zweit.md` sind bytegleich; die Dateien des Commits sind genau `aufgaben/0007-fund.md`.
- [ ] **AK 5 Altes Board archiviert oder gelöscht:** Altes Board archiviert: die Zeile geht auch dort. Altes Board gelöscht: 200 ohne Fehler.
  - Archiviert: Gegeben der Grundbestand; `boards/fabrik.md` trägt im Frontmatter `archived: 2026-11-01`. Wenn die Umzugsanfrage gesendet wird, dann 200; #7 steht oben in „Eingang“ von `zweit` und in keiner Spalte von `fabrik`; `boards/fabrik.md` trägt weiter `archived: 2026-11-01` und #3 in „Eingang“.
  - Gelöscht: Gegeben der Grundbestand; `boards/fabrik.md` ist vor dem Start mit `git rm` entfernt und committet — #7 liegt auf keinem Board. Wenn die Umzugsanfrage gesendet wird, dann 200 mit `nummer: 7`; #7 steht oben in „Eingang“ von `zweit`; die Dateien des Commits sind `aufgaben/0007-fund.md` und `boards/zweit.md`.
- [ ] **AK 6 Defekte Board-Datei:** Defekte Board-Datei im Ordner: Wiederöffnen mit `board` ergibt 423 für Mensch und Agent mit dem bestehenden Wortlaut „boards/<slug>.md: <Grund> — nur lesbar, bis die Datei repariert ist“, nichts geschrieben. In derselben Lage laufen wie heute: Anlegen mit unbekanntem Schlüssel (201), Schlüssel an einer offenen Karte (200 ohne Commit), Wiederöffnen ohne `board`.
  - Beispiel: Gegeben der Grundbestand und die von Hand angelegte, committete Datei `boards/kaputt.md` mit dem Inhalt `# Kaputt`, Leerzeile, `## A`, Leerzeile, `## A` (die Spalte steht doppelt). Wenn die Umzugsanfrage gesendet wird — von `cl` und ebenso von `st` —, dann 423 mit `{"fehler": "boards/kaputt.md: Spalte „A“ steht doppelt in der Board-Datei — nur lesbar, bis die Datei repariert ist"}` (Grund am Code gelesen, `src/format/board.rs:52`); nichts geschrieben.
  - `…/mehrere` als Ganzes: `POST /api/aufgaben/mehrere` mit `{"titel": [{"titel": "Neu", "key": "k8"}, {"titel": "x", "key": "k4"}], "board": "zweit"}` → 423 in derselben Form; nichts geschrieben, auch die Aufgabe mit `k8` ist nicht angelegt.
  - Nur dieser Weg, in derselben Lage je auf frischem Bestand: (a) `{"titel": "Neu", "key": "k8", "board": "zweit"}` → 201 mit `neu: true` und einem Commit; (b) dieselbe Anfrage ein zweites Mal → 200 mit `neu: false`, kein neuer Commit; (c) `{"titel": "x", "key": "k4"}` ohne `board` → 200, #7 ist wieder offen und steht weiter in „Fertig“ von `fabrik`.
- [ ] **AK 7 Grenze am Ziel:** Agent 409, auch die alte Zeile bleibt, kein Commit; der Mensch wird durchgelassen wie heute.
  - Beispiel: Gegeben der Grundbestand; `boards/zweit.md` trägt die Grenze `limits:` / `Eingang: 1` (#5 liegt dort, die Spalte ist voll: 1 von 1). Wenn `cl` die Umzugsanfrage sendet, dann 409 mit `{"fehler": "Grenze erreicht", "spalte": "Eingang", "grenze": 1, "anzahl": 1}`; nichts geschrieben — #7 steht weiter in „Fertig“ von `fabrik`. Wenn `st` dieselbe Anfrage sendet, dann 200 ohne `warnungen`, und der Umzug ist vollzogen wie in AK 1 („Eingang“ von `zweit` führt #7 vor #5, zwei Karten bei Grenze 1).
- [ ] **AK 8 Keine 403 an verlassenen Boards:** weder aus einer Menschen-Spalte noch bei board-weiter Sperre (R00120).
  - Menschen-Spalte: Gegeben der Grundbestand; `boards/fabrik.md` trägt `column-owner:` / `Fertig: human`. Wenn `cl` die Umzugsanfrage sendet, dann 200 mit dem Umzug wie in AK 1, nicht 403; `boards/fabrik.md` trägt weiter `Fertig: human`.
  - Board-weite Sperre: Gegeben der Grundbestand; `boards/fabrik.md` trägt den verwaisten Eintrag `column-owner:` / `fertig: human` (die Spalte heißt „Fertig“; R00120 FA 1 sperrt damit das ganze Board für Agenten). Wenn `cl` die Umzugsanfrage sendet, dann 200 mit dem Umzug wie in AK 1, nicht 403; der Eintrag `fertig: human` steht danach weiter in `boards/fabrik.md`.
- [ ] **AK 9 `…/mehrere` mit Karten von verschiedenen Boards:** ein Commit, jede Board-Datei genau einmal.
  - Beispiel: Gegeben der Grundbestand; dazu #8 „Zweiter Fund“ mit `key: k8`, archiviert, in „Fertig“ von `fabrik` **und** in „Heute“ von `privat`. Wenn `POST /api/aufgaben/mehrere` mit `{"titel": [{"titel": "x", "key": "k4"}, {"titel": "y", "key": "k8"}], "board": "zweit", "spalte": "Eingang"}` gesendet wird, dann 200 (nicht 500); #7 und #8 stehen in „Eingang“ von `zweit` vor #5 und auf keinem anderen Board; es gibt genau einen neuen Commit, und seine Dateien sind — jede genau einmal — `aufgaben/0007-fund.md`, die Aufgabendatei von #8, `boards/fabrik.md`, `boards/privat.md`, `boards/zweit.md`. (`fabrik` verlassen zwei Karten: ein Schritt je Board-Datei, nicht je Karte.)
- [ ] **AK 10 Live:** Offene Sichten beider Boards zeigen den Umzug ohne Reload; ein Live-Ereignis nennt beide Board-Dateien.
  - Ereignis: Gegeben der Grundbestand und ein offener Strom `GET /api/ereignisse`. Wenn die Umzugsanfrage gesendet wird, dann trägt **ein** Ereignis des Stroms in `pfade` sowohl `boards/fabrik.md` als auch `boards/zweit.md`.
  - Sichten: Gegeben der Grundbestand und zwei offene Browserfenster, eines auf dem Board `fabrik`, eines auf `zweit`. Wenn die Umzugsanfrage über die API gesendet wird, dann zeigt das Fenster von `zweit` #7 oben in „Eingang“, und das Fenster von `fabrik` zeigt #7 in keiner Spalte — beides ohne Neuladen der Seite. Heute (gelesen): #7 erschiene im Fenster von `fabrik` offen in „Fertig“.
- [ ] **AK 11 Geänderte Erwartung:** `tests/fremdschluessel.rs`, Test `grenze_auf_dem_zweiten_board_beim_wiederoeffnen` (Z. 477): Erwartung wird 200, Karte auf `zweit`, nicht mehr in „Fertig“ von `fabrik`. Das Kriterium „keine neuen Fehler“ (AK 16) nennt ihn als einzige geänderte Erwartung. Die Rückkehr-Grenze (409) bleibt für das Wiederöffnen ohne `board` durch einen Test gedeckt.
  - Lage des Tests: „Fertig“ von `fabrik` hat die Grenze 1 und ist mit #5 voll, #7 steht archiviert daneben; die Anfrage nennt `board: "zweit"`. Heute 409 `{"fehler": "Grenze erreicht", "spalte": "Fertig", "grenze": 1, "anzahl": 1}`; künftig 200, #7 in „Eingang“ von `zweit`, „Fertig“ von `fabrik` führt nur noch #5.
  - Rückkehr-Grenze: dieselbe Lage, Anfrage `{"titel": "x", "key": "k4"}` ohne `board` → für `cl` weiter 409 mit `spalte: "Fertig"`, nichts geschrieben (heute gedeckt durch `grenze_der_alten_spalte_ohne_board`, `tests/fremdschluessel.rs:281`; der Test bleibt ohne geänderte Erwartung grün).
- [ ] **AK 12 Beschreibung:** `/api`, `/api/endpunkte` und OpenAPI nennen beim Wiederöffnen wörtlich: „Nennt die Anfrage `board`, zieht die wieder geöffnete Karte auf dieses Board um: ihre Zeile verschwindet im selben Commit aus jedem anderen Board.“
  - Prüfbar: `GET /api` (Seite), `GET /api/endpunkte` (Feld `zweck`) und `GET /api/openapi.json` (Feld `description`) tragen den Satz bei `POST /api/aufgaben`; bei `POST /api/aufgaben/mehrere` gilt er über den dortigen Verweis „key wie beim Einzelanlegen“ oder steht ebenfalls wörtlich da (Offene Frage 3).

### Unverändert (Sätze des product-owner, prüfbar gemacht)

- [ ] **AK 13 Ordnung der Abweisungen unverändert (400, 404, 423, 409):** Gegeben der Grundbestand und `boards/kaputt.md` aus AK 6.
  - 400 vor 423: `{"titel": "x", "key": "", "board": "zweit"}` → 400 „Schlüssel: 1–200 Zeichen ohne Zeilenumbruch“; `{"titel": "x", "key": "k4", "board": "zweit", "spalte": "Nirgends"}` → 400 „Spalte „Nirgends“ gibt es auf „zweit“ nicht“.
  - 404 vor 423: `{"titel": "x", "key": "k4", "board": "gibtsnicht"}` → 404 „Board „gibtsnicht“ gibt es nicht“.
  - 423 vor 409: zusätzlich ist „Eingang“ von `zweit` voll wie in AK 7; `cl` sendet die Umzugsanfrage → 423 mit `boards/kaputt.md` in der Meldung, nicht 409.
  - In allen vier Fällen ist nichts geschrieben.
- [ ] **AK 14 Commit-Nachricht unverändert:** nach dem Umzug aus AK 1 liefert `git log -1 --format=%s` „#7 erneut gefunden: wieder geöffnet“; die Nachricht nennt weder `fabrik` noch `zweit`.

### Bug-Vorlage (Pflicht)

- [ ] **AK 15 Rot ohne Fix:** Die Tests zu AK 1, 2, 3, 5 (archiviert), 6, 8, 9 und 10 sind am Stand vor dem Fix rot und mit Fix grün; der Commit der ersten Bubble nennt die gemessenen Antworten und die Dateien des Commits vor dem Fix.
- [ ] **AK 16 Keine neuen Fehler:** Die bestehende Suite (`cargo test`, `node --test`, Playwright) ist grün; die **einzige** geänderte Erwartung ist `grenze_auf_dem_zweiten_board_beim_wiederoeffnen` (`tests/fremdschluessel.rs:477`, AK 11). Jede weitere Erwartung, die sich ändern müsste, meldet der Entwickler, statt sie still zu ändern.

## Implementierungshinweise

- **Abgrenzung — nicht hinein** (product-owner 2026-11-15, wörtlich): „die allgemeine Regel ‚genau ein Board‘; Änderungen an Auflegen, Bewegen, Archivieren, Zurückholen und am Wiederöffnen ohne `board`; Aufräumen bestehender Doppellagen im Bestand; neues Feld in der Antwort; geänderte Commit-Nachricht; Oberfläche; Lastprobe; Mutanten als Akzeptanzkriterien.“
- **Technik** (ADR-0005 N3, Option A): `schreiben` liest für das Wiederöffnen mit `board` die Boardliste, nimmt jede wieder geöffnete Karte per `Board::abnehmen` von jedem Board außer dem Zielboard und hängt je **geändertem** Board genau einen Schreib-Schritt an dasselbe `aktion()`. `aktion()` weist einen doppelten Pfad mit `Fehler::Intern` ab (`src/dienst/mod.rs:193`) — daher AK 9: ein Schritt je Board-Datei, nicht je Karte, und das Zielboard nie zusätzlich als verlassenes. Wie `schreiben` die Liste liest und die Schritte ordnet, entscheidet der Entwickler.
- **Review-Punkt** (ADR-0005 N3, `architektur-reviewer`, `code-reviewer`): ein zweites `aktion()`/`committen` im Wiederöffnen, ein Aufruf einer öffentlichen, selbst sperrenden Methode aus `schreiben` (`von_board_nehmen`, `src/dienst/zuordnung.rs:56`), oder das Entfernen der Zeile auch **ohne** `board` ist ein Befund.
- **Angriffsmatrix (security-reviewer, vor dem Bau):** *noch nicht geschrieben.* Die Karte trägt `sicherheit`, weil ein Agent erstmals ohne 403 eine Zeile aus einer Menschen-Spalte eines Boards entfernt, das die Anfrage nicht nennt (AK 8, R00097/R00120). Verweis auf die Matrix: *— (trägt der Director nach der Vorprüfung nach; Kriterien, die aus der Matrix folgen, werden hier als weitere Akzeptanzkriterien aufgenommen, bevor gebaut wird)*.
- **Proben des ADR als Testmittel** (ADR-0005 N3, „Durchsetzung“): Umzug · drei Boards / mehrfach · gleiches Board, ohne `board` · defekt und „nur dieser Weg“ · Grenze am Ziel · keine 403 an verlassenen Boards · geänderte Erwartung und Rückkehr-Grenze · Nachricht. Sie decken sich mit AK 1–8, 11 und 14.
- **Mutanten sind Testmittel, keine Kriterien.** N3 nennt Proben und einen Review-Punkt, keine benannten Mutanten; die folgenden sind daraus abgeleitet (planer) und laufen im eigenen Worktree mit eigenem Build-Ziel:
  - M1: die Schritte für die verlassenen Boards entfallen → AK 1 rot.
  - M2: die Zeile geht auch ohne `board` → AK 4 rot.
  - M3: die Prüfung auf defekte Board-Dateien entfällt → AK 6 rot (200 statt 423).
  - M4: die 423 gilt für jedes Anlegen mit `board` oder `key` → AK 6 „nur dieser Weg“ rot.
  - M5: an den verlassenen Boards gilt die Entnahmesperre (`entnahme_pruefen`) → AK 8 rot (403).
  - M6: ein Schritt je Karte statt je Board-Datei, oder das Zielboard zusätzlich als verlassenes → AK 9 rot (500).
  - M7: `rueckkehr_pruefen` zählt die verlassenen Boards weiter mit → AK 11 rot (409 statt 200).
  - M8: `rueckkehr_pruefen` entfällt ganz → Rückkehr-Grenze ohne `board` rot (200 statt 409).
  - M9: 409 vor 423 → AK 13 rot.
- **AK 2, Lage „zweimal auf demselben Board“:** dass der Board-Leser eine Nummer in zwei Spalten annimmt, ist am Code gelesen (`src/format/board.rs` weist nur die doppelte Spalte und die Zeile vor der ersten Spalte ab), nicht gefahren. Liest kanbanD die Datei als defekt, meldet der Entwickler das an den architekt, statt das Beispiel still zu ändern.
- **AK 5, archiviertes Board:** der Schritt schreibt die Datei eines archivierten Boards (R00128). Gilt dort eine Schreibsperre, die `schreiben` nicht kennt, ist das eine Meldung an den architekt; entschieden ist: die Zeile geht auch dort (ADR-0005 N3 Punkt 1).
- **AK 6, defekte Dateien:** `Ordner::boards` (`src/ablage.rs:63`) liefert die defekten Dateien als zweite Liste, darunter auch Dateien mit einem Namen außerhalb der Form („Dateiname ist kein gültiger Board-Name — umbenennen“). Bei mehreren defekten Dateien nennt die Meldung die erste in der Reihenfolge des Lesens (nach Dateiname), wie `archivieren_pruefen` (`src/dienst/zugregeln.rs:107`) — Offene Frage 1. Ist das **Zielboard** selbst defekt, antwortet `Ordner::board` schon heute mit 423 (`src/ablage.rs:150`, dort am Code gelesen ohne den Nachsatz „— nur lesbar, …“) — Offene Frage 2; die Beispiele in AK 6 und AK 13 nehmen deshalb ein drittes Board.
- **AK 6, die 423 gilt für Mensch und Agent** — anders als beim Archivieren (dort nur der Agent): der Grund ist die Zusage aus AK 1, keine Sperre.
- **AK 10, Abwesenheit braucht einen Anker:** „#7 steht im Fenster von `fabrik` in keiner Spalte“ gilt vor und nach der Aktion, solange archivierte Karten auf dem Board nicht gezeichnet werden (nicht geprüft). Die Probe wartet deshalb auf ein Zeichen, dass das Fenster das Ereignis verarbeitet hat (z. B. eine danach über die API auf `fabrik` angelegte Karte erscheint), und prüft erst dann. Ohne Fix zeigt dieselbe Probe #7 offen in „Fertig“ — das ist das Rot.
- **AK 10, Maschine:** die Live-Tests hängen am Ordner-Wächter; fällt er aus (inotify „Too many open files“, `AI-Team/gelerntes.md` 2026-11-13), ist die Probe nicht auswertbar — single-threaded bzw. `--workers=1` fahren. Die E2E-Probe ändert nichts unter `web/`; zeigt sie einen Fehler der Oberfläche, ist das eine Meldung (Offene Frage 4), kein Umbau in dieser Anforderung.
- **Verlauf (ADR-0021), Hinweis für den Bau, kein Kriterium:** ob der Verlauf der Karte an den verlassenen Boards „vom Board genommen“ zeigt (`src/verlauf.rs:31`), ist ungeprüft. Der Entwickler sieht nach und nennt das Ergebnis im Bericht; die akzeptierte Schwäche des ADR („still, sichtbar nur im Verlauf und im Commit“) setzt es voraus.
- **Rundlauf der verlassenen Boards:** der Schreib-Schritt schreibt die ganze Board-Datei über `format::board::schreiben`; verwaiste `column-owner`-Einträge (R00120) und alles übrige Frontmatter bleiben erhalten (AK 5, AK 8).
- **Kein neues Feld in der Antwort:** die Antwort bleibt die Karte mit `neu: false`; die verlassenen Boards nennt sie nicht.
- Protokollierung: ADR-0001 (Logging) ist „Vorgeschlagen“ und nicht gebaut; diese Anforderung schreibt keine Protokollzeile.

## Offene Fragen

Keine, die den Bau aufhält. Umfang, die zwölf Kriterien, Wortlaut, Labels und Abgrenzung hat der product-owner am 2026-11-15 entschieden (`AI-Team/po-entscheidungen.md`, #45 A1–A6). Vom planer ausgelegt und dem product-owner zur Bestätigung vorgelegt:

1. **Mehrere defekte Board-Dateien (AK 6):** die Meldung nennt die erste in der Reihenfolge des Lesens (nach Dateiname), wie beim Archivieren; eine Datei mit ungültigem Namen zählt als defekt. Empfehlung: so bestätigen.
2. **Zielboard selbst defekt:** bleibt wie heute (423 aus `Ordner::board`, Wortlaut dort am Code gelesen ohne „— nur lesbar, bis die Datei repariert ist“) und ist kein Kriterium dieser Anforderung. Empfehlung: so lassen; der Wortlaut dort ist Vorbestand.
3. **AK 12 bei `…/mehrere`:** der Satz steht wörtlich bei `POST /api/aufgaben`; `…/mehrere` verweist heute mit „key wie beim Einzelanlegen“. Empfehlung: an beiden Endpunkten wörtlich (eine Zeile mehr, kein Verweis zu verfolgen).
4. **AK 10, Sichten:** die Probe ist eine E2E-Probe mit zwei Fenstern; `web/` ändert sich nicht. Zeigt sie, dass eine offene Sicht das Ereignis nicht zeichnet, gehört das als eigener Befund gemeldet. Empfehlung: so bestätigen.
5. **AK 13 und AK 14** machen die Sätze „Ordnung der Abweisungen unverändert“ und „Commit-Nachricht unverändert“ prüfbar; sie sind keine neuen Zusagen. Empfehlung: so bestätigen.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine. Bestehende Doppellagen im Bestand räumt diese Anforderung nicht auf (Abgrenzung).

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: ein Befund, dessen Karte #7 archiviert in „Fertig“ von `fabrik` steht, kehrt zurück, und der Sensor legt ihn mit `key` und `board: "zweit"` wieder an. Heute schreibt `schreiben` nur das Board der Anfrage, also steht #7 danach offen auf `zweit` und offen in „Fertig“ von `fabrik`, zählt dort gegen die Grenze und sieht für den Menschen wie erledigt und offen zugleich aus. Nimmt `schreiben` die Karte im selben `aktion()` von jedem anderen Board (X), dann trägt der eine Commit die Aufgabendatei, das Zielboard und jedes verlassene Board (Y), und die Karte liegt nach dem Wiederöffnen an genau dem Ort, den der Sensor genannt hat, sichtbar in beiden offenen Sichten ohne Neuladen (Z). Der Hebel sitzt im Schreibweg des Wiederöffnens und nicht beim Client: zwei Aufrufe (erst vom Board nehmen, dann anlegen) wären zwei Commits mit einem Fenster für einen fremden Zug dazwischen, und die Entnahme bekäme für einen Agenten 403. Weil die Zusage „auf keinem anderen Board“ bei einer unlesbaren Board-Datei nicht prüfbar ist, endet genau dieser Weg dann mit 423 — alle anderen Wege des Anlegens laufen weiter.

## Notizen

- Priorität: Mittel — sichtbarer Fehlzustand (Karte offen in „Fertig“ des alten Boards), erreichbar, sobald ein Sensor beim Wiederöffnen ein anderes Board nennt; kein Datenverlust.
- Betroffene Nutzer/Systeme: Agenten und Sensoren, die über `POST /api/aufgaben` oder `…/mehrere` mit `key` und `board` wieder öffnen; Menschen, die das alte Board ansehen.
- Workaround: die Zeile auf dem alten Board von Hand entfernen (`DELETE /api/boards/{slug}/aufgaben/{nr}` durch einen Menschen).
- **In Kauf genommen** (ADR-0005 N3, „Akzeptierte Schwäche“; product-owner A1): eine Karte, die ein Mensch bewusst auf zwei Boards gelegt hat, liegt nach einem Wiederöffnen mit `board` nur noch auf einem; und ein defektes Board, das mit der Karte nichts zu tun hat, hält das Wiederöffnen mit `board` auf, bis es repariert ist.
- **Herkunft:** Karte #45; Technik: ADR-0005 Nachtrag N3 (2026-11-15, `8c1244e`, `c6a5702`); Architektur-Modell A00004 Dienste, Aspekt X00001 Schreibweg. Bezug: R00098 (idempotentes Anlegen, Wiederöffnen), R00096 (Grenzen), R00097 (Menschen-Spalten), R00120 (board-weite Sperre), R00128 (archivierte Boards), ADR-0003 N2 (Ordnung der Abweisungen), ADR-0021 (Verlauf), ADR-0024 (Schritte einer Aktion).
- **Heimat:** eigene Interaction `I0145` unter D0007.
- Labels der Karte: `architektur`, `sicherheit`.
