---
id: R00001
status: Neu
datum: 2026-10-18
---

# R00001: Ordner öffnen

## Beschreibung

`kanbanD <ordner>` startet die Anwendung für genau diesen Ordner: der Ordner wird bei Bedarf angelegt, ein Git-Repository bei Bedarf eingerichtet, der Server lauscht im LAN und das erste Browserfenster öffnet sich.

Zahlt ein auf: [Vision](R00000-vision.md) — „Start mit einem Befehl“, „Git ist Voraussetzung“.

## Geschäftlicher Nutzen

Ein Befehl statt zwei Anwendungen und zwei Starts; das Board ist sofort dort, wo die Arbeit liegt.

## Funktionale Anforderungen

- Aufruf `kanbanD <ordner> [--port <n>] [--host <adresse>] [--kein-browser]`; ohne Ordner gilt das aktuelle Verzeichnis.
- Existiert der Ordner nicht, wird er angelegt.
- Liegt der Ordner in keinem Git-Repository, führt kanbanD `git init` im Ordner aus.
- Der Server lauscht auf `--host` (Standard `0.0.0.0`) und `--port` (Standard 7420); ist der Port belegt, nimmt kanbanD den nächsten freien.
- Die Konsole nennt die Adresse; ohne `--kein-browser` öffnet sich der Standardbrowser mit dieser Adresse.
- `GET /` liefert die Oberfläche, `GET /api/zustand` den Ordner und ob er schon eingerichtet ist.
- Unbekannte Argumente brechen mit einer Hilfezeile und Exit-Code 2 ab.

## Nicht-funktionale Anforderungen

- Performance: der Server antwortet spätestens 2 s nach dem Start.
- Benutzerfreundlichkeit: Meldungen auf Deutsch.

## Akzeptanzkriterien

### Start
- [ ] `kanbanD /tmp/x --kein-browser --port 0` legt `/tmp/x` an, initialisiert Git und antwortet auf `GET /api/zustand` mit `{"ordner":"/tmp/x","eingerichtet":false}`
- [ ] Ein bereits bestehendes Repository wird nicht neu initialisiert (vorhandene Commits bleiben)
- [ ] Ist Port 7420 belegt, startet kanbanD auf 7421 und nennt diese Adresse

### Argumente
- [ ] `kanbanD --gibtsnicht` endet mit Exit-Code 2 und einer Zeile, die mit `Aufruf: kanbanD` beginnt
- [ ] `kanbanD --hilfe` zeigt die Aufrufzeile und endet mit 0

### Oberfläche
- [ ] `GET /` liefert eine HTML-Seite mit Titel `kanbanD`

## Betroffene Verzeichnisstruktur

Einstieg in `src/main.rs`, Startlogik in `src/start/` (Argumente, Ordner, Server), Web in `src/web/`, Oberfläche als eingebettete Dateien unter `web/`; Tests in `src/start/*` (Unit), `tests/start.rs` (Integration), `e2e/tests/` (E2E).

## Technische Überlegungen

### Ablauf
1. **Argumente lesen** — `Startauftrag::aus_argumenten(args)`
2. **Ordner vorbereiten** — `ordner_vorbereiten(&pfad)`: anlegen, `git rev-parse` prüfen, sonst `git init`
3. **Server starten** — Listener auf erstem freien Port ab Startport, Router bauen
4. **Browser öffnen** — `xdg-open`/`open`/`start` je Plattform, Fehler nur melden

### Grobentwurf

- `Startauftrag` (DTO, immutable) — Ordner, Host, Port, Browser öffnen ja/nein
  - `fn aus_argumenten(args) -> Result<Startauftrag, Aufruffehler>`
- `Aufruffehler` (Enum) — Hilfe gewünscht / unbekanntes Argument / fehlender Wert
- `ordner_vorbereiten(pfad) -> io::Result<PathBuf>` (Operation, wirft)
- `freien_listener_binden(host, port) -> TcpListener` (Operation)
- `web::router(Arbeitsordner) -> Router` (Integration)

## Tests

- Unit: `Startauftrag::aus_argumenten` (pure)
- Integration: `ordner_vorbereiten` gegen ein temporäres Verzeichnis mit echtem Git; Router gegen echten Listener
- E2E: Playwright öffnet die Startseite des gestarteten Programms

## Abhängigkeiten
- Abhängig von: —
- Blockiert: R00002

## Offene Fragen
