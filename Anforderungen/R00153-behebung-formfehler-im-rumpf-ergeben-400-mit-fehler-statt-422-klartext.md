---
id: R00153
status: Neu
datum: 2026-11-15
ursprung: Bug-Report
ursprungslauf: R00102
---

# R00153: Behebung — Formfehler im Rumpf ergeben 422 Klartext statt 400 mit `{"fehler": …}`

## Beschreibung

Ein JSON-Rumpf mit falscher Form (falscher Typ, fehlendes Pflichtfeld, unbekannter Wert einer Aufzählung) wird an jedem schreibenden Endpunkt mit JSON-Rumpf vom Rahmen (axum) mit **422** und `text/plain` abgewiesen, bevor die Fachprüfung greift; kaputtes JSON mit 400, ein fehlender `Content-Type` mit 415 und ein zu großer Rumpf mit 413 — alle als englischer Klartext. ADR-0003 verlangt für Formfehler **400** mit Rumpf `{"fehler": "…"}`; die API-Beschreibung nennt an jedem Endpunkt 400 und nirgends 422.

Reproduzierbar: `PUT /api/boards/entwicklung/spalten` mit `[{"name": "Zu erledigen", "grenze": "3"}]` → heute 422, `text/plain`, englischer Text des Rahmens. Erwartet: 400, `Content-Type: application/json`, `{"fehler": "…"}` mit dem Feldnamen `grenze`, kein Commit.

Herkunft: Karte #39 (Anmerkung A1 aus dem Entwicklertest von #27, 2026-11-05; Kommentar 2026-11-12 aus #108: fehlt `text` in `POST …/teilaufgaben`, antwortet axum mit 422). Älteres Verhalten aller Endpunkte mit `Json<…>`, nicht durch #27 entstanden. Einordnung des product-owner (2026-11-15): Bruch des API-Kontrakts (ADR-0003), klein.

Zahlt ein auf: [Vision](R00000-vision.md) — Agenten-Schnittstelle: ein Agent reagiert auf eine Abweisung, ohne Text des Rahmens zu deuten.

## Ursachenanalyse

### Root Cause

- 36 Handler in `src/web/mod.rs` (`:244`–`:1639`) nehmen den Rumpf als `Json<T>` von axum 0.8.9. Die Abweisung des Extraktors (`JsonRejection`) entsteht vor dem Handler und geht nicht durch `impl IntoResponse for Fehler` (`src/web/mod.rs:152`–`:181`).
- Vier Abweisungsarten des Rahmens, alle Klartext: `JsonDataError` (422), `JsonSyntaxError` (400), `MissingJsonContentType` (415), `BytesRejection` (413 bei überschrittener Grenze) — ADR-0003 Nachtrag N3. Die Codes 415 und 413 sind aus der Kenntnis des Rahmens genannt und **nicht geprobt**.
- `tests/termine.rs:31` hält das falsche Verhalten fest (422 für `linie: "wellig"`).

Ausgeschlossen: die Fachprüfungen (400, 403, 409, 423 kommen schon als `{fehler}`); die roh angenommenen Felder `cost`, `estimate`, `index`, `position`, `erledigt` (in `NeueTeilaufgabe`), `datums_trenner` (schon 400 mit fachlicher Meldung); die fünf Handler, die den Rumpf als `Bytes` lesen.

### Betroffene Komponenten

- `src/web/mod.rs` (36 Handler; Liste mit Zeilen in der Tabelle unter AK 2), neues Modul unter `src/web/` für den Extraktor, `Cargo.toml` (`serde_path_to_error` direkt nennen — liegt über axum schon im Baum, keine neue Abhängigkeit).
- `tests/termine.rs:31`; neuer Integrationstest über alle schreibenden Endpunkte.

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0003, Nachträge N1 und N3 (Akzeptiert): **ein eigener Extraktor `JsonKoerper<T>`** unter `src/web/`, den alle 36 Handler statt `Json<T>` nehmen.

- Inhalt (falscher Typ, fehlendes Feld, unbekannter Aufzählungswert, kaputtes JSON) → `Fehler::Ungueltig` → 400 `{fehler}`, Feldpfad aus `serde_path_to_error`, Meldung deutsch.
- Transport behält seinen Code und bekommt die Form: fehlender oder falscher `Content-Type` → 415, Rumpf über der Grenze → 413, beide `application/json` mit `{fehler}`. 415 und 413 werden keine Varianten von `Fehler`; die Abweisung ist ein Typ der Web-Schicht und baut den Rumpf mit derselben Funktion wie `IntoResponse for Fehler`.

### Alternative Ansätze

Verworfen in ADR-0003 N1/N3: `Result<Json<T>, JsonRejection>` je Handler (36 Stellen, vergessbar); ein Layer, der 422 nachträglich umschreibt (kennt den Feldpfad nicht, zweiter Antwortweg); nur den Status ändern; alles 400 (415/413 nicht mehr unterscheidbar); eigene `Fehler`-Varianten für Transport.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Integrationstest im echten Programm (`tests/`, Helfer `tests/gemeinsam`): die Tabelle unter AK 2, je Zeile eine Anfrage. **Rot ohne Fix** (422, `text/plain`).

### Code-Extraktion für isoliertes Testing

Der Extraktor ist für sich testbar (Unit): je Abweisungsart ein Fall, dazu ein verschachteltes Feld und die Meldung ohne Rahmen-Text.

### Regressionstests

- `tests/termine.rs:31` wird auf 400 umgestellt — **bewusst geänderte Erwartung**, weil sie dem Kontrakt (ADR-0003) widersprach. Keine andere bestehende Erwartung ändert sich.
- Abgleich der Tabelle gegen `src/web/endpunkte.rs` (AK 3), damit ein neuer schreibender Endpunkt nicht ungeprüft bleibt.
- Die bestehende Suite (`cargo test`) bleibt grün: gültige Rümpfe, rohe Felder, `Bytes`-Handler.

## Akzeptanzkriterien

**Grundbestand** (herstellbar mit `tests/gemeinsam`: `mit_drei_aufgaben`, Start mit `--port 0`): eingerichteter Ordner, Person „st“, Board „entwicklung“ mit der Spalte „Zu erledigen“, Aufgaben #1–#3. Jede Anfrage trägt `X-KanbanD-Wer: st` und, wo nicht anders gesagt, `Content-Type: application/json`.

**Form einer Abweisung** (gilt für jedes Kriterium, das „in der Form“ sagt): genannter Status; `Content-Type: application/json`; der Rumpf ist ein JSON-Objekt mit dem Feld `fehler` (nicht leere Zeichenkette); **kein Commit** = `git rev-parse HEAD` und `git status --porcelain` des Board-Ordners sind vor und nach der Anfrage gleich.

**Meldung:** deutsch; enthält den genannten Feldnamen; enthält keinen Text des Rahmens (`invalid type`, `invalid value`, `expected`, `missing field`, `unknown variant`, `Failed to`); wiederholt den gesendeten Wert nicht. Empfohlene Hausform wie bei `estimate` und `cost`: `<Feldpfad>: <was erwartet wird>` (Wortlaut und Pfadform sind Sache des Entwicklers, ADR-0003 N1 „Grenze“).

### Bug behoben (Pflicht)

- [ ] **AK 1 Abnahme-Probe der Karte (wörtlich):** je schreibendem Endpunkt ein Rumpf mit falschem Typ → 400, `Content-Type: application/json`, Rumpf `{"fehler": "…"}` mit Feldnamen; kein Commit. — Erfüllt, wenn AK 2 und AK 3 erfüllt sind.
- [ ] **AK 2 Jeder der 36 Endpunkte mit JSON-Rumpf:** Gegeben der Grundbestand, wenn die Anfrage einer Zeile der Tabelle gesendet wird, dann antwortet der Server mit 400 in der Form, und `fehler` enthält den Feldnamen der Zeile. Heute: 422, `text/plain`.

| Nr | Methode und Pfad | Handler (`src/web/mod.rs`) | Rumpf mit falschem Typ | Feldname in `fehler` |
|---|---|---|---|---|
| 1 | POST /api/einrichten | `einrichten` :244 | `{"ich": 7}` | `ich` |
| 2 | PATCH /api/boards/entwicklung | `board_aendern` :302 | `{"archiviert": "ja"}` | `archiviert` |
| 3 | POST /api/aufgaben | `aufgabe_anlegen` :374 | `{"titel": 7}` | `titel` |
| 4 | POST /api/boards/entwicklung/bewegen | `bewegen` :392 | `{"nummer": "eins", "spalte": "Zu erledigen"}` | `nummer` |
| 5 | POST /api/boards | `board_anlegen` :444 | `{"titel": 7}` | `titel` |
| 6 | PUT /api/boards/entwicklung/spalten | `spalten_setzen` :462 | `[{"name": "Zu erledigen", "grenze": "3"}]` | `grenze` |
| 7 | PUT /api/boards/entwicklung/termine | `termine_setzen` :480 | `[{"name": "X", "datum": "2027-10-31", "farbe": "red", "ziel": "ja"}]` | `ziel` |
| 8 | PUT /api/boards/entwicklung/start | `start_setzen` :503 | `{"start": 7}` | `start` |
| 9 | PUT /api/boards/entwicklung/berichtsfilter | `berichtsfilter_setzen` :521 | `{"messbasisTage": "viele"}` | `messbasisTage` |
| 10 | PUT /api/boards/entwicklung/bestand | `bestand_setzen` :539 | `{"zeilen": 7, "spalten": "x"}` | `zeilen` |
| 11 | PUT /api/boards/entwicklung/fieber | `fieber_setzen` :557 | `{"perzentil": "hoch"}` | `perzentil` |
| 12 | POST /api/boards/entwicklung/fieber/cache | `fieber_ergaenzen` :595 | `{"schluessel": 7, "tage": []}` | `schluessel` |
| 13 | PUT /api/boards/entwicklung/anwendungen | `bindung_setzen` :622 | `[7]` | Stelle `0` (Liste ohne Feldnamen) |
| 14 | POST /api/personen | `person_anlegen` :665 | `{"kuerzel": 7, "name": "X"}` | `kuerzel` |
| 15 | PATCH /api/personen/st | `person_aendern` :683 | `{"aktiv": "ja"}` | `aktiv` |
| 16 | PUT /api/einstellungen | `einstellungen_setzen` :710 | `{"personen": 7}` | `personen` |
| 17 | PATCH /api/aufgaben/1 | `aufgabe_aendern` :787 | `{"titel": 7}` | `titel` |
| 18 | POST /api/aufgaben/1/teilaufgaben | `teilaufgabe_anlegen` :870 | `{"text": 7}` | `text` |
| 19 | PATCH /api/aufgaben/1/teilaufgaben/0 | `teilaufgabe_aendern` :900 | `{"text": 7}` | `text` |
| 20 | POST /api/aufgaben/1/kommentare | `kommentieren` :925 | `{"text": 7}` | `text` |
| 21 | POST /api/aufgaben/erledigen | `erledigen` :938 | `{"key": 7}` | `key` |
| 22 | PATCH /api/aufgaben/1/wbs-effects | `wirkung_setzen` :951 | `{"application": 7}` | `application` |
| 23 | POST /api/aufgaben/1/wbs-effects/0/eintritt | `wirkung_eintritt` :981 | `{"an": "ja"}` | `an` |
| 24 | POST /api/aufgaben/1/zeiten | `zeit_nachtragen` :1038 | `{"dauer": 30}` | `dauer` |
| 25 | PATCH /api/aufgaben/1/zeiten/x | `zeit_korrigieren` :1051 | `{"beginn": 7}` | `beginn` |
| 26 | POST /api/aufgaben/1/durchlaeufe | `durchlauf_eintragen` :1168 | `{"phase": 7, "ergebnis": "ok"}` | `phase` |
| 27 | PATCH /api/wbs/kd/knoten/I0001 | `wbs_status` :1291 | `{"status": 7}` | `status` |
| 28 | POST /api/wbs/kd/knoten | `wbs_knoten_anlegen` :1304 | `{"name": 7}` | `name` |
| 29 | POST /api/boards/entwicklung/aufgaben | `auf_board_legen` :1363 | `{"nummer": "eins"}` | `nummer` |
| 30 | POST /api/aufgaben/mehrere | `aufgaben_anlegen` :1517 | `{"titel": 7}` | `titel` |
| 31 | POST /api/aufgaben/1/teilaufgaben/mehrere | `teilaufgaben_anlegen` :1545 | `{"texte": [7]}` | `texte` |
| 32 | POST /api/boards/entwicklung/bewegen-mehrere | `mehrere_bewegen` :1568 | `{"ziele": [{"nummer": "eins", "spalte": "Zu erledigen"}]}` | `nummer` |
| 33 | POST /api/boards/entwicklung/aufgaben/mehrere | `mehrere_auf_board_legen` :1587 | `{"nummern": ["eins"]}` | `nummern` |
| 34 | PATCH /api/aufgaben/mehrere | `mehrere_aendern` :1612 | `{"aenderungen": 7}` | `aenderungen` |
| 35 | POST /api/aufgaben/archivieren | `mehrere_archivieren` :1626 | `{"nummern": "alle"}` | `nummern` |
| 36 | POST /api/aufgaben/zurueckholen | `mehrere_zurueckholen` :1639 | `{"nummern": "alle"}` | `nummern` |

- [ ] **AK 3 Die Tabelle ist vollständig:** Der Test gleicht ab: die Einträge mit Methode ≠ GET in `src/web/endpunkte.rs` (gezählt: 57) sind genau die 36 Zeilen aus AK 2 plus die 21 unten benannten ohne JSON-Rumpf. Kommt ein schreibender Endpunkt hinzu, der in keiner der beiden Listen steht, ist der Test rot. Rechnung: 57 = 36 + 5 + 16.
  - Rumpf als `Bytes` (5, bleiben unverändert): `POST /api/boards/{slug}/ziehen`, `POST /api/aufgaben/{nr}/timer/stop`, `POST /api/wbs/{kuerzel}/knoten/{id}/verwerfen`, `POST /api/aufgaben/{nr}/reservierung`, `DELETE /api/aufgaben/{nr}/reservierung`.
  - Ohne Rumpf oder Multipart (16): `DELETE /api/boards/{slug}`, `DELETE /api/boards/{slug}/fieber/cache`, `DELETE /api/personen/{kuerzel}`, `POST /api/aufgaben/{nr}/duplizieren`, `DELETE /api/aufgaben/{nr}`, `PUT` und `DELETE /api/aufgaben/{nr}/signale/{signal}`, `DELETE /api/aufgaben/{nr}/teilaufgaben/{i}`, `DELETE /api/aufgaben/{nr}/wbs-effects/{i}`, `POST /api/aufgaben/{nr}/timer/start`, `DELETE /api/aufgaben/{nr}/zeiten/{kennung}`, `POST /api/aufgaben/{nr}/anhaenge` (Multipart), `DELETE /api/aufgaben/{nr}/anhaenge/{name}`, `POST /api/aufgaben/{nr}/archivieren`, `POST /api/aufgaben/{nr}/zurueckholen`, `DELETE /api/boards/{slug}/aufgaben/{nr}`.
- [ ] **AK 4 Falscher Typ, die drei Beispiele der Karte:** Gegeben der Grundbestand, wenn `PUT /api/boards/entwicklung/spalten` mit `[{"name": "Zu erledigen", "grenze": -1}]`, mit `"grenze": "3"` und mit `"grenze": 2.0` gesendet wird, dann antwortet der Server je mit 400 in der Form, `fehler` enthält `grenze`, und `boards/entwicklung.md` ist unverändert. (Die Karte schreibt „PATCH …/spalten“; der Endpunkt ist `PUT`.)
- [ ] **AK 5 Fehlendes Pflichtfeld (Kommentar aus #108):** wenn `POST /api/aufgaben/1/teilaufgaben` mit `{}` gesendet wird, dann 400 in der Form, `fehler` enthält `text`; die Aufgabe hat keine neue Teilaufgabe. Heute: 422.
- [ ] **AK 6 Unbekannter Wert einer Aufzählung:** wenn `PUT /api/boards/entwicklung/termine` mit `[{"name": "X", "datum": "2027-10-31", "farbe": "red", "linie": "wellig"}]` gesendet wird, dann 400 in der Form, `fehler` enthält `linie`. Das ist der Fall aus `tests/termine.rs:31`; die Erwartung dort wird von 422 auf 400 geändert und im Commit als bewusst geänderte Erwartung benannt.
- [ ] **AK 7 Verschachteltes Feld:** wenn `POST /api/boards/entwicklung/bewegen-mehrere` mit `{"ziele": [{"nummer": 1, "spalte": "Zu erledigen"}, {"nummer": "zwei", "spalte": "Zu erledigen"}]}` gesendet wird, dann 400 in der Form, `fehler` enthält `nummer` und benennt das zweite Element (Stelle 1); keine der beiden Aufgaben ist bewegt.
- [ ] **AK 8 Kaputtes JSON:** wenn `POST /api/aufgaben` mit dem Rumpf `{"titel": ` (abgeschnitten) gesendet wird, dann 400 in der Form mit deutscher Meldung, die sagt, dass der Rumpf kein gültiges JSON ist; keine Aufgabe ist angelegt. Heute: 400 `text/plain`. Ebenso der leere Rumpf (0 Bytes).
- [ ] **AK 9 Meldung ohne Rahmen-Text und ohne den gesendeten Wert:** wenn `PUT /api/boards/entwicklung/spalten` mit `[{"name": "Zu erledigen", "grenze": "Zx9-Inhalt"}]` gesendet wird, dann enthält `fehler` weder `Zx9-Inhalt` noch eines der Wörter aus „Meldung“ oben; dasselbe gilt für die 36 Antworten aus AK 2 (Wörter des Rahmens).
- [ ] **AK 10 Fehlender oder falscher `Content-Type`:** wenn `POST /api/aufgaben` mit dem gültigen Rumpf `{"titel": "x", "board": "entwicklung"}` ohne `Content-Type` und einmal mit `Content-Type: text/plain` gesendet wird, dann je **415** in der Form mit deutscher Meldung, die `Content-Type` und `application/json` nennt; keine Aufgabe ist angelegt. **Probe zuerst:** der Status vor dem Fix wird gemessen und im Commit genannt (erwartet 415 Klartext, ungeprobt); weicht er ab, ist das ein Befund an den architekt, kein stilles Anpassen.
- [ ] **AK 11 Rumpf über der Grenze:** wenn `POST /api/aufgaben/1/kommentare` mit einem gültigen JSON-Rumpf von 3 MiB gesendet wird (`{"text": "aaa…"}`), dann **413** in der Form mit deutscher Meldung; kein Kommentar ist geschrieben. **Probe zuerst** wie AK 10. Die Grenze selbst ändert sich nicht (siehe Implementierungshinweise: für JSON-Routen gilt nach Code die Standardgrenze des Rahmens, 2 MiB — nicht 50 MiB).
- [ ] **AK 12 Rot ohne Fix:** Der Test zu AK 2 ist am Stand vor dem Fix für alle 36 Zeilen rot (422) und mit Fix grün; der Commit nennt das Ergebnis.

### Unverändert (Gegenproben)

- [ ] **AK 13 Gültige Rümpfe:** Die bestehende Suite (`cargo test`) ist ohne geänderte Erwartung grün — einzige Ausnahme `tests/termine.rs:31` (AK 6). Beispiel: `POST /api/aufgaben` mit `{"titel": "x", "board": "entwicklung"}` → 201 und genau ein Commit, wie vor dem Fix.
- [ ] **AK 14 Rohe Felder:** `cost`, `estimate`, `index`, `position`, `erledigt` (in `POST …/teilaufgaben`) und `datums_trenner` antworten mit Status und Meldung wie vor dem Fix; die bestehenden Tests dazu (`tests/kosten.rs`, `geschaetzte_zeit.rs`, `zuordnung.rs`, `teilaufgaben.rs`) bleiben unverändert grün. Für `datums_trenner` nennt `tests/` keinen Fall unter diesem Namen: Festhalte-Test mit `PUT /api/boards/entwicklung/spalten` und `[{"name": "Zu erledigen", "datums_trenner": "ja"}]` — Status und Meldung vor dem Fix messen und festschreiben.
- [ ] **AK 15 Unbekannte Schlüssel:** wenn `PATCH /api/boards/entwicklung` mit `{"titel": "Entwicklung", "quatsch": 1}` gesendet wird, dann ist die Antwort dieselbe wie vor dem Fix (Festhalte-Test: Status vor dem Fix messen und festschreiben). Kein Rumpftyp weist unbekannte Schlüssel ab (`deny_unknown_fields` kommt in `src/` nicht vor); diese Anforderung ändert das nicht.
- [ ] **AK 16 `Bytes`-Handler:** `POST /api/aufgaben/1/timer/stop` und `POST /api/aufgaben/1/reservierung` ohne Rumpf und ohne `Content-Type` antworten wie vor dem Fix (kein 415); die bestehenden Tests (`tests/timer.rs`, `reservierung.rs`, `wbs_schreiben.rs`) bleiben unverändert grün.
- [ ] **AK 17 Beschriebener Kontrakt:** `GET /api/openapi.json` und `GET /api/endpunkte` liefern denselben Inhalt wie vor dem Fix (400 mit `Fehlerantwort` steht schon an jedem Endpunkt; 415 und 413 werden nicht nachgetragen, ADR-0003 N3 Punkt 5).

### Bauart (ADR-0003 N1/N3)

- [ ] **AK 18 Eine Stelle:** Kein Handler unter `src/web/` nimmt den Rumpf als `Json<T>` (`grep -c "): Json<" src/web/mod.rs` ergibt 0, heute 36); 415 und 413 sind keine Varianten von `Fehler` (`src/fehler.rs` unverändert). **Mutante:** ein Handler zurück auf `Json<T>` → der Test zu AK 2 ist rot.

## Implementierungshinweise

- **Abgrenzung (gilt, bis der product-owner anders entscheidet):** Falsche **Pfad- und Abfrageparameter** (`Path`/`Query`, z. B. `{nr}` = `abc`, 59 Verwendungen; ADR-0003 N1 Punkt 3) gehören **nicht** in diese Anforderung. Die Abnahme-Probe der Karte nennt nur den Rumpf.
- **Nicht geprobt (Planung ohne Build):** die Rümpfe der Tabelle sind aus den Rumpftypen gelesen, nicht gegen das Programm gefahren. Verbindlich sind Status, Form und „kein Commit“. Liefert `serde_path_to_error` für eine Zeile den Feldnamen nicht, meldet der Entwickler das, statt die Erwartung still zu ändern.
- **Eingebettete Teile:** `NeueAufgabe.angaben`, `Eintrag::MitAngaben` und `EineAenderung.aenderung` sind `#[serde(flatten)]` bzw. eine Aufzählung ohne Kennzeichen; für Felder darin (`POST /api/aufgaben` mit `{"titel": "x", "labels": 7}`) liefert serde den Feldnamen voraussichtlich nicht. Verlangt ist dort 400 in der Form; der Feldname nur, soweit der Pfad ihn trägt (offene Frage unten).
- **Fehlendes Feld:** `serde_path_to_error` nennt beim fehlenden Feld den Pfad des umgebenden Objekts; der Feldname steht nur im Text des Rahmens und muss von dort in die deutsche Meldung übernommen werden (AK 5).
- **Grenze des Rumpfs:** ADR-0003 N3 nennt 50 MiB (`src/web/mod.rs:120`); diese Zeile gilt nur für die Routen `anhaenge`/`anhang_ablegen` (Multipart). Für die 36 JSON-Handler ist keine Grenze gesetzt, es gilt die Standardgrenze des Rahmens (2 MiB laut dessen Dokumentation, ungeprobt). AK 11 misst sie.
- **Reihenfolge:** Der Formfehler entsteht vor dem Handler; `PUT /api/boards/gibtsnicht/termine` mit falschem Rumpf ergibt 400, nicht 404 (ADR-0003 N2 „400 bleibt vorn“).
- Die Oberfläche zeigt `json.fehler` an (`web/app.js:100`); mit dem Fix erscheint dort die deutsche Meldung statt des Statustexts. Kein Element und kein Code der Oberfläche ändert sich.
- Protokollierung: ADR-0001 (Logging) ist „Vorgeschlagen“ und nicht gebaut; diese Anforderung schreibt keine Protokollzeile.

## Offene Fragen

Keine, die den Bau aufhält. An den product-owner:

1. `Path`/`Query` in derselben Form (ADR-0003 N1 Punkt 3) — eigene Karte oder hier? Geplant: nicht hier (Abgrenzung oben).
2. Feldname bei eingebetteten Teilen (`labels` in `POST /api/aufgaben`, Felder in `aenderungen[i]`): geplant ist 400 in der Form ohne Pflicht zum Feldnamen. Empfehlung des planers: so lassen — der Feldname dort verlangt eigene Leseroutinen für drei Rumpftypen.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: `grenze: "3"` an `PUT …/spalten` ergibt 422 Klartext, weil der Rahmen den Rumpf abweist, bevor ein Handler ihn sieht. Lesen alle 36 Handler den Rumpf über einen eigenen Extraktor (X), dann geht jede Abweisung des Rumpfs durch dieselbe Abbildung wie die Fachfehler (Y), und ein Agent bekommt an jedem Endpunkt 400 mit `{fehler}` und dem Feldnamen, wie ADR-0003 und die API-Beschreibung es zusagen (Z). Der Abgleich gegen `endpunkte.rs` und die Mutante halten fest, dass der nächste Endpunkt nicht wieder durchfällt.

## Notizen

- Priorität: Mittel — Bruch des API-Kontrakts, klein (product-owner 2026-11-15). Workaround: Clients behandeln 422 wie 400.
- **Herkunft:** Karte #39; Technik: ADR-0003 Nachträge N1 (2026-11-13) und N3 (2026-11-15, `93cb6a2`). Bezug: R00096, R00097, R00102.
- **Heimat:** eigene Interaction `I0140` unter D0007.
- **Zählungen (planer, 2026-11-15, gezählt am Stand `93cb6a2`):** 57 Einträge mit Methode ≠ GET in `src/web/endpunkte.rs`; 57 schreibende Routen in `src/web/mod.rs`, davon 36 mit `Json<T>`, 5 mit `Bytes`, 16 ohne Rumpf oder Multipart.
- **Abweichungen vom Text der ADR-0003 N3, an den architekt gemeldet:** (1) „unbekannter Schlüssel bei `deny_unknown_fields`“ — kein Typ in `src/` trägt das Attribut; der Fall in `tests/termine.rs:31` ist ein unbekannter Aufzählungswert (AK 6, AK 15). (2) „Die Grenze ist 50 MiB“ gilt nur für Anhänge (AK 11).
- Labels der Karte: `sicherheit`, `text`, `fehlerpfad`.
