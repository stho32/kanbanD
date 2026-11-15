---
id: R00161
status: Neu
datum: 2026-11-15
ursprung: Bug-Report
ursprungslauf:
---

# R00161: Behebung — Nicht-UTF-8-Datei in `aufgaben/` macht das Board unbedienbar

## Beschreibung

Liegt in `aufgaben/` eine Datei, die kein gültiges UTF-8 ist, antworten `GET /api/zustand` und jedes Anlegen mit `key` mit **500** „Dateizugriff: stream did not contain valid UTF-8“. Das Board lädt nicht mehr; eine einzige fremd gespeicherte Datei sperrt den ganzen Ordner. Zugesagt ist für unlesbare Aufgabendateien das Gegenteil: sie werden als **defekte Datei** mit Pfad und Grund geführt, alles andere bleibt bedienbar.

Herkunft: Karte #171, Bestand, gefunden im Code-Review von #44 (R00157). Ursache und Abhilfe hat der architekt am Code belegt, nicht am Programm gefahren; die erste Bubble misst die 500 am heutigen Stand.

## Ursachenanalyse

### Root Cause

`Ordner::aufgaben` liest jede Datei über `self.lies(&rel)?` (`src/ablage.rs:97`), also über `read_to_string` (`:41–47`). Ungültiges UTF-8 ist dort ein `io::Error`, der die Schleife mit `?` verlässt und in `src/fehler.rs:67` zu 500 wird. Jeder Aufrufer scheitert mit: Zustand, Aufgabenliste, Anlegen mit `key` oder `board`, Züge, erledigen, Reservierung, Verlauf, Herkunft.

Schaden: das Programm ist nicht bedienbar. Kein Datenverlust — nichts überschreibt, benennt um oder committet die Datei; `naechste_nummer` zählt über den Dateinamen.

### Betroffene Komponenten

- `src/ablage.rs` — `Ordner::aufgaben` (und als Härtung `boards()`, `:82`).
- Tests: neue Proben neben `tests/defekte_datei_mit_schluessel.rs`.

## Lösungsvorschlag

### Langfristige Lösung

In `Ordner::aufgaben` Bytes lesen (`std::fs::read`). „Nicht gefunden“ bleibt leer, andere Zugriffsfehler bleiben 500. Scheitert `String::from_utf8`, entsteht eine `DefekteDatei` mit dem Grund **„Datei ist kein gültiges UTF-8 — als UTF-8 speichern“**, und die Schleife läuft weiter. Ihre Schlüssel (nur im Speicher, R00157) kommen aus dem verlustbehaftet gelesenen Text: `aufgabe::schluessel_nachsichtig(&String::from_utf8_lossy(..))` — ein lesbarer `key` im Kopf zählt weiter (ADR-0004 N1).

### Alternative Ansätze

- **Verlustbehaftet lesen und als Karte zeigen**: verworfen — die Karte zeigte Ersatzzeichen, und das nächste Speichern schriebe sie in die Datei (Datenverlust).
- **Datei beim Lesen umkodieren**: verworfen — kanbanD ändert keine Datei, die der Mensch nicht angefasst hat; die Ausgangskodierung ist nicht sicher zu erraten.

## Test-Strategie

Integrationstests im echten Programm. AK 1 ist die erste Bubble und **rot ohne Fix** (500); die gemessene Antwort steht im Commit. Unverändert grün bleiben `tests/defekte_datei_mit_schluessel.rs` und `tests/fremdschluessel.rs`. Eine Code-Extraktion ist nicht nötig.

## Akzeptanzkriterien

**Grundbestand:** eingerichteter Ordner, Board „fabrik“, `cl` ist Agent, keine Aufgabe. Von Hand angelegt und vor dem Start committet: `aufgaben/0007-kaputt.md` mit genau den drei Bytes `FF FE 00`. Jedes Kriterium beginnt mit einem frischen Grundbestand.

- [ ] **AK 1 Abnahme-Probe der Karte:** Gegeben der Grundbestand. Dann antwortet `GET /api/zustand` mit 200, und `defekte` nennt den Pfad `aufgaben/0007-kaputt.md` und den Grund „Datei ist kein gültiges UTF-8 — als UTF-8 speichern“; das Board lädt im Browser. `POST /api/aufgaben` mit `{"titel": "A", "key": "k1"}` und danach mit `{"titel": "B"}` → je 201. Heute: je 500 „Dateizugriff: stream did not contain valid UTF-8“ für Zustand und Anlegen mit `key`.
- [ ] **AK 2 Die Datei bleibt unberührt:** Nach AK 1 ist `aufgaben/0007-kaputt.md` bytegleich (`FF FE 00`), kein Commit berührt sie, und die neuen Karten heißen #8 und #9.
- [ ] **AK 3 Ein lesbarer Schlüssel zählt weiter:** Gegeben statt der Grundbestand-Datei `aufgaben/0007-kaputt.md` mit dem Kopf `id: 7`, `title: Fund`, `key: abc` und einem Byte `FF` im Text. Wenn `POST /api/aufgaben` mit `{"titel": "Fund", "key": "abc"}` gesendet wird, dann 423 wie bei jeder defekten Datei mit Schlüssel (R00157): die Meldung nennt `aufgaben/0007-kaputt.md`, den Grund aus AK 1 und den Schlüssel `abc`; keine zweite Karte, kein Commit.
- [ ] **AK 4 Der Rest des Ordners bleibt bedienbar:** Gegeben der Grundbestand und die lesbare Karte #1 auf „fabrik“. Dann antworten `GET /api/aufgaben` und ein Zug von #1 in eine andere Spalte je mit 200; die defekte Datei erscheint nicht als Karte.
- [ ] **AK 5 Gegenprobe — ein echter Zugriffsfehler bleibt 500:** Gegeben statt der Grundbestand-Datei eine Aufgabendatei ohne Leserecht (`chmod 000`). Dann antwortet `GET /api/zustand` mit 500 „Dateizugriff: …“ wie heute.
- [ ] **AK 6 Anzeige:** Im Grundbestand zeigt die bestehende Anzeige der defekten Dateien auf dem Board den Pfad `aufgaben/0007-kaputt.md` und den Grund aus AK 1 (kein Umbau der Anzeige).
- [ ] **AK 7 Keine neuen Fehler:** `cargo test` ist grün, ohne geänderte Erwartung eines bestehenden Tests.

## Implementierungshinweise

- **Nicht hinein:** `einstellungen()` (`src/ablage.rs:67`) und `board(slug)` (`:164`); die Einzelwege zur kaputten Nummer selbst (Lesen, Ändern, endgültig löschen von #7 antworten weiter 500); Reparatur oder Umkodierung der Datei.
- **Härtung, kein Kriterium:** derselbe Lese-Helfer darf `boards()` (`:82`) mitnehmen.
- Der Grund ist ein neuer sichtbarer Text (Label `text`); kein neuer Statuscode, kein neues Feld in der API.
- AK 5 läuft nicht als `root` (dort greift `chmod 000` nicht).

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: eine Datei in `aufgaben/`, die ein Editor oder ein Werkzeug nicht als UTF-8 gespeichert hat. Führt `Ordner::aufgaben` diese Datei als defekt, statt die Schleife mit einem Zugriffsfehler zu verlassen (X), dann bekommen alle Aufrufer wieder ihre Liste der lesbaren Aufgaben samt der defekten Datei (Y), und das Board lädt, nennt Pfad und Grund und bleibt bedienbar, bis der Mensch die Datei neu gespeichert hat (Z). Der Hebel sitzt an der einen Lesestelle, die alle Wege teilen.

## Notizen

- Priorität: Hoch (Klasse `vorrang`) — Programm nicht bedienbar.
- Workaround heute: die Datei von Hand als UTF-8 speichern oder aus `aufgaben/` nehmen.
- Bezug: R00157 (Schlüssel defekter Dateien, 423), ADR-0004 N1. Heimat: I0148 unter D0007.
- `ursprungslauf` leer: Bestand, kein einzelner Slice zuzuordnen.
