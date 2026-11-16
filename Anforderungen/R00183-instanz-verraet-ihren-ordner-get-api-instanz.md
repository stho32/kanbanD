---
id: R00183
status: Erledigt
datum: 2026-11-16
---

# R00183: Instanz verrät ihren Ordner — `GET /api/instanz`

## Beschreibung

Herkunft: Karte #147, Auftrag des Betreibers vom 2026-11-13 (aus Software-Factory R00011, „kanbanD finden oder starten“). Die Ports der laufenden Instanzen ändern sich zwischen Aufrufen: das Programm weicht bei belegtem Port auf den nächsten freien aus (`src/start/server.rs:5`, höchstens 50 Versuche). Ein Agent erkennt „seine“ Instanz deshalb am bedienten Ordner. Den liest er heute aus `/proc/<pid>/cmdline` und `/proc/<pid>/cwd` — nur unter Linux und umständlich bei `kanbanD .`.

**Gewünscht:** `GET /api/instanz` liefert genau `{ordner, port, version}`: `ordner` ist der absolute, kanonische Pfad des bedienten Ordners (Symlinks aufgelöst), `port` der tatsächlich gebundene Port, `version` die Programmversion (heute `0.1.0` aus `Cargo.toml`). Ohne Anmeldung, nur lesend, wie die übrigen GET-Endpunkte.

**Stand am Code (2026-11-16):** Den Ordner nennt `GET /api/zustand` schon heute im Feld `ordner`, kanonisch (`src/dienst/mod.rs:160`, `tests/programm.rs:11`). Dieser Weg liest aber alle Boards und Aufgaben und antwortet bei einer unlesbaren Datei mit 500; Port und Version nennt kein Endpunkt. Fehlender Umfang, kein Fehler.

**Schutz:** Kein GET-Endpunkt hat heute einen eigenen Schutz — keine Anmeldung, keine Prüfung von `Host` oder `Origin`, keine CORS-Kopfzeilen (eine fremde Webseite kann die Antwort im Browser also nicht lesen); gebunden wird ohne `--host` an `0.0.0.0` (`src/start/mod.rs:45`). Der neue Endpunkt bekommt denselben Stand, nicht mehr und nicht weniger. Neu nach außen sichtbar wird nur die Version; der absolute Pfad steht schon in `GET /api/zustand`.

Zahlt ein auf: [Vision](R00000-vision.md) — Agenten arbeiten über die API, ohne das Betriebssystem zu befragen.

## Akzeptanzkriterien

**Ausgangslage:** Ordner `/home/x/Boards/A` (im Test ein temporärer Ordner), darin gestartet mit `kanbanD . --port 7423 --kein-browser`; Port 7423 ist frei.

- [x] **AK 1 Antwort (Abnahme-Probe der Karte):** `GET /api/instanz` → 200, `application/json`, genau `{"ordner": "/home/x/Boards/A", "port": 7423, "version": "0.1.0"}` — drei Felder, kein weiteres; `port` ist eine Zahl, `version` der Wert aus `Cargo.toml`. Heute rot: 404.
- [x] **AK 2 Kanonischer Ordner:** Gestartet über einen Symlink (`/home/x/kurz` → `/home/x/Boards/A`, Aufruf `kanbanD /home/x/kurz`) nennt `ordner` das Ziel `/home/x/Boards/A`. In jedem Fall ist der Wert gleich dem Feld `ordner` von `GET /api/zustand`.
- [x] **AK 3 Gebundener Port:** Ist 7423 beim Start belegt, läuft die Instanz auf 7424 und antwortet dort mit `"port": 7424`. Gestartet mit `--port 0` nennt `port` den Port, auf dem die Anfrage ankam — nie 0.
- [x] **AK 4 Ohne Anmeldung, nur lesend, ohne den Ordner zu lesen:** Die Antwort kommt ohne `X-KanbanD-Wer`, im noch nicht eingerichteten Ordner und auch dann mit 200, wenn `GET /api/zustand` wegen einer Datei ohne Leserecht 500 liefert. Der Aufruf schreibt nichts: Zahl der Commits und `git status` des Ordners sind danach unverändert. `POST /api/instanz` → 405.
- [x] **AK 5 Beschrieben:** Der Endpunkt steht in der Übersicht `GET /api`, in `GET /api/endpunkte` (`wer: false`, Thema „Ordner“), in `GET /api/openapi.json` mit den drei Feldern und ihren Typen und im README im Abschnitt zur API — dort mit dem Satz, dass ein Agent seine Instanz daran erkennt.
- [x] **AK 6 Bleibt:** `GET /api/zustand` antwortet unverändert (Feld `ordner` bleibt); die bestehenden Tests laufen ohne geänderte Erwartung grün.

## Tests

Integration im echten Programm (Vorbild `tests/programm.rs`, Start über `gemeinsam::starten`): AK 1 zuerst (heute 404), dann Symlink, belegter Port (Horcher auf einem freien Port halten, Programm mit diesem Port starten), `--port 0`, Datei ohne Leserecht (nicht als `root`, Vorbild `tests/nicht_utf8_datei.rs`). `tests/api.rs` prüft die Übersicht und das OpenAPI-Dokument von selbst mit.

## Implementierungshinweise

- Vorschlag, keine Vorschrift: Der Router kennt den Port heute nicht — `router_mit_ende(ordner, ende)` in `src/web/mod.rs:43` bekommt ihn aus `src/main.rs:31` (`listener.local_addr()`), `App` trägt ihn. `router(ordner)` für Tests ohne Horcher bleibt aufrufbar. Version aus `env!("CARGO_PKG_VERSION")`.
- Der Ordner kommt aus `ordner_vorbereiten` schon kanonisch (`src/start/ordner.rs:9`); der Handler liest die Ablage nicht (AK 4).
- Route nur über `#[utoipa::path]` und `routes!` (`tests/api.rs:9` weist `.route("/api…` ab), Eintrag in `ENDPUNKTE` (`src/web/endpunkte.rs`), Antworttyp mit `ToSchema`.
- **Nicht hinein:** Host-Bindung ändern · Kopfzeilen oder Anmeldung für GET · weitere Felder (PID, Startzeit, Host) · Oberfläche.

## Warum löst diese Anforderung das Problem?

Auslöser: Die Factory findet nach einem Neustart mehrere Instanzen auf wechselnden Ports und muss wissen, welche ihr Board bedient. Antwortet jede Instanz auf eine leichte, immer verfügbare Abfrage mit ihrem Ordner (X), vergleicht der Agent je Port einen Pfad statt Prozesse zu durchsuchen (Y); die Zuordnung gelingt auf jedem Betriebssystem und auch bei `kanbanD .` (Z).

## Offene Fragen

- Der Endpunkt ist wie alle GET im Netz erreichbar, wenn ohne `--host 127.0.0.1` gestartet wird, und nennt dort Pfad (wie `GET /api/zustand` heute schon) und Version. Empfehlung, der die Kriterien folgen: so bauen — der Betreiber hat „ohne Anmeldung, wie die übrigen GET-Endpunkte“ bestellt; ein Schutz für alle GET wäre eine eigene Karte.
