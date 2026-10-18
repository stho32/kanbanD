# kanbanD

Ein Kanban, das ein Ordner ist. Aufgaben und Boards sind Markdown-Dateien, jede Aktion ist ein Git-Commit unter dem Namen der handelnden Person — Mensch im Browser oder Agent an der API.

Zielbild: [Anforderungen/R00000-vision.md](Anforderungen/R00000-vision.md) · Umfang: [Dokumentation/Planung/kanbanD.md](Dokumentation/Planung/kanbanD.md) · Gestaltung: [Dokumentation/Wireframes/](Dokumentation/Wireframes/)

## Start

```bash
cargo build --release
./target/release/kanbanD <ordner> [--port 7420] [--host 0.0.0.0] [--kein-browser]
```

Der Ordner wird bei Bedarf angelegt, ein Git-Repository bei Bedarf eingerichtet; der Browser öffnet sich mit der Adresse. Beim ersten Start fragt die Seite nach „ich“, Agenten, Board und Spalten.

## Bedienen in Kürze

- **Mehrere auf einmal:** eine Liste (aus Notiz, Mail, Protokoll) in „+ Karte“, „+ Aufgabe ohne Board“ oder „+ Teilaufgabe“ einfügen — je Zeile eine, ein Commit.
- **Schnelleingabe:** `Login reparieren @mi class:bug label:ui due:morgen I0007` setzt Zuständige, Klasse, Label, Fälligkeit und Herkunft gleich beim Anlegen; die Vorschau zeigt, was erkannt wurde.
- **An der Karte:** ▶/■ Timer, „+ mich“, Doppelklick auf den Titel benennt um.
- **Tastatur:** Pfeile wählen, Umschalt+Pfeile verschieben, Enter öffnet, `n` neue Karte, `t` Timer, `m` mir zuweisen, F2 umbenennen, `/` Filter, `?` alle Kürzel, Strg+Z macht die letzte Bewegung oder Anlage rückgängig.
- **Filter:** Text, `#12`, `@kürzel`, `class:bug`, `origin:I0023`, `label:ui`, `is:archived`.

## Der Ordner

```
<ordner>/
  kanbanD.md                 Personen (people), Klassen (classes), Quellpfade (sources)
  boards/<slug>.md           # Titel, je Spalte „## Name“, je Aufgabe „- [#12](../aufgaben/0012-….md)“
  aufgaben/0012-titel.md     Frontmatter (id, title, class, assignees, labels, due, origins, archived),
                             Beschreibung, „- [ ]“-Teilaufgaben, Codeblöcke kanbanD-time und kanbanD-comments
  aufgaben/0012-titel/       Anhänge
```

Eine Aufgabe zu bewegen ändert nur die Board-Datei. Dieselbe Aufgabe kann auf mehreren Boards liegen. Wer an kanbanD vorbei Dateien ändert, sieht sie live in allen Browsern; committet wird das nicht von kanbanD.

## Für Agenten

`GET /api` beschreibt alle Endpunkte, `GET /api/endpunkte` liefert sie als JSON. Schreibende Aufrufe nennen `X-KanbanD-Wer: <kürzel>`:

```bash
curl -X POST http://localhost:7420/api/aufgaben -H 'X-KanbanD-Wer: cl' \
     -H 'Content-Type: application/json' -d '{"titel":"Dateiwächter","board":"entwicklung"}'
```

`GET /api/ereignisse` meldet jede Änderung im Ordner als Server-Sent Event.

## Tests

```bash
cargo test                       # Unit und Integration (gegen das echte Programm und echtes Git)
node --test e2e/einheit/         # Unit-Tests der reinen JavaScript-Funktionen
cd e2e && npm install && npx playwright install chromium && npx playwright test   # E2E im Browser
cargo llvm-cov --summary-only    # Abdeckung
```
